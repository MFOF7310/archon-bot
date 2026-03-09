const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
    name: 'leaderboard',
    aliases: ['lb', 'top'],
    async execute(message, args, client, model, lydiaChannels, database) {
        // 1. Convert Database Object to a Sorted Array
        const fullList = Object.entries(database)
            .map(([id, data]) => ({
                id,
                name: data.name || "Unknown Agent",
                xp: data.xp || 0,
                level: data.level || 1
            }))
            .sort((a, b) => b.xp - a.xp)
            .slice(0, 10); // Keep only Top 10

        if (fullList.length === 0) {
            return message.reply("📊 **SYSTEM LOG:** No agent data found in database.");
        }

        // 2. Split into two pages (5 agents per page)
        const pages = [
            fullList.slice(0, 5), // Page 1
            fullList.slice(5, 10) // Page 2
        ];

        let currentPage = 0;

        // --- Function to build the Embed ---
        const generateEmbed = (pageIdx) => {
            const list = pages[pageIdx].map((user, index) => {
                const globalRank = (pageIdx * 5) + index + 1;
                let badge = `**#${globalRank}**`;
                
                // Style Top 3
                if (globalRank === 1) badge = '🥇';
                if (globalRank === 2) badge = '🥈';
                if (globalRank === 3) badge = '🥉';

                return `${badge} <@${user.id}>\n╰ ✨ XP: \`${user.xp.toLocaleString()}\` | ⚡ Lvl: \`${user.level}\``;
            }).join('\n\n');

            return new EmbedBuilder()
                .setColor(pageIdx === 0 ? '#f1c40f' : '#3498db') // Gold for P1, Blue for P2
                .setAuthor({ 
                    name: 'CLOUD_GAMING-223 NETWORK', 
                    iconURL: client.user.displayAvatarURL() 
                })
                .setTitle('🏆 TOP-TIER AGENTS | RANKINGS')
                .setThumbnail('https://cdn-icons-png.flaticon.com/512/3112/3112946.png')
                .setDescription(list)
                .setFooter({ 
                    text: `Node: Bamako-223 | Page ${pageIdx + 1}/2 | Total: ${fullList.length} Agents`, 
                    iconURL: message.guild.iconURL() 
                })
                .setTimestamp();
        };

        // --- Function to build the Buttons ---
        const generateButtons = (pageIdx) => {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('prev_lb')
                    .setLabel('⬅️ Page 1/2')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(pageIdx === 0), // Disable if already on Page 1
                new ButtonBuilder()
                    .setCustomId('next_lb')
                    .setLabel('Page 2/2 ➡️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(pageIdx === 1 || pages[1].length === 0) // Disable if on Page 2 OR Page 2 is empty
            );
            return row;
        };

        // 3. Send the initial Leaderboard
        const mainMessage = await message.reply({
            embeds: [generateEmbed(currentPage)],
            components: [generateButtons(currentPage)]
        });

        // 4. Create the Button Collector
        const collector = mainMessage.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000 // Buttons active for 1 minute
        });

        collector.on('collect', async (i) => {
            // Security: Only the person who called the command can use buttons
            if (i.user.id !== message.author.id) {
                return i.reply({ content: "❌ Access Denied. Only the commander can toggle pages.", ephemeral: true });
            }

            // Update page index based on button click
            if (i.customId === 'next_lb') currentPage = 1;
            if (i.customId === 'prev_lb') currentPage = 0;

            // Refresh the message with new Page and updated Buttons
            await i.update({
                embeds: [generateEmbed(currentPage)],
                components: [generateButtons(currentPage)]
            });
        });

        // 5. Cleanup: Remove buttons when the collector expires
        collector.on('end', () => {
            mainMessage.edit({ components: [] }).catch(() => null);
        });
    }
};
