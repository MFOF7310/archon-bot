require('dotenv').config(); 
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Client, Collection, ActivityType, Events, Partials, EmbedBuilder, GatewayIntentBits } = require('discord.js');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

console.log("---------------------------------------");
console.log("🚀 SYSTEM: ARCHITECT CG-223");
console.log("📡 STATUS: CORE ENGINE v2.2.0");
console.log("---------------------------------------");

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

client.commands = new Collection();
client.aliases = new Collection();
client.version = "2.2.0";
client.prefix = process.env.PREFIX || ",";

// ================= PATHS & DB =================
const dbPath = path.join(__dirname, 'database.json');
const lydiaPath = path.join(__dirname, 'lydia_status.json');

if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({}, null, 4));
if (!fs.existsSync(lydiaPath)) fs.writeFileSync(lydiaPath, JSON.stringify({}, null, 4));

let database = JSON.parse(fs.readFileSync(dbPath, "utf8"));
let lydiaChannels = JSON.parse(fs.readFileSync(lydiaPath, "utf8"));

// Sauvegarde Automatique
setInterval(() => {
    fs.writeFileSync(dbPath, JSON.stringify(database, null, 4));
    fs.writeFileSync(lydiaPath, JSON.stringify(lydiaChannels, null, 4));
}, 30000);

// ================= GEMINI SETUP =================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
client.model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: "Tu es l'Architecte CG-223, l'IA d'élite de Eagle Community à Bamako. Réponds en français de manière élégante et technologique. Utilise l'italique et des emojis (🦅, 🛰️).",
});

// ================= LOADER =================
client.loadPlugins = function() {
    client.commands.clear();
    const files = fs.readdirSync(path.join(__dirname, 'plugins')).filter(f => f.endsWith(".js"));
    for (const file of files) {
        const plugin = require(`./plugins/${file}`);
        if (plugin.name) {
            client.commands.set(plugin.name, plugin);
            if (plugin.aliases) plugin.aliases.forEach(a => client.aliases.set(a, plugin.name));
        }
    }
    console.log(`🚀 ${client.commands.size} Modules Synchronisés.`);
};
client.loadPlugins();

// ================= EVENTS =================
client.once(Events.ClientReady, () => {
    console.log(`✅ Connecté : ${client.user.username}`);
    client.user.setPresence({ activities: [{ name: `v${client.version} | ${client.prefix}help` }], status: "online" });
});

client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;

    const prefix = client.prefix;

    // --- COMMANDES ---
    if (message.content.startsWith(prefix)) {
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const cmdName = args.shift().toLowerCase();
        const command = client.commands.get(cmdName) || client.commands.get(client.aliases.get(cmdName));

        if (command) {
            try {
                // ON PASSE 5 ARGUMENTS : client, message, args, database, lydiaChannels
                await command.run(client, message, args, database, lydiaChannels);
            } catch (err) {
                console.error(err);
                message.reply("⚠️ *Erreur fatale dans le protocole.*");
            }
            return;
        }
    }

    // --- LYDIA AI (Automatique) ---
    if (lydiaChannels[message.channel.id]) {
        try {
            await message.channel.sendTyping();
            const result = await client.model.generateContent({
                contents: [{ role: 'user', parts: [{ text: message.content }] }]
            });
            message.reply(result.response.text());
        } catch (err) { console.error("AI Error:", err.message); }
    }
});

client.login(process.env.TOKEN);
