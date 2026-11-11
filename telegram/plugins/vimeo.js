const { grab } = require('./_media.js');
const { tr } = require('../lang/media');

module.exports = {
    name: 'vimeo',
    aliases: ['vm'],
    description: 'Download a Vimeo video',
    category: 'Media',
    usage: '/vimeo <link>',

    handler: async (ctx) => {
        const T = tr(ctx);
        const url = String(ctx.args[0] || '');
        if (!url) return ctx.replyHTML(T('usage', { cmd: '/vimeo', example: '/vimeo https://vimeo.com/…' }));
        if (!/vimeo\.com\//.test(url)) return ctx.replyHTML(T('wrong_site', { site: 'Vimeo' }));
        return grab(ctx, url, 'Vimeo', '720');
    },
};
