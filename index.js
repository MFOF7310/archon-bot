require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, ActivityType, Events, GatewayIntentBits } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { performance } = require('perf_hooks'); 

/**
 * 🎮 CLOUD GAMING-223 | DIGITAL ENGINE
 * Modular Version 2.5 - Performance Optimized
 * Location: Bamako, Mali 🇲🇱
 */

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

// AI Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- 1. PLUGIN LOADER (Commands) ---
const loadPlugins = () => {
    const startTime = performance.now();
    let loadedCount = 0;

    const pluginsPath = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginsPath)) fs.mkdirSync(pluginsPath);

    const pluginFiles = fs.readdirSync(pluginsPath).filter(file => file.endsWith('.js'));
    
    for (const file of pluginFiles) {
        try {
            const filePath = `./plugins/${file}`;
            delete require.cache[require.resolve(filePath)]; 
            const command = require(filePath);
            
            if (command.name) {
                client.commands.set(command.name, command);
                loadedCount++;
            }
        } catch (error) {
            console.error(`❌ Error loading plugin ${file}:`, error);
        }
    }

    const endTime = performance.now();
    console.log(`🚀 DIGITAL ENGINE: ${loadedCount} plugins synchronized in ${(endTime - startTime).toFixed(2)}ms`);
};

// --- 2. MODULE LOADER (Background Tasks) ---
const loadModules = () => {
    const modulesPath = path.join(__dirname, 'modules');
    if (!fs.existsSync(modulesPath)) fs.mkdirSync(modulesPath);

    const moduleFiles = fs.readdirSync(modulesPath).filter(file => file.endsWith('.js'));
    
    for (const file of moduleFiles) {
        try {
            const moduleRef = require(`./modules/${file}`);
            // If the module is a function, we execute it and pass 'client'
            if (typeof moduleRef === 'function') {
                moduleRef(client);
            } else if (moduleRef.execute) {
                moduleRef.execute(client);
            }
            console.log(`📦 MODULE LOADED: ${file}`);
        } catch (error) {
            console.error(`❌ Error loading module ${file}:`, error);
        }
    }
};

// Execute Loaders
loadPlugins();
loadModules();

// --- 3. START THE ENGINE ---
client.once(Events.ClientReady, async () => {
    console.log(`🚀 CLOUD GAMING-223 Connected! | Location: Bamako`);
    client.user.setActivity('Cloud Gaming-223', { type: ActivityType.Competing });

    // Boot Notification Logic
    const OWNER_ID = process.env.OWNER_ID;
    if (OWNER_ID) {
        try {
            const owner = await client.users.fetch(OWNER_ID);
            await owner.send(`🛰️ **Engine Online:** CLOUD GAMING-223 has successfully connected from Bamako.\nTotal Plugins: \`${client.commands.size}\``);
        } catch (err) {
            console.log("⚠️ Could not send login DM to owner.");
        }
    }
});

// --- 4. MESSAGE HANDLER ---
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);
    if (!command) return;

    try {
        await command.execute(message, args, client, model); 
    } catch (error) {
        console.error(`❌ Engine Error in [${commandName}]:`, error);
        if (!message.author.bot) {
            message.reply('❌ **System Error:** Module execution failed.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error("❌ Login Failed: Check your DISCORD_TOKEN.");
});
