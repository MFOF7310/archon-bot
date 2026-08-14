const { dlVideo } = require('./_media.js');
const fs = require('fs');

module.exports = {
    name: 'snapchat',
    aliases: ['snap', 'sc', 'snp'],
    description: 'Download Snapchat Spotlight videos',
    category: 'Media',
    usage: '/snap <url>',

    handler: async (ctx) => {
        const url = ctx.args[0];

        if (!url || !url.includes('snapchat.com'))
            return ctx.replyHTML(
                `👻 Send me a Snapchat Spotlight link and I'll grab it!\n\n` +
                `<code>/snap &lt;url&gt;</code>\n\n` +
                `✅ Works with <b>Spotlight</b> videos only\n` +
                `❌ Stories, add-friend and short links are not supported`
            );

        // Reject non-spotlight URLs early
        if (!url.includes('/spotlight/')) {
            return ctx.replyHTML(
                `❌ <b>Unsupported link type</b>\n\n` +
                `Only <b>Spotlight</b> videos are supported.\n` +
                `Share a Spotlight video from Snapchat and try again! 👻`
            );
        }

        await ctx.action('upload_video');

        try {
            const filePath = await dlVideo(url, '1080');
            const buf = fs.readFileSync(filePath);
            const mb = (buf.length / 1024 / 1024).toFixed(1);

            await ctx.sendVideoBuffer(buf, {
                caption: `👻 Here you go! ${mb}MB\n\n🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`,
                parse_mode: 'HTML'
            });
        } catch(e) {
            console.error('[SNAP]', e.message);
            await ctx.replyHTML(`❌ Couldn't download that Spotlight — it may have expired or been removed.`);
        }
    }
};
