module.exports = {
    name: 'download',
    aliases: ['dl', 'media', 'get', 'save'],
    description: 'Download media from any supported platform',
    category: 'Media',
    usage: '/dl <url>',

    handler: async (ctx) => {
        const url = ctx.args[0];

        // No URL — show beautiful menu
        if (!url) {
            const { ActionRowBuilder, InlineKeyboard } = require('../bridge.js');
            
            await ctx.bridge.sendTo(ctx.chatId, 
                `🌐 <b>ARCHON Media Downloader</b>\n━━━━━━━━━━━━━━━━\n\n` +
                `Send me any link from these platforms and I'll download it!\n\n` +
                `📹 <b>Video</b>\n` +
                `• 🔴 YouTube — <code>/ytv &lt;url&gt;</code>\n` +
                `• 📸 Instagram — <code>/ig &lt;url&gt;</code>\n` +
                `• 🐦 Twitter/X — <code>/tw &lt;url&gt;</code>\n` +
                `• 📘 Facebook — <code>/fb &lt;url&gt;</code>\n` +
                `• 👻 Snapchat — <code>/snap &lt;url&gt;</code>\n` +
                `• 🎬 Vimeo — <code>/vimeo &lt;url&gt;</code>\n` +
                `• 🎵 TikTok — <code>/tiktok &lt;url&gt;</code>\n\n` +
                `🎵 <b>Audio</b>\n` +
                `• 🎵 YouTube MP3 — <code>/yta &lt;url or song name&gt;</code>\n` +
                `• 🟢 Spotify — <code>/sp &lt;song name&gt;</code>\n\n` +
                `🔍 <b>Search</b>\n` +
                `• 🔴 YouTube Search — <code>/yts &lt;query&gt;</code>\n\n` +
                `💡 Or just paste any supported URL directly!\n\n` +
                `🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`,
                { 
                    parse_mode: 'HTML',
                    extra: {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: '🔴 YouTube', callback_data: 'dl_help_ytv' },
                                    { text: '📸 Instagram', callback_data: 'dl_help_ig' },
                                ],
                                [
                                    { text: '🐦 Twitter/X', callback_data: 'dl_help_tw' },
                                    { text: '📘 Facebook', callback_data: 'dl_help_fb' },
                                ],
                                [
                                    { text: '👻 Snapchat', callback_data: 'dl_help_snap' },
                                    { text: '🎵 TikTok', callback_data: 'dl_help_tiktok' },
                                ],
                                [
                                    { text: '🎵 YouTube MP3', callback_data: 'dl_help_yta' },
                                    { text: '🔍 YT Search', callback_data: 'dl_help_yts' },
                                ],
                            ]
                        }
                    }
                }
            );
            return;
        }

        // Auto-detect platform and download
        await ctx.action('upload_video');

        const platforms = [
            { match: ['youtube.com', 'youtu.be'], cmd: 'ytv' },
            { match: ['instagram.com'], cmd: 'instagram' },
            { match: ['twitter.com', 'x.com'], cmd: 'twitter' },
            { match: ['facebook.com', 'fb.watch'], cmd: 'facebook' },
            { match: ['snapchat.com'], cmd: 'snapchat' },
            { match: ['tiktok.com', 'douyin.com', 'vm.tiktok'], cmd: 'douyin' },
            { match: ['vimeo.com'], cmd: 'vimeo' },
        ];

        const matched = platforms.find(p => p.match.some(m => url.includes(m)));

        if (matched) {
            // Route to the correct plugin
            try {
                const plugin = require(`./${matched.cmd}.js`);
                ctx.args = [url];
                await plugin.handler(ctx);
            } catch(e) {
                await ctx.replyHTML(`❌ Couldn't download that — try the specific command instead!`);
            }
        } else {
            await ctx.replyHTML(
                `❓ I don't recognize that platform yet!\n\n` +
                `Use <code>/dl</code> to see all supported platforms 📋`
            );
        }
    }
};
