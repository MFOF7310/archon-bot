'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// ARCHON CG-223 — WHERE ARCHON'S ROLE SITS
// Posting depends on channel permissions (lib/canPost). Giving roles, timeouts, kicks and bans depend on
// something else: ARCHON's highest role must be ABOVE the role it gives, or the member it acts on.
// Discord often puts a new bot's role near the bottom, so this checks two things:
//   · lowest: ARCHON's role is under every role people actually use (it can't give or moderate anything)
//   · given:  each role ARCHON is set to hand out (member, verification, auto role, daily ranks…) is below it
// Used by the join welcome, /setup, /postcheck all and the dashboard's health card (lib/health-route).
// ═══════════════════════════════════════════════════════════════════════════

// server_settings columns holding a role ARCHON gives to members
const GIVEN = [
    'member_role', 'join_role_id', 'auto_role_id', 'verify_role_id', 'verify_unverified_role_id', 'mute_role_id',
    'daily_initiate_role', 'daily_warrior_role', 'daily_champion_role', 'daily_legend_role',
    'investor_role', 'quiz_master_role', 'duelist_role', 'gamer_role',
    'level_5_role', 'level_10_role', 'level_15_role', 'level_20_role', 'level_25_role',
];

// The roles people use: not @everyone and not roles managed by bots or integrations
const humanRoles = (guild) => [...(guild.roles?.cache?.values?.() || [])].filter((r) => r.id !== guild.id && !r.managed);

function hierarchy(guild) {
    const me = guild.members?.me;
    const top = me?.roles?.highest;
    if (!top) return null;
    const human = humanRoles(guild);
    const above = human.filter((r) => r.position > top.position);
    const below = human.filter((r) => r.position < top.position);
    return {
        roleName: me.roles?.botRole?.name || top.name,
        above: above.length,
        total: human.length,
        // under every role people use (and there is at least one): ARCHON can't give or moderate anything yet
        lowest: above.length > 0 && below.length === 0,
        // examples for the fix: the plain roles just above ARCHON (never admin roles: ARCHON shouldn't sit above those)
        topAbove: above.filter((r) => !r.permissions?.has?.(8n)).sort((a, b) => a.position - b.position).slice(0, 3).map((r) => r.name),
    };
}

// The configured roles ARCHON gives, each with ok | above | missing
function givenRoles(guild, row) {
    const top = guild.members?.me?.roles?.highest?.position ?? 0;
    const out = [];
    const seen = new Set();
    for (const col of GIVEN) {
        const id = row?.[col];
        if (!id || seen.has(String(id))) continue;
        seen.add(String(id));
        const r = guild.roles?.cache?.get(String(id));
        if (!r) out.push({ setting: col, roleId: String(id), roleName: null, status: 'missing' });
        else out.push({ setting: col, roleId: r.id, roleName: r.name, status: r.position >= top ? 'above' : 'ok' });
    }
    return out;
}

// The two sentences shown when ARCHON's role is at the bottom (null when it's fine)
function lowRoleText(guild, lang, h = hierarchy(guild)) {
    if (!h?.lowest) return null;
    const i18n = require('./i18n');
    const clean = (s) => String(s).replace(/[*_~`|>\\]/g, '');
    const roles = h.topAbove.map((n) => `@${clean(n)}`).join(', ');
    return `${i18n.t('postcheck.lowRole', lang, { bot: clean(h.roleName), above: h.above })}\n-# ${i18n.t('postcheck.lowRoleFix', lang, { bot: clean(h.roleName), roles })}`;
}

module.exports = { GIVEN, hierarchy, givenRoles, lowRoleText };
