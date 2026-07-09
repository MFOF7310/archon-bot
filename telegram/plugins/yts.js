module.exports = {
    name: 'yts',
    aliases: ['ytsearch', 'ysearch', 'ys'],
    description: 'Search YouTube',
    category: 'Media',
    usage: '/yts <query>',

    handler: async (ctx) => {
        const query = ctx.args.join(' ');
        if (!query) return ctx.replyHTML(`🔍 <b>YouTube Search</b>\n\n<code>/yts &lt;song or video name&gt;</code>`);

        await ctx.action('typing');
        const proc = await ctx.replyHTML(`🔍 <i>Searching for "${query.substring(0, 40)}"...</i>`);

        try {
            const { exec } = require('child_process');
            const results = await new Promise((res, rej) =>
                exec(`yt-dlp "ytsearch5:${query.replace(/["\']/g, '')}" --print "%(title)s|||%(webpage_url)s|||%(duration>%M:%S)s|||%(uploader)s" --no-playlist --flat-playlist`,
                    { timeout: 30000 }, (err, stdout) => err ? rej(err) : res(stdout))
            );

            const lines = results.trim().split('\n').filter(Boolean);
            if (!lines.length) throw new Error('No results');

            let msg = `🔍 <b>Results for "${query.substring(0, 30)}"</b>\n\n`;
            lines.forEach((line, i) => {
                const [title, url, duration, uploader] = line.split('|||');
                msg += `<b>${i + 1}.</b> <a href="${url}">${(title || '?').substring(0, 55)}</a>\n`;
                msg += `   👤 ${uploader || '?'} • ⏱ ${duration || '?'}\n\n`;
            });
            msg += `💡 Use /ytv or /yta with a link to download!`;

            await ctx.replyHTML(msg);
        } catch(e) {
            console.error('[YTS]', e.message);
            await ctx.replyHTML(`❌ Search came up empty — try different keywords!`);
        }
    }
};
