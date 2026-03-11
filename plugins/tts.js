const googleTTS = require('google-tts-api');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'tts',
    aliases: ['speak', 'voice'],
    description: 'Convert text to speech with automatic language detection (French/English).',
    category: 'UTILITY',
    run: async (client, message, args, database) => {
        let text = args.join(' ');

        // If no text but reply exists, fetch replied message content
        if (!text && message.reference) {
            try {
                const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
                text = repliedMsg.content;
            } catch {
                return message.reply("❌ Could not fetch the replied message.");
            }
        }

        if (!text) {
            return message.reply({
                content: `💡 **Protocol:** Provide text or reply to a message.\nUsage: \`${process.env.PREFIX || '.'}tts [text]\``
            });
        }

        // Intelligent language detection
        const isFrench = /[éàèêëîïôûùçœæ]/i.test(text) || 
                         /\b(le|la|les|un|une|et|est|dans|pour|avec|vous|nous)\b/i.test(text);
        const langCode = isFrench ? 'fr-FR' : 'en-US';
        const langFlag = isFrench ? '🇫🇷' : '🇺🇸';
        
        // Truncate text for safety (Google TTS limit ~200 chars)
        const maxLength = 200;
        const truncated = text.length > maxLength ? text.substring(0, maxLength) + '…' : text;

        try {
            const url = googleTTS.getAudioUrl(truncated, {
                lang: langCode,
                slow: false,
                host: 'https://translate.google.com',
            });

            const embed = new EmbedBuilder()
                .setColor('#9b59b6')
                .setAuthor({ name: '🎙️ VOICE SYNTHESIS ENGINE', iconURL: client.user.displayAvatarURL() })
                .setDescription(`**Detected Language:** ${langFlag} ${isFrench ? 'Français' : 'English'}\n**Text:**\n\`\`\`${truncated}\`\`\``)
                .setFooter({ text: `Bamako Node • ${text.length > maxLength ? 'Truncated' : 'Full message'}` })
                .setTimestamp();

            await message.reply({
                embeds: [embed],
                files: [{
                    attachment: url,
                    name: `lydia_voice_${Date.now()}.mp3`
                }]
            });

        } catch (error) {
            console.error("TTS Error:", error);
            message.reply("⚠️ **Uplink Failure:** Voice synthesis engine is currently unavailable.");
        }
    }
};