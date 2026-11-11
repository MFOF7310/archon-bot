const { TMP, COOKIES } = require('./_media.js');
const { shq } = require('../safe');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// URL store — maps short key to full URL to avoid 64-byte callback limit
const urlStore = new Map();
function storeUrl(url) {
    const key = Math.random().toString(36).slice(2, 8);
    urlStore.set(key, url);
    setTimeout(() => urlStore.delete(key), 3600000); // 1hr TTL
    return key;
}
function getUrl(key) { return urlStore.get(key) || null; }
module.exports.getUrl = getUrl;
module.exports.storeUrl = storeUrl;

function isChannelOrPlaylist(url) {
    return (url.includes('/channel/') || url.includes('/playlist') ||
            url.includes('/c/') || url.includes('/user/') ||
            (url.includes('@') && !url.includes('watch')));
}

function dlVideoSmart(url, quality) {
    if (quality !== 'best' && !/^\d{3,4}$/.test(String(quality))) quality = 'best';
    return new Promise((res, rej) => {
        const ts = Date.now();
        const out = path.join(TMP, 'vid_' + ts + '.%(ext)s');
        const proxyFlag = process.env.WEBSHARE_PROXY
            ? `--proxy "${process.env.WEBSHARE_PROXY}" `
            : '';
        const fmt = quality === 'best'
            ? 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best'
            : 'bestvideo[height<=' + quality + '][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=' + quality + ']+bestaudio/best[height<=' + quality + ']';
        const cmd = [
            'yt-dlp --no-playlist --cookies /opt/youtube_cookies.txt ' + proxyFlag,
            '-o "' + out + '"',
            '-f "' + fmt + '"',
            '--merge-output-format mp4',
            '--max-filesize 48M',
            shq(url)
        ].join(' ');
        exec(cmd, { timeout: 300000 }, (err, stdout, stderr) => {
            if (err) return rej(new Error(stderr?.substring(0, 200) || err.message));
            const files = fs.readdirSync(TMP).filter(f => f.startsWith('vid_' + ts));
            if (!files.length) return rej(new Error('too_large'));
            const found = path.join(TMP, files[0]);
            setTimeout(() => { try { fs.unlinkSync(found); } catch {} }, 300000);
            res(found);
        });
    });
}

function getDirectVideoUrl(url, quality) {
    if (quality !== 'best' && !/^\d{3,4}$/.test(String(quality))) quality = 'best';
    return new Promise((res, rej) => {
        const proxyFlag = process.env.WEBSHARE_PROXY
            ? '--proxy "' + process.env.WEBSHARE_PROXY + '" '
            : '';
        const fmt = quality === 'best'
            ? 'best[ext=mp4]/best'
            : 'best[height<=' + quality + '][ext=mp4]/best[height<=' + quality + ']';
        exec(
            'yt-dlp --no-playlist --cookies /opt/youtube_cookies.txt ' + proxyFlag + '-f "' + fmt + '" --get-url "' + url + '"',
            { timeout: 30000 },
            (err, stdout) => {
                if (err || !stdout.trim()) return rej(new Error('No URL'));
                res(stdout.trim().split('\n')[0]);
            }
        );
    });
}

const { progress, caption, esc } = require('../ui');
const { tr } = require('../lang/media');
const run = (cmd, ms) => new Promise((res) => exec(cmd, { timeout: ms, encoding: 'utf8' }, (err, out) => res(err ? '' : String(out || '').trim())));
const LABEL = { 144: '144p', 240: '240p', 360: '📱 360p', 480: '480p', 720: '🎬 720p', 1080: '🔥 1080p', 1440: '1440p', 2160: '💎 4K' };

