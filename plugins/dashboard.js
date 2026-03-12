const os = require('os');

module.exports = {
    name: 'dashboard',
    aliases: ['menu', 'sysinfo'],
    description: 'Display system dashboard with command categories.',
    category: 'SYSTEM',
    run: async (client, message, args, database) => {
        try {
            // System Calculations
            const uptimeVal = process.uptime();
            const h = Math.floor(uptimeVal / 3600);
            const m = Math.floor((uptimeVal % 3600) / 60);
            const s = Math.floor(uptimeVal % 60);
            
            // Memory & Platform Logic
            const usedRAM = Math.round(process.memoryUsage().rss / 1024 / 1024);
            const totalRAM = Math.round(os.totalmem() / 1024 / 1024);
            const cpuCores = os.cpus().length;
            
            // Smart Platform Detection (Bypasses the random UUID/Hostname)
            const platform = `${os.type()} ${os.arch()}`; 
            
            const now = new Date();
            const time = now.toLocaleTimeString('en-GB', { timeZone: 'Africa/Bamako', hour12: false, hour: '2-digit', minute: '2-digit' });
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
            output += `│ 👤 USER     : ${message.author.username}\n`;
            output += `│ 🕒 TIME     : ${time}\n`;
            output += `│ 📍 NODE     : Bamako-223 🇲🇱\n`;
            output += `│ 🖥️ PLATFORM : ${platform}\n`;
            output += `│ 🧠 RAM      : ${usedRAM}MB / ${totalRAM}MB\n`;
            output += `│ ⚙️ CPU      : ${cpuCores} cores\n`;
            output += `│ ⏳ UPTIME   : ${h}h ${m}m ${s}s\n`;
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
            message.reply('⚠️ Dashboard Engine Failure.');
        }
    }
};
