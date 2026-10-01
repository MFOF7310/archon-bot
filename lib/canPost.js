// lib/canPost.js — ARCHON CG-223
// Global channel-access diagnostic.
//   diagnose(guild, channel, me, needed?) → structured result for user-facing replies
//   log(guild, channel, me, context, needed?) → diagnose + warn ONCE per boot (for silent background paths)
const { PermissionFlagsBits } = require('discord.js');

const NEEDED = [
    ['View Channel', PermissionFlagsBits.ViewChannel],
    ['Send Messages', PermissionFlagsBits.SendMessages],
    ['Embed Links', PermissionFlagsBits.EmbedLinks],
];

const REASON_SUFFIX = { private: 'Private', role_block: 'RoleBlock', missing_perm: 'MissingPerm' };
const keyFor = (prefix, reason) => prefix + (REASON_SUFFIX[reason] || 'Private');

function diagnose(guild, channel, me, needed = NEEDED) {
    const chPerms = channel.permissionsFor(me);
    const missing = needed.filter(([, bit]) => !chPerms?.has(bit)).map(([name]) => name);
    if (missing.length === 0) return { ok: true };

    const missingGuild = needed.filter(([, bit]) => !me.permissions.has(bit)).map(([name]) => name);

    if (missingGuild.length === 0) {
        if (missing.includes('View Channel')) {
            return { ok: false, reason: 'private', key: keyFor('cantPost', 'private'), missing };
        }
        let role = null;
        for (const ow of channel.permissionOverwrites.cache.values()) {
            const applies = (ow.type === 0 && me.roles.cache.has(ow.id)) || (ow.type === 1 && ow.id === me.id);
            if (!applies || !needed.some(([, bit]) => ow.deny.has(bit))) continue;
            const fmt = (name) => name?.startsWith('@') ? name : '@' + (name || 'role');
            role = ow.type === 0 ? fmt(guild.roles.cache.get(ow.id)?.name) : fmt(guild.members.cache.get(ow.id)?.displayName || 'member');
            break;
        }
        return { ok: false, reason: 'role_block', key: keyFor('cantPost', 'role_block'), missing, role };
    }
    return { ok: false, reason: 'missing_perm', key: keyFor('cantPost', 'missing_perm'), missing: missingGuild };
}

const warned = new Set();
function log(guild, channel, me, context = 'bot', needed = NEEDED) {
    const d = diagnose(guild, channel, me, needed);
    if (!d.ok) {
        const id = `${context}:${guild.id}:${channel.id}:${d.reason}`;
        if (!warned.has(id)) {
            warned.add(id);
            const fix = d.reason === 'private' ? 'channel is private — add the ARCHON role to its permissions'
                : d.reason === 'role_block' ? `${d.role || 'an override'} is denying ${d.missing.join(', ')} — add the ARCHON role with allow`
                : `role missing ${d.missing.join(', ')} server-wide — Server Settings → Roles → ARCHON`;
            console.warn(`[canPost] ${context} blocked in #${channel.name} (${guild.name}): ${fix}.`);
        }
    }
    return d;
}

// Localized permission display names (Discord's own fr/zh client wording).
// Arabic has no Discord UI — English labels are what admins actually see, so ar maps to itself.
const PERM_LOCALE = {
    fr: { 'View Channel': 'Voir le salon', 'Send Messages': 'Envoyer des messages', 'Embed Links': 'Intégrer des liens', 'Manage Channels': 'Gérer les salons', 'Manage Roles': 'Gérer les rôles', 'Attach Files': 'Joindre des fichiers' },
    zh: { 'View Channel': '查看频道', 'Send Messages': '发送消息', 'Embed Links': '嵌入链接', 'Manage Channels': '管理频道', 'Manage Roles': '管理身份组', 'Attach Files': '上传文件' },
};
const localize = (names, lang) => names.map(n => (PERM_LOCALE[lang] || {})[n] || n);

module.exports = { diagnose, log, keyFor, localize, NEEDED };
