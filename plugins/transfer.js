const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');

// ================= ARCHON COLOR PALETTE =================
const ARCHON = {
    green: '#2ecc71',
    red: '#e74c3c',
    gold: '#f1c40f',
    purple: '#9b59b6',
    blue: '#3498db',
    orange: '#e67e22',
    gray: '#95a5a6',
    dark: '#2c3e50',
    neural: '#00ff88',
    alert: '#ff3333',
    steel: '#708090'
};

// ================= BILINGUAL TRANSLATIONS =================
const transferTranslations = {
    en: {
        title: '💸 NEURAL TRANSFER PROTOCOL',
        transferComplete: '✅ TRANSFER EXECUTED',
        from: 'SENDER',
        to: 'RECIPIENT',
        amount: 'AMOUNT',
        yourNewBalance: 'SENDER NEW BALANCE',
        recipientNewBalance: 'RECIPIENT NEW BALANCE',
        crossPlatform: 'Cross-platform bridge active',
        usage: '❌ INVALID SYNTAX',
        usageDesc: 'Usage: `.transfer @user <amount>` or `.transfer <telegram_id> <amount>`',
        minTransfer: '❌ MINIMUM TRANSFER',
        minTransferDesc: 'Minimum transfer amount is **10 🪙**',
        selfTransfer: '❌ SELF-TRANSFER BLOCKED',
        selfTransferDesc: 'You cannot transfer credits to yourself.',
        noAccount: '❌ ACCOUNT NOT INITIALIZED',
        noAccountDesc: 'Send a message first to initialize your neural profile.',
        insufficient: '❌ INSUFFICIENT FUNDS',
        insufficientDesc: 'Your current balance:',
        telegramNotification: '💰 NEURAL TRANSFER RECEIVED',
        fromUser: 'SENDER',
        useBalance: (prefix) => `Use \`${prefix}bal\` or \`${prefix}credits\` to verify your balance.`,
        verifyWith: 'Verify with',
        footer: 'NEURAL TRANSFER • ARCHON CG-223',
        previousBalance: 'PREVIOUS BALANCE',
        transactionFee: 'TRANSACTION FEE',
        free: '0.00 🪙 (FREE)',
        receipt: 'TRANSFER RECEIPT',
        confirmTitle: '⚠️ CONFIRM TRANSFER',
        confirmDesc: 'You are about to transfer credits. This action is irreversible.',
        confirmBtn: '✅ CONFIRM',
        cancelBtn: '❌ CANCEL',
        cancelled: '❌ TRANSFER ABORTED',
        cancelledDesc: 'Operation cancelled by user. No credits were moved.',
        processing: '⏳ PROCESSING...',
        processingDesc: 'Neural transfer protocol executing...',
        success: '✅ TRANSFER SUCCESSFUL',
        successDesc: 'Credits have been securely transferred.',
        dmSubject: '💸 INCOMING TRANSFER',
        dmDesc: 'has sent you credits via the ARCHON neural network.',
        historyTitle: '📋 TRANSFER HISTORY',
        noHistory: 'No recent transactions found.',
        checkBalance: '💰 CHECK BALANCE',
        viewHistory: '📋 VIEW HISTORY',
        accessDenied: '❌ UNAUTHORIZED — This interface is biometrically locked.',
        perServer: 'PER-SERVER ISOLATION ACTIVE',
        invalidTarget: '❌ INVALID TARGET',
        invalidTargetDesc: 'Could not resolve the target user. Please mention a valid user or provide a valid Telegram ID.'
    },
    fr: {
        title: '💸 PROTOCOLE DE TRANSFERT NEURAL',
        transferComplete: '✅ TRANSFERT EXÉCUTÉ',
        from: 'EXPÉDITEUR',
        to: 'DESTINATAIRE',
        amount: 'MONTANT',
        yourNewBalance: 'NOUVEAU SOLDE EXPÉDITEUR',
        recipientNewBalance: 'NOUVEAU SOLDE DESTINATAIRE',
        crossPlatform: 'Pont multiplateforme actif',
        usage: '❌ SYNTAXE INVALIDE',
        usageDesc: 'Usage : `.transfer @utilisateur <montant>` ou `.transfer <telegram_id> <montant>`',
        minTransfer: '❌ TRANSFERT MINIMUM',
        minTransferDesc: 'Le montant minimum de transfert est de **10 🪙**',
        selfTransfer: '❌ AUTO-TRANSFERT BLOQUÉ',
        selfTransferDesc: 'Vous ne pouvez pas vous transférer des crédits à vous-même.',
        noAccount: '❌ COMPTE NON INITIALISÉ',
        noAccountDesc: 'Envoyez d\'abord un message pour initialiser votre profil neural.',
        insufficient: '❌ FONDS INSUFFISANTS',
        insufficientDesc: 'Votre solde actuel :',
        telegramNotification: '💰 TRANSFERT NEURAL REÇU',
        fromUser: 'EXPÉDITEUR',
        useBalance: (prefix) => `Utilisez \`${prefix}bal\` ou \`${prefix}credits\` pour vérifier votre solde.`,
        verifyWith: 'Vérifiez avec',
        footer: 'TRANSFERT NEURAL • ARCHON CG-223',
        previousBalance: 'SOLDE PRÉCÉDENT',
        transactionFee: 'FRAIS DE TRANSACTION',
        free: '0,00 🪙 (GRATUIT)',
        receipt: 'REÇU DE TRANSFERT',
        confirmTitle: '⚠️ CONFIRMER LE TRANSFERT',
        confirmDesc: 'Vous êtes sur le point de transférer des crédits. Cette action est irréversible.',
        confirmBtn: '✅ CONFIRMER',
        cancelBtn: '❌ ANNULER',
        cancelled: '❌ TRANSFERT ABANDONNÉ',
        cancelledDesc: 'Opération annulée par l\'utilisateur. Aucun crédit n\'a été déplacé.',
        processing: '⏳ TRAITEMENT...',
        processingDesc: 'Exécution du protocole de transfert neural...',
        success: '✅ TRANSFERT RÉUSSI',
        successDesc: 'Les crédits ont été transférés en toute sécurité.',
        dmSubject: '💸 TRANSFERT ENTRANT',
        dmDesc: 'vous a envoyé des crédits via le réseau neural ARCHON.',
        historyTitle: '📋 HISTORIQUE DES TRANSFERTS',
        noHistory: 'Aucune transaction récente trouvée.',
        checkBalance: '💰 VÉRIFIER LE SOLDE',
        viewHistory: '📋 VOIR L\'HISTORIQUE',
        accessDenied: '❌ NON AUTORISÉ — Cette interface est verrouillée biométriquement.',
        perServer: 'ISOLATION PAR SERVEUR ACTIVE',
        invalidTarget: '❌ CIBLE INVALIDE',
        invalidTargetDesc: 'Impossible de résoudre l\'utilisateur cible. Mentionnez un utilisateur valide ou fournissez un ID Telegram valide.'
    }
};

