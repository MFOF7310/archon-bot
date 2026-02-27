require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, ActivityType, Events } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { performance } = require('perf_hooks'); 

/**
 * 🎮 CLOUD GAMING-223 | DIGITAL ENGINE
 * Modular Version 2.5 - Performance Optimized
 */

const client = new Client({ intents: [3276799] });
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
            const command = require(`./plugins/${file}`);
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
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);
    if (!command) return;

    try {
        // 🔥 CRITICAL FIX: Added 'client' here so plugins can send 
        // notifications, check pings, and access the bot's core.
        await command.execute(message, args, client); 
    } catch (error) {
        console.error(`❌ Error in ${commandName}:`, error);
        message.reply('❌ System error executing that command.');
    }
});

client.login(process.env.DISCORD_TOKEN);
