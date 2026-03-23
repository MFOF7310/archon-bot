const { EmbedBuilder } = require('discord.js');
const os = require('os');

module.exports = {
    name: 'alive',
    aliases: ['status', 'uptime', 'ping', 'pulse'],
    description: 'Execute a deep-scan of system vitality and neural latency.',
    category: 'SYSTEM',
    run: async (client, message, args, database) => {
        try {
            // --- TEMPORAL DATA (Uptime) ---
            const uptimeSec = process.uptime();
            const days = Math.floor(uptimeSec / 86400);
            const hours = Math.floor((uptimeSec % 86400) / 3600);
            const minutes = Math.floor((uptimeSec % 3600) / 60);
            const seconds = Math.floor(uptimeSec % 60);
            
            // --- NEURAL METRICS (Latency) ---
            const msgLatency = Date.now() - message.createdTimestamp;
            const apiPing = Math.round(client.ws.ping);
            
            // --- HARDWARE ALLOCATION ---
            const memoryUsed = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
            const totalRam = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
            
            // --- DYNAMIC INTEGRITY STATUS ---
            let statusEmoji, integrityColor;
            if (msgLatency < 150) { 
                statusEmoji = '🟢 NOMINAL'; 
                integrityColor = '#00fbff'; // Architect Cyan
            } else if (msgLatency < 350) { 
                statusEmoji = '🟡 DEGRADED'; 
                integrityColor = '#f1c40f'; // Yellow
            } else { 
                statusEmoji = '🔴 CRITICAL'; 
                integrityColor = '#e74c3c'; // Red
            }
            
            // --- UPTIME STABILITY BAR ---
            const maxDays = 30; // Target for 100% stability
            const progress = Math.min(100, Math.floor((uptimeSec / 86400) / maxDays * 100));
            const createBar = (p) => {
                const size = 12;
                const filled = Math.round((size * p) / 100);
                return '▰'.repeat(filled) + '▱'.repeat(size - filled);
            };

            const aliveEmbed = new EmbedBuilder()
                .setColor(integrityColor)
                .setAuthor({ 
                    name: 'ARCHITECT CG-223 | SYSTEM VITALITY', 
                    iconURL: client.user.displayAvatarURL({ dynamic: true }) 
                })
                .setTitle(`◈ ENGINE STATUS: ${statusEmoji} ◈`)
                .setDescription(`**Node:** \`Bamako-223\`\n**Core:** \`Groq LPU™ + Brave Search\``)
                .addFields(
                    { 
                        name: '📡 NEURAL LATENCY', 
                        value: `\`\`\`ansi\n\u001b[1;32m▣\u001b[0m Response: ${msgLatency}ms\n\u001b[1;34m▣\u001b[0m API Ping: ${apiPing}ms\`\`\``, 
                        inline: true 
                    },
                    { 
                        name: '🧠 RESOURCE LOAD', 
                        value: `\`\`\`ansi\n\u001b[1;36m▣\u001b[0m RAM: ${memoryUsed}MB\n\u001b[1;35m▣\u001b[0m Cap: ${totalRam}GB\`\`\``, 
                        inline: true 
                    },
                    { 
                        name: '⏳ TEMPORAL UPTIME', 
                        value: `\`\`\`fix\n${days}d ${hours}h ${minutes}m ${seconds}s\`\`\`\n**Stability:** \`${createBar(progress)}\` **${progress}%**`, 
                        inline: false 
                    }
                )
                .setFooter({ text: 'EAGLE COMMUNITY • DIGITAL SOVEREIGNTY • BKO-223' })
                .setTimestamp();
            
            await message.reply({ 
                content: `> **Checking system pulse... signal synchronized.**`,
                embeds: [aliveEmbed] 
            });
            
        } catch (error) {
            console.error('ALIVE_SCAN_ERROR:', error);
            message.reply('⚠️ **CRITICAL ERROR:** System vitality scan failed.');
        }
    }
};
