const axios = require('axios');

module.exports = {
    name: 'tts',
    description: 'Convert text or a replied message to a voice note',
    async execute(message, args) {
        let lang = 'en'; // Default language
        let textToSpeak = '';

        // 1. Language Mapping (Supports your requested languages)
        const langMap = {
            'fr': 'fr', 'french': 'fr',
            'en': 'en', 'english': 'en',
            'cn': 'zh-CN', 'chinese': 'zh-CN',
            'ar': 'ar', 'arabic': 'ar',
            'ru': 'ru', 'russian': 'ru'
        };

        // 2. Logic to grab text (Reply vs. Direct)
        if (message.reference) {
            const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
            textToSpeak = repliedMessage.content;
            // First argument is the language if provided, else default to 'en'
            lang = langMap[args[0]?.toLowerCase()] || 'en';
        } else {
            // Direct command: ,tts fr Hello
            lang = langMap[args[0]?.toLowerCase()] || 'en';
            textToSpeak = langMap[args[0]?.toLowerCase()] ? args.slice(1).join(" ") : args.join(" ");
        }

        if (!textToSpeak) return message.reply("❌ Give me text or reply to a message! Example: `,tts fr Bonjour` or reply with `,tts ar`.");

        // 3. Generate Google TTS URL
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(textToSpeak)}&tl=${lang}&client=tw-ob`;

        try {
            return message.reply({
                content: `🔊 **Language:** \`${lang}\`\n> ${textToSpeak.substring(0, 500)}`,
                files: [{ attachment: url, name: 'voice_note.mp3' }]
            });
        } catch (error) {
            return message.reply("❌ Failed to generate audio.");
        }
    }
};
