module.exports = {
    name: 'gemini',
    description: 'Direct AI uplink for image analysis and queries.',
    category: 'AI',
    run: async (client, message, args, database) => {
        // 1. Check for Image (Attachment or Reply)
        const image = message.attachments.first() || 
                      (message.reference ? (await message.fetchReference()).attachments.first() : null);
        
        const query = args.join(" ") || "Analyze this data.";

        // 2. Initializing Uplink
        const thinking = await message.reply("🛰️ **Establishing Gemini Uplink... analyzing stream.**");

        try {
            // Using the model instance from your client
            const model = client.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            
            let result;

            if (image) {
                // Image + Text Analysis
                result = await model.generateContent([
                    query,
                    {
                        inlineData: {
                            data: Buffer.from(await (await fetch(image.url)).arrayBuffer()).toString("base64"),
                            mimeType: image.contentType
                        }
                    }
                ], { timeout: 30000 });
            } else {
                // Pure Text Query if no image is provided
                result = await model.generateContent(query);
            }

            const response = await result.response;
            const text = response.text();

            // 3. Return Intelligence
            await thinking.edit(`✅ **Uplink Success:**\n\n${text}`);

        } catch (error) {
            console.error("Gemini Error:", error);
            await thinking.edit("⚠️ **Uplink Failure:** The signal timed out or the AI core is occupied. Please retry.");
        }
    }
};
