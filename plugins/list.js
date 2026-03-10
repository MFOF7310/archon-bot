const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'list',
    description: 'Scans and lists all active system modules.',
    category: 'SYSTEM',
    run: async (client, message, args, database) => {
        // Path to the plugins folder
        const pluginsPath = path.join(__dirname, '../plugins');
        const prefix = process.env.PREFIX || ".";
        
        try {
            // Read all .js files in the directory
            const commandFiles = fs.readdirSync(pluginsPath).filter(file => file.endsWith('.js'));
            
            const embed = new EmbedBuilder()
                .setColor('#36ced1')
                .setAuthor({ name: 'ARCHITECT CG-223 | SYSTEM SCAN', iconURL: client.user.displayAvatarURL() })
                .setTitle('🛰️ ACTIVE CORE MODULES')
                .setTimestamp();

            // Prepare list and count
            let descriptionText = `**${commandFiles.length}** Modules detected and operational in the **Bamako Node**.\n\n`;

            commandFiles.forEach(file => {
                // We use the client.commands collection instead of re-requiring files 
                // This is faster and uses less memory
                const commandName = file.split('.')[0];
                const cmd = client.commands.get(commandName);

                if (cmd) {
                    descriptionText += `🔹 **${prefix}${cmd.name}**\n└ *${cmd.description || 'No data provided.'}*\n\n`;
                }
            });

            // Handle Discord's 4096 character limit for descriptions
            if (descriptionText.length > 4000) {
                descriptionText = descriptionText.substring(0, 3950) + "... [Data Truncated]";
            }

            embed.setDescription(descriptionText);
            embed.setFooter({ text: 'Eagle Community | Digital Engine' });

            await message.reply({ embeds: [embed] });

        } catch (err) {
            console.error("Scan Error:", err);
            message.reply("⚠️ **Scan Failed:** The file system rejected the request.");
        }
    },
};
