const { PermissionFlagsBits, EmbedBuilder, SlashCommandBuilder, Colors } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        accessDeniedTitle: '🚫 ACCESS DENIED',
        accessDeniedDesc: 'You lack the required `Manage Messages` permission in this server.',
        serverContext: 'This command requires a **server context** to verify permissions.',
        targetErased: '✅ **Target Packet Erased.**',
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
        userMessagesDeleted: (count, user) => `✅ Deleted **${count}** messages from **${user}**.`,
        permCheckTitle: '🔐 PERMISSION AUDIT',
        permCheckField: 'You need `ManageMessages` to use this command.',
        permServerField: (guild) => `Server: **${guild}**`,
        permYourRole: 'Your highest role lacks this permission.',
        permBotRole: 'Bot role may also need elevation.',
        dmFallbackNote: '📩 *This message was sent privately to avoid public embarrassment.*',
        helpTitle: '🗑️ DELETE COMMAND',
        usage: 'Usage',
        examples: 'Examples'
    },
    fr: {
        accessDeniedTitle: '🚫 ACCÈS REFUSÉ',
        accessDeniedDesc: 'Vous n\'avez pas la permission `Gérer les Messages` sur ce serveur.',
        serverContext: 'Cette commande nécessite un **contexte serveur** pour vérifier les permissions.',
        targetErased: '✅ **Paquet Cible Effacé.**',
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
        userMessagesDeleted: (count, user) => `✅ **${count}** messages de **${user}** supprimés.`,
        permCheckTitle: '🔐 AUDIT DES PERMISSIONS',
        permCheckField: 'Permission `ManageMessages` requise.',
        permServerField: (guild) => `Serveur: **${guild}**`,
        permYourRole: 'Votre rôle le plus élevé n\'a pas cette permission.',
        permBotRole: 'Le rôle du bot peut aussi nécessiter une élévation.',
        dmFallbackNote: '📩 *Ce message vous a été envoyé en privé pour éviter l\'embarras public.*',
        helpTitle: '🗑️ COMMANDE DELETE',
        usage: 'Utilisation',
        examples: 'Exemples'
    }
};

// ================= PERMISSION CHECKER (PER-SERVER) =================
async function checkDeletePermission(context, t, lang) {
    const isSlash = !!context.isChatInputCommand;
    const user = isSlash ? context.user : context.author;
    const guild = context.guild;
    const member = isSlash ? context.member : context.member;

    // DM / No guild context
    if (!guild) {
        const noGuildEmbed = new EmbedBuilder()
            .setColor(Colors.Gold)
            .setAuthor({ name: t.accessDeniedTitle, iconURL: 'https://cdn.discordapp.com/emojis/1054758365089165392.webp' })
            .setDescription(
                `\`\`\`ansi\n\u001b[1;33m⚠️ ZONE DE COMMANDE INVALIDE\u001b[0m\n\n${t.serverContext}\n\`\`\``
            )
            .addFields(
                { name: '📍 Action Required', value: `Run this command in any server channel.`, inline: false },
                { name: '💡 Tip', value: `Use \`/help\` to see DM-compatible commands.`, inline: false }
            )
            .setFooter({ text: `ARCHITECT CG-223 • BAMAKO_223 🇲🇱` })
            .setTimestamp();

        if (isSlash) {
            await context.reply({ embeds: [noGuildEmbed], ephemeral: true }).catch(() => {});
        } else {
            await context.reply({ embeds: [noGuildEmbed] }).catch(() => {});
            setTimeout(() => context.delete().catch(() => {}), 8000);
        }
        return { ok: false, reason: 'no_guild' };
    }

    // Check member permissions
    const hasManageMessages = member?.permissions?.has(PermissionFlagsBits.ManageMessages);
    const isOwner = guild.ownerId === user.id;
    const isArchitect = user.id === process.env.OWNER_ID;

    if (!hasManageMessages && !isOwner && !isArchitect) {
        // PREMIUM FALLBACK: DM the user a beautiful embed instead of crashing or public shaming
        const permEmbed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setAuthor({ name: t.accessDeniedTitle, iconURL: guild.iconURL({ size: 128 }) })
            .setTitle('🔐 Neural Gate Closed')
            .setDescription(
                `\`\`\`ansi\n\u001b[1;31m${t.accessDeniedDesc}\u001b[0m\n\`\`\``
            )
            .addFields(
                { name: '🏛️ Server', value: `**${guild.name}**`, inline: true },
                { name: '👤 User', value: `<@${user.id}>`, inline: true },
                { name: '🛡️ Required', value: '`ManageMessages`', inline: true },
                { name: '❌ Your Status', value: t.permYourRole, inline: false },
                { name: '🤖 Bot Status', value: t.permBotRole, inline: false }
            )
            .setFooter({ text: `${t.dmFallbackNote} • ARCHITECT CG-223` })
            .setTimestamp();

        try {
            // Try DM first (private, no embarrassment)
            await user.send({ embeds: [permEmbed] });
        } catch (dmErr) {
            // Fallback: ephemeral reply in channel if DMs blocked
            if (isSlash) {
                await context.reply({ embeds: [permEmbed], ephemeral: true }).catch(() => {});
            } else {
                const fallbackMsg = await context.channel.send({
                    content: `<@${user.id}>`,
                    embeds: [permEmbed],
                    allowedMentions: { users: [user.id] }
                }).catch(() => {});
                setTimeout(() => fallbackMsg?.delete().catch(() => {}), 10000);
            }
        }
        return { ok: false, reason: 'no_permission' };
    }

    return { ok: true, isArchitect, isOwner };
}

