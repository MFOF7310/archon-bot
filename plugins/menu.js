const { EmbedBuilder } = require('discord.js');
const os = require('os');

module.exports = {
    name: 'menu',
    description: 'Displays the CLOUD_GAMING-223 system dashboard.',
    category: 'System',
    async execute(message, args, client) {
        let platformName = "Linux Generic";
        if (process.env.P_SERVER_UUID) platformName = "Bot-Hosting.net";
        else if (os.platform() === 'win32') platformName = "Windows Local";

        const uptimeVal = process.uptime();
const d = Math.floor(uptimeVal / 86400).toString().padStart(2, '0');
const h = Math.floor((uptimeVal % 86400) / 3600).toString().padStart(2, '0');
const m = Math.floor((uptimeVal % 3600) / 60).toString().padStart(2, '0');
const s = Math.floor(uptimeVal % 60).toString().padStart(2, '0');
const uptimeString = `${d}d ${h}h ${m}m ${s}s`;

// 2. RAM Calculation (Bot Usage / System Total)
const botUsedRAM = Math.round(process.memoryUsage().rss / 1024 / 1024);
const systemTotalRAM = Math.round(os.totalmem() / 1024 / 1024);
const ramString = `${botUsedRAM} / ${systemTotalRAM} MB`;

// 3. Alignment Logic (Ensures strings are exactly 20 characters long)
const username = message.author.username.substring(0, 15).padEnd(20, ' ');
const prefix   = (process.env.PREFIX || ',').padEnd(20, ' ');
const platform = os.platform().padEnd(20, ' ');
const uptime   = uptimeString.padEnd(20, ' ');
const ram      = ramString.padEnd(20, ' ');

const dashboard = `
\`\`\`text
╔═══════ CLOUD_GAMING-223 ═══════════════╗
║                                        ║
║  Prefix   : ${prefix}   ║
║  User     : ${username}   ║
║  Version  : 2.5.0                   ║
║  Plugins  : ${client.commands.size.toString().padEnd(20, ' ')}   ║
║  Ram      : ${ram}   ║
║  Uptime   : ${uptime}   ║
║  Platform : ${platform}   ║
║                                        ║
╚════════════════════════════════════════╝
\`\`\``;


─── 📂 INSTALLED MODULES & PLUGINS ───
${modules} ${plugins}
────────────────────────────
\`\`\`
`;
        message.reply(dashboard);
    },
};
