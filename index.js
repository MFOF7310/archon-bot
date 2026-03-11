require('dotenv').config(); 

const fs = require('fs');
const path = require('path');
const { Client, Collection, Events, Partials, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Groq = require('groq-sdk');

// --- TERMINAL COLORS ---
const green = "\x1b[32m", blue = "\x1b[34m", cyan = "\x1b[36m", yellow = "\x1b[33m", reset = "\x1b[0m", bold = "\x1b[1m";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

// --- SYSTEM GLOBALS ---
client.commands  = new Collection();
client.aliases   = new Collection();
client.version   = "1.0.0";
client.lydiaChannels = {};
client.lastLydiaCall = {};

const PREFIX = process.env.PREFIX || ".";

// --- DATABASE: THE PERSISTENCE LAYER ---
const dbPath = path.join(__dirname, 'database.json');
let database = {};

if (fs.existsSync(dbPath)) {
    try {
        database = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch (e) {
        console.log(`${yellow}[WARN]${reset} Database corrupted. Initializing fresh.`);
        database = {};
    }
}

const saveDatabase = () => {
    fs.writeFileSync(dbPath, JSON.stringify(database, null, 2));
};

// --- GEMINI AI CONFIGURATION (ENHANCED FOR IMAGES) ---
if (!process.env.GEMINI_API_KEY) {
    console.log(`${yellow}[WARN]${reset} GEMINI_API_KEY not found in .env file`);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
client.model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",  // Best for images and fast responses
});

console.log(`${green}[SUCCESS]${reset} Gemini AI initialized with vision capabilities`);

// --- GROQ AI CONFIGURATION ---
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ================= UPDATED SYSTEM PROMPT WITH BETTER FALLBACK =================
const LYDIA_SYSTEM_PROMPT = `
You are Lydia, the official AI assistant of the Cloud Gaming-223 Discord server (also known as ARCHITECT CG-223).
You are polite, smart, friendly, and direct. You never insult users. You keep answers concise but informative.

You are an expert in:
- Call of Duty Mobile (CODM): weapons, attachments, gunsmith builds, ranked modes, Battle Royale, operators, seasonal updates, meta loadouts, ranked push tips, scorestreaks
- General gaming: PC, console, and mobile games (Valorant, Fortnite, FIFA, Free Fire, PUBG Mobile, etc.)
- Real-life general knowledge: science, technology, history, sports (based on your training up to early 2025)
- Coding and technology: JavaScript, Python, Discord bots, general programming help

IMPORTANT GUIDELINES:

1. For questions about **future updates, unreleased content, or current events**:
   - Be honest that you don't have real-time web access
   - Share general patterns (e.g., "CODM usually updates every 4-6 weeks")
   - Suggest where users CAN find real-time info (official channels, social media, YouTubers)
   - Offer to help with related topics you CAN discuss

2. For questions about **existing games, strategies, loadouts**:
   - Give detailed, helpful answers based on your training
   - Use gaming slang naturally (e.g., "W gun", "meta", "ranked grind")
   - Be specific with attachments, perks, and playstyles

3. Always respond in the same language the user writes in
4. Never pretend to be a human — you are Lydia, an AI
5. Keep responses under 400 words unless a detailed answer is truly needed

EXAMPLES OF GOOD RESPONSES:
- User: "What's new in next CODM update?" → Explain you can't access future data, share update patterns, suggest official sources, offer to discuss current meta
- User: "Best BP50 loadout?" → Give detailed attachments, perks, and playstyle tips
- User: "Who won the latest COD tournament?" → Explain you don't have live results, suggest where to check, offer to discuss tournament formats/history
`.trim();

// --- THE LOADER: MODULE SYNCHRONIZATION ---
client.loadPlugins = async () => {
    client.commands.clear();
    client.aliases.clear();

    console.log(`\n${blue}${bold}==============================================${reset}`);
    console.log(`${cyan}🛰️  ARCHITECT CG-223 | MODULE SYNCHRONIZATION${reset}`);
    console.log(`${blue}${bold}==============================================${reset}`);

    const pluginPath = path.join(__dirname, 'plugins');

    if (!fs.existsSync(pluginPath)) {
        console.log(`${yellow}[WARN]${reset} Plugins folder not found! Creating one...`);
        fs.mkdirSync(pluginPath);
    }

    const pluginFiles = fs.readdirSync(pluginPath).filter(file => file.endsWith('.js'));

    for (const file of pluginFiles) {
        try {
            const filePath = path.join(pluginPath, file);
            delete require.cache[require.resolve(filePath)];

            const command = require(filePath);

            if (command.name && command.run) {
                client.commands.set(command.name, command);

                if (command.aliases && Array.isArray(command.aliases)) {
                    command.aliases.forEach(alias => client.aliases.set(alias, command.name));
                }

                console.log(`${green}[SUCCESS]${reset} Linked Module: ${cyan}${command.name.toUpperCase()}${reset}`);
            } else {
                console.log(`${yellow}[SKIPPED]${reset} ${file} is missing Name/Run export.`);
            }
        } catch (error) {
            console.log(`${blue}[ERROR]${reset} Failed to link ${file}: ${error.message}`);
        }

        await new Promise(r => setTimeout(r, 50));
    }

    console.log(`${blue}${bold}----------------------------------------------${reset}`);
    console.log(`${green}🚀 ENGINE READY | ${client.commands.size} CORE MODULES ONLINE${reset}`);
    console.log(`${blue}${bold}----------------------------------------------${reset}\n`);
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
            .setDescription(`System reboot complete. **${client.commands.size}** modules synced.\nLydia AI is online with enhanced fallback responses! 🎮`)
            .setTimestamp();
        await owner.send({ embeds: [alertEmbed] });
    } catch (err) {
        console.log(`${yellow}[NOTICE]${reset} DM Failed.`);
    }
});

