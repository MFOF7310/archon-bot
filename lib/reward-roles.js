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
    if (why) { console.log(`[${tag}] guild=${guild.id} could not give "${role.name}" to ${member.id}: ${why}`); return false; }
    try { await member.roles.add(role, reason); return true; }
    catch (e) { console.log(`[${tag}] guild=${guild.id} could not give "${role.name}" to ${member.id}: ${e.message}`); return false; }
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

module.exports = { give, syncLevelRoles, levelOf, LEVELS };
