const { EmbedBuilder } = require('discord.js');

// ================= UNIFIED LEVEL CALCULATION =================
function calculateLevel(xp) { 
    return Math.floor(0.1 * Math.sqrt(xp)) + 1; 
}

// ================= UNIFIED RANK TITLES =================
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

function createProgressBar(percentage, length = 15) {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty));
}

// ================= SANITIZATION =================
function sanitizeWord(word) { 
    return word.toUpperCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z]/g, ''); 
}

function fisherYatesShuffle(word) {
    let arr = word.split('');
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join('');
}

// ================= BILINGUAL WORD DATABASE =================
const wordCategories = {
    easy: {
        en: ["CAT", "DOG", "SUN", "MOON", "STAR", "FISH", "BIRD", "TREE", "CAR", "HOUSE", "BOOK", "BALL"],
        fr: ["CHAT", "CHIEN", "SOLEIL", "LUNE", "ETOILE", "POISSON", "OISEAU", "ARBRE", "VOITURE", "MAISON", "LIVRE", "BALLE"],
        hint: { en: "✨ A common 3-5 letter word!", fr: "✨ Un mot courant de 3-5 lettres !" },
        color: "#2ecc71", emoji: "🟢", xpBonus: 0, creditBonus: 0, timeLimit: 25000
    },
    medium: {
        en: ["GAMING", "LAPTOP", "KEYBOARD", "MONITOR", "MOUSE", "CAMERA", "TABLET", "GARDEN", "ROCKET", "PLANET"],
        fr: ["JEUVIDEO", "ORDINATEUR", "CLAVIER", "ECRAN", "SOURIS", "CAMERA", "TABLETTE", "JARDIN", "FUSEE", "PLANETE"],
        hint: { en: "💡 Everyday object or tech!", fr: "💡 Objet quotidien ou tech !" },
        color: "#f1c40f", emoji: "🟡", xpBonus: 20, creditBonus: 10, timeLimit: 35000
    },
    hard: {
        en: ["ALGORITHM", "DATABASE", "ENCRYPTION", "FIREWALL", "PROCESSOR", "SOFTWARE", "NETWORK", "INTERNET"],
        fr: ["ALGORITHME", "BASEDEDONNEES", "CHIFFREMENT", "PAREFEU", "PROCESSEUR", "LOGICIEL", "RESEAU", "INTERNET"],
        hint: { en: "🧠 Technical term!", fr: "🧠 Terme technique !" },
        color: "#e67e22", emoji: "🟠", xpBonus: 50, creditBonus: 25, timeLimit: 45000
    },
    expert: {
        en: ["TECHNOLOGY", "SPECTACULAR", "MAGNIFICENT", "KNOWLEDGE", "UNIVERSAL", "EXTRAORDINARY", "REVOLUTIONARY"],
        fr: ["TECHNOLOGIE", "SPECTACULAIRE", "MAGNIFIQUE", "CONNAISSANCE", "UNIVERSEL", "EXTRAORDINAIRE", "REVOLUTIONNAIRE"],
        hint: { en: "🏆 Advanced vocabulary!", fr: "🏆 Vocabulaire avancé !" },
        color: "#e74c3c", emoji: "🔴", xpBonus: 100, creditBonus: 50, timeLimit: 60000
    }
};

