const googleTTS = require('google-tts-api');
const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, FileBuilder, MessageFlags } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const i18n = require('../lib/i18n');
const I18N_KEYS = ["author","detected","text","truncated","fullMessage","processing","noText","usage","fetchError","uplinkFailure","node","characters","voice","neuralVoice","clickToPlay"];
// Clés dans lang/<locale>/tts.json ; '' retombe sur EN dans t().
function loadT(lang) {
    const o = {};
    for (const k of I18N_KEYS) o[k] = i18n.t(`tts.${k}`, lang);
    return o;
}

module.exports = {
    name: 'tts',
    aliases: ['speak', 'voice', 'parle', 'voix', 'dire'],
    description: '🎙️ Convert text to speech with automatic French/English detection.',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.tts [text] or reply to a message with .tts',
    examples: ['.tts Bonjour tout le monde', '.tts Hello world'],

// ================= SLASH COMMAND DATA =================
data: new SlashCommandBuilder()
    .setName('tts')
    .setDescription('🎙️ Convert text to speech with automatic French/English detection')
    .addStringOption(option =>
        option.setName('text')
            .setDescription('Text to convert to speech')
            .setRequired(true)
    ),

// One message, like a real Discord command: the text, the detected voice, and the audio file inside the card.
// (Before: a "processing" embed, then an edit with a STATISTICS block; the voice was labelled "neural", which
// Google Translate's voice is not.)
run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        lang = client.detectLanguage ? client.detectLanguage('tts', message.guild?.id) : 'en';
        const t = loadT(lang);
        const tr = (k, v) => i18n.t(`tts.${k}`, lang, v);
        const prefix = serverSettings?.prefix || process.env.PREFIX || '.';
        let text = args.join(' ');

        // Reply to a message with .tts to read it aloud
        if (!text && message.reference) {
            try {
                const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
                if (repliedMsg.content) text = repliedMsg.content;
            } catch {
                return message.reply({ content: t.fetchError, allowedMentions: { repliedUser: false } }).catch(() => {});
            }
        }

        if (!text) {
            return message.reply({
                content: `${t.noText}\n-# ${t.usage} : \`${prefix}tts ${tr('exampleText')}\` · ${tr('replyHint', { cmd: `\`${prefix}tts\`` })}`,
                allowedMentions: { repliedUser: false },
            }).catch(() => {});
        }

        // French or English voice, from the text itself
        const frenchPattern = /[éèêëàâäôöùûüÿçœæ]/i;
        const frenchWords = /\b(le|la|les|un|une|des|du|de|et|est|dans|pour|avec|vous|nous|je|tu|il|elle|bonjour|salut|merci|comment|quoi|pourquoi|quand)\b/i;
        const isFrench = frenchPattern.test(text) || frenchWords.test(text);
        const voiceCode = isFrench ? 'fr-FR' : 'en-US';
        const langFlag = isFrench ? '🇫🇷' : '🇺🇸';
        const langName = isFrench ? 'Français' : 'English';

        const maxLength = 200;
        const isTruncated = text.length > maxLength;
        const spoken = isTruncated ? text.substring(0, maxLength) + '…' : text;

        if (!message.isSlash) message.channel?.sendTyping?.().catch(() => {});
        try {
            const url = googleTTS.getAudioUrl(spoken, { lang: voiceCode, slow: false, host: 'https://translate.google.com' });
            const quote = spoken.replace(/\n+/g, ' ').substring(0, 300);
            const card = new ContainerBuilder().setAccentColor(0x5865F2)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${t.author}\n> ${quote}`))
                .addFileComponents(new FileBuilder().setURL('attachment://voice.mp3'))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `-# ${langFlag} ${langName} · ${text.length} ${t.characters}${isTruncated ? ` · ${tr('truncatedNote', { n: maxLength })}` : ''}`));
            await message.reply({
                components: [card],
                files: [{ attachment: url, name: 'voice.mp3' }],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [], repliedUser: false },
            });
        } catch (error) {
            console.error('[TTS] Error:', error.message);
            await message.reply({ content: t.uplinkFailure, allowedMentions: { repliedUser: false } }).catch(() => {});
        }
    },

    // ================= SLASH COMMAND EXECUTION =================
    execute: async (interaction, client) => {
        const text = interaction.options.getString('text');
        const args = text.split(' ');
        
        // Fetching the voice can take a few seconds: answer Discord first ("thinking…"), then send the card
        await interaction.deferReply().catch(() => {});
        const fakeMessage = {
            isSlash: true,
            author: interaction.user,
            guild: interaction.guild,
            channel: interaction.channel,
            reply: async (options) => {
                if (interaction.deferred) return interaction.editReply(options);
                return interaction.reply(options);
            },
            react: () => Promise.resolve()
        };
        
        const serverSettings = interaction.guild ? client.getServerSettings(interaction.guild.id) : { prefix: '.' };
        
        await module.exports.run(client, fakeMessage, args, client.db, serverSettings, 'tts');
    }
};