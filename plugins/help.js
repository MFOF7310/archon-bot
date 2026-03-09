const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'help',
    aliases: ['h', 'menu'],
    description: 'Interface de contrôle ARCHITECT CG-223.',
    category: 'System', 
    async execute(message, args, client) {
        const prefix = process.env.PREFIX || ',';
        const now = new Date();

        // --- 1. PRECISE SYSTEM TIME (Monday, 09/03/2026 17:50:02 GMT) ---
        const options = { 
            timeZone: 'UTC', 
            weekday: 'long', 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: false 
        };
        const formatter = new Intl.DateTimeFormat('en-GB', options);
        const parts = formatter.formatToParts(now);
        
        // Custom formatting to get exactly: Monday, 09/03/2026 17:50:02
        const weekday = parts.find(p => p.type === 'weekday').value;
        const day = parts.find(p => p.type === 'day').value;
        const month = parts.find(p => p.type === 'month').value;
        const year = parts.find(p => p.type === 'year').value;
        const time = parts.filter(p => ['hour', 'minute', 'second'].includes(p.type)).map(p => p.value).join(':');
        
        const preciseTime = `${weekday}, ${day}/${month}/${year} ${time} GMT`;

        // --- 2. FOOTER TIME (05:37 PM style) ---
        const footerTime = now.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: true 
        });

        // --- 3. MAIN INTERFACE ---
        const helpEmbed = new EmbedBuilder()
            .setColor('#00ffcc')
            .setAuthor({ 
                name: 'ARCHITECT CG-223 | CONTROL INTERFACE', 
                iconURL: client.user.displayAvatarURL() 
            })
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription(
                `**Status:** 🟢 ONLINE\n` +
                `**System Time:** \`${preciseTime}\` 🛰️\n` +
                `**Modules Active:** \`${client.commands.size}\` Detectées`
            );

        const icons = {
            'AI': '🧠', 'Gaming': '🎮', 'General': '⚙️',
            'Information': 'ℹ️', 'Moderation': '🛡️', 'Owner': '👑',
            'System': '📡', 'Social': '🌐', 'Utility': '🛠️'
        };

        const categories = {};
        client.commands.forEach(cmd => {
            const cat = cmd.category || 'General';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(cmd.name);
        });

        const sortedCategoryNames = Object.keys(categories).sort();

        for (const category of sortedCategoryNames) {
            const icon = icons[category] || '📁';
            const sortedCmds = categories[category].sort();
            const cmdList = sortedCmds.map(name => `\`${name}\``).join(' • ');

            helpEmbed.addFields({
                name: `${icon} ${category.toUpperCase()}`,
                value: cmdList,
                inline: false
            });
        }

        helpEmbed.setFooter({ text: `Today at ${footerTime} | Bamako Node` });

        await message.reply({ embeds: [helpEmbed] });
    },
};
