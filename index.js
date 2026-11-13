require('dotenv').config({ override: true });

// Helper to safely parse JSON without crashing
function parseJSONSafe(str, fallback = {}) {
    try { return JSON.parse(str); } catch { return fallback; }
}

const fs = require('fs');
const path = require('path');
const { Client, Collection, Events, Partials, GatewayIntentBits, EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, REST, Routes, MessageFlags } = require('discord.js');
const em = (k, fb) => { try { return require('./config/emojis')[k] || fb; } catch { return fb; } };
const { t } = require('./lib/i18n');

// ================= MALI-OPTIMIZED ASSET CACHE =================
const AssetCache = require('./plugins/asset-cache.js');
const assetCache = new AssetCache();
assetCache.preload();

// ================= IMPORT LYDIA SETUP FUNCTION =================
const { setupLydia } = require('./plugins/lydia.js');

// ================= AFK SYSTEM IMPORT =================
const { afkUsers } = require('./plugins/afk.js');

// ================= BAMAKO MARKET MANAGER (SAFE FALLBACK) =================
// Market system removed — invest.js uses fixed return rates
let getMarketState = null;
let updateMarketTrend = null;
let TRENDS = {
    STEADY: { name: 'Steady Market', emoji: em('ic_chart', '📊'), color: '#f1c40f' },
    BULL:   { name: 'Bull Market',   emoji: '📈', color: '#2ecc71' },
    BEAR:   { name: 'Bear Market',   emoji: '📉', color: '#e74c3c' },
};

// ================= SELF-HEALING PROTOCOL =================
process.on('unhandledRejection', (reason, promise) => {
    console.error('\x1b[31m[ANTI-CRASH]\x1b[0m Unhandled Rejection:', reason);
    if (!global._isShuttingDown) {
        global._isShuttingDown = true;
        console.log('\x1b[33m[ANTI-CRASH]\x1b[0m Triggering graceful shutdown to prevent data corruption...');
        setTimeout(() => {
            if (typeof gracefulShutdown === 'function') gracefulShutdown('UNHANDLED REJECTION');
            else process.exit(1);
        }, 1000);
    }
});

process.on('uncaughtException', (err, origin) => {
    console.error('\x1b[31m[ANTI-CRASH]\x1b[0m Uncaught Exception:', err.message);
    console.error(err.stack);
    if (!global._isShuttingDown) {
        global._isShuttingDown = true;
        console.log('\x1b[33m[ANTI-CRASH]\x1b[0m Triggering graceful shutdown to prevent data corruption...');
        setTimeout(() => {
            if (typeof gracefulShutdown === 'function') gracefulShutdown('FATAL CRASH');
            else process.exit(1);
        }, 1000);
    }
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

// ================= SNOWFLAKE VALIDATOR (FIX #17) =================
function validateSnowflake(id) {
    if (!id || typeof id !== 'string') return false;
    return /^[0-9]{17,20}$/.test(id);
}

// ================= PM2 STYLE DISPLAY =================
function displayPM2Banner(serverCount = 0) {
    const version = '2.0.0';
    const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    const hour = new Date().getHours();

    let primary, secondary, accent, timeLabel, logoColor;
    if (hour >= 6 && hour < 12) {
        primary   = '\x1b[1;32m';
        secondary = '\x1b[0;32m';
        accent    = '\x1b[1;33m';
        logoColor = '\x1b[38;5;46m';
        timeLabel = '🌅 MORNING';
    } else if (hour >= 12 && hour < 18) {
        primary   = '\x1b[1;33m';
        secondary = '\x1b[0;33m';
        accent    = '\x1b[1;32m';
        logoColor = '\x1b[38;5;220m';
        timeLabel = '☀️  MIDDAY';
    } else {
        primary   = '\x1b[1;31m';
        secondary = '\x1b[0;31m';
        accent    = '\x1b[1;33m';
        logoColor = '\x1b[38;5;196m';
        timeLabel = '🌙 NIGHT';
    }
    const R = '\x1b[0m';
    const B = '\x1b[1m';

    console.log(`\x1b[36m[ARCHON]\x1b[0m v${client.version || '3.1.0'} • BAMAKO_223 🇲🇱 • Online`);
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
        if (['fr', 'en', 'ar', 'bm', 'zh'].includes(serverLang)) return serverLang;
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
    const englishCore = /^(help|daily|profile|rank|level|xp|shop|buy|game|coin|fight|duel|ping|stats|uptime|vote|remind|ticket|report|whois|userinfo|about|alive|status|version|character|filter|hammer|banner|global|transmit|channel|setchannel|cipher|timer|event|credit|transfer|definition|pupper|arena|roulette|image|store|invest|invite|expel|loadout|weapons|lydia|neural|music|musique|owner|archive|agent|motivation|inspire|meta|reminder|server|configure|social|trivia|culture|questions|translation|weather|temperature|user|serial|modai|intel|diffusion|hacker|neuralhacker|specialisation|registre|classement|shutdown|shut|lent)$/i;
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
    // Command language resolution: setlang > slash locale > English.
    // The heuristic below is kept only for free-text (AFK/level-up messages).
    try { return require('./lib/pick-lang').pickLang(client, guildId, null); }
    catch { return 'en'; }
};
// The language a member chose with /mylang, or null. A reply meant for that one person uses it on Auto servers and in DMs.
const memberChoice = (userId, guildId = 'DM') => { try { return require('./lib/member-lang').get(userId, guildId); } catch { return null; } };
client.calculateLevel = calculateLevel;
client.formatNumber = formatNumber;

console.log(`${green}[LANGUAGE]${reset} Universal pattern-based detection initialized`);

// --- SQLITE DATABASE ---
function parseEmoji(str) {
    if (!str) return undefined;
    const m = String(str).match(/<(a?):([^:]+):(\d+)>/);
    if (!m) return str;
    return { animated: !!m[1], name: m[2], id: m[3] };
}

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

    discord_users: `CREATE TABLE IF NOT EXISTS discord_users (
        id TEXT PRIMARY KEY,
        username TEXT,
        avatar TEXT,
        last_login INTEGER DEFAULT (strftime('%s', 'now')),
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
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
    
    clan_wars: `CREATE TABLE IF NOT EXISTS clan_wars (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        opponent TEXT NOT NULL,
        result TEXT NOT NULL,
        score TEXT,
        mode TEXT,
        note TEXT,
        recorded_by TEXT NOT NULL,
        played_at INTEGER DEFAULT (strftime('%s','now')),
        created_at INTEGER DEFAULT (strftime('%s','now'))
    )`,

    member_builds: `CREATE TABLE IF NOT EXISTS member_builds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        weapon TEXT NOT NULL,
        attachments TEXT,
        image_url TEXT,
        note TEXT,
        created_at INTEGER DEFAULT (strftime('%s','now')),
        updated_at INTEGER DEFAULT (strftime('%s','now'))
    )`,

    scrims: `CREATE TABLE IF NOT EXISTS scrims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        message_id TEXT,
        created_by TEXT NOT NULL,
        title TEXT,
        note TEXT,
        scheduled_at INTEGER NOT NULL,
        reminded INTEGER DEFAULT 0,
        status TEXT DEFAULT 'open',
        created_at INTEGER DEFAULT (strftime('%s','now'))
    )`,

    scrim_signups: `CREATE TABLE IF NOT EXISTS scrim_signups (
        scrim_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL,
        signed_at INTEGER DEFAULT (strftime('%s','now')),
        PRIMARY KEY (scrim_id, user_id)
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
    
    premium_sessions: `CREATE TABLE IF NOT EXISTS premium_sessions (
        session_id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        created_at INTEGER NOT NULL
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
    )`,
    auto_replies: `CREATE TABLE IF NOT EXISTS auto_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT,
        keyword TEXT NOT NULL COLLATE NOCASE,
        response TEXT NOT NULL,
        embed_title TEXT,
        embed_color TEXT DEFAULT '0x00f0ff',
        created_by TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        trigger_count INTEGER DEFAULT 0,
        UNIQUE(guild_id, channel_id, keyword)
    )`
};

for (const [tableName, createSQL] of Object.entries(requiredTables)) {
    try { 
        db.exec(createSQL); 
    } catch (err) {
        console.error(`${red}[TABLE ERROR]${reset} ${tableName}:`, err.message);
    }
}

// ================= REPLIES THAT STILL ARRIVE =================
// Before every other listener: where ARCHON may not read the history, message.reply falls back to a plain message (lib/replyGuard).
client.prependListener('messageCreate', (message) => {
    if (message?.guild && !message.author?.bot) require('./lib/replyGuard').guard(message);
});

// ================= AUTO-REPLY MESSAGE LISTENER =================
// ================= MESSAGE CREATE HANDLER =================
require('./lib/handlers/message')(client, db);

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
        // roles given at levels 5 to 25 (/leveling setrole): these columns were missing, so level rewards never worked
        { name: 'level_5_role', type: 'TEXT' },
        { name: 'level_10_role', type: 'TEXT' },
        { name: 'level_15_role', type: 'TEXT' },
        { name: 'level_20_role', type: 'TEXT' },
        { name: 'level_25_role', type: 'TEXT' },
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

// Two columns existed for the level-up channel; the bot only posts to levelup_channel. A channel saved in the other one is carried over once.
try {
    const n = db.prepare("UPDATE server_settings SET levelup_channel = level_channel WHERE (levelup_channel IS NULL OR levelup_channel = '') AND level_channel IS NOT NULL AND level_channel != ''").run().changes;
    if (n) console.log(`[SETTINGS] Level-up channel carried over for ${n} server(s)`);
} catch (e) {}

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
// ================= DATABASE AUTO-REPAIR =================
require('./lib/core/database')(db, { green, reset, yellow });


// ================= SERVER SETTINGS UTILITY =================
const DEFAULT_SETTINGS = { prefix: PREFIX, welcomeChannel: null, logChannel: null, dailyChannel: null, shopChannel: null };

// ================= SERVER SETTINGS =================
const settingsManager = require('./lib/core/settings')(client, db, DEFAULT_SETTINGS);
const getServerSettings = settingsManager.getServerSettings;
const updateServerSetting = settingsManager.updateServerSetting;

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

// ================= UTILS =================
const utils = require('./lib/core/utils')(client);
const checkCooldown = utils.checkCooldown;
const requiredMemberPerms = utils.requiredMemberPerms;

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
 const cachedIds = client.guilds?.cache ? [...client.guilds.cache.keys()] : [];

 try {
 // ── Orphan guild cleanup (all guild-scoped tables) ──
 let orphanTotal = 0;
 if (cachedIds.length > 0) {
 const placeholders = cachedIds.map(() => '?').join(',');
 const orphanTables = [
 'users', 'warnings', 'moderation_logs', 'tickets',
 'ticket_counters', 'auto_replies', 'lydia_conversations',
 'lydia_introductions', 'lydia_agents', 'auto_backup_settings',
 'reaction_panels', 'shop_items', 'server_economy_settings',
 'server_command_settings', 'tiktok_notifications',
 'birthday', 'birthdays', 'daily_reminders',
 'music_history', 'member_joins', 'group_settings'
 ];
 db.transaction(() => {
 for (const table of orphanTables) {
 try {
 const r = db.prepare(
 `DELETE FROM ${table} WHERE guild_id NOT IN (${placeholders})`
 ).run(...cachedIds);
 orphanTotal += r.changes;
 } catch (e) {
 // table may not have guild_id — skip silently
 }
 }
 })();
 }

 // ── Time-based cleanup ──
 const thirtyDaysAgo = now - (30 * 86400);
 const sevenDaysAgo = now - (7 * 86400);
 const ninetyDaysAgo = now - (90 * 86400);

 let purgeStats = {};
 db.transaction(() => {
 purgeStats.lydia = db.prepare("DELETE FROM lydia_conversations WHERE timestamp < ?").run(thirtyDaysAgo).changes;
 purgeStats.modLogs = db.prepare("DELETE FROM moderation_logs WHERE timestamp < ?").run(thirtyDaysAgo).changes;
 purgeStats.reminder = db.prepare("DELETE FROM reminders WHERE status != 'pending' AND execute_at < ?").run(sevenDaysAgo).changes;
 purgeStats.warnings = db.prepare("UPDATE warnings SET active = 0 WHERE expires_at < ? AND active = 1").run(now).changes;
 purgeStats.premSess = db.prepare("DELETE FROM premium_sessions WHERE created_at < ?").run(thirtyDaysAgo).changes;
 purgeStats.premCode = db.prepare("DELETE FROM premium_codes WHERE used = 1 AND used_at < ?").run(thirtyDaysAgo).changes;
 })();

 // ── Ghost guild purge (reads cache — outside transaction) ──
 let ghostPurge = 0;
 const ghostRows = db.prepare(
 "SELECT guild_id FROM global_server_stats WHERE guild_id != 'DM' AND last_active < ?"
 ).all(ninetyDaysAgo);
 for (const row of ghostRows) {
 if (!cachedIds.includes(row.guild_id)) {
 db.prepare("DELETE FROM global_server_stats WHERE guild_id = ?").run(row.guild_id);
 ghostPurge++;
 }
 }

 console.log(
 `${green}[PURGE]${reset} Orphans: ${orphanTotal} rows | ` +
 `AI msgs: ${purgeStats.lydia} | Mod logs: ${purgeStats.modLogs} | ` +
 `Reminders: ${purgeStats.reminder} | Ghost guilds: ${ghostPurge} | ` +
 `Premium sessions: ${purgeStats.premSess} | Codes: ${purgeStats.premCode}`
 );

 console.log(`${cyan}[PURGE]${reset} Compacting...`);
 db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
 db.exec("VACUUM;");

 const dbSize = (fs.statSync(path.join(dataDir, 'database.sqlite')).size / 1024 / 1024).toFixed(2);
 console.log(`${green}[PURGE]${reset} Complete. DB: ${dbSize} MB`);

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

// Same counter as rateLimit(), but says how long to wait: 0 when the action may go ahead (and is counted),
// otherwise the seconds until the oldest counted action leaves the window. The dashboard shows that as a countdown.
function rateWait(key, maxEvents, windowMs) {
    const now = Date.now();
    const recent = (eventRateLimits.get(key) || []).filter((time) => now - time < windowMs);
    if (recent.length >= maxEvents) {
        eventRateLimits.set(key, recent);
        return Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000));
    }
    recent.push(now);
    eventRateLimits.set(key, recent);
    return 0;
}
client.rateWait = rateWait;

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
try { require('./lib/prices').init(db); } catch (e) { console.error('[PRICES]', e.message); }
// The main server's roles, channels and ticket settings used to live only in .env. Copied once into its own
// settings (only where nothing is saved yet), so they can be changed from the dashboard and the .env lines removed.
try {
    const gid = process.env.GUILD_ID;
    const done = db.prepare("SELECT value FROM bot_meta WHERE key = 'env_settings_moved_v2'").get();
    if (gid && !done) {
        const MOVE = {
            join_role_id: 'AUTO_ROLE_ID', investor_role: 'INVESTOR_ROLE_ID', quiz_master_role: 'QUIZ_MASTER_ROLE_ID',
            duelist_role: 'DUELIST_ROLE_ID', gamer_role: 'GAMER_ROLE_ID', mute_role_id: 'MUTE_ROLE_ID',
            daily_initiate_role: 'DAILY_INITIATE_ROLE_ID', daily_warrior_role: 'DAILY_WARRIOR_ROLE_ID',
            daily_champion_role: 'DAILY_CHAMPION_ROLE_ID', daily_legend_role: 'DAILY_LEGEND_ROLE_ID',
            shop_channel: 'SHOP_CHANNEL_ID', updates_channel: 'UPDATES_CHANNEL_ID',
            ticket_category: 'TICKET_CATEGORY_ID', ticket_staff_role: 'TICKET_STAFF_ROLE_ID',
            ticket_transcript_channel: 'TICKET_TRANSCRIPT_CHANNEL_ID', ticket_panel_channel: 'TICKET_PANEL_CHANNEL_ID',
            ticket_log_channel: 'TICKET_LOG_CHANNEL_ID', ticket_auto_close_hours: 'TICKET_AUTO_CLOSE_HOURS',
            ticket_limit_per_user: 'TICKET_LIMIT_PER_USER',
            // v2: the main server's channels
            welcome_channel: 'WELCOME_CHANNEL_ID', goodbye_channel: 'GOODBYE_CHANNEL_ID', log_channel: 'LOG_CHANNEL_ID',
            rules_channel: 'RULES_CHANNEL_ID', general_channel: 'GENERAL_CHANNEL_ID', daily_channel: 'DAILY_CHANNEL_ID',
            market_channel: 'MARKET_CHANNEL_ID', mod_log_channel: 'MOD_LOG_CHANNEL_ID', gift_channel: 'GIFT_CHANNEL_ID',
            levelup_channel: 'LEVEL_CHANNEL_ID',
        };
        db.prepare('INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)').run(gid);
        const cols = new Set(db.prepare('PRAGMA table_info(server_settings)').all().map((c) => c.name));
        let moved = 0;
        for (const [col, key] of Object.entries(MOVE)) {
            const v = String(process.env[key] || '').trim();
            if (!v || !cols.has(col)) continue;
            moved += db.prepare(`UPDATE server_settings SET ${col} = ? WHERE guild_id = ? AND (${col} IS NULL OR ${col} = '')`).run(v, gid).changes;
        }
        db.prepare("INSERT OR REPLACE INTO bot_meta (key, value) VALUES ('env_settings_moved_v2', ?)").run(String(Date.now()));
        console.log(`[SETTINGS] Copied ${moved} main-server setting(s) from .env into the database: those .env lines can now be removed`);
    }
} catch (e) { console.error('[SETTINGS] env copy:', e.message); }

// ================= PER-SERVER ECONOMY ISOLATION =================
// All credit operations are strictly scoped to a guildId.
// In DMs, guildId falls back to 'DM' so the user's balance is preserved.

// The balance to start from. Batched user writes wait up to 30 s in memory before they reach the database, so while
// one is waiting the newest balance is in memory. Starting from the database then lost credits: a /claim followed by
// any payout within 30 s, or a payout to someone who had just chatted (the waiting write put the old balance back).
function liveUser(userId, guildId) {
    const key = `${userId}:${guildId}`;
    const pending = client.pendingUserUpdates?.get(key);
    if (pending) return client.userDataCache?.get(key) ?? pending;
    return getUser(userId, guildId) || null;
}
const liveCredits = (userId, guildId) => Math.max(0, Number(liveUser(userId, guildId)?.credits) || 0);
// Memory follows the database: the cache, and the waiting write if there is one
function rememberCredits(userId, guildId, value) {
    const key = `${userId}:${guildId}`;
    const cached = client.userDataCache?.get(key);
    if (cached) { cached.credits = value; cached._lastAccess = Date.now(); }
    const pending = client.pendingUserUpdates?.get(key);
    if (pending) pending.credits = value;
}
const saveCredits = (userId, guildId, value) => db.prepare('UPDATE users SET credits = ? WHERE id = ? AND guild_id = ?').run(value, userId, guildId);

// Add credits to a member's balance on one server
function addCredits(userId, guildId, amount) {
    if (!guildId) guildId = 'DM';
    const safeAmount = Math.max(0, Math.floor(amount || 0));
    if (safeAmount === 0) return { ok: true, previous: 0, current: 0, added: 0 };

    try {
        getOrCreateUser(userId, guildId, 'Unknown');
        const previous = liveCredits(userId, guildId);
        const current = previous + safeAmount;
        saveCredits(userId, guildId, current);
        rememberCredits(userId, guildId, current);
        return { ok: true, previous, current, added: safeAmount };
    } catch (err) {
        console.error(`${red}[ECONOMY]${reset} addCredits failed for ${userId}@${guildId}:`, err.message);
        return { ok: false, error: err.message };
    }
}

// Remove credits from a member's balance on one server (refused when they don't have enough)
function removeCredits(userId, guildId, amount) {
    if (!guildId) guildId = 'DM';
    const safeAmount = Math.max(0, Math.floor(amount || 0));
    if (safeAmount === 0) return { ok: true, previous: 0, current: 0, removed: 0 };

    try {
        getOrCreateUser(userId, guildId, 'Unknown');
        const previous = liveCredits(userId, guildId);
        if (previous < safeAmount) {
            return { ok: false, error: 'INSUFFICIENT_FUNDS', previous, required: safeAmount };
        }
        const current = previous - safeAmount;
        saveCredits(userId, guildId, current);
        rememberCredits(userId, guildId, current);
        return { ok: true, previous, current, removed: safeAmount };
    } catch (err) {
        console.error(`${red}[ECONOMY]${reset} removeCredits failed for ${userId}@${guildId}:`, err.message);
        return { ok: false, error: err.message };
    }
}

// Move credits from one member to another on one server: both balances change together or not at all,
// and the transfer is written to the transfers table (with the server, so each server has its own history).
let _transfersReady = false;
function transferCredits(fromId, toId, guildId, amount, names = {}) {
    if (!guildId) guildId = 'DM';
    const n = Math.floor(Number(amount) || 0);
    if (n <= 0) return { ok: false, error: 'INVALID_AMOUNT' };
    if (String(fromId) === String(toId)) return { ok: false, error: 'SAME_USER' };
    try {
        if (!_transfersReady) {
            _transfersReady = true;
            try { db.prepare('ALTER TABLE transfers ADD COLUMN guild_id TEXT').run(); } catch (e) { /* the column is already there */ }
        }
        getOrCreateUser(fromId, guildId, names.from || 'Unknown');
        getOrCreateUser(toId, guildId, names.to || 'Unknown');
        const fromBefore = liveCredits(fromId, guildId);
        if (fromBefore < n) return { ok: false, error: 'INSUFFICIENT_FUNDS', previous: fromBefore, required: n };
        const toBefore = liveCredits(toId, guildId);
        db.transaction(() => {
            saveCredits(fromId, guildId, fromBefore - n);
            saveCredits(toId, guildId, toBefore + n);
            db.prepare('INSERT INTO transfers (sender_id, receiver_id, amount, timestamp, platform, guild_id) VALUES (?, ?, ?, ?, ?, ?)')
                .run(fromId, toId, n, Date.now(), names.platform || 'discord', guildId);
        })();
        rememberCredits(fromId, guildId, fromBefore - n);
        rememberCredits(toId, guildId, toBefore + n);
        return { ok: true, amount: n, from: { previous: fromBefore, current: fromBefore - n }, to: { previous: toBefore, current: toBefore + n } };
    } catch (err) {
        console.error(`${red}[ECONOMY]${reset} transferCredits failed ${fromId} -> ${toId}@${guildId}:`, err.message);
        return { ok: false, error: err.message };
    }
}

client.addCredits = addCredits;
client.removeCredits = removeCredits;
client.transferCredits = transferCredits;
client.liveCredits = (userId, guildId) => liveCredits(userId, guildId || 'DM');
client.liveUser = (userId, guildId) => liveUser(userId, guildId || 'DM');

// Change a member's numbers the safe way (a purchase, a sale, a reward): `add` is applied to the newest values,
// `set` replaces them (a function gets the row after `add`). The database, the cache and any waiting write all
// receive the result, so nothing is put back 30 seconds later. Credits can't go below zero: the change is refused.
const USER_NUMBERS = new Set(['credits', 'xp', 'level', 'games_played', 'games_won', 'total_winnings', 'streak_days',
    'streak_protections', 'total_messages', 'highest_streak', 'total_dailies', 'last_daily']);
function changeUser(userId, guildId, { add = {}, set = {} } = {}, username = 'Unknown') {
    if (!guildId) guildId = 'DM';
    try {
        getOrCreateUser(userId, guildId, username);
        const base = liveUser(userId, guildId) || {};
        const next = {};
        for (const [col, n] of Object.entries(add)) {
            if (!USER_NUMBERS.has(col)) throw new Error(`"${col}" can't be changed this way`);
            if (Number(n)) next[col] = (Number(base[col]) || 0) + Math.trunc(Number(n));
        }
        for (const [col, v] of Object.entries(set)) {
            if (!USER_NUMBERS.has(col)) throw new Error(`"${col}" can't be changed this way`);
            next[col] = typeof v === 'function' ? v({ ...base, ...next }) : v;
        }
        if ('credits' in next && next.credits < 0) return { ok: false, error: 'INSUFFICIENT_FUNDS', previous: Number(base.credits) || 0 };
        const cols = Object.keys(next);
        if (cols.length) {
            db.prepare(`UPDATE users SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ? AND guild_id = ?`).run(...cols.map((c) => next[c]), userId, guildId);
            const key = `${userId}:${guildId}`;
            const cached = client.userDataCache?.get(key);
            if (cached) { Object.assign(cached, next); cached._lastAccess = Date.now(); }
            const pending = client.pendingUserUpdates?.get(key);
            if (pending) Object.assign(pending, next);
        }
        return { ok: true, previous: base, user: { ...base, ...next } };
    } catch (err) {
        console.error(`${red}[ECONOMY]${reset} changeUser failed for ${userId}@${guildId}:`, err.message);
        return { ok: false, error: err.message };
    }
}
client.changeUser = changeUser;

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
        
        // On ne crée plus le rôle de force. Si l'admin ne l'a pas configuré, on s'arrête là.
        if (!role) {
            return { ok: false, why: 'role_not_found' };
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

    // No cached copy, but a write is still waiting: that one is newer than the database (reading the database here
    // gave the old numbers, and the next save built on them)
    const waiting = client.pendingUserUpdates?.get(compositeKey);
    if (waiting) {
        cacheUserData(userId, guildId, waiting);
        return client.userDataCache.get(compositeKey);
    }

    const dbUser = getUser(userId, guildId);
    if (dbUser) {
        cacheUserData(userId, guildId, dbUser);
    }
    return dbUser;
}

