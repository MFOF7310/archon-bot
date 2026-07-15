const fs = require('fs');
const path = require('path');
const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const ROOT_DIR = path.join(__dirname, '..');
const CHANGELOG_FILE = path.join(ROOT_DIR, 'changelog.md');

// ================= READ CHANGELOG.MD =================
function getLatestEntry() {
    try {
        if (!fs.existsSync(CHANGELOG_FILE)) return null;
        const raw = fs.readFileSync(CHANGELOG_FILE, 'utf8');

        // Grab everything from the first ## heading to the second one
        const lines = raw.split('\n');
        const entries = [];
        let current = null;

        for (const line of lines) {
            if (line.startsWith('## ')) {
                if (current) entries.push(current);
                current = { header: line.replace('## ', '').trim(), lines: [] };
            } else if (current) {
                current.lines.push(line);
            }
        }
        if (current) entries.push(current);

        return entries[0] || null;
    } catch (e) {
        return null;
    }
}

function getAllVersions() {
    try {
        if (!fs.existsSync(CHANGELOG_FILE)) return [];
        const raw = fs.readFileSync(CHANGELOG_FILE, 'utf8');
        return raw.split('\n')
            .filter(l => l.startsWith('## '))
            .map(l => l.replace('## ', '').trim())
            .slice(0, 5);
    } catch (e) {
        return [];
    }
}

// ================= LIVE STATS =================
function getLiveStats(client) {
    const uptimeSec = process.uptime();
    const days = Math.floor(uptimeSec / 86400);
    const hours = Math.floor((uptimeSec % 86400) / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);

    const ping = client.ws.ping || 0;
    const pingEmoji = ping < 100 ? '🟢' : ping < 200 ? '🟡' : '🔴';

    const memMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

    let version = '2.0.0';
    try {
        const pkg = path.join(ROOT_DIR, 'package.json');
        if (fs.existsSync(pkg)) version = JSON.parse(fs.readFileSync(pkg, 'utf8')).version || version;
    } catch (e) {}

    return {
        uptime: days > 0 ? `${days}d ${hours}h ${mins}m` : `${hours}h ${mins}m`,
        ping, pingEmoji,
        memMB,
        guilds: client.guilds.cache.size,
        users: client.guilds.cache.reduce((a, g) => a + (g.memberCount || 0), 0).toLocaleString(),
        commands: client.commands?.size || 0,
        version
    };
}

// ================= BUILD EMBED =================
function buildEmbed(client, guildIcon) {
    const stats = getLiveStats(client);
    const latest = getLatestEntry();
    const versions = getAllVersions();

    // Parse the latest changelog entry into bullet points
    let changeText = '';
    if (latest) {
        const bullets = latest.lines
            .filter(l => l.trim().startsWith('-') || l.trim().startsWith('•'))
            .map(l => l.trim().replace(/^[-•]\s*/, '').trim())
            .filter(Boolean)
            .slice(0, 8); // max 8 bullets to stay under limit

        if (bullets.length > 0) {
            changeText = bullets.map(b => `▸ ${b}`).join('\n');
        } else {
            // fallback: just take first few non-empty lines
            changeText = latest.lines
                .filter(l => l.trim().length > 0)
                .slice(0, 6)
                .map(l => `▸ ${l.trim()}`)
                .join('\n');
        }
    }

    const embed = new EmbedBuilder()
        .setColor('#00d4ff')
        .setAuthor({
            name: 'ARCHON CG-223 — System Changelog',
            iconURL: client.user?.displayAvatarURL()
        })
        .setTitle(`📋 ${latest?.header || `v${stats.version} — Latest Update`}`)
        .setThumbnail(client.user?.displayAvatarURL({ size: 256 }))
        .setFooter({
            text: `ARCHON v${stats.version} • BAMAKO_223 🇲🇱 • /changelog`,
            iconURL: guildIcon || client.user?.displayAvatarURL()
        })
        .setTimestamp();

    // What changed
    if (changeText) {
        embed.setDescription(changeText);
    } else {
        embed.setDescription('Everything is running clean. No recent changes logged yet.');
    }

    // Live system health
    embed.addFields({
        name: '⚡ System Health',
        value: [
            `\`Uptime\`  ${stats.uptime}`,
            `\`Ping  \`  ${stats.pingEmoji} ${stats.ping}ms`,
            `\`Memory\`  ${stats.memMB} MB`,
            `\`Guilds \`  ${stats.guilds} servers`,
            `\`Users  \`  ${stats.users} members`,
            `\`Cmds  \`  ${stats.commands} loaded`,
        ].join('\n'),
        inline: false
    });

    // Version history (last 5)
    if (versions.length > 1) {
        embed.addFields({
            name: '🕓 Recent Versions',
            value: versions.map((v, i) => i === 0 ? `→ **${v}** *(current)*` : `   ${v}`).join('\n'),
            inline: false
        });
    }

    return embed;
}

// ================= MODULE =================
module.exports = {
    name: 'changelog',
    aliases: ['changes', 'updates', 'version', 'patch', 'maj', 'misesajour'],
    description: '📋 Latest ARCHON updates with live system stats',
    category: 'SYSTEM',
    usage: '.changelog',
    cooldown: 5000,

    data: new SlashCommandBuilder()
        .setName('changelog')
        .setDescription('📋 View the latest ARCHON updates and system status'),

    run: async (client, message, args, db, serverSettings) => {
        const guildIcon = message.guild?.iconURL() || client.user?.displayAvatarURL();
        const embed = buildEmbed(client, guildIcon);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Dashboard')
                .setURL('https://bamako-steel-dev.xyz')
                .setStyle(ButtonStyle.Link)
                .setEmoji('🌐'),
            new ButtonBuilder()
                .setLabel('Support Server')
                .setURL('https://discord.gg/archon')
                .setStyle(ButtonStyle.Link)
                .setEmoji('💬')
        );

        return message.reply({ embeds: [embed], components: [row] });
    },

    execute: async (interaction, client) => {
        await interaction.deferReply();

        const guildIcon = interaction.guild?.iconURL() || client.user?.displayAvatarURL();
        const embed = buildEmbed(client, guildIcon);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Dashboard')
                .setURL('https://bamako-steel-dev.xyz')
                .setStyle(ButtonStyle.Link)
                .setEmoji('🌐'),
            new ButtonBuilder()
                .setLabel('Support Server')
                .setURL('https://discord.gg/archon')
                .setStyle(ButtonStyle.Link)
                .setEmoji('💬')
        );

        await interaction.editReply({ embeds: [embed], components: [row] });
    }
};

