'use strict';
// /bot: ping, stats, activity, about and invite in one slash command (V2 cards, texts in lang/<locale>/bot.json).
// Replaces ping.js, stats.js, botstats-cmd.js, about.js and invite.js. The old prefix names (!ping, !stats, !about…) still work.
// Refresh buttons use customId "bot:<sub>" and are routed from index.js, so they keep working after a restart.
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { performance } = require('perf_hooks');
const os = require('os');
const { t, slashLang, LANGS } = require('../lib/i18n');
const v2 = require('../lib/games/v2');
const ui = require('../lib/games/ui');
const E = require('../config/emojis');
const BotStats = require('./bot-stats.js');

const SUPPORT_URL = 'https://discord.gg/NFSMFJajp9';
const DASHBOARD_URL = 'https://bamako-steel-dev.xyz';
const GITHUB_URL = 'https://github.com/MFOF7310';
const REFRESH_PAUSE_MS = 3000;
const COLOR = { ok: 0x2ecc71, warn: 0xf1c40f, bad: 0xe74c3c, wait: 0x95a5a6, info: 0x5865f2 };

// Prefix words for each subcommand. Words already used by other plugins (info, link, status, credits…) are left out.
const SUB_ALIASES = {
    ping: ['ping', 'pong', 'latency', 'lag', 'pongue'],
    alive: ['alive', 'status', 'health', 'uptime', 'enligne', 'etat', 'sante'],
    stats: ['stats', 'statistiques', 'sysinfo', 'systemstats', 'diagnostics'],
    activity: ['botstats', 'bs', 'bstats', 'archonstats', 'activity', 'activite'],
    about: ['about', 'apropos', 'botinfo'],
    invite: ['invite', 'inviter', 'invitelink'],
};

const em = (k, fb = '') => E[k] || fb;
const tr = (lang) => (k, vars) => t('bot.' + k, lang, vars || {});
const foot = (client) => `-# ARCHON CG-223 · v${version(client)}`;
const inviteUrl = (client) => require('../lib/invite').inviteUrl(client.user.id);
const voteUrl = (client) => `https://top.gg/bot/${client.user.id}/vote`;

function version(client) {
    if (client.version) return client.version;
    try { return require('../package.json').version; } catch (e) { return '?'; }
}

function uptime(sec) {
    const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
    return d ? `${d}d ${h}h` : h ? `${h}h ${m}min` : `${m} min`;
}

function linkBtn(label, url, emKey, fb) {
    const b = new ButtonBuilder().setLabel(label).setStyle(ButtonStyle.Link).setURL(url);
    const e = ui.emObj(emKey, fb);
    if (e) b.setEmoji(e);
    return b;
}

function actBtn(label, id, emKey, fb) {
    const b = new ButtonBuilder().setLabel(label).setStyle(ButtonStyle.Secondary).setCustomId(id);
    const e = ui.emObj(emKey, fb);
    if (e) b.setEmoji(e);
    return b;
}

// ─── Ping ───
async function measure(client, db) {
    const t0 = performance.now();
    try { await client.application.fetch(); } catch (e) { /* still report the time */ }
    const rest = Math.round(performance.now() - t0);
    const api = client.ws?.ping > 0 ? Math.round(client.ws.ping) : null; // -1 until the first heartbeat after a restart
    let database = null;
    try { const d0 = performance.now(); db.prepare('SELECT 1').get(); database = Math.round(performance.now() - d0); } catch (e) { /* shown as — */ }
    return { rest, api, database };
}

const tierOf = (ms, good, ok) => (ms == null || !(ms >= 0)) ? 'wait' : ms < good ? 'ok' : ms < ok ? 'warn' : 'bad';
const DOT = { ok: () => em('ping_ok', '🟢'), warn: () => em('ping_warn', '🟡'), bad: () => em('ping_bad', '🔴'), wait: () => em('ping_wait', '⏳') };

