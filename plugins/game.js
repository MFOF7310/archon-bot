const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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
    const xpForCurrentLevel = Math.pow((currentLevel - 1) / 0.1, 2);
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

const texts = {
    fr: {
        win: "🎉 VICTOIRE!", lose: "💔 DÉFAITE", tie: "🤝 ÉGALITÉ",
        levelUp: "🎉 **PROMOTION D'AGENT!** 🎉",
        congratulations: "Félicitations", newRank: "vient d'être promu au grade de",
        xpGain: "XP gagnés", coins: "🪙",
        played: "Parties", won: "Victoires", winRate: "Taux",
        rank: "Rang", level: "Niveau", xp: "XP", progress: "Progression", nextLevel: "Prochain niveau",
        invalidGuess: "Prédiction invalide!", guessHint: "Devinez", attemptsLeft: "essai(s) restant(s)",
        timeOut: "Temps écoulé!", notYourMenu: "Ce menu ne vous est pas destiné.",
        gameStats: "STATISTIQUES DE L'AGENT", agentProfile: "DOSSIER D'AGENT",
        leaderboard: "CLASSEMENT", neuralArcade: "ARCADE NEURALE",
        useCommand: "Utilisez `.game dice [1-6]` pour parier!",
        insufficientCredits: (bet, balance) => `❌ **Crédits insuffisants!**\n└─ Requis: \`${bet.toLocaleString()}\` 🪙\n└─ Votre solde: \`${balance.toLocaleString()}\` 🪙\n💡 Utilisez \`.daily\` pour réclamer!`,
        balance: "Solde actuel",
        triviaNote: "🧠 **TRIVIA DISPONIBLE!** Utilisez `.trivia` pour jouer au quiz!",
        gameExpired: "⏰ **Session expirée!** La partie a été annulée par manque d'activité.",
        highStakes: (mult) => `🔥 **MODE HAUTS RISQUES ACTIVÉ!** Multiplicateur: ${mult}x`,
        vipMode: "👑 **MODE VIP ARCHITECTE!** Récompenses doublées!"
    },
    en: {
        win: "🎉 VICTORY!", lose: "💔 DEFEAT", tie: "🤝 TIE",
        levelUp: "🎉 **AGENT PROMOTION!** 🎉",
        congratulations: "Congratulations", newRank: "has been promoted to",
        xpGain: "XP earned", coins: "🪙",
        played: "Games", won: "Wins", winRate: "Rate",
        rank: "Rank", level: "Level", xp: "XP", progress: "Progress", nextLevel: "Next level",
        invalidGuess: "Invalid guess!", guessHint: "Guess", attemptsLeft: "attempt(s) left",
        timeOut: "Time's up!", notYourMenu: "This menu is not for you.",
        gameStats: "AGENT GAME STATISTICS", agentProfile: "AGENT DOSSIER",
        leaderboard: "LEADERBOARD", neuralArcade: "NEURAL ARCADE",
        useCommand: "Use `.game dice [1-6]` to bet!",
        insufficientCredits: (bet, balance) => `❌ **Insufficient credits!**\n└─ Required: \`${bet.toLocaleString()}\` 🪙\n└─ Your balance: \`${balance.toLocaleString()}\` 🪙\n💡 Use \`.daily\` to claim!`,
        balance: "Current balance",
        triviaNote: "🧠 **TRIVIA AVAILABLE!** Use `.trivia` to play the quiz!",
        gameExpired: "⏰ **Session expired!** Game cancelled due to inactivity.",
        highStakes: (mult) => `🔥 **HIGH STAKES MODE ACTIVE!** Multiplier: ${mult}x`,
        vipMode: "👑 **ARCHITECT VIP MODE!** Double rewards!"
    }
};

// ================= MEMORY-SAFE GAME STORAGE =================
const activeGames = new Map();
const GAME_SESSION_TTL = 300000;

setInterval(() => {
    const now = Date.now();
    for (const [userId, game] of activeGames.entries()) {
        if (now - game.lastActivity > GAME_SESSION_TTL) {
            activeGames.delete(userId);
            console.log(`[GAME CLEANUP] Removed stale session for ${userId}`);
        }
    }
}, 60000);

function checkAndAnnounceLevelUp(oldXp, newXp, userId, username, channel, lang, client) {
    const oldLevel = calculateLevel(oldXp);
    const newLevel = calculateLevel(newXp);
    if (newLevel > oldLevel) {
        const rank = getRank(newLevel);
        const t = texts[lang];
        const version = client.version || '1.6.0';
        const guildName = channel.guild.name.toUpperCase();
        const guildIcon = channel.guild.iconURL() || client.user.displayAvatarURL();
        
        const levelUpEmbed = new EmbedBuilder()
            .setColor(rank.color)
            .setAuthor({ name: t.neuralArcade, iconURL: client.user.displayAvatarURL() })
            .setTitle(t.levelUp)
            .setDescription(`${t.congratulations} **${username}**! ${t.newRank} **${rank.emoji} ${rank.title[lang]}** (${t.level} ${newLevel})`)
            .addFields(
                { name: lang === 'fr' ? "📊 PROGRESSION" : "📊 PROGRESS", value: `${t.level} ${oldLevel} → ${t.level} ${newLevel}`, inline: true },
                { name: lang === 'fr' ? "🎯 RANG ATTEINT" : "🎯 RANK ATTAINED", value: `${rank.emoji} ${rank.title[lang]}`, inline: true }
            )
            .setFooter({ 
                text: `${guildName} • ${lang === 'fr' ? "Continuez à jouer pour monter en grade!" : "Keep playing to climb the ranks!"} • v${version}`,
                iconURL: guildIcon
            })
            .setTimestamp();
        channel.send({ embeds: [levelUpEmbed] });
        return true;
    }
    return false;
}

function calculateDynamicBet(baseBet, userLevel, isVIP = false) {
    const levelMultiplier = 1 + Math.min((userLevel - 1) * 0.04, 2);
    const vipMultiplier = isVIP ? 2 : 1;
    return Math.floor(baseBet * levelMultiplier * vipMultiplier);
}

function calculateDynamicReward(baseReward, userLevel, isVIP = false) {
    const levelMultiplier = 1 + Math.min((userLevel - 1) * 0.05, 2.5);
    const vipMultiplier = isVIP ? 2 : 1;
    return Math.floor(baseReward * levelMultiplier * vipMultiplier);
}

function updateGameStats(userId, won, winnings, channel, username, lang, client) {
    const userData = client.getUserData ? client.getUserData(userId) : null;
    if (!userData) return 0;

    const oldXp = userData.xp || 0;
    const currentCredits = userData.credits || 0;
    
    let actualWinnings = winnings;
    if (winnings < 0 && Math.abs(winnings) > currentCredits) {
        actualWinnings = -currentCredits;
    }
    
    const isVIP = userData.level >= 51 || userId === process.env.OWNER_ID;
    const xpGain = won ? (isVIP ? 200 : 100) : 25;
    const newXp = oldXp + xpGain;

    if (client.queueUserUpdate) {
        client.queueUserUpdate(userId, {
            games_played: (userData.games_played || 0) + 1,
            games_won: (userData.games_won || 0) + (won ? 1 : 0),
            total_winnings: (userData.total_winnings || 0) + actualWinnings,
            credits: currentCredits + actualWinnings,
            xp: newXp,
            level: calculateLevel(newXp),
            username: username
        });
    }

    checkAndAnnounceLevelUp(oldXp, newXp, userId, username, channel, lang, client);
    
    return actualWinnings;
}

