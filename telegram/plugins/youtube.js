// ═══════════════════════════════════════════
//  TG COMMAND: YouTube Downloader
// ═══════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function escapeHTML(t) { return !t || typeof t !== 'string' ? '' : t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function compressVideo(inputPath, outputPath, targetMB = 45) {
    try {
        const durationOutput = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`).toString().trim();
        const duration = parseFloat(durationOutput) || 30;
        const targetBitrate = Math.floor((targetMB * 8192) / duration);
        execSync(`ffmpeg -y -i "${inputPath}" -b:v ${targetBitrate}k -bufsize ${targetBitrate * 2}k -maxrate ${Math.floor(targetBitrate * 1.2)}k -c:a copy -movflags +faststart "${outputPath}"`, { stdio: 'pipe', timeout: 180000 });
        return fs.existsSync(outputPath);
    } catch (e) {
        console.error('[YOUTUBE] Compress error:', e.message);
        return false;
    }
}

function ytdlp(url, extraArgs, outputPath) {
    return new Promise((resolve, reject) => {
        const { exec } = require('child_process');
        const cmd = `yt-dlp --no-playlist ${extraArgs} -o "${outputPath}" "${url}"`;
        exec(cmd, { timeout: 180000 }, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr?.substring(0, 200) || err.message));
            resolve();
        });
    });
}

module.exports = {
    name: 'youtube',
    description: 'Download YouTube videos or audio',
    category: 'Media',
    usage: '/yt <url> [audio]',
    aliases: ['yt', 'ytb', 'ytaudio'],

    handler: async (ctx) => {
        const text = ctx.message?.text || ctx.text || '';
        const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
        const url = urlMatch?.[0];
        const cmd = ctx.message.text?.split(' ')[0]?.toLowerCase() || '/yt';
        const audioOnly = cmd.includes('audio') || text.toLowerCase().includes('audio') || text.toLowerCase().includes('mp3');

        if (!url || !url.includes('youtu')) {
            return ctx.replyHTML(
                `🎬 <b>YouTube Downloader</b>\n\n` +
                `Send a YouTube link to download video or audio.\n\n` +
                `<code>/yt &lt;url&gt;</code> — video\n` +
                `<code>/ytaudio &lt;url&gt;</code> — audio (mp3)`
            );
        }

        await ctx.action('upload_video');

        const proc = await ctx.bridge.sendTo(ctx.chatId, '⏳ <b>Fetching YouTube content...</b>', { parse_mode: 'HTML' });
        const statusId = proc?.data?.message_id;
        const updateStatus = async (t) => {
            if (statusId) await ctx.bridge.editMessage(ctx.chatId, statusId, t, { parse_mode: 'HTML' }).catch(() => {});
        };

        const uid = Date.now() + '_' + Math.floor(Math.random() * 10000);
        const tmpDir = '/tmp';
        const rawPath = path.join(tmpDir, `yt_${uid}_raw.%(ext)s`);
        const compressedPath = path.join(tmpDir, `yt_${uid}_out.mp4`);

        try {
            // Get metadata first
            await updateStatus('📋 <b>Fetching info...</b>');
            let meta = null;
            try {
                const { exec } = require('child_process');
                const metaStr = await new Promise((res) => {
                    exec(`yt-dlp --no-playlist --dump-json "${url}"`, { timeout: 30000 }, (err, stdout) => {
                        res(err || !stdout ? null : stdout.trim());
                    });
                });
                if (metaStr) meta = JSON.parse(metaStr);
            } catch {}

            const title = meta?.title || 'YouTube Video';
            const uploader = meta?.uploader || meta?.channel || null;
            const duration = meta?.duration || 0;

            // Reject videos over 15 minutes for video mode
            if (!audioOnly && duration > 900) {
                await ctx.bridge.deleteMessage(ctx.chatId, statusId).catch(() => {});
                return ctx.replyHTML(`⏱ <b>Video too long</b>\n\nMax 15 minutes for video download. Try <code>/ytaudio</code> for audio only.`);
            }

            if (audioOnly) {
                await updateStatus('🎵 <b>Extracting audio...</b>');
                const audioPath = path.join(tmpDir, `yt_${uid}_raw.mp3`);
                await ytdlp(url, '-x --audio-format mp3 --audio-quality 0', path.join(tmpDir, `yt_${uid}_raw.%(ext)s`));

                // Find the output file
                const files = fs.readdirSync(tmpDir).filter(f => f.startsWith(`yt_${uid}_raw`));
                if (!files.length) throw new Error('Audio extraction failed');
                const foundPath = path.join(tmpDir, files[0]);

                await updateStatus('📤 <b>Sending audio...</b>');
                const buffer = fs.readFileSync(foundPath);
                const caption = `🎵 ${escapeHTML(title.substring(0, 120))}\n` +
                    (uploader ? `👤 @${escapeHTML(uploader)}\n` : '') +
                    `\n🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`;

                const result = await ctx.bridge.sendAudioBuffer(ctx.chatId, buffer, { caption, parse_mode: 'HTML' });
                try { fs.unlinkSync(foundPath); } catch {}

                if (result?.success) {
                    await ctx.bridge.deleteMessage(ctx.chatId, statusId).catch(() => {});
                } else {
                    throw new Error('Audio send failed');
                }

            } else {
                await updateStatus('📥 <b>Downloading video...</b>');
                await ytdlp(url, '-f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --merge-output-format mp4', path.join(tmpDir, `yt_${uid}_raw.mp4`));

                const downloadedPath = path.join(tmpDir, `yt_${uid}_raw.mp4`);
                if (!fs.existsSync(downloadedPath)) throw new Error('Download failed — file not found');

                const sizeMB = fs.statSync(downloadedPath).size / 1024 / 1024;
                console.log('[YOUTUBE] Downloaded size:', sizeMB.toFixed(2), 'MB');

                let sendPath = downloadedPath;
                if (sizeMB >= 48) {
                    await updateStatus(`🗜️ <b>Compressing...</b> (${sizeMB.toFixed(0)}MB → ~45MB)\n<i>This may take a moment</i>`);
                    const ok = compressVideo(downloadedPath, compressedPath, 45);
                    if (ok && fs.existsSync(compressedPath)) {
                        const newSize = fs.statSync(compressedPath).size / 1024 / 1024;
                        console.log('[YOUTUBE] Compressed size:', newSize.toFixed(2), 'MB');
                        sendPath = compressedPath;
                    } else {
                        throw new Error('Compression failed');
                    }
                }

                await updateStatus('📤 <b>Sending video...</b>');
                const buffer = fs.readFileSync(sendPath);
                const caption = `🎬 ${escapeHTML(title.substring(0, 120))}\n` +
                    (uploader ? `👤 @${escapeHTML(uploader)}\n` : '') +
                    `\n🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`;

                const result = await ctx.bridge.sendVideoBuffer(ctx.chatId, buffer, { caption, parse_mode: 'HTML' });
                console.log('[YOUTUBE] Send result:', result?.success, result?.data?.message_id);

                if (result?.success) {
                    await ctx.bridge.deleteMessage(ctx.chatId, statusId).catch(() => {});
                } else {
                    throw new Error('Send failed');
                }
            }

        } catch (err) {
            console.error('[YOUTUBE] Error:', err.message);
            await updateStatus(`❌ <b>Failed</b>\n\n${err.message.includes('private') || err.message.includes('unavailable') ? 'Video is private or unavailable.' : 'Could not download — try a shorter video or use /ytaudio.'}`);
        } finally {
            try { if (fs.existsSync(path.join(tmpDir, `yt_${uid}_raw.mp4`))) fs.unlinkSync(path.join(tmpDir, `yt_${uid}_raw.mp4`)); } catch {}
            try { if (fs.existsSync(compressedPath)) fs.unlinkSync(compressedPath); } catch {}
            // Clean any other temp files from this uid
            try { fs.readdirSync(tmpDir).filter(f => f.startsWith(`yt_${uid}`)).forEach(f => { try { fs.unlinkSync(path.join(tmpDir, f)); } catch {} }); } catch {}
        }
    }
};
