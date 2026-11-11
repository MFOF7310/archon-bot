const { getInfo, TMP } = require('./_media.js');
const { shq } = require('../safe');
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
            shq(query)
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
        const proxyFlag = process.env.WEBSHARE_PROXY
            ? `--proxy "${process.env.WEBSHARE_PROXY}" `
            : '';
        exec(
            `yt-dlp --no-playlist --cookies /opt/youtube_cookies.txt ${proxyFlag}-f bestaudio --get-url ${shq(query)}`,
            { timeout: 30000 },
            (err, stdout) => {
                if (err || !stdout.trim()) return rej(new Error('No URL'));
                res(stdout.trim().split('\n')[0]);
            }
        );
    });
}

const { progress, caption } = require('../ui');
const { tr } = require('../lang/media');

module.exports = {
    name: 'yta',
    aliases: ['ytaudio', 'ytmp3', 'ya'],
    description: 'Get the audio of a YouTube video as an MP3, from a link or a song name',
    category: 'Media',
    usage: '/yta <link or song name>',

    handler: async (ctx) => {
        const T = tr(ctx);
        const input = ctx.args.join(' ').trim();
        if (!input) return ctx.replyHTML(T('usage_yta'));

        const st = await progress(ctx, T('looking'));
        await ctx.action('upload_audio');
        const query = /^https?:\/\//.test(input) ? input : `ytsearch1:${input}`;
        const info = await getInfo(query).catch(() => ({}));
        const title = (info.title || input).slice(0, 90);
        await st.set(T('getting', { what: T('what_audio') }) + `\n<b>${require('../ui').esc(title)}</b>`);

        let file = null;
        try { file = await dlAudioSmart(query); } catch (e) { console.error('[YTA]', e.message); }
        if (file) {
            await st.set(T('sending'));
            await ctx.sendAudioBuffer(fs.readFileSync(file), {
                caption: caption(title, info.uploader, info.duration),
                title: title.slice(0, 64), performer: info.uploader || 'ARCHON', parse_mode: 'HTML',
            });
            return st.done();
        }
        // Over 50 MB, or yt-dlp refused the download: a link straight from YouTube instead
        try {
            const link = await getDirectAudioUrl(query);
            return st.end(T('too_big', { title, mb: '50+' }), { inline_keyboard: [[{ text: T('dl_btn'), url: link }]] });
        } catch {
            return st.end(T('failed'));
        }
    },
};
