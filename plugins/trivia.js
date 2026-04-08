const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType } = require('discord.js');

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
            { q: "What is the most abundant gas in Earth's atmosphere?", a: ["Nitrogen", "Oxygen", "Carbon Dioxide", "Argon"], correct: 0, fact: "Nitrogen makes up about 78% of Earth's atmosphere." },
            { q: "What is the smallest unit of life?", a: ["Cell", "Atom", "Molecule", "Organ"], correct: 0, fact: "Cells are the basic building blocks of all living things." },
            { q: "What is the boiling point of water at sea level?", a: ["100°C", "90°C", "110°C", "80°C"], correct: 0, fact: "Water boils at 100°C (212°F) at standard atmospheric pressure." }
        ],
        fr: [
            { q: "Quel est le symbole chimique de l'or ?", a: ["Au", "Ag", "Fe", "Cu"], correct: 0, fact: "Le symbole 'Au' vient du latin 'aurum'." },
            { q: "Quelle planète est connue comme la Planète Rouge ?", a: ["Mars", "Vénus", "Jupiter", "Mercure"], correct: 0, fact: "Mars apparaît rouge à cause de l'oxyde de fer (rouille) sur sa surface." },
            { q: "Quelle est la substance naturelle la plus dure sur Terre ?", a: ["Diamant", "Or", "Fer", "Platine"], correct: 0, fact: "Le diamant obtient un score parfait de 10 sur l'échelle de Mohs." },
            { q: "Quel est le plus grand organe du corps humain ?", a: ["Peau", "Foie", "Cœur", "Cerveau"], correct: 0, fact: "La peau représente environ 15% de votre poids corporel." },
            { q: "Quelle est la vitesse de la lumière ?", a: ["300 000 km/s", "150 000 km/s", "500 000 km/s", "1 000 000 km/s"], correct: 0, fact: "La lumière voyage à exactement 299 792 458 mètres par seconde." },
            { q: "Quel est le gaz le plus abondant dans l'atmosphère terrestre ?", a: ["Azote", "Oxygène", "Dioxyde de carbone", "Argon"], correct: 0, fact: "L'azote représente environ 78% de l'atmosphère terrestre." },
            { q: "Quelle est la plus petite unité de vie ?", a: ["Cellule", "Atome", "Molécule", "Organe"], correct: 0, fact: "Les cellules sont les éléments constitutifs de tous les êtres vivants." },
            { q: "Quel est le point d'ébullition de l'eau au niveau de la mer ?", a: ["100°C", "90°C", "110°C", "80°C"], correct: 0, fact: "L'eau bout à 100°C à la pression atmosphérique standard." }
        ]
    },
    history: {
        en: [
            { q: "Who was the first President of the United States?", a: ["George Washington", "Thomas Jefferson", "Abraham Lincoln", "John Adams"], correct: 0, fact: "Washington served from 1789 to 1797." },
            { q: "In which year did World War II end?", a: ["1945", "1944", "1946", "1943"], correct: 0, fact: "WWII ended in 1945 with Germany's surrender in May and Japan's in September." },
            { q: "Who painted the Mona Lisa?", a: ["Leonardo da Vinci", "Michelangelo", "Raphael", "Donatello"], correct: 0, fact: "Da Vinci painted the Mona Lisa between 1503 and 1519." },
            { q: "Which ancient civilization built the Machu Picchu?", a: ["Incas", "Mayas", "Aztèques", "Olmèques"], correct: 0, fact: "Machu Picchu was built by the Inca Empire in the 15th century." },
            { q: "Who was the first man on the moon?", a: ["Neil Armstrong", "Buzz Aldrin", "Yuri Gagarin", "Michael Collins"], correct: 0, fact: "Neil Armstrong stepped on the moon on July 20, 1969." },
            { q: "Which empire was ruled by Julius Caesar?", a: ["Roman Empire", "Greek Empire", "Persian Empire", "Ottoman Empire"], correct: 0, fact: "Julius Caesar was a Roman general and statesman." }
        ],
        fr: [
            { q: "Qui était le premier président des États-Unis ?", a: ["George Washington", "Thomas Jefferson", "Abraham Lincoln", "John Adams"], correct: 0, fact: "Washington a servi de 1789 à 1797." },
            { q: "En quelle année la Seconde Guerre mondiale s'est-elle terminée ?", a: ["1945", "1944", "1946", "1943"], correct: 0, fact: "La guerre s'est terminée en 1945 avec la capitulation de l'Allemagne en mai et du Japon en septembre." },
            { q: "Qui a peint la Joconde ?", a: ["Léonard de Vinci", "Michel-Ange", "Raphaël", "Donatello"], correct: 0, fact: "De Vinci a peint la Joconde entre 1503 et 1519." },
            { q: "Quelle civilisation ancienne a construit le Machu Picchu ?", a: ["Incas", "Mayas", "Aztèques", "Olmèques"], correct: 0, fact: "Le Machu Picchu a été construit par l'Empire Inca au 15ème siècle." },
            { q: "Qui était le premier homme sur la lune ?", a: ["Neil Armstrong", "Buzz Aldrin", "Youri Gagarine", "Michael Collins"], correct: 0, fact: "Neil Armstrong a marché sur la lune le 20 juillet 1969." },
            { q: "Quel empire était dirigé par Jules César ?", a: ["Empire Romain", "Empire Grec", "Empire Perse", "Empire Ottoman"], correct: 0, fact: "Jules César était un général et homme d'État romain." }
        ]
    },
    gaming: {
        en: [
            { q: "Which company created Mario?", a: ["Nintendo", "Sega", "Sony", "Microsoft"], correct: 0, fact: "Mario was created by Shigeru Miyamoto and first appeared in Donkey Kong (1981)." },
            { q: "In CODM, what does 'ADS' mean?", a: ["Aim Down Sights", "Auto Deploy System", "Advanced Defense Shield", "Aerial Drop Support"], correct: 0, fact: "ADS refers to aiming down your weapon's sights for better accuracy." },
            { q: "What is the best-selling video game of all time?", a: ["Minecraft", "GTA V", "Tetris", "Wii Sports"], correct: 0, fact: "Minecraft has sold over 300 million copies worldwide." },
            { q: "Which game features 'The King of the Iron Fist Tournament'?", a: ["Tekken", "Street Fighter", "Mortal Kombat", "SoulCalibur"], correct: 0, fact: "Tekken's tournament is sponsored by the Mishima Zaibatsu." },
            { q: "What year was the first Call of Duty released?", a: ["2003", "2001", "2005", "2007"], correct: 0, fact: "The original Call of Duty was released on October 29, 2003." },
            { q: "In Pokemon, what type is Pikachu?", a: ["Electric", "Fire", "Water", "Normal"], correct: 0, fact: "Pikachu is the mascot of the Pokémon franchise." }
        ],
        fr: [
            { q: "Quelle entreprise a créé Mario ?", a: ["Nintendo", "Sega", "Sony", "Microsoft"], correct: 0, fact: "Mario a été créé par Shigeru Miyamoto et est apparu dans Donkey Kong (1981)." },
            { q: "Dans CODM, que signifie 'ADS' ?", a: ["Viser", "Système Auto Déploiement", "Bouclier Défensif Avancé", "Support Aérien"], correct: 0, fact: "L'ADS fait référence au fait de viser avec le viseur de votre arme." },
            { q: "Quel est le jeu vidéo le plus vendu de tous les temps ?", a: ["Minecraft", "GTA V", "Tetris", "Wii Sports"], correct: 0, fact: "Minecraft s'est vendu à plus de 300 millions d'exemplaires dans le monde." },
            { q: "Quel jeu présente 'Le Tournoi du Roi du Poing de Fer' ?", a: ["Tekken", "Street Fighter", "Mortal Kombat", "SoulCalibur"], correct: 0, fact: "Le tournoi de Tekken est sponsorisé par le Mishima Zaibatsu." },
            { q: "En quelle année le premier Call of Duty est-il sorti ?", a: ["2003", "2001", "2005", "2007"], correct: 0, fact: "Le Call of Duty original est sorti le 29 octobre 2003." },
            { q: "Dans Pokemon, quel type est Pikachu ?", a: ["Électrique", "Feu", "Eau", "Normal"], correct: 0, fact: "Pikachu est la mascotte de la franchise Pokémon." }
        ]
    },
    tech: {
        en: [
            { q: "What does CPU stand for?", a: ["Central Processing Unit", "Computer Personal Unit", "Central Program Utility", "Core Processing Utility"], correct: 0, fact: "The CPU is the brain of the computer." },
            { q: "Which company created JavaScript?", a: ["Netscape", "Microsoft", "Google", "Apple"], correct: 0, fact: "JavaScript was created by Brendan Eich at Netscape in 1995." },
            { q: "What does 'HTTP' stand for?", a: ["HyperText Transfer Protocol", "High Tech Transfer Process", "Hyperlink Text Protocol", "Home Tool Transfer Protocol"], correct: 0, fact: "HTTP is the foundation of data communication on the web." },
            { q: "Who is the creator of Linux?", a: ["Linus Torvalds", "Bill Gates", "Steve Jobs", "Mark Zuckerberg"], correct: 0, fact: "Linus Torvalds created Linux in 1991 as a free operating system kernel." },
            { q: "What year was the first iPhone released?", a: ["2007", "2005", "2008", "2006"], correct: 0, fact: "Steve Jobs unveiled the first iPhone on January 9, 2007." },
            { q: "What is the most popular programming language according to GitHub 2024?", a: ["JavaScript", "Python", "Java", "TypeScript"], correct: 0, fact: "JavaScript has remained the most popular language for over a decade." }
        ],
        fr: [
            { q: "Que signifie CPU ?", a: ["Unité Centrale de Traitement", "Unité Personnelle d'Ordinateur", "Utilitaire Central de Programme", "Utilitaire de Traitement Central"], correct: 0, fact: "Le CPU est le cerveau de l'ordinateur." },
            { q: "Quelle entreprise a créé JavaScript ?", a: ["Netscape", "Microsoft", "Google", "Apple"], correct: 0, fact: "JavaScript a été créé par Brendan Eich chez Netscape en 1995." },
            { q: "Que signifie 'HTTP' ?", a: ["Protocole de Transfert HyperTexte", "Processus de Transfert Haute Tech", "Protocole de Texte Hyperlien", "Protocole de Transfert d'Outil Domestique"], correct: 0, fact: "HTTP est la base de la communication de données sur le web." },
            { q: "Qui est le créateur de Linux ?", a: ["Linus Torvalds", "Bill Gates", "Steve Jobs", "Mark Zuckerberg"], correct: 0, fact: "Linus Torvalds a créé Linux en 1991 comme noyau de système d'exploitation gratuit." },
            { q: "En quelle année le premier iPhone est-il sorti ?", a: ["2007", "2005", "2008", "2006"], correct: 0, fact: "Steve Jobs a dévoilé le premier iPhone le 9 janvier 2007." },
            { q: "Quel est le langage de programmation le plus populaire selon GitHub 2024 ?", a: ["JavaScript", "Python", "Java", "TypeScript"], correct: 0, fact: "JavaScript est resté le langage le plus populaire pendant plus d'une décennie." }
        ]
    },
    geography: {
        en: [
            { q: "What is the capital of France?", a: ["Paris", "Lyon", "Marseille", "Bordeaux"], correct: 0, fact: "Paris is known as the City of Light." },
            { q: "Which is the largest ocean on Earth?", a: ["Pacific Ocean", "Atlantic Ocean", "Indian Ocean", "Arctic Ocean"], correct: 0, fact: "The Pacific Ocean covers about 63 million square miles." },
            { q: "What is the capital of Mali?", a: ["Bamako", "Ségou", "Mopti", "Kayes"], correct: 0, fact: "Bamako is the economic and cultural center of Mali." },
            { q: "Which country has the most natural lakes?", a: ["Canada", "USA", "Russia", "Finland"], correct: 0, fact: "Canada has over 2 million lakes covering about 9% of its surface." },
            { q: "What is the longest river in the world?", a: ["Nile", "Amazon", "Yangtze", "Mississippi"], correct: 0, fact: "The Nile River is approximately 6,650 km (4,132 miles) long." },
            { q: "Which continent is the largest?", a: ["Asia", "Africa", "North America", "Europe"], correct: 0, fact: "Asia covers about 30% of Earth's total land area." }
        ],
        fr: [
            { q: "Quelle est la capitale de la France ?", a: ["Paris", "Lyon", "Marseille", "Bordeaux"], correct: 0, fact: "Paris est connue comme la Ville Lumière." },
            { q: "Quel est le plus grand océan sur Terre ?", a: ["Océan Pacifique", "Océan Atlantique", "Océan Indien", "Océan Arctique"], correct: 0, fact: "L'océan Pacifique couvre environ 165 millions de km²." },
            { q: "Quelle est la capitale du Mali ?", a: ["Bamako", "Ségou", "Mopti", "Kayes"], correct: 0, fact: "Bamako est le centre économique et culturel du Mali." },
            { q: "Quel pays a le plus de lacs naturels ?", a: ["Canada", "États-Unis", "Russie", "Finlande"], correct: 0, fact: "Le Canada compte plus de 2 millions de lacs." },
            { q: "Quel est le plus long fleuve du monde ?", a: ["Nil", "Amazone", "Yangtsé", "Mississippi"], correct: 0, fact: "Le Nil mesure environ 6 650 km de long." },
            { q: "Quel continent est le plus grand ?", a: ["Asie", "Afrique", "Amérique du Nord", "Europe"], correct: 0, fact: "L'Asie couvre environ 30% de la surface terrestre." }
        ]
    },
    general: {
        en: [
            { q: "How many days are in a leap year?", a: ["366", "365", "364", "367"], correct: 0, fact: "Leap years occur every 4 years to account for Earth's orbit." },
            { q: "What is the capital of Mali?", a: ["Bamako", "Ségou", "Mopti", "Kayes"], correct: 0, fact: "Bamako is located on the Niger River." },
            { q: "Who created this bot?", a: ["Moussa Fofana", "OpenAI", "Google", "Microsoft"], correct: 0, fact: "Moussa Fofana (MFOF7310) is the Architect of this system." },
            { q: "How many continents are there?", a: ["7", "6", "5", "8"], correct: 0, fact: "The seven continents are: Asia, Africa, North America, South America, Antarctica, Europe, and Australia." },
            { q: "What is the currency of Mali?", a: ["CFA Franc", "Dollar", "Euro", "Pound"], correct: 0, fact: "Mali uses the West African CFA franc (XOF)." }
        ],
        fr: [
            { q: "Combien de jours y a-t-il dans une année bissextile ?", a: ["366", "365", "364", "367"], correct: 0, fact: "Les années bissextiles se produisent tous les 4 ans." },
            { q: "Quelle est la capitale du Mali ?", a: ["Bamako", "Ségou", "Mopti", "Kayes"], correct: 0, fact: "Bamako est située sur le fleuve Niger." },
            { q: "Qui a créé ce bot ?", a: ["Moussa Fofana", "OpenAI", "Google", "Microsoft"], correct: 0, fact: "Moussa Fofana (MFOF7310) est l'Architecte de ce système." },
            { q: "Combien y a-t-il de continents ?", a: ["7", "6", "5", "8"], correct: 0, fact: "Les sept continents sont : Asie, Afrique, Amérique du Nord, Amérique du Sud, Antarctique, Europe et Australie." },
            { q: "Quelle est la monnaie du Mali ?", a: ["Franc CFA", "Dollar", "Euro", "Livre"], correct: 0, fact: "Le Mali utilise le franc CFA d'Afrique de l'Ouest (XOF)." }
        ]
    }
};

