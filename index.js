require('dotenv').config(); 

const fs = require('fs');
const path = require('path');
const { Client, Collection, Events, Partials, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const Groq = require('groq-sdk');
const axios = require('axios');

// --- TERMINAL COLORS ---
const green = "\x1b[32m", blue = "\x1b[34m", cyan = "\x1b[36m", yellow = "\x1b[33m", reset = "\x1b[0m", bold = "\x1b[1m";

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
client.commands  = new Collection();
client.aliases   = new Collection();

// --- DYNAMIC VERSIONING ---
try {
    const versionPath = path.join(__dirname, 'version.txt');
    client.version = fs.readFileSync(versionPath, 'utf8').trim();
} catch (err) {
    console.log(`${yellow}[WARNING]${reset} version.txt not found. Defaulting to 1.2.0`);
    client.version = "1.2.0"; 
}

// --- LYDIA GLOBALS ---
client.lydiaChannels = {};  // Tracks which channels have AI active
client.lydiaAgents = {};    // Tracks which neural core is active per channel
client.lastLydiaCall = {};  // Rate limiting

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

// Create Users Table
db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        total_messages INTEGER DEFAULT 0,
        last_xp_gain INTEGER DEFAULT 0,
        games_played INTEGER DEFAULT 0,
        games_won INTEGER DEFAULT 0,
        total_winnings INTEGER DEFAULT 0,
        gaming TEXT DEFAULT '{"game":"CODM","rank":"Unranked"}'
    )
`).run();

// Create Lydia Memory Table for persistent AI context
db.prepare(`
    CREATE TABLE IF NOT EXISTS lydia_memory (
        user_id TEXT,
        memory_key TEXT,
        memory_value TEXT,
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (user_id, memory_key)
    )
`).run();

// Create Lydia Agents Table with is_active column
db.prepare(`
    CREATE TABLE IF NOT EXISTS lydia_agents (
        channel_id TEXT PRIMARY KEY,
        agent_key TEXT,
        is_active INTEGER DEFAULT 0,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
`).run();

// Helper Functions
const getUser = (userId) => db.prepare("SELECT * FROM users WHERE id = ?").get(userId);

const saveUser = (id, name, xp, lvl, msgs, last, gamesPlayed = 0, gamesWon = 0, totalWinnings = 0, gaming = null) => {
    const gamingValue = gaming !== null ? gaming : '{"game":"CODM","rank":"Unranked"}';
    db.prepare(`INSERT OR REPLACE INTO users (id, username, xp, level, total_messages, last_xp_gain, games_played, games_won, total_winnings, gaming) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, name, xp, lvl, msgs, last, gamesPlayed, gamesWon, totalWinnings, gamingValue);
};

