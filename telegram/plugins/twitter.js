// ================= TWITTER/X DOWNLOADER v1.7.0 =================
const https = require('https');

module.exports = {
    name: 'twitter',
    aliases: ['x', 'tw', 'tweet'],
    handler: async (ctx) => {
        const args = ctx.args || [];
        const url = args[0];
        const version = ctx.client?.version || '1.7.0';
        const botName = ctx.client?.user?.username || 'Architect CG-223';
        const token = ctx.token;
        const chatId = ctx.chatId;
        
        if (!url) {
            await ctx.replyWithHTML(
                `╔══════════════════════════════════╗\n` +
                `║     🐦 TWITTER/X DOWNLOADER 🐦     ║\n` +
                `╚══════════════════════════════════╝\n\n` +
                `<b>Usage:</b> <code>/x &lt;url&gt;</code>\n\n` +
                `<b>Examples:</b>\n` +
                `<code>/x https://x.com/user/status/xxxxx</code>\n` +
                `<code>/tw https://twitter.com/user/status/xxxxx</code>\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🛡️ ${botName} • v${version}`
            );
            return;
        }
        
        await sendTypingIndicator(token, chatId);
        const processingMsg = await ctx.replyWithHTML(`🐦 <i>Fetching Twitter/X media...</i>`);
        
        try {
            const mediaData = await fetchTwitterMedia(url);
            
            if (mediaData && mediaData.mediaUrls && mediaData.mediaUrls.length > 0) {
                await deleteMessage(token, chatId, processingMsg.result.message_id);
                
                let message = `✅ <b>Download Ready!</b>\n\n`;
                message += `👤 <b>Author:</b> @${escapeHTML(mediaData.author || 'Unknown')}\n`;
                message += `📝 <b>Tweet:</b> ${escapeHTML(mediaData.text?.substring(0, 150) || 'No text')}\n\n`;
                message += `<b>📥 Download Links:</b>\n`;
                
                mediaData.mediaUrls.forEach((mediaUrl, i) => {
                    message += `<a href="${mediaUrl}">Media ${i + 1}</a>\n`;
                });
                
                message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                message += `🛡️ ${botName} • v${version}`;
                
                await ctx.replyWithHTML(message);
            } else {
                await ctx.replyWithHTML(`❌ <b>Download Failed</b>\n\nCould not fetch media. Make sure the tweet contains a video or image.`);
            }
        } catch (error) {
            console.error('[Twitter] Error:', error.message);
            await ctx.replyWithHTML(`❌ <b>Error:</b> ${error.message}`);
        }
    }
};

// Fetch Twitter media using free API
function fetchTwitterMedia(url) {
    return new Promise((resolve, reject) => {
        // Extract tweet ID
        const tweetId = url.match(/status\/(\d+)/)?.[1];
        if (!tweetId) {
            reject(new Error('Invalid Twitter URL'));
            return;
        }
        
        // Use Twitter API v2 (free tier - 500k tweets/month)
        // Note: Requires BEARER_TOKEN from developer.twitter.com
        const BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
        
        if (!BEARER_TOKEN) {
            // Fallback to fxtwitter.com (free, no auth)
            const fallbackUrl = `https://api.fxtwitter.com/status/${tweetId}`;
            https.get(fallbackUrl, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.code === 200 && json.tweet) {
                            const mediaUrls = [];
                            if (json.tweet.media?.all) {
                                json.tweet.media.all.forEach(m => mediaUrls.push(m.url));
                            }
                            resolve({
                                author: json.tweet.author.screen_name,
                                text: json.tweet.text,
                                mediaUrls
                            });
                        } else {
                            reject(new Error('Failed to fetch tweet'));
                        }
                    } catch (e) {
                        reject(new Error('Invalid response'));
                    }
                });
            }).on('error', reject);
            return;
        }
        
        // Use official Twitter API if token available
        const apiUrl = `https://api.twitter.com/2/tweets/${tweetId}?expansions=attachments.media_keys&media.fields=url`;
        
        const req = https.request({
            hostname: 'api.twitter.com',
            path: `/2/tweets/${tweetId}?expansions=attachments.media_keys&media.fields=url`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${BEARER_TOKEN}` }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.data) {
                        resolve({
                            author: 'user',
                            text: json.data.text,
                            mediaUrls: json.includes?.media?.map(m => m.url) || []
                        });
                    } else {
                        reject(new Error('No media found'));
                    }
                } catch (e) {
                    reject(new Error('Invalid response'));
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
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