// ================= ENHANCED LYDIA HANDLER WITH SMART DETECTION =================
async function handleLydiaRequest(message, userInput) {
    try {
        await message.channel.sendTyping();
        
        // Detect if question needs real-time info
        const realTimeKeywords = /current|latest|news|today|weather|now|update|recent|new|release|upcoming|next|future|announce|just dropped|just released|this week|this month|score|result|winner|champion|tournament|live/i;
        const needsRealTime = realTimeKeywords.test(userInput);
        
        // Detect if it's CODM/gaming related
        const gamingKeywords = /codm|call of duty|cod mobile|loadout|gun|weapon|attachment|perk|scorestreak|ranked|battle royale|br|multiplayer|mp|meta|class setup|build|season|battle pass|operator|skill|gameplay|tips|tricks|strategy/i;
        const isGaming = gamingKeywords.test(userInput);
        
        // For questions needing real-time info
        if (needsRealTime) {
            console.log(`${cyan}[LYDIA]${reset} Real-time question detected, using knowledge base`);
            
            // Use regular model with special instructions for real-time questions
            const completion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { 
                        role: 'system', 
                        content: LYDIA_SYSTEM_PROMPT + "\n\nIMPORTANT: The user is asking about something that would normally require real-time data. Since you don't have web search access, be honest about this limitation but still helpful. Share general knowledge patterns, suggest official sources, and offer to help with related topics you CAN discuss." 
                    },
                    { role: 'user', content: userInput }
                ],
                max_tokens: 700,
                temperature: 0.7,
            });

            const reply = completion.choices[0].message.content;
            await message.reply(reply);
            return true;
        }
        
        // For gaming questions (CODM, etc.) - give detailed answers
        if (isGaming) {
            console.log(`${cyan}[LYDIA]${reset} Gaming question detected, using gaming expertise`);
            
            const completion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { 
                        role: 'system', 
                        content: LYDIA_SYSTEM_PROMPT + "\n\nThis is a gaming question. Be specific and helpful. For CODM loadout questions, include exact attachments, perks, and explain WHY they work well together. Use gaming slang naturally." 
                    },
                    { role: 'user', content: userInput }
                ],
                max_tokens: 700,
                temperature: 0.7,
            });

            const reply = completion.choices[0].message.content;
            await message.reply(reply);
            return true;
        }
        
        // For general questions - normal conversation
        console.log(`${cyan}[LYDIA]${reset} General question, using standard response`);
        
        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: LYDIA_SYSTEM_PROMPT },
                { role: 'user', content: userInput }
            ],
            max_tokens: 600,
            temperature: 0.7,
        });

        const reply = completion.choices[0].message.content;
        await message.reply(reply);
        return true;
        
    } catch (err) {
        console.error(`${yellow}[LYDIA ERROR]${reset}`, err.message);
        return false;
    }
}

