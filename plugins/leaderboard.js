const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
    name: 'leaderboard',
    aliases: ['lb', 'top'],
    category: 'SYSTEM',
    description: 'Display the top agents by XP.',
    run: async (client, message, args, database) => {
        if (!database || Object.keys(database).length === 0) {
            return message.reply("📊 **Database Offline:** No agent data detected in the node.");
        }

        // Build sorted array
        const entries = Object.entries(database)
            .map(([id, data]) => ({
                id,
                name: data.name || "Unknown Agent",
                xp: data.xp || 0,
                level: data.level || 1
            }))
            .sort((a, b) => b.xp - a.xp);

        const totalPlayers = entries.length;
        const pageSize = 5;
        const maxPage = Math.ceil(entries.length / pageSize) - 1;
        let currentPage = 0;

        // Helper: generate a gradient color based on page (gold for first page, then cooler)
        const getEmbedColor = (page) => {
            if (page === 0) return '#FFD700'; // Gold for page 1
            const colors = ['#FFA500', '#FF8C00', '#FF7F50', '#FF6347', '#FF4500'];
            return colors[page % colors.length] || '#3498db';
        };

        const generateEmbed = (page) => {
            const start = page * pageSize;
            const pageEntries = entries.slice(start, start + pageSize);
            const medalEmojis = ['🥇', '🥈', '🥉'];

            // Build description with clean formatting
            let description = '';
            pageEntries.forEach((user, idx) => {
                const rank = start + idx + 1;
                const medal = rank <= 3 ? medalEmojis[rank-1] : `**#${rank}**`;
                const xpProgress = user.xp % 1000;
                const percent = Math.floor((xpProgress / 1000) * 100);
                const bar = '▰'.repeat(Math.floor(percent / 10)) + '▱'.repeat(10 - Math.floor(percent / 10));
                
                description += `${medal} **<@${user.id}>**\n`;
                description += `╰ ✨ XP \`${user.xp.toLocaleString()}\` • ⚡ Level \`${user.level}\`\n`;
                description += `╰ \`${bar}\` ${percent}%\n\n`;
            });

            if (!description) description = '*No agents on this page.*';

            return new EmbedBuilder()
                .setColor(getEmbedColor(page))
                .setTitle('🏆 TOP‑TIER AGENTS')
                .setDescription(description)
                .setThumbnail(message.guild.iconURL({ dynamic: true })) // Server icon
                .setFooter({ 
                    text: `Page ${page+1}/${maxPage+1} • Total Agents: ${totalPlayers} • Bamako‑223 Node`,
                    iconURL: client.user.displayAvatarURL() 
                })
                .setTimestamp();
        };

        const generateButtons = (page) => {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('prev_lb')
                    .setEmoji('◀️')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId('page_indicator')
                    .setLabel(`Page ${page+1}/${maxPage+1}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true), // Always disabled – just for display
                new ButtonBuilder()
                    .setCustomId('next_lb')
                    .setEmoji('▶️')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === maxPage)
            );
        };

        const mainMessage = await message.reply({
            embeds: [generateEmbed(currentPage)],
            components: [generateButtons(currentPage)]
        });

        const collector = mainMessage.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000
        });

        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) {
                return i.reply({ content: "❌ These buttons aren't for you.", ephemeral: true });
            }
            if (i.customId === 'prev_lb' && currentPage > 0) currentPage--;
            if (i.customId === 'next_lb' && currentPage < maxPage) currentPage++;

            await i.update({
                embeds: [generateEmbed(currentPage)],
                components: [generateButtons(currentPage)]
            });
        });

        collector.on('end', () => {
            mainMessage.edit({ components: [] }).catch(() => null);
        });
    }
};