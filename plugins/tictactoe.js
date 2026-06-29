const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

// ================= UNIFIED LEVEL CALCULATION =================
function calculateLevel(xp) {
    return Math.floor(0.1 * Math.sqrt(xp)) + 1;
}

// ================= AGENT RANKS =================
const AGENT_RANKS = [
    { minLevel: 1, maxLevel: 5, title: { fr: "RECRUE NEURALE", en: "NEURAL RECRUIT" }, color: "#2ecc71", emoji: "🌱" },
    { minLevel: 6, maxLevel: 15, title: { fr: "AGENT DE TERRAIN", en: "FIELD AGENT" }, color: "#3498db", emoji: "🔹" },
    { minLevel: 16, maxLevel: 30, title: { fr: "SPÉCIALISTE CYBER", en: "CYBER SPECIALIST" }, color: "#9b59b6", emoji: "💠" },
    { minLevel: 31, maxLevel: 50, title: { fr: "COMMANDANT BKO", en: "BKO COMMANDER" }, color: "#e67e22", emoji: "⚜️" },
    { minLevel: 51, maxLevel: Infinity, title: { fr: "ARCHITECTE SYSTÈME", en: "SYSTEM ARCHITECT" }, color: "#e74c3c", emoji: "👑" }
];

function getRank(level) {
    return AGENT_RANKS.find(r => level >= r.minLevel && level <= r.maxLevel) || AGENT_RANKS[AGENT_RANKS.length - 1];
}

function createProgressBar(percentage, length = 12) {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty));
}

// ================= BILINGUAL TRANSLATIONS =================
const tttTranslations = {
    en: {
        title: '⚔️ NEURAL TIC-TAC-TOE',
        vs: 'vs',
        turn: '🎮 Current Turn',
        win: '🏆 VICTORY!',
        loss: '💔 DEFEAT!',
        tie: '🤝 DRAW!',
        tieDesc: 'The match ended in a tactical stalemate.',
        winDesc: (winner) => `**${winner}** has claimed victory in the neural arena!`,
        lossDesc: (loser) => `**${loser}** has been defeated. Better luck next time!`,
        challenge: (challenger, opponent) => `⚔️ **${challenger}** (❌) challenges **${opponent}** (⭕) to a duel!`,
        invalidTarget: '⚠️ **Invalid Target.** Mention a friend to challenge! (Ex: `.ttt @User`)',
        alreadyPlaying: '⚠️ This player is already in an active game!',
        notYourTurn: '🚫 It is not your turn!',
        gameTimeout: '⏰ **Game Timeout.** The Architect has closed the match.',
        reward: '💰 Reward',
        xpGain: '📈 XP Gain',
        creditsGain: '💎 Credits',
        winnerStats: '🏆 Winner Stats',
        gamesPlayed: 'Games Played',
        winRate: 'Win Rate',
        footer: 'Neural Arena • Challenge your friends!',
        betInfo: '💰 **Entry Fee:** 50 🪙 | **Winner Takes:** 100 🪙',
        insufficientCredits: '❌ **Insufficient credits!** You need 50 🪙 to play. Use `.daily` to claim.',
        opponentInsufficientCredits: (name) => `❌ **${name}** does not have enough credits (50 🪙 required)!`,
        levelUp: '🎉 AGENT PROMOTION!',
        levelUpDesc: (username, level, rank) => `**${username}** reached **Level ${level}**!\n${rank.emoji} **${rank.title.en}**`,
        waiting: 'Waiting for players...',
        gameActive: 'Game in progress',
        refund: '💰 Refund',
        refundDesc: 'Entry fee returned to both players.',
        playerStats: '📊 PLAYER STATS',
        credits: 'Credits',
        level: 'Level',
        clickToPlay: 'Click a button to make your move!',
        cellTaken: '⚠️ This cell is already taken!'
    },
    fr: {
        title: '⚔️ TIC-TAC-TOE NEURAL',
        vs: 'contre',
        turn: '🎮 Tour Actuel',
        win: '🏆 VICTOIRE!',
        loss: '💔 DÉFAITE!',
        tie: '🤝 ÉGALITÉ!',
        tieDesc: 'Le match s\'est terminé par une impasse tactique.',
        winDesc: (winner) => `**${winner}** a remporté la victoire dans l\'arène neurale!`,
        lossDesc: (loser) => `**${loser}** a été vaincu. Meilleure chance la prochaine fois!`,
        challenge: (challenger, opponent) => `⚔️ **${challenger}** (❌) défie **${opponent}** (⭕) en duel!`,
        invalidTarget: '⚠️ **Cible invalide.** Mentionnez un ami pour le défier! (Ex: `.ttt @User`)',
        alreadyPlaying: '⚠️ Ce joueur est déjà dans une partie active!',
        notYourTurn: '🚫 Ce n\'est pas votre tour!',
        gameTimeout: '⏰ **Temps écoulé.** L\'Architecte a fermé le match.',
        reward: '💰 Récompense',
        xpGain: '📈 Gain XP',
        creditsGain: '💎 Crédits',
        winnerStats: '🏆 Stats du Vainqueur',
        gamesPlayed: 'Parties Jouées',
        winRate: 'Taux de Victoire',
        footer: 'Arène Neurale • Défiez vos amis!',
        betInfo: '💰 **Frais d\'entrée:** 50 🪙 | **Le Gagnant Remporte:** 100 🪙',
        insufficientCredits: '❌ **Crédits insuffisants!** Vous avez besoin de 50 🪙. Utilisez `.daily`.',
        opponentInsufficientCredits: (name) => `❌ **${name}** n\'a pas assez de crédits (50 🪙 requis)!`,
        levelUp: '🎉 PROMOTION D\'AGENT!',
        levelUpDesc: (username, level, rank) => `**${username}** a atteint le **Niveau ${level}**!\n${rank.emoji} **${rank.title.fr}**`,
        waiting: 'En attente des joueurs...',
        gameActive: 'Partie en cours',
        refund: '💰 Remboursement',
        refundDesc: 'Frais d\'entrée retournés aux deux joueurs.',
        playerStats: '📊 STATS DES JOUEURS',
        credits: 'Crédits',
        level: 'Niveau',
        clickToPlay: 'Cliquez sur une case pour jouer!',
        cellTaken: '⚠️ Cette case est déjà prise!'
    }
};

