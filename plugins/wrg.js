const { EmbedBuilder } = require('discord.js');
const Database = require('better-sqlite3');
const db = new Database('database.sqlite');

// --- OPTIMIZED DATABASE SETUP ---
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// --- EXTENSIVE WORD DATABASE with DIFFICULTY RATINGS ---
const wordCategories = {
    easy: {
        name: "🟢 EASY",
        words: ["CAT", "DOG", "SUN", "MOON", "STAR", "FISH", "BIRD", "TREE", "CAR", "HOUSE", "PHONE", "WATER", "FIRE", "SNOW", "RAIN"],
        hint: "✨ Hint: A common 3-5 letter word you learned in kindergarten!",
        minLength: 3,
        maxLength: 5
    },
    medium: {
        name: "🟡 MEDIUM",
        words: ["GAMING", "LAPTOP", "KEYBOARD", "MONITOR", "MOUSE", "SPEAKER", "CAMERA", "PHONE", "TABLET", "WINDOW", "GARDEN", "KITCHEN", "BEDROOM"],
        hint: "💡 Hint: Something you probably use or see every day at home!",
        minLength: 5,
        maxLength: 7
    },
    hard: {
        name: "🔴 HARD",
        words: ["ALGORITHM", "DATABASE", "ENCRYPTION", "FIREWALL", "PROCESSOR", "OPERATING", "NETWORKING", "HARDWARE", "SOFTWARE", "COMPUTER"],
        hint: "🧠 Hint: A tech term you might recognize from school or work!",
        minLength: 8,
        maxLength: 10
    },
    expert: {
        name: "⚫ EXPERT",
        words: [
            "CHOCOLATE", "BEAUTIFUL", "DANGEROUS", "EVERYTHING", "FANTASTIC",
            "GENERATION", "HARMONIOUS", "ILLUMINATE", "JUBILATION", "KNOWLEDGE",
            "LAUGHTER", "MAGNIFICENT", "NECESSARY", "OBSERVATION", "PHOTOGRAPH",
            "QUICKLY", "RANDOMIZE", "SPECTACULAR", "TECHNOLOGY", "UNIVERSAL",
            "VIBRATION", "WHATEVER", "XYLOPHONE", "YOURSELF", "ZOMBIE"
        ],
        hint: "🏆 Hint: A longer word (8-11 letters) that you've definitely seen in books, movies, or everyday life!",
        minLength: 8,
        maxLength: 11
    }
};

const casualWords = [
    "PIZZA", "BURGER", "COFFEE", "CHOCOLATE", "VACATION", "HOLIDAY", 
    "BIRTHDAY", "WEEKEND", "FRIENDS", "FAMILY", "MUSIC", "MOVIE",
    "GARDEN", "BEACH", "MOUNTAIN", "FOREST", "OCEAN", "DESERT", "SUNSET",
    "BUTTERFLY", "RAINBOW", "UNICORN", "DRAGON", "PHOENIX"
];

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
    return word.toUpperCase().replace(/[^A-Z]/g, '');
}

// --- OPTIMIZED XP UPDATE with LEVEL CHECK ---
function updateUserXP(userId, xpAmount) {
    // Get current XP before update
    const current = db.prepare("SELECT xp FROM users WHERE id = ?").get(userId);
    const oldXP = current ? current.xp : 0;
    
    // Atomic UPSERT
    const stmt = db.prepare(`
        INSERT INTO users (id, xp) 
        VALUES (?, ?) 
        ON CONFLICT(id) 
        DO UPDATE SET xp = xp + excluded.xp
    `);
    stmt.run(userId, xpAmount);
    
    // Get new XP
    const result = db.prepare("SELECT xp FROM users WHERE id = ?").get(userId);
    const newXP = result.xp;
    
    // Calculate levels (1000 XP per level)
    const oldLevel = Math.floor(oldXP / 1000);
    const newLevel = Math.floor(newXP / 1000);
    
    return {
        xp: newXP,
        oldLevel: oldLevel,
        newLevel: newLevel,
        leveledUp: newLevel > oldLevel
    };
}

