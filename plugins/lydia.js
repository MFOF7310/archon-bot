module.exports = {
    name: 'lydia',
    description: 'Active ou désactive l\'IA dans ce salon.',
    run: async (client, message, args, database, lydiaChannels) => {
        // Sécurité : Admin uniquement
        if (!message.member.permissions.has('Administrator')) {
            return message.reply("⛔ **Accès Refusé :** Seul un Administrateur peut configurer l'IA.");
        }

        const channelId = message.channel.id;

        if (lydiaChannels[channelId]) {
            delete lydiaChannels[channelId];
            message.reply("🛰️ **Uplink Terminé :** L'Architecte a quitté ce canal.");
        } else {
            lydiaChannels[channelId] = true;
            message.reply("🦅 **Uplink Établi :** L'Architecte est maintenant actif dans ce canal.");
        }
    }
};
