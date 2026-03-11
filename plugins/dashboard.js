const os = require('os');

module.exports = {
    name: 'menu',
    aliases: ['dashboard', 'sysinfo'],
    description: 'System dashboard with command overview.',
    category: 'SYSTEM',
    run: async (client, message, args, database) => {
        try {
            const uptimeVal = process.uptime();
            const h = Math.floor(uptimeVal / 3600);
            const m = Math.floor((uptimeVal % 3600) / 60);
            const s = Math.floor(uptimeVal % 60);
            
            const usedRAM = Math.round(process.memoryUsage().rss / 1024 / 1024);
            const totalRAM = Math.round(os.totalmem() / 1024 / 1024);
            const cpuCores = os.cpus().length;
            const hostname = os.hostname();
            
            const now = new Date();
            const time = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });
            const prefix = process.env.PREFIX || ".";

            // Group commands by category
            const categories = {};
            client.commands.forEach(cmd => {
                const cat = cmd.category ? cmd.category.toUpperCase() : 'GENERAL';
                if (!categories[cat]) categories[cat] = [];
                categories[cat].push(cmd.name.toLowerCase());
            });

            let output = "```\n";
            output += "╭──────── ARCHITECT CG-223 ──────────\n";
            output += `│ 👤 USER   : ${message.author.username}\n`;
            output += `│ 🕒 TIME   : ${time}\n`;
            output += `│ 📍 NODE   : Bamako-223 🇲🇱\n`;
            output += `│ 🖥️ HOST   : ${hostname}\n`;
            output += `│ 🧠 RAM    : ${usedRAM}MB / ${totalRAM}MB\n`;
            output += `│ ⚙️ CPU    : ${cpuCores} cores\n`;
            output += `│ ⏳ UPTIME : ${h}h ${m}m ${s}s\n`;
            output += "╰───────────────────────────────────\n\n";

            const sortedCats = Object.keys(categories).sort();
            for (const cat of sortedCats) {
                output += `╭──❑ ${cat}\n`;
                output += `│ ${categories[cat].sort().join(' • ')}\n`;
                output += `╰───────────────────────────────────\n\n`;
            }
            
            output += "```";
            await message.reply(output);
        } catch (error) {
            console.error(error);
            message.reply('⚠️ Menu Engine Failure.');
        }
    }
};