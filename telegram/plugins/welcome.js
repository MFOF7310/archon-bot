// ═══════════════════════════════════════════
//  TG COMMAND: Welcome Config (NEW)
// ═══════════════════════════════════════════

function escapeHTML(t) { return !t || typeof t !== 'string' ? '' : t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
const { t } = require('../lang/index.js');

module.exports = {
    name: 'welcome',
    description: 'Configure welcome messages for groups',
    category: 'Moderation',
    usage: '/welcome on | /welcome off | /welcome set <text> | /welcome test',
    aliases: ['greeting', 'join'],
    adminOnly: true,

    handler: async (ctx) => {
        const db = ctx.client?.db;
        const args = ctx.args;
        const action = args[0]?.toLowerCase();
        const chatId = String(ctx.chatId);

        if (!db) return ctx.replyHTML(`❌ Database not connected.`);
        if (!ctx.isGroup && !ctx.isChannel) return ctx.replyHTML(`❌ Groups only.`);

        try {
            db.prepare(`CREATE TABLE IF NOT EXISTS group_settings (
                chat_id TEXT PRIMARY KEY, welcome_enabled INTEGER DEFAULT 0,
                welcome_text TEXT, welcome_type TEXT DEFAULT 'random'
            )`).run();
        } catch { /* silent */ }

        if (!action || action === 'status') {
            const s = db.prepare("SELECT * FROM group_settings WHERE chat_id = ?").get(chatId);
            const enabled = s?.welcome_enabled ? '🟢 ON' : '🔴 OFF';
            const text = s?.welcome_text || '<default>';
            return ctx.replyHTML(
                `👋 <b>Welcome Settings</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
                `Status: <b>${enabled}</b>\n` +
                `Custom: ${escapeHTML(text.substring(0, 50))}\n\n` +
                `<code>/welcome on</code> · Enable\n` +
                `<code>/welcome off</code> · Disable\n` +
                `<code>/welcome set Hi {name}!</code> · Custom\n` +
                `<code>/welcome test</code> · Preview`
            );
        }

        if (action === 'on') {
            db.prepare("INSERT OR REPLACE INTO group_settings (chat_id, welcome_enabled) VALUES (?, 1)").run(chatId);
            return ctx.replyHTML(`👋 <b>Welcome enabled!</b>`);
        }
        if (action === 'off') {
            db.prepare("INSERT OR REPLACE INTO group_settings (chat_id, welcome_enabled) VALUES (?, 0)").run(chatId);
            return ctx.replyHTML(`🔴 <b>Welcome disabled.</b>`);
        }
        if (action === 'set') {
            const text = args.slice(1).join(' ');
            if (!text) return ctx.replyHTML(`❌ Provide text. Use {name} for username.`);
            db.prepare("INSERT OR REPLACE INTO group_settings (chat_id, welcome_enabled, welcome_text) VALUES (?, 1, ?)").run(chatId, text);
            return ctx.replyHTML(`✅ Welcome set:\n${escapeHTML(text)}`);
        }
        if (action === 'test') {
            const s = db.prepare("SELECT * FROM group_settings WHERE chat_id = ?").get(chatId);
            const name = escapeHTML(ctx.username);
            const lang = ctx.message?.from?.language_code || 'en';
            let msg;
            if (s?.welcome_text) {
                msg = s.welcome_text.replace(/{name}/g, name).replace(/{group}/g, escapeHTML(ctx.message?.chat?.title || 'this group'));
            } else {
                msg = t(lang, 'welcome_default', { name, group: escapeHTML(ctx.message?.chat?.title || 'this group') });
            }
            return ctx.replyHTML(`${t(lang, 'welcome_test')}\n\n${msg}`);
        }

        ctx.replyHTML(`❌ Unknown. Use <code>/welcome on</code>, <code>/welcome off</code>, or <code>/welcome set</code>.`);
    }
};
