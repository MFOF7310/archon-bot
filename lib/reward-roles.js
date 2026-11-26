'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// ARCHON — GIVING THE REWARD ROLES (levels, investor, quiz master, duelist; daily streaks are in plugins/claim.js)
// One way to give a role, so a refusal is never silent: it is logged with the reason (role above ARCHON's,
// no Manage Roles). syncLevelRoles gives every level role reached that the member is missing; it runs at every
// level-up (not only 5, 10, 15…), after /claim, and when someone opens their rewards card.
// ═══════════════════════════════════════════════════════════════════════════
const { PermissionFlagsBits: P } = require('discord.js');

const LEVELS = [5, 10, 15, 20, 25];

// true when the member has the role afterwards
async function give(member, roleId, reason, tag = 'ROLES') {
    if (!member || !roleId) return false;
    const guild = member.guild;
    const role = guild?.roles?.cache?.get(String(roleId));
    if (!role) return false;   // deleted: lib/role-cleanup empties the setting
    if (member.roles.cache.has(role.id)) return true;
    const me = guild.members.me;
    const why = !me?.permissions?.has(P.ManageRoles) ? 'ARCHON lacks Manage Roles'
        : role.position >= (me.roles?.highest?.position ?? 0) ? "the role is at or above ARCHON's highest role"
        : null;
    const code = !me?.permissions?.has(P.ManageRoles) ? 'no_perm' : role.position >= (me.roles?.highest?.position ?? 0) ? 'above' : null;
    if (why) { console.log(`[${tag}] guild=${guild.id} could not give "${role.name}" to ${member.id}: ${why}`); tellMods(member, role, reason, code); return false; }
    try { await member.roles.add(role, reason); return true; }
    catch (e) { console.log(`[${tag}] guild=${guild.id} could not give "${role.name}" to ${member.id}: ${e.message}`); tellMods(member, role, reason, 'other', e.message); return false; }
}

// A refused reward role is told in the mod log, so the admins know and can fix it: once per role every 6 hours
// (a role above ARCHON's would otherwise post a line at every /claim or level-up).
const told = new Map();
const TELL_EVERY = 6 * 3600 * 1000;
function tellMods(member, role, reason, code, error = '') {
    try {
        const guild = member.guild;
        const key = `${guild.id}:${role.id}`;
        if (Date.now() - (told.get(key) || 0) < TELL_EVERY) return;
        told.set(key, Date.now());
        if (told.size > 2000) told.clear();
        const db = guild.client?.db;
        const ch = db && require('./modlog').resolveModLog(guild, db);
        if (!ch) return;
        const { t } = require('./i18n');
        let lang = 'en';
        try { lang = require('./pick-lang').pickLang(guild.client, guild.id, null); } catch { /* English */ }
        if (!['en', 'fr', 'zh', 'ar'].includes(lang)) lang = 'en';
        const { icon } = require('./ui/icons');
        const { card } = require('./games/v2');
        const bot = guild.members.me?.roles?.botRole?.name || guild.members.me?.displayName || 'ARCHON';
        const text = [
            `${icon('warn', ch)} ${t('roles.give_failed', lang, { role: `<@&${role.id}>`, user: `<@${member.id}>` })}`,
            t(`roles.give_why_${code}`, lang, { error: String(error).slice(0, 150), bot }),
            `-# ${t('roles.give_for', lang, { reason: String(reason || '').slice(0, 100) })} · ${t('roles.give_once', lang)}`,
        ].join('\n');
        ch.send(card(0xF0B232, [{ text }])).catch(() => {});
    } catch { /* the console line above is enough */ }
}

// Every level role the member has reached and doesn't have yet. Read fresh from the database.
async function syncLevelRoles(member, level, db) {
    const added = [];
    if (!member?.guild || !db || !(level >= LEVELS[0])) return added;
    let row = {};
    try { row = db.prepare(`SELECT ${LEVELS.map((l) => `level_${l}_role`).join(', ')} FROM server_settings WHERE guild_id = ?`).get(member.guild.id) || {}; } catch { return added; }
    for (const lvl of LEVELS) {
        if (level < lvl) break;
        const id = row[`level_${lvl}_role`];
        if (!id || member.roles.cache.has(String(id))) continue;
        if (await give(member, id, `Level ${lvl} reached`, 'LEVELING')) added.push(member.guild.roles.cache.get(String(id))?.name);
    }
    return added.filter(Boolean);
}

// The level saved for this member on this server (xp is the truth; the level column can lag)
function levelOf(db, uid, gid) {
    try {
        const r = db.prepare('SELECT xp, level FROM users WHERE id = ? AND guild_id = ?').get(uid, gid) || {};
        return Math.max(Number(r.level || 1), require('./games/progress').levelFromXp(r.xp || 0));
    } catch { return 1; }
}

