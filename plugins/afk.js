// plugins/afk.js — /afk [reason] [time] and .afk [reason] [time]
// Saved in the database, per server: an AFK survives restarts and only concerns the server it was set on.
// While someone is away, each mention is noted (one notice per channel every 10 minutes, not one per ping) and anyone
// can ask to be told when they come back. When they write again (or their time runs out), one card says welcome back
// and lists who mentioned them, with a link to each message. The server can switch AFK off (dashboard → Modules).
// Texts: lang/{en,fr,zh,ar}/afk.json
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { t } = require('../lib/i18n');
const { pickLang } = require('../lib/pick-lang');
const { card } = require('../lib/games/v2');
const { icon } = require('../lib/ui/icons');

const PURPLE = 0x7F77DD, GREY = 0x888780, GREEN = 0x1D9E75;
const NOTICE_GAP = 10 * 60000;          // one notice per AFK member and channel every 10 minutes
const MAX_MENTIONS = 25;                // kept per absence (the card shows the last 10)
const MAX_TIME = 7 * 86400000;
const EXTEND = 30 * 60000;
const A = (k, lang, v) => t(`afk.${k}`, lang, v || {});
const LANGS = ['en', 'fr', 'zh', 'ar'];
const langOf = (client, gid, where, uid) => { try { const l = pickLang(client, gid, where, uid); return LANGS.includes(l) ? l : 'en'; } catch { return 'en'; } };
const safe = (s, n = 120) => String(s || '').replace(/[*_~`|>\\]/g, '').replace(/@(everyone|here)/gi, '@​$1').slice(0, n);

// ================= DATABASE =================
function ensure(db) {
    if (ensure.done) return;
    db.exec(`CREATE TABLE IF NOT EXISTS afk_status (guild_id TEXT, user_id TEXT, reason TEXT, since INTEGER, until INTEGER, channel_id TEXT, PRIMARY KEY (guild_id, user_id))`);
    db.exec(`CREATE TABLE IF NOT EXISTS afk_mentions (guild_id TEXT, user_id TEXT, author_id TEXT, channel_id TEXT, message_id TEXT, at INTEGER)`);
    db.exec(`CREATE TABLE IF NOT EXISTS afk_watchers (guild_id TEXT, user_id TEXT, watcher_id TEXT, channel_id TEXT, at INTEGER, PRIMARY KEY (guild_id, user_id, watcher_id))`);
    ensure.done = true;
}
const getAfk = (db, gid, uid) => { ensure(db); return db.prepare('SELECT * FROM afk_status WHERE guild_id = ? AND user_id = ?').get(String(gid), String(uid)) || null; };
const enabled = (client, gid) => { try { return client.getServerSettings?.(gid)?.afkEnabled !== false; } catch { return true; } };
const activeCount = (db) => { try { ensure(db); return db.prepare('SELECT COUNT(*) AS n FROM afk_status').get().n; } catch { return 0; } };

// "30m", "2h", "1h30", "45" (minutes), "1d", "90min", "1h 30m"
function parseTime(raw) {
    const s = String(raw || '').toLowerCase().replace(/\s+/g, '');
    if (!s) return null;
    if (/^\d{1,4}$/.test(s)) return Number(s) * 60000;
    const m = /^(?:(\d{1,2})d)?(?:(\d{1,3})h)?(?:(\d{1,4})(?:m|min|mn)?)?$/.exec(s);
    if (!m || (!m[1] && !m[2] && !m[3])) return null;
    const ms = (Number(m[1] || 0) * 1440 + Number(m[2] || 0) * 60 + Number(m[3] || 0)) * 60000;
    return ms > 0 ? Math.min(ms, MAX_TIME) : null;
}
const TIME_TAIL = /\s+(\d{1,2}d)?\s*(\d{1,3}h)?\s*(\d{1,4}(m|min|mn)?)?$/i;

function duration(ms, lang) {
    const min = Math.max(1, Math.round(ms / 60000));
    const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
    return [d ? A('d', lang, { n: d }) : null, h ? A('h', lang, { n: h }) : null, m && !d ? A('m', lang, { n: m }) : null].filter(Boolean).join(' ');
}
const at = (ms) => `<t:${Math.floor(ms / 1000)}:t>`;
const rel = (ms) => `<t:${Math.floor(ms / 1000)}:R>`;

// ================= CARDS =================
function setCard(member, row, lang, guild) {
    const back = row.until ? A('autoBack', lang, { time: at(row.until), in: rel(row.until) }) : A('noAuto', lang);
    return card(PURPLE, [
        { thumbnail: [`### ${icon('afk', guild)} ${A('isAway', lang, { user: safe(member.displayName, 60) })}\n${safe(row.reason, 200) || A('noReason', lang)}\n-# ${back}`, member.displayAvatarURL({ size: 128, extension: 'png' })] },
        { row: new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`afk:back:${member.id}`).setLabel(A('btnBack', lang)).setStyle(ButtonStyle.Success).setEmoji(icon('ok', guild)),
            new ButtonBuilder().setCustomId(`afk:ext:${member.id}`).setLabel(A('btnExtend', lang)).setStyle(ButtonStyle.Secondary).setEmoji(icon('clock', guild))) },
    ]);
}

