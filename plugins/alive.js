const { version: discordVersion, SlashCommandBuilder } = require('discord.js');
const os = require('os');
const { ns } = require('../lib/lang');
const E = require('../config/emojis');
const ui = require('../lib/games/ui');
const v2 = require('../lib/games/v2');

const em = (k, fb) => E[k] || fb;

function fmtUptime(ms) {
    const d = Math.floor(ms / 86400000);
    const h = Math.floor(ms / 3600000) % 24;
    const m = Math.floor(ms / 60000) % 60;
    const s = Math.floor(ms / 1000) % 60;
    if (d) return `${d}d ${h}h ${m}m`;
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m ${s}s`;
    return `${s}s`;
}

function memoryBar(usedMB, totalMB, width = 10) {
    const pct = totalMB > 0 ? Math.min(100, (usedMB / totalMB) * 100) : 0;
    const filled = Math.round((pct / 100) * width);
    const dot = pct < 60 ? '🟢' : pct < 85 ? '🟡' : '🔴';
    return { bar: '▰'.repeat(filled) + '▱'.repeat(Math.max(0, width - filled)), pct: Math.round(pct), dot };
}

function attachCollector(msg, client, db, ctx, t, authorId) {
    const collector = msg.createMessageComponentCollector({ time: 60000 });
    collector.on('collect', async (i) => {
        if (i.user.id !== authorId) return i.reply({ content: t.accessDenied || 'Only the original user can interact.', flags: 64 }).catch(() => {});
        try {
            if (i.customId === 'alive_refresh') {
                await i.deferUpdate();
                await i.editReply(buildCard(client, t, ctx));
            } else if (i.customId === 'alive_help') {
                await i.reply({ ...buildHelpCard(t), flags: 64 });
            }
        } catch (e) {
            console.error('[ALIVE BUTTON]', e.message);
            await i.deferUpdate().catch(() => {});
        }
    });
}

function buildCard(client, t, ctx) {
    const uptime = client.uptime || 0;
    const mem = process.memoryUsage();
    const heapUsed = Math.round(mem.heapUsed / 1024 / 1024);
    const heapTotal = Math.round(mem.heapTotal / 1024 / 1024);
    const rss = Math.round(mem.rss / 1024 / 1024);
    const sysTotal = Math.round(os.totalmem() / 1024 / 1024);
    const sysFree = Math.round(os.freemem() / 1024 / 1024);
    const cpus = os.cpus();
    const cpuModel = (cpus[0]?.model || 'CPU').split('@')[0].trim().slice(0, 28);
    const cores = cpus.length;

    const wsPing = Math.round(client.ws?.ping ?? 0);
    const wsDot = wsPing < 150 ? '🟢' : wsPing < 300 ? '🟡' : '🔴';

    const heap = memoryBar(heapUsed, heapTotal, 10);
    const sysRam = memoryBar(sysTotal - sysFree, sysTotal, 10);

    const statusEmojis = { online: '🟢', idle: '🟡', dnd: '🔴', offline: '⚫' };
    const botStatus = statusEmojis[client.presence?.status] || '🟢';

    let servers = client.guilds.cache.size;
    let users = 0;
    let dbUsers = 0;
    try {
        servers = ctx.db.prepare("SELECT COUNT(DISTINCT guild_id) AS c FROM users WHERE guild_id NOT IN ('DM','telegram')").get().c || servers;
        users = ctx.db.prepare("SELECT COUNT(DISTINCT id) AS c FROM users").get().c || 0;
        dbUsers = ctx.db.prepare("SELECT COUNT(*) AS c FROM users").get().c || 0;
    } catch {}

    const cacheSize = client.userDataCache?.size || 0;
    const pending = client.pendingUserUpdates?.size || 0;

    const items = [
        { text: `*ARCHON CG-223 · System Status*` },
        { text: `## ${em('eagle', '🦅')} ${t.title || 'Neural Engine Online'}` },
        { rule: true },
        { text:
            `${botStatus} **${t.botStatus || 'Status'}** · *${(client.presence?.status || 'online').toUpperCase()}*\n` +
            `${em('clock', '🕐')} **${t.uptime || 'Uptime'}** · **${fmtUptime(uptime)}**\n` +
            `${em('dashboard', '🌐')} **${t.apiPing || 'Gateway'}** · **${wsPing}ms** ${wsDot}\n` +
            `${em('speed', '📡')} **${t.apiResponse || 'REST'}** · **${ctx.rest}ms**`
        },
        { rule: true },
        { text: `**⚙️ ${t.systemResources || 'Resources'}**` },
        { text:
            `${heap.dot} **${t.memory || 'Memory'}** · ${heapUsed}/${heapTotal} MB\n\`${heap.bar}\` **${heap.pct}%**\n\n` +
            `${sysRam.dot} **${t.systemRam || 'System RAM'}** · ${(sysTotal - sysFree)}/${sysTotal} MB\n\`${sysRam.bar}\` **${sysRam.pct}%**\n\n` +
            `${em('dashboard', '💻')} ${cpuModel} · **${cores} cores**\n` +
            `${em('eagle', '🐧')} ${os.platform()} ${os.arch()} · Node **${process.version}**`
        },
        { rule: true },
        { text: `**📊 ${t.statistics || 'Statistics'}**` },
        { text:
            `${em('globe', '🌍')} **${servers}** ${t.servers || 'servers'} · **${users}** ${t.users || 'users'}\n` +
            `${em('general', '💬')} **${client.channels.cache.size}** ${t.channels || 'channels'} · **${client.commands.size}** ${t.commands || 'commands'}\n` +
            `${em('coins', '🗄️')} **${dbUsers}** ${t.dbUsers || 'database rows'} · cache **${cacheSize}** · pending **${pending}**`
        },
        { rule: true },
        { text: `-# ${ctx.guildName} · BAMAKO-223 · v${ctx.version}` },
    ];

    const row = new (require('discord.js').ActionRowBuilder)().addComponents(
        new (require('discord.js').ButtonBuilder)().setCustomId('alive_refresh').setLabel(t.refresh || 'Refresh').setStyle(3).setEmoji(ui.emObj('loading', '🔄')),
        new (require('discord.js').ButtonBuilder)().setCustomId('alive_help').setLabel(t.help || 'Help').setStyle(1).setEmoji('❓'),
    );
    items.push({ row });

    return v2.card(0x2ecc71, items);
}

