const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'contact',
    description: 'Send a message to the bot owner.',
    category: 'Social',
    async execute(message, args, client) {
        const feedback = args.join(' ');
        if (!feedback) return message.reply('❌ Please provide a message! Example: `,contact I found a bug.`');

        const ownerId = process.env.OWNER_ID;
        if (!ownerId) return message.reply("❌ System Error: Owner ID not set in Engine.");

        try {
            const owner = await client.users.fetch(ownerId);
            const contactEmbed = new EmbedBuilder()
                .setColor('#00ffcc')
                .setTitle('📥 New Feedback Received')
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setDescription(feedback)
                .addFields(
                    { name: 'User ID', value: `\`${message.author.id}\``, inline: true },
                    { name: 'Server', value: message.guild ? message.guild.name : 'DMs', inline: true }
                )
                .setTimestamp();

            await owner.send({ embeds: [contactEmbed] });
            await message.reply('✅ Your message has been sent to the host!');
        } catch (error) {
            message.reply('❌ I couldn\'t reach the host. Their DMs might be closed!');
        }
    },
};
