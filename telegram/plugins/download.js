// /dl <link> — finds the right downloader for the link. Without a link: the list of supported sites.
const { tr } = require('../lang/media');

const PLATFORMS = [
    { match: ['youtube.com', 'youtu.be'], cmd: 'ytv', name: '🔴 YouTube' },
    { match: ['instagram.com'], cmd: 'instagram', name: '📸 Instagram' },
    { match: ['tiktok.com', 'douyin.com', 'vm.tiktok'], cmd: 'douyin', name: '🎵 TikTok · Douyin' },
    { match: ['facebook.com', 'fb.watch'], cmd: 'facebook', name: '📘 Facebook' },
    { match: ['twitter.com', 'x.com'], cmd: 'twitter', name: '🐦 X (Twitter)' },
    { match: ['snapchat.com'], cmd: 'snapchat', name: '👻 Snapchat Spotlight' },
    { match: ['vimeo.com'], cmd: 'vimeo', name: '🎬 Vimeo' },
];

module.exports = {
    name: 'download',
    aliases: ['dl', 'media', 'get', 'save'],
    description: 'Download from a link: YouTube, Instagram, TikTok, Facebook, X, Snapchat, Vimeo',
    category: 'Media',
    usage: '/dl <link>',

    handler: async (ctx) => {
        const T = tr(ctx);
        const url = String(ctx.args[0] || '');
        const sites = PLATFORMS.map((p) => p.name).join('\n') + '\n\n<i>/yta · /yts · /spotify</i>';
        if (!url) return ctx.replyHTML(T('dl_sites', { list_html: sites }));
        let host = '';
        try { host = new URL(url).hostname.replace(/^www\./, ''); } catch {}
        const p = PLATFORMS.find((x) => x.match.some((m) => host === m || host.endsWith('.' + m)));
        if (!p) return ctx.replyHTML(T('dl_sites', { list_html: sites }));
        ctx.args = [url];
        return ctx.bridge.getCommand(p.cmd).handler(ctx);
    },
};
