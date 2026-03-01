require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, ActivityType, Events, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages 
    ],
    partials: [Partials.Channel, Partials.Message] 
});

client.commands = new Collection();
const PREFIX = process.env.PREFIX || ',';
const ARCHITECT_ID = '1284944736620253296'; // Your ID

// 1. Gemini AI Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// 2. Plugin Loader
const loadPlugins = () => {
    const pluginsPath = path.join(__dirname, 'plugins');
    if (fs.existsSync(pluginsPath)) {
        const pluginFiles = fs.readdirSync(pluginsPath).filter(file => file.endsWith('.js'));
        for (const file of pluginFiles) {
            try {
                const command = require(`./plugins/${file}`);
                if (command.name) {
                    client.commands.set(command.name, command);
                }
            } catch (e) {
                console.error(`❌ Error loading ${file}: ${e.message}`);
            }
        }
    }
};

loadPlugins();

// 3. Ready Event + Architect DM
client.once(Events.ClientReady, async () => {
    console.log(`✅ CLOUD GAMING-223 Online | Status: 100% Operational`);
    client.user.setActivity('Cloud Gaming-223', { type: ActivityType.Competing });

    // Send the Boot Notification DM
    try {
        const architect = await client.users.fetch(ARCHITECT_ID);
        if (architect) {
            const bootEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('🛰️ SYSTEM ONLINE')
                .setDescription(`**Digital Engine V2.6 Synchronized.**\n\n📊 **Plugins:** ${client.commands.size}\n🇲🇱 **Region:** Bamako\n🔥 **Status:** Operational`)
                .setTimestamp();

            await architect.send({ embeds: [bootEmbed] });
            console.log(`📩 Boot DM delivered to Architect.`);
        }
    } catch (err) {
        console.log(`⚠️ Could not send Boot DM: ${err.message}`);
    }
});

// 4. Command Handler
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName);
    
    if (!command) return;

    try {
        await command.execute(message, args, client, model); 
    } catch (error) {
        console.error(`❌ Command Error [${commandName}]:`, error);
        message.reply("⚠️ An error occurred while running this command.");
    }
});

client.login(process.env.DISCORD_TOKEN);
