const { getStreamUrl, getInfo } = require('./_media.js');

module.exports = {
    name: 'instagram',
    aliases: ['ig', 'insta', 'reel'],
    description: 'Download Instagram reels & posts',
    category: 'Media',
    usage: '/ig <url>',

    handler: async (ctx) => {
        const url = ctx.args[0];
        if (!url || !url.includes('instagram'))
            return ctx.replyHTML(`📸 <b>Instagram Downloader</b>\n\n<code>/ig &lt;instagram url&gt;</code>\n\nWorks with reels and public posts!`);

        await ctx.action('upload_video');
        await ctx.replyHTML(`📸 <i>Grabbing that from Instagram...</i>`);

        try {
            const streamUrl = await getStreamUrl(url);
            await ctx.sendVideo(streamUrl, {
                caption: `📸 <b>Instagram</b>\n\n🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`,
                parse_mode: 'HTML'
            });
        } catch(e) {
            console.error('[IG]', e.message);
            await ctx.replyHTML(`❌ Couldn\'t grab that — private account? Public reels and posts work best!`);
        }
    }
};
