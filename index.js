require('dotenv').config(); 

const fs = require('fs');
const path = require('path');
const { Client, Collection, Events, Partials, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');

// IMPORT LYDIA SETUP FUNCTION
const { setupLydia } = require('./plugins/lydia.js');

// ================= SELF-HEALING PROTOCOL =================
process.on('unhandledRejection', (reason, promise) => {
    console.error('\x1b[31m[ANTI-CRASH]\x1b[0m Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err, origin) => {
    console.error('\x1b[31m[ANTI-CRASH]\x1b[0m Uncaught Exception:', err.message);
    console.error(err.stack); 
});

// --- TERMINAL COLORS ---
const green = "\x1b[32m", blue = "\x1b[34m", cyan = "\x1b[36m", yellow = "\x1b[33m", red = "\x1b[31m", reset = "\x1b[0m", bold = "\x1b[1m";

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

// --- SYSTEM GLOBALS ---
client.commands = new Collection();
client.aliases = new Collection();
client.userTimeouts = new Map();
client.settings = new Map();

// --- DYNAMIC VERSIONING ---
function getVersion() {
    try {
        const versionPath = path.join(__dirname, 'version.txt');
        if (fs.existsSync(versionPath)) {
            const version = fs.readFileSync(versionPath, 'utf8').trim();
            return version;
        } else {
            fs.writeFileSync(versionPath, '1.6.0', 'utf8');
            return '1.6.0';
        }
    } catch (err) {
        return '1.6.0';
    }
}

client.version = getVersion();

// --- LYDIA GLOBALS ---
client.lydiaChannels = {};
client.lydiaAgents = {};
client.lastLydiaCall = {};
client.userIntroductions = new Map();

const PREFIX = process.env.PREFIX || ".";

// --- UTILITIES ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const formatNumber = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// ================= 🔥 SAFE UNIVERSAL LANGUAGE DETECTION =================
function detectLanguage(usedCommand) {
    // 🔥 SAFETY CHECK: Handle undefined/null
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
const db = new Database('database.sqlite');

// ================= 🔥 PILLAR 3: HIGH-PERFORMANCE PRAGMA =================
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA synchronous = NORMAL;");
db.exec("PRAGMA cache_size = -64000;");
db.exec("PRAGMA temp_store = MEMORY;");
console.log(`${green}[PRAGMA]${reset} WAL mode enabled - High-performance concurrent mode`);

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
    )`
};

for (const [tableName, createSQL] of Object.entries(requiredTables)) {
    try { 
        db.exec(createSQL); 
    } catch (err) {
        console.error(`${red}[TABLE ERROR]${reset} ${tableName}:`, err.message);
    }
}

// ================= 🔥 PILLAR 1: COLUMN-SPECIFIC SCHEMA GUARD =================
const tableColumns = {
    users: [
        { name: 'games_played', type: 'INTEGER DEFAULT 0' },
        { name: 'games_won', type: 'INTEGER DEFAULT 0' },
        { name: 'total_winnings', type: 'INTEGER DEFAULT 0' },
        { name: 'last_daily', type: 'INTEGER DEFAULT 0' },
        { name: 'streak_days', type: 'INTEGER DEFAULT 0' },
        { name: 'credits', type: 'INTEGER DEFAULT 0' },
        { name: 'total_messages', type: 'INTEGER DEFAULT 0' },
        { name: 'last_xp_gain', type: 'INTEGER DEFAULT 0' },
        { name: 'gaming', type: "TEXT DEFAULT '{\"game\":\"CODM\",\"rank\":\"Unranked\"}'" }
    ],
    lydia_conversations: [
        { name: 'user_name', type: 'TEXT' }
    ],
    server_settings: [
        { name: 'daily_channel', type: 'TEXT' },
        { name: 'shop_channel', type: 'TEXT' }
    ]
};

console.log(`${cyan}[COLUMN GUARD]${reset} Scanning for missing columns...`);
let columnsAdded = 0;

for (const [table, columns] of Object.entries(tableColumns)) {
    try {
        const existingColumns = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
        for (const col of columns) {
            if (!existingColumns.includes(col.name)) {
                console.log(`${yellow}[REPAIR]${reset} Injecting missing column: ${cyan}${col.name}${reset} into ${table}`);
                db.exec(`ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.type}`);
                columnsAdded++;
            }
        }
    } catch (err) {
        console.error(`${red}[COLUMN ERROR]${reset} ${table}:`, err.message);
    }
}

if (columnsAdded > 0) {
    console.log(`${green}[COLUMN GUARD]${reset} Added ${columnsAdded} missing columns`);
} else {
    console.log(`${green}[COLUMN GUARD]${reset} All columns verified - Schema is complete`);
}

// ================= 🔥 PILLAR 2: ATOMIC MIGRATION (TRANSACTION PROTECTED) =================
try {
    const tableInfo = db.prepare(`PRAGMA table_info(server_settings)`).all();
    const languageColumn = tableInfo.find(col => col.name === 'language');
    
    if (languageColumn) {
        console.log(`${yellow}[MIGRATION]${reset} Initiating atomic table rebuild...`);
        
        db.transaction(() => {
            db.exec(`
                CREATE TABLE server_settings_new (
                    guild_id TEXT PRIMARY KEY,
                    prefix TEXT DEFAULT '.',
                    welcome_channel TEXT,
                    log_channel TEXT,
                    daily_channel TEXT,
                    shop_channel TEXT,
                    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
                );
                
                INSERT INTO server_settings_new 
                SELECT guild_id, prefix, welcome_channel, log_channel, daily_channel, shop_channel, updated_at 
                FROM server_settings;
                
                DROP TABLE server_settings;
                ALTER TABLE server_settings_new RENAME TO server_settings;
            `);
        })();
        
        console.log(`${green}[MIGRATION]${reset} Atomic rebuild successful - 'language' column removed safely`);
    }
} catch (err) {
    console.error(`${red}[MIGRATION ERROR]${reset}`, err.message);
}

console.log(`${green}[REPAIR COMPLETE]${reset} All tables verified, columns synchronized, migrations applied`);

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

const loadAgentPreferences = () => {
    try {
        const savedAgents = db.prepare("SELECT * FROM lydia_agents WHERE is_active = 1").all();
        savedAgents.forEach(agent => {
            if (agent.channel_id) {
                client.lydiaChannels[agent.channel_id] = true;
                client.lydiaAgents[agent.channel_id] = agent.agent_key || 'default';
            }
        });
        if (savedAgents.length) console.log(`${green}[AGENT]${reset} Restored ${savedAgents.length} active agents.`);
    } catch (err) {}
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

const WRITE_STRATEGY = {
    BATCH_SIZE: 50,
    MAX_WAIT_MS: 30000,
    RETRY_ATTEMPTS: 3,
    USE_TRANSACTIONS: true
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
        flushUserUpdates();
    }
}

async function flushUserUpdates() {
    if (client.pendingUserUpdates.size === 0) return;
    
    const updates = Array.from(client.pendingUserUpdates.entries());
    client.pendingUserUpdates.clear();
    
    try {
        if (WRITE_STRATEGY.USE_TRANSACTIONS) {
            const updateStmt = db.prepare(`
                INSERT OR REPLACE INTO users (
                    id, username, xp, level, total_messages, last_xp_gain, 
                    games_played, games_won, total_winnings, gaming, credits, streak_days, last_daily
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            db.transaction(() => {
                for (const [userId, userData] of updates) {
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
                        userData.gaming || '{"game":"CODM","rank":"Unranked"}',
                        userData.credits ?? 0,
                        userData.streak_days ?? 0,
                        userData.last_daily ?? 0
                    );
                }
            })();
        }
        
        client.lastBatchWrite = Date.now();
        console.log(`${green}[DB BATCH]${reset} Flushed ${updates.length} user updates`);
        
    } catch (err) {
        console.error(`${red}[DB BATCH ERROR]${reset}`, err.message);
        for (const [userId, userData] of updates) {
            const retryCount = (userData._retryCount || 0) + 1;
            if (retryCount <= WRITE_STRATEGY.RETRY_ATTEMPTS) {
                client.pendingUserUpdates.set(userId, { ...userData, _retryCount: retryCount });
            }
        }
    }
}

