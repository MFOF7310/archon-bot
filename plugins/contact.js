const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'contact',
    description: 'Send a message to the bot owner.',
    category: 'Social',
    run: async (client, message, args, database) => {
        const prefix = process.env.PREFIX || ",";
        const feedback = args.join(' ');
        if (!feedback) return message.reply(`❌ Usage: \`${prefix}contact [message]\``);

        const ARCHITECT_ID = process.env.OWNER_ID || '1284944736620253296';

        try {
            const owner = await client.users.fetch(ARCHITECT_ID);
            const contactEmbed = new EmbedBuilder()
                .setColor('#00ffcc')
                .setTitle('📥 New Feedback Received')
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setDescription(`**Message:**\n${feedback}`)
                .setTimestamp();

            await owner.send({ embeds: [contactEmbed] });
            await message.react('✅');
            await message.reply('🛰️ **Transmission Sent.**');
        } catch (error) {
            message.reply('❌ **Link Failure:** Architect DMs are likely closed.');
        }
    },
};
