const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const axios = require('axios');

const JOKE_API_URL = 'https://icanhazdadjoke.com/';
const FETCH_TIMEOUT = 5000;

module.exports = {
    name: 'dadjoke',
    aliases: ['joke', 'dad'],
    description: '😂 Get a random dad joke',
    category: 'Fun',
    cooldown: 2,
    
    data: new SlashCommandBuilder()
        .setName('dadjoke')
        .setDescription('Get a random dad joke'),
    
    run: async (client, message) => {
        try {
            const embed = await createJokeEmbed();
            await message.reply({ embeds: [embed] });
        } catch (err) {
            console.error('Dad joke prefix command error:', err.message);
            await message.reply('❌ Could not fetch a joke. Try again later!');
        }
    },
    
    execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
            const embed = await createJokeEmbed();
            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('Dad joke slash command error:', err.message);
            await interaction.editReply('❌ Could not fetch a joke. Try again later!');
        }
    }
};

async function createJokeEmbed() {
    const response = await axios.get(JOKE_API_URL, {
        timeout: FETCH_TIMEOUT,
        headers: { 'Accept': 'application/json' }
    });
    
    const joke = response.data?.joke;
    
    if (!joke) throw new Error('No joke in response');
    
    return new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('😂 Dad Joke')
        .setDescription(joke)
        .setFooter({ text: 'Powered by icanhazdadjoke' })
        .setTimestamp();
}