const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'lydia',
    category: 'AI',
    description: 'Toggle the CLOUD_GAMING AI engine in this channel',
    async execute(message, args, client, model, lydiaChannels) {
        // 1. Permission Check
        if (!message.member.permissions.has("ManageGuild")) {
            return message.reply("❌ **Access Denied:** Administrator permissions required.");
        }

        // 2. Get the option (on/off)
        const option = args[0]?.toLowerCase();

        // 3. Logic for ON
        if (option === "on") {
            lydiaChannels[message.channel.id] = true;
            
            const onEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('🧠 AI ENGINE ACTIVATED')
                .setDescription("The **CLOUD_GAMING-223** AI is now live in this channel.")
                .addFields(
                    { name: '📡 Status', value: '`ONLINE`', inline: true },
                    { name: '💬 Method', value: '`Mention or Reply`', inline: true }
                )
                .setFooter({ text: 'Bamako Node 🇲🇱' })
                .setTimestamp();

            return message.reply({ embeds: [onEmbed] });
        }

        // 4. Logic for OFF
        if (option === "off") {
            if (lydiaChannels[message.channel.id]) {
                delete lydiaChannels[message.channel.id];
            }
            
            return message.reply("💤 **ENGINE UPDATE:** CLOUD_GAMING AI has been placed in **STANDBY**.");
        }

        // 5. Logic for Help/Usage (if no valid option is provided)
        const helpEmbed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle('⚙️ AI CONTROL PANEL')
            .setDescription("Please specify an action for the Lydia Engine.")
            .addFields(
                { name: '✅ To Enable', value: '`,lydia on`', inline: true },
                { name: '❌ To Disable', value: '`,lydia off`', inline: true }
            )
            .setFooter({ text: 'Cloud Gaming-223 Systems' });

        return message.reply({ embeds: [helpEmbed] });
    }
};
