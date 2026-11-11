// /mention message (reply) — pings the author of the replied message. Whole-group pings are /tagall (admins only).
const { target, link, esc } = require('../mod');
const { tr } = require('../lang/mod');

module.exports = {
    name: 'mention', aliases: ['tag', 'notify'], description: 'Ping someone by replying to them', category: 'Utility',
    usage: '/mention <message> (reply)',
    handler: async (ctx) => {
        const t = tr(ctx);
        const who = ctx.message?.reply_to_message ? target(ctx) : null;
        if (!who || who.bot) return ctx.replyHTML(t('mention_help'));
        const text = ctx.args.join(' ').trim().slice(0, 500) || '👋';
        return ctx.replyHTML(t('mentioned', { who_html: link(who), text }));
    },
};
