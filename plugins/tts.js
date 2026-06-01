const googleTTS = require('google-tts-api');
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        author: '🎙️ VOICE SYNTHESIS ENGINE',
        detected: 'Detected Language',
        text: 'Text',
        truncated: 'Truncated',
        fullMessage: 'Full message',
        processing: '⚙️ Processing neural voice synthesis...',
        noText: '💡 **Protocol:** Provide text or reply to a message.',
        usage: 'Usage',
        fetchError: '❌ Could not fetch the replied message.',
        uplinkFailure: '⚠️ **Uplink Failure:** Voice synthesis engine unavailable.',
        node: 'Bamako Node',
        characters: 'characters',
        voice: 'Voice',
        neuralVoice: 'Neural Voice',
        clickToPlay: '🔊 Click to play the audio file above!'
    },
    fr: {
        author: '🎙️ MOTEUR DE SYNTHÈSE VOCALE',
        detected: 'Langue Détectée',
        text: 'Texte',
        truncated: 'Tronqué',
        fullMessage: 'Message complet',
        processing: '⚙️ Traitement de la synthèse vocale neurale...',
        noText: '💡 **Protocole:** Fournissez du texte ou répondez à un message.',
        usage: 'Utilisation',
        fetchError: '❌ Impossible de récupérer le message répondu.',
        uplinkFailure: '⚠️ **Échec de Liaison:** Moteur de synthèse vocale indisponible.',
        node: 'Nœud Bamako',
        characters: 'caractères',
        voice: 'Voix',
        neuralVoice: 'Voix Neurale',
        clickToPlay: '🔊 Cliquez pour jouer le fichier audio ci-dessus !'
    }
};

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

// 🔥 NEW SIGNATURE: 6 parameters with usedCommand
run: async (client, message, args, db, serverSettings, usedCommand) => {
        
        // 🔥 NEURAL LANGUAGE BRIDGE - Alias-based detection!
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, 'en')
            : 'en';
        
        const t = translations[lang];
        const version = client.version || '1.6.0';
        const prefix = serverSettings?.prefix || process.env.PREFIX || '.';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        
        let text = args.join(' ');

        // ================= FETCH REPLIED MESSAGE =================
        if (!text && message.reference) {
            try {
                const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
                if (repliedMsg.content) {
                    text = repliedMsg.content;
                }
            } catch {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ED4245')
                    .setDescription(t.fetchError)
                    .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon });
                return message.reply({ embeds: [errorEmbed] }).catch(() => {});
            }
        }

        // ================= NO TEXT PROVIDED =================
        if (!text) {
            const helpEmbed = new EmbedBuilder()
                .setColor('#00fbff')
                .setAuthor({ name: t.author, iconURL: client.user.displayAvatarURL() })
                .setDescription(
                    `${t.noText}\n\n` +
                    `**${t.usage}:** \`${prefix}tts [${lang === 'fr' ? 'texte' : 'text'}]\`\n` +
                    `**${lang === 'fr' ? 'Exemple' : 'Example'}:** \`${prefix}tts ${lang === 'fr' ? 'Bonjour tout le monde' : 'Hello world'}\`\n\n` +
                    `💡 ${lang === 'fr' ? 'Vous pouvez aussi répondre à un message avec' : 'You can also reply to a message with'} \`${prefix}tts\``
                )
                .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            return message.reply({ embeds: [helpEmbed] }).catch(() => {});
        }

        // ================= INTELLIGENT LANGUAGE DETECTION =================
        const frenchPattern = /[éèêëàâäôöùûüÿçœæ]/i;
        const frenchWords = /\b(le|la|les|un|une|des|du|de|et|est|dans|pour|avec|vous|nous|je|tu|il|elle|bonjour|salut|merci|comment|quoi|pourquoi|quand)\b/i;
        const isFrench = frenchPattern.test(text) || frenchWords.test(text);
        
        const langCode = isFrench ? 'fr' : 'en';
        const voiceCode = isFrench ? 'fr-FR' : 'en-US';
        const langFlag = isFrench ? '🇫🇷' : '🇺🇸';
        const langName = isFrench ? 'Français' : 'English';
        const voiceName = isFrench ? 'Française' : 'American';
        
        // ================= TRUNCATE TEXT =================
        const maxLength = 200;
        const isTruncated = text.length > maxLength;
        const truncated = isTruncated ? text.substring(0, maxLength) + '…' : text;
        
        // ================= PROCESSING EMBED =================
        const processingEmbed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setAuthor({ name: t.author, iconURL: client.user.displayAvatarURL() })
            .setDescription(
                `**${t.processing}**\n\n` +
                `**${t.detected}:** ${langFlag} ${langName}\n` +
                `**${t.voice}:** 🎤 ${voiceName}\n` +
                `**${t.text}:** ${text.length} ${t.characters}`
            )
            .setFooter({ text: `${guildName} • ${t.node} • v${version}`, iconURL: guildIcon })
            .setTimestamp();
        
        const processingMsg = await message.reply({ embeds: [processingEmbed] }).catch(() => {});

        try {
            // ================= GENERATE TTS =================
            const url = googleTTS.getAudioUrl(truncated, {
                lang: voiceCode,
                slow: false,
                host: 'https://translate.google.com',
            });

            // ================= SUCCESS EMBED =================
            const successEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setAuthor({ name: t.author, iconURL: client.user.displayAvatarURL() })
                .setDescription(
                    `**${t.detected}:** ${langFlag} ${langName}\n` +
                    `**${t.voice}:** 🎤 ${t.neuralVoice} (${voiceName})\n` +
                    `**${t.text}:**\n\`\`\`${truncated}\`\`\``
                )
                .addFields({
                    name: '📊 STATISTICS',
                    value: `\`\`\`yaml\n${t.characters}: ${text.length}\n${t.truncated}: ${isTruncated ? '✅ Yes' : '❌ No'}\n\`\`\``,
                    inline: false
                })
                .setFooter({ 
                    text: `${guildName} • ${t.node} • ${isTruncated ? t.truncated : t.fullMessage} • v${version}`, 
                    iconURL: guildIcon 
                })
                .setTimestamp();

            // ================= EDIT OR SEND NEW =================
            if (processingMsg) {
                await processingMsg.edit({ 
                    embeds: [successEmbed], 
                    files: [{
                        attachment: url,
                        name: `neural_voice_${langCode}_${Date.now()}.mp3`
                    }] 
                }).catch(async () => {
                    // If edit fails, send new
                    await message.reply({
                        embeds: [successEmbed],
                        files: [{
                            attachment: url,
                            name: `neural_voice_${langCode}_${Date.now()}.mp3`
                        }]
                    }).catch(() => {});
                });
            } else {
                await message.reply({
                    embeds: [successEmbed],
                    files: [{
                        attachment: url,
                        name: `neural_voice_${langCode}_${Date.now()}.mp3`
                    }]
                }).catch(() => {});
            }

        } catch (error) {
            console.error('[TTS] Error:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setAuthor({ name: t.author, iconURL: client.user.displayAvatarURL() })
                .setDescription(t.uplinkFailure)
                .setFooter({ text: `${guildName} • ${t.node} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            
            if (processingMsg) {
                await processingMsg.edit({ embeds: [errorEmbed], files: [] }).catch(() => {});
            } else {
                await message.reply({ embeds: [errorEmbed] }).catch(() => {});
            }
        }
    },

    // ================= SLASH COMMAND EXECUTION =================
    execute: async (interaction, client) => {
        const text = interaction.options.getString('text');
        const args = text.split(' ');
        
        const fakeMessage = {
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