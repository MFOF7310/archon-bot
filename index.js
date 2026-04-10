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

// --- DYNAMIC VERSIONING (Reads from version.txt) ---
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

const formatNumber = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// ================= MINIMALIST LANGUAGE DETECTION =================
function detectLanguage(usedCommand, serverLanguage = 'en') {
    const cmd = usedCommand.toLowerCase();
    
    const isFrench = /[éèêëàâäùûüîïôöç]/.test(cmd) || 
                     /(ier|ière|eur|euse|ment|tion|ique|ette|eau|age|oire|ance)s?$/i.test(cmd) ||
                     ['aide', 'jeu', 'rang', 'niveau', 'quotidien', 'boutique', 'devine', 'quiz', 'ia', 'config', 'param', 'params', 'paramètres', 'réclamer', 'reclamer', 'collecter', 'recolter'].includes(cmd);
    
    return isFrench ? 'fr' : serverLanguage;
}

function calculateLevel(xp) {
    return Math.floor(0.1 * Math.sqrt(xp || 0)) + 1;
}

// Attach to client
client.detectLanguage = detectLanguage;
client.calculateLevel = calculateLevel;
client.formatNumber = formatNumber;

console.log(`${green}[LANGUAGE]${reset} Minimalist detection initialized (accents + endings + 15 keywords)`);

// --- SQLITE DATABASE ---
const Database = require('better-sqlite3');
const db = new Database('database.sqlite');

// Enable WAL mode for high performance
db.pragma('journal_mode = WAL');
console.log(`${green}[DB]${reset} Database running in WAL mode (High Performance)`);

// ================= GLOBAL AUTO-REPAIR PROTOCOL =================
console.log(`${cyan}[REPAIR]${reset} Initiating Global Neural Schema Repair...`);

const requiredTables = {
    users: `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT, xp INTEGER DEFAULT 0, level INTEGER DEFAULT 1, credits INTEGER DEFAULT 0, streak_days INTEGER DEFAULT 0, total_messages INTEGER DEFAULT 0, last_xp_gain INTEGER DEFAULT 0, games_played INTEGER DEFAULT 0, games_won INTEGER DEFAULT 0, total_winnings INTEGER DEFAULT 0, gaming TEXT DEFAULT '{"game":"CODM","rank":"Unranked"}', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, last_seen DATETIME DEFAULT CURRENT_TIMESTAMP, last_daily INTEGER DEFAULT 0)`,
    server_settings: `CREATE TABLE IF NOT EXISTS server_settings (guild_id TEXT PRIMARY KEY, prefix TEXT DEFAULT '.', language TEXT DEFAULT 'en', welcome_channel TEXT, log_channel TEXT, daily_channel TEXT, shop_channel TEXT, updated_at INTEGER DEFAULT (strftime('%s', 'now')))`,
    lydia_memory: `CREATE TABLE IF NOT EXISTS lydia_memory (user_id TEXT, memory_key TEXT, memory_value TEXT, updated_at INTEGER DEFAULT (strftime('%s', 'now')), PRIMARY KEY (user_id, memory_key))`,
    lydia_agents: `CREATE TABLE IF NOT EXISTS lydia_agents (channel_id TEXT PRIMARY KEY, agent_key TEXT, is_active INTEGER DEFAULT 0, updated_at INTEGER DEFAULT (strftime('%s', 'now')))`,
    user_inventory: `CREATE TABLE IF NOT EXISTS user_inventory (user_id TEXT, item_id TEXT, quantity INTEGER DEFAULT 1, purchased_at INTEGER DEFAULT (strftime('%s', 'now')), expires_at INTEGER, active INTEGER DEFAULT 1, PRIMARY KEY (user_id, item_id))`,
    lydia_introductions: `CREATE TABLE IF NOT EXISTS lydia_introductions (user_id TEXT, channel_id TEXT, introduced_at INTEGER DEFAULT (strftime('%s', 'now')), PRIMARY KEY (user_id, channel_id))`,
    lydia_conversations: `CREATE TABLE IF NOT EXISTS lydia_conversations (channel_id TEXT, user_id TEXT, user_name TEXT, role TEXT, content TEXT, timestamp INTEGER DEFAULT (strftime('%s', 'now')))`,
    reminders: `CREATE TABLE IF NOT EXISTS reminders (id TEXT PRIMARY KEY, user_id TEXT, channel_id TEXT, message TEXT, created_at INTEGER, execute_at INTEGER, status TEXT DEFAULT 'pending')`,
    warnings: `CREATE TABLE IF NOT EXISTS warnings (id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, user_id TEXT NOT NULL, moderator_id TEXT NOT NULL, reason TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now')), expires_at INTEGER, active INTEGER DEFAULT 1)`,
    moderation_logs: `CREATE TABLE IF NOT EXISTS moderation_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, user_id TEXT NOT NULL, moderator_id TEXT NOT NULL, action TEXT NOT NULL, reason TEXT, warning_id TEXT, timestamp INTEGER DEFAULT (strftime('%s', 'now')))`,
    server_backups: `CREATE TABLE IF NOT EXISTS server_backups (id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, name TEXT, data TEXT NOT NULL, created_by TEXT NOT NULL, created_at INTEGER DEFAULT (strftime('%s', 'now')), roles INTEGER, channels INTEGER)`,
    auto_backup_settings: `CREATE TABLE IF NOT EXISTS auto_backup_settings (guild_id TEXT PRIMARY KEY, enabled INTEGER DEFAULT 0, last_backup INTEGER, channel_id TEXT)`
};

