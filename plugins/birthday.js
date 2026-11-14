// /birthday — members save their birthday once; ARCHON celebrates them at 8:00 their time on every server they share.
//   /birthday set     day, month, optional year, time zone (autocomplete)
//   /birthday view    your own (private, with buttons: show or hide your age, remove) or another member's (no age unless shown)
//   /birthday list    the next 90 days, members of this server only
// The announcement card counts wishes (one per member, no extra messages) and lets members give a few credits.
// Birthdays are per person (one row per user); wishes and gifts are per server and per year.
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { icon } = require('../lib/ui/icons');
const { card } = require('../lib/games/v2');
const { t } = require('../lib/i18n');

const birthdays = new Map();   // userId → { day, month, year, timezone, showAge }
const LANGS = ['en', 'fr', 'zh', 'ar'];
const LOCALE = { en: 'en-US', fr: 'fr-FR', zh: 'zh-CN', ar: 'ar' };
const B = (k, lang, v) => t(`birthday.${k}`, lang, v || {});
const PINK = 0xFF69B4, PURPLE = 0x9B59B6, GREY = 0x95A5A6;
const GIFTS = [25, 50, 100];
const MAX_YEAR = () => new Date().getUTCFullYear() - 13;   // Discord's minimum age
const langOf = (client, gid, where, uid) => { const l = require('../lib/pick-lang').pickLang(client, gid, where, uid); return LANGS.includes(l) ? l : 'en'; };

// ================= DATES =================
function isValidDate(day, month, year) {
    const d = new Date(Date.UTC(year || 2000, month - 1, day));
    return d.getUTCDate() === day && d.getUTCMonth() === month - 1;
}
// "14 November" or "14 November 2000", in the reader's language
function formatDate(day, month, year, lang) {
    const d = new Date(Date.UTC(year || 2000, month - 1, day, 12));
    return d.toLocaleDateString(LOCALE[lang] || 'en-US', { day: 'numeric', month: 'long', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' });
}
const monthName = (month, lang) => new Date(Date.UTC(2000, month - 1, 1, 12)).toLocaleDateString(LOCALE[lang] || 'en-US', { month: 'long', timeZone: 'UTC' });

const ZODIAC = [ // [key, from month, from day]
    ['capricorn', 1, 1], ['aquarius', 1, 20], ['pisces', 2, 19], ['aries', 3, 21], ['taurus', 4, 20], ['gemini', 5, 21], ['cancer', 6, 21],
    ['leo', 7, 23], ['virgo', 8, 23], ['libra', 9, 23], ['scorpio', 10, 23], ['sagittarius', 11, 22], ['capricorn', 12, 22],
];
function zodiacKey(day, month) {
    let key = 'capricorn';
    for (const [k, m, d] of ZODIAC) if (month > m || (month === m && day >= d)) key = k;
    return key;
}
const sign = (day, month, lang) => B(`zodiac.${zodiacKey(day, month)}`, lang);

// ================= TIMEZONES =================
// Stored zones are IANA names (Africa/Bamako) or the "UTC-5" offsets the old
// fixed choice list produced. Both resolve to a local date here.
const LEGACY_OFFSET = /^UTC\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?$/i;

function isValidTimezone(tz) {
    if (!tz) return false;
    if (tz === 'UTC' || LEGACY_OFFSET.test(tz)) return true;
    try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

function isLeapYear(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }

// The calendar date and hour right now in the given zone.
function localParts(tz, now = new Date()) {
    const m = LEGACY_OFFSET.exec(tz || '');
    if (m) {
        const mins = (m[1] === '-' ? -1 : 1) * (parseInt(m[2], 10) * 60 + parseInt(m[3] || '0', 10));
        const d = new Date(now.getTime() + mins * 60000);
        return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours() };
    }
    try {
        const p = new Intl.DateTimeFormat('en-US', {
            timeZone: isValidTimezone(tz) ? tz : 'UTC',
            year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', hourCycle: 'h23',
        }).formatToParts(now).reduce((a, x) => (a[x.type] = x.value, a), {});
        return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour % 24 };
    } catch {
        return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, day: now.getUTCDate(), hour: now.getUTCHours() };
    }
}

function offsetLabel(tz, now = new Date()) {
    if (LEGACY_OFFSET.test(tz || '')) return tz.toUpperCase().replace(/\s/g, '');
    try {
        const v = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
            .formatToParts(now).find(p => p.type === 'timeZoneName')?.value || 'GMT';
        return v === 'GMT' ? 'UTC+0' : v.replace('GMT', 'UTC');
    } catch { return 'UTC+0'; }
}

