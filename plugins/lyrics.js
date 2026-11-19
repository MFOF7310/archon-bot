// ═══════════════════════════════════════════════════════════════════════════
// /lyrics [query] — a song's lyrics from lrclib.net, as one card with pages
//   No query: the song playing in this server's music queue.
//   Pages: lyr:<lrclib id>:<page>:<uid> — they never expire (the lyrics are fetched again by id when needed).
//   The person who asked turns the pages of the card; anyone else gets their own copy, visible only to them.
// Texts: lang/<l>/lyrics.json
// ═══════════════════════════════════════════════════════════════════════════
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { icon } = require('../lib/ui/icons');
const { t } = require('../lib/i18n');
const v2 = require('../lib/games/v2');

const PURPLE = 0x7F77DD;
const PAGE = 2600;   // characters of lyrics per page (a card holds 4000)
const T = (lang, k, v) => t(`lyrics.${k}`, lang, v || {});
const LANGS = ['en', 'fr', 'zh', 'ar'];
const langOf = (client, gid, where, uid) => { try { const l = require('../lib/pick-lang').pickLang(client, gid, where, uid); return LANGS.includes(l) ? l : 'en'; } catch { return 'en'; } };

// Lyrics kept one hour by lrclib id, so turning pages doesn't ask lrclib again
const cache = new Map();
const keep = (r) => { if (cache.size > 300) cache.clear(); cache.set(String(r.id), { r, at: Date.now() }); return r; };
function shape(track, fallbackTitle) {
    const lyrics = track?.plainLyrics || track?.syncedLyrics?.replace(/\[\d+:\d+(?:\.\d+)?\]\s?/g, '') || null;
    if (!lyrics || !track.id) return null;
    return { id: track.id, title: track.trackName || fallbackTitle, artist: track.artistName || null, album: track.albumName || null, duration: track.duration || 0, lyrics: lyrics.trim() };
}
async function lrclib(path) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
        const res = await fetch(`https://lrclib.net/api/${path}`, { signal: ctrl.signal, headers: { 'User-Agent': 'ARCHON-CG223 (archon223.com)' } });
        return res.ok ? await res.json() : null;
    } finally { clearTimeout(timer); }
}
async function search(query) {
    try {
        const list = await lrclib(`search?q=${encodeURIComponent(query.trim())}`);
        for (const tr of Array.isArray(list) ? list : []) { const r = shape(tr, query); if (r) return keep(r); }   // the first one that has lyrics
        return null;
    } catch (e) { console.error('[LYRICS] search:', e.message); return null; }
}
async function byId(id) {
    const hit = cache.get(String(id));
    if (hit && Date.now() - hit.at < 3600 * 1000) return hit.r;
    try { const r = shape(await lrclib(`get/${encodeURIComponent(id)}`)); return r ? keep(r) : null; }
    catch (e) { console.error('[LYRICS] get:', e.message); return null; }
}

function pagesOf(lyrics) {
    const pages = [];
    let cur = '';
    for (const line of lyrics.split('\n')) {
        if ((cur + '\n' + line).length > PAGE && cur) { pages.push(cur.trim()); cur = line; }
        else cur += (cur ? '\n' : '') + line;
    }
    if (cur.trim()) pages.push(cur.trim());
    return pages.length ? pages : [lyrics.slice(0, PAGE)];
}
const mmss = (s) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : null);
const clean = (s) => String(s || '').replace(/[*_~`|>\\]/g, '').replace(/@(everyone|here)/gi, '@​$1');

function card(r, page, uid, lang, where) {
    const pages = pagesOf(r.lyrics);
    const p = Math.max(0, Math.min(page, pages.length - 1));
    const about = [r.artist && `**${clean(r.artist)}**`, r.album && clean(r.album), mmss(r.duration)].filter(Boolean).join(' · ');
    const items = [
        { text: `-# ${icon('music', where)} ${T(lang, 'eyebrow')}\n### ${clean(r.title)}${about ? `\n${about}` : ''}` },
        { rule: true },
        { text: clean(pages[p]) },
        { text: `-# ${pages.length > 1 ? `${T(lang, 'page', { n: p + 1, total: pages.length })} · ` : ''}lrclib.net` },
    ];
    if (pages.length > 1) {
        items.push({ row: new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`lyr:${r.id}:${p - 1}:${uid}`).setLabel(T(lang, 'back')).setEmoji(icon('page_prev', where)).setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
            new ButtonBuilder().setCustomId(`lyr:${r.id}:${p + 1}:${uid}`).setLabel(T(lang, 'next')).setEmoji(icon('page_next', where)).setStyle(ButtonStyle.Secondary).setDisabled(p >= pages.length - 1),
        ) });
    }
    return v2.card(PURPLE, items);
}

