const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        accessDenied: '❌ **Access Denied.** You need `Manage Messages` permission.',
        targetErased: '🎯 **Target Packet Erased.**',
        errorOld: '⚠️ **Error:** Message too old or missing permissions.',
        noTarget: '❓ **No target signature found.**',
        deletedBy: 'Deleted by',
        messageId: 'Message ID',
        author: 'Author',
        channel: 'Channel',
        reason: 'Reason',
        logTitle: '🗑️ MESSAGE DELETED',
        bulkDelete: '🧹 BULK DELETE',
        bulkSuccess: (count) => `✅ Successfully deleted **${count}** messages.`,
        invalidCount: '❌ Please provide a number between 1-100.',
        provideCount: '❌ Please provide a number of messages to delete.',
        fetching: '🔍 Fetching messages...',
        noMessagesFound: '❌ No messages found to delete.',
        userMessagesDeleted: (count, user) => `✅ Deleted **${count}** messages from **${user}**.`
    },
    fr: {
        accessDenied: '❌ **Accès Refusé.** Permission `Gérer les Messages` requise.',
        targetErased: '🎯 **Paquet Cible Effacé.**',
        errorOld: '⚠️ **Erreur:** Message trop ancien ou permissions manquantes.',
        noTarget: '❓ **Aucune signature cible trouvée.**',
        deletedBy: 'Supprimé par',
        messageId: 'ID Message',
        author: 'Auteur',
        channel: 'Salon',
        reason: 'Raison',
        logTitle: '🗑️ MESSAGE SUPPRIMÉ',
        bulkDelete: '🧹 SUPPRESSION EN MASSE',
        bulkSuccess: (count) => `✅ **${count}** messages supprimés avec succès.`,
        invalidCount: '❌ Veuillez fournir un nombre entre 1-100.',
        provideCount: '❌ Veuillez fournir un nombre de messages à supprimer.',
        fetching: '🔍 Récupération des messages...',
        noMessagesFound: '❌ Aucun message trouvé à supprimer.',
        userMessagesDeleted: (count, user) => `✅ **${count}** messages de **${user}** supprimés.`
    }
};

