// ================= DOUYIN / TIKTOK UNIFIED DOWNLOADER v1.7.0 =================
// ELITE NEURAL GRID EDITION - Clean URLs, POST support, proxy masking!
const https = require('https');

module.exports = {
    name: 'douyin',
    aliases: ['dy', 'douyin', 'tiktok', 'tt', 'tik'],
    handler: async (ctx) => {
        // 🔥 CRITICAL: Ignore messages from bots (including self!)
        if (ctx.message.from.is_bot) return;
        
        const args = ctx.args || [];
        // 🔥 NEW: Clean URL (remove tracking parameters)
        const rawUrl = args[0];
        const url = cleanUrl(rawUrl);
        const version = ctx.client?.version || '1.7.0';
        const botName = ctx.client?.user?.username || 'Architect CG-223';
        const token = ctx.token;
        const chatId = ctx.chatId;
        
        // Detect which command was used
        const command = ctx.message.text?.split(' ')[0]?.toLowerCase() || '/douyin';
        const platform = command.includes('tt') || command.includes('tik') ? 'TikTok' : 'Douyin';
        
        if (!url) {
            await ctx.replyWithHTML(
                `╔══════════════════════════════════╗\n` +
                `║   🎬 ${platform.toUpperCase()} DOWNLOADER 🎬   ║\n` +
                `╚══════════════════════════════════╝\n\n` +
                `<b>Usage:</b>\n` +
                `<code>/${command.replace('/', '')} &lt;url&gt;</code>\n\n` +
                `<b>Examples:</b>\n` +
                `<code>/dy https://v.douyin.com/xxxxx</code>\n` +
                `<code>/tt https://vm.tiktok.com/xxxxx</code>\n` +
                `<code>/tiktok https://www.tiktok.com/@user/video/123456</code>\n\n` +
                `<b>📌 Aliases:</b> /dy, /douyin, /tt, /tiktok, /tik\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🛡️ ${botName} • v${version}`
            );
            return;
        }
        
        await sendTypingIndicator(token, chatId);
        const processingMsg = await ctx.replyWithHTML(`🎬 <i>Downloading ${platform} video...</i>`);
        
        try {
            // 🔥 PRIMARY: TikWM API (Fast, reliable)
            const videoInfo = await getVideoWithTikWM(url);
            
            if (videoInfo && videoInfo.url) {
                await deleteMessage(token, chatId, processingMsg.result.message_id);
                
                const fileSize = videoInfo.filesize || 0;
                const sizeMB = (fileSize / 1024 / 1024).toFixed(1);
                
                let message = `✅ <b>${platform} Video Ready!</b>\n\n`;
                if (videoInfo.title) message += `🎬 <b>Title:</b> ${escapeHTML(videoInfo.title.substring(0, 100))}\n`;
                if (videoInfo.uploader) message += `👤 <b>Author:</b> @${escapeHTML(videoInfo.uploader)}\n`;
                if (videoInfo.duration) message += `⏱️ <b>Duration:</b> ${videoInfo.duration}s\n`;
                if (fileSize > 0) message += `📦 <b>Size:</b> ${sizeMB} MB\n`;
                
                message += `\n📥 <a href="${videoInfo.url}">Click here to Download (No Watermark)</a>\n\n`;
                message += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                message += `🛡️ ${botName} • v${version}`;
                
                await ctx.replyWithHTML(message);
                console.log(`[${platform}] ✅ Downloaded via TikWM API`);
                return;
            }
        } catch (error) {
            console.error(`[${platform}] TikWM error:`, error.message);
        }
        
        // 🔥 FALLBACK 1: Douyin Mobile API (for Douyin only)
        if (platform === 'Douyin') {
            try {
                console.log(`[Douyin] Trying Mobile API fallback...`);
                const fallbackData = await douyinMobileAPI(url);
                
                if (fallbackData && fallbackData.videoUrl) {
                    await deleteMessage(token, chatId, processingMsg.result.message_id);
                    await ctx.replyWithHTML(
                        `✅ <b>Douyin Video Downloaded!</b> (Mobile API)\n\n` +
                        `📥 <a href="${fallbackData.videoUrl}">Click here to download</a>\n\n` +
                        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                        `🛡️ ${botName} • v${version}`
                    );
                    console.log(`[Douyin] ✅ Downloaded via Mobile API`);
                    return;
                }
            } catch (e) {
                console.error(`[Douyin] Mobile API failed:`, e.message);
            }
        }
        
        // 🔥 FALLBACK 2: NEURAL GRID - Multiple endpoints with proxy masking
        try {
            console.log(`[${platform}] Activating Neural Grid fallback...`);
            const fallbackData = await neuralGridFallback(url, platform);
            
            if (fallbackData && fallbackData.videoUrl) {
                await deleteMessage(token, chatId, processingMsg.result.message_id);
                await ctx.replyWithHTML(
                    `✅ <b>${platform} Video Downloaded!</b> (Neural Grid)\n\n` +
                    `📥 <a href="${fallbackData.videoUrl}">Click here to download</a>\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🛡️ ${botName} • v${version}`
                );
                console.log(`[${platform}] ✅ Downloaded via Neural Grid`);
                return;
            }
        } catch (e) {
            console.error(`[${platform}] Neural Grid failed:`, e.message);
        }
        
        // All attempts failed
        await deleteMessage(token, chatId, processingMsg.result.message_id);
        await ctx.replyWithHTML(
            `❌ <b>Download Failed</b>\n\n` +
            `${platform}'s anti-bot protection blocked all attempts.\n\n` +
            `<b>💡 Tips:</b>\n` +
            `• Try a different video\n` +
            `• Wait a few minutes and try again\n` +
            `• Make sure the video is public\n\n` +
            `<i>Neural Grid exhausted all endpoints!</i>`
        );
    }
};

