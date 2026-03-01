const { EmbedBuilder } = require('discord.js'); // Added this line

module.exports = async (client) => {
    const OWNER_ID = '1284944736620253296';

    try {
        const owner = await client.users.fetch(OWNER_ID).catch(() => null);
        
        if (!owner) {
            return console.error(`[System] Architect with ID ${OWNER_ID} not found.`);
        }

        const bootEmbed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('🛰️ CLOUD GAMING-223 | ONLINE')
            .setDescription(`**Engine V2.5 is hot.**\n\n📊 **Plugins:** ${client.commands.size}\n🇲🇱 **Region:** Bamako\n🔥 **Status:** Operational`)
            .setTimestamp();

        await owner.send({ embeds: [bootEmbed] }).catch(err => console.error("Could not DM Owner. Is their DM off?"));
        console.log(`✅ [System] Boot DM delivered to Architect.`);
        
    } catch (e) {
        console.error(`❌ [System] DM failed. Error: ${e.message}`);
    }
};