// ================= CATEGORY CONFIGURATION =================
const CATEGORIES = {
    science: { emoji: '🔬', color: '#2ecc71', name: { en: 'Science', fr: 'Science' } },
    history: { emoji: '📜', color: '#e67e22', name: { en: 'History', fr: 'Histoire' } },
    gaming: { emoji: '🎮', color: '#9b59b6', name: { en: 'Gaming', fr: 'Jeux Vidéo' } },
    tech: { emoji: '💻', color: '#3498db', name: { en: 'Technology', fr: 'Technologie' } },
    geography: { emoji: '🌍', color: '#1abc9c', name: { en: 'Geography', fr: 'Géographie' } },
    general: { emoji: '🧠', color: '#f1c40f', name: { en: 'General', fr: 'Général' } }
};

// ================= DIFFICULTY CONFIGURATION =================
const DIFFICULTIES = {
    easy: { 
        emoji: '🟢', 
        color: '#2ecc71',
        name: { en: 'Easy', fr: 'Facile' },
        questions: 5,
        baseReward: 50,
        timeLimit: 20,
        bet: 50
    },
    medium: { 
        emoji: '🟡', 
        color: '#f1c40f',
        name: { en: 'Medium', fr: 'Moyen' },
        questions: 7,
        baseReward: 100,
        timeLimit: 15,
        bet: 100
    },
    hard: { 
        emoji: '🔴', 
        color: '#e74c3c',
        name: { en: 'Hard', fr: 'Difficile' },
        questions: 10,
        baseReward: 200,
        timeLimit: 10,
        bet: 200
    },
    expert: { 
        emoji: '👑', 
        color: '#8e44ad',
        name: { en: 'Expert', fr: 'Expert' },
        questions: 15,
        baseReward: 500,
        timeLimit: 8,
        bet: 500
    }
};