// ================= TIMEZONE AUTOCOMPLETE =================
// Nothing here is a hand-written list. Countries and their zones come from
// the system tz database (zone.tab), names from Intl.DisplayNames in the
// user's language, and empty-input suggestions from real signals: the
// server's zone, the user's Discord locale, and zones members already use.
const ZONE_TAB = '/usr/share/zoneinfo/zone.tab';

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9+:\-]+/g, ' ').trim();

function tzIndex() {
    if (tzIndex.cache) return tzIndex.cache;
    const byCode = new Map();   // 'BR' -> ['America/Sao_Paulo', ...]
    const info = new Map();     // tz -> { code, note }
    try {
        for (const line of require('fs').readFileSync(ZONE_TAB, 'utf8').split('\n')) {
            if (!line || line[0] === '#') continue;
            const [code, , tz, note = ''] = line.split('\t');
            if (!code || !tz) continue;
            if (!byCode.has(code)) byCode.set(code, []);
            byCode.get(code).push(tz);
            info.set(tz, { code, note });
        }
    } catch {}
    // zone.tab lists every populated zone under its current name. The Intl
    // list is only a fallback, since it also carries legacy aliases.
    let zones = [...info.keys()];
    if (!zones.length) { try { zones = Intl.supportedValuesOf('timeZone'); } catch {} }
    zones = ['UTC', ...zones.filter(z => z !== 'UTC').sort()];

    const displays = {};
    for (const l of ['en', 'fr']) { try { displays[l] = new Intl.DisplayNames([l], { type: 'region' }); } catch {} }
    const countries = [];       // { code, keys: normalised names in every language }
    for (const code of byCode.keys()) {
        const keys = new Set();
        for (const d of Object.values(displays)) { try { const nm = d.of(code); if (nm) keys.add(norm(nm)); } catch {} }
        countries.push({ code, keys: [...keys] });
    }
    return (tzIndex.cache = { zones, byCode, info, countries, displays });
}

function countryName(code, lang) {
    const { displays } = tzIndex();
    try { return (displays[lang] || displays.en)?.of(code) || code; } catch { return code; }
}

function zoneLabel(tz, now, lang) {
    if (LEGACY_OFFSET.test(tz)) return tz;
    const meta = tzIndex().info.get(tz);
    const city = (tz.split('/').pop() || tz).replace(/_/g, ' ');
    let time = '';
    try { time = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now); } catch {}
    const parts = [meta ? `${city} — ${countryName(meta.code, lang)}` : city, offsetLabel(tz, now)];
    if (time) parts.push(time);
    if (meta?.note) parts.push(meta.note);
    return parts.join(' · ').slice(0, 100);
}

// Search order: country code, country name, UTC offset, city, then the
// region notes from zone.tab ("Amazonas", "Pernambuco").
function suggestZones(query, { preferred, locale, db } = {}) {
    const { zones, byCode, info, countries } = tzIndex();
    const lang = String(locale || '').toLowerCase().startsWith('fr') ? 'fr' : 'en';
    const q = norm(query);
    const now = new Date();
    const out = [];
    const push = tz => { if (tz && out.length < 25 && !out.includes(tz) && isValidTimezone(tz)) out.push(tz); };
    // Short queries show a few zones per country; a longer, deliberate one shows them all.
    const pushCountry = code => (byCode.get(code) || []).slice(0, q.length < 4 ? 5 : 50).forEach(push);

    if (!q) {
        push(preferred);
        // Discord locales like pt-BR or en-US carry a country.
        const region = String(locale || '').split('-')[1];
        if (region && /^[A-Z]{2}$/.test(region)) (byCode.get(region) || []).slice(0, 5).forEach(push);
        // Zones the bot's members already chose.
        try {
            for (const r of db.prepare(`SELECT timezone FROM birthday WHERE timezone IS NOT NULL GROUP BY timezone ORDER BY COUNT(*) DESC LIMIT 8`).all()) push(r.timezone);
        } catch {}
        // Fill the rest with one zone per UTC offset, so every offset is reachable.
        const minutes = o => { const m = /UTC([+-])(\d+)(?::(\d+))?/.exec(o); return m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +(m[3] || 0)) : 0; };
        const seen = new Set(out.map(tz => offsetLabel(tz, now)));
        const spread = [];
        for (const tz of zones) { const o = offsetLabel(tz, now); if (!seen.has(o)) { seen.add(o); spread.push([o, tz]); } }
        spread.sort((a, b) => minutes(a[0]) - minutes(b[0])).forEach(([, tz]) => push(tz));
    } else {
        if (/^[a-z]{2}$/.test(q)) pushCountry(q.toUpperCase());
        for (const ct of countries) if (ct.keys.some(k => k.startsWith(q))) pushCountry(ct.code);
        for (const ct of countries) if (ct.keys.some(k => k.includes(q))) pushCountry(ct.code);
        const off = q.replace(/^(utc|gmt)\s*/, '');
        if (/^[+-]?\d{1,2}(:\d{2})?$/.test(off)) {
            const want = (/^[+-]/.test(off) ? off : '+' + off).replace(/^([+-])0(\d)/, '$1$2');
            for (const tz of zones) {
                if (out.length >= 25) break;
                const o = offsetLabel(tz, now).slice(3);
                if (o === want || o.startsWith(want + ':')) push(tz);
            }
        }
        for (const tz of zones) if (norm((tz.split('/').pop() || '').replace(/_/g, ' ')).startsWith(q)) push(tz);
        for (const tz of zones) if (norm(tz.replace(/[_/]/g, ' ')).includes(q)) push(tz);
        for (const tz of zones) if (norm(info.get(tz)?.note).includes(q)) push(tz);
    }
    return out.map(tz => ({ name: zoneLabel(tz, now, lang), value: tz }));
}

