const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'help',
    description: 'Displays the full list of Digital Engine modules.',
    async execute(message, args, client) {
        const prefix = process.env.PREFIX || ',';
        
        // CASE 1: Specific Command Info (e.g. ,help status)
        if (args[0]) {
            const command = client.commands.get(args[0].toLowerCase());
            if (!command) return message.reply("❌ **Module not found in the database.**");

            const detailEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle(`🛠️ Module: ${command.name.toUpperCase()}`)
                .addFields(
                    { name: '📝 Description', value: command.description || 'No description provided.' },
                    { name: '📂 Category', value: command.category || 'General', inline: true },
                    { name: '⌨️ Usage', value: `\`${prefix}${command.name}\``, inline: true }
                )
                .setFooter({ text: 'CLOUD_GAMING System Diagnostics' });

            return message.reply({ embeds: [detailEmbed] });
        }

        // CASE 2: General Help Menu
        const helpEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setAuthor({ 
                name: 'CLOUD_GAMING-223 | DIGITAL ENGINE', 
                iconURL: client.user.displayAvatarURL() 
            })
            .setTitle('🖥️ SYSTEM MAINBOARD')
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription(
                `**Engine Status:** 🟢 STABLE (v2.6.0)\n` +
                `**Region:** West Africa | Bamako 🇲🇱\n` +
                `**Modules Detected:** \`${client.commands.size}\` Active`
            )
            .setFooter({ text: `Type ${prefix}help [command] for details | Built by Architect` })
            .setTimestamp();

        // Organize categories with better icons
        const categories = {};
        const icons = {
            'AI': '🧠',
            'General': '⚙️',
            'Gaming': '🎮',
            'Admin': '🛡️',
            'System': '📡'
        };

        client.commands.forEach(cmd => {
            const cat = cmd.category || 'General';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(`\`${cmd.name}\``);
        });

        for (const [category, commandList] of Object.entries(categories)) {
            const icon = icons[category] || '📁';
            helpEmbed.addFields({
                name: `${icon} ${category.toUpperCase()}`,
                value: commandList.join(' • '), // Clean bullet separation
                inline: false
            });
        }

        await message.reply({ embeds: [helpEmbed] }).catch(err => console.log("Help Error:", err));
    },
};