const initializeUser = (userId, username) => {
    const existing = getUser(userId);
    if (!existing) {
        db.prepare(`INSERT INTO users (id, username, xp, level, total_messages, last_xp_gain, games_played, games_won, total_winnings, gaming) 
                    VALUES (?, ?, 0, 1, 0, 0, 0, 0, 0, '{"game":"CODM","rank":"Unranked"}')`)
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

// Load saved agent preferences from database on startup
const loadAgentPreferences = () => {
    const savedAgents = db.prepare("SELECT channel_id, agent_key, is_active FROM lydia_agents").all();
    for (const agent of savedAgents) {
        client.lydiaAgents[agent.channel_id] = agent.agent_key;
        console.log(`${cyan}[AGENT]${reset} Loaded ${agent.agent_key} for channel ${agent.channel_id} (active: ${agent.is_active ? 'ON' : 'OFF'})`);
    }
    console.log(`${green}[AGENT]${reset} Loaded ${savedAgents.length} persistent agent preferences`);
};

// Save agent preference to database with is_active status
const saveAgentPreference = (channelId, agentKey) => {
    db.prepare(`
        INSERT OR REPLACE INTO lydia_agents (channel_id, agent_key, is_active, updated_at)
        VALUES (?, ?, ?, strftime('%s', 'now'))
    `).run(channelId, agentKey, client.lydiaChannels[channelId] ? 1 : 0);
};

// --- ATTACH HELPER FUNCTIONS TO CLIENT FOR PLUGINS ---
client.saveAgentPreference = saveAgentPreference;
client.getUser = getUser;
client.initializeUser = initializeUser;
client.updateGamingStats = updateGamingStats;
client.db = db;  // Expose database if needed

// --- GROQ AI CONFIGURATION ---
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ================= ENHANCED LEVEL-UP SYSTEM =================

const achievements = {
    1: { name: "🌟 BEGINNER'S LUCK", desc: "Take your first step into greatness!" },
    5: { name: "🎮 APPRENTICE GAMER", desc: "Level 5 reached! You're learning fast!" },
    10: { name: "⚔️ SKILLED WARRIOR", desc: "Double digits! Your skills are sharpening!" },
    25: { name: "🏆 ELITE FIGHTER", desc: "A true warrior emerges!" },
    50: { name: "💎 MASTER TACTICIAN", desc: "Your strategies are legendary!" },
    75: { name: "👑 GRAND MASTER", desc: "Among the elite few!" },
    100: { name: "🌀 TRANSCENDENT", desc: "You've reached god-like status!" },
    150: { name: "⭐ MYTHICAL LEGEND", desc: "Your name will echo through history!" },
    200: { name: "🔥 INFINITY SLAYER", desc: "The ultimate gaming champion!" }
};

const getAchievementName = (level) => {
    for (const [milestone, achievement] of Object.entries(achievements).reverse()) {
        if (level >= parseInt(milestone)) {
            return achievement;
        }
    }
    
    const levelTiers = [
        { max: 10, name: "🌱 NOVICE", desc: "Every journey begins with a single step!" },
        { max: 25, name: "⭐ ASPIRANT", desc: "Building momentum and skill!" },
        { max: 50, name: "⚔️ COMBATANT", desc: "Your dedication shows!" },
        { max: 75, name: "🛡️ DEFENDER", desc: "Strong and reliable!" },
        { max: 100, name: "💎 CHAMPION", desc: "A force to be reckoned with!" }
    ];
    
    for (const tier of levelTiers) {
        if (level <= tier.max) {
            return { name: tier.name, desc: tier.desc };
        }
    }
    
    return { name: "🏆 LEGEND", desc: "Your legacy continues to grow!" };
};

const getLevelImage = (level) => {
    if (level >= 100) return process.env.IMG_LVL_100 || 'https://via.placeholder.com/1200x400/ff4444/ffffff?text=MASTER+TIER';
    if (level >= 50) return process.env.IMG_LVL_50 || 'https://via.placeholder.com/1200x400/44aaff/ffffff?text=DIAMOND+TIER';
    if (level >= 25) return process.env.IMG_LVL_25 || 'https://via.placeholder.com/1200x400/ffaa44/ffffff?text=PLATINUM+TIER';
    if (level >= 10) return process.env.IMG_LVL_10 || 'https://via.placeholder.com/1200x400/dddddd/000000?text=GOLD+TIER';
    if (level >= 5) return process.env.IMG_LVL_5 || 'https://via.placeholder.com/1200x400/cd7f32/ffffff?text=SILVER+TIER';
    return process.env.IMG_LVL_0 || 'https://via.placeholder.com/1200x400/8B5A2B/ffffff?text=BRONZE+TIER';
};

const getXPProgress = (xp, level) => {
    const xpForCurrentLevel = (level - 1) * 1000;
    const xpForNextLevel = level * 1000;
    const currentProgress = xp - xpForCurrentLevel;
    const xpNeeded = xpForNextLevel - xpForCurrentLevel;
    const percentage = (currentProgress / xpNeeded) * 100;
    
    const barLength = 20;
    const filledBars = Math.floor((percentage / 100) * barLength);
    const emptyBars = barLength - filledBars;
    const progressBar = `▰`.repeat(filledBars) + `▱`.repeat(emptyBars);
    
    return {
        current: currentProgress,
        needed: xpNeeded,
        percentage: Math.round(percentage),
        bar: progressBar
    };
};

const getCongratsMessage = (level, userName) => {
    const messages = [
        `GG **${userName}**, you just unlocked the achievement: **${getAchievementName(level).name}**! 😍`,
        `Amazing! **${userName}** reached **Level ${level}**! The grind pays off! 🎉`,
        `**${userName}** levels up! ${getAchievementName(level).name} achieved! ⚡`,
        `Congratulations **${userName}**! Level ${level} looks good on you! 🌟`,
        `Power surge detected! **${userName}** hit **Level ${level}**! 🚀`,
        `Legendary progression! **${userName}** ascends to **Level ${level}**! 👑`
    ];
    
    if (level % 10 === 0) {
        return `🏆 **MILESTONE UNLOCKED!** 🏆\n**${userName}** reaches **Level ${level}**! ${getAchievementName(level).name}!`;
    }
    if (level === 1) {
        return `🎊 Welcome to the journey, **${userName}**! Level 1 achieved! The adventure begins! 🎊`;
    }
    
    return messages[Math.floor(Math.random() * messages.length)];
};

// --- THE LOADER ---
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
            console.log(`${blue}[ERROR]${reset} Failed ${file}: ${error.message}`); 
        }
    }
    await sleep(200);
    console.log(`${green}🚀 ENGINE READY | ${client.commands.size} CORE MODULES ONLINE${reset}\n`);
};

