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
client.lydiaChannels = {};   // ← LYDIA STATE LIVES HERE NOW

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

// --- GEMINI AI CONFIGURATION ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
client.model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// --- GROQ AI CONFIGURATION ---
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const LYDIA_SYSTEM_PROMPT = `
You are Lydia, the official AI assistant of the Cloud Gaming-223 Discord server (also known as ARCHITECT CG-223).
You are polite, smart, friendly, and direct. You never insult users. You keep answers concise but informative.

You are an expert in:
- Call of Duty Mobile (CODM): weapons, attachments, gunsmith builds, ranked modes (Hardpoint, Search & Destroy, Control), Battle Royale, operators, seasonal updates, meta loadouts, ranked push tips, scorestreaks
- General gaming: PC, console, and mobile games (Valorant, Fortnite, FIFA, Free Fire, PUBG Mobile, etc.)
- Real-life general knowledge: science, technology, history, current events, sports
- Coding and technology: JavaScript, Python, Discord bots, general programming help

IMPORTANT: You have REAL-TIME web search capabilities! When users ask about:
- Current events, news, weather
- Latest updates, releases, scores
- Recent information after your knowledge cutoff
You will automatically search the web to provide accurate, up-to-date answers.

Rules:
- Always respond in the same language the user writes in
- Never pretend to be a human — you are Lydia, an AI
- If unsure, say so honestly rather than making things up
- Use gaming slang naturally (e.g. "W gun", "meta", "ranked grind") when talking games
- Keep responses under 400 words unless a detailed answer is truly needed
- When you use web search, include brief citations/sources
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
            .setDescription(`System reboot complete. **${client.commands.size}** modules synced.\nLydia AI now has **REAL-TIME web search**! 🔍`)
            .setTimestamp();
        await owner.send({ embeds: [alertEmbed] });
    } catch (err) {
        console.log(`${yellow}[NOTICE]${reset} DM Failed.`);
    }
});

// ================= THE ENGINE: MESSAGE PROCESSING =================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;

    // 1. XP REWARD PROTOCOL (Random 20-40 XP)
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

    // 2. LYDIA AI PROTOCOL - WITH REAL-TIME WEB SEARCH!
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
            try {
                await message.channel.sendTyping();

                // Strip the bot mention from the message cleanly
                const userInput = message.content
                    .replace(/<@!?[0-9]+>/g, '')
                    .trim() || 'Hello!';

                // USING GROQ COMPOUND MODEL WITH BUILT-IN WEB SEARCH!
                const completion = await groq.chat.completions.create({
                    model: 'groq/compound',  // ← THIS ENABLES REAL-TIME WEB SEARCH!
                    messages: [
                        { role: 'system',  content: LYDIA_SYSTEM_PROMPT },
                        { role: 'user',    content: userInput }
                    ],
                    max_tokens: 600,
                    temperature: 0.7,
                });

                const reply = completion.choices[0].message.content;
                await message.reply(reply);

            } catch (err) {
                console.error(`${yellow}[LYDIA ERROR]${reset}`, err.message);
                await message.reply("⚠️ **Neural link interrupted.** Try again in a moment.");
            }

            return; // Don't process commands if Lydia handled this
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
            message.reply("⚠️ **Neural link interrupted.**");
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
            `You are operative **#${memberCount}**. Stand by for synchronization.`
        )
        .setThumbnail(avatarURL)
        .addFields(
            { name: '🪪 Username',     value: `\`${member.user.username}\``, inline: true  },
            { name: '🆔 User ID',      value: `\`${member.id}\``,            inline: true  },
            { name: '📅 Account Age',  value: accountCreated,                 inline: false },
            { name: '👥 Member Count', value: `\`${memberCount}\` members`,  inline: true  },
            { name: '🌐 Server',       value: `\`${member.guild.name}\``,    inline: true  }
        )
        .setFooter({
            text: `CLOUD_GAMING-223 • BAMALIBA🇲🇱 | Lydia AI has REAL-TIME web search! 🔍`,
            iconURL: member.guild.iconURL({ dynamic: true })
        })
        .setTimestamp();

    channel.send({ embeds: [welcomeEmbed] });
});

client.login(process.env.TOKEN);