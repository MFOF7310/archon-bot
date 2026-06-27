const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, ComponentType } = require('discord.js');

// ================= TRANSLATIONS =================
const gameTranslations = {
    en: {
        title: '🎮 NEURAL GAME CENTER', subtitle: 'Choose your neural challenge!',
        availableGames: 'Available Games', yourStats: 'Your Stats',
        gamesPlayed: 'Games Played', gamesWon: 'Games Won', totalWinnings: 'Total Winnings', winRate: 'Win Rate',
        footer: 'NEURAL GAME CENTER',
        codm: 'CALL OF DUTY MOBILE', slots: '🎰 SLOTS', tictactoe: '⭕ TIC TAC TOE', blackjack: '🃏 BLACKJACK', roulette: '🎲 ROULETTE', trivia: '🧠 TRIVIA',
        codmDesc: 'Simulate CODM ranked matches', slotsDesc: 'Spin the neural slots', tictactoeDesc: 'Classic Tic Tac Toe (2 players)',
        blackjackDesc: 'Beat the dealer', rouletteDesc: 'Bet on your number', triviaDesc: 'Test your knowledge',
        usage: (prefix) => `Usage: \`${prefix}game <codm/slots/tictactoe/blackjack/roulette/trivia> [bet]\``,
        invalidGame: '❌ **INVALID GAME**',
        betRequired: '❌ **BET REQUIRED**', insufficientCredits: '❌ **INSUFFICIENT CREDITS!** You have',
        gameStarted: '✅ **GAME STARTED!**', results: '🎮 RESULTS', youWon: '✅ YOU WON!', youLost: '❌ YOU LOST!',
        winnings: 'Winnings', loss: 'Loss', newBalance: 'New Balance', bet: 'BET', spin: 'SPIN', jackpot: '💎 JACKPOT!',
        matchLost: 'Match Lost', matchWon: 'Match Won', rankUp: 'RANK UP!', currentRank: 'Current Rank',
        draw: '🤝 DRAW!', notYourTurn: '❌ **NOT YOUR TURN!**', challenge: (user) => `**${user}** challenges you to Tic Tac Toe! Click to accept.`,
        accept: 'ACCEPT', decline: 'DECLINE', gameFull: '❌ **GAME IS FULL!**', yourTurn: '🎯 YOUR TURN', opponentTurn: '⏳ OPPONENT\'S TURN',
        waitForOpponent: '⏳ Waiting for opponent...', selectSquare: 'Select a square', challengeSent: 'Challenge sent!',
        hit: 'HIT', stand: 'STAND', youBusted: '💥 BUSTED!', dealerBusted: '💥 DEALER BUSTED!',
        yourHand: 'Your Hand', dealerHand: 'Dealer Hand', total: 'Total', blackjackWin: '🎉 BLACKJACK!',
        chooseNumber: 'Choose your number', invalidBet: '❌ **INVALID BET!**', minBet: 'Minimum bet is 10 🪙', maxBet: 'Maximum bet is 10,000 🪙',
        betPlaced: '✅ Bet placed! Spinning...', notEnoughCredits: '❌ Not enough credits!', invalidNumber: '❌ Invalid number!',
        rouletteResult: (number, color) => `**${number}** ${color}`, rouletteRed: '🔴 RED', rouletteBlack: '⚫ BLACK', rouletteGreen: '🟢 GREEN',
        slotsWin: '💰 SLOTS WIN!', slotsLoss: '🎰 SLOTS', slotsResult: (line) => `**${line.join(' ')}**`,
        credits: 'credits', you: 'YOU', opponent: 'OPPONENT', win: 'WIN', lose: 'LOSE', creditsEmoji: '🪙',
        gameOver: '🎮 GAME OVER', playAgain: 'PLAY AGAIN', backToMenu: 'BACK TO MENU', processing: '⏳ Processing...',
        noActiveGame: '❌ **NO ACTIVE GAME!**', alreadyInGame: '❌ **ALREADY IN A GAME!**',
        exit: 'EXIT', confirmExit: 'Exit?', yes: 'YES', no: 'NO', exitCanceled: 'Exit canceled.', exitConfirmed: 'Game exited.',
        error: '❌ **ERROR!**', tryAgain: 'Try again.', timeout: '⏰ **TIMEOUT!**',
        neuralChips: (amount) => `${amount} 🪙`, viewStats: '📊 VIEW STATS', leaderboard: '🏆 LEADERBOARD',
        invalidMove: '❌ Invalid move!', spotTaken: '❌ Spot taken!', wonTicTacToe: (winner) => `🎉 **${winner} WINS!**`,
        newTicTacToe: '⭕ NEW TIC TAC TOE', challengeUser: 'CHALLENGE @USER', placeMark: 'PLACE MARK',
        rankText: 'Rank', tierText: 'Tier', gameText: 'Game', modeText: 'Mode', xpGained: 'XP Gained',
        levelUp: '🎉 LEVEL UP!', reachedLevel: 'You reached level', roundText: 'ROUND', matchText: 'MATCH',
        victory: '🏆 VICTORY!', defeat: '💀 DEFEAT!', codmMatch: 'CODM MATCH', codmVictory: '🏆 MATCH WON!',
        codmDefeat: '💀 MATCH LOST!', codmStats: 'Match Stats', codmScore: 'SCORE', codmKills: 'KILLS',
        codmDeaths: 'DEATHS', codmKDRatio: 'K/D RATIO', codmMVP: '🌟 MVP!', neuralVictory: '🏆 NEURAL VICTORY!',
        challengeAccepted: '✅ Challenge accepted! Starting...', challengeDeclined: '❌ Challenge declined.',
        noSelfChallenge: '❌ Cannot challenge yourself!', cannotChallengeBot: '❌ Cannot challenge a bot!',
        triviaBridge: '🧠 **Neural Trivia** is available as a standalone command.\nUse `/trivia` to begin your knowledge challenge!',
        triviaLaunching: '🧠 Launching Neural Trivia...',
        hubTitle: '🎮 NEURAL GAME CENTER // BAMAKO_223',
        hubDesc: 'Select a neural challenge below. All games are per-server isolated.',
    },
    fr: {
        title: '🎮 CENTRE DE JEUX NEURAL', subtitle: 'Choisissez votre défi neural !',
        availableGames: 'Jeux Disponibles', yourStats: 'Vos Statistiques',
        gamesPlayed: 'Parties Jouées', gamesWon: 'Parties Gagnées', totalWinnings: 'Gains Totaux', winRate: 'Taux de Victoire',
        footer: 'CENTRE DE JEUX NEURAL',
        codm: 'CALL OF DUTY MOBILE', slots: '🎰 SLOTS', tictactoe: '⭕ MORPION', blackjack: '🃏 BLACKJACK', roulette: '🎲 ROULETTE', trivia: '🧠 TRIVIA',
        codmDesc: 'Simulez des matchs CODM', slotsDesc: 'Tournez les slots neuraux', tictactoeDesc: 'Morpion classique (2 joueurs)',
        blackjackDesc: 'Battez le croupier', rouletteDesc: 'Pariez sur votre numéro', triviaDesc: 'Testez vos connaissances',
        usage: (prefix) => `Utilisation : \`${prefix}game <codm/slots/tictactoe/blackjack/roulette/trivia> [mise]\``,
        invalidGame: '❌ **JEU INVALIDE**',
        betRequired: '❌ **MISE REQUISE**', insufficientCredits: '❌ **CRÉDITS INSUFFISANTS !** Vous avez',
        gameStarted: '✅ **JEU LANCÉ !**', results: '🎮 RÉSULTATS', youWon: '✅ VOUS AVEZ GAGNÉ !', youLost: '❌ VOUS AVEZ PERDU !',
        winnings: 'Gains', loss: 'Perte', newBalance: 'Nouveau Solde', bet: 'MISE', spin: 'TOUR', jackpot: '💎 JACKPOT !',
        matchLost: 'Match Perdu', matchWon: 'Match Gagné', rankUp: 'PROMOTION !', currentRank: 'Rang Actuel',
        draw: '🤝 ÉGALITÉ !', notYourTurn: '❌ **CE N\'EST PAS VOTRE TOUR !**', challenge: (user) => `**${user}** vous défie au Morpion ! Cliquez pour accepter.`,
        accept: 'ACCEPTER', decline: 'REFUSER', gameFull: '❌ **PARTIE PLEINE !**', yourTurn: '🎯 VOTRE TOUR', opponentTurn: '⏳ TOUR DE L\'ADVERSAIRE',
        waitForOpponent: '⏳ En attente de l\'adversaire...', selectSquare: 'Sélectionnez une case', challengeSent: 'Défi envoyé !',
        hit: 'TIRER', stand: 'RESTER', youBusted: '💥 DÉPASSÉ !', dealerBusted: '💥 CROUPIER DÉPASSÉ !',
        yourHand: 'Votre Main', dealerHand: 'Main du Croupier', total: 'Total', blackjackWin: '🎉 BLACKJACK !',
        chooseNumber: 'Choisissez votre numéro', invalidBet: '❌ **MISE INVALIDE !**', minBet: 'Mise minimum : 10 🪙', maxBet: 'Mise maximum : 10 000 🪙',
        betPlaced: '✅ Mise placée ! Lancement...', notEnoughCredits: '❌ Pas assez de crédits !', invalidNumber: '❌ Numéro invalide !',
        rouletteResult: (number, color) => `**${number}** ${color}`, rouletteRed: '🔴 ROUGE', rouletteBlack: '⚫ NOIR', rouletteGreen: '🟢 VERT',
        slotsWin: '💰 GAIN SLOTS !', slotsLoss: '🎰 SLOTS', slotsResult: (line) => `**${line.join(' ')}**`,
        credits: 'crédits', you: 'VOUS', opponent: 'ADVERSAIRE', win: 'GAGNÉ', lose: 'PERDU', creditsEmoji: '🪙',
        gameOver: '🎮 PARTIE TERMINÉE', playAgain: 'REJOUER', backToMenu: 'MENU', processing: '⏳ Traitement...',
        noActiveGame: '❌ **AUCUNE PARTIE ACTIVE !**', alreadyInGame: '❌ **DÉJÀ EN JEU !**',
        exit: 'QUITTER', confirmExit: 'Quitter ?', yes: 'OUI', no: 'NON', exitCanceled: 'Annulé.', exitConfirmed: 'Partie quittée.',
        error: '❌ **ERREUR !**', tryAgain: 'Réessayez.', timeout: '⏰ **TEMPS ÉCOULÉ !**',
        neuralChips: (amount) => `${amount} 🪙`, viewStats: '📊 VOIR STATS', leaderboard: '🏆 CLASSEMENT',
        invalidMove: '❌ Coup invalide !', spotTaken: '❌ Case prise !', wonTicTacToe: (winner) => `🎉 **${winner} GAGNE !**`,
        newTicTacToe: '⭕ NOUVEAU MORPION', challengeUser: 'DEFIER @USER', placeMark: 'PLACER',
        rankText: 'Rang', tierText: 'Tier', gameText: 'Jeu', modeText: 'Mode', xpGained: 'XP Gagné',
        levelUp: '🎉 NIVEAU SUPÉRIEUR !', reachedLevel: 'Vous avez atteint le niveau', roundText: 'MANCHE', matchText: 'MATCH',
        victory: '🏆 VICTOIRE !', defeat: '💀 DÉFAITE !', codmMatch: 'MATCH CODM', codmVictory: '🏆 MATCH GAGNÉ !',
        codmDefeat: '💀 MATCH PERDU !', codmStats: 'Stats du Match', codmScore: 'SCORE', codmKills: 'ÉLIMINATIONS',
        codmDeaths: 'MORTS', codmKDRatio: 'RATIO K/D', codmMVP: '🌟 MVP !', neuralVictory: '🏆 VICTOIRE NEURALE !',
        challengeAccepted: '✅ Défi accepté ! Lancement...', challengeDeclined: '❌ Défi refusé.',
        noSelfChallenge: '❌ Vous ne pouvez pas vous défier vous-même !', cannotChallengeBot: '❌ Impossible de défier un bot !',
        triviaBridge: '🧠 **Neural Trivia** est disponible en commande autonome.\nUtilisez `/trivia` pour commencer votre défi de connaissances !',
        triviaLaunching: '🧠 Lancement de Neural Trivia...',
        hubTitle: '🎮 CENTRE DE JEUX NEURAL // BAMAKO_223',
        hubDesc: 'Sélectionnez un défi neural ci-dessous. Tous les jeux sont isolés par serveur.',
    }
};

