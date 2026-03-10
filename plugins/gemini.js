module.exports = {
    name: 'gemini',
    aliases: ['ai', 'ask'],
    description: 'Direct AI uplink for analysis and queries.',
    category: 'AI',
    run: async (client, message, args, database) => {
        const image = message.attachments.first() || 
                      (message.reference ? (await message.fetchReference()).attachments.first() : null);
        
        const query = args.join(" ") || "Analyze the current data stream.";
        const thinking = await message.reply("🛰️ **Establishing Gemini Uplink... analyzing stream.**");

        try {
            // Using the model instance already initialized in index.js
            const model = client.model;
            let result;

            if (image) {
                const imageResp = await fetch(image.url);
                const buffer = await imageResp.arrayBuffer();
                
                result = await model.generateContent([
                    query,
                    {
                        inlineData: {
                            data: Buffer.from(buffer).toString("base64"),
                            mimeType: image.contentType
                        }
                    }
                ]);
            } else {
                result = await model.generateContent(query);
            }

            const response = await result.response;
            const text = response.text();

            // Handle Discord's 2000 character limit
            if (text.length > 1900) {
                const chunks = text.match(/[\s\S]{1,1900}/g);
                await thinking.edit(`✅ **Uplink Success:**\n\n${chunks[0]}`);
                for (let i = 1; i < chunks.length; i++) {
                    await message.channel.send(chunks[i]);
                }
            } else {
                await thinking.edit(`✅ **Uplink Success:**\n\n${text}`);
            }

        } catch (error) {
            console.error("Gemini Error:", error);
            await thinking.edit("⚠️ **Uplink Failure:** Signal timeout or core overload. Retry transmission.");
        }
    }
};
