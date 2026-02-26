const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'contact',
    description: 'Send a direct message to the bot owner',
    async execute(message, args, client) {
        const CREATOR_ID = '1284944736620253296'; 
        const feedback = args.join(" ");

        if (!feedback) {
            return message.reply("❌ **Usage:** `,contact [your message]`\nExample: `,contact I found a bug in the AI!`");
        }

        try {
            const creator = await client.users.fetch(CREATOR_ID);
            
            const reportEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('📩 New Contact Message')
                .addFields(
                    { name: 'From User', value: `${message.author.tag} (${message.author.id})`, inline: true },
                    { name: 'Channel', value: `${message.channel.name || 'DM'}`, inline: true },
                    { name: 'Message', value: feedback }
                )
                .setTimestamp();

            await creator.send({ embeds: [reportEmbed] });
            return message.reply("✅ **Message Sent!** The creator has been notified.");
            
        } catch (err) {
            console.error(err);
            return message.reply("❌ **Error:** I couldn't reach the creator. They might have DMs closed.");
        }
    },
};
