const axios = require('axios');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'update',
    run: async (client, message, args, database) => {
        if (message.author.id !== process.env.OWNER_ID) return message.reply("⛔ Access Denied.");

        const msg = await message.reply("📡 **Connecting to Master Node...**");
        try {
            const res = await axios.get(`https://raw.githubusercontent.com/MFOF7310/cloud-gaming-223-digital-engine/main/version.txt`);
            const remoteVersion = res.data.toString().trim();

            if (remoteVersion === client.version) return msg.edit("✅ **Already Up-to-Date.**");

            client.loadPlugins(); 
            client.version = remoteVersion;
            msg.edit({ content: '', embeds: [new EmbedBuilder().setColor('#2ecc71').setTitle('🚀 ENGINE SYNCED').setDescription(`Updated to **v${remoteVersion}**`)] });
        } catch (error) { msg.edit("❌ **Sync Failed.**"); }
    }
};
