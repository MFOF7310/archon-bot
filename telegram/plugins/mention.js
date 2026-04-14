module.exports = {
    name: 'mention',
    aliases: ['tag', 'notify', '@'],
    handler: async (ctx) => {
        const args = ctx.args || [];
        const chatId = ctx.chatId;
        const username = ctx.username;
        const message = ctx.message;
        
        // Get all chat members (for @all)
        let members = [];
        try {
            // Telegram doesn't directly give member list via bot API
            // But we can track active users from database
            const db = ctx.client?.db;
            if (db) {
                members = db.prepare("SELECT DISTINCT username FROM lydia_conversations WHERE channel_id = ? ORDER BY timestamp DESC LIMIT 20").all(`tg_${chatId}`);
            }
        } catch (e) {
            members = [];
        }
        
        if (args.length === 0) {
            await ctx.replyWithHTML(
                `<b>📢 Mention Usage</b>\n\n` +
                `<code>/mention @username</code> - Mention specific user\n` +
                `<code>/mention all</code> - Mention recent active users\n` +
                `<code>/mention everyone</code> - Same as all\n\n` +
                `<b>Example:</b>\n` +
                `<code>/mention @mfof7310 Hello!</code>`
            );
            return;
        }
        
        const target = args[0].toLowerCase();
        const mentionText = args.slice(1).join(' ') || 'You were mentioned!';
        
        if (target === 'all' || target === 'everyone') {
            if (members.length === 0) {
                await ctx.replyWithHTML(`⚠️ No recent active users found in this chat.`);
                return;
            }
            
            let mentionList = `<b>📢 ${username} mentioned everyone:</b>\n\n${mentionText}\n\n`;
            members.slice(0, 10).forEach(m => {
                if (m.username) {
                    mentionList += `• @${m.username}\n`;
                }
            });
            
            await ctx.replyWithHTML(mentionList);
        } else {
            // Mention specific user (remove @ if present)
            const cleanTarget = target.replace('@', '');
            await ctx.replyWithHTML(
                `<b>📢 ${username} mentioned @${cleanTarget}:</b>\n\n${mentionText}`
            );
        }
    }
};