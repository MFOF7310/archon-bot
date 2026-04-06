const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('better-sqlite3')('database.sqlite');

// ================= CONFIGURATION LEVELING =================
const RANKS = [
    { minLevel: 1, maxLevel: 5, title: { fr: "RECRUE NEURALE", en: "NEURAL RECRUIT" }, color: "#2ecc71", emoji: "🌱" },
    { minLevel: 6, maxLevel: 15, title: { fr: "AGENT DE TERRAIN", en: "FIELD AGENT" }, color: "#3498db", emoji: "🔹" },
    { minLevel: 16, maxLevel: 30, title: { fr: "SPÉCIALISTE CYBER", en: "CYBER SPECIALIST" }, color: "#9b59b6", emoji: "💠" },
    { minLevel: 31, maxLevel: 50, title: { fr: "COMMANDANT BKO", en: "BKO COMMANDER" }, color: "#e67e22", emoji: "⚜️" },
    { minLevel: 51, maxLevel: Infinity, title: { fr: "ARCHITECTE SYSTÈME", en: "SYSTEM ARCHITECT" }, color: "#e74c3c", emoji: "👑" }
];

function calculateLevel(xp) {
    return Math.floor(0.1 * Math.sqrt(xp)) + 1;
}

function getRank(level) {
    const rank = RANKS.find(r => level >= r.minLevel && level <= r.maxLevel);
    return rank || RANKS[RANKS.length - 1];
}

function calculateProgress(currentXp, currentLevel) {
    const xpForCurrentLevel = currentLevel > 1 ? Math.pow((currentLevel - 1) / 0.1, 2) : 0;
    const xpForNextLevel = Math.pow(currentLevel / 0.1, 2);
    const xpNeeded = xpForNextLevel - xpForCurrentLevel;
    const xpGained = currentXp - xpForCurrentLevel;
    const percentage = (xpGained / xpNeeded) * 100;
    return { percentage: Math.min(100, Math.max(0, percentage)), xpNeeded, xpGained };
}

function createProgressBar(percentage, length = 10) {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty) + ` ${percentage.toFixed(1)}%`;
}

// ================= DÉTECTION DE LANGUE AMÉLIORÉE =================
function detectLanguage(message, args) {
    const content = message.content.toLowerCase();
    
    // Check if the user used an English trigger/alias
    const englishTriggers = ['.play', '.arcade', '.game', '.minigame'];
    const englishKeywords = ['dice', 'coinflip', 'guess', 'slots', 'blackjack', 'rps', 'trivia', 'hangman', 'stats', 'rank', 'heads', 'tails'];

    // If starts with .play or contains 'dice', 'stats', etc -> switch to EN
    if (englishTriggers.some(t => content.startsWith(t))) return 'en';
    if (args.some(a => englishKeywords.includes(a.toLowerCase()))) return 'en';

    return 'fr'; // Default back to French
}

// ================= TEXTRES MULTILANGUES =================
const texts = {
    fr: {
        win: "🎉 VICTOIRE!",
        lose: "💔 DÉFAITE",
        tie: "🤝 ÉGALITÉ",
        winMsg: "VICTOIRE",
        loseMsg: "DÉFAITE",
        levelUp: "🎉 **PROMOTION D'AGENT!** 🎉",
        congratulations: "Félicitations",
        newRank: "vient d'être promu au grade de",
        xpGain: "XP gagnés",
        coins: "🪙",
        played: "Parties",
        won: "Victoires",
        winRate: "Taux",
        rank: "Rang",
        level: "Niveau",
        xp: "XP",
        progress: "Progression",
        nextLevel: "Prochain niveau",
        invalidGuess: "Prédiction invalide!",
        guessHint: "Devinez",
        attemptsLeft: "essai(s) restant(s)",
        timeOut: "Temps écoulé!",
        notYourMenu: "Ce menu ne vous est pas destiné.",
        gameStats: "STATISTIQUES DE L'AGENT",
        agentProfile: "DOSSIER D'AGENT",
        leaderboard: "CLASSEMENT",
        neuralArcade: "ARCADE NEURALE",
        mostWins: "PLUS DE VICTOIRES",
        richest: "AGENTS LES PLUS RICHES",
        bestRanks: "MEILLEURS RANGS",
        useCommand: "Utilisez `.game dice [1-6]` pour parier!",
        useCommandEn: "Use `.game dice [1-6]` to bet!",
        insufficientCredits: "❌ **Crédits insuffisants!** Réclamez votre `.daily` d'abord.",
        balance: "Solde actuel"
    },
    en: {
        win: "🎉 VICTORY!",
        lose: "💔 DEFEAT",
        tie: "🤝 TIE",
        winMsg: "VICTORY",
        loseMsg: "DEFEAT",
        levelUp: "🎉 **AGENT PROMOTION!** 🎉",
        congratulations: "Congratulations",
        newRank: "has been promoted to",
        xpGain: "XP earned",
        coins: "🪙",
        played: "Games",
        won: "Wins",
        winRate: "Rate",
        rank: "Rank",
        level: "Level",
        xp: "XP",
        progress: "Progress",
        nextLevel: "Next level",
        invalidGuess: "Invalid guess!",
        guessHint: "Guess",
        attemptsLeft: "attempt(s) left",
        timeOut: "Time's up!",
        notYourMenu: "This menu is not for you.",
        gameStats: "AGENT GAME STATISTICS",
        agentProfile: "AGENT DOSSIER",
        leaderboard: "LEADERBOARD",
        neuralArcade: "NEURAL ARCADE",
        mostWins: "MOST VICTORIES",
        richest: "RICHEST AGENTS",
        bestRanks: "BEST RANKS",
        useCommand: "Use `.game dice [1-6]` to bet!",
        useCommandEn: "Use `.game dice [1-6]` to bet!",
        insufficientCredits: "❌ **Insufficient credits!** Claim your `.daily` first.",
        balance: "Current balance"
    }
};

// ================= FONCTION DE LEVEL UP DYNAMIQUE =================
function checkAndAnnounceLevelUp(oldXp, newXp, userId, username, channel, lang) {
    const oldLevel = calculateLevel(oldXp);
    const newLevel = calculateLevel(newXp);
    
    if (newLevel > oldLevel) {
        const rank = getRank(newLevel);
        const t = texts[lang];
        const version = channel.client?.version || '1.3.2';
        
        const levelUpEmbed = new EmbedBuilder()
            .setColor(rank.color)
            .setAuthor({ name: t.neuralArcade, iconURL: channel.client.user.displayAvatarURL() })
            .setTitle(t.levelUp)
            .setDescription(`${t.congratulations} **${username}**! ${t.newRank} **${rank.emoji} ${rank.title[lang]}** (${t.level} ${newLevel})`)
            .addFields(
                { name: lang === 'fr' ? "📊 PROGRESSION" : "📊 PROGRESS", value: `${t.level} ${oldLevel} → ${t.level} ${newLevel}`, inline: true },
                { name: lang === 'fr' ? "🎯 RANG ATTEINT" : "🎯 RANK ATTAINED", value: `${rank.emoji} ${rank.title[lang]}`, inline: true }
            )
            .setFooter({ text: `${lang === 'fr' ? "Continuez à jouer pour monter en grade!" : "Keep playing to climb the ranks!"} • v${version}` })
            .setTimestamp();
        
        channel.send({ embeds: [levelUpEmbed] });
        return true;
    }
    return false;
}

