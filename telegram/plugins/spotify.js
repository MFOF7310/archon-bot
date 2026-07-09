module.exports = {
    name: 'spotify',
    aliases: ['sp', 'spoti', 'spdl'],
    description: 'Download Spotify tracks via YouTube match',
    category: 'Media',
    usage: '/sp <spotify url or song name>',

    handler: async (ctx) => {
        const input = ctx.args.join(' ');
        if (!input) return ctx.replyHTML(`🎵 <b>Spotify Downloader</b>\n\n<code>/sp &lt;spotify url or song name&gt;</code>\n\n💡 Also works with just song names: <code>/sp Kizz Daniel Buga</code>`);

        await ctx.action('upload_audio');
        await ctx.replyHTML(`🎵 <i>Finding that track...</i>`);

        try {
            const { exec } = require('child_process');
            // If Spotify URL, use yt-dlp spotify support; otherwise search YouTube
            const query = input.includes('spotify.com') ? input : `ytsearch1:${input.replace(/["\']/g, '')}`;
            const streamUrl = await new Promise((res, rej) =>
                exec(`yt-dlp --no-playlist -f "bestaudio[ext=m4a]/bestaudio" -g "${query}"`,
                    { timeout: 30000 }, (err, stdout) => err ? rej(err) : res(stdout.trim().split('\n')[0]))
            );

            const titleRes = await new Promise((res) =>
                exec(`yt-dlp --no-playlist --print "%(title)s|||%(uploader)s" "${query}"`,
                    { timeout: 20000 }, (err, stdout) => {
                        if (err) return res({ title: input, uploader: '' });
                        const [title, uploader] = stdout.trim().split('|||');
                        res({ title: title?.trim(), uploader: uploader?.trim() });
                    })
            );

            await ctx.sendAudio(streamUrl, {
                caption: `🎵 <b>${(titleRes.title || input).substring(0, 80)}</b>\n👤 ${titleRes.uploader || ''}\n\n🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`,
                title: titleRes.title?.substring(0, 64) || input.substring(0, 64),
                performer: titleRes.uploader || 'ARCHON',
                parse_mode: 'HTML'
            });
        } catch(e) {
            console.error('[SP]', e.message);
            await ctx.replyHTML(`❌ Couldn\'t find that — try the song name directly like: <code>/sp Kizz Daniel Buga</code>`);
        }
    }
};