// ================= BILINGUAL TRANSLATIONS =================
const texts = {
    en: {
        title: '🧠 NEURAL TRIVIA',
        selectCategory: 'Select a Category',
        selectDifficulty: 'Select Difficulty',
        category: 'Category',
        difficulty: 'Difficulty',
        questions: 'Questions',
        timePerQuestion: 'Time per question',
        bet: 'Bet',
        potentialReward: 'Potential Reward',
        start: 'Start Quiz',
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
        totalQuestions: 'Total',
        accuracy: 'Accuracy',
        reward: 'Reward',
        baseReward: 'Base',
        streakBonus: 'Streak Bonus',
        total: 'Total',
        xpGained: 'XP Gained',
        creditsGained: 'Credits Gained',
        newRank: 'New Rank',
        playAgain: 'Play Again',
        mainMenu: 'Main Menu',
        insufficientCredits: '❌ **Insufficient Credits!** You need {bet} 🪙 to play.',
        balance: 'Balance',
        loading: 'Loading neural database...',
        gameOver: 'Quiz Complete!',
        perfect: '🏆 PERFECT SCORE!',
        almost: 'Great effort!',
        good: 'Well done!',
        tryAgain: 'Try again!'
    },
    fr: {
        title: '🧠 TRIVIA NEURAL',
        selectCategory: 'Choisissez une Catégorie',
        selectDifficulty: 'Choisissez la Difficulté',
        category: 'Catégorie',
        difficulty: 'Difficulté',
        questions: 'Questions',
        timePerQuestion: 'Temps par question',
        bet: 'Mise',
        potentialReward: 'Récompense Potentielle',
        start: 'Commencer',
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
        totalQuestions: 'Total',
        accuracy: 'Précision',
        reward: 'Récompense',
        baseReward: 'Base',
        streakBonus: 'Bonus de Série',
        total: 'Total',
        xpGained: 'XP Gagnés',
        creditsGained: 'Crédits Gagnés',
        newRank: 'Nouveau Rang',
        playAgain: 'Rejouer',
        mainMenu: 'Menu Principal',
        insufficientCredits: '❌ **Crédits Insuffisants !** Vous avez besoin de {bet} 🪙 pour jouer.',
        balance: 'Solde',
        loading: 'Chargement de la base neurale...',
        gameOver: 'Quiz Terminé !',
        perfect: '🏆 SCORE PARFAIT !',
        almost: 'Excellent effort !',
        good: 'Bien joué !',
        tryAgain: 'Réessayez !'
    }
};

