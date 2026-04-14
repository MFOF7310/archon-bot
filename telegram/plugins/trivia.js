// ================= TRIVIA QUIZ SYSTEM v1.7.0 =================
const activeGames = new Map();

// ================= EXPANDED QUESTION DATABASE =================
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
            { q: "What is the boiling point of water at sea level?", a: ["100°C", "90°C", "110°C", "80°C"], correct: 0, fact: "Water boils at 100°C (212°F) at standard atmospheric pressure." },
            { q: "What is the powerhouse of the cell?", a: ["Mitochondria", "Nucleus", "Ribosome", "Golgi"], correct: 0, fact: "Mitochondria generate most of the cell's chemical energy." },
            { q: "What is the pH of pure water?", a: ["7", "0", "14", "5"], correct: 0, fact: "Pure water has a neutral pH of 7." }
        ],
        fr: [
            { q: "Quel est le symbole chimique de l'or ?", a: ["Au", "Ag", "Fe", "Cu"], correct: 0, fact: "Le symbole 'Au' vient du latin 'aurum'." },
            { q: "Quelle planète est connue comme la Planète Rouge ?", a: ["Mars", "Vénus", "Jupiter", "Mercure"], correct: 0, fact: "Mars apparaît rouge à cause de l'oxyde de fer (rouille) sur sa surface." },
            { q: "Quelle est la substance naturelle la plus dure sur Terre ?", a: ["Diamant", "Or", "Fer", "Platine"], correct: 0, fact: "Le diamant obtient un score parfait de 10 sur l'échelle de Mohs." },
            { q: "Quel est le plus grand organe du corps humain ?", a: ["Peau", "Foie", "Cœur", "Cerveau"], correct: 0, fact: "La peau représente environ 15% de votre poids corporel." },
            { q: "Quelle est la vitesse de la lumière ?", a: ["300 000 km/s", "150 000 km/s", "500 000 km/s", "1 000 000 km/s"], correct: 0, fact: "La lumière voyage à exactement 299 792 458 mètres par seconde." }
        ]
    },
    history: {
        en: [
            { q: "Who was the first President of the United States?", a: ["George Washington", "Thomas Jefferson", "Abraham Lincoln", "John Adams"], correct: 0, fact: "Washington served from 1789 to 1797." },
            { q: "In which year did World War II end?", a: ["1945", "1944", "1946", "1943"], correct: 0, fact: "WWII ended in 1945 with Germany's surrender in May and Japan's in September." },
            { q: "Who painted the Mona Lisa?", a: ["Leonardo da Vinci", "Michelangelo", "Raphael", "Donatello"], correct: 0, fact: "Da Vinci painted the Mona Lisa between 1503 and 1519." },
            { q: "Which ancient civilization built Machu Picchu?", a: ["Inca", "Maya", "Aztec", "Olmec"], correct: 0, fact: "Machu Picchu was built by the Inca Empire in the 15th century." },
            { q: "Who was the first man on the moon?", a: ["Neil Armstrong", "Buzz Aldrin", "Yuri Gagarin", "Michael Collins"], correct: 0, fact: "Neil Armstrong stepped on the moon on July 20, 1969." }
        ],
        fr: [
            { q: "Qui était le premier président des États-Unis ?", a: ["George Washington", "Thomas Jefferson", "Abraham Lincoln", "John Adams"], correct: 0, fact: "Washington a servi de 1789 à 1797." },
            { q: "En quelle année la Seconde Guerre mondiale s'est-elle terminée ?", a: ["1945", "1944", "1946", "1943"], correct: 0, fact: "La guerre s'est terminée en 1945." },
            { q: "Qui a peint la Joconde ?", a: ["Léonard de Vinci", "Michel-Ange", "Raphaël", "Donatello"], correct: 0, fact: "De Vinci a peint la Joconde entre 1503 et 1519." }
        ]
    },
    gaming: {
        en: [
            { q: "Which company created Mario?", a: ["Nintendo", "Sega", "Sony", "Microsoft"], correct: 0, fact: "Mario was created by Shigeru Miyamoto and first appeared in Donkey Kong (1981)." },
            { q: "What is the best-selling video game of all time?", a: ["Minecraft", "GTA V", "Tetris", "Wii Sports"], correct: 0, fact: "Minecraft has sold over 300 million copies worldwide." },
            { q: "In Pokemon, what type is Pikachu?", a: ["Electric", "Fire", "Water", "Normal"], correct: 0, fact: "Pikachu is the mascot of the Pokémon franchise." },
            { q: "Which game features 'The King of the Iron Fist Tournament'?", a: ["Tekken", "Street Fighter", "Mortal Kombat", "SoulCalibur"], correct: 0, fact: "Tekken's tournament is sponsored by the Mishima Zaibatsu." }
        ],
        fr: [
            { q: "Quelle entreprise a créé Mario ?", a: ["Nintendo", "Sega", "Sony", "Microsoft"], correct: 0, fact: "Mario a été créé par Shigeru Miyamoto." },
            { q: "Quel est le jeu vidéo le plus vendu ?", a: ["Minecraft", "GTA V", "Tetris", "Wii Sports"], correct: 0, fact: "Minecraft s'est vendu à plus de 300 millions d'exemplaires." }
        ]
    },
    technology: {
        en: [
            { q: "What does CPU stand for?", a: ["Central Processing Unit", "Computer Personal Unit", "Central Program Utility", "Core Processing Utility"], correct: 0, fact: "The CPU is the brain of the computer." },
            { q: "Who created Linux?", a: ["Linus Torvalds", "Bill Gates", "Steve Jobs", "Mark Zuckerberg"], correct: 0, fact: "Linus Torvalds created Linux in 1991." },
            { q: "What year was the first iPhone released?", a: ["2007", "2005", "2008", "2006"], correct: 0, fact: "Steve Jobs unveiled the first iPhone on January 9, 2007." },
            { q: "What does 'AI' stand for?", a: ["Artificial Intelligence", "Automated Interface", "Advanced Integration", "Algorithmic Input"], correct: 0, fact: "AI refers to machines that can perform tasks requiring human intelligence." }
        ],
        fr: [
            { q: "Que signifie CPU ?", a: ["Unité Centrale de Traitement", "Unité Personnelle d'Ordinateur", "Utilitaire Central de Programme", "Utilitaire de Traitement Central"], correct: 0, fact: "Le CPU est le cerveau de l'ordinateur." },
            { q: "Qui a créé Linux ?", a: ["Linus Torvalds", "Bill Gates", "Steve Jobs", "Mark Zuckerberg"], correct: 0, fact: "Linus Torvalds a créé Linux en 1991." }
        ]
    },
    geography: {
        en: [
            { q: "What is the capital of France?", a: ["Paris", "Lyon", "Marseille", "Bordeaux"], correct: 0, fact: "Paris is known as the City of Light." },
            { q: "Which is the largest ocean on Earth?", a: ["Pacific Ocean", "Atlantic Ocean", "Indian Ocean", "Arctic Ocean"], correct: 0, fact: "The Pacific Ocean covers about 63 million square miles." },
            { q: "What is the longest river in the world?", a: ["Nile", "Amazon", "Yangtze", "Mississippi"], correct: 0, fact: "The Nile River is approximately 6,650 km long." },
            { q: "Which continent is the largest?", a: ["Asia", "Africa", "North America", "Europe"], correct: 0, fact: "Asia covers about 30% of Earth's total land area." },
            { q: "What is the highest mountain in the world?", a: ["Mount Everest", "K2", "Kangchenjunga", "Lhotse"], correct: 0, fact: "Mount Everest stands at 8,848 meters." },
            { q: "What is the smallest country in the world?", a: ["Vatican City", "Monaco", "San Marino", "Liechtenstein"], correct: 0, fact: "Vatican City is only 0.44 square kilometers." }
        ],
        fr: [
            { q: "Quelle est la capitale de la France ?", a: ["Paris", "Lyon", "Marseille", "Bordeaux"], correct: 0, fact: "Paris est connue comme la Ville Lumière." },
            { q: "Quel est le plus grand océan sur Terre ?", a: ["Océan Pacifique", "Océan Atlantique", "Océan Indien", "Océan Arctique"], correct: 0, fact: "L'océan Pacifique couvre environ 165 millions de km²." }
        ]
    },
    space: {
        en: [
            { q: "What is the closest planet to the Sun?", a: ["Mercury", "Venus", "Earth", "Mars"], correct: 0, fact: "Mercury orbits the Sun at an average distance of 58 million km." },
            { q: "How many moons does Mars have?", a: ["2", "1", "3", "0"], correct: 0, fact: "Mars has two moons: Phobos and Deimos." },
            { q: "What is the largest planet in our solar system?", a: ["Jupiter", "Saturn", "Neptune", "Uranus"], correct: 0, fact: "Jupiter is more than twice as massive as all other planets combined." },
            { q: "What is the name of our galaxy?", a: ["Milky Way", "Andromeda", "Triangulum", "Sombrero"], correct: 0, fact: "The Milky Way contains over 100 billion stars." }
        ],
        fr: [
            { q: "Quelle est la planète la plus proche du Soleil ?", a: ["Mercure", "Vénus", "Terre", "Mars"], correct: 0, fact: "Mercure orbite autour du Soleil à une distance moyenne de 58 millions de km." },
            { q: "Combien de lunes Mars possède-t-elle ?", a: ["2", "1", "3", "0"], correct: 0, fact: "Mars a deux lunes : Phobos et Deimos." }
        ]
    },
    animals: {
        en: [
            { q: "What is the largest animal on Earth?", a: ["Blue Whale", "African Elephant", "Giraffe", "Great White Shark"], correct: 0, fact: "Blue whales can grow up to 30 meters long and weigh over 180 tons." },
            { q: "What is the fastest land animal?", a: ["Cheetah", "Lion", "Peregrine Falcon", "Pronghorn"], correct: 0, fact: "Cheetahs can reach speeds of up to 120 km/h." },
            { q: "How many hearts does an octopus have?", a: ["3", "1", "2", "4"], correct: 0, fact: "Octopuses have three hearts." },
            { q: "What is the only mammal capable of true flight?", a: ["Bat", "Flying Squirrel", "Colugo", "Sugar Glider"], correct: 0, fact: "Bats are the only mammals that can truly fly." }
        ],
        fr: [
            { q: "Quel est le plus grand animal sur Terre ?", a: ["Baleine Bleue", "Éléphant d'Afrique", "Girafe", "Grand Requin Blanc"], correct: 0, fact: "Les baleines bleues peuvent atteindre 30 mètres de long." },
            { q: "Quel est l'animal terrestre le plus rapide ?", a: ["Guépard", "Lion", "Faucon Pèlerin", "Antilope"], correct: 0, fact: "Les guépards peuvent atteindre des vitesses de 120 km/h." }
        ]
    },
    sports: {
        en: [
            { q: "How many players are on a football (soccer) team?", a: ["11", "10", "12", "9"], correct: 0, fact: "Each team has 11 players on the field." },
            { q: "Which country has won the most FIFA World Cups?", a: ["Brazil", "Germany", "Italy", "Argentina"], correct: 0, fact: "Brazil has won the World Cup 5 times." },
            { q: "In which sport would you perform a 'slam dunk'?", a: ["Basketball", "Volleyball", "Tennis", "Baseball"], correct: 0, fact: "A slam dunk is when a player jumps and forcefully scores." }
        ],
        fr: [
            { q: "Combien de joueurs dans une équipe de football ?", a: ["11", "10", "12", "9"], correct: 0, fact: "Chaque équipe a 11 joueurs sur le terrain." },
            { q: "Quel pays a gagné le plus de Coupes du Monde FIFA ?", a: ["Brésil", "Allemagne", "Italie", "Argentine"], correct: 0, fact: "Le Brésil a remporté la Coupe du Monde 5 fois." }
        ]
    },
    mali: {
        en: [
            { q: "What is the capital of Mali?", a: ["Bamako", "Ségou", "Mopti", "Kayes"], correct: 0, fact: "Bamako is located on the Niger River and is Mali's largest city." },
            { q: "Who was Mansa Musa?", a: ["Emperor of Mali", "King of Ghana", "Pharaoh of Egypt", "Chief of Zulu"], correct: 0, fact: "Mansa Musa is considered one of the wealthiest people in history." },
            { q: "Which city was a center of learning in the Mali Empire?", a: ["Timbuktu", "Bamako", "Gao", "Djenné"], correct: 0, fact: "Timbuktu was home to the famous Sankore University." },
            { q: "When did Mali gain independence from France?", a: ["1960", "1958", "1962", "1954"], correct: 0, fact: "Mali became independent on September 22, 1960." }
        ],
        fr: [
            { q: "Quelle est la capitale du Mali ?", a: ["Bamako", "Ségou", "Mopti", "Kayes"], correct: 0, fact: "Bamako est située sur le fleuve Niger." },
            { q: "Qui était Mansa Moussa ?", a: ["Empereur du Mali", "Roi du Ghana", "Pharaon d'Égypte", "Chef Zoulou"], correct: 0, fact: "Mansa Moussa est l'une des personnes les plus riches de l'histoire." }
        ]
    },
    general: {
        en: [
            { q: "How many days in a leap year?", a: ["366", "365", "364", "367"], correct: 0, fact: "Leap years occur every 4 years to sync with Earth's orbit." },
            { q: "Who created this bot?", a: ["Moussa Fofana", "OpenAI", "Google", "Microsoft"], correct: 0, fact: "Moussa Fofana (@mfof7310) is the Architect of this bot." },
            { q: "How many continents are there?", a: ["7", "6", "5", "8"], correct: 0, fact: "The seven continents are: Asia, Africa, North America, South America, Antarctica, Europe, Australia." },
            { q: "What is the currency of Mali?", a: ["CFA Franc", "Dollar", "Euro", "Pound"], correct: 0, fact: "Mali uses the West African CFA franc (XOF)." },
            { q: "What is the largest country in Africa?", a: ["Algeria", "DR Congo", "Sudan", "Libya"], correct: 0, fact: "Algeria covers 2.38 million square kilometers." }
        ],
        fr: [
            { q: "Combien de jours dans une année bissextile ?", a: ["366", "365", "364", "367"], correct: 0, fact: "Les années bissextiles se produisent tous les 4 ans." },
            { q: "Qui a créé ce bot ?", a: ["Moussa Fofana", "OpenAI", "Google", "Microsoft"], correct: 0, fact: "Moussa Fofana (@mfof7310) est l'Architecte de ce bot." }
        ]
    }
};

