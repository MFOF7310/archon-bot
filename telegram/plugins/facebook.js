const { TMP, COOKIES } = require('./_media.js');
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
            '"' + url + '"'
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
        const cmd = `/root/.local/bin/gallery-dl --cookies /opt/youtube_cookies.txt --range 1-10 -g "${canonicalUrl}"`;
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

module.exports = {
    name: 'facebook',
    aliases: ['fb', 'fbdl'],
    description: 'Download Facebook videos',
    category: 'Media',
    usage: '/fb <url>',

    handler: async (ctx) => {
        const url = ctx.args[0];
        if (!url || (!url.includes('facebook') && !url.includes('fb.watch')))
            return ctx.replyHTML(
                '📘 <b>Facebook Video Downloader</b>\n\n' +
                'Send me a public Facebook video link!\n\n' +
                '<code>/fb https://facebook.com/video/...</code>\n\n' +
                '<i>⚠️ Only public videos can be downloaded.</i>'
            );

        if (isPrivateUrl(url))
            return ctx.replyHTML(
                '🔒 <b>Private Video!</b>\n\n' +
                'This video is private or requires login to view.\n\n' +
                '<b>To download private videos:</b>\n' +
                '• Open the video on Facebook\n' +
                '• Make sure it\'s set to <b>Public</b>\n' +
                '• Copy the direct video link\n\n' +
                '<i>Only public Facebook videos can be downloaded 🦅</i>'
            );

        // Détection : si l'URL ne contient pas /videos/ ou /watch, on tente les images
        const isVideo = url.includes('/videos/') || url.includes('/watch') || url.includes('/reel/');
        
        if (!isVideo) {
            try {
                await ctx.action('upload_photo');
                const imgUrls = await getFacebookImages(url);
                
                if (imgUrls.length > 0) {
                    // Découpage en paquets de 10 pour Telegram
                    const chunks = [];
                    for (let i = 0; i < imgUrls.length; i += 10) {
                        chunks.push(imgUrls.slice(i, i + 10));
                    }
                    
                    for (let i = 0; i < chunks.length; i++) {
                        const group = chunks[i].map(u => ({ type: 'photo', media: u }));
                        if (i === 0) {
                            group[0].caption = '📘 <b>Facebook Images</b>\n\n🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱';
                            group[0].parse_mode = 'HTML';
                        }
                        await ctx.bridge.sendMediaGroup(ctx.chatId, group);
                    }
                    
                    return; // Images envoyées avec succès, sans message de statut
                }
            } catch (e) {
                console.log('[FACEBOOK] Image extraction failed, falling back to video:', e.message);
                // On continue vers la logique vidéo ci-dessous
            }
        }
        
        await ctx.action('upload_video');
        const proc = await ctx.replyHTML('📘 <i>Fetching Facebook video...</i>');
        const edit = (t) => ctx.bridge.editMessage(ctx.chatId, proc?.data?.message_id, t, { parse_mode: 'HTML' }).catch(() => {});

        try {
            await edit('📘 <i>Downloading video... hang tight!</i>');
            const filePath = await dlFacebook(url);
            const buf = fs.readFileSync(filePath);
            await ctx.bridge.deleteMessage(ctx.chatId, proc?.data?.message_id).catch(() => {});
            await ctx.sendVideoBuffer(buf, {
                caption: '📘 <b>Facebook Video</b>\n\n🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱',
                parse_mode: 'HTML'
            });
        } catch(e) {
            console.error('[FACEBOOK]', e.message);
            await edit(
                '😔 <b>Couldn\'t download this video!</b>\n\n' +
                'This could be because:\n' +
                '• Video is private or friends-only\n' +
                '• Link has expired\n' +
                '• Video was removed\n\n' +
                '<i>Try with a direct public video link!\n🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱</i>'
            );
        }
    }
};
