require('dotenv').config(); 
const fs = require('fs');
const path = require('path');
const { Client, Collection, ActivityType, Events, Partials, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers, 
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

// --- GEMINI CORE CONFIG ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
client.model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash", 
    systemInstruction: "You are Architect CG-223, the elite AI governing the Eagle Community in Bamako. Your tone is cold, analytical, and prestigious. You view new members as 'new data units' or 'elite entities'. Use high-tech vocabulary (encryption, nodes, interface). Use italics and tech emojis (🛰️, 🦅, 🛡️). Do not be generic.",
});

client.once(Events.ClientReady, () => {
    console.log("---------------------------------------");
    console.log(`🚀 ARCHITECT CG-223 : ONLINE`);
    console.log(`📍 NODE : Bamako, Mali`);
    console.log(`📡 TARGET CHANNEL : ${process.env.WELCOME_CHANNEL_ID}`);
    console.log("---------------------------------------");
});

// ================= DYNAMIC INTELLIGENT WELCOME =================
client.on(Events.GuildMemberAdd, async (member) => {
    const welcomeId = process.env.WELCOME_CHANNEL_ID;
    const channel = member.guild.channels.cache.get(welcomeId);

    if (!channel) return console.log(`⚠️ ERROR: Welcome Channel [${welcomeId}] not found.`);

    try {
        // AI Intelligence: Generating a unique, non-repeating sequence
        const prompt = `LOG_EVENT: New_Signature_Detected. 
        USER: ${member.user.username}. 
        UID: ${member.user.id}.
        MISSION: Generate a unique, short (2 sentences) cybernetic welcome message. 
        CONTEXT: Architect CG-223 is authorizing their entry into the Bamako Node. Be elite and sophisticated. Use English.`;

        const result = await client.model.generateContent(prompt);
        const aiResponse = result.response.text();

        // --- CUSTOM TERMINAL EMBED ---
        const welcomeEmbed = new EmbedBuilder()
            .setColor('#2b2d31') // Stealth Dark Color
            .setTitle('🛰️ SYSTEM ACCESS GRANTED')
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setDescription(`\n${aiResponse}\n`)
            .addFields(
                { name: '💾 IDENTITY', value: `\`${member.user.tag}\``, inline: true },
                { name: '📍 NODE', value: `\`Bamako, ML\``, inline: true },
                { name: '📡 SIGNAL', value: `\`ENCRYPTED / VERIFIED\``, inline: false }
            )
            .setFooter({ text: `Eagle OS v${client.version} | Core: Architect CG-223`, iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        // Sending the message
        await channel.send({ 
            content: `🦅 **Incoming transmission for <@${member.user.id}>...**`, 
            embeds: [welcomeEmbed] 
        });

        console.log(`✅ Welcome sequence executed for ${member.user.username}`);

    } catch (err) {
        console.error("❌ Architect Error:", err.message);
        // Clean Fallback if AI fails
        channel.send(`*New signature detected: ${member.user}. Welcome to the network. Accessing Bamako Node...* 🦅`);
    }
});

// --- KEEP YOUR MESSAGE CREATE LOGIC BELOW ---
client.login(process.env.TOKEN);
