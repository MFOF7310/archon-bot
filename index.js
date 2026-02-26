require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, ActivityType } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const client = new Client({ intents: [3276799] });
client.commands = new Collection();
const PREFIX = process.env.PREFIX || ',';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

console.log('📡 Connecting to AES Framework...');
console.log('📦 Installing Plugins...');

const pluginsPath = path.join(__dirname, 'plugins');
if (!fs.existsSync(pluginsPath)) fs.mkdirSync(pluginsPath);

const pluginFiles = fs.readdirSync(pluginsPath).filter(file => file.endsWith('.js'));

for (const file of pluginFiles) {
    try {
        const commandFile = require(`./plugins/${file}`); // Changed variable name to avoid conflict
        if (commandFile.name) {
            client.commands.set(commandFile.name, commandFile);
            const timestamp = new Date().toLocaleTimeString('en-GB', { hour12: false }) + ' ' + new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
            console.log(`  INFO [${timestamp}]: Installed ${commandFile.name}`);
        }
    } catch (error) {
        console.log(`  ERROR: Failed to load ${file}`);
    }
}

console.log('✅ External Plugins Installed Successfully');

client.once('ready', () => {
    console.log(`\n🚀 ${client.user.tag} is Online in Bamako!`);
    client.user.setActivity('over the AES Region', { type: ActivityType.Watching });
});

// ⚡ THIS SECTION WAS CAUSING THE ERROR
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    
    // We define 'command' here so the bot knows what it is
    const command = client.commands.get(commandName);

    if (command) {
        try {
            await command.execute(message, args, client, model);
        } catch (error) {
            console.error(error);
            message.reply('❌ Error executing this module.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
