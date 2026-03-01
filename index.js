require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, ActivityType, Events, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- 1. THE CONSOLE HEARTBEAT ---
console.log("-----------------------------------------");
console.log("🛰️  DIGITAL ENGINE: STARTING BOOT SEQUENCE");
console.log("-----------------------------------------");

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ],
    partials: [
        Partials.Channel, 
        Partials.Message, 
        Partials.User
    ] 
});

client.commands = new Collection();
const PREFIX = process.env.PREFIX || ',';
const ARCHITECT_ID = '1284944736620253296'; 

// AI Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- 2. DYNAMIC PLUGIN LOADER ---
const loadPlugins = () => {
    const pluginsPath = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginsPath)) return console.error("❌ ERROR: 'plugins' folder missing!");

    const files = fs.readdirSync(pluginsPath).filter(f => f.endsWith('.js'));
    files.forEach(file => {
        try {
            const fullPath = require.resolve(`./plugins/${file}`);
            delete require.cache[fullPath]; 
            const command = require(`./plugins/${file}`);
            if (command.name) {
                client.commands.set(command.name, command);
            }
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
            console.log("📩 Architect DM Sent Successfully.");
        }
    } catch (err) {
        console.log(`ℹ️ Note: Could not DM Architect. Error: ${err.message}`);
    }
});

// --- 4. MESSAGE HANDLER ---
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName);

    if (!command) return;

    try {
        await command.execute(message, args, client, model); 
    } catch (error) {
        console.error(`❌ EXECUTION ERROR [${commandName}]:`, error);
        message.reply("⚠️ Command failed. Check console for logs.");
    }
});

// --- 5. CRASH PROTECTION ---
process.on('unhandledRejection', error => console.error(' [Unhandled Rejection]:', error));
process.on('uncaughtException', error => console.error(' [Uncaught Exception]:', error));

client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error("❌ LOGIN ERROR: Check your DISCORD_TOKEN.");
});
