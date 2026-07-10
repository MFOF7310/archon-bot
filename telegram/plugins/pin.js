const https = require('https');

function tgApi(token, method, params) {
    return new Promise((res) => {
        const body = JSON.stringify(params);
        const req = https.request(`https://api.telegram.org/bot${token}/${method}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 10000 },
            (r) => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>{ try{res(JSON.parse(d));}catch{res({ok:false});} }); }
        );
        req.on('error',()=>res({ok:false})); req.write(body); req.end();
    });
}

module.exports = {
    name: 'pin',
    aliases: ['pinmsg'],
    description: 'Pin a message',
    category: 'Moderation',
    usage: '/pin [silent]',
    adminOnly: true,

    handler: async (ctx) => {
        if (!ctx.isGroup) return ctx.replyHTML(ctx.t('groups_only', {}));
        if (!await ctx.isAdmin()) return ctx.replyHTML(ctx.t('admin_only', {}));

        const reply = ctx.message?.reply_to_message;
        if (!reply) return ctx.replyHTML(`💡 Reply to a message and use /pin to pin it.`);

        const silent = ctx.args[0]?.toLowerCase() === 'silent';
        const result = await tgApi(ctx.bridge.token, 'pinChatMessage', {
            chat_id: ctx.chatId, message_id: reply.message_id, disable_notification: silent
        });

        if (!result.ok) return ctx.replyHTML(ctx.t('pin_failed', {}));
        await ctx.replyHTML(`${ctx.t('pin_success', {})}${silent ? ' 🤫' : ''}

🦅 ARCHON CG-223`);
    }
};