module.exports = {
    name: 'ytv',
    aliases: ['ytvideo', 'ydl', 'yv'],
    description: 'Download a YouTube video, with a choice of quality',
    category: 'Media',
    usage: '/ytv <link>',
    getUrl,
    storeUrl,

    handler: async (ctx) => {
        const T = tr(ctx);
        const url = ctx.args[0];
        const quality = ctx.args[1] === 'best' ? 'best' : (/^\d{3,4}$/.test(String(ctx.args[1] || '')) ? String(ctx.args[1]) : null);

        if (!url || !/youtu\.?be/.test(url)) return ctx.replyHTML(T('usage', { cmd: '/ytv', example: '/ytv https://youtu.be/…' }));
        if (isChannelOrPlaylist(url)) return ctx.replyHTML(T('not_video'));

        // Step 1: the title and the qualities this video really has, in one message with buttons
        if (!quality) {
            const st = await progress(ctx, T('looking'));
            const key = storeUrl(url);
            const [meta, formats] = await Promise.all([
                run(`yt-dlp --no-playlist ${COOKIES} --print "%(title)s|||%(duration_string)s|||%(uploader)s" ${shq(url)} 2>/dev/null`, 20000),
                run(`yt-dlp --no-playlist ${COOKIES} -F ${shq(url)} 2>/dev/null`, 20000),
            ]);
            const [title, dur, who] = meta.split('|||');
            const heights = [...new Set((formats.match(/\b(\d{3,4})p\b/g) || []).map((x) => parseInt(x)))].filter((h) => LABEL[h]).sort((a, b) => a - b);
            const pick = (heights.length ? heights : [360, 720, 1080]).filter((h) => h >= 360).slice(-3);
            const kb = [
                pick.map((h) => ({ text: LABEL[h], callback_data: `ytdl:v:${h}:${key}` })),
                [{ text: T('best'), callback_data: `ytdl:v:best:${key}` }, { text: T('audio_btn'), callback_data: `ytdl:a:best:${key}` }],
            ];
            return st.end(T('pick', { title: (title || 'YouTube').slice(0, 90), meta: [who, dur].filter(Boolean).join(' · ') }), { inline_keyboard: kb });
        }

        // Step 2: download in the chosen quality, in the same message
        const label = quality === 'best' ? 'HD' : quality + 'p';
        const st = await progress(ctx, T('getting', { what: T('what_q', { q: label }) }));
        await ctx.action('upload_video');
        const uid = Date.now() + '_' + Math.floor(Math.random() * 10000);
        const rawPath = path.join(TMP, 'ytv_' + uid + '_raw.mp4');
        const title = (await run(`yt-dlp --no-playlist ${COOKIES} --get-title ${shq(url)} 2>/dev/null`, 15000)).slice(0, 90) || 'YouTube';

        // Too big for Telegram: a download link in the same message, no download on the server
        const linkInstead = async (mb) => {
            try {
                const link = await getDirectVideoUrl(url, quality);
                return st.end(T('too_big', { title, mb }), { inline_keyboard: [[{ text: T('dl_btn'), url: link }]] });
            } catch { return st.end(T('too_big_lower', { mb })); }
        };
        const sizeFmt = quality === 'best' ? 'bestvideo[ext=mp4]+bestaudio/best' : `bestvideo[height<=${quality}][ext=mp4]+bestaudio/best[height<=${quality}]/best`;
        const approx = Math.round((parseInt(await run(`yt-dlp --no-playlist ${COOKIES} -f "${sizeFmt}" --print filesize_approx ${shq(url)} 2>/dev/null`, 15000)) || 0) / 1048576);
        if (approx >= 46) return linkInstead(approx);

        try {
            const proxy = process.env.WEBSHARE_PROXY ? `--proxy ${shq(process.env.WEBSHARE_PROXY)} ` : '';
            const fmt = quality === 'best'
                ? 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best'
                : `bestvideo[height<=${quality}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]`;
            await new Promise((res, rej) => exec(
                `yt-dlp --no-playlist ${COOKIES} ${proxy}-o "${rawPath}" -f "${fmt}" --merge-output-format mp4 ${shq(url)}`,
                { timeout: 300000 },
                (err, out, errOut) => (err || !fs.existsSync(rawPath)) ? rej(new Error(String(errOut || '').slice(0, 200) || 'Download failed')) : res()
            ));
            const mb = fs.statSync(rawPath).size / 1048576;
            if (mb >= 48) return linkInstead(Math.round(mb));
            await st.set(T('sending'));
            await ctx.sendVideoBuffer(fs.readFileSync(rawPath), { caption: caption(title, 'YouTube', label), parse_mode: 'HTML' });
            await st.done();
        } catch (e) {
            console.error('[YTV]', e.message);
            await st.end(/private|unavailable|removed/i.test(e.message) ? T('failed_private') : T('failed'));
        } finally {
            try { if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath); } catch {}
        }
    },
};
