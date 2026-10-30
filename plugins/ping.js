// plugins/ping.js  (ping v2)
// Same card system as before (texts from ns('ping'), cards from lib/games/v2 and ui), with these fixes:
//   - the gateway heartbeat is -1 until Discord has answered once after a restart: it is shown as "—" and is not counted in the health score
//   - each metric is two short lines (no blank line between), so the card is shorter on a phone
//   - icons and status dots come from config/emojis.js (keys ping_*), unicode is only the last fallback
//   - Refresh and Detailed no longer hit Discord on every click (3 second pause between measurements)
//   - the buttons are removed when the card times out, instead of failing when someone clicks them
//   - the version shown comes from the bot, then package.json (it used to fall back to a fixed "1.8.0")
const { performance } = require('perf_hooks');
const { ns } = require('../lib/lang');
const E = require('../config/emojis');
const ui = require('../lib/games/ui');
const v2 = require('../lib/games/v2');
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

const em = (k, fb) => E[k] || fb;
const REFRESH_PAUSE_MS = 3000;

function appVersion(client) {
    if (client.version) return client.version;
    try { return require('../package.json').version; } catch (e) { return '?'; }
}

// ── Latency tier ── (null, negative or NaN means "no measurement yet")
function tier(ms, good = 100, ok = 250) {
    if (ms == null || !(ms >= 0)) return { dot: em('ping_wait', '⏳'), key: null, color: 0x95a5a6, none: true };
    if (ms < good) return { dot: em('ping_ok', '🟢'), key: 'excellent', color: 0x2ecc71 };
    if (ms < ok)   return { dot: em('ping_warn', '🟡'), key: 'good', color: 0xf1c40f };
    return              { dot: em('ping_bad', '🔴'), key: 'slow', color: 0xe74c3c };
}

// ── Health score ── (a missing measurement is not counted against the bot)
function healthScore(rest, api, db) {
    let s = 100;
    if (rest > 100) s -= Math.min(30, (rest - 100) / 5);
    if (api != null && api > 100) s -= Math.min(30, (api - 100) / 5);
    if (db && db > 50) s -= Math.min(40, (db - 50) / 2);
    return Math.max(0, Math.min(100, Math.round(s)));
}

function healthTier(s) {
    if (s >= 80) return { dot: em('ping_ok', '🟢'), color: 0x2ecc71, key: 'scoreExcellent', rec: 'recExcellent' };
    if (s >= 50) return { dot: em('ping_warn', '🟡'), color: 0xf1c40f, key: 'scoreGood',      rec: 'recGood' };
    return              { dot: em('ping_bad', '🔴'), color: 0xe74c3c, key: 'scorePoor',      rec: 'recPoor' };
}

// ── Measure everything in one call ──
async function measure(client, db) {
    // Real Discord REST round-trip — a live API call, not a local timing.
    const t0 = performance.now();
    try { await client.application.fetch(); } catch {}
    const rest = Math.round(performance.now() - t0);

    // Gateway heartbeat (rolling average). It is -1 until the first heartbeat after a (re)start.
    const ping = client.ws ? client.ws.ping : null;
    const api = ping > 0 ? Math.round(ping) : null;

    // SQLite query time.
    let database = null;
    try {
        const d0 = performance.now();
        db.prepare('SELECT 1').get();
        database = Math.round(performance.now() - d0);
    } catch {}

    return { rest, api, database };
}

// One metric = a title line and a small bar line
function metric(icon, label, ms, tr, t, barMax) {
    const value = tr.none ? '—' : `${ms}ms`;
    const word = tr.none ? '' : ` · *${t[tr.key] || tr.key}*`;
    const bar = ui.progressBar(tr.none ? 0 : Math.min(ms, barMax), barMax, 10);
    return `${tr.dot} **${line(icon, label)}** · **${value}**${word}\n-# \`${bar}\``;
}
const line = (...parts) => parts.filter(Boolean).join(' ');

// ── One card builder for prefix, slash, and refresh ──
function buildCard(client, t, ctx) {
    const { rest, api, database, guildName, version, detailed, expired } = ctx;
    const restT = tier(rest);
    const apiT  = tier(api);
    const dbT   = database != null ? tier(database, 30, 80) : null;
    const score = healthScore(rest, api, database);
    const hT    = healthTier(score);

    const metrics = [
        metric(em('ping_gateway', '🌐'), t.apiHeartbeat, api, apiT, t, 300),
        metric(em('ping_rest', '📡'), t.roundTrip, rest, restT, t, 300),
    ];
    if (dbT) metrics.push(metric(em('ping_db', '🗄️'), t.databaseLatency || 'Database', database, dbT, t, 100));

    const items = [
        { text: `*ARCHON CG-223 · Live Telemetry*` },
        { text: `## ${em('dashboard', '📡')} ${t.title}` },
        { rule: true },
        { text: metrics.join('\n') },
        { rule: true },
        { text: `${hT.dot} **${t.overallHealth}** · **${score}/100** — *${t[hT.key] || hT.key}*\n-# ${t[hT.rec] || ''}` },
    ];

    if (detailed) {
        const up = process.uptime();
        const d = Math.floor(up / 86400), h = Math.floor((up % 86400) / 3600), m = Math.floor((up % 3600) / 60);
        const mem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        items.push({ rule: true });
        items.push({ text: `**${line(em('ping_system', '⚙️'), t.systemMetrics || 'System')}**\n${line(em('clock', '🕐'), t.uptime || 'Uptime')} · **${d}d ${h}h ${m}m** · ${line(em('XP', '⚡'), t.memory || 'Memory')} · **${mem} MB**\n${line(em('eagle', '🦅'), t.servers || 'Servers')} · **${client.guilds.cache.size}** · ${line(em('dashboard', '🎮'), t.commands || 'Commands')} · **${client.commands?.size || 0}**` });
    }
    items.push({ rule: true });
    items.push({ text: `-# ${guildName} · BAMAKO-223 · v${version}` });

    if (!expired) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ping_refresh').setLabel(t.refresh || 'Refresh').setStyle(ButtonStyle.Primary).setEmoji(ui.emObj('loading', '🔄')),
            new ButtonBuilder().setCustomId('ping_toggle').setLabel(detailed ? (t.simpleView || 'Simple') : (t.detailedView || 'Detailed')).setStyle(ButtonStyle.Secondary).setEmoji(ui.emObj('dashboard', '📈')),
            new ButtonBuilder().setCustomId('ping_help').setLabel(t.help || 'Help').setStyle(ButtonStyle.Success).setEmoji(ui.emObj('ping_help', '❓')),
        );
        items.push({ row });
    }

    return v2.card(hT.color, items);
}

