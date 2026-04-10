const { EmbedBuilder } = require('discord.js');

// ================= 🔥 STOCKAGE AFK (RAM) - DÉFINI EN HAUT =================
const afkUsers = new Map(); // userId -> { reason, timestamp, username, avatar }

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        afkSet: (user, reason) => `✅ **${user}** is now AFK: *${reason}*`,
        afkRemoved: (user) => `👋 Welcome back **${user}**! Your AFK status has been removed.`,
        afkAlreadyRemoved: (user) => `👋 Welcome back **${user}**! Your AFK status has been removed.`,
        justNow: 'just now'
    },
    fr: {
        afkSet: (user, reason) => `✅ **${user}** est maintenant AFK: *${reason}*`,
        afkRemoved: (user) => `👋 Bon retour **${user}**! Votre statut AFK a été retiré.`,
        afkAlreadyRemoved: (user) => `👋 Bon retour **${user}**! Votre statut AFK a été retiré.`,
        justNow: 'à l\'instant'
    }
};

module.exports = {
    name: 'afk',
    aliases: ['away', 'absent', 'brb'],
    description: '📌 Set your AFK status',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.afk [reason]',
    examples: ['.afk Eating', '.afk Sleeping', '.afk In meeting', '.afk'],

    // ================= COMMANDE PRINCIPALE =================
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage?.(usedCommand, 'en') || 'en';
        const t = translations[lang];
        const version = client.version || '1.6.0';
        
        const reason = args.join(' ') || (lang === 'fr' ? 'Indisponible' : 'AFK');
        
        // Vérifier si déjà AFK (toggle off)
        if (afkUsers.has(message.author.id)) {
            afkUsers.delete(message.author.id);
            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setDescription(t.afkRemoved(message.author.username))
                .setFooter({ text: `ARCHITECT CG-223 • v${version}` })
                .setTimestamp();
            return message.reply({ embeds: [embed] });
        }
        
        // Stocker AFK
        afkUsers.set(message.author.id, {
            reason,
            timestamp: Date.now(),
            username: message.author.username,
            avatar: message.author.displayAvatarURL()
        });
        
        const embed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setDescription(t.afkSet(message.author.username, reason))
            .setFooter({ text: `ARCHITECT CG-223 • v${version}` })
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        
        console.log(`[AFK] ${message.author.tag} set AFK: ${reason}`);
    },

    // ================= 🔥 CRITIQUE : EXPORT DE LA MAP =================
    // Cette ligne permet à index.js d'accéder à afkUsers !
    afkUsers: afkUsers
};