// ================= RANKS =================
const RANKS = [
    { name: 'Unranked', min: 0, max: 0 }, { name: 'Bronze I', min: 1, max: 200 }, { name: 'Bronze II', min: 201, max: 400 },
    { name: 'Bronze III', min: 401, max: 600 }, { name: 'Silver I', min: 601, max: 900 }, { name: 'Silver II', min: 901, max: 1200 },
    { name: 'Silver III', min: 1201, max: 1500 }, { name: 'Gold I', min: 1501, max: 1900 }, { name: 'Gold II', min: 1901, max: 2300 },
    { name: 'Gold III', min: 2301, max: 2700 }, { name: 'Platinum I', min: 2701, max: 3200 }, { name: 'Platinum II', min: 3201, max: 3700 },
    { name: 'Platinum III', min: 3701, max: 4200 }, { name: 'Diamond I', min: 4201, max: 4800 }, { name: 'Diamond II', min: 4801, max: 5400 },
    { name: 'Diamond III', min: 5401, max: 6000 }, { name: 'Master I', min: 6001, max: 6800 }, { name: 'Master II', min: 6801, max: 7600 },
    { name: 'Master III', min: 7601, max: 8400 }, { name: 'Grandmaster', min: 8401, max: 9400 },
    { name: 'Legendary', min: 9401, max: 11000 }, { name: 'Mythic', min: 11001, max: 13000 },
    { name: 'Mythic II', min: 13001, max: 15000 }, { name: 'Mythic III', min: 15001, max: 20000 },
    { name: 'Neural God', min: 20001, max: 30000 }, { name: 'Bamako Legend', min: 30001, max: 50000 },
    { name: 'Supreme Architect', min: 50001, max: Infinity }
];

