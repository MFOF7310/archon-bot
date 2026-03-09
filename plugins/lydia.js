const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'lydia',
    category: 'AI',
    description: 'Toggle the AI engine in this channel',
    run: async (client, message, args, database) => {
        if (!message.member.permissions.has("ManageGuild")) {
            return message.reply("❌ **Access Denied.**");
        }

        const lydiaPath = path.join(__dirname, '../lydia_status.json');
        let lydiaChannels = JSON.parse(fs.readFileSync(lydiaPath, "utf8"));
        const option = args[0]?.toLowerCase();
        const prefix = process.env.PREFIX || ",";

        if (option === "on") {
            lydiaChannels[message.channel.id] = true;
            fs.writeFileSync(lydiaPath, JSON.stringify(lydiaChannels, null, 4));
            
            const onEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('🧠 LYDIA ENGINE ACTIVATED')
                .setDescription("The **Eagle Community** AI is now live in this channel.")
                .setFooter({ text: 'Bamako Node 🇲🇱' })
                .setTimestamp();

            return message.reply({ embeds: [onEmbed] });
        }

        if (option === "off") {
            delete lydiaChannels[message.channel.id];
            fs.writeFileSync(lydiaPath, JSON.stringify(lydiaChannels, null, 4));
            return message.reply("💤 **ENGINE UPDATE:** Lydia placed in **STANDBY**.");
        }

        const helpEmbed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle('⚙️ AI CONTROL PANEL')
            .addFields(
                { name: '✅ Enable', value: `\`${prefix}lydia on\``, inline: true },
                { name: '❌ Disable', value: `\`${prefix}lydia off\``, inline: true }
            );

        return message.reply({ embeds: [helpEmbed] });
    }
};