function startBatchWriteInterval() {
    if (client.batchWriteInterval) clearInterval(client.batchWriteInterval);
    client.batchWriteInterval = setInterval(() => {
        if (client.pendingUserUpdates.size > 0) flushUserUpdates();
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
                    await channel.send(`<@${r.user_id}> ${r.message}`);
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

// ================= GLOBAL ITEM DEFINITIONS =================
client.shopItems = [
    { id: 'starter_pack', price: 500, emoji: '📦', type: 'consumable', effect: { xp: 100, credits: 50 },
      en: { name: 'New Recruit Pack', desc: 'A small boost for new agents.', perk: '+100 XP & +50 Credits' },
      fr: { name: 'Pack Nouvelle Recrue', desc: 'Un petit boost pour les nouveaux agents.', perk: '+100 XP & +50 Crédits' } },
    { id: 'xp_boost', price: 2000, emoji: '⚡', type: 'consumable', effect: { xp: 1000 },
      en: { name: 'Quantum XP Overdrive', desc: 'A one-time massive XP injection.', perk: '+1000 XP instantly' },
      fr: { name: 'Overdrive XP Quantique', desc: 'Une injection massive d\'XP unique.', perk: '+1000 XP instantanément' } },
    { id: 'credit_boost', price: 1500, emoji: '💰', type: 'consumable', effect: { credits: 500 },
      en: { name: 'Credit Surge', desc: 'Instant credit injection.', perk: '+500 Credits' },
      fr: { name: 'Afflux de Crédits', desc: 'Injection de crédits instantanée.', perk: '+500 Crédits' } }
];

client.getItem = (itemId) => client.shopItems.find(item => item.id === itemId);

// ================= PLUGIN LOADER =================
client.loadPlugins = async () => {
    client.commands.clear();
    client.aliases.clear();
    console.log(`\n${blue}${bold}==============================================${reset}`);
    console.log(`${cyan}🛰️  ARCHITECT CG-223 | MODULE SYNCHRONIZATION${reset}`);
    console.log(`${blue}${bold}==============================================${reset}`);

    const pluginPath = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginPath)) fs.mkdirSync(pluginPath);

    const pluginFiles = fs.readdirSync(pluginPath).filter(file => file.endsWith('.js') && file !== 'lydia.js');
    
    for (const file of pluginFiles) {
        try {
            await sleep(100);
            const filePath = path.join(pluginPath, file);
            delete require.cache[require.resolve(filePath)];
            const command = require(filePath);

            if (command.name && command.run) {
                client.commands.set(command.name, command);
                if (command.aliases && Array.isArray(command.aliases)) {
                    command.aliases.forEach(a => client.aliases.set(a, command.name));
                }
                console.log(`${green}[VERIFIED]${reset} Linked: ${cyan}${command.name.toUpperCase()}${reset}`);
            }
        } catch (error) { 
            console.log(`${red}[ERROR]${reset} Failed ${file}: ${error.message}`); 
        }
    }
    
    await sleep(200);
    console.log(`${blue}${bold}==============================================${reset}`);
    console.log(`${green}🚀 ENGINE READY | ${client.commands.size} CORE MODULES ONLINE${reset}`);
    console.log(`${blue}${bold}==============================================${reset}\n`);
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
    loadAgentPreferences();
    
    startBatchWriteInterval();
    startReminderHeartbeat();
    startCacheJanitor();
    
    const boxWidth = 64;
    const drawBoxLine = (label, value) => {
        const lineContent = `║  ${label.padEnd(12)} : ${value}`;
        return `${lineContent}${' '.repeat(Math.max(0, boxWidth - lineContent.length - 1))}║`;
    };

    console.log(`\n${blue}${bold}╔${'═'.repeat(boxWidth - 2)}╗${reset}`);
    console.log(`${blue}${bold}║${' '.repeat(Math.floor((boxWidth - 44) / 2))}${cyan}🦅 ARCHITECT CG-223 // NEURAL ENGINE ONLINE${reset}${' '.repeat(Math.max(0, boxWidth - 44 - Math.floor((boxWidth - 44) / 2) - 2))}║${reset}`);
    console.log(`${blue}${bold}╠${'═'.repeat(boxWidth - 2)}╣${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}🤖 CLIENT`, client.user.tag)}${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}📍 NODE`, 'BAMAKO_223 🇲🇱')}${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}📦 VERSION`, `v${client.version}`)}${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}🔗 REPOSITORY`, 'github.com/MFOF7310')}${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}🏗️ ARCHITECT`, 'MOUSSA FOFANA')}${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}💾 DB MODE`, 'WAL • High Performance')}${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}💾 DB BATCH`, `${WRITE_STRATEGY.MAX_WAIT_MS/1000}s delay`)}${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}🔔 REMINDERS`, `30s heartbeat`)}${reset}`);
    console.log(`${blue}${bold}╚${'═'.repeat(boxWidth - 2)}╝${reset}\n`);

    if (client.userTimeouts) {
        for (const [id, timeout] of client.userTimeouts) clearTimeout(timeout);
        client.userTimeouts.clear();
    }

    try {
        const owner = await client.users.fetch(process.env.OWNER_ID);
        await owner.send({ 
            embeds: [new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('🦅 ARCHITECT CG-223 // ONLINE')
                .setDescription(`System reboot complete. **${client.commands.size}** modules synced.\n\n**Database:** WAL Mode (High Performance)`)
                .setTimestamp()
            ] 
        });
    } catch (err) {}
});

