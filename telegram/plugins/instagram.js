const { TMP, COOKIES } = require('./_media.js');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

function dlInstagram(url) {
    return new Promise((res, rej) => {
        const ts = Date.now();
        const out = path.join(TMP, 'ig_' + ts + '.%(ext)s');
        const cmd = [
            'yt-dlp --no-playlist',
            '-o "' + out + '"',
            '-f "1/best"',
            '--max-filesize 48M',
            '"' + url + '"'
        ].join(' ');
        exec(cmd, { timeout: 120000 }, (err, stdout, stderr) => {
            if (err) return rej(new Error(stderr?.substring(0, 200) || err.message));
            const files = fs.readdirSync(TMP).filter(f => f.startsWith('ig_' + ts));
            if (!files.length) return rej(new Error('No file found'));
            const found = path.join(TMP, files[0]);
            setTimeout(() => { try { fs.unlinkSync(found); } catch {} }, 300000);
            res(found);
        });
    });
}

module.exports = {
    name: 'instagram',
    aliases: ['ig', 'insta', 'reel'],
    description: 'Download Instagram reels & posts',
    category: 'Media',
    usage: '/ig <url>',

    handler: async (ctx) => {
        const url = ctx.args[0];
        if (!url || !url.includes('instagram'))
            return ctx.replyHTML(
                '📸 <b>Instagram Downloader</b>\n\n' +
                'Send me a public Instagram reel or post link!\n\n' +
                '<code>/ig https://instagram.com/reel/...</code>\n\n' +
                '<i>⚠️ Only public posts can be downloaded.</i>'
            );

        await ctx.action('upload_video');
        const proc = await ctx.replyHTML('📸 <i>Fetching Instagram content...</i>');
        const edit = (t) => ctx.bridge.editMessage(ctx.chatId, proc?.data?.message_id, t, { parse_mode: 'HTML' }).catch(() => {});

        try {
            await edit('📸 <i>Downloading... hang tight!</i>');
            const filePath = await dlInstagram(url);
            const buf = fs.readFileSync(filePath);
            await ctx.bridge.deleteMessage(ctx.chatId, proc?.data?.message_id).catch(() => {});
            await ctx.sendVideoBuffer(buf, {
                caption: '📸 <b>Instagram</b>\n\n🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱',
                parse_mode: 'HTML'
            });
        } catch(e) {
            console.error('[INSTA]', e.message);
            await edit(
                '😔 <b>Couldn\'t download this post!</b>\n\n' +
                '• Account may be private\n' +
                '• Post may have been removed\n' +
                '• Try with a direct public reel link\n\n' +
                '<i>🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱</i>'
            );
        }
    }
};