function queueUserUpdate(userId, guildId, updateData) {
    const compositeKey = `${userId}:${guildId}`;
    let fullUserData = client.userDataCache.get(compositeKey) || client.pendingUserUpdates.get(compositeKey);
    
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
// The statement that saves a batched user row (the 30-second flush and the flush at shutdown both use it).
// Only the columns listed here are saved. The row itself stays, so the columns this save doesn't carry (active badge,
// join date, last reminder...) keep their values; "INSERT OR REPLACE" rebuilt the whole row and reset them on every save.
const USERS_SAVE_SQL = `
    INSERT INTO users (
    id, guild_id, username, xp, level, total_messages, last_xp_gain,
    games_played, games_won, total_winnings, gaming, credits,
    streak_days, last_daily, total_dailies, highest_streak, streak_protections, avatar
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id, guild_id) DO UPDATE SET
    username = excluded.username, xp = excluded.xp, level = excluded.level,
    total_messages = excluded.total_messages, last_xp_gain = excluded.last_xp_gain,
    games_played = excluded.games_played, games_won = excluded.games_won,
    total_winnings = excluded.total_winnings, gaming = excluded.gaming, credits = excluded.credits,
    streak_days = excluded.streak_days, last_daily = excluded.last_daily,
    total_dailies = excluded.total_dailies, highest_streak = excluded.highest_streak,
    streak_protections = excluded.streak_protections, avatar = COALESCE(excluded.avatar, users.avatar)
`;
function prepareUserSave() {
    try { return db.prepare(USERS_SAVE_SQL); }
    catch (e) {
        // A users table without the (id, guild_id) key can't take the statement above: save the old way rather than not at all
        console.error(`${red}[DB BATCH]${reset} upsert not possible (${e.message}), saving with INSERT OR REPLACE`);
        return db.prepare(`
            INSERT OR REPLACE INTO users (
                id, guild_id, username, xp, level, total_messages, last_xp_gain,
                games_played, games_won, total_winnings, gaming, credits,
                streak_days, last_daily, total_dailies, highest_streak, streak_protections, avatar
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
    }
}

// Flush pending user updates to the database
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
    
    try {
        if (WRITE_STRATEGY.USE_TRANSACTIONS) {
            client.safeDbWrite(() => {
                const updateStmt = prepareUserSave();
                
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
                            userData.streak_protections ?? 0,  // 17
                            userData.avatar || null               // 18
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
        
        // ✅ SAFE ROLLBACK: Only remove from memory AFTER the database confirms the write
        for (const [compositeKey] of updates) {
            client.pendingUserUpdates.delete(compositeKey);
        }
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

// Maintenance tasks moved to lib/tasks/maintenance.js
require('./lib/tasks/maintenance')(client, db, flushUserUpdates, WRITE_STRATEGY, CACHE_CONFIG);


client.queueUserUpdate = queueUserUpdate;
client.flushUserUpdates = flushUserUpdates;
client.getUserData = getUserData;
client.cacheUserData = cacheUserData;

// ================= EXPANDED SHOP ITEMS =================
client.shopItems = require('./lib/shop-items');

// Hydrate per-locale display strings from lang/*.json (shop.items.<id>)
for (const __item of client.shopItems) {
    for (const __L of ['en', 'fr', 'bm', 'zh', 'ar']) {
        __item[__L] = {
            name: t(`shop.items.${__item.id}.name`, __L),
            desc: t(`shop.items.${__item.id}.desc`, __L),
            perk: t(`shop.items.${__item.id}.perk`, __L)
        };
    }
}

client.getItem = (itemId) => client.shopItems.find(item => item.id === itemId);

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
    // Module sync

    const loadedCommands = [];
    const failedCommands = [];
    client.failedPlugins = failedCommands; // the owner's start-up DM lists them
    const moduleStats = { discord: 0, telegram: 0, total: 0, aliases: 0, slash: 0 };
    
    // ── DISCORD MODULES ──
    for (const file of pluginFiles) {
        try {
            await sleep(50);
            const filePath = path.join(pluginPath, file);
            delete require.cache[require.resolve(filePath)];
            const command = require(filePath);

            if (command.name && (command.run || command.execute)) {
                client.commands.set(command.name, command);
                if (typeof command.init === 'function') {
                    try { await command.init(client, client.db); }
                    catch (e) { console.error('[PLUGIN INIT]', file, e.message); }
                }
                if (command.aliases && Array.isArray(command.aliases)) {
                    command.aliases.forEach(a => {
                        // Two commands sharing a shortcut: the later one wins, as it always did, but now it is said in the log
                        const owner = client.aliases.get(a);
                        if (owner && owner !== command.name) console.warn(`[ALIAS] "${a}" was ${owner}, now ${command.name}`);
                        client.aliases.set(a, command.name);
                    });
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
    const telegramPath = path.join(__dirname, 'telegram', 'plugins');
    // Telegram plugins are not Discord commands (opt-in only)
    if (process.env.LOAD_TELEGRAM_INTO_DISCORD === '1' && fs.existsSync(telegramPath)) {
        const telegramFiles = fs.readdirSync(telegramPath).filter(file => 
            file.endsWith('.js') && file !== 'bridge.js' && file !== 'bot.js'
        );
        
        for (const file of telegramFiles) {
            try {
                await sleep(50);
                const filePath = path.join(telegramPath, file);
                delete require.cache[require.resolve(filePath)];
                const command = require(filePath);

                if (command.name && (command.run || command.handler)) {
                    // Don't overwrite Discord plugins with Telegram ones
                    if (!client.commands.has(command.name)) { command._source = 'telegram'; client.commands.set(command.name, command); }
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
    

    // ── CLEAN BOOT SUMMARY ──
    const _ver = (() => { try { return require('fs').readFileSync('./version.txt','utf8').trim(); } catch(e) { return '?'; } })();
    const _W = 68;
    const _C = '\x1b[38;5;45m', _G = '\x1b[1;32m', _Y = '\x1b[1;33m',
          _R = '\x1b[1;31m', _W2 = '\x1b[1;37m', _X = '\x1b[0m', _P = '\x1b[35m';
    const _line = '═'.repeat(_W);
    const _pad = (str, len) => {
        const clean = str.replace(/\x1b\[[\d;]*m/g, '');
        return str + ' '.repeat(Math.max(0, len - clean.length));
    };
    const _center = (str, len) => {
        const clean = str.replace(/\x1b\[[\d;]*m/g, '');
        const total = Math.max(0, len - clean.length);
        return ' '.repeat(Math.floor(total/2)) + str + ' '.repeat(total - Math.floor(total/2));
    };
    console.log('');
    // Telegram plugins run in the bridge, not the Discord registry — count
    // them from disk so the reported number reflects what exists, not what
    // LOAD_TELEGRAM_INTO_DISCORD happened to import.
    let telegramOnDisk = 0;
    try {
        const tgDir = path.join(__dirname, 'telegram', 'plugins');
        if (fs.existsSync(tgDir)) {
            telegramOnDisk = fs.readdirSync(tgDir).filter(f => f.endsWith('.js')).length;
        }
    } catch (_) {}

    client.moduleStats = { ...moduleStats, telegram: telegramOnDisk };
    const _mods = `${moduleStats.discord} discord / ${client.moduleStats.telegram} telegram`;
    const _slsh = String(moduleStats.slash);
    const _fail = failedCommands.length;
    console.log(`\x1b[36m[NEURAL GRID]\x1b[0m ${_mods} modules • ${_slsh} slash • ${(()=>{try{return client.db.prepare("SELECT COUNT(DISTINCT guild_id) FROM users WHERE guild_id NOT IN ('DM','telegram')").get()["COUNT(DISTINCT guild_id)"]||client.guilds.cache.size}catch(e){return client.guilds.cache.size}})()} servers • ${_fail > 0 ? _fail + ' failures' : 'All systems nominal'}`);

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

// ── MODULE GATE (shared by prefix and slash paths) ──
const MODULE_MAP = {
    economy:    ['daily','balance','credits','shop','transfer','claim','invest','credit','cross-economy','give','deposit','withdraw'],
    leveling:   ['rank','leaderboard','level','xp'],
    tickets:    ['ticket','newticket','closeticket'],
    music:      ['music','play','skip','stop','queue','loop','lyrics','nowplaying','pause','resume','volume'],
    moderation: ['ban','kick','mute','unmute','warn','warnings','clear','slowmode','purge'],
    codm:       ['scrim','scrims','meta','weapon','gun','tier','tierlist','randommeta','codm','pick','arme','build','builds','mybuild','classe','war','wars','clanwar','guerre'],
};
const FLAG_MAP = {
    economy: 'economy_enabled', leveling: 'leveling_enabled',
    tickets: 'tickets_enabled', music: 'music_enabled',
    moderation: 'moderation_enabled', codm: 'codm_enabled',
};
// Returns the module name if blocked, else null.
function getBlockedModule(commandName, settings) {
    if (!settings || !commandName) return null;
    for (const [mod, cmds] of Object.entries(MODULE_MAP)) {
        if (cmds.includes(commandName)) {
            const v = settings[FLAG_MAP[mod]];
            return (v === 0 || v === '0') ? mod : null;
        }
    }
    return null;
}

// VERSION ORIGINALE (avant notre modif)
async function executePluginCommand(command, client, message, args, db, usedCommand, serverSettings, lang = 'en') {
    // ── MODULE GATE ──
    if (serverSettings && command?.name) {
        for (const [module, cmds] of Object.entries(MODULE_MAP)) {
            if (cmds.includes(command.name)) {
                const flag = FLAG_MAP[module];
                if (!Number(serverSettings[flag])) {
                    const reply = message?.reply || message?.editReply;
                    if (reply) {
                        const modName = t('modules.' + module, lang);
                        await reply.call(message, { embeds: [new EmbedBuilder()
                            .setColor('#e67e22')
                            .setDescription(t('moduleDisabled', lang, { module: modName }))
                        ] }).catch(() => {});
                    }
                    return;
                }
                break;
            }
        }
    }
    // ── END MODULE GATE ──
    const argsMap = { client, message, args, db, serverSettings, usedCommand, lang };
    
    let paramOrder;
    if (command.params && Array.isArray(command.params)) {
        paramOrder = command.params;
    } else if (command.run && command.run.length > 0) {
        const defaultParams = ['client', 'message', 'args', 'db', 'serverSettings', 'usedCommand', 'lang'];
        paramOrder = defaultParams.slice(0, command.run.length);
    } else {
        paramOrder = ['client', 'message', 'args', 'db', 'serverSettings', 'usedCommand', 'lang'];
    }
    
    const filteredArgs = paramOrder.map(param => argsMap[param]).filter(arg => arg !== undefined);
    
    if (!command.run) {
        const reply = message?.reply || message?.editReply;
        if (reply) await reply.call(message, { content: (require('./config/emojis').ic_off || '❌') + require('./lib/i18n').t('index.slash_only', require('./lib/botPerms').langOf({ guild: message.guild || interaction.guild, client }) || 'en') }).catch(() => {});
        return;
    }
    const result = await command.run(...filteredArgs);
    // ── Guild activity + stats tracker ──
    try {
        const g = message?.guild;
        if (g && db) {
            db.prepare(`
                UPDATE global_server_stats
                SET last_active = strftime('%s', 'now'),
                    guild_name = ?,
                    total_members = ?
                WHERE guild_id = ?
            `).run(g.name, g.memberCount, g.id);
        }
    } catch (_) {}
    return result;
} // 🌟

// ================= BOOT SEQUENCE =================
client.once(Events.ClientReady, async () => {
    // Re-arm the "verify in time or be kicked" deadlines that were running when the bot stopped
    Promise.resolve(require('./plugins/verify.js').resumeKickTimers?.(client, db)).catch((e) => console.error('[VERIFY] resume failed:', e.message));
    // Raid mode: pick up a raid that was active when the bot stopped
    Promise.resolve(require('./plugins/automod.js').resumeRaids?.(client, db)).catch((e) => console.error('[RAID] resume failed:', e.message));
    // AutoMod: one summary a day for each server owner (21:00 Bamako time)
    try { require('./plugins/automod.js').startDigest?.(client, db); } catch (e) { console.error('[AUTOMOD] digest start failed:', e.message); }
    // The dashboard's "create ticket channels" button used to put custom-emoji codes in channel names, which Discord
    // shows as raw text (<:ic_setup:…> STAFF & SUPPORT, note1564…-・transcript-logs). Those exact names get fixed once.
    setTimeout(async () => {
        let fixed = 0;
        for (const g of client.guilds.cache.values()) {
            for (const ch of g.channels.cache.values()) {
                let name = null;
                if (/^<a?:\w+:\d{15,25}> STAFF & SUPPORT$/.test(ch.name)) name = '🛠️ STAFF & SUPPORT';
                else if (/^note\d{15,25}-・transcript-logs$/.test(ch.name)) name = '📝-・transcript-logs';
                if (!name) continue;
                try { await ch.setName(name, 'Fix a channel name ARCHON created with a raw emoji code'); fixed++; } catch (e) {}
            }
        }
        if (fixed) console.log(`[CHANNELS] Fixed ${fixed} channel name(s) with raw emoji codes`);
    }, 30000).unref?.();
    // Cache missing guild names from DB + bulk stats sync
    setTimeout(async () => {
        try {
            const dbGuilds = client.db.prepare(
                "SELECT DISTINCT guild_id FROM users WHERE guild_id NOT IN ('DM','telegram')"
            ).all().map(r => r.guild_id);
            for (const guildId of dbGuilds) {
                if (!client.guilds.cache.has(guildId)) {
                    const guild = await client.guilds.fetch(guildId).catch(() => null);
                    if (guild) console.log(`[GUILD CACHE] Fetched missing guild: ${guild.name} (${guildId})`);
                }
            }
            // ── Bulk sync all cached guilds (INSERT missing, UPDATE existing) ──
            let synced = 0;
            for (const [, guild] of client.guilds.cache) {
                try {
                    db.prepare(`
                        INSERT INTO global_server_stats (guild_id, guild_name, total_members, last_active)
                        VALUES (?, ?, ?, strftime('%s','now'))
                        ON CONFLICT(guild_id) DO UPDATE SET
                            guild_name = excluded.guild_name,
                            total_members = excluded.total_members
                    `).run(guild.id, guild.name, guild.memberCount);
                    synced++;
                } catch (_) {}
            }
            console.log(`[GUILD SYNC] Synced ${synced} guilds on boot`);
        } catch(e) { console.error('[GUILD CACHE] Error:', e.message); }
    }, 10000);

    // ── Add emoji keys that arrived with an update (never overwrites yours) ──
    try {
        const _path = require('path');
        const _added = require('./lib/emoji-sync')(
            _path.join(__dirname, 'config/emojis.js'),
            _path.join(__dirname, 'config/emojis.example.js'),
            require('./config/emojis')
        );
        if (_added.length) console.log(`[EMOJIS] Added ${_added.length} new keys: ${_added.join(', ')}`);
    } catch (e) { console.error('[EMOJIS] sync failed:', e.message); }

    // ── Dynamic emoji resolver — update emojis.js on disk at boot ──
    try {
        const mainGuild = client.guilds.cache.get(process.env.GUILD_ID)
            || await client.guilds.fetch(process.env.GUILD_ID).catch((err) => { console.error('[EMOJIS] fetch failed:', err.message); return null; });
        if (mainGuild) {
            const guildEmojis = await mainGuild.emojis.fetch();
            const emojiPath = require('path').join(__dirname, 'config/emojis.js');
            let emojiFile = require('fs').readFileSync(emojiPath, 'utf8');
            let updated = 0;

            for (const emoji of guildEmojis.values()) {
                const newStr = emoji.animated
                    ? `<a:${emoji.name}:${emoji.id}>`
                    : `<:${emoji.name}:${emoji.id}>`;
                // Match by name — replace old ID with new one
                const pattern = new RegExp(`(<a?:${emoji.name}:\\d+>)`, 'g');
                const newFile = emojiFile.replace(pattern, newStr);
                if (newFile !== emojiFile) {
                    emojiFile = newFile;
                    updated++;
                }
            }

            if (updated > 0) {
                require('fs').writeFileSync(emojiPath, emojiFile, 'utf8');
                // Mutate the live exported object so all plugins see fresh IDs instantly
                const liveEmojis = require('./config/emojis');
                for (const emoji of guildEmojis.values()) {
                    const key = Object.keys(liveEmojis).find(k =>
                        liveEmojis[k].includes(`:${emoji.name}:`)
                    );
                    if (key) {
                        liveEmojis[key] = emoji.animated
                            ? `<a:${emoji.name}:${emoji.id}>`
                            : `<:${emoji.name}:${emoji.id}>`;
                    }
                }
                console.log(`[EMOJIS] ✅ Auto-updated ${updated} emoji IDs on disk + live memory`);
            } else {
                console.log('[EMOJIS] All emoji IDs up to date');
            }
        }
    } catch(e) {
        console.error('[EMOJIS] Dynamic resolve failed:', e.message, e.stack);
    }
    // Which custom emojis ARCHON can really use: icons, buttons and menus fall back to plain emojis for the others
    await require('./lib/emoji-check').load(client);
    const isPM2 = process.env.pm_id !== undefined || process.env.name === 'Architect-CG223';
    
    if (!isPM2) {
        console.clear();
    }

    displayPM2Banner();

    require('./lib/invite-tracker').install(client);
    await client.loadPlugins();

    // Update posts: one per version, from config/changelog.json (lib/changelog.js announce, started below).
    // The old per-deploy broadcast is gone: it posted AI summaries of commit titles almost daily, on top of the
    // version post, and commit titles can describe security fixes.

    // ── Update notice: tell the owner when a newer version is on GitHub ──
    try {
        const _upd = require('./lib/updater');
        const _quiet = (e) => console.error('[UPDATE]', e.message);
        setTimeout(() => _upd.announceAfterRestart(client).catch(_quiet), 20000);
        setTimeout(() => _upd.announceAfterRestart(client).catch(_quiet), 60000);
        setTimeout(() => _upd.checkAndNotify(client, db).catch(_quiet), 90000);
        setInterval(() => _upd.checkAndNotify(client, db).catch(_quiet), 6 * 60 * 60 * 1000);
    } catch (e) { console.error('[UPDATE] notifier failed:', e.message); }

    // ── TELEGRAM INIT ──
    try {
        const telegramBridge = require('./telegram/bridge.js');
        client.telegramBridge = telegramBridge.initialize(client);
        const telegramBot = require('./telegram/bot.js');
        await telegramBot.initialize(client);
        console.log('[TELEGRAM] Bot engine started!');
    } catch(e) {
        console.error('[TELEGRAM] Bot init failed:', e.message);
    }



// ================= KAZAGUMO initialized before login (see below) =================

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
    } catch (err) {
        console.log(`${yellow}[HEAP]${reset} Not loaded: ${err.message}`);
    }

    // ================= INITIALIZE LYDIA AI =================
    let lydiaModule;
    try {
        lydiaModule = require('./plugins/lydia.js');
        setupLydia(client, db);
        // Register lydia in client.commands so slash command registration picks it up
        if (lydiaModule.name && lydiaModule.run) {
            // Real lydia always owns the name — overwrites any bridge stub
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

    // ================= RELEASE NOTES =================
    // config/changelog.json is the one source (/changelog, Lydia, /update). When a new version boots, it is posted once
    // in every server that picked an updates channel. The old 400-line boot report (data/changelog.md) is gone:
    // its statuses were written by hand and never checked, and the owner's boot DM already covers the boot.
    try { require('./plugins/votesync.js').startReminders(client); } catch (e) { console.log(`[VOTE REMIND] ${e.message}`); }
    setTimeout(() => require('./lib/changelog').announce(client).catch((e) => console.log(`${yellow}[CHANGELOG]${reset} ${e.message}`)), 45000);

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

    // Server-only commands are not offered in DMs at all (Discord hides them there), instead of failing once picked
    const GUILD_ONLY_CATS = new Set(['MODERATION', 'ADMIN', 'ECONOMY', 'PROFILE', 'GAMING', 'MUSIC']);
    const serverOnly = (command, json) => command.guildOnly === true || GUILD_ONLY_CATS.has(String(command.category || '').toUpperCase()) || !!json.default_member_permissions;
    let serverOnlyCount = 0;

    client.commands.forEach(command => {
        if (!command.data) return;
        
        try {
            if (typeof command.data.toJSON === 'function') {
                const json = command.data.toJSON();
                if (serverOnly(command, json) && !json.contexts) { json.contexts = [0]; delete json.dm_permission; serverOnlyCount++; }
                commands.push(json);
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

    // [LYDIA-FIX] Guarantee lydia is in the slash payload
    try {
        const lm = require('./plugins/lydia.js');
        if (lm.data && !commands.some(c => c.name === 'lydia')) {
            commands.push(lm.data.toJSON());
            slashRegistered++;
            console.log(`${cyan}[SLASH]${reset} lydia injected into payload`);
        }
    } catch(e) { console.log(`${yellow}[SLASH WARN]${reset} lydia inject: ${e.message}`); }

    console.log(`${cyan}[SLASH]${reset} ${slashRegistered} commands prepared (${serverOnlyCount} server-only), ${slashSkipped} skipped`);

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
// Populate the slash-command cache so </name:id> mentions render as clickable pills
try {
    await client.application.commands.fetch();
    require('./lib/cmd').warm(client);
    console.log(`[SLASH] Cache warmed: ${client.application.commands.cache.size} commands`);
} catch (e) { console.error('[SLASH] cache warm failed:', e.message); }
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

    /* startBatchWriteInterval() - moved to maintenance */;
    /* startReminderHeartbeat() - moved to maintenance */;
    /* startCacheJanitor() - moved to maintenance */;

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
                const guildName = guild?.name || 'ARCHON CG-223';
                const guildIcon = guild?.iconURL({ size: 128 }) || client.user.displayAvatarURL();

                let marketMultiplier = 1.0, marketTrend = 'STEADY', trendEmoji = em('ic_chart', '📊');
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
                else if (streakDays >= 30)   { streakStatus = '  ELITE';     streakEmoji = em('ic_shield', '🛡️'); streakColor = '#9b59b6'; }
                else if (streakDays >= 7)    { streakStatus = '  VETERAN';   streakEmoji = '⚔️'; streakColor = '#3498db'; }
                else if (streakDays >= 3)    { streakStatus = '  ACTIVE';    streakEmoji = em('ic_streak', '🔥'); streakColor = '#2ecc71'; }
                else                         { streakStatus = '  INITIATE';  streakEmoji = '🌱'; streakColor = '#95a5a6'; }

                const bamakoHour = new Date().getUTCHours();
                let greeting, greetingEmoji;
                if (bamakoHour < 6)       { greeting = 'greeting_night';     greetingEmoji = '🌙'; }
                else if (bamakoHour < 12) { greeting = 'greeting_morning';   greetingEmoji = '🌅'; }
                else if (bamakoHour < 17) { greeting = 'greeting_afternoon'; greetingEmoji = '☀️'; }
                else if (bamakoHour < 20) { greeting = 'greeting_evening';   greetingEmoji = '🌆'; }
                else                      { greeting = 'greeting_night';     greetingEmoji = '🌙'; }

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

                // ── i18n + warmer copy + streak progress ──
                const _E = require('./config/emojis');
                const _v2 = require('./lib/games/v2');
                const _ui = require('./lib/games/ui');
                const _lang = (() => {
                    try { return require('./lib/pick-lang').pickLang(client, user.guild_id, null, user.id); }
                    catch { return 'en'; }
                })();
                const _S = (k, v) => it('supreme.' + k, _lang, v);
                greeting = _S(greeting);  // greeting holds a key, now resolved to a translated word

                // Streak milestone ladder — names come from i18n
                const _milestones = [
                    { days: 3,   key: 'milestone_3',   emoji: em('ic_streak', '🔥') },
                    { days: 7,   key: 'milestone_7',   emoji: '⚔️' },
                    { days: 30,  key: 'milestone_30',  emoji: em('ic_shield', '🛡️') },
                    { days: 100, key: 'milestone_100', emoji: require('./config/emojis').premium || '💎' },
                    { days: 365, key: 'milestone_365', emoji: '👑' },
                ];
                let _curIdx = -1;
                for (let _i = 0; _i < _milestones.length; _i++) if (streakDays >= _milestones[_i].days) _curIdx = _i;
                const _cur = _curIdx >= 0 ? _milestones[_curIdx] : null;
                const _nxt = _milestones.find(m => streakDays < m.days) || null;
                let _streakLine;
                if (_nxt) {
                    const floor = _cur ? _cur.days : 0;
                    const span = _nxt.days - floor;
                    const pct = Math.round(((streakDays - floor) / span) * 100);
                    const bar = _ui.progressBar(streakDays - floor, span, 10);
                    const done = _milestones.filter(m => streakDays >= m.days).map(m => `✓${m.days}d`).join(' · ');
                    const rest = _milestones.filter(m => streakDays < m.days).map(m => `${m.emoji}${m.days}d`).join(' · ');
                    const nextName = _S(_nxt.key);
                    _streakLine = `\`${bar}\` **${pct}%** → ${_nxt.emoji} **${nextName}** (${_nxt.days - streakDays}d left)\n-# ${done ? done + ' · ' : ''}${rest}`;
                } else {
                    _streakLine = _S('streak_max');
                }

                // Availability copy
                let _ready;
                if (hoursSinceReady < 1) _ready = _S('ready_just');
                else if (hoursSinceReady < 3) _ready = _S('ready_recent', { h: hoursSinceReady, m: minutesSinceReady });
                else if (hoursSinceReady < 6) _ready = _S('ready_soon', { h: hoursSinceReady });
                else if (hoursSinceReady < 12) _ready = _S('ready_overdue', { h: hoursSinceReady });
                else _ready = _S('ready_late', { h: hoursSinceReady });

                const _profileUrl = `https://bamako-steel-dev.xyz/user/${user.id}?guild=${guild?.id || ''}`;

                // Warm description by urgency
                const _warm = hoursSinceReady < 3
                    ? _S('warm_fresh', { guild: guildName })
                    : hoursSinceReady < 12
                    ? _S('warm_waiting', { guild: guildName })
                    : _S('warm_overdue', { guild: guildName });

                const _statusName = _S(_cur ? _cur.key : 'milestone_3');
                const _streakLabel = _S(streakDays === 1 ? 'streak_days_one' : 'streak_days_many', { n: streakDays });

                const _card = _v2.card(parseInt(streakColor.replace('#',''), 16), [
                    { text: `*${_E.eagle || '🦅'} ARCHON CG-223 · ${_S('header')}*` },
                    { text: `## ${greetingEmoji} ${greeting}, ${discordUser.username}` },
                    { text: `-# ${_warm}` },
                    { rule: true },
                    { text: `⏰ **${_ready}**` },
                    { text: `${streakEmoji} **${_statusName}** · **${_streakLabel}**\n${_streakLine}` },
                    { rule: true },
                    { text: `${_E.coins || '🪙'} **${_S('estimated_label', { n: estimatedReward.toLocaleString() })}**` },
                    { text: `-# ${_S('breakdown', { base: baseReward, streak: streakBonus, level: levelBonus, trend: trendEmoji, mult: marketMultiplier.toFixed(2) })}` },
                    { rule: true },
                    { text: `**${_S('stats_label')}**\n${_S('stats_line1', { level: user.level || 1, msgs: (user.total_messages || 0).toLocaleString() })}\n${_S('stats_line2', { best: user.highest_streak || 0, shields: user.streak_protections || 0, claims: user.total_dailies || 0 })}` },
                    { rule: true },
                    { text: `${em('ic_pin', '📌')} ${_S('claim_hint', { prefix, guild: guildName })}` },
                    { text: `-# ${_E.website || '🌐'} [${_S('profile_link')}](${_profileUrl}) · BAMAKO-223 · v${client.version || '3.1.1'}` },
                ]);

                const actionRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder().setLabel(_S('btn_claim', { guild: guildName.substring(0, 20) })).setStyle(ButtonStyle.Link).setURL(guild ? `https://discord.com/channels/${guild.id}/${settings?.dailyChannel || guild.systemChannelId || guild.id}` : 'https://discord.com').setEmoji(parseEmoji(_E.eagle) || '🏛️'),
                        new ButtonBuilder().setCustomId(`dm_streak_info_${user.id}`).setLabel(_S('btn_streak')).setStyle(ButtonStyle.Primary).setEmoji(parseEmoji(_E.streak) || '🔥'),
                        new ButtonBuilder().setCustomId(`dm_shop_${user.id}`).setLabel(_S('btn_shield')).setStyle(ButtonStyle.Success).setEmoji(iconObj('ic_shield', null, '🛡️')),
                        new ButtonBuilder().setLabel(_S('btn_dashboard')).setStyle(ButtonStyle.Link).setURL(_profileUrl).setEmoji(parseEmoji(_E.website) || '🌐')
                    );

                try {
                    await discordUser.send({ ..._card, components: [..._card.components, actionRow] });
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
                                    .setAuthor({ name: `${em('notification', '🔔')} DAILY REWARD AVAILABLE`, iconURL: client.user.displayAvatarURL() })
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

    // ================= YOUTUBE LIVE + UPLOAD ENGINE =================
    try {
        const ytModule = require('./plugins/livestream.js');
        if (ytModule.startPolling) {
            ytModule.startPolling(client, db);   // it logs its own "Polling engine active" line
        }
    } catch (err) {
        console.error(`${red}[YOUTUBE]${reset} Engine failed to start: ${err.message}`);
    }


    try {
        require('./plugins/scrim.js').startScrimReminders(client);
        console.log(`${green}[SCRIM]${reset} Reminder loop active (15min pre-start pings)`);
    } catch (e) {
        console.error(`${red}[SCRIM]${reset} Reminder loop failed: ${e.message}`);
    }

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
    // What was deployed, real checks, and one message for restarts close together (the webhook restarts on every push)
    client._slashCount = commands.length;
    setTimeout(() => sendBootDM().catch((e) => console.log(`${yellow}[DM]${reset}   Could not send boot DM: ${e.message}`)), 20000);
});

async function sendBootDM() {
    const owner = await client.users.fetch(process.env.OWNER_ID).catch(() => null);
    if (!owner) return;
    const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const { execSync } = require('child_process');
    const meta = (k) => { try { return db.prepare('SELECT value FROM bot_meta WHERE key = ?').get(k)?.value || null; } catch { return null; } };
    const setMeta = (k, v) => { try { db.prepare('INSERT OR REPLACE INTO bot_meta (key, value) VALUES (?, ?)').run(k, String(v)); } catch {} };
    const now = Date.now();

    // Commits since the last start-up DM
    let head = null, changes = [];
    try {
        head = execSync('git rev-parse HEAD', { cwd: __dirname }).toString().trim();
        const last = meta('boot_dm_commit');
        // only a real commit hash ever reaches the shell (the value comes from the database)
        if (last && last !== head && /^[0-9a-f]{7,40}$/.test(String(last))) {
            execSync(`git cat-file -e ${last}^{commit}`, { cwd: __dirname, stdio: 'ignore' });
            changes = execSync(`git log --no-merges --format=%s ${last}..HEAD`, { cwd: __dirname }).toString().trim().split('\n').filter(Boolean);
        }
    } catch { /* not a git checkout, or the old commit is gone */ }

    // Real checks
    let dbOk = true; try { db.prepare('SELECT 1').get(); } catch { dbOk = false; }
    const aiOk = !!process.env.OPENROUTER_API_KEY;
    // Right after start-up Discord may not have measured the ping yet (-1): connected is what matters here
    const ping = client.ws?.ping > 0 ? Math.round(client.ws.ping) : null;
    const discordOk = client.ws?.status === 0 || ping != null;
    const tg = client.telegramBridge?.status?.() || null;
    const tgOn = !!client.telegramBridge?.enabled;
    const failed = (client.failedPlugins || []).map((f) => String(f.file).replace(/\.js$/, ''));
    const problems = [];
    if (!dbOk) problems.push('The database does not answer.');
    if (!aiOk) problems.push('AI: OPENROUTER_API_KEY is missing from the .env.');
    if (failed.length) problems.push(`${failed.length} plugin${failed.length === 1 ? '' : 's'} did not load: ${failed.slice(0, 6).join(', ')}${failed.length > 6 ? '…' : ''}`);
    if (tg?.configured && !tgOn) problems.push('Telegram is set up but did not start.');
    const dot = (ok) => ok ? em('ic_on', '🟢') : em('ic_off', '🔴');

    // Restarts close together share one message
    const lastAt = Number(meta('boot_dm_at')) || 0, lastId = meta('boot_dm_id');
    const recent = lastId && now - lastAt < 30 * 60000;
    const count = recent ? (Number(meta('boot_dm_count')) || 1) + 1 : 1;
    const shown = recent ? [...changes, ...(JSON.parse(meta('boot_dm_changes') || '[]'))].slice(0, 8) : changes.slice(0, 8);

    const c = new ContainerBuilder().setAccentColor(problems.length ? 0xe24b4a : 0x1d9e75);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `## ${problems.length ? em('ic_warn', '⚠️') : em('eagle', '🦅')} ${problems.length ? 'ARCHON restarted, with a problem' : 'ARCHON restarted'}\n` +
        `-# v${client.version} · <t:${Math.floor(now / 1000)}:R>${count > 1 ? ` · ${count} restarts in the last 30 minutes` : ''}`));
    if (problems.length) {
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(problems.map((p) => `${em('ic_off', '🔴')} ${p}`).join('\n') + '\n-# The details are in pm2 logs Architect-CG223'));
    }
    if (shown.length) {
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        // A long commit title keeps its first part, cut at a word ("settings saved in data/telegram instead of /tmp (" used to end mid-way)
        const short = (l) => { const x = l.split(/;\s|\s\(/)[0]; return x.length <= 110 ? x : x.slice(0, 110).replace(/\s+\S*$/, '') + '…'; };
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**What just shipped**\n${shown.map((l) => `• ${short(l)}`).join('\n')}`));
    }
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `${dot(discordOk)} Discord${ping != null ? ` · ${ping} ms` : ''}   ${dot(dbOk)} Database   ${dot(aiOk)} AI\n` +
        `${tg?.configured ? `${dot(tgOn)} Telegram   ` : ''}${dot(!failed.length)} ${client.commands.size} plugins loaded\n` +
        `-# ${client.guilds.cache.size} servers · ${client._slashCount || 0} slash commands`));
    c.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Dashboard').setURL('https://bamako-steel-dev.xyz').setEmoji(em('globe', '🌐'))));

    const payload = { components: [c], flags: MessageFlags.IsComponentsV2 };
    let sent = null;
    if (recent) {
        try { const dm = await owner.createDM(); const m = await dm.messages.fetch(lastId); sent = await m.edit({ components: [c] }); } catch { sent = null; }
    }
    if (!sent) sent = await owner.send(payload).catch(() => null);
    if (!sent) return;
    setMeta('boot_dm_id', sent.id);
    setMeta('boot_dm_at', recent ? lastAt : now); // the 30-minute window starts with the first restart
    setMeta('boot_dm_count', sent.id === lastId ? count : 1);
    setMeta('boot_dm_changes', JSON.stringify(shown));
    if (head) setMeta('boot_dm_commit', head);
    console.log(`${green}[DM]${reset}   Boot DM ${sent.id === lastId ? 'updated' : 'sent'} for ${owner.tag}`);
}

// ================= MESSAGE PROCESSING (PER-SERVER PARTITIONED) =================
// Keep users.avatar (Discord avatar hash) fresh for the dashboard. Writes only
// when the hash changes, and caches only once the row exists (new members get
// their row later in this handler).
const _avatarSeen = new Map();
let _botAvatarDone = false;
function syncAvatar(user, guildId) {
    try {
        if (!_botAvatarDone && client.user) {
            db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(client.user.avatar || null, client.user.id);
            _botAvatarDone = true;
        }
        if (!user || user.bot || !guildId) return;
        const key = `${guildId}:${user.id}`;
        const hash = user.avatar || null;
        if (_avatarSeen.get(key) === hash) return;
        const r = db.prepare('UPDATE users SET avatar = ? WHERE id = ? AND guild_id = ?').run(hash, user.id, guildId);
        if (r.changes) _avatarSeen.set(key, hash);
    } catch (e) {}
}

// New channels get the verification lock too, otherwise unverified members would see them
safeOn(Events.ChannelCreate, async (channel) => {
    try {
        if (!channel.guild || channel.isThread?.()) return;
        const row = db.prepare('SELECT verify_enabled, verify_unverified_role_id FROM server_settings WHERE guild_id = ?').get(channel.guild.id);
        if (!row?.verify_enabled || !row.verify_unverified_role_id) return;
        const role = channel.guild.roles.cache.get(row.verify_unverified_role_id);
        if (role) await channel.permissionOverwrites.edit(role, { ViewChannel: false, SendMessages: false });
    } catch (e) {}
});

safeOn(Events.MessageCreate, async (message) => {
    syncAvatar(message.author, message.guild?.id);
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
            return message.reply(require('./lib/i18n').t('accessDenied', client.detectLanguage('system', message.guild?.id, message))).catch(() => {});
        }
        
        const args = message.content.split(' ');
        const token = args[2]; 
        if (token && client.verifyPushKey) {
            const verified = client.verifyPushKey(message.author.id, token);
            if (!verified) {
                return message.reply(require('./lib/i18n').t('pushKeyExpired', client.detectLanguage('system', message.guild?.id, message))).catch(() => {});
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
            return message.reply(require('./lib/i18n').t('tokenProtection', client.detectLanguage('system', message.guild?.id, message), { waitTime }))
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
        const lang = require('./lib/pick-lang').pickLang(client, message.guild?.id, null, message.author.id);
        
        for (const [mentionedId, user] of message.mentions.users) {
            if (afkUsers.has(mentionedId)) {
                const afkData = afkUsers.get(mentionedId);
                const minutes = Math.floor((Date.now() - afkData.timestamp) / 60000);
                const timeText = minutes === 0 ? t('index.afk_just_now', lang) : `${minutes} min`;
                
                const { EmbedBuilder: AfkEmbed } = require('discord.js');
                const afkPingEmbed = new AfkEmbed()
                    .setColor('#5865F2')
                    .setDescription(t('index.afk_ping_desc', lang, { user: user.username, time: timeText, reason: afkData.reason }))
                    .setFooter({ text: t('index.footer', lang) });
                await message.reply({ embeds: [afkPingEmbed], allowedMentions: { repliedUser: false } }).catch(() => {});
                break;
            }
        }
    }

    if (afkUsers.has(message.author.id)) {
        const afkData = afkUsers.get(message.author.id);
        const minutes = Math.floor((Date.now() - afkData.timestamp) / 60000);
        
        afkUsers.delete(message.author.id);
        
        const lang = require('./lib/pick-lang').pickLang(client, message.guild?.id, null, message.author.id);
        
        const { EmbedBuilder: ReturnEmbed } = require('discord.js');
        const returnEmbed = new ReturnEmbed()
            .setColor('#2ecc71')
            .setDescription(t('index.afk_return_desc', lang, { user: message.author.username, minutes }))
            .setFooter({ text: t('index.footer', lang) });
        await message.reply({ embeds: [returnEmbed] }).catch(() => {});
        console.log(`[AFK] ${message.author.tag} returned after ${minutes} min`);
    }

    // ================= PER-SERVER DYNAMIC LEVELING SYSTEM =================
    const serverSettings = message.guild ? getServerSettings(message.guild.id) : DEFAULT_SETTINGS;
    const now = Date.now();
    const cooldown = (serverSettings.xpCooldown || 60) * 1000;

    // Leveling turned off on the dashboard: no XP and no level-up messages (it used to block only the commands)
    const levelingOn = !message.guild || serverSettings.leveling_enabled !== 0;
    const xpTick = levelingOn && now - (userData.last_xp_gain || 0) > cooldown;
    // Every message counts for the profile, not only the ones that earn XP (once a minute at most)
    if (!xpTick && message.guild && userData) queueUserUpdate(userId, guildId, { username: message.author.username, total_messages: (userData.total_messages || 0) + 1 });
    if (xpTick) {
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
            avatar: message.author.avatar || null,
            xp: newXP,
            level: newLevel,
            total_messages: totalMsgs,
            last_xp_gain: now,
            guild_id: guildId,
        });

        // ================= LEVEL UP DETECTED =================
        if (newLevel > oldLevel) {
            // ================= LEVELING PLUGIN: ON LEVEL UP =================
            // (the announcement is sent further down, once the tier role is known: one message per level-up)

            const userLang = (['en','fr','bm','zh','ar'].includes(serverSettings?.language) ? serverSettings.language : null) || client.userLastLang?.get(message.author.id) || 'en';
            const isDM = !message.guild;
            const guildName = isDM ? 'ARCHON CG-223' : message.guild.name;
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
                levelTier = userLang === 'fr' ? 'Initié' : 'Initiate';
                levelTierColor = '#95a5a6';
                tierEmoji = '🌱';
            } else if (newLevel <= 10) {
                levelTier = userLang === 'fr' ? 'Chevalier' : 'Knight';
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
                if (!roleResult.ok) console.log(`[ROLE] Failed in ${message.guild?.name || message.guild?.id} for ${message.author?.tag || message.author?.id}: ${roleResult.why} (roleId: ${roleResult.roleId || "unknown"})`);
            }

            // ================= RESPECT levelup_channel SETTING =================
            const levelupChannelId = serverSettings.levelupChannel;
            let targetChannel = message.channel;
            if (levelupChannelId && message.guild) {
                const configured = message.guild.channels.cache.get(levelupChannelId);
                if (configured) targetChannel = configured;
            }

            // ================= MILESTONE CHECK =================
            const isMilestone = [5, 10, 15, 20, 25, 30, 35, 50, 75, 100].includes(newLevel) || (newLevel > 35 && newLevel % 5 === 0);
            const tierChanged = [6, 11, 21].includes(newLevel); // tier roles change here, never on a milestone
            const announce = isMilestone || tierChanged; // announce only these, but never exit: the sync and command handling below must run

            if (client.leveling?.onLevelUp && message.guild) {
                // One announcement per level-up, from the leveling plugin: the banner on milestones, one line otherwise.
                // Both this code and the plugin used to post, so milestones were announced twice.
                const xpCur = newXP - Math.pow((newLevel - 1) / 0.1, 2);
                const xpNeed = Math.pow(newLevel / 0.1, 2) - Math.pow((newLevel - 1) / 0.1, 2);
                const roleLine = (tierChanged && roleResult?.ok && roleResult.role?.name) ? `${tierEmoji} ${require('./lib/i18n').t('leveling.levelUpRole', userLang, { role: roleResult.role.name })}` : null;
                await client.leveling.onLevelUp(message.member, newLevel, Math.floor(xpCur), Math.floor(xpNeed), client, db,
                    { channel: message.channel, template: serverSettings.levelupMessage, xp: newXP, tier: levelTier, roleLine }).catch((e) => console.log(`[LEVELUP] ${e.message}`));
            } else if (announce) {
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
                    await targetChannel.send({ content: filled, allowedMentions: { parse: [], users: [userId] } }).catch((e) => console.log(`[LEVELUP] could not post the level-up message: ${e.message}`));
                } else {
                    // ================= SIMPLE LEVEL-UP =================
                    // One line like the big bots; a second one only on a real tier promotion
                    const i18nT = require('./lib/i18n').t;
                    const lines = [`${em('party', '🎉')} ${i18nT('leveling.levelUpLine', userLang, { user: `<@${message.author.id}>`, level: newLevel })}`];
                    if (tierChanged && roleResult?.ok && roleResult.role?.name)
                        lines.push(`${tierEmoji} ${i18nT('leveling.levelUpRole', userLang, { role: roleResult.role.name })}`);
                    await targetChannel.send({ content: lines.join('\n') }).catch((e) => console.log(`[LEVELUP] could not post the level-up line: ${e.message}`));
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
        if (command && isCommandDisabled(message.guild?.id, command)) {
            message.reply(require('./lib/i18n').t('commandDisabled', client.detectLanguage('system', message.guild?.id, message)))
                .then(m => setTimeout(() => m.delete().catch(() => {}), 5000)).catch(() => {});
            return;
        }
        
        if (!command && (cmdName === 'lydia' || cmdName === 'ai' || cmdName === 'neural' || cmdName === 'ia')) {
            try {
                const lydiaModule = require('./plugins/lydia.js');
                await lydiaModule.run(client, message, args, db, serverSettings, usedCommand);
                return;
            } catch (e) {
                console.error(`${red}[LYDIA ERROR]${reset}`, e);
                return message.reply(require('./lib/i18n').t('lydiaFailed', client.detectLanguage('system', message.guild?.id, message)));
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
                    { name: `${em('note', '📝')} WAL Size`, value: health.walSize, inline: true },
                    { name: `${em('ic_chart', '📊')} Fragmentation`, value: `${health.fragmentation} ${health.fragmentationStatus || ''}`, inline: true },
                    { name: '💾 Wasted', value: health.wastedMB || 'N/A', inline: true },
                    { name: '🕒 Next Auto-Purge', value: `${health.nextAutoPurge}\n*${health.nextAutoPurgeFull}*`, inline: false },
                    { name: '🧼 Maintenance', value: health.autoPurgeStatus, inline: true },
                    { name: `${em('ic_clock', '⏳')} Pending Writes`, value: String(health.pendingWrites), inline: true },
                    { name: '👥 Cached Users', value: String(health.cachedUsers), inline: true },
                    { name: `${em('ic_shield', '🛡️')} Circuit Breaker`, value: health.circuitBreaker, inline: true },
                    { name: '💀 Dead Letters', value: String(health.deadLetters), inline: true }
                )
                .setFooter({ text: '🦅 ARCHON CG-223 • Database Health • bamako-steel-dev.xyz' })
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }

        if (command) {
    // Determine language from the exact alias typed
    let commandLang = require('./lib/pick-lang').pickLang(client, message.guild?.id, null, message.author.id);
    // A language the member chose with .mylang applies when the server is on Auto (the explicit server language, checked just below, still wins)
    try {
        const _myLang = require('./lib/member-lang').get(message.author.id, message.guild?.id || 'DM');
        if (_myLang && (_myLang === 'en' || _myLang === 'fr' || fs.existsSync(path.join(__dirname, 'lang', _myLang, `${command.name}.json`)))) commandLang = _myLang;
    } catch (_) { /* a problem here must never stop a command */ }
    // An explicit server language wins: en/fr for every plugin, other languages only
    // for plugins that ship lang/<locale>/<name>.json (legacy ones index {en, fr} and crash).
    const srvLang = serverSettings?.language;
    if (srvLang && srvLang !== 'auto' &&
        (srvLang === 'en' || srvLang === 'fr' ||
         fs.existsSync(path.join(__dirname, 'lang', srvLang, `${command.name}.json`)))) {
        commandLang = srvLang;
    }
    // Store user's last used language for level‑up messages
    if (!client.userLastLang) client.userLastLang = new Map();
    client.userLastLang.set(message.author.id, commandLang);

    const cooldownMs = Number(command.cooldown) || getCommandCooldown(command.name);
const cooldownCheck = checkCooldown(message.author.id, command.name, cooldownMs);
if (cooldownCheck.blocked) {
    const lang = commandLang || 'en';
    const msg = t('index.cooldown', lang, { remaining: cooldownCheck.remaining });
    return message.reply(msg).catch(() => {});
}
    
    // The prefix version needs the same permissions as the slash version (".mute" and ".warn" used to work for anyone)
    if (message.guild && message.author.id !== message.guild.ownerId) {
        const need = requiredMemberPerms(command);
        if (need && !message.member?.permissions?.has(need)) {
            const missing = new PermissionsBitField(need).toArray().filter((p) => !message.member?.permissions?.has(PermissionsBitField.Flags[p]));
            return message.reply({ content: t('index.need_perms', commandLang || 'en', { perms: missing.map((p) => p.replace(/([a-z])([A-Z])/g, '$1 $2')).join(', ') }), allowedMentions: { parse: [] } }).catch(() => {});
        }
    }
    // Bot permission check: say plainly what ARCHON is missing, instead of failing inside the command (fails open)
    { try { const _bp = require('./lib/botPerms'); const _g = _bp.guard(message, command.name || cmdName, commandLang || 'en'); if (_g) return _bp.say(message, _g.text); } catch (_e) { console.error('[botPerms]', _e.message); } }
    try {
        await executePluginCommand(command, client, message, args, db, usedCommand, serverSettings, commandLang);
        // Bot XP: earns XP when processing a command
                if (client.botStats && message.guild) {
                    client.botStats.onCommandProcessed(db, message.guild.id, message.author.id, cmdName, false);
                }
                
                return;
            } catch (e) { 
                console.error(`${red}[COMMAND ERROR]${reset} ${cmdName}:`, e);
                const lang = commandLang || 'en';
                { try { const _bp = require('./lib/botPerms'); const _x = _bp.explainError(e, message, (command && command.name) || cmdName, lang); if (_x) return _bp.say(message, _x); } catch (_e2) { console.error('[botPerms]', _e2.message); } }
                const errorMsg = t('index.cmd_error', lang);
                return message.reply(errorMsg).catch(() => {});
            }
        }
    }
});

// ================= INTERACTION HANDLER =================
const touchedGuilds = new Map();
safeOn(Events.InteractionCreate, async (interaction) => {
    // Buttons and menus count for /bot activity (the counter existed but nothing fed it, so it always showed 0)
    if (interaction.guild && (interaction.isButton?.() || interaction.isStringSelectMenu?.())) { try { client.botStats?.onButtonClicked?.(db, interaction.guild.id); } catch (e) {} }
    // Remember each person's Discord language (used by the welcome card, which has no interaction to read it from)
    try { require('./lib/guild-welcome').rememberLocale(client, interaction); } catch (_) {}
    // Slash commands and buttons count as activity for /ghostclean too (before, only prefix commands did, so slash-only servers looked dead). At most one write per server every 10 minutes.
    if (interaction.guildId) {
        const last = touchedGuilds.get(interaction.guildId) || 0;
        if (Date.now() - last > 600000) {
            touchedGuilds.set(interaction.guildId, Date.now());
            try { db.prepare("UPDATE global_server_stats SET last_active = strftime('%s','now') WHERE guild_id = ?").run(interaction.guildId); } catch (_) {}
        }
    }
    // ── VERIFY PANEL (buttons + modal) — must run before other routers ──
    if ((interaction.isButton?.() || interaction.isModalSubmit?.()) && interaction.customId?.startsWith('vpanel:')) {
        try {
            await require('./plugins/verify.js').onPanelInteraction(interaction, client, db);
        } catch (e) {
            console.error(`[VERIFY] panel guild=${interaction.guildId} user=${interaction.user?.id}:`, e.stack || e.message);
            if (!interaction.replied && !interaction.deferred)
                interaction.reply({ content: require('./lib/i18n').t('genericError', client.detectLanguage('system', interaction.guildId, interaction)), flags: 64 }).catch(() => {});
        }
        return;
    }
    // ── "Couldn't post" alerts (lib/postProblems): Check again · Mute — they also work from the owner's DMs ──
    if (interaction.isButton?.() && interaction.customId?.startsWith('pp:')) {
        return require('./lib/postProblems').handleButton(interaction, client)
            .catch((e) => console.error('[POST PROBLEMS] button:', e.message));
    }
    // SLASH COMMAND EXECUTION
    // Autocomplete handler
    if (interaction.isAutocomplete()) {
        // Resolve by name or alias so autocomplete works even when invoked via a shortcut.
        const command = client.commands?.get(interaction.commandName)
            || client.commands?.get(client.aliases?.get?.(interaction.commandName));

        // No handler? Always respond so Discord never shows "did not respond".
        if (!command?.autocomplete) {
            await interaction.respond([]).catch(() => {});
            return;
        }

        const t0 = Date.now();
        try {
            await command.autocomplete(interaction, client);
            // Safety net: a plugin that forgot to respond would otherwise time out.
            if (!interaction.responded) await interaction.respond([]).catch(() => {});
        } catch (e) {
            // Only respond if we still can. A double-respond is worse than silence.
            if (!interaction.responded) await interaction.respond([]).catch(() => {});
            // Log real failures, ignore the harmless "already responded" noise.
            if (!/already\s*(responded|been)/i.test(e.message)) {
                console.error(`[AUTOCOMPLETE] ${interaction.commandName} failed after ${Date.now() - t0}ms:`, e.message);
            }
        } finally {
            const took = Date.now() - t0;
            if (took > 2500) console.warn(`[AUTOCOMPLETE] ${interaction.commandName} slow: ${took}ms`);
        }
        return;
    }

    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) {
            console.log(`${yellow}[SLASH]${reset} Unknown command: ${interaction.commandName}`);
            return interaction.reply({ content: require('./lib/i18n').t('commandNotFound', client.detectLanguage('system', interaction.guildId, interaction)), flags: 1 << 6 }).catch(() => {});
        }

        if (interaction.guild && isCommandDisabled(interaction.guild.id, command)) {
            return interaction.reply({ content: require('./lib/i18n').t('commandDisabled', client.detectLanguage('system', interaction.guildId, interaction)), flags: 1 << 6 }).catch(() => {});
        }

        // Server-only commands used in DMs (an old Discord client can still offer them): a plain answer, not a crash
        const restrictedCommands = ['profile', 'daily', 'shop', 'credits', 'balance', 'rank', 'leaderboard'];
        const restrictedCategories = ['ECONOMY', 'MODERATION', 'PROFILE', 'GAMING', 'ADMIN', 'MUSIC'];
        if (!interaction.guild && (restrictedCommands.includes(command.name) || restrictedCategories.includes(String(command.category || '').toUpperCase()) || command.data?.default_member_permissions)) {
            const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
            return interaction.reply({
                content: `**${t('index.restricted_title', lang)}**\n${t('index.restricted_desc', lang)}\n${t('index.restricted_action', lang, { command: command.name, botname: client.user.username })}`,
                flags: 1 << 6,
            }).catch(() => {});
        }

        // Cooldowns now apply to slash commands too (before, only the prefix versions had them)
        {
            const cd = checkCooldown(interaction.user.id, command.name, Number(command.cooldown) || getCommandCooldown(command.name));
            if (cd.blocked) {
                const _cl = require('./lib/pick-lang').pickLang(client, interaction.guildId, interaction, interaction.user.id);
                return interaction.reply({ content: t('index.cooldown', _cl, { remaining: cd.remaining }), flags: 1 << 6 }).catch(() => {});
            }
        }

        try {
            console.log(`${cyan}[SLASH]${reset} Executing /${interaction.commandName} for ${interaction.user.tag}`);

            // ================= SLASH-TO-PREFIX ADAPTER =================
            // Plugins use command.run(client, message, args, ...) but
            // slash commands provide an Interaction object, not a Message.
            // This adapter bridges the gap by creating a message wrapper.

            if (command.execute) {
                // MODULE GATE — native slash plugins bypass executePluginCommand
                const gs = interaction.guild ? getServerSettings(interaction.guild.id) : null;
                const blocked = getBlockedModule(command.name, gs);
                if (blocked) {
                    const blockLang = require('./lib/pick-lang').pickLang(client, interaction.guildId, interaction, interaction.user.id) || 'en';
                    const blockedName = t('modules.' + blocked, blockLang);
                    return interaction.reply({
                        embeds: [new EmbedBuilder()
                            .setColor('#e67e22')
                            .setDescription(t('moduleDisabled', blockLang, { module: blockedName }))
                        ],
                        flags: 1 << 6
                    }).catch(() => {});
                }
                // Plugin has native slash support — use it directly
                { try { const _bp = require('./lib/botPerms'); const _g = _bp.guard(interaction, command.name || interaction.commandName); if (_g) return _bp.say(interaction, _g.text); } catch (_e) { console.error('[botPerms]', _e.message); } }
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
                const _srvSet = !!(interaction.guild && serverSettings?.language && serverSettings.language !== 'auto');
                let lang = _srvSet ? serverSettings.language : ({ fr: 'fr', zh: 'zh', ar: 'ar', bm: 'bm' }[(interaction.locale || '').slice(0, 2).toLowerCase()] || 'en');
                // /mylang was ignored here: on Auto servers and in DMs the member's own choice now wins, with the same rule as prefix commands
                // (older plugins only know en/fr, so another language is used only when the plugin ships lang/<code>/<name>.json)
                if (!_srvSet) {
                    const _mine = memberChoice(interaction.user.id, interaction.guildId || 'DM');
                    if (_mine && (_mine === 'en' || _mine === 'fr' || fs.existsSync(path.join(__dirname, 'lang', _mine, `${command.name}.json`)))) lang = _mine;
                }

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
                { try { const _bp = require('./lib/botPerms'); const _g = _bp.guard(interaction, command.name || interaction.commandName, lang); if (_g) return _bp.say(interaction, _g.text); } catch (_e) { console.error('[botPerms]', _e.message); } }
                await executePluginCommand(command, client, interactionMessage, args, db, usedCommand, serverSettings, lang);

                // If plugin never replied, send basic acknowledgment
                if (!repliedSet.value && !interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: require('./lib/i18n').t('commandExecuted', client.detectLanguage('system', interaction.guildId, interaction)), flags: 1 << 6 }).catch(() => {});
                }

                // Bot XP tracking
                if (client.botStats && interaction.guild && db) {
                    client.botStats.onCommandProcessed(db, interaction.guild.id, interaction.user.id, interaction.commandName, true);
                }
            } else {
                await interaction.reply({ content: require('./lib/i18n').t('noHandler', client.detectLanguage('system', interaction.guildId, interaction)), flags: 1 << 6 }).catch(() => {});
            }
        } catch (error) {
            console.error(`${red}[SLASH ERROR]${reset} ${interaction.commandName}:`, error);
            { try { const _bp = require('./lib/botPerms'); const _x = _bp.explainError(error, interaction, interaction.commandName); if (_x) return _bp.say(interaction, _x); } catch (_e2) { console.error('[botPerms]', _e2.message); } }
            const _lang = require('./lib/pick-lang').pickLang(client, interaction.guildId, interaction, interaction.user?.id);
            const _msg = require('./lib/i18n').t('globalError', _lang);
            const errorMsg = { 
                content: _msg, 
                flags: 1 << 6 
            };

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
            return interaction.reply({ content: require('./lib/i18n').t('appealNotYours', client.detectLanguage('system', interaction.guildId, interaction)), flags: 1 << 6 }).catch(() => {});
        }

        const modal = require('./plugins/automod.js').appealModal(userId, guildId, interaction.user);

        return interaction.showModal(modal).catch(() => {});
    }

    // ================= APPEAL MODAL SUBMIT =================
    if (interaction.isModalSubmit() && interaction.customId.startsWith('appeal_modal_')) {
        return require('./plugins/automod.js').handleAppealModal(interaction, client).catch(e => console.error('[APPEAL MODAL]', e.message));
    }
    // ================= PREMIUM ACTIVATION & MODAL =================
    const premiumHandler = require('./lib/handlers/premium');
    if (await premiumHandler(interaction, client)) return;

    // ── VERIFY BUTTON ──
    if (interaction.isButton() && interaction.customId.startsWith('bot:')) {
        return require('./plugins/bot').handleButton(interaction, client).catch(e => console.error('[BOT] button:', e.message));
    }
    if (interaction.isButton() && interaction.customId.startsWith('remind:')) {
        return require('./plugins/reminder').handleButton(interaction, client).catch(e => console.error('[REMINDER] button:', e.message));
    }
    if (interaction.isButton() && interaction.customId.startsWith('modban:')) {
        return require('./plugins/ban').handleComponent(interaction, client).catch(e => {
            console.error(`[BAN] confirm guild=${interaction.guildId}:`, e.stack || e.message);
            if (!interaction.replied && !interaction.deferred) interaction.reply({ content: require('./lib/i18n').t('genericError', 'en'), flags: 64 }).catch(() => {});
        });
    }
    if ((interaction.isButton() || interaction.isAnySelectMenu()) && interaction.customId.startsWith('roles:')) {
        return require('./plugins/roles').handleComponent(interaction, client).catch(e => {
            console.error(`[ROLES] component guild=${interaction.guildId}:`, e.stack || e.message);
            if (!interaction.replied && !interaction.deferred) interaction.reply({ content: require('./lib/i18n').t('genericError', 'en'), flags: 64 }).catch(() => {});
        });
    }
    if ((interaction.isButton() || interaction.isStringSelectMenu()) && interaction.customId.startsWith('help:')) {
        return require('./plugins/help').handleComponent(interaction, client).catch(e => console.error('[HELP] component:', e.message));
    }
    if (interaction.isButton() && interaction.customId.startsWith('ls_toggle:')) {
        return require('./plugins/livestream').handleToggle(interaction, client).catch(e => console.error('[LIVESTREAM] toggle:', e.message));
    }
    // /meta card: class filter, weapon picker, random pick, back to the list (and the old cards' "reroll" button)
    if ((interaction.isButton() || interaction.isUserSelectMenu() || interaction.isModalSubmit()) && interaction.customId.startsWith('credit:')) {
        return require('./plugins/credit.js').handleComponent(interaction, client).catch(e => console.error('[CREDIT] component:', e.message));
    }
    if (interaction.isButton() && interaction.customId === 'lvl:reset') {
        return require('./plugins/leveling.js').handleComponent(interaction, client).catch(e => console.error('[LEVELING] button:', e.message));
    }
    if (interaction.isButton() && interaction.customId.startsWith('joined:')) {
        return require('./lib/guild-welcome').handleComponent(interaction, client).catch(e => console.error('[WELCOME] component:', e.message));
    }
    if ((interaction.isButton() || interaction.isStringSelectMenu()) && interaction.customId.startsWith('ghost:')) {
        return require('./plugins/ghostclean.js').handleComponent(interaction, client).catch(e => console.error('[GHOSTCLEAN] component:', e.message));
    }
    if (interaction.isButton() && interaction.customId.startsWith('claim:')) {
        return require('./plugins/claim.js').handleComponent(interaction, client).catch(e => console.error('[CLAIM] button:', e.message));
    }
    if (interaction.isButton() && interaction.customId.startsWith('mylang:')) {
        return require('./plugins/mylang.js').handleComponent(interaction, client).catch(e => console.error('[MYLANG] component:', e.message));
    }
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('chg:')) {
        return require('./lib/changelog').handleComponent(interaction, client).catch(e => console.error('[CHANGELOG] component:', e.message));
    }
    if ((interaction.isButton() || interaction.isModalSubmit()) && interaction.customId.startsWith('inv:')) {
        return require('./plugins/invest.js').handleComponent(interaction, client).catch(e => console.error('[INVEST] component:', e.message));
    }
    if ((interaction.isButton() || interaction.isStringSelectMenu()) && (interaction.customId.startsWith('meta:') || interaction.customId === 'meta_reroll')) {
        return require('./plugins/meta.js').handleComponent(interaction, client).catch(e => console.error('[META] component:', e.message));
    }

    if (interaction.isButton() && interaction.customId.startsWith('scrim_')) {
        try {
            const scrimPlugin = require('./plugins/scrim.js');
            await scrimPlugin.handleScrimButton(interaction, client);
        } catch (e) {
            console.error('[SCRIM]', e.message);
        }
        return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('verify_')) {
        try {
            const verifyPlugin = require('./plugins/verify.js');
            await verifyPlugin.onVerifyButton(interaction, client, db);
        } catch(e) { console.error('[VERIFY BTN]', e.message); }
        return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('automod_status_')) {
        try {
            const am = require('./plugins/automod.js');
            if (am.handleStatusButton) await am.handleStatusButton(interaction, client);
        } catch (e) { console.error('[AUTOMOD STATUS BTN]', e.message); }
        return;
    }

    if (interaction.isButton() && (
        interaction.customId.startsWith('automod_domains_') ||
        interaction.customId.startsWith('automod_channels_') ||
        interaction.customId.startsWith('automod_log_') ||
        interaction.customId.startsWith('automod_raid_')
    )) {
        try { const am = require('./plugins/automod.js'); if (am.handleAdminButton) await am.handleAdminButton(interaction, client); }
        catch (e) { console.error('[AUTOMOD ADMIN BTN]', e.message); }
        return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('automod_modal_')) {
        try { const am = require('./plugins/automod.js'); if (am.handleAdminModal) await am.handleAdminModal(interaction, client); }
        catch (e) { console.error('[AUTOMOD ADMIN MODAL]', e.message); }
        return;
    }

    if (interaction.isAnySelectMenu() && interaction.customId.startsWith('automod_select_')) {
        try { const am = require('./plugins/automod.js'); if (am.handleAdminSelect) await am.handleAdminSelect(interaction, client); }
        catch (e) { console.error('[AUTOMOD ADMIN SELECT]', e.message); }
        return;
    }

    // ================= WELCOME & BIRTHDAY BUTTONS =================
    const welcomeHandler = require('./lib/handlers/welcome');
    if (await welcomeHandler(interaction, client, memberChoice, initializeUser, cacheUserData)) return;

    // ================= DM & AFK BUTTONS =================
    const dmHandler = require('./lib/handlers/dm');
    if (await dmHandler(interaction, client, memberChoice, afkUsers)) return;

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
                return interaction.reply({ content: em('ic_off', '❌') + ' ' + require('./lib/i18n').t('index.owner_only', require('./lib/botPerms').langOf({ guild: interaction.guild, client }) || 'en'), flags: 64 }).catch(() => {});
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
                return interaction.followUp({ content: em('ic_off', '❌') + ' ' + require('./lib/i18n').t('index.user_not_found', require('./lib/botPerms').langOf({ guild: interaction.guild, client }) || 'en'), flags: 64 }).catch(() => {});
            }

            await targetUser.send({
                embeds: [new (require('discord.js').EmbedBuilder)()
                    .setColor('#00ff88')
                    .setAuthor({ name: '📡 Reply from the Architect', iconURL: client.user.displayAvatarURL() })
                    .setDescription(
                        '```ansi\n' +
                        '\u001b[1;32m\u25b8 FROM      \u001b[0mThe Architect\n' +
                        '\u001b[1;37m\u25b8 MESSAGE   \u001b[0m' + replyText + '\n' +
                        '\u001b[0;37m\u25b8 TIP       \u001b[0mUse .contact to answer\n' +
                        '```'
                    )
                    .setFooter({ text: 'ARCHON CG-223 · Contact · BAMAKO_223 🇲🇱' })
                    .setTimestamp()
                ]
            });

            await interaction.followUp({ content: `${em('ic_ok', '✅')} Reply sent to **${targetUser.username}** via DM.`, flags: 64 }).catch(() => {});
            console.log(`[CONTACT REPLY] Architect → ${targetUser.tag}: ${replyText.substring(0,80)}`);

        } catch(err) {
            console.error('[CONTACT REPLY]', err.message);
            interaction.followUp({ content: em('ic_off', '❌') + ' ' + require('./lib/i18n').t('index.reply_failed', require('./lib/botPerms').langOf({ guild: interaction.guild, client }) || 'en'), flags: 64 }).catch(() => {});
        }
        return;
    }

