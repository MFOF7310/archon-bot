const axios = require('axios');
const { EmbedBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        title: (city, country) => `🌤️ ${city}, ${country}`,
        temperature: '🌡️ Temperature',
        feelsLike: 'Feels like',
        atmosphere: '💧 Atmosphere',
        humidity: 'Humidity',
        pressure: 'Pressure',
        visibility: 'Visibility',
        wind: '🌬️ Wind',
        speed: 'Speed',
        direction: 'Direction',
        extraInfo: '📊 Extra Info',
        cloudiness: 'Cloudiness',
        sunrise: 'Sunrise',
        sunset: 'Sunset',
        smartSuggestion: '💡 Smart Suggestion',
        location: 'Location',
        timezone: 'Timezone',
        configError: '⚠️ **Configuration Error:** Weather API key not configured.',
        notFound: (city) => `❌ **Location not found:** "${city}" doesn't exist.`,
        apiError: '❌ **API Key Error:** Invalid weather API key.',
        fetchError: '❌ **Error:** Failed to fetch weather data.',
        weatherServiceError: '⚠️ Weather Service Error',
        checkCity: 'Please check city name or try again later',
        extremeHeat: '🥵 Extreme heat! Stay hydrated.',
        hotDay: '🌞 Hot day! Wear light clothing.',
        pleasant: '🌤️ Pleasant weather! Great for outdoors.',
        mild: '🍃 Mild conditions. Perfect for a walk.',
        cool: '🧥 Cool weather. Bring a jacket.',
        chilly: '❄️ Chilly! Wear warm clothing.',
        freezing: '🥶 Freezing! Bundle up.',
        umbrella: '☔ Don\'t forget your umbrella!',
        storm: '⚡ Storm warning! Stay indoors.',
        snow: '⛄ Drive carefully in snow.',
        highHumidity: '💦 High humidity! Feels warmer.',
        strongWinds: '💨 Strong winds! Secure loose items.',
        typing: '🔍 Fetching weather data...'
    },
    fr: {
        title: (city, country) => `🌤️ ${city}, ${country}`,
        temperature: '🌡️ Température',
        feelsLike: 'Ressenti',
        atmosphere: '💧 Atmosphère',
        humidity: 'Humidité',
        pressure: 'Pression',
        visibility: 'Visibilité',
        wind: '🌬️ Vent',
        speed: 'Vitesse',
        direction: 'Direction',
        extraInfo: '📊 Infos Supplémentaires',
        cloudiness: 'Nébulosité',
        sunrise: 'Lever',
        sunset: 'Coucher',
        smartSuggestion: '💡 Suggestion Intelligente',
        location: 'Localisation',
        timezone: 'Fuseau horaire',
        configError: '⚠️ **Erreur de Configuration:** Clé API météo non configurée.',
        notFound: (city) => `❌ **Localisation introuvable:** "${city}" n'existe pas.`,
        apiError: '❌ **Erreur Clé API:** Clé API météo invalide.',
        fetchError: '❌ **Erreur:** Impossible de récupérer les données météo.',
        weatherServiceError: '⚠️ Erreur Service Météo',
        checkCity: 'Vérifiez le nom de la ville ou réessayez plus tard',
        extremeHeat: '🥵 Chaleur extrême! Restez hydraté.',
        hotDay: '🌞 Journée chaude! Portez des vêtements légers.',
        pleasant: '🌤️ Temps agréable! Parfait pour sortir.',
        mild: '🍃 Conditions douces. Idéal pour une promenade.',
        cool: '🧥 Temps frais. Prenez une veste.',
        chilly: '❄️ Frais! Habillez-vous chaudement.',
        freezing: '🥶 Gel! Couvrez-vous bien.',
        umbrella: '☔ N\'oubliez pas votre parapluie!',
        storm: '⚡ Alerte orage! Restez à l\'intérieur.',
        snow: '⛄ Conduisez prudemment dans la neige.',
        highHumidity: '💦 Humidité élevée! Sensation plus chaude.',
        strongWinds: '💨 Vents forts! Attachez les objets.',
        typing: '🔍 Récupération des données météo...'
    }
};

// ================= HELPER FUNCTIONS =================
function getWindDirection(degrees) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
}

