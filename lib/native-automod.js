'use strict';
// ═══ ARCHON CG-223 — DISCORD'S OWN AUTOMOD, KEPT IN STEP WITH ARCHON'S SETTINGS ═══
// ARCHON writes a few rules into Discord's native AutoMod. Discord then blocks those messages itself, before they are
// posted, even while ARCHON restarts or is offline. ARCHON keeps the smart part (strikes, floods, raids).
//   - the rules follow the server's AutoMod settings: on/off, invite filter, link filter (with the allowed domains),
//     mention limit, exempt roles, ignored channels, the AutoMod log channel (Discord posts its alerts there)
//   - only rules whose name starts with "ARCHON CG-223" are ever created, changed or removed: an admin's own rules stay
//   - a message Discord blocks with one of these rules counts as an AutoMod strike and goes to the logs (onExecution)
const { PermissionsBitField } = require('discord.js');

const PREFIX = 'ARCHON CG-223';
// Rules written by older versions of the bot (it was called ARCHITECT CG-223): ARCHON's too, replaced on the next update
const LEGACY = ['ARCHITECT CG-223'];
const isOurs = (name) => String(name || '').startsWith(PREFIX) || LEGACY.some((p) => String(name || '').startsWith(p));
const NAMES = { preset: 'Core Shield', invites: 'Invite Spam', links: 'Links', scam: 'Scam Shield', mentions: 'Mass Mentions' };
// Words and pieces of links that are always scams on Discord
const SCAM = ['*discordg1ft*', '*free-nitro*', '*nitro-gift*', '*steamm-rewards*', '*steamcommunlty*', '*grabify.*', '*iplogger.*',
    'selfbot', 'self-bot', 'autotyper', 'massdm', 'dm me for nitro', 'free tokens'];
const csv = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
const isId = (v) => /^\d{17,20}$/.test(String(v || ''));

function lang(client, guildId) {
    let l = 'en';
    try { l = require('./pick-lang').pickLang(client, guildId, null); } catch { /* English */ }
    return ['en', 'fr', 'zh', 'ar'].includes(l) ? l : l === 'bm' ? 'fr' : 'en';
}

// The rules this server should have now, from its settings (empty when AutoMod is off)
function desired(guild, s) {
    if (!s?.autoModEnabled) return [];
    const { t } = require('./i18n');
    const L = lang(guild.client, guild.id);
    const msg = (k) => t(`automod.native_${k}`, L).slice(0, 150);
    const alert = isId(s.autoModLogChannel) && guild.channels.cache.has(String(s.autoModLogChannel)) ? String(s.autoModLogChannel)
        : isId(s.modLogChannel) && guild.channels.cache.has(String(s.modLogChannel)) ? String(s.modLogChannel) : null;
    const actions = (k) => [{ type: 1, metadata: { customMessage: msg(k) } }, ...(alert ? [{ type: 2, metadata: { channel: alert } }] : [])];
    const exemptRoles = csv(s.autoModWhitelist).filter(isId).filter((id) => guild.roles.cache.has(id)).slice(0, 20);
    const exemptChannels = csv(s.automodChannels).filter(isId).filter((id) => guild.channels.cache.has(id)).slice(0, 50);
    const base = (key, triggerType, triggerMetadata) => ({
        name: `${PREFIX} • ${NAMES[key]}`, eventType: 1, triggerType, triggerMetadata, actions: actions(key), enabled: true,
        exemptRoles, exemptChannels,
    });

    const rules = [
        base('preset', 4, { presets: [1, 2, 3] }),   // Discord's lists: insults, sexual content, slurs
        base('scam', 1, { keywordFilter: SCAM }),
        base('mentions', 5, { mentionTotalLimit: Math.min(50, Math.max(3, Number(s.mentionLimit) || 10)), mentionRaidProtectionEnabled: true }),
    ];
    if (s.inviteFilterEnabled !== false) {
        rules.push(base('invites', 1, { regexPatterns: ['(discord\\.gg|discord(app)?\\.com/invite)/[a-zA-Z0-9-]+'] }));
    }
    if (s.linkFilterEnabled) {
        // allowed domains don't trigger it: ARCHON's default list (YouTube, TikTok, Tenor…) plus the server's own
        let builtIn = [];
        try { builtIn = [...require('../plugins/automod.js').DEFAULT_DOMAIN_WHITELIST].filter((d) => !d.startsWith('www.')); } catch { /* the server's list only */ }
        const allow = [...new Set([...csv(s.autoModDomains), ...builtIn])].map((d) => `*${d.replace(/^https?:\/\//, '').replace(/^\*+|\*+$/g, '')}*`.slice(0, 60)).slice(0, 100);
        rules.push(base('links', 1, { regexPatterns: ['https?://[^\\s]+'], allowList: allow }));
    }
    return rules;
}

