const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const T = {
    en: { loading: '🔤 Translating...', error: '❌ Translation failed. Try again!', footer: (from, to) => `${from.toUpperCase()} → ${to.toUpperCase()}`, translated: '🌐 Translated', original: '📝 Original', languages: { en: 'English', fr: 'French', es: 'Spanish', de: 'German', it: 'Italian', pt: 'Portuguese', ru: 'Russian', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', ar: 'Arabic', hi: 'Hindi' } },
    fr: { loading: '🔤 Traduction en cours...', error: '❌ Échec de la traduction. Réessayez !', footer: (from, to) => `${from.toUpperCase()} → ${to.toUpperCase()}`, translated: '🌐 Traduit', original: '📝 Original', languages: { en: 'Anglais', fr: 'Français', es: 'Espagnol', de: 'Allemand', it: 'Italien', pt: 'Portugais', ru: 'Russe', ja: 'Japonais', ko: 'Coréen', zh: 'Chinois', ar: 'Arabe', hi: 'Hindi' } }
};

const LANG_CODES = { 'english': 'en', 'french': 'fr', 'spanish': 'es', 'german': 'de', 'italian': 'it', 'portuguese': 'pt', 'russian': 'ru', 'japanese': 'ja', 'korean': 'ko', 'chinese': 'zh', 'arabic': 'ar', 'hindi': 'hi' };

function resolveCode(input) {
    const lower = input.toLowerCase();
    return LANG_CODES[lower] || lower;
}

module.exports = {
    name: 'translate', aliases: ['tr', 'translation', 'translator'],
    description: '🌐 Translate text between 12 languages instantly.',
    category: 'UTILITY', cooldown: 3000, usage: '.translate <text> [from] [to]', examples: ['.translate hello fr', '.translate bonjour en fr'],
    data: new SlashCommandBuilder().setName('translate').setDescription('🌐 Translate text').addStringOption(o => o.setName('text').setDescription('Text to translate').setRequired(true)).addStringOption(o => o.setName('from').setDescription('Source language (default: auto)').setRequired(false).addChoices({name:'Auto',value:'auto'},{name:'English',value:'en'},{name:'French',value:'fr'},{name:'Spanish',value:'es'},{name:'German',value:'de'},{name:'Japanese',value:'ja'})).addStringOption(o => o.setName('to').setDescription('Target language (default: English)').setRequired(false).addChoices({name:'English',value:'en'},{name:'French',value:'fr'},{name:'Spanish',value:'es'},{name:'German',value:'de'},{name:'Japanese',value:'ja'},{name:'Russian',value:'ru'},{name:'Korean',value:'ko'},{name:'Chinese',value:'zh'})),
    run: async (client, message, args, db, ss, used) => {
        const lang = client.detectLanguage ? client.detectLanguage(used, 'en') : 'en';
        const t = T[lang];
        if (args.length < 1) return message.reply('❌ Usage: `.translate hello fr` or `.translate bonjour en fr`').catch(() => {});
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
        if (!text) return message.reply('❌ Provide text to translate.').catch(() => {});
        const loadingMsg = await message.reply(t.loading).catch(() => null);
        try {
            const apiKey = process.env.TRANSLATION_API_KEY;
            let translated = '';
            if (apiKey) {
                const axios = require('axios');
                const res = await axios.get(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}&q=${encodeURIComponent(text)}&source=${from === 'auto' ? '' : from}&target=${to}&format=text`);
                translated = res.data.data.translations[0].translatedText;
            } else {
                // Fallback: MyMemory API (free, no key)
                const https = require('https');
                const res = await new Promise((resolve, reject) => {
                    https.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from === 'auto' ? 'Autodetect' : from}|${to}`, { timeout: 10000 }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => resolve(JSON.parse(d))); }).on('error', reject);
                });
                translated = res.responseData?.translatedText || 'Translation unavailable without API key.';
            }
            const embed = new EmbedBuilder().setColor('#00fbff').addFields(
                { name: t.original, value: text.length > 500 ? text.substring(0, 500) + '...' : text, inline: false },
                { name: t.translated, value: translated.length > 500 ? translated.substring(0, 500) + '...' : translated, inline: false }
            ).setFooter({ text: t.footer(from, to) }).setTimestamp();
            loadingMsg?.edit({ content: null, embeds: [embed] }).catch(() => {});
        } catch (e) { loadingMsg?.edit(t.error).catch(() => {}); }
    },
    execute: async (interaction) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = T[lang];
        const text = interaction.options.getString('text');
        const from = interaction.options.getString('from') || 'auto';
        const to = interaction.options.getString('to') || 'en';
        await interaction.deferReply();
        try {
            const apiKey = process.env.TRANSLATION_API_KEY;
            let translated = '';
            if (apiKey) {
                const axios = require('axios');
                const res = await axios.get(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}&q=${encodeURIComponent(text)}&source=${from === 'auto' ? '' : from}&target=${to}&format=text`);
                translated = res.data.data.translations[0].translatedText;
            } else {
                const https = require('https');
                const res = await new Promise((resolve, reject) => {
                    https.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from === 'auto' ? 'Autodetect' : from}|${to}`, { timeout: 10000 }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => resolve(JSON.parse(d))); }).on('error', reject);
                });
                translated = res.responseData?.translatedText || 'Translation unavailable without API key.';
            }
            const embed = new EmbedBuilder().setColor('#00fbff').addFields(
                { name: t.original, value: text.length > 500 ? text.substring(0, 500) + '...' : text, inline: false },
                { name: t.translated, value: translated.length > 500 ? translated.substring(0, 500) + '...' : translated, inline: false }
            ).setFooter({ text: t.footer(from, to) }).setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        } catch (e) { interaction.editReply(t.error); }
    }
};