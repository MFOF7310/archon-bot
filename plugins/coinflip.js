const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
    name: 'coinflip',
    aliases: ['coin', 'flip'],
    description: '🪙 Flip a coin',
    category: 'Fun',
    cooldown: 1,
    
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flip a coin'),
    
    run: async (client, message) => {
        const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
        const emoji = result === 'Heads' ? '🪙' : '💿';
        
        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle(`${emoji} Coin Flip`)
            .setDescription(`It's **${result}**!`)
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
    },
    
    execute: async (interaction) => {
        const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
        const emoji = result === 'Heads' ? '🪙' : '💿';
        
        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle(`${emoji} Coin Flip`)
            .setDescription(`It's **${result}**!`)
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }
};