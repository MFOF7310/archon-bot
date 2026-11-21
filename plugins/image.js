// ═══════════════════════════════════════════════════════════════════════════
// /image <category> — a photo by theme, as a fun-pack card (lib/fun): the same look and buttons as /car or /anime
//   dog (Dog CEO) · cat (TheCatAPI) · space (NASA picture of the day) · car, nature, architecture, food, cyberpunk
//   (Unsplash, needs UNSPLASH_ACCESS_KEY) · random (only among the themes that can answer)
// Unsplash's rules: the photographer is credited with a link, and each photo shown is reported to their download
// endpoint. NASA: NASA_API_KEY when set (DEMO_KEY allows ~30 calls an hour); a day whose picture is a video is skipped.
// "Another one" never expires (fun:again:image:<uid>:<category>); someone else pressing it gets their own, privately.
// "Change theme" (fun:theme:image:<uid>) does the same with the theme picked, shown with ARCHON's own icons.
// Texts: lang/<l>/funcards.json (img_*).
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { icon } = require('../lib/ui/icons');
const fun = require('../lib/fun');

const UNSPLASH = {   // category → search, card colour
    car: ['luxury sports car', 0xE24B4A],
    nature: ['nature landscape mountains forest ocean', 0x1D9E75],
    architecture: ['modern architecture skyline building', 0x378ADD],
    food: ['gourmet food dish', 0xEF9F27],
    cyberpunk: ['cyberpunk neon city night', 0x7F77DD],
};
const COLORS = { dog: 0xE67E22, cat: 0x9B59B6, space: 0x2C3E50 };
const ICON = { dog: '🐕', cat: '🐈', car: '🚗', nature: '🌿', architecture: '🏛️', food: '🍽️', space: '🚀', cyberpunk: '🌃', random: '🔀' };
const ALL = ['dog', 'cat', 'car', 'nature', 'architecture', 'food', 'space', 'cyberpunk'];
const UTM = 'utm_source=archon_cg223&utm_medium=referral';
const key = () => process.env.UNSPLASH_ACCESS_KEY || '';
const available = () => ALL.filter((c) => !UNSPLASH[c] || key());

// Unsplash search results, kept 30 minutes per category (one call gives 30 photos)
const pools = new Map();
async function unsplashPool(cat) {
    const hit = pools.get(cat);
    if (hit && Date.now() - hit.at < 30 * 60 * 1000) return hit.list;
    const page = 1 + Math.floor(Math.random() * 5);   // not always the same 30
    const d = await fun.getJSON(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(UNSPLASH[cat][0])}&per_page=30&page=${page}&orientation=landscape&content_filter=high`,
        { headers: { Authorization: `Client-ID ${key()}`, 'Accept-Version': 'v1' } });
    const list = (d?.results || []).filter((p) => p?.urls?.regular);
    if (list.length) pools.set(cat, { list, at: Date.now() });
    return list;
}

// The same photo never twice in a row for a person and a category
const lastShown = new Map();
function pickNew(list, idOf, who) {
    const last = lastShown.get(who);
    const fresh = list.filter((x) => idOf(x) !== last);
    const one = fun.pick(fresh.length ? fresh : list);
    lastShown.set(who, idOf(one));
    if (lastShown.size > 2000) lastShown.clear();
    return one;
}

// Each source gives { image, caption, credit (markdown), link: [url, label] }
const SOURCES = {
    async dog() {
        const d = await fun.getJSON('https://dog.ceo/api/breeds/image/random');
        if (d?.status !== 'success') return null;
        const breed = (String(d.message).match(/breeds\/([^/]+)/) || [])[1];
        const name = breed ? breed.split('-').reverse().join(' ').replace(/\b\w/g, (c) => c.toUpperCase()) : null;
        return { image: d.message, caption: name, credit: '[Dog CEO](https://dog.ceo)' };
    },
    async cat() {
        const d = await fun.getJSON('https://api.thecatapi.com/v1/images/search?has_breeds=1&limit=1');
        const c = d?.[0];
        if (!c?.url) return null;
        const b = c.breeds?.[0];
        return { image: c.url, caption: b ? `${b.name}${b.origin ? ` · ${b.origin}` : ''}${b.temperament ? ` · ${b.temperament.split(',').slice(0, 3).join(',')}` : ''}` : null, credit: '[TheCatAPI](https://thecatapi.com)' };
    },
    async space() {
        const apiKey = process.env.NASA_API_KEY || 'DEMO_KEY';
        const d = await fun.getJSON(`https://api.nasa.gov/planetary/apod?api_key=${apiKey}&count=5&thumbs=true`, { timeout: 10000 });
        const pics = (Array.isArray(d) ? d : []).filter((a) => a.media_type === 'image' && a.url);
        if (!pics.length) return null;
        const a = fun.pick(pics);
        return { image: a.url, caption: `${a.title}${a.date ? ` · ${a.date}` : ''}`, credit: `${a.copyright ? `${fun.safe(a.copyright.replace(/\n/g, ' '), 60)} · ` : ''}[NASA APOD](https://apod.nasa.gov/apod/ap${String(a.date || '').slice(2).replace(/-/g, '')}.html)` };
    },
};
async function unsplash(cat, who) {
    const list = await unsplashPool(cat);
    if (!list.length) return null;
    const p = pickNew(list, (x) => x.id, `${who}:${cat}`);
    // Unsplash asks for each shown photo to be reported (it counts as a download for the photographer)
    if (p.links?.download_location) fun.getJSON(`${p.links.download_location}${p.links.download_location.includes('?') ? '&' : '?'}client_id=${key()}`).catch(() => {});
    const who2 = p.user?.name ? `[${fun.safe(p.user.name, 60)}](${p.user.links?.html || 'https://unsplash.com'}?${UTM})` : null;
    return {
        image: p.urls.regular,
        caption: p.alt_description ? fun.safe(p.alt_description.charAt(0).toUpperCase() + p.alt_description.slice(1), 140) : null,
        credit: who2,
        unsplash: true,
        size: p.width && p.height ? `${p.width}×${p.height}` : null,
        link: p.links?.html ? `${p.links.html}?${UTM}` : null,
    };
}

