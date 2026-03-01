const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'contact',
    description: 'Send a message to the bot owner.',
    category: 'Social',
    async execute(message, args, client) {
        const feedback = args.join(' ');
        if (!feedback) return message.reply('❌ Please provide a message! Example: `,contact I found a bug.`');

        const ARCHITECT_ID = '1284944736620253296';

        try {
            const owner = await client.users.fetch(ARCHITECT_ID);
            const contactEmbed = new EmbedBuilder()
                .setColor('#00ffcc')
                .setTitle('📥 New Feedback Received')
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setDescription(`**Message:**\n${feedback}`)
                .addFields(
                    { name: 'User ID', value: `\`${message.author.id}\``, inline: true },
                    { name: 'Location', value: message.guild ? message.guild.name : 'Direct Messages', inline: true }
                )
                .setTimestamp();

            await owner.send({ embeds: [contactEmbed] });
            await message.react('✅');
            await message.reply('🛰️ **Transmission Sent:** The Architect has been notified.');
        } catch (error) {
            console.error(error);
            message.reply('❌ **Link Failure:** I couldn\'t reach the host. Their DMs might be closed!');
        }
    },
};
