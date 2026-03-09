const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'setgame',
    aliases: ['updategame'],
    description: 'Sets your primary game and rank for your profile.',
    run: async (client, message, args, database) => {
        const input = args.join(" ").split("|");
        const gameName = input[0]?.trim();
        const rankName = input[1]?.trim() || "Pro";

        if (!gameName) {
            const prefix = process.env.PREFIX || ",";
            return message.reply(`❌ **Usage:** \`${prefix}setgame [Game] | [Rank]\`\n*Example: ${prefix}setgame CODM | Legendary*`);
        }

        if (!database[message.author.id]) {
            database[message.author.id] = { xp: 0, level: 1, name: message.author.username, gaming: {} };
        }
        
        database[message.author.id].gaming = {
            game: gameName,
            rank: rankName,
            stats: database[message.author.id].gaming?.stats || "N/A"
        };

        const updateEmbed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle('🎮 GAME PROFILE SYNCHRONIZED')
            .setDescription(`**Game:** ${gameName}\n**Rank:** ${rankName}`)
            .setFooter({ text: 'Data saved to Bamako Node 🇲🇱' });

        message.reply({ embeds: [updateEmbed] });
    }
};
