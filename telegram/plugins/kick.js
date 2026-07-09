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
    name: 'kick',
    aliases: ['remove'],
    description: 'Kick a user from the group',
    category: 'Moderation',
    usage: '/kick @user [reason]',
    adminOnly: true,

    handler: async (ctx) => {
        if (!ctx.isGroup) return ctx.replyHTML(`⚠️ This command only works in groups!`);
        if (!await ctx.isAdmin()) return ctx.replyHTML(`⛔ You need to be an admin to kick people.`);

        const reply = ctx.message?.reply_to_message;
        const target = reply?.from;
        if (!target) return ctx.replyHTML(`💡 Reply to someone\'s message and use /kick to remove them.`);
        if (target.is_bot) return ctx.replyHTML(`🤖 Can\'t kick bots this way — remove them from the member list.`);

        const reason = ctx.args.join(' ') || 'No reason given';
        const token = ctx.bridge.token;

        // Ban then immediately unban = kick
        const ban = await tgApi(token, 'banChatMember', { chat_id: ctx.chatId, user_id: target.id });
        if (!ban.ok) return ctx.replyHTML(`❌ Couldn\'t kick ${escapeHTML(target.first_name)} — make sure I have admin rights!`);

        await tgApi(token, 'unbanChatMember', { chat_id: ctx.chatId, user_id: target.id, only_if_banned: true });

        await ctx.replyHTML(`👢 <b>${escapeHTML(target.first_name)}</b> has been kicked.\n📝 Reason: ${escapeHTML(reason)}\n\n🦅 ARCHON CG-223`);
    }
};
