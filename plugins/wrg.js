const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const path = require('path');
const Database = require('better-sqlite3');

// Point to the database in the ROOT folder, not the plugins folder
const db = new Database(path.join(__dirname, '../database.sqlite'));

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

// ================= SANITIZATION (FIXED - More Robust) =================
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
        en: ["CAT", "DOG", "SUN", "MOON", "STAR", "FISH", "BIRD", "TREE", "CAR", "HOUSE"],
        fr: ["CHAT", "CHIEN", "SOLEIL", "LUNE", "ETOILE", "POISSON", "OISEAU", "ARBRE", "VOITURE", "MAISON"],
        hint: { en: "✨ A common 3-5 letter word!", fr: "✨ Un mot courant de 3-5 lettres !" },
        color: "#2ecc71", emoji: "🟢", xpBonus: 0, creditBonus: 0, timeLimit: 25000
    },
    medium: {
        en: ["GAMING", "LAPTOP", "KEYBOARD", "MONITOR", "MOUSE", "CAMERA", "TABLET", "GARDEN"],
        fr: ["JEUVIDEO", "ORDINATEUR", "CLAVIER", "ECRAN", "SOURIS", "CAMERA", "TABLETTE", "JARDIN"],
        hint: { en: "💡 Everyday object or tech!", fr: "💡 Objet quotidien ou tech !" },
        color: "#f1c40f", emoji: "🟡", xpBonus: 20, creditBonus: 10, timeLimit: 35000
    },
    hard: {
        en: ["ALGORITHM", "DATABASE", "ENCRYPTION", "FIREWALL", "PROCESSOR", "SOFTWARE"],
        fr: ["ALGORITHME", "BASEDEDONNEES", "CHIFFREMENT", "PAREFEU", "PROCESSEUR", "LOGICIEL"],
        hint: { en: "🧠 Technical term!", fr: "🧠 Terme technique !" },
        color: "#e67e22", emoji: "🟠", xpBonus: 50, creditBonus: 25, timeLimit: 45000
    },
    expert: {
        en: ["TECHNOLOGY", "SPECTACULAR", "MAGNIFICENT", "KNOWLEDGE", "UNIVERSAL"],
        fr: ["TECHNOLOGIE", "SPECTACULAIRE", "MAGNIFIQUE", "CONNAISSANCE", "UNIVERSEL"],
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
        creditGain: 'Credit Gain'
    },
    fr: {
        title: '🎮 DEFI DE DEVINETTE',
        difficulty: 'Difficulté',
        length: 'Longueur',
        scrambled: 'Mélangé',
        limit: 'Temps limite',
        winner: '🏆 NOUS AVONS UN GAGNANT !',
        correct: 'Mot correct',
        timesUp: '⏰ TEMPS ECOULE !',
        theWordWas: 'Le mot était',
        cracked: 'a cracké le code !',
        progress: 'PROGRESSION',
        rank: 'Rang',
        nextLevel: 'Prochain niveau',
        reward: 'Récompense',
        xpGain: 'Gain XP',
        creditGain: 'Gain Crédits'
    }
};

// ================= LEVEL-UP EMBED (FIXED - No rankData reference) =================
async function sendLevelUpEmbed(channel, username, oldLevel, newLevel, currentXP, lang, version) {
    const rank = getRank(newLevel);
    const nextLevelXP = Math.pow(newLevel / 0.1, 2);
    const prevLevelXP = Math.pow((newLevel - 1) / 0.1, 2);
    const xpInLevel = currentXP - prevLevelXP;
    const xpNeeded = nextLevelXP - prevLevelXP;
    const progressPercent = xpNeeded > 0 ? Math.min(100, Math.max(0, (xpInLevel / xpNeeded) * 100)) : 100;
    const progressBar = createProgressBar(progressPercent, 12);
    
    const embed = new EmbedBuilder()
        .setColor(rank.color)
        .setTitle(`🎊 ${lang === 'fr' ? 'PROMOTION' : 'LEVEL UP'} ! 🎊`)
        .setDescription(
            `**${username}** ${lang === 'fr' ? 'est promu' : 'reached'} **Level ${newLevel}**!\n\n` +
            `${rank.emoji} **${rank.title[lang]}**\n` +
            `\`${progressBar}\` ${progressPercent.toFixed(1)}%\n` +
            `└─ ${lang === 'fr' ? 'Prochain niveau' : 'Next level'}: ${Math.ceil(xpNeeded - xpInLevel).toLocaleString()} XP`
        )
        .setFooter({ text: `ARCHITECT CG-223 • v${version}` })
        .setTimestamp();
    
    await channel.send({ embeds: [embed] });
}