// ================= ECONOMY SYNC: UPDATE STATS WITH CREDITS =================
function updateGameStats(userId, won, winnings, channel, username, lang) {
    const oldUser = db.prepare("SELECT xp, credits FROM users WHERE id = ?").get(userId);
    const oldXp = oldUser?.xp || 0;
    const currentCredits = oldUser?.credits || 0;
    
    // Anti-Bankruptcy Guard
    let actualWinnings = winnings;
    if (winnings < 0 && Math.abs(winnings) > currentCredits) {
        actualWinnings = -currentCredits;
    }
    
    const xpGain = won ? 100 : 25;
    
    // Ensure all columns exist
    try {
        db.prepare(`ALTER TABLE users ADD COLUMN games_played INTEGER DEFAULT 0`).run();
        db.prepare(`ALTER TABLE users ADD COLUMN games_won INTEGER DEFAULT 0`).run();
        db.prepare(`ALTER TABLE users ADD COLUMN total_winnings INTEGER DEFAULT 0`).run();
        db.prepare(`ALTER TABLE users ADD COLUMN credits INTEGER DEFAULT 0`).run();
    } catch (e) {}
    
    // SYNC WITH REAL ECONOMY COLUMNS
    db.prepare(`
        UPDATE users SET 
            games_played = games_played + 1, 
            games_won = games_won + ${won ? 1 : 0}, 
            total_winnings = total_winnings + ?,
            credits = credits + ?,
            xp = xp + ? 
        WHERE id = ?
    `).run(actualWinnings, actualWinnings, xpGain, userId);
    
    const newUser = db.prepare("SELECT xp FROM users WHERE id = ?").get(userId);
    checkAndAnnounceLevelUp(oldXp, newUser?.xp || 0, userId, username, channel, lang);
    
    return actualWinnings;
}

// ================= CHECK CREDITS BEFORE GAME =================
function hasEnoughCredits(userId, betAmount, lang) {
    const userData = db.prepare("SELECT credits FROM users WHERE id = ?").get(userId);
    const credits = userData?.credits || 0;
    
    if (credits < betAmount) {
        return false;
    }
    return true;
}

module.exports = {
    name: 'game',
    aliases: ['play', 'minigame', 'arcade', 'jeu'],
    description: 'Lancez les jeux neural arcade.',
    category: 'GAMING',
    run: async (client, message, args, userData) => {
        // Detect language based on command and arguments
        const lang = detectLanguage(message, args);
        const subCommand = args[0]?.toLowerCase();
        
        if (!subCommand || subCommand === 'menu') {
            return showGameMenu(client, message, userData, lang);
        }
        
        switch(subCommand) {
            case 'dice':
            case 'dé':
                return playDiceGame(client, message, userData, args[1], lang);
            case 'coinflip':
            case 'cf':
            case 'pileface':
                return playCoinFlip(client, message, userData, args[1], lang);
            case 'guess':
            case 'number':
            case 'devine':
                return playNumberGuess(client, message, userData, lang);
            case 'slots':
            case 'slot':
            case 'machine':
                return playSlots(client, message, userData, lang);
            case 'blackjack':
            case 'bj':
            case 'vingtetun':
                return playBlackjack(client, message, userData, lang);
            case 'rps':
            case 'rockpaperscissors':
            case 'pfc':
                return playRPS(client, message, userData, args[1], lang);
            case 'trivia':
            case 'quiz':
            case 'culture':
                return playTrivia(client, message, userData, lang);
            case 'hangman':
            case 'hm':
            case 'pendu':
                return playHangman(client, message, userData, lang);
            case 'leaderboard':
            case 'lb':
            case 'classement':
                return showGameLeaderboard(client, message, args[1], lang);
            case 'stats':
            case 'statistiques':
                return showGameStats(client, message, userData, lang);
            case 'rank':
            case 'rang':
            case 'profil':
                return showAgentProfile(client, message, userData, lang);
            default:
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff4757')
                    .setAuthor({ name: `ERREUR JEU: COMMANDE_INTROUVABLE`, iconURL: client.user.displayAvatarURL() })
                    .setDescription(`Jeu inconnu: \`${subCommand}\``)
                    .addFields({ name: '📜 JEUX DISPONIBLES', value: '`dice` • `coinflip` • `guess` • `slots` • `blackjack` • `rps` • `trivia` • `hangman` • `leaderboard` • `stats` • `rank`' })
                    .setFooter({ text: 'Utilisez .game menu pour voir les détails des jeux' });
                return message.reply({ embeds: [errorEmbed] });
        }
    }
};

// ================= GAME MENU =================
async function showGameMenu(client, message, oldData, lang) {
    const t = texts[lang];
    const version = client.version || '1.3.2';
    const userData = db.prepare("SELECT * FROM users WHERE id = ?").get(message.author.id);
    const xp = userData?.xp || 0;
    const level = calculateLevel(xp);
    const rank = getRank(level);
    const progress = calculateProgress(xp, level);
    const progressBar = createProgressBar(progress.percentage);
    const credits = userData?.credits || 0;
    
    const menuEmbed = new EmbedBuilder()
        .setColor(rank.color)
        .setAuthor({ name: `🎮 ${t.neuralArcade} • ${lang === 'fr' ? 'SÉLECTION DES JEUX' : 'GAME SELECTION'}`, iconURL: client.user.displayAvatarURL() })
        .setTitle(lang === 'fr' ? '═ SUITE DE JEUX ARCHITECT ═' : '═ ARCHITECT GAME SUITE ═')
        .setDescription(lang === 'fr' ? 'Sélectionnez un jeu pour tester vos réflexes.' : 'Select a game to test your reflexes.')
        .addFields(
            { name: '🎲 DÉ ROULETTE', value: '`.game dice [1-6]`\n**Gain:** 5x • Mise: 100 🪙', inline: true },
            { name: '🪙 PILE OU FACE', value: '`.game coinflip [pile/face]`\n**Gain:** 2x • Mise: 100 🪙', inline: true },
            { name: '🔢 DEVINE LE NOMBRE', value: '`.game guess`\n**Gain:** Jusqu\'à 200x • Mise: 100 🪙', inline: true },
            { name: '🎰 MACHINE À SOUS', value: '`.game slots`\n**Gain:** Jusqu\'à 500x • Mise: 100 🪙', inline: true },
            { name: '🃏 BLACKJACK', value: '`.game blackjack`\n**Gain:** 2x • Mise: 200 🪙', inline: true },
            { name: '✊ PFC DUEL', value: '`.game rps [pierre/feuille/ciseaux]`\n**Gain:** 2x • Mise: 100 🪙', inline: true },
            { name: '🧠 CULTURE', value: '`.game trivia`\n**Gain:** 500 🪙 • Mise: 100 🪙', inline: true },
            { name: '🪑 PENDU', value: '`.game hangman`\n**Gain:** 1000 🪙 • Mise: 200 🪙', inline: true },
            { name: `📊 ${t.gameStats}`, value: `\`\`\`yaml\n💰 ${t.balance}: ${credits.toLocaleString()} 🪙\n${rank.emoji} Grade: ${rank.title[lang]}\n${t.level}: ${level}\n${t.xp}: ${xp.toLocaleString()}\n${t.progress}: ${progress.percentage.toFixed(1)}%\n${progressBar}\n${t.won}: ${userData?.games_won || 0}/${userData?.games_played || 0}\`\`\``, inline: false }
        )
        .setFooter({ text: `EAGLE COMMUNITY • NEURAL ARCADE v${version}` })
        .setTimestamp();
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('game_dice').setLabel(lang === 'fr' ? '🎲 DÉ' : '🎲 DICE').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('game_coinflip').setLabel(lang === 'fr' ? '🪙 PILE/FACE' : '🪙 COIN FLIP').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('game_slots').setLabel('🎰 SLOTS').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('game_blackjack').setLabel('🃏 BLACKJACK').setStyle(ButtonStyle.Secondary)
        );
    
    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('game_rps').setLabel(lang === 'fr' ? '✊ PFC' : '✊ RPS').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('game_guess').setLabel(lang === 'fr' ? '🔢 DEVINE' : '🔢 GUESS').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('game_trivia').setLabel(lang === 'fr' ? '🧠 CULTURE' : '🧠 TRIVIA').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('game_hangman').setLabel(lang === 'fr' ? '🪑 PENDU' : '🪑 HANGMAN').setStyle(ButtonStyle.Success)
        );
    
    const row3 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('game_stats').setLabel('📊 STATS').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('game_leaderboard').setLabel('🏆 LEADERBOARD').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('game_rank').setLabel('📈 RANK').setStyle(ButtonStyle.Primary)
        );
    
    const reply = await message.reply({ embeds: [menuEmbed], components: [row, row2, row3] });
    
    const collector = reply.createMessageComponentCollector({ time: 60000 });
    
    collector.on('collect', async (interaction) => {
        if (interaction.user.id !== message.author.id) {
            return interaction.reply({ content: `❌ ${t.notYourMenu}`, ephemeral: true });
        }
        
        await interaction.deferUpdate();
        
        switch(interaction.customId) {
            case 'game_dice': await playDiceGame(client, message, userData, null, lang); break;
            case 'game_coinflip': await playCoinFlip(client, message, userData, null, lang); break;
            case 'game_slots': await playSlots(client, message, userData, lang); break;
            case 'game_blackjack': await playBlackjack(client, message, userData, lang); break;
            case 'game_rps': await playRPS(client, message, userData, null, lang); break;
            case 'game_guess': await playNumberGuess(client, message, userData, lang); break;
            case 'game_trivia': await playTrivia(client, message, userData, lang); break;
            case 'game_hangman': await playHangman(client, message, userData, lang); break;
            case 'game_stats': await showGameStats(client, message, userData, lang); break;
            case 'game_leaderboard': await showGameLeaderboard(client, message, null, lang); break;
            case 'game_rank': await showAgentProfile(client, message, userData, lang); break;
        }
        
        collector.stop();
    });
}