async function pingCard(client, lang, db) {
    const _ = tr(lang);
    const m = await measure(client, db);
    const tiers = [tierOf(m.rest, 300, 700), tierOf(m.api, 120, 300), tierOf(m.database, 30, 80)];
    const state = ['bad', 'warn', 'ok'].find(x => tiers.includes(x)) || 'ok';
    const val = (ms) => ms == null ? '—' : `${ms} ms`;
    return v2.card(COLOR[state], [
        { text: `## ${em('ic_satellite', '📡')} ${_('ping_title')}\n${_('ping_' + state, { ms: m.rest })}` },
        { rule: true },
        { text: [
            `${DOT[tiers[0]]()} **${_('ping_reply')}** ${em('dot_white', '·')} ${val(m.rest)}`,
            `${DOT[tiers[1]]()} **${_('ping_gateway')}** ${em('dot_white', '·')} ${val(m.api)}`,
            `${DOT[tiers[2]]()} **${_('ping_db')}** ${em('dot_white', '·')} ${val(m.database)}`,
            `${em('clock', '🕐')} **${_('uptime')}** ${uptime(process.uptime())}`,
        ].join('\n') },
        { rule: true },
        { row: new ActionRowBuilder().addComponents(actBtn(_('btn_again'), 'bot:ping', 'ic_refresh', '🔄')) },
        { text: foot(client) },
    ]);
}

// ─── Stats (the whole bot) ───
function loopLag() {
    const start = Date.now();
    return new Promise(r => setTimeout(() => r(Math.max(0, Date.now() - start - 50)), 50));
}

async function statsCard(client, lang, db, guildId) {
    const _ = tr(lang);
    const guilds = client.guilds.cache.size;
    const members = client.guilds.cache.reduce((a, g) => a + (g.memberCount || 0), 0);
    const mem = Math.round(process.memoryUsage().heapUsed / 1048576);
    const api = client.ws?.ping > 0 ? Math.round(client.ws.ping) : null;
    const lag = await loopLag();
    let dbOk = true;
    try { db.prepare('SELECT 1').get(); } catch (e) { dbOk = false; }
    const aiOk = !!(process.env.OPENROUTER_API_KEY || process.env.GROQ_API_KEY);
    let games = 0, wins = 0, credits = 0;
    try {
        const g = db.prepare('SELECT SUM(games_played) AS g, SUM(games_won) AS w, SUM(credits) AS c FROM users').get();
        games = g?.g || 0; wins = g?.w || 0; credits = g?.c || 0;
    } catch (e) { /* columns missing on an old database: show zeros */ }

    const state = (!dbOk || !aiOk || (api && api > 300) || lag > 100) ? 'bad' : ((api && api > 120) || lag > 50) ? 'warn' : 'ok';
    const on = (ok) => ok ? em('ic_online', em('online', '🟢')) : em('ic_offline', em('offline', '🔴'));
    const n = (x) => Number(x).toLocaleString();

    return v2.card(COLOR[state], [
        { text: `## ${em('developericon', '📊')} ${_('stats_title')}\n${_('stats_' + state, { guilds: n(guilds), members: n(members) })}` },
        { rule: true },
        { text: [
            `**${_('servers')}** · ${n(guilds)}  ·  **${_('members')}** · ${n(members)}`,
            `**${_('commands')}** · ${n(client.commands?.size || 0)}  ·  **${_('memory')}** · ${mem} MB`,
            `**${_('prefix')}** · \`${(client.getServerSettings?.(guildId)?.prefix) || process.env.PREFIX || '.'}\``,
            `${em('clock', '🕐')} **${_('uptime')}** ${uptime(process.uptime())}    **${_('ping_gateway')}** ${api == null ? '—' : api + ' ms'}`,
        ].join('\n') },
        { rule: true },
        { text: `**${_('services')}**\n${on(aiOk)} ${_('svc_ai')} ${em('dot_white', '·')} ${on(dbOk)} ${_('svc_db')} ${em('dot_white', '·')} ${on(lag <= 50)} ${_('svc_loop', { ms: lag })}` },
        { rule: true },
        { text: `**${_('global_title')}**\n${_('games')} ${em('dot_white', '·')} ${n(games)}    ${_('win_rate')} ${em('dot_white', '·')} ${games ? Math.round(wins / games * 100) : 0}%\n${_('credits')} ${em('dot_white', '·')} ${n(credits)}` },
        { row: new ActionRowBuilder().addComponents(actBtn(_('btn_refresh'), 'bot:stats', 'ic_refresh', '🔄')) },
        { text: foot(client) },
    ]);
}

