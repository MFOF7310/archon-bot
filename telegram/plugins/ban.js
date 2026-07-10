const https = require('https');
const { t } = require('../lang/index.js');

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
    name: 'ban',
    aliases: ['block'],
    description: 'Ban a user from the group',
    category: 'Moderation',
    usage: '/ban',
    adminOnly: true,

    handler: async (ctx) => {
        const lang = ctx.message?.from?.language_code || 'en';
        if (!ctx.isGroup) return ctx.replyHTML(t(lang, 'groups_only'));
        if (!await ctx.isAdmin()) return ctx.replyHTML(t(lang, 'admin_only'));

        const reply = ctx.message?.reply_to_message;
        const target = reply?.from;
        if (!target) return ctx.replyHTML(`💡 Reply to someone\'s message to ban them.`);

        const reason = ctx.args.join(' ') || 'No reason given';
        const result = await tgApi(ctx.bridge.token, 'banChatMember', { chat_id: ctx.chatId, user_id: target.id });

        const name = escapeHTML(target.first_name || target.username || 'User');
        if (!result.ok) return ctx.replyHTML(t(lang, 'ban_failed'));

        await ctx.replyHTML(
            `${t(lang, 'ban_success', { name })}
` +
            `📝 ${escapeHTML(reason)}

🦅 ARCHON CG-223`
        );
    }
};
