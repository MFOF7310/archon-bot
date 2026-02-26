const googleTTS = require('google-tts-api');

module.exports = {
    name: 'tts',
    description: 'Convert text to a voice note',
    async execute(message, args) {
        const text = args.join(' ');
        if (!text) return message.reply('❌ Please provide text to convert! (Usage: `,tts Hello Bamako`)');

        if (text.length > 200) return message.reply('❌ Text is too long! Keep it under 200 characters.');

        try {
            // Generate the URL for the audio
            const url = googleTTS.getAudioUrl(text, {
                lang: 'fr', // Change to 'en' for English if preferred
                slow: false,
                host: 'https://translate.google.com',
            });

            // Send the audio as a "Voice Note" style attachment
            return message.reply({
                files: [{
                    attachment: url,
                    name: 'cloudgaming223_voice.mp3'
                }]
            });
        } catch (error) {
            console.error('TTS Error:', error);
            message.reply('❌ System error during voice synthesis.');
        }
    }
};
