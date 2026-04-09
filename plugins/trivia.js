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

// ================= 🔥 EXPANDED TRIVIA QUESTION DATABASE (12 CATEGORIES) =================
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
            { q: "Quelle est la vitesse de la lumière ?", a: ["300 000 km/s", "150 000 km/s", "500 000 km/s", "1 000 000 km/s"], correct: 0, fact: "La lumière voyage à exactement 299 792 458 mètres par seconde." },
            { q: "Quel est le gaz le plus abondant dans l'atmosphère terrestre ?", a: ["Azote", "Oxygène", "Dioxyde de carbone", "Argon"], correct: 0, fact: "L'azote représente environ 78% de l'atmosphère terrestre." },
            { q: "Quelle est la plus petite unité de vie ?", a: ["Cellule", "Atome", "Molécule", "Organe"], correct: 0, fact: "Les cellules sont les éléments constitutifs de tous les êtres vivants." },
            { q: "Quel est le point d'ébullition de l'eau au niveau de la mer ?", a: ["100°C", "90°C", "110°C", "80°C"], correct: 0, fact: "L'eau bout à 100°C à la pression atmosphérique standard." },
            { q: "Quelle est la centrale énergétique de la cellule ?", a: ["Mitochondrie", "Noyau", "Ribosome", "Golgi"], correct: 0, fact: "Les mitochondries génèrent la plupart de l'énergie chimique de la cellule." },
            { q: "Quel est le pH de l'eau pure ?", a: ["7", "0", "14", "5"], correct: 0, fact: "L'eau pure a un pH neutre de 7." }
        ]
    },
    history: {
        en: [
            { q: "Who was the first President of the United States?", a: ["George Washington", "Thomas Jefferson", "Abraham Lincoln", "John Adams"], correct: 0, fact: "Washington served from 1789 to 1797." },
            { q: "In which year did World War II end?", a: ["1945", "1944", "1946", "1943"], correct: 0, fact: "WWII ended in 1945 with Germany's surrender in May and Japan's in September." },
            { q: "Who painted the Mona Lisa?", a: ["Leonardo da Vinci", "Michelangelo", "Raphael", "Donatello"], correct: 0, fact: "Da Vinci painted the Mona Lisa between 1503 and 1519." },
            { q: "Which ancient civilization built Machu Picchu?", a: ["Inca", "Maya", "Aztec", "Olmec"], correct: 0, fact: "Machu Picchu was built by the Inca Empire in the 15th century." },
            { q: "Who was the first man on the moon?", a: ["Neil Armstrong", "Buzz Aldrin", "Yuri Gagarin", "Michael Collins"], correct: 0, fact: "Neil Armstrong stepped on the moon on July 20, 1969." },
            { q: "Which empire was ruled by Julius Caesar?", a: ["Roman Empire", "Greek Empire", "Persian Empire", "Ottoman Empire"], correct: 0, fact: "Julius Caesar was a Roman general and statesman." },
            { q: "When did the French Revolution begin?", a: ["1789", "1776", "1804", "1750"], correct: 0, fact: "The French Revolution began with the storming of the Bastille on July 14, 1789." },
            { q: "Who discovered America?", a: ["Christopher Columbus", "Leif Erikson", "Amerigo Vespucci", "Vasco da Gama"], correct: 0, fact: "Columbus reached the Americas in 1492." }
        ],
        fr: [
            { q: "Qui était le premier président des États-Unis ?", a: ["George Washington", "Thomas Jefferson", "Abraham Lincoln", "John Adams"], correct: 0, fact: "Washington a servi de 1789 à 1797." },
            { q: "En quelle année la Seconde Guerre mondiale s'est-elle terminée ?", a: ["1945", "1944", "1946", "1943"], correct: 0, fact: "La guerre s'est terminée en 1945." },
            { q: "Qui a peint la Joconde ?", a: ["Léonard de Vinci", "Michel-Ange", "Raphaël", "Donatello"], correct: 0, fact: "De Vinci a peint la Joconde entre 1503 et 1519." },
            { q: "Quelle civilisation a construit le Machu Picchu ?", a: ["Inca", "Maya", "Aztèque", "Olmèque"], correct: 0, fact: "Le Machu Picchu a été construit par l'Empire Inca au 15ème siècle." },
            { q: "Qui était le premier homme sur la lune ?", a: ["Neil Armstrong", "Buzz Aldrin", "Youri Gagarine", "Michael Collins"], correct: 0, fact: "Neil Armstrong a marché sur la lune le 20 juillet 1969." },
            { q: "Quel empire était dirigé par Jules César ?", a: ["Empire Romain", "Empire Grec", "Empire Perse", "Empire Ottoman"], correct: 0, fact: "Jules César était un général et homme d'État romain." },
            { q: "Quand la Révolution française a-t-elle commencé ?", a: ["1789", "1776", "1804", "1750"], correct: 0, fact: "La Révolution française a commencé avec la prise de la Bastille le 14 juillet 1789." },
            { q: "Qui a découvert l'Amérique ?", a: ["Christophe Colomb", "Leif Erikson", "Amerigo Vespucci", "Vasco de Gama"], correct: 0, fact: "Colomb a atteint les Amériques en 1492." }
        ]
    },
    gaming: {
        en: [
            { q: "Which company created Mario?", a: ["Nintendo", "Sega", "Sony", "Microsoft"], correct: 0, fact: "Mario was created by Shigeru Miyamoto and first appeared in Donkey Kong (1981)." },
            { q: "In CODM, what does 'ADS' mean?", a: ["Aim Down Sights", "Auto Deploy System", "Advanced Defense Shield", "Aerial Drop Support"], correct: 0, fact: "ADS refers to aiming down your weapon's sights for better accuracy." },
            { q: "What is the best-selling video game of all time?", a: ["Minecraft", "GTA V", "Tetris", "Wii Sports"], correct: 0, fact: "Minecraft has sold over 300 million copies worldwide." },
            { q: "What year was the first Call of Duty released?", a: ["2003", "2001", "2005", "2007"], correct: 0, fact: "The original Call of Duty was released on October 29, 2003." },
            { q: "In Pokemon, what type is Pikachu?", a: ["Electric", "Fire", "Water", "Normal"], correct: 0, fact: "Pikachu is the mascot of the Pokémon franchise." },
            { q: "Which game features 'The King of the Iron Fist Tournament'?", a: ["Tekken", "Street Fighter", "Mortal Kombat", "SoulCalibur"], correct: 0, fact: "Tekken's tournament is sponsored by the Mishima Zaibatsu." }
        ],
        fr: [
            { q: "Quelle entreprise a créé Mario ?", a: ["Nintendo", "Sega", "Sony", "Microsoft"], correct: 0, fact: "Mario a été créé par Shigeru Miyamoto." },
            { q: "Dans CODM, que signifie 'ADS' ?", a: ["Viser", "Système Auto", "Bouclier", "Support Aérien"], correct: 0, fact: "L'ADS fait référence au fait de viser avec le viseur." },
            { q: "Quel est le jeu vidéo le plus vendu ?", a: ["Minecraft", "GTA V", "Tetris", "Wii Sports"], correct: 0, fact: "Minecraft s'est vendu à plus de 300 millions d'exemplaires." },
            { q: "En quelle année le premier Call of Duty est-il sorti ?", a: ["2003", "2001", "2005", "2007"], correct: 0, fact: "Le Call of Duty original est sorti le 29 octobre 2003." },
            { q: "Dans Pokemon, quel type est Pikachu ?", a: ["Électrique", "Feu", "Eau", "Normal"], correct: 0, fact: "Pikachu est la mascotte de la franchise Pokémon." },
            { q: "Quel jeu présente 'Le Tournoi du Roi du Poing de Fer' ?", a: ["Tekken", "Street Fighter", "Mortal Kombat", "SoulCalibur"], correct: 0, fact: "Le tournoi de Tekken est sponsorisé par le Mishima Zaibatsu." }
        ]
    },
    technology: {
        en: [
            { q: "What does CPU stand for?", a: ["Central Processing Unit", "Computer Personal Unit", "Central Program Utility", "Core Processing Utility"], correct: 0, fact: "The CPU is the brain of the computer." },
            { q: "Which company created JavaScript?", a: ["Netscape", "Microsoft", "Google", "Apple"], correct: 0, fact: "JavaScript was created by Brendan Eich at Netscape in 1995." },
            { q: "What does 'HTTP' stand for?", a: ["HyperText Transfer Protocol", "High Tech Transfer Process", "Hyperlink Text Protocol", "Home Tool Transfer Protocol"], correct: 0, fact: "HTTP is the foundation of data communication on the web." },
            { q: "Who is the creator of Linux?", a: ["Linus Torvalds", "Bill Gates", "Steve Jobs", "Mark Zuckerberg"], correct: 0, fact: "Linus Torvalds created Linux in 1991." },
            { q: "What year was the first iPhone released?", a: ["2007", "2005", "2008", "2006"], correct: 0, fact: "Steve Jobs unveiled the first iPhone on January 9, 2007." },
            { q: "What does 'AI' stand for?", a: ["Artificial Intelligence", "Automated Interface", "Advanced Integration", "Algorithmic Input"], correct: 0, fact: "AI refers to machines that can perform tasks requiring human intelligence." }
        ],
        fr: [
            { q: "Que signifie CPU ?", a: ["Unité Centrale de Traitement", "Unité Personnelle d'Ordinateur", "Utilitaire Central de Programme", "Utilitaire de Traitement Central"], correct: 0, fact: "Le CPU est le cerveau de l'ordinateur." },
            { q: "Quelle entreprise a créé JavaScript ?", a: ["Netscape", "Microsoft", "Google", "Apple"], correct: 0, fact: "JavaScript a été créé par Brendan Eich chez Netscape en 1995." },
            { q: "Que signifie 'HTTP' ?", a: ["Protocole de Transfert HyperTexte", "Processus de Transfert Haute Tech", "Protocole de Texte Hyperlien", "Protocole de Transfert d'Outil Domestique"], correct: 0, fact: "HTTP est la base de la communication de données sur le web." },
            { q: "Qui est le créateur de Linux ?", a: ["Linus Torvalds", "Bill Gates", "Steve Jobs", "Mark Zuckerberg"], correct: 0, fact: "Linus Torvalds a créé Linux en 1991." },
            { q: "En quelle année le premier iPhone est-il sorti ?", a: ["2007", "2005", "2008", "2006"], correct: 0, fact: "Steve Jobs a dévoilé le premier iPhone le 9 janvier 2007." },
            { q: "Que signifie 'IA' ?", a: ["Intelligence Artificielle", "Interface Automatisée", "Intégration Avancée", "Entrée Algorithmique"], correct: 0, fact: "L'IA désigne les machines capables d'effectuer des tâches nécessitant l'intelligence humaine." }
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
            { q: "Quel est le plus grand océan sur Terre ?", a: ["Océan Pacifique", "Océan Atlantique", "Océan Indien", "Océan Arctique"], correct: 0, fact: "L'océan Pacifique couvre environ 165 millions de km²." },
            { q: "Quel est le plus long fleuve du monde ?", a: ["Nil", "Amazone", "Yangtsé", "Mississippi"], correct: 0, fact: "Le Nil mesure environ 6 650 km de long." },
            { q: "Quel continent est le plus grand ?", a: ["Asie", "Afrique", "Amérique du Nord", "Europe"], correct: 0, fact: "L'Asie couvre environ 30% de la surface terrestre." },
            { q: "Quelle est la plus haute montagne du monde ?", a: ["Mont Everest", "K2", "Kangchenjunga", "Lhotse"], correct: 0, fact: "Le Mont Everest culmine à 8 848 mètres." },
            { q: "Quel est le plus petit pays du monde ?", a: ["Vatican", "Monaco", "Saint-Marin", "Liechtenstein"], correct: 0, fact: "Le Vatican ne fait que 0,44 kilomètres carrés." }
        ]
    },
    space: {
        en: [
            { q: "What is the closest planet to the Sun?", a: ["Mercury", "Venus", "Earth", "Mars"], correct: 0, fact: "Mercury orbits the Sun at an average distance of 58 million km." },
            { q: "How many moons does Mars have?", a: ["2", "1", "3", "0"], correct: 0, fact: "Mars has two moons: Phobos and Deimos." },
            { q: "What is the largest planet in our solar system?", a: ["Jupiter", "Saturn", "Neptune", "Uranus"], correct: 0, fact: "Jupiter is more than twice as massive as all other planets combined." },
            { q: "What is the name of our galaxy?", a: ["Milky Way", "Andromeda", "Triangulum", "Sombrero"], correct: 0, fact: "The Milky Way contains over 100 billion stars." },
            { q: "Who was the first human in space?", a: ["Yuri Gagarin", "Neil Armstrong", "Alan Shepard", "John Glenn"], correct: 0, fact: "Yuri Gagarin orbited Earth on April 12, 1961." },
            { q: "What is the hottest planet in our solar system?", a: ["Venus", "Mercury", "Mars", "Jupiter"], correct: 0, fact: "Venus has surface temperatures over 460°C." }
        ],
        fr: [
            { q: "Quelle est la planète la plus proche du Soleil ?", a: ["Mercure", "Vénus", "Terre", "Mars"], correct: 0, fact: "Mercure orbite autour du Soleil à une distance moyenne de 58 millions de km." },
            { q: "Combien de lunes Mars possède-t-elle ?", a: ["2", "1", "3", "0"], correct: 0, fact: "Mars a deux lunes : Phobos et Deimos." },
            { q: "Quelle est la plus grande planète de notre système solaire ?", a: ["Jupiter", "Saturne", "Neptune", "Uranus"], correct: 0, fact: "Jupiter est plus de deux fois plus massive que toutes les autres planètes réunies." },
            { q: "Quel est le nom de notre galaxie ?", a: ["Voie Lactée", "Andromède", "Triangle", "Sombrero"], correct: 0, fact: "La Voie Lactée contient plus de 100 milliards d'étoiles." },
            { q: "Qui était le premier humain dans l'espace ?", a: ["Youri Gagarine", "Neil Armstrong", "Alan Shepard", "John Glenn"], correct: 0, fact: "Youri Gagarine a orbité autour de la Terre le 12 avril 1961." },
            { q: "Quelle est la planète la plus chaude de notre système solaire ?", a: ["Vénus", "Mercure", "Mars", "Jupiter"], correct: 0, fact: "Vénus a des températures de surface supérieures à 460°C." }
        ]
    },
    animals: {
        en: [
            { q: "What is the largest animal on Earth?", a: ["Blue Whale", "African Elephant", "Giraffe", "Great White Shark"], correct: 0, fact: "Blue whales can grow up to 30 meters long and weigh over 180 tons." },
            { q: "What is the fastest land animal?", a: ["Cheetah", "Lion", "Peregrine Falcon", "Pronghorn"], correct: 0, fact: "Cheetahs can reach speeds of up to 120 km/h." },
            { q: "How many hearts does an octopus have?", a: ["3", "1", "2", "4"], correct: 0, fact: "Octopuses have three hearts." },
            { q: "What is the only mammal capable of true flight?", a: ["Bat", "Flying Squirrel", "Colugo", "Sugar Glider"], correct: 0, fact: "Bats are the only mammals that can truly fly." },
            { q: "What is a group of lions called?", a: ["Pride", "Pack", "Herd", "Flock"], correct: 0, fact: "A pride typically consists of about 15 lions." },
            { q: "Which bird can fly backwards?", a: ["Hummingbird", "Eagle", "Sparrow", "Pigeon"], correct: 0, fact: "Hummingbirds are the only birds that can fly backwards." }
        ],
        fr: [
            { q: "Quel est le plus grand animal sur Terre ?", a: ["Baleine Bleue", "Éléphant d'Afrique", "Girafe", "Grand Requin Blanc"], correct: 0, fact: "Les baleines bleues peuvent atteindre 30 mètres de long." },
            { q: "Quel est l'animal terrestre le plus rapide ?", a: ["Guépard", "Lion", "Faucon Pèlerin", "Antilope"], correct: 0, fact: "Les guépards peuvent atteindre des vitesses de 120 km/h." },
            { q: "Combien de cœurs a une pieuvre ?", a: ["3", "1", "2", "4"], correct: 0, fact: "Les pieuvres ont trois cœurs." },
            { q: "Quel est le seul mammifère capable de voler vraiment ?", a: ["Chauve-souris", "Écureuil Volant", "Colugo", "Phalanger Volant"], correct: 0, fact: "Les chauves-souris sont les seuls mammifères qui peuvent vraiment voler." },
            { q: "Comment appelle-t-on un groupe de lions ?", a: ["Troupe", "Meute", "Troupeau", "Volée"], correct: 0, fact: "Une troupe se compose généralement d'environ 15 lions." },
            { q: "Quel oiseau peut voler en arrière ?", a: ["Colibri", "Aigle", "Moineau", "Pigeon"], correct: 0, fact: "Les colibris sont les seuls oiseaux qui peuvent voler en arrière." }
        ]
    },
    sports: {
        en: [
            { q: "How many players are on a football (soccer) team?", a: ["11", "10", "12", "9"], correct: 0, fact: "Each team has 11 players on the field." },
            { q: "Which country has won the most FIFA World Cups?", a: ["Brazil", "Germany", "Italy", "Argentina"], correct: 0, fact: "Brazil has won the World Cup 5 times." },
            { q: "In which sport would you perform a 'slam dunk'?", a: ["Basketball", "Volleyball", "Tennis", "Baseball"], correct: 0, fact: "A slam dunk is when a player jumps and forcefully scores." },
            { q: "How many rounds are in a professional boxing match?", a: ["12", "10", "15", "8"], correct: 0, fact: "Championship boxing matches are 12 rounds." },
            { q: "Which country hosted the 2022 FIFA World Cup?", a: ["Qatar", "Russia", "Brazil", "France"], correct: 0, fact: "Qatar hosted the first World Cup in the Middle East." },
            { q: "What is the highest score possible in 10-pin bowling?", a: ["300", "200", "250", "350"], correct: 0, fact: "A perfect game in bowling is 300 points." }
        ],
        fr: [
            { q: "Combien de joueurs dans une équipe de football ?", a: ["11", "10", "12", "9"], correct: 0, fact: "Chaque équipe a 11 joueurs sur le terrain." },
            { q: "Quel pays a gagné le plus de Coupes du Monde FIFA ?", a: ["Brésil", "Allemagne", "Italie", "Argentine"], correct: 0, fact: "Le Brésil a remporté la Coupe du Monde 5 fois." },
            { q: "Dans quel sport effectue-t-on un 'slam dunk' ?", a: ["Basketball", "Volleyball", "Tennis", "Baseball"], correct: 0, fact: "Un slam dunk est lorsqu'un joueur saute et marque avec force." },
            { q: "Combien de rounds dans un match de boxe professionnel ?", a: ["12", "10", "15", "8"], correct: 0, fact: "Les matchs de championnat sont de 12 rounds." },
            { q: "Quel pays a accueilli la Coupe du Monde 2022 ?", a: ["Qatar", "Russie", "Brésil", "France"], correct: 0, fact: "Le Qatar a accueilli la première Coupe du Monde au Moyen-Orient." },
            { q: "Quel est le score parfait au bowling ?", a: ["300", "200", "250", "350"], correct: 0, fact: "Une partie parfaite au bowling est de 300 points." }
        ]
    },
    literature: {
        en: [
            { q: "Who wrote 'Romeo and Juliet'?", a: ["William Shakespeare", "Charles Dickens", "Jane Austen", "Mark Twain"], correct: 0, fact: "Shakespeare wrote Romeo and Juliet around 1596." },
            { q: "Who wrote 'Things Fall Apart'?", a: ["Chinua Achebe", "Wole Soyinka", "Ngũgĩ wa Thiong'o", "Chimamanda Adichie"], correct: 0, fact: "Things Fall Apart is the most widely read book in African literature." },
            { q: "Who is the author of 'Harry Potter'?", a: ["J.K. Rowling", "J.R.R. Tolkien", "C.S. Lewis", "Philip Pullman"], correct: 0, fact: "J.K. Rowling wrote the Harry Potter series." },
            { q: "What is the first book of the Bible?", a: ["Genesis", "Exodus", "Matthew", "Psalms"], correct: 0, fact: "Genesis means 'beginning' or 'origin' in Greek." },
            { q: "Who wrote 'The Great Gatsby'?", a: ["F. Scott Fitzgerald", "Ernest Hemingway", "John Steinbeck", "William Faulkner"], correct: 0, fact: "The Great Gatsby was published in 1925." },
            { q: "Who wrote 'Les Misérables'?", a: ["Victor Hugo", "Alexandre Dumas", "Gustave Flaubert", "Émile Zola"], correct: 0, fact: "Victor Hugo wrote Les Misérables in 1862." }
        ],
        fr: [
            { q: "Qui a écrit 'Roméo et Juliette' ?", a: ["William Shakespeare", "Charles Dickens", "Jane Austen", "Mark Twain"], correct: 0, fact: "Shakespeare a écrit Roméo et Juliette vers 1596." },
            { q: "Qui a écrit 'Le Monde s'effondre' ?", a: ["Chinua Achebe", "Wole Soyinka", "Ngũgĩ wa Thiong'o", "Chimamanda Adichie"], correct: 0, fact: "Le Monde s'effondre est le livre le plus lu de la littérature africaine." },
            { q: "Qui est l'auteur de 'Harry Potter' ?", a: ["J.K. Rowling", "J.R.R. Tolkien", "C.S. Lewis", "Philip Pullman"], correct: 0, fact: "J.K. Rowling a écrit la série Harry Potter." },
            { q: "Quel est le premier livre de la Bible ?", a: ["Genèse", "Exode", "Matthieu", "Psaumes"], correct: 0, fact: "Genèse signifie 'commencement' ou 'origine' en grec." },
            { q: "Qui a écrit 'Gatsby le Magnifique' ?", a: ["F. Scott Fitzgerald", "Ernest Hemingway", "John Steinbeck", "William Faulkner"], correct: 0, fact: "Gatsby le Magnifique a été publié en 1925." },
            { q: "Qui a écrit 'Les Misérables' ?", a: ["Victor Hugo", "Alexandre Dumas", "Gustave Flaubert", "Émile Zola"], correct: 0, fact: "Victor Hugo a écrit Les Misérables en 1862." }
        ]
    },
    mali: {
        en: [
            { q: "What is the capital of Mali?", a: ["Bamako", "Ségou", "Mopti", "Kayes"], correct: 0, fact: "Bamako is located on the Niger River and is Mali's largest city." },
            { q: "Which ancient empire was centered in Mali?", a: ["Mali Empire", "Ghana Empire", "Songhai Empire", "Roman Empire"], correct: 0, fact: "The Mali Empire was one of the wealthiest empires in African history." },
            { q: "Who was Mansa Musa?", a: ["Emperor of Mali", "King of Ghana", "Pharaoh of Egypt", "Chief of Zulu"], correct: 0, fact: "Mansa Musa is considered one of the wealthiest people in history." },
            { q: "Which city was a center of learning in the Mali Empire?", a: ["Timbuktu", "Bamako", "Gao", "Djenné"], correct: 0, fact: "Timbuktu was home to the famous Sankore University." },
            { q: "What is the official language of Mali?", a: ["French", "English", "Arabic", "Bambara"], correct: 0, fact: "French is the official language, but Bambara is most widely spoken." },
            { q: "Which river flows through Mali?", a: ["Niger River", "Nile River", "Congo River", "Zambezi River"], correct: 0, fact: "The Niger River is the principal river of West Africa." },
            { q: "When did Mali gain independence from France?", a: ["1960", "1958", "1962", "1954"], correct: 0, fact: "Mali became independent on September 22, 1960." },
            { q: "What is the traditional Malian mud-dyed fabric called?", a: ["Bogolan", "Kente", "Ankara", "Dashiki"], correct: 0, fact: "Bogolan (mud cloth) is a handmade Malian cotton fabric." },
            { q: "Which famous mosque is located in Djenné, Mali?", a: ["Great Mosque of Djenné", "Hassan II Mosque", "Blue Mosque", "Al-Azhar Mosque"], correct: 0, fact: "The Great Mosque of Djenné is the largest mud-brick building in the world." },
            { q: "Which Malian musician is known as the 'King of Desert Blues'?", a: ["Ali Farka Touré", "Salif Keita", "Oumou Sangaré", "Toumani Diabaté"], correct: 0, fact: "Ali Farka Touré blended traditional Malian music with American blues." },
            { q: "What is the traditional 21-string harp-lute of Mali?", a: ["Kora", "Balafon", "Djembe", "Ngoni"], correct: 0, fact: "The kora is a unique West African instrument." },
            { q: "What is the name of Mali's national football team?", a: ["Les Aigles", "Les Lions", "Les Éléphants", "Les Étalons"], correct: 0, fact: "Les Aigles (The Eagles) represent Mali in international football." }
        ],
        fr: [
            { q: "Quelle est la capitale du Mali ?", a: ["Bamako", "Ségou", "Mopti", "Kayes"], correct: 0, fact: "Bamako est située sur le fleuve Niger." },
            { q: "Quel ancien empire était centré au Mali ?", a: ["Empire du Mali", "Empire du Ghana", "Empire Songhaï", "Empire Romain"], correct: 0, fact: "L'Empire du Mali était l'un des plus riches empires africains." },
            { q: "Qui était Mansa Moussa ?", a: ["Empereur du Mali", "Roi du Ghana", "Pharaon d'Égypte", "Chef Zoulou"], correct: 0, fact: "Mansa Moussa est l'une des personnes les plus riches de l'histoire." },
            { q: "Quelle ville était un centre d'apprentissage dans l'Empire du Mali ?", a: ["Tombouctou", "Bamako", "Gao", "Djenné"], correct: 0, fact: "Tombouctou abritait la célèbre Université de Sankoré." },
            { q: "Quelle est la langue officielle du Mali ?", a: ["Français", "Anglais", "Arabe", "Bambara"], correct: 0, fact: "Le français est la langue officielle." },
            { q: "Quel fleuve traverse le Mali ?", a: ["Fleuve Niger", "Nil", "Fleuve Congo", "Zambèze"], correct: 0, fact: "Le fleuve Niger est le principal fleuve d'Afrique de l'Ouest." },
            { q: "Quand le Mali a-t-il obtenu son indépendance ?", a: ["1960", "1958", "1962", "1954"], correct: 0, fact: "Le Mali est devenu indépendant le 22 septembre 1960." },
            { q: "Comment s'appelle le tissu traditionnel malien ?", a: ["Bogolan", "Kente", "Ankara", "Dashiki"], correct: 0, fact: "Le bogolan est un tissu de coton malien fait main." },
            { q: "Quelle célèbre mosquée se trouve à Djenné ?", a: ["Grande Mosquée de Djenné", "Mosquée Hassan II", "Mosquée Bleue", "Mosquée Al-Azhar"], correct: 0, fact: "La Grande Mosquée de Djenné est en briques de terre." },
            { q: "Quel musicien malien est le 'Roi du Blues du Désert' ?", a: ["Ali Farka Touré", "Salif Keita", "Oumou Sangaré", "Toumani Diabaté"], correct: 0, fact: "Ali Farka Touré a mélangé musique malienne et blues." },
            { q: "Quel est l'instrument à 21 cordes du Mali ?", a: ["Kora", "Balafon", "Djembe", "Ngoni"], correct: 0, fact: "La kora est un instrument unique d'Afrique de l'Ouest." },
            { q: "Quel est le nom de l'équipe de football du Mali ?", a: ["Les Aigles", "Les Lions", "Les Éléphants", "Les Étalons"], correct: 0, fact: "Les Aigles représentent le Mali dans le football international." }
        ]
    },
    general: {
        en: [
            { q: "How many days are in a leap year?", a: ["366", "365", "364", "367"], correct: 0, fact: "Leap years occur every 4 years." },
            { q: "Who created this bot?", a: ["Moussa Fofana", "OpenAI", "Google", "Microsoft"], correct: 0, fact: "Moussa Fofana (MFOF7310) is the Architect." },
            { q: "How many continents are there?", a: ["7", "6", "5", "8"], correct: 0, fact: "The seven continents are: Asia, Africa, North America, South America, Antarctica, Europe, Australia." },
            { q: "What is the currency of Mali?", a: ["CFA Franc", "Dollar", "Euro", "Pound"], correct: 0, fact: "Mali uses the West African CFA franc (XOF)." },
            { q: "What is the largest country in Africa?", a: ["Algeria", "DR Congo", "Sudan", "Libya"], correct: 0, fact: "Algeria covers 2.38 million square kilometers." },
            { q: "What is the most spoken language in the world?", a: ["Mandarin Chinese", "English", "Spanish", "Hindi"], correct: 0, fact: "Mandarin has over 1.1 billion native speakers." }
        ],
        fr: [
            { q: "Combien de jours dans une année bissextile ?", a: ["366", "365", "364", "367"], correct: 0, fact: "Les années bissextiles se produisent tous les 4 ans." },
            { q: "Qui a créé ce bot ?", a: ["Moussa Fofana", "OpenAI", "Google", "Microsoft"], correct: 0, fact: "Moussa Fofana (MFOF7310) est l'Architecte." },
            { q: "Combien y a-t-il de continents ?", a: ["7", "6", "5", "8"], correct: 0, fact: "Les sept continents : Asie, Afrique, Amérique du Nord, Amérique du Sud, Antarctique, Europe, Australie." },
            { q: "Quelle est la monnaie du Mali ?", a: ["Franc CFA", "Dollar", "Euro", "Livre"], correct: 0, fact: "Le Mali utilise le franc CFA (XOF)." },
            { q: "Quel est le plus grand pays d'Afrique ?", a: ["Algérie", "RD Congo", "Soudan", "Libye"], correct: 0, fact: "L'Algérie couvre 2,38 millions de km²." },
            { q: "Quelle est la langue la plus parlée au monde ?", a: ["Mandarin", "Anglais", "Espagnol", "Hindi"], correct: 0, fact: "Le mandarin compte plus de 1,1 milliard de locuteurs." }
        ]
    }
};

