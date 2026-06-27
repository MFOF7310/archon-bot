const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, PermissionsBitField, SlashCommandBuilder } = require('discord.js');

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
    steel: '#708090',
    amber: '#FEE75C'
};

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        title: '🎁 NEURAL GIVEAWAY PROTOCOL',
        creating: '📝 INITIALIZING GIVEAWAY',
        active: '🟢 ACTIVE',
        ended: '🔴 TERMINATED',
        prize: 'PRIZE',
        winners: 'WINNERS',
        entries: 'ENTRIES',
        ends: 'TERMINATES',
        hostedBy: 'HOST',
        timeRemaining: 'TIME REMAINING',
        enterButton: '🎉 ENTER',
        leaveButton: '🚪 WITHDRAW',
        rerollButton: '🔄 REROLL',
        deleteButton: '🗑️ TERMINATE',
        enterSuccess: '✅ ENTRY CONFIRMED — Good luck, agent! 🍀',
        leaveSuccess: '🚪 WITHDRAWAL CONFIRMED — You have left the giveaway.',
        alreadyEntered: '⚠️ ALREADY ENTERED — You are already registered.',
        notEntered: '⚠️ NOT REGISTERED — You are not in this giveaway.',
        cannotEnter: '❌ SELF-EXCLUSION — You cannot enter your own giveaway.',
        giveawayEnded: '🎊 GIVEAWAY TERMINATED',
        congratulations: 'CONGRATULATIONS',
        winnersList: 'WINNERS',
        noEntries: '❌ NO ENTRIES — No agents participated.',
        rerollSuccess: '🔄 REROLL EXECUTED — New winner(s) selected.',
        deleteSuccess: '🗑️ GIVEAWAY TERMINATED — Protocol ended.',
        invalidTime: '❌ INVALID TEMPORAL FORMAT — Use: `10s`, `5m`, `2h`, `1d`',
        invalidWinners: '❌ INVALID WINNER COUNT — Must be 1-20.',
        noPrize: '❌ NO PRIZE SPECIFIED — Define the reward.',
        usage: 'Usage: `.giveaway [time] [winners] [prize]`',
        example: 'Example: `.giveaway 1h 2 1000 Credits`',
        footer: 'NEURAL GIVEAWAY • ARCHON CG-223',
        accessDenied: '❌ UNAUTHORIZED — Biometric mismatch.',
        noPermission: '❌ CLEARANCE REQUIRED — You need **Manage Server** permission.',
        entriesList: 'ENTRIES',
        totalEntries: 'TOTAL ENTRIES',
        timeUnits: { s: 'sec', m: 'min', h: 'hr', d: 'day' },
        noActiveGiveaways: 'No active giveaways.\n\nCreate: `{prefix}giveaway [time] [winners] [prize]`',
        activeGiveaways: 'ACTIVE GIVEAWAYS',
        jumpToGiveaway: 'Jump to Giveaway',
        timeFormats: 'Temporal Formats',
        missingArguments: 'MISSING PARAMETERS',
        createdSuccess: '✅ GIVEAWAY PROTOCOL INITIALIZED',
        entriesClosed: 'ENTRIES CLOSED',
        viewGiveaway: 'VIEW GIVEAWAY',
        prizeAmount: 'PRIZE AMOUNT',
        credited: 'CREDITED',
        toWinners: 'to winner(s)',
        prizeClaimed: '🎁 PRIZE CLAIMED',
        prizeSent: 'Prize Sent To',
        giftChannelAnnouncement: '🎉 **GIVEAWAY WINNERS!**',
        creditsAdded: '💰 **{amount} Credits** added to your balance!',
        checkBalance: 'Check with `.bal` or `.credits`',
        eachWinnerGets: 'EACH WINNER RECEIVES',
        totalPrizePool: 'TOTAL PRIZE POOL',
        mentionEveryone: '📢 Mention @everyone',
        mentionHere: '📢 Mention @here',
        noMention: '🔕 No mention',
        giveawayStarting: 'GIVEAWAY PROTOCOL STARTING',
        clickToEnter: 'Click the 🎉 button below to register!',
        verifyYourWinnings: '💰 VERIFY YOUR WINNINGS',
        verifyMessage: 'Type `.bal` or click the button below to see your new balance!',
        checkBalanceBtn: '💰 CHECK MY BALANCE',
        totalDistributed: 'TOTAL DISTRIBUTED',
        winnersReceipt: 'WINNERS RECEIPT',
        amountPerWinner: 'AMOUNT PER WINNER',
        transactionComplete: '✅ TRANSACTION COMPLETE',
        creditsSent: 'Credits sent to winners',
        randomSelection: '🎲 RANDOMIZED SELECTION PROTOCOL',
        randomSelectionDesc: 'All registered agents have equal probability. Pure entropy — no priority.',
        entriesSoFar: 'ENTRIES REGISTERED',
        minimumWinners: 'minimum',
        luckiestMembers: '🍀 LUCKIEST AGENTS',
        totalEntriesReceived: 'TOTAL ENTRIES RECEIVED',
        winnersRandomlyChosen: 'Winners selected via cryptographic randomization.',
        serverWideEntry: '🌍 SERVER-WIDE PARTICIPATION',
        serverWideDesc: 'All server members are eligible. Click 🎉 to confirm.',
        autoEntered: '✅ ENTRY CONFIRMED — You are now registered.',
        dmError: '❌ This command can only be used in a server.',
        confirmDelete: '⚠️ CONFIRM TERMINATION',
        confirmDeleteDesc: 'This will permanently end the giveaway. All entries will be discarded.',
        deleteConfirmBtn: '✅ TERMINATE',
        deleteCancelBtn: '❌ CANCEL',
        deleteCancelled: '❌ TERMINATION ABORTED',
        giveawayInfo: 'GIVEAWAY INTELLIGENCE',
        entryRate: 'ENTRY RATE',
        estimatedWinChance: 'ESTIMATED WIN CHANCE',
        hostClearance: 'HOST CLEARANCE LEVEL'
    },
    fr: {
        title: '🎁 PROTOCOLE DE CONCOURS NEURAL',
        creating: '📝 INITIALISATION DU CONCOURS',
        active: '🟢 ACTIF',
        ended: '🔴 TERMINÉ',
        prize: 'PRIX',
        winners: 'GAGNANTS',
        entries: 'PARTICIPATIONS',
        ends: 'SE TERMINE',
        hostedBy: 'HÔTE',
        timeRemaining: 'TEMPS RESTANT',
        enterButton: '🎉 PARTICIPER',
        leaveButton: '🚪 SE RETIRER',
        rerollButton: '🔄 RETIRER',
        deleteButton: '🗑️ TERMINER',
        enterSuccess: '✅ INSCRIPTION CONFIRMÉE — Bonne chance, agent ! 🍀',
        leaveSuccess: '🚪 RETRAIT CONFIRMÉ — Vous avez quitté le concours.',
        alreadyEntered: '⚠️ DÉJÀ INSCRIT — Vous êtes déjà enregistré.',
        notEntered: '⚠️ NON INSCRIT — Vous ne participez pas à ce concours.',
        cannotEnter: '❌ AUTO-EXCLUSION — Vous ne pouvez pas participer à votre propre concours.',
        giveawayEnded: '🎊 CONCOURS TERMINÉ',
        congratulations: 'FÉLICITATIONS',
        winnersList: 'GAGNANTS',
        noEntries: '❌ AUCUNE PARTICIPATION — Aucun agent n\'a participé.',
        rerollSuccess: '🔄 REROLL EXÉCUTÉ — Nouveau(x) gagnant(s) sélectionné(s).',
        deleteSuccess: '🗑️ CONCOURS TERMINÉ — Protocole arrêté.',
        invalidTime: '❌ FORMAT TEMPOREL INVALIDE — Utilisez: `10s`, `5m`, `2h`, `1j`',
        invalidWinners: '❌ NOMBRE DE GAGNANTS INVALIDE — 1-20.',
        noPrize: '❌ AUCUN PRIX SPÉCIFIÉ — Définissez la récompense.',
        usage: 'Usage : `.concours [temps] [gagnants] [prix]`',
        example: 'Exemple : `.concours 1h 2 1000 Crédits`',
        footer: 'CONCOURS NEURAL • ARCHON CG-223',
        accessDenied: '❌ NON AUTORISÉ — Non-concordance biométrique.',
        noPermission: '❌ AUTORISATION REQUISE — Permission **Gérer le Serveur** nécessaire.',
        entriesList: 'PARTICIPATIONS',
        totalEntries: 'TOTAL PARTICIPATIONS',
        timeUnits: { s: 'sec', m: 'min', h: 'h', d: 'j' },
        noActiveGiveaways: 'Aucun concours actif.\n\nCréez : `{prefix}concours [temps] [gagnants] [prix]`',
        activeGiveaways: 'CONCOURS ACTIFS',
        jumpToGiveaway: 'Voir le Concours',
        timeFormats: 'Formats Temporels',
        missingArguments: 'PARAMÈTRES MANQUANTS',
        createdSuccess: '✅ PROTOCOLE DE CONCOURS INITIALISÉ',
        entriesClosed: 'PARTICIPATIONS FERMÉES',
        viewGiveaway: 'Voir le Concours',
        prizeAmount: 'MONTANT DU PRIX',
        credited: 'CRÉDITÉ',
        toWinners: 'au(x) gagnant(s)',
        prizeClaimed: '🎁 PRIX RÉCLAMÉ',
        prizeSent: 'Prix Envoyé À',
        giftChannelAnnouncement: '🎉 **GAGNANTS DU CONCOURS !**',
        creditsAdded: '💰 **{amount} Crédits** ajoutés à votre solde !',
        checkBalance: 'Vérifiez avec `.bal` ou `.credits`',
        eachWinnerGets: 'CHAQUE GAGNANT REÇOIT',
        totalPrizePool: 'CAGNOTTE TOTALE',
        mentionEveryone: '📢 Mention @everyone',
        mentionHere: '📢 Mention @here',
        noMention: '🔕 Pas de mention',
        giveawayStarting: 'PROTOCOLE DE CONCOURS LANCÉ',
        clickToEnter: 'Cliquez sur le bouton 🎉 ci-dessous pour vous inscrire !',
        verifyYourWinnings: '💰 VÉRIFIEZ VOS GAINS',
        verifyMessage: 'Tapez `.bal` ou cliquez sur le bouton pour voir votre nouveau solde !',
        checkBalanceBtn: '💰 Voir mon Solde',
        totalDistributed: 'TOTAL DISTRIBUÉ',
        winnersReceipt: 'REÇU DES GAGNANTS',
        amountPerWinner: 'MONTANT PAR GAGNANT',
        transactionComplete: '✅ TRANSACTION COMPLÉTÉE',
        creditsSent: 'Crédits envoyés aux gagnants',
        randomSelection: '🎲 PROTOCOLE DE SÉLECTION ALÉATOIRE',
        randomSelectionDesc: 'Tous les agents inscrits ont une probabilité égale. Pure entropie — pas de priorité.',
        entriesSoFar: 'INSCRIPTIONS ENREGISTRÉES',
        minimumWinners: 'minimum',
        luckiestMembers: '🍀 LES PLUS CHANCEUX',
        totalEntriesReceived: 'TOTAL DES PARTICIPATIONS REÇUES',
        winnersRandomlyChosen: 'Gagnants sélectionnés via randomisation cryptographique.',
        serverWideEntry: '🌍 PARTICIPATION SERVEUR',
        serverWideDesc: 'Tous les membres sont éligibles. Cliquez 🎉 pour confirmer.',
        autoEntered: '✅ INSCRIPTION CONFIRMÉE — Vous êtes maintenant enregistré.',
        dmError: '❌ Cette commande ne peut être utilisée que dans un serveur.',
        confirmDelete: '⚠️ CONFIRMER LA TERMINAISON',
        confirmDeleteDesc: 'Cela mettra fin définitivement au concours. Toutes les participations seront supprimées.',
        deleteConfirmBtn: '✅ TERMINER',
        deleteCancelBtn: '❌ ANNULER',
        deleteCancelled: '❌ TERMINAISON ANNULÉE',
        giveawayInfo: 'INTELLIGENCE DU CONCOURS',
        entryRate: 'TAUX D\'INSCRIPTION',
        estimatedWinChance: 'CHANCE DE VICTOIRE ESTIMÉE',
        hostClearance: 'NIVEAU D\'AUTORISATION DE L\'HÔTE'
    }
};

