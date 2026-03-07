require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, ActivityType, Events, Partials, EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

// --- 1. SYSTEM CONFIG ---
const client = new Client({ 
    intents: [1, 512, 32768, 2, 4096, 16384],
    partials: [Partials.Channel, Partials.Message, Partials.User] 
});

client.commands = new Collection();
const lydiaHistory = new Map();
const PREFIX = process.env.PREFIX || ',';
const ARCHITECT_ID = process.env.OWNER_ID; 
const dbPath = path.join(__dirname, 'database.json');
const lydiaPath = path.join(__dirname, 'lydia_status.json');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash",
    safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ],
});

// --- 2. PLUGIN LOADER (RE-SYNCED) ---
const loadPlugins = () => {
    client.commands.clear(); // Clear existing to prevent duplicates
    const pluginsPath = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginsPath)) fs.mkdirSync(pluginsPath);
    const files = fs.readdirSync(pluginsPath).filter(f => f.endsWith('.js'));
    files.forEach(file => {
        try {
            delete require.cache[require.resolve(`./plugins/${file}`)]; // Force refresh file
            const command = require(`./plugins/${file}`);
            if (command.name) client.commands.set(command.name, command);
        } catch (e) { console.error(`⚠️ PLUGIN ERROR [${file}]: ${e.message}`); }
    });
    console.log(`🚀 ENGINE: ${client.commands.size} Plugins Synchronized.`);
};
loadPlugins();

// --- 3. READY EVENT ---
client.once(Events.ClientReady, async () => {
    console.log(`✅ SUCCESS: ${client.user.tag} Online.`);
    const statusMessages = ["🛰️ Monitoring CLOUD_GAMING-223", "🛠️ Engine V2.7.0", "🟢 System: Stable"];
    let index = 0;
    setInterval(() => {
        client.user.setPresence({
            activities: [{ name: statusMessages[index], type: ActivityType.Custom }],
            status: 'online', 
        });
        index = (index + 1) % statusMessages.length;
    }, 10000);
});

// --- 4. MESSAGE HANDLER ---
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    // A. XP SYSTEM
    let database = {};
    if (fs.existsSync(dbPath)) {
        try { database = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) { database = {}; }
    }
    const uid = message.author.id;
    if (!database[uid]) database[uid] = { xp: 0, level: 1, name: message.author.username };
    database[uid].xp += 20;
    fs.writeFileSync(dbPath, JSON.stringify(database, null, 4));

    // B. COMMAND SYSTEM (Priority #1)
    if (message.content.startsWith(PREFIX)) {
        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        const command = client.commands.get(commandName);

        if (command) {
            try { 
                await command.execute(message, args, client, model); 
                return; // Stop here if a command was executed
            } catch (e) { 
                console.error(`❌ CMD FAIL [${commandName}]:`, e);
                return message.reply("⚠️ System error executing that command.");
            }
        }
    }

    // C. LYDIA AUTO-AI LOGIC (Priority #2 - Only if no command was typed)
    let lydiaChannels = {};
    if (fs.existsSync(lydiaPath)) {
        try { lydiaChannels = JSON.parse(fs.readFileSync(lydiaPath, 'utf8')); } catch(e) {}
    }

    if (lydiaChannels[message.channel.id] && message.reference) {
        try {
            const refMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
            if (refMsg && refMsg.author.id === client.user.id) {
                await message.channel.sendTyping();

                const userName = message.member?.displayName || message.author.username;
                let userHistory = lydiaHistory.get(uid) || [];
                const historySnapshot = userHistory.map(h => `User: ${h.q}\nLydia: ${h.a}`).join("\n");

                const prompt = `Identity: You are Lydia for CLOUD_GAMING-223.\nTalk to: ${userName}\nHistory:\n${historySnapshot}\nContext: "${refMsg.content}"\nUser Reply: "${message.content}"\nLydia:`;
                
                const result = await model.generateContent(prompt);
                const aiResponse = result.response.text();

                if (aiResponse) {
                    userHistory.push({ q: message.content, a: aiResponse });
                    if (userHistory.length > 3) userHistory.shift();
                    lydiaHistory.set(uid, userHistory);
                    return message.reply(aiResponse);
                }
            }
        } catch (err) { console.error("❌ Lydia Logic Error:", err.message); }
    }
});

client.login(process.env.DISCORD_TOKEN);
