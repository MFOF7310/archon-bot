const { TMP, COOKIES } = require('./_media.js');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

function dlInstagramMeta(url) {
    return new Promise((res, rej) => {
        const cmd = 'yt-dlp --no-playlist --dump-json "' + url + '"';
        exec(cmd, { timeout: 30000 }, (err, stdout) => {
            if (err || !stdout) return res(null);
            try { res(JSON.parse(stdout.trim())); } catch { res(null); }
        });
    });
}

function dlInstagram(url) {
    return new Promise((res, rej) => {
        const ts = Date.now();
        const out = path.join(TMP, 'ig_' + ts + '.%(ext)s');
        const cmd = [
            'yt-dlp --no-playlist',
            '-o "' + out + '"',
            '-f "bestvideo+bestaudio/best"',
            '--max-filesize 48M',
            '--merge-output-format mp4',
            '"' + url + '"'
        ].join(' ');
        exec(cmd, { timeout: 120000 }, (err, stdout, stderr) => {
            if (err) return rej(new Error(stderr?.substring(0, 200) || err.message));
            const files = fs.readdirSync(TMP).filter(f => f.startsWith('ig_' + ts));
            if (!files.length) return rej(new Error('No file found'));
            res(path.join(TMP, files[0]));
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
            const [meta, filePath] = await Promise.all([
                dlInstagramMeta(url),
                dlInstagram(url)
            ]);

            const buf = fs.readFileSync(filePath);
            try { fs.unlinkSync(filePath); } catch {}

            const desc = meta?.description || meta?.title || null;
            const uploader = meta?.uploader || meta?.channel || null;
            const caption =
                (desc ? `📸 ${desc.substring(0, 180)}\n` : '📸 <b>Instagram</b>\n') +
                (uploader ? `👤 @${uploader}
` : '') +
                `
🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`;

            await ctx.bridge.deleteMessage(ctx.chatId, proc?.data?.message_id).catch(() => {});
            await ctx.sendVideoBuffer(buf, { caption, parse_mode: 'HTML' });
        } catch(e) {
            console.error('[INSTAGRAM]', e.message);
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
