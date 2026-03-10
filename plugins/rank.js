const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'rank',
    category: 'GAMING',
    run: async (client, message, args, database) => {
        const target = message.mentions.users.first() || message.author;
        const data = database[target.id] || { xp: 0, level: 1 };
        
        const nextLevelXP = 1000;
        const currentXP = data.xp % nextLevelXP;

        message.reply(`📊 **RANK:** ${target.username} is **Level ${data.level}** (${currentXP}/${nextLevelXP} XP)`);
    }
};