for (const [tableName, createSQL] of Object.entries(requiredTables)) {
    try {
        db.exec(createSQL);
    } catch (err) {}
}

// Add shop_channel column if missing
try {
    const columnExists = db.prepare(`PRAGMA table_info(server_settings)`).all().some(col => col.name === 'shop_channel');
    if (!columnExists) {
        db.prepare(`ALTER TABLE server_settings ADD COLUMN shop_channel TEXT`).run();
        console.log(`${cyan}[MIGRATION]${reset} Added column: server_settings.shop_channel`);
    }
} catch (err) {}

console.log(`${green}[REPAIR COMPLETE]${reset} All tables verified`);

// ================= SERVER SETTINGS UTILITY =================
const DEFAULT_SETTINGS = { prefix: PREFIX, language: 'en', welcomeChannel: null, logChannel: null, dailyChannel: null, shopChannel: null };

function getServerSettings(guildId) {
    if (client.settings.has(guildId)) return client.settings.get(guildId);
    try {
        let settings = db.prepare(`SELECT * FROM server_settings WHERE guild_id = ?`).get(guildId);
        if (!settings) {
            db.prepare(`INSERT INTO server_settings (guild_id, prefix, language) VALUES (?, ?, ?)`).run(guildId, DEFAULT_SETTINGS.prefix, DEFAULT_SETTINGS.language);
            settings = { ...DEFAULT_SETTINGS, guild_id: guildId };
        }
        const result = {
            prefix: settings.prefix || DEFAULT_SETTINGS.prefix,
            language: settings.language || DEFAULT_SETTINGS.language,
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
    const columnMap = { prefix: 'prefix', language: 'language', welcome: 'welcome_channel', log: 'log_channel', daily: 'daily_channel', shop: 'shop_channel' };
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

const saveUser = (id, name, xp, lvl, msgs, last, gamesPlayed = 0, gamesWon = 0, totalWinnings = 0, gaming = null, credits = 0, streakDays = 0) => {
    const gamingValue = gaming !== null ? gaming : '{"game":"CODM","rank":"Unranked"}';
    db.prepare(`INSERT OR REPLACE INTO users (id, username, xp, level, total_messages, last_xp_gain, games_played, games_won, total_winnings, gaming, credits, streak_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, name, xp, lvl, msgs, last, gamesPlayed, gamesWon, totalWinnings, gamingValue, credits, streakDays);
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
            }
        } catch (error) { 
            console.log(`${red}[ERROR]${reset} Failed ${file}: ${error.message}`); 
        }
    }
    
    await sleep(200);
    console.log(`${blue}${bold}==============================================${reset}`);
    console.log(`${green}🚀 ENGINE READY | ${client.commands.size} CORE MODULES ONLINE${reset}`);
    console.log(`${blue}${bold}==============================================${reset}\n`);
    
    return client.commands.size;
};

// ================= BOOT SEQUENCE =================
client.once(Events.ClientReady, async () => {
    console.clear();
    
    // ✅ Load plugins and get count
    const moduleCount = await client.loadPlugins();
    loadAgentPreferences();
    
    // ✅ Count active listeners
    const listenerCount = client.listenerCount('messageCreate') + client.listenerCount('interactionCreate');
    
    // ✅ Get version from version.txt
    const version = client.version;
    
    const boxWidth = 64;
    const drawBoxLine = (label, value) => {
        const lineContent = `║  ${label.padEnd(14)} : ${value}`;
        return `${lineContent}${' '.repeat(Math.max(0, boxWidth - lineContent.length - 1))}║`;
    };

    console.log(`\n${blue}${bold}╔${'═'.repeat(boxWidth - 2)}╗${reset}`);
    console.log(`${blue}${bold}║${' '.repeat(Math.floor((boxWidth - 44) / 2))}${cyan}🦅 ARCHITECT CG-223 // NEURAL ENGINE ONLINE${reset}${' '.repeat(Math.max(0, boxWidth - 44 - Math.floor((boxWidth - 44) / 2) - 2))}║${reset}`);
    console.log(`${blue}${bold}╠${'═'.repeat(boxWidth - 2)}╣${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}🤖 CLIENT`, client.user.tag)}${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}📍 NODE`, 'BAMAKO_223 🇲🇱')}${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}📦 VERSION`, `v${version}`)}${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}📊 MODULES`, `${moduleCount} plugins synced`)}${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}👂 LISTENERS`, `${listenerCount} active`)}${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}💾 DATABASE`, `WAL Mode (High Perf)`)}${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}🔗 REPOSITORY`, `github.com/MFOF7310`)}${reset}`);
    console.log(`${blue}${bold}${drawBoxLine(`${green}🏗️ ARCHITECT`, `MOUSSA FOFANA`)}${reset}`);
    console.log(`${blue}${bold}╚${'═'.repeat(boxWidth - 2)}╝${reset}\n`);

    if (client.userTimeouts) {
        for (const [id, timeout] of client.userTimeouts) clearTimeout(timeout);
        client.userTimeouts.clear();
    }

    // ✅ ENHANCED OWNER DM with real-time stats
    try {
        const owner = await client.users.fetch(process.env.OWNER_ID);
        
        const ownerEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setAuthor({ name: '🦅 ARCHITECT CG-223 // ONLINE', iconURL: client.user.displayAvatarURL() })
            .setTitle('⚡ NEURAL ENGINE BOOT COMPLETE')
            .setDescription(
                `**System reboot complete.**\n` +
                `\`\`\`yaml\n` +
                `Modules: ${moduleCount} plugins synced\n` +
                `Version: v${version}\n` +
                `Node: BAMAKO_223 🇲🇱\n` +
                `Listeners: ${listenerCount} active\n` +
                `Database: WAL Mode (High Performance)\n` +
                `\`\`\``
            )
            .addFields(
                { name: '🔗 Repository', value: 'https://github.com/MFOF7310', inline: true },
                { name: '🏗️ Architect', value: 'Moussa Fofana', inline: true },
                { name: '📅 Boot Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            )
            .setFooter({ text: `ARCHITECT CG-223 • Neural Engine v${version}` })
            .setTimestamp();
        
        await owner.send({ embeds: [ownerEmbed] });
        console.log(`${green}[OWNER]${reset} Boot notification sent to Architect`);
    } catch (err) {
        console.log(`${yellow}[OWNER]${reset} Could not send DM to owner`);
    }
});