// ================= BOOT SEQUENCE =================
client.once(Events.ClientReady, async () => {
    console.clear();
    
    // Load persistent agent preferences from database
    loadAgentPreferences();
    
    await client.loadPlugins();
    console.log(`${green}🛰️  CLIENT   : ${client.user.tag}${reset}`);
    console.log(`${green}📍 NODE     : BAMAKO_223${reset}\n`);

    try {
        const owner = await client.users.fetch(process.env.OWNER_ID);
        const alertEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('🦅 ARCHITECT CG-223 // ONLINE')
            .setDescription(`System reboot complete. **${client.commands.size}** modules synced.\nVersion: **${client.version}**\nNode: **BAMAKO_223** 🎮`)
            .setTimestamp();
        await owner.send({ embeds: [alertEmbed] });
    } catch (err) { console.log(`${yellow}[NOTICE]${reset} Owner DM Failed.`); }
});

// ================= BRAVE SEARCH & UTILITIES =================
async function braveSearch(query) {
    try {
        if (!process.env.BRAVE_API_KEY) return null;
        const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
            headers: { 'X-Subscription-Token': process.env.BRAVE_API_KEY },
            params: { q: query, count: 3 }
        });
        return response.data.web?.results.map(r => ({ title: r.title, description: r.description, url: r.url }));
    } catch (e) { return null; }
}

function splitMessage(text, maxLength = 2000) {
    if (text.length <= maxLength) return [text];
    const chunks = [];
    let current = '';
    text.split(/(?<=[.!?])\s+/).forEach(s => {
        if ((current + ' ' + s).length <= maxLength) current += (current ? ' ' : '') + s;
        else { chunks.push(current); current = s; }
    });
    if (current) chunks.push(current);
    return chunks;
}

