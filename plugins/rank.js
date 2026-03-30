const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'rank',
    aliases: ['level', 'xp', 'dossier', 'profile'],
    description: 'Access an agent\'s neural synchronization level and combat matrix.',
    category: 'PROFILE',
    run: async (client, message, args, userData) => {
        const target = message.mentions.users.first() || message.author;
        
        // userData is now the current user's data from SQLite
        // We need to query for the target user separately if it's not the command author
        let targetData = userData;
        
        if (target.id !== message.author.id) {
            // Query the database for the target user
            const { getUser } = require('../index.js'); // Adjust path as needed
            targetData = getUser(target.id);
        }
        
        const xp = targetData?.xp || 0;
        const level = targetData?.level || 1;
        const totalMessages = targetData?.totalMessages || 0;

        // Get all users from database for ranking
        const db = require('better-sqlite3')('database.sqlite');
        const allUsers = db.prepare("SELECT * FROM users ORDER BY xp DESC").all();
        db.close();
        
        const rankIndex = allUsers.findIndex(user => user.id === target.id);
        const rank = rankIndex === -1 ? 'PENDING' : `#${rankIndex + 1}`;
        const totalUsers = allUsers.length;

        const progressXP = xp % 1000; 
        const percent = Math.floor((progressXP / 1000) * 100);

        const createBar = (p) => {
            const size = 12;
            const filled = Math.round((size * p) / 100);
            return '▰'.repeat(filled) + '▱'.repeat(size - filled);
        };

        const dossierEmbed = new EmbedBuilder()
            .setColor('#00fbff')
            .setAuthor({ 
                name: `AGENT DOSSIER: ${target.username.toUpperCase()}`, 
                iconURL: target.displayAvatarURL({ dynamic: true }) 
            })
            .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 512 }))
            .setDescription(`**Node:** \`Bamako-223\`\n**Status:** \`🟢 NEURAL_SYNC_STABLE\``)
            .addFields(
                { 
                    name: '📊 SYNC TELEMETRY', 
                    value: `\`\`\`ansi\n\u001b[1;36m▣\u001b[0m Level: ${level}\n\u001b[1;34m▣\u001b[0m Rank:  ${rank} / ${totalUsers}\n\u001b[1;32m▣\u001b[0m Total: ${xp.toLocaleString()} XP\n\u001b[1;33m▣\u001b[0m Messages: ${totalMessages.toLocaleString()}\`\`\``, 
                    inline: false 
                },
                { 
                    name: `🚀 PROGRESS TO LEVEL ${level + 1}`, 
                    value: `\`\`\`ansi\n\u001b[1;33m${createBar(percent)}\u001b[0m ${percent}%\`\`\`\n*Sync gap: ${1000 - progressXP} XP.*`, 
                    inline: false 
                }
            );

        // Combat matrix section (you'll need to add this to your SQLite table if you want to keep it)
        dossierEmbed.addFields({ 
            name: '🎮 COMBAT MATRIX', 
            value: `\`\`\`fix\nSTATUS: AWAITING_DATA\nUse .setgame to register combat stats\`\`\``, 
            inline: false 
        });

        dossierEmbed.setFooter({ text: 'EAGLE COMMUNITY • DIGITAL SOVEREIGNTY • BKO-223' })
            .setTimestamp();

        message.reply({ 
            content: `> **Decrypting agent profile... synchronization complete.**`,
            embeds: [dossierEmbed] 
        });
    },
};