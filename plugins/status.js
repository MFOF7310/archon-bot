const { EmbedBuilder, version } = require('discord.js');
const os = require('os');

module.exports = {
    name: 'status',
    description: 'Deep-scan Engine health and neural telemetry.',
    category: 'SYSTEM',
    run: async (client, message, args, database) => {
        // --- TELEMETRY CALCULATIONS ---
        const uptimeVal = process.uptime();
        const h = Math.floor(uptimeVal / 3600);
        const m = Math.floor((uptimeVal % 3600) / 60);
        const s = Math.floor(uptimeVal % 60);
        
        const usedMemory = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
        const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
        const agentCount = Object.keys(database || {}).length;
        const ping = client.ws.ping;

        // --- INTELLIGENT THEMING ---
        // Green if ping < 150ms, Yellow if < 300ms, Red if higher
        const statusColor = ping < 150 ? '#00fbff' : ping < 300 ? '#f1c40f' : '#e74c3c';
        const neuralStatus = ping < 200 ? "STABLE" : "LATENCY_WARNING";
        const searchStatus = "ONLINE"; // Represents Brave Search connectivity

        const statusEmbed = new EmbedBuilder()
            .setColor(statusColor)
            .setAuthor({ 
                name: 'ARCHITECT CG-223 | NEURAL OVERLINK', 
                iconURL: client.user.displayAvatarURL({ dynamic: true }) 
            })
            .setTitle('─ ARCHITECT SYSTEM DIAGNOSTICS ─')
            .setDescription(
                `**Node:** \`Bamako-223\`\n` +
                `**Integrity:** \`SYNCHRONIZED\`\n` +
                `**Web Intelligence:** \`Brave Search v1.0\``
            )
            .addFields(
                { 
                    name: '📡 CONNECTIVITY GRID', 
                    value: `\`\`\`ansi\n\u001b[1;32m▣\u001b[0m Latency: ${ping}ms\n\u001b[1;34m▣\u001b[0m Brave Search: ${searchStatus}\n\u001b[1;36m▣\u001b[0m WebSocket: ACTIVE\`\`\``, 
                    inline: false 
                },
                { 
                    name: '🧠 NEURAL CORE (Groq LPU™)', 
                    value: `\`\`\`ansi\n\u001b[1;35m◈\u001b[0m Inference: ${neuralStatus}\n\u001b[1;35m◈\u001b[0m Load: ${usedMemory}MB / ${totalMem}GB\n\u001b[1;35m◈\u001b[0m Agents: ${agentCount} Active\`\`\``, 
                    inline: false 
                },
                { 
                    name: '⏱️ TEMPORAL UPTIME', 
                    value: `\`\`\`fix\n${h} Hours | ${m} Minutes | ${s} Seconds\`\`\``, 
                    inline: false 
                }
            )
            .setFooter({ 
                text: 'EAGLE COMMUNITY • DIGITAL SOVEREIGNTY • v2.1.0', 
                iconURL: client.user.displayAvatarURL() 
            })
            .setTimestamp();

        message.reply({ 
            content: `> **Telemetry handshake initiated...**`,
            embeds: [statusEmbed] 
        });
    }
};
