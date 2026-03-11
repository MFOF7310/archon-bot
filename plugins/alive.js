const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'alive',
    aliases: ['status', 'uptime', 'ping'],
    description: 'Check system status, latency, and uptime.',
    category: 'SYSTEM',
    run: async (client, message, args, database) => {
        try {
            const uptimeVal = process.uptime();
            const h = Math.floor(uptimeVal / 3600);
            const m = Math.floor((uptimeVal % 3600) / 60);
            const s = Math.floor(uptimeVal % 60);
            
            const msgLatency = Date.now() - message.createdTimestamp;
            const apiPing = Math.round(client.ws.ping);
            const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

            // Option A: Code block (your current style)
            const codeBlock = "```\n" +
                "╭───────── SYSTEM STATUS ──────────\n" +
                `│ 🟢 STATE   : ACTIVE / ONLINE\n` +
                `│ ⚡ ENGINE  : ARCHITECT-CG-223\n` +
                `│ 📍 NODE    : BAMAKO-ML 🇲🇱\n` +
                `│ 📡 LATENCY : ${msgLatency}ms\n` +
                `│ 🌐 API     : ${apiPing}ms\n` +
                `│ ⏳ UPTIME  : ${h}h ${m}m ${s}s\n` +
                `│ 💾 MEMORY  : ${memoryUsage} MB\n` +
                "╰──────────────────────────────────\n" +
                "\n      « DIGITAL ENGINE SYNCED »\n" +
                "```";

            // Option B: Embed (for consistency)
            const embed = new EmbedBuilder()
                .setColor('#00ffcc')
                .setAuthor({ name: 'ARCHITECT CG-223 | SYSTEM STATUS', iconURL: client.user.displayAvatarURL() })
                .setTitle('🟢 ACTIVE / ONLINE')
                .addFields(
                    { name: '📍 Node', value: 'BAMAKO-ML 🇲🇱', inline: true },
                    { name: '⚡ Engine', value: 'ARCHITECT-CG-223', inline: true },
                    { name: '📡 Latency', value: `${msgLatency}ms`, inline: true },
                    { name: '🌐 API Ping', value: `${apiPing}ms`, inline: true },
                    { name: '⏳ Uptime', value: `${h}h ${m}m ${s}s`, inline: true },
                    { name: '💾 Memory', value: `${memoryUsage} MB`, inline: true }
                )
                .setFooter({ text: 'Digital Engine Synced' })
                .setTimestamp();

            // Choose one: await message.reply(codeBlock);  OR  await message.reply({ embeds: [embed] });
            await message.reply({ embeds: [embed] }); // Using embed for consistency

        } catch (error) {
            console.error('Alive Error:', error);
            message.reply('⚠️ **System check failed.**');
        }
    }
};