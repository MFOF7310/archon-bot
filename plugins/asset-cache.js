// plugins/asset-cache.js - RAM-based icon cache for Mali users
class AssetCache {
    constructor() {
        this.cache = new Map();
        this.size = 0;
    }

    preload() {
        const emojis = {
            'rank_bronze': '🥉',
            'rank_silver': '🥈',
            'rank_gold': '🥇',
            'rank_diamond': '💎',
            'rank_legendary': '👑',
            'icon_gaming': '🎮',
            'icon_eagle': '🦅',
            'icon_neural': '🧠',
            'icon_market': '📊',
            'icon_xp': '⚡',
            'icon_credits': '💰',
            'icon_shop': '🛒',
            'icon_profile': '👤',
            'icon_help': '❓',
            'icon_alert': '🔔',
            'icon_check': '✅',
            'icon_error': '❌',
            'icon_warning': '⚠️',
            'icon_bamako': '🇲🇱',
            'icon_server': '🌍',
            'icon_levelup': '⬆️',
            'icon_daily': '📅',
            'icon_streak': '🔥',
            'icon_transfer': '💸',
            'icon_invest': '📈',
        };

        for (const [key, emoji] of Object.entries(emojis)) {
            this.cache.set(key, emoji);
            this.size++;
        }

        console.log(`\x1b[36m[CACHE]\x1b[0m ${this.size} assets cached in RAM (zero network needed)`);
    }

    get(key) {
        return this.cache.get(key) || key;
    }

    stats() {
        return `${this.size} items cached`;
    }
}

module.exports = AssetCache;