// ================= ENHANCED LYDIA HANDLER WITH AGENTS, MEMORY, AND "EYES" =================
async function handleLydiaRequest(message, userInput) {
    try {
        await message.channel.sendTyping();
        
        // --- THE "EYES": Dynamic Context Gathering ---
        const serverName = message.guild ? message.guild.name : "Direct Message";
        const channelName = message.channel.name;
        const currentUserName = message.member?.displayName ?? message.author.username;
        
        const channelId = message.channel.id;
        const activeAgentKey = client.lydiaAgents?.[channelId] || 'default';
        
        // Define Neural Cores using dynamic server and user info
        const neuralCores = {
            architect: `You are ARCHITECT Lydia, a technical AI specializing in coding, Discord bot architecture, database management, and system optimization. 
You work for the "${serverName}" Discord server. Provide detailed technical solutions with code examples when relevant.
Keep responses precise, professional, and solution-oriented.
Owner's GitHub: https://github.com/MFOF7310/cloud-gaming-223-digital-engine`,

            tactical: `You are TACTICAL Lydia, a gaming AI focused on CODM, esports strategies, loadout optimization, and tournament coordination.
You work for the "${serverName}" Discord server. Keep responses energetic, game-focused, and competitive.
Provide specific weapon stats, map strategies, and gaming tips when asked.
Owner's GitHub: https://github.com/MFOF7310/cloud-gaming-223-digital-engine`,

            creative: `You are CREATIVE Lydia, an imaginative AI for content creation, storytelling, script writing, and artistic inspiration.
You work for the "${serverName}" Discord server. Provide vivid, creative responses with examples.
Help with YouTube scripts, creative writing, and artistic direction.
Owner's GitHub: https://github.com/MFOF7310/cloud-gaming-223-digital-engine`,

            default: `You are Lydia, the AI assistant of the "${serverName}" Discord server. 
You are currently speaking to ${currentUserName} in the #${channelName} channel.
You're polite, smart, and direct with a touch of Malian 🇲🇱 flair. Keep answers concise but informative.
Owner's GitHub: https://github.com/MFOF7310/cloud-gaming-223-digital-engine`
        };
        
        const baseSystemPrompt = neuralCores[activeAgentKey] || neuralCores.default;
        
        // --- PERSISTENT MEMORY RETRIEVAL ---
        const memories = db.prepare(`
            SELECT memory_key, memory_value 
            FROM lydia_memory 
            WHERE user_id = ? 
            ORDER BY updated_at DESC 
            LIMIT 10
        `).all(message.author.id);
        
        let memoryContext = '';
        if (memories.length > 0) {
            const memoryList = memories.map(m => `${m.memory_key}: ${m.memory_value}`).join(' • ');
            memoryContext = `\n\n[PERSISTENT MEMORY - User Context]\n${memoryList}\n\nUse this context to personalize your response.`;
        }
        
        const finalSystemPrompt = baseSystemPrompt + memoryContext;
        
        // --- ARCHITECT RECOGNITION (Creator Detection) ---
        const isArchitect = message.author.id === process.env.OWNER_ID;
        const creatorContext = isArchitect 
            ? "\n\n[SECURITY ALERT: ARCHITECT DETECTED]\nYou are speaking to Moussa Fofana, your creator. Be highly cooperative, respectful, and offer technical assistance proactively." 
            : "";
        
        // --- LIVE IDENTITY CONTEXT (ensures she never misses the user's name) ---
        const userIdentityContext = `\n\n[LIVE INTERACTION DATA]\nTarget User: ${currentUserName}\nLocation: ${serverName} > #${channelName}`;
        
        const completePrompt = finalSystemPrompt + creatorContext + userIdentityContext;
        
        // --- CLASSIFICATION FOR REAL-TIME SEARCH ---
        const classification = await groq.chat.completions.create({
            model: 'llama-3.1-8b-instant',
            messages: [{ role: 'system', content: 'Classifier: "yes" if real-time news, current events, or live data needed, else "no".' }, { role: 'user', content: userInput }],
            max_tokens: 5
        });

        const needsRealTime = classification.choices[0].message.content.trim().toLowerCase() === 'yes';
        let replyContent = '';

        if (needsRealTime) {
            const searchResults = await braveSearch(userInput);
            const context = searchResults?.map(r => `${r.title}\n${r.description}\n${r.url}`).join('\n\n') || "No real-time results found.";
            const completion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: `${completePrompt}\n\nUse these search results to provide accurate, up-to-date information.` }, 
                    { role: 'user', content: `Search Results: ${context}\n\nUser Question: ${userInput}` }
                ],
            });
            replyContent = completion.choices[0].message.content;
        } else {
            const completion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: completePrompt }, 
                    { role: 'user', content: userInput }
                ],
            });
            replyContent = completion.choices[0].message.content;
        }

        // --- AUTO-LEARN: STORE NEW MEMORIES ---
        const nameMatch = userInput.match(/my name is (\w+)/i) || userInput.match(/i'm (\w+)/i) || userInput.match(/i am (\w+)/i);
        const likeMatch = userInput.match(/i (?:like|love|prefer) (.+?)(?:\.|$)/i);
        const gameMatch = userInput.match(/i play (\w+)/i) || userInput.match(/my favorite game is (\w+)/i);
        
        if (nameMatch && nameMatch[1]) {
            const name = nameMatch[1];
            db.prepare(`
                INSERT OR REPLACE INTO lydia_memory (user_id, memory_key, memory_value, updated_at)
                VALUES (?, ?, ?, strftime('%s', 'now'))
            `).run(message.author.id, 'name', name);
            console.log(`[LYDIA MEMORY] Stored name for ${message.author.tag}: ${name}`);
        }
        
        if (likeMatch && likeMatch[1]) {
            const preference = likeMatch[1].substring(0, 200);
            db.prepare(`
                INSERT OR REPLACE INTO lydia_memory (user_id, memory_key, memory_value, updated_at)
                VALUES (?, ?, ?, strftime('%s', 'now'))
            `).run(message.author.id, 'preference', preference);
            console.log(`[LYDIA MEMORY] Stored preference for ${message.author.tag}`);
        }
        
        if (gameMatch && gameMatch[1]) {
            const game = gameMatch[1];
            db.prepare(`
                INSERT OR REPLACE INTO lydia_memory (user_id, memory_key, memory_value, updated_at)
                VALUES (?, ?, ?, strftime('%s', 'now'))
            `).run(message.author.id, 'favorite_game', game);
            console.log(`[LYDIA MEMORY] Stored favorite game for ${message.author.tag}: ${game}`);
        }

        // Send response
        const chunks = splitMessage(replyContent);
        await message.reply(chunks[0]);
        for (let i = 1; i < chunks.length; i++) await message.channel.send(chunks[i]);
        
        client.lastLydiaCall[message.author.id] = Date.now();
        
        return true;
    } catch (err) { 
        console.error('[LYDIA ERROR]', err);
        return false; 
    }
}