// ================= 🔥 FIXED MESSAGE PROCESSING (COMMAND PRIORITY) =================
client.on(Events.MessageCreate, async (message) => {
    if (!message || message.author?.bot || message.webhookId) return;

    const userId = message.author.id;
    let userData = getUserData(userId);
    
    if (!userData) {
        userData = initializeUser(userId, message.author.username);
        cacheUserData(userId, userData);
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
            await message.channel.send({ 
                content: `🎉 **LEVEL UP!** <@${userId}> reached Level ${newLevel}!` 
            });
        }
    }

    const serverSettings = message.guild ? getServerSettings(message.guild.id) : DEFAULT_SETTINGS;
    const effectivePrefix = serverSettings.prefix || PREFIX;
    
    // 🔥 CHECK FOR COMMANDS FIRST - Return after executing so Lydia doesn't process!
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
                const lang = detectLanguage(usedCommand);
                const errorMsg = lang === 'fr' 
                    ? "⚠️ **Échec de l'exécution de la commande.**" 
                    : "⚠️ **Command execution failed.**";
                return message.reply(errorMsg).catch(() => {});
            }
        }
    }
});

// ================= INTERACTION HANDLER =================
client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
        console.log(`${cyan}[INTERACTION]${reset} ${interaction.customId} from ${interaction.user.tag}`);
        
        if (!interaction.deferred && !interaction.replied) {
            try {
                await interaction.deferUpdate();
                console.log(`${green}[INTERACTION]${reset} Deferred ${interaction.customId}`);
            } catch (err) {}
        }
    }
});

