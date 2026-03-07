require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, ActivityType, Events, Partials, EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- 1. THE CONSOLE HEARTBEAT ---
console.log("-----------------------------------------");
console.log("🛰️  DIGITAL ENGINE: STARTING BOOT SEQUENCE");
console.log("-----------------------------------------");

const client = new Client({ 
    intents: [1, 512, 32768, 2, 4096, 16384],
    partials: [Partials.Channel, Partials.Message, Partials.User] 
});

client.commands = new Collection();
const PREFIX = process.env.PREFIX || ',';
const ARCHITECT_ID = process.env.OWNER_ID; 
const dbPath = path.join(__dirname, 'database.json');
const lydiaStatusPath = path.join(__dirname, 'lydia_status.json');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- 2. DYNAMIC PLUGIN LOADER ---
const loadPlugins = () => {
    const pluginsPath = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginsPath)) fs.mkdirSync(pluginsPath);

    const files = fs.readdirSync(pluginsPath).filter(f => f.endsWith('.js'));
    files.forEach(file => {
        try {
            const command = require(`./plugins/${file}`);
            if (command.name) client.commands.set(command.name, command);
        } catch (e) {
            console.error(`⚠️ PLUGIN ERROR [${file}]: ${e.message}`);
        }
    });
    console.log(`🚀 ENGINE: ${client.commands.size} Plugins Synchronized.`);
};

loadPlugins();

// --- 3. CONNECTION LOGIC ---
client.once(Events.ClientReady, async () => {
    console.log(`✅ SUCCESS: ${client.user.tag} is Online.`);
    
    const statusMessages = [
        "🛰️ Monitoring CLOUD_GAMING-223",
        "🛠️ Engine Version: 5.3.4",
        "📂 Type ,menu for Plugins",
        "🟢 System: Stable"
    ];
    let index = 0;
    setInterval(() => {
        client.user.setPresence({
            activities: [{ name: statusMessages[index], type: ActivityType.Custom }],
            status: 'online', 
        });
        index = (index + 1) % statusMessages.length;
    }, 10000);

    try {
        if (ARCHITECT_ID) {
            const architect = await client.users.fetch(ARCHITECT_ID);
            const bootEmbed = new EmbedBuilder()
                .setColor('#00ffcc')
                .setTitle('🛰️ SYSTEM ONLINE')
                .setDescription(`**Digital Engine V2.6** is operational.\n\n📊 **Active Plugins:** ${client.commands.size}`)
                .setTimestamp();
            await architect.send({ embeds: [bootEmbed] });
        }
    } catch (err) { console.log(`ℹ️ Note: Could not DM Architect.`); }
});

// --- 4. MESSAGE HANDLER (XP + LYDIA + COMMANDS) ---
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    // A. XP SYSTEM
    let database = {};
    if (fs.existsSync(dbPath)) {
        try { database = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) { database = {}; }
    }

    const uid = message.author.id;
    if (!database[uid]) {
        database[uid] = { game: "NOT SET", rank: "Unranked", stats: "N/A", xp: 0, level: 1, name: message.author.username };
    }

    const xpGain = Math.floor(Math.random() * 11) + 15;
    database[uid].xp += xpGain;
    database[uid].name = message.author.username;

    const nextLevelXP = database[uid].level * 1000;
    if (database[uid].xp >= nextLevelXP) {
        database[uid].level++;
        message.reply(`🎊 **UPGRADE COMPLETE!** ${message.author} reached **Level ${database[uid].level}**!`);
    }
    fs.writeFileSync(dbPath, JSON.stringify(database, null, 4));

    // B. LYDIA AUTO-AI LOGIC (Triggered on Reply)
    let lydiaChannels = {};
    if (fs.existsSync(lydiaStatusPath)) {
        try { lydiaChannels = JSON.parse(fs.readFileSync(lydiaStatusPath, 'utf8')); } catch(e) {}
    }

    if (lydiaChannels[message.channel.id] && !message.content.startsWith(PREFIX)) {
        // Check if the message is a reply to the BOT
        if (message.reference) {
            try {
                const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
                if (repliedMsg.author.id === client.user.id) {
                    await message.channel.sendTyping();
                    const prompt = `Context: "${repliedMsg.content}"\nUser says: "${message.content}"\nResponse:`;
                    const result = await model.generateContent(prompt);
                    return message.reply(result.response.text());
                }
            } catch (err) { console.error("Lydia Error:", err); }
        }
    }

    // C. COMMAND SYSTEM
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName);

    if (!command) return;

    try {
        await command.execute(message, args, client, model); 
    } catch (error) {
        console.error(`❌ EXECUTION ERROR [${commandName}]:`, error);
        message.reply("⚠️ Command failed.");
    }
});

client.login(process.env.DISCORD_TOKEN);