module.exports = {
    name: 'dlt',
    aliases: ['delete', 'remove', 'erase', 'clear', 'purge', 'effacer', 'supprimer'],
    description: '🗑️ Delete messages by reply, ID, user mention, or bulk amount.',
    category: 'MODERATION',
    cooldown: 3000,
    usage: '.dlt [amount/@user/messageID] or reply with .dlt',
    examples: ['.dlt 10', '.dlt @user', '.dlt', '.clear 20'],

    // 🔥 NEW SIGNATURE: 6 parameters with usedCommand
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        
        // 🔥 NEURAL LANGUAGE BRIDGE - Alias-based detection!
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, 'en')
            : 'en';
        
        const t = translations[lang];
        const version = client.version || '1.6.0';
        const isArchitect = message.author.id === process.env.OWNER_ID;
        const hasPerms = message.member.permissions.has(PermissionFlagsBits.ManageMessages);
        
        // ================= PERMISSION CHECK =================
        if (!isArchitect && !hasPerms) {
            return message.reply({ 
                content: t.accessDenied, 
                ephemeral: true 
            }).catch(() => {});
        }

        // 🔥 PRIVACY: Delete command message immediately
        await message.delete().catch(() => {});

        // ================= BULK DELETE (Amount provided) =================
        if (args[0] && /^\d+$/.test(args[0])) {
            const amount = parseInt(args[0]);
            
            if (amount < 1 || amount > 100) {
                const errorMsg = await message.channel.send({ content: t.invalidCount });
                setTimeout(() => errorMsg.delete().catch(() => {}), 3000);
                return;
            }
            
            const fetchingMsg = await message.channel.send({ content: t.fetching });
            
            try {
                const messages = await message.channel.messages.fetch({ limit: amount });
                const filtered = messages.filter(m => (Date.now() - m.createdTimestamp) < 1209600000); // 14 days
                
                if (filtered.size === 0) {
                    await fetchingMsg.edit({ content: t.noMessagesFound }).catch(() => {});
                    setTimeout(() => fetchingMsg.delete().catch(() => {}), 3000);
                    return;
                }
                
                const deleted = await message.channel.bulkDelete(filtered, true);
                
                const successMsg = await message.channel.send({ 
                    content: t.bulkSuccess(deleted.size),
                    ephemeral: true
                });
                
                setTimeout(() => successMsg.delete().catch(() => {}), 3000);
                
                // Log to console
                console.log(`[DLT] ${message.author.tag} bulk deleted ${deleted.size} messages in #${message.channel.name} | Lang: ${lang}`);
                
            } catch (err) {
                console.error('[DLT] Bulk delete error:', err);
                await fetchingMsg.edit({ content: t.errorOld }).catch(() => {});
                setTimeout(() => fetchingMsg.delete().catch(() => {}), 3000);
            }
            return;
        }

        // ================= USER MENTION (Delete their recent messages) =================
        if (message.mentions.users.first()) {
            const targetUser = message.mentions.users.first();
            const amount = parseInt(args[1]) || 10; // Default 10 messages
            
            if (amount < 1 || amount > 50) {
                const errorMsg = await message.channel.send({ content: t.invalidCount });
                setTimeout(() => errorMsg.delete().catch(() => {}), 3000);
                return;
            }
            
            const fetchingMsg = await message.channel.send({ content: t.fetching });
            
            try {
                const messages = await message.channel.messages.fetch({ limit: 100 });
                const userMessages = messages.filter(m => m.author.id === targetUser.id).first(amount);
                
                if (userMessages.length === 0) {
                    await fetchingMsg.edit({ content: t.noMessagesFound }).catch(() => {});
                    setTimeout(() => fetchingMsg.delete().catch(() => {}), 3000);
                    return;
                }
                
                for (const msg of userMessages) {
                    await msg.delete().catch(() => {});
                }
                
                const successMsg = await message.channel.send({ 
                    content: t.userMessagesDeleted(userMessages.length, targetUser.username),
                    ephemeral: true
                });
                
                setTimeout(() => successMsg.delete().catch(() => {}), 3000);
                
                console.log(`[DLT] ${message.author.tag} deleted ${userMessages.length} messages from ${targetUser.tag} | Lang: ${lang}`);
                
            } catch (err) {
                console.error('[DLT] User delete error:', err);
                await fetchingMsg.edit({ content: t.errorOld }).catch(() => {});
                setTimeout(() => fetchingMsg.delete().catch(() => {}), 3000);
            }
            return;
        }

        // ================= SINGLE MESSAGE DELETE =================
        let targetMsg = null;

        // If replying to a message
        if (message.reference) {
            targetMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
        }
        // If message ID provided as argument
        else if (args[0] && /^\d+$/.test(args[0])) {
            targetMsg = await message.channel.messages.fetch(args[0]).catch(() => null);
        }

        if (targetMsg) {
            try {
                await targetMsg.delete();
                
                const successMsg = await message.channel.send({ 
                    content: t.targetErased,
                    ephemeral: true
                });
                
                setTimeout(() => successMsg.delete().catch(() => {}), 2000);
                
                console.log(`[DLT] ${message.author.tag} deleted message by ${targetMsg.author.tag} (ID: ${targetMsg.id}) | Lang: ${lang}`);
                
            } catch (err) {
                const failMsg = await message.channel.send({ 
                    content: t.errorOld,
                    ephemeral: true
                });
                setTimeout(() => failMsg.delete().catch(() => {}), 3000);
            }
        } else {
            // Show help if no target found
            const helpEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setDescription(
                    `**${t.noTarget}**\n\n` +
                    `**${lang === 'fr' ? 'Utilisation' : 'Usage'}:**\n` +
                    `\`.dlt 10\` - ${lang === 'fr' ? 'Supprime 10 messages' : 'Delete 10 messages'}\n` +
                    `\`.dlt @user\` - ${lang === 'fr' ? 'Supprime les messages d\'un utilisateur' : 'Delete user\'s messages'}\n` +
                    `\`.dlt [messageID]\` - ${lang === 'fr' ? 'Supprime un message spécifique' : 'Delete specific message'}\n` +
                    `*${lang === 'fr' ? 'Répondez à un message avec' : 'Reply to a message with'}* \`.dlt\``
                )
                .setFooter({ text: `ARCHITECT CG-223 • v${version}` });
            
            const helpMsg = await message.channel.send({ embeds: [helpEmbed] });
            setTimeout(() => helpMsg.delete().catch(() => {}), 5000);
        }
    }
};