const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const transferTranslations = {
    en: {
        title: '💸 NEURAL TRANSFER',
        transferComplete: '✅ TRANSFER COMPLETE',
        from: 'From',
        to: 'To',
        amount: 'Amount',
        yourNewBalance: 'Your New Balance',
        recipientNewBalance: 'Recipient New Balance',
        crossPlatform: 'Cross-platform transfers enabled',
        usage: '❌ Usage: `.transfer @user <amount>` or `.transfer <telegram_id> <amount>`',
        minTransfer: '❌ Minimum transfer is **10 🪙**!',
        selfTransfer: '❌ You cannot transfer to yourself!',
        noAccount: '❌ You need to send a message first to initialize your account!',
        insufficient: '❌ Insufficient credits! You have',
        telegramNotification: '💰 You received credits!',
        fromUser: 'From',
        useBalance: (prefix) => `Use \`${prefix}bal\` or \`${prefix}credits\` to check your balance!`,
verifyWith: 'Verify with',
        footer: 'NEURAL TRANSFER • BAMAKO NODE',
        previousBalance: 'Previous Balance',
        transactionFee: 'Transaction Fee',
        free: 'FREE',
        receipt: 'TRANSFER RECEIPT'
    },
    fr: {
        title: '💸 TRANSFERT NEURAL',
        transferComplete: '✅ TRANSFERT EFFECTUÉ',
        from: 'De',
        to: 'À',
        amount: 'Montant',
        yourNewBalance: 'Votre Nouveau Solde',
        recipientNewBalance: 'Solde du Destinataire',
        crossPlatform: 'Transferts multiplateformes activés',
        usage: '❌ Usage : `.transfer @utilisateur <montant>` ou `.transfer <telegram_id> <montant>`',
        minTransfer: '❌ Le transfert minimum est de **10 🪙** !',
        selfTransfer: '❌ Vous ne pouvez pas vous transférer à vous-même !',
        noAccount: '❌ Vous devez d\'abord envoyer un message pour initialiser votre compte !',
        insufficient: '❌ Crédits insuffisants ! Vous avez',
        telegramNotification: '💰 Vous avez reçu des crédits !',
        fromUser: 'De',
        useBalance: (prefix) => `Utilisez \`${prefix}bal\` ou \`${prefix}credits\` pour vérifier votre solde !`,
verifyWith: 'Vérifiez avec',
        footer: 'TRANSFERT NEURAL • NŒUD BAMAKO',
        previousBalance: 'Solde Précédent',
        transactionFee: 'Frais de Transaction',
        free: 'GRATUIT',
        receipt: 'REÇU DE TRANSFERT'
    }
};

