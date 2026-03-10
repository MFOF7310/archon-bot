require('dotenv').config(); 
const fs = require('fs');
const path = require('path');
const { Client, Collection, Events, Partials, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- ANSI COLORS ---
const green = "\x1b[32m";
const blue = "\x1b[34m";
const cyan = "\x1b[36m";
const yellow = "\x1b[33m";
const reset = "\x1b[0m";
const bold = "\x1b[1m";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers, 
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

// --- COMMAND COLLECTION ---
client.commands = new Collection();
const PREFIX = ".";

// --- GEMINI CORE CONFIG ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
client.model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// ================= BOOT SEQUENCE & DYNAMIC LOADER =================
client.once(Events.ClientReady, async () => {
    console.clear();
    console.log(`${blue}${bold}==============================================${reset}`);
    console.log(`${cyan}🛰️  ARCHITECT CG-223 CORE INITIALIZATION...${reset}`);
    console.log(`${blue}${bold}==============================================${reset}\n`);

    const pluginPath = path.join(__dirname, 'plugins');
    let loadedCount = 0;
    let totalFiles = 0;

    if (fs.existsSync(pluginPath)) {
        const pluginFiles = fs.readdirSync(pluginPath).filter(file => file.endsWith('.js'));
        totalFiles = pluginFiles.length;
        
        for (const file of pluginFiles) {
            try {
                // Remove from cache to allow clean reloads
                delete require.cache[require.resolve(`./plugins/${file}`)];
                const command = require(`./plugins/${file}`);
                
                // Support both your "run" and "execute" structures
                if (command.name && (command.execute || command.run)) {
                    client.commands.set(command.name, command);
                    console.log(`${green}[SUCCESS]${reset} Linked Module: ${cyan}${file.toUpperCase()}${reset}`);
                    loadedCount++;
                } else {
                    console.log(`${yellow}[SKIPPED]${reset} Module ${file} is missing structure.`);
                }
            } catch (error) {
                console.log(`${blue}[ERROR]${reset} Failed to link ${file}: ${error.message}`);
            }
            await new Promise(resolve => setTimeout(resolve, 350)); 
        }
    }

    console.log(`\n${blue}${bold}----------------------------------------------${reset}`);
    console.log(`${green}🚀 STATUS   : ONLINE | NODE: BAMAKO_ML${reset}`);
    console.log(`${green}📡 PLUGINS  : ${loadedCount} SUCCESSFUL / ${totalFiles} TOTAL${reset}`);
    console.log(`${green}🛰️  CLIENT   : ${client.user.tag}${reset}`);
    console.log(`${blue}${bold}----------------------------------------------${reset}\n`);

    // --- OWNER DM NOTIFICATION ---
    try {
        const owner = await client.users.fetch(process.env.OWNER_ID);
        const alertEmbed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setAuthor({ name: 'SYSTEM REBOOT SUCCESSFUL', iconURL: client.user.displayAvatarURL() })
            .setTitle('🦅 ARCHITECT CG-223 // ONLINE')
            .setImage('https://cdn.discordapp.com/attachments/1472521219352957092/1480934770648154205/1772389523609.png?ex=69b17b7b&is=69b029fb&hm=c466723a8ab854dd4766e3f36d754bda4c0c96977b3747ff2d584cc0c4c45eec&')
            .setDescription(`Neural link established. **${loadedCount}** modules have been synced to the core. Monitoring **Bamako_Node**.`)
            .setFooter({ text: `Eagle Community OS | Status: Secured` });

        await owner.send({ embeds: [alertEmbed] });
    } catch (err) {
        console.log(`${yellow}[NOTICE]${reset} Owner DM could not be delivered.`);
    }
});

// ================= DYNAMIC INTELLIGENT WELCOME =================
async function sendWelcome(member) {
    const channelId = process.env.WELCOME_CHANNEL_ID;
    const channel = member.guild.channels.cache.get(channelId);
    if (!channel) return;

    try {
        const prompt = `You are Architect CG-223. Write a prestigious welcome for ${member.user.username} joining Eagle Community. Max 2 sentences. Use tech emojis like 🦅, 🛰️, 🛡️. Tone: Prestigious and welcoming.`;
        const result = await client.model.generateContent(prompt);
        const aiResponse = result.response.text();

        const welcomeEmbed = new EmbedBuilder()
            .setColor('#2b2d31') 
            .setAuthor({ name: 'ARCHITECT CG-223 // ACCESS GRANTED', iconURL: client.user.displayAvatarURL() })
            .setThumbnail(member.user.displayAvatarURL({ size: 512 }))
            .setDescription(`\n${aiResponse.trim()}\n\n\`SYSTEM: [ ████████████ ] 100% Sync\``)
            .addFields(
                { name: '👤 ENTITY', value: `\`${member.user.username}\``, inline: true },
                { name: '📍 NODE', value: `\`BAMAKO_ML\``, inline: true },
                { name: '🛡️ SECURITY', value: `\`LEVEL_4_CLEARED\``, inline: true }
            )
            .setFooter({ text: `Eagle Community • Signal: Verified`, iconURL: member.guild.iconURL() })
            .setTimestamp();

        await channel.send({ 
            content: `🦅 **New signature detected: <@${member.user.id}>**`, 
            embeds: [welcomeEmbed] 
        });
    } catch (err) {
        console.error(`${blue}[ERROR]${reset} AI Welcome failed:`, err.message);
    }
}

client.on(Events.GuildMemberAdd, async (member) => {
    await sendWelcome(member);
});

// ================= MESSAGE HANDLING (PLUGIN ENGINE) =================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // Internal Test Command
    if (commandName === "testwelcome" && message.author.id === process.env.OWNER_ID) {
        return sendWelcome(message.member);
    }

    // Plugin Execution
    const command = client.commands.get(commandName);
    if (!command) return;

    try {
        // Execute using whichever method the plugin provides (run or execute)
        if (command.run) {
            await command.run(client, message, args);
        } else if (command.execute) {
            await command.execute(message, args);
        }
    } catch (error) {
        console.error(error);
        message.reply("⚠️ System error during command execution.");
    }
});

client.login(process.env.TOKEN);
