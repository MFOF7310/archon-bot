const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'list',
    description: 'Scans the plugins folder and lists all active modules.',
    async execute(message, args, client) {
        // 1. Path to your plugins folder
        const pluginsPath = path.join(__dirname, '../plugins');
        
        try {
            // 2. Read the actual files on the disk
            const commandFiles = fs.readdirSync(pluginsPath).filter(file => file.endsWith('.js'));
            
            const embed = new EmbedBuilder()
                .setColor('#36ced1')
                .setTitle('🛰️ DIGITAL ENGINE | SYSTEM SCAN')
                .setThumbnail(client.user.displayAvatarURL())
                .setTimestamp();

            let descriptionText = `**${commandFiles.length}** Modules detected in the engine core.\n\n`;

            // 3. Loop through files and extract their names
            commandFiles.forEach(file => {
                const command = require(`./${file}`);
                descriptionText += `🔹 **,${command.name}**\n└ *${command.description || 'No description.'}*\n\n`;
            });

            embed.setDescription(descriptionText);
            embed.setFooter({ text: 'Hardware scan: All plugins operational.' });

            await message.reply({ embeds: [embed] });

        } catch (err) {
            console.error("List Error:", err);
            message.reply("⚠️ **Scan Failed:** I couldn't access the plugins folder.");
        }
    },
};
