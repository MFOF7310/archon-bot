const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

// --- BILINGUAL TRANSLATIONS ---
const tttTranslations = {
    en: {
        title: '⚔️ NEURAL TIC-TAC-TOE',
        vs: 'vs',
        turn: 'Current Turn',
        win: '🏆 VICTORY!',
        loss: '💔 DEFEAT!',
        tie: '🤝 DRAW!',
        tieDesc: 'The match ended in a tactical stalemate.',
        winDesc: (winner) => `**${winner}** has claimed victory in the neural arena!`,
        lossDesc: (loser) => `**${loser}** has been defeated. Better luck next time!`,
        challenge: (challenger, opponent) => `⚔️ **${challenger}** (X) has challenged **${opponent}** (O) to a duel!`,
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
        insufficientCredits: '❌ **Insufficient credits!** You need 50 🪙 to play. Use `.daily` to claim your daily reward.',
        opponentInsufficientCredits: '❌ **${opponent}** does not have enough credits (50 🪙 required) to accept the challenge!',
        levelUp: '🎉 AGENT PROMOTION!',
        levelUpDesc: (username, level) => `Congratulations **${username}**! You've reached level **${level}**!`,
        waiting: 'Waiting for players...',
        gameActive: 'Game in progress'
    },
    fr: {
        title: '⚔️ TIC-TAC-TOE NEURAL',
        vs: 'contre',
        turn: 'Tour actuel',
        win: '🏆 VICTOIRE!',
        loss: '💔 DÉFAITE!',
        tie: '🤝 ÉGALITÉ!',
        tieDesc: 'Le match s\'est terminé par une impasse tactique.',
        winDesc: (winner) => `**${winner}** a remporté la victoire dans l\'arène neurale!`,
        lossDesc: (loser) => `**${loser}** a été vaincu. Meilleure chance la prochaine fois!`,
        challenge: (challenger, opponent) => `⚔️ **${challenger}** (X) a défié **${opponent}** (O) en duel!`,
        invalidTarget: '⚠️ **Cible invalide.** Mentionnez un ami pour le défier! (Ex: `.ttt @User`)',
        alreadyPlaying: '⚠️ Ce joueur est déjà dans une partie active!',
        notYourTurn: '🚫 Ce n\'est pas votre tour!',
        gameTimeout: '⏰ **Temps écoulé.** L\'Architecte a fermé le match.',
        reward: '💰 Récompense',
        xpGain: '📈 Gain XP',
        creditsGain: '💎 Crédits',
        winnerStats: '🏆 Statistiques du Vainqueur',
        gamesPlayed: 'Parties Jouées',
        winRate: 'Taux de Victoire',
        footer: 'Arène Neurale • Défiez vos amis!',
        betInfo: '💰 **Frais d\'entrée:** 50 🪙 | **Le Gagnant Remporte:** 100 🪙',
        insufficientCredits: '❌ **Crédits insuffisants!** Vous avez besoin de 50 🪙 pour jouer. Utilisez `.daily` pour réclamer votre récompense quotidienne.',
        opponentInsufficientCredits: '❌ **${opponent}** n\'a pas assez de crédits (50 🪙 requis) pour accepter le défi!',
        levelUp: '🎉 PROMOTION D\'AGENT!',
        levelUpDesc: (username, level) => `Félicitations **${username}**! Vous avez atteint le niveau **${level}**!`,
        waiting: 'En attente des joueurs...',
        gameActive: 'Partie en cours'
    }
};

// --- UNIFIED LEVEL CALCULATION (Matches rank.js & games.js) ---
function calculateLevel(xp) {
    return Math.floor(0.1 * Math.sqrt(xp)) + 1;
}

// --- UNIFIED RANK TITLES ---
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

// --- PROGRESS BAR FUNCTION ---
function createProgressBar(percentage, length = 15) {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty));
}