// ================= MESSAGE PROCESSING =================
client.on(Events.MessageCreate, async (message) => {
    if (!message || message.author?.bot || message.webhookId) return;

    const userId = message.author.id;
    let userData = getUser(userId);
    if (!userData) userData = initializeUser(userId, message.author.username);

    const now = Date.now();
    const cooldown = 60000;

    if (now - (userData.last_xp_gain || 0) > cooldown) {
        const xpGain = Math.floor(Math.random() * 21) + 15;
        let newXP = (userData.xp || 0) + xpGain;
        let newLevel = Math.floor(0.1 * Math.sqrt(newXP)) + 1;
        let totalMsgs = (userData.total_messages || 0) + 1;

        if (newLevel > (userData.level || 1)) {
            await message.channel.send({ content: `🎉 **LEVEL UP!** <@${userId}> reached Level ${newLevel}!` });
        }

        saveUser(userId, message.author.username, newXP, newLevel, totalMsgs, now, 
                userData.games_played || 0, userData.games_won || 0, userData.total_winnings || 0, 
                userData.gaming, userData.credits || 0, userData.streak_days || 0);
    }

    const serverSettings = message.guild ? getServerSettings(message.guild.id) : DEFAULT_SETTINGS;
    const effectivePrefix = serverSettings.prefix || PREFIX;
    
    if (!message.content.startsWith(effectivePrefix)) return;
    
    const args = message.content.slice(effectivePrefix.length).trim().split(/ +/);
    const cmdName = args.shift().toLowerCase();
    
    // 🔥 THE MAGIC LINE - Captures the exact alias used!
    const usedCommand = cmdName;
    
    let command = client.commands.get(cmdName) || client.commands.get(client.aliases.get(cmdName));
    
    // Special handling for Lydia command
    if (!command && (cmdName === 'lydia' || cmdName === 'ai' || cmdName === 'neural' || cmdName === 'ia')) {
        try {
            const lydiaModule = require('./plugins/lydia.js');
            return await lydiaModule.run(client, message, args, db, serverSettings, usedCommand);
        } catch (e) {
            return message.reply("❌ Lydia command execution failed.");
        }
    }

    if (command) {
        try {
            // 🚀 Pass usedCommand to EVERY plugin!
            await command.run(client, message, args, db, serverSettings, usedCommand);
        } catch (e) { 
            console.error(`${red}[COMMAND ERROR]${reset} ${cmdName}:`, e);
            message.reply("⚠️ **Command execution failed.**"); 
        }
    }
});

