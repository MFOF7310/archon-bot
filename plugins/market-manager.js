const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

// ================= MARKET TREND DEFINITIONS =================
const TRENDS = {
    BULL:       { name: 'Bull Market',       emoji: '📈', color: '#2ecc71', multiplier: [1.05, 1.20], narrative: 'The bulls are charging through Bamako!' },
    STEADY:     { name: 'Steady Market',     emoji: '📊', color: '#f1c40f', multiplier: [0.98, 1.08], narrative: 'Steady flows the Niger, steady grows the market.' },
    BEAR:       { name: 'Bear Market',       emoji: '📉', color: '#e74c3c', multiplier: [0.85, 0.98], narrative: 'The bears have awakened. Hold tight, investors.' },
    VOLATILE:   { name: 'Volatile Market',   emoji: '🌪️', color: '#9b59b6', multiplier: [0.70, 1.40], narrative: 'Sandstorm ahead! High risk, high reward territory.' }
};

const MARKET_EVENTS = [
    { name: 'Niger River Flood',     emoji: '🌊', effect: -0.15, msg: 'Flooding disrupts trade routes along the Niger. Market dips temporarily.', severity: 'moderate' },
    { name: 'Gold Discovery',        emoji: '💎', effect: 0.20,  msg: 'New gold deposits discovered near Bamako! Investors rush in — market surges!', severity: 'major' },
    { name: 'Solar Flare',           emoji: '☀️', effect: 0.25,  msg: 'Massive solar energy breakthrough! Renewable stocks explode upward!', severity: 'major' },
    { name: 'Trade Embargo',         emoji: '🚫', effect: -0.25, msg: 'International embargo declared! Export sectors crash — defensive positions advised.', severity: 'critical' },
    { name: 'Tech Innovation',       emoji: '🤖', effect: 0.15,  msg: 'Neural-tech breakthrough from the Malian Innovation Lab! Bullish momentum building.', severity: 'moderate' },
    { name: 'Market Correction',     emoji: '📉', effect: -0.10,  msg: 'Natural market correction underway. Healthy breathing after prolonged growth.', severity: 'minor' },
    { name: 'Festival Boom',         emoji: '🎉', effect: 0.10,  msg: 'Bamako Cultural Festival draws massive tourism! Local economy gets a festive boost.', severity: 'moderate' },
    { name: 'Sandstorm',             emoji: '🏜️', effect: -0.05,  msg: 'Minor sandstorm reported south of the city. Slight logistics slowdown.', severity: 'minor' },
    { name: 'ECOWAS Summit',         emoji: '🌍', effect: 0.18,  msg: 'ECOWAS leaders meet in Bamako! Regional trade agreements boost investor confidence.', severity: 'major' },
    { name: 'Cyber Attack',          emoji: '💻', effect: -0.20, msg: 'Coordinated cyberattack on regional banks detected! Security firms deployed.', severity: 'critical' },
    { name: 'Oil Price Spike',       emoji: '🛢️', effect: -0.12, msg: 'Global oil prices spike! Transport and manufacturing costs rise.', severity: 'moderate' },
    { name: 'Mobile Money Boom',     emoji: '📱', effect: 0.22,  msg: 'Mobile money adoption hits record highs! Fintech sector explodes.', severity: 'major' }
];

// ================= FILE PATHS =================
function getMarketFile(guildId) {
    const marketDir = path.join(__dirname, '..', 'data', 'market_states');
    if (!fs.existsSync(marketDir)) fs.mkdirSync(marketDir, { recursive: true });
    if (!guildId) return path.join(marketDir, 'market_state.json');
    return path.join(marketDir, `market_state_${guildId}.json`);
}

// ================= UTC 6-HOUR BOUNDARY SNAPPING =================
// Snaps to next 00:00, 06:00, 12:00, or 18:00 UTC
function getNext6hBoundary() {
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
        Math.ceil((now.getUTCHours() + 1) / 6) * 6, 0, 0, 0));
    if (next <= now) next.setUTCHours(next.getUTCHours() + 6);
    return next.getTime();
}

