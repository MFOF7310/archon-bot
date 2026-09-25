// lib/verify-guard.js — shared by /verify, onMemberJoin and the dashboard API
const { PermissionsBitField: P } = require('discord.js');

const DANGEROUS = [
    P.Flags.Administrator, P.Flags.ManageGuild, P.Flags.ManageRoles,
    P.Flags.ManageChannels, P.Flags.ManageWebhooks, P.Flags.BanMembers,
    P.Flags.KickMembers, P.Flags.ModerateMembers, P.Flags.MentionEveryone
];

let lastDangerous = [];
const GUARD_MSG = {
    role_missing: "I can't find it — it may have been deleted.",
    everyone_not_allowed: "@everyone can't be the verified role — pick or create a dedicated one.",
    managed_role: "it belongs to a bot or integration — pick a regular role.",
    get dangerous_perms() { return `this role has ${lastDangerous.join(', ')} — remove it in Server Settings → Roles.`; },
    above_bot: "it's above my role — drag ARCHON's role higher in Server Settings → Roles.",
    above_actor: "it's at or above your own highest role, so you can't hand it out."
};

function validateVerifyRole(guild, role, actor) {
    if (!guild || !role) return 'role_missing';
    if (role.id === guild.id) return 'everyone_not_allowed';
    if (role.managed) return 'managed_role';
    const bad = role.permissions.has(P.Flags.Administrator) ? ['Administrator']
        : new P(DANGEROUS.filter(f => role.permissions.has(f))).toArray().map(n => n.replace(/([a-z])([A-Z])/g, '$1 $2'));
    if (bad.length) { lastDangerous = bad; return 'dangerous_perms'; }
    const me = guild.members.me;
    if (!me || role.position >= me.roles.highest.position) return 'above_bot';
    if (actor && actor.id !== guild.ownerId && role.position >= actor.roles.highest.position) return 'above_actor';
    return null;
}

module.exports = { validateVerifyRole, GUARD_MSG, DANGEROUS };

// ================= CHANNEL LOCK — shared by /verify setunverified, /verify panel and the dashboard =================
// Denies ViewChannel to the unverified role everywhere except the verification panel.
// The system channel stays open only when there is no panel: the panel's captcha runs in
// a private popup, so once a panel exists no DM fallback is needed. Categories are locked
// too, so channels created in them later inherit it, but they are not counted.
async function applyUnverifiedLock(guild, role, db) {
    let panelId = null;
    try { panelId = db.prepare('SELECT verify_panel_channel_id AS p FROM server_settings WHERE guild_id = ?').get(guild.id)?.p || null; } catch {}
    if (panelId && !guild.channels.cache.has(panelId)) panelId = null;
    const fallbackId = panelId ? null : (guild.systemChannelId || null);
    let locked = 0, failed = 0;
    for (const [, ch] of guild.channels.cache) {
        if (ch.isThread?.()) continue;
        try {
            if (ch.id === panelId) await ch.permissionOverwrites.edit(role, { ViewChannel: true, SendMessages: false, ReadMessageHistory: true });
            else if (ch.id === fallbackId) await ch.permissionOverwrites.edit(role, { ViewChannel: true, SendMessages: true });
            else {
                await ch.permissionOverwrites.edit(role, { ViewChannel: false, SendMessages: false });
                if (ch.type !== 4) locked++;
            }
        } catch { failed++; }
    }
    return { locked, failed, panelId, fallbackId };
}

function lockSummary(r, roleLabel) {
    const lines = [`Unverified role set to ${roleLabel}`, '', `**${r.locked}** channels locked — unverified members can't see them.`];
    if (r.failed) lines.push(`**${r.failed}** channels couldn't be updated — check my role is above the unverified role.`);
    lines.push('');
    if (r.panelId) lines.push(`They only see <#${r.panelId}>, where the captcha runs in a private popup — no DMs needed.`);
    else if (r.fallbackId) lines.push(`⚠️ No verification panel yet, so <#${r.fallbackId}> stays open for members with closed DMs — anyone can skip verification there. Post a panel with \`/verify panel\` to close it.`);
    else lines.push(`⚠️ No verification panel and no system channel — members with closed DMs can't verify. Post a panel with \`/verify panel\`.`);
    lines.push('New members get this role on join, removed the moment they verify. ✨');
    return lines.join('\n');
}

module.exports.applyUnverifiedLock = applyUnverifiedLock;
module.exports.lockSummary = lockSummary;
