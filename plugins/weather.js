const axios = require('axios');
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

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
        sunrise: '☀️ Sunrise',
        sunset: '🌙 Sunset',
        airQuality: '🛡️ Air Quality',
        uvi: '☀️ UV Index',
        dewPoint: '💧 Dew Point',
        forecast: '📅 3-Day Forecast',
        smartAdvice: '💡 Meteorological Briefing',
        location: 'Location',
        timezone: 'Timezone',
        configError: '⚠️ **Configuration Error:** Weather API key not configured.',
        notFound: (city) => `❌ **Location not found:** "${city}" doesn't exist.`,
        apiError: '❌ **API Key Error:** Invalid weather API key.',
        fetchError: '❌ **Error:** Failed to fetch weather data.',
        weatherServiceError: '⚠️ Weather Service Error',
        checkCity: 'Please check city name or try again later',
        typing: '🔍 Fetching weather data...',
        aqiLabels: ['🟢 Excellent', '🟢 Good', '🟡 Moderate', '🟠 Unhealthy (Sensitive)', '🔴 Unhealthy', '🟣 Hazardous'],
        uviLabels: ['🟢 Low', '🟢 Low', '🟡 Moderate', '🟡 Moderate', '🟠 High', '🟠 High', '🔴 Very High', '🔴 Very High', '🔴 Very High', '🟣 Extreme'],
        advice: {
            extremeHeat: '🔥 **Heat Advisory** — Stay hydrated, avoid prolonged sun exposure. Light, breathable clothing recommended. Air conditioning advised for vulnerable populations.',
            hotDay: '☀️ **Sunny & Dry** — High dehydration risk. Carry water, wear sunscreen SPF 30+, seek shade during peak hours (11:00–15:00).',
            warmPleasant: '🌤️ **Pleasant Conditions** — Ideal for outdoor activities. Light clothing sufficient. UV protection still recommended during midday.',
            mild: '⛅ **Mild Weather** — Comfortable temperatures. Layered clothing advised for variable conditions. Good for extended outdoor activities.',
            cool: '🍃 **Cool Temperatures** — A jacket or sweater recommended. Good conditions for jogging and outdoor exercise.',
            cold: '❄️ **Cold Advisory** — Dress warmly: coat, gloves, scarf. Limit exposed skin time. Watch for wind chill effects.',
            freezing: '🥶 **Extreme Cold Warning** — Dangerous conditions. Multiple layers essential. Limit outdoor exposure. Check on elderly and pets.',
            rainy: '🌧️ **Rain Expected** — Carry an umbrella or waterproof jacket. Roads may be slippery. Reduced visibility: drive carefully.',
            stormy: '⛈️ **Thunderstorm Risk** — Seek shelter indoors. Avoid open areas, tall trees, and bodies of water. Postpone outdoor activities.',
            foggy: '🌫️ **Low Visibility** — Fog conditions. Reduce driving speed, use low-beam headlights. Allow extra travel time.',
            windy: '💨 **High Winds** — Secure loose outdoor objects. Difficult conditions for cycling. Watch for flying debris.',
            perfect: '✨ **Perfect Conditions** — Temperature, humidity, and wind are all in optimal ranges. An exceptional day to be outside!',
            uvHigh: '⚠️ **High UV Index** — Sunburn risk in 15-25 minutes. Broad-spectrum sunscreen, sunglasses, and hat essential between 10:00–16:00.',
            uvExtreme: '🚨 **Extreme UV** — Sunburn in 10 minutes. Minimize sun exposure, full protective gear required.',
            aqiBad: '😷 **Poor Air Quality** — Sensitive groups should limit outdoor exertion. Consider mask in heavily polluted areas. Keep windows closed.',
        }
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
        sunrise: '☀️ Lever',
        sunset: '🌙 Coucher',
        airQuality: '🛡️ Qualité de l\'Air',
        uvi: '☀️ Indice UV',
        dewPoint: '💧 Point de Rosée',
        forecast: '📅 Prévisions 3 Jours',
        smartAdvice: '💡 Bulletin Météorologique',
        location: 'Localisation',
        timezone: 'Fuseau horaire',
        configError: '⚠️ **Erreur de Configuration:** Clé API météo non configurée.',
        notFound: (city) => `❌ **Localisation introuvable:** "${city}" n'existe pas.`,
        apiError: '❌ **Erreur Clé API:** Clé API météo invalide.',
        fetchError: '❌ **Erreur:** Impossible de récupérer les données météo.',
        weatherServiceError: '⚠️ Erreur Service Météo',
        checkCity: 'Vérifiez le nom de la ville ou réessayez plus tard',
        typing: '🔍 Récupération des données météo...',
        aqiLabels: ['🟢 Excellente', '🟢 Bonne', '🟡 Modérée', '🟠 Malsaine (Sensibles)', '🔴 Malsaine', '🟣 Dangereuse'],
        uviLabels: ['🟢 Faible', '🟢 Faible', '🟡 Modéré', '🟡 Modéré', '🟠 Élevé', '🟠 Élevé', '🔴 Très Élevé', '🔴 Très Élevé', '🔴 Très Élevé', '🟣 Extrême'],
        advice: {
            extremeHeat: '🔥 **Avis de Chaleur** — Hydratez-vous, évitez l\'exposition solaire prolongée. Vêtements légers et respirants recommandés.',
            hotDay: '☀️ **Ensoleillé et Sec** — Risque élevé de déshydratation. Portez de l\'eau, crème solaire FPS 30+, cherchez l\'ombre (11h–15h).',
            warmPleasant: '🌤️ **Conditions Agréables** — Idéal pour les activités extérieures. Vêtements légers suffisants.',
            mild: '⛅ **Températures Douces** — Températures confortables. Vêtements en couches conseillés.',
            cool: '🍃 **Températures Fraîches** — Un blouson ou pull recommandé. Bonnes conditions pour le jogging.',
            cold: '❄️ **Avis de Froid** — Couvrez-vous chaudement: manteau, gants, écharpe. Limitez le temps dehors.',
            freezing: '🥶 **Alerte Grand Froid** — Conditions dangereuses. Plusieurs couches essentielles. Vérifiez les personnes âgées.',
            rainy: '🌧️ **Pluie Attendue** — Emportez un parapluie ou blouson imperméable. Routes glissantes: conduisez prudemment.',
            stormy: '⛈️ **Risque d\'Orage** — Cherchez un abri intérieur. Évitez zones dégagées et arbres hauts.',
            foggy: '🌫️ **Faible Visibilité** — Brouillard. Réduisez la vitesse, utilisez feux de croisement.',
            windy: '💨 **Vents Forts** — Sécurisez les objets extérieurs. Conditions difficiles pour le vélo.',
            perfect: '✨ **Conditions Parfaites** — Température, humidité et vent sont optimaux. Une journée exceptionnelle!',
            uvHigh: '⚠️ **UV Élevé** — Coup de soleil en 15-25 min. Crème solaire, lunettes et chapeau essentiels (10h–16h).',
            uvExtreme: '🚨 **UV Extrême** — Coup de soleil en 10 min. Minimisez l\'exposition, équipement complet requis.',
            aqiBad: '😷 **Mauvaise Qualité de l\'Air** — Groupes sensibles: limitez les efforts extérieurs. Masque recommandé.',
        }
    }
};

