const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const BotStats = require('./bot-stats.js');

// ================= BILINGUAL =================
const t = {
    en: {
        title: '🦅 ARCHON CG-223 · NEURAL STATUS',
        level: 'LEVEL',
        xp: 'XP',
        progress: 'PROGRESS',
        commands: 'COMMANDS',
        topCmd: 'TOP CMD',
        aiChats: 'AI CHATS',
        uptime: 'UPTIME',
        agents: 'AGENTS HELPED',
        buttons: 'BUTTONS',
        rank: 'SERVER RANK',
        joined: 'JOINED SERVER',
        footer: 'BAMAKO_223 🇲🇱 · NEURAL ENGINE v',
    },
    fr: {
        title: '🦅 ARCHON CG-223 · STATUT NEURAL',
        level: 'NIVEAU',
        xp: 'XP',
        progress: 'PROGRESSION',
        commands: 'COMMANDES',
        topCmd: 'CMD TOP',
        aiChats: 'CHATS IA',
        uptime: 'UPTIME',
        agents: 'AGENTS AIDÉS',
        buttons: 'BOUTONS',
        rank: 'RANG SERVEUR',
        joined: 'REJOINT LE',
        footer: 'BAMAKO_223 🇲🇱 · MOTEUR NEURAL v',
    }
};

async function showBotStats(client, context, db, lang, isSlash) {
    const tr = t[lang] || t.en;
    const guildId = isSlash ? context.guild?.id : context.guild?.id;
    if (!guildId) return;

    const stats = BotStats.getOrCreateBotStats(db, guildId);
    const prog = BotStats.buildProgressBar(stats.xp, stats.level);
    const rank = BotStats.getBotRank(db, guildId);
    const uptimeSecs = client.readyAt ? Math.floor((Date.now() - client.readyAt.getTime()) / 1000) : Math.floor(process.uptime());
    const uptime = BotStats.formatUptime(uptimeSecs);
    const version = client.version || '3.1.0';

    // Count unique agents helped
    const agentCount = Object.keys(stats.users_helped || {}).length;

    // Join date
    const joinDate = stats.join_date
        ? `<t:${stats.join_date}:R>`
        : 'Unknown';

    const embed = new EmbedBuilder()
        .setColor('#00f0ff')
        .setAuthor({ name: tr.title, iconURL: client.user.displayAvatarURL() })
        .setThumbnail(client.user.displayAvatarURL({ size: 128 }))
        .setDescription(
            '```ansi\n' +
            `\u001b[1;36m\u25b8 ${tr.level.padEnd(13)}\u001b[0m\u001b[1;37m${stats.level}\u001b[0m\n` +
            `\u001b[1;36m\u25b8 ${tr.xp.padEnd(13)}\u001b[0m${stats.xp.toLocaleString()}\n` +
            `\u001b[1;36m\u25b8 ${tr.progress.padEnd(13)}\u001b[0m${prog.bar} ${prog.percent}%\n` +
            `\u001b[1;33m\u25b8 ${tr.commands.padEnd(13)}\u001b[0m${(stats.commands_served + stats.slash_commands_served).toLocaleString()}\n` +
            `\u001b[1;33m\u25b8 ${tr.topCmd.padEnd(13)}\u001b[0m${stats.top_command || 'N/A'}\n` +
            `\u001b[1;35m\u25b8 ${tr.aiChats.padEnd(13)}\u001b[0m${stats.ai_chats.toLocaleString()}\n` +
            `\u001b[1;35m\u25b8 ${tr.buttons.padEnd(13)}\u001b[0m${stats.buttons_clicked.toLocaleString()}\n` +
            `\u001b[1;32m\u25b8 ${tr.agents.padEnd(13)}\u001b[0m${agentCount.toLocaleString()} \n` +
            `\u001b[1;32m\u25b8 ${tr.rank.padEnd(13)}\u001b[0m#${rank.rank} of ${rank.total}\n` +
            `\u001b[1;32m\u25b8 ${tr.uptime.padEnd(13)}\u001b[0m${uptime}\n` +
            '```' +
            `\n📅 **${tr.joined}:** ${joinDate}`
        )
        .setFooter({ text: `${tr.footer}${version}` })
        .setTimestamp();

    if (isSlash) {
        if (context.deferred || context.replied) {
            return context.editReply({ embeds: [embed] });
        }
        return context.reply({ embeds: [embed] });
    }
    return context.reply({ embeds: [embed] }).catch(() => {});
}

module.exports = {
    name: 'botstats',
    aliases: ['bs', 'bstats', 'archonstats', 'neuralstats'],
    description: '🦅 View ARCHON CG-223 neural engine stats for this server',
    category: 'SYSTEM',
    cooldown: 10000,
    usage: '.botstats',
    examples: ['.botstats', '.bs'],

    data: new SlashCommandBuilder()
        .setName('botstats')
        .setDescription('🦅 View ARCHON CG-223 neural engine stats for this server'),

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
        await showBotStats(client, message, db, lang, false);
    },

    execute: async (interaction, client) => {
        await interaction.deferReply().catch(() => {});
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        await showBotStats(client, interaction, client.db, lang, true);
    }
};
