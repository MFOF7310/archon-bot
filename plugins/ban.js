const { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        // BAN translations
        banTitle: '⚖️ JUDGMENT RENDERED',
        banEntity: '👤 ENTITY',
        banAuthorizedBy: '🛡️ AUTHORIZED BY',
        banReason: '📝 REASON',
        banDuration: '⏱️ DURATION',
        banPermanent: 'PERMANENT',
        banCaseId: '🔖 CASE ID',
        banFooter: 'Eagle Community Security | Protocol: Ban',
        banSuccess: '✅ **Ban Executed Successfully**',
        banFailed: '❌ **Critical Failure.** Could not execute ban.',
        confirmBanTitle: '⚠️ CONFIRM BAN',
        confirmBanDesc: 'Are you sure you want to permanently ban **{user}**?',
        confirmBanReason: 'Reason: {reason}',
        confirmBanWarning: 'This action is **IRREVERSIBLE** and will be logged.',
        confirmBanButton: '✅ Confirm Ban',
        
        // UNBAN translations
        unbanTitle: '🔓 JUDGMENT OVERTURNED',
        unbanEntity: '👤 ENTITY',
        unbanAuthorizedBy: '🛡️ AUTHORIZED BY',
        unbanReason: '📝 REASON',
        unbanPreviousBan: '📜 PREVIOUS BAN',
        unbanCaseId: '🔖 CASE ID',
        unbanFooter: 'Eagle Community Security | Protocol: Unban',
        unbanSuccess: '✅ **Unban Executed Successfully**',
        unbanFailed: '❌ **Critical Failure.** Could not execute unban.',
        confirmUnbanTitle: '⚠️ CONFIRM UNBAN',
        confirmUnbanDesc: 'Are you sure you want to unban **{user}**?',
        confirmUnbanReason: 'Reason for unban: {reason}',
        confirmUnbanWarning: 'This action will restore access to the user.',
        confirmUnbanButton: '✅ Confirm Unban',
        
        // Common
        noPermission: '❌ **Access Denied.** Authority level insufficient.',
        noTarget: '⚠️ **System Error:** Mention a user, provide an ID, or specify a user ID for unban.',
        selfBan: '❌ Self-termination is not allowed.',
        notBannable: '❌ **Error:** Target authority exceeds system permissions.',
        notBanned: '❌ **Error:** This user is not banned.',
        cancelButton: '❌ Cancel',
        actionCancelled: '❌ Action cancelled.',
        dmBanTitle: '🔨 You have been banned',
        dmBanDesc: 'You have been permanently banned from **{guild}**',
        dmBanReason: 'Reason: {reason}',
        dmBanAppeal: 'If you believe this was a mistake, please contact the server staff.',
        dmUnbanTitle: '🔓 You have been unbanned',
        dmUnbanDesc: 'You have been unbanned from **{guild}**',
        dmUnbanReason: 'Reason: {reason}',
        dmUnbanAppeal: 'Welcome back! Please review the server rules.',
        modLog: '📋 MODERATION LOG',
        actionBan: 'BAN',
        actionUnban: 'UNBAN',
        userId: 'User ID',
        bannedBy: 'Banned by',
        unbannedBy: 'Unbanned by',
        originalReason: 'Original Reason',
        slashBanDesc: 'Permanently ban a member from the server',
        slashUnbanDesc: 'Unban a previously banned member',
        slashUserDesc: 'The member to ban',
        slashUserIdDesc: 'The User ID of the banned member',
        slashReasonDesc: 'Reason for the action',
        slashActionDesc: 'Action to perform (ban or unban)'
    },
    fr: {
        // BAN translations
        banTitle: '⚖️ JUGEMENT RENDU',
        banEntity: '👤 ENTITÉ',
        banAuthorizedBy: '🛡️ AUTORISÉ PAR',
        banReason: '📝 RAISON',
        banDuration: '⏱️ DURÉE',
        banPermanent: 'PERMANENT',
        banCaseId: '🔖 ID DU CAS',
        banFooter: 'Sécurité Eagle Community | Protocole: Bannissement',
        banSuccess: '✅ **Bannissement Exécuté avec Succès**',
        banFailed: '❌ **Échec Critique.** Impossible d\'exécuter le bannissement.',
        confirmBanTitle: '⚠️ CONFIRMER LE BANNISSEMENT',
        confirmBanDesc: 'Êtes-vous sûr de vouloir bannir **{user}** de façon permanente?',
        confirmBanReason: 'Raison: {reason}',
        confirmBanWarning: 'Cette action est **IRREVERSIBLE** et sera enregistrée.',
        confirmBanButton: '✅ Confirmer le Bannissement',
        
        // UNBAN translations
        unbanTitle: '🔓 JUGEMENT ANNULÉ',
        unbanEntity: '👤 ENTITÉ',
        unbanAuthorizedBy: '🛡️ AUTORISÉ PAR',
        unbanReason: '📝 RAISON',
        unbanPreviousBan: '📜 BANNISSEMENT PRÉCÉDENT',
        unbanCaseId: '🔖 ID DU CAS',
        unbanFooter: 'Sécurité Eagle Community | Protocole: Débannissement',
        unbanSuccess: '✅ **Débannissement Exécuté avec Succès**',
        unbanFailed: '❌ **Échec Critique.** Impossible d\'exécuter le débannissement.',
        confirmUnbanTitle: '⚠️ CONFIRMER LE DÉBANNISSEMENT',
        confirmUnbanDesc: 'Êtes-vous sûr de vouloir débannir **{user}**?',
        confirmUnbanReason: 'Raison du débannissement: {reason}',
        confirmUnbanWarning: 'Cette action restaurera l\'accès à l\'utilisateur.',
        confirmUnbanButton: '✅ Confirmer le Débannissement',
        
        // Common
        noPermission: '❌ **Accès Refusé.** Niveau d\'autorité insuffisant.',
        noTarget: '⚠️ **Erreur Système:** Mentionnez un utilisateur, fournissez un ID, ou spécifiez un ID utilisateur pour débannir.',
        selfBan: '❌ L\'auto-bannissement n\'est pas autorisé.',
        notBannable: '❌ **Erreur:** Les autorités de la cible dépassent les permissions système.',
        notBanned: '❌ **Erreur:** Cet utilisateur n\'est pas banni.',
        cancelButton: '❌ Annuler',
        actionCancelled: '❌ Action annulée.',
        dmBanTitle: '🔨 Vous avez été banni',
        dmBanDesc: 'Vous avez été banni définitivement de **{guild}**',
        dmBanReason: 'Raison: {reason}',
        dmBanAppeal: 'Si vous pensez qu\'il s\'agit d\'une erreur, veuillez contacter le personnel du serveur.',
        dmUnbanTitle: '🔓 Vous avez été débanni',
        dmUnbanDesc: 'Vous avez été débanni de **{guild}**',
        dmUnbanReason: 'Raison: {reason}',
        dmUnbanAppeal: 'Bon retour! Veuillez consulter les règles du serveur.',
        modLog: '📋 JOURNAL DE MODÉRATION',
        actionBan: 'BANNISSEMENT',
        actionUnban: 'DÉBANNISSEMENT',
        userId: 'ID Utilisateur',
        bannedBy: 'Banni par',
        unbannedBy: 'Débanni par',
        originalReason: 'Raison Originale',
        slashBanDesc: 'Bannir définitivement un membre du serveur',
        slashUnbanDesc: 'Débannir un membre précédemment banni',
        slashUserDesc: 'Le membre à bannir',
        slashUserIdDesc: 'L\'ID Utilisateur du membre banni',
        slashReasonDesc: 'Raison de l\'action',
        slashActionDesc: 'Action à effectuer (ban ou unban)'
    }
};

