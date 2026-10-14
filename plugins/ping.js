const { performance } = require('perf_hooks');
const { ns } = require('../lib/lang');
const E = require('../config/emojis');
const ui = require('../lib/games/ui');
const v2 = require('../lib/games/v2');
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

const em = (k, fb) => E[k] || fb;

// ── Latency tier ──
function tier(ms, good = 100, ok = 250) {
    if (ms < good) return { dot: '🟢', key: 'excellent', color: 0x2ecc71 };
    if (ms < ok)   return { dot: '🟡', key: 'good',      color: 0xf1c40f };
    return              { dot: '🔴', key: 'slow',      color: 0xe74c3c };
}

// ── Health score ──
function healthScore(rest, api, db) {
    let s = 100;
    if (rest > 100) s -= Math.min(30, (rest - 100) / 5);
    if (api  > 100) s -= Math.min(30, (api  - 100) / 5);
    if (db && db > 50) s -= Math.min(40, (db - 50) / 2);
    return Math.max(0, Math.min(100, Math.round(s)));
}

function healthTier(s) {
    if (s >= 80) return { dot: '🟢', color: 0x2ecc71, key: 'scoreExcellent', rec: 'recExcellent' };
    if (s >= 50) return { dot: '🟡', color: 0xf1c40f, key: 'scoreGood',      rec: 'recGood' };
    return              { dot: '🔴', color: 0xe74c3c, key: 'scorePoor',      rec: 'recPoor' };
}

// ── Measure everything in one call ──
async function measure(client, db) {
    // Real Discord REST round-trip — a live API call, not a local timing.
    const t0 = performance.now();
    try { await client.application.fetch(); } catch {}
    const rest = Math.round(performance.now() - t0);

    // Gateway heartbeat (rolling average).
    const api = Math.round(client.ws?.ping ?? 0);

    // SQLite query time.
    let database = null;
    try {
        const d0 = performance.now();
        db.prepare('SELECT 1').get();
        database = Math.round(performance.now() - d0);
    } catch {}

    return { rest, api, database };
}

// ── One card builder for prefix, slash, and refresh ──
function buildCard(client, t, ctx) {
    const { rest, api, database, guildName, version, detailed } = ctx;
    const restT = tier(rest);
    const apiT  = tier(api);
    const dbT   = database != null ? tier(database, 30, 80) : null;
    const score = healthScore(rest, api, database);
    const hT    = healthTier(score);

    const items = [
        { text: `*ARCHON CG-223 · Live Telemetry*` },
        { text: `## ${em('dashboard', '📡')} ${t.title}` },
        { rule: true },
        { text: `**🌐 ${t.apiHeartbeat}** · ${apiT.dot} *${t[apiT.key] || apiT.key}*\n\n\`${ui.progressBar(Math.min(api, 300), 300, 10)}\` **${api}ms**` },
        { text: `**📡 ${t.roundTrip}** · ${restT.dot} *${t[restT.key] || restT.key}*\n\n\`${ui.progressBar(Math.min(rest, 300), 300, 10)}\` **${rest}ms**` },
    ];
    if (dbT) {
        items.push({ text: `**🗄️ ${t.databaseLatency || 'Database'}** · ${dbT.dot} *${t[dbT.key] || dbT.key}*\n\n\`${ui.progressBar(Math.min(database, 100), 100, 10)}\` **${database}ms**` });
    }
    items.push({ rule: true });
    items.push({ text: `${hT.dot} **${t.overallHealth}** · **${score}/100** — *${t[hT.key] || hT.key}*\n-# ${t[hT.rec] || ''}` });

    if (detailed) {
        const up = process.uptime();
        const d = Math.floor(up / 86400), h = Math.floor((up % 86400) / 3600), m = Math.floor((up % 3600) / 60);
        const mem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        items.push({ rule: true });
        items.push({ text: `**⚙️ ${t.systemMetrics || 'System'}**\n${em('clock', '🕐')} ${t.uptime || 'Uptime'} · **${d}d ${h}h ${m}m**\n${em('XP', '⚡')} ${t.memory || 'Memory'} · **${mem} MB**\n${em('eagle', '🦅')} ${t.servers || 'Servers'} · **${client.guilds.cache.size}**\n${em('dashboard', '🎮')} ${t.commands || 'Commands'} · **${client.commands?.size || 0}**` });
    }
    items.push({ rule: true });
    items.push({ text: `-# ${guildName} · BAMAKO-223 · v${version}` });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ping_refresh').setLabel(t.refresh || 'Refresh').setStyle(ButtonStyle.Primary).setEmoji(ui.emObj('loading', '🔄')),
        new ButtonBuilder().setCustomId('ping_toggle').setLabel(detailed ? (t.simpleView || 'Simple') : (t.detailedView || 'Detailed')).setStyle(ButtonStyle.Secondary).setEmoji(ui.emObj('dashboard', '📈')),
        new ButtonBuilder().setCustomId('ping_help').setLabel(t.help || 'Help').setStyle(ButtonStyle.Success).setEmoji('❓'),
    );
    items.push({ row });

    return v2.card(hT.color, items);
}