function noticeCard(member, row, lang, guild) {
    const since = duration(Date.now() - row.since, lang);
    const line = `${icon('afk', guild)} ${A('noticeLine', lang, { user: safe(member.displayName, 60), since })}${row.reason ? ` : ${safe(row.reason, 150)}` : ''}`;
    const sub = row.until ? A('noticeBack', lang, { time: at(row.until) }) : A('noticeSeen', lang);
    return card(GREY, [
        { text: `${line}\n-# ${sub}` },
        { row: new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`afk:watch:${member.id}`).setLabel(A('btnWatch', lang)).setStyle(ButtonStyle.Secondary).setEmoji(icon('bell', guild))) },
    ]);
}

function backCard(member, row, mentions, watchers, lang, guild, auto) {
    const away = duration(Date.now() - row.since, lang);
    const head = `### ${icon('ok', guild)} ${A(auto ? 'backAuto' : 'backTitle', lang, { user: safe(member.displayName, 60) })}\n-# ${A(mentions.length === 0 ? 'backSubNone' : mentions.length === 1 ? 'backSubOne' : 'backSub', lang, { time: away, n: mentions.length })}`;
    const items = [{ thumbnail: [head, member.displayAvatarURL({ size: 128, extension: 'png' })] }];
    if (mentions.length) {
        const list = mentions.slice(-10).map((m) => A('mentionLine', lang, { who: `<@${m.author_id}>`, where: `<#${m.channel_id}>`, link: `https://discord.com/channels/${m.guild_id}/${m.channel_id}/${m.message_id}` }));
        if (mentions.length > 10) list.unshift(`-# ${A('older', lang, { n: mentions.length - 10 })}`);
        items.push({ rule: true }, { text: list.join('\n') });
    }
    if (watchers.length) items.push({ text: `-# ${A(watchers.length === 1 ? 'watchersOne' : 'watchersMany', lang, { who: watchers.map((w) => `<@${w.watcher_id}>`).join(' ') })}` });
    return card(GREEN, items);
}

// ================= START / END =================
const timers = new Map();   // `${gid}:${uid}` -> timeout
function arm(client, row) {
    const key = `${row.guild_id}:${row.user_id}`;
    clearTimeout(timers.get(key));
    if (!row.until) return timers.delete(key);
    const wait = Math.max(1000, row.until - Date.now());
    timers.set(key, setTimeout(() => { timers.delete(key); end(client, row.guild_id, row.user_id, { auto: true }).catch(() => {}); }, Math.min(wait, 2 ** 31 - 1)));
}