// Accepts a zone name, or the label of one of our own suggestions. Mobile
// Discord sometimes submits the label text instead of the choice's value,
// and people often type a city and press send without picking. Only an
// unambiguous match is accepted — one city, or a country with one zone.
function resolveTimezone(input) {
    const raw = String(input || '').trim();
    if (isValidTimezone(raw)) return raw;
    const head = norm(raw.split('·')[0].split('—')[0]);
    if (!head) return null;
    const { zones, countries, byCode } = tzIndex();
    const byCity = zones.filter(tz => norm((tz.split('/').pop() || '').replace(/_/g, ' ')) === head);
    if (byCity.length === 1) return byCity[0];
    const byCountry = countries.filter(ct => ct.keys.includes(head));
    if (byCountry.length === 1) {
        const list = byCode.get(byCountry[0].code) || [];
        if (list.length === 1) return list[0];
    }
    return null;
}

// ================= ANNOUNCEMENT PROTOCOL — CLASSIFIED =================
// last_announced_year in the database is the real guard against repeats —
// it survives restarts. The Set only covers a moment with no database.
const announcedMem = new Set();

// Adds last_announced_year once. On the run that adds it, today's birthdays
// are marked done if the old 08:00 check already announced them, so the
// first pass after this upgrade doesn't repeat them.
function ensureBirthdayColumns(db) {
    if (ensureBirthdayColumns.done || !db) return;
    try {
        db.exec(`ALTER TABLE birthday ADD COLUMN last_announced_year INTEGER`);
        const n = new Date();
        if (n.getHours() >= 8) {
            db.prepare('UPDATE birthday SET last_announced_year = ? WHERE day = ? AND month = ?')
                .run(n.getFullYear(), n.getDate(), n.getMonth() + 1);
        }
        ensureBirthdayColumns.done = true;
    } catch (e) {
        if (/duplicate column/i.test(e.message)) ensureBirthdayColumns.done = true;
    }
}

function alreadyAnnounced(db, userId, year) {
    if (announcedMem.has(`${userId}:${year}`)) return true;
    try {
        return db.prepare('SELECT last_announced_year FROM birthday WHERE user_id = ?').get(userId)?.last_announced_year === year;
    } catch { return false; }
}

function markAnnounced(db, userId, year) {
    announcedMem.add(`${userId}:${year}`);
    try { db.prepare('UPDATE birthday SET last_announced_year = ? WHERE user_id = ?').run(year, userId); } catch {}
}


