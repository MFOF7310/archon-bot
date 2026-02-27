const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'help',
    description: 'List all available commands and their descriptions.',
    async execute(message, args, client) {
        const { commands } = client;

        const helpEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('🎮 CLOUD GAMING-223 | COMMAND CENTER')
            .setDescription('Here are the active modules currently synchronized with the engine:')
            .setThumbnail(client.user.displayAvatarURL())
            .setFooter({ text: 'Cloud Gaming-223 | Optimized for West Africa' })
            .setTimestamp();

        // This loop automatically finds every plugin you have installed
        commands.forEach(command => {
            helpEmbed.addFields({ 
                name: `\`${process.env.PREFIX}${command.name}\``, 
                value: command.description || 'No description provided.', 
                inline: true 
            });
        });

        message.channel.send({ embeds: [helpEmbed] });
    },
};
