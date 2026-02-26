const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'menu',
    description: 'Main dashboard and command list',
    async execute(message, args, client) {
        // 1. Scan the plugins folder (Self-contained, no external lib needed)
        const pluginsPath = path.join(__dirname);
        const pluginFiles = fs.readdirSync(pluginsPath).filter(file => file.endsWith('.js'));
        const commandList = pluginFiles.map(file => `\`,${file.split('.')[0]}\``).join(' ');

        // 2. Create the Embed
        const menuEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🚀 AES Region Digital Dashboard')
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription(`Hello **${message.author.username}**! All systems are operational.`)
            .addFields(
                { name: '🛠️ Commands Found', value: commandList || 'Scanning...' },
                { name: '🤖 AI Model', value: '`Gemini 2.0 Flash`', inline: true },
                { name: '🌍 Location', value: '`Mali (Sahel)`', inline: true }
            )
            .setFooter({ text: 'Prefix is "," | AES Bot v2.0' })
            .setTimestamp();

        // 3. Simple Menu Row
        const menuRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('main_menu')
                .setPlaceholder('Select a feature...')
                .addOptions([
                    { label: 'AI Assistant', value: 'ai', emoji: '🤖' },
                    { label: 'Translation', value: 'trt', emoji: '🌐' },
                    { label: 'Weather', value: 'wth', emoji: '🌤️' }
                ])
        );

        return message.reply({ embeds: [menuEmbed], components: [menuRow] });
    }
};
