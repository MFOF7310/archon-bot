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
client.settings = new Map(); // Cache for server settings

// --- DYNAMIC VERSIONING (LOADED ONCE) ---
function getVersion() {
    try {
        const versionPath = path.join(__dirname, 'version.txt');
        if (fs.existsSync(versionPath)) {
            const version = fs.readFileSync(versionPath, 'utf8').trim();
            return version;
        } else {
            fs.writeFileSync(versionPath, '1.5.0', 'utf8');
            return '1.5.0';
        }
    } catch (err) {
        return '1.5.0';
    }
}

client.version = getVersion();

// --- LYDIA GLOBALS ---
client.lydiaChannels = {};
client.lydiaAgents = {};
client.lastLydiaCall = {};

const PREFIX = process.env.PREFIX || ".";

// --- UTILITIES ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getAccountAge = (createdAt) => {
    const now = new Date();
    const diff = now - createdAt;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 1) return "Joined Today";
    if (days < 30) return `${days} Days ago`;
    const months = Math.floor(days / 30.44);
    if (months < 12) return `${months} Month(s) ago`;
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    return `${years} Year(s), ${remainingMonths} Month(s) ago`;
};

const formatNumber = (num) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const getLevelColor = (level) => {
    if (level >= 100) return '#ff4444';
    if (level >= 75) return '#ff66cc';
    if (level >= 50) return '#44aaff';
    if (level >= 25) return '#ffaa44';
    if (level >= 10) return '#dddddd';
    return '#cd7f32';
};

const getNextLevelReward = (level) => {
    const rewards = {
        5: "✨ **Special Role** - @Level 5 role unlocked!",
        10: "🎁 **VIP Access** - Exclusive channel access!",
        25: "🏆 **Elite Status** - Custom nickname color!",
        50: "💎 **Legendary** - Priority support access!",
        100: "👑 **Gaming God** - Ultimate bragging rights!"
    };
    
    for (const [reqLevel, reward] of Object.entries(rewards)) {
        if (level === parseInt(reqLevel)) {
            return reward;
        }
    }
    return `🎯 **Next milestone:** ${Object.keys(rewards).find(l => l > level) || 'Level 100'} - Keep going!`;
};

// --- SQLITE DATABASE ---
const Database = require('better-sqlite3');
const db = new Database('database.sqlite');

// ============================================================================
// ================= GLOBAL AUTO-REPAIR PROTOCOL (SINGLE SOURCE OF TRUTH) =================
// ============================================================================
console.log(`${cyan}[REPAIR]${reset} Initiating Global Neural Schema Repair...`);

const requiredTables = {
    users: `
        CREATE TABLE IF NOT EXISTS users (
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
        )
    `,
    server_settings: `
        CREATE TABLE IF NOT EXISTS server_settings (
            guild_id TEXT PRIMARY KEY,
            prefix TEXT DEFAULT '.',
            language TEXT DEFAULT 'en',
            welcome_channel TEXT,
            log_channel TEXT,
            daily_channel TEXT,
            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
    `,
    lydia_memory: `
        CREATE TABLE IF NOT EXISTS lydia_memory (
            user_id TEXT,
            memory_key TEXT,
            memory_value TEXT,
            updated_at INTEGER DEFAULT (strftime('%s', 'now')),
            PRIMARY KEY (user_id, memory_key)
        )
    `,
    lydia_agents: `
        CREATE TABLE IF NOT EXISTS lydia_agents (
            channel_id TEXT PRIMARY KEY,
            agent_key TEXT,
            is_active INTEGER DEFAULT 0,
            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
    `,
    // ========== FIXED: active INTEGER (not BOOLEAN) with DEFAULT 1 ==========
    user_inventory: `
        CREATE TABLE IF NOT EXISTS user_inventory (
            user_id TEXT,
            item_id TEXT,
            quantity INTEGER DEFAULT 1,
            purchased_at INTEGER DEFAULT (strftime('%s', 'now')),
            expires_at INTEGER,
            active INTEGER DEFAULT 1,
            PRIMARY KEY (user_id, item_id)
        )
    `,
    lydia_introductions: `
        CREATE TABLE IF NOT EXISTS lydia_introductions (
            user_id TEXT,
            channel_id TEXT,
            introduced_at INTEGER DEFAULT (strftime('%s', 'now')),
            PRIMARY KEY (user_id, channel_id)
        )
    `,
    lydia_conversations: `
        CREATE TABLE IF NOT EXISTS lydia_conversations (
            channel_id TEXT,
            user_id TEXT,
            user_name TEXT,
            role TEXT,
            content TEXT,
            timestamp INTEGER DEFAULT (strftime('%s', 'now'))
        )
    `,
    reminders: `
        CREATE TABLE IF NOT EXISTS reminders (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            channel_id TEXT,
            message TEXT,
            created_at INTEGER,
            execute_at INTEGER,
            status TEXT DEFAULT 'pending'
        )
    `,
    warnings: `
        CREATE TABLE IF NOT EXISTS warnings (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            moderator_id TEXT NOT NULL,
            reason TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            expires_at INTEGER,
            active INTEGER DEFAULT 1
        )
    `,
    moderation_logs: `
        CREATE TABLE IF NOT EXISTS moderation_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            moderator_id TEXT NOT NULL,
            action TEXT NOT NULL,
            reason TEXT,
            warning_id TEXT,
            timestamp INTEGER DEFAULT (strftime('%s', 'now'))
        )
    `,
    server_backups: `
        CREATE TABLE IF NOT EXISTS server_backups (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            name TEXT,
            data TEXT NOT NULL,
            created_by TEXT NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            roles INTEGER,
            channels INTEGER
        )
    `,
    auto_backup_settings: `
        CREATE TABLE IF NOT EXISTS auto_backup_settings (
            guild_id TEXT PRIMARY KEY,
            enabled INTEGER DEFAULT 0,
            last_backup INTEGER,
            channel_id TEXT
        )
    `
};

