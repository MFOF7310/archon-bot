const axios = require('axios'); // Make sure axios is installed

module.exports = {
    name: 'gemini',
    aliases: ['ai', 'ask', 'vision'],
    description: 'Analyze images and answer questions using Gemini AI.',
    category: 'AI',
    run: async (client, message, args, database) => {
        
        // Get image from message or reply
        const image = message.attachments.first() || 
                      (message.reference ? (await message.fetchReference()).attachments.first() : null);
        
        // Get query text
        const query = args.join(" ").trim() || (image ? "What's in this image?" : "Hello, how can you help me?");
        
        // Send thinking message
        const thinking = await message.reply("🛰️ **Establishing Gemini Uplink... analyzing stream.**");

        try {
            // Get the Gemini model from client
            const model = client.model;
            
            if (!model) {
                throw new Error("Gemini model not initialized. Check your GEMINI_API_KEY in .env");
            }

            let result;

            // CASE 1: Image provided
            if (image) {
                // Check if image is actually an image
                const isImage = image.contentType?.startsWith('image/');
                if (!isImage) {
                    return thinking.edit("❌ **Invalid Format:** Please provide an image file (JPEG, PNG, GIF, etc.)");
                }

                // Download image
                const imageResp = await axios.get(image.url, { 
                    responseType: 'arraybuffer',
                    timeout: 10000 // 10 second timeout
                });
                
                const buffer = Buffer.from(imageResp.data, 'binary');
                
                // Create content parts for Gemini
                const parts = [
                    { text: query },
                    {
                        inlineData: {
                            data: buffer.toString('base64'),
                            mimeType: image.contentType || 'image/jpeg'
                        }
                    }
                ];

                // Generate content with image
                result = await model.generateContent({
                    contents: [{ role: 'user', parts }]
                });

            // CASE 2: Text only
            } else {
                result = await model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: query }] }]
                });
            }

            // Get response
            const response = await result.response;
            const text = response.text();

            if (!text) {
                throw new Error("Empty response from Gemini");
            }

            // Handle Discord's 2000 character limit
            if (text.length > 1900) {
                const chunks = text.match(/[\s\S]{1,1900}/g) || [];
                
                // Edit first message
                await thinking.edit(`✅ **Uplink Success:**\n\n${chunks[0]}`);
                
                // Send remaining chunks
                for (let i = 1; i < chunks.length; i++) {
                    await message.channel.send(chunks[i]);
                }
            } else {
                await thinking.edit(`✅ **Uplink Success:**\n\n${text}`);
            }

        } catch (error) {
            console.error("🚫 Gemini Error:", error);
            
            // Friendly error messages based on error type
            let errorMsg = "⚠️ **Uplink Failure:** ";
            
            if (error.message.includes('API key')) {
                errorMsg += "Invalid Gemini API key. Check your .env file.";
            } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                errorMsg += "Connection timeout. Try again.";
            } else if (error.message.includes('quota') || error.message.includes('rate')) {
                errorMsg += "Rate limit reached. Wait a moment.";
            } else if (error.message.includes('Empty response')) {
                errorMsg += "Gemini returned an empty response. Try a different question.";
            } else {
                errorMsg += "Signal timeout or core overload. Retry transmission.";
            }
            
            await thinking.edit(errorMsg);
        }
    }
};