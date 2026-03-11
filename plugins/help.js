const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'help',
    aliases: ['h', 'menu', 'commands'],
    description: 'Display all commands or get detailed info about a specific command.',
    usage: 'help [command]',
    category: 'SYSTEM',
    run: async (client, message, args) => {
        const now = new Date();
        const preciseTime = now.toUTCString();
        const footerTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

        // Icons for categories
        const icons = {
            'AI': '🧠',
            'GAMING': '🎮',
            'MODERATION': '🛡️',
            'SYSTEM': '📡',
            'SOCIAL': '🌐',
            'UTILITY': '🛠️',
            'FUN': '🎲',
            'ECONOMY': '💰',
            'MUSIC': '🎵',
            'ADMIN': '👑'
        };

        // If user asked for a specific command
        if (args.length) {
            const commandName = args[0].toLowerCase();
            const command = client.commands.get(commandName) || 
                           client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

            if (!command) {
                return message.reply(`❌ Command **${args[0]}** not found. Use \`${process.env.PREFIX || '.'}help\` to see all commands.`);
            }

            // Build detailed embed
            const detailEmbed = new EmbedBuilder()
                .setColor('#00ffcc')
                .setAuthor({ name: 'ARCHITECT CG-223 | COMMAND DETAILS', iconURL: client.user.displayAvatarURL() })
                .setTitle(`📋 ${command.name.charAt(0).toUpperCase() + command.name.slice(1)} Command`)
                .addFields(
                    { name: '📝 Description', value: command.description || 'No description provided.', inline: false },
                    { name: '🔧 Usage', value: `\`${process.env.PREFIX || '.'}${command.usage || command.name}\``, inline: true },
                    { name: '📂 Category', value: command.category || 'General', inline: true }
                );

            if (command.aliases && command.aliases.length) {
                detailEmbed.addFields({ name: '🔀 Aliases', value: command.aliases.map(a => `\`${a}\``).join(', '), inline: true });
            }

            detailEmbed.setFooter({ text: `Protocol Eagle • ${footerTime} • Bamako Node` })
                       .setTimestamp();

            return message.reply({ embeds: [detailEmbed] });
        }

        // Otherwise show category overview
        const categories = {};
        client.commands.forEach(cmd => {
            const cat = (cmd.category || 'General').toUpperCase();
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(cmd);
        });

        const helpEmbed = new EmbedBuilder()
            .setColor('#00ffcc')
            .setAuthor({ name: 'ARCHITECT CG-223 | CONTROL INTERFACE', iconURL: client.user.displayAvatarURL() })
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription(`**Status:** 🟢 ONLINE\n**System Time:** \`${preciseTime}\` 🛰️\n**Modules Loaded:** \`${client.commands.size}\`\n\nUse \`${process.env.PREFIX || '.'}help <command>\` for detailed info.`);

        // Sort categories alphabetically
        Object.keys(categories).sort().forEach(category => {
            const icon = icons[category] || '📁';
            const commandList = categories[category]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(cmd => `\`${cmd.name}\``)
                .join(' • ');

            helpEmbed.addFields({ name: `${icon} ${category} (${categories[category].length})`, value: commandList, inline: false });
        });

        helpEmbed.setFooter({ text: `Protocol Eagle • ${footerTime} • Bamako Node` })
                 .setTimestamp();

        message.reply({ embeds: [helpEmbed] });
    }
};