// ================= WELCOME SYSTEM =================
client.on(Events.GuildMemberAdd, async (member) => {
    if (member.user.bot) return;
    
    const settings = getServerSettings(member.guild.id);
    const welcomeChannel = member.guild.channels.cache.get(settings.welcomeChannel || process.env.WELCOME_CHANNEL_ID);
    
    if (welcomeChannel) {
        const welcomeMsg = `🎊 Bienvenue <@${member.id}> sur **${member.guild.name}**! | Welcome to **${member.guild.name}**!`;
        welcomeChannel.send({ content: welcomeMsg }).catch(() => {});
    }
});

// ================= GRACEFUL SHUTDOWN =================
async function gracefulShutdown(signal) {
    console.log(`\n${yellow}[SHUTDOWN]${reset} 🛑 ${signal} detected. Saving all pending data...`);
    
    if (client.cacheJanitorInterval) clearInterval(client.cacheJanitorInterval);
    if (client.reminderHeartbeatInterval) clearInterval(client.reminderHeartbeatInterval);
    
    if (client.pendingUserUpdates && client.pendingUserUpdates.size > 0) {
        console.log(`${cyan}[SHUTDOWN]${reset} Flushing ${client.pendingUserUpdates.size} pending updates...`);
        await flushUserUpdates();
    }
    
    if (client.batchWriteInterval) clearInterval(client.batchWriteInterval);
    if (client.userTimeouts) {
        for (const [id, timeout] of client.userTimeouts) clearTimeout(timeout);
        client.userTimeouts.clear();
    }
    
    client.userDataCache.clear();
    client.settings.clear();
    
    try {
        db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
        db.close();
        console.log(`${green}[SHUTDOWN]${reset} Database closed successfully (WAL cleaned)`);
    } catch (err) {
        console.error(`${red}[SHUTDOWN]${reset} Database close error:`, err.message);
    }
    
    console.log(`${green}[SHUTDOWN]${reset} ✅ All data saved. Exiting...`);
    process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// ================= INITIALIZE LYDIA =================
setupLydia(client, db);
console.log(`${green}[INIT]${reset} Lydia setup completed`);

// ================= LOGIN =================
client.login(process.env.TOKEN);