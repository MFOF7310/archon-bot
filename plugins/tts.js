const googleTTS = require('google-tts-api');

module.exports = {
    name: 'tts',
    description: 'Smart Bilingual TTS (Auto-switches between French and English)',
    category: 'Utility',
    async execute(message, args, client) {
        let textToConvert = args.join(' ');
        
        // 1. Check for replies (Levanter-style)
        if (!textToConvert && message.reference) {
            const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
            textToConvert = repliedMsg.content;
        }

        if (!textToConvert) {
            return message.reply('💡 **Usage:** Reply to a message or type text after `,tts`');
        }

        // 🧠 AMAZING BILINGUAL LOGIC
        // Detects French words OR common French special characters
        const frenchIndicators = [' le ', ' la ', ' est ', ' vous ', ' les ', ' une ', ' pour ', ' dans ', ' avec '];
        const hasFrenchAccents = /[éàèêëîïôûùç]/i.test(textToConvert);
        const isFrench = frenchIndicators.some(word => textToConvert.toLowerCase().includes(word)) || hasFrenchAccents;
        
        const selectedLang = isFrench ? 'fr-FR' : 'en-US';
        const flag = isFrench ? '🇫🇷' : '🇺🇸';

        try {
            // Generate the URL (Max 200 chars for Google TTS API)
            const url = googleTTS.getAudioUrl(textToConvert.substring(0, 200), {
                lang: selectedLang,
                slow: false,
                host: 'https://translate.google.com',
            });

            return message.reply({
                content: `🎙️ **Mode:** ${isFrench ? 'Français' : 'English'} ${flag}`,
                files: [{
                    attachment: url,
                    name: `CG223_Voice.mp3`
                }]
            });
        } catch (error) {
            console.error('TTS Error:', error);
            message.reply('❌ Synthesis error: Message might be too long.');
        }
    }
};
