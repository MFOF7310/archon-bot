const googleTTS = require('google-tts-api');

module.exports = {
    name: 'tts',
    description: 'Smart Bilingual TTS (Auto-switches between French and English)',
    category: 'Utility',
    async execute(message, args, client) {
        let textToConvert = args.join(' ');
        
        // 1. Check for replies (Fetch message content)
        if (!textToConvert && message.reference) {
            try {
                const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
                textToConvert = repliedMsg.content;
            } catch (err) {
                return message.reply('❌ **Error:** I cannot read that message.');
            }
        }

        if (!textToConvert) {
            return message.reply('💡 **Usage:** Reply to a message or type text after `,tts`');
        }

        // 2. Safety: Limit to 200 characters (Google API limit)
        const safeText = textToConvert.substring(0, 200);

        // 🧠 BILINGUAL DETECTION
        const frenchIndicators = [' le ', ' la ', ' est ', ' vous ', ' les ', ' une ', ' pour ', ' dans ', ' avec '];
        const hasFrenchAccents = /[éàèêëîïôûùç]/i.test(safeText);
        const isFrench = frenchIndicators.some(word => safeText.toLowerCase().includes(word)) || hasFrenchAccents;
        
        const selectedLang = isFrench ? 'fr-FR' : 'en-US';
        const flag = isFrench ? '🇲🇱/🇫🇷' : '🇺🇸';

        try {
            // 3. Generate the Audio URL
            const url = googleTTS.getAudioUrl(safeText, {
                lang: selectedLang,
                slow: false,
                host: 'https://translate.google.com',
            });

            // 4. Send as an MP3 file
            return message.reply({
                content: `🎙️ **Voice synthesized in:** ${isFrench ? 'French' : 'English'} ${flag}`,
                files: [{
                    attachment: url,
                    name: `CG223_Voice.mp3`
                }]
            });
        } catch (error) {
            console.error('TTS Error:', error);
            message.reply('❌ **Synthesis failure:** The Google voice engine is currently busy.');
        }
    }
};
