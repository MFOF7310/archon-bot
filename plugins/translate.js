const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = {
    name: 'trt',
    description: 'Translate text to any language',
    async execute(message, args) {
        const lang = args[0];
        const text = args.slice(1).join(" ");

        if (!lang || !text) {
            return message.reply("❌ **Usage:** `,trt [lang] [text]`\nExample: `,trt zh Hello` for Chinese.");
        }

        const thinking = await message.reply("🔄 **Translating...**");

        try {
            // Self-contained AI initialization
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

            const prompt = `Translate the following text into ${lang}. Only provide the translated text, no extra commentary: "${text}"`;
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const translatedText = response.text();

            return thinking.edit(`🌍 **Translation (${lang}):**\n${translatedText}`);
        } catch (error) {
            console.error(error);
            return thinking.edit("❌ **Error:** Failed to translate. Check your API key.");
        }
    },
};
