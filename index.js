require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, ActivityType, Events, GatewayIntentBits } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { performance } = require('perf_hooks'); 

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ] 
});

client.commands = new Collection();
const PREFIX = process.env.PREFIX || ',';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- 1. PLUGIN LOADER ---
const loadPlugins = () => {
    const startTime = performance.now();
    let loadedCount = 0;
    const pluginsPath = path.join(__dirname, 'plugins');
    
    if (fs.existsSync(pluginsPath)) {
        const pluginFiles = fs.readdirSync(pluginsPath).filter(file => file.endsWith('.js'));
        for (const file of pluginFiles) {
            try {
                const command = require(`./plugins/${file}`);
                if (command.name) {
                    client.commands.set(command.name, command);
                    loadedCount++;
                }
            } catch (e) {}
        }
    }
    const endTime = performance.now();
    console.log(`🚀 DIGITAL ENGINE: ${loadedCount} plugins synchronized in ${(endTime - startTime).toFixed(2)}ms`);
};

// --- 2. MODULE LOADER ---
const loadModules = () => {
    const modulesPath = path.join(__dirname, 'modules');
    if (fs.existsSync(modulesPath)) {
        const moduleFiles = fs.readdirSync(modulesPath).filter(file => file.endsWith('.js'));
        for (const file of moduleFiles) {
            try {
                const moduleRef = require(`./modules/${file}`);
                if (typeof moduleRef === 'function') {
                    moduleRef(client);
                    console.log(`📦 MODULE LOADED: ${file}`);
                }
            } catch (e) {}
        }
    }
};

loadPlugins();
loadModules();

// --- 3. ENGINE START ---
client.once(Events.ClientReady, () => {
    console.log(`🚀 CLOUD GAMING-223 Connected! | Location: Bamako`);
    client.user.setActivity('Cloud Gaming-223', { type: ActivityType.Competing });
});

// --- 4. COMMAND HANDLER ---
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName);
    
    if (!command) return;

    try {
        await command.execute(message, args, client, model); 
    } catch (error) {
        console.error(`❌ Error in ${commandName}:`, error);
    }
});

client.login(process.env.DISCORD_TOKEN);
