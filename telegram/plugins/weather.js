// ═══════════════════════════════════════════
//  TG COMMAND: Weather (NEW)
// ═══════════════════════════════════════════

const https = require('https');
function escapeHTML(t) { return !t || typeof t !== 'string' ? '' : t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

module.exports = {
    name: 'weather',
    description: 'Get weather for any city',
    category: 'Utility',
    usage: '/weather <city>',
    aliases: ['w', 'forecast', 'temp'],

    handler: async (ctx) => {
        const city = ctx.args.join(' ');
        if (!city) {
            return ctx.replyHTML(
                `🌤️ <b>Weather</b>\n\n<code>/weather Bamako</code>\n<code>/weather London</code>\n<code>/weather Tokyo</code>`
            );
        }

        await ctx.action('typing');

        try {
            const data = await requestJSON(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, { timeout: 10000 });
            if (!data || !data.current_condition) return ctx.replyHTML(`❌ City "${escapeHTML(city)}" not found.`);

            const current = data.current_condition[0];
            const area = data.nearest_area?.[0];
            const today = data.weather?.[0];
            const cityName = area ? `${area.areaName[0].value}, ${area.country[0].value}` : city;
            const emoji = getWeatherEmoji(current.weatherDesc?.[0]?.value || '');

            await ctx.replyHTML(
                `${emoji} <b>${escapeHTML(cityName)}</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━\n\n` +
                `🌡️ <b>${current.temp_C}°C</b> (feels ${current.FeelsLikeC}°C)\n` +
                `☁️ ${escapeHTML(current.weatherDesc?.[0]?.value || 'Unknown')}\n\n` +
                `📈 High: <b>${today?.maxtempC || current.temp_C}°C</b> · Low: <b>${today?.mintempC || current.temp_C}°C</b>\n` +
                `💧 Humidity: <b>${current.humidity}%</b>\n` +
                `💨 Wind: <b>${current.windspeedKmph} km/h</b>\n\n` +
                `<i>via wttr.in</i>`
            );
        } catch {
            ctx.replyHTML(`❌ Couldn't fetch weather. Try again.`);
        }
    }
};

function requestJSON(url, opts = {}) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https:') ? https : require('http');
        const req = lib.request(url, { method: 'GET', headers: opts.headers || {}, timeout: opts.timeout || 10000 }, (res) => {
            let d = ''; res.on('data', c => d += c);
            res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        req.end();
    });
}

function getWeatherEmoji(desc) {
    const d = (desc || '').toLowerCase();
    if (d.includes('sunny') || d.includes('clear')) return '☀️';
    if (d.includes('cloud')) return '☁️';
    if (d.includes('rain') || d.includes('drizzle')) return '🌧️';
    if (d.includes('thunder') || d.includes('storm')) return '⛈️';
    if (d.includes('snow')) return '❄️';
    if (d.includes('fog') || d.includes('mist')) return '🌫️';
    if (d.includes('partly')) return '⛅';
    return '🌤️';
}