// ================= MUSIC PANEL BUTTONS =================
// Every music button (live panel or a /music nowplaying copy) is handled once, in plugins/music.js.
// The old handler here was for a previous music engine (Lavalink) and answered these clicks first, so they often did nothing.
    if (interaction.isButton() && interaction.customId.startsWith('mc_')) {
        return require('./plugins/music.js').handlePanelButton(interaction, client)
            .catch(e => console.error('[MUSIC BUTTON]', e.message));
    }

// ================= TICKET SYSTEM COMPONENTS (Select Menu + Buttons + Modals) =================
const isTicketComponent = (interaction.isButton() && interaction.customId.startsWith('ticket_')) ||
(interaction.isStringSelectMenu() && (
    interaction.customId === 'ticket_lang_select' || 
    interaction.customId === 'ticket_category_select'
)) || 
(interaction.isModalSubmit() && (interaction.customId.startsWith('ticket_issue_modal_') || interaction.customId.startsWith('ticket_modal_create_'))) ||
(interaction.isAnySelectMenu() && interaction.customId.startsWith('ticket_cfg_'));

    if (isTicketComponent) {
        try {
            const ticketModule = require('./plugins/ticket.js');
            if (ticketModule.handleComponent) {
                const handled = await ticketModule.handleComponent(interaction, client);
                if (handled) return;
            }
        } catch (err) {
            console.error(`${red}[TICKET COMPONENT]${reset}`, err.message);
            await interaction.reply({ content: em('ic_off', '❌') + ' ' + require('./lib/i18n').t('index.ticket_failed', require('./lib/botPerms').langOf({ guild: interaction.guild, client }) || 'en'), flags: 1 << 6 }).catch(() => {});
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
            await interaction.reply({ content: em('ic_off', '❌') + ' ' + require('./lib/i18n').t('index.vote_failed', require('./lib/botPerms').langOf({ guild: interaction.guild, client }) || 'en'), flags: 1 << 6 }).catch(() => {});
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
            await interaction.reply({ content: em('ic_off', '❌') + ' ' + require('./lib/i18n').t('index.meme_failed', require('./lib/botPerms').langOf({ guild: interaction.guild, client }) || 'en'), flags: MessageFlags.Ephemeral }).catch(() => {});
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
            await interaction.reply({ content: em('ic_off', '❌') + ' ' + require('./lib/i18n').t('index.cat_failed', require('./lib/botPerms').langOf({ guild: interaction.guild, client }) || 'en'), flags: MessageFlags.Ephemeral }).catch(() => {});
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
            await interaction.reply({ content: em('ic_off', '❌') + ' ' + require('./lib/i18n').t('index.dog_failed', require('./lib/botPerms').langOf({ guild: interaction.guild, client }) || 'en'), flags: MessageFlags.Ephemeral }).catch(() => {});
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
            await interaction.reply({ content: em('ic_off', '❌') + ' ' + require('./lib/i18n').t('index.car_failed', require('./lib/botPerms').langOf({ guild: interaction.guild, client }) || 'en'), flags: MessageFlags.Ephemeral }).catch(() => {});
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
        // Back within the 7 days its data is kept? Then the welcome says "nothing to redo" instead of the setup steps
        let cameBack = false;
        try { ensureDepartures(); cameBack = !!db.prepare('SELECT 1 FROM guild_departures WHERE guild_id = ?').get(guild.id); } catch (_) {}
        try { ensureDepartures(); db.prepare('DELETE FROM guild_departures WHERE guild_id = ?').run(guild.id); } catch (_) {}
        try { ensureGuildHistory(); db.prepare('DELETE FROM guild_history WHERE guild_id = ?').run(guild.id); } catch (_) {}
        try { recordArrival(guild); } catch (e) { console.error('[ARRIVAL]', e.message); }
        // ── Sync global_server_stats ──
        try {
            db.prepare(`
                INSERT INTO global_server_stats (guild_id, guild_name, total_members, last_active)
                VALUES (?, ?, ?, strftime('%s','now'))
                ON CONFLICT(guild_id) DO UPDATE SET
                    guild_name = excluded.guild_name,
                    total_members = excluded.total_members,
                    last_active = strftime('%s','now')
            `).run(guild.id, guild.name, guild.memberCount);
            console.log(`[GUILD SYNC] Registered new guild: ${guild.name} (${guild.id})`);
        } catch (_) {}
        // Skip owner's test guild — they already know the bot
        if (guild.id === process.env.GUILD_ID) return;

        // The welcome card: to whoever added ARCHON, else the owner, else in the server (lib/guild-welcome)
        const via = await require('./lib/guild-welcome').sendWelcome(client, guild, { back: cameBack });
        console.log(`[GUILD CREATE] Welcome ${via ? 'sent via ' + via : 'NOT delivered'} (${guild.name})`);

    } catch (e) {
        console.log(`\x1b[33m[GUILD CREATE]\x1b[0m Welcome failed: ${e.message}`);
    }
});

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  🗑️ GUILD DELETE — CLEANUP PROTOCOL                                ║
// ║  Removes server data when ARCHON is kicked                         ║
// ╚══════════════════════════════════════════════════════════════════════╝
// GUILD_GRACE_V1 — keep data 7 days after a kick, purge later
const GRACE_MS = 7 * 24 * 3600 * 1000;
const ensureDepartures = () => db.prepare('CREATE TABLE IF NOT EXISTS guild_departures (guild_id TEXT PRIMARY KEY, left_at INTEGER)').run();
const PURGE_SQL = [
    'DELETE FROM scrim_signups WHERE scrim_id IN (SELECT id FROM scrims WHERE guild_id = ?)',
    ...['scrims', 'member_builds', 'clan_wars', 'server_settings', 'users', 'warnings', 'moderation_logs',
        'server_command_settings', 'global_server_stats', 'server_economy_settings']
        .map(t => `DELETE FROM ${t} WHERE guild_id = ?`)
];
function purgeGuildData(gid) {
    let n = 0;
    for (const q of PURGE_SQL) {
        try { n += db.prepare(q).run(gid).changes; } catch (_) {}
    }
    db.prepare('DELETE FROM guild_departures WHERE guild_id = ?').run(gid);
    return n;
}

