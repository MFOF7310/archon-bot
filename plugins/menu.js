const os = require('os');

module.exports = {
    name: 'menu',
    category: 'SYSTEM',
    description: 'Dynamic System Dashboard',
    async execute(message, args, client) {
        try {
            // --- 1. VPS Diagnostics ---
            const uptimeVal = process.uptime();
            const h = Math.floor(uptimeVal / 3600);
            const m = Math.floor((uptimeVal % 3600) / 60);
            const s = Math.floor(uptimeVal % 60);
            
            const usedRAM = Math.round(process.memoryUsage().rss / 1024 / 1024);
            const totalRAM = Math.round(os.totalmem() / 1024 / 1024);
            
            const date = new Date().toLocaleDateString('en-GB');
            const day = new Date().toLocaleDateString('en-US', { weekday: 'long' });
            const time = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });

            // --- 2. Smart Category Organization ---
            const organizedCommands = {};
            
            // This loop ensures EVERY plugin in client.commands is seen
            client.commands.forEach(cmd => {
                // If category is missing, we label it 'UNSORTED' so it SHOWS UP no matter what
                let cat = (cmd.category) ? cmd.category.toUpperCase() : 'UNSORTED';
                
                if (!organizedCommands[cat]) organizedCommands[cat] = [];
                organizedCommands[cat].push(cmd.name.toUpperCase());
            });

            // --- 3. Header Construction ---
            let menuHeader = "```\n";
            menuHeader += "╭──────── CLOUD_GAMING-223 ─────────\n";
            menuHeader += `│ * │  Prefix : ,\n`;
            menuHeader += `│ * │  User   : ${message.author.username}\n`;
            menuHeader += `│ * │  Time   : ${time}\n`;
            menuHeader += `│ * │  Date   : ${date} (${day})\n`;
            menuHeader += `│ * │  Version: 2.7.0\n`;
            menuHeader += `│ * │  Plugins: ${client.commands.size}\n`;
            menuHeader += `│ * │  Ram    : ${usedRAM}/${totalRAM}MB\n`;
            menuHeader += `│ * │  Uptime : ${h}h ${m}m ${s}s\n`;
            menuHeader += "╰───────────────────────────────────\n\n";

            // --- 4. Section Construction ---
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
            console.error('Menu Error:', error);
            message.reply('⚠️ Menu Engine Failure.');
        }
    }
};
