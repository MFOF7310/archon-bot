'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// ARCHON — THE FUN PACK'S SHARED PIECES (cat, dog, car, meme, anime, 8ball, fact, dadjoke, coinflip, roll, slap)
// Three card shapes (image, text, small game), the same buttons everywhere, and one button router:
//   fun:again:<cmd>:<uid>[:<arg>]   "Another" — the person who ran it gets a new one in the same card; anyone else
//                                    gets their own, visible only to them, with a Share button
//   fun:share:<uid>                 posts a private card in the channel for everyone, with who shared it
// Each plugin exports funMake(client, { guild, user, lang, arg, priv }) → a message payload.
// getJSON: one way to call the outside APIs (timeout, a clear error), for every plugin of the pack.
// Texts: lang/<l>/funcards.json
// ═══════════════════════════════════════════════════════════════════════════
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { t } = require('./i18n');
const { icon } = require('./ui/icons');
const { card } = require('./games/v2');

const F = (k, lang, v) => t(`funcards.${k}`, lang, v || {});
const LANGS = ['en', 'fr', 'zh', 'ar'];
const langOf = (client, gid, where, uid) => { try { const l = require('./pick-lang').pickLang(client, gid, where, uid); return LANGS.includes(l) ? l : 'en'; } catch { return 'en'; } };
const safe = (s, n = 200) => String(s ?? '').replace(/[*_~`|>\\]/g, '').replace(/@(everyone|here)/gi, '@​$1').replace(/<@[!&]?\d+>/g, '@…').slice(0, n);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

async function getJSON(url, { timeout = 8000, headers = {} } = {}) {
    const axios = require('axios');
    const r = await axios.get(url, { timeout, headers: { 'User-Agent': 'ARCHON-CG223 (Discord bot; archon223.com)', Accept: 'application/json', ...headers } });
    return r.data;
}

// Tries each source in order; the first that gives a result wins. null when all of them failed.
async function firstOf(sources, tag) {
    for (const src of sources) {
        try { const r = await src(); if (r) return r; }
        catch (e) { console.log(`[FUN] ${tag}: ${src.name || 'source'} failed (${String(e.message).slice(0, 80)})`); }
    }
    return null;
}

// The buttons under a card. again: [cmd, uid, arg?, label]. priv: the card is only visible to its owner (adds Share).
function buttons(guild, lang, { again, priv, link } = {}) {
    const row = new ActionRowBuilder();
    let n = 0;
    if (again) {
        const [cmd, uid, arg, label] = again;
        row.addComponents(new ButtonBuilder().setCustomId(['fun', 'again', cmd, uid, arg].filter((x) => x !== undefined && x !== null && x !== '').join(':').slice(0, 100))
            .setLabel(label || F('again', lang)).setStyle(ButtonStyle.Secondary).setEmoji(icon('refresh', guild))); n++;
        if (priv) { row.addComponents(new ButtonBuilder().setCustomId(`fun:share:${uid}`).setLabel(F('share', lang)).setStyle(ButtonStyle.Primary).setEmoji(icon('next', guild))); n++; }
    }
    if (link) { row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(link[0]).setLabel(link[1])); n++; }
    return n ? row : null;
}

// A card with a picture
function imageCard(guild, lang, { color, title, image, lines = [], again, priv, link }) {
    const items = [{ text: `### ${title}` }];
    if (image) items.push({ media: [image, title.replace(/<[^>]+>/g, '').slice(0, 200)] });
    if (lines.length) items.push({ text: lines.map((l) => `-# ${l}`).join('\n') });
    const row = buttons(guild, lang, { again, priv, link });
    if (row) items.push({ row });
    return card(color, items);
}

// A card of text (8ball, fact, joke) or a small game result
function textCard(guild, lang, { color, top, body, lines = [], again, priv, thumb }) {
    const head = [top ? `-# ${top}` : null, body].filter(Boolean).join('\n');
    const items = [thumb ? { thumbnail: [head, thumb] } : { text: head }];
    if (lines.length) items.push({ text: lines.map((l) => `-# ${l}`).join('\n') });
    const row = buttons(guild, lang, { again, priv });
    if (row) items.push({ row });
    return card(color, items);
}

// English text from an outside API, in the reader's language (MyMemory, the same service as /translate).
// null when it is English already or the translation failed: the card then shows the English.
const tcache = new Map();
async function translate(text, lang) {
    if (lang === 'en' || !text) return null;
    const key = `${lang}:${text}`;
    if (tcache.has(key)) return tcache.get(key);
    try {
        const d = await getJSON(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(String(text).slice(0, 450))}&langpair=en|${lang === 'zh' ? 'zh-CN' : lang}`, { timeout: 6000 });
        const out = d?.responseStatus === 200 ? String(d.responseData?.translatedText || '').trim() : '';
        const good = out && out.toLowerCase() !== String(text).toLowerCase() && !/MYMEMORY WARNING|QUERY LENGTH/i.test(out) ? out : null;
        if (tcache.size > 300) tcache.clear();
        tcache.set(key, good);
        return good;
    } catch { return null; }
}

const failCard = (lang, what) => card(0x888780, [{ text: F('failed', lang, { what: F(`what_${what}`, lang) }) }]);

// The card as it was, without its buttons, for Share
function withoutButtons(message, note) {
    const strip = (c) => {
        const j = typeof c.toJSON === 'function' ? c.toJSON() : c;
        if (j.type === 1) return null;   // an action row
        if (Array.isArray(j.components)) j.components = j.components.map(strip).filter(Boolean);
        return j;
    };
    const comps = (message.components || []).map(strip).filter(Boolean);
    if (note && comps[0]?.components) comps[0].components.push({ type: 10, content: `-# ${note}` });
    return comps;
}

const PLUGINS = { cat: 'cat', dog: 'dog', car: 'car', meme: 'meme', anime: 'anime', '8ball': '8ball', fact: 'fact', joke: 'dadjoke', coin: 'coinflip', roll: 'roll', slap: 'slap', image: 'image' };

async function handleComponent(ix, client) {
    const parts = ix.customId.split(':');
    const lang = langOf(client, ix.guildId, ix, ix.user.id);
    const say = (content) => ix.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }).catch(() => {});

    if (parts[1] === 'share') {
        if (ix.user.id !== parts[2]) return say(F('notYours', lang));
        if (!ix.channel?.send) return say(F('shareFailed', lang));
        const components = withoutButtons(ix.message, F('sharedBy', lang, { user: `<@${ix.user.id}>` }));
        const sent = await ix.channel.send({ components, flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } }).catch(() => null);
        return sent ? ix.update({ components: withoutButtons(ix.message, F('shared', lang)) }).catch(() => {}) : say(F('shareFailed', lang));
    }

    if (parts[1] === 'slapback') return require('../plugins/slap.js').slapBack(ix, client, parts, lang);
    if (parts[1] !== 'again') return say(F('expired', lang));
    const [, , cmd, uid, ...rest] = parts;
    const file = PLUGINS[cmd];
    if (!file) return say(F('expired', lang));
    const plugin = require(`../plugins/${file}.js`);
    const mine = ix.user.id === uid;
    if (mine) await ix.deferUpdate().catch(() => {});
    else await ix.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
    let payload;
    try { payload = await plugin.funMake(client, { guild: ix.guild, user: ix.user, member: ix.member, lang, arg: rest.join(':') || null, priv: !mine }); }
    catch (e) { console.error(`[FUN] ${cmd} again:`, e.message); payload = null; }
    if (!payload) payload = failCard(lang, cmd);
    return ix.editReply(payload).catch((e) => console.error(`[FUN] ${cmd} edit:`, e.message));
}

module.exports = { F, langOf, safe, pick, getJSON, firstOf, translate, buttons, imageCard, textCard, failCard, handleComponent };