// --- UNIFIED LEVEL-UP EMBED ---
async function sendLevelUpEmbed(channel, username, oldLevel, newLevel, currentXP, lang, version) {
    const rank = getRank(newLevel);
    const nextLevelXP = Math.pow(newLevel / 0.1, 2);
    const prevLevelXP = Math.pow((newLevel - 1) / 0.1, 2);
    const xpInLevel = currentXP - prevLevelXP;
    const xpNeeded = nextLevelXP - prevLevelXP;
    const progressPercent = xpNeeded > 0 ? Math.min(100, Math.max(0, (xpInLevel / xpNeeded) * 100)) : 100;
    const progressBar = createProgressBar(progressPercent, 12);
    
    const levelUpEmbed = new EmbedBuilder()
        .setColor(rank.color)
        .setTitle(`🎊 ${lang === 'fr' ? 'PROMOTION D\'AGENT' : 'AGENT PROMOTION'}! 🎊`)
        .setDescription(
            `**${username}** ${lang === 'fr' ? 'vient d\'atteindre le niveau' : 'just reached level'} **${newLevel}**!\n\n` +
            `${rank.emoji} **${rank.title[lang]}**\n` +
            `\`${progressBar}\` ${progressPercent.toFixed(1)}%\n` +
            `└─ ${lang === 'fr' ? 'Prochain niveau' : 'Next level'}: ${Math.ceil(xpNeeded - xpInLevel).toLocaleString()} XP`
        )
        .setFooter({ text: `ARCHITECT CG-223 • v${version}` })
        .setTimestamp();
    
    await channel.send({ embeds: [levelUpEmbed] });
}

// --- ECONOMY SYNC: UPDATE GAME STATS (Consistent with games.js) ---
function updateGameStats(userId, won, winnings, channel, username, lang, db) {
    const oldUser = db.prepare("SELECT xp, credits FROM users WHERE id = ?").get(userId);
    const oldXp = oldUser?.xp || 0;
    const currentCredits = oldUser?.credits || 0;
    
    let actualWinnings = winnings;
    if (winnings < 0 && Math.abs(winnings) > currentCredits) {
        actualWinnings = -currentCredits;
    }
    
    // XP Gain consistent with other games (100 for win, 25 for loss)
    const xpGain = won ? 100 : 25;
    
    // Ensure columns exist (safe check)
    try {
        db.prepare(`ALTER TABLE users ADD COLUMN games_played INTEGER DEFAULT 0`).run();
        db.prepare(`ALTER TABLE users ADD COLUMN games_won INTEGER DEFAULT 0`).run();
        db.prepare(`ALTER TABLE users ADD COLUMN total_winnings INTEGER DEFAULT 0`).run();
        db.prepare(`ALTER TABLE users ADD COLUMN credits INTEGER DEFAULT 0`).run();
    } catch (e) {}
    
    // Update stats
    db.prepare(`
        UPDATE users SET 
            games_played = games_played + 1, 
            games_won = games_won + ${won ? 1 : 0}, 
            total_winnings = total_winnings + ?,
            credits = credits + ?,
            xp = xp + ? 
        WHERE id = ?
    `).run(actualWinnings, actualWinnings, xpGain, userId);
    
    // Check for level up
    const newUser = db.prepare("SELECT xp FROM users WHERE id = ?").get(userId);
    const oldLevel = calculateLevel(oldXp);
    const newLevel = calculateLevel(newUser?.xp || 0);
    
    if (newLevel > oldLevel) {
        sendLevelUpEmbed(channel, username, oldLevel, newLevel, newUser?.xp || 0, lang, '1.3.2');
    }
    
    return actualWinnings;
}

function hasEnoughCredits(userId, db) {
    const userData = db.prepare("SELECT credits FROM users WHERE id = ?").get(userId);
    const credits = userData?.credits || 0;
    return credits >= 50;
}

// --- ACTIVE GAMES TRACKING ---
const activeGames = new Map();

