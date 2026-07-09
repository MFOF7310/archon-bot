const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const TMP = '/tmp/archon_tg';
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });

function clean(f) { setTimeout(() => { try { fs.unlinkSync(f); } catch {} }, 300000); }

// Download video with audio merged
async function dlVideo(url, quality = '720') {
    const ts = Date.now();
    const outTemplate = path.join(TMP, `vid_${ts}.%(ext)s`);
    const cmd = [
        'yt-dlp',
        `-o "${outTemplate}"`,
        `-f "bestvideo[height<=${quality}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]/best"`,
        `--merge-output-format mp4`,
        `--postprocessor-args "ffmpeg:-c:v libx264 -c:a aac -movflags +faststart"`,
        `--no-playlist`,
        `--max-filesize 50M`,
        `"${url}"`
    ].join(' ');

    await new Promise((res, rej) =>
        exec(cmd, { timeout: 300000 }, (err, stdout, stderr) => {
            if (err) {
                console.error('[MEDIA DL]', stderr?.substring(0, 200));
                rej(err);
            } else res();
        })
    );

    // Find output file
    const files = fs.readdirSync(TMP).filter(f => f.startsWith(`vid_${ts}`));
    if (!files.length) throw new Error('No output file found');
    const found = path.join(TMP, files[0]);
    clean(found);
    return found;
}

// Download audio only
async function dlAudio(url) {
    const ts = Date.now();
    const outTemplate = path.join(TMP, `aud_${ts}.%(ext)s`);
    const cmd = `yt-dlp -o "${outTemplate}" -x --audio-format mp3 --audio-quality 0 --no-playlist --max-filesize 50M "${url}"`;

    await new Promise((res, rej) =>
        exec(cmd, { timeout: 120000 }, (err) => err ? rej(err) : res())
    );

    const files = fs.readdirSync(TMP).filter(f => f.startsWith(`aud_${ts}`));
    if (!files.length) throw new Error('No audio file found');
    const found = path.join(TMP, files[0]);
    clean(found);
    return found;
}

// Get video metadata
async function getInfo(url) {
    return new Promise((res) => {
        exec(`yt-dlp --no-playlist --print "%(title)s|||%(duration>%M:%S)s|||%(uploader)s|||%(description)s" "${url}"`,
            { timeout: 30000 }, (err, stdout) => {
                if (err) return res({});
                const parts = stdout.trim().split('|||');
                res({
                    title: parts[0]?.trim(),
                    duration: parts[1]?.trim(),
                    uploader: parts[2]?.trim(),
                    description: parts[3]?.trim()?.substring(0, 200)
                });
            });
    });
}

module.exports = { dlVideo, dlAudio, getInfo, clean, TMP };
