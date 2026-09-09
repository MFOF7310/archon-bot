// ═══════════════════════════════════════════
//  TG COMMAND: Account Linking v2
// ═══════════════════════════════════════════

function escapeHTML(t) {
    return !t || typeof t !== 'string' ? '' : t
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

const TIMEOUT_SEC = 300; // 5 minutes

function ensurePendingTable(db) {
    db.prepare(`CREATE TABLE IF NOT EXISTS link_pending (
        telegram_id TEXT PRIMARY KEY,
        discord_id TEXT NOT NULL,
        created_at INTEGER NOT NULL
    )`).run();
}

function cleanExpired(db) {
    const cutoff = Math.floor(Date.now() / 1000) - TIMEOUT_SEC;
    db.prepare('DELETE FROM link_pending WHERE created_at < ?').run(cutoff);
}

module.exports = {
    name: 'link',
    description: 'Link your Telegram account to Discord',
    category: 'System',
    usage: '/link <discord_id> | confirm | unlink | status | help',
    aliases: ['connect', 'sync'],

    handler: async (ctx) => {
        const db = ctx.client?.db;
        const telegramId = ctx.userId.toString();
        const args = ctx.args;
        const action = args[0]?.toLowerCase();

        if (!db) return ctx.replyHTML(`❌ Database not connected.`);

        ensurePendingTable(db);
        cleanExpired(db);

        // ── HELP ──────────────────────────────────────
        if (action === 'help') {
            return ctx.replyHTML(
                `🔗 <b>ACCOUNT LINKING</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━\n\n` +
                `<code>/link &lt;discord_id&gt;</code> — Start linking\n` +
                `<code>/link confirm</code> — Complete the link\n` +
                `<code>/link unlink</code> — Remove the link\n` +
                `<code>/link status</code> — Check current status\n\n` +
                `<b>How to get your Discord ID:</b>\n` +
                `1️⃣ Discord Settings → Advanced → Developer Mode ✅\n` +
                `2️⃣ Tap your username → Copy ID`
            );
        }

        // ── STATUS ────────────────────────────────────
        if (!action || action === 'status') {
            const linked = db.prepare('SELECT discord_id FROM user_links WHERE telegram_id = ?').get(telegramId);
            if (linked) {
                const dUser = db.prepare('SELECT username, level, credits FROM users WHERE id = ? ORDER BY level DESC LIMIT 1').get(linked.discord_id);
                return ctx.replyHTML(
                    `🔗 <b>ACCOUNT LINKED</b>\n` +
                    `━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `👤 Telegram: <b>${escapeHTML(ctx.username || telegramId)}</b>\n` +
                    `🎮 Discord: <b>${escapeHTML(dUser?.username || 'Unknown')}</b>\n\n` +
                    `📊 Level: <b>${dUser?.level || 1}</b>\n` +
                    `💰 Credits: <b>${(dUser?.credits || 0).toLocaleString()} 🪙</b>\n\n` +
                    `<i>Use /link unlink to disconnect.</i>`
                );
            }
            const hasPending = db.prepare('SELECT discord_id FROM link_pending WHERE telegram_id = ?').get(telegramId);
            if (hasPending) {
                return ctx.replyHTML(
                    `⏳ <b>PENDING LINK</b>\n\n` +
                    `Discord ID: <code>${hasPending.discord_id}</code>\n\n` +
                    `Type <code>/link confirm</code> to complete.\n` +
                    `<i>Expires in 5 minutes from request.</i>`
                );
            }
            return ctx.replyHTML(
                `🔗 <b>NOT LINKED</b>\n\n` +
                `Connect your Telegram to Discord to sync your progress.\n\n` +
                `<code>/link &lt;discord_id&gt;</code>\n\n` +
                `Need help? <code>/link help</code>`
            );
        }

        // ── CONFIRM ───────────────────────────────────
        if (action === 'confirm') {
            const pending = db.prepare('SELECT discord_id, created_at FROM link_pending WHERE telegram_id = ?').get(telegramId);
            if (!pending) {
                return ctx.replyHTML(
                    `❌ <b>No pending link request.</b>\n\n` +
                    `Start with <code>/link &lt;discord_id&gt;</code>`
                );
            }
            const age = Math.floor(Date.now() / 1000) - pending.created_at;
            if (age > TIMEOUT_SEC) {
                db.prepare('DELETE FROM link_pending WHERE telegram_id = ?').run(telegramId);
                return ctx.replyHTML(
                    `⌛ <b>Link request expired.</b>\n\n` +
                    `Requests expire after 5 minutes. Start again:\n` +
                    `<code>/link ${pending.discord_id}</code>`
                );
            }
            const existing = db.prepare('SELECT * FROM user_links WHERE telegram_id = ? OR discord_id = ?').get(telegramId, pending.discord_id);
            if (existing) {
                db.prepare('DELETE FROM link_pending WHERE telegram_id = ?').run(telegramId);
                return ctx.replyHTML(`❌ This account is already linked.`);
            }
            db.prepare('INSERT INTO user_links (telegram_id, discord_id, linked_at) VALUES (?, ?, ?)').run(telegramId, pending.discord_id, Math.floor(Date.now() / 1000));
            db.prepare('DELETE FROM link_pending WHERE telegram_id = ?').run(telegramId);
            const dUser = db.prepare('SELECT username FROM users WHERE id = ? LIMIT 1').get(pending.discord_id);
            return ctx.replyHTML(
                `✅ <b>ACCOUNTS LINKED</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━\n\n` +
                `👤 Telegram: <b>${escapeHTML(ctx.username || telegramId)}</b>\n` +
                `🎮 Discord: <b>${escapeHTML(dUser?.username || pending.discord_id)}</b>\n\n` +
                `Your accounts are now connected. Use <code>/link status</code> to check anytime.`
            );
        }

        // ── UNLINK ────────────────────────────────────
        if (action === 'unlink') {
            const linked = db.prepare('SELECT * FROM user_links WHERE telegram_id = ?').get(telegramId);
            if (!linked) return ctx.replyHTML(`❌ No linked account found.`);
            db.prepare('DELETE FROM user_links WHERE telegram_id = ?').run(telegramId);
            return ctx.replyHTML(
                `🔓 <b>UNLINKED</b>\n\n` +
                `Your Telegram and Discord accounts have been disconnected.\n\n` +
                `<i>Link again anytime with /link &lt;discord_id&gt;</i>`
            );
        }

        // ── INITIATE ──────────────────────────────────
        const discordId = action;
        if (!/^\d{17,20}$/.test(discordId)) {
            return ctx.replyHTML(
                `❌ <b>Invalid Discord ID.</b>\n\n` +
                `Must be 17–20 digits.\n` +
                `Example: <code>/link 123456789012345678</code>\n\n` +
                `<code>/link help</code> for instructions.`
            );
        }

        const existing = db.prepare('SELECT * FROM user_links WHERE discord_id = ? OR telegram_id = ?').get(discordId, telegramId);
        if (existing) {
            return ctx.replyHTML(
                `❌ <b>Already linked.</b>\n\n` +
                `Use <code>/link status</code> to check or <code>/link unlink</code> to reset.`
            );
        }

        db.prepare('INSERT OR REPLACE INTO link_pending (telegram_id, discord_id, created_at) VALUES (?, ?, ?)').run(telegramId, discordId, Math.floor(Date.now() / 1000));

        return ctx.replyHTML(
            `🔗 <b>LINK REQUEST</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `👤 Telegram: <b>${escapeHTML(ctx.username || telegramId)}</b>\n` +
            `🎮 Discord ID: <code>${discordId}</code>\n\n` +
            `Type <code>/link confirm</code> to complete.\n` +
            `<i>⏳ Expires in 5 minutes.</i>`
        );
    }
};
