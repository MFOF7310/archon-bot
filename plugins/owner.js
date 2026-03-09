module.exports = {
    name: 'owner',
    description: 'Executive links and system hub',
    category: 'Owner',
    run: async (client, message, args, database) => {
        const ARCHITECT_ID = process.env.OWNER_ID || '1284944736620253296';
        if (message.author.id !== ARCHITECT_ID) return;

        const response = [
            "🛰️ **CLOUD GAMING-223 | EXECUTIVE HUB**",
            "",
            "🔗 **Facebook:** https://www.facebook.com/share/17KysmJrtm/",
            "📱 **TikTok:** https://www.tiktok.com/@cloudgaming223",
            "📸 **Instagram:** https://www.instagram.com/mfof7310",
            "💬 **WhatsApp:** https://wa.me/15485200518",
            "",
            "ℹ️ *Use these links for community management and support.*"
        ].join('\n');

        await message.reply(response);
    }
};
