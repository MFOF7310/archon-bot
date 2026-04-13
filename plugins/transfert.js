// ================= BAMAKO TRANSFER SYSTEM (BILINGUAL) =================
const { EmbedBuilder } = require('discord.js');

const t = {
    en: {
        transferComplete: '💸 TRANSFER COMPLETE',
        from: 'From',
        to: 'To',
        amount: 'Amount',
        yourNewBalance: 'Your New Balance',
        crossPlatform: 'Cross-platform transfers enabled',
        usage: '❌ Usage: `.transfer @user <amount>` or `.transfer <telegram_id> <amount>`',
        minTransfer: '❌ Minimum transfer is **10 🪙**!',
        selfTransfer: '❌ You cannot transfer to yourself!',
        noAccount: '❌ You need to send a message first to initialize your account!',
        insufficient: '❌ Insufficient credits! You have',
        telegramNotification: '💰 You received credits!',
        fromUser: 'From',
        useBalance: 'Use /balance to check your new balance!'
    },
    fr: {
        transferComplete: '💸 TRANSFERT EFFECTUÉ',
        from: 'De',
        to: 'À',
        amount: 'Montant',
        yourNewBalance: 'Votre Nouveau Solde',
        crossPlatform: 'Transferts multiplateformes activés',
        usage: '❌ Usage : `.transfer @utilisateur <montant>` ou `.transfer <telegram_id> <montant>`',
        minTransfer: '❌ Le transfert minimum est de **10 🪙** !',
        selfTransfer: '❌ Vous ne pouvez pas vous transférer à vous-même !',
        noAccount: '❌ Vous devez d\'abord envoyer un message pour initialiser votre compte !',
        insufficient: '❌ Crédits insuffisants ! Vous avez',
        telegramNotification: '💰 Vous avez reçu des crédits !',
        fromUser: 'De',
        useBalance: 'Utilisez /balance pour vérifier votre nouveau solde !'
    }
};

function getLang(message) {
    if (message.client.detectLanguage) {
        const usedCommand = message.content.split(' ')[0]?.toLowerCase() || '';
        return message.client.detectLanguage(usedCommand) || 'en';
    }
    const content = message.content.toLowerCase();
    if (/[àâäéèêëîïôöùûüÿçœæ]/i.test(content)) return 'fr';
    return 'en';
}

module.exports = {
    name: 'transfer',
    aliases: ['send', 'pay', 'envoyer', 'payer', 'virement'],
    description: '💸 Transfer credits to another user / Transférer des crédits à un autre utilisateur',
    category: 'ECONOMY',
    usage: '<@user|telegram_id> <amount>',
    cooldown: 5000,
    
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = getLang(message);
        const texts = t[lang];
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
            return message.reply(texts.usage);
        }
        
        const amount = parseInt(args[1]);
        if (isNaN(amount) || amount < 10) {
            return message.reply(texts.minTransfer);
        }
        
        if (targetId === userId) {
            return message.reply(texts.selfTransfer);
        }
        
        // Get sender data
        let senderData = client.getUserData ? client.getUserData(userId) : db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
        if (!senderData) {
            return message.reply(texts.noAccount);
        }
        
        if (senderData.credits < amount) {
            return message.reply(`${texts.insufficient} **${senderData.credits.toLocaleString()} 🪙**.`);
        }
        
        // Get or create receiver
        let receiverData = db.prepare("SELECT * FROM users WHERE id = ?").get(targetId);
        if (!receiverData) {
            db.prepare("INSERT INTO users (id, username, xp, level, credits) VALUES (?, ?, 0, 1, 0)").run(targetId, targetName);
            receiverData = { credits: 0 };
        }
        
        // Process transfer
        const newSenderCredits = senderData.credits - amount;
        const newReceiverCredits = (receiverData.credits || 0) + amount;
        
        db.prepare("UPDATE users SET credits = ? WHERE id = ?").run(newSenderCredits, userId);
        db.prepare("UPDATE users SET credits = ? WHERE id = ?").run(newReceiverCredits, targetId);
        
        if (client.queueUserUpdate) {
            client.queueUserUpdate(userId, { ...senderData, credits: newSenderCredits });
        }
        
        // Log transfer
        db.prepare("INSERT INTO transfers (sender_id, receiver_id, amount, timestamp, platform) VALUES (?, ?, ?, ?, ?)")
            .run(userId, targetId, amount, Date.now(), isTelegram ? 'discord_to_telegram' : 'discord');
        
        const embed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setAuthor({ name: texts.transferComplete, iconURL: message.author.displayAvatarURL() })
            .setDescription(
                `**${texts.from}:** ${username}\n` +
                `**${texts.to}:** ${targetName} ${isTelegram ? '📱' : ''}\n` +
                `**${texts.amount}:** ${amount.toLocaleString()} 🪙\n\n` +
                `**${texts.yourNewBalance}:** ${newSenderCredits.toLocaleString()} 🪙`
            )
            .setFooter({ text: `BAMAKO_223 🇲🇱 • ${texts.crossPlatform}` });
        
        await message.reply({ embeds: [embed] });
        
        // If cross-platform, notify via Telegram bridge
        if (isTelegram && client.telegramBridge?.enabled) {
            const telegramId = args[0];
            const tgLang = lang === 'fr' ? 'fr' : 'en';
            const tgTexts = t[tgLang];
            client.telegramBridge.send(
                `💰 <b>${tgTexts.telegramNotification}</b>\n\n` +
                `${tgTexts.fromUser}: ${username} (Discord)\n` +
                `${tgTexts.amount}: ${amount.toLocaleString()} 🪙\n\n` +
                tgTexts.useBalance
            ).catch(() => {});
        }
    }
};