function hasEnoughCredits(client, userId, betAmount) {
    const userData = client.getUserData ? client.getUserData(userId) : null;
    return (userData?.credits || 0) >= betAmount;
}

module.exports = {
    name: 'game',
    aliases: ['play', 'minigame', 'arcade', 'jeu', 'jeux'],
    description: '🎮 Launch neural arcade games.',
    category: 'GAMING',
    
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, 'en')
            : 'en';
            
        const subCommand = args[0]?.toLowerCase();
        
        if (!subCommand || subCommand === 'menu') {
            return showGameMenu(client, message, lang, serverSettings, usedCommand, db);
        }
        
        switch(subCommand) {
            case 'dice': case 'dé': return playDiceGame(client, message, args[1], lang, db);
            case 'coinflip': case 'cf': case 'pileface': return playCoinFlip(client, message, args[1], lang, db);
            case 'guess': case 'number': case 'devine': return playNumberGuess(client, message, lang, db);
            case 'slots': case 'slot': case 'machine': return playSlots(client, message, lang, db);
            case 'blackjack': case 'bj': case 'vingtetun': return playBlackjack(client, message, lang, db);
            case 'rps': case 'rockpaperscissors': case 'pfc': return playRPS(client, message, args[1], lang, db);
            case 'hangman': case 'hm': case 'pendu': return playHangman(client, message, lang, db);
            case 'leaderboard': case 'lb': case 'classement': return showGameLeaderboard(client, message, args[1], lang, db);
            case 'stats': case 'statistiques': return showGameStats(client, message, lang, db);
            case 'rank': case 'rang': case 'profil': return showAgentProfile(client, message, lang, db);
            default:
                const t = texts[lang];
                const guildName = message.guild.name.toUpperCase();
                const guildIcon = message.guild.iconURL() || client.user.displayAvatarURL();
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff4757')
                    .setAuthor({ name: `ERREUR JEU: COMMANDE_INTROUVABLE`, iconURL: client.user.displayAvatarURL() })
                    .setDescription(`Jeu inconnu: \`${subCommand}\``)
                    .addFields({ name: '📜 JEUX DISPONIBLES', value: '`dice` • `coinflip` • `guess` • `slots` • `blackjack` • `rps` • `hangman` • `leaderboard` • `stats` • `rank`\n\n🧠 **`.trivia`** - Quiz de culture générale!' })
                    .setFooter({ text: `${guildName} • NEURAL ARCADE • v${client.version || '1.6.0'}`, iconURL: guildIcon });
                return message.reply({ embeds: [errorEmbed] });
        }
    }
};

// ================= GAME MENU =================
async function showGameMenu(client, message, lang, serverSettings, usedCommand, db) {
    const t = texts[lang];
    const version = client.version || '1.6.0';
    const guildName = message.guild.name.toUpperCase();
    const guildIcon = message.guild.iconURL() || client.user.displayAvatarURL();
    
    const userData = client.getUserData ? client.getUserData(message.author.id) : null;
    const xp = userData?.xp || 0;
    const level = userData?.level || calculateLevel(xp);
    const rank = getRank(level);
    const progress = calculateProgress(xp, level);
    const progressBar = createProgressBar(progress.percentage);
    const credits = userData?.credits || 0;
    const isVIP = level >= 51 || message.author.id === process.env.OWNER_ID;
    
    const diceBet = calculateDynamicBet(100, level, isVIP);
    const coinflipBet = calculateDynamicBet(100, level, isVIP);
    const slotsBet = calculateDynamicBet(100, level, isVIP);
    const blackjackBet = calculateDynamicBet(200, level, isVIP);
    
    const menuEmbed = new EmbedBuilder()
        .setColor(rank.color)
        .setAuthor({ name: `🎮 ${t.neuralArcade} • ${lang === 'fr' ? 'SÉLECTION DES JEUX' : 'GAME SELECTION'}`, iconURL: client.user.displayAvatarURL() })
        .setTitle(lang === 'fr' ? '═ SUITE DE JEUX ARCHITECT ═' : '═ ARCHITECT GAME SUITE ═')
        .setDescription(lang === 'fr' 
            ? `**Agent ${message.author.username}** • ${rank.emoji} ${rank.title[lang]}\n${isVIP ? t.vipMode + '\n' : ''}Sélectionnez un jeu pour tester vos réflexes.`
            : `**Agent ${message.author.username}** • ${rank.emoji} ${rank.title[lang]}\n${isVIP ? t.vipMode + '\n' : ''}Select a game to test your reflexes.`)
        .addFields(
            { name: '🎲 DÉ ROULETTE', value: `\`.game dice [1-6]\`\n**Gain:** 5x • Mise: ${diceBet} 🪙`, inline: true },
            { name: '🪙 PILE OU FACE', value: `\`.game coinflip [pile/face]\`\n**Gain:** 2x • Mise: ${coinflipBet} 🪙`, inline: true },
            { name: '🔢 DEVINE LE NOMBRE', value: `\`.game guess\`\n**Gain:** Jusqu'à 200x • Mise: 100 🪙`, inline: true },
            { name: '🎰 MACHINE À SOUS', value: `\`.game slots\`\n**Gain:** Jusqu'à 500x • Mise: ${slotsBet} 🪙`, inline: true },
            { name: '🃏 BLACKJACK', value: `\`.game blackjack\`\n**Gain:** 2x • Mise: ${blackjackBet} 🪙`, inline: true },
            { name: '✊ PFC DUEL', value: `\`.game rps [pierre/feuille/ciseaux]\`\n**Gain:** 2x • Mise: 100 🪙`, inline: true },
            { name: '🪑 PENDU', value: `\`.game hangman\`\n**Gain:** 5x • Mise: 200 🪙`, inline: true },
            { name: '🧠 TRIVIA CULTURE', value: '`.trivia`\n**Gain:** Variable • Mise: 50-200 🪙', inline: true },
            { name: `📊 ${t.gameStats}`, value: `\`\`\`yaml\n💰 ${t.balance}: ${credits.toLocaleString()} 🪙\n${rank.emoji} Grade: ${rank.title[lang]}\n${t.level}: ${level}\n${t.xp}: ${xp.toLocaleString()}\n${t.progress}: ${progress.percentage.toFixed(1)}%\n${progressBar}\n${t.won}: ${userData?.games_won || 0}/${userData?.games_played || 0}\`\`\``, inline: false },
            { name: '💡 ASTUCE', value: isVIP ? '👑 **MODE VIP:** Récompenses doublées et mises adaptées à votre rang!' : t.triviaNote, inline: false }
        )
        .setFooter({ text: `${guildName} • NEURAL ARCADE • v${version}`, iconURL: guildIcon })
        .setTimestamp();
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('game_dice').setLabel(lang === 'fr' ? '🎲 DÉ' : '🎲 DICE').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('game_coinflip').setLabel(lang === 'fr' ? '🪙 PILE/FACE' : '🪙 COIN FLIP').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('game_slots').setLabel('🎰 SLOTS').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('game_blackjack').setLabel('🃏 BLACKJACK').setStyle(ButtonStyle.Secondary)
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('game_rps').setLabel(lang === 'fr' ? '✊ PFC' : '✊ RPS').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('game_guess').setLabel(lang === 'fr' ? '🔢 DEVINE' : '🔢 GUESS').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('game_hangman').setLabel(lang === 'fr' ? '🪑 PENDU' : '🪑 HANGMAN').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('goto_trivia').setLabel(lang === 'fr' ? '🧠 TRIVIA' : '🧠 TRIVIA').setStyle(ButtonStyle.Success)
    );
    const row3 = new ActionRowBuilder().addComponents(
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
            case 'game_dice': await playDiceGame(client, message, null, lang, db); break;
            case 'game_coinflip': await playCoinFlip(client, message, null, lang, db); break;
            case 'game_slots': await playSlots(client, message, lang, db); break;
            case 'game_blackjack': await playBlackjack(client, message, lang, db); break;
            case 'game_rps': await playRPS(client, message, null, lang, db); break;
            case 'game_guess': await playNumberGuess(client, message, lang, db); break;
            case 'game_hangman': await playHangman(client, message, lang, db); break;
            case 'goto_trivia': 
                const triviaCmd = client.commands.get('trivia');
                if (triviaCmd) {
                    await triviaCmd.run(client, message, [], db, serverSettings, usedCommand);
                }
                break;
            case 'game_stats': await showGameStats(client, message, lang, db); break;
            case 'game_leaderboard': await showGameLeaderboard(client, message, null, lang, db); break;
            case 'game_rank': await showAgentProfile(client, message, lang, db); break;
        }
        collector.stop();
    });
    
    collector.on('end', async () => {
        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('disabled').setLabel(lang === 'fr' ? 'Session expirée' : 'Session expired').setStyle(ButtonStyle.Secondary).setDisabled(true)
        );
        await reply.edit({ components: [disabledRow] }).catch(() => {});
    });
}

