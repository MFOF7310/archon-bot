const axios = require("axios");

module.exports = {
    name: 'vision',
    description: 'Analyze images using Gemini 2.0',
    async execute(message, args, client, model) {
        // 1. Find the image (either in this message or the one being replied to)
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
            // 2. Convert image to the format Gemini needs
            const response = await axios.get(image.url, { responseType: 'arraybuffer' });
            const imageData = Buffer.from(response.data).toString('base64');

            // 3. Generate content using the passed-in model (Gemini-2.0-flash)
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
