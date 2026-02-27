const { EmbedBuilder } = require('discord.js');

module.exports = async (client) => {
    const OWNER_ID = '1284944736620253296';

    try {
        const owner = await client.users.fetch(OWNER_ID);
        if (owner) {
            const bootEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('🛰️ CLOUD GAMING-223 | ONLINE')
                .setDescription(`**System connected.**\n\n📊 **Modules:** ${client.commands.size} synchronized\n🛰️ **Network:** Starlink (Mali Region)\n📸 **Monitor:** TikTok Live Active`)
                .setFooter({ text: 'Cloud Gaming-223 System Log' })
                .setTimestamp();

            await owner.send({ embeds: [bootEmbed] });
            console.log(`[System] Boot notification sent to Owner.`);
        }
    } catch (e) {
        console.error(`[System] Failed to send boot DM:`, e.message);
    }
};