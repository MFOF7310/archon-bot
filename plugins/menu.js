const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'menu', // This handles both ,menu and ,help logic
    description: 'Main dashboard and command list',
    async execute(message, args, client) {
        // 1. Auto-scan the plugins folder to see what commands exist
        const pluginsPath = path.join(__dirname);
        const pluginFiles = fs.readdirSync(pluginsPath).filter(file => file.endsWith('.js'));
        const commandList = pluginFiles.map(file => `\`,${file.split('.')[0]}\``).join(' ');

        // 2. Build the visual dashboard
        const menuEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🚀 AES Region Digital Dashboard')
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription(`Hello **${message.author.username}**, welcome to the system command center.`)
            .addFields(
                { name: '🛠️ Installed Plugins', value: commandList || 'No plugins detected.' },
                { name: '🤖 AI Status', value: '`Gemini 2.0 Flash Online`', inline: true },
                { name: '🌍 Region', value: '`Mali / Sahel (AES)`', inline: true }
            )
            .setFooter({ text: 'Use the prefix "," before any command name.' })
            .setTimestamp();

        // 3. Add the interactive menu row
        const menuRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('main_menu')
                .setPlaceholder('Select a category for more info...')
                .addOptions([
                    { label: 'AI Assistant', description: 'Chat and Image Analysis', value: 'ai_info', emoji: '🤖' },
                    { label: 'System Status', description: 'Check server connection', value: 'sys_info', emoji: '📊' },
                    { label: 'AES Updates', description: 'Regional developments', value: 'aes_info', emoji: '🇲🇱' }
                ])
        );

        return message.reply({ embeds: [menuEmbed], components: [menuRow] });
    }
};
