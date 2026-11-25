'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// ARCHON — REJOIN INVITE: one lasting link back into a server, never a new one each time
//   rejoinUrl(db, guild) → the invite saved with /ban setinvite (server_settings.server_invite) if it still works;
//   else ONE permanent invite made once and saved (maxAge 0, unique false: Discord gives back the same one);
//   else the server's vanity link; else null. Used by verification (after a kick) and appeals (after a lifted ban).
// ═══════════════════════════════════════════════════════════════════════════
async function rejoinUrl(db, guild) {
    try {
        let url = db.prepare('SELECT server_invite FROM server_settings WHERE guild_id = ?').get(guild.id)?.server_invite || null;
        if (url && !await guild.client.fetchInvite(url).catch(() => null)) url = null;
        if (!url) {
            const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
            const channel = me && (guild.systemChannel || guild.channels.cache.find((c) => c.type === 0 && c.permissionsFor(me)?.has('CreateInstantInvite')));
            if (channel && channel.permissionsFor(me)?.has('CreateInstantInvite')) {
                const invite = await channel.createInvite({ maxAge: 0, maxUses: 0, unique: false, reason: 'Way back in (verification or appeal)' }).catch(() => null);
                if (invite) {
                    url = invite.url;
                    try { db.prepare('UPDATE server_settings SET server_invite = ? WHERE guild_id = ?').run(url, guild.id); } catch { /* kept for this time only */ }
                }
            }
        }
        if (!url && guild.vanityURLCode) url = `https://discord.gg/${guild.vanityURLCode}`;
        return url || null;
    } catch { return null; }
}

module.exports = { rejoinUrl };
