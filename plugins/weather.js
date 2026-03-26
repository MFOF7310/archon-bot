const axios = require('axios');
const { EmbedBuilder, Colors } = require('discord.js');

module.exports = {
    name: 'weather',
    description: 'Get current weather for any city with detailed conditions.',
    category: 'UTILITY',
    usage: 'weather [city name]',
    examples: ['weather Paris', 'weather New York', 'weather Tokyo'],
    aliases: ['climate', 'forecast', 'temp'],
    
    run: async (client, message, args, database) => {
        const city = args.join(' ') || 'Bamako';
        
        await message.channel.sendTyping();
        
        const weatherApiKey = process.env.WEATHER_API_KEY;
        const unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY;
        
        if (!weatherApiKey) {
            return message.reply({
                content: "⚠️ **Configuration Error:** Weather API key not configured.",
                flags: 64
            });
        }

        try {
            // Fetch weather data
            const weatherResponse = await axios.get(
                `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${weatherApiKey}`
            );
            
            const data = weatherResponse.data;
            
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
            const weatherDescription = data.weather[0].description;
            const icon = data.weather[0].icon;
            const embedColor = getWeatherColor(weatherCondition, temp);
            const suggestion = getSmartSuggestion(weatherCondition, temp, humidity, windSpeed);
            const isDaytime = icon.includes('d');
            
            // SMART FALLBACK SYSTEM: Guarantees an image for every location
            let cityImage = null;
            
            // Try 1: Unsplash (beautiful city photos)
            if (unsplashAccessKey && !cityImage) {
                try {
                    const searchQueries = [
                        `${data.name} ${data.sys.country} city`,
                        `${data.name} landmark`,
                        `${data.name} architecture`,
                        `${data.name} downtown`
                    ];
                    
                    for (const query of searchQueries) {
                        try {
                            const imageResponse = await axios.get(
                                `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
                                {
                                    headers: { 'Authorization': `Client-ID ${unsplashAccessKey}` },
                                    timeout: 3000
                                }
                            );
                            
                            if (imageResponse.data.results?.length > 0) {
                                cityImage = imageResponse.data.results[0].urls.regular;
                                break;
                            }
                        } catch (e) { continue; }
                    }
                } catch (err) {
                    console.log('Unsplash error:', err.message);
                }
            }
            
            // Try 2: Pexels (alternative stock photos)
            const pexelsApiKey = process.env.PEXELS_API_KEY;
            if (!cityImage && pexelsApiKey) {
                try {
                    const imageResponse = await axios.get(
                        `https://api.pexels.com/v1/search?query=${encodeURIComponent(data.name)}&per_page=1&orientation=landscape`,
                        {
                            headers: { 'Authorization': pexelsApiKey },
                            timeout: 3000
                        }
                    );
                    
                    if (imageResponse.data.photos?.length > 0) {
                        cityImage = imageResponse.data.photos[0].src.large2x;
                    }
                } catch (err) {
                    console.log('Pexels error:', err.message);
                }
            }
            
            // Try 3: Wikipedia (free public domain images of any location)
            if (!cityImage) {
                try {
                    const wikiResponse = await axios.get(
                        `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&titles=${encodeURIComponent(data.name)}&pithumbsize=1024&origin=*`
                    );
                    
                    const pages = wikiResponse.data.query.pages;
                    const pageId = Object.keys(pages)[0];
                    if (pages[pageId].thumbnail) {
                        cityImage = pages[pageId].thumbnail.source;
                    }
                } catch (err) {
                    console.log('Wikipedia error:', err.message);
                }
            }
            
            // Try 4: Google Maps Static Image (guaranteed to work for ANY location!)
            if (!cityImage) {
                // OpenStreetMap - free, no API key, works for EVERY town on Earth
                cityImage = `https://staticmap.openstreetmap.de/staticmap.php?center=${data.coord.lat},${data.coord.lon}&zoom=12&size=1024x256&maptype=mapnik&markers=${data.coord.lat},${data.coord.lon},red-pushpin`;
            }
            
            // Try 5: Weather-themed background (ultimate fallback)
            if (!cityImage) {
                const weatherBackgrounds = {
                    clear: 'https://images.unsplash.com/photo-1601297183305-6df142704ea2?w=1024', // Sunny
                    clouds: 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=1024', // Cloudy
                    rain: 'https://images.unsplash.com/photo-1519692933481-e162a57d6721?w=1024', // Rainy
                    snow: 'https://images.unsplash.com/photo-1478265409131-1f65c88f965c?w=1024', // Snowy
                    thunderstorm: 'https://images.unsplash.com/photo-1605727216801-e27ce1d0cc28?w=1024' // Storm
                };
                
                cityImage = weatherBackgrounds[weatherCondition] || weatherBackgrounds.clear;
            }
            
            // Create embed
            const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(`🌤️ ${data.name}, ${data.sys.country}`)
                .setDescription(`**${capitalizeFirst(weatherDescription)}** ${isDaytime ? '☀️' : '🌙'}`)
                .setThumbnail(`https://openweathermap.org/img/wn/${icon}@4x.png`)
                .addFields(
                    {
                        name: '🌡️ Temperature',
                        value: `**${temp}°C**\nFeels like: ${feelsLike}°C\n⬇️ ${tempMin}°C / ⬆️ ${tempMax}°C`,
                        inline: true
                    },
                    {
                        name: '💧 Atmosphere',
                        value: `Humidity: **${humidity}%**\nPressure: **${pressure} hPa**\nVisibility: **${visibility} km**`,
                        inline: true
                    },
                    {
                        name: '🌬️ Wind',
                        value: `Speed: **${windSpeed} km/h**\nDirection: **${windDirection}**`,
                        inline: true
                    },
                    {
                        name: '📊 Extra Info',
                        value: `Cloudiness: **${data.clouds.all}%**\nSunrise: <t:${data.sys.sunrise}:t>\nSunset: <t:${data.sys.sunset}:t>`,
                        inline: true
                    },
                    {
                        name: '💡 Smart Suggestion',
                        value: `*${suggestion}*`,
                        inline: false
                    }
                )
                .setFooter({ 
                    text: `📍 ${data.coord.lat}, ${data.coord.lon}`,
                    iconURL: message.author.displayAvatarURL({ dynamic: true })
                })
                .setTimestamp();
            
            // ALWAYS add an image (5 fallback layers guarantee this)
            embed.setImage(cityImage);

            await message.reply({ embeds: [embed] });
            
        } catch (err) {
            console.error('Weather API Error:', err.response?.data || err.message);
            
            let errorMessage = "❌ **Weather data unavailable.**";
            
            if (err.response?.status === 404) {
                errorMessage = `❌ **Location not found:** "${args.join(' ') || 'Bamako'}" doesn't exist. Please check the spelling.`;
            } else if (err.response?.status === 401) {
                errorMessage = "❌ **API Key Error:** Invalid weather API key.";
            } else {
                errorMessage = `❌ **Error:** ${err.message || 'Failed to fetch weather data'}`;
            }
            
            const errorEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setTitle('⚠️ Weather Service Error')
                .setDescription(errorMessage)
                .setFooter({ text: 'Please check city name or try again later' })
                .setTimestamp();
            
            await message.reply({ embeds: [errorEmbed] });
        }
    }
};

// Helper functions (same as before)
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

function getSmartSuggestion(condition, temp, humidity, windSpeed) {
    const suggestions = [];
    
    if (temp > 35) suggestions.push("🥵 Extreme heat! Stay hydrated.");
    else if (temp > 30) suggestions.push("🌞 Hot day! Wear light clothing.");
    else if (temp > 25) suggestions.push("🌤️ Pleasant weather! Great for outdoors.");
    else if (temp > 15) suggestions.push("🍃 Mild conditions. Perfect for a walk.");
    else if (temp > 5) suggestions.push("🧥 Cool weather. Bring a jacket.");
    else if (temp > 0) suggestions.push("❄️ Chilly! Wear warm clothing.");
    else suggestions.push("🥶 Freezing! Bundle up.");
    
    if (condition.includes('rain')) suggestions.push("☔ Don't forget your umbrella!");
    if (condition.includes('thunderstorm')) suggestions.push("⚡ Storm warning! Stay indoors.");
    if (condition.includes('snow')) suggestions.push("⛄ Drive carefully in snow.");
    if (humidity > 80) suggestions.push("💦 High humidity! Feels warmer.");
    if (windSpeed > 40) suggestions.push("💨 Strong winds! Secure loose items.");
    
    return suggestions.join(' ');
}

function capitalizeFirst(str) {
    return str.replace(/\b\w/g, char => char.toUpperCase());
}