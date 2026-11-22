const { EmbedBuilder, SlashCommandBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const em = (k, fb) => { try { return require('../config/emojis')[k] || fb; } catch { return fb; } };
const { icon, iconObj } = require('../lib/ui/icons');
const axios = require('axios');
const cmdSlash = require('../lib/cmd').slash;
const { resolveEmoji } = require('../lib/emoji-resolver');
const { card: v2card } = require('../lib/games/v2');
const { toV2, fit } = require('../lib/v2convert');   // classic embeds -> Components V2 cards
const ui = require('../lib/games/ui');
const EMOJIS = require('../config/emojis');

// ================= THRESHOLDS =================
const SPAM_THRESHOLD = 5;   // default; each server sets its own (spam_threshold, 3–15)
const SPAM_WINDOW = 5000;
const CAPS_RATIO = 0.7;
const EMOJI_RATIO = 0.75;
const MENTION_LIMIT = 6;    // default; each server sets its own (mention_limit, 3–20)
const clampInt = (v, min, max, dflt) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt; };

// The dashboard's spam, mention, link and invite settings used to be ignored: AutoMod always used 3 messages,
// 6 mentions, and blocked links and invites. They are now applied. Once, before that, every server's saved
// values are set to what AutoMod really did, so nothing changes until an admin changes them.
// The channel list used to mean "AutoMod runs only here" but only limited the 3 Premium checks; it now means
// "AutoMod ignores these channels". Lists saved with the old meaning are emptied once, and the admin is told on the
// AutoMod card (bot_state 'automod_channels_notice' holds the servers still to tell).
function migrateIgnoredChannels(db) {
    try {
        if (db.prepare("SELECT 1 FROM bot_state WHERE key = 'automod_channels_ignore'").get()) return;
        const rows = db.prepare("SELECT guild_id FROM server_settings WHERE automod_channels IS NOT NULL AND TRIM(automod_channels) != ''").all();
        db.transaction(() => {
            db.prepare("UPDATE server_settings SET automod_channels = NULL WHERE automod_channels IS NOT NULL").run();
            db.prepare("INSERT OR REPLACE INTO bot_state (key, value) VALUES ('automod_channels_notice', ?)").run(JSON.stringify(rows.map((r) => r.guild_id)));
            db.prepare("INSERT OR REPLACE INTO bot_state (key, value) VALUES ('automod_channels_ignore', '1')").run();
        })();
        if (rows.length) console.log(`[AUTOMOD] channel lists now mean "ignored": ${rows.length} old list(s) emptied, their admins will be told`);
    } catch (e) { console.error('[AUTOMOD] channel list change failed:', e.message); }
}
// true once per server whose old list was emptied (then forgotten)
function takeChannelsNotice(db, gid) {
    try {
        const row = db.prepare("SELECT value FROM bot_state WHERE key = 'automod_channels_notice'").get();
        const list = row ? JSON.parse(row.value || '[]') : [];
        if (!list.includes(String(gid))) return false;
        db.prepare("UPDATE bot_state SET value = ? WHERE key = 'automod_channels_notice'").run(JSON.stringify(list.filter((g) => g !== String(gid))));
        return true;
    } catch { return false; }
}
const ignoredChannels = (ss) => String(ss?.automodChannels || ss?.automod_channels || '').split(',').map((c) => c.trim()).filter(Boolean);

function migrateFilterSettings(db) {
    try {
        if (!db.prepare("SELECT 1 FROM bot_state WHERE key = 'automod_settings_live'").get()) {
            db.transaction(() => {
                db.prepare('UPDATE server_settings SET spam_threshold = ?, mention_limit = ?, link_filter_enabled = 1, invite_filter_enabled = 1').run(SPAM_THRESHOLD, MENTION_LIMIT);
                db.prepare("INSERT OR REPLACE INTO bot_state (key, value) VALUES ('automod_settings_live', '1')").run();
            })();
            console.log('[AUTOMOD] Saved spam, mention, link and invite settings aligned with what AutoMod enforced');
        }
    } catch (e) { console.error('[AUTOMOD] settings alignment failed:', e.message); }
    // 3 messages in 5 s caught people chatting fast. Servers still on 3 move to 5, once; an admin can set 3 again.
    try {
        if (db.prepare("SELECT 1 FROM bot_state WHERE key = 'automod_spam_5'").get()) return;
        const r = db.prepare('UPDATE server_settings SET spam_threshold = 5 WHERE spam_threshold IS NULL OR spam_threshold < 5').run();
        db.prepare("INSERT OR REPLACE INTO bot_state (key, value) VALUES ('automod_spam_5', '1')").run();
        console.log(`[AUTOMOD] spam threshold moved to 5 on ${r.changes} server(s)`);
    } catch (e) { console.error('[AUTOMOD] spam threshold update failed:', e.message); }
}
let _migrated = false;
const REPEAT_WINDOW = 15000;
const MAX_HISTORY = 100;
const IMAGE_SPAM_LIMIT = 2;
const IMAGE_SPAM_WINDOW = 10000;
const EVERYONE_COOLDOWN = 30000;

// ================= STATE =================
const history = new Map();
const everyoneCooldowns = new Map();
const APPEAL_COOLDOWN = 86400000;

// A Map that is also written to SQLite, so pending appeals and appeal cooldowns survive a restart
// (the bot restarts on every deploy, and every open appeal used to say "expired" afterwards).
function savedMap(table) {
    const mem = new Map(); let db = null;
    const m = {
        load(d) {
            if (db || !d) return;
            try {
                d.prepare(`CREATE TABLE IF NOT EXISTS ${table} (k TEXT PRIMARY KEY, v TEXT)`).run();
                for (const r of d.prepare(`SELECT k, v FROM ${table}`).all()) { try { mem.set(r.k, JSON.parse(r.v)); } catch {} }
                db = d;
            } catch (e) { console.error(`[AUTOMOD] could not load ${table}:`, e.message); }
        },
        get: (k) => mem.get(k),
        has: (k) => mem.has(k),
        set(k, v) { mem.set(k, v); try { db?.prepare(`INSERT OR REPLACE INTO ${table} (k, v) VALUES (?, ?)`).run(k, JSON.stringify(v)); } catch {} return m; },
        delete(k) { const had = mem.delete(k); try { db?.prepare(`DELETE FROM ${table} WHERE k = ?`).run(k); } catch {} return had; },
        [Symbol.iterator]: () => mem[Symbol.iterator](),
    };
    return m;
}
const appealCooldowns = savedMap('automod_appeal_cooldowns');   // "uid:gid" -> last appeal time, "ban:uid:gid" -> paused until

// ================= APPEAL TRIBUNAL STATE =================
const appealTribunal = savedMap('automod_appeals'); // appealId => { guildId, userId, ownerId, status, messageId, channelId, expiresAt }
function loadState(db) { appealTribunal.load(db); appealCooldowns.load(db); fixLogUnits(db); }

// AutoMod used to write moderation_logs.timestamp in milliseconds while everything else uses seconds,
// so the 30-day purge never removed those rows. Convert them once; the query is a no-op after that.
let _unitsFixed = false;
function fixLogUnits(db) {
    if (_unitsFixed || !db) return; _unitsFixed = true;
    try {
        const r = db.prepare('UPDATE moderation_logs SET timestamp = timestamp / 1000 WHERE timestamp > 100000000000').run();
        if (r.changes) console.log(`[AUTOMOD] ${r.changes} log row(s) converted from ms to seconds`);
    } catch (e) { console.error('[AUTOMOD] log unit fix failed:', e.message); }
}

// Auto-cleanup expired tribunal entries every hour
setInterval(() => {
    const now = Date.now();
    for (const [id, data] of appealTribunal) {
        if (data.expiresAt < now) appealTribunal.delete(id);
    }
}, 3600000);