function getWeatherColor(condition, temp) {
    if (temp > 35) return 0xE67E22;
    if (temp < 0) return 0x5DADE2;
    if (temp < 10) return 0x5499C7;
    
    const colorMap = {
        'clear': 0xF1C40F,
        'clouds': 0x95A5A6,
        'rain': 0x3498DB,
        'drizzle': 0x5DADE2,
        'thunderstorm': 0x8E44AD,
        'snow': 0xBDC3C7,
    };
    return colorMap[condition] || 0x3498DB;
}

function getSmartSuggestion(condition, temp, humidity, windSpeed, lang) {
    const t = translations[lang];
    const suggestions = [];
    
    if (temp > 35) suggestions.push(t.extremeHeat);
    else if (temp > 30) suggestions.push(t.hotDay);
    else if (temp > 25) suggestions.push(t.pleasant);
    else if (temp > 15) suggestions.push(t.mild);
    else if (temp > 5) suggestions.push(t.cool);
    else if (temp > 0) suggestions.push(t.chilly);
    else suggestions.push(t.freezing);
    
    if (condition.includes('rain')) suggestions.push(t.umbrella);
    if (condition.includes('thunderstorm')) suggestions.push(t.storm);
    if (condition.includes('snow')) suggestions.push(t.snow);
    if (humidity > 80) suggestions.push(t.highHumidity);
    if (windSpeed > 40) suggestions.push(t.strongWinds);
    
    return suggestions.join(' ');
}

function capitalizeFirst(str) {
    return str.replace(/\b\w/g, char => char.toUpperCase());
}

