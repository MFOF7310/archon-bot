const { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        title: '⚖️ JUDGMENT RENDERED',
        entity: '👤 ENTITY',
        authorizedBy: '🛡️ AUTHORIZED BY',
        reason: '📝 REASON',
        duration: '⏱️ DURATION',
        permanent: 'PERMANENT',
        caseId: '🔖 CASE ID',
        footer: 'Eagle Community Security | Protocol: Ban',
        noPermission: '❌ **Access Denied.** Authority level insufficient.',
        noTarget: '⚠️ **System Error:** Mention a user or provide an ID.',
        selfBan: '❌ Self-termination is not allowed.',
        notBannable: '❌ **Error:** Target authority exceeds system permissions.',
        banSuccess: '✅ **Ban Executed Successfully**',
        banFailed: '❌ **Critical Failure.** Could not execute ban.',
        confirmTitle: '⚠️ CONFIRM BAN',
        confirmDesc: 'Are you sure you want to permanently ban **{user}**?',
        confirmReason: 'Reason: {reason}',
        confirmWarning: 'This action is **IRREVERSIBLE** and will be logged.',
        confirmButton: '✅ Confirm Ban',
        cancelButton: '❌ Cancel',
        actionCancelled: '❌ Ban action cancelled.',
        dmTitle: '🔨 You have been banned',
        dmDesc: 'You have been permanently banned from **{guild}**',
        dmReason: 'Reason: {reason}',
        dmAppeal: 'If you believe this was a mistake, please contact the server staff.',
        slashDescription: 'Permanently ban a member from the server',
        slashUserDesc: 'The member to ban',
        slashReasonDesc: 'Reason for the ban',
        modLog: '📋 MODERATION LOG',
        bannedBy: 'Banned by',
        userId: 'User ID',
        action: 'Action',
        ban: 'BAN'
    },
    fr: {
        title: '⚖️ JUGEMENT RENDU',
        entity: '👤 ENTITÉ',
        authorizedBy: '🛡️ AUTORISÉ PAR',
        reason: '📝 RAISON',
        duration: '⏱️ DURÉE',
        permanent: 'PERMANENT',
        caseId: '🔖 ID DU CAS',
        footer: 'Sécurité Eagle Community | Protocole: Bannissement',
        noPermission: '❌ **Accès Refusé.** Niveau d\'autorité insuffisant.',
        noTarget: '⚠️ **Erreur Système:** Mentionnez un utilisateur ou fournissez un ID.',
        selfBan: '❌ L\'auto-bannissement n\'est pas autorisé.',
        notBannable: '❌ **Erreur:** Les autorités de la cible dépassent les permissions système.',
        banSuccess: '✅ **Bannissement Exécuté avec Succès**',
        banFailed: '❌ **Échec Critique.** Impossible d\'exécuter le bannissement.',
        confirmTitle: '⚠️ CONFIRMER LE BANNISSEMENT',
        confirmDesc: 'Êtes-vous sûr de vouloir bannir **{user}** de façon permanente?',
        confirmReason: 'Raison: {reason}',
        confirmWarning: 'Cette action est **IRREVERSIBLE** et sera enregistrée.',
        confirmButton: '✅ Confirmer le Bannissement',
        cancelButton: '❌ Annuler',
        actionCancelled: '❌ Action de bannissement annulée.',
        dmTitle: '🔨 Vous avez été banni',
        dmDesc: 'Vous avez été banni définitivement de **{guild}**',
        dmReason: 'Raison: {reason}',
        dmAppeal: 'Si vous pensez qu\'il s\'agit d\'une erreur, veuillez contacter le personnel du serveur.',
        slashDescription: 'Bannir définitivement un membre du serveur',
        slashUserDesc: 'Le membre à bannir',
        slashReasonDesc: 'Raison du bannissement',
        modLog: '📋 JOURNAL DE MODÉRATION',
        bannedBy: 'Banni par',
        userId: 'ID Utilisateur',
        action: 'Action',
        ban: 'BANNISSEMENT'
    }
};

// ================= GENERATE CASE ID =================
function generateCaseId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `BAN-${timestamp}-${random}`.toUpperCase();
}

