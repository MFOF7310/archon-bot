// plugins/dashboard.js
const os = require('os');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'dashboard',
    aliases: ['db', 'dash', 'sysinfo', 'engine'], // More unique aliases to avoid conflicts
    description: '🎮 Advanced system dashboard with real-time metrics and command categories.',
    category: 'SYSTEM',
    cooldown: 5000,

    run: async (client, message, args, database) => {
        try {
            const startTime = Date.now();
            
            // ========== SYSTEM METRICS ==========
            const uptimeVal = process.uptime();
            const days = Math.floor(uptimeVal / 86400);
            const hours = Math.floor((uptimeVal % 86400) / 3600);
            const minutes = Math.floor((uptimeVal % 3600) / 60);
            const seconds = Math.floor(uptimeVal % 60);
            
            // Memory Calculations
            const usedRAM = Math.round(process.memoryUsage().rss / 1024 / 1024);
            const totalRAM = Math.round(os.totalmem() / 1024 / 1024);
            const ramPercentage = ((usedRAM / totalRAM) * 100).toFixed(1);
            
            // CPU Info
            const cpuCores = os.cpus().length;
            const cpuModel = os.cpus()[0].model.split('@')[0].trim();
            const cpuSpeed = (os.cpus()[0].speed / 1000).toFixed(1);
            const loadAvg = os.loadavg().map(avg => avg.toFixed(2)).join(', ');
            
            // Dynamic Version
            const botVersion = client.version || '1.1.0';
            
            // Platform Detection
            const platform = `${os.type()} ${os.arch()}`;
            const hostname = os.hostname();
            
            // Time & Date
            const now = new Date();
            const time = now.toLocaleTimeString('en-GB', { 
                timeZone: 'Africa/Bamako', 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
            });
            const date = now.toLocaleDateString('en-GB', { 
                timeZone: 'Africa/Bamako',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            
            // Database Stats
            const dbUserCount = database.prepare("SELECT COUNT(*) as count FROM users").get().count;
            
            // Get total XP and levels from database
            const totalXP = database.prepare("SELECT SUM(xp) as total FROM users").get().total || 0;
            const avgLevel = database.prepare("SELECT AVG(level) as avg FROM users").get().avg || 0;
            
            // Discord Stats
            const serverCount = client.guilds.cache.size;
            const userCount = client.users.cache.size;
            const channelCount = client.channels.cache.size;
            const emojiCount = client.emojis.cache.size;
            
            // Command stats
            const totalCommands = client.commands.size;
            
            // Command Categories
            const categories = {};
            client.commands.forEach(cmd => {
                const cat = cmd.category ? cmd.category.toUpperCase() : 'GENERAL';
                if (!categories[cat]) categories[cat] = [];
                categories[cat].push(cmd.name.toLowerCase());
            });
            
            // Performance Metrics
            const apiLatency = Math.round(client.ws.ping);
            const responseTime = Date.now() - startTime;
            
            // Create RAM Bar
            const ramBarLength = 20;
            const filledRAM = Math.floor((ramPercentage / 100) * ramBarLength);
            const ramBar = '█'.repeat(filledRAM) + '░'.repeat(ramBarLength - filledRAM);
            
            // Create Uptime Bar (based on 30 days max)
            const maxUptimeDays = 30;
            const uptimeDays = uptimeVal / 86400;
            const uptimePercentage = Math.min((uptimeDays / maxUptimeDays) * 100, 100);
            const filledUptime = Math.floor((uptimePercentage / 100) * ramBarLength);
            const uptimeBar = '█'.repeat(filledUptime) + '░'.repeat(ramBarLength - filledUptime);
            
            // ========== IMPROVED POWER LEVEL CALCULATION ==========
            // More meaningful calculation based on actual achievements
            const commandPower = totalCommands * 20;        // 34 * 20 = 680
            const serverPower = serverCount * 150;          // Servers影响力
            const userPower = Math.min(Math.floor(dbUserCount * 2), 1000); // Max 1000 from users
            const xpPower = Math.min(Math.floor(totalXP / 10000), 500);     // Max 500 from XP
            const uptimePower = Math.min(Math.floor(uptimeDays * 15), 300); // Max 300 from uptime
            
            let powerLevel = commandPower + serverPower + userPower + xpPower + uptimePower;
            
            // Cap at 9999 and add rank titles
            powerLevel = Math.min(powerLevel, 9999);
            let powerRank = '';
            if (powerLevel >= 5000) powerRank = '💎 LEGENDARY';
            else if (powerLevel >= 2500) powerRank = '⚡ ELITE';
            else if (powerLevel >= 1000) powerRank = '🌟 ADVANCED';
            else if (powerLevel >= 500) powerRank = '🛡️ SKILLED';
            else if (powerLevel >= 100) powerRank = '🌱 EMERGING';
            else powerRank = '🔰 NOVICE';
            
            // Calculate next level threshold
            const nextLevelThreshold = powerLevel < 1000 ? 1000 : 
                                      powerLevel < 2500 ? 2500 : 
                                      powerLevel < 5000 ? 5000 : 9999;
            const progressToNext = Math.floor((powerLevel / nextLevelThreshold) * 100);
            const powerBar = '█'.repeat(Math.floor(progressToNext / 5)) + '░'.repeat(20 - Math.floor(progressToNext / 5));
            
            // ========== MAIN EMBED ==========
            const dashboardEmbed = new EmbedBuilder()
                .setColor('#00d9ff')
                .setAuthor({ 
                    name: '🦅 ARCHITECT CG-223 // ADVANCED DASHBOARD', 
                    iconURL: client.user.displayAvatarURL(),
                    url: 'https://github.com/MFOF7310/cloud-gaming-223-digital-engine'
                })
                .setTitle('⚡ SYSTEM INTELLIGENCE REPORT')
                .setThumbnail(message.guild?.iconURL() || client.user.displayAvatarURL())
                .setDescription(`\`\`\`diff\n+ SYSTEM STATUS: OPERATIONAL\n+ NODE LOCATION: BAMAKO-223 🇲🇱\n+ ARCHITECT VERSION: v${botVersion}\`\`\``)
                .addFields(
                    {
                        name: '📡 BOT TELEMETRY',
                        value: `\`\`\`yaml\nVersion: v${botVersion}\nUptime: ${days}d ${hours}h ${minutes}m ${seconds}s\n${uptimeBar} ${uptimePercentage.toFixed(1)}%\nAPI Latency: ${apiLatency}ms\nResponse: ${responseTime}ms\`\`\``,
                        inline: true
                    },
                    {
                        name: '💻 SYSTEM RESOURCES',
                        value: `\`\`\`prolog\nPlatform: ${platform}\nHost: ${hostname}\nCPU: ${cpuModel}\nCores: ${cpuCores} @ ${cpuSpeed}GHz\nLoad Avg: ${loadAvg}\nRAM: ${ramBar} ${ramPercentage}%\nMemory: ${usedRAM}/${totalRAM} MB\`\`\``,
                        inline: true
                    },
                    {
                        name: '🎮 DISCORD STATISTICS',
                        value: `\`\`\`fix\nServers: ${serverCount}\nUsers: ${userCount.toLocaleString()}\nChannels: ${channelCount}\nEmojis: ${emojiCount}\nCommands: ${totalCommands}\`\`\``,
                        inline: true
                    }
                )
                .addFields(
                    {
                        name: '🗄️ DATABASE ANALYTICS',
                        value: `\`\`\`json\n{\n  "users": ${dbUserCount},\n  "total_xp": ${totalXP.toLocaleString()},\n  "avg_level": ${avgLevel.toFixed(1)}\n}\`\`\``,
                        inline: true
                    },
                    {
                        name: '🌍 TIME & LOCATION',
                        value: `\`\`\`\nDate: ${date}\nTime: ${time} (GMT)\nTimezone: Africa/Bamako\nRegion: West Africa\`\`\``,
                        inline: true
                    },
                    {
                        name: '⚙️ PERFORMANCE METRICS',
                        value: `\`\`\`asciidoc\n=== System Health ===\nCPU Load: ${loadAvg.split(',')[0]}%\nRAM Usage: ${ramPercentage}%\nStatus: Stable\nHeat: Normal\`\`\``,
                        inline: true
                    }
                );

            // ========== COMMAND CATEGORIES SECTION ==========
            const sortedCats = Object.keys(categories).sort();
            let categoryFields = [];
            let currentField = { name: '📚 COMMAND LIBRARY', value: '', inline: false };
            
            for (const cat of sortedCats) {
                const cmdCount = categories[cat].length;
                const cmdList = categories[cat]
                    .sort()
                    .map(cmd => `\`${cmd}\``)
                    .join(' • ');
                
                const categoryValue = `**${cat}** \`[${cmdCount}]\`\n${cmdList}\n\n`;
                
                if ((currentField.value + categoryValue).length > 1024) {
                    categoryFields.push(currentField);
                    currentField = { name: '📚 COMMAND LIBRARY (Continued)', value: categoryValue, inline: false };
                } else {
                    currentField.value += categoryValue;
                }
            }
            
            if (currentField.value) categoryFields.push(currentField);
            
            // Add command fields to embed
            categoryFields.forEach(field => {
                dashboardEmbed.addFields(field);
            });
            
            // ========== SURPRISE FEATURES ==========
            
            // Surprise 1: Random Gaming Tip
            const gamingTips = [
                "🎮 Pro Tip: Use `.rank` to check your gaming rank!",
                "⚡ Did you know? You can mention @Lydia for AI assistance!",
                "🏆 Type `.leaderboard` to see top gamers!",
                "🎯 `.daily` gives you bonus XP every day!",
                "💎 Level 100 unlocks the Gaming God role!",
                "🤖 Lydia can search the web - just ask real-time questions!",
                "📊 Your gaming stats are tracked automatically!",
                "🎲 Try `.coinflip` or `.dice` for fun games!"
            ];
            const randomTip = gamingTips[Math.floor(Math.random() * gamingTips.length)];
            
            // Surprise 2: Bot Status with dynamic emoji
            const statusEmojis = {
                online: '🟢',
                idle: '🟡',
                dnd: '🔴',
                offline: '⚫'
            };
            const botStatus = statusEmojis[client.presence?.status] || '🟢';
            
            dashboardEmbed.addFields({
                name: '🎯 SYSTEM STATUS & POWER RANK',
                value: `\`\`\`\n${randomTip}\n\nBot Status: ${botStatus} ${client.presence?.status?.toUpperCase() || 'ONLINE'}\nPower Level: ${powerLevel}/9999 [${powerRank}]\nProgress: ${powerBar} ${progressToNext}%\nEngine: OPTIMIZED\`\`\``,
                inline: false
            });
            
            // Footer with dynamic info
            dashboardEmbed.setFooter({ 
                text: `ARCHITECT CG-223 | v${botVersion} | Requested by ${message.author.tag} | ${new Date().toLocaleTimeString()}`,
                iconURL: message.author.displayAvatarURL()
            });
            dashboardEmbed.setTimestamp();
            
            // Optional: Add a random colored border based on performance
            const performanceScore = (100 - ramPercentage) + (100 - (apiLatency / 10));
            if (performanceScore > 150) dashboardEmbed.setColor('#2ecc71'); // Green - Excellent
            else if (performanceScore > 100) dashboardEmbed.setColor('#f39c12'); // Orange - Good
            else dashboardEmbed.setColor('#e74c3c'); // Red - Needs attention
            
            // ========== SEND RESPONSE ==========
            await message.reply({ embeds: [dashboardEmbed] });
            
            // ========== LOG TO CONSOLE ==========
            console.log(`[DASHBOARD] Viewed by ${message.author.tag} | Version: v${botVersion} | Users: ${dbUserCount} | Commands: ${totalCommands}`);
            
        } catch (error) {
            console.error('Dashboard Error:', error);
            
            // Fallback error message
            const errorEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('⚠️ DASHBOARD ENGINE FAILURE')
                .setDescription('The dashboard encountered an error while loading.')
                .addFields(
                    { name: 'Error Details', value: `\`\`\`js\n${error.message}\`\`\``, inline: false },
                    { name: 'Action Required', value: 'Please report this to the system administrator.', inline: false }
                )
                .setTimestamp();
            
            await message.reply({ embeds: [errorEmbed] });
        }
    }
};