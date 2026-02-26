const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    name: 'menu',
    description: 'Displays the help menu',
    async execute(message, args, client) {
        const helpEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🚀 AES Region Dashboard')
            .setDescription(`Welcome **${message.author.username}**! Select a category below to see available commands.`)
            .setThumbnail(client.user.displayAvatarURL())
            .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() });

        const menuRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('help_select')
                .setPlaceholder('Choose a category...')
                .addOptions([
                    { label: 'DASHBOARD', value: 'home', emoji: '🏠' },
                    { label: 'AI COMMANDS', value: 'ai', emoji: '🤖' },
                    { label: 'UTILITY', value: 'util', emoji: '⚙️' },
                    { label: 'MODERATION', value: 'mod', emoji: '🛠️' }
                ])
        );

        return message.reply({ embeds: [helpEmbed], components: [menuRow] });
    }
};
