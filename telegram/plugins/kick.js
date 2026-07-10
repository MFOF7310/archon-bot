const https = require('https');

function escapeHTML(s) { return !s || typeof s !== 'string' ? '' : s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

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
    usage: '/kick',
    adminOnly: true,

    handler: async (ctx) => {
        if (!ctx.isGroup) return ctx.replyHTML(ctx.t('groups_only', {}));
        if (!await ctx.isAdmin()) return ctx.replyHTML(ctx.t('admin_only', {}));

        const reply = ctx.message?.reply_to_message;
        const target = reply?.from;
        if (!target) return ctx.replyHTML(ctx.t('kick_no_reply', {}));
        if (target.is_bot) return ctx.replyHTML(`🤖 Can\'t kick bots this way!`);

        const reason = ctx.args.join(' ') || 'No reason given';
        const ban = await tgApi(ctx.bridge.token, 'banChatMember', { chat_id: ctx.chatId, user_id: target.id });
        if (!ban.ok) return ctx.replyHTML(ctx.t('kick_failed', {}));

        await tgApi(ctx.bridge.token, 'unbanChatMember', { chat_id: ctx.chatId, user_id: target.id, only_if_banned: true });

        const name = escapeHTML(target.first_name || target.username || 'User');
        await ctx.replyHTML(
            `${ctx.t('kick_success', { name })}
` +
            `📝 ${escapeHTML(reason)}

🦅 ARCHON CG-223`
        );
    }
};
