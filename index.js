require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { 
    Client, GatewayIntentBits, ActivityType, EmbedBuilder, 
    ActionRowBuilder, StringSelectMenuBuilder, Collection, Partials 
} = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 1. CLIENT SETUP
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.DirectMessages 
    ],
    partials: [Partials.Channel, Partials.Message] 
});

client.commands = new Collection();
let debugLogs = false; // Toggle for console logging

// --- CONFIGURATION ---
const PREFIX = (process.env.PREFIX && process.env.PREFIX !== 'null') ? process.env.PREFIX : ',';
const CREATOR_ID = '1284944736620253296'; 
const MY_SOCIALS = {
    tiktok:'https://www.tiktok.com/@cloudgaming223?_r=1&_t=ZS-94ExHk94xB1',
    instagram:'https://www.instagram.com/mfof7310?igsh=ZHB2MDJkaGJsNHA5',
    facebook:'https://www.facebook.com/share/16q67Ar7FP/',
    whatsapp:'https://wa.me/15485200518'
};

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

// --- 🚀 STARTUP ---
client.once('ready', async (c) => {
    console.log(`✅ ${c.user.tag} Online | Prefix: ${PREFIX} | Bamako: ${getBamakoTime()}`);
    client.user.setActivity('over the AES Region', { type: ActivityType.Watching });

    try {
        const creator = await client.users.fetch(CREATOR_ID);
        const welcomeEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🛡️ AES Framework: Deployment Successful')
            .setDescription(`Greetings, Boss! Your bot is active.\n\n**Quick Access:**\n[TikTok](${MY_SOCIALS.tiktok}) | [Instagram](${MY_SOCIALS.instagram})\n[WhatsApp](${MY_SOCIALS.whatsapp})`)
            .setTimestamp();

        await creator.send({ embeds: [welcomeEmbed] });
        console.log("✉️ Startup DM sent to Creator.");
    } catch (err) {
        console.log("❌ DM Failed. Check intents.");
    }
});

// 4. MAIN COMMAND HANDLER
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Optional Logger (Only runs if you turn it on)
    if (debugLogs) {
        console.log(`📩 [LOG] Message: "${message.content}" | Channel: ${message.channel.name || 'DM'}`);
    }

    const isDM = !message.guild;
    const isMentioned = message.content.startsWith(`<@!${client.user.id}>`) || message.content.startsWith(`<@${client.user.id}>`);

    let commandBody = "";
    if (message.content.startsWith(PREFIX)) {
        commandBody = message.content.slice(PREFIX.length);
    } else if (isMentioned) {
        commandBody = message.content.split(/ +/).slice(1).join(" ");
    } else if (isDM) {
        commandBody = message.content;
    } else {
        return;
    }

    const args = commandBody.trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // --- OWNER COMMAND: TOGGLE LOGS ---
    if (commandName === 'logs' && message.author.id === CREATOR_ID) {
        const action = args[0] === 'on';
        debugLogs = action;
        return message.reply(`✅ Console logging is now **${action ? 'ENABLED' : 'DISABLED'}**.`);
    }

    // --- CORE COMMANDS ---
    if (commandName === 'ping' || commandName === 'alive') {
        return message.reply(`🏓 Pong! System active in Bamako (\`${getBamakoTime()}\`)`);
    }

    if (commandName === 'help' || commandName === 'menu') {
        const helpEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🚀 AES Dashboard')
            .setDescription(`Prefix: \`${PREFIX}\` | AI: \`,gemini\``)
            .setFooter({ text: `Owner ID: ${CREATOR_ID}` });
        return message.reply({ embeds: [helpEmbed] });
    }

    if (commandName === 'gemini') {
        const prompt = args.join(" ");
        if (!prompt) return message.reply("Ask a question!");
        const thinking = await message.reply("🤔 **Thinking...**");
        try {
            const result = await model.generateContent(prompt);
            return thinking.edit(result.response.text().substring(0, 2000));
        } catch (e) { return thinking.edit("❌ AI Error."); }
    }

    // --- PLUGIN LOADER ---
    const pluginCommand = client.commands.get(commandName);
    if (pluginCommand) {
        try {
            return await pluginCommand.execute(message, args, client);
        } catch (err) { console.error(err); }
    }
});

client.login(process.env.DISCORD_TOKEN);