// ================= PROFIL AGENT =================
async function showAgentProfile(client, message, userData, lang) {
    const t = texts[lang];
    const version = client.version || '1.3.2';
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(message.author.id);
    const xp = user?.xp || 0;
    const level = calculateLevel(xp);
    const rank = getRank(level);
    const progress = calculateProgress(xp, level);
    const credits = user?.credits || 0;
    
    const gamesPlayed = user?.games_played || 0;
    const gamesWon = user?.games_won || 0;
    const totalWinnings = user?.total_winnings || 0;
    const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
    const xpToNext = Math.ceil(progress.xpNeeded - progress.xpGained);
    const progressBar = createProgressBar(progress.percentage, 20);
    
    const nextRank = RANKS.find(r => r.minLevel > level);
    
    const embed = new EmbedBuilder()
        .setColor(rank.color)
        .setAuthor({ name: `📜 ${t.agentProfile}`, iconURL: client.user.displayAvatarURL() })
        .setTitle(`${rank.emoji} ${rank.title[lang]}`)
        .setDescription(`**Agent:** ${message.author.username}`)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 512 }))
        .addFields(
            { name: `💰 ${t.balance}`, value: `\`${credits.toLocaleString()} 🪙\``, inline: true },
            { name: `📈 ${t.progress}`, value: `\`\`\`yaml\n${t.level}: ${level}\n${t.xp}: ${xp.toLocaleString()}\n${t.progress}: ${progress.percentage.toFixed(1)}%\n${progressBar}\n${t.nextLevel}: ${xpToNext.toLocaleString()} XP\`\`\``, inline: false },
            { name: `🎮 ${t.gameStats}`, value: `\`\`\`yaml\n${t.played}: ${gamesPlayed}\n${t.won}: ${gamesWon}\n${t.winRate}: ${winRate}%\nGains: ${totalWinnings.toLocaleString()} ${t.coins}\`\`\``, inline: false }
        );
    
    if (nextRank) {
        const xpNeededForNextRank = Math.pow((nextRank.minLevel - 1) / 0.1, 2);
        const xpRemaining = Math.max(0, xpNeededForNextRank - xp);
        embed.addFields({ 
            name: lang === 'fr' ? '🎯 PROCHAINE PROMOTION' : '🎯 NEXT PROMOTION', 
            value: `**${nextRank.emoji} ${nextRank.title[lang]}**\n${t.level} ${nextRank.minLevel}\n${lang === 'fr' ? 'XP restant' : 'XP remaining'}: ${Math.ceil(xpRemaining).toLocaleString()}`,
            inline: false 
        });
    }
    
    embed.setFooter({ text: `.game menu • Continue playing! • v${version}`, iconURL: client.user.displayAvatarURL() })
        .setTimestamp();
    
    message.reply({ embeds: [embed] });
}

// ================= DICE GAME =================
async function playDiceGame(client, message, userData, guess, lang) {
    const t = texts[lang];
    const bet = 100;
    
    // Anti-Bankruptcy Guard
    if (!hasEnoughCredits(message.author.id, bet, lang)) {
        return message.reply(t.insufficientCredits);
    }
    
    if (guess === null || guess === undefined) {
        return message.reply(lang === 'fr' ? t.useCommand : t.useCommandEn);
    }
    
    if (!guess) {
        const embed = new EmbedBuilder()
            .setColor('#ff4757')
            .setAuthor({ name: lang === 'fr' ? '🎲 DÉ ROULETTE' : '🎲 DICE ROULETTE', iconURL: message.author.displayAvatarURL() })
            .setDescription(`❌ **${t.invalidGuess}**`)
            .addFields({ name: lang === 'fr' ? '📝 UTILISATION' : '📝 USAGE', value: '`.game dice [1-6]`\nExample: `.game dice 4`' });
        return message.reply({ embeds: [embed] });
    }
    
    const userGuess = parseInt(guess);
    
    if (isNaN(userGuess) || userGuess < 1 || userGuess > 6) {
        const embed = new EmbedBuilder()
            .setColor('#ff4757')
            .setAuthor({ name: lang === 'fr' ? '🎲 DÉ ROULETTE' : '🎲 DICE ROULETTE', iconURL: message.author.displayAvatarURL() })
            .setDescription(`❌ **${t.invalidGuess}** ${lang === 'fr' ? 'Nombre entre 1-6.' : 'Number between 1-6.'}`);
        return message.reply({ embeds: [embed] });
    }
    
    const roll = Math.floor(Math.random() * 6) + 1;
    const won = userGuess === roll;
    const winnings = won ? bet * 5 : -bet;
    
    const actualWinnings = updateGameStats(message.author.id, won, winnings, message.channel, message.author.username, lang);
    
    const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(message.author.id);
    const level = calculateLevel(updatedUser?.xp || 0);
    const rank = getRank(level);
    const credits = updatedUser?.credits || 0;
    const version = client.version || '1.3.2';
    
    const embed = new EmbedBuilder()
        .setColor(won ? '#57F287' : '#ED4245')
        .setAuthor({ name: lang === 'fr' ? '🎲 DÉ ROULETTE' : '🎲 DICE ROULETTE', iconURL: message.author.displayAvatarURL() })
        .setTitle(won ? t.win : t.lose)
        .setDescription(lang === 'fr' 
            ? `**Vous avez prédit:** \`${userGuess}\`\n**Le dé a montré:** \`${roll}\``
            : `**You predicted:** \`${userGuess}\`\n**The die showed:** \`${roll}\``)
        .addFields(
            { name: '💰 RÉSULTAT', value: won ? `+${actualWinnings.toLocaleString()} ${t.coins}` : `${actualWinnings.toLocaleString()} ${t.coins}`, inline: true },
            { name: `💰 ${t.balance}`, value: `${credits.toLocaleString()} ${t.coins}`, inline: true },
            { name: `📈 ${t.rank}`, value: `${rank.emoji} ${rank.title[lang]} (${t.level} ${level})`, inline: true }
        )
        .setFooter({ text: `EAGLE COMMUNITY • NEURAL ARCADE v${version}` });
    
    message.reply({ embeds: [embed] });
}

