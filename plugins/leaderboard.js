const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
    name: 'leaderboard',
    aliases: ['lb', 'top'],
    async execute(message, args, client, model, lydiaChannels, database) {
        // 1. Process Database into a sorted array (Top 10)
        const fullList = Object.entries(database)
            .map(([id, data]) => ({
                id,
                name: data.name || "Unknown Agent",
                xp: data.xp || 0,
                level: data.level || 1
            }))
            .sort((a, b) => b.xp - a.xp)
            .slice(0, 10);

        if (fullList.length === 0) {
            return message.reply("📊 **SYSTEM LOG:** No agent data found in database.");
        }

        // Split into two pages (5 agents each)
        const pages = [fullList.slice(0, 5), fullList.slice(5, 10)];
        let currentPage = 0;

        // Function to create the embed for a specific page
        const generateEmbed = (pageIdx) => {
            const list = pages[pageIdx].map((user, index) => {
                const globalIndex = pageIdx * 5 + index;
                let badge = `**#${globalIndex + 1}**`;
                if (globalIndex === 0) badge = '🥇';
                if (globalIndex === 1) badge = '🥈';
                if (globalIndex === 2) badge = '🥉';

                // Mentioning the user for that "intelligent" look
                return `${badge} <@${user.id}>\n╰ ⚡ Lvl: \`${user.level}\` | ✨ XP: \`${user.xp.toLocaleString()}\``;
            }).join('\n\n');

            return new EmbedBuilder()
                .setColor(pageIdx === 0 ? '#f1c40f' : '#3498db') // Gold for P1, Blue for P2
                .setAuthor({ 
                    name: 'CLOUD_GAMING-223 NETWORK', 
                    iconURL: client.user.displayAvatarURL() 
                })
                .setTitle(`🏆 TOP-TIER AGENTS | PAGE ${pageIdx + 1}/2`)
                .setThumbnail('https://cdn-icons-png.flaticon.com/512/3112/3112946.png')
                .setDescription(list)
                .setFooter({ 
                    text: `Node: Bamako-223 | v${client.version || '1.0.0'}`, 
                    iconURL: message.guild.iconURL() 
                })
                .setTimestamp();
        };

        // Create the Buttons
        const getButtons = (pageIdx) => {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('prev')
                    .setLabel('⬅️ Previous')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(pageIdx === 0),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('Next ➡️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(pageIdx === 1 || pages[1].length === 0)
            );
        };

        // Initial Reply
        const response = await message.reply({
            embeds: [generateEmbed(currentPage)],
            components: [getButtons(currentPage)]
        });

        // 2. The Interaction Collector (The "Brain")
        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000 // Buttons active for 60 seconds
        });

        collector.on('collect', async (i) => {
            // Only the person who typed ,leaderboard can click
            if (i.user.id !== message.author.id) {
                return i.reply({ content: "Only the commander can switch pages!", ephemeral: true });
            }

            if (i.customId === 'next') currentPage = 1;
            if (i.customId === 'prev') currentPage = 0;

            await i.update({
                embeds: [generateEmbed(currentPage)],
                components: [getButtons(currentPage)]
            });
        });

        // Disable buttons after timeout
        collector.on('end', () => {
            response.edit({ components: [] }).catch(() => null);
        });
    }
};
