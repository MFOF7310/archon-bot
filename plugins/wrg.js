const { EmbedBuilder } = require('discord.js');
const Database = require('better-sqlite3'); // Note: lowercase as per npm package
const db = new Database('database.sqlite');

// --- EMERGENCY SCHEMA MIGRATION ---
// This ensures the database schema is up-to-date without breaking existing data
try {
    // Check and add last_seen column if missing
    const tableInfo = db.prepare("PRAGMA table_info(users)").all();
    const hasLastSeen = tableInfo.some(col => col.name === 'last_seen');
    
    if (!hasLastSeen) {
        db.prepare("ALTER TABLE users ADD COLUMN last_seen DATETIME DEFAULT CURRENT_TIMESTAMP").run();
        console.log("\x1b[32m[DB] Migration Successful: Added last_seen column to users table.\x1b[0m");
    }
    
    // Optional: Add level column if missing (for redundancy)
    const hasLevel = tableInfo.some(col => col.name === 'level');
    if (!hasLevel) {
        db.prepare("ALTER TABLE users ADD COLUMN level INTEGER DEFAULT 1").run();
        console.log("\x1b[32m[DB] Migration Successful: Added level column to users table.\x1b[0m");
    }
    
} catch (e) {
    // Silently ignore if columns already exist or other migration issues
    console.log("\x1b[33m[DB] Migration check completed (columns may already exist).\x1b[0m");
}

// Optional: Create index for better query performance
try {
    db.prepare("CREATE INDEX IF NOT EXISTS idx_users_xp ON users(xp)").run();
    db.prepare("CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen)").run();
    console.log("\x1b[32m[DB] Indexes created successfully.\x1b[0m");
} catch (e) {
    // Indexes are optional, continue if they fail
}

// --- OPTIMIZED DATABASE SETUP ---
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// --- BILINGUAL WORD DATABASE with DIFFICULTY RATINGS ---
const wordCategories = {
    easy: {
        en: ["CAT", "DOG", "SUN", "MOON", "STAR", "FISH", "BIRD", "TREE", "CAR", "HOUSE", "PHONE", "WATER", "FIRE", "SNOW", "RAIN"],
        fr: ["CHAT", "CHIEN", "SOLEIL", "LUNE", "ÉTOILE", "POISSON", "OISEAU", "ARBRE", "VOITURE", "MAISON", "TÉLÉPHONE", "EAU", "FEU", "NEIGE", "PLUIE"],
        hint: {
            en: "✨ Hint: A common 3-5 letter word you learned in kindergarten!",
            fr: "✨ Indice : Un mot courant de 3 à 5 lettres appris à la maternelle !"
        },
        minLength: 3,
        maxLength: 5
    },
    medium: {
        en: ["GAMING", "LAPTOP", "KEYBOARD", "MONITOR", "MOUSE", "SPEAKER", "CAMERA", "PHONE", "TABLET", "WINDOW", "GARDEN", "KITCHEN", "BEDROOM"],
        fr: ["JEUVIDÉO", "ORDINATEUR", "CLAVIER", "ÉCRAN", "SOURIS", "HAUTPARLEUR", "APPAREILPHOTO", "TÉLÉPHONE", "TABLETTE", "FENÊTRE", "JARDIN", "CUISINE", "CHAMBRE"],
        hint: {
            en: "💡 Hint: Something you probably use or see every day at home!",
            fr: "💡 Indice : Quelque chose que vous utilisez ou voyez tous les jours à la maison !"
        },
        minLength: 5,
        maxLength: 7
    },
    hard: {
        en: ["ALGORITHM", "DATABASE", "ENCRYPTION", "FIREWALL", "PROCESSOR", "OPERATING", "NETWORKING", "HARDWARE", "SOFTWARE", "COMPUTER"],
        fr: ["ALGORITHME", "BASEDEDONNÉES", "CHIFFREMENT", "PAREFEU", "PROCESSEUR", "SYSTÈMEEXPLOITATION", "RÉSEAUTAGE", "MATÉRIEL", "LOGICIEL", "ORDINATEUR"],
        hint: {
            en: "🧠 Hint: A tech term you might recognize from school or work!",
            fr: "🧠 Indice : Un terme technique que vous pourriez reconnaître de l'école ou du travail !"
        },
        minLength: 8,
        maxLength: 10
    },
    expert: {
        en: [
            "CHOCOLATE", "BEAUTIFUL", "DANGEROUS", "EVERYTHING", "FANTASTIC",
            "GENERATION", "HARMONIOUS", "ILLUMINATE", "JUBILATION", "KNOWLEDGE",
            "LAUGHTER", "MAGNIFICENT", "NECESSARY", "OBSERVATION", "PHOTOGRAPH",
            "QUICKLY", "RANDOMIZE", "SPECTACULAR", "TECHNOLOGY", "UNIVERSAL",
            "VIBRATION", "WHATEVER", "XYLOPHONE", "YOURSELF", "ZOMBIE"
        ],
        fr: [
            "CHOCOLAT", "MAGNIFIQUE", "DANGEREUX", "TOUT", "FANTASTIQUE",
            "GÉNÉRATION", "HARMONIEUX", "ILLUMINER", "JUBILATION", "CONNAISSANCE",
            "RIRE", "SPECTACULAIRE", "NÉCESSAIRE", "OBSERVATION", "PHOTOGRAPHIE",
            "RAPIDEMENT", "ALÉATOIRE", "TECHNOLOGIE", "UNIVERSEL", "VIBRATION",
            "PEUIMPORTE", "XYLOPHONE", "VOUSMÊME", "ZOMBIE"
        ],
        hint: {
            en: "🏆 Hint: A longer word (8-11 letters) that you've definitely seen in books, movies, or everyday life!",
            fr: "🏆 Indice : Un mot plus long (8-11 lettres) que vous avez certainement vu dans les livres, films ou la vie quotidienne !"
        },
        minLength: 8,
        maxLength: 11
    }
};

