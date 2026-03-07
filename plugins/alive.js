const os = require('os');

module.exports = {
    name: 'alive',
    category: 'SYSTEM',
    description: 'Check if the Engine is online.',
    async execute(message, args, client) {
        try {
            // 1. Calculations
            const uptimeVal = process.uptime();
            const h = Math.floor(uptimeVal / 3600);
            const m = Math.floor((uptimeVal % 3600) / 60);
            const s = Math.floor(uptimeVal % 60);
            
            // Calculate Latency
            const msgLatency = Date.now() - message.createdTimestamp;
            const apiPing = Math.round(client.ws.ping);

            // 2. Build the ASCII Status Card
            let aliveCard = "```\n";
            aliveCard += "╭───────── SYSTEM STATUS ──────────\n";
            aliveCard += `│ 🟢 STATE   : ACTIVE / ONLINE\n`;
            aliveCard += `│ ⚡ ENGINE  : CLOUD_GAMING-223\n`;
            aliveCard += `│ 👤 OWNER   : ${message.author.username}\n`;
            aliveCard += `│ 📡 LATENCY : ${msgLatency}ms\n`;
            aliveCard += `│ 🌐 API     : ${apiPing}ms\n`;
            aliveCard += `│ ⏳ UPTIME  : ${h}h ${m}m ${s}s\n`;
            aliveCard += `│ 🛠️ VERSION : 2.7.0 (Stable)\n`;
            aliveCard += "╰──────────────────────────────────\n";
            aliveCard += "\n      « DIGITAL ENGINE SYNCED »\n";
            aliveCard += "```";

            await message.reply(aliveCard);

        } catch (error) {
            console.error('Alive Command Error:', error);
        }
    }
};