function getRandomWordWithContext(category = null) {
    let wordPool = [];
    let actualCategory = null;
    let difficulty = null;
    let hint = null;
    
    if (category && wordCategories[category]) {
        wordPool = wordCategories[category].words;
        actualCategory = wordCategories[category].name;
        difficulty = category;
        hint = wordCategories[category].hint;
    } else if (category === 'casual') {
        wordPool = casualWords;
        actualCategory = "🎲 CASUAL";
        difficulty = 'casual';
        hint = "🎉 Hint: A fun word related to everyday life!";
    } else {
        const rand = Math.random();
        if (rand < 0.4) {
            wordPool = wordCategories.easy.words;
            actualCategory = wordCategories.easy.name;
            difficulty = 'easy';
            hint = wordCategories.easy.hint;
        } else if (rand < 0.7) {
            wordPool = wordCategories.medium.words;
            actualCategory = wordCategories.medium.name;
            difficulty = 'medium';
            hint = wordCategories.medium.hint;
        } else if (rand < 0.9) {
            wordPool = wordCategories.hard.words;
            actualCategory = wordCategories.hard.name;
            difficulty = 'hard';
            hint = wordCategories.hard.hint;
        } else {
            wordPool = wordCategories.expert.words;
            actualCategory = wordCategories.expert.name;
            difficulty = 'expert';
            hint = wordCategories.expert.hint;
        }
    }
    
    const targetWordRaw = wordPool[Math.floor(Math.random() * wordPool.length)];
    const targetWord = sanitizeWord(targetWordRaw);
    
    return { targetWord, category: actualCategory, difficulty, hint };
}

function getFunFact(word, difficulty) {
    const facts = {
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
    };
    
    const factPool = facts[difficulty] || facts.casual;
    return factPool[Math.floor(Math.random() * factPool.length)];
}

module.exports = {
    name: 'wrg',
    aliases: ['wordguess', 'guess', 'scramble'],
    run: async (client, message, args) => {
        
        let requestedCategory = args[0]?.toLowerCase();
        let winnerDeclared = false;
        
        const validCategories = ['easy', 'medium', 'hard', 'expert', 'casual'];
        if (requestedCategory && !validCategories.includes(requestedCategory)) {
            return message.reply(`❌ Invalid category! Try: easy, medium, hard, expert, casual`);
        }
        
        const { targetWord, category, difficulty, hint } = getRandomWordWithContext(requestedCategory);
        
        if (!targetWord || targetWord.length < 2) {
            return message.reply("❌ Error generating word. Please try again!");
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
            .setTitle('🎮 WORD GUESSING CHALLENGE')
            .setDescription(
                `**Difficulty:** ${category}\n` +
                `📏 Word Length: **${targetWord.length} letters**\n` +
                `🧩 Scrambled: **${scrambled}**\n\n` +
                `${hint}\n\n` +
                `💰 **Prize:** ${totalReward} XP\n` +
                `⏱️ **Time Limit:** ${timeLimit[difficulty]/1000} seconds`
            )
            .setFooter({ text: `Type the word exactly as shown | ${difficulty.toUpperCase()} mode` })
            .setTimestamp();

        await message.channel.send({ embeds: [startEmbed] });

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
                const funFact = getFunFact(targetWord, difficulty);

                const winEmbed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle('🏆 WE HAVE A WINNER!')
                    .setDescription(
                        `**${m.author.username}** cracked the code!\n\n` +
                        `✅ Correct Word: **${targetWord}**\n` +
                        `📊 Difficulty: ${category}\n` +
                        `📏 Length: ${targetWord.length} letters\n` +
                        `💰 Reward: **+${totalReward} XP**\n` +
                        `📈 Total XP: **${finalXP}**`
                    )
                    .addFields(
                        { name: '💡 Fun Fact', value: funFact, inline: false }
                    )
                    .setThumbnail(m.author.displayAvatarURL())
                    .setTimestamp();

                await message.channel.send({ embeds: [winEmbed] });
                
                // EASTER EGG: Level Up Notification! 🎊
                if (leveledUp) {
                    const levelUpEmbed = new EmbedBuilder()
                        .setColor('#ffd700')
                        .setTitle('🎊 LEVEL UP! 🎊')
                        .setDescription(
                            `**${m.author.username}** just reached **Level ${newLevel}**!\n\n` +
                            `🏅 From ${oldLevel} → ${newLevel}\n` +
                            `⭐ You're on fire! Keep guessing!`
                        )
                        .setFooter({ text: `${newLevel * 1000} XP total • Next level: ${(newLevel + 1) * 1000} XP` })
                        .setTimestamp();
                    
                    await message.channel.send({ embeds: [levelUpEmbed] });
                }
            }
        });

        collector.on('end', (collected, reason) => {
            if (!winnerDeclared && reason !== 'winner') {
                const failEmbed = new EmbedBuilder()
                    .setColor('#e74c3c')
                    .setTitle('⏰ TIME\'S UP!')
                    .setDescription(
                        `Nobody guessed it this time.\n\n` +
                        `🔍 The word was: **${targetWord}**\n` +
                        `📊 Difficulty: ${category}\n\n` +
                        `💡 **Pro tip:** Try \`!wrg easy\` or \`!wrg casual\` for words you definitely know!`
                    );
                message.channel.send({ embeds: [failEmbed] });
            }
        });
    }
};