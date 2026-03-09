const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'news',
    description: 'Fetch the latest gaming intelligence briefing.',
    category: 'Gaming',
    run: async (client, message, args, database) => {
        // Access the model via the client setup or re-initialize if needed
        // For your setup, we can call the model globally if defined in index.js
        const game = args.join(' ') || 'General Gaming';
        
        try {
            await message.channel.sendTyping();

            const prompt = `You are the CLOUD_GAMING-223 News Intelligence Bot. 
            Provide a brief, high-energy news update about "${game}". 
            Include:
            1. One major recent update or trending topic.
            2. A "Pro Tip" for players.
            3. A hype sentence for the community in Mali.
            Keep it under 150 words and use emojis.`;

            // Note: This assumes 'model' is accessible. In our new index.js, 
            // you might need to re-import or pass it. 
            // For now, let's keep the logic surgical.
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const newsText = response.text();

            const newsEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle(`📡 INTEL: ${game.toUpperCase()}`)
                .setAuthor({ name: 'CLOUD_GAMING-223 NEWS FEED', iconURL: client.user.displayAvatarURL() })
                .setDescription(newsText)
                .setFooter({ text: 'Data retrieved via Digital Engine AI' })
                .setTimestamp();

            await message.reply({ embeds: [newsEmbed] });
        } catch (err) {
            message.reply("⚠️ **Signal Lost:** Could not reach the news frequency.");
        }
    }
};
