const { TMP, COOKIES } = require('./_media.js');
const { shq } = require('../safe');
const { exec, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

function dlFacebook(url) {
    return new Promise((res, rej) => {
        const ts = Date.now();
        const out = path.join(TMP, 'fb_' + ts + '.%(ext)s');
        const cmd = [
            'yt-dlp --no-playlist',
            COOKIES,
            '-o "' + out + '"',
            '-f "hd/sd/best"',
            '--merge-output-format mp4',
            '--max-filesize 48M',
            shq(url)
        ].join(' ');
        exec(cmd, { timeout: 120000 }, (err, stdout, stderr) => {
            if (err) {
                const msg = stderr?.substring(0, 200) || err.message;
                if (msg.includes('Cannot parse data') || msg.includes('Unsupported URL')) {
                    return rej(new Error('❌ This Facebook video cannot be downloaded. It may be private, a Reel, or temporarily unsupported.'));
                }
                return rej(new Error(msg));
            }
            const files = fs.readdirSync(TMP).filter(f => f.startsWith('fb_' + ts));
            if (!files.length) return rej(new Error('No file found'));
            const found = path.join(TMP, files[0]);
            setTimeout(() => { try { fs.unlinkSync(found); } catch {} }, 300000);
            res(found);
        });
    });
}

function isPrivateUrl(url) {
    return url.includes('privacy=friends') ||
           url.includes('privacy=FRIENDS') ||
           url.includes('set=a.') ; // album/private post
}



const https = require('https');
function resolveFacebookUrl(url) {
    return new Promise((resolve) => {
        if (!url.includes('/share/')) return resolve(url);
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                // On nettoie l'URL pour ne garder que l'essentiel (story_fbid et id)
                const loc = res.headers.location;
                const match = loc.match(/story_fbid=(\d+)&id=(\d+)/);
                if (match) {
                    return resolve(`https://www.facebook.com/story.php?story_fbid=${match[1]}&id=${match[2]}`);
                }
                return resolve(loc.split('&')[0]); // Fallback: enlève les params de tracking
            }
            resolve(url);
        }).on('error', () => resolve(url));
    });
}

async function getFacebookImages(url) {
    // 1. Résoudre le lien de partage (/share/p/...) en URL canonique
    let canonicalUrl = await resolveFacebookUrl(url);
    // 2. FORCER permalink.php (gallery-dl ne supporte pas story.php pour les images)
    canonicalUrl = canonicalUrl.replace('story.php', 'permalink.php');
    console.log('[FACEBOOK] Final URL for gallery-dl:', canonicalUrl);

    return new Promise((resolve, reject) => {
        // 3. Retirer le filtre "width" qui cause des bugs dans exec()
        const cmd = `/root/.local/bin/gallery-dl --cookies /opt/youtube_cookies.txt --range 1-10 -g ${shq(canonicalUrl)}`;
        exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
            if (err) {
                console.log('[FACEBOOK] gallery-dl error:', stderr || err.message);
                return reject(new Error('gallery-dl failed'));
            }
            const urls = stdout.split('\n').filter(line => line.startsWith('http') && /\.(jpg|jpeg|png|webp)/i.test(line));
            if (!urls.length) return reject(new Error('No images found'));
            resolve(urls);
        });
    });
}

const { progress, caption } = require('../ui');
const { tr } = require('../lang/media');

module.exports = {
    name: 'facebook',
    aliases: ['fb', 'fbdl'],
    description: 'Download a public Facebook video or the pictures of a post',
    category: 'Media',
    usage: '/fb <link>',

    handler: async (ctx) => {
        const T = tr(ctx);
        const url = String(ctx.args[0] || '');
        if (!url) return ctx.replyHTML(T('usage', { cmd: '/fb', example: '/fb https://www.facebook.com/…/videos/…' }));
        if (!/facebook\.com|fb\.watch/.test(url)) return ctx.replyHTML(T('wrong_site', { site: 'Facebook' }));
        if (isPrivateUrl(url)) return ctx.replyHTML(T('failed_private'));

        const st = await progress(ctx, T('getting', { what: T('what_video') }));

        // A post that isn't a video: its pictures as an album
        const isVideo = /\/videos\/|\/watch|\/reel\//.test(url);
        if (!isVideo) {
            try {
                await ctx.action('upload_photo');
                const imgs = await getFacebookImages(url);
                for (let i = 0; i < imgs.length; i += 10) {
                    const group = imgs.slice(i, i + 10).map((u) => ({ type: 'photo', media: u }));
                    if (i === 0) { group[0].caption = caption('Facebook', T('album', { n: imgs.length })); group[0].parse_mode = 'HTML'; }
                    await ctx.bridge.sendMediaGroup(ctx.chatId, group);
                }
                return st.done();
            } catch (e) {
                console.log('[FACEBOOK] no pictures, trying as a video:', e.message);
            }
        }

        await ctx.action('upload_video');
        try {
            const file = await dlFacebook(url);
            await st.set(T('sending'));
            await ctx.sendVideoBuffer(fs.readFileSync(file), { caption: caption('Facebook', 'Facebook'), parse_mode: 'HTML' });
            return st.done();
        } catch (e) {
            console.error('[FACEBOOK]', e.message);
            return st.end(T('failed_site', { site: 'Facebook' }));
        }
    },
};
