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

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages // Needed to send/receive DMs
    ] 
});

client.commands = new Collection();
const PREFIX = process.env.PREFIX || ',';

// AI Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- 1. PLUGIN LOADER ---
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
            console.error(`❌ Error loading ${file}:`, error);
        }
    }

    const endTime = performance.now();
    const totalTime = (endTime - startTime).toFixed(2);
    console.log(`🚀 DIGITAL ENGINE: ${loadedCount} plugins synchronized in ${totalTime}ms`);
};

loadPlugins();

// --- 2. START THE ENGINE & SEND NOTIFICATION ---
client.once(Events.ClientReady, async (c) => {
    console.log(`🚀 CLOUD GAMING-223 Connected! | Location: Bamako`);
    client.user.setActivity('Cloud Gaming-223', { type: ActivityType.Competing });

    // 📩 NEW: Notify Owner via DM
    const OWNER_ID = process.env.OWNER_ID;
    if (OWNER_ID) {
        try {
            const owner = await client.users.fetch(OWNER_ID);
            await owner.send(`🛰️ **Engine Online:** CLOUD GAMING-223 has successfully connected from Bamako.\nTotal Plugins: \`${client.commands.size}\``);
        } catch (err) {
            console.log("⚠️ Could not send login DM to owner (DMs might be closed).");
        }
    }
});

// --- 3. MESSAGE HANDLER ---
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);
    if (!command) return;

    try {
        // Pass everything needed to the plugins
        await command.execute(message, args, client, model); 
    } catch (error) {
        console.error(`❌ Engine Error in [${commandName}]:`, error);
        if (!message.author.bot) {
            message.reply('❌ **System Error:** Module execution failed.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error("❌ Login Failed: Check your DISCORD_TOKEN in the .env file.");
});