// Where new servers come from. Each tracked link (site.xyz/go/tiktok…) logs a click; a server added within 30 minutes
// of a click is credited to the newest click not yet used. It's an estimate, but a good one at ARCHON's size.
const ensureArrivals = () => {
    db.prepare('CREATE TABLE IF NOT EXISTS invite_clicks (id INTEGER PRIMARY KEY AUTOINCREMENT, src TEXT, at INTEGER, used INTEGER DEFAULT 0)').run();
    db.prepare('CREATE TABLE IF NOT EXISTS guild_arrivals (guild_id TEXT PRIMARY KEY, name TEXT, icon TEXT, members INTEGER, joined_at INTEGER, src TEXT)').run();
};
function recordArrival(guild) {
    ensureArrivals();
    const click = db.prepare('SELECT id, src FROM invite_clicks WHERE used = 0 AND at > ? ORDER BY at DESC LIMIT 1').get(Date.now() - 30 * 60 * 1000);
    if (click) db.prepare('UPDATE invite_clicks SET used = 1 WHERE id = ?').run(click.id);
    db.prepare('INSERT OR REPLACE INTO guild_arrivals (guild_id, name, icon, members, joined_at, src) VALUES (?, ?, ?, ?, ?, ?)')
        .run(guild.id, guild.name || null, guild.iconURL?.({ size: 64 }) || null, guild.memberCount || 0, Date.now(), click?.src || null);
    console.log(`[ARRIVAL] ${guild.name} (${guild.id}) from ${click?.src || 'unknown source'}`);
}

// Servers ARCHON left or was removed from, kept for the owner's dashboard (guild_departures above is only a 7-day grace queue).
// reason: 'left' = the owner left with /ghostclean · 'removed' = someone kicked the bot · 'unknown' = found in old stats at boot
const ensureGuildHistory = () => db.prepare(`CREATE TABLE IF NOT EXISTS guild_history (
    guild_id TEXT PRIMARY KEY, name TEXT, icon TEXT, members INTEGER, joined_at INTEGER, left_at INTEGER, reason TEXT)`).run();
