const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ================= BIRTHDAY INTELLIGENCE DIVISION =================
const birthdays = new Map();

// ================= MULTILINGUAL BRIEFING =================
const t = {
    en: {
        setTitle: '🎂 BIRTHDAY REGISTERED',
        setSuccess: (date) => `✅ Your birthday has been classified: **${date}**`,
        setError: '❌ Invalid date format. Syntax: `/birthday set day:15 month:6 year:2000`',
        removeTitle: '🎂 BIRTHDAY CLEARED',
        removeSuccess: '✅ Your birthday record has been purged from the database.',
        removeError: '❌ No birthday record found for your identity.',
        checkTitle: '🎂 BIRTHDAY INTELLIGENCE',
        checkUser: (user, date) => `🎉 **${user}**'s birthday is classified as **${date}**`,
        checkSelf: (date) => `🎂 Your birthday is classified as **${date}**`,
        checkNone: '❌ No birthday record found.',
        listTitle: '📅 UPCOMING BIRTHDAYS',
        listEmpty: 'No birthdays detected in the next 90 days.',
        listEntry: (user, date, days) => `• **${user}** — ${date} (T-${days}d)`,
        todayEntry: (user, date) => `• **${user}** — ${date} 🎂 **TODAY**`,
        announcementTitle: '🎉 BIRTHDAY ALERT — ALL UNITS',
        announcementDesc: (user, age) => `All personnel wish **${user}** a happy birthday!\n${age ? 'They turn **' + age + '** today.' : ''}`,
        announcementFooter: '🎂 Drop a birthday wish in chat.',
        months: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
        noPermission: '❌ Insufficient clearance to modify other user records.',
        invalidDay: '❌ Day must be between 1 and 31.',
        invalidMonth: '❌ Month must be between 1 and 12.',
        invalidYear: '❌ Year must be between 1900 and 2020.',
        invalidDate: '❌ That date does not exist in the Gregorian calendar.'
    },
    fr: {
        setTitle: '🎂 ANNIVERSAIRE ENREGISTRE',
        setSuccess: (date) => `✅ Votre anniversaire a ete classifie : **${date}**`,
        setError: '❌ Format de date invalide. Syntaxe : `/birthday set jour:15 mois:6 annee:2000`',
        removeTitle: '🎂 ANNIVERSAIRE SUPPRIME',
        removeSuccess: '✅ Votre dossier anniversaire a ete purge de la base de donnees.',
        removeError: '❌ Aucun dossier anniversaire trouve pour votre identite.',
        checkTitle: '🎂 RENSEIGNEMENTS ANNIVERSAIRE',
        checkUser: (user, date) => `🎉 L'anniversaire de **${user}** est classifie le **${date}**`,
        checkSelf: (date) => `🎂 Votre anniversaire est classifie le **${date}**`,
        checkNone: '❌ Aucun dossier anniversaire trouve.',
        listTitle: '📅 ANNIVERSAIRES A VENIR',
        listEmpty: 'Aucun anniversaire detecte dans les 90 prochains jours.',
        listEntry: (user, date, days) => `• **${user}** — ${date} (T-${days}j)`,
        todayEntry: (user, date) => `• **${user}** — ${date} 🎂 **AUJOURD\'HUI**`,
        announcementTitle: '🎉 ALERTE ANNIVERSAIRE — TOUTES LES UNITES',
        announcementDesc: (user, age) => `Tout le personnel souhaite un joyeux anniversaire a **${user}** !\n${age ? 'Iel a **' + age + '** ans aujourd\'hui !' : ''}`,
        announcementFooter: '🎂 Laissez un message d\'anniversaire !',
        months: ['JAN', 'FEV', 'MAR', 'AVR', 'MAI', 'JUN', 'JUL', 'AOU', 'SEP', 'OCT', 'NOV', 'DEC'],
        noPermission: '❌ Autorisation insuffisante pour modifier les dossiers d\'autres utilisateurs.',
        invalidDay: '❌ Le jour doit etre entre 1 et 31.',
        invalidMonth: '❌ Le mois doit etre entre 1 et 12.',
        invalidYear: '❌ L\'annee doit etre entre 1900 et 2020.',
        invalidDate: '❌ Cette date n\'existe pas dans le calendrier gregorien.'
    }
};

// ================= VALIDATION PROTOCOLS =================
function isValidDate(day, month, year) {
    const date = new Date(year, month - 1, day);
    return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year;
}