// The member's own calendar: today's date in their zone, days until their next birthday (0 = today), their age today
function birthdayInfo(b) {
    const local = localParts(b.timezone || 'UTC');
    const today = Date.UTC(local.year, local.month - 1, local.day);
    const dayIn = (y) => (b.month === 2 && b.day === 29 && !isLeapYear(y)) ? 28 : b.day;
    let next = Date.UTC(local.year, b.month - 1, dayIn(local.year));
    if (next < today) next = Date.UTC(local.year + 1, b.month - 1, dayIn(local.year + 1));
    const daysUntil = Math.round((next - today) / 86400000);
    let age = null;
    if (b.year) {
        const hadIt = local.month > b.month || (local.month === b.month && local.day >= dayIn(local.year));
        age = local.year - b.year - (hadIt ? 0 : 1);
        if (age < 0) age = null;
    }
    return { daysUntil, age, nextAge: b.year ? (daysUntil === 0 ? age : (age ?? 0) + 1) : null, localYear: local.year };
}

// ================= DATABASE =================
function ensureTables(db) {
    if (ensureTables.done || !db) return;
    db.exec(`CREATE TABLE IF NOT EXISTS birthday (user_id TEXT PRIMARY KEY, day INTEGER NOT NULL, month INTEGER NOT NULL, year INTEGER, timezone TEXT DEFAULT 'UTC', created_at INTEGER)`);
    for (const col of [`timezone TEXT DEFAULT 'UTC'`, 'show_age INTEGER DEFAULT 0']) { try { db.exec(`ALTER TABLE birthday ADD COLUMN ${col}`); } catch { /* already there */ } }
    db.exec(`CREATE TABLE IF NOT EXISTS birthday_wishes (guild_id TEXT, user_id TEXT, year INTEGER, wisher_id TEXT, at INTEGER, PRIMARY KEY (guild_id, user_id, year, wisher_id))`);
    db.exec(`CREATE TABLE IF NOT EXISTS birthday_gifts (guild_id TEXT, user_id TEXT, year INTEGER, giver_id TEXT, amount INTEGER, at INTEGER)`);
    ensureTables.done = true;
}
function saveBirthday(db, userId, day, month, year, timezone = 'UTC') {
    const keep = birthdays.get(userId)?.showAge ? 1 : 0;
    db.prepare(`INSERT INTO birthday (user_id, day, month, year, timezone, created_at, show_age) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET day = excluded.day, month = excluded.month, year = excluded.year, timezone = excluded.timezone`)
        .run(userId, day, month, year || null, timezone, Date.now(), keep);
    birthdays.set(userId, { day, month, year: year || null, timezone, showAge: !!keep });
}
function deleteBirthday(db, userId) {
    db.prepare('DELETE FROM birthday WHERE user_id = ?').run(userId);
    birthdays.delete(userId);
}
function setShowAge(db, userId, on) {
    db.prepare('UPDATE birthday SET show_age = ? WHERE user_id = ?').run(on ? 1 : 0, userId);
    const b = birthdays.get(userId); if (b) b.showAge = !!on;
}
function loadAllBirthdays(db) {
    const rows = db.prepare('SELECT user_id, day, month, year, timezone, show_age FROM birthday').all();
    for (const r of rows) birthdays.set(r.user_id, { day: r.day, month: r.month, year: r.year, timezone: r.timezone || 'UTC', showAge: !!r.show_age });
    return rows;
}
const wishesOf = (db, gid, uid, year) => { try { return db.prepare('SELECT wisher_id FROM birthday_wishes WHERE guild_id = ? AND user_id = ? AND year = ? ORDER BY at').all(gid, uid, year).map((r) => r.wisher_id); } catch { return []; } };
const giftsOf = (db, gid, uid, year) => { try { return db.prepare('SELECT COALESCE(SUM(amount), 0) AS n FROM birthday_gifts WHERE guild_id = ? AND user_id = ? AND year = ?').get(gid, uid, year)?.n || 0; } catch { return 0; } };