// ================= 🔥 EXPANDED CATEGORY CONFIGURATION (12 CATEGORIES) =================
const CATEGORIES = {
    science: { emoji: '🔬', color: '#2ecc71', name: { en: 'Science', fr: 'Science' } },
    history: { emoji: '📜', color: '#e67e22', name: { en: 'History', fr: 'Histoire' } },
    gaming: { emoji: '🎮', color: '#9b59b6', name: { en: 'Gaming', fr: 'Jeux Vidéo' } },
    technology: { emoji: '💻', color: '#3498db', name: { en: 'Technology', fr: 'Technologie' } },
    geography: { emoji: '🌍', color: '#1abc9c', name: { en: 'Geography', fr: 'Géographie' } },
    space: { emoji: '🚀', color: '#8e44ad', name: { en: 'Space', fr: 'Espace' } },
    animals: { emoji: '🐾', color: '#e67e22', name: { en: 'Animals', fr: 'Animaux' } },
    sports: { emoji: '⚽', color: '#e74c3c', name: { en: 'Sports', fr: 'Sports' } },
    literature: { emoji: '📚', color: '#f39c12', name: { en: 'Literature', fr: 'Littérature' } },
    mali: { emoji: '🇲🇱', color: '#f1c40f', name: { en: 'Mali Culture', fr: 'Culture Malienne' } },
    general: { emoji: '🧠', color: '#f1c40f', name: { en: 'General', fr: 'Général' } }
};

