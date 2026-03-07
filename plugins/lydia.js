module.exports = {
    name: 'lydia',
    category: 'AI',
    description: 'Toggle the CLOUD_GAMING AI engine in this channel',
    async execute(message, args, client, model, lydiaChannels) {
        // Permission Check
        if (!message.member.permissions.has("ManageGuild")) {
            return message.reply("❌ **Access Denied:** Administrator permissions required to toggle the AI Engine.");
        }

        const option = args[0]?.toLowerCase();

        // ENABLE ENGINE
        if (option === "on") {
            lydiaChannels[message.channel.id] = true;
            return message.reply(
                "🧠 **ENGINE UPDATE:** CLOUD_GAMING AI is now **ACTIVE** in this channel.\n" +
                "📡 Members can now **mention me** or **reply to my messages** to chat."
            );
        }

        // DISABLE ENGINE
        if (option === "off") {
            delete lydiaChannels[message.channel.id];
            return message.reply(
                "💤 **ENGINE UPDATE:** CLOUD_GAMING AI has been placed in **STANDBY** for this channel."
            );
        }

        // USAGE GUIDE
        return message.reply(
            "⚙️ **CLOUD_GAMING Control Panel**\n" +
            "Usage:\n" +
            "`,lydia on` — Activate AI Engine\n" +
            "`,lydia off` — Deactivate AI Engine"
        );
    }
};