// ================= CARDS =================
// The announcement on one server: the greeting, the date and sign, the wishes and gifts so far, and the two buttons
function announceCard(client, guild, member, year, lang) {
    const b = birthdays.get(member.id) || {};
    const info = b.day ? birthdayInfo(b) : {};
    const db = client.db;
    const wishes = wishesOf(db, guild.id, member.id, year);
    const gifts = giftsOf(db, guild.id, member.id, year);
    const shown = wishes.slice(0, 5).map((id) => `<@${id}>`).join(' ') + (wishes.length > 5 ? ` ${B('more', lang, { n: wishes.length - 5 })}` : '');
    const wishLine = !wishes.length ? B('wishesNone', lang) : B(wishes.length === 1 ? 'wishesOne' : 'wishesMany', lang, { n: wishes.length, who: shown });
    const facts = [b.day ? formatDate(b.day, b.month, null, lang) : null, b.day ? sign(b.day, b.month, lang) : null, b.showAge && info.age ? B('announceAge', lang, { age: info.age }) : null].filter(Boolean).join(' · ');
    let money = String(gifts);
    try { money = require('./credit').words(client, guild.id, lang).money(gifts); } catch { /* plain number */ }
    return card(PINK, [
        { thumbnail: [`## ${icon('gift', guild)} ${B('announceTitle', lang, { user: `<@${member.id}>` })}\n${B('announceLine', lang, { server: guild.name })}`, member.displayAvatarURL({ size: 256, extension: 'png' })] },
        { rule: true },
        { text: `-# ${facts}\n${wishLine}${gifts ? `\n-# ${B('giftsLine', lang, { amount: money })}` : ''}` },
        { row: new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`bday:wish:${member.id}:${year}`).setLabel(`${B('btnWish', lang)}${wishes.length ? ` (${wishes.length})` : ''}`).setEmoji(icon('weekend', guild)).setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`bday:gift:${member.id}:${year}`).setLabel(B('btnGift', lang)).setEmoji(icon('coins', guild)).setStyle(ButtonStyle.Secondary)) },
    ]);
}

// /birthday view: own (private, with buttons) or another member's (age only if they chose to show it)
function viewCard(guild, user, viewerId, lang) {
    const b = birthdays.get(user.id);
    const own = user.id === viewerId;
    if (!b) return card(GREY, [{ text: own ? B('noneSelf', lang) : B('noneOther', lang, { user: `<@${user.id}>` }) }]);
    const info = birthdayInfo(b);
    const when = info.daysUntil === 0 ? `**${B('today', lang)}**` : info.daysUntil === 1 ? B('tomorrow', lang) : B('inDays', lang, { n: info.daysUntil });
    const showAgeHere = own || b.showAge;
    const ageText = showAgeHere && b.year ? (info.daysUntil === 0 ? B('turningToday', lang, { age: info.age }) : B('turning', lang, { age: info.nextAge })) : null;
    const date = formatDate(b.day, b.month, showAgeHere ? b.year : null, lang);
    const lines = [
        `## ${icon('gift', guild)} ${own ? B('viewSelf', lang) : B('viewOther', lang, { user: `<@${user.id}>` })}`,
        `${date} · ${sign(b.day, b.month, lang)}${own ? ` · ${B('tzLine', lang, { tz: b.timezone || 'UTC' })}` : ''}`,
        `-# ${[when, ageText, own && b.year ? B(b.showAge ? 'ageShown' : 'ageHidden', lang) : null].filter(Boolean).join(' · ')}`,
    ];
    const items = [{ thumbnail: [lines.join('\n'), user.displayAvatarURL({ size: 256, extension: 'png' })] }];
    if (own) {
        const row = new ActionRowBuilder();
        if (b.year) row.addComponents(new ButtonBuilder().setCustomId(`bday:age:${user.id}`).setLabel(B(b.showAge ? 'btnHideAge' : 'btnShowAge', lang)).setEmoji(icon(b.showAge ? 'lock' : 'member', guild)).setStyle(ButtonStyle.Secondary));
        row.addComponents(new ButtonBuilder().setCustomId(`bday:del:${user.id}`).setLabel(B('btnRemove', lang)).setStyle(ButtonStyle.Danger));
        items.push({ row });
    }
    return card(info.daysUntil === 0 ? PINK : PURPLE, items);
}

