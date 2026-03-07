const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'news',
    description: 'Fetch the latest gaming intelligence briefing.',
    category: 'Gaming',
    async execute(message, args, client, model) {
        const game = args.join(' ') || 'General Gaming';
        
        try {
            await message.channel.sendTyping();

            // We ask Gemini to act as a News Anchor for your server
            const prompt = `You are the CLOUD_GAMING-223 News Intelligence Bot. 
            Provide a brief, high-energy news update about "${game}". 
            Include:
            1. One major recent update or trending topic.
            2. A "Pro Tip" for players.
            3. A hype sentence for the community in Mali.
            Keep it under 150 words and use emojis.`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const newsText = response.text();

            const newsEmbed = new EmbedBuilder()
                .setColor('#e74c3c') // Tactical Red
                .setTitle(`📡 INTEL: ${game.toUpperCase()}`)
                .setAuthor({ name: 'CLOUD_GAMING-223 NEWS FEED', iconURL: client.user.displayAvatarURL() })
                .setDescription(newsText)
                .setThumbnail('https://i.imgur.com/v8S7z87.png') // Trophy or News icon
                .setFooter({ text: 'Data retrieved via Digital Engine AI' })
                .setTimestamp();

            await message.reply({ embeds: [newsEmbed] });

        } catch (err) {
            console.error(err);
            message.reply("⚠️ **Signal Lost:** Could not reach the news frequency.");
        }
    }
};