// 🔥 PRIMARY API: TikWM (Fast, reliable)
async function getVideoWithTikWM(url) {
    try {
        const data = await fetchWithTimeout(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
        if (data && data.code === 0 && data.data) {
            return {
                url: data.data.play || data.data.wmplay,
                title: data.data.title,
                uploader: data.data.author?.nickname || data.data.author || 'Creator',
                duration: data.data.duration,
                filesize: data.data.size
            };
        }
    } catch (e) {}
    return null;
}

// 🔥 Douyin Mobile API (iPhone user-agent)
async function douyinMobileAPI(url) {
    const videoId = extractDouyinId(url);
    if (!videoId) return null;
    
    try {
        const data = await fetchWithTimeout(
            `https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${videoId}`,
            {
                'Referer': 'https://www.douyin.com/',
                'Accept-Language': 'zh-CN,zh;q=0.9'
            }
        );
        
        const item = data?.item_list?.[0];
        if (item && item.video) {
            const videoUrl = item.video.play_addr?.url_list?.[0] || 
                            item.video.download_addr?.url_list?.[0];
            
            if (videoUrl) {
                const cleanUrl = videoUrl.replace('watermark=1', 'watermark=0')
                                       .replace(/\.watermark\./, '.');
                return { videoUrl: cleanUrl };
            }
        }
    } catch (e) {}
    return null;
}

// 🔥 NEURAL GRID: Multiple endpoints with proxy masking
async function neuralGridFallback(url, platform) {
    // Multiple endpoints to try
    const endpoints = [
        {
            url: `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`,
            method: 'GET'
        },
        {
            url: `https://api.tik.fail/v1/download?url=${encodeURIComponent(url)}`,
            method: 'GET'
        },
        {
            url: `https://api.douyin.wtf/api?url=${encodeURIComponent(url)}`,
            method: 'GET'
        },
        // Proxy layer via AllOrigins (bypasses IP blocks!)
        {
            url: `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`)}`,
            method: 'GET'
        }
    ];
    
    // Add TikTok-specific endpoint if platform is TikTok
    if (platform === 'TikTok') {
        const tikTokId = extractTikTokId(url);
        if (tikTokId) {
            // 🔥 TikMate API with POST support
            endpoints.push({
                url: `https://tikmate.cc/api/${tikTokId}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': 'https://tikmate.cc',
                    'Referer': 'https://tikmate.cc/'
                }
            });
        }
    }
    
    for (const endpoint of endpoints) {
        try {
            console.log(`[Neural Grid] Trying: ${endpoint.url.substring(0, 50)}...`);
            
            let data;
            if (endpoint.method === 'POST') {
                data = await fetchWithTimeoutPost(endpoint.url, endpoint.headers);
            } else {
                data = await fetchWithTimeout(endpoint.url);
            }
            
            if (data) {
                // Parse different response formats
                let videoUrl = null;
                
                if (data.code === 0 && data.data) {
                    videoUrl = data.data.play || data.data.wmplay || data.data.video_url;
                } else if (data.code === 200 && data.data) {
                    videoUrl = data.data.video_data?.nwm_video_url || data.data.video_url || data.data.url;
                } else if (data.video_url) {
                    videoUrl = data.video_url;
                } else if (data.url) {
                    videoUrl = data.url;
                }
                
                if (videoUrl) {
                    console.log(`[Neural Grid] ✅ Success!`);
                    return { videoUrl };
                }
            }
        } catch (e) {
            console.log(`[Neural Grid] Endpoint failed, trying next...`);
        }
    }
    
    return null;
}