// ================= GENERATE CASE ID =================
function generateCaseId(action) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `${action}-${timestamp}-${random}`.toUpperCase();
}

// ================= FETCH BAN INFO =================
async function getBanInfo(guild, userId) {
    try {
        return await guild.bans.fetch(userId);
    } catch (err) {
        return null;
    }
}

// ================= SEND DM =================
async function sendDM(user, guild, reason, action, lang) {
    const t = translations[lang];
    const isBan = action === 'BAN';
    
    try {
        const dmEmbed = new EmbedBuilder()
            .setColor(isBan ? '#ff4757' : '#2ecc71')
            .setTitle(isBan ? t.dmBanTitle : t.dmUnbanTitle)
            .setDescription((isBan ? t.dmBanDesc : t.dmUnbanDesc).replace('{guild}', guild.name))
            .addFields(
                { name: t.dmBanReason, value: reason, inline: false },
                { name: '🛡️', value: isBan ? t.dmBanAppeal : t.dmUnbanAppeal, inline: false }
            )
            .setFooter({ text: guild.name, iconURL: guild.iconURL() })
            .setTimestamp();
        
        await user.send({ embeds: [dmEmbed] });
        return true;
    } catch (err) {
        console.log(`[${action} DM] Could not send DM to ${user.tag}: ${err.message}`);
        return false;
    }
}