// ================= MALICIOUS PATTERNS =================
const MALICIOUS = [
    /discordg1ft/i, /free-nitro/i, /steanm/i, /grabify\./i, /iplogger\./i,
    /free\s*tokens?/i, /dm\s*(me|for)\s*(nitro|reward)/i, /self[-\s]?bot/i, /massdm/i,
    /\.(ru|tk|ml|ga|cf)\//i,
    /(?:https?:\/\/)?(?:www\.)?discord(?:app)?\.(?:com|gg)\/gift\/[a-zA-Z0-9]{16,}/i,
];
// Invites are caught with or without https:// ("discord.gg/abc" alone used to slip through)
const INVITE_RE = /(?:discord\.gg|discord(?:app)?\.com\/invite)\/[a-zA-Z0-9_-]+/gi;
const ANY_LINK_RE = /https?:\/\/[^\s<>"`{}|\[\]]+/gi;
// ANY_LINK_RE is global (used with match): calling .test() on it kept a position between messages, so every other
// message with a link was read as having none. This one has no state.
const HAS_LINK_RE = /https?:\/\/[^\s<>"`{}|\[\]]/i;

// Fake Discord sites (dlscord-gift.com, discord-nitro.ru...): a link whose site name looks like Discord but isn't one of
// Discord's own. It used to be any text "discord." followed by something, which also flagged "discord.js" in a sentence.
const DISCORD_HOSTS = new Set(['discord.com', 'discord.gg', 'discordapp.com', 'discordapp.net', 'discord.media', 'discord.dev',
    'discord.new', 'discord.gift', 'discord.gifts', 'discord.co', 'discordstatus.com', 'discord.store', 'dis.gd']);
function fakeDiscordLink(content) {
    for (const link of content.match(ANY_LINK_RE) || []) {
        const host = extractDomain(link).replace(/^www\./, '');
        if (!/d[i1l!|]sc[o0]rd/i.test(host)) continue;
        const official = [...DISCORD_HOSTS].some(d => host === d || host.endsWith('.' + d));
        if (!official) return true;
    }
    return false;
}

// ================= DEFAULT DOMAIN WHITELIST =================
const DEFAULT_DOMAIN_WHITELIST = new Set([
    'google.com', 'www.google.com', 'youtube.com', 'www.youtube.com',
    'youtu.be', 'drive.google.com', 'docs.google.com', 'photos.google.com',
    'github.com', 'www.github.com', 'raw.githubusercontent.com',
    'stackoverflow.com', 'www.stackoverflow.com', 'stackexchange.com',
    'gitlab.com', 'www.gitlab.com', 'codepen.io', 'replit.com',
    'twitter.com', 'x.com', 'www.twitter.com', 'www.x.com',
    'instagram.com', 'www.instagram.com', 'tiktok.com', 'www.tiktok.com',
    'facebook.com', 'www.facebook.com', 'reddit.com', 'www.reddit.com',
    'pinterest.com', 'www.pinterest.com', 'imgur.com', 'www.imgur.com',
    'i.imgur.com', 'tenor.com', 'www.tenor.com', 'media.tenor.com',
    'giphy.com', 'www.giphy.com', 'media.giphy.com',
    'cdn.discordapp.com', 'media.discordapp.net',
    'pastebin.com', 'www.pastebin.com', 'wikipedia.org', 'www.wikipedia.org',
    'en.wikipedia.org', 'spotify.com', 'www.spotify.com', 'open.spotify.com',
    'steamcommunity.com', 'store.steampowered.com',
    'archon223.com', 'www.archon223.com',
]);

function extractDomain(url) {
    try {
        const u = new URL(url);
        return u.hostname.toLowerCase();
    } catch {
        const m = url.match(/^(?:https?:\/\/)?([^\/\s:]+)/i);
        return m ? m[1].toLowerCase() : '';
    }
}

function isDomainWhitelisted(content, customWhitelist) {
    const links = content.match(ANY_LINK_RE);
    if (!links) return true;
    const whitelist = new Set([...DEFAULT_DOMAIN_WHITELIST, ...(customWhitelist || [])]);
    for (const link of links) {
        const domain = extractDomain(link);
        if (!domain) continue;
        if (whitelist.has(domain)) continue;
        const parts = domain.split('.');
        let found = false;
        for (let i = 0; i < parts.length - 1; i++) {
            const parent = parts.slice(i).join('.');
            if (whitelist.has(parent)) { found = true; break; }
        }
        if (!found) return false;
    }
    return true;
}

function parseDomainWhitelist(str) {
    if (!str) return [];
    return str.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

function key(uid, gid) { return `${uid}:${gid}`; }

// Strikes are AutoMod's warnings (id AM-…, kept 30 days). They used to live only in memory and vanished after 10 minutes
// of silence or a restart, so the escalation the member is told about (1 h, 24 h, 7 days, ban) almost never happened.
function amStrikes(db, gid, uid) {
    try {
        return db.prepare("SELECT COUNT(*) AS n FROM warnings WHERE guild_id = ? AND user_id = ? AND id LIKE 'AM-%' AND active = 1 AND (expires_at IS NULL OR expires_at > strftime('%s','now'))").get(String(gid), String(uid))?.n || 0;
    } catch { return 0; }
}

setInterval(() => {
    const cutoff = Date.now() - 600000;
    for (const [k, v] of history) { if (v.last < cutoff) history.delete(k); }
}, 600000);

setInterval(() => {
    const cutoff = Date.now() - APPEAL_COOLDOWN;
    for (const [uid, ts] of appealCooldowns) { if (ts < cutoff) appealCooldowns.delete(uid); }
}, 3600000);

setInterval(() => {
    const cutoff = Date.now() - 300000;
    for (const [gid, ts] of everyoneCooldowns) { if (ts < cutoff) everyoneCooldowns.delete(gid); }
}, 60000);

function normalize(s) { return s.toLowerCase().replace(/\s+/g, ' ').trim(); }

function similarity(a, b) {
    if (!a || !b) return 0;
    const m = [], al = a.length, bl = b.length;
    for (let i = 0; i <= al; i++) m[i] = [i];
    for (let j = 0; j <= bl; j++) m[0][j] = j;
    for (let i = 1; i <= al; i++) for (let j = 1; j <= bl; j++) m[i][j] = Math.min(m[i-1][j]+1, m[i][j-1]+1, m[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
    const d = m[al][bl], l = Math.max(al, bl);
    return l ? (l - d) / l : 1;
}

async function checkToxicity(text) {
    if (!process.env.OPENROUTER_API_KEY || text.length < 8) return null;
    try {
        const r = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: 'openai/gpt-4o-mini',
            messages: [{ role: 'system', content: 'Analyze for toxicity. Return ONLY: {"toxic":true/false,"reason":"brief","type":"insult|hate|harassment|spam|none"}' }, { role: 'user', content: text }],
            temperature: 0, max_tokens: 60
        }, { headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 5000 });
        const c = r.data?.choices?.[0]?.message?.content;
        // An answer that isn't clean JSON counts as toxic only if it clearly says so (any "true" in it used to be enough)
        if (c) { try { return JSON.parse(c.replace(/```json|```/g, '').trim()); } catch { return /"toxic"\s*:\s*true/i.test(c) ? { toxic: true, type: 'toxic content' } : null; } }
    } catch (e) { /* silent */ }
    return null;
}

const C = { BLURPLE: 0x5865F2, RED: 0xED4245, GREEN: 0x3BA55D, YELLOW: 0xFAA61A, GREY: 0x2F3136, DARK: 0x202225 };
const ICON = 'https://cdn.discordapp.com/embed/avatars/0.png';
function fmtDur(ms) { return ms >= 86400000 ? `${Math.round(ms/86400000)} day${Math.round(ms/86400000)>1?'s':''}` : `${Math.round(ms/3600000)} hour${Math.round(ms/3600000)>1?'s':''}`; }
function strikeBar(wc) { const f = Math.min(wc, 4), e = 4 - f; return `${'●'.repeat(f)}${'○'.repeat(e)}`; }

function isElevated(member) {   // about the person AutoMod looks at, not who runs a command (access-ok)
    if (!member) return false;
    return member.permissions.has(PermissionsBitField.Flags.Administrator) || // access-ok: the target
           member.permissions.has(PermissionsBitField.Flags.ManageMessages) ||
           member.permissions.has(PermissionsBitField.Flags.ModerateMembers) ||
           member.permissions.has(PermissionsBitField.Flags.ManageGuild);
}


// ═══════════════════════════════════════════════════════
// RAID DETECTION ENGINE
// ═══════════════════════════════════════════════════════
const raidJoinLog = new Map(); // guildId => [timestamps]
const raidActive = new Map();  // guildId => true/false

// ── Raid mode survives restarts ─────────────────────────────────────────────────────────────────────────────────
// raidActive lives in memory, so a restart (every deploy) silently ended an active raid: the suspect-account removal stopped and the owner never got
// the "back to normal" message. The raid is now also stored in the database (table raid_state), removed when it ends, and picked up again at boot.
// A raid older than 30 minutes is ended quietly at boot (the bot was off for too long for the old state to mean anything).
// Every database call is wrapped: a failure here can never break raid detection itself.
const RAID_RESUME_MAX_AGE_MS = 30 * 60000;
let _raidTable = false;
function _raidDb(db) {
    if (!db) return false;
    if (!_raidTable) { db.prepare('CREATE TABLE IF NOT EXISTS raid_state (guild_id TEXT PRIMARY KEY NOT NULL, started_at INTEGER NOT NULL)').run(); _raidTable = true; }
    return true;
}
function saveRaid(db, gid, ts) {
    try { if (_raidDb(db)) db.prepare('INSERT OR REPLACE INTO raid_state (guild_id, started_at) VALUES (?, ?)').run(String(gid), ts); }
    catch (e) { console.error('[RAID] could not save the raid state:', e.message); }
}
function forgetRaid(db, gid) {
    try { if (_raidDb(db)) db.prepare('DELETE FROM raid_state WHERE guild_id = ?').run(String(gid)); }
    catch (e) { console.error('[RAID] could not remove the raid state:', e.message); }
}
// Called once from ClientReady
async function resumeRaids(client, db) {
    let rows;
    try { _raidDb(db); rows = db.prepare('SELECT guild_id, started_at FROM raid_state').all(); }
    catch (e) { console.error('[RAID] could not read the raid state:', e.message); return; }
    const now = Date.now();
    let resumed = 0, ended = 0;
    for (const r of rows) {
        const gid = r.guild_id, guild = client.guilds.cache.get(gid);
        const s = db.prepare('SELECT raid_enabled, raid_threshold, raid_window FROM server_settings WHERE guild_id = ?').get(gid);
        if (!guild || !s?.raid_enabled || now - r.started_at > RAID_RESUME_MAX_AGE_MS) { forgetRaid(db, gid); ended++; continue; }   // gone, switched off or too old: end it quietly
        raidActive.set(gid, true); resumed++;
        const threshold = s.raid_threshold || 5, window = (s.raid_window || 30) * 1000;
        const check = async () => {
            const stillActive = (raidJoinLog.get(gid) || []).filter((t) => Date.now() - t < window).length >= threshold;
            if (stillActive) { setTimeout(check, 5 * 60000); return; }       // joins are still coming in: look again later
            raidActive.set(gid, false); forgetRaid(db, gid);
            console.log(`[RAID] ✅ Raid over in ${guild.name} — monitoring resumed`);
            const owner = await guild.fetchOwner().catch(() => null); if (!owner) return;
            const L = require('../lib/botPerms').langOf({ guild, client });
            owner.send(toV2({ embeds: [new EmbedBuilder().setColor(0x00cc44)
                .setTitle(require('../lib/i18n').t('automod.raidClearedTitle', L, { server: guild.name }))
                .setDescription(require('../lib/i18n').t('automod.raidClearedDesc', L))
                .setFooter({ text: 'ARCHON CG-223' })] })).catch(() => {});
        };
        setTimeout(check, 5 * 60000);
    }
    console.log(`[RAID] resumed ${resumed} raid state(s), ${ended} ended quietly`);
}

async function handleRaidDetection(member, client, db) {
    const gid = member.guild.id;
    const settings = db.prepare('SELECT raid_enabled, raid_threshold, raid_window, raid_min_age_days FROM server_settings WHERE guild_id = ?').get(gid);
    // read apart: a database missing the column must never stop raid detection itself
    if (settings) { try { settings.raid_action = db.prepare('SELECT raid_action FROM server_settings WHERE guild_id = ?').get(gid)?.raid_action; } catch { settings.raid_action = 'alert'; } }
    if (!settings?.raid_enabled) return;

    const threshold = settings.raid_threshold || 5;
    const window = (settings.raid_window || 30) * 1000;
    const minAgeDays = settings.raid_min_age_days || 0;
    const now = Date.now();

    // Track joins
    if (!raidJoinLog.has(gid)) raidJoinLog.set(gid, []);
    const joins = raidJoinLog.get(gid);
    joins.push(now);
    // Clean old entries outside window
    const recent = joins.filter(t => now - t < window);
    raidJoinLog.set(gid, recent);

    // Check account age
    const accountAge = (now - member.user.createdTimestamp) / 86400000;
    const isSuspect = minAgeDays > 0 && accountAge < minAgeDays;

    // Check if raid threshold hit
    if (recent.length >= threshold && !raidActive.get(gid)) {
        raidActive.set(gid, true);
        saveRaid(db, gid, now);
        console.log(`[RAID] 🚨 Raid detected in ${member.guild.name} — ${recent.length} joins in ${settings.raid_window}s`);

        // Alert owner
        const owner = await member.guild.fetchOwner().catch(() => null);
        if (owner) {
            const _L = require('../lib/botPerms').langOf({ guild: member.guild, client });
            const _t = (k, v) => require('../lib/i18n').t('automod.' + k, _L, v);
            const _dw = (n) => _t(Number(n) === 1 ? 'daysOne' : 'daysMany', { n });
            const _secs = Math.round(window / 1000);
            const embed = new EmbedBuilder()
                .setColor(0xe67e22)
                .setTitle(_t('raidAlertTitle', { server: member.guild.name }))
                .setDescription(_t(minAgeDays > 0 ? 'raidAlertDescKick' : 'raidAlertDescAlert', { n: recent.length, s: _secs, days: _dw(minAgeDays) }))
                .addFields(
                    { name: _t('raidFieldJoins'), value: _t('raidJoinsValue', { n: recent.length, s: _secs }), inline: true },
                    { name: _t('raidFieldWhen'), value: `<t:${Math.floor(now/1000)}:T>`, inline: true }
                )
                .setFooter({ text: _t('raidAlertFooter') })
                .setTimestamp();
            await owner.send(toV2({ embeds: [embed] })).catch(() => {});
        }

        // Auto-unlock after 5 min
        const _recheck = () => {
            const newJoins = raidJoinLog.get(gid) || [];
            const stillActive = newJoins.filter(t => Date.now() - t < window).length >= threshold;
            if (!stillActive) {
                raidActive.set(gid, false);
                forgetRaid(db, gid);
                console.log(`[RAID] ✅ Raid over in ${member.guild.name} — monitoring resumed`);
                if (owner) {
                    owner.send(toV2({ embeds: [new EmbedBuilder()
                        .setColor(0x00cc44)
                        .setTitle(require('../lib/i18n').t('automod.raidClearedTitle', require('../lib/botPerms').langOf({ guild: member.guild, client }), { server: member.guild.name }))
                        .setDescription(require('../lib/i18n').t('automod.raidClearedDesc', require('../lib/botPerms').langOf({ guild: member.guild, client })))
                        .setFooter({ text: 'ARCHON CG-223' })
                    ]})).catch(() => {});
                }
            } else {
                setTimeout(_recheck, 5 * 60000); // joins are still coming in: look again later,
                                                 // instead of staying in raid mode for ever
            }
        };
        setTimeout(_recheck, 5 * 60000);
    }

    // Kick/flag new accounts during active raid
    // What happens to anyone joining while a raid is on (dashboard → Moderation → Anti-raid, raid_action):
    //   alert (default): the owner is told; only accounts younger than the minimum age are kicked (below)
    //   timeout: every new arrival is timed out for an hour · kick / ban: every new arrival is removed
    // Members already in the server are never touched.
    const action = ['timeout', 'kick', 'ban'].includes(String(settings.raid_action)) ? String(settings.raid_action) : 'alert';
    if (raidActive.get(gid) && !member.user.bot && action !== 'alert') {
        const why = `Raid protection: joined during a raid (${action})`;
        let done = false;
        if (action === 'timeout' && member.moderatable) done = await member.timeout(60 * 60 * 1000, why).then(() => true).catch(() => false);
        else if (action === 'kick' && member.kickable) done = await member.kick(why).then(() => true).catch(() => false);
        else if (action === 'ban' && member.bannable) done = await member.ban({ reason: why }).then(() => true).catch(() => false);
        if (done) {
            console.log(`[RAID] ${action} on arrival: ${member.user.tag}`);
            if (action !== 'timeout') {
                try {
                    const _al = require('../lib/botPerms').langOf({ guild: member.guild, client });
                    await member.send(toV2({ embeds: [new EmbedBuilder().setColor(0xff8800)
                        .setTitle(require('../lib/i18n').t('automod.raidKickTitle', _al, { server: member.guild.name }))
                        .setDescription(require('../lib/i18n').t('automod.raidAllDesc', _al, { server: member.guild.name }))] })).catch(() => {});
                } catch { /* DMs closed */ }
            }
            return;
        }
    }

    if (raidActive.get(gid) && isSuspect) {
        console.log(`[RAID] 👶 Suspect account kicked: ${member.user.tag} (${accountAge.toFixed(1)} days old)`);
        await member.kick(`Raid protection: Account too new (${accountAge.toFixed(1)} days)`).catch(() => {});
        try {
            const dm = await member.createDM();
            const _kl = require('../lib/botPerms').langOf({ guild: member.guild, client });
            const _kt = (k, v) => require('../lib/i18n').t('automod.' + k, _kl, v);
            const _kd = (n) => _kt(Number(n) === 1 ? 'daysOne' : 'daysMany', { n });
            await dm.send(toV2({
                embeds: [new EmbedBuilder()
                    .setColor(0xff8800)
                    .setTitle(_kt('raidKickTitle', { server: member.guild.name }))
                                .setDescription(_kt('raidKickDesc', { server: member.guild.name, days: _kd(minAgeDays), age: _kd(accountAge.toFixed(1)), left: _kd(Math.max(1, Math.ceil(minAgeDays - accountAge))) }))
                    .setFooter({ text: 'ARCHON CG-223' })]
            })).catch(() => {});
        } catch {}
    }
}

// ================= FIX 1: takeAction stores violation metadata in history =================
// ── Rule names and reasons shown to PEOPLE are translated (display only) ─────────────────────────────────────────
// The English strings inside each violation stay exactly as they are, because other code matches on them (type.includes('malicious'),
// the audit-log reasons, the console). Anything not known here (for example what the AI reports) is shown as it is.
const _RULE_TYPES = ['message spam', 'caps flood', 'emoji flood', 'mass mention', 'everyone/here spam', 'rapid everyone spam', 'promotional spam',
    'malicious link', 'unauthorized invite', 'unauthorized link', 'image spam', 'attachment spam', 'cross-channel spam', 'rapid fire', 'toxic content'];
const _slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
// violation type -> [pattern of the English reason, translation key, how to read the numbers out of it]
const _RULE_REASONS = {
    'message spam':        [/^(\d+)\+ messages in ([\d.]+)s$/, 'why_message_spam', (m) => ({ n: m[1], s: m[2] })],
    'caps flood':          [/^(\d+)% uppercase$/, 'why_caps_flood', (m) => ({ p: m[1] })],
    'emoji flood':         [/^(\d+) emoji \((\d+)%\)$/, 'why_emoji_flood', (m) => ({ n: m[1], p: m[2] })],
    'mass mention':        [/^(\d+) mentions$/, 'why_mass_mention', (m) => ({ n: m[1] })],
    'everyone/here spam':  [/^@everyone with mass attachments$/, 'why_everyone_here_spam', () => ({})],
    'rapid everyone spam': [/^Repeated @everyone spam with attachments$/, 'why_rapid_everyone_spam', () => ({})],
    'promotional spam':    [/^@here\/@everyone \+ external link$/, 'why_promotional_spam', () => ({})],
    'malicious link':      [/^Phishing\/scam URL detected$/, 'why_malicious_link', () => ({})],
    'unauthorized invite': [/^External Discord invite$/, 'why_unauthorized_invite', () => ({})],
    'unauthorized link':   [/^Link domain not permitted$/, 'why_unauthorized_link', () => ({})],
    'image spam':          [/^(\d+) images in ([\d.]+)s$/, 'why_image_spam', (m) => ({ n: m[1], s: m[2] })],
    'attachment spam':     [/^Multiple image-only posts$/, 'why_attachment_spam', () => ({})],
    'cross-channel spam':  [/^Same message in (\d+) channels( \(contains links\))?$/, 'why_cross_channel_spam', (m) => ({ n: m[1] }), (m) => m[2] ? 'why_cross_channel_spam_links' : 'why_cross_channel_spam'],
    'rapid fire':          [/^(\d+) messages across (\d+) channels in ([\d.]+)s$/, 'why_rapid_fire', (x) => ({ n: x[1], c: x[2], s: x[3] })],
};
const _usable = (out, key, fallback) => (typeof out === 'string' && out && out !== key && !out.startsWith('automod.')) ? out : fallback;
function ruleName(v, t) {
    try { const type = v?.type; if (!type) return ''; if (!_RULE_TYPES.includes(type)) return type; const key = 'rule_' + _slug(type); return _usable(t(key), key, type); }
    catch { return v?.type || ''; }
}
function ruleReason(v, t) {
    try {
        const raw = v?.reason || '', spec = _RULE_REASONS[v?.type];
        if (!spec) return raw;
        const m = String(raw).match(spec[0]); if (!m) return raw;
        const key = spec[3] ? spec[3](m) : spec[1];
        return _usable(t(key, spec[2](m)), key, raw);
    } catch { return v?.reason || ''; }
}

// One spam burst = one strike. The messages of a burst arrive together and each one used to add a strike
// (a 6-message flood could go straight to a ban). After a strike, the member's next messages for a short
// while are only deleted.
const STRIKE_GRACE = 15000;
const _ownerPings = new Map();   // gid:whyNot -> last time the owner was told
async function takeAction(message, violations, client, db) {
    const uid = message.author.id, gid = message.guild.id;
    const k = key(uid, gid);
    const entry = history.get(k) || { messages: [], warns: 0, last: Date.now() };
    if (entry.graceUntil && Date.now() < entry.graceUntil) {
        history.set(k, entry);
        await message.delete().catch(() => {});
        return;
    }
    entry.graceUntil = Date.now() + STRIKE_GRACE;   // set before any await, so messages handled in parallel see it
    entry.warns = amStrikes(db, gid, uid) + 1;   // this one is saved at the end

    // ── FIX 1: Store violation metadata so the tribunal embed can show real evidence ──
    entry.lastMessageContent = message.content?.substring(0, 1800) || '(attachment / image)';
    entry.lastViolation = violations[0]?.type || 'unknown';
    entry.lastViolationTime = Date.now();

    history.set(k, entry);
    const wc = entry.warns;
    const displayWc = Math.min(wc, 4);

    const hasMalicious = violations.some(v => v.type.includes('malicious') || v.type.includes('phishing'));
    const hasEveryoneSpam = violations.some(v => v.type.includes('everyone') || v.type.includes('here'));
    let action = 'timeout', duration = 3600000;
    if (wc === 1) { action = 'timeout'; duration = 3600000; }
    else if (wc === 2) { action = 'timeout'; duration = 86400000; }
    else if (wc === 3) { action = 'timeout'; duration = 604800000; }
    else { action = 'ban'; duration = 0; }
    if (hasMalicious && wc >= 2) { action = 'ban'; duration = 0; }
    // @everyone no longer triggers timeout — warning only

    // ── FIX 1 continued: Store action taken for tribunal context ──
    entry.lastAction = action;
    entry.lastDuration = duration;
    history.set(k, entry);

    await message.delete().catch(() => {});

    const repeatV = violations.find(v => v.channels);
    if (repeatV?.channels) {
        for (const cid of repeatV.channels) {
            if (cid === message.channel.id) continue;
            const ch = message.guild.channels.cache.get(cid);
            if (!ch) continue;
            const matching = entry.messages.filter(m => m.channelId === cid && Date.now() - m.ts <= REPEAT_WINDOW);
            for (const m of matching) {
                try { const msg = await ch.messages.fetch(m.mid).catch(() => null); if (msg) await msg.delete().catch(() => {}); }
                catch (e) {}
            }
        }
    }
    // The burst is handled: start counting from zero, or the very next message would count as spam again
    entry.messages = [];

    const member = await message.guild.members.fetch(uid).catch(() => null);
    const _L = require('../lib/botPerms').langOf({ guild: message.guild, client });
    const _t = (k, v) => require('../lib/i18n').t('automod.' + k, _L, v);
    const _n = (base, n) => _t(Number(n) === 1 ? base + 'One' : base + 'Many', { n });
    const _dur = (ms) => ms >= 86400000 ? _n('days', Math.round(ms / 86400000)) : _n('hours', Math.round(ms / 3600000));
    const _next = (wc) => _t(wc >= 4 ? 'strikeNextMax' : wc === 1 ? 'strikeNext1Day' : wc === 2 ? 'strikeNext7Days' : 'strikeNextBan');
    let actionText = _t('strikeActWarn'), actionColor = C.GREY, outcome = 'warn', whyNot = null;
    try {
        if (action === 'timeout' && member?.moderatable) {
            await member.timeout(duration, `AutoMod: ${violations[0].reason}`);
            actionText = _t('strikeActTimeout', { duration: _dur(duration) }); outcome = 'timeout';
            actionColor = duration >= 604800000 ? C.RED : C.YELLOW;
        } else if (action === 'ban' && member?.bannable) {
            await member.ban({ reason: `AutoMod: ${violations[0].reason}`, deleteMessageSeconds: 86400 });
            actionText = _t('strikeActBan'); actionColor = C.RED; outcome = 'ban';
            history.delete(k);
        } else {
            // could not punish: the member only gets a warning, the owner and the log get the reason and the fix
            whyNot = require('../lib/botPerms').whyNotActed(message.guild, member, action, message.author.username, _L);
        }
    } catch (e) {
        actionText = _t('strikeActFailed'); actionColor = C.GREY; outcome = 'failed';
        whyNot = require('../lib/botPerms').whyNotActed(message.guild, member, action, message.author.username, _L, e);
    }

    // ── FIX 2: DM to user now includes an "Appeal This Action" button ──
    try {
        const appealContact = message.guild.ownerId ? `<@${message.guild.ownerId}>` : _t('strikeContactFallback');
        const actionEmoji = outcome === 'ban' ? (resolveEmoji('banAlert', client) || '🔨') : outcome === 'timeout' ? (resolveEmoji('lock', client) || '⏳') : (resolveEmoji('warning', client) || em('ic_warn', '⚠️'));
        const strikeNext = _next(displayWc);
        const _v2 = require('../lib/games/v2');
        const _E  = require('../config/emojis');

        // Header emoji + translated title (lang keys kept, string interpolation preserved)
        const _titleKey = outcome === 'ban' ? 'strikeDmTitleBan' : outcome === 'timeout' ? 'strikeDmTitleTimeout' : 'strikeDmTitleWarn';
        const _titleText = _t(_titleKey);

        // Reuse the existing strikeDmDesc but strip emoji + title (they go in the header)
        const _body = _t('strikeDmDesc', {
            emoji: '',
            title: '',
            rule: ruleName(violations[0], _t),
            violation: ruleReason(violations[0], _t),
            action: (outcome === 'timeout' || outcome === 'ban') ? actionText : _t('strikeMemberWarn'),
            bar: strikeBar(displayWc),
            n: displayWc,
            next: strikeNext,
            contact: appealContact,
        }).replace(/^\s*[\n\r]+/, '').replace(/\n{3,}/g, '\n\n').trim();

        const appealRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`automod_appeal_${uid}_${gid}`)
                .setLabel(_t('strikeBtnAppeal'))
                .setEmoji(iconObj('staff', null, '⚖️'))
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setLabel(_t('strikeBtnRules'))
                .setStyle(ButtonStyle.Link)
                .setURL((() => {
                    const _s = client.getServerSettings?.(gid) || {};
                    const _rc = _s.rulesChannel || _s.rules_channel || _s.rules;
                    return _rc ? `https://discord.com/channels/${gid}/${_rc}` : `https://discord.com/channels/${gid}`;
                })()),
        );

        const _accent = typeof actionColor === 'string' && actionColor.startsWith('#')
            ? parseInt(actionColor.slice(1), 16)
            : (typeof actionColor === 'number' ? actionColor : 0x2F3136);
        // Member card: one plain sentence about what happened, their message quoted, the strike ladder once.
        const _E2 = require('../config/emojis');
        const _titleTxt = outcome === 'ban' ? _t('cardTitleBan', { server: message.guild.name })
            : outcome === 'timeout' ? _t('cardTitleTimeout', { duration: _dur(duration), server: message.guild.name })
            : _t('cardTitleWarn', { server: message.guild.name });
        const _whyKey = 'why_human_' + _slug(violations[0]?.type);
        const _whyHuman = _usable(_t(_whyKey), _whyKey, ruleReason(violations[0], _t));
        const _quote = (message.content || '').trim().slice(0, 300);
        const _dots = [0, 1, 2, 3].map(i => i < displayWc ? (i === 3 ? (_E2.dot_red || '🔴') : (_E2.dot_yellow || '🟡')) : (_E2.dot_white || '⚪')).join(' ');
        const _items = [
            { text: `## ${_titleTxt}` },
            { text: _whyHuman },
        ];
        if (_quote) _items.push({ text: _quote.split('\n').slice(0, 4).map(l => `> ${l}`).join('\n') });
        _items.push({ rule: true });
        _items.push({ text: `${_dots}\n-# ${_t('cardLadder')}` });
        _items.push({ text: `-# ${_t('cardClears')} ${_t('cardContact', { contact: appealContact })}` });
        _items.push({ row: appealRow });
        _items.push({ text: `-# ${_E2.eagle || '🦅'} ARCHON CG-223` });
        const _card = _v2.card(_accent, _items);

        await message.author.send({ ..._card }).catch((e) => {
            console.error(`[AUTOMOD DM] send failed for ${message.author.tag}: ${e.message}`);
        });
    } catch (e) {
        console.error(`[AUTOMOD DM] card build failed for ${message.author.tag}: ${e.message}`);
    }

    try {
        const notif = await message.channel.send(toV2({
            embeds: [new EmbedBuilder()
                .setColor(actionColor)
                .setDescription(_t('strikeNotice', { emoji: '🛡️', user: message.author.username, rule: ruleName(violations[0], _t) }))]
        })).catch(() => {});
        if (notif) setTimeout(() => notif.delete().catch(() => {}), 10000);
    } catch (e) {}

    const settings = client.getServerSettings?.(gid) || {};
    const logId = settings.autoModLogChannel || settings.automodlog || settings.modlog || settings.log;
    if (logId) {
        const logCh = message.guild.channels.cache.get(logId);
        if (logCh && require('../lib/canPost').log(message.guild, logCh, message.guild.members.me, 'automod-log').ok) {
            const bar = strikeBar(displayWc);
            const next = _next(displayWc);
            const _v2 = require('../lib/games/v2');
            const _E  = require('../config/emojis');

            const _extra = [];
            if (repeatV?.channels?.length > 1) _extra.push(`**${_t('strikeLabelCross')}** · ${repeatV.channels.map(c => `<#${c}>`).join(' ')}`);
            if (whyNot) _extra.push(`**${_t('strikeLabelWhy')}** · ${whyNot}`);

            // One compact entry per action, so a busy day stays readable
            const _E3 = require('../config/emojis');
            const _ico = outcome === 'ban' ? (_E3.ic_ban || '🔨') : outcome === 'timeout' ? (_E3.ic_wait || '⏳') : (_E3.ic_warn || '⚠️');
            const _q = (message.content || '').trim().slice(0, 200).split('\n')[0];
            const _logItems = [
                { text: `${_ico} <t:${Math.floor(Date.now() / 1000)}:t> · ${message.author} · **${actionText}** · ${ruleName(violations[0], _t)} · <#${message.channel.id}> · ${_t('logStrike', { n: displayWc })}` },
            ];
            if (_q) _logItems.push({ text: `> ${_q}` });
            if (_extra.length) _logItems.push({ text: _extra.join('\n') });

            const _logCard = _v2.card((typeof actionColor === 'string' && actionColor.startsWith('#') ? parseInt(actionColor.slice(1), 16) : (typeof actionColor === 'number' ? actionColor : 0x2F3136)), _logItems);
            await logCh.send({ ..._logCard }).catch(() => {});
        }
    }

    try {
        // Bans always reach the owner. "I couldn't act" reaches them once per hour per server, not on every message.
        const _whyKey = `${gid}:whyNot`, _lastWhy = _ownerPings.get(_whyKey) || 0;
        const _ping = outcome === 'ban' || (whyNot && Date.now() - _lastWhy > 3600000);
        const owner = _ping ? await message.guild.fetchOwner().catch(() => null) : null;
        if (owner && !owner.user.bot) {
            if (outcome !== 'ban') _ownerPings.set(_whyKey, Date.now());
            const _v2 = require('../lib/games/v2');
            const _accent = typeof actionColor === 'string' && actionColor.startsWith('#') ? parseInt(actionColor.slice(1), 16) : (typeof actionColor === 'number' ? actionColor : 0x2F3136);
            const _dmItems = [
                { text: `*${_t('strikeOwnerAuthor')}*` },
                { text: `## ${actionText}` },
                { text: _t('strikeOwnerDesc', { server: message.guild.name }) },
                { rule: true },
                { text: `**${_t('strikeLabelMember')}** · ${message.author} (\`${uid}\`)\n**${_t('strikeLabelRule')}** · ${ruleName(violations[0], _t)}\n**${_t('strikeLabelChannel')}** · <#${message.channel.id}>\n**${_t('strikeLabelStrike')}** · ${displayWc}/4` },
                { text: `**${_t('strikeLabelMessage')}**\n\`\`\`${message.content.substring(0, 1800) || _t('strikeAttachment')}\`\`\`` }
            ];
            if (whyNot) _dmItems.push({ text: `**${_t('strikeLabelWhy')}** · ${whyNot}` });
            _dmItems.push({ text: `-# ${_t('strikeOwnerFooter')}` });
            await owner.send(_v2.card(_accent, _dmItems)).catch(() => {});
        }
    } catch (e) {}

    try { db.prepare(`INSERT INTO moderation_logs (guild_id,user_id,moderator_id,action,reason,timestamp) VALUES (?,?,?,?,?,?)`).run(gid, uid, client.user.id, (outcome === 'ban' || outcome === 'timeout') ? outcome : 'warn', `AutoMod: ${violations[0].reason}`, Math.floor(Date.now() / 1000)); } catch (e) {}   // what really happened, not what was planned
    try { db.prepare(`INSERT INTO warnings (id,guild_id,user_id,moderator_id,reason,expires_at,active) VALUES (?,?,?,?,?,?,1)`).run(`AM-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`, gid, uid, client.user.id, `AutoMod: ${violations[0].reason}`, Math.floor(Date.now()/1000)+2592000); } catch (e) {}

    const cc = repeatV ? '[CROSS] ' : '';
    console.log(`[AUTOMOD] ${cc}${action.toUpperCase()} | ${message.author.tag} | ${violations.map(v=>v.type).join(', ')} | Strike ${displayWc}/4`);
}

// ── Advanced AutoMod is a Premium feature: image spam, attachment-only spam and @everyone-with-attachments detection ──
// Premium is looked up at most once a minute per server (a purchase or an expiry takes up to a minute to apply).
const _advCache = new Map();   // guildId -> { on, ts }
function advancedAutomodOn(db, gid) {
    const c = _advCache.get(gid), now = Date.now();
    if (c && now - c.ts < 60000) return c.on;
    let on = false;
    try { on = !!require('./premium.js').isPremium(db, gid); } catch (e) { on = false; }
    _advCache.set(gid, { on, ts: now });
    return on;
}

async function scanMessage(message, client, db) {
    if (!message.guild || message.author.bot || message.webhookId) return false;
    if (!_migrated) { _migrated = true; migrateFilterSettings(db); migrateIgnoredChannels(db); loadState(db); client.settings?.clear?.(); }
    const ss = client.getServerSettings?.(message.guild.id);
    if (!ss?.autoModEnabled) return false;
    const member = message.member;
    // Skip owner and elevated users entirely
    if (message.guild.ownerId === message.author.id) return false;
    if (isElevated(member)) return false;
    if (ss.autoModWhitelist) {
        const wl = ss.autoModWhitelist.split(',');
        if (wl.some(rid => member?.roles.cache.has(rid))) return false;
    }
    // ignored channels (and threads inside them): no check at all, no strike, no warning
    const ignored = ignoredChannels(ss);
    if (ignored.length && (ignored.includes(message.channel.id) || (message.channel.isThread?.() && ignored.includes(message.channel.parentId)))) return false;

    const uid = message.author.id, gid = message.guild.id;
    const k = key(uid, gid), now = Date.now();
    const advanced = advancedAutomodOn(db, gid);   // Premium: image spam, attachment spam, @everyone spam
    if (!history.has(k)) history.set(k, { messages: [], warns: 0, last: now });
    const entry = history.get(k);
    entry.last = now;

    const record = { ts: now, content: message.content, channelId: message.channel.id, mid: message.id, hasLinks: HAS_LINK_RE.test(message.content), norm: normalize(message.content), attachments: message.attachments.size };
    entry.messages.push(record);
    const cutoff = now - 120000;
    while (entry.messages.length && entry.messages[0].ts < cutoff) entry.messages.shift();
    if (entry.messages.length > MAX_HISTORY) entry.messages = entry.messages.slice(-80);

    const h = entry.messages;
    const recent = h.filter(m => now - m.ts <= SPAM_WINDOW);
    const violations = [];
    const seen = new Set();
    const spamLimit = clampInt(ss?.spamThreshold, 3, 15, SPAM_THRESHOLD);
    const mentionLimit = clampInt(ss?.mentionLimit, 3, 20, MENTION_LIMIT);


    // 1. Message spam (same channel)
    if (recent.filter(m => m.channelId === message.channel.id).length >= spamLimit && !seen.has('spam')) {
        violations.push({ type: 'message spam', reason: `${spamLimit}+ messages in ${SPAM_WINDOW/1000}s`, source: 'spam' });
        seen.add('spam');
    }

    // 2. Caps flood
    if (message.content.length > 15) {
        const letters = (message.content.match(/[A-Za-z]/g) || []).length;
        const caps = (message.content.match(/[A-Z]/g) || []).length;
        if (letters >= 15 && caps / letters > CAPS_RATIO && !seen.has('caps')) {
            violations.push({ type: 'caps flood', reason: `${Math.round(caps/letters*100)}% uppercase`, source: 'caps' });
            seen.add('caps');
        }
    }

    // 3. Emoji flood
    if (message.content.length > 20) {
        const emojis = (message.content.match(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu) || []).length;
        const nonSpace = message.content.replace(/\s/g, '').length || 1;
        if (emojis >= 8 && emojis / nonSpace > EMOJI_RATIO && !seen.has('emoji')) {
            violations.push({ type: 'emoji flood', reason: `${emojis} emoji (${Math.round(emojis/nonSpace*100)}%)`, source: 'emoji' });
            seen.add('emoji');
        }
    }

    // 4. Mass mention — exclude bots, owner, and admin/mod role mentions
    const mentionedUsers = message.mentions.users.filter(u => !u.bot);
    const guild = message.guild;
    const ownerId = guild.ownerId;
    const filteredUsers = mentionedUsers.filter(u => u.id !== ownerId && u.id !== message.author.id);
    // Filter out admin/mod roles
    const filteredRoles = message.mentions.roles.filter(r => {
        const perms = r.permissions;
        return !perms.has(PermissionsBitField.Flags.Administrator) &&
               !perms.has(PermissionsBitField.Flags.ManageGuild) &&
               !perms.has(PermissionsBitField.Flags.ModerateMembers) &&
               !perms.has(PermissionsBitField.Flags.ManageMessages);
    });
    const everyoneCount = (message.content.match(/@here|@everyone/g) || []).length;
    const mentions = filteredUsers.size + filteredRoles.size + everyoneCount;
    if (mentions > mentionLimit && !seen.has('mention')) {
        violations.push({ type: 'mass mention', reason: `${mentions} mentions`, source: 'mention' });
        seen.add('mention');
    }

    // ── FIX 3: @everyone/@here — only flag when combined with 2+ attachments (spam pattern) ──
    if (advanced && !seen.has('everyone')) {
        const hasEveryoneText = message.content.includes('@everyone') || message.content.includes('@here');
        const hasEveryoneResolved = message.mentions.everyone === true;
        const hasEveryone = hasEveryoneText || hasEveryoneResolved;
        const attachmentCount = message.attachments.size;

        // Only flag if @everyone + 2 or more images/attachments = spam pattern
        if (hasEveryone && attachmentCount >= 2 && !isElevated(member)) {
            const lastEveryone = everyoneCooldowns.get(gid) || 0;
            if (now - lastEveryone > EVERYONE_COOLDOWN) {
                everyoneCooldowns.set(gid, now);
                violations.push({ type: 'everyone/here spam', reason: '@everyone with mass attachments', source: 'everyone' });
                seen.add('everyone');
            } else {
                violations.push({ type: 'rapid everyone spam', reason: 'Repeated @everyone spam with attachments', source: 'everyone' });
                seen.add('everyone');
            }
        }
    }

    // 5. @here/@everyone + link
    // Only for links outside the allowed sites: @everyone with a YouTube link used to cost a strike too
    if ((message.content.includes('@here') || message.content.includes('@everyone') || message.mentions.everyone) && record.hasLinks && !seen.has('promo')
        && !isDomainWhitelisted(message.content, parseDomainWhitelist(ss?.autoModDomains))) {
        violations.push({ type: 'promotional spam', reason: '@here/@everyone + external link', source: 'promo', crossChannel: true });
        seen.add('promo');
    }

    // 6. Malicious links, then invites (an invite needs no https:// to work, so it is checked on every message)
    const mal = record.hasLinks && (MALICIOUS.some(p => p.test(message.content)) || fakeDiscordLink(message.content));
    const inv = message.content.match(INVITE_RE);
    if (mal && !seen.has('malicious')) { violations.push({ type: 'malicious link', reason: 'Phishing/scam URL detected', source: 'malicious' }); seen.add('malicious'); }
    else if (inv?.length && ss?.inviteFilterEnabled && !seen.has('invite')) { violations.push({ type: 'unauthorized invite', reason: 'External Discord invite', source: 'invite' }); seen.add('invite'); }

    // 7. Global link blocker
    if (ss?.linkFilterEnabled && record.hasLinks && !seen.has('malicious') && !seen.has('invite') && !seen.has('global_link')) {
        if (!isElevated(member)) {
            const customDomains = parseDomainWhitelist(ss?.autoModDomains);
            if (!isDomainWhitelisted(message.content, customDomains)) {
                violations.push({ type: 'unauthorized link', reason: 'Link domain not permitted', source: 'global_link' });
                seen.add('global_link');
            }
        }
    }

    // ── Image/attachment spam ──
    if (advanced && !seen.has('image_spam')) {
        const imageRecent = h.filter(m =>
            now - m.ts <= IMAGE_SPAM_WINDOW &&
            m.channelId === message.channel.id &&
            m.attachments > 0
        );
        const totalImages = imageRecent.reduce((sum, m) => sum + m.attachments, 0);

        // ── FIX 5: Also catch a single message that contains multiple attachments ──
        const singleMsgImages = message.attachments.size;

        if (totalImages >= IMAGE_SPAM_LIMIT || singleMsgImages >= IMAGE_SPAM_LIMIT) {
            violations.push({ type: 'image spam', reason: `${Math.max(totalImages, singleMsgImages)} images in ${IMAGE_SPAM_WINDOW/1000}s`, source: 'image_spam' });
            seen.add('image_spam');
        }
    }

    // ── Attachment-only spam ──
    if (advanced && !seen.has('attachment_spam') && message.attachments.size > 0) {
        const textContent = message.content.trim();
        const hasOnlyMentions = textContent.length > 0 && /^[@<>:!&\s\d]+$/.test(textContent);
        if (textContent.length === 0 || hasOnlyMentions) {
            const attachmentRecent = h.filter(m =>
                now - m.ts <= IMAGE_SPAM_WINDOW &&
                m.channelId === message.channel.id &&
                m.attachments > 0 &&
                (m.content.trim().length === 0 || /^[@<>:!&\s\d]+$/.test(m.content.trim()))
            );
            if (attachmentRecent.length >= 2) {
                violations.push({ type: 'attachment spam', reason: 'Multiple image-only posts', source: 'attachment_spam' });
                seen.add('attachment_spam');
            }
        }
    }

    // 8. Cross-channel duplicate
    const crossRecent = h.filter(m => now - m.ts <= REPEAT_WINDOW);
    if (!seen.has('repeat')) {
        const contentMap = new Map();
        for (const m of crossRecent) { if (m.norm.length < 5) continue; if (!contentMap.has(m.norm)) contentMap.set(m.norm, new Set()); contentMap.get(m.norm).add(m.channelId); }
        for (const [norm, channels] of contentMap) {
            if (channels.size >= 2) {
                const hasLinks = /https?:\/\//i.test(norm);
                const thresh = hasLinks ? 2 : 3;
                if (channels.size >= thresh) { violations.push({ type: 'cross-channel spam', reason: `Same message in ${channels.size} channels${hasLinks ? ' (contains links)' : ''}`, source: 'repeat', crossChannel: true, channels: [...channels] }); seen.add('repeat'); break; }
            }
        }
    }

    // 9. Rapid fire across channels
    if (!seen.has('rapid')) {
        const rapid = h.filter(m => now - m.ts <= SPAM_WINDOW);
        if (rapid.length >= 3) { const uc = new Set(rapid.map(m => m.channelId)); if (uc.size >= 2) { violations.push({ type: 'rapid fire', reason: `${rapid.length} messages across ${uc.size} channels in ${SPAM_WINDOW/1000}s`, source: 'rapid', crossChannel: true, channels: [...uc] }); seen.add('rapid'); } }
    }

    // 10. AI toxicity (Premium). It runs in the background: the message handler used to wait for the AI (up to 5 s)
    // before any command or XP was processed, so every command felt slow on Premium servers. Commands are not sent to it.
    const _prefix = ss?.prefix || '.';
    if (violations.length === 0 && message.content.length > 10 && !message.content.startsWith(_prefix) && require('./premium.js').isPremium(db, message.guild?.id)) {
        checkToxicity(message.content).then((ai) => {
            if (ai?.toxic) return takeAction(message, [{ type: ai.type || 'toxic content', reason: ai.reason || 'AI detected', source: 'ai' }], client, db);
        }).catch((e) => console.error('[AUTOMOD] AI check failed:', e.message));
    }

    if (violations.length > 0) {
        await takeAction(message, violations, client, db);
        return true;
    }
    return false;
}

// Servers where this person still has an active AutoMod strike. Read from the database: banned members
// can't be fetched as members (they used to get "you're all clear"), and it no longer fetches every server.
function strikeGuilds(client, uid) {
    try {
        return client.db.prepare("SELECT guild_id, COUNT(*) AS n FROM warnings WHERE user_id = ? AND id LIKE 'AM-%' AND active = 1 AND (expires_at IS NULL OR expires_at > strftime('%s','now')) GROUP BY guild_id").all(String(uid))
            .map((r) => ({ guild: client.guilds.cache.get(r.guild_id), warns: Math.min(r.n, 4) }))
            .filter((a) => a.guild);
    } catch { return []; }
}

function userLang(user) {
    const u = String(user?.locale || '').toLowerCase();
    for (const l of ['en', 'fr', 'zh', 'ar']) if (u.startsWith(l)) return l;
    return 'en';
}

function _note(color, title, desc) {
    return toV2({ embeds: [new EmbedBuilder().setColor(color).setTitle(title).setDescription(desc)] });
}

// Sends one appeal to the server owner (DM, then log channel, then the /automod appeals queue).
// Used by the DM text ("appeal Server | words") and by the Appeal button on the strike card.
async function submitAppeal(client, user, targetGuild, reason, lang) {
    loadState(client.db);
    const _tU = (k, v) => require('../lib/i18n').t('automod.' + k, lang, v);
    const _gl = (() => { try { return require('../lib/botPerms').langOf({ guild: targetGuild, client }); } catch { return lang; } })();
    const _tS = (k, v) => require('../lib/i18n').t('automod.' + k, _gl, v);
    const now = Date.now();

    const banUntil = appealCooldowns.get(`ban:${user.id}:${targetGuild.id}`);
    if (banUntil && now < banUntil) {
        const d = Math.ceil((banUntil - now) / 86400000);
        return _note(C.DARK, _tU('appeal_bannedTitle'), _tU('appeal_bannedDesc', { server: targetGuild.name, days: _tU(d === 1 ? 'daysOne' : 'daysMany', { n: d }) }));
    }
    const cdKey = `${user.id}:${targetGuild.id}`;
    const lastAppeal = appealCooldowns.get(cdKey);
    if (lastAppeal && now - lastAppeal < APPEAL_COOLDOWN) {
        const h = Math.ceil((APPEAL_COOLDOWN - (now - lastAppeal)) / 3600000);
        return _note(C.YELLOW, _tU('appeal_cooldownTitle'), _tU('appeal_cooldownDesc', { server: targetGuild.name, hours: _tU(h === 1 ? 'hoursOne' : 'hoursMany', { n: h }) }));
    }

    try {
        const owner = await targetGuild.fetchOwner().catch(() => null);
        const entry = history.get(key(user.id, targetGuild.id));
        const evidence = entry?.lastMessageContent || '*(content unavailable)*';
        const violationType = entry?.lastViolation || 'unknown';
        const violationTime = entry?.lastViolationTime ? `<t:${Math.floor(entry.lastViolationTime / 1000)}:R>` : '—';

        const appealId = `AP-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`appeal_approve_${appealId}`).setLabel(_tS('appeal_btnApprove')).setEmoji(icon('ok')).setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`appeal_reject_${appealId}`).setLabel(_tS('appeal_btnReject')).setEmoji(icon('no')).setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`appeal_ban_${appealId}`).setLabel(_tS('appeal_btnBan')).setEmoji(iconObj('ic_ban', null, '🔨')).setStyle(ButtonStyle.Secondary)
        );
        const _tn = (k, n) => _tS(Number(n) === 1 ? k + 'One' : k + 'Many', { n });
        const _dur = (ms) => ms >= 86400000 ? _tn('days', Math.round(ms / 86400000)) : _tn('hours', Math.round(ms / 3600000));
        const _v2 = require('../lib/games/v2');
        const strikes = Math.min(amStrikes(client.db, targetGuild.id, user.id) || 1, 4);
        const facts = [
            violationType === 'unknown' ? null : ruleName({ type: violationType }, _tS),
            entry?.lastViolationTime ? violationTime : null,
            entry?.lastAction ? (entry.lastAction === 'ban' ? _tS('strikeActBan') : _tS('tb_timedOut', { duration: _dur(entry.lastDuration) })) : null,
        ].filter(Boolean).join(' · ');
        const tribunal = (mention) => {
            const items = [];
            if (mention) items.push({ text: mention });
            items.push({ thumbnail: [`### ${_tS('tb_title', { user: user.username })}\n-# ${_tS('tb_sub', { server: targetGuild.name, n: strikes })}`, user.displayAvatarURL({ size: 128 })] });
            items.push({ rule: true });
            items.push({ text: String(reason).split('\n').slice(0, 6).map((l) => `> ${l}`).join('\n') });
            if (facts) items.push({ text: `-# ${facts}` });
            if (entry?.lastMessageContent) items.push({ text: `\`\`\`${evidence.replace(/`/g, "'").substring(0, 600)}\`\`\`` });
            items.push({ row });
            items.push({ text: `-# ${_tS('tb_expires', { when: `<t:${Math.floor((now + 7 * 86400000) / 1000)}:R>` })}` });
            return { ..._v2.card(C.BLURPLE, items), allowedMentions: { users: owner ? [owner.id] : [] } };
        };

        let sent = null, deliveryMethod = 'queued';
        if (owner && !owner.user.bot) {
            sent = await owner.send(tribunal()).catch(() => null);
            if (sent) deliveryMethod = 'dm';
        }
        if (!sent) {
            const settings = client.getServerSettings?.(targetGuild.id) || {};
            const logId = settings.autoModLogChannel || settings.automodlog || settings.modlog;
            const logCh = logId ? targetGuild.channels.cache.get(logId) : null;
            if (logCh && require('../lib/canPost').log(targetGuild, logCh, targetGuild.members.me, 'automod-appeals').ok) {
                sent = await logCh.send(tribunal(owner ? `<@${owner.id}>` : null)).catch(() => null);
                if (sent) deliveryMethod = 'log_channel';
            }
        }
        appealTribunal.set(appealId, {
            guildId: targetGuild.id, userId: user.id, ownerId: owner?.id || targetGuild.ownerId || null,
            status: 'pending', messageId: sent?.id || null, channelId: sent?.channel?.id || null,
            expiresAt: now + 7 * 86400000, reason, deliveryMethod, userTag: user.tag, evidence, violationType,
        });
        appealCooldowns.set(cdKey, now);

        const desc = deliveryMethod === 'dm' ? _tU('appeal_submittedDescDm', { server: targetGuild.name })
            : deliveryMethod === 'log_channel' ? _tU('appeal_submittedDescLog', { server: targetGuild.name })
            : _tU('appeal_submittedDescQueued', { server: targetGuild.name });
        return _note(deliveryMethod === 'queued' ? C.YELLOW : C.GREEN,
            _tU(deliveryMethod === 'queued' ? 'appeal_queuedTitle' : 'appeal_submittedTitle', deliveryMethod === 'queued' ? {} : { emoji: require('../config/emojis').success || em('ic_ok', '✅') }),
            desc + '\n\n' + _tU('appeal_submittedFooter'));
    } catch (e) {
        console.error('[AUTOMOD APPEAL] submit failed:', e.message);
        return _note(C.RED, _tU('appeal_failedTitle'), _tU('appeal_failedDesc'));
    }
}

