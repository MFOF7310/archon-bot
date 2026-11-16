#!/usr/bin/env node
'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// Keeps config/emojis.js tidy: every emoji in its category, sorted by name, one per line.
//   node scripts/emojis-tidy.js                 tidies config/emojis.js
//   node scripts/emojis-tidy.js <file>          tidies another file (config/emojis.example.js, for instance)
// Runs by itself after new emojis arrive: scripts/missing-icons.sh, scripts/upload-emoji.js and the start-up sync
// (lib/emoji-sync). A new emoji goes to its category by its name (rules below); one no rule knows goes to
// "Interface icons" when its name starts with ic_, else to "Other".
// Nothing is lost: every key keeps its value, the new file is checked before it replaces the old one,
// and the old one is kept next to it as emojis.js.bak.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const any = (...names) => (k) => names.includes(k);
const re = (r) => (k) => r.test(k);

// The first section whose rule matches gets the emoji
const SECTIONS = [
    ['Status and feedback', [
        any('small_check', 'small_cross', 'check', 'success', 'error', 'warning', 'loading', 'online', 'offline', 'verified', 'hint', 'info', 'note', 'hubInfo', 'minus', 'flash', 'red_color', 'screaminggreen'),
        re(/^ic_(ok|warn|wait|alive|on|off|toggle_off|status_\w+|info|verified)$/), re(/^dot_/),
    ]],
    ['Buttons and navigation', [
        any('trash_can'),
        re(/^ic_(back|next|chevron_\w+|refresh|add|remove|edit|trash|send|link|sync|skip|clear|join|pin|file|folder|share)$/),
    ]],
    ['Moderation and safety', [
        any('automod', 'banAlert', 'mod_sign', 'staff', 'mute', 'timeout', 'shield', 'lock', 'role', 'rules', 'rules_icon', 'ticket', 'badge', 'ownerroleicon', 'developericon', 'bluetools', 'partnericon', 'boostericon'),
        re(/^ic_(gate|shield\w*|user_check|user_x|ban|gavel|lock|unlock|minage|ticket|rules|log|config|setup|admin|owner|settings|role)$/),
    ]],
    ['Server, channels and members', [
        any('welcome', 'goodbye', 'member', 'myprofile', 'dashboard', 'home_1', 'discordserver', 'globe', 'location', 'notification', 'clock', 'alarm'),
        re(/^ic_(channel|hash|door_enter|door_exit|general|daily|levelup|updates|category|world|language|user|users|calendar|bell|bell_off|dashboard|builds|profile|database|satellite|system|utility|palette|hand)$/),
    ]],
    ['Economy and rewards', [
        any('cashmoney', 'coins', 'coins_5', 'invest', 'investors', 'moneybag', 'claim', 'trophy', 'trophy_01', 'crown', 'redcrown', 'yellowcrown', 'greencrown', 'premium', 'milestones', 'streak', 'streaks2', 'xp', 'level', 'progress', 'charts', 'vote', 'star', 'digging'),
        re(/^ic_(gift|bag|shop|credit|economy|coin|vip|chart|trophy|streak|star|rocket)$/),
    ]],
    ['Games', [
        any('hubWheel', 'hubSparkle', 'dart', 'duelist', 'quizmaster', 'gamer', 'club_battle', 'speed'),
        re(/^(game|roulette|trivia|diff)[A-Z0-9]/), re(/^cat[A-Z]/), re(/^ic_(dice|games|gaming|codm|fun|ghost|car|paw|coin)$/),
    ]],
    ['Duel and clan wars', [
        re(/^duel_/), re(/^ic_(swords|heal|bolt|flame|win|loss|draw|history|target|tool)$/),
    ]],
    ['Music and media', [
        any('music', 'spotify', 'youtube', 'livestream', 'soundcloud', 'tiktok_logo', 'micro_2', 'folder'),
        re(/^mc_/), re(/^ic_(live|youtube|video|music|broadcast)$/),
    ]],
    ['Social and links', [
        any('whatsapp', 'facebook', 'instagram', 'discord', 'website', 'blurple'),
        re(/^ic_(github|discord|code|social)$/),
    ]],
    ['AI', [any('ai_assistant'), re(/^ic_(brain|bot|oracle)$/)]],
    ['AFK and sleep', [any('afk', 'sleep', 'away', 'moon', 'zzz'), re(/^ic_moon$/)]],
    ['ARCHON and Mali', [
        any('eagle', 'bamako', 'bamako_1', 'archon_bot', 'mountain_1'),
        re(/^ic_(mali|bamako|architect|steel|pioneer|mystery)$/),
    ]],
    ['Reactions and fun', [
        any('party', 'party_2', 'wave', 'clapping', 'aoLiGei', 'slowly', 'purpleDot', 'ducky_hey', 'hey', 'cake', 'shapes_dancing', 'shapes', 'humurous1', 'coffee_1', 'cat_1'),
    ]],
    ['Help menu', [re(/^help[A-Z]/)]],
    ['Interface icons', [re(/^ic_/)]],
    ['Other', [() => true]],
];

function sectionOf(key) {
    return SECTIONS.find(([, rules]) => rules.some((r) => r(key)))[0];
}

function load(file) {
    const sandbox = { module: { exports: {} } };
    sandbox.exports = sandbox.module.exports;
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
    return sandbox.module.exports;
}

const keyText = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k));
const valueText = (v) => "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

function render(obj, example) {
    const groups = new Map(SECTIONS.map(([name]) => [name, []]));
    for (const k of Object.keys(obj)) groups.get(sectionOf(k)).push(k);
    const out = [
        '/**',
        ' * ARCHON CG-223 — emoji registry' + (example ? ' (template: copy to config/emojis.js and put your own emoji IDs)' : ''),
        ' *',
        ' * One emoji per line, by category, sorted by name. New emojis are put in their category by',
        ' * scripts/emojis-tidy.js (it runs after missing-icons.sh, upload-emoji.js and the start-up sync).',
        ` * Last tidied: ${new Date().toISOString()}`,
        ' */',
        '',
        'module.exports = {',
    ];
    for (const [name, keys] of groups) {
        if (!keys.length) continue;
        keys.sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
        out.push(`    // ── ${name} ──`);
        for (const k of keys) out.push(`    ${keyText(k)}: ${valueText(obj[k])},`);
        out.push('');
    }
    if (out[out.length - 1] === '') out.pop();
    out.push('};', '');
    return out.join('\n');
}

function tidy(file = path.join(__dirname, '..', 'config', 'emojis.js')) {
    const before = load(file);
    const text = render(before, /example/.test(path.basename(file)));
    const sandbox = { module: { exports: {} } };
    vm.runInNewContext(text, sandbox);   // the new file must parse and hold exactly the same emojis
    const after = sandbox.module.exports;
    const same = Object.keys(before).length === Object.keys(after).length && Object.keys(before).every((k) => after[k] === before[k]);
    if (!same) throw new Error('the tidied file would differ from the original: left as it was');
    fs.copyFileSync(file, file + '.bak');
    fs.writeFileSync(file, text, 'utf8');
    return Object.keys(after).length;
}

module.exports = { tidy, sectionOf, SECTIONS };

if (require.main === module) {
    const file = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
    try {
        const n = tidy(file);
        console.log(`✅ ${n} emojis tidied by category in ${path.relative(process.cwd(), file || path.join(__dirname, '..', 'config', 'emojis.js'))}`);
    } catch (e) {
        console.log(`❌ Not tidied: ${e.message}`);
        process.exit(1);
    }
}
