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
    name: 'groupinfo',
    aliases: ['ginfo', 'chatinfo'],
    description: 'Show group information',
    category: 'Moderation',
    usage: '/groupinfo',

    handler: async (ctx) => {
        if (!ctx.isGroup) return ctx.replyHTML(`⚠️ Groups only!`);
        await ctx.action('typing');

        const [chat, count] = await Promise.all([
            tgApi(ctx.bridge.token, 'getChat', { chat_id: ctx.chatId }),
            tgApi(ctx.bridge.token, 'getChatMemberCount', { chat_id: ctx.chatId })
        ]);

        if (!chat.ok) return ctx.replyHTML(`❌ Couldn\'t fetch group info!`);
        const g = chat.result;

        const msg = [
            `🏠 <b>Group Info</b>`,
            `━━━━━━━━━━━━━━━━`,
            `📛 <b>Name:</b> ${escapeHTML(g.title)}`,
            g.username ? `🔗 <b>Username:</b> @${g.username}` : '',
            `🆔 <b>ID:</b> <code>${ctx.chatId}</code>`,
            `👥 <b>Members:</b> ${count.result || '?'}`,
            g.description ? `📝 <b>Description:</b> ${escapeHTML(g.description.substring(0,100))}` : '',
            g.invite_link ? `🔗 <b>Invite:</b> ${g.invite_link}` : '',
            ``,
            `🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`
        ].filter(Boolean).join('\n');

        await ctx.replyHTML(msg);
    }
};
