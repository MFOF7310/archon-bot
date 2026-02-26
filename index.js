require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { 
    Client, GatewayIntentBits, ActivityType, EmbedBuilder, 
    ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits, Collection,
    Partials 
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

// --- 🚀 STARTUP BROADCAST (The Creator Signature) ---
client.once('ready', async (c) => {
    console.log(`✅ ${c.user.tag} is Live! | Prefix: ${PREFIX} | Bamako: ${getBamakoTime()}`);
    client.user.setActivity('over the AES Region', { type: ActivityType.Watching });

    try {
        const creator = await client.users.fetch(CREATOR_ID);
        const welcomeEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🛡️ AES Framework: Deployment Successful')
            .setDescription(`Greetings, Boss! A new instance of your bot is active.\n\n**Quick Access to Your Socials:**\n[TikTok](${MY_SOCIALS.tiktok}) | [Instagram](${MY_SOCIALS.instagram})\n[Facebook](${MY_SOCIALS.facebook}) | [WhatsApp](${MY_SOCIALS.whatsapp})`)
            .addFields({ name: '🇲🇱 Time In Bamako', value: `\`${getBamakoTime()}\`` })
            .setFooter({ text: 'AES Digital Assistant v2.0' })
            .setTimestamp();

        await creator.send({ embeds: [welcomeEmbed] });
        console.log("✉️ Startup DM sent to Creator.");
    } catch (err) {
        console.log("❌ DM Failed. Check 'Server Members Intent' in Dev Portal.");
    }
});

// 4. MAIN COMMAND HANDLER (DMs & Servers)
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const isDM = !message.guild;
    const isMentioned = message.content.startsWith(`<@!${client.user.id}>`) || message.content.startsWith(`<@${client.user.id}>`);

    // Handle Prefix logic (Support for Null/None Prefix)
    let commandBody = message.content;
    if (PREFIX !== 'NONE' && message.content.startsWith(PREFIX)) {
        commandBody = message.content.slice(PREFIX.length);
    } else if (PREFIX !== 'NONE' && !isMentioned && !isDM) {
        return; // No prefix found in server
    }

    const args = commandBody.trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // 📩 GLOBAL DM & SERVER HELP
    if (commandName === 'help' || commandName === 'menu') {
        const helpEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle(isDM ? '📂 AES Global Assistant' : '🚀 AES Region Dashboard')
            .setDescription(isDM ? 'I am your portable AI assistant.' : `Welcome **${message.author.username}**!`)
            .addFields(
                { name: '🤖 AI Chat', value: `\`${PREFIX}gemini [prompt]\``, inline: true },
                { name: '⚙️ Utilities', value: '`,ping`, `,weather`, `,status`', inline: true },
                { name: '📱 Socials', value: '`,socials`', inline: true }
            )
            .setFooter({ text: `Prefix: ${PREFIX} | Plugins: ${client.commands.size}` });

        return message.reply({ embeds: [helpEmbed] });
    }

    // 🤖 GEMINI AI COMMAND
    if (commandName === 'gemini') {
        const prompt = args.join(" ");
        if (!prompt) return message.reply("What would you like to ask?");
        const thinking = await message.reply("🤔 **Thinking...**");
        try {
            const result = await model.generateContent(prompt);
            return thinking.edit(result.response.text().substring(0, 2000));
        } catch (e) { return thinking.edit("❌ AI Error: Check API Key."); }
    }

    // EXECUTE PLUGINS (Weather, Translation, etc.)
    const pluginCommand = client.commands.get(commandName);
    if (pluginCommand) {
        try {
            return await pluginCommand.execute(message, args, client);
        } catch (err) { console.error(err); }
    }
});

client.login(process.env.DISCORD_TOKEN);
