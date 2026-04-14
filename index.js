// ================= CORRECTED INDEX.JS v1.7.0 - BAMAKO NODE PRO =================
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client, Collection, Events, Partials, GatewayIntentBits, EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ================= IMPORT LYDIA SETUP FUNCTION =================
const { setupLydia } = require('./plugins/lydia.js');

// ================= 🔥 AFK SYSTEM IMPORT =================
const { afkUsers } = require('./plugins/afk.js');

// ================= 🔥 BAMAKO MARKET MANAGER (SAFE FALLBACK) =================
let getMarketState, updateMarketTrend, TRENDS;

try {
    const MarketManager = require('./plugins/market-manager.js');
    getMarketState = MarketManager.getMarketState;
    updateMarketTrend = MarketManager.updateMarketTrend;
    TRENDS = MarketManager.TRENDS;
    console.log(`\x1b[32m[MARKET]\x1b[0m Manager loaded successfully`);
} catch (err) {
    console.log(`\x1b[33m[MARKET]\x1b[0m Manager not found - using fallback`);
    
    TRENDS = {
        STEADY: { name: 'Steady Market', emoji: '📊', color: '#f1c40f', multiplier: [0.98, 1.08] },
        BULL: { name: 'Bull Market', emoji: '📈', color: '#2ecc71', multiplier: [1.05, 1.20] },
        BEAR: { name: 'Bear Market', emoji: '📉', color: '#e74c3c', multiplier: [0.85, 0.98] },
        VOLATILE: { name: 'Volatile Market', emoji: '🌪️', color: '#9b59b6', multiplier: [0.70, 1.40] }
    };
    
    getMarketState = () => ({
        trend: 'STEADY',
        multiplier: 1.0,
        lastUpdate: Date.now(),
        nextUpdate: Date.now() + (6 * 60 * 60 * 1000),
        history: []
    });
    
    updateMarketTrend = () => getMarketState();
}

