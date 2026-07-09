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
    name: 'unpin',
    aliases: ['unpinmsg'],
    description: 'Unpin the pinned message',
    category: 'Moderation',
    usage: '/unpin',
    adminOnly: true,

    handler: async (ctx) => {
        if (!ctx.isGroup) return ctx.replyHTML(`⚠️ Groups only!`);
        if (!await ctx.isAdmin()) return ctx.replyHTML(`⛔ Admins only.`);

        const result = await tgApi(ctx.bridge.token, 'unpinChatMessage', { chat_id: ctx.chatId });
        if (!result.ok) return ctx.replyHTML(`❌ Couldn\'t unpin — check my permissions!`);
        await ctx.replyHTML(`📌 Message unpinned.\n\n🦅 ARCHON CG-223`);
    }
};
