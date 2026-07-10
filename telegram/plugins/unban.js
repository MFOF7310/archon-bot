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
    name: 'unban',
    aliases: ['pardon'],
    description: 'Unban a user',
    category: 'Moderation',
    usage: '/unban <user_id>',
    adminOnly: true,

    handler: async (ctx) => {
        if (!ctx.isGroup) return ctx.replyHTML(ctx.t('groups_only', {}));
        if (!await ctx.isAdmin()) return ctx.replyHTML(ctx.t('admin_only', {}));

        const userId = ctx.args[0];
        if (!userId || isNaN(userId)) return ctx.replyHTML(`💡 Usage: <code>/unban &lt;user_id&gt;</code>`);

        const result = await tgApi(ctx.bridge.token, 'unbanChatMember', { chat_id: ctx.chatId, user_id: parseInt(userId), only_if_banned: true });
        if (!result.ok) return ctx.replyHTML(`❌ Couldn\'t unban — they might not be banned!`);

        await ctx.replyHTML(`${ctx.t('unban_success', {})}

🦅 ARCHON CG-223`);
    }
};
