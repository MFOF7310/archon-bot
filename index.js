require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, Events, Partials, GatewayIntentBits, EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes, MessageFlags } = require('discord.js');

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
\x1b[36m║\x1b[0m  \x1b[1;33mARCHITECT CG-223\x1b[0m | \x1b[1;32mPER-SERVER PARTITIONING ENGINE\x1b[0m                   \x1b[36m║
\x1b[36m╠══════════════════════════════════════════════════════════════════╣
\x1b[36m║\x1b[0m  \x1b[32mNODE:\x1b[0m BAMAKO_223 🇲🇱  \x1b[33mSERVERS:\x1b[0m ${String(serverCount).padEnd(6)}     \x1b[35mBY:\x1b[0m MOUSSA FOFANA    \x1b[36m║
\x1b[36m║\x1b[0m  \x1b[32mVERSION:\x1b[0m v${version.padEnd(8)}        \x1b[35mPM2 ID:\x1b[0m ${(process.env.pm_id || '0').padEnd(8)}        \x1b[36m║
\x1b[36m║\x1b[0m  \x1b[32mSTATUS:\x1b[0m \x1b[5;32m ONLINE\x1b[0m   \x1b[33mMEMORY:\x1b[0m ${memory.padEnd(5)} MB                \x1b[36m║
\x1b[36m╠══════════════════════════════════════════════════════════════════╣
\x1b[36m║\x1b[0m  \x1b[1;34mTELEGRAM:\x1b[0m Bridge \x1b[32mACTIVE\x1b[0m      \x1b[1;34mLYDIA AI:\x1b[0m \x1b[32mCONNECTED\x1b[0m               \x1b[36m║
\x1b[36m║\x1b[0m  \x1b[1;34mDATABASE:\x1b[0m WAL+Partitioned   \x1b[1;34mCIRCUIT:\x1b[0m \x1b[32mREADY\x1b[0m                   \x1b[36m║
\x1b[36m╚══════════════════════════════════════════════════════════════════╝\x1b[0m
`;

    if (isPM2) {
        console.log(banner);
    } else {
        console.log(`\x1b[32m[SYSTEM]\x1b[0m Running Architect-CG223 locally...`);
    }
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
client.lydiaChannels = {};
client.lydiaAgents = {};
client.lastLydiaCall = {};
client.userIntroductions = new Map();

const PREFIX = process.env.PREFIX || ".";

// ================= UTILITIES =================
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const formatNumber = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// ================= SAFE UNIVERSAL LANGUAGE DETECTION =================
function detectLanguage(usedCommand) {
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

client.detectLanguage = detectLanguage;
client.calculateLevel = calculateLevel;
client.formatNumber = formatNumber;

console.log(`${green}[LANGUAGE]${reset} Universal pattern-based detection initialized`);

// --- SQLITE DATABASE ---
const Database = require('better-sqlite3');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

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
        channel_id TEXT, guild_id TEXT, user_id TEXT, user_name TEXT, 
        role TEXT, content TEXT, timestamp INTEGER DEFAULT (strftime('%s', 'now'))
    )`,
    
    reminders: `CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY, 
    user_id TEXT NOT NULL, 
    channel_id TEXT NOT NULL, 
    message TEXT NOT NULL, 
    execute_at INTEGER NOT NULL, 
    status TEXT DEFAULT 'pending',
    delivered INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
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

function ensureTableColumns(db, tableName, expectedColumns) {
    try {
        // Get existing columns
        const existing = db.prepare(`PRAGMA table_info(${tableName})`).all().map(c => c.name);
        let added = 0;
        
        for (const col of expectedColumns) {
            if (!existing.includes(col.name)) {
                const defaultClause = col.default !== undefined ? ` DEFAULT ${col.default}` : '';
                const alterSQL = `ALTER TABLE ${tableName} ADD COLUMN ${col.name} ${col.type}${defaultClause}`;
                db.exec(alterSQL);
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
            autoModLogChannel: settings.automod_log_channel,
            
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
            
            autoModWhitelist: settings.automod_whitelist,
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

// Helper function
function parseJSONSafe(str, fallback) {
    try {
        return str ? JSON.parse(str) : fallback;
    } catch (e) {
        return fallback;
    }
}

function updateServerSetting(guildId, setting, value) {
    if (setting === 'xpboost') {
        const num = parseFloat(value);
        if (isNaN(num) || num < 0.1 || num > 10.0) {
            value = '1.0';
        }
    }
    
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
        ticketcategory: 'ticket_category',
        ticketstaffrole: 'ticket_staff_role',
        tickettranscriptchannel: 'ticket_transcript_channel',
        ticketpanelchannel: 'ticket_panel_channel',
        ticketlogchannel: 'ticket_log_channel',
        ticketautoclose: 'ticket_auto_close_hours',
        ticketcategories: 'ticket_categories_config',
        ticketlimit: 'ticket_limit_per_user',
    };
    
    const column = columnMap[setting];
    if (!column) return false;
    
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
        const existing = db.prepare(
            'SELECT * FROM server_command_settings WHERE guild_id = ? AND command_name = ?'
        ).get(guildId, commandName);
        
        if (!existing) {
            db.prepare(
                'INSERT INTO server_command_settings (guild_id, command_name, enabled) VALUES (?, ?, 1)'
            ).run(guildId, commandName);
        }
        
        db.prepare(
            `UPDATE server_command_settings SET ${setting} = ? WHERE guild_id = ? AND command_name = ?`
        ).run(value, guildId, commandName);
        
        return true;
    } catch (err) {
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

// Queue a user update for batch writing, keyed by ${userId}:${guildId}
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
    
    const mergedData = {
        ...fullUserData,
        ...updateData,
        _queuedAt: Date.now(),
        _lastAccess: Date.now()
    };
    
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


// ================= PLUGIN LOADER - NEURAL GRID EDITION v2.0 =================
client.loadPlugins = async () => {
    client.commands.clear();
    client.aliases.clear();
    
    const pluginPath = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginPath)) fs.mkdirSync(pluginPath);

    const pluginFiles = fs.readdirSync(pluginPath).filter(file => file.endsWith('.js') && file !== 'lydia.js' && file !== 'market-manager.js');
    
    console.log(`\n${cyan}${bold}╔══════════════════════════════════════════════════════════════════╗${reset}`);
    console.log(`${cyan}${bold}║${reset}  ${yellow} ARCHITECT CG-223 NEURAL SYNAPSE // MODULE SYNCHRONIZATION${reset}  ${cyan}${bold}║${reset}`);
    console.log(`${cyan}${bold}╠══════════════════════════════════════════════════════════════════╣${reset}`);
    console.log(`${cyan}${bold}║${reset}  ${green} Establishing neural links to command modules...${reset}          ${cyan}${bold}║${reset}`);
    console.log(`${cyan}${bold}╠══════════════════════════════════════════════════════════════════╣${reset}`);
    
    const loadedCommands = [];
    const failedCommands = [];
    
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
                    emoji: getCategoryEmoji(category),
                    source: 'DISCORD'
                });
            }
        } catch (error) { 
            failedCommands.push({ file, error: error.message, source: 'DISCORD' });
        }
    }
    
    const telegramPath = path.join(__dirname, 'telegram');
    if (fs.existsSync(telegramPath)) {
        const telegramFiles = fs.readdirSync(telegramPath).filter(file => file.endsWith('.js') && file !== 'bridge.js' && file !== 'bot.js');
        
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
                        emoji: getCategoryEmoji(category),
                        source: 'TELEGRAM'
                    });
                }
            } catch (error) { 
                failedCommands.push({ file: `telegram/${file}`, error: error.message, source: 'TELEGRAM' });
            }
        }
    }
    
    loadedCommands.sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.name.localeCompare(b.name);
    });
    
    const categories = [...new Set(loadedCommands.map(c => c.category))].sort();
    
    for (const category of categories) {
        const categoryCommands = loadedCommands.filter(c => c.category === category);
        const discordCmds = categoryCommands.filter(c => c.source === 'DISCORD');
        const telegramCmds = categoryCommands.filter(c => c.source === 'TELEGRAM');
        
        const catEmoji = getCategoryEmoji(category);
        const totalCmds = categoryCommands.length;
        const aliasCount = categoryCommands.reduce((sum, c) => sum + c.aliases, 0);
        
        console.log(`${cyan}${bold}╠══════════════════════════════════════════════════════════════════╣${reset}`);
        console.log(`${cyan}${bold}║${reset}  ${catEmoji} ${yellow}${category.padEnd(12)}${reset} ${green}${String(totalCmds).padStart(2)} commands${reset} ${blue}${String(aliasCount).padStart(2)} aliases${reset}                        ${cyan}${bold}║${reset}`);
        console.log(`${cyan}${bold}╠══════════════════════════════════════════════════════════════════╣${reset}`);
        
        if (discordCmds.length > 0) {
            const itemsPerRow = 3;
            for (let i = 0; i < discordCmds.length; i += itemsPerRow) {
                const row = discordCmds.slice(i, i + itemsPerRow);
                let rowText = `${cyan}${bold}║${reset}  ${magenta} 💬${reset} `;
                
                row.forEach(cmd => {
                    const displayName = cmd.name.length > 11 ? cmd.name.substring(0, 9) + '..' : cmd.name.padEnd(11);
                    const aliasInfo = cmd.aliases > 0 ? `${cmd.aliases}` : ' ';
                    rowText += `${green}${displayName}${reset}${yellow}[${aliasInfo}]${reset} `.padEnd(23);
                });
                
                const emptySlots = itemsPerRow - row.length;
                if (emptySlots > 0) rowText += ' '.repeat(emptySlots * 23);
                
                console.log(`${rowText}${cyan}${bold}║${reset}`);
            }
        }
        
        if (telegramCmds.length > 0) {
            const itemsPerRow = 3;
            for (let i = 0; i < telegramCmds.length; i += itemsPerRow) {
                const row = telegramCmds.slice(i, i + itemsPerRow);
                let rowText = `${cyan}${bold}║${reset}  ${blue} 🌉${reset} `;
                
                row.forEach(cmd => {
                    const displayName = cmd.name.length > 11 ? cmd.name.substring(0, 9) + '..' : cmd.name.padEnd(11);
                    const aliasInfo = cmd.aliases > 0 ? `${cmd.aliases}` : ' ';
                    rowText += `${cyan}${displayName}${reset}${yellow}[${aliasInfo}]${reset} `.padEnd(23);
                });
                
                const emptySlots = itemsPerRow - row.length;
                if (emptySlots > 0) rowText += ' '.repeat(emptySlots * 23);
                
                console.log(`${rowText}${cyan}${bold}║${reset}`);
            }
        }
    }
    
    console.log(`${cyan}${bold}╠══════════════════════════════════════════════════════════════════╣${reset}`);
    
    const totalDiscord = loadedCommands.filter(c => c.source === 'DISCORD').length;
    const totalTelegram = loadedCommands.filter(c => c.source === 'TELEGRAM').length;
    const totalAliases = client.aliases.size;
    
    console.log(`${cyan}${bold}║${reset}  ${green}  DISCORD:${reset} ${totalDiscord}  ${blue} 🌉 TELEGRAM:${reset} ${totalTelegram}  ${yellow}  ALIASES:${reset} ${totalAliases}  ${magenta}  CATS:${reset} ${categories.length}  ${green}  SRVS:${reset} ${client.guilds.cache.size}  ${cyan}${bold}║${reset}`);
    
    if (failedCommands.length > 0) {
        console.log(`${cyan}${bold}╠══════════════════════════════════════════════════════════════════╣${reset}`);
        failedCommands.forEach(f => {
            const sourceTag = f.source === 'TELEGRAM' ? `${blue} 🌉` : `${magenta} 💬`;
            console.log(`${cyan}${bold}║${reset}  ${red} ❌ ${sourceTag} ${f.file}${reset} ${yellow}→${reset} ${f.error.substring(0, 35).padEnd(35)} ${cyan}${bold}║${reset}`);
        });
    }
    
    console.log(`${cyan}${bold}╚══════════════════════════════════════════════════════════════════╝${reset}\n`);
};

// ================= SMART PLUGIN EXECUTION WRAPPER =================
async function executePluginCommand(command, client, message, args, db, usedCommand, serverSettings, lang = 'en') {
    const runFunc = command.run;
    const funcStr = runFunc.toString();
    const params = funcStr.slice(funcStr.indexOf('(') + 1, funcStr.indexOf(')')).split(',').map(p => p.trim());
    
    const argsMap = { client, message, args, db, usedCommand, serverSettings, lang };
    const filteredArgs = params.map(param => argsMap[param]).filter(arg => arg !== undefined);
    
    return await runFunc(...filteredArgs);
}

// ================= BOOT SEQUENCE =================
client.once(Events.ClientReady, async () => {
    const isPM2 = process.env.pm_id !== undefined || process.env.name === 'Architect-CG223';
    
    if (!isPM2) {
        console.clear();
    }

    displayPM2Banner();

    await client.loadPlugins();

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
        let md = `# ARCHITECT CG-223 // SYSTEM REGISTRY v4.0\n\n`;
        
        md += `> **Report Generated:** ${dateStr} at ${timeStr} (Bamako Time, GMT+0)\n`;
        md += `> **Build Version:** v${botVersion} | **Node:** BAMAKO_223 🇲🇱\n`;
        md += `> **Architect:** Moussa Fofana | **License:** Proprietary\n`;
        md += `> **Architecture:** Per-Server Partitioning (Composite PK: id, guild_id)\n\n`;
        
        md += `---\n\n`;
        
        // ================= EXECUTIVE SUMMARY =================
        md += `## 1. EXECUTIVE SUMMARY\n\n`;
        md += `The ARCHITECT CG-223 neural grid operates on a **per-server partitioning architecture**, `;
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
        md += `| DISCORD_TOKEN | ${process.env.DISCORD_TOKEN ? '  CONFIGURED' : '  MISSING'} |\n`;
        md += `| CLIENT_ID | ${process.env.CLIENT_ID ? '  CONFIGURED' : '  MISSING'} |\n`;
        md += `| OWNER_ID | ${process.env.OWNER_ID ? '  CONFIGURED' : '  MISSING'} |\n`;
        md += `| WELCOME_CHANNEL_ID | ${process.env.WELCOME_CHANNEL_ID ? '  CONFIGURED' : '  OPTIONAL'} |\n`;
        md += `| OPENROUTER_API_KEY | ${process.env.OPENROUTER_API_KEY ? '  CONFIGURED' : '  OPTIONAL'} |\n`;
        md += `| BRAVE_API_KEY | ${process.env.BRAVE_API_KEY ? '  CONFIGURED' : '  OPTIONAL'} |\n`;
        md += `| TELEGRAM_BOT_TOKEN | ${process.env.TELEGRAM_BOT_TOKEN ? '  CONFIGURED' : '  OPTIONAL'} |\n\n`;

        // ================= FOOTER =================
        md += `## 7. ARCHITECT'S NOTES\n\n`;
        md += `This registry is **auto-generated** on every system restart and reflects the exact state `;
        md += `of the ARCHITECT CG-223 neural grid at boot time. All metrics are captured in real-time `;
        md += `from the BAMAKO_223 node.\n\n`;
        md += `**v4.0 Changelog Engine Changes:**\n`;
        md += `- Per-server partitioning statistics now report both total partitions and unique users\n`;
        md += `- Architecture change detection monitors schema version transitions\n`;
        md += `- Database stats distinguish between global-scoped and per-server-scoped tables\n`;
        md += `- Composite key metrics provide visibility into data distribution across guilds\n\n`;
        md += `> *"The grid adapts. The grid isolates. The grid prevails."*\n\n`;
        md += `---\n\n`;
        md += `**Built by Moussa Fofana** | **Bamako, Mali 🇲🇱**\n`;
        md += `**Repository:** [github.com/MFOF7310](https://github.com/MFOF7310)\n`;
        md += `**Last System Boot:** ${dateStr} | **Report ID:** ${timestamp}\n`;
        md += `*ARCHITECT CG-223 Neural Changelog Engine v4.0 — 100% Automated*\n`;
        
        fs.writeFileSync(path.join(dataDir, 'changelog.md'), md);
        
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
    setTimeout(async () => {
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
                await rest.put(
                    Routes.applicationCommands(clientId),
                    { body: commands },
                );
                console.log = originalLog;
                console.log(`${green}[SLASH]${reset} Successfully registered ${commands.length} slash commands.`);
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

    // ================= DM REMINDER HEARTBEAT v4.0 (ANTI-SPAM + PER-USER SAFETY) =================
    // Logic:
    //   1. User claims daily → last_daily = now
    //   2. 24h later (cooldown expires) → daily becomes available
    //   3. If NOT claimed within 6h of becoming available → send DM reminder
    //   4. Then remind every 6h max (not more than 4 reminders per 24h window)
    //   5. One failed DM per user NEVER crashes the entire heartbeat cycle
    //
    // Anti-spam guards:
    //   - 6-hour minimum gap between reminders (last_reminder < now - 21600)
    //   - 15-user batch limit per tick (45s interval = max ~960 users/hour)
    //   - 1.5s staggered delay between sends to avoid rate limits
    //   - Per-user try/catch: one blocked DM skips to next user instantly

    setInterval(async () => {
        const now = Math.floor(Date.now() / 1000);
        const sixHoursAgo = now - (6 * 3600);   // 6-hour anti-spam window
        const reminderCutoff = now - 86400;      // Must have claimed within last 48h to qualify

        // STRICT QUERY: Only remind users who:
        //   (a) Have claimed at least once (last_daily > 0)
        //   (b) Cooldown has expired (last_daily + 86400 <= now)
        //   (c) Not reminded in the last 6 hours (last_reminder IS NULL OR < sixHoursAgo)
        //   (d) Claimed recently enough to care (last_daily > reminderCutoff)
        //   (e) Ordered by oldest daily first (most likely to forget)
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

            // === PER-USER SAFETY NET: one user failure never kills the cycle ===
            try {
                const discordUser = await client.users.fetch(user.id).catch(() => null);
                if (!discordUser) {
                    // Ghost user — mark reminded so we don't retry indefinitely
                    db.prepare('UPDATE users SET last_reminder = ? WHERE id = ? AND guild_id = ?')
                      .run(now, user.id, user.guild_id);
                    continue;
                }

                // Resolve guild context for per-server settings
                const guild = user.guild_id ? client.guilds.cache.get(user.guild_id) : null;
                const settings = guild ? client.getServerSettings(user.guild_id) : null;
                const prefix = settings?.prefix || '.';
                const guildName = guild?.name || 'Neural Network';
                const guildIcon = guild?.iconURL({ size: 128 }) || client.user.displayAvatarURL();

                // Market state (per-server)
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

                // Reward calculation
                const baseReward = 200;
                const streakDays = user.streak_days || 0;
                const streakBonus = Math.min(streakDays * 10, 500);
                const levelBonus = Math.floor((user.level || 1) * 5);
                const estimatedReward = Math.floor((baseReward + streakBonus + levelBonus) * marketMultiplier);

                // Streak tier styling
                let streakStatus, streakEmoji, streakColor;
                if (streakDays >= 365)       { streakStatus = '  LEGENDARY'; streakEmoji = '👑'; streakColor = '#ffd700'; }
                else if (streakDays >= 100)  { streakStatus = '  MYTHIC';    streakEmoji = '💎'; streakColor = '#e91e63'; }
                else if (streakDays >= 30)   { streakStatus = '  ELITE';     streakEmoji = '🛡️'; streakColor = '#9b59b6'; }
                else if (streakDays >= 7)    { streakStatus = '  VETERAN';   streakEmoji = '⚔️'; streakColor = '#3498db'; }
                else if (streakDays >= 3)    { streakStatus = '  ACTIVE';    streakEmoji = '🔥'; streakColor = '#2ecc71'; }
                else                         { streakStatus = '  INITIATE';  streakEmoji = '🌱'; streakColor = '#95a5a6'; }

                // Time-based greeting
                const bamakoHour = new Date().getUTCHours();
                let greeting, greetingEmoji;
                if (bamakoHour < 6)       { greeting = 'Good Night';   greetingEmoji = '🌙'; }
                else if (bamakoHour < 12) { greeting = 'Good Morning'; greetingEmoji = '🌅'; }
                else if (bamakoHour < 17) { greeting = 'Good Afternoon'; greetingEmoji = '☀️'; }
                else if (bamakoHour < 20) { greeting = 'Good Evening';  greetingEmoji = '🌆'; }
                else                      { greeting = 'Good Night';     greetingEmoji = '🌙'; }

                // How long has the daily been available?
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
                    .setAuthor({
                        name: `  ARCHITECT CG-223 • DAILY INJECTION READY`,
                        iconURL: client.user.displayAvatarURL(),
                        url: 'https://discord.com'
                    })
                    .setTitle(`${greetingEmoji} ${greeting}, ${discordUser.username}!`)
                    .setDescription(
                        `Your neural receptors have been replenished and are ready for a new injection.\n\n` +
                        `> *Claim your daily rewards before the next reset cycle begins.*`
                    )
                    .addFields(
                        {
                            name: '💰 **ESTIMATED REWARD**',
                            value: [
                                `\`\`\``,
                                `Base Reward:    ${baseReward} 🪙`,
                                `Streak Bonus:   +${streakBonus} 🪙`,
                                `Level Bonus:    +${levelBonus} 🪙`,
                                `Market (${trendEmoji}):  x${marketMultiplier.toFixed(2)}`,
                                `━━━━━━━━━━━━━━━━━━━━`,
                                `TOTAL:          ${estimatedReward} 🪙`,
                                `\`\`\``
                            ].join('\n'),
                            inline: false
                        },
                        {
                            name: `${streakEmoji} **STREAK: ${streakStatus}**`,
                            value: [
                                `📊 **Current Streak:** ${streakDays} day${streakDays !== 1 ? 's' : ''}`,
                                `🏆 **Best Streak:** ${user.highest_streak || 0} days`,
                                `🛡️ **Protections:** ${user.streak_protections || 0}`,
                                `📅 **Total Claims:** ${user.total_dailies || 0}`
                            ].join('\n'),
                            inline: true
                        },
                        {
                            name: '🎯 **YOUR PROFILE**',
                            value: [
                                `⭐ **Level:** ${user.level || 1}`,
                                `💰 **Balance:** ${(user.credits || 0).toLocaleString()} 🪙`,
                                `💬 **Messages:** ${(user.total_messages || 0).toLocaleString()}`
                            ].join('\n'),
                            inline: true
                        },
                        {
                            name: '⏰ **STATUS**',
                            value: [
                                availabilityStatus,
                                `\n📌 **Claim Command:**`,
                                `\`${prefix}daily\``
                            ].join('\n'),
                            inline: false
                        },
                        {
                            name: '🏛️ **WHERE TO CLAIM**',
                            value: guild
                                ? `**${guildName}**\nUse \`${prefix}daily\` in any channel!`
                                : `Use \`${prefix}daily\` in any server!`,
                            inline: false
                        },
                        {
                            name: '💡 **STREAK MASTERY TIPS**',
                            value: [
                                `🛡️ **Shield:** \`${prefix}shop\` → Buy Streak Shield (2,000 🪙)`,
                                `🔥 **7 Days:** Unlock +50% bonus credits`,
                                `🛡️ **30 Days:** Exclusive Elite role`,
                                `💎 **100 Days:** Premium rewards tier`,
                                `👑 **365 Days:** Legendary status + custom role`
                            ].join('\n'),
                            inline: false
                        }
                    )
                    .setThumbnail(discordUser.displayAvatarURL({ dynamic: true, size: 256 }))
                    .setFooter({
                        text: `ARCHITECT CG-223 • Node: BAMAKO_223 🇲🇱 • ${guildName}`,
                        iconURL: guildIcon
                    })
                    .setTimestamp();

                const actionRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setLabel(`Claim in ${guildName.substring(0, 20)}`)
                            .setStyle(ButtonStyle.Link)
                            .setURL(guild
                                ? `https://discord.com/channels/${guild.id}/${settings?.dailyChannel || guild.systemChannelId || guild.id}`
                                : 'https://discord.com')
                            .setEmoji('🏛️'),
                        new ButtonBuilder()
                            .setCustomId(`dm_streak_info_${user.id}`)
                            .setLabel('Streak Rewards')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('🔥'),
                        new ButtonBuilder()
                            .setCustomId(`dm_shop_${user.id}`)
                            .setLabel('Buy Shield')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('🛡️')
                    );

                // === ATTEMPT DM SEND (with isolated error handling) ===
                let dmSent = false;
                try {
                    await discordUser.send({ embeds: [supremeEmbed], components: [actionRow] });
                    dmSent = true;
                    sent++;
                    db.prepare('UPDATE users SET last_reminder = ? WHERE id = ? AND guild_id = ?')
                      .run(now, user.id, user.guild_id);
                    console.log(`${green}[DM REMINDER]${reset}   ${discordUser.username} @ ${guildName} • Streak: ${streakDays}d • +${estimatedReward} 🪙`);
                } catch (dmErr) {
                    blocked++;
                    console.log(`${yellow}[DM BLOCKED]${reset} ${discordUser.username} — DMs disabled`);

                    // === FALLBACK: post in server's daily/general channel ===
                    try {
                        const fallbackChannelId = settings?.dailyChannel || settings?.generalChannel || settings?.welcomeChannel;
                        if (fallbackChannelId && guild) {
                            const fallbackChannel = await client.channels.fetch(fallbackChannelId).catch(() => null);
                            if (fallbackChannel) {
                                const fallbackEmbed = new EmbedBuilder()
                                    .setColor('#f39c12')
                                    .setAuthor({ name: '🔔 DAILY REWARD AVAILABLE', iconURL: client.user.displayAvatarURL() })
                                    .setDescription(
                                        `<@${user.id}>, your daily injection is ready!\n\n` +
                                        `> 💰 **Estimated Reward:** ${estimatedReward} 🪙\n` +
                                        `> 🔥 **Streak:** ${streakDays} day${streakDays !== 1 ? 's' : ''}\n` +
                                        `> 📊 **Market:** ${trendEmoji} ${marketTrend}\n\n` +
                                        `📌 Use \`${prefix}daily\` to claim!\n\n` +
                                        `⚠️ *Enable Direct Messages to receive premium reminders with detailed stats & quick-action buttons!*`
                                    )
                                    .setThumbnail(discordUser.displayAvatarURL({ dynamic: true, size: 128 }))
                                    .setFooter({ text: `${guildName} • Enable DMs for better experience` });

                                await fallbackChannel.send({ content: `<@${user.id}>`, embeds: [fallbackEmbed] });
                                fallback++;
                                db.prepare('UPDATE users SET last_reminder = ? WHERE id = ? AND guild_id = ?')
                                  .run(now, user.id, user.guild_id);
                                console.log(`${green}[FALLBACK]${reset}   Posted in #${fallbackChannel.name} for ${discordUser.username}`);
                            }
                        }
                    } catch (fallbackErr) {
                        // Even fallback failed — still mark as reminded to prevent retry loops
                        db.prepare('UPDATE users SET last_reminder = ? WHERE id = ? AND guild_id = ?')
                          .run(now, user.id, user.guild_id);
                    }
                }

                // Rate-limit friendly stagger (1.5s between users)
                await new Promise(r => setTimeout(r, 1500));

            } catch (userErr) {
                // === PER-USER SAFETY NET ===
                // One user's data error / network hiccup NEVER crashes the heartbeat
                errored++;
                console.error(`${red}[DM REMINDER]${reset} Skipped user ${user.id} @ ${user.guild_id}: ${userErr.message}`);
                try {
                    db.prepare('UPDATE users SET last_reminder = ? WHERE id = ? AND guild_id = ?')
                      .run(now, user.id, user.guild_id);
                } catch (dbErr) {
                    // Absolute last-resort: if even the DB update fails, log and move on
                    console.error(`${red}[DM REMINDER]${reset} DB mark-failed for ${user.id}: ${dbErr.message}`);
                }
            }
        }

        // Tick summary
        console.log(
            `${cyan}[DM HEARTBEAT]${reset} Tick complete: ` +
            `${processed} checked • ${green}${sent} DM sent${reset} • ` +
            `${yellow}${blocked} blocked${reset} • ${green}${fallback} fallback${reset} • ` +
            `${errored > 0 ? red : ''}${errored} errors${reset}`
        );

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
                            .setFooter({ text: 'ARCHITECT CG-223 • Market Intelligence' })
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
                .setAuthor({ name: '  ARCHITECT CG-223 // NEURAL ENGINE ONLINE', iconURL: client.user.displayAvatarURL() })
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
                    { name: '🔗 Repository', value: '```ansi\n\u001b[1;36mgithub.com/MFOF7310\u001b[0m\n```', inline: true },
                    { name: '🏗️ Architect', value: '```ansi\n\u001b[1;33mMoussa Fofana\u001b[0m\n```', inline: true },
                    { name: '⚡ Slash Commands', value: `\`\`\`ansi\n\u001b[1;32m${commands.length} commands registered\u001b[0m\n\`\`\``, inline: true },
                    { name: '🕐 Boot Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                )
                .setFooter({ text: `ARCHITECT CG-223 • Neural Engine v${client.version}`, iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            await owner.send({ embeds: [bootEmbed] }).catch(() => {});
            console.log(`${green}[DM]${reset}   Boot DM sent successfully to ${owner.tag}`);
        }
    } catch (err) {
        console.log(`${yellow}[DM]${reset}   Could not send boot DM: ${err.message}`);
    }
});

// ================= MESSAGE PROCESSING (PER-SERVER PARTITIONED) =================
client.on(Events.MessageCreate, async (message) => {
    if (!message || message.author?.bot || message.webhookId) return;

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
    // Get the user's preferred language from the last command they typed
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

    // Determine tier name
    let levelTier, levelTierColor;
    if (newLevel <= 5)      { levelTier = userLang === 'fr' ? 'Initié Neural' : 'Neural Initiate'; levelTierColor = '#95a5a6'; }
    else if (newLevel <= 10) { levelTier = userLang === 'fr' ? 'Chevalier Neural' : 'Neural Knight'; levelTierColor = '#9b59b6'; }
    else if (newLevel <= 20) { levelTier = userLang === 'fr' ? 'Seigneur Synapse' : 'Synapse Lord'; levelTierColor = '#ffd700'; }
    else                     { levelTier = userLang === 'fr' ? 'Architecte Suprême' : 'Supreme Architect'; levelTierColor = '#e74c3c'; }

    // UNIFIED TIER ASCENSION
    if (message.guild) {
        const result = await client.assignRole(
            message.guild,
            message.author.id,
            `Tier: ${levelTier}`,
            levelTierColor,
            client.ROLE_SOURCES.LEVELING,
            `Level ${newLevel} reached`
        );
        if (!result.ok) console.log(`[ROLE] Failed: ${result.why}`);
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
        // No custom message — use tiered default system
        if (newLevel <= 5) {
            if (newLevel === 5 && levelBannerUrl) {
                const embed = new EmbedBuilder()
                    .setColor(levelTierColor)
                    .setAuthor({ name: `🦅 ${levelTier.toUpperCase()}`, iconURL: message.author.displayAvatarURL() })
                    .setTitle(userLang === 'fr' ? `🎉 NIVEAU ${newLevel} ATTEINT !` : `🎉 LEVEL ${newLevel} REACHED!`)
                    .setImage(levelBannerUrl)
                    .setDescription(
                        userLang === 'fr'
                            ? `<@${userId}> a atteint le **Niveau ${newLevel}** !\n\n*Le lien neural se renforce...*`
                            : `<@${userId}> reached **Level ${newLevel}**!\n\n*The neural link strengthens...*`
                    )
                    .addFields(
                        { name: userLang === 'fr' ? '🏛️ Serveur' : '🏛️ Server', value: guildName, inline: true },
                        { name: '📊 XP', value: `${newXP.toLocaleString()}`, inline: true },
                        { name: userLang === 'fr' ? '💎 Titre' : '💎 Title', value: levelTier, inline: true }
                    )
                    .setFooter({ text: `${guildName} • v${client.version || '2.0'}`, iconURL: guildIcon })
                    .setTimestamp();
                await targetChannel.send({ embeds: [embed] });
            } else {
                const messages = {
                    en: [
                        `🎉 **LEVEL UP!** <@${userId}> reached **Level ${newLevel}**! The neural link strengthens...`,
                        `⚡ **ASCENSION!** <@${userId}> is now **Level ${newLevel}**! Keep forging those synapses!`,
                        `🦅 **EAGLE RISING!** <@${userId}> ascended to **Level ${newLevel}** in ${guildName}!`
                    ],
                    fr: [
                        `🎉 **NIVEAU SUPERIEUR !** <@${userId}> a atteint le **Niveau ${newLevel}** ! Le lien neural se renforce...`,
                        `⚡ **ASCENSION !** <@${userId}> est maintenant **Niveau ${newLevel}** ! Continue de forger ces synapses !`,
                        `🦅 **L'AIGLE S'ELEVE !** <@${userId}> a atteint le **Niveau ${newLevel}** dans ${guildName} !`
                    ]
                };
                const msgList = messages[userLang] || messages.en;
                await targetChannel.send({ content: msgList[Math.floor(Math.random() * msgList.length)] });
            }
        } else if (newLevel <= 10) {
            const embed = new EmbedBuilder()
                .setColor(levelTierColor)
                .setAuthor({ name: userLang === 'fr' ? `🌟 ${levelTier.toUpperCase()}` : `🌟 ${levelTier.toUpperCase()}`, iconURL: message.author.displayAvatarURL() })
                .setDescription(
                    userLang === 'fr'
                        ? `<@${userId}> a atteint le **Niveau ${newLevel}** !\n\n*Le reseau neuronal reconnait votre devouement.*`
                        : `<@${userId}> reached **Level ${newLevel}**!\n\n*The neural network acknowledges your dedication.*`
                )
                .addFields(
                    { name: userLang === 'fr' ? '🏛️ Serveur' : '🏛️ Server', value: guildName, inline: true },
                    { name: '📊 XP', value: `${newXP.toLocaleString()}`, inline: true },
                    { name: userLang === 'fr' ? '💎 TITRE' : '💎 TITLE', value: levelTier, inline: true }
                )
                .setFooter({ text: `${guildName} • v${client.version || '2.0'}`, iconURL: guildIcon })
                .setTimestamp();
            if (levelBannerUrl) embed.setImage(levelBannerUrl);
            await targetChannel.send({ embeds: [embed] });
        } else if (newLevel <= 20) {
            const tierNames = {
                en: ['Neural Knight', 'Synapse Lord', 'Digital Sovereign'],
                fr: ['Chevalier Neural', 'Seigneur Synapse', 'Souverain Numerique']
            };
            const tier = tierNames[userLang][Math.floor(Math.random() * tierNames[userLang].length)];
            const embed = new EmbedBuilder()
                .setColor('#ffd700')
                .setAuthor({ name: userLang === 'fr' ? '👑 ASCENSION LEGENDAIRE' : '👑 LEGENDARY ASCENSION', iconURL: message.author.displayAvatarURL() })
                .setTitle(`**${message.author.username}** — ${tier}`)
                .setDescription(
                    `\`\`\`ansi\n` +
                    `\u001b[1;33m${userLang === 'fr' ? `Niveau ${newLevel} atteint dans ${guildName}` : `Level ${newLevel} achieved in ${guildName}`}\u001b[0m\n\n` +
                    `\u001b[1;36m${userLang === 'fr' ? 'Les circuits neuronaux vibrent de votre puissance.' : 'The neural circuits hum with your power.'}\u001b[0m\n` +
                    `\`\`\``
                )
                .addFields(
                    { name: userLang === 'fr' ? '⚡ PUISSANCE' : '⚡ POWER', value: `${newXP.toLocaleString()} XP`, inline: true },
                    { name: userLang === 'fr' ? '🏛️ ROYAUME' : '🏛️ REALM', value: guildName, inline: true },
                    { name: userLang === 'fr' ? '💎 TITRE' : '💎 TITLE', value: tier, inline: true }
                )
                .setFooter({ text: `${guildName} • v${client.version || '2.0'}`, iconURL: guildIcon })
                .setTimestamp();
            if (levelBannerUrl) embed.setImage(levelBannerUrl);
            await targetChannel.send({ embeds: [embed] });
        } else {
            const embed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setAuthor({ name: userLang === 'fr' ? '🌟 ASCENSION MYTHIQUE' : '🌟 MYTHIC ASCENSION', iconURL: message.author.displayAvatarURL() })
                .setTitle(userLang === 'fr' ? `🏆 ${message.author.username} — L'ARCHITECTE SUPREME` : `🏆 ${message.author.username} — THE SUPREME ARCHITECT`)
                .setDescription(
                    `\`\`\`ansi\n` +
                    `\u001b[1;35m${"═".repeat(40)}\u001b[0m\n` +
                    `\u001b[1;33m${userLang === 'fr' ? `NIVEAU ${newLevel} !!!` : `LEVEL ${newLevel} !!!`}\u001b[0m\n` +
                    `\u001b[1;35m${"═".repeat(40)}\u001b[0m\n\n` +
                    `\u001b[1;36m${userLang === 'fr' ? 'Les legendes parlent de cet agent depuis des generations.' : 'Legends speak of this agent across generations.'}\u001b[0m\n` +
                    `\u001b[1;36m${userLang === 'fr' ? `Le noud BAMAKO_223 reconnait ${message.author.username} comme veritable pilier du reseau.` : `The BAMAKO_223 node recognizes ${message.author.username} as a true pillar of the network.`}\u001b[0m\n` +
                    `\`\`\``
                )
                .addFields(
                    { name: userLang === 'fr' ? '👑 RANG MYTHIQUE' : '👑 MYTHIC RANK', value: levelTier, inline: true },
                    { name: '⚡ XP', value: `${newXP.toLocaleString()}`, inline: true },
                    { name: userLang === 'fr' ? '🏛️ ROYAUME' : '🏛️ REALM', value: guildName, inline: true }
                )
                .setFooter({ text: `${guildName} • v${client.version || '2.0'}`, iconURL: guildIcon })
                .setTimestamp();
            if (levelBannerUrl) embed.setImage(levelBannerUrl);
            await targetChannel.send({ embeds: [embed] });
        }
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
                .setFooter({ text: 'ARCHITECT CG-223 • Database Health • BAMAKO_223 🇲🇱' })
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

    const cooldownCheck = checkCooldown(message.author.id, cmdName, 2000);
    if (cooldownCheck.blocked) {
        return message.reply(`⏳ Slow down! Try again in ${cooldownCheck.remaining}s`).catch(() => {});
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
client.on(Events.InteractionCreate, async (interaction) => {
    // SLASH COMMAND EXECUTION
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) {
            console.log(`${yellow}[SLASH]${reset} Unknown command: ${interaction.commandName}`);
            return interaction.reply({ content: '❌ Command not found.', ephemeral: true }).catch(() => {});
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

        return interaction.reply({ embeds: [fallbackEmbed], ephemeral: true });
    }
}

        try {
            console.log(`${cyan}[SLASH]${reset} Executing /${interaction.commandName} for ${interaction.user.tag}`);
            
            if (command.execute) {
                await command.execute(interaction, client);
                
                // Bot XP: earns XP when processing a slash command
                if (client.botStats && interaction.guild && db) {
                    client.botStats.onCommandProcessed(db, interaction.guild.id, interaction.user.id, interaction.commandName, true);
                }
            } else {
                await interaction.reply({ 
                    content: '❌ This command does not support slash execution yet.', 
                    ephemeral: true 
                }).catch(() => {});
            }
        } catch (error) {
            console.error(`${red}[SLASH ERROR]${reset} ${interaction.commandName}:`, error);
            const errorMsg = { content: '❌ There was an error executing this command!', ephemeral: true };
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMsg).catch(() => {});
            } else {
                await interaction.reply(errorMsg).catch(() => {});
            }
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
        
        await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
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
            
            await interaction.reply({ embeds: [profileEmbed], ephemeral: true });
            
        } catch (err) {
            console.error('[PROFILE BUTTON ERROR]', err);
            await interaction.reply({ 
                content: lang === 'fr' ? "❌ Erreur lors du chargement du profil." : "❌ Error loading profile.", 
                ephemeral: true 
            });
        }
        return;
    }
    
    // ================= BIRTHDAY CELEBRATION BUTTON =================
    if (interaction.isButton() && interaction.customId.startsWith('bday_celebrate_')) {
        const userId = interaction.customId.replace('bday_celebrate_', '');
        const user = await client.users.fetch(userId).catch(() => null);
        
        if (!user) {
            return interaction.reply({ content: 'User not found!', ephemeral: true });
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
            return interaction.reply({ content: 'User not found!', ephemeral: true });
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
            return interaction.reply({ content: 'This user is no longer AFK.', ephemeral: true });
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
        
        await interaction.reply({ content: replyMsg, ephemeral: true });
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
            ephemeral: true 
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
        
        await interaction.reply({ embeds: [shopEmbed], ephemeral: true });
        return;
    }

    // ================= TICKET SYSTEM COMPONENTS (Select Menu + Buttons) =================
    const isTicketComponent = (interaction.isButton() && interaction.customId.startsWith('ticket_')) ||
        (interaction.isStringSelectMenu() && interaction.customId === 'ticket_create_select');

    if (isTicketComponent) {
        try {
            const ticketModule = require('./plugins/ticket.js');
            if (ticketModule.handleComponent) {
                const handled = await ticketModule.handleComponent(interaction, client);
                if (handled) return;
            }
        } catch (err) {
            console.error(`${red}[TICKET COMPONENT]${reset}`, err.message);
            await interaction.reply({ content: '❌ Ticket action failed.', ephemeral: true }).catch(() => {});
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
            await interaction.reply({ content: '❌ Vote action failed.', ephemeral: true }).catch(() => {});
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

    // ================= PREMIUM UPGRADE BUTTON (from status embed) =================
    if (interaction.isButton() && interaction.customId === 'premium_upgrade_btn') {
        try {
            await interaction.deferReply({ ephemeral: true });
            const userId = interaction.user.id;
            const username = interaction.user.username;
            const avatarURL = interaction.user.displayAvatarURL({ dynamic: true });

            const premiumData = client.db.prepare('SELECT premium_active FROM user_premium WHERE user_id = ?').get(userId);
            if (premiumData?.premium_active === 1) {
                return interaction.editReply({ content: '✅ You are already a premium member! Use `/premium status` to view your subscription.', ephemeral: true });
            }

            const DODO_PRODUCT_URL = process.env.DODO_PRODUCT_URL || 'https://app.dodopayments.com/buy/p_mock12345';
            const checkoutUrl = DODO_PRODUCT_URL + '?metadata[discord_user_id]=' + userId;

            const upgradeEmbed = new EmbedBuilder()
                .setColor('#5865f2')
                .setAuthor({ name: `${username} • Upgrade to Premium`, iconURL: avatarURL })
                .setTitle('🦅 ARCHITECT CG-223 • Premium')
                .setDescription('**Unlock the full power of Archon Engine.**\nOne subscription. Every server you manage. Instant activation.')
                .addFields(
                    { name: '🧠 Uncapped Lydia AI', value: 'Continuous memory matrices. Your AI remembers everything.', inline: false },
                    { name: '📡 Global Log Syncing', value: 'Block a threat in one server — defenses deploy instantly across **all** your servers.', inline: false },
                    { name: '📊 HTML Transcripts', value: 'Auto-compiled ticket archives saved to your domain.', inline: false },
                    { name: '⚡ Priority Processing', value: 'Your commands jump the queue. Zero latency.', inline: false },
                    { name: '🏷️ Premium Badge', value: 'Exclusive recognition across every server.', inline: false },
                    { name: '🔒 Secure Checkout', value: 'Powered by **Dodo Payments**. Enterprise encryption.', inline: false }
                )
                .setFooter({ text: 'Archon Engine CG-223 • Dodo Payments', iconURL: client.user?.displayAvatarURL() || null })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Unlock Premium')
                    .setStyle(ButtonStyle.Link)
                    .setURL(checkoutUrl)
                    .setEmoji('💎')
            );

            await interaction.editReply({ embeds: [upgradeEmbed], components: [row] });
        } catch (err) {
            console.error('[PREMIUM BUTTON ERROR]', err);
            await interaction.editReply({ content: '❌ Something went wrong. Please use `/premium upgrade` instead.', ephemeral: true });
        }
        return;
    }

});

// ================= SUPREME NEURAL WELCOME MATRIX v5.0 =================
client.on(Events.GuildMemberAdd, async (member) => {
    if (member.user.bot) return;
    
    if (rateLimit(`welcome:${member.guild.id}`, 10, 30000)) return;
    
    const settings = getServerSettings(member.guild.id);
    const isArchitectServer = member.guild.id === process.env.GUILD_ID;
    
    let welcomeChannelId = settings.welcomeChannel;
    let logChannelId = settings.logChannel;
    let rulesChannelId = settings.rulesChannel;
    let generalChannelId = settings.generalChannel;
    let memberRoleId = settings.memberRole;
    
    if (isArchitectServer) {
        welcomeChannelId = welcomeChannelId || process.env.WELCOME_CHANNEL_ID;
        logChannelId = logChannelId || process.env.LOG_CHANNEL_ID;
        rulesChannelId = rulesChannelId || process.env.RULES_CHANNEL_ID;
        generalChannelId = generalChannelId || process.env.GENERAL_CHANNEL_ID;
        memberRoleId = memberRoleId || process.env.MEMBER_ROLE;
    }
    
    const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);
    const logChannel = member.guild.channels.cache.get(logChannelId);
    
    const memberCount = member.guild.memberCount;
    const accountAgeDays = Math.floor((Date.now() - member.user.createdTimestamp) / 86400000);
    const accountAgeHours = Math.floor((Date.now() - member.user.createdTimestamp) / 3600000);
    const lang = member.guild.preferredLocale === 'fr' ? 'fr' : 'en';
    const joinNumber = memberCount;
    const serverCreationDate = Math.floor(member.guild.createdTimestamp / 1000);
    const accountCreationDate = Math.floor(member.user.createdTimestamp / 1000);
    
    // ================= AUTO-ROLE ASSIGNMENT =================
    // Priority: 1) server_settings.auto_role_id  2) env fallback (owner server)  3) member_role fallback
    const autoRoleId = settings.autoRoleId || (isArchitectServer ? process.env.AUTO_ROLE_ID : null) || memberRoleId;
    if (autoRoleId) {
        try {
            const role = member.guild.roles.cache.get(autoRoleId);
            if (role && !member.roles.cache.has(autoRoleId)) {
                await member.roles.add(role, '[SYSTEM] Auto-role on join');
                console.log(`[AUTO-ROLE] Assigned ${role.name} to ${member.user.tag} in ${member.guild.name}`);
            }
        } catch (e) {
            console.error(`[AUTO-ROLE] Failed for ${member.user.tag}:`, e.message);
        }
    }

    // ================= BOT AUTO-ROLE =================
    // When a member joins, also check if the bot needs an auto-role
    if (client.botStats && member.user.id !== client.user.id) {
        try {
            client.botStats.applyBotAutoRole(member.guild, settings);
        } catch (e) {
            // Silent fail — bot auto-role is best-effort
        }
    }
    
    let memberTier, tierEmoji, tierColor;
    if (joinNumber <= 10) { memberTier = lang === 'fr' ? 'FONDATEUR' : 'FOUNDER'; tierEmoji = '💎'; tierColor = '#ffd700'; }
    else if (joinNumber <= 50) { memberTier = lang === 'fr' ? 'PIONNIER' : 'PIONEER'; tierEmoji = '🏅'; tierColor = '#e91e63'; }
    else if (joinNumber <= 100) { memberTier = lang === 'fr' ? 'VETERAN' : 'VETERAN'; tierEmoji = '⚔️'; tierColor = '#9b59b6'; }
    else if (joinNumber <= 500) { memberTier = lang === 'fr' ? 'ELITE' : 'ELITE'; tierEmoji = '🛡️'; tierColor = '#3498db'; }
    else if (joinNumber <= 1000) { memberTier = lang === 'fr' ? 'GARDIEN' : 'GUARDIAN'; tierEmoji = '🌟'; tierColor = '#2ecc71'; }
    else { memberTier = lang === 'fr' ? 'LEGENDE' : 'LEGEND'; tierEmoji = '👑'; tierColor = '#f39c12'; }
    
    let ageStatus, ageEmoji;
    if (accountAgeDays < 1) { ageStatus = lang === 'fr' ? 'Nouveau-ne' : 'Newborn'; ageEmoji = '👶'; }
    else if (accountAgeDays < 7) { ageStatus = lang === 'fr' ? 'Jeune pousse' : 'Sprout'; ageEmoji = '🌱'; }
    else if (accountAgeDays < 30) { ageStatus = lang === 'fr' ? 'En croissance' : 'Growing'; ageEmoji = '🌿'; }
    else if (accountAgeDays < 365) { ageStatus = lang === 'fr' ? 'Etabli' : 'Established'; ageEmoji = '🌳'; }
    else { ageStatus = lang === 'fr' ? 'Ancien' : 'Ancient'; ageEmoji = '🏛️'; }

    const formatDate = (timestamp) => {
        const d = new Date(timestamp * 1000);
        const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        return `${d.getFullYear()}-${months[d.getMonth()]}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // ================= CINEMATIC WELCOME TITLES (rotating) =================
    const cinematicTitles = lang === 'fr' ? [
        { header: '⚡ CONNEXION NEURALE ÉTABLIE', body: `**${member.user.username.toUpperCase()}** s'est synchronisé avec le réseau.` },
        { header: '🌐 NŒUD NEURAL ACTIVÉ', body: `**${member.user.username.toUpperCase()}** a matérialisé sa présence dans la grille.` },
        { header: '🔮 CONSCIENCE TÉLÉCHARGÉE', body: `**${member.user.username.toUpperCase()}** est en ligne. Systèmes opérationnels.` },
        { header: '🚀 PROTOCOLE D\'ARRIVÉE', body: `**${member.user.username.toUpperCase()}** a franchi la passerelle neuronale.` },
        { header: '💠 MATRICE RECONFIGURÉE', body: `**${member.user.username.toUpperCase()}** enrichit le réseau de sa signature.` },
        { header: '🦅 L\'AIGLE ATTERRIT', body: `**${member.user.username.toUpperCase()}** a pris position dans le nid.` }
    ] : [
        { header: '⚡ NEURAL HANDSHAKE COMPLETE', body: `**${member.user.username.toUpperCase()}** has synchronized with the network.` },
        { header: '🌐 NEURAL NODE ACTIVATED', body: `**${member.user.username.toUpperCase()}** materialized within the grid.` },
        { header: '🔮 CONSCIOUSNESS UPLOADED', body: `**${member.user.username.toUpperCase()}** is online. All systems nominal.` },
        { header: '🚀 ARRIVAL PROTOCOL', body: `**${member.user.username.toUpperCase()}** has crossed the neural gateway.` },
        { header: '💠 MATRIX RECONFIGURED', body: `**${member.user.username.toUpperCase()}** adds their signature to the network.` },
        { header: '🦅 THE EAGLE LANDS', body: `**${member.user.username.toUpperCase()}** has taken position in the nest.` }
    ];
    // Deterministic rotation: same user always gets same title (based on userId hash)
    const titleIndex = [...member.user.id].reduce((a, c) => a + c.charCodeAt(0), 0) % cinematicTitles.length;
    const chosen = cinematicTitles[titleIndex];

    const welcomeEmbed = new EmbedBuilder()
        .setColor(tierColor)
        .setAuthor({
            name: chosen.header,
            iconURL: member.guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL()
        })
        .setDescription(
            `### ${tierEmoji} ${lang === 'fr' ? 'AGENT AUTHENTIFIÉ' : 'AGENT AUTHENTICATED'}\n` +
            `${chosen.body}\n\n` +
            `\`\`\`\n` +
            `╔══════════════ DAEMON_LOG ══════════════╗\n` +
            `║  🛰️ NODE:    ${member.guild.name.substring(0, 18).padEnd(22)}║\n` +
            `║  ${tierEmoji} TIER:    ${memberTier.padEnd(20)}║\n` +
            `║  👥 SECTOR:  #${String(memberCount).padEnd(20)}║\n` +
            `╚══════════════════════════════════════════╝\n` +
            `\`\`\``
        )
        .addFields(
            {
                name: `📡 **${lang === 'fr' ? 'FREQUENCE' : 'FREQUENCY'}**`,
                value: `\`ONLINE\``,
                inline: true
            },
            {
                name: `🔐 **${lang === 'fr' ? 'CRYPTAGE' : 'ENCRYPTION'}**`,
                value: `\`AES-256\``,
                inline: true
            },
            {
                name: `🔋 **${lang === 'fr' ? 'STABILITE' : 'STABILITY'}**`,
                value: `\`100%\``,
                inline: true
            },
            {
                name: `📂 **${lang === 'fr' ? 'DOSSIER AGENT' : 'AGENT DOSSIER'}**`,
                value: [
                    `\`\`\``,
                    `${lang === 'fr' ? 'Identifiant' : 'User ID'}: ${member.user.id}`,
                    `${lang === 'fr' ? 'Pseudonyme' : 'Username'}: ${member.user.username}`,
                    `${lang === 'fr' ? 'Affiche comme' : 'Display Name'}: ${member.user.displayName}`,
                    `${lang === 'fr' ? 'Compte cree le' : 'Account Created'}: ${formatDate(accountCreationDate)}`,
                    `${lang === 'fr' ? 'Age du compte' : 'Account Age'}: ${ageEmoji} ${accountAgeDays < 1 ? accountAgeHours + 'h' : accountAgeDays + 'd'}`,
                    `\`\`\``
                ].join('\n'),
                inline: false
            },
            {
                name: `🏛️ **${lang === 'fr' ? 'ROYAUME' : 'KINGDOM'}**`,
                value: [
                    `\`\`\``,
                    `${lang === 'fr' ? 'Serveur' : 'Server'}: ${member.guild.name}`,
                    `${lang === 'fr' ? 'Fonde le' : 'Founded'}: ${formatDate(serverCreationDate)}`,
                    `${lang === 'fr' ? 'Membres' : 'Members'}: ${memberCount.toLocaleString()}`,
                    `\`\`\``
                ].join('\n'),
                inline: false
            }
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setFooter({ 
            text: `${member.guild.name} • v${client.version || '2.0'}`, 
            iconURL: member.guild.iconURL() || client.user.displayAvatarURL() 
        })
        .setTimestamp();
    
    const buttons = [];

    if (rulesChannelId) {
        buttons.push(
            new ButtonBuilder()
                .setLabel(lang === 'fr' ? '📜 REGLES' : '📜 RULES')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/channels/${member.guild.id}/${rulesChannelId}`)
        );
    }

    if (generalChannelId) {
        buttons.push(
            new ButtonBuilder()
                .setLabel(lang === 'fr' ? '💬 GENERAL' : '💬 GENERAL')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/channels/${member.guild.id}/${generalChannelId}`)
        );
    }

    buttons.push(
        new ButtonBuilder()
            .setLabel(lang === 'fr' ? '🤖 ASSISTANT IA' : '🤖 AI ASSISTANT')
            .setStyle(ButtonStyle.Primary)
            .setCustomId('welcome_help')
    );

    buttons.push(
        new ButtonBuilder()
            .setLabel(lang === 'fr' ? '👤 MON PROFIL' : '👤 MY PROFILE')
            .setStyle(ButtonStyle.Success)
            .setCustomId(`welcome_profile_${member.user.id}`)
    );

    const buttonRow = new ActionRowBuilder().addComponents(buttons);
    
    if (welcomeChannel) {
        console.log(`[WELCOME] 🚀 Sending embed to #${welcomeChannel.name}`);
        
        try {
            await welcomeChannel.send({ 
                content: `\`[SYS]\` 🛰️ **${member.user.username.toUpperCase()}** ${lang === 'fr' ? 'connecte au reseau' : 'connected to the grid'} • TIER: **${memberTier}**`,
                embeds: [welcomeEmbed], 
                components: [buttonRow]
            });
            console.log(`[WELCOME] ✅ EMBED SENT successfully`);
        } catch (error) {
            console.error(`[WELCOME] ❌ EMBED FAILED:`, error.message);
            try {
                await welcomeChannel.send({
                    content: [
                        `${tierEmoji} **${member.user.displayName}** ${lang === 'fr' ? 'vient de rejoindre' : 'just joined'} **${member.guild.name}**!`,
                        `📊 ${lang === 'fr' ? 'Membre' : 'Member'} **#${joinNumber}** | 🏅 ${memberTier}`,
                        `${lang === 'fr' ? '💡 Utilise' : '💡 Use'} \`${settings.prefix || '.'}help\` ${lang === 'fr' ? 'pour commencer' : 'to get started'}!`
                    ].join('\n'),
                    components: [buttonRow]
                });
                console.log(`[WELCOME] ✅ Text fallback sent`);
            } catch (e2) {
                console.error(`[WELCOME] 💀 FALLBACK FAILED:`, e2.message);
            }
        }
        
        setTimeout(async () => {
            try {
                const pfx = settings.prefix || '.';
                const serverName = member.guild.name;
                const tips = lang === 'fr' ? [
                    `> 🧠 **${member.user.username}**, bienvenue au **${serverName}** ! Je suis **Archon CG-223**, votre assistant neuronal.\n> \n> 🚀 **Pour bien demarrer :**\n> \`${pfx}help\` — Decouvrir toutes mes commandes\n> \`${pfx}daily\` — Recompense quotidienne (ne manquez pas un jour pour la serie !)\n> \`${pfx}profile\` — Voir votre dossier d'agent\n> \n> 💡 **Conseil pro :** Utilisez \`${pfx}whois\` pour scanner n'importe quel membre et \`${pfx}rank\` pour voir votre position sur ce serveur. Bonne chance, agent ! 🎯`,
                    `> 🎯 **${member.user.username}**, votre connexion au reseau **${serverName}** est etablie.\n> \n> 📊 **Commandes essentielles pour debuter :**\n> \`${pfx}help\` — Carte complete des capacites\n> \`${pfx}daily\` — Recolter vos credits quotidiens\n> \`${pfx}shop\` — Acheter des boosts et objets\n> \`${pfx}lydia [message]\` — Discuter avec l'IA Lydia\n> \n> 🏆 **Astuce :** Jouez a \`${pfx}trivia\` pour gagner de l'XP et des credits, ou \`${pfx}game\` pour defier d'autres agents. Que l'aventure commence ! ⚡`,
                    `> ⚡ **${member.user.username}**, le node **${serverName}** vous souhaite la bienvenue !\n> \n> 🛠 **Votre toolkit d'agent :**\n> \`${pfx}help\` — Toutes les commandes disponibles\n> \`${pfx}profile\` — Vos statistiques et progression\n> \`${pfx}daily\` — Recompense quotidienne ( serie = bonus !)\n> \`${pfx}market\` — Investir dans le marche de Bamako\n> \n> 🧠 **Besoin d'aide ?** L'IA Lydia (\`${pfx}lydia\`) repond a toutes vos questions. Profitez de votre sejour, agent **${memberTier}** ! 🦅`
                ] : [
                    `> 🧠 **${member.user.username}**, welcome to **${serverName}** ! I am **Archon CG-223**, your neural assistant.\n> \n> 🚀 **To get started :**\n> \`${pfx}help\` — Discover all my commands\n> \`${pfx}daily\` — Daily reward (don't miss a day for streak bonus!)\n> \`${pfx}profile\` — View your agent dossier\n> \n> 💡 **Pro tip :** Use \`${pfx}whois\` to deep-scan any member and \`${pfx}rank\` to check your server standing. Good luck, agent ! 🎯`,
                    `> 🎯 **${member.user.username}**, your connection to **${serverName}** network is established.\n> \n> 📊 **Essential commands to start :**\n> \`${pfx}help\` — Full capability map\n> \`${pfx}daily\` — Harvest your daily credits\n> \`${pfx}shop\` — Buy boosts and items\n> \`${pfx}lydia [message]\` — Chat with AI Lydia\n> \n> 🏆 **Tip :** Play \`${pfx}trivia\` to earn XP and credits, or \`${pfx}game\` to challenge other agents. Let the adventure begin ! ⚡`,
                    `> ⚡ **${member.user.username}**, node **${serverName}** welcomes you !\n> \n> 🛠 **Your agent toolkit :**\n> \`${pfx}help\` — All available commands\n> \`${pfx}profile\` — Your stats and progression\n> \`${pfx}daily\` — Daily reward (streak = bonus!)\n> \`${pfx}market\` — Invest in the Bamako market\n> \n> 🧠 **Need help ?** AI Lydia (\`${pfx}lydia\`) answers all your questions. Enjoy your stay, **${memberTier}** agent ! 🦅`
                ];
                await welcomeChannel.send({ content: tips[Math.floor(Math.random() * tips.length)] });
            } catch (e) {}
        }, 3000);
        
    } else {
        console.log(`[WELCOME] ⚠️ No welcome channel for ${member.guild.name}`);
    }

    // ================= PHASE 6: SECURITY INTELLIGENCE =================
    if (logChannel) {
        setImmediate(async () => {
            try {
                const owner = await member.guild.fetchOwner().catch(() => null);
                
                const threatAnalysis = {
                    score: 0,
                    flags: [],
                    risk: 'LOW',
                    color: '#3498db'
                };
                
                if (accountAgeDays < 1) { threatAnalysis.score += 40; threatAnalysis.flags.push('🔴 BRAND NEW ACCOUNT (<24h)'); }
                else if (accountAgeDays < 3) { threatAnalysis.score += 30; threatAnalysis.flags.push('🟠 VERY NEW ACCOUNT (<3 days)'); }
                else if (accountAgeDays < 7) { threatAnalysis.score += 20; threatAnalysis.flags.push('🟡 NEW ACCOUNT (<7 days)'); }
                else if (accountAgeDays < 30) { threatAnalysis.score += 10; threatAnalysis.flags.push('🟢 RECENT ACCOUNT (<30 days)'); }
                else { threatAnalysis.flags.push('✅ ESTABLISHED ACCOUNT'); }
                
                const hasDefaultAvatar = !member.user.avatar || 
                    (!member.user.avatar.startsWith('a_') && member.user.displayAvatarURL().includes('embed/avatars'));
                if (hasDefaultAvatar) { threatAnalysis.score += 15; threatAnalysis.flags.push('⚠️ DEFAULT AVATAR'); }
                
                const username = member.user.username.toLowerCase();
                [
                    { pattern: /^\d{4,}$/, flag: '🔢 NUMERIC-ONLY', weight: 10 },
                    { pattern: /(spam|scam|hack|bot|raid|nuke)/i, flag: '🚫 SUSPICIOUS KEYWORDS', weight: 25 },
                    { pattern: /(discord|mod|admin|staff|support)/i, flag: '⚠️ IMPERSONATION', weight: 30 }
                ].forEach(({ pattern, flag, weight }) => {
                    if (pattern.test(username)) { threatAnalysis.score += weight; threatAnalysis.flags.push(flag); }
                });
                
                const joinKey = `recentJoins:${member.guild.id}`;
                const recentJoins = client._recentJoins?.get(joinKey) || [];
                const now = Date.now();
                const recentJoinWindow = recentJoins.filter(t => now - t < 60000);
                if (recentJoinWindow.length > 5) { threatAnalysis.score += 25; threatAnalysis.flags.push(`🌊 RAID: ${recentJoinWindow.length} joins/60s`); }
                else if (recentJoinWindow.length > 3) { threatAnalysis.score += 15; threatAnalysis.flags.push(`⚡ HIGH VELOCITY: ${recentJoinWindow.length}/60s`); }
                
                recentJoins.push(now);
                if (!client._recentJoins) client._recentJoins = new Map();
                client._recentJoins.set(joinKey, recentJoinWindow.slice(-20));
                
                if (threatAnalysis.score >= 70) { threatAnalysis.risk = 'CRITICAL'; threatAnalysis.color = '#ff0000'; }
                else if (threatAnalysis.score >= 50) { threatAnalysis.risk = 'HIGH'; threatAnalysis.color = '#e74c3c'; }
                else if (threatAnalysis.score >= 30) { threatAnalysis.risk = 'MEDIUM'; threatAnalysis.color = '#f39c12'; }
                else if (threatAnalysis.score >= 15) { threatAnalysis.risk = 'ELEVATED'; threatAnalysis.color = '#f1c40f'; }
                else { threatAnalysis.risk = 'LOW'; threatAnalysis.color = '#2ecc71'; }
                
                const intelEmbed = new EmbedBuilder()
                    .setColor(threatAnalysis.color)
                    .setAuthor({ name: `🛡️ GUARDIAN OSINT • RISK: ${threatAnalysis.risk}`, iconURL: client.user.displayAvatarURL() })
                    .setDescription([
                        `\`\`\`ansi`,
                        `\u001b[1;36m╔════════════════════════════════╗\u001b[0m`,
                        `\u001b[1;36m║\u001b[0m \u001b[1;33mTARGET:\u001b[0m ${member.user.displayName.padEnd(20)}\u001b[1;36m║\u001b[0m`,
                        `\u001b[1;36m║\u001b[0m \u001b[1;31mTHREAT:\u001b[0m ${threatAnalysis.risk.padEnd(20)}\u001b[1;36m║\u001b[0m`,
                        `\u001b[1;36m║\u001b[0m \u001b[1;35mSCORE:\u001b[0m ${(threatAnalysis.score + '/100').padEnd(20)}\u001b[1;36m║\u001b[0m`,
                        `\u001b[1;36m╚════════════════════════════════╝\u001b[0m`,
                        `\`\`\``
                    ].join('\n'))
                    .addFields(
                        { name: '📊 SUMMARY', value: `\`\`\`yaml\nThreat Score: ${threatAnalysis.score}/100\nRisk: ${threatAnalysis.risk}\nFlags: ${threatAnalysis.flags.length}\nMember #${memberCount}\n\`\`\``, inline: false },
                        { name: '🔍 FLAGS', value: threatAnalysis.flags.length > 0 ? threatAnalysis.flags.map(f => `• ${f}`).join('\n') : '✅ Clean', inline: false }
                    )
                    .setFooter({ text: `GUARDIAN OSINT v5.0 • ${member.guild.name}` })
                    .setTimestamp();
                
                await logChannel.send({ 
                    content: threatAnalysis.score >= 50 ? `🚨 **SECURITY ALERT: ${threatAnalysis.risk} RISK JOIN**` : null,
                    embeds: [intelEmbed] 
                }).catch(() => {});
                
                console.log(`[SECURITY] ${member.user.username} | Threat: ${threatAnalysis.risk} (${threatAnalysis.score}/100)`);
                
            } catch (err) {
                console.error(`[SECURITY ERROR]`, err.message);
            }
        });
    }
});

// ================= SUPREME NEURAL DEPARTURE MATRIX v4.0 =================
client.on(Events.GuildMemberRemove, async (member) => {
    if (member.user.bot) return;
    
    if (rateLimit(`goodbye:${member.guild.id}`, 10, 30000)) return;
    
    const settings = getServerSettings(member.guild.id);
    const isArchitectServer = member.guild.id === process.env.GUILD_ID;
    
    let goodbyeChannelId = settings.goodbyeChannel;
    if (isArchitectServer) {
        goodbyeChannelId = goodbyeChannelId || process.env.GOODBYE_CHANNEL_ID;
    }
    
    const goodbyeChannel = member.guild.channels.cache.get(goodbyeChannelId);
    if (!goodbyeChannel) return;
    
    const memberCount = member.guild.memberCount;
    const lang = member.guild.preferredLocale === 'fr' ? 'fr' : 'en';
    
    const joinDate = member.joinedAt;
    const now = Date.now();
    const stayDuration = joinDate ? now - joinDate.getTime() : 0;
    const stayDays = Math.floor(stayDuration / (1000 * 60 * 60 * 24));
    const stayHours = Math.floor(stayDuration / (1000 * 60 * 60));
    
    let stayStatus, stayEmoji;
    if (stayDays < 1) { stayStatus = lang === 'fr' ? 'Visiteur Eclair' : 'Flash Visitor'; stayEmoji = '⚡'; }
    else if (stayDays < 7) { stayStatus = lang === 'fr' ? 'Explorateur' : 'Explorer'; stayEmoji = '🔍'; }
    else if (stayDays < 30) { stayStatus = lang === 'fr' ? 'Resident' : 'Resident'; stayEmoji = '🏠'; }
    else if (stayDays < 180) { stayStatus = lang === 'fr' ? 'Pilier' : 'Pillar'; stayEmoji = '🏛️'; }
    else if (stayDays < 365) { stayStatus = lang === 'fr' ? 'Veteran' : 'Veteran'; stayEmoji = '⚔️'; }
    else { stayStatus = lang === 'fr' ? 'Legende Eternelle' : 'Eternal Legend'; stayEmoji = '👑'; }
    
    let departureType = lang === 'fr' ? 'A quitte' : 'Left';
    let departureEmoji = '🚪';
    let departureColor = '#e74c3c';
    
    try {
        const auditLogs = await member.guild.fetchAuditLogs({ type: 20, limit: 3 }).catch(() => null);
        if (auditLogs) {
            const kickEntry = auditLogs.entries.find(e => e.target.id === member.user.id && Date.now() - e.createdTimestamp < 5000);
            if (kickEntry) {
                departureType = lang === 'fr' ? 'Expulse' : 'Kicked';
                departureEmoji = '👢';
                departureColor = '#ff6b6b';
            }
        }
        
        const banLogs = await member.guild.fetchAuditLogs({ type: 22, limit: 3 }).catch(() => null);
        if (banLogs) {
            const banEntry = banLogs.entries.find(e => e.target.id === member.user.id && Date.now() - e.createdTimestamp < 5000);
            if (banEntry) {
                departureType = lang === 'fr' ? 'Banni' : 'Banned';
                departureEmoji = '🔨';
                departureColor = '#ff0000';
            }
        }
    } catch (e) {}
    
    const roles = member.roles?.cache
        .filter(r => r.name !== '@everyone')
        .sort((a, b) => b.position - a.position)
        .first(5)
        .map(r => r.name)
        .join(', ') || (lang === 'fr' ? 'Aucun role' : 'No roles');
    
    const goodbyeEmbed = new EmbedBuilder()
        .setColor(departureColor)
        .setAuthor({ 
            name: lang === 'fr' ? '🦅 RESEAU NEURAL • LIEN ROMPU' : '🦅 NEURAL NETWORK • LINK SEVERED',
            iconURL: member.user.displayAvatarURL()
        })
        .setDescription([
            `\`\`\`ansi`,
            `\u001b[1;31m╔══════════════════════════════════════════════╗\u001b[0m`,
            `\u001b[1;31m║\u001b[0m  \u001b[1;37m${lang === 'fr' ? 'DEPART DU RESEAU' : 'NETWORK DEPARTURE'}\u001b[0m                    \u001b[1;31m║\u001b[0m`,
            `\u001b[1;31m╠══════════════════════════════════════════════╣\u001b[0m`,
            `\u001b[1;31m║\u001b[0m  \u001b[1;33m${departureEmoji} ${member.user.username}\u001b[0m`,
            `\u001b[1;31m║\u001b[0m  \u001b[1;35m${departureEmoji} ${departureType}\u001b[0m`,
            `\u001b[1;31m║\u001b[0m  \u001b[1;32m${stayEmoji} ${stayStatus}\u001b[0m`,
            `\u001b[1;31m╚══════════════════════════════════════════════╝\u001b[0m`,
            `\`\`\``
        ].join('\n'))
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
        .addFields(
            {
                name: `${lang === 'fr' ? '📊 RAPPORT DE DEPART' : '📊 DEPARTURE REPORT'}`,
                value: [
                    `\`\`\`yaml`,
                    `${lang === 'fr' ? 'Nom' : 'Display'}: ${member.user.displayName}`,
                    `ID: ${member.user.id}`,
                    `${lang === 'fr' ? 'Type de depart' : 'Departure'}: ${departureEmoji} ${departureType}`,
                    `\`\`\``
                ].join('\n'),
                inline: true
            },
            {
                name: `${lang === 'fr' ? '⏱️ DUREE DE SEJOUR' : '⏱️ STAY DURATION'}`,
                value: [
                    `\`\`\`yaml`,
                    `${stayEmoji} ${stayStatus}`,
                    `${lang === 'fr' ? 'Membre depuis' : 'Member Since'}: ${joinDate ? `<t:${Math.floor(joinDate.getTime() / 1000)}:R>` : 'Unknown'}`,
                    `${lang === 'fr' ? 'Duree' : 'Duration'}: ${stayDays < 1 ? stayHours + 'h' : stayDays + 'd'}`,
                    `\`\`\``
                ].join('\n'),
                inline: true
            },
            {
                name: `${lang === 'fr' ? '🎭 ROLES PERDUS' : '🎭 ROLES LOST'}`,
                value: `\`\`\`yaml\n${roles}\n\`\`\``,
                inline: false
            },
            {
                name: `${lang === 'fr' ? '📈 IMPACT SUR LE SERVEUR' : '📈 SERVER IMPACT'}`,
                value: [
                    `\`\`\`yaml`,
                    `${lang === 'fr' ? 'Membres' : 'Members'}: ${memberCount.toLocaleString()}`,
                    `${lang === 'fr' ? 'Depart' : 'Departure'}: ${departureEmoji} ${departureType}`,
                    `${lang === 'fr' ? 'Duree' : 'Stay'}: ${stayDays < 1 ? stayHours + 'h' : stayDays + 'd'}`,
                    `\`\`\``
                ].join('\n'),
                inline: false
            }
        );
    
    if (settings.goodbyeMessage) {
        goodbyeEmbed.setDescription(settings.goodbyeMessage
            .replace(/{user}/g, `<@${member.user.id}>`)
            .replace(/{username}/g, member.user.username)
            .replace(/{server}/g, member.guild.name)
            .replace(/{membercount}/g, memberCount.toString())
            .replace(/{staystatus}/g, stayStatus)
            .replace(/{departuretype}/g, departureType)
        );
    }
    
    goodbyeEmbed.setFooter({ 
        text: `${member.guild.name} • Neural Link Terminated • BAMAKO_223 🇲🇱 • v${client.version}`,
        iconURL: member.guild.iconURL() || client.user.displayAvatarURL()
    })
    .setTimestamp();
    
    await goodbyeChannel.send({ embeds: [goodbyeEmbed] }).catch(() => {});
    console.log(`[GOODBYE] ${member.user.tag} | ${departureType} | Stay: ${stayDays}d | ${member.guild.name}`);
});

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
// WEB SERVER — Dodo Payments Billing Gateway
// ============================================================
// The webhook server starts BEFORE Discord login because:
// 1. Dodo Payments webhooks are standalone (no Discord client needed)
// 2. We must not miss payment callbacks during bot restart
// 3. The webhook router handles its own database & business logic
// ============================================================
/*
function startWebServer(startPort = 3000, maxAttempts = 10) {
    const express = require('express');
    const app = express();

    // ── Trust Proxy (Production-grade) ──
    // Moved from webhook.js to app instance where it belongs
    app.set('trust proxy', 1);

    // ── Security Middleware ──
    app.use(express.json({ limit: '64kb' }));
    app.use(express.urlencoded({ extended: true, limit: '64kb' }));

    // ── View Configurations ──
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'ejs');

// ============================================================
// DODO PAYMENTS WEBHOOK — Billing Gateway Mount
// ============================================================
try {
    const webhookModule = require('./webhook.js');
    if (webhookModule.initializeDatabase) {
        webhookModule.initializeDatabase(db); // <-- injects the SAME db
        console.log('\x1b[32m[INDEX]\x1b[0m ✅ Webhook using shared database.');
    }
    app.use('/', webhookModule);
    console.log('\x1b[32m[INDEX]\x1b[0m ✅ Dodo webhook router mounted smoothly at /api/v1/billing/webhook');
} catch (err) {
    console.error('\x1b[31m[INDEX]\x1b[0m ❌ Failed to mount webhook router:', err.message);
    console.error('\x1b[33m[INDEX]\x1b[0m ⚠️ Billing gateway offline — payments will not be processed!');
}
*/
// ============================================================
// ARCHON DASHBOARD API — Dashboard Mount
// ============================================================
try {
    const dashboardApp = require('./server');
    app.use(dashboardApp);
    console.log('\x1b[32m[INDEX]\x1b[0m ✅ Dashboard API mounted on web server');
} catch (err) {
    console.error('\x1b[31m[INDEX]\x1b[0m ❌ Failed to mount dashboard API:', err.message);
}

    // ── Health Check Endpoint (Direct) ──
    app.get('/health', (req, res) => {
        res.status(200).json({
            status: 'operational',
            service: 'archon-billing-gateway',
            timestamp: Math.floor(Date.now() / 1000)
        });
    });

    // ── Auto-Allocating Port Loop ──
    let currentPort = startPort;
    let attempts = 0;

    function tryListen() {
        if (attempts >= maxAttempts) {
            console.error(`\x1b[31m[WEB]\x1b[0m ❌ Failed to start web server after ${maxAttempts} port attempts (tried ${startPort}–${currentPort - 1}).`);
            console.error(`\x1b[31m[WEB]\x1b[0m 💀 Billing gateway is DOWN. No payment webhooks will be received.`);
            return null;
        }

        const server = app.listen(currentPort, () => {
            console.log(`\x1b[32m[WEB]\x1b[0m 🌐 Server bound to port ${currentPort} — Dodo webhook live.`);
        });

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`\x1b[33m[WEB]\x1b[0m ⚠️ Port ${currentPort} occupied, escalating to ${currentPort + 1}...`);
                currentPort++;
                attempts++;
                server.close();
                tryListen();
            } else {
                console.error(`\x1b[31m[WEB]\x1b[0m ❌ Fatal server error:`, err.message);
            }
        });

        return server;
    }

    const serverInstance = tryListen();
    return { app, server: serverInstance, port: currentPort };
/*
}

// ── Boot Web Server (non-blocking, before Discord login) ──
const webServer = startWebServer(process.env.WEB_PORT ? parseInt(process.env.WEB_PORT, 10) : 3000);

// Attach server handle to client for tracking by global gracefulShutdown protocol
if (webServer && webServer.server) {
    client.webServerInstance = webServer.server;
}
*/

// ============================================================
// 📬 PREMIUM NOTIFICATION WORKER — Polls user_premium table
//    Detects newly granted premium users and sends celebratory DM
// ============================================================
const NOTIFICATION_POLL_INTERVAL = 5000; // 5 seconds — near-instant to users

// Track which users we've already notified to prevent duplicate DMs
const notifiedUsers = new Set();

async function pollPremiumNotifications(db) {
    try {
        // Fetch all active premium users who haven't been flagged as notified
        const newPremiumUsers = db.prepare(`
            SELECT user_id, premium_since, tier
            FROM user_premium
            WHERE premium_active = 1
              AND notified = 0
            LIMIT 10
        `).all();

        for (const row of newPremiumUsers) {
            const { user_id, premium_since, tier } = row;

            // Skip if we've already queued this user in the current session
            if (notifiedUsers.has(user_id)) continue;
            notifiedUsers.add(user_id);

            try {
                // Fetch the Discord user
                const user = await client.users.fetch(user_id).catch(() => null);
                if (!user) {
                    console.warn(`[PREMIUM NOTIFY] ⚠️ Could not fetch user ${user_id} — they may not share a server with the bot.`);
                    // Still mark as notified so we don't retry forever
                    db.prepare('UPDATE user_premium SET notified = 1 WHERE user_id = ?').run(user_id);
                    continue;
                }

                // Build the celebratory embed
                const activationDate = new Date(premium_since * 1000).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });

                const premiumEmbed = {
                    color: 0x00fbff,
                    title: '🦅 Welcome to Archon Premium!',
                    description: `**${user.username}**, your premium tier is now **active** across every server you manage.\n\nAll advanced modules have been unlocked and are ready for deployment.`,
                    fields: [
                        {
                            name: '📅 Activated',
                            value: activationDate,
                            inline: true
                        },
                        {
                            name: '💎 Tier',
                            value: tier.replace(/_/g, ' ').toUpperCase(),
                            inline: true
                        },
                        {
                            name: '🧠 Unlocked Modules',
                            value:
                                '• Uncapped Lydia AI Memory\n' +
                                '• Global Multi-Server Log Syncing\n' +
                                '• HTML Ticket Transcript Mirrors\n' +
                                '• Priority Processing Threads',
                            inline: false
                        }
                    ],
                    footer: {
                        text: 'Archon Engine CG-223 • Thank you for your support!'
                    },
                    timestamp: new Date().toISOString()
                };

                // Send the DM
                await user.send({ embeds: [premiumEmbed] }).catch(err => {
                    console.warn(`[PREMIUM NOTIFY] ⚠️ Could not DM user ${user_id} — DMs may be closed.`);
                });

                // Mark as notified in database
                db.prepare('UPDATE user_premium SET notified = 1 WHERE user_id = ?').run(user_id);

                console.log(`[PREMIUM NOTIFY] 🎉 Welcome DM sent to ${user.username} (${user_id}) — Tier: ${tier}`);
            } catch (err) {
                console.error(`[PREMIUM NOTIFY] ❌ Error processing user ${user_id}:`, err.message);
            }
        }
    } catch (err) {
        console.error('[PREMIUM NOTIFY] ❌ Polling error:', err.message);
    }
}

// Start the polling loop once the bot is ready
/*
client.once('ready', () => {
    console.log('[PREMIUM NOTIFY] 📬 Notification worker armed — polling every 5s.');

    // Ensure the notified column exists (self-healing)
    try {
        const columnCheck = client.db.prepare(
            `SELECT COUNT(*) AS count FROM pragma_table_info('user_premium') WHERE name = 'notified'`
        ).get();
        if (columnCheck && columnCheck.count === 0) {
            client.db.exec('ALTER TABLE user_premium ADD COLUMN notified INTEGER DEFAULT 0');
            console.log('[PREMIUM NOTIFY] ✅ Added "notified" column to user_premium.');
        }
    } catch (err) {
        if (!err.message.includes('duplicate column')) {
            console.warn('[PREMIUM NOTIFY] ⚠️ Could not verify/add notified column:', err.message);
        }
    }

    // Start the interval
    setInterval(() => pollPremiumNotifications(client.db), NOTIFICATION_POLL_INTERVAL);
});
*/
// ============================================================
// 📊 LIVE STATS SYNC — Pushes bot stats to Render every 30 seconds
// ============================================================
const STATS_SYNC_URL = process.env.STATS_SYNC_URL || 'https://archon-engine-api.onrender.com/api/stats/sync';
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
            // Remove the logging – no more spam
        });

        req.on('error', (err) => {
            // Only log errors (and only once per minute to avoid error spam)
            const now = Date.now();
            if (now - lastLogTime >= 60000) {
                console.error(`\x1b[31m[STATS SYNC ERROR]\x1b[0m ${err.message}`);
                lastLogTime = now;
            }
        });

        req.write(stats);
        req.end();
    } catch (err) {
        // Silent fail – no console noise
    }
}

// Push immediately, then every 30 seconds
pushLiveStats();
setInterval(pushLiveStats, 30 * 1000);

// ============================================================
// 🔄 RENDER KEEP-ALIVE — Prevents free Render instance from sleeping
// ============================================================
const KEEPALIVE_URL = 'https://archon-engine-api.onrender.com/health';
const KEEPALIVE_INTERVAL = 14 * 60 * 1000; // 14 minutes

setInterval(() => {
    const https = require('https');
    https.get(KEEPALIVE_URL, (res) => {}).on('error', () => {});
}, KEEPALIVE_INTERVAL);

console.log('\x1b[36m[KEEPALIVE]\x1b[0m Render ping scheduled every 14 minutes');

// ── Discord Login ──
client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error('\x1b[31m[LOGIN ERROR]\x1b[0m Failed to connect to Discord:', err.message);
    console.error('\x1b[33m[TIP]\x1b[0m Check your internet connection and token validity.');
});