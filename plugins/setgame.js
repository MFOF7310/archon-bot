const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'setgame',
    description: 'Sets your favorite game on your profile',
    async execute(message, args) {
        if (!args.length) {
            return message.reply('❌ Please specify a game! Example: `,setgame Free Fire`');
        }

        const gameName = args.join(' ');

        // Note: In a real bot, you would save this to a database (JSON, MongoDB, etc.)
        // For now, we will simulate the success response.
        
        const embed = new EmbedBuilder()
            .setColor('#00ffcc')
            .setTitle('🎮 Profile Updated')
            .setDescription(`Your **Main Game** has been set to: **${gameName}**`)
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },
};