// ================= LOG TO MOD CHANNEL =================
async function logToModChannel(guild, embed, client) {
    try {
        const settings = client.getServerSettings ? client.getServerSettings(guild.id) : null;
        const logChannelId = settings?.logChannel || process.env.MOD_LOG_CHANNEL;
        
        if (logChannelId) {
            const logChannel = guild.channels.cache.get(logChannelId);
            if (logChannel) {
                await logChannel.send({ embeds: [embed] });
            }
        }
    } catch (err) {
        console.error('[MOD LOG] Failed to send log:', err.message);
    }
}

module.exports = {
    name: 'ban',
    aliases: ['banish', 'permaban', 'hammer', 'bannir', 'unban', 'pardon', 'debannir'],
    description: '🔨 Ban or unban members from the server.',
    category: 'MODERATION',
    usage: '.ban @user [reason] OR .unban <user_id> [reason]',
    examples: ['.ban @user Spam', '.unban 123456789 Was a mistake'],
    cooldown: 5000,

    // ================= SLASH COMMAND DATA =================
    data: new SlashCommandBuilder()
        .setName('moderate')
        .setDescription('🔨 Ban or unban members from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addSubcommand(sub => sub
            .setName('ban')
            .setDescription('Permanently ban a member from the server')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('The member to ban')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('reason')
                    .setDescription('Reason for the ban')
                    .setRequired(false)
            )
        )
        .addSubcommand(sub => sub
            .setName('unban')
            .setDescription('Unban a previously banned member')
            .addStringOption(option =>
                option.setName('user_id')
                    .setDescription('The User ID of the banned member')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('reason')
                    .setDescription('Reason for the unban')
                    .setRequired(false)
            )
        ),

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
        const t = translations[lang];
        const version = client.version || '1.8.0';
        const action = usedCommand?.toLowerCase();
        const isUnban = action === 'unban' || action === 'pardon' || action === 'debannir';
        
        // Permission check
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.reply({ content: t.noPermission, ephemeral: true }).catch(() => {});
        }
        
        if (isUnban) {
            // ================= UNBAN LOGIC =================
            const userId = args[0];
            const reason = args.slice(1).join(' ') || 'Pardoned by moderator.';
            
            if (!userId || !/^\d+$/.test(userId)) {
                return message.reply({ content: t.noTarget, ephemeral: true }).catch(() => {});
            }
            
            const banInfo = await getBanInfo(message.guild, userId);
            if (!banInfo) {
                return message.reply({ content: t.notBanned, ephemeral: true }).catch(() => {});
            }
            
            let user;
            try {
                user = await client.users.fetch(userId);
            } catch (err) {
                user = { tag: `Unknown User (${userId})`, id: userId };
            }
            
            const caseId = generateCaseId('UNBAN');
            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`unban_confirm_${userId}_${caseId}`)
                    .setLabel(t.confirmUnbanButton)
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setCustomId(`unban_cancel_${userId}`)
                    .setLabel(t.cancelButton)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('❌')
            );
            
            const confirmEmbed = new EmbedBuilder()
                .setColor('#f1c40f')
                .setTitle(t.confirmUnbanTitle)
                .setDescription(t.confirmUnbanDesc.replace('{user}', user.tag))
                .addFields(
                    { name: t.unbanReason, value: `*${reason}*`, inline: false },
                    { name: t.unbanPreviousBan, value: `*${banInfo.reason || 'No reason provided'}*`, inline: false },
                    { name: t.unbanCaseId, value: `\`${caseId}\``, inline: true }
                )
                .setFooter({ text: t.confirmUnbanWarning })
                .setTimestamp();
            
            const confirmMsg = await message.reply({ embeds: [confirmEmbed], components: [confirmRow] }).catch(() => null);
            if (!confirmMsg) return;
            
            const collector = confirmMsg.createMessageComponentCollector({ time: 30000, filter: i => i.user.id === message.author.id });
            
            collector.on('collect', async (i) => {
                if (i.customId.startsWith('unban_confirm')) {
                    await i.deferUpdate();
                    try {
                        await sendDM(user, message.guild, reason, 'UNBAN', lang);
                        await message.guild.members.unban(userId, `${reason} (Unbanned by: ${message.author.tag} | Case: ${caseId})`);
                        
                        const unbanEmbed = new EmbedBuilder()
                            .setColor('#2ecc71')
                            .setTitle(t.unbanTitle)
                            .setThumbnail(user.displayAvatarURL ? user.displayAvatarURL({ dynamic: true, size: 256 }) : null)
                            .addFields(
                                { name: t.unbanEntity, value: `${user.tag}\n(\`${userId}\`)`, inline: true },
                                { name: t.unbanAuthorizedBy, value: `${message.author.tag}\n(\`${message.author.id}\`)`, inline: true },
                                { name: t.unbanReason, value: `*${reason}*`, inline: false },
                                { name: t.unbanPreviousBan, value: `*${banInfo.reason || 'No reason provided'}*`, inline: false },
                                { name: t.unbanCaseId, value: `\`${caseId}\``, inline: true }
                            )
                            .setFooter({ text: `${message.guild.name} • ${t.unbanFooter} • v${version}`, iconURL: message.guild.iconURL() })
                            .setTimestamp();
                        
                        await confirmMsg.edit({ embeds: [unbanEmbed], components: [] });
                        await logToModChannel(message.guild, unbanEmbed, client);
                        console.log(`[UNBAN] ${message.author.tag} unbanned ${user.tag} (${userId}) | Case: ${caseId}`);
                    } catch (error) {
                        console.error('Unban Error:', error);
                        await i.followUp({ content: t.unbanFailed, ephemeral: true });
                    }
                } else if (i.customId.startsWith('unban_cancel')) {
                    await i.deferUpdate();
                    await confirmMsg.edit({ content: t.actionCancelled, embeds: [], components: [] });
                }
                collector.stop();
            });
            
        } else {
            // ================= BAN LOGIC =================
            const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
            const reason = args.slice(1).join(' ') || 'Breach of conduct.';
            
            if (!target) {
                return message.reply({ content: t.noTarget, ephemeral: true }).catch(() => {});
            }
            if (target.id === message.author.id) {
                return message.reply({ content: t.selfBan, ephemeral: true }).catch(() => {});
            }
            if (!target.bannable) {
                return message.reply({ content: t.notBannable, ephemeral: true }).catch(() => {});
            }
            
            const caseId = generateCaseId('BAN');
            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`ban_confirm_${target.id}_${caseId}`)
                    .setLabel(t.confirmBanButton)
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setCustomId(`ban_cancel_${target.id}`)
                    .setLabel(t.cancelButton)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('❌')
            );
            
            const confirmEmbed = new EmbedBuilder()
                .setColor('#ff4757')
                .setTitle(t.confirmBanTitle)
                .setDescription(t.confirmBanDesc.replace('{user}', target.user.tag))
                .addFields(
                    { name: t.banReason, value: `*${reason}*`, inline: false },
                    { name: t.banCaseId, value: `\`${caseId}\``, inline: true },
                    { name: t.banDuration, value: t.banPermanent, inline: true }
                )
                .setFooter({ text: t.confirmBanWarning })
                .setTimestamp();
            
            const confirmMsg = await message.reply({ embeds: [confirmEmbed], components: [confirmRow] }).catch(() => null);
            if (!confirmMsg) return;
            
            const collector = confirmMsg.createMessageComponentCollector({ time: 30000, filter: i => i.user.id === message.author.id });
            
            collector.on('collect', async (i) => {
                if (i.customId.startsWith('ban_confirm')) {
                    await i.deferUpdate();
                    try {
                        await sendDM(target.user, message.guild, reason, 'BAN', lang);
                        await target.ban({ reason: `${reason} (Banned by: ${message.author.tag} | Case: ${caseId})` });
                        
                        const banEmbed = new EmbedBuilder()
                            .setColor('#ff4757')
                            .setTitle(t.banTitle)
                            .setThumbnail(target.user.displayAvatarURL({ dynamic: true, size: 256 }))
                            .addFields(
                                { name: t.banEntity, value: `${target.user.tag}\n(\`${target.id}\`)`, inline: true },
                                { name: t.banAuthorizedBy, value: `${message.author.tag}\n(\`${message.author.id}\`)`, inline: true },
                                { name: t.banReason, value: `*${reason}*`, inline: false },
                                { name: t.banCaseId, value: `\`${caseId}\``, inline: true },
                                { name: t.banDuration, value: t.banPermanent, inline: true }
                            )
                            .setFooter({ text: `${message.guild.name} • ${t.banFooter} • v${version}`, iconURL: message.guild.iconURL() })
                            .setTimestamp();
                        
                        await confirmMsg.edit({ embeds: [banEmbed], components: [] });
                        await logToModChannel(message.guild, banEmbed, client);
                        console.log(`[BAN] ${message.author.tag} banned ${target.user.tag} | Case: ${caseId}`);
                    } catch (error) {
                        console.error('Ban Error:', error);
                        await i.followUp({ content: t.banFailed, ephemeral: true });
                    }
                } else if (i.customId.startsWith('ban_cancel')) {
                    await i.deferUpdate();
                    await confirmMsg.edit({ content: t.actionCancelled, embeds: [], components: [] });
                }
                collector.stop();
            });
        }
    },

    // ================= SLASH COMMAND EXECUTION =================
    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = translations[lang];
        const version = client.version || '1.8.0';
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'ban') {
            // ================= SLASH BAN =================
            const targetUser = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'Breach of conduct.';
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            
            if (!targetMember) return interaction.reply({ content: t.noTarget, ephemeral: true });
            if (targetMember.id === interaction.user.id) return interaction.reply({ content: t.selfBan, ephemeral: true });
            if (!targetMember.bannable) return interaction.reply({ content: t.notBannable, ephemeral: true });
            
            const caseId = generateCaseId('BAN');
            const confirmEmbed = new EmbedBuilder()
                .setColor('#ff4757')
                .setTitle(t.confirmBanTitle)
                .setDescription(t.confirmBanDesc.replace('{user}', targetUser.tag))
                .addFields(
                    { name: t.banReason, value: `*${reason}*`, inline: false },
                    { name: t.banCaseId, value: `\`${caseId}\``, inline: true },
                    { name: t.banDuration, value: t.banPermanent, inline: true }
                )
                .setFooter({ text: t.confirmBanWarning })
                .setTimestamp();
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`ban_confirm_${targetUser.id}_${caseId}`).setLabel(t.confirmBanButton).setStyle(ButtonStyle.Danger).setEmoji('✅'),
                new ButtonBuilder().setCustomId(`ban_cancel_${targetUser.id}`).setLabel(t.cancelButton).setStyle(ButtonStyle.Secondary).setEmoji('❌')
            );
            
            await interaction.reply({ embeds: [confirmEmbed], components: [row], ephemeral: false });
            
            const collector = interaction.channel.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id && i.customId.startsWith('ban_'), time: 30000, max: 1 });
            
            collector.on('collect', async (i) => {
                if (i.customId.startsWith('ban_confirm')) {
                    await i.deferUpdate();
                    try {
                        await sendDM(targetUser, interaction.guild, reason, 'BAN', lang);
                        await targetMember.ban({ reason: `${reason} (Banned by: ${interaction.user.tag} | Case: ${caseId})` });
                        
                        const banEmbed = new EmbedBuilder()
                            .setColor('#ff4757')
                            .setTitle(t.banTitle)
                            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
                            .addFields(
                                { name: t.banEntity, value: `${targetUser.tag}\n(\`${targetUser.id}\`)`, inline: true },
                                { name: t.banAuthorizedBy, value: `${interaction.user.tag}\n(\`${interaction.user.id}\`)`, inline: true },
                                { name: t.banReason, value: `*${reason}*`, inline: false },
                                { name: t.banCaseId, value: `\`${caseId}\``, inline: true },
                                { name: t.banDuration, value: t.banPermanent, inline: true }
                            )
                            .setFooter({ text: `${interaction.guild.name} • ${t.banFooter} • v${version}`, iconURL: interaction.guild.iconURL() })
                            .setTimestamp();
                        
                        await interaction.editReply({ embeds: [banEmbed], components: [] });
                        await logToModChannel(interaction.guild, banEmbed, client);
                    } catch (error) {
                        await i.followUp({ content: t.banFailed, ephemeral: true });
                    }
                } else {
                    await i.deferUpdate();
                    await interaction.editReply({ content: t.actionCancelled, embeds: [], components: [] });
                }
            });
            
        } else if (subcommand === 'unban') {
            // ================= SLASH UNBAN =================
            const userId = interaction.options.getString('user_id');
            const reason = interaction.options.getString('reason') || 'Pardoned by moderator.';
            
            if (!/^\d+$/.test(userId)) return interaction.reply({ content: t.noTarget, ephemeral: true });
            
            const banInfo = await getBanInfo(interaction.guild, userId);
            if (!banInfo) return interaction.reply({ content: t.notBanned, ephemeral: true });
            
            let user;
            try { user = await client.users.fetch(userId); } catch (err) { user = { tag: `Unknown User (${userId})`, id: userId }; }
            
            const caseId = generateCaseId('UNBAN');
            const confirmEmbed = new EmbedBuilder()
                .setColor('#f1c40f')
                .setTitle(t.confirmUnbanTitle)
                .setDescription(t.confirmUnbanDesc.replace('{user}', user.tag))
                .addFields(
                    { name: t.unbanReason, value: `*${reason}*`, inline: false },
                    { name: t.unbanPreviousBan, value: `*${banInfo.reason || 'No reason provided'}*`, inline: false },
                    { name: t.unbanCaseId, value: `\`${caseId}\``, inline: true }
                )
                .setFooter({ text: t.confirmUnbanWarning })
                .setTimestamp();
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`unban_confirm_${userId}_${caseId}`).setLabel(t.confirmUnbanButton).setStyle(ButtonStyle.Success).setEmoji('✅'),
                new ButtonBuilder().setCustomId(`unban_cancel_${userId}`).setLabel(t.cancelButton).setStyle(ButtonStyle.Secondary).setEmoji('❌')
            );
            
            await interaction.reply({ embeds: [confirmEmbed], components: [row], ephemeral: false });
            
            const collector = interaction.channel.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id && i.customId.startsWith('unban_'), time: 30000, max: 1 });
            
            collector.on('collect', async (i) => {
                if (i.customId.startsWith('unban_confirm')) {
                    await i.deferUpdate();
                    try {
                        await sendDM(user, interaction.guild, reason, 'UNBAN', lang);
                        await interaction.guild.members.unban(userId, `${reason} (Unbanned by: ${interaction.user.tag} | Case: ${caseId})`);
                        
                        const unbanEmbed = new EmbedBuilder()
                            .setColor('#2ecc71')
                            .setTitle(t.unbanTitle)
                            .setThumbnail(user.displayAvatarURL ? user.displayAvatarURL({ dynamic: true, size: 256 }) : null)
                            .addFields(
                                { name: t.unbanEntity, value: `${user.tag}\n(\`${userId}\`)`, inline: true },
                                { name: t.unbanAuthorizedBy, value: `${interaction.user.tag}\n(\`${interaction.user.id}\`)`, inline: true },
                                { name: t.unbanReason, value: `*${reason}*`, inline: false },
                                { name: t.unbanPreviousBan, value: `*${banInfo.reason || 'No reason provided'}*`, inline: false },
                                { name: t.unbanCaseId, value: `\`${caseId}\``, inline: true }
                            )
                            .setFooter({ text: `${interaction.guild.name} • ${t.unbanFooter} • v${version}`, iconURL: interaction.guild.iconURL() })
                            .setTimestamp();
                        
                        await interaction.editReply({ embeds: [unbanEmbed], components: [] });
                        await logToModChannel(interaction.guild, unbanEmbed, client);
                    } catch (error) {
                        await i.followUp({ content: t.unbanFailed, ephemeral: true });
                    }
                } else {
                    await i.deferUpdate();
                    await interaction.editReply({ content: t.actionCancelled, embeds: [], components: [] });
                }
            });
        }
    }
};