async function handleAppeal(message, client) {
    if (message.guild) return;
    if (message.author.bot) return;

    const content = message.content.trim();
    const lower = content.toLowerCase();
    const lang = userLang(message.author);
    const _t0 = (k, v) => require('../lib/i18n').t('automod.' + k, lang, v);

    if (lower === 'appeal' || lower === 'help') {
        const appeals = strikeGuilds(client, message.author.id);
        if (appeals.length === 0) return message.reply(_note(C.GREY, _t0('appeal_noStrikesTitle'), _t0('appeal_noStrikesDesc'))).catch(() => {});

        const _v2 = require('../lib/games/v2');
        const items = [
            { text: `## ${_t0('appeal_listTitle')}` },
            { text: _t0('appeal_listDesc') },
            { rule: true },
        ];
        for (const a of appeals.slice(0, 5)) {
            items.push({ text: `**${a.guild.name}**\n${_t0('appeal_listLine', { n: a.warns, contact: `<@${a.guild.ownerId}>` })}` });
        }
        items.push({ rule: true });
        items.push({ text: `**${_t0('appeal_listFieldName')}**\n${_t0('appeal_listFieldValue')}` });
        return message.reply({ ..._v2.card(C.YELLOW, items), allowedMentions: { parse: [] } }).catch(() => {});
    }

    if (!lower.startsWith('appeal ')) return;
    const body = content.substring(7).trim();
    const pipeIdx = body.indexOf('|');
    let serverName, reason, usedFallback = false;
    if (pipeIdx !== -1) {
        serverName = body.substring(0, pipeIdx).trim();
        reason = body.substring(pipeIdx + 1).trim();
    } else {
        usedFallback = true;
        const parts = body.split(' ');
        serverName = parts[0];
        reason = parts.slice(1).join(' ');
    }
    reason = (reason || '').slice(0, 500) || '—';
    if (!serverName) return message.reply(_note(C.RED, _t0('appeal_missingServerTitle'), _t0('appeal_missingServerDesc'))).catch(() => {});

    // Only servers where this person has a strike: anyone could send appeals to any server's owner before
    const mine = strikeGuilds(client, message.author.id).map((a) => a.guild);
    const q = serverName.toLowerCase();
    const targetGuild = mine.find((g) => g.name.toLowerCase() === q) || mine.find((g) => g.name.toLowerCase().includes(q));

    if (!targetGuild && usedFallback && body.split(' ').length > 1) return message.reply(_note(C.RED, _t0('appeal_ambiguousTitle'), _t0('appeal_ambiguousDesc'))).catch(() => {});
    if (!targetGuild) return message.reply(_note(C.RED, _t0('appeal_notFoundTitle'), _t0('appeal_notFoundDesc', { name: serverName }))).catch(() => {});

    return message.reply(await submitAppeal(client, message.author, targetGuild, reason, lang)).catch(() => {});
}