function start(client, guild, member, channelId, reason, ms) {
    const db = client.db;
    ensure(db);
    const now = Date.now();
    const row = { guild_id: guild.id, user_id: member.id, reason: safe(reason, 200) || null, since: now, until: ms ? now + ms : null, channel_id: channelId || null };
    db.prepare('INSERT OR REPLACE INTO afk_status (guild_id, user_id, reason, since, until, channel_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(row.guild_id, row.user_id, row.reason, row.since, row.until, row.channel_id);
    db.prepare('DELETE FROM afk_mentions WHERE guild_id = ? AND user_id = ?').run(guild.id, member.id);
    db.prepare('DELETE FROM afk_watchers WHERE guild_id = ? AND user_id = ?').run(guild.id, member.id);
    arm(client, row);
    console.log(`[AFK] guild=${guild.id} ${member.user?.tag || member.id} away${row.until ? ` until ${new Date(row.until).toISOString()}` : ''}`);
    return row;
}

// Ends an absence and returns the welcome-back card (or posts it, for an automatic end). Watchers are pinged in the
// card when it goes to a channel; those who asked from another channel also get a short DM.
async function end(client, gid, uid, { auto = false, channel = null } = {}) {
    const db = client.db;
    const row = getAfk(db, gid, uid);
    if (!row) return null;
    clearTimeout(timers.get(`${gid}:${uid}`)); timers.delete(`${gid}:${uid}`);
    const mentions = db.prepare('SELECT * FROM afk_mentions WHERE guild_id = ? AND user_id = ? ORDER BY at').all(gid, uid);
    const watchers = db.prepare('SELECT * FROM afk_watchers WHERE guild_id = ? AND user_id = ? ORDER BY at').all(gid, uid);
    db.prepare('DELETE FROM afk_status WHERE guild_id = ? AND user_id = ?').run(gid, uid);
    db.prepare('DELETE FROM afk_mentions WHERE guild_id = ? AND user_id = ?').run(gid, uid);
    db.prepare('DELETE FROM afk_watchers WHERE guild_id = ? AND user_id = ?').run(gid, uid);
    const guild = client.guilds.cache.get(String(gid));
    const member = guild ? await guild.members.fetch(String(uid)).catch(() => null) : null;
    if (!member) return null;
    const lang = langOf(client, gid, null, uid);
    const payload = backCard(member, row, mentions, watchers, lang, guild, auto);
    payload.allowedMentions = { users: watchers.map((w) => w.watcher_id) };
    const target = channel || (auto && row.channel_id ? guild.channels.cache.get(String(row.channel_id)) : null);
    // a watcher who asked in another channel than the one the card goes to: a DM, so they don't miss it
    for (const w of watchers) {
        if (target && String(w.channel_id) === String(target.id)) continue;
        const u = await client.users.fetch(w.watcher_id).catch(() => null);
        if (u) u.send({ content: A('watchDm', langOf(client, gid, null, w.watcher_id), { user: safe(member.displayName, 60), server: safe(guild.name, 80) }), allowedMentions: { parse: [] } }).catch(() => {});
    }
    console.log(`[AFK] guild=${gid} ${member.user?.tag || uid} back${auto ? ' (time ran out)' : ''}: ${mentions.length} mention(s), ${watchers.length} watcher(s)`);
    if (auto && target) { await require('../lib/safeSend').safeSend('afk', target, payload, { guild, quiet: true }).catch(() => {}); return null; }
    return payload;
}

// Called by index.js for every server message: the author coming back, and AFK members being mentioned
const lastNotice = new Map();   // `${gid}:${uid}:${channelId}` -> time
async function onMessage(message, client) {
    if (!message.guild || message.author?.bot) return;
    const db = client.db;
    ensure(db);
    const gid = message.guild.id;

    // the author is back (but not on the very message that runs .afk: that command decides on its own)
    const own = getAfk(db, gid, message.author.id);
    if (own && message.createdTimestamp > own.since) {
        const prefix = (() => { try { return client.getServerSettings?.(gid)?.prefix || '.'; } catch { return '.'; } })();
        const isAfkCmd = message.content.startsWith(prefix) && /^(afk|away|absent|brb)\b/i.test(message.content.slice(prefix.length).trim());
        if (!isAfkCmd) {
            const payload = await end(client, gid, message.author.id, { channel: message.channel });
            if (payload) await message.reply(payload).catch(() => {});
        }
    }

    if (!message.mentions.users.size || !enabled(client, gid)) return;
    const replied = message.mentions.repliedUser?.id;
    for (const [id] of message.mentions.users) {
        if (id === message.author.id) continue;
        const row = getAfk(db, gid, id);
        if (!row) continue;
        const n = db.prepare('SELECT COUNT(*) AS n FROM afk_mentions WHERE guild_id = ? AND user_id = ?').get(gid, id).n;
        if (n < MAX_MENTIONS) db.prepare('INSERT INTO afk_mentions (guild_id, user_id, author_id, channel_id, message_id, at) VALUES (?, ?, ?, ?, ?, ?)')
            .run(gid, id, message.author.id, message.channel.id, message.id, Date.now());
        const key = `${gid}:${id}:${message.channel.id}`;
        if (Date.now() - (lastNotice.get(key) || 0) < NOTICE_GAP) continue;
        lastNotice.set(key, Date.now());
        const member = await message.guild.members.fetch(id).catch(() => null);
        if (!member) continue;
        const lang = langOf(client, gid, null, message.author.id);
        await message.reply({ ...noticeCard(member, row, lang, message.guild), allowedMentions: { parse: [], repliedUser: false } }).catch(() => {});
        if (id === replied) break;
    }
}

// Start-up: absences with an end time get their timer back; those that ended while ARCHON was off end now
function resume(client) {
    try {
        ensure(client.db);
        const rows = client.db.prepare('SELECT * FROM afk_status WHERE until IS NOT NULL').all();
        for (const r of rows) arm(client, r);
        if (rows.length) console.log(`[AFK] ${rows.length} timed absence(s) resumed`);
    } catch (e) { console.error('[AFK] resume:', e.message); }
}

// ================= BUTTONS: afk:back:<uid> · afk:ext:<uid> · afk:watch:<uid> =================
async function handleComponent(ix, client) {
    const guild = ix.guild;
    const lang = langOf(client, ix.guildId, ix, ix.user.id);
    const say = (content) => ix.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }).catch(() => {});
    if (!guild) return;
    const [, action, uid] = ix.customId.split(':');
    const row = getAfk(client.db, guild.id, uid);
    if (!row) return say(A('notAway', lang));
    if (action === 'watch') {
        if (ix.user.id === uid) return say(A('watchSelf', lang));
        client.db.prepare('INSERT OR IGNORE INTO afk_watchers (guild_id, user_id, watcher_id, channel_id, at) VALUES (?, ?, ?, ?, ?)').run(guild.id, uid, ix.user.id, ix.channelId, Date.now());
        return say(A('watchOk', lang));
    }
    if (ix.user.id !== uid) return say(A('notYours', lang));
    if (action === 'back') {
        const payload = await end(client, guild.id, uid, { channel: ix.channel });
        return payload ? ix.update(payload).catch(() => {}) : say(A('notAway', lang));
    }
    if (action === 'ext') {
        const until = Math.max(row.until || Date.now(), Date.now()) + EXTEND;
        client.db.prepare('UPDATE afk_status SET until = ? WHERE guild_id = ? AND user_id = ?').run(until, guild.id, uid);
        const next = { ...row, until };
        arm(client, next);
        return ix.update(setCard(ix.member, next, lang, guild)).catch(() => {});
    }
}

