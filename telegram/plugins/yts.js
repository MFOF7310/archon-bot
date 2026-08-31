module.exports = {
    name: 'yts',
    aliases: ['ytsearch', 'ysearch', 'ys'],
    description: 'Search YouTube',
    category: 'Media',
    usage: '/yts <query>',

    handler: async (ctx) => {
        const query = ctx.args.join(' ');
        if (!query) return ctx.replyHTML(
            `🔍 <b>YouTube Search</b>\n\n` +
            `<code>/yts &lt;song or video name&gt;</code>\n\n` +
            `<i>I'll find the top results and let you pick what to download!</i>`
        );

        await ctx.action('typing');
        const proc = await ctx.replyHTML(`🔍 <i>Searching for "${query.substring(0, 40)}"...</i>`);

        try {
            const { exec } = require('child_process');
            const results = await new Promise((res, rej) =>
                exec(
                    `yt-dlp --cookies /opt/youtube_cookies.txt "ytsearch5:${query.replace(/["']/g, '')}" --print "%(title)s|||%(webpage_url)s|||%(duration>%M:%S)s|||%(uploader)s" --no-playlist --flat-playlist`,
                    { timeout: 30000 }, (err, stdout) => err ? rej(err) : res(stdout)
                )
            );

            const lines = results.trim().split('\n').filter(Boolean);
            if (!lines.length) throw new Error('No results');

            let msg = `🔍 <b>Results for "${query.substring(0, 30)}"</b>\n\n`;
            const buttons = [];

            lines.forEach((line, i) => {
                const [title, url, duration, uploader] = line.split('|||');
                const clean = (title || '?').substring(0, 55);
                msg += `<b>${i + 1}.</b> <a href="${url}">${clean}</a>\n`;
                msg += `   👤 ${uploader || '?'} • ⏱ ${duration || '?'}\n\n`;
                buttons.push([
                    { text: `🎬 ${i + 1}. Video`, callback_data: `ytdl:v:720:${url}` },
                    { text: `🎵 ${i + 1}. Audio`, callback_data: `ytdl:a::${url}` }
                ]);
            });

            msg += `<i>Tap a button below to download directly!</i>`;

            await ctx.bridge.editMessage(ctx.chatId, proc?.data?.message_id, msg, {
                parse_mode: 'HTML',
                extra: { reply_markup: { inline_keyboard: buttons } }
            }).catch(async () => {
                await ctx.replyHTML(msg, { extra: { reply_markup: { inline_keyboard: buttons } } });
            });

        } catch(e) {
            console.error('[YTS]', e.message);
            await ctx.bridge.editMessage(ctx.chatId, proc?.data?.message_id,
                `😔 <b>Search came up empty!</b>\n\nTry different keywords — be more specific or check the spelling.`,
                { parse_mode: 'HTML' }
            ).catch(() => {});
        }
    }
};