// ================= AUDIT LOGGER (PER-SERVER) =================
async function logDeletion(guild, moderator, targetMsg, type, count = 1, client) {
    try {
        const settings = client.getServerSettings?.(guild.id);
        const logChannelId = settings?.modLogChannel || settings?.logChannel;
        if (!logChannelId) return;

        const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
        if (!logChannel) return;

        const logEmbed = new EmbedBuilder()
            .setColor(Colors.DarkRed)
            .setAuthor({ name: '🗑️ MODERATION LOG', iconURL: guild.iconURL() })
            .addFields(
                { name: '👤 Moderator', value: `<@${moderator.id}> (${moderator.tag})`, inline: true },
                { name: '📋 Type', value: type, inline: true },
                { name: '🔢 Count', value: String(count), inline: true },
                { name: '📅 Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            )
            .setFooter({ text: `Server: ${guild.name} • ID: ${guild.id}` })
            .setTimestamp();

        if (targetMsg) {
            logEmbed.addFields(
                { name: '✍️ Author', value: `<@${targetMsg.author.id}>`, inline: true },
                { name: '📍 Channel', value: `<#${targetMsg.channel.id}>`, inline: true },
                { name: '🆔 Message ID', value: targetMsg.id, inline: true }
            );
        }

        await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
    } catch (e) {
        // Silent fail — logging is best-effort
    }
}

module.exports = {
    name: 'dlt',
    aliases: ['delete', 'remove', 'erase', 'supprimer', 'effacer'],
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
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand) : 'en';
        const t = translations[lang];

        // PER-SERVER PERMISSION CHECK
        const permCheck = await checkDeletePermission(message, t, lang);
        if (!permCheck.ok) return; // Graceful exit — no crash, user already notified via DM/embed

        await message.delete().catch(() => {});

        // BULK DELETE
        if (args[0] && /^\d+$/.test(args[0])) {
            const amount = parseInt(args[0]);
            if (amount < 1 || amount > 100) {
                const errorMsg = await message.channel.send({ content: t.invalidCount });
                return setTimeout(() => errorMsg.delete().catch(() => {}), 3000);
            }
            return await bulkDeleteMessages(message.channel, message.author, amount, t, lang, client);
        }

        // USER DELETE
        if (message.mentions.users.first()) {
            const targetUser = message.mentions.users.first();
            const amount = parseInt(args[1]) || 10;
            if (amount < 1 || amount > 50) {
                const errorMsg = await message.channel.send({ content: t.invalidCount });
                return setTimeout(() => errorMsg.delete().catch(() => {}), 3000);
            }
            return await deleteUserMessages(message.channel, message.author, targetUser, amount, t, lang, client);
        }

        // SINGLE MESSAGE DELETE
        let targetMsg = null;
        if (message.reference) {
            targetMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
        } else if (args[0] && /^\d+$/.test(args[0])) {
            targetMsg = await message.channel.messages.fetch(args[0]).catch(() => null);
        }

        if (targetMsg) {
            return await deleteSingleMessage(message.channel, message.author, targetMsg, t, lang, client);
        }

        // HELP
        return showHelp(message, lang);
    },

    // ================= SLASH COMMAND =================
    execute: async (interaction, client) => {
        const subcommand = interaction.options.getSubcommand();
        const lang = interaction.client.detectLanguage ? interaction.client.detectLanguage('/dlt') : 'en';
        const t = translations[lang];

        // PER-SERVER PERMISSION CHECK
        const permCheck = await checkDeletePermission(interaction, t, lang);
        if (!permCheck.ok) return; // Graceful exit — no crash

        await interaction.deferReply({ ephemeral: true });

        try {
            switch (subcommand) {
                case 'bulk': {
                    const amount = interaction.options.getInteger('amount');
                    await bulkDeleteMessages(interaction.channel, interaction.user, amount, t, lang, client);
                    await interaction.editReply({ content: `✅ Bulk deleted **${amount}** messages.`, ephemeral: true });
                    break;
                }
                case 'user': {
                    const target = interaction.options.getUser('target');
                    const amount = interaction.options.getInteger('amount') || 10;
                    await deleteUserMessages(interaction.channel, interaction.user, target, amount, t, lang, client);
                    await interaction.editReply({ content: t.userMessagesDeleted(amount, target.username), ephemeral: true });
                    break;
                }
                case 'message': {
                    const messageId = interaction.options.getString('message_id');
                    const targetMsg = await interaction.channel.messages.fetch(messageId).catch(() => null);
                    if (!targetMsg) {
                        return interaction.editReply({ content: '❌ Message not found.', ephemeral: true });
                    }
                    await deleteSingleMessage(interaction.channel, interaction.user, targetMsg, t, lang, client);
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

async function bulkDeleteMessages(channel, moderator, amount, t, lang, client) {
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

        // Log to server mod log
        if (client && channel.guild) {
            await logDeletion(channel.guild, moderator, null, 'BULK DELETE', deleted.size, client);
        }

        console.log(`[DLT] ${moderator.tag} bulk deleted ${deleted.size} messages in #${channel.name} | Lang: ${lang}`);

    } catch (err) {
        console.error('[DLT] Bulk delete error:', err);
        await fetchingMsg.edit({ content: t.errorOld }).catch(() => {});
        setTimeout(() => fetchingMsg.delete().catch(() => {}), 3000);
    }
}

async function deleteUserMessages(channel, moderator, targetUser, amount, t, lang, client) {
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

        if (client && channel.guild) {
            await logDeletion(channel.guild, moderator, null, 'USER PURGE', userMessages.length, client);
        }

        console.log(`[DLT] ${moderator.tag} deleted ${userMessages.length} messages from ${targetUser.tag} | Lang: ${lang}`);

    } catch (err) {
        console.error('[DLT] User delete error:', err);
        await fetchingMsg.edit({ content: t.errorOld }).catch(() => {});
        setTimeout(() => fetchingMsg.delete().catch(() => {}), 3000);
    }
}

async function deleteSingleMessage(channel, moderator, targetMsg, t, lang, client) {
    try {
        await targetMsg.delete();

        const successMsg = await channel.send({ content: t.targetErased, ephemeral: true });
        setTimeout(() => successMsg.delete().catch(() => {}), 2000);

        if (client && channel.guild) {
            await logDeletion(channel.guild, moderator, targetMsg, 'SINGLE DELETE', 1, client);
        }

        console.log(`[DLT] ${moderator.tag} deleted message by ${targetMsg.author.tag} (ID: ${targetMsg.id}) | Lang: ${lang}`);

    } catch (err) {
        const failMsg = await channel.send({ content: t.errorOld, ephemeral: true });
        setTimeout(() => failMsg.delete().catch(() => {}), 3000);
    }
}

function showHelp(message, lang) {
    const t = translations[lang];
    const version = message.client.version || PLUGIN_VERSION || '3.0.5';

    const helpEmbed = new EmbedBuilder()
        .setColor(Colors.DarkRed)
        .setAuthor({ name: `🗑️ ${t.helpTitle}`, iconURL: message.client.user.displayAvatarURL() })
        .setDescription(
            `### ${t.noTarget}\n\n` +
            `**${t.usage}:**\n` +
            `\`.dlt 10\` — ${lang === 'fr' ? 'Supprime 10 messages' : 'Delete 10 messages'}\n` +
            `\`.dlt @user\` — ${lang === 'fr' ? 'Supprime les messages d\'un utilisateur' : 'Delete user\'s messages'}\n` +
            `\`.dlt [messageID]\` — ${lang === 'fr' ? 'Supprime un message spécifique' : 'Delete specific message'}\n` +
            `*${lang === 'fr' ? 'Répondez à un message avec' : 'Reply to a message with'}* \`.dlt\``
        )
        .addFields(
            { name: `📌 ${t.examples}`, value: '`.dlt 10` • `.dlt @user` • `.dlt 123456789`', inline: false },
            { name: '🛡️ Permission', value: '`ManageMessages` required per server', inline: true },
            { name: '⚡ Slash', value: '`/dlt bulk` • `/dlt user` • `/dlt message`', inline: true }
        )
        .setFooter({ text: `ARCHITECT CG-223 • v${version} • BAMAKO_223 🇲🇱` })
        .setTimestamp();

    message.channel.send({ embeds: [helpEmbed] }).then(msg => {
        setTimeout(() => msg.delete().catch(() => {}), 8000);
    });
}