// ================= DICE GAME =================
async function playDiceGame(client, message, guess, lang, db) {
    const t = texts[lang];
    const userData = client.getUserData(message.author.id);
    const level = userData?.level || 1;
    const isVIP = level >= 51 || message.author.id === process.env.OWNER_ID;
    const baseBet = 100;
    const bet = calculateDynamicBet(baseBet, level, isVIP);
    
    const guildName = message.guild.name.toUpperCase();
    const guildIcon = message.guild.iconURL() || client.user.displayAvatarURL();
    
    if (!hasEnoughCredits(client, message.author.id, bet)) {
        const balance = userData?.credits || 0;
        return message.reply({ embeds: [new EmbedBuilder().setColor('#ED4245').setDescription(t.insufficientCredits(bet, balance))] });
    }
    
    if (guess === null || guess === undefined) {
        return message.reply({ embeds: [new EmbedBuilder().setColor('#ff4757').setDescription(t.useCommand)] });
    }
    
    const userGuess = parseInt(guess);
    if (isNaN(userGuess) || userGuess < 1 || userGuess > 6) {
        const embed = new EmbedBuilder().setColor('#ff4757').setAuthor({ name: lang === 'fr' ? '🎲 DÉ ROULETTE' : '🎲 DICE ROULETTE', iconURL: message.author.displayAvatarURL() }).setDescription(`❌ **${t.invalidGuess}** ${lang === 'fr' ? 'Nombre entre 1-6.' : 'Number between 1-6.'}`);
        return message.reply({ embeds: [embed] });
    }
    
    const roll = Math.floor(Math.random() * 6) + 1;
    const won = userGuess === roll;
    const baseReward = bet * 5;
    const winnings = won ? calculateDynamicReward(baseReward, level, isVIP) : -bet;
    const actualWinnings = updateGameStats(message.author.id, won, winnings, message.channel, message.author.username, lang, client);
    
    const updatedUser = client.getUserData(message.author.id);
    const newLevel = updatedUser?.level || calculateLevel(updatedUser?.xp || 0);
    const rank = getRank(newLevel);
    const credits = updatedUser?.credits || 0;
    const version = client.version || '1.6.0';
    
    const embed = new EmbedBuilder()
        .setColor(won ? '#57F287' : '#ED4245')
        .setAuthor({ name: lang === 'fr' ? '🎲 DÉ ROULETTE' : '🎲 DICE ROULETTE', iconURL: message.author.displayAvatarURL() })
        .setTitle(won ? t.win : t.lose)
        .setDescription(lang === 'fr' ? `**Vous avez prédit:** \`${userGuess}\`\n**Le dé a montré:** \`${roll}\`` : `**You predicted:** \`${userGuess}\`\n**The die showed:** \`${roll}\``)
        .addFields(
            { name: '💰 RÉSULTAT', value: won ? `+${actualWinnings.toLocaleString()} ${t.coins}` : `${actualWinnings.toLocaleString()} ${t.coins}`, inline: true },
            { name: `💰 ${t.balance}`, value: `${credits.toLocaleString()} ${t.coins}`, inline: true },
            { name: `📈 ${t.rank}`, value: `${rank.emoji} ${rank.title[lang]} (${t.level} ${newLevel})`, inline: true }
        )
        .setFooter({ text: `${guildName} • ${isVIP ? '👑 VIP MODE • ' : ''}NEURAL ARCADE • v${version}`, iconURL: guildIcon });
    
    message.reply({ embeds: [embed] });
}

