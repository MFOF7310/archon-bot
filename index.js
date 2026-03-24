require('dotenv').config(); 

const fs = require('fs');
const path = require('path');
const { Client, Collection, Events, Partials, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const Groq = require('groq-sdk');
const axios = require('axios');

// --- TERMINAL COLORS ---
const green = "\x1b[32m", blue = "\x1b[34m", cyan = "\x1b[36m", yellow = "\x1b[33m", reset = "\x1b[0m", bold = "\x1b[1m";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

// --- SYSTEM GLOBALS ---
client.commands  = new Collection();
client.aliases   = new Collection();
client.version   = "1.1.0"; 
client.lydiaChannels = {};
client.lastLydiaCall = {};

const PREFIX = process.env.PREFIX || ".";

// --- UTILITIES ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getAccountAge = (createdAt) => {
    const now = new Date();
    const diff = now - createdAt;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 1) return "Joined Today";
    if (days < 30) return `${days} Days ago`;
    const months = Math.floor(days / 30.44);
    if (months < 12) return `${months} Month(s) ago`;
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    return `${years} Year(s), ${remainingMonths} Month(s) ago`;
};

// --- DATABASE ---
const dbPath = path.join(__dirname, 'database.json');
let database = {};
if (fs.existsSync(dbPath)) {
    try {
        database = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch (e) {
        console.log(`${yellow}[WARN]${reset} Database corrupted. Initializing fresh.`);
        database = {};
    }
}
const saveDatabase = () => {
    fs.writeFileSync(dbPath, JSON.stringify(database, null, 2));
};
client.saveDatabase = saveDatabase;

// --- GROQ AI CONFIGURATION ---
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ================= SYSTEM PROMPT FOR LYDIA =================
const LYDIA_SYSTEM_PROMPT = `
You are CLOUD_GAMING-223, the AI assistant of the Cloud Gaming-223 Discord server (ARCHITECT CG-223). 
You're polite, smart, and direct. Keep answers concise but informative.
Owner's GitHub: https://github.com/MFOF7310/cloud-gaming-223-digital-engine
`.trim();

// --- THE LOADER: SMOOTH SYNCHRONIZATION ---
client.loadPlugins = async () => {
    client.commands.clear();
    client.aliases.clear();
    console.log(`\n${blue}${bold}==============================================${reset}`);
    console.log(`${cyan}🛰️  ARCHITECT CG-223 | MODULE SYNCHRONIZATION${reset}`);
    console.log(`${blue}${bold}==============================================${reset}`);

    const pluginPath = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginPath)) fs.mkdirSync(pluginPath);

    const pluginFiles = fs.readdirSync(pluginPath).filter(file => file.endsWith('.js'));
    for (const file of pluginFiles) {
        try {
            // Smooth loading delay (300ms per plugin)
            await sleep(300); 
            
            const filePath = path.join(pluginPath, file);
            delete require.cache[require.resolve(filePath)];
            const command = require(filePath);

            if (command.name && command.run) {
                client.commands.set(command.name, command);
                if (command.aliases && Array.isArray(command.aliases)) {
                    command.aliases.forEach(a => client.aliases.set(a, command.name));
                }
                console.log(`${green}[VERIFIED]${reset} Linked: ${cyan}${command.name.toUpperCase()}${reset}`);
            } else {
                console.log(`${yellow}[SKIPPED]${reset} ${file}: Incomplete Structure.`);
            }
        } catch (error) { 
            console.log(`${blue}[ERROR]${reset} Failed ${file}: ${error.message}`); 
        }
    }
    await sleep(500);
    console.log(`${green}🚀 ENGINE READY | ${client.commands.size} CORE MODULES ONLINE${reset}\n`);
};

