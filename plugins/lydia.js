// plugins/lydia.js
const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'lydia',
    aliases: ['ai', 'aimode', 'neural'],
    description: '🎭 Multi-Agent AI with Neural Core Switching & Persistent Memory',
    category: 'SYSTEM',
    cooldown: 5000,
    
    run: async (client, message, args, database) => {
        // Create agents table for persistent preferences (MUST match index.js structure)
        database.prepare(`
            CREATE TABLE IF NOT EXISTS lydia_agents (
                channel_id TEXT PRIMARY KEY,
                agent_key TEXT,
                is_active INTEGER DEFAULT 0,
                updated_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `).run();

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
        const agentType = args[1]?.toLowerCase();

        // Initialize trackers if needed
        if (!client.lydiaChannels) client.lydiaChannels = {};
        if (!client.lydiaAgents) client.lydiaAgents = {};

        // Available Neural Cores (Must match index.js)
        const neuralCores = {
            architect: {
                name: '🏗️ ARCHITECT CORE',
                emoji: '🔧',
                description: 'Code, servers, and system architecture expert',
                color: '#00fbff'
            },
            tactical: {
                name: '🎮 TACTICAL CORE',
                emoji: '⚔️',
                description: 'Gaming stats, strategies, and tournament insights',
                color: '#57F287'
            },
            creative: {
                name: '🎨 CREATIVE CORE',
                emoji: '✨',
                description: 'Content creation, scripts, and artistic direction',
                color: '#9B59B6'
            },
            default: {
                name: '🧠 LYDIA CORE',
                emoji: '🤖',
                description: 'Balanced assistant for general queries',
                color: '#5865F2'
            }
        };

        // Helper: Save agent to database with is_active status
        const saveAgentToDB = (channelId, agentKey) => {
            database.prepare(`
                INSERT OR REPLACE INTO lydia_agents (channel_id, agent_key, is_active, updated_at)
                VALUES (?, ?, ?, strftime('%s', 'now'))
            `).run(channelId, agentKey, client.lydiaChannels[channelId] ? 1 : 0);
        };

        // --- STATUS COMMAND ---
        if (!subCommand || (subCommand !== 'on' && subCommand !== 'off' && subCommand !== 'agent')) {
            const isEnabled = client.lydiaChannels[channelId];
            const currentAgent = client.lydiaAgents[channelId] || 'default';
            const agentInfo = neuralCores[currentAgent] || neuralCores.default;
            
            // Get memory stats
            const memoryCount = database.prepare("SELECT COUNT(*) as count FROM lydia_memory").get().count;
            const userMemoryCount = database.prepare("SELECT COUNT(*) as count FROM lydia_memory WHERE user_id = ?").get(message.author.id)?.count || 0;
            
            const statusEmbed = new EmbedBuilder()
                .setColor(isEnabled ? agentInfo.color : '#95a5a6')
                .setAuthor({ 
                    name: `${agentInfo.emoji} LYDIA NEURAL INTERFACE`, 
                    iconURL: client.user.displayAvatarURL() 
                })
                .setDescription(
                    `**System Status:** ${isEnabled ? '🟢 **ACTIVE**' : '🔴 **STANDBY**'}\n` +
                    `**Active Core:** ${agentInfo.name}\n` +
                    `**Memory:** ${userMemoryCount} facts about you | ${memoryCount} total\n\n` +
                    `**Commands:**\n` +
                    `└ \`${prefix}lydia on\` - Activate AI in this channel\n` +
                    `└ \`${prefix}lydia off\` - Deactivate AI\n` +
                    `└ \`${prefix}lydia agent <core>\` - Switch neural core\n\n` +
                    `**Available Neural Cores:**\n` +
                    `└ \`architect\` ${neuralCores.architect.emoji} - System & Code Expert\n` +
                    `└ \`tactical\` ${neuralCores.tactical.emoji} - Gaming Strategist\n` +
                    `└ \`creative\` ${neuralCores.creative.emoji} - Content Creator\n` +
                    `└ \`default\` ${neuralCores.default.emoji} - Balanced Assistant`
                )
                .addFields(
                    { 
                        name: '📡 API Status', 
                        value: `Groq: ${process.env.GROQ_API_KEY ? '✅' : '❌'} | Brave: ${process.env.BRAVE_API_KEY ? '✅' : '❌'}`,
                        inline: true 
                    },
                    {
                        name: '🧠 Persistent Memory',
                        value: `Cross-session recall • Auto-learning • Personalization`,
                        inline: true
                    }
                )
                .setFooter({ text: `ARCHITECT CG-223 • v${client.version} • Mention @Lydia to interact` })
                .setTimestamp();

            return message.reply({ embeds: [statusEmbed] });
        }

        // --- SWITCH NEURAL CORE ---
        if (subCommand === 'agent') {
            if (!agentType || !neuralCores[agentType]) {
                const availableCores = Object.keys(neuralCores).map(c => `\`${c}\``).join(', ');
                return message.reply(`⚠️ **Invalid neural core.**\nAvailable: ${availableCores}\nExample: \`${prefix}lydia agent tactical\``);
            }

            // Update memory
            client.lydiaAgents[channelId] = agentType;
            
            // Save to database with current active status
            saveAgentToDB(channelId, agentType);
            
            const agentInfo = neuralCores[agentType];
            
            const agentEmbed = new EmbedBuilder()
                .setColor(agentInfo.color)
                .setTitle(`${agentInfo.emoji} NEURAL CORE SWITCHED`)
                .setDescription(`**${agentInfo.name}** is now active in <#${channelId}>`)
                .addFields(
                    { name: '📝 Core Function', value: agentInfo.description, inline: false },
                    { name: '💾 Persistence', value: 'Agent preference saved • Survives bot restarts', inline: true },
                    { name: '💡 Tip', value: `Mention @Lydia with your ${agentType}-related questions!`, inline: true }
                )
                .setFooter({ text: `ARCHITECT CG-223 • v${client.version}` })
                .setTimestamp();

            return message.reply({ embeds: [agentEmbed] });
        }

        // --- ACTIVATE LYDIA ---
        if (subCommand === 'on') {
            if (client.lydiaChannels[channelId]) {
                return message.reply("⚠️ **Lydia is already active** in this channel.");
            }

            // Load saved agent preference if exists
            if (!client.lydiaAgents[channelId]) {
                const savedAgent = database.prepare("SELECT agent_key FROM lydia_agents WHERE channel_id = ?").get(channelId);
                if (savedAgent && neuralCores[savedAgent.agent_key]) {
                    client.lydiaAgents[channelId] = savedAgent.agent_key;
                } else {
                    client.lydiaAgents[channelId] = 'default';
                }
            }

            // Warn about missing APIs
            let warning = '';
            if (!process.env.GROQ_API_KEY) warning += '\n⚠️ **Groq API missing** - AI responses limited';
            if (!process.env.BRAVE_API_KEY) warning += '\n⚠️ **Brave API missing** - Web search unavailable';

            client.lydiaChannels[channelId] = true;
            
            // Update database with active status
            saveAgentToDB(channelId, client.lydiaAgents[channelId]);
            
            const currentAgent = neuralCores[client.lydiaAgents[channelId]] || neuralCores.default;
            
            const onEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('✅ NEURAL CORE INITIALIZED')
                .setDescription(`**Lydia is now ONLINE** in <#${channelId}>${warning}`)
                .addFields(
                    { name: '🎯 Active Core', value: currentAgent.name, inline: true },
                    { name: '🧠 Memory', value: 'Persistent recall enabled', inline: true },
                    { name: '🎮 How to Use', value: `Mention **@Lydia** or reply to her messages`, inline: false },
                    { name: '🔄 Switch Core', value: `\`${prefix}lydia agent <core>\``, inline: true },
                    { name: '🔒 Deactivate', value: `\`${prefix}lydia off\``, inline: true }
                )
                .setFooter({ text: `POWERED BY GROQ + BRAVE SEARCH • v${client.version}` })
                .setTimestamp();

            return message.reply({ embeds: [onEmbed] });
        }

        // --- DEACTIVATE LYDIA ---
        if (subCommand === 'off') {
            if (!client.lydiaChannels[channelId]) {
                return message.reply("⚠️ **Lydia is not active** in this channel.");
            }

            delete client.lydiaChannels[channelId];
            
            // Update database with inactive status (preserve agent preference)
            if (client.lydiaAgents[channelId]) {
                database.prepare(`
                    UPDATE lydia_agents SET is_active = 0, updated_at = strftime('%s', 'now')
                    WHERE channel_id = ?
                `).run(channelId);
            }
            
            const offEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('❌ NEURAL CORE TERMINATED')
                .setDescription(`**Lydia has been deactivated** in <#${channelId}>.`)
                .addFields(
                    { name: '🔄 Reactivate', value: `\`${prefix}lydia on\` to restart`, inline: true },
                    { name: '🧠 Memory Preserved', value: 'Agent preference saved for next activation', inline: true }
                )
                .setFooter({ text: `ARCHITECT CG-223 • v${client.version}` })
                .setTimestamp();

            return message.reply({ embeds: [offEmbed] });
        }
    }
};