// ─── Activity (ARCHON's own level and counters in this server) ───
// Commands used on this server between two times, with ".quiz" and "/trivia" counted as the same command
function weekUsage(client, db, gid, from, to) {
    const alias = new Map();
    for (const c of client.commands?.values?.() || []) {
        const name = String(c.name || c.data?.name || '').toLowerCase(); if (!name) continue;
        for (const a of c.aliases || []) alias.set(String(a).toLowerCase(), name);
        const slash = c.data?.name ? String(c.data.name).toLowerCase() : null;
        if (slash && slash !== name) alias.set(slash, name);
    }
    const by = new Map(); let total = 0, people = 0;
    try {
        for (const r of db.prepare('SELECT command, COUNT(*) AS n FROM command_events WHERE guild_id = ? AND ts >= ? AND ts < ? GROUP BY command').all(gid, from, to)) {
            const k = alias.get(String(r.command).toLowerCase()) || String(r.command).toLowerCase();
            by.set(k, (by.get(k) || 0) + r.n); total += r.n;
        }
        people = db.prepare('SELECT COUNT(DISTINCT user_id) AS n FROM command_events WHERE guild_id = ? AND ts >= ? AND ts < ?').get(gid, from, to)?.n || 0;
    } catch (e) { /* table created with the first command */ }
    return { total, people, top: [...by].sort((a, b) => b[1] - a[1]).slice(0, 3) };
}

// /bot activity: what ARCHON did on this server this week, then the totals, then its level
function activityCard(client, lang, db, guild) {
    const _ = tr(lang);
    if (!guild) return v2.card(COLOR.wait, [{ text: _('activity_dm') }]);
    const s = BotStats.getOrCreateBotStats(db, guild.id);
    const r = BotStats.getBotRank(db, guild.id);
    const n = (x) => Number(x || 0).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US');
    const now = Date.now(), WEEK = 7 * 86400000;
    const week = weekUsage(client, db, guild.id, now - WEEK, now + 1);
    const prev = weekUsage(client, db, guild.id, now - 2 * WEEK, now - WEEK);
    const since = s.join_date ? `<t:${s.join_date}:R>` : '—';

    let trend = '';
    if (prev.total > 0) {
        const pct = Math.round((week.total - prev.total) / prev.total * 100);
        trend = pct > 0 ? ` · ${em('ic_chart', '📈')} +${pct} %` : pct < 0 ? ` · ${pct} %` : '';
    }
    const items = [
        { thumbnail: [
            `## ${em('eagle', '🦅')} ${_('activity_title', { server: guild.name })}\n-# ${_('act_header', { since })}`,
            client.user.displayAvatarURL({ size: 128 }),
        ] },
        { rule: true },
        { text: `**${_('act_week_cmds')}** · ${n(week.total)}${trend}\n**${_('act_week_people')}** · ${n(week.people)}` },
    ];
    if (week.top.length) {
        const max = week.top[0][1] || 1, w = Math.max(...week.top.map(([c]) => c.length));
        const bars = week.top.map(([c, k]) => `${c.padEnd(w)}  ${'▰'.repeat(Math.max(1, Math.round(k / max * 8))).padEnd(8, ' ')} ${k}`);
        items.push({ rule: true }, { text: `**${_('act_top3')}**\n\`\`\`\n${bars.join('\n')}\n\`\`\`` });
    } else {
        items.push({ rule: true }, { text: `-# ${_('act_quiet')}` });
    }
    const cmds = (s.commands_served || 0) + (s.slash_commands_served || 0);
    items.push(
        { rule: true },
        { text: `-# ${_('act_totals', { cmds: n(cmds), ai: n(s.ai_chats), people: n(Object.keys(s.users_helped || {}).length), buttons: n(s.buttons_clicked) })}\n-# ${_('act_level', { level: s.level, rank: r.rank, total: r.total })}` },
        { row: new ActionRowBuilder().addComponents(linkBtn(_('btn_insights'), `${DASHBOARD_URL}/dashboard/${guild.id}/insights`, 'ic_chart', '📊')) },
        { text: foot(client) },
    );
    return v2.card(0x7f77dd, items);
}

