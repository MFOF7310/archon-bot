// ═══════════════════════════════════════════
//  TG COMMAND: TikTok / Douyin Downloader
// ═══════════════════════════════════════════

const https = require('https');

function escapeHTML(t) { return !t || typeof t !== 'string' ? '' : t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

module.exports = {
    name: 'douyin',
    description: 'Download TikTok & Douyin videos in HD',
    category: 'Media',
    usage: '/douyin <url>',
    aliases: ['dy', 'tiktok', 'tt', 'tik'],

    handler: async (ctx) => {
        const url = ctx.args[0]?.split('?')[0];
        const cmd = ctx.message.text?.split(' ')[0]?.toLowerCase() || '/douyin';
        const platform = cmd.includes('tt') || cmd.includes('tik') ? 'TikTok' : 'Douyin';

        if (!url) {
            return ctx.replyHTML(`🎬 <b>${platform} Downloader</b>\n\n<code>/${cmd.replace('/', '')} &lt;url&gt;</code>`);
        }

        await ctx.action('upload_video');
        const proc = await ctx.replyHTML(`🎬 <i>Downloading ${platform} video...</i>`);

        try {
            let info = await fetchTikWM(url);
            if (!info && platform === 'Douyin') info = await douyinFallback(url);
            if (!info) info = await neuralGridFallback(url);
            if (!info?.url) throw new Error('All methods failed');

            await ctx.bridge.deleteMessage(ctx.chatId, proc.result?.message_id || proc);

            const caption = `✅ <b>${platform} Video</b>\n\n` +
                (info.title ? `🎬 <b>Title:</b> ${escapeHTML(info.title.substring(0, 100))}\n` : '') +
                (info.uploader ? `👤 <b>Author:</b> @${escapeHTML(info.uploader)}\n` : '') +
                (info.duration ? `⏱️ <b>Duration:</b> ${info.duration}s\n` : '') +
                `\n🛡️ Archon CG-223 · v3.0.0`;

            try {
                await ctx.sendVideo(info.url, { caption, parse_mode: 'HTML' });
            } catch {
                await ctx.sendDoc(info.url, { caption: caption + '\n\n📁 Download to watch', parse_mode: 'HTML' });
            }
        } catch (err) {
            await ctx.bridge.deleteMessage(ctx.chatId, proc.result?.message_id || proc);
            ctx.replyHTML(`❌ <b>Download Failed</b>\n\n${platform}'s protection blocked all attempts.\nTry a different video.`);
        }
    }
};

function requestJSON(url, opts = {}) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https:') ? https : require('http');
        const req = lib.request(url, { method: opts.method || 'GET', headers: opts.headers || {}, timeout: opts.timeout || 15000 }, (res) => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        req.end();
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
