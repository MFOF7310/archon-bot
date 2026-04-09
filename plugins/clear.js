const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        accessDenied: '❌ **Access Denied.** You need `Manage Messages` permission.',
        sanitization: (count) => `✨ **Sanitization:** ${count} packets removed from node.`,
        noPackets: '⚠️ **No deletable packets identified.**',
        error: '❌ **Error:** Could not purge messages.',
        fetching: '🔍 Scanning channel for packets...',
        invalidAmount: '❌ Please provide a number between 1-100.',
        userPurge: (count, user) => `✨ **Sanitization:** ${count} packets from **${user}** removed.`,
        allMessages: 'all messages',
        pinnedSkipped: '📌 Pinned messages preserved.',
        oldSkipped: '⏰ Messages older than 14 days preserved.',
        summary: '📊 PURGE SUMMARY',
        totalDeleted: 'Total Deleted',
        target: 'Target',
        moderator: 'Moderator',
        channel: 'Channel',
        timestamp: 'Timestamp'
    },
    fr: {
        accessDenied: '❌ **Accès Refusé.** Permission `Gérer les Messages` requise.',
        sanitization: (count) => `✨ **Assainissement:** ${count} paquets retirés du nœud.`,
        noPackets: '⚠️ **Aucun paquet supprimable identifié.**',
        error: '❌ **Erreur:** Impossible de purger les messages.',
        fetching: '🔍 Analyse du canal à la recherche de paquets...',
        invalidAmount: '❌ Veuillez fournir un nombre entre 1-100.',
        userPurge: (count, user) => `✨ **Assainissement:** ${count} paquets de **${user}** retirés.`,
        allMessages: 'tous les messages',
        pinnedSkipped: '📌 Messages épinglés préservés.',
        oldSkipped: '⏰ Messages de plus de 14 jours préservés.',
        summary: '📊 RÉSUMÉ DE LA PURGE',
        totalDeleted: 'Total Supprimé',
        target: 'Cible',
        moderator: 'Modérateur',
        channel: 'Salon',
        timestamp: 'Horodatage'
    }
};

module.exports = {
    name: 'clear',
    aliases: ['purge', 'clean', 'nettoyer', 'effacer', 'bulkdelete'],
    description: '🧹 Bulk delete messages in the current channel.',
    category: 'MODERATION',
    cooldown: 5000,
    usage: '.clear [amount] [@user]',
    examples: ['.clear 10', '.clear 50 @user', '.clear all', '.purge 100'],

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

        // ================= PARSE ARGUMENTS =================
        const targetUser = message.mentions.users.first();
        let amountArg = targetUser ? args[1] : args[0];
        
        // Handle "all" keyword
        let amount;
        if (amountArg?.toLowerCase() === 'all') {
            amount = 100;
        } else {
            amount = parseInt(amountArg);
            if (isNaN(amount) || amount < 1) amount = 10;
        }
        
        // Discord limit
        amount = Math.min(amount, 100);
        
        // ================= FETCHING MESSAGE =================
        const fetchingMsg = await message.channel.send({ 
            content: `🔍 ${t.fetching}`,
            ephemeral: true
        }).catch(() => null);

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

            // Count skipped messages
            const pinnedCount = fetched.filter(m => m.pinned).size;
            const oldCount = fetched.filter(m => (Date.now() - m.createdTimestamp) >= 1209600000).size;

            if (messagesToDelete.size > 0) {
                // Perform bulk delete
                const deleted = await message.channel.bulkDelete(messagesToDelete, true);
                
                // Create success message
                const successContent = targetUser 
                    ? t.userPurge(deleted.size, targetUser.username)
                    : t.sanitization(deleted.size);
                
                // Add skipped info if any
                let fullContent = successContent;
                if (pinnedCount > 0) fullContent += `\n${t.pinnedSkipped}`;
                if (oldCount > 0) fullContent += `\n${t.oldSkipped}`;
                
                // Delete fetching message if it exists
                if (fetchingMsg) await fetchingMsg.delete().catch(() => {});
                
                // Send ephemeral success
                const successMsg = await message.channel.send({ 
                    content: fullContent,
                    ephemeral: true
                }).catch(() => {});
                
                // Auto-delete after 5 seconds
                setTimeout(() => successMsg?.delete().catch(() => {}), 5000);
                
                // Console log
                console.log(`[CLEAR] ${message.author.tag} deleted ${deleted.size} messages${targetUser ? ` from ${targetUser.tag}` : ''} in #${message.channel.name} | Lang: ${lang}`);
                
            } else {
                // No messages to delete
                if (fetchingMsg) await fetchingMsg.delete().catch(() => {});
                
                let noPacketsContent = t.noPackets;
                if (pinnedCount > 0) noPacketsContent += `\n${t.pinnedSkipped}`;
                if (oldCount > 0) noPacketsContent += `\n${t.oldSkipped}`;
                
                const noFoundMsg = await message.channel.send({ 
                    content: noPacketsContent,
                    ephemeral: true
                }).catch(() => {});
                
                setTimeout(() => noFoundMsg?.delete().catch(() => {}), 5000);
            }
            
        } catch (err) {
            console.error('[CLEAR] Error:', err);
            
            if (fetchingMsg) await fetchingMsg.delete().catch(() => {});
            
            const errorMsg = await message.channel.send({ 
                content: t.error,
                ephemeral: true
            }).catch(() => {});
            
            setTimeout(() => errorMsg?.delete().catch(() => {}), 5000);
        }
    }
};