// ================= COIN FLIP =================
async function playCoinFlip(client, message, userData, choice, lang) {
    const t = texts[lang];
    const bet = 100;
    
    // Anti-Bankruptcy Guard
    if (!hasEnoughCredits(message.author.id, bet, lang)) {
        return message.reply(t.insufficientCredits);
    }
    
    if (!choice || !['heads', 'tails', 'h', 't', 'pile', 'face', 'p', 'f'].includes(choice.toLowerCase())) {
        const embed = new EmbedBuilder()
            .setColor('#ff4757')
            .setAuthor({ name: '🪙 PILE OU FACE', iconURL: message.author.displayAvatarURL() })
            .setDescription(`❌ ${lang === 'fr' ? 'Veuillez spécifier pile ou face!' : 'Please specify heads or tails!'}`)
            .addFields({ name: lang === 'fr' ? '📝 UTILISATION' : '📝 USAGE', value: '`.game coinflip [pile/face]`\nExample: `.game coinflip pile`' });
        return message.reply({ embeds: [embed] });
    }
    
    let normalizedChoice = choice.toLowerCase();
    if (normalizedChoice === 'pile' || normalizedChoice === 'p') normalizedChoice = 'heads';
    if (normalizedChoice === 'face' || normalizedChoice === 'f') normalizedChoice = 'tails';
    if (normalizedChoice === 'h') normalizedChoice = 'heads';
    if (normalizedChoice === 't') normalizedChoice = 'tails';
    
    const sides = ['heads', 'tails'];
    const result = sides[Math.floor(Math.random() * 2)];
    const won = normalizedChoice === result;
    const winnings = won ? bet : -bet;
    
    const actualWinnings = updateGameStats(message.author.id, won, winnings, message.channel, message.author.username, lang);
    
    const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(message.author.id);
    const level = calculateLevel(updatedUser?.xp || 0);
    const rank = getRank(level);
    const credits = updatedUser?.credits || 0;
    const version = client.version || '1.3.2';
    
    const resultFr = result === 'heads' ? 'pile' : 'face';
    const choiceFr = normalizedChoice === 'heads' ? 'pile' : 'face';
    
    const embed = new EmbedBuilder()
        .setColor(won ? '#57F287' : '#ED4245')
        .setAuthor({ name: '🪙 PILE OU FACE', iconURL: message.author.displayAvatarURL() })
        .setTitle(won ? (lang === 'fr' ? '✨ BONNE PRÉDICTION!' : '✨ GOOD PREDICTION!') : (lang === 'fr' ? '❌ MAUVAISE PRÉDICTION' : '❌ WRONG PREDICTION'))
        .setDescription(lang === 'fr'
            ? `**Vous avez choisi:** \`${choiceFr}\`\n**La pièce est tombée sur:** \`${resultFr}\``
            : `**You chose:** \`${choiceFr}\`\n**The coin landed on:** \`${resultFr}\``)
        .addFields(
            { name: '💰 RÉSULTAT', value: won ? `+${actualWinnings.toLocaleString()} ${t.coins}` : `${actualWinnings.toLocaleString()} ${t.coins}`, inline: true },
            { name: `💰 ${t.balance}`, value: `${credits.toLocaleString()} ${t.coins}`, inline: true },
            { name: `📈 ${t.rank}`, value: `${rank.emoji} ${rank.title[lang]} (${t.level} ${level})`, inline: true }
        )
        .setFooter({ text: `EAGLE COMMUNITY • NEURAL ARCADE v${version}` });
    
    message.reply({ embeds: [embed] });
}

// ================= NUMBER GUESS =================
let activeGuesses = new Map();

async function playNumberGuess(client, message, userData, lang) {
    const t = texts[lang];
    const bet = 100;
    
    // Anti-Bankruptcy Guard
    if (!hasEnoughCredits(message.author.id, bet, lang)) {
        return message.reply(t.insufficientCredits);
    }
    
    if (activeGuesses.has(message.author.id)) {
        return message.reply(`❌ ${lang === 'fr' ? 'Vous avez déjà une partie en cours! Terminez-la d\'abord.' : 'You already have a game in progress! Finish it first.'}`);
    }
    
    // Deduct bet immediately for guess game
    const currentCredits = db.prepare("SELECT credits FROM users WHERE id = ?").get(message.author.id)?.credits || 0;
    if (currentCredits < bet) {
        return message.reply(t.insufficientCredits);
    }
    db.prepare(`UPDATE users SET credits = credits - ? WHERE id = ?`).run(bet, message.author.id);
    
    const target = Math.floor(Math.random() * 100) + 1;
    let attempts = 0;
    const maxAttempts = 5;
    
    activeGuesses.set(message.author.id, { target, attempts, maxAttempts, bet });
    
    const embed = new EmbedBuilder()
        .setColor('#00fbff')
        .setAuthor({ name: lang === 'fr' ? '🔢 DEVINE LE NOMBRE' : '🔢 GUESS THE NUMBER', iconURL: message.author.displayAvatarURL() })
        .setTitle(lang === 'fr' ? '🎯 DEVINEZ LE NOMBRE' : '🎯 GUESS THE NUMBER')
        .setDescription(lang === 'fr'
            ? `Je pense à un nombre entre **1** et **100**.\nVous avez **${maxAttempts}** essais!`
            : `I'm thinking of a number between **1** and **100**.\nYou have **${maxAttempts}** attempts!`)
        .addFields(
            { name: lang === 'fr' ? '🏆 RÉCOMPENSE' : '🏆 REWARD', value: '1 essai: 200x • 2: 100x • 3: 50x • 4: 25x • 5: 10x' },
            { name: `💰 ${t.balance}`, value: `${(currentCredits - bet).toLocaleString()} 🪙`, inline: true }
        )
        .setFooter({ text: lang === 'fr' ? 'Vous avez 60 secondes!' : 'You have 60 seconds!' });
    
    await message.reply({ embeds: [embed] });
    
    const filter = m => m.author.id === message.author.id && !isNaN(parseInt(m.content));
    const collector = message.channel.createMessageCollector({ filter, time: 60000, max: maxAttempts });
    
    collector.on('collect', async (msg) => {
        const game = activeGuesses.get(message.author.id);
        if (!game) return;
        
        const guess = parseInt(msg.content);
        game.attempts++;
        
        if (guess === game.target) {
            const multiplier = [200, 100, 50, 25, 10][game.attempts - 1];
            const winnings = game.bet * multiplier;
            
            // Refund bet + add winnings
            const totalGain = winnings;
            updateGameStats(message.author.id, true, totalGain, message.channel, message.author.username, lang);
            activeGuesses.delete(message.author.id);
            collector.stop();
            
            const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(message.author.id);
            const level = calculateLevel(updatedUser?.xp || 0);
            const rank = getRank(level);
            const credits = updatedUser?.credits || 0;
            const version = client.version || '1.3.2';
            
            const winEmbed = new EmbedBuilder()
                .setColor('#57F287')
                .setAuthor({ name: lang === 'fr' ? '🔢 DEVINE LE NOMBRE' : '🔢 GUESS THE NUMBER', iconURL: message.author.displayAvatarURL() })
                .setTitle(lang === 'fr' ? '🎉 DEVINETTE PARFAITE!' : '🎉 PERFECT GUESS!')
                .setDescription(lang === 'fr'
                    ? `**Le nombre était:** \`${game.target}\`\n**Trouvé en:** \`${game.attempts}\` essai(s)`
                    : `**The number was:** \`${game.target}\`\n**Found in:** \`${game.attempts}\` attempt(s)`)
                .addFields(
                    { name: '💰 RÉCOMPENSE', value: `+${totalGain.toLocaleString()} ${t.coins} (${multiplier}x)`, inline: true },
                    { name: `💰 ${t.balance}`, value: `${credits.toLocaleString()} ${t.coins}`, inline: true },
                    { name: `📈 ${t.rank}`, value: `${rank.emoji} ${rank.title[lang]} (${t.level} ${level})`, inline: true }
                )
                .setFooter({ text: `EAGLE COMMUNITY • NEURAL ARCADE v${version}` });
            
            await message.reply({ embeds: [winEmbed] });
        } else if (game.attempts >= game.maxAttempts) {
            updateGameStats(message.author.id, false, 0, message.channel, message.author.username, lang);
            activeGuesses.delete(message.author.id);
            collector.stop();
            
            const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(message.author.id);
            const credits = updatedUser?.credits || 0;
            const version = client.version || '1.3.2';
            
            const loseEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setAuthor({ name: lang === 'fr' ? '🔢 DEVINE LE NOMBRE' : '🔢 GUESS THE NUMBER', iconURL: message.author.displayAvatarURL() })
                .setTitle(lang === 'fr' ? '💔 PARTIE TERMINÉE' : '💔 GAME OVER')
                .setDescription(lang === 'fr'
                    ? `**Le nombre était:** \`${game.target}\``
                    : `**The number was:** \`${game.target}\``)
                .addFields(
                    { name: '💰 RÉSULTAT', value: `-${game.bet} ${t.coins}`, inline: true },
                    { name: `💰 ${t.balance}`, value: `${credits.toLocaleString()} ${t.coins}`, inline: true }
                )
                .setFooter({ text: `EAGLE COMMUNITY • NEURAL ARCADE v${version}` });
            
            await message.reply({ embeds: [loseEmbed] });
        } else {
            const hint = guess < game.target ? (lang === 'fr' ? 'plus grand' : 'higher') : (lang === 'fr' ? 'plus petit' : 'lower');
            const remaining = game.maxAttempts - game.attempts;
            
            const hintEmbed = new EmbedBuilder()
                .setColor('#FEE75C')
                .setDescription(`❌ **${guess}** ${lang === 'fr' ? "n'est pas correct." : "is not correct."} ${t.guessHint} **${hint}**!\n*${remaining} ${t.attemptsLeft}*`);
            
            await msg.reply({ embeds: [hintEmbed] });
        }
    });
    
    collector.on('end', () => {
        if (activeGuesses.has(message.author.id)) {
            activeGuesses.delete(message.author.id);
        }
    });
}

