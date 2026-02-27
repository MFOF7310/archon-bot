const axios = require('axios');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'weather',
    description: 'Get real-time weather updates',
    async execute(message, args) {
        // 1. Properly handle multi-word cities (like New York)
        const city = args.join(' ') || 'Bamako';
        const apiKey = process.env.WEATHER_API_KEY;

        if (!apiKey) {
            return message.reply('❌ Weather API Key is missing in .env!');
        }

        try {
            // Use encodeURIComponent to handle spaces/special characters in city names
            const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${apiKey}`;
            const response = await axios.get(url);
            const data = response.data;

            // Use https for the icon to ensure Discord displays it
            const iconUrl = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;

            const weatherEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle(`🌤️ Weather in ${data.name}, ${data.sys.country}`)
                .setThumbnail(iconUrl)
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
            // DETAILED DEBUGGING:
            if (error.response) {
                if (error.response.status === 401) {
                    return message.reply('❌ **API Key Error:** Your key is invalid or not yet activated (wait 2 hours if new).');
                }
                if (error.response.status === 404) {
                    return message.reply(`❌ City **${city}** not found. Check the spelling!`);
                }
            }
            console.error('Weather Error:', error);
            return message.reply('❌ System error fetching weather data.');
        }
    }
};
