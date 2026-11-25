'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// ARCHON — REJOIN INVITE: one lasting link back into a server, never a new one each time
//   rejoinUrl(db, guild) → the invite saved with /ban setinvite (server_settings.server_invite) if it still works;
//   else a permanent invite the server already has (never expires, no use limit, not temporary), saved;
//   else ONE permanent invite made once and saved (maxAge 0, unique false: Discord gives back the same one);
//   else the server's vanity link; else null. Used by verification (after a kick) and appeals (after a lifted ban).
// ═══════════════════════════════════════════════════════════════════════════
async function rejoinUrl(db, guild) {
    try {
        let url = db.prepare('SELECT server_invite FROM server_settings WHERE guild_id = ?').get(guild.id)?.server_invite || null;
        if (url && !await guild.client.fetchInvite(url).catch(() => null)) url = null;
        const save = (u) => { try { db.prepare('UPDATE server_settings SET server_invite = ? WHERE guild_id = ?').run(u, guild.id); } catch { /* kept for this time only */ } };
        // the saved link is gone (deleted by an admin?): reuse a lasting invite the server already has before making one
        // (listing invites needs Manage Server; without it, this step is skipped)
        if (!url) {
            const all = await guild.invites.fetch().catch(() => null);
            const lasting = all && [...all.values()].filter((i) => !i.maxAge && !i.maxUses && !i.temporary)
                .sort((a, b) => (b.uses || 0) - (a.uses || 0))[0];   // the most used one: the link people already share
            if (lasting) { url = lasting.url; save(url); }
        }
        if (!url) {
            const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
            const channel = me && (guild.systemChannel || guild.channels.cache.find((c) => c.type === 0 && c.permissionsFor(me)?.has('CreateInstantInvite')));
            if (channel && channel.permissionsFor(me)?.has('CreateInstantInvite')) {
                const invite = await channel.createInvite({ maxAge: 0, maxUses: 0, unique: false, reason: 'Way back in (verification or appeal)' }).catch(() => null);
                if (invite) { url = invite.url; save(url); }
            }
        }
        if (!url && guild.vanityURLCode) url = `https://discord.gg/${guild.vanityURLCode}`;
        // no way back at all: tell the admins what blocks it (log channel or the owner's DMs, once a day); a link clears it
        const journal = require('./postProblems');
        if (url) journal.sent(guild, 'rejoin');
        else {
            const me = guild.members.me;
            const missing = [!me?.permissions?.has?.('CreateInstantInvite') && 'Create Invite', !me?.permissions?.has?.('ManageGuild') && 'Manage Server'].filter(Boolean);
            journal.failed(guild, 'rejoin', null, { reason: 'missing_perm', missing: missing.length ? missing : ['Create Invite'] });
        }
        return url || null;
    } catch { return null; }
}

module.exports = { rejoinUrl };
