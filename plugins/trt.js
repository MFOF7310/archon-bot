const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { t } = require('../lib/i18n');
const em = (k, fb) => { try { return require('../config/emojis')[k] || fb; } catch { return fb; } };
const axios = require('axios');

const LANG_CODES = { 'english': 'en', 'french': 'fr', 'spanish': 'es', 'german': 'de', 'italian': 'it', 'portuguese': 'pt', 'russian': 'ru', 'japanese': 'ja', 'korean': 'ko', 'chinese': 'zh', 'arabic': 'ar', 'hindi': 'hi' };
function resolveCode(input) { return LANG_CODES[input.toLowerCase()] || input.toLowerCase(); }

module.exports = {
    name: 'translate', aliases: ['tr', 'translation', 'translator'],
    description: '🌐 Translate text between 12 languages instantly.',
    category: 'UTILITY', cooldown: 3000, usage: '.translate <text> [from] [to]', examples: ['.translate hello fr', '.translate bonjour en fr'],
    data: new SlashCommandBuilder().setName('translate').setDescription('🌐 Translate text').addStringOption(o => o.setName('text').setDescription('Text to translate').setRequired(true)).addStringOption(o => o.setName('from').setDescription('Source language').setRequired(false).addChoices({name:'Auto',value:'auto'},{name:'English',value:'en'},{name:'French',value:'fr'},{name:'Spanish',value:'es'},{name:'German',value:'de'},{name:'Japanese',value:'ja'})).addStringOption(o => o.setName('to').setDescription('Target language').setRequired(false).addChoices({name:'English',value:'en'},{name:'French',value:'fr'},{name:'Spanish',value:'es'},{name:'German',value:'de'},{name:'Japanese',value:'ja'},{name:'Russian',value:'ru'},{name:'Korean',value:'ko'},{name:'Chinese',value:'zh'})),
    
    run: async (client, message, args, db, ss, used, lang) => {
        if (!lang) lang = require('../lib/pick-lang').pickLang(client, message?.guild?.id, message, message?.author?.id);
        if (args.length < 1) return message.reply(t('trt.usage', lang)).catch(() => {});
        
        let from = 'auto', to = 'en', text = '';
        const last = args[args.length - 1]?.toLowerCase();
        const secondLast = args[args.length - 2]?.toLowerCase();
        
        if (Object.values(LANG_CODES).includes(last) || Object.keys(LANG_CODES).includes(last)) {
            to = resolveCode(last); args.pop();
            if (Object.values(LANG_CODES).includes(secondLast) || Object.keys(LANG_CODES).includes(secondLast)) {
                from = resolveCode(secondLast); args.pop();
            }
        }
        text = args.join(' ');
        if (!text) return message.reply(t('trt.provideText', lang)).catch(() => {});
        
        const loadingMsg = await message.reply(t('trt.loading', lang)).catch(() => null);
        try {
            const res = await axios.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from === 'auto' ? 'Autodetect' : from}|${to}`);
            const translated = res.data.responseData?.translatedText || t('trt.error', lang);
            
            const c = new ContainerBuilder().setAccentColor(0x00fbff);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${em('globe', '🌐')} ${t('trt.translated', lang)}`));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${em('file', '📝')} ${t('trt.original', lang)}**\n>>> ${text}`));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${em('ping_ok', em('ic_ok', '✅'))} ${t('trt.translated', lang)}**\n>>> ${translated}`));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${from.toUpperCase()} ➔ ${to.toUpperCase()}`));
            
            loadingMsg?.edit({ content: null, components: [c], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        } catch (e) { loadingMsg?.edit(t('trt.error', lang)).catch(() => {}); }
    },

    execute: async (interaction) => {
        const lang = require('../lib/i18n').slashLang(interaction, ['en', 'fr']);
        const text = interaction.options.getString('text');
        const from = interaction.options.getString('from') || 'auto';
        const to = interaction.options.getString('to') || 'en';
        await interaction.deferReply();
        
        try {
            const res = await axios.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from === 'auto' ? 'Autodetect' : from}|${to}`);
            const translated = res.data.responseData?.translatedText || t('trt.error', lang);
            
            const c = new ContainerBuilder().setAccentColor(0x00fbff);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${em('globe', '🌐')} ${t('trt.translated', lang)}`));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${em('file', '📝')} ${t('trt.original', lang)}**\n>>> ${text}`));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${em('ping_ok', em('ic_ok', '✅'))} ${t('trt.translated', lang)}**\n>>> ${translated}`));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${from.toUpperCase()} ➔ ${to.toUpperCase()}`));
            
            await interaction.editReply({ components: [c], flags: MessageFlags.IsComponentsV2 });
        } catch (e) { interaction.editReply(t('trt.error', lang)); }
    }
};
