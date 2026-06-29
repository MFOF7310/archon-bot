require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, Events, Partials, GatewayIntentBits, EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, REST, Routes, MessageFlags } = require('discord.js');

// ================= MALI-OPTIMIZED ASSET CACHE =================
const AssetCache = require('./plugins/asset-cache.js');
const assetCache = new AssetCache();
assetCache.preload();

// ================= IMPORT LYDIA SETUP FUNCTION =================
const { setupLydia } = require('./plugins/lydia.js');

// ================= AFK SYSTEM IMPORT =================
const { afkUsers } = require('./plugins/afk.js');

// ================= BAMAKO MARKET MANAGER (SAFE FALLBACK) =================
let getMarketState, updateMarketTrend, TRENDS, startAutoUpdate, loadAllStates, startMarketAlerts;

try {
    const MarketManager = require('./plugins/market-manager.js');
    getMarketState = MarketManager.getMarketState;
    updateMarketTrend = MarketManager.updateMarketTrend;
    TRENDS = MarketManager.TRENDS;
    startAutoUpdate = MarketManager.startAutoUpdate;
    loadAllStates = MarketManager.loadAllStates;
    startMarketAlerts = MarketManager.startMarketAlerts;
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
    startAutoUpdate = () => {};
    loadAllStates = () => {};
    startMarketAlerts = () => {};
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

// ================= SAFE ERROR LOGGING (FIX #9) =================
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function safeLogError(context, err, includeStack = false) {
    if (IS_PRODUCTION) {
        console.error(`[ERROR] ${context}: ${err.message?.substring(0, 100) || 'Unknown'}`);
    } else {
        console.error(`${red}[${context}]${reset}`, err.message);
        if (includeStack && err.stack) console.error(err.stack);
    }
}

// ================= ENV STATUS CHECKER (FIX #13) =================
function checkEnvStatus(key) {
    const value = process.env[key];
    if (!value) return '  MISSING';
    if (key.includes('TOKEN') || key.includes('SECRET') || key.includes('KEY') || key.includes('PASSWORD')) {
        return '  CONFIGURED';
    }
    return '  CONFIGURED';
}

// ================= SNOWFLAKE VALIDATOR (FIX #17) =================
function validateSnowflake(id) {
    if (!id || typeof id !== 'string') return false;
    return /^[0-9]{17,20}$/.test(id);
}

// ================= PM2 STYLE DISPLAY =================
function displayPM2Banner(serverCount = 0) {
    const isPM2 = process.env.pm_id !== undefined || process.env.name === 'Architect-CG223';
    
    const version = '2.0.0';
    const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    
    const banner = `
\x1b[38;5;39m    ██████╗ ███╗   ███╗██████╗ 
\x1b[38;5;45m    ██╔══██╗████╗ ████║╚════██╗
\x1b[38;5;51m    ██████╔╝██╔████╔██║ █████╔╝
\x1b[38;5;51m    ██╔═══╝ ██║╚██╔╝██║██╔═══╝ 
\x1b[38;5;45m    ██║     ██║ ╚═╝ ██║███████╗
\x1b[38;5;39m    ╚═╝     ╚═╝     ╚═╝╚══════╝\x1b[0m

\x1b[36m╔══════════════════════════════════════════════════════════════════╗
\x1b[36m║\x1b[0m  \x1b[1;33m  ARCHON CG-223\x1b[0m | \x1b[1;32mAI-POWERED SERVER ARCHITECT\x1b[0m                      \x1b[36m║
\x1b[36m╠══════════════════════════════════════════════════════════════════╣
\x1b[36m║\x1b[0m  \x1b[32mNODE:\x1b[0m BAMAKO_223 🇲🇱  \x1b[33mSERVERS:\x1b[0m ${String(serverCount).padEnd(6)}     \x1b[35mBY:\x1b[0m MFOF7310         \x1b[36m║
\x1b[36m║\x1b[0m  \x1b[32mVERSION:\x1b[0m v${version.padEnd(8)}        \x1b[35mPM2 ID:\x1b[0m ${(process.env.pm_id || '0').padEnd(8)}        \x1b[36m║
\x1b[36m║\x1b[0m  \x1b[32mSTATUS:\x1b[0m \x1b[5;32m ONLINE\x1b[0m   \x1b[33mMEMORY:\x1b[0m ${memory.padEnd(5)} MB                \x1b[36m║
\x1b[36m╠══════════════════════════════════════════════════════════════════╣
\x1b[36m║\x1b[0m  \x1b[1;34mTELEGRAM:\x1b[0m Bridge \x1b[32mACTIVE\x1b[0m      \x1b[1;34mLYDIA AI:\x1b[0m \x1b[32mCONNECTED\x1b[0m               \x1b[36m║
\x1b[36m║\x1b[0m  \x1b[1;34mDATABASE:\x1b[0m WAL+Partitioned   \x1b[1;34mCIRCUIT:\x1b[0m \x1b[32mREADY\x1b[0m                   \x1b[36m║
\x1b[36m╚══════════════════════════════════════════════════════════════════╝\x1b[0m
`;

        console.log(banner);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

// ================= SECURE EVENT LISTENER DEDUPLICATION (FIX #15) =================
const REGISTERED_LISTENERS = new Set();

function safeOn(event, handler) {
    if (REGISTERED_LISTENERS.has(event)) {
        console.log(`${yellow}[LISTENER]${reset} ${event} already registered, skipping duplicate`);
        return;
    }
    REGISTERED_LISTENERS.add(event);
    client.on(event, handler);
}

// ================= SYSTEM GLOBALS =================
client.commands = new Collection();
client.aliases = new Collection();
client.aliasLang = new Map();
client.userTimeouts = new Map();
client.settings = new Map();
client.lydiaCooldowns = new Map();

// ================= DYNAMIC VERSIONING =================
function getVersion() {
    try {
        const versionPath = path.join(__dirname, 'version.txt');
        if (fs.existsSync(versionPath)) {
            const version = fs.readFileSync(versionPath, 'utf8').trim();
            return version;
        } else {
            fs.writeFileSync(versionPath, '2.0.0', 'utf8');
            return '2.0.0';
        }
    } catch (err) {
        return '2.0.0';
    }
}

client.version = getVersion();

// --- LYDIA GLOBALS (Will be populated by setupLydia) ---
client.lydiaAgents = {};
client.lastLydiaCall = {};
client.userIntroductions = new Map();

const PREFIX = process.env.PREFIX || ".";

// ================= UTILITIES =================
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const formatNumber = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// ================= SAFE UNIVERSAL LANGUAGE DETECTION =================
function detectLanguage(usedCommand, guildId = null) {
    // Priority 1: Server language setting
    if (guildId) {
        const serverLang = client.settings?.get(guildId)?.language || 
                          client.getServerSettings?.(guildId)?.language;
        if (serverLang === 'fr') return 'fr';
        if (serverLang === 'en') return 'en';
        // 'auto' falls through to detection below
    }

    if (!usedCommand || typeof usedCommand !== 'string') return 'en';
    const cmd = usedCommand.toLowerCase().trim();
    if (!cmd) return 'en';
    
    // 1. French-specific characters -> strong indicator
    const hasFrenchAccent = /[àâäéèêëîïôöùûüÿçœæ]/i.test(cmd);
    if (hasFrenchAccent) return 'fr';
    
    // 2. French stop words (very short, high precision)
    const frenchStopWords = /^(le|la|les|un|une|des|du|de|je|tu|il|elle|on|nous|vous|ils|elles|ce|cet|cette|ces|mon|ton|son|ma|ta|sa|mes|tes|ses|notre|votre|leur|nos|vos|leurs|ceci|cela|ça|y|en|dans|pour|par|avec|sans|sous|sur|entre|chez|vers|pendant|depuis|avant|après|contre|malgré|selon|voici|voilà)$/i;
    if (frenchStopWords.test(cmd)) return 'fr';
    
    // 3. French common suffixes (only if word length >= 5 to avoid short false positives)
    const frenchSuffixes = /(?:ation|ition|tion|sion|ment|age|té|tude|ette|ique|eur|euse|able|ible|al|el|if|ive|eau|eux|erie|ise|ade|ude)$/i;
    if (cmd.length >= 5 && frenchSuffixes.test(cmd)) return 'fr';
    
    // 4. French verb endings (only if length >= 4)
    const frenchVerbEndings = /(?:er|ir|oir|re|ais|ait|ions|iez|aient|ai|as|a|ons|ez|ent|is|it|îmes|îtes|irent|us|ut|ûmes|ûtes|urent)$/i;
    if (cmd.length >= 4 && frenchVerbEndings.test(cmd) && !/^(get|set|put|run|let|hit|sit|fit|bit|kit)$/i.test(cmd)) return 'fr';
    
    // 5. Very common English short words (manually curated but short, <10 entries)
    const englishCore = /^(help|daily|profile|rank|level|xp|shop|buy|game|coin|fight|duel|ping|stats|uptime|vote|remind|ticket|report|whois|userinfo)$/i;
    if (englishCore.test(cmd)) return 'en';
    
    // 6. English patterns (low weight, only if no French patterns matched)
    const englishIndicators = [
        /^(the|a|an|i|you|he|she|it|we|they|my|your|his|her|our|their)\b/i,
        /(ing|ed|'s|'ve|'re|'ll|'d)$/i,
        /^(what|where|when|why|how|which|who|whom)\b/i
    ];
    for (const pattern of englishIndicators) {
        if (pattern.test(cmd)) return 'en';
    }
    
    // 7. Fallback: vowel ratio but with higher threshold and length penalty
    const vowels = (cmd.match(/[aeiouy]/gi) || []).length;
    const ratio = vowels / cmd.length;
    const threshold = cmd.length <= 4 ? 0.75 : 0.6;
    if (ratio > threshold && cmd.length > 2) return 'fr';
    
    // 8. Default English
    return 'en';
}

function calculateLevel(xp) {
    return Math.floor(0.1 * Math.sqrt(xp || 0)) + 1;
}

// French command aliases — force FR response
const FRENCH_ALIASES = new Set([
    'réclamer', 'reclamer', 'recolter', 'récolter',
    'quotidien', 'journalier', 'profil', 'niveau',
    'classement', 'boutique', 'marché', 'inventaire',
    'solde', 'transferer', 'transférer', 'acheter',
    'vendre', 'voter', 'aide', 'apropos', 'statut',
    'bannir', 'expulser', 'avertir', 'signaler',
    'muet', 'supprimer', 'épingler', 'sondage',
]);

client.detectLanguage = (usedCommand, guildId = null) => {
    // Safety check
    const cmd = typeof usedCommand === 'string' ? usedCommand : String(usedCommand || '');
    // French alias override
    if (FRENCH_ALIASES.has(cmd.toLowerCase())) return 'fr';
    return detectLanguage(cmd, guildId);
};
client.calculateLevel = calculateLevel;
client.formatNumber = formatNumber;

console.log(`${green}[LANGUAGE]${reset} Universal pattern-based detection initialized`);

// --- SQLITE DATABASE ---
const Database = require('better-sqlite3');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// ================= SECURE FILE WRITE UTILITY (FIX #8) =================
const safeDataDir = (() => {
    const resolved = path.resolve(__dirname, 'data');
    const root = path.resolve(__dirname);
    if (!resolved.startsWith(root)) {
        console.error(`[SECURITY] dataDir path traversal detected`);
        process.exit(1);
    }
    return resolved;
})();

function safeWriteFile(filename, data) {
    const targetPath = path.resolve(safeDataDir, filename);
    const resolvedDataDir = path.resolve(safeDataDir);
    if (!targetPath.startsWith(resolvedDataDir)) {
        console.error(`[SECURITY] Path traversal blocked: ${filename}`);
        return false;
    }
    if (filename.includes('..') || path.isAbsolute(filename)) {
        console.error(`[SECURITY] Invalid filename: ${filename}`);
        return false;
    }
    fs.writeFileSync(targetPath, data);
    return true;
}

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const db = new Database(path.join(dataDir, 'database.sqlite'), {
    timeout: 10000,
    readonly: false,
    fileMustExist: false
});

client.db = db;
global.client = client;

// ================= PILLAR 3: HIGH-PERFORMANCE PRAGMA =================
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA synchronous = NORMAL;");
db.exec("PRAGMA cache_size = -64000;");
db.exec("PRAGMA temp_store = MEMORY;");
db.exec("PRAGMA busy_timeout = 10000;");
db.exec("PRAGMA wal_autocheckpoint = 1000;");
console.log(`${green}[PRAGMA]${reset} WAL mode enabled - Lock protection active`);

// ================= SAFE DATABASE WRITE (NO LOCKS!) =================
async function safeDbWrite(operation, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return operation();
        } catch (error) {
            lastError = error;
            
            if (error.code === 'SQLITE_BUSY' || error.message.includes('database is locked')) {
                console.log(`${yellow}[DB]${reset} Lock detected, retry ${attempt}/${maxRetries}...`);
                const waitTime = attempt * 500;
                await new Promise(resolve => setTimeout(resolve, waitTime));
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
    // ================= PER-SERVER PARTITIONED USERS TABLE =================
    // Composite primary key (id, guild_id) ensures complete data isolation
    // per server. Each user has a separate record per guild they participate in.
    bot_state: `CREATE TABLE IF NOT EXISTS bot_state (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`,

    users: `CREATE TABLE IF NOT EXISTS users (
        id TEXT NOT NULL, 
        guild_id TEXT NOT NULL,
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
        last_daily INTEGER DEFAULT 0,
        total_dailies INTEGER DEFAULT 0,
        highest_streak INTEGER DEFAULT 0,
        streak_protections INTEGER DEFAULT 0,
        last_reminder INTEGER DEFAULT 0,
        PRIMARY KEY (id, guild_id)
    )`,
    
    shop_items: `CREATE TABLE IF NOT EXISTS shop_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price INTEGER DEFAULT 0,
        type TEXT DEFAULT 'consumable',
        emoji TEXT DEFAULT '📦',
        effect TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`,
    
    server_settings: `CREATE TABLE IF NOT EXISTS server_settings (
        guild_id TEXT PRIMARY KEY, 
        prefix TEXT DEFAULT '.', 
        welcome_channel TEXT, 
        log_channel TEXT, 
        daily_channel TEXT, 
        shop_channel TEXT,
        rules_channel TEXT,
        general_channel TEXT,
        member_role TEXT,
        welcome_message TEXT,
        goodbye_channel TEXT,
        goodbye_message TEXT,
        mute_role_id TEXT,
        mod_log_channel TEXT,
        auto_role_id TEXT,
        xp_multiplier REAL DEFAULT 1.0,
        level_channel TEXT,
        afk_enabled INTEGER DEFAULT 1,
        market_enabled INTEGER DEFAULT 1,
        ai_enabled INTEGER DEFAULT 1,
        automod_enabled INTEGER DEFAULT 0,
        automod_whitelist TEXT,
        automod_sensitivity TEXT DEFAULT 'medium',
        automod_log_channel TEXT,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`,
    
    // ✅ FIXED
   lydia_memory: `CREATE TABLE IF NOT EXISTS lydia_memory (
    user_id TEXT, memory_key TEXT, memory_value TEXT, 
    updated_at INTEGER DEFAULT 0, 
    PRIMARY KEY (user_id, memory_key)
)`,
    
   lydia_agents: `CREATE TABLE IF NOT EXISTS lydia_agents (
    channel_id TEXT PRIMARY KEY, 
    agent_key TEXT, 
    is_active INTEGER DEFAULT 0, 
    updated_at INTEGER DEFAULT 0
)`,
    
    user_inventory: `CREATE TABLE IF NOT EXISTS user_inventory (
        user_id TEXT, item_id TEXT, quantity INTEGER DEFAULT 1, 
        purchased_at INTEGER DEFAULT (strftime('%s', 'now')), 
        expires_at INTEGER, active INTEGER DEFAULT 1, 
        PRIMARY KEY (user_id, item_id)
    )`,
    
    // ✅ FIXED
lydia_introductions: `CREATE TABLE IF NOT EXISTS lydia_introductions (
    user_id TEXT, channel_id TEXT, 
    introduced_at INTEGER DEFAULT 0, 
    PRIMARY KEY (user_id, channel_id)
)`,
    
    // ✅ FIXED
lydia_conversations: `CREATE TABLE IF NOT EXISTS lydia_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT, guild_id TEXT, user_id TEXT, user_name TEXT, 
    role TEXT, content TEXT, timestamp INTEGER DEFAULT 0
)`,
    
    // ✅ FIXED
reminders: `CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY, 
    user_id TEXT NOT NULL, 
    channel_id TEXT NOT NULL, 
    message TEXT NOT NULL, 
    execute_at INTEGER NOT NULL, 
    status TEXT DEFAULT 'pending',
    delivered INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT 0
)`,
    
    tiktok_notifications: `CREATE TABLE IF NOT EXISTS tiktok_notifications (
        guild_id TEXT NOT NULL,
        tiktok_username TEXT NOT NULL,
        target_channel_id TEXT NOT NULL,
        last_video_id TEXT DEFAULT NULL,
        is_live INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (guild_id, tiktok_username)
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
    
    birthdays: `CREATE TABLE IF NOT EXISTS birthdays (
        user_id TEXT PRIMARY KEY,
        day INTEGER,
        month INTEGER,
        year INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`,

    transfers: `CREATE TABLE IF NOT EXISTS transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        platform TEXT DEFAULT 'discord'
    )`,
    
    server_command_settings: `CREATE TABLE IF NOT EXISTS server_command_settings (
        guild_id TEXT NOT NULL,
        command_name TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        allowed_roles TEXT,
        allowed_channels TEXT,
        cooldown_seconds INTEGER DEFAULT 0,
        PRIMARY KEY (guild_id, command_name)
    )`,
    
    server_economy_settings: `CREATE TABLE IF NOT EXISTS server_economy_settings (
        guild_id TEXT PRIMARY KEY,
        currency_name TEXT DEFAULT 'credits',
        currency_emoji TEXT DEFAULT '🪙',
        daily_bonus INTEGER DEFAULT 200,
        transfer_tax REAL DEFAULT 0.0
    )`,
    
    bot_roles: `CREATE TABLE IF NOT EXISTS bot_roles (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        role_name TEXT NOT NULL,
        source TEXT NOT NULL,
        assigned_at INTEGER DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (guild_id, user_id, role_id)
    )`
};

for (const [tableName, createSQL] of Object.entries(requiredTables)) {
    try { 
        db.exec(createSQL); 
    } catch (err) {
        console.error(`${red}[TABLE ERROR]${reset} ${tableName}:`, err.message);
    }
}

// ================= PERFORMANCE INDEXES =================
const performanceIndexes = [
    "CREATE INDEX IF NOT EXISTS idx_lydia_timestamp ON lydia_conversations(timestamp)",
    "CREATE INDEX IF NOT EXISTS idx_moderation_timestamp ON moderation_logs(timestamp)",
    "CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status)",
    "CREATE INDEX IF NOT EXISTS idx_reminders_execute ON reminders(execute_at)",
    "CREATE INDEX IF NOT EXISTS idx_warnings_active ON warnings(active, guild_id)",
    "CREATE INDEX IF NOT EXISTS idx_users_guild ON users(guild_id)",
    "CREATE INDEX IF NOT EXISTS idx_transfers_timestamp ON transfers(timestamp)",
    "CREATE INDEX IF NOT EXISTS idx_investments_user ON investments(user_id, claimed)",
    "CREATE INDEX IF NOT EXISTS idx_lydia_guild ON lydia_conversations(guild_id)"
];

console.log(`${cyan}[INDEX]${reset} Creating performance indexes...`);
let indexesCreated = 0;
for (const indexSQL of performanceIndexes) {
    try {
        db.exec(indexSQL);
        indexesCreated++;
    } catch (err) {
        console.log(`${yellow}[INDEX]${reset} Skipped: ${err.message}`);
    }
}
console.log(`${green}[INDEX]${reset} ${indexesCreated} indexes verified`);

// ================= MIGRATE: Add ALL missing columns =================
console.log(`${cyan}[MIGRATION]${reset} Checking database schema...`);
try {
    const existingColumns = db.prepare("PRAGMA table_info(server_settings)").all().map(c => c.name);
    
    const allColumns = [
        { name: 'gift_channel', type: 'TEXT' },
        { name: 'prefix', type: "TEXT DEFAULT '.'" },
        { name: 'welcome_channel', type: 'TEXT' },
        { name: 'log_channel', type: 'TEXT' },
        { name: 'daily_channel', type: 'TEXT' },
        { name: 'shop_channel', type: 'TEXT' },
        { name: 'rules_channel', type: 'TEXT' },
        { name: 'general_channel', type: 'TEXT' },
        { name: 'member_role', type: 'TEXT' },
        { name: 'welcome_message', type: 'TEXT' },
        { name: 'updated_at', type: "INTEGER DEFAULT (strftime('%s', 'now'))" },
        { name: 'goodbye_channel', type: 'TEXT' },
        { name: 'goodbye_message', type: 'TEXT' },
        { name: 'mute_role_id', type: 'TEXT' },
        { name: 'mod_log_channel', type: 'TEXT' },
        { name: 'auto_role_id', type: 'TEXT' },
        { name: 'xp_multiplier', type: 'REAL DEFAULT 1.0' },
        { name: 'level_channel', type: 'TEXT' },
        { name: 'afk_enabled', type: 'INTEGER DEFAULT 1' },
        { name: 'market_enabled', type: 'INTEGER DEFAULT 1' },
        { name: 'daily_initiate_role', type: 'TEXT' },
        { name: 'daily_warrior_role', type: 'TEXT' },
        { name: 'daily_champion_role', type: 'TEXT' },
        { name: 'daily_legend_role', type: 'TEXT' },
        { name: 'market_channel', type: 'TEXT' },
        { name: 'ai_enabled', type: 'INTEGER DEFAULT 1' },
        { name: 'automod_enabled', type: 'INTEGER DEFAULT 0' },
        { name: 'automod_whitelist', type: 'TEXT' },
        { name: 'automod_sensitivity', type: "TEXT DEFAULT 'medium'" },
        { name: 'automod_log_channel', type: 'TEXT' },
        { name: 'language', type: "TEXT DEFAULT 'auto'" },
        { name: 'welcome_enabled', type: 'INTEGER DEFAULT 1' },
        { name: 'goodbye_enabled', type: 'INTEGER DEFAULT 1' },
        { name: 'levelup_channel', type: 'TEXT' },
        { name: 'xp_cooldown', type: 'INTEGER DEFAULT 60' },
        { name: 'xp_min_gain', type: 'INTEGER DEFAULT 15' },
        { name: 'xp_max_gain', type: 'INTEGER DEFAULT 35' },
        { name: 'starting_balance', type: 'INTEGER DEFAULT 0' },
        { name: 'max_daily_streak', type: 'INTEGER DEFAULT 365' },
        { name: 'levelup_message', type: 'TEXT' },
        { name: 'join_role_id', type: 'TEXT' },
        { name: 'disabled_commands', type: 'TEXT' },
        { name: 'disabled_categories', type: 'TEXT' },
        { name: 'spam_threshold', type: 'INTEGER DEFAULT 5' },
        { name: 'spam_window', type: 'INTEGER DEFAULT 5' },
        { name: 'link_filter_enabled', type: 'INTEGER DEFAULT 0' },
        { name: 'invite_filter_enabled', type: 'INTEGER DEFAULT 0' },
        { name: 'mention_limit', type: 'INTEGER DEFAULT 10' },
        { name: 'max_warnings', type: 'INTEGER DEFAULT 3' },
        { name: 'warning_action', type: "TEXT DEFAULT 'mute'" },
        { name: 'timezone', type: "TEXT DEFAULT 'UTC'" },
        { name: 'custom_categories', type: 'TEXT' },
        { name: 'investor_role', type: 'TEXT' },
        { name: 'gamer_role', type: 'TEXT' },
        { name: 'quiz_master_role', type: 'TEXT' },
        { name: 'duelist_role', type: 'TEXT' },
        { name: 'ticket_category', type: 'TEXT' },
        { name: 'ticket_staff_role', type: 'TEXT' },
        { name: 'ticket_transcript_channel', type: 'TEXT' },
        { name: 'ticket_panel_channel', type: 'TEXT' },
        { name: 'ticket_log_channel', type: 'TEXT' },
        { name: 'ticket_auto_close_hours', type: 'INTEGER DEFAULT 24' },
        { name: 'ticket_categories_config', type: 'TEXT' },
        { name: 'ticket_limit_per_user', type: 'INTEGER DEFAULT 1' },
        { name: 'ticket_panel_message_id', type: 'TEXT' },
        { name: 'automod_channels', type: 'TEXT' },
    ];
    
    let addedCount = 0;
    for (const col of allColumns) {
        if (!existingColumns.includes(col.name)) {
            db.exec(`ALTER TABLE server_settings ADD COLUMN ${col.name} ${col.type}`);
            console.log(`${green}[MIGRATION]${reset} Added: ${col.name}`);
            addedCount++;
        }
    }
    
    if (addedCount === 0) {
        console.log(`${green}[MIGRATION]${reset} All columns present — no migration needed`);
    } else {
        console.log(`${green}[MIGRATION]${reset} Added ${addedCount} missing columns`);
    }
} catch (err) {
    console.log(`${red}[MIGRATION]${reset} ${err.message}`);
}

// ================= MIGRATE: lydia_conversations.guild_id (Privacy Isolation) =================
console.log(`${cyan}[MIGRATION]${reset} Checking lydia_conversations schema...`);
try {
    const lydiaCols = db.prepare("PRAGMA table_info(lydia_conversations)").all().map(c => c.name);
    if (!lydiaCols.includes('guild_id')) {
        db.exec("ALTER TABLE lydia_conversations ADD COLUMN guild_id TEXT");
        console.log(`${green}[MIGRATION]${reset} Added lydia_conversations.guild_id for per-server AI privacy isolation`);
    } else {
        console.log(`${green}[MIGRATION]${reset} lydia_conversations.guild_id already present`);
    }
} catch (err) {
    console.log(`${yellow}[MIGRATION]${reset} lydia_conversations check: ${err.message}`);
}

// ================= AUTO-REPAIR: Fix invalid XP multipliers =================
try {
    const brokenRows = db.prepare(
        "SELECT guild_id, xp_multiplier FROM server_settings WHERE xp_multiplier IS NOT NULL"
    ).all();
    
    let fixed = 0;
    for (const row of brokenRows) {
        const num = parseFloat(row.xp_multiplier);
        if (isNaN(num) || num < 0.1 || num > 10.0) {
            db.prepare("UPDATE server_settings SET xp_multiplier = '1.0' WHERE guild_id = ?").run(row.guild_id);
            fixed++;
        }
    }
    if (fixed > 0) console.log(`${green}[REPAIR XP]${reset} Repaired ${fixed} invalid XP multipliers`);
} catch(e) {}

// ================= UNIVERSAL AUTO-REPAIR: Auto-add missing columns to ALL tables =================
console.log(`${cyan}[AUTO-REPAIR]${reset} Scanning all tables for missing columns...`);

// Define expected columns for each table (name, type, default)
const TABLE_SCHEMAS = {
    bot_state: [
        { name: 'value', type: 'TEXT', default: 'NULL' },
        { name: 'updated_at', type: 'INTEGER', default: "(strftime('%s', 'now'))" }
    ],
    users: [
        { name: 'last_reminder', type: 'INTEGER', default: '0' },
        { name: 'streak_protections', type: 'INTEGER', default: '0' },
        { name: 'highest_streak', type: 'INTEGER', default: '0' },
        { name: 'total_dailies', type: 'INTEGER', default: '0' },
        { name: 'last_daily', type: 'INTEGER', default: '0' },
        { name: 'gaming', type: 'TEXT', default: "'{\"game\":\"CODM\",\"rank\":\"Unranked\"}'" },
        { name: 'credits', type: 'INTEGER', default: '0' },
        { name: 'streak_days', type: 'INTEGER', default: '0' },
        { name: 'total_messages', type: 'INTEGER', default: '0' },
        { name: 'last_xp_gain', type: 'INTEGER', default: '0' }
    ],
    server_settings: [
        { name: 'prefix', type: 'TEXT', default: "'.'" },
        { name: 'language', type: 'TEXT', default: "'auto'" },
        { name: 'timezone', type: 'TEXT', default: "'UTC'" },
        { name: 'welcome_enabled', type: 'INTEGER', default: '1' },
        { name: 'goodbye_enabled', type: 'INTEGER', default: '1' },
        { name: 'xp_multiplier', type: 'REAL', default: '1.0' },
        { name: 'xp_cooldown', type: 'INTEGER', default: '60' },
        { name: 'xp_min_gain', type: 'INTEGER', default: '15' },
        { name: 'xp_max_gain', type: 'INTEGER', default: '35' },
        { name: 'starting_balance', type: 'INTEGER', default: '0' },
        { name: 'max_daily_streak', type: 'INTEGER', default: '365' },
        { name: 'automod_enabled', type: 'INTEGER', default: '0' },
        { name: 'automod_sensitivity', type: 'TEXT', default: "'medium'" },
        { name: 'spam_threshold', type: 'INTEGER', default: '5' },
        { name: 'spam_window', type: 'INTEGER', default: '5' },
        { name: 'mention_limit', type: 'INTEGER', default: '10' },
        { name: 'max_warnings', type: 'INTEGER', default: '3' },
        { name: 'warning_action', type: 'TEXT', default: "'mute'" }
    ],
    lydia_conversations: [
        { name: 'guild_id', type: 'TEXT', default: 'NULL' }
    ],
    reminders: [
        { name: 'status', type: 'TEXT', default: "'pending'" },
        { name: 'delivered', type: 'INTEGER', default: '0' }
    ],
    user_premium: [
        { name: 'notified', type: 'INTEGER', default: '0' }
    ]
    // Add more tables as needed
};

// ✅ SECURE: Whitelist of allowed table names
const ALLOWED_TABLES = ['bot_state', 'users', 'shop_items', 'server_settings', 
    'lydia_memory', 'lydia_agents', 'user_inventory', 'lydia_introductions',
    'lydia_conversations', 'reminders', 'tiktok_notifications', 'warnings',
    'moderation_logs', 'server_backups', 'auto_backup_settings', 'user_links',
    'investments', 'birthdays', 'transfers', 'server_command_settings',
    'server_economy_settings', 'bot_roles', 'user_premium'];

function ensureTableColumns(db, tableName, expectedColumns) {
    // ✅ SECURE: Validate table name against whitelist
    if (!ALLOWED_TABLES.includes(tableName)) {
        console.error(`[AUTO-REPAIR] Rejected invalid table: ${tableName}`);
        return 0;
    }
    
    // ✅ SECURE: Validate table name format (defense in depth)
    if (!/^[a-z_][a-z0-9_]*$/.test(tableName)) {
        console.error(`[AUTO-REPAIR] Invalid table name pattern: ${tableName}`);
        return 0;
    }
    
    try {
        const existing = db.prepare(`PRAGMA table_info(${tableName})`).all().map(c => c.name);
        let added = 0;
        
        for (const col of expectedColumns) {
            // ✅ SECURE: Validate column name format
            if (!col.name || !/^[a-z_][a-z0-9_]*$/.test(col.name)) {
                console.error(`[AUTO-REPAIR] Invalid column name: ${col.name}`);
                continue;
            }
            
            // ✅ SECURE: Validate column type (whitelist common SQLite types)
            const ALLOWED_TYPES = ['TEXT', 'INTEGER', 'REAL', 'BLOB', 'NUMERIC', 'BOOLEAN', 'DATETIME', 'JSON'];
            const baseType = col.type.split(' ')[0].toUpperCase();
            if (!ALLOWED_TYPES.includes(baseType)) {
                console.error(`[AUTO-REPAIR] Invalid column type: ${col.type}`);
                continue;
            }
            
            if (!existing.includes(col.name)) {
                const defaultClause = col.default !== undefined ? ` DEFAULT ${col.default}` : '';
                // ✅ SECURE: All identifiers validated before interpolation
                const alterSQL = `ALTER TABLE ${tableName} ADD COLUMN ${col.name} ${col.type}${defaultClause}`;
                try { db.exec(alterSQL); } catch(e) {
                    if (!e.message.includes('duplicate column')) throw e;
                }
                console.log(`${green}[AUTO-REPAIR]${reset} Added ${tableName}.${col.name}${defaultClause ? ` (default: ${col.default})` : ''}`);
                added++;
            }
        }
        return added;
    } catch (err) {
        console.log(`${yellow}[AUTO-REPAIR]${reset} Failed on ${tableName}: ${err.message}`);
        return 0;
    }
}

let totalAdded = 0;
for (const [tableName, columns] of Object.entries(TABLE_SCHEMAS)) {
    totalAdded += ensureTableColumns(db, tableName, columns);
}

if (totalAdded > 0) {
    console.log(`${green}[AUTO-REPAIR]${reset} Added ${totalAdded} missing columns across ${Object.keys(TABLE_SCHEMAS).length} tables`);
} else {
    console.log(`${green}[AUTO-REPAIR]${reset} All schemas are up to date – no columns missing`);
}

// ================= SERVER SETTINGS UTILITY =================
const DEFAULT_SETTINGS = { prefix: PREFIX, welcomeChannel: null, logChannel: null, dailyChannel: null, shopChannel: null };

function getServerSettings(guildId) {
    if (client.settings.has(guildId)) return client.settings.get(guildId);
    
    try {
        let settings = db.prepare(`SELECT * FROM server_settings WHERE guild_id = ?`).get(guildId);
        if (!settings) {
            db.prepare(`INSERT INTO server_settings (guild_id, prefix) VALUES (?, ?)`).run(guildId, DEFAULT_SETTINGS.prefix);
            settings = { guild_id: guildId, prefix: DEFAULT_SETTINGS.prefix };
        }
        
        // Env var fallback helpers — ONLY for owner server, never leak credentials to other guilds
        const isOwnerServer = guildId === process.env.GUILD_ID;
        const env = (dbCol, envKey) => {
            if (settings[dbCol] !== null && settings[dbCol] !== undefined) return settings[dbCol];
            // Only read env vars for the owner's server — prevents credential leakage to other guilds
            if (isOwnerServer) return process.env[envKey] || null;
            return null;
        };
        const envNum = (dbCol, envKey, fallback) => {
            if (settings[dbCol] !== null && settings[dbCol] !== undefined) return settings[dbCol];
            // Only read env vars for the owner's server — prevents credential leakage to other guilds
            if (isOwnerServer) {
                const v = process.env[envKey];
                return v ? parseInt(v) : fallback;
            }
            return fallback;
        };

        const result = {
            prefix: settings.prefix || DEFAULT_SETTINGS.prefix,
            language: settings.language || 'auto',
            timezone: settings.timezone || 'UTC',
            
            welcomeChannel: settings.welcome_channel,
            logChannel: settings.log_channel,
            dailyChannel: settings.daily_channel,
            shopChannel: env('shop_channel', 'SHOP_CHANNEL_ID'),
            marketChannel: settings.market_channel || process.env.MARKET_CHANNEL_ID || null,
            rulesChannel: settings.rules_channel,
            generalChannel: settings.general_channel,
            goodbyeChannel: settings.goodbye_channel,
            levelChannel: settings.level_channel,
            modLogChannel: settings.mod_log_channel,
            autoModLogChannel: settings.automod_log_channel || null,
            
            welcomeMessage: settings.welcome_message,
            goodbyeMessage: settings.goodbye_message,
            levelUpMessage: settings.levelup_message,
            
            memberRole: settings.member_role,
            autoRoleId: settings.auto_role_id,
            muteRoleId: settings.mute_role_id,
            joinRoleId: settings.join_role_id,
            investorRoleId: settings.investor_role,
            gamerRoleId: settings.gamer_role,
            quizMasterRoleId: settings.quiz_master_role,
            duelistRoleId: settings.duelist_role,
            
            // Ticket system — with env var fallback
            ticketCategory: env('ticket_category', 'TICKET_CATEGORY_ID'),
            ticketStaffRole: env('ticket_staff_role', 'TICKET_STAFF_ROLE_ID'),
            ticketTranscriptChannel: env('ticket_transcript_channel', 'TICKET_TRANSCRIPT_CHANNEL_ID'),
            ticketPanelChannel: env('ticket_panel_channel', 'TICKET_PANEL_CHANNEL_ID'),
            ticketLogChannel: env('ticket_log_channel', 'TICKET_LOG_CHANNEL_ID'),
            ticketAutoCloseHours: envNum('ticket_auto_close_hours', 'TICKET_AUTO_CLOSE_HOURS', 24),
            ticketCategoriesConfig: parseJSONSafe(settings.ticket_categories_config, null),
            ticketLimitPerUser: envNum('ticket_limit_per_user', 'TICKET_LIMIT_PER_USER', 1),
            dailyInitiateRoleId: settings.daily_initiate_role,
            dailyWarriorRoleId: settings.daily_warrior_role,
            dailyChampionRoleId: settings.daily_champion_role,
            dailyLegendRoleId: settings.daily_legend_role,
            
            welcomeEnabled: settings.welcome_enabled !== 0,
            goodbyeEnabled: settings.goodbye_enabled !== 0,
            afkEnabled: settings.afk_enabled !== 0,
            marketEnabled: settings.market_enabled !== 0,
            aiEnabled: settings.ai_enabled !== 0,
            autoModEnabled: settings.automod_enabled === 1,
            linkFilterEnabled: settings.link_filter_enabled === 1,
            inviteFilterEnabled: settings.invite_filter_enabled === 1,
            
            xpMultiplier: settings.xp_multiplier || 1.0,
            xpCooldown: settings.xp_cooldown || 60,
            xpMinGain: settings.xp_min_gain || 15,
            xpMaxGain: settings.xp_max_gain || 35,
            
            startingBalance: settings.starting_balance || 0,
            maxDailyStreak: settings.max_daily_streak || 365,
            
            automodChannels: settings.automod_channels,
            automod_whitelist: settings.automod_whitelist || null,
            automod_log_channel: settings.automod_log_channel || null,
            autoModSensitivity: settings.automod_sensitivity || 'medium',
            spamThreshold: settings.spam_threshold || 5,
            spamWindow: settings.spam_window || 5,
            mentionLimit: settings.mention_limit || 10,
            maxWarnings: settings.max_warnings || 3,
            warningAction: settings.warning_action || 'mute',
            
            disabledCommands: parseJSONSafe(settings.disabled_commands, []),
            disabledCategories: parseJSONSafe(settings.disabled_categories, []),
            customCategories: parseJSONSafe(settings.custom_categories, {}),
        };
        
        client.settings.set(guildId, result);
        return result;
    } catch (err) {
        console.error(`[SETTINGS] Error for ${guildId}:`, err.message);
        return { ...DEFAULT_SETTINGS };
    }
}

function parseJSONSafe(str, fallback) {
    // ✅ SECURE: Length check to prevent memory exhaustion
    const MAX_JSON_LENGTH = 100000; // 100KB max
    
    if (!str) return fallback;
    if (typeof str !== 'string') return fallback;
    if (str.length > MAX_JSON_LENGTH) {
        console.error(`[SECURITY] JSON string too long: ${str.length} chars (max ${MAX_JSON_LENGTH})`);
        return fallback;
    }
    
    // ✅ SECURE: Check for prototype pollution patterns
    if (str.includes('__proto__') || str.includes('constructor') || str.includes('prototype')) {
        console.error(`[SECURITY] Blocked JSON with prototype pollution pattern`);
        return fallback;
    }
    
    try {
        return JSON.parse(str);
    } catch (e) {
        return fallback;
    }
}

function updateServerSetting(guildId, setting, value) {
    // Handle null/undefined — store as NULL in SQLite
    if (value === null || value === undefined || value === 'null' || value === 'undefined') {
        value = null;
    }

    if (setting === 'xpboost' && value !== null) {
        const num = parseFloat(value);
        if (isNaN(num) || num < 0.1 || num > 10.0) {
            value = '1.0';
        }
    }

    // Ensure row exists (upsert) before updating
    try {
        const exists = db.prepare('SELECT 1 FROM server_settings WHERE guild_id = ?').get(guildId);
        if (!exists) {
            db.prepare('INSERT OR IGNORE INTO server_settings (guild_id, prefix) VALUES (?, ?)').run(guildId, '.');
        }
    } catch (e) {}
    
    const columnMap = { 
        prefix: 'prefix', 
        welcome: 'welcome_channel', 
        log: 'log_channel', 
        daily: 'daily_channel', 
        shop: 'shop_channel',
        rules: 'rules_channel',
        general: 'general_channel',
        member: 'member_role',
        message: 'welcome_message',
        goodbye: 'goodbye_channel',
        goodbyemsg: 'goodbye_message',
        welcomeChannel: 'welcome_channel',
        welcomeMessage: 'welcome_message',
        welcomeEnabled: 'welcome_enabled',
        goodbyeChannel: 'goodbye_channel',
        goodbyeMessage: 'goodbye_message',
        goodbyeEnabled: 'goodbye_enabled',
        autoRoleId: 'auto_role_id',
        muteRoleId: 'mute_role_id',
        memberRole: 'member_role',
        automodEnabled: 'automod_enabled',
        automodSensitivity: 'automod_sensitivity',
        spamThreshold: 'spam_threshold',
        mentionLimit: 'mention_limit',
        maxWarnings: 'max_warnings',
        warningAction: 'warning_action',
        linkFilterEnabled: 'link_filter_enabled',
        inviteFilterEnabled: 'invite_filter_enabled',
        currencyName: 'currency_name',
        currencyEmoji: 'currency_emoji',
        dailyBonus: 'daily_bonus',
        transferTax: 'transfer_tax',
        xpMultiplier: 'xp_multiplier',
        xpCooldown: 'xp_cooldown',
        aiEnabled: 'ai_enabled',
        afkEnabled: 'afk_enabled',
        marketEnabled: 'market_enabled',
        muterole: 'mute_role_id',
        modlog: 'mod_log_channel',
        autorole: 'auto_role_id',
        xpboost: 'xp_multiplier',
        levelchan: 'level_channel',
        levelupchan: 'levelup_channel',
        afk: 'afk_enabled',
        market: 'market_channel',
        marketenabled: 'market_enabled',
        ai: 'ai_enabled',
        automod: 'automod_enabled',
        automodsensitivity: 'automod_sensitivity',
        automodwhitelist: 'automod_whitelist',
        automodchannels: 'automod_channels',
        automodlog: 'automod_log_channel',
        language: 'language',
        timezone: 'timezone',
        welcome_enabled: 'welcome_enabled',
        goodbye_enabled: 'goodbye_enabled',
        xp_cooldown: 'xp_cooldown',
        xp_min_gain: 'xp_min_gain',
        xp_max_gain: 'xp_max_gain',
        starting_balance: 'starting_balance',
        max_daily_streak: 'max_daily_streak',
        levelup_message: 'levelup_message',
        join_role_id: 'join_role_id',
        disabled_commands: 'disabled_commands',
        disabled_categories: 'disabled_categories',
        spam_threshold: 'spam_threshold',
        spam_window: 'spam_window',
        link_filter: 'link_filter_enabled',
        invite_filter: 'invite_filter_enabled',
        mention_limit: 'mention_limit',
        max_warnings: 'max_warnings',
        warning_action: 'warning_action',
        investorrole: 'investor_role',
        gamerrole: 'gamer_role',
        quizmasterrole: 'quiz_master_role',
        duelistrole: 'duelist_role',
        dailyinitiaterole: 'daily_initiate_role',
        dailywarriorrole: 'daily_warrior_role',
        dailychampionrole: 'daily_champion_role',
        dailylegendrole: 'daily_legend_role',
        xpMinGain: 'xp_min_gain',
        xpMaxGain: 'xp_max_gain',
        startingBalance: 'starting_balance',
        modLogChannel: 'mod_log_channel',
        logChannel: 'log_channel',
        dailyChannel: 'daily_channel',
        shopChannel: 'shop_channel',
        levelupMessage: 'levelup_message',
        levelupChannel: 'levelup_channel',
        automodLogChannel: 'automod_log_channel',
        automodWhitelist: 'automod_whitelist',
        spamWindow: 'spam_window',
        levelChannel: 'level_channel',
        currencyEmoji: 'currency_emoji',
        ticketcategory: 'ticket_category',
        ticketstaffrole: 'ticket_staff_role',
        tickettranscriptchannel: 'ticket_transcript_channel',
        ticketpanelchannel: 'ticket_panel_channel',
        ticketlogchannel: 'ticket_log_channel',
        ticketautoclose: 'ticket_auto_close_hours',
        ticketcategories: 'ticket_categories_config',
        ticketlimit: 'ticket_limit_per_user',
    };
    
    // ✅ SECURE: Strict whitelist validation
    if (!columnMap.hasOwnProperty(setting)) {
        console.error(`[SETTINGS] Rejected invalid setting: ${setting}`);
        return false;
    }
    
    const column = columnMap[setting];
    
    // ✅ SECURE: Additional column name sanitization (defense in depth)
    if (!/^[a-z_][a-z0-9_]*$/.test(column)) {
        console.error(`[SETTINGS] Invalid column name pattern: ${column}`);
        return false;
    }
    
    try {
        db.prepare(`UPDATE server_settings SET ${column} = ?, updated_at = strftime('%s', 'now') WHERE guild_id = ?`).run(value, guildId);
        client.settings.delete(guildId);
        return true;
    } catch (err) {
        console.error(`[SETTINGS] Update error:`, err.message);
        return false;
    }
}

client.getServerSettings = getServerSettings;
client.updateServerSetting = updateServerSetting;

// ================= PER-SERVER COMMAND CONTROL =================
function getServerCommandSettings(guildId, commandName) {
    try {
        const settings = db.prepare(
            'SELECT * FROM server_command_settings WHERE guild_id = ? AND command_name = ?'
        ).get(guildId, commandName);
        
        return settings || { 
            enabled: 1, 
            allowed_roles: null, 
            allowed_channels: null, 
            cooldown_seconds: 0 
        };
    } catch (err) {
        return { enabled: 1, allowed_roles: null, allowed_channels: null, cooldown_seconds: 0 };
    }
}

function updateServerCommandSetting(guildId, commandName, setting, value) {
    try {
        // ✅ SECURE: Strict whitelist for setting columns
        const ALLOWED_SETTINGS = ['enabled', 'allowed_roles', 'allowed_channels', 'cooldown_seconds'];
        if (!ALLOWED_SETTINGS.includes(setting)) {
            console.error(`[CMD SETTINGS] Rejected invalid setting: ${setting}`);
            return false;
        }
        
        // ✅ SECURE: Validate commandName (prevent injection via command name)
        if (!commandName || typeof commandName !== 'string' || commandName.length > 50 || !/^[a-z0-9_-]+$/.test(commandName)) {
            console.error(`[CMD SETTINGS] Invalid command name: ${commandName}`);
            return false;
        }
        
        const existing = db.prepare(
            'SELECT * FROM server_command_settings WHERE guild_id = ? AND command_name = ?'
        ).get(guildId, commandName);
        
        if (!existing) {
            db.prepare(
                'INSERT INTO server_command_settings (guild_id, command_name, enabled) VALUES (?, ?, 1)'
            ).run(guildId, commandName);
        }
        
        // ✅ SECURE: Whitelisted column, still parameterized value
        db.prepare(
            `UPDATE server_command_settings SET ${setting} = ? WHERE guild_id = ? AND command_name = ?`
        ).run(value, guildId, commandName);
        
        return true;
    } catch (err) {
        console.error(`[CMD SETTINGS] Error:`, err.message);
        return false;
    }
}

client.getServerCommandSettings = getServerCommandSettings;
client.updateServerCommandSetting = updateServerCommandSetting;
client.commandCooldowns = new Map();

// ================= SMART COOLDOWN SYSTEM =================
client.cooldowns = new Map();

function checkCooldown(userId, commandName, cooldownMs = 3000) {
    const key = `${userId}:${commandName}`;
    const now = Date.now();
    const lastUsed = client.cooldowns.get(key);

    if (lastUsed && (now - lastUsed) < cooldownMs) {
        const remaining = Math.ceil((cooldownMs - (now - lastUsed)) / 1000);
        return { blocked: true, remaining };
    }

    client.cooldowns.set(key, now);
    return { blocked: false };
}

client.checkCooldown = checkCooldown;

// ================= TIERED COOLDOWN SYSTEM (FIX #11) =================
const COMMAND_COOLDOWN_TIERS = {
    fast: { commands: ['ping', 'help', 'stats', 'whois', 'profile'], cooldown: 2000 },
    normal: { commands: ['daily', 'shop', 'buy', 'credits', 'balance', 'rank', 'leaderboard', 'game', 'trivia'], cooldown: 5000 },
    heavy: { commands: ['backup', 'restore', 'purge', 'massban', 'settings', 'serversettings'], cooldown: 30000 },
    owner: { commands: ['system', 'owner', 'eval', 'exec', 'dbhealth'], cooldown: 1000 }
};

function getCommandCooldown(cmdName) {
    for (const [tier, config] of Object.entries(COMMAND_COOLDOWN_TIERS)) {
        if (config.commands.includes(cmdName)) return config.cooldown;
    }
    return 5000;
}

// ================= DATABASE HEALTH MONITOR =================
function getDatabaseHealth() {
    const now = new Date();
    const nextPurge = new Date(now);
    const daysUntilSunday = (7 - now.getUTCDay()) % 7;
    nextPurge.setUTCDate(now.getUTCDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday));
    nextPurge.setUTCHours(3, 0, 0, 0);

    const stats = {
        size: 'N/A',
        walSize: 'N/A',
        fragmentation: 'N/A',
        nextAutoPurge: `<t:${Math.floor(nextPurge.getTime() / 1000)}:R>`,
        nextAutoPurgeFull: nextPurge.toLocaleString('en-US', { timeZone: 'Africa/Bamako', weekday: 'long', hour: '2-digit', minute: '2-digit' }),
        autoPurgeStatus: ' ACTIVE',
        pendingWrites: client.pendingUserUpdates?.size || 0,
        cachedUsers: client.userDataCache?.size || 0,
        circuitBreaker: client.dbHealth?.circuitOpen ? ' OPEN' : ' CLOSED',
        lastFailure: client.dbHealth?.lastFailure || 0,
        batchWrites: client.lastBatchWrite || 0,
        deadLetters: client._deadLetterQueue?.length || 0
    };
    
    try {
        if (fs.existsSync(path.join(dataDir, 'database.sqlite'))) {
            stats.size = (fs.statSync(path.join(dataDir, 'database.sqlite')).size / 1024 / 1024).toFixed(2) + ' MB';
        }
    } catch (e) {}

    try {
        if (fs.existsSync(path.join(dataDir, 'database.sqlite-wal'))) {
            stats.walSize = (fs.statSync(path.join(dataDir, 'database.sqlite-wal')).size / 1024 / 1024).toFixed(2) + ' MB';
        }
    } catch (e) {}

    try {
        const pageCount = db.pragma('page_count')[0]?.value || 0;
        const freelistCount = db.pragma('freelist_count')[0]?.value || 0;
        const pageSize = db.pragma('page_size')[0]?.value || 0;
        
        if (pageCount > 0) {
            const fragPercent = (freelistCount / pageCount) * 100;
            stats.fragmentation = fragPercent.toFixed(2) + '%';
            stats.freePages = freelistCount;
            stats.totalPages = pageCount;
            stats.wastedBytes = (freelistCount * pageSize);
            stats.wastedMB = ((freelistCount * pageSize) / 1024 / 1024).toFixed(2) + ' MB';
            
            if (fragPercent > 30) {
                stats.fragmentationStatus = ' CRITICAL';
            } else if (fragPercent > 15) {
                stats.fragmentationStatus = ' MODERATE';
            } else {
                stats.fragmentationStatus = ' HEALTHY';
            }
        }
    } catch (e) {
        console.log(`${yellow}[DB HEALTH]${reset} Fragmentation check failed: ${e.message}`);
    }

    return stats;
}

client.getDatabaseHealth = getDatabaseHealth;

// ================= AUTOMATIC WEEKLY DATABASE PURGE =================
async function runWeeklyDatabasePurge() {
    const now = Math.floor(Date.now() / 1000);
    const sevenDaysAgo = now - (7 * 24 * 60 * 60);
    
    try {
        db.transaction(() => {
            const lydiaPurge = db.prepare("DELETE FROM lydia_conversations WHERE timestamp < ?").run(sevenDaysAgo);
            const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
            const modPurge = db.prepare("DELETE FROM moderation_logs WHERE timestamp < ?").run(thirtyDaysAgo);
            const reminderPurge = db.prepare("DELETE FROM reminders WHERE status != 'pending' AND execute_at < ?").run(sevenDaysAgo);
            const warningPurge = db.prepare("UPDATE warnings SET active = 0 WHERE expires_at < ? AND active = 1").run(now);

            console.log(
                `${green}[PURGE]${reset} Cleaned: ` +
                `${lydiaPurge.changes} AI msgs, ` +
                `${modPurge.changes} mod logs, ` +
                `${reminderPurge.changes} old reminders`
            );
        })();

        console.log(`${cyan}[PURGE]${reset} Compacting database file...`);
        db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
        db.exec("VACUUM;");
        
        const dbSize = (fs.statSync(path.join(dataDir, 'database.sqlite')).size / 1024 / 1024).toFixed(2);
        console.log(`${green}[PURGE]${reset} Complete! Database: ${dbSize} MB`);
        
    } catch (err) {
        console.error(`${red}[PURGE ERROR]${reset}`, err.message);
    }
}
client.runWeeklyDatabasePurge = runWeeklyDatabasePurge;

// ================= RATE LIMITER FOR EVENTS =================
const eventRateLimits = new Map();

function rateLimit(key, maxEvents = 5, windowMs = 10000) {
    const now = Date.now();
    const events = eventRateLimits.get(key) || [];
    
    const recent = events.filter(time => now - time < windowMs);
    
    if (recent.length >= maxEvents) {
        return true;
    }
    
    recent.push(now);
    eventRateLimits.set(key, recent);
    return false;
}

client.rateLimit = rateLimit;

// ================= PER-SERVER USER DATA ACCESS LAYER =================
// All user data operations are now scoped to a specific guild.
// The composite key (id, guild_id) ensures complete data isolation.
// Cache and pending update Maps use `${userId}:${guildId}` for O(1) lookups.

// Base query helper - always filters by both userId and guildId
const getUser = (userId, guildId) => db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);

// ================= GET OR CREATE USER (PER-SERVER ISOLATION) =================
// Atomically retrieves or creates a user record for a specific guild partition.
// If creating, reads the server's starting_balance from server_settings so
// server-earned credits are strictly isolated per guild.
const getOrCreateUser = (userId, guildId, username = 'Unknown') => {
    // Attempt atomic get-first to avoid unnecessary writes
    let existing = getUser(userId, guildId);
    if (existing) return existing;

    // Determine starting balance from server settings (isolated per guild)
    let startingBalance = 0;
    if (guildId && guildId !== 'DM') {
        try {
            const row = db.prepare('SELECT starting_balance FROM server_settings WHERE guild_id = ?').get(guildId);
            if (row?.starting_balance !== undefined && row.starting_balance !== null) {
                startingBalance = row.starting_balance;
            }
        } catch (e) {}
    }

    db.prepare(`INSERT INTO users (
        id, guild_id, username, xp, level, credits, streak_days, 
        total_messages, last_xp_gain, games_played, games_won, 
        total_winnings, gaming, created_at, last_seen, last_daily, 
        total_dailies, highest_streak, streak_protections
    ) VALUES (?, ?, ?, 0, 1, ?, 0, 0, 0, 0, 0, 0, '{"game":"CODM","rank":"Unranked"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, 0, 0)`).run(userId, guildId, username, startingBalance);

    return getUser(userId, guildId);
};

// Legacy alias for backward compatibility with plugins
const initializeUser = getOrCreateUser;

client.getUser = getUser;
client.getOrCreateUser = getOrCreateUser;
client.initializeUser = initializeUser;
client.db = db;

// ================= PER-SERVER ECONOMY ISOLATION =================
// All credit operations are strictly scoped to a guildId.
// In DMs, guildId falls back to 'DM' so the user's balance is preserved.

// Atomically add credits to a user's guild-scoped balance
function addCredits(userId, guildId, amount) {
    if (!guildId) guildId = 'DM';
    const safeAmount = Math.max(0, Math.floor(amount || 0));
    if (safeAmount === 0) return { ok: true, previous: 0, current: 0, added: 0 };

    try {
        const row = getOrCreateUser(userId, guildId, 'Unknown');
        const previous = row?.credits || 0;
        const current = previous + safeAmount;

        db.prepare('UPDATE users SET credits = ? WHERE id = ? AND guild_id = ?').run(current, userId, guildId);

        // Update cache if present
        const compositeKey = `${userId}:${guildId}`;
        const cached = client.userDataCache.get(compositeKey);
        if (cached) { cached.credits = current; cached._lastAccess = Date.now(); }

        return { ok: true, previous, current, added: safeAmount };
    } catch (err) {
        console.error(`${red}[ECONOMY]${reset} addCredits failed for ${userId}@${guildId}:`, err.message);
        return { ok: false, error: err.message };
    }
}

// Atomically remove credits from a user's guild-scoped balance
function removeCredits(userId, guildId, amount) {
    if (!guildId) guildId = 'DM';
    const safeAmount = Math.max(0, Math.floor(amount || 0));
    if (safeAmount === 0) return { ok: true, previous: 0, current: 0, removed: 0 };

    try {
        const row = getOrCreateUser(userId, guildId, 'Unknown');
        const previous = row?.credits || 0;
        if (previous < safeAmount) {
            return { ok: false, error: 'INSUFFICIENT_FUNDS', previous, required: safeAmount };
        }
        const current = previous - safeAmount;

        db.prepare('UPDATE users SET credits = ? WHERE id = ? AND guild_id = ?').run(current, userId, guildId);

        // Update cache if present
        const compositeKey = `${userId}:${guildId}`;
        const cached = client.userDataCache.get(compositeKey);
        if (cached) { cached.credits = current; cached._lastAccess = Date.now(); }

        return { ok: true, previous, current, removed: safeAmount };
    } catch (err) {
        console.error(`${red}[ECONOMY]${reset} removeCredits failed for ${userId}@${guildId}:`, err.message);
        return { ok: false, error: err.message };
    }
}

client.addCredits = addCredits;
client.removeCredits = removeCredits;

// ================= UNIFIED ROLE GATEKEEPER =================
const ROLE_SOURCES = {
    LEVELING: 'leveling',
    SHOP: 'shop',
    GAME: 'game',
    EVENT: 'event',
    ADMIN: 'admin',
    BIRTHDAY: 'birthday',
    SYSTEM: 'system'
};

async function assignRole(guild, userId, roleName, roleColor, source, detail = '') {
    try {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return { ok: false, why: 'member_not_found' };

        let role = guild.roles.cache.find(r => r.name === roleName);
        if (!role) {
            role = await guild.roles.create({
                name: roleName,
                color: roleColor || '#95a5a6',
                reason: `[${source}] ${detail}`
            });
        }

        const alreadyLogged = db.prepare(
            'SELECT assigned_at FROM bot_roles WHERE guild_id = ? AND user_id = ? AND role_id = ?'
        ).get(guild.id, userId, role.id);

        const hasOnDiscord = member.roles.cache.has(role.id);

        if (alreadyLogged && hasOnDiscord) {
            return { ok: true, why: 'already_has', role, duplicate: true, silent: true };
        }

        if (alreadyLogged && !hasOnDiscord) {
            await member.roles.add(role, `[${source}] Restored (was missing)`);
            return { ok: true, why: 'restored', role, duplicate: false };
        }

        await member.roles.add(role, `[${source}] ${detail}`);
        
        db.prepare(
            'INSERT OR IGNORE INTO bot_roles (guild_id, user_id, role_id, role_name, source) VALUES (?, ?, ?, ?, ?)'
        ).run(guild.id, userId, role.id, roleName, source);

        return { ok: true, why: 'assigned', role, duplicate: false };

    } catch (err) {
        return { ok: false, why: err.message };
    }
}

function getAssignedRoles(guildId, userId) {
    return db.prepare(
        'SELECT role_name, source, assigned_at FROM bot_roles WHERE guild_id = ? AND user_id = ? ORDER BY assigned_at DESC'
    ).all(guildId, userId);
}

client.assignRole = assignRole;
client.getAssignedRoles = getAssignedRoles;
client.ROLE_SOURCES = ROLE_SOURCES;

// ================= OPTIMIZED DATABASE WRITE SYSTEM =================
// Per-server partitioning: All cache and pending update keys use `${userId}:${guildId}
// This ensures O(1) lookups while maintaining complete data isolation per guild.

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

// Cache user data using composite key ${userId}:${guildId}
function cacheUserData(userId, guildId, userData) {
    const compositeKey = `${userId}:${guildId}`;
    client.userDataCache.set(compositeKey, {
        ...userData,
        _cachedAt: Date.now(),
        _lastAccess: Date.now()
    });
}

// Retrieve user data from cache or database, scoped to a specific guild
function getUserData(userId, guildId) {
    const compositeKey = `${userId}:${guildId}`;
    const cached = client.userDataCache.get(compositeKey);
    if (cached) {
        cached._lastAccess = Date.now();
        return cached;
    }
    
    const dbUser = getUser(userId, guildId);
    if (dbUser) {
        cacheUserData(userId, guildId, dbUser);
    }
    return dbUser;
}

function queueUserUpdate(userId, guildId, updateData) {
    const compositeKey = `${userId}:${guildId}`;
    let fullUserData = client.userDataCache.get(compositeKey);
    
    if (!fullUserData) {
        fullUserData = getUser(userId, guildId);
        if (!fullUserData) {
            fullUserData = getOrCreateUser(userId, guildId, updateData.username || 'Unknown');
        }
        cacheUserData(userId, guildId, fullUserData);
    }
    
    // ✅ SECURE: Prevent prototype pollution - sanitize keys
    const safeUpdateData = {};
    for (const key of Object.keys(updateData)) {
        // Reject prototype-polluting keys
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
            console.error(`[SECURITY] Blocked prototype pollution attempt: ${key}`);
            continue;
        }
        safeUpdateData[key] = updateData[key];
    }
    
    // ✅ SECURE: Use Object.assign with null prototype for safety
    const mergedData = Object.assign(Object.create(null), fullUserData, safeUpdateData, {
        _queuedAt: Date.now(),
        _lastAccess: Date.now()
    });
    
        client.pendingUserUpdates.set(compositeKey, mergedData);
    cacheUserData(userId, guildId, mergedData);
    
    if (client.pendingUserUpdates.size >= WRITE_STRATEGY.BATCH_SIZE) {
        flushUserUpdates(0);
    }
}
// Flush pending user updates to database using INSERT OR REPLACE
// Composite key (id, guild_id) is destructured from the Map key
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
                        id, guild_id, username, xp, level, total_messages, last_xp_gain, 
                        games_played, games_won, total_winnings, gaming, credits, 
                        streak_days, last_daily, total_dailies, highest_streak, streak_protections
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                
                db.transaction(() => {
                    for (const [compositeKey, userData] of updates) {
                        const [userId, guildId] = compositeKey.split(':');
                        
                        let gamingValue = userData.gaming;
                        if (typeof gamingValue === 'object' && gamingValue !== null) {
                            gamingValue = JSON.stringify(gamingValue);
                        } else if (!gamingValue) {
                            gamingValue = '{"game":"CODM","rank":"Unranked"}';
                        }
                        
                        updateStmt.run(
                            userId,                           // 1: id
                            guildId,                          // 2: guild_id (composite PK)
                            userData.username || 'Unknown',   // 3
                            userData.xp ?? 0,                 // 4
                            userData.level ?? 1,              // 5
                            userData.total_messages ?? 0,     // 6
                            userData.last_xp_gain ?? 0,       // 7
                            userData.games_played ?? 0,       // 8
                            userData.games_won ?? 0,          // 9
                            userData.total_winnings ?? 0,     // 10
                            gamingValue,                      // 11
                            userData.credits ?? 0,            // 12
                            userData.streak_days ?? 0,        // 13
                            userData.last_daily ?? 0,         // 14
                            userData.total_dailies ?? 0,      // 15
                            userData.highest_streak ?? 0,     // 16
                            userData.streak_protections ?? 0  // 17
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
        
        console.log(`${green}[DB BATCH]${reset} Flushed ${updates.length} user updates (per-server partitioned)`);
        
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
            
            for (const [compositeKey, userData] of updates) {
                if (!client.pendingUserUpdates.has(compositeKey)) {
                    client.pendingUserUpdates.set(compositeKey, { ...userData, _retryCount: retryCount + 1 });
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
            updates.forEach(([compositeKey, userData]) => {
                const [userId, guildId] = compositeKey.split(':');
                client._deadLetterQueue.push({
                    userId,
                    guildId,
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
                    await channel.send(` **REMINDER** <@${r.user_id}> : ${r.message}`);
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

// Cache janitor uses composite keys for consistency
function pruneUserCache() {
    const now = Date.now();
    let prunedCount = 0;
    
    for (const [compositeKey, userData] of client.userDataCache.entries()) {
        if (client.pendingUserUpdates.has(compositeKey)) continue;
        
        const lastAccess = userData._lastAccess || userData._cachedAt || 0;
        if (now - lastAccess > CACHE_CONFIG.MAX_AGE_MS) {
            client.userDataCache.delete(compositeKey);
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
        fr: { name: 'Pack Nouvelle Recrue', desc: 'Un petit boost pour les nouveaux agents.', perk: '+100 XP & +50 Credits' } 
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
        emoji: '⚡', 
        type: 'consumable', 
        effect: { xp: 1000 },
        en: { name: 'Quantum XP Overdrive', desc: 'Massive XP injection.', perk: '+1000 XP instantly' },
        fr: { name: 'Overdrive XP Quantique', desc: 'Injection massive d\'XP.', perk: '+1000 XP instantanement' } 
    },
    { 
        id: 'credit_boost_small', 
        price: 300, 
        emoji: '🪙', 
        type: 'consumable', 
        effect: { credits: 200 },
        en: { name: 'Credit Injection', desc: 'Small credit boost.', perk: '+200 Credits' },
        fr: { name: 'Injection de Credits', desc: 'Petit boost de credits.', perk: '+200 Credits' } 
    },
    { 
        id: 'credit_boost_large', 
        price: 1500, 
        emoji: '💰', 
        type: 'consumable', 
        effect: { credits: 1000 },
        en: { name: 'Credit Surge', desc: 'Major credit injection.', perk: '+1000 Credits' },
        fr: { name: 'Afflux de Credits', desc: 'Injection majeure de credits.', perk: '+1000 Credits' } 
    },
    { 
        id: 'vip_role', 
        price: 10000, 
        emoji: '💎', 
        type: 'role',
        roleId: process.env.VIP_ROLE_ID,
        requirement: { level: 25 },
        en: { name: 'VIP Status', desc: 'Exclusive VIP role and perks.', perk: 'VIP Role + Special Channel Access' },
        fr: { name: 'Statut VIP', desc: 'Role VIP exclusif et avantages.', perk: 'Role VIP + Acces Salon Special' } 
    },
    // ── BADGES ──
    {
        id: 'badge_eagle', price: 5000, emoji: '🦅', type: 'badge', rarity: 'rare',
        en: { name: 'Eagle Badge', desc: 'Elite Eagle Community emblem.', perk: 'Display on profile' },
        fr: { name: 'Badge Aigle', desc: 'Emblème élite communauté Eagle.', perk: 'Afficher sur le profil' }
    },
    {
        id: 'badge_neural', price: 3000, emoji: '🔮', type: 'badge', rarity: 'uncommon',
        en: { name: 'Neural Grid Badge', desc: 'Neural grid operative emblem.', perk: 'Display on profile' },
        fr: { name: 'Badge Réseau Neural', desc: 'Emblème opérateur neural.', perk: 'Afficher sur le profil' }
    },
    {
        id: 'badge_architect', price: 50000, emoji: '👑', type: 'badge', rarity: 'legendary',
        en: { name: 'Architect Badge', desc: 'Supreme architect emblem.', perk: 'Display on profile' },
        fr: { name: 'Badge Architecte', desc: 'Emblème suprême architecte.', perk: 'Afficher sur le profil' }
    },
    {
        id: 'badge_steel', price: 7500, emoji: '⚙️', type: 'badge', rarity: 'epic',
        en: { name: 'Steel Node Badge', desc: 'BAMAKO-STEEL-NODE operative badge.', perk: 'Display on profile' },
        fr: { name: 'Badge Nœud Acier', desc: 'Badge opérateur BAMAKO-STEEL-NODE.', perk: 'Afficher sur le profil' }
    },
    { 
        id: 'verified_role', 
        price: 5000, 
        emoji: '✅', 
        type: 'role',
        roleId: process.env.VERIFIED_ROLE_ID,
        requirement: { level: 10 },
        en: { name: 'Verified Agent', desc: 'Verified status in the community.', perk: 'Verified Role + Trust Badge' },
        fr: { name: 'Agent Verifie', desc: 'Statut verifie dans la communaute.', perk: 'Role Verifie + Badge de Confiance' } 
    },
    { 
        id: 'badge_pioneer', 
        price: 8000, 
        emoji: '🏅', 
        type: 'badge',
        requirement: { level: 5 },
        en: { name: 'Pioneer Badge', desc: 'Shows on your profile.', perk: '🏅 Pioneer Badge' },
        fr: { name: 'Badge Pionnier', desc: 'Affiche sur votre profil.', perk: '🏅 Badge Pionnier' } 
    },
    { 
        id: 'badge_bamako', 
        price: 10000, 
        emoji: '🇲🇱', 
        type: 'badge',
        requirement: { level: 15 },
        en: { name: 'Bamako Pride Badge', desc: 'Mali heritage badge.', perk: '🇲🇱 Bamako Pride Badge' },
        fr: { name: 'Badge Fierté Bamako', desc: 'Badge heritage malien.', perk: '🇲🇱 Badge Fierté Bamako' } 
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
        fr: { name: 'Boite Mystere Bronze', desc: 'Contient des recompenses aleatoires !', perk: 'XP ou Credits Aleatoires' } 
    },
    { 
        id: 'daily_streak_shield', 
        price: 2000, 
        emoji: '🛡️', 
        type: 'consumable',
        effect: { streak_protection: true },
        en: { name: 'Streak Shield', desc: 'Protects your daily streak if missed.', perk: '1x Streak Protection' },
        fr: { name: 'Bouclier de Serie', desc: 'Protege votre serie quotidienne.', perk: '1x Protection de Serie' } 
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
const telegramBridge = require('./telegram/bridge.js');
client.telegramBridge = telegramBridge.initialize(client);

const telegramBot = require('./telegram/bot.js');
telegramBot.initialize(client);

const bridgeStatus = client.telegramBridge.status();
if (bridgeStatus.configured) {
    console.log(`${cyan}[TELEGRAM]${reset} Bridge v1.7.0 configured - Auto-activating on boot`);
} else {
    console.log(`${yellow}[TELEGRAM]${reset} Bridge not configured - Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to .env`);
}

// ================= PLUGIN LOADER — SUPREME NEURAL GRID v3.0 =================
client.loadPlugins = async () => {
    client.commands.clear();
    client.aliases.clear();
    
    const pluginPath = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginPath)) fs.mkdirSync(pluginPath);

    const pluginFiles = fs.readdirSync(pluginPath).filter(file => 
    file.endsWith('.js') && file !== 'lydia.js' && file !== 'market-manager.js'
);
    
    // ═══════════════════════════════════════════════════════════════════
    //  NEURAL GRID BOOT SEQUENCE — MODULE SYNCHRONIZATION
    // ═══════════════════════════════════════════════════════════════════
    const banner = `
\x1b[38;5;39m    ╔══════════════════════════════════════════════════════════════════════╗
\x1b[38;5;45m    ║  \x1b[1;33m  ARCHON CG-223\x1b[0m  \x1b[38;5;45m║  \x1b[1;32mNEURAL SYNAPSE // MODULE SYNCHRONIZATION\x1b[0m  \x1b[38;5;45m║
\x1b[38;5;51m    ╠══════════════════════════════════════════════════════════════════════╣
\x1b[38;5;51m    ║  \x1b[36mEstablishing neural links to command modules...\x1b[0m                      \x1b[38;5;51m║
\x1b[38;5;45m    ╚══════════════════════════════════════════════════════════════════════╝\x1b[0m`;
    console.log(banner);

    const loadedCommands = [];
    const failedCommands = [];
    const moduleStats = { discord: 0, telegram: 0, total: 0, aliases: 0, slash: 0 };
    
    // ── DISCORD MODULES ──
    for (const file of pluginFiles) {
        try {
            await sleep(50);
            const filePath = path.join(pluginPath, file);
            delete require.cache[require.resolve(filePath)];
            const command = require(filePath);

            if (command.name && command.run) {
                client.commands.set(command.name, command);
                if (command.aliases && Array.isArray(command.aliases)) {
                    command.aliases.forEach(a => client.aliases.set(a, command.name));
                }
                
                const category = command.category || 'GENERAL';
                loadedCommands.push({ 
                    name: command.name, 
                    category, 
                    aliases: command.aliases?.length || 0,
                    hasSlash: !!command.data,
                    source: 'DISCORD',
                    file
                });
                moduleStats.discord++;
                moduleStats.total++;
                moduleStats.aliases += command.aliases?.length || 0;
                if (command.data) moduleStats.slash++;
            }
        } catch (error) { 
            failedCommands.push({ file, error: error.message, source: 'DISCORD' });
        }
    }
    
    // ── TELEGRAM BRIDGE MODULES ──
    const telegramPath = path.join(__dirname, 'telegram');
    if (fs.existsSync(telegramPath)) {
        const telegramFiles = fs.readdirSync(telegramPath).filter(file => 
            file.endsWith('.js') && file !== 'bridge.js' && file !== 'bot.js'
        );
        
        for (const file of telegramFiles) {
            try {
                await sleep(50);
                const filePath = path.join(telegramPath, file);
                delete require.cache[require.resolve(filePath)];
                const command = require(filePath);

                if (command.name && command.run) {
                    client.commands.set(command.name, command);
                    if (command.aliases && Array.isArray(command.aliases)) {
                        command.aliases.forEach(a => client.aliases.set(a, command.name));
                    }
                    
                    const category = command.category || 'SYSTEM';
                    loadedCommands.push({ 
                        name: command.name, 
                        category, 
                        aliases: command.aliases?.length || 0,
                        hasSlash: !!command.data,
                        source: 'TELEGRAM',
                        file: `telegram/${file}`
                    });
                    moduleStats.telegram++;
                    moduleStats.total++;
                    moduleStats.aliases += command.aliases?.length || 0;
                    if (command.data) moduleStats.slash++;
                }
            } catch (error) { 
                failedCommands.push({ file: `telegram/${file}`, error: error.message, source: 'TELEGRAM' });
            }
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    //  NEURAL GRID DISPLAY — CATEGORY MATRIX
    // ═══════════════════════════════════════════════════════════════════
    loadedCommands.sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.name.localeCompare(b.name);
    });
    
    const categories = [...new Set(loadedCommands.map(c => c.category))].sort();
    
    // Header separator
    console.log(`\x1b[38;5;39m    ╔══════════════════════════════════════════════════════════════════════╗\x1b[0m`);
    
    for (const category of categories) {
        const categoryCommands = loadedCommands.filter(c => c.category === category);
        const discordCmds = categoryCommands.filter(c => c.source === 'DISCORD');
        const telegramCmds = categoryCommands.filter(c => c.source === 'TELEGRAM');
        
        const catEmoji = getCategoryEmoji(category);
        const totalCmds = categoryCommands.length;
        const aliasCount = categoryCommands.reduce((sum, c) => sum + c.aliases, 0);
        const slashCount = categoryCommands.filter(c => c.hasSlash).length;
        
        // Category header
        console.log(`\x1b[38;5;39m    ╠══════════════════════════════════════════════════════════════════════╣\x1b[0m`);
        console.log(`\x1b[38;5;39m    ║\x1b[0m  ${catEmoji} \x1b[1;33m${category.padEnd(12)}\x1b[0m  \x1b[32m${String(totalCmds).padStart(2)} CMDS\x1b[0m  \x1b[34m${String(aliasCount).padStart(2)} ALIAS\x1b[0m  \x1b[35m${String(slashCount).padStart(2)} SLASH\x1b[0m  ${discordCmds.length > 0 ? '\x1b[36m💬\x1b[0m' : '  '} ${telegramCmds.length > 0 ? '\x1b[36m🌉\x1b[0m' : '  '}                    \x1b[38;5;39m║\x1b[0m`);
        console.log(`\x1b[38;5;39m    ╠══════════════════════════════════════════════════════════════════════╣\x1b[0m`);
        
        // Discord modules
        if (discordCmds.length > 0) {
            const itemsPerRow = 3;
            for (let i = 0; i < discordCmds.length; i += itemsPerRow) {
                const row = discordCmds.slice(i, i + itemsPerRow);
                let rowText = `\x1b[38;5;39m    ║\x1b[0m  \x1b[36m💬\x1b[0m `;
                
                row.forEach(cmd => {
                    const displayName = cmd.name.length > 11 ? cmd.name.substring(0, 9) + '..' : cmd.name.padEnd(11);
                    const aliasInfo = cmd.aliases > 0 ? `\x1b[33m[${cmd.aliases}]\x1b[0m` : '   ';
                    const slashBadge = cmd.hasSlash ? '\x1b[32m/\x1b[0m' : ' ';
                    rowText += `\x1b[32m${displayName}\x1b[0m${aliasInfo}${slashBadge} `.padEnd(26);
                });
                
                const emptySlots = itemsPerRow - row.length;
                if (emptySlots > 0) rowText += ' '.repeat(emptySlots * 26);
                
                console.log(`${rowText}\x1b[38;5;39m║\x1b[0m`);
            }
        }
        
        // Telegram modules
        if (telegramCmds.length > 0) {
            const itemsPerRow = 3;
            for (let i = 0; i < telegramCmds.length; i += itemsPerRow) {
                const row = telegramCmds.slice(i, i + itemsPerRow);
                let rowText = `\x1b[38;5;39m    ║\x1b[0m  \x1b[36m🌉\x1b[0m `;
                
                row.forEach(cmd => {
                    const displayName = cmd.name.length > 11 ? cmd.name.substring(0, 9) + '..' : cmd.name.padEnd(11);
                    const aliasInfo = cmd.aliases > 0 ? `\x1b[33m[${cmd.aliases}]\x1b[0m` : '   ';
                    const slashBadge = cmd.hasSlash ? '\x1b[32m/\x1b[0m' : ' ';
                    rowText += `\x1b[36m${displayName}\x1b[0m${aliasInfo}${slashBadge} `.padEnd(26);
                });
                
                const emptySlots = itemsPerRow - row.length;
                if (emptySlots > 0) rowText += ' '.repeat(emptySlots * 26);
                
                console.log(`${rowText}\x1b[38;5;39m║\x1b[0m`);
            }
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    //  NEURAL GRID FOOTER — STATISTICS MATRIX
    // ═══════════════════════════════════════════════════════════════════
    console.log(`\x1b[38;5;39m    ╠══════════════════════════════════════════════════════════════════════╣\x1b[0m`);
    console.log(`\x1b[38;5;39m    ║\x1b[0m  \x1b[32m💬 DISCORD:\x1b[0m ${String(moduleStats.discord).padEnd(4)}  \x1b[36m🌉 TELEGRAM:\x1b[0m ${String(moduleStats.telegram).padEnd(4)}  \x1b[33m🔗 ALIASES:\x1b[0m ${String(moduleStats.aliases).padEnd(4)}  \x1b[35m📊 CATEGORIES:\x1b[0m ${String(categories.length).padEnd(3)}  \x1b[32m⚡ SLASH:\x1b[0m ${String(moduleStats.slash).padEnd(3)}  \x1b[38;5;39m║\x1b[0m`);
    console.log(`\x1b[38;5;39m    ║\x1b[0m  \x1b[32m✅ LOADED:\x1b[0m ${String(moduleStats.total).padEnd(5)}  \x1b[31m❌ FAILED:\x1b[0m ${String(failedCommands.length).padEnd(5)}  \x1b[34m📡 SERVERS:\x1b[0m ${String(client.guilds.cache.size).padEnd(5)}  \x1b[33m🧠 STATUS:\x1b[0m \x1b[5;32mONLINE\x1b[0m                    \x1b[38;5;39m║\x1b[0m`);
    
    if (failedCommands.length > 0) {
        console.log(`\x1b[38;5;39m    ╠══════════════════════════════════════════════════════════════════════╣\x1b[0m`);
        failedCommands.forEach(f => {
            const sourceTag = f.source === 'TELEGRAM' ? '\x1b[36m🌉' : '\x1b[32m💬';
            const errTrunc = f.error.substring(0, 40).padEnd(40);
            console.log(`\x1b[38;5;39m    ║\x1b[0m  \x1b[31m❌\x1b[0m ${sourceTag} ${f.file}\x1b[0m \x1b[33m→\x1b[0m ${errTrunc} \x1b[38;5;39m║\x1b[0m`);
        });
    }
    
    console.log(`\x1b[38;5;39m    ╚══════════════════════════════════════════════════════════════════════╝\x1b[0m\n`);
    
        // Final status line
    const statusColor = failedCommands.length === 0 ? '\x1b[32m' : '\x1b[33m';
    console.log(`${statusColor}[NEURAL GRID]\x1b[0m ${moduleStats.total} modules synchronized • ${moduleStats.slash} slash-enabled • ${failedCommands.length > 0 ? failedCommands.length + ' failures' : 'All systems nominal'}`);
};

// ================= SMART PLUGIN EXECUTION WRAPPER =================
const COMMAND_PARAM_MAP = {
    'client': 'client',
    'message': 'message', 
    'msg': 'message',
    'args': 'args',
    'arg': 'args',
    'db': 'db',
    'database': 'db',
    'usedCommand': 'usedCommand',
    'cmd': 'usedCommand',
    'command': 'usedCommand',
    'serverSettings': 'serverSettings',
    'settings': 'serverSettings',
    'lang': 'lang',
    'language': 'lang',
    'guild': 'message.guild',
    'interaction': 'interaction'
};

// VERSION ORIGINALE (avant notre modif)
async function executePluginCommand(command, client, message, args, db, usedCommand, serverSettings, lang = 'en') {
    const argsMap = { client, message, args, db, usedCommand, serverSettings, lang };
    
    let paramOrder;
    if (command.params && Array.isArray(command.params)) {
        paramOrder = command.params;
    } else if (command.run.length > 0) {
        const defaultParams = ['client', 'message', 'args', 'db', 'usedCommand', 'serverSettings', 'lang'];
        paramOrder = defaultParams.slice(0, command.run.length);
    } else {
        paramOrder = ['client', 'message', 'args', 'db', 'usedCommand', 'serverSettings', 'lang'];
    }
    
    const filteredArgs = paramOrder.map(param => argsMap[param]).filter(arg => arg !== undefined);
    return await command.run(...filteredArgs);
} // 🌟

// ================= BOOT SEQUENCE =================
client.once(Events.ClientReady, async () => {
    const isPM2 = process.env.pm_id !== undefined || process.env.name === 'Architect-CG223';
    
    if (!isPM2) {
        console.clear();
    }

    displayPM2Banner();

    await client.loadPlugins();

// ================= PLUGIN EVENT REFERENCES =================
// Store references to plugins that need event hooks
const leveling = client.commands.get('leveling');
if (leveling?.onMemberAdd) { client.leveling = leveling; console.log(`${green}[LEVELING]${reset} Event hooks registered`); }
const welcomeMod = client.commands.get('welcome');
if (welcomeMod?.onMemberAdd) { client.welcome = welcomeMod; console.log(`${green}[WELCOME]${reset} Event hooks registered`); }

// ----- FULLY AUTOMATIC BILINGUAL ALIAS MAP -----
function buildAliasLanguageMap() {
    client.aliasLang.clear();
    for (const [cmdName, cmd] of client.commands) {
        // Main command name
        client.aliasLang.set(cmdName.toLowerCase(), detectLanguage(cmdName));
        // All aliases
        if (cmd.aliases && Array.isArray(cmd.aliases)) {
            for (const alias of cmd.aliases) {
                client.aliasLang.set(alias.toLowerCase(), detectLanguage(alias));
            }
        }
    }
    console.log(`${green}[LANG]${reset} Auto‑built alias map with ${client.aliasLang.size} entries`);
}
buildAliasLanguageMap();

    // ================= HEAP GUARDIAN - MEMORY LEAK DEFENSE =================
    try {
        const HeapGuardian = require('./plugins/heap-guardian.js');
        client.heapGuardian = new HeapGuardian(client);
        client.heapGuardian.start();
        console.log(`${green}[HEAP]${reset} Guardian active | WARN:300MB SNAP:500MB CRIT:700MB`);
    } catch (err) {
        console.log(`${yellow}[HEAP]${reset} Not loaded: ${err.message}`);
    }

    // ================= INITIALIZE LYDIA AI =================
    let lydiaModule;
    try {
        lydiaModule = require('./plugins/lydia.js');
        setupLydia(client, db);
        // Register lydia in client.commands so slash command registration picks it up
        if (lydiaModule.name && lydiaModule.run && !client.commands.has(lydiaModule.name)) {
            client.commands.set(lydiaModule.name, lydiaModule);
            if (lydiaModule.aliases && Array.isArray(lydiaModule.aliases)) {
                lydiaModule.aliases.forEach(a => client.aliases.set(a, lydiaModule.name));
            }
            console.log(`${green}[INIT]${reset} Lydia Multi-Agent AI initialized + registered in command map`);
        } else {
            console.log(`${green}[INIT]${reset} Lydia Multi-Agent AI initialized`);
        }
    } catch (err) {
        console.error(`${red}[INIT ERROR]${reset} Lydia failed to initialize: ${err.message}`);
    }

    // ================= INITIALIZE TICKET SYSTEM =================
    try {
        const ticketModule = require('./plugins/ticket.js');
        if (ticketModule.setupTicketDB) ticketModule.setupTicketDB(db);
        if (ticketModule.loadAllTicketsFromDB) ticketModule.loadAllTicketsFromDB(db, client);
        console.log(`${green}[INIT]${reset} Ticket system initialized with DB persistence`);
    } catch (err) {
        console.error(`${red}[INIT ERROR]${reset} Ticket system failed: ${err.message}`);
    }

    // ================= INITIALIZE REMINDER SYSTEM =================
    try {
        const reminderModule = require('./plugins/reminder.js');
        if (reminderModule.setupReminderDB) reminderModule.setupReminderDB(db);
        if (reminderModule.rehydrateReminders) reminderModule.rehydrateReminders(client, db);
        console.log(`${green}[INIT]${reset} Reminder system initialized with DB persistence`);
    } catch (err) {
        console.error(`${red}[INIT ERROR]${reset} Reminder system failed: ${err.message}`);
    }

    // ================= INITIALIZE DAILY DM REMINDER SYSTEM =================
    try {
        const claimModule = require('./plugins/claim.js');
        if (claimModule.setupDailyReminderDB) claimModule.setupDailyReminderDB(db);
        if (claimModule.rehydrateDailyReminders) claimModule.rehydrateDailyReminders(client, db);
        console.log(`${green}[INIT]${reset} Daily DM reminder system initialized`);
    } catch (err) {
        console.error(`${red}[INIT ERROR]${reset} Daily DM reminder failed: ${err.message}`);
    }

    // ================= INITIALIZE BOT STATS ENGINE =================
    try {
        const botStatsModule = require('./plugins/bot-stats.js');
        if (botStatsModule.setupBotStatsDB) botStatsModule.setupBotStatsDB(db);
        client.botStats = botStatsModule;
        console.log(`${green}[INIT]${reset} Bot stats engine initialized — bot earns XP per command`);
    } catch (err) {
        console.error(`${red}[INIT ERROR]${reset} Bot stats failed: ${err.message}`);
    }

    // ================= NEURAL CHANGELOG ENGINE v4.0 - PER-SERVER PARTITIONING REGISTRY =================
    try {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toLocaleString('en-US', { timeZone: 'Africa/Bamako', hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const timestamp = Math.floor(now.getTime() / 1000);
        
        // ================= GATHER COMPREHENSIVE METRICS =================
        const totalGuilds = client.guilds.cache.size;
        const totalUsers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
        const totalCommands = client.commands.size;
        const totalAliases = client.aliases.size;
        const memoryMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
        const memoryTotal = (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(1);
        const memoryRSS = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
        const uptime = process.uptime();
        const uptimeDays = Math.floor(uptime / 86400);
        const uptimeHours = Math.floor((uptime % 86400) / 3600);
        const uptimeMinutes = Math.floor((uptime % 3600) / 60);
        const botVersion = client.version || '2.0.0';
        const wsPing = client.ws.ping;
        const nodeVersion = process.version;
        const platform = process.platform;
        const arch = process.arch;
        
        // ================= PER-TABLE DATABASE STATS (FAULT-TOLERANT) =================
        const safeQuery = (query, params = [], fallback = 0) => {
            try {
                const result = db.prepare(query).get(...(Array.isArray(params) ? params : [params]));
                return result?.count ?? fallback;
            } catch (e) {
                console.log(`${yellow}[CHANGELOG DB]${reset} Query failed: ${e.message} | Query: ${query.substring(0, 50)}`);
                return fallback;
            }
        };
        
        // ================= COMPOSITE KEY AWARE QUERIES =================
        let dbStats = {
            totalUserPartitions: safeQuery('SELECT COUNT(*) as count FROM users'),
            totalUniqueUsers: safeQuery('SELECT COUNT(DISTINCT id) as count FROM users'),
            totalGuildPartitions: safeQuery('SELECT COUNT(DISTINCT guild_id) as count FROM users'),
            totalWarnings: safeQuery('SELECT COUNT(*) as count FROM warnings WHERE active = 1'),
            totalReminders: safeQuery('SELECT COUNT(*) as count FROM reminders WHERE status = \'pending\''),
            totalInvestments: safeQuery('SELECT COUNT(*) as count FROM investments WHERE claimed = 0'),
            totalBirthdays: safeQuery('SELECT COUNT(*) as count FROM birthdays'),
            totalTransfers: safeQuery('SELECT COUNT(*) as count FROM transfers'),
            totalServerConfigs: safeQuery('SELECT COUNT(*) as count FROM server_settings'),
            totalLydiaMemories: safeQuery('SELECT COUNT(*) as count FROM lydia_memory'),
            dbSize: 'N/A'
        };
        
        try {
            if (fs.existsSync('./database.sqlite')) {
                dbStats.dbSize = (fs.statSync('./database.sqlite').size / 1024 / 1024).toFixed(2);
            }
        } catch (e) {}

        const dbHealthy = dbStats.totalUserPartitions > 0 || dbStats.totalServerConfigs > 0;
        
        // ================= PER-SERVER STATISTICS (COMPOSITE KEY AWARE) =================
        const serverStats = [];
        for (const [guildId, guild] of client.guilds.cache) {
            try {
                const guildUsers = safeQuery('SELECT COUNT(*) as count FROM users WHERE guild_id = ?', [guildId], 0);
                const guildXP = db.prepare(`SELECT SUM(xp) as total FROM users WHERE guild_id = ?`).get(guildId)?.total || 0;
                const guildLevel = db.prepare(`SELECT AVG(level) as avg FROM users WHERE guild_id = ?`).get(guildId)?.avg || 0;
                
                serverStats.push({
                    name: guild.name,
                    members: guild.memberCount,
                    boostTier: guild.premiumTier,
                    registeredUsers: guildUsers,
                    totalXP: guildXP,
                    avgLevel: guildLevel.toFixed(1)
                });
            } catch (e) {}
        }
        
        serverStats.sort((a, b) => b.members - a.members);
        
        // ================= DETECT REAL CHANGES =================
        let changesDetected = [];
        const previousStateFile = path.join(dataDir, '.bot_state.json');
        let previousState = {};
        
        try {
            if (fs.existsSync(previousStateFile)) {
                previousState = JSON.parse(fs.readFileSync(previousStateFile, 'utf8'));
            }
        } catch(e) {}
        
        if (previousState.commands && previousState.commands !== totalCommands) {
            const diff = totalCommands - previousState.commands;
            changesDetected.push({
                type: 'commands',
                icon: '⚡',
                detail: `${diff > 0 ? 'Added' : 'Removed'} ${Math.abs(diff)} command${Math.abs(diff) !== 1 ? 's' : ''}`,
                from: previousState.commands,
                to: totalCommands
            });
        }
        if (previousState.servers && previousState.servers !== totalGuilds) {
            const diff = totalGuilds - previousState.servers;
            changesDetected.push({
                type: 'servers',
                icon: '🌍',
                detail: `${diff > 0 ? 'Joined' : 'Left'} ${Math.abs(diff)} server${Math.abs(diff) !== 1 ? 's' : ''}`,
                from: previousState.servers,
                to: totalGuilds
            });
        }
        if (previousState.users && Math.abs(previousState.users - totalUsers) > 50) {
            changesDetected.push({
                type: 'users',
                icon: '👥',
                detail: `User base ${totalUsers > previousState.users ? 'grew' : 'shrunk'} by ${Math.abs(totalUsers - previousState.users).toLocaleString()}`,
                from: previousState.users,
                to: totalUsers
            });
        }
        if (previousState.version && previousState.version !== botVersion) {
            changesDetected.push({
                type: 'version',
                icon: '📦',
                detail: `Version updated`,
                from: `v${previousState.version}`,
                to: `v${botVersion}`
            });
        }
        
        // Detect architecture changes
        if (!previousState.architecture || previousState.architecture !== 'per-server-partitioning') {
            changesDetected.push({
                type: 'architecture',
                icon: '🏗️',
                detail: 'Per-Server Partitioning v2.0 activated — Composite PK (id, guild_id)',
                from: 'Legacy Single-Key',
                to: 'Composite (id, guild_id)'
            });
        }
        
        try {
            const newState = {
                previousVersion: previousState.version || botVersion,
                commands: totalCommands,
                servers: totalGuilds,
                users: totalUsers,
                version: botVersion,
                lastUpdate: dateStr,
                timestamp: timestamp,
                architecture: 'per-server-partitioning'
            };
            fs.writeFileSync(previousStateFile, JSON.stringify(newState, null, 2));
        } catch(e) {}
        
        // ================= BUILD CATEGORY MAP =================
        const categories = {};
        const categoryDescriptions = {
            'ADMIN': 'Server configuration & management',
            'MODERATION': 'Security & user management',
            'ECONOMY': 'Credits, shop & marketplace',
            'PROFILE': 'User profiles & statistics',
            'GAMING': 'Games & competitive features',
            'AI': 'Lydia neural intelligence',
            'FUN': 'Entertainment & engagement',
            'UTILITY': 'Helpful tools & utilities',
            'SYSTEM': 'Core bot operations',
            'GENERAL': 'General purpose commands',
            'OWNER': 'Architect-exclusive controls'
        };
        
        for (const [name, cmd] of client.commands) {
            const cat = cmd.category || 'UTILITY';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push({
                name,
                description: cmd.description || 'No description',
                aliases: cmd.aliases || [],
                hasSlash: !!cmd.data
            });
        }
        const sortedCategories = Object.keys(categories).sort();
        
        // ================= BUILD PROFESSIONAL CHANGELOG.MD =================
        let md = `# 🦅 ARCHON CG-223 // SYSTEM REGISTRY v4.0\n\n`;
        
        md += `> **Report Generated:** ${dateStr} at ${timeStr} (Bamako Time, GMT+0)\n`;
        md += `> **Build Version:** v${botVersion} | **Node:** BAMAKO_223 🇲🇱\n`;
        md += `> **Architect:** MFOF7310 | **License:** Proprietary\n`;
        md += `> **Dashboard:** [bamako-steel-dev.xyz](https://bamako-steel-dev.xyz)\n`;
        md += `> **Architecture:** Per-Server Partitioning (Composite PK: id, guild_id)\n\n`;
        
        md += `---\n\n`;
        
        // ================= EXECUTIVE SUMMARY =================
        md += `## 1. EXECUTIVE SUMMARY\n\n`;
        md += `The ARCHON CG-223 neural grid operates on a **per-server partitioning architecture**, `;
        md += `ensuring complete data isolation across **${totalGuilds} servers** serving `;
        md += `**${totalUsers.toLocaleString()} Discord users** via **${totalCommands} active plugins**.\n\n`;
        
        md += `**Key Architectural Feature:** Each user record is uniquely identified by a composite `;
        md += `primary key \`(id, guild_id)\`, guaranteeing that XP, credits, levels, and all `;
        md += `progression data are strictly scoped to their originating server. No cross-server `;
        md += `data leakage is possible under this schema.\n\n`;
        
        if (changesDetected.length > 0) {
            md += `### Detected Changes This Cycle\n\n`;
            md += `| Icon | Type | Detail | Before | After |\n`;
            md += `|------|------|--------|--------|-------|\n`;
            changesDetected.forEach(c => {
                md += `| ${c.icon} | **${c.type.toUpperCase()}** | ${c.detail} | ${c.from || 'N/A'} | ${c.to || 'N/A'} |\n`;
            });
            md += `\n`;
        } else {
            md += `System metrics remain stable with no configuration changes detected since the last restart.\n\n`;
        }
        
        md += `---\n\n`;
        
        // ================= SYSTEM HEALTH DASHBOARD =================
        md += `## 2. SYSTEM HEALTH DASHBOARD\n\n`;
        md += `### 2.1 Core Metrics\n\n`;
        md += `| Metric | Value | Status |\n`;
        md += `|--------|-------|--------|\n`;
        md += `| Active Commands | ${totalCommands} | ${totalCommands > 0 ? '  OPERATIONAL' : '  CRITICAL'} |\n`;
        md += `| Command Aliases | ${totalAliases} | ${totalAliases > 0 ? '  OPERATIONAL' : '  WARNING'} |\n`;
        md += `| Connected Servers | ${totalGuilds} | ${totalGuilds > 0 ? '  OPERATIONAL' : '  CRITICAL'} |\n`;
        md += `| Total User Reach | ${totalUsers.toLocaleString()} |   OPERATIONAL |\n`;
        md += `| WebSocket Ping | ${Math.round(wsPing)}ms | ${wsPing < 100 ? '  OPTIMAL' : wsPing < 200 ? '  ACCEPTABLE' : '  DEGRADED'} |\n`;
        md += `| Uptime | ${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m |   OPERATIONAL |\n\n`;
        
        md += `### 2.2 Memory & Performance\n\n`;
        md += `| Metric | Value |\n`;
        md += `|--------|-------|\n`;
        md += `| Heap Used | ${memoryMB} MB |\n`;
        md += `| Heap Total | ${memoryTotal} MB |\n`;
        md += `| RSS Memory | ${memoryRSS} MB |\n`;
        md += `| Node.js | ${nodeVersion} |\n`;
        md += `| Platform | ${platform} (${arch}) |\n\n`;
        
        // ================= DATABASE STATISTICS =================
        md += `### 2.3 Database Statistics (Partitioned Schema)\n\n`;
        md += `| Table | Records | Notes |\n`;
        md += `|-------|---------|-------|\n`;
        md += `| Total User-Guild Partitions | ${dbStats.totalUserPartitions.toLocaleString()} | Composite PK (id, guild_id) |\n`;
        md += `| Unique Users (cross-guild) | ${dbStats.totalUniqueUsers.toLocaleString()} | DISTINCT count |\n`;
        md += `| Guilds with User Data | ${dbStats.totalGuildPartitions.toLocaleString()} | DISTINCT guild_id |\n`;
        md += `| Active Warnings | ${dbStats.totalWarnings.toLocaleString()} | Per-server scope |\n`;
        md += `| Pending Reminders | ${dbStats.totalReminders.toLocaleString()} | Global scope |\n`;
        md += `| Active Investments | ${dbStats.totalInvestments.toLocaleString()} | Global scope |\n`;
        md += `| Registered Birthdays | ${dbStats.totalBirthdays.toLocaleString()} | Global scope |\n`;
        md += `| Total Transfers | ${dbStats.totalTransfers.toLocaleString()} | Cross-server |\n`;
        md += `| Server Configs | ${dbStats.totalServerConfigs.toLocaleString()} | Per-server scope |\n`;
        md += `| Lydia Memories | ${dbStats.totalLydiaMemories.toLocaleString()} | Global scope |\n`;
        md += `| Database File | ${dbStats.dbSize} MB | WAL mode enabled |\n`;
        
        if (!dbHealthy) {
            md += `\n> **Note:** Database is newly initialized. User partitions will populate as members interact with servers.\n`;
        }
        md += `\n`;
        
        md += `---\n\n`;
        
        // ================= ACTIVE SYSTEMS STATUS =================
        md += `## 3. ACTIVE SYSTEMS STATUS\n\n`;
        md += `| System | Status | Details |\n`;
        md += `|--------|--------|--------|\n`;
        md += `| Lydia AI |   ONLINE | Multi-agent architecture active |\n`;
        md += `| AFK System |   ACTIVE | Real-time user status tracking |\n`;
        md += `| Leveling Engine |   RUNNING | Per-server XP with composite keys |\n`;
        md += `| Circuit Breaker |   READY | Threshold: ${WRITE_STRATEGY.CIRCUIT_BREAKER_THRESHOLD} failures |\n`;
        md += `| Database |   WAL MODE | Per-server partitioning v2.0 |\n`;
        md += `| Telegram Bridge | ${client.telegramBridge?.enabled ? '  ACTIVE' : '  STANDBY'} | v1.7.0 |\n`;
        md += `| Market Manager | ${typeof getMarketState === 'function' ? '  LIVE' : '  FALLBACK'} | ${typeof getMarketState === 'function' ? 'Real-time trends' : 'Steady fallback'} |\n`;
        md += `| Birthday System |   ACTIVE | Daily check cycle |\n`;
        
        const slashCapable = client.commands.filter(cmd => !!cmd.data).size;
        md += `| Slash Commands | ${slashCapable > 0 ? '  REGISTERED' : '  NONE'} | ${slashCapable} commands support slash |\n`;
        md += `| Self-Healing |   ACTIVE | Anti-crash protocols engaged |\n\n`;
        
        md += `---\n\n`;
        
        // ================= COMMAND INVENTORY =================
        md += `## 4. COMMAND INVENTORY\n\n`;
        md += `### 4.1 Overview\n\n`;
        md += `| Category | Commands | Description |\n`;
        md += `|----------|----------|-------------|\n`;
        
        for (const cat of sortedCategories) {
            const cmds = categories[cat];
            const slashCount = cmds.filter(c => c.hasSlash).length;
            const desc = categoryDescriptions[cat] || 'General purpose';
            md += `| ${getCategoryEmoji(cat)} **${cat}** | ${cmds.length} (${slashCount} slash) | ${desc} |\n`;
        }
        md += `\n`;
        
        for (const cat of sortedCategories) {
            const cmds = categories[cat];
            md += `### 4.2 ${getCategoryEmoji(cat)} ${cat} (${cmds.length} commands)\n\n`;
            md += `| Command | Description | Aliases | Slash |\n`;
            md += `|---------|-------------|---------|-------|\n`;
            for (const cmd of cmds) {
                const aliases = cmd.aliases.length > 0 ? cmd.aliases.slice(0, 5).join(', ') : '—';
                const desc = cmd.description.length > 50 ? cmd.description.substring(0, 47) + '...' : cmd.description;
                const slash = cmd.hasSlash ? '  ' : '  ';
                md += `| \`${cmd.name}\` | ${desc} | ${aliases} | ${slash} |\n`;
            }
            md += '\n';
        }
        
        md += `---\n\n`;
        
        // ================= SERVER INTELLIGENCE REPORT =================
        md += `## 5. SERVER INTELLIGENCE REPORT\n\n`;
        md += `> Per-server statistics reflect the partitioned user data architecture. `;
        md += `Each server maintains isolated user records with composite keys \`(id, guild_id)\`.\n\n`;
        
        if (serverStats.length > 0) {
            md += `| # | Server | Members | Boost | Reg. Users | Server XP | Avg Lv. |\n`;
            md += `|---|--------|--------|-------|------------|-----------|--------|\n`;
            serverStats.forEach((s, index) => {
                md += `| ${index + 1} | ${s.name} | ${s.members.toLocaleString()} | Tier ${s.boostTier} | ${s.registeredUsers.toLocaleString()} | ${s.totalXP.toLocaleString()} | ${s.avgLevel} |\n`;
            });
            md += `\n`;
        } else {
            md += `No server statistics available. User partitions will populate as members interact.\n\n`;
        }
        
        md += `---\n\n`;
        
        // ================= ARCHITECTURE OVERVIEW =================
        md += `## 6. ARCHITECTURE OVERVIEW\n\n`;
        md += `### 6.1 Per-Server Partitioning Schema\n\n`;
        md += `The v2.0 architecture introduces a fundamental schema change: the \`users\` table now uses `;
        md += `a **composite primary key** \`(id, guild_id)\` instead of a single \`id\` column. This ensures:\n\n`;
        md += `- **Complete Data Isolation:** User progress (XP, credits, levels) is strictly scoped per server\n`;
        md += `- **No Cross-Server Leakage:** A user's data in Server A is entirely independent of Server B\n`;
        md += `- **Efficient Queries:** All user lookups include \`guild_id\` for indexed retrieval\n`;
        md += `- **Scalable Cache:** In-memory cache uses \`\${userId}:\${guildId}\` composite keys\n\n`;
        
        md += `### 6.2 Cache & Write Strategy\n\n`;
        md += `- **Cache Key Format:** \`\${userId}:\${guildId}\` — O(1) Map lookup\n`;
        md += `- **Batch Writes:** INSERT OR REPLACE with all 17 columns, guild_id explicitly populated\n`;
        md += `- **Circuit Breaker:** 5 consecutive failures trigger 60s cooldown\n`;
        md += `- **Cache TTL:** 1 hour stale entry expiry, 30-minute janitor cycle\n\n`;
        
        md += `### 6.3 Event Systems\n\n`;
        md += `| Event | Handler | Data Scope |\n`;
        md += `|-------|---------|------------|\n`;
        md += `| GuildMemberAdd | Welcome Matrix | Per-server settings |\n`;
        md += `| GuildMemberRemove | Goodbye Matrix | Per-server settings |\n`;
        md += `| MessageCreate | Leveling + AFK + Commands | Per-server partitioning |\n`;
        md += `| InteractionCreate | Buttons + Slash | Per-server or global |\n\n`;
        
        md += `### 6.4 Environment Configuration\n\n`;
        md += `| Variable | Status |\n`;
        md += `|----------|--------|\n`;
        md += `| DISCORD_TOKEN | ${checkEnvStatus('DISCORD_TOKEN')} |\n`;
        md += `| CLIENT_ID | ${checkEnvStatus('CLIENT_ID')} |\n`;
        md += `| OWNER_ID | ${checkEnvStatus('OWNER_ID')} |\n`;
        md += `| WELCOME_CHANNEL_ID | ${checkEnvStatus('WELCOME_CHANNEL_ID')} |\n`;
        md += `| OPENROUTER_API_KEY | ${checkEnvStatus('OPENROUTER_API_KEY')} |\n`;
        md += `| BRAVE_API_KEY | ${checkEnvStatus('BRAVE_API_KEY')} |\n`;
        md += `| TELEGRAM_BOT_TOKEN | ${checkEnvStatus('TELEGRAM_BOT_TOKEN')} |\n\n`;

        // ================= FOOTER =================
        md += `## 7. ARCHITECT'S NOTES\n\n`;
        md += `This registry is **auto-generated** on every system restart and reflects the exact state `;
        md += `of the ARCHON CG-223 neural grid at boot time. All metrics are captured in real-time `;
        md += `from the BAMAKO_223 node.\n\n`;
        md += `**v4.0 Changelog Engine Changes:**\n`;
        md += `- Per-server partitioning statistics now report both total partitions and unique users\n`;
        md += `- Architecture change detection monitors schema version transitions\n`;
        md += `- Database stats distinguish between global-scoped and per-server-scoped tables\n`;
        md += `- Composite key metrics provide visibility into data distribution across guilds\n\n`;
        md += `> *"The grid adapts. The grid isolates. The grid prevails."*\n\n`;
        md += `---\n\n`;
        md += `**Built by MFOF7310** | **Bamako, Mali 🇲🇱**\n`;
        md += `**Dashboard:** [bamako-steel-dev.xyz](https://bamako-steel-dev.xyz)\n`;
        md += `**Last System Boot:** ${dateStr} | **Report ID:** ${timestamp}\n`;
        md += `*ARCHON CG-223 Neural Changelog Engine v4.0 — 100% Automated*\n`;
        
        safeWriteFile('changelog.md', md);
        
        console.log(`${green}[CHANGELOG]${reset}   Registry v4.0 generated: ${totalCommands} commands, ${totalGuilds} servers, ${totalUsers.toLocaleString()} users`);
        console.log(`${green}[CHANGELOG]${reset}   Report saved to ./changelog.md (${((md.length / 1024).toFixed(1))} KB)`);
        console.log(`${green}[CHANGELOG]${reset}   Per-server partitions: ${dbStats.totalUserPartitions.toLocaleString()} total, ${dbStats.totalUniqueUsers.toLocaleString()} unique users`);
        if (serverStats.length > 0) {
            console.log(`${green}[CHANGELOG]${reset}   Server intelligence: ${serverStats.length} servers analyzed`);
        }
        
    } catch(e) {
        console.log(`${red}[CHANGELOG]${reset}   Generation failed: ${e.message}`);
        console.log(`${red}[CHANGELOG]${reset}   Stack: ${e.stack}`);
    }

    // ================= AUTO-BROADCAST PROTOCOL v2.0 =================
    // Singleton guard — prevents double execution if plugin has internal timers
    client._autoBroadcastRan = false;
    setTimeout(async () => {
        if (client._autoBroadcastRan) {
            console.log(`${yellow}[AUTO-BROADCAST]${reset} Already ran — skipping duplicate`);
            return;
        }
        client._autoBroadcastRan = true;
        try {
            const { autoBroadcast } = require('./plugins/auto-broadcast.js');
            await autoBroadcast(client);
        } catch (err) {
            console.log(`${yellow}[AUTO-BROADCAST]${reset} Skipped: ${err.message}`);
        }
    }, 15000); 

    // ================= BIRTHDAY SYSTEM =================
    const birthdayModule = require('./plugins/birthday.js');
    if (birthdayModule.initialize) {
        birthdayModule.initialize(client);
    }
    console.log(`${green}[BIRTHDAY]${reset} Birthday reminder system active`);

    // ================= REGISTER SLASH COMMANDS =================
    const commands = [];
    let slashSkipped = 0;
    let slashRegistered = 0;

    client.commands.forEach(command => {
        if (!command.data) return;
        
        try {
            if (typeof command.data.toJSON === 'function') {
                commands.push(command.data.toJSON());
                slashRegistered++;
            } else if (typeof command.data === 'object' && command.data !== null && command.data.name) {
                commands.push(command.data);
                slashRegistered++;
            } else {
                slashSkipped++;
            }
        } catch (err) {
            slashSkipped++;
            console.log(`${yellow}[SLASH WARN]${reset} ${command.name}: ${err.message}`);
        }
    });

    console.log(`${cyan}[SLASH]${reset} ${slashRegistered} commands prepared, ${slashSkipped} skipped`);

    const botToken = process.env.DISCORD_TOKEN;
    const clientId = process.env.CLIENT_ID;

    if (!botToken) {
        console.error(`${red}[SLASH ERROR]${reset} DISCORD_TOKEN is missing in .env file!`);
    } else if (!clientId) {
        console.error(`${red}[SLASH ERROR]${reset} CLIENT_ID is missing in .env file!`);
    } else {
        const rest = new REST({ version: '10' }).setToken(botToken);

        if (commands.length > 0) {
                        console.log(`${cyan}[SLASH]${reset} Syncing ${commands.length} commands with Discord...`);
            console.log(`${cyan}[SLASH]${reset} Using Client ID: ${clientId}`);

            const originalLog = console.log;
            console.log = function(...args) {
                const msg = args.join(' ');
                if (msg.includes('Status: 200') || msg.includes('"object":') || 
                    msg.includes('"finish_reason"') || msg.includes('usage:') ||
                    msg.includes('Response:')) {
                    return;
                }
                originalLog.apply(console, args);
            };

            try {
// ================= GHOST COMMAND FILTER ENGAGED =================
const cleanCommands = commands.filter(cmd => {
    // Handle both raw JSON objects and Discord.js builders
    let name, description;
    
    if (cmd && typeof cmd === 'object') {
        // If it's already a plain JSON object (from .toJSON() or manual)
        if (cmd.name && (cmd.description || cmd.type)) {
            name = cmd.name;
            description = cmd.description;
        }
        // If it's a SlashCommandBuilder or similar with .toJSON method
        else if (typeof cmd.toJSON === 'function') {
            try {
                const json = cmd.toJSON();
                name = json.name;
                description = json.description;
            } catch (e) {
                return false;
            }
        }
    }
    
    const isValid = !!name && (!!description || cmd.type === 1); // type 1 = CHAT_INPUT
    if (!isValid) {
        console.log(`\x1b[33m[SLASH FILTER]\x1b[0m ⚠️ Filtered out malformed command: ${name || 'Unknown Name'}`);
    }
    return isValid;
});

                await rest.put(
                    Routes.applicationCommands(clientId),
                    { body: cleanCommands }, // Pushing verified payload only
                );
                // ================================================================
                
                console.log = originalLog;
                console.log(`${green}[SLASH]${reset} Successfully registered ${cleanCommands.length} global slash commands.`);
            } catch (error) {
                console.log = originalLog;
                console.error(`${red}[SLASH ERROR]${reset}`, error.message);
                if (error.message.includes('token')) {
                    console.error(`${red}[SLASH ERROR]${reset} Invalid token! Check your .env file.`);
                } else if (error.message.includes('Unknown application')) {
                    console.error(`${red}[SLASH ERROR]${reset} Invalid CLIENT_ID! Check your .env file.`);
                }
            }
        } else {
            console.log(`${yellow}[SLASH]${reset} No valid slash command data found. Skipping sync.`);
        }
    }

    startBatchWriteInterval();
    startReminderHeartbeat();
    startCacheJanitor();

    // ================= WEEKLY PURGE SCHEDULER =================
    setInterval(() => {
        const date = new Date();
        if (date.getUTCDay() === 0 && date.getUTCHours() === 3) {
            runWeeklyDatabasePurge();
        }
    }, 3600000);

    console.log(`${cyan}[PURGE]${reset} Weekly auto-purge scheduled (Sunday 3 AM UTC)`);


    // ================= SUPREME DM-FIRST DAILY REMINDER HEARTBEAT v3.0 =================
    console.log(`${green}[SUPREME DM]${reset} Initializing Daily Neural Reminder System...`);

    client.dailyReminderStats = {
        sent: 0,
        failed: 0,
        fallback: 0,
        lastReset: Date.now()
    };

    setInterval(() => {
        client.dailyReminderStats.sent = 0;
        client.dailyReminderStats.failed = 0;
        client.dailyReminderStats.fallback = 0;
        client.dailyReminderStats.lastReset = Date.now();
    }, 86400000);

// ================= DM REMINDER HEARTBEAT v4.0 (FIX #10 - WITH SEMAPHORE) =================
let dmHeartbeatRunning = false;

setInterval(async () => {
    if (dmHeartbeatRunning) {
        console.log(`${yellow}[DM HEARTBEAT]${reset} Previous tick still running, skipping`);
        return;
    }
    
    dmHeartbeatRunning = true;
    const startTime = Date.now();
    
    try {
        const now = Math.floor(Date.now() / 1000);
        const sixHoursAgo = now - (6 * 3600);
        const reminderCutoff = now - 86400;

        let dueUsers = [];
        try {
            dueUsers = db.prepare(`
                SELECT id, username, guild_id, last_daily, streak_days, credits, level, 
                       total_dailies, highest_streak, streak_protections, last_reminder
                FROM users 
                WHERE last_daily > ?
                  AND (last_daily + 86400) <= ?
                  AND (last_reminder IS NULL OR last_reminder < ?)
                ORDER BY last_daily ASC
                LIMIT 15
            `).all(reminderCutoff, now, sixHoursAgo);
        } catch (queryErr) {
            console.error(`${red}[DM HEARTBEAT]${reset} Query failed:`, queryErr.message);
            return;
        }

        if (dueUsers.length === 0) return;

        let processed = 0, sent = 0, blocked = 0, fallback = 0, errored = 0;

        for (const user of dueUsers) {
            processed++;

            try {
                const discordUser = await client.users.fetch(user.id).catch(() => null);
                if (!discordUser) {
                    db.prepare('UPDATE users SET last_reminder = ? WHERE id = ? AND guild_id = ?')
                      .run(now, user.id, user.guild_id);
                    continue;
                }

                const guild = user.guild_id ? client.guilds.cache.get(user.guild_id) : null;
                const settings = guild ? client.getServerSettings(user.guild_id) : null;
                const prefix = settings?.prefix || '.';
                const guildName = guild?.name || 'Neural Network';
                const guildIcon = guild?.iconURL({ size: 128 }) || client.user.displayAvatarURL();

                let marketMultiplier = 1.0, marketTrend = 'STEADY', trendEmoji = '📊';
                try {
                    if (typeof getMarketState === 'function') {
                        const ms = getMarketState(user.guild_id);
                        marketMultiplier = ms.multiplier || 1.0;
                        marketTrend = ms.trend || 'STEADY';
                        const t = TRENDS?.[marketTrend];
                        if (t) trendEmoji = t.emoji || '📊';
                    }
                } catch (e) {}

                const ss = user.guild_id ? client.getServerSettings?.(user.guild_id) : null;
                const baseReward = parseInt(ss?.daily_bonus) || 200;
                const streakDays = user.streak_days || 0;
                const streakBonus = Math.min(streakDays * 10, 500);
                const levelBonus = Math.floor((user.level || 1) * 5);
                const estimatedReward = Math.floor((baseReward + streakBonus + levelBonus) * marketMultiplier);

                let streakStatus, streakEmoji, streakColor;
                if (streakDays >= 365)       { streakStatus = '  LEGENDARY'; streakEmoji = '👑'; streakColor = '#ffd700'; }
                else if (streakDays >= 100)  { streakStatus = '  MYTHIC';    streakEmoji = '💎'; streakColor = '#e91e63'; }
                else if (streakDays >= 30)   { streakStatus = '  ELITE';     streakEmoji = '🛡️'; streakColor = '#9b59b6'; }
                else if (streakDays >= 7)    { streakStatus = '  VETERAN';   streakEmoji = '⚔️'; streakColor = '#3498db'; }
                else if (streakDays >= 3)    { streakStatus = '  ACTIVE';    streakEmoji = '🔥'; streakColor = '#2ecc71'; }
                else                         { streakStatus = '  INITIATE';  streakEmoji = '🌱'; streakColor = '#95a5a6'; }

                const bamakoHour = new Date().getUTCHours();
                let greeting, greetingEmoji;
                if (bamakoHour < 6)       { greeting = 'Good Night';   greetingEmoji = '🌙'; }
                else if (bamakoHour < 12) { greeting = 'Good Morning'; greetingEmoji = '🌅'; }
                else if (bamakoHour < 17) { greeting = 'Good Afternoon'; greetingEmoji = '☀️'; }
                else if (bamakoHour < 20) { greeting = 'Good Evening';  greetingEmoji = '🌆'; }
                else                      { greeting = 'Good Night';     greetingEmoji = '🌙'; }

                const dailyReadyAt = user.last_daily + 86400;
                const secondsSinceReady = now - dailyReadyAt;
                const hoursSinceReady = Math.floor(secondsSinceReady / 3600);
                const minutesSinceReady = Math.floor((secondsSinceReady % 3600) / 60);

                let availabilityStatus;
                if (hoursSinceReady < 1)       availabilityStatus = `  Just became available`;
                else if (hoursSinceReady < 3)  availabilityStatus = `  Ready for ${hoursSinceReady}h ${minutesSinceReady}m`;
                else if (hoursSinceReady < 6)  availabilityStatus = `  Waiting ${hoursSinceReady}h`;
                else if (hoursSinceReady < 12) availabilityStatus = `  Overdue ${hoursSinceReady}h`;
                else                           availabilityStatus = `  Overdue ${hoursSinceReady}h — don't lose your streak!`;

                const supremeEmbed = new EmbedBuilder()
                    .setColor(streakColor)
                    .setAuthor({ name: `🦅 ARCHON CG-223 • DAILY REWARDS READY`, iconURL: client.user.displayAvatarURL() })
                    .setTitle(`${greetingEmoji} ${greeting}, ${discordUser.username}!`)
                    .setDescription(`Your neural receptors have been replenished and are ready for a new injection.\n\n> *Claim your daily rewards before the next reset cycle begins.*`)
                    .addFields(
                        { name: '💰 **ESTIMATED REWARD**', value: `\`\`\`\nBase Reward:    ${baseReward} 🪙\nStreak Bonus:   +${streakBonus} 🪙\nLevel Bonus:    +${levelBonus} 🪙\nMarket (${trendEmoji}):  x${marketMultiplier.toFixed(2)}\n━━━━━━━━━━━━━━━━━━━━\nTOTAL:          ${estimatedReward} 🪙\n\`\`\``, inline: false },
                        { name: `${streakEmoji} **STREAK: ${streakStatus}**`, value: `📊 **Current Streak:** ${streakDays} day${streakDays !== 1 ? 's' : ''}\n🏆 **Best Streak:** ${user.highest_streak || 0} days\n🛡️ **Protections:** ${user.streak_protections || 0}\n📅 **Total Claims:** ${user.total_dailies || 0}`, inline: true },
                        { name: '🎯 **YOUR PROFILE**', value: `⭐ **Level:** ${user.level || 1}\n💰 **Balance:** ${(user.credits || 0).toLocaleString()} 🪙\n💬 **Messages:** ${(user.total_messages || 0).toLocaleString()}`, inline: true },
                        { name: '⏰ **STATUS**', value: `${availabilityStatus}\n\n📌 **Claim Command:**\n\`${prefix}daily\``, inline: false },
                        { name: '🏛️ **WHERE TO CLAIM**', value: guild ? `**${guildName}**\nUse \`${prefix}daily\` in any channel!` : `Use \`${prefix}daily\` in any server!`, inline: false },
                        { name: '💡 **STREAK MASTERY TIPS**', value: `🛡️ **Shield:** \`${prefix}shop\` → Buy Streak Shield (2,000 🪙)\n🔥 **7 Days:** Unlock +50% bonus credits\n🛡️ **30 Days:** Exclusive Elite role\n💎 **100 Days:** Premium rewards tier\n👑 **365 Days:** Legendary status + custom role`, inline: false },
                        { name: '🌐 **DASHBOARD**', value: '[**bamako-steel-dev.xyz**](https://bamako-steel-dev.xyz)', inline: false }
                    )
                    .setThumbnail(discordUser.displayAvatarURL({ dynamic: true, size: 256 }))
                    .setFooter({ text: `🦅 ARCHON CG-223 • bamako-steel-dev.xyz • ${guildName}`, iconURL: guildIcon })
                    .setTimestamp();

                const actionRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder().setLabel(`Claim in ${guildName.substring(0, 20)}`).setStyle(ButtonStyle.Link).setURL(guild ? `https://discord.com/channels/${guild.id}/${settings?.dailyChannel || guild.systemChannelId || guild.id}` : 'https://discord.com').setEmoji('🏛️'),
                        new ButtonBuilder().setCustomId(`dm_streak_info_${user.id}`).setLabel('Streak Rewards').setStyle(ButtonStyle.Primary).setEmoji('🔥'),
                        new ButtonBuilder().setCustomId(`dm_shop_${user.id}`).setLabel('Buy Shield').setStyle(ButtonStyle.Success).setEmoji('🛡️')
                    );

                try {
                    await discordUser.send({ embeds: [supremeEmbed], components: [actionRow] });
                    sent++;
                    db.prepare('UPDATE users SET last_reminder = ? WHERE id = ? AND guild_id = ?').run(now, user.id, user.guild_id);
                    console.log(`${green}[DM REMINDER]${reset}   ${discordUser.username} @ ${guildName} • Streak: ${streakDays}d • +${estimatedReward} 🪙`);
                } catch (dmErr) {
                    blocked++;
                    console.log(`${yellow}[DM BLOCKED]${reset} ${discordUser.username} — DMs disabled`);
                    try {
                        const fallbackChannelId = settings?.dailyChannel || settings?.generalChannel || settings?.welcomeChannel;
                        if (fallbackChannelId && guild) {
                            const fallbackChannel = await client.channels.fetch(fallbackChannelId).catch(() => null);
                            if (fallbackChannel) {
                                const fallbackEmbed = new EmbedBuilder()
                                    .setColor('#f39c12')
                                    .setAuthor({ name: '🔔 DAILY REWARD AVAILABLE', iconURL: client.user.displayAvatarURL() })
                                    .setDescription(`<@${user.id}>, your daily injection is ready!\n\n> 💰 **Estimated Reward:** ${estimatedReward} 🪙\n> 🔥 **Streak:** ${streakDays} day${streakDays !== 1 ? 's' : ''}\n> 📊 **Market:** ${trendEmoji} ${marketTrend}\n\n📌 Use \`${prefix}daily\` to claim!\n\n⚠️ *Enable Direct Messages to receive premium reminders with detailed stats & quick-action buttons!*`)
                                    .setThumbnail(discordUser.displayAvatarURL({ dynamic: true, size: 128 }))
                                    .setFooter({ text: `${guildName} • Enable DMs for better experience` });
                                await fallbackChannel.send({ content: `<@${user.id}>`, embeds: [fallbackEmbed] });
                                fallback++;
                                db.prepare('UPDATE users SET last_reminder = ? WHERE id = ? AND guild_id = ?').run(now, user.id, user.guild_id);
                                console.log(`${green}[FALLBACK]${reset}   Posted in #${fallbackChannel.name} for ${discordUser.username}`);
                            }
                        }
                    } catch (fallbackErr) {
                        db.prepare('UPDATE users SET last_reminder = ? WHERE id = ? AND guild_id = ?').run(now, user.id, user.guild_id);
                    }
                }

                await new Promise(r => setTimeout(r, 1500));

            } catch (userErr) {
                errored++;
                console.error(`${red}[DM REMINDER]${reset} Skipped user ${user.id} @ ${user.guild_id}: ${userErr.message}`);
                try {
                    db.prepare('UPDATE users SET last_reminder = ? WHERE id = ? AND guild_id = ?').run(now, user.id, user.guild_id);
                } catch (dbErr) {}
            }
            
            // ✅ SECURE: Max execution time guard
            if (Date.now() - startTime > 30000) {
                console.log(`${yellow}[DM HEARTBEAT]${reset} Execution exceeded 30s, aborting`);
                break;
            }
        }

        console.log(`${cyan}[DM HEARTBEAT]${reset} Tick complete: ${processed} checked • ${green}${sent} DM sent${reset} • ${yellow}${blocked} blocked${reset} • ${green}${fallback} fallback${reset} • ${errored > 0 ? red : ''}${errored} errors${reset}`);

    } catch (err) {
        console.error(`${red}[DM HEARTBEAT]${reset} Fatal error:`, err.message);
    } finally {
        dmHeartbeatRunning = false;
    }
}, 45000);

    console.log(`${green}[SUPREME DM]${reset} Neural Reminder Heartbeat v4.0 active (45s) • 6h anti-spam • Per-user safety • Fallback ready`);

    if (typeof startAutoUpdate === 'function') startAutoUpdate(client, db);
    if (typeof loadAllStates === 'function') loadAllStates(client);
    if (typeof startMarketAlerts === 'function') startMarketAlerts(client, db);

    // ================= TIKTOK NOTIFICATION ENGINE =================
    try {
        const tiktokModule = require('./plugins/tiktok.js');
        if (tiktokModule.startPolling) {
            tiktokModule.startPolling(client, db);
            console.log(`${green}[TIKTOK]${reset} Notification engine active (5min polling)`);
        }
    } catch (err) {
        console.error(`${red}[TIKTOK]${reset} Engine failed to start: ${err.message}`);
    }

    // ================= MARKET CHANNEL CONFIG CHECK =================
    // Warn owner if market is active but no notification channel is set
    setTimeout(async () => {
        try {
            const marketChConfigured = process.env.MARKET_CHANNEL_ID;
            if (!marketChConfigured) {
                const owner = await client.users.fetch(process.env.OWNER_ID).catch(() => null);
                if (owner) {
                    owner.send({
                        embeds: [new EmbedBuilder()
                            .setColor('#f39c12')
                            .setTitle('📊 Market Notification Setup Required')
                            .setDescription(
                                'The **Bamako Market Engine** is running, but no notification channel is configured.\n\n' +
                                '**To enable market shift notifications:**\n' +
                                '1. Upload a banner image to any channel\n' +
                                '2. Copy the image URL\n' +
                                '3. Add to your `.env` file:\n' +
                                '```\nMARKET_CHANNEL_ID=your_channel_id_here\n```\n\n' +
                                '**Or use server settings:**\n' +
                                '```\n.serversettings set market_channel #your-channel\n```\n\n' +
                                '**Market updates every 6 hours automatically.**'
                            )
                            .setFooter({ text: '🦅 ARCHON CG-223 • Market Intelligence • bamako-steel-dev.xyz' })
                            .setTimestamp()
                        ]
                    }).catch(() => {});
                }
            }
        } catch (e) {}
    }, 15000); // 15s delay so bot is fully ready

    if (client.telegramBridge && client.telegramBridge.status) {
        const status = client.telegramBridge.status();
        if (status.configured) {
            const result = client.telegramBridge.activate();
            if (result.success) {
                if (!isPM2) console.log(`${green}[TELEGRAM]${reset} Bridge auto-activated on boot - BAMAKO_223 🇲🇱 connected`);
            } else {
                if (!isPM2) console.log(`${yellow}[TELEGRAM]${reset} Bridge activation failed: ${result.error}`);
            }
        }
    }

    // ================= SEND BOOT DM TO OWNER =================
    try {
        const owner = await client.users.fetch(process.env.OWNER_ID).catch(() => null);
        if (owner) {
            let trend = TRENDS?.STEADY || { name: 'Steady Market', emoji: '📊', color: '#f1c40f' };
            let marketState = { trend: 'STEADY', multiplier: 1.0 };
            try {
                if (getMarketState) {
                    marketState = getMarketState(null);
                    trend = TRENDS[marketState.trend] || TRENDS.STEADY;
                }
            } catch (err) {}
            
            const bootEmbed = new EmbedBuilder()
                .setColor(trend.color || '#2ecc71')
                .setAuthor({ name: '🦅 ARCHON CG-223 // NEURAL ENGINE ONLINE', iconURL: client.user.displayAvatarURL() })
                .setTitle('⚡ NEURAL ENGINE BOOT COMPLETE')
                .setDescription(
                    `\`\`\`ansi\n` +
                    `\u001b[1;32m${"━".repeat(30)}\u001b[0m\n` +
                    `\u001b[1;36mSystem:\u001b[0m reboot complete\n` +
                    `\u001b[1;34mModules:\u001b[0m ${client.commands.size} plugins synced\n` +
                    `\u001b[1;35mVersion:\u001b[0m v${client.version}\n` +
                    `\u001b[1;33mNode:\u001b[0m BAMAKO_223 🇲🇱\n` +
                    `\u001b[1;36mListeners:\u001b[0m ${client.listenerCount('messageCreate')} active\n` +
                    `\u001b[1;32mDatabase:\u001b[0m WAL Mode + Per-Server Partitioning\n` +
                    `\u001b[1;35mAFK System:\u001b[0m ACTIVE\n` +
                    `\u001b[1;33mCircuit Breaker:\u001b[0m READY\n` +
                    `\u001b[1;36mLydia AI:\u001b[0m MULTI-AGENT ACTIVE\n` +
                    `\u001b[1;36mTelegram:\u001b[0m ${client.telegramBridge?.enabled ? 'ACTIVE' : 'STANDBY'}\n` +
                    `\u001b[1;33mMarket:\u001b[0m ${trend.emoji} ${trend.name} (${(marketState.multiplier * 100).toFixed(1)}%)\n` +
                    `\u001b[1;32m${"━".repeat(30)}\u001b[0m\n` +
                    `\`\`\``
                )
                .addFields(
                    { name: '🌐 Dashboard', value: '[**bamako-steel-dev.xyz**](https://bamako-steel-dev.xyz)', inline: true },
                    { name: '🏗️ Architect', value: '```ansi\n\u001b[1;33mMFOF7310\u001b[0m\n```', inline: true },
                    { name: '⚡ Slash Commands', value: `\`\`\`ansi\n\u001b[1;32m${commands.length} commands registered\u001b[0m\n\`\`\``, inline: true },
                    { name: '🕐 Boot Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                )
                .setFooter({ text: `🦅 ARCHON CG-223 • Neural Engine v${client.version} • bamako-steel-dev.xyz`, iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            await owner.send({ embeds: [bootEmbed] }).catch(() => {});
            console.log(`${green}[DM]${reset}   Boot DM sent successfully to ${owner.tag}`);
        }
    } catch (err) {
        console.log(`${yellow}[DM]${reset}   Could not send boot DM: ${err.message}`);
    }
});

// ================= MESSAGE PROCESSING (PER-SERVER PARTITIONED) =================
safeOn(Events.MessageCreate, async (message) => {
    if (!message || message.author?.bot || message.webhookId) return;

    // ================= AUTOMOD DM APPEAL HANDLER =================
    // Handle DMs for AutoMod appeals (before guild processing)
    if (!message.guild) {
        try {
            const automod = client.commands.get('automod');
            if (automod?.handleDM) {
                const handled = await automod.handleDM(message, client);
                if (handled) return; // appeal processed, stop here
            }
        } catch (e) {
            console.error(`[APPEAL] Error handling DM: ${e.message}`);
        }
        // If not an appeal, continue to Lydia/command processing below
    };
    // ✅ SECURE: Message size limit (FIX #16)
if (message.content && message.content.length > 4000) {
    console.log(`${yellow}[MESSAGE]${reset} Blocked oversized message from ${message.author.tag}: ${message.content.length} chars`);
    return;
}

    // ================= ARCHITECT SHIELD v2.0 =================
    if (message.content.startsWith('.system') || message.content.startsWith('.owner')) {
        if (message.author.id !== process.env.OWNER_ID) {
            return message.reply("🚫 **Access Denied:** Unauthorized Neural Signature.").catch(() => {});
        }
        
        const args = message.content.split(' ');
        const token = args[2]; 
        if (token && client.verifyPushKey) {
            const verified = client.verifyPushKey(message.author.id, token);
            if (!verified) {
                return message.reply("🔐 **Push-Key Expired.** Use `/authorize` on Telegram for a new token.").catch(() => {});
            }
            console.log(`\x1b[32m[AUTH]\x1b[0m Push-Key verified`);
        }
    }

    // LYDIA TOKEN SHIELD — 3-second cooldown
    if (message.content.includes('.lydia') || message.content.includes('.ai') || message.content.includes('.neural')) {
        const now = Date.now();
        const lastUsed = client.lydiaCooldowns.get(message.author.id) || 0;
        if (now - lastUsed < 3000) {
            const waitTime = ((3000 - (now - lastUsed)) / 1000).toFixed(1);
            return message.reply(`⏳ **Token Protection:** Wait ${waitTime}s`)
                .then(m => setTimeout(() => m.delete().catch(() => {}), 2000));
        }
        client.lydiaCooldowns.set(message.author.id, now);
    }

    // ================= AUTO-MOD AI CHECK =================
    try {
        const automod = client.commands.get('automod');
        if (automod?.handleMessage) {
            const wasViolation = await automod.handleMessage(message, client, db);
            if (wasViolation) return;
        }
    } catch (e) {}

    // ================= PER-SERVER USER DATA RESOLUTION =================
    // Extract guildId for composite key lookup: ${userId}:${guildId}
    const guildId = message.guild?.id || 'DM';
    const userId = message.author.id;
    
    // All user data operations are now scoped to the specific guild partition
    let userData = getUserData(userId, guildId);
    
    if (!userData) {
        userData = initializeUser(userId, guildId, message.author.username);
        cacheUserData(userId, guildId, userData);
    }

    // ================= AFK SYSTEM =================
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

    // ================= PER-SERVER DYNAMIC LEVELING SYSTEM =================
    const serverSettings = message.guild ? getServerSettings(message.guild.id) : DEFAULT_SETTINGS;
    const now = Date.now();
    const cooldown = (serverSettings.xpCooldown || 60) * 1000;

    if (now - (userData.last_xp_gain || 0) > cooldown) {
        const minGain = serverSettings.xpMinGain || 15;
        const maxGain = serverSettings.xpMaxGain || 35;
        const multiplier = parseFloat(serverSettings.xpMultiplier) || 1.0;
        const xpGain = Math.floor((Math.random() * (maxGain - minGain + 1) + minGain) * multiplier);
        const oldXP = userData.xp || 0;
        const newXP = oldXP + xpGain;
        const oldLevel = Math.floor(0.1 * Math.sqrt(oldXP)) + 1;
        const newLevel = Math.floor(0.1 * Math.sqrt(newXP)) + 1;
        const totalMsgs = (userData.total_messages || 0) + 1;

        // Queue update with composite key ${userId}:${guildId}
        queueUserUpdate(userId, guildId, {
            ...userData,
            username: message.author.username,
            xp: newXP,
            level: newLevel,
            total_messages: totalMsgs,
            last_xp_gain: now,
            guild_id: guildId,
        });

        // ================= LEVEL UP DETECTED =================
        if (newLevel > oldLevel) {
            // ================= LEVELING PLUGIN: ON LEVEL UP =================
            if (client.leveling?.onLevelUp) {
                const xpCur = newXP - Math.pow((newLevel - 1) / 0.1, 2);
                const xpNeed = Math.pow(newLevel / 0.1, 2) - Math.pow((newLevel - 1) / 0.1, 2);
                await client.leveling.onLevelUp(message.member, newLevel, Math.floor(xpCur), Math.floor(xpNeed), client, db);
            }

            const userLang = client.userLastLang?.get(message.author.id) || detectLanguage(message.content) || 'en';
            const isDM = !message.guild;
            const guildName = isDM ? 'NEURAL NETWORK' : message.guild.name;
            const guildIcon = isDM ? client.user.displayAvatarURL() : message.guild.iconURL();

            // ================= LEVEL BANNER SYSTEM (Milestone Images) =================
            function getLevelBanner(level) {
                const banners = {
                    5:  process.env.LEVEL_5_BANNER  || process.env.LEVEL5_BANNER  || null,
                    10: process.env.LEVEL_10_BANNER || process.env.LEVEL10_BANNER || null,
                    15: process.env.LEVEL_15_BANNER || process.env.LEVEL15_BANNER || null,
                    20: process.env.LEVEL_20_BANNER || process.env.LEVEL20_BANNER || null,
                    25: process.env.LEVEL_25_BANNER || process.env.LEVEL25_BANNER || null,
                    30: process.env.LEVEL_30_BANNER || process.env.LEVEL30_BANNER || null,
                    35: process.env.LEVEL_35_BANNER || process.env.LEVEL35_BANNER || null,
                };
                if (banners[level]) return banners[level].split('?')[0];
                if (level > 35 && banners[35]) return banners[35].split('?')[0];
                return null;
            }
            const levelBannerUrl = getLevelBanner(newLevel);

            // Determine tier name & color
            let levelTier, levelTierColor, tierEmoji;
            if (newLevel <= 5) {
                levelTier = userLang === 'fr' ? 'Initié Neural' : 'Neural Initiate';
                levelTierColor = '#95a5a6';
                tierEmoji = '🌱';
            } else if (newLevel <= 10) {
                levelTier = userLang === 'fr' ? 'Chevalier Neural' : 'Neural Knight';
                levelTierColor = '#9b59b6';
                tierEmoji = '⚔️';
            } else if (newLevel <= 20) {
                levelTier = userLang === 'fr' ? 'Seigneur Synapse' : 'Synapse Lord';
                levelTierColor = '#ffd700';
                tierEmoji = '👑';
            } else {
                levelTier = userLang === 'fr' ? 'Architecte Suprême' : 'Supreme Architect';
                levelTierColor = '#e74c3c';
                tierEmoji = '🌟';
            }

            // UNIFIED TIER ASCENSION
            let roleResult = null;
            if (message.guild) {
                roleResult = await client.assignRole(
                    message.guild,
                    message.author.id,
                    `Tier: ${levelTier}`,
                    levelTierColor,
                    client.ROLE_SOURCES.LEVELING,
                    `Level ${newLevel} reached`
                );
                if (!roleResult.ok) console.log(`[ROLE] Failed: ${roleResult.why}`);
            }

            // ================= RESPECT levelup_channel SETTING =================
            const levelupChannelId = serverSettings.levelupChannel;
            let targetChannel = message.channel;
            if (levelupChannelId && message.guild) {
                const configured = message.guild.channels.cache.get(levelupChannelId);
                if (configured) targetChannel = configured;
            }

            // ================= CUSTOM levelup_message TEMPLATE =================
            const customTemplate = serverSettings.levelupMessage;
            if (customTemplate && customTemplate.trim()) {
                const filled = customTemplate
                    .replace(/{user}/gi, `<@${userId}>`)
                    .replace(/{username}/gi, message.author.username)
                    .replace(/{level}/gi, String(newLevel))
                    .replace(/{xp}/gi, newXP.toLocaleString())
                    .replace(/{server}/gi, guildName)
                    .replace(/{tier}/gi, levelTier);
                await targetChannel.send({ content: filled });
            } else {
                // ================= UNIFIED RICH LEVEL-UP EMBED =================
                // XP progress calculation (square-root formula)
                const currentLevelXP = Math.pow((newLevel - 1) / 0.1, 2);
                const nextLevelXP = Math.pow(newLevel / 0.1, 2);
                const xpProgress = newXP - currentLevelXP;
                const xpNeeded = nextLevelXP - currentLevelXP;
                const progressPercent = Math.min(100, Math.max(0, Math.floor((xpProgress / xpNeeded) * 100)));

                // Visual progress bar (10 blocks)
                const barLength = 10;
                const filledBars = Math.floor((progressPercent / 100) * barLength);
                const emptyBars = barLength - filledBars;
                const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

                // Achievement badge
                const achievementText = roleResult?.role?.name
                    ? `${tierEmoji} **${roleResult.role.name}** ${userLang === 'fr' ? 'DÉBLOQUÉ !' : 'UNLOCKED!'}`
                    : `${tierEmoji} **${levelTier.toUpperCase()}** ${userLang === 'fr' ? 'ATTEINT !' : 'REACHED!'}`;

                // Next milestone
                const milestones = [5, 10, 15, 20, 25, 30, 35, 50, 75, 100];
                const nextMilestone = milestones.find(m => m > newLevel) || 100;
                const milestoneText = userLang === 'fr'
                    ? `🎯 Prochain jalon: **${nextMilestone}** — Continuez !`
                    : `🎯 Next milestone: **${nextMilestone}** — Keep going!`;

                // Build unified embed
                const levelUpEmbed = new EmbedBuilder()
                    .setColor(levelTierColor)
                    .setAuthor({
                        name: userLang === 'fr'
                            ? `🎉 NIVEAU ${newLevel} ATTEINT !`
                            : `🎉 LEVEL ${newLevel} REACHED!`,
                        iconURL: message.author.displayAvatarURL()
                    })
                    .setDescription(
                        `### ${achievementText}\n` +
                        (userLang === 'fr'
                            ? `**${message.author.username}** progresse légendairement !\nMonte au **Niveau ${newLevel}** ! 👑`
                            : `**${message.author.username}**'s legendary progression!\nAscends to **Level ${newLevel}**! 👑`
                        )
                    )
                    .addFields(
                        {
                            name: userLang === 'fr' ? '📊 PROGRESSION' : '📊 PROGRESSION',
                            value: [
                                `\`\`\`ansi`,
                                `\u001b[1;33mLEVEL ${newLevel - 1} → ${newLevel}\u001b[0m`,
                                `${progressBar}`,
                                `${progressPercent}%`,
                                `XP: ${newXP.toLocaleString()}/${Math.floor(nextLevelXP).toLocaleString()}`,
                                `\`\`\``
                            ].join('\n'),
                            inline: false
                        },
                        {
                            name: userLang === 'fr' ? '🏆 RÉCOMPENSE' : '🏆 REWARD',
                            value: milestoneText,
                            inline: false
                        },
                        {
                            name: userLang === 'fr' ? '🏛️ SERVEUR' : '🏛️ SERVER',
                            value: guildName,
                            inline: true
                        },
                        {
                            name: '⚡ XP',
                            value: `${newXP.toLocaleString()}`,
                            inline: true
                        },
                        {
                            name: userLang === 'fr' ? '💎 TITRE' : '💎 TITLE',
                            value: levelTier,
                            inline: true
                        }
                    )
                    .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 256 }))
                    .setFooter({
                        text: `${guildName} • Architect Engine v${client.version || '2.0'}`,
                        iconURL: guildIcon
                    })
                    .setTimestamp();

                // Apply milestone banner if env URL exists
                if (levelBannerUrl) {
                    levelUpEmbed.setImage(levelBannerUrl);
                }

                // SEND WITH PING + EMBED
                await targetChannel.send({
                    content: userLang === 'fr'
                        ? `🎉 **NIVEAU SUPÉRIEUR !** <@${message.author.id}>`
                        : `🎉 **LEVEL UP!** <@${message.author.id}>`,
                    embeds: [levelUpEmbed]
                });
            }

            // ================= SYNC TO GLOBAL ECONOMY =================
            try {
                const crossEconomy = require('./plugins/cross-economy.js');
                crossEconomy.setupDB(db);
                crossEconomy.syncLevelUp(db, userId, message.author.username, newLevel, newXP);
                crossEconomy.syncServerStats(db, guildId, guildName, message.guild?.memberCount || 0, 0);
                if (client.botStats) crossEconomy.addGlobalCredits(db, userId, message.author.username, 50, 'levelup', guildId, guildName);
            } catch (e) { /* global economy optional */ }

            console.log(`[LEVEL UP] ${message.author.tag} → Level ${newLevel} | XP: ${newXP} | Server: ${guildName} | Channel: ${targetChannel.name || 'DM'}`);
        }
    }

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

        // dbhealth command (Owner only)
        if (cmdName === 'dbhealth' && message.author.id === process.env.OWNER_ID) {
            const health = getDatabaseHealth();
            const embed = new EmbedBuilder()
                .setColor('#3498db')
                .setAuthor({ name: '💾 DATABASE HEALTH MONITOR', iconURL: client.user.displayAvatarURL() })
                .addFields(
                    { name: '📦 DB Size', value: health.size, inline: true },
                    { name: '📝 WAL Size', value: health.walSize, inline: true },
                    { name: '📊 Fragmentation', value: `${health.fragmentation} ${health.fragmentationStatus || ''}`, inline: true },
                    { name: '💾 Wasted', value: health.wastedMB || 'N/A', inline: true },
                    { name: '🕒 Next Auto-Purge', value: `${health.nextAutoPurge}\n*${health.nextAutoPurgeFull}*`, inline: false },
                    { name: '🧼 Maintenance', value: health.autoPurgeStatus, inline: true },
                    { name: '⏳ Pending Writes', value: String(health.pendingWrites), inline: true },
                    { name: '👥 Cached Users', value: String(health.cachedUsers), inline: true },
                    { name: '🛡️ Circuit Breaker', value: health.circuitBreaker, inline: true },
                    { name: '💀 Dead Letters', value: String(health.deadLetters), inline: true }
                )
                .setFooter({ text: '🦅 ARCHON CG-223 • Database Health • bamako-steel-dev.xyz' })
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }

        if (command) {
    // Determine language from the exact alias typed
    let commandLang = client.aliasLang.get(usedCommand.toLowerCase()) || 'en';
    // Optional fallback to old detector for unknown aliases
    if (!client.aliasLang.has(usedCommand.toLowerCase())) {
        commandLang = detectLanguage(usedCommand);
    }
    // Store user's last used language for level‑up messages
    if (!client.userLastLang) client.userLastLang = new Map();
    client.userLastLang.set(message.author.id, commandLang);

    const cooldownMs = getCommandCooldown(cmdName);
const cooldownCheck = checkCooldown(message.author.id, cmdName, cooldownMs);
if (cooldownCheck.blocked) {
    const lang = commandLang || 'en';
    const msg = lang === 'fr' 
        ? `⏳ Ralentissez ! Réessayez dans ${cooldownCheck.remaining}s`
        : `⏳ Slow down! Try again in ${cooldownCheck.remaining}s`;
    return message.reply(msg).catch(() => {});
}
    
    try {
        await executePluginCommand(command, client, message, args, db, usedCommand, serverSettings, commandLang);
        // Bot XP: earns XP when processing a command
                if (client.botStats && message.guild) {
                    client.botStats.onCommandProcessed(db, message.guild.id, message.author.id, cmdName, false);
                }
                
                return;
            } catch (e) { 
                console.error(`${red}[COMMAND ERROR]${reset} ${cmdName}:`, e);
                const lang = detectLanguage(usedCommand || cmdName);
                const errorMsg = lang === 'fr' ? "⚠️ **Echec de l'execution de la commande.**" : "⚠️ **Command execution failed.**";
                return message.reply(errorMsg).catch(() => {});
            }
        }
    }
});

// ================= INTERACTION HANDLER =================
safeOn(Events.InteractionCreate, async (interaction) => {
    // SLASH COMMAND EXECUTION
    // Autocomplete handler
    if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (command?.autocomplete) {
            try {
                await command.autocomplete(interaction, client);
            } catch(e) {
                await interaction.respond([]).catch(() => {});
            }
        }
        return;
    }

    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) {
            console.log(`${yellow}[SLASH]${reset} Unknown command: ${interaction.commandName}`);
            return interaction.reply({ content: '❌ Command not found.', flags: 1 << 6 }).catch(() => {});
        }

        const restrictedCommands = ['profile', 'daily', 'shop', 'credits', 'balance', 'rank', 'leaderboard'];
        const restrictedCategories = ['ECONOMY', 'MODERATION', 'PROFILE', 'GAMING'];
        
        if (restrictedCommands.includes(command.name) || restrictedCategories.includes(command.category)) {
    if (!interaction.guild) {
        // Get user's preferred language from locale or fallback
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        
        const title = lang === 'fr' ? '🦅 ACCÈS RESTREINT — COMMANDE SERVEUR UNIQUEMENT' : '🦅 RESTRICTED ACCESS — SERVER-ONLY COMMAND';
        const description = lang === 'fr'
            ? `\`\`\`ansi\n\u001b[1;33m⚠️ ZONE DE COMMANDE INVALIDE\u001b[0m\n\nCette commande nécessite un \u001b[1;36mcontexte serveur\u001b[0m pour accéder aux données du guilde.\n\`\`\``
            : `\`\`\`ansi\n\u001b[1;33m⚠️ INVALID COMMAND ZONE\u001b[0m\n\nThis command requires a \u001b[1;36mserver context\u001b[0m to access guild-specific data.\n\`\`\``;
        
        const actionRequired = lang === 'fr'
            ? `**Exécutez \`/${command.name}\` dans n'importe quel canal serveur où ${client.user.username} est présent.**\n\n🔹 *Les commandes de profil, économie et modération ne fonctionnent pas en messages privés.*`
            : `**Run \`/${command.name}\` in any server channel where ${client.user.username} is present.**\n\n🔹 *Profile, economy, and moderation commands do not work in DMs.*`;
        
        const suggestion = lang === 'fr'
            ? `💡 **Alternative :** Utilisez \`/help\` pour voir les commandes disponibles en DM.`
            : `💡 **Alternative:** Use \`/help\` to see commands available in DMs.`;
        
        const fallbackEmbed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setAuthor({ name: title, iconURL: client.user.displayAvatarURL() })
            .setDescription(description)
            .addFields(
                { name: lang === 'fr' ? '📍 ACTION REQUISE' : '📍 ACTION REQUIRED', value: actionRequired, inline: false },
                { name: lang === 'fr' ? '💡 SUGGESTION' : '💡 SUGGESTION', value: suggestion, inline: false }
            )
            .setFooter({ text: `BAMAKO-223 NODE • ${client.user.username} v${client.version}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        return interaction.reply({ embeds: [fallbackEmbed], flags: 1 << 6 });
    }
}

        try {
            console.log(`${cyan}[SLASH]${reset} Executing /${interaction.commandName} for ${interaction.user.tag}`);

            // ================= SLASH-TO-PREFIX ADAPTER =================
            // Plugins use command.run(client, message, args, ...) but
            // slash commands provide an Interaction object, not a Message.
            // This adapter bridges the gap by creating a message wrapper.

            if (command.execute) {
                // Plugin has native slash support — use it directly
                await command.execute(interaction, client);

                // Bot XP: earns XP when processing a slash command
                if (client.botStats && interaction.guild && db) {
                    client.botStats.onCommandProcessed(db, interaction.guild.id, interaction.user.id, interaction.commandName, true);
                }
            } else if (command.run) {
                // Plugin has prefix-style .run() — adapt interaction to message format

                // Build args array from slash command options
                const args = [];
                if (interaction.options) {
                    const subCmd = interaction.options.getSubcommand(false);
                    const subCmdGroup = interaction.options.getSubcommandGroup(false);
                    if (subCmdGroup) args.push(subCmdGroup);
                    if (subCmd) args.push(subCmd);

                    const opts = interaction.options.data;
                    for (const opt of opts) {
                        if (opt.value !== undefined && opt.value !== null) {
                            args.push(String(opt.value));
                        }
                        if (opt.options) {
                            for (const subOpt of opt.options) {
                                if (subOpt.value !== undefined && subOpt.value !== null) {
                                    args.push(String(subOpt.value));
                                }
                            }
                        }
                    }
                }

                const guildId = interaction.guild?.id || 'DM';
                const serverSettings = interaction.guild ? getServerSettings(interaction.guild.id) : DEFAULT_SETTINGS;
                const usedCommand = interaction.commandName;
                const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';

                // Create a message-like object that wraps the interaction
                const repliedSet = { value: false };
                const interactionMessage = {
                    author: interaction.user,
                    member: interaction.member,
                    guild: interaction.guild,
                    channel: interaction.channel,
                    channelId: interaction.channelId,
                    guildId: interaction.guildId,
                    id: interaction.id,
                    client: interaction.client,
                    createdTimestamp: interaction.createdTimestamp,
                    content: `/${usedCommand} ${args.join(' ')}`,

                    reply: async (options) => {
                        if (repliedSet.value) return interaction.followUp(options).catch(() => {});
                        repliedSet.value = true;
                        return interaction.reply(options).catch(() => {});
                    },
                    edit: async (options) => {
                        if (interaction.replied || interaction.deferred) {
                            return interaction.editReply(options).catch(() => {});
                        }
                        return interaction.reply(options).catch(() => {});
                    },
                    deferReply: async (options) => {
                        if (!repliedSet.value) {
                            repliedSet.value = true;
                            return interaction.deferReply(options).catch(() => {});
                        }
                    },
                    send: async (options) => {
                        if (interaction.channel) {
                            return interaction.channel.send(options).catch(() => {});
                        }
                    },
                    delete: async () => {
                        if (interaction.replied) return interaction.deleteReply().catch(() => {});
                    },
                    _isSlashAdapter: true,
                    _interaction: interaction,
                    _replied: repliedSet
                };

                // Execute plugin's run() with adapted parameters
                await executePluginCommand(command, client, interactionMessage, args, db, usedCommand, serverSettings, lang);

                // If plugin never replied, send basic acknowledgment
                if (!repliedSet.value && !interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '\u2705 Command executed.', flags: 1 << 6 }).catch(() => {});
                }

                // Bot XP tracking
                if (client.botStats && interaction.guild && db) {
                    client.botStats.onCommandProcessed(db, interaction.guild.id, interaction.user.id, interaction.commandName, true);
                }
            } else {
                await interaction.reply({ content: '\u274c This command has no execution handler.', flags: 1 << 6 }).catch(() => {});
            }
        } catch (error) {
            console.error(`${red}[SLASH ERROR]${reset} ${interaction.commandName}:`, error);
            const errorMsg = { content: '\u274c There was an error executing this command!', flags: 1 << 6 };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMsg).catch(() => {});
            } else {
                await interaction.reply(errorMsg).catch(() => {});
            }
        }
        return;
    }
    
    // ================= APPEAL TRIBUNAL BUTTONS =================
    if (interaction.isButton() && interaction.customId.startsWith('appeal_')) {
        try {
            const automod = client.commands.get('automod');
            if (automod?.handleAppealButton) {
                const handled = await automod.handleAppealButton(interaction, client);
                if (handled) return;
            }
        } catch (err) {
            console.error('[APPEAL BUTTON]', err.message);
        }
    }

    // ================= AUTOMOD DM APPEAL BUTTON =================
    if (interaction.isButton() && interaction.customId.startsWith('automod_appeal_')) {
        const parts = interaction.customId.split('_');
        const userId = parts[2];
        const guildId = parts[3];
        
        if (interaction.user.id !== userId) {
            return interaction.reply({ content: '🔒 This appeal button is not for you.', flags: 1 << 6 }).catch(() => {});
        }

        const modal = new ModalBuilder()
            .setCustomId(`appeal_modal_${userId}_${guildId}`)
            .setTitle('📝 Appeal AutoMod Action');

        const reasonInput = new TextInputBuilder()
            .setCustomId('appeal_reason')
            .setLabel('Why should this action be reversed?')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(500)
            .setPlaceholder('Explain why this was a mistake...');

        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));

        return interaction.showModal(modal).catch(() => {});
    }

    // ================= APPEAL MODAL SUBMIT =================
    if (interaction.isModalSubmit() && interaction.customId.startsWith('appeal_modal_')) {
        const parts = interaction.customId.split('_');
        const userId = parts[2];
        const guildId = parts[3];
        const reason = interaction.fields.getTextInputValue('appeal_reason');
        
        // Forward to DM appeal handler with formatted message
        const fakeMessage = {
            author: interaction.user,
            content: `appeal ${interaction.client.guilds.cache.get(guildId)?.name || guildId} | ${reason}`,
            guild: null,
            reply: async (options) => interaction.reply({ ...options, flags: 1 << 6 }).catch(() => {}),
        };
        
        try {
            const automod = client.commands.get('automod');
            if (automod?.handleDM) {
                await automod.handleDM(fakeMessage, client);
            }
        } catch (err) {
            console.error('[APPEAL MODAL]', err.message);
        }
        return;
    }

    // ================= WELCOME BUTTON HANDLER =================
    if (interaction.isButton() && interaction.customId === 'welcome_help') {
        const serverSettings = interaction.guild ? client.getServerSettings(interaction.guild.id) : null;
        const prefix = serverSettings?.prefix || process.env.PREFIX || '.';
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        
        const helpEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle(lang === 'fr' ? '🦅 ASSISTANCE GUARDIAN' : '🦅 GUARDIAN ASSISTANCE')
            .setDescription(
                `\`\`\`ansi\n` +
                (lang === 'fr'
                    ? `\u001b[1;36mBienvenue sur ${interaction.guild?.name || 'notre serveur'}!\u001b[0m\n\n` +
                      `\u001b[1;33mCommandes essentielles:\u001b[0m\n` +
                      `\u001b[1;32m${prefix}help\u001b[0m - Voir toutes les commandes\n` +
                      `\u001b[1;32m${prefix}profile\u001b[0m - Votre profil\n` +
                      `\u001b[1;32m${prefix}daily\u001b[0m - Recompense quotidienne\n` +
                      `\u001b[1;32m${prefix}shop\u001b[0m - Boutique\n` +
                      `\u001b[1;32m${prefix}lydia [message]\u001b[0m - Parler a l'IA\n`
                    : `\u001b[1;36mWelcome to ${interaction.guild?.name || 'our server'}!\u001b[0m\n\n` +
                      `\u001b[1;33mEssential commands:\u001b[0m\n` +
                      `\u001b[1;32m${prefix}help\u001b[0m - View all commands\n` +
                      `\u001b[1;32m${prefix}profile\u001b[0m - Your profile\n` +
                      `\u001b[1;32m${prefix}daily\u001b[0m - Daily reward\n` +
                      `\u001b[1;32m${prefix}shop\u001b[0m - Shop\n` +
                      `\u001b[1;32m${prefix}lydia [message]\u001b[0m - Talk to AI\n`
                ) +
                `\`\`\``
            )
            .setFooter({ text: `${interaction.guild?.name || 'Neural Network'} • ${prefix} = prefix • v${client.version}` });
        
        await interaction.reply({ embeds: [helpEmbed], flags: 1 << 6 });
        return;
    }

    // ================= PROFILE BUTTON HANDLER (COMPOSITE KEY AWARE) =================
    if (interaction.isButton() && interaction.customId.startsWith('welcome_profile_')) {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        
        try {
            const clicker = interaction.user;
            const clickerId = clicker.id;
            // Resolve guildId from interaction context for composite key lookup
            const profileGuildId = interaction.guild?.id || 'DM';
            
            // Get the CLICKER'S data from database using composite key
            let userData = client.getUserData(clickerId, profileGuildId) || client.getUser(clickerId, profileGuildId);
            
            if (!userData) {
                userData = initializeUser(clickerId, profileGuildId, clicker.username);
                cacheUserData(clickerId, profileGuildId, userData);
            }
            
            const xp = userData?.xp || 0;
            const level = client.calculateLevel ? client.calculateLevel(xp) : 1;
            const credits = userData?.credits || 0;
            const streakDays = userData?.streak_days || 0;
            const totalMessages = userData?.total_messages || 0;
            const gamesPlayed = userData?.games_played || 0;
            const gamesWon = userData?.games_won || 0;
            const totalDailies = userData?.total_dailies || 0;
            const highestStreak = userData?.highest_streak || 0;
            
            const creationUnix = Math.floor(clicker.createdTimestamp / 1000);
            const ageDays = Math.floor((Date.now() - clicker.createdTimestamp) / 86400000);
            
            let joinUnix = null;
            let joinDays = null;
            if (interaction.guild) {
                const member = await interaction.guild.members.fetch(clickerId).catch(() => null);
                if (member?.joinedAt) {
                    joinUnix = Math.floor(member.joinedAt.getTime() / 1000);
                    joinDays = Math.floor((Date.now() - member.joinedAt.getTime()) / 86400000);
                }
            }
            
            let gamingInfo = '';
            try {
                const gaming = typeof userData?.gaming === 'string' 
                    ? JSON.parse(userData.gaming) 
                    : (userData?.gaming || { game: 'CODM', rank: 'Unranked' });
                gamingInfo = `🎮 ${gaming.game || 'CODM'} | ${gaming.rank || 'Unranked'}`;
            } catch (e) {
                gamingInfo = '🎮 CODM | Unranked';
            }
            
            const currentLevelXP = Math.pow((level - 1) / 0.1, 2);
            const nextLevelXP = Math.pow(level / 0.1, 2);
            const xpProgress = xp - currentLevelXP;
            const xpNeeded = nextLevelXP - currentLevelXP;
            const progressPercent = Math.min(100, Math.floor((xpProgress / xpNeeded) * 100));
            
            const barLength = 10;
            const filledBars = Math.floor((progressPercent / 100) * barLength);
            const emptyBars = barLength - filledBars;
            const progressBar = '🟦'.repeat(filledBars) + '⬜'.repeat(emptyBars);
            
            const profileEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setAuthor({ 
                    name: lang === 'fr' ? `👤 PROFIL • ${clicker.username}` : `👤 PROFILE • ${clicker.username}`,
                    iconURL: clicker.displayAvatarURL() 
                })
                .setDescription(
                    `### 📊 ${lang === 'fr' ? 'Statistiques Neurales' : 'Neural Statistics'}\n` +
                    `\`\`\`yaml\n` +
                    `${lang === 'fr' ? 'Niveau' : 'Level'}: ${level}\n` +
                    `XP: ${xp.toLocaleString()} / ${Math.floor(nextLevelXP).toLocaleString()}\n` +
                    `${lang === 'fr' ? 'Progression' : 'Progress'}: ${progressBar} ${progressPercent}%\n` +
                    `${lang === 'fr' ? 'Credits' : 'Credits'}: ${credits.toLocaleString()} 🪙\n` +
                    `${lang === 'fr' ? 'Serie Quotidienne' : 'Daily Streak'}: ${streakDays} 🔥\n` +
                    `${lang === 'fr' ? 'Record de Serie' : 'Best Streak'}: ${highestStreak} 💎\n` +
                    `${lang === 'fr' ? 'Total Quotidiens' : 'Total Dailies'}: ${totalDailies}\n` +
                    `${lang === 'fr' ? 'Messages' : 'Messages'}: ${totalMessages.toLocaleString()}\n` +
                    `${lang === 'fr' ? 'Parties Jouees' : 'Games Played'}: ${gamesPlayed}\n` +
                    `${lang === 'fr' ? 'Victoires' : 'Wins'}: ${gamesWon}\n` +
                    `\`\`\``
                )
                .addFields(
                    {
                        name: `📅 **${lang === 'fr' ? 'Compte Cree' : 'Account Created'}**`,
                        value: `<t:${creationUnix}:D> (${ageDays} ${lang === 'fr' ? 'jours' : 'days'})`,
                        inline: true
                    },
                    {
                        name: `🏛️ **${lang === 'fr' ? 'Rejoint le Serveur' : 'Joined Server'}**`,
                        value: joinUnix 
                            ? `<t:${joinUnix}:D> (${joinDays} ${lang === 'fr' ? 'jours' : 'days'})` 
                            : (lang === 'fr' ? 'Non disponible' : 'N/A'),
                        inline: true
                    },
                    {
                        name: `🎮 **Gaming**`,
                        value: gamingInfo,
                        inline: true
                    }
                )
                .setThumbnail(clicker.displayAvatarURL({ dynamic: true, size: 256 }))
                .setFooter({ 
                    text: `🏗️ Architect CG-223 • ${interaction.guild?.name || 'Neural Network'}` 
                })
                .setTimestamp();
            
            await interaction.reply({ embeds: [profileEmbed], flags: 1 << 6 });
            
        } catch (err) {
            console.error('[PROFILE BUTTON ERROR]', err);
            await interaction.reply({ 
                content: lang === 'fr' ? "❌ Erreur lors du chargement du profil." : "❌ Error loading profile.", 
                flags: 1 << 6 
            });
        }
        return;
    }
    
    // ================= BIRTHDAY CELEBRATION BUTTON =================
    if (interaction.isButton() && interaction.customId.startsWith('bday_celebrate_')) {
        const userId = interaction.customId.replace('bday_celebrate_', '');
        const user = await client.users.fetch(userId).catch(() => null);
        
        if (!user) {
            return interaction.reply({ content: 'User not found!', flags: 1 << 6 });
        }
        
        const messages = {
            en: [
                `🎉 **${interaction.user.username}** celebrates **${user.username}**'s birthday! 🎂`,
                `🎈 **${interaction.user.username}** sends birthday wishes to **${user.username}**! 🎁`,
                `🎊 **${interaction.user.username}** joins the birthday celebration for **${user.username}**! 🎉`
            ],
            fr: [
                `🎉 **${interaction.user.username}** celebre l'anniversaire de **${user.username}**! 🎂`,
                `🎈 **${interaction.user.username}** envoie ses veux a **${user.username}**! 🎁`,
                `🎊 **${interaction.user.username}** se joint a la fete de **${user.username}**! 🎉`
            ]
        };
        
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const randomMsg = messages[lang][Math.floor(Math.random() * messages[lang].length)];
        
        await interaction.reply({ content: randomMsg });
        return;
    }
    
    // ================= BIRTHDAY GIFT BUTTON =================
    if (interaction.isButton() && interaction.customId.startsWith('bday_gift_')) {
        const userId = interaction.customId.replace('bday_gift_', '');
        const user = await client.users.fetch(userId).catch(() => null);
        
        if (!user) {
            return interaction.reply({ content: 'User not found!', flags: 1 << 6 });
        }
        
        const messages = {
            en: [
                `🎁 **${interaction.user.username}** sends a virtual gift to **${user.username}**! 🎂`,
                `💝 **${interaction.user.username}** sends birthday love to **${user.username}**! 🎈`,
                `🌟 **${interaction.user.username}** celebrates with **${user.username}**! Happy Birthday! 🎉`
            ],
            fr: [
                `🎁 **${interaction.user.username}** envoie un cadeau virtuel a **${user.username}**! 🎂`,
                `💝 **${interaction.user.username}** envoie de l'amour a **${user.username}**! 🎈`,
                `🌟 **${interaction.user.username}** fait la fete avec **${user.username}**! Joyeux anniversaire! 🎉`
            ]
        };
        
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const randomMsg = messages[lang][Math.floor(Math.random() * messages[lang].length)];
        
        await interaction.reply({ content: randomMsg });
        return;
    }
    
    // ================= AFK REMINDER BUTTON =================
    if (interaction.isButton() && interaction.customId.startsWith('afk_remind_')) {
        const targetId = interaction.customId.replace('afk_remind_', '');
        const afkData = afkUsers.get(targetId);
        
        if (!afkData) {
            return interaction.reply({ content: 'This user is no longer AFK.', flags: 1 << 6 });
        }
        
        if (!afkData.reminders) afkData.reminders = [];
        afkData.reminders.push({
            from: interaction.user.id,
            fromName: interaction.user.username,
            timestamp: Date.now()
        });
        afkUsers.set(targetId, afkData);
        
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const replyMsg = lang === 'fr' 
            ? `🔔 Rappel envoye! ${afkData.username} le verra a son retour.`
            : `🔔 Reminder sent! ${afkData.username} will see it when they return.`;
        
        await interaction.reply({ content: replyMsg, flags: 1 << 6 });
        return;
    }

    // ================= DM STREAK INFO BUTTON =================
    if (interaction.isButton() && interaction.customId.startsWith('dm_streak_info_')) {
        const rewardTiers = [
            '🌱 **3 Days:** +15 bonus credits',
            '🔥 **7 Days:** +50% bonus + role unlock',
            '⚔️ **30 Days:** Exclusive elite role',
            '💎 **100 Days:** Premium rewards tier',
            '👑 **365 Days:** Legendary status + custom role'
        ];
        
        await interaction.reply({ 
            content: `**🔥 STREAK REWARDS:**\n${rewardTiers.join('\n')}\n\n*Use \`.daily\` every 24h to build your streak!*`,
            flags: 1 << 6 
        });
        return;
    }

    // ================= DM SHOP SHIELD BUTTON (COMPOSITE KEY AWARE) =================
    if (interaction.isButton() && interaction.customId.startsWith('dm_shop_')) {
        const userId = interaction.customId.replace('dm_shop_', '');
        // Resolve guild context for composite key lookup
        const shopGuildId = interaction.guild?.id || 'DM';
        const userData = client.getUserData(userId, shopGuildId) || client.getUser(userId, shopGuildId);
        const credits = userData?.credits || 0;
        const canAfford = credits >= 2000;
        
        const shopEmbed = new EmbedBuilder()
            .setColor(canAfford ? '#2ecc71' : '#e74c3c')
            .setTitle('🛡️ Streak Protection Shield')
            .setDescription(
                `**Price:** 2,000 🪙\n` +
                `**Your Balance:** ${credits.toLocaleString()} 🪙\n\n` +
                `*Protects your streak if you miss a daily claim.*`
            )
            .addFields({
                name: canAfford ? '✅ You can afford this!' : '❌ Insufficient credits',
                value: canAfford 
                    ? 'Use `.buy streak_shield` in any server!'
                    : `Need ${(2000 - credits).toLocaleString()} more 🪙. Use \`.daily\` to earn!`
            });
        
        await interaction.reply({ embeds: [shopEmbed], flags: 1 << 6 });
        return;
    }

    // ================= GAME CENTER HUB BUTTONS =================
    if (interaction.isButton() && interaction.customId.startsWith('game_')) {
        try {
            const gameModule = require('./plugins/game.js');
            if (gameModule.handleComponent) {
                const handled = await gameModule.handleComponent(interaction, client);
                if (handled) return;
            }
        } catch (err) {
            console.error(`[GAME HUB BUTTON]`, err.message);
        }
        return;
    }

// ================= CONTACT REPLY HANDLER (Cross-server DM reply) =================
    if (interaction.isButton() && interaction.customId.startsWith('creply_')) {
        try {
            const parts = interaction.customId.split('_');
            const targetUserId = parts[1];

            // Only owner can use reply button
            const OWNER_ID = process.env.OWNER_ID;
            if (interaction.user.id !== OWNER_ID) {
                return interaction.reply({ content: '❌ Owner only.', flags: 64 }).catch(() => {});
            }

            // Ask owner for reply text via a follow-up
            await interaction.reply({ content: '💬 **Type your reply** — send it in the next 60 seconds:', flags: 64 }).catch(() => {});

            const filter = m => m.author.id === OWNER_ID;
            const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 60000 }).catch(() => null);

            if (!collected || collected.size === 0) {
                return interaction.followUp({ content: '⏰ Reply timed out.', flags: 64 }).catch(() => {});
            }

            const replyText = collected.first().content;
            collected.first().delete().catch(() => {});

            // DM the target user
            const targetUser = await client.users.fetch(targetUserId).catch(() => null);
            if (!targetUser) {
                return interaction.followUp({ content: '❌ Could not find user.', flags: 64 }).catch(() => {});
            }

            await targetUser.send({
                embeds: [new (require('discord.js').EmbedBuilder)()
                    .setColor('#00ff88')
                    .setAuthor({ name: '📡 NEURAL TRANSMISSION — ARCHITECT REPLY', iconURL: client.user.displayAvatarURL() })
                    .setDescription(
                        '```ansi
' +
                        '[1;32m▸ FROM      [0mThe Architect
' +
                        '[1;37m▸ MESSAGE   [0m' + replyText + '
' +
                        '[0;37m▸ TIP       [0mUse .contact to send a follow-up
' +
                        '```'
                    )
                    .setFooter({ text: 'NEURAL CONTACT v2.0 · BAMAKO_223 🇲🇱' })
                    .setTimestamp()
                ]
            });

            await interaction.followUp({ content: `✅ Reply sent to **${targetUser.username}** via DM.`, flags: 64 }).catch(() => {});
            console.log(`[CONTACT REPLY] Architect → ${targetUser.tag}: ${replyText.substring(0,80)}`);

        } catch(err) {
            console.error('[CONTACT REPLY]', err.message);
            interaction.followUp({ content: '❌ Reply failed.', flags: 64 }).catch(() => {});
        }
        return;
    }

// ================= MUSIC PANEL BUTTONS (Global — never expires, works for 24h streams) =================
    if (interaction.isButton() && ['mc_prev','mc_pause','mc_skip','mc_stop','mc_loop','mc_queue'].includes(interaction.customId)) {
        try {
            const { getQueue, buildQueueEmbed, ARCHON } = require('./plugins/music.js');
            const { AudioPlayerStatus } = require('@discordjs/voice');

            if (!interaction.member?.voice?.channel) {
                return interaction.reply({ content: '❌ Join a voice channel first!', flags: 64 }).catch(() => {});
            }

            await interaction.deferUpdate().catch(() => {});
            const q = getQueue(interaction.guild.id);
            if (!q) return;

            switch (interaction.customId) {
                case 'mc_prev': {
                    if (!q.trackHistory || q.trackHistory.length === 0) {
                        await interaction.followUp({ content: '⏮️ No previous track.', flags: 64 }).catch(() => {});
                        return;
                    }
                    const prev = q.trackHistory.shift();
                    if (q.currentTrack) q.tracks.unshift({...q.currentTrack});
                    q.tracks.unshift(prev);
                    q.player.stop();
                    break;
                }
                case 'mc_pause': {
                    const isPaused = q.player.state.status === AudioPlayerStatus.Paused;
                    if (isPaused) {
                        q.player.unpause();
                        q.totalPaused += Date.now() - (q.pausedAt || Date.now());
                        q.pausedAt = null;
                    } else {
                        q.player.pause();
                        q.pausedAt = Date.now();
                    }
                    // Update panel immediately
                    const { updatePersistentPanel } = require('./plugins/music.js');
                    if (updatePersistentPanel) await updatePersistentPanel(q).catch(() => {});
                    break;
                }
                case 'mc_skip': {
                    q.player.stop();
                    break;
                }
                case 'mc_stop': {
                    const { destroyQueue } = require('./plugins/music.js');
                    if (q.persistentMsg) {
                        const { EmbedBuilder } = require('discord.js');
                        const stoppedEmbed = new EmbedBuilder().setColor(0xff3333).setDescription("Stream stopped.");
                        await q.persistentMsg.edit({ embeds: [stoppedEmbed], components: [] }).catch(() => {});
                        q.persistentMsg = null;
                    }
                    destroyQueue(interaction.guild.id);
                    break;
                }
                case 'mc_loop': {
                    q.loop = !q.loop;
                    const { updatePersistentPanel: updPanel } = require('./plugins/music.js');
                    if (updPanel) await updPanel(q).catch(() => {});
                    break;
                }
                case 'mc_queue': {
                    const qEmbed = buildQueueEmbed(q, client);
                    await interaction.followUp({ embeds: [qEmbed], flags: 64 }).catch(() => {});
                    break;
                }
            }
        } catch(err) {
            console.error('[MUSIC BUTTON GLOBAL]', err.message);
        }
        return;
    }

// ================= TICKET SYSTEM COMPONENTS (Select Menu + Buttons + Modals) =================
const isTicketComponent = (interaction.isButton() && interaction.customId.startsWith('ticket_')) ||
(interaction.isStringSelectMenu() && (
    interaction.customId === 'ticket_lang_select' || 
    interaction.customId === 'ticket_category_select'
)) || 
(interaction.isModalSubmit() && interaction.customId.startsWith('ticket_issue_modal_'));

    if (isTicketComponent) {
        try {
            const ticketModule = require('./plugins/ticket.js');
            if (ticketModule.handleComponent) {
                const handled = await ticketModule.handleComponent(interaction, client);
                if (handled) return;
            }
        } catch (err) {
            console.error(`${red}[TICKET COMPONENT]${reset}`, err.message);
            await interaction.reply({ content: '❌ Ticket action failed.', flags: 1 << 6 }).catch(() => {});
        }
        return;
    }

    // ================= VOTE SYSTEM BUTTONS (slash command) =================
    if (interaction.isButton() && interaction.customId && interaction.customId.startsWith('vote_') && interaction.customId.endsWith('_slash')) {
        try {
            const voteModule = require('./plugins/vote.js');
            if (voteModule.handleSlashButton) {
                await voteModule.handleSlashButton(interaction, client);
                return;
            }
        } catch (err) {
            console.error(`${red}[VOTE BUTTON]${reset}`, err.message);
            await interaction.reply({ content: '❌ Vote action failed.', flags: 1 << 6 }).catch(() => {});
        }
        return;
    }

    // ================= MEME BUTTONS =================
    if (interaction.isButton() && interaction.customId && interaction.customId.startsWith('meme_')) {
        try {
            const memeModule = require('./plugins/meme.js');
            if (memeModule.handleButton) {
                await memeModule.handleButton(interaction, client);
                return;
            }
        } catch (err) {
            console.error(`${red}[MEME BUTTON]${reset}`, err.message);
            await interaction.reply({ content: '❌ Meme button failed.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
        return;
    }

    // ================= CAT BUTTONS =================
    if (interaction.isButton() && interaction.customId && interaction.customId.startsWith('cat_')) {
        try {
            const catModule = require('./plugins/cat.js');
            if (catModule.handleButton) {
                await catModule.handleButton(interaction, client);
                return;
            }
        } catch (err) {
            console.error(`${red}[CAT BUTTON]${reset}`, err.message);
            await interaction.reply({ content: '❌ Cat button failed.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
        return;
    }

    // ================= DOG BUTTONS =================
    if (interaction.isButton() && interaction.customId && interaction.customId.startsWith('dog_')) {
        try {
            const dogModule = require('./plugins/dog.js');
            if (dogModule.handleButton) {
                await dogModule.handleButton(interaction, client);
                return;
            }
        } catch (err) {
            console.error(`${red}[DOG BUTTON]${reset}`, err.message);
            await interaction.reply({ content: '❌ Dog button failed.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
        return;
    }

    // ================= CAR BUTTONS =================
    if (interaction.isButton() && interaction.customId && interaction.customId.startsWith('car_')) {
        try {
            const carModule = require('./plugins/car.js');
            if (carModule.handleButton) {
                await carModule.handleButton(interaction, client);
                return;
            }
        } catch (err) {
            console.error(`${red}[CAR BUTTON]${reset}`, err.message);
            await interaction.reply({ content: '❌ Car button failed.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
        return;
    }
});

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  🦅 GUILD CREATE — OWNER WELCOME SYSTEM                            ║
// ║  Sends professional onboarding DM when ARCHON joins a new server   ║
// ╚══════════════════════════════════════════════════════════════════════╝
safeOn(Events.GuildCreate, async (guild) => {
    try {
        // Skip owner's test guild — they already know the bot
        if (guild.id === process.env.GUILD_ID) return;

        const owner = await guild.fetchOwner().catch(() => null);
        if (!owner || owner.user.bot) return;

        const setupEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setAuthor({ 
                name: '🦅 ARCHON CG-223 — Neural Grid Expansion', 
                iconURL: client.user.displayAvatarURL() 
            })
            .setTitle(`Welcome to ${guild.name}!`)
            .setDescription(
                `Thank you for adding **ARCHON CG-223** to your server.\n\n` +
                `Your server data is **fully isolated** — per-server partitioning ensures nothing is shared with other guilds.\n\n` +
                `\`\`\`ansi\n\u001b[1;32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\u001b[0m\n\`\`\``
            )
            .addFields(
                { 
                    name: '🛡️ AutoMod Protection', 
                    value: 
                        '```diff\n' +
                        '- Status: OFF by default\n' +
                        '+ Command: /automod enable\n' +
                        '```\n' +
                        'AutoMod blocks spam, malicious links, and unauthorized invites. It is **disabled until you explicitly enable it** — no surprises, no forced features.', 
                    inline: false 
                },
                { 
                    name: '⚡ Quick Setup Commands', 
                    value: 
                        '`/automod enable` — Activate protection\n' +
                        '`/serversettings` — Configure your server\n' +
                        '`/welcome` — Set welcome channel\n' +
                        '`/leveling` — Configure XP & ranks\n' +
                        '`/ticket setup` — Create support panel\n' +
                        '`/lydia` — Talk to AI (28 languages)', 
                    inline: false 
                },
                { 
                    name: '📊 Included Systems', 
                    value: 
                        '🧠 Lydia AI · 28-language chat\n' +
                        '💰 Economy · Credits, shop, market\n' +
                        '📈 Leveling · Canvas rank cards\n' +
                        '🎫 Tickets · 3 categories\n' +
                        '🛡️ AutoMod · Domain whitelist\n' +
                        '⚡ Daily · Streak rewards\n' +
                        '📢 Broadcast · Smart updates', 
                    inline: true 
                },
                { 
                    name: '🌐 Links', 
                    value: 
                        '[Dashboard](https://bamako-steel-dev.xyz)\n' +
                        '[Support Server](https://discord.gg/NFSMFJajp9)\n' +
                        '[Website](https://bamako-steel-dev.xyz)', 
                    inline: true 
                }
            )
            .setFooter({ 
                text: `ARCHON CG-223 v${client.version || '3.2'} • Server ID: ${guild.id} • MFOF7310 🇲🇱`, 
                iconURL: client.user.displayAvatarURL() 
            })
            .setTimestamp();

        await owner.send({ embeds: [setupEmbed] }).catch(() => {});
        console.log(`\x1b[32m[GUILD CREATE]\x1b[0m Welcome DM sent to ${owner.user.tag} (${guild.name})`);

    } catch (e) {
        console.log(`\x1b[33m[GUILD CREATE]\x1b[0m Could not DM owner: ${e.message}`);
    }
});

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  🗑️ GUILD DELETE — CLEANUP PROTOCOL                                ║
// ║  Removes server data when ARCHON is kicked                         ║
// ╚══════════════════════════════════════════════════════════════════════╝
safeOn(Events.GuildDelete, async (guild) => {
    try {
        const gid = guild.id;
        
        // Log the departure
        console.log(`\x1b[33m[GUILD DELETE]\x1b[0m Left ${guild.name} (${gid}) — ${guild.memberCount} members`);

        // Clean up server_settings row
        db.prepare('DELETE FROM server_settings WHERE guild_id = ?').run(gid);
        
        // Clean up per-server user data
        const deletedUsers = db.prepare('DELETE FROM users WHERE guild_id = ?').run(gid);
        
        // Clean up server-specific warnings
        db.prepare('DELETE FROM warnings WHERE guild_id = ?').run(gid);
        
        // Clean up server-specific moderation logs
        db.prepare('DELETE FROM moderation_logs WHERE guild_id = ?').run(gid);
        
        // Clean up command settings
        db.prepare('DELETE FROM server_command_settings WHERE guild_id = ?').run(gid);
        
        // Clean up economy settings
        db.prepare('DELETE FROM server_economy_settings WHERE guild_id = ?').run(gid);
        
        // Remove from in-memory cache
        client.settings.delete(gid);
        
        // Clear any cached user data for this guild
        if (client.userDataCache) {
            for (const [key] of client.userDataCache) {
                if (key.endsWith(`:${gid}`)) client.userDataCache.delete(key);
            }
        }
        
        console.log(`\x1b[32m[GUILD DELETE]\x1b[0m Cleanup complete: ${deletedUsers.changes} users removed`);

    } catch (e) {
        console.error(`\x1b[31m[GUILD DELETE]\x1b[0m Cleanup error for ${guild.id}: ${e.message}`);
    }
});

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  🦅 GUILD MEMBER ADD — ORCHESTRATED WELCOME v6.0                    ║
// ║  Delegates to welcome.js plugin if loaded & configured.             ║
// ║  Falls back to shared cinematic engine if no custom config.       ║
// ╚══════════════════════════════════════════════════════════════════════╝
safeOn(Events.GuildMemberAdd, async (member) => {
    if (member.user.bot) return;
    if (rateLimit(`welcome:${member.guild.id}`, 10, 30000)) return;

    // ── LEVELING PLUGIN (always runs, independent of welcome) ──
    if (client.leveling?.onMemberAdd) {
        await client.leveling.onMemberAdd(member, client, db);
    }

        // ── WELCOME ORCHESTRATION ──
    // Load settings via shared normalizer for consistency
    const Style = require('./plugins/welcome-style.js');
    const ssRaw = client.getServerSettings?.(member.guild.id) || {};
    let cfg = Style.normalizeWelcomeConfig(ssRaw);

    // ── PER-SERVER ENV FALLBACK (owner server only — no leakage) ──
    const isOwnerServer = member.guild.id === process.env.GUILD_ID;
    if (isOwnerServer) {
        cfg.welcomeChannel = cfg.welcomeChannel || process.env.WELCOME_CHANNEL_ID;
        cfg.goodbyeChannel = cfg.goodbyeChannel || process.env.GOODBYE_CHANNEL_ID;
    }

    // Determine if custom welcome is configured
    const hasCustomWelcome = cfg.welcomeChannel || cfg.welcomeMessage;

if (client.welcome?.onMemberAdd) {
        // PLUGIN PATH: Plugin loaded → it handles everything, fallback skipped
        await client.welcome.onMemberAdd(member, client, db);
    } else if (hasCustomWelcome) {
        // FALLBACK PATH: No plugin but channel configured → use shared module
        await fallbackWelcome(member, client, db, cfg, Style);
    }
});

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  FALLBACK WELCOME — Default cinematic matrix when no custom config   ║
// ╚══════════════════════════════════════════════════════════════════════╝
async function fallbackWelcome(member, client, db, cfg, Style) {
    if (!cfg.welcomeEnabled) return;

    const ch = cfg.welcomeChannel 
        ? member.guild.channels.cache.get(cfg.welcomeChannel) 
        : member.guild.systemChannel;
    if (!ch) return;

    const count = member.guild.memberCount;
    const lang = member.guild.preferredLocale === 'fr' ? 'fr' : 'en';

        // Render card via shared engine
    const png = await Style.renderWelcomeCard(member, count);
    
    // Convert canvas buffer to base64 data URL (no duplicate attachment)
    const dataUrl = `data:image/png;base64,${png.toString('base64')}`;
    
    const embed = new EmbedBuilder()
        .setColor(0x00fbff)
        .setImage(dataUrl)
        .setFooter({ text: 'ARCHON CG-223 | Neural Grid' })
        .setTimestamp();

    const ansi = Style.ansiWelcome(member, count);
    const tips = Style.buildProTips(cfg, lang);
    
    const tipBlock = lang === 'fr'
        ? `\n> 💡 **Pour bien démarrer :**\n${tips.map(t => `> • ${t}`).join('\n')}`
        : `\n> 💡 **Quick start :**\n${tips.map(t => `> • ${t}`).join('\n')}`;

    await ch.send({
        content: ansi + tipBlock,
        embeds: [embed],
    }).catch(() => {});
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  🦅 GUILD MEMBER REMOVE — ORCHESTRATED GOODBYE v6.0                ║
// ║  Delegates to welcome.js plugin if loaded & configured.             ║
// ║  Falls back to shared cinematic engine if no custom config.         ║
// ╚══════════════════════════════════════════════════════════════════════╝
safeOn(Events.GuildMemberRemove, async (member) => {
    if (member.user.bot) return;
    if (rateLimit(`goodbye:${member.guild.id}`, 10, 30000)) return;

        // ── WELCOME PLUGIN: ON MEMBER REMOVE (goodbye handler) ──
    const Style = require('./plugins/welcome-style.js');
    const ssRaw = client.getServerSettings?.(member.guild.id) || {};
    let cfg = Style.normalizeWelcomeConfig(ssRaw);

    // ── PER-SERVER ENV FALLBACK (owner server only — no leakage) ──
    const isOwnerServer = member.guild.id === process.env.GUILD_ID;
    if (isOwnerServer) {
        cfg.welcomeChannel = cfg.welcomeChannel || process.env.WELCOME_CHANNEL_ID;
        cfg.goodbyeChannel = cfg.goodbyeChannel || process.env.GOODBYE_CHANNEL_ID;
    }

    const hasCustomGoodbye = cfg.goodbyeChannel || cfg.goodbyeMessage;

if (client.welcome?.onMemberRemove) {
        // PLUGIN PATH: Plugin loaded → it handles everything, fallback skipped
        await client.welcome.onMemberRemove(member, client, db);
    } else if (hasCustomGoodbye) {
        // FALLBACK PATH: No plugin but channel configured → use shared module
        await fallbackGoodbye(member, client, db, cfg, Style);
    }
});

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  FALLBACK GOODBYE — Default departure matrix when no custom config  ║
// ╚══════════════════════════════════════════════════════════════════════╝
async function fallbackGoodbye(member, client, db, cfg, Style) {
    if (!cfg.goodbyeEnabled || !cfg.goodbyeChannel) return;

    const ch = member.guild.channels.cache.get(cfg.goodbyeChannel);
    if (!ch) return;

    const joinedAt = member.joinedTimestamp;
    const duration = joinedAt ? Style.fmtDur(Date.now() - joinedAt) : null;
    const roles = [...member.roles.cache.values()].filter(r => r.id !== member.guild.id);

        const png = await Style.renderGoodbyeCard(member, duration, roles.length);
    
    // Convert canvas buffer to base64 data URL (no duplicate attachment)
    const dataUrl = `data:image/png;base64,${png.toString('base64')}`;
    
    const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setImage(dataUrl)
        .setFooter({ text: 'ARCHON CG-223 | Departure Log' })
        .setTimestamp();

    const content = Style.ansiGoodbye(member, duration, roles.length, roles);

    await ch.send({
        content,
        embeds: [embed],
    }).catch(() => {});
}

// ================= GRACEFUL SHUTDOWN (PER-SERVER PARTITIONED FLUSH) =================
async function gracefulShutdown(signal) {
    console.log(`\n${yellow}[SHUTDOWN]${reset} 🛑 ${signal} detected. Saving all pending data...`);
    
    if (client.cacheJanitorInterval) clearInterval(client.cacheJanitorInterval);
    if (client.reminderHeartbeatInterval) clearInterval(client.reminderHeartbeatInterval);
    if (client.batchWriteInterval) clearInterval(client.batchWriteInterval);
    if (client._retryTimeouts) { for (const id of client._retryTimeouts) clearTimeout(id); client._retryTimeouts.clear(); }
    
    // Flush pending updates with composite key destructuring
    if (client.pendingUserUpdates?.size > 0) {
        console.log(`${cyan}[SHUTDOWN]${reset} Flushing ${client.pendingUserUpdates.size} pending updates (per-server partitioned)...`);
        try {
            const updates = Array.from(client.pendingUserUpdates.entries());

            const updateStmt = db.prepare(`
                INSERT OR REPLACE INTO users (
                    id, guild_id, username, xp, level, total_messages, last_xp_gain, 
                    games_played, games_won, total_winnings, gaming, credits, 
                    streak_days, last_daily, total_dailies, highest_streak, streak_protections
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            db.transaction(() => {
                for (const [compositeKey, userData] of updates) {
                    const [userId, guildId] = compositeKey.split(':');
                    
                    let gamingValue = userData.gaming;
                    if (typeof gamingValue === 'object' && gamingValue !== null) {
                        gamingValue = JSON.stringify(gamingValue);
                    } else if (!gamingValue) {
                        gamingValue = '{"game":"CODM","rank":"Unranked"}';
                    }
                    
                    updateStmt.run(
                        userId,                           // 1: id
                        guildId,                          // 2: guild_id (composite PK)
                        userData.username || 'Unknown',   // 3
                        userData.xp ?? 0,                 // 4
                        userData.level ?? 1,              // 5
                        userData.total_messages ?? 0,     // 6
                        userData.last_xp_gain ?? 0,       // 7
                        userData.games_played ?? 0,       // 8
                        userData.games_won ?? 0,          // 9
                        userData.total_winnings ?? 0,     // 10
                        gamingValue,                      // 11
                        userData.credits ?? 0,            // 12
                        userData.streak_days ?? 0,        // 13
                        userData.last_daily ?? 0,         // 14
                        userData.total_dailies ?? 0,      // 15
                        userData.highest_streak ?? 0,     // 16
                        userData.streak_protections ?? 0  // 17
                    );
                }
            })();
            console.log(`${green}[SHUTDOWN]${reset} Final flush complete: ${updates.length} records saved (per-server partitioned)`);
        } catch (err) { console.error(`${red}[SHUTDOWN]${reset} Final flush failed:`, err.message); }
    }
    
    if (client.userTimeouts) { for (const [id, timeout] of client.userTimeouts) clearTimeout(timeout); client.userTimeouts.clear(); }
    client.userDataCache.clear(); client.settings.clear(); client.pendingUserUpdates.clear();
    
    try { db.exec("PRAGMA wal_checkpoint(TRUNCATE);"); db.close(); console.log(`${green}[SHUTDOWN]${reset} Database closed`); } catch (err) {}
    if (client.heapGuardian) client.heapGuardian.stop();
    console.log(`${green}[SHUTDOWN]${reset} Health systems stopped`); 
    console.log(`${green}[SHUTDOWN]${reset} ✅ All data saved. Exiting...`);
    process.exit(0);
 }
 
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// ═══════════════════════════════════════════════════════════════════
// 📡 ARCHON API BRIDGE v2.0 — Dashboard Communication
// ═══════════════════════════════════════════════════════════════════

const express = require('express');
const cors = require('cors');
const apiApp = express();

// ✅ CORS — Parse allowed origins from .env (safe for repos!)
const allowedOrigins = process.env.API_CORS_ORIGINS 
    ? process.env.API_CORS_ORIGINS.split(',').map(o => o.trim())
    : [];  // Empty = block all by default

apiApp.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (like mobile apps, curl)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.length === 0) {
            console.warn(`[API CORS] Blocked ${origin} — No origins configured in .env`);
            return callback(new Error('Not allowed by CORS - configure API_CORS_ORIGINS in .env'), false);
        }
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn(`[API CORS] Blocked ${origin} — Not in whitelist`);
            callback(new Error('Not allowed by CORS'), false);
        }
    },
    methods: ['GET', 'POST'],
    credentials: true
}));

apiApp.use(express.json());

// ================= API ROUTES =================

// ── MUSIC API ──────────────────────────────────────
apiApp.get('/api/music', (req, res) => {
    try {
        const musicPlugin = client.commands?.get('music');
        if (!musicPlugin?.getQueue) return res.json([]);
        const active = [];
        for (const [guildId, guild] of client.guilds.cache) {
            const q = musicPlugin.getQueue(guildId);
            if (q?.currentTrack) {
                const elapsed = q.startTime ? Math.floor((Date.now() - q.startTime - (q.totalPaused||0)) / 1000) : 0;
                active.push({
                    guildId,
                    guildName: guild.name,
                    guildIcon: guild.iconURL(),
                    currentTrack: q.currentTrack.title,
                    artist: q.currentTrack.artist || 'Unknown',
                    thumbnail: q.currentTrack.thumbnail,
                    duration: q.currentTrack.duration,
                    elapsed,
                    source: q.currentTrack.source,
                    requestedBy: q.currentTrack.requestedBy,
                    queueLength: q.tracks.length,
                    volume: q.volume,
                    loop: q.loop,
                    paused: q.player?.state?.status === 'paused',
                    voiceChannel: q.voiceChannel?.name,
                });
            }
        }
        res.json(active);
    } catch(e) { res.json([]); }
});

apiApp.get('/api/music/:guildId', (req, res) => {
    try {
        const musicPlugin = client.commands?.get('music');
        if (!musicPlugin?.getQueue) return res.json({ playing: false });
        const q = musicPlugin.getQueue(req.params.guildId);
        if (!q?.currentTrack) return res.json({ playing: false });
        const elapsed = q.startTime ? Math.floor((Date.now() - q.startTime - (q.totalPaused||0)) / 1000) : 0;
        res.json({
            playing: true,
            paused: q.player?.state?.status === 'paused',
            currentTrack: {
                title: q.currentTrack.title,
                artist: q.currentTrack.artist,
                thumbnail: q.currentTrack.thumbnail,
                duration: q.currentTrack.duration,
                elapsed,
                source: q.currentTrack.source,
                requestedBy: q.currentTrack.requestedBy,
            },
            queue: q.tracks.slice(0,20).map((t,i) => ({
                position: i+1,
                title: t.title,
                artist: t.artist,
                duration: t.duration,
            })),
            volume: q.volume,
            loop: q.loop,
            autoplay: q.autoplay,
            voiceChannel: q.voiceChannel?.name,
        });
    } catch(e) { res.json({ playing: false }); }
});

// Health check simple
apiApp.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        uptime: process.uptime(),
        timestamp: Date.now(),
        version: client.version || '2.0.0',
        node: 'BAMAKO_223',
        websocket_ping: client.ws?.ping || 0
    });
});

// Statistiques en temps réel pour le dashboard
apiApp.get('/api/stats', (req, res) => {
    try {
        const dbHealth = getDatabaseHealth();
        
        // Stats par serveur (limité à 10 pour performance)
        const servers = [];
        const guildCache = client.guilds.cache;
        let count = 0;
        for (const [id, guild] of guildCache) {
            if (count >= 10) break;
            try {
                const userCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE guild_id = ?').get(id)?.count || 0;
                servers.push({
                    id: id,
                    name: guild.name,
                    members: guild.memberCount,
                    icon: guild.iconURL({ size: 64 }),
                    registeredUsers: userCount,
                    boostTier: guild.premiumTier
                });
                count++;
            } catch (e) {}
        }

        res.json({
            status: 'online',
            timestamp: Date.now(),
            bot: {
                username: client.user?.username || 'Architect-CG223',
                tag: client.user?.tag || 'Unknown',
                avatar: client.user?.displayAvatarURL(),
                version: client.version || '2.0.0',
                uptime: process.uptime(),
                ping: Math.round(client.ws.ping),
                commands: client.commands.size,
                slashCommands: client.commands.filter(c => !!c.data).size,
                servers: guildCache.size,
                users: guildCache.reduce((acc, g) => acc + (g.memberCount || 0), 0)
            },
            servers: {
                total: guildCache.size,
                list: servers
            },
            database: {
                size: dbHealth.size,
                walSize: dbHealth.walSize,
                fragmentation: dbHealth.fragmentation,
                pendingWrites: client.pendingUserUpdates?.size || 0,
                cachedUsers: client.userDataCache?.size || 0,
                circuitBreaker: client.dbHealth?.circuitOpen ? 'OPEN' : 'CLOSED'
            },
            systems: {
                lydia: Object.keys(client.lydiaAgents || {}).length > 0,
                telegram: client.telegramBridge?.enabled || false,
                market: typeof getMarketState === 'function',
                afk: afkUsers?.size || 0,
                reminders: (() => {
                    try {
                        return db.prepare("SELECT COUNT(*) as count FROM reminders WHERE status = 'pending'").get()?.count || 0;
                    } catch (e) { return 0; }
                })()
            }
        });
    } catch (err) {
        console.error('[API /api/stats]', err);
        res.status(500).json({ error: 'Stats collection failed', message: err.message });
    }
});

// Route pour les paramètres d'un serveur spécifique (dashboard admin)
apiApp.get('/api/server/:guildId', (req, res) => {
    const { guildId } = req.params;
    if (!validateSnowflake(guildId)) {
        return res.status(400).json({ error: 'Invalid guild ID' });
    }
    
    try {
        const settings = getServerSettings(guildId);
        const guild = client.guilds.cache.get(guildId);
        
        if (!guild) {
            return res.status(404).json({ error: 'Guild not found or bot not member' });
        }

        // Récupérer les top utilisateurs du serveur
        let topUsers = [];
        try {
            topUsers = db.prepare(`
                SELECT id, username, xp, level, credits 
                FROM users 
                WHERE guild_id = ? 
                ORDER BY xp DESC 
                LIMIT 10
            `).all(guildId);
        } catch (e) {}

        res.json({
            success: true,
            guild: {
                id: guild.id,
                name: guild.name,
                memberCount: guild.memberCount,
                icon: guild.iconURL(),
                ownerId: guild.ownerId,
                boostCount: guild.premiumSubscriptionCount || 0,
                boostTier: guild.premiumTier
            },
            settings: {
                prefix: settings.prefix,
                language: settings.language,
                welcomeEnabled: settings.welcomeEnabled,
                goodbyeEnabled: settings.goodbyeEnabled,
                xpMultiplier: settings.xpMultiplier,
                afkEnabled: settings.afkEnabled,
                marketEnabled: settings.marketEnabled,
                aiEnabled: settings.aiEnabled,
                autoModEnabled: settings.autoModEnabled,
                welcomeChannel: settings.welcomeChannel,
                logChannel: settings.logChannel,
                modLogChannel: settings.modLogChannel
            },
            economy: {
                currencyName: settings.currency_name || 'credits',
                currencyEmoji: settings.currency_emoji || '🪙',
                dailyBonus: settings.daily_bonus || 200,
                transferTax: settings.transfer_tax || 0
            },
            topUsers: topUsers
        });
    } catch (err) {
        console.error('[API /api/server]', err);
        res.status(500).json({ error: 'Server fetch failed', message: err.message });
    }
});

// Route pour les commandes du bot
apiApp.get('/api/commands', (req, res) => {
    try {
        const commands = [];
        for (const [name, cmd] of client.commands) {
            commands.push({
                name: name,
                description: cmd.description || 'No description',
                category: cmd.category || 'GENERAL',
                aliases: cmd.aliases || [],
                hasSlash: !!cmd.data,
                usage: cmd.usage || null,
                cooldown: cmd.cooldown || 0
            });
        }
        commands.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
        
        res.json({
            success: true,
            total: commands.length,
            commands: commands
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── LEADERBOARD ───────────────────────────────────────
apiApp.get('/api/leaderboard/:guildId?', (req, res) => {
    const { guildId } = req.params;
    const { sortBy = 'xp' } = req.query;
    
    try {
        let users;
        if (guildId && validateSnowflake(guildId)) {
            users = db.prepare(
                `SELECT id, username, xp, level, credits, streak_days, total_messages, games_won
                 FROM users WHERE guild_id = ? ORDER BY ${sortBy === 'credits' ? 'credits' : 'xp'} DESC LIMIT 50`
            ).all(guildId);
        } else {
            users = db.prepare(
                `SELECT id, username, SUM(xp) as xp, MAX(level) as level, SUM(credits) as credits
                 FROM users GROUP BY id ORDER BY ${sortBy === 'credits' ? 'SUM(credits)' : 'SUM(xp)'} DESC LIMIT 50`
            ).all();
        }
        res.json({ success: true, users, sortBy, scope: guildId ? 'guild' : 'global' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── WARNINGS ──────────────────────────────────────────
apiApp.get('/api/warnings/:guildId?', (req, res) => {
    const { guildId } = req.params;
    try {
        let warnings;
        if (guildId && validateSnowflake(guildId)) {
            warnings = db.prepare('SELECT * FROM warnings WHERE guild_id = ? ORDER BY created_at DESC').all(guildId);
        } else {
            warnings = db.prepare('SELECT * FROM warnings ORDER BY created_at DESC LIMIT 100').all();
        }
        res.json({ success: true, warnings, count: warnings.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

apiApp.post('/api/warnings/:guildId', (req, res) => {
    const { guildId } = req.params;
    const { user_id, reason, moderator_id } = req.body;
    if (!user_id || !reason) return res.status(400).json({ error: 'Missing fields' });
    
    try {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        db.prepare('INSERT INTO warnings (id, guild_id, user_id, moderator_id, reason, created_at, active) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(id, guildId, user_id, moderator_id || 'system', reason, Math.floor(Date.now()/1000), 1);
        res.json({ success: true, warningId: id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── MODERATION LOGS ───────────────────────────────────
apiApp.get('/api/moderation-logs/:guildId?', (req, res) => {
    const { guildId } = req.params;
    try {
        let logs;
        if (guildId && validateSnowflake(guildId)) {
            logs = db.prepare('SELECT * FROM moderation_logs WHERE guild_id = ? ORDER BY timestamp DESC').all(guildId);
        } else {
            logs = db.prepare('SELECT * FROM moderation_logs ORDER BY timestamp DESC LIMIT 100').all();
        }
        res.json({ success: true, logs, count: logs.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── SETTINGS ──────────────────────────────────────────
apiApp.get('/api/settings/:guildId', (req, res) => {
    const { guildId } = req.params;
    if (!validateSnowflake(guildId)) return res.status(400).json({ error: 'Invalid guild ID' });
    
    try {
        const settings = getServerSettings(guildId);
        res.json({ success: true, guildId, settings });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── UPDATE CONFIG ─────────────────────────────────────
apiApp.post('/api/update-config', (req, res) => {
    const { guildId, settings } = req.body;
    if (!guildId || !settings) return res.status(400).json({ error: 'Missing fields' });

    try {
        let updated = 0;
        for (const [key, value] of Object.entries(settings)) {
            const val = (value === null || value === undefined || value === 'null') ? null : String(value);
            if (updateServerSetting(guildId, key, val)) updated++;
        }
        client.settings.delete(guildId);
        res.json({ success: true, updated, guildId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



// ─── MODERATION LOGS ──────────────────────────────────────────────────────────
apiApp.get('/api/modlogs/:guildId', (req, res) => {
    const { guildId } = req.params;
    const { limit = 50, action, userId } = req.query;
    if (!validateSnowflake(guildId)) return res.status(400).json({ error: 'Invalid guild ID' });
    try {
        let query = 'SELECT * FROM moderation_logs WHERE guild_id = ?';
        const params = [guildId];
        if (action) { query += ' AND action = ?'; params.push(action); }
        if (userId) { query += ' AND user_id = ?'; params.push(userId); }
        query += ' ORDER BY timestamp DESC LIMIT ?';
        params.push(parseInt(limit) || 50);
        const logs = db.prepare(query).all(...params);
        res.json({ success: true, logs, total: logs.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── WARNINGS ────────────────────────────────────────────────────────────────
apiApp.get('/api/warnings/:guildId', (req, res) => {
    const { guildId } = req.params;
    const { userId, active } = req.query;
    if (!validateSnowflake(guildId)) return res.status(400).json({ error: 'Invalid guild ID' });
    try {
        let query = 'SELECT * FROM warnings WHERE guild_id = ?';
        const params = [guildId];
        if (userId) { query += ' AND user_id = ?'; params.push(userId); }
        if (active !== undefined) { query += ' AND active = ?'; params.push(active === 'true' ? 1 : 0); }
        query += ' ORDER BY created_at DESC LIMIT 100';
        const warnings = db.prepare(query).all(...params);
        res.json({ success: true, warnings, total: warnings.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// TOP.GG VOTE WEBHOOK
apiApp.post('/api/vote', (req, res) => {
    const auth = req.headers['authorization'];
    const expectedAuth = process.env.TOPGG_WEBHOOK_SECRET || 'archon-vote-secret-2026';
    if (auth !== expectedAuth) {
        console.error('[VOTE] Unauthorized');
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { user, type, isWeekend } = req.body;
    if (!user) return res.status(400).json({ error: 'Missing user' });
    console.log('[VOTE] Received from user ' + user + ' | weekend: ' + isWeekend);
    try {
        const votesync = require('./plugins/votesync.js');
        const guild = client.guilds.cache.find(g => g.members.cache.has(user)) || client.guilds.cache.first();
        if (guild && votesync.processVote) {
            votesync.processVote(user, guild.id, client).catch(e => console.error('[VOTE] processVote:', e.message));
        }
        client.users.fetch(user).then(async u => {
            try {
                await u.send({
                    embeds: [{
                        color: 0x00ff88,
                        title: 'Vote Received - Thank You!',
                        description: 'Your Top.gg vote has been recorded! Credits added.' + (isWeekend ? ' Weekend bonus: 2x!' : ''),
                        footer: { text: 'ARCHON CG-223 - Vote Rewards' },
                        timestamp: new Date().toISOString()
                    }]
                });
            } catch(e) { console.log('[VOTE] DM failed:', e.message); }
        }).catch(() => {});
        res.json({ success: true, user, type });
    } catch(err) {
        console.error('[VOTE] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Broadcast endpoint
apiApp.post("/api/broadcast", (req, res) => {
    const { message, target } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });
    let count = 0;
    const guilds = client.guilds.cache;
    guilds.forEach(async (guild) => {
        try {
            const channel = guild.systemChannel || guild.channels.cache.find(c => c.type === 0 && c.permissionsFor(guild.members.me).has("SendMessages"));
            if (channel) {
                await channel.send({ content: `📢 **Broadcast from Architect:**\n${message}` });
                count++;
            }
        } catch(e) {}
    });
    setTimeout(() => res.json({ success: true, guildCount: count, total: guilds.size }), 2000);
});
// ─── COMMANDS (par guild) ──────────────────────────────
apiApp.get('/api/channels/:guildId', (req, res) => {
    const { guildId } = req.params;
    if (!validateSnowflake(guildId)) return res.status(400).json({ error: 'Invalid guild ID' });
    try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return res.status(404).json({ error: 'Guild not found' });
        const channels = guild.channels.cache
            .filter(c => [0, 5, 15, 16].includes(c.type)) // text, announcement, forum, media
            .sort((a, b) => (a.rawPosition || 0) - (b.rawPosition || 0))
            .map(c => ({
                id: c.id,
                name: c.name,
                type: c.type,
                category: c.parent?.name || null,
                position: c.rawPosition || 0,
            }));
        res.json({ success: true, guildId, channels });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

apiApp.get('/api/roles/:guildId', (req, res) => {
    const { guildId } = req.params;
    if (!validateSnowflake(guildId)) return res.status(400).json({ error: 'Invalid guild ID' });
    try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return res.status(404).json({ error: 'Guild not found' });
        const roles = guild.roles.cache
            .filter(r => r.id !== guild.id) // exclude @everyone
            .sort((a, b) => b.position - a.position)
            .map(r => ({
                id: r.id,
                name: r.name,
                color: r.hexColor,
                position: r.position,
                managed: r.managed,
            }));
        res.json({ success: true, guildId, roles });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

apiApp.get('/api/commands/:guildId', (req, res) => {
    const { guildId } = req.params;
    try {
        const allCmds = [];
        for (const [name, cmd] of client.commands) {
            const settings = getServerCommandSettings(guildId, name);
            allCmds.push({
                name, category: cmd.category || 'GENERAL', description: cmd.description || '',
                aliases: cmd.aliases || [], hasSlash: !!cmd.data,
                enabled: settings.enabled === 1, cooldown: settings.cooldown_seconds
            });
        }
        res.json({ success: true, commands: allCmds });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── TICKETS ───────────────────────────────────────────
apiApp.get('/api/tickets/:guildId?', (req, res) => {
    res.json({ success: true, tickets: [], message: 'Ticket API placeholder' });
});

// ─── INTEGRATIONS ──────────────────────────────────────
apiApp.get('/api/integrations', (req, res) => {
    let marketState = null;
    try { if (typeof getMarketState === 'function') marketState = getMarketState(null); } catch (e) {}
    
    res.json({
        success: true,
        discord: { connected: true, user: client.user?.tag, servers: client.guilds.cache.size },
        telegram: { connected: client.telegramBridge?.enabled || false },
        lydia: { connected: Object.keys(client.lydiaAgents || {}).length > 0 },
        market: { connected: typeof getMarketState === 'function', currentTrend: marketState }
    });
});

// ✅ Gestionnaire d'erreurs global — le bot ne crash pas si l'API plante
apiApp.use((err, req, res, next) => {
    console.error(`[API ERROR] ${req.method} ${req.path}:`, err.stack || err.message);
    res.status(500).json({ 
        error: 'Internal Bridge Failure',
        timestamp: Date.now(),
        path: req.path
    });
});

// ================= PM2 READY SIGNAL =================
if (process.send) {
    process.send('ready');
    console.log(`\x1b[32m[PM2]\x1b[0m Ready signal sent to PM2`);
}

// ================= INSTANT PM2 SPLASH =================
displayPM2Banner(0);

// ================= LOGIN =================
if (!process.env.DISCORD_TOKEN) {
    console.error('\x1b[31m[FATAL]\x1b[0m No Discord token provided! Check your .env file.');
    process.exit(1);
}

// ============================================================
// 📊 LIVE STATS SYNC ============================================================
// Only sync if explicitly configured (avoids unnecessary network calls on Bot-Hosting.net)
if (process.env.STATS_SYNC_URL) {
    const STATS_SYNC_URL = process.env.STATS_SYNC_URL;
    const STATS_SYNC_SECRET = process.env.JWT_SECRET;

    let syncCount = 0;
    let lastLogTime = Date.now();

    async function pushLiveStats() {
        try {
            const https = require('https');
            const stats = JSON.stringify({
                servers: global.client.guilds.cache.size.toLocaleString(),
                users: global.client.guilds.cache.reduce((total, guild) => total + guild.memberCount, 0).toLocaleString(),
                ping: Math.round(global.client.ws.ping),
                secret: STATS_SYNC_SECRET
            });

            const url = new URL(STATS_SYNC_URL);
            const options = {
                hostname: url.hostname,
                port: 443,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(stats)
                }
            };

            const req = https.request(options, (res) => {
                syncCount++;
            });

            req.on('error', (err) => {
                const now = Date.now();
                if (now - lastLogTime >= 60000) {
                    console.error(`\x1b[31m[STATS SYNC ERROR]\x1b[0m ${err.message}`);
                    lastLogTime = now;
                }
            });

            req.write(stats);
            req.end();
        } catch (err) {}
    }

    pushLiveStats();
    setInterval(pushLiveStats, 30 * 1000);
    console.log('\x1b[36m[STATS SYNC]\x1b[0m Live stats sync active');
} else {
    console.log('\x1b[33m[STATS SYNC]\x1b[0m Skipped — add STATS_SYNC_URL to .env to enable');
}

// ============================================================
// 🔄 KEEP-ALIVE — Only active if KEEPALIVE_URL is set (prevents unnecessary pings on Bot-Hosting.net)
// ============================================================
if (process.env.KEEPALIVE_URL) {
    const KEEPALIVE_URL = process.env.KEEPALIVE_URL;
    const KEEPALIVE_INTERVAL = 14 * 60 * 1000; // 14 minutes

    setInterval(() => {
        const https = require('https');
        https.get(KEEPALIVE_URL, (res) => {}).on('error', () => {});
    }, KEEPALIVE_INTERVAL);

    console.log('\x1b[36m[KEEPALIVE]\x1b[0m Ping scheduled every 14 minutes');
} else {
    console.log('\x1b[33m[KEEPALIVE]\x1b[0m Skipped — add KEEPALIVE_URL to .env to enable');
}

// ================= LANCEMENT DU SERVEUR API =================
apiApp.listen(5000, '0.0.0.0', () => {
    console.log('\x1b[32m[API]\x1b[0m Bridge active on port 5000 (0.0.0.0)');
});

// ================= BOT PROFILE & STATUS =================
const STATUS_MESSAGES = [
    // PLAYING
    { name: '🦅 Architecting servers...', type: 0 },
    { name: 'with Lydia AI 🧠', type: 0 },
    { name: '⚡ {guilds} servers in the grid', type: 0 },
    { name: 'defense protocols 🛡️', type: 0 },
    { name: 'the economy engine 💰', type: 0 },
    { name: 'Neural Grid v3.0.7 🔮', type: 0 },
    { name: '111 plugins loaded ⚡', type: 0 },
    // WATCHING
    { name: 'over {guilds} servers 🌐', type: 3 },
    { name: '{users} agents in the field', type: 3 },
    { name: '📊 live market data', type: 3 },
    { name: 'tickets resolve 🎫', type: 3 },
    { name: 'daily streaks burn 🔥', type: 3 },
    { name: 'BAMAKO_223 // ONLINE 🇲🇱', type: 3 },
    // LISTENING
    { name: 'slash commands /', type: 2 },
    { name: '{users} agents', type: 2 },
    { name: 'the neural feed 🧠', type: 2 },
    { name: 'Cloud Gaming-223 🎮', type: 2 },
    // COMPETING
    { name: 'top.gg rankings 🏆', type: 5 },
    { name: 'Best Bot — Mali 🇲🇱', type: 5 },
    { name: 'Neural Grid Challenge', type: 5 },
];

let statusIndex = 0;

// Rotate status every 30 minutes
function rotateStatus() {
    // If music is playing in any guild, show music status
    const musicPlugin = client.commands?.get('music');
    if (musicPlugin?.getQueue) {
        const activeQueues = [...client.guilds.cache.keys()].filter(id => musicPlugin.getQueue(id));
        if (activeQueues.length > 0) {
            const q = musicPlugin.getQueue(activeQueues[0]);
            const trackName = q?.currentTrack?.title?.substring(0, 40) || 'music';
            client.user.setActivity(trackName, { type: 2 }); // Listening to <track>
            return;
        }
    }
    // No music playing — continue normal rotation
    if (!client.user) return;
    const msg = STATUS_MESSAGES[statusIndex];
    let name = msg.name;
    // Replace dynamic placeholders
    if (name.includes('{guilds}')) name = name.replace('{guilds}', client.guilds.cache.size.toLocaleString());
    if (name.includes('{users}')) name = name.replace('{users}', client.guilds.cache.reduce((t, g) => t + g.memberCount, 0).toLocaleString());
    client.user.setActivity(name, { type: msg.type });
    statusIndex = (statusIndex + 1) % STATUS_MESSAGES.length;
}

// Set About Me (bot profile description) — runs once on ready
client.once('clientReady', async () => {
    try {
        await client.user.setAboutMe(
            `╔════════════════════════════════════════╗\n` +
            `║         🦅 A R C H O N  C G - 2 2 3    ║\n` +
            `║                                        ║\n` +
            `║   The AI-Powered Server Architect      ║\n` +
            `╚════════════════════════════════════════╝\n\n` +
            `Your server. Your rules. Fully isolated.\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `🧠 Lydia AI          28 languages\n` +
            `💰 Economy & Leveling  Canvas cards\n` +
            `🎫 Tickets            3-cat system\n` +
            `🛡️ AutoMod            Native timeouts\n` +
            `📊 Market             Live trading\n` +
            `📢 Smart Broadcast    Not spammy\n` +
            `⚡ Daily Rewards      Streak system\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `🌐  https://bamako-steel-dev.xyz\n` +
            `💬  https://discord.gg/NFSMFJajp9\n\n` +
            `Built with 🔥 by MFOF7310 · Bamako, Mali 🇲🇱`
        );
        console.log(`${green}[PROFILE]${reset} About Me set successfully`);
    } catch (e) {
        // setAboutMe not supported for bots — skipping silently
    }

    // Start status rotation
    rotateStatus();
    setInterval(rotateStatus, 30 * 60 * 1000); // Every 30 minutes
    console.log(`${green}[STATUS]${reset} Rotating status active (${STATUS_MESSAGES.length} messages, 30min interval)`);
});

// ── Discord Login ──
client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error('\x1b[31m[LOGIN ERROR]\x1b[0m Failed to connect to Discord:', err.message);
    console.error('\x1b[33m[TIP]\x1b[0m Check your internet connection and token validity.');
});
