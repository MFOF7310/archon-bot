const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'news',
    description: 'Latest gaming intelligence briefing.',
    category: 'GAMING',
    run: async (client, message, args, database) => {
        const game = args.join(' ') || 'Gaming Meta';
        
        try {
            await message.channel.sendTyping();

            const prompt = `You are the ARCHITECT CG-223 News Intelligence Bot. 
            Provide a brief, high-energy news update about "${game}". 
            1. One major update. 2. A "Pro Tip". 3. A hype sentence for Mali gamers. 
            Style: Professional/Elite. Emojis included.`;

            const result = await client.model.generateContent(prompt);
            const newsText = result.response.text();

            const newsEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle(`📡 INTEL: ${game.toUpperCase()}`)
                .setAuthor({ name: 'CLOUD_GAMING-223 NEWS FEED', iconURL: client.user.displayAvatarURL() })
                .setDescription(newsText)
                .setFooter({ text: 'Data retrieved via Architect AI' })
                .setTimestamp();

            await message.reply({ embeds: [newsEmbed] });
        } catch (err) {
            message.reply("⚠️ **Signal Lost:** Could not reach the news frequency.");
        }
    }
};