// ================= HELPER FUNCTIONS =================
function getRandomQuestions(category, difficulty, lang, count) {
    const questions = TRIVIA_QUESTIONS[category]?.[lang] || TRIVIA_QUESTIONS.general[lang];
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, questions.length));
}

function createProgressBar(percentage, length = 15) {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty));
}

function checkAndAnnounceLevelUp(client, oldXp, newXp, userId, username, channel, lang) {
    const oldLevel = calculateLevel(oldXp);
    const newLevel = calculateLevel(newXp);
    if (newLevel > oldLevel) {
        const rank = getRank(newLevel);
        const version = client.version || '1.5.0';
        const levelUpEmbed = new EmbedBuilder()
            .setColor(rank.color)
            .setAuthor({ name: lang === 'fr' ? '🎉 PROMOTION !' : '🎉 LEVEL UP!', iconURL: client.user.displayAvatarURL() })
            .setTitle(lang === 'fr' ? '═ PROMOTION D\'AGENT ═' : '═ AGENT PROMOTION ═')
            .setDescription(`${lang === 'fr' ? 'Félicitations' : 'Congratulations'} **${username}**! ${lang === 'fr' ? 'Vous êtes promu' : 'You\'ve been promoted to'} **${rank.emoji} ${rank.title[lang]}** (${lang === 'fr' ? 'Niveau' : 'Level'} ${newLevel})`)
            .addFields(
                { name: '📊 PROGRESSION', value: `${lang === 'fr' ? 'Niveau' : 'Level'} ${oldLevel} → ${newLevel}`, inline: true },
                { name: '🎯 RANG', value: `${rank.emoji} ${rank.title[lang]}`, inline: true }
            )
            .setFooter({ text: `ARCHITECT CG-223 • v${version}` })
            .setTimestamp();
        channel.send({ embeds: [levelUpEmbed] });
        return true;
    }
    return false;
}

