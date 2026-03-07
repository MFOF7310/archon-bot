require('dotenv').config(); 
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Client, Collection, ActivityType, Events, Partials, EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

// ================= CLIENT & VERSION =================
const client = new Client({
    intents: [1, 512, 32768, 2, 4096, 16384, 128], // Added GuildMembers (128)
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

client.commands = new Collection();
client.aliases = new Collection();
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

// ================= CLEAN PLUGIN LOADER =================
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
    console.log(`🚀 ${client.commands.size} unique plugins loaded | Engine v${client.version}`);
};

client.loadPlugins();

// ================= EVENTS =================

// 1. Ready Event
client.once(Events.ClientReady, async () => {
    console.log(`✅ ${client.user.tag} Online`);
    
    try {
        const res = await axios.get("https://raw.githubusercontent.com/MFOF7310/cloud-gaming-223-digital-engine/main/version.txt");
        const remote = res.data.toString().trim();
        const local = client.version.toString().trim();
        if (remote !== local) {
            console.log(`📢 UPDATE: v${remote} available. (Run ${PREFIX}update)`);
        }
    } catch (e) {}

    const statuses = ["🎮 CODM Assistant", "🧠 CLOUD_GAMING AI"];
    let i = 0;
    setInterval(() => {
        client.user.setPresence({ activities: [{ name: statuses[i], type: ActivityType.Custom }], status: "online" });
        i = (i + 1) % statuses.length;
    }, 10000);
});

// 2. Welcome Event
client.on(Events.GuildMemberAdd, async member => {
    // Finds system channel or a channel named 'welcome'
    const channel = member.guild.systemChannel || member.guild.channels.cache.find(ch => ch.name.includes('welcome'));
    if (!channel) return;

    const uid = member.id;
    database[uid] = { 
        xp: 100, 
        level: 1, 
        name: member.user.username, 
        gaming: { game: "N/A", rank: "Unranked", stats: "N/A" } 
    };

    const welcomeEmbed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('🆕 NEW AGENT ARRIVED')
        .setThumbnail(member.user.displayAvatarURL())
        .setDescription(
            `Bienvenue, ${member}! You've joined the **Digital Engine**.\n\n` +
            `🎁 **Bonus:** +100 XP added to your profile.\n` +
            `🇲🇱 **Region:** Bamako Node\n\n` +
            `Type \`${PREFIX}help\` to begin your mission.`
        )
        .setFooter({ text: 'Cloud Gaming-223 | Security Protocol' })
        .setTimestamp();

    channel.send({ content: `Welcome ${member}!`, embeds: [welcomeEmbed] });
});

// 3. Message Event
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
        message.reply(`🎊 **LEVEL UP!** You are now **Level ${nextLevel}**.`);
    }

    if (message.content.startsWith(PREFIX)) {
        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const cmdName = args.shift().toLowerCase();
        const command = client.commands.get(cmdName) || client.commands.get(client.aliases.get(cmdName));

        if (command) {
            try { 
                await command.execute(message, args, client, model, lydiaChannels, database); 
            } catch (err) { console.error(err); }
            return;
        }
    }

    if (!lydiaChannels[message.channel.id]) return;
    if (!message.mentions.has(client.user)) return;

    try {
        await message.channel.sendTyping();
        const username = message.member?.displayName || message.author.username;
        const prompt = `You are CLOUD_GAMING for server CG-223. User: ${username}. Msg: ${message.content}`;
        const result = await model.generateContent(prompt);
        message.reply(result.response.text());
    } catch (err) { console.log("❌ AI ERROR:", err.message); }
});

client.login(process.env.DISCORD_TOKEN);
