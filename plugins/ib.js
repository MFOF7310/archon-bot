const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'lb',
    description: 'Display the Top 10 Gamers in the engine.',
    category: 'Gaming',
    async execute(message, client) {
        const lbEmbed = new EmbedBuilder()
            .setColor('#e67e22')
            .setTitle('🏆 CLOUD GAMING-223 | TOP 10 GAMERS')
            .setDescription('The most active players in the AES Digital Node.')
            .addFields(
                { name: '1. 🥇 Fof_Architect', value: 'Level 50 | *CODM*', inline: false },
                { name: '2. 🥈 Ghost_Mali', value: 'Level 42 | *Free Fire*', inline: false },
                { name: '3. 🥉 Bamako_King', value: 'Level 38 | *PUBG*', inline: false },
                { name: '4. Elite_Gamer', value: 'Level 30 | *CODM*', inline: false }
            )
            .setFooter({ text: 'Keep playing to climb the ranks!' })
            .setTimestamp();

        message.reply({ embeds: [lbEmbed] });
    }
};