// ─── About ───
function aboutCard(client, lang, userId) {
    const _ = tr(lang);
    const items = [
        { thumbnail: [`## ${em('ic_info', 'ℹ️')} ${_('about_title')}\n${_('about_desc')}`, client.user.displayAvatarURL({ size: 256 })] },
        { rule: true },
        { text: `${_('about_features')}\n-# ${_('about_meta', { version: version(client), guilds: client.guilds.cache.size })}` },
    ];
    if (userId && userId === process.env.OWNER_ID) items.push({ text: `-# ${_('about_owner')}` });
    items.push(
        { rule: true },
        { row: new ActionRowBuilder().addComponents(
            linkBtn(_('btn_invite'), inviteUrl(client), 'ic_role', '🔗'),
            linkBtn(_('btn_support'), SUPPORT_URL, 'ic_info', '🆘'),
            linkBtn(_('btn_vote'), voteUrl(client), 'yellowcrown', '⭐'),
        ) },
        { row: new ActionRowBuilder().addComponents(
            linkBtn(_('btn_dashboard'), DASHBOARD_URL, 'ic_settings', '🌐'),
            linkBtn('GitHub', GITHUB_URL, 'developericon', '💻'),
        ) },
        { text: foot(client) },
    );
    return v2.card(0xba7517, items);
}

// ─── Invite ───
function inviteCard(client, lang) {
    const _ = tr(lang);
    return v2.card(0x1d9e75, [
        { thumbnail: [`## ${em('ic_role', '🔗')} ${_('invite_title')}\n${_('invite_desc')}`, client.user.displayAvatarURL({ size: 128 })] },
        { text: `-# ${_('invite_perms')}` },
        { row: new ActionRowBuilder().addComponents(
            linkBtn(_('btn_add'), inviteUrl(client), 'ic_role', '➕'),
            linkBtn(_('btn_support'), SUPPORT_URL, 'ic_info', '🆘'),
        ) },
        { text: foot(client) },
    ]);
}


// ─── Alive (System Health) ───
function aliveCard(client, lang, db, guildName) {
    const _ = tr(lang);
    const t0 = performance.now();
    const uptimeSec = process.uptime();
    const mem = process.memoryUsage();
    const heapUsed = Math.round(mem.heapUsed / 1024 / 1024);
    const heapTotal = Math.round(mem.heapTotal / 1024 / 1024);
    const sysTotal = Math.round(os.totalmem() / 1024 / 1024);
    const sysFree = Math.round(os.freemem() / 1024 / 1024);
    const cpus = os.cpus();
    const wsPing = Math.round(client.ws?.ping ?? 0);
    const wsDot = wsPing < 150 ? em('ping_ok', '🟢') : wsPing < 300 ? em('ping_warn', '🟡') : em('ping_bad', '🔴');
    
    const statusEmojis = { online: em('ping_ok', '🟢'), idle: em('ping_warn', '🟡'), dnd: em('ping_bad', '🔴'), offline: '⚫' };
    const botStatus = statusEmojis[client.presence?.status] || em('ping_ok', '🟢');

    let servers = client.guilds.cache.size;
    try { servers = db.prepare("SELECT COUNT(DISTINCT guild_id) AS c FROM users WHERE guild_id NOT IN ('DM','telegram')").get().c || servers; } catch {}

    return v2.card(0x2ecc71, [
        { text: `## ${em('ic_alive', '📡')} ${_('alive_title')}\n*${guildName}*` },
        { rule: true },
        { text: 
            `${botStatus} **${_('alive_status')}** · *${(client.presence?.status || 'online').toUpperCase()}*\n` +
            `${em('clock', '🕐')} **${_('uptime')}** · ${uptime(uptimeSec)}\n` +
            `${em('ic_satellite', '📡')} **${_('ping_gateway')}** · ${wsPing}ms ${wsDot}\n` +
            `${em('dashboard', '🌐')} **${_('servers')}** · ${servers}`
        },
        { rule: true },
        { text: 
            `**${em('developericon', '💻')} ${_('alive_resources')}**\n` +
            `${em('charts', '📊')} **${_('memory')}** · ${heapUsed}/${heapTotal} MB\n` +
            `${em('ic_settings', '⚙️')} ${(cpus[0]?.model || 'CPU').split('@')[0].trim().slice(0, 28)} (${cpus.length} cores)\n` +
            `${em('eagle', '🐧')} ${os.platform()} ${os.arch()} · Node **${process.version}**`
        },
        { rule: true },
        { row: new ActionRowBuilder().addComponents(actBtn(_('btn_refresh'), 'bot:alive', 'ic_refresh', '🔄')) },
        { text: foot(client) }
    ]);
}