const casualWords = {
    en: ["PIZZA", "BURGER", "COFFEE", "CHOCOLATE", "VACATION", "HOLIDAY", 
         "BIRTHDAY", "WEEKEND", "FRIENDS", "FAMILY", "MUSIC", "MOVIE",
         "GARDEN", "BEACH", "MOUNTAIN", "FOREST", "OCEAN", "DESERT", "SUNSET",
         "BUTTERFLY", "RAINBOW", "UNICORN", "DRAGON", "PHOENIX"],
    fr: ["PIZZA", "BURGER", "CAFÉ", "CHOCOLAT", "VACANCES", "JOURFÉRIÉ",
         "ANNIVERSAIRE", "WEEKEND", "AMIS", "FAMILLE", "MUSIQUE", "FILM",
         "JARDIN", "PLAGE", "MONTAGNE", "FORÊT", "OCÉAN", "DÉSERT", "COUCHERDESOLEIL",
         "PAPILLON", "ARCPLUSIEL", "LICORNE", "DRAGON", "PHÉNIX"]
};

// --- TRANSLATIONS ---
const wrgTexts = {
    fr: {
        title: '🎮 DÉFI DE DEVINETTE DE MOTS',
        difficulty: 'Difficulté',
        length: 'Longueur',
        letters: 'lettres',
        scrambled: 'Mélangé',
        prize: 'Récompense',
        limit: 'Temps limite',
        seconds: 'secondes',
        footer: 'Tapez le mot exactement | Mode',
        winner: '🏆 NOUS AVONS UN GAGANT !',
        correct: 'Mot correct',
        totalXp: 'XP Total',
        funFact: '💡 Fait amusant',
        levelUp: '🎊 NIVEAU SUPÉRIEUR ! 🎊',
        reached: 'vient d\'atteindre le niveau',
        fromTo: 'De',
        to: '→',
        youreOnFire: 'Vous êtes en feu ! Continuez à deviner !',
        nextLevel: 'Prochain niveau',
        timesUp: '⏰ TEMPS ÉCOULÉ !',
        nobody: 'Personne n\'a trouvé cette fois.',
        theWordWas: 'Le mot était',
        proTip: '💡 **Astuce :** Essayez `!wrg facile` ou `!wrg casual` pour des mots que vous connaissez sûrement !',
        invalidCat: '❌ Catégorie invalide ! Essayez : facile, moyen, difficile, expert, casual',
        cracked: 'a cracké le code !',
        categoryNames: {
            easy: "🟢 FACILE",
            medium: "🟡 MOYEN",
            hard: "🔴 DIFFICILE",
            expert: "⚫ EXPERT",
            casual: "🎲 CASUAL"
        }
    },
    en: {
        title: '🎮 WORD GUESSING CHALLENGE',
        difficulty: 'Difficulty',
        length: 'Length',
        letters: 'letters',
        scrambled: 'Scrambled',
        prize: 'Prize',
        limit: 'Time Limit',
        seconds: 'seconds',
        footer: 'Type the word exactly | Mode',
        winner: '🏆 WE HAVE A WINNER!',
        correct: 'Correct Word',
        totalXp: 'Total XP',
        funFact: '💡 Fun Fact',
        levelUp: '🎊 LEVEL UP! 🎊',
        reached: 'just reached Level',
        fromTo: 'From',
        to: '→',
        youreOnFire: "You're on fire! Keep guessing!",
        nextLevel: 'Next level',
        timesUp: '⏰ TIME\'S UP!',
        nobody: 'Nobody guessed it this time.',
        theWordWas: 'The word was',
        proTip: '💡 **Pro tip:** Try `!wrg easy` or `!wrg casual` for words you definitely know!',
        invalidCat: '❌ Invalid category! Try: easy, medium, hard, expert, casual',
        cracked: 'cracked the code!',
        categoryNames: {
            easy: "🟢 EASY",
            medium: "🟡 MEDIUM",
            hard: "🔴 HARD",
            expert: "⚫ EXPERT",
            casual: "🎲 CASUAL"
        }
    }
};

