require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, ActivityType } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * 🎮 CLOUD GAMING-223 | DIGITAL ENGINE
 * Modular Version 2.0 - Ultra Clean
 */

const client = new Client({ intents: [3276799] });
client.commands = new Collection();
const PREFIX = process.env.PREFIX || ',';

// AI Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- 1. PLUGIN LOADER ---
const pluginsPath = path.join(__dirname, 'plugins');
const pluginFiles = fs.readdirSync(pluginsPath).filter(file => file.endsWith('.js'));
for (const file of pluginFiles) {
    const command = require(`./plugins/${file}`);
    if (command.name) client.commands.set(command.name, command);
}

// --- 2. START THE ENGINE ---
client.once('ready', async () => {
    console.log(`🚀 CLOUD GAMING-223 Connected! | Location: Bamako`);
    client.user.setActivity('Cloud Gaming-223', { type: ActivityType.Watching });

    // Load Specialized Modules
    require('./modules/tiktok_monitor.js')(client);
    require('./modules/boot_notification.js')(client);
});

// --- 3. MESSAGE HANDLER ---
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName);

    if (command) {
        try {
            await command.execute(message, args, client, model);
        } catch (error) {
            console.error(error);
            message.reply('❌ Execution error.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
