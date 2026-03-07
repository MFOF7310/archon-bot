module.exports = {
    name: 'lydia',
    category: 'AI',
    description: 'Toggle Lydia AI in this channel',
    async execute(message, args, client, model, lydiaChannels) {
        // Permission Check
        if (!message.member.permissions.has("ManageGuild")) {
            return message.reply("❌ Admins only, fam.");
        }

        const option = args[0]?.toLowerCase();

        if (option === "on") {
            lydiaChannels[message.channel.id] = true;
            return message.reply("🧠 **CLOUD_GAMING AI activated.** Ping me or reply to chat!");
        }

        if (option === "off") {
            delete lydiaChannels[message.channel.id];
            return message.reply("💤 **CLOUD_GAMING AI disabled here.**");
        }

        return message.reply("⚙️ Usage: `,lydia on` or `,lydia off`.");
    }
};
