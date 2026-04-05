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

// ================= DÉTECTION DE LANGUE =================
function detectLanguage(args, subCommand) {
    const frenchIndicators = ['dé', 'pileface', 'devine', 'machine', 'vingtetun', 'pfc', 'culture', 'pendu', 'classement', 'statistiques', 'rang'];
    const englishIndicators = ['dice', 'coinflip', 'guess', 'slots', 'blackjack', 'rps', 'trivia', 'hangman', 'leaderboard', 'stats', 'rank'];
    
    const commandUsed = subCommand || (args[0]?.toLowerCase());
    
    if (frenchIndicators.includes(commandUsed)) return 'fr';
    if (englishIndicators.includes(commandUsed)) return 'en';
    
    return 'fr';
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
        useCommandEn: "Use `.game dice [1-6]` to bet!"
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
        useCommandEn: "Use `.game dice [1-6]` to bet!"
    }
};

// ================= FONCTION DE LEVEL UP AVEC ANNONCE =================
function checkAndAnnounceLevelUp(oldXp, newXp, userId, username, channel) {
    const oldLevel = calculateLevel(oldXp);
    const newLevel = calculateLevel(newXp);
    
    if (newLevel > oldLevel) {
        const rank = getRank(newLevel);
        const lang = 'fr';
        
        const levelUpEmbed = new EmbedBuilder()
            .setColor(rank.color)
            .setAuthor({ name: texts[lang].neuralArcade, iconURL: channel.client.user.displayAvatarURL() })
            .setTitle(texts[lang].levelUp)
            .setDescription(`${texts[lang].congratulations} **${username}**! ${texts[lang].newRank} **${rank.emoji} ${rank.title[lang]}** (Niveau ${newLevel})`)
            .addFields(
                { name: "📊 PROGRESSION", value: `Niveau ${oldLevel} → Niveau ${newLevel}`, inline: true },
                { name: "🎯 RANG ATTEINT", value: `${rank.emoji} ${rank.title[lang]}`, inline: true }
            )
            .setFooter({ text: "Continuez à jouer pour gravir les échelons!", iconURL: channel.client.user.displayAvatarURL() })
            .setTimestamp();
        
        channel.send({ embeds: [levelUpEmbed] });
        return true;
    }
    return false;
}

// ================= UPDATE GAME STATS AVEC LEVEL UP =================
function updateGameStats(userId, won, winnings, channel, username) {
    const oldUser = db.prepare("SELECT xp FROM users WHERE id = ?").get(userId);
    const oldXp = oldUser?.xp || 0;
    
    try {
        db.prepare(`ALTER TABLE users ADD COLUMN games_played INTEGER DEFAULT 0`).run();
        db.prepare(`ALTER TABLE users ADD COLUMN games_won INTEGER DEFAULT 0`).run();
        db.prepare(`ALTER TABLE users ADD COLUMN total_winnings INTEGER DEFAULT 0`).run();
        db.prepare(`ALTER TABLE users ADD COLUMN xp INTEGER DEFAULT 0`).run();
    } catch (e) {}
    
    const xpGain = won ? 100 : 25;
    
    if (won) {
        db.prepare(`UPDATE users SET games_played = games_played + 1, games_won = games_won + 1, total_winnings = total_winnings + ?, xp = xp + ? WHERE id = ?`)
            .run(winnings, xpGain, userId);
    } else {
        db.prepare(`UPDATE users SET games_played = games_played + 1, total_winnings = total_winnings + ?, xp = xp + ? WHERE id = ?`)
            .run(winnings, xpGain, userId);
    }
    
    const newUser = db.prepare("SELECT xp FROM users WHERE id = ?").get(userId);
    const newXp = newUser?.xp || 0;
    checkAndAnnounceLevelUp(oldXp, newXp, userId, username, channel);
}

