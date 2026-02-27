const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = {
    name: 'vision',
    description: 'Analyze images using Gemini 2.0 AI',
    category: 'AI',
    async execute(message, args, client) {
        // 1. Initialize Gemini inside the plugin
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        // 2. Find the image
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
            // 3. Convert image to base64
            const response = await axios.get(image.url, { responseType: 'arraybuffer' });
            const imageData = Buffer.from(response.data).toString('base64');

            // 4. Generate content
            const result = await model.generateContent([
                prompt,
                {
                    inlineData: {
                        data: imageData,
                        mimeType: image.contentType
                    }
                }
            ]);

            const text = result.response.text();
            
            // Edit the "Thinking" message with the result
            return thinking.edit(text.substring(0, 2000));
        } catch (error) {
            console.error("Vision Error:", error);
            return thinking.edit(`❌ Vision Error: ${error.message}`);
        }
    }
};