// ================= COMMAND =================
async function toggle(client, guild, member, channelId, rawReason, rawTime, lang) {
    if (!guild) return { content: A('serverOnly', lang) };
    if (!enabled(client, guild.id)) return { content: A('off', lang) };
    // running it again while away means "I'm back"
    if (getAfk(client.db, guild.id, member.id) && !rawReason && !rawTime) return (await end(client, guild.id, member.id, { channel: null })) || { content: A('notAway', lang) };
    let ms = null;
    if (rawTime) { ms = parseTime(rawTime); if (!ms) return { content: A('badTime', lang, { time: safe(rawTime, 20) }) }; }
    const row = start(client, guild, member, channelId, rawReason, ms);
    return setCard(member, row, lang, guild);
}

module.exports = {
    name: 'afk',
    aliases: ['away', 'absent', 'brb'],
    description: 'Say you are away: mentions are noted and you get them all when you come back',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.afk [reason] [time: 30m, 2h, 1h30]',
    handleComponent,
    onMessage,
    resume,
    activeCount,
    afkUsers: new Map(),   // old export, kept empty for the code that still reads it
    _parseTime: parseTime,

    data: new SlashCommandBuilder()
        .setName('afk')
        .setDescription('Say you are away; you get every mention when you come back')
        .addStringOption((o) => o.setName('reason').setDescription('Why you are away (optional)').setRequired(false).setMaxLength(200))
        .addStringOption((o) => o.setName('time').setDescription('Back automatically after: 30m, 2h, 1h30 (optional)').setRequired(false).setMaxLength(12)),

    run: async (client, message, args) => {
        const lang = langOf(client, message.guild?.id, message, message.author.id);
        let text = args.join(' ').trim(), time = null;
        const m = TIME_TAIL.exec(` ${text}`);
        // a unit is needed here: "I play CODM 4" keeps its number
        if (m && /[dhm]/i.test(m[0]) && parseTime(m[0])) { time = m[0].trim(); text = ` ${text}`.slice(0, m.index).trim(); }
        const payload = await toggle(client, message.guild, message.member, message.channel.id, text, time, lang);
        return message.reply({ ...payload, allowedMentions: payload.allowedMentions || { parse: [] } }).catch(() => {});
    },

    execute: async (ix, client) => {
        const lang = langOf(client, ix.guildId, ix, ix.user.id);
        const payload = await toggle(client, ix.guild, ix.member, ix.channelId, ix.options.getString('reason') || '', ix.options.getString('time'), lang);
        const quiet = !!payload.content;
        return ix.reply({ ...payload, flags: (payload.flags || 0) | (quiet ? MessageFlags.Ephemeral : 0), allowedMentions: payload.allowedMentions || { parse: [] } });
    },
};
