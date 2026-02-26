const axios = require('axios');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'weather',
    description: 'Get real-time weather updates',
    async execute(message, args) {
        // Default to Bamako if no city is provided
        const city = args.join(' ') || 'Bamako';
        const apiKey = process.env.WEATHER_API_KEY;

        if (!apiKey) {
            return message.reply('❌ Weather API Key is missing in .env!');
        }

        try {
            const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${apiKey}`;
            const response = await axios.get(url);
            const data = response.data;

            const weatherEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle(`🌤️ Weather in ${data.name}, ${data.sys.country}`)
                .setThumbnail(`http://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`)
                .addFields(
                    { name: '🌡️ Temperature', value: `\`${data.main.temp}°C\``, inline: true },
                    { name: '☁️ Condition', value: `\`${data.weather[0].description}\``, inline: true },
                    { name: '💧 Humidity', value: `\`${data.main.humidity}%\``, inline: true },
                    { name: '💨 Wind Speed', value: `\`${data.wind.speed} m/s\``, inline: true }
                )
                .setFooter({ text: 'CLOUD GAMING 223 | AES Framework' })
                .setTimestamp();

            return message.reply({ embeds: [weatherEmbed] });

        } catch (error) {
            if (error.response && error.response.status === 404) {
                return message.reply(`❌ City **${city}** not found.`);
            }
            console.error('Weather Error:', error);
            return message.reply('❌ System error fetching weather data.');
        }
    }
};
