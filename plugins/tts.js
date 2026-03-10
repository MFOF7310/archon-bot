const googleTTS = require('google-tts-api');

module.exports = {
    name: 'tts',
    description: 'Smart Bilingual Voice Synthesis (FR/EN)',
    category: 'UTILITY',
    run: async (client, message, args, database) => {
        let text = args.join(' ');
        
        // 1. Context Check (Arguments or Reply)
        if (!text && message.reference) {
            const repliedMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
            text = repliedMsg?.content;
        }

        if (!text) return message.reply('💡 **Protocol:** Provide text or reply to a message. \n*Usage: .tts [text]*');

        // 2. Intelligence: Language Detection
        // Scans for French-specific characters or common French syntax
        const safeText = text.substring(0, 200);
        const isFrench = /[éàèêëîïôûùç]/i.test(safeText) || 
                         /\b(le|la|les|un|une|et|est)\b/i.test(safeText);
        
        const langCode = isFrench ? 'fr-FR' : 'en-US';

        try {
            // 3. Audio Generation
            const url = googleTTS.getAudioUrl(safeText, {
                lang: langCode,
                slow: false,
                host: 'https://translate.google.com',
            });

            return message.reply({
                content: `🎙️ **Voice Engine:** \`${isFrench ? 'Français 🇲🇱' : 'English 🇺🇸'}\``,
                files: [{ 
                    attachment: url, 
                    name: `architect_voice_${Date.now()}.mp3` 
                }]
            });

        } catch (error) {
            console.error("TTS Failure:", error);
            return message.reply("⚠️ **Uplink Failure:** Voice synthesis engine is currently unavailable.");
        }
    }
};