// ================= DIFFICULTY CONFIGURATION =================
const DIFFICULTIES = {
    easy: { emoji: '🟢', color: '#2ecc71', name: { en: 'Easy', fr: 'Facile' }, questions: 5, baseReward: 50, timeLimit: 20, bet: 50 },
    medium: { emoji: '🟡', color: '#f1c40f', name: { en: 'Medium', fr: 'Moyen' }, questions: 7, baseReward: 100, timeLimit: 15, bet: 100 },
    hard: { emoji: '🔴', color: '#e74c3c', name: { en: 'Hard', fr: 'Difficile' }, questions: 10, baseReward: 200, timeLimit: 10, bet: 200 }
};

// ================= BILINGUAL TRANSLATIONS =================
const texts = {
    en: {
        title: '🧠 NEURAL TRIVIA',
        selectCategory: 'Select a Category',
        selectDifficulty: 'Select Difficulty',
        cancel: 'Cancel', back: 'Back', question: 'Question', of: 'of', timeLeft: 'Time Left',
        correct: '✅ CORRECT!', incorrect: '❌ INCORRECT!', timeout: '⏰ TIME\'S UP!', answer: 'Answer', fact: 'Did you know?',
        streak: 'Streak', correctAnswers: 'Correct', accuracy: 'Accuracy', reward: 'Reward',
        baseReward: 'Base', streakBonus: 'Streak Bonus', accuracyBonus: 'Accuracy Bonus', total: 'Total', xpGained: 'XP Gained',
        playAgain: 'Play Again', mainMenu: 'Main Menu', backToGames: 'Games Menu',
        insufficientCredits: '❌ **Insufficient Credits!** You need {bet} 🪙 to play.',
        balance: 'Balance', gameOver: 'Quiz Complete!', perfect: '🏆 PERFECT SCORE!',
        almost: 'Great effort!', good: 'Well done!', tryAgain: 'Try again!', accessDenied: '❌ This menu is not yours.',
        progress: 'Progress', levelUp: '🎉 LEVEL UP!', promotedTo: 'promoted to'
    },
    fr: {
        title: '🧠 TRIVIA NEURAL',
        selectCategory: 'Choisissez une Catégorie',
        selectDifficulty: 'Choisissez la Difficulté',
        cancel: 'Annuler', back: 'Retour', question: 'Question', of: 'sur', timeLeft: 'Temps Restant',
        correct: '✅ CORRECT !', incorrect: '❌ INCORRECT !', timeout: '⏰ TEMPS ÉCOULÉ !', answer: 'Réponse', fact: 'Le saviez-vous ?',
        streak: 'Série', correctAnswers: 'Correct', accuracy: 'Précision', reward: 'Récompense',
        baseReward: 'Base', streakBonus: 'Bonus de Série', accuracyBonus: 'Bonus Précision', total: 'Total', xpGained: 'XP Gagnés',
        playAgain: 'Rejouer', mainMenu: 'Menu Principal', backToGames: 'Menu Jeux',
        insufficientCredits: '❌ **Crédits Insuffisants !** Vous avez besoin de {bet} 🪙 pour jouer.',
        balance: 'Solde', gameOver: 'Quiz Terminé !', perfect: '🏆 SCORE PARFAIT !',
        almost: 'Excellent effort !', good: 'Bien joué !', tryAgain: 'Réessayez !', accessDenied: '❌ Ce menu ne vous appartient pas.',
        progress: 'Progression', levelUp: '🎉 PROMOTION !', promotedTo: 'promu au rang de'
    }
};

