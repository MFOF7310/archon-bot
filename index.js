require('dotenv').config(); 
// ================= BOOT SEQUENCE LOGS =================
console.log("---------------------------------------");
console.log("🚀 SYSTEM: ARCHITECT CG-223");
console.log("📍 NODE: BAMAKO-223 🇲🇱");
console.log("📡 STATUS: CORE ENGINE v2.0.0");
console.log("---------------------------------------");

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Client, Collection, ActivityType, Events, Partials, EmbedBuilder, GatewayIntentBits } = require('discord.js');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

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
client.version = "2.0.0";
const PREFIX = process.env.PREFIX || ",";

// ================= PATHS & DB =================
const dbPath = path.join(__dirname, 'database.json');
const lydiaPath = path.join(__dirname, 'lydia_status.json');

let database = JSON.parse(fs.readFileSync(dbPath, "utf8"));
let lydiaChannels = JSON.parse(fs.readFileSync(lydiaPath, "utf8"));

// ================= GEMINI AI SETUP =================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
client.model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: "You are the Architect CG-223, the digital brain of Eagle Community. You are analytical, elite, and based in Mali 🇲🇱. Use italics (*text*) for a premium feel and tech (🛰️) or eagle (🦅) emojis. Keep responses concise and avoid stating you are an AI.",
});

// ================= PLUGIN LOADER =================
client.loadPlugins = function() {
    client.commands.clear();
    client.aliases.clear();
    const files = fs.readdirSync(path.join(__dirname, 'plugins')).filter(f => f.endsWith(".js"));
    
    for (const file of files) {
        try {
            const filePath = path.resolve(__dirname, 'plugins', file);
            delete require.cache[require.resolve(filePath)]; 
            const plugin = require(filePath);
            if (plugin.name) {
                client.commands.set(plugin.name, plugin);
                if (plugin.aliases) plugin.aliases.forEach(a => client.aliases.set(a, plugin.name));
            }
        } catch (err) { console.log(`❌ ERROR (${file}):`, err.message); }
    }
    console.log(`🚀 Architect Engine: ${client.commands.size} Modules Loaded.`);
};

client.loadPlugins();

// ================= MESSAGE HANDLER =================
client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;

    // Command Handling
    if (message.content.startsWith(PREFIX)) {
        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const cmdName = args.shift().toLowerCase();
        const command = client.commands.get(cmdName) || client.commands.get(client.aliases.get(cmdName));

        if (command) {
            try {
                // PASSING THE CORE 4 PARAMETERS
                await command.run(client, message, args, database);
            } catch (error) {
                console.error(error);
                message.reply("⚠️ *Architectural Error: Command failed.*");
            }
        }
    }
});

client.login(process.env.TOKEN);