// ================= BILINGUAL TRANSLATIONS =================
const wrgTexts = {
    en: {
        title: '🎮 WORD GUESSING CHALLENGE',
        difficulty: 'Difficulty',
        length: 'Length',
        scrambled: 'Scrambled',
        limit: 'Time Limit',
        winner: '🏆 WE HAVE A WINNER!',
        correct: 'Correct Word',
        timesUp: '⏰ TIME\'S UP!',
        theWordWas: 'The word was',
        cracked: 'cracked the code!',
        progress: 'PROGRESS',
        rank: 'Rank',
        nextLevel: 'Next level',
        reward: 'Reward',
        xpGain: 'XP Gain',
        creditGain: 'Credit Gain',
        hint: '💡 HINT',
        tip: '💡 TIP',
        tipText: 'Type your guess in the chat!',
        tryEasier: 'Try easier words like `.wrg easy` to practice!',
        levelUp: '🎉 LEVEL UP!',
        promotedTo: 'promoted to'
    },
    fr: {
        title: '🎮 DEFI DE DEVINETTE',
        difficulty: 'Difficulté',
        length: 'Longueur',
        scrambled: 'Mélangé',
        limit: 'Temps Limite',
        winner: '🏆 NOUS AVONS UN GAGNANT !',
        correct: 'Mot Correct',
        timesUp: '⏰ TEMPS ECOULE !',
        theWordWas: 'Le mot était',
        cracked: 'a cracké le code !',
        progress: 'PROGRESSION',
        rank: 'Rang',
        nextLevel: 'Prochain niveau',
        reward: 'Récompense',
        xpGain: 'Gain XP',
        creditGain: 'Gain Crédits',
        hint: '💡 INDICE',
        tip: '💡 ASTUCE',
        tipText: 'Tapez votre réponse dans le chat !',
        tryEasier: 'Essayez des mots plus faciles comme `.wrg easy` !',
        levelUp: '🎉 PROMOTION !',
        promotedTo: 'promu au rang de'
    }
};

