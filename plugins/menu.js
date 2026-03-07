const os = require('os');

module.exports = {
    name: 'menu',
    description: 'Levanter-style System Dashboard',
    async execute(message, args, client) {
        try {
            // 1. System Statistics
            const uptimeVal = process.uptime();
            const h = Math.floor(uptimeVal / 3600);
            const m = Math.floor((uptimeVal % 3600) / 60);
            const s = Math.floor(uptimeVal % 60);
            
            // Real RAM usage
            const usedRAM = Math.round(process.memoryUsage().rss / 1024 / 1024);
            const totalRAM = Math.round(os.totalmem() / 1024 / 1024);
            
            // Real Platform Info
            const platform = os.platform(); // 'linux', 'win32', etc.
            const type = os.type();         // 'Linux', 'Windows_NT'
            const arch = os.arch();         // 'x64', 'arm64'
            
            const date = new Date().toLocaleDateString('en-GB');
            const day = new Date().toLocaleDateString('en-US', { weekday: 'long' });
            const time = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });

            // 2. Command Categories (You can add more here)
            const categories = {
                'AI': ['BING', 'DALL', 'GEMINI', 'GPT', 'GROQ', 'UPSCALE'],
                'AUDIO': ['AVEC', 'BASS', 'BLACK', 'BLOWN', 'CUT', 'DEEP', 'EARRAPE', 'FAST', 'FAT'],
                'AUTOREPLY': ['FILTER', 'GFILTER', 'GSTOP']
            };

            // 3. Build the ASCII Menu
            let menuHeader = "```\n";
            menuHeader += "╭──────── CLOUD_GAMING-223 ─────────\n";
            menuHeader += `│ * │  Prefix : ,\n`;
            menuHeader += `│ * │  User   : ${message.author.username}\n`;
            menuHeader += `│ * │  Time   : ${time}\n`;
            menuHeader += `│ * │  Day    : ${day}\n`;
            menuHeader += `│ * │  Date   : ${date}\n`;
            menuHeader += `│ * │  Version: 2.7.0\n`;
            menuHeader += `│ * │  Plugins: ${client.commands.size}\n`;
            menuHeader += `│ * │  Ram    : ${usedRAM}/${totalRAM}MB\n`;
            menuHeader += `│ * │  Uptime : ${h}h ${m}m ${s}s\n`;
            menuHeader += `│ * │  Platform: ${platform} (${type} ${arch})\n`;
            menuHeader += "╰───────────────────────────────────\n\n";

            // 4. Build Sections
            for (const [category, cmds] of Object.entries(categories)) {
                menuHeader += `╭───❑ ${category} ❑\n`;
                cmds.forEach(cmd => {
                    menuHeader += `│ ${cmd}\n`;
                });
                menuHeader += `╰───────────────────────────────────\n\n`;
            }
            
            menuHeader += "```";

            await message.reply(menuHeader);

        } catch (error) {
            console.error('Menu Error:', error);
            message.reply('⚠️ Error generating the menu style.');
        }
    }
};
