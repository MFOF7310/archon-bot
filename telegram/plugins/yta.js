const { getInfo, TMP } = require('./_media.js');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

function dlAudioSmart(query) {
    return new Promise((res, rej) => {
        const ts = Date.now();
        const out = path.join(TMP, `aud_${ts}.%(ext)s`);
        const cmd = [
            'yt-dlp --no-playlist',
            `--cookies /opt/youtube_cookies.txt`,
            `-o "${out}"`,
            `-x --audio-format mp3 --audio-quality 0`,
            `--max-filesize 48M`,
            `"${query}"`
        ].join(' ');
        exec(cmd, { timeout: 120000 }, (err, stdout, stderr) => {
            if (err) return rej(new Error(stderr?.substring(0, 200) || err.message));
            const files = fs.readdirSync(TMP).filter(f => f.startsWith(`aud_${ts}`));
            if (!files.length) return rej(new Error('too_large'));
            const found = path.join(TMP, files[0]);
            setTimeout(() => { try { fs.unlinkSync(found); } catch {} }, 300000);
            res(found);
        });
    });
}

function getDirectAudioUrl(query) {
    return new Promise((res, rej) => {
        exec(
            `yt-dlp --no-playlist -x --audio-format mp3 --get-url "${query}"`,
            { timeout: 30000 },
            (err, stdout) => {
                if (err || !stdout.trim()) return rej(new Error('No URL'));
                res(stdout.trim().split('\n')[0]);
            }
        );
    });
}

module.exports = {
    name: 'yta',
    aliases: ['ytaudio', 'ytmp3', 'ya'],
    description: 'Download YouTube audio as MP3',
    category: 'Media',
    usage: '/yta <url or song name>',

    handler: async (ctx) => {
        const input = ctx.args.join(' ');
        if (!input) return ctx.replyHTML(
            `🎵 <b>YouTube Audio Downloader</b>\n\n` +
            `Send a link or just the song name!\n\n` +
            `<code>/yta https://youtube.com/watch?v=...</code>\n` +
            `<code>/yta Mama Le Succes Bogotiguini</code>\n\n` +
            `<i>MP3 • best quality • direct link for large files</i>`
        );

        await ctx.action('upload_audio');
        const proc = await ctx.replyHTML(`🎵 <i>Looking up "${input.substring(0, 40)}"...</i>`);
        const edit = (text) => ctx.bridge.editMessage(ctx.chatId, proc?.data?.message_id, text, { parse_mode: 'HTML' }).catch(() => {});

        try {
            const isUrl = input.startsWith('http');
            const query = isUrl ? input : `ytsearch1:${input}`;

            const info = await getInfo(query).catch(() => ({}));
            const title = info.title ? `<b>${info.title.substring(0, 80)}</b>` : `<b>Audio</b>`;
            const meta = [info.uploader, info.duration].filter(Boolean).join(' • ');

            await edit(`🎵 <i>Downloading</i> ${title}\n${meta}\n\n⏳ <i>Grabbing the audio...</i>`);

            let filePath;
            try {
                filePath = await dlAudioSmart(query);
            } catch {
                // fallback
            }

            if (filePath) {
                const buf = fs.readFileSync(filePath);
                const caption = [`🎵 ${title}`, meta, `\n🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`].filter(Boolean).join('\n');
                await ctx.bridge.deleteMessage(ctx.chatId, proc?.data?.message_id).catch(() => {});
                await ctx.sendAudioBuffer(buf, {
                    caption,
                    title: info.title?.substring(0, 64) || input.substring(0, 64),
                    performer: info.uploader || 'ARCHON',
                    parse_mode: 'HTML'
                });
            } else {
                await edit(`📦 <i>File too large — grabbing direct link...</i>`);
                try {
                    const url = await getDirectAudioUrl(query);
                    await edit(
                        `🎵 ${title}\n${meta}\n\n` +
                        `📦 <b>Too large to send directly!</b>\n\n` +
                        `Tap below to download the MP3:\n` +
                        `<a href="${url}">⬇️ Download Audio</a>\n\n` +
                        `<i>⚠️ Link expires soon — save it quickly!\n🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱</i>`
                    );
                } catch {
                    await edit(
                        `🎵 ${title}\n\n😔 <b>Couldn't grab this one.</b>\n\n` +
                        `YouTube might be blocking it right now.\n` +
                        `Try again in a few minutes!\n\n` +
                        `<i>🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱</i>`
                    );
                }
            }
        } catch(e) {
            console.error('[YTA]', e.message);
            await edit(
                `😔 <b>Something went wrong!</b>\n\n` +
                `YouTube is being tricky right now.\n` +
                `Try again or use a direct link!\n\n` +
                `<i>🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱</i>`
            );
        }
    }
};
