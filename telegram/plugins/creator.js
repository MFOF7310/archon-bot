// ═══════════════════════════════════════════
//  TG COMMAND: Creator / About
// ═══════════════════════════════════════════

const formatUptime = (s) => { const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60); return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`; };

module.exports = {
    name: 'creator',
    description: 'About the Architect',
    category: 'Utility',
    aliases: ['who', 'about', 'owner', 'dev'],

    handler: async (ctx) => {
        const uptime = formatUptime(process.uptime());
        await ctx.replyHTML(
            `<b>🦅 ARCHITECT CG-223</b>\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `👨‍💻 <b>Creator:</b> Moussa Fofana\n` +
            `📱 <b>Telegram:</b> @mfof7310\n` +
            `💬 <b>Discord:</b> mfof7559\n` +
            `🔗 <b>GitHub:</b> github.com/MFOF7310\n\n` +
            `📍 <b>Node:</b> BAMAKO_223 🇲🇱\n` +
            `📦 <b>Version:</b> v3.0.0\n` +
            `⏳ <b>Uptime:</b> ${uptime}\n\n` +
            `• Neural Engine v3.0\n` +
            `• Lydia AI (OpenRouter)\n` +
            `• Discord ↔ Telegram Bridge\n\n` +
            `<i>"Digital Sovereignty · BAMAKO_223"</i>`
        );
    }
};
