// Member auto-role. Never assigns roles with moderation/admin permissions.
const { validateVerifyRole } = require('./verify-guard');

async function applyJoinRole(member, db) {
    try {
        const id = db.prepare('SELECT join_role_id FROM server_settings WHERE guild_id = ?').get(member.guild.id)?.join_role_id;
        const rid = id || (member.guild.id === process.env.GUILD_ID ? process.env.AUTO_ROLE_ID : null);
        if (!rid) return;
        const role = member.guild.roles.cache.get(String(rid));
        const err = validateVerifyRole(member.guild, role, null);
        if (err) return console.warn(`[JOINROLE] guild=${member.guild.id} role=${rid}: ${err} — skipped`);
        if (!member.roles.cache.has(role.id)) await member.roles.add(role, 'Auto-role');
    } catch (e) {
        console.error(`[JOINROLE] guild=${member.guild.id} user=${member.id}:`, e.message);
    }
}
module.exports = { applyJoinRole };
