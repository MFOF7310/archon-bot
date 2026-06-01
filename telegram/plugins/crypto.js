// ═══════════════════════════════════════════
//  TG COMMAND: Crypto Prices (NEW)
// ═══════════════════════════════════════════

const https = require('https');
const formatNumber = (n) => n?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') || '0';

const POPULAR = {
    btc: 'bitcoin', eth: 'ethereum', bnb: 'binancecoin', sol: 'solana',
    xrp: 'ripple', ada: 'cardano', doge: 'dogecoin', dot: 'polkadot',
    avax: 'avalanche-2', matic: 'matic-network', link: 'chainlink',
};

module.exports = {
    name: 'crypto',
    description: 'Check cryptocurrency prices',
    category: 'Utility',
    usage: '/crypto <coin>',
    aliases: ['price', 'coin', 'btc', 'eth'],

    handler: async (ctx) => {
        const query = ctx.args[0]?.toLowerCase() || 'bitcoin';
        const coinId = POPULAR[query] || query;

        await ctx.action('typing');

        try {
            const c = await requestJSON(`https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`, { timeout: 15000 });
            if (!c || c.error) {
                return ctx.replyHTML(`❌ Coin not found.\n\nTry: <code>/crypto bitcoin</code>, <code>/crypto eth</code>, <code>/crypto sol</code>`);
            }

            const p = c.market_data?.current_price?.usd || 0;
            const chg = c.market_data?.price_change_percentage_24h || 0;
            const high = c.market_data?.high_24h?.usd || 0;
            const low = c.market_data?.low_24h?.usd || 0;
            const cap = c.market_data?.market_cap?.usd || 0;
            const vol = c.market_data?.total_volume?.usd || 0;
            const rank = c.market_cap_rank || '?';
            const emoji = chg >= 0 ? '🟢' : '🔴';
            const arrow = chg >= 0 ? '▲' : '▼';

            await ctx.replyHTML(
                `💰 <b>${c.name} (${c.symbol?.toUpperCase()})</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━\n\n` +
                `💵 Price: <b>$${formatPrice(p)}</b>\n` +
                `${emoji} 24h: <b>${arrow} ${chg.toFixed(2)}%</b>\n\n` +
                `📈 High: $${formatPrice(high)}\n` +
                `📉 Low: $${formatPrice(low)}\n` +
                `📊 Market Cap: $${formatBigNumber(cap)}\n` +
                `📦 Volume: $${formatBigNumber(vol)}\n` +
                `🏆 Rank: #${rank}\n\n` +
                `<i>via CoinGecko</i>`
            );
        } catch {
            ctx.replyHTML(`❌ Couldn't fetch price. Try again later.`);
        }
    }
};

function requestJSON(url, opts = {}) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https:') ? https : require('http');
        const req = lib.request(url, { method: 'GET', headers: opts.headers || {}, timeout: opts.timeout || 15000 }, (res) => {
            let d = ''; res.on('data', c => d += c);
            res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        req.end();
    });
}

function formatPrice(n) {
    if (n >= 1) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n.toFixed(6);
}

function formatBigNumber(n) {
    if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
    return formatNumber(n);
}
