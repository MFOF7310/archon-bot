const { grab } = require('./_media.js');
const { tr } = require('../lang/media');

module.exports = {
    name: 'twitter',
    aliases: ['tw', 'xdl', 'tweet'],
    description: 'Download a video from X (Twitter)',
    category: 'Media',
    usage: '/tw <link>',

    handler: async (ctx) => {
        const T = tr(ctx);
        const url = String(ctx.args[0] || '');
        if (!url) return ctx.replyHTML(T('usage', { cmd: '/tw', example: '/tw https://x.com/…/status/…' }));
        if (!/(twitter\.com|x\.com)\//.test(url)) return ctx.replyHTML(T('wrong_site', { site: 'X' }));
        return grab(ctx, url.replace(/\/\/(www\.)?x\.com\//, '//twitter.com/'), 'X', '720');
    },
};
