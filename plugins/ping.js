const { performance } = require('perf_hooks');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'ping',
    description: 'Measure the digital engine latency.',
    category: 'SYSTEM',
    run: async (client, message, args, database) => {
        // Record time BEFORE sending the first message
        const start = performance.now();
        
        // Send first message: "Ping!"
        await message.reply('🏓 Ping!');
        
        // Record time AFTER first message is sent
        const end = performance.now();
        const latency = Math.round(end - start);
        const apiPing = Math.round(client.ws.ping);
        
        // Determine status color based on latency
        let color;
        let status;
        if (latency < 100) {
            color = '#2ecc71';
            status = '🟢 EXCELLENT';
        } else if (latency < 250) {
            color = '#f1c40f';
            status = '🟡 GOOD';
        } else {
            color = '#e74c3c';
            status = '🔴 SLOW';
        }
        
        // Create professional embed for the response
        const embed = new EmbedBuilder()
            .setColor(color)
            .setAuthor({ 
                name: 'ARCHITECT CG-223 | LATENCY REPORT', 
                iconURL: client.user.displayAvatarURL() 
            })
            .setTitle('🏓 PONG!')
            .setDescription(`Response time: \`${latency}ms\``)
            .addFields(
                { 
                    name: '📡 ROUND TRIP', 
                    value: `\`${latency}ms\``, 
                    inline: true 
                },
                { 
                    name: '🌐 API HEARTBEAT', 
                    value: `\`${apiPing}ms\``, 
                    inline: true 
                },
                { 
                    name: '📶 SIGNAL STATUS', 
                    value: status, 
                    inline: true 
                }
            )
            .setFooter({ text: 'Digital Engine • Real-time latency measurement' })
            .setTimestamp();
        
        // Send second message with the professional embed
        await message.channel.send({ embeds: [embed] });
    },
};