// ================= BOOT SEQUENCE =================
client.once(Events.ClientReady, async () => {
    console.clear();
    await client.loadPlugins();
    console.log(`${green}🛰️  CLIENT   : ${client.user.tag}${reset}`);
    console.log(`${green}📍 NODE     : BAMAKO_223${reset}\n`);

    try {
        const owner = await client.users.fetch(process.env.OWNER_ID);
        const alertEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('🦅 ARCHITECT CG-223 // ONLINE')
            .setDescription(`System reboot complete. **${client.commands.size}** modules synced.\nVersion: **${client.version}**\nNode: **BAMAKO_223** 🎮`)
            .setTimestamp();
        await owner.send({ embeds: [alertEmbed] });
    } catch (err) { console.log(`${yellow}[NOTICE]${reset} Owner DM Failed.`); }
});

// ================= BRAVE SEARCH & UTILITIES =================
async function braveSearch(query) {
    try {
        if (!process.env.BRAVE_API_KEY) return null;
        const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
            headers: { 'X-Subscription-Token': process.env.BRAVE_API_KEY },
            params: { q: query, count: 3 }
        });
        return response.data.web?.results.map(r => ({ title: r.title, description: r.description, url: r.url }));
    } catch (e) { return null; }
}

function splitMessage(text, maxLength = 2000) {
    if (text.length <= maxLength) return [text];
    const chunks = [];
    let current = '';
    text.split(/(?<=[.!?])\s+/).forEach(s => {
        if ((current + ' ' + s).length <= maxLength) current += (current ? ' ' : '') + s;
        else { chunks.push(current); current = s; }
    });
    if (current) chunks.push(current);
    return chunks;
}

// ================= ENHANCED LYDIA HANDLER =================
async function handleLydiaRequest(message, userInput) {
    try {
        await message.channel.sendTyping();
        const classification = await groq.chat.completions.create({
            model: 'llama-3.1-8b-instant',
            messages: [{ role: 'system', content: 'Classifier: "yes" if real-time needed, else "no".' }, { role: 'user', content: userInput }],
            max_tokens: 5
        });

        const needsRealTime = classification.choices[0].message.content.trim().toLowerCase() === 'yes';
        let replyContent = '';

        if (needsRealTime) {
            const searchResults = await braveSearch(userInput);
            const context = searchResults?.map(r => `${r.title}\n${r.description}\n${r.url}`).join('\n\n') || "No results.";
            const completion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'system', content: 'You are Lydia. Answer using these search results.' }, { role: 'user', content: `Results: ${context}\n\nQuestion: ${userInput}` }],
            });
            replyContent = completion.choices[0].message.content;
        } else {
            const completion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'system', content: LYDIA_SYSTEM_PROMPT }, { role: 'user', content: userInput }],
            });
            replyContent = completion.choices[0].message.content;
        }

        const chunks = splitMessage(replyContent);
        await message.reply(chunks[0]);
        for (let i = 1; i < chunks.length; i++) await message.channel.send(chunks[i]);
        return true;
    } catch (err) { return false; }
}

// ================= MESSAGE PROCESSING =================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;

    if (!database[userId]) {
        database[userId] = { name: message.author.username, xp: 0, level: 1, gaming: { game: "NOT SET", rank: "Unranked" } };
    }
    database[userId].xp += Math.floor(Math.random() * 21) + 20;
    const newLevel = Math.floor(database[userId].xp / 1000) + 1;

    if (newLevel > database[userId].level) {
        database[userId].level = newLevel;
        message.channel.send(`✨ **SYNC UP:** <@${userId}> reached **Level ${newLevel}**!`)
            .then(m => setTimeout(() => m.delete().catch(() => null), 5000));

        const logChannel = message.guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
        if (logChannel) {
            const lvEmbed = new EmbedBuilder()
                .setColor('#f1c40f').setTitle('🏆 LEVEL UP')
                .setThumbnail(message.author.displayAvatarURL())
                .addFields(
                    { name: 'User', value: `<@${userId}>`, inline: true },
                    { name: 'New Level', value: `\`${newLevel}\``, inline: true }
                ).setTimestamp();
            logChannel.send({ embeds: [lvEmbed] });
        }
    }
    saveDatabase();

    if (client.lydiaChannels && client.lydiaChannels[message.channel.id]) {
        if (message.mentions.has(client.user) || (message.reference && (await message.channel.messages.fetch(message.reference.messageId)).author.id === client.user.id)) {
            const userInput = message.content.replace(/<@!?[0-9]+>/g, '').trim() || 'Hello!';
            await handleLydiaRequest(message, userInput);
            return;
        }
    }

    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const cmdName = args.shift().toLowerCase();
    const command = client.commands.get(cmdName) || client.commands.get(client.aliases.get(cmdName));
    if (command) {
        try { await command.run(client, message, args, database); } 
        catch (e) { message.reply("⚠️ **Command execution failed.**"); }
    }
});