// ================= SEND DM TO BANNED USER =================
async function sendBanDM(user, guild, reason, lang) {
    const t = translations[lang];
    try {
        const dmEmbed = new EmbedBuilder()
            .setColor('#ff4757')
            .setTitle(t.dmTitle)
            .setDescription(t.dmDesc.replace('{guild}', guild.name))
            .addFields(
                { name: t.dmReason, value: reason, inline: false },
                { name: '🛡️', value: t.dmAppeal, inline: false }
            )
            .setFooter({ text: guild.name, iconURL: guild.iconURL() })
            .setTimestamp();
        
        await user.send({ embeds: [dmEmbed] });
        return true;
    } catch (err) {
        console.log(`[BAN DM] Could not send DM to ${user.tag}: ${err.message}`);
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
    aliases: ['banish', 'permaban', 'hammer', 'bannir'],
    description: '🔨 Permanently ban a member from the server.',
    category: 'MODERATION',
    usage: '.ban @user [reason]',
    examples: ['.ban @user Spam', '.ban 123456789 Breaking rules'],
    cooldown: 5000,

    // ================= SLASH COMMAND DATA =================
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('🔨 Permanently ban a member from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The member to ban')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the ban')
                .setRequired(false)
        ),

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        // ================= LANGUAGE DETECTION =================
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
        const t = translations[lang];
        const version = client.version || '1.8.0';
        
        // ================= PERMISSION CHECK =================
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.reply({ content: t.noPermission, ephemeral: true }).catch(() => {});
        }

        // ================= GET TARGET =================
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

        // ================= CONFIRMATION BUTTONS =================
        const caseId = generateCaseId();
        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`ban_confirm_${target.id}_${caseId}`)
                .setLabel(t.confirmButton)
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
            .setTitle(t.confirmTitle)
            .setDescription(t.confirmDesc.replace('{user}', target.user.tag))
            .addFields(
                { name: t.reason, value: `*${reason}*`, inline: false },
                { name: t.caseId, value: `\`${caseId}\``, inline: true },
                { name: t.duration, value: t.permanent, inline: true }
            )
            .setFooter({ text: t.confirmWarning })
            .setTimestamp();

        const confirmMsg = await message.reply({ 
            embeds: [confirmEmbed], 
            components: [confirmRow],
            ephemeral: false
        }).catch(() => null);

        if (!confirmMsg) return;

        // ================= COLLECTOR =================
        const collector = confirmMsg.createMessageComponentCollector({ 
            time: 30000,
            filter: i => i.user.id === message.author.id
        });

        collector.on('collect', async (i) => {
            if (i.customId.startsWith('ban_confirm')) {
                await i.deferUpdate();
                
                try {
                    // Send DM to user before ban
                    await sendBanDM(target.user, message.guild, reason, lang);
                    
                    // Execute ban
                    await target.ban({ reason: `${reason} (Banned by: ${message.author.tag} | Case: ${caseId})` });
                    
                    // Build success embed
                    const banEmbed = new EmbedBuilder()
                        .setColor('#ff4757')
                        .setTitle(t.title)
                        .setThumbnail(target.user.displayAvatarURL({ dynamic: true, size: 256 }))
                        .addFields(
                            { name: t.entity, value: `${target.user.tag}\n(\`${target.id}\`)`, inline: true },
                            { name: t.authorizedBy, value: `${message.author.tag}\n(\`${message.author.id}\`)`, inline: true },
                            { name: t.reason, value: `*${reason}*`, inline: false },
                            { name: t.caseId, value: `\`${caseId}\``, inline: true },
                            { name: t.duration, value: t.permanent, inline: true }
                        )
                        .setFooter({ text: `${message.guild.name} • ${t.footer} • v${version}`, iconURL: message.guild.iconURL() })
                        .setTimestamp();

                    await confirmMsg.edit({ 
                        embeds: [banEmbed], 
                        components: [],
                        content: null
                    }).catch(() => {});

                    // Log to mod channel
                    await logToModChannel(message.guild, banEmbed, client);
                    
                    console.log(`[BAN] ${message.author.tag} banned ${target.user.tag} | Case: ${caseId} | Reason: ${reason}`);
                    
                } catch (error) {
                    console.error('Ban Error:', error);
                    await i.followUp({ content: t.banFailed, ephemeral: true }).catch(() => {});
                }
                
            } else if (i.customId.startsWith('ban_cancel')) {
                await i.deferUpdate();
                await confirmMsg.edit({ 
                    content: t.actionCancelled, 
                    embeds: [], 
                    components: [] 
                }).catch(() => {});
                console.log(`[BAN] ${message.author.tag} cancelled ban on ${target.user.tag}`);
            }
            
            collector.stop();
        });

        collector.on('end', async () => {
            if (confirmMsg.components.length > 0) {
                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('disabled')
                        .setLabel(t.confirmButton)
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(true)
                        .setEmoji('✅'),
                    new ButtonBuilder()
                        .setCustomId('disabled')
                        .setLabel(t.cancelButton)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                        .setEmoji('❌')
                );
                await confirmMsg.edit({ components: [disabledRow] }).catch(() => {});
            }
        });
    },

    // ================= SLASH COMMAND EXECUTION =================
    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = translations[lang];
        const version = client.version || '1.8.0';
        const db = client.db;
        
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'Breach of conduct.';
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        
        if (!targetMember) {
            return interaction.reply({ content: t.noTarget, ephemeral: true });
        }
        
        if (targetMember.id === interaction.user.id) {
            return interaction.reply({ content: t.selfBan, ephemeral: true });
        }
        
        if (!targetMember.bannable) {
            return interaction.reply({ content: t.notBannable, ephemeral: true });
        }
        
        const caseId = generateCaseId();
        
        // Confirmation embed
        const confirmEmbed = new EmbedBuilder()
            .setColor('#ff4757')
            .setTitle(t.confirmTitle)
            .setDescription(t.confirmDesc.replace('{user}', targetUser.tag))
            .addFields(
                { name: t.reason, value: `*${reason}*`, inline: false },
                { name: t.caseId, value: `\`${caseId}\``, inline: true },
                { name: t.duration, value: t.permanent, inline: true }
            )
            .setFooter({ text: t.confirmWarning })
            .setTimestamp();
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`ban_confirm_${targetUser.id}_${caseId}`)
                .setLabel(t.confirmButton)
                .setStyle(ButtonStyle.Danger)
                .setEmoji('✅'),
            new ButtonBuilder()
                .setCustomId(`ban_cancel_${targetUser.id}`)
                .setLabel(t.cancelButton)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('❌')
        );
        
        await interaction.reply({ embeds: [confirmEmbed], components: [row], ephemeral: false });
        
        const collector = interaction.channel.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id && i.customId.startsWith('ban_'),
            time: 30000,
            max: 1
        });
        
        collector.on('collect', async (i) => {
            if (i.customId.startsWith('ban_confirm')) {
                await i.deferUpdate();
                
                try {
                    await sendBanDM(targetUser, interaction.guild, reason, lang);
                    await targetMember.ban({ reason: `${reason} (Banned by: ${interaction.user.tag} | Case: ${caseId})` });
                    
                    const banEmbed = new EmbedBuilder()
                        .setColor('#ff4757')
                        .setTitle(t.title)
                        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
                        .addFields(
                            { name: t.entity, value: `${targetUser.tag}\n(\`${targetUser.id}\`)`, inline: true },
                            { name: t.authorizedBy, value: `${interaction.user.tag}\n(\`${interaction.user.id}\`)`, inline: true },
                            { name: t.reason, value: `*${reason}*`, inline: false },
                            { name: t.caseId, value: `\`${caseId}\``, inline: true },
                            { name: t.duration, value: t.permanent, inline: true }
                        )
                        .setFooter({ text: `${interaction.guild.name} • ${t.footer} • v${version}`, iconURL: interaction.guild.iconURL() })
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [banEmbed], components: [] });
                    await logToModChannel(interaction.guild, banEmbed, client);
                    
                    console.log(`[SLASH BAN] ${interaction.user.tag} banned ${targetUser.tag} | Case: ${caseId}`);
                    
                } catch (error) {
                    console.error('Slash Ban Error:', error);
                    await i.followUp({ content: t.banFailed, ephemeral: true });
                }
                
            } else if (i.customId.startsWith('ban_cancel')) {
                await i.deferUpdate();
                await interaction.editReply({ content: t.actionCancelled, embeds: [], components: [] });
                console.log(`[SLASH BAN] ${interaction.user.tag} cancelled ban on ${targetUser.tag}`);
            }
        });
        
        collector.on('end', async () => {
            try {
                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('disabled')
                        .setLabel(t.confirmButton)
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(true)
                        .setEmoji('✅'),
                    new ButtonBuilder()
                        .setCustomId('disabled')
                        .setLabel(t.cancelButton)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                        .setEmoji('❌')
                );
                await interaction.editReply({ components: [disabledRow] }).catch(() => {});
            } catch (e) {}
        });
    }
};