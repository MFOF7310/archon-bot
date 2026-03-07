require('dotenv').config(); // Fixed: lowercase 'require'
const fs = require('fs');
const path = require('path');
const { Client, Collection, ActivityType, Events, Partials } = require('discord.js');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

// ================= CLIENT =================
const client = new Client({
    intents: [1, 512, 32768, 2, 4096, 16384],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

client.commands = new Collection();
const PREFIX = process.env.PREFIX || ",";

// ================= PATHS & DB =================
const dbPath = path.join(__dirname, 'database.json');
const lydiaPath = path.join(__dirname, 'lydia_status.json');

let database = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, "utf8")) : {};
let lydiaChannels = fs.existsSync(lydiaPath) ? JSON.parse(fs.readFileSync(lydiaPath, "utf8")) : {};

// Persistent Auto-Save (Every 30 seconds)
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

// ================= PLUGIN LOADER =================
function loadPlugins() {
    client.commands.clear();
    const pluginsFolder = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginsFolder)) fs.mkdirSync(pluginsFolder);
    const files = fs.readdirSync(pluginsFolder).filter(f => f.endsWith(".js"));
    for (const file of files) {
        try {
            delete require.cache[require.resolve(`./plugins/${file}`)];
            const plugin = require(`./plugins/${file}`);
            if (plugin.name) client.commands.set(plugin.name, plugin);
        } catch (err) { console.log(`❌ PLUGIN ERROR (${file}):`, err.message); }
    }
    console.log(`🚀 ${client.commands.size} plugins loaded`);
}
loadPlugins();

// ================= EVENTS =================
client.once(Events.ClientReady, () => {
    console.log(`✅ ${client.user.tag} is poppin' and online`);
    const statuses = ["🎮 CODM Assistant", "🧠 CLOUD_GAMING AI", "⚙️ Engine Stable"];
    let i = 0;
    setInterval(() => {
        client.user.setPresence({ activities: [{ name: statuses[i], type: ActivityType.Custom }], status: "online" });
        i = (i + 1) % statuses.length;
    }, 10000);
});

client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;

    // XP System
    const uid = message.author.id;
    if (!database[uid]) database[uid] = { xp: 0, level: 1, name: message.author.username };
    database[uid].xp += 20;

    // Command System
    if (message.content.startsWith(PREFIX)) {
        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const cmdName = args.shift().toLowerCase();
        const command = client.commands.get(cmdName);
        if (command) {
            try { 
                // Passing lydiaChannels to all commands so they can access the shared state
                await command.execute(message, args, client, model, lydiaChannels); 
            } catch (err) { 
                console.error(err); 
                message.reply("⚠️ Command error."); 
            }
            return;
        }
    }

    // AI Response Logic
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

        const prompt = `You are CLOUD_GAMING, an AI for the CLOUD_GAMING-223 server created by Moussa Fofana. 
        Be professional, friendly, and gaming-oriented. Always address ${username}.
        History: ${historyText}\nUser: ${message.content}\nLydia:`;

        const result = await model.generateContent(prompt);
        const response = await result.response; // Fixed: Added safety await
        const reply = response.text();
        
        if (!reply) return; // Exit if empty

        history.push({ q: message.content, a: reply });
        if (history.length > 8) history.shift();
        lydiaMemory.set(uid, history);

        message.reply(reply);
    } catch (err) { 
        console.log("❌ AI ERROR:", err.message); 
        // No reply here to avoid spamming the chat if the quota is hit
    }
});

client.login(process.env.DISCORD_TOKEN);