// /birthday list: members of this server only, next 90 days, grouped by month
async function listCard(guild, lang) {
    const ids = [...birthdays.keys()];
    const here = new Set();
    for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        const got = await guild.members.fetch({ user: chunk }).catch(() => null);
        if (got) for (const id of got.keys()) here.add(id);
        else for (const id of chunk) if (guild.members.cache.has(id)) here.add(id);
    }
    const rows = [...here].map((id) => ({ id, b: birthdays.get(id), info: birthdayInfo(birthdays.get(id)) }))
        .filter((r) => r.info.daysUntil <= 90).sort((a, b) => a.info.daysUntil - b.info.daysUntil);
    const head = `## ${icon('clock', guild)} ${B('listTitle', lang)}\n-# ${B('listSub', lang, { server: guild.name, n: here.size })}`;
    if (!rows.length) return card(GREY, [{ text: `${head}\n\n${B('listEmpty', lang)}` }]);
    const lines = [];
    let lastMonth = null;
    for (const r of rows.slice(0, 30)) {
        if (r.info.daysUntil === 0) { lines.push(`**${B('listToday', lang)}** · <@${r.id}>`); continue; }
        if (r.info.daysUntil === 1) { lines.push(`**${B('listTomorrow', lang)}** · <@${r.id}>`); continue; }
        if (r.b.month !== lastMonth) { lastMonth = r.b.month; const m = monthName(r.b.month, lang); lines.push(`\n**${m.charAt(0).toLocaleUpperCase(LOCALE[lang]) + m.slice(1)}**`); }
        lines.push(`${formatDate(r.b.day, r.b.month, null, lang)} · <@${r.id}> -# ${B('listIn', lang, { n: r.info.daysUntil })}`.replace(' -# ', ' · '));
    }
    if (rows.length > 30) lines.push(`-# ${B('more', lang, { n: rows.length - 30 })}`);
    return card(PURPLE, [{ text: head }, { rule: true }, { text: lines.join('\n').trim() }]);
}

// ================= ANNOUNCEMENTS =================
// Each birthday is announced once a year, at 8:00 in its owner's zone, on every server they are a member of
// (it used to stop at the first server found). The channel: the daily channel, else the server's system channel.
async function checkAndAnnounceBirthdays(client) {
    const db = client.db;
    ensureTables(db);
    ensureBirthdayColumns(db);
    for (const [userId, bday] of birthdays) {
        const local = localParts(bday.timezone);
        const bDay = (bday.month === 2 && bday.day === 29 && !isLeapYear(local.year)) ? 28 : bday.day;
        if (bDay !== local.day || bday.month !== local.month || local.hour < 8 || alreadyAnnounced(db, userId, local.year)) continue;
        markAnnounced(db, userId, local.year);   // before sending: a slow or failed send never repeats
        let sent = 0;
        for (const [guildId, guild] of client.guilds.cache) {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) continue;
            const ss = client.getServerSettings?.(guildId) || {};
            const configured = ss.daily_channel || ss.dailyChannel || ss.birthday_channel || ss.level_channel || null;
            const channel = configured ? guild.channels.cache.get(String(configured)) : guild.systemChannel;
            if (!channel) continue;
            const lang = langOf(client, guildId, null, null);
            const payload = announceCard(client, guild, member, local.year, lang);
            payload.allowedMentions = { users: [userId] };   // the member is the one person notified
            const msg = await require('../lib/safeSend').safeSend('birthday', channel, payload, { guild, channelId: configured, quiet: !configured });
            if (msg) sent++;
        }
        console.log(`[BIRTHDAY] announced ${userId} on ${sent} server(s)`);
    }
}

function scheduleDailyCheck(client) {
    // Every 5 minutes; the database guard stops repeats, so a restart or an outage at 8:00 catches up later that day
    let running = false;
    const run = async () => {
        if (running) return;
        running = true;
        try { await checkAndAnnounceBirthdays(client); }
        catch (e) { console.error('[BIRTHDAY] check failed:', e.message); }
        finally { running = false; }
    };
    setTimeout(run, 60000);
    setInterval(run, 5 * 60000);
}

