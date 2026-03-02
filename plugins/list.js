const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'list',
    description: 'Dynamically lists all installed engine modules',
    async execute(message, args, client) {
        // client.commands is the Collection created in index.js
        const commands = client.commands;

        const embed = new EmbedBuilder()
            .setColor('#36ced1')
            .setTitle('🛰️ DIGITAL ENGINE | ACTIVE MODULES')
            .setDescription(`Currently running **${commands.size}** synchronized plugins.`)
            .setThumbnail(client.user.displayAvatarURL())
            .setTimestamp();

        // This loop automatically finds every command you've installed
        commands.forEach((cmd) => {
            embed.addFields({ 
                name: `🔹 ,${cmd.name}`, 
                value: cmd.description || 'No description provided.', 
                inline: false 
            });
        });

        embed.setFooter({ text: 'System scan complete. All modules operational.' });

        await message.reply({ embeds: [embed] });
    },
};
