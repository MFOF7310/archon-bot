const { dlVideo } = require('./_media.js');
const fs = require('fs');

module.exports = {
    name: 'snapchat',
    aliases: ['snap', 'sc', 'snp'],
    description: 'Download Snapchat stories & spotlights',
    category: 'Media',
    usage: '/snap <url>',

    handler: async (ctx) => {
        const url = ctx.args[0];

        if (!url || !url.includes('snapchat.com'))
            return ctx.replyHTML(
                `👻 Just send me a Snapchat link and I'll grab it!\n\n` +
                `<code>/snap &lt;url&gt;</code>\n\n` +
                `Works with stories, spotlights and public snaps 🎬`
            );

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
            await ctx.replyHTML(`❌ Couldn't grab that one — it might be private or already expired!`);
        }
    }
};