module.exports = {
    name: 'transfer',
    aliases: ['send', 'pay', 'envoyer', 'payer', 'virement'],
    description: '💸 Transfer credits to another agent via the neural network.',
    category: 'ECONOMY',
    usage: '<@user|telegram_id> <amount>',
    cooldown: 5000,
    examples: ['.transfer @user 500', '.transfer 5076150691 1000'],

    // ================= SLASH COMMAND DATA =================
    data: new SlashCommandBuilder()
        .setName('transfer')
        .setDescription('💸 Transfer credits to another agent via the neural network')
        .addIntegerOption(opt => opt
            .setName('amount')
            .setDescription('Amount of credits to transfer / Montant de crédits à transférer')
            .setRequired(true)
            .setMinValue(10))
        .addUserOption(opt => opt
            .setName('user')
            .setDescription('User to send credits to / Utilisateur destinataire')
            .setRequired(false))
        .addStringOption(opt => opt
            .setName('telegram_id')
            .setDescription('Telegram ID to send credits to / ID Telegram')
            .setRequired(false)),

    // ═══════════════════════════════════════════════════════
    // PREFIX COMMAND
    // ═══════════════════════════════════════════════════════
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
        const t = transferTranslations[lang];
        const version = client.version || '1.7.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        const prefix = serverSettings?.prefix || '.';
        const guildId = message.guild?.id || 'DM';

        const userId = message.author.id;
        const username = message.author.username;

        // ═══════════════════════════════════════════════════════
        // PARSE TARGET
        // ═══════════════════════════════════════════════════════
        let targetId, targetName, targetAvatar, isTelegram = false;

        if (message.mentions.users.first()) {
            const target = message.mentions.users.first();
            targetId = target.id;
            targetName = target.username;
            targetAvatar = target.displayAvatarURL();
        } else if (args[0] && /^\d+$/.test(args[0])) {
            const linked = db.prepare("SELECT discord_id FROM user_links WHERE telegram_id = ?").get(args[0]);
            if (linked) {
                targetId = linked.discord_id;
                targetName = `Telegram:${args[0]}`;
                isTelegram = true;
            } else {
                // Try to resolve as Discord ID
                try {
                    const resolvedUser = await client.users.fetch(args[0]).catch(() => null);
                    if (resolvedUser) {
                        targetId = resolvedUser.id;
                        targetName = resolvedUser.username;
                        targetAvatar = resolvedUser.displayAvatarURL();
                    } else {
                        targetId = args[0];
                        targetName = `Unknown:${args[0]}`;
                    }
                } catch {
                    targetId = args[0];
                    targetName = `Unknown:${args[0]}`;
                }
            }
        } else {
            const errorEmbed = new EmbedBuilder()
                .setColor(ARCHON.red)
                .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.title}`, iconURL: client.user.displayAvatarURL() })
                .setTitle(`\`\`\`ansi\n\u001b[1;31m  ${t.usage}\u001b[0m\n\`\`\``)
                .setDescription(`\`\`\`ansi\n\u001b[0;37m  ${t.usageDesc}\u001b[0m\n\`\`\``)
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });
            return message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }

        // ═══════════════════════════════════════════════════════
        // VALIDATE AMOUNT
        // ═══════════════════════════════════════════════════════
        const amount = parseInt(args[1]);
        if (isNaN(amount) || amount < 10) {
            const errorEmbed = new EmbedBuilder()
                .setColor(ARCHON.red)
                .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.title}`, iconURL: client.user.displayAvatarURL() })
                .setTitle(`\`\`\`ansi\n\u001b[1;31m  ${t.minTransfer}\u001b[0m\n\`\`\``)
                .setDescription(`\`\`\`ansi\n\u001b[0;37m  ${t.minTransferDesc}\u001b[0m\n\`\`\``)
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });
            return message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }

        if (targetId === userId) {
            const errorEmbed = new EmbedBuilder()
                .setColor(ARCHON.red)
                .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.title}`, iconURL: client.user.displayAvatarURL() })
                .setTitle(`\`\`\`ansi\n\u001b[1;31m  ${t.selfTransfer}\u001b[0m\n\`\`\``)
                .setDescription(`\`\`\`ansi\n\u001b[0;37m  ${t.selfTransferDesc}\u001b[0m\n\`\`\``)
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });
            return message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }

        // ═══════════════════════════════════════════════════════
        // GET SENDER DATA (PER-SERVER)
        // ═══════════════════════════════════════════════════════
        let senderData = client.getUserData ? client.getUserData(userId, guildId) : db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
        if (!senderData) {
            const errorEmbed = new EmbedBuilder()
                .setColor(ARCHON.red)
                .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.title}`, iconURL: client.user.displayAvatarURL() })
                .setTitle(`\`\`\`ansi\n\u001b[1;31m  ${t.noAccount}\u001b[0m\n\`\`\``)
                .setDescription(`\`\`\`ansi\n\u001b[0;37m  ${t.noAccountDesc}\u001b[0m\n\`\`\``)
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });
            return message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }

        const oldSenderBalance = senderData.credits || 0;

        if (oldSenderBalance < amount) {
            const errorEmbed = new EmbedBuilder()
                .setColor(ARCHON.red)
                .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.title}`, iconURL: client.user.displayAvatarURL() })
                .setTitle(`\`\`\`ansi\n\u001b[1;31m  ${t.insufficient}\u001b[0m\n\`\`\``)
                .setDescription(
                    `\`\`\`ansi\n` +
                    `\u001b[0;37m  ${t.insufficientDesc}\u001b[0m\n` +
                    `\u001b[1;33m  ${oldSenderBalance.toLocaleString()} 🪙\u001b[0m\n` +
                    `\`\`\``
                )
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });
            return message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }

        // ═══════════════════════════════════════════════════════
        // GET OR CREATE RECEIVER (PER-SERVER)
        // ═══════════════════════════════════════════════════════
        let receiverData = db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(targetId, guildId);
        const oldReceiverBalance = receiverData?.credits || 0;

        if (!receiverData) {
            db.prepare("INSERT INTO users (id, guild_id, username, xp, level, credits) VALUES (?, ?, ?, 0, 1, 0)").run(targetId, guildId, targetName);
            receiverData = { credits: 0 };
        }

        // ═══════════════════════════════════════════════════════
        // CONFIRMATION INTERFACE
        // ═══════════════════════════════════════════════════════
        const confirmEmbed = new EmbedBuilder()
            .setColor(ARCHON.gold)
            .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.title}`, iconURL: message.author.displayAvatarURL() })
            .setTitle(`\`\`\`ansi\n\u001b[1;33m  ⚠️ ${t.confirmTitle}\u001b[0m\n\`\`\``)
            .setDescription(
                `\`\`\`ansi\n` +
                `\u001b[1;36m  ${t.from}:\u001b[0m ${username}\n` +
                `\u001b[1;36m  ${t.to}:\u001b[0m ${targetName} ${isTelegram ? '📱' : ''}\n` +
                `\u001b[1;36m  ${t.amount}:\u001b[0m \u001b[1;33m${amount.toLocaleString()} 🪙\u001b[0m\n` +
                `\u001b[1;36m  ${t.transactionFee}:\u001b[0m ${t.free}\n\n` +
                `\u001b[0;37m  ${t.confirmDesc}\u001b[0m\n` +
                `\`\`\``
            )
            .addFields(
                { name: `📊 ${t.previousBalance}`, value: `\`\`\`ansi\n\u001b[1;33m${oldSenderBalance.toLocaleString()} 🪙\u001b[0m\n\`\`\``, inline: true },
                { name: `💰 ${t.yourNewBalance}`, value: `\`\`\`ansi\n\u001b[1;32m${(oldSenderBalance - amount).toLocaleString()} 🪙\u001b[0m\n\`\`\``, inline: true }
            )
            .setFooter({ text: `${guildName} • ${t.perServer} • v${version}`, iconURL: guildIcon })
            .setTimestamp();

        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`transfer_confirm_${userId}_${Date.now()}`)
                .setLabel(t.confirmBtn)
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅'),
            new ButtonBuilder()
                .setCustomId(`transfer_cancel_${userId}_${Date.now()}`)
                .setLabel(t.cancelBtn)
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌')
        );

        const confirmMsg = await message.reply({ embeds: [confirmEmbed], components: [confirmRow] }).catch(() => {});
        if (!confirmMsg) return;

        const confirmCollector = confirmMsg.createMessageComponentCollector({ time: 30000 });

        confirmCollector.on('collect', async (i) => {
            if (i.user.id !== userId) {
                return i.reply({ content: t.accessDenied, ephemeral: true }).catch(() => {});
            }

            await i.deferUpdate().catch(() => {});

            if (i.customId.startsWith('transfer_cancel_')) {
                const cancelEmbed = new EmbedBuilder()
                    .setColor(ARCHON.gray)
                    .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.title}`, iconURL: message.author.displayAvatarURL() })
                    .setTitle(`\`\`\`ansi\n\u001b[1;31m  ${t.cancelled}\u001b[0m\n\`\`\``)
                    .setDescription(`\`\`\`ansi\n\u001b[0;37m  ${t.cancelledDesc}\u001b[0m\n\`\`\``)
                    .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });
                await i.editReply({ embeds: [cancelEmbed], components: [] }).catch(() => {});
                confirmCollector.stop();
                return;
            }

            // ═══════════════════════════════════════════════════════
            // PROCESS TRANSFER
            // ═══════════════════════════════════════════════════════
            const newSenderCredits = oldSenderBalance - amount;
            const newReceiverCredits = oldReceiverBalance + amount;

            // Update sender (PER-SERVER)
            db.prepare("UPDATE users SET credits = ? WHERE id = ? AND guild_id = ?").run(newSenderCredits, userId, guildId);
            // Update receiver (PER-SERVER)
            db.prepare("UPDATE users SET credits = ? WHERE id = ? AND guild_id = ?").run(newReceiverCredits, targetId, guildId);

            // Cache invalidation
            if (client.queueUserUpdate) {
                client.queueUserUpdate(userId, guildId, { ...senderData, credits: newSenderCredits });
                client.queueUserUpdate(targetId, guildId, { ...receiverData, credits: newReceiverCredits });
            }

            if (client.userDataCache) {
                client.userDataCache.delete(`${userId}:${guildId}`);
                client.userDataCache.delete(`${targetId}:${guildId}`);
            }

            // Log transfer
            try {
                db.prepare("INSERT INTO transfers (sender_id, receiver_id, amount, timestamp, platform, guild_id) VALUES (?, ?, ?, ?, ?, ?)")
                    .run(userId, targetId, amount, Date.now(), isTelegram ? 'discord_to_telegram' : 'discord', guildId);
            } catch (e) {}

            // ═══════════════════════════════════════════════════════
            // SUCCESS RECEIPT EMBED
            // ═══════════════════════════════════════════════════════
            const receiptEmbed = new EmbedBuilder()
                .setColor(ARCHON.green)
                .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.success}`, iconURL: message.author.displayAvatarURL() })
                .setTitle(`\`\`\`ansi\n\u001b[1;32m  ✅ ${t.transferComplete}\u001b[0m\n\`\`\``)
                .setDescription(
                    `\`\`\`ansi\n` +
                    `\u001b[1;36m  ${t.from}:\u001b[0m ${username}\n` +
                    `\u001b[1;36m  ${t.to}:\u001b[0m ${targetName} ${isTelegram ? '📱' : ''}\n` +
                    `\u001b[1;36m  ${t.amount}:\u001b[0m \u001b[1;33m${amount.toLocaleString()} 🪙\u001b[0m\n` +
                    `\u001b[1;36m  ${t.transactionFee}:\u001b[0m ${t.free}\n` +
                    `\`\`\``
                )
                .addFields(
                    { name: `📊 ${t.previousBalance}`, value: `\`\`\`ansi\n\u001b[1;33m${oldSenderBalance.toLocaleString()} 🪙\u001b[0m\n\`\`\``, inline: true },
                    { name: `💰 ${t.yourNewBalance}`, value: `\`\`\`ansi\n\u001b[1;32m${newSenderCredits.toLocaleString()} 🪙\u001b[0m\n\`\`\``, inline: true },
                    { name: `🎯 ${t.recipientNewBalance}`, value: `\`\`\`ansi\n\u001b[1;36m${newReceiverCredits.toLocaleString()} 🪙\u001b[0m\n\`\`\``, inline: true }
                )
                .setFooter({ text: `${guildName} • ${t.perServer} • ${t.footer} • v${version}`, iconURL: guildIcon })
                .setTimestamp();

            // Action buttons
            const buttonRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`transfer_balance_${userId}`)
                    .setLabel(t.checkBalance)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('💰'),
                new ButtonBuilder()
                    .setCustomId(`transfer_history_${userId}`)
                    .setLabel(t.viewHistory)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📋')
            );

            await i.editReply({ embeds: [receiptEmbed], components: [buttonRow] }).catch(() => {});
            confirmCollector.stop();

            // ═══════════════════════════════════════════════════════
            // NOTIFY RECIPIENT (DM)
            // ═══════════════════════════════════════════════════════
            if (!isTelegram) {
                try {
                    const recipient = await client.users.fetch(targetId).catch(() => null);
                    if (recipient) {
                        const notifyEmbed = new EmbedBuilder()
                            .setColor(ARCHON.green)
                            .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.dmSubject}`, iconURL: message.author.displayAvatarURL() })
                            .setTitle(`\`\`\`ansi\n\u001b[1;32m  💰 ${t.dmSubject}\u001b[0m\n\`\`\``)
                            .setDescription(
                                `\`\`\`ansi\n` +
                                `\u001b[1;36m  ${t.fromUser}:\u001b[0m ${username}\n` +
                                `\u001b[1;36m  ${t.amount}:\u001b[0m \u001b[1;33m${amount.toLocaleString()} 🪙\u001b[0m\n\n` +
                                `\u001b[0;37m  ${t.dmDesc}\u001b[0m\n` +
                                `\`\`\``
                            )
                            .addFields(
                                { name: `📊 ${t.previousBalance}`, value: `\`\`\`ansi\n\u001b[1;33m${oldReceiverBalance.toLocaleString()} 🪙\u001b[0m\n\`\`\``, inline: true },
                                { name: `💰 ${t.recipientNewBalance}`, value: `\`\`\`ansi\n\u001b[1;32m${newReceiverCredits.toLocaleString()} 🪙\u001b[0m\n\`\`\``, inline: true }
                            )
                            .setFooter({ text: `${guildName} • ${t.footer} • v${version}` })
                            .setTimestamp();
                        await recipient.send({ embeds: [notifyEmbed] }).catch(() => {});
                    }
                } catch (e) {}
            }

            // Cross-platform Telegram notification
            if (isTelegram && client.telegramBridge?.enabled) {
                const telegramId = args[0];
                client.telegramBridge.send(
                    `🦅 *ARCHON NEURAL TRANSFER*\n\n` +
                    `💰 *${t.telegramNotification}*\n\n` +
                    `*${t.fromUser}:* ${username} (Discord)\n` +
                    `*${t.amount}:* ${amount.toLocaleString()} 🪙\n` +
                    `*${t.previousBalance}:* ${oldReceiverBalance.toLocaleString()} 🪙\n` +
                    `*${t.recipientNewBalance}:* ${newReceiverCredits.toLocaleString()} 🪙\n\n` +
                    t.useBalance(prefix)
                ).catch(() => {});
            }

            console.log(`[TRANSFER] ${username} → ${targetName} | ${amount} 🪙 | Guild: ${guildId} | Lang: ${lang}`);
        });

        // ═══════════════════════════════════════════════════════
        // BUTTON COLLECTOR FOR RECEIPT ACTIONS
        // ═══════════════════════════════════════════════════════
        const receiptCollector = confirmMsg.createMessageComponentCollector({ time: 60000 });

        receiptCollector.on('collect', async (i) => {
            if (i.user.id !== userId) {
                return i.reply({ content: t.accessDenied, ephemeral: true }).catch(() => {});
            }

            await i.deferReply({ ephemeral: true }).catch(() => {});

            if (i.customId.startsWith('transfer_balance_')) {
                const senderDataFresh = client.getUserData ? client.getUserData(userId, guildId) : db.prepare("SELECT credits FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
                const currentBalance = senderDataFresh?.credits || 0;

                const balanceEmbed = new EmbedBuilder()
                    .setColor(ARCHON.green)
                    .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.checkBalance}`, iconURL: message.author.displayAvatarURL() })
                    .setTitle(`\`\`\`ansi\n\u001b[1;32m  💰 ${currentBalance.toLocaleString()} 🪙\u001b[0m\n\`\`\``)
                    .setFooter({ text: `${guildName} • ${t.footer}` });
                await i.followUp({ embeds: [balanceEmbed], ephemeral: true }).catch(() => {});
            }

            if (i.customId.startsWith('transfer_history_')) {
                const history = db.prepare(`
                    SELECT * FROM transfers
                    WHERE (sender_id = ? OR receiver_id = ?) AND guild_id = ?
                    ORDER BY timestamp DESC LIMIT 5
                `).all(userId, userId, guildId);

                let historyText = '';
                history.forEach(tx => {
                    const isSender = tx.sender_id === userId;
                    const sign = isSender ? '➖' : '➕';
                    const otherParty = isSender ? tx.receiver_id : tx.sender_id;
                    const date = new Date(tx.timestamp).toLocaleDateString();
                    historyText += `\`\`\`ansi\n\u001b[1;${isSender ? '31' : '32'}m${sign} ${tx.amount.toLocaleString()} 🪙\u001b[0m \u001b[0;37m${isSender ? '→' : '←'} \u001b[0m\u001b[1;36m${otherParty.slice(0, 8)}...\u001b[0m \u001b[0;37m[${date}]\u001b[0m\n\`\`\``;
                });

                const historyEmbed = new EmbedBuilder()
                    .setColor(ARCHON.blue)
                    .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.historyTitle}`, iconURL: message.author.displayAvatarURL() })
                    .setDescription(historyText || `\`\`\`ansi\n\u001b[0;37m  ${t.noHistory}\u001b[0m\n\`\`\``)
                    .setFooter({ text: `${guildName} • ${t.footer}` });
                await i.followUp({ embeds: [historyEmbed], ephemeral: true }).catch(() => {});
            }
        });
    },

    // ═══════════════════════════════════════════════════════
    // SLASH COMMAND EXECUTION
    // ═══════════════════════════════════════════════════════
    execute: async (interaction, client) => {
        const serverLang = client.getServerSettings?.(interaction.guild?.id)?.language;
        const lang = serverLang === 'fr' ? 'fr' : serverLang === 'en' ? 'en' : (interaction.locale?.startsWith('fr') ? 'fr' : 'en');
        const t = transferTranslations[lang];
        const guildId = interaction.guild?.id || 'DM';
        const guildName = interaction.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = interaction.guild?.iconURL() || client.user.displayAvatarURL();
        const version = client.version || '1.7.0';
        const prefix = client.getServerSettings ? (client.getServerSettings(guildId)?.prefix || '.') : '.';

        const amount = interaction.options.getInteger('amount');
        const targetUser = interaction.options.getUser('user');
        const telegramId = interaction.options.getString('telegram_id');

        // Validate target
        if (!targetUser && !telegramId) {
            const errorEmbed = new EmbedBuilder()
                .setColor(ARCHON.red)
                .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.title}`, iconURL: client.user.displayAvatarURL() })
                .setTitle(`\`\`\`ansi\n\u001b[1;31m  ${t.invalidTarget}\u001b[0m\n\`\`\``)
                .setDescription(`\`\`\`ansi\n\u001b[0;37m  ${t.invalidTargetDesc}\u001b[0m\n\`\`\``)
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        await interaction.deferReply();

        const db = client.db;
        const userId = interaction.user.id;
        const username = interaction.user.username;

        // Determine target
        let targetId, targetName, isTelegram = false;

        if (targetUser) {
            targetId = targetUser.id;
            targetName = targetUser.username;
        } else if (telegramId) {
            const linked = db.prepare("SELECT discord_id FROM user_links WHERE telegram_id = ?").get(telegramId);
            if (linked) {
                targetId = linked.discord_id;
                targetName = `Telegram:${telegramId}`;
                isTelegram = true;
            } else {
                targetId = telegramId;
                targetName = `Telegram:${telegramId}`;
                isTelegram = true;
            }
        }

        // Self-transfer check
        if (targetId === userId) {
            const errorEmbed = new EmbedBuilder()
                .setColor(ARCHON.red)
                .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.title}`, iconURL: interaction.user.displayAvatarURL() })
                .setTitle(`\`\`\`ansi\n\u001b[1;31m  ${t.selfTransfer}\u001b[0m\n\`\`\``)
                .setDescription(`\`\`\`ansi\n\u001b[0;37m  ${t.selfTransferDesc}\u001b[0m\n\`\`\``)
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });
            return interaction.editReply({ embeds: [errorEmbed] });
        }

        // Get sender data (PER-SERVER)
        let senderData = client.getUserData ? client.getUserData(userId, guildId) : db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
        if (!senderData) {
            // Auto-create user profile
            try {
                db.prepare("INSERT OR IGNORE INTO users (id, guild_id, username, xp, level, credits) VALUES (?, ?, ?, 0, 1, 0)").run(userId, guildId, username);
                senderData = db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
            } catch(e) {}
        }
        if (!senderData) {
            const errorEmbed = new EmbedBuilder()
                .setColor(ARCHON.red)
                .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.title}`, iconURL: interaction.user.displayAvatarURL() })
                .setTitle(`\`\`\`ansi\n\u001b[1;31m  ${t.noAccount}\u001b[0m\n\`\`\``)
                .setDescription(`\`\`\`ansi\n\u001b[0;37m  ${t.noAccountDesc}\u001b[0m\n\`\`\``)
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });
            return interaction.editReply({ embeds: [errorEmbed] });
        }

        const oldSenderBalance = senderData.credits || 0;

        if (oldSenderBalance < amount) {
            const errorEmbed = new EmbedBuilder()
                .setColor(ARCHON.red)
                .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.title}`, iconURL: interaction.user.displayAvatarURL() })
                .setTitle(`\`\`\`ansi\n\u001b[1;31m  ${t.insufficient}\u001b[0m\n\`\`\``)
                .setDescription(
                    `\`\`\`ansi\n` +
                    `\u001b[0;37m  ${t.insufficientDesc}\u001b[0m\n` +
                    `\u001b[1;33m  ${oldSenderBalance.toLocaleString()} 🪙\u001b[0m\n` +
                    `\`\`\``
                )
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });
            return interaction.editReply({ embeds: [errorEmbed] });
        }

        // Get receiver (PER-SERVER)
        let receiverData = db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(targetId, guildId);
        const oldReceiverBalance = receiverData?.credits || 0;

        if (!receiverData) {
            db.prepare("INSERT INTO users (id, guild_id, username, xp, level, credits) VALUES (?, ?, ?, 0, 1, 0)").run(targetId, guildId, targetName);
            receiverData = { credits: 0 };
        }

        // ═══════════════════════════════════════════════════════
        // SLASH CONFIRMATION INTERFACE
        // ═══════════════════════════════════════════════════════
        const confirmEmbed = new EmbedBuilder()
            .setColor(ARCHON.gold)
            .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.title}`, iconURL: interaction.user.displayAvatarURL() })
            .setTitle(`\`\`\`ansi\n\u001b[1;33m  ⚠️ ${t.confirmTitle}\u001b[0m\n\`\`\``)
            .setDescription(
                `\`\`\`ansi\n` +
                `\u001b[1;36m  ${t.from}:\u001b[0m ${username}\n` +
                `\u001b[1;36m  ${t.to}:\u001b[0m ${targetName} ${isTelegram ? '📱' : ''}\n` +
                `\u001b[1;36m  ${t.amount}:\u001b[0m \u001b[1;33m${amount.toLocaleString()} 🪙\u001b[0m\n` +
                `\u001b[1;36m  ${t.transactionFee}:\u001b[0m ${t.free}\n\n` +
                `\u001b[0;37m  ${t.confirmDesc}\u001b[0m\n` +
                `\`\`\``
            )
            .addFields(
                { name: `📊 ${t.previousBalance}`, value: `\`\`\`ansi\n\u001b[1;33m${oldSenderBalance.toLocaleString()} 🪙\u001b[0m\n\`\`\``, inline: true },
                { name: `💰 ${t.yourNewBalance}`, value: `\`\`\`ansi\n\u001b[1;32m${(oldSenderBalance - amount).toLocaleString()} 🪙\u001b[0m\n\`\`\``, inline: true }
            )
            .setFooter({ text: `${guildName} • ${t.perServer} • v${version}`, iconURL: guildIcon })
            .setTimestamp();

        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`transfer_confirm_${userId}_${Date.now()}`)
                .setLabel(t.confirmBtn)
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅'),
            new ButtonBuilder()
                .setCustomId(`transfer_cancel_${userId}_${Date.now()}`)
                .setLabel(t.cancelBtn)
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌')
        );

        await interaction.editReply({ embeds: [confirmEmbed], components: [confirmRow] });

        const confirmMsg = await interaction.fetchReply();
        const confirmCollector = confirmMsg.createMessageComponentCollector({ time: 30000 });

        confirmCollector.on('collect', async (i) => {
            if (i.user.id !== userId) {
                return i.reply({ content: t.accessDenied, ephemeral: true }).catch(() => {});
            }

            await i.deferUpdate().catch(() => {});

            if (i.customId.startsWith('transfer_cancel_')) {
                const cancelEmbed = new EmbedBuilder()
                    .setColor(ARCHON.gray)
                    .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.title}`, iconURL: interaction.user.displayAvatarURL() })
                    .setTitle(`\`\`\`ansi\n\u001b[1;31m  ${t.cancelled}\u001b[0m\n\`\`\``)
                    .setDescription(`\`\`\`ansi\n\u001b[0;37m  ${t.cancelledDesc}\u001b[0m\n\`\`\``)
                    .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });
                await i.editReply({ embeds: [cancelEmbed], components: [] }).catch(() => {});
                confirmCollector.stop();
                return;
            }

            // Process transfer
            const newSenderCredits = oldSenderBalance - amount;
            const newReceiverCredits = oldReceiverBalance + amount;

            db.prepare("UPDATE users SET credits = ? WHERE id = ? AND guild_id = ?").run(newSenderCredits, userId, guildId);
            db.prepare("UPDATE users SET credits = ? WHERE id = ? AND guild_id = ?").run(newReceiverCredits, targetId, guildId);

            if (client.queueUserUpdate) {
                client.queueUserUpdate(userId, guildId, { ...senderData, credits: newSenderCredits });
                client.queueUserUpdate(targetId, guildId, { ...receiverData, credits: newReceiverCredits });
            }

            if (client.userDataCache) {
                client.userDataCache.delete(`${userId}:${guildId}`);
                client.userDataCache.delete(`${targetId}:${guildId}`);
            }

            try {
                db.prepare("INSERT INTO transfers (sender_id, receiver_id, amount, timestamp, platform, guild_id) VALUES (?, ?, ?, ?, ?, ?)")
                    .run(userId, targetId, amount, Date.now(), isTelegram ? 'discord_to_telegram' : 'discord', guildId);
            } catch (e) {}

            const receiptEmbed = new EmbedBuilder()
                .setColor(ARCHON.green)
                .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.success}`, iconURL: interaction.user.displayAvatarURL() })
                .setTitle(`\`\`\`ansi\n\u001b[1;32m  ✅ ${t.transferComplete}\u001b[0m\n\`\`\``)
                .setDescription(
                    `\`\`\`ansi\n` +
                    `\u001b[1;36m  ${t.from}:\u001b[0m ${username}\n` +
                    `\u001b[1;36m  ${t.to}:\u001b[0m ${targetName} ${isTelegram ? '📱' : ''}\n` +
                    `\u001b[1;36m  ${t.amount}:\u001b[0m \u001b[1;33m${amount.toLocaleString()} 🪙\u001b[0m\n` +
                    `\u001b[1;36m  ${t.transactionFee}:\u001b[0m ${t.free}\n` +
                    `\`\`\``
                )
                .addFields(
                    { name: `📊 ${t.previousBalance}`, value: `\`\`\`ansi\n\u001b[1;33m${oldSenderBalance.toLocaleString()} 🪙\u001b[0m\n\`\`\``, inline: true },
                    { name: `💰 ${t.yourNewBalance}`, value: `\`\`\`ansi\n\u001b[1;32m${newSenderCredits.toLocaleString()} 🪙\u001b[0m\n\`\`\``, inline: true },
                    { name: `🎯 ${t.recipientNewBalance}`, value: `\`\`\`ansi\n\u001b[1;36m${newReceiverCredits.toLocaleString()} 🪙\u001b[0m\n\`\`\``, inline: true }
                )
                .setFooter({ text: `${guildName} • ${t.perServer} • ${t.footer} • v${version}`, iconURL: guildIcon })
                .setTimestamp();

            const buttonRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`transfer_balance_${userId}`)
                    .setLabel(t.checkBalance)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('💰'),
                new ButtonBuilder()
                    .setCustomId(`transfer_history_${userId}`)
                    .setLabel(t.viewHistory)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📋')
            );

            await i.editReply({ embeds: [receiptEmbed], components: [buttonRow] }).catch(() => {});
            confirmCollector.stop();

            // DM recipient
            if (!isTelegram && targetUser) {
                try {
                    const notifyEmbed = new EmbedBuilder()
                        .setColor(ARCHON.green)
                        .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.dmSubject}`, iconURL: interaction.user.displayAvatarURL() })
                        .setTitle(`\`\`\`ansi\n\u001b[1;32m  💰 ${t.dmSubject}\u001b[0m\n\`\`\``)
                        .setDescription(
                            `\`\`\`ansi\n` +
                            `\u001b[1;36m  ${t.fromUser}:\u001b[0m ${username}\n` +
                            `\u001b[1;36m  ${t.amount}:\u001b[0m \u001b[1;33m${amount.toLocaleString()} 🪙\u001b[0m\n\n` +
                            `\u001b[0;37m  ${t.dmDesc}\u001b[0m\n` +
                            `\`\`\``
                        )
                        .addFields(
                            { name: `📊 ${t.previousBalance}`, value: `\`\`\`ansi\n\u001b[1;33m${oldReceiverBalance.toLocaleString()} 🪙\u001b[0m\n\`\`\``, inline: true },
                            { name: `💰 ${t.recipientNewBalance}`, value: `\`\`\`ansi\n\u001b[1;32m${newReceiverCredits.toLocaleString()} 🪙\u001b[0m\n\`\`\``, inline: true }
                        )
                        .setFooter({ text: `${guildName} • ${t.footer} • v${version}` })
                        .setTimestamp();
                    await targetUser.send({ embeds: [notifyEmbed] }).catch(() => {});
                } catch (e) {}
            }

            // Telegram
            if (isTelegram && client.telegramBridge?.enabled) {
                client.telegramBridge.send(
                    `🦅 *ARCHON NEURAL TRANSFER*\n\n` +
                    `💰 *${t.telegramNotification}*\n\n` +
                    `*${t.fromUser}:* ${username} (Discord)\n` +
                    `*${t.amount}:* ${amount.toLocaleString()} 🪙\n` +
                    `*${t.previousBalance}:* ${oldReceiverBalance.toLocaleString()} 🪙\n` +
                    `*${t.recipientNewBalance}:* ${newReceiverCredits.toLocaleString()} 🪙\n\n` +
                    t.useBalance(prefix)
                ).catch(() => {});
            }

            console.log(`[TRANSFER-SLASH] ${username} → ${targetName} | ${amount} 🪙 | Guild: ${guildId} | Lang: ${lang}`);
        });
    }
};

