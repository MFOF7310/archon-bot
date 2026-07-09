const https = require('https');

function escapeHTML(t) { return !t || typeof t !== 'string' ? '' : t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

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
    name: 'ban',
    aliases: ['block'],
    description: 'Ban a user from the group',
    category: 'Moderation',
    usage: '/ban @user [reason]',
    adminOnly: true,

    handler: async (ctx) => {
        if (!ctx.isGroup) return ctx.replyHTML(`⚠️ Groups only!`);
        if (!await ctx.isAdmin()) return ctx.replyHTML(`⛔ Admins only.`);

        const reply = ctx.message?.reply_to_message;
        const target = reply?.from;
        if (!target) return ctx.replyHTML(`💡 Reply to a message and use /ban to ban that user.`);

        const reason = ctx.args.join(' ') || 'No reason given';
        const result = await tgApi(ctx.bridge.token, 'banChatMember', { chat_id: ctx.chatId, user_id: target.id });

        if (!result.ok) return ctx.replyHTML(`❌ Couldn\'t ban <b>${escapeHTML(target.first_name)}</b> — check my admin permissions!`);

        await ctx.replyHTML(`🔨 <b>${escapeHTML(target.first_name)}</b> has been banned.\n📝 Reason: ${escapeHTML(reason)}\n\n🦅 ARCHON CG-223`);
    }
};