// ================= HELPER FUNCTIONS =================
function getWindDirection(degrees) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return directions[Math.round(degrees / 22.5) % 16];
}

function getWeatherColor(condition, temp) {
    if (temp > 35) return 0xE67E22;
    if (temp < 0) return 0x5DADE2;
    if (temp < 10) return 0x5499C7;
    const colorMap = { clear: 0xF1C40F, clouds: 0x95A5A6, rain: 0x3498DB, drizzle: 0x5DADE2, thunderstorm: 0x8E44AD, snow: 0xBDC3C7 };
    return colorMap[condition] || 0x3498DB;
}

function capitalizeFirst(str) {
    return str.replace(/\b\w/g, char => char.toUpperCase());
}

// ================= SMART ADVISOR (Professional) =================
function getSmartAdvice(condition, temp, humidity, windSpeed, uvi, aqi, lang) {
    const a = translations[lang].advice;
    const pieces = [];
    const w = condition.toLowerCase();

    // Temperature advice
    if (temp >= 40) pieces.push(a.extremeHeat);
    else if (temp >= 35) pieces.push(a.hotDay);
    else if (temp >= 25) pieces.push(a.warmPleasant);
    else if (temp >= 15) pieces.push(a.mild);
    else if (temp >= 10) pieces.push(a.cool);
    else if (temp >= 0) pieces.push(a.cold);
    else pieces.push(a.freezing);

    // Condition advice
    if (w.includes('thunderstorm')) pieces.push(a.stormy);
    else if (w.includes('rain')) pieces.push(a.rainy);
    else if (w.includes('drizzle')) pieces.push(a.rainy);
    else if (w.includes('snow')) pieces.push(a.freezing);
    else if (w.includes('mist') || w.includes('fog') || w.includes('haze')) pieces.push(a.foggy);

    // Wind advice
    if (windSpeed > 40) pieces.push(a.windy);

    // UV advice
    if (uvi >= 11) pieces.push(a.uvExtreme);
    else if (uvi >= 6) pieces.push(a.uvHigh);

    // AQI advice
    if (aqi >= 4) pieces.push(a.aqiBad);

    // Perfect day detection
    if (temp >= 20 && temp <= 26 && humidity >= 30 && humidity <= 60 && windSpeed < 20 && w.includes('clear') && uvi < 6 && aqi <= 2) {
        pieces.push(a.perfect);
    }

    return pieces.join('\n\n');
}

