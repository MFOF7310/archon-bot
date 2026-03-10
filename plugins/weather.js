const axios = require('axios');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'weather',
    description: 'Get detailed, dynamic weather info for any city.',
    run: async (client, message, args, database) => {
        const city = args.join(' ') || 'Bamako';
        const apiKey = process.env.WEATHER_API_KEY;

        if (!apiKey) return message.reply("⚠️ **Error:** Weather API Key is missing from environment variables.");

        try {
            // Fetch current weather data
            const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${apiKey}`);
            const data = response.data;

            // 1. Weather Icon and Condition
            const weatherDesc = data.weather[0].description;
            const iconCode = data.weather[0].icon; 
            const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
            const mainWeather = data.weather[0].main;

            // 2. Dynamic Suggestion Logic
            let suggestion = "Have a great day!";
            const temp = data.main.temp;
            const weatherLower = mainWeather.toLowerCase();

            if (weatherLower.includes('rain')) {
                suggestion = "☔ Bring an umbrella! It's currently raining.";
            } else if (weatherLower.includes('snow')) {
                suggestion = "❄️ Wear heavy boots and a coat, it's snowing!";
            } else if (temp > 30) {
                suggestion = "🥵 It's scorching! Stay hydrated and wear light clothes.";
            } else if (temp < 10) {
                suggestion = "🧥 It's quite chilly, make sure to grab a jacket.";
            } else if (data.wind.speed > 12) {
                suggestion = "🌬️ It's very windy! Hold onto your hat.";
            } else if (weatherLower.includes('clear')) {
                suggestion = "☀️ Perfect weather for an outdoor walk!";
            }

            // 3. Dynamic Color Logic
            let embedColor = '#00d2ff'; // Default Blue
            const id = data.weather[0].id;
            if (id >= 200 && id < 300) embedColor = '#4b0082'; // Thunderstorm
            if (id >= 500 && id < 600) embedColor = '#1e90ff'; // Rain
            if (id >= 600 && id < 700) embedColor = '#ffffff'; // Snow
            if (id === 800) embedColor = iconCode.includes('d') ? '#f1c40f' : '#2c3e50'; // Day/Night Clear

            // 4. Time Calculation
            // Local time = Current UTC time + API timezone offset
            const localTime = new Date(Date.now() + (data.timezone * 1000)).toUTCString().slice(-12, -7);

            // 5. Build the Embed
            const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(`🌍 Weather in ${data.name}, ${data.sys.country}`)
                .setDescription(`Current condition: **${weatherDesc.charAt(0).toUpperCase() + weatherDesc.slice(1)}**`)
                .setThumbnail(iconUrl)
                .addFields(
                    { name: '🌡️ Temp', value: `${Math.round(temp)}°C`, inline: true },
                    { name: '🤔 Feels Like', value: `${Math.round(data.main.feels_like)}°C`, inline: true },
                    { name: '💧 Humidity', value: `${data.main.humidity}%`, inline: true },
                    { name: '🌬️ Wind', value: `${data.wind.speed} m/s`, inline: true },
                    { name: '🌅 Local Time', value: `${localTime}`, inline: true },
                    { name: '💡 Tip', value: `*${suggestion}*`, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: `Requested by ${message.author.username}`, iconURL: message.author.displayAvatarURL() });

            message.reply({ embeds: [embed] });

        } catch (err) {
            console.error(err);
            message.reply("❌ **City not found.** Please double-check the name or country code (e.g., `Paris, FR`).");
        }
    }
};