// --- HELPER FUNCTIONS ---
function fisherYatesShuffle(word) {
    let arr = word.split('');
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join('');
}

function sanitizeWord(word) {
    return word.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z]/g, '');
}

// --- FIXED: ATOMIC XP UPDATE with TRANSACTION ---
const updateUserXP = db.transaction((userId, xpAmount) => {
    const current = db.prepare("SELECT xp FROM users WHERE id = ?").get(userId);
    const oldXP = current ? current.xp : 0;
    
    db.prepare(`
        INSERT INTO users (id, xp, last_seen) 
        VALUES (?, ?, CURRENT_TIMESTAMP) 
        ON CONFLICT(id) DO UPDATE SET 
            xp = xp + excluded.xp,
            last_seen = CURRENT_TIMESTAMP
    `).run(userId, xpAmount);
    
    const result = db.prepare("SELECT xp FROM users WHERE id = ?").get(userId);
    const newXP = result.xp;
    const oldLevel = Math.floor(oldXP / 1000);
    const newLevel = Math.floor(newXP / 1000);
    
    // Update cached level column
    if (newLevel !== oldLevel) {
        db.prepare("UPDATE users SET level = ? WHERE id = ?").run(newLevel, userId);
    }
    
    return {
        xp: newXP,
        oldLevel: oldLevel,
        newLevel: newLevel,
        leveledUp: newLevel > oldLevel
    };
});