function buildHelpCard(t) {
    return v2.card(0x3498db, [
        { text: `## ❓ ${t.help || 'Help'}` },
        { rule: true },
        { text:
            `**${t.uptime || 'Uptime'}** — time since the bot last restarted.\n` +
            `**${t.apiPing || 'Gateway'}** — Discord WebSocket heartbeat (rolling average).\n` +
            `**${t.apiResponse || 'REST'}** — a live call to Discord's HTTP API.\n` +
            `**${t.memory || 'Memory'}** — V8 heap in use vs. heap allocated.` },
        { rule: true },
        { text: `-# 🟢 <60%  ·  🟡 60–85%  ·  🔴 >85%` },
    ]);
}

async function measureRest(client) {
    const t0 = Date.now();
    try { await client.application.fetch(); } catch {}
    return Math.round(Date.now() - t0);
}

module.exports = {
    name: 'alive',
    aliases: ['ping', 'status', 'health', 'uptime', 'version', 'enligne', 'etat', 'sante'],
    description: '📡 Check if the bot is alive and get system statistics',
    category: 'SYSTEM',
    usage: '.alive',
    cooldown: 3000,
    examples: ['.alive', '.status', '.enligne'],

    data: new SlashCommandBuilder()
        .setName('alive')
        .setDescription('📡 Check if the bot is alive and get system statistics'),

    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        const guildId = message.guild?.id ?? 'DM';
        const t = ns('alive', lang || 'en');
        const ctx = {
            rest: await measureRest(client),
            guildName: message.guild?.name?.toUpperCase() || 'NEURAL NODE',
            version: client.version || '3.1.1',
            db,
        };
        const msg = await message.reply(buildCard(client, t, ctx)).catch(() => null);
        if (msg) attachCollector(msg, client, db, ctx, t, message.author.id);
        console.log(`[ALIVE] ${message.author.tag} | Servers ${client.guilds.cache.size} | WS ${Math.round(client.ws.ping)}ms | REST ${ctx.rest}ms | Lang ${lang}`);
    },

    execute: async (interaction, client) => {
        const guildId = interaction.guild?.id || 'DM';
        const lang = client.detectLanguage ? client.detectLanguage('alive', guildId) : (require('../lib/i18n').slashLang(interaction, ['en', 'fr']));
        const t = ns('alive', lang);
        const ctx = {
            rest: await measureRest(client),
            guildName: interaction.guild?.name?.toUpperCase() || 'NEURAL NODE',
            version: client.version || '3.1.1',
            db: client.db,
        };
        await interaction.reply(buildCard(client, t, ctx)).catch(() => {});
        const msg = await interaction.fetchReply().catch(() => null);
        if (msg) attachCollector(msg, client, client.db, ctx, t, interaction.user.id);
    },
};
