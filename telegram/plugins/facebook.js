const { dlVideo, getInfo } = require('./_media.js');
const fs = require('fs');

module.exports = {
    name: 'facebook',
    aliases: ['fb', 'fbdl'],
    description: 'Download Facebook videos',
    category: 'Media',
    usage: '/fb <url>',

    handler: async (ctx) => {
        const url = ctx.args[0];
        if (!url || !url.includes('facebook'))
            return ctx.replyHTML(`📘 <b>Facebook Downloader</b>\n\nSend me a Facebook video link!\n\n<code>/fb &lt;url&gt;</code>`);

        await ctx.action('upload_video');
        const proc = await ctx.replyHTML(`📘 <i>Grabbing from Facebook...</i>`);

        try {
            const [info, filePath] = await Promise.all([
                getInfo(url).catch(() => ({})),
                dlVideo(url, '720')
            ]);

            const buf = fs.readFileSync(filePath);
            const caption = [
                info.title ? `📘 ${info.title.substring(0, 100)}` : `📘 <b>Facebook</b>`,
                info.uploader ? `👤 ${info.uploader}` : '',
                info.description ? `\n${info.description.substring(0, 100)}` : '',
                `🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`
            ].filter(Boolean).join('\n');

            await ctx.bridge.deleteMessage(ctx.chatId, proc?.data?.message_id).catch(() => {});
            await ctx.sendVideoBuffer(buf, { caption, parse_mode: 'HTML' });

        } catch(e) {
            console.error('[FB]', e.message);
            await ctx.replyHTML(`❌ Couldn\'t get that — public videos only!`);
        }
    }
};
