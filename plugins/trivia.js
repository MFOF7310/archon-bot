const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

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

// ================= TRIVIA QUESTION DATABASE =================
const TRIVIA_QUESTIONS = {
    science: {
        en: [
            { q: "What is the chemical symbol for gold?", a: ["Au", "Ag", "Fe", "Cu"], correct: 0, fact: "Gold's symbol 'Au' comes from the Latin word 'aurum'." },
            { q: "What planet is known as the Red Planet?", a: ["Mars", "Venus", "Jupiter", "Mercury"], correct: 0, fact: "Mars appears red due to iron oxide (rust) on its surface." },
            { q: "What is the hardest natural substance on Earth?", a: ["Diamond", "Gold", "Iron", "Platinum"], correct: 0, fact: "Diamond scores a perfect 10 on the Mohs hardness scale." },
            { q: "What is the largest organ in the human body?", a: ["Skin", "Liver", "Heart", "Brain"], correct: 0, fact: "Skin accounts for about 15% of your body weight." },
            { q: "What is the speed of light?", a: ["300,000 km/s", "150,000 km/s", "500,000 km/s", "1,000,000 km/s"], correct: 0, fact: "Light travels at exactly 299,792,458 meters per second." },
            { q: "What is the most abundant gas in Earth's atmosphere?", a: ["Nitrogen", "Oxygen", "Carbon Dioxide", "Argon"], correct: 0, fact: "Nitrogen makes up about 78% of Earth's atmosphere." }
        ],
        fr: [
            { q: "Quel est le symbole chimique de l'or ?", a: ["Au", "Ag", "Fe", "Cu"], correct: 0, fact: "Le symbole 'Au' vient du latin 'aurum'." },
            { q: "Quelle planète est connue comme la Planète Rouge ?", a: ["Mars", "Vénus", "Jupiter", "Mercure"], correct: 0, fact: "Mars apparaît rouge à cause de l'oxyde de fer (rouille) sur sa surface." },
            { q: "Quelle est la substance naturelle la plus dure sur Terre ?", a: ["Diamant", "Or", "Fer", "Platine"], correct: 0, fact: "Le diamant obtient un score parfait de 10 sur l'échelle de Mohs." },
            { q: "Quel est le plus grand organe du corps humain ?", a: ["Peau", "Foie", "Cœur", "Cerveau"], correct: 0, fact: "La peau représente environ 15% de votre poids corporel." },
            { q: "Quelle est la vitesse de la lumière ?", a: ["300 000 km/s", "150 000 km/s", "500 000 km/s", "1 000 000 km/s"], correct: 0, fact: "La lumière voyage à exactement 299 792 458 mètres par seconde." },
            { q: "Quel est le gaz le plus abondant dans l'atmosphère terrestre ?", a: ["Azote", "Oxygène", "Dioxyde de carbone", "Argon"], correct: 0, fact: "L'azote représente environ 78% de l'atmosphère terrestre." }
        ]
    },
    history: {
        en: [
            { q: "Who was the first President of the United States?", a: ["George Washington", "Thomas Jefferson", "Abraham Lincoln", "John Adams"], correct: 0, fact: "Washington served from 1789 to 1797." },
            { q: "In which year did World War II end?", a: ["1945", "1944", "1946", "1943"], correct: 0, fact: "WWII ended in 1945 with Germany's surrender in May and Japan's in September." },
            { q: "Who painted the Mona Lisa?", a: ["Leonardo da Vinci", "Michelangelo", "Raphael", "Donatello"], correct: 0, fact: "Da Vinci painted the Mona Lisa between 1503 and 1519." },
            { q: "Which ancient civilization built Machu Picchu?", a: ["Inca", "Maya", "Aztec", "Olmec"], correct: 0, fact: "Machu Picchu was built by the Inca Empire in the 15th century." }
        ],
        fr: [
            { q: "Qui était le premier président des États-Unis ?", a: ["George Washington", "Thomas Jefferson", "Abraham Lincoln", "John Adams"], correct: 0, fact: "Washington a servi de 1789 à 1797." },
            { q: "En quelle année la Seconde Guerre mondiale s'est-elle terminée ?", a: ["1945", "1944", "1946", "1943"], correct: 0, fact: "La guerre s'est terminée en 1945." },
            { q: "Qui a peint la Joconde ?", a: ["Léonard de Vinci", "Michel-Ange", "Raphaël", "Donatello"], correct: 0, fact: "De Vinci a peint la Joconde entre 1503 et 1519." },
            { q: "Quelle civilisation a construit le Machu Picchu ?", a: ["Inca", "Maya", "Aztèque", "Olmèque"], correct: 0, fact: "Le Machu Picchu a été construit par l'Empire Inca au 15ème siècle." }
        ]
    },
    gaming: {
        en: [
            { q: "Which company created Mario?", a: ["Nintendo", "Sega", "Sony", "Microsoft"], correct: 0, fact: "Mario was created by Shigeru Miyamoto and first appeared in Donkey Kong (1981)." },
            { q: "In CODM, what does 'ADS' mean?", a: ["Aim Down Sights", "Auto Deploy System", "Advanced Defense Shield", "Aerial Drop Support"], correct: 0, fact: "ADS refers to aiming down your weapon's sights for better accuracy." },
            { q: "What is the best-selling video game of all time?", a: ["Minecraft", "GTA V", "Tetris", "Wii Sports"], correct: 0, fact: "Minecraft has sold over 300 million copies worldwide." },
            { q: "What year was the first Call of Duty released?", a: ["2003", "2001", "2005", "2007"], correct: 0, fact: "The original Call of Duty was released on October 29, 2003." }
        ],
        fr: [
            { q: "Quelle entreprise a créé Mario ?", a: ["Nintendo", "Sega", "Sony", "Microsoft"], correct: 0, fact: "Mario a été créé par Shigeru Miyamoto." },
            { q: "Dans CODM, que signifie 'ADS' ?", a: ["Viser", "Système Auto", "Bouclier", "Support Aérien"], correct: 0, fact: "L'ADS fait référence au fait de viser avec le viseur." },
            { q: "Quel est le jeu vidéo le plus vendu ?", a: ["Minecraft", "GTA V", "Tetris", "Wii Sports"], correct: 0, fact: "Minecraft s'est vendu à plus de 300 millions d'exemplaires." },
            { q: "En quelle année le premier Call of Duty est-il sorti ?", a: ["2003", "2001", "2005", "2007"], correct: 0, fact: "Le Call of Duty original est sorti le 29 octobre 2003." }
        ]
    },
    general: {
        en: [
            { q: "How many days are in a leap year?", a: ["366", "365", "364", "367"], correct: 0, fact: "Leap years occur every 4 years to account for Earth's orbit." },
            { q: "What is the capital of Mali?", a: ["Bamako", "Ségou", "Mopti", "Kayes"], correct: 0, fact: "Bamako is located on the Niger River." },
            { q: "Who created this bot?", a: ["Moussa Fofana", "OpenAI", "Google", "Microsoft"], correct: 0, fact: "Moussa Fofana (MFOF7310) is the Architect of this system." },
            { q: "How many continents are there?", a: ["7", "6", "5", "8"], correct: 0, fact: "The seven continents are: Asia, Africa, North America, South America, Antarctica, Europe, and Australia." }
        ],
        fr: [
            { q: "Combien de jours dans une année bissextile ?", a: ["366", "365", "364", "367"], correct: 0, fact: "Les années bissextiles se produisent tous les 4 ans." },
            { q: "Quelle est la capitale du Mali ?", a: ["Bamako", "Ségou", "Mopti", "Kayes"], correct: 0, fact: "Bamako est située sur le fleuve Niger." },
            { q: "Qui a créé ce bot ?", a: ["Moussa Fofana", "OpenAI", "Google", "Microsoft"], correct: 0, fact: "Moussa Fofana (MFOF7310) est l'Architecte." },
            { q: "Combien y a-t-il de continents ?", a: ["7", "6", "5", "8"], correct: 0, fact: "Les sept continents sont : Asie, Afrique, Amérique du Nord, Amérique du Sud, Antarctique, Europe et Australie." }
        ]
    }
};