// The "Appeal" button on the strike card opens a form; this handles what the member sends.
// Nothing handled it before, so the button always ended in "This interaction failed".
async function handleAppealModal(interaction, client) {
    if (!interaction.isModalSubmit?.() || !interaction.customId.startsWith('appeal_modal_')) return false;
    const [, , userId, guildId] = interaction.customId.split('_');
    const lang = userLang(interaction.user);
    const _t0 = (k, v) => require('../lib/i18n').t('automod.' + k, lang, v);
    if (interaction.user.id !== userId) { await interaction.reply({ content: require('../lib/i18n').t('appealNotYours', lang), flags: 1 << 6 }).catch(() => {}); return true; }
    const guild = client.guilds.cache.get(guildId);
    await interaction.deferReply().catch(() => {});
    const reason = String(interaction.fields.getTextInputValue('appeal_reason') || '').trim().slice(0, 500) || '—';
    const started = Date.now();
    const payload = guild ? await submitAppeal(client, interaction.user, guild, reason, lang) : _note(C.RED, _t0('appeal_failedTitle'), _t0('appeal_failedDesc'));
    await interaction.editReply(payload).catch(() => {});
    // sent (the cooldown was just set): the strike card's Appeal button greys out, so it can't be pressed twice
    if ((appealCooldowns.get(`${userId}:${guildId}`) || 0) >= started && interaction.message) await greyAppealButton(interaction.message, lang);
    return true;
}