// ================= MAIN COMMAND =================
module.exports = {
    name: 'weather',
    description: '🌤️ Get current weather for any city with detailed conditions.',
    category: 'UTILITY',
    usage: '.weather [city name]',
    examples: ['.weather Paris', '.weather New York', '.weather Tokyo', '.weather Bamako'],
    aliases: ['climate', 'forecast', 'temp', 'meteo', 'climat', 'temperature'],
    cooldown: 5000,

    // 🔥 NEW SIGNATURE: 6 parameters with usedCommand
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        
        // 🔥 NEURAL LANGUAGE BRIDGE - Alias-based detection!
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, 'en')
            : 'en';
        
        const t = translations[lang];
        const version = client.version || '1.6.0';
        const city = args.join(' ') || 'Bamako';
        
        await message.channel.sendTyping().catch(() => {});
        
        const weatherApiKey = process.env.WEATHER_API_KEY || process.env.OPENWEATHER_API_KEY;
        const unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY;
        
        if (!weatherApiKey) {
            return message.reply({ content: t.configError }).catch(() => {});
        }

        try {
            // ================= FETCH WEATHER DATA =================
            const weatherResponse = await axios.get(
                `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${weatherApiKey}`
            );
            
            const data = weatherResponse.data;
            const timezoneOffset = data.timezone;
            
            // Calculate weather metrics
            const temp = Math.round(data.main.temp);
            const feelsLike = Math.round(data.main.feels_like);
            const tempMin = Math.round(data.main.temp_min);
            const tempMax = Math.round(data.main.temp_max);
            const pressure = data.main.pressure;
            const humidity = data.main.humidity;
            const windSpeed = (data.wind.speed * 3.6).toFixed(1);
            const windDirection = getWindDirection(data.wind.deg);
            const visibility = (data.visibility / 1000).toFixed(1);
            
            const weatherCondition = data.weather[0].main.toLowerCase();
            const weatherDescription = capitalizeFirst(data.weather[0].description);
            const icon = data.weather[0].icon;
            const embedColor = getWeatherColor(weatherCondition, temp);
            const suggestion = getSmartSuggestion(weatherCondition, temp, humidity, windSpeed, lang);
            const isDaytime = icon.includes('d');
            
            const sunriseTimestamp = data.sys.sunrise + timezoneOffset;
            const sunsetTimestamp = data.sys.sunset + timezoneOffset;
            
            // ================= SMART FALLBACK SYSTEM FOR IMAGES =================
            let cityImage = null;
            
            // Try Unsplash
            if (unsplashAccessKey && !cityImage) {
                try {
                    const searchQueries = [`${data.name} ${data.sys.country} city`, `${data.name} landmark`];
                    for (const query of searchQueries) {
                        const imageResponse = await axios.get(
                            `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
                            { headers: { 'Authorization': `Client-ID ${unsplashAccessKey}` }, timeout: 3000 }
                        );
                        if (imageResponse.data.results?.length > 0) {
                            cityImage = imageResponse.data.results[0].urls.regular;
                            break;
                        }
                    }
                } catch (e) {}
            }
            
            // Try Pexels
            if (!cityImage && process.env.PEXELS_API_KEY) {
                try {
                    const imageResponse = await axios.get(
                        `https://api.pexels.com/v1/search?query=${encodeURIComponent(data.name)}&per_page=1&orientation=landscape`,
                        { headers: { 'Authorization': process.env.PEXELS_API_KEY }, timeout: 3000 }
                    );
                    if (imageResponse.data.photos?.length > 0) {
                        cityImage = imageResponse.data.photos[0].src.large2x;
                    }
                } catch (e) {}
            }
            
            // Try Wikipedia
            if (!cityImage) {
                try {
                    const wikiResponse = await axios.get(
                        `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&titles=${encodeURIComponent(data.name)}&pithumbsize=1024&origin=*`
                    );
                    const pages = wikiResponse.data.query.pages;
                    const pageId = Object.keys(pages)[0];
                    if (pages[pageId].thumbnail) cityImage = pages[pageId].thumbnail.source;
                } catch (e) {}
            }
            
            // Fallback: OpenStreetMap
            if (!cityImage) {
                cityImage = `https://staticmap.openstreetmap.de/staticmap.php?center=${data.coord.lat},${data.coord.lon}&zoom=12&size=1024x256&maptype=mapnik&markers=${data.coord.lat},${data.coord.lon},red-pushpin`;
            }
            
            // ================= BUILD EMBED =================
            const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(t.title(data.name, data.sys.country))
                .setDescription(`**${weatherDescription}** ${isDaytime ? '☀️' : '🌙'}`)
                .setThumbnail(`https://openweathermap.org/img/wn/${icon}@4x.png`)
                .addFields(
                    {
                        name: t.temperature,
                        value: `\`\`\`yaml\n${temp}°C\n${t.feelsLike}: ${feelsLike}°C\n⬇️ ${tempMin}°C / ⬆️ ${tempMax}°C\`\`\``,
                        inline: true
                    },
                    {
                        name: t.atmosphere,
                        value: `\`\`\`yaml\n${t.humidity}: ${humidity}%\n${t.pressure}: ${pressure} hPa\n${t.visibility}: ${visibility} km\`\`\``,
                        inline: true
                    },
                    {
                        name: t.wind,
                        value: `\`\`\`yaml\n${t.speed}: ${windSpeed} km/h\n${t.direction}: ${windDirection}\`\`\``,
                        inline: true
                    },
                    {
                        name: t.extraInfo,
                        value: `\`\`\`yaml\n${t.cloudiness}: ${data.clouds.all}%\n${t.sunrise}: <t:${sunriseTimestamp}:t>\n${t.sunset}: <t:${sunsetTimestamp}:t>\`\`\``,
                        inline: true
                    },
                    {
                        name: t.smartSuggestion,
                        value: `*${suggestion}*`,
                        inline: false
                    }
                )
                .setFooter({ 
                    text: `📍 ${data.coord.lat}, ${data.coord.lon} | ${t.timezone}: UTC${timezoneOffset >= 0 ? '+' : ''}${timezoneOffset / 3600} | v${version}`,
                    iconURL: message.author.displayAvatarURL({ dynamic: true })
                })
                .setTimestamp();
            
            embed.setImage(cityImage);

            await message.reply({ embeds: [embed] }).catch(() => {});
            
            console.log(`[WEATHER] ${message.author.tag} requested: ${data.name} | Temp: ${temp}°C | Lang: ${lang}`);
            
        } catch (err) {
            console.error('[WEATHER] Error:', err.response?.data || err.message);
            
            let errorMessage = t.fetchError;
            if (err.response?.status === 404) errorMessage = t.notFound(args.join(' ') || 'Bamako');
            else if (err.response?.status === 401) errorMessage = t.apiError;
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle(t.weatherServiceError)
                .setDescription(errorMessage)
                .setFooter({ text: t.checkCity })
                .setTimestamp();
            
            await message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }
    }
};