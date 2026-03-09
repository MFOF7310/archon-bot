require('dotenv').config(); 
// ================= BOOT SEQUENCE LOGS =================
console.log("---------------------------------------");
console.log("🚀 DIGITAL ENGINE: INITIALIZING...");
console.log("📍 LOCATION: BAMAKO NODE 🇲🇱");
console.log("🦅 THEME: EAGLE COMMUNITY ELITE");
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
client.version = "1.0.0"; 
const PREFIX = process.env.PREFIX || ",";

// ================= COOLDOWN SYSTEM =================
const xpCooldowns = new Map(); 

// ================= PATHS & DB =================
const dbPath = path.join(__dirname, 'database.json');
const lydiaPath = path.join(__dirname, 'lydia_status.json');

if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({}, null, 4));
if (!fs.existsSync(lydiaPath)) fs.writeFileSync(lydiaPath, JSON.stringify({}, null, 4));

let database = JSON.parse(fs.readFileSync(dbPath, "utf8"));
let lydiaChannels = JSON.parse(fs.readFileSync(lydiaPath, "utf8"));

console.log("📂 DATABASE: Synchronized.");

setInterval(() => {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(database, null, 4));
        fs.writeFileSync(lydiaPath, JSON.stringify(lydiaChannels, null, 4));
    } catch (err) { console.log("⚠️ Save Error:", err.message); }
}, 30000);

// ================= GEMINI AI SETUP =================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    // ✨ Lydia is now tuned to the elegant Eagle aesthetic
    systemInstruction: "You are Lydia, the Digital Engine of Eagle Community. You are helpful, tech-savvy, and rooted in Mali 🇲🇱. Use italics (*text*) for a premium feel and eagle (🦅) or tech (🛰️) emojis. Keep responses concise, elegant, and avoid mentioning you are an AI.",
    safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
    ]
});

// ================= PLUGIN LOADER =================
client.loadPlugins = function() {
    client.commands.clear();
    client.aliases.clear();
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
                if (plugin.aliases && Array.isArray(plugin.aliases)) {
                    plugin.aliases.forEach(alias => client.aliases.set(alias, plugin.name));
                }
            }
        } catch (err) { console.log(`❌ PLUGIN ERROR (${file}):`, err.message); }
    }
    console.log(`🚀 ${client.commands.size} Plugins Loaded | v${client.version}`);
};

client.loadPlugins();

// ================= EVENTS =================

client.once(Events.ClientReady, async () => {
    console.log(`✅ ${client.user.username} is connected successfully`);
    
    try {
        const res = await axios.get("https://raw.githubusercontent.com/MFOF7310/cloud-gaming-223-digital-engine/main/version.txt");
        const latestVersion = res.data.toString().trim();

        if (latestVersion !== client.version) {
            console.log(`✨ UPDATE | A new version (${latestVersion}) is available!`);
        } else {
            console.log(`⭐ SYSTEM | Your software is up to date (v${client.version}).`);
        }
    } catch (e) {
        console.log(`❌ SYSTEM | Could not connect to update server.`);
    }

    const statuses = ["🦅 Eagle Community", "✨ Elegance in Flight", "🤖 Node: Bamako-223"];
    let i = 0;
    setInterval(() => {
        client.user.setPresence({ 
            activities: [{ name: statuses[i], type: ActivityType.Custom }], 
            status: "online" 
        });
        i = (i + 1) % statuses.length;
    }, 10000);
});

// ================= 🦅 ELEGANT WELCOME & GUIDELINES =================
client.on(Events.GuildMemberAdd, async member => {
    const channel = member.guild.systemChannel || member.guild.channels.cache.find(ch => ch.name.includes('welcome'));
    if (!channel) return;

    database[member.id] = { 
        xp: 100, 
        level: 1, 
        name: member.user.username, 
        gaming: { game: "N/A", rank: "Unranked", stats: "N/A" } 
    };

    const welcomeEmbed = new EmbedBuilder()
        .setColor('#fdfdfd') // Premium White
        .setTitle('✧ 𝘎𝘳𝘦𝘦𝘵𝘪𝘯𝘨𝘴 𝘧𝘳𝘰𝘮 𝘵𝘩𝘦 𝘚𝘬𝘪𝘦𝘴 ✧')
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setDescription(`*Welcome home, ${member}. Your journey with the Eagle Community begins here at Node: Bamako-223. / Bienvenue chez toi, ${member}. Ton voyage commence ici au Nœud : Bamako-223.*`)
        .addFields(
            { 
                name: '📜 𝘌𝘯𝘨𝘭𝘪𝘴𝘩 𝘎𝘶𝘪𝘥𝘦𝘭𝘪𝘯𝘦𝘴', 
                value: '• *Fly with respect.*\n• *Keep the airwaves clear.*\n• *Trust the Wardens.*', 
                inline: true 
            },
            { 
                name: '📜 𝘙è𝘨𝘭𝘦𝘮𝘦𝘯𝘵𝘴 𝘍𝘳𝘢𝘯ç𝘢𝘪𝘴', 
                value: '• *Volez avec respect.*\n• *Gardez les ondes propres.*\n• *Faites confiance aux Wardens.*', 
                inline: true 
            },
            {
                name: '✨ 𝗔 𝗚𝗶𝗳𝘁 𝗳𝗼𝗿 𝗬𝗼𝘂',
                value: '*We have credited your account with +100 XP to start your ascent.*',
                inline: false
            }
        )
        .setFooter({ text: `Eagle Community • Elegance in Flight` })
        .setTimestamp();

    channel.send({ content: `🦅 *A new flyer has joined the nest:* ${member}`, embeds: [welcomeEmbed] });
});

client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;

    const uid = message.author.id;
    const now = Date.now();
    const COOLDOWN_TIME = 60000; 

    if (!database[uid]) {
        database[uid] = { 
            xp: 0, 
            level: 1, 
            name: message.author.username, 
            gaming: { game: "N/A", rank: "Unranked", stats: "N/A" } 
        };
    }

    // --- XP LOGIC ---
    const userCooldown = xpCooldowns.get(uid);
    if (!userCooldown || (now - userCooldown) > COOLDOWN_TIME) {
        const randomXP = Math.floor(Math.random() * (45 - 25 + 1)) + 25;
        database[uid].xp += randomXP;
        database[uid].name = message.author.username; 
        xpCooldowns.set(uid, now);

        let nextLevel = Math.floor(database[uid].xp / 1000) + 1;
        if (nextLevel > database[uid].level) {
            database[uid].level = nextLevel;
            message.reply(`🆙 **LEVEL UP!** <@${uid}>, you reached **Level ${nextLevel}**!`);
        }
    }

    // --- COMMAND HANDLING ---
    if (message.content.startsWith(PREFIX)) {
        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const cmdName = args.shift().toLowerCase();
        const command = client.commands.get(cmdName
