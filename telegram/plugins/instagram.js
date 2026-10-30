const { TMP, COOKIES } = require('./_media.js');
const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function dlInstagramMeta(url) {
    return new Promise((res, rej) => {
        const cmd = 'yt-dlp ' + COOKIES + ' --ignore-errors --dump-single-json "' + url + '"';
        exec(cmd, { timeout: 30000, maxBuffer: 1024 * 1024 * 10 }, (err, stdout) => {
            if (!stdout) return res(null);
            try { res(JSON.parse(stdout.trim())); } catch { res(null); }
        });
    });
}


// True when Instagram served no audio stream at all (region-licensed music) — video will be silent.
function igHasAudio(meta) {
    const f = meta?.formats || [];
    if (!f.length) return true; // unknown → don't claim silence
    return f.some(x => x.acodec && x.acodec !== 'none');
}

function dlInstagram(url) {
    return new Promise((res, rej) => {
        const ts = Date.now();
        const out = path.join(TMP, 'ig_' + ts + '.%(ext)s');
        const cmd = [
            'yt-dlp --no-playlist ' + COOKIES,
            '-o "' + out + '"',
            '-f "bestvideo+bestaudio/best"',
            '--merge-output-format mp4',
            '"' + url + '"'
        ].join(' ');
        exec(cmd, { timeout: 120000 }, (err, stdout, stderr) => {
            if (err) {
                // remove partial files from the failed attempt before any retry
                try { fs.readdirSync(TMP).filter(f => f.startsWith('ig_' + ts)).forEach(f => fs.unlinkSync(path.join(TMP, f))); } catch {}
                return rej(new Error(stderr?.substring(0, 200) || err.message));
            }
            const files = fs.readdirSync(TMP).filter(f => f.startsWith('ig_' + ts));
            if (!files.length) return rej(new Error('No file found'));
            res(path.join(TMP, files[0]));
        });
    });
}