function recordDeparture(guild) {
    try {
        ensureGuildHistory();
        const reason = client.ghostLeaving?.has(guild.id) ? 'left' : 'removed';
        client.ghostLeaving?.delete(guild.id);
        db.prepare('INSERT OR REPLACE INTO guild_history (guild_id, name, icon, members, joined_at, left_at, reason) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(guild.id, guild.name || null, guild.iconURL?.({ size: 64 }) || null, guild.memberCount || 0, guild.joinedTimestamp || null, Date.now(), reason);
    } catch (e) { console.error('[GUILD HISTORY]', e.message); }
}
safeOn(Events.GuildDelete, async (guild) => {
    // available === false means a Discord outage, not a departure
    if (guild.available !== false) {
        const byOwner = !!client.ghostLeaving?.has(guild.id);   // read before recordDeparture clears it
        recordDeparture(guild);
        // tell whoever added ARCHON, with the date its settings are deleted and a way back
        if (guild.id !== process.env.GUILD_ID && !byOwner) {
            require('./lib/guild-welcome').sendRemoved(client, guild)
                .then((via) => console.log(`[GUILD DELETE] Removal notice ${via ? 'sent via ' + via : 'not delivered'} (${guild.name})`)).catch(() => {});
        }
    }
    try {
        ensureDepartures();
        db.prepare('INSERT OR REPLACE INTO guild_departures (guild_id, left_at) VALUES (?, ?)').run(guild.id, Date.now());
        client.settings.delete(guild.id);
        if (client.userDataCache) {
            for (const [k] of client.userDataCache) if (k.endsWith(`:${guild.id}`)) client.userDataCache.delete(k);
        }
        console.log(`[GUILD DELETE] Left ${guild.name} (${guild.id}) — data kept 7 days`);
    } catch (e) {
        console.error(`[GUILD DELETE] ${guild.id}: ${e.message}`);
    }
});

setInterval(() => {
    if (!client.isReady()) return;
    try {
        ensureDepartures();
        const old = db.prepare('SELECT guild_id FROM guild_departures WHERE left_at < ?').all(Date.now() - GRACE_MS);
        for (const { guild_id } of old) {
            if (client.guilds.cache.has(guild_id)) {
                db.prepare('DELETE FROM guild_departures WHERE guild_id = ?').run(guild_id);
                continue;
            }
            console.log(`[GUILD PURGE] ${guild_id}: ${purgeGuildData(guild_id)} rows removed`);
        }
    } catch (e) {
        console.error(`[GUILD PURGE] ${e.message}`);
    }
}, 6 * 3600 * 1000);

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  🦅 GUILD MEMBER ADD — ORCHESTRATED WELCOME v6.0                    ║
// ║  Delegates to welcome.js plugin if loaded & configured.             ║
// ║  Falls back to shared cinematic engine if no custom config.       ║
// ╚══════════════════════════════════════════════════════════════════════╝
safeOn(Events.GuildMemberAdd, async (member) => {
    if (member.user.bot) return;
    const welcomeLimited = rateLimit(`welcome:${member.guild.id}`, 10, 30000);
    // ── Sync guild stats ──
    try {
        db.prepare(`
            UPDATE global_server_stats
            SET total_members = ?, guild_name = ?, last_active = strftime('%s','now')
            WHERE guild_id = ?
        `).run(member.guild.memberCount, member.guild.name, member.guild.id);
    } catch (_) {}

    // ── RAID DETECTION (Premium) ──
    try {
        const { isPremium } = require('./plugins/premium.js');
        if (isPremium(db, member.guild.id)) {
            const automod = require('./plugins/automod.js');
            await automod.handleRaid(member, client, db);
        }
    } catch(e) { console.error('[RAID]', e.message); }

    // ── VERIFICATION GATE (Premium) ──
    try {
        const { isPremium } = require('./plugins/premium.js');
        if (isPremium(db, member.guild.id)) {
            const verifyPlugin = require('./plugins/verify.js');
            await verifyPlugin.onMemberJoin(member, client, db);
        }
    } catch(e) { console.error(`[VERIFY] join guild=${member.guild.id} user=${member.id}:`, e.stack || e.message); }

    // ── MEMBER AUTO-ROLE (held until verification passes when the gate is active) ──
    try {
        const { isPremium } = require('./plugins/premium.js');
        const vs = db.prepare('SELECT verify_enabled FROM server_settings WHERE guild_id = ?').get(member.guild.id);
        const gated = !!vs?.verify_enabled && isPremium(db, member.guild.id);
        if (!gated) await require('./lib/joinrole.js').applyJoinRole(member, db);
    } catch (e) { console.error(`[JOINROLE] guild=${member.guild.id}:`, e.message); }

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

    if (!welcomeLimited && client.welcome?.onMemberAdd) {
        await client.welcome.onMemberAdd(member, client, db);
    } else if (!client.welcome && hasCustomWelcome) {
        console.log(`${yellow}[WELCOME]${reset} plugins/welcome.js is not loaded: no welcome card for ${member.guild.name}`);
    }
});

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  🦅 GUILD MEMBER REMOVE — ORCHESTRATED GOODBYE v6.0                ║
// ║  Delegates to welcome.js plugin if loaded & configured.             ║
// ║  Falls back to shared cinematic engine if no custom config.         ║
// ╚══════════════════════════════════════════════════════════════════════╝
safeOn(Events.GuildMemberRemove, async (member) => {
    // verify: free pending captcha timer + collector
    try { const _vp = require('./plugins/verify.js'); _vp?.onMemberLeave?.(member); } catch (e) { console.error(`[VERIFY] leave guild=${member.guild.id} user=${member.id}:`, e.message); }
    if (member.user.bot) return;
    if (rateLimit(`goodbye:${member.guild.id}`, 10, 30000)) return;
    // ── Sync guild stats ──
    try {
        db.prepare(`
            UPDATE global_server_stats
            SET total_members = ?, guild_name = ?, last_active = strftime('%s','now')
            WHERE guild_id = ?
        `).run(member.guild.memberCount, member.guild.name, member.guild.id);
    } catch (_) {}

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

    if (client.welcome?.onMemberRemove) await client.welcome.onMemberRemove(member, client, db);
    else if (hasCustomGoodbye) console.log(`${yellow}[GOODBYE]${reset} plugins/welcome.js is not loaded: no goodbye card for ${member.guild.name}`);
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

            const updateStmt = prepareUserSave();

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
                        userData.streak_protections ?? 0, // 17
                        userData.avatar ?? null           // 18 (v9.5: was missing — placeholder count mismatch)
                    );
                }
            })();
            console.log(`${green}[SHUTDOWN]${reset} Final flush complete: ${updates.length} records saved (per-server partitioned)`);
        } catch (err) { console.error(`${red}[SHUTDOWN]${reset} Final flush failed:`, err.message); }
    }
    
    if (client.userTimeouts) { for (const [id, timeout] of client.userTimeouts) clearTimeout(timeout); client.userTimeouts.clear(); }
    if (client.userDataCache) client.userDataCache.clear(); if (client.settings) client.settings.clear(); if (client.pendingUserUpdates) client.pendingUserUpdates.clear();
    
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
const expressRateLimit = require('express-rate-limit');
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

// Capture raw body for webhook signature verification
// 🛡️ GLOBAL API RATE LIMIT — for anything that is not this machine.
// Every dashboard request reaches the bot from 127.0.0.1, so counting by IP put ALL dashboard users in one
// bucket of 100 requests per 15 minutes: a few people browsing emptied it and every page failed ("Too many
// requests"). The dashboard already limits each visitor by their real IP; calls from this machine are not counted here.
// nginx also connects from 127.0.0.1, so a request it forwards from the internet (it carries Cloudflare's
// cf-connecting-ip header) is counted, by the visitor's real IP; only the dashboard's own calls are skipped.
// Only Cloudflare can reach nginx (firewall), so that header can't be forged from outside.
const visitorIp = (req) => String(req.get('cf-connecting-ip') || req.ip || '');
const isLocalCaller = (req) => {
    const a = String(req.socket?.remoteAddress || '');
    const local = a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
    return local && !req.get('cf-connecting-ip');
};
const apiLimiter = expressRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each outside IP to 100 requests per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    skip: isLocalCaller,
    keyGenerator: (req) => (expressRateLimit.ipKeyGenerator || ((ip) => ip))(visitorIp(req)),
    message: { error: 'Too many requests from this IP, please try again later.' }
});

// Stricter limit for webhooks to prevent webhook spam
const webhookLimiter = expressRateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 20, // Max 20 webhooks per minute
    message: { error: 'Too many webhook requests.' }
});

// Apply the limiter to all API routes
apiApp.use('/api/', apiLimiter);
// Apply stricter limiter to webhooks
apiApp.use('/api/webhooks/', webhookLimiter);

apiApp.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf.toString('utf8');
    }
}));

