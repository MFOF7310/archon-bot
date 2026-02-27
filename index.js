require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, ActivityType, EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { TikTokLiveConnection } = require('tiktok-live-connector');

/**
 * 🎮 CLOUD GAMING-223 | DIGITAL ENGINE
 * Fixed TikTok Logic: No more notification spam!
 */

const blue = "\x1b[94m"; 
const cyan = "\x1b[36m";
const reset = "\x1b[0m";

const client = new Client({ intents: [3276799] });
client.commands = new Collection();

const PREFIX = process.env.PREFIX || ',';
const OWNER_ID = '1284944736620253296';

// --- TIKTOK STATUS TRACKER ---
let isLive = false; 

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const time = () => {
    const now = new Date();
    const t = now.toLocaleTimeString('en-GB', { hour12: false });
    const d = now.toLocaleDateString('en-GB').replace(/\//g, '-');
    return `${t} ${d}`;
};

console.log(`${blue}INFO [${time()}]: [0] Connecting to CLOUD GAMING-223...${reset}`);

// --- PLUGIN LOADER ---
const pluginsPath = path.join(__dirname, 'plugins');
if (!fs.existsSync(pluginsPath)) fs.mkdirSync(pluginsPath);
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

    // --- IMPROVED TIKTOK MONITORING ---
    setInterval(async () => {
        const tiktok = new TikTokLiveConnection(process.env.TIKTOK_USERNAME);
        
        try {
            await tiktok.connect();
            
            // If connection is successful and we WEREN'T live before
            if (!isLive) {
                const channel = await client.channels.fetch(process.env.CHANNEL_ID);
                if (channel) {
                    const liveEmbed = new EmbedBuilder()
                        .setColor('#fe2c55')
                        .setAuthor({ 
                            name: `${process.env.TIKTOK_USERNAME}`, 
                            iconURL: 'https://cdn-icons-png.flaticon.com/512/3046/3046121.png' 
                        })
                        .setTitle('🔴 LIVE ON TIKTOK')
                        .setDescription(`**${process.env.TIKTOK_USERNAME}** is now live! Come watch the stream.`)
                        .setURL(`https://www.tiktok.com/@${process.env.TIKTOK_USERNAME}/live`)
                        .addFields(
                            { name: 'Platform', value: 'TikTok Live', inline: true },
                            { name: 'Status', value: 'Streaming Now ⚡', inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'Cloud Gaming-223 Notifications' });

                    await channel.send({ 
                        content: `📢 @everyone **${process.env.TIKTOK_USERNAME}** is LIVE!`, 
                        embeds: [liveEmbed] 
                    });

                    console.log(`${cyan}INFO [${time()}]: [TikTok] Notification sent. Status locked.${reset}`);
                    isLive = true; // LOCK STATUS
                }
            }
            
            // Disconnect after checking to prevent session hang
            tiktok.disconnect();

        } catch (error) {
            // ONLY reset isLive if the error explicitly says the user is offline
            // This prevents "flickering" notifications if the internet lags
            if (error.message.includes('not online') || error.message.includes('offline')) {
                if (isLive) {
                    console.log(`${blue}INFO [${time()}]: [TikTok] Stream ended. Status reset.${reset}`);
                    isLive = false;
                }
            }
        }
    }, 120000); // 2 minutes

    // --- OWNER BOOT NOTIFICATION ---
    try {
        const owner = await client.users.fetch(OWNER_ID);
        if (owner) {
            const bootEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('🛰️ CLOUD GAMING-223 | ONLINE')
                .setDescription(`**System connected.** All ${client.commands.size} modules synchronized. TikTok monitor active.`)
                .setFooter({ text: 'Cloud Gaming-223 System Log' })
                .setTimestamp();
            await owner.send({ embeds: [bootEmbed] });
        }
    } catch (e) {
        console.log(`${blue}INFO [${time()}]: [0] DM notification failed.${reset}`);
    }
});

// --- MESSAGE HANDLER ---
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
