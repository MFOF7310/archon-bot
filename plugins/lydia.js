// ================= COMMAND .lydia =================
module.exports = {
    name: 'lydia',
    aliases: ['ai', 'neural'],
    description: '🎭 Multi-Agent AI with Neural Core Switching & Persistent Memory',
    category: 'SYSTEM',
    cooldown: 5000,
    run: async (client, message, args, database) => {
        if (!message.guild || !message.member) return message.reply("❌ This command can only be used in a server.");
        const botDisplayName = message.guild.members.me?.displayName || client.user?.username || 'Lydia';
        const prefix = process.env.PREFIX || '.';
        const sub = args[0]?.toLowerCase();

        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply({ embeds: [new EmbedBuilder().setColor('#ff4444').setTitle('⛔ ACCESS DENIED').setDescription('Administrator clearance required.').setTimestamp()] });
        }

        try {
            database.prepare(`CREATE TABLE IF NOT EXISTS lydia_agents (channel_id TEXT PRIMARY KEY, agent_key TEXT, is_active INTEGER DEFAULT 0, updated_at INTEGER)`).run();
        } catch(e) { return message.reply("❌ Database error."); }

        const channelId = message.channel.id;
        if (!client.lydiaChannels) client.lydiaChannels = {};
        if (!client.lydiaAgents) client.lydiaAgents = {};

        const saveAgent = (ch, agent) => {
            try {
                database.prepare(`INSERT OR REPLACE INTO lydia_agents (channel_id, agent_key, is_active, updated_at) VALUES (?, ?, ?, strftime('%s', 'now'))`).run(ch, agent, client.lydiaChannels[ch] ? 1 : 0);
            } catch(e) {}
        };

        // --- STATUS ---
        if (!sub || (sub !== 'on' && sub !== 'off' && sub !== 'agent')) {
            const isEnabled = client.lydiaChannels[channelId];
            const currentAgent = client.lydiaAgents[channelId] || 'default';
            const agentInfo = neuralCores[currentAgent] || neuralCores.default;
            let memCount = 0, userMem = 0;
            try {
                memCount = database.prepare("SELECT COUNT(*) as c FROM lydia_memory").get()?.c || 0;
                userMem = database.prepare("SELECT COUNT(*) as c FROM lydia_memory WHERE user_id = ?").get(message.author.id)?.c || 0;
            } catch(e) {}
            
            const totalModules = getGlobalModuleCount();
            
            const embed = new EmbedBuilder()
                .setColor(isEnabled ? agentInfo.color : '#95a5a6')
                .setAuthor({ name: `${agentInfo.emoji} ${botDisplayName.toUpperCase()} NEURAL INTERFACE`, iconURL: client.user.displayAvatarURL() })
                .setDescription(
                    `**System Status:** ${isEnabled ? '🟢 ACTIVE' : '🔴 STANDBY'}\n` +
                    `**Active Core:** ${agentInfo.name}\n` +
                    `**Identity:** ${botDisplayName}\n` +
                    `**Memory:** ${userMem} facts about you | ${memCount} total\n` +
                    `**Modules:** ${totalModules} plugins detected\n\n` +
                    `**Commands:**\n└ \`${prefix}lydia on\` - Activate AI\n└ \`${prefix}lydia off\` - Deactivate\n└ \`${prefix}lydia agent <core>\` - Switch core\n\n` +
                    `**Available Cores:**\n└ \`architect\` ${neuralCores.architect.emoji} - Code & System\n└ \`tactical\` ${neuralCores.tactical.emoji} - Gaming\n└ \`creative\` ${neuralCores.creative.emoji} - Creative\n└ \`default\` ${neuralCores.default.emoji} - Balanced`
                )
                .addFields(
                    { name: '📡 API Status', value: `OpenRouter: ${process.env.OPENROUTER_API_KEY ? '✅' : '❌'} | Brave: ${process.env.BRAVE_API_KEY ? '✅' : '❌'}`, inline: true },
                    { name: '🧠 AI Models', value: `DeepSeek • Claude • Gemini Flash`, inline: true },
                    { name: '👁️ Vision', value: `Image analysis enabled (Gemini Flash)`, inline: true },
                    { name: '🔍 Neural Search', value: 'Brave Search API', inline: true }
                )
                .setFooter({ text: `ARCHITECT CG-223 • v${client.version || '1.3.2'} • Mention @${botDisplayName}` })
                .setTimestamp();
            return message.reply({ embeds: [embed] });
        }

        // --- SWITCH AGENT ---
        if (sub === 'agent') {
            const agentType = args[1]?.toLowerCase();
            if (!agentType || !neuralCores[agentType]) {
                return message.reply(`⚠️ Invalid core. Available: ${Object.keys(neuralCores).map(c=>`\`${c}\``).join(', ')}`);
            }
            client.lydiaAgents[channelId] = agentType;
            saveAgent(channelId, agentType);
            const info = neuralCores[agentType];
            const embed = new EmbedBuilder()
                .setColor(info.color)
                .setTitle(`${info.emoji} NEURAL CORE SWITCHED`)
                .setDescription(`**${info.name}** is now active in <#${channelId}>`)
                .addFields({ name: '📝 Function', value: info.description }, { name: '💾 Persistence', value: 'Saved across restarts' })
                .setFooter({ text: `v${client.version || '1.3.2'}` })
                .setTimestamp();
            return message.reply({ embeds: [embed] });
        }

        // --- ACTIVATE ---
        if (sub === 'on') {
            if (client.lydiaChannels[channelId]) return message.reply(`⚠️ **${botDisplayName} is already active** here.`);
            if (!client.lydiaAgents[channelId]) {
                try {
                    const saved = database.prepare("SELECT agent_key FROM lydia_agents WHERE channel_id = ?").get(channelId);
                    client.lydiaAgents[channelId] = (saved && neuralCores[saved.agent_key]) ? saved.agent_key : 'default';
                } catch(e) { client.lydiaAgents[channelId] = 'default'; }
            }
            client.lydiaChannels[channelId] = true;
            saveAgent(channelId, client.lydiaAgents[channelId]);
            const info = neuralCores[client.lydiaAgents[channelId]] || neuralCores.default;
            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('✅ NEURAL CORE INITIALIZED')
                .setDescription(`**${botDisplayName} is now ONLINE** in <#${channelId}>`)
                .addFields(
                    { name: '🎯 Active Core', value: info.name, inline: true },
                    { name: '🆔 Identity', value: botDisplayName, inline: true },
                    { name: '🧠 AI Models', value: 'DeepSeek • Claude • Gemini Flash', inline: true },
                    { name: '👁️ Vision', value: 'Image analysis enabled', inline: true },
                    { name: '⏰ Reminders', value: 'Use `[REMIND: 10m | message]`', inline: true },
                    { name: '🎮 How to Use', value: `Mention **@${botDisplayName}** or use \`.list\``, inline: false },
                    { name: '🔄 Switch Core', value: `\`${prefix}lydia agent <core>\``, inline: true },
                    { name: '🔒 Deactivate', value: `\`${prefix}lydia off\``, inline: true }
                )
                .setFooter({ text: `POWERED BY OPENROUTER PRO • v${client.version || '1.3.2'}` })
                .setTimestamp();
            return message.reply({ embeds: [embed] });
        }

        // --- DEACTIVATE ---
        if (sub === 'off') {
            if (!client.lydiaChannels[channelId]) return message.reply(`⚠️ **${botDisplayName} is not active** here.`);
            delete client.lydiaChannels[channelId];
            if (client.lydiaAgents[channelId]) {
                try { database.prepare(`UPDATE lydia_agents SET is_active = 0, updated_at = strftime('%s', 'now') WHERE channel_id = ?`).run(channelId); } catch(e) {}
            }
            const embed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('❌ NEURAL CORE TERMINATED')
                .setDescription(`**${botDisplayName} has been deactivated** in <#${channelId}>.`)
                .addFields({ name: '🔄 Reactivate', value: `\`${prefix}lydia on\`` }, { name: '🧠 Memory Preserved', value: 'Agent preference saved' })
                .setFooter({ text: `v${client.version || '1.3.2'}` })
                .setTimestamp();
            return message.reply({ embeds: [embed] });
        }
    },
    // ========== CRITICAL: EXPORT ALL FUNCTIONS NEEDED BY index.js ==========
    setupLydia,
    buildPluginAwarenessPrompt,
    getGlobalModuleCount,
    getPluginRegistry,
    generateAIResponse,
    webSearch,
    parseAndStoreMemory,
    parseAndScheduleReminder
};