// ================= MAIN SERVER LOGGING =================
const MAIN_LOG_CHANNEL_ID = process.env.MAIN_LOG_CHANNEL_ID;

async function logToMainServer(client, guild, action, data) {
    if (!MAIN_LOG_CHANNEL_ID) return;
    try {
        const channel = await client.channels.fetch(MAIN_LOG_CHANNEL_ID);
        if (!channel) return;
        const logEmbed = new EmbedBuilder()
            .setColor(ARCHON.green)
            .setAuthor({ name: '📋 GIVEAWAY LOG • ARCHON ENGINE', iconURL: client.user.displayAvatarURL() })
            .setTitle(`${action} • ${guild.name}`)
            .setDescription(`\`\`\`json\n${JSON.stringify(data, null, 2).slice(0, 1900)}\`\`\``)
            .setFooter({ text: `Guild ID: ${guild.id}` })
            .setTimestamp();
        await channel.send({ embeds: [logEmbed] });
    } catch (err) { console.error('Main log failed:', err.message); }
}

// ================= ACTIVE GIVEAWAYS STORAGE =================
const activeGiveaways = new Map(); // Map<guildId, Map<giveawayId, giveaway>>

// ================= PARSE TIME FUNCTION =================
function parseTime(timeStr, lang) {
    const t = translations[lang];
    const regex = /^(\d+)([smhd])$/i;
    const match = timeStr.match(regex);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    if (!multipliers[unit]) return null;

    return {
        ms: value * multipliers[unit],
        display: `${value}${unit}`,
        text: `${value} ${t.timeUnits[unit]}`
    };
}

