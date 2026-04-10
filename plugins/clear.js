const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        title: '🧹 NEURAL PURGE',
        sanitizing: '✨ SANITIZING',
        complete: '✅ PURGE COMPLETE',
        accessDenied: '❌ **Access Denied.**\nYou need `Manage Messages` permission.',
        invalidAmount: (max) => `❌ **Invalid amount.**\nPlease specify a number between 1 and ${max}.`,
        purgedMessages: (count, target) => `🧹 **Sanitization Complete!**\n\`${count}\` messages ${target ? `from **${target}** ` : ''}purged from the neural channel.`,
        noMessages: '⚠️ **No deletable packets identified.**\nMessages must be under 14 days old and not pinned.',
        error: '❌ **Error:** Could not purge messages.',
        footer: 'ARCHITECT CG-223 • Neural Purge System',
        packetsRemoved: 'packets removed',
        fromNode: 'from node',
        targetUser: 'Target User',
        amount: 'Amount',
        reason: 'Reason'
    },
    fr: {
        title: '🧹 PURGE NEURALE',
        sanitizing: '✨ NETTOYAGE',
        complete: '✅ PURGE TERMINÉE',
        accessDenied: '❌ **Accès Refusé.**\nVous avez besoin de la permission `Gérer les Messages`.',
        invalidAmount: (max) => `❌ **Montant invalide.**\nVeuillez spécifier un nombre entre 1 et ${max}.`,
        purgedMessages: (count, target) => `🧹 **Nettoyage Terminé!**\n\`${count}\` messages ${target ? `de **${target}** ` : ''}supprimés du canal neural.`,
        noMessages: '⚠️ **Aucun paquet supprimable identifié.**\nLes messages doivent avoir moins de 14 jours et ne pas être épinglés.',
        error: '❌ **Erreur:** Impossible de purger les messages.',
        footer: 'ARCHITECT CG-223 • Système de Purge Neurale',
        packetsRemoved: 'paquets supprimés',
        fromNode: 'du nœud',
        targetUser: 'Utilisateur Cible',
        amount: 'Quantité',
        reason: 'Raison'
    }
};

module.exports = {
    name: 'clear',
    aliases: ['purge', 'clean', 'nettoyer', 'effacer', 'delete'],
    description: '🧹 Bulk delete messages in the current channel.',
    category: 'MODERATION',
    cooldown: 5000,
    usage: '.clear [amount] [@user]',
    examples: ['.clear 10', '.clear 50 @user', '.clear all'],

    run: async (client, message, args, database, serverSettings, usedCommand) => {
        
        // ================= PERMISSION CHECK =================
        const isArchitect = message.author.id === process.env.OWNER_ID;
        const hasPerms = message.member.permissions.has(PermissionFlagsBits.ManageMessages);
        
        if (!isArchitect && !hasPerms) {
            const lang = serverSettings?.language || 'en';
            const t = translations[lang];
            return message.reply({ content: t.accessDenied, ephemeral: true });
        }

        // ================= LANGUAGE SETUP =================
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, serverSettings?.language || 'en')
            : (serverSettings?.language || 'en');
        const t = translations[lang];
        
        // ✅ DYNAMIC VERSION
        const version = client.version || '1.5.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();

        // Delete command message immediately
        await message.delete().catch(() => null);

        // Parse arguments
        const targetUser = message.mentions.users.first();
        const amountArg = targetUser ? args[1] : args[0];
        const maxAmount = 100; // Discord limit
        
        let amount;
        if (amountArg?.toLowerCase() === 'all') {
            amount = maxAmount;
        } else {
            amount = parseInt(amountArg);
            if (isNaN(amount) || amount < 1) amount = 10;
            if (amount > maxAmount) {
                const errorMsg = await message.channel.send(t.invalidAmount(maxAmount));
                setTimeout(() => errorMsg.delete().catch(() => null), 4000);
                return;
            }
        }

        try {
            // Fetch messages
            const fetched = await message.channel.messages.fetch({ limit: amount });
            
            // Filter messages
            const messagesToDelete = fetched.filter(m => {
                const notPinned = !m.pinned;
                const recent = (Date.now() - m.createdTimestamp) < 1209600000; // 14 days
                const matchesTarget = targetUser ? m.author.id === targetUser.id : true;
                return notPinned && recent && matchesTarget;
            });

            if (messagesToDelete.size === 0) {
                const noFound = await message.channel.send({ 
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#FEE75C')
                            .setAuthor({ name: t.title, iconURL: client.user.displayAvatarURL() })
                            .setDescription(t.noMessages)
                            .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                            .setTimestamp()
                    ]
                });
                setTimeout(() => noFound.delete().catch(() => null), 5000);
                return;
            }

            // Bulk delete
            const deleted = await message.channel.bulkDelete(messagesToDelete, true);
            
            // Create success embed
            const successEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setAuthor({ name: `${t.title} • ${t.complete}`, iconURL: client.user.displayAvatarURL() })
                .setTitle(`🧹 ${t.sanitizing}`)
                .setDescription(
                    targetUser 
                        ? `**${deleted.size}** ${t.packetsRemoved} ${t.fromNode} **${targetUser.username}**.\n` +
                          `\`\`\`yaml\n${t.targetUser}: ${targetUser.tag}\n${t.amount}: ${deleted.size} messages\n\`\`\``
                        : `**${deleted.size}** ${t.packetsRemoved} ${t.fromNode}.\n` +
                          `\`\`\`yaml\n${t.amount}: ${deleted.size} messages\n\`\`\``
                )
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            
            // Add moderator info
            successEmbed.addFields({
                name: '🛡️ Moderator',
                value: `${message.author.tag}`,
                inline: true
            });
            
            const reply = await message.channel.send({ embeds: [successEmbed] });
            
            // Auto-delete confirmation after 5 seconds
            setTimeout(() => reply.delete().catch(() => null), 5000);
            
            // Log the action
            console.log(`[CLEAR] ${message.author.tag} purged ${deleted.size} messages in #${message.channel.name} | Target: ${targetUser?.tag || 'All'} | Lang: ${lang}`);
            
        } catch (err) {
            console.error("[CLEAR] Purge Error:", err);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setAuthor({ name: t.title, iconURL: client.user.displayAvatarURL() })
                .setDescription(t.error)
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            
            const errorMsg = await message.channel.send({ embeds: [errorEmbed] });
            setTimeout(() => errorMsg.delete().catch(() => null), 5000);
        }
    }
};