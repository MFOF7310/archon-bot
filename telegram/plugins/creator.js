module.exports = {
    name: 'creator',
    aliases: ['who', 'about', 'owner', 'architect'],
    handler: async (ctx) => {
        const version = ctx.client?.version || '1.7.0';
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        
        await ctx.replyWithHTML(
            `<b>🦅 ARCHITECT CG-223</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `<b>👨‍💻 Creator:</b> 穆萨 (Moussa Fofana)\n` +
            `<b>📱 Telegram:</b> @mfof7310\n` +
            `<b>💬 Discord:</b> mfof7559\n` +
            `<b>🔗 GitHub:</b> github.com/MFOF7310\n\n` +
            `<b>📍 Node:</b> BAMAKO_223 🇲🇱\n` +
            `<b>📦 Version:</b> v${version}\n` +
            `<b>⏳ Uptime:</b> ${days}d ${hours}h ${minutes}m\n\n` +
            `<b>🏗️ Architecture:</b>\n` +
            `• Neural Engine v1.7.0\n` +
            `• Lydia AI (OpenRouter)\n` +
            `• Telegram Bridge\n` +
            `• Discord Sync\n\n` +
            `<i>"Digital Sovereignty • Bamako Node"</i>`
        );
    }
};