const { dlAudio, getInfo } = require('./_media.js');
const fs = require('fs');

module.exports = {
    name: 'yta',
    aliases: ['ytaudio', 'ytmp3', 'ya'],
    description: 'Download YouTube audio as MP3',
    category: 'Media',
    usage: '/yta <url or song name>',

    handler: async (ctx) => {
        const input = ctx.args.join(' ');
        if (!input) return ctx.replyHTML(`🎵 <b>YouTube Audio</b>\n\n<code>/yta &lt;url or song name&gt;</code>`);

        await ctx.action('upload_audio');
        const proc = await ctx.replyHTML(`🎵 <i>Extracting audio...</i>`);

        try {
            // If not a URL, search YouTube
            const isUrl = input.startsWith('http');
            const query = isUrl ? input : `ytsearch1:${input}`;

            const [info, filePath] = await Promise.all([
                getInfo(query).catch(() => ({})),
                dlAudio(query)
            ]);

            const buf = fs.readFileSync(filePath);
            const mb = (buf.length / 1024 / 1024).toFixed(1);

            const caption = [
                info.title ? `🎵 <b>${info.title.substring(0, 80)}</b>` : `🎵 <b>Audio</b>`,
                info.uploader ? `👤 ${info.uploader}` : '',
                `\n🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`
            ].filter(Boolean).join('\n');

            await ctx.bridge.deleteMessage(ctx.chatId, proc?.data?.message_id).catch(() => {});
            await ctx.sendAudioBuffer(buf, {
                caption,
                title: info.title?.substring(0, 64) || input.substring(0, 64),
                performer: info.uploader || 'ARCHON',
                parse_mode: 'HTML'
            });

        } catch(e) {
            console.error('[YTA]', e.message);
            await ctx.replyHTML(`❌ Couldn\'t get that audio — try a direct YouTube link!`);
        }
    }
};
