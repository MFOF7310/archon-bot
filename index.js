require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, ActivityType } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Client with all necessary intents
const client = new Client({ 
    intents: [3276799] 
});

client.commands = new Collection();
const PREFIX = process.env.PREFIX || ',';

// Initialize Gemini 2.0 Flash Engine
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

console.log('📡 Connecting to AES Framework...');
console.log('📦 Installing Plugins...');

// 📂 DYNAMIC PLUGIN LOADER (The "Levanter" Way)
const pluginsPath = path.join(__dirname, 'plugins');
if (!fs.existsSync(pluginsPath)) fs.mkdirSync(pluginsPath);

const pluginFiles = fs.readdirSync(pluginsPath).filter(file => file.endsWith('.js'));

for (const file of pluginFiles) {
    try {
        const command = require(`./plugins/${file}`);
        if (command.name) {
            client.commands.set(command.name, command);
            // This creates the list style from your screenshot
            console.log(`  INFO [${new Date().toLocaleTimeString()}] Installed ${command.name}`);
        }
    } catch (error) {
        console.log(`  ERROR [${new Date().toLocaleTimeString()}] Failed: ${file}`);
    }
}

console.log('✅ External Plugins Installed Successfully');

client.once('ready', () => {
    console.log(`\n⚡ ${client.user.tag} is Online!`);
    console.log(`📍 Location: Bamako, Mali`);
    console.log(`📊 Total Modules Loaded: ${client.commands.size}`);
    
    client.user.setActivity('over the AES Region', { type: ActivityType.Watching });
});

client.on('messageCreate', async (message) => {
    // Ignore bots and messages without prefix
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName);

    if (command) {
        try {
            // Execute command and pass Gemini model for AI features
            await command.execute(message, args, client, model);
        } catch (error) {
            console.error(`Execution Error (${commandName}):`, error);
            message.reply('❌ System encountered an error executing this module.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