// Admin auth middleware
const API_ADMIN_SECRET = process.env.API_ADMIN_SECRET || '';
function requireAdmin(req, res, next) {
    if (!API_ADMIN_SECRET || req.get('x-api-key') !== API_ADMIN_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

// ================= API ROUTES =================

// ── DODO PAYMENTS WEBHOOK ──────────────────────────────
apiApp.post('/api/webhooks/dodo', async (req, res) => {
    try {
        const crypto = require('crypto');
        const webhookSecret = process.env.DODO_WEBHOOK_SECRET;
        
        // Verify signature
        const webhookId = req.headers['webhook-id'];
        const webhookTimestamp = req.headers['webhook-timestamp'];
        const webhookSignature = req.headers['webhook-signature'];
        
        if (!webhookSecret) { console.error('[DODO] DODO_WEBHOOK_SECRET not set - rejecting'); return res.status(503).json({ error: 'not_configured' }); }
        if (!webhookId || !webhookTimestamp || !webhookSignature) return res.status(401).json({ error: 'Missing signature' });
        if (Math.abs(Date.now() / 1000 - Number(webhookTimestamp)) > 300) return res.status(401).json({ error: 'Stale timestamp' });

        if (webhookSecret && webhookSignature) {
            const secretBytes = Buffer.from(webhookSecret.replace('whsec_', ''), 'base64');
            const bodyStr = req.rawBody || JSON.stringify(req.body);
            const signedPayload = `${webhookId}.${webhookTimestamp}.${bodyStr}`;
            const expectedSig = crypto.createHmac('sha256', secretBytes)
                .update(signedPayload).digest('base64');
            const signatures = webhookSignature.split(' ');
            const valid = signatures.some(sig => {
                const sigValue = sig.startsWith('v1,') ? sig.slice(3) : sig;
                const a = Buffer.from(expectedSig);
                const b = Buffer.from(sigValue);
                return a.length === b.length && crypto.timingSafeEqual(a, b);
            });
            if (!valid) {
                console.error('[DODO] Invalid webhook signature');
                return res.status(401).json({ error: 'Invalid signature' });
            }
        }

        const event = req.body;
        const eventType = event.type;
        console.log(`[DODO] Event: ${eventType}`);

        // Extract guild ID: first from metadata, then from stored session
        const checkoutSessionId = event.data?.checkout_session_id;
        console.log("[DODO DEBUG] session_id from webhook:", checkoutSessionId);
        let guildId = event.data?.metadata?.guild_id || event.data?.metadata?.metadata_guild_id || event.data?.custom_data?.guild_id || event.data?.metadata_guild_id;
        
        const paymentLink = event.data?.payment_link || '';
        const linkSlug = paymentLink.split('/').pop();
        if (!guildId) {
            try {
                let session = checkoutSessionId ? db.prepare('SELECT guild_id FROM premium_sessions WHERE session_id = ?').get(checkoutSessionId) : null;
                if (!session && linkSlug) session = db.prepare('SELECT guild_id FROM premium_sessions WHERE session_id = ?').get(linkSlug);
                if (!session && event.data?.subscription_id) session = db.prepare('SELECT guild_id FROM premium_sessions WHERE session_id = ?').get(event.data.subscription_id);
                if (session) { guildId = session.guild_id; console.log('[DODO] Found guild_id:', guildId); }
            } catch(e) { console.error('[DODO DEBUG] lookup error:', e.message); }
        }
        const customerId = event.data?.customer?.customer_id;
        const email = event.data?.customer?.email;

        if (eventType === 'payment.succeeded' || eventType === 'subscription.active' || eventType === 'subscription.renewed') {
            if (!guildId) {
                console.error('[DODO] No guild_id in metadata');
                return res.json({ received: true });
            }
            // Activate premium — 30 or 365 days depending on plan
            const pid = event.data?.product_id || event.data?.product_cart?.[0]?.product_id || '';
            const yearly = event.data?.metadata?.plan === 'yearly' || (!!process.env.DODO_PRODUCT_ID_YEARLY && pid === process.env.DODO_PRODUCT_ID_YEARLY);
            const planName = yearly ? 'yearly' : 'monthly';
            const _cur = db.prepare('SELECT expires_at FROM premium WHERE guild_id = ?').get(String(guildId));
            if (_cur && _cur.expires_at === null) { console.log(`[DODO] Guild ${guildId} has lifetime premium — ${eventType} logged, row unchanged`); return res.json({ received: true }); }
            const expiresAt = Math.max(_cur?.expires_at || 0, Math.floor(Date.now()/1000) + ((yearly ? 365 : 30) * 86400));
            db.prepare('INSERT OR REPLACE INTO premium (guild_id, expires_at, plan, payment_method, transaction_id, activated_by) VALUES (?,?,?,?,?,?)').run(
                guildId, expiresAt, planName, 'dodo', event.data?.payment_id || 'dodo', email || 'dodo'
            );
            if (event.data?.subscription_id) db.prepare('INSERT OR REPLACE INTO premium_sessions (session_id, guild_id, created_at) VALUES (?,?,?)').run(event.data.subscription_id, String(guildId), Math.floor(Date.now()/1000));
            console.log(`[DODO] ✅ Premium activated for guild ${guildId} (${planName}, ${eventType})`);

            // DM guild owner
            try {
                const guild = client.guilds.cache.get(guildId);
                if (guild) {
                    const owner = await guild.fetchOwner();
                    const { EmbedBuilder } = require('discord.js');
                    await owner.send({ embeds: [new EmbedBuilder()
                        .setColor(0xffd700)
                        .setTitle('⭐ ARCHON Premium Activated!')
                        .setDescription(`Payment confirmed! Your server **${guild.name}** now has ARCHON Premium for ${yearly ? '1 year' : '30 days'}!`)
                        .addFields(
                            { name: '💰 Amount', value: require('./lib/prices').usdText('en'), inline: true },
                            { name: '⏰ Valid until', value: `<t:${expiresAt}:D>`, inline: true }
                        )
                        .setFooter({ text: 'ARCHON CG-223 • BAMAKO_223 🇲🇱 • Thank you for supporting!' })
                    ]});
                }
            } catch(e) { console.error('[DODO] DM failed:', e.message); }
        }

        if (eventType === 'subscription.cancelled') {
            if (guildId) {
                db.prepare('DELETE FROM premium WHERE guild_id = ?').run(guildId);
                console.log(`[DODO] ❌ Premium cancelled for guild ${guildId}`);
                try {
                    const guild = client.guilds.cache.get(guildId);
                    if (guild) {
                        const owner = await guild.fetchOwner();
                        const { EmbedBuilder } = require('discord.js');
                        await owner.send({ embeds: [new EmbedBuilder()
                            .setColor(0xff3311)
                            .setTitle('Premium Cancelled')
                            .setDescription(`ARCHON Premium for **${guild.name}** has been cancelled.\n\nRejoin anytime at bamako-steel-dev.xyz/premium`)
                            .setFooter({ text: 'ARCHON CG-223 • BAMAKO_223 🇲🇱' })
                        ]});
                    }
                } catch {}
            }
        }

        if (eventType === 'subscription.failed') {
            if (guildId) {
                // Grace period: 7 days before removing premium on a failed payment
                // Dodo will retry the charge; don't punish the customer immediately
                const GRACE_DAYS = 7;
                const graceExpiry = Math.floor(Date.now()/1000) + (GRACE_DAYS * 86400);
                const row = db.prepare('SELECT expires_at FROM premium WHERE guild_id = ?').get(guildId);
                if (row && (!row.expires_at || row.expires_at > Math.floor(Date.now()/1000))) {
                    // Still active — set expiry to grace period if it would expire sooner
                    if (!row.expires_at || row.expires_at > graceExpiry) {
                        db.prepare('UPDATE premium SET expires_at = ? WHERE guild_id = ?').run(graceExpiry, guildId);
                    }
                    console.log(`[DODO] ⚠️ Payment failed for guild ${guildId} — grace period until ${new Date(graceExpiry*1000).toISOString()}`);
                    try {
                        const guild = client.guilds.cache.get(guildId);
                        if (guild) {
                            const owner = await guild.fetchOwner();
                            const { EmbedBuilder } = require('discord.js');
                            await owner.send({ embeds: [new EmbedBuilder()
                                .setColor(0xffaa00)
                                .setTitle(`${em('ic_warn', '⚠️')} Payment Failed — Grace Period Active`)
                                .setDescription(`A payment for **${guild.name}** failed.\n\nYou have **${GRACE_DAYS} days** to update your payment method before premium is removed.`)
                                .addFields({ name: `${em('ic_link', '🔗')} Update payment`, value: 'bamako-steel-dev.xyz/premium', inline: true })
                                .setFooter({ text: 'ARCHON CG-223 • BAMAKO_223 🇲🇱' })
                            ]});
                        }
                    } catch {}
                } else {
                    // Already expired — remove immediately
                    db.prepare('DELETE FROM premium WHERE guild_id = ?').run(guildId);
                    console.log(`[DODO] ❌ Payment failed, premium already expired for guild ${guildId} — removed`);
                }
            }
        }

        res.json({ received: true });
    } catch(e) {
        console.error('[DODO WEBHOOK]', e.message);
        res.status(500).json({ error: 'Webhook error' });
    }
});

// ── PREMIUM API ──────────────────────────────────────
// Activation, payment links and payment-to-server links are only for the dashboard, which sends the API key:
// nginx forwards /api/premium/* from the internet, and these routes write data or create payments.
apiApp.post('/api/premium/activate', requireAdmin, (req, res) => {
    try {
        const { code, guildId } = req.body;
        if (!code || !guildId) return res.json({ success: false, error: 'Missing code or guild ID' });
        if (!/^\d{17,20}$/.test(String(guildId))) return res.json({ success: false, error: 'Invalid guild ID' });

        const codeRow = db.prepare('SELECT * FROM premium_codes WHERE code = ? AND used = 0').get(code.toUpperCase());
        if (!codeRow) return res.json({ success: false, error: 'Invalid or already used code' });

        const nowS = Math.floor(Date.now()/1000);
        const cur = db.prepare('SELECT expires_at FROM premium WHERE guild_id = ?').get(String(guildId));
        if (cur && cur.expires_at === null) return res.json({ success: false, error: 'This server already has lifetime premium' });
        const baseS = cur && cur.expires_at > nowS ? cur.expires_at : nowS;
        const expiresAt = codeRow.days === 0 ? null : baseS + (codeRow.days * 86400);
        db.prepare('INSERT OR REPLACE INTO premium (guild_id, expires_at, plan, payment_method, transaction_id, activated_by) VALUES (?,?,?,?,?,?)').run(
            String(guildId), expiresAt, 'code', 'code', code, 'dashboard'
        );
        db.prepare('UPDATE premium_codes SET used = 1, used_at = ? WHERE code = ?').run(
            Math.floor(Date.now()/1000), code.toUpperCase()
        );

        const days = codeRow.days === 0 ? 'Lifetime' : codeRow.days + ' days';
        return res.json({ success: true, message: `Premium activated! Duration: ${days}` });
    } catch(e) {
        console.error('[PREMIUM API]', e.message);
        return res.json({ success: false, error: 'Server error' });
    }
});

apiApp.post('/api/premium/generate', requireAdmin, (req, res) => {
    try {
        const ownerId = process.env.OWNER_ID || process.env.OWNER_DISCORD_ID || '';
        const { days = 30, amount = 1 } = req.body;
        const codes = [];
        for (let i = 0; i < Math.min(amount, 10); i++) {
            const seg4 = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[require('crypto').randomInt(32)]).join('');
            const code = 'ARCHON-' + seg4() + '-' + seg4();
            db.prepare('INSERT OR IGNORE INTO premium_codes (code, days) VALUES (?,?)').run(code, days);
            codes.push(code);
        }
        try {
            db.prepare(`INSERT INTO moderation_logs (guild_id,user_id,moderator_id,action,reason,timestamp) VALUES (?,?,?,?,?,?)`)
              .run('GLOBAL', ownerId || 'owner', client.user?.id || 'bot', 'config', `Generated ${codes.length} premium code(s), ${Number(days) === 0 ? 'lifetime' : days + 'd'}`, Math.floor(Date.now() / 1000));
        } catch {}
        res.json({ success: true, codes });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// ── PREMIUM ADMIN API (dashboard, owner only) ──
// The dashboard server lets only the bot owner reach these; here the API key is required as for every admin route.
const PREMIUM_CODE = /^[A-Z0-9][A-Z0-9-]{3,39}$/;
apiApp.get('/api/admin/premium', requireAdmin, (req, res) => {
    try {
        const nowS = Math.floor(Date.now() / 1000);
        let codes = [];
        try {
            codes = db.prepare('SELECT * FROM premium_codes ORDER BY rowid DESC LIMIT 200').all()
                .map(r => ({ code: String(r.code), days: Number(r.days) || 0, used: !!r.used, usedBy: r.used_by ? String(r.used_by) : null, usedAt: r.used_at || null }));
        } catch (e) { console.error('[PREMIUM-ADMIN] codes:', e.message); }
        let servers = [];
        try {
            servers = db.prepare('SELECT * FROM premium LIMIT 500').all().map(r => {
                const g = client.guilds.cache.get(String(r.guild_id));
                const exp = r.expires_at === null || r.expires_at === undefined ? null : Number(r.expires_at);
                return {
                    guildId: String(r.guild_id), name: g?.name || null, icon: g ? g.iconURL({ size: 64 }) : null, inServer: !!g,
                    members: g?.memberCount || null, expiresAt: exp, active: exp === null || exp > nowS,
                    daysLeft: exp === null ? null : Math.max(0, Math.ceil((exp - nowS) / 86400)), plan: r.plan || null, via: r.payment_method || null,
                };
            }).sort((a, b) => {
                // Active first, the ones running out soonest at the top, lifetime after them, expired ones last
                if (a.active !== b.active) return a.active ? -1 : 1;
                const ka = a.expiresAt === null ? Number.MAX_SAFE_INTEGER : a.expiresAt, kb = b.expiresAt === null ? Number.MAX_SAFE_INTEGER : b.expiresAt;
                return a.active ? ka - kb : kb - ka;
            });
        } catch (e) { console.error('[PREMIUM-ADMIN] servers:', e.message); }
        res.json({ now: nowS, codes, servers });
    } catch (e) {
        console.error('[PREMIUM-ADMIN] list:', e.message);
        res.status(500).json({ error: 'internal' });
    }
});

apiApp.post('/api/admin/premium/revoke', requireAdmin, (req, res) => {
    try {
        const code = String(req.body?.code || '').trim().toUpperCase();
        if (!PREMIUM_CODE.test(code)) return res.status(400).json({ error: 'code_invalid' });
        const n = db.prepare('DELETE FROM premium_codes WHERE code = ? AND used = 0').run(code).changes;
        if (!n) return res.status(404).json({ error: 'code_not_found' });
        console.log(`[PREMIUM-ADMIN] revoked code ${code.slice(0, 4)}…`);
        res.json({ success: true });
    } catch (e) { console.error('[PREMIUM-ADMIN] revoke:', e.message); res.status(500).json({ error: 'internal' }); }
});

apiApp.post('/api/admin/premium/grant', requireAdmin, (req, res) => {
    try {
        const guildId = String(req.body?.guildId || '');
        const days = Number(req.body?.days);
        if (!/^\d{17,20}$/.test(guildId)) return res.status(400).json({ error: 'guild_invalid' });
        if (!Number.isInteger(days) || days < 0 || days > 3650) return res.status(400).json({ error: 'days_invalid' });
        const nowS = Math.floor(Date.now() / 1000);
        const cur = db.prepare('SELECT expires_at FROM premium WHERE guild_id = ?').get(guildId);
        if (cur && cur.expires_at === null) return res.status(409).json({ error: 'already_lifetime' });
        const base = cur && cur.expires_at > nowS ? cur.expires_at : nowS;   // an active plan is extended, not reset
        const expiresAt = days === 0 ? null : base + days * 86400;
        db.prepare('INSERT OR REPLACE INTO premium (guild_id, expires_at, plan, payment_method, transaction_id, activated_by) VALUES (?,?,?,?,?,?)')
            .run(guildId, expiresAt, 'grant', 'owner', null, 'dashboard');
        client.settings?.delete?.(guildId);
        console.log(`[PREMIUM-ADMIN] granted guild=${guildId} days=${days} expires=${expiresAt ?? 'lifetime'}`);
        res.json({ success: true, expiresAt });
    } catch (e) { console.error('[PREMIUM-ADMIN] grant:', e.message); res.status(500).json({ error: 'internal' }); }
});

apiApp.post('/api/admin/premium/remove', requireAdmin, (req, res) => {
    try {
        const guildId = String(req.body?.guildId || '');
        if (!/^\d{17,20}$/.test(guildId)) return res.status(400).json({ error: 'guild_invalid' });
        const n = db.prepare('DELETE FROM premium WHERE guild_id = ?').run(guildId).changes;
        if (!n) return res.status(404).json({ error: 'not_premium' });
        client.settings?.delete?.(guildId);
        console.log(`[PREMIUM-ADMIN] removed guild=${guildId}`);
        res.json({ success: true });
    } catch (e) { console.error('[PREMIUM-ADMIN] remove:', e.message); res.status(500).json({ error: 'internal' }); }
});

apiApp.get('/api/premium/info', (req, res) => {
    const pr = require('./lib/prices').get();
    return res.json({
        priceUsd: pr.usd,
        priceXof: pr.xof,
        omNumber: process.env.ORANGE_MONEY_NUMBER || '',
        telegram: process.env.TELEGRAM_CONTACT || 'mfof7310',
        discord: 'cloudgaming223'
    });
});

// Store checkout session → guild_id mapping
apiApp.post('/api/premium/store-session', requireAdmin, (req, res) => {
    try {
        const { guildId, checkoutSessionId } = req.body;
        if (!guildId || !checkoutSessionId) {
            return res.status(400).json({ ok: false, error: 'Missing guildId or checkoutSessionId' });
        }
        db.prepare('INSERT OR REPLACE INTO premium_sessions (session_id, guild_id, created_at) VALUES (?, ?, ?)').run(
            checkoutSessionId,
            guildId,
            Math.floor(Date.now() / 1000)
        );
        console.log(`[DODO STORE-SESSION] ✅ Stored: ${checkoutSessionId} → guild ${guildId}`);
        console.log('[DODO STORE-SESSION] DB verification:', db.prepare('SELECT * FROM premium_sessions WHERE session_id = ?').get(checkoutSessionId));
        return res.json({ ok: true });
    } catch(e) {
        console.error('[DODO STORE-SESSION] Error:', e.message);
        return res.status(500).json({ ok: false, error: e.message });
    }
});

apiApp.get('/api/premium/checkout-url', requireAdmin, async (req, res) => {
    try {
        const guildId = req.query.guildId || '';
        const plan = req.query.plan === 'yearly' ? 'yearly' : 'monthly';
        const productId = (plan === 'yearly' ? process.env.DODO_PRODUCT_ID_YEARLY : process.env.DODO_PRODUCT_ID) || '';
        const apiKey = process.env.DODO_API_KEY || '';
        if (!productId || !apiKey) return res.json({ url: null });

        const baseApi = 'https://live.dodopayments.com';

        const response = await fetch(`${baseApi}/checkouts`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                product_cart: [{ product_id: productId, quantity: 1 }],
                metadata: { guild_id: String(guildId), plan }
            })
        });

        const data = await response.json();
        console.log('[DODO] Checkout created:', JSON.stringify(data).substring(0, 300));
        if (data.session_id && data.checkout_url) return res.json({ url: data.checkout_url, sessionId: data.session_id });
        // No silent fallback: a link without the guild attached would take money we can't apply
        console.error(`[DODO] checkout failed (${plan}, http ${response.status}):`, JSON.stringify(data).substring(0, 300));
        return res.json({ url: null, sessionId: null, error: 'checkout_unavailable' });
    } catch(e) {
        console.error('[DODO] checkout-url error:', e.message);
        return res.json({ url: null });
    }
});

// Usage report for the dashboard's Insights tab (loopback only, like the rest of this API)
apiApp.get('/api/insights/:guildId', (req, res) => require('./lib/insights-route').handle(req, res, db, client));
apiApp.get('/api/insights/:guildId/day/:date', (req, res) => require('./lib/insights-route').handleDay(req, res, db, client));
apiApp.get('/api/insights/:guildId/live', (req, res) => require('./lib/insights-route').handleLive(req, res, db, client));
// Server health (read by the dashboard: loopback only, Manage Server is checked there)
apiApp.get('/api/health/:guildId', (req, res) => require('./lib/health-route').handle(req, res, db, client));
// "Send a test" from the dashboard's health card: a silent message, deleted after 10 seconds (3 a minute per server)
apiApp.post('/api/health/:guildId/test', requireAdmin, (req, res) => {
    require('./lib/health-route').handleTest(req, res, db, client).catch((e) => {
        console.error('[HEALTH] test failed:', e.message);
        if (!res.headersSent) res.status(500).json({ error: 'test failed' });
    });
});

apiApp.get('/api/premium/status', (req, res) => {
    try {
        const { guildId } = req.query;
        if (!guildId) return res.json({ premium: false });
        const row = db.prepare('SELECT expires_at FROM premium WHERE guild_id = ?').get(guildId);
        if (!row) return res.json({ premium: false });
        const premium = !row.expires_at || Date.now()/1000 < row.expires_at;
        const daysLeft = row.expires_at ? Math.max(0, Math.floor((row.expires_at - Date.now()/1000) / 86400)) : null;
        // The dashboard polls this for every server: log external calls and status changes only
        client._premiumSeen ??= new Map();
        if (req.headers['cf-ray'] || client._premiumSeen.get(guildId) !== premium) {
            client._premiumSeen.set(guildId, premium);
            console.log(`[PREMIUM-STATUS] guild=${guildId} premium=${premium} days=${daysLeft} ray=${req.headers['cf-ray'] || 'direct'} ip=${req.headers['cf-connecting-ip'] || req.ip}`);
        }
 return res.json({ premium, daysLeft, lifetime: !row.expires_at });
    } catch(e) {
        return res.json({ premium: false });
    }
});

// ── MUSIC API ──────────────────────────────────────
apiApp.get('/api/music', (req, res) => {
    try {
        const musicPlugin = client.commands?.get('music');
        if (!client.commands?.get('music')) return res.json([]);
        const active = [];
        for (const [guildId, guild] of client.guilds.cache) {
            const q = null;
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

apiApp.get('/api/music/stats/:guildId?', (req, res) => {
    try {
        const guildId = req.params.guildId;
        const where = guildId ? 'WHERE guild_id = ?' : '';
        const p = guildId ? [guildId] : [];
        const topTracks = db.prepare(`SELECT title, query, SUM(play_count) as play_count FROM music_history ${where} GROUP BY query ORDER BY play_count DESC LIMIT 20`).all(...p);
        const totalPlays = db.prepare(`SELECT SUM(play_count) as total FROM music_history ${where}`).get(...p)?.total || 0;
        const totalTracks = db.prepare(`SELECT COUNT(DISTINCT query) as count FROM music_history ${where}`).get(...p)?.count || 0;
        res.json({ topTracks, totalPlays, totalTracks });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

apiApp.get('/api/music/:guildId', (req, res) => {
    try {
        const musicPlugin = client.commands?.get('music');
        const q = null;
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

// ─── MUSIC STATS ──────────────────────────────────────────────────────────────

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
apiApp.get('/api/user/:userId', (req, res) => {
    try {
        const userId = req.params.userId;
        const guildId = req.query.guild || null;

        // Get guild-specific or all guild data
        const allUserData = guildId && /^\d{17,20}$/.test(String(guildId))
            ? db.prepare('SELECT * FROM users WHERE id = ? AND guild_id = ?').all(userId, String(guildId))
            : db.prepare('SELECT * FROM users WHERE id = ?').all(userId);
        // Get dashboard user info
        let dashUser = null;
        try {
            dashUser = db.prepare('SELECT * FROM dashboard_users WHERE discord_id = ?').get(userId);
        } catch(e) {}
        
        if (!allUserData.length && !dashUser) return res.json(null);

        // Always get total server count for this user across all guilds
        const allGuildData = guildId ? db.prepare('SELECT * FROM users WHERE id = ?').all(userId) : allUserData;
        
        // Aggregate across all servers
        const totalXp = allUserData.reduce((sum, u) => sum + (u.xp || 0), 0);
        const totalCredits = allUserData.reduce((sum, u) => sum + (u.credits || 0), 0);
        const maxLevel = Math.max(...allUserData.map(u => u.level || 1), 1);
        const maxStreak = Math.max(...allUserData.map(u => u.streak_days || 0), 0);
        // The columns are total_dailies and total_messages (claim_count and message_count never existed, so these
        // showed 0). Commands come from the usage log, which keeps the last 90 days.
        const totalClaims = allUserData.reduce((sum, u) => sum + (u.total_dailies || 0), 0);
        const totalMessages = allUserData.reduce((sum, u) => sum + (u.total_messages || 0), 0);
        let totalCommands = 0;
        try {
            const inGuild = guildId && /^\d{17,20}$/.test(String(guildId));
            totalCommands = (inGuild
                ? db.prepare('SELECT COUNT(*) AS n FROM command_events WHERE user_id = ? AND guild_id = ?').get(userId, String(guildId))
                : db.prepare('SELECT COUNT(*) AS n FROM command_events WHERE user_id = ?').get(userId))?.n || 0;
        } catch (e) {}
        const activeBadge = allUserData.find(u => u.active_badge)?.active_badge || null;

        // Get global rank by total XP
        let rank = null;
        try {
            const rankRow = db.prepare(`
                SELECT COUNT(*) + 1 as rank FROM (
                    SELECT id, SUM(xp) as total_xp FROM users GROUP BY id
                ) ranked WHERE total_xp > ?
            `).get(totalXp);
            rank = rankRow?.rank || null;
        } catch(e) {}

        // Build badges
        const badges = [];
        if (maxLevel >= 5) badges.push('⭐ Level 5+');
        if (maxLevel >= 10) badges.push('🌟 Level 10+');
        if (maxLevel >= 25) badges.push('💎 Level 25+');
        if (maxStreak >= 7) badges.push(`${em('ic_streak', '🔥')} Week Streak`);
        if (maxStreak >= 30) badges.push('💫 Month Streak');
        if (totalClaims >= 50) badges.push('🎯 Dedicated');
        if (totalClaims >= 100) badges.push('👑 Legend');
        if (dashUser) badges.push('🌐 Dashboard User');

        // Get Discord user info from cache
        const discordUser = client.users.cache.get(userId);
        
        res.json({
            discordId: userId,
            username: discordUser?.username || dashUser?.username || allUserData[0]?.username || 'Unknown',
            avatar: discordUser?.avatar || dashUser?.avatar || null,
            level: maxLevel,
            xp: totalXp,
            credits: totalCredits,
            streakDays: maxStreak,
            totalClaims,
            messageCount: totalMessages,
            commandsUsed: totalCommands,
            rank,
            badges,
            activeBadge,
            servers: allGuildData.length,
            lastSeen: dashUser?.last_login || null,
        });
    } catch(err) {
        console.error('[API /api/user]', err.message);
        res.json(null);
    }
});

// ── ADMIN ENDPOINTS ──────────────────────────────────────────
// Premium prices (owner dashboard). The card amount is charged by Dodo Payments: it must be changed there too.
apiApp.post('/api/admin/prices', requireAdmin, (req, res) => {
    try {
        const p = require('./lib/prices').set({ usd: req.body?.usd, xof: req.body?.xof });
        console.log(`[PRICES] now $${p.usd} by card, ${p.xof} FCFA local`);
        res.json({ ok: true, ...p });
    } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
    }
});

// "Talk to a person" from the site's support chat: the conversation goes to the owner on Telegram and by Discord DM
apiApp.post('/api/admin/support-handoff', requireAdmin, async (req, res) => {
    try {
        const clip = (v, n) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n);
        const contact = clip(req.body?.contact, 60);
        if (contact.length < 2) return res.status(400).json({ ok: false });
        const lang = req.body?.lang === 'fr' ? 'FR' : 'EN';
        const msgs = (Array.isArray(req.body?.messages) ? req.body.messages : []).slice(-10)
            .map((m) => `${m?.role === 'user' ? '👤' : '🤖'} ${clip(m?.content, 400)}`);
        const text = [`🆘 Support request (${lang})`, `Contact: ${contact}`, req.body?.note ? `Note: ${clip(req.body.note, 500)}` : null, '', ...msgs].filter((x) => x !== null).join('\n');
        let sent = 0;
        try { const r = await client.telegramBridge?.send?.(text.slice(0, 3900), { force: true }); if (r?.success !== false) sent++; } catch (_) {}
        try {
            const owner = await client.users.fetch(process.env.OWNER_ID).catch(() => null);
            if (owner && await owner.send({ content: text.slice(0, 1990), allowedMentions: { parse: [] } }).then(() => true).catch(() => false)) sent++;
        } catch (_) {}
        console.log(`[SUPPORT] Handoff from ${contact}: delivered ${sent}/2`);
        res.json({ ok: sent > 0 });
    } catch (err) {
        console.error('[API /api/admin/support-handoff]', err.message);
        res.status(500).json({ ok: false });
    }
});

// Tracked invite links: the dashboard logs a click here, then sends the visitor to Discord
apiApp.post('/api/admin/invite-click', requireAdmin, (req, res) => {
    try {
        const src = String(req.body?.src || '').toLowerCase();
        if (!/^[a-z0-9-]{1,20}$/.test(src)) return res.status(400).json({ ok: false });
        ensureArrivals();
        db.prepare('INSERT INTO invite_clicks (src, at) VALUES (?, ?)').run(src, Date.now());
        db.prepare('DELETE FROM invite_clicks WHERE at < ?').run(Date.now() - 180 * 86400000);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ ok: false }); }
});
// Clicks and new servers per source over the last N days, plus the latest arrivals
apiApp.get('/api/admin/arrivals', requireAdmin, (req, res) => {
    try {
        ensureArrivals();
        const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));
        const since = Date.now() - days * 86400000;
        const clicks = db.prepare('SELECT src, COUNT(*) AS n FROM invite_clicks WHERE at > ? GROUP BY src').all(since);
        const joins = db.prepare("SELECT COALESCE(src, '') AS src, COUNT(*) AS n FROM guild_arrivals WHERE joined_at > ? GROUP BY COALESCE(src, '')").all(since);
        const map = new Map();
        for (const c of clicks) map.set(c.src, { src: c.src, clicks: c.n, joins: 0 });
        for (const j of joins) { const k = j.src; const e = map.get(k) || { src: k, clicks: 0, joins: 0 }; e.joins = j.n; map.set(k, e); }
        const recent = db.prepare('SELECT guild_id AS id, name, icon, members, joined_at AS joinedAt, src FROM guild_arrivals ORDER BY joined_at DESC LIMIT 100').all()
            .map(r => ({ ...r, still: client.guilds.cache.has(r.id) }));
        res.json({ days, sources: [...map.values()].sort((a, b) => b.joins - a.joins || b.clicks - a.clicks), recent });
    } catch (err) {
        console.error('[API /api/admin/arrivals]', err.message);
        res.json({ days: 30, sources: [], recent: [] });
    }
});

// Servers ARCHON is no longer in (owner dashboard). The first call also adds old ones found in the stats table.
apiApp.get('/api/admin/departures', requireAdmin, (req, res) => {
    try {
        ensureGuildHistory();
        if (!client._historyBackfilled) {
            client._historyBackfilled = true;
            const rows = db.prepare("SELECT guild_id, guild_name, total_members, last_active FROM global_server_stats WHERE guild_id != 'DM'").all();
            const ins = db.prepare("INSERT OR IGNORE INTO guild_history (guild_id, name, members, left_at, reason) VALUES (?, ?, ?, ?, 'unknown')");
            for (const r of rows) if (!client.guilds.cache.has(r.guild_id)) ins.run(r.guild_id, r.guild_name || null, r.total_members || 0, (Number(r.last_active) || 0) * 1000 || null);
        }
        const list = db.prepare('SELECT guild_id AS id, name, icon, members, joined_at AS joinedAt, left_at AS leftAt, reason FROM guild_history ORDER BY left_at DESC LIMIT 300').all()
            .filter(r => !client.guilds.cache.has(r.id));
        res.json({ list });
    } catch (err) {
        console.error('[API /api/admin/departures]', err.message);
        res.json({ list: [] });
    }
});

apiApp.get('/api/admin/dashboard-users', requireAdmin, (req, res) => {
    try {
        const users = db.prepare(`
            SELECT discord_id, username, avatar, is_owner, login_count, updated_at, created_at
            FROM dashboard_users
            ORDER BY updated_at DESC
            LIMIT 50
        `).all();
        res.json(users);
    } catch(err) {
        console.error('[API /api/admin/dashboard-users]', err.message);
        res.json([]);
    }
});

apiApp.post('/api/admin/dashboard-users/upsert', requireAdmin, (req, res) => {
    try {
        const { discord_id, username, avatar } = req.body;
        if (!discord_id) return res.json({ ok: false });

        const isOwner = discord_id === process.env.OWNER_ID ? 1 : 0;
        db.prepare(`
            INSERT INTO dashboard_users (discord_id, username, avatar, is_owner, login_count, last_login, updated_at, created_at)
            VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'), datetime('now'))
            ON CONFLICT(discord_id) DO UPDATE SET
                username = excluded.username,
                avatar = excluded.avatar,
                is_owner = excluded.is_owner,
                login_count = login_count + 1,
                last_login = datetime('now'),
                updated_at = datetime('now')
        `).run(discord_id, username || 'Unknown', avatar || null, isOwner);

        res.json({ ok: true });
    } catch(err) {
        console.error('[API /api/admin/upsert]', err.message);
        res.json({ ok: false });
    }
});

apiApp.get('/api/stats', (req, res) => {
    try {
        const dbHealth = getDatabaseHealth();
        
        // Stats par serveur (limité à 10 pour performance)
        const servers = [];
        const guildCache = client.guilds.cache;
        let count = 0;
        for (const [id, guild] of guildCache) {
            if (count >= 50) break; // Show up to 50 servers
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
                slashCommands: client.commands.filter(c => !!c.data && c.category !== 'TELEGRAM').size,
                telegramPlugins: client.telegramCommandCount || 0,
                totalModules: new Set(client.commands.filter(c=>c.category).map(c=>c.category)).size,
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
                dailyBonus: settings.dailyBonus || settings.daily_bonus || 200,
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
                `SELECT id, username, avatar, xp, level, credits, streak_days, total_messages, games_won
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
    const { userId, active } = req.query;
    if (!guildId || !validateSnowflake(guildId)) return res.status(400).json({ error: 'a valid guild id is required' });
    if (userId !== undefined && !validateSnowflake(String(userId))) return res.status(400).json({ error: 'invalid user id' });
    try {
        let query = 'SELECT * FROM warnings WHERE guild_id = ?';
        const params = [guildId];
        if (userId) { query += ' AND user_id = ?'; params.push(String(userId)); }
        if (active !== undefined) { query += ' AND active = ?'; params.push(active === 'true' ? 1 : 0); }
        query += ' ORDER BY created_at DESC LIMIT 2000';
        const warnings = db.prepare(query).all(...params);
        res.json({ success: true, warnings, count: warnings.length, total: warnings.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

apiApp.post('/api/warnings/:guildId', requireAdmin, (req, res) => {
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
            logs = db.prepare(`SELECT m.*, u.username AS target_username, mod.username AS moderator_username, u.avatar AS target_avatar, mod.avatar AS moderator_avatar
                FROM moderation_logs m
                LEFT JOIN users u   ON u.id = m.user_id      AND u.guild_id = m.guild_id
                LEFT JOIN users mod ON mod.id = m.moderator_id AND mod.guild_id = m.guild_id
                WHERE m.guild_id = ? ORDER BY m.timestamp DESC LIMIT 1000`).all(guildId); // the whole history was sent on every visit (AutoMod adds many rows)
        } else {
            logs = db.prepare(`SELECT m.*, u.username AS target_username, mod.username AS moderator_username, u.avatar AS target_avatar, mod.avatar AS moderator_avatar
                FROM moderation_logs m
                LEFT JOIN users u   ON u.id = m.user_id      AND u.guild_id = m.guild_id
                LEFT JOIN users mod ON mod.id = m.moderator_id AND mod.guild_id = m.guild_id
                ORDER BY m.timestamp DESC LIMIT 100`).all();
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
// ── VERIFY SETTINGS API (dashboard) ──
const _vg = require('./lib/verify-guard.js');
const VERIFY_COLS = 'verify_enabled, verify_role_id, verify_unverified_role_id, verify_kick_days, verify_panel_channel_id';

async function verifyActor(guildId, userId) {
    const guild = client.guilds.cache.get(String(guildId));
    if (!guild) return { code: 404, error: 'guild_not_found' };
    if (!/^\d{17,20}$/.test(String(userId || ''))) return { code: 400, error: 'user_required' };
    const member = await guild.members.fetch(String(userId)).catch(() => null);
    if (!member) return { code: 403, error: 'not_member' };
    const { PermissionsBitField } = require('discord.js');
    if (guild.ownerId !== member.id && !member.permissions.has(PermissionsBitField.Flags.ManageGuild))
        return { code: 403, error: 'forbidden' };
    return { guild, member };
}

apiApp.get('/api/verify/:guildId', requireAdmin, async (req, res) => {
    try {
        const a = await verifyActor(req.params.guildId, req.query.userId);
        if (a.error) return res.status(a.code).json({ error: a.error });
        const db = client.db, gid = a.guild.id;
        const { isPremium } = require('./plugins/premium.js');
        const row = db.prepare(`SELECT ${VERIFY_COLS} FROM server_settings WHERE guild_id = ?`).get(gid) || {};
        const roles = [...a.guild.roles.cache.values()]
            .filter(r => r.id !== gid && !r.managed)
            .sort((x, y) => y.position - x.position)
            .map(r => {
                const reason = _vg.validateVerifyRole(a.guild, r, a.member);
                return { id: r.id, name: r.name, color: r.hexColor, eligible: !reason, reason: reason ? _vg.GUARD_MSG[reason] : null };
            });
        const panelId = row.verify_panel_channel_id || null;
        const hasPanelChannel = !!(panelId && (a.guild.channels.cache.has(panelId) || await a.guild.channels.fetch(panelId).catch(() => null)));
        // Text channels the bot can post in, for the panel picker
        const me = a.guild.members.me;
        const channels = [...a.guild.channels.cache.values()]
            .filter(c => c.type === 0 || c.type === 5)
            .sort((x, y) => x.rawPosition - y.rawPosition)
            .slice(0, 200)
            .map(c => ({ id: c.id, name: c.name, canPost: !!(me && require('./lib/canPost').diagnose(a.guild, c, me).ok) }));
        // Read-only numbers from the event log (nothing is deleted here)
        const stats = { passed: 0, failed: 0, kicked: 0, spam: 0 }, last24h = { passed: 0, failed: 0, kicked: 0, spam: 0 };
        let pendingCount = 0;
        try {
            const nowS = Math.floor(Date.now() / 1000);
            for (const r of db.prepare('SELECT kind, COUNT(*) AS n FROM verify_events WHERE guild_id = ? AND ts >= ? GROUP BY kind').all(gid, nowS - 7 * 86400))
                if (r.kind in stats) stats[r.kind] = r.n;
            for (const r of db.prepare('SELECT kind, COUNT(*) AS n FROM verify_events WHERE guild_id = ? AND ts >= ? GROUP BY kind').all(gid, nowS - 86400))
                if (r.kind in last24h) last24h[r.kind] = r.n;
        } catch {} // table is created on the first verify event
        try { pendingCount = db.prepare('SELECT COUNT(*) AS n FROM verify_pending WHERE guild_id = ?').get(gid).n; } catch {}
        res.json({
            guildId: gid,
            premium: !!isPremium(db, gid),
            panelChannelId: panelId,
            hasPanelChannel,
            channels, stats, last24h, pendingCount,
            settings: {
                enabled: !!row.verify_enabled,
                verifiedRoleId: row.verify_role_id || null,
                unverifiedRoleId: row.verify_unverified_role_id || null,
                kickMinutes: Number(row.verify_kick_days) || 0
            },
            roles
        });
    } catch (e) {
        console.error(`[VERIFY-API] get guild=${req.params.guildId}:`, e.message);
        res.status(500).json({ error: 'internal' });
    }
});

apiApp.post('/api/verify/:guildId', requireAdmin, async (req, res) => {
    try {
        const { userId, settings } = req.body || {};
        if (!settings || typeof settings !== 'object' || Array.isArray(settings))
            return res.status(400).json({ error: 'settings_required' });
        const a = await verifyActor(req.params.guildId, userId);
        if (a.error) return res.status(a.code).json({ error: a.error });
        const db = client.db, gid = a.guild.id;
        const { isPremium } = require('./plugins/premium.js');

        const allowed = ['enabled', 'verifiedRoleId', 'unverifiedRoleId', 'kickMinutes'];
        const unknown = Object.keys(settings).filter(k => !allowed.includes(k));
        if (unknown.length) return res.status(400).json({ error: 'unknown_fields', fields: unknown });

        const disableOnly = Object.keys(settings).length === 1 && settings.enabled === false;
        if (!isPremium(db, gid) && !disableOnly) return res.status(402).json({ error: 'premium_required' });

        if ('enabled' in settings && typeof settings.enabled !== 'boolean')
            return res.status(400).json({ error: 'enabled_must_be_boolean' });
        if ('kickMinutes' in settings && !(Number.isInteger(settings.kickMinutes) && settings.kickMinutes >= 0 && settings.kickMinutes <= 60))
            return res.status(400).json({ error: 'kickMinutes_must_be_0_to_60' });

        const roleField = (k) => {
            if (!(k in settings)) return undefined;
            const v = settings[k];
            if (v === null) return null;
            if (!/^\d{17,20}$/.test(String(v))) throw { code: 400, error: `${k}_invalid` };
            const role = a.guild.roles.cache.get(String(v));
            const reason = _vg.validateVerifyRole(a.guild, role, a.member);
            if (reason) throw { code: 400, error: `${k}_rejected`, reason: _vg.GUARD_MSG[reason] };
            return role.id;
        };
        const vr = roleField('verifiedRoleId');
        const ur = roleField('unverifiedRoleId');

        db.prepare('INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)').run(gid);
        const cur = db.prepare(`SELECT ${VERIFY_COLS} FROM server_settings WHERE guild_id = ?`).get(gid) || {};
        const next = {
            verify_enabled: 'enabled' in settings ? (settings.enabled ? 1 : 0) : (cur.verify_enabled ? 1 : 0),
            verify_role_id: vr === undefined ? (cur.verify_role_id || null) : vr,
            verify_unverified_role_id: ur === undefined ? (cur.verify_unverified_role_id || null) : ur,
            verify_kick_days: 'kickMinutes' in settings ? settings.kickMinutes : (Number(cur.verify_kick_days) || 0)
        };
        if (next.verify_role_id && next.verify_role_id === next.verify_unverified_role_id)
            return res.status(400).json({ error: 'roles_must_differ' });
        if (next.verify_enabled && !next.verify_role_id && !next.verify_unverified_role_id)
            return res.status(400).json({ error: 'role_required_to_enable' });

        db.prepare('UPDATE server_settings SET verify_enabled = ?, verify_role_id = ?, verify_unverified_role_id = ?, verify_kick_days = ? WHERE guild_id = ?')
            .run(next.verify_enabled, next.verify_role_id, next.verify_unverified_role_id, next.verify_kick_days, gid);
        client.settings?.delete?.(gid);
        client.invalidateGuildCache?.(gid);
        console.log(`[VERIFY-API] update guild=${gid} by=${a.member.id} ${JSON.stringify(next)}`);

        const warnings = [];
        // Lock channels right away when the gate is switched on or gets a new unverified role
        let lock = null;
        const enabling = !!next.verify_enabled && !cur.verify_enabled;
        const roleChanged = !!next.verify_unverified_role_id && next.verify_unverified_role_id !== cur.verify_unverified_role_id;
        if (next.verify_enabled && next.verify_unverified_role_id && (enabling || roleChanged)) {
            const uRole = a.guild.roles.cache.get(next.verify_unverified_role_id);
            if (uRole) {
                const r = await _vg.applyUnverifiedLock(a.guild, uRole, db);
                const chName = (id) => id ? `#${a.guild.channels.cache.get(id)?.name || id}` : null;
                lock = { locked: r.locked, failed: r.failed, panel: chName(r.panelId), fallback: chName(r.fallbackId) };
                if (r.failed) warnings.push(`${r.failed} channels couldn't be updated — check ARCHON's role is above the unverified role.`);
                if (!r.panelId) warnings.push(r.fallbackId
                    ? `No verification panel yet: ${lock.fallback} stays open, so members can skip verification there. Post one with /verify panel.`
                    : `No verification panel: members with closed DMs can't verify. Post one with /verify panel.`);
                console.log(`[VERIFY-API] lock guild=${gid} locked=${r.locked} failed=${r.failed} panel=${r.panelId || '-'}`);
            }
        }
        res.json({
            success: true,
            settings: {
                enabled: !!next.verify_enabled,
                verifiedRoleId: next.verify_role_id,
                unverifiedRoleId: next.verify_unverified_role_id,
                kickMinutes: next.verify_kick_days
            },
            warnings,
            lock
        });
    } catch (e) {
        if (e && e.code && e.error) return res.status(e.code).json({ error: e.error, reason: e.reason });
        console.error(`[VERIFY-API] post guild=${req.params.guildId}:`, e.stack || e.message);
        res.status(500).json({ error: 'internal' });
    }
});

// Members who got the captcha and have not passed yet. The captcha code is never sent.
apiApp.get('/api/verify/:guildId/pending', requireAdmin, async (req, res) => {
    try {
        const a = await verifyActor(req.params.guildId, req.query.userId);
        if (a.error) return res.status(a.code).json({ error: a.error });
        const db = client.db, gid = a.guild.id;
        let rows = [], total = 0;
        try {
            total = db.prepare('SELECT COUNT(*) AS n FROM verify_pending WHERE guild_id = ?').get(gid).n;
            rows = db.prepare('SELECT user_id, kick_at, attempts FROM verify_pending WHERE guild_id = ? ORDER BY kick_at = 0, kick_at LIMIT 25').all(gid);
        } catch {} // table is created with the first captcha
        const members = [];
        for (const r of rows) {
            const m = a.guild.members.cache.get(r.user_id) || await a.guild.members.fetch(r.user_id).catch(() => null);
            if (!m) continue; // left the server; the leave handler cleans the row
            members.push({
                id: m.id, name: m.displayName, avatar: m.user.displayAvatarURL({ size: 64, extension: 'png' }),
                kickAt: r.kick_at > 0 ? r.kick_at : null, attempts: Number(r.attempts) || 0,
                joinedAt: m.joinedTimestamp || null
            });
        }
        res.json({ total, members });
    } catch (e) {
        console.error(`[VERIFY-API] pending guild=${req.params.guildId}:`, e.message);
        res.status(500).json({ error: 'internal' });
    }
});

// Post (or move) the verification panel from the dashboard: same checks as /verify panel
apiApp.post('/api/verify/:guildId/panel', requireAdmin, async (req, res) => {
    try {
        const { userId, channelId } = req.body || {};
        const a = await verifyActor(req.params.guildId, userId);
        if (a.error) return res.status(a.code).json({ error: a.error });
        const db = client.db, gid = a.guild.id;
        const { isPremium } = require('./plugins/premium.js');
        if (!isPremium(db, gid)) return res.status(402).json({ error: 'premium_required' });
        if (!/^\d{17,20}$/.test(String(channelId || ''))) return res.status(400).json({ error: 'channel_invalid' });
        const ch = a.guild.channels.cache.get(String(channelId));
        if (!ch || !(ch.type === 0 || ch.type === 5)) return res.status(400).json({ error: 'channel_not_text' });
        { const _wait = client.rateWait(`vpanel-api:${gid}`, 3, 60000); if (_wait) return res.set('Retry-After', String(_wait)).status(429).json({ error: 'slow_down', retryAfter: _wait }); }
        const d = require('./lib/canPost').diagnose(a.guild, ch, a.guild.members.me);
        if (!d.ok) return res.status(400).json({ error: 'cannot_post', reason: d.reason, missing: d.missing || [], role: d.role || null });

        db.prepare('INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)').run(gid);
        const lang = require('./lib/pick-lang').pickLang(client, gid, null, null) || 'en';
        const { uRole } = await require('./plugins/verify.js').postVerifyPanel(client, db, a.guild, ch, lang);
        client.settings?.delete?.(gid);
        client.invalidateGuildCache?.(gid);
        console.log(`[VERIFY-API] panel guild=${gid} channel=${ch.id} by=${a.member.id}`);
        res.json({ success: true, channelId: ch.id, channelName: ch.name, locked: !!uRole });
    } catch (e) {
        console.error(`[VERIFY-API] panel guild=${req.params.guildId}:`, e.stack || e.message);
        res.status(500).json({ error: 'panel_failed' });
    }
});

// Let one pending member through by hand
apiApp.post('/api/verify/:guildId/approve', requireAdmin, async (req, res) => {
    try {
        const { userId, memberId } = req.body || {};
        const a = await verifyActor(req.params.guildId, userId);
        if (a.error) return res.status(a.code).json({ error: a.error });
        const db = client.db, gid = a.guild.id;
        const { isPremium } = require('./plugins/premium.js');
        if (!isPremium(db, gid)) return res.status(402).json({ error: 'premium_required' });
        if (!/^\d{17,20}$/.test(String(memberId || ''))) return res.status(400).json({ error: 'member_invalid' });
        { const _wait = client.rateWait(`vapprove-api:${gid}`, 20, 60000); if (_wait) return res.set('Retry-After', String(_wait)).status(429).json({ error: 'slow_down', retryAfter: _wait }); }
        const m = await a.guild.members.fetch(String(memberId)).catch(() => null);
        if (!m || m.user.bot) return res.status(404).json({ error: 'member_not_found' });
        // Only people the gate is holding: waiting on a captcha, or carrying the unverified role
        const s = db.prepare('SELECT verify_enabled, verify_unverified_role_id FROM server_settings WHERE guild_id = ?').get(gid) || {};
        if (!s.verify_enabled) return res.status(400).json({ error: 'gate_off' });
        let held = !!(s.verify_unverified_role_id && m.roles.cache.has(s.verify_unverified_role_id));
        if (!held) { try { held = !!db.prepare('SELECT 1 FROM verify_pending WHERE guild_id = ? AND user_id = ?').get(gid, m.id); } catch {} }
        if (!held) return res.status(400).json({ error: 'not_pending' });
        const r = await require('./plugins/verify.js').approveMember(client, db, a.guild, m, a.member.id);
        if (r.error) return res.status(400).json({ error: r.error });
        console.log(`[VERIFY-API] approve guild=${gid} member=${m.id} by=${a.member.id}`);
        res.json({ success: true });
    } catch (e) {
        console.error(`[VERIFY-API] approve guild=${req.params.guildId}:`, e.stack || e.message);
        res.status(500).json({ error: 'approve_failed' });
    }
});

// ── VOTE STATS API (dashboard) ──
apiApp.get('/api/vote-stats/:guildId', requireAdmin, async (req, res) => {
    try {
        const gid = String(req.params.guildId);
        if (!/^\d{17,20}$/.test(gid)) return res.status(400).json({ error: 'bad_guild' });
        const db = client.db;
        const agg = db.prepare('SELECT COUNT(*) AS voters, COALESCE(SUM(total_votes), 0) AS total FROM user_votes WHERE guild_id = ?').get(gid);
        const top = db.prepare('SELECT user_id, total_votes FROM user_votes WHERE guild_id = ? ORDER BY total_votes DESC LIMIT 3').all(gid);
        const topNamed = await Promise.all(top.map(async r => ({
            name: (client.users.cache.get(r.user_id) || await client.users.fetch(r.user_id).catch(() => null))?.username || 'Unknown',
            votes: r.total_votes
        })));
        res.json({ voteUrl: `https://top.gg/bot/${client.user.id}/vote`, total: agg.total, voters: agg.voters, top: topNamed });
    } catch (e) {
        console.error(`[VOTE-API] guild=${req.params.guildId}:`, e.message);
        res.status(500).json({ error: 'internal' });
    }
});

// ── OVERVIEW HEALTH API (dashboard) ──
apiApp.get('/api/overview-health/:guildId', requireAdmin, (req, res) => {
    try {
        const guild = client.guilds.cache.get(String(req.params.guildId));
        if (!guild) return res.status(404).json({ error: 'guild_not_found' });
        const db = client.db, gid = guild.id;
        const { PermissionsBitField: P } = require('discord.js');
        const { isPremium } = require('./plugins/premium.js');
        const guard = require('./lib/verify-guard.js');
        const s = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?').get(gid) || {};
        const me = guild.members.me;
        const chan = id => (id ? guild.channels.cache.get(String(id)) : null);
        const checks = [];
        const add = (ok, label, fix, section = null) => checks.push({ ok: !!ok, label, fix: ok ? null : fix, section: ok ? null : section });

        add(require('./lib/modlog.js').resolveModLog(guild, db), 'Mod-log channel set', 'Pick a mod-log channel in General settings.', 'general');
        add(me?.permissions.has(P.Flags.ManageRoles), 'Bot can manage roles', 'Give the bot the Manage Roles permission.');

        const premium = !!isPremium(db, gid);
        const verifyOn = !!s.verify_enabled;
        if (verifyOn) {
            const roleOk = id => { const r = guild.roles.cache.get(String(id)); return r && !guard.validateVerifyRole(guild, r, null); };
            add(premium, 'Premium active', 'Verification is paused: renew Premium.');
            add(!s.verify_role_id || roleOk(s.verify_role_id), 'Verified role usable', 'The verified role is above the bot or has admin permissions. Pick another in Verification.', 'verify');
            add(!s.verify_unverified_role_id || roleOk(s.verify_unverified_role_id), 'Unverified role usable', 'The unverified role is above the bot or has admin permissions. Pick another in Verification.', 'verify');
            add(chan(s.verify_panel_channel_id), 'Verify panel posted', 'Run /verify panel so members with closed DMs can verify.');
            if (Number(s.verify_kick_days) > 0)
                add(me?.permissions.has(P.Flags.KickMembers), 'Bot can kick members', 'Auto-kick is on: give the bot the Kick Members permission.');
        }

        const stats = { passed: 0, failed: 0, kicked: 0, spam: 0 };
        try {
            const since = Math.floor(Date.now() / 1000) - 7 * 86400;
            for (const r of db.prepare('SELECT kind, COUNT(*) AS n FROM verify_events WHERE guild_id = ? AND ts >= ? GROUP BY kind').all(gid, since))
                if (r.kind in stats) stats[r.kind] = r.n;
            db.prepare('DELETE FROM verify_events WHERE ts < ?').run(since - 23 * 86400);
        } catch {} // table is created on the first verify event

        res.json({ checks, verifyEnabled: verifyOn, premium, stats });
    } catch (e) {
        console.error(`[HEALTH-API] guild=${req.params.guildId}:`, e.message);
        res.status(500).json({ error: 'internal' });
    }
});

// ── GENERAL SETTINGS API (dashboard) ──
const GENERAL_FIELDS = {
    joinRoleId: 'join_role_id',
    modLogChannel: 'mod_log_channel',
    logChannel: 'log_channel',
    rulesChannel: 'rules_channel',
    updatesChannel: 'updates_channel',
};
const isTextChan = c => c && (c.type === 0 || c.type === 5);
function canBotSend(guild, channel) {
    const me = guild.members.me;
    if (!me || !channel) return false;
    const perms = channel.permissionsFor(me);
    return !!perms && perms.has(['ViewChannel', 'SendMessages']);
}

function isMemberVisible(guild, channel) {
    const everyone = channel.permissionsFor(guild.roles.everyone);
    return !!everyone && everyone.has('ViewChannel');
}


apiApp.get('/api/lydia/:guildId', requireAdmin, async (req, res) => {
    try {
        const a = await verifyActor(req.params.guildId, req.query.userId);
        if (a.error) return res.status(a.code).json({ error: a.error });
        const g = a.guild, db = client.db;
        const row = db.prepare('SELECT ai_enabled FROM server_settings WHERE guild_id = ?').get(g.id) || {};
        const active = db.prepare('SELECT channel_id FROM lydia_agents WHERE channel_id IN (' +
            [...g.channels.cache.keys()].map(() => '?').join(',') + ') AND is_active = 1')
            .all(...g.channels.cache.keys()).map(r => r.channel_id);
        const channels = [...g.channels.cache.values()].filter(c => c.type === 0 && canBotSend(g, c) && isMemberVisible(g, c))
            .sort((x, y) => x.rawPosition - y.rawPosition)
            .map(c => ({ id: c.id, name: c.name, category: c.parent?.name || null }));
        let models = []; try { models = (require('./plugins/lydia.js').MODEL_POOL || []).map(m => ({ id: m.id, label: m.name })); } catch (e) {}
        res.json({ enabled: row.ai_enabled !== 0, activeChannelIds: active, channels, models });
    } catch (e) {
        console.error(`[LYDIA-API] get guild=${req.params.guildId}:`, e.message);
        res.status(500).json({ error: 'internal' });
    }
});

apiApp.post('/api/lydia/:guildId', requireAdmin, async (req, res) => {
    try {
        const a = await verifyActor(req.params.guildId, req.body?.userId);
        if (a.error) return res.status(a.code).json({ error: a.error });
        const g = a.guild, db = client.db;
        const { channelId, enabled } = req.body || {};
        if (!channelId || typeof channelId !== 'string') return res.status(400).json({ error: 'channelId required' });
        const ch = g.channels.cache.get(channelId);
        if (!ch || ch.type !== 0) return res.status(400).json({ error: 'channel not found or not a text channel' });

        db.prepare('INSERT OR REPLACE INTO lydia_agents (channel_id, agent_key, is_active, updated_at) VALUES (?, ?, ?, strftime(\'%s\',\'now\'))')
            .run(channelId, 'default', enabled ? 1 : 0);

        if (!client.lydiaChannels) client.lydiaChannels = {};
        if (enabled) client.lydiaChannels[channelId] = true;
        else delete client.lydiaChannels[channelId];

        res.json({ success: true, channelId, enabled: !!enabled });
    } catch (e) {
        console.error(`[LYDIA-API] post guild=${req.params.guildId}:`, e.message);
        res.status(500).json({ error: 'internal' });
    }
});

apiApp.get('/api/general/:guildId', requireAdmin, async (req, res) => {
    try {
        const a = await verifyActor(req.params.guildId, req.query.userId);
        if (a.error) return res.status(a.code).json({ error: a.error });
        const g = a.guild, db = client.db;
        const row = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?').get(g.id) || {};
        const settings = {};
        for (const [k, col] of Object.entries(GENERAL_FIELDS)) settings[k] = row[col] ? String(row[col]) : null;
        // An auto-role saved by the old .settings command lives in auto_role_id: show it, the bot applies it
        if (!settings.joinRoleId && row.auto_role_id) settings.joinRoleId = String(row.auto_role_id);
        const channels = [...g.channels.cache.values()].filter(isTextChan)
            .sort((x, y) => x.rawPosition - y.rawPosition)
            .map(c => ({ id: c.id, name: c.name, category: c.parent?.name || null }));
        const roles = [...g.roles.cache.values()]
            .filter(r => r.id !== g.id && !r.managed)
            .sort((x, y) => y.position - x.position)
            .map(r => {
                const reason = _vg.validateVerifyRole(g, r, a.member);
                return { id: r.id, name: r.name, eligible: !reason, reason: reason ? _vg.GUARD_MSG[reason] : null };
            });
        const fallbacks = {};
        if (g.id === process.env.GUILD_ID) {
            const ENV = { modLogChannel: 'MOD_LOG_CHANNEL_ID', logChannel: 'LOG_CHANNEL_ID', rulesChannel: 'RULES_CHANNEL_ID', updatesChannel: 'UPDATES_CHANNEL_ID', welcomeChannel: 'WELCOME_CHANNEL_ID', goodbyeChannel: 'GOODBYE_CHANNEL_ID' };
            for (const [k, e] of Object.entries(ENV)) {
                const c = process.env[e] ? g.channels.cache.get(process.env[e]) : null;
                if (c) fallbacks[k] = { id: c.id, name: c.name };
            }
            const r = process.env.AUTO_ROLE_ID ? g.roles.cache.get(process.env.AUTO_ROLE_ID) : null;
            if (r) fallbacks.joinRoleId = { id: r.id, name: r.name };
        }
        res.json({ settings, channels, roles, fallbacks });
    } catch (e) {
        console.error(`[GENERAL-API] get guild=${req.params.guildId}:`, e.message);
        res.status(500).json({ error: 'internal' });
    }
});

apiApp.post('/api/general/:guildId', requireAdmin, async (req, res) => {
    try {
        const { userId, settings } = req.body || {};
        if (!settings || typeof settings !== 'object' || Array.isArray(settings))
            return res.status(400).json({ error: 'settings_required' });
        const unknown = Object.keys(settings).filter(k => !(k in GENERAL_FIELDS));
        if (unknown.length) return res.status(400).json({ error: 'unknown_fields', fields: unknown });
        const a = await verifyActor(req.params.guildId, userId);
        if (a.error) return res.status(a.code).json({ error: a.error });
        const g = a.guild, db = client.db;

        const updates = [];
        for (const [k, v] of Object.entries(settings)) {
            if (v !== null && !/^\d{17,20}$/.test(String(v))) return res.status(400).json({ error: `${k}_invalid` });
            if (v !== null) {
                if (k === 'joinRoleId') {
                    const reason = _vg.validateVerifyRole(g, g.roles.cache.get(String(v)), a.member);
                    if (reason) return res.status(400).json({ error: `${k}_rejected`, reason: _vg.GUARD_MSG[reason] });
                } else if (!isTextChan(g.channels.cache.get(String(v)))) {
                    return res.status(400).json({ error: `${k}_not_text_channel` });
                }
            }
            updates.push([GENERAL_FIELDS[k], v === null ? null : String(v)]);
        }

        db.prepare('INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)').run(g.id);
        const tx = db.transaction(() => {
            for (const [col, val] of updates)
                db.prepare(`UPDATE server_settings SET ${col} = ? WHERE guild_id = ?`).run(val, g.id);
            // The auto-role now lives in join_role_id only: clear the old column, or a role removed here would still be given
            if (updates.some(([col]) => col === 'join_role_id'))
                db.prepare('UPDATE server_settings SET auto_role_id = NULL WHERE guild_id = ?').run(g.id);
        });
        tx();
        client.settings?.delete?.(g.id);
        client.invalidateGuildCache?.(g.id);
        console.log(`[GENERAL-API] update guild=${g.id} by=${a.member.id} ${JSON.stringify(settings)}`);
        res.json({ success: true });
    } catch (e) {
        console.error(`[GENERAL-API] post guild=${req.params.guildId}:`, e.stack || e.message);
        res.status(500).json({ error: 'internal' });
    }
});

// ── ROLE SETTINGS API (dashboard) ── same rules as /roles (lib/role-rules.js)
async function rolesActor(guildId, userId) {
    const a = await verifyActor(guildId, userId);
    if (a.error) return a;
    if (!require('./lib/role-rules').canManage(a.member)) return { code: 403, error: 'forbidden_roles' };
    return a;
}

apiApp.get('/api/roles-config/:guildId', requireAdmin, async (req, res) => {
    try {
        const a = await rolesActor(req.params.guildId, req.query.userId);
        if (a.error) return res.status(a.code).json({ error: a.error });
        const RR = require('./lib/role-rules');
        const g = a.guild, saved = RR.readSlots(client.db, g.id);
        const owner = g.id === process.env.GUILD_ID;
        const slots = RR.SLOTS.map(s => {
            const id = saved[s.key];
            const envId = !id && owner && process.env[s.env] && g.roles.cache.has(process.env[s.env]) ? process.env[s.env] : null;
            const role = id ? g.roles.cache.get(id) : null;
            const err = id ? RR.checkRole(g, role, s.profile, null) : null;
            return { key: s.key, group: s.group, profile: s.profile, roleId: id, envRoleId: envId, problem: err ? err.code : null, perms: err?.perms || [] };
        });
        const me = g.members.me;
        const roles = [...g.roles.cache.values()]
            .filter(r => r.id !== g.id && !r.managed)
            .sort((x, y) => y.position - x.position)
            .slice(0, 250)
            .map(r => {
                const grant = RR.checkRole(g, r, 'grant', a.member);
                const staff = RR.checkRole(g, r, 'staff', a.member);
                return { id: r.id, name: r.name, color: r.hexColor, grant: grant ? grant.code : null, staff: staff ? staff.code : null, perms: grant?.perms || [] };
            });
        res.json({ slots, roles, botRole: me ? me.roles.highest.name : null });
    } catch (e) {
        console.error(`[ROLES-API] get guild=${req.params.guildId}:`, e.message);
        res.status(500).json({ error: 'internal' });
    }
});

apiApp.post('/api/roles-config/:guildId', requireAdmin, async (req, res) => {
    try {
        const { userId, changes } = req.body || {};
        if (!changes || typeof changes !== 'object' || Array.isArray(changes) || !Object.keys(changes).length)
            return res.status(400).json({ error: 'changes_required' });
        const RR = require('./lib/role-rules');
        const unknown = Object.keys(changes).filter(k => !RR.BY_KEY[k]);
        if (unknown.length) return res.status(400).json({ error: 'unknown_fields', fields: unknown });
        for (const v of Object.values(changes))
            if (v !== null && !/^\d{17,20}$/.test(String(v))) return res.status(400).json({ error: 'role_invalid' });
        const a = await rolesActor(req.params.guildId, userId);
        if (a.error) return res.status(a.code).json({ error: a.error });
        const g = a.guild, db = client.db;
        { const _wait = client.rateWait(`roles-api:${g.id}`, 10, 60000); if (_wait) return res.set('Retry-After', String(_wait)).status(429).json({ error: 'slow_down', retryAfter: _wait }); }

        const current = RR.readSlots(db, g.id);
        const v = RR.validateChanges(g, current, changes, a.member);
        if (!v.ok) return res.status(400).json({ error: 'role_rejected', slot: v.slot, code: v.err.code, perms: v.err.perms || [] });
        const done = RR.writeSlots(client, db, g.id, current, v.next);
        if (done.length) {
            console.log(`[ROLES-API] update guild=${g.id} by=${a.member.id} ${JSON.stringify(done)}`);
            const lang = require('./lib/pick-lang').pickLang(client, g.id, null, a.member.id) || 'en';
            await RR.logChanges(g, db, done, a.member.id, 'dashboard', lang);
        }
        res.json({ success: true, changed: done.map(c => c.key) });
    } catch (e) {
        console.error(`[ROLES-API] post guild=${req.params.guildId}:`, e.stack || e.message);
        res.status(500).json({ error: 'internal' });
    }
});

// ── COMMAND TOGGLES ──
const LOCKED_COMMANDS = new Set(['help', 'verify', 'serversettings', 'settings', 'premium', 'dashboard', 'channels', 'roles']);
const _toggleCache = new Map();
const HIDDEN_CATS = new Set(['SYSTEM', 'OWNER']);
const catOf = cmd => String(cmd?.category || 'GENERAL').toUpperCase();
function getToggles(guildId) {
    let t = _toggleCache.get(guildId);
    if (!t) {
        const row = db.prepare('SELECT disabled_commands, disabled_categories FROM server_settings WHERE guild_id = ?').get(guildId) || {};
        
        // SÉCURITÉ : On s'assure que c'est toujours un tableau, même si la DB contient "null" ou une chaîne
        const safeCmds = parseJSONSafe(row.disabled_commands, []);
        const safeCats = parseJSONSafe(row.disabled_categories, []);
        
        t = { 
            cmds: new Set(Array.isArray(safeCmds) ? safeCmds : []), 
            cats: new Set((Array.isArray(safeCats) ? safeCats : []).map(c => String(c).toUpperCase())) 
        };
        _toggleCache.set(guildId, t);
    }
    return t;
}
function isCommandDisabled(guildId, command) {
    if (!guildId || !command || LOCKED_COMMANDS.has(command.name)) return false;
    const t = getToggles(guildId);
    return t.cmds.has(command.name) || t.cats.has(catOf(command));
}
function listToggleable() {
    const out = [];
    for (const [name, cmd] of client.commands) {
        const cat = catOf(cmd);
        if (cmd.hidden || cmd.ownerOnly || HIDDEN_CATS.has(cat)) continue;
        if (/TELEGRAM|WHATSAPP|BRIDGE/.test(cat) || (cmd.platform && cmd.platform !== 'discord') || cmd._source === 'telegram') continue;
        out.push({ name, description: cmd.description || '', category: cat, locked: LOCKED_COMMANDS.has(name) });
    }
    return out.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

apiApp.get('/api/commands-config/:guildId', requireAdmin, async (req, res) => {
    try {
        const a = await verifyActor(req.params.guildId, req.query.userId);
        if (a.error) return res.status(a.code).json({ error: a.error });
        const t = getToggles(a.guild.id);
        res.json({ commands: listToggleable(), disabledCommands: [...t.cmds], disabledCategories: [...t.cats] });
    } catch (e) {
        console.error(`[CMDS-API] get guild=${req.params.guildId}:`, e.message);
        res.status(500).json({ error: 'internal' });
    }
});

apiApp.post('/api/commands-config/:guildId', requireAdmin, async (req, res) => {
    try {
        const { userId, disabledCommands, disabledCategories } = req.body || {};
        const isStrArr = v => Array.isArray(v) && v.length <= 300 && v.every(x => typeof x === 'string' && x.length <= 64);
        if (!isStrArr(disabledCommands) || !isStrArr(disabledCategories)) return res.status(400).json({ error: 'invalid_lists' });
        const a = await verifyActor(req.params.guildId, userId);
        if (a.error) return res.status(a.code).json({ error: a.error });

        const all = listToggleable();
        const names = new Set(all.filter(c => !c.locked).map(c => c.name));
        const cats = new Set(all.map(c => c.category));
        const cmdsOut = [...new Set(disabledCommands)].filter(n => names.has(n));
        const catsOut = [...new Set(disabledCategories)].filter(c => cats.has(c));

        const gid = a.guild.id;
        db.prepare('INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)').run(gid);
        db.prepare('UPDATE server_settings SET disabled_commands = ?, disabled_categories = ? WHERE guild_id = ?')
            .run(JSON.stringify(cmdsOut), JSON.stringify(catsOut), gid);
        _toggleCache.delete(gid);
        client.settings?.delete?.(gid);
        client.invalidateGuildCache?.(gid);
        console.log(`[CMDS-API] update guild=${gid} by=${a.member.id} cmds=${cmdsOut.length} cats=${catsOut.length}`);
        res.json({ success: true, disabledCommands: cmdsOut, disabledCategories: catsOut });
    } catch (e) {
        console.error(`[CMDS-API] post guild=${req.params.guildId}:`, e.stack || e.message);
        res.status(500).json({ error: 'internal' });
    }
});

// ── PUBLIC COMMAND LIST (website) ──
apiApp.get('/api/public-commands', (req, res) => {
    try {
        const commands = listToggleable().map(c => ({
            name: c.name, description: c.description, category: c.category,
            slash: !!client.commands.get(c.name)?.data,
        }));
        res.set('Cache-Control', 'public, max-age=300');
        res.json({ commands });
    } catch (e) {
        console.error('[PUBLIC-CMDS]', e.message);
        res.status(500).json({ error: 'internal' });
    }
});

// ── TICKET SETTINGS API ──
const TICKET_CAT_LIMIT_FREE = 3, TICKET_CAT_LIMIT_PREMIUM = 8;
function validateCategory(c) {
    if (typeof c !== 'object' || !c) return 'not an object';
    if (!c.label || typeof c.label !== 'string' || c.label.length > 32) return 'label must be a string under 32 chars';
    if (!c.value || typeof c.value !== 'string' || !/^[a-z0-9_-]{1,32}$/.test(c.value)) return 'value must be lowercase a-z, 0-9, _ or -';
    if (!c.emoji || typeof c.emoji !== 'string' || c.emoji.length > 64) return 'emoji required'; // custom emojis <:name:id> are allowed
    if (c.desc && (typeof c.desc !== 'string' || c.desc.length > 100)) return 'desc must be under 100 chars';
    return null;
}

apiApp.get('/api/ticket-config/:guildId', requireAdmin, async (req, res) => {
    try {
        const a = await verifyActor(req.params.guildId, req.query.userId);
        if (a.error) return res.status(a.code).json({ error: a.error });
        const g = a.guild, db = client.db, gid = g.id;
        const { isPremium } = require('./plugins/premium.js');
        const row = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?').get(gid) || {};
        const cats = parseJSONSafe(row.ticket_categories_config, null);
        const isTextChan = c => c && (c.type === 0 || c.type === 5);
        const isCatChan = c => c && c.type === 4;
        const channels = [...g.channels.cache.values()].filter(isTextChan).sort((x,y) => x.rawPosition - y.rawPosition).map(c => ({ id: c.id, name: c.name, category: c.parent?.name || null }));
        const categories = [...g.channels.cache.values()].filter(isCatChan).sort((x,y) => x.rawPosition - y.rawPosition).map(c => ({ id: c.id, name: c.name }));
        const _RR = require('./lib/role-rules');
        const roles = [...g.roles.cache.values()].filter(r => r.id !== gid && !r.managed).sort((x,y) => y.position - x.position).map(r => { const err = _RR.checkRole(g, r, 'staff', a.member); return { id: r.id, name: r.name, eligible: !err, reason: err ? _RR.reasonText(err, 'en') : null }; });
        res.json({
            premium: !!isPremium(db, gid),
            settings: {
                ticketCategory: row.ticket_category || null,
                ticketStaffRole: row.ticket_staff_role || null,
                ticketTranscriptChannel: row.ticket_transcript_channel || null,
                ticketLogChannel: row.ticket_log_channel || null,
                ticketAutoCloseHours: Number(row.ticket_auto_close_hours ?? 24),
                ticketLimitPerUser: Number(row.ticket_limit_per_user ?? 1),
                ticketPanelChannel: row.ticket_panel_channel || null,
                ticketPanelChannelName: row.ticket_panel_channel_name || row.ticket_panel_channel || null,
                ticketCategoriesConfig: cats,
            },
            channels, categories, roles,
            fallbacks: (() => {
                const f = {};
                if (gid !== process.env.GUILD_ID) return f;
                const chanEnv = { ticketCategory: 'TICKET_CATEGORY_ID', ticketTranscriptChannel: 'TICKET_TRANSCRIPT_CHANNEL_ID', ticketLogChannel: 'TICKET_LOG_CHANNEL_ID' };
                for (const [k, e] of Object.entries(chanEnv)) {
                    const c = process.env[e] ? g.channels.cache.get(process.env[e]) : null;
                    if (c) f[k] = { id: c.id, name: c.name };
                }
                const r = process.env.TICKET_STAFF_ROLE_ID ? g.roles.cache.get(process.env.TICKET_STAFF_ROLE_ID) : null;
                if (r) f.ticketStaffRole = { id: r.id, name: r.name };
                if (process.env.TICKET_AUTO_CLOSE_HOURS) f.ticketAutoCloseHours = { name: `${process.env.TICKET_AUTO_CLOSE_HOURS}h` };
                if (process.env.TICKET_LIMIT_PER_USER) f.ticketLimitPerUser = { name: process.env.TICKET_LIMIT_PER_USER };
                return f;
            })(),
            catLimits: { free: TICKET_CAT_LIMIT_FREE, premium: TICKET_CAT_LIMIT_PREMIUM },
        });
    } catch (e) { console.error(`[TICKET-API] get guild=${req.params.guildId}:`, e.message); res.status(500).json({ error: 'internal' }); }
});

apiApp.post('/api/ticket-config/:guildId', requireAdmin, async (req, res) => {
    try {
        const { userId, settings } = req.body || {};
        if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return res.status(400).json({ error: 'settings_required' });
        const a = await verifyActor(req.params.guildId, userId);
        if (a.error) return res.status(a.code).json({ error: a.error });
        const g = a.guild, db = client.db, gid = g.id;
        const { isPremium } = require('./plugins/premium.js');
        const premium = !!isPremium(db, gid);
        const allowed = ['ticketCategory','ticketStaffRole','ticketTranscriptChannel','ticketLogChannel','ticketAutoCloseHours','ticketLimitPerUser','ticketCategoriesConfig'];
        const unknown = Object.keys(settings).filter(k => !allowed.includes(k));
        if (unknown.length) return res.status(400).json({ error: 'unknown_fields', fields: unknown });
        const isTextChan = c => c && (c.type === 0 || c.type === 5);
        const isCatChan = c => c && c.type === 4;
        const updates = {};
        for (const [k, v] of Object.entries(settings)) {
            if (k === 'ticketCategoriesConfig') {
                if (!Array.isArray(v)) return res.status(400).json({ error: 'categories_must_be_array' });
                const limit = premium ? TICKET_CAT_LIMIT_PREMIUM : TICKET_CAT_LIMIT_FREE;
                if (v.length > limit) return res.status(400).json({ error: `max_${limit}_categories` });
                for (const c of v) { const err = validateCategory(c); if (err) return res.status(400).json({ error: 'invalid_category', reason: err }); }
                const values = new Set(v.map(c => c.value));
                if (values.size !== v.length) return res.status(400).json({ error: 'duplicate_category_values' });
                updates['ticket_categories_config'] = v.length ? JSON.stringify(v) : null;
            } else if (k === 'ticketAutoCloseHours') {
                if (!Number.isInteger(v) || v < 0 || v > 168) return res.status(400).json({ error: 'autoclose_0_to_168' });
                updates['ticket_auto_close_hours'] = v;
            } else if (k === 'ticketLimitPerUser') {
                if (!Number.isInteger(v) || v < 1 || v > 10) return res.status(400).json({ error: 'limit_1_to_10' });
                updates['ticket_limit_per_user'] = v;
            } else if (k === 'ticketStaffRole') {
                if (v !== null) { if (!/^\d{17,20}$/.test(String(v))) return res.status(400).json({ error: 'staffRole_invalid' }); const _RR = require('./lib/role-rules'); const err = _RR.checkRole(g, g.roles.cache.get(String(v)), 'staff', a.member); if (err) return res.status(400).json({ error: 'staffRole_rejected', reason: _RR.reasonText(err, 'en') }); }
                updates['ticket_staff_role'] = v === null ? null : String(v);
            } else if (k === 'ticketCategory') {
                if (v !== null) { if (!/^\d{17,20}$/.test(String(v))) return res.status(400).json({ error: 'category_invalid' }); if (!isCatChan(g.channels.cache.get(String(v)))) return res.status(400).json({ error: 'must_be_category_channel' }); }
                updates['ticket_category'] = v === null ? null : String(v);
            } else {
                if (v !== null && !/^\d{17,20}$/.test(String(v))) return res.status(400).json({ error: `${k}_invalid` });
                if (v !== null && !isTextChan(g.channels.cache.get(String(v)))) return res.status(400).json({ error: `${k}_not_text_channel` });
                updates[{ ticketTranscriptChannel:'ticket_transcript_channel', ticketLogChannel:'ticket_log_channel' }[k]] = v === null ? null : String(v);
            }
        }
        db.prepare('INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)').run(gid);
        const tx = db.transaction(() => { for (const [col, val] of Object.entries(updates)) db.prepare(`UPDATE server_settings SET ${col} = ? WHERE guild_id = ?`).run(val, gid); });
        tx();
        client.settings?.delete?.(gid); client.invalidateGuildCache?.(gid);
        console.log(`[TICKET-API] update guild=${gid} by=${a.member.id}`);
        res.json({ success: true });
    } catch (e) { console.error(`[TICKET-API] post guild=${req.params.guildId}:`, e.stack || e.message); res.status(500).json({ error: 'internal' }); }
});

// ── TICKET CHANNEL AUTO-CREATE ──
// The dashboard's Overview: what happened today and what is waiting for the staff. Numbers only.
apiApp.get('/api/overview/:guildId', requireAdmin, async (req, res) => {
    try {
        const a = await verifyActor(req.params.guildId, req.query.userId);
        if (a.error) return res.status(a.code).json({ error: a.error });
        const g = a.guild, db = client.db, gid = g.id, now = Date.now(), day = now - 86400000;
        const one = (sql, ...p) => { try { return db.prepare(sql).get(...p) || {}; } catch (e) { return {}; } }; // a table may not exist yet
        const all = (sql, ...p) => { try { return db.prepare(sql).all(...p); } catch (e) { return []; } };

        const joinedWeek = one('SELECT COUNT(*) AS n FROM member_joins WHERE guild_id = ? AND joined_at >= ?', gid, now - 7 * 86400000).n || 0;

        // Commands in the last 24 hours; ".quiz" and "/trivia" count as the same command
        const alias = new Map();
        for (const c of client.commands?.values?.() || []) {
            const name = String(c.name || c.data?.name || '').toLowerCase(); if (!name) continue;
            for (const al of c.aliases || []) alias.set(String(al).toLowerCase(), name);
            const slash = c.data?.name ? String(c.data.name).toLowerCase() : null;
            if (slash && slash !== name) alias.set(slash, name);
        }
        const used = new Map(); let commands24h = 0;
        for (const r of all('SELECT command, COUNT(*) AS n FROM command_events WHERE guild_id = ? AND ts >= ? GROUP BY command', gid, day)) {
            const name = alias.get(String(r.command).toLowerCase()) || String(r.command).toLowerCase();
            used.set(name, (used.get(name) || 0) + r.n); commands24h += r.n;
        }
        const topCommand = [...used].sort((x, y) => y[1] - x[1])[0]?.[0] || null;

        const am = { total: 0, timeouts: 0, bans: 0 };
        for (const r of all("SELECT action, COUNT(*) AS n FROM moderation_logs WHERE guild_id = ? AND moderator_id = ? AND reason LIKE 'AutoMod:%' AND timestamp >= ? GROUP BY action", gid, client.user.id, Math.floor(day / 1000))) {
            am.total += r.n; if (r.action === 'timeout') am.timeouts += r.n; if (r.action === 'ban') am.bans += r.n;
        }

        const open = all("SELECT ticket_number AS number, claimed_by, created_at FROM tickets WHERE guild_id = ? AND (status IS NULL OR status = 'open') ORDER BY created_at ASC", gid);
        const waiting = open.filter((r) => !r.claimed_by);
        const vOn = !!one('SELECT verify_enabled AS v FROM server_settings WHERE guild_id = ?', gid).v;
        const verifyPending = vOn ? (one('SELECT COUNT(*) AS n FROM verify_pending WHERE guild_id = ?', gid).n || 0) : 0;

        res.json({
            members: g.memberCount || 0, joinedWeek,
            commands24h, topCommand,
            automod24h: am.total, automodTimeouts: am.timeouts, automodBans: am.bans,
            ticketsOpen: open.length, ticketsWaiting: waiting.length,
            oldestWaiting: waiting[0] ? { number: waiting[0].number, since: Number(waiting[0].created_at) || null } : null,
            verifyPending,
        });
    } catch (e) { console.error(`[OVERVIEW-API] guild=${req.params.guildId}:`, e.message); res.status(500).json({ error: 'internal' }); }
});

// Ticket numbers for the dashboard: open now, closed this week, rating, how long until someone takes a ticket
apiApp.get('/api/ticket-stats/:guildId', requireAdmin, async (req, res) => {
    try {
        const a = await verifyActor(req.params.guildId, req.query.userId);
        if (a.error) return res.status(a.code).json({ error: a.error });
        const g = a.guild, db = client.db, gid = g.id, now = Date.now();
        const open = db.prepare("SELECT ticket_number AS number, creator_id, creator_tag, category, claimed_by, created_at FROM tickets WHERE guild_id = ? AND (status IS NULL OR status = 'open') ORDER BY created_at DESC").all(gid);
        const closedWeek = db.prepare("SELECT COUNT(*) AS c FROM tickets WHERE guild_id = ? AND status = 'closed' AND closed_at >= ?").get(gid, now - 7 * 86400000)?.c || 0;
        const rating = db.prepare('SELECT AVG(stars) AS a, COUNT(*) AS c FROM ticket_ratings WHERE guild_id = ?').get(gid) || {};
        const claim = db.prepare('SELECT AVG(claimed_at - created_at) AS ms, COUNT(*) AS c FROM tickets WHERE guild_id = ? AND claimed_at IS NOT NULL AND created_at >= ?').get(gid, now - 30 * 86400000) || {};
        const name = (id) => { const m = id ? g.members.cache.get(String(id)) : null; return m ? (m.displayName || m.user.username) : null; };
        res.json({
            open: open.length,
            closedWeek,
            rating: rating.c ? Math.round(rating.a * 10) / 10 : null,
            ratings: rating.c || 0,
            claimMinutes: claim.c ? Math.round(claim.ms / 60000) : null,
            list: open.slice(0, 10).map((r) => ({ number: r.number, member: name(r.creator_id) || (r.creator_tag || '').split('#')[0] || null, category: r.category || null, staff: name(r.claimed_by), claimed: !!r.claimed_by, openedAt: Number(r.created_at) || null })),
        });
    } catch (e) { console.error(`[TICKET-API] stats guild=${req.params.guildId}:`, e.message); res.status(500).json({ error: 'internal' }); }
});

apiApp.post('/api/ticket-config/:guildId/create-channels', requireAdmin, async (req, res) => {
    try {
        const { userId } = req.body || {};
        const a = await verifyActor(req.params.guildId, userId);
        if (a.error) return res.status(a.code).json({ error: a.error });
        const g = a.guild, db = client.db, gid = g.id;
        const { PermissionsBitField: P, ChannelType } = require('discord.js');
        const me = g.members.me;
        if (!me?.permissions.has(P.Flags.ManageChannels)) return res.status(403).json({ error: 'bot_missing_manage_channels' });

        const category = await g.channels.create({
            name: '🛠️ STAFF & SUPPORT', type: ChannelType.GuildCategory,
        });
        const supportCh = await g.channels.create({
            name: '🎫-・support-tickets', type: ChannelType.GuildText, parent: category.id,
        });
        const transcriptCh = await g.channels.create({
            name: '📝-・transcript-logs', type: ChannelType.GuildText, parent: category.id,
            permissionOverwrites: [
                { id: g.roles.everyone.id, deny: [P.Flags.ViewChannel] },
                { id: me.id, allow: [P.Flags.ViewChannel, P.Flags.SendMessages] },
            ],
        });
        const row = db.prepare('SELECT ticket_staff_role FROM server_settings WHERE guild_id = ?').get(gid);
        if (row?.ticket_staff_role) {
            await transcriptCh.permissionOverwrites.edit(row.ticket_staff_role, { ViewChannel: true }).catch(() => {});
        }

        db.prepare('INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)').run(gid);
        db.prepare('UPDATE server_settings SET ticket_category = ?, ticket_transcript_channel = ? WHERE guild_id = ?')
            .run(category.id, transcriptCh.id, gid);
        client.settings?.delete?.(gid); client.invalidateGuildCache?.(gid);
        console.log(`[TICKET-API] channels created guild=${gid} by=${a.member.id}`);
        res.json({
            success: true,
            category: { id: category.id, name: category.name },
            supportChannel: { id: supportCh.id, name: supportCh.name },
            transcriptChannel: { id: transcriptCh.id, name: transcriptCh.name },
        });
    } catch (e) {
        console.error(`[TICKET-API] create-channels guild=${req.params.guildId}:`, e.stack || e.message);
        res.status(500).json({ error: 'internal' });
    }
});

apiApp.post('/api/update-config', requireAdmin, (req, res) => {
    const { guildId, settings } = req.body;
    if (!guildId || !settings) return res.status(400).json({ error: 'Missing fields' });
    const blockedKeys = Object.keys(settings).filter(k => /^(verify_|join_?role|disabled)/i.test(k));
    if (blockedKeys.length) return res.status(400).json({ error: 'Use /api/verify for verification settings', blocked: blockedKeys });

    try {
        let updated = 0;
        for (const [key, value] of Object.entries(settings)) {
            const val = (value === null || value === undefined || value === 'null') ? null : String(value);
            if (updateServerSetting(guildId, key, val)) updated++;
        }
        client.settings.delete(guildId);
        client.invalidateGuildCache(guildId);
        // Discord's own invite rule follows the invite filter set from the dashboard
        if (Object.keys(settings).some(k => /^invite_?filter/i.test(k))) {
            const g = client.guilds.cache.get(String(guildId));
            const ss = client.getServerSettings?.(String(guildId));
            if (g && ss?.autoModEnabled) require('./plugins/automod.js').syncRules(g, 'invite', ss).catch(() => {});
        }
        res.json({ success: true, updated, guildId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



// ─── LANGUAGES ───────────────────────────────────────────────────────────────
apiApp.get('/api/languages', (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const langDir = path.join(__dirname, 'lib/lang');
        const files = fs.readdirSync(langDir).filter(f => f.endsWith('.json'));
        const languages = files.map(f => {
            const code = f.replace('.json', '');
            const names = { en: '🇬🇧 English', fr: '🇫🇷 French', ar: '🇸🇦 Arabic', bm: '🇲🇱 Bambara', zh: '🇨🇳 Chinese' };
            return { code, label: names[code] || code };
        });
        languages.unshift({ code: 'auto', label: '🌐 Auto Detect' });
        res.json({ languages });
    } catch(err) {
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

// TOP.GG VOTE WEBHOOK
// v1: x-topgg-signature "t=<unix time>,v1=<hex HMAC-SHA256 of 't.rawBody'>" signed with the webhook secret (whs_…);
// legacy v0: the secret in the Authorization header. A refused request is logged with the reason, once per 10 minutes.
const voteRefusals = { last: 0, quiet: 0 };
function voteRefused(reason) {
    const now = Date.now();
    if (now - voteRefusals.last < 600000) { voteRefusals.quiet++; return; }
    const more = voteRefusals.quiet ? ` (${voteRefusals.quiet} more refused since the last line)` : '';
    voteRefusals.last = now; voteRefusals.quiet = 0;
    console.warn(`[VOTE] Top.gg webhook refused: ${reason}${more}`);
}
apiApp.post('/api/vote', (req, res) => {
    const secret = String(process.env.TOPGG_WEBHOOK_SECRET || '').trim();
    if (!secret) return res.status(503).json({ error: 'not_configured' });
    const crypto = require('crypto');
    const safeEq = (a, b) => {
        const x = Buffer.from(String(a)), y = Buffer.from(String(b));
        return x.length === y.length && crypto.timingSafeEqual(x, y);
    };
    const rb = req.rawBody;
    const raw = Buffer.isBuffer(rb) ? rb.toString('utf8') : String(rb || '');
    const sig = String(req.headers['x-topgg-signature'] || '');
    let t = null;
    const v1 = [];
    for (const kv of sig.split(',')) {
        const k = kv.indexOf('=');
        if (k <= 0) continue;
        const key = kv.slice(0, k).trim(), val = kv.slice(k + 1).trim();
        if (key === 't') t = val;
        else if (key === 'v1') v1.push(val);
    }

    let ok = false, why = '';
    if (t && v1.length && raw) {
        const ts = Number(t) > 1e12 ? Number(t) / 1000 : Number(t);      // seconds, or milliseconds
        const skew = Math.round(Date.now() / 1000 - ts);
        if (!Number.isFinite(ts) || Math.abs(skew) > 300) why = `the signature time is ${skew} s away from the server clock (check the VPS time)`;
        else {
            const expected = crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
            ok = v1.some((s) => safeEq(expected, s));
            if (!ok) why = 'the signature does not match TOPGG_WEBHOOK_SECRET. Copy the secret (whs_…) from top.gg → your bot → Webhooks into .env, restart, then press "Send test" on top.gg';
        }
    } else if (sig) {
        why = raw ? 'the x-topgg-signature header is incomplete' : 'the request body is empty';
    } else if (req.headers['authorization']) {
        ok = safeEq(req.headers['authorization'], secret); // legacy v0
        if (!ok) why = 'the Authorization header does not match TOPGG_WEBHOOK_SECRET';
    } else {
        why = 'no signature and no Authorization header (not a Top.gg request)';
    }
    if (!ok) {
        voteRefused(why);
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = req.body || {};
    if (body.type === 'webhook.test') {
        console.log('[VOTE] test webhook verified ✓');
        return res.json({ success: true, test: true });
    }

    const user = String(body.data?.user?.platform_id || body.user || '');
    if (!/^\d{17,20}$/.test(user)) return res.status(400).json({ error: 'Missing user' });
    const isWeekend = (body.data?.weight ?? 1) > 1 || !!body.isWeekend;
    console.log(`[VOTE] Received from user ${user} | weekend: ${isWeekend}`);

    try {
        const votesync = require('./plugins/votesync.js');
        (async () => {
            // The server the vote was made from: the vote links carry ?guild=<id> (v1 sends it parsed in data.query,
            // v0 as a query string). Without it every webhook vote went to the member's "home" server, so the other
            // servers' vote counts (and their dashboards) never moved.
            let fromGuild = body.data?.query?.guild;
            if (!fromGuild && typeof body.query === 'string') { try { fromGuild = new URLSearchParams(body.query.replace(/^\?/, '')).get('guild'); } catch {} }
            let gid = null;
            if (/^\d{17,20}$/.test(String(fromGuild || ''))) {
                const g = client.guilds.cache.get(String(fromGuild));
                if (g && (g.members.cache.has(user) || await g.members.fetch(user).catch(() => null))) gid = g.id;
            }
            if (!gid) gid = await votesync.resolveHomeGuild(user, client);
            if (!gid) return console.warn(`[VOTE] no home server for ${user} — skipped`);
            const r = await votesync.processVote(user, gid, client, { source: 'webhook', weekend: isWeekend });
            if (!r.success) console.warn(`[VOTE] ${user}@${gid}: ${r.error}`);
        })().catch(e => console.error('[VOTE] processVote:', e.message));
        res.json({ success: true });
    } catch (err) {
        console.error('[VOTE] Error:', err.message);
        res.status(500).json({ error: 'internal' });
    }
});

// Broadcast endpoint
apiApp.post("/api/broadcast", requireAdmin, (req, res) => {
    const { message, target, guildIds } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });
    let count = 0;
    const allGuilds = client.guilds.cache;

    // Filter by specific guilds if needed
    const targetGuilds = (target === "specific" && guildIds?.length)
        ? new Map([...allGuilds].filter(([id]) => guildIds.includes(id)))
        : allGuilds;

    targetGuilds.forEach(async (guild) => {
        try {
            const channel = guild.systemChannel ||
                guild.channels.cache.find(c => c.type === 0 && c.permissionsFor(guild.members.me)?.has("SendMessages"));
            if (channel) {
                const { EmbedBuilder } = require("discord.js");
                const embed = new EmbedBuilder()
                    .setColor(0x00f0ff)
                    .setAuthor({ name: "// ARCHON BROADCAST //", iconURL: client.user.displayAvatarURL() })
                    .setDescription(message)
                    .setFooter({ text: `BAMAKO_223 🇲🇱 • Sent to ${targetGuilds.size} server${targetGuilds.size !== 1 ? "s" : ""}` })
                    .setTimestamp();
                await channel.send({ embeds: [embed] });
                count++;
            }
        } catch(e) {}
    });
    setTimeout(() => res.json({ success: true, guildCount: count, total: targetGuilds.size }), 2000);
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

// (the "Online" banner is printed once the bot is really connected, in ClientReady)

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
apiApp.listen(5000, '127.0.0.1', () => {
    console.log('\x1b[32m[API]\x1b[0m Bridge active on port 5000 (127.0.0.1, this server only)');
});

// ================= BOT PROFILE & STATUS =================
const STATUS_MESSAGES = [
    { name: 'ARCHON CG-223 in action', type: 1, url: 'https://www.youtube.com/watch?v=rgl5NLBEAb4' },
    // PLAYING
    { name: 'CODM scrims 🎯', type: 0 },
    { name: 'with Lydia AI 🧠', type: 0 },
    // WATCHING
    { name: 'the weapon meta 🔫', type: 3 },
    { name: 'BAMAKO_223 // ONLINE 🇲🇱', type: 3 },
    // LISTENING
    { name: '/scrim /meta /build /war', type: 2 },
    // COMPETING
    { name: 'clan wars ⚔️', type: 5 },
    { name: 'Best Bot — Mali 🇲🇱', type: 5 },
    // CUSTOM (type 4 — raw text, no verb prefix)
    { name: '🌍 bamako-steel-dev.xyz', type: 4 },
    { name: '🎯 CODM clan bot | /scrim', type: 4 },
    { name: '🎵 530+ tracks | /music', type: 4 },
    { name: '⚔️ Bamako Steel 🇲🇱', type: 4 },
    { name: '⚔️ /war record | track your clan wars', type: 4 },
    { name: '🎮 /help | Try ARCHON', type: 4 },
];

let statusIndex = 0;

// Rotate status every 30 minutes
// Boot sequence and status rotation moved to lib/status-rotator
require('./lib/status-rotator')(client);

client.login((process.env.DISCORD_TOKEN || '').trim().replace(/["']/g, '')).catch(err => {
    console.error('\x1b[31m[LOGIN ERROR]\x1b[0m Failed to connect to Discord:', err.message);
    console.error('\x1b[33m[TIP]\x1b[0m Check your internet connection and token validity.');
});
