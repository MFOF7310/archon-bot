const axios = require('axios');

module.exports = {
    name: 'analyze',
    aliases: ['scanbuild', 'vision-loadout'],
    description: 'Analyse un screenshot de Gunsmith CODM via l\'IA.',
    run: async (client, message, args, database) => {
        const image = message.attachments.first() || 
                     (message.reference ? (await message.channel.messages.fetch(message.reference.messageId)).attachments.first() : null);
        
        if (!image) return message.reply("📸 **Erreur :** Téléchargez ou répondez à un screenshot de Gunsmith !");

        const thinking = await message.reply("🛰️ **Architect analyse les composants matériels...**");

        try {
            // Téléchargement de l'image via Axios
            const response = await axios.get(image.url, { responseType: 'arraybuffer' });
            const base64Image = Buffer.from(response.data, 'binary').toString('base64');

            const prompt = "Analyse cette image de Call of Duty Mobile. Identifie l'arme et liste précisément les 5 accessoires installés. Si tu vois des statistiques, mentionne-les brièvement.";

            const result = await client.model.generateContent([
                { text: prompt },
                {
                    inlineData: {
                        data: base64Image,
                        mimeType: image.contentType
                    }
                }
            ]);

            const aiResponse = await result.response;
            await thinking.edit(`✅ **ANALYSE TERMINÉE :**\n\n${aiResponse.text()}`);

        } catch (error) {
            console.error("Vision Error:", error);
            await thinking.edit("⚠️ **Échec du scan :** Impossible de lire les données visuelles.");
        }
    }
};