// ================= CREATE GIVEAWAY EMBED =================
function createGiveawayEmbed(giveaway, status, lang, guild, client) {
    const t = translations[lang];
    const version = client.version || '1.7.0';
    const color = status === 'active' ? ARCHON.green : ARCHON.red;
    const title = status === 'active' ? `${t.title} • ${t.active}` : `${t.title} • ${t.ended}`;

    const amount = giveaway.amount || 0;
    const winners = giveaway.winners || 1;
    const totalPool = giveaway.originalAmount || (amount * winners);
    const entryCount = giveaway.entries?.length || 0;
    const winChance = entryCount > 0 ? `${((winners / entryCount) * 100).toFixed(2)}%` : 'N/A';

    const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: `🦅 ARCHON ENGINE • ${title}`, iconURL: giveaway.hostIcon })
        .setTitle(`\`\`\`ansi\n\u001b[1;33m  🎁 ${giveaway.prize}\u001b[0m\n\`\`\``)
        .setDescription(
            `\`\`\`ansi\n` +
            `\u001b[1;36m  ${t.hostedBy}:\u001b[0m ${giveaway.hostName}\n` +
            `\u001b[1;36m  ${t.winners}:\u001b[0m ${giveaway.winners} ${t.winnersList.toLowerCase()}\n` +
            `\u001b[1;36m  ${t.entries}:\u001b[0m ${entryCount}\n` +
            `\u001b[1;36m  ${t.eachWinnerGets}:\u001b[0m \u001b[1;33m${amount.toLocaleString()} 🪙\u001b[0m\n` +
            `\u001b[1;36m  ${t.totalPrizePool}:\u001b[0m \u001b[1;33m${totalPool.toLocaleString()} 🪙\u001b[0m\n` +
            `\`\`\`\n\n` +
            `### ${t.randomSelection}\n` +
            `*${t.randomSelectionDesc}*\n`
        )
        .addFields(
            status === 'active'
                ? { name: `⏰ ${t.timeRemaining}`, value: `\`\`\`ansi\n\u001b[1;32m<t:${Math.floor(giveaway.endTimestamp / 1000)}:R>\u001b[0m\n\`\`\``, inline: true }
                : { name: `🔒 ${t.entriesClosed}`, value: `\`\`\`ansi\n\u001b[1;31m<t:${Math.floor(giveaway.endTimestamp / 1000)}:R>\u001b[0m\n\`\`\``, inline: true },
            { name: `👥 ${t.totalEntries}`, value: `\`\`\`ansi\n\u001b[1;36m${entryCount}\u001b[0m\n\`\`\``, inline: true },
            { name: `🎲 ${t.estimatedWinChance}`, value: `\`\`\`ansi\n\u001b[1;33m${winChance}\u001b[0m\n\`\`\``, inline: true }
        )
        .setFooter({
            text: `${guild.name.toUpperCase()} • ${t.footer} • v${version}`,
            iconURL: guild.iconURL() || client.user.displayAvatarURL()
        })
        .setTimestamp();

    if (status === 'ended' && giveaway.winnersList?.length > 0) {
        const winnerDetails = giveaway.winnersList.map(w => `<@${w}> (+${amount.toLocaleString()} 🪙)`).join('\n');
        embed.addFields({
            name: `🏆 ${t.winnersList} (${t.transactionComplete})`,
            value: winnerDetails,
            inline: false
        });
        embed.addFields({
            name: `📊 ${t.totalEntriesReceived}`,
            value: `\`\`\`ansi\n\u001b[1;36m${entryCount}\u001b[0m ${t.entries.toLowerCase()}\n\`\`\``,
            inline: true
        });
        embed.addFields({
            name: `🎲 ${t.winnersRandomlyChosen}`,
            value: `\`\`\`ansi\n\u001b[1;32m✅ ${giveaway.winners} ${t.winnersList.toLowerCase()}\u001b[0m\n\`\`\``,
            inline: true
        });
    }

    return embed;
}

// ================= CREATE BUTTON ROW =================
function createButtonRow(status, lang) {
    const t = translations[lang];
    const row = new ActionRowBuilder();

    if (status === 'active') {
        row.addComponents(
            new ButtonBuilder().setCustomId('gw_enter').setLabel(t.enterButton).setStyle(ButtonStyle.Success).setEmoji('🎉'),
            new ButtonBuilder().setCustomId('gw_leave').setLabel(t.leaveButton).setStyle(ButtonStyle.Secondary).setEmoji('🚪')
        );
    } else {
        row.addComponents(
            new ButtonBuilder().setCustomId('gw_reroll').setLabel(t.rerollButton).setStyle(ButtonStyle.Primary).setEmoji('🔄')
        );
    }

    row.addComponents(
        new ButtonBuilder().setCustomId('gw_delete').setLabel(t.deleteButton).setStyle(ButtonStyle.Danger).setEmoji('🗑️')
    );

    return row;
}

// ================= SELECT WINNERS (CRYPTOGRAPHIC RANDOM) =================
function selectWinners(entries, winnerCount) {
    if (entries.length === 0) return [];
    const shuffled = [...entries].sort(() => Math.random() - 0.5);
    return [...new Set(shuffled)].slice(0, Math.min(winnerCount, entries.length));
}

