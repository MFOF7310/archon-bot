const { translate } = require('google-translate-api-x');
const { EmbedBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        title: '🌍 TRANSLATION GATEWAY',
        success: 'Your message has been successfully translated!',
        truncated: '*Note: Translation truncated due to length limits.*',
        source: '📥 Source',
        target: '📤 Target',
        footer: (source, target, user) => `${source} → ${target} • Requested by ${user}`,
        usage: '🛰️ **Translation Usage:**',
        usageExample: (prefix) => `\`${prefix}trt <lang> [text]\`\nExample: \`${prefix}trt fr Hello world\`\nOr reply to a message with \`${prefix}trt es\`\n**Common codes:** en, es, fr, de, zh, ja, ko, ar, ru, pt, it`,
        noText: '❌ Please provide text to translate or reply to a message.',
        fetchError: '❌ Could not fetch the replied message.',
        invalidLang: '❌ Invalid language code. Use codes like: en, es, fr, de, zh, ja, ko, ar, ru',
        serviceError: '❌ **Translation failed.** The language code may be invalid or the service is temporarily unavailable.',
        autoDetected: 'Auto-detected',
        processing: '🔄 Processing translation...'
    },
    fr: {
        title: '🌍 PASSERELLE DE TRADUCTION',
        success: 'Votre message a été traduit avec succès !',
        truncated: '*Note : Traduction tronquée en raison des limites de longueur.*',
        source: '📥 Source',
        target: '📤 Cible',
        footer: (source, target, user) => `${source} → ${target} • Demandé par ${user}`,
        usage: '🛰️ **Utilisation de la Traduction :**',
        usageExample: (prefix) => `\`${prefix}trt <langue> [texte]\`\nExemple : \`${prefix}trt en Bonjour le monde\`\nOu répondez à un message avec \`${prefix}trt en\`\n**Codes courants :** en, es, fr, de, zh, ja, ko, ar, ru, pt, it`,
        noText: '❌ Veuillez fournir un texte à traduire ou répondre à un message.',
        fetchError: '❌ Impossible de récupérer le message répondu.',
        invalidLang: '❌ Code de langue invalide. Utilisez des codes comme : en, es, fr, de, zh, ja, ko, ar, ru',
        serviceError: '❌ **Échec de la traduction.** Le code de langue est peut-être invalide ou le service est temporairement indisponible.',
        autoDetected: 'Détecté automatiquement',
        processing: '🔄 Traitement de la traduction...'
    }
};

// ================= LANGUAGE MAPPING =================
const langMap = {
    // Chinese variants
    'cn': 'zh', 'chinese': 'zh', 'chinois': 'zh',
    // English
    'en': 'en', 'english': 'en', 'anglais': 'en',
    // Spanish
    'es': 'es', 'spanish': 'es', 'espagnol': 'es',
    // French
    'fr': 'fr', 'french': 'fr', 'francais': 'fr', 'français': 'fr',
    // German
    'de': 'de', 'german': 'de', 'allemand': 'de',
    // Italian
    'it': 'it', 'italian': 'it', 'italien': 'it',
    // Portuguese
    'pt': 'pt', 'portuguese': 'pt', 'portugais': 'pt',
    // Russian
    'ru': 'ru', 'russian': 'ru', 'russe': 'ru',
    // Japanese
    'ja': 'ja', 'japanese': 'ja', 'japonais': 'ja',
    // Korean
    'ko': 'ko', 'korean': 'ko', 'coreen': 'ko', 'coréen': 'ko',
    // Arabic
    'ar': 'ar', 'arabic': 'ar', 'arabe': 'ar',
    // Hindi
    'hi': 'hi', 'hindi': 'hi',
    // Dutch
    'nl': 'nl', 'dutch': 'nl', 'neerlandais': 'nl', 'néerlandais': 'nl',
    // Polish
    'pl': 'pl', 'polish': 'pl', 'polonais': 'pl',
    // Turkish
    'tr': 'tr', 'turkish': 'tr', 'turc': 'tr',
    // Vietnamese
    'vi': 'vi', 'vietnamese': 'vi', 'vietnamien': 'vi',
    // Thai
    'th': 'th', 'thai': 'th', 'thailandais': 'th'
};

// ================= LANGUAGE DISPLAY NAMES =================
const langNames = {
    'zh': '🇨🇳 Chinese',
    'en': '🇬🇧 English',
    'es': '🇪🇸 Spanish',
    'fr': '🇫🇷 French',
    'de': '🇩🇪 German',
    'it': '🇮🇹 Italian',
    'pt': '🇵🇹 Portuguese',
    'ru': '🇷🇺 Russian',
    'ja': '🇯🇵 Japanese',
    'ko': '🇰🇷 Korean',
    'ar': '🇸🇦 Arabic',
    'hi': '🇮🇳 Hindi',
    'nl': '🇳🇱 Dutch',
    'pl': '🇵🇱 Polish',
    'tr': '🇹🇷 Turkish',
    'vi': '🇻🇳 Vietnamese',
    'th': '🇹🇭 Thai',
    'default': '🌐'
};

