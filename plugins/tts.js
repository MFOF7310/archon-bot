const googleTTS = require('google-tts-api');

module.exports = {
    name: 'tts',
    description: 'Smart Bilingual TTS (Auto-switches between French and English)',
    async execute(message, args) {
        let textToConvert = args.join(' ');
        const repliedMessage = message.reference ? await message.channel.messages.fetch(message.reference.messageId) : null;

        if (!textToConvert && repliedMessage) textToConvert = repliedMessage.content;
        if (!textToConvert) return message.reply('❌ Reply to a message or type text!');

        // 🧠 Simple Bilingual Detection Logic
        const frenchIndicators = [' le ', ' la ', ' est ', ' vous ', ' les ', ' une ', ' pour '];
        const isFrench = frenchIndicators.some(word => textToConvert.toLowerCase().includes(word)) || /[éàèôû]/.test(textToConvert);
        
        const selectedLang = isFrench ? 'fr-FR' : 'en-US';

        try {
            const url = googleTTS.getAudioUrl(textToConvert, {
                lang: selectedLang,
                slow: false,
                host: 'https://translate.google.com',
            });

            return message.reply({
                files: [{
                    attachment: url,
                    name: `CG223_${isFrench ? 'French' : 'English'}_Voice.mp3`
                }]
            });
        } catch (error) {
            console.error('TTS Error:', error);
            message.reply('❌ Synthesis error.');
        }
    }
};