// ================= SLOT MACHINE =================
async function playSlots(client, message, userData, lang) {
    const t = texts[lang];
    const bet = 100;
    
    // Anti-Bankruptcy Guard
    if (!hasEnoughCredits(message.author.id, bet, lang)) {
        return message.reply(t.insufficientCredits);
    }
    
    const symbols = ['🍒', '🍋', '🍊', '7️⃣', '💎', '🎰'];
    const reels = [
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)]
    ];
    
    let multiplier = 0;
    if (reels[0] === reels[1] && reels[1] === reels[2]) {
        if (reels[0] === '7️⃣') multiplier = 500;
        else if (reels[0] === '💎') multiplier = 250;
        else if (reels[0] === '🎰') multiplier = 100;
        else multiplier = 50;
    } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
        multiplier = 2;
    }
    
    const won = multiplier > 0;
    const winnings = won ? bet * multiplier : -bet;
    
    const actualWinnings = updateGameStats(message.author.id, won, winnings, message.channel, message.author.username, lang);
    
    const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(message.author.id);
    const level = calculateLevel(updatedUser?.xp || 0);
    const rank = getRank(level);
    const credits = updatedUser?.credits || 0;
    const version = client.version || '1.3.2';
    
    const embed = new EmbedBuilder()
        .setColor(won ? '#57F287' : '#ED4245')
        .setAuthor({ name: lang === 'fr' ? '🎰 MACHINE À SOUS' : '🎰 SLOT MACHINE', iconURL: message.author.displayAvatarURL() })
        .setTitle(won ? (lang === 'fr' ? '✨ JACKPOT!' : '✨ JACKPOT!') : (lang === 'fr' ? '💔 PAS DE CHANCE' : '💔 NO LUCK'))
        .setDescription(`\`\`\`\n┌─────┬─────┬─────┐\n│  ${reels[0]}  │  ${reels[1]}  │  ${reels[2]}  │\n└─────┴─────┴─────┘\n\`\`\``)
        .addFields(
            { name: lang === 'fr' ? '🎁 GAIN' : '🎁 WINNING', value: won ? `+${actualWinnings.toLocaleString()} ${t.coins} (${multiplier}x)` : `${actualWinnings.toLocaleString()} ${t.coins}`, inline: true },
            { name: `💰 ${t.balance}`, value: `${credits.toLocaleString()} ${t.coins}`, inline: true },
            { name: `📈 ${t.rank}`, value: `${rank.emoji} ${rank.title[lang]} (${t.level} ${level})`, inline: true }
        )
        .setFooter({ text: `EAGLE COMMUNITY • NEURAL ARCADE v${version}` });
    
    message.reply({ embeds: [embed] });
}