// ================= CREDIT WINNERS (PER-SERVER, ADD ONCE) =================
async function creditWinners(client, db, winnersList, amount, guildName, guildId, lang) {
    const t = translations[lang];
    const credited = [];

    for (const winnerId of winnersList) {
        try {
            let currentCredits = 0;

            if (client.getUserData) {
                const cached = client.getUserData(winnerId, guildId);
                currentCredits = cached?.credits || 0;
            }

            if (currentCredits === 0) {
                const dbUser = db.prepare("SELECT credits FROM users WHERE id = ? AND guild_id = ?").get(winnerId, guildId);
                currentCredits = dbUser?.credits || 0;
            }

            const newCredits = currentCredits + amount;

            const existing = db.prepare("SELECT id FROM users WHERE id = ? AND guild_id = ?").get(winnerId, guildId);
            if (!existing) {
                db.prepare("INSERT INTO users (id, guild_id, username, xp, level, credits) VALUES (?, ?, ?, 0, 1, ?)").run(winnerId, guildId, 'Unknown', newCredits);
            } else {
                db.prepare("UPDATE users SET credits = ? WHERE id = ? AND guild_id = ?").run(newCredits, winnerId, guildId);
            }

            if (client.userDataCache) {
                client.userDataCache.delete(`${winnerId}:${guildId}`);
            }

            console.log(`[GIVEAWAY] ✅ Credited ${winnerId}: ${currentCredits} → ${newCredits} (+${amount})`);
            credited.push({ id: winnerId, oldBalance: currentCredits, newBalance: newCredits });

            // DM the winner
            try {
                const user = await client.users.fetch(winnerId).catch(() => null);
                if (user) {
                    const receiptEmbed = new EmbedBuilder()
                        .setColor(ARCHON.green)
                        .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.prizeClaimed}`, iconURL: client.user.displayAvatarURL() })
                        .setTitle(`\`\`\`ansi\n\u001b[1;32m  🎁 GIVEAWAY WINNINGS RECEIPT\u001b[0m\n\`\`\``)
                        .setDescription(
                            `\`\`\`ansi\n` +
                            `\u001b[1;36m  Prize:\u001b[0m ${amount.toLocaleString()} Credits\n\n` +
                            `\u001b[1;36m  Previous Balance:\u001b[0m ${currentCredits.toLocaleString()} 🪙\n` +
                            `\u001b[1;36m  Amount Won:\u001b[0m \u001b[1;32m+${amount.toLocaleString()} 🪙\u001b[0m\n` +
                            `\u001b[1;36m  New Balance:\u001b[0m \u001b[1;33m${newCredits.toLocaleString()} 🪙\u001b[0m\n\n` +
                            `\u001b[1;32m  ✅ TRANSACTION COMPLETE\u001b[0m\n` +
                            `\u001b[0;37m  Verify with .bal or .credits\u001b[0m\n` +
                            `\`\`\``
                        )
                        .setFooter({ text: `${guildName} • ${t.footer}` })
                        .setTimestamp();
                    await user.send({ embeds: [receiptEmbed] }).catch(() => {});
                }
            } catch (e) {}

        } catch (err) {
            console.error(`[GIVEAWAY] ❌ Failed to credit ${winnerId}:`, err.message);
        }
    }

    console.log(`[GIVEAWAY] 📊 Credited ${credited.length}/${winnersList.length} winners. Total: ${amount * credited.length} 🪙`);
    return credited;
}

// ================= INLINE BALANCE EMBED =================
function buildBalanceEmbed(userData, lang, guildName, guildIcon, version) {
    const credits = userData?.credits || 0;
    const level = userData?.level || 1;
    const xp = userData?.xp || 0;
    const isFR = lang === 'fr';

    let wealthEmoji = '💀', wealthLabel = isFR ? 'Sans le Sou' : 'Broke';
    if (credits >= 100000) { wealthEmoji = '🏆'; wealthLabel = isFR ? 'Légende' : 'Legend'; }
    else if (credits >= 50000) { wealthEmoji = '👑'; wealthLabel = isFR ? 'Magnat' : 'Magnate'; }
    else if (credits >= 15000) { wealthEmoji = '🏦'; wealthLabel = isFR ? 'Baron' : 'Baron'; }
    else if (credits >= 5000) { wealthEmoji = '📈'; wealthLabel = isFR ? 'Investisseur' : 'Investor'; }
    else if (credits >= 1000) { wealthEmoji = '💰'; wealthLabel = isFR ? 'Collectionneur' : 'Collector'; }
    else if (credits >= 100) { wealthEmoji = '🪙'; wealthLabel = isFR ? 'Petit Portefeuille' : 'Small Wallet'; }

    return new EmbedBuilder()
        .setColor(credits >= 5000 ? ARCHON.green : credits >= 1000 ? ARCHON.gold : ARCHON.red)
        .setAuthor({
            name: isFR ? '💎 SOLDE ACTUEL' : '💎 CURRENT BALANCE',
            iconURL: guildIcon
        })
        .setDescription(
            `\`\`\`ansi\n` +
            `\u001b[1;33m  💰 ${credits.toLocaleString()} 🪙\u001b[0m\n` +
            `\u001b[1;36m  ${wealthEmoji} ${wealthLabel}\u001b[0m\n` +
            `\u001b[1;35m  Lv.${level}  •  ${xp.toLocaleString()} XP\u001b[0m\n` +
            `\`\`\``
        )
        .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon })
        .setTimestamp();
}

// ================= ANNOUNCE IN GIFT CHANNEL =================
async function announceInGiftChannel(client, db, guildId, winnersList, prize, hostName, amount, lang, version, guildName) {
    const t = translations[lang];
    const MAIN_SERVER_ID = process.env.MAIN_SERVER_ID;
    const isMainServer = guildId === MAIN_SERVER_ID;

    let GIFT_CHANNEL_ID;
    if (isMainServer) {
        GIFT_CHANNEL_ID = process.env.GIFT_CHANNEL_ID;
    } else {
        try {
            const serverSettings = db.prepare('SELECT gift_channel FROM server_settings WHERE guild_id = ?').get(guildId);
            GIFT_CHANNEL_ID = serverSettings?.gift_channel;
        } catch (err) {
            console.log('[GIVEAWAY] gift_channel column missing, skipping announcement');
            return false;
        }
    }

    if (!GIFT_CHANNEL_ID) return false;

    try {
        const giftChannel = await client.channels.fetch(GIFT_CHANNEL_ID).catch(() => null);
        if (!giftChannel) return false;

        const totalDistributed = amount * winnersList.length;

        const giftEmbed = new EmbedBuilder()
            .setColor(ARCHON.amber)
            .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.prizeClaimed} • ${t.winnersReceipt}`, iconURL: client.user.displayAvatarURL() })
            .setTitle(`\`\`\`ansi\n\u001b[1;33m  🎁 ${prize}\u001b[0m\n\`\`\``)
            .setDescription(
                `\`\`\`ansi\n` +
                `\u001b[1;36m  ${t.hostedBy}:\u001b[0m ${hostName}\n` +
                `\u001b[1;36m  ${t.prize}:\u001b[0m ${prize}\n` +
                `\u001b[1;36m  ${t.winnersList}:\u001b[0m ${winnersList.length}\n` +
                `\u001b[1;36m  ${t.amountPerWinner}:\u001b[0m \u001b[1;33m${amount.toLocaleString()} 🪙\u001b[0m\n` +
                `\u001b[1;36m  ${t.totalDistributed}:\u001b[0m \u001b[1;33m${totalDistributed.toLocaleString()} 🪙\u001b[0m\n` +
                `\`\`\`\n` +
                `🎉 **${t.congratulations}** ${winnersList.map(w => `<@${w}>`).join(', ')}!\n\n` +
                `╔══════════════════════════════════╗\n` +
                `║     💰 ${t.verifyYourWinnings}     ║\n` +
                `╠══════════════════════════════════╣\n` +
                `║  ${t.verifyMessage}               ║\n` +
                `╚══════════════════════════════════╝`
            )
            .setFooter({ text: `${guildName} • ${t.footer} • v${version}` })
            .setTimestamp();

        await giftChannel.send({
            content: `${t.giftChannelAnnouncement} ${winnersList.map(w => `<@${w}>`).join(' ')}`,
            embeds: [giftEmbed]
        });

        return true;
    } catch (err) {
        console.error('[GIVEAWAY] Gift channel announce failed:', err.message);
        return false;
    }
}

