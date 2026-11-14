'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// ARCHON — WHO MAY DO WHAT (members, not the bot: lib/botPerms covers what ARCHON itself is missing)
// One list of actions, each with the precise Discord permission it needs, so every plugin applies the same rule and
// every refusal names exactly what is missing. The server owner may always; so may Administrator (Discord counts it
// as every permission), but Administrator is never required where a narrower permission fits.
//
//   can(member, action)        → { ok, missing: ['Manage Roles', …] }
//   deny(member, action, lang) → null when allowed, else the text to send ("🔒 You need Manage Roles…")
//   names(list, lang)          → permission names as Discord shows them in that language
//
// Texts: lang/<l>/access.json. scripts/access-audit.js lists the hand-written Administrator checks left in plugins.
// ═══════════════════════════════════════════════════════════════════════════
const { PermissionFlagsBits: P } = require('discord.js');

const ACTIONS = {
    settings: [['Manage Server', P.ManageGuild]],                                   // ARCHON's settings on this server
    roles:    [['Manage Server', P.ManageGuild], ['Manage Roles', P.ManageRoles]],  // pick or create roles ARCHON gives
    automod:  [['Manage Server', P.ManageGuild]],
    alerts:   [['Manage Server', P.ManageGuild]],                                   // YouTube / TikTok alerts
    messages: [['Manage Messages', P.ManageMessages]],
    timeout:  [['Timeout Members', P.ModerateMembers]],
    kick:     [['Kick Members', P.KickMembers]],
    ban:      [['Ban Members', P.BanMembers]],
    reset:    [['Administrator', P.Administrator]],                                 // erase every ARCHON setting at once
};

// Discord's own names for these permissions
const LABELS = {
    fr: { 'Administrator': 'Administrateur', 'Manage Server': 'Gérer le serveur', 'Manage Roles': 'Gérer les rôles', 'Manage Channels': 'Gérer les salons',
        'Manage Messages': 'Gérer les messages', 'Timeout Members': 'Exclure temporairement des membres', 'Kick Members': 'Expulser des membres', 'Ban Members': 'Bannir des membres' },
    zh: { 'Administrator': '管理员', 'Manage Server': '管理服务器', 'Manage Roles': '管理身份组', 'Manage Channels': '管理频道',
        'Manage Messages': '管理消息', 'Timeout Members': '禁言成员', 'Kick Members': '踢出成员', 'Ban Members': '封禁成员' },
    ar: { 'Administrator': 'المسؤول', 'Manage Server': 'إدارة الخادم', 'Manage Roles': 'إدارة الأدوار', 'Manage Channels': 'إدارة القنوات',
        'Manage Messages': 'إدارة الرسائل', 'Timeout Members': 'إسكات الأعضاء مؤقتاً', 'Kick Members': 'طرد الأعضاء', 'Ban Members': 'حظر الأعضاء' },
};
const names = (list, lang) => (list || []).map((n) => LABELS[lang]?.[n] || n);

function can(member, action) {
    const need = ACTIONS[action];
    if (!need) throw new Error(`access: unknown action "${action}"`);
    if (!member) return { ok: false, missing: need.map(([n]) => n) };
    if (member.guild?.ownerId && member.guild.ownerId === member.id) return { ok: true, missing: [] };
    const p = member.permissions;
    const missing = need.filter(([, bit]) => !p?.has?.(bit)).map(([n]) => n);   // has() counts Administrator as every permission
    return { ok: missing.length === 0, missing };
}

function deny(member, action, lang = 'en') {
    const r = can(member, action);
    if (r.ok) return null;
    const i18n = require('./i18n');
    const list = names(r.missing, lang);
    const key = list.length > 1 ? 'need_many' : 'need_one';
    return `${i18n.t(`access.${key}`, lang, { perms: list.map((n) => `**${n}**`).join(lang === 'zh' ? '、' : ' + ') })}\n-# ${i18n.t('access.hint', lang)}`;
}

module.exports = { ACTIONS, can, deny, names };
