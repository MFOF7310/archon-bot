require('dotenv').config(); 
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Client, Collection, ActivityType, Events, Partials, GatewayIntentBits } = require('discord.js');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

// ================= BOOT LOGS =================
console.log("---------------------------------------");
console.log("🚀 SYSTEM: ARCHITECT CG-223");
console.log("📍 LOCATION: BAMAKO NODE 🇲🇱");
console.log("📡 STATUS: CORE ENGINE v2.2.2");
console.log("---------------------------------------");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

client.commands = new Collection();
client.aliases = new Collection();
client.version = "2.2.2";
client.prefix = process.env.PREFIX || ","; 

// ================= DATABASE LOGIC =================
const dbPath = path.join(__dirname, 'database.json');
const lydiaPath = path.join(__dirname, 'lydia_status.json');

if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({}, null, 4));
if (!fs.existsSync(lydiaPath)) fs.writeFileSync(lydiaPath, JSON.stringify({}, null, 4));

let database = JSON.parse(fs.readFileSync(dbPath, "utf8"));
let lydiaChannels = JSON.parse(fs.readFileSync(lydiaPath, "utf8"));

// Auto-save every 30s
setInterval(() => {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(database, null, 4));
        fs.writeFileSync(lydiaPath, JSON.stringify(lydiaChannels, null, 4));
    } catch (err) { console.log("⚠️ DB Sync Error:", err.message); }
}, 30000);

// ================= GEMINI AI CONFIG =================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

client.model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash", 
    systemInstruction: "Tu es l'Architecte CG-223, l'IA d'élite de Eagle Community à Bamako. Réponds en français de manière tech-savvy et élégante. Utilise l'italique et des emojis (🦅, 🛰️). Ne mentionne jamais que tu es une IA.",
    safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ],
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
client.once(Events.ClientReady, () => {
    console.log(`✅ Uplink Established: ${client.user.username}`);
    client.user.setPresence({ 
        activities: [{ name: `v${client.version} | ${client.prefix}help`, type: ActivityType.Custom }], 
        status: "online" 
    });
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    // --- 1. COMMAND SYSTEM ---
    if (message.content.startsWith(client.prefix)) {
        const args = message.content.slice(client.prefix.length).trim().split(/ +/);
        const cmdName = args.shift().toLowerCase();
        const command = client.commands.get(cmdName) || client.commands.get(client.aliases.get(cmdName));

        if (command) {
            try {
                // PASSING 5 ARGUMENTS for the new lydia.js plugin
                await command.run(client, message, args, database, lydiaChannels);
            } catch (err) { console.error(`❌ Cmd Error:`, err); }
            return;
        }
    }

    // --- 2. LYDIA AI SECTOR (Auto-Chat) ---
    if (lydiaChannels[message.channel.id] && !message.content.startsWith(client.prefix)) {
        try {
            await message.channel.sendTyping();

            const result = await client.model.generateContent({
                contents: [{ role: 'user', parts: [{ text: message.content }] }]
            });

            const response = await result.response;
            const text = response.text();

            if (text) {
                await message.reply(text);
            }
        } catch (err) { 
            console.error("❌ Gemini Error:", err.message);
            // Error handling for 404/Safety issues
            if (err.message.includes("404")) {
                console.log("🛠️ FIX: If 404 persists, update your API Key or check regional restrictions.");
            }
        }
    }
});

client.login(process.env.TOKEN);
