const { getStreamUrl } = require('./_media.js');

module.exports = {
    name: 'facebook',
    aliases: ['fb', 'fbdl'],
    description: 'Download Facebook videos',
    category: 'Media',
    usage: '/fb <url>',

    handler: async (ctx) => {
        const url = ctx.args[0];
        if (!url || !url.includes('facebook'))
            return ctx.replyHTML(`📘 <b>Facebook Downloader</b>\n\n<code>/fb &lt;facebook video url&gt;</code>`);

        await ctx.action('upload_video');
        await ctx.replyHTML(`📘 <i>Grabbing from Facebook...</i>`);

        try {
            const streamUrl = await getStreamUrl(url);
            await ctx.sendVideo(streamUrl, {
                caption: `📘 <b>Facebook</b>\n\n🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`,
                parse_mode: 'HTML'
            });
        } catch(e) {
            console.error('[FB]', e.message);
            await ctx.replyHTML(`❌ Couldn\'t get that — public videos only, private ones need login!`);
        }
    }
};