module.exports = {
    name: 'game',
    aliases: ['play', 'minigame', 'arcade', 'jeu'],
    description: 'Lancez les jeux neural arcade.',
    category: 'GAMING',
    run: async (client, message, args, userData) => {
        const subCommand = args[0]?.toLowerCase();
        const lang = detectLanguage(args, subCommand);
        
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
    const userData = db.prepare("SELECT * FROM users WHERE id = ?").get(message.author.id);
    const xp = userData?.xp || 0;
    const level = calculateLevel(xp);
    const rank = getRank(level);
    const progress = calculateProgress(xp, level);
    const progressBar = createProgressBar(progress.percentage);
    const t = texts[lang];
    
    const menuEmbed = new EmbedBuilder()
        .setColor(rank.color)
        .setAuthor({ name: `🎮 ${t.neuralArcade} • SÉLECTION DES JEUX`, iconURL: client.user.displayAvatarURL() })
        .setTitle('═ SUITE DE JEUX ARCHITECT ═')
        .setDescription('Sélectionnez un jeu pour tester vos réflexes.')
        .addFields(
            { name: '🎲 DÉ ROULETTE', value: '`.game dice [1-6]`\n**Gain:** 5x', inline: true },
            { name: '🪙 PILE OU FACE', value: '`.game coinflip [pile/face]`\n**Gain:** 2x', inline: true },
            { name: '🔢 DEVINE LE NOMBRE', value: '`.game guess`\n**Gain:** Jusqu\'à 100x', inline: true },
            { name: '🎰 MACHINE À SOUS', value: '`.game slots`\n**Gain:** Jusqu\'à 500x', inline: true },
            { name: '🃏 BLACKJACK', value: '`.game blackjack`\n**Gain:** 2x', inline: true },
            { name: '✊ PFC DUEL', value: '`.game rps [pierre/feuille/ciseaux]`\n**Gain:** 2x', inline: true },
            { name: '🧠 CULTURE', value: '`.game trivia`\n**Gain:** 500 🪙', inline: true },
            { name: '🪑 PENDU', value: '`.game hangman`\n**Gain:** 1000 🪙', inline: true },
            { name: '📊 VOS STATS', value: `\`\`\`yaml\n${rank.emoji} Grade: ${rank.title[lang]}\nNiveau: ${level}\nXP: ${xp.toLocaleString()}\nProgression: ${progress.percentage.toFixed(1)}%\n${progressBar}\nVictoires: ${userData?.games_won || 0}/${userData?.games_played || 0}\`\`\``, inline: false }
        )
        .setFooter({ text: 'COMMUNAUTÉ EAGLE • ARCADE NEURALE V2.0' })
        .setTimestamp();
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('game_dice').setLabel('🎲 DÉ').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('game_coinflip').setLabel('🪙 PILE/FACE').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('game_slots').setLabel('🎰 SLOTS').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('game_blackjack').setLabel('🃏 BLACKJACK').setStyle(ButtonStyle.Secondary)
        );
    
    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('game_rps').setLabel('✊ PFC').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('game_guess').setLabel('🔢 DEVINE').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('game_trivia').setLabel('🧠 CULTURE').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('game_hangman').setLabel('🪑 PENDU').setStyle(ButtonStyle.Success)
        );
    
    const row3 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('game_stats').setLabel('📊 STATS').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('game_leaderboard').setLabel('🏆 CLASSEMENT').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('game_rank').setLabel('📈 RANG').setStyle(ButtonStyle.Primary)
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
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(message.author.id);
    const xp = user?.xp || 0;
    const level = calculateLevel(xp);
    const rank = getRank(level);
    const progress = calculateProgress(xp, level);
    const t = texts[lang];
    
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
            { name: `📈 ${t.progress}`, value: `\`\`\`yaml\n${t.level}: ${level}\n${t.xp}: ${xp.toLocaleString()}\n${t.progress}: ${progress.percentage.toFixed(1)}%\n${progressBar}\n${t.nextLevel}: ${xpToNext.toLocaleString()} XP\`\`\``, inline: false },
            { name: `🎮 ${t.gameStats}`, value: `\`\`\`yaml\n${t.played}: ${gamesPlayed}\n${t.won}: ${gamesWon}\n${t.winRate}: ${winRate}%\nGains: ${totalWinnings.toLocaleString()} ${t.coins}\`\`\``, inline: false }
        );
    
    if (nextRank) {
        const xpNeededForNextRank = Math.pow((nextRank.minLevel - 1) / 0.1, 2);
        const xpRemaining = Math.max(0, xpNeededForNextRank - xp);
        embed.addFields({ 
            name: '🎯 PROCHAINE PROMOTION', 
            value: `**${nextRank.emoji} ${nextRank.title[lang]}**\nNiveau ${nextRank.minLevel}\nXP restant: ${Math.ceil(xpRemaining).toLocaleString()}`,
            inline: false 
        });
    }
    
    embed.setFooter({ text: '.game menu • Continue playing!', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();
    
    message.reply({ embeds: [embed] });
}

// ================= DICE GAME (CORRIGÉ) =================
async function playDiceGame(client, message, userData, guess, lang) {
    const t = texts[lang];
    
    // 🔧 CORRECTION: Vérification si guess est null (appel via bouton)
    if (guess === null || guess === undefined) {
        return message.reply(lang === 'fr' ? t.useCommand : t.useCommandEn);
    }
    
    if (!guess) {
        const embed = new EmbedBuilder()
            .setColor('#ff4757')
            .setAuthor({ name: '🎲 DÉ ROULETTE', iconURL: message.author.displayAvatarURL() })
            .setDescription(`❌ **${t.invalidGuess}**`)
            .addFields({ name: '📝 UTILISATION', value: '`.game dice [1-6]`\nExemple: `.game dice 4`' });
        return message.reply({ embeds: [embed] });
    }
    
    const userGuess = parseInt(guess);
    
    if (isNaN(userGuess) || userGuess < 1 || userGuess > 6) {
        const embed = new EmbedBuilder()
            .setColor('#ff4757')
            .setAuthor({ name: '🎲 DÉ ROULETTE', iconURL: message.author.displayAvatarURL() })
            .setDescription(`❌ **${t.invalidGuess}** Nombre entre 1-6.`);
        return message.reply({ embeds: [embed] });
    }
    
    const bet = 100;
    const roll = Math.floor(Math.random() * 6) + 1;
    const won = userGuess === roll;
    const winnings = won ? bet * 5 : -bet;
    
    updateGameStats(message.author.id, won, winnings, message.channel, message.author.username);
    
    const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(message.author.id);
    const level = calculateLevel(updatedUser?.xp || 0);
    const rank = getRank(level);
    
    const embed = new EmbedBuilder()
        .setColor(won ? '#57F287' : '#ED4245')
        .setAuthor({ name: '🎲 DÉ ROULETTE', iconURL: message.author.displayAvatarURL() })
        .setTitle(won ? t.win : t.lose)
        .setDescription(`**Vous avez prédit:** \`${userGuess}\`\n**Le dé a montré:** \`${roll}\``)
        .addFields(
            { name: '💰 RÉSULTAT', value: won ? `+${winnings.toLocaleString()} ${t.coins}` : `${winnings.toLocaleString()} ${t.coins}`, inline: true },
            { name: `📈 ${t.rank}`, value: `${rank.emoji} ${rank.title[lang]} (${t.level} ${level})`, inline: true }
        );
    
    message.reply({ embeds: [embed] });
}

// ================= COIN FLIP =================
async function playCoinFlip(client, message, userData, choice, lang) {
    const t = texts[lang];
    
    if (!choice || !['heads', 'tails', 'h', 't', 'pile', 'face', 'p', 'f'].includes(choice.toLowerCase())) {
        const embed = new EmbedBuilder()
            .setColor('#ff4757')
            .setAuthor({ name: '🪙 PILE OU FACE', iconURL: message.author.displayAvatarURL() })
            .setDescription(`❌ **Veuillez spécifier pile ou face!**`)
            .addFields({ name: '📝 UTILISATION', value: '`.game coinflip [pile/face]`\nExemple: `.game coinflip pile`' });
        return message.reply({ embeds: [embed] });
    }
    
    let normalizedChoice = choice.toLowerCase();
    if (normalizedChoice === 'pile' || normalizedChoice === 'p') normalizedChoice = 'heads';
    if (normalizedChoice === 'face' || normalizedChoice === 'f') normalizedChoice = 'tails';
    if (normalizedChoice === 'h') normalizedChoice = 'heads';
    if (normalizedChoice === 't') normalizedChoice = 'tails';
    
    const bet = 100;
    const sides = ['heads', 'tails'];
    const result = sides[Math.floor(Math.random() * 2)];
    const won = normalizedChoice === result;
    const winnings = won ? bet : -bet;
    
    updateGameStats(message.author.id, won, winnings, message.channel, message.author.username);
    
    const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(message.author.id);
    const level = calculateLevel(updatedUser?.xp || 0);
    const rank = getRank(level);
    
    const resultFr = result === 'heads' ? 'pile' : 'face';
    const choiceFr = normalizedChoice === 'heads' ? 'pile' : 'face';
    
    const embed = new EmbedBuilder()
        .setColor(won ? '#57F287' : '#ED4245')
        .setAuthor({ name: '🪙 PILE OU FACE', iconURL: message.author.displayAvatarURL() })
        .setTitle(won ? '✨ BONNE PRÉDICTION!' : '❌ MAUVAISE PRÉDICTION')
        .setDescription(`**Vous avez choisi:** \`${choiceFr}\`\n**La pièce est tombée sur:** \`${resultFr}\``)
        .addFields(
            { name: '💰 RÉSULTAT', value: won ? `+${winnings.toLocaleString()} ${t.coins}` : `${winnings.toLocaleString()} ${t.coins}`, inline: true },
            { name: `📈 ${t.rank}`, value: `${rank.emoji} ${rank.title[lang]} (${t.level} ${level})`, inline: true }
        );
    
    message.reply({ embeds: [embed] });
}

// ================= NUMBER GUESS =================
let activeGuesses = new Map();

async function playNumberGuess(client, message, userData, lang) {
    const t = texts[lang];
    
    if (activeGuesses.has(message.author.id)) {
        return message.reply(`❌ Vous avez déjà une partie en cours! Terminez-la d'abord.`);
    }
    
    const target = Math.floor(Math.random() * 100) + 1;
    let attempts = 0;
    const maxAttempts = 5;
    
    activeGuesses.set(message.author.id, { target, attempts, maxAttempts });
    
    const embed = new EmbedBuilder()
        .setColor('#00fbff')
        .setAuthor({ name: '🔢 DEVINE LE NOMBRE', iconURL: message.author.displayAvatarURL() })
        .setTitle('🎯 DEVINEZ LE NOMBRE')
        .setDescription(`Je pense à un nombre entre **1** et **100**.\nVous avez **${maxAttempts}** essais!`)
        .addFields(
            { name: '🏆 RÉCOMPENSE', value: '1 essai: 200x • 2: 100x • 3: 50x • 4: 25x • 5: 10x' }
        )
        .setFooter({ text: 'Vous avez 60 secondes!' });
    
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
            const winnings = 100 * multiplier;
            
            updateGameStats(message.author.id, true, winnings, message.channel, message.author.username);
            activeGuesses.delete(message.author.id);
            collector.stop();
            
            const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(message.author.id);
            const level = calculateLevel(updatedUser?.xp || 0);
            const rank = getRank(level);
            
            const winEmbed = new EmbedBuilder()
                .setColor('#57F287')
                .setAuthor({ name: '🔢 DEVINE LE NOMBRE', iconURL: message.author.displayAvatarURL() })
                .setTitle('🎉 DEVINETTE PARFAITE!')
                .setDescription(`**Le nombre était:** \`${game.target}\`\n**Trouvé en:** \`${game.attempts}\` essai(s)`)
                .addFields(
                    { name: '💰 RÉCOMPENSE', value: `+${winnings.toLocaleString()} ${t.coins} (${multiplier}x)`, inline: true },
                    { name: `📈 ${t.rank}`, value: `${rank.emoji} ${rank.title[lang]} (${t.level} ${level})`, inline: true }
                );
            
            await message.reply({ embeds: [winEmbed] });
        } else if (game.attempts >= game.maxAttempts) {
            updateGameStats(message.author.id, false, -100, message.channel, message.author.username);
            activeGuesses.delete(message.author.id);
            collector.stop();
            
            const loseEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setAuthor({ name: '🔢 DEVINE LE NOMBRE', iconURL: message.author.displayAvatarURL() })
                .setTitle('💔 PARTIE TERMINÉE')
                .setDescription(`**Le nombre était:** \`${game.target}\``)
                .addFields({ name: '💰 RÉSULTAT', value: `-100 ${t.coins}`, inline: true });
            
            await message.reply({ embeds: [loseEmbed] });
        } else {
            const hint = guess < game.target ? 'plus grand' : 'plus petit';
            const remaining = game.maxAttempts - game.attempts;
            
            const hintEmbed = new EmbedBuilder()
                .setColor('#FEE75C')
                .setDescription(`❌ **${guess}** n'est pas correct. ${t.guessHint} **${hint}**!\n*${remaining} ${t.attemptsLeft}*`);
            
            await msg.reply({ embeds: [hintEmbed] });
        }
    });
    
    collector.on('end', () => {
        if (activeGuesses.has(message.author.id)) {
            const game = activeGuesses.get(message.author.id);
            if (game.attempts < game.maxAttempts) {
                updateGameStats(message.author.id, false, -100, message.channel, message.author.username);
                activeGuesses.delete(message.author.id);
                message.reply(`⏰ **${t.timeOut}**`);
            }
        }
    });
}

