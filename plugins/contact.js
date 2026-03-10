const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'contact',
    description: 'Send a direct transmission to the Architect.',
    run: async (client, message, args, database) => {
        const feedback = args.join(' ');
        if (!feedback) return message.reply(`❌ Usage: \`.contact [message]\``);

        const ARCHITECT_ID = process.env.OWNER_ID;

        try {
            const owner = await client.users.fetch(ARCHITECT_ID);
            const contactEmbed = new EmbedBuilder()
                .setColor('#00ffcc')
                .setTitle('📥 Incoming Transmission')
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setDescription(`**Message Content:**\n${feedback}`)
                .setFooter({ text: `Source Node: ${message.guild.name}` })
                .setTimestamp();

            await owner.send({ embeds: [contactEmbed] });
            await message.react('✅');
            await message.reply('🛰️ **Transmission delivered to the Architect.**');
        } catch (error) {
            message.reply('❌ **Link Failure:** Architect secure line is currently closed.');
        }
    },
};
