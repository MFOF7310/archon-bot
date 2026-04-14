// ================= INTELLIGENT MUTE/UNMUTE SYSTEM =================
const https = require('https');

module.exports = {
    name: 'mute',
    aliases: ['unmute', 'silence', 'shut', 'speak'],
    handler: async (ctx) => {
        const args = ctx.args || [];
        const chatId = ctx.chatId;
        const userId = ctx.userId;
        const token = ctx.token;
        const client = ctx.client;
        const message = ctx.message;
        const version = client.version || '1.7.0';
        const botName = client.user?.username || 'Architect CG-223';
        
        // Detect if this is mute or unmute based on command used
        const command = message.text?.split(' ')[0]?.toLowerCase() || '/mute';
        const isUnmute = command.includes('unmute') || command === '/speak';
        
        // Check admin permission
        const isAdmin = await checkAdminPermission(ctx);
        if (!isAdmin) {
            await ctx.replyWithHTML(
                `╔══════════════════════════════════╗\n` +
                `║        ⛔ ACCESS DENIED ⛔         ║\n` +
                `╚══════════════════════════════════╝\n\n` +
                `🔒 This command requires <b>admin permissions</b>.\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🛡️ ${botName} • v${version}`
            );
            return;
        }
        
        // Parse target user
        const targetUser = await parseTargetUser(ctx, args[0]);
        if (!targetUser) {
            await showHelp(ctx, botName, version);
            return;
        }
        
        const targetId = targetUser.id;
        const targetName = targetUser.first_name || targetUser.username || 'Unknown';
        
        // Check if trying to mute an admin
        const targetIsAdmin = await checkAdminPermission(ctx, targetId);
        if (targetIsAdmin && !isUnmute) {
            await ctx.replyWithHTML(
                `╔══════════════════════════════════╗\n` +
                `║        ⚠️ CANNOT MUTE ADMIN ⚠️      ║\n` +
                `╚══════════════════════════════════╝\n\n` +
                `<b>👤 ${targetName}</b> is an administrator and cannot be muted.\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🛡️ ${botName} • v${version}`
            );
            return;
        }
        
        // Execute mute or unmute
        if (isUnmute) {
            await handleUnmute(ctx, targetId, targetName, botName, version);
        } else {
            await handleMute(ctx, targetId, targetName, args, botName, version);
        }
    }
};

// Handle mute action
async function handleMute(ctx, targetId, targetName, args, botName, version) {
    const chatId = ctx.chatId;
    const token = ctx.token;
    const username = ctx.username;
    
    // Parse duration
    let duration = 3600; // Default 1 hour
    let durationText = '1 hour';
    
    const timeArg = args[1];
    if (timeArg) {
        const parsed = parseDuration(timeArg);
        if (parsed) {
            duration = parsed.seconds;
            durationText = parsed.text;
        }
    }
    
    const until = Math.floor(Date.now() / 1000) + duration;
    const reason = args.slice(timeArg ? 2 : 1).join(' ') || 'No reason provided';
    
    try {
        const data = JSON.stringify({
            chat_id: chatId,
            user_id: targetId,
            until_date: until,
            permissions: { 
                can_send_messages: false,
                can_send_media: false,
                can_send_other: false,
                can_add_web_page_previews: false
            }
        });
        
        await new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'api.telegram.org',
                path: `/bot${token}/restrictChatMember`,
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            }, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(body);
                        if (json.ok) resolve();
                        else reject(new Error(json.description));
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            req.on('error', reject);
            req.write(data);
            req.end();
        });
        
        // Save to database
        try {
            const db = ctx.client.db;
            if (db) {
                const logId = `mute_${chatId}_${targetId}_${Date.now()}`;
                db.prepare(`
                    INSERT INTO moderation_logs (id, guild_id, user_id, moderator_id, action, reason, timestamp)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(logId, `tg_${chatId}`, targetId.toString(), ctx.userId.toString(), 'mute', reason, Math.floor(Date.now() / 1000));
            }
        } catch (e) {}
        
        // Beautiful success response
        await ctx.replyWithHTML(
            `╔══════════════════════════════════╗\n` +
            `║        🔇 USER MUTED 🔇            ║\n` +
            `╚══════════════════════════════════╝\n\n` +
            `<b>👤 User:</b> ${targetName}\n` +
            `<b>🆔 ID:</b> <code>${targetId}</code>\n` +
            `<b>⏰ Duration:</b> ${durationText}\n` +
            `<b>📋 Reason:</b> ${reason}\n` +
            `<b>👮 Moderator:</b> ${username}\n` +
            `<b>🔓 Unmute:</b> <code>/unmute ${targetId}</code>\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🛡️ ${botName} • v${version}`
        );
        
    } catch (e) {
        await ctx.replyWithHTML(
            `╔══════════════════════════════════╗\n` +
            `║        ❌ MUTE FAILED ❌           ║\n` +
            `╚══════════════════════════════════╝\n\n` +
            `<b>Error:</b> ${e.message}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🛡️ ${botName} • v${version}`
        );
    }
}

// Handle unmute action
async function handleUnmute(ctx, targetId, targetName, botName, version) {
    const chatId = ctx.chatId;
    const token = ctx.token;
    const username = ctx.username;
    
    try {
        const data = JSON.stringify({
            chat_id: chatId,
            user_id: targetId,
            permissions: { 
                can_send_messages: true,
                can_send_media: true,
                can_send_other: true,
                can_add_web_page_previews: true
            }
        });
        
        await new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'api.telegram.org',
                path: `/bot${token}/restrictChatMember`,
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            }, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(body);
                        if (json.ok) resolve();
                        else reject(new Error(json.description));
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            req.on('error', reject);
            req.write(data);
            req.end();
        });
        
        // Save to database
        try {
            const db = ctx.client.db;
            if (db) {
                const logId = `unmute_${chatId}_${targetId}_${Date.now()}`;
                db.prepare(`
                    INSERT INTO moderation_logs (id, guild_id, user_id, moderator_id, action, reason, timestamp)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(logId, `tg_${chatId}`, targetId.toString(), ctx.userId.toString(), 'unmute', 'Manual unmute', Math.floor(Date.now() / 1000));
            }
        } catch (e) {}
        
        await ctx.replyWithHTML(
            `╔══════════════════════════════════╗\n` +
            `║        🔊 USER UNMUTED 🔊          ║\n` +
            `╚══════════════════════════════════╝\n\n` +
            `<b>👤 User:</b> ${targetName}\n` +
            `<b>🆔 ID:</b> <code>${targetId}</code>\n` +
            `<b>👮 Moderator:</b> ${username}\n` +
            `<b>✅ Status:</b> Can now send messages\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🛡️ ${botName} • v${version}`
        );
        
    } catch (e) {
        await ctx.replyWithHTML(
            `╔══════════════════════════════════╗\n` +
            `║        ❌ UNMUTE FAILED ❌         ║\n` +
            `╚══════════════════════════════════╝\n\n` +
            `<b>Error:</b> ${e.message}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🛡️ ${botName} • v${version}`
        );
    }
}

