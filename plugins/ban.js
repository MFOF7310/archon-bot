const { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ================= OWNER SERVER FALLBACK INVITE =================
const OWNER_GUILD_INVITE = 'https://discord.gg/NFSMFJajp9';

// ================= BILINGUAL TRANSLATIONS =================
const i18n = require('../lib/i18n');
const I18N_KEYS = ["banTitle","banEntity","banAuthorizedBy","banReason","banDuration","banPermanent","banCaseId","banFooter","banSuccess","banFailed","confirmBanTitle","confirmBanDesc","confirmBanReason","confirmBanWarning","confirmBanButton","unbanTitle","unbanEntity","unbanAuthorizedBy","unbanReason","unbanPreviousBan","unbanCaseId","unbanFooter","unbanSuccess","unbanFailed","confirmUnbanTitle","confirmUnbanDesc","confirmUnbanReason","confirmUnbanWarning","confirmUnbanButton","inviteTitle","inviteSetSuccess","inviteSetFailed","inviteGetTitle","inviteGetCustom","inviteGetDefault","inviteGetNone","inviteInvalid","inviteUsage","noPermission","noTarget","selfBan","notBannable","notBanned","cancelButton","actionCancelled","dmBanTitle","dmBanDesc","dmBanReason","dmBanAppeal","dmUnbanTitle","dmUnbanDesc","dmUnbanReason","dmUnbanWelcome","dmUnbanFallback","rejoinButton","modLog","actionBan","actionUnban","actionInvite","userId","bannedBy","unbannedBy","originalReason","slashBanDesc","slashUnbanDesc","slashSetinviteDesc","slashGetinviteDesc","slashUserDesc","slashUserIdDesc","slashReasonDesc","slashInviteDesc","slashActionDesc"];
// Clés dans lang/<locale>/ban.json ; '' retombe sur EN dans t().
function loadT(lang) {
    const o = {};
    for (const k of I18N_KEYS) o[k] = i18n.t(`ban.${k}`, lang);
    return o;
}

// ================= DYNAMIC VERSION READER =================
function getBotVersion(client) {
    if (client.version) return client.version;
    try {
        const fs = require('fs');
        const path = require('path');
        const versionPath = path.join(__dirname, '..', 'version.txt');
        if (fs.existsSync(versionPath)) return fs.readFileSync(versionPath, 'utf8').trim();
    } catch (err) {}
    return '3.2.0';
}

// ================= GENERATE CASE ID =================
function generateCaseId(action) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `${action}-${timestamp}-${random}`.toUpperCase();
}

// ================= FETCH BAN INFO =================
async function getBanInfo(guild, userId) {
    try { return await guild.bans.fetch(userId); } catch { return null; }
}

// ================= INVITE MANAGEMENT =================
const INVITE_PATTERN = /^(https?:\/\/)?(discord\.gg\/|discordapp\.com\/invite\/|discord\.com\/invite\/)[a-zA-Z0-9_-]+$/i;

function validateInviteLink(link) {
    return INVITE_PATTERN.test(link);
}

function getServerInvite(db, client, guildId) {
    // 1. Check database for server-specific invite
    try {
        const row = db.prepare('SELECT server_invite FROM server_settings WHERE guild_id = ?').get(guildId);
        if (row?.server_invite) return { invite: row.server_invite, source: 'custom' };
    } catch (e) {}
    // 2. Check if this IS the owner guild
    if (guildId === process.env.GUILD_ID) return { invite: OWNER_GUILD_INVITE, source: 'owner' };
    // 3. Fallback to owner server invite
    return { invite: OWNER_GUILD_INVITE, source: 'fallback' };
}

function setServerInvite(db, client, guildId, inviteLink) {
    try {
        db.prepare('UPDATE server_settings SET server_invite = ?, updated_at = strftime(\'%s\', \'now\') WHERE guild_id = ?').run(inviteLink, guildId);
        client.settings?.delete(guildId);
        return true;
    } catch (e) {
        console.error('[INVITE SET]', e.message);
        return false;
    }
}