// ================= SLOT MACHINE =================
async function playSlots(client, message, userData, lang) {
    const t = texts[lang];
    const bet = 100;
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
    
    updateGameStats(message.author.id, won, winnings, message.channel, message.author.username);
    
    const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(message.author.id);
    const level = calculateLevel(updatedUser?.xp || 0);
    const rank = getRank(level);
    
    const embed = new EmbedBuilder()
        .setColor(won ? '#57F287' : '#ED4245')
        .setAuthor({ name: '🎰 MACHINE À SOUS', iconURL: message.author.displayAvatarURL() })
        .setTitle(won ? '✨ JACKPOT!' : '💔 PAS DE CHANCE')
        .setDescription(`\`\`\`\n┌─────┬─────┬─────┐\n│  ${reels[0]}  │  ${reels[1]}  │  ${reels[2]}  │\n└─────┴─────┴─────┘\n\`\`\``)
        .addFields(
            { name: '🎁 GAIN', value: won ? `${winnings.toLocaleString()} ${t.coins} (${multiplier}x)` : `${winnings.toLocaleString()} ${t.coins}`, inline: true },
            { name: `📈 ${t.rank}`, value: `${rank.emoji} ${rank.title[lang]} (${t.level} ${level})`, inline: true }
        );
    
    message.reply({ embeds: [embed] });
}