// ================= INTERACTION HANDLER (NO AUTO-DEFER) =================
client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
        console.log(`${cyan}[INTERACTION]${reset} ${interaction.customId} from ${interaction.user.tag}`);
        // DO NOTHING - let the component collectors handle it!
    }
});

// ================= WELCOME SYSTEM =================
client.on(Events.GuildMemberAdd, async (member) => {
    if (member.user.bot) return;
    const settings = getServerSettings(member.guild.id);
    const welcomeChannel = member.guild.channels.cache.get(settings.welcomeChannel || process.env.WELCOME_CHANNEL_ID);
    if (welcomeChannel) {
        const lang = settings.language || 'en';
        const welcomeMsg = lang === 'fr' 
            ? `🎊 Bienvenue <@${member.id}> sur **${member.guild.name}**!`
            : `🎊 Welcome <@${member.id}> to **${member.guild.name}**!`;
        welcomeChannel.send({ content: welcomeMsg });
    }
});

// --- CLEANUP ON SHUTDOWN ---
process.on('SIGINT', () => {
    console.log(`${yellow}[SHUTDOWN]${reset} Cleaning up...`);
    if (client.userTimeouts) {
        for (const [id, timeout] of client.userTimeouts) clearTimeout(timeout);
        client.userTimeouts.clear();
    }
    db.close();
    process.exit(0);
});

// ✅ Initialize Lydia ONCE
setupLydia(client, db);
console.log(`${green}[INIT]${reset} Lydia setup called ONCE at startup`);

// --- LOGIN ---
client.login(process.env.TOKEN);