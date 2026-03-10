module.exports = {
    name: 'owner',
    description: 'Executive links and system hub.',
    category: 'OWNER',
    run: async (client, message, args, database) => {
        if (message.author.id !== process.env.OWNER_ID) return;

        const response = [
            "🛰️ **ARCHITECT CG-223 | EXECUTIVE HUB**",
            "",
            "🔗 **Facebook:** https://www.facebook.com/share/17KysmJrtm/",
            "📱 **TikTok:** https://www.tiktok.com/@cloudgaming223",
            "📸 **Instagram:** https://www.instagram.com/mfof7310",
            "💬 **WhatsApp:** https://wa.me/15485200518",
            "",
            "ℹ️ *Community management and support frequency active.*"
        ].join('\n');

        await message.reply(response);
    }
};
