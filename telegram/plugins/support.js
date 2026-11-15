// telegram/plugins/support.js — answer a support request from the website (owner only).
//   /reply <number> <your answer>     e.g. /reply K7Q2MZ Yes, Orange Money works: ...
// The answer shows in the site's chat when the visitor comes back, and in their Discord DMs when they were signed in.
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

module.exports = {
    name: 'reply',
    aliases: ['sreply', 'support'],
    description: 'Answer a support request from the website (owner only)',
    category: 'System',
    usage: '/reply <number> <answer>',
    ownerOnly: true,
    handler: async (ctx) => {
        if (!ctx.isOwner()) return ctx.replyHTML('⛔ Owner only.');
        const raw = String(ctx.text || '').replace(/^\/\S+\s*/, '');
        const m = /^#?([A-Za-z0-9]{6})\s+([\s\S]+)$/.exec(raw.trim());
        if (!m) return ctx.replyHTML('Write it like this: <code>/reply K7Q2MZ your answer</code>\nThe number is in the request.');
        const client = ctx.client || global.client;
        if (!client?.db) return ctx.replyHTML('The Discord side is not ready yet. Try again in a moment.');
        const S = require('../../lib/support-tickets');
        const r = await S.reply(client, m[1].toUpperCase(), m[2]).catch((e) => ({ ok: false, error: e.message }));
        return ctx.replyHTML(esc(S.replyNote(r)));
    },
};