const requiredIndexes = [
    `CREATE INDEX IF NOT EXISTS idx_reminders_execute ON reminders(execute_at, status)`,
    `CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings(guild_id, user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_modlogs_guild_user ON moderation_logs(guild_id, user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_inventory_user_active ON user_inventory(user_id, active)`
];

const columnMigrations = {
    users: [
        { name: 'credits', type: 'INTEGER DEFAULT 0' },
        { name: 'streak_days', type: 'INTEGER DEFAULT 0' },
        { name: 'total_winnings', type: 'INTEGER DEFAULT 0' },
        { name: 'games_played', type: 'INTEGER DEFAULT 0' },
        { name: 'games_won', type: 'INTEGER DEFAULT 0' },
        { name: 'created_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
        { name: 'last_daily', type: 'INTEGER DEFAULT 0' },
        { name: 'total_messages', type: 'INTEGER DEFAULT 0' },
        { name: 'last_seen', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
        { name: 'level', type: 'INTEGER DEFAULT 1' }
    ],
    lydia_conversations: [
        { name: 'user_name', type: 'TEXT' }
    ],
    user_inventory: [
        { name: 'active', type: 'INTEGER DEFAULT 1' }
    ],
    warnings: [
        { name: 'active', type: 'INTEGER DEFAULT 1' }
    ]
};

let tablesCreated = 0;
let tablesAlreadyExist = 0;
let indexesCreated = 0;
let columnsAdded = 0;

// PHASE 1: Create all required tables
for (const [tableName, createSQL] of Object.entries(requiredTables)) {
    try {
        const exists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(tableName);
        
        if (!exists) {
            db.exec(createSQL);
            tablesCreated++;
            console.log(`${green}[REPAIR]${reset} ✅ Created table: ${cyan}${tableName}${reset}`);
        } else {
            tablesAlreadyExist++;
        }
    } catch (err) {
        console.log(`${red}[REPAIR ERROR]${reset} Failed to create ${tableName}: ${err.message}`);
    }
}

// PHASE 2: Create all indexes
for (const indexSQL of requiredIndexes) {
    try {
        db.exec(indexSQL);
        indexesCreated++;
    } catch (err) {}
}

// PHASE 3: Add missing columns to existing tables (WITH DEFAULT VALUES)
for (const [tableName, columns] of Object.entries(columnMigrations)) {
    const tableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(tableName);
    if (!tableExists) continue;
    
    for (const column of columns) {
        try {
            const columnExists = db.prepare(`PRAGMA table_info(${tableName})`).all().some(col => col.name === column.name);
            if (!columnExists) {
                db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${column.name} ${column.type}`).run();
                columnsAdded++;
                console.log(`${cyan}[MIGRATION]${reset} Added column: ${tableName}.${column.name} (${column.type})`);
            }
        } catch (err) {}
    }
}

// PHASE 3.5: Fix user_inventory active column type if it was created as BOOLEAN
try {
    const tableInfo = db.prepare(`PRAGMA table_info(user_inventory)`).all();
    const activeColumn = tableInfo.find(col => col.name === 'active');
    
    if (activeColumn && activeColumn.type.toUpperCase().includes('BOOL')) {
        db.exec(`
            BEGIN TRANSACTION;
            
            CREATE TABLE user_inventory_temp (
                user_id TEXT,
                item_id TEXT,
                quantity INTEGER DEFAULT 1,
                purchased_at INTEGER DEFAULT (strftime('%s', 'now')),
                expires_at INTEGER,
                active INTEGER DEFAULT 1,
                PRIMARY KEY (user_id, item_id)
            );
            
            INSERT INTO user_inventory_temp (user_id, item_id, quantity, purchased_at, expires_at, active)
            SELECT user_id, item_id, quantity, purchased_at, expires_at, 
                   CASE WHEN active = 1 OR active = 'true' THEN 1 ELSE 0 END
            FROM user_inventory;
            
            DROP TABLE user_inventory;
            ALTER TABLE user_inventory_temp RENAME TO user_inventory;
            
            COMMIT;
        `);
        console.log(`${cyan}[MIGRATION]${reset} Converted user_inventory.active from BOOLEAN to INTEGER`);
    }
} catch (err) {
    console.log(`${yellow}[MIGRATION]${reset} user_inventory type conversion: ${err.message}`);
}

// PHASE 4: Clean expired inventory items
try {
    const now = Math.floor(Date.now() / 1000);
    const expiredCleaned = db.prepare(`
        UPDATE user_inventory 
        SET active = 0 
        WHERE expires_at IS NOT NULL AND expires_at > 0 AND expires_at < ? AND active = 1
    `).run(now);
    
    if (expiredCleaned.changes > 0) {
        console.log(`${cyan}[CLEANUP]${reset} Marked ${expiredCleaned.changes} expired inventory items as inactive`);
    }
} catch (err) {}

// PHASE 4.5: Sync user levels based on XP for existing users
try {
    const usersNeedingSync = db.prepare(`
        SELECT id, xp FROM users 
        WHERE level IS NULL OR level = 0 OR level = 1
    `).all();
    
    let syncedCount = 0;
    for (const user of usersNeedingSync) {
        const calculatedLevel = Math.floor(0.1 * Math.sqrt(user.xp || 0)) + 1;
        if (calculatedLevel > 1) {
            db.prepare(`UPDATE users SET level = ? WHERE id = ?`).run(calculatedLevel, user.id);
            syncedCount++;
        }
    }
    
    if (syncedCount > 0) {
        console.log(`${cyan}[SYNC]${reset} Updated levels for ${syncedCount} users based on XP`);
    }
} catch (err) {
    console.log(`${yellow}[SYNC]${reset} Level sync error: ${err.message}`);
}

// PHASE 5: Clean old completed reminders
try {
    const weekAgo = Math.floor(Date.now() / 1000) - (7 * 86400);
    const remindersDeleted = db.prepare(`DELETE FROM reminders WHERE status = 'completed' AND execute_at < ?`).run(weekAgo);
    
    if (remindersDeleted.changes > 0) {
        console.log(`${cyan}[CLEANUP]${reset} Deleted ${remindersDeleted.changes} old completed reminders`);
    }
} catch (err) {}

console.log(`${green}[REPAIR COMPLETE]${reset} Tables: ${tablesCreated} created, ${tablesAlreadyExist} verified | Indexes: ${indexesCreated} | Columns: ${columnsAdded}`);
console.log(`${green}[REPAIR]${reset} Neural Schema is 100% Synchronized and Healthy!`);

// ================= SERVER SETTINGS UTILITY (GLOBAL PROXY) =================
const DEFAULT_SETTINGS = {
    prefix: PREFIX,
    language: 'en',
    welcomeChannel: null,
    logChannel: null,
    dailyChannel: null
};

function getServerSettings(guildId) {
    if (client.settings.has(guildId)) {
        return client.settings.get(guildId);
    }
    
    try {
        let settings = db.prepare(`SELECT * FROM server_settings WHERE guild_id = ?`).get(guildId);
        
        if (!settings) {
            db.prepare(`
                INSERT INTO server_settings (guild_id, prefix, language)
                VALUES (?, ?, ?)
            `).run(guildId, DEFAULT_SETTINGS.prefix, DEFAULT_SETTINGS.language);
            
            settings = { ...DEFAULT_SETTINGS, guild_id: guildId };
        }
        
        const result = {
            prefix: settings.prefix || DEFAULT_SETTINGS.prefix,
            language: settings.language || DEFAULT_SETTINGS.language,
            welcomeChannel: settings.welcome_channel,
            logChannel: settings.log_channel,
            dailyChannel: settings.daily_channel
        };
        
        client.settings.set(guildId, result);
        
        return result;
    } catch (err) {
        console.error(`${red}[SETTINGS ERROR]${reset}`, err.message);
        return DEFAULT_SETTINGS;
    }
}

function updateServerSetting(guildId, setting, value) {
    const columnMap = {
        prefix: 'prefix',
        language: 'language',
        welcome: 'welcome_channel',
        log: 'log_channel',
        daily: 'daily_channel'
    };
    
    const column = columnMap[setting];
    if (!column) return false;
    
    try {
        db.prepare(`
            UPDATE server_settings 
            SET ${column} = ?, updated_at = strftime('%s', 'now')
            WHERE guild_id = ?
        `).run(value, guildId);
        
        client.settings.delete(guildId);
        
        return true;
    } catch (err) {
        console.error(`${red}[SETTINGS ERROR]${reset}`, err.message);
        return false;
    }
}

client.getServerSettings = getServerSettings;
client.updateServerSetting = updateServerSetting;

// ================= HELPER FUNCTIONS =================
const getUser = (userId) => db.prepare("SELECT * FROM users WHERE id = ?").get(userId);

const saveUser = (id, name, xp, lvl, msgs, last, gamesPlayed = 0, gamesWon = 0, totalWinnings = 0, gaming = null, credits = 0, streakDays = 0) => {
    const gamingValue = gaming !== null ? gaming : '{"game":"CODM","rank":"Unranked"}';
    db.prepare(`INSERT OR REPLACE INTO users (id, username, xp, level, total_messages, last_xp_gain, games_played, games_won, total_winnings, gaming, credits, streak_days) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, name, xp, lvl, msgs, last, gamesPlayed, gamesWon, totalWinnings, gamingValue, credits, streakDays);
};

const initializeUser = (userId, username) => {
    const existing = getUser(userId);
    if (!existing) {
        db.prepare(`INSERT INTO users (
            id, username, xp, level, credits, streak_days, 
            total_messages, last_xp_gain, games_played, games_won, 
            total_winnings, gaming, created_at, last_seen, last_daily
        ) VALUES (?, ?, 0, 1, 0, 0, 0, 0, 0, 0, 0, '{"game":"CODM","rank":"Unranked"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)`)
        .run(userId, username);
    }
    return getUser(userId);
};

const updateGamingStats = (userId, gamesPlayedInc = 0, gamesWonInc = 0, winningsInc = 0, gamingStatus = null) => {
    const user = getUser(userId);
    if (!user) return false;
    
    const newGamesPlayed = (user.games_played || 0) + gamesPlayedInc;
    const newGamesWon = (user.games_won || 0) + gamesWonInc;
    const newTotalWinnings = (user.total_winnings || 0) + winningsInc;
    const newGaming = gamingStatus !== null ? gamingStatus : user.gaming;
    
    db.prepare(`UPDATE users SET games_played = ?, games_won = ?, total_winnings = ?, gaming = ? WHERE id = ?`)
      .run(newGamesPlayed, newGamesWon, newTotalWinnings, newGaming, userId);
    return true;
};

// Load saved agent preferences
const loadAgentPreferences = () => {
    try {
        const savedAgents = db.prepare("SELECT * FROM lydia_agents WHERE is_active = 1").all();
        if (!savedAgents || savedAgents.length === 0) {
            return;
        }
        savedAgents.forEach(agent => {
            if (agent.channel_id) {
                client.lydiaChannels[agent.channel_id] = true;
                client.lydiaAgents[agent.channel_id] = agent.agent_key || 'default';
            }
        });
        console.log(`${green}[AGENT]${reset} Restored ${savedAgents.length} active agents.`);
    } catch (err) {}
};

const saveAgentPreference = (channelId, agentKey) => {
    db.prepare(`
        INSERT OR REPLACE INTO lydia_agents (channel_id, agent_key, is_active, updated_at)
        VALUES (?, ?, ?, strftime('%s', 'now'))
    `).run(channelId, agentKey, client.lydiaChannels[channelId] ? 1 : 0);
};

// --- ATTACH HELPERS TO CLIENT ---
client.saveAgentPreference = saveAgentPreference;
client.getUser = getUser;
client.initializeUser = initializeUser;
client.updateGamingStats = updateGamingStats;
client.db = db;

// ================= XP PROGRESS FUNCTION =================
const getXPProgress = (xp, level) => {
    const barLength = 20;
    const xpForCurrentLevel = Math.pow((level - 1) / 0.1, 2);
    const xpForNextLevel = Math.pow(level / 0.1, 2);
    const currentProgress = Math.max(0, xp - xpForCurrentLevel);
    const xpNeeded = Math.max(1, xpForNextLevel - xpForCurrentLevel);
    const percentage = Math.min(100, Math.max(0, (currentProgress / xpNeeded) * 100));
    const filledBars = Math.max(0, Math.floor((percentage / 100) * barLength));
    
    return {
        current: currentProgress,
        needed: xpNeeded,
        percentage: Math.round(percentage),
        bar: `▰`.repeat(filledBars) + `▱`.repeat(Math.max(0, barLength - filledBars))
    };
};

// --- LEVEL-UP ACHIEVEMENTS ---
const achievements = {
    1: { name: "🌟 BEGINNER'S LUCK", desc: "Take your first step into greatness!" },
    5: { name: "🎮 APPRENTICE GAMER", desc: "Level 5 reached! You're learning fast!" },
    10: { name: "⚔️ SKILLED WARRIOR", desc: "Double digits! Your skills are sharpening!" },
    25: { name: "🏆 ELITE FIGHTER", desc: "A true warrior emerges!" },
    50: { name: "💎 MASTER TACTICIAN", desc: "Your strategies are legendary!" },
    75: { name: "👑 GRAND MASTER", desc: "Among the elite few!" },
    100: { name: "🌀 TRANSCENDENT", desc: "You've reached god-like status!" }
};

const getAchievementName = (level) => {
    for (const [milestone, achievement] of Object.entries(achievements).reverse()) {
        if (level >= parseInt(milestone)) {
            return achievement;
        }
    }
    return { name: "🌱 NOVICE", desc: "Every journey begins with a single step!" };
};

const getLevelImage = (level) => {
    if (level >= 100) return 'https://via.placeholder.com/1200x400/ff4444/ffffff?text=MASTER+TIER';
    if (level >= 50) return 'https://via.placeholder.com/1200x400/44aaff/ffffff?text=DIAMOND+TIER';
    if (level >= 25) return 'https://via.placeholder.com/1200x400/ffaa44/ffffff?text=PLATINUM+TIER';
    if (level >= 10) return 'https://via.placeholder.com/1200x400/dddddd/000000?text=GOLD+TIER';
    if (level >= 5) return 'https://via.placeholder.com/1200x400/cd7f32/ffffff?text=SILVER+TIER';
    return 'https://via.placeholder.com/1200x400/8B5A2B/ffffff?text=BRONZE+TIER';
};

const getCongratsMessage = (level, userName) => {
    const messages = [
        `GG **${userName}**, you just reached **Level ${level}**! 🎉`,
        `Amazing! **${userName}** hit **Level ${level}**! The grind pays off! ⚡`,
        `**${userName}** levels up to **Level ${level}**! 🌟`,
        `Congratulations **${userName}**! Level ${level} looks good on you! 👑`
    ];
    
    if (level % 10 === 0) {
        return `🏆 **MILESTONE UNLOCKED!** 🏆\n**${userName}** reaches **Level ${level}**!`;
    }
    if (level === 1) {
        return `🎊 Welcome to the journey, **${userName}**! Level 1 achieved! 🎊`;
    }
    
    return messages[Math.floor(Math.random() * messages.length)];
};

// ================= GLOBAL ITEM DEFINITIONS (SINGLE SOURCE OF TRUTH) =================
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
        id: 'role_veteran', 
        price: 5000, 
        emoji: '🎖️', 
        type: 'role',
        roleId: process.env.VETERAN_ROLE_ID || null,
        requirement: { level: 10 },
        en: { name: 'Veteran Agent Role', desc: 'Exclusive Discord role for elite agents.', perk: '+50% respect in server' },
        fr: { name: 'Rôle Agent Vétéran', desc: 'Rôle Discord exclusif pour les agents d\'élite.', perk: '+50% de respect dans le serveur' }
    },
    { 
        id: 'xp_boost', 
        price: 2000, 
        emoji: '⚡', 
        type: 'consumable',
        effect: { xp: 1000 },
        en: { name: 'Quantum XP Overdrive', desc: 'A one-time massive XP injection.', perk: '+1000 XP instantly' },
        fr: { name: 'Overdrive XP Quantique', desc: 'Une injection massive d\'XP unique.', perk: '+1000 XP instantanément' }
    },
    { 
        id: 'credit_boost', 
        price: 1500, 
        emoji: '💰', 
        type: 'consumable',
        effect: { credits: 500 },
        en: { name: 'Credit Surge', desc: 'Instant credit injection.', perk: '+500 Credits' },
        fr: { name: 'Afflux de Crédits', desc: 'Injection de crédits instantanée.', perk: '+500 Crédits' }
    },
    { 
        id: 'tag_architect', 
        price: 15000, 
        emoji: '🏗️', 
        type: 'badge',
        requirement: { level: 25 },
        en: { name: 'Architect Apprentice', desc: 'Special badge displayed on your .rank profile.', perk: 'Recognized by the Architect' },
        fr: { name: 'Apprenti Architecte', desc: 'Badge spécial affiché sur votre profil .rank.', perk: 'Reconnu par l\'Architecte' }
    },
    { 
        id: 'xp_multiplier', 
        price: 10000, 
        emoji: '📈', 
        type: 'boost',
        duration: 7,
        effect: { multiplier: 1.5 },
        en: { name: 'Neural Accelerator', desc: '7-day XP boost (1.5x).', perk: 'Earn 50% more XP from all sources' },
        fr: { name: 'Accélérateur Neural', desc: 'Boost XP de 7 jours (1.5x).', perk: 'Gagnez 50% plus d\'XP de toutes les sources' }
    },
    { 
        id: 'color_role', 
        price: 8000, 
        emoji: '🎨', 
        type: 'role',
        en: { name: 'Custom Color Role', desc: 'Choose your own role color.', perk: 'Stand out in the member list' },
        fr: { name: 'Rôle Couleur Personnalisée', desc: 'Choisissez votre propre couleur de rôle.', perk: 'Démarquez-vous dans la liste des membres' }
    },
    { 
        id: 'daily_boost', 
        price: 25000, 
        emoji: '🌟', 
        type: 'permanent',
        effect: { dailyBonus: 50 },
        en: { name: 'Premium Daily Bonus', desc: 'Permanent +50% daily reward bonus.', perk: 'Get more from your .daily claims' },
        fr: { name: 'Bonus Quotidien Premium', desc: 'Bonus permanent de +50% sur les récompenses quotidiennes.', perk: 'Obtenez plus de vos récompenses .daily' }
    }
];

// Helper function to get item by ID
client.getItem = (itemId) => client.shopItems.find(item => item.id === itemId);

// Helper function to get item definitions for inventory
client.getItemDefinitions = () => {
    const definitions = {};
    client.shopItems.forEach(item => {
        definitions[item.id] = {
            name: { en: item.en.name, fr: item.fr.name },
            emoji: item.emoji,
            type: item.type,
            effect: item.effect || null,
            duration: item.duration || null,
            usable: item.type === 'consumable',
            permanent: item.type === 'permanent' || item.type === 'role' || item.type === 'badge'
        };
    });
    return definitions;
};

console.log(`${green}[GLOBAL]${reset} Loaded ${client.shopItems.length} shop items into global registry`);

// --- PLUGIN LOADER ---
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
            } else {
                console.log(`${yellow}[SKIPPED]${reset} ${file}: Incomplete Structure.`);
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

// ================= BOOT SEQUENCE =================
client.once(Events.ClientReady, async () => {
    console.clear();
    
    await client.loadPlugins();
    
    console.log(`${cyan}[LYDIA]${reset} Initializing Neural Interface...`);
    setupLydia(client, db);
    console.log(`${green}[LYDIA]${reset} Neural Core structure ready.`);
    
    loadAgentPreferences();
    
    // ========== ARCHITECT CG-223 BOOT HEADER ==========
    const boxWidth = 64;
    
    const drawBoxLine = (label, value) => {
        const lineContent = `║  ${label.padEnd(12)} : ${value}`;
        const paddingNeeded = boxWidth - lineContent.length - 1;
        return `${lineContent}${' '.repeat(Math.max(0, paddingNeeded))}║`;
    };

    console.log(`\n${blue}${bold}╔${'═'.repeat(boxWidth - 2)}╗${reset}`);
    
    const title = "🦅 ARCHITECT CG-223 // NEURAL ENGINE ONLINE";
    const titlePadding = Math.floor((boxWidth - title.length - 2) / 2);
    console.log(`${blue}${bold}║${' '.repeat(Math.max(0, titlePadding))}${cyan}${title}${reset}${' '.repeat(Math.max(0, boxWidth - title.length - titlePadding - 2))}║${reset}`);
    
    console.log(`${blue}${bold}╠${'═'.repeat(boxWidth - 2)}╣${reset}`);
    
    console.log(`${blue}${bold}${drawBoxLine(`${green}🤖 CLIENT`, client.user.tag)}${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}📍 NODE`, 'BAMAKO_223 🇲🇱')}${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}📦 VERSION`, `v${client.version}`)}${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}🔗 REPOSITORY`, 'https://github.com/MFOF7310')}${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}🏗️  ARCHITECT`, 'MOUSSA FOFANA')}${reset}`);
    
    console.log(`${blue}${bold}╚${'═'.repeat(boxWidth - 2)}╝${reset}\n`);

    // Clear old timeouts
    if (client.userTimeouts) {
        for (const [id, timeout] of client.userTimeouts) {
            clearTimeout(timeout);
        }
        client.userTimeouts.clear();
    }

    // Load pending reminders
    try {
        const pendingReminders = db.prepare(`
            SELECT * FROM reminders 
            WHERE status = 'pending' AND execute_at > ?
        `).all(Math.floor(Date.now() / 1000));
        
        for (const reminder of pendingReminders) {
            const timeLeft = (reminder.execute_at * 1000) - Date.now();
            if (timeLeft > 0) {
                const timeout = setTimeout(async () => {
                    try {
                        const channel = await client.channels.fetch(reminder.channel_id).catch(() => null);
                        if (channel) {
                            await channel.send(`⏰ **REMINDER** for <@${reminder.user_id}>:\n> ${reminder.message}`);
                        }
                        db.prepare(`UPDATE reminders SET status = 'completed' WHERE id = ?`).run(reminder.id);
                        client.userTimeouts.delete(reminder.id);
                    } catch (err) {}
                }, timeLeft);
                
                client.userTimeouts.set(reminder.id, timeout);
            }
        }
        
        if (pendingReminders.length > 0) {
            console.log(`${green}[REMINDER]${reset} Restored ${pendingReminders.length} pending reminders`);
        }
    } catch (err) {}

    try {
        const owner = await client.users.fetch(process.env.OWNER_ID);
        const alertEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('🦅 ARCHITECT CG-223 // ONLINE')
            .setDescription(`System reboot complete. **${client.commands.size}** modules synced.\nVersion: **${client.version}**\nNode: **BAMAKO_223** 🎮`)
            .addFields(
                { name: '🔗 Repository', value: 'https://github.com/MFOF7310', inline: true },
                { name: '🏗️ Architect', value: 'Moussa Fofana', inline: true }
            )
            .setTimestamp();
        await owner.send({ embeds: [alertEmbed] });
    } catch (err) { 
        console.log(`${yellow}[NOTICE]${reset} Owner DM Failed.`); 
    }
});

