const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const os = require('os');

module.exports = {
    name: 'alive',
    aliases: ['status', 'uptime', 'ping', 'pulse', 'health', 'sysinfo'],
    description: 'Execute a deep-scan of system vitality, neural latency, and hardware integrity.',
    category: 'SYSTEM',
    run: async (client, message, args, userData) => {
        try {
            // Helper function to generate the embed (for refresh)
            const generateEmbed = () => {
                // --- TEMPORAL DATA (Uptime) ---
                const uptimeSec = process.uptime();
                const days = Math.floor(uptimeSec / 86400);
                const hours = Math.floor((uptimeSec % 86400) / 3600);
                const minutes = Math.floor((uptimeSec % 3600) / 60);
                const seconds = Math.floor(uptimeSec % 60);
                
                // Format uptime string
                const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`;
                const uptimeHours = (uptimeSec / 3600).toFixed(1);
                
                // --- NEURAL METRICS (Latency) ---
                const msgLatency = Date.now() - message.createdTimestamp;
                const apiPing = Math.round(client.ws.ping);
                
                // --- HARDWARE ALLOCATION ---
                const memoryUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
                const memoryTotal = (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2);
                const rssMemory = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
                const totalRam = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
                const freeRam = (os.freemem() / 1024 / 1024 / 1024).toFixed(1);
                const cpuCores = os.cpus().length;
                const cpuModel = os.cpus()[0]?.model?.split('(')[0].trim() || 'Unknown';
                const cpuLoad = os.loadavg()[0].toFixed(2);
                
                // --- SYSTEM METRICS ---
                const platform = os.platform();
                const arch = os.arch();
                const hostname = os.hostname();
                const nodeVersion = process.version;
                const botVersion = client.version || '1.1.0';
                
                // --- DYNAMIC INTEGRITY STATUS ---
                let statusEmoji, integrityColor, statusText, statusIcon;
                if (msgLatency < 100 && apiPing < 150) { 
                    statusEmoji = '🟢'; 
                    statusText = 'NOMINAL';
                    integrityColor = '#57F287';
                    statusIcon = '✅';
                } else if (msgLatency < 250 && apiPing < 300) { 
                    statusEmoji = '🟡'; 
                    statusText = 'STABLE';
                    integrityColor = '#FEE75C';
                    statusIcon = '⚠️';
                } else if (msgLatency < 500) { 
                    statusEmoji = '🟠'; 
                    statusText = 'DEGRADED';
                    integrityColor = '#EB459E';
                    statusIcon = '🔸';
                } else { 
                    statusEmoji = '🔴'; 
                    statusText = 'CRITICAL';
                    integrityColor = '#ED4245';
                    statusIcon = '💀';
                }
                
                // --- UPTIME STABILITY BAR (FIXED: 7 days target for better visual feedback) ---
                const maxTarget = 7; // 7 days target - most hosts reboot within 24-48h, so 7 days is realistic
                const progress = Math.min(100, Math.floor((uptimeSec / 86400) / maxTarget * 100));
                const createBar = (p) => {
                    const size = 15;
                    const filled = Math.round((size * p) / 100);
                    return '█'.repeat(filled) + '░'.repeat(size - filled);
                };
                
                // --- MEMORY USAGE BAR ---
                const memPercent = (memoryUsed / (totalRam * 1024) * 100).toFixed(1);
                const memBar = createBar(Math.min(100, parseFloat(memPercent)));
                
                // --- LATENCY QUALITY INDICATOR ---
                let latencyQuality = '';
                if (msgLatency < 50) latencyQuality = '⚡ EXCEPTIONAL';
                else if (msgLatency < 100) latencyQuality = '🌟 OPTIMAL';
                else if (msgLatency < 200) latencyQuality = '👍 GOOD';
                else if (msgLatency < 350) latencyQuality = '⚠️ ACCEPTABLE';
                else latencyQuality = '💀 POOR';
                
                // --- GET GUILD STATS ---
                let guildCount = client.guilds.cache.size;
                let memberCount = client.users.cache.size;
                let channelCount = client.channels.cache.size;
                
                // --- COMMAND STATS ---
                const totalCommands = client.commands.size;
                
                // --- CREATE THE MAIN EMBED ---
                const embed = new EmbedBuilder()
                    .setColor(integrityColor)
                    .setAuthor({ 
                        name: `⚙️ ARCHITECT CG-223 | SYSTEM VITALITY SCAN`, 
                        iconURL: client.user.displayAvatarURL({ dynamic: true, size: 1024 }) 
                    })
                    .setTitle(`${statusIcon} ENGINE STATUS: ${statusEmoji} ${statusText} ${statusIcon}`)
                    .setDescription(
                        `\`\`\`prolog\n` +
                        `┌─ NODE: BAMAKO-223\n` +
                        `├─ CORE: Groq LPU™ + Brave Search\n` +
                        `├─ VERSION: v${botVersion}\n` +
                        `└─ NODE.JS: ${nodeVersion}\`\`\``
                    )
                    .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 512 }))
                    .addFields(
                        { 
                            name: '📡 NEURAL LATENCY', 
                            value: `\`\`\`yaml\nResponse: ${msgLatency}ms (${latencyQuality})\nAPI Ping: ${apiPing}ms\nWS Heartbeat: ${client.ws.ping}ms\`\`\``, 
                            inline: true 
                        },
                        { 
                            name: '💾 MEMORY ALLOCATION', 
                            value: `\`\`\`yaml\nHeap: ${memoryUsed}MB / ${memoryTotal}MB\nRSS: ${rssMemory}MB\nTotal RAM: ${totalRam}GB (${freeRam}GB free)\n[${memBar}] ${memPercent}%\`\`\``, 
                            inline: true 
                        },
                        { 
                            name: '⚙️ HARDWARE SPECS', 
                            value: `\`\`\`yaml\nCPU: ${cpuModel}\nCores: ${cpuCores} | Load: ${cpuLoad}\nOS: ${platform} ${arch}\nHost: ${hostname}\`\`\``, 
                            inline: true 
                        }
                    )
                    .addFields(
                        { 
                            name: '⏳ SYSTEM UPTIME', 
                            value: `\`\`\`fix\n${uptimeStr}\n[${createBar(progress)}] ${progress}% stability\`\`\`\n**Target:** ${maxTarget} days • **Current:** ${uptimeHours}h`, 
                            inline: true 
                        },
                        { 
                            name: '📊 NETWORK TOPOLOGY', 
                            value: `\`\`\`yaml\nGuilds: ${guildCount}\nUsers: ${memberCount.toLocaleString()}\nChannels: ${channelCount}\nCommands: ${totalCommands}\`\`\``, 
                            inline: true 
                        },
                        { 
                            name: '🧬 AGENT PROFILE', 
                            value: `\`\`\`yaml\nID: ${message.author.id}\nLevel: ${userData?.level || 1}\nGames: ${userData?.games_played || 0}\nWins: ${userData?.games_won || 0}\`\`\``, 
                            inline: true 
                        }
                    )
                    .setFooter({ 
                        text: `EAGLE COMMUNITY • DIGITAL SOVEREIGNTY • BKO-223 • Last scan: ${new Date().toLocaleTimeString()}`, 
                        iconURL: client.user.displayAvatarURL() 
                    })
                    .setTimestamp();
                
                // Add warning if system is degraded
                if (msgLatency > 300 || apiPing > 400) {
                    embed.addFields({
                        name: '⚠️ SYSTEM WARNING',
                        value: `\`\`\`diff\n- Neural latency exceeds optimal thresholds\n- Recommend system maintenance\n- Check network connectivity\`\`\``,
                        inline: false
                    });
                }
                
                // Add celebration if uptime is impressive (now 3+ days since target is 7)
                if (days >= 3) {
                    embed.addFields({
                        name: '🏆 ACHIEVEMENT UNLOCKED',
                        value: `\`\`\`fix\n✨ STABILITY MILESTONE: ${days} DAYS UPTIME ✨\nThe system has maintained ${progress}% stability.\`\`\``,
                        inline: false
                    });
                }
                
                return embed;
            };
            
            // Create interactive buttons
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('refresh_status')
                        .setLabel('🔄 REFRESH')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('detailed_stats')
                        .setLabel('📊 DETAILS')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setURL('https://github.com/MFOF7310/cloud-gaming-223-digital-engine')
                        .setLabel('📦 REPOSITORY')
                        .setStyle(ButtonStyle.Link)
                );
            
            const reply = await message.reply({ 
                content: `> **🔍 Initiating deep-system diagnostic...**\n> *Neural pathways engaged, scanning core integrity...*`,
                embeds: [generateEmbed()],
                components: [row]
            });
            
            // Button collector for interactive features
            const collector = reply.createMessageComponentCollector({ time: 60000 });
            
            collector.on('collect', async (interaction) => {
                if (interaction.user.id !== message.author.id) {
                    return interaction.reply({ content: '⛔ Access denied. This diagnostic is locked to the requesting agent.', ephemeral: true });
                }
                
                if (interaction.customId === 'refresh_status') {
                    // FIXED: Just update the embed without recursive function calls
                    await interaction.update({ 
                        content: `> **🔄 Refreshing neural pathways...**\n> *System metrics recalibrated.*`,
                        embeds: [generateEmbed()],
                        components: [row]
                    });
                } else if (interaction.customId === 'detailed_stats') {
                    // Show detailed system information
                    const detailEmbed = new EmbedBuilder()
                        .setColor('#00fbff')
                        .setAuthor({ name: '📊 DETAILED SYSTEM TELEMETRY', iconURL: client.user.displayAvatarURL() })
                        .setTitle('═ DEEP DIAGNOSTIC REPORT ═')
                        .setDescription(`\`\`\`prolog\nTimestamp: ${new Date().toISOString()}\nScan ID: ${Date.now().toString(36)}\`\`\``)
                        .addFields(
                            { name: '💻 PROCESS INFO', value: `\`\`\`yaml\nPID: ${process.pid}\nPlatform: ${process.platform}\nArch: ${process.arch}\nNode: ${process.version}\nExec Path: ${process.execPath}\`\`\``, inline: true },
                            { name: '🔧 ENVIRONMENT', value: `\`\`\`yaml\nPREFIX: ${process.env.PREFIX || '.'}\nGROQ: ${process.env.GROQ_API_KEY ? '✅' : '❌'}\nBRAVE: ${process.env.BRAVE_API_KEY ? '✅' : '❌'}\nDB: SQLite (active)\`\`\``, inline: true },
                            { name: '🎮 DISCORD API', value: `\`\`\`yaml\nGateway: v${client.options.ws.version}\nIntents: ${client.options.intents.bitfield}\nShards: ${client.ws.shards.size}\`\`\``, inline: true }
                        )
                        .setFooter({ text: 'Detailed telemetry • For debugging purposes' })
                        .setTimestamp();
                    
                    await interaction.reply({ embeds: [detailEmbed], ephemeral: true });
                }
            });
            
        } catch (error) {
            console.error('ALIVE_SCAN_ERROR:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setAuthor({ name: '💀 SYSTEM CRITICAL ERROR', iconURL: client.user.displayAvatarURL() })
                .setTitle('❌ DIAGNOSTIC FAILURE')
                .setDescription(`\`\`\`diff\n- System vitality scan encountered a critical error\n- Error: ${error.message}\n- Please report to system administrator\`\`\``)
                .setTimestamp();
            
            message.reply({ embeds: [errorEmbed] });
        }
    }
};