const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const ROOT_DIR = path.join(__dirname, '..');

function getGitLog(n = 8) {
    try {
        const raw = execSync(
            `git -C ${ROOT_DIR} log --oneline -${n} --no-merges`,
            { encoding: 'utf8', timeout: 3000 }
        ).trim();
        return raw.split('\n').filter(Boolean).map(line => {
            const spaceIdx = line.indexOf(' ');
            const hash = line.slice(0, spaceIdx);
            let msg = line.slice(spaceIdx + 1)
                .replace(/^(feat|fix|refactor|chore|docs|style|perf|test)(\([^)]+\))?:\s*/i, '')
                .replace(/[\u{1F1E0}-\u{1F1FF}]{2}/gu, '')
                .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
                .trim();
            return { hash: hash.slice(0, 7), msg };
        });
    } catch (e) { return []; }
}

function getLiveStats(client) {
    const uptimeSec = process.uptime();
    const days = Math.floor(uptimeSec / 86400);
    const hours = Math.floor((uptimeSec % 86400) / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);
    const ping = client.ws.ping || 0;
    const memMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    let version = '2.0.0';
    try {
        const versionFile = path.join(ROOT_DIR, 'version.txt');
        if (fs.existsSync(versionFile)) version = fs.readFileSync(versionFile, 'utf8').trim() || version;
    } catch (e) {}
    return {
        uptime: days > 0 ? `${days}d ${hours}h ${mins}m` : `${hours}h ${mins}m`,
        ping,
        pingEmoji: ping < 100 ? '\u{1F7E2}' : ping < 200 ? '\u{1F7E1}' : '\u{1F534}',
        memMB,
        guilds: (client.db ? (client.db.prepare("SELECT COUNT(DISTINCT guild_id) FROM users WHERE guild_id NOT IN ('DM','telegram')").get()["COUNT(DISTINCT guild_id)"] || client.guilds.cache.size) : client.guilds.cache.size),
        users: client.guilds.cache.reduce((a, g) => a + (g.memberCount || 0), 0).toLocaleString(),
        commands: client.commands?.size || 0,
        version
    };
}

function buildEmbed(client, guildIcon) {
    const stats = getLiveStats(client);
    const commits = getGitLog(8);

    let changeText = '';
    if (commits.length > 0) {
        changeText = commits.map(c => `> \`${c.hash}\` ${c.msg}`).join('\n');
    } else {
        changeText = 'Everything is running clean. No recent changes logged yet.';
    }

    const embed = new EmbedBuilder()
        .setColor('#00d4ff')
        .setAuthor({ name: "ARCHON CG-223 \u2014 What's New", iconURL: client.user?.displayAvatarURL() })
        .setTitle('Latest Changes')
        .setThumbnail(client.user?.displayAvatarURL({ size: 256 }))
        .setFooter({ text: `v${stats.version} \u2022 BAMAKO_223 \u{1F1F2}\u{1F1F1} \u2022 /changelog`, iconURL: guildIcon || client.user?.displayAvatarURL() })
        .setTimestamp();

    embed.setDescription(changeText + '\n\u200b');

    embed.addFields({
        name: '\u26A1 Live Status',
        value: [
            `\`Uptime \` ${stats.uptime}`,
            `\`Ping   \` ${stats.pingEmoji} ${stats.ping}ms`,
            `\`Memory \` ${stats.memMB} MB`,
            `\`Servers\` ${stats.guilds}`,
            `\`Members\` ${stats.users}`,
            `\`Plugins\` ${stats.commands} loaded`,
        ].join('\n'),
        inline: false
    });

    return embed;
}

module.exports = {
    name: 'changelog',
    aliases: ['changes', 'updates', 'version', 'patch', 'maj', 'misesajour'],
    description: 'Latest ARCHON updates pulled from git history',
    category: 'SYSTEM',
    usage: '.changelog',
    cooldown: 5000,

    data: new SlashCommandBuilder()
        .setName('changelog')
        .setDescription('View the latest ARCHON updates and system status'),

    run: async (client, message, args, db, serverSettings) => {
        const guildIcon = message.guild?.iconURL() || client.user?.displayAvatarURL();
        const embed = buildEmbed(client, guildIcon);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Dashboard').setURL('https://bamako-steel-dev.xyz').setStyle(ButtonStyle.Link).setEmoji('\u{1F310}'),
            new ButtonBuilder().setLabel('Invite ARCHON').setURL('https://discord.com/oauth2/authorize?client_id=1204920379971645460&permissions=8&scope=bot%20applications.commands').setStyle(ButtonStyle.Link).setEmoji('\u{1F916}')
        );
        return message.reply({ embeds: [embed], components: [row] });
    },

    execute: async (interaction, client) => {
        await interaction.deferReply();
        const guildIcon = interaction.guild?.iconURL() || client.user?.displayAvatarURL();
        const embed = buildEmbed(client, guildIcon);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Dashboard').setURL('https://bamako-steel-dev.xyz').setStyle(ButtonStyle.Link).setEmoji('\u{1F310}'),
            new ButtonBuilder().setLabel('Invite ARCHON').setURL('https://discord.com/oauth2/authorize?client_id=1204920379971645460&permissions=8&scope=bot%20applications.commands').setStyle(ButtonStyle.Link).setEmoji('\u{1F916}')
        );
        await interaction.editReply({ embeds: [embed], components: [row] });
    }
};
