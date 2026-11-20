const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { t } = require('../lib/i18n');
const em = (k, fb) => { try { return require('../config/emojis')[k] || fb; } catch { return fb; } };
const axios = require('axios');

const LANG_CODES = { 'english': 'en', 'french': 'fr', 'spanish': 'es', 'german': 'de', 'italian': 'it', 'portuguese': 'pt', 'russian': 'ru', 'japanese': 'ja', 'korean': 'ko', 'chinese': 'zh', 'arabic': 'ar', 'hindi': 'hi' };
function resolveCode(input) { return LANG_CODES[input.toLowerCase()] || input.toLowerCase(); }
const isLang = (w) => !!w && (Object.values(LANG_CODES).includes(w) || Object.keys(LANG_CODES).includes(w));
const { messageText } = require('../lib/message-text');

// The free translation service takes about 500 characters per request
const MAX = 500;
async function translate(text, from, to) {
    const res = await axios.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, MAX))}&langpair=${from === 'auto' ? 'Autodetect' : from}|${to}`, { timeout: 15000 });
    return res.data?.responseData?.translatedText || null;
}
const quote = (x) => (x.length > 900 ? x.slice(0, 900) + '…' : x).replace(/\n/g, '\n> ');
function resultCard(text, translated, from, to, lang) {
    const c = new ContainerBuilder().setAccentColor(0x00fbff);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${em('globe', '🌐')} ${t('trt.translated', lang)}`));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${em('file', '📝')} ${t('trt.original', lang)}**\n> ${quote(text)}`));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${em('ic_status_ok', em('ic_ok', '✅'))} ${t('trt.translated', lang)}**\n> ${quote(translated)}`));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${from.toUpperCase()} ➔ ${to.toUpperCase()}${text.length > MAX ? ` · ${t('trt.cut', lang, { n: MAX })}` : ''}`));
    return { components: [c], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
}
// The clicker's Discord language ("en-US", "zh-CN", "pt-BR" → en, zh, pt)
const localeTo = (loc) => { const b = String(loc || 'en').toLowerCase().split('-')[0]; return Object.values(LANG_CODES).includes(b) ? b : 'en'; };
const MENU = 'Translate';

module.exports = {
    name: 'translate', aliases: ['tr', 'translation', 'translator'],
    userApp: true,   // also works as a user app (DMs, servers without ARCHON): lib/slash-payload.js
    description: '🌐 Translate text between 12 languages instantly.',
    category: 'UTILITY', cooldown: 3000, usage: '.translate <text> [from] [to]', examples: ['.translate hello fr', '.translate bonjour en fr'],
    data: new SlashCommandBuilder().setName('translate').setDescription('🌐 Translate text').addStringOption(o => o.setName('text').setDescription('Text to translate').setRequired(true)).addStringOption(o => o.setName('from').setDescription('Source language').setRequired(false).addChoices({name:'Auto',value:'auto'},{name:'English',value:'en'},{name:'French',value:'fr'},{name:'Spanish',value:'es'},{name:'German',value:'de'},{name:'Japanese',value:'ja'})).addStringOption(o => o.setName('to').setDescription('Target language').setRequired(false).addChoices({name:'English',value:'en'},{name:'French',value:'fr'},{name:'Spanish',value:'es'},{name:'German',value:'de'},{name:'Japanese',value:'ja'},{name:'Russian',value:'ru'},{name:'Korean',value:'ko'},{name:'Chinese',value:'zh'})),
    
    // Apps → Translate on any message (cards included): into the clicker's Discord language, seen only by them
    menus: [{ type: 3, name: MENU, name_localizations: { fr: 'Traduire' } }],
    async menu(interaction) {
        const lang = require('../lib/i18n').slashLang(interaction, ['en', 'fr']);
        const { text } = messageText(interaction.targetMessage);
        if (!text) return interaction.reply({ content: t('trt.nothing', lang), flags: MessageFlags.Ephemeral }).catch(() => {});
        const to = localeTo(interaction.locale);
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const translated = await translate(text, 'auto', to).catch(() => null);
        if (!translated) return interaction.editReply(t('trt.error', lang)).catch(() => {});
        return interaction.editReply(resultCard(text, translated, 'auto', to, lang)).catch(() => {});
    },

    run: async (client, message, args, db, ss, used, lang) => {
        if (!lang) lang = require('../lib/pick-lang').pickLang(client, message?.guild?.id, message, message?.author?.id);
        let from = 'auto', to = 'en';
        const last = args[args.length - 1]?.toLowerCase();
        const secondLast = args[args.length - 2]?.toLowerCase();
        if (isLang(last)) {
            to = resolveCode(last); args.pop();
            if (isLang(secondLast)) { from = resolveCode(secondLast); args.pop(); }
        }
        let text = args.join(' ');
        // Replying to a message with ".tr" (or ".tr fr"): translate that message, no need to copy it
        if (!text && message.reference?.messageId) {
            const ref = await message.fetchReference().catch(() => null);
            text = messageText(ref).text;
        }
        if (!text) return message.reply(t('trt.usage', lang)).catch(() => {});

        const loadingMsg = await message.reply(t('trt.loading', lang)).catch(() => null);
        const translated = await translate(text, from, to).catch(() => null);
        if (!translated) return loadingMsg?.edit(t('trt.error', lang)).catch(() => {});
        return loadingMsg?.edit({ content: null, ...resultCard(text, translated, from, to, lang) }).catch(() => {});
    },

    execute: async (interaction) => {
        const lang = require('../lib/i18n').slashLang(interaction, ['en', 'fr']);
        const text = interaction.options.getString('text');
        const from = interaction.options.getString('from') || 'auto';
        const to = interaction.options.getString('to') || 'en';
        await interaction.deferReply();
        const translated = await translate(text, from, to).catch(() => null);
        if (!translated) return interaction.editReply(t('trt.error', lang)).catch(() => {});
        return interaction.editReply(resultCard(text, translated, from, to, lang)).catch(() => {});
    }
};