function canManage(guild) {
    return !!guild.members?.me?.permissions?.has(PermissionsBitField.Flags.ManageGuild);
}

// How many rules of each kind Discord allows on a server (keyword, spam, preset lists, mentions, member profile)
const LIMITS = { 1: 6, 3: 1, 4: 1, 5: 1, 6: 1 };
const keyOf = (name) => Object.entries(NAMES).find(([, v]) => name === `${PREFIX} • ${v}`)?.[0] || 'other';

/** Puts Discord's rules in step with the settings.
 *  Returns { ok, created, updated, removed, covered, full, failed, reason }
 *    covered: kinds Discord allows once and the team already has (same protection, nothing to do)
 *    full: keyword rules with no room left (a protection really missing) */
async function sync(guild, settings) {
    const out = { ok: false, created: 0, updated: 0, removed: 0, covered: [], full: [], failed: [], reason: null };
    if (!guild) return { ...out, reason: 'no_guild' };
    if (!canManage(guild)) return { ...out, reason: 'missing_permission' };
    const s = settings || guild.client.getServerSettings?.(guild.id) || {};
    let existing;
    try { existing = await guild.autoModerationRules.fetch(); } catch (e) { return { ...out, reason: 'fetch_failed' }; }
    const want = desired(guild, s);
    let ours = [...existing.values()].filter((r) => isOurs(r.name));
    const others = [...existing.values()].filter((r) => !isOurs(r.name));

    // first take away ours that no longer fit (and the old ones from before, like "Promo Spam"): they free room
    for (const r of ours) {
        if (want.some((w) => w.name === r.name)) continue;
        try { await r.delete('ARCHON AutoMod settings'); out.removed++; } catch (e) { console.log(`[AUTOMOD NATIVE] ${guild.id} delete ${r.name}: ${e.message}`); }
    }
    ours = ours.filter((r) => want.some((w) => w.name === r.name));

    // room left per kind: Discord's limit, minus the team's own rules, minus ours already there
    const used = {};
    for (const r of [...others, ...ours]) used[r.triggerType] = (used[r.triggerType] || 0) + 1;
    for (const r of want) {
        const key = keyOf(r.name);
        const cur = ours.find((x) => x.name === r.name);
        try {
            if (cur) { await cur.edit({ ...r, reason: 'ARCHON AutoMod settings' }); out.updated++; continue; }
            if ((used[r.triggerType] || 0) >= (LIMITS[r.triggerType] || 1)) { ((LIMITS[r.triggerType] || 1) === 1 ? out.covered : out.full).push(key); continue; }   // no room: don't even try
            await guild.autoModerationRules.create({ ...r, reason: 'ARCHON AutoMod settings' });
            used[r.triggerType] = (used[r.triggerType] || 0) + 1;
            out.created++;
        } catch (e) {
            out.failed.push(key);
            console.log(`[AUTOMOD NATIVE] ${guild.id} ${r.name}: ${e.message}`);
        }
    }
    out.ok = out.failed.length === 0 && out.full.length === 0;
    return out;
}

/** Removes ARCHON's rules only. */
async function remove(guild) {
    if (!guild || !canManage(guild)) return { ok: false, removed: 0, reason: 'missing_permission' };
    let removed = 0;
    try {
        const existing = await guild.autoModerationRules.fetch();
        for (const r of existing.values()) if (isOurs(r.name)) { await r.delete('ARCHON AutoMod removed').catch(() => {}); removed++; }
    } catch { return { ok: false, removed, reason: 'fetch_failed' }; }
    return { ok: true, removed };
}

/** What Discord has now, for the dashboard: each of ARCHON's rules is on, off (by the settings), or blocked (no room,
 *  because the team's own rules use Discord's limit for that kind). */