// The strike card with its Appeal button disabled and labelled "Appeal sent" (the rest of the card is kept as it is)
async function greyAppealButton(message, lang) {
    const label = require('../lib/i18n').t('automod.appeal_sentBtn', lang);
    const walk = (c) => {
        const j = typeof c?.toJSON === 'function' ? c.toJSON() : c;
        if (j?.type === 2 && String(j.custom_id || '').startsWith('automod_appeal_')) return { ...j, disabled: true, label };
        if (Array.isArray(j?.components)) j.components = j.components.map(walk);
        return j;
    };
    try { await message.edit({ components: (message.components || []).map(walk) }); }
    catch (e) { console.log('[APPEAL] could not grey the button:', e.message); }
}

// The Appeal button: an appeal already sent (or appeals paused) answers at once and greys the button, without the form
function appealBlocked(client, user, guildId) {
    const now = Date.now();
    const lang = userLang(user);
    const T = (k, v) => require('../lib/i18n').t('automod.' + k, lang, v);
    const server = client.guilds.cache.get(String(guildId))?.name || '?';
    const banUntil = appealCooldowns.get(`ban:${user.id}:${guildId}`);
    if (banUntil && now < banUntil) {
        const d = Math.ceil((banUntil - now) / 86400000);
        return { lang, text: `**${T('appeal_bannedTitle')}**\n${T('appeal_bannedDesc', { server, days: T(d === 1 ? 'daysOne' : 'daysMany', { n: d }) })}` };
    }
    const last = appealCooldowns.get(`${user.id}:${guildId}`);
    if (last && now - last < APPEAL_COOLDOWN) {
        const h = Math.ceil((APPEAL_COOLDOWN - (now - last)) / 3600000);
        return { lang, text: `**${T('appeal_cooldownTitle')}**\n${T('appeal_cooldownDesc', { server, hours: T(h === 1 ? 'hoursOne' : 'hoursMany', { n: h }) })}` };
    }
    return null;
}

// The form itself, in the member's language
function appealModal(userId, guildId, user) {
    const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
    const lang = userLang(user);
    const t = (k) => require('../lib/i18n').t('automod.' + k, lang);
    return new ModalBuilder()
        .setCustomId(`appeal_modal_${userId}_${guildId}`)
        .setTitle(t('appeal_modalTitle').slice(0, 45))
        .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder()
            .setCustomId('appeal_reason')
            .setLabel(t('appeal_modalLabel').slice(0, 45))
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMinLength(10)
            .setMaxLength(500)
            .setPlaceholder(t('appeal_modalPlaceholder').slice(0, 100))));
}

// ═══════════════════════════════════════════════════════
//  STATUS CARD (Components V2) — build once, use for slash + prefix
// ═══════════════════════════════════════════════════════
// One line about Discord's own AutoMod rules (lib/native-automod.js status), for the status card
function nativeLine(st, on, _T) {
    if (!on) return _T('native_statusOff');
    if (!st.canManage) return _T('native_statusNoPerm');
    const n = (k) => st.rules.filter((r) => r.state === k).length;
    const parts = [_T('native_statusOn', { n: n('on') })];
    if (n('covered')) parts.push(_T('native_statusCovered', { n: n('covered') }));
    if (n('full')) parts.push(_T('native_statusFull', { n: n('full') }));
    if (n('missing')) parts.push(_T('native_statusMissing', { n: n('missing') }));
    return parts.join(' · ');
}

// What AutoMod did on this server in the last 7 days (its own actions and Discord's rules), most frequent first
function weekActivity(client, guildId) {
    try {
        const since = Math.floor(Date.now() / 1000) - 7 * 86400;
        const rows = client.db.prepare("SELECT reason FROM moderation_logs WHERE guild_id = ? AND moderator_id = ? AND timestamp >= ? AND (reason LIKE 'AutoMod:%' OR reason LIKE 'Discord AutoMod:%')")
            .all(guildId, client.user.id, since);
        const by = new Map();
        for (const r of rows) {
            const k = String(r.reason).startsWith('Discord AutoMod:') ? '__native' : typeFromReason(r.reason);
            by.set(k, (by.get(k) || 0) + 1);
        }
        return { total: rows.length, top: [...by].sort((a, b) => b[1] - a[1]).slice(0, 3) };
    } catch { return { total: 0, top: [] }; }
}

