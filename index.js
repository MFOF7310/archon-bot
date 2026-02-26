require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { 
    Client, GatewayIntentBits, ActivityType, EmbedBuilder, 
    ActionRowBuilder, StringSelectMenuBuilder, Collection, Partials 
} = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 1. CLIENT SETUP WITH INTENTS & PARTIALS
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, // CRITICAL: Must be ON in Dev Portal
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.DirectMessages 
    ],
    partials: [Partials.Channel, Partials.Message] 
});

client.commands = new Collection();

// --- CONFIGURATION ---
const PREFIX = process.env.PREFIX || ',';
const CREATOR_ID = '1284944736620253296'; 
const MY_SOCIALS = {
    tiktok: 'https://www.tiktok.com/@cloudgaming223?_r=1&_t=ZS-94ExHk94xB1',
    instagram: 'https://www.instagram.com/mfof7310?igsh=ZHB2MDJkaGJsNHA5',
    facebook: 'https://www.facebook.com/share/16q67Ar7FP/',
    whatsapp: 'https://wa.me/15485200518'
};

// --- SYSTEM UTILS ---
const getBamakoTime = () => {
    return new Date().toLocaleTimeString('en-GB', { 
        timeZone: 'Africa/Bamako', 
        hour: '2-digit', 
        minute: '2-digit' 
    });
};

// 2. AI INITIALIZATION
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "EMPTY");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// 3. PLUGIN LOADER
const pluginsPath = path.join(__dirname, 'plugins');
if (!fs.existsSync(pluginsPath)) fs.mkdirSync(pluginsPath);
const pluginFiles = fs.readdirSync(pluginsPath).filter(file => file.endsWith('.js'));

for (const file of pluginFiles) {
    try {
        const imported = require(`./plugins/${file}`);
        if (Array.isArray(imported)) {
            imported.forEach(cmd => { if (cmd.name) client.commands.set(cmd.name, cmd); });
        } else if (imported.name) {
            client.commands.set(imported.name, imported);
        }
    } catch (e) { console.error(`Failed to load ${file}`); }
}

// --- 🚀 STARTUP BROADCAST ---
client.once('ready', async (c) => {
    console.log(`✅ ${c.user.tag} Online | Prefix: ${PREFIX} | Bamako: ${getBamakoTime()}`);
    client.user.setActivity('over the AES Region', { type: ActivityType.Watching });

    try {
        const creator = await client.users.fetch(CREATOR_ID);
        const welcomeEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🛡️ AES Framework: Deployment Successful')
            .setDescription(`Greetings, Boss! Your bot is active.\n\n**Quick Access:**\n[TikTok](${MY_SOCIALS.tiktok}) | [Instagram](${MY_SOCIALS.instagram})\n[WhatsApp](${MY_SOCIALS.whatsapp})`)
            .addFields({ name: '🇲🇱 Time In Bamako', value: `\`${getBamakoTime()}\`` })
            .setTimestamp();

        await creator.send({ embeds: [welcomeEmbed] });
        console.log("✉️ Startup DM sent to Creator.");
    } catch (err) {
        console.log("❌ DM Failed. Ensure 'Server Members Intent' is ON.");
    }
});

// 4. MAIN COMMAND HANDLER (With Debugger)
client.on('messageCreate', async (message) => {
    // 🔍 CONSOLE DEBUGGER: Tells us what the bot "sees"
    if (!message.author.bot) {
        console.log(`📩 [LOG] Message: "${message.content}" | Channel: ${message.channel.name || 'DM'}`);
    }

    if (message.author.bot) return;

    const isDM = !message.guild;
    const isMentioned = message.content.startsWith(`<@!${client.user.id}>`) || message.content.startsWith(`<@${client.user.id}>`);

    // --- PREFIX LOGIC ---
    let commandBody = message.content;
    if (PREFIX !== 'NONE' && message.content.startsWith(PREFIX)) {
        commandBody = message.content.slice(PREFIX.length);
    } else if (isMentioned || isDM) {
        // Allow mentions or DMs to skip prefix
        commandBody = isMentioned ? message.content.split(/ +/).slice(1).join(" ") : message.content;
    } else {
        return; // Ignore message
    }

    const args = commandBody.trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // --- CORE COMMANDS ---
    
    // Help / Menu
    if (commandName === 'help' || commandName === 'menu') {
        const helpEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🚀 AES Dashboard')
            .setDescription(`Prefix: \`${PREFIX}\` | Active Plugins: \`${client.commands.size}\``);
        return message.reply({ embeds: [helpEmbed] });
    }

    // Ping
    if (commandName === 'ping') {
        return message.reply(`🏓 Pong! Latency: ${client.ws.ping}ms`);
    }

    // Gemini AI
    if (commandName === 'gemini') {
        const prompt = args.join(" ");
        if (!prompt) return message.reply("What is your question?");
        const thinking = await message.reply("🤔 **Thinking...**");
        try {
            const result = await model.generateContent(prompt);
            return thinking.edit(result.response.text().substring(0, 2000));
        } catch (e) { return thinking.edit("❌ AI Error. Check API Key."); }
    }

    // --- PLUGIN LOADER ---
    const pluginCommand = client.commands.get(commandName);
    if (pluginCommand) {
        try {
            return await pluginCommand.execute(message, args, client);
        } catch (err) { console.error(`Plugin Error: ${err}`); }
    }
});

client.login(process.env.DISCORD_TOKEN);
