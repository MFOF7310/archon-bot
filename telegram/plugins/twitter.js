const { getStreamUrl } = require('./_media.js');

module.exports = {
    name: 'twitter',
    aliases: ['tw', 'xdl', 'tweet'],
    description: 'Download Twitter/X videos',
    category: 'Media',
    usage: '/tw <url>',

    handler: async (ctx) => {
        const url = ctx.args[0];
        if (!url || (!url.includes('twitter') && !url.includes('x.com')))
            return ctx.replyHTML(`🐦 <b>Twitter/X Downloader</b>\n\n<code>/tw &lt;tweet url&gt;</code>`);

        await ctx.action('upload_video');
        await ctx.replyHTML(`🐦 <i>Downloading from X...</i>`);

        try {
            const streamUrl = await getStreamUrl(url);
            await ctx.sendVideo(streamUrl, {
                caption: `🐦 <b>Twitter/X</b>\n\n🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`,
                parse_mode: 'HTML'
            });
        } catch(e) {
            console.error('[TW]', e.message);
            await ctx.replyHTML(`❌ That tweet either has no video or it\'s protected — only public tweets with video work!`);
        }
    }
};
