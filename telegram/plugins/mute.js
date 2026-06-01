// ═══════════════════════════════════════════
//  TG COMMAND: Mute / Unmute
// ═══════════════════════════════════════════

function escapeHTML(t) { return !t || typeof t !== 'string' ? '' : t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function parseDuration(str) {
    if (!str) return null;
    const m = str.match(/^(\d+)([smhd])$/i);
    if (!m) return null;
    const val = parseInt(m[1]);
    const unit = m[2].toLowerCase();
    const mult = { s: 1, m: 60, h: 3600, d: 86400 };
    return { seconds: val * (mult[unit] || 1), text: `${val} ${unit === 's' ? 'sec' : unit === 'm' ? 'min' : unit === 'h' ? 'hour' : 'day'}${val > 1 ? 's' : ''}` };
}

module.exports = {
    name: 'mute',
    description: 'Mute/unmute a user in the group',
    category: 'Moderation',
    usage: '/mute @user [duration] [reason]',
    aliases: ['unmute', 'silence'],
    adminOnly: true,

    handler: async (ctx) => {
        const args = ctx.args;
        const cmd = ctx.message.text?.split(' ')[0]?.toLowerCase() || '/mute';
        const isUnmute = cmd.includes('unmute');

        if (!ctx.isGroup && !ctx.isChannel) return ctx.replyHTML(`❌ Groups only.`);

        // Get target
        let target = null;
        if (ctx.message.reply_to_message) target = ctx.message.reply_to_message.from;
        else if (args[0] && /^\d+$/.test(args[0])) target = { id: parseInt(args[0]), first_name: `User ${args[0]}` };
        else if (args[0]) target = { id: args[0].replace('@', ''), first_name: args[0], username: args[0].replace('@', '') };

        if (!target) {
            return ctx.replyHTML(
                `🔇 <b>Mute System</b>\n\n` +
                `<b>Mute:</b> <code>/mute @user 2h spam</code>\n` +
                `<b>Unmute:</b> <code>/unmute @user</code>\n` +
                `Reply to a message to target that user.`
            );
        }

        const targetId = target.id;
        const targetName = escapeHTML(target.first_name || target.username || 'User');

        if (isUnmute) {
            await ctx.bridge._sendMedia(ctx.chatId, 'restrictChatMember', {
                user_id: targetId,
                permissions: {
                    can_send_messages: true, can_send_media_messages: true,
                    can_send_other_messages: true, can_add_web_page_previews: true,
                }
            });
            return ctx.replyHTML(`🔊 <b>UNMUTED</b>\n━━━━━━━━━━━━━━━━━━━━\n\n👤 ${targetName}\n🆔 <code>${targetId}</code>`);
        }

        const parsed = parseDuration(args[0]?.startsWith('@') ? args[1] : args[0]);
        const duration = parsed?.seconds || 3600;
        const durationText = parsed?.text || '1 hour';
        const reason = args.slice(parsed ? (args[0].startsWith('@') ? 2 : 1) : 0).join(' ') || 'No reason';
        const until = Math.floor(Date.now() / 1000) + Math.min(duration, 604800);

        await ctx.bridge._sendMedia(ctx.chatId, 'restrictChatMember', {
            user_id: targetId,
            permissions: {
                can_send_messages: false, can_send_media_messages: false,
                can_send_other_messages: false, can_add_web_page_previews: false,
            },
            until_date: until,
        });

        ctx.replyHTML(
            `🔇 <b>USER MUTED</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
            `👤 ${targetName}\n` +
            `🆔 <code>${targetId}</code>\n` +
            `⏰ Duration: ${durationText}\n` +
            `📋 Reason: ${escapeHTML(reason)}\n\n` +
            `<code>/unmute ${targetId}</code> to restore`
        );
    }
};
