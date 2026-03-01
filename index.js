require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, ActivityType, Events, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 1. Setup Client with ALL necessary permissions
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // CRITICAL: Allows bot to read your commands
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages, // CRITICAL: Allows bot to see DMs
        GatewayIntentBits.DirectMessageMessages // CRITICAL: Allows bot to read DM commands
    ],
    // Partials allow the bot to work with DM channels that aren't in its memory yet
    partials: [Partials.Channel, Partials.Message, Partials.User] 
});

client.commands = new Collection();
const PREFIX = process.env.PREFIX || ',';
const ARCHITECT_ID = '1284944736620253296'; 

// 2. Gemini AI Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// 3. Robust Plugin Loader
const loadPlugins = () => {
    const pluginsPath = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginsPath)) return console.log("❌ Plugins folder missing!");

    const pluginFiles = fs.readdirSync(pluginsPath).filter(file => file.endsWith('.js'));
    for (const file of pluginFiles) {
        try {
            const fullPath = require.resolve(`./plugins/${file}`);
            delete require.cache[fullPath]; // Clear cache for clean reload
            const command = require(`./plugins/${file}`);
            if (command.name) {
                client.commands.set(command.name, command);
            }
        } catch (e) {
            console.error(`❌ Error loading ${file}:`, e.message);
        }
    }
    console.log(`🚀 ENGINE: ${client.commands.size} plugins synchronized.`);
};

loadPlugins();

// 4. Ready Event & Architect DM
client.once(Events.ClientReady, async () => {
    console.log(`✅ CLOUD GAMING-223 Online | User: ${client.user.tag}`);
    client.user.setActivity('Cloud Gaming-223', { type: ActivityType.Competing });

    try {
        // Fetch user from API to ensure they are available for DM
        const architect = await client.users.fetch(ARCHITECT_ID);
        if (architect) {
            const bootEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('🛰️ SYSTEM ONLINE')
                .setDescription(`**Digital Engine V2.6 Synchronized.**\n\n📊 **Plugins:** ${client.commands.size}\n🔥 **Status:** Operational`)
                .setTimestamp();

            await architect.send({ embeds: [bootEmbed] });
            console.log(`📩 Boot DM delivered to Architect.`);
        }
    } catch (err) {
        console.log(`⚠️ Boot DM failed: ${err.message}. (Is your DM open to the bot?)`);
    }
});

// 5. Improved Command Handler
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    // Check for prefix
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName);
    
    if (!command) return;

    try {
        await command.execute(message, args, client, model); 
    } catch (error) {
        console.error(`❌ Execution Error [${commandName}]:`, error);
        message.reply("⚠️ Command failed. Check console.");
    }
});

client.login(process.env.DISCORD_TOKEN);