// ─── Roles set after members already earned them ─────────────────────────
// When an admin sets a level or streak role (/roles, /leveling, the dashboard), the members who already qualify get
// it now instead of at their next /claim or level-up. Level roles: the member's level. Streak roles: the streak they
// have now (a broken streak doesn't count, as at /claim). Slow on purpose (one role a second), one run per server
// at a time, started 15 seconds after the last change so several roles set in a row make one run. Summary in the mod log.
const DAY = 24 * 60 * 60 * 1000;
const STREAK_COLS = [[3, 'daily_initiate_role'], [7, 'daily_warrior_role'], [30, 'daily_champion_role'], [100, 'daily_legend_role']];
const soon = new Map();
const running = new Set();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function backfillSoon(client, guildId) {
    if (!client || !guildId) return;
    clearTimeout(soon.get(guildId));
    soon.set(guildId, setTimeout(() => {
        soon.delete(guildId);
        backfill(client, guildId).catch((e) => console.log(`[BACKFILL] guild=${guildId}: ${e.message}`));
    }, 15000));
}

async function backfill(client, guildId) {
    if (running.has(guildId)) return backfillSoon(client, guildId);   // after the current run
    running.add(guildId);
    try {
        const guild = client.guilds?.cache?.get(guildId);
        const db = client.db;
        if (!guild || !db) return;
        let row = {};
        const cols = [...LEVELS.map((l) => `level_${l}_role`), ...STREAK_COLS.map((x) => x[1])];
        try { row = db.prepare(`SELECT ${cols.join(', ')} FROM server_settings WHERE guild_id = ?`).get(guildId) || {}; } catch { return; }
        const now = Date.now();
        const wanted = [
            ...LEVELS.filter((l) => row[`level_${l}_role`]).map((l) => ({ id: String(row[`level_${l}_role`]), ok: (u) => require('./games/progress').trueLevel(u) >= l, why: `level ${l} already reached` })),
            ...STREAK_COLS.filter(([, c]) => row[c]).map(([d, c]) => ({ id: String(row[c]), ok: (u) => Number(u.streak_days || 0) >= d && now - Number(u.last_daily || 0) < 2 * DAY, why: `${d}-day streak already reached` })),
        ].filter((w) => guild.roles.cache.has(w.id));
        if (!wanted.length) return;

        // level reached by the saved level OR by XP (the saved level can lag: members past level 5 by game XP were skipped)
        const xpForFirst = Math.pow((LEVELS[0] - 1) / 0.1, 2);
        const users = db.prepare('SELECT id, level, xp, streak_days, last_daily FROM users WHERE guild_id = ? AND (level >= ? OR xp >= ? OR streak_days >= ?)').all(guildId, LEVELS[0], xpForFirst, STREAK_COLS[0][0]);
        const given = new Map();
        const refused = new Set();   // a role Discord refuses once is skipped (give() already told the mod log why)
        for (const u of users.slice(0, 2000)) {
            const due = wanted.filter((w) => !refused.has(w.id) && w.ok(u));
            if (!due.length) continue;
            const member = guild.members.cache.get(u.id) || await guild.members.fetch(u.id).catch(() => null);
            if (!member) continue;
            for (const w of due) {
                if (member.roles.cache.has(w.id)) continue;
                if (await give(member, w.id, `Reward role set: ${w.why}`, 'BACKFILL')) given.set(w.id, (given.get(w.id) || 0) + 1);
                else refused.add(w.id);
                await sleep(1000);
            }
        }
        if (!given.size) return;
        console.log(`[BACKFILL] guild=${guildId}: ${[...given].map(([id, n]) => `${id}×${n}`).join(', ')}`);
        const ch = require('./modlog').resolveModLog(guild, db);
        if (!ch) return;
        const { t } = require('./i18n');
        let lang = 'en';
        try { lang = require('./pick-lang').pickLang(client, guildId, null); } catch { /* English */ }
        if (!['en', 'fr', 'zh', 'ar'].includes(lang)) lang = 'en';
        const { icon } = require('./ui/icons');
        const { card } = require('./games/v2');
        const lines = [...given].map(([id, n]) => `<@&${id}> · ${t(n === 1 ? 'roles.backfill_one' : 'roles.backfill_many', lang, { n })}`);
        await ch.send(card(0x1D9E75, [{ text: `${icon('ok', ch)} ${t('roles.backfill_title', lang)}\n${lines.join('\n')}` }])).catch(() => {});
    } finally {
        running.delete(guildId);
    }
}

module.exports = { give, syncLevelRoles, levelOf, LEVELS, backfillSoon, backfill };
