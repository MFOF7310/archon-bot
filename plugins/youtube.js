// ═══════════════════════════════════════════════════════════════════════════
// /youtube search <query> [results] · /youtube info <link>
//   search: up to 5 videos, each with its picture, channel, length and views, and a button to open it
//   info:   one video: picture, channel, length, views, likes, posted date, a few lines of description
// Source: the YouTube Data API when YOUTUBE_API_KEY is set; otherwise yt-dlp (already used for the YouTube alerts),
// so info works without a key too (it used to answer "Video not found" for every link without one).
// Titles with adult words are left out of searches (SafeSearch strict with the API).
// Texts: lang/<l>/youtube.json
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const { t } = require('../lib/i18n');
const { icon } = require('../lib/ui/icons');
const v2 = require('../lib/games/v2');

const T = (lang, k, v) => t(`youtube.${k}`, lang, v || {});
const LANGS = ['en', 'fr', 'zh', 'ar'];
const langOf = (client, gid, where, uid) => { try { const l = require('../lib/pick-lang').pickLang(client, gid, where, uid); return LANGS.includes(l) ? l : 'en'; } catch { return 'en'; } };
const clean = (s, n = 200) => String(s || '').replace(/[*_~`|>\\]/g, '').replace(/@(everyone|here)/gi, '@​$1').replace(/\s+/g, ' ').trim().slice(0, n);
const RED = 0xFF0000;
const KEY = () => process.env.YOUTUBE_API_KEY || '';
const API = 'https://www.googleapis.com/youtube/v3';
const COOKIES = require('path').join(__dirname, '..', 'assets', 'cookies.txt');
const cookieArgs = () => (require('fs').existsSync(COOKIES) ? ['--cookies', COOKIES] : []);
const BLOCKED = /\b(nsfw|18\+|xxx|porn|onlyfans|explicit|sexual|adult content)\b/i;

function videoIdOf(input) {
    const s = String(input || '').trim();
    if (/^[\w-]{11}$/.test(s)) return s;
    const m = s.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
    return m ? m[1] : null;
}
function isoSeconds(iso) {
    const m = String(iso || '').match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    return m ? (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0) : 0;
}
const hms = (s) => { s = Math.round(s || 0); if (!s) return null; const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };
const compact = (n, lang) => (n == null ? null : Number(n).toLocaleString({ fr: 'fr-FR', zh: 'zh-CN', ar: 'en-US' }[lang] || 'en-US', { notation: 'compact', maximumFractionDigits: 1 }));
const thumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

async function ytdlp(args, timeout = 20000) {
    const { stdout } = await execFileAsync('yt-dlp', ['--skip-download', '--no-warnings', ...cookieArgs(), ...args], { timeout, maxBuffer: 30 * 1024 * 1024 });
    return String(stdout).split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

// → [{ id, title, channel, seconds, views, published (unix | null) }]
const cache = new Map();
async function search(q, n) {
    const key = `${q.toLowerCase()}:${n}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.list;
    let list = [];
    if (KEY()) {
        try {
            const s = await axios.get(`${API}/search`, { params: { part: 'snippet', q, type: 'video', maxResults: n, safeSearch: 'strict', key: KEY() }, timeout: 8000 });
            const ids = (s.data.items || []).map((i) => i.id.videoId).filter(Boolean).join(',');
            if (ids) {
                const d = await axios.get(`${API}/videos`, { params: { part: 'snippet,contentDetails,statistics', id: ids, key: KEY() }, timeout: 8000 });
                list = (d.data.items || []).map((v) => ({ id: v.id, title: v.snippet.title, channel: v.snippet.channelTitle, seconds: isoSeconds(v.contentDetails.duration), views: Number(v.statistics.viewCount) || null, published: Math.floor(Date.parse(v.snippet.publishedAt) / 1000) || null }));
            }
        } catch (e) { console.log(`[YOUTUBE] API search: ${e.response?.status || e.message}`); }
    }
    if (!list.length) {
        try {
            list = (await ytdlp(['--flat-playlist', '--dump-json', `ytsearch${n + 3}:${q}`])).filter((v) => v.id && /^[\w-]{11}$/.test(v.id))
                .map((v) => ({ id: v.id, title: v.title, channel: v.channel || v.uploader, seconds: v.duration, views: v.view_count ?? null, published: v.timestamp || null }));
        } catch (e) { console.log(`[YOUTUBE] yt-dlp search: ${String(e.message).slice(0, 100)}`); }
    }
    list = list.filter((v) => !BLOCKED.test(v.title || '')).slice(0, n);
    if (list.length) { if (cache.size > 200) cache.clear(); cache.set(key, { list, at: Date.now() }); }
    return list;
}

// → { id, title, channel, channelUrl, seconds, views, likes, published, description, live }
async function info(id) {
    if (KEY()) {
        try {
            const d = await axios.get(`${API}/videos`, { params: { part: 'snippet,contentDetails,statistics', id, key: KEY() }, timeout: 8000 });
            const v = d.data.items?.[0];
            if (v) return { id, title: v.snippet.title, channel: v.snippet.channelTitle, channelUrl: `https://youtube.com/channel/${v.snippet.channelId}`, seconds: isoSeconds(v.contentDetails.duration), views: Number(v.statistics.viewCount) || null, likes: v.statistics.likeCount != null ? Number(v.statistics.likeCount) : null, published: Math.floor(Date.parse(v.snippet.publishedAt) / 1000) || null, description: v.snippet.description, live: v.snippet.liveBroadcastContent === 'live' };
        } catch (e) { console.log(`[YOUTUBE] API info: ${e.response?.status || e.message}`); }
    }
    try {
        const [v] = await ytdlp(['--dump-json', '--no-playlist', `https://www.youtube.com/watch?v=${id}`]);
        if (v) return { id, title: v.title, channel: v.channel || v.uploader, channelUrl: v.channel_url || v.uploader_url || null, seconds: v.duration, views: v.view_count ?? null, likes: v.like_count ?? null, published: v.timestamp || (v.upload_date ? Math.floor(Date.parse(`${v.upload_date.slice(0, 4)}-${v.upload_date.slice(4, 6)}-${v.upload_date.slice(6, 8)}`) / 1000) : null), description: v.description, live: v.is_live === true };
    } catch (e) { console.log(`[YOUTUBE] yt-dlp info: ${String(e.message).slice(0, 100)}`); }
    return null;
}

function searchCard(lang, q, list, where) {
    if (!list.length) return v2.card(0x888780, [{ text: `${icon('warn', where)} ${T(lang, 'none', { q: clean(q, 80) })}` }]);
    const items = [{ text: `-# ${icon('youtube', where)} YouTube\n### ${T(lang, 'resultsFor', { q: clean(q, 80) })}` }, { rule: true }];
    list.forEach((v, i) => {
        const facts = [clean(v.channel, 60), hms(v.seconds), v.views != null ? T(lang, 'views', { n: compact(v.views, lang) }) : null, v.published ? `<t:${v.published}:R>` : null].filter(Boolean).join(' · ');
        items.push({ thumbnail: [`**${i + 1}. [${clean(v.title, 90)}](https://youtu.be/${v.id})**\n-# ${facts}`, thumb(v.id)] });
    });
    items.push({ row: new ActionRowBuilder().addComponents(...list.map((v, i) => new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(`https://youtu.be/${v.id}`).setLabel(`${i + 1}`))) });
    items.push({ text: `-# ${T(lang, 'tip')}` });
    return v2.card(RED, items);
}

function infoCard(lang, v, where) {
    if (!v) return v2.card(0x888780, [{ text: `${icon('warn', where)} ${T(lang, 'notFound')}` }]);
    const facts = [
        v.live ? `🔴 ${T(lang, 'live')}` : hms(v.seconds),
        v.views != null ? `${icon('eye', where)} ${T(lang, 'views', { n: compact(v.views, lang) })}` : null,
        v.likes != null ? `👍 ${compact(v.likes, lang)}` : null,
        v.published ? `${icon('clock', where)} <t:${v.published}:D>` : null,
    ].filter(Boolean).join('  ·  ');
    const desc = String(v.description || '').replace(/https?:\/\/\S+/g, '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 3).join(' · ');
    const items = [
        { media: [`https://i.ytimg.com/vi/${v.id}/maxresdefault.jpg`, clean(v.title, 200)] },
        { text: `### ${clean(v.title, 200)}\n${v.channelUrl ? `[${clean(v.channel, 80)}](${v.channelUrl})` : clean(v.channel, 80)}\n${facts}${desc ? `\n-# ${clean(desc, 300)}` : ''}` },
        { row: new ActionRowBuilder().addComponents(
            new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(`https://youtu.be/${v.id}`).setLabel(T(lang, 'watch')),
            ...(v.channelUrl ? [new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(v.channelUrl).setLabel(T(lang, 'channel'))] : []),
        ) },
    ];
    return v2.card(RED, items);
}

module.exports = {
    name: 'youtube',
    userApp: true,   // also works as a user app (DMs, servers without ARCHON): lib/slash-payload.js
    aliases: ['yt', 'video', 'ytsearch', 'ytinfo'],
    description: 'Search YouTube or see a video’s details',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.yt <search> or .yt <link>',
    examples: ['.yt lofi hip hop', '.yt https://youtu.be/dQw4w9WgXcQ'],
    videoIdOf,

    data: new SlashCommandBuilder().setName('youtube').setDescription('Search YouTube or see a video’s details')
        .setDescriptionLocalizations({ fr: 'Chercher sur YouTube ou voir les détails d’une vidéo' })
        .addSubcommand((s) => s.setName('search').setDescription('Search for videos').setDescriptionLocalizations({ fr: 'Chercher des vidéos' })
            .addStringOption((o) => o.setName('query').setDescription('What to look for').setRequired(true).setMaxLength(150))
            .addIntegerOption((o) => o.setName('results').setDescription('How many (1-5)').setMinValue(1).setMaxValue(5)))
        .addSubcommand((s) => s.setName('info').setDescription('A video’s details').setDescriptionLocalizations({ fr: 'Les détails d’une vidéo' })
            .addStringOption((o) => o.setName('url').setDescription('The video’s link or ID').setRequired(true))),

    run: async (client, message, args) => {
        const lang = langOf(client, message.guild?.id, message, message.author.id);
        let q = args.join(' ').trim();
        if (/^info\s+/i.test(q)) q = q.replace(/^info\s+/i, '');
        if (!q) return message.reply(`${icon('warn', message)} ${T(lang, 'usage')}`).catch(() => {});
        const id = /youtu\.?be/i.test(q) ? videoIdOf(q) : null;   // a bare 11-letter word stays a search
        return message.reply(id ? infoCard(lang, await info(id), message) : searchCard(lang, q, await search(q, 5), message)).catch(() => {});
    },

    execute: async (interaction, client) => {
        const lang = langOf(client, interaction.guildId, interaction, interaction.user.id);
        await interaction.deferReply();
        if (interaction.options.getSubcommand() === 'info') {
            const id = videoIdOf(interaction.options.getString('url'));
            return interaction.editReply(id ? infoCard(lang, await info(id), interaction) : v2.card(0x888780, [{ text: `${icon('warn', interaction)} ${T(lang, 'badLink')}` }]));
        }
        const q = interaction.options.getString('query');
        const n = interaction.options.getInteger('results') || 5;
        return interaction.editReply(searchCard(lang, q, await search(q, n), interaction));
    },
};