// ================= BLACKJACK =================
async function playBlackjack(client, message, userData, lang) {
    const t = texts[lang];
    const bet = 200;
    
    // Anti-Bankruptcy Guard
    if (!hasEnoughCredits(message.author.id, bet, lang)) {
        return message.reply(t.insufficientCredits);
    }
    
    // Deduct bet immediately
    db.prepare(`UPDATE users SET credits = credits - ? WHERE id = ?`).run(bet, message.author.id);
    
    let playerHand = [drawCard(), drawCard()];
    let dealerHand = [drawCard(), drawCard()];
    let gameOver = false;
    let playerBusted = false;
    
    const version = client.version || '1.3.2';

    const generateEmbed = (status = lang === 'fr' ? 'À votre tour, Agent.' : 'Your turn, Agent.', currentCredits = null) => {
        const pScore = calculateHand(playerHand);
        const dScore = gameOver ? calculateHand(dealerHand) : '??';
        const dDisplay = gameOver ? dealerHand.join(' ') : `${dealerHand[0]} 🃟`;
        const credits = currentCredits !== null ? currentCredits : db.prepare("SELECT credits FROM users WHERE id = ?").get(message.author.id)?.credits || 0;

        return new EmbedBuilder()
            .setColor(gameOver ? '#00fbff' : '#f1c40f')
            .setAuthor({ name: lang === 'fr' ? '🃏 BLACKJACK NEURAL' : '🃏 NEURAL BLACKJACK', iconURL: message.author.displayAvatarURL() })
            .setTitle(lang === 'fr' ? '═ DUEL DE DONNÉES À HAUT RISQUE ═' : '═ HIGH-RISK DATA DUEL ═')
            .setDescription(`**Status:** ${status}`)
            .addFields(
                { name: lang === 'fr' ? '🎴 VOTRE MAIN' : '🎴 YOUR HAND', value: `\`${playerHand.join(' ')}\` \n**Score:** ${pScore}`, inline: true },
                { name: lang === 'fr' ? '🃟 MAIN DU CROUPIER' : '🃟 DEALER HAND', value: `\`${dDisplay}\` \n**Score:** ${dScore}`, inline: true },
                { name: `💰 ${t.balance}`, value: `${credits.toLocaleString()} 🪙`, inline: true }
            )
            .setFooter({ text: `EAGLE COMMUNITY • NEURAL ARCADE v${version}` });
    };

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bj_hit').setLabel(lang === 'fr' ? 'PIOCHE' : 'HIT').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('bj_stand').setLabel(lang === 'fr' ? 'RESTE' : 'STAND').setStyle(ButtonStyle.Secondary)
    );

    const gameMsg = await message.reply({ embeds: [generateEmbed()], components: [row] });

    const collector = gameMsg.createMessageComponentCollector({ 
        filter: i => i.user.id === message.author.id, 
        time: 30000 
    });

    collector.on('collect', async (i) => {
        if (i.customId === 'bj_hit') {
            playerHand.push(drawCard());
            const pScore = calculateHand(playerHand);
            if (pScore > 21) {
                playerBusted = true;
                gameOver = true;
                collector.stop('bust');
            } else {
                await i.update({ embeds: [generateEmbed()] });
            }
        } else {
            gameOver = true;
            collector.stop('stand');
        }
    });

    collector.on('end', async (collected, reason) => {
        let pScore = calculateHand(playerHand);
        let dScore = calculateHand(dealerHand);

        if (reason === 'stand' && !playerBusted) {
            while (dScore < 17) {
                dealerHand.push(drawCard());
                dScore = calculateHand(dealerHand);
            }
        }

        let result = '';
        let won = false;
        let winnings = 0;

        if (playerBusted || pScore > 21) {
            result = lang === 'fr' ? '💀 DÉPASSEMENT! Surcharge système.' : '💀 BUST! System overload.';
            winnings = -bet;
        } else if (dScore > 21 || pScore > dScore) {
            result = lang === 'fr' ? '🎉 VICTOIRE! Liaison neurale stable.' : '🎉 VICTORY! Neural link stable.';
            won = true;
            winnings = bet * 2;
        } else if (dScore > pScore) {
            result = lang === 'fr' ? '💔 DÉFAITE! Le croupier vous a surpassé.' : '💔 DEFEAT! Dealer outplayed you.';
            winnings = -bet;
        } else {
            result = lang === 'fr' ? '🤝 ÉGALITÉ! Données synchronisées.' : '🤝 TIE! Data synchronized.';
            winnings = bet; // Refund bet
        }

        const actualWinnings = updateGameStats(message.author.id, won, winnings, message.channel, message.author.username, lang);
        
        const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(message.author.id);
        const level = calculateLevel(updatedUser?.xp || 0);
        const rank = getRank(level);
        const credits = updatedUser?.credits || 0;
        
        const finalEmbed = generateEmbed(result, credits)
            .setColor(won ? '#57F287' : (winnings === bet ? '#FEE75C' : '#ED4245'))
            .addFields(
                { name: '💰 RÉSULTAT', value: `${actualWinnings > 0 ? '+' : ''}${actualWinnings.toLocaleString()} ${t.coins}`, inline: false },
                { name: `📈 ${t.rank}`, value: `${rank.emoji} ${rank.title[lang]} (${t.level} ${level})`, inline: true }
            );

        await gameMsg.edit({ embeds: [finalEmbed], components: [] });
    });
}

// ================= ROCK PAPER SCISSORS =================
async function playRPS(client, message, userData, choice, lang) {
    const t = texts[lang];
    const bet = 100;
    
    // Anti-Bankruptcy Guard
    if (!hasEnoughCredits(message.author.id, bet, lang)) {
        return message.reply(t.insufficientCredits);
    }
    
    if (!choice || !['rock', 'paper', 'scissors', 'r', 'p', 's', 'pierre', 'feuille', 'ciseaux', 'pi', 'fe', 'ci'].includes(choice.toLowerCase())) {
        const embed = new EmbedBuilder()
            .setColor('#ff4757')
            .setAuthor({ name: lang === 'fr' ? '✊ PFC DUEL' : '✊ RPS DUEL', iconURL: message.author.displayAvatarURL() })
            .setDescription(`❌ ${lang === 'fr' ? 'Veuillez spécifier pierre, feuille ou ciseaux!' : 'Please specify rock, paper, or scissors!'}`)
            .addFields({ name: lang === 'fr' ? '📝 UTILISATION' : '📝 USAGE', value: '`.game rps [pierre/feuille/ciseaux]`\nExample: `.game rps pierre`' });
        return message.reply({ embeds: [embed] });
    }
    
    let normalizedChoice = choice.toLowerCase();
    if (normalizedChoice === 'pierre' || normalizedChoice === 'pi') normalizedChoice = 'rock';
    if (normalizedChoice === 'feuille' || normalizedChoice === 'fe') normalizedChoice = 'paper';
    if (normalizedChoice === 'ciseaux' || normalizedChoice === 'ci') normalizedChoice = 'scissors';
    if (normalizedChoice === 'r') normalizedChoice = 'rock';
    if (normalizedChoice === 'p') normalizedChoice = 'paper';
    if (normalizedChoice === 's') normalizedChoice = 'scissors';
    
    const options = ['rock', 'paper', 'scissors'];
    const botChoice = options[Math.floor(Math.random() * 3)];
    
    let result = '';
    let won = false;
    let winnings = 0;
    
    if (normalizedChoice === botChoice) {
        result = t.tie;
        won = false;
        winnings = 0;
    } else if (
        (normalizedChoice === 'rock' && botChoice === 'scissors') ||
        (normalizedChoice === 'paper' && botChoice === 'rock') ||
        (normalizedChoice === 'scissors' && botChoice === 'paper')
    ) {
        result = t.win;
        won = true;
        winnings = bet * 2;
    } else {
        result = t.lose;
        won = false;
        winnings = -bet;
    }
    
    const actualWinnings = updateGameStats(message.author.id, won, winnings, message.channel, message.author.username, lang);
    
    const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(message.author.id);
    const level = calculateLevel(updatedUser?.xp || 0);
    const rank = getRank(level);
    const credits = updatedUser?.credits || 0;
    const version = client.version || '1.3.2';
    
    const emojis = { rock: '✊', paper: '✋', scissors: '✌️' };
    const namesFr = { rock: 'PIERRE', paper: 'FEUILLE', scissors: 'CISEAUX' };
    const namesEn = { rock: 'ROCK', paper: 'PAPER', scissors: 'SCISSORS' };
    const names = lang === 'fr' ? namesFr : namesEn;
    
    const embed = new EmbedBuilder()
        .setColor(won ? '#57F287' : (winnings === 0 ? '#FEE75C' : '#ED4245'))
        .setAuthor({ name: lang === 'fr' ? '✊ PFC DUEL' : '✊ RPS DUEL', iconURL: message.author.displayAvatarURL() })
        .setTitle(lang === 'fr' ? '═ COMBAT STRATÉGIQUE ═' : '═ STRATEGIC COMBAT ═')
        .setDescription(result)
        .addFields(
            { name: lang === 'fr' ? '🎮 VOTRE MOUVEMENT' : '🎮 YOUR MOVE', value: `${emojis[normalizedChoice]} **${names[normalizedChoice]}**`, inline: true },
            { name: lang === 'fr' ? '🤖 MOUVEMENT IA' : '🤖 AI MOVE', value: `${emojis[botChoice]} **${names[botChoice]}**`, inline: true },
            { name: '💰 RÉSULTAT', value: actualWinnings !== 0 ? `${actualWinnings > 0 ? '+' : ''}${actualWinnings.toLocaleString()} ${t.coins}` : (lang === 'fr' ? 'Aucun changement' : 'No change'), inline: false },
            { name: `💰 ${t.balance}`, value: `${credits.toLocaleString()} ${t.coins}`, inline: true },
            { name: `📈 ${t.rank}`, value: `${rank.emoji} ${rank.title[lang]} (${t.level} ${level})`, inline: true }
        )
        .setFooter({ text: `EAGLE COMMUNITY • NEURAL ARCADE v${version}` });
    
    message.reply({ embeds: [embed] });
}

