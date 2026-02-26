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

// 📂 PLUGIN LOADER: This is the ONLY thing index.js should do
const pluginsPath = path.join(__dirname, 'plugins');
if (!fs.existsSync(pluginsPath)) fs.mkdirSync(pluginsPath);

const pluginFiles = fs.readdirSync(pluginsPath).filter(file => file.endsWith('.js'));
for (const file of pluginFiles) {
    const command = require(`./plugins/${file}`);
    if (command.name) client.commands.set(command.name, command);
}

client.once('ready', () => {
    console.log(`✅ ${client.user.tag} Online | Bamako Time: ${new Date().toLocaleTimeString()}`);
    client.user.setActivity('over the AES Region', { type: ActivityType.Watching });
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName);

    if (command) {
        try {
            // Passes the message, args, and the AI model to your plugins
            await command.execute(message, args, client, model);
        } catch (e) { console.error(e); }
    }
});

client.login(process.env.DISCORD_TOKEN);
