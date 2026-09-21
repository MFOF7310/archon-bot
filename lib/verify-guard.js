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
