require('dotenv').config(); 
// ================= BOOT SEQUENCE LOGS =================
console.log("---------------------------------------");
console.log("🚀 DIGITAL ENGINE: INITIALIZING...");
console.log("📍 LOCATION: BAMAKO NODE 🇲🇱");
console.log("---------------------------------------");

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Client, Collection, ActivityType, Events, Partials, EmbedBuilder, GatewayIntentBits } = require('discord.js');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

// ================= CLIENT & INTENTS =================
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

client.commands = new Collection();
client.aliases = new Collection();
client.version = "1.0.0"; 
const PREFIX = process.env.PREFIX || ",";

// ================= COOLDOWN SYSTEM =================
const xpCooldowns = new Map(); 

// ================= PATHS & DB =================
const dbPath = path.join(__dirname, 'database.json');
const lydiaPath = path.join(__dirname, 'lydia_status.json');

if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({}, null, 4));
if (!fs.existsSync(lydiaPath)) fs.writeFileSync(lydiaPath, JSON.stringify({}, null, 4));

let database = JSON.parse(fs.readFileSync(dbPath, "utf8"));
let lydiaChannels = JSON.parse(fs.readFileSync(lydiaPath, "utf8"));

console.log("📂 DATABASE: Synchronized.");

setInterval(() => {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(database, null, 4));
        fs.writeFileSync(lydiaPath, JSON.stringify(lydiaChannels, null, 4));
    } catch (err) { console.log("⚠️ Save Error:", err.message); }
}, 30000);

// ================= GEMINI AI SETUP =================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: "You are Lydia, the CLOUD_GAMING-223 Digital Engine. You are helpful, tech-savvy, and rooted in Mali 🇲🇱. Keep responses concise and avoid mentioning you are an AI.",
    safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
    ]
});

// ================= PLUGIN LOADER =================
client.loadPlugins = function() {
    client.commands.clear();
    client.aliases.clear();
    const pluginsFolder = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginsFolder)) fs.mkdirSync(pluginsFolder);
    const files = fs.readdirSync(pluginsFolder).filter(f => f.endsWith(".js"));
    
    for (const file of files) {
        try {
            const filePath = path.resolve(__dirname, 'plugins', file);
            delete require.cache[require.resolve(filePath)]; 
            const plugin = require(filePath);
            
            if (plugin.name) {
                client.commands.set(plugin.name, plugin);
                if (plugin.aliases && Array.isArray(plugin.aliases)) {
                    plugin.aliases.forEach(alias => client.aliases.set(alias, plugin.name));
                }
            }
        } catch (err) { console.log(`❌ PLUGIN ERROR (${file}):`, err.message); }
    }
    console.log(`🚀 ${client.commands.size} Plugins Loaded | v${client.version}`);
};

client.loadPlugins();

// ================= EVENTS =================

client.once(Events.ClientReady, async () => {
    console.log(`✅ ${client.user.username} is connected successfully`);
    
    try {
        const res = await axios.get("https://raw.githubusercontent.com/MFOF7310/cloud-gaming-223-digital-engine/main/version.txt");
        const latestVersion = res.data.toString().trim();

        if (latestVersion !== client.version) {
            console.log(`✨ UPDATE | A new version (${latestVersion}) is available!`);
        } else {
            console.log(`⭐ SYSTEM | Your software is up to date (v${client.version}).`);
        }
    } catch (e) {
        console.log(`❌ SYSTEM | Could not connect to update server.`);
    }

    const statuses = ["🎮 CODM Assistant", "🤖 CLOUD_GAMING AI"];
    let i = 0;
    setInterval(() => {
        client.user.setPresence({ 
            activities: [{ name: statuses[i], type: ActivityType.Custom }], 
            status: "online" 
        });
        i = (i + 1) % statuses.length;
    }, 10000);
});

client.on(Events.GuildMemberAdd, async member => {
    const channel = member.guild.systemChannel || member.guild.channels.cache.find(ch => ch.name.includes('welcome'));
    if (!channel) return;

    database[member.id] = { 
        xp: 100, 
        level: 1, 
        name: member.user.username, 
        gaming: { game: "N/A", rank: "Unranked", stats: "N/A" } 
    };

    const welcomeEmbed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('🛰️ NEW AGENT ARRIVED')
        .setThumbnail(member.user.displayAvatarURL())
        .setDescription(`Bienvenue, ${member}!\n\n🎁 **Bonus:** +100 XP added.\n🇲🇱 **Node:** Bamako-223`)
        .setFooter({ text: 'Cloud Gaming-223 Security' });

    channel.send({ embeds: [welcomeEmbed] });
});

client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;

    const uid = message.author.id;
    const now = Date.now();
    const COOLDOWN_TIME = 60000; 

    if (!database[uid]) {
        database[uid] = { 
            xp: 0, 
            level: 1, 
            name: message.author.username, 
            gaming: { game: "N/A", rank: "Unranked", stats: "N/A" } 
        };
    }

    // --- 1. XP LOGIC ---
    const userCooldown = xpCooldowns.get(uid);
    if (!userCooldown || (now - userCooldown) > COOLDOWN_TIME) {
        const randomXP = Math.floor(Math.random() * (45 - 25 + 1)) + 25;
        database[uid].xp += randomXP;
        database[uid].name = message.author.username; 

        xpCooldowns.set(uid, now);

        let nextLevel = Math.floor(database[uid].xp / 1000) + 1;
        if (nextLevel > database[uid].level) {
            database[uid].level = nextLevel;
            message.reply(`🆙 **LEVEL UP!** <@${uid}>, you reached **Level ${nextLevel}**!`);
        }
    }

    // --- 2. COMMAND HANDLING ---
    if (message.content.startsWith(PREFIX)) {
        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const cmdName = args.shift().toLowerCase();
        const command = client.commands.get(cmdName) || client.commands.get(client.aliases.get(cmdName));

        if (command) {
            try { 
                await command.execute(message, args, client, model, lydiaChannels, database); 
            } catch (err) { console.error("Command Error:", err); }
            return;
        }
    }

    // --- 3. LYDIA AI LOGIC ---
    if (lydiaChannels[message.channel.id]) {
        const isMentioned = message.mentions.has(client.user);
        
        // Safety check for reply (ensure reference exists before fetching)
        let isReply = false;
        if (message.reference) {
            try {
                const referencedMsg = await message.channel.messages.fetch(message.reference.messageId);
                if (referencedMsg.author.id === client.user.id) isReply = true;
            } catch (e) { isReply = false; }
        }

        if (isMentioned || isReply) {
            try {
                await message.channel.sendTyping();
                
                // Clean the input text
                const cleanInput = message.content.replace(/<@!?[0-9]+>/g, "").trim();
                const finalPrompt = cleanInput || "Hello Lydia, I am checking in.";

                // ✨ FIXED FOR GEMINI 2.0: Using correct object structure
                const result = await model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: `${message.author.username}: ${finalPrompt}` }] }]
                });

                const responseText = result.response.text();

                if (responseText && responseText.length > 0) {
                    if (responseText.length > 2000) {
                        const chunks = responseText.match(/[\s\S]{1,2000}/g);
                        for (const chunk of chunks) await message.reply(chunk);
                    } else {
                        await message.reply(responseText);
                    }
                }
            } catch (err) { 
                console.log("❌ AI Error Details:", err);
                message.reply("⚠️ **SYSTEM ERROR:** Liaison avec le cerveau IA interrompue.");
            }
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
