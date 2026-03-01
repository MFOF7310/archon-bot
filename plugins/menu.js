const { EmbedBuilder } = require('discord.js');
const os = require('os');

module.exports = {
    name: 'menu',
    description: 'Displays the system dashboard.',
    category: 'System',
    async execute(message, args, client) {
        try {
            // Uptime Logic
            const uptimeVal = process.uptime();
            const d = Math.floor(uptimeVal / 86400).toString().padStart(2, '0');
            const h = Math.floor((uptimeVal % 86400) / 3600).toString().padStart(2, '0');
            const m = Math.floor((uptimeVal % 3600) / 60).toString().padStart(2, '0');
            const s = Math.floor(uptimeVal % 60).toString().padStart(2, '0');
            const uptimeStr = `${d}d ${h}h ${m}m ${s}s`.padEnd(20, ' ');

            // System Logic
            const ram = `${Math.round(process.memoryUsage().rss / 1024 / 1024)} / ${Math.round(os.totalmem() / 1024 / 1024)} MB`.padEnd(20, ' ');
            const user = message.author.username.substring(0, 15).padEnd(20, ' ');
            const plat = (os.platform() === 'win32' ? "Windows" : "Linux").padEnd(20, ' ');
            const prefix = (process.env.PREFIX || ',').padEnd(20, ' ');
            const plugins = client.commands.size.toString().padEnd(20, ' ');

            const dashboard = `
\`\`\`text
╔═════════════ SYSTEM STATUS ═════════════╗
║                                         ║
║  PREFIX     : ${prefix}  ║
║  USER       : ${user}  ║
║  PLUGINS    : ${plugins}  ║
║  RAM        : ${ram}  ║
║  UPTIME     : ${uptimeStr}  ║
║  PLATFORM   : ${plat}  ║
║                                         ║
╚═════════════════════════════════════════╝
\`\`\``;

            return message.reply(dashboard);
        } catch (e) {
            console.error(e);
        }
    }
};
