const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'status',
    description: 'Check the Digital Engine health and operational telemetry.',
    category: 'SYSTEM',
    run: async (client, message, args, database) => {
        // 1. Telemetry Calculations
        const uptimeVal = process.uptime();
        const h = Math.floor(uptimeVal / 3600);
        const m = Math.floor((uptimeVal % 3600) / 60);
        const s = Math.floor(uptimeVal % 60);
        
        // Memory metrics
        const usedMemory = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
        
        // Database metrics
        const agentCount = Object.keys(database || {}).length;

        // 2. Build the Diagnostic Embed
        const statusEmbed = new EmbedBuilder()
            .setColor('#00fbff')
            .setAuthor({ name: 'ARCHITECT CG-223 | SYSTEM TELEMETRY', iconURL: client.user.displayAvatarURL() })
            .setTitle('🖥️ ENGINE OPERATIONAL STATUS')
            .addFields(
                { name: '📡 Latency', value: `\`${client.ws.ping}ms\``, inline: true },
                { name: '⏱️ Uptime', value: `\`${h}h ${m}m ${s}s\``, inline: true },
                { name: '🧠 RAM Usage', value: `\`${usedMemory} MB\``, inline: true },
                { name: '👥 Active Agents', value: `\`${agentCount}\``, inline: true },
                { name: '📍 Node', value: '`Bamako-223`', inline: true },
                { name: '🛡️ Core', value: '`Gemini 1.5`', inline: true }
            )
            .setFooter({ text: 'Eagle Community • Digital Sovereignty' })
            .setTimestamp();

        return message.reply({ embeds: [statusEmbed] });
    }
};
