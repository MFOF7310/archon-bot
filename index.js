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
client.version   = "1.1.0"; 
client.lydiaChannels = {};
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

// --- SQLITE DATABASE (PRO LEVEL) ---
const Database = require('better-sqlite3');
const db = new Database('database.sqlite');

// Create Table
db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        totalMessages INTEGER DEFAULT 0,
        last_xp_gain INTEGER DEFAULT 0
    )
`).run();

// Helper Functions
const getUser = (userId) => db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
const saveUser = (id, name, xp, lvl, msgs, last) => {
    db.prepare(`INSERT OR REPLACE INTO users (id, username, xp, level, totalMessages, last_xp_gain) VALUES (?, ?, ?, ?, ?, ?)`).run(id, name, xp, lvl, msgs, last);
};

// --- GROQ AI CONFIGURATION ---
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ================= SYSTEM PROMPT FOR LYDIA =================
const LYDIA_SYSTEM_PROMPT = `
You are CLOUD_GAMING-223, the AI assistant of the Cloud Gaming-223 Discord server (ARCHITECT CG-223). 
You're polite, smart, and direct. Keep answers concise but informative.
Owner's GitHub: https://github.com/MFOF7310/cloud-gaming-223-digital-engine
`.trim();

// ================= ENHANCED LEVEL-UP SYSTEM =================

// Achievement titles based on level
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

// Dynamic achievement name based on level
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

// Get appropriate image based on level from environment variables
const getLevelImage = (level) => {
    if (level >= 100) return process.env.IMG_LVL_100;
    if (level >= 50) return process.env.IMG_LVL_50;
    if (level >= 25) return process.env.IMG_LVL_25;
    if (level >= 10) return process.env.IMG_LVL_10;
    if (level >= 5) return process.env.IMG_LVL_5;
    return process.env.IMG_LVL_5; // Default image for low levels
};

// Calculate XP progress
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

// Get random congratulatory message
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

// --- THE LOADER: SMOOTH SYNCHRONIZATION (FASTER RELOAD) ---
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
            await sleep(100); // Reduced from 300ms to 100ms for faster loading
            
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
    await sleep(200); // Reduced from 500ms to 200ms
    console.log(`${green}🚀 ENGINE READY | ${client.commands.size} CORE MODULES ONLINE${reset}\n`);
};

// ================= BOOT SEQUENCE =================
client.once(Events.ClientReady, async () => {
    console.clear();
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

// ================= ENHANCED LYDIA HANDLER =================
async function handleLydiaRequest(message, userInput) {
    try {
        await message.channel.sendTyping();
        const classification = await groq.chat.completions.create({
            model: 'llama-3.1-8b-instant',
            messages: [{ role: 'system', content: 'Classifier: "yes" if real-time needed, else "no".' }, { role: 'user', content: userInput }],
            max_tokens: 5
        });

        const needsRealTime = classification.choices[0].message.content.trim().toLowerCase() === 'yes';
        let replyContent = '';

        if (needsRealTime) {
            const searchResults = await braveSearch(userInput);
            const context = searchResults?.map(r => `${r.title}\n${r.description}\n${r.url}`).join('\n\n') || "No results.";
            const completion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'system', content: 'You are Lydia. Answer using these search results.' }, { role: 'user', content: `Results: ${context}\n\nQuestion: ${userInput}` }],
            });
            replyContent = completion.choices[0].message.content;
        } else {
            const completion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'system', content: LYDIA_SYSTEM_PROMPT }, { role: 'user', content: userInput }],
            });
            replyContent = completion.choices[0].message.content;
        }

        const chunks = splitMessage(replyContent);
        await message.reply(chunks[0]);
        for (let i = 1; i < chunks.length; i++) await message.channel.send(chunks[i]);
        return true;
    } catch (err) { return false; }
}

// ================= MESSAGE PROCESSING =================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;
    let userData = getUser(userId);

    // 1. Initialize user if they don't exist in SQLite
    if (!userData) {
        saveUser(userId, message.author.username, 0, 1, 0, 0);
        userData = getUser(userId);
    }

    const now = Date.now();
    const cooldown = 60000; // 1 minute XP cooldown

    // 2. XP & Leveling Logic
    if (now - userData.last_xp_gain > cooldown) {
        const xpGain = Math.floor(Math.random() * 21) + 15;
        let newXP = userData.xp + xpGain;
        let newLevel = Math.floor(newXP / 1000) + 1;
        let totalMsgs = (userData.totalMessages || 0) + 1;

        // 3. Level Up Celebration
        if (newLevel > userData.level) {
            const xpProgress = getXPProgress(newXP, newLevel);
            const achievement = getAchievementName(newLevel);
            
            // --- AUTOMATIC ROLE REWARDS FROM .ENV ---
            const roleRewards = {
                5: process.env.ROLE_LVL_5,
                10: process.env.ROLE_LVL_10,
                25: process.env.ROLE_LVL_25,
                50: process.env.ROLE_LVL_50,
                100: process.env.ROLE_LVL_100
            };

            let rewardText = getNextLevelReward(newLevel);

            if (roleRewards[newLevel]) {
                const role = message.guild.roles.cache.get(roleRewards[newLevel]);
                if (role) {
                    await message.member.roles.add(role).catch(e => console.log(`${yellow}[ROLE ERROR]${reset} ${e.message}`));
                    rewardText = `✨ **Level ${newLevel} Role Unlocked!** — You've been granted the **${role.name}** role.`;
                }
            }

            const levelUpEmbed = new EmbedBuilder()
                .setColor(getLevelColor(newLevel))
                .setAuthor({ name: 'ACHIEVEMENT UNLOCKED!', iconURL: message.author.displayAvatarURL() })
                .setTitle(achievement.name)
                .setDescription(getCongratsMessage(newLevel, message.author.username))
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                .setImage(getLevelImage(newLevel))
                .addFields(
                    { 
                        name: '📊 PROGRESSION', 
                        value: `\`\`\`\nLEVEL ${userData.level} → ${newLevel}\n${xpProgress.bar} ${xpProgress.percentage}%\nXP: ${formatNumber(newXP)}/${formatNumber(newLevel * 1000)}\n\`\`\`` 
                    },
                    { name: '🎁 REWARD', value: rewardText }
                )
                .setFooter({ text: `${message.guild.name} • Architect Engine` })
                .setTimestamp();

            await message.channel.send({ content: `🎉 **LEVEL UP!** <@${userId}>`, embeds: [levelUpEmbed] });
        }

        // 4. Save updated data back to SQLite
        saveUser(userId, message.author.username, newXP, newLevel, totalMsgs, now);
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
            // Pass userData to the command so it has the level info
            await command.run(client, message, args, userData); 
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

    // 1. PUBLIC WELCOME
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

    // 2. REFINED PRIVATE DM LOGIC
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

    // 3. LOG JOIN
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