function getRank(points) { return RANKS.find(r => points >= r.min && points <= r.max) || RANKS[RANKS.length - 1]; }
function nextRankPoints(currentPoints) { const idx = RANKS.findIndex(r => currentPoints >= r.min && currentPoints <= r.max); return idx < RANKS.length - 1 ? RANKS[idx + 1].min : 'MAX'; }
function calculateLevel(xp) { return Math.floor(0.1 * Math.sqrt(xp)) + 1; }

// ================= CONTEXT WRAPPER =================
class GameContext {
    constructor(source) {
        // Detect ALL interaction types: slash, button, select menu, modal
        this.isInteraction = !!source.isChatInputCommand || !!source.isMessageComponent || !!source.isButton || !!source.isUserContextMenuCommand || !!source.isMessageContextMenuCommand;
        this.source = source;
        this.user = this.isInteraction ? source.user : source.author;
        this.member = source.member;
        this.guild = source.guild;
        this.channel = source.channel;
        this.client = source.client;
    }
    async reply(options) {
        if (this.isInteraction) {
            if (this.source.deferred) return this.source.editReply(options);
            if (this.source.replied) return this.source.followUp(options);
            return this.source.reply({ ...options, fetchReply: true });
        }
        return this.source.reply(options);
    }
    async defer() {
        if (this.isInteraction && !this.source.deferred && !this.source.replied) return this.source.deferReply();
    }
    async update(options) {
        if (this.isInteraction) return this.source.update(options);
        return null;
    }
}

// ================= DB SETUP =================
function setupGameDB(database) {
    try {
        database.prepare(`CREATE TABLE IF NOT EXISTS game_scores (
            user_id TEXT NOT NULL, guild_id TEXT NOT NULL, username TEXT,
            games_played INTEGER DEFAULT 0, games_won INTEGER DEFAULT 0, total_winnings INTEGER DEFAULT 0,
            codm_played INTEGER DEFAULT 0, slots_played INTEGER DEFAULT 0, ttt_played INTEGER DEFAULT 0,
            bj_played INTEGER DEFAULT 0, roulette_played INTEGER DEFAULT 0, trivia_played INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, guild_id)
        )`).run();
        console.log('\x1b[32m[GAME]\x1b[0m Game scores table initialized');
    } catch (e) { console.error('\x1b[31m[GAME DB]\x1b[0m', e.message); }
}

function deductBet(db, client, userId, guildId, bet, userData) {
    const newBal = Math.max(0, (userData.credits || 0) - bet);
    db.prepare("UPDATE users SET credits = ? WHERE id = ? AND guild_id = ?").run(newBal, userId, guildId);
    if (client.queueUserUpdate) client.queueUserUpdate(userId, guildId, { ...userData, credits: newBal });
    if (client.userDataCache) client.userDataCache.delete(`${userId}:${guildId}`);
    return newBal;
}

function updateGameStats(db, client, userId, guildId, won, winnings, xpGain, ctx, t, lang, gameType) {
    let userData = client.getUserData ? client.getUserData(userId, guildId) : db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
    if (!userData) {
        db.prepare("INSERT INTO users (id, guild_id, username, xp, level, credits, streak_days, last_daily, total_dailies, highest_streak, games_played, games_won, total_winnings) VALUES (?, ?, ?, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0)").run(userId, guildId, ctx.user.username);
        userData = { games_played: 0, games_won: 0, total_winnings: 0, xp: 0, level: 1, credits: 0 };
    }
    const gamesPlayed = (userData.games_played || 0) + 1;
    const gamesWon = (userData.games_won || 0) + (won ? 1 : 0);
    const totalWinnings = (userData.total_winnings || 0) + (winnings > 0 ? winnings : 0);
    const newXP = (userData.xp || 0) + xpGain;
    const newLevel = calculateLevel(newXP);
    const newCredits = (userData.credits || 0) + winnings;

    db.prepare("UPDATE users SET games_played = ?, games_won = ?, total_winnings = ?, xp = ?, credits = ? WHERE id = ? AND guild_id = ?")
        .run(gamesPlayed, gamesWon, totalWinnings, newXP, newCredits, userId, guildId);

    if (client.queueUserUpdate) client.queueUserUpdate(userId, guildId, { ...userData, games_played: gamesPlayed, games_won: gamesWon, total_winnings: totalWinnings, xp: newXP, credits: newCredits });
    if (client.userDataCache) client.userDataCache.delete(`${userId}:${guildId}`);

    if (newLevel > (userData.level || 1) && ctx.channel) {
        const lvlEmbed = new EmbedBuilder().setColor('#00fbff')
            .setAuthor({ name: `🎉 ${t.levelUp}`, iconURL: ctx.user.displayAvatarURL() })
            .setDescription(`## ${t.reachedLevel} **${newLevel}**!\n\`\`\`yaml\nXP: ${newXP.toLocaleString()}\n${t.gamesPlayed}: ${gamesPlayed}\n${t.gamesWon}: ${gamesWon}\`\`\``)
            .setFooter({ text: `NEURAL GAME CENTER • v${ctx.client.version || '2.0.0'}` }).setTimestamp();
        ctx.channel.send({ content: `<@${userId}>`, embeds: [lvlEmbed] }).catch(() => {});
    }
}

