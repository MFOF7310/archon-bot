const { dlVideo, getInfo } = require('./_media.js');
const fs = require('fs');

module.exports = {
    name: 'vimeo',
    aliases: ['vm', 'vimeo'],
    description: 'Download Vimeo videos',
    category: 'Media',
    usage: '/vimeo <url>',

    handler: async (ctx) => {
        const url = ctx.args[0];

        if (!url || !url.includes('vimeo.com'))
            return ctx.replyHTML(
                `🎬 Send me a Vimeo link and I'll download it!\n\n` +
                `<code>/vimeo &lt;url&gt;</code>`
            );

        await ctx.action('upload_video');

        try {
            const [info, filePath] = await Promise.all([
                getInfo(url).catch(() => ({})),
                dlVideo(url, '720')
            ]);

            const buf = fs.readFileSync(filePath);
            const mb = (buf.length / 1024 / 1024).toFixed(1);

            const caption = [
                info.title ? `🎬 <b>${info.title.substring(0, 80)}</b>` : `🎬 <b>Vimeo Video</b>`,
                info.uploader ? `👤 ${info.uploader}` : '',
                info.duration ? `⏱ ${info.duration}` : '',
                `\n🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`
            ].filter(Boolean).join('\n');

            await ctx.sendVideoBuffer(buf, { caption, parse_mode: 'HTML' });

        } catch(e) {
            console.error('[VIMEO]', e.message);
            await ctx.replyHTML(`❌ Couldn't get that — might be private or password protected!`);
        }
    }
};
