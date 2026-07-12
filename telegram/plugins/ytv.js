const { TMP, COOKIES } = require('./_media.js');
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

function isChannelOrPlaylist(url) {
    return (url.includes('/channel/') || url.includes('/playlist') ||
            url.includes('/c/') || url.includes('/user/') ||
            (url.includes('@') && !url.includes('watch')));
}

function dlVideoSmart(url, quality) {
    return new Promise((res, rej) => {
        const ts = Date.now();
        const out = path.join(TMP, 'vid_' + ts + '.%(ext)s');
        const cmd = [
            'yt-dlp ' + COOKIES + ' --no-playlist',
            '-o "' + out + '"',
            '-f "bestvideo[height<=' + quality + '][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=' + quality + ']+bestaudio/best[height<=' + quality + ']"',
            '--merge-output-format mp4',
            '--postprocessor-args "ffmpeg:-c:v libx264 -c:a aac -movflags +faststart"',
            '--max-filesize 48M',
            '"' + url + '"'
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
    return new Promise((res, rej) => {
        exec(
            'yt-dlp ' + COOKIES + ' --no-playlist -f "bestvideo[height<=' + quality + '][ext=mp4]+bestaudio/best[height<=' + quality + ']/best" --get-url "' + url + '"',
            { timeout: 30000 },
            (err, stdout) => {
                if (err || !stdout.trim()) return rej(new Error('No URL'));
                res(stdout.trim().split('\n')[0]);
            }
        );
    });
}

module.exports = {
    name: 'ytv',
    aliases: ['ytvideo', 'ydl', 'yv'],
    description: 'Download YouTube video',
    category: 'Media',
    usage: '/ytv <url>',
    getUrl,

    handler: async (ctx) => {
        const url = ctx.args[0];
        const quality = ctx.args[1] ? parseInt(ctx.args[1]) : null;

        if (!url || (!url.includes('youtube') && !url.includes('youtu.be')))
            return ctx.replyHTML(
                '🎬 <b>YouTube Video Downloader</b>\n\n' +
                '<code>/ytv https://youtube.com/watch?v=...</code>\n\n' +
                '<i>Pick quality — direct link fallback for large files</i>'
            );

        if (isChannelOrPlaylist(url))
            return ctx.replyHTML(
                '📺 <b>That\'s a channel or playlist!</b>\n\n' +
                'I need a specific video link with <code>watch?v=</code> in it.\n\n' +
                '<i>Open a video, copy its link, then send it with /ytv 🦅</i>'
            );

        if (!quality) {
            const key = storeUrl(url);
            return ctx.sendHTML(
                '🎬 <b>Pick a quality to download!</b>\n\n' +
                '<i>Larger = better quality but slower.\n' +
                'Files over 50MB get a direct download link instead.</i>',
                { extra: { reply_markup: { inline_keyboard: [[
                    { text: '📱 360p', callback_data: 'ytdl:v:360:' + key },
                    { text: '🎬 720p', callback_data: 'ytdl:v:720:' + key },
                    { text: '🔥 1080p', callback_data: 'ytdl:v:1080:' + key }
                ]] } } }
            );
        }

        const proc = await ctx.replyHTML('🎬 <i>Downloading ' + quality + 'p — hang tight...</i>');
        const edit = (t) => ctx.bridge.editMessage(ctx.chatId, proc?.data?.message_id, t, { parse_mode: 'HTML' }).catch(() => {});
        await ctx.action('upload_video');

        try {
            let filePath;
            try { filePath = await dlVideoSmart(url, quality); } catch {}

            if (filePath) {
                const buf = fs.readFileSync(filePath);
                await ctx.bridge.deleteMessage(ctx.chatId, proc?.data?.message_id).catch(() => {});
                await ctx.sendVideoBuffer(buf, {
                    caption: '🎬 <b>' + quality + 'p</b> • 🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱',
                    parse_mode: 'HTML'
                });
            } else {
                await edit('📦 <i>Too large — grabbing direct link...</i>');
                try {
                    const directUrl = await getDirectVideoUrl(url, quality);
                    await edit(
                        '🎬 <b>Your ' + quality + 'p video is ready!</b>\n\n' +
                        '📦 Too large to send directly — tap below:\n' +
                        '<a href="' + directUrl + '">⬇️ Download ' + quality + 'p Video</a>\n\n' +
                        '<i>⚠️ Link expires soon!\n🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱</i>'
                    );
                } catch {
                    await edit(
                        '😔 <b>Couldn\'t grab this one.</b>\n\n' +
                        'Try a lower quality or come back later!\n' +
                        '<i>🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱</i>'
                    );
                }
            }
        } catch(e) {
            console.error('[YTV]', e.message);
            await edit('😔 <b>Something went wrong!</b>\n\nTry again in a bit.\n<i>🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱</i>');
        }
    }
};