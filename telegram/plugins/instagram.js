const { dlVideo, getInfo } = require('./_media.js');
const { t } = require('../lang/index.js');
const fs = require('fs');

module.exports = {
    name: 'instagram',
    aliases: ['ig', 'insta', 'reel'],
    description: 'Download Instagram reels & posts',
    category: 'Media',
    usage: '/ig <url>',

    handler: async (ctx) => {
        const lang = ctx.message?.from?.language_code || 'en';
        const userId = ctx.userId;
        const url = ctx.args[0];
        if (!url || !url.includes('instagram'))
            return ctx.replyHTML(`📸 <b>Instagram Downloader</b>\n\nJust send me an Instagram reel or post link!\n\n<code>/ig &lt;url&gt;</code>`);

        await ctx.action('upload_video');
        const proc = await ctx.replyHTML(t(lang, 'media_fetching_ig', {}, userId));

        try {
            const [info, filePath] = await Promise.all([
                getInfo(url).catch(() => ({})),
                dlVideo(url, '720')
            ]);
            const buf = fs.readFileSync(filePath);
            const caption = [
                info.title ? `📸 ${info.title.substring(0, 100)}` : `📸 <b>Instagram</b>`,
                info.uploader ? `👤 @${info.uploader}` : '',
                info.description ? `\n${info.description.substring(0, 100)}` : '',
                `\n🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`
            ].filter(Boolean).join('\n');
            await ctx.bridge.deleteMessage(ctx.chatId, proc?.data?.message_id).catch(() => {});
            await ctx.sendVideoBuffer(buf, { caption, parse_mode: 'HTML' });
        } catch(e) {
            console.error('[IG]', e.message);
            await ctx.replyHTML(t(lang, 'media_failed_ig', {}, userId));
        }
    }
};