// ================= CREATE MIGRATION FOR server_invite COLUMN =================
function ensureInviteColumn(db) {
    try {
        const columns = db.prepare("PRAGMA table_info(server_settings)").all().map(c => c.name);
        if (!columns.includes('server_invite')) {
            db.prepare("ALTER TABLE server_settings ADD COLUMN server_invite TEXT").run();
            console.log('[BAN MIGRATION] Added server_invite column to server_settings');
        }
    } catch (e) {
        console.error('[BAN MIGRATION]', e.message);
    }
}

// ================= SEND DM (with rejoin button for unban) =================
async function sendDM(user, guild, reason, action, lang, inviteData) {
    const t = loadT(lang);
    const isBan = action === 'BAN';

    try {
        const dmEmbed = new EmbedBuilder()
            .setColor(isBan ? '#ff4757' : '#2ecc71')
            .setTitle(isBan ? t.dmBanTitle : t.dmUnbanTitle)
            .setDescription((isBan ? t.dmBanDesc : t.dmUnbanDesc).replace('{guild}', guild.name))
            .addFields(
                { name: isBan ? t.dmBanReason : t.dmUnbanReason, value: reason, inline: false }
            )
            .setFooter({ text: `ARCHON CG-223 • ${guild.name}`, iconURL: guild.iconURL() || undefined })
            .setTimestamp();

        if (isBan) {
            dmEmbed.addFields({ name: '\u200B', value: t.dmBanAppeal, inline: false });
        } else {
            // Unban: Add welcome back message + rejoin button
            const hasInvite = inviteData?.invite;
            dmEmbed.addFields({
                name: '\u200B',
                value: hasInvite ? t.dmUnbanWelcome : t.dmUnbanFallback,
                inline: false
            });

            // Build components with rejoin button
            const components = [];
            if (hasInvite) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel(t.rejoinButton)
                        .setStyle(ButtonStyle.Link)
                        .setURL(inviteData.invite)
                        .setEmoji('🔗')
                );
                components.push(row);
            }

            await user.send({ embeds: [dmEmbed], components }).catch(() => {});
            return true;
        }

        await user.send({ embeds: [dmEmbed] }).catch(() => {});
        return true;
    } catch (err) {
        console.log(`[${action} DM] Could not DM ${user.tag}: ${err.message}`);
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
            if (logChannel) await logChannel.send({ embeds: [embed] });
        }
    } catch (err) {
        console.error('[MOD LOG]', err.message);
    }
}

// ================= HANDLE INVITE SET/GET (shared) =================
async function handleSetInvite(interaction, client, db, lang, isSlash) {
    const t = loadT(lang);
    const guildId = interaction.guild?.id;
    if (!guildId) return;

    let inviteLink;
    if (isSlash) {
        inviteLink = interaction.options.getString('invite');
    } else {
        // Prefix: .ban setinvite <link>
        const args = interaction.content?.slice(client.prefix?.length || 1).trim().split(/ +/) || [];
        inviteLink = args.slice(2).join(' ');
    }

    if (!inviteLink) {
        const reply = { content: t.inviteUsage, flags: isSlash ? 1 << 6 : 0 };
        return isSlash ? interaction.reply(reply) : interaction.reply(reply).catch(() => {});
    }

    // Validate format
    if (!validateInviteLink(inviteLink)) {
        const reply = { content: t.inviteInvalid, flags: isSlash ? 1 << 6 : 0 };
        return isSlash ? interaction.reply(reply) : interaction.reply(reply).catch(() => {});
    }

    // Ensure https:// prefix
    if (!inviteLink.startsWith('http')) inviteLink = 'https://' + inviteLink;

    const success = setServerInvite(db, client, guildId, inviteLink);
    if (success) {
        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle(t.inviteTitle)
            .setDescription(t.inviteSetSuccess)
            .addFields({ name: '🔗 Link', value: inviteLink, inline: false })
            .setFooter({ text: `ARCHON CG-223 • ${interaction.guild?.name || ''}` })
            .setTimestamp();
        return isSlash ? interaction.reply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] }).catch(() => {});
    } else {
        const reply = { content: t.inviteSetFailed, flags: isSlash ? 1 << 6 : 0 };
        return isSlash ? interaction.reply(reply) : interaction.reply(reply).catch(() => {});
    }
}

