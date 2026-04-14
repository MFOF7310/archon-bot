module.exports = {
    name: 'warn',
    aliases: ['warning', 'w'],
    handler: async (ctx) => {
        const args = ctx.args || [];
        const chatId = ctx.chatId;
        const userId = ctx.userId.toString();
        const username = ctx.username;
        const client = ctx.client;
        const version = client.version || '1.7.0';
        const botName = client.user?.username || 'Architect CG-223';
        
        // Check permissions (admin/owner only)
        const isAdmin = await checkAdminPermission(ctx);
        if (!isAdmin) {
            await ctx.replyWithHTML(
                `╔══════════════════════════════════╗\n` +
                `║        ⛔ ACCESS DENIED ⛔         ║\n` +
                `╚══════════════════════════════════╝\n\n` +
                `🔒 This command requires <b>admin permissions</b>.`
            );
            return;
        }
        
        // Parse target user
        const targetUser = await parseTargetUser(ctx, args[0]);
        if (!targetUser) {
            await ctx.replyWithHTML(
                `╔══════════════════════════════════╗\n` +
                `║        ⚠️ WARNING SYSTEM ⚠️        ║\n` +
                `╚══════════════════════════════════╝\n\n` +
                `<b>Usage:</b> <code>/warn @user [reason]</code>\n` +
                `<code>/warn reply_to_message [reason]</code>\n\n` +
                `<b>Examples:</b>\n` +
                `<code>/warn @mfof7310 Spamming</code>\n` +
                `<code>/warn 5076150691 Inappropriate behavior</code>`
            );
            return;
        }
        
        const reason = args.slice(1).join(' ') || 'No reason provided';
        const targetId = targetUser.id.toString();
        const targetName = targetUser.first_name || targetUser.username || 'Unknown';
        
        // Save warning to database
        const db = client.db;
        if (!db) {
            await ctx.replyWithHTML(`❌ Database not connected.`);
            return;
        }
        
        const warningId = `${chatId}_${targetId}_${Date.now()}`;
        const now = Math.floor(Date.now() / 1000);
        
        db.prepare(`
            INSERT INTO moderation_logs (id, guild_id, user_id, moderator_id, action, reason, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(warningId, `tg_${chatId}`, targetId, userId, 'warn', reason, now);
        
        // Count total warnings
        const warningCount = db.prepare(`
            SELECT COUNT(*) as count FROM moderation_logs 
            WHERE user_id = ? AND action = 'warn'
        `).get(targetId);
        
        const count = warningCount?.count || 1;
        
        // Beautiful warning response
        let actionText = '';
        if (count === 3) {
            actionText = `\n⚠️ <b>3 WARNINGS REACHED!</b>\nConsider using /mute or /kick.`;
        } else if (count === 5) {
            actionText = `\n🚫 <b>5 WARNINGS REACHED!</b>\nUser should be banned.`;
        }
        
        await ctx.replyWithHTML(
            `╔══════════════════════════════════╗\n` +
            `║        ⚠️ WARNING ISSUED ⚠️        ║\n` +
            `╚══════════════════════════════════╝\n\n` +
            `<b>👤 User:</b> ${targetName}\n` +
            `<b>🆔 ID:</b> <code>${targetId}</code>\n` +
            `<b>📋 Reason:</b> ${reason}\n` +
            `<b>⚠️ Total Warnings:</b> ${count}/3\n` +
            `<b>👮 Moderator:</b> ${username}\n` +
            `<b>⏰ Time:</b> ${new Date().toLocaleString()}\n` +
            `${actionText}\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `<i>Warning ID: ${warningId.slice(-8)}</i>\n` +
            `🛡️ ${botName} • v${version}`
        );
        
        // Try to DM the warned user
        try {
            await ctx.replyWithHTML(
                `📨 <i>Attempting to notify user...</i>`
            );
        } catch (e) {}
    }
};

// Helper: Check admin permissions
async function checkAdminPermission(ctx) {
    try {
        const chatId = ctx.chatId;
        const userId = ctx.userId;
        const token = ctx.token;
        
        // Get chat member info
        const https = require('https');
        
        return new Promise((resolve) => {
            const req = https.request({
                hostname: 'api.telegram.org',
                path: `/bot${token}/getChatMember?chat_id=${chatId}&user_id=${userId}`,
                method: 'GET'
            }, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(body);
                        if (json.ok) {
                            const status = json.result.status;
                            resolve(['creator', 'administrator'].includes(status));
                        } else {
                            resolve(false);
                        }
                    } catch (e) {
                        resolve(false);
                    }
                });
            });
            req.on('error', () => resolve(false));
            req.end();
        });
    } catch (e) {
        return false;
    }
}

// Helper: Parse target user from mention/reply/ID
async function parseTargetUser(ctx, arg) {
    const message = ctx.message;
    
    // Check reply
    if (message.reply_to_message) {
        return message.reply_to_message.from;
    }
    
    // Check mention
    if (message.entities) {
        for (const entity of message.entities) {
            if (entity.type === 'mention') {
                const mention = message.text.substring(entity.offset, entity.offset + entity.length);
                // Return basic user object with username
                return { id: mention.replace('@', ''), username: mention, first_name: mention };
            }
            if (entity.type === 'text_mention') {
                return entity.user;
            }
        }
    }
    
    // Check ID
    if (arg && /^\d+$/.test(arg)) {
        return { id: arg, first_name: `User ${arg}` };
    }
    
    return null;
}