// REMOVED AXIOS - It was causing the "High Severity" alert
module.exports = {
    name: 'owner',
    description: 'Executive commands for the Architect',
    async execute(message, args, client) {
        const ARCHITECT_ID = '1284944736620253296';
        if (message.author.id !== ARCHITECT_ID) {
            return message.reply("⚠️ **Restricted:** This terminal is for the Architect only.");
        }

        const subCommand = args[0]?.toLowerCase();

        if (subCommand === 'social') {
            return message.reply(`🌐 **Community Hub:** https://www.facebook.com/share/17KysmJrtm/`);
        }

        if (subCommand === 'restart') {
            await message.reply("🔄 **ENGINE SHUTDOWN:** Rebooting container via Pterodactyl...");
            // Small delay to ensure message sends before exit
            setTimeout(() => process.exit(), 1000); 
            return;
        }

        message.reply("🛠️ **Executive Menu:**\n`,owner social` - Get community links\n`,owner restart` - Force reboot the engine");
    }
};
