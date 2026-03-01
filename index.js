require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, ActivityType, Events, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Setup with Error-Logging to catch why it stays "Offline"
console.log("🟡 System: Starting Digital Engine...");

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages 
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User] 
});

client.commands = new Collection();
const PREFIX = process.env.PREFIX || ',';
const ARCHITECT_ID = '1284944736620253296'; 

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Load Plugins with individual error catching
const loadPlugins = () => {
    const pluginsPath = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginsPath)) {
        return console.log("❌ CRITICAL: 'plugins' folder not found!");
    }

    const pluginFiles = fs.readdirSync(pluginsPath).filter(file => file.endsWith('.js'));
    pluginFiles.forEach(file => {
        try {
            const fullPath = require.resolve(`./plugins/${file}`);
            delete require.cache[fullPath]; 
            const command = require(`./plugins/${file}`);
            if (command.name) client.commands.set(command.name, command);
        } catch (e) {
            console.error(`⚠️ Plugin [${file}] failed to load: ${e.message}`);
        }
    });
    console.log(`🚀 Plugins Loaded: ${client.commands.size}`);
};

loadPlugins();

client.once(Events.ClientReady, async () => {
    console.log(`✅ SUCCESS: ${client.user.tag} is online!`);
    client.user.setActivity('Cloud Gaming-223', { type: ActivityType.Competing });

    try {
        const architect = await client.users.fetch(ARCHITECT_ID);
        if (architect) {
            const bootEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('🛰️ CLOUD GAMING-223 | ONLINE')
                .setDescription(`**System V2.6 Synchronized.**\nPlugins Active: ${client.commands.size}`)
                .setTimestamp();
            await architect.send({ embeds: [bootEmbed] });
            console.log("📩 Architect DM Sent.");
        }
    } catch (err) { console.log("ℹ️ Could not DM Architect."); }
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName);
    if (!command) return;
    try {
        await command.execute(message, args, client, model); 
    } catch (error) {
        console.error(`❌ Execution Error:`, error);
    }
});

// LOGIN WITH ERROR CATCHING
client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error("❌ LOGIN FAILED: Check your DISCORD_TOKEN in .env");
    console.error(err);
});

// Protect the process from crashing
process.on('unhandledRejection', error => console.error('Unhandled Error:', error));
