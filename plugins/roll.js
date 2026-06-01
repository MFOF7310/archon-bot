const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
    name: 'roll',
    aliases: ['dice'],
    description: '🎲 Roll dice (NdN format: 2d6, 1d20)',
    category: 'Fun',
    cooldown: 1,
    
    data: new SlashCommandBuilder()
        .setName('roll')
        .setDescription('Roll dice')
        .addStringOption(option =>
            option.setName('dice')
                .setDescription('Dice in NdN format (default: 1d6)')
                .setRequired(false)),
    
    run: async (client, message, args) => {
        const diceStr = args[0] || '1d6';
        const result = rollDice(diceStr);
        
        if (!result) {
            return message.reply('❌ Invalid format! Use NdN (e.g., `2d6`, `1d20`)');
        }
        
        const embed = new EmbedBuilder()
            .setColor(0xFF4444)
            .setTitle('🎲 Dice Roll')
            .setDescription(`**${diceStr}** → **${result}**`)
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
    },
    
    execute: async (interaction) => {
        const diceStr = interaction.options.getString('dice') || '1d6';
        const result = rollDice(diceStr);
        
        if (!result) {
            return interaction.reply({ 
                content: '❌ Invalid format! Use NdN (e.g., `2d6`, `1d20`)', 
                ephemeral: true 
            });
        }
        
        const embed = new EmbedBuilder()
            .setColor(0xFF4444)
            .setTitle('🎲 Dice Roll')
            .setDescription(`**${diceStr}** → **${result}**`)
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }
};

function rollDice(str) {
    const match = str.match(/^(\d+)d(\d+)$/i);
    if (!match) return null;
    
    const count = parseInt(match[1]);
    const sides = parseInt(match[2]);
    
    if (count < 1 || count > 100 || sides < 2 || sides > 1000) return null;
    
    let total = 0;
    const rolls = [];
    
    for (let i = 0; i < count; i++) {
        const roll = Math.floor(Math.random() * sides) + 1;
        rolls.push(roll);
        total += roll;
    }
    
    return count > 1 ? `${total} [${rolls.join(', ')}]` : total;
}