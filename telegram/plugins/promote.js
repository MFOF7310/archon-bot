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
    name: 'promote',
    aliases: ['makeadmin'],
    description: 'Promote a user to admin',
    category: 'Moderation',
    usage: '/promote',
    adminOnly: true,

    handler: async (ctx) => {
        if (!ctx.isGroup) return ctx.replyHTML(`⚠️ Groups only!`);
        if (!await ctx.isAdmin()) return ctx.replyHTML(`⛔ Admins only.`);

        const reply = ctx.message?.reply_to_message;
        if (!reply) return ctx.replyHTML(`💡 Reply to someone\'s message and use /promote.`);
        const target = reply.from;

        const result = await tgApi(ctx.bridge.token, 'promoteChatMember', {
            chat_id: ctx.chatId,
            user_id: target.id,
            can_manage_chat: true,
            can_delete_messages: true,
            can_restrict_members: true,
            can_pin_messages: true,
            can_promote_members: false,
        });

        if (!result.ok) return ctx.replyHTML(`❌ Couldn\'t promote — I need to be owner or have promote rights!`);
        await ctx.replyHTML(`⭐ <b>${escapeHTML(target.first_name)}</b> has been promoted to admin!\n\n🦅 ARCHON CG-223`);
    }
};