function getRandomWordWithContext(lang, category = null) {
    let wordPool = [];
    let actualCategory = null;
    let difficulty = null;
    let hint = null;
    
    if (category && wordCategories[category]) {
        wordPool = wordCategories[category][lang];
        actualCategory = wrgTexts[lang].categoryNames[category];
        difficulty = category;
        hint = wordCategories[category].hint[lang];
    } else if (category === 'casual') {
        wordPool = casualWords[lang];
        actualCategory = wrgTexts[lang].categoryNames.casual;
        difficulty = 'casual';
        hint = lang === 'en' ? "🎉 Hint: A fun word related to everyday life!" : "🎉 Indice : Un mot amusant lié à la vie quotidienne !";
    } else {
        const rand = Math.random();
        if (rand < 0.4) {
            wordPool = wordCategories.easy[lang];
            actualCategory = wrgTexts[lang].categoryNames.easy;
            difficulty = 'easy';
            hint = wordCategories.easy.hint[lang];
        } else if (rand < 0.7) {
            wordPool = wordCategories.medium[lang];
            actualCategory = wrgTexts[lang].categoryNames.medium;
            difficulty = 'medium';
            hint = wordCategories.medium.hint[lang];
        } else if (rand < 0.9) {
            wordPool = wordCategories.hard[lang];
            actualCategory = wrgTexts[lang].categoryNames.hard;
            difficulty = 'hard';
            hint = wordCategories.hard.hint[lang];
        } else {
            wordPool = wordCategories.expert[lang];
            actualCategory = wrgTexts[lang].categoryNames.expert;
            difficulty = 'expert';
            hint = wordCategories.expert.hint[lang];
        }
    }
    
    const targetWordRaw = wordPool[Math.floor(Math.random() * wordPool.length)];
    const targetWord = sanitizeWord(targetWordRaw);
    
    return { targetWord, category: actualCategory, difficulty, hint };
}

function getFunFact(word, difficulty, lang) {
    const facts = {
        en: {
            easy: [
                `"${word}" is one of the first words people learn in English!`,
                `You probably used "${word.toLowerCase()}" in a sentence today!`,
                `"${word}" appears in over 90% of everyday conversations!`
            ],
            medium: [
                `"${word}" is something you interact with almost daily!`,
                `The word "${word.toLowerCase()}" exists in over 50 languages!`,
                `Most people say "${word.toLowerCase()}" at least once a week!`
            ],
            hard: [
                `"${word}" is a fundamental concept in modern computing!`,
                `Tech professionals use "${word.toLowerCase()}" multiple times daily!`,
                `This term became popular in the last 20 years!`
            ],
            expert: [
                `"${word}" has ${word.length} letters - that's why it was tricky!`,
                `The word "${word.toLowerCase()}" contains ${new Set(word.split('')).size} unique letters!`,
                `You earned bonus XP for conquering this ${word.length}-letter challenge!`
            ],
            casual: [
                `"${word}" is one of the most commonly used words in conversation!`,
                `You've definitely seen "${word.toLowerCase()}" in movies or songs!`,
                `"${word}" represents something people think about almost every day!`
            ]
        },
        fr: {
            easy: [
                `"${word}" est l'un des premiers mots qu'on apprend en français !`,
                `Vous avez probablement utilisé "${word.toLowerCase()}" dans une phrase aujourd'hui !`,
                `"${word}" apparaît dans plus de 90% des conversations quotidiennes !`
            ],
            medium: [
                `"${word}" est quelque chose que vous utilisez presque quotidiennement !`,
                `Le mot "${word.toLowerCase()}" existe dans plus de 50 langues !`,
                `La plupart des gens disent "${word.toLowerCase()}" au moins une fois par semaine !`
            ],
            hard: [
                `"${word}" est un concept fondamental en informatique moderne !`,
                `Les professionnels de la tech utilisent "${word.toLowerCase()}" plusieurs fois par jour !`,
                `Ce terme est devenu populaire ces 20 dernières années !`
            ],
            expert: [
                `"${word}" a ${word.length} lettres - c'est pourquoi c'était difficile !`,
                `Le mot "${word.toLowerCase()}" contient ${new Set(word.split('')).size} lettres uniques !`,
                `Vous avez gagné des XP bonus pour avoir conquéri ce défi de ${word.length} lettres !`
            ],
            casual: [
                `"${word}" est l'un des mots les plus utilisés dans les conversations !`,
                `Vous avez certainement vu "${word.toLowerCase()}" dans des films ou chansons !`,
                `"${word}" représente quelque chose auquel les gens pensent presque tous les jours !`
            ]
        }
    };
    
    const factPool = facts[lang][difficulty] || facts[lang].casual;
    return factPool[Math.floor(Math.random() * factPool.length)];
}

