const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'lydia',
    aliases: ['ai', 'aimode'],
    description: 'Toggle Lydia AI with REAL-TIME web access in this channel.',
    category: 'SYSTEM',
    run: async (client, message, args, database) => {
        // Admin permission check
        if (!message.member.permissions.has('Administrator')) {
            return message.reply("⛔ **Access Denied:** Administrator clearance required.");
        }

        const channelId = message.channel.id;
        const channelName = message.channel.name;
        const prefix = process.env.PREFIX || '.';

        // Parse subcommand
        const subCommand = args[0] ? args[0].toLowerCase() : null;
        if (!subCommand || (subCommand !== 'on' && subCommand !== 'off')) {
            // Show usage if invalid or missing argument
            const usageEmbed = new EmbedBuilder()
                .setColor('#ff9900')
                .setTitle('⚙️ AI CONTROL PANEL')
                .setDescription(`**Usage:** \`${prefix}lydia on\` or \`${prefix}lydia off\``)
                .addFields(
                    { name: '💬 Activation', value: 'Mention or reply to the bot to talk to Lydia.' }
                )
                .setFooter({ text: 'Cloud Gaming-223 Systems' })
                .setTimestamp();
            return message.reply({ embeds: [usageEmbed] });
        }

        // --- TURN ON ---
        if (subCommand === 'on') {
            // Check if already active
            if (client.lydiaChannels && client.lydiaChannels[channelId]) {
                const alreadyActiveEmbed = new EmbedBuilder()
                    .setColor('#e74c3c')
                    .setTitle('⚠️ ALREADY ACTIVE')
                    .setDescription(`Lydia Engine is already active in **#${channelName}**.`)
                    .addFields(
                        { name: '❌ To Disable', value: `\`${prefix}lydia off\``, inline: true }
                    )
                    .setFooter({ text: 'MADE BY CLOUDGAMING-223' })
                    .setTimestamp();
                return message.reply({ embeds: [alreadyActiveEmbed] });
            }

            // Activate
            if (!client.lydiaChannels) client.lydiaChannels = {};
            client.lydiaChannels[channelId] = true;

            const onEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('✅ LYDIA ACTIVATED')
                .setDescription(`Lydia Engine is now **ACTIVE** in **#${channelName}** with REAL-TIME web search!`)
                .addFields(
                    { name: '💬 How to use', value: 'Mention or reply to the bot to talk to Lydia.' },
                    { name: '❌ To Disable', value: `\`${prefix}lydia off\``, inline: true }
                )
                .setFooter({ text: 'Cloud Gaming-223 | Powered by Groq + Brave' })
                .setTimestamp();

            return message.reply({ embeds: [onEmbed] });
        }

        // --- TURN OFF ---
        if (subCommand === 'off') {
            // Check if already inactive
            if (!client.lydiaChannels || !client.lydiaChannels[channelId]) {
                const alreadyInactiveEmbed = new EmbedBuilder()
                    .setColor('#e74c3c')
                    .setTitle('⚠️ NOT ACTIVE')
                    .setDescription(`Lydia Engine is not active in **#${channelName}**.`)
                    .addFields(
                        { name: '✅ To Activate', value: `\`${prefix}lydia on\``, inline: true }
                    )
                    .setFooter({ text: 'MADE BY CLOUDGAMING-223' })
                    .setTimestamp();
                return message.reply({ embeds: [alreadyInactiveEmbed] });
            }

            // Deactivate
            delete client.lydiaChannels[channelId];

            const offEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('❌ LYDIA DEACTIVATED')
                .setDescription(`Lydia Engine has been **disabled** in **#${channelName}**.`)
                .addFields(
                    { name: '✅ To Re-Enable', value: `\`${prefix}lydia on\``, inline: true }
                )
                .setFooter({ text: 'Cloud Gaming-223 Systems' })
                .setTimestamp();

            return message.reply({ embeds: [offEmbed] });
        }
    }
};