// ================= SELF-HEALING PROTOCOL =================
process.on('unhandledRejection', (reason, promise) => {
    console.error('\x1b[31m[ANTI-CRASH]\x1b[0m Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err, origin) => {
    console.error('\x1b[31m[ANTI-CRASH]\x1b[0m Uncaught Exception:', err.message);
    console.error(err.stack);
});

// ================= TERMINAL COLORS =================
const green = "\x1b[32m", blue = "\x1b[34m", cyan = "\x1b[36m", yellow = "\x1b[33m", red = "\x1b[31m", magenta = "\x1b[35m", reset = "\x1b[0m", bold = "\x1b[1m";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

// ================= SYSTEM GLOBALS =================
client.commands = new Collection();
client.aliases = new Collection();
client.userTimeouts = new Map();
client.settings = new Map();

// ================= DYNAMIC VERSIONING =================
function getVersion() {
    try {
        const versionPath = path.join(__dirname, 'version.txt');
        if (fs.existsSync(versionPath)) {
            const version = fs.readFileSync(versionPath, 'utf8').trim();
            return version;
        } else {
            fs.writeFileSync(versionPath, '1.7.0', 'utf8');
            return '1.7.0';
        }
    } catch (err) {
        return '1.7.0';
    }
}

client.version = getVersion();

// --- LYDIA GLOBALS (Will be populated by setupLydia) ---
client.lydiaChannels = {};
client.lydiaAgents = {};
client.lastLydiaCall = {};
client.userIntroductions = new Map();

const PREFIX = process.env.PREFIX || ".";

// ================= UTILITIES =================
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const formatNumber = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// ================= 🔥 SAFE UNIVERSAL LANGUAGE DETECTION =================
function detectLanguage(usedCommand) {
    if (!usedCommand || typeof usedCommand !== 'string') return 'en';
    
    const cmd = usedCommand.toLowerCase().trim();
    if (!cmd || cmd.length === 0) return 'en';
    
    if (/[àâäéèêëîïôöùûüÿçœæ]/i.test(cmd)) return 'fr';
    
    const frenchSpecificPatterns = [
        /œ/i, /æ/i, /[aeiou]û/i, /[aeiou]ê/i, /ç[aeiou]/i, /ge[ao]$/i, /e[au]r?$/i, /[aeiou]i[td]?$/i
    ];
    if (frenchSpecificPatterns.some(pattern => pattern.test(cmd))) return 'fr';
    
    const frenchVerbPatterns = [
        /^(je|tu|il|elle|on|nous|vous|ils|elles)\s+/i,
        /(er|ir|oir|re)ai[st]?$/i, /(er|ir|oir|re)ais$/i, /(er|ir|oir|re)ez$/i,
        /(er|ir|oir|re)ons$/i, /(er|ir|oir|re)ent$/i, /[aeiou]ss(ai|ez|ons|ent)$/i,
        /[aeiou]ss?ions$/i, /[aeiou](ai|ait|aient|ais|iez)$/i
    ];
    if (frenchVerbPatterns.some(pattern => pattern.test(cmd))) return 'fr';
    
    const frenchNounPatterns = [
        /^(le|la|les|l'|un|une|des|du|de la|au|aux)\s+/i,
        /(eau|x|s)$/i, /(ier|ière|eur|euse|teur|trice)$/i,
        /(ment|tion|sion|aison|isme|age|té|tude)$/i,
        /(able|ible|eux|euse|ique|al|el|if|ive)$/i,
        /(ette|eau|elle|et|ot|on)$/i, /(ance|ence|esse|erie|ise|ade|ude)$/i
    ];
    if (frenchNounPatterns.some(pattern => pattern.test(cmd))) return 'fr';
    
    const frenchSilentPatterns = [/ent$/i, /[aeiou]s$/i, /[aeiou]t$/i, /[aeiou]x$/i, /[aeiou]d$/i];
    if (frenchSilentPatterns.some(pattern => pattern.test(cmd))) return 'fr';
    
    const frenchQuestionWords = /^(qui|que|quoi|où|quand|comment|pourquoi|combien|lequel|laquelle|lesquels|lesquelles)\b/i;
    if (frenchQuestionWords.test(cmd)) return 'fr';
    
    const frenchPrepositions = /^(dans|sur|sous|avec|sans|pour|par|vers|chez|entre|parmi|pendant|depuis|avant|après|contre|malgré|selon|voici|voilà)\b/i;
    if (frenchPrepositions.test(cmd)) return 'fr';
    
    const vowelRatio = (cmd.match(/[aeiouyàâäéèêëîïôöùûüÿ]/gi) || []).length / cmd.length;
    const hasFrenchVowelCluster = /[aeiouy]{3,}/i.test(cmd);
    const hasNasalPattern = /[aeiou][nm](?![aeiou])/i.test(cmd);
    
    if (vowelRatio > 0.6 && cmd.length > 3) return 'fr';
    if (hasFrenchVowelCluster) return 'fr';
    if (hasNasalPattern && /[àâäéèêëîïôöùûüÿ]/.test(cmd) === false) return 'fr';
    
    const englishSpecificPatterns = [
        /^(the|a|an)\s+/i, /^(i|you|he|she|it|we|they)\s+/i,
        /(ing|ed|'s|'ve|'re|'ll|'d)$/i, /th(?:is|at|ese|ose|ere)/i, /(?:wh|gh|ph|sh|ch|th)/i
    ];
    
    if (englishSpecificPatterns.some(pattern => pattern.test(cmd))) {
        const hasFrenchIndicators = /[àâäéèêëîïôöùûüÿçœæ]/i.test(cmd) || /(ez|ons|ent|eau|tion)$/i.test(cmd);
        if (!hasFrenchIndicators) return 'en';
    }
    
    return 'en';
}

function calculateLevel(xp) {
    return Math.floor(0.1 * Math.sqrt(xp || 0)) + 1;
}

client.detectLanguage = detectLanguage;
client.calculateLevel = calculateLevel;
client.formatNumber = formatNumber;

console.log(`${green}[LANGUAGE]${reset} Universal pattern-based detection initialized`);

// --- SQLITE DATABASE ---
const Database = require('better-sqlite3');
const db = new Database('database.sqlite', {
    timeout: 10000,
    readonly: false,
    fileMustExist: false
});

// ================= 🔥 PILLAR 3: HIGH-PERFORMANCE PRAGMA =================
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA synchronous = NORMAL;");
db.exec("PRAGMA cache_size = -64000;");
db.exec("PRAGMA temp_store = MEMORY;");
db.exec("PRAGMA busy_timeout = 10000;");
db.exec("PRAGMA wal_autocheckpoint = 1000;");
console.log(`${green}[PRAGMA]${reset} WAL mode enabled - Lock protection active`);

// ================= SAFE DATABASE WRITE (NO LOCKS!) =================
function safeDbWrite(operation, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return operation();
        } catch (error) {
            lastError = error;
            
            if (error.code === 'SQLITE_BUSY' || error.message.includes('database is locked')) {
                console.log(`${yellow}[DB]${reset} Lock detected, retry ${attempt}/${maxRetries}...`);
                const waitTime = attempt * 500;
                const start = Date.now();
                while (Date.now() - start < waitTime) {}
            } else {
                throw error;
            }
        }
    }
    throw lastError;
}

client.safeDbWrite = safeDbWrite;

// ================= GLOBAL AUTO-REPAIR PROTOCOL =================
console.log(`${cyan}[REPAIR]${reset} Initiating Global Neural Schema Repair...`);

const requiredTables = {
    users: `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, 
        username TEXT, 
        xp INTEGER DEFAULT 0, 
        level INTEGER DEFAULT 1, 
        credits INTEGER DEFAULT 0, 
        streak_days INTEGER DEFAULT 0, 
        total_messages INTEGER DEFAULT 0, 
        last_xp_gain INTEGER DEFAULT 0, 
        games_played INTEGER DEFAULT 0, 
        games_won INTEGER DEFAULT 0, 
        total_winnings INTEGER DEFAULT 0, 
        gaming TEXT DEFAULT '{"game":"CODM","rank":"Unranked"}', 
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP, 
        last_daily INTEGER DEFAULT 0
    )`,
    
    server_settings: `CREATE TABLE IF NOT EXISTS server_settings (
        guild_id TEXT PRIMARY KEY, 
        prefix TEXT DEFAULT '.', 
        welcome_channel TEXT, 
        log_channel TEXT, 
        daily_channel TEXT, 
        shop_channel TEXT, 
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`,
    
    lydia_memory: `CREATE TABLE IF NOT EXISTS lydia_memory (
        user_id TEXT, memory_key TEXT, memory_value TEXT, 
        updated_at INTEGER DEFAULT (strftime('%s', 'now')), 
        PRIMARY KEY (user_id, memory_key)
    )`,
    
    lydia_agents: `CREATE TABLE IF NOT EXISTS lydia_agents (
        channel_id TEXT PRIMARY KEY, agent_key TEXT, 
        is_active INTEGER DEFAULT 0, updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`,
    
    user_inventory: `CREATE TABLE IF NOT EXISTS user_inventory (
        user_id TEXT, item_id TEXT, quantity INTEGER DEFAULT 1, 
        purchased_at INTEGER DEFAULT (strftime('%s', 'now')), 
        expires_at INTEGER, active INTEGER DEFAULT 1, 
        PRIMARY KEY (user_id, item_id)
    )`,
    
    lydia_introductions: `CREATE TABLE IF NOT EXISTS lydia_introductions (
        user_id TEXT, channel_id TEXT, 
        introduced_at INTEGER DEFAULT (strftime('%s', 'now')), 
        PRIMARY KEY (user_id, channel_id)
    )`,
    
    lydia_conversations: `CREATE TABLE IF NOT EXISTS lydia_conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT, user_id TEXT, user_name TEXT, 
        role TEXT, content TEXT, timestamp INTEGER DEFAULT (strftime('%s', 'now'))
    )`,
    
    reminders: `CREATE TABLE IF NOT EXISTS reminders (
        id TEXT PRIMARY KEY, 
        user_id TEXT NOT NULL, 
        channel_id TEXT NOT NULL, 
        message TEXT NOT NULL, 
        execute_at INTEGER NOT NULL, 
        status TEXT DEFAULT 'pending',
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`,
    
    warnings: `CREATE TABLE IF NOT EXISTS warnings (
        id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, user_id TEXT NOT NULL, 
        moderator_id TEXT NOT NULL, reason TEXT, 
        created_at INTEGER DEFAULT (strftime('%s', 'now')), 
        expires_at INTEGER, active INTEGER DEFAULT 1
    )`,
    
    moderation_logs: `CREATE TABLE IF NOT EXISTS moderation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        guild_id TEXT NOT NULL, user_id TEXT NOT NULL, moderator_id TEXT NOT NULL, 
        action TEXT NOT NULL, reason TEXT, warning_id TEXT, 
        timestamp INTEGER DEFAULT (strftime('%s', 'now'))
    )`,
    
    server_backups: `CREATE TABLE IF NOT EXISTS server_backups (
        id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, name TEXT, 
        data TEXT NOT NULL, created_by TEXT NOT NULL, 
        created_at INTEGER DEFAULT (strftime('%s', 'now')), 
        roles INTEGER, channels INTEGER
    )`,
    
    auto_backup_settings: `CREATE TABLE IF NOT EXISTS auto_backup_settings (
        guild_id TEXT PRIMARY KEY, enabled INTEGER DEFAULT 0, 
        last_backup INTEGER, channel_id TEXT
    )`,
    
    user_links: `CREATE TABLE IF NOT EXISTS user_links (
        telegram_id TEXT PRIMARY KEY,
        discord_id TEXT UNIQUE,
        linked_at INTEGER,
        UNIQUE(telegram_id, discord_id)
    )`,
    
    investments: `CREATE TABLE IF NOT EXISTS investments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        invested_at INTEGER NOT NULL,
        claimed INTEGER DEFAULT 0,
        total_profit INTEGER DEFAULT 0,
        platform TEXT DEFAULT 'discord'
    )`,
    
    transfers: `CREATE TABLE IF NOT EXISTS transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        platform TEXT DEFAULT 'discord'
    )`
};

for (const [tableName, createSQL] of Object.entries(requiredTables)) {
    try { 
        db.exec(createSQL); 
    } catch (err) {
        console.error(`${red}[TABLE ERROR]${reset} ${tableName}:`, err.message);
    }
}

// ================= SERVER SETTINGS UTILITY =================
const DEFAULT_SETTINGS = { prefix: PREFIX, welcomeChannel: null, logChannel: null, dailyChannel: null, shopChannel: null };

function getServerSettings(guildId) {
    if (client.settings.has(guildId)) return client.settings.get(guildId);
    
    try {
        let settings = db.prepare(`SELECT * FROM server_settings WHERE guild_id = ?`).get(guildId);
        if (!settings) {
            db.prepare(`INSERT INTO server_settings (guild_id, prefix) VALUES (?, ?)`).run(guildId, DEFAULT_SETTINGS.prefix);
            settings = { ...DEFAULT_SETTINGS, guild_id: guildId };
        }
        const result = {
            prefix: settings.prefix || DEFAULT_SETTINGS.prefix,
            welcomeChannel: settings.welcome_channel,
            logChannel: settings.log_channel,
            dailyChannel: settings.daily_channel,
            shopChannel: settings.shop_channel
        };
        client.settings.set(guildId, result);
        return result;
    } catch (err) {
        return DEFAULT_SETTINGS;
    }
}

function updateServerSetting(guildId, setting, value) {
    const columnMap = { prefix: 'prefix', welcome: 'welcome_channel', log: 'log_channel', daily: 'daily_channel', shop: 'shop_channel' };
    const column = columnMap[setting];
    if (!column) return false;
    
    try {
        db.prepare(`UPDATE server_settings SET ${column} = ?, updated_at = strftime('%s', 'now') WHERE guild_id = ?`).run(value, guildId);
        client.settings.delete(guildId);
        return true;
    } catch (err) {
        return false;
    }
}

client.getServerSettings = getServerSettings;
client.updateServerSetting = updateServerSetting;

// ================= HELPER FUNCTIONS =================
const getUser = (userId) => db.prepare("SELECT * FROM users WHERE id = ?").get(userId);

const initializeUser = (userId, username) => {
    const existing = getUser(userId);
    if (!existing) {
        db.prepare(`INSERT INTO users (id, username, xp, level, credits, streak_days, total_messages, last_xp_gain, games_played, games_won, total_winnings, gaming, created_at, last_seen, last_daily) VALUES (?, ?, 0, 1, 0, 0, 0, 0, 0, 0, 0, '{"game":"CODM","rank":"Unranked"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)`).run(userId, username);
    }
    return getUser(userId);
};

client.getUser = getUser;
client.initializeUser = initializeUser;
client.db = db;

// ================= OPTIMIZED DATABASE WRITE SYSTEM =================
client.pendingUserUpdates = new Map();
client.userDataCache = new Map();
client.batchWriteInterval = null;
client.cacheJanitorInterval = null;
client.reminderHeartbeatInterval = null;
client.lastBatchWrite = Date.now();

client.dbHealth = {
    consecutiveFailures: 0,
    circuitOpen: false,
    lastFailure: 0,
    cooldownUntil: 0
};

const WRITE_STRATEGY = {
    BATCH_SIZE: 50,
    MAX_WAIT_MS: 30000,
    RETRY_ATTEMPTS: 3,
    USE_TRANSACTIONS: true,
    BACKOFF_MULTIPLIER: 1.5,
    MIN_RETRY_DELAY: 1000,
    MAX_RETRY_DELAY: 30000,
    CIRCUIT_BREAKER_THRESHOLD: 5
};

const CACHE_CONFIG = {
    MAX_AGE_MS: 3600000,
    CLEANUP_INTERVAL_MS: 1800000,
    PRIORITY_USERS_TTL: 7200000
};

function cacheUserData(userId, userData) {
    client.userDataCache.set(userId, {
        ...userData,
        _cachedAt: Date.now(),
        _lastAccess: Date.now()
    });
}

function getUserData(userId) {
    const cached = client.userDataCache.get(userId);
    if (cached) {
        cached._lastAccess = Date.now();
        return cached;
    }
    
    const dbUser = getUser(userId);
    if (dbUser) {
        cacheUserData(userId, dbUser);
    }
    return dbUser;
}

function queueUserUpdate(userId, updateData) {
    let fullUserData = client.userDataCache.get(userId);
    
    if (!fullUserData) {
        fullUserData = getUser(userId);
        if (!fullUserData) {
            fullUserData = initializeUser(userId, updateData.username || 'Unknown');
        }
        cacheUserData(userId, fullUserData);
    }
    
    const mergedData = {
        ...fullUserData,
        ...updateData,
        _queuedAt: Date.now(),
        _lastAccess: Date.now()
    };
    
    client.pendingUserUpdates.set(userId, mergedData);
    cacheUserData(userId, mergedData);
    
    if (client.pendingUserUpdates.size >= WRITE_STRATEGY.BATCH_SIZE) {
        flushUserUpdates(0);
    }
}

async function flushUserUpdates(retryCount = 0, retryId = null) {
    if (client.dbHealth.circuitOpen) {
        if (Date.now() < client.dbHealth.cooldownUntil) {
            console.log(`${yellow}[DB CIRCUIT]${reset} Circuit open - writes paused`);
            return;
        } else {
            console.log(`${cyan}[DB CIRCUIT]${reset} Testing connection - circuit half-open`);
            client.dbHealth.circuitOpen = false;
        }
    }
    
    const operationId = retryId || `${Date.now()}-${Math.random()}`;
    if (client._activeFlush === operationId) {
        console.log(`${yellow}[DB BATCH]${reset} Preventing duplicate flush operation`);
        return;
    }
    client._activeFlush = operationId;
    
    if (client.pendingUserUpdates.size === 0) {
        client._activeFlush = null;
        return;
    }
    
    const updates = Array.from(client.pendingUserUpdates.entries());
    client.pendingUserUpdates.clear();
    
    try {
        if (WRITE_STRATEGY.USE_TRANSACTIONS) {
            client.safeDbWrite(() => {
                const updateStmt = db.prepare(`
                    INSERT OR REPLACE INTO users (
                        id, username, xp, level, total_messages, last_xp_gain, 
                        games_played, games_won, total_winnings, gaming, credits, streak_days, last_daily
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                
                db.transaction(() => {
                    for (const [userId, userData] of updates) {
                        let gamingValue = userData.gaming;
                        if (typeof gamingValue === 'object' && gamingValue !== null) {
                            gamingValue = JSON.stringify(gamingValue);
                        } else if (!gamingValue) {
                            gamingValue = '{"game":"CODM","rank":"Unranked"}';
                        }
                        
                        updateStmt.run(
                            userId,
                            userData.username || 'Unknown',
                            userData.xp ?? 0,
                            userData.level ?? 1,
                            userData.total_messages ?? 0,
                            userData.last_xp_gain ?? 0,
                            userData.games_played ?? 0,
                            userData.games_won ?? 0,
                            userData.total_winnings ?? 0,
                            gamingValue,
                            userData.credits ?? 0,
                            userData.streak_days ?? 0,
                            userData.last_daily ?? 0
                        );
                    }
                })();
                
                return true;
            });
        }
        
        client.dbHealth.consecutiveFailures = 0;
        client.dbHealth.circuitOpen = false;
        client.lastBatchWrite = Date.now();
        client._activeFlush = null;
        
        console.log(`${green}[DB BATCH]${reset} Flushed ${updates.length} user updates`);
        
    } catch (err) {
        client._activeFlush = null;
        client.dbHealth.consecutiveFailures++;
        client.dbHealth.lastFailure = Date.now();
        
        console.error(`${red}[DB BATCH ERROR]${reset}`, err.message);
        
        if (client.dbHealth.consecutiveFailures >= WRITE_STRATEGY.CIRCUIT_BREAKER_THRESHOLD) {
            client.dbHealth.circuitOpen = true;
            client.dbHealth.cooldownUntil = Date.now() + 60000;
            console.error(`${red}[DB CIRCUIT]${reset} BREAKER TRIPPED - Pausing all writes for 60s`);
        }
        
        if (retryCount < WRITE_STRATEGY.RETRY_ATTEMPTS && !client.dbHealth.circuitOpen) {
            const delay = Math.min(
                WRITE_STRATEGY.MIN_RETRY_DELAY * Math.pow(WRITE_STRATEGY.BACKOFF_MULTIPLIER, retryCount),
                WRITE_STRATEGY.MAX_RETRY_DELAY
            );
            
            console.log(`${yellow}[DB BATCH]${reset} Retrying in ${delay}ms (attempt ${retryCount + 1}/${WRITE_STRATEGY.RETRY_ATTEMPTS})`);
            
            for (const [userId, userData] of updates) {
                if (!client.pendingUserUpdates.has(userId)) {
                    client.pendingUserUpdates.set(userId, { ...userData, _retryCount: retryCount + 1 });
                }
            }
            
            const timeoutId = setTimeout(() => {
                flushUserUpdates(retryCount + 1, operationId);
            }, delay);
            
            if (!client._retryTimeouts) client._retryTimeouts = new Set();
            client._retryTimeouts.add(timeoutId);
            setTimeout(() => client._retryTimeouts.delete(timeoutId), delay + 1000);
            
        } else {
            console.error(`${red}[DB BATCH]${reset} Max retries exceeded. ${updates.length} updates moved to dead letter queue.`);
            
            if (!client._deadLetterQueue) client._deadLetterQueue = [];
            updates.forEach(([userId, userData]) => {
                client._deadLetterQueue.push({
                    userId,
                    data: userData,
                    failedAt: Date.now(),
                    attempts: retryCount + 1
                });
            });
            
            if (client._deadLetterQueue.length > 1000) {
                client._deadLetterQueue = client._deadLetterQueue.slice(-1000);
            }
        }
    }
}

function startBatchWriteInterval() {
    if (client.batchWriteInterval) clearInterval(client.batchWriteInterval);
    client.batchWriteInterval = setInterval(() => {
        if (client.pendingUserUpdates.size > 0) {
            flushUserUpdates(0);
        }
    }, WRITE_STRATEGY.MAX_WAIT_MS);
}

function startReminderHeartbeat() {
    if (client.reminderHeartbeatInterval) clearInterval(client.reminderHeartbeatInterval);
    
    client.reminderHeartbeatInterval = setInterval(async () => {
        const now = Math.floor(Date.now() / 1000);
        const dueReminders = db.prepare(`SELECT id, user_id, channel_id, message FROM reminders WHERE execute_at <= ? AND status = 'pending'`).all(now);
        
        for (const r of dueReminders) {
            try {
                const channel = await client.channels.fetch(r.channel_id).catch(() => null);
                if (channel) {
                    await channel.send(`⏰ **REMINDER** <@${r.user_id}> : ${r.message}`);
                    console.log(`${green}[REMINDER]${reset} Sent to ${r.user_id}`);
                }
                db.prepare(`UPDATE reminders SET status = 'sent' WHERE id = ?`).run(r.id);
            } catch (err) {
                console.error(`${red}[REMINDER ERROR]${reset}`, err.message);
            }
        }
        
        const weekAgo = now - (7 * 86400);
        db.prepare(`DELETE FROM reminders WHERE execute_at < ? AND status != 'pending'`).run(weekAgo);
    }, 30000);
    
    console.log(`${green}[REMINDER]${reset} Heartbeat started (30s interval)`);
}

function pruneUserCache() {
    const now = Date.now();
    let prunedCount = 0;
    
    for (const [userId, userData] of client.userDataCache.entries()) {
        if (client.pendingUserUpdates.has(userId)) continue;
        
        const lastAccess = userData._lastAccess || userData._cachedAt || 0;
        if (now - lastAccess > CACHE_CONFIG.MAX_AGE_MS) {
            client.userDataCache.delete(userId);
            prunedCount++;
        }
    }
    
    if (prunedCount > 0) {
        console.log(`${yellow}[CACHE]${reset} Janitor removed ${prunedCount} stale users`);
    }
}

function startCacheJanitor() {
    if (client.cacheJanitorInterval) clearInterval(client.cacheJanitorInterval);
    client.cacheJanitorInterval = setInterval(() => pruneUserCache(), CACHE_CONFIG.CLEANUP_INTERVAL_MS);
    console.log(`${green}[CACHE]${reset} Janitor started (30min cleanup, 1h TTL)`);
}

client.queueUserUpdate = queueUserUpdate;
client.flushUserUpdates = flushUserUpdates;
client.getUserData = getUserData;
client.cacheUserData = cacheUserData;

// ================= EXPANDED SHOP ITEMS =================
client.shopItems = [
    { 
        id: 'starter_pack', 
        price: 500, 
        emoji: '📦', 
        type: 'consumable', 
        effect: { xp: 100, credits: 50 },
        en: { name: 'New Recruit Pack', desc: 'A small boost for new agents.', perk: '+100 XP & +50 Credits' },
        fr: { name: 'Pack Nouvelle Recrue', desc: 'Un petit boost pour les nouveaux agents.', perk: '+100 XP & +50 Crédits' } 
    },
    { 
        id: 'xp_boost_small', 
        price: 500, 
        emoji: '⚡', 
        type: 'consumable', 
        effect: { xp: 250 },
        en: { name: 'XP Boost (Small)', desc: 'Quick neural enhancement.', perk: '+250 XP' },
        fr: { name: 'Boost XP (Petit)', desc: 'Amélioration neurale rapide.', perk: '+250 XP' } 
    },
    { 
        id: 'xp_boost_large', 
        price: 2000, 
        emoji: '⚡⚡', 
        type: 'consumable', 
        effect: { xp: 1000 },
        en: { name: 'Quantum XP Overdrive', desc: 'Massive XP injection.', perk: '+1000 XP instantly' },
        fr: { name: 'Overdrive XP Quantique', desc: 'Injection massive d\'XP.', perk: '+1000 XP instantanément' } 
    },
    { 
        id: 'credit_boost_small', 
        price: 300, 
        emoji: '🪙', 
        type: 'consumable', 
        effect: { credits: 200 },
        en: { name: 'Credit Injection', desc: 'Small credit boost.', perk: '+200 Credits' },
        fr: { name: 'Injection de Crédits', desc: 'Petit boost de crédits.', perk: '+200 Crédits' } 
    },
    { 
        id: 'credit_boost_large', 
        price: 1500, 
        emoji: '💰', 
        type: 'consumable', 
        effect: { credits: 1000 },
        en: { name: 'Credit Surge', desc: 'Major credit injection.', perk: '+1000 Credits' },
        fr: { name: 'Afflux de Crédits', desc: 'Injection majeure de crédits.', perk: '+1000 Crédits' } 
    },
    { 
        id: 'vip_role', 
        price: 10000, 
        emoji: '💎', 
        type: 'role',
        roleId: process.env.VIP_ROLE_ID,
        requirement: { level: 25 },
        en: { name: 'VIP Status', desc: 'Exclusive VIP role and perks.', perk: 'VIP Role + Special Channel Access' },
        fr: { name: 'Statut VIP', desc: 'Rôle VIP exclusif et avantages.', perk: 'Rôle VIP + Accès Salon Spécial' } 
    },
    { 
        id: 'verified_role', 
        price: 5000, 
        emoji: '✅', 
        type: 'role',
        roleId: process.env.VERIFIED_ROLE_ID,
        requirement: { level: 10 },
        en: { name: 'Verified Agent', desc: 'Verified status in the community.', perk: 'Verified Role + Trust Badge' },
        fr: { name: 'Agent Vérifié', desc: 'Statut vérifié dans la communauté.', perk: 'Rôle Vérifié + Badge de Confiance' } 
    },
    { 
        id: 'badge_pioneer', 
        price: 8000, 
        emoji: '🏅', 
        type: 'badge',
        requirement: { level: 5 },
        en: { name: 'Pioneer Badge', desc: 'Shows on your profile.', perk: '🏅 Pioneer Badge' },
        fr: { name: 'Badge Pionnier', desc: 'Affiché sur votre profil.', perk: '🏅 Badge Pionnier' } 
    },
    { 
        id: 'badge_bamako', 
        price: 10000, 
        emoji: '🇲🇱', 
        type: 'badge',
        requirement: { level: 15 },
        en: { name: 'Bamako Pride Badge', desc: 'Mali heritage badge.', perk: '🇲🇱 Bamako Pride Badge' },
        fr: { name: 'Badge Fierté Bamako', desc: 'Badge héritage malien.', perk: '🇲🇱 Badge Fierté Bamako' } 
    },
    { 
        id: 'mystery_box_bronze', 
        price: 1000, 
        emoji: '🎁', 
        type: 'consumable',
        effect: { 
            random: [
                { xp: 100 }, { xp: 200 }, { credits: 100 }, 
                { credits: 200 }, { xp: 50, credits: 50 }
            ] 
        },
        en: { name: 'Bronze Mystery Box', desc: 'Contains random rewards!', perk: 'Random XP or Credits' },
        fr: { name: 'Boîte Mystère Bronze', desc: 'Contient des récompenses aléatoires !', perk: 'XP ou Crédits Aléatoires' } 
    },
    { 
        id: 'daily_streak_shield', 
        price: 2000, 
        emoji: '🛡️', 
        type: 'consumable',
        effect: { streak_protection: true },
        en: { name: 'Streak Shield', desc: 'Protects your daily streak if missed.', perk: '1x Streak Protection' },
        fr: { name: 'Bouclier de Série', desc: 'Protège votre série quotidienne.', perk: '1x Protection de Série' } 
    }
];

client.getItem = (itemId) => client.shopItems.find(item => item.id === itemId);

// ================= CATEGORY EMOJI HELPER =================
function getCategoryEmoji(category) {
    const emojiMap = {
        'SYSTEM': '⚙️', 'GAMING': '🎮', 'AI': '🧠', 'PROFILE': '👤',
        'OWNER': '👑', 'GENERAL': '📁', 'UTILITY': '🛠️', 'MODERATION': '🛡️',
        'ECONOMY': '💰', 'FUN': '🎉'
    };
    return emojiMap[category.toUpperCase()] || '📦';
}

// ================= TELEGRAM BRIDGE v1.7.0 =================
// The outgoing bridge (Core) - Discord → Telegram
const telegramBridge = require('./telegram/bridge.js');
client.telegramBridge = telegramBridge.initialize(client);

// The incoming listener (Bot) - Telegram → Discord
const telegramBot = require('./telegram/bot.js');
telegramBot.initialize(client);

const bridgeStatus = client.telegramBridge.status();
if (bridgeStatus.configured) {
    console.log(`${cyan}[TELEGRAM]${reset} Bridge v1.7.0 configured - Auto-activating on boot`);
} else {
    console.log(`${yellow}[TELEGRAM]${reset} Bridge not configured - Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to .env`);
}

// ================= PLUGIN LOADER - NEURAL GRID EDITION =================
client.loadPlugins = async () => {
    client.commands.clear();
    client.aliases.clear();
    
    const pluginPath = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginPath)) fs.mkdirSync(pluginPath);

    const pluginFiles = fs.readdirSync(pluginPath).filter(file => file.endsWith('.js') && file !== 'lydia.js');
    
    console.log(`\n${cyan}${bold}╔══════════════════════════════════════════════════════════════════╗${reset}`);
    console.log(`${cyan}${bold}║${reset}  ${yellow}🦅 ARCHITECT CG-223 NEURAL SYNAPSE // MODULE SYNCHRONIZATION${reset}  ${cyan}${bold}║${reset}`);
    console.log(`${cyan}${bold}╠══════════════════════════════════════════════════════════════════╣${reset}`);
    console.log(`${cyan}${bold}║${reset}  ${green}📡 Establishing neural links to command modules...${reset}          ${cyan}${bold}║${reset}`);
    console.log(`${cyan}${bold}╠══════════════════════════════════════════════════════════════════╣${reset}`);
    
    const loadedCommands = [];
    const failedCommands = [];
    
    // Load Discord plugins
    for (const file of pluginFiles) {
        try {
            await sleep(80);
            const filePath = path.join(pluginPath, file);
            delete require.cache[require.resolve(filePath)];
            const command = require(filePath);

            if (command.name && command.run) {
                client.commands.set(command.name, command);
                if (command.aliases && Array.isArray(command.aliases)) {
                    command.aliases.forEach(a => client.aliases.set(a, command.name));
                }
                
                const category = command.category || 'GENERAL';
                const aliasesCount = command.aliases?.length || 0;
                loadedCommands.push({ 
                    name: command.name, 
                    category, 
                    aliases: aliasesCount,
                    emoji: getCategoryEmoji(category)
                });
            }
        } catch (error) { 
            failedCommands.push({ file, error: error.message });
        }
    }
    
    // Load Telegram plugins
    const telegramPath = path.join(__dirname, 'telegram');
    if (fs.existsSync(telegramPath)) {
        const telegramFiles = fs.readdirSync(telegramPath).filter(file => file.endsWith('.js') && file !== 'bridge.js' && file !== 'bot.js');
        
        for (const file of telegramFiles) {
            try {
                await sleep(80);
                const filePath = path.join(telegramPath, file);
                delete require.cache[require.resolve(filePath)];
                const command = require(filePath);

                if (command.name && command.run) {
                    client.commands.set(command.name, command);
                    if (command.aliases && Array.isArray(command.aliases)) {
                        command.aliases.forEach(a => client.aliases.set(a, command.name));
                    }
                    
                    const category = command.category || 'SYSTEM';
                    const aliasesCount = command.aliases?.length || 0;
                    loadedCommands.push({ 
                        name: command.name, 
                        category, 
                        aliases: aliasesCount,
                        emoji: getCategoryEmoji(category)
                    });
                }
            } catch (error) { 
                failedCommands.push({ file: `telegram/${file}`, error: error.message });
            }
        }
    }
    
    // Grid Display
    const itemsPerRow = 3;
    
    loadedCommands.sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.name.localeCompare(b.name);
    });
    
    for (let i = 0; i < loadedCommands.length; i += itemsPerRow) {
        const row = loadedCommands.slice(i, i + itemsPerRow);
        let rowText = `${cyan}${bold}║${reset}  `;
        
        row.forEach(cmd => {
            const displayName = cmd.name.length > 12 ? cmd.name.substring(0, 10) + '..' : cmd.name.padEnd(12);
            const aliasInfo = cmd.aliases > 0 ? `${cmd.aliases}` : '—';
            rowText += `${cmd.emoji} ${green}${displayName}${reset} ${yellow}[${aliasInfo}]${reset}`.padEnd(26);
        });
        
        const emptySlots = itemsPerRow - row.length;
        if (emptySlots > 0) rowText += ' '.repeat(emptySlots * 26);
        
        console.log(`${rowText} ${cyan}${bold}║${reset}`);
    }
    
    console.log(`${cyan}${bold}╠══════════════════════════════════════════════════════════════════╣${reset}`);
    
    const totalAliases = client.aliases.size;
    const categories = [...new Set(loadedCommands.map(c => c.category))];
    
    console.log(`${cyan}${bold}║${reset}  ${green}✅ VERIFIED:${reset} ${loadedCommands.length} modules ${yellow}│${reset} ${blue}🔀 Aliases:${reset} ${totalAliases} ${yellow}│${reset} ${magenta}📂 Categories:${reset} ${categories.length}      ${cyan}${bold}║${reset}`);
    console.log(`${cyan}${bold}╠══════════════════════════════════════════════════════════════════╣${reset}`);
    
    const categoryCount = {};
    loadedCommands.forEach(c => categoryCount[c.category] = (categoryCount[c.category] || 0) + 1);
    
    let categoryLine = `${cyan}${bold}║${reset}  `;
    const categoryEntries = Object.entries(categoryCount).sort((a, b) => b[1] - a[1]).slice(0, 6);
    
    categoryEntries.forEach(([cat, count]) => {
        const emoji = getCategoryEmoji(cat);
        categoryLine += `${emoji} ${cat.substring(0, 6)}:${count}  `;
    });
    
    console.log(`${categoryLine}${' '.repeat(Math.max(0, 64 - categoryLine.length + 10))}${cyan}${bold}║${reset}`);
    
    if (failedCommands.length > 0) {
        console.log(`${cyan}${bold}╠══════════════════════════════════════════════════════════════════╣${reset}`);
        failedCommands.forEach(f => {
            console.log(`${cyan}${bold}║${reset}  ${red}❌ FAILED:${reset} ${f.file} ${yellow}→${reset} ${f.error.substring(0, 40)}${' '.repeat(Math.max(0, 40 - f.error.length))} ${cyan}${bold}║${reset}`);
        });
    }
    
    console.log(`${cyan}${bold}╠══════════════════════════════════════════════════════════════════╣${reset}`);
    console.log(`${cyan}${bold}║${reset}  ${yellow}📍 NODE:${reset} BAMAKO_223 🇲🇱 ${' '.repeat(28)}${green}🚀 ENGINE READY${reset}  ${cyan}${bold}║${reset}`);
    console.log(`${cyan}${bold}╚══════════════════════════════════════════════════════════════════╝${reset}\n`);
};

// ================= SMART PLUGIN EXECUTION WRAPPER =================
async function executePluginCommand(command, client, message, args, db, usedCommand) {
    const runFunc = command.run;
    const funcStr = runFunc.toString();
    const params = funcStr.slice(funcStr.indexOf('(') + 1, funcStr.indexOf(')')).split(',').map(p => p.trim());
    
    const serverSettings = message.guild ? getServerSettings(message.guild.id) : DEFAULT_SETTINGS;
    
    const argsMap = { client, message, args, db, usedCommand, serverSettings };
    const filteredArgs = params.map(param => argsMap[param]).filter(arg => arg !== undefined);
    
    return await runFunc(...filteredArgs);
}

// ================= BOOT SEQUENCE =================
client.once(Events.ClientReady, async () => {
    console.clear();
    await client.loadPlugins();
    
    startBatchWriteInterval();
    startReminderHeartbeat();
    startCacheJanitor();
    
    // 🔥 AUTO-ACTIVATE TELEGRAM BRIDGE ON BOOT
    if (client.telegramBridge && client.telegramBridge.status) {
        const status = client.telegramBridge.status();
        if (status.configured) {
            const result = client.telegramBridge.activate();
            if (result.success) {
                console.log(`${green}[TELEGRAM]${reset} Bridge auto-activated on boot - BAMAKO_223 🇲🇱 connected`);
            } else {
                console.log(`${yellow}[TELEGRAM]${reset} Bridge activation failed: ${result.error}`);
            }
        }
    }
    
    // 🔥 DISPLAY CURRENT MARKET TREND ON BOOT (SAFE VERSION)
    try {
        const marketState = getMarketState();
        const trend = TRENDS[marketState.trend] || TRENDS.STEADY;
        console.log(`${green}[MARKET]${reset} Current trend: ${trend.emoji} ${trend.name} (${(marketState.multiplier * 100).toFixed(1)}%)`);
    } catch (err) {
        console.log(`${yellow}[MARKET]${reset} Could not display market trend - using default`);
        console.log(`${green}[MARKET]${reset} Current trend: 📊 Steady Market (100.0%)`);
    }
    
 // 🔥 CONFIGURATION RESPONSIVE (PC & MOBILE)
const boxWidth = 48; // Réduit de 64 à 48 pour ne pas casser sur Phone
const drawBoxLine = (label, value) => {
    const lineContent = `║  ${label.padEnd(12)} : ${value}`;
    // Calcul dynamique pour que la ligne ║ de droite soit toujours alignée
    const spacing = Math.max(0, boxWidth - lineContent.length - 1);
    return `${lineContent}${' '.repeat(spacing)}║`;
};

    console.log(`\n${blue}${bold}╔${'═'.repeat(boxWidth - 2)}╗${reset}`);
const title = "🦅 ARCHITECT CG-223 // NEURAL ENGINE";
const padding = Math.max(0, Math.floor((boxWidth - title.length - 2) / 2));
console.log(`${blue}${bold}║${' '.repeat(padding)}${cyan}${title}${reset}${' '.repeat(boxWidth - title.length - padding - 2)}║${reset}`);
console.log(`${blue}${bold}╠${'═'.repeat(boxWidth - 2)}╣${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}🤖 CLIENT`, client.user.tag)}${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}📍 NODE`, 'BAMAKO_223 🇲🇱')}${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}📦 VERSION`, `v${client.version}`)}${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}🔗 REPOSITORY`, 'github.com/MFOF7310')}${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}🏗️ ARCHITECT`, 'MOUSSA FOFANA')}${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}💾 DB MODE`, 'WAL • High Performance')}${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}💾 DB BATCH`, `${WRITE_STRATEGY.MAX_WAIT_MS/1000}s delay`)}${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}🔔 REMINDERS`, `30s heartbeat`)}${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}💤 AFK SYSTEM`, `ACTIVE`)}${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}🛡️ CIRCUIT BREAKER`, `READY`)}${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}🧠 LYDIA`, `MULTI-AGENT AI`)}${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}🌉 TELEGRAM`, client.telegramBridge?.enabled ? 'ACTIVE' : 'STANDBY')}${reset}`);
    
    try {
        const marketState = getMarketState();
        const trend = TRENDS[marketState.trend] || TRENDS.STEADY;
        console.log(`${blue}${bold}${drawBoxLine(`${green}📊 MARKET`, `${trend.emoji} ${trend.name}`)}${reset}`);
    } catch (err) {
        console.log(`${blue}${bold}${drawBoxLine(`${green}📊 MARKET`, `📊 Steady Market`)}${reset}`);
    }
    
    console.log(`${blue}${bold}╚${'═'.repeat(boxWidth - 2)}╝${reset}\n`);

    if (client.userTimeouts) {
        for (const [id, timeout] of client.userTimeouts) clearTimeout(timeout);
        client.userTimeouts.clear();
    }

    try {
        const owner = await client.users.fetch(process.env.OWNER_ID);
        
        let trend = TRENDS.STEADY;
        let marketState = { trend: 'STEADY', multiplier: 1.0 };
        try {
            marketState = getMarketState();
            trend = TRENDS[marketState.trend] || TRENDS.STEADY;
        } catch (err) {}
        
        const bootEmbed = new EmbedBuilder()
            .setColor(trend.color || '#2ecc71')
            .setAuthor({ name: '🦅 ARCHITECT CG-223 // NEURAL ENGINE ONLINE', iconURL: client.user.displayAvatarURL() })
            .setTitle('⚡ NEURAL ENGINE BOOT COMPLETE')
            .setDescription(
                `\`\`\`ansi\n` +
                `\u001b[1;32m${"━".repeat(30)}\u001b[0m\n` +
                `\u001b[1;36mSystem:\u001b[0m reboot complete\n` +
                `\u001b[1;34mModules:\u001b[0m ${client.commands.size} plugins synced\n` +
                `\u001b[1;35mVersion:\u001b[0m v${client.version}\n` +
                `\u001b[1;33mNode:\u001b[0m BAMAKO_223 🇲🇱\n` +
                `\u001b[1;36mListeners:\u001b[0m ${client.listenerCount('messageCreate')} active\n` +
                `\u001b[1;32mDatabase:\u001b[0m WAL Mode (High Performance)\n` +
                `\u001b[1;35mAFK System:\u001b[0m ACTIVE\n` +
                `\u001b[1;33mCircuit Breaker:\u001b[0m READY\n` +
                `\u001b[1;36mLydia AI:\u001b[0m MULTI-AGENT ACTIVE\n` +
                `\u001b[1;36mTelegram:\u001b[0m ${client.telegramBridge?.enabled ? 'ACTIVE' : 'STANDBY'}\n` +
                `\u001b[1;33mMarket:\u001b[0m ${trend.emoji} ${trend.name} (${(marketState.multiplier * 100).toFixed(1)}%)\n` +
                `\u001b[1;32m${"━".repeat(30)}\u001b[0m\n` +
                `\`\`\``
            )
            .addFields(
                { name: '🔗 Repository', value: '```ansi\n\u001b[1;36mgithub.com/MFOF7310\u001b[0m\n```', inline: true },
                { name: '🏗️ Architect', value: '```ansi\n\u001b[1;33mMoussa Fofana\u001b[0m\n```', inline: true },
                { name: '🕐 Boot Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            )
            .setFooter({ text: `ARCHITECT CG-223 • Neural Engine v${client.version}`, iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        await owner.send({ embeds: [bootEmbed] });
        console.log(`${green}[DM]${reset} ✅ Boot DM sent successfully to ${owner.tag}`);
    } catch (err) {
        console.log(`${yellow}[DM]${reset} ❌ Could not send boot DM: ${err.message}`);
    }
});

// ================= MESSAGE PROCESSING =================
client.on(Events.MessageCreate, async (message) => {
    if (!message || message.author?.bot || message.webhookId) return;

    const userId = message.author.id;
    let userData = getUserData(userId);
    
    if (!userData) {
        userData = initializeUser(userId, message.author.username);
        cacheUserData(userId, userData);
    }

    if (message.mentions.users.size > 0) {
        const messageContent = message.content || '';
        const lang = detectLanguage(messageContent);
        
        for (const [mentionedId, user] of message.mentions.users) {
            if (afkUsers.has(mentionedId)) {
                const afkData = afkUsers.get(mentionedId);
                const minutes = Math.floor((Date.now() - afkData.timestamp) / 60000);
                const timeText = minutes === 0 ? (lang === 'fr' ? 'à l\'instant' : 'just now') : `${minutes} min`;
                
                const mentionMsg = lang === 'fr'
                    ? `💤 **${user.username}** est AFK (${timeText}): *${afkData.reason}*`
                    : `💤 **${user.username}** is AFK (${timeText}): *${afkData.reason}*`;
                
                await message.reply({ content: mentionMsg, allowedMentions: { repliedUser: true } }).catch(() => {});
                break;
            }
        }
    }

    if (afkUsers.has(message.author.id)) {
        const afkData = afkUsers.get(message.author.id);
        const minutes = Math.floor((Date.now() - afkData.timestamp) / 60000);
        
        afkUsers.delete(message.author.id);
        
        const messageContent = message.content || '';
        const lang = detectLanguage(messageContent);
        
        const welcomeMsg = lang === 'fr'
            ? `👋 Bon retour **${message.author.username}**! AFK retiré (${minutes} min).`
            : `👋 Welcome back **${message.author.username}**! AFK removed (${minutes} min).`;
        
        await message.reply({ content: welcomeMsg }).catch(() => {});
        console.log(`[AFK] ${message.author.tag} returned after ${minutes} min`);
    }

    const now = Date.now();
    const cooldown = 60000;

    if (now - (userData.last_xp_gain || 0) > cooldown) {
        const xpGain = Math.floor(Math.random() * 21) + 15;
        const newXP = (userData.xp || 0) + xpGain;
        const newLevel = Math.floor(0.1 * Math.sqrt(newXP)) + 1;
        const totalMsgs = (userData.total_messages || 0) + 1;

        userData.xp = newXP;
        userData.level = newLevel;
        userData.total_messages = totalMsgs;
        userData.last_xp_gain = now;

        queueUserUpdate(userId, {
            ...userData,
            username: message.author.username,
            xp: newXP,
            level: newLevel,
            total_messages: totalMsgs,
            last_xp_gain: now,
        });

        if (newLevel > (userData.level || 1)) {
            await message.channel.send({ content: `🎉 **LEVEL UP!** <@${userId}> reached Level ${newLevel}!` });
        }
    }

    const serverSettings = message.guild ? getServerSettings(message.guild.id) : DEFAULT_SETTINGS;
    const effectivePrefix = serverSettings.prefix || PREFIX;
    
    if (message.content.startsWith(effectivePrefix)) {
        const args = message.content.slice(effectivePrefix.length).trim().split(/ +/);
        const cmdName = args.shift().toLowerCase();
        const usedCommand = cmdName;
        
        let command = client.commands.get(cmdName) || client.commands.get(client.aliases.get(cmdName));
        
        if (!command && (cmdName === 'lydia' || cmdName === 'ai' || cmdName === 'neural' || cmdName === 'ia')) {
            try {
                const lydiaModule = require('./plugins/lydia.js');
                await lydiaModule.run(client, message, args, db, serverSettings, usedCommand);
                return;
            } catch (e) {
                console.error(`${red}[LYDIA ERROR]${reset}`, e);
                return message.reply("❌ Lydia command execution failed.");
            }
        }

        if (command) {
            try {
                await executePluginCommand(command, client, message, args, db, usedCommand);
                return;
            } catch (e) { 
                console.error(`${red}[COMMAND ERROR]${reset} ${cmdName}:`, e);
                const lang = detectLanguage(usedCommand || cmdName);
                const errorMsg = lang === 'fr' ? "⚠️ **Échec de l'exécution de la commande.**" : "⚠️ **Command execution failed.**";
                return message.reply(errorMsg).catch(() => {});
            }
        }
    }
});

// ================= INTERACTION HANDLER =================
client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) {
        console.log(`${cyan}[SLASH]${reset} ${interaction.commandName} from ${interaction.user.tag}`);
        return;
    }
    
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
        console.log(`${cyan}[INTERACTION]${reset} ${interaction.customId} from ${interaction.user.tag}`);
        
        // 🛑 BYPASS : On laisse help.js gérer ses propres interactions sans "Thinking"
        if (interaction.customId.startsWith('help_')) return;

        const needsNewMessage = interaction.customId.startsWith('info_') || 
                                interaction.customId.startsWith('menu_') ||
                                interaction.customId === 'welcome_help';
        
        const needsEphemeral = interaction.customId.includes('private') || 
                               interaction.customId.includes('secret') ||
                               interaction.customId === 'welcome_help';
        
        if (!interaction.deferred && !interaction.replied) {
            try {
                if (needsNewMessage) {
                    await interaction.deferReply({ ephemeral: needsEphemeral });
                    console.log(`${green}[INTERACTION]${reset} Deferred reply for ${interaction.customId}`);
                } else {
                    await interaction.deferUpdate();
                    console.log(`${green}[INTERACTION]${reset} Deferred update for ${interaction.customId}`);
                }
            } catch (err) {
                if (!err.message.includes('already been acknowledged')) {
                    console.error(`${red}[INTERACTION ERROR]${reset} Failed to defer:`, err.message);
                }
                return;
            }
        }
        
        if (interaction.customId === 'welcome_help') {
            const lang = interaction.guild?.preferredLocale === 'fr' ? 'fr' : 'en';
            
            const helpEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle(lang === 'fr' ? '🤖 Aide - Commandes Disponibles' : '🤖 Help - Available Commands')
                .setDescription(lang === 'fr' ? 'Voici les commandes essentielles pour débuter:' : 'Here are the essential commands to get started:')
                .addFields(
                    { name: '📌 ' + (lang === 'fr' ? 'Commandes Générales' : 'General Commands'), value: lang === 'fr' ? '`.help` - Affiche cette aide\n`.profile` - Voir ton profil\n`.daily` - Réclamer ta récompense quotidienne' : '`.help` - Show this help\n`.profile` - View your profile\n`.daily` - Claim daily reward', inline: false },
                    { name: '🤖 ' + (lang === 'fr' ? 'Assistant IA (Lydia)' : 'AI Assistant (Lydia)'), value: lang === 'fr' ? '`.lydia [message]` - Parler à Lydia\n`.ia [message]` - Alias\n`.lydia activate` - Activer dans ce salon' : '`.lydia [message]` - Talk to Lydia\n`.ai [message]` - Alias\n`.lydia activate` - Activate in this channel', inline: false },
                    { name: '🎮 ' + (lang === 'fr' ? 'Jeux & Économie' : 'Games & Economy'), value: lang === 'fr' ? '`.shop` - Boutique d\'objets\n`.balance` - Voir tes crédits\n`.gaming set [jeu]` - Définir ton jeu' : '`.shop` - Item shop\n`.balance` - Check credits\n`.gaming set [game]` - Set your game', inline: false },
                    { name: '🌉 ' + (lang === 'fr' ? 'Pont Telegram' : 'Telegram Bridge'), value: lang === 'fr' ? '`.telegram status` - État du pont\n`.telegram activate` - Activer\n`.telegram send <msg>` - Envoyer message' : '`.telegram status` - Bridge status\n`.telegram activate` - Activate\n`.telegram send <msg>` - Send message', inline: false }
                )
                .setFooter({ text: lang === 'fr' ? 'Eagle Community • Tape .help pour plus' : 'Eagle Community • Type .help for more', iconURL: client.user.displayAvatarURL() });
            
            await interaction.editReply({ embeds: [helpEmbed] });
            console.log(`${green}[INTERACTION]${reset} Sent welcome help to ${interaction.user.tag}`);
            return;
        }
    }
    
    if (interaction.isModalSubmit()) {
        console.log(`${cyan}[MODAL]${reset} ${interaction.customId} submitted by ${interaction.user.tag}`);
        
        if (!interaction.deferred && !interaction.replied) {
            try {
                await interaction.deferReply({ ephemeral: true });
            } catch (err) {
                if (!err.message.includes('already been acknowledged')) {
                    console.error(`${red}[MODAL ERROR]${reset} Failed to defer:`, err.message);
                }
                return;
            }
        }
        
        await interaction.editReply({ content: '✅ Modal submitted successfully!' });
    }
});