// Show help menu
async function showHelp(ctx, botName, version) {
    await ctx.replyWithHTML(
        `╔══════════════════════════════════╗\n` +
        `║      🔇 MUTE/UNMUTE SYSTEM 🔇      ║\n` +
        `╚══════════════════════════════════╝\n\n` +
        `<b>📋 MUTE COMMANDS:</b>\n` +
        `<code>/mute @user [time] [reason]</code>\n` +
        `<code>/mute reply_to_msg [time]</code>\n\n` +
        `<b>📋 UNMUTE COMMANDS:</b>\n` +
        `<code>/unmute @user</code>\n` +
        `<code>/unmute reply_to_msg</code>\n` +
        `<code>/unmute 5076150691</code>\n\n` +
        `<b>⏰ TIME FORMATS:</b>\n` +
        `<code>10m</code> • 10 minutes\n` +
        `<code>2h</code> • 2 hours\n` +
        `<code>1d</code> • 1 day\n` +
        `<code>30s</code> • 30 seconds\n\n` +
        `<b>📝 EXAMPLES:</b>\n` +
        `<code>/mute @spammer 2h Flooding</code>\n` +
        `<code>/mute 5076150691 1d</code>\n` +
        `<code>/unmute @spammer</code>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🛡️ ${botName} • v${version}`
    );
}

// Parse duration string to seconds
function parseDuration(str) {
    const match = str.match(/^(\d+)([smhd])$/i);
    if (!match) return null;
    
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    let seconds, text;
    if (unit === 's') { seconds = value; text = `${value} second${value > 1 ? 's' : ''}`; }
    else if (unit === 'm') { seconds = value * 60; text = `${value} minute${value > 1 ? 's' : ''}`; }
    else if (unit === 'h') { seconds = value * 3600; text = `${value} hour${value > 1 ? 's' : ''}`; }
    else if (unit === 'd') { seconds = value * 86400; text = `${value} day${value > 1 ? 's' : ''}`; }
    
    return { seconds, text };
}

// Check admin permission
async function checkAdminPermission(ctx, targetUserId = null) {
    try {
        const userId = targetUserId || ctx.userId;
        
        return new Promise((resolve) => {
            const req = https.request({
                hostname: 'api.telegram.org',
                path: `/bot${ctx.token}/getChatMember?chat_id=${ctx.chatId}&user_id=${userId}`,
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

// Parse target user from mention/reply/ID
async function parseTargetUser(ctx, arg) {
    const message = ctx.message;
    
    // Check reply
    if (message.reply_to_message) {
        return message.reply_to_message.from;
    }
    
    // Check mention entities
    if (message.entities) {
        for (const entity of message.entities) {
            if (entity.type === 'text_mention') {
                return entity.user;
            }
            if (entity.type === 'mention') {
                const mention = message.text.substring(entity.offset, entity.offset + entity.length);
                return { id: mention.replace('@', ''), username: mention, first_name: mention };
            }
        }
    }
    
    // Check ID
    if (arg && /^\d+$/.test(arg)) {
        return { id: parseInt(arg), first_name: `User ${arg}` };
    }
    
    return null;
}