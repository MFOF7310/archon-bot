require('dotenv').config(); 

// ================= BOOT SEQUENCE LOGS =================
console.log("---------------------------------------");
console.log("🚀 SYSTEM: ARCHITECT CG-223");
console.log("📍 NODE: BAMAKO-223 🇲🇱");
console.log("📡 STATUS: CORE ENGINE v2.1.0");
console.log("---------------------------------------");

const fs = require('fs');
const path = require('path');
const axios = require('axios'); // Required for Vision/Image analysis
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
client.version = "2.1.0";
client.prefix = process.env.PREFIX || ","; 

// ================= PATHS & DB =================
const dbPath = path.join(__dirname, 'database.json');
const lydiaPath = path.join(__dirname, 'lydia_status.json');

if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({}, null, 4));
if (!fs.existsSync(lydiaPath)) fs.writeFileSync(lydiaPath, JSON.stringify({}, null, 4));

let database = JSON.parse(fs.readFileSync(dbPath, "utf8"));
let lydiaChannels = JSON.parse(fs.readFileSync(lydiaPath, "utf8"));

// Save DB every 30 seconds
setInterval(() => {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(database, null, 4));
        fs.writeFileSync(lydiaPath, JSON.stringify(lydiaChannels, null, 4));
    } catch (err) { console.log("⚠️ DB Sync Error:", err.message); }
}, 30000);

// ================= GEMINI AI SETUP =================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
client.model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: "You are Architect CG-223, the elite AI of Eagle Community. You are tech-savvy, helpful, and based in Bamako, Mali. Use italics (*text*) and tech emojis (🛰️, 🦅). Keep responses concise and avoid stating you are an AI. Respond in the language the user uses (French or English).",
});

// ================= PLUGIN LOADER =================
client.loadPlugins = function() {
    client.commands.clear();
    client.aliases.clear();
    const pluginsPath = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginsPath)) fs.mkdirSync(pluginsPath);
    const files = fs.readdirSync(pluginsPath).filter(f => f.endsWith(".js"));
    
    for (const file of files) {
        try {
            const filePath = path.resolve(pluginsPath, file);
            delete require.cache[require.resolve(filePath)]; 
            const plugin = require(filePath);
            if (plugin.name) {
                client.commands.set(plugin.name, plugin);
                if (plugin.aliases) plugin.aliases.forEach(a => client.aliases.set(a, plugin.name));
            }
        } catch (err) { console.log(`❌ ERROR (${file}):`, err.message); }
    }
    console.log(`🚀 Modules: ${client.commands.size} Synchronized.`);
};

client.loadPlugins();

// ================= EVENTS =================
client.once(Events.ClientReady, async () => {
    console.log(`✅ Uplink Established: ${client.user.username}`);
    
    client.user.setPresence({ 
        activities: [{ name: `v${client.version} | ${client.prefix}help`, type: ActivityType.Custom }], 
        status: "online" 
    });
});

client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;

    const uid = message.author.id;
    const currentPrefix = client.prefix;

    // Database check
    if (!database[uid]) {
        database[uid] = { 
            xp: 0, level: 1, name: message.author.username, 
            gaming: { game: "N/A", rank: "Unranked", stats: "N/A" } 
        };
    }

    // --- COMMAND HANDLING ---
    if (message.content.startsWith(currentPrefix)) {
        const args = message.content.slice(currentPrefix.length).trim().split(/ +/);
        const cmdName = args.shift().toLowerCase();
        const command = client.commands.get(cmdName) || client.commands.get(client.aliases.get(cmdName));

        if (command) {
            try {
                await command.run(client, message, args, database);
            } catch (error) {
                console.error(`❌ Execution Error [${cmdName}]:`, error);
                message.reply("⚠️ *Architectural Error: Command protocol failed.*");
            }
            return; 
        }
    }

    // --- GEMINI AI (LYDIA) SECTOR ---
    if (lydiaChannels[message.channel.id] && !message.content.startsWith(currentPrefix)) {
        try {
            await message.channel.sendTyping();

            // Correct Gemini Structure
            const result = await client.model.generateContent({
                contents: [{ role: 'user', parts: [{ text: message.content }] }]
            });

            const response = await result.response;
            message.reply(response.text());
        } catch (err) { 
            console.error("AI Error:", err.message);
        }
    }
});

client.login(process.env.TOKEN);
