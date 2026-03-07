require('dotenv').config(); 
const fs = require('fs');
const path = require('path');
const axios = require('axios'); // Ensure you run: npm install axios
const { Client, Collection, ActivityType, Events, Partials } = require('discord.js');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

// ================= CLIENT & VERSION =================
const client = new Client({
    intents: [1, 512, 32768, 2, 4096, 16384],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

client.commands = new Collection();
client.version = "1.0.0"; 
const PREFIX = process.env.PREFIX || ",";

// ================= PATHS & DB =================
const dbPath = path.join(__dirname, 'database.json');
const lydiaPath = path.join(__dirname, 'lydia_status.json');

let database = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, "utf8")) : {};
let lydiaChannels = fs.existsSync(lydiaPath) ? JSON.parse(fs.readFileSync(lydiaPath, "utf8")) : {};

// Persistent Auto-Save
setInterval(() => {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(database, null, 4));
        fs.writeFileSync(lydiaPath, JSON.stringify(lydiaChannels, null, 4));
    } catch (err) { console.log("💾 Save Error:", err.message); }
}, 30000);

// ================= MEMORY & GEMINI =================
const lydiaMemory = new Map();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
    ]
});

// ================= PLUGIN LOADER (GLOBAL) =================
client.loadPlugins = function() {
    client.commands.clear();
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
                if (plugin.aliases) {
                    plugin.aliases.forEach(alias => client.commands.set(alias, plugin));
                }
            }
        } catch (err) { console.log(`❌ PLUGIN ERROR (${file}):`, err.message); }
    }
    console.log(`🚀 ${client.commands.size} plugins loaded | Engine v${client.version}`);
};

client.loadPlugins();

// ================= EVENTS =================
client.once(Events.ClientReady, async () => {
    console.log(`✅ ${client.user.tag} is poppin' and online`);
    
    // Check Master Repo for Updates
    try {
        const res = await axios.get("https://raw.githubusercontent.com/MFOF7310/cloud-gaming-223-digital-engine/main/version.txt");
        const remoteVersion = res.data.toString().trim();
        if (remoteVersion !== client.version) {
            console.log(`\n📢 UPDATE AVAILABLE: v${remoteVersion} (Run ${PREFIX}update to sync)\n`);
        }
    } catch (e) {}

    const statuses = ["🎮 CODM Assistant", "🧠 CLOUD_GAMING AI", "⚙️ Engine Stable"];
    let i = 0;
    setInterval(() => {
        client.user.setPresence({ activities: [{ name: statuses[i], type: ActivityType.Custom }], status: "online" });
        i = (i + 1) % statuses.length;
    }, 10000);
});

client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;

    const uid = message.author.id;
    if (!database[uid]) {
        database[uid] = { xp: 0, level: 1, name: message.author.username, gaming: { game: "N/A", rank: "Unranked", stats: "N/A" } };
    }
    database[uid].xp += 20;

    let nextLevel = Math.floor(database[uid].xp / 1000) + 1;
    if (nextLevel > database[uid].level) {
        database[uid].level = nextLevel;
        message.reply(`🎊 **LEVEL UP!** Level ${nextLevel}, Agent ${message.author.username}.`);
    }

    if (message.content.startsWith(PREFIX)) {
        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const cmdName = args.shift().toLowerCase();
        const command = client.commands.get(cmdName);

        if (command) {
            try { 
                await command.execute(message, args, client, model, lydiaChannels, database); 
            } catch (err) { console.error(err); message.reply("⚠️ Command error."); }
            return;
        }
    }

    if (!lydiaChannels[message.channel.id]) return;
    const mentioned = message.mentions.has(client.user);
    let replyToBot = false;
    if (message.reference) {
        const ref = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
        if (ref?.author.id === client.user.id) replyToBot = true;
    }

    if (!mentioned && !replyToBot) return;

    try {
        await message.channel.sendTyping();
        const username = message.member?.displayName || message.author.username;
        let history = lydiaMemory.get(uid) || [];
        const historyText = history.map(h => `User: ${h.q}\nLydia: ${h.a}`).join("\n");
        const prompt = `You are CLOUD_GAMING, an AI for the CLOUD_GAMING-223 server by Moussa Fofana. 
        Be professional, friendly, and address ${username}.\nHistory: ${historyText}\nUser: ${message.content}\nLydia:`;

        const result = await model.generateContent(prompt);
        const response = await result.response; 
        const reply = response.text();
        if (!reply) return;

        history.push({ q: message.content, a: reply });
        if (history.length > 8) history.shift();
        lydiaMemory.set(uid, history);
        message.reply(reply);
    } catch (err) { console.log("❌ AI ERROR:", err.message); }
});

client.login(process.env.DISCORD_TOKEN);
