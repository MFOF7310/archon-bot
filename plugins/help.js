const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'help',
    aliases: ['h', 'menu'],
    description: 'Interface de contrôle ARCHITECT CG-223.',
    category: 'System', 
    run: async (client, message, args, database) => {
        const prefix = process.env.PREFIX || ',';
        const now = new Date();

        const options = { 
            timeZone: 'UTC', weekday: 'long', day: '2-digit', 
            month: '2-digit', year: 'numeric', hour: '2-digit', 
            minute: '2-digit', second: '2-digit', hour12: false 
        };
        const formatter = new Intl.DateTimeFormat('en-GB', options);
        const parts = formatter.formatToParts(now);
        
        const weekday = parts.find(p => p.type === 'weekday').value;
        const day = parts.find(p => p.type === 'day').value;
        const month = parts.find(p => p.type === 'month').value;
        const year = parts.find(p => p.type === 'year').value;
        const time = parts.filter(p => ['hour', 'minute', 'second'].includes(p.type)).map(p => p.value).join(':');
        
        const preciseTime = `${weekday}, ${day}/${month}/${year} ${time} GMT`;
        const footerTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

        const helpEmbed = new EmbedBuilder()
            .setColor('#00ffcc')
            .setAuthor({ name: 'ARCHITECT CG-223 | CONTROL INTERFACE', iconURL: client.user.displayAvatarURL() })
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription(`**Status:** 🟢 ONLINE\n**System Time:** \`${preciseTime}\` 🛰️\n**Modules:** \`${client.commands.size}\` Detectées`);

        const icons = { 'AI': '🧠', 'Gaming': '🎮', 'Moderation': '🛡️', 'System': '📡', 'Social': '🌐', 'Utility': '🛠️' };
        const categories = {};
        
        client.commands.forEach(cmd => {
            const cat = cmd.category || 'General';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(cmd.name);
        });

        Object.keys(categories).sort().forEach(category => {
            const icon = icons[category] || '📁';
            const cmdList = categories[category].sort().map(name => `\`${name}\``).join(' • ');
            helpEmbed.addFields({ name: `${icon} ${category.toUpperCase()}`, value: cmdList, inline: false });
        });

        helpEmbed.setFooter({ text: `Today at ${footerTime} | Bamako Node` });
        await message.reply({ embeds: [helpEmbed] });
    },
};