// ================= MESSAGE PROCESSING =================
client.on(Events.MessageCreate, async (message) => {
    if (!message || message.author?.bot || message.webhookId) return;

    const userId = message.author.id;
    let userData = getUser(userId);

    if (!userData) {
        initializeUser(userId, message.author.username);
        userData = getUser(userId);
    }

    const now = Date.now();
    const cooldown = 60000;

    if (now - (userData.last_xp_gain || 0) > cooldown) {
        const xpGain = Math.floor(Math.random() * 21) + 15;
        let newXP = (userData.xp || 0) + xpGain;
        let newLevel = Math.floor(0.1 * Math.sqrt(newXP)) + 1;
        let totalMsgs = (userData.total_messages || 0) + 1;

        if (newLevel > (userData.level || 1)) {
            const xpProgress = getXPProgress(newXP, newLevel);
            const achievement = getAchievementName(newLevel);
            
            const roleRewards = {
                5: process.env.ROLE_LVL_5,
                10: process.env.ROLE_LVL_10,
                25: process.env.ROLE_LVL_25,
                50: process.env.ROLE_LVL_50,
                100: process.env.ROLE_LVL_100
            };

            let rewardText = getNextLevelReward(newLevel);
            let roleAssigned = false;

            if (roleRewards[newLevel]) {
                const role = message.guild.roles.cache.get(roleRewards[newLevel]);
                if (role) {
                    await message.member.roles.add(role).catch(e => console.log(`${yellow}[ROLE ERROR]${reset} ${e.message}`));
                    rewardText = `✨ **Level ${newLevel} Role Unlocked!** — You've been granted the **${role.name}** role.`;
                    roleAssigned = true;
                }
            }

            const levelUpEmbed = new EmbedBuilder()
                .setColor(getLevelColor(newLevel))
                .setAuthor({ name: '🏆 ACHIEVEMENT UNLOCKED!', iconURL: message.author.displayAvatarURL() })
                .setTitle(achievement.name)
                .setDescription(getCongratsMessage(newLevel, message.author.username))
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 1024 }))
                .setImage(getLevelImage(newLevel))
                .addFields(
                    { 
                        name: '📊 PROGRESSION', 
                        value: `\`\`\`\nLEVEL ${userData.level || 1} → ${newLevel}\n${xpProgress.bar} ${xpProgress.percentage}%\nXP: ${formatNumber(newXP)}/${formatNumber(xpProgress.needed)}\n\`\`\`` 
                    },
                    { name: '🎁 REWARD', value: rewardText }
                )
                .setFooter({ text: `${message.guild.name} • Architect Engine v${client.version}` })
                .setTimestamp();

            await message.channel.send({ content: `🎉 **LEVEL UP!** <@${userId}>`, embeds: [levelUpEmbed] });
            
            const settings = message.guild ? getServerSettings(message.guild.id) : DEFAULT_SETTINGS;
            const logChannelId = settings.logChannel || process.env.LOG_CHANNEL_ID;
            const logChannel = message.guild.channels.cache.get(logChannelId);
            
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor(getLevelColor(newLevel))
                    .setTitle('🏆 LEVEL UP - ACHIEVEMENT UNLOCKED')
                    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                    .addFields(
                        { name: '👤 User', value: `<@${userId}>`, inline: true },
                        { name: '📊 Level', value: `${userData.level || 1} → **${newLevel}**`, inline: true },
                        { name: '🏅 Achievement', value: achievement.name, inline: true },
                        { name: '💬 Total Messages', value: formatNumber(totalMsgs), inline: true },
                        { name: '⭐ XP Gained', value: `+${xpGain} XP`, inline: true },
                        { name: '🎁 Role Reward', value: roleAssigned ? '✅ Assigned' : '❌ None', inline: true }
                    )
                    .setTimestamp();
                logChannel.send({ embeds: [logEmbed] });
            }
        }

        saveUser(userId, message.author.username, newXP, newLevel, totalMsgs, now, 
                userData.games_played || 0, 
                userData.games_won || 0, 
                userData.total_winnings || 0, 
                userData.gaming || '{"game":"CODM","rank":"Unranked"}',
                userData.credits || 0,
                userData.streak_days || 0);
    }

    // ================= COMMAND HANDLER =================
    const serverSettings = message.guild ? getServerSettings(message.guild.id) : DEFAULT_SETTINGS;
    const effectivePrefix = serverSettings.prefix || PREFIX;
    
    if (!message.content.startsWith(effectivePrefix)) return;
    
    const args = message.content.slice(effectivePrefix.length).trim().split(/ +/);
    const cmdName = args.shift().toLowerCase();
    
    let command = client.commands.get(cmdName) || client.commands.get(client.aliases.get(cmdName));
    
    // Special handling for Lydia command
    if (!command && (cmdName === 'lydia' || cmdName === 'ai' || cmdName === 'neural')) {
        console.log(`${cyan}[LYDIA]${reset} Manual command trigger detected: ${cmdName}`);
        try {
            const lydiaModule = require('./plugins/lydia.js');
            return await lydiaModule.run(client, message, args, db, serverSettings);
        } catch (e) {
            console.error(`${red}[LYDIA CMD ERROR]${reset}`, e);
            return message.reply("❌ Lydia command execution failed. Please check logs.");
        }
    }

    if (command) {
        try {
            await command.run(client, message, args, db, serverSettings);
        } catch (e) { 
            console.error(`${red}[COMMAND ERROR]${reset} ${cmdName}:`, e);
            message.reply("⚠️ **Command execution failed.**"); 
        }
    }
});