// ================= TRIVIA =================
async function playTrivia(client, message, userData, lang) {
    const t = texts[lang];
    const bet = 100;
    
    // Anti-Bankruptcy Guard
    if (!hasEnoughCredits(message.author.id, bet, lang)) {
        return message.reply(t.insufficientCredits);
    }
    
    const questions = lang === 'fr' ? [
        { q: "Que signifie HTML ?", a: ["HyperText Markup Language", "High Tech Modern Language", "Hyperlink Text Management"], correct: 0, fact: "HTML est la structure de base du web." },
        { q: "Quel langage est utilisé pour ce bot ?", a: ["CSS", "JavaScript", "C++"], correct: 1, fact: "JavaScript (Node.js) est le standard pour les bots Discord." },
        { q: "Dans CODM, que signifie 'ADS' ?", a: ["Aim Down Sights", "Auto Deploy System", "Advanced Defense Shield"], correct: 0, fact: "L'ADS est le temps de visée." },
        { q: "Capitale du Mali ?", a: ["Bamako", "Ségou", "Mopti"], correct: 0, fact: "Bamako est le centre économique du Mali." },
        { q: "Peintre de la Joconde ?", a: ["Van Gogh", "Picasso", "Léonard de Vinci"], correct: 2, fact: "La Joconde est au Louvre." }
    ] : [
        { q: "What does HTML stand for?", a: ["HyperText Markup Language", "High Tech Modern Language", "Hyperlink Text Management"], correct: 0, fact: "HTML is the basic structure of the web." },
        { q: "Which language is used for this bot?", a: ["CSS", "JavaScript", "C++"], correct: 1, fact: "JavaScript (Node.js) is the standard for Discord bots." },
        { q: "In CODM, what does 'ADS' mean?", a: ["Aim Down Sights", "Auto Deploy System", "Advanced Defense Shield"], correct: 0, fact: "ADS is the aiming time." },
        { q: "Capital of Mali?", a: ["Bamako", "Ségou", "Mopti"], correct: 0, fact: "Bamako is the economic center of Mali." },
        { q: "Painter of the Mona Lisa?", a: ["Van Gogh", "Picasso", "Leonardo da Vinci"], correct: 2, fact: "The Mona Lisa is at the Louvre." }
    ];

    const data = questions[Math.floor(Math.random() * questions.length)];
    const version = client.version || '1.3.2';
    
    const embed = new EmbedBuilder()
        .setColor('#00fbff')
        .setAuthor({ name: lang === 'fr' ? '🧠 CULTURE GÉNÉRALE' : '🧠 GENERAL KNOWLEDGE', iconURL: client.user.displayAvatarURL() })
        .setTitle('📥 QUESTION')
        .setDescription(`**${data.q}**`)
        .setFooter({ text: `${lang === 'fr' ? 'Temps: 15 secondes' : 'Time: 15 seconds'} • v${version}` });

    const row = new ActionRowBuilder().addComponents(
        data.a.map((choice, index) => 
            new ButtonBuilder()
                .setCustomId(`trivia_${index}`)
                .setLabel(choice.length > 50 ? choice.substring(0, 47) + '...' : choice)
                .setStyle(ButtonStyle.Primary)
        )
    );

    const reply = await message.reply({ embeds: [embed], components: [row] });
    const collector = reply.createMessageComponentCollector({ time: 15000 });

    collector.on('collect', async (i) => {
        if (i.user.id !== message.author.id) return i.reply({ content: lang === 'fr' ? "Accès refusé." : "Access denied.", ephemeral: true });
        
        const isCorrect = i.customId === `trivia_${data.correct}`;
        const winnings = isCorrect ? 500 : -100;
        
        const actualWinnings = updateGameStats(message.author.id, isCorrect, winnings, message.channel, message.author.username, lang);
        
        const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(message.author.id);
        const level = calculateLevel(updatedUser?.xp || 0);
        const rank = getRank(level);
        const credits = updatedUser?.credits || 0;
        
        const resultEmbed = new EmbedBuilder()
            .setColor(isCorrect ? '#57F287' : '#ED4245')
            .setTitle(isCorrect ? (lang === 'fr' ? '✅ CORRECT' : '✅ CORRECT') : (lang === 'fr' ? '❌ INCORRECT' : '❌ INCORRECT'))
            .setDescription(isCorrect ? `+${actualWinnings} ${t.coins}` : `${actualWinnings} ${t.coins}\n${lang === 'fr' ? 'Réponse' : 'Answer'}: **${data.a[data.correct]}**`)
            .addFields(
                { name: '🧠 INFO', value: data.fact },
                { name: `💰 ${t.balance}`, value: `${credits.toLocaleString()} ${t.coins}`, inline: true },
                { name: `📈 ${t.rank}`, value: `${rank.emoji} ${rank.title[lang]} (${t.level} ${level})`, inline: true }
            )
            .setFooter({ text: `EAGLE COMMUNITY • NEURAL ARCADE v${version}` });

        await i.update({ embeds: [resultEmbed], components: [] });
        collector.stop();
    });
}

// ================= HANGMAN =================
async function playHangman(client, message, userData, lang) {
    const t = texts[lang];
    const bet = 200;
    
    // Anti-Bankruptcy Guard
    if (!hasEnoughCredits(message.author.id, bet, lang)) {
        return message.reply(t.insufficientCredits);
    }
    
    // Deduct bet immediately
    db.prepare(`UPDATE users SET credits = credits - ? WHERE id = ?`).run(bet, message.author.id);
    
    const words = lang === 'fr' 
        ? ['ARCHITECTE', 'JAVASCRIPT', 'BAMAKO', 'DISCORD', 'VICTOIRE', 'STRATEGIE', 'NEURAL', 'ARCADE']
        : ['ARCHITECT', 'JAVASCRIPT', 'BAMAKO', 'DISCORD', 'VICTORY', 'STRATEGY', 'NEURAL', 'ARCADE'];
    const targetWord = words[Math.floor(Math.random() * words.length)];
    let guessed = [];
    let lives = 6;
    const version = client.version || '1.3.2';

    const getDisplay = () => targetWord.split('').map(l => guessed.includes(l) ? l : ' _ ').join('');

    const hmEmbed = new EmbedBuilder()
        .setColor('#FEE75C')
        .setTitle(lang === 'fr' ? '🪑 PENDU NEURAL' : '🪑 NEURAL HANGMAN')
        .setDescription(`**Word:** \`${getDisplay()}\` \n\n**Lives:** ❤️ ${lives}\n${lang === 'fr' ? 'Tapez une lettre!' : 'Type a letter!'}`)
        .setFooter({ text: `EAGLE COMMUNITY • NEURAL ARCADE v${version}` });

    const gameMsg = await message.reply({ embeds: [hmEmbed] });

    const filter = m => m.author.id === message.author.id && m.content.length === 1 && /^[A-Za-z]$/i.test(m.content);
    const collector = message.channel.createMessageCollector({ filter, time: 60000 });

    collector.on('collect', async (m) => {
        const char = m.content.toUpperCase();
        if (guessed.includes(char)) return m.reply(lang === 'fr' ? "Lettre déjà essayée!" : "Letter already tried!");

        guessed.push(char);
        if (!targetWord.includes(char)) lives--;

        if (getDisplay() === targetWord) {
            const winnings = bet * 5;
            updateGameStats(message.author.id, true, winnings, message.channel, message.author.username, lang);
            collector.stop('win');
        } else if (lives <= 0) {
            updateGameStats(message.author.id, false, -bet, message.channel, message.author.username, lang);
            collector.stop('lose');
        } else {
            hmEmbed.setDescription(`**Word:** \`${getDisplay()}\` \n\n**Lives:** ❤️ ${lives}\n**Letters:** ${guessed.join(', ')}`);
            await gameMsg.edit({ embeds: [hmEmbed] });
        }
    });

    collector.on('end', async (collected, reason) => {
        const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(message.author.id);
        const level = calculateLevel(updatedUser?.xp || 0);
        const rank = getRank(level);
        const credits = updatedUser?.credits || 0;
        
        const endEmbed = new EmbedBuilder()
            .setFooter({ text: `EAGLE COMMUNITY • NEURAL ARCADE v${version}` });
            
        if (reason === 'win') {
            endEmbed.setColor('#57F287')
                .setTitle(lang === 'fr' ? '🎉 SAUVÉ!' : '🎉 SAVED!')
                .setDescription(`${lang === 'fr' ? 'Mot' : 'Word'}: **${targetWord}**!\n**+1,000 ${t.coins}**`)
                .addFields(
                    { name: `💰 ${t.balance}`, value: `${credits.toLocaleString()} ${t.coins}`, inline: true },
                    { name: `📈 ${t.rank}`, value: `${rank.emoji} ${rank.title[lang]} (${t.level} ${level})`, inline: true }
                );
        } else {
            endEmbed.setColor('#ED4245')
                .setTitle(lang === 'fr' ? '💀 ÉCHEC' : '💀 FAILED')
                .setDescription(`${lang === 'fr' ? 'Mot' : 'Word'}: **${targetWord}**`)
                .addFields(
                    { name: `💰 ${t.balance}`, value: `${credits.toLocaleString()} ${t.coins}`, inline: true },
                    { name: `📈 ${t.rank}`, value: `${rank.emoji} ${rank.title[lang]} (${t.level} ${level})`, inline: true }
                );
        }
        await gameMsg.edit({ embeds: [endEmbed] });
    });
}

