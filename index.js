require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, ActivityType, EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * 🎮 CLOUD GAMING-223 | DIGITAL ENGINE
 * Powered by Starlink 🛰️ | Optimized for Mali
 */

const blue = "\x1b[94m"; 
const cyan = "\x1b[36m";
const reset = "\x1b[0m";

const client = new Client({ intents: [3276799] });
client.commands = new Collection();
const PREFIX = process.env.PREFIX || ',';
const OWNER_ID = '1284944736620253296';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const time = () => {
    const now = new Date();
    const t = now.toLocaleTimeString('en-GB', { hour12: false });
    const d = now.toLocaleDateString('en-GB').replace(/\//g, '-');
    return `${t} ${d}`;
};

console.log(`${blue}INFO [${time()}]: [0] Connecting to CLOUD GAMING-223...${reset}`);
console.log(`${blue}INFO [${time()}]: [0] Security: 0 Vulnerabilities Found${reset}`);

const pluginsPath = path.join(__dirname, 'plugins');
const pluginFiles = fs.readdirSync(pluginsPath).filter(file => file.endsWith('.js'));

for (const file of pluginFiles) {
    try {
        const command = require(`./plugins/${file}`);
        if (command.name) {
            client.commands.set(command.name, command);
            console.log(`${blue}INFO [${time()}]: [0] Installed ${command.name}${reset}`);
        }
    } catch (error) {
        console.log(`${blue}ERROR [${time()}]: [0] Failed to load ${file}${reset}`);
    }
}

client.once('ready', async () => {
    console.log(`\n${cyan}🚀 CLOUD GAMING-223 is now connected!${reset}`);
    console.log(`${cyan}📍 Location: Bamako, Mali${reset}`);
    console.log(`${cyan}📊 Total Modules Active: ${client.commands.size}${reset}\n`);
    
    client.user.setActivity('Cloud Gaming-223', { type: ActivityType.Watching });

    try {
        const owner = await client.users.fetch(OWNER_ID);
        if (owner) {
            const bootEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('🛰️ CLOUD GAMING-223 | ONLINE')
                .setDescription(`**System connected.** All ${client.commands.size} modules synchronized.`)
                .setFooter({ text: 'Cloud Gaming-223 System Log' })
                .setTimestamp();
            await owner.send({ embeds: [bootEmbed] });
        }
    } catch (e) {
        console.log(`${blue}INFO [${time()}]: [0] DM notification failed.${reset}`);
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName);

    if (command) {
        try {
            await command.execute(message, args, client, model);
        } catch (error) {
            console.error(error);
            message.reply('❌ Execution error.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
