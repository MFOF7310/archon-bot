// ═══════════════════════════════════════════
//  TG COMMAND: TikTok / Douyin Downloader
// ═══════════════════════════════════════════

const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

function escapeHTML(t) { return !t || typeof t !== 'string' ? '' : t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

module.exports = {
    name: 'douyin',
    description: 'Download TikTok & Douyin videos in HD',
    category: 'Media',
    usage: '/douyin <url>',
    aliases: ['dy', 'tiktok', 'tt', 'tik'],

    handler: async (ctx) => {
        // Extract URL from message (supports short links in long text)
        const text = ctx.message?.text || ctx.text || '';
        const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
        let url = urlMatch?.[0];
        
        const cmd = ctx.message.text?.split(' ')[0]?.toLowerCase() || '/douyin';
        const platform = cmd.includes('tt') || cmd.includes('tik') ? 'TikTok' : 'Douyin';

        if (!url) {
            return ctx.replyHTML(`🎬 <b>${platform} Downloader</b>\n\nJust send me a ${platform} link and I'll grab it for you!\n\n<code>/${cmd.replace('/', '')} &lt;url&gt;</code>`);
        }

        // Follow redirects for short links (v.douyin.com, vm.tiktok.com, etc.)
        if (url.includes('v.douyin.com') || url.includes('vm.tiktok.com') || url.includes('vt.tiktok.com')) {
            try {
                url = await followRedirect(url);
            } catch(e) {}
        }

        // Extract video ID from iesdouyin redirect
        if (url.includes('iesdouyin.com/share/video/')) {
            const match = url.match(/video\/([\d]+)/);
            if (match) url = `https://www.douyin.com/video/${match[1]}`;
        }
        
        // Clean URL
        url = url.split('?')[0];

        await ctx.action('upload_video');
        const proc = await ctx.replyHTML(`🎬 <i>On it! Grabbing that ${platform} video...</i>`);
        const deleteProc = () => { try { ctx.bridge.deleteMessage(ctx.chatId, proc?.data?.message_id).catch(() => {}); } catch(e) {} };

        try {
            let info = await fetchTikWM(url);
            console.log('[TIKTOK] TikWM result:', info ? 'got data' : 'null', info?.url?.substring(0,50));
            if (!info && platform === 'Douyin') info = await douyinFallback(url);
            if (!info) info = await neuralGridFallback(url);
            console.log('[TIKTOK] Final info:', info?.url?.substring(0,50));
            if (!info?.url) throw new Error('All methods failed');

            const caption = (info.title ? `🎬 ${escapeHTML(info.title.substring(0, 120))}\n` : '') +
                (info.uploader ? `👤 @${escapeHTML(info.uploader)}` : '') +
                `\n\n🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`;

            // Download to buffer — TikTok CDN blocks direct Telegram fetches
            try {
                const buffer = await downloadBuffer(info.url);
                await ctx.bridge.sendVideoBuffer(ctx.chatId, buffer, { caption, parse_mode: 'HTML' });
                deleteProc();
            } catch(dlErr) {
                console.error('[TIKTOK] Send error:', dlErr.message);
                deleteProc();
                await ctx.replyHTML(`❌ Couldn't deliver that video — try again or use a different link.`);
            }
        } catch (err) {
            ctx.replyHTML(`❌ Couldn't grab that one — might be private or region-locked. Try a different video!`);
        }
    }
};

function requestJSON(url, opts = {}) {
    return new Promise((resolve, reject) => {
        const proxyUrl = process.env.PROXY_HOST ? `http://${process.env.PROXY_USER}:${process.env.PROXY_PASS}@${process.env.PROXY_HOST}:${process.env.PROXY_PORT}` : null;
        let lib, reqOpts;
        if (proxyUrl) {
            const { HttpsProxyAgent } = require('https-proxy-agent');
            lib = url.startsWith('https:') ? https : require('http');
            reqOpts = { method: opts.method || 'GET', headers: opts.headers || {}, timeout: opts.timeout || 15000, agent: new HttpsProxyAgent(proxyUrl) };
        } else {
            lib = url.startsWith('https:') ? https : require('http');
            reqOpts = { method: opts.method || 'GET', headers: opts.headers || {}, timeout: opts.timeout || 15000 };
        }
        const req = lib.request(url, reqOpts, (res) => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        req.end();
    });
}

async function followRedirect(url, maxHops = 5) {
    for (let i = 0; i < maxHops; i++) {
        const next = await new Promise((resolve) => {
            const lib = url.startsWith('https:') ? https : require('http');
            const req = lib.request(url, {
                method: 'GET',
                timeout: 10000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36' }
            }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const loc = res.headers.location;
                    resolve(loc.startsWith('http') ? loc : url);
                } else {
                    resolve(null); // no more redirects
                }
                res.resume();
            });
            req.on('error', () => resolve(null));
            req.on('timeout', () => { req.destroy(); resolve(null); });
            req.end();
        });
        if (!next || next === url) break;
        url = next;
    }
    return url;
}

function downloadBuffer(url, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        const get = (u, hops) => {
            if (hops > maxRedirects) return reject(new Error('Too many redirects'));
            const lib = u.startsWith('https:') ? https : require('http');
            lib.get(u, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36', 'Referer': 'https://www.tiktok.com/' } }, res => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return get(res.headers.location, hops + 1);
                }
                if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
                const chunks = [];
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => resolve(Buffer.concat(chunks)));
            }).on('error', reject);
        };
        get(url, 0);
    });
}

async function fetchTikWM(url) {
    try {
        const data = await requestJSON(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=2`);
        if (data?.code === 0 && data.data) {
            return { url: data.data.hdplay || data.data.play, title: data.data.title, uploader: data.data.author?.nickname, duration: data.data.duration };
        }
    } catch { /* silent */ }
    return null;
}

async function douyinFallback(url) {
    try {
        const match = url.match(/\d{18,21}/);
        if (!match) return null;
        const data = await requestJSON(`https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${match[0]}`, {
            headers: { 'Referer': 'https://www.douyin.com/', 'User-Agent': 'Mozilla/5.0 (iPhone)' }
        });
        const item = data?.item_list?.[0];
        const videoUrl = item?.video?.play_addr?.url_list?.[0];
        if (videoUrl) return { url: videoUrl, title: item.desc, uploader: item.author?.nickname };
    } catch { /* silent */ }
    return null;
}

async function neuralGridFallback(url) {
    const endpoints = [
        `https://api.tik.fail/v1/download?url=${encodeURIComponent(url)}`,
        `https://api.douyin.wtf/api?url=${encodeURIComponent(url)}`,
    ];
    for (const ep of endpoints) {
        try {
            const data = await requestJSON(ep);
            const videoUrl = data?.data?.video_url || data?.url || data?.video_url;
            if (videoUrl) return { url: videoUrl };
        } catch { /* silent */ }
    }
    return null;
}
