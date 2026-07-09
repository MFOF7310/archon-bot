const https = require('https');

function escapeHTML(t) { return !t || typeof t !== 'string' ? '' : t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function tgApi(token, method, params) {
    return new Promise((res) => {
        const qs = new URLSearchParams(params).toString();
        const req = https.request(`https://api.telegram.org/bot${token}/${method}?${qs}`,
            { method: 'GET', timeout: 10000 },
            (r) => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>{ try{res(JSON.parse(d));}catch{res({ok:false});} }); }
        );
        req.on('error',()=>res({ok:false})); req.end();
    });
}

module.exports = {
    name: 'admins',
    aliases: ['admin', 'adminlist'],
    description: 'List all group admins',
    category: 'Moderation',
    usage: '/admins',

    handler: async (ctx) => {
        if (!ctx.isGroup) return ctx.replyHTML(`⚠️ Groups only!`);
        await ctx.action('typing');

        const result = await tgApi(ctx.bridge.token, 'getChatAdministrators', { chat_id: ctx.chatId });
        if (!result.ok) return ctx.replyHTML(`❌ Couldn\'t fetch admin list!`);

        const admins = result.result.filter(a => !a.user.is_bot);
        const creator = admins.find(a => a.status === 'creator');
        const others = admins.filter(a => a.status !== 'creator');

        let msg = `👑 <b>Group Admins</b>\n━━━━━━━━━━━━━━━━\n\n`;
        if (creator) msg += `🌟 <b>${escapeHTML(creator.user.first_name)}</b> — Owner\n`;
        others.forEach(a => {
            const title = a.custom_title ? ` · ${escapeHTML(a.custom_title)}` : '';
            msg += `⚡ <b>${escapeHTML(a.user.first_name)}</b>${title}\n`;
        });
        msg += `\n👥 ${admins.length} admin${admins.length !== 1 ? 's' : ''} total\n\n🦅 ARCHON CG-223`;

        await ctx.replyHTML(msg);
    }
};
