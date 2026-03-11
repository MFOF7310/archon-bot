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

        const generateEmbed = (page) => {
            const start = page * pageSize;
            const pageEntries = entries.slice(start, start + pageSize);
            const medal = ['🥇', '🥈', '🥉'];

            const description = pageEntries.map((user, idx) => {
                const rank = start + idx + 1;
                const medalIcon = rank <= 3 ? medal[rank-1] : `**#${rank}**`;
                const xpProgress = (user.xp % 1000) / 10; // 0-100
                const bar = '█'.repeat(Math.floor(xpProgress/10)) + '░'.repeat(10 - Math.floor(xpProgress/10));
                return `${medalIcon} <@${user.id}>\n╰ ✨ XP: \`${user.xp.toLocaleString()}\` | ⚡ Lvl: \`${user.level}\`\n╰ \`${bar}\` ${Math.floor(xpProgress)}% to next level`;
            }).join('\n\n');

            return new EmbedBuilder()
                .setColor(page === 0 ? '#f1c40f' : '#3498db')
                .setTitle('🏆 TOP-TIER AGENTS | RANKINGS')
                .setDescription(description || '*No entries on this page.*')
                .setFooter({ text: `Page ${page+1}/${maxPage+1} | Total Agents: ${totalPlayers} | Node: Bamako-223` })
                .setTimestamp();
        };

        const generateButtons = (page) => {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('prev_lb')
                    .setLabel('◀')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId('next_lb')
                    .setLabel('▶')
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
                return i.reply({ content: "❌ Unauthorized.", ephemeral: true });
            }
            currentPage = i.customId === 'next_lb' ? currentPage + 1 : currentPage - 1;
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