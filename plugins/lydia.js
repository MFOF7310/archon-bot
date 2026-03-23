const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'lydia',
    aliases: ['ai', 'aimode'],
    description: 'Toggle Lydia AI with REAL-TIME web access in this channel.',
    category: 'SYSTEM',
    run: async (client, message, args, database) => {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply("⛔ **SECURITY BREACH:** Administrator clearance required to modify Neural Protocols.");
        }

        const channelId = message.channel.id;
        const prefix = process.env.PREFIX || '.';
        const subCommand = args[0]?.toLowerCase();

        // Ensure the channel tracker exists
        if (!client.lydiaChannels) client.lydiaChannels = {};

        // --- USAGE / STATUS CHECK ---
        if (!subCommand || (subCommand !== 'on' && subCommand !== 'off')) {
            const isEnabled = client.lydiaChannels[channelId];
            const usageEmbed = new EmbedBuilder()
                .setColor('#ff9900')
                .setAuthor({ name: 'LYDIA NEURAL INTERFACE', iconURL: client.user.displayAvatarURL() })
                .setTitle('⚙️ AI PROTOCOL CONFIGURATION')
                .setDescription(
                    `**Current State:** ${isEnabled ? '`🟢 ACTIVE`' : '`🔴 OFFLINE`'}\n` +
                    `Lydia utilizes **Groq LPU™** for inference and **Brave Search** for real-time intelligence.`
                )
                .addFields(
                    { name: '◈ Commands', value: `\`${prefix}lydia on\` - Initialize Core\n\`${prefix}lydia off\` - Terminate Core`, inline: true },
                    { name: '◈ Interaction', value: 'Mention or Reply to trigger Neural Link.', inline: true }
                )
                .setFooter({ text: 'ARCHITECT CG-223 | DIGITAL SOVEREIGNTY' })
                .setTimestamp();

            return message.reply({ embeds: [usageEmbed] });
        }

        // --- PROTOCOL: INITIALIZE (ON) ---
        if (subCommand === 'on') {
            if (client.lydiaChannels[channelId]) {
                return message.reply("⚠️ **SYSTEM NOTICE:** Lydia Neural Link is already synchronized with this channel.");
            }

            client.lydiaChannels[channelId] = true;
            const onEmbed = new EmbedBuilder()
                .setColor('#00fbff')
                .setTitle('✅ NEURAL CORE INITIALIZED')
                .setDescription(`**Lydia Engine is now ONLINE in <#${channelId}>.**`)
                .addFields(
                    { name: '📡 Capabilities', value: '`Real-Time Web Search` | `High-Speed Inference` | `Context Awareness`' },
                    { name: '🔒 Security', value: `Disable anytime via \`${prefix}lydia off\`` }
                )
                .setFooter({ text: 'POWERED BY GROQ + BRAVE SEARCH' })
                .setTimestamp();

            return message.reply({ embeds: [onEmbed] });
        }

        // --- PROTOCOL: TERMINATE (OFF) ---
        if (subCommand === 'off') {
            if (!client.lydiaChannels[channelId]) {
                return message.reply("⚠️ **SYSTEM NOTICE:** No active Neural Link detected in this sector.");
            }

            delete client.lydiaChannels[channelId];
            const offEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('❌ NEURAL CORE TERMINATED')
                .setDescription(`**Lydia Engine has been purged from <#${channelId}>.**`)
                .addFields(
                    { name: '📉 Status', value: 'Inference modules set to standby mode.' }
                )
                .setFooter({ text: 'ARCHITECT CG-223 | Cloud Gaming-223' })
                .setTimestamp();

            return message.reply({ embeds: [offEmbed] });
        }
    }
};
