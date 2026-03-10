const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'setgame',
    aliases: ['updategame', 'sg'],
    category: 'GAMING',
    description: 'Sets your primary game and rank for your profile.',
    run: async (client, message, args, database) => {
        const input = args.join(" ").split("|");
        const gameName = input[0]?.trim();
        const rankName = input[1]?.trim() || "Pro";

        if (!gameName) {
            return message.reply(`❌ **Usage:** \`.setgame [Game] | [Rank]\` \n*Example: .setgame CODM | Legendary*`);
        }

        // Initialize user in database if they don't exist
        if (!database[message.author.id]) {
            database[message.author.id] = { 
                xp: 0, 
                level: 1, 
                name: message.author.username, 
                gaming: { game: "N/A", rank: "Unranked" } 
            };
        }
        
        // Update gaming sub-object
        database[message.author.id].gaming = {
            game: gameName.toUpperCase(),
            rank: rankName,
            lastUpdate: new Date().toLocaleDateString()
        };

        const updateEmbed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle('🎮 DATA SYNCHRONIZED')
            .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
            .setDescription(`**Primary Sector:** \`${gameName.toUpperCase()}\`\n**Combat Rank:** \`${rankName}\``)
            .setFooter({ text: 'Eagle Community | Database Updated 🇲🇱' });

        message.reply({ embeds: [updateEmbed] });
    }
};
