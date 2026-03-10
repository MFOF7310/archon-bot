const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
    name: 'leaderboard',
    aliases: ['lb', 'top'],
    category: 'SYSTEM',
    run: async (client, message, args, database) => {
        if (!database || Object.keys(database).length === 0) {
            return message.reply("📊 **Database Offline:** No agent data detected in the node.");
        }

        const fullList = Object.entries(database)
            .map(([id, data]) => ({
                id,
                name: data.name || "Unknown Agent",
                xp: data.xp || 0,
                level: data.level || 1
            }))
            .sort((a, b) => b.xp - a.xp)
            .slice(0, 10);

        const pages = [fullList.slice(0, 5), fullList.slice(5, 10)];
        let currentPage = 0;

        const generateEmbed = (pageIdx) => {
            const list = pages[pageIdx].map((user, index) => {
                const globalRank = (pageIdx * 5) + index + 1;
                let badge = `**#${globalRank}**`;
                if (globalRank === 1) badge = '🥇';
                if (globalRank === 2) badge = '🥈';
                if (globalRank === 3) badge = '🥉';
                return `${badge} <@${user.id}>\n╰ ✨ XP: \`${user.xp.toLocaleString()}\` | ⚡ Lvl: \`${user.level}\``;
            }).join('\n\n');

            return new EmbedBuilder()
                .setColor(pageIdx === 0 ? '#f1c40f' : '#3498db')
                .setTitle('🏆 TOP-TIER AGENTS | RANKINGS')
                .setDescription(list || "*No further data.*")
                .setFooter({ text: `Page ${pageIdx + 1}/2 | Node: Bamako-223` })
                .setTimestamp();
        };

        const generateButtons = (pageIdx) => {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('prev_lb').setLabel('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(pageIdx === 0),
                new ButtonBuilder().setCustomId('next_lb').setLabel('➡️').setStyle(ButtonStyle.Primary).setDisabled(pageIdx === 1 || pages[1].length === 0)
            );
        };

        const mainMessage = await message.reply({
            embeds: [generateEmbed(currentPage)],
            components: [generateButtons(currentPage)]
        });

        const collector = mainMessage.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) return i.reply({ content: "❌ Unauthorized.", ephemeral: true });
            currentPage = i.customId === 'next_lb' ? 1 : 0;
            await i.update({ embeds: [generateEmbed(currentPage)], components: [generateButtons(currentPage)] });
        });

        collector.on('end', () => { mainMessage.edit({ components: [] }).catch(() => null); });
    }
};
