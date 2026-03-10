const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'help',
    aliases: ['h', 'menu'],
    description: 'Interface de contrôle ARCHITECT CG-223.',
    category: 'System', 
    run: async (client, message, args, database) => {
        const now = new Date();
        const preciseTime = now.toUTCString();
        const footerTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

        const helpEmbed = new EmbedBuilder()
            .setColor('#00ffcc')
            .setAuthor({ name: 'ARCHITECT CG-223 | CONTROL INTERFACE', iconURL: client.user.displayAvatarURL() })
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription(`**Status:** 🟢 ONLINE\n**System Time:** \`${preciseTime}\` 🛰️\n**Modules:** \`${client.commands.size}\` Detectées`);

        const icons = { 'AI': '🧠', 'GAMING': '🎮', 'MODERATION': '🛡️', 'SYSTEM': '📡', 'SOCIAL': '🌐', 'UTILITY': '🛠️' };
        const categories = {};
        
        client.commands.forEach(cmd => {
            const cat = (cmd.category || 'General').toUpperCase();
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(cmd.name);
        });

        Object.keys(categories).sort().forEach(category => {
            const icon = icons[category] || '📁';
            const cmdList = categories[category].sort().map(name => `\`${name}\``).join(' • ');
            helpEmbed.addFields({ name: `${icon} ${category}`, value: cmdList, inline: false });
        });

        helpEmbed.setFooter({ text: `Protocol Eagle • ${footerTime} • Bamako Node` });
        await message.reply({ embeds: [helpEmbed] });
    },
};
