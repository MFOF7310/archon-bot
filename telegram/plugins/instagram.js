const { TMP, COOKIES } = require('./_media.js');
const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function dlInstagramMeta(url) {
    return new Promise((res, rej) => {
        const cmd = 'yt-dlp --no-playlist --dump-json "' + url + '"';
        exec(cmd, { timeout: 30000 }, (err, stdout) => {
            if (err || !stdout) return res(null);
            try { res(JSON.parse(stdout.trim())); } catch { res(null); }
        });
    });
}

function dlInstagram(url) {
    return new Promise((res, rej) => {
        const ts = Date.now();
        const out = path.join(TMP, 'ig_' + ts + '.%(ext)s');
        const cmd = [
            'yt-dlp --no-playlist',
            '-o "' + out + '"',
            '-f "bestvideo+bestaudio/best"',
            '--merge-output-format mp4',
            '"' + url + '"'
        ].join(' ');
        exec(cmd, { timeout: 120000 }, (err, stdout, stderr) => {
            if (err) return rej(new Error(stderr?.substring(0, 200) || err.message));
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

module.exports = {
    name: 'instagram',
    aliases: ['ig', 'insta', 'reel'],
    description: 'Download Instagram reels & posts',
    category: 'Media',
    usage: '/ig <url>',

    handler: async (ctx) => {
        const url = ctx.args[0];
        if (!url || !url.includes('instagram'))
            return ctx.replyHTML(
                '📸 <b>Instagram Downloader</b>\n\n' +
                'Send me a public Instagram reel or post link!\n\n' +
                '<code>/ig https://instagram.com/reel/...</code>\n\n' +
                '<i>⚠️ Only public posts can be downloaded.</i>'
            );

        await ctx.action('upload_video');
        const proc = await ctx.bridge.sendTo(ctx.chatId, '⏳ <b>Fetching Instagram content...</b>', { parse_mode: 'HTML' });
        const statusId = proc?.data?.message_id;
        const edit = (t) => ctx.bridge.editMessage(ctx.chatId, statusId, t, { parse_mode: 'HTML' }).catch(() => {});

        const uid = Date.now() + '_' + Math.floor(Math.random() * 10000);
        const rawPath = path.join(TMP, 'ig_' + uid + '_raw.mp4');
        const compressedPath = path.join(TMP, 'ig_' + uid + '_out.mp4');

        try {
            await edit('📸 <i>Downloading... hang tight!</i>');
            const [meta, filePath] = await Promise.all([
                dlInstagramMeta(url),
                dlInstagram(url)
            ]);

            fs.renameSync(filePath, rawPath);
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
                '\n🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱';

            await ctx.bridge.deleteMessage(ctx.chatId, statusId).catch(() => {});
            await ctx.sendVideoBuffer(buf, { caption, parse_mode: 'HTML' });

        } catch(e) {
            console.error('[INSTAGRAM]', e.message);
            await edit(
                '😔 <b>Couldn\'t download this post!</b>\n\n' +
                '• Account may be private\n' +
                '• Post may have been removed\n' +
                '• Try with a direct public reel link\n\n' +
                '<i>🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱</i>'
            );
        } finally {
            try { if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath); } catch {}
            try { if (fs.existsSync(compressedPath)) fs.unlinkSync(compressedPath); } catch {}
        }
    }
};