// ================= HELPER FUNCTIONS =================
function shuffleAnswers(question) {
    const answers = question.a.map((text, index) => ({ text, isCorrect: index === question.correct }));
    for (let i = answers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [answers[i], answers[j]] = [answers[j], answers[i]];
    }
    return { q: question.q, a: answers.map(a => a.text), correct: answers.findIndex(a => a.isCorrect), fact: question.fact };
}

function getRandomQuestions(category, difficulty, lang, count) {
    const questions = TRIVIA_QUESTIONS[category]?.[lang] || TRIVIA_QUESTIONS.general[lang];
    if (!questions || questions.length === 0) return [];
    return [...questions].sort(() => Math.random() - 0.5).slice(0, Math.min(count, questions.length)).map(q => shuffleAnswers(q));
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
        try {
            const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
            const t = texts[lang];
            const version = client.version || '1.6.0';
            const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
            const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
            const userId = message.author.id, userName = message.author.username, avatarURL = message.author.displayAvatarURL({ dynamic: true, size: 256 });
            
            let userData = client.getUserData ? client.getUserData(userId) : db.prepare("SELECT xp, credits, level FROM users WHERE id = ?").get(userId);
            if (!userData) {
                db.prepare("INSERT INTO users (id, username, xp, credits, level) VALUES (?, ?, 0, 0, 1)").run(userId, userName);
                userData = { xp: 0, credits: 0, level: 1 };
                if (client.cacheUserData) client.cacheUserData(userId, userData);
            }
            
            const credits = userData.credits || 0;
            const userLevel = userData.level || calculateLevel(userData.xp || 0);
            const userRank = getRank(userLevel);
            
            // Category Selection Menu
            const categoryEmbed = new EmbedBuilder().setColor('#00fbff')
                .setAuthor({ name: `${t.title} • ${lang === 'fr' ? 'SÉLECTION' : 'SELECTION'}`, iconURL: client.user.displayAvatarURL() })
                .setTitle(lang === 'fr' ? '═ CHOISISSEZ UNE CATÉGORIE ═' : '═ SELECT A CATEGORY ═')
                .setDescription(lang === 'fr' ? 'Sélectionnez une catégorie pour commencer.' : 'Select a category to begin.')
                .setFooter({ text: `${guildName} • NEURAL TRIVIA • v${version}`, iconURL: guildIcon }).setTimestamp()
                .addFields({ name: `💰 ${t.balance}`, value: `\`${credits.toLocaleString()} 🪙\` • ${userRank.emoji} ${userRank.title[lang]} (${lang === 'fr' ? 'Niv.' : 'Lvl.'} ${userLevel})`, inline: false });
            
            // Add first 9 categories as fields (Discord limit)
            const catEntries = Object.entries(CATEGORIES);
            for (let i = 0; i < Math.min(9, catEntries.length); i++) {
                const [key, cat] = catEntries[i];
                categoryEmbed.addFields({ name: `${cat.emoji} ${cat.name[lang]}`, value: '`─────────────`', inline: true });
            }
            
            const categoryOptions = catEntries.map(([key, cat]) => ({
                label: `${cat.emoji} ${cat.name[lang]}`.substring(0, 100), value: key,
                description: `${lang === 'fr' ? 'Jouer en catégorie' : 'Play in'} ${cat.name[lang]}`.substring(0, 100)
            }));
            
            const categoryMenu = new StringSelectMenuBuilder().setCustomId('trivia_category').setPlaceholder(t.selectCategory).addOptions(categoryOptions);
            const categoryRow = new ActionRowBuilder().addComponents(categoryMenu);
            const cancelRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('trivia_cancel').setLabel(t.cancel).setStyle(ButtonStyle.Danger).setEmoji('❌'));
            const categoryMsg = await message.reply({ embeds: [categoryEmbed], components: [categoryRow, cancelRow] });
            
            const categoryCollector = categoryMsg.createMessageComponentCollector({ time: 60000 });
            
            categoryCollector.on('collect', async (i) => {
                if (i.user.id !== userId) return i.reply({ content: t.accessDenied, ephemeral: true }).catch(() => {});
                if (i.customId === 'trivia_cancel') { await i.update({ embeds: [categoryEmbed.setColor('#ED4245')], components: [] }).catch(() => {}); return categoryCollector.stop(); }
                if (i.customId === 'trivia_category') {
                    const selectedCategory = i.values[0];
                    await i.deferUpdate().catch(() => {});
                    categoryCollector.stop();
                    
                    // Difficulty Selection
                    const diffEmbed = new EmbedBuilder().setColor(CATEGORIES[selectedCategory].color)
                        .setAuthor({ name: `${t.title} • ${CATEGORIES[selectedCategory].emoji} ${CATEGORIES[selectedCategory].name[lang]}`, iconURL: client.user.displayAvatarURL() })
                        .setTitle(lang === 'fr' ? '═ CHOISISSEZ LA DIFFICULTÉ ═' : '═ SELECT DIFFICULTY ═')
                        .setDescription(lang === 'fr' ? 'Choisissez un niveau.' : 'Choose a level.')
                        .addFields({ name: `💰 ${t.balance}`, value: `\`${credits.toLocaleString()} 🪙\``, inline: false })
                        .setFooter({ text: `${guildName} • NEURAL TRIVIA • v${version}`, iconURL: guildIcon }).setTimestamp();
                    
                    Object.entries(DIFFICULTIES).forEach(([key, diff]) => {
                        diffEmbed.addFields({ name: `${diff.emoji} ${diff.name[lang]}`, value: `${diff.questions} ${lang === 'fr' ? 'questions' : 'questions'} • ${diff.timeLimit}s • ${diff.bet} 🪙`, inline: false });
                    });
                    
                    const diffOptions = Object.entries(DIFFICULTIES).map(([key, diff]) => ({
                        label: `${diff.emoji} ${diff.name[lang]}`.substring(0, 100), value: key,
                        description: `${diff.questions} ${lang === 'fr' ? 'questions' : 'questions'} • ${diff.bet} 🪙`.substring(0, 100)
                    }));
                    
                    const diffMenu = new StringSelectMenuBuilder().setCustomId('trivia_difficulty').setPlaceholder(t.selectDifficulty).addOptions(diffOptions);
                    const diffRow = new ActionRowBuilder().addComponents(diffMenu);
                    const backRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('trivia_back').setLabel(t.back).setStyle(ButtonStyle.Secondary).setEmoji('◀'),
                        new ButtonBuilder().setCustomId('trivia_cancel').setLabel(t.cancel).setStyle(ButtonStyle.Danger).setEmoji('❌')
                    );
                    await categoryMsg.edit({ embeds: [diffEmbed], components: [diffRow, backRow] }).catch(() => {});
                    
                    const diffCollector = categoryMsg.createMessageComponentCollector({ time: 60000 });
                    
                    diffCollector.on('collect', async (j) => {
                        if (j.user.id !== userId) return j.reply({ content: t.accessDenied, ephemeral: true }).catch(() => {});
                        if (j.customId === 'trivia_cancel') { await j.update({ embeds: [diffEmbed.setColor('#ED4245')], components: [] }).catch(() => {}); return diffCollector.stop(); }
                        if (j.customId === 'trivia_back') { await j.update({ embeds: [categoryEmbed], components: [categoryRow, cancelRow] }).catch(() => {}); return diffCollector.stop(); }
                        if (j.customId === 'trivia_difficulty') {
                            const selectedDifficulty = j.values[0];
                            const diff = DIFFICULTIES[selectedDifficulty];
                            if (credits < diff.bet) return j.reply({ content: t.insufficientCredits.replace('{bet}', diff.bet), ephemeral: true }).catch(() => {});
                            await j.deferUpdate().catch(() => {});
                            diffCollector.stop();
                            
                            const currentUserData = client.getUserData ? client.getUserData(userId) : userData;
                            if (client.queueUserUpdate) client.queueUserUpdate(userId, { ...currentUserData, credits: (currentUserData.credits || 0) - diff.bet, username: userName });
                            else db.prepare("UPDATE users SET credits = credits - ? WHERE id = ?").run(diff.bet, userId);
                            
                            const questions = getRandomQuestions(selectedCategory, selectedDifficulty, lang, diff.questions);
                            if (questions.length === 0) {
                                const errorEmbed = new EmbedBuilder().setColor('#ED4245').setDescription(lang === 'fr' ? '❌ Aucune question disponible.' : '❌ No questions available.')
                                    .setFooter({ text: `${guildName} • NEURAL TRIVIA • v${version}`, iconURL: guildIcon });
                                return categoryMsg.edit({ embeds: [errorEmbed], components: [] }).catch(() => {});
                            }
                            
                            let currentQuestion = 0, correctAnswers = 0, streak = 0, maxStreak = 0;
                            
                            for (let qIndex = 0; qIndex < questions.length; qIndex++) {
                                currentQuestion = qIndex + 1;
                                const q = questions[qIndex];
                                const questionEmbed = new EmbedBuilder().setColor(diff.color)
                                    .setAuthor({ name: `${t.title} • ${CATEGORIES[selectedCategory].emoji} ${CATEGORIES[selectedCategory].name[lang]}`, iconURL: client.user.displayAvatarURL() })
                                    .setTitle(`${t.question} ${currentQuestion}/${questions.length}`)
                                    .setDescription(`**${q.q}**\n\n${q.a.map((ans, idx) => `${['🇦', '🇧', '🇨', '🇩'][idx]} ${ans}`).join('\n')}`)
                                    .addFields({ name: `🔥 ${t.streak}`, value: `\`${streak}\``, inline: true }, { name: `✅ ${t.correctAnswers}`, value: `\`${correctAnswers}/${questions.length}\``, inline: true }, { name: `⏰ ${t.timeLeft}`, value: `\`${diff.timeLimit}s\``, inline: true })
                                    .setFooter({ text: `${guildName} • NEURAL TRIVIA • v${version}`, iconURL: guildIcon }).setTimestamp();
                                
                                const answerRow = new ActionRowBuilder().addComponents(
                                    new ButtonBuilder().setCustomId('trivia_a').setLabel('A').setStyle(ButtonStyle.Primary),
                                    new ButtonBuilder().setCustomId('trivia_b').setLabel('B').setStyle(ButtonStyle.Primary),
                                    new ButtonBuilder().setCustomId('trivia_c').setLabel('C').setStyle(ButtonStyle.Primary),
                                    new ButtonBuilder().setCustomId('trivia_d').setLabel('D').setStyle(ButtonStyle.Primary)
                                );
                                await categoryMsg.edit({ embeds: [questionEmbed], components: [answerRow] }).catch(() => {});
                                
                                const answer = await new Promise((resolve) => {
                                    const answerCollector = categoryMsg.createMessageComponentCollector({ time: diff.timeLimit * 1000, max: 1 });
                                    const timeout = setTimeout(() => { answerCollector.stop('timeout'); resolve({ timeout: true }); }, diff.timeLimit * 1000);
                                    answerCollector.on('collect', async (k) => {
                                        if (k.user.id !== userId) { await k.reply({ content: t.accessDenied, ephemeral: true }).catch(() => {}); return; }
                                        clearTimeout(timeout); answerCollector.stop();
                                        const answerMap = { 'trivia_a': 0, 'trivia_b': 1, 'trivia_c': 2, 'trivia_d': 3 };
                                        const isCorrect = answerMap[k.customId] === q.correct;
                                        try { if (!k.deferred && !k.replied) await k.deferUpdate().catch(() => {}); } catch (e) {}
                                        resolve({ isCorrect, interaction: k });
                                    });
                                    answerCollector.on('end', (c, r) => { if (r === 'timeout') resolve({ timeout: true }); });
                                });
                                
                                let resultText = '', resultColor = diff.color;
                                if (answer.timeout) { resultText = t.timeout; resultColor = '#95a5a6'; streak = 0; }
                                else {
                                    if (answer.isCorrect) { correctAnswers++; streak++; if (streak > maxStreak) maxStreak = streak; resultText = t.correct; resultColor = '#2ecc71'; }
                                    else { resultText = t.incorrect; resultColor = '#e74c3c'; streak = 0; }
                                }
                                
                                const resultEmbed = new EmbedBuilder().setColor(resultColor)
                                    .setAuthor({ name: `${t.title} • ${CATEGORIES[selectedCategory].emoji} ${CATEGORIES[selectedCategory].name[lang]}`, iconURL: client.user.displayAvatarURL() })
                                    .setTitle(resultText).setDescription(`**${q.q}**\n\n${t.answer}: **${q.a[q.correct]}**`)
                                    .addFields({ name: `💡 ${t.fact}`, value: q.fact, inline: false }, { name: `🔥 ${t.streak}`, value: `\`${streak}\``, inline: true }, { name: `✅ ${t.correctAnswers}`, value: `\`${correctAnswers}/${currentQuestion}\``, inline: true })
                                    .setFooter({ text: `${guildName} • NEURAL TRIVIA • v${version}`, iconURL: guildIcon }).setTimestamp();
                                
                                const nextRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('trivia_next')
                                    .setLabel(currentQuestion === questions.length ? t.gameOver.split('!')[0] : (lang === 'fr' ? 'Suivant' : 'Next'))
                                    .setStyle(ButtonStyle.Success).setEmoji(currentQuestion === questions.length ? '🏁' : '▶'));
                                await categoryMsg.edit({ embeds: [resultEmbed], components: [nextRow] }).catch(() => {});
                                
                                await new Promise((resolve) => {
                                    const nextCollector = categoryMsg.createMessageComponentCollector({ time: 30000, max: 1 });
                                    nextCollector.on('collect', async (k) => { if (k.user.id !== userId) { await k.reply({ content: t.accessDenied, ephemeral: true }).catch(() => {}); return; } await k.deferUpdate().catch(() => {}); nextCollector.stop(); resolve(); });
                                    nextCollector.on('end', () => resolve());
                                });
                            }
                            
                            const accuracy = (correctAnswers / questions.length) * 100;
                            const totalReward = diff.baseReward + (maxStreak * 25) + (accuracy >= 80 ? Math.floor(diff.baseReward * 0.5) : 0);
                            const xpGain = Math.floor((correctAnswers * 25) + (maxStreak * 10) + (accuracy >= 70 ? 50 : 0));
                            
                            const finalUserData = client.getUserData ? client.getUserData(userId) : userData;
                            if (finalUserData) {
                                const newXp = (finalUserData.xp || 0) + xpGain, newLevel = calculateLevel(newXp);
                                if (client.queueUserUpdate) client.queueUserUpdate(userId, { ...finalUserData, credits: (finalUserData.credits || 0) + totalReward, xp: newXp, level: newLevel, games_played: (finalUserData.games_played || 0) + 1, games_won: (finalUserData.games_won || 0) + (correctAnswers >= questions.length / 2 ? 1 : 0), username: userName });
                                else db.prepare("UPDATE users SET credits = credits + ?, xp = xp + ?, level = ?, games_played = COALESCE(games_played, 0) + 1, games_won = COALESCE(games_won, 0) + ? WHERE id = ?").run(totalReward, xpGain, newLevel, correctAnswers >= questions.length / 2 ? 1 : 0, userId);
                                if (newLevel > calculateLevel(finalUserData.xp || 0)) {
                                    const newRank = getRank(newLevel);
                                    await message.channel.send({ embeds: [new EmbedBuilder().setColor(newRank.color).setTitle(t.levelUp).setDescription(`**${userName}** ${t.promotedTo} **${newRank.emoji} ${newRank.title[lang]}** (${lang === 'fr' ? 'Niveau' : 'Level'} ${newLevel})!`).setFooter({ text: `${guildName} • ARCHITECT CG-223 • v${version}`, iconURL: guildIcon })] }).catch(() => {});
                                }
                            }
                            
                            const displayUserData = client.getUserData ? client.getUserData(userId) : finalUserData;
                            const displayLevel = displayUserData?.level || calculateLevel(displayUserData?.xp || 0);
                            const displayRank = getRank(displayLevel);
                            let perfMsg = ''; if (accuracy === 100) perfMsg = t.perfect; else if (accuracy >= 80) perfMsg = t.almost; else if (accuracy >= 60) perfMsg = t.good; else perfMsg = t.tryAgain;
                            
                            const finalEmbed = new EmbedBuilder().setColor(displayRank.color).setAuthor({ name: `${t.title} • ${t.gameOver}`, iconURL: avatarURL }).setTitle(perfMsg)
                                .setDescription(`**${userName}** • ${CATEGORIES[selectedCategory].emoji} ${CATEGORIES[selectedCategory].name[lang]} • ${DIFFICULTIES[selectedDifficulty].emoji} ${DIFFICULTIES[selectedDifficulty].name[lang]}\n\n\`\`\`yaml\n${t.correctAnswers}: ${correctAnswers}/${questions.length}\n${t.accuracy}: ${accuracy.toFixed(1)}%\n${t.streak}: ${maxStreak} 🔥\n\`\`\``)
                                .addFields({ name: `💰 ${t.reward}`, value: `\`\`\`yaml\n${t.baseReward}: ${diff.baseReward} 🪙\n${t.streakBonus}: ${maxStreak * 25} 🪙\n${t.accuracyBonus}: ${accuracy >= 80 ? Math.floor(diff.baseReward * 0.5) : 0} 🪙\n${t.total}: ${totalReward} 🪙\`\`\``, inline: true },
                                    { name: `📊 ${t.progress}`, value: `\`\`\`yaml\n${t.xpGained}: ${xpGain} XP\n${lang === 'fr' ? 'Niveau' : 'Level'}: ${displayLevel}\n${displayRank.emoji} ${displayRank.title[lang]}\n${t.balance}: ${displayUserData?.credits?.toLocaleString() || 0} 🪙\`\`\``, inline: true })
                                .setFooter({ text: `${guildName} • NEURAL TRIVIA • v${version}`, iconURL: guildIcon }).setTimestamp();
                            
                            const finalRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId('trivia_again').setLabel(t.playAgain).setStyle(ButtonStyle.Success).setEmoji('🔄'),
                                new ButtonBuilder().setCustomId('trivia_menu').setLabel(t.mainMenu).setStyle(ButtonStyle.Primary).setEmoji('🏠'),
                                new ButtonBuilder().setCustomId('trivia_games').setLabel(t.backToGames).setStyle(ButtonStyle.Secondary).setEmoji('🎮')
                            );
                            await categoryMsg.edit({ embeds: [finalEmbed], components: [finalRow] }).catch(() => {});
                            
                            const finalCollector = categoryMsg.createMessageComponentCollector({ time: 60000 });
                            finalCollector.on('collect', async (k) => {
                                if (k.user.id !== userId) return k.reply({ content: t.accessDenied, ephemeral: true }).catch(() => {});
                                if (k.customId === 'trivia_again') { await k.deferUpdate().catch(() => {}); finalCollector.stop(); const cmd = client.commands.get('trivia'); if (cmd) await cmd.run(client, message, [], db, serverSettings, usedCommand); }
                                else if (k.customId === 'trivia_menu') { await k.deferUpdate().catch(() => {}); finalCollector.stop(); const cmd = client.commands.get('help'); if (cmd) await cmd.run(client, message, [], db, serverSettings, usedCommand); }
                                else if (k.customId === 'trivia_games') { await k.deferUpdate().catch(() => {}); finalCollector.stop(); const cmd = client.commands.get('game'); if (cmd) await cmd.run(client, message, ['menu'], db, serverSettings, usedCommand); }
                            });
                        }
                    });
                }
            });
        } catch (error) {
            console.error(`[TRIVIA FATAL ERROR]`, error);
            return message.reply({ content: "❌ An error occurred." }).catch(() => {});
        }
    }
};