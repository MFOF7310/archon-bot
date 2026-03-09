const os = require('os');

module.exports = {
    name: 'menu',
    category: 'SYSTEM',
    description: 'Dynamic System Dashboard',
    run: async (client, message, args, database) => {
        try {
            const uptimeVal = process.uptime();
            const h = Math.floor(uptimeVal / 3600);
            const m = Math.floor((uptimeVal % 3600) / 60);
            const s = Math.floor(uptimeVal % 60);
            
            const usedRAM = Math.round(process.memoryUsage().rss / 1024 / 1024);
            const totalRAM = Math.round(os.totalmem() / 1024 / 1024);
            
            const now = new Date();
            const date = now.toLocaleDateString('en-GB');
            const day = now.toLocaleDateString('en-US', { weekday: 'long' });
            const time = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });
            const prefix = process.env.PREFIX || ",";

            const organizedCommands = {};
            client.commands.forEach(cmd => {
                let cat = (cmd.category) ? cmd.category.toUpperCase() : 'UNSORTED';
                if (!organizedCommands[cat]) organizedCommands[cat] = [];
                organizedCommands[cat].push(cmd.name.toUpperCase());
            });

            let menuHeader = "```\n";
            menuHeader += "╭──────── EAGLE COMMUNITY ──────────\n";
            menuHeader += `│ * │  Prefix : ${prefix}\n`;
            menuHeader += `│ * │  User   : ${message.author.username}\n`;
            menuHeader += `│ * │  Time   : ${time}\n`;
            menuHeader += `│ * │  Date   : ${date} (${day})\n`;
            menuHeader += `│ * │  Nodes  : Bamako-223 🇲🇱\n`;
            menuHeader += `│ * │  Ram    : ${usedRAM}/${totalRAM}MB\n`;
            menuHeader += `│ * │  Uptime : ${h}h ${m}m ${s}s\n`;
            menuHeader += "╰───────────────────────────────────\n\n";

            const sortedCategories = Object.keys(organizedCommands).sort();
            for (const category of sortedCategories) {
                menuHeader += `╭───❑ ${category} ❑\n`;
                organizedCommands[category].sort().forEach(cmdName => {
                    menuHeader += `│ ${cmdName}\n`;
                });
                menuHeader += `╰───────────────────────────────────\n\n`;
            }
            
            menuHeader += "```";
            await message.reply(menuHeader);
        } catch (error) {
            message.reply('⚠️ Menu Engine Failure.');
        }
    }
};