// ================= HUB BUILDER =================
function buildHub(client, lang, guildName) {
    const t = gameTranslations[lang];
    const embed = new EmbedBuilder().setColor('#00d4ff')
        .setAuthor({ name: t.hubTitle, iconURL: client.user.displayAvatarURL() })
        .setDescription(
            '```ansi\n\u001b[1;36m╔══════════════════════════════════════════╗\u001b[0m\n' +
            `\u001b[1;36m║\u001b[0m  \u001b[1;33m${t.hubDesc}\u001b[0m\u001b[1;36m║\u001b[0m\n` +
            '\u001b[1;36m╠══════════════════════════════════════════╣\u001b[0m\n' +
            `\u001b[1;36m║\u001b[0m  🔫 ${t.codm.padEnd(23)}\u001b[1;36m║\u001b[0m\n` +
            `\u001b[1;36m║\u001b[0m  🎰 ${t.slots.padEnd(23)}\u001b[1;36m║\u001b[0m\n` +
            `\u001b[1;36m║\u001b[0m  ⭕ ${t.tictactoe.padEnd(23)}\u001b[1;36m║\u001b[0m\n` +
            `\u001b[1;36m║\u001b[0m  🃏 ${t.blackjack.padEnd(23)}\u001b[1;36m║\u001b[0m\n` +
            `\u001b[1;36m║\u001b[0m  🎲 ${t.roulette.padEnd(23)}\u001b[1;36m║\u001b[0m\n` +
            `\u001b[1;36m║\u001b[0m  🧠 ${t.trivia.padEnd(23)}\u001b[1;36m║\u001b[0m\n` +
            '\u001b[1;36m╚══════════════════════════════════════════╝\u001b[0m\n```'
        )
        .setFooter({ text: `${t.footer} • ${guildName || 'NEURAL NODE'} • v${client.version || '2.0.0'}`, iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('game_play_codm').setLabel('CODM').setStyle(ButtonStyle.Primary).setEmoji('🔫'),
        new ButtonBuilder().setCustomId('game_play_slots').setLabel('SLOTS').setStyle(ButtonStyle.Primary).setEmoji('🎰'),
        new ButtonBuilder().setCustomId('game_play_tictactoe').setLabel('TIC TAC TOE').setStyle(ButtonStyle.Primary).setEmoji('⭕')
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('game_play_blackjack').setLabel('BLACKJACK').setStyle(ButtonStyle.Primary).setEmoji('🃏'),
        new ButtonBuilder().setCustomId('game_play_roulette').setLabel('ROULETTE').setStyle(ButtonStyle.Primary).setEmoji('🎲'),
        new ButtonBuilder().setCustomId('game_play_trivia').setLabel('TRIVIA').setStyle(ButtonStyle.Secondary).setEmoji('🧠')
    );

    return { embeds: [embed], components: [row1, row2] };
}

// ================= TRIVIA BRIDGE =================
async function bridgeToTrivia(interaction, client) {
    try {
                delete require.cache[require.resolve('./trivia.js')];
        const trivia = require('./trivia.js');
        return await trivia.execute(interaction, client);
    } catch (e) {
        console.error('[TRIVIA BRIDGE]', e.message);
        const serverLang = client.getServerSettings?.(interaction.guild?.id)?.language;
        const lang = serverLang === 'fr' ? 'fr' : serverLang === 'en' ? 'en' : (interaction.locale?.startsWith('fr') ? 'fr' : 'en');
        const t = gameTranslations[lang];
        const embed = new EmbedBuilder().setColor('#9b59b6')
            .setAuthor({ name: '🧠 NEURAL TRIVIA BRIDGE', iconURL: client.user.displayAvatarURL() })
            .setDescription(`⚡ ${t.triviaBridge || 'Use /trivia to play!'}`)
            .setFooter({ text: 'ARCHITECT CG-223 • Game Center' });
        return interaction.reply({ embeds: [embed], flags: 64 });
    }
}

// ================= CODM =================
async function playCODM(ctx, client, db, lang, guildId, userId, bet) {
    const t = gameTranslations[lang];
    let userData = client.getUserData ? client.getUserData(userId, guildId) : db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
    if (!userData) userData = { credits: 0 };
    if (userData.credits < bet) {
        const embed = new EmbedBuilder().setColor('#ff4757').setDescription(`${t.insufficientCredits} **${userData.credits.toLocaleString()} 🪙**`);
        return ctx.reply({ embeds: [embed], flags: 64 });
    }
    deductBet(db, client, userId, guildId, bet, userData);

    const won = Math.random() > 0.45;
    const kills = won ? Math.floor(Math.random() * 15) + 10 : Math.floor(Math.random() * 8) + 2;
    const deaths = won ? Math.floor(Math.random() * 5) + 1 : Math.floor(Math.random() * 10) + 5;
    const kd = (kills / Math.max(deaths, 1)).toFixed(2);
    const score = won ? Math.floor(Math.random() * 30) + 70 : Math.floor(Math.random() * 40) + 20;
    const winnings = won ? Math.floor(bet * (1 + (score / 100))) : 0;
    const isMVP = won && score > 85;

    const rankPoints = won ? Math.floor(score * 0.5) + 10 : Math.floor(score * 0.2);
    const currentRP = (userData.total_winnings || 0) + rankPoints;
    const rank = getRank(currentRP);
    const nextPoints = nextRankPoints(currentRP);

    const embed = new EmbedBuilder().setColor(won ? '#2ecc71' : '#e74c3c')
        .setAuthor({ name: `${won ? t.codmVictory : t.codmDefeat}`, iconURL: ctx.user.displayAvatarURL() })
        .setDescription(`\`\`\`yaml\n${t.codmScore}: ${score}\n${t.codmKills}: ${kills}\n${t.codmDeaths}: ${deaths}\n${t.codmKDRatio}: ${kd}${isMVP ? '\n🌟 MVP!' : ''}\n\`\`\``)
        .addFields(
            { name: `💰 ${won ? t.winnings : t.loss}`, value: `${won ? '+' : '-'}${Math.abs(won ? winnings : bet).toLocaleString()} 🪙`, inline: true },
            { name: `🏆 ${t.currentRank}`, value: `**${rank.name}**${nextPoints !== 'MAX' ? `\nNext: ${nextPoints.toLocaleString()} RP` : ''}`, inline: true }
        )
        .setFooter({ text: `${t.footer} • ${ctx.guild?.name?.toUpperCase() || 'NEURAL NODE'} • v${ctx.client.version || '2.0.0'}`, iconURL: ctx.guild?.iconURL() || ctx.client.user.displayAvatarURL() }).setTimestamp();
    await ctx.reply({ embeds: [embed] });
    updateGameStats(db, client, userId, guildId, won, winnings, 50, ctx, t, lang, 'codm');
}

// ================= SLOTS =================
async function playSlots(ctx, client, db, lang, guildId, userId, bet) {
    const t = gameTranslations[lang];
    let userData = client.getUserData ? client.getUserData(userId, guildId) : db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
    if (!userData) userData = { credits: 0 };
    if (userData.credits < bet) {
        const embed = new EmbedBuilder().setColor('#ff4757').setDescription(`${t.insufficientCredits} **${userData.credits.toLocaleString()} 🪙**`);
        return ctx.reply({ embeds: [embed], flags: 64 });
    }
    deductBet(db, client, userId, guildId, bet, userData);

    const symbols = ['🍎', '🍊', '🍋', '🍇', '💎', '7️⃣', '🎰'];
    const spin = () => symbols[Math.floor(Math.random() * symbols.length)];
    const line = [spin(), spin(), spin()];
    const allSame = line[0] === line[1] && line[1] === line[2];
    const twoMatch = line[0] === line[1] || line[1] === line[2] || line[0] === line[2];
    const isJackpot = allSame && line[0] === '💎';
    const won = allSame || twoMatch;
    const winnings = isJackpot ? bet * 10 : allSame ? bet * 5 : twoMatch ? bet * 2 : 0;

    const embed = new EmbedBuilder().setColor(won ? '#2ecc71' : '#e74c3c')
        .setAuthor({ name: `${won ? t.slotsWin : t.slotsLoss}`, iconURL: ctx.user.displayAvatarURL() })
        .setDescription(`\`\`\`\n[ ${line.join(' | ')} ]\n\`\`\`\n${isJackpot ? `## 💎 ${t.jackpot}` : ''}`)
        .addFields(
            { name: `💰 ${won ? t.winnings : t.loss}`, value: `${won ? '+' : '-'}${Math.abs(won ? winnings : bet).toLocaleString()} 🪙`, inline: true },
            { name: `💰 ${t.newBalance}`, value: `${(userData.credits - bet + winnings).toLocaleString()} 🪙`, inline: true }
        )
        .setFooter({ text: `${t.footer} • ${ctx.guild?.name?.toUpperCase() || 'NEURAL NODE'} • v${ctx.client.version || '2.0.0'}`, iconURL: ctx.guild?.iconURL() || ctx.client.user.displayAvatarURL() }).setTimestamp();
    await ctx.reply({ embeds: [embed] });
    updateGameStats(db, client, userId, guildId, won, winnings, 25, ctx, t, lang, 'slots');
}

// ================= TIC TAC TOE =================
async function playTicTacToe(ctx, client, db, lang, guildId, userId, bet, opponent) {
    const t = gameTranslations[lang];
    if (!opponent) {
        const embed = new EmbedBuilder().setColor('#ff4757').setDescription(`❌ ${t.usage(ctx.client.PREFIX || '.')}`);
        return ctx.reply({ embeds: [embed], flags: 64 });
    }
    if (opponent.id === userId) {
        const embed = new EmbedBuilder().setColor('#ff4757').setDescription(t.noSelfChallenge);
        return ctx.reply({ embeds: [embed], flags: 64 });
    }
    if (opponent.bot) {
        const embed = new EmbedBuilder().setColor('#ff4757').setDescription(t.cannotChallengeBot);
        return ctx.reply({ embeds: [embed], flags: 64 });
    }

    let userData = client.getUserData ? client.getUserData(userId, guildId) : db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
    if (!userData) userData = { credits: 0 };
    if (userData.credits < bet) {
        const embed = new EmbedBuilder().setColor('#ff4757').setDescription(`${t.insufficientCredits} **${userData.credits.toLocaleString()} 🪙**`);
        return ctx.reply({ embeds: [embed], flags: 64 });
    }
    deductBet(db, client, userId, guildId, bet, userData);

    const challengeEmbed = new EmbedBuilder().setColor('#9b59b6')
        .setAuthor({ name: `⭕ ${t.newTicTacToe}`, iconURL: ctx.client.user.displayAvatarURL() })
        .setDescription(t.challenge(ctx.user.username))
        .setFooter({ text: `${t.footer} • ${ctx.guild?.name?.toUpperCase() || 'NEURAL NODE'}`, iconURL: ctx.guild?.iconURL() || ctx.client.user.displayAvatarURL() }).setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ttt_accept').setLabel(t.accept).setStyle(ButtonStyle.Success).setEmoji('✅'),
        new ButtonBuilder().setCustomId('ttt_decline').setLabel(t.decline).setStyle(ButtonStyle.Danger).setEmoji('❌')
    );

    const sent = await ctx.reply({ content: `<@${opponent.id}>`, embeds: [challengeEmbed], components: [row] });

    try {
        const response = await sent.channel.awaitMessageComponent({
            filter: (i) => i.message.id === sent.id && i.user.id === opponent.id && ['ttt_accept', 'ttt_decline'].includes(i.customId),
            time: 30000
        });
        await response.deferUpdate().catch(() => {});

        if (response.customId === 'ttt_decline') {
            return sent.edit({ content: t.challengeDeclined, embeds: [], components: [] }).catch(() => {});
        }

        // Game starts
        let board = [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '];
        let currentPlayer = userId;
        const players = { [userId]: { symbol: 'X', name: ctx.user.username }, [opponent.id]: { symbol: 'O', name: opponent.username } };

        const checkWin = (b) => {
            const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
            for (const [a,b1,c] of wins) if (b[a] !== ' ' && b[a] === b[b1] && b[b1] === b[c]) return b[a];
            if (!b.includes(' ')) return 'draw';
            return null;
        };

        const renderBoard = () => `\`\`\`\n ${board[0]} │ ${board[1]} │ ${board[2]} \n───┼───┼───\n ${board[3]} │ ${board[4]} │ ${board[5]} \n───┼───┼───\n ${board[6]} │ ${board[7]} │ ${board[8]} \n\`\`\``;

        const makeButtons = (disabled = false) => {
            const rows = [];
            for (let r = 0; r < 3; r++) {
                const row = new ActionRowBuilder();
                for (let c = 0; c < 3; c++) {
                    const idx = r * 3 + c;
                    const val = board[idx];
                    row.addComponents(new ButtonBuilder()
                        .setCustomId(`ttt_${idx}`)
                        .setLabel(val === ' ' ? '\u200b' : val)
                        .setStyle(val === ' ' ? ButtonStyle.Secondary : (val === 'X' ? ButtonStyle.Primary : ButtonStyle.Danger))
                        .setDisabled(disabled || val !== ' '));
                }
                rows.push(row);
            }
            return rows;
        };

        await sent.edit({ content: t.challengeAccepted, embeds: [new EmbedBuilder().setColor('#9b59b6').setDescription(renderBoard()).setFooter({ text: `${players[currentPlayer].name}'s turn (${players[currentPlayer].symbol})` })], components: makeButtons() }).catch(() => {});

        while (true) {
            try {
                const move = await sent.channel.awaitMessageComponent({
                    filter: (i) => i.message.id === sent.id && i.user.id === currentPlayer && i.customId.startsWith('ttt_'),
                    time: 60000
                });
                const idx = parseInt(move.customId.split('_')[1]);
                if (board[idx] !== ' ') { await move.reply({ content: t.spotTaken, flags: 64 }).catch(() => {}); continue; }

                board[idx] = players[currentPlayer].symbol;
                await move.deferUpdate().catch(() => {});

                const result = checkWin(board);
                if (result) {
                    const won = result !== 'draw';
                    const winnerName = won ? players[currentPlayer].name : null;
                    const winnings = won ? bet * 2 : 0;

                    const embed = new EmbedBuilder().setColor(won ? '#2ecc71' : '#f1c40f')
                        .setAuthor({ name: won ? t.wonTicTacToe(winnerName) : t.draw, iconURL: ctx.user.displayAvatarURL() })
                        .setDescription(renderBoard());
                    if (won) embed.addFields({ name: `💰 ${t.winnings}`, value: `${winnings.toLocaleString()} 🪙`, inline: true });
                    await sent.edit({ content: null, embeds: [embed], components: makeButtons(true) }).catch(() => {});

                    updateGameStats(db, client, userId, guildId, won && currentPlayer === userId, won && currentPlayer === userId ? winnings : 0, won ? 75 : 25, ctx, t, lang, 'ttt');
                    if (won && currentPlayer !== userId) updateGameStats(db, client, opponent.id, guildId, true, winnings, 75, { ...ctx, user: opponent }, t, lang, 'ttt');
                    break;
                }

                currentPlayer = currentPlayer === userId ? opponent.id : userId;
                await sent.edit({ embeds: [new EmbedBuilder().setColor('#9b59b6').setDescription(renderBoard()).setFooter({ text: `${players[currentPlayer].name}'s turn (${players[currentPlayer].symbol})` })], components: makeButtons() }).catch(() => {});

            } catch (e) {
                await sent.edit({ content: t.timeout, embeds: [], components: makeButtons(true) }).catch(() => {});
                break;
            }
        }
    } catch (e) { await sent.edit({ content: t.challengeDeclined, embeds: [], components: [] }).catch(() => {}); }
}

// ================= BLACKJACK =================
async function playBlackjack(ctx, client, db, lang, guildId, userId, bet) {
    const t = gameTranslations[lang];
    let userData = client.getUserData ? client.getUserData(userId, guildId) : db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
    if (!userData) userData = { credits: 0 };
    if (userData.credits < bet) {
        const embed = new EmbedBuilder().setColor('#ff4757').setDescription(`${t.insufficientCredits} **${userData.credits.toLocaleString()} 🪙**`);
        return ctx.reply({ embeds: [embed], flags: 64 });
    }
    deductBet(db, client, userId, guildId, bet, userData);

    const cards = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const suits = ['♠', '♥', '♦', '♣'];
    const drawCard = () => ({ card: cards[Math.floor(Math.random() * cards.length)], suit: suits[Math.floor(Math.random() * suits.length)] });
    const handValue = (hand) => {
        let val = 0, aces = 0;
        for (const c of hand) { if (c.card === 'A') aces++; else val += Math.min(10, parseInt(c.card) || 10); }
        for (let i = 0; i < aces; i++) val += (val + 11 <= 21) ? 11 : 1;
        return val;
    };
    const formatHand = (hand) => hand.map(c => `${c.card}${c.suit}`).join(' ');

    let playerHand = [drawCard(), drawCard()];
    let dealerHand = [drawCard(), drawCard()];

    const embed = new EmbedBuilder().setColor('#9b59b6')
        .setAuthor({ name: `🃏 BLACKJACK`, iconURL: ctx.user.displayAvatarURL() })
        .setDescription(`\`\`\`yaml\n${t.yourHand}: ${formatHand(playerHand)} (${handValue(playerHand)})\n${t.dealerHand}: ${dealerHand[0].card}${dealerHand[0].suit} ?\n\`\`\``)
        .setFooter({ text: `${t.footer} • ${ctx.guild?.name?.toUpperCase() || 'NEURAL NODE'} • v${ctx.client.version || '2.0.0'}`, iconURL: ctx.guild?.iconURL() || ctx.client.user.displayAvatarURL() }).setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bj_hit').setLabel(t.hit).setStyle(ButtonStyle.Primary).setEmoji('🃏'),
        new ButtonBuilder().setCustomId('bj_stand').setLabel(t.stand).setStyle(ButtonStyle.Secondary).setEmoji('✋')
    );

    const sent = await ctx.reply({ embeds: [embed], components: [row] });

    // Player turn
    let playerDone = false;
    while (!playerDone) {
        try {
            const move = await sent.channel.awaitMessageComponent({
                filter: (i) => i.message.id === sent.id && i.user.id === userId && ['bj_hit', 'bj_stand'].includes(i.customId),
                time: 60000
            });
            await move.deferUpdate().catch(() => {});

            if (move.customId === 'bj_hit') {
                playerHand.push(drawCard());
                if (handValue(playerHand) > 21) playerDone = true;
            } else playerDone = true;

            if (!playerDone || handValue(playerHand) <= 21) {
                await sent.edit({ embeds: [new EmbedBuilder().setColor('#9b59b6')
                    .setAuthor({ name: `🃏 BLACKJACK`, iconURL: ctx.user.displayAvatarURL() })
                    .setDescription(`\`\`\`yaml\n${t.yourHand}: ${formatHand(playerHand)} (${handValue(playerHand)})\n${t.dealerHand}: ${dealerHand[0].card}${dealerHand[0].suit} ?\n\`\`\``)
                    .setFooter({ text: `${t.footer} • ${ctx.guild?.name?.toUpperCase() || 'NEURAL NODE'} • v${ctx.client.version || '2.0.0'}`, iconURL: ctx.guild?.iconURL() || ctx.client.user.displayAvatarURL() }).setTimestamp()],
                    components: playerDone ? [] : [row]
                }).catch(() => {});
            }
        } catch (e) { playerDone = true; }
    }

    // Dealer turn
    while (handValue(dealerHand) < 17) dealerHand.push(drawCard());

    const pVal = handValue(playerHand);
    const dVal = handValue(dealerHand);
    const playerBust = pVal > 21;
    const dealerBust = dVal > 21;
    const blackjack = pVal === 21 && playerHand.length === 2;
    const won = blackjack || (!playerBust && (dealerBust || pVal > dVal));
    const draw = pVal === dVal && !playerBust && !dealerBust;
    const winnings = blackjack ? Math.floor(bet * 2.5) : won ? bet * 2 : draw ? bet : 0;

    const resultEmbed = new EmbedBuilder().setColor(won ? '#2ecc71' : draw ? '#f1c40f' : '#e74c3c')
        .setAuthor({ name: `${blackjack ? t.blackjackWin : won ? t.youWon : draw ? t.draw : t.youLost}`, iconURL: ctx.user.displayAvatarURL() })
        .setDescription(`\`\`\`yaml\n${t.yourHand}: ${formatHand(playerHand)} (${pVal})\n${t.dealerHand}: ${formatHand(dealerHand)} (${dVal})\n\`\`\``)
        .addFields(
            { name: `💰 ${t.bet}`, value: `${bet.toLocaleString()} 🪙`, inline: true },
            { name: `💰 ${won ? t.winnings : t.loss}`, value: `${won ? '+' : '-'}${Math.abs(won ? winnings : bet).toLocaleString()} 🪙`, inline: true }
        )
        .setFooter({ text: `${t.footer} • ${ctx.guild?.name?.toUpperCase() || 'NEURAL NODE'} • v${ctx.client.version || '2.0.0'}`, iconURL: ctx.guild?.iconURL() || ctx.client.user.displayAvatarURL() }).setTimestamp();

    await sent.edit({ embeds: [resultEmbed], components: [] }).catch(() => {});
    updateGameStats(db, client, userId, guildId, won, winnings, won ? 100 : 50, ctx, t, lang, 'blackjack');
}

// ================= ROULETTE =================
async function playRoulette(ctx, client, db, lang, guildId, userId, bet) {
    const t = gameTranslations[lang];
    let userData = client.getUserData ? client.getUserData(userId, guildId) : db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
    if (!userData) userData = { credits: 0 };
    if (userData.credits < bet) {
        const embed = new EmbedBuilder().setColor('#ff4757').setDescription(`${t.insufficientCredits} **${userData.credits.toLocaleString()} 🪙**`);
        return ctx.reply({ embeds: [embed], flags: 64 });
    }
    deductBet(db, client, userId, guildId, bet, userData);

    const numbers = Array.from({ length: 37 }, (_, i) => i);
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    const isRed = (n) => redNumbers.includes(n);
    const isBlack = (n) => n !== 0 && !isRed(n);

    const embed = new EmbedBuilder().setColor('#e74c3c')
        .setAuthor({ name: `🎲 ROULETTE`, iconURL: ctx.user.displayAvatarURL() })
        .setDescription(`## 💰 ${t.bet}: ${bet.toLocaleString()} 🪙\n${t.chooseNumber} (0-36):`)
        .setFooter({ text: `${t.footer} • ${ctx.guild?.name?.toUpperCase() || 'NEURAL NODE'} • v${ctx.client.version || '2.0.0'}`, iconURL: ctx.guild?.iconURL() || ctx.client.user.displayAvatarURL() }).setTimestamp();

    const rows = [];
    for (let r = 0; r < 4; r++) {
        const row = new ActionRowBuilder();
        for (let c = 0; c < 10; c++) {
            const num = r * 10 + c;
            if (num > 36) break;
            const style = num === 0 ? ButtonStyle.Success : isRed(num) ? ButtonStyle.Danger : ButtonStyle.Secondary;
            row.addComponents(new ButtonBuilder().setCustomId(`rl_${num}`).setLabel(num.toString()).setStyle(style));
        }
        rows.push(row);
    }

    const sent = await ctx.reply({ embeds: [embed], components: rows });

    try {
        const response = await sent.channel.awaitMessageComponent({
            filter: (i) => i.message.id === sent.id && i.user.id === userId && i.customId.startsWith('rl_'),
            time: 30000
        });
        const chosenNum = parseInt(response.customId.split('_')[1]);
        await response.deferUpdate().catch(() => {});

        const result = numbers[Math.floor(Math.random() * numbers.length)];
        const resultRed = isRed(result);
        const resultColor = result === 0 ? t.rouletteGreen : resultRed ? t.rouletteRed : t.rouletteBlack;
        const won = result === chosenNum;
        const winnings = won ? bet * 35 : 0;

        const resultEmbed = new EmbedBuilder().setColor(won ? '#2ecc71' : '#e74c3c')
            .setAuthor({ name: `${won ? t.youWon : t.youLost}`, iconURL: ctx.user.displayAvatarURL() })
            .setDescription(`## ${t.rouletteResult(result, resultColor)}\n\n**${t.yourHand || 'Your Number'}:** ${chosenNum}\n**${t.result}:** ${result}`)
            .addFields(
                { name: `💰 ${t.bet}`, value: `${bet.toLocaleString()} 🪙`, inline: true },
                { name: `💰 ${won ? t.winnings : t.loss}`, value: `${won ? '+' : '-'}${Math.abs(won ? winnings : bet).toLocaleString()} 🪙`, inline: true }
            )
            .setFooter({ text: `${t.footer} • ${ctx.guild?.name?.toUpperCase() || 'NEURAL NODE'} • v${ctx.client.version || '2.0.0'}`, iconURL: ctx.guild?.iconURL() || ctx.client.user.displayAvatarURL() }).setTimestamp();

        await sent.edit({ embeds: [resultEmbed], components: [] }).catch(() => {});
        updateGameStats(db, client, userId, guildId, won, winnings, won ? 150 : 25, ctx, t, lang, 'roulette');

    } catch (e) { await sent.edit({ content: t.timeout, embeds: [], components: [] }).catch(() => {}); }
}

// ================= SLASH COMMAND =================
const slashCommand = new SlashCommandBuilder()
    .setName('game').setDescription('🎮 Neural Game Center — Play CODM, Slots, TTT, Blackjack, Roulette, and Trivia')
    .addSubcommand(sub => sub.setName('menu').setDescription('🎮 Open the Neural Game Center hub'))
    .addSubcommand(sub => sub.setName('codm').setDescription('🔫 Simulate a CODM ranked match').addIntegerOption(o => o.setName('bet').setDescription('Bet amount').setRequired(false).setMinValue(10).setMaxValue(10000)))
    .addSubcommand(sub => sub.setName('slots').setDescription('🎰 Spin the neural slots').addIntegerOption(o => o.setName('bet').setDescription('Bet amount').setRequired(false).setMinValue(10).setMaxValue(10000)))
    .addSubcommand(sub => sub.setName('tictactoe').setDescription('⭕ Challenge someone to Tic Tac Toe').addUserOption(o => o.setName('opponent').setDescription('Who to challenge').setRequired(true)).addIntegerOption(o => o.setName('bet').setDescription('Bet amount').setRequired(false).setMinValue(10).setMaxValue(10000)))
    .addSubcommand(sub => sub.setName('blackjack').setDescription('🃏 Beat the dealer').addIntegerOption(o => o.setName('bet').setDescription('Bet amount').setRequired(false).setMinValue(10).setMaxValue(10000)))
    .addSubcommand(sub => sub.setName('roulette').setDescription('🎲 Bet on the wheel').addIntegerOption(o => o.setName('bet').setDescription('Bet amount').setRequired(false).setMinValue(10).setMaxValue(10000)))
    .addSubcommand(sub => sub.setName('trivia').setDescription('🧠 Bridge to Neural Trivia'));

// ================= EXECUTE =================
async function executeSlashCommand(interaction, client) {
    const db = client.db;
    if (!db) return interaction.reply({ content: '❌ Database unavailable.', flags: 64 });
    setupGameDB(db);

    const sub = interaction.options.getSubcommand();
    const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
    const guildId = interaction.guildId || 'DM';
    const userId = interaction.user.id;
    const ctx = new GameContext(interaction);

        if (sub === 'menu') {
        const hub = buildHub(client, lang, interaction.guild?.name);
        return interaction.reply({ embeds: hub.embeds, components: hub.components });
    }

    const bet = interaction.options.getInteger('bet') || 100;
    if (bet < 10) return interaction.reply({ content: gameTranslations[lang].invalidBet + '\n*' + gameTranslations[lang].minBet + '*', flags: 64 });
    if (bet > 10000) return interaction.reply({ content: gameTranslations[lang].invalidBet + '\n*' + gameTranslations[lang].maxBet + '*', flags: 64 });

    if (sub === 'codm') return playCODM(ctx, client, db, lang, guildId, userId, bet);
    if (sub === 'slots') return playSlots(ctx, client, db, lang, guildId, userId, bet);
    if (sub === 'tictactoe') {
        const opponent = interaction.options.getUser('opponent');
        return playTicTacToe(ctx, client, db, lang, guildId, userId, bet, opponent);
    }
    if (sub === 'blackjack') return playBlackjack(ctx, client, db, lang, guildId, userId, bet);
    if (sub === 'roulette') return playRoulette(ctx, client, db, lang, guildId, userId, bet);
    if (sub === 'trivia') return bridgeToTrivia(interaction, client);
}

// ================= PREFIX FALLBACK =================
async function run(client, message, args, db, serverSettings, usedCommand) {
    const lang = client.detectLanguage ? client.detectLanguage(usedCommand, message.guild?.id) : 'en';
    const t = gameTranslations[lang];
    const guildId = message.guild?.id || 'DM';
    const userId = message.author.id;
    const prefix = serverSettings?.prefix || '.';
    const ctx = new GameContext(message);

    // Route direct aliases
    const cmd = usedCommand?.toLowerCase() || '';
    const directMap = { codm: 'codm', slots: 'slots', slot: 'slots', tictactoe: 'tictactoe', ttt: 'tictactoe', morpion: 'tictactoe', blackjack: 'blackjack', bj: 'blackjack', roulette: 'roulette' };
    const directGame = directMap[cmd];

    if (directGame) {
        const bet = parseInt(args[0]) || 100;
        if (bet < 10) return message.reply(`${t.invalidBet}\n*${t.minBet}*`).catch(() => {});
        if (bet > 10000) return message.reply(`${t.invalidBet}\n*${t.maxBet}*`).catch(() => {});
        if (directGame === 'codm') return playCODM(ctx, client, db, lang, guildId, userId, bet);
        if (directGame === 'slots') return playSlots(ctx, client, db, lang, guildId, userId, bet);
        if (directGame === 'tictactoe') {
            const opponent = message.mentions.users.first();
            return playTicTacToe(ctx, client, db, lang, guildId, userId, bet, opponent);
        }
        if (directGame === 'blackjack') return playBlackjack(ctx, client, db, lang, guildId, userId, bet);
        if (directGame === 'roulette') return playRoulette(ctx, client, db, lang, guildId, userId, bet);
    }

    // Default: show hub redirect
    const embed = new EmbedBuilder().setColor('#00d4ff')
        .setAuthor({ name: t.hubTitle, iconURL: client.user.displayAvatarURL() })
        .setDescription(`⚡ **${lang === 'fr' ? 'Le centre de jeux est disponible en slash.' : 'The game center is available via slash.'}**\n\`\`\`\n/game menu\n/game codm\n/game slots\n/game tictactoe @user\n/game blackjack\n/game roulette\n/game trivia\n\`\`\``)
        .setFooter({ text: 'ARCHITECT CG-223 • Game Center' });
    return message.reply({ embeds: [embed] }).catch(() => {});
}

// ================= BUTTON HANDLER =================
async function handleComponent(interaction, client) {
    if (!interaction.customId.startsWith('game_')) return false;
    const db = client.db;
    if (!db) return interaction.reply({ content: '❌ Database unavailable.', flags: 64 });

    const parts = interaction.customId.split('_');
    const action = parts[1];
    const game = parts[2];

    if (action !== 'play') return false;

    const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
    const guildId = interaction.guildId || 'DM';
    const userId = interaction.user.id;
    const bet = 100;

    // Trivia has its own reply flow — don't defer
    if (game === 'trivia') return bridgeToTrivia(interaction, client);

    // Tic-tac-toe needs an opponent — quick reply
    if (game === 'tictactoe') {
        const embed = new EmbedBuilder().setColor('#ff4757').setDescription('❌ Use `/game tictactoe @user` to challenge someone!');
        return interaction.reply({ embeds: [embed], flags: 64 });
    }

    // CRITICAL: Defer immediately so DB lookups + game logic don't expire the token
    await interaction.deferReply();

    const ctx = new GameContext(interaction);

    if (game === 'codm') return playCODM(ctx, client, db, lang, guildId, userId, bet);
    if (game === 'slots') return playSlots(ctx, client, db, lang, guildId, userId, bet);
    if (game === 'blackjack') return playBlackjack(ctx, client, db, lang, guildId, userId, bet);
    if (game === 'roulette') return playRoulette(ctx, client, db, lang, guildId, userId, bet);
    return false;
}

// ================= EXPORTS =================
module.exports = {
    name: 'game',
    aliases: ['jeu', 'jouer', 'codm', 'slots', 'slot', 'tictactoe', 'ttt', 'morpion', 'blackjack', 'bj', 'roulette'],
    description: '🎮 Neural Game Center — CODM, Slots, Tic Tac Toe, Blackjack, Roulette + Trivia Bridge',
    category: 'GAMING',
    usage: '/game <subcommand>',
    cooldown: 3000,
    data: slashCommand,
    execute: executeSlashCommand,
    run,
    handleComponent,
    setupGameDB
};
