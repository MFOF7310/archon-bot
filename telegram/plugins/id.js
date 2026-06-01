// ═══════════════════════════════════════════
//  TG COMMAND: ID Lookup
// ═══════════════════════════════════════════

module.exports = {
    name: 'id',
    description: 'Show chat and user ID',
    category: 'Utility',
    aliases: ['chatid', 'myid', 'whoami'],

    handler: async (ctx) => {
        const replyTo = ctx.message.reply_to_message;
        if (replyTo) {
            const t = replyTo.from;
            return ctx.replyHTML(
                `👤 <b>User Info</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
                `Name: <b>${t.first_name || 'N/A'}</b>\n` +
                `Username: @${t.username || 'N/A'}\n` +
                `ID: <code>${t.id}</code>\n` +
                `Bot: ${t.is_bot ? 'Yes' : 'No'}`
            );
        }

        await ctx.replyHTML(
            `╔═════ IDENTIFICATION ═════╗\n` +
            `📡 <b>CHAT ID:</b> <code>${ctx.chatId}</code>\n` +
            `👤 <b>USER ID:</b> <code>${ctx.userId}</code>\n` +
            `📁 <b>TYPE:</b> <code>${ctx.chatType}</code>\n` +
            `╚══════════════════════════╝`
        );
    }
};