// ================= COIN FLIP =================
async function playCoinFlip(client, message, choice, lang, db) {
    const t = texts[lang];
    const userData = client.getUserData(message.author.id);
    const level = userData?.level || 1;
    const isVIP = level >= 51 || message.author.id === process.env.OWNER_ID;
    const baseBet = 100;
    const bet = calculateDynamicBet(baseBet, level, isVIP);
    
    const guildName = message.guild.name.toUpperCase();
    const guildIcon = message.guild.iconURL() || client.user.displayAvatarURL();
    
    if (!hasEnoughCredits(client, message.author.id, bet)) {
        const balance = userData?.credits || 0;
        return message.reply({ embeds: [new EmbedBuilder().setColor('#ED4245').setDescription(t.insufficientCredits(bet, balance))] });
    }
    
    if (!choice || !['heads', 'tails', 'h', 't', 'pile', 'face', 'p', 'f'].includes(choice.toLowerCase())) {
        const embed = new EmbedBuilder().setColor('#ff4757').setAuthor({ name: '🪙 PILE OU FACE', iconURL: message.author.displayAvatarURL() }).setDescription(`❌ ${lang === 'fr' ? 'Veuillez spécifier pile ou face!' : 'Please specify heads or tails!'}`).addFields({ name: lang === 'fr' ? '📝 UTILISATION' : '📝 USAGE', value: '`.game coinflip [pile/face]`\nExample: `.game coinflip pile`' });
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
    const baseReward = bet;
    const winnings = won ? calculateDynamicReward(baseReward, level, isVIP) : -bet;
    const actualWinnings = updateGameStats(message.author.id, won, winnings, message.channel, message.author.username, lang, client);
    
    const updatedUser = client.getUserData(message.author.id);
    const newLevel = updatedUser?.level || calculateLevel(updatedUser?.xp || 0);
    const rank = getRank(newLevel);
    const credits = updatedUser?.credits || 0;
    const version = client.version || '1.6.0';
    
    const resultFr = result === 'heads' ? 'pile' : 'face';
    const choiceFr = normalizedChoice === 'heads' ? 'pile' : 'face';
    
    const embed = new EmbedBuilder()
        .setColor(won ? '#57F287' : '#ED4245')
        .setAuthor({ name: '🪙 PILE OU FACE', iconURL: message.author.displayAvatarURL() })
        .setTitle(won ? (lang === 'fr' ? '✨ BONNE PRÉDICTION!' : '✨ GOOD PREDICTION!') : (lang === 'fr' ? '❌ MAUVAISE PRÉDICTION' : '❌ WRONG PREDICTION'))
        .setDescription(lang === 'fr' ? `**Vous avez choisi:** \`${choiceFr}\`\n**La pièce est tombée sur:** \`${resultFr}\`` : `**You chose:** \`${choiceFr}\`\n**The coin landed on:** \`${resultFr}\``)
        .addFields(
            { name: '💰 RÉSULTAT', value: won ? `+${actualWinnings.toLocaleString()} ${t.coins}` : `${actualWinnings.toLocaleString()} ${t.coins}`, inline: true },
            { name: `💰 ${t.balance}`, value: `${credits.toLocaleString()} ${t.coins}`, inline: true },
            { name: `📈 ${t.rank}`, value: `${rank.emoji} ${rank.title[lang]} (${t.level} ${newLevel})`, inline: true }
        )
        .setFooter({ text: `${guildName} • ${isVIP ? '👑 VIP MODE • ' : ''}NEURAL ARCADE • v${version}`, iconURL: guildIcon });
    
    message.reply({ embeds: [embed] });
}

// ================= SLOT MACHINE =================
async function playSlots(client, message, lang, db) {
    const t = texts[lang];
    const userData = client.getUserData(message.author.id);
    const level = userData?.level || 1;
    const isVIP = level >= 51 || message.author.id === process.env.OWNER_ID;
    const baseBet = 100;
    const bet = calculateDynamicBet(baseBet, level, isVIP);
    
    const guildName = message.guild.name.toUpperCase();
    const guildIcon = message.guild.iconURL() || client.user.displayAvatarURL();
    
    if (!hasEnoughCredits(client, message.author.id, bet)) {
        const balance = userData?.credits || 0;
        return message.reply({ embeds: [new EmbedBuilder().setColor('#ED4245').setDescription(t.insufficientCredits(bet, balance))] });
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
    const baseReward = bet * multiplier;
    const winnings = won ? calculateDynamicReward(baseReward, level, isVIP) : -bet;
    const actualWinnings = updateGameStats(message.author.id, won, winnings, message.channel, message.author.username, lang, client);
    
    const updatedUser = client.getUserData(message.author.id);
    const newLevel = updatedUser?.level || calculateLevel(updatedUser?.xp || 0);
    const rank = getRank(newLevel);
    const credits = updatedUser?.credits || 0;
    const version = client.version || '1.6.0';
    
    const embed = new EmbedBuilder()
        .setColor(won ? '#57F287' : '#ED4245')
        .setAuthor({ name: lang === 'fr' ? '🎰 MACHINE À SOUS' : '🎰 SLOT MACHINE', iconURL: message.author.displayAvatarURL() })
        .setTitle(won ? (lang === 'fr' ? '✨ JACKPOT!' : '✨ JACKPOT!') : (lang === 'fr' ? '💔 PAS DE CHANCE' : '💔 NO LUCK'))
        .setDescription(`\`\`\`\n┌─────┬─────┬─────┐\n│  ${reels[0]}  │  ${reels[1]}  │  ${reels[2]}  │\n└─────┴─────┴─────┘\n\`\`\``)
        .addFields(
            { name: lang === 'fr' ? '🎁 GAIN' : '🎁 WINNING', value: won ? `+${actualWinnings.toLocaleString()} ${t.coins} (${multiplier}x${isVIP ? ' VIP' : ''})` : `${actualWinnings.toLocaleString()} ${t.coins}`, inline: true },
            { name: `💰 ${t.balance}`, value: `${credits.toLocaleString()} ${t.coins}`, inline: true },
            { name: `📈 ${t.rank}`, value: `${rank.emoji} ${rank.title[lang]} (${t.level} ${newLevel})`, inline: true }
        )
        .setFooter({ text: `${guildName} • ${isVIP ? '👑 VIP MODE • ' : ''}NEURAL ARCADE • v${version}`, iconURL: guildIcon });
    
    message.reply({ embeds: [embed] });
}

// ================= BLACKJACK (CORRIGÉ) =================
async function playBlackjack(client, message, lang, db) {
    const t = texts[lang];
    const userId = message.author.id;
    const userData = client.getUserData(userId);
    const level = userData?.level || 1;
    const isVIP = level >= 51 || userId === process.env.OWNER_ID;
    const baseBet = 200;
    const bet = calculateDynamicBet(baseBet, level, isVIP);
    
    const guildName = message.guild.name.toUpperCase();
    const guildIcon = message.guild.iconURL() || client.user.displayAvatarURL();
    const version = client.version || '1.6.0';
    
    if (!hasEnoughCredits(client, userId, bet)) {
        const balance = userData?.credits || 0;
        return message.reply({ embeds: [new EmbedBuilder().setColor('#ED4245').setDescription(t.insufficientCredits(bet, balance))] });
    }
    
    if (activeGames.has(userId)) {
        return message.reply({ content: `❌ ${lang === 'fr' ? 'Vous avez déjà une partie en cours!' : 'You already have a game in progress!'}`, ephemeral: true });
    }
    
    if (client.queueUserUpdate) {
        client.queueUserUpdate(userId, {
            credits: (userData.credits || 0) - bet,
            username: message.author.username
        });
    }
    
    let playerHand = [drawCard(), drawCard()];
    let dealerHand = [drawCard(), drawCard()];
    let gameOver = false;
    let playerBusted = false;
    
    activeGames.set(userId, { type: 'blackjack', lastActivity: Date.now(), bet: bet });

    const generateEmbed = (status = lang === 'fr' ? 'À votre tour, Agent.' : 'Your turn, Agent.') => {
        const pScore = calculateHand(playerHand);
        const dScore = gameOver ? calculateHand(dealerHand) : '??';
        const dDisplay = gameOver ? dealerHand.join(' ') : `${dealerHand[0]} 🃟`;
        const currentUser = client.getUserData(userId);
        const credits = currentUser?.credits || 0;
        
        return new EmbedBuilder()
            .setColor(gameOver ? '#00fbff' : '#f1c40f')
            .setAuthor({ name: lang === 'fr' ? '🃏 BLACKJACK NEURAL' : '🃏 NEURAL BLACKJACK', iconURL: message.author.displayAvatarURL() })
            .setTitle(lang === 'fr' ? '═ DUEL DE DONNÉES À HAUT RISQUE ═' : '═ HIGH-RISK DATA DUEL ═')
            .setDescription(`**Status:** ${status}${isVIP ? '\n👑 **VIP MODE ACTIF**' : ''}`)
            .addFields(
                { name: lang === 'fr' ? '🎴 VOTRE MAIN' : '🎴 YOUR HAND', value: `\`${playerHand.join(' ')}\` \n**Score:** ${pScore}`, inline: true },
                { name: lang === 'fr' ? '🃟 MAIN DU CROUPIER' : '🃟 DEALER HAND', value: `\`${dDisplay}\` \n**Score:** ${dScore}`, inline: true },
                { name: `💰 ${t.balance}`, value: `${credits.toLocaleString()} 🪙`, inline: true }
            )
            .setFooter({ text: `${guildName} • ${isVIP ? '👑 VIP • ' : ''}NEURAL ARCADE • v${version}`, iconURL: guildIcon });
    };

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bj_hit').setLabel(lang === 'fr' ? 'PIOCHE' : 'HIT').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('bj_stand').setLabel(lang === 'fr' ? 'RESTE' : 'STAND').setStyle(ButtonStyle.Secondary)
    );

    const gameMsg = await message.reply({ embeds: [generateEmbed()], components: [row] });
    const collector = gameMsg.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 60000 });

    collector.on('collect', async (i) => {
        const game = activeGames.get(userId);
        if (game) game.lastActivity = Date.now();
        
        // 🛡️ LA LIGNE CRITIQUE
        await i.deferUpdate().catch(() => {});
        
        if (i.customId === 'bj_hit') {
            playerHand.push(drawCard());
            const pScore = calculateHand(playerHand);
            if (pScore > 21) {
                playerBusted = true;
                gameOver = true;
                collector.stop('bust');
            } else {
                await i.editReply({ embeds: [generateEmbed()] }).catch(() => {});
            }
        } else {
            gameOver = true;
            collector.stop('stand');
        }
    });

    collector.on('end', async (collected, reason) => {
        activeGames.delete(userId);
        
        if (reason === 'time') {
            const timeoutEmbed = new EmbedBuilder()
                .setColor('#95a5a6')
                .setDescription(t.gameExpired)
                .setFooter({ text: `${guildName} • NEURAL ARCADE • v${version}`, iconURL: guildIcon });
            return gameMsg.edit({ embeds: [timeoutEmbed], components: [] });
        }
        
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
            result = lang === 'fr' ? '💀 DÉPASSEMENT!' : '💀 BUST!';
            winnings = 0;
        } else if (dScore > 21 || pScore > dScore) {
            result = lang === 'fr' ? '🎉 VICTOIRE!' : '🎉 VICTORY!';
            won = true;
            const baseReward = bet * 2;
            winnings = calculateDynamicReward(baseReward, level, isVIP);
        } else if (dScore > pScore) {
            result = lang === 'fr' ? '💔 DÉFAITE!' : '💔 DEFEAT!';
            winnings = 0;
        } else {
            result = lang === 'fr' ? '🤝 ÉGALITÉ!' : '🤝 TIE!';
            winnings = bet;
        }
        
        const actualWinnings = updateGameStats(userId, won, winnings, message.channel, message.author.username, lang, client);
        const updatedUser = client.getUserData(userId);
        const newLevel = updatedUser?.level || calculateLevel(updatedUser?.xp || 0);
        const rank = getRank(newLevel);
        const credits = updatedUser?.credits || 0;
        
        const finalEmbed = generateEmbed(result)
            .setColor(won ? '#57F287' : (winnings === bet ? '#FEE75C' : '#ED4245'))
            .addFields(
                { name: '💰 RÉSULTAT', value: `${actualWinnings > 0 ? '+' : ''}${actualWinnings.toLocaleString()} ${t.coins}`, inline: false },
                { name: `📈 ${t.rank}`, value: `${rank.emoji} ${rank.title[lang]} (${t.level} ${newLevel})`, inline: true }
            );
        await gameMsg.edit({ embeds: [finalEmbed], components: [] });
    });
}

