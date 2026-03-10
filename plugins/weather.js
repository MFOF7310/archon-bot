const axios = require('axios');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'weather',
    category: 'UTILITY',
    run: async (client, message, args, database) => {
        const city = args.join(' ') || 'Bamako';
        const apiKey = process.env.WEATHER_API_KEY;

        try {
            const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${apiKey}`);
            const data = response.data;
            const temp = Math.round(data.main.temp);

            let suggestion = temp > 35 ? "🥵 Extreme heat: Stay hydrated in Bamako!" : "🌤️ Weather looks clear.";

            const embed = new EmbedBuilder()
                .setColor('#f1c40f')
                .setTitle(`🌍 WEATHER: ${data.name}, ${data.sys.country}`)
                .setThumbnail(`https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`)
                .addFields(
                    { name: '🌡️ Temp', value: `${temp}°C`, inline: true },
                    { name: '💧 Humidity', value: `${data.main.humidity}%`, inline: true },
                    { name: '💡 Tip', value: `*${suggestion}*` }
                )
                .setFooter({ text: `Satellite Node: Bamako-223` });

            message.reply({ embeds: [embed] });
        } catch (err) {
            message.reply("❌ **Location not found.**");
        }
    }
};