async function handleGetInvite(interaction, client, db, lang, isSlash) {
    const t = loadT(lang);
    const guildId = interaction.guild?.id;
    if (!guildId) return;

    const inviteData = getServerInvite(db, client, guildId);
    const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle(t.inviteGetTitle)
        .setFooter({ text: `ARCHON CG-223 • ${interaction.guild?.name || ''}` })
        .setTimestamp();

    if (inviteData.source === 'custom') {
        embed.setDescription(t.inviteGetCustom.replace('{invite}', inviteData.invite))
            .addFields({ name: 'Status', value: '✅ Custom per-server invite active', inline: false });
    } else if (inviteData.source === 'owner') {
        embed.setDescription(t.inviteGetOwner.replace('{invite}', inviteData.invite))
            .addFields({ name: 'Status', value: '🏠 Owner guild invite (this server)', inline: false });
    } else {
        embed.setDescription(t.inviteGetDefault.replace('{invite}', inviteData.invite))
            .addFields({ name: 'Status', value: '⚠️ Using fallback (owner server). Set a custom invite with `/ban setinvite`', inline: false });
    }

    return isSlash ? interaction.reply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] }).catch(() => {});
}

// ================= MODULE EXPORTS =================
module.exports = {
    name: 'ban',
    aliases: ['banish', 'permaban', 'hammer', 'bannir', 'unban', 'pardon', 'debannir', 'setinvite', 'getinvite'],
    description: '🔨 Ban or unban members. Manage server rejoin invites.',
    category: 'MODERATION',
    usage: '.ban @user [reason] | .unban <id> [reason] | .ban setinvite <link> | .ban getinvite',
    examples: ['.ban @user Spam', '.unban 123456789 Was a mistake', '.ban setinvite discord.gg/abc123'],
    cooldown: 5000,

    // ================= SLASH COMMAND DATA =================
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('🔨 Ban or unban members from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addSubcommand(sub => sub
            .setName('ban')
            .setDescription('Permanently ban a member from the server')
            .addUserOption(opt => opt.setName('user').setDescription('The member to ban').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason for the ban').setRequired(false))
        )
        .addSubcommand(sub => sub
            .setName('unban')
            .setDescription('Unban a previously banned member')
            .addStringOption(opt => opt.setName('user_id').setDescription('The User ID of the banned member').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason for the unban').setRequired(false))
        )
        .addSubcommand(sub => sub
            .setName('setinvite')
            .setDescription('Set the permanent server invite link for unbanned users')
            .addStringOption(opt => opt.setName('invite').setDescription('Discord invite link (discord.gg/xxxx)').setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('getinvite')
            .setDescription('View the current server invite configuration')
        ),

    // ================= PREFIX COMMAND HANDLER =================
    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        // Ensure DB column exists
        ensureInviteColumn(db);

        
        const t = loadT(lang);
        const version = getBotVersion(client);
        const action = usedCommand?.toLowerCase();

        // Handle invite management subcommands
        if (action === 'setinvite') {
            return handleSetInvite(message, client, db, lang, false);
        }
        if (action === 'getinvite') {
            return handleGetInvite(message, client, db, lang, false);
        }

        const isUnban = action === 'unban' || action === 'pardon' || action === 'debannir';

        // Permission check
        let hasPermission = message.member.permissions.has(PermissionFlagsBits.BanMembers);
        if (!hasPermission && serverSettings?.staffRoles?.moderator) {
            const staffRoles = serverSettings.staffRoles.moderator.split(',').map(r => r.trim());
            hasPermission = message.member.roles.cache.some(role => staffRoles.includes(role.id));
        }
        if (!hasPermission) return message.reply({ content: t.noPermission }).catch(() => {});

        if (isUnban) {
            // ================= PREFIX UNBAN =================
            let rawUserId = args[0];
            if (!rawUserId) return message.reply({ content: t.noTarget }).catch(() => {});
            let userId = rawUserId.replace(/[<@!>]/g, '');
            const reason = args.slice(1).join(' ') || 'Pardoned by moderator.';
            if (!userId || !/^\d+$/.test(userId)) return message.reply({ content: t.noTarget }).catch(() => {});

            const banInfo = await getBanInfo(message.guild, userId);
            if (!banInfo) return message.reply({ content: t.notBanned }).catch(() => {});

            let user;
            try { user = await client.users.fetch(userId); } catch { user = { tag: `Unknown (${userId})`, id: userId }; }

            const caseId = generateCaseId('UNBAN');
            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`unban_confirm_${userId}_${caseId}`).setLabel(t.confirmUnbanButton).setStyle(ButtonStyle.Success).setEmoji('✅'),
                new ButtonBuilder().setCustomId(`unban_cancel_${userId}`).setLabel(t.cancelButton).setStyle(ButtonStyle.Secondary).setEmoji('❌')
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
                        const inviteData = getServerInvite(db, client, message.guild.id);
                        await sendDM(user, message.guild, reason, 'UNBAN', lang, inviteData);
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
                                { name: t.unbanCaseId, value: `\`${caseId}\``, inline: true },
                                { name: '🔗 Rejoin', value: inviteData.invite || OWNER_GUILD_INVITE, inline: true }
                            )
                            .setFooter({ text: `${message.guild.name} • ${t.unbanFooter} • v${version}`, iconURL: message.guild.iconURL() })
                            .setTimestamp();

                        await confirmMsg.edit({ embeds: [unbanEmbed], components: [] });
                        await logToModChannel(message.guild, unbanEmbed, client);
                        console.log(`[UNBAN] ${message.author.tag} unbanned ${user.tag} (${userId}) | Case: ${caseId} | Invite: ${inviteData.source}`);
                    } catch (error) {
                        console.error('Unban Error:', error);
                        await i.followUp({ content: t.unbanFailed, flags: 64 });
                    }
                } else if (i.customId.startsWith('unban_cancel')) {
                    await i.deferUpdate();
                    await confirmMsg.edit({ content: t.actionCancelled, embeds: [], components: [] });
                }
                collector.stop();
            });
        } else {
            // ================= PREFIX BAN =================
            let rawTargetId = args[0];
            let target = message.mentions.members.first();
            if (!target && rawTargetId) {
                const cleanId = rawTargetId.replace(/[<@!>]/g, '');
                target = message.guild.members.cache.get(cleanId);
            }
            const reason = args.slice(1).join(' ') || 'Breach of conduct.';

            if (!target) return message.reply({ content: t.noTarget }).catch(() => {});
            if (target.id === message.author.id) return message.reply({ content: t.selfBan }).catch(() => {});
            if (!target.bannable) return message.reply({ content: t.notBannable }).catch(() => {});

            const caseId = generateCaseId('BAN');
            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`ban_confirm_${target.id}_${caseId}`).setLabel(t.confirmBanButton).setStyle(ButtonStyle.Danger).setEmoji('✅'),
                new ButtonBuilder().setCustomId(`ban_cancel_${target.id}`).setLabel(t.cancelButton).setStyle(ButtonStyle.Secondary).setEmoji('❌')
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
                        await i.followUp({ content: t.banFailed, flags: 64 });
                    }
                } else if (i.customId.startsWith('ban_cancel')) {
                    await i.deferUpdate();
                    await confirmMsg.edit({ content: t.actionCancelled, embeds: [], components: [] });
                }
                collector.stop();
            });
        }
    },

    // ================= SLASH COMMAND HANDLER =================
    execute: async (interaction, client) => {
        // Ensure DB column exists
        if (client.db) ensureInviteColumn(client.db);

        let subcommand = null;
        try { subcommand = interaction.options.getSubcommand(); } catch {
            return interaction.reply({ content: '❌ Use `/ban ban`, `/ban unban`, `/ban setinvite`, or `/ban getinvite`.', flags: 64 });
        }

        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = loadT(lang);
        const version = getBotVersion(client);

        // Handle invite subcommands
        if (subcommand === 'setinvite') {
            return handleSetInvite(interaction, client, client.db, lang, true);
        }
        if (subcommand === 'getinvite') {
            return handleGetInvite(interaction, client, client.db, lang, true);
        }

        if (subcommand === 'ban') {
            // ================= SLASH BAN =================
            const targetUser = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'Breach of conduct.';
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

            if (!targetMember) return interaction.reply({ content: t.noTarget, flags: 64 });
            if (targetMember.id === interaction.user.id) return interaction.reply({ content: t.selfBan, flags: 64 });
            if (!targetMember.bannable) return interaction.reply({ content: t.notBannable, flags: 64 });

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

            const collector = interaction.channel.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id && i.customId.startsWith('ban_'),
                time: 30000, max: 1
            });

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
                    } catch { await i.followUp({ content: t.banFailed, flags: 64 }); }
                } else {
                    await i.deferUpdate();
                    await interaction.editReply({ content: t.actionCancelled, embeds: [], components: [] });
                }
            });

        } else if (subcommand === 'unban') {
            // ================= SLASH UNBAN =================
            const userId = interaction.options.getString('user_id');
            const reason = interaction.options.getString('reason') || 'Pardoned by moderator.';

            if (!/^\d+$/.test(userId)) return interaction.reply({ content: t.noTarget, flags: 64 });

            const banInfo = await getBanInfo(interaction.guild, userId);
            if (!banInfo) return interaction.reply({ content: t.notBanned, flags: 64 });

            let user;
            try { user = await client.users.fetch(userId); } catch { user = { tag: `Unknown (${userId})`, id: userId }; }

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

            const collector = interaction.channel.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id && i.customId.startsWith('unban_'),
                time: 30000, max: 1
            });

            collector.on('collect', async (i) => {
                if (i.customId.startsWith('unban_confirm')) {
                    await i.deferUpdate();
                    try {
                        // GET SERVER-SPECIFIC INVITE FOR REJOIN BUTTON
                        const inviteData = getServerInvite(client.db, client, interaction.guild.id);
                        await sendDM(user, interaction.guild, reason, 'UNBAN', lang, inviteData);
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
                                { name: t.unbanCaseId, value: `\`${caseId}\``, inline: true },
                                { name: '🔗 Rejoin', value: inviteData.invite || OWNER_GUILD_INVITE, inline: true }
                            )
                            .setFooter({ text: `${interaction.guild.name} • ${t.unbanFooter} • v${version}`, iconURL: interaction.guild.iconURL() })
                            .setTimestamp();

                        await interaction.editReply({ embeds: [unbanEmbed], components: [] });
                        await logToModChannel(interaction.guild, unbanEmbed, client);
                        console.log(`[UNBAN] ${interaction.user.tag} unbanned ${user.tag} | Case: ${caseId} | Invite: ${inviteData.source}`);
                    } catch (error) {
                        console.error('Unban Error:', error);
                        await i.followUp({ content: t.unbanFailed, flags: 64 });
                    }
                } else {
                    await i.deferUpdate();
                    await interaction.editReply({ content: t.actionCancelled, embeds: [], components: [] });
                }
            });
        }
    }
};