// ================= PROFESSIONAL WELCOME & DM PROTOCOL =================
client.on(Events.GuildMemberAdd, async (member) => {
    if (member.user.bot) return;

    const { WELCOME_CHANNEL_ID, RULES_CHANNEL_ID, GENERAL_CHANNEL_ID, LOG_CHANNEL_ID } = process.env;
    const welcomeChannel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    const logChannel = member.guild.channels.cache.get(LOG_CHANNEL_ID);
    const accountAge = getAccountAge(member.user.createdAt);

    // 1. PUBLIC WELCOME
    if (welcomeChannel) {
        const welcomeEmbed = new EmbedBuilder()
            .setColor('#00d9ff')
            .setAuthor({ name: `CONNECTION ESTABLISHED: ${member.guild.name.toUpperCase()}`, iconURL: member.guild.iconURL() })
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setTitle(`👋 Welcome to the Network, ${member.user.username}!`)
            .setDescription(
                `🎉 **Greetings <@${member.id}>.** You are official **Member #${member.guild.memberCount}**.\n\n` +
                `📊 **Security Check:**\n` +
                `• 🛠️ Account Created: \`${accountAge}\`\n\n` +
                `🚀 **Initialization Protocol:**\n` +
                `• 📜 Review Rules: <#${RULES_CHANNEL_ID}>\n` +
                `• 💬 Main Discussion: <#${GENERAL_CHANNEL_ID}>\n\n` +
                `🤖 Mention **@Lydia** for AI assistance.`
            )
            .setFooter({ text: `ARCHITECT CG-223 | Intelligent System` })
            .setTimestamp();

        welcomeChannel.send({ content: `🎊 Welcome <@${member.id}>!`, embeds: [welcomeEmbed] });
    }

    // 2. REFINED PRIVATE DM LOGIC
    try {
        const dmEmbed = new EmbedBuilder()
            .setColor('#00d9ff')
            .setTitle(`🔒 ENCRYPTED TRANSMISSION: ${member.guild.name.toUpperCase()}`)
            .setThumbnail(member.guild.iconURL())
            .setDescription(
                `Hello **${member.user.username}**, initialization complete.\n\n` +
                `Welcome to the inner circle. To get started, please check the following sectors:\n\n` +
                `📂 **Directives:** <#${RULES_CHANNEL_ID}>\n` +
                `💬 **Hub:** <#${GENERAL_CHANNEL_ID}>\n\n` +
                `*I am ARCHITECT CG-223. Type \`${PREFIX}help\` in the server for my command list.*`
            )
            .setFooter({ text: 'Automated Welcome Protocol' })
            .setTimestamp();

        await member.send({ embeds: [dmEmbed] });
    } catch (e) { 
        console.log(`${yellow}[DM ERROR]${reset} Could not message ${member.user.tag} (Privacy Settings).`); 
    }

    // 3. LOG JOIN
    if (logChannel) {
        const joinLog = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('📥 MEMBER JOINED')
            .addFields(
                { name: 'User', value: `<@${member.id}> (\`${member.id}\`)`, inline: false },
                { name: 'Account Age', value: `\`${accountAge}\``, inline: true }
            )
            .setTimestamp();
        logChannel.send({ embeds: [joinLog] });
    }
});

client.login(process.env.TOKEN);
