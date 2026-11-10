// lib/core/utils.js — Utility functions
const { PermissionsBitField } = require('discord.js');

module.exports = (client) => {
function checkCooldown(userId, commandName, cooldownMs = 3000) {
    const key = `${userId}:${commandName}`;
    const now = Date.now();
    // The map used to grow forever: forget entries older than 10 minutes once it gets big
    if (client.cooldowns.size > 5000) for (const [k, ts] of client.cooldowns) if (now - ts > 600000) client.cooldowns.delete(k);
    const lastUsed = client.cooldowns.get(key);

    if (lastUsed && (now - lastUsed) < cooldownMs) {
        const remaining = Math.ceil((cooldownMs - (now - lastUsed)) / 1000);
        return { blocked: true, remaining };
    }

    client.cooldowns.set(key, now);
    return { blocked: false };
}

client.checkCooldown = checkCooldown;

// The permissions a command asks of the member: its slash default (setDefaultMemberPermissions) and its userPermissions list
function requiredMemberPerms(command) {
    if (!command || command.ownerOnly || String(command.category || '').toUpperCase() === 'OWNER') return null;
    let bits = 0n;
    try {
        const d = command.data?.default_member_permissions ?? (typeof command.data?.toJSON === 'function' ? command.data.toJSON().default_member_permissions : null);
        if (d !== null && d !== undefined && d !== '') bits |= BigInt(d);
    } catch (_) { /* no slash data */ }
    for (const name of Array.isArray(command.userPermissions) ? command.userPermissions : []) {
        if (PermissionsBitField.Flags[name] !== undefined) bits |= PermissionsBitField.Flags[name];
    }
    return bits ? bits : null;
}



    return { checkCooldown, requiredMemberPerms };
};
