require('dotenv').config(); 

const fs = require('fs');
const path = require('path');
const { Client, Collection, Events, Partials, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');

// IMPORT LYDIA SETUP FUNCTION
const { setupLydia } = require('./plugins/lydia.js');

// --- GLOBAL ERROR HANDLER (Prevents crashes) ---
process.on('uncaughtException', (error) => {
    console.log(`\x1b[31m[UNCAUGHT EXCEPTION]\x1b[0m ${error.message}`);
    console.log(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.log(`\x1b[31m[UNHANDLED REJECTION]\x1b[0m ${reason}`);
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
client.userTimeouts = new Map(); // For persistent reminders

// --- DYNAMIC VERSIONING ---
function getVersion() {
    try {
        const versionPath = path.join(__dirname, 'version.txt');
        if (fs.existsSync(versionPath)) {
            const version = fs.readFileSync(versionPath, 'utf8').trim();
            return version;
        } else {
            fs.writeFileSync(versionPath, '1.3.2', 'utf8');
            return '1.3.2';
        }
    } catch (err) {
        return '1.3.2';
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

// ================= COMPLETE DATABASE SCHEMA =================

// --- USERS TABLE ---
db.prepare(`
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
`).run();

// ================= GLOBAL AUTO-PATCHER =================
console.log(`${cyan}[SYSTEM]${reset} Syncing Global Neural Schema...`);

const expectedSchema = {
    credits: "INTEGER DEFAULT 0",
    streak_days: "INTEGER DEFAULT 0",
    total_winnings: "INTEGER DEFAULT 0",
    games_played: "INTEGER DEFAULT 0",
    games_won: "INTEGER DEFAULT 0",
    created_at: "DATETIME DEFAULT CURRENT_TIMESTAMP",
    last_daily: "INTEGER DEFAULT 0",
    total_messages: "INTEGER DEFAULT 0",
    last_seen: "DATETIME DEFAULT CURRENT_TIMESTAMP"
};

Object.entries(expectedSchema).forEach(([colName, colType]) => {
    try {
        const columnExists = db.prepare(`PRAGMA table_info(users)`).all().some(col => col.name === colName);
        if (!columnExists) {
            db.prepare(`ALTER TABLE users ADD COLUMN ${colName} ${colType}`).run();
            console.log(`${green}[DB SYNC]${reset} Column added: ${colName}`);
        }
    } catch (err) {
        console.log(`${red}[DB ERROR]${reset} Failed to sync ${colName}: ${err.message}`);
    }
});

console.log(`${green}[READY]${reset} Database schema is 100% Synchronized.`);

// --- LYDIA TABLES ---
db.prepare(`
    CREATE TABLE IF NOT EXISTS lydia_memory (
        user_id TEXT,
        memory_key TEXT,
        memory_value TEXT,
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (user_id, memory_key)
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS lydia_agents (
        channel_id TEXT PRIMARY KEY,
        agent_key TEXT,
        is_active INTEGER DEFAULT 0,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS user_inventory (
        user_id TEXT,
        item_id TEXT,
        quantity INTEGER DEFAULT 1,
        purchased_at INTEGER DEFAULT (strftime('%s', 'now')),
        expires_at INTEGER,
        PRIMARY KEY (user_id, item_id)
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS lydia_introductions (
        user_id TEXT,
        channel_id TEXT,
        introduced_at INTEGER DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (user_id, channel_id)
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS lydia_conversations (
        channel_id TEXT,
        user_id TEXT,
        role TEXT,
        content TEXT,
        timestamp INTEGER DEFAULT (strftime('%s', 'now'))
    )
`).run();

// ================= REMINDERS TABLE (PERSISTENT) =================
db.prepare(`
    CREATE TABLE IF NOT EXISTS reminders (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        channel_id TEXT,
        message TEXT,
        created_at INTEGER,
        execute_at INTEGER,
        status TEXT DEFAULT 'pending'
    )
`).run();

// Add indexes for better performance
db.prepare(`CREATE INDEX IF NOT EXISTS idx_reminders_execute ON reminders(execute_at, status)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id, status)`).run();

console.log(`${green}[DB]${reset} Reminders table ready for persistent storage`);

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
            console.log(`${green}[AGENT]${reset} No active agents found.`);
            return;
        }
        savedAgents.forEach(agent => {
            if (agent.channel_id) {
                client.lydiaChannels[agent.channel_id] = true;
                client.lydiaAgents[agent.channel_id] = agent.agent_key || 'default';
            }
        });
        console.log(`${green}[AGENT]${reset} Restored ${savedAgents.length} active agents.`);
    } catch (err) {
        console.log(`${yellow}[AGENT]${reset} No agents to restore.`);
    }
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

// --- PLUGIN LOADER ---
client.loadPlugins = async () => {
    client.commands.clear();
    client.aliases.clear();
    console.log(`\n${blue}${bold}==============================================${reset}`);
    console.log(`${cyan}🛰️  ARCHITECT CG-223 | MODULE SYNCHRONIZATION${reset}`);
    console.log(`${blue}${bold}==============================================${reset}`);

    const pluginPath = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginPath)) fs.mkdirSync(pluginPath);

    const pluginFiles = fs.readdirSync(pluginPath).filter(file => file.endsWith('.js'));
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
    
    client.version = getVersion();
    
    await client.loadPlugins();
    
    // ✅ CRITICAL: Initialize Lydia with database
    console.log(`${cyan}[LYDIA]${reset} Initializing Neural Interface...`);
    setupLydia(client, db);
    console.log(`${green}[LYDIA]${reset} Neural Core structure ready.`);
    
    loadAgentPreferences();
    
    // ========== ARCHITECT CG-223 BOOT HEADER (DYNAMIC ALIGNMENT) ==========
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

    // Clear old timeouts on restart
    if (client.userTimeouts) {
        for (const [id, timeout] of client.userTimeouts) {
            clearTimeout(timeout);
        }
        client.userTimeouts.clear();
        console.log(`${cyan}[REMINDER]${reset} Cleared old timeout queue on restart`);
    }

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

// ================= MESSAGE PROCESSING (WITH ANTI-LOOP SAFETY & LYDIA FIX) =================
client.on(Events.MessageCreate, async (message) => {
    // IGNORE LES BOTS ET LES WEBHOOKS (Empêche Lydia de se répondre à elle-même)
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
            
            const logChannel = message.guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
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

    // ================= COMMAND HANDLER (WITH LYDIA FIX) =================
    if (!message.content.startsWith(PREFIX)) return;
    
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const cmdName = args.shift().toLowerCase();
    
    // 🛰️ CRITICAL FIX: Manually link the 'lydia' command if it was excluded from scan
    let command = client.commands.get(cmdName) || client.commands.get(client.aliases.get(cmdName));
    
    // Special handling for Lydia command (bypasses the normal command registry if needed)
    if (!command && (cmdName === 'lydia' || cmdName === 'ai' || cmdName === 'neural')) {
        console.log(`${cyan}[LYDIA]${reset} Manual command trigger detected: ${cmdName}`);
        try {
            const lydiaModule = require('./plugins/lydia.js');
            // Run the command manually from the exported 'run' function
            return await lydiaModule.run(client, message, args, db);
        } catch (e) {
            console.error(`${red}[LYDIA CMD ERROR]${reset}`, e);
            return message.reply("❌ Lydia command execution failed. Please check logs.");
        }
    }

    // Normal command execution for all other commands
    if (command) {
        try { 
            await command.run(client, message, args, db);
        } catch (e) { 
            console.error(`${red}[COMMAND ERROR]${reset} ${cmdName}:`, e);
            message.reply("⚠️ **Command execution failed.**"); 
        }
    }
});

// --- WELCOME SYSTEM ---
client.on(Events.GuildMemberAdd, async (member) => {
    if (member.user.bot) return;

    const { WELCOME_CHANNEL_ID, RULES_CHANNEL_ID, GENERAL_CHANNEL_ID, LOG_CHANNEL_ID } = process.env;
    const welcomeChannel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    const logChannel = member.guild.channels.cache.get(LOG_CHANNEL_ID);
    const accountAge = getAccountAge(member.user.createdAt);

    if (welcomeChannel) {
        const welcomeEmbed = new EmbedBuilder()
            .setColor('#00d9ff')
            .setAuthor({ name: `CONNECTION ESTABLISHED: ${member.guild.name.toUpperCase()}`, iconURL: member.guild.iconURL() })
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setTitle(`👋 Welcome to the Network, ${member.user.username}!`)
            .setDescription(
                `🎉 **Greetings <@${member.id}>.** You are official **Member #${member.guild.memberCount}**.\n\n` +
                `📊 **Security Check:**\n` +
                `• 🛠️ Account Created: \`${accountAge}\`\n\n` +
                `🚀 **Initialization Protocol:**\n` +
                `• 📜 Review Rules: <#${RULES_CHANNEL_ID}>\n` +
                `• 💬 Main Discussion: <#${GENERAL_CHANNEL_ID}>\n\n` +
                `🤖 Mention **@Lydia** for AI assistance.\n` +
                `🔗 **Developer:** Moussa Fofana (https://github.com/MFOF7310)`
            )
            .setFooter({ text: `ARCHITECT CG-223 | Intelligent System` })
            .setTimestamp();

        welcomeChannel.send({ content: `🎊 Welcome <@${member.id}>!`, embeds: [welcomeEmbed] });
    }

    try {
        const dmEmbed = new EmbedBuilder()
            .setColor('#00d9ff')
            .setTitle(`🔒 ENCRYPTED TRANSMISSION: ${member.guild.name.toUpperCase()}`)
            .setThumbnail(member.guild.iconURL())
            .setDescription(
                `Hello **${member.user.username}**, initialization complete.\n\n` +
                `Welcome to the inner circle. To get started, please check the following sectors:\n\n` +
                `📂 **Directives:** <#${RULES_CHANNEL_ID}>\n` +
                `💬 **Hub:** <#${GENERAL_CHANNEL_ID}>\n\n` +
                `*I am ARCHITECT CG-223. Type \`${PREFIX}help\` in the server for my command list.*\n\n` +
                `🔗 **Created by:** Moussa Fofana\n` +
                `📦 **Repository:** https://github.com/MFOF7310`
            )
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
    
    console.log(`${green}[SHUTDOWN]${reset} Cleanup complete. Goodbye!`);
    process.exit(0);
});

// --- LOGIN ---
client.login(process.env.TOKEN);