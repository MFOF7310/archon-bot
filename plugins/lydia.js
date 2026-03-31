// plugins/lydia.js
const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'lydia',
    aliases: ['ai', 'aimode'],
    description: 'Toggle Lydia AI with REAL-TIME web access in this channel.',
    category: 'SYSTEM',
    cooldown: 5000,
    
    run: async (client, message, args, database) => {
        // Admin only - protect API credits
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff4444')
                .setTitle('⛔ ACCESS DENIED')
                .setDescription('**Administrator clearance** required to modify Neural Protocols.')
                .setFooter({ text: 'ARCHITECT CG-223 • Security Level: ADMIN' })
                .setTimestamp();
            
            return message.reply({ embeds: [errorEmbed] });
        }

        const channelId = message.channel.id;
        const prefix = process.env.PREFIX || '.';
        const subCommand = args[0]?.toLowerCase();

        // Initialize tracker if needed
        if (!client.lydiaChannels) client.lydiaChannels = {};

        // --- SIMPLE USAGE / STATUS ---
        if (!subCommand || (subCommand !== 'on' && subCommand !== 'off')) {
            const isEnabled = client.lydiaChannels[channelId];
            
            const statusEmbed = new EmbedBuilder()
                .setColor(isEnabled ? '#00fbff' : '#95a5a6')
                .setAuthor({ 
                    name: '🤖 LYDIA NEURAL INTERFACE', 
                    iconURL: client.user.displayAvatarURL() 
                })
                .setDescription(
                    `**Current Status:** ${isEnabled ? '🟢 **ACTIVE**' : '🔴 **STANDBY**'}\n\n` +
                    `**${prefix}lydia on** - Activate AI in this channel\n` +
                    `**${prefix}lydia off** - Deactivate AI\n\n` +
                    `**Capabilities:** Real-time search • AI responses • Malian context 🇲🇱`
                )
                .addFields(
                    { 
                        name: '📡 API Status', 
                        value: `Groq: ${process.env.GROQ_API_KEY ? '✅' : '❌'} | Brave: ${process.env.BRAVE_API_KEY ? '✅' : '❌'}`,
                        inline: true 
                    }
                )
                .setFooter({ text: 'Mention or reply to interact with Lydia' })
                .setTimestamp();

            return message.reply({ embeds: [statusEmbed] });
        }

        // --- ACTIVATE LYDIAS ---
        if (subCommand === 'on') {
            if (client.lydiaChannels[channelId]) {
                return message.reply("⚠️ **Lydia is already active** in this channel.");
            }

            // Warn about missing APIs but still allow activation
            let warning = '';
            if (!process.env.GROQ_API_KEY) warning += '\n⚠️ **Groq API missing** - AI responses limited';
            if (!process.env.BRAVE_API_KEY) warning += '\n⚠️ **Brave API missing** - Web search unavailable';

            client.lydiaChannels[channelId] = true;
            
            const onEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('✅ NEURAL CORE INITIALIZED')
                .setDescription(`**Lydia is now ONLINE** in <#${channelId}>${warning}`)
                .addFields(
                    { name: '🎯 How to Use', value: `Mention **@Lydia** or reply to her messages`, inline: true },
                    { name: '🔒 Security', value: `\`${prefix}lydia off\` to terminate`, inline: true }
                )
                .setFooter({ text: 'POWERED BY GROQ + BRAVE SEARCH' })
                .setTimestamp();

            return message.reply({ embeds: [onEmbed] });
        }

        // --- DEACTIVATE LYDIA ---
        if (subCommand === 'off') {
            if (!client.lydiaChannels[channelId]) {
                return message.reply("⚠️ **Lydia is not active** in this channel.");
            }

            delete client.lydiaChannels[channelId];
            
            const offEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('❌ NEURAL CORE TERMINATED')
                .setDescription(`**Lydia has been deactivated** in <#${channelId}>.`)
                .addFields(
                    { name: '🔄 Reactivate', value: `\`${prefix}lydia on\` to restart`, inline: true }
                )
                .setFooter({ text: 'ARCHITECT CG-223' })
                .setTimestamp();

            return message.reply({ embeds: [offEmbed] });
        }
    }
};