// ================= ATOMIC REWARD FUNCTION (FIXED) =================
async function updateUserRewards(client, userId, xpAmount, creditAmount, channel, username, lang, version) {
    try {
        // Use the DB attached to the client for consistency
        const database = client.db || db;
        
        // Ensure user exists using your global helper if available
        if (client.initializeUser) {
            client.initializeUser(userId, username);
        } else {
            // Fallback: Ensure user exists
            const exists = database.prepare("SELECT id FROM users WHERE id = ?").get(userId);
            if (!exists) {
                database.prepare(`INSERT INTO users (id, username, xp, level, credits, last_daily) 
                    VALUES (?, ?, 0, 1, 0, ?)`)
                    .run(userId, username, Date.now());
            }
        }
        
        // Get current user data
        const user = database.prepare("SELECT xp, credits, level FROM users WHERE id = ?").get(userId);
        const oldXP = user ? user.xp : 0;
        const oldCredits = user ? user.credits : 0;
        const oldLevel = user ? user.level : 1;
        
        // Update rewards
        database.prepare(`
            UPDATE users 
            SET xp = xp + ?, 
                credits = credits + ?, 
                last_seen = CURRENT_TIMESTAMP 
            WHERE id = ?
        `).run(xpAmount, creditAmount, userId);
        
        // Get updated data
        const updated = database.prepare("SELECT xp, credits, level FROM users WHERE id = ?").get(userId);
        const newXP = updated.xp;
        const newCredits = updated.credits;
        const newLevel = calculateLevel(newXP);
        
        // Handle level up
        if (newLevel > oldLevel) {
            database.prepare("UPDATE users SET level = ? WHERE id = ?").run(newLevel, userId);
            await sendLevelUpEmbed(channel, username, oldLevel, newLevel, newXP, lang, version);
        }
        
        return {
            oldXP,
            newXP,
            oldCredits,
            newCredits,
            xpGained: xpAmount,
            creditsGained: creditAmount,
            oldLevel,
            newLevel,
            leveledUp: newLevel > oldLevel
        };
    } catch (err) {
        console.error(`[WRG] Update error: ${err.message}`);
        return null;
    }
}