// ================= ACTIVE GAMES TRACKING =================
const activeGames = new Map();

module.exports = {
    name: 'ttt',
    aliases: ['tictactoe', 'morpion', 'oxo', 'tic'],
    description: '⚔️ Challenge a friend to a game of Tic-Tac-Toe with rewards!',
    category: 'GAMING',
    usage: '.ttt @user',
    cooldown: 5000,
    examples: ['.ttt @friend'],

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, 'en')
            : 'en';
        
        const t = tttTranslations[lang];
        const version = client.version || '1.6.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        
        const entryFee = 50;
        const winnerReward = 100;
        
        const challenger = message.author;
        const opponent = message.mentions.users.first();
        
        // ================= VALIDATION =================
        if (!opponent || opponent.bot || opponent.id === challenger.id) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setDescription(t.invalidTarget)
                .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            return message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }
        
        const gameKey = `${challenger.id}_${opponent.id}`;
        const reverseKey = `${opponent.id}_${challenger.id}`;
        
        if (activeGames.has(gameKey) || activeGames.has(reverseKey)) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setDescription(t.alreadyPlaying)
                .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            return message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }
        
        // 🔥 RAM-FIRST CREDIT CHECK
        const challengerData = client.getUserData 
            ? client.getUserData(challenger.id) 
            : db.prepare("SELECT credits FROM users WHERE id = ?").get(challenger.id);
        
        const opponentData = client.getUserData 
            ? client.getUserData(opponent.id) 
            : db.prepare("SELECT credits FROM users WHERE id = ?").get(opponent.id);
        
        if (!challengerData || (challengerData.credits || 0) < entryFee) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setDescription(t.insufficientCredits)
                .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            return message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }
        
        if (!opponentData || (opponentData.credits || 0) < entryFee) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setDescription(t.opponentInsufficientCredits(opponent.username))
                .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            return message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }
        
        // 🔥 DEDUCT ENTRY FEES USING BATCH SYSTEM
        if (client.queueUserUpdate) {
            client.queueUserUpdate(challenger.id, {
                ...challengerData,
                credits: (challengerData.credits || 0) - entryFee,
                username: challenger.username
            });
            client.queueUserUpdate(opponent.id, {
                ...opponentData,
                credits: (opponentData.credits || 0) - entryFee,
                username: opponent.username
            });
            console.log(`[TTT] Batch queued: Fees deducted from ${challenger.tag} and ${opponent.tag}`);
        } else {
            db.prepare(`UPDATE users SET credits = credits - ? WHERE id = ?`).run(entryFee, challenger.id);
            db.prepare(`UPDATE users SET credits = credits - ? WHERE id = ?`).run(entryFee, opponent.id);
        }
        
        // ================= GAME STATE =================
        let board = Array(9).fill(null);
        let turn = challenger.id;
        let gameActive = true;
        activeGames.set(gameKey, { board, turn, gameActive, challenger, opponent, startTime: Date.now() });
        
        const challengerLevel = calculateLevel(challengerData?.xp || 0);
        const opponentLevel = calculateLevel(opponentData?.xp || 0);
        const challengerRank = getRank(challengerLevel);
        const opponentRank = getRank(opponentLevel);
        const challengerCredits = (challengerData?.credits || 0) - entryFee;
        const opponentCredits = (opponentData?.credits || 0) - entryFee;
        
        // ================= BOARD CREATION =================
        const createBoard = (gameActive) => {
            const rows = [];
            for (let i = 0; i < 3; i++) {
                const row = new ActionRowBuilder();
                for (let j = 0; j < 3; j++) {
                    const index = i * 3 + j;
                    let buttonStyle = ButtonStyle.Secondary;
                    let label = '▫️';
                    
                    if (board[index] === 'X') {
                        buttonStyle = ButtonStyle.Danger;
                        label = '❌';
                    } else if (board[index] === 'O') {
                        buttonStyle = ButtonStyle.Primary;
                        label = '⭕';
                    }
                    
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`ttt_${index}`)
                            .setLabel(label)
                            .setStyle(buttonStyle)
                            .setDisabled(!!board[index] || !gameActive)
                    );
                }
                rows.push(row);
            }
            return rows;
        };
        
        // ================= WIN CHECKER =================
        const checkWinner = () => {
            const wins = [[0,1,2], [3,4,5], [6,7,8], [0,3,6], [1,4,7], [2,5,8], [0,4,8], [2,4,6]];
            for (const [a, b, c] of wins) {
                if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
            }
            return board.includes(null) ? null : 'tie';
        };
        
        // ================= GAME EMBED =================
        const gameEmbed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setAuthor({ name: '⚔️ NEURAL TIC-TAC-TOE', iconURL: client.user.displayAvatarURL() })
            .setDescription(
                '```ansi\n' +
                '\u001b[1;35m\u25b8 MATCH    \u001b[0m' + challenger.username + ' vs ' + opponent.username + '\n' +
                '\u001b[1;35m\u25b8 ENTRY    \u001b[0m50 🪙 each · Winner takes 100 🪙\n' +
                '\u001b[1;33m\u25b8 TURN     \u001b[0m\u001b[1;37m❌ ' + challenger.username + '\u001b[0m goes first\n' +
                '```'
            )
            .addFields(
                { name: '❌ ' + challenger.username, value: challengerRank.emoji + ' ' + challengerRank.title[lang] + ' · Lv.' + challengerLevel, inline: true },
                { name: '⭕ ' + opponent.username, value: opponentRank.emoji + ' ' + opponentRank.title[lang] + ' · Lv.' + opponentLevel, inline: true }
            )
            .setFooter({ text: `${guildName} · NEURAL ARENA · BAMAKO_223 🇲🇱` })
            .setTimestamp();
        
        const msg = await message.reply({
            embeds: [gameEmbed],
            components: createBoard(true)
        }).catch(() => {});
        
        if (!msg) {
            activeGames.delete(gameKey);
            return;
        }
        
        // ================= 🔥 COLLECTOR CORRIGÉ =================
        const collector = msg.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 120000
        });
        
        collector.on('collect', async (i) => {
            if (!gameActive) return;
            
            if (i.user.id !== turn) {
                return i.reply({ content: t.notYourTurn, flags: 64 }).catch(() => {});
            }
            
            const index = parseInt(i.customId.split('_')[1]);
            if (board[index]) {
                return i.reply({ content: t.cellTaken, flags: 64 }).catch(() => {});
            }
            
            // 🛡️ LA LIGNE CRITIQUE
            await i.deferUpdate().catch(() => {});
            
            // Make move
            board[index] = turn === challenger.id ? 'X' : 'O';
            
            const result = checkWinner();
            
            if (result) {
                gameActive = false;
                activeGames.delete(gameKey);
                collector.stop();
                
                let winner = null, loser = null, winnerId = null, loserId = null;
                
                if (result === 'X') {
                    winner = challenger; loser = opponent;
                    winnerId = challenger.id; loserId = opponent.id;
                } else if (result === 'O') {
                    winner = opponent; loser = challenger;
                    winnerId = opponent.id; loserId = challenger.id;
                }
                
                let resultEmbed = new EmbedBuilder()
                    .setAuthor({ name: t.title, iconURL: client.user.displayAvatarURL() })
                    .setTimestamp();
                
                if (result === 'tie') {
                    if (client.queueUserUpdate) {
                        const cData = client.getUserData(challenger.id) || challengerData;
                        const oData = client.getUserData(opponent.id) || opponentData;
                        client.queueUserUpdate(challenger.id, { ...cData, credits: (cData.credits || 0) + entryFee });
                        client.queueUserUpdate(opponent.id, { ...oData, credits: (oData.credits || 0) + entryFee });
                    } else {
                        db.prepare(`UPDATE users SET credits = credits + ? WHERE id = ?`).run(entryFee, challenger.id);
                        db.prepare(`UPDATE users SET credits = credits + ? WHERE id = ?`).run(entryFee, opponent.id);
                    }
                    
                    resultEmbed
                    resultEmbed
                        .setColor('#FEE75C')
                        .setAuthor({ name: '🤝 TACTICAL STALEMATE', iconURL: client.user.displayAvatarURL() })
                        .setDescription(
                            '```ansi\n' +
                            '\u001b[1;33m\u25b8 RESULT   \u001b[0mDRAW — No winner\n' +
                            '\u001b[1;33m\u25b8 REFUND   \u001b[0m50 🪙 returned to each player\n' +
                            '\u001b[0;37m\u25b8 TIP      \u001b[0mChallenge again to settle the score!\n' +
                            '```'
                        );
                    const winnerData = client.getUserData(winnerId) || (winnerId === challenger.id ? challengerData : opponentData);
                    const loserData = client.getUserData(loserId) || (loserId === challenger.id ? challengerData : opponentData);
                    
                    if (client.queueUserUpdate) {
                        client.queueUserUpdate(winnerId, {
                            ...winnerData,
                            credits: (winnerData.credits || 0) + winnerReward,
                            xp: (winnerData.xp || 0) + 100,
                            games_played: (winnerData.games_played || 0) + 1,
                            games_won: (winnerData.games_won || 0) + 1,
                            username: winner.username
                        });
                        client.queueUserUpdate(loserId, {
                            ...loserData,
                            xp: (loserData.xp || 0) + 25,
                            games_played: (loserData.games_played || 0) + 1,
                            username: loser.username
                        });
                    } else {
                        db.prepare(`UPDATE users SET credits = credits + ?, xp = xp + 100, games_played = games_played + 1, games_won = games_won + 1 WHERE id = ?`).run(winnerReward, winnerId);
                        db.prepare(`UPDATE users SET xp = xp + 25, games_played = games_played + 1 WHERE id = ?`).run(loserId);
                    }
                    
                    const newWinnerLevel = calculateLevel((winnerData?.xp || 0) + 100);
                    const newWinnerRank = getRank(newWinnerLevel);
                    const winRate = ((winnerData?.games_won || 0) + 1) / ((winnerData?.games_played || 0) + 1) * 100;
// ================= ASSIGN DUELIST ROLE =================
if (message.guild) {
    try {
        const settings = client.getServerSettings ? client.getServerSettings(message.guild.id) : null;
        const duelistRoleId = settings?.duelistRoleId || process.env.DUELIST_ROLE_ID;
        if (duelistRoleId) {
            const member = await message.guild.members.fetch(winnerId).catch(() => null);
            if (member) {
                const role = message.guild.roles.cache.get(duelistRoleId);
                if (role && !member.roles.cache.has(duelistRoleId)) {
                    await member.roles.add(role, '⚔️ Neural Arena duelist').catch(() => {});
                }
            }
        }
    } catch (e) {}
}
                    resultEmbed
                    resultEmbed
                        .setColor('#57F287')
                        .setAuthor({ name: '🏆 NEURAL ARENA — VICTORY!', iconURL: client.user.displayAvatarURL() })
                        .setDescription(
                            '```ansi\n' +
                            '\u001b[1;32m\u25b8 WINNER   \u001b[0m\u001b[1;37m' + winner.username + '\u001b[0m\n' +
                            '\u001b[1;32m\u25b8 PRIZE    \u001b[0m+100 🪙 · +100 XP\n' +
                            '\u001b[1;31m\u25b8 LOSER    \u001b[0m' + loser.username + ' · +25 XP consolation\n' +
                            '\u001b[1;32m\u25b8 NEW RANK \u001b[0m' + newWinnerRank.emoji + ' ' + newWinnerRank.title[lang] + ' · Lv.' + newWinnerLevel + '\n' +
                            '\u001b[0;37m\u25b8 WIN RATE \u001b[0m' + winRate.toFixed(1) + '%\n' +
                            '```'
                        );
                }
                
                const finalRows = [];
                for (let i = 0; i < 3; i++) {
                    const row = new ActionRowBuilder();
                    for (let j = 0; j < 3; j++) {
                        const idx = i * 3 + j;
                        let label = '▫️', style = ButtonStyle.Secondary;
                        if (board[idx] === 'X') { label = '❌'; style = ButtonStyle.Danger; }
                        else if (board[idx] === 'O') { label = '⭕'; style = ButtonStyle.Primary; }
                        row.addComponents(new ButtonBuilder().setCustomId(`ttt_${idx}`).setLabel(label).setStyle(style).setDisabled(true));
                    }
                    finalRows.push(row);
                }
                
                return i.editReply({ embeds: [resultEmbed], components: finalRows }).catch(() => {});
            }
            
            // Switch turn
            turn = turn === challenger.id ? opponent.id : challenger.id;
            
            const updatedChallenger = client.getUserData(challenger.id) || challengerData;
            const updatedOpponent = client.getUserData(opponent.id) || opponentData;
            
            const updatedEmbed = new EmbedBuilder()
                .setColor('#9b59b6')
                .setAuthor({ name: '⚔️ NEURAL TIC-TAC-TOE', iconURL: client.user.displayAvatarURL() })
                .setDescription(
                    '```ansi\n' +
                    '\u001b[1;35m\u25b8 MATCH    \u001b[0m' + challenger.username + ' vs ' + opponent.username + '\n' +
                    '\u001b[1;33m\u25b8 TURN     \u001b[0m\u001b[1;37m' + (turn === challenger.id ? '❌ ' + challenger.username : '⭕ ' + opponent.username) + '\u001b[0m\n' +
                    '\u001b[0;37m\u25b8 PRIZE    \u001b[0m100 🪙 winner takes all\n' +
                    '```'
                )
                .addFields(
                    { name: '❌ ' + challenger.username, value: challengerRank.emoji + ' Lv.' + challengerLevel, inline: true },
                    { name: '⭕ ' + opponent.username, value: opponentRank.emoji + ' Lv.' + opponentLevel, inline: true }
                )
                .setFooter({ text: `${guildName} · NEURAL ARENA · BAMAKO_223 🇲🇱` })
                .setTimestamp();
            
            await i.editReply({ embeds: [updatedEmbed], components: createBoard(true) }).catch(() => {});
        });
        
        collector.on('end', async (collected, reason) => {
            if (gameActive && reason === 'time') {
                gameActive = false;
                activeGames.delete(gameKey);
                
                if (client.queueUserUpdate) {
                    const cData = client.getUserData(challenger.id) || challengerData;
                    const oData = client.getUserData(opponent.id) || opponentData;
                    client.queueUserUpdate(challenger.id, { ...cData, credits: (cData.credits || 0) + entryFee });
                    client.queueUserUpdate(opponent.id, { ...oData, credits: (oData.credits || 0) + entryFee });
                } else {
                    db.prepare(`UPDATE users SET credits = credits + ? WHERE id = ?`).run(entryFee, challenger.id);
                    db.prepare(`UPDATE users SET credits = credits + ? WHERE id = ?`).run(entryFee, opponent.id);
                }
                
                const timeoutEmbed = new EmbedBuilder()
                    .setColor('#ED4245')
                    .setAuthor({ name: '⏰ NEURAL ARENA — TIMEOUT', iconURL: client.user.displayAvatarURL() })
                    .setDescription(
                        '```ansi\n' +
                        '\u001b[1;31m\u25b8 RESULT   \u001b[0mGame expired — no winner\n' +
                        '\u001b[1;31m\u25b8 REFUND   \u001b[0m50 🪙 returned to each player\n' +
                        '\u001b[0;37m\u25b8 TIP      \u001b[0mRespond faster next time!\n' +
                        '```'
                    )
                    .setFooter({ text: `${guildName} · NEURAL ARENA · BAMAKO_223 🇲🇱` })
                    .setTimestamp();
                
                await msg.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
            }
        });
        
        console.log(`[TTT] ${challenger.tag} vs ${opponent.tag} started | Lang: ${lang}`);
    }
};