// plugins/afk.js
const { EmbedBuilder } = require('discord.js');

const afkUsers = new Map(); // userId -> { reason, timestamp }

module.exports = {
    name: 'afk',
    aliases: ['away', 'absent', 'brb'],
    description: '📌 Set your AFK status',
    category: 'UTILITY',
    usage: '.afk [reason]',
    examples: ['.afk Manger', '.afk Sleeping', '.afk'],

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage?.(usedCommand, 'en') || 'en';
        const reason = args.join(' ') || (lang === 'fr' ? 'Indisponible' : 'AFK');
        
        afkUsers.set(message.author.id, {
            reason,
            timestamp: Date.now(),
            username: message.author.username
        });
        
        const embed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setDescription(lang === 'fr' 
                ? `✅ **${message.author.username}** est maintenant AFK: *${reason}*`
                : `✅ **${message.author.username}** is now AFK: *${reason}*`);
        
        await message.reply({ embeds: [embed] });
    },
    
    // Export pour usage dans messageCreate
    afkUsers
};