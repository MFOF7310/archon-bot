const googleTTS = require('google-tts-api');

module.exports = {
    name: 'tts',
    description: 'Smart Bilingual TTS (Auto-switches French/English)',
    category: 'Utility',
    // Arguments must match your index.js: (message, args, client, model, lydiaChannels, database)
    async execute(message, args, client) {
        let textToConvert = args.join(' ');
        
        // 1. Check for replies
        if (!textToConvert && message.reference) {
            try {
                const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
                textToConvert = repliedMsg.content;
            } catch (err) {
                return message.reply('❌ **Error:** Could not read the replied message.');
            }
        }

        if (!textToConvert) {
            return message.reply('💡 **Usage:** `,tts [text]` or reply to a message with `,tts`');
        }

        // 2. Limit text length (Google Free TTS limit is 200 chars)
        const safeText = textToConvert.substring(0, 200);

        // 🧠 BILINGUAL DETECTION (Enhanced)
        const frenchWords = ['le', 'la', 'les', 'des', 'est', 'suis', 'es', 'vous', 'nous', 'tu', 'je', 'un', 'une', 'pour', 'dans', 'avec', 'salut', 'ca', 'va'];
        const words = safeText.toLowerCase().split(/\s+/);
        
        // Check if any word in the text matches our French list or has accents
        const hasFrenchAccents = /[éàèêëîïôûùç]/i.test(safeText);
        const hasFrenchWords = words.some(word => frenchWords.includes(word));
        
        const isFrench = hasFrenchWords || hasFrenchAccents;
        
        const selectedLang = isFrench ? 'fr-FR' : 'en-US';
        const accentLabel = isFrench ? 'French (Mali/FR)' : 'English (US)';
        const flag = isFrench ? '🇲🇱' : '🇺🇸';

        try {
            // 3. Generate Audio URL
            const url = googleTTS.getAudioUrl(safeText, {
                lang: selectedLang,
                slow: false,
                host: 'https://translate.google.com',
            });

            // 4. Send the result
            return message.reply({
                content: `🎙️ **Voice Engine:** ${accentLabel} ${flag}`,
                files: [{
                    attachment: url,
                    name: `CG223_TTS_${isFrench ? 'FR' : 'EN'}.mp3`
                }]
            });
        } catch (error) {
            console.error('TTS Error:', error);
            message.reply('❌ **Synthesis failure:** Google Voice Engine is unreachable.');
        }
    }
};