// The /automod card. Off: what it does and one button to turn it on. On: what it did this week, what it watches,
// and its settings as Discord menus (log channel, exempt roles, ignored channels). Lines and buttons only show
// when they apply. Its buttons are routed by id (automod_status_* / automod_select_*), so they work after a restart.
function buildStatusCard(client, guild, ss, opts = {}) {
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType } = require('discord.js');
    const _L = require('../lib/botPerms').langOf({ guild, client });
    const _T = (k, v) => require('../lib/i18n').t('automod.' + k, _L, v);
    const on = !!ss?.autoModEnabled;
    const pending = formatPendingAppeals(guild.id).length;
    const dashBtn = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(_T('card_btnDashboard')).setURL(`https://archon223.com/dashboard/${guild.id}`);
    const appealsBtn = () => new ButtonBuilder().setCustomId('automod_status_appeals').setLabel(_T('admin_btnAppeals')).setEmoji(iconObj('staff', null, '⚖️')).setStyle(ButtonStyle.Secondary);

    if (!on) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('automod_status_enable').setLabel(_T('admin_btnEnable')).setEmoji(icon('ok')).setStyle(ButtonStyle.Success),
            ...(pending ? [appealsBtn()] : []),
            dashBtn,
        );
        const view = v2card(0x95a5a6, [
            { text: `## ${ui.em('automod', '🛡️')} ${_T('card_offTitle')}\n${_T('card_offBody')}` },
            ...(pending ? [{ text: `-# ${_T(pending === 1 ? 'card_appealsOne' : 'card_appeals', { n: pending })}` }] : []),
            { row },
        ]);
        return { ...view, flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral };
    }

    if (client.db) migrateIgnoredChannels(client.db);
    const channelsNotice = client.db ? takeChannelsNotice(client.db, guild.id) : false;
    const logId = resolveSetting(ss, 'autoModLogChannel', 'automodlog', 'modlog', 'log');
    const exempt = String(ss?.autoModWhitelist || '').split(',').map((r) => r.trim()).filter((r) => r && guild.roles.cache.has(r));
    const ignored = ignoredChannels(ss).filter((c) => guild.channels.cache.has(c));
    const domains = parseDomainWhitelist(ss?.autoModDomains);
    const week = weekActivity(client, guild.id);

    // this week
    const weekText = week.total
        ? `${_T(week.total === 1 ? 'card_weekOne' : 'card_week', { n: week.total })}\n-# ${_T('card_weekTop', {
            list: week.top.map(([k, n]) => `${k === '__native' ? _T('native_statusLabel') : ruleName({ type: k }, _T)} ${n}`).join(' · ') })}`
        : `-# ${_T('card_weekNone')}`;

    // what it watches
    const watch = [
        ss?.linkFilterEnabled
            ? `**${_T('card_linksLabel')}** · ${_T(domains.length ? 'card_linksOnPlus' : 'card_linksOn', { n: domains.length })}`
            : `**${_T('card_linksLabel')}** · ${_T('card_linksOff')}`,
        ...(ss?.inviteFilterEnabled ? [`**${_T('card_invitesLabel')}** · ${_T('card_invitesOn')}`] : []),
        ...(opts.native ? [`**${_T('native_statusLabel')}** · ${nativeLine(opts.native, on, _T)}`] : []),
    ].join('\n');

    const textTypes = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
    const logSel = new ChannelSelectMenuBuilder().setCustomId('automod_select_logch').setPlaceholder(_T('card_logPick'))
        .setChannelTypes(textTypes).setMinValues(0).setMaxValues(1);
    if (logId && guild.channels.cache.has(String(logId))) logSel.setDefaultChannels(String(logId));
    const exemptSel = new RoleSelectMenuBuilder().setCustomId('automod_select_exempt').setPlaceholder(_T('card_exemptPick')).setMinValues(0).setMaxValues(20);
    if (exempt.length) exemptSel.setDefaultRoles(...exempt.slice(0, 20));
    const ignoreSel = new ChannelSelectMenuBuilder().setCustomId('automod_select_ignore').setPlaceholder(_T('card_ignorePick'))
        .setChannelTypes([...textTypes, ChannelType.GuildForum, ChannelType.GuildVoice]).setMinValues(0).setMaxValues(25);
    if (ignored.length) ignoreSel.setDefaultChannels(...ignored.slice(0, 25));

    const buttons = new ActionRowBuilder().addComponents(
        ...(ss?.linkFilterEnabled ? [new ButtonBuilder().setCustomId('automod_status_domains').setLabel(_T('admin_btnDomains')).setEmoji(icon('globe')).setStyle(ButtonStyle.Secondary)] : []),
        new ButtonBuilder().setCustomId('automod_status_raid').setLabel(_T('admin_btnRaid')).setEmoji(iconObj('shield', null, '🛡️')).setStyle(ButtonStyle.Secondary),
        ...(pending ? [appealsBtn()] : []),
        dashBtn,
        new ButtonBuilder().setCustomId('automod_status_disable').setLabel(_T('admin_btnDisable')).setEmoji(icon('no')).setStyle(ButtonStyle.Danger),
    );

    const view = v2card(0x2ecc71, [
        { text: `## ${ui.em('automod', '🛡️')} AutoMod\n-# ${_T('card_onSub')}` },
        ...(channelsNotice ? [{ text: `> ${_T('admin_channelsChanged')}` }] : []),
        { rule: true },
        { text: weekText },
        ...(pending ? [{ text: _T(pending === 1 ? 'card_appealsOne' : 'card_appeals', { n: pending }) }] : []),
        { rule: true },
        { text: watch },
        { rule: true },
        { text: `**${_T('card_logLabel')}**${logId ? '' : `\n-# ${_T('card_logNone')}`}` },
        { row: new ActionRowBuilder().addComponents(logSel) },
        { text: `**${_T('card_exemptLabel')}**\n-# ${_T('card_exemptHint')}` },
        { row: new ActionRowBuilder().addComponents(exemptSel) },
        { text: `**${_T('card_ignoreLabel')}**` },
        { row: new ActionRowBuilder().addComponents(ignoreSel) },
        { rule: true },
        { row: buttons },
    ]);
    return { ...view, flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral };
}

// The card with fresh settings and the state of Discord's own rules
async function statusView(client, guild) {
    client.settings?.delete?.(guild.id);
    const ss = client.getServerSettings(guild.id);
    const native = ss?.autoModEnabled ? await require('../lib/native-automod').status(guild).catch(() => null) : null;
    return buildStatusCard(client, guild, ss, { native });
}

// Turns AutoMod on or off (the setting, then Discord's own rules). { already } | { missing: [...] } | { ok }
async function setEnabled(client, guild, en) {
    const cur = !!client.getServerSettings(guild.id)?.autoModEnabled;
    if (en === cur) return { already: true };
    if (en) {
        const me = guild.members.me;
        const missing = ['ManageGuild', 'ManageMessages', 'ModerateMembers'].filter((p) => !me?.permissions.has(PermissionsBitField.Flags[p]));
        if (missing.length) return { missing };
    }
    client.db.prepare('INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)').run(guild.id);
    client.db.prepare("UPDATE server_settings SET automod_enabled = ?, updated_at = strftime('%s','now') WHERE guild_id = ?").run(en ? 1 : 0, guild.id);
    client.settings.delete(guild.id);
    await syncRules(guild, en ? 'create' : 'delete', client.getServerSettings(guild.id));
    return { ok: true };
}


// Split a lang string like em('ic_ok', '✅') + " Approved by X\nBody" into emoji + title + body.
function _splitOutcome(s) {
    const raw = String(s || '').trim();
    const nl = raw.indexOf('\n');
    const head = nl === -1 ? raw : raw.slice(0, nl);
    const body = nl === -1 ? '' : raw.slice(nl + 1).trim();
    // Strip leading emoji + space from the head; keep the rest as the title
    const title = head.replace(/^[^\p{L}\p{N}]+/u, '').trim();
    return { title, body };
}

// ================= TRIBUNAL BUTTON HANDLER =================
async function handleAppealButton(interaction, client) {
    if (!interaction.isButton() || !interaction.customId.startsWith('appeal_')) return false;
    const _LA = require('../lib/pick-lang').pickLang(client, interaction.guildId, interaction, interaction.user?.id);
    const _TA = (k, v) => require('../lib/i18n').t('automod.' + k, _LA, v);

    const parts = interaction.customId.split('_');
    const action = parts[1];
    const appealId = parts[2];
    loadState(client.db);
    const vote = appealTribunal.get(appealId);

    // ── Defer immediately: 15-min window, no more 3s timeouts ──
    if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate().catch(() => {});

    if (!vote) {
        return interaction.editReply(fit(interaction.message, { content: `${em('ic_warn', '⚠️')} ${_TA('appeal_expired')}`, embeds: [], components: [] })).catch(() => {});
    }
    if (vote.status !== 'pending') {
        return interaction.editReply(fit(interaction.message, { content: `${em('ic_warn', '⚠️')} ${_TA('decisionRejected')}`, embeds: [], components: [] })).catch(() => {});
    }

    // ── Permission guard: owner OR admin/mod ──
    const _perms = interaction.member?.permissions;
    const _canRule = interaction.user.id === vote.ownerId
        || _perms?.has('Administrator')
        || _perms?.has('ManageGuild')
        || _perms?.has('ManageMessages');
    if (!_canRule) {
        return interaction.editReply(fit(interaction.message, { content: `🔒 **${_TA('appeal_notYoursTitle')}**\n${_TA('appeal_notYoursDesc')}`, embeds: [], components: [] })).catch(() => {});
    }

    const guild = client.guilds.cache.get(vote.guildId);
    const targetUser = await client.users.fetch(vote.userId).catch(() => null);
    const _L = require('../lib/botPerms').langOf({ guild, client });
    const _T = (k, v) => require('../lib/i18n').t('automod.' + k, _L, v);
    const _E = require('../config/emojis');

    // ── Compute decision info ──
    let color, emojiKey, langKey, statusLabel;
    if (action === 'approve') {
        color = C.GREEN; emojiKey = 'verified'; langKey = 'decisionApproved'; statusLabel = 'approved';
    } else if (action === 'reject') {
        color = C.RED; emojiKey = 'error'; langKey = 'decisionRejected'; statusLabel = 'rejected';
    } else if (action === 'ban') {
        color = C.DARK; emojiKey = 'lock'; langKey = 'decisionBanned'; statusLabel = 'banned';
    } else {
        return false;
    }

    // ── Action-specific side effects ──
    let timeoutLifted = false, banLifted = false;
    if (action === 'approve') {
        const k = key(vote.userId, vote.guildId);
        const entry = history.get(k);
        if (entry && entry.warns > 0) { entry.warns = Math.max(0, entry.warns - 1); history.set(k, entry); }
        // An approved appeal removes the latest strike for good
        try { client.db.prepare("UPDATE warnings SET active = 0 WHERE id = (SELECT id FROM warnings WHERE guild_id = ? AND user_id = ? AND id LIKE 'AM-%' AND active = 1 ORDER BY created_at DESC LIMIT 1)").run(String(vote.guildId), String(vote.userId)); } catch {}

        if (guild) {
            try {
                const member = await guild.members.fetch(vote.userId).catch(() => null);
                if (member && member.communicationDisabledUntilTimestamp && member.communicationDisabledUntilTimestamp > Date.now()) {
                    await member.timeout(null, `Appeal approved by ${interaction.user.tag}`);
                    timeoutLifted = true;
                }
                // An approved appeal after an AutoMod ban lifts the ban (approving used to leave them banned)
                if (!member) {
                    const ban = await guild.bans.fetch(vote.userId).catch(() => null);
                    if (ban && String(ban.reason || '').startsWith('AutoMod:')) {
                        await guild.bans.remove(vote.userId, `Appeal approved by ${interaction.user.tag}`);
                        banLifted = true;
                    }
                }
            } catch (e) { console.error('[AUTOMOD APPEAL] lifting the action failed:', e.message); }
        }

        if (targetUser) {
            const _tU = (k, v) => require('../lib/i18n').t('automod.' + k, _L, v);
            const lifted = banLifted ? _tU('appeal_approvedBanLifted', { server: guild?.name || '' }) : timeoutLifted ? _tU('appeal_approvedTimeoutLifted') : _tU('appeal_approvedTimeoutExpired');
            await targetUser.send(toV2({ embeds: [new EmbedBuilder()
                .setColor(C.GREEN)
                .setTitle(`${_E.verified || em('ic_ok', '✅')} ${_tU('appeal_approvedTitle')}`)
                .setDescription(_tU('appeal_approvedDesc', { server: guild?.name || 'the server' }) + lifted)
                .setFooter({ text: 'ARCHON CG-223' })] })).catch(() => {});
        }
    } else if (action === 'reject') {
        if (targetUser) {
            const _tU = (k, v) => require('../lib/i18n').t('automod.' + k, _L, v);
            await targetUser.send(toV2({ embeds: [new EmbedBuilder()
                .setColor(C.RED)
                .setTitle(`${_E.ic_off || _E.error || '❌'} ${_tU('appeal_rejectedTitle')}`)
                .setDescription(_tU('appeal_rejectedDesc', { server: guild?.name || 'the server' }))
                .setFooter({ text: 'ARCHON CG-223' })] })).catch(() => {});
        }
    } else if (action === 'ban') {
        appealCooldowns.set(`ban:${vote.userId}:${vote.guildId}`, Date.now() + 7 * 86400000);
        const k = key(vote.userId, vote.guildId);
        const entry = history.get(k) || { messages: [], warns: 0, last: Date.now() };
        entry.warns++;
        history.set(k, entry);
        // The "+1 strike" promised to the member was only kept in memory: strikes are read from the database
        try { client.db.prepare('INSERT INTO warnings (id,guild_id,user_id,moderator_id,reason,expires_at,active) VALUES (?,?,?,?,?,?,1)').run(`AM-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`, String(vote.guildId), String(vote.userId), interaction.user.id, 'AutoMod: frivolous appeal', Math.floor(Date.now()/1000)+2592000); } catch {}
        if (targetUser) {
            const _tU = (k, v) => require('../lib/i18n').t('automod.' + k, _L, v);
            await targetUser.send(toV2({ embeds: [new EmbedBuilder()
                .setColor(C.DARK)
                .setTitle(`${_E.lock || '🔨'} ${_tU('appeal_banTitle')}`)
                .setDescription(_tU('appeal_banDesc', { server: guild?.name || 'the server' }))
                .setFooter({ text: 'ARCHON CG-223' })] })).catch(() => {});
        }
    }

    vote.status = statusLabel;
    appealTribunal.set(appealId, vote);

    // The same message shrinks to one line: who decided, and what it changed. The buttons go away.
    const _ic = action === 'approve' ? (_E.ic_ok || '✅') : action === 'reject' ? (_E.ic_no || '❌') : (_E.ic_ban || '🔨');
    const _out = action === 'approve'
        ? [_T('tb_outApproved'), banLifted ? _T('tb_outBanLifted') : timeoutLifted ? _T('appeal_resultExtraLifted') : ''].filter(Boolean).join(' ')
        : action === 'reject' ? _T('tb_outRejected') : _T('tb_outPaused');
    const decided = require('../lib/games/v2').card(color, [
        { text: `### ${_ic} ${_T(action === 'approve' ? 'tb_approved' : action === 'reject' ? 'tb_rejected' : 'tb_paused', { mod: interaction.user.username })}` },
        { text: `-# ${vote.userTag || vote.userId} · ${guild?.name || ''} · ${_out}` },
    ]);
    await interaction.editReply({ ...decided, allowedMentions: { parse: [] } })
        .then(() => console.log(`[TRIBUNAL] ${appealId} → ${statusLabel} by ${interaction.user.tag}`))
        .catch((e) => console.error('[TRIBUNAL] edit failed:', e.message));

    return true;
}

