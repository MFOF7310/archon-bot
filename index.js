require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, ActivityType, Events, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 1. Initialize Discord Client with necessary Intents and Partials
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

// 2. Gemini AI Setup (For plugins using AI)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// 3. Plugin Loader Logic
const loadPlugins = () => {
    const pluginsPath = path.join(__dirname, 'plugins');
    if (fs.existsSync(pluginsPath)) {
        const pluginFiles = fs.readdirSync(pluginsPath).filter(file => file.endsWith('.js'));
        for (const file of pluginFiles) {
            try {
                // Clear cache so changes to plugin files are applied on restart
                const fullPath = require.resolve(`./plugins/${file}`);
                delete require.cache[fullPath];

                const command = require(`./plugins/${file}`);
                if (command.name) {
                    client.commands.set(command.name, command);
                }
            } catch (e) {
                console.error(`❌ Error loading ${file}: ${e.message}`);
            }
        }
    }
    console.log(`🚀 ENGINE: ${client.commands.size} plugins synchronized.`);
};

// Start
