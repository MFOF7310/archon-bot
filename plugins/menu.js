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

        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        
        const totalRAM = Math.round(os.totalmem() / 1024 / 1024);
        const usedRAM = Math.round((os.totalmem() - os.freemem()) / 1024 / 1024);

        const modules = client.commands.map(cmd => `| ${cmd.name.toUpperCase()}`).join('\n');

        const dashboard = `
\`\`\`text
╔═══════ CLOUD_GAMING-223 ═══════╗
║                                ║
║  Prefix   : ${process.env.PREFIX || ','}                 ║
║  User     : ${message.author.username}            ║
║  Version  : 2.5.0               ║
║  Plugins  : ${client.commands.size}                 ║
║  Ram      : ${usedRAM} / ${totalRAM} MB          ║
║  Uptime   : ${hours}h ${minutes}m             ║
║  Platform : ${platformName}      ║
║                                ║
╚════════════════════════════════╝

─── 📂 INSTALLED MODULES ───
${modules}
────────────────────────────
\`\`\`
`;
        message.reply(dashboard);
    },
};