// ================= VALID LANGUAGE CODES =================
const validLangCodes = new Set([
    'zh', 'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'ar', 'hi',
    'nl', 'pl', 'tr', 'vi', 'th', 'id', 'ms', 'sv', 'no', 'da', 'fi', 'el',
    'he', 'cs', 'ro', 'hu', 'uk', 'bg', 'sr', 'hr', 'sk', 'sl', 'lt', 'lv', 'et'
]);

module.exports = {
    name: 'trt',
    aliases: ['trans', 'translate', 'traduire', 'traduction'],
    description: '🌍 Translate text between languages with auto-detection.',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.trt <lang> [text]',
    examples: ['.trt fr Hello world', '.trt en Bonjour le monde', '.trt es How are you?'],

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        
        // 🔥 NEURAL LANGUAGE BRIDGE
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, 'en')
            : 'en';
        const t = translations[lang];
        
        const prefix = serverSettings?.prefix || process.env.PREFIX || '.';
        const version = client.version || '1.6.0';
        
        let targetLang = args[0]?.toLowerCase();
        let text = args.slice(1).join(' ');

        // ================= VALIDATION =================
        if (!targetLang) {
            const helpEmbed = new EmbedBuilder()
                .setColor('#00ffcc')
                .setTitle(t.title)
                .setDescription(`${t.usage}\n${t.usageExample(prefix)}`)
                .setFooter({ text: `ARCHITECT CG-223 • v${version}` })
                .setTimestamp();
            return message.reply({ embeds: [helpEmbed] }).catch(() => {});
        }

        // Normalize target language
        targetLang = langMap[targetLang] || targetLang;

        // Validate language code
        if (!validLangCodes.has(targetLang)) {
            return message.reply({ content: t.invalidLang, ephemeral: true }).catch(() => {});
        }

        // ================= GET TEXT (Reply or Args) =================
        if (!text && message.reference) {
            try {
                const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
                if (repliedMsg.content) {
                    text = repliedMsg.content;
                }
                // Also check for attachment descriptions? (optional)
            } catch {
                return message.reply({ content: t.fetchError, ephemeral: true }).catch(() => {});
            }
        }

        if (!text) {
            return message.reply({ content: t.noText, ephemeral: true }).catch(() => {});
        }

        // ================= PROCESSING =================
        const processingMsg = await message.reply({ content: t.processing }).catch(() => {});
        
        try {
            const res = await translate(text, { to: targetLang });
            
            // Get language display names
            const sourceCode = res.from.language.iso;
            const sourceDisplay = langNames[sourceCode] 
                ? `${langNames[sourceCode]} (${sourceCode})` 
                : `${langNames.default} ${sourceCode.toUpperCase()}`;
            
            const targetDisplay = langNames[targetLang] 
                ? `${langNames[targetLang]} (${targetLang})` 
                : `${langNames.default} ${targetLang.toUpperCase()}`;

            // Check if text needs truncation
            const sourceTruncated = text.length > 1024;
            const targetTruncated = res.text.length > 1024;
            const isTruncated = sourceTruncated || targetTruncated;

            // Build embed
            const embed = new EmbedBuilder()
                .setColor('#00ffcc')
                .setTitle(t.title)
                .setDescription(isTruncated ? t.truncated : t.success)
                .addFields(
                    {
                        name: `${t.source} (${sourceDisplay})`,
                        value: sourceTruncated ? text.substring(0, 1021) + '...' : text,
                        inline: false
                    },
                    {
                        name: `${t.target} (${targetDisplay})`,
                        value: targetTruncated ? res.text.substring(0, 1021) + '...' : res.text,
                        inline: false
                    }
                )
                .setFooter({ 
                    text: t.footer(sourceCode.toUpperCase(), targetLang.toUpperCase(), message.author.tag),
                    iconURL: message.author.displayAvatarURL({ dynamic: true })
                })
                .setTimestamp();

            // Add pronunciation if available (for some languages)
            if (res.pronunciation) {
                embed.addFields({
                    name: '🔊 Pronunciation',
                    value: `\`${res.pronunciation}\``,
                    inline: false
                });
            }

            // Delete processing message and send result
            if (processingMsg) await processingMsg.delete().catch(() => {});
            await message.reply({ embeds: [embed] }).catch(() => {});

            console.log(`[TRT] ${message.author.tag} translated ${sourceCode} → ${targetLang} (${text.length} chars)`);
            
        } catch (error) {
            console.error('[TRT] Translation error:', error.message);
            
            if (processingMsg) await processingMsg.delete().catch(() => {});
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setDescription(t.serviceError)
                .setFooter({ text: `ARCHITECT CG-223 • v${version}` })
                .setTimestamp();
            
            await message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }
    }
};