const FALLBACKS = { error: '❌', warning: '⚠️', check: '✅', success: '✅' };
function resolveEmoji(name, guild) {
    try {
        const EMOJIS = require('../config/emojis');
        const raw = EMOJIS[name];
        if (!raw) return FALLBACKS[name] || '';
        if (!raw.startsWith('<')) return raw; // already unicode
        if (!guild) return FALLBACKS[name] || raw;
        const match = raw.match(/<a?:(\w+):(\d+)>/);
        if (match) {
            const found = guild.emojis.cache.find(e => e.name === match[1]);
            return found ? found.toString() : (FALLBACKS[name] || raw);
        }
        return raw;
    } catch { return FALLBACKS[name] || '❌'; }
}
module.exports = { resolveEmoji };