async function build(sub, client, lang, db, guild, userId) {
    switch (sub) {
        case 'ping': return pingCard(client, lang, db);
        case 'alive': return aliveCard(client, lang, db, guild?.name?.toUpperCase() || 'ARCHON');
        case 'stats': return statsCard(client, lang, db, guild?.id);
        case 'activity': return activityCard(client, lang, db, guild);
        case 'about': return aboutCard(client, lang, userId);
        case 'invite': return inviteCard(client, lang);
        default: return null;
    }
}

// ─── Refresh buttons (routed from index.js) ───
const lastRun = new Map();
async function handleButton(interaction, client) {
    const sub = interaction.customId.split(':')[1];
    if (!['ping', 'stats', 'alive'].includes(sub)) return interaction.deferUpdate().catch(() => {});
    const key = interaction.message.id;
    if (Date.now() - (lastRun.get(key) || 0) < REFRESH_PAUSE_MS) return interaction.deferUpdate().catch(() => {});
    if (lastRun.size > 500) lastRun.clear();
    lastRun.set(key, Date.now());
    await interaction.deferUpdate();
    const card = await build(sub, client, slashLang(interaction), client.db, interaction.guild, interaction.user.id);
    return interaction.editReply(card);
}

const desc = (en, fr, zh) => ({ en, loc: { fr, 'zh-CN': zh } });
const SUB_DESC = {
    ping: desc('Check how fast ARCHON is answering', 'Vérifie la vitesse de réponse d’ARCHON', '查看 ARCHON 的响应速度'),
    alive: desc('System health and resources', 'Santé du système et ressources', '系统健康状况和资源'),
    stats: desc('See how ARCHON is doing across all servers', 'Vois comment va ARCHON sur tous les serveurs', '查看 ARCHON 在所有服务器的状态'),
    activity: desc('ARCHON’s level and activity in this server', 'Le niveau et l’activité d’ARCHON sur ce serveur', 'ARCHON 在本服务器的等级和活跃度'),
    about: desc('What ARCHON is and who made it', 'Ce qu’est ARCHON et qui l’a créé', 'ARCHON 是什么，由谁制作'),
    invite: desc('Add ARCHON to another server', 'Ajoute ARCHON à un autre serveur', '把 ARCHON 添加到其他服务器'),
};

const data = new SlashCommandBuilder()
    .setName('bot')
    .setDescription('Ping, stats, activity, about and invite')
    .setDescriptionLocalizations({ fr: 'Ping, stats, activité, à propos et invitation', 'zh-CN': '延迟、统计、活跃度、关于和邀请' });
for (const [name, d] of Object.entries(SUB_DESC)) {
    data.addSubcommand(s => s.setName(name).setDescription(d.en).setDescriptionLocalizations(d.loc));
}

module.exports = {
    name: 'bot',
    aliases: Object.values(SUB_ALIASES).flat(),
    description: 'Ping, stats, activity, about and invite',
    category: 'SYSTEM',
    cooldown: 3000,
    usage: '.bot <ping|stats|activity|about|invite>',
    examples: ['.bot ping', '.ping', '.about'],
    data,

    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        const L = LANGS.includes(lang) ? lang : 'en';
        const used = String(usedCommand || '').toLowerCase();
        const first = String(args[0] || '').toLowerCase();
        const sub = Object.keys(SUB_ALIASES).find(k => SUB_ALIASES[k].includes(used))
            || Object.keys(SUB_ALIASES).find(k => k === first || SUB_ALIASES[k].includes(first));
        if (!sub) {
            const prefix = serverSettings?.prefix || process.env.PREFIX || '.';
            return message.reply(v2.card(COLOR.info, [{ text: tr(L)('prefix_usage', { prefix }) }])).catch(() => {});
        }
        const card = await build(sub, client, L, db, message.guild, message.author.id);
        return message.reply(card).catch(e => console.error('[BOT]', sub, e.message));
    },

    execute: async (interaction, client) => {
        const sub = interaction.options.getSubcommand();
        const card = await build(sub, client, slashLang(interaction), client.db, interaction.guild, interaction.user.id);
        return interaction.reply(card).catch(e => console.error('[BOT]', sub, e.message));
    },

    handleButton,
    _internal: { measure, tierOf, uptime, SUB_ALIASES },
};