// Category configuration
const CATEGORIES = {
    science: { emoji: '🔬', name: { en: 'Science', fr: 'Science' } },
    history: { emoji: '📜', name: { en: 'History', fr: 'Histoire' } },
    gaming: { emoji: '🎮', name: { en: 'Gaming', fr: 'Jeux Vidéo' } },
    technology: { emoji: '💻', name: { en: 'Technology', fr: 'Technologie' } },
    geography: { emoji: '🌍', name: { en: 'Geography', fr: 'Géographie' } },
    space: { emoji: '🚀', name: { en: 'Space', fr: 'Espace' } },
    animals: { emoji: '🐾', name: { en: 'Animals', fr: 'Animaux' } },
    sports: { emoji: '⚽', name: { en: 'Sports', fr: 'Sports' } },
    mali: { emoji: '🇲🇱', name: { en: 'Mali', fr: 'Mali' } },
    general: { emoji: '🧠', name: { en: 'General', fr: 'Général' } }
};

module.exports = {
    name: 'trivia',
    aliases: ['quiz', 'play', 'game'],
    activeGames: activeGames, // Export for bot.js
    
    handler: async (ctx) => {
        const args = ctx.args || [];
        const chatId = ctx.chatId.toString();
        const username = ctx.username;
        const client = ctx.client;
        const version = client.version || '1.7.0';
        const botName = client.user?.username || 'Architect CG-223';
        
        // Check if game already active
        if (activeGames.has(chatId)) {
            await ctx.replyWithHTML(
                `╔══════════════════════════════════╗\n` +
                `║        🎮 GAME IN PROGRESS 🎮      ║\n` +
                `╚══════════════════════════════════╝\n\n` +
                `❌ A trivia game is already active in this chat!\n` +
                `Finish it or wait 30 seconds for timeout.\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🛡️ ${botName} • v${version}`
            );
            return;
        }
        
        // Show categories if no category specified
        if (!args[0]) {
            let categoryList = '';
            Object.entries(CATEGORIES).forEach(([key, cat]) => {
                const count = TRIVIA_QUESTIONS[key]?.en?.length || 0;
                categoryList += `${cat.emoji} <b>${cat.name.en}</b> • ${count} questions\n`;
            });
            
            await ctx.replyWithHTML(
                `╔══════════════════════════════════╗\n` +
                `║        🧠 TRIVIA QUIZ 🧠           ║\n` +
                `╚══════════════════════════════════╝\n\n` +
                `<b>📚 Available Categories:</b>\n\n` +
                categoryList + `\n` +
                `<b>Usage:</b> <code>/trivia [category]</code>\n` +
                `<code>/trivia science</code>\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🛡️ ${botName} • v${version}\n` +
                `👨‍💻 @mfof7310`
            );
            return;
        }
        
        // Get category
        const categoryKey = args[0].toLowerCase();
        const category = CATEGORIES[categoryKey];
        
        if (!category || !TRIVIA_QUESTIONS[categoryKey]) {
            await ctx.replyWithHTML(
                `╔══════════════════════════════════╗\n` +
                `║        ❌ INVALID CATEGORY ❌       ║\n` +
                `╚══════════════════════════════════╝\n\n` +
                `Use <code>/trivia</code> to see available categories.`
            );
            return;
        }
        
        // Get language (detect from message or default to English)
        const lang = 'en'; // Can be enhanced with language detection
        const questions = TRIVIA_QUESTIONS[categoryKey][lang] || TRIVIA_QUESTIONS[categoryKey].en;
        
        if (!questions || questions.length === 0) {
            await ctx.replyWithHTML(`❌ No questions available in this category yet.`);
            return;
        }
        
        // Select random question
        const question = questions[Math.floor(Math.random() * questions.length)];
        
        // Build question message
        let message = `╔══════════════════════════════════╗\n`;
        message += `║     ${category.emoji} TRIVIA - ${category.name.en.toUpperCase()}     ║\n`;
        message += `╚══════════════════════════════════╝\n\n`;
        message += `<b>${question.q}</b>\n\n`;
        message += `🇦 A: ${question.a[0]}\n`;
        message += `🇧 B: ${question.a[1]}\n`;
        message += `🇨 C: ${question.a[2]}\n`;
        message += `🇩 D: ${question.a[3]}\n\n`;
        message += `<i>Reply with A, B, C, or D! (30 seconds)</i>\n\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        message += `🎮 ${botName} • v${version}`;
        
        await ctx.replyWithHTML(message);
        
        // Store game state
        const timeout = setTimeout(() => {
            if (activeGames.has(chatId)) {
                const game = activeGames.get(chatId);
                activeGames.delete(chatId);
                
                ctx.replyWithHTML(
                    `╔══════════════════════════════════╗\n` +
                    `║        ⏰ TIME'S UP! ⏰            ║\n` +
                    `╚══════════════════════════════════╝\n\n` +
                    `The correct answer was: <b>${game.question.a[game.correct]}</b>\n` +
                    `💡 <b>Fact:</b> ${game.question.fact}\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🛡️ ${botName} • v${version}`
                );
            }
        }, 30000);
        
        activeGames.set(chatId, {
            question,
            correct: question.correct,
            category: categoryKey,
            username,
            timeout,
            fact: question.fact
        });
        
        console.log(`[TRIVIA] Started ${categoryKey} game for ${username} in chat ${chatId}`);
    }
};