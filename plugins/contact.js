const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'contact',
    description: 'Send a direct message to the Architect (bot owner).',
    category: 'SYSTEM',
    run: async (client, message, args, database) => {
        const feedback = args.join(' ');
        if (!feedback) return message.reply(`❌ Usage: \`${process.env.PREFIX || '.'}contact [message]\``);

        const ARCHITECT_ID = process.env.OWNER_ID;
        if (!ARCHITECT_ID) {
            return message.reply('⚠️ **Architect ID not configured.** Contact the owner manually.');
        }

        try {
            const owner = await client.users.fetch(ARCHITECT_ID);
            
            const contactEmbed = new EmbedBuilder()
                .setColor('#00ffcc')
                .setTitle('📥 Incoming Transmission')
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setDescription(`**Message Content:**\n${feedback}`)
                .addFields(
                    { name: 'Source Server', value: message.guild?.name || 'Direct Message', inline: true },
                    { name: 'Channel', value: message.channel.name || 'DM', inline: true }
                )
                .setFooter({ text: `User ID: ${message.author.id}` })
                .setTimestamp();

            await owner.send({ embeds: [contactEmbed] });
            await message.react('✅');
            await message.reply('🛰️ **Transmission delivered to the Architect.**');
        } catch (error) {
            console.error('Contact Error:', error);
            message.reply('❌ **Link Failure:** Architect secure line is currently closed.');
        }
    },
};