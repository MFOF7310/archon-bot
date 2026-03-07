const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'help',
    aliases: ['h', 'cmds'],
    description: 'Displays the full list of Digital Engine modules.',
    category: 'System', // This will put it under the 📡 icon
    async execute(message, args, client) {
        const prefix = process.env.PREFIX || ',';
        
        // CASE 1: Specific Command Info
        if (args[0]) {
            const cmdName = args[0].toLowerCase();
            // Look for command or check if it's an alias
            const command = client.commands.get(cmdName) || client.commands.get(client.aliases.get(cmdName));
            
            if (!command) return message.reply("❌ **Module not found in the database.**");

            const detailEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle(`🛠️ Module: ${command.name.toUpperCase()}`)
                .addFields(
                    { name: '📝 Description', value: command.description || 'No description.' },
                    { name: '📂 Category', value: command.category || 'General', inline: true },
                    { name: '⌨️ Usage', value: `\`${prefix}${command.name}\``, inline: true }
                )
                .setFooter({ text: 'CLOUD_GAMING System Diagnostics' });

            if (command.aliases) {
                detailEmbed.addFields({ name: '🔗 Shortcuts', value: command.aliases.map(a => `\`${a}\``).join(', '), inline: true });
            }

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
                `**Engine Status:** 🟢 STABLE (v${client.version})\n` +
                `**Region:** West Africa | Bamako 🇲🇱\n` +
                `**Modules Detected:** \`${client.commands.size}\` Active`
            )
            .setFooter({ text: `Type ${prefix}help [command] for details | Built by Architect` })
            .setTimestamp();

        const categories = {};
        const icons = {
            'AI': '🧠',
            'Utility': '🛠️',
            'Gaming': '🎮',
            'Admin': '🛡️',
            'System': '📡',
            'General': '⚙️'
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
                value: commandList.join(' • '),
                inline: false
            });
        }

        await message.reply({ embeds: [helpEmbed] }).catch(err => console.log("Help Error:", err));
    },
};
