// ═══════════════════════════════════════════════════════════════════════════
// /define <word> — an English dictionary card: pronunciation, up to 3 meanings with an example, synonyms,
// a link to hear it. Source: Free Dictionary API (dictionaryapi.dev), then Wiktionary when it has nothing.
// The old version read the answer as if it came from Wiktionary ("data.en"), so every word came back "not found".
// Texts: lang/<l>/define.json (the definitions themselves stay in English)
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { t } = require('../lib/i18n');
const { icon } = require('../lib/ui/icons');
const v2 = require('../lib/games/v2');

const T = (lang, k, v) => t(`define.${k}`, lang, v || {});
const LANGS = ['en', 'fr', 'zh', 'ar'];
const langOf = (client, gid, where, uid) => { try { const l = require('../lib/pick-lang').pickLang(client, gid, where, uid); return LANGS.includes(l) ? l : 'en'; } catch { return 'en'; } };
const clean = (s, n = 300) => String(s || '').replace(/<[^>]+>/g, '').replace(/[*_~`|>\\]/g, '').replace(/@(everyone|here)/gi, '@​$1').replace(/\s+/g, ' ').trim().slice(0, n);

async function getJSON(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
        const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'ARCHON-CG223 (archon223.com)' } });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } finally { clearTimeout(timer); }
}

// → { word, phonetic, audio, meanings: [{ pos, defs: [{ text, example }], synonyms }], source }
async function lookup(word) {
    try {
        const d = await getJSON(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
        if (Array.isArray(d) && d.length) {
            const meanings = [];
            for (const e of d) for (const m of e.meanings || []) {
                const had = meanings.find((x) => x.pos === m.partOfSpeech);
                const defs = (m.definitions || []).map((x) => ({ text: x.definition, example: x.example }));
                if (had) had.defs.push(...defs); else meanings.push({ pos: m.partOfSpeech, defs, synonyms: m.synonyms || [] });
            }
            const ph = d.flatMap((e) => e.phonetics || []);
            return {
                word: d[0].word || word,
                phonetic: d[0].phonetic || ph.find((p) => p.text)?.text || null,
                audio: ph.find((p) => p.audio)?.audio || null,
                meanings,
                source: d[0].sourceUrls?.[0] || `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}`,
            };
        }
    } catch (e) { console.log(`[DEFINE] dictionaryapi: ${e.message}`); }
    // Wiktionary: definitions grouped by language; the English ones
    try {
        const w = await getJSON(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`);
        const en = w?.en || [];
        if (en.length) return {
            word, phonetic: null, audio: null,
            meanings: en.map((m) => ({ pos: String(m.partOfSpeech || '').toLowerCase(), defs: (m.definitions || []).filter((x) => clean(x.definition)).map((x) => ({ text: x.definition, example: x.examples?.[0] })), synonyms: [] })),
            source: `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}`,
        };
    } catch (e) { console.log(`[DEFINE] wiktionary: ${e.message}`); }
    return null;
}

async function card(lang, word, where) {
    const w = String(word || '').trim().slice(0, 60);
    const r = await lookup(w);
    if (!r || !r.meanings.some((m) => m.defs.length)) {
        return v2.card(0x888780, [{ text: `### ${icon('define', where)} ${clean(w, 60)}\n${T(lang, 'notFound')}\n-# ${T(lang, 'onlyEnglish')}` }]);
    }
    const blocks = r.meanings.filter((m) => m.defs.length).slice(0, 3).map((m) => {
        const defs = m.defs.slice(0, 2).map((d, i) => `${i + 1}. ${clean(d.text, 280)}${d.example ? `\n-# « ${clean(d.example, 160)} »` : ''}`).join('\n');
        const syn = m.synonyms?.length ? `\n-# ${T(lang, 'synonyms')} ${m.synonyms.slice(0, 5).map((s) => clean(s, 30)).join(', ')}` : '';
        return `**${clean(m.pos, 30) || '—'}**\n${defs}${syn}`;
    });
    const buttons = [];
    if (r.audio && /^https:\/\//.test(r.audio)) buttons.push(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(r.audio).setLabel(T(lang, 'listen')));
    if (r.source && /^https:\/\//.test(r.source)) buttons.push(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(r.source).setLabel(T(lang, 'more')));
    const items = [
        { text: `### ${icon('define', where)} ${clean(r.word, 60)}${r.phonetic ? `  \`${clean(r.phonetic, 60)}\`` : ''}` },
        { rule: true },
        { text: blocks.join('\n\n').slice(0, 3500) },
    ];
    if (buttons.length) items.push({ row: new ActionRowBuilder().addComponents(...buttons) });
    return v2.card(0x7F77DD, items);
}

module.exports = {
    name: 'define',
    userApp: true,   // also works as a user app (DMs, servers without ARCHON): lib/slash-payload.js
    aliases: ['dictionary', 'dict', 'definition'],
    description: 'An English word: meaning, pronunciation, examples',
    category: 'UTILITY',
    cooldown: 3000,
    data: new SlashCommandBuilder().setName('define').setDescription('An English word: meaning, pronunciation, examples')
        .setDescriptionLocalizations({ fr: 'Un mot anglais : sens, prononciation, exemples' })
        .addStringOption((o) => o.setName('word').setDescription('The English word').setRequired(true).setMaxLength(60)),

    run: async (client, message, args) => {
        const lang = langOf(client, message.guild?.id, message, message.author.id);
        const word = args.join(' ').trim();
        if (!word) return message.reply(`${icon('warn', message)} ${T(lang, 'usage')}`).catch(() => {});
        return message.reply(await card(lang, word, message)).catch(() => {});
    },
    execute: async (interaction, client) => {
        const lang = langOf(client, interaction.guildId, interaction, interaction.user.id);
        await interaction.deferReply();
        return interaction.editReply(await card(lang, interaction.options.getString('word'), interaction));
    },
};
