const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'help',
    description: 'Displays the full list of Digital Engine modules.',
    async execute(message, args, client) {
        const prefix = process.env.PREFIX || ',';
        const helpEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('🎮 CLOUD GAMING-223 | COMMAND CENTER')
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription(`**Engine V2.6** | Total Modules: **${client.commands.size}**`)
            .setFooter({ text: 'Optimized for West Africa | Bamako 🇲🇱' })
            .setTimestamp();

        const categories = {};
        client.commands.forEach(cmd => {
            const cat = cmd.category || 'General';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(`\`${cmd.name}\``);
        });

        for (const [category, commandList] of Object.entries(categories)) {
            // Safety: Ensure we don't exceed field limits
            const list = commandList.join(', ');
            helpEmbed.addFields({
                name: `📁 ${category}`,
                value: list.length > 1024 ? list.substring(0, 1021) + "..." : list,
                inline: false
            });
        }

        await message.reply({ embeds: [helpEmbed] }).catch(() => null);
    },
};
