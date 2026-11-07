// plugins/mylang.js
// .mylang <en|fr|ar|bm|zh|auto>  and  /mylang [language] : choose the
// language ARCHON answers YOU in, on every server set to Auto and in DMs.
// A language chosen with /setlang by the server always wins.
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const memberLang = require('../lib/member-lang');
const { t } = require('../lib/i18n');
const { pickLang } = require('../lib/pick-lang');
const v2 = require('../lib/games/v2');
const cmdSlash = require('../lib/cmd').slash;
const EMOJIS = (() => { try { return require('../config/emojis'); } catch { return {}; } })(); // the file is not in the repo: clones still load

const NAMES = { en: 'English', fr: 'Français', ar: 'العربية', bm: 'Bamanankan', zh: '中文' };
const FLAGS = { en: '🇬🇧', fr: '🇫🇷', ar: '🇸🇦', bm: '🇲🇱', zh: '🇨🇳' };
const WORDS = {
    en: 'en', english: 'en', anglais: 'en',
    fr: 'fr', 'français': 'fr', francais: 'fr', french: 'fr',
    ar: 'ar', arabic: 'ar', arabe: 'ar', 'عربي': 'ar', 'العربية': 'ar',
    bm: 'bm', bambara: 'bm', bamanankan: 'bm',
    zh: 'zh', chinese: 'zh', chinois: 'zh', '中文': 'zh',
};
const RESET = ['auto', 'reset', 'off', 'clear', 'default'];

const nameOf = (code) => `${EMOJIS[`flag_${code}`] || FLAGS[code] || ''} ${NAMES[code] || code}`.trim();
// What the member typed, shown back safely: no markdown, no mentions, short
const shown = (word) => String(word || '').replace(/[`*_~|\\<>@#]/g, '').slice(0, 24) || '?';

// Saves what the member typed or picked. Returns 'set', 'reset', 'unknown', 'error', or null when nothing was asked.
function apply(userId, guildId, word) {
    if (!word) return null;
    try {
        if (RESET.includes(word)) { memberLang.reset(userId, guildId); return 'reset'; }
        if (WORDS[word]) { memberLang.set(userId, guildId, WORDS[word]); return 'set'; }
        return 'unknown';
    } catch (e) {
        console.error('[MYLANG] save failed:', e.message);
        return 'error';
    }
}

function buildCard(client, userId, guildId, ctx, outcome = null, word = '') {
    const serverLang = (() => { try { return (guildId && client.getServerSettings?.(guildId)?.language) || 'auto'; } catch { return 'auto'; } })();
    const mine = memberLang.get(userId, guildId || 'DM');
    const lang = mine || pickLang(client, guildId, ctx, userId);
    const L = (k, v) => t('mylang.' + k, lang, v);
    const cmd = cmdSlash(client, 'mylang', { guild: null });

    // Where the choice applies: in a DM there is no server, a server set with /setlang keeps its language
    let where;
    if (!guildId) where = mine ? L('dm') : L('dmNone');
    else if (serverLang !== 'auto' && NAMES[serverLang]) where = serverLang === mine ? L('serverSame', { lang: nameOf(serverLang) }) : L('serverLocked', { lang: nameOf(serverLang) });
    else where = mine ? L('serverAuto') : L('serverAutoNone');

    const items = [
        { text: `*ARCHON CG-223 · ${L('header')}*` },
        { text: `## ${EMOJIS.globe || '🌐'} ${L('title')}` },
    ];
    if (outcome === 'unknown') items.push({ text: L('unknown', { word: shown(word) }) });
    if (outcome === 'error') items.push({ text: L('saveFailed') });
    items.push(
        { rule: true },
        { text: mine ? L('current', { name: nameOf(mine) }) : L('none') },
        { rule: true },
        { text: L('hintWithCmd', { cmd }) },
        { text: `-# ${where}` },
    );
    return v2.card(0x00fbff, items);
}

module.exports = {
    name: 'mylang',
    aliases: ['mylanguage', 'malangue', 'monlangue'],
    description: 'Choose the language ARCHON answers you in (servers with their own /setlang keep theirs).',
    category: 'CONFIG',
    cooldown: 3000,
    usage: '.mylang <en|fr|ar|bm|zh|auto>',

    data: new SlashCommandBuilder()
        .setName('mylang')
        .setDescription('Choose the language ARCHON answers you in')
        .addStringOption(o => o
            .setName('language')
            .setDescription('Your language (leave empty to see your current one)')
            .setRequired(false)
            .addChoices(
                { name: '🌐 Auto (automatic)', value: 'auto' },
                { name: '🇬🇧 English', value: 'en' },
                { name: '🇫🇷 Français', value: 'fr' },
                { name: '🇸🇦 العربية', value: 'ar' },
                { name: '🇲🇱 Bamanankan', value: 'bm' },
                { name: '🇨🇳 中文', value: 'zh' },
            )),

    async run(client, message, args) {
        const word = String((args || [])[0] || '').trim().toLowerCase();
        const outcome = apply(message.author.id, message.guild?.id || 'DM', word);
        await message.reply(buildCard(client, message.author.id, message.guild?.id || null, message, outcome, word)).catch(() => {});
    },

    async execute(interaction, client) {
        const word = String(interaction.options?.getString('language') || '').trim().toLowerCase();
        const outcome = apply(interaction.user.id, interaction.guildId || 'DM', word);
        const card = buildCard(client, interaction.user.id, interaction.guildId || null, interaction, outcome, word);
        await interaction.reply({ ...card, flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral }).catch(() => {});
    },
};
