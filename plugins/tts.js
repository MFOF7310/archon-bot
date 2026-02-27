const googleTTS = require('google-tts-api');

module.exports = {
    name: 'tts',
    description: 'Convert text to an English female voice note',
    async execute(message, args) {
        const text = args.join(' ');
        if (!text) return message.reply('❌ Please provide text! (Usage: `,tts Hello Bamako`)');

        // Keeping it short for fast processing on Starlink
        if (text.length > 200) return message.reply('❌ Text is too long! Keep it under 200 characters.');

        try {
            // Generate the URL for the Female English audio
            const url = googleTTS.getAudioUrl(text, {
                lang: 'en-US', // Switched from 'fr' to American English Female
                slow: false,
                host: 'https://translate.google.com',
            });

            // Send the audio as a high-quality .mp3 attachment
            return message.reply({
                files: [{
                    attachment: url,
                    name: 'CG223_Female_Voice.mp3'
                }]
            });
        } catch (error) {
            console.error('TTS Error:', error);
            message.reply('❌ System error during English voice synthesis.');
        }
    }
};

