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

// ================= CLIENT & INTENTS =================
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

// --- DYNAMIC PREFIX INITIALIZATION ---
// This allows the setprefix command to update the bot live
client.prefix = process.env.PREFIX || ","; 

// ================= PATHS & DB =================
const dbPath = path.join(__dirname, 'database.json');
const lydiaPath = path.join(__dirname, 'lydia_status.json');

// Ensure files exist to prevent boot crashes
if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({}, null, 4));
if (!fs.existsSync(lydiaPath)) fs.writeFileSync(lydiaPath, JSON.stringify({}, null, 4));

let database = JSON.parse(fs.readFileSync(dbPath, "utf8"));
let lydiaChannels = JSON.parse(fs.readFileSync(lydiaPath, "utf8"));

// Auto-save logic (Syncs memory to disk every 30 seconds)
setInterval(() => {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(database, null, 4));
        fs.writeFileSync(lydiaPath, JSON.stringify(lydiaChannels, null, 4));
    } catch (err) { console.log("⚠️ DB Sync Error:", err.message); }
}, 30000);

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
    console.log(`🚀 Architect Engine: ${client.commands.size} Modules Loaded.`);
};

client.loadPlugins();

// ================= READY EVENT =================
client.once(Events.ClientReady, async () => {
    console.log(`✅ Online as ${client.user.username}`);

    // Optional: Send diagnostic to a specific log channel on boot
    const logChannel = client.channels.cache.get('YOUR_LOG_CHANNEL_ID'); 
    
    const bootEmbed = new EmbedBuilder()
        .setColor('#00fbff')
        .setAuthor({ name: 'ARCHITECT CG-223 | SYSTEM BOOT', iconURL: client.user.displayAvatarURL() })
        .setDescription('📡 *All satellite nodes synchronized. Bamako-223 uplink established.*')
        .addFields(
            { name: '⚙️ Engine', value: `\`v${client.version}\``, inline: true },
            { name: '📟 Prefix', value: `\`${client.prefix}\``, inline: true },
            { name: '📂 Modules', value: `\`${client.commands.size} Loaded\``, inline: true },
            { name: '🛡️ Status', value: '`🟢 OPERATIONAL`', inline: true }
        )
        .setFooter({ text: 'Architect Intelligence • Digital Sovereignty' })
        .setTimestamp();

    if (logChannel) logChannel.send({ embeds: [bootEmbed] });

    client.user.setPresence({ 
        activities: [{ name: `v${client.version} | ${client.prefix}help`, type: ActivityType.Custom }], 
        status: "online" 
    });
});

// ================= MESSAGE HANDLER (XP & COMMANDS) =================
client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;

    const uid = message.author.id;
    const now = Date.now();
    const currentPrefix = client.prefix; // Live prefix check

    // Ensure user exists in Database
    if (!database[uid]) {
        database[uid] = { 
            xp: 0, 
            level: 1, 
            name: message.author.username, 
            gaming: { game: "N/A", rank: "Unranked", stats: "N/A" } 
        };
    }

    // --- XP & LEVELING LOGIC ---
    // Simple 1-minute cooldown per user for XP gain
    if (!message.content.startsWith(currentPrefix)) {
        const randomXP = Math.floor(Math.random() * 20) + 15;
        database[uid].xp += randomXP;
        
        let nextLevel = Math.floor(database[uid].xp / 1000) + 1;
        if (nextLevel > database[uid].level) {
            database[uid].level = nextLevel;
            message.reply(`🆙 **LEVEL UP!** You reached **Level ${nextLevel}**!`);
        }
    }

    // --- DYNAMIC COMMAND HANDLING ---
    if (message.content.startsWith(currentPrefix)) {
        const args = message.content.slice(currentPrefix.length).trim().split(/ +/);
        const cmdName = args.shift().toLowerCase();
        
        const command = client.commands.get(cmdName) || client.commands.get(client.aliases.get(cmdName));

        if (command) {
            try {
                // STANDARD v2.0.0 PARAMETERS
                await command.run(client, message, args, database);
            } catch (error) {
                console.error(`❌ Execution Error [${cmdName}]:`, error);
                message.reply("⚠️ *Architectural Error: Command protocol failed.*");
            }
        }
    }

    // --- LYDIA AI SECTOR ---
    if (lydiaChannels[message.channel.id] && !message.content.startsWith(currentPrefix)) {
        try {
            await message.channel.sendTyping();
            const result = await client.model.generateContent(message.content);
            const response = await result.response;
            message.reply(response.text());
        } catch (err) { console.error("AI Error:", err.message); }
    }
});

// ================= LOGIN =================
client.login(process.env.TOKEN);
