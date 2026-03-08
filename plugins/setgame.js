const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'setgame',
    aliases: ['updategame'],
    async execute(message, args, client, model, lydiaChannels, database) {
        // Usage: ,setgame GameName | Rank
        const input = args.join(" ").split("|");
        const gameName = input[0]?.trim();
        const rankName = input[1]?.trim() || "Pro";

        if (!gameName) {
            return message.reply("❌ **Usage:** `,setgame [Game] | [Rank]`\n*Example: ,setgame CODM | Legendary*");
        }

        // Update the specific gaming object in your DB
        database[message.author.id].gaming.game = gameName;
        database[message.author.id].gaming.rank = rankName;

        const updateEmbed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle('🎮 GAME PROFILE SYNCHRONIZED')
            .setDescription(`**Game:** ${gameName}\n**Rank:** ${rankName}`)
            .setFooter({ text: 'Data saved to Bamako Node 🇲🇱' });

        message.reply({ embeds: [updateEmbed] });
    }
};