// ================= CATEGORY CONFIGURATION =================
const CATEGORIES = {
    science: { emoji: '🔬', color: '#2ecc71', name: { en: 'Science', fr: 'Science' } },
    history: { emoji: '📜', color: '#e67e22', name: { en: 'History', fr: 'Histoire' } },
    gaming: { emoji: '🎮', color: '#9b59b6', name: { en: 'Gaming', fr: 'Jeux Vidéo' } },
    general: { emoji: '🧠', color: '#f1c40f', name: { en: 'General', fr: 'Général' } }
};

// ================= DIFFICULTY CONFIGURATION =================
const DIFFICULTIES = {
    easy: { 
        emoji: '🟢', color: '#2ecc71', name: { en: 'Easy', fr: 'Facile' },
        questions: 5, baseReward: 50, timeLimit: 20, bet: 50
    },
    medium: { 
        emoji: '🟡', color: '#f1c40f', name: { en: 'Medium', fr: 'Moyen' },
        questions: 7, baseReward: 100, timeLimit: 15, bet: 100
    },
    hard: { 
        emoji: '🔴', color: '#e74c3c', name: { en: 'Hard', fr: 'Difficile' },
        questions: 10, baseReward: 200, timeLimit: 10, bet: 200
    }
};

// ================= BILINGUAL TRANSLATIONS =================
const texts = {
    en: {
        title: '🧠 NEURAL TRIVIA',
        selectCategory: 'Select a Category',
        selectDifficulty: 'Select Difficulty',
        cancel: 'Cancel',
        back: 'Back',
        question: 'Question',
        of: 'of',
        timeLeft: 'Time Left',
        correct: '✅ CORRECT!',
        incorrect: '❌ INCORRECT!',
        timeout: '⏰ TIME\'S UP!',
        answer: 'Answer',
        fact: 'Did you know?',
        streak: 'Streak',
        correctAnswers: 'Correct',
        accuracy: 'Accuracy',
        reward: 'Reward',
        baseReward: 'Base',
        streakBonus: 'Streak Bonus',
        accuracyBonus: 'Accuracy Bonus',
        total: 'Total',
        xpGained: 'XP Gained',
        playAgain: 'Play Again',
        mainMenu: 'Main Menu',
        backToGames: 'Games Menu',
        insufficientCredits: '❌ **Insufficient Credits!** You need {bet} 🪙 to play.',
        balance: 'Balance',
        gameOver: 'Quiz Complete!',
        perfect: '🏆 PERFECT SCORE!',
        almost: 'Great effort!',
        good: 'Well done!',
        tryAgain: 'Try again!',
        accessDenied: '❌ This menu is not yours.',
        progress: 'Progress',
        levelUp: '🎉 LEVEL UP!',
        promotedTo: 'promoted to'
    },
    fr: {
        title: '🧠 TRIVIA NEURAL',
        selectCategory: 'Choisissez une Catégorie',
        selectDifficulty: 'Choisissez la Difficulté',
        cancel: 'Annuler',
        back: 'Retour',
        question: 'Question',
        of: 'sur',
        timeLeft: 'Temps Restant',
        correct: '✅ CORRECT !',
        incorrect: '❌ INCORRECT !',
        timeout: '⏰ TEMPS ÉCOULÉ !',
        answer: 'Réponse',
        fact: 'Le saviez-vous ?',
        streak: 'Série',
        correctAnswers: 'Correct',
        accuracy: 'Précision',
        reward: 'Récompense',
        baseReward: 'Base',
        streakBonus: 'Bonus de Série',
        accuracyBonus: 'Bonus Précision',
        total: 'Total',
        xpGained: 'XP Gagnés',
        playAgain: 'Rejouer',
        mainMenu: 'Menu Principal',
        backToGames: 'Menu Jeux',
        insufficientCredits: '❌ **Crédits Insuffisants !** Vous avez besoin de {bet} 🪙 pour jouer.',
        balance: 'Solde',
        gameOver: 'Quiz Terminé !',
        perfect: '🏆 SCORE PARFAIT !',
        almost: 'Excellent effort !',
        good: 'Bien joué !',
        tryAgain: 'Réessayez !',
        accessDenied: '❌ Ce menu ne vous appartient pas.',
        progress: 'Progression',
        levelUp: '🎉 PROMOTION !',
        promotedTo: 'promu au rang de'
    }
};

