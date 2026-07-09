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
    name: 'tagall',
    aliases: ['mentionall', 'everyone'],
    description: 'Tag all admins',
    category: 'Moderation',
    usage: '/tagall [message]',
    adminOnly: true,

    handler: async (ctx) => {
        if (!ctx.isGroup) return ctx.replyHTML(`⚠️ Groups only!`);
        if (!await ctx.isAdmin()) return ctx.replyHTML(`⛔ Admins only.`);

        await ctx.action('typing');
        const result = await tgApi(ctx.bridge.token, 'getChatAdministrators', { chat_id: ctx.chatId });
        if (!result.ok) return ctx.replyHTML(`❌ Couldn\'t fetch members!`);

        const msg = ctx.args.join(' ') || '📢 Attention everyone!';
        const admins = result.result.filter(a => !a.user.is_bot);

        let text = `📢 <b>${msg}</b>\n\n`;
        admins.forEach(a => {
            text += `• <a href="tg://user?id=${a.user.id}">${a.user.first_name}</a>\n`;
        });
        text += `\n🦅 ARCHON CG-223`;

        await ctx.replyHTML(text);
    }
};