// What to look for: the query, else the song playing in this server
function queryOf(client, gid, query) {
    if (query && query.trim()) return query.trim();
    const q = client.commands?.get('music')?.getQueue?.(gid);
    return q?.currentTrack ? `${q.currentTrack.title} ${q.currentTrack.artist || ''}`.trim() : null;
}

// lyr:<id>:<page>:<uid>
async function handleComponent(ix, client) {
    const [, id, page, uid] = ix.customId.split(':');
    const lang = langOf(client, ix.guildId, ix, ix.user.id);
    const mine = ix.user.id === uid;
    if (mine) await ix.deferUpdate().catch(() => {});
    else await ix.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
    const r = await byId(id);
    if (!r) return ix.followUp({ content: `${icon('warn', ix)} ${T(lang, 'gone')}`, flags: MessageFlags.Ephemeral }).catch(() => {});
    return ix.editReply(card(r, Number(page) || 0, ix.user.id, lang, ix)).catch(() => {});
}

module.exports = {
    name: 'lyrics',
    userApp: true,   // also works as a user app (DMs, servers without ARCHON): lib/slash-payload.js
    aliases: ['lyric', 'paroles', 'lrc'],
    description: 'Lyrics of the song playing or of any song',
    category: 'MUSIC',
    cooldown: 5000,
    handleComponent,

    run: async (client, message, args) => {
        const lang = langOf(client, message.guild?.id, message, message.author.id);
        const query = queryOf(client, message.guild?.id, args.join(' '));
        if (!query) return message.reply(`${icon('warn', message)} ${T(lang, 'noQuery', { cmd: '.lyrics <song>' })}`).catch(() => {});
        const r = await search(query);
        if (!r) return message.reply(`${icon('warn', message)} ${T(lang, 'notFound', { query: clean(query).slice(0, 100) })}`).catch(() => {});
        return message.reply(card(r, 0, message.author.id, lang, message)).catch(() => {});
    },

    execute: async (interaction, client) => {
        const lang = langOf(client, interaction.guildId, interaction, interaction.user.id);
        const query = queryOf(client, interaction.guild?.id, interaction.options.getString('query'));
        if (!query) return interaction.reply({ content: `${icon('warn', interaction)} ${T(lang, 'noQuery', { cmd: '/lyrics query:' })}`, flags: MessageFlags.Ephemeral });
        await interaction.deferReply();
        const r = await search(query);
        if (!r) return interaction.editReply({ content: `${icon('warn', interaction)} ${T(lang, 'notFound', { query: clean(query).slice(0, 100) })}` });
        return interaction.editReply(card(r, 0, interaction.user.id, lang, interaction));
    },

    data: {
        toJSON: () => ({
            name: 'lyrics',
            description: 'Lyrics of the song playing or of any song',
            description_localizations: { fr: 'Les paroles de la chanson en cours ou de n’importe quelle chanson' },
            options: [{ name: 'query', description: 'Song name and artist (empty: the song playing)', type: 3, required: false }],
        }),
    },
};