// 🔥 IMPROVED: Fetch with timeout and proper headers (GET)
function fetchWithTimeout(url, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
                'Accept': 'application/json',
                ...extraHeaders
            }
        }, (res) => {
            // Handle redirects
            if (res.statusCode === 301 || res.statusCode === 302) {
                const redirectUrl = res.headers.location;
                if (redirectUrl) {
                    return fetchWithTimeout(redirectUrl, extraHeaders)
                        .then(resolve)
                        .catch(reject);
                }
            }
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    // Try to handle proxy-wrapped JSON
                    try {
                        const cleaned = data.trim().replace(/^[^{]*/, '').replace(/[^}]*$/, '');
                        resolve(JSON.parse(cleaned));
                    } catch (e2) {
                        reject(new Error('Invalid JSON'));
                    }
                }
            });
        });
        
        req.on('error', reject);
        req.setTimeout(12000, () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
    });
}

// 🔥 NEW: Fetch with POST support (for TikMate)
function fetchWithTimeoutPost(url, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Content-Length': 0,
                ...extraHeaders
            }
        };
        
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    try {
                        const cleaned = data.trim().replace(/^[^{]*/, '').replace(/[^}]*$/, '');
                        resolve(JSON.parse(cleaned));
                    } catch (e2) {
                        reject(new Error('Invalid JSON'));
                    }
                }
            });
        });
        
        req.on('error', reject);
        req.setTimeout(12000, () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
        req.end();
    });
}

// 🔥 NEW: Clean URL (remove tracking parameters)
function cleanUrl(url) {
    if (!url) return '';
    // Remove everything after ? (tracking params)
    return url.split('?')[0];
}

// Helper: Extract Douyin Video ID
function extractDouyinId(url) {
    const clean = cleanUrl(url);
    const patterns = [
        /video\/(\d+)/,
        /v\.douyin\.com\/(\w+)/,
        /douyin\.com\/video\/(\d+)/,
        /iesdouyin\.com\/share\/video\/(\d+)/
    ];
    
    for (const pattern of patterns) {
        const match = clean.match(pattern);
        if (match) return match[1];
    }
    return null;
}

// Helper: Extract TikTok Video ID
function extractTikTokId(url) {
    const clean = cleanUrl(url);
    const patterns = [
        /video\/(\d+)/,
        /vm\.tiktok\.com\/(\w+)/,
        /tiktok\.com\/@[\w.-]+\/video\/(\d+)/
    ];
    
    for (const pattern of patterns) {
        const match = clean.match(pattern);
        if (match) return match[1];
    }
    return null;
}

function sendTypingIndicator(token, chatId) {
    return new Promise((resolve) => {
        const data = JSON.stringify({ chat_id: chatId, action: 'typing' });
        const req = https.request({
            hostname: 'api.telegram.org',
            path: `/bot${token}/sendChatAction`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
        }, () => resolve());
        req.on('error', () => resolve());
        req.write(data);
        req.end();
    });
}

function deleteMessage(token, chatId, messageId) {
    return new Promise((resolve) => {
        const req = https.request({
            hostname: 'api.telegram.org',
            path: `/bot${token}/deleteMessage?chat_id=${chatId}&message_id=${messageId}`,
            method: 'POST'
        }, () => resolve());
        req.on('error', () => resolve());
        req.end();
    });
}

function escapeHTML(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}