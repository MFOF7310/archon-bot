require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, ActivityType, Events, Partials, EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- 1. SYSTEM CONFIG & PATHS ---
const client = new Client({ 
    intents: [1, 512, 32768, 2, 4096, 16384],
    partials: [Partials.Channel, Partials.Message, Partials.User] 
});

client.commands = new Collection();
const PREFIX = process.env.PREFIX || ',';
const ARCHITECT_ID = process.env.OWNER_ID; 
const dbPath = path.join(__dirname, 'database.json');
const lydiaPath = path.join(__dirname, 'lydia_status.json');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- 2. PLUGIN LOADER ---
const loadPlugins = () => {
    const pluginsPath = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginsPath)) fs.mkdirSync(pluginsPath);
    const files = fs.readdirSync(pluginsPath).filter(f => f.endsWith('.js'));
    files.forEach(file => {
        try {
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
    const statusMessages = ["🛰️ Monitoring CLOUD_GAMING-223", "🛠️ Engine V2.7.0", "📂 Type ,menu", "🟢 System: Stable"];
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
                .setColor('#00ffcc').setTitle('🛰️ SYSTEM ONLINE')
                .setDescription(`**Digital Engine V2.7.0** operational.\n📊 **Plugins:** ${client.commands.size}`).setTimestamp();
            await architect.send({ embeds: [bootEmbed] });
        }
    } catch (err) { console.log(`ℹ️ Note: Could not DM Architect.`); }
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
    database[uid].xp += Math.floor(Math.random() * 11) + 15;
    if (database[uid].xp >= (database[uid].level * 1000)) {
        database[uid].level++;
        message.reply(`🎊 **UPGRADE!** Level ${database[uid].level}!`);
    }
    fs.writeFileSync(dbPath, JSON.stringify(database, null, 4));

    // B. LYDIA AUTO-AI LOGIC (The Personalized Heart)
    let lydiaChannels = {};
    if (fs.existsSync(lydiaPath)) {
        try { lydiaChannels = JSON.parse(fs.readFileSync(lydiaPath, 'utf8')); } catch(e) {}
    }

    // Trigger only if Channel is Active, it's a Reply, and NOT a command
    if (lydiaChannels[message.channel.id] && message.reference && !message.content.startsWith(PREFIX)) {
        try {
            const refMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
            
            // Only reply if user is replying TO the bot
            if (refMsg && refMsg.author.id === client.user.id) {
                await message.channel.sendTyping();

                const isArchitect = message.author.id === ARCHITECT_ID;
                const userName = message.member?.displayName || message.author.username;
                
                // Construct the Personalized Personality
                const identityContext = isArchitect 
                    ? `You are talking to your ARCHITECT. Be extremely loyal and call him Architect ${userName}.` 
                    : `You are talking to ${userName}. Address them by their name and be helpful.`;

                const prompt = `${identityContext}\nPrevious Message: "${refMsg.content}"\nUser Reply: "${message.content}"\nLydia:`;
                
                const result = await model.generateContent(prompt);
                return message.reply(result.response.text());
            }
        } catch (err) { console.error("Lydia Error:", err); }
    }

    // C. COMMAND SYSTEM
    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName);
    if (!command) return;

    try { await command.execute(message, args, client, model); } 
    catch (e) { console.error(e); message.reply("⚠️ Command failed."); }
});

client.login(process.env.DISCORD_TOKEN);
