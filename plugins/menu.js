const os = require('os');

module.exports = {
    name: 'menu',
    category: 'SYSTEM', // Even the menu needs a category!
    description: 'Dynamic System Dashboard with Auto-Fix',
    async execute(message, args, client) {
        try {
            // --- 1. Real-Time VPS Diagnostics ---
            const uptimeVal = process.uptime();
            const h = Math.floor(uptimeVal / 3600);
            const m = Math.floor((uptimeVal % 3600) / 60);
            const s = Math.floor(uptimeVal % 60);
            
            const usedRAM = Math.round(process.memoryUsage().rss / 1024 / 1024);
            const totalRAM = Math.round(os.totalmem() / 1024 / 1024);
            
            const platform = os.platform(); 
            const type = os.type();         
            const arch = os.arch();         
            
            const date = new Date().toLocaleDateString('en-GB');
            const day = new Date().toLocaleDateString('en-US', { weekday: 'long' });
            const time = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });

            // --- 2. Smart Category Organization ---
            const organizedCommands = {};

            client.commands.forEach(cmd => {
                // AUTO-FIX: If category is missing, empty, or undefined, assign 'GENERAL'
                let cat = (cmd.category && cmd.category.trim() !== '') ? cmd.category.toUpperCase() : 'GENERAL';
                
                if (!organizedCommands[cat]) organizedCommands[cat] = [];
                organizedCommands[cat].push(cmd.name.toUpperCase());
            });

            // --- 3. Header Construction ---
            let menuHeader = "```\n";
            menuHeader += "╭──────── CLOUD_GAMING-223 ─────────\n";
            menuHeader += `│ * │  Prefix : ,\n`;
            menuHeader += `│ * │  User   : ${message.author.username}\n`;
            menuHeader += `│ * │  Time   : ${time}\n`;
            menuHeader += `│ * │  Day    : ${day}\n`;
            menuHeader += `│ * │  Date   : ${date}\n`;
            menuHeader += `│ * │  Version: 5.3.4\n`;
            menuHeader += `│ * │  Plugins: ${client.commands.size}\n`;
            menuHeader += `│ * │  Ram    : ${usedRAM}/${totalRAM}MB\n`;
            menuHeader += `│ * │  Uptime : ${h}h ${m}m ${s}s\n`;
            menuHeader += `│ * │  Platform: ${platform} (${type} ${arch})\n`;
            menuHeader += "╰───────────────────────────────────\n\n";

            // --- 4. Section Construction (Alphabetical) ---
            // Sort categories so they always appear in the same order
            const sortedCategories = Object.keys(organizedCommands).sort();

            for (const category of sortedCategories) {
                menuHeader += `╭───❑ ${category} ❑\n`;
                // Sort commands within the category
                organizedCommands[category].sort().forEach(cmdName => {
                    menuHeader += `│ ${cmdName}\n`;
                });
                menuHeader += `╰───────────────────────────────────\n\n`;
            }
            
            menuHeader += "```";

            await message.reply(menuHeader);

        } catch (error) {
            console.error('Menu Error:', error);
            message.reply('⚠️ Error: The dashboard encountered a system glitch.');
        }
    }
};