// "Change theme" under each photo: ARCHON's own icons (the slash command's list can only show plain emojis)
function themeMenu(guild, lang, uid, current) {
    const opts = ['random', ...available()].map((c) => ({
        label: fun.F(`img_${c}`, lang).slice(0, 100), value: c, emoji: icon(`img_${c}`, guild), default: c === current,
    }));
    return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
        .setCustomId(`fun:theme:image:${uid}`).setPlaceholder(fun.F('img_change', lang)).addOptions(opts));
}

async function funMake(client, { guild, user, lang, arg }) {
    const asked = ALL.includes(arg) || arg === 'random' ? arg : 'random';
    const can = available();
    if (UNSPLASH[asked] && !key()) {
        return fun.textCard(guild, lang, { color: 0x888780, body: fun.F('img_noKey', lang, { cat: fun.F(`img_${asked}`, lang) }) });
    }
    const cat = asked === 'random' ? fun.pick(can) : asked;
    let r = null;
    try { r = UNSPLASH[cat] ? await unsplash(cat, user.id) : await SOURCES[cat](); }
    catch (e) { console.log(`[IMAGE] ${cat}: ${String(e.response?.status || e.message).slice(0, 80)}`); }
    if (!r) return fun.failCard(lang, 'image');

    const lines = [];
    if (r.caption) lines.push(fun.safe(r.caption, 160));
    if (r.unsplash) lines.push(`📷 ${fun.F('img_by', lang, { who: r.credit || 'Unsplash', site: `[Unsplash](https://unsplash.com/?${UTM})` })}${r.size ? ` · ${r.size}` : ''}`);
    else if (r.credit) lines.push(fun.F('source', lang, { source: r.credit }));
    return fun.imageCard(guild, lang, {
        color: UNSPLASH[cat]?.[1] || COLORS[cat] || 0xE6A817,
        title: `${icon(`img_${cat}`, guild) || ICON[cat]} ${fun.F(`img_${cat}`, lang)}`,
        image: r.image,
        lines,
        again: ['image', user.id, asked],   // "Another one" stays on the theme asked (random stays random)
        link: r.link ? [r.link, fun.F('img_view', lang)] : null,
        menu: themeMenu(guild, lang, user.id, asked),
    });
}

module.exports = {
    name: 'image',
    userApp: true,   // also works as a user app (DMs, servers without ARCHON): lib/slash-payload.js
    aliases: ['img', 'pic', 'photo', 'images'],
    description: 'A photo by theme: dogs, cats, cars, nature, architecture, food, space, cyberpunk',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.image <category>',
    examples: ['.image dog', '.image space', '.img random'],
    funMake,

    data: new SlashCommandBuilder()
        .setName('image')
        .setDescription('A photo by theme')
        .setDescriptionLocalizations({ fr: 'Une photo selon un thème' })
        .addStringOption((o) => o.setName('category').setDescription('Which theme?').setDescriptionLocalizations({ fr: 'Quel thème ?' }).setRequired(true)
            .addChoices(...['random', ...ALL].map((c) => ({ name: `${ICON[c]} ${c.charAt(0).toUpperCase() + c.slice(1)}`, value: c })))),

    run: async (client, message, args) => {
        const lang = fun.langOf(client, message.guild?.id, message, message.author.id);
        const arg = String(args[0] || 'random').toLowerCase();
        return message.reply(await funMake(client, { guild: message.guild, user: message.author, lang, arg })).catch(() => {});
    },
    execute: async (ix, client) => {
        const lang = fun.langOf(client, ix.guildId, ix, ix.user.id);
        await ix.deferReply();
        return ix.editReply(await funMake(client, { guild: ix.guild, user: ix.user, lang, arg: ix.options.getString('category') || 'random' }));
    },
};
