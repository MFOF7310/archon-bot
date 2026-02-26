const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'menu',
    description: 'Displays the list of available commands',
    async execute(message, args, client) {
        // 1. Get all loaded commands from the bot's collection
        const commands = client.commands.map(cmd => `\`${cmd.name}\``).join(', ');

        const menuEmbed = new EmbedBuilder()
            .setColor('#2ecc71') // AES Emerald Green
            .setTitle('📂 AES FRAMEWORK | COMMAND MENU')
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription('Welcome to the **Fof223** command center. Below are the active modules currently loaded in the system.')
            .addFields(
                { name: '🛠️ Available Commands', value: commands || 'No commands loaded.' },
                { name: '💡 Usage', value: `Type \`${process.env.PREFIX || ','}\` followed by a command name (e.g., \`,vision\`).` }
            )
            .setFooter({ text: 'AES Digital Sovereignty • Bamako, Mali', iconURL: 'https://i.imgur.com/mali-flag.png' })
            .setTimestamp();

        return message.reply({ embeds: [menuEmbed] });
    }
};
