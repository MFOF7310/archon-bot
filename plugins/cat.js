const { EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
    name: 'cat',
    aliases: ['chat', 'kitty', 'meow'],
    description: '🐱 Get a random cat picture.',
    category: 'FUN',
    run: async (client, message) => {
        try {
            const res = await axios.get('https://api.thecatapi.com/v1/images/search');
            const cat = res.data[0];
            
            const embed = new EmbedBuilder()
                .setColor('#f1c40f')
                .setTitle('🐱 Random Cat')
                .setImage(cat.url)
                .setFooter({ text: 'Powered by TheCatAPI' })
                .setTimestamp();
            
            await message.reply({ embeds: [embed] });
        } catch (err) {
            message.reply('❌ Could not fetch a cat picture.');
        }
    }
};