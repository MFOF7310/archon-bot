const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");

// Initialize AI with your key from the .env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

module.exports = {
    name: 'vision',
    description: 'Ask Gemini to analyze an image',
    async execute(message, args) {
        // 1. Check if there is an image attached
        const image = message.attachments.first();
        if (!image || !image.contentType?.startsWith('image/')) {
            return message.reply("❌ Please attach an image to your message!");
        }

        const prompt = args.join(" ") || "What is in this image?";
        const thinking = await message.reply("👁️ **AI is looking at the image...**");

        try {
            // 2. Fetch the image and convert to Base64 (so Gemini can read it)
            const response = await axios.get(image.url, { responseType: 'arraybuffer' });
            const imageData = Buffer.from(response.data).toString('base64');

            // 3. Use gemini-1.5-flash (It is faster and better for images than 2.0-flash right now)
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
            return thinking.edit(text.substring(0, 2000));

        } catch (error) {
            console.error(error);
            return thinking.edit(`❌ Vision Error: ${error.message}`);
        }
    }
};
