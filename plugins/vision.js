const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'vision',
    description: 'Analyze an image using Gemini 2.0 Flash',
    async execute(message, args, client) {
        // 1. Check if there is an image
        const image = message.attachments.first() || (message.reference ? (await message.fetchReference()).attachments.first() : null);
        
        if (!image) return message.reply("❌ **Please upload or reply to an image!**");

        // 2. Send a "Thinking" message to prevent Discord timeout
        const thinking = await message.reply("🛰️ **Architect is analyzing the image... please wait.**");

        try {
            // 3. Call Gemini with an EXTENDED timeout (30 seconds)
            const model = client.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            
            // We add [requestOptions] here to tell the API to wait longer
            const result = await model.generateContent([
                args.join(" ") || "What is in this image?",
                {
                    inlineData: {
                        data: Buffer.from(await (await fetch(image.url)).arrayBuffer()).toString("base64"),
                        mimeType: image.contentType
                    }
                }
            ], { timeout: 30000 }); // 30,000ms = 30 seconds

            const response = await result.response;
            const text = response.text();

            // 4. Edit the thinking message with the result
            await thinking.edit(`✅ **Analysis Complete:**\n\n${text}`);

        } catch (error) {
            console.error(error);
            await thinking.edit("⚠️ **Vision Failure:** The connection timed out. This can happen on satellite links. Please try a smaller image or try again in a moment.");
        }
    }
};
