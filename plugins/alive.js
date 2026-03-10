module.exports = {
    name: 'alive',
    aliases: ['status', 'uptime', 'ping'],
    run: async (client, message, args, database) => {
        try {
            const uptimeVal = process.uptime();
            const h = Math.floor(uptimeVal / 3600);
            const m = Math.floor((uptimeVal % 3600) / 60);
            const s = Math.floor(uptimeVal % 60);
            
            const msgLatency = Date.now() - message.createdTimestamp;
            const apiPing = Math.round(client.ws.ping);

            let aliveCard = "```\n";
            aliveCard += "╭───────── SYSTEM STATUS ──────────\n";
            aliveCard += `│ 🟢 STATE   : ACTIVE / ONLINE\n`;
            aliveCard += `│ ⚡ ENGINE  : ARCHITECT-CG-223\n`;
            aliveCard += `│ 📍 NODE    : BAMAKO-ML 🇲🇱\n`;
            aliveCard += `│ 📡 LATENCY : ${msgLatency}ms\n`;
            aliveCard += `│ 🌐 API     : ${apiPing}ms\n`;
            aliveCard += `│ ⏳ UPTIME  : ${h}h ${m}m ${s}s\n`;
            aliveCard += "╰──────────────────────────────────\n";
            aliveCard += "\n      « DIGITAL ENGINE SYNCED »\n";
            aliveCard += "```";

            await message.reply(aliveCard);
        } catch (error) {
            console.error('Alive Error:', error);
        }
    }
};