// Discord's own AutoMod rules (lib/native-automod.js): 'create' and 'invite' bring them in step with the settings
// (AutoMod is on when they're called), 'delete' removes ARCHON's rules only.
async function syncRules(guild, action, settings) {
    const native = require('../lib/native-automod');
    try {
        if (action === 'delete') return (await native.remove(guild)).ok;
        let fresh = {};
        try { guild.client.settings?.delete?.(guild.id); fresh = guild.client.getServerSettings?.(guild.id) || {}; } catch { /* the settings given */ }
        const r = await native.sync(guild, { ...fresh, ...(settings || {}), autoModEnabled: true });
        if (!r.ok) console.log(`[AUTOMOD NATIVE] ${guild.id}: ${r.reason || `failed: ${r.failed.join(', ')}`}`);
        return r.ok || r.created + r.updated > 0;
    } catch (e) { console.log(`[AUTOMOD NATIVE] ${e.message}`); return false; }
}

function resolveSetting(s, ...keys) { for (const k of keys) { if (s?.[k] != null && s[k] !== '') return s[k]; } return null; }

// ================= FIX 4 HELPER: Format pending appeals for /automod appeals ──
function formatPendingAppeals(guildId) {
    const pending = [];
    for (const [id, data] of appealTribunal) {
        if (data.guildId !== guildId) continue;
        if (data.status !== 'pending') continue;
        pending.push({ id, ...data });
    }
    return pending;
}



// ═══════════════════════════════════════════════════════
//  ADMIN CARDS (V2) — Domains / Channels / Log / Raid
// ═══════════════════════════════════════════════════════
function _adminLang(client, guild) { return require('../lib/botPerms').langOf({ guild, client }); }
function _adminT(client, guild, k, v) { return require('../lib/i18n').t('automod.' + k, _adminLang(client, guild), v); }

function buildDomainsCard(client, guild, ss) {
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
    const _T = (k, v) => _adminT(client, guild, k, v);
    const list = parseDomainWhitelist(ss?.autoModDomains);
    const customList = list.length > 0 ? list.join(', ') : _T('admin_domainsCustomNone');
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('automod_domains_add').setLabel(_T('admin_btnAdd')).setEmoji(iconObj('ic_add', null, '➕')).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('automod_domains_remove').setLabel(_T('admin_btnRemove')).setEmoji(iconObj('ic_remove', null, '➖')).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('automod_domains_reset').setLabel(_T('admin_btnReset')).setEmoji(icon('refresh')).setStyle(ButtonStyle.Danger),
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('automod_status_back').setLabel(_T('admin_btnBack')).setEmoji(iconObj('ic_back', null, '↩️')).setStyle(ButtonStyle.Secondary),
    );
    const view = v2card(0x2ecc71, [
        { text: `## ${ui.em('globe', '🌐')} ${_T('admin_domainsTitle')}\n*${_T('card_domainsSub')}*` },
        { rule: true },
        { text: `**${_T('admin_domainsDefaultLabel')}**\n${[...DEFAULT_DOMAIN_WHITELIST].slice(0, 12).join(', ')}, …\n\n**${_T('admin_domainsCustomLabel')}**\n${customList}` },
        { rule: true },
        { text: `-# ${_T('admin_domainsHint')}` },
        { row: row1 },
        { row: row2 },
    ]);
    return { ...view, flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral };
}

function buildRaidCard(client, guild, db) {
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
    const _T = (k, v) => _adminT(client, guild, k, v);
    const s = db.prepare('SELECT raid_enabled, raid_threshold, raid_window, raid_min_age_days FROM server_settings WHERE guild_id = ?').get(guild.id) || {};
    const enabled = !!s.raid_enabled;
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('automod_raid_enable').setLabel(_T('admin_btnEnable')).setEmoji(icon('ok')).setStyle(ButtonStyle.Success).setDisabled(enabled),
        new ButtonBuilder().setCustomId('automod_raid_disable').setLabel(_T('admin_btnDisable')).setEmoji(icon('no')).setStyle(ButtonStyle.Danger).setDisabled(!enabled),
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('automod_raid_threshold').setLabel(_T('admin_btnThreshold')).setEmoji(iconObj('ic_settings', null, '⚙️')).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('automod_raid_minage').setLabel(_T('admin_btnMinAge')).setEmoji(iconObj('ic_minage', null, '👶')).setStyle(ButtonStyle.Primary),
    );
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('automod_status_back').setLabel(_T('admin_btnBack')).setEmoji(iconObj('ic_back', null, '↩️')).setStyle(ButtonStyle.Secondary),
    );
    const view = v2card(enabled ? 0x2ecc71 : 0x95a5a6, [
        { text: `## ${ui.em('eagle', '🛡️')} ${_T('admin_raidTitle')}\n*${_T('card_raidSub')}*` },
        { rule: true },
        { text: `**${_T('admin_raidStatusLabel')}** · ${enabled ? _T('admin_raidEnabled') : _T('admin_raidDisabled')}\n**${_T('admin_raidTriggerLabel')}** · ${s.raid_threshold || 5} joins / ${s.raid_window || 30}s\n**${_T('admin_raidMinAgeLabel')}** · ${s.raid_min_age_days ? _T('admin_raidDays', { n: s.raid_min_age_days }) : _T('admin_raidMinAgeDisabled')}` },
        { rule: true },
        { row: row1 },
        { row: row2 },
        { row: row3 },
    ]);
    return { ...view, flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral };
}

async function handleAdminButton(interaction, client) {
    { const _no = require('../lib/access').deny(interaction.member, 'automod', require('../lib/botPerms').langOf(interaction)); if (_no) return interaction.reply({ content: _no, flags: 64, allowedMentions: { parse: [] } }); }
    const id = interaction.customId;
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ChannelSelectMenuBuilder, ChannelType } = require('discord.js');
    const _T = (k, v) => _adminT(client, interaction.guild, k, v);
    const ss = client.getServerSettings(interaction.guild.id);

    // ── Domains ──
    if (id === 'automod_domains_add') {
        return interaction.showModal(new ModalBuilder().setCustomId('automod_modal_domains_add').setTitle(_T('admin_domainsModalAddTitle')).addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('domain').setLabel(_T('admin_domainsModalAddLabel')).setPlaceholder(_T('admin_domainsModalAddHint')).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80))));
    }
    if (id === 'automod_domains_remove') {
        return interaction.showModal(new ModalBuilder().setCustomId('automod_modal_domains_remove').setTitle(_T('admin_domainsModalRemoveTitle')).addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('domain').setLabel(_T('admin_domainsModalRemoveLabel')).setPlaceholder(_T('admin_domainsModalRemoveHint')).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80))));
    }
    if (id === 'automod_domains_reset') {
        client.updateServerSetting(interaction.guild.id, 'automoddomains', null);
        client.settings.delete(interaction.guild.id);
        return interaction.update(buildDomainsCard(client, interaction.guild, client.getServerSettings(interaction.guild.id)));
    }

    // Channels and log are menus on the card now: an old card's buttons just open the new card
    if (id.startsWith('automod_channels_') || id.startsWith('automod_log_')) {
        await interaction.deferUpdate().catch(() => {});
        return interaction.editReply(await statusView(client, interaction.guild));
    }

    // ── Raid ──
    if (id === 'automod_raid_enable' || id === 'automod_raid_disable') {
        if (!require('./premium.js').isPremium(client.db, interaction.guild.id)) {
            return interaction.reply({ content: _T('admin_raidPremiumRequired'), flags: 64 });
        }
        const en = id === 'automod_raid_enable' ? 1 : 0;
        client.db.prepare('UPDATE server_settings SET raid_enabled = ? WHERE guild_id = ?').run(en, interaction.guild.id);
        return interaction.update(buildRaidCard(client, interaction.guild, client.db));
    }
    if (id === 'automod_raid_threshold') {
        return interaction.showModal(new ModalBuilder().setCustomId('automod_modal_raid_threshold').setTitle(_T('admin_raidModalThresholdTitle')).addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('value').setLabel(_T('admin_raidModalThresholdLabel')).setPlaceholder(_T('admin_raidModalThresholdHint')).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(3))));
    }
    if (id === 'automod_raid_minage') {
        return interaction.showModal(new ModalBuilder().setCustomId('automod_modal_raid_minage').setTitle(_T('admin_raidModalMinAgeTitle')).addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('value').setLabel(_T('admin_raidModalMinAgeLabel')).setPlaceholder(_T('admin_raidModalMinAgeHint')).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(3))));
    }
    return false;
}

async function handleAdminModal(interaction, client) {
    { const _no = require('../lib/access').deny(interaction.member, 'automod', require('../lib/botPerms').langOf(interaction)); if (_no) return interaction.reply({ content: _no, flags: 64, allowedMentions: { parse: [] } }); }
    const id = interaction.customId;
    const _T = (k, v) => _adminT(client, interaction.guild, k, v);
    const raw = (k) => String(interaction.fields.getTextInputValue(k) || '').trim();

    if (id === 'automod_modal_domains_add' || id === 'automod_modal_domains_remove') {
        const domain = raw('domain').toLowerCase().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
        if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
            return interaction.reply({ content: _T('admin_domainsInvalid'), flags: 64 });
        }
        const ss = client.getServerSettings(interaction.guild.id);
        const list = parseDomainWhitelist(ss?.autoModDomains);
        if (id === 'automod_modal_domains_add') {
            if (list.includes(domain)) return interaction.reply({ content: _T('admin_domainsAlready', { domain }), flags: 64 });
            const nw = ss?.autoModDomains ? `${ss.autoModDomains},${domain}` : domain;
            client.updateServerSetting(interaction.guild.id, 'automoddomains', nw);
        } else {
            if (!list.includes(domain)) return interaction.reply({ content: _T('admin_domainsNotFound', { domain }), flags: 64 });
            const nw = list.filter(d => d !== domain).join(',');
            client.updateServerSetting(interaction.guild.id, 'automoddomains', nw || null);
        }
        client.settings.delete(interaction.guild.id);
        await interaction.update(buildDomainsCard(client, interaction.guild, client.getServerSettings(interaction.guild.id)));
        return interaction.followUp({ content: id === 'automod_modal_domains_add' ? _T('admin_domainsAdded', { domain }) : _T('admin_domainsRemoved', { domain }), flags: 64 });
    }

    if (id === 'automod_modal_raid_threshold' || id === 'automod_modal_raid_minage') {
        const n = parseInt(raw('value'), 10);
        if (!Number.isFinite(n) || n < 0 || n > 999) return interaction.reply({ content: em('ic_off', '❌') + ' 0–999', flags: 64 });
        if (id === 'automod_modal_raid_threshold') {
            client.db.prepare('UPDATE server_settings SET raid_threshold = ? WHERE guild_id = ?').run(n, interaction.guild.id);
        } else {
            client.db.prepare('UPDATE server_settings SET raid_min_age_days = ? WHERE guild_id = ?').run(n, interaction.guild.id);
        }
        await interaction.update(buildRaidCard(client, interaction.guild, client.db));
        return interaction.followUp({ content: id === 'automod_modal_raid_threshold' ? _T('admin_raidThresholdSet', { n }) : _T('admin_raidMinAgeSet', { n }), flags: 64 });
    }
    return false;
}

async function handleAdminSelect(interaction, client) {
    { const _no = require('../lib/access').deny(interaction.member, 'automod', require('../lib/botPerms').langOf(interaction)); if (_no) return interaction.reply({ content: _no, flags: 64, allowedMentions: { parse: [] } }); }
    const id = interaction.customId;
    const gid = interaction.guild.id;
    const values = interaction.values || [];
    const KEYS = { automod_select_logch: 'automodlog', automod_select_exempt: 'automodwhitelist', automod_select_ignore: 'automodchannels' };
    await interaction.deferUpdate().catch(() => {});
    // An empty choice clears the setting (no log channel, no exempt role, no ignored channel).
    // The card's menus set the whole list; Discord's own rules follow by themselves (lib/native-automod.schedule).
    if (KEYS[id]) client.updateServerSetting(gid, KEYS[id], values.length ? values.join(',') : null);
    // anything else is a menu from an older card: show the new one
    return interaction.editReply(await statusView(client, interaction.guild));
}

