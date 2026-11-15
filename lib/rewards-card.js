'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// ARCHON — A MEMBER'S REWARD ROLES ON THIS SERVER (replaces the old .myroles "dossier", which read roles nobody had)
// The reward roles set in /roles (levels, daily streaks, economy): which ones the member has, and for the others how
// to get them, with their progress (level 6 / 10, 4 / 7 days). Only roles that exist on the server are shown.
// Opened from /profile (Rewards button) and with .myroles / .badges / .tiers. Texts: lang/<l>/rewards.json
// ═══════════════════════════════════════════════════════════════════════════
const R = require('./role-rules');
const { t } = require('./i18n');
const { icon } = require('./ui/icons');
const { card } = require('./games/v2');

const GOLD = 0xBA7517;
const LEVELS = [['level5', 5], ['level10', 10], ['level15', 15], ['level20', 20], ['level25', 25]];
const DAILY = [['dailyinitiate', 3], ['dailywarrior', 7], ['dailychampion', 30], ['dailylegend', 100]];
const ECONOMY = ['investor', 'quizmaster', 'duelist'];
const W = (k, lang, v) => t(`rewards.${k}`, lang, v || {});
const bar = (n, of) => { const f = Math.max(0, Math.min(10, Math.round((n / of) * 10))); return `\`${'▰'.repeat(f)}${'▱'.repeat(10 - f)}\``; };

function stats(db, uid, gid) {
    let row = {};
    try { row = db.prepare('SELECT xp, level, streak_days FROM users WHERE id = ? AND guild_id = ?').get(uid, gid) || {}; } catch { row = {}; }
    let level = Number(row.level || 1);
    try { level = Math.max(level, require('./games/progress').levelFromXp(row.xp || 0)); } catch { /* the saved level */ }
    return { level, streak: Number(row.streak_days || 0) };
}

// viewerCanManage: the "create them with /roles" hint when nothing is set up
function build(client, guild, member, lang, viewerCanManage = false) {
    const db = client.db;
    const slots = R.readSlots(db, guild.id);
    const role = (key) => (slots[key] ? guild.roles.cache.get(String(slots[key])) : null);
    const { level, streak } = stats(db, member.id, guild.id);
    const has = (r) => member.roles.cache.has(r.id);
    let owned = 0, total = 0;
    const next = [];   // [distance, text] of what is still to get

    const levelLines = [];
    let firstMissingLevel = true;
    for (const [key, need] of LEVELS) {
        const r = role(key); if (!r) continue;
        total++;
        if (has(r)) { owned++; levelLines.push(`${icon('ok', guild)} <@&${r.id}>`); continue; }
        if (level >= need) { levelLines.push(`○ <@&${r.id}> · ${W('reached', lang)}`); continue; }
        let line = `○ <@&${r.id}> · ${W('levelOf', lang, { n: level, of: need })}`;
        if (firstMissingLevel) { line += `\n${bar(level, need)}`; next.push([need - level, W('nextLevel', lang, { role: `<@&${r.id}>`, n: need - level })]); firstMissingLevel = false; }
        levelLines.push(line);
    }

    const dailyLines = [];
    let firstMissingDaily = true;
    for (const [key, need] of DAILY) {
        const r = role(key); if (!r) continue;
        total++;
        if (has(r)) { owned++; dailyLines.push(`${icon('ok', guild)} <@&${r.id}>`); continue; }
        let line = `○ <@&${r.id}> · ${W('daysOf', lang, { n: streak, of: need })}`;
        if (firstMissingDaily && streak < need) { line += `\n${bar(streak, need)}`; next.push([need - streak, W('nextDaily', lang, { role: `<@&${r.id}>`, n: need - streak })]); firstMissingDaily = false; }
        dailyLines.push(line);
    }

    const ecoLines = [];
    for (const key of ECONOMY) {
        const r = role(key); if (!r) continue;
        total++;
        if (has(r)) { owned++; ecoLines.push(`${icon('ok', guild)} <@&${r.id}>`); continue; }
        ecoLines.push(`○ <@&${r.id}> · ${t(`roles.hints.${key}`, lang)}`);
    }

    const head = `-# ARCHON · ${W('title', lang)}\n### ${icon('trophy', guild)} ${W('heading', lang, { user: String(member.displayName).replace(/[*_~`|>\\]/g, '') })}`;
    if (!total) {
        return card(0x888780, [{ text: `${head}\n${W('none', lang)}${viewerCanManage ? `\n-# ${W('noneAdmin', lang)}` : ''}` }]);
    }
    const items = [{ thumbnail: [`${head}\n-# ${W('summary', lang, { n: owned, total, level, streak })}`, member.displayAvatarURL({ size: 128, extension: 'png' })] }];
    for (const [k, lines] of [['levels', levelLines], ['daily', dailyLines], ['economy', ecoLines]]) {
        if (!lines.length) continue;
        items.push({ rule: true }, { text: `**${W(k, lang)}**\n${lines.join('\n')}` });
    }
    next.sort((a, b) => a[0] - b[0]);
    if (next.length) items.push({ text: `-# ${W('next', lang, { what: next[0][1] })}` });
    else if (owned === total) items.push({ text: `-# ${W('all', lang)}` });
    return card(GOLD, items);
}

module.exports = { build };
