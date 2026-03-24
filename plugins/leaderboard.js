const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
    name: 'leaderboard',
    aliases: ['lb', 'top', 'rankings'],
    category: 'SYSTEM',
    description: 'Display the top-tier agents by neural synchronization (XP).',
    run: async (client, message, args, database) => {
        
        // 1. DATA EXTRACTION
        const entries = Object.entries(database)
            .filter(([id]) => !isNaN(id)) 
            .map(([id, data]) => ({
                id,
                xp: data.xp || 0,
                level: data.level || 1
            }))
            .sort((a, b) => b.xp - a.xp);

        if (entries.length === 0) {
            return message.reply("📊 **DATABASE EMPTY:** No agent telemetry detected.");
        }

        // --- SURPRISE: PERSONAL POSITION SCAN ---
        const userIndex = entries.findIndex(e => e.id === message.author.id);
        const userRank = userIndex === -1 ? 'UNRANKED' : userIndex + 1;
        const userXP = userIndex === -1 ? 0 : entries[userIndex].xp;
        
        // Calculate distance to the person above them
        let motivationalQuote = "";
        if (userIndex > 0) {
            const gap = entries[userIndex - 1].xp - userXP;
            motivationalQuote = `▫️ Need **${gap.toLocaleString()} XP** to overtake Rank #${userIndex}.`;
        } else if (userIndex === 0) {
            motivationalQuote = "👑 **APEX AGENT:** You are currently leading the sector.";
        }

        const pageSize = 5;
        const maxPage = Math.ceil(entries.length / pageSize) - 1;
        let currentPage = 0;

        // 2. DYNAMIC EMBED GENERATOR
        const generateEmbed = (page) => {
            const start = page * pageSize;
            const pageEntries = entries.slice(start, start + pageSize);
            const statusIcons = ['🥇', '🥈', '🥉', '🔹', '🔹'];

            let description = `**NODE:** \`Bamako-223\`\n**TOTAL AGENTS:** \`${entries.length}\`\n\n`;

            pageEntries.forEach((user, idx) => {
                const globalRank = start + idx + 1;
                const icon = globalRank <= 3 ? statusIcons[globalRank - 1] : '▪️';
                const percent = Math.floor((user.xp % 1000) / 10);
                const bar = '▰'.repeat(Math.floor(percent / 10)) + '▱'.repeat(10 - Math.floor(percent / 10));
                
                description += `${icon} **<@${user.id}>**\n`;
                description += `╰ \`LVL ${user.level}\` • \`${user.xp.toLocaleString()} XP\`\n`;
                description += `╰ \`[${bar}]\` **${percent}**%\n\n`;
            });

            const embed = new EmbedBuilder()
                .setColor('#00fbff')
                .setAuthor({ name: 'ARCHITECT | HIGH-SYNC LEADERBOARD', iconURL: client.user.displayAvatarURL() })
                .setThumbnail(message.guild.iconURL({ dynamic: true }))
                .setDescription(description)
                // --- THE SURPRISE FOOTER ---
                .addFields({ 
                    name: '🛰️ YOUR POSITION', 
                    value: `\`\`\`prolog\nRank: #${userRank} | Total: ${userXP.toLocaleString()} XP\n${motivationalQuote}\`\`\`` 
                })
                .setFooter({ text: `Page ${page + 1}/${maxPage + 1} • Eagle Community Synchronization` })
                .setTimestamp();

            return embed;
        };

        // 3. NAVIGATION COMPONENTS
        const generateButtons = (page) => {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('prev_lb').setLabel('PREV').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
                new ButtonBuilder().setCustomId('next_lb').setLabel('NEXT').setStyle(ButtonStyle.Primary).setDisabled(page === maxPage)
            );
        };

        const lbMessage = await message.reply({
            content: `> **Scanning neural frequencies... standings acquired.**`,
            embeds: [generateEmbed(currentPage)],
            components: [generateButtons(currentPage)]
        });

        // 4. INTERACTION COLLECTOR
        const collector = lbMessage.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 120000 
        });

        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) return i.reply({ content: "⛔ Lock active.", ephemeral: true });
            if (i.customId === 'prev_lb') currentPage--;
            if (i.customId === 'next_lb') currentPage++;

            await i.update({
                embeds: [generateEmbed(currentPage)],
                components: [generateButtons(currentPage)]
            });
        });

        collector.on('end', () => {
            lbMessage.edit({ components: [] }).catch(() => null);
        });
    }
};
