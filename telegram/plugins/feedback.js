// ═══════════════════════════════════════════
//  TG COMMAND: Feedback (NEW)
// ═══════════════════════════════════════════

const https = require('https');
function escapeHTML(t) { return !t || typeof t !== 'string' ? '' : t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

module.exports = {
    name: 'feedback',
    description: 'Send feedback to the bot creator',
    category: 'System',
    usage: '/feedback <your message>',
    aliases: ['suggest', 'report', 'bug'],

    handler: async (ctx) => {
        const text = ctx.args.join(' ');
        const ownerId = process.env.TELEGRAM_CHAT_ID;

        if (!text) {
            return ctx.replyHTML(
                `💬 <b>Feedback</b>\n\n` +
                `Send feedback to @mfof7310!\n\n` +
                `<code>/feedback Add weather command!</code>`
            );
        }
        if (!ownerId) return ctx.replyHTML(`❌ Feedback system not configured.`);

        try {
            await sendMessage(ownerId,
                `📬 <b>NEW FEEDBACK</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
                `👤 <b>From:</b> ${escapeHTML(ctx.username)}\n` +
                `🆔 <b>ID:</b> <code>${ctx.userId}</code>\n\n` +
                `📝 ${escapeHTML(text)}`,
                process.env.TELEGRAM_BOT_TOKEN
            );
            ctx.replyHTML(
                `✅ <b>Feedback sent!</b>\n\n` +
                `Thanks for helping improve Archon CG-223! 🦅\n` +
                `<i>@mfof7310 will review it.</i>`
            );
        } catch {
            ctx.replyHTML(`❌ Couldn't send. Try again later.`);
        }
    }
};

function sendMessage(chatId, text, token) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' });
        const req = https.request(
            `https://api.telegram.org/bot${token}/sendMessage`,
            { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 15000 },
            (res) => {
                let d = ''; res.on('data', c => d += c);
                res.on('end', () => { try { const j = JSON.parse(d); resolve(j.ok ? j.result : null); } catch { reject(); } });
            }
        );
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}
