const axios = require('axios');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'weather',
    description: 'Get current weather for any city.',
    async execute(message, args) {
        // Use Bamako as default if no city is typed
        const city = args.join(' ') || 'Bamako';
        const apiKey = process.env.WEATHER_API_KEY;

        if (!apiKey) {
            return message.reply("⚠️ Weather API key is missing. Add it to your .env file!");
        }

        try {
            const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${apiKey}`;
            const response = await axios.get(url);
            const data = response.data;

            const weatherEmbed = new EmbedBuilder()
                .setColor('#00d2ff')
                .setTitle(`🌤️ Current Weather: ${data.name}, ${data.sys.country}`)
                .setThumbnail(`http://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`)
                .addFields(
                    { name: '🌡️ Temperature', value: `${Math.round(data.main.temp)}°C`, inline: true },
                    { name: '🤔 Feels Like', value: `${Math.round(data.main.feels_like)}°C`, inline: true },
                    { name: '☁️ Condition', value: data.weather[0].description, inline: true },
                    { name: '💧 Humidity', value: `${data.main.humidity}%`, inline: true },
                    { name: '💨 Wind Speed', value: `${data.wind.speed} m/s`, inline: true }
                )
                .setFooter({ text: 'Cloud Gaming-223 | Real-time Data' })
                .setTimestamp();

            message.channel.send({ embeds: [weatherEmbed] });

        } catch (error) {
            console.error("Weather Error:", error.message);
            message.reply(`❌ I couldn't find the weather for "**${city}**". Please check the spelling.`);
        }
    },
};