// ================= ROCK PAPER SCISSORS =================
async function playRPS(client, message, choice, lang, db) {
    const t = texts[lang];
    const userData = client.getUserData(message.author.id);
    const level = userData?.level || 1;
    const isVIP = level >= 51 || message.author.id === process.env.OWNER_ID;
    const baseBet = 100;
    const bet = calculateDynamicBet(baseBet, level, isVIP);
    
    const guildName = message.guild.name.toUpperCase();
    const guildIcon = message.guild.iconURL() || client.user.displayAvatarURL();
    
    if (!hasEnoughCredits(client, message.author.id, bet)) {
        const balance = userData?.credits || 0;
        return message.reply({ embeds: [new EmbedBuilder().setColor('#ED4245').setDescription(t.insufficientCredits(bet, balance))] });
    }
    
    if (!choice || !['rock', 'paper', 'scissors', 'r', 'p', 's', 'pierre', 'feuille', 'ciseaux', 'pi', 'fe', 'ci'].includes(choice.toLowerCase())) {
        const embed = new EmbedBuilder().setColor('#ff4757').setAuthor({ name: lang === 'fr' ? '✊ PFC DUEL' : '✊ RPS DUEL', iconURL: message.author.displayAvatarURL() }).setDescription(`❌ ${lang === 'fr' ? 'Veuillez spécifier pierre, feuille ou ciseaux!' : 'Please specify rock, paper, or scissors!'}`).addFields({ name: lang === 'fr' ? '📝 UTILISATION' : '📝 USAGE', value: '`.game rps [pierre/feuille/ciseaux]`\nExample: `.game rps pierre`' });
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
        const baseReward = bet * 2;
        winnings = calculateDynamicReward(baseReward, level, isVIP);
    } else {
        result = t.lose;
        won = false;
        winnings = -bet;
    }
    
    const actualWinnings = updateGameStats(message.author.id, won, winnings, message.channel, message.author.username, lang, client);
    const updatedUser = client.getUserData(message.author.id);
    const newLevel = updatedUser?.level || calculateLevel(updatedUser?.xp || 0);
    const rank = getRank(newLevel);
    const credits = updatedUser?.credits || 0;
    const version = client.version || '1.6.0';
    
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
            { name: `📈 ${t.rank}`, value: `${rank.emoji} ${rank.title[lang]} (${t.level} ${newLevel})`, inline: true }
        )
        .setFooter({ text: `${guildName} • ${isVIP ? '👑 VIP MODE • ' : ''}NEURAL ARCADE • v${version}`, iconURL: guildIcon });
    
    message.reply({ embeds: [embed] });
}