function compressVideo(inputPath, outputPath, targetMB = 45) {
    try {
        const durationOutput = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`).toString().trim();
        const duration = parseFloat(durationOutput) || 30;
        const targetBitrate = Math.floor((targetMB * 8192) / duration);
        execSync(`ffmpeg -y -i "${inputPath}" -b:v ${targetBitrate}k -bufsize ${targetBitrate * 2}k -maxrate ${Math.floor(targetBitrate * 1.2)}k -c:a copy -movflags +faststart "${outputPath}"`, { stdio: 'pipe', timeout: 120000 });
        return fs.existsSync(outputPath);
    } catch (e) {
        console.error('[INSTAGRAM] Compress error:', e.message);
        return false;
    }
}

// Telegram cannot decode some audio codecs (e.g. Opus-in-MP4) -> video plays silent.
// Remux with audio transcoded to AAC. Video stream is copied, so this is fast.
function normalizeAudio(inputPath, outputPath) {
    try {
        execSync(`ffmpeg -y -i "${inputPath}" -c:v copy -c:a aac -b:a 160k -movflags +faststart "${outputPath}"`, { stdio: 'pipe', timeout: 60000 });
        return fs.existsSync(outputPath);
    } catch (e) {
        console.error('[INSTAGRAM] Normalize error:', e.message);
        return false;
    }
}

// Instagram's guest API intermittently sends an empty media response (anti-bot
// rate-limit). These failures are transient -> retry a few times before giving up.
const sleepIg = (ms) => new Promise(r => setTimeout(r, ms));
async function dlInstagramRetry(url, tries = 3) {
    let last = null;
    for (let i = 0; i < tries; i++) {
        try { return await dlInstagram(url); }
        catch (e) { last = e; console.log('[INSTAGRAM] attempt', i + 1, 'failed:', (e.message || '').substring(0, 80)); if (i < tries - 1) await sleepIg(2500); }
    }
    throw last;
}
async function dlInstagramMetaRetry(url, tries = 3) {
    for (let i = 0; i < tries; i++) {
        const m = await dlInstagramMeta(url);
        if (m) return m;
        if (i < tries - 1) await sleepIg(2500);
    }
    return null;
}

module.exports = {
    name: 'instagram',
    aliases: ['ig', 'insta', 'reel'],
    description: 'Download Instagram reels & posts',
    category: 'Media',
    usage: '/ig <url>',

    handler: async (ctx) => {
        let url = ctx.args[0];
        if (!url || !url.includes('instagram'))
            return ctx.replyHTML(
                '📸 <b>Instagram Downloader</b>\n\n' +
                'Send me a public Instagram reel or post link!\n\n' +
                '<code>/ig https://instagram.com/reel/...</code>\n\n' +
                '<i>⚠️ Only public posts can be downloaded.</i>'
            );

        // Clean URL: remove query parameters like ?img_index=... that trigger Instagram's bot detection
        url = url.split('?')[0];
        if (!url.endsWith('/')) url += '/';

        await ctx.action('upload_video');
        const proc = await ctx.bridge.sendTo(ctx.chatId, '⏳ <b>Fetching Instagram content...</b>', { parse_mode: 'HTML' });
        const statusId = proc?.data?.message_id;
        const edit = (t) => ctx.bridge.editMessage(ctx.chatId, statusId, t, { parse_mode: 'HTML' }).catch(() => {});

        const uid = Date.now() + '_' + Math.floor(Math.random() * 10000);
        const rawPath = path.join(TMP, 'ig_' + uid + '_raw.mp4');
        const compressedPath = path.join(TMP, 'ig_' + uid + '_out.mp4');
        const normPath = path.join(TMP, 'ig_' + uid + '_norm.mp4');

        try {
            await edit('📸 <i>Downloading... hang tight!</i>');

        // 1. Try ultra-igdl for carousels/images
        try {
            const { ultraigdl } = require('ultra-igdl');
            const cookiePath = '/opt/youtube_cookies.txt';
            if (fs.existsSync(cookiePath)) {
                const cookieLines = fs.readFileSync(cookiePath, 'utf8').split(String.fromCharCode(10)).filter(line => line.includes('.instagram.com'));
                console.log('[INSTAGRAM] Found IG cookies:', cookieLines.length);
                
                const parsedCookies = cookieLines.map(line => { 
                    const parts = line.split('\t'); 
                    return (parts[5] && parts[6]) ? `${parts[5]}=${parts[6]}` : ''; 
                }).filter(Boolean);
                
                const cookieString = parsedCookies.join('; ');
                console.log('[INSTAGRAM] Parsed cookie names:', parsedCookies.map(c => c.split('=')[0]).join(', '));
                
                if (cookieString) {
                    console.log('[INSTAGRAM] Trying ultra-igdl...');
                    const ig = new ultraigdl({ 
                        cookies: cookieString,
                        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    });
                    // Nettoyage final de l'URL : on garde juste le code du post (ex: /p/XXXXX)
                    const cleanUrl = url.match(/(https:\/\/www\.instagram\.com\/(p|reel)\/[a-zA-Z0-9_-]+)/)?.[1] || url;
                    console.log('[INSTAGRAM] ultra-igdl sending URL:', cleanUrl);
                    
                    const result = await ig.download(cleanUrl);
                    console.log('[INSTAGRAM] ultra-igdl raw:', JSON.stringify(result).substring(0, 100));
                    console.log('[INSTAGRAM] ultra-igdl result:', result.code, result.media ? result.media.length : 0);
                    
                    if (result.code === 200 && result.media && result.media.length > 0) {
                        const isVideo = result.media.some(m => m.type === 'video');
                        if (!isVideo || result.media.length > 1) {
                            await edit(`📤 <b>Sending album (${result.media.length} items)...</b>`);
                            const caption = '📸 <b>Instagram</b>' + String.fromCharCode(10) + '👤 @' + (result.username || 'user') + String.fromCharCode(10, 10) + '🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱';
                            // Telegram accepts max 10 items per album. We chunk the media.
                    const mediaList = result.media.map(m => m.type === 'video' ? { type: 'video', media: m.url } : { type: 'photo', media: m.url });
                    const chunks = [];
                    for (let i = 0; i < mediaList.length; i += 10) {
                        chunks.push(mediaList.slice(i, i + 10));
                    }
                    
                    for (let i = 0; i < chunks.length; i++) {
                        const group = chunks[i];
                        if (i === 0) {
                            // Add caption to the first image of the first group only
                            group[0].caption = caption;
                            group[0].parse_mode = 'HTML';
                        }
                        await ctx.bridge.sendMediaGroup(ctx.chatId, group);
                    }
                            await ctx.bridge.deleteMessage(ctx.chatId, statusId).catch(() => {});
                            return; // Done!
                        }
                    }
                } else {
                    console.log('[INSTAGRAM] Cookie string is empty after parsing');
                }
            }
        } catch (e) {
            console.log('[INSTAGRAM] ultra-igdl failed, falling back to yt-dlp:', e.message);
        }

        // 2. If not handled by ultra-igdl (or if it's a single video), use yt-dlp
        const meta = await dlInstagramMetaRetry(url);
        const filePath = await dlInstagramRetry(url);
        fs.renameSync(filePath, rawPath);
            if (normalizeAudio(rawPath, normPath)) {
                fs.unlinkSync(rawPath);
                fs.renameSync(normPath, rawPath);
            }
            const sizeMB = fs.statSync(rawPath).size / 1024 / 1024;
            console.log('[INSTAGRAM] Downloaded size:', sizeMB.toFixed(2), 'MB');

            let sendPath = rawPath;
            if (sizeMB >= 48) {
                await edit('🗜️ <b>Compressing...</b> (' + sizeMB.toFixed(0) + 'MB → ~45MB)\n<i>This may take a moment</i>');
                console.log('[INSTAGRAM] Compressing...');
                const ok = compressVideo(rawPath, compressedPath, 45);
                if (ok && fs.existsSync(compressedPath)) {
                    const newSize = fs.statSync(compressedPath).size / 1024 / 1024;
                    console.log('[INSTAGRAM] Compressed size:', newSize.toFixed(2), 'MB');
                    sendPath = compressedPath;
                } else {
                    throw new Error('Compression failed');
                }
            }

            await edit('📤 <b>Sending...</b>');
            const buf = fs.readFileSync(sendPath);

            const desc = meta?.description || meta?.title || null;
            const uploader = meta?.uploader || meta?.channel || null;
            const caption =
                (desc ? '📸 ' + desc.substring(0, 180) + '\n' : '📸 <b>Instagram</b>\n') +
                (uploader ? '👤 @' + uploader + '\n' : '') +
                (igHasAudio(meta) ? '' : '🔇 <i>Audio not available for this reel in this region</i>\n') +
                '\n🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱';

            await ctx.bridge.deleteMessage(ctx.chatId, statusId).catch(() => {});
            await ctx.sendVideoBuffer(buf, { caption, parse_mode: 'HTML' });

        } catch(e) {
            console.error('[INSTAGRAM]', e.message);
            // empty media / CSRF / 4xx = transient anti-bot rate-limit: ask for a retry, don't blame the link
            const transient = /empty media|CSRF|429|rate.?limit|401|403/i.test(e.message || '');
            const msg = transient
                ? '⏳ <b>Instagram rate-limited this request!</b>\n\n' +
                  '• Wait ~1 minute, then send the link again\n' +
                  '• Your link is fine - this is temporary\n\n' +
                  '<i>🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱</i>'
                : '😔 <b>Couldn\'t download this post!</b>\n\n' +
                  '• Account may be private\n' +
                  '• Post may have been removed\n' +
                  '• Try with a direct public reel link\n\n' +
                  '<i>🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱</i>';
            await edit(msg);
        } finally {
            try { if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath); } catch {}
            try { if (fs.existsSync(compressedPath)) fs.unlinkSync(compressedPath); } catch {}
            try { if (fs.existsSync(normPath)) fs.unlinkSync(normPath); } catch {}
        }
    }
};