// ================= BLACKJACK =================
async function playBlackjack(client, message, userData, lang) {
    const t = texts[lang];
    let playerHand = [drawCard(), drawCard()];
    let dealerHand = [drawCard(), drawCard()];
    let gameOver = false;

    const generateEmbed = (status = 'À votre tour, Agent.') => {
        const pScore = calculateHand(playerHand);
        const dScore = gameOver ? calculateHand(dealerHand) : '??';
        const dDisplay = gameOver ? dealerHand.join(' ') : `${dealerHand[0]} 🃟`;

        return new EmbedBuilder()
            .setColor(gameOver ? '#00fbff' : '#f1c40f')
            .setAuthor({ name: '🃏 BLACKJACK NEURAL', iconURL: message.author.displayAvatarURL() })
            .setTitle('═ DUEL DE DONNÉES À HAUT RISQUE ═')
            .setDescription(`**Statut:** ${status}`)
            .addFields(
                { name: '🎴 VOTRE MAIN', value: `\`${playerHand.join(' ')}\` \n**Score:** ${pScore}`, inline: true },
                { name: '🃟 MAIN DU CROUPIER', value: `\`${dDisplay}\` \n**Score:** ${dScore}`, inline: true }
            );
    };

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bj_hit').setLabel('PIOCHE').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('bj_stand').setLabel('RESTE').setStyle(ButtonStyle.Secondary)
    );

    const gameMsg = await message.reply({ embeds: [generateEmbed()], components: [row] });

    const collector = gameMsg.createMessageComponentCollector({ 
        filter: i => i.user.id === message.author.id, 
        time: 30000 
    });

    collector.on('collect', async (i) => {
        if (i.customId === 'bj_hit') {
            playerHand.push(drawCard());
            if (calculateHand(playerHand) > 21) {
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

        if (reason === 'stand') {
            while (dScore < 17) {
                dealerHand.push(drawCard());
                dScore = calculateHand(dealerHand);
            }
        }

        let result = '';
        let won = false;
        let winnings = 0;

        if (pScore > 21) {
            result = '💀 DÉPASSEMENT! Surcharge système.';
            winnings = -200;
        } else if (dScore > 21 || pScore > dScore) {
            result = '🎉 VICTOIRE! Liaison neurale stable.';
            won = true;
            winnings = 200;
        } else if (dScore > pScore) {
            result = '💔 DÉFAITE! Le croupier vous a surpassé.';
            winnings = -200;
        } else {
            result = '🤝 ÉGALITÉ! Données synchronisées.';
            winnings = 0;
        }

        updateGameStats(message.author.id, won, winnings, message.channel, message.author.username);
        
        const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(message.author.id);
        const level = calculateLevel(updatedUser?.xp || 0);
        const rank = getRank(level);
        
        const finalEmbed = generateEmbed(result)
            .setColor(won ? '#57F287' : (winnings === 0 ? '#FEE75C' : '#ED4245'))
            .addFields(
                { name: '💰 RÉSULTAT', value: `${winnings > 0 ? '+' : ''}${winnings.toLocaleString()} ${t.coins}`, inline: false },
                { name: `📈 ${t.rank}`, value: `${rank.emoji} ${rank.title[lang]} (${t.level} ${level})`, inline: true }
            );

        await gameMsg.edit({ embeds: [finalEmbed], components: [] });
    });
}

// ================= ROCK PAPER SCISSORS =================
async function playRPS(client, message, userData, choice, lang) {
    const t = texts[lang];
    
    if (!choice || !['rock', 'paper', 'scissors', 'r', 'p', 's', 'pierre', 'feuille', 'ciseaux', 'pi', 'fe', 'ci'].includes(choice.toLowerCase())) {
        const embed = new EmbedBuilder()
            .setColor('#ff4757')
            .setAuthor({ name: '✊ PFC DUEL', iconURL: message.author.displayAvatarURL() })
            .setDescription('❌ **Veuillez spécifier pierre, feuille ou ciseaux!**')
            .addFields({ name: '📝 UTILISATION', value: '`.game rps [pierre/feuille/ciseaux]`\nExemple: `.game rps pierre`' });
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
        winnings = 100;
    } else {
        result = t.lose;
        won = false;
        winnings = -100;
    }
    
    if (won) updateGameStats(message.author.id, true, winnings, message.channel, message.author.username);
    else if (winnings < 0) updateGameStats(message.author.id, false, winnings, message.channel, message.author.username);
    
    const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(message.author.id);
    const level = calculateLevel(updatedUser?.xp || 0);
    const rank = getRank(level);
    
    const emojis = { rock: '✊', paper: '✋', scissors: '✌️' };
    const namesFr = { rock: 'PIERRE', paper: 'FEUILLE', scissors: 'CISEAUX' };
    
    const embed = new EmbedBuilder()
        .setColor(won ? '#57F287' : (winnings === 0 ? '#FEE75C' : '#ED4245'))
        .setAuthor({ name: '✊ PFC DUEL', iconURL: message.author.displayAvatarURL() })
        .setTitle('═ COMBAT STRATÉGIQUE ═')
        .setDescription(result)
        .addFields(
            { name: '🎮 VOTRE MOUVEMENT', value: `${emojis[normalizedChoice]} **${namesFr[normalizedChoice]}**`, inline: true },
            { name: '🤖 MOUVEMENT IA', value: `${emojis[botChoice]} **${namesFr[botChoice]}**`, inline: true },
            { name: '💰 RÉSULTAT', value: winnings !== 0 ? `${winnings > 0 ? '+' : ''}${winnings.toLocaleString()} ${t.coins}` : 'Aucun changement', inline: false },
            { name: `📈 ${t.rank}`, value: `${rank.emoji} ${rank.title[lang]} (${t.level} ${level})`, inline: true }
        );
    
    message.reply({ embeds: [embed] });
}

// ================= TRIVIA =================
async function playTrivia(client, message, userData, lang) {
    const t = texts[lang];
    const questions = [
        { q: "Que signifie HTML ?", a: ["HyperText Markup Language", "High Tech Modern Language", "Hyperlink Text Management"], correct: 0, fact: "HTML est la structure de base du web." },
        { q: "Quel langage est utilisé pour ce bot ?", a: ["CSS", "JavaScript", "C++"], correct: 1, fact: "JavaScript (Node.js) est le standard pour les bots Discord." },
        { q: "Dans CODM, que signifie 'ADS' ?", a: ["Aim Down Sights", "Auto Deploy System", "Advanced Defense Shield"], correct: 0, fact: "L'ADS est le temps de visée." },
        { q: "Capitale du Mali ?", a: ["Bamako", "Ségou", "Mopti"], correct: 0, fact: "Bamako est le centre économique du Mali." },
        { q: "Peintre de la Joconde ?", a: ["Van Gogh", "Picasso", "Léonard de Vinci"], correct: 2, fact: "La Joconde est au Louvre." }
    ];

    const data = questions[Math.floor(Math.random() * questions.length)];
    
    const embed = new EmbedBuilder()
        .setColor('#00fbff')
        .setAuthor({ name: '🧠 CULTURE GÉNÉRALE', iconURL: client.user.displayAvatarURL() })
        .setTitle('📥 QUESTION')
        .setDescription(`**${data.q}**`)
        .setFooter({ text: 'Temps: 15 secondes' });

    const row = new ActionRowBuilder().addComponents(
        data.a.map((choice, index) => 
            new ButtonBuilder()
                .setCustomId(`trivia_${index}`)
                .setLabel(choice)
                .setStyle(ButtonStyle.Primary)
        )
    );

    const reply = await message.reply({ embeds: [embed], components: [row] });
    const collector = reply.createMessageComponentCollector({ time: 15000 });

    collector.on('collect', async (i) => {
        if (i.user.id !== message.author.id) return i.reply({ content: "Accès refusé.", ephemeral: true });
        
        const isCorrect = i.customId === `trivia_${data.correct}`;
        const winnings = isCorrect ? 500 : -100;
        
        updateGameStats(message.author.id, isCorrect, winnings, message.channel, message.author.username);
        
        const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(message.author.id);
        const level = calculateLevel(updatedUser?.xp || 0);
        const rank = getRank(level);
        
        const resultEmbed = new EmbedBuilder()
            .setColor(isCorrect ? '#57F287' : '#ED4245')
            .setTitle(isCorrect ? '✅ CORRECT' : '❌ INCORRECT')
            .setDescription(isCorrect ? `+500 ${t.coins}` : `-100 ${t.coins}\nRéponse: **${data.a[data.correct]}**`)
            .addFields(
                { name: '🧠 INFO', value: data.fact },
                { name: `📈 ${t.rank}`, value: `${rank.emoji} ${rank.title[lang]} (${t.level} ${level})`, inline: true }
            );

        await i.update({ embeds: [resultEmbed], components: [] });
        collector.stop();
    });
}

// ================= HANGMAN =================
async function playHangman(client, message, userData, lang) {
    const t = texts[lang];
    const words = ['ARCHITECTE', 'JAVASCRIPT', 'BAMAKO', 'DISCORD', 'VICTOIRE', 'STRATEGIE', 'NEURAL', 'ARCADE'];
    const targetWord = words[Math.floor(Math.random() * words.length)];
    let guessed = [];
    let lives = 6;

    const getDisplay = () => targetWord.split('').map(l => guessed.includes(l) ? l : ' _ ').join('');

    const hmEmbed = new EmbedBuilder()
        .setColor('#FEE75C')
        .setTitle('🪑 PENDU NEURAL')
        .setDescription(`**Mot:** \`${getDisplay()}\` \n\n**Vies:** ❤️ ${lives}\nTapez une lettre!`);

    const gameMsg = await message.reply({ embeds: [hmEmbed] });

    const filter = m => m.author.id === message.author.id && m.content.length === 1 && /^[A-Za-z]$/i.test(m.content);
    const collector = message.channel.createMessageCollector({ filter, time: 60000 });

    collector.on('collect', async (m) => {
        const char = m.content.toUpperCase();
        if (guessed.includes(char)) return m.reply("Lettre déjà essayée!");

        guessed.push(char);
        if (!targetWord.includes(char)) lives--;

        if (getDisplay() === targetWord) {
            updateGameStats(message.author.id, true, 1000, message.channel, message.author.username);
            collector.stop('win');
        } else if (lives <= 0) {
            updateGameStats(message.author.id, false, -200, message.channel, message.author.username);
            collector.stop('lose');
        } else {
            hmEmbed.setDescription(`**Mot:** \`${getDisplay()}\` \n\n**Vies:** ❤️ ${lives}\n**Lettres:** ${guessed.join(', ')}`);
            await gameMsg.edit({ embeds: [hmEmbed] });
        }
    });

    collector.on('end', async (collected, reason) => {
        const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(message.author.id);
        const level = calculateLevel(updatedUser?.xp || 0);
        const rank = getRank(level);
        
        const endEmbed = new EmbedBuilder();
        if (reason === 'win') {
            endEmbed.setColor('#57F287')
                .setTitle('🎉 SAUVÉ!')
                .setDescription(`Mot: **${targetWord}**!\n**+1,000 ${t.coins}**\n📈 ${rank.emoji} ${rank.title[lang]} (${t.level} ${level})`);
        } else {
            endEmbed.setColor('#ED4245')
                .setTitle('💀 ÉCHEC')
                .setDescription(`Mot: **${targetWord}**.\n📈 ${rank.emoji} ${rank.title[lang]} (${t.level} ${level})`);
        }
        await gameMsg.edit({ embeds: [endEmbed] });
    });
}

// ================= GAME STATS =================
async function showGameStats(client, message, userData, lang) {
    const t = texts[lang];
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(message.author.id);
    const xp = user?.xp || 0;
    const level = calculateLevel(xp);
    const rank = getRank(level);
    const progress = calculateProgress(xp, level);
    
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
            { name: `📈 ${t.progress}`, value: `\`\`\`yaml\n${t.level}: ${level}\n${t.xp}: ${xp.toLocaleString()}\n${t.progress}: ${progress.percentage.toFixed(1)}%\n${progressBar}\`\`\``, inline: false },
            { name: `🎮 ${t.gameStats}`, value: `\`\`\`yaml\n${t.played}: ${gamesPlayed}\n${t.won}: ${gamesWon}\n${t.winRate}: ${winRate}%\nGains: ${totalWinnings.toLocaleString()} ${t.coins}\`\`\``, inline: false }
        )
        .setFooter({ text: '.game rank pour plus de détails' })
        .setTimestamp();
    
    message.reply({ embeds: [embed] });
}

// ================= LEADERBOARD (CORRIGÉ AVEC TRADUCTION) =================
async function showGameLeaderboard(client, message, type = 'wins', lang) {
    const t = texts[lang];
    let orderBy = '';
    let title = '';
    let icon = '';
    let color = '';
    
    // 🔧 CORRECTION: Traduction des titres avec l'objet t
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
    
    const topPlayers = db.prepare(`SELECT id, username, games_played, games_won, total_winnings, xp FROM users WHERE games_played > 0 ORDER BY ${orderBy} LIMIT 10`).all();
    
    if (topPlayers.length === 0) {
        return message.reply('📊 Aucune donnée disponible. Commencez à jouer!');
    }
    
    const leaderboardText = topPlayers.map((player, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
        const level = calculateLevel(player.xp || 0);
        const rank = getRank(level);
        
        if (type === 'level' || type === 'xp' || type === 'rank') {
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
        .setTitle('═ CLASSEMENT ARCADE NEURALE ═')
        .setDescription(`\`\`\`yaml\n${leaderboardText}\`\`\``)
        .setFooter({ text: '.game rank pour votre profil' })
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