// ═══════════════════════════════════════════════════════
//  STATUS BUTTONS — Manage domains / View appeals
// ═══════════════════════════════════════════════════════
async function handleStatusButton(interaction, client) {
    { const _no = require('../lib/access').deny(interaction.member, 'automod', require('../lib/botPerms').langOf(interaction)); if (_no) return interaction.reply({ content: _no, flags: 64, allowedMentions: { parse: [] } }); }
    const id = interaction.customId;
    const STATUS_IDS = ['automod_status_domains', 'automod_status_channels', 'automod_status_log', 'automod_status_raid', 'automod_status_appeals', 'automod_status_back', 'automod_status_enable', 'automod_status_disable'];
    if (!STATUS_IDS.includes(id)) return false;

    const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
    const ss = client.getServerSettings(interaction.guild.id);
    const _L = require('../lib/botPerms').langOf({ guild: interaction.guild, client });
    const _T = (k, v) => require('../lib/i18n').t('automod.' + k, _L, v);

    const backBtn = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('automod_status_back').setLabel(_T('admin_domainsBack')).setEmoji(iconObj('ic_back', null, '↩️')).setStyle(ButtonStyle.Secondary)
    );

    // Turn on / off from the card; the card redraws itself
    if (id === 'automod_status_enable' || id === 'automod_status_disable') {
        await interaction.deferUpdate().catch(() => {});
        const r = await setEnabled(client, interaction.guild, id === 'automod_status_enable');
        if (r.missing) await interaction.followUp({ content: _T('admin_enableMissing', { list: r.missing.map((p) => '`' + p + '`').join(', ') }), flags: 64 }).catch(() => {});
        return interaction.editReply(await statusView(client, interaction.guild));
    }

    // Back, and the old Channels / Log buttons (now menus on the card)
    if (id === 'automod_status_back' || id === 'automod_status_channels' || id === 'automod_status_log') {
        await interaction.deferUpdate().catch(() => {});
        return interaction.editReply(await statusView(client, interaction.guild));
    }

    if (id === 'automod_status_domains') {
        return interaction.update(buildDomainsCard(client, interaction.guild, ss));
    }

    if (id === 'automod_status_raid') {
        return interaction.update(buildRaidCard(client, interaction.guild, client.db));
    }

    if (id === 'automod_status_appeals') {
        const pending = formatPendingAppeals(interaction.guild.id);
        const items = [
            { text: `## ${ui.em('mod_sign', '⚖️')} ${_T('admin_appealsHeader', { n: pending.length })}\n*${_T('card_appealsSub')}*` },
            { rule: true },
        ];
        if (pending.length === 0) {
            items.push({ text: `-# ${_T('admin_appealsEmpty')}` });
        } else {
            for (const a of pending.slice(0, 8)) {
                const when = a.lastViolationTime ? `<t:${Math.floor(a.lastViolationTime / 1000)}:R>` : null;
                items.push({ text: `**${a.userTag}** · ${a.violationType || '—'}\n${when ? `-# ${when} · ` : '-# '}${a.reason?.substring(0, 90) || '—'}` });
            }
        }
        items.push({ rule: true }, { row: backBtn });
        const view = v2card(0x2ecc71, items);
        return interaction.update({ ...view, flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }
    return false;
}

module.exports = {
    handleAppealModal, appealModal, appealBlocked, greyAppealButton,
    isElevated,
    name: 'automod', category: 'MODERATION', aliases: ['am', 'modai'],
    description: '🛡️ Discord-native AutoMod system with timeouts, AI toxicity detection, domain-based link blocking, image spam detection, @everyone protection, and appeals.',
    usage: '.automod [status|enable|disable|appeals]',
    cooldown: 3000,

    // ── FIX 4: Added 'appeals' subcommand to slash builder ──
    data: new SlashCommandBuilder().setName('automod').setDescription('🛡️ Configure AutoMod').
        setDefaultMemberPermissions(Number(PermissionsBitField.Flags.ManageGuild)).
        addSubcommand(s => s.setName('status').setDescription('View AutoMod status')).
        addSubcommand(s => s.setName('enable').setDescription('Enable AutoMod')).
        addSubcommand(s => s.setName('disable').setDescription('Disable AutoMod')).
        addSubcommand(s => s.setName('appeals').setDescription('View and manage pending appeals')),

    execute: async (ix, client) => {
        { const _no = require('../lib/access').deny(ix.member, 'automod', require('../lib/botPerms').langOf(ix)); if (_no) return ix.reply({ content: _no, flags: 64, allowedMentions: { parse: [] } }); }
        
        // On achète 15 minutes de temps à Discord pour éviter le timeout (10062)
        await ix.deferReply({ flags: 1 << 6 });
        const sc = ix.options.getSubcommand();
        const ss = client.getServerSettings(ix.guild.id);
        const _LA = require('../lib/botPerms').langOf({ guild: ix.guild, client });
        const _TA = (k, v) => require('../lib/i18n').t('automod.' + k, _LA, v);

        // ── FIX 4: /automod appeals — slash handler ──
        if (sc === 'appeals') {
            const _LG = require('../lib/botPerms').langOf({ guild: ix.guild, client });
            const _T = (k, v) => require('../lib/i18n').t('automod.' + k, _LG, v);
            const pending = formatPendingAppeals(ix.guild.id);
            if (pending.length === 0) {
                return ix.editReply(toV2({
                    embeds: [new EmbedBuilder()
                        .setColor(C.GREEN)
                        .setTitle(_T('admin_appealsTitle'))
                        .setDescription(_T('admin_appealsEmpty'))
                        .setFooter({ text: 'ARCHON CG-223' })],
                    flags: 1 << 6
                }));
            }
            const _v2 = require('../lib/games/v2');
            const items = [
                { text: `## ⚖️ ${_T('admin_appealsHeader', { n: pending.length })}` },
                { rule: true }
            ];
            for (const a of pending.slice(0, 10)) {
                const timeAgo = a.lastViolationTime ? `<t:${Math.floor(a.lastViolationTime / 1000)}:R>` : null;
                const fieldKey = timeAgo ? 'admin_appealsFieldValue' : 'admin_appealsFieldValueNoTime';
                const vars = { reason: a.reason?.substring(0, 100) || '—', delivery: a.deliveryMethod || '—', id: a.id };
                if (timeAgo) vars.when = timeAgo;
                items.push({ text: `**${a.userTag}** — ${a.violationType || '—'}\n${_T(fieldKey, vars)}` });
            }
            items.push({ rule: true }, { text: `-# ${_T('admin_appealsFooterSlash')}` });
            return ix.editReply({ ..._v2.card(C.BLURPLE, items), flags: 1 << 6 });
        }

        // status, enable, disable: the card (enable and disable redraw it in its new state)
        if (sc === 'enable' || sc === 'disable') {
            const r = await setEnabled(client, ix.guild, sc === 'enable');
            if (r.missing) return ix.editReply({ content: _TA('admin_enableMissing', { list: r.missing.map((p) => '`' + p + '`').join(', ') }) });
        }
        return ix.editReply(await statusView(client, ix.guild));
    },

    run: async (client, msg, args, db, ss) => {
        { const _no = require('../lib/access').deny(msg.member, 'automod', require('../lib/botPerms').langOf({ guild: msg.guild, client })); if (_no) return msg.reply({ content: _no, allowedMentions: { parse: [] } }); }
        const action = args[0]?.toLowerCase() || 'status';
        const settings = client.getServerSettings(msg.guild.id);
        const _LP = require('../lib/botPerms').langOf({ guild: msg.guild, client });
        const _TP = (k, v) => require('../lib/i18n').t('automod.' + k, _LP, v);

        // ── FIX 4: .automod appeals — prefix handler ──
        if (action === 'appeals') {
            const _LG = require('../lib/botPerms').langOf({ guild: msg.guild, client });
            const _T = (k, v) => require('../lib/i18n').t('automod.' + k, _LG, v);
            const pending = formatPendingAppeals(msg.guild.id);
            if (pending.length === 0) {
                return msg.reply(toV2({
                    embeds: [new EmbedBuilder()
                        .setColor(C.GREEN)
                        .setTitle(_T('admin_appealsTitle'))
                        .setDescription(_T('admin_appealsEmpty'))
                        .setFooter({ text: 'ARCHON CG-223' })]
                }));
            }
            const _v2 = require('../lib/games/v2');
            const items = [
                { text: `## ⚖️ ${_T('admin_appealsHeader', { n: pending.length })}` },
                { rule: true }
            ];
            for (const a of pending.slice(0, 10)) {
                items.push({ text: `**${a.userTag}** — ${a.violationType || '—'}\n${_T('admin_appealsFieldValueNoTime', { reason: a.reason?.substring(0, 100) || '—', delivery: a.deliveryMethod || '—', id: a.id })}` });
            }
            items.push({ rule: true }, { text: `-# ${_T('admin_appealsFooterPrefix')}` });
            return msg.reply(_v2.card(C.BLURPLE, items));
        }

        // on / off, then the card; any other word (status, domains, log…) opens the card, where every setting is
        if (['enable', 'on', 'disable', 'off'].includes(action)) {
            const r = await setEnabled(client, msg.guild, action === 'enable' || action === 'on');
            if (r.missing) return msg.reply(_TP('admin_enableMissing', { list: r.missing.map((p) => '`' + p + '`').join(', ') }));
        }
        const view = await statusView(client, msg.guild);
        return msg.reply({ ...view, flags: view.flags & ~64 });   // a prefix reply can't be private
    },

    async handleMessage(message, client, db) {
        return await scanMessage(message, client, db);
    },

    async handleRaid(member, client, db) {
        return await handleRaidDetection(member, client, db);
    },

    async handleDM(message, client) {
        return await handleAppeal(message, client);
    },

    async handleAppealButton(interaction, client) {
        return await handleAppealButton(interaction, client);
    },

    async handleStatusButton(interaction, client) {
        return await handleStatusButton(interaction, client);
    },

    async handleAdminButton(interaction, client) {
        return await handleAdminButton(interaction, client);
    },

    async handleAdminModal(interaction, client) {
        return await handleAdminModal(interaction, client);
    },

    async handleAdminSelect(interaction, client) {
        return await handleAdminSelect(interaction, client);
    }
};

module.exports.resumeRaids = resumeRaids;

// ── Daily AutoMod digest for each server owner ──────────────────────────────────────────────────────────────────
// Owners used to get a DM for every strike. Now: one summary a day at 21:00 Bamako time (UTC), only on days with
// something to report. Bans and actions the bot couldn't take still reach them right away.
const DIGEST_HOUR = 21; // local time of each server
function typeFromReason(reason) {
    const r = String(reason || '').replace(/^AutoMod:\s*/, '');
    for (const [type, spec] of Object.entries(_RULE_REASONS)) if (spec[0].test(r)) return type;
    return 'toxic content';
}
async function sendDigests(client, db, onlyGuilds = null) {
    fixLogUnits(db);
    const since = Math.floor(Date.now() / 1000) - 86400;
    const rows = db.prepare("SELECT guild_id, user_id, action, reason FROM moderation_logs WHERE moderator_id = ? AND reason LIKE 'AutoMod:%' AND timestamp >= ?").all(client.user.id, since);
    const byGuild = new Map();
    for (const r of rows) { if (!byGuild.has(r.guild_id)) byGuild.set(r.guild_id, []); byGuild.get(r.guild_id).push(r); }
    const _v2 = require('../lib/games/v2');
    const E = require('../config/emojis');
    for (const [gid, list] of byGuild) {
        if (onlyGuilds && !onlyGuilds.has(gid)) continue;
        const guild = client.guilds.cache.get(gid); if (!guild) continue;
        const owner = await guild.fetchOwner().catch(() => null); if (!owner || owner.user.bot) continue;
        const L = require('../lib/botPerms').langOf({ guild, client });
        const t = (k, v) => require('../lib/i18n').t('automod.' + k, L, v);
        const count = (fn) => list.filter(fn).length;
        const rules = new Map();
        for (const r of list) { const ty = typeFromReason(r.reason); rules.set(ty, (rules.get(ty) || 0) + 1); }
        const users = new Map();
        for (const r of list) users.set(r.user_id, (users.get(r.user_id) || 0) + 1);
        const topRules = [...rules].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([ty, n]) => `\`${n}×\` ${ruleName({ type: ty }, t)}`).join('\n');
        const topUsers = [...users].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([u, n]) => `<@${u}> (${n})`).join(' · ');
        const items = [
            { text: `## ${t('digestTitle', { server: guild.name })}` },
            { text: t('digestIntro') },
            { text: `-# ${t('digestSummary', { removed: list.length, timeouts: count(r => r.action === 'timeout'), bans: count(r => r.action === 'ban') })}` },
            { rule: true },
            { text: topRules },
            { text: `-# ${t('digestTop', { list: topUsers })}` },
            { row: new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link)
                .setLabel(t('digestBtn')).setURL(`https://archon223.com/dashboard/${gid}`)) },
            { text: `-# ${E.eagle || '🦅'} ARCHON CG-223` },
        ];
        await owner.send({ ..._v2.card(0x5865F2, items), allowedMentions: { parse: [] } }).catch(() => {});
    }
}
let _digestTimer = null;
// Each server gets its digest at 21:00 in its own timezone (General tab), UTC when none is set
function localDayHour(tz) {
    try {
        const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
            .formatToParts(new Date()).map((x) => [x.type, x.value]));
        return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
    } catch { const d = new Date(); return { day: d.toISOString().slice(0, 10), hour: d.getUTCHours() }; }
}
function startDigest(client, db) {
    loadState(db);
    if (_digestTimer) return;
    const tick = async () => {
        try {
            db.prepare('CREATE TABLE IF NOT EXISTS automod_digest_sent (guild_id TEXT PRIMARY KEY, day TEXT)').run();
            const due = new Set();
            for (const g of client.guilds.cache.values()) {
                const tz = client.getServerSettings?.(g.id)?.timezone || 'UTC';
                const { day, hour } = localDayHour(tz);
                if (hour < DIGEST_HOUR) continue;
                const last = db.prepare('SELECT day FROM automod_digest_sent WHERE guild_id = ?').get(g.id)?.day;
                if (last === day) continue;
                db.prepare('INSERT OR REPLACE INTO automod_digest_sent (guild_id, day) VALUES (?, ?)').run(g.id, day);
                due.add(g.id);
            }
            if (due.size) await sendDigests(client, db, due);
        } catch (e) { console.error('[AUTOMOD] digest failed:', e.message); }
    };
    _digestTimer = setInterval(tick, 10 * 60000);
    _digestTimer.unref?.();
    tick();
}
module.exports.startDigest = startDigest;
module.exports.syncRules = syncRules;
module.exports.DEFAULT_DOMAIN_WHITELIST = DEFAULT_DOMAIN_WHITELIST;   // lib/native-automod.js: the same sites stay allowed on Discord's side
