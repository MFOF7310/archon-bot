const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const axios = require('axios');

const FACT_API_URL = 'https://uselessfacts.jsph.pl/api/v2/facts/random?language=en';
const FETCH_TIMEOUT = 5000;

module.exports = {
    name: 'fact',
    aliases: ['facts', 'randomfact'],
    description: '💡 Get a random fun fact',
    category: 'Fun',
    cooldown: 2,
    
    data: new SlashCommandBuilder()
        .setName('fact')
        .setDescription('Get a random fun fact'),
    
    run: async (client, message) => {
        try {
            const embed = await createFactEmbed();
            await message.reply({ embeds: [embed] });
        } catch (err) {
            console.error('Fact prefix command error:', err.message);
            await message.reply('❌ Could not fetch a fact. Try again later!');
        }
    },
    
    execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
            const embed = await createFactEmbed();
            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('Fact slash command error:', err.message);
            await interaction.editReply('❌ Could not fetch a fact. Try again later!');
        }
    }
};

async function createFactEmbed() {
    const response = await axios.get(FACT_API_URL, { timeout: FETCH_TIMEOUT });
    const fact = response.data?.text;
    
    if (!fact) throw new Error('No fact in response');
    
    return new EmbedBuilder()
        .setColor(0x00CED1)
        .setTitle('💡 Random Fact')
        .setDescription(fact)
        .setFooter({ text: 'Powered by Useless Facts API' })
        .setTimestamp();
}