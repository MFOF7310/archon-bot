// ================= BAMAKO MARKET MANAGER v1.7.0 =================
const fs = require('fs');
const path = require('path');

const marketFile = path.join(__dirname, 'market_state.json');

// 🔥 Market trends WITH EMOJIS
const TRENDS = {
    BULL: { 
        name: 'Bull Market', 
        emoji: '📈',
        multiplier: [1.05, 1.20], 
        color: '#2ecc71',
        description: 'Strong growth - Best time to invest!'
    },
    STEADY: { 
        name: 'Steady Market', 
        emoji: '📊',
        multiplier: [0.98, 1.08], 
        color: '#f1c40f',
        description: 'Stable and predictable - Safe investments'
    },
    BEAR: { 
        name: 'Bear Market', 
        emoji: '📉',
        multiplier: [0.85, 0.98], 
        color: '#e74c3c',
        description: 'Declining - Proceed with caution'
    },
    VOLATILE: { 
        name: 'Volatile Market', 
        emoji: '🌪️',
        multiplier: [0.70, 1.40], 
        color: '#9b59b6',
        description: 'Extreme swings - High risk, high reward!'
    }
};

// Get current market state
function getMarketState() {
    try {
        if (fs.existsSync(marketFile)) {
            const data = fs.readFileSync(marketFile, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('[MARKET] Error reading state:', e.message);
    }
    
    // Default state
    return {
        trend: 'STEADY',
        multiplier: 1.0,
        lastUpdate: Date.now(),
        nextUpdate: Date.now() + (6 * 60 * 60 * 1000),
        history: []
    };
}

// Update market trend (called every 6 hours OR manually by owner)
function updateMarketTrend() {
    const state = getMarketState();
    
    // 30% Bull, 40% Steady, 20% Bear, 10% Volatile
    const rand = Math.random();
    let newTrend;
    if (rand < 0.30) newTrend = 'BULL';
    else if (rand < 0.70) newTrend = 'STEADY';
    else if (rand < 0.90) newTrend = 'BEAR';
    else newTrend = 'VOLATILE';
    
    const trendData = TRENDS[newTrend];
    const [min, max] = trendData.multiplier;
    const multiplier = min + (Math.random() * (max - min));
    
    state.trend = newTrend;
    state.multiplier = parseFloat(multiplier.toFixed(4));
    state.lastUpdate = Date.now();
    state.nextUpdate = Date.now() + (6 * 60 * 60 * 1000);
    
    // Keep last 10 trends
    state.history.push({
        trend: newTrend,
        multiplier: state.multiplier,
        timestamp: state.lastUpdate
    });
    if (state.history.length > 10) state.history.shift();
    
    // Save to file
    try {
        fs.writeFileSync(marketFile, JSON.stringify(state, null, 2));
    } catch (e) {
        console.error('[MARKET] Error saving state:', e.message);
    }
    
    console.log(`[MARKET] Trend updated: ${trendData.emoji} ${trendData.name} (${(state.multiplier * 100).toFixed(1)}%)`);
    
    return state;
}

// Process investment returns
function processInvestment(amount, investedAt) {
    const state = getMarketState();
    const multiplier = state.multiplier;
    
    // Small bonus for long-term holding (0.5% per hour)
    const hoursHeld = Math.max(0, (Date.now() - investedAt) / (60 * 60 * 1000));
    const holdingBonus = 1 + (hoursHeld * 0.005);
    
    return Math.floor(amount * multiplier * holdingBonus);
}

// Get time until next update (human readable)
function getTimeUntilUpdate() {
    const state = getMarketState();
    const remaining = state.nextUpdate - Date.now();
    
    if (remaining <= 0) return 'Updating...';
    
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

// Get Lydia-style market tip
function getLydiaMarketTip() {
    const state = getMarketState();
    const trend = TRENDS[state.trend];
    const multiplier = state.multiplier;
    
    const tips = {
        BULL: [
            "The Niger River is flowing strong! 📈",
            "My neural pathways detect growth in Bamako!",
            "The Architect smiles upon this market!",
            "Buy low, sell high - the ancient wisdom holds true!",
            "Prosperity flows like the Niger!"
        ],
        STEADY: [
            "Steady like the Malian sun. ☀️",
            "Consistency is the Bamako way.",
            "Nothing flashy, but reliable as the dawn.",
            "The market breathes steadily today.",
            "Patience rewards the wise."
        ],
        BEAR: [
            "Even the Niger has low tides. 📉",
            "Patience, Elite Friends. Markets breathe.",
            "A good time to hold and observe.",
            "The storm will pass. It always does.",
            "Wise investors know when to wait."
        ],
        VOLATILE: [
            "🌪️ Sandstorm in the market!",
            "High risk, high reward - like crossing the Sahara!",
            "My circuits are buzzing with uncertainty!",
            "Only the brave invest now!",
            "Fortune favors the bold... sometimes!"
        ]
    };
    
    const tipList = tips[state.trend] || tips.STEADY;
    return tipList[Math.floor(Math.random() * tipList.length)];
}

// Get market sentiment text
function getMarketSentiment() {
    const state = getMarketState();
    const multiplier = state.multiplier;
    
    if (multiplier >= 1.15) return '🔥 EXTREMELY BULLISH - Buy! Buy! Buy!';
    if (multiplier >= 1.05) return '📈 Bullish - Good time to invest';
    if (multiplier >= 0.98) return '📊 Neutral - Steady as she goes';
    if (multiplier >= 0.90) return '📉 Bearish - Proceed with caution';
    return '🌪️ VOLATILE - High risk, high reward!';
}

// Auto-update every 6 hours
const updateInterval = setInterval(() => {
    updateMarketTrend();
}, 6 * 60 * 60 * 1000);

// Prevent interval from keeping process alive if something goes wrong
updateInterval.unref();

console.log('[MARKET] Bamako Market Manager initialized');
console.log(`[MARKET] Current trend: ${TRENDS[getMarketState().trend].emoji} ${TRENDS[getMarketState().trend].name}`);

// Export functions
module.exports = {
    getMarketState,
    updateMarketTrend,
    processInvestment,
    getTimeUntilUpdate,
    getLydiaMarketTip,
    getMarketSentiment,
    TRENDS
};