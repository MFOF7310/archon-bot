const { getStreamUrl, getInfo } = require('./_media.js');

module.exports = {
    name: 'yta',
    aliases: ['ytaudio', 'ytmp3', 'ya'],
    description: 'Get YouTube audio',
    category: 'Media',
    usage: '/yta <url>',

    handler: async (ctx) => {
        const url = ctx.args[0];
        if (!url || (!url.includes('youtube') && !url.includes('youtu.be')))
            return ctx.replyHTML(`🎵 <b>YouTube Audio</b>\n\n<code>/yta &lt;url&gt;</code>\n\nBest quality audio!`);

        await ctx.action('upload_audio');
        const proc = await ctx.replyHTML(`🎵 <i>Extracting audio...</i>`);

        try {
            const [info, streamUrl] = await Promise.all([getInfo(url), getStreamUrl(url, true)]);
            const caption = `🎵 <b>${(info.title || 'Audio').substring(0, 80)}</b>\n👤 ${info.uploader || ''}\n\n🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`;

            try {
                await ctx.sendAudio(streamUrl, { caption, title: info.title?.substring(0, 64), performer: info.uploader, parse_mode: 'HTML' });
            } catch {
                await ctx.sendDoc(streamUrl, { caption, parse_mode: 'HTML' });
            }
        } catch(e) {
            console.error('[YTA]', e.message);
            await ctx.replyHTML(`❌ Couldn\'t extract audio — might be age-restricted. Try another link!`);
        }
    }
};