// ================= 🔥 ULTRA PROFESSIONAL GUARDIAN WELCOME SYSTEM =================
client.on(Events.GuildMemberAdd, async (member) => {
    if (member.user.bot) return;
    
    const settings = getServerSettings(member.guild.id);
    const welcomeChannel = member.guild.channels.cache.get(settings.welcomeChannel || process.env.WELCOME_CHANNEL_ID);
    const logChannel = member.guild.channels.cache.get(settings.logChannel || process.env.LOG_CHANNEL_ID);
    
    const RULES_CHANNEL_ID = process.env.RULES_CHANNEL_ID;
    const GENERAL_CHANNEL_ID = process.env.GENERAL_CHANNEL_ID;
    const MEMBER_ROLE_ID = process.env.MEMBER_ROLE;
    
    const memberCount = member.guild.memberCount;
    const accountAge = Date.now() - member.user.createdTimestamp;
    const accountAgeDays = Math.floor(accountAge / (1000 * 60 * 60 * 24));
    const isNewAccount = accountAgeDays < 7;
    const lang = member.guild.preferredLocale === 'fr' ? 'fr' : 'en';
    
    // Add member role if configured
    if (MEMBER_ROLE_ID) {
        try {
            const memberRole = member.guild.roles.cache.get(MEMBER_ROLE_ID);
            if (memberRole) await member.roles.add(memberRole);
        } catch (err) {}
    }
    
    // ================= BILINGUAL TRANSLATIONS =================
    const t = {
        fr: {
            title: '🦅 GUARDIAN ONLINE • CONNEXION ÉTABLIE',
            welcome: (user, count) => `Bienvenue dans le Réseau, **${user}**! 🎉\nTu es le Membre Officiel **#${count}**.`,
            securityCheck: '🔒 VÉRIFICATION DE SÉCURITÉ',
            accountCreated: 'Compte Créé',
            daysAgo: (days) => `${days} jour${days > 1 ? 's' : ''}`,
            newAccountWarning: '⚠️ COMPTE RÉCENT • SURVEILLANCE ACTIVE',
            initialization: '📡 PROTOCOLE D\'INITIALISATION',
            reviewRules: '📜 Consultez le Règlement',
            mainDiscussion: '💬 Discussion Générale',
            aiAssistant: '🤖 Assistance IA (Lydia)',
            securityFooter: 'SÉCURITÉ NEURALE ACTIVE • BAMAKO-223',
            serverInfo: '📊 INFORMATIONS SERVEUR',
            owner: 'Propriétaire',
            boostLevel: 'Niveau Boost',
            verificationLevel: 'Vérification',
            notConfigured: '⚠️ Non configuré',
            quickCommands: '🎮 COMMANDES RAPIDES',
            cmdHelp: 'Affiche l\'aide',
            cmdProfile: 'Voir ton profil',
            cmdDaily: 'Récompense quotidienne',
            cmdShop: 'Boutique',
            tipMessage: '💡 Commence par `.help` pour voir tout ce que je peux faire !'
        },
        en: {
            title: '🦅 GUARDIAN ONLINE • CONNECTION ESTABLISHED',
            welcome: (user, count) => `Welcome to the Network, **${user}**! 🎉\nYou are Official Member **#${count}**.`,
            securityCheck: '🔒 SECURITY CHECK',
            accountCreated: 'Account Created',
            daysAgo: (days) => `${days} day${days > 1 ? 's' : ''} ago`,
            newAccountWarning: '⚠️ NEW ACCOUNT • ACTIVE SURVEILLANCE',
            initialization: '📡 INITIALIZATION PROTOCOL',
            reviewRules: '📜 Review Guidelines',
            mainDiscussion: '💬 Main Discussion',
            aiAssistant: '🤖 AI Assistant (Lydia)',
            securityFooter: 'NEURAL SECURITY ACTIVE • BAMAKO-223',
            serverInfo: '📊 SERVER INFORMATION',
            owner: 'Owner',
            boostLevel: 'Boost Level',
            verificationLevel: 'Verification',
            notConfigured: '⚠️ Not configured',
            quickCommands: '🎮 QUICK COMMANDS',
            cmdHelp: 'Show help',
            cmdProfile: 'View profile',
            cmdDaily: 'Daily reward',
            cmdShop: 'Shop',
            tipMessage: '💡 Start with `.help` to see everything I can do!'
        }
    }[lang];
    
    // ================= BUILD WELCOME EMBED =================
    const welcomeEmbed = new EmbedBuilder()
        .setColor(isNewAccount ? '#e74c3c' : '#2ecc71')
        .setAuthor({ 
            name: t.title, 
            iconURL: member.guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL()
        })
        .setDescription(
            `\`\`\`ansi\n` +
            `\u001b[1;32m╔═══════════════════════════════════════╗\u001b[0m\n` +
            `\u001b[1;32m║\u001b[0m \u001b[1;36m${t.welcome(member.user.username, memberCount).split('\n')[0]}\u001b[0m \u001b[1;32m║\u001b[0m\n` +
            `\u001b[1;32m║\u001b[0m \u001b[1;33m${t.welcome(member.user.username, memberCount).split('\n')[1]}\u001b[0m \u001b[1;32m║\u001b[0m\n` +
            `\u001b[1;32m╚═══════════════════════════════════════╝\u001b[0m\n` +
            `\`\`\``
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
        .addFields(
            {
                name: t.securityCheck,
                value: `\`\`\`yaml\n${t.accountCreated}: ${t.daysAgo(accountAgeDays)}\nID: ${member.user.id}\n\`\`\``,
                inline: true
            },
            {
                name: t.serverInfo,
                value: `\`\`\`yaml\n${t.owner}: ${(await member.guild.fetchOwner()).user.username}\n${t.boostLevel}: Tier ${member.guild.premiumTier}\n${t.verificationLevel}: ${member.guild.verificationLevel}\n\`\`\``,
                inline: true
            }
        );
    
    // Warning for new accounts
    if (isNewAccount) {
        welcomeEmbed.addFields({
            name: t.newAccountWarning,
            value: `\`\`\`fix\n⚠️ ${lang === 'fr' ? `Compte créé il y a ${accountAgeDays} jours - Surveillance active activée.` : `Account created ${accountAgeDays} days ago - Active surveillance enabled.`}\`\`\``,
            inline: false
        });
    }
    
    // Initialization protocol
    let initValue = '';
    if (RULES_CHANNEL_ID) initValue += `• <#${RULES_CHANNEL_ID}> - ${t.reviewRules}\n`;
    if (GENERAL_CHANNEL_ID) initValue += `• <#${GENERAL_CHANNEL_ID}> - ${t.mainDiscussion}\n`;
    initValue += `• @Lydia - ${t.aiAssistant}`;
    
    if (!RULES_CHANNEL_ID && !GENERAL_CHANNEL_ID) {
        initValue = t.notConfigured;
    }
    
    welcomeEmbed.addFields({
        name: t.initialization,
        value: `\`\`\`yaml\n${initValue}\`\`\``,
        inline: false
    });
    
    // Quick commands
    welcomeEmbed.addFields({
        name: t.quickCommands,
        value: `\`\`\`yaml\n.help - ${t.cmdHelp}\n.profile - ${t.cmdProfile}\n.daily - ${t.cmdDaily}\n.shop - ${t.cmdShop}\`\`\``,
        inline: false
    });
    
    welcomeEmbed.setFooter({ 
        text: `${member.guild.name} • ${t.securityFooter} • v${client.version}`,
        iconURL: member.guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL()
    })
    .setTimestamp();
    
    // ================= BUILD BUTTONS =================
    const buttons = [];
    
    if (RULES_CHANNEL_ID) {
        buttons.push(
            new ButtonBuilder()
                .setLabel(lang === 'fr' ? '📜 Règles' : '📜 Rules')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/channels/${member.guild.id}/${RULES_CHANNEL_ID}`)
        );
    }
    
    if (GENERAL_CHANNEL_ID) {
        buttons.push(
            new ButtonBuilder()
                .setLabel(lang === 'fr' ? '💬 Général' : '💬 General')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/channels/${member.guild.id}/${GENERAL_CHANNEL_ID}`)
        );
    }
    
    buttons.push(
        new ButtonBuilder()
            .setLabel(lang === 'fr' ? '🤖 Aide' : '🤖 Help')
            .setStyle(ButtonStyle.Primary)
            .setCustomId('welcome_help')
    );
    
    const buttonRow = new ActionRowBuilder().addComponents(buttons);
    
    // ================= SEND WELCOME =================
    if (welcomeChannel) {
        await welcomeChannel.send({ 
            content: `🎉 **${member.user}** ${lang === 'fr' ? 'vient de rejoindre le serveur !' : 'just joined the server!'}`,
            embeds: [welcomeEmbed], 
            components: buttons.length > 0 ? [buttonRow] : [] 
        }).catch(() => {});
        
        // Send a follow-up tip after 2 seconds
        setTimeout(async () => {
            try {
                await welcomeChannel.send({
                    content: `✨ ${t.tipMessage}`
                });
            } catch (e) {}
        }, 2000);
    }
    
    // ================= LOG CHANNEL =================
    if (logChannel) {
        const logEmbed = new EmbedBuilder()
            .setColor(isNewAccount ? '#e74c3c' : '#3498db')
            .setAuthor({ name: '📋 JOURNAL DE SÉCURITÉ • NOUVEAU MEMBRE', iconURL: member.user.displayAvatarURL() })
            .setDescription(`**${member.user.tag}** a rejoint le serveur.`)
            .addFields(
                { name: '🆔 ID Utilisateur', value: member.user.id, inline: true },
                { name: '📅 Compte Créé', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '👥 Rang Membre', value: `#${memberCount}`, inline: true },
                { name: '🛡️ Niveau de Vérification', value: `${member.guild.verificationLevel}`, inline: true },
                { name: '🤖 Est un Bot', value: member.user.bot ? '✅ Oui' : '❌ Non', inline: true },
                { name: '🎭 Rôle Attribué', value: MEMBER_ROLE_ID ? `<@&${MEMBER_ROLE_ID}>` : t.notConfigured, inline: true }
            )
            .setFooter({ text: `Eagle Community • Système de Sécurité Neurale • v${client.version}` })
            .setTimestamp();
        
        if (isNewAccount) {
            logEmbed.addFields({
                name: '⚠️ ALERTE SÉCURITÉ',
                value: `Compte récent (${accountAgeDays} jours) - Surveillance recommandée.`,
                inline: false
            });
        }
        
        await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
    }
    
    console.log(`[WELCOME] ${member.user.tag} joined ${member.guild.name} | Member #${memberCount} | Account age: ${accountAgeDays} days`);
});

