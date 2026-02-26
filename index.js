require('dotenv').config();

const fs = require('fs');

const path = require('path');

const { 

    Client, GatewayIntentBits, ActivityType, EmbedBuilder, 

    ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits, Collection 

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

    ]

});

client.commands = new Collection();

const PREFIX = ',';

// --- SYSTEM UTILS ---

const getBamakoTime = () => {

    return new Date().toLocaleTimeString('en-GB', { 

        timeZone: 'Africa/Bamako', 

        hour: '2-digit', 

        minute: '2-digit', 

        second: '2-digit' 

    });

};

const getFullUptime = () => {

    let totalSeconds = process.uptime();

    let days = Math.floor(totalSeconds / 86400);

    totalSeconds %= 86400;

    let hours = Math.floor(totalSeconds / 3600);

    totalSeconds %= 3600;

    let minutes = Math.floor(totalSeconds / 60);

    let seconds = Math.floor(totalSeconds % 60);

    return `${days}d ${hours}h ${minutes}m ${seconds}s`;

};

const getRAM = () => {

    const usage = process.memoryUsage().heapUsed / 1024 / 1024;

    return `${usage.toFixed(2)} MB`;

};

// 2. AI INITIALIZATION

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "EMPTY");

const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// 3. UNIVERSAL PLUGIN LOADER

// This section is now ready to accept ANY plugin file you create in the /plugins folder

const pluginsPath = path.join(__dirname, 'plugins');

if (!fs.existsSync(pluginsPath)) fs.mkdirSync(pluginsPath);

const pluginFiles = fs.readdirSync(pluginsPath).filter(file => file.endsWith('.js'));

for (const file of pluginFiles) {

    try {

        const imported = require(`./plugins/${file}`);

        

        // Supports: module.exports = [{...}, {...}] (Array)

        if (Array.isArray(imported)) {

            imported.forEach(cmd => {

                if (cmd.name) client.commands.set(cmd.name, cmd);

            });

        } 

        // Supports: module.exports = { name: '...', execute... } (Object)

        else if (imported.name) {

            client.commands.set(imported.name, imported);

        }

        console.log(`✅ Plugin Loaded: ${file}`);

    } catch (error) {

        console.error(`❌ Failed to load ${file}:`, error);

    }

}

client.once('ready', (c) => {

    console.log(`🚀 ${c.user.tag} Online | Bamako: ${getBamakoTime()} | Node: Mali`);

    client.user.setActivity('over the AES Region', { type: ActivityType.Watching });

});

// 4. MAIN COMMAND HANDLER

client.on('messageCreate', async (message) => {

    if (message.author.bot || !message.guild || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);

    const commandName = args.shift().toLowerCase();

    // EXECUTE PLUGIN COMMANDS

    const pluginCommand = client.commands.get(commandName);

    if (pluginCommand) {

        try {

            return await pluginCommand.execute(message, args, client);

        } catch (err) {

            console.error(err);

            return message.reply("❌ There was an error executing that plugin command.");

        }

    }

    // --- GEMINI AI ---

    if (commandName === 'gemini') {

        const prompt = args.join(" ");

        if (!prompt) return message.reply("Ask me something!");

        const thinking = await message.reply("🤔 **Thinking...**");

        try {

            const result = await model.generateContent(prompt);

            return thinking.edit(result.response.text().substring(0, 2000));

        } catch (e) {

            return thinking.edit(`❌ AI Error: ${e.message}`);

        }

    }

    // --- ADVANCED MENU ---

    if (commandName === 'help' || commandName === 'menu') {

        const helpEmbed = new EmbedBuilder()

            .setColor('#ff0000')

            .setTitle('🚀 Malian Discord Dashboard')

            .setThumbnail(client.user.displayAvatarURL())

            .setDescription(`Welcome **${message.author.username}**! Here is my status in **Mali**:`)

            .addFields(

                { name: '🇲🇱 Bamako Time', value: `\`${getBamakoTime()}\``, inline: true },

                { name: '📊 RAM Usage', value: `\`${getRAM()}\``, inline: true },

                { name: '⏱️ Total Uptime', value: `\`${getFullUptime()}\``, inline: false }

            )

            .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() });

        const menuRow = new ActionRowBuilder().addComponents(

            new StringSelectMenuBuilder()

                .setCustomId('help_select')

                .setPlaceholder('Choose a category...')

                .addOptions([

                    { label: 'DASHBOARD', value: 'home', emoji: '🏠' },

                    { label: 'AI COMMANDS', value: 'ai', emoji: '🤖' },

                    { label: 'UTILITY', value: 'util', emoji: '⚙️' },

                    { label: 'MODERATION', value: 'mod', emoji: '🛠️' }

                ])

        );

        return message.reply({ embeds: [helpEmbed], components: [menuRow] });

    }

    // --- ALIVE ---

    if (commandName === 'alive' || commandName === 'status') {

        const aliveEmbed = new EmbedBuilder()

            .setColor('#00FF00')

            .setTitle('🟢 System Status')

            .addFields(

                { name: '🇲🇱 Bamako', value: `\`${getBamakoTime()}\``, inline: true },

                { name: '⏱️ Uptime', value: `\`${getFullUptime()}\``, inline: true },

                { name: '📊 RAM', value: `\`${getRAM()}\``, inline: true },

                { name: '📡 Ping', value: `\`${client.ws.ping}ms\``, inline: true }

            );

        return message.reply({ embeds: [aliveEmbed] });

    }

    // --- PING & CLEAR ---

    if (commandName === 'ping') return message.reply(`🏓 **Pong! Response time** \`${client.ws.ping}ms\``);

    

    if (commandName === 'clear') {

        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return message.reply("❌ No permission.");

        const amount = parseInt(args[0]);

        if (isNaN(amount) || amount < 1 || amount > 99) return message.reply("Give a number 1-99.");

        await message.channel.bulkDelete(amount + 1, true);

        const msg = await message.channel.send(`✅ Cleared ${amount} messages.`);

        setTimeout(() => msg.delete(), 3000);

    }

});

// 5. INTERACTION HANDLER

client.on('interactionCreate', async (i) => {

    if (!i.isStringSelectMenu() || i.customId !== 'help_select') return;

    if (i.values[0] === 'home') {

        const homeEmbed = new EmbedBuilder()

            .setColor('#ff0000')

            .setTitle('🚀 Malian Discord Dashboard')

            .addFields(

                { name: '🇲🇱 Bamako', value: `\`${getBamakoTime()}\``, inline: true },

                { name: '📊 RAM', value: `\`${getRAM()}\``, inline: true },

                { name: '⏱️ Uptime', value: `\`${getFullUptime()}\``, inline: false }

            );

        return await i.update({ embeds: [homeEmbed] });

    }

    let list = '';

    let title = '';

    if (i.values[0] === 'ai') { title = '🤖 AI COMMANDS'; list = '`,gemini [text]`\n`,menu [cmd]`'; }

    if (i.values[0] === 'util') { title = '⚙️ UTILITY'; list = '`,ping`, `,alive`, `,userinfo`, `,serverinfo`'; }

    if (i.values[0] === 'mod') { title = '🛠️ MODERATION'; list = '`,clear [num]`'; }

    const updateEmbed = new EmbedBuilder().setColor('#ff0000').setTitle(title).setDescription(list);

    await i.update({ embeds: [updateEmbed] });

});

client.login(process.env.DISCORD_TOKEN);