function buildHelpCard(t) {
    return v2.card(0x3498db, [
        { text: `## ❓ ${t.help || 'Help'}` },
        { rule: true },
        { text: `**🌐 ${t.apiHeartbeat}** — Discord WebSocket heartbeat.\n**📡 ${t.roundTrip}** — Round-trip time for this reply.\n**🗄️ ${t.databaseLatency || 'Database'}** — SQLite query time.\n**${t.overallHealth}** — Weighted score across all three.` },
        { rule: true },
        { text: `-# 🟢 <100ms  ·  🟡 100–250ms  ·  🔴 >250ms` },
    ]);
}

// ── Button collector — same handler for prefix and slash ──
function attachCollector(msg, client, db, ctx, t, authorId, isSlash) {
    const collector = msg.createMessageComponentCollector({ time: 60000 });
    collector.on('collect', async (i) => {
        if (i.user.id !== authorId) return i.reply({ content: t.accessDenied || 'Only the original user can interact.', flags: 64 }).catch(() => {});
        try {
            if (i.customId === 'ping_refresh') {
                await i.deferUpdate();
                const m = await measure(client, db);
                ctx.rest = m.rest; ctx.api = m.api; ctx.database = m.database;
                await i.editReply(buildCard(client, t, ctx));
            } else if (i.customId === 'ping_toggle') {
                await i.deferUpdate();
                ctx.detailed = !ctx.detailed;
                const m = await measure(client, db);
                ctx.rest = m.rest; ctx.api = m.api; ctx.database = m.database;
                await i.editReply(buildCard(client, t, ctx));
            } else if (i.customId === 'ping_help') {
                await i.reply({ ...buildHelpCard(t), flags: MessageFlags.IsComponentsV2 | 64 });
            }
        } catch (e) {
            console.error('[PING BUTTON]', e.message);
            await i.deferUpdate().catch(() => {});
        }
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
            rest: 0, api: 0, database: null,
            guildName: message.guild?.name?.toUpperCase() || 'NEURAL NODE',
            version: client.version || '1.8.0',
            detailed,
        };
        const m = await measure(client, db);
        ctx.rest = m.rest; ctx.api = m.api; ctx.database = m.database;

        const msg = await message.reply(buildCard(client, t, ctx)).catch(() => null);
        if (msg) attachCollector(msg, client, db, ctx, t, message.author.id, false);

        console.log(`[PING] ${message.author.tag} | REST ${ctx.rest}ms | API ${ctx.api}ms | DB ${ctx.database ?? '—'}ms | Lang ${lang}`);
    },

    execute: async (interaction, client) => {
        const guildId = interaction.guild?.id || 'DM';
        const lang = client.detectLanguage ? client.detectLanguage('ping', guildId) : (require('../lib/i18n').slashLang(interaction, ['en', 'fr']));
        const t = ns('ping', lang);
        const ctx = {
            rest: 0, api: 0, database: null,
            guildName: interaction.guild?.name?.toUpperCase() || 'NEURAL NODE',
            version: client.version || '1.8.0',
            detailed: interaction.options.getBoolean('detailed') || false,
        };
        const m = await measure(client, client.db);
        ctx.rest = m.rest; ctx.api = m.api; ctx.database = m.database;

        await interaction.reply(buildCard(client, t, ctx)).catch(() => {});
        const msg = await interaction.fetchReply().catch(() => null);
        if (msg) attachCollector(msg, client, client.db, ctx, t, interaction.user.id, true);
    },
};
