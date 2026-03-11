const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'list',
    description: 'List all available commands with descriptions.',
    category: 'SYSTEM',
    run: async (client, message, args, database) => {
        const prefix = process.env.PREFIX || '.';
        const categories = {};

        // Group commands by category
        client.commands.forEach(cmd => {
            const cat = cmd.category || 'GENERAL';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(cmd);
        });

        const embed = new EmbedBuilder()
            .setColor('#36ced1')
            .setAuthor({ name: 'ARCHITECT CG-223 | COMMAND LIST', iconURL: client.user.displayAvatarURL() })
            .setTitle('📋 AVAILABLE MODULES')
            .setDescription(`**${client.commands.size}** modules loaded. Use \`${prefix}help <command>\` for details.`)
            .setTimestamp();

        // Sort categories alphabetically
        const sortedCats = Object.keys(categories).sort();
        for (const cat of sortedCats) {
            const cmdList = categories[cat]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(cmd => `**${prefix}${cmd.name}** – ${cmd.description || 'No description.'}`)
                .join('\n');
            embed.addFields({ name: `${cat} (${categories[cat].length})`, value: cmdList, inline: false });
        }

        embed.setFooter({ text: 'Eagle Community | Digital Engine' });
        message.reply({ embeds: [embed] });
    }
};