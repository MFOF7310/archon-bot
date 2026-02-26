require('dotenv').config();
const { 
    Client, GatewayIntentBits, ActivityType, EmbedBuilder, 
    Collection, Partials 
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

let debugLogs = false; 

// --- CONFIGURATION ---
const PREFIX = (process.env.PREFIX && process.env.PREFIX !== 'null') ? process.env.PREFIX : ',';
const CREATOR_ID = '1284944736620253296'; 
const SOCIALS = {
    tiktok: 'https://www.tiktok.com/@cloudgaming223?_r=1&_t=ZS-94ExHk94xB1',
    instagram: 'https://www.instagram.com/mfof7310?igsh=ZHB2MDJkaGJsNHA5',
    whatsapp: 'https://wa.me/15485200518'
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

// --- 🚀 STARTUP ---
client.once('ready', async (c) => {
    console.log(`✅ ${c.user.tag} Online | Prefix: ${PREFIX} | Bamako: ${getBamakoTime()}`);
    client.user.setActivity('over the AES Region', { type: ActivityType.Watching });
});

// 3. MAIN COMMAND HANDLER
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (debugLogs) {
        console.log(`📩 [LOG] Message: "${message.content}" | Channel: ${message.channel.name || 'DM'}`);
    }

    const isDM = !message.guild;
    const isMentioned = message.content.startsWith(`<@!${client.user.id}>`) || message.content.startsWith(`<@${client.user.id}>`);

    let commandBody = "";
    if (message.content.startsWith(PREFIX)) {
        commandBody = message.content.slice(PREFIX.length);
    } else if (isMentioned || isDM) {
        commandBody = isMentioned ? message.content.split(/ +/).slice(1).join(" ") : message.content;
    } else {
        return;
    }

    const args = commandBody.trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // --- OWNER: LOG TOGGLE ---
    if (commandName === 'logs' && message.author.id === CREATOR_ID) {
        debugLogs = args[0] === 'on';
        return message.reply(`✅ Dashboard logs are now **${debugLogs ? 'ENABLED' : 'DISABLED'}**.`);
    }

    // --- COMMANDS ---

    // 🏓 PING (Latency)
    if (commandName === 'ping' || commandName === 'alive') {
        const msg = await message.reply("🏓 **Pinging...**");
        const latency = msg.createdTimestamp - message.createdTimestamp;
        return msg.edit(`🏓 **Pong!**\n📡 API Latency: \`${client.ws.ping}ms\`\n⏱️ Bot Response: \`${latency}ms\``);
    }

    // 🚀 DASHBOARD
    if (commandName === 'help' || commandName === 'menu') {
        const helpEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🚀 AES Digital Dashboard')
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription('System is operational. Access my socials and AI tools below.')
            .addFields(
                { name: '🛠️ System', value: `Prefix: \`${PREFIX}\`\nTime: \`${getBamakoTime()}\` \nServer Info: \`${PREFIX}server\``, inline: true },
                { name: '🤖 AI Engine', value: `Use \`${PREFIX}gemini\`\nStatus: \`Online\``, inline: true },
                { name: '📱 Social Links', value: `[TikTok](${SOCIALS.tiktok})\n[Instagram](${SOCIALS.instagram})\n[WhatsApp](${SOCIALS.whatsapp})`, inline: false }
            )
            .setFooter({ text: `Owner ID: ${CREATOR_ID}` })
            .setTimestamp();
        
        return message.reply({ embeds: [helpEmbed] });
    }

    // 📊 SERVER INFO
    if (commandName === 'server') {
        if (isDM) return message.reply("This command only works in servers!");
        const { guild } = message;
        const serverEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle(`📊 ${guild.name} Statistics`)
            .setThumbnail(guild.iconURL())
            .addFields(
                { name: 'Members', value: `${guild.memberCount}`, inline: true },
                { name: 'Boosts', value: `${guild.premiumSubscriptionCount || 0}`, inline: true },
                { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true }
            );
        return message.reply({ embeds: [serverEmbed] });
    }

    // 🤖 GEMINI AI
    if (commandName === 'gemini') {
        const prompt = args.join(" ");
        if (!prompt) return message.reply("Ask me anything!");
        const thinking = await message.reply("🤔 **Thinking...**");
        try {
            const result = await model.generateContent(prompt);
            return thinking.edit(result.response.text().substring(0, 2000));
        } catch (e) { return thinking.edit("❌ AI Error."); }
    }
});

client.login(process.env.DISCORD_TOKEN);