// ================= NUMBER GUESS (CORRIGÉ) =================
async function playNumberGuess(client, message, lang, db) {
    const t = texts[lang];
    const userId = message.author.id;
    const userData = client.getUserData(userId);
    const level = userData?.level || 1;
    const isVIP = level >= 51 || userId === process.env.OWNER_ID;
    const baseBet = 100;
    const bet = calculateDynamicBet(baseBet, level, isVIP);
    
    const guildName = message.guild.name.toUpperCase();
    const guildIcon = message.guild.iconURL() || client.user.displayAvatarURL();
    const version = client.version || '1.6.0';
    
    if (!hasEnoughCredits(client, userId, bet)) {
        const balance = userData?.credits || 0;
        return message.reply({ embeds: [new EmbedBuilder().setColor('#ED4245').setDescription(t.insufficientCredits(bet, balance))] });
    }
    
    if (activeGames.has(userId)) {
        return message.reply({ content: `❌ ${lang === 'fr' ? 'Vous avez déjà une partie en cours!' : 'You already have a game in progress!'}`, ephemeral: true });
    }
    
    if (client.queueUserUpdate) {
        client.queueUserUpdate(userId, {
            credits: (userData.credits || 0) - bet,
            username: message.author.username
        });
    }
    
    const target = Math.floor(Math.random() * 100) + 1;
    let attempts = 0;
    const maxAttempts = isVIP ? 7 : 5;
    
    activeGames.set(userId, {
        type: 'guess', target, attempts, maxAttempts, bet, lastActivity: Date.now()
    });
    
    const multipliers = isVIP ? [300, 150, 75, 40, 20, 10, 5] : [200, 100, 50, 25, 10];
    
    const embed = new EmbedBuilder()
        .setColor('#00fbff')
        .setAuthor({ name: lang === 'fr' ? '🔢 DEVINE LE NOMBRE' : '🔢 GUESS THE NUMBER', iconURL: message.author.displayAvatarURL() })
        .setTitle(lang === 'fr' ? '🎯 DEVINEZ LE NOMBRE' : '🎯 GUESS THE NUMBER')
        .setDescription(lang === 'fr' 
            ? `Je pense à un nombre entre **1** et **100**.\nVous avez **${maxAttempts}** essais!${isVIP ? '\n👑 **VIP: +2 essais et récompenses doublées!**' : ''}`
            : `I'm thinking of a number between **1** and **100**.\nYou have **${maxAttempts}** attempts!${isVIP ? '\n👑 **VIP: +2 attempts and double rewards!**' : ''}`)
        .addFields(
            { name: lang === 'fr' ? '🏆 RÉCOMPENSE' : '🏆 REWARD', value: multipliers.map((m, i) => `${i+1} essai: ${m}x`).join(' • ') },
            { name: `💰 ${t.balance}`, value: `${(userData.credits - bet).toLocaleString()} 🪙`, inline: true }
        )
        .setFooter({ text: `${guildName} • ${lang === 'fr' ? 'Vous avez 60 secondes!' : 'You have 60 seconds!'} • v${version}`, iconURL: guildIcon });
    
    await message.reply({ embeds: [embed] });
    
    const filter = m => m.author.id === userId && !isNaN(parseInt(m.content));
    const collector = message.channel.createMessageCollector({ filter, time: 60000, max: maxAttempts });
    
    collector.on('collect', async (msg) => {
        const game = activeGames.get(userId);
        if (!game) return;
        
        game.lastActivity = Date.now();
        game.attempts++;
        const guess = parseInt(msg.content);
        
        if (guess === game.target) {
            const multiplier = multipliers[game.attempts - 1];
            const baseReward = game.bet * multiplier;
            const winnings = calculateDynamicReward(baseReward, level, isVIP);
            updateGameStats(userId, true, winnings, message.channel, message.author.username, lang, client);
            activeGames.delete(userId);
            collector.stop();
            
            const updatedUser = client.getUserData(userId);
            const newLevel = updatedUser?.level || calculateLevel(updatedUser?.xp || 0);
            const rank = getRank(newLevel);
            const credits = updatedUser?.credits || 0;
            
            const winEmbed = new EmbedBuilder()
                .setColor('#57F287')
                .setAuthor({ name: lang === 'fr' ? '🔢 DEVINE LE NOMBRE' : '🔢 GUESS THE NUMBER', iconURL: message.author.displayAvatarURL() })
                .setTitle(lang === 'fr' ? '🎉 DEVINETTE PARFAITE!' : '🎉 PERFECT GUESS!')
                .setDescription(lang === 'fr' ? `**Le nombre était:** \`${game.target}\`\n**Trouvé en:** \`${game.attempts}\` essai(s)` : `**The number was:** \`${game.target}\`\n**Found in:** \`${game.attempts}\` attempt(s)`)
                .addFields(
                    { name: '💰 RÉCOMPENSE', value: `+${winnings.toLocaleString()} ${t.coins} (${multiplier}x${isVIP ? ' VIP' : ''})`, inline: true },
                    { name: `💰 ${t.balance}`, value: `${credits.toLocaleString()} ${t.coins}`, inline: true },
                    { name: `📈 ${t.rank}`, value: `${rank.emoji} ${rank.title[lang]} (${t.level} ${newLevel})`, inline: true }
                )
                .setFooter({ text: `${guildName} • NEURAL ARCADE • v${version}`, iconURL: guildIcon });
            
            await message.reply({ embeds: [winEmbed] });
        } else if (game.attempts >= game.maxAttempts) {
            updateGameStats(userId, false, 0, message.channel, message.author.username, lang, client);
            activeGames.delete(userId);
            collector.stop();
            
            const updatedUser = client.getUserData(userId);
            const credits = updatedUser?.credits || 0;
            
            const loseEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setAuthor({ name: lang === 'fr' ? '🔢 DEVINE LE NOMBRE' : '🔢 GUESS THE NUMBER', iconURL: message.author.displayAvatarURL() })
                .setTitle(lang === 'fr' ? '💔 PARTIE TERMINÉE' : '💔 GAME OVER')
                .setDescription(lang === 'fr' ? `**Le nombre était:** \`${game.target}\`` : `**The number was:** \`${game.target}\``)
                .addFields(
                    { name: '💰 RÉSULTAT', value: `-${game.bet} ${t.coins}`, inline: true },
                    { name: `💰 ${t.balance}`, value: `${credits.toLocaleString()} ${t.coins}`, inline: true }
                )
                .setFooter({ text: `${guildName} • NEURAL ARCADE • v${version}`, iconURL: guildIcon });
            
            await message.reply({ embeds: [loseEmbed] });
        } else {
            const hint = guess < game.target ? (lang === 'fr' ? 'plus grand' : 'higher') : (lang === 'fr' ? 'plus petit' : 'lower');
            const remaining = game.maxAttempts - game.attempts;
            const hintEmbed = new EmbedBuilder().setColor('#FEE75C').setDescription(`❌ **${guess}** ${lang === 'fr' ? "n'est pas correct." : "is not correct."} ${t.guessHint} **${hint}**!\n*${remaining} ${t.attemptsLeft}*`);
            await msg.reply({ embeds: [hintEmbed] });
        }
    });
    
    collector.on('end', (collected, reason) => {
        if (activeGames.has(userId)) {
            if (reason === 'time') {
                message.reply({ content: t.gameExpired }).catch(() => {});
            }
            activeGames.delete(userId);
        }
    });
}