function calculateAge(birthYear) {
    if (!birthYear) return null;
    const today = new Date();
    let age = today.getFullYear() - birthYear;
    return age > 0 ? age : null;
}

function formatDate(day, month, year, lang) {
    const months = t[lang].months;
    const m = months[month - 1];
    if (year) return `${day} ${m} ${year}`;
    return `${day} ${m}`;
}

function getDaysUntil(day, month) {
    const today = new Date();
    const currentYear = today.getFullYear();
    let birthday = new Date(currentYear, month - 1, day);
    if (birthday < today) birthday = new Date(currentYear + 1, month - 1, day);
    return Math.ceil((birthday - today) / (1000 * 60 * 60 * 24));
}

// ================= ZODIAC INTELLIGENCE =================
function getZodiacSign(day, month) {
    const signs = [
        { name: 'Capricorn', emoji: '♑', start: [12, 22] }, { name: 'Aquarius', emoji: '♒', start: [1, 20] },
        { name: 'Pisces', emoji: '♓', start: [2, 19] }, { name: 'Aries', emoji: '♈', start: [3, 21] },
        { name: 'Taurus', emoji: '♉', start: [4, 20] }, { name: 'Gemini', emoji: '♊', start: [5, 21] },
        { name: 'Cancer', emoji: '♋', start: [6, 21] }, { name: 'Leo', emoji: '♌', start: [7, 23] },
        { name: 'Virgo', emoji: '♍', start: [8, 23] }, { name: 'Libra', emoji: '♎', start: [9, 23] },
        { name: 'Scorpio', emoji: '♏', start: [10, 23] }, { name: 'Sagittarius', emoji: '♐', start: [11, 22] },
        { name: 'Capricorn', emoji: '♑', start: [12, 22] }
    ];
    for (let i = 0; i < signs.length - 1; i++) {
        const curr = signs[i], next = signs[i + 1];
        if ((month === curr.start[0] && day >= curr.start[1]) || (month === next.start[0] && day < next.start[1])) {
            return `${curr.emoji} ${curr.name}`;
        }
    }
    return '♑ Capricorn';
}

// ================= DATABASE OPERATIONS =================
function saveBirthday(db, userId, day, month, year, timezone = 'UTC') {
    db.prepare(`INSERT INTO birthday (user_id, day, month, year, timezone, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET day = excluded.day, month = excluded.month, year = excluded.year, timezone = excluded.timezone`)
        .run(userId, day, month, year || null, timezone, Date.now());
    birthdays.set(userId, { day, month, year, timezone });
}

function loadBirthday(db, userId) {
    const row = db.prepare(`SELECT day, month, year, timezone FROM birthday WHERE user_id = ?`).get(userId);
    if (row) birthdays.set(userId, { day: row.day, month: row.month, year: row.year, timezone: row.timezone || 'UTC' });
    return row;
}

function deleteBirthday(db, userId) {
    db.prepare(`DELETE FROM birthday WHERE user_id = ?`).run(userId);
    birthdays.delete(userId);
}

function loadAllBirthdays(db) {
    const rows = db.prepare(`SELECT user_id, day, month, year, timezone FROM birthday`).all();
    for (const row of rows) {
        birthdays.set(row.user_id, { day: row.day, month: row.month, year: row.year, timezone: row.timezone || 'UTC' });
    }
    return rows;
}

function getUpcomingBirthdays(daysAhead = 90) {
    const upcoming = [];
    const today = new Date();
    for (const [userId, bday] of birthdays) {
        const birthdayThisYear = new Date(today.getFullYear(), bday.month - 1, bday.day);
        const birthdayNextYear = new Date(today.getFullYear() + 1, bday.month - 1, bday.day);
        const nextBirthday = birthdayThisYear >= today ? birthdayThisYear : birthdayNextYear;
        const daysUntil = Math.ceil((nextBirthday - today) / (1000 * 60 * 60 * 24));
        if (daysUntil <= daysAhead) upcoming.push({ userId, ...bday, daysUntil });
    }
    return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
}