// ================= GRACEFUL SHUTDOWN =================
async function gracefulShutdown(signal) {
    console.log(`\n${yellow}[SHUTDOWN]${reset} 🛑 ${signal} detected. Saving all pending data...`);
    
    if (client.cacheJanitorInterval) clearInterval(client.cacheJanitorInterval);
    if (client.reminderHeartbeatInterval) clearInterval(client.reminderHeartbeatInterval);
    if (client.batchWriteInterval) clearInterval(client.batchWriteInterval);
    if (client._retryTimeouts) { for (const id of client._retryTimeouts) clearTimeout(id); client._retryTimeouts.clear(); }
    
    if (client.pendingUserUpdates?.size > 0) {
        console.log(`${cyan}[SHUTDOWN]${reset} Flushing ${client.pendingUserUpdates.size} pending updates...`);
        try {
            const updates = Array.from(client.pendingUserUpdates.entries());
            const updateStmt = db.prepare(`INSERT OR REPLACE INTO users (id, username, xp, level, total_messages, last_xp_gain, games_played, games_won, total_winnings, gaming, credits, streak_days, last_daily) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            for (const [userId, userData] of updates) {
                let gamingValue = typeof userData.gaming === 'object' ? JSON.stringify(userData.gaming) : (userData.gaming || '{"game":"CODM","rank":"Unranked"}');
                updateStmt.run(userId, userData.username || 'Unknown', userData.xp ?? 0, userData.level ?? 1, userData.total_messages ?? 0, userData.last_xp_gain ?? 0, userData.games_played ?? 0, userData.games_won ?? 0, userData.total_winnings ?? 0, gamingValue, userData.credits ?? 0, userData.streak_days ?? 0, userData.last_daily ?? 0);
            }
            console.log(`${green}[SHUTDOWN]${reset} Final flush complete: ${updates.length} records saved`);
        } catch (err) { console.error(`${red}[SHUTDOWN]${reset} Final flush failed:`, err.message); }
    }
    
    if (client.userTimeouts) { for (const [id, timeout] of client.userTimeouts) clearTimeout(timeout); client.userTimeouts.clear(); }
    client.userDataCache.clear(); client.settings.clear(); client.pendingUserUpdates.clear();
    
    try { db.exec("PRAGMA wal_checkpoint(TRUNCATE);"); db.close(); console.log(`${green}[SHUTDOWN]${reset} Database closed`); } catch (err) {}
    
    console.log(`${green}[SHUTDOWN]${reset} ✅ All data saved. Exiting...`);
    process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// ================= INITIALIZE LYDIA =================
setupLydia(client, db);
console.log(`${green}[INIT]${reset} Lydia Multi-Agent AI initialized`);

// ================= LOGIN =================
client.login(process.env.TOKEN);