module.exports = {
    name: 'transfer',
    aliases: ['send', 'pay', 'envoyer', 'payer', 'virement'],
    description: '💸 Transfer credits to another user.',
    category: 'ECONOMY',
    usage: '<@user|telegram_id> <amount>',
    cooldown: 5000,
    examples: ['.transfer @user 500', '.transfer 5076150691 1000'],

    // ================= SLASH COMMAND DATA =================
    data: new SlashCommandBuilder()
        .setName('transfer')
        .setDescription('💸 Transfer credits to another user / Transférer des crédits')
        .addIntegerOption(opt => opt
            .setName('amount')
            .setDescription('Amount of credits to send / Montant de crédits à envoyer')
            .setRequired(true)
            .setMinValue(10))
        .addUserOption(opt => opt
            .setName('user')
            .setDescription('User to send credits to / Utilisateur à qui envoyer')
            .setRequired(false))
        .addStringOption(opt => opt
            .setName('telegram_id')
            .setDescription('Telegram ID to send credits to / ID Telegram')
            .setRequired(false)),

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
        const t = transferTranslations[lang];
        const version = client.version || '1.7.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        const prefix = serverSettings?.prefix || '.';
        
        const userId = message.author.id;
        const username = message.author.username;
        
        // Parse target
        let targetId, targetName, isTelegram = false;
        
        if (message.mentions.users.first()) {
            const target = message.mentions.users.first();
            targetId = target.id;
            targetName = target.username;
        } else if (args[0] && /^\d+$/.test(args[0])) {
            const linked = db.prepare("SELECT discord_id FROM user_links WHERE telegram_id = ?").get(args[0]);
            if (linked) {
                targetId = linked.discord_id;
                targetName = `Telegram:${args[0]}`;
                isTelegram = true;
            } else {
                targetId = args[0];
                targetName = `User:${args[0]}`;
            }
        } else {
            return message.reply(t.usage);
        }
        
        const amount = parseInt(args[1]);
        if (isNaN(amount) || amount < 10) {
            return message.reply(t.minTransfer);
        }
        
        if (targetId === userId) {
            return message.reply(t.selfTransfer);
        }
        
        // Get sender data
        let senderData = client.getUserData ? client.getUserData(userId) : db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
        if (!senderData) {
            return message.reply(t.noAccount);
        }
        
        const oldSenderBalance = senderData.credits || 0;
        
        if (oldSenderBalance < amount) {
            return message.reply(`${t.insufficient} **${oldSenderBalance.toLocaleString()} 🪙**.`);
        }
        
        // Get or create receiver
        let receiverData = db.prepare("SELECT * FROM users WHERE id = ?").get(targetId);
        const oldReceiverBalance = receiverData?.credits || 0;
        
        if (!receiverData) {
            db.prepare("INSERT INTO users (id, username, xp, level, credits) VALUES (?, ?, 0, 1, 0)").run(targetId, targetName);
            receiverData = { credits: 0 };
        }
        
        // Process transfer
        const newSenderCredits = oldSenderBalance - amount;
        const newReceiverCredits = oldReceiverBalance + amount;
        
        db.prepare("UPDATE users SET credits = ? WHERE id = ?").run(newSenderCredits, userId);
        db.prepare("UPDATE users SET credits = ? WHERE id = ?").run(newReceiverCredits, targetId);
        
        if (client.queueUserUpdate) {
            client.queueUserUpdate(userId, { ...senderData, credits: newSenderCredits });
        }
        
        if (client.userDataCache) {
            client.userDataCache.delete(userId);
            client.userDataCache.delete(targetId);
        }
        
        // Log transfer
        try {
            db.prepare("INSERT INTO transfers (sender_id, receiver_id, amount, timestamp, platform) VALUES (?, ?, ?, ?, ?)")
                .run(userId, targetId, amount, Date.now(), isTelegram ? 'discord_to_telegram' : 'discord');
        } catch (e) {}
        
        // 🔥 TRANSPARENT RECEIPT EMBED WITH CONFIRMATION BUTTONS
        const embed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setAuthor({ name: `${t.title} • ${t.receipt}`, iconURL: message.author.displayAvatarURL() })
            .setDescription(
                `\`\`\`yaml\n` +
                `${t.from}: ${username}\n` +
                `${t.to}: ${targetName} ${isTelegram ? '📱' : ''}\n` +
                `${t.amount}: ${amount.toLocaleString()} 🪙\n` +
                `${t.transactionFee}: ${t.free}\n` +
                `\`\`\`\n` +
                `## 📊 **${t.previousBalance}:** ${oldSenderBalance.toLocaleString()} 🪙\n` +
                `## 💰 **${t.yourNewBalance}:** ${newSenderCredits.toLocaleString()} 🪙\n\n` +
                `---\n` +
                `💡 **${t.verifyWith} \`${prefix}bal\` or \`${prefix}credits\`**\n` +
                `*${t.useBalance(prefix)}*`
            )
            .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
            .setTimestamp();

        // 🔥 ACTION BUTTONS
        const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('transfer_balance')
                .setLabel(lang === 'fr' ? '💰 Voir Solde' : '💰 Check Balance')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('💰'),
            new ButtonBuilder()
                .setCustomId('transfer_history')
                .setLabel(lang === 'fr' ? '📋 Historique' : '📋 History')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📋')
        );

        const reply = await message.reply({ embeds: [embed], components: [buttonRow] }).catch(() => {});
        if (!reply) return;

        // Button collector
        const collector = reply.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) {
                return i.reply({ content: lang === 'fr' ? '❌ Ce menu ne vous appartient pas.' : '❌ This menu is not yours.', ephemeral: true });
            }
            
            if (i.customId === 'transfer_balance') {
                const balanceEmbed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setAuthor({ name: '💰 ' + (lang === 'fr' ? 'VOTRE SOLDE' : 'YOUR BALANCE'), iconURL: message.author.displayAvatarURL() })
                    .setDescription(`**${newSenderCredits.toLocaleString()} 🪙**`)
                    .setFooter({ text: `${guildName} • ${t.footer}` });
                await i.reply({ embeds: [balanceEmbed], ephemeral: true });
            }
            
            if (i.customId === 'transfer_history') {
                const history = db.prepare(`
                    SELECT * FROM transfers 
                    WHERE sender_id = ? OR receiver_id = ? 
                    ORDER BY timestamp DESC LIMIT 5
                `).all(userId, userId);
                
                let historyText = '';
                history.forEach(tx => {
                    const isSender = tx.sender_id === userId;
                    const sign = isSender ? '➖' : '➕';
                    const otherParty = isSender ? tx.receiver_id : tx.sender_id;
                    historyText += `${sign} **${tx.amount.toLocaleString()}** 🪙 ${isSender ? '→' : '←'} \`${otherParty.slice(0, 8)}...\`\n`;
                });
                
                const historyEmbed = new EmbedBuilder()
                    .setColor('#3498db')
                    .setAuthor({ name: '📋 ' + (lang === 'fr' ? 'HISTORIQUE RÉCENT' : 'RECENT HISTORY'), iconURL: message.author.displayAvatarURL() })
                    .setDescription(historyText || (lang === 'fr' ? 'Aucune transaction récente.' : 'No recent transactions.'))
                    .setFooter({ text: `${guildName} • ${t.footer}` });
                await i.reply({ embeds: [historyEmbed], ephemeral: true });
            }
        });
        
        // Notify recipient if in same server
        try {
            const recipient = await client.users.fetch(targetId).catch(() => null);
            if (recipient && !isTelegram) {
                const notifyEmbed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setAuthor({ name: '💰 CREDITS RECEIVED', iconURL: message.author.displayAvatarURL() })
                    .setDescription(
                        `**${username}** sent you **${amount.toLocaleString()} 🪙**!\n\n` +
                        `**Previous Balance:** ${oldReceiverBalance.toLocaleString()} 🪙\n` +
                        `**New Balance:** ${newReceiverCredits.toLocaleString()} 🪙\n\n` +
                        `💡 Check with \`${prefix}bal\` or \`${prefix}credits\``
                    )
                    .setFooter({ text: `${guildName} • ${t.footer}` })
                    .setTimestamp();
                await recipient.send({ embeds: [notifyEmbed] }).catch(() => {});
            }
        } catch (e) {}
        
        // Cross-platform Telegram notification
        if (isTelegram && client.telegramBridge?.enabled) {
            const telegramId = args[0];
            client.telegramBridge.send(
                `💰 **${t.telegramNotification}**\n\n` +
                `${t.fromUser}: ${username} (Discord)\n` +
                `${t.amount}: ${amount.toLocaleString()} 🪙\n` +
                `${t.previousBalance}: ${oldReceiverBalance.toLocaleString()} 🪙\n` +
                `${t.yourNewBalance}: ${newReceiverCredits.toLocaleString()} 🪙\n\n` +
                t.useBalance(prefix)
            ).catch(() => {});
        }
        
        console.log(`[TRANSFER] ${username} sent ${amount} to ${targetName} | New balance: ${newSenderCredits} | Lang: ${lang}`);
    },

    // ================= SLASH COMMAND EXECUTION =================
    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = transferTranslations[lang];
        
        const amount = interaction.options.getInteger('amount');
        const targetUser = interaction.options.getUser('user');
        const telegramId = interaction.options.getString('telegram_id');
        
        // Validate target
        if (!targetUser && !telegramId) {
            return interaction.reply({ 
                content: lang === 'fr' 
                    ? '❌ Veuillez spécifier un utilisateur OU un ID Telegram.' 
                    : '❌ Please specify a user OR a Telegram ID.',
                ephemeral: true 
            });
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
                targetName = `User:${telegramId}`;
            }
        }
        
        // Create fake message for run function
        const fakeMessage = {
            author: interaction.user,
            guild: interaction.guild,
            channel: interaction.channel,
            mentions: {
                users: targetUser ? new Map([[targetUser.id, targetUser]]) : new Map()
            },
            reply: async (options) => interaction.editReply(options),
            react: () => Promise.resolve()
        };
        
        // 🔥 CRITICAL: Add .first() method to mentions.users
        fakeMessage.mentions.users.first = () => {
            return targetUser || null;
        };
        
        const serverSettings = interaction.guild ? client.getServerSettings(interaction.guild.id) : { prefix: '.' };
        const args = targetUser ? [`<@${targetUser.id}>`, amount.toString()] : [telegramId, amount.toString()];
        
        await module.exports.run(client, fakeMessage, args, db, serverSettings, 'transfer');
    }
};