require('dotenv').config(); 
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Client, Collection, ActivityType, Events, Partials, EmbedBuilder, GatewayIntentBits } = require('discord.js');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

// ================= LOG DE BOOT =================
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
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

client.commands = new Collection();
client.aliases = new Collection();
client.version = "2.2.2";
client.prefix = process.env.PREFIX || ","; 

// ================= PATHS & DB =================
const dbPath = path.join(__dirname, 'database.json');
const lydiaPath = path.join(__dirname, 'lydia_status.json');

if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({}, null, 4));
if (!fs.existsSync(lydiaPath)) fs.writeFileSync(lydiaPath, JSON.stringify({}, null, 4));

let database = JSON.parse(fs.readFileSync(dbPath, "utf8"));
let lydiaChannels = JSON.parse(fs.readFileSync(lydiaPath, "utf8"));

// Sauvegarde auto
setInterval(() => {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(database, null, 4));
        fs.writeFileSync(lydiaPath, JSON.stringify(lydiaChannels, null, 4));
    } catch (err) { console.log("⚠️ DB Sync Error:", err.message); }
}, 30000);

// ================= GEMINI AI SETUP =================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// FIXED: Using "models/gemini-1.5-flash" to resolve the 404 error
client.model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash", 
    systemInstruction: "Tu es l'Architecte CG-223, l'IA d'élite de Eagle Community. Tu es basé à Bamako, Mali. Réponds en français de manière élégante et concise. Utilise l'italique et des emojis (🦅, 🛰️).",
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
    console.log(`🚀 Modules: ${client.commands.size} Synchronisés.`);
};

client.loadPlugins();

// ================= EVENTS =================
client.once(Events.ClientReady, async () => {
    console.log(`✅ Uplink Établi : ${client.user.username}`);
    client.user.setPresence({ 
        activities: [{ name: `v${client.version} | ${client.prefix}help`, type: ActivityType.Custom }], 
        status: "online" 
    });
});

client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;

    const currentPrefix = client.prefix;

    // Command Handling
    if (message.content.startsWith(currentPrefix)) {
        const args = message.content.slice(currentPrefix.length).trim().split(/ +/);
        const cmdName = args.shift().toLowerCase();
        const command = client.commands.get(cmdName) || client.commands.get(client.aliases.get(cmdName));

        if (command) {
            try {
                await command.run(client, message, args, database, lydiaChannels);
            } catch (error) {
                console.error(`❌ Execution Error [${cmdName}]:`, error);
            }
            return; 
        }
    }

    // --- LYDIA AI SECTOR ---
    if (lydiaChannels[message.channel.id]) {
        try {
            // Typing effect starts
            await message.channel.sendTyping();

            // Structure fix for some versions of the SDK
            const result = await client.model.generateContent(message.content);
            const response = await result.response;
            const text = response.text();

            if (text && text.length > 0) {
                await message.reply(text);
            }
        } catch (err) { 
            console.error("❌ Gemini API Error:", err.message);
            // Let the user know there was an error instead of infinite typing
            if (err.message.includes("404")) {
                console.log("🔧 TECHNICAL: The API model name might need 'models/' prefix or is restricted.");
            }
        }
    }
});

client.login(process.env.TOKEN);
