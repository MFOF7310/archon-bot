const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'alive',
    aliases: ['status', 'uptime', 'ping'],
    description: 'Check system status, latency, and uptime.',
    category: 'SYSTEM',
    run: async (client, message, args, database) => {
        try {
            // --- Uptime with days ---
            const uptimeSec = process.uptime();
            const days = Math.floor(uptimeSec / 86400);
            const hours = Math.floor((uptimeSec % 86400) / 3600);
            const minutes = Math.floor((uptimeSec % 3600) / 60);
            const seconds = Math.floor(uptimeSec % 60);
            
            // --- Performance metrics ---
            const msgLatency = Date.now() - message.createdTimestamp;
            const apiPing = Math.round(client.ws.ping);
            const memoryUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
            
            // --- Dynamic color based on latency ---
            let embedColor;
            if (msgLatency < 100) embedColor = '#2ecc71';   // green
            else if (msgLatency < 300) embedColor = '#f1c40f'; // yellow
            else embedColor = '#e74c3c';                     // red
            
            // --- Optional progress bar (30 days = 100%) ---
            const maxDays = 30;
            const progress = Math.min(100, Math.floor((uptimeSec / 86400) / maxDays * 100));
            const barLength = 10;
            const filled = Math.floor(progress / (100 / barLength));
            const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
            
            // --- Build the embed ---
            const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setAuthor({ 
                    name: 'ARCHITECT CG-223 | SYSTEM STATUS', 
                    iconURL: client.user.displayAvatarURL() 
                })
                .setTitle('🟢 ACTIVE / ONLINE')
                .addFields(
                    { name: '📍 Node', value: 'BAMAKO-ML 🇲🇱', inline: true },
                    { name: '⚡ Engine', value: 'ARCHITECT-CG-223', inline: true },
                    { name: '📡 Latency', value: `${msgLatency}ms`, inline: true },
                    { name: '🌐 API Ping', value: `${apiPing}ms`, inline: true },
                    { name: '⏳ Uptime', value: `${days}d ${hours}h ${minutes}m ${seconds}s`, inline: true },
                    { name: '💾 Memory', value: `${memoryUsed} MB`, inline: true }
                )
                .setFooter({ text: `Digital Engine Synced • Uptime: ${progress}% ▸ ${bar}` })
                .setTimestamp();
            
            await message.reply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Alive Error:', error);
            message.reply('⚠️ **System check failed.**');
        }
    }
}