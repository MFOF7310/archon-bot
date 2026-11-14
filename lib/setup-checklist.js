'use strict';
// ═══════════════════════════════════════════════════════════════════════
// SETUP CHECKLIST — what is set up on a server and what is left, computed from the real settings.
// One source of truth for /setup (the card admins see) and for Lydia (what she may tell an admin).
// Read only: nothing here changes a setting.
//   compute(client, guild) → { items: [{ key, level, done, problem, panel }], doneCount, total, coreLeft }
//     level: 'core' (a new server needs it) · 'recommended' · 'optional'
//     problem: a short reason key when it is set but doesn't work (e.g. 'perm' = ARCHON can't post there)
//     panel: where to fix it: 'channels' · 'roles' · 'welcome' · 'language' · 'verify' · 'discord'
//   summaryText(result, lang) → plain lines for Lydia ("✓ Welcome card: #bienvenue")
// ═══════════════════════════════════════════════════════════════════════
const canPost = require('./canPost');

function row(db, gid) {
    try { return db.prepare('SELECT * FROM server_settings WHERE guild_id = ?').get(gid) || {}; } catch { return {}; }
}

// a channel setting: { done, problem } — set, exists, and ARCHON can do what that feature needs there
function channelState(guild, id, feature) {
    if (!id) return { done: false };
    const ch = guild.channels.cache.get(String(id));
    if (!ch) return { done: false, problem: 'gone' };
    if (!feature) return { done: true };
    const d = canPost.diagnose(guild, ch, guild.members.me, feature === 'see' ? [canPost.PERMS.view] : canPost.neededFor(feature));
    return d.ok ? { done: true } : { done: false, problem: d.reason === 'private' ? 'private' : 'perm' };
}

function compute(client, guild) {
    const db = client.db;
    const s = row(db, guild.id);
    const items = [];
    const add = (key, level, state, panel, detail) => items.push({ key, level, done: !!state.done, problem: state.problem || null, panel, detail: detail || null });

    // core: what every server needs on day one
    let low = null;
    try { low = require('./role-check').hierarchy(guild); } catch { /* no role check */ }
    add('botRole', 'core', { done: !low?.lowest, problem: low?.lowest ? 'low' : null }, 'discord');
    const rulesId = s.rules_channel || guild.rulesChannelId || null;
    add('rules', 'core', channelState(guild, rulesId, 'see'), 'channels', rulesId);
    const welcomeOn = s.welcome_enabled !== 0;
    const w = channelState(guild, s.welcome_channel, 'welcome');
    add('welcome', 'core', welcomeOn ? w : { done: false, problem: 'off' }, 'welcome', s.welcome_channel);
    let roles = {};
    try { roles = require('./role-rules').readSlots(db, guild.id); } catch { roles = {}; }
    const auto = roles.autorole ? guild.roles.cache.get(String(roles.autorole)) : null;
    let autoProblem = roles.autorole && !auto ? 'gone' : null;
    if (auto) { try { if (require('./role-rules').checkRole(guild, auto, 'grant', null)) autoProblem = 'unsafe'; } catch { /* checked elsewhere */ } }
    add('memberRole', 'core', { done: !!auto && !autoProblem, problem: autoProblem }, 'roles', roles.autorole);
    add('modlog', 'core', channelState(guild, s.mod_log_channel, 'modlog'), 'channels', s.mod_log_channel);

    // recommended: makes the server feel alive
    add('general', 'recommended', channelState(guild, s.general_channel, 'see'), 'channels', s.general_channel);
    add('goodbye', 'recommended', s.goodbye_enabled === 0 ? { done: false, problem: 'off' } : channelState(guild, s.goodbye_channel, 'goodbye'), 'welcome', s.goodbye_channel);
    add('levelup', 'recommended', channelState(guild, s.levelup_channel, 'levelup-milestone'), 'channels', s.levelup_channel);
    // no language item: 'auto' (each member's own language) is a real choice and the default, so there is nothing to fix
    add('staff', 'recommended', { done: !!roles.staff && guild.roles.cache.has(String(roles.staff)) }, 'roles', roles.staff);

    // optional
    add('daily', 'optional', channelState(guild, s.daily_channel, null), 'channels', s.daily_channel);
    let premium = false;
    try { premium = require('../plugins/premium.js').isPremium(db, guild.id); } catch { premium = false; }
    if (premium) {
        // on: the gate really works (its roles exist and are safe, verify.js gateActive) and its panel channel still exists
        let state = { done: false };
        if (s.verify_enabled) {
            let works = false;
            try { works = require('../plugins/verify.js').gateActive(guild, db); } catch { works = false; }
            const panelGone = s.verify_panel_channel_id && !guild.channels.cache.has(String(s.verify_panel_channel_id));
            state = !works ? { done: false, problem: 'verifyRoles' } : panelGone ? { done: false, problem: 'verifyPanel' } : { done: true };
        }
        add('verify', 'optional', state, 'verify');
    }

    const doneCount = items.filter((i) => i.done).length;
    return { items, doneCount, total: items.length, coreLeft: items.filter((i) => i.level === 'core' && !i.done).length };
}

// Plain lines for Lydia: what is set, what is missing, where to fix it. Never IDs of private things beyond mentions.
function summaryText(result, lang) {
    const { t } = require('./i18n');
    const L = (k, v) => t(`setup.check.${k}`, lang, v || {});
    return result.items.map((i) => {
        const where = L(`panel_${i.panel}`);
        const state = i.done ? '✓' : i.problem ? `! ${L(`problem_${i.problem}`)}` : `✗ ${L('notSet')}`;
        return `${state} · ${L(`item_${i.key}`)} (${L(`level_${i.level}`)})${i.done ? '' : ` → ${where}`}`;
    }).join('\n');
}

module.exports = { compute, summaryText };
