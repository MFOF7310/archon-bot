const { dlVideo, getInfo } = require('./_media.js');
const { t } = require('../lang/index.js');
const fs = require('fs');

module.exports = {
    name: 'twitter',
    aliases: ['tw', 'xdl', 'tweet'],
    description: 'Download Twitter/X videos',
    category: 'Media',
    usage: '/tw <url>',

    handler: async (ctx) => {
        const lang = ctx.message?.from?.language_code || 'en';
        const url = ctx.args[0];
        if (!url || (!url.includes('twitter') && !url.includes('x.com')))
            return ctx.replyHTML(`🐦 <b>Twitter/X Downloader</b>\n\nDrop a tweet link with a video!\n\n<code>/tw &lt;url&gt;</code>`);

        await ctx.action('upload_video');
        const proc = await ctx.replyHTML(t(lang, 'media_fetching_tw'));

        try {
            const normalizedUrl = url.replace('x.com', 'twitter.com');
            const [info, filePath] = await Promise.all([
                getInfo(normalizedUrl).catch(() => ({})),
                dlVideo(normalizedUrl, '720')
            ]);
            const buf = fs.readFileSync(filePath);
            const caption = [
                info.title ? `🐦 ${info.title.substring(0, 100)}` : `🐦 <b>Twitter/X</b>`,
                info.uploader ? `👤 @${info.uploader}` : '',
                `🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`
            ].filter(Boolean).join('\n');
            await ctx.bridge.deleteMessage(ctx.chatId, proc?.data?.message_id).catch(() => {});
            await ctx.sendVideoBuffer(buf, { caption, parse_mode: 'HTML' });
        } catch(e) {
            console.error('[TW]', e.message);
            await ctx.replyHTML(t(lang, 'media_failed_tw'));
        }
    }
};
