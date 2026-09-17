// lib/verify-guard.js — shared by /verify, onMemberJoin and the dashboard API
const { PermissionsBitField: P } = require('discord.js');

const DANGEROUS = [
    P.Flags.Administrator, P.Flags.ManageGuild, P.Flags.ManageRoles,
    P.Flags.ManageChannels, P.Flags.ManageWebhooks, P.Flags.BanMembers,
    P.Flags.KickMembers, P.Flags.ModerateMembers, P.Flags.MentionEveryone
];

const GUARD_MSG = {
    role_missing: 'role not found.',
    everyone_not_allowed: '@everyone cannot be used.',
    managed_role: 'bot/integration roles cannot be used.',
    dangerous_perms: 'this role has moderation/admin permissions.',
    above_bot: 'this role is above my highest role.',
    above_actor: 'this role is at or above your highest role.'
};

function validateVerifyRole(guild, role, actor) {
    if (!guild || !role) return 'role_missing';
    if (role.id === guild.id) return 'everyone_not_allowed';
    if (role.managed) return 'managed_role';
    if (DANGEROUS.some(f => role.permissions.has(f))) return 'dangerous_perms';
    const me = guild.members.me;
    if (!me || role.position >= me.roles.highest.position) return 'above_bot';
    if (actor && actor.id !== guild.ownerId && role.position >= actor.roles.highest.position) return 'above_actor';
    return null;
}

module.exports = { validateVerifyRole, GUARD_MSG, DANGEROUS };
