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
const ARCHITECT_ID = '1284944736620253296'; 
const dbPath = path.join(__dirname, 'database.json');

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
    client.user.setActivity('Cloud Gaming-223', { type: ActivityType.Competing });

    try {
        const architect = await client.users.fetch(ARCHITECT_ID);
        if (architect) {
            const bootEmbed = new EmbedBuilder()
                .setColor('#00ffcc')
                .setTitle('🛰️ SYSTEM ONLINE')
                .setDescription(`**Digital Engine V2.6** is operational.\n\n📊 **Active Plugins:** ${client.commands.size}`)
                .setTimestamp();
            await architect.send({ embeds: [bootEmbed] });
        }
    } catch (err) { console.log(`ℹ️ Note: Could not DM Architect.`); }
});

// --- 4. MESSAGE HANDLER (XP + COMMANDS) ---
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    // A. XP SYSTEM (Process every message)
    let database = {};
    if (fs.existsSync(dbPath)) {
        try { database = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) { database = {}; }
    }

    const uid = message.author.id;
    if (!database[uid]) {
        database[uid] = { game: "NOT SET", rank: "Unranked", stats: "N/A", xp: 0, level: 1, name: message.author.username };
    }

    // Gain 15-25 XP
    const xpGain = Math.floor(Math.random() * 11) + 15;
    database[uid].xp += xpGain;
    database[uid].name = message.author.username; // Keep name updated

    // Level up check (Level * 1000)
    const nextLevelXP = database[uid].level * 1000;
    if (database[uid].xp >= nextLevelXP) {
        database[uid].level++;
        message.reply(`🎊 **UPGRADE COMPLETE!** ${message.author} reached **Level ${database[uid].level}**!`);
    }
    fs.writeFileSync(dbPath, JSON.stringify(database, null, 4));

    // B. COMMAND SYSTEM
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
