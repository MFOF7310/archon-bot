// ================= BAMAKO MARKET MANAGER v1.7.0 =================
const fs = require('fs');
const path = require('path');

const marketFile = path.join(__dirname, '..', 'market_state.json');

const TRENDS = {
    BULL: { name: 'Bull Market', emoji: '📈', color: '#2ecc71', multiplier: [1.05, 1.20] },
    STEADY: { name: 'Steady Market', emoji: '📊', color: '#f1c40f', multiplier: [0.98, 1.08] },
    BEAR: { name: 'Bear Market', emoji: '📉', color: '#e74c3c', multiplier: [0.85, 0.98] },
    VOLATILE: { name: 'Volatile Market', emoji: '🌪️', color: '#9b59b6', multiplier: [0.70, 1.40] }
};

function getMarketState() {
    try {
        if (fs.existsSync(marketFile)) {
            return JSON.parse(fs.readFileSync(marketFile, 'utf8'));
        }
    } catch (e) {}
    
    return {
        trend: 'STEADY',
        multiplier: 1.0,
        lastUpdate: Date.now(),
        nextUpdate: Date.now() + (6 * 60 * 60 * 1000),
        history: []
    };
}

function updateMarketTrend() {
    const state = getMarketState();
    const rand = Math.random();
    let newTrend;
    if (rand < 0.30) newTrend = 'BULL';
    else if (rand < 0.70) newTrend = 'STEADY';
    else if (rand < 0.90) newTrend = 'BEAR';
    else newTrend = 'VOLATILE';
    
    const trendData = TRENDS[newTrend];
    const [min, max] = trendData.multiplier;
    state.trend = newTrend;
    state.multiplier = parseFloat((min + Math.random() * (max - min)).toFixed(4));
    state.lastUpdate = Date.now();
    state.nextUpdate = Date.now() + (6 * 60 * 60 * 1000);
    
    state.history.push({ trend: newTrend, multiplier: state.multiplier, timestamp: state.lastUpdate });
    if (state.history.length > 10) state.history.shift();
    
    try { fs.writeFileSync(marketFile, JSON.stringify(state, null, 2)); } catch (e) {}
    return state;
}

function processInvestment(amount, investedAt) {
    const state = getMarketState();
    const hoursHeld = Math.max(0, (Date.now() - investedAt) / (60 * 60 * 1000));
    const holdingBonus = 1 + (hoursHeld * 0.005);
    return Math.floor(amount * state.multiplier * holdingBonus);
}

function getTimeUntilUpdate() {
    const state = getMarketState();
    const remaining = state.nextUpdate - Date.now();
    if (remaining <= 0) return 'Updating...';
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function getLydiaMarketTip() {
    const tips = {
        BULL: ["The Niger River is flowing strong! 📈", "My neural pathways detect growth in Bamako!"],
        STEADY: ["Steady like the Malian sun. ☀️", "Consistency is the Bamako way."],
        BEAR: ["Even the Niger has low tides. 📉", "Patience, Elite Friends. Markets breathe."],
        VOLATILE: ["🌪️ Sandstorm in the market!", "High risk, high reward!"]
    };
    const state = getMarketState();
    const tipList = tips[state.trend] || tips.STEADY;
    return tipList[Math.floor(Math.random() * tipList.length)];
}

function getMarketSentiment() {
    const multiplier = getMarketState().multiplier;
    if (multiplier >= 1.15) return '🔥 EXTREMELY BULLISH';
    if (multiplier >= 1.05) return '📈 Bullish';
    if (multiplier >= 0.98) return '📊 Neutral';
    if (multiplier >= 0.90) return '📉 Bearish';
    return '🌪️ VOLATILE';
}

// Auto-update every 6 hours
setInterval(() => {
    const newState = updateMarketTrend();
    const trend = TRENDS[newState.trend];
    console.log(`[MARKET] Trend updated: ${trend.emoji} ${trend.name} (${(newState.multiplier * 100).toFixed(1)}%)`);
}, 6 * 60 * 60 * 1000);

module.exports = {
    getMarketState,
    updateMarketTrend,
    processInvestment,
    getTimeUntilUpdate,
    getLydiaMarketTip,
    getMarketSentiment,
    TRENDS
};