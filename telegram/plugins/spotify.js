// /spotify <link or song> — Spotify streams are protected, so the song is found on YouTube and sent as audio.
// A Spotify link is turned into its title first (yt-dlp can't open Spotify links, so they always failed).
const https = require('https');
const { tr } = require('../lang/media');

function spotifyTitle(url) {
    return new Promise((resolve) => {
        https.get('https://open.spotify.com/oembed?url=' + encodeURIComponent(url), { timeout: 8000 }, (res) => {
            let d = ''; res.on('data', (c) => d += c);
            res.on('end', () => { try { resolve(JSON.parse(d).title || null); } catch { resolve(null); } });
        }).on('error', () => resolve(null)).on('timeout', function () { this.destroy(); resolve(null); });
    });
}

module.exports = {
    name: 'spotify',
    aliases: ['sp', 'spoti', 'spdl'],
    description: 'Get a song as audio, from a Spotify link or its name',
    category: 'Media',
    usage: '/sp <Spotify link or song name>',

    handler: async (ctx) => {
        const T = tr(ctx);
        let input = ctx.args.join(' ').trim();
        if (!input) return ctx.replyHTML(T('usage', { cmd: '/sp', example: '/sp Kizz Daniel Buga' }));
        if (/open\.spotify\.com\//.test(input)) {
            const title = await spotifyTitle(input.split(/\s/)[0]);
            if (!title) return ctx.replyHTML(T('failed_site', { site: 'Spotify' }));
            input = title;
        }
        ctx.args = [input];
        return ctx.bridge.getCommand('yta').handler(ctx);
    },
};
