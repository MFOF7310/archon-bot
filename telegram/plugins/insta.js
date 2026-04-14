// ================= INSTAGRAM DOWNLOADER v1.7.0 - YT-DLP EDITION =================
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const https = require('https');

module.exports = {
    name: 'instagram',
    aliases: ['ig', 'insta', 'reel'],
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
                `║     📷 INSTAGRAM DOWNLOADER 📷     ║\n` +
                `╚══════════════════════════════════╝\n\n` +
                `<b>Usage:</b> <code>/ig &lt;url&gt;</code>\n\n` +
                `<b>Examples:</b>\n` +
                `<code>/ig https://www.instagram.com/reel/xxxxx</code>\n` +
                `<code>/ig https://www.instagram.com/p/xxxxx</code>\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🛡️ ${botName} • v${version}`
            );
            return;
        }
        
        await sendTypingIndicator(token, chatId);
        const processingMsg = await ctx.replyWithHTML(`📷 <i>Downloading with yt-dlp (bypasses Instagram limits)...</i>`);
        
        try {
            // 🔥 Use yt-dlp - the ONLY reliable method
            const mediaData = await getInstagramWithYtDlp(url);
            
            if (mediaData && mediaData.url) {
                await deleteMessage(token, chatId, processingMsg.result.message_id);
                
                const fileSize = mediaData.filesize || 0;
                const sizeMB = (fileSize / 1024 / 1024).toFixed(1);
                
                let message = `✅ <b>Download Ready!</b>\n\n`;
                if (mediaData.uploader) message += `👤 <b>Author:</b> @${escapeHTML(mediaData.uploader)}\n`;
                if (mediaData.title) message += `📝 <b>Caption:</b> ${escapeHTML(mediaData.title.substring(0, 150))}\n`;
                message += `🎬 <b>Type:</b> ${mediaData.isVideo ? 'Video/Reel' : 'Image'}\n`;
                if (fileSize > 0) message += `📦 <b>Size:</b> ${sizeMB} MB\n`;
                message += `\n📥 <a href="${mediaData.url}">Click here to Download</a>\n\n`;
                message += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                message += `🛡️ ${botName} • v${version}`;
                
                await ctx.replyWithHTML(message);
            } else {
                throw new Error('No media URL found');
            }
        } catch (error) {
            console.error('[Instagram] yt-dlp error:', error.message);
            
            // Delete processing message
            await deleteMessage(token, chatId, processingMsg.result.message_id);
            
            await ctx.replyWithHTML(
                `❌ <b>Download Failed</b>\n\n` +
                `Instagram's anti-bot protection blocked the request.\n\n` +
                `<b>💡 Solution:</b>\n` +
                `• Make sure the post is <b>public</b>\n` +
                `• Try again in a few minutes\n` +
                `• If it keeps failing, Instagram may have changed their API\n\n` +
                `<i>yt-dlp updates regularly to fix this!</i>`
            );
        }
    }
};

// 🔥 BULLETPROOF: Use yt-dlp for Instagram
async function getInstagramWithYtDlp(url) {
    try {
        // yt-dlp handles Instagram's anti-bot protection automatically
        const { stdout } = await execAsync(`yt-dlp -j --no-playlist "${url}"`, {
            timeout: 30000,
            maxBuffer: 1024 * 1024 * 5 // 5MB buffer
        });
        
        const info = JSON.parse(stdout);
        
        // Check if it's a video or image
        const isVideo = info.ext === 'mp4' || info.ext === 'webm' || 
                       (info.formats && info.formats.some(f => f.vcodec !== 'none'));
        
        // Get the best format
        const format = info.formats?.find(f => f.vcodec !== 'none') || info.formats?.[0];
        
        return {
            url: format?.url || info.url,
            title: info.title || info.description,
            uploader: info.uploader,
            isVideo: isVideo,
            filesize: format?.filesize || info.filesize,
            ext: info.ext
        };
    } catch (error) {
        console.error('[yt-dlp] Error:', error.message);
        return null;
    }
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