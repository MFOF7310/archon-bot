const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'contact',
    description: 'Send a message to the bot owner.',
    async execute(message, args, client) {
        const feedback = args.join(' ');
        
        // Basic check to make sure they actually wrote something
        if (!feedback) {
            return message.reply('❌ Please provide a message! Example: `,contact I found a bug.`');
        }

        const ownerId = process.env.OWNER_ID;

        try {
            // Fetch the owner from Discord
            const owner = await client.users.fetch(ownerId);

            // Create a nice embed for your DMs
            const contactEmbed = new EmbedBuilder()
                .setColor('#00ffcc') // Cyan color to match your theme
                .setTitle('📥 New Feedback Received')
                .setAuthor({ 
                    name: message.author.tag, 
                    iconURL: message.author.displayAvatarURL() 
                })
                .setDescription(feedback)
                .addFields(
                    { name: 'User ID', value: `\`${message.author.id}\``, inline: true },
                    { name: 'Channel', value: message.channel.name || 'DM', inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Cloud Gaming-223 Support System' });

            // Send to you
            await owner.send({ embeds: [contactEmbed] });

            // Confirm to the user
            await message.reply('✅ Your message has been sent to the host! They will get back to you if needed.');

        } catch (error) {
            console.error('Contact error:', error);
            message.reply('❌ I couldn\'t reach the host. Their DMs might be closed!');
        }
    },
};
