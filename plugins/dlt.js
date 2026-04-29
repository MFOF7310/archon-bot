const { PermissionFlagsBits, EmbedBuilder, SlashCommandBuilder } = require('discord.js');

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
    aliases: ['delete', 'remove', 'erase', 'effacer', 'supprimer'],
    description: '🗑️ Delete messages by amount, user, or message ID.',
    category: 'MODERATION',
    cooldown: 3000,
    usage: '.dlt [amount/@user/messageID] or reply with .dlt',
    examples: ['.dlt 10', '.dlt @user', '.dlt', '.clear 20'],

    // ================= SLASH COMMAND BUILDER =================
    data: new SlashCommandBuilder()
        .setName('dlt')
        .setDescription('Delete messages with various targeting options')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(sub =>
            sub.setName('bulk')
                .setDescription('Bulk delete recent messages')
                .addIntegerOption(opt =>
                    opt.setName('amount')
                        .setDescription('Number of messages (1-100)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(100)))
        .addSubcommand(sub =>
            sub.setName('user')
                .setDescription('Delete recent messages from a specific user')
                .addUserOption(opt =>
                    opt.setName('target')
                        .setDescription('Target user')
                        .setRequired(true))
                .addIntegerOption(opt =>
                    opt.setName('amount')
                        .setDescription('Number of messages (1-50, default 10)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(50)))
        .addSubcommand(sub =>
            sub.setName('message')
                .setDescription('Delete a specific message by ID')
                .addStringOption(opt =>
                    opt.setName('message_id')
                        .setDescription('The message ID to delete')
                        .setRequired(true))),

    // ================= PREFIX COMMAND =================
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, 'en')
            : 'en';
        
        const t = translations[lang];
        const isArchitect = message.author.id === process.env.OWNER_ID;
        const hasPerms = message.member.permissions.has(PermissionFlagsBits.ManageMessages);
        
        if (!isArchitect && !hasPerms) {
            return message.reply({ content: t.accessDenied, ephemeral: true }).catch(() => {});
        }

        await message.delete().catch(() => {});

        // BULK DELETE
        if (args[0] && /^\d+$/.test(args[0])) {
            const amount = parseInt(args[0]);
            if (amount < 1 || amount > 100) {
                const errorMsg = await message.channel.send({ content: t.invalidCount });
                return setTimeout(() => errorMsg.delete().catch(() => {}), 3000);
            }
            return await bulkDeleteMessages(message.channel, message.author, amount, t, lang);
        }

        // USER DELETE
        if (message.mentions.users.first()) {
            const targetUser = message.mentions.users.first();
            const amount = parseInt(args[1]) || 10;
            if (amount < 1 || amount > 50) {
                const errorMsg = await message.channel.send({ content: t.invalidCount });
                return setTimeout(() => errorMsg.delete().catch(() => {}), 3000);
            }
            return await deleteUserMessages(message.channel, message.author, targetUser, amount, t, lang);
        }

        // SINGLE MESSAGE DELETE
        let targetMsg = null;
        if (message.reference) {
            targetMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
        } else if (args[0] && /^\d+$/.test(args[0])) {
            targetMsg = await message.channel.messages.fetch(args[0]).catch(() => null);
        }

        if (targetMsg) {
            return await deleteSingleMessage(message.channel, message.author, targetMsg, t, lang);
        }

        // HELP
        return showHelp(message, lang);
    },

    // ================= SLASH COMMAND =================
    execute: async (interaction) => {
        const subcommand = interaction.options.getSubcommand();
        const lang = interaction.client.detectLanguage 
            ? interaction.client.detectLanguage('/dlt', 'en')
            : 'en';
        const t = translations[lang];

        await interaction.deferReply({ ephemeral: true });

        try {
            switch (subcommand) {
                case 'bulk': {
                    const amount = interaction.options.getInteger('amount');
                    await bulkDeleteMessages(interaction.channel, interaction.user, amount, t, lang);
                    await interaction.editReply({ content: `✅ Bulk deleted **${amount}** messages.`, ephemeral: true });
                    break;
                }
                case 'user': {
                    const target = interaction.options.getUser('target');
                    const amount = interaction.options.getInteger('amount') || 10;
                    await deleteUserMessages(interaction.channel, interaction.user, target, amount, t, lang);
                    await interaction.editReply({ content: t.userMessagesDeleted(amount, target.username), ephemeral: true });
                    break;
                }
                case 'message': {
                    const messageId = interaction.options.getString('message_id');
                    const targetMsg = await interaction.channel.messages.fetch(messageId).catch(() => null);
                    if (!targetMsg) {
                        return interaction.editReply({ content: '❌ Message not found.', ephemeral: true });
                    }
                    await deleteSingleMessage(interaction.channel, interaction.user, targetMsg, t, lang);
                    await interaction.editReply({ content: t.targetErased, ephemeral: true });
                    break;
                }
            }
        } catch (err) {
            console.error('[DLT] Slash error:', err.message);
            await interaction.editReply({ content: t.errorOld, ephemeral: true }).catch(() => {});
        }
    }
};

// ================= SHARED FUNCTIONS =================

async function bulkDeleteMessages(channel, moderator, amount, t, lang) {
    const fetchingMsg = await channel.send({ content: t.fetching });
    
    try {
        const messages = await channel.messages.fetch({ limit: amount });
        const filtered = messages.filter(m => (Date.now() - m.createdTimestamp) < 1209600000);
        
        if (filtered.size === 0) {
            await fetchingMsg.edit({ content: t.noMessagesFound }).catch(() => {});
            return setTimeout(() => fetchingMsg.delete().catch(() => {}), 3000);
        }
        
        const deleted = await channel.bulkDelete(filtered, true);
        
        const successMsg = await channel.send({ content: t.bulkSuccess(deleted.size), ephemeral: true });
        setTimeout(() => {
            successMsg.delete().catch(() => {});
            fetchingMsg.delete().catch(() => {});
        }, 3000);
        
        console.log(`[DLT] ${moderator.tag} bulk deleted ${deleted.size} messages in #${channel.name} | Lang: ${lang}`);
        
    } catch (err) {
        console.error('[DLT] Bulk delete error:', err);
        await fetchingMsg.edit({ content: t.errorOld }).catch(() => {});
        setTimeout(() => fetchingMsg.delete().catch(() => {}), 3000);
    }
}

async function deleteUserMessages(channel, moderator, targetUser, amount, t, lang) {
    const fetchingMsg = await channel.send({ content: t.fetching });
    
    try {
        const messages = await channel.messages.fetch({ limit: 100 });
        const userMessages = messages.filter(m => m.author.id === targetUser.id).first(amount);
        
        if (userMessages.length === 0) {
            await fetchingMsg.edit({ content: t.noMessagesFound }).catch(() => {});
            return setTimeout(() => fetchingMsg.delete().catch(() => {}), 3000);
        }
        
        for (const msg of userMessages) {
            await msg.delete().catch(() => {});
        }
        
        const successMsg = await channel.send({ content: t.userMessagesDeleted(userMessages.length, targetUser.username), ephemeral: true });
        setTimeout(() => {
            successMsg.delete().catch(() => {});
            fetchingMsg.delete().catch(() => {});
        }, 3000);
        
        console.log(`[DLT] ${moderator.tag} deleted ${userMessages.length} messages from ${targetUser.tag} | Lang: ${lang}`);
        
    } catch (err) {
        console.error('[DLT] User delete error:', err);
        await fetchingMsg.edit({ content: t.errorOld }).catch(() => {});
        setTimeout(() => fetchingMsg.delete().catch(() => {}), 3000);
    }
}

async function deleteSingleMessage(channel, moderator, targetMsg, t, lang) {
    try {
        await targetMsg.delete();
        
        const successMsg = await channel.send({ content: t.targetErased, ephemeral: true });
        setTimeout(() => successMsg.delete().catch(() => {}), 2000);
        
        console.log(`[DLT] ${moderator.tag} deleted message by ${targetMsg.author.tag} (ID: ${targetMsg.id}) | Lang: ${lang}`);
        
    } catch (err) {
        const failMsg = await channel.send({ content: t.errorOld, ephemeral: true });
        setTimeout(() => failMsg.delete().catch(() => {}), 3000);
    }
}

function showHelp(message, lang) {
    const t = translations[lang];
    const version = message.client.version || '1.6.0';
    
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
    
    message.channel.send({ embeds: [helpEmbed] }).then(msg => {
        setTimeout(() => msg.delete().catch(() => {}), 5000);
    });
}