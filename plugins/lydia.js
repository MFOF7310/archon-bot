// plugins/lydia.js
const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'lydia',
    aliases: ['ai', 'aimode', 'neural'],
    description: 'Toggle Lydia AI with persistent memory and multi-agent intelligence.',
    category: 'SYSTEM',
    cooldown: 5000,
    
    run: async (client, message, args, database) => {
        // Create memory table for persistent AI context
        database.prepare(`
            CREATE TABLE IF NOT EXISTS lydia_memory (
                user_id TEXT,
                memory_key TEXT,
                memory_value TEXT,
                updated_at INTEGER DEFAULT (strftime('%s', 'now')),
                PRIMARY KEY (user_id, memory_key)
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

        // Initialize tracker if needed
        if (!client.lydiaChannels) client.lydiaChannels = {};
        if (!client.lydiaAgents) client.lydiaAgents = {};

        // Available Neural Cores (Multi-Agent Personalities)
        const neuralCores = {
            architect: {
                name: '🏗️ ARCHITECT CORE',
                description: 'Code, servers, and system architecture expert',
                systemPrompt: 'You are ARCHITECT Lydia, a technical AI specializing in coding, Discord bot architecture, database management, and system optimization. Provide detailed technical solutions with code examples when relevant.'
            },
            tactical: {
                name: '🎮 TACTICAL CORE',
                description: 'Gaming stats, strategies, and tournament insights',
                systemPrompt: 'You are TACTICAL Lydia, a gaming AI focused on CODM, esports strategies, loadout optimization, and tournament coordination. Keep responses energetic and game-focused.'
            },
            creative: {
                name: '🎨 CREATIVE CORE',
                description: 'Content creation, scripts, and artistic direction',
                systemPrompt: 'You are CREATIVE Lydia, an imaginative AI for content creation, storytelling, script writing, and artistic inspiration. Provide vivid, creative responses with examples.'
            },
            default: {
                name: '🧠 LYDIA CORE',
                description: 'Balanced assistant for general queries',
                systemPrompt: 'You are Lydia, the AI assistant of Cloud Gaming-223 Discord server. You\'re polite, smart, and direct with a touch of Malian 🇲🇱 flair. Keep answers concise but informative.'
            }
        };

        // --- SIMPLE USAGE / STATUS ---
        if (!subCommand || (subCommand !== 'on' && subCommand !== 'off' && subCommand !== 'memory' && subCommand !== 'agent')) {
            const isEnabled = client.lydiaChannels[channelId];
            const currentAgent = client.lydiaAgents[channelId] || 'default';
            const agentInfo = neuralCores[currentAgent] || neuralCores.default;
            
            const statusEmbed = new EmbedBuilder()
                .setColor(isEnabled ? '#00fbff' : '#95a5a6')
                .setAuthor({ 
                    name: '🤖 LYDIA NEURAL INTERFACE', 
                    iconURL: client.user.displayAvatarURL() 
                })
                .setDescription(
                    `**Status:** ${isEnabled ? '🟢 **ACTIVE**' : '🔴 **STANDBY**'}\n` +
                    `**Active Core:** ${agentInfo.name}\n\n` +
                    `**Commands:**\n` +
                    `\`${prefix}lydia on\` - Activate AI\n` +
                    `\`${prefix}lydia off\` - Deactivate AI\n` +
                    `\`${prefix}lydia agent <core>\` - Switch neural core\n` +
                    `\`${prefix}lydia memory\` - View user memory stats\n\n` +
                    `**Neural Cores Available:**\n` +
                    `• \`architect\` - System & Code Expert\n` +
                    `• \`tactical\` - Gaming Strategist\n` +
                    `• \`creative\` - Content Creator\n` +
                    `• \`default\` - Balanced Assistant`
                )
                .addFields(
                    { 
                        name: '📡 API Status', 
                        value: `Groq: ${process.env.GROQ_API_KEY ? '✅' : '❌'} | Brave: ${process.env.BRAVE_API_KEY ? '✅' : '❌'}`,
                        inline: true 
                    },
                    {
                        name: '🧠 Persistent Memory',
                        value: `User preferences saved • Cross-session recall • Adaptive learning`,
                        inline: true
                    }
                )
                .setFooter({ text: 'Mention or reply to interact • Memory persists across conversations' })
                .setTimestamp();

            return message.reply({ embeds: [statusEmbed] });
        }

        // --- SWITCH NEURAL CORE (Multi-Agent) ---
        if (subCommand === 'agent') {
            if (!agentType || !neuralCores[agentType]) {
                const availableCores = Object.keys(neuralCores).map(c => `\`${c}\``).join(', ');
                return message.reply(`⚠️ **Invalid neural core.** Available: ${availableCores}\nExample: \`${prefix}lydia agent tactical\``);
            }

            client.lydiaAgents[channelId] = agentType;
            const agentInfo = neuralCores[agentType];
            
            const agentEmbed = new EmbedBuilder()
                .setColor('#9B59B6')
                .setTitle('🔄 NEURAL CORE SWITCHED')
                .setDescription(`**${agentInfo.name}** is now active in <#${channelId}>`)
                .addFields(
                    { name: '📝 Description', value: agentInfo.description, inline: false },
                    { name: '💡 Tip', value: `Mention @Lydia with your ${agentType}-related questions!`, inline: true }
                )
                .setFooter({ text: `ARCHITECT CG-223 • ${agentInfo.name} Online` })
                .setTimestamp();

            return message.reply({ embeds: [agentEmbed] });
        }

        // --- VIEW MEMORY STATS ---
        if (subCommand === 'memory') {
            const memoryCount = database.prepare("SELECT COUNT(*) as count FROM lydia_memory").get().count;
            const userMemoryCount = database.prepare("SELECT COUNT(*) as count FROM lydia_memory WHERE user_id = ?").get(message.author.id)?.count || 0;
            
            const memoryEmbed = new EmbedBuilder()
                .setColor('#3498DB')
                .setTitle('🧠 PERSISTENT MEMORY STATISTICS')
                .setDescription(`Lydia remembers user preferences across conversations!`)
                .addFields(
                    { name: '📊 Global Memory', value: `\`${memoryCount}\` stored facts`, inline: true },
                    { name: '👤 Your Memory', value: `\`${userMemoryCount}\$ stored about you`, inline: true },
                    { name: '💾 Retention', value: `Permanent • Cross-session • Always learning`, inline: true }
                )
                .setFooter({ text: 'Memories are created when you share preferences or repeat topics' })
                .setTimestamp();
            
            return message.reply({ embeds: [memoryEmbed] });
        }

        // --- ACTIVATE LYDIA ---
        if (subCommand === 'on') {
            if (client.lydiaChannels[channelId]) {
                return message.reply("⚠️ **Lydia is already active** in this channel.");
            }

            // Set default agent if none selected
            if (!client.lydiaAgents[channelId]) {
                client.lydiaAgents[channelId] = 'default';
            }

            // Warn about missing APIs but still allow activation
            let warning = '';
            if (!process.env.GROQ_API_KEY) warning += '\n⚠️ **Groq API missing** - AI responses limited';
            if (!process.env.BRAVE_API_KEY) warning += '\n⚠️ **Brave API missing** - Web search unavailable';

            client.lydiaChannels[channelId] = true;
            const currentAgent = neuralCores[client.lydiaAgents[channelId]] || neuralCores.default;
            
            const onEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('✅ NEURAL CORE INITIALIZED')
                .setDescription(`**Lydia is now ONLINE** in <#${channelId}>${warning}`)
                .addFields(
                    { name: '🎯 Active Core', value: currentAgent.name, inline: true },
                    { name: '💾 Memory', value: 'Persistent recall enabled', inline: true },
                    { name: '🎮 How to Use', value: `Mention **@Lydia** or reply to her messages`, inline: false },
                    { name: '🔄 Switch Core', value: `\`${prefix}lydia agent <core>\``, inline: true },
                    { name: '🔒 Deactivate', value: `\`${prefix}lydia off\``, inline: true }
                )
                .setFooter({ text: 'POWERED BY GROQ + BRAVE SEARCH + PERSISTENT MEMORY' })
                .setTimestamp();

            return message.reply({ embeds: [onEmbed] });
        }

        // --- DEACTIVATE LYDIA ---
        if (subCommand === 'off') {
            if (!client.lydiaChannels[channelId]) {
                return message.reply("⚠️ **Lydia is not active** in this channel.");
            }

            delete client.lydiaChannels[channelId];
            // Keep agent preference for next activation
            
            const offEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('❌ NEURAL CORE TERMINATED')
                .setDescription(`**Lydia has been deactivated** in <#${channelId}>.`)
                .addFields(
                    { name: '🔄 Reactivate', value: `\`${prefix}lydia on\` to restart`, inline: true },
                    { name: '🧠 Memory Saved', value: 'All memories preserved for next session', inline: true }
                )
                .setFooter({ text: 'ARCHITECT CG-223 • Persistent Memory Active' })
                .setTimestamp();

            return message.reply({ embeds: [offEmbed] });
        }
    }
};