// ================= MAIN COMMAND =================
module.exports = {
    name: 'wrg',
    aliases: ['wordguess', 'guess', 'scramble', 'devine', 'mot', 'word'],
    description: '🎮 Bilingual word guessing game with XP and credit rewards!',
    category: 'GAMING',
    usage: '.wrg [difficulty]',
    cooldown: 3000,
    examples: ['.wrg', '.wrg easy', '.wrg hard'],

    // 🔥 NEW SIGNATURE: 6 parameters with usedCommand
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        
        try {
            // 🔥 NEURAL LANGUAGE BRIDGE - Alias-based detection!
            const lang = client.detectLanguage 
                ? client.detectLanguage(usedCommand, 'en')
                : 'en';
            
            const t = wrgTexts[lang];
            const version = client.version || '1.6.0';
            const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
            const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
            
            // ================= CATEGORY SELECTION =================
            let categoryKey = 'easy';
            if (args[0]) {
                const cat = args[0].toLowerCase();
                if (cat === 'medium' || cat === 'moyen') categoryKey = 'medium';
                if (cat === 'hard' || cat === 'difficile') categoryKey = 'hard';
                if (cat === 'expert') categoryKey = 'expert';
            }
            
            const data = wordCategories[categoryKey] || wordCategories.easy;
            const wordPool = data[lang];
            const rawWord = wordPool[Math.floor(Math.random() * wordPool.length)];
            const targetWord = sanitizeWord(rawWord);
            const scrambled = fisherYatesShuffle(targetWord);
            
            const totalXP = (targetWord.length * 10) + data.xpBonus;
            const totalCredits = (targetWord.length * 2) + data.creditBonus;
            const timeLimit = data.timeLimit;
            
            // 🔥 RAM-FIRST USER STATS
            let userStats = client.getUserData 
                ? client.getUserData(message.author.id) 
                : db.prepare("SELECT xp, credits, level FROM users WHERE id = ?").get(message.author.id);
            
            if (!userStats) {
                db.prepare("INSERT INTO users (id, username, xp, level, credits) VALUES (?, ?, 0, 1, 0)")
                    .run(message.author.id, message.author.username);
                userStats = { xp: 0, credits: 0, level: 1 };
                if (client.cacheUserData) client.cacheUserData(message.author.id, userStats);
            }
            
            const currentLevel = userStats.level || calculateLevel(userStats.xp || 0);
            const currentRank = getRank(currentLevel);
            const currentLevelXP = Math.pow((currentLevel - 1) / 0.1, 2);
            const nextLevelXP = Math.pow(currentLevel / 0.1, 2);
            const xpProgress = (userStats.xp || 0) - currentLevelXP;
            const xpNeeded = nextLevelXP - currentLevelXP;
            const progressPercent = xpNeeded > 0 ? Math.min(100, Math.max(0, (xpProgress / xpNeeded) * 100)) : 100;
            const progressBar = createProgressBar(progressPercent, 12);
            
            // ================= START EMBED =================
            const startEmbed = new EmbedBuilder()
                .setColor(data.color)
                .setAuthor({ name: t.title, iconURL: client.user.displayAvatarURL() })
                .setTitle(`${data.emoji} ${lang === 'fr' ? 'DEFI NEURAL' : 'NEURAL CHALLENGE'}`)
                .setDescription(
                    `\`\`\`yaml\n` +
                    `${t.difficulty}: ${categoryKey.toUpperCase()}\n` +
                    `${t.length}: ${targetWord.length} ${lang === 'fr' ? 'lettres' : 'letters'}\n` +
                    `${t.scrambled}: ${scrambled}\n` +
                    `${t.limit}: ${timeLimit/1000}s\`\`\`\n` +
                    `**${t.tipText}**`
                )
                .addFields(
                    { name: t.hint, value: data.hint[lang], inline: false },
                    { 
                        name: `💰 ${t.reward}`, 
                        value: `\`\`\`yaml\n${t.xpGain}: +${totalXP} XP\n${t.creditGain}: +${totalCredits} 🪙\`\`\``, 
                        inline: true 
                    },
                    { 
                        name: `📊 ${t.progress}`, 
                        value: `\`${progressBar}\` ${progressPercent.toFixed(1)}%\n└─ ${Math.ceil(xpNeeded - xpProgress).toLocaleString()} XP ${t.nextLevel.toLowerCase()}`, 
                        inline: true 
                    },
                    {
                        name: `📈 ${t.rank}`,
                        value: `${currentRank.emoji} ${currentRank.title[lang]}\n${lang === 'fr' ? 'Niveau' : 'Level'} ${currentLevel}`,
                        inline: true
                    }
                )
                .setFooter({ text: `${guildName} • NEURAL WRG • v${version}`, iconURL: guildIcon })
                .setTimestamp();

            await message.channel.send({ embeds: [startEmbed] }).catch(() => {});
            
            let winnerDeclared = false;
            
            // ================= COLLECTOR =================
            const collector = message.channel.createMessageCollector({ 
                filter: m => !m.author.bot, 
                time: timeLimit
            });
            
            collector.on('collect', async (m) => {
                if (winnerDeclared) return;
                
                const guess = sanitizeWord(m.content);
                
                if (guess === targetWord) {
                    winnerDeclared = true;
                    collector.stop('winner');
                    
                    // 🔥 BATCH UPDATE FOR REWARDS
                    const winnerData = client.getUserData 
                        ? client.getUserData(m.author.id) 
                        : db.prepare("SELECT xp, credits, level, games_played, games_won FROM users WHERE id = ?").get(m.author.id);
                    
                    if (!winnerData) {
                        db.prepare("INSERT INTO users (id, username, xp, level, credits) VALUES (?, ?, 0, 1, 0)")
                            .run(m.author.id, m.author.username);
                    }
                    
                    const oldXP = winnerData?.xp || 0;
                    const newXP = oldXP + totalXP;
                    const newLevel = calculateLevel(newXP);
                    const oldLevel = winnerData?.level || calculateLevel(oldXP);
                    
                    if (client.queueUserUpdate) {
                        client.queueUserUpdate(m.author.id, {
                            ...winnerData,
                            xp: newXP,
                            level: newLevel,
                            credits: (winnerData?.credits || 0) + totalCredits,
                            games_played: (winnerData?.games_played || 0) + 1,
                            games_won: (winnerData?.games_won || 0) + 1,
                            username: m.author.username
                        });
                    } else {
                        db.prepare(`UPDATE users SET xp = xp + ?, credits = credits + ?, level = ?, games_played = COALESCE(games_played, 0) + 1, games_won = COALESCE(games_won, 0) + 1 WHERE id = ?`)
                            .run(totalXP, totalCredits, newLevel, m.author.id);
                    }
                    
                    const updatedCredits = (winnerData?.credits || 0) + totalCredits;
                    const finalRank = getRank(newLevel);
                    
                    const newCurrentLevelXP = Math.pow((newLevel - 1) / 0.1, 2);
                    const newNextLevelXP = Math.pow(newLevel / 0.1, 2);
                    const newXpProgress = newXP - newCurrentLevelXP;
                    const newXpNeeded = newNextLevelXP - newCurrentLevelXP;
                    const newProgressPercent = newXpNeeded > 0 ? Math.min(100, Math.max(0, (newXpProgress / newXpNeeded) * 100)) : 100;
                    const newProgressBar = createProgressBar(newProgressPercent, 15);
                    
                    // ================= WIN EMBED =================
                    const winEmbed = new EmbedBuilder()
                        .setColor('#2ecc71')
                        .setAuthor({ name: t.winner, iconURL: m.author.displayAvatarURL() })
                        .setTitle(`✅ ${t.correct}`)
                        .setDescription(
                            `**${m.author.username}** ${t.cracked}\n\n` +
                            `\`\`\`yaml\n` +
                            `${lang === 'fr' ? 'Mot' : 'Word'}: ${targetWord}\n` +
                            `${t.difficulty}: ${categoryKey.toUpperCase()}\n` +
                            `${t.length}: ${targetWord.length} ${lang === 'fr' ? 'lettres' : 'letters'}\`\`\``
                        )
                        .addFields(
                            { 
                                name: `💰 ${t.reward}`, 
                                value: `\`\`\`yaml\n${t.xpGain}: +${totalXP} XP\n${t.creditGain}: +${totalCredits} 🪙\`\`\``, 
                                inline: true 
                            },
                            { 
                                name: `📈 ${t.rank}`, 
                                value: `${finalRank.emoji} ${finalRank.title[lang]}\n${lang === 'fr' ? 'Niveau' : 'Level'} ${newLevel}`, 
                                inline: true 
                            },
                            { 
                                name: `💎 ${lang === 'fr' ? 'Crédits' : 'Credits'}`, 
                                value: `\`${updatedCredits.toLocaleString()} 🪙\``, 
                                inline: true 
                            },
                            { 
                                name: `📊 ${t.progress}`, 
                                value: `\`${newProgressBar}\` ${newProgressPercent.toFixed(1)}%\n└─ ${Math.ceil(newXpNeeded - newXpProgress).toLocaleString()} XP ${t.nextLevel.toLowerCase()}`, 
                                inline: false 
                            }
                        )
                        .setFooter({ text: `${guildName} • NEURAL WRG • v${version}`, iconURL: guildIcon })
                        .setTimestamp();
                    
                    await message.channel.send({ embeds: [winEmbed] }).catch(() => {});
                    
                    // Level up announcement
                    if (newLevel > oldLevel) {
                        const levelUpEmbed = new EmbedBuilder()
                            .setColor(finalRank.color)
                            .setTitle(t.levelUp)
                            .setDescription(`**${m.author.username}** ${t.promotedTo} **${finalRank.emoji} ${finalRank.title[lang]}** (${lang === 'fr' ? 'Niveau' : 'Level'} ${newLevel})!`)
                            .setFooter({ text: `${guildName} • ARCHITECT CG-223 • v${version}`, iconURL: guildIcon })
                            .setTimestamp();
                        await message.channel.send({ embeds: [levelUpEmbed] }).catch(() => {});
                    }
                }
            });
            
            collector.on('end', (collected, reason) => {
                if (!winnerDeclared && reason !== 'winner') {
                    const failEmbed = new EmbedBuilder()
                        .setColor('#e74c3c')
                        .setTitle(t.timesUp)
                        .setDescription(
                            `**${t.theWordWas}:** \`${targetWord}\`\n\n` +
                            `💡 **${t.tip}:** ${t.tryEasier}`
                        )
                        .setFooter({ text: `${guildName} • NEURAL WRG • v${version}`, iconURL: guildIcon })
                        .setTimestamp();
                        
                    message.channel.send({ embeds: [failEmbed] }).catch(() => {});
                }
            });
            
            console.log(`[WRG] ${message.author.tag} started ${categoryKey} word game | Lang: ${lang} | Word: ${targetWord}`);
            
        } catch (error) {
            console.error(`[WRG] Fatal error:`, error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setTitle('❌ GAME ERROR')
                .setDescription(`An error occurred while starting the game. Please try again later.`)
                .setFooter({ text: `ARCHITECT CG-223 • v${client.version || '1.6.0'}` })
                .setTimestamp();
            return message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }
    }
};