const { storeUrl } = require('./ytv.js');
const { shq } = require('../safe');

const { progress, esc } = require('../ui');
const { tr } = require('../lang/media');

module.exports = {
    name: 'yts',
    aliases: ['ytsearch', 'ysearch', 'ys'],
    description: 'Search YouTube and download a result',
    category: 'Media',
    usage: '/yts <search>',

    handler: async (ctx) => {
        const T = tr(ctx);
        const query = ctx.args.join(' ').trim();
        if (!query) return ctx.replyHTML(T('usage_yts'));

        await ctx.action('typing');
        const st = await progress(ctx, T('looking'));
        try {
            const out = await new Promise((res, rej) => require('child_process').exec(
                `yt-dlp --cookies /opt/youtube_cookies.txt ${shq('ytsearch5:' + query)} --print "%(title)s|||%(webpage_url)s|||%(duration_string)s|||%(uploader)s" --no-playlist --flat-playlist`,
                { timeout: 30000 }, (err, stdout) => err ? rej(err) : res(stdout)));
            const rows = String(out).trim().split('\n').filter(Boolean).map((l) => l.split('|||')).filter((r) => r[1]);
            if (!rows.length) return st.end(T('no_results', { q: query.slice(0, 40) }));

            // One line per result; its button opens the quality choice in this same message
            const lines = rows.map(([title, , dur, who], i) => `<b>${i + 1}.</b> ${esc((title || '?').slice(0, 60))}\n<i>${esc([who, dur].filter(Boolean).join(' · '))}</i>`);
            const kb = rows.map(([title, url], i) => [{ text: `${i + 1}. ${String(title || '?').slice(0, 40)}`, callback_data: `ytdl:v::${storeUrl(url)}` }]);
            return st.end(`${T('results', { q: query.slice(0, 40) })}\n\n${lines.join('\n\n')}\n\n<i>${T('pick_result')}</i>`, { inline_keyboard: kb });
        } catch (e) {
            console.error('[YTS]', e.message);
            return st.end(T('no_results', { q: query.slice(0, 40) }));
        }
    },
};
