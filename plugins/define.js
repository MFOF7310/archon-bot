const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const https = require('https');

const T = {
    en: { loading: (word) => `📖 Looking up **${word}**...`, notFound: (word) => `❌ No definition found for "${word}".`, error: '❌ Dictionary service unavailable.', footer: (word) => `Merriam-Webster • "${word}"`, source: 'Source', phonetic: '🔊 Phonetic', partOfSpeech: 'Part of Speech', definition: '📝 Definition', example: '💬 Example', synonyms: '🔗 Synonyms' },
    fr: { loading: (word) => `📖 Recherche de **${word}**...`, notFound: (word) => `❌ Aucune définition trouvée pour "${word}".`, error: '❌ Service de dictionnaire indisponible.', footer: (word) => `Merriam-Webster • "${word}"`, source: 'Source', phonetic: '🔊 Phonétique', partOfSpeech: 'Catégorie', definition: '📝 Définition', example: '💬 Exemple', synonyms: '🔗 Synonymes' }
};

function fetchDict(word) {
    return new Promise((resolve, reject) => {
        https.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { timeout: 8000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
        }).on('error', reject);
    });
}

module.exports = {
    name: 'define', aliases: ['definition', 'def', 'dict', 'dictionary'],
    description: '📖 Look up word definitions with phonetics, examples, and synonyms.',
    category: 'UTILITY', cooldown: 3000, usage: '.define <word>', examples: ['.define serendipity', '/define word:ephemeral'],
    data: new SlashCommandBuilder().setName('define').setDescription('📖 Look up a word definition').addStringOption(o => o.setName('word').setDescription('Word to define').setRequired(true)),
    run: async (client, message, args, db, ss, used) => {
        const lang = client.detectLanguage ? client.detectLanguage(used, 'en') : 'en';
        const t = T[lang], word = args.join(' ');
        if (!word) return message.reply('❌ Provide a word: `.define serendipity`').catch(() => {});
        const msg = await message.reply(t.loading(word)).catch(() => null);
        try {
            const data = await fetchDict(word);
            if (!Array.isArray(data) || data.length === 0) return msg?.edit(t.notFound(word)).catch(() => {});
            const entry = data[0];
            const meaning = entry.meanings?.[0];
            const def = meaning?.definitions?.[0];
            const embed = new EmbedBuilder().setColor('#3498db').setTitle(`📖 ${entry.word}`).setDescription(
                (entry.phonetic ? `🔊 \`${entry.phonetic}\`\n\n` : '') +
                (meaning?.partOfSpeech ? `**${meaning.partOfSpeech}**\n` : '') +
                `> 📝 ${def?.definition || 'No definition'}\n\n` +
                (def?.example ? `💬 *"${def.example}"*\n\n` : '') +
                (def?.synonyms?.length ? `🔗 ${def.synonyms.slice(0, 5).join(', ')}` : '')
            ).setFooter({ text: t.footer(entry.word) }).setTimestamp();
            msg?.edit({ content: null, embeds: [embed] }).catch(() => {});
        } catch (e) { msg?.edit(t.error).catch(() => {}); }
    },
    execute: async (interaction) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = T[lang], word = interaction.options.getString('word');
        await interaction.deferReply();
        try {
            const data = await fetchDict(word);
            if (!Array.isArray(data) || data.length === 0) return interaction.editReply(t.notFound(word));
            const entry = data[0], meaning = entry.meanings?.[0], def = meaning?.definitions?.[0];
            const embed = new EmbedBuilder().setColor('#3498db').setTitle(`📖 ${entry.word}`).setDescription(
                (entry.phonetic ? `🔊 \`${entry.phonetic}\`\n\n` : '') +
                (meaning?.partOfSpeech ? `**${meaning.partOfSpeech}**\n` : '') +
                `> 📝 ${def?.definition || 'No definition'}\n\n` +
                (def?.example ? `💬 *"${def.example}"*\n\n` : '') +
                (def?.synonyms?.length ? `🔗 ${def.synonyms.slice(0, 5).join(', ')}` : '')
            ).setFooter({ text: t.footer(entry.word) }).setTimestamp();
            interaction.editReply({ embeds: [embed] });
        } catch (e) { interaction.editReply(t.error); }
    }
};