// ================= CITY IMAGE FETCHER =================
async function fetchCityImage(data, unsplashKey) {
    const cityName = data.name;
    const country = data.sys.country;
    const lat = data.coord.lat;
    const lon = data.coord.lon;
    let cityImage = null;

    // Try 1: Unsplash with exact location
    if (unsplashKey) {
        try {
            const queries = [`${cityName} ${country}`, `${cityName} city skyline`, `${cityName} landmark`];
            for (const query of queries) {
                const res = await axios.get(
                    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape`,
                    { headers: { Authorization: `Client-ID ${unsplashKey}` }, timeout: 5000 }
                );
                if (res.data.results?.length > 0) { cityImage = res.data.results[0].urls.regular; break; }
            }
        } catch (e) { console.log('[WEATHER] Unsplash failed:', e.message); }
    }

    // Try 2: Wikipedia exact page match
    if (!cityImage) {
        try {
            const wikiRes = await axios.get(
                `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&titles=${encodeURIComponent(cityName)}&pithumbsize=1024&origin=*`,
                { timeout: 5000 }
            );
            const pages = wikiRes.data.query.pages;
            const pageId = Object.keys(pages)[0];
            if (pageId !== '-1' && pages[pageId].thumbnail) {
                cityImage = pages[pageId].thumbnail.source;
            } else {
                // Try with country suffix
                const wikiRes2 = await axios.get(
                    `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&titles=${encodeURIComponent(cityName + ',_' + country)}&pithumbsize=1024&origin=*`,
                    { timeout: 5000 }
                );
                const pages2 = wikiRes2.data.query.pages;
                const pageId2 = Object.keys(pages2)[0];
                if (pageId2 !== '-1' && pages2[pageId2].thumbnail) cityImage = pages2[pageId2].thumbnail.source;
            }
        } catch (e) { console.log('[WEATHER] Wikipedia failed:', e.message); }
    }

    // Try 3: Wikimedia Commons
    if (!cityImage) {
        try {
            const commonsRes = await axios.get(
                `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(cityName + ' ' + country)}&gsrnamespace=6&prop=imageinfo&iiprop=url&iiurlwidth=1024&origin=*`,
                { timeout: 5000 }
            );
            const pages = commonsRes.data.query?.pages;
            if (pages) {
                for (const page of Object.values(pages)) {
                    if (page.imageinfo?.[0]?.thumburl) { cityImage = page.imageinfo[0].thumburl; break; }
                }
            }
        } catch (e) { console.log('[WEATHER] Wikimedia failed:', e.message); }
    }

    // Final fallback: OpenStreetMap static map
    if (!cityImage) {
        cityImage = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=12&size=1024x512&maptype=mapnik&markers=${lat},${lon},red-pushpin`;
    }

    return cityImage;
}

// ================= MAIN MODULE =================
module.exports = {
    name: 'weather',
    description: '🌤️ Professional meteorological report with forecast, air quality, and intelligent advice.',
    category: 'UTILITY',
    usage: '.weather [city name]',
    examples: ['.weather Paris', '.weather New York', '.weather Tokyo', '.weather Bamako'],
    aliases: ['climate', 'forecast', 'temp', 'meteo', 'climat', 'temperature'],
    cooldown: 5000,

    data: new SlashCommandBuilder()
        .setName('weather')
        .setDescription('🌤️ Get current weather for any city with detailed conditions')
        .addStringOption(option =>
            option.setName('city')
                .setDescription('City name (e.g., Paris, Tokyo, Bamako)')
                .setRequired(false)
        ),

    // ================= SLASH COMMAND =================
    execute: async (interaction, client) => {
        const city = interaction.options.getString('city') || 'Bamako';
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const usedCommand = lang === 'fr' ? 'meteo' : 'weather';

        await interaction.deferReply();

        const fakeMessage = {
            author: interaction.user,
            guild: interaction.guild,
            channel: interaction.channel,
            reply: async (options) => interaction.editReply(options),
            react: () => Promise.resolve()
        };

        const serverSettings = interaction.guild ? client.getServerSettings(interaction.guild.id) : { prefix: '.' };
        await module.exports.run(client, fakeMessage, [city], client.db, serverSettings, usedCommand);
    },

    // ================= PREFIX COMMAND =================
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
        const txt = translations[lang];
        const version = client.version || '2.0';
        const city = args.join(' ') || 'Bamako';

        await message.channel.sendTyping().catch(() => {});

        const weatherApiKey = process.env.WEATHER_API_KEY || process.env.OPENWEATHER_API_KEY;
        const unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY;

        if (!weatherApiKey) {
            return message.reply({ content: txt.configError }).catch(() => {});
        }

        try {
            // Fetch current weather
            const weatherRes = await axios.get(
                `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${weatherApiKey}&lang=${lang}`
            );
            const data = weatherRes.data;

            // Parallel fetches: forecast + air quality + UV
            const { coord } = data;
            const [forecastRes, aqiRes, uvRes] = await Promise.all([
                axios.get(`https://api.openweathermap.org/data/2.5/forecast?lat=${coord.lat}&lon=${coord.lon}&cnt=28&appid=${weatherApiKey}&units=metric&lang=${lang}`).catch(() => null),
                axios.get(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${coord.lat}&lon=${coord.lon}&appid=${weatherApiKey}`).catch(() => null),
                axios.get(`https://api.openweathermap.org/data/2.5/uvi?lat=${coord.lat}&lon=${coord.lon}&appid=${weatherApiKey}`).catch(() => null),
            ]);

            // Calculate metrics
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
            const isDaytime = icon.includes('d');
            const timezoneOffset = data.timezone;

            // AQI, UV, Dew Point
            const aqi = aqiRes?.data?.list?.[0]?.main?.aqi || 1;
            const uvi = uvRes?.data?.value || (data.clouds.all < 20 ? Math.min(10, Math.round((12 - Math.abs(coord.lat) / 15) * (1 - data.clouds.all / 200))) : 2);
            const dewPoint = Math.round(data.main.temp - (100 - humidity) / 5);

            // Smart professional advice
            const advice = getSmartAdvice(weatherCondition, temp, humidity, parseFloat(windSpeed), uvi, aqi, lang);

            // City image
            const cityImage = await fetchCityImage(data, unsplashAccessKey);

            // Parse 3-day forecast from 3-hour list
            let forecastText = '';
            if (forecastRes?.data?.list) {
                const daily = {};
                for (const item of forecastRes.data.list) {
                    const day = new Date(item.dt * 1000).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'short' });
                    if (!daily[day]) daily[day] = { temps: [], desc: item.weather[0], dt: item.dt };
                    daily[day].temps.push(item.main.temp);
                }
                const days = Object.entries(daily).slice(1, 4); // Skip today, show next 3
                for (const [dayName, info] of days) {
                    const min = Math.round(Math.min(...info.temps));
                    const max = Math.round(Math.max(...info.temps));
                    const fEmoji = info.desc.main.toLowerCase().includes('rain') ? '🌧️' : info.desc.main.toLowerCase().includes('cloud') ? '☁️' : info.desc.main.toLowerCase().includes('clear') ? '☀️' : '🌤️';
                    forecastText += `${fEmoji} **${dayName}**: ${max}°↑ / ${min}°↓ — ${capitalizeFirst(info.desc.description)}\n`;
                }
            }

            // ================= BUILD EMBED =================
            const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(txt.title(data.name, data.sys.country))
                .setDescription(`**${weatherDescription}** ${isDaytime ? '☀️' : '🌙'}`)
                .setThumbnail(`https://openweathermap.org/img/wn/${icon}@4x.png`)
                .setImage(cityImage)
                .addFields(
                    {
                        name: txt.temperature,
                        value: `**${temp}°C** (${txt.feelsLike}: ${feelsLike}°C)\n⬇️ ${tempMin}°C / ⬆️ ${tempMax}°C`,
                        inline: true
                    },
                    {
                        name: txt.atmosphere,
                        value: `${txt.humidity}: ${humidity}%\n${txt.pressure}: ${pressure} hPa\n${txt.visibility}: ${visibility} km`,
                        inline: true
                    },
                    {
                        name: txt.wind,
                        value: `${txt.speed}: ${windSpeed} km/h\n${txt.direction}: ${windDirection}`,
                        inline: true
                    },
                    {
                        name: txt.airQuality,
                        value: txt.aqiLabels[Math.min(aqi - 1, 5)],
                        inline: true
                    },
                    {
                        name: txt.uvi + ' / ' + txt.dewPoint,
                        value: txt.uviLabels[Math.min(Math.round(uvi), 9)] + `\n${dewPoint}°C`,
                        inline: true
                    },
                    {
                        name: txt.cloudiness,
                        value: `${data.clouds.all}%`,
                        inline: true
                    }
                )
                .addFields(
                    // 🔥 FIX: Timestamps OUTSIDE code blocks — Discord can now parse them!
                    {
                        name: txt.sunrise,
                        value: `<t:${data.sys.sunrise}:t>`,
                        inline: true
                    },
                    {
                        name: txt.sunset,
                        value: `<t:${data.sys.sunset}:t>`,
                        inline: true
                    }
                )
                .setFooter({
                    text: `📍 ${coord.lat.toFixed(2)}, ${coord.lon.toFixed(2)} • ${txt.timezone}: UTC${timezoneOffset >= 0 ? '+' : ''}${timezoneOffset / 3600} • v${version}`,
                    iconURL: message.author?.displayAvatarURL?.({ dynamic: true }) || undefined
                })
                .setTimestamp();

            // Forecast
            if (forecastText) {
                embed.addFields({ name: txt.forecast, value: forecastText, inline: false });
            }

            // Professional smart advice
            if (advice) {
                embed.addFields({ name: txt.smartAdvice, value: advice, inline: false });
            }

            await message.reply({ embeds: [embed] }).catch(() => {});

        } catch (err) {
            console.error('[WEATHER] Error:', err.response?.data || err.message);

            let errorMessage = txt.fetchError;
            if (err.response?.status === 404) errorMessage = txt.notFound(city);
            else if (err.response?.status === 401) errorMessage = txt.apiError;

            const errorEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle(txt.weatherServiceError)
                .setDescription(errorMessage)
                .setFooter({ text: txt.checkCity })
                .setTimestamp();

            await message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }
    }
};