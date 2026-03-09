module.exports = {
    name: 'lydia',
    category: 'AI',
    description: 'Toggle the CLOUD_GAMING AI engine in this channel',
    async execute(message, args, client, model, lydiaChannels) {
        if (!message.member.permissions.has("ManageGuild")) {
            return message.reply("❌ **Access Denied:** Administrator permissions required.");
        }

        const option = args[0]?.toLowerCase();

        if (option === "on") {
            lydiaChannels[message.channel.id] = true;
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#2ecc71')
                        .setTitle('🧠 AI ENGINE ONLINE')
                        .setDescription("Le système **CLOUD_GAMING-223** est opérationnel.\n\n📡 **Mode:** Interactif\n💬 **Trigger:** Mention ou Réponse")
                        .setFooter({ text: 'Bamako Node 🇲🇱' })
                ]
            });
        }

        if (option === "off") {
            delete lydiaChannels[message.channel.id];
            return message.reply("💤 **ENGINE UPDATE:** AI has been placed in **STANDBY**.");
        }

        return message.reply("⚙️ **Usage:** `,lydia on` or `,lydia off`.");
    }
};