// --- COOLDOWN SYSTEM ---
const cooldowns = new Map();

// --- ACTIVITY CLEANUP FUNCTION ---
function cleanupInactiveUsers(daysInactive = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysInactive);
    
    const stmt = db.prepare("DELETE FROM users WHERE last_seen < ? AND xp = 0");
    const result = stmt.run(cutoff.toISOString());
    
    if (result.changes > 0) {
        console.log(`[DB] Cleaned up ${result.changes} inactive users with 0 XP`);
    }
    return result.changes;
}

// Optional: Run cleanup on bot start (uncomment if needed)
// cleanupInactiveUsers(30);

module.exports = {
    name: 'wrg',
    aliases: ['wordguess', 'guess', 'scramble', 'devine', 'mot'],
    run: async (client, message, args) => {
        
        // --- LANGUAGE DETECTION ---
        const content = message.content.toLowerCase();
        const enTriggers = ['.wrg', '.wordguess', '.scramble', '.guess'];
        const frTriggers = ['.devine', '.mot'];
        const enKeywords = ['easy', 'medium', 'hard', 'expert', 'casual'];
        const frKeywords = ['facile', 'moyen', 'difficile', 'expert', 'casual'];
        
        let lang = 'fr'; // Default to French
        if (enTriggers.some(t => content.startsWith(t)) || enKeywords.includes(args[0]?.toLowerCase())) {
            lang = 'en';
        } else if (frTriggers.some(t => content.startsWith(t)) || frKeywords.includes(args[0]?.toLowerCase())) {
            lang = 'fr';
        }
        
        const t = wrgTexts[lang];
        
        // --- MAP FRENCH CATEGORIES TO ENGLISH KEYS ---
        let requestedCategory = args[0]?.toLowerCase();
        const categoryMap = {
            'facile': 'easy', 'moyen': 'medium', 'difficile': 'hard', 'expert': 'expert', 'casual': 'casual',
            'easy': 'easy', 'medium': 'medium', 'hard': 'hard', 'expert': 'expert'
        };
        requestedCategory = categoryMap[requestedCategory] || requestedCategory;
        
        let winnerDeclared = false;
        
        const validCategories = ['easy', 'medium', 'hard', 'expert', 'casual'];
        if (requestedCategory && !validCategories.includes(requestedCategory)) {
            return message.reply(t.invalidCat);
        }
        
        // --- COOLDOWN CHECK ---
        if (cooldowns.has(message.author.id)) {
            const remaining = (cooldowns.get(message.author.id) - Date.now()) / 1000;
            if (remaining > 0) {
                const cooldownMsg = lang === 'en' 
                    ? `⏰ Please wait ${remaining.toFixed(1)} seconds before starting a new game!`
                    : `⏰ Veuillez attendre ${remaining.toFixed(1)} secondes avant de commencer une nouvelle partie !`;
                return message.reply(cooldownMsg);
            }
        }
        
        const { targetWord, category, difficulty, hint } = getRandomWordWithContext(lang, requestedCategory);
        
        if (!targetWord || targetWord.length < 2) {
            const errorMsg = lang === 'en' 
                ? "❌ Error generating word. Please try again!"
                : "❌ Erreur lors de la génération du mot. Veuillez réessayer !";
            return message.reply(errorMsg);
        }
        
        const scrambled = fisherYatesShuffle(targetWord);
        
        const baseXP = targetWord.length * 8;
        const difficultyBonus = {
            easy: 0,
            medium: 20,
            hard: 50,
            expert: 100,
            casual: 10
        };
        const totalReward = baseXP + (difficultyBonus[difficulty] || 20);
        
        const timeLimit = {
            easy: 20000,
            medium: 30000,
            hard: 45000,
            expert: 60000,
            casual: 25000
        };
        
        const startEmbed = new EmbedBuilder()
            .setColor('#00d9ff')
            .setTitle(t.title)
            .setDescription(
                `**${t.difficulty}:** ${category}\n` +
                `📏 ${t.length}: **${targetWord.length} ${t.letters}**\n` +
                `🧩 ${t.scrambled}: **${scrambled}**\n\n` +
                `${hint}\n\n` +
                `💰 **${t.prize}:** ${totalReward} XP\n` +
                `⏱️ **${t.limit}:** ${timeLimit[difficulty]/1000} ${t.seconds}`
            )
            .setFooter({ text: `${t.footer} ${difficulty.toUpperCase()}` })
            .setTimestamp();

        await message.channel.send({ embeds: [startEmbed] });
        
        // Set cooldown
        cooldowns.set(message.author.id, Date.now() + 30000);
        setTimeout(() => cooldowns.delete(message.author.id), 30000);

        const filter = m => !m.author.bot;
        const collector = message.channel.createMessageCollector({ 
            filter, 
            time: timeLimit[difficulty],
            max: 50
        });

        collector.on('collect', async (m) => {
            if (winnerDeclared) return;
            
            const guess = sanitizeWord(m.content);
            
            if (guess === targetWord) {
                winnerDeclared = true;
                collector.stop('winner');
                
                // Update XP and check for level up
                const { xp: finalXP, oldLevel, newLevel, leveledUp } = updateUserXP(m.author.id, totalReward);
                const funFact = getFunFact(targetWord, difficulty, lang);

                const winEmbed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle(t.winner)
                    .setDescription(
                        `**${m.author.username}** ${t.cracked}\n\n` +
                        `✅ ${t.correct}: **${targetWord}**\n` +
                        `📊 ${t.difficulty}: ${category}\n` +
                        `📏 ${t.length}: ${targetWord.length} ${t.letters}\n` +
                        `💰 ${t.prize}: **+${totalReward} XP**\n` +
                        `📈 ${t.totalXp}: **${finalXP}**`
                    )
                    .addFields(
                        { name: t.funFact, value: funFact, inline: false }
                    )
                    .setThumbnail(m.author.displayAvatarURL())
                    .setTimestamp();

                await message.channel.send({ embeds: [winEmbed] });
                
                // Level Up Notification! 🎊
                if (leveledUp) {
                    const levelUpEmbed = new EmbedBuilder()
                        .setColor('#ffd700')
                        .setTitle(t.levelUp)
                        .setDescription(
                            `**${m.author.username}** ${t.reached} **${newLevel}**!\n\n` +
                            `🏅 ${t.fromTo} ${oldLevel} ${t.to} ${newLevel}\n` +
                            `⭐ ${t.youreOnFire}`
                        )
                        .setFooter({ text: `${newLevel * 1000} XP ${t.totalXp} • ${t.nextLevel}: ${(newLevel + 1) * 1000} XP` })
                        .setTimestamp();
                    
                    await message.channel.send({ embeds: [levelUpEmbed] });
                }
            }
        });

        collector.on('end', (collected, reason) => {
            if (!winnerDeclared && reason !== 'winner') {
                const failEmbed = new EmbedBuilder()
                    .setColor('#e74c3c')
                    .setTitle(t.timesUp)
                    .setDescription(
                        `${t.nobody}\n\n` +
                        `🔍 ${t.theWordWas}: **${targetWord}**\n` +
                        `📊 ${t.difficulty}: ${category}\n\n` +
                        `${t.proTip}`
                    );
                message.channel.send({ embeds: [failEmbed] });
            }
            collector.stop(); // Cleanup
        });
    }
};