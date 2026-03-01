require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, ActivityType, Events, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Setup Client with ALL necessary permissions to prevent "Offline" status
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageMessages
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User] 
});

client.commands = new Collection();
const PREFIX = process.env.PREFIX || ',';
const ARCHITECT_ID = '1284944736620253296'; 

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const loadPlugins = () => {
    const pluginsPath = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginsPath)) return console.log("⚠️ Plugins folder missing!");

    const pluginFiles = fs.readdirSync(pluginsPath).filter(file => file.endsWith('.js'));
    for (const file of pluginFiles) {
        try {
            const fullPath = require.resolve(`./plugins/${file}`);
            delete require.cache[fullPath]; 
            const command = require(`./plugins/${file}`);
            if (command.name) {
                client.commands.set(command.name, command);
            }
        } catch (e) {
            // This prevents one bad plugin from taking the whole bot offline
            console.error(`❌ ERROR IN ${file}:`, e.message);
        }
    }
    console.log(`🚀 ENGINE: ${client.commands.size} plugins active.`);
};

loadPlugins();

client.once(Events.ClientReady, async () => {
    console.log(`✅ ONLINE: ${client.user.tag} is now active.`);
    client.user.setActivity('Cloud Gaming-223', { type: ActivityType.Competing });

    try {
        const architect = await client.users.fetch(ARCHITECT_ID);
        if (architect) {
            const bootEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('🛰️ SYSTEM ONLINE')
                .setDescription(`**V2.6 is live.** Plugins: ${client.commands.size}`)
                .setTimestamp();
            await architect.send({ embeds: [bootEmbed] });
        }
    } catch (err) { console.log("DM Notice: Architect DMs are closed."); }
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
        console.error(`❌ Execution Error [${commandName}]:`, error);
    }
});

// Use this to catch errors that usually crash the console
process.on('unhandledRejection', error => console.error('Unhandled promise rejection:', error));

client.login(process.env.DISCORD_TOKEN);