function formatCountdown(targetMs) {
    const remaining = targetMs - Date.now();
    if (remaining <= 0) return 'Updating now...';
    const h = Math.floor(remaining / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

// ================= PER-SERVER MARKET STATE =================
function getMarketState(guildId) {
    const file = getMarketFile(guildId);
    try {
        if (fs.existsSync(file)) {
            const state = JSON.parse(fs.readFileSync(file, 'utf8'));
            if (state.nextUpdate <= Date.now()) state.nextUpdate = getNext6hBoundary();
            return state;
        }
    } catch (e) {}
    return {
        trend: 'STEADY', multiplier: 1.0, lastUpdate: Date.now(),
        nextUpdate: getNext6hBoundary(), history: [], activeEvent: null
    };
}

function saveMarketState(guildId, state) {
    try { fs.writeFileSync(getMarketFile(guildId), JSON.stringify(state, null, 2)); } catch (e) {}
}

// ================= TREND UPDATE ENGINE =================
function updateMarketTrend(guildId) {
    const state = getMarketState(guildId);
    const rand = Math.random();
    let newTrend;
    if (rand < 0.28)      newTrend = 'BULL';
    else if (rand < 0.68) newTrend = 'STEADY';
    else if (rand < 0.88) newTrend = 'BEAR';
    else                  newTrend = 'VOLATILE';

    const trendData = TRENDS[newTrend];
    const [min, max] = trendData.multiplier;
    state.trend = newTrend;
    state.multiplier = parseFloat((min + Math.random() * (max - min)).toFixed(4));
    state.lastUpdate = Date.now();
    state.nextUpdate = getNext6hBoundary();

    // 22% chance of market event
    if (Math.random() < 0.22) {
        const event = MARKET_EVENTS[Math.floor(Math.random() * MARKET_EVENTS.length)];
        state.multiplier = parseFloat(Math.max(0.45, Math.min(1.55, state.multiplier + event.effect)).toFixed(4));
        state.activeEvent = {
            name: event.name, emoji: event.emoji, effect: event.effect,
            msg: event.msg, severity: event.severity, timestamp: Date.now()
        };
    } else {
        state.activeEvent = null;
    }

    state.history.push({ trend: newTrend, multiplier: state.multiplier, event: state.activeEvent?.name || null, timestamp: state.lastUpdate });
    if (state.history.length > 24) state.history.shift();

    saveMarketState(guildId, state);
    return state;
}

// ================= INVESTMENT CALCULATIONS =================
function processInvestment(amount, investedAt, guildId) {
    const state = getMarketState(guildId);
    const hoursHeld = Math.max(0, (Date.now() - investedAt) / 3600000);
    const holdingBonus = 1 + (hoursHeld * 0.005);
    return Math.floor(amount * state.multiplier * holdingBonus);
}

function getTimeUntilUpdate(guildId) {
    return formatCountdown(getMarketState(guildId).nextUpdate);
}

function getMarketSentiment(guildId) {
    const m = getMarketState(guildId).multiplier;
    if (m >= 1.15) return { label: '🔥 EXTREMELY BULLISH', bar: '▰▰▰▰▰▰▰▰▰▰', pct: 95 };
    if (m >= 1.08) return { label: '📈 STRONGLY BULLISH',  bar: '▰▰▰▰▰▰▰▰▰▱', pct: 82 };
    if (m >= 1.02) return { label: '📈 Bullish',            bar: '▰▰▰▰▰▰▰▰▱▱', pct: 68 };
    if (m >= 0.98) return { label: '📊 Neutral',            bar: '▰▰▰▰▰▰▱▱▱▱', pct: 50 };
    if (m >= 0.92) return { label: '📉 Bearish',            bar: '▰▰▰▰▱▱▱▱▱▱', pct: 35 };
    if (m >= 0.85) return { label: '📉 STRONGLY BEARISH',  bar: '▰▰▰▱▱▱▱▱▱▱', pct: 22 };
    return                       { label: '🌪️ EXTREME VOLATILITY', bar: '▰▱▱▱▱▱▱▱▱▱', pct: 10 };
}

// ================= MARKET HISTORY CHART =================
function buildHistoryChart(history, trendKey) {
    if (!history || history.length < 2) return '`No historical data yet`';
    const recent = history.slice(-8);
    let chart = '';
    for (const h of recent) {
        const t = TRENDS[h.trend];
        const arrow = h.multiplier >= 1.0 ? '▲' : '▼';
        chart += `${t.emoji} ${arrow} \`${(h.multiplier * 100).toFixed(1)}%\`  `;
    }
    return chart;
}

// ================= PROFIT PROJECTION =================
function getProfitProjection(guildId) {
    const m = getMarketState(guildId).multiplier;
    const projections = [
        { invest: 100,    return: Math.floor(100 * m),     label: '💵 100' },
        { invest: 1000,   return: Math.floor(1000 * m),    label: '💶 1K' },
        { invest: 10000,  return: Math.floor(10000 * m),   label: '💷 10K' },
        { invest: 100000, return: Math.floor(100000 * m),  label: '💎 100K' }
    ];
    return projections;
}

// ================= RAM CACHE =================
const INVESTOR_CACHE_TTL = 600000;
let investorCache = { data: {}, timestamp: {} };

function getInvestmentLeaderboard(db, guildId, limit = 5) {
    const now = Date.now();
    if (investorCache.data[guildId] && (now - (investorCache.timestamp[guildId] || 0)) < INVESTOR_CACHE_TTL) {
        return investorCache.data[guildId];
    }
    try {
        // NOTE: investments table does not have guild_id — we join with users table
        // which has guild_id (composite PK) to scope investments to this server
        const data = db.prepare(`
            SELECT u.username, u.id as user_id, SUM(i.amount) as total_invested, COUNT(i.id) as investment_count
            FROM investments i
            JOIN users u ON i.user_id = u.id
            WHERE i.claimed = 0 AND u.guild_id = ?
            GROUP BY i.user_id ORDER BY total_invested DESC LIMIT ?
        `).all(guildId, limit);
        investorCache.data[guildId] = data;
        investorCache.timestamp[guildId] = now;
        return data;
    } catch (e) {
        console.error('[MARKET] getInvestmentLeaderboard error:', e.message);
        return [];
    }
}

function getLydiaMarketTip(guildId) {
    const state = getMarketState(guildId);
    if (state.activeEvent) return `${state.activeEvent.emoji} ${state.activeEvent.msg}`;
    const tips = {
        BULL:   ['The Niger River is flowing strong! Time to invest big. 📈', 'My neural pathways detect explosive growth in Bamako!'],
        STEADY: ['Steady like the Malian sun. ☀️ A good time for conservative positions.', 'Consistency is the Bamako way. Small gains compound.'],
        BEAR:   ['Even the Niger has low tides. 📉 Hold your positions and wait.', 'Patience, Elite Friends. Markets always recover.'],
        VOLATILE:['🌪️ Sandstorm in the market! Only the brave should trade now.', 'High risk, high reward — but never invest more than you can lose!']
    };
    const tipList = tips[state.trend] || tips.STEADY;
    return tipList[Math.floor(Math.random() * tipList.length)];
}

function getServerMarketRankings(client) {
    const rankings = [];
    for (const [guildId, guild] of client.guilds.cache) {
        const state = getMarketState(guildId);
        const trend = TRENDS[state.trend] || TRENDS.STEADY;
        rankings.push({ guildId, name: guild.name, trend: state.trend, multiplier: state.multiplier, emoji: trend.emoji });
    }
    return rankings.sort((a, b) => b.multiplier - a.multiplier);
}

function loadAllStates(client) {
    const states = {};
    for (const [guildId] of client.guilds.cache) states[guildId] = getMarketState(guildId);
    return states;
}

// ================= SMART INVESTOR ROLE DETECTION =================
async function detectInvestorRole(guild, settings) {
    // 1. Check server_settings for configured role
    if (settings?.investorRoleId) {
        const role = guild.roles.cache.get(settings.investorRoleId);
        if (role) return role;
    }
    // 2. Check env fallback
    if (process.env.INVESTOR_ROLE_ID) {
        const role = guild.roles.cache.get(process.env.INVESTOR_ROLE_ID);
        if (role) return role;
    }
    // 3. Auto-detect by common names
    const commonNames = ['investor', 'trader', 'elite', 'vip', 'premium', 'market', 'economy', 'business'];
    for (const [_, role] of guild.roles.cache) {
        const nameLower = role.name.toLowerCase();
        if (commonNames.some(n => nameLower.includes(n)) && !role.managed && role.mentionable) {
            return role;
        }
    }
    // 4. First non-@everyone role with mention permission
    for (const [_, role] of guild.roles.cache) {
        if (role.name !== '@everyone' && !role.managed && role.mentionable) return role;
    }
    return null;
}

// ================= PROFESSIONAL EMBED BUILDER =================
async function buildMarketEmbed(guild, guildId, state, db) {
    const trend = TRENDS[state.trend] || TRENDS.STEADY;
    const sentiment = getMarketSentiment(guildId);
    const chart = buildHistoryChart(state.history, state.trend);
    const projections = getProfitProjection(guildId);
    const topInvestors = getInvestmentLeaderboard(db, guildId, 3);
    const nextUpdate = formatCountdown(state.nextUpdate);

    // Multiplier change indicator
    const prevEntry = state.history.length >= 2 ? state.history[state.history.length - 2] : null;
    const multiplierDelta = prevEntry ? (state.multiplier - prevEntry.multiplier) : 0;
    const deltaArrow = multiplierDelta >= 0 ? '▲' : '▼';
    const deltaColor = multiplierDelta >= 0 ? '#2ecc71' : '#e74c3c';
    const deltaText = `${deltaArrow} ${Math.abs(multiplierDelta * 100).toFixed(2)}%`;

    const embed = new EmbedBuilder()
        .setColor(trend.color)
        .setAuthor({
            name: `🏛️ BAMAKO STOCK EXCHANGE  •  ${guild.name.toUpperCase()}`,
            iconURL: guild.iconURL() || undefined
        })
        .setTitle(`${trend.emoji}  ${trend.name.toUpperCase()}  ${trend.emoji}`)
        .setDescription(
            `> *"${trend.narrative}"*\n\n` +
            `${sentiment.bar}\n` +
            `**Market Multiplier:** \`${(state.multiplier * 100).toFixed(2)}%\`  ${deltaText}\n` +
            `**Sentiment:** ${sentiment.label}\n` +
            `**Next Shift:** \`⏳ ${nextUpdate}\``
        )
        .addFields(
            {
                name: '📈 8-Cycle History',
                value: chart || '`Insufficient data`',
                inline: false
            },
            {
                name: '💰 Profit Projection (per 🪙 invested)',
                value: projections.map(p => `${p.label}  →  **${p.return.toLocaleString()}** ${p.return >= p.invest ? '🟢' : '🔴'}`).join('\n'),
                inline: true
            },
            {
                name: '🧠 Lydia\'s Insight',
                value: `*"${getLydiaMarketTip(guildId)}"*`,
                inline: true
            }
        )
        .setFooter({ text: `ARCHITECT CG-223  •  Bamako Market Intelligence  •  Cycle #${state.history.length}` })
        .setTimestamp();

    // Active Event Field
    if (state.activeEvent) {
        const severityEmoji = { minor: '⚡', moderate: '🔥', major: '💥', critical: '🚨' }[state.activeEvent.severity] || '⚡';
        embed.addFields({
            name: `${severityEmoji} MARKET EVENT: ${state.activeEvent.emoji} ${state.activeEvent.name.toUpperCase()}`,
            value: `> ${state.activeEvent.msg}\n> **Impact:** \`${state.activeEvent.effect >= 0 ? '+' : ''}${(state.activeEvent.effect * 100).toFixed(0)}%\``,
            inline: false
        });
    }

    // Top Investors Field
    if (topInvestors && topInvestors.length > 0) {
        const medals = ['🥇', '🥈', '🥉'];
        const investorList = topInvestors.map((inv, i) =>
            `${medals[i] || '▫️'} <@${inv.user_id}> — **${inv.total_invested.toLocaleString()}** 🪙 (${inv.investment_count} positions)`
        ).join('\n');
        embed.addFields({
            name: '🏆 Top Active Investors',
            value: investorList,
            inline: false
        });
    }

    return embed;
}

// ================= ISOLATED MARKET ALERT DISPATCHER =================
async function sendMarketUpdate(client, guild, guildId, state, db) {
    try {
        const settings = client.getServerSettings ? client.getServerSettings(guildId) : {};
        const isOwnerGuild = guildId === process.env.OWNER_GUILD_ID || guildId === process.env.GUILD_ID;

        // ================= PRIORITY 1: Check database for custom market channel =================
        let channelId = null;
        let source = 'none';
        
        try {
            // Ensure market_alerts table exists
            db.exec(`
    CREATE TABLE IF NOT EXISTS market_channels (
        guild_id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
`);
            
            const customSubscription = db.prepare('SELECT channel_id FROM market_channels WHERE guild_id = ?').get(guildId);
            if (customSubscription) {
                channelId = customSubscription.channel_id;
                source = 'database';
                console.log(`[MARKET] ${guild.name} using custom channel from database`);
            }
        } catch (dbErr) {
            console.error(`[MARKET DB ERROR] ${guild.name}:`, dbErr.message);
        }

        // ================= PRIORITY 2: Check server_settings =================
        if (!channelId && settings?.marketChannel) {
            channelId = settings.marketChannel;
            source = 'server_settings';
            console.log(`[MARKET] ${guild.name} using channel from server_settings`);
        }

        // ================= PRIORITY 3: Owner guild fallback ONLY =================
        // CRITICAL: Only use env fallback for the OWNER'S guild - never for other servers!
        if (!channelId && isOwnerGuild) {
            channelId = process.env.MARKET_CHANNEL_ID || process.env.MARKET_CHANNEL;
            if (channelId) {
                source = 'env_fallback (owner only)';
                console.log(`[MARKET] ${guild.name} (owner guild) using env fallback`);
            }
        }

        // ================= NO CHANNEL =================
        if (!channelId) {
            // Silent fail for non-owner servers (prevents spam)
            if (!isOwnerGuild) {
                return false;
            }
            // Only log for owner guild
            console.log(`[MARKET] ⏭️ No market channel configured for ${guild.name} (owner guild). Set via .marketset #channel`);
            return false;
        }

        // ================= VERIFY CHANNEL EXISTS =================
        const channel = guild.channels.cache.get(channelId);
        if (!channel) {
            console.log(`[MARKET] ⏭️ Channel ${channelId} not found in ${guild.name} (deleted/moved?)`);
            // Clean up invalid database entry if source is database
            if (source === 'database') {
                try {
                    db.prepare('DELETE FROM market_channels WHERE guild_id = ?').run(guildId);
                    console.log(`[MARKET] 🧹 Removed invalid channel reference for ${guild.name}`);
                } catch (e) {}
            }
            return false;
        }

        // ================= CHECK PERMISSIONS =================
        const botMember = guild.members.me || await guild.members.fetch(client.user.id).catch(() => null);
        if (!botMember) {
            console.log(`[MARKET] ⏭️ Bot not in ${guild.name} member cache`);
            return false;
        }
        
        const canSend = channel.permissionsFor(botMember)?.has(['SendMessages', 'EmbedLinks']);
        if (!canSend) {
            console.log(`[MARKET] ⏭️ Missing SendMessages/EmbedLinks in #${channel.name}`);
            return false;
        }

        // ================= BUILD AND SEND EMBED =================
        const embed = await buildMarketEmbed(guild, guildId, state, db);
        
        // Add source disclaimer for transparency (optional)
        if (source !== 'database' && isOwnerGuild) {
            embed.setFooter({ 
                text: `⚠️ Using fallback channel • Set .marketset #channel for persistent alerts • ${embed.data.footer?.text || ''}`,
                iconURL: guild.iconURL() || client.user.displayAvatarURL()
            });
        }

        // Detect investor role for mention (only if enabled)
        let pingContent = null;
        if (settings?.marketPingRole !== false) {
            const investorRole = await detectInvestorRole(guild, settings);
            if (investorRole) {
                pingContent = `<@&${investorRole.id}> 📊 **Bamako Market Shift Detected!**`;
            }
        }

        await channel.send({ content: pingContent, embeds: [embed] });
        console.log(`[MARKET] 📨 Sent to #${channel.name} in ${guild.name} | Source: ${source} | Trend: ${state.trend} | Mult: ${(state.multiplier * 100).toFixed(1)}%`);
        return true;

    } catch (err) {
        console.error(`[MARKET SEND ERROR] ${guildId}:`, err.message);
        return false;
    }
}

// ================= MAIN AUTO-UPDATE ENGINE (FIXED) =================
// This is the heart of the fix: when the 6h boundary hits, it BOTH
// updates the trend AND sends the embed to the configured channel.
function startAutoUpdate(client, db) {
    // Check every 30 seconds (lightweight — just reads a timestamp)
    setInterval(async () => {
        const now = Date.now();
        for (const [guildId, guild] of client.guilds.cache) {
            try {
                const state = getMarketState(guildId);

                // Only act when the 6h boundary has been reached
                if (now >= state.nextUpdate) {
                    const oldTrend = state.trend;
                    const oldMultiplier = state.multiplier;

                    // 1. Update the market trend
                    const newState = updateMarketTrend(guildId);
                    const trend = TRENDS[newState.trend];

                    console.log(`[MARKET] ${guild.name}: ${trend.emoji} ${trend.name} (${(newState.multiplier * 100).toFixed(1)}%)${newState.activeEvent ? ' ⚡ ' + newState.activeEvent.name : ''}`);

                    // 2. 🔥 FIX: Send the embed to Discord (this was missing!)
                    const sent = await sendMarketUpdate(client, guild, guildId, newState, db);
                    if (sent) {
                        console.log(`[MARKET] 📨 Embed sent to ${guild.name}`);
                    }
                }
            } catch (err) {
                console.error(`[MARKET AUTO-UPDATE ERROR] ${guildId}:`, err.message);
            }
        }
    }, 30 * 1000); // 30-second check interval

    console.log(`\x1b[32m[MARKET]\x1b[0m Auto-update engine active (30s check → 6h UTC boundary triggers)`);
}

// ================= BACKUP ALERT SYSTEM (for missed updates) =================
// Fires 5 minutes after each 6h boundary as a safety net
function startMarketAlerts(client, db) {
    // Safety-net: every 5 minutes, check if an update was missed
    setInterval(async () => {
        const now = Date.now();
        for (const [guildId, guild] of client.guilds.cache) {
            try {
                const state = getMarketState(guildId);
                // If nextUpdate is more than 30 minutes past due, something went wrong — force update
                const overdue = now - state.nextUpdate;
                if (overdue > 30 * 60 * 1000) {
                    console.log(`[MARKET ALERT] ${guild.name} missed update — forcing recovery`);
                    const newState = updateMarketTrend(guildId);
                    await sendMarketUpdate(client, guild, guildId, newState, db);
                }
            } catch (err) {
                console.error(`[MARKET ALERT ERROR] ${guildId}:`, err.message);
            }
        }
    }, 5 * 60 * 1000); // 5-minute safety check

    console.log(`\x1b[32m[MARKET]\x1b[0m Safety-net alert system active (5m recovery check)`);
}

module.exports = {
    getMarketState, updateMarketTrend, processInvestment, getTimeUntilUpdate,
    getLydiaMarketTip, getMarketSentiment, getServerMarketRankings,
    getInvestmentLeaderboard, loadAllStates, startAutoUpdate, startMarketAlerts,
    TRENDS, MARKET_EVENTS, buildMarketEmbed, sendMarketUpdate, getProfitProjection
};