module.exports = {
    name: 'ttt',
    aliases: ['tictactoe', 'morpion', 'oxo'],
    description: '⚔️ Challenge a friend to a game of Tic-Tac-Toe with rewards!',
    category: 'GAMING',
    usage: '.ttt @user',
    cooldown: 5000,
    examples: ['.ttt @friend'],

    run: async (client, message, args, db) => {
        
        // --- INTELLIGENT LANGUAGE DETECTION ---
        let lang = 'en';
        const guildSettings = client.settings?.get(message.guild?.id);
        if (guildSettings?.language) {
            lang = guildSettings.language;
        } else {
            const frenchKeywords = ['fr', 'francais', 'français', 'french', 'morpion'];
            const content = message.content.toLowerCase();
            if (frenchKeywords.some(word => content.includes(word)) || message.guild?.preferredLocale === 'fr') {
                lang = 'fr';
            }
        }
        
        const t = tttTranslations[lang];
        const version = client.version || '1.3.2';
        const entryFee = 50;
        const winnerReward = 100;
        
        const challenger = message.author;
        const opponent = message.mentions.users.first();
        
        // --- VALIDATION ---
        if (!opponent || opponent.bot || opponent.id === challenger.id) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setDescription(t.invalidTarget)
                .setTimestamp();
            return message.reply({ embeds: [errorEmbed] });
        }
        
        // Check if either player is already in a game
        const gameKey = `${challenger.id}_${opponent.id}`;
        const reverseKey = `${opponent.id}_${challenger.id}`;
        
        if (activeGames.has(gameKey) || activeGames.has(reverseKey)) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setDescription(t.alreadyPlaying)
                .setTimestamp();
            return message.reply({ embeds: [errorEmbed] });
        }
        
        // Check credits
        if (!hasEnoughCredits(challenger.id, db)) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setDescription(t.insufficientCredits)
                .setTimestamp();
            return message.reply({ embeds: [errorEmbed] });
        }
        
        if (!hasEnoughCredits(opponent.id, db)) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setDescription(t.opponentInsufficientCredits.replace('${opponent}', opponent.username))
                .setTimestamp();
            return message.reply({ embeds: [errorEmbed] });
        }
        
        // Deduct entry fees from both players
        try {
            db.prepare(`UPDATE users SET credits = credits - ? WHERE id = ?`).run(entryFee, challenger.id);
            db.prepare(`UPDATE users SET credits = credits - ? WHERE id = ?`).run(entryFee, opponent.id);
            console.log(`[TTT] Fees deducted: ${challenger.tag} (-${entryFee}), ${opponent.tag} (-${entryFee})`);
        } catch (err) {
            console.error(`[TTT] Fee deduction error: ${err.message}`);
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setDescription('❌ An error occurred. Please try again.')
                .setTimestamp();
            return message.reply({ embeds: [errorEmbed] });
        }
        
        // --- GAME STATE ---
        let board = Array(9).fill(null);
        let turn = challenger.id; // X starts (Challenger)
        let gameActive = true;
        
        // Store in active games
        activeGames.set(gameKey, true);
        
        // Get user stats for embed
        const challengerStats = db.prepare("SELECT xp, credits, games_played, games_won FROM users WHERE id = ?").get(challenger.id);
        const opponentStats = db.prepare("SELECT xp, credits, games_played, games_won FROM users WHERE id = ?").get(opponent.id);
        
        const challengerLevel = calculateLevel(challengerStats?.xp || 0);
        const opponentLevel = calculateLevel(opponentStats?.xp || 0);
        const challengerRank = getRank(challengerLevel);
        const opponentRank = getRank(opponentLevel);
        
        // --- BOARD CREATION ---
        const createBoard = () => {
            const rows = [];
            for (let i = 0; i < 3; i++) {
                const row = new ActionRowBuilder();
                for (let j = 0; j < 3; j++) {
                    const index = i * 3 + j;
                    let buttonStyle = ButtonStyle.Secondary;
                    let label = '⬜';
                    
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
        
        // --- WIN CHECKER ---
        const checkWinner = () => {
            const wins = [[0,1,2], [3,4,5], [6,7,8], [0,3,6], [1,4,7], [2,5,8], [0,4,8], [2,4,6]];
            for (const [a, b, c] of wins) {
                if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
            }
            return board.includes(null) ? null : 'tie';
        };
        
        // --- GAME EMBED ---
        const gameEmbed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setAuthor({ name: t.title, iconURL: client.user.displayAvatarURL() })
            .setDescription(
                `\`\`\`prolog\n${t.challenge(challenger.username, opponent.username)}\n${t.betInfo}\`\`\``
            )
            .addFields(
                { name: '❌ X', value: `${challenger.username}\n${challengerRank.emoji} Lvl ${challengerLevel}`, inline: true },
                { name: '⭕ O', value: `${opponent.username}\n${opponentRank.emoji} Lvl ${opponentLevel}`, inline: true },
                { name: t.turn, value: `<@${turn}>`, inline: true }
            )
            .setFooter({ text: `${t.footer} • v${version}` })
            .setTimestamp();
        
        const msg = await message.reply({
            embeds: [gameEmbed],
            components: createBoard()
        });
        
        // --- COLLECTOR ---
        const collector = msg.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 120000 // 2 minutes
        });
        
        collector.on('collect', async (i) => {
            if (!gameActive) return;
            
            if (i.user.id !== turn) {
                return i.reply({ content: t.notYourTurn, ephemeral: true });
            }
            
            const index = parseInt(i.customId.split('_')[1]);
            if (board[index]) {
                return i.reply({ content: '⚠️ This cell is already taken!', ephemeral: true });
            }
            
            // Make move
            board[index] = turn === challenger.id ? 'X' : 'O';
            
            const result = checkWinner();
            
            if (result) {
                gameActive = false;
                activeGames.delete(gameKey);
                collector.stop();
                
                let winner = null;
                let loser = null;
                let winnerId = null;
                let loserId = null;
                
                if (result === 'X') {
                    winner = challenger;
                    loser = opponent;
                    winnerId = challenger.id;
                    loserId = opponent.id;
                } else if (result === 'O') {
                    winner = opponent;
                    loser = challenger;
                    winnerId = opponent.id;
                    loserId = challenger.id;
                }
                
                let resultEmbed = new EmbedBuilder();
                
                if (result === 'tie') {
                    // Refund both players on tie
                    db.prepare(`UPDATE users SET credits = credits + ? WHERE id = ?`).run(entryFee, challenger.id);
                    db.prepare(`UPDATE users SET credits = credits + ? WHERE id = ?`).run(entryFee, opponent.id);
                    
                    resultEmbed
                        .setColor('#FEE75C')
                        .setTitle(t.tie)
                        .setDescription(t.tieDesc)
                        .addFields(
                            { name: '💰 Result', value: 'Entry fees refunded.', inline: false }
                        );
                    
                    console.log(`[TTT] Tie game between ${challenger.tag} and ${opponent.tag} - fees refunded`);
                } else {
                    // Award winner
                    db.prepare(`UPDATE users SET credits = credits + ? WHERE id = ?`).run(winnerReward, winnerId);
                    
                    // Update game stats with consistent XP (100 for win, 25 for loss)
                    updateGameStats(winnerId, true, winnerReward, message.channel, winner.username, lang, db);
                    updateGameStats(loserId, false, -entryFee, message.channel, loser.username, lang, db);
                    
                    // Get winner stats for display
                    const winnerStats = db.prepare("SELECT games_played, games_won, xp FROM users WHERE id = ?").get(winnerId);
                    const winnerLevel = calculateLevel(winnerStats?.xp || 0);
                    const winnerRank = getRank(winnerLevel);
                    const winRate = winnerStats?.games_played > 0 
                        ? Math.round((winnerStats.games_won / winnerStats.games_played) * 100) 
                        : 0;
                    
                    resultEmbed
                        .setColor('#57F287')
                        .setTitle(t.win)
                        .setDescription(t.winDesc(winner.username))
                        .addFields(
                            { name: t.reward, value: `+${winnerReward} 🪙`, inline: true },
                            { name: t.xpGain, value: `+100 XP`, inline: true },
                            { name: t.creditsGain, value: `+${winnerReward} 🪙`, inline: true },
                            { name: `📈 ${lang === 'fr' ? 'Nouveau Niveau' : 'New Level'}`, value: `${winnerRank.emoji} Lvl ${winnerLevel}`, inline: true },
                            { name: t.winnerStats, value: `📊 ${t.gamesPlayed}: ${winnerStats?.games_played || 0}\n🏆 ${t.winRate}: ${winRate}%`, inline: false }
                        );
                    
                    console.log(`[TTT] ${winner.tag} defeated ${loser.tag} - Winner: +${winnerReward}🪙, +100 XP`);
                }
                
                resultEmbed
                    .setAuthor({ name: t.title, iconURL: client.user.displayAvatarURL() })
                    .setFooter({ text: `${t.footer} • v${version}` })
                    .setTimestamp();
                
                // Create final board (all disabled)
                const finalRows = [];
                for (let i = 0; i < 3; i++) {
                    const row = new ActionRowBuilder();
                    for (let j = 0; j < 3; j++) {
                        const idx = i * 3 + j;
                        let label = '⬜';
                        let style = ButtonStyle.Secondary;
                        
                        if (board[idx] === 'X') {
                            label = '❌';
                            style = ButtonStyle.Danger;
                        } else if (board[idx] === 'O') {
                            label = '⭕';
                            style = ButtonStyle.Primary;
                        }
                        
                        row.addComponents(
                            new ButtonBuilder()
                                .setCustomId(`ttt_${idx}`)
                                .setLabel(label)
                                .setStyle(style)
                                .setDisabled(true)
                        );
                    }
                    finalRows.push(row);
                }
                
                return i.update({ 
                    embeds: [resultEmbed], 
                    components: finalRows 
                });
            }
            
            // Switch turn
            turn = turn === challenger.id ? opponent.id : challenger.id;
            
            // Update embed
            const updatedEmbed = EmbedBuilder.from(gameEmbed)
                .spliceFields(2, 1, { name: t.turn, value: `<@${turn}>`, inline: true });
            
            await i.update({
                embeds: [updatedEmbed],
                components: createBoard()
            });
        });
        
        collector.on('end', (collected, reason) => {
            if (gameActive && reason === 'time') {
                gameActive = false;
                activeGames.delete(gameKey);
                
                // Refund both players on timeout
                try {
                    db.prepare(`UPDATE users SET credits = credits + ? WHERE id = ?`).run(entryFee, challenger.id);
                    db.prepare(`UPDATE users SET credits = credits + ? WHERE id = ?`).run(entryFee, opponent.id);
                    console.log(`[TTT] Game timeout between ${challenger.tag} and ${opponent.tag} - fees refunded`);
                } catch (err) {
                    console.error(`[TTT] Refund error: ${err.message}`);
                }
                
                const timeoutEmbed = new EmbedBuilder()
                    .setColor('#ED4245')
                    .setAuthor({ name: t.title, iconURL: client.user.displayAvatarURL() })
                    .setTitle('⏰ TIME EXPIRED')
                    .setDescription(t.gameTimeout)
                    .addFields(
                        { name: '💰 Refund', value: `${entryFee} 🪙 returned to both players.`, inline: false }
                    )
                    .setFooter({ text: `${t.footer} • v${version}` })
                    .setTimestamp();
                
                msg.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
            }
        });
        
        console.log(`[TTT] ${challenger.tag} vs ${opponent.tag} started a match | Lang: ${lang}`);
    }
};