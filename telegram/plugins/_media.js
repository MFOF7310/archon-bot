const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const TMP = '/tmp/archon_tg';
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });

const COOKIES = '--cookies /opt/youtube_cookies.txt';

function clean(f) { setTimeout(() => { try { fs.unlinkSync(f); } catch {} }, 300000); }

// Download video with true quality enforcement
async function dlVideo(url, quality = '720') {
    const ts = Date.now();
    const outTemplate = path.join(TMP, `vid_${ts}.%(ext)s`);
    const cmd = [
        `yt-dlp ${COOKIES}`,
        `-o "${outTemplate}"`,
        `-f "bestvideo[height<=${quality}][height>=${Math.floor(quality*0.8)}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${quality}][ext=mp4]+bestaudio/bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]"`,
        `--merge-output-format mp4`,
        `--postprocessor-args "ffmpeg:-c:v libx264 -c:a aac -movflags +faststart"`,
        `--hls-prefer-ffmpeg`,
        `--no-playlist`,
        `--max-filesize 48M`,
        `"${url}"`
    ].join(' ');

    await new Promise((res, rej) =>
        exec(cmd, { timeout: 300000 }, (err, stdout, stderr) => {
            if (err) { console.error('[MEDIA DL]', stderr?.substring(0, 200)); rej(err); }
            else res();
        })
    );

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
    const cmd = [
        `yt-dlp ${COOKIES}`,
        `-o "${outTemplate}"`,
        `-x --audio-format mp3 --audio-quality 0`,
        `--no-playlist`,
        `--max-filesize 48M`,
        `"${url}"`
    ].join(' ');

    await new Promise((res, rej) =>
        exec(cmd, { timeout: 120000 }, (err) => err ? rej(err) : res())
    );

    const files = fs.readdirSync(TMP).filter(f => f.startsWith(`aud_${ts}`));
    if (!files.length) throw new Error('No audio file found');
    const found = path.join(TMP, files[0]);
    clean(found);
    return found;
}

// Get video metadata + actual available qualities
async function getInfo(url) {
    return new Promise((res) => {
        exec(
            `yt-dlp ${COOKIES} --no-playlist --print "%(title)s|||%(duration>%M:%S)s|||%(uploader)s|||%(filesize_approx)s" "${url}"`,
            { timeout: 30000 }, (err, stdout) => {
                if (err) return res({});
                const parts = stdout.trim().split('|||');
                res({
                    title: parts[0]?.trim(),
                    duration: parts[1]?.trim(),
                    uploader: parts[2]?.trim(),
                    filesize: parseInt(parts[3]) || 0
                });
            }
        );
    });
}

// Get available format heights for a video
async function getAvailableQualities(url) {
    return new Promise((res) => {
        exec(
            `yt-dlp ${COOKIES} --no-playlist -F "${url}"`,
            { timeout: 30000 }, (err, stdout) => {
                if (err) return res([720]);
                const heights = new Set();
                const lines = stdout.split('\n');
                for (const line of lines) {
                    const m = line.match(/\s(\d{3,4})p?\s/);
                    if (m) {
                        const h = parseInt(m[1]);
                        if ([360, 480, 720, 1080, 1440, 2160].includes(h)) heights.add(h);
                    }
                }
                res(heights.size ? [...heights].sort((a,b) => a-b) : [360, 720]);
            }
        );
    });
}

module.exports = { dlVideo, dlAudio, getInfo, getAvailableQualities, clean, TMP, COOKIES };
