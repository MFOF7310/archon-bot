const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'list',
    description: 'Scans and lists all active modules.',
    run: async (client, message, args, database) => {
        const pluginsPath = path.join(__dirname, '../plugins');
        const prefix = process.env.PREFIX || ",";
        
        try {
            const commandFiles = fs.readdirSync(pluginsPath).filter(file => file.endsWith('.js'));
            const embed = new EmbedBuilder()
                .setColor('#36ced1')
                .setTitle('🛰️ SYSTEM SCAN | ACTIVE PLUGINS')
                .setTimestamp();

            let descriptionText = `**${commandFiles.length}** Core modules operational.\n\n`;

            commandFiles.forEach(file => {
                const plugin = require(`./${file}`);
                descriptionText += `🔹 **${prefix}${plugin.name}**\n└ *${plugin.description || 'No data.'}*\n\n`;
            });

            embed.setDescription(descriptionText);
            await message.reply({ embeds: [embed] });
        } catch (err) {
            message.reply("⚠️ **Scan Failed.**");
        }
    },
};