async function status(guild) {
    if (!guild) return { canManage: false, rules: [], others: 0 };
    if (!canManage(guild)) return { canManage: false, rules: [], others: 0 };
    let existing;
    try { existing = await guild.autoModerationRules.fetch(); } catch { return { canManage: true, rules: [], others: 0, error: true }; }
    const all = [...existing.values()];
    const ours = all.filter((r) => r.name.startsWith(PREFIX));
    const others = all.filter((r) => !isOurs(r.name));   // old ARCHITECT rules aren't "the team's": the next update replaces them
    let want = [];
    try { want = desired(guild, guild.client.getServerSettings?.(guild.id) || {}); } catch { /* nothing wanted */ }
    // room taken per kind: the team's rules, plus ARCHON's current rules that will stay
    const usedByOthers = {};
    for (const r of [...others, ...ours.filter((o) => want.some((w) => w.name === o.name))]) usedByOthers[r.triggerType] = (usedByOthers[r.triggerType] || 0) + 1;
    const rules = Object.keys(NAMES).map((key) => {
        const name = `${PREFIX} • ${NAMES[key]}`;
        const live = ours.find((r) => r.name === name);
        if (live) return { key, name, state: live.enabled ? 'on' : 'off' };
        const w = want.find((r) => r.name === name);
        if (!w) return { key, name, state: 'off' };
        const blocked = (usedByOthers[w.triggerType] || 0) >= (LIMITS[w.triggerType] || 1);   // even after the old rules are gone
        if (!blocked) return { key, name, state: 'missing' };
        // a kind Discord allows once: the team's rule of that kind already gives the same protection
        if ((LIMITS[w.triggerType] || 1) === 1) return { key, name, state: 'covered', coveredBy: others.find((r) => r.triggerType === w.triggerType)?.name || null };
        return { key, name, state: 'full' };
    });
    return { canManage: true, rules, others: others.length, othersNames: others.map((r) => r.name).slice(0, 10) };
}

// A message Discord blocked with one of ARCHON's rules: an AutoMod strike, and a line in the moderation log.
// (The warn → mute → ban steps stay with ARCHON's own checks: the next violation it sees counts this strike.)
async function onExecution(execution, client) {
    try {
        if (execution.action?.type !== 1) return;   // the block itself (the alert is a second event for the same message)
        let rule = execution.autoModerationRule;
        if (!rule) rule = await execution.guild.autoModerationRules.fetch(execution.ruleId).catch(() => null);
        if (!isOurs(rule?.name)) return;
        const db = client.db, gid = execution.guild.id, uid = execution.userId;
        const reason = `Discord AutoMod: ${rule.name.replace(/^[A-Z ]+CG-223\s*[•·]\s*/, '')}`;
        const now = Math.floor(Date.now() / 1000);
        db.prepare('INSERT INTO warnings (id,guild_id,user_id,moderator_id,reason,expires_at,active) VALUES (?,?,?,?,?,?,1)')
            .run(`AM-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, gid, uid, client.user.id, reason, now + 2592000);
        db.prepare('INSERT INTO moderation_logs (guild_id,user_id,moderator_id,action,reason,timestamp) VALUES (?,?,?,?,?,?)')
            .run(gid, uid, client.user.id, 'block', reason, now);
    } catch (e) { console.log(`[AUTOMOD NATIVE] execution: ${e.message}`); }
}

// A setting changed (slash or prefix command, Lydia, dashboard): bring Discord's rules in step a few seconds later.
// Several changes in a row make one update.
const pending = new Map();
function schedule(client, guildId) {
    clearTimeout(pending.get(guildId));
    pending.set(guildId, setTimeout(async () => {
        pending.delete(guildId);
        const guild = client.guilds?.cache?.get(String(guildId));
        if (!guild) return;
        try { client.settings?.delete?.(String(guildId)); } catch { /* read fresh */ }
        const s = client.getServerSettings?.(String(guildId)) || {};
        const r = s.autoModEnabled ? await sync(guild, s) : await remove(guild);
        if (r && r.ok === false && r.reason) console.log(`[AUTOMOD NATIVE] ${guildId}: ${r.reason}`);
    }, 3000));
}

module.exports = { sync, remove, status, onExecution, desired, schedule, PREFIX };