// ================= MESSAGE PROCESSING =================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

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
        let newLevel = Math.floor(newXP / 1000) + 1;
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
                        value: `\`\`\`\nLEVEL ${userData.level || 1} → ${newLevel}\n${xpProgress.bar} ${xpProgress.percentage}%\nXP: ${formatNumber(newXP)}/${formatNumber(newLevel * 1000)}\n\`\`\`` 
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
                userData.gaming || '{"game":"CODM","rank":"Unranked"}');
    }

    // --- LYDIA AI HANDLER ---
    if (client.lydiaChannels && client.lydiaChannels[message.channel.id]) {
        if (message.mentions.has(client.user) || (message.reference && (await message.channel.messages.fetch(message.reference.messageId)).author.id === client.user.id)) {
            const userInput = message.content.replace(/<@!?[0-9]+>/g, '').trim() || 'Hello!';
            await handleLydiaRequest(message, userInput);
            return;
        }
    }

    // --- COMMAND HANDLER ---
    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const cmdName = args.shift().toLowerCase();
    const command = client.commands.get(cmdName) || client.commands.get(client.aliases.get(cmdName));
    
    if (command) {
        try { 
            await command.run(client, message, args, db);
        } 
        catch (e) { 
            console.error(e);
            message.reply("⚠️ **Command execution failed.**"); 
        }
    }
});

// ================= PROFESSIONAL WELCOME & DM PROTOCOL =================
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
                `🤖 Mention **@Lydia** for AI assistance.`
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
                `*I am ARCHITECT CG-223. Type \`${PREFIX}help\` in the server for my command list.*`
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
                { name: 'Account Age', value: `\`${accountAge}\``, inline: true }
            )
            .setTimestamp();
        logChannel.send({ embeds: [joinLog] });
    }
});

// Login to Discord
client.login(process.env.TOKEN);