// ================= MAIN COMMAND =================
module.exports = {
    name: 'giveaway',
    aliases: ['g', 'gift', 'concours', 'cadeau', 'give', 'gw'],
    description: '🎁 Create neural giveaways for community engagement.',
    category: 'ECONOMY',
    cooldown: 5000,
    userPermissions: ['ManageGuild'],
    usage: '.giveaway [time] [winners] [prize] [--everyone|--here]',
    examples: [
        '.giveaway 1h 2 1000 Credits',
        '.giveaway 30m 1 Legendary Pack --everyone',
        '.concours 2h 3 5000 Crédits --here'
    ],

    // ================= SLASH COMMAND DATA =================
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('🎁 Create neural giveaways for community engagement')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
        .addStringOption(option =>
            option.setName('time')
                .setDescription('Duration (e.g., 10s, 5m, 2h, 1d)')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('winners')
                .setDescription('Number of winners (1-20)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(20)
        )
        .addStringOption(option =>
            option.setName('prize')
                .setDescription('Prize description (include credit amount)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('mention')
                .setDescription('Mention type')
                .setRequired(false)
                .addChoices(
                    { name: '@everyone', value: 'everyone' },
                    { name: '@here', value: 'here' },
                    { name: 'None', value: 'none' }
                )
        ),

    // ═══════════════════════════════════════════════════════
    // PREFIX COMMAND
    // ═══════════════════════════════════════════════════════
    run: async (client, message, args, db, serverSettings, usedCommand) => {

        const lang = client.detectLanguage
            ? client.detectLanguage(usedCommand, 'en')
            : (usedCommand?.includes('concours') || usedCommand?.includes('cadeau') ? 'fr' : 'en');

        const t = translations[lang];
        const prefix = serverSettings?.prefix || process.env.PREFIX || '.';
        const version = client.version || '1.7.0';
        const guildName = message.guild.name.toUpperCase();
        const guildIcon = message.guild.iconURL() || client.user.displayAvatarURL();
        const guildId = message.guild.id;

        // ================= PERMISSION CHECK =================
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            const errorEmbed = new EmbedBuilder()
                .setColor(ARCHON.red)
                .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.title}`, iconURL: client.user.displayAvatarURL() })
                .setTitle(`\`\`\`ansi\n\u001b[1;31m  ${t.noPermission}\u001b[0m\n\`\`\``)
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });
            return message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }

        // ================= SHOW ACTIVE GIVEAWAYS =================
        if (!args[0]) {
            const guildGiveaways = [];
            const guildMap = activeGiveaways.get(guildId);
            if (guildMap) {
                guildMap.forEach(g => { if (!g.ended) guildGiveaways.push(g); });
            }

            if (guildGiveaways.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(ARCHON.gray)
                    .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.title}`, iconURL: client.user.displayAvatarURL() })
                    .setTitle(`\`\`\`ansi\n\u001b[1;33m  🎁 NO ACTIVE GIVEAWAYS\u001b[0m\n\`\`\``)
                    .setDescription(`\`\`\`ansi\n\u001b[0;37m  ${t.noActiveGiveaways.replace('{prefix}', prefix)}\u001b[0m\n\`\`\``)
                    .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });

                return message.reply({ embeds: [embed] }).catch(() => {});
            }

            const embed = new EmbedBuilder()
                .setColor(ARCHON.green)
                .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.title} • ${t.active}`, iconURL: client.user.displayAvatarURL() })
                .setTitle(`\`\`\`ansi\n\u001b[1;32m  🎁 ${guildGiveaways.length} ${t.activeGiveaways}\u001b[0m\n\`\`\``)
                .setDescription(
                    guildGiveaways.map((g, i) =>
                        `**${i + 1}.** 🎁 **${g.prize}**\n` +
                        `└─ ${t.winners}: \`${g.winners}\` • ${t.entries}: \`${g.entries.length}\`\n` +
                        `└─ ${t.ends}: <t:${Math.floor(g.endTimestamp / 1000)}:R>\n` +
                        `└─ 🔗 [${t.jumpToGiveaway}](https://discord.com/channels/${g.guildId}/${g.channelId}/${g.messageId})`
                    ).join('\n\n')
                )
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                .setTimestamp();

            return message.reply({ embeds: [embed] }).catch(() => {});
        }

        // ================= PARSE MENTION FLAGS =================
        let mentionType = 'none';
        const cleanArgs = args.filter(arg => {
            if (arg === '--everyone') { mentionType = 'everyone'; return false; }
            if (arg === '--here') { mentionType = 'here'; return false; }
            return true;
        });

        // ARCHITECT GUARD: Advanced ping permission check
        if (mentionType !== 'none') {
            const botMember = message.guild.members.me;
            if (!botMember.permissions.has(PermissionsBitField.Flags.MentionEveryone)) {
                const permUpgradeEmbed = new EmbedBuilder()
                    .setColor(ARCHON.orange)
                    .setAuthor({ name: '🦅 ARCHON ENGINE • SECURITY BLOCK', iconURL: client.user.displayAvatarURL() })
                    .setTitle(`\`\`\`ansi\n\u001b[1;33m  📢 ADVANCED NOTIFICATION LAYER LOCKED\u001b[0m\n\`\`\``)
                    .setDescription(
                        `\`\`\`ansi\n` +
                        (lang === 'fr'
                            ? `\u001b[1;33m⚠️ SIGNATURE D'AUTORITÉ MANQUANTE\u001b[0m\n\nPour utiliser les pings globaux, ce nœud nécessite le niveau d'autorisation \u001b[1;32mMentionner Tout le Monde\u001b[0m.\n`
                            : `\u001b[1;33m⚠️ MISSING AUTHORITY SIGNATURE\u001b[0m\n\nTo utilize global pings, this node requires the \u001b[1;32mMention Everyone\u001b[0m clearance level.\n`) +
                        `\`\`\`\n\n` +
                        `> *${lang === 'fr' ? 'Cliquez sur le lien pour mettre à niveau les permissions.' : 'Click the secure link below to upgrade this bot instance\'s authorization.'}*`
                    )
                    .setFooter({ text: `${guildName} • Authorization Terminal`, iconURL: guildIcon })
                    .setTimestamp();

                const upgradeRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel(lang === 'fr' ? 'Accorder les Permissions' : 'Grant Advanced Clearance')
                        .setStyle(ButtonStyle.Link)
                        .setURL(client.ADVANCED_INVITE_URL || 'https://discord.com')
                        .setEmoji('⚡')
                );

                return message.reply({ embeds: [permUpgradeEmbed], components: [upgradeRow] }).catch(() => {});
            }
        }

        // ================= CREATE GIVEAWAY =================
        const timeStr = cleanArgs[0];
        const winnersStr = cleanArgs[1];
        const prize = cleanArgs.slice(2).join(' ');

        if (!timeStr || !winnersStr || !prize) {
            const embed = new EmbedBuilder()
                .setColor(ARCHON.red)
                .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.title}`, iconURL: client.user.displayAvatarURL() })
                .setTitle(`\`\`\`ansi\n\u001b[1;31m  ❌ ${t.missingArguments}\u001b[0m\n\`\`\``)
                .setDescription(
                    `\`\`\`ansi\n` +
                    `\u001b[1;36m  ${t.usage}\u001b[0m\n` +
                    `\u001b[1;36m  ${t.example}\u001b[0m\n\n` +
                    `\u001b[1;36m  ${t.timeFormats}:\u001b[0m \u001b[0;37m10s, 5m, 2h, 1d\u001b[0m\n\n` +
                    `\u001b[1;36m  Mention Options:\u001b[0m\n` +
                    `\u001b[0;37m  --everyone - Ping @everyone\u001b[0m\n` +
                    `\u001b[0;37m  --here - Ping @here\u001b[0m\n` +
                    `\`\`\``
                )
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });

            return message.reply({ embeds: [embed] }).catch(() => {});
        }

        const timeData = parseTime(timeStr, lang);
        if (!timeData) {
            const errorEmbed = new EmbedBuilder()
                .setColor(ARCHON.red)
                .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.title}`, iconURL: client.user.displayAvatarURL() })
                .setTitle(`\`\`\`ansi\n\u001b[1;31m  ${t.invalidTime}\u001b[0m\n\`\`\``)
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });
            return message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }

        const winners = parseInt(winnersStr);
        if (isNaN(winners) || winners < 1 || winners > 20) {
            const errorEmbed = new EmbedBuilder()
                .setColor(ARCHON.red)
                .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.title}`, iconURL: client.user.displayAvatarURL() })
                .setTitle(`\`\`\`ansi\n\u001b[1;31m  ${t.invalidWinners}\u001b[0m\n\`\`\``)
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });
            return message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }

        // Extract credit amount
        let amount = 0;
        const creditPattern = /(\d[\d,]*)\s*(?:credits?|crédits?|🪙|coins?)/i;
        const creditMatch = prize.match(creditPattern);

        if (creditMatch) {
            amount = parseInt(creditMatch[1].replace(/,/g, ''));
        } else {
            const allNumbers = prize.match(/\d[\d,]*/g);
            if (allNumbers) {
                amount = parseInt(allNumbers[allNumbers.length - 1].replace(/,/g, ''));
            }
        }

        if (amount <= 0) {
            const embed = new EmbedBuilder()
                .setColor(ARCHON.red)
                .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.title}`, iconURL: client.user.displayAvatarURL() })
                .setTitle(`\`\`\`ansi\n\u001b[1;31m  ❌ INVALID CREDIT AMOUNT\u001b[0m\n\`\`\``)
                .setDescription(`\`\`\`ansi\n\u001b[0;37m  Please specify a valid credit amount in the prize.\u001b[0m\n\`\`\``)
                .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon });
            return message.reply({ embeds: [embed] }).catch(() => {});
        }

        const totalPool = amount;

        // Create giveaway object
        const giveawayId = `${message.id}_${Date.now()}`;
        const endTimestamp = Date.now() + timeData.ms;

        const giveaway = {
            id: giveawayId,
            guildId: message.guild.id,
            channelId: message.channel.id,
            messageId: null,
            hostId: message.author.id,
            hostName: message.author.username,
            hostIcon: message.author.displayAvatarURL(),
            prize: prize,
            winners: winners,
            entries: [],
            endTimestamp: endTimestamp,
            displayTime: timeData.text,
            ended: false,
            amount: Math.floor(amount / winners),
            totalPool: totalPool,
            originalAmount: amount
        };

        // Create buttons
        const row = createButtonRow('active', lang);

        // Build announcement
        const startEmbed = new EmbedBuilder()
            .setColor(ARCHON.amber)
            .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.title}`, iconURL: client.user.displayAvatarURL() })
            .setTitle(`\`\`\`ansi\n\u001b[1;33m  🎁 ${prize}\u001b[0m\n\`\`\``)
            .setDescription(
                `\`\`\`ansi\n` +
                `\u001b[1;36m  ${t.hostedBy}:\u001b[0m ${message.author.username}\n` +
                `\u001b[1;36m  ${t.winners}:\u001b[0m ${winners} ${t.winnersList.toLowerCase()}\n` +
                `\u001b[1;36m  ${t.eachWinnerGets}:\u001b[0m \u001b[1;33m${amount.toLocaleString()} 🪙\u001b[0m\n` +
                `\u001b[1;36m  ${t.totalPrizePool}:\u001b[0m \u001b[1;33m${totalPool.toLocaleString()} 🪙\u001b[0m\n` +
                `\u001b[1;36m  ${t.timeRemaining}:\u001b[0m ${timeData.text}\n` +
                `\`\`\`\n\n` +
                `## 🎲 **${t.randomSelection}**\n` +
                `*${t.randomSelectionDesc}*\n\n` +
                `### 🌍 **${t.serverWideEntry}**\n` +
                `*${t.serverWideDesc}*\n\n` +
                `### 👇 **${t.clickToEnter}**\n` +
                `### 📊 **${t.entriesSoFar}: 0**`
            )
            .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
            .setTimestamp();

        let mentionText = '';
        if (mentionType === 'everyone') mentionText = '@everyone';
        else if (mentionType === 'here') mentionText = '@here';

        const giveawayMessage = await message.channel.send({
            content: mentionText || undefined,
            embeds: [startEmbed],
            components: [row],
            allowedMentions: mentionType === 'everyone' ? { parse: ['everyone'] } : (mentionType === 'here' ? { parse: ['here'] } : undefined)
        }).catch(() => {});

        if (!giveawayMessage) return;

        giveaway.messageId = giveawayMessage.id;

        // Store per guild (no leakage)
        if (!activeGiveaways.has(message.guild.id)) {
            activeGiveaways.set(message.guild.id, new Map());
        }
        activeGiveaways.get(message.guild.id).set(giveawayId, giveaway);

        setTimeout(async () => {
            const fullEmbed = createGiveawayEmbed(giveaway, 'active', lang, message.guild, client);
            await giveawayMessage.edit({ embeds: [fullEmbed] }).catch(() => {});
        }, 1000);

        // ================= BUTTON COLLECTOR =================
        const collector = giveawayMessage.createMessageComponentCollector({
            componentType: ComponentType.Button
        });

        collector.on('collect', async (i) => {
            const currentGiveaway = activeGiveaways.get(message.guild.id)?.get(giveawayId);
            if (!currentGiveaway) return;

            if (!i.deferred && !i.replied) {
                try { await i.deferUpdate(); } catch (e) {}
            }

            // Handle Enter
            if (i.customId === 'gw_enter') {
                if (i.user.id === currentGiveaway.hostId) {
                    return i.followUp({ content: t.cannotEnter, ephemeral: true }).catch(() => {});
                }

                if (currentGiveaway.entries.includes(i.user.id)) {
                    return i.followUp({ content: t.alreadyEntered, ephemeral: true }).catch(() => {});
                }

                currentGiveaway.entries.push(i.user.id);
                activeGiveaways.get(message.guild.id)?.set(giveawayId, currentGiveaway);

                const updatedEmbed = createGiveawayEmbed(currentGiveaway, 'active', lang, message.guild, client);
                await i.editReply({ embeds: [updatedEmbed], components: [row] }).catch(() => {});

                return i.followUp({ content: t.autoEntered, ephemeral: true }).catch(() => {});
            }

            // Handle Leave
            if (i.customId === 'gw_leave') {
                const index = currentGiveaway.entries.indexOf(i.user.id);
                if (index === -1) {
                    return i.followUp({ content: t.notEntered, ephemeral: true }).catch(() => {});
                }

                currentGiveaway.entries.splice(index, 1);
                activeGiveaways.get(message.guild.id)?.set(giveawayId, currentGiveaway);

                const updatedEmbed = createGiveawayEmbed(currentGiveaway, 'active', lang, message.guild, client);
                await i.editReply({ embeds: [updatedEmbed], components: [row] }).catch(() => {});

                return i.followUp({ content: t.leaveSuccess, ephemeral: true }).catch(() => {});
            }

            // Handle Reroll
            if (i.customId === 'gw_reroll') {
                if (i.user.id !== currentGiveaway.hostId && !i.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                    return i.followUp({ content: t.accessDenied, ephemeral: true }).catch(() => {});
                }

                const newWinners = selectWinners(currentGiveaway.entries, currentGiveaway.winners);

                if (newWinners.length === 0) {
                    return i.followUp({ content: t.noEntries, ephemeral: true }).catch(() => {});
                }

                currentGiveaway.winnersList = newWinners;
                const rerollEmbed = createGiveawayEmbed(currentGiveaway, 'ended', lang, message.guild, client);
                await i.editReply({ embeds: [rerollEmbed], components: [createButtonRow('ended', lang)] }).catch(() => {});

                await handleGiveawayEnd(client, db, currentGiveaway, newWinners, lang, guildName, version, message.guild, i.channel);

                return i.followUp({ content: t.rerollSuccess, ephemeral: true }).catch(() => {});
            }

            // Handle Delete with confirmation
            if (i.customId === 'gw_delete') {
                if (i.user.id !== currentGiveaway.hostId && !i.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                    return i.followUp({ content: t.accessDenied, ephemeral: true }).catch(() => {});
                }

                // Show confirmation
                const confirmEmbed = new EmbedBuilder()
                    .setColor(ARCHON.orange)
                    .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.title}`, iconURL: client.user.displayAvatarURL() })
                    .setTitle(`\`\`\`ansi\n\u001b[1;33m  ⚠️ ${t.confirmDelete}\u001b[0m\n\`\`\``)
                    .setDescription(`\`\`\`ansi\n\u001b[0;37m  ${t.confirmDeleteDesc}\u001b[0m\n\`\`\``)
                    .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });

                const confirmRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`gw_delete_confirm_${i.user.id}`)
                        .setLabel(t.deleteConfirmBtn)
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🗑️'),
                    new ButtonBuilder()
                        .setCustomId(`gw_delete_cancel_${i.user.id}`)
                        .setLabel(t.deleteCancelBtn)
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('❌')
                );

                await i.followUp({ embeds: [confirmEmbed], components: [confirmRow], ephemeral: true }).catch(() => {});

                const confirmMsg = await i.fetchReply().catch(() => null);
                if (!confirmMsg) return;

                const confirmCollector = confirmMsg.createMessageComponentCollector({
                    time: 15000,
                    max: 1
                });

                confirmCollector.on('collect', async (ci) => {
                    await ci.deferUpdate().catch(() => {});

                    if (ci.customId === `gw_delete_confirm_${i.user.id}`) {
                        const guildMap = activeGiveaways.get(message.guild.id);
                        if (guildMap) {
                            guildMap.delete(giveawayId);
                            if (guildMap.size === 0) activeGiveaways.delete(message.guild.id);
                        }
                        collector.stop();

                        await giveawayMessage.edit({
                            content: `\`\`\`ansi\n\u001b[1;31m  🗑️ ${t.deleteSuccess}\u001b[0m\n\`\`\``,
                            embeds: [],
                            components: []
                        }).catch(() => {});

                        await ci.editReply({ content: t.deleteSuccess, embeds: [], components: [] }).catch(() => {});
                    } else {
                        await ci.editReply({ content: t.deleteCancelled, embeds: [], components: [] }).catch(() => {});
                    }
                });
            }
        });

        // ================= TIMER FOR ENDING =================
        setTimeout(async () => {
            const currentGiveaway = activeGiveaways.get(message.guild.id)?.get(giveawayId);
            if (!currentGiveaway) return;

            const winnersList = selectWinners(currentGiveaway.entries, currentGiveaway.winners);
            currentGiveaway.winnersList = winnersList;
            currentGiveaway.ended = true;

            const endedEmbed = createGiveawayEmbed(currentGiveaway, 'ended', lang, message.guild, client);
            const endedRow = createButtonRow('ended', lang);

            try {
                await giveawayMessage.edit({
                    content: `\`\`\`ansi\n\u001b[1;32m  🎊 ${t.giveawayEnded}\u001b[0m\n\`\`\``,
                    embeds: [endedEmbed],
                    components: [endedRow]
                }).catch(() => {});

                if (winnersList.length > 0) {
                    await handleGiveawayEnd(client, db, currentGiveaway, winnersList, lang, guildName, version, message.guild, message.channel);
                } else {
                    await message.channel.send({ content: `\`\`\`ansi\n\u001b[1;31m  😢 ${t.noEntries}\u001b[0m\n\`\`\`` }).catch(() => {});
                }
            } catch (err) {
                console.error('[GIVEAWAY] Error ending:', err);
            }

            await logToMainServer(client, message.guild, 'GIVEAWAY_ENDED', {
                prize: currentGiveaway.prize,
                entries: currentGiveaway.entries.length,
                winnersList
            });

            setTimeout(() => {
                const guildMap = activeGiveaways.get(message.guild.id);
                if (guildMap) {
                    guildMap.delete(giveawayId);
                    if (guildMap.size === 0) activeGiveaways.delete(message.guild.id);
                }
            }, 3600000);

        }, timeData.ms);

        // ================= CONFIRMATION =================
        const confirmEmbed = new EmbedBuilder()
            .setColor(ARCHON.green)
            .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.creating}`, iconURL: message.author.displayAvatarURL() })
            .setTitle(`\`\`\`ansi\n\u001b[1;32m  ✅ ${t.createdSuccess}\u001b[0m\n\`\`\``)
            .setDescription(
                `\`\`\`ansi\n` +
                `\u001b[1;36m  ${t.prize}:\u001b[0m ${prize}\n` +
                `\u001b[1;36m  ${t.winners}:\u001b[0m ${winners}\n` +
                `\u001b[1;36m  ${t.eachWinnerGets}:\u001b[0m \u001b[1;33m${amount.toLocaleString()} 🪙\u001b[0m\n` +
                `\u001b[1;36m  ${t.totalPrizePool}:\u001b[0m \u001b[1;33m${totalPool.toLocaleString()} 🪙\u001b[0m\n` +
                `\u001b[1;36m  ${t.timeRemaining}:\u001b[0m ${timeData.text}\n` +
                (mentionType !== 'none' ? `\u001b[1;36m  Mention:\u001b[0m ${mentionType === 'everyone' ? '@everyone' : '@here'}\n` : '') +
                `\`\`\`\n` +
                `🌍 **${t.serverWideEntry}** — ${t.serverWideDesc}\n` +
                `🎲 **${t.randomSelection}** — ${t.randomSelectionDesc}`
            )
            .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
            .setTimestamp();

        await logToMainServer(client, message.guild, 'GIVEAWAY_CREATED', {
            prize, winners, amount, mentionType, channel: message.channel.name, host: message.author.tag
        });

        return message.reply({ embeds: [confirmEmbed] }).catch(() => {});
    },

    // ================= SLASH COMMAND EXECUTION =================
    execute: async (interaction, client) => {
        if (!interaction.guild) {
            const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
            const t = translations[lang];

            const errorEmbed = new EmbedBuilder()
                .setColor(ARCHON.red)
                .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.title}`, iconURL: client.user.displayAvatarURL() })
                .setTitle(`\`\`\`ansi\n\u001b[1;31m  ❌ ${t.dmError}\u001b[0m\n\`\`\``)
                .setFooter({ text: `Neural Core • v${client.version || '1.7.0'}` });

            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const time = interaction.options.getString('time');
        const winners = interaction.options.getInteger('winners');
        const prize = interaction.options.getString('prize');
        const mention = interaction.options.getString('mention') || 'none';

        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const usedCommand = lang === 'fr' ? 'concours' : 'giveaway';

        const args = [time, winners.toString(), prize];
        if (mention !== 'none') {
            args.push(`--${mention}`);
        }

        const fakeMessage = {
            author: interaction.user,
            guild: interaction.guild,
            channel: interaction.channel,
            member: interaction.member,
            reply: async (options) => {
                return interaction.editReply(options);
            },
            react: () => Promise.resolve()
        };

        const serverSettings = interaction.guild ? client.getServerSettings(interaction.guild.id) : { prefix: '.' };

        await module.exports.run(client, fakeMessage, args, client.db, serverSettings, usedCommand);
    }
};

