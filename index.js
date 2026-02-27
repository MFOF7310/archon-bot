require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, ActivityType, Events, GatewayIntentBits } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { performance } = require('perf_hooks'); 

/**
 * 🎮 CLOUD GAMING-223 | DIGITAL ENGINE
 * Modular Version 2.5 - Performance Optimized
 */

// 1. INTENTS FIX: Bitmask 3276799 is broad, but explicit naming is safer for some hosts
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

// 2. AI Setup - Preparing the model to be passed if needed
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- 1. PLUGIN LOADER ---
const loadPlugins = () => {
    const startTime = performance.now();
    let loadedCount = 0;

    const pluginsPath = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginsPath)) fs.mkdirSync(pluginsPath);

    const pluginFiles = fs.readdirSync(pluginsPath).filter(file => file.endsWith('.js'));
    
    // Clear cache before loading to ensure clean deployments
    for (const file of pluginFiles) {
        try {
            const filePath = `./plugins/${file}`;
            delete require.cache[require.resolve(filePath)]; // Refreshes code on restart
            const command = require(filePath);
            
            if (command.name) {
                client.commands.set(command.name, command);
                loadedCount++;
            }
        } catch (error) {
            console.error(`❌ Error loading ${file}:`, error);
        }
    }

    const endTime = performance.now();
    const totalTime = (endTime - startTime).toFixed(2);
    console.log(`🚀 DIGITAL ENGINE: ${loadedCount} plugins synchronized in ${totalTime}ms`);
};

loadPlugins();

// --- 2. START THE ENGINE ---
client.once(Events.ClientReady, (c) => {
    console.log(`🚀 CLOUD GAMING-223 Connected! | Location: Bamako`);
    client.user.setActivity('Cloud Gaming-223', { type: ActivityType.Competing });
});

// --- 3. MESSAGE HANDLER ---
client.on(Events.MessageCreate, async (message) => {
    // Basic checks
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // Find the command by name OR alias (if you add aliases later)
    const command = client.commands.get(commandName);
    if (!command) return;

    try {
        /**
         * ⚡ THE MULTI-PASS
         * We pass 'message', 'args', 'client', AND 'model' (for vision)
         * This ensures all 20 plugins have everything they need.
         */
        await command.execute(message, args, client, model); 
    } catch (error) {
        console.error(`❌ Engine Error in [${commandName}]:`, error);
        // Only reply if it's a real error, not a missing permission
        if (message.editable) {
            message.reply('❌ **System Error:** Module execution failed. Check console.');
        }
    }
});

// 3. TOKEN CHECK: Changed to DISCORD_TOKEN to match your login line
client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error("❌ Login Failed: Check your DISCORD_TOKEN in the .env file.");
});