// ================= MAIN COMMAND =================
module.exports = {
    name: 'trivia',
    aliases: ['quiz', 'culture', 'questions', 'trivial'],
    description: '🧠 Test your knowledge with the Neural Trivia System!',
    category: 'GAMING',
    usage: '.trivia',
    cooldown: 3000,
    examples: ['.trivia'],

    run: async (client, message, args, database) => {
        const db = database;
        
        // --- LANGUAGE DETECTION ---
        let lang = 'en';
        const guildSettings = client.settings?.get(message.guild?.id);
        if (guildSettings?.language) {
            lang = guildSettings.language;
        } else {
            const frenchKeywords = ['fr', 'francais', 'français', 'culture', 'questions'];
            const content = message.content.toLowerCase();
            if (frenchKeywords.some(word => content.includes(word)) || message.guild?.preferredLocale === 'fr') {
                lang = 'fr';
            }
        }
        const t = texts[lang];
        const version = client.version || '1.5.0';
        
        const userId = message.author.id;
        const userName = message.author.username;
        const avatarURL = message.author.displayAvatarURL({ dynamic: true, size: 256 });
        
        // --- GET USER DATA ---
        let userData = db.prepare("SELECT xp, credits FROM users WHERE id = ?").get(userId);
        if (!userData) {
            db.prepare("INSERT INTO users (id, username, xp, credits, level) VALUES (?, ?, 0, 0, 1)").run(userId, userName);
            userData = { xp: 0, credits: 0 };
        }
        
        const credits = userData.credits || 0;
        const userLevel = calculateLevel(userData.xp || 0);
        const userRank = getRank(userLevel);
        
        let selectedCategory = null;
        let selectedDifficulty = null;
        
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
                { name: `💻 ${CATEGORIES.tech.name[lang]}`, value: `${lang === 'fr' ? 'Programmation, hardware, internet' : 'Programming, hardware, internet'}`, inline: true },
                { name: `🌍 ${CATEGORIES.geography.name[lang]}`, value: `${lang === 'fr' ? 'Pays, capitales, géographie' : 'Countries, capitals, geography'}`, inline: true },
                { name: `🧠 ${CATEGORIES.general.name[lang]}`, value: `${lang === 'fr' ? 'Culture générale mélangée' : 'Mixed general knowledge'}`, inline: true }
            )
            .addFields({
                name: `💰 ${t.balance}`,
                value: `\`${credits.toLocaleString()} 🪙\` • ${userRank.emoji} ${userRank.title[lang]} (${lang === 'fr' ? 'Niv.' : 'Lvl.'} ${userLevel})`,
                inline: false
            })
            .setFooter({ text: `ARCHITECT CG-223 • v${version}` })
            .setTimestamp();
        
        const categoryOptions = Object.entries(CATEGORIES).map(([key, cat]) => ({
            label: `${cat.emoji} ${cat.name[lang]}`,
            value: key,
            description: `${lang === 'fr' ? 'Jouer en catégorie' : 'Play in'} ${cat.name[lang]}`
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
        
        // ================= CATEGORY COLLECTOR =================
        const categoryCollector = categoryMsg.createMessageComponentCollector({ time: 60000 });
        
        categoryCollector.on('collect', async (i) => {
            if (i.user.id !== userId) {
                return i.reply({ content: lang === 'fr' ? '❌ Ce menu ne vous appartient pas.' : '❌ This menu is not yours.', ephemeral: true });
            }
            
            if (i.customId === 'trivia_cancel') {
                await i.update({ embeds: [categoryEmbed.setColor('#ED4245').setFooter({ text: lang === 'fr' ? '❌ Quiz annulé' : '❌ Quiz cancelled' })], components: [] });
                return categoryCollector.stop();
            }
            
            if (i.customId === 'trivia_category') {
                selectedCategory = i.values[0];
                await i.deferUpdate();
                categoryCollector.stop();
                
                // ================= DIFFICULTY SELECTION =================
                const diffEmbed = new EmbedBuilder()
                    .setColor(CATEGORIES[selectedCategory].color)
                    .setAuthor({ name: `${t.title} • ${CATEGORIES[selectedCategory].emoji} ${CATEGORIES[selectedCategory].name[lang]}`, iconURL: client.user.displayAvatarURL() })
                    .setTitle(lang === 'fr' ? '═ CHOISISSEZ LA DIFFICULTÉ ═' : '═ SELECT DIFFICULTY ═')
                    .setDescription(lang === 'fr' ? 'Choisissez un niveau de difficulté.' : 'Choose a difficulty level.')
                    .addFields(
                        { name: `🟢 ${DIFFICULTIES.easy.name[lang]}`, value: `${DIFFICULTIES.easy.questions} ${lang === 'fr' ? 'questions' : 'questions'} • ${DIFFICULTIES.easy.timeLimit}s/${lang === 'fr' ? 'question' : 'question'} • ${DIFFICULTIES.easy.bet} 🪙`, inline: false },
                        { name: `🟡 ${DIFFICULTIES.medium.name[lang]}`, value: `${DIFFICULTIES.medium.questions} ${lang === 'fr' ? 'questions' : 'questions'} • ${DIFFICULTIES.medium.timeLimit}s/${lang === 'fr' ? 'question' : 'question'} • ${DIFFICULTIES.medium.bet} 🪙`, inline: false },
                        { name: `🔴 ${DIFFICULTIES.hard.name[lang]}`, value: `${DIFFICULTIES.hard.questions} ${lang === 'fr' ? 'questions' : 'questions'} • ${DIFFICULTIES.hard.timeLimit}s/${lang === 'fr' ? 'question' : 'question'} • ${DIFFICULTIES.hard.bet} 🪙`, inline: false },
                        { name: `👑 ${DIFFICULTIES.expert.name[lang]}`, value: `${DIFFICULTIES.expert.questions} ${lang === 'fr' ? 'questions' : 'questions'} • ${DIFFICULTIES.expert.timeLimit}s/${lang === 'fr' ? 'question' : 'question'} • ${DIFFICULTIES.expert.bet} 🪙`, inline: false }
                    )
                    .addFields({
                        name: `💰 ${t.balance}`,
                        value: `\`${credits.toLocaleString()} 🪙\``,
                        inline: false
                    })
                    .setFooter({ text: `ARCHITECT CG-223 • v${version}` })
                    .setTimestamp();
                
                const diffOptions = Object.entries(DIFFICULTIES).map(([key, diff]) => ({
                    label: `${diff.emoji} ${diff.name[lang]}`,
                    value: key,
                    description: `${diff.questions} ${lang === 'fr' ? 'questions' : 'questions'} • ${diff.bet} 🪙`
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
                
                await categoryMsg.edit({ embeds: [diffEmbed], components: [diffRow, backRow] });
                
                // ================= DIFFICULTY COLLECTOR =================
                const diffCollector = categoryMsg.createMessageComponentCollector({ time: 60000 });
                
                diffCollector.on('collect', async (j) => {
                    if (j.user.id !== userId) {
                        return j.reply({ content: lang === 'fr' ? '❌ Ce menu ne vous appartient pas.' : '❌ This menu is not yours.', ephemeral: true });
                    }
                    
                    if (j.customId === 'trivia_cancel') {
                        await j.update({ embeds: [diffEmbed.setColor('#ED4245').setFooter({ text: lang === 'fr' ? '❌ Quiz annulé' : '❌ Quiz cancelled' })], components: [] });
                        return diffCollector.stop();
                    }
                    
                    if (j.customId === 'trivia_back') {
                        await j.update({ embeds: [categoryEmbed], components: [categoryRow, cancelRow] });
                        diffCollector.stop();
                        return;
                    }
                    
                    if (j.customId === 'trivia_difficulty') {
                        selectedDifficulty = j.values[0];
                        const diff = DIFFICULTIES[selectedDifficulty];
                        
                        // Check credits
                        if (credits < diff.bet) {
                            await j.reply({ content: t.insufficientCredits.replace('{bet}', diff.bet), ephemeral: true });
                            return;
                        }
                        
                        await j.deferUpdate();
                        diffCollector.stop();
                        
                        // Deduct bet
                        db.prepare("UPDATE users SET credits = credits - ? WHERE id = ?").run(diff.bet, userId);
                        
                        // ================= START QUIZ =================
                        const questions = getRandomQuestions(selectedCategory, selectedDifficulty, lang, diff.questions);
                        
                        if (questions.length === 0) {
                            const errorEmbed = new EmbedBuilder()
                                .setColor('#ED4245')
                                .setDescription(lang === 'fr' ? '❌ Aucune question disponible dans cette catégorie.' : '❌ No questions available in this category.');
                            return categoryMsg.edit({ embeds: [errorEmbed], components: [] });
                        }
                        
                        let currentQuestion = 0;
                        let correctAnswers = 0;
                        let streak = 0;
                        let maxStreak = 0;
                        const startTime = Date.now();
                        
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
                                .setFooter({ text: `ARCHITECT CG-223 • v${version}` })
                                .setTimestamp();
                            
                            const answerRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId('trivia_a').setLabel('A').setStyle(ButtonStyle.Primary),
                                new ButtonBuilder().setCustomId('trivia_b').setLabel('B').setStyle(ButtonStyle.Primary),
                                new ButtonBuilder().setCustomId('trivia_c').setLabel('C').setStyle(ButtonStyle.Primary),
                                new ButtonBuilder().setCustomId('trivia_d').setLabel('D').setStyle(ButtonStyle.Primary)
                            );
                            
                            await categoryMsg.edit({ embeds: [questionEmbed], components: [answerRow] });
                            
                            // Wait for answer
                            const answer = await new Promise((resolve) => {
                                const answerCollector = categoryMsg.createMessageComponentCollector({ time: diff.timeLimit * 1000, max: 1 });
                                
                                const timeout = setTimeout(() => {
                                    answerCollector.stop('timeout');
                                    resolve({ timeout: true });
                                }, diff.timeLimit * 1000);
                                
                                answerCollector.on('collect', async (k) => {
                                    if (k.user.id !== userId) {
                                        await k.reply({ content: lang === 'fr' ? '❌ Ce quiz ne vous appartient pas.' : '❌ This quiz is not yours.', ephemeral: true });
                                        return;
                                    }
                                    clearTimeout(timeout);
                                    answerCollector.stop();
                                    
                                    const answerMap = { 'trivia_a': 0, 'trivia_b': 1, 'trivia_c': 2, 'trivia_d': 3 };
                                    const selectedAnswer = answerMap[k.customId];
                                    const isCorrect = selectedAnswer === q.correct;
                                    
                                    resolve({ isCorrect, selectedAnswer, interaction: k });
                                });
                                
                                answerCollector.on('end', (collected, reason) => {
                                    if (reason === 'timeout') {
                                        resolve({ timeout: true });
                                    }
                                });
                            });
                            
                            // Process answer
                            let resultText = '';
                            let resultColor = diff.color;
                            
                            if (answer.timeout) {
                                resultText = t.timeout;
                                resultColor = '#95a5a6';
                                streak = 0;
                            } else {
                                const isCorrect = answer.isCorrect;
                                if (isCorrect) {
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
                                
                                await answer.interaction.deferUpdate();
                            }
                            
                            // Show result
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
                                .setFooter({ text: `ARCHITECT CG-223 • v${version}` })
                                .setTimestamp();
                            
                            const nextRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setCustomId('trivia_next')
                                    .setLabel(currentQuestion === questions.length ? t.gameOver.split('!')[0] : (lang === 'fr' ? 'Suivant' : 'Next'))
                                    .setStyle(ButtonStyle.Success)
                                    .setEmoji(currentQuestion === questions.length ? '🏁' : '▶')
                            );
                            
                            await categoryMsg.edit({ embeds: [resultEmbed], components: [nextRow] });
                            
                            // Wait for next button
                            await new Promise((resolve) => {
                                const nextCollector = categoryMsg.createMessageComponentCollector({ time: 30000, max: 1 });
                                
                                nextCollector.on('collect', async (k) => {
                                    if (k.user.id !== userId) {
                                        await k.reply({ content: lang === 'fr' ? '❌ Ce quiz ne vous appartient pas.' : '❌ This quiz is not yours.', ephemeral: true });
                                        return;
                                    }
                                    await k.deferUpdate();
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
                        
                        // Update database
                        const oldUser = db.prepare("SELECT xp FROM users WHERE id = ?").get(userId);
                        const oldXp = oldUser?.xp || 0;
                        
                        db.prepare("UPDATE users SET credits = credits + ?, xp = xp + ?, games_played = COALESCE(games_played, 0) + 1, games_won = COALESCE(games_won, 0) + ? WHERE id = ?")
                            .run(totalReward, xpGain, correctAnswers >= questions.length / 2 ? 1 : 0, userId);
                        
                        const newUser = db.prepare("SELECT xp, credits FROM users WHERE id = ?").get(userId);
                        const newLevel = calculateLevel(newUser.xp);
                        const newRank = getRank(newLevel);
                        
                        checkAndAnnounceLevelUp(client, oldXp, newUser.xp, userId, userName, message.channel, lang);
                        
                        // ================= FINAL RESULTS =================
                        let performanceMessage = '';
                        if (accuracy === 100) performanceMessage = t.perfect;
                        else if (accuracy >= 80) performanceMessage = t.almost;
                        else if (accuracy >= 60) performanceMessage = t.good;
                        else performanceMessage = t.tryAgain;
                        
                        const finalEmbed = new EmbedBuilder()
                            .setColor(newRank.color)
                            .setAuthor({ name: `${t.title} • ${t.gameOver}`, iconURL: avatarURL })
                            .setTitle(performanceMessage)
                            .setDescription(
                                `**${userName}** • ${CATEGORIES[selectedCategory].emoji} ${CATEGORIES[selectedCategory].name[lang]} • ${DIFFICULTIES[selectedDifficulty].emoji} ${DIFFICULTIES[selectedDifficulty].name[lang]}\n\n` +
                                `\`\`\`yaml\n` +
                                `${t.correctAnswers}: ${correctAnswers}/${questions.length}\n` +
                                `${t.accuracy}: ${accuracy.toFixed(1)}%\n` +
                                `${t.streak}: ${maxStreak} 🔥\n` +
                                `\`\`\``
                            )
                            .addFields(
                                { name: `💰 ${t.reward}`, value: `\`\`\`yaml\n${t.baseReward}: ${baseReward} 🪙\n${t.streakBonus}: ${streakBonus} 🪙\n${lang === 'fr' ? 'Bonus Précision' : 'Accuracy Bonus'}: ${accuracyBonus} 🪙\n${t.total}: ${totalReward} 🪙\`\`\``, inline: true },
                                { name: `📊 ${t.progress || 'Progress'}`, value: `\`\`\`yaml\n${t.xpGained}: ${xpGain} XP\n${lang === 'fr' ? 'Niveau' : 'Level'}: ${newLevel}\n${newRank.emoji} ${newRank.title[lang]}\n${t.balance}: ${newUser.credits.toLocaleString()} 🪙\`\`\``, inline: true }
                            )
                            .setFooter({ text: `ARCHITECT CG-223 • v${version}` })
                            .setTimestamp();
                        
                        const finalRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('trivia_again').setLabel(t.playAgain).setStyle(ButtonStyle.Success).setEmoji('🔄'),
                            new ButtonBuilder().setCustomId('trivia_menu').setLabel(t.mainMenu).setStyle(ButtonStyle.Primary).setEmoji('🏠')
                        );
                        
                        await categoryMsg.edit({ embeds: [finalEmbed], components: [finalRow] });
                        
                        // Final collector
                        const finalCollector = categoryMsg.createMessageComponentCollector({ time: 60000 });
                        
                        finalCollector.on('collect', async (k) => {
                            if (k.user.id !== userId) {
                                return k.reply({ content: lang === 'fr' ? '❌ Ce menu ne vous appartient pas.' : '❌ This menu is not yours.', ephemeral: true });
                            }
                            
                            if (k.customId === 'trivia_again') {
                                await k.deferUpdate();
                                finalCollector.stop();
                                // Restart quiz
                                const triviaCmd = client.commands.get('trivia');
                                if (triviaCmd) {
                                    await triviaCmd.run(client, message, [], db);
                                }
                            } else if (k.customId === 'trivia_menu') {
                                await k.deferUpdate();
                                finalCollector.stop();
                                // Back to game menu
                                const gameCmd = client.commands.get('game');
                                if (gameCmd) {
                                    await gameCmd.run(client, message, ['menu'], db);
                                }
                            }
                        });
                    }
                });
            }
        });
    }
};