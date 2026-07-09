const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const TMP = '/tmp/archon_tg';
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });

function clean(f) { setTimeout(() => { try { fs.unlinkSync(f); } catch {} }, 120000); }

// Get direct stream URL from yt-dlp (no download needed for video)
async function getStreamUrl(url, audioOnly = false) {
    return new Promise((res, rej) => {
        const fmt = audioOnly
            ? 'bestaudio[ext=m4a]/bestaudio'
            : 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[ext=mp4]/best';
        exec(`yt-dlp --no-playlist -f "${fmt}" -g "${url}"`, { timeout: 30000 }, (err, stdout) => {
            if (err) return rej(err);
            const urls = stdout.trim().split('\n').filter(Boolean);
            res(urls[0]);
        });
    });
}

// Get video info
async function getInfo(url) {
    return new Promise((res) => {
        exec(`yt-dlp --no-playlist --print "%(title)s|||%(duration>%M:%S)s|||%(uploader)s|||%(view_count)s" "${url}"`,
            { timeout: 30000 }, (err, stdout) => {
                if (err) return res({});
                const [title, duration, uploader, views] = stdout.trim().split('|||');
                res({ title: title?.trim(), duration: duration?.trim(), uploader: uploader?.trim(), views: views?.trim() });
            });
    });
}

// Download to file (fallback for when URL streaming fails)
async function dlFile(url, ext = 'mp4', audioOnly = false) {
    const out = path.join(TMP, `archon_${Date.now()}.${ext}`);
    const fmt = audioOnly
        ? `bestaudio[ext=m4a]/bestaudio`
        : `bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[ext=mp4]/best`;
    const extra = audioOnly ? `-x --audio-format mp3 --audio-quality 0` : `--merge-output-format mp4`;
    await new Promise((res, rej) =>
        exec(`yt-dlp -o "${out}" -f "${fmt}" ${extra} --no-playlist --max-filesize 50M "${url}"`,
            { timeout: 180000 }, (err) => err ? rej(err) : res())
    );
    // Find actual output file (extension might differ)
    const files = fs.readdirSync(TMP).filter(f => f.includes(path.basename(out, '.' + ext)));
    const found = files.length ? path.join(TMP, files[0]) : null;
    if (!found || !fs.existsSync(found)) throw new Error('Download failed');
    clean(found);
    return found;
}

module.exports = { getStreamUrl, getInfo, dlFile, TMP, clean };