// ================= HELPER FUNCTIONS =================
function shuffleAnswers(question) {
    const answers = question.a.map((text, index) => ({
        text: text,
        isCorrect: index === question.correct
    }));
    
    for (let i = answers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [answers[i], answers[j]] = [answers[j], answers[i]];
    }
    
    const newCorrectIndex = answers.findIndex(a => a.isCorrect);
    
    return {
        q: question.q,
        a: answers.map(a => a.text),
        correct: newCorrectIndex,
        fact: question.fact
    };
}

function getRandomQuestions(category, difficulty, lang, count) {
    const questions = TRIVIA_QUESTIONS[category]?.[lang] || TRIVIA_QUESTIONS.general[lang];
    if (!questions || questions.length === 0) return [];
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, questions.length)).map(q => shuffleAnswers(q));
}

// ================= MAIN COMMAND =================
module.exports = {
    name: 'trivia',
    aliases: ['quiz', 'culture', 'questions', 'trivial', 'quizz'],
    description: '🧠 Test your knowledge with the Neural Trivia System!',
    category: 'GAMING',
    usage: '.trivia',
    cooldown: 3000,

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        console.log(`[TRIVIA] Command executed by ${message.author.tag} with alias: ${usedCommand}`);
        
        try {
            // 🔥 ALIAS-BASED LANGUAGE DETECTION
            const lang = client.detectLanguage 
                ? client.detectLanguage(usedCommand, 'en')
                : 'en';
            
            console.log(`[TRIVIA] Detected language: ${lang}`);
            
            const t = texts[lang];
            const version = client.version || '1.6.0';
            const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
            const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
            
            const userId = message.author.id;
            const userName = message.author.username;
            const avatarURL = message.author.displayAvatarURL({ dynamic: true, size: 256 });
            
            // 🔥 GET USER DATA
            let userData = client.getUserData 
                ? client.getUserData(userId) 
                : db.prepare("SELECT xp, credits, level FROM users WHERE id = ?").get(userId);
            
            if (!userData) {
                db.prepare("INSERT INTO users (id, username, xp, credits, level) VALUES (?, ?, 0, 0, 1)").run(userId, userName);
                userData = { xp: 0, credits: 0, level: 1 };
                if (client.cacheUserData) client.cacheUserData(userId, userData);
            }
            
            const credits = userData.credits || 0;
            const userLevel = userData.level || calculateLevel(userData.xp || 0);
            const userRank = getRank(userLevel);
            
            console.log(`[TRIVIA] User ${userName} - Credits: ${credits}, Level: ${userLevel}`);
            
            // ================= CATEGORY SELECTION MENU =================
            const categoryEmbed = new EmbedBuilder()
                .setColor('#00fbff')
                .setAuthor({ name: `${t.title} • ${lang === 'fr' ? 'SÉLECTION' : 'SELECTION'}`, iconURL: client.user.displayAvatarURL() })
                .setTitle(lang === 'fr' ? '═ CHOISISSEZ UNE CATÉGORIE ═' : '═ SELECT A CATEGORY ═')
                .setDescription(lang === 'fr' ? 'Sélectionnez une catégorie pour commencer le quiz.' : 'Select a category to begin the quiz.')
                .addFields(
                    { name: `🔬 ${CATEGORIES.science.name[lang]}`, value: `${lang === 'fr' ? 'Physique, chimie, biologie...' : 'Physics, chemistry, biology...'}`, inline: true },
                    { name: `📜 ${CATEGORIES.history.name[lang]}`, value: `${lang === 'fr' ? 'Événements et personnages historiques' : 'Historical events and figures'}`, inline: true },
                    { name: `🎮 ${CATEGORIES.gaming.name[lang]}`, value: `${lang === 'fr' ? 'Jeux vidéo, CODM, esports...' : 'Video games, CODM, esports...'}`, inline: true },
                    { name: `🧠 ${CATEGORIES.general.name[lang]}`, value: `${lang === 'fr' ? 'Culture générale mélangée' : 'Mixed general knowledge'}`, inline: true }
                )
                .addFields({
                    name: `💰 ${t.balance}`,
                    value: `\`${credits.toLocaleString()} 🪙\` • ${userRank.emoji} ${userRank.title[lang]} (${lang === 'fr' ? 'Niv.' : 'Lvl.'} ${userLevel})`,
                    inline: false
                })
                .setFooter({ text: `${guildName} • NEURAL TRIVIA • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            
            const categoryOptions = Object.entries(CATEGORIES).map(([key, cat]) => ({
                label: `${cat.emoji} ${cat.name[lang]}`.substring(0, 100),
                value: key,
                description: `${lang === 'fr' ? 'Jouer en catégorie' : 'Play in'} ${cat.name[lang]}`.substring(0, 100)
            }));
            
            const categoryMenu = new StringSelectMenuBuilder()
                .setCustomId('trivia_category')
                .setPlaceholder(t.selectCategory)
                .addOptions(categoryOptions);
            
            const categoryRow = new ActionRowBuilder().addComponents(categoryMenu);
            const cancelRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('trivia_cancel').setLabel(t.cancel).setStyle(ButtonStyle.Danger).setEmoji('❌')
            );
            
            const categoryMsg = await message.reply({ embeds: [categoryEmbed], components: [categoryRow, cancelRow] });
            console.log(`[TRIVIA] Category menu sent`);
            
            // ================= CATEGORY COLLECTOR =================
            const categoryCollector = categoryMsg.createMessageComponentCollector({ time: 60000 });
            
            categoryCollector.on('collect', async (i) => {
                if (i.user.id !== userId) {
                    return i.reply({ content: t.accessDenied, ephemeral: true }).catch(() => {});
                }
                
                if (i.customId === 'trivia_cancel') {
                    await i.update({ embeds: [categoryEmbed.setColor('#ED4245')], components: [] }).catch(() => {});
                    categoryCollector.stop();
                    return;
                }
                
                if (i.customId === 'trivia_category') {
                    const selectedCategory = i.values[0];
                    await i.deferUpdate().catch(() => {});
                    categoryCollector.stop();
                    
                    console.log(`[TRIVIA] Category selected: ${selectedCategory}`);
                    
                    // ================= DIFFICULTY SELECTION =================
                    const diffEmbed = new EmbedBuilder()
                        .setColor(CATEGORIES[selectedCategory].color)
                        .setAuthor({ name: `${t.title} • ${CATEGORIES[selectedCategory].emoji} ${CATEGORIES[selectedCategory].name[lang]}`, iconURL: client.user.displayAvatarURL() })
                        .setTitle(lang === 'fr' ? '═ CHOISISSEZ LA DIFFICULTÉ ═' : '═ SELECT DIFFICULTY ═')
                        .setDescription(lang === 'fr' ? 'Choisissez un niveau de difficulté.' : 'Choose a difficulty level.')
                        .addFields(
                            { name: `🟢 ${DIFFICULTIES.easy.name[lang]}`, value: `${DIFFICULTIES.easy.questions} ${lang === 'fr' ? 'questions' : 'questions'} • ${DIFFICULTIES.easy.timeLimit}s • ${DIFFICULTIES.easy.bet} 🪙`, inline: false },
                            { name: `🟡 ${DIFFICULTIES.medium.name[lang]}`, value: `${DIFFICULTIES.medium.questions} ${lang === 'fr' ? 'questions' : 'questions'} • ${DIFFICULTIES.medium.timeLimit}s • ${DIFFICULTIES.medium.bet} 🪙`, inline: false },
                            { name: `🔴 ${DIFFICULTIES.hard.name[lang]}`, value: `${DIFFICULTIES.hard.questions} ${lang === 'fr' ? 'questions' : 'questions'} • ${DIFFICULTIES.hard.timeLimit}s • ${DIFFICULTIES.hard.bet} 🪙`, inline: false }
                        )
                        .addFields({
                            name: `💰 ${t.balance}`,
                            value: `\`${credits.toLocaleString()} 🪙\``,
                            inline: false
                        })
                        .setFooter({ text: `${guildName} • NEURAL TRIVIA • v${version}`, iconURL: guildIcon })
                        .setTimestamp();
                    
                    const diffOptions = Object.entries(DIFFICULTIES).map(([key, diff]) => ({
                        label: `${diff.emoji} ${diff.name[lang]}`.substring(0, 100),
                        value: key,
                        description: `${diff.questions} ${lang === 'fr' ? 'questions' : 'questions'} • ${diff.bet} 🪙`.substring(0, 100)
                    }));
                    
                    const diffMenu = new StringSelectMenuBuilder()
                        .setCustomId('trivia_difficulty')
                        .setPlaceholder(t.selectDifficulty)
                        .addOptions(diffOptions);
                    
                    const diffRow = new ActionRowBuilder().addComponents(diffMenu);
                    const backRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('trivia_back').setLabel(t.back).setStyle(ButtonStyle.Secondary).setEmoji('◀'),
                        new ButtonBuilder().setCustomId('trivia_cancel').setLabel(t.cancel).setStyle(ButtonStyle.Danger).setEmoji('❌')
                    );
                    
                    await categoryMsg.edit({ embeds: [diffEmbed], components: [diffRow, backRow] }).catch(() => {});
                    
                    // ================= DIFFICULTY COLLECTOR =================
                    const diffCollector = categoryMsg.createMessageComponentCollector({ time: 60000 });
                    
                    diffCollector.on('collect', async (j) => {
                        if (j.user.id !== userId) {
                            return j.reply({ content: t.accessDenied, ephemeral: true }).catch(() => {});
                        }
                        
                        if (j.customId === 'trivia_cancel') {
                            await j.update({ embeds: [diffEmbed.setColor('#ED4245')], components: [] }).catch(() => {});
                            diffCollector.stop();
                            return;
                        }
                        
                        if (j.customId === 'trivia_back') {
                            await j.update({ embeds: [categoryEmbed], components: [categoryRow, cancelRow] }).catch(() => {});
                            diffCollector.stop();
                            return;
                        }
                        
                        if (j.customId === 'trivia_difficulty') {
                            const selectedDifficulty = j.values[0];
                            const diff = DIFFICULTIES[selectedDifficulty];
                            
                            console.log(`[TRIVIA] Difficulty selected: ${selectedDifficulty}, Bet: ${diff.bet}`);
                            
                            if (credits < diff.bet) {
                                return j.reply({ content: t.insufficientCredits.replace('{bet}', diff.bet), ephemeral: true }).catch(() => {});
                            }
                            
                            await j.deferUpdate().catch(() => {});
                            diffCollector.stop();
                            
                            // Deduct bet
                            const currentUserData = client.getUserData ? client.getUserData(userId) : userData;
                            if (client.queueUserUpdate) {
                                client.queueUserUpdate(userId, {
                                    ...currentUserData,
                                    credits: (currentUserData.credits || 0) - diff.bet,
                                    username: userName
                                });
                            } else {
                                db.prepare("UPDATE users SET credits = credits - ? WHERE id = ?").run(diff.bet, userId);
                            }
                            
                            // ================= START QUIZ =================
                            const questions = getRandomQuestions(selectedCategory, selectedDifficulty, lang, diff.questions);
                            
                            console.log(`[TRIVIA] Starting quiz with ${questions.length} questions`);
                            
                            if (questions.length === 0) {
                                const errorEmbed = new EmbedBuilder()
                                    .setColor('#ED4245')
                                    .setDescription(lang === 'fr' ? '❌ Aucune question disponible.' : '❌ No questions available.')
                                    .setFooter({ text: `${guildName} • NEURAL TRIVIA • v${version}`, iconURL: guildIcon });
                                return categoryMsg.edit({ embeds: [errorEmbed], components: [] }).catch(() => {});
                            }
                            
                            let currentQuestion = 0;
                            let correctAnswers = 0;
                            let streak = 0;
                            let maxStreak = 0;
                            
                            // ================= QUIZ LOOP =================
                            for (let qIndex = 0; qIndex < questions.length; qIndex++) {
                                currentQuestion = qIndex + 1;
                                const q = questions[qIndex];
                                
                                const questionEmbed = new EmbedBuilder()
                                    .setColor(diff.color)
                                    .setAuthor({ name: `${t.title} • ${CATEGORIES[selectedCategory].emoji} ${CATEGORIES[selectedCategory].name[lang]}`, iconURL: client.user.displayAvatarURL() })
                                    .setTitle(`${t.question} ${currentQuestion}/${questions.length}`)
                                    .setDescription(`**${q.q}**\n\n${q.a.map((ans, idx) => `${['🇦', '🇧', '🇨', '🇩'][idx]} ${ans}`).join('\n')}`)
                                    .addFields(
                                        { name: `🔥 ${t.streak}`, value: `\`${streak}\``, inline: true },
                                        { name: `✅ ${t.correctAnswers}`, value: `\`${correctAnswers}/${questions.length}\``, inline: true },
                                        { name: `⏰ ${t.timeLeft}`, value: `\`${diff.timeLimit}s\``, inline: true }
                                    )
                                    .setFooter({ text: `${guildName} • NEURAL TRIVIA • v${version}`, iconURL: guildIcon })
                                    .setTimestamp();
                                
                                const answerRow = new ActionRowBuilder().addComponents(
                                    new ButtonBuilder().setCustomId('trivia_a').setLabel('A').setStyle(ButtonStyle.Primary),
                                    new ButtonBuilder().setCustomId('trivia_b').setLabel('B').setStyle(ButtonStyle.Primary),
                                    new ButtonBuilder().setCustomId('trivia_c').setLabel('C').setStyle(ButtonStyle.Primary),
                                    new ButtonBuilder().setCustomId('trivia_d').setLabel('D').setStyle(ButtonStyle.Primary)
                                );
                                
                                await categoryMsg.edit({ embeds: [questionEmbed], components: [answerRow] }).catch(() => {});
                                
                                // 🔥 FIXED ANSWER COLLECTOR
                                const answer = await new Promise((resolve) => {
                                    const answerCollector = categoryMsg.createMessageComponentCollector({ time: diff.timeLimit * 1000, max: 1 });
                                    
                                    const timeout = setTimeout(() => {
                                        answerCollector.stop('timeout');
                                        resolve({ timeout: true });
                                    }, diff.timeLimit * 1000);
                                    
                                    answerCollector.on('collect', async (k) => {
                                        if (k.user.id !== userId) {
                                            await k.reply({ content: t.accessDenied, ephemeral: true }).catch(() => {});
                                            return;
                                        }
                                        clearTimeout(timeout);
                                        answerCollector.stop();
                                        
                                        const answerMap = { 'trivia_a': 0, 'trivia_b': 1, 'trivia_c': 2, 'trivia_d': 3 };
                                        const selectedAnswer = answerMap[k.customId];
                                        const isCorrect = selectedAnswer === q.correct;
                                        
                                        // 🔥 SAFE DEFER - catches expired interactions
                                        try {
                                            if (!k.deferred && !k.replied) {
                                                await k.deferUpdate().catch(() => {});
                                            }
                                        } catch (e) {
                                            // Interaction expired - continue anyway
                                        }
                                        
                                        resolve({ isCorrect, selectedAnswer, interaction: k });
                                    });
                                    
                                    answerCollector.on('end', (collected, reason) => {
                                        if (reason === 'timeout') {
                                            resolve({ timeout: true });
                                        }
                                    });
                                });
                                
                                let resultText = '';
                                let resultColor = diff.color;
                                
                                if (answer.timeout) {
                                    resultText = t.timeout;
                                    resultColor = '#95a5a6';
                                    streak = 0;
                                } else {
                                    if (answer.isCorrect) {
                                        correctAnswers++;
                                        streak++;
                                        if (streak > maxStreak) maxStreak = streak;
                                        resultText = t.correct;
                                        resultColor = '#2ecc71';
                                    } else {
                                        resultText = t.incorrect;
                                        resultColor = '#e74c3c';
                                        streak = 0;
                                    }
                                    // 🔥 REMOVED: await answer.interaction.deferUpdate();
                                }
                                
                                const resultEmbed = new EmbedBuilder()
                                    .setColor(resultColor)
                                    .setAuthor({ name: `${t.title} • ${CATEGORIES[selectedCategory].emoji} ${CATEGORIES[selectedCategory].name[lang]}`, iconURL: client.user.displayAvatarURL() })
                                    .setTitle(resultText)
                                    .setDescription(`**${q.q}**\n\n${t.answer}: **${q.a[q.correct]}**`)
                                    .addFields(
                                        { name: `💡 ${t.fact}`, value: q.fact, inline: false },
                                        { name: `🔥 ${t.streak}`, value: `\`${streak}\``, inline: true },
                                        { name: `✅ ${t.correctAnswers}`, value: `\`${correctAnswers}/${currentQuestion}\``, inline: true }
                                    )
                                    .setFooter({ text: `${guildName} • NEURAL TRIVIA • v${version}`, iconURL: guildIcon })
                                    .setTimestamp();
                                
                                const nextRow = new ActionRowBuilder().addComponents(
                                    new ButtonBuilder()
                                        .setCustomId('trivia_next')
                                        .setLabel(currentQuestion === questions.length ? t.gameOver.split('!')[0] : (lang === 'fr' ? 'Suivant' : 'Next'))
                                        .setStyle(ButtonStyle.Success)
                                        .setEmoji(currentQuestion === questions.length ? '🏁' : '▶')
                                );
                                
                                await categoryMsg.edit({ embeds: [resultEmbed], components: [nextRow] }).catch(() => {});
                                
                                await new Promise((resolve) => {
                                    const nextCollector = categoryMsg.createMessageComponentCollector({ time: 30000, max: 1 });
                                    
                                    nextCollector.on('collect', async (k) => {
                                        if (k.user.id !== userId) {
                                            await k.reply({ content: t.accessDenied, ephemeral: true }).catch(() => {});
                                            return;
                                        }
                                        await k.deferUpdate().catch(() => {});
                                        nextCollector.stop();
                                        resolve();
                                    });
                                    
                                    nextCollector.on('end', () => resolve());
                                });
                            }
                            
                            // ================= CALCULATE REWARDS =================
                            const accuracy = (correctAnswers / questions.length) * 100;
                            const baseReward = diff.baseReward;
                            const streakBonus = maxStreak * 25;
                            const accuracyBonus = accuracy >= 80 ? Math.floor(baseReward * 0.5) : 0;
                            const totalReward = baseReward + streakBonus + accuracyBonus;
                            const xpGain = Math.floor((correctAnswers * 25) + (maxStreak * 10) + (accuracy >= 70 ? 50 : 0));
                            
                            console.log(`[TRIVIA] Quiz complete - Score: ${correctAnswers}/${questions.length}, Reward: ${totalReward}, XP: ${xpGain}`);
                            
                            // Update user
                            const finalUserData = client.getUserData ? client.getUserData(userId) : userData;
                            
                            if (finalUserData) {
                                const oldXp = finalUserData.xp || 0;
                                const newXp = oldXp + xpGain;
                                const oldLevel = calculateLevel(oldXp);
                                const newLevel = calculateLevel(newXp);
                                
                                if (client.queueUserUpdate) {
                                    client.queueUserUpdate(userId, {
                                        ...finalUserData,
                                        credits: (finalUserData.credits || 0) + totalReward,
                                        xp: newXp,
                                        level: newLevel,
                                        games_played: (finalUserData.games_played || 0) + 1,
                                        games_won: (finalUserData.games_won || 0) + (correctAnswers >= questions.length / 2 ? 1 : 0),
                                        username: userName
                                    });
                                } else {
                                    db.prepare("UPDATE users SET credits = credits + ?, xp = xp + ?, level = ?, games_played = COALESCE(games_played, 0) + 1, games_won = COALESCE(games_won, 0) + ? WHERE id = ?")
                                        .run(totalReward, xpGain, newLevel, correctAnswers >= questions.length / 2 ? 1 : 0, userId);
                                }
                                
                                if (newLevel > oldLevel) {
                                    const newRank = getRank(newLevel);
                                    const levelUpEmbed = new EmbedBuilder()
                                        .setColor(newRank.color)
                                        .setTitle(t.levelUp)
                                        .setDescription(`**${userName}** ${t.promotedTo} **${newRank.emoji} ${newRank.title[lang]}** (${lang === 'fr' ? 'Niveau' : 'Level'} ${newLevel})!`)
                                        .setFooter({ text: `${guildName} • ARCHITECT CG-223 • v${version}`, iconURL: guildIcon })
                                        .setTimestamp();
                                    await message.channel.send({ embeds: [levelUpEmbed] }).catch(() => {});
                                }
                            }
                            
                            const displayUserData = client.getUserData ? client.getUserData(userId) : finalUserData;
                            const displayLevel = displayUserData?.level || calculateLevel(displayUserData?.xp || 0);
                            const displayRank = getRank(displayLevel);
                            
                            // ================= FINAL RESULTS =================
                            let performanceMessage = '';
                            if (accuracy === 100) performanceMessage = t.perfect;
                            else if (accuracy >= 80) performanceMessage = t.almost;
                            else if (accuracy >= 60) performanceMessage = t.good;
                            else performanceMessage = t.tryAgain;
                            
                            const finalEmbed = new EmbedBuilder()
                                .setColor(displayRank.color)
                                .setAuthor({ name: `${t.title} • ${t.gameOver}`, iconURL: avatarURL })
                                .setTitle(performanceMessage)
                                .setDescription(
                                    `**${userName}** • ${CATEGORIES[selectedCategory].emoji} ${CATEGORIES[selectedCategory].name[lang]} • ${DIFFICULTIES[selectedDifficulty].emoji} ${DIFFICULTIES[selectedDifficulty].name[lang]}\n\n` +
                                    `\`\`\`yaml\n${t.correctAnswers}: ${correctAnswers}/${questions.length}\n${t.accuracy}: ${accuracy.toFixed(1)}%\n${t.streak}: ${maxStreak} 🔥\n\`\`\``
                                )
                                .addFields(
                                    { name: `💰 ${t.reward}`, value: `\`\`\`yaml\n${t.baseReward}: ${baseReward} 🪙\n${t.streakBonus}: ${streakBonus} 🪙\n${t.accuracyBonus}: ${accuracyBonus} 🪙\n${t.total}: ${totalReward} 🪙\`\`\``, inline: true },
                                    { name: `📊 ${t.progress}`, value: `\`\`\`yaml\n${t.xpGained}: ${xpGain} XP\n${lang === 'fr' ? 'Niveau' : 'Level'}: ${displayLevel}\n${displayRank.emoji} ${displayRank.title[lang]}\n${t.balance}: ${displayUserData?.credits?.toLocaleString() || 0} 🪙\`\`\``, inline: true }
                                )
                                .setFooter({ text: `${guildName} • NEURAL TRIVIA • v${version}`, iconURL: guildIcon })
                                .setTimestamp();
                            
                            const finalRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId('trivia_again').setLabel(t.playAgain).setStyle(ButtonStyle.Success).setEmoji('🔄'),
                                new ButtonBuilder().setCustomId('trivia_menu').setLabel(t.mainMenu).setStyle(ButtonStyle.Primary).setEmoji('🏠'),
                                new ButtonBuilder().setCustomId('trivia_games').setLabel(t.backToGames).setStyle(ButtonStyle.Secondary).setEmoji('🎮')
                            );
                            
                            await categoryMsg.edit({ embeds: [finalEmbed], components: [finalRow] }).catch(() => {});
                            
                            const finalCollector = categoryMsg.createMessageComponentCollector({ time: 60000 });
                            
                            finalCollector.on('collect', async (k) => {
                                if (k.user.id !== userId) {
                                    return k.reply({ content: t.accessDenied, ephemeral: true }).catch(() => {});
                                }
                                
                                if (k.customId === 'trivia_again') {
                                    await k.deferUpdate().catch(() => {});
                                    finalCollector.stop();
                                    const triviaCmd = client.commands.get('trivia');
                                    if (triviaCmd) {
                                        await triviaCmd.run(client, message, [], db, serverSettings, usedCommand);
                                    }
                                } else if (k.customId === 'trivia_menu') {
                                    await k.deferUpdate().catch(() => {});
                                    finalCollector.stop();
                                    const helpCmd = client.commands.get('help');
                                    if (helpCmd) {
                                        await helpCmd.run(client, message, [], db, serverSettings, usedCommand);
                                    }
                                } else if (k.customId === 'trivia_games') {
                                    await k.deferUpdate().catch(() => {});
                                    finalCollector.stop();
                                    const gameCmd = client.commands.get('game');
                                    if (gameCmd) {
                                        await gameCmd.run(client, message, ['menu'], db, serverSettings, usedCommand);
                                    }
                                }
                            });
                        }
                    });
                }
            });
            
        } catch (error) {
            console.error(`[TRIVIA FATAL ERROR]`, error);
            return message.reply({ content: "❌ An error occurred with the trivia command. Please try again." }).catch(() => {});
        }
    }
};