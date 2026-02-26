require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, ActivityType, EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * 🎮 CLOUD GAMING223 | FULL BLUE FRAMEWORK
 * Matches image 1000473711.jpg exactly.
 */

// 🎨 ANSI Color Codes
const blue = "\x1b[94m"; // Bright Blue
const cyan = "\x1b[36m";
const reset = "\x1b[0m";

const client = new Client({ 
    intents: [3276799] 
});

client.commands = new Collection();
const PREFIX = process.env.PREFIX || ',';
const OWNER_ID = '1284944736620253296';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// 🕒 Exact Timestamp Format
const time = () => {
    const now = new Date();
    const t = now.toLocaleTimeString('en-GB', { hour12: false });
    const d = now.toLocaleDateString('en-GB').replace(/\//g, '-');
    return `${t} ${d}`;
};

// 🛰️ Full Blue Startup Sequence
console.log(`${blue}INFO [${time()}]: [0] Connecting...${reset}`);
console.log(`${blue}INFO [${time()}]: [0] Installing Plugins...${reset}`);

const pluginsPath = path.join(__dirname, 'plugins');
const pluginFiles = fs.readdirSync(pluginsPath).filter(file => file.endsWith('.js'));

for (const file of pluginFiles) {
    try {
        const command = require(`./plugins/${file}`);
        if (command.name) {
            client.commands.set(command.name, command);
            // This colors the WHOLE line in blue
            console.log(`${blue}INFO [${time()}]: [0] Installed ${command.name}${reset}`);
        }
    } catch (error) {
        // ERROR also in blue but with clear text to identify the issue
        console.log(`${blue}ERROR [${time()}]: [0] Failed to load ${file}${reset}`);
    }
}

console.log(`${blue}INFO [${time()}]: [0] ${client.commands.size} External Plugins Installed${reset}`);

client.once('ready', async () => {
    // These lines match your latest 'Oops' screenshots
    console.log(`\n${cyan}🚀 ${client.user.tag} is now connected in the console!${reset}`);
    console.log(`${cyan}📍 Location: Bamako, Mali${reset}`);
    console.log(`${cyan}📊 Total Modules Active: ${client.commands.size}${reset}\n`);
    
    client.user.setActivity('Cloud Gaming 223', { type: ActivityType.Watching });

    try {
        const owner = await client.users.fetch(OWNER_ID);
        if (owner) {
            const bootEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('🛰️ CLOUD GAMING223 | ONLINE')
                .setDescription(`**System connected.** All ${client.commands.size} modules synchronized.`)
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
