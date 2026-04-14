// ================= TELEGRAM LINK SYSTEM v1.7.0 =================
const pendingLinks = new Map();

module.exports = {
    name: 'link',
    aliases: ['connect', 'sync'],
    handler: async (ctx) => {
        const args = ctx.args || [];
        const telegramId = ctx.userId.toString();
        const username = ctx.username;
        const client = ctx.client;
        const db = client.db;
        const version = client.version || '1.7.0';
        const botName = client.user?.username || 'Architect CG-223';
        const action = args[0]?.toLowerCase();
        
        if (!db) {
            await ctx.replyWithHTML(`❌ Database not connected. Contact @mfof7310`);
            return;
        }
        
        // ================= STATUS - Check if already linked =================
        if (!action || action === 'status') {
            const linked = db.prepare("SELECT discord_id FROM user_links WHERE telegram_id = ?").get(telegramId);
            
            if (linked) {
                const discordUser = db.prepare("SELECT username, level, credits FROM users WHERE id = ?").get(linked.discord_id);
                await ctx.replyWithHTML(
                    `╔══════════════════════════════════╗\n` +
                    `║        🔗 ACCOUNT LINKED 🔗        ║\n` +
                    `╚══════════════════════════════════╝\n\n` +
                    `✅ <b>Telegram:</b> ${username}\n` +
                    `✅ <b>Discord:</b> ${discordUser?.username || 'Unknown'}\n\n` +
                    `<b>📊 Your Stats:</b>\n` +
                    `• Level: ${discordUser?.level || 1}\n` +
                    `• Credits: ${(discordUser?.credits || 0).toLocaleString()} 🪙\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `📍 BAMAKO_223 🇲🇱 • v${version}`
                );
            } else {
                await ctx.replyWithHTML(
                    `╔══════════════════════════════════╗\n` +
                    `║       🔗 ACCOUNT NOT LINKED        ║\n` +
                    `╚══════════════════════════════════╝\n\n` +
                    `<b>Link your Discord account to sync progress!</b>\n\n` +
                    `<b>📋 Usage:</b>\n` +
                    `<code>/link &lt;discord_id&gt;</code>\n\n` +
                    `<b>📌 How to find your Discord ID:</b>\n` +
                    `1️⃣ Discord Settings > Advanced\n` +
                    `2️⃣ Enable <b>Developer Mode</b>\n` +
                    `3️⃣ Right-click your name > <b>Copy ID</b>\n\n` +
                    `<b>Example:</b>\n` +
                    `<code>/link 123456789012345678</code>\n\n` +
                    `<b>📊 Commands:</b>\n` +
                    `<code>/link status</code> - Check link status\n` +
                    `<code>/link confirm</code> - Confirm pending link\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `📍 BAMAKO_223 🇲🇱 • v${version}\n` +
                    `👨‍💻 Created by @mfof7310`
                );
            }
            return;
        }
        
        // ================= CONFIRM PENDING LINK =================
        if (action === 'confirm') {
            const pending = pendingLinks.get(telegramId);
            if (!pending) {
                await ctx.replyWithHTML(
                    `❌ <b>No pending link request!</b>\n\n` +
                    `Use <code>/link &lt;discord_id&gt;</code> first.`
                );
                return;
            }
            
            //================= Check if already linked =================
            const existingLink = db.prepare("SELECT * FROM user_links WHERE telegram_id = ? OR discord_id = ?").get(telegramId, pending);
            if (existingLink) {
                await ctx.replyWithHTML(`❌ This Discord ID or Telegram account is already linked!`);
                pendingLinks.delete(telegramId);
                return;
            }
            
            db.prepare("INSERT INTO user_links (telegram_id, discord_id, linked_at) VALUES (?, ?, ?)")
                .run(telegramId, pending, Math.floor(Date.now() / 1000));
            
            pendingLinks.delete(telegramId);
            
            //================= Get Discord user info =================
            const discordUser = db.prepare("SELECT username, level, credits FROM users WHERE id = ?").get(pending);
            
            await ctx.replyWithHTML(
                `╔══════════════════════════════════╗\n` +
                `║      ✅ ACCOUNT LINKED! ✅         ║\n` +
                `╚══════════════════════════════════╝\n\n` +
                `<b>🔗 Telegram:</b> ${username}\n` +
                `<b>🔗 Discord:</b> ${discordUser?.username || pending}\n\n` +
                `<b>📊 Synced Stats:</b>\n` +
                `• Level: ${discordUser?.level || 1}\n` +
                `• Credits: ${(discordUser?.credits || 0).toLocaleString()} 🪙\n\n` +
                `Your progress is now synchronized! 🎉\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `📍 BAMAKO_223 🇲🇱 • v${version}`
            );
            return;
        }
        
        // ================= INITIATE LINK =================
        const discordId = action; // The first argument is the Discord ID
        
        if (!discordId || !/^\d{17,20}$/.test(discordId)) {
            await ctx.replyWithHTML(
                `❌ <b>Invalid Discord ID!</b>\n\n` +
                `Discord IDs are 17-20 digits long.\n\n` +
                `<b>Example:</b> <code>/link 123456789012345678</code>\n\n` +
                `<b>How to find your Discord ID:</b>\n` +
                `1️⃣ Settings > Advanced > Developer Mode\n` +
                `2️⃣ Right-click your name > Copy ID`
            );
            return;
        }
        
        //================= Check if already linked =================
        const existingLink = db.prepare("SELECT * FROM user_links WHERE discord_id = ? OR telegram_id = ?").get(discordId, telegramId);
        if (existingLink) {
            await ctx.replyWithHTML(`❌ This Discord ID or Telegram account is already linked! Use /link status to check.`);
            return;
        }
        
        //================= Store pending link =================
        pendingLinks.set(telegramId, discordId);
        
        await ctx.replyWithHTML(
            `╔══════════════════════════════════╗\n` +
            `║       🔗 LINK REQUEST SENT         ║\n` +
            `╚══════════════════════════════════╝\n\n` +
            `<b>Telegram:</b> ${username}\n` +
            `<b>Discord ID:</b> ${discordId}\n\n` +
            `Type <code>/link confirm</code> to complete the link.\n\n` +
            `⚠️ <i>This request expires in 5 minutes.</i>\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📍 BAMAKO_223 🇲🇱 • v${version}`
        );
        
        //================= Auto-expire after 5 minutes =================
        setTimeout(() => {
            if (pendingLinks.has(telegramId)) {
                pendingLinks.delete(telegramId);
                ctx.replyWithHTML(`⏰ <b>Link request expired.</b> Use /link &lt;discord_id&gt; to try again.`).catch(() => {});
            }
        }, 300000);
    }
};