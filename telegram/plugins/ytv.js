const { getStreamUrl, getInfo, dlFile } = require('./_media.js');

module.exports = {
    name: 'ytv',
    aliases: ['ytvideo', 'ydl', 'yv'],
    description: 'Download YouTube video (720p)',
    category: 'Media',
    usage: '/ytv <url>',

    handler: async (ctx) => {
        const url = ctx.args[0];
        if (!url || (!url.includes('youtube') && !url.includes('youtu.be')))
            return ctx.replyHTML(`🎬 <b>YouTube Video</b>\n\n<code>/ytv &lt;url&gt;</code>\n\n720p quality, max 50MB`);

        await ctx.action('upload_video');
        const proc = await ctx.replyHTML(`🎬 <i>Fetching that YouTube video...</i>`);

        try {
            const [info, streamUrl] = await Promise.all([getInfo(url), getStreamUrl(url)]);
            const caption = `🎬 <b>${(info.title || 'YouTube Video').substring(0, 80)}</b>\n👤 ${info.uploader || ''} • ⏱ ${info.duration || ''}\n\n🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`;

            try {
                await ctx.sendVideo(streamUrl, { caption, parse_mode: 'HTML' });
            } catch {
                await ctx.sendDoc(streamUrl, { caption, parse_mode: 'HTML' });
            }
        } catch(e) {
            console.error('[YTV]', e.message);
            await ctx.replyHTML(`❌ YouTube\'s being tricky right now — try again in a bit, or use a different link!`);
        }
    }
};