// ================= MAIN COMMAND =================
module.exports = {
    name: 'wrg',
    aliases: ['wordguess', 'guess', 'scramble', 'devine', 'mot'],
    description: '🎮 Bilingual word guessing game with XP and credit rewards!',
    category: 'GAMING',
    usage: '.wrg [difficulty]',
    cooldown: 3000,
    examples: ['.wrg', '.wrg easy', '.wrg hard'],

    run: async (client, message, args) => {
        
        try {
            // --- LANGUAGE DETECTION ---
            const content = message.content.toLowerCase();
            const isFrench = content.includes('devine') || content.includes('mot') || message.guild?.preferredLocale === 'fr';
            const lang = isFrench ? 'fr' : 'en';
            const t = wrgTexts[lang];
            const version = client.version || '1.3.2';
            
            // --- CATEGORY SELECTION ---
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
            
            // Get user stats for progress bar
            const database = client.db || db;
            const userStats = database.prepare("SELECT xp FROM users WHERE id = ?").get(message.author.id);
            const currentLevel = calculateLevel(userStats?.xp || 0);
            const currentLevelXP = Math.pow((currentLevel - 1) / 0.1, 2);
            const nextLevelXP = Math.pow(currentLevel / 0.1, 2);
            const xpProgress = (userStats?.xp || 0) - currentLevelXP;
            const xpNeeded = nextLevelXP - currentLevelXP;
            const progressPercent = xpNeeded > 0 ? Math.min(100, Math.max(0, (xpProgress / xpNeeded) * 100)) : 100;
            const progressBar = createProgressBar(progressPercent, 10);
            
            // --- START EMBED ---
            const startEmbed = new EmbedBuilder()
                .setColor(data.color)
                .setAuthor({ name: t.title, iconURL: client.user.displayAvatarURL() })
                .setTitle(`${data.emoji} ${lang === 'fr' ? 'DEFI NEURAL' : 'NEURAL CHALLENGE'}`)
                .setDescription(
                    `\`\`\`prolog\n` +
                    `${t.difficulty}: ${categoryKey.toUpperCase()}\n` +
                    `${t.length}: ${targetWord.length}\n` +
                    `${t.scrambled}: ${scrambled}\n` +
                    `${t.limit}: ${timeLimit/1000}s\`\`\``
                )
                .addFields(
                    { name: `💡 ${data.hint[lang].split(':')[0]}`, value: data.hint[lang], inline: false },
                    { name: `💰 ${t.reward}`, value: `┌─ ${t.xpGain}: **+${totalXP} XP**\n└─ ${t.creditGain}: **+${totalCredits} 🪙**`, inline: true },
                    { name: `📊 ${t.progress}`, value: `\`${progressBar}\` ${progressPercent.toFixed(0)}%\n└─ ${Math.ceil(xpNeeded - xpProgress).toLocaleString()} XP ${t.nextLevel.toLowerCase()}`, inline: true }
                )
                .setFooter({ text: `ARCHITECT CG-223 • v${version}` })
                .setTimestamp();

            await message.channel.send({ embeds: [startEmbed] });
            
            let winnerDeclared = false;
            
            // --- COLLECTOR ---
            const collector = message.channel.createMessageCollector({ 
                filter: m => !m.author.bot, 
                time: timeLimit
            });
            
            collector.on('collect', async (m) => {
                if (winnerDeclared) return;
                
                // FIXED: Proper sanitization
                const guess = sanitizeWord(m.content);
                
                if (guess === targetWord) {
                    winnerDeclared = true;
                    collector.stop('winner');
                    
                    // Update rewards with proper SQL - PASS THE CLIENT
                    const result = await updateUserRewards(client, m.author.id, totalXP, totalCredits, message.channel, m.author.username, lang, version);
                    
                    if (!result) {
                        return message.channel.send(`❌ ${lang === 'fr' ? 'Erreur de base de donnees' : 'Database error'}`);
                    }
                    
                    // Get updated user stats for win embed
                    const updatedUser = database.prepare("SELECT xp, credits FROM users WHERE id = ?").get(m.author.id);
                    const newLevelNum = calculateLevel(updatedUser.xp);
                    const finalRank = getRank(newLevelNum);
                    
                    // Calculate new progress
                    const newCurrentLevelXP = Math.pow((newLevelNum - 1) / 0.1, 2);
                    const newNextLevelXP = Math.pow(newLevelNum / 0.1, 2);
                    const newXpProgress = updatedUser.xp - newCurrentLevelXP;
                    const newXpNeeded = newNextLevelXP - newCurrentLevelXP;
                    const newProgressPercent = newXpNeeded > 0 ? Math.min(100, Math.max(0, (newXpProgress / newXpNeeded) * 100)) : 100;
                    const newProgressBar = createProgressBar(newProgressPercent, 15);
                    
                    // --- WIN EMBED ---
                    const winEmbed = new EmbedBuilder()
                        .setColor('#2ecc71')
                        .setAuthor({ name: t.winner, iconURL: m.author.displayAvatarURL() })
                        .setTitle(`✅ ${t.correct}`)
                        .setDescription(
                            `**${m.author.username}** ${t.cracked}\n\n` +
                            `\`\`\`yaml\n` +
                            `Word: ${targetWord}\n` +
                            `Difficulty: ${categoryKey.toUpperCase()}\n` +
                            `Length: ${targetWord.length} letters\`\`\``
                        )
                        .addFields(
                            { name: `💰 ${t.reward}`, value: `┌─ ${t.xpGain}: **+${result.xpGained} XP**\n└─ ${t.creditGain}: **+${result.creditsGained} 🪙**`, inline: true },
                            { name: `📈 ${t.rank}`, value: `${finalRank.emoji} ${finalRank.title[lang]} (${lang === 'fr' ? 'Niveau' : 'Level'} ${newLevelNum})`, inline: true },
                            { name: `💎 ${lang === 'fr' ? 'Crédits' : 'Credits'}`, value: `\`${updatedUser.credits.toLocaleString()} 🪙\``, inline: true },
                            { name: `📊 ${t.progress}`, value: `\`${newProgressBar}\` ${newProgressPercent.toFixed(1)}%\n└─ ${Math.ceil(newXpNeeded - newXpProgress).toLocaleString()} XP ${t.nextLevel.toLowerCase()}`, inline: false }
                        )
                        .setFooter({ text: `ARCHITECT CG-223 • v${version}` })
                        .setTimestamp();
                    
                    await message.channel.send({ embeds: [winEmbed] });
                }
            });
            
            collector.on('end', (collected, reason) => {
                if (!winnerDeclared && reason !== 'winner') {
                    const failEmbed = new EmbedBuilder()
                        .setColor('#e74c3c')
                        .setTitle(t.timesUp)
                        .setDescription(
                            `${t.theWordWas}: **${targetWord}**\n\n` +
                            `💡 **Tip:** Try easier words like \`.wrg easy\` to practice!`
                        )
                        .setFooter({ text: `ARCHITECT CG-223 • v${version}` })
                        .setTimestamp();
                        
                    message.channel.send({ embeds: [failEmbed] });
                }
            });
            
            console.log(`[WRG] ${message.author.tag} started a ${categoryKey} word game | Lang: ${lang}`);
            
        } catch (error) {
            console.error(`[WRG] Fatal error:`, error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setTitle('❌ GAME ERROR')
                .setDescription(`An error occurred while starting the game.\n\n**Error:** \`${error.message}\`\n\nPlease try again later.`)
                .setTimestamp();
            return message.reply({ embeds: [errorEmbed] });
        }
    }
};