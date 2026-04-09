const { EmbedBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        title: '✅ IDENTITY UPDATED',
        oldDesignation: 'Old Designation',
        newDesignation: 'New Designation',
        usage: '❌ Usage: `.rename [New Name]`',
        limit: '⚠️ Limit: 20 characters.',
        noChange: '⚠️ New name is the same as your current name.',
        success: (old, newName) => `Your identity has been updated from **${old}** to **${newName}**.`,
        footer: 'Eagle Community • Digital Engine',
        error: '❌ An error occurred while updating your name.',
        updated: 'IDENTITY UPDATED'
    },
    fr: {
        title: '✅ IDENTITÉ MISE À JOUR',
        oldDesignation: 'Ancienne Désignation',
        newDesignation: 'Nouvelle Désignation',
        usage: '❌ Utilisation: `.rename [Nouveau Nom]`',
        limit: '⚠️ Limite: 20 caractères.',
        noChange: '⚠️ Le nouveau nom est identique à votre nom actuel.',
        success: (old, newName) => `Votre identité a été mise à jour de **${old}** à **${newName}**.`,
        footer: 'Eagle Community • Moteur Numérique',
        error: '❌ Une erreur est survenue lors de la mise à jour de votre nom.',
        updated: 'IDENTITÉ MISE À JOUR'
    }
};

module.exports = {
    name: 'rename',
    aliases: ['setname', 'nick', 'changer', 'renommer', 'pseudo'],
    description: '📝 Change your displayed name in the system (max 20 characters).',
    category: 'UTILITY',
    cooldown: 5000,
    usage: '.rename [New Name]',
    examples: ['.rename ShadowHunter', '.rename Ghost', '.changer Fantôme'],

    // 🔥 NEW SIGNATURE: 6 parameters with usedCommand
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        
        // 🔥 NEURAL LANGUAGE BRIDGE - Alias-based detection!
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, 'en')
            : 'en';
        
        const t = translations[lang];
        const version = client.version || '1.6.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        
        const newName = args.join(' ').trim();
        
        // ================= VALIDATION =================
        if (!newName) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setDescription(t.usage)
                .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            return message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }
        
        if (newName.length > 20) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setDescription(t.limit)
                .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            return message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }
        
        // ================= GET USER DATA =================
        let userData = client.getUserData 
            ? client.getUserData(message.author.id) 
            : db.prepare("SELECT username FROM users WHERE id = ?").get(message.author.id);
        
        const oldName = userData?.username || message.author.username;
        
        // Check if name is the same
        if (oldName === newName) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#FEE75C')
                .setDescription(t.noChange)
                .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            return message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }
        
        // ================= UPDATE USER =================
        try {
            if (!userData) {
                // Initialize user if doesn't exist
                db.prepare(`
                    INSERT INTO users (id, username, xp, level, credits, streak_days, last_daily)
                    VALUES (?, ?, 0, 1, 0, 0, 0)
                `).run(message.author.id, newName);
                
                if (client.cacheUserData) {
                    client.cacheUserData(message.author.id, { 
                        id: message.author.id, 
                        username: newName, 
                        xp: 0, 
                        level: 1, 
                        credits: 0 
                    });
                }
            } else {
                // Update existing user
                if (client.queueUserUpdate) {
                    client.queueUserUpdate(message.author.id, {
                        ...userData,
                        username: newName
                    });
                } else {
                    db.prepare("UPDATE users SET username = ? WHERE id = ?").run(newName, message.author.id);
                }
                
                // Update cache
                if (client.cacheUserData) {
                    client.cacheUserData(message.author.id, { ...userData, username: newName });
                }
            }
            
            // ================= SUCCESS EMBED =================
            const successEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setAuthor({ 
                    name: t.updated, 
                    iconURL: message.author.displayAvatarURL() 
                })
                .setTitle(`✅ ${t.title}`)
                .setDescription(t.success(oldName, newName))
                .addFields(
                    { name: t.oldDesignation, value: `\`\`\`\n${oldName}\`\`\``, inline: true },
                    { name: t.newDesignation, value: `\`\`\`\n${newName}\`\`\``, inline: true }
                )
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 256 }))
                .setFooter({ 
                    text: `${guildName} • ${t.footer} • v${version}`, 
                    iconURL: guildIcon 
                })
                .setTimestamp();
            
            await message.reply({ embeds: [successEmbed] }).catch(() => {});
            
            console.log(`[RENAME] ${message.author.tag} changed name: "${oldName}" → "${newName}" | Lang: ${lang}`);
            
        } catch (error) {
            console.error('[RENAME] Error:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setDescription(t.error)
                .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            await message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }
    }
};