const axios = require("axios"); // Ensure npm install axios@latest
const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = {
    name: 'vision',
    description: 'Analyze images using Gemini 2.0 AI',
    category: 'AI',
    async execute(message, args, client) {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        let image = message.attachments.first();
        if (!image && message.reference) {
            const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
            image = repliedMsg.attachments.first();
        }

        if (!image || !image.contentType?.startsWith('image/')) {
            return message.reply("❌ Please attach an image or reply to one!");
        }

        const prompt = args.join(" ") || "Describe this image in detail.";
        const thinking = await message.reply("👁️ **Analyzing image...**");

        try {
            // Secure way to fetch image data
            const response = await axios.get(image.url, { responseType: 'arraybuffer', timeout: 10000 });
            const imageData = Buffer.from(response.data).toString('base64');

            const result = await model.generateContent([
                prompt,
                { inlineData: { data: imageData, mimeType: image.contentType } }
            ]);

            const responseText = result.response.text();
            return thinking.edit(responseText.substring(0, 2000));
        } catch (error) {
            console.error("Vision Error:", error);
            return thinking.edit(`❌ **Vision Failure:** ${error.message.includes('403') ? 'API Key issue' : 'Connection timeout'}`);
        }
    }
};