// ================= BUTTONS =================
// bday:wish:<uid>:<year> · bday:gift:<uid>:<year> · bday:give:<uid>:<year>:<amount>:<messageId> · bday:age:<uid> · bday:del:<uid>
async function handleComponent(ix, client) {
    const db = client.db;
    ensureTables(db);
    const guild = ix.guild;
    const lang = langOf(client, ix.guildId, ix, ix.user.id);
    const [, action, uid, yearS, amountS, msgId] = ix.customId.split(':');
    const say = (content) => ix.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }).catch(() => {});
    if (!guild) return say(B('serverOnly', lang));
    const year = Number(yearS);

    if (action === 'age' || action === 'del') {
        if (ix.user.id !== uid) return say(B('notYours', lang, { user: `<@${uid}>` }));
        if (action === 'del') {
            deleteBirthday(db, uid);
            return ix.update({ ...card(GREY, [{ text: B('removed', lang) }]), allowedMentions: { parse: [] } }).catch(() => {});
        }
        setShowAge(db, uid, !birthdays.get(uid)?.showAge);
        return ix.update({ ...viewCard(guild, ix.user, ix.user.id, lang), allowedMentions: { parse: [] } }).catch(() => {});
    }

    const member = await guild.members.fetch(uid).catch(() => null);
    if (action === 'wish') {
        if (ix.user.id === uid) return say(B('wishSelf', lang));
        const r = db.prepare('INSERT OR IGNORE INTO birthday_wishes (guild_id, user_id, year, wisher_id, at) VALUES (?, ?, ?, ?, ?)').run(guild.id, uid, year, ix.user.id, Date.now());
        if (!r.changes) return say(B('wishAlready', lang));
        if (!member) return ix.deferUpdate().catch(() => {});
        const cardLang = langOf(client, guild.id, null, null);
        return ix.update({ ...announceCard(client, guild, member, year, cardLang), allowedMentions: { parse: [] } }).catch(() => {});
    }

    if (action === 'gift') {
        if (ix.user.id === uid) return say(B('giftSelf', lang));
        const w = require('./credit').words(client, guild.id, lang);
        const have = client.liveCredits?.(ix.user.id, guild.id) || 0;
        return ix.reply({ ...card(PINK, [
            { text: `### ${icon('coins', guild)} ${B('giftTitle', lang, { user: `<@${uid}>` })}\n-# ${B('giftHint', lang, { have: w.money(have) })}` },
            { row: new ActionRowBuilder().addComponents(...GIFTS.map((n) =>
                new ButtonBuilder().setCustomId(`bday:give:${uid}:${year}:${n}:${ix.message.id}`).setLabel(w.money(n)).setStyle(ButtonStyle.Primary).setDisabled(have < n))) },
        ]), flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral, allowedMentions: { parse: [] } }).catch(() => {});
    }

    if (action === 'give') {
        const amount = Number(amountS);
        if (!GIFTS.includes(amount)) return say(B('giftFailed', lang));
        if (ix.user.id === uid) return say(B('giftSelf', lang));
        if (!member) return say(B('giftFailed', lang));
        const r = await require('./credit').send(client, guild, ix.user, ix.member, member.user, amount, lang).catch(() => ({ ok: false, text: B('giftFailed', lang) }));
        if (!r.ok) return ix.update({ ...card(GREY, [{ text: r.text || B('giftFailed', lang) }]), allowedMentions: { parse: [] } }).catch(() => {});
        db.prepare('INSERT INTO birthday_gifts (guild_id, user_id, year, giver_id, amount, at) VALUES (?, ?, ?, ?, ?, ?)').run(guild.id, uid, year, ix.user.id, amount, Date.now());
        const w = require('./credit').words(client, guild.id, lang);
        await ix.update({ ...card(0x2ECC71, [{ text: `${icon('ok', guild)} ${B('giftDone', lang, { amount: w.money(amount), user: `<@${uid}>` })}` }]), allowedMentions: { parse: [] } }).catch(() => {});
        // the announcement shows the new total
        try {
            const msg = msgId ? await ix.channel.messages.fetch(msgId) : null;
            if (msg) await msg.edit({ ...announceCard(client, guild, member, year, langOf(client, guild.id, null, null)), allowedMentions: { parse: [] } });
        } catch { /* the gift went through; the counter catches up on the next wish */ }
        return;
    }
    return say(B('giftFailed', lang));
}

// ================= COMMAND =================
async function setBirthday(client, userId, day, month, year, zoneInput, lang, guild) {
    if (year && (year < 1900 || year > MAX_YEAR())) return { text: B('invalidYear', lang, { max: MAX_YEAR() }) };
    if (!isValidDate(day, month, year || 2000)) return { text: B('invalidDate', lang) };
    const timezone = zoneInput ? resolveTimezone(zoneInput) : (birthdays.get(userId)?.timezone || 'UTC');
    if (!timezone) return { text: B('unknownZone', lang, { zone: zoneInput }) };
    saveBirthday(client.db, userId, day, month, year, timezone);
    return { payload: card(PINK, [{ text: `## ${icon('ok', guild)} ${B('setTitle', lang)}\n${B('setLine', lang, { date: formatDate(day, month, year, lang), sign: sign(day, month, lang), tz: offsetLabel(timezone) === timezone ? timezone : `${timezone} (${offsetLabel(timezone)})` })}\n-# ${B('setHint', lang)}` }]) };
}