// ================= GAME STATS =================
async function showGameStats(client, message, userData, lang) {
    const t = texts[lang];
    const version = client.version || '1.3.2';
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(message.author.id);
    const xp = user?.xp || 0;
    const level = calculateLevel(xp);
    const rank = getRank(level);
    const progress = calculateProgress(xp, level);
    const credits = user?.credits || 0;
    
    const gamesPlayed = user?.games_played || 0;
    const gamesWon = user?.games_won || 0;
    const totalWinnings = user?.total_winnings || 0;
    const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
    const progressBar = createProgressBar(progress.percentage, 15);
    
    const embed = new EmbedBuilder()
        .setColor(rank.color)
        .setAuthor({ name: `📊 ${t.gameStats}`, iconURL: message.author.displayAvatarURL() })
        .setTitle(`${rank.emoji} ${rank.title[lang]}`)
        .setDescription(`**Agent:** ${message.author.username}`)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 512 }))
        .addFields(
            { name: `💰 ${t.balance}`, value: `\`${credits.toLocaleString()} 🪙\``, inline: true },
            { name: `📈 ${t.progress}`, value: `\`\`\`yaml\n${t.level}: ${level}\n${t.xp}: ${xp.toLocaleString()}\n${t.progress}: ${progress.percentage.toFixed(1)}%\n${progressBar}\`\`\``, inline: false },
            { name: `🎮 ${t.gameStats}`, value: `\`\`\`yaml\n${t.played}: ${gamesPlayed}\n${t.won}: ${gamesWon}\n${t.winRate}: ${winRate}%\nGains: ${totalWinnings.toLocaleString()} ${t.coins}\`\`\``, inline: false }
        )
        .setFooter({ text: `.game rank pour plus de détails • v${version}`, iconURL: client.user.displayAvatarURL() })
        .setTimestamp();
    
    message.reply({ embeds: [embed] });
}

// ================= LEADERBOARD =================
async function showGameLeaderboard(client, message, type = 'wins', lang) {
    const t = texts[lang];
    const version = client.version || '1.3.2';
    let orderBy = '';
    let title = '';
    let icon = '';
    let color = '';
    
    switch(type) {
        case 'wins':
        case 'win':
        case 'victoires':
            orderBy = 'games_won DESC';
            title = t.mostWins;
            icon = '🏆';
            color = '#FEE75C';
            break;
        case 'winnings':
        case 'money':
        case 'rich':
        case 'gains':
            orderBy = 'total_winnings DESC';
            title = t.richest;
            icon = '💰';
            color = '#57F287';
            break;
        case 'credits':
        case 'balance':
        case 'riche':
            orderBy = 'credits DESC';
            title = t.richest;
            icon = '💰';
            color = '#57F287';
            break;
        case 'level':
        case 'xp':
        case 'rank':
            orderBy = 'xp DESC';
            title = t.bestRanks;
            icon = '📈';
            color = '#9b59b6';
            break;
        default:
            orderBy = 'games_won DESC';
            title = t.mostWins;
            icon = '🏆';
            color = '#FEE75C';
    }
    
    const topPlayers = db.prepare(`SELECT id, username, games_played, games_won, total_winnings, credits, xp FROM users WHERE games_played > 0 ORDER BY ${orderBy} LIMIT 10`).all();
    
    if (topPlayers.length === 0) {
        return message.reply(lang === 'fr' ? '📊 Aucune donnée disponible. Commencez à jouer!' : '📊 No data available. Start playing!');
    }
    
    const leaderboardText = topPlayers.map((player, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
        const level = calculateLevel(player.xp || 0);
        const rank = getRank(level);
        
        if (type === 'credits' || type === 'balance' || type === 'riche') {
            return `${medal} **${player.username}** • 💰 ${(player.credits || 0).toLocaleString()} 🪙 • ${rank.emoji} ${t.level} ${level}`;
        } else if (type === 'level' || type === 'xp' || type === 'rank') {
            return `${medal} **${player.username}** • ${rank.emoji} ${t.level} ${level} (${player.xp?.toLocaleString() || 0} XP)`;
        } else if (type === 'wins' || type === 'win' || type === 'victoires') {
            const winRate = Math.round((player.games_won / player.games_played) * 100);
            return `${medal} **${player.username}** • 🏆 ${player.games_won} ${t.won} (${winRate}% WR) • ${rank.emoji} ${t.level} ${level}`;
        } else {
            return `${medal} **${player.username}** • 💰 ${(player.total_winnings || 0).toLocaleString()} ${t.coins} • ${rank.emoji} ${t.level} ${level}`;
        }
    }).join('\n');
    
    const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: `${icon} ${t.leaderboard}: ${title}`, iconURL: client.user.displayAvatarURL() })
        .setTitle(lang === 'fr' ? '═ CLASSEMENT ARCADE NEURALE ═' : '═ NEURAL ARCADE LEADERBOARD ═')
        .setDescription(`\`\`\`yaml\n${leaderboardText}\`\`\``)
        .setFooter({ text: `.game rank pour votre profil • v${version}` })
        .setTimestamp();
    
    message.reply({ embeds: [embed] });
}

// ================= HELPER FUNCTIONS =================
function drawCard() {
    const cards = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    return cards[Math.floor(Math.random() * cards.length)];
}

function calculateHand(hand) {
    let sum = 0;
    let aces = 0;
    
    for (const card of hand) {
        if (card === 'J' || card === 'Q' || card === 'K') sum += 10;
        else if (card === 'A') aces++;
        else sum += parseInt(card);
    }
    
    for (let i = 0; i < aces; i++) {
        if (sum + 11 <= 21) sum += 11;
        else sum += 1;
    }
    
    return sum;
}