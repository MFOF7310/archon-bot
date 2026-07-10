const { dlVideo, getInfo } = require('./_media.js');
const fs = require('fs');

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
        const proc = await ctx.replyHTML(ctx.t('media_fetching_video', {}));

        try {
            const [info, filePath] = await Promise.all([
                getInfo(url).catch(() => ({})),
                dlVideo(url, '720')
            ]);
            const buf = fs.readFileSync(filePath);
            const caption = [
                info.title ? `🎬 <b>${info.title.substring(0, 80)}</b>` : `🎬 <b>YouTube Video</b>`,
                info.uploader ? `👤 ${info.uploader}` : '',
                info.duration ? `⏱ ${info.duration}` : '',
                `\n🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`
            ].filter(Boolean).join('\n');
            await ctx.bridge.deleteMessage(ctx.chatId, proc?.data?.message_id).catch(() => {});
            await ctx.sendVideoBuffer(buf, { caption, parse_mode: 'HTML' });
        } catch(e) {
            console.error('[YTV]', e.message);
            await ctx.replyHTML(ctx.t('media_failed_yt', {}));
        }
    }
};