// ================= THE ENGINE: MESSAGE PROCESSING =================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;

    // 1. XP REWARD PROTOCOL
    if (!database[userId]) {
        database[userId] = {
            name: message.author.username,
            xp: 0,
            level: 1,
            gaming: { game: "NOT SET", rank: "Unranked" }
        };
    }

    database[userId].xp += Math.floor(Math.random() * (40 - 20 + 1)) + 20;

    const newLevel = Math.floor(database[userId].xp / 1000) + 1;
    if (newLevel > database[userId].level) {
        database[userId].level = newLevel;
        message.channel.send(`✨ **SYNC UP:** <@${userId}> reached **Level ${newLevel}**!`)
            .then(m => setTimeout(() => m.delete().catch(() => null), 5000));
    }

    saveDatabase();

    // 2. LYDIA AI PROTOCOL
    if (client.lydiaChannels && client.lydiaChannels[message.channel.id]) {
        const isMentioned = message.mentions.has(client.user);

        let isReply = false;
        if (message.reference) {
            const referenced = await message.channel.messages
                .fetch(message.reference.messageId)
                .catch(() => null);
            isReply = referenced?.author?.id === client.user.id;
        }

        if (isMentioned || isReply) {
            
            // Rate limit (3 seconds between calls)
            const now = Date.now();
            const lastCall = client.lastLydiaCall[userId] || 0;
            
            if (now - lastCall < 3000) {
                return message.reply("⏳ **Easy there!** Give me 3 seconds between questions.");
            }
            
            client.lastLydiaCall[userId] = now;

            const userInput = message.content
                .replace(/<@!?[0-9]+>/g, '')
                .trim() || 'Hello!';

            const success = await handleLydiaRequest(message, userInput);
            
            if (!success) {
                await message.reply({
                    content: "😅 **Hey there!** I'm having a small technical hiccup right now.\n\n" +
                            "While I recover, here's what I CAN tell you:\n" +
                            "• **CODM Loadouts?** Ask me about any gun's best attachments!\n" +
                            "• **Gaming Tips?** I know strategies for most games!\n" +
                            "• **General Chat?** I'm always here to talk!\n\n" +
                            "*Try asking again in a few seconds!* 🎮"
                }).catch(() => null);
            }

            return;
        }
    }

    // 3. COMMAND INTERFACE
    if (!message.content.startsWith(PREFIX)) return;

    const args    = message.content.slice(PREFIX.length).trim().split(/ +/);
    const cmdName = args.shift().toLowerCase();
    const command = client.commands.get(cmdName) || client.commands.get(client.aliases.get(cmdName));

    if (command) {
        try {
            await command.run(client, message, args, database);
        } catch (error) {
            console.error(error);
            message.reply("⚠️ **Command execution failed.**");
        }
    }
});

// ================= WELCOME PROTOCOL: NEW MEMBER =================
client.on(Events.GuildMemberAdd, async (member) => {
    const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
    if (!welcomeChannelId) return;

    const channel = member.guild.channels.cache.get(welcomeChannelId);
    if (!channel) return;

    const memberCount    = member.guild.memberCount;
    const accountCreated = `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`;
    const avatarURL      = member.user.displayAvatarURL({ dynamic: true, size: 256 });

    const welcomeEmbed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setAuthor({ name: `${member.user.username} just landed.`, iconURL: avatarURL })
        .setTitle('😎 NEW MEMBER JOINED 😊')
        .setDescription(
            `Welcome to **${member.guild.name}**, <@${member.id}>.\n` +
            `You are operative **#${memberCount}**. Stand by for synchronization.\n\n` +
            `🎮 **Tip:** Mention @Lydia for gaming help, loadouts, or just to chat!`
        )
        .setThumbnail(avatarURL)
        .addFields(
            { name: '🪪 Username', value: `\`${member.user.username}\``, inline: true },
            { name: '🆔 User ID', value: `\`${member.id}\``, inline: true },
            { name: '📅 Account Age', value: accountCreated, inline: false },
            { name: '👥 Member Count', value: `\`${memberCount}\` members`, inline: true },
            { name: '🌐 Server', value: `\`${member.guild.name}\``, inline: true }
        )
        .setFooter({
            text: `CLOUD_GAMING-223 • BAMALIBA🇲🇱 | Lydia knows CODM loadouts!`,
            iconURL: member.guild.iconURL({ dynamic: true })
        })
        .setTimestamp();

    channel.send({ embeds: [welcomeEmbed] });
});

client.login(process.env.TOKEN);