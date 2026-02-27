const { EmbedBuilder } = require('discord.js');
const os = require('os');

module.exports = {
    name: 'menu',
    description: 'Displays the CLOUD_GAMING-223 system dashboard.',
    async execute(message, args, client) {
        // 1. DYNAMIC PLATFORM DETECTOR
        let platformName = "Linux Generic";
        
        // Checks if running on Bot-Hosting/Pterodactyl
        if (process.env.P_SERVER_UUID) {
            platformName = "Bot-Hosting.net";
        } else if (os.platform() === 'win32') {
            platformName = "Windows Local";
        } else if (process.env.HOME && process.env.HOME.includes('vps')) {
            platformName = "Private VPS";
        }

        // 2. SYSTEM CALCULATIONS
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        
        const totalRAM = Math.round(os.totalmem() / 1024 / 1024);
        const usedRAM = Math.round((os.totalmem() - os.freemem()) / 1024 / 1024);

        // 3. PLUGIN LIST (UPPERCASE | STYLE)
        const modules = client.commands.map(cmd => `| ${cmd.name.toUpperCase()}`).join('\n');

        const dashboard = `
\`\`\`text
╔═══════ CLOUD_GAMING-223 ═══════╗
║                                ║
║  Prefix   : ${process.env.PREFIX || ','}                 ║
║  User     : ${message.author.username}            ║
║  Time     : ${new Date().toLocaleTimeString()}            ║
║  Day      : ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}              ║
║  Date     : ${new Date().toLocaleDateString()}           ║
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

        message.channel.send(dashboard);
    },
};
