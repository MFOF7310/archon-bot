const axios = require('axios');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'weather',
    run: async (client, message, args, database) => {
        const city = args.join(' ') || 'Bamako';
        const apiKey = process.env.WEATHER_API_KEY;
        if (!apiKey) return message.reply("⚠️ API Key Missing.");

        try {
            const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${apiKey}`);
            const data = response.data;
            const embed = new EmbedBuilder()
                .setColor('#00d2ff')
                .setTitle(`🌤️ ${data.name}, ${data.sys.country}`)
                .addFields({ name: '🌡️ Temp', value: `${Math.round(data.main.temp)}°C`, inline: true }, { name: '💧 Humidity', value: `${data.main.humidity}%`, inline: true });
            message.reply({ embeds: [embed] });
        } catch (err) { message.reply("❌ City not found."); }
    }
};
