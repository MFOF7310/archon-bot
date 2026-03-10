require('dotenv').config(); 
const fs = require('fs');
const path = require('path');
const { Client, Collection, Events, Partials, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- TERMINAL COLORS ---
const green = "\x1b[32m", blue = "\x1b[34m", cyan = "\x1b[36m", yellow = "\x1b[33m", reset = "\x1b[0m", bold = "\x1b[1m";

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

// --- COLLECTIONS & CONFIG ---
client.commands = new Collection();
client.aliases = new Collection();
client.version = "1.0.0"; // Initial Version
const PREFIX = process.env.PREFIX || ".";

// --- DATABASE PERSISTENCE ---
const dbPath = path.join(__dirname, 'database.json');
let database = {};

if (fs.existsSync(dbPath)) {
    database = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

const saveDatabase = () => {
    fs.writeFileSync(dbPath, JSON.stringify(database, null, 2));
};

// --- GEMINI CORE ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
client.model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// --- HOT-RELOAD FUNCTION (For .update command) ---
client.loadPlugins = async () => {
    client.commands.clear();
    client.aliases.clear();
    const pluginPath = path.join(__dirname, 'plugins');
    const pluginFiles = fs.readdirSync(pluginPath).filter(file => file.endsWith('.js'));
    
    for (const file of pluginFiles) {
        delete require.cache[require.resolve(`./plugins/${file}`)]; // Clear cache
        const command = require(`./plugins/${file}`);
        if (command.name && command.run) {
            client.commands.set(command.name, command);
            if (command.aliases) command.aliases.forEach(a => client.aliases.set(a, command.name));
        }
    }
    console.log(`${green}[SYSTEM]${reset} Modules Hot-Reloaded.`);
};

// ================= BOOT SEQUENCE =================
client.once(Events.ClientReady, async () => {
    console.clear();
    console.log(`${blue}${bold}==============================================${reset}`);
    console.log(`${cyan}🛰️  ARCHITECT CG-223 CORE INITIALIZATION...${reset}`);
    console.log(`${blue}${bold}==============================================${reset}\n`);

    await client.loadPlugins();

    console.log(`${green}🚀 STATUS   : ONLINE | NODE: BAMAKO_ML${reset}`);
    console.log(`${green}📡 CLIENT   : ${client.user.tag}${reset}\n`);

    // Owner Alert
    try {
        const owner = await client.users.fetch(process.env.OWNER_ID);
        const alertEmbed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle('🦅 ARCHITECT CG-223 // ONLINE')
            .setDescription(`Neural link established. Monitoring **Bamako_Node**.`)
            .setTimestamp();
        await owner.send({ embeds: [alertEmbed] });
    } catch (e) { console.log("Owner DM Failed."); }
});

// ================= MESSAGE HANDLER (XP & COMMANDS) =================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    // 1. RANDOM XP ENGINE (20-40 XP)
    const userId = message.author.id;
    if (!database[userId]) {
        database[userId] = { name: message.author.username, xp: 0, level: 1, gaming: { game: "N/A", rank: "Unranked" } };
    }

    const gainedXp = Math.floor(Math.random() * (40 - 20 + 1)) + 20;
    database[userId].xp += gainedXp;

    // Level Up Logic (Every 1000 XP)
    const newLevel = Math.floor(database[userId].xp / 1000) + 1;
    if (newLevel > database[userId].level) {
        database[userId].level = newLevel;
        message.channel.send(`✨ **LEVEL UP:** <@${userId}> reached **Level ${newLevel}**!`).then(m => setTimeout(() => m.delete(), 5000));
    }

    saveDatabase(); // Persistence check

    // 2. COMMAND ROUTER
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const cmdName = args.shift().toLowerCase();
    const command = client.commands.get(cmdName) || client.commands.get(client.aliases.get(cmdName));
    
    if (command) {
        try {
            await command.run(client, message, args, database);
        } catch (error) {
            console.error(error);
            message.reply("⚠️ **System Error:** Module failed.");
        }
    }
});

client.login(process.env.TOKEN);
