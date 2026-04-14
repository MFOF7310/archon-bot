module.exports = {
    name: 'stats',
    aliases: ['system', 'dashboard'],
    handler: async (ctx) => {
        const client = ctx.client;
        const version = client.version || '1.7.0';
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        
        const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const guilds = client.guilds?.cache?.size || 0;
        const users = client.guilds?.cache?.reduce((acc, g) => acc + g.memberCount, 0) || 0;
        const commands = client.commands?.size || 0;
        const telegramBridge = client.telegramBridge?.enabled ? '🟢 ACTIVE' : '⚪ STANDBY';
        
        await ctx.replyWithHTML(
            `╔══════════════════════════════════╗\n` +
            `║   🦅 ARCHITECT CG-223 DASHBOARD   ║\n` +
            `╚══════════════════════════════════╝\n\n` +
            `<b>🖥️ SYSTEM</b>\n` +
            `• Node: BAMAKO_223 🇲🇱\n` +
            `• Version: v${version}\n` +
            `• Uptime: ${days}d ${hours}h ${minutes}m ${seconds}s\n` +
            `• Memory: ${memory} MB\n\n` +
            `<b>📡 DISCORD</b>\n` +
            `• Servers: ${guilds}\n` +
            `• Users: ${users}\n` +
            `• Commands: ${commands}\n\n` +
            `<b>🌉 TELEGRAM</b>\n` +
            `• Bridge: ${telegramBridge}\n` +
            `• Active Chats: ${ctx.lydiaActiveChats?.size || 0}\n\n` +
            `<b>🧠 AI</b>\n` +
            `• Lydia: Online\n` +
            `• Model: OpenRouter GPT-4o-mini\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `<i>Digital Sovereignty • Bamako Node</i>\n` +
            `👨‍💻 @mfof7310`
        );
    }
};