module.exports = {
    name: 'birthday',
    aliases: ['bday', 'anniversaire', 'anniv'],
    description: '🎂 Save your birthday and celebrate members on theirs',
    category: 'UTILITY',
    cooldown: 3000,
    handleComponent,
    _announce: (client) => checkAndAnnounceBirthdays(client),   // tests

    autocomplete: async (interaction, client) => {
        const focused = interaction.options.getFocused(true);
        if (focused.name !== 'timezone') return interaction.respond([]).catch(() => {});
        let preferred = null;
        try { preferred = client?.getServerSettings?.(interaction.guildId)?.timezone || null; } catch {}
        return interaction.respond(suggestZones(focused.value, { preferred, locale: interaction.locale, db: client?.db })).catch(() => {});
    },

    data: new SlashCommandBuilder()
        .setName('birthday')
        .setDescription('Save your birthday and see the ones coming up')
        .addSubcommand((s) => s.setName('set').setDescription('Save your birthday')
            .addIntegerOption((o) => o.setName('day').setDescription('Day (1-31)').setRequired(true).setMinValue(1).setMaxValue(31))
            .addIntegerOption((o) => o.setName('month').setDescription('Month (1-12)').setRequired(true).setMinValue(1).setMaxValue(12))
            .addIntegerOption((o) => o.setName('year').setDescription('Year (optional, hidden from others unless you show it)').setRequired(false).setMinValue(1900).setMaxValue(2100))
            .addStringOption((o) => o.setName('timezone').setDescription('Your country, city or UTC offset, like Mali or +5:30').setRequired(false).setAutocomplete(true)))
        .addSubcommand((s) => s.setName('view').setDescription("See your birthday, or a member's")
            .addUserOption((o) => o.setName('user').setDescription('The member (default: you)').setRequired(false)))
        .addSubcommand((s) => s.setName('list').setDescription('Birthdays coming up on this server')),

    run: async (client, message, args) => {
        ensureTables(client.db);
        const lang = langOf(client, message.guild?.id, message, message.author.id);
        const sub = String(args[0] || 'view').toLowerCase();
        const reply = (p) => message.reply({ ...p, allowedMentions: { parse: [] } }).catch(() => {});
        if (sub === 'set') {
            const r = await setBirthday(client, message.author.id, parseInt(args[1], 10), parseInt(args[2], 10), args[3] ? parseInt(args[3], 10) : null, args.slice(4).join(' ') || null, lang, message.guild);
            return r.payload ? reply(r.payload) : reply({ content: r.text });
        }
        if (sub === 'remove' || sub === 'delete') {
            if (!birthdays.has(message.author.id)) return reply({ content: B('noneSelf', lang) });
            deleteBirthday(client.db, message.author.id);
            return reply({ content: B('removed', lang) });
        }
        if (sub === 'list') {
            if (!message.guild) return reply({ content: B('serverOnly', lang) });
            return reply(await listCard(message.guild, lang));
        }
        if (sub === 'view' || sub === 'check') return reply(viewCard(message.guild, message.mentions.users.first() || message.author, message.author.id, lang));
        return reply({ content: B('usage', lang, { p: client.getServerSettings?.(message.guild?.id)?.prefix || '.' }) });
    },

    execute: async (interaction, client) => {
        ensureTables(client.db);
        const lang = langOf(client, interaction.guildId, interaction, interaction.user.id);
        const sub = interaction.options.getSubcommand();
        if (sub === 'set') {
            const r = await setBirthday(client, interaction.user.id, interaction.options.getInteger('day'), interaction.options.getInteger('month'),
                interaction.options.getInteger('year'), interaction.options.getString('timezone'), lang, interaction.guild);
            return interaction.reply(r.payload ? { ...r.payload, flags: r.payload.flags | MessageFlags.Ephemeral } : { content: r.text, flags: MessageFlags.Ephemeral });
        }
        if (sub === 'view') {
            const user = interaction.options.getUser('user') || interaction.user;
            const view = viewCard(interaction.guild, user, interaction.user.id, lang);
            return interaction.reply({ ...view, flags: view.flags | MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
        }
        if (sub === 'list') {
            if (!interaction.guild) return interaction.reply({ content: B('serverOnly', lang), flags: MessageFlags.Ephemeral });
            await interaction.deferReply();
            return interaction.editReply({ ...(await listCard(interaction.guild, lang)), allowedMentions: { parse: [] } });
        }
    },

    initialize: (client) => {
        ensureTables(client.db);
        loadAllBirthdays(client.db);
        scheduleDailyCheck(client);
        console.log(`\x1b[36m[BIRTHDAY]\x1b[0m ${birthdays.size} birthdays saved, announcements active`);
    },
};
