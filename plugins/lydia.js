module.exports = {
    name: 'lydia',
    description: 'Toggle AI autonomous chatter in this channel.',
    category: 'SYSTEM',
    run: async (client, message, args, database, lydiaChannels) => {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply("⛔ **Access Denied:** Administrator clearance required.");
        }

        const channelId = message.channel.id;

        if (lydiaChannels && lydiaChannels[channelId]) {
            delete lydiaChannels[channelId];
            message.reply("🛰️ **Uplink Terminé:** Autonomous AI chatter deactivated.");
        } else {
            if (lydiaChannels) lydiaChannels[channelId] = true;
            message.reply("🦅 **Uplink Établi:** The Architect is now monitoring this channel.");
        }
    }
};
