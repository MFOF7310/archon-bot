const axios = require('axios');

module.exports = {
    name: 'trt',
    description: 'Translate text or a replied message',
    async execute(message, args) {
        let targetLang = args[0]?.toLowerCase() || 'fr'; // Defaults to French
        let textToTranslate = args.slice(1).join(" ");

        // 1. Check if the user is replying to a message
        if (message.reference) {
            const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
            textToTranslate = repliedMessage.content;
            // If the user only typed ",trt", use the first arg as the lang
            targetLang = args[0]?.toLowerCase() || 'fr';
        }

        if (!textToTranslate) {
            return message.reply("❌ Provide text or reply to a message! Example: `,trt en Bonjour` or just reply with `,trt en`.");
        }

        const thinking = await message.reply("🌐 **Translating...**");

        try {
            // Google Translate API with Auto-Detection
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURI(textToTranslate)}`;
            const response = await axios.get(url);
            
            const translatedText = response.data[0][0][0];
            const detectedLang = response.data[2]; // Google returns detected source lang here

            return thinking.edit(`🌍 **From (${detectedLang}) to (${targetLang}):**\n> ${translatedText}`);
        } catch (error) {
            return thinking.edit("❌ Translation failed. Check if the language code (fr, en, cn, ar, ru) is correct.");
        }
    }
};