// ================= GIVEAWAY END HANDLER =================
async function handleGiveawayEnd(client, db, giveaway, winnersList, lang, guildName, version, guild, channel) {
    const t = translations[lang];
    const amount = giveaway.amount || 0;

    const winnerAnnouncement = new EmbedBuilder()
        .setColor(ARCHON.amber)
        .setAuthor({ name: `🦅 ARCHON ENGINE • ${t.giveawayEnded}`, iconURL: client.user.displayAvatarURL() })
        .setTitle(`\`\`\`ansi\n\u001b[1;32m  🎊 ${t.giveawayEnded}\u001b[0m\n\`\`\``)
        .setDescription(
            `\`\`\`ansi\n` +
            `\u001b[1;36m  ${t.prize}:\u001b[0m ${giveaway.prize}\n` +
            `\u001b[1;36m  ${t.eachWinnerGets}:\u001b[0m \u001b[1;33m${amount.toLocaleString()} 🪙\u001b[0m\n` +
            `\u001b[1;36m  ${t.winnersList}:\u001b[0m ${winnersList.length}\n` +
            `\u001b[1;36m  ${t.totalEntriesReceived}:\u001b[0m ${giveaway.entries.length}\n` +
            `\`\`\`\n` +
            `🎉 **${t.congratulations}** ${winnersList.map(w => `<@${w}>`).join(', ')}!\n\n` +
            `## 🍀 **${t.luckiestMembers}**\n` +
            `*${t.winnersRandomlyChosen}*\n\n` +
            `╔══════════════════════════════════╗\n` +
            `║     💰 ${t.verifyYourWinnings}     ║\n` +
            `╠══════════════════════════════════╣\n` +
            `║  ${t.verifyMessage}               ║\n` +
            `╚══════════════════════════════════╝`
        )
        .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guild.iconURL() || client.user.displayAvatarURL() })
        .setTimestamp();

    const balanceRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel(t.checkBalanceBtn)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('💰')
            .setCustomId('gw_check_balance')
    );

    const balanceMsg = await channel.send({
        content: winnersList.map(w => `<@${w}>`).join(' '),
        embeds: [winnerAnnouncement],
        components: [balanceRow]
    }).catch(() => {});

    if (balanceMsg) {
        const balanceCollector = balanceMsg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 300000
        });

        balanceCollector.on('collect', async (bi) => {
            if (bi.customId !== 'gw_check_balance') return;
            if (!bi.deferred && !bi.replied) {
                try { await bi.deferUpdate(); } catch (e) {}
            }

            const checkerId = bi.user.id;
            let userData = null;
            if (client.getUserData) {
                userData = client.getUserData(checkerId, guild.id);
            }
            if (!userData) {
                try {
                    userData = db.prepare("SELECT credits, level, xp FROM users WHERE id = ? AND guild_id = ?").get(checkerId, guild.id);
                } catch (e) {}
            }

            const balanceEmbed = buildBalanceEmbed(userData, lang, guildName, guild.iconURL(), version);
            await bi.followUp({ embeds: [balanceEmbed], ephemeral: true }).catch(() => {});
        });
    }

    if (amount > 0) {
        await creditWinners(client, db, winnersList, amount, guildName, guild.id, lang);
    }

    await announceInGiftChannel(client, db, guild.id, winnersList, giveaway.prize, giveaway.hostName, amount, lang, version, guildName);
}