// ================= HANGMAN =================
async function playHangman(client, message, lang, db) {
    const t = texts[lang];
    const userId = message.author.id;
    const userData = client.getUserData(userId);
    const level = userData?.level || 1;
    const isVIP = level >= 51 || userId === process.env.OWNER_ID;
    const baseBet = 200;
    const bet = calculateDynamicBet(baseBet, level, isVIP);
    
    const guildName = message.guild.name.toUpperCase();
    const guildIcon = message.guild.iconURL() || client.user.displayAvatarURL();
    const version = client.version || '1.6.0';
    
    if (!hasEnoughCredits(client, userId, bet)) {
        const balance = userData?.credits || 0;
        return message.reply({ embeds: [new EmbedBuilder().setColor('#ED4245').setDescription(t.insufficientCredits(bet, balance))] });
    }
    
    if (activeGames.has(userId)) {
        return message.reply({ content: `❌ ${lang === 'fr' ? 'Vous avez déjà une partie en cours!' : 'You already have a game in progress!'}`, ephemeral: true });
    }
    
    if (client.queueUserUpdate) {
        client.queueUserUpdate(userId, {
            credits: (userData.credits || 0) - bet,
            username: message.author.username
        });
    }
    
    const words = lang === 'fr' 
        ? ['ARCHITECTE', 'JAVASCRIPT', 'BAMAKO', 'DISCORD', 'VICTOIRE', 'STRATEGIE', 'NEURAL', 'ARCADE', 'ALGORITHME', 'SYSTEME']
        : ['ARCHITECT', 'JAVASCRIPT', 'BAMAKO', 'DISCORD', 'VICTORY', 'STRATEGY', 'NEURAL', 'ARCADE', 'ALGORITHM', 'SYSTEM'];
    const targetWord = words[Math.floor(Math.random() * words.length)];
    let guessed = [];
    let lives = isVIP ? 8 : 6;
    
    activeGames.set(userId, {
        type: 'hangman', targetWord, guessed, lives, bet, lastActivity: Date.now()
    });

    const getDisplay = () => targetWord.split('').map(l => guessed.includes(l) ? l : ' _ ').join('');
    
    const hangmanStages = [
        '```\n  +---+\n      |\n      |\n      |\n      |\n      |\n=========```',
        '```\n  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========```',
        '```\n  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========```',
        '```\n  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========```',
        '```\n  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========```',
        '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========```',
        '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========```',
        '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n=========```'
    ];

    const hmEmbed = new EmbedBuilder()
        .setColor('#FEE75C')
        .setTitle(lang === 'fr' ? '🪑 PENDU NEURAL' : '🪑 NEURAL HANGMAN')
        .setDescription(`${hangmanStages[0]}\n**Word:** \`${getDisplay()}\` \n\n**Lives:** ${'❤️'.repeat(lives)}${'🖤'.repeat((isVIP ? 8 : 6) - lives)}\n${lang === 'fr' ? 'Tapez une lettre!' : 'Type a letter!'}${isVIP ? '\n👑 **VIP MODE: +2 vies!**' : ''}`)
        .setFooter({ text: `${guildName} • NEURAL ARCADE • v${version}`, iconURL: guildIcon });

    const gameMsg = await message.reply({ embeds: [hmEmbed] });
    const filter = m => m.author.id === userId && m.content.length === 1 && /^[A-Za-z]$/i.test(m.content);
    const collector = message.channel.createMessageCollector({ filter, time: 90000 });

    collector.on('collect', async (m) => {
        const game = activeGames.get(userId);
        if (!game) return;
        
        game.lastActivity = Date.now();
        const char = m.content.toUpperCase();
        
        if (game.guessed.includes(char)) {
            return m.reply({ content: lang === 'fr' ? "❌ Lettre déjà essayée!" : "❌ Letter already tried!", ephemeral: true });
        }
        
        game.guessed.push(char);
        if (!game.targetWord.includes(char)) game.lives--;
        
        const displayWord = game.targetWord.split('').map(l => game.guessed.includes(l) ? l : ' _ ').join('');
        const wordWithoutSpaces = displayWord.replace(/\s/g, '');
        
        const stageIndex = Math.min((isVIP ? 8 : 6) - game.lives, 7);
        
        if (wordWithoutSpaces === game.targetWord) {
            const baseReward = game.bet * 5;
            const winnings = calculateDynamicReward(baseReward, level, isVIP);
            updateGameStats(userId, true, winnings, message.channel, message.author.username, lang, client);
            activeGames.delete(userId);
            collector.stop('win');
        } else if (game.lives <= 0) {
            updateGameStats(userId, false, -game.bet, message.channel, message.author.username, lang, client);
            activeGames.delete(userId);
            collector.stop('lose');
        } else {
            const updatedEmbed = new EmbedBuilder()
                .setColor('#FEE75C')
                .setTitle(lang === 'fr' ? '🪑 PENDU NEURAL' : '🪑 NEURAL HANGMAN')
                .setDescription(`${hangmanStages[stageIndex]}\n**Word:** \`${displayWord}\` \n\n**Lives:** ${'❤️'.repeat(game.lives)}${'🖤'.repeat((isVIP ? 8 : 6) - game.lives)}\n**Letters tried:** ${game.guessed.join(', ')}`)
                .setFooter({ text: `${guildName} • NEURAL ARCADE • v${version}`, iconURL: guildIcon });
            await gameMsg.edit({ embeds: [updatedEmbed] });
            await m.delete().catch(() => {});
        }
    });

    collector.on('end', async (collected, reason) => {
        const game = activeGames.get(userId);
        
        if (reason === 'time' && game) {
            activeGames.delete(userId);
            const timeoutEmbed = new EmbedBuilder()
                .setColor('#95a5a6')
                .setDescription(t.gameExpired)
                .setFooter({ text: `${guildName} • NEURAL ARCADE • v${version}`, iconURL: guildIcon });
            return gameMsg.edit({ embeds: [timeoutEmbed] });
        }
        
        if (reason === 'win' || reason === 'lose') {
            const updatedUser = client.getUserData(userId);
            const newLevel = updatedUser?.level || calculateLevel(updatedUser?.xp || 0);
            const rank = getRank(newLevel);
            const credits = updatedUser?.credits || 0;
            const endEmbed = new EmbedBuilder().setFooter({ text: `${guildName} • NEURAL ARCADE • v${version}`, iconURL: guildIcon });
            
            if (reason === 'win') {
                endEmbed.setColor('#57F287')
                    .setTitle(lang === 'fr' ? '🎉 SAUVÉ!' : '🎉 SAVED!')
                    .setDescription(`${lang === 'fr' ? 'Mot' : 'Word'}: **${game.targetWord}**!\n**+${calculateDynamicReward(game.bet * 5, level, isVIP)} ${t.coins}**`)
                    .addFields(
                        { name: `💰 ${t.balance}`, value: `${credits.toLocaleString()} ${t.coins}`, inline: true },
                        { name: `📈 ${t.rank}`, value: `${rank.emoji} ${rank.title[lang]} (${t.level} ${newLevel})`, inline: true }
                    );
            } else {
                endEmbed.setColor('#ED4245')
                    .setTitle(lang === 'fr' ? '💀 ÉCHEC' : '💀 FAILED')
                    .setDescription(`${lang === 'fr' ? 'Mot' : 'Word'}: **${game.targetWord}**`)
                    .addFields(
                        { name: `💰 ${t.balance}`, value: `${credits.toLocaleString()} ${t.coins}`, inline: true },
                        { name: `📈 ${t.rank}`, value: `${rank.emoji} ${rank.title[lang]} (${t.level} ${newLevel})`, inline: true }
                    );
            }
            await gameMsg.edit({ embeds: [endEmbed] });
        }
    });
}

