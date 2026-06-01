// ═══════════════════════════════════════════
//  TG COMMAND: Account Linking
// ═══════════════════════════════════════════

function escapeHTML(t) { return !t || typeof t !== 'string' ? '' : t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

const pending = new Map();
const TIMEOUT = 300000;

module.exports = {
    name: 'link',
    description: 'Link Telegram to Discord account',
    category: 'System',
    usage: '/link <discord_id>',
    aliases: ['connect', 'sync'],

    handler: async (ctx) => {
        const db = ctx.client?.db;
        const telegramId = ctx.userId.toString();
        const args = ctx.args;
        const action = args[0]?.toLowerCase();

        if (!db) return ctx.replyHTML(`❌ Database not connected.`);

        // Status check
        if (!action || action === 'status') {
            const linked = db.prepare("SELECT discord_id FROM user_links WHERE telegram_id = ?").get(telegramId);
            if (linked) {
                const dUser = db.prepare("SELECT username, level, credits FROM users WHERE id = ?").get(linked.discord_id);
                return ctx.replyHTML(
                    `🔗 <b>ACCOUNT LINKED</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `✅ Telegram: ${escapeHTML(ctx.username)}\n` +
                    `✅ Discord: ${escapeHTML(dUser?.username || 'Unknown')}\n\n` +
                    `📊 Level: ${dUser?.level || 1}\n` +
                    `💰 Credits: ${(dUser?.credits || 0).toLocaleString()} 🪙`
                );
            }
            return ctx.replyHTML(
                `🔗 <b>NOT LINKED</b>\n\n` +
                `<code>/link &lt;discord_id&gt;</code>\n\n` +
                `1️⃣ Discord Settings > Advanced > Dev Mode\n` +
                `2️⃣ Right-click name > Copy ID`
            );
        }

        // Confirm
        if (action === 'confirm') {
            const req = pending.get(telegramId);
            if (!req) return ctx.replyHTML(`❌ No pending link! Use <code>/link &lt;id&gt;</code> first.`);
            const existing = db.prepare("SELECT * FROM user_links WHERE telegram_id=? OR discord_id=?").get(telegramId, req);
            if (existing) { pending.delete(telegramId); return ctx.replyHTML(`❌ Already linked!`); }
            db.prepare("INSERT INTO user_links (telegram_id, discord_id, linked_at) VALUES (?, ?, ?)")
                .run(telegramId, req, Math.floor(Date.now() / 1000));
            pending.delete(telegramId);
            return ctx.replyHTML(`✅ <b>LINKED!</b>\n\nProgress synced between Telegram and Discord! 🎉`);
        }

        // Unlink
        if (action === 'unlink') {
            const linked = db.prepare("SELECT * FROM user_links WHERE telegram_id = ?").get(telegramId);
            if (!linked) return ctx.replyHTML(`❌ Not linked!`);
            db.prepare("DELETE FROM user_links WHERE telegram_id = ?").run(telegramId);
            return ctx.replyHTML(`✅ <b>Unlinked!</b>`);
        }

        // Initiate link
        const discordId = action;
        if (!/^\d{17,20}$/.test(discordId)) {
            return ctx.replyHTML(`❌ Invalid Discord ID. Must be 17-20 digits.\n\n<code>/link 123456789012345678</code>`);
        }

        const existing = db.prepare("SELECT * FROM user_links WHERE discord_id=? OR telegram_id=?").get(discordId, telegramId);
        if (existing) return ctx.replyHTML(`❌ Already linked! Use <code>/link status</code>.`);

        pending.set(telegramId, discordId);
        ctx.replyHTML(
            `🔗 <b>LINK REQUEST</b>\n\n` +
            `Telegram: ${escapeHTML(ctx.username)}\n` +
            `Discord ID: <code>${discordId}</code>\n\n` +
            `Type <code>/link confirm</code> to complete.\n<i>Expires in 5 minutes.</i>`
        );

        setTimeout(() => { if (pending.has(telegramId)) pending.delete(telegramId); }, TIMEOUT);
    }
};
