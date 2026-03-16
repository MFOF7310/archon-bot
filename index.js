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
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

// --- SYSTEM GLOBALS ---
client.commands  = new Collection();
client.aliases   = new Collection();
client.version   = "2.6.1";
client.lydiaChannels = {};
client.lastLydiaCall = {};

const PREFIX = process.env.PREFIX || ".";

// --- DATABASE ---
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
client.saveDatabase = saveDatabase;

// --- GROQ AI CONFIGURATION ---
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ================= SHORTENED SYSTEM PROMPT FOR LYDIA =================
const LYDIA_SYSTEM_PROMPT = `
You are CLOUD_GAMING-223, the AI assistant of the Cloud Gaming-223 Discord server (ARCHITECT CG-223). 
You're polite, smart, and direct. Keep answers concise but informative.

Owner's GitHub (provide only if asked): https://github.com/MFOF7310/cloud-gaming-223-digital-engine

EXPERTISE:
- CODM: weapons, loadouts, ranked, BR, meta, operators, updates
- General gaming: Valorant, Fortnite, FIFA, Free Fire, PUBG, etc.
- Real-life knowledge: science, tech, history, sports (up to early 2025)
- Coding: JavaScript, Python, Discord bots, general help

RULES:
1. If asked about future updates or current events you don't know, be honest, share patterns, and suggest official sources.
2. Use gaming slang naturally.
3. Respond in the same language as the user.
4. Never pretend to be human.
5. Stay under 400 words unless detail is truly needed.
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
            .setDescription(`System reboot complete. **${client.commands.size}** modules synced.\nLydia AI now has REAL-TIME web search via Brave! 🎮`)
            .setTimestamp();
        await owner.send({ embeds: [alertEmbed] });
    } catch (err) {
        console.log(`${yellow}[NOTICE]${reset} DM Failed.`);
    }
});

// ================= BRAVE SEARCH HELPER (with detailed logging) =================
async function braveSearch(query) {
    try {
        if (!process.env.BRAVE_API_KEY) {
            console.log(`${yellow}[BRAVE ERROR]${reset} No API key found in .env`);
            return null;
        }

        const url = 'https://api.search.brave.com/res/v1/web/search';
        const response = await axios.get(url, {
            headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip',
                'X-Subscription-Token': process.env.BRAVE_API_KEY
            },
            params: {
                q: query,
                count: 3,
                search_lang: 'en',
                safesearch: 'moderate'
            },
            timeout: 8000
        });

        const results = response.data.web?.results;
        if (!results || results.length === 0) {
            console.log(`${yellow}[BRAVE]${reset} No results for query: "${query}"`);
            return null;
        }

        return results.map(r => ({
            title: r.title,
            description: r.description,
            url: r.url
        }));
    } catch (error) {
        if (error.response) {
            console.log(`${yellow}[BRAVE ERROR]${reset} Status: ${error.response.status}`, error.response.data);
        } else if (error.request) {
            console.log(`${yellow}[BRAVE ERROR]${reset} No response from Brave API`);
        } else {
            console.log(`${yellow}[BRAVE ERROR]${reset}`, error.message);
        }
        return null;
    }
}

// ================= UTILITY: Split long messages =================
function splitMessage(text, maxLength = 2000) {
    if (text.length <= maxLength) return [text];
    
    const chunks = [];
    let current = '';
    const sentences = text.split(/(?<=[.!?])\s+/); // split by sentences

    for (const sentence of sentences) {
        if ((current + ' ' + sentence).length <= maxLength) {
            current += (current ? ' ' : '') + sentence;
        } else {
            if (current) chunks.push(current);
            current = sentence;
        }
    }
    if (current) chunks.push(current);
    
    // Fallback: if any chunk is still too long (e.g., no sentence breaks), split by characters
    return chunks.flatMap(chunk => {
        if (chunk.length <= maxLength) return chunk;
        const parts = [];
        for (let i = 0; i < chunk.length; i += maxLength) {
            parts.push(chunk.substring(i, i + maxLength));
        }
        return parts;
    });
}

// ================= ENHANCED LYDIA HANDLER =================
async function handleLydiaRequest(message, userInput) {
    try {
        await message.channel.sendTyping();

        // ---- STEP 1: Ask Groq if this question needs real-time info ----
        const classification = await groq.chat.completions.create({
            model: 'llama-3.1-8b-instant',
            messages: [
                { 
                    role: 'system', 
                    content: `You are a strict classifier. Answer ONLY with "yes" if the user's question ABSOLUTELY requires real‑time information (e.g., live scores, news, recent updates, weather, current events). Otherwise answer "no". Do not explain.` 
                },
                { role: 'user', content: userInput }
            ],
            max_tokens: 5,
            temperature: 0,
        });

        const needsRealTime = classification.choices[0].message.content.trim().toLowerCase() === 'yes';
        console.log(`${cyan}[LYDIA]${reset} AI classification: ${needsRealTime ? 'REAL-TIME' : 'GENERAL'}`);

        // Detect if it's CODM/gaming related
        const gamingKeywords = /codm|call of duty|cod mobile|loadout|gun|weapon|attachment|perk|scorestreak|ranked|battle royale|br|multiplayer|mp|meta|class setup|build|season|battle pass|operator|skill|gameplay|tips|tricks|strategy/i;
        const isGaming = gamingKeywords.test(userInput);

        let replyContent = '';

        // --- CASE 1: Real-time information needed ---
        if (needsRealTime) {
            console.log(`${cyan}[LYDIA]${reset} Searching Brave...`);
            const searchResults = await braveSearch(userInput);

            if (searchResults && searchResults.length > 0) {
                const context = searchResults.map((r, i) => 
                    `Source ${i+1}: ${r.title}\n${r.description}\nURL: ${r.url}`
                ).join('\n\n');

                const completion = await groq.chat.completions.create({
                    model: 'llama-3.3-70b-versatile',
                    messages: [
                        { 
                            role: 'system', 
                            content: `You are Lydia, AI assistant of Cloud Gaming-223. The user asked a question that requires up-to-date information. 
                            Below are search results from the web. Summarize them concisely and answer the user's question in the same language they used. 
                            If the results contain relevant info, provide a clear answer and mention sources (URLs) if possible. 
                            Be friendly and use gaming slang when appropriate.`
                        },
                        { role: 'user', content: `Question: ${userInput}\n\nSearch results:\n${context}` }
                    ],
                    max_tokens: 800,
                    temperature: 0.7,
                });
                replyContent = completion.choices[0].message.content;
            } else {
                // No search results: fallback to knowledge base
                console.log(`${yellow}[LYDIA]${reset} No search results, using knowledge base`);
                const completion = await groq.chat.completions.create({
                    model: 'llama-3.3-70b-versatile',
                    messages: [
                        { 
                            role: 'system', 
                            content: LYDIA_SYSTEM_PROMPT + "\n\nIMPORTANT: The user asked something that might need real-time data, but no fresh results were found. Be honest about this limitation, share general knowledge, suggest official sources, and offer to help with related topics you CAN discuss." 
                        },
                        { role: 'user', content: userInput }
                    ],
                    max_tokens: 700,
                    temperature: 0.7,
                });
                replyContent = completion.choices[0].message.content;
            }
        }
        // --- CASE 2: Gaming question (but not real-time) ---
        else if (isGaming) {
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
            replyContent = completion.choices[0].message.content;
        }
        // --- CASE 3: General conversation ---
        else {
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
            replyContent = completion.choices[0].message.content;
        }

        // Split long messages and send
        const chunks = splitMessage(replyContent);
        await message.reply(chunks[0]); // first chunk as reply
        for (let i = 1; i < chunks.length; i++) {
            await message.channel.send(chunks[i]);
        }
        return true;

    } catch (err) {
        console.error(`${yellow}[LYDIA ERROR]${reset}`, err.message);
        return false;
    }
}

// ================= MESSAGE PROCESSING =================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;

    // 1. XP SYSTEM
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
            // Rate limit (3 seconds)
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

// ================= WELCOME PROTOCOL =================
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
            text: `CLOUD_GAMING-223 • BAMALIBA🇲🇱 | Lydia now searches the web with Brave!`,
            iconURL: member.guild.iconURL({ dynamic: true })
        })
        .setTimestamp();

    channel.send({ embeds: [welcomeEmbed] });
});

client.login(process.env.TOKEN);