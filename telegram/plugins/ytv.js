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
        const proxyFlag = process.env.WEBSHARE_PROXY
            ? `--proxy "${process.env.WEBSHARE_PROXY}" `
            : '';
        const cmd = [
            'yt-dlp --no-playlist --cookies /opt/youtube_cookies.txt ' + proxyFlag,
            '-o "' + out + '"',
            '-f "bestvideo[height<=' + quality + '][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=' + quality + ']+bestaudio/best[height<=' + quality + ']"',
            '--merge-output-format mp4',
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
            'yt-dlp --no-playlist --cookies /opt/youtube_cookies.txt -f "best[height<=' + quality + '][ext=mp4]/best[height<=' + quality + ']" --get-url "' + url + '"',
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
            // Fetch available qualities dynamically
            let buttons = [
                [{ text: '📱 360p', callback_data: 'ytdl:v:360:' + key },
                 { text: '🎬 720p', callback_data: 'ytdl:v:720:' + key },
                 { text: '🔥 1080p', callback_data: 'ytdl:v:1080:' + key }]
            ];
            try {
                const { execSync } = require('child_process');
                const formatsRaw = execSync(
                    `yt-dlp --no-playlist -F "${url}" 2>/dev/null | grep -E "^[0-9]+" | grep "mp4|webm" | awk '{print $4}' | grep -E "^[0-9]+p$" | sort -t'p' -k1 -n | uniq`,
                    { timeout: 15000, encoding: 'utf8' }
                ).trim();
                const available = [...new Set(formatsRaw.split('\n').filter(Boolean))];
                const qualityMap = {
                    '144p': '🔹 144p', '240p': '📱 240p', '360p': '📱 360p',
                    '480p': '🎥 480p', '720p': '🎬 720p', '1080p': '🔥 1080p',
                    '1440p': '💎 1440p', '2160p': '🌟 4K'
                };
                const filtered = available.filter(q => qualityMap[q]);
                if (filtered.length > 0) {
                    // Group into rows of 3
                    const row = [];
                    filtered.forEach((q, i) => {
                        if (i % 3 === 0) row.push([]);
                        row[row.length-1].push({
                            text: qualityMap[q],
                            callback_data: 'ytdl:v:' + q.replace('p','') + ':' + key
                        });
                    });
                    buttons = row;
                }
            } catch(e) {}

            // Get video title for display
            let title = 'YouTube Video';
            try {
                const { execSync } = require('child_process');
                title = execSync(`yt-dlp --no-playlist --get-title "${url}" 2>/dev/null`, { timeout: 10000, encoding: 'utf8' }).trim().substring(0, 60);
            } catch(e) {}

            return ctx.sendHTML(
                `🎬 <b>${title}</b>\n\n` +
                `📊 <b>Pick a quality:</b>\n` +
                `<i>Under 50MB → sent directly\nOver 50MB → instant download link</i>\n\n` +
                `🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`,
                { extra: { reply_markup: { inline_keyboard: buttons } } }
            );
        }

        // Check approximate file size before downloading
        let approxSize = 0;
        try {
            const { execSync } = require('child_process');
            const sizeRaw = execSync(
                `yt-dlp --no-playlist -f "bestvideo[height<=${quality}][ext=mp4]+bestaudio/best[height<=${quality}]/best" --print filesize_approx "${url}" 2>/dev/null`,
                { timeout: 15000, encoding: 'utf8' }
            ).trim();
            approxSize = parseInt(sizeRaw) || 0;
        } catch(e) {}
        const sizeMB = Math.round(approxSize / 1024 / 1024);
        const sizeInfo = sizeMB > 0 ? ` (~${sizeMB}MB)` : '';

        const proc = await ctx.replyHTML('🎬 <i>Downloading ' + quality + 'p' + sizeInfo + ' — hang tight...</i>');
        const edit = (t) => ctx.bridge.editMessage(ctx.chatId, proc?.data?.message_id, t, { parse_mode: 'HTML' }).catch(() => {});
        await ctx.action('upload_video');

        const { execSync } = require('child_process');
        const uid = Date.now() + '_' + Math.floor(Math.random() * 10000);
        const rawPath = path.join(TMP, 'ytv_' + uid + '_raw.mp4');
        const compressedPath = path.join(TMP, 'ytv_' + uid + '_out.mp4');
        const edit2 = (t) => ctx.bridge.editMessage(ctx.chatId, proc?.data?.message_id, t, { parse_mode: 'HTML' }).catch(() => {});

        try {
            await new Promise((res, rej) => {
                const proxyFlag = process.env.WEBSHARE_PROXY
                    ? '--proxy "' + process.env.WEBSHARE_PROXY + '" '
                    : '';
                const cmd = [
                    'yt-dlp --no-playlist --cookies /opt/youtube_cookies.txt ' + proxyFlag,
                    '-o "' + rawPath + '"',
                    '-f "bestvideo[height<=' + quality + '][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=' + quality + ']+bestaudio/best[height<=' + quality + ']"',
                    '--merge-output-format mp4',
                    '"' + url + '"'
                ].join(' ');
                require('child_process').exec(cmd, { timeout: 300000 }, (err, stdout, stderr) => {
                    if (err || !fs.existsSync(rawPath)) return rej(new Error(stderr?.substring(0, 200) || 'Download failed'));
                    res();
                });
            });

            const sizeMB = fs.statSync(rawPath).size / 1024 / 1024;
            console.log('[YTV] Downloaded size:', sizeMB.toFixed(2), 'MB');

            if (sizeMB >= 48) {
                // Too large — get direct link instead of compressing
                fs.unlinkSync(rawPath);
                await edit2('🔗 <b>Video too large to send directly — getting download link...</b>');
                try {
                    const directUrl = await getDirectVideoUrl(url, quality);
                    const videoTitle = meta?.title || 'YouTube Video';
                    await ctx.bridge.deleteMessage(ctx.chatId, proc?.data?.message_id).catch(() => {});
                    await ctx.replyHTML(
                        '🎬 <b>Your video is ready!</b>\n\n' +
                        '<a href="' + directUrl + '">' + videoTitle.substring(0, 80) + ' (' + quality + 'p)</a>\n\n' +
                        '⚠️ <i>Link expires in ~6 hours</i>\n' +
                        '🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱'
                    );
                } catch {
                    await ctx.bridge.deleteMessage(ctx.chatId, proc?.data?.message_id).catch(() => {});
                    await ctx.replyHTML('😔 <b>Could not get download link.</b>\nTry a lower quality like 360p or 480p.\n<i>🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱</i>');
                }
                return;
            }

            await edit2('📤 <b>Sending...</b>');
            const buf = fs.readFileSync(rawPath);
            await ctx.bridge.deleteMessage(ctx.chatId, proc?.data?.message_id).catch(() => {});
            await ctx.sendVideoBuffer(buf, {
                caption: '🎬 <b>' + quality + 'p</b> • 🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱',
                parse_mode: 'HTML'
            });

        } catch(e) {
            console.error('[YTV]', e.message);
            await ctx.bridge.deleteMessage(ctx.chatId, proc?.data?.message_id).catch(() => {});
            await ctx.replyHTML('😔 <b>Could not download this video.</b>\n\n' + (e.message.includes('private') ? 'Video is private or unavailable.' : 'Try a different quality or shorter video.') + '\n<i>🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱</i>');
        } finally {
            try { if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath); } catch {}
            try { if (fs.existsSync(compressedPath)) fs.unlinkSync(compressedPath); } catch {}
        }
    }
};