// ================= WELCOME SYSTEM =================
client.on(Events.GuildMemberAdd, async (member) => {
    if (member.user.bot) return;

    const settings = getServerSettings(member.guild.id);
    const lang = settings.language || 'en';
    
    const welcomeChannelId = settings.welcomeChannel || process.env.WELCOME_CHANNEL_ID;
    const logChannelId = settings.logChannel || process.env.LOG_CHANNEL_ID;
    
    const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);
    const logChannel = member.guild.channels.cache.get(logChannelId);
    const accountAge = getAccountAge(member.user.createdAt);

    const welcomeMessages = {
        en: {
            title: `👋 Welcome to the Network, ${member.user.username}!`,
            description: (id, count, rulesChannel, generalChannel) =>
                `🎉 **Greetings <@${id}>.** You are official **Member #${count}**.\n\n` +
                `📊 **Security Check:**\n` +
                `• 🛠️ Account Created: \`${accountAge}\`\n\n` +
                `🚀 **Initialization Protocol:**\n` +
                `• 📜 Review Rules: <#${rulesChannel}>\n` +
                `• 💬 Main Discussion: <#${generalChannel}>\n\n` +
                `🤖 Mention **@Lydia** for AI assistance.\n` +
                `🔗 **Developer:** Moussa Fofana (https://github.com/MFOF7310)`
        },
        fr: {
            title: `👋 Bienvenue sur le Réseau, ${member.user.username} !`,
            description: (id, count, rulesChannel, generalChannel) =>
                `🎉 **Salutations <@${id}>.** Vous êtes officiellement **Membre #${count}**.\n\n` +
                `📊 **Vérification de Sécurité:**\n` +
                `• 🛠️ Compte Créé: \`${accountAge}\`\n\n` +
                `🚀 **Protocole d'Initialisation:**\n` +
                `• 📜 Lire les Règles: <#${rulesChannel}>\n` +
                `• 💬 Discussion Principale: <#${generalChannel}>\n\n` +
                `🤖 Mentionnez **@Lydia** pour l'assistance IA.\n` +
                `🔗 **Développeur:** Moussa Fofana (https://github.com/MFOF7310)`
        }
    };

    const t = welcomeMessages[lang] || welcomeMessages.en;

    if (welcomeChannel) {
        const welcomeEmbed = new EmbedBuilder()
            .setColor('#00d9ff')
            .setAuthor({ name: `CONNECTION ESTABLISHED: ${member.guild.name.toUpperCase()}`, iconURL: member.guild.iconURL() })
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setTitle(t.title)
            .setDescription(t.description(
                member.id, 
                member.guild.memberCount, 
                process.env.RULES_CHANNEL_ID || 'N/A', 
                process.env.GENERAL_CHANNEL_ID || 'N/A'
            ))
            .setFooter({ text: `ARCHITECT CG-223 | Intelligent System` })
            .setTimestamp();

        welcomeChannel.send({ content: `🎊 ${lang === 'fr' ? 'Bienvenue' : 'Welcome'} <@${member.id}>!`, embeds: [welcomeEmbed] });
    }

    try {
        const dmMessages = {
            en: {
                title: `🔒 ENCRYPTED TRANSMISSION: ${member.guild.name.toUpperCase()}`,
                description: (rulesChannel, generalChannel) =>
                    `Hello **${member.user.username}**, initialization complete.\n\n` +
                    `Welcome to the inner circle. To get started, please check the following sectors:\n\n` +
                    `📂 **Directives:** <#${rulesChannel}>\n` +
                    `💬 **Hub:** <#${generalChannel}>\n\n` +
                    `*I am ARCHITECT CG-223. Type \`${settings.prefix}help\` in the server for my command list.*\n\n` +
                    `🔗 **Created by:** Moussa Fofana\n` +
                    `📦 **Repository:** https://github.com/MFOF7310`
            },
            fr: {
                title: `🔒 TRANSMISSION CRYPTÉE: ${member.guild.name.toUpperCase()}`,
                description: (rulesChannel, generalChannel) =>
                    `Bonjour **${member.user.username}**, initialisation terminée.\n\n` +
                    `Bienvenue dans le cercle restreint. Pour commencer, veuillez consulter les secteurs suivants:\n\n` +
                    `📂 **Directives:** <#${rulesChannel}>\n` +
                    `💬 **Hub:** <#${generalChannel}>\n\n` +
                    `*Je suis ARCHITECT CG-223. Tapez \`${settings.prefix}help\` dans le serveur pour ma liste de commandes.*\n\n` +
                    `🔗 **Créé par:** Moussa Fofana\n` +
                    `📦 **Dépôt:** https://github.com/MFOF7310`
            }
        };
        
        const dmT = dmMessages[lang] || dmMessages.en;
        
        const dmEmbed = new EmbedBuilder()
            .setColor('#00d9ff')
            .setTitle(dmT.title)
            .setThumbnail(member.guild.iconURL())
            .setDescription(dmT.description(
                process.env.RULES_CHANNEL_ID || 'N/A',
                process.env.GENERAL_CHANNEL_ID || 'N/A'
            ))
            .setFooter({ text: 'Automated Welcome Protocol' })
            .setTimestamp();

        await member.send({ embeds: [dmEmbed] });
    } catch (e) { 
        console.log(`${yellow}[DM ERROR]${reset} Could not message ${member.user.tag} (Privacy Settings).`); 
    }

    if (logChannel) {
        const joinLog = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('📥 MEMBER JOINED')
            .addFields(
                { name: 'User', value: `<@${member.id}> (\`${member.id}\`)`, inline: false },
                { name: 'Account Age', value: `\`${accountAge}\``, inline: true },
                { name: 'Language', value: `\`${lang.toUpperCase()}\``, inline: true },
                { name: 'Repository', value: 'https://github.com/MFOF7310', inline: true }
            )
            .setTimestamp();
        logChannel.send({ embeds: [joinLog] });
    }
});

// --- CLEANUP ON SHUTDOWN ---
process.on('SIGINT', () => {
    console.log(`${yellow}[SHUTDOWN]${reset} Cleaning up...`);
    
    if (client.userTimeouts) {
        for (const [id, timeout] of client.userTimeouts) {
            clearTimeout(timeout);
        }
        client.userTimeouts.clear();
        console.log(`${green}[SHUTDOWN]${reset} Cleared all pending reminders`);
    }
    
    db.close();
    console.log(`${green}[SHUTDOWN]${reset} Database connection closed.`);
    console.log(`${green}[SHUTDOWN]${reset} Cleanup complete. Goodbye!`);
    process.exit(0);
});

// ✅ CRITICAL: Initialize Lydia
setupLydia(client, db);

// --- LOGIN ---
client.login(process.env.TOKEN);