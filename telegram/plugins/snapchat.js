const { grab } = require('./_media.js');
const { tr } = require('../lang/media');

module.exports = {
    name: 'snapchat',
    aliases: ['snap', 'sc', 'snp'],
    description: 'Download a Snapchat Spotlight video',
    category: 'Media',
    usage: '/snap <link>',

    handler: async (ctx) => {
        const T = tr(ctx);
        const url = String(ctx.args[0] || '');
        if (!url) return ctx.replyHTML(T('usage', { cmd: '/snap', example: '/snap https://www.snapchat.com/spotlight/…' }));
        if (!/snapchat\.com\/spotlight\//.test(url)) return ctx.replyHTML(T('wrong_site', { site: 'Snapchat' }));
        return grab(ctx, url, 'Snapchat', '1080');
    },
};
