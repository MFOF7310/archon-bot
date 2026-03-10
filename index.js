require('dotenv').config(); 
const fs = require('fs');
const path = require('path');
const { Client, Collection, Events, Partials, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- TERMINAL COLORS ---
const green = "\x1b[32m", blue = "\x1b[34m", cyan = "\x1b[36m", yellow = "\x1b[33m", reset = "\x1b[0m", bold = "\x1b[1m";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers, 
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

// --- SYSTEM GLOBALS ---
client.commands = new Collection();
client.aliases = new Collection();
client.version = "1.0.0"; 
const PREFIX = process.env.PREFIX || ".";

// --- DATABASE: THE PERSISTENCE LAYER ---
const dbPath = path.join(__dirname, 'database.json');
let database = {};

if (fs.existsSync(dbPath)) {
    try {
        database = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch (e) {
        console.log(`${yellow}[WARN]${reset} Database corrupted. Initializing fresh.`);
        database = {};
    }
}

const saveDatabase = () => {
    fs.writeFileSync(dbPath, JSON.stringify(database, null, 2));
};

// --- GEMINI AI CONFIGURATION ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
client.model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// --- THE LOADER: MODULE SYNCHRONIZATION (THE LIST YOU WANT) ---
client.loadPlugins = async () => {
    // Clear current memory
    client.commands.clear();
    client.aliases.clear();
    
    console.log(`\n${blue}${bold}==============================================${reset}`);
    console.log(`${cyan}🛰️  ARCHITECT CG-223 | MODULE SYNCHRONIZATION${reset}`);
    console.log(`${blue}${bold}==============================================${reset}`);

    const pluginPath = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginPath)) {
        console.log(`${yellow}[WARN]${reset} Plugins folder not found! Creating one...`);
        fs.mkdirSync(pluginPath);
    }
    
    const pluginFiles = fs.readdirSync(pluginPath).filter(file => file.endsWith('.js'));
    
    for (const file of pluginFiles) {
        try {
            const filePath = path.join(pluginPath, file);
            
            // This is the magic: it clears the old code from memory
            delete require.cache[require.resolve(filePath)];
            
            const command = require(filePath);
            
            if (command.name && command.run) {
                client.commands.set(command.name, command);
                
                if (command.aliases && Array.isArray(command.aliases)) {
                    command.aliases.forEach(alias => client.aliases.set(alias, command.name));
                }
                
                // THIS IS THE SUCCESS LOG:
                console.log(`${green}[SUCCESS]${reset} Linked Module: ${cyan}${command.name.toUpperCase()}${reset}`);
            } else {
                console.log(`${yellow}[SKIPPED]${reset} ${file} is missing Name/Run export.`);
            }
        } catch (error) {
            console.log(`${blue}[ERROR]${reset} Failed to link ${file}: ${error.message}`);
        }
        // Small delay for that "Matrix" feel
        await new Promise(r => setTimeout(r, 50)); 
    }
    
    console.log(`${blue}${bold}----------------------------------------------${reset}`);
    console.log(`${green}🚀 ENGINE READY | ${client.commands.size} CORE MODULES ONLINE${reset}`);
    console.log(`${blue}${bold}----------------------------------------------${reset}\n`);
};

// ================= BOOT SEQUENCE =================
client.once(Events.ClientReady, async () => {
    console.clear();
    // Run the high-visibility loader
    await client.loadPlugins();

    console.log(`${green}🛰️  CLIENT   : ${client.user.tag}${reset}`);
    console.log(`${green}📍 NODE     : BAMAKO_223${reset}\n`);

    // Owner Alert DM
    try {
        const owner = await client.users.fetch(process.env.OWNER_ID);
        const alertEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('🦅 ARCHITECT CG-223 // ONLINE')
            .setDescription(`System reboot complete. **${client.commands.size}** modules synced.`)
            .setTimestamp();
        await owner.send({ embeds: [alertEmbed] });
    } catch (err) {
        console.log(`${yellow}[NOTICE]${reset} DM Failed.`);
    }
});

// ================= THE ENGINE: MESSAGE PROCESSING =================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;

    // 1. XP REWARD PROTOCOL (Random 20-40 XP)
    if (!database[userId]) {
        database[userId] = { 
            name: message.author.username, 
            xp: 0, 
            level: 1, 
            gaming: { game: "NOT SET", rank: "Unranked" } 
        };
    }

    // Add XP and Save
    database[userId].xp += Math.floor(Math.random() * (40 - 20 + 1)) + 20;

    // Level Check
    const newLevel = Math.floor(database[userId].xp / 1000) + 1;
    if (newLevel > database[userId].level) {
        database[userId].level = newLevel;
        message.channel.send(`✨ **SYNC UP:** <@${userId}> reached **Level ${newLevel}**!`)
            .then(m => setTimeout(() => m.delete().catch(() => null), 5000));
    }
    saveDatabase();

    // 2. COMMAND INTERFACE
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const cmdName = args.shift().toLowerCase();

    const command = client.commands.get(cmdName) || client.commands.get(client.aliases.get(cmdName));
    
    if (command) {
        try {
            // Pass shared database to every plugin
            await command.run(client, message, args, database);
        } catch (error) {
            console.error(error);
            message.reply("⚠️ **Neural link interrupted.**");
        }
    }
});

client.login(process.env.TOKEN);