// ================= GAME STATS =================
async function showGameStats(client, message, lang, db) {
    const t = texts[lang];
    const version = client.version || '1.6.0';
    const guildName = message.guild.name.toUpperCase();
    const guildIcon = message.guild.iconURL() || client.user.displayAvatarURL();
    
    const user = client.getUserData ? client.getUserData(message.author.id) : null;
    const xp = user?.xp || 0;
    const level = user?.level || calculateLevel(xp);
    const rank = getRank(level);
    const progress = calculateProgress(xp, level);
    const credits = user?.credits || 0;
    const gamesPlayed = user?.games_played || 0;
    const gamesWon = user?.games_won || 0;
    const totalWinnings = user?.total_winnings || 0;
    const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
    const progressBar = createProgressBar(progress.percentage, 15);
    const isVIP = level >= 51 || message.author.id === process.env.OWNER_ID;
    
    const embed = new EmbedBuilder()
        .setColor(rank.color)
        .setAuthor({ name: `📊 ${t.gameStats}`, iconURL: message.author.displayAvatarURL() })
        .setTitle(`${rank.emoji} ${rank.title[lang]}${isVIP ? ' 👑' : ''}`)
        .setDescription(`**Agent:** ${message.author.username}`)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 512 }))
        .addFields(
            { name: `💰 ${t.balance}`, value: `\`${credits.toLocaleString()} 🪙\``, inline: true },
            { name: `📈 ${t.progress}`, value: `\`\`\`yaml\n${t.level}: ${level}\n${t.xp}: ${xp.toLocaleString()}\n${t.progress}: ${progress.percentage.toFixed(1)}%\n${progressBar}\`\`\``, inline: false },
            { name: `🎮 ${t.gameStats}`, value: `\`\`\`yaml\n${t.played}: ${gamesPlayed}\n${t.won}: ${gamesWon}\n${t.winRate}: ${winRate}%\nGains: ${totalWinnings.toLocaleString()} ${t.coins}\`\`\``, inline: false }
        )
        .setFooter({ text: `${guildName} • .game rank pour plus de détails • v${version}`, iconURL: guildIcon })
        .setTimestamp();
    
    message.reply({ embeds: [embed] });
}

// ================= AGENT PROFILE =================
async function showAgentProfile(client, message, lang, db) {
    const t = texts[lang];
    const version = client.version || '1.6.0';
    const guildName = message.guild.name.toUpperCase();
    const guildIcon = message.guild.iconURL() || client.user.displayAvatarURL();
    
    const user = client.getUserData ? client.getUserData(message.author.id) : null;
    const xp = user?.xp || 0;
    const level = user?.level || calculateLevel(xp);
    const rank = getRank(level);
    const progress = calculateProgress(xp, level);
    const credits = user?.credits || 0;
    const gamesPlayed = user?.games_played || 0;
    const gamesWon = user?.games_won || 0;
    const totalWinnings = user?.total_winnings || 0;
    const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
    const xpToNext = Math.ceil(progress.xpNeeded - progress.xpGained);
    const progressBar = createProgressBar(progress.percentage, 20);
    const isVIP = level >= 51 || message.author.id === process.env.OWNER_ID;
    
    const embed = new EmbedBuilder()
        .setColor(rank.color)
        .setAuthor({ name: `📜 ${t.agentProfile}`, iconURL: client.user.displayAvatarURL() })
        .setTitle(`${rank.emoji} ${rank.title[lang]}${isVIP ? ' 👑 VIP' : ''}`)
        .setDescription(`**Agent:** ${message.author.username}`)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 512 }))
        .addFields(
            { name: `💰 ${t.balance}`, value: `\`${credits.toLocaleString()} 🪙\``, inline: true },
            { name: `📈 ${t.progress}`, value: `\`\`\`yaml\n${t.level}: ${level}\n${t.xp}: ${xp.toLocaleString()}\n${t.progress}: ${progress.percentage.toFixed(1)}%\n${progressBar}\n${t.nextLevel}: ${xpToNext.toLocaleString()} XP\`\`\``, inline: false },
            { name: `🎮 ${t.gameStats}`, value: `\`\`\`yaml\n${t.played}: ${gamesPlayed}\n${t.won}: ${gamesWon}\n${t.winRate}: ${winRate}%\nGains: ${totalWinnings.toLocaleString()} ${t.coins}\`\`\``, inline: false }
        )
        .setFooter({ text: `${guildName} • .game menu • ${isVIP ? '👑 VIP Status Active • ' : ''}v${version}`, iconURL: guildIcon })
        .setTimestamp();
    
    message.reply({ embeds: [embed] });
}

// ================= GAME LEADERBOARD =================
async function showGameLeaderboard(client, message, type, lang, db) {
    const t = texts[lang];
    const version = client.version || '1.6.0';
    const guildName = message.guild.name.toUpperCase();
    const guildIcon = message.guild.iconURL() || client.user.displayAvatarURL();
    
    let orderBy = 'games_won DESC';
    let title = lang === 'fr' ? '═ CLASSEMENT DES VICTOIRES ═' : '═ WINS LEADERBOARD ═';
    let icon = '🏆';
    
    if (['winnings', 'gains', 'argent'].includes(type)) {
        orderBy = 'total_winnings DESC';
        title = lang === 'fr' ? '═ CLASSEMENT DES GAINS ═' : '═ WINNINGS LEADERBOARD ═';
        icon = '💰';
    }
    
    const players = db.prepare(`
        SELECT username, games_played, games_won, total_winnings, xp
        FROM users
        WHERE games_played > 0
        ORDER BY ${orderBy}
        LIMIT 10
    `).all();

    if (players.length === 0) {
        return message.reply(lang === 'fr' ? "📊 Aucune donnée de jeu disponible." : "📊 No gaming data available.");
    }

    const list = players.map((p, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
        const level = calculateLevel(p.xp || 0);
        const rank = getRank(level);
        if (type === 'winnings' || type === 'gains' || type === 'argent') {
            return `${medal} **${p.username || 'Unknown'}** ${rank.emoji} • 💰 ${(p.total_winnings || 0).toLocaleString()} 🪙`;
        }
        const winRate = Math.round((p.games_won / p.games_played) * 100);
        return `${medal} **${p.username || 'Unknown'}** ${rank.emoji} • 🏆 ${p.games_won} wins • 📊 ${winRate}% WR`;
    }).join('\n');

    const embed = new EmbedBuilder()
        .setColor('#FEE75C')
        .setTitle(title)
        .setDescription(`\`\`\`yaml\n${list}\`\`\``)
        .setFooter({ text: `${guildName} • ${icon} Top 10 neural arcade agents • v${version}`, iconURL: guildIcon })
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