// ================= MILESTONE INTELLIGENCE =================
function getMilestoneData(age) {
    if (!age) return { color: '#FFD700', badge: '', title: '' };
    const milestones = {
        18: { color: '#00FFCC', badge: '🎓', title: 'ADULT' },
        21: { color: '#9B59B6', badge: '🥂', title: 'LEGAL' },
        30: { color: '#E74C3C', badge: '🔥', title: 'DIRTY 30' },
        40: { color: '#E67E22', badge: '👑', title: 'FAB 40' },
        50: { color: '#F1C40F', badge: '💛', title: 'GOLDEN' },
        60: { color: '#3498DB', badge: '💎', title: 'DIAMOND' },
        70: { color: '#1ABC9C', badge: '👴', title: 'PLATINUM' },
        80: { color: '#E91E63', badge: '👑', title: 'IMMORTAL' },
        100: { color: '#FFD700', badge: '⭐', title: 'CENTENARIAN' }
    };
    if (milestones[age]) return milestones[age];
    if (age % 10 === 0) return { color: '#3498DB', badge: '🎯', title: `DECADE ${age}` };
    if (age % 5 === 0) return { color: '#9B59B6', badge: '🔮', title: `HALF-DECADE ${age}` };
    return { color: '#FFD700', badge: '', title: '' };
}

function getAgeCategory(age) {
    if (!age) return { msg: '🎁 Another trip around the sun!', color: '#FFD700' };
    if (age < 13) return { msg: `🎈 Turning **${age}** — Happy Birthday, young star!`, color: '#FF69B4' };
    if (age < 20) return { msg: `🎓 Turning **${age}** — Welcome to your teenage years!`, color: '#9B59B6' };
    if (age < 30) return { msg: `🌟 Turning **${age}** — Living your best twenties!`, color: '#3498DB' };
    if (age < 40) return { msg: `💪 Turning **${age}** — Thriving in your thirties!`, color: '#2ECC71' };
    if (age < 50) return { msg: `👑 Turning **${age}** — Fabulous forties!`, color: '#E67E22' };
    if (age < 60) return { msg: `✨ Turning **${age}** — Golden fifties!`, color: '#F1C40F' };
    if (age < 70) return { msg: `🏆 Turning **${age}** — Legendary status!`, color: '#E74C3C' };
    if (age < 100) return { msg: `👴 Turning **${age}** — Immortal tier!`, color: '#1ABC9C' };
    return { msg: `⭐ Turning **${age}** — CENTENARIAN!`, color: '#FFD700' };
}

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

async function checkAndAnnounceBirthdays(client) {
    const today = new Date();
    const db = client.db;
    ensureBirthdayColumns(db);

    for (const [userId, bday] of birthdays) {
        // The owner's own date and hour, from their timezone.
        const local = localParts(bday.timezone);
        const currentYear = local.year;
        // Feb 29 birthdays are celebrated on Feb 28 in non-leap years.
        const bDay = (bday.month === 2 && bday.day === 29 && !isLeapYear(local.year)) ? 28 : bday.day;
        if (bDay === local.day && bday.month === local.month && local.hour >= 8 && !alreadyAnnounced(db, userId, local.year)) {
            // Mark before sending, so a failed or slow send can never repeat.
            markAnnounced(db, userId, local.year);
            for (const [guildId, guild] of client.guilds.cache) {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (!member) continue;
                
                const ss = client.getServerSettings?.(guildId) || {};
                const configuredChannelId = ss.birthday_channel || ss.level_channel || ss.daily_channel;
                let channel = configuredChannelId ? guild.channels.cache.get(configuredChannelId) : null;
                if (!channel) channel = guild.systemChannel;
                if (!channel) channel = guild.channels.cache.find(c =>
                    c.type === 0 && c.permissionsFor(guild.members.me)?.has('SendMessages')
                );
                if (!channel) continue;
                
                const lang = guild.preferredLocale === 'fr' ? 'fr' : 'en';
                const strings = t[lang];
                const age = calculateAge(bday.year);
                const milestone = getMilestoneData(age);
                const ageCat = getAgeCategory(age);
                
                // Year progress
                const yearProgress = Math.floor((today - new Date(currentYear, 0, 1)) / (1000 * 60 * 60 * 24));
                const progressPercent = Math.floor((yearProgress / 365) * 100);
                const progressBar = '█'.repeat(Math.floor(progressPercent / 10)) + '░'.repeat(10 - Math.floor(progressPercent / 10));
                
                // Zodiac
                const zodiac = getZodiacSign(bday.day, bday.month);
                
                const embed = new EmbedBuilder()
                    .setColor(milestone.color || ageCat.color)
                    .setAuthor({ 
                        name: `🚨 ${strings.announcementTitle}`, 
                        iconURL: 'https://cdn.discordapp.com/emojis/1120816625522311178.png' 
                    })
                    .setDescription(
                        `# 🎂 BIRTHDAY ALERT — ${member.user.username.toUpperCase()}\n\n` +
                        `### ${member.user}\n` +
                        `All units, celebrate this agent's special day!\n\n` +
                        `**${ageCat.msg}**\n` +
                        `${milestone.badge ? milestone.badge + ' **' + milestone.title + '**' : ''}`
                    )
                    .setThumbnail(member.user.displayAvatarURL({ size: 512, dynamic: true }))
                    .addFields(
                        { 
                            name: '📊 BIRTHDAY DOSSIER', 
                            value: 
                                '```yaml\n' +
                                `🎂 Age Today      : ${age || 'CLASSIFIED'}\n` +
                                `📅 Born           : ${bday.day} ${strings.months[bday.month-1]} ${bday.year || '????'}\n` +
                                `♈ Zodiac         : ${zodiac}\n` +
                                `🌍 Timezone       : ${bday.timezone || 'UTC'}\n` +
                                `📊 Year Progress  : ${progressBar} ${progressPercent}%\n` +
                                '```',
                            inline: false 
                        },
                        {
                            name: '💝 BIRTHDAY WISHES',
                            value: '*Drop a message below to celebrate this agent!* 🎈',
                            inline: false
                        }
                    )
                    
                    .setFooter({ 
                        text: `🎂 ${guild.name} • Birthday Intelligence Division • v${client.version || '2.0.0'}`, 
                        iconURL: guild.iconURL() 
                    })
                    .setTimestamp();
                
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`bday_celebrate_${userId}`)
                        .setLabel('Wish Happy Birthday')
                        .setEmoji({ id: '1539977057432240128', name: 'celebration' })
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`bday_celebrate_${userId}`)
                        .setLabel('Send Virtual Gift')
                        .setEmoji({ id: '1539977940962377859', name: 'argift' })
                        .setStyle(ButtonStyle.Primary)
                );
                
                await channel.send({ 
                    content: `<a:party_2:1539977059273539716> <a:cake:1539977063056937082> — ${member}'s special day! Let's celebrate!`,
                    embeds: [embed],
                    components: [row]
                }).catch(() => {});
                
                console.log(`[BIRTHDAY] 🎂 Announced birthday for ${member.user.tag} (Age: ${age || 'unknown'})`);
                break;
            }
        }
    }
}

// ================= SCHEDULE DAILY CHECK =================
function scheduleDailyCheck(client) {
    // Every 5 minutes. A birthday is announced once its owner reaches 08:00 in
    // their own timezone; the database guard stops repeats, so a restart or
    // outage at 08:00 catches up later that day instead of skipping it.
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

// ================= MAIN COMMAND =================
module.exports = {
    name: 'birthday',
    aliases: ['bday', 'anniversaire'],
    description: '🎂 Birthday intelligence system — set, check, and celebrate birthdays',
    category: 'UTILITY',

    autocomplete: async (interaction, client) => {
        const focused = interaction.options.getFocused(true);
        if (focused.name !== 'timezone') return interaction.respond([]).catch(() => {});
        let preferred = null;
        try { preferred = client?.getServerSettings?.(interaction.guildId)?.timezone || null; } catch {}
        const choices = suggestZones(focused.value, { preferred, locale: interaction.locale, db: client?.db });
        return interaction.respond(choices).catch(() => {});
    },
    cooldown: 3000,

    data: new SlashCommandBuilder()
        .setName('birthday')
        .setDescription('🎂 Birthday intelligence system — set, check, and celebrate birthdays')
        .addSubcommand(sub => sub
            .setName('set')
            .setDescription('Register your birthday in the intelligence database')
            .addIntegerOption(opt => opt.setName('day').setDescription('Day of birth (1-31)').setRequired(true).setMinValue(1).setMaxValue(31))
            .addIntegerOption(opt => opt.setName('month').setDescription('Month of birth (1-12)').setRequired(true).setMinValue(1).setMaxValue(12))
            .addIntegerOption(opt => opt.setName('year').setDescription('Year of birth (optional)').setRequired(false).setMinValue(1900).setMaxValue(2020))
            .addStringOption(opt => opt.setName('timezone').setDescription('Your country, city or UTC offset — e.g. Mali, Brésil, +5:30').setRequired(false)
                .setAutocomplete(true)))
        .addSubcommand(sub => sub.setName('remove').setDescription('Purge your birthday record from the database'))
        .addSubcommand(sub => sub.setName('check').setDescription('Query birthday intelligence on a target')
            .addUserOption(opt => opt.setName('user').setDescription('Target user to investigate').setRequired(false)))
        .addSubcommand(sub => sub.setName('list').setDescription('Display upcoming birthdays intelligence')),

    run: async (client, message, args, db) => {
    const guildId = message.guild?.id ?? interaction?.guildId ?? 'DM';
        const lang = message.content?.toLowerCase().includes('anniversaire') ? 'fr' : (client.detectLanguage ? client.detectLanguage('birthday') : 'en');
        const strings = t[lang];
        const subcommand = args[0]?.toLowerCase();

        if (subcommand === 'set') {
            const day = parseInt(args[1]);
            const month = parseInt(args[2]);
            const year = args[3] ? parseInt(args[3]) : null;
            if (!day || !month) return message.reply(strings.setError);
            if (day < 1 || day > 31) return message.reply(strings.invalidDay);
            if (month < 1 || month > 12) return message.reply(strings.invalidMonth);
            if (year && (year < 1900 || year > 2020)) return message.reply(strings.invalidYear);
            if (!isValidDate(day, month, year || 2000)) return message.reply(strings.invalidDate);
            saveBirthday(db, message.author.id, day, month, year);
            const dateStr = formatDate(day, month, year, lang);
            return message.reply({ 
                embeds: [new EmbedBuilder()
                    .setColor('#FF69B4')
                    .setAuthor({ name: strings.setTitle, iconURL: message.author.displayAvatarURL() })
                    .setDescription(strings.setSuccess(dateStr))
                    .setFooter({ text: '🎂 Birthday Intelligence Division' })
                    .setTimestamp()
                ] 
            });
        }

        if (subcommand === 'remove') {
            const exists = birthdays.get(message.author.id);
            if (!exists) return message.reply(strings.removeError);
            deleteBirthday(db, message.author.id);
            return message.reply({ 
                embeds: [new EmbedBuilder()
                    .setColor('#FF69B4')
                    .setAuthor({ name: strings.removeTitle, iconURL: message.author.displayAvatarURL() })
                    .setDescription(strings.removeSuccess)
                    .setFooter({ text: '🎂 Birthday Intelligence Division' })
                    .setTimestamp()
                ] 
            });
        }

        if (subcommand === 'check') {
            const user = message.mentions.users.first() || message.author;
            const bday = birthdays.get(user.id);
            if (!bday) return message.reply(user.id === message.author.id ? strings.checkNone : strings.checkNone);
            const dateStr = formatDate(bday.day, bday.month, bday.year, lang);
            const msg = user.id === message.author.id ? strings.checkSelf(dateStr) : strings.checkUser(user.username, dateStr);
            const daysUntil = getDaysUntil(bday.day, bday.month);
            const zodiac = getZodiacSign(bday.day, bday.month);
            const age = calculateAge(bday.year);
            
            return message.reply({ 
                embeds: [new EmbedBuilder()
                    .setColor('#FF69B4')
                    .setAuthor({ name: strings.checkTitle, iconURL: user.displayAvatarURL() })
                    .setDescription(msg)
                    .addFields(
                        { name: '📅 Date', value: dateStr, inline: true },
                        { name: '♈ Zodiac', value: zodiac, inline: true },
                        { name: '🎂 Age', value: age ? `${age} years` : 'Hidden', inline: true },
                        { name: '⏳ Countdown', value: daysUntil === 0 ? '🎉 TODAY!' : `${daysUntil} days`, inline: true }
                    )
                    .setFooter({ text: '🎂 Birthday Intelligence Division' })
                    .setTimestamp()
                ] 
            });
        }

        if (subcommand === 'list') {
            const upcoming = getUpcomingBirthdays(90);
            if (upcoming.length === 0) return message.reply({ 
                embeds: [new EmbedBuilder()
                    .setColor('#FF69B4')
                    .setAuthor({ name: strings.listTitle, iconURL: client.user.displayAvatarURL() })
                    .setDescription(strings.listEmpty)
                    .setFooter({ text: '🎂 Birthday Intelligence Division' })
                ] 
            });
            const embed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setAuthor({ name: strings.listTitle, iconURL: client.user.displayAvatarURL() })
                .setDescription(upcoming.map(b => {
                    const user = client.users.cache.get(b.userId)?.username || 'Unknown';
                    const dateStr = `${b.day} ${strings.months[b.month - 1]}`;
                    return b.daysUntil === 0 ? strings.todayEntry(user, dateStr) : strings.listEntry(user, dateStr, b.daysUntil);
                }).join('\n'))
                .setFooter({ text: `🎂 ${upcoming.length} upcoming birthdays • 90-day window` })
                .setTimestamp();
            return message.reply({ embeds: [embed] });
        }

        return message.reply({ 
            embeds: [new EmbedBuilder()
                .setColor('#FF69B4')
                .setAuthor({ name: '🎂 Birthday Intelligence Division', iconURL: client.user.displayAvatarURL() })
                .setDescription(
                    '```\n' +
                    'BIRTHDAY COMMAND SYNTAX\n' +
                    '━━━━━━━━━━━━━━━━━━━━━━━\n' +
                    '.birthday set <day> <month> [year]  — Register birthday\n' +
                    '.birthday remove                    — Purge record\n' +
                    '.birthday check [@user]             — Query intelligence\n' +
                    '.birthday list                      — Upcoming birthdays\n' +
                    '```'
                )
                .setFooter({ text: '🎂 Birthday Intelligence Division' })
            ] 
        });
    },

    execute: async (interaction, client) => {
        const db = client.db;
        const subcommand = interaction.options.getSubcommand();
        const lang = interaction.locale === 'fr' ? 'fr' : 'en';
        const strings = t[lang];
        const isPrivate = ['set', 'remove'].includes(subcommand);
        await interaction.deferReply({ flags: isPrivate ? 1 << 6 : 0 });

        if (subcommand === 'set') {
            const day = interaction.options.getInteger('day');
            const month = interaction.options.getInteger('month');
            const year = interaction.options.getInteger('year');
            const timezone = interaction.options.getString('timezone') || 'UTC';
            if (!isValidTimezone(timezone)) {
                return interaction.editReply(lang === 'fr'
                    ? `❌ Fuseau horaire inconnu : **${timezone}**. Choisissez une suggestion dans la liste.`
                    : `❌ Unknown timezone: **${timezone}**. Pick one of the suggestions.`);
            }
            if (day < 1 || day > 31) return interaction.editReply(strings.invalidDay);
            if (month < 1 || month > 12) return interaction.editReply(strings.invalidMonth);
            if (year && (year < 1900 || year > 2020)) return interaction.editReply(strings.invalidYear);
            if (!isValidDate(day, month, year || 2000)) return interaction.editReply(strings.invalidDate);
            saveBirthday(db, interaction.user.id, day, month, year, timezone);
            const dateStr = formatDate(day, month, year, lang);
            const zodiac = getZodiacSign(day, month);
            
            return interaction.editReply({ 
                embeds: [new EmbedBuilder()
                    .setColor('#FF69B4')
                    .setAuthor({ name: strings.setTitle, iconURL: interaction.user.displayAvatarURL() })
                    .setDescription(strings.setSuccess(dateStr) + `\n\n♈ **Zodiac:** ${zodiac}\n🕐 **Timezone:** ${timezone} (${offsetLabel(timezone)})`)
                    .setFooter({ text: '🎂 Birthday Intelligence Division' })
                    .setTimestamp()
                ] 
            });
        }

        if (subcommand === 'remove') {
            const exists = birthdays.get(interaction.user.id);
            if (!exists) return interaction.editReply(strings.removeError);
            deleteBirthday(db, interaction.user.id);
            return interaction.editReply({ 
                embeds: [new EmbedBuilder()
                    .setColor('#FF69B4')
                    .setAuthor({ name: strings.removeTitle, iconURL: interaction.user.displayAvatarURL() })
                    .setDescription(strings.removeSuccess)
                    .setFooter({ text: '🎂 Birthday Intelligence Division' })
                    .setTimestamp()
                ] 
            });
        }

        if (subcommand === 'check') {
            const user = interaction.options.getUser('user') || interaction.user;
            const bday = birthdays.get(user.id);
            
            if (!bday) {
                const noBdayEmbed = new EmbedBuilder()
                    .setColor('#95a5a6')
                    .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
                    .setDescription(user.id === interaction.user.id 
                        ? (lang === 'fr' ? '❌ Aucun dossier anniversaire trouve.\nUtilisez `/birthday set` pour l\'ajouter.' : '❌ No birthday record found.\nUse `/birthday set` to register.')
                        : (lang === 'fr' ? `❌ ${user.username} n'a pas de dossier anniversaire.` : `❌ ${user.username} has no birthday record.`))
                    .setFooter({ text: '🎂 Birthday Intelligence Division' });
                return interaction.editReply({ embeds: [noBdayEmbed] });
            }
            
            const daysUntil = getDaysUntil(bday.day, bday.month);
            const age = bday.year ? calculateAge(bday.year) : null;
            const nextAge = bday.year ? (daysUntil === 0 ? age : age + 1) : null;
            const zodiac = getZodiacSign(bday.day, bday.month);
            const milestone = getMilestoneData(nextAge);
            
            let countdownText = '';
            let countdownEmoji = '';
            if (daysUntil === 0) {
                countdownText = lang === 'fr' ? '🎉 **AUJOURD\'HUI !** 🎉' : '🎉 **TODAY!** 🎉';
                countdownEmoji = '🎂';
            } else if (daysUntil === 1) {
                countdownText = lang === 'fr' ? '⏰ **DEMAIN !** Preparez-vous !' : '⏰ **Tomorrow!** Get ready!';
                countdownEmoji = '⏰';
            } else if (daysUntil <= 7) {
                countdownText = lang === 'fr' ? `🔜 **${daysUntil} jours** avant le grand jour !` : `🔜 **${daysUntil} days** until the big day!`;
                countdownEmoji = '🔜';
            } else {
                countdownText = lang === 'fr' ? `📅 **${daysUntil} jours** restants` : `📅 **${daysUntil} days** remaining`;
                countdownEmoji = '📅';
            }
            
            const progressPercent = Math.min(100, Math.max(0, Math.floor(((365 - daysUntil) / 365) * 100)));
            const progressBar = '▓'.repeat(Math.floor(progressPercent / 10)) + '░'.repeat(10 - Math.floor(progressPercent / 10));
            
            const embed = new EmbedBuilder()
                .setColor(daysUntil === 0 ? '#FFD700' : (daysUntil <= 7 ? '#FF69B4' : '#9B59B6'))
                .setAuthor({ 
                    name: `🎂 ${user.username}'s Birthday Dossier ${zodiac}`, 
                    iconURL: user.displayAvatarURL() 
                })
                .setThumbnail(user.displayAvatarURL({ size: 256 }))
                .addFields(
                    { name: '📅 ' + (lang === 'fr' ? 'Date de Naissance' : 'Birth Date'), value: `**${formatDate(bday.day, bday.month, bday.year, lang)}**`, inline: true },
                    { name: '🎂 ' + (lang === 'fr' ? 'Age' : 'Age'), value: age ? `**${age}** ${lang === 'fr' ? 'ans' : 'years'}` : '*(Classified)*', inline: true },
                    { name: '🌍 Timezone', value: `**${bday.timezone || 'UTC'}**`, inline: true },
                    { name: countdownEmoji + ' ' + (daysUntil === 0 ? '🎉 TODAY!' : (lang === 'fr' ? 'Compte a Rebours' : 'Countdown')), value: `${countdownText}\n\`${progressBar}\` ${progressPercent}%`, inline: false }
                )
                .setFooter({ 
                    text: daysUntil === 0 
                        ? (lang === 'fr' ? '🎂 Souhaitez un joyeux anniversaire !' : '🎂 Wish them a happy birthday!') 
                        : (lang === 'fr' ? `⏳ ${daysUntil} jours restants` : `⏳ ${daysUntil} days remaining`),
                    iconURL: client.user.displayAvatarURL() 
                });
            
            if (nextAge && daysUntil > 0) {
                embed.addFields({
                    name: '🔮 ' + (lang === 'fr' ? 'Prochain Age' : 'Turning'),
                    value: milestone.badge ? `${milestone.badge} **${milestone.title}** — Will be **${nextAge}**!` : `Will be **${nextAge}** ${lang === 'fr' ? 'ans' : 'years old'}!`,
                    inline: true
                });
            }
            
            if (daysUntil === 0) {
                embed.addFields({
                    name: '🎁 ' + (lang === 'fr' ? 'C\'est le Moment !' : 'It\'s Time!'),
                    value: lang === 'fr' ? 'Envoyez un message de joyeux anniversaire !' : 'Send them a birthday message!',
                    inline: false
                });
            }
            
            const components = [];
            if (daysUntil === 0) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`bday_celebrate_${user.id}`)
                        .setLabel(lang === 'fr' ? '🎉 Celebrer !' : '🎉 Celebrate!')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('🎂')
                );
                components.push(row);
            }
            
            return interaction.editReply({ embeds: [embed], components: components.length > 0 ? components : undefined });
        }

        if (subcommand === 'list') {
            const upcoming = getUpcomingBirthdays(90);
            if (upcoming.length === 0) {
                const emptyEmbed = new EmbedBuilder()
                    .setColor('#95a5a6')
                    .setAuthor({ name: '📅 ' + strings.listTitle, iconURL: client.user.displayAvatarURL() })
                    .setDescription('✨ ' + strings.listEmpty)
                    .setFooter({ text: '🎂 Use /birthday set to register your birthday' });
                return interaction.editReply({ embeds: [emptyEmbed] });
            }
            
            const grouped = {};
            const today = new Date();
            const currentMonth = today.getMonth() + 1;
            
            upcoming.forEach(b => { 
                if (!grouped[b.month]) grouped[b.month] = []; 
                grouped[b.month].push(b); 
            });
            
            const embed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setAuthor({ 
                    name: `🎂 ${strings.listTitle} • ${upcoming.length} Upcoming`, 
                    iconURL: client.user.displayAvatarURL() 
                })
                .setThumbnail('https://cdn.discordapp.com/emojis/1120816625522311178.png')
                .setDescription('*📅 Birthdays in the next 90 days — Intelligence Briefing*\n');
            
            const sortedMonths = Object.keys(grouped).sort((a, b) => {
                const mA = parseInt(a), mB = parseInt(b);
                if (mA >= currentMonth && mB < currentMonth) return -1;
                if (mA < currentMonth && mB >= currentMonth) return 1;
                return mA - mB;
            });
            
            const monthEmojis = ['❄️', '💕', '🌸', '🌷', '🌺', '☀️', '🌊', '🍂', '🎃', '🦃', '🎄', '⛄'];
            
            for (const monthKey of sortedMonths) {
                const month = parseInt(monthKey);
                const bdays = grouped[monthKey].sort((a, b) => a.day - b.day);
                let fieldValue = '';
                
                bdays.forEach(b => {
                    const user = client.users.cache.get(b.userId);
                    const displayName = user?.username || 'Unknown Agent';
                    const zodiac = getZodiacSign(b.day, month);
                    
                    if (b.daysUntil === 0) fieldValue += `🎂 **${displayName}** — *TODAY!* ${zodiac}\n`;
                    else if (b.daysUntil === 1) fieldValue += `🎂 **${displayName}** — *Tomorrow!* ${zodiac}\n`;
                    else if (b.daysUntil <= 7) fieldValue += `🎂 **${displayName}** — ${b.day} ${strings.months[month-1]} (🔜 T-${b.daysUntil}d) ${zodiac}\n`;
                    else fieldValue += `🎂 **${displayName}** — ${b.day} ${strings.months[month-1]} (T-${b.daysUntil}d) ${zodiac}\n`;
                });
                
                embed.addFields({ 
                    name: `${monthEmojis[month-1]} ${strings.months[month-1]} ${month === currentMonth ? '👑 CURRENT' : ''}`, 
                    value: fieldValue || '*No agents registered*', 
                    inline: false 
                });
            }
            
            embed.setFooter({ 
                text: `🎉 ${birthdays.size} total registered • Birthday Intelligence Division • Updated just now`, 
                iconURL: client.user.displayAvatarURL() 
            }).setTimestamp();
            
            return interaction.editReply({ embeds: [embed] });
        }
    },

    initialize: (client) => {
        const db = client.db;
        try { db.exec(`ALTER TABLE birthday ADD COLUMN timezone TEXT DEFAULT 'UTC'`); } catch (e) {}
        db.exec(`CREATE TABLE IF NOT EXISTS birthday (user_id TEXT PRIMARY KEY, day INTEGER NOT NULL, month INTEGER NOT NULL, year INTEGER, timezone TEXT DEFAULT 'UTC', created_at INTEGER)`);
        loadAllBirthdays(db);
        scheduleDailyCheck(client);
        console.log(`\x1b[36m[BIRTHDAY]\x1b[0m Intelligence Division initialized — ${birthdays.size} agents registered`);
    }
};
