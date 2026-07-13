const { TMP, COOKIES } = require('./_media.js');
const { exec } = require('child_process');
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
            if (err) return rej(new Error(stderr?.substring(0, 200) || err.message));
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
            console.error('[FB]', e.message);
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
