require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, ActivityType } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const client = new Client({
    intents: [3276799] // Enables all necessary intents for your plugins
});

client.commands = new Collection();
const PREFIX = process.env.PREFIX || ',';

// 🤖 AI ENGINE INITIALIZATION
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// 📂 DYNAMIC PLUGIN LOADER
const pluginsPath = path.join(__dirname, 'plugins');
if (!fs.existsSync(pluginsPath)) fs.mkdirSync(pluginsPath);

const pluginFiles = fs.readdirSync(pluginsPath).filter(file => file.endsWith('.js'));
console.log(`📡 Scanning for plugins...`);

for (const file of pluginFiles) {
    try {
        const command = require(`./plugins/${file}`);
        if (command.name) {
            client.commands.set(command.name, command);
            console.log(`✅ Loaded Plugin: ${file}`);
        }
    } catch (error) {
        console.error(`❌ Error loading ${file}:`, error);
    }
}

client.once('ready', () => {
    console.log(`⚡ ${client.user.tag} is online in Bamako!`);
    console.log(`📊 Active Plugins: ${client.commands.size}`);
    client.user.setActivity('over the AES Region', { type: ActivityType.Watching });
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName);

    if (command) {
        try {
            // Pass necessary objects to the plugin
            await command.execute(message, args, client, model);
        } catch (error) {
            console.error(error);
            message.reply('❌ There was an error executing that command.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
