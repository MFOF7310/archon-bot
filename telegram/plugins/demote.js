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
    name: 'demote',
    aliases: ['removeadmin'],
    description: 'Demote an admin to member',
    category: 'Moderation',
    usage: '/demote',
    adminOnly: true,

    handler: async (ctx) => {
        if (!ctx.isGroup) return ctx.replyHTML(`⚠️ Groups only!`);
        if (!await ctx.isAdmin()) return ctx.replyHTML(`⛔ Admins only.`);

        const reply = ctx.message?.reply_to_message;
        if (!reply) return ctx.replyHTML(`💡 Reply to an admin\'s message and use /demote.`);
        const target = reply.from;

        const result = await tgApi(ctx.bridge.token, 'promoteChatMember', {
            chat_id: ctx.chatId,
            user_id: target.id,
            can_manage_chat: false,
            can_delete_messages: false,
            can_restrict_members: false,
            can_pin_messages: false,
        });

        if (!result.ok) return ctx.replyHTML(`❌ Couldn\'t demote — check my permissions!`);
        await ctx.replyHTML(`🔽 <b>${escapeHTML(target.first_name)}</b> has been demoted.\n\n🦅 ARCHON CG-223`);
    }
};