function buildHelpCard(t) {
    return v2.card(0x3498db, [
        { text: `## ${line(em('ping_help', '❓'), t.help || 'Help')}` },
        { rule: true },
        { text: `**${line(em('ping_gateway', '🌐'), t.apiHeartbeat)}** — Discord WebSocket heartbeat.\n**${line(em('ping_rest', '📡'), t.roundTrip)}** — Round-trip time for this reply.\n**${line(em('ping_db', '🗄️'), t.databaseLatency || 'Database')}** — SQLite query time.\n**${t.overallHealth}** — Weighted score across all three.` },
        { rule: true },
        { text: `-# ${em('ping_ok', '🟢')} <100ms  ·  ${em('ping_warn', '🟡')} 100–250ms  ·  ${em('ping_bad', '🔴')} >250ms` },
    ]);
}

// ── Button collector — same handler for prefix and slash ──
function attachCollector(msg, client, db, ctx, t, authorId, isSlash) {
    const collector = msg.createMessageComponentCollector({ time: 60000 });
    let measuredAt = Date.now();   // the card was measured just now
    collector.on('collect', async (i) => {
        if (i.user.id !== authorId) return i.reply({ content: t.accessDenied || 'Only the original user can interact.', flags: 64 }).catch(() => {});
        try {
            if (i.customId === 'ping_refresh' || i.customId === 'ping_toggle') {
                await i.deferUpdate();
                if (i.customId === 'ping_toggle') ctx.detailed = !ctx.detailed;
                // measure again only if the last measurement is older than the pause
                if (Date.now() - measuredAt >= REFRESH_PAUSE_MS) {
                    const m = await measure(client, db);
                    ctx.rest = m.rest; ctx.api = m.api; ctx.database = m.database;
                    measuredAt = Date.now();
                }
                await i.editReply(buildCard(client, t, ctx));
            } else if (i.customId === 'ping_help') {
                await i.reply({ ...buildHelpCard(t), flags: MessageFlags.IsComponentsV2 | 64 });
            }
        } catch (e) {
            console.error('[PING BUTTON]', e.message);
            await i.deferUpdate().catch(() => {});
        }
    });
    // When the card times out, take the buttons away instead of leaving buttons that fail
    collector.on('end', async () => {
        ctx.expired = true;
        try { await msg.edit(buildCard(client, t, ctx)); } catch (e) { /* the message was deleted */ }
    });
}

module.exports = {
    name: 'ping',
    aliases: ['pong', 'latency', 'ms', 'lag', 'pongue', 'status', 'health'],
    description: '📡 Measure the digital engine latency with real-time neural telemetry.',
    category: 'SYSTEM',
    cooldown: 3000,
    usage: '.ping',
    examples: ['.ping', '.ping detailed'],

    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('📡 Check bot latency and system health')
        .addBooleanOption(o => o.setName('detailed').setDescription('Show detailed performance metrics').setRequired(false)),

    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        const t = ns('ping', lang);
        const detailed = ['detailed', 'detail', 'full'].includes((args[0] || '').toLowerCase());
        const ctx = {
            rest: 0, api: null, database: null,
            guildName: message.guild?.name?.toUpperCase() || 'NEURAL NODE',
            version: appVersion(client),
            detailed,
        };
        const m = await measure(client, db);
        ctx.rest = m.rest; ctx.api = m.api; ctx.database = m.database;

        const msg = await message.reply(buildCard(client, t, ctx)).catch(() => null);
        if (msg) attachCollector(msg, client, db, ctx, t, message.author.id, false);

        console.log(`[PING] ${message.author.tag} | REST ${ctx.rest}ms | API ${ctx.api ?? '—'}ms | DB ${ctx.database ?? '—'}ms | Lang ${lang}`);
    },

    execute: async (interaction, client) => {
        const guildId = interaction.guild?.id || 'DM';
        const lang = client.detectLanguage ? client.detectLanguage('ping', guildId) : (require('../lib/i18n').slashLang(interaction, ['en', 'fr']));
        const t = ns('ping', lang);
        const ctx = {
            rest: 0, api: null, database: null,
            guildName: interaction.guild?.name?.toUpperCase() || 'NEURAL NODE',
            version: appVersion(client),
            detailed: interaction.options.getBoolean('detailed') || false,
        };
        const m = await measure(client, client.db);
        ctx.rest = m.rest; ctx.api = m.api; ctx.database = m.database;

        await interaction.reply(buildCard(client, t, ctx)).catch(() => {});
        const msg = await interaction.fetchReply().catch(() => null);
        if (msg) attachCollector(msg, client, client.db, ctx, t, interaction.user.id, true);
    },

    _internal: { tier, healthScore, healthTier, measure, buildCard, buildHelpCard, appVersion },
};
