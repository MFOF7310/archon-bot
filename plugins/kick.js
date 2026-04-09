const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        accessDenied: '❌ **Access Denied.** `Kick Members` permission required.',
        noTarget: '⚠️ **System Error:** Provide a valid target signature.',
        selfTarget: '❌ Cannot disconnect own session.',
        notKickable: '❌ **Error:** Target has administrative protection.',
        success: '👢 MEMBER DISCONNECTED',
        entity: '👤 ENTITY',
        moderator: '🛡️ MODERATOR',
        log: '📝 REASON',
        reason: 'Operational necessity.',
        error: '❌ **Failure:** Execution error during disconnect.',
        dmTitle: '👢 YOU HAVE BEEN KICKED',
        dmServer: 'Server',
        dmModerator: 'Moderator',
        dmReason: 'Reason',
        dmFooter: 'This is an automated security notification.',
        logChannelTitle: '👢 MEMBER KICKED',
        logUser: 'User',
        logModerator: 'Moderator',
        logReason: 'Reason',
        logChannel: 'Channel',
        footer: 'Eagle Community | Security Module',
        executed: 'Kick executed successfully.'
    },
    fr: {
        accessDenied: '❌ **Accès Refusé.** Permission `Expulser des Membres` requise.',
        noTarget: '⚠️ **Erreur Système:** Fournissez une signature cible valide.',
        selfTarget: '❌ Impossible de déconnecter sa propre session.',
        notKickable: '❌ **Erreur:** La cible a une protection administrative.',
        success: '👢 MEMBRE DÉCONNECTÉ',
        entity: '👤 ENTITÉ',
        moderator: '🛡️ MODÉRATEUR',
        log: '📝 RAISON',
        reason: 'Nécessité opérationnelle.',
        error: '❌ **Échec:** Erreur d\'exécution lors de la déconnexion.',
        dmTitle: '👢 VOUS AVEZ ÉTÉ EXPULSÉ',
        dmServer: 'Serveur',
        dmModerator: 'Modérateur',
        dmReason: 'Raison',
        dmFooter: 'Ceci est une notification de sécurité automatisée.',
        logChannelTitle: '👢 MEMBRE EXPULSÉ',
        logUser: 'Utilisateur',
        logModerator: 'Modérateur',
        logReason: 'Raison',
        logChannel: 'Salon',
        footer: 'Eagle Community | Module de Sécurité',
        executed: 'Expulsion exécutée avec succès.'
    }
};

module.exports = {
    name: 'kick',
    aliases: ['expel', 'remove', 'expulser', 'virer', 'k'],
    description: '👢 Remove a member from the current server.',
    category: 'MODERATION',
    cooldown: 5000,
    userPermissions: ['KickMembers'],
    usage: '.kick @user [reason]',
    examples: ['.kick @user Spamming', '.kick 123456789012345678 Advertising', '.expulser @user Comportement inapproprié'],

    // 🔥 NEW SIGNATURE: 6 parameters with usedCommand
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        
        // 🔥 NEURAL LANGUAGE BRIDGE - Alias-based detection!
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, 'en')
            : 'en';
        
        const t = translations[lang];
        const version = client.version || '1.6.0';
        const guildName = message.guild.name;
        const guildIcon = message.guild.iconURL();
        
        // ================= PERMISSION CHECK =================
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return message.reply({ 
                content: t.accessDenied, 
                ephemeral: true 
            }).catch(() => {});
        }

        // ================= TARGET VALIDATION =================
        const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
        const reason = args.slice(1).join(' ') || t.reason;

        if (!target) {
            return message.reply({ 
                content: t.noTarget, 
                ephemeral: true 
            }).catch(() => {});
        }
        
        if (target.id === message.author.id) {
            return message.reply({ 
                content: t.selfTarget, 
                ephemeral: true 
            }).catch(() => {});
        }
        
        if (!target.kickable) {
            return message.reply({ 
                content: t.notKickable, 
                ephemeral: true 
            }).catch(() => {});
        }

        // ================= SEND DM TO TARGET =================
        try {
            const dmEmbed = new EmbedBuilder()
                .setColor('#ffa502')
                .setTitle(t.dmTitle)
                .setThumbnail(guildIcon)
                .addFields(
                    { name: t.dmServer, value: guildName, inline: true },
                    { name: t.dmModerator, value: message.author.tag, inline: true },
                    { name: t.dmReason, value: reason, inline: false }
                )
                .setFooter({ text: t.dmFooter })
                .setTimestamp();
            
            await target.send({ embeds: [dmEmbed] }).catch(() => {});
        } catch (err) {
            // DM failed - continue anyway
        }

        // ================= EXECUTE KICK =================
        try {
            await target.kick(reason);
            
            // Success embed (public)
            const kickEmbed = new EmbedBuilder()
                .setColor('#ffa502')
                .setTitle(t.success)
                .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: t.entity, value: `${target.user.tag} (${target.id})`, inline: true },
                    { name: t.moderator, value: `${message.author.tag}`, inline: true },
                    { name: t.log, value: `*${reason}*`, inline: false }
                )
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                .setTimestamp();

            await message.channel.send({ embeds: [kickEmbed] }).catch(() => {});
            
            // 🔥 PRIVACY: Ephemeral confirmation to moderator
            await message.reply({ 
                content: `✅ ${t.executed}`,
                ephemeral: true 
            }).catch(() => {});
            
            // ================= LOG TO LOG CHANNEL =================
            if (serverSettings?.logChannel) {
                const logChannel = message.guild.channels.cache.get(serverSettings.logChannel);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor('#ffa502')
                        .setTitle(t.logChannelTitle)
                        .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
                        .addFields(
                            { name: t.logUser, value: `${target.user.tag} (${target.id})`, inline: true },
                            { name: t.logModerator, value: `${message.author.tag} (${message.author.id})`, inline: true },
                            { name: t.logChannel, value: `${message.channel.name}`, inline: true },
                            { name: t.logReason, value: reason, inline: false }
                        )
                        .setFooter({ text: `${guildName} • v${version}` })
                        .setTimestamp();
                    
                    await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
                }
            }
            
            // Console log
            console.log(`[KICK] ${message.author.tag} kicked ${target.user.tag} | Reason: ${reason} | Lang: ${lang}`);
            
        } catch (error) {
            console.error('[KICK] Error:', error);
            return message.reply({ 
                content: t.error, 
                ephemeral: true 
            }).catch(() => {});
        }
    }
};