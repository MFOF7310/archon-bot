const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, SlashCommandBuilder } = require('discord.js');

// ================= LEVELS & RANKS =================
function calculateLevel(xp) { return Math.floor(0.1 * Math.sqrt(xp)) + 1; }

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

// ================= QUESTION DATABASE (11 categories × 12 × EN/FR) =================
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
            { q: "What is the pH of pure water?", a: ["7", "0", "14", "5"], correct: 0, fact: "Pure water has a neutral pH of 7." },
            { q: "How many bones are in the adult human body?", a: ["206", "186", "226", "250"], correct: 0, fact: "Babies are born with about 300 bones, many fuse as they grow." },
            { q: "What gas do plants absorb for photosynthesis?", a: ["Carbon Dioxide", "Oxygen", "Nitrogen", "Hydrogen"], correct: 0, fact: "Plants convert CO₂ and water into glucose and oxygen." },
            { q: "What is the chemical formula of water?", a: ["H₂O", "CO₂", "O₂", "NaCl"], correct: 0, fact: "Two hydrogen atoms bonded to one oxygen atom." },
            { q: "Which blood cells carry oxygen?", a: ["Red blood cells", "White blood cells", "Platelets", "Plasma cells"], correct: 0, fact: "Red blood cells contain hemoglobin, which binds oxygen." },
            { q: "What force keeps planets in orbit around the Sun?", a: ["Gravity", "Magnetism", "Friction", "Inertia"], correct: 0, fact: "Newton described gravity; Einstein later redefined it as curved spacetime." },
            { q: "What is the atomic number of Carbon?", a: ["6", "12", "8", "4"], correct: 0, fact: "Carbon has 6 protons — the basis of all organic chemistry." },
            { q: "Which planet has the most moons?", a: ["Saturn", "Jupiter", "Uranus", "Neptune"], correct: 0, fact: "Saturn has 146 confirmed moons as of 2023." },
            { q: "What is the name of the process by which water turns to vapor?", a: ["Evaporation", "Condensation", "Sublimation", "Precipitation"], correct: 0, fact: "Evaporation drives the water cycle." },
            { q: "What is the center of an atom called?", a: ["Nucleus", "Electron", "Proton", "Quark"], correct: 0, fact: "The nucleus contains protons and neutrons." },
            { q: "How many chambers does the human heart have?", a: ["4", "2", "3", "6"], correct: 0, fact: "Two atria and two ventricles make up the four chambers." }
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
            { q: "Quel est le pH de l'eau pure ?", a: ["7", "0", "14", "5"], correct: 0, fact: "L'eau pure a un pH neutre de 7." },
            { q: "Combien d'os compte le corps humain adulte ?", a: ["206", "186", "226", "250"], correct: 0, fact: "Les bébés naissent avec environ 300 os, beaucoup fusionnent en grandissant." },
            { q: "Quel gaz les plantes absorbent-elles pour la photosynthèse ?", a: ["Dioxyde de carbone", "Oxygène", "Azote", "Hydrogène"], correct: 0, fact: "Les plantes convertissent le CO₂ et l'eau en glucose et oxygène." },
            { q: "Quelle est la formule chimique de l'eau ?", a: ["H₂O", "CO₂", "O₂", "NaCl"], correct: 0, fact: "Deux atomes d'hydrogène liés à un atome d'oxygène." },
            { q: "Quelles cellules sanguines transportent l'oxygène ?", a: ["Globules rouges", "Globules blancs", "Plaquettes", "Plasmocytes"], correct: 0, fact: "Les globules rouges contiennent de l'hémoglobine." },
            { q: "Quelle force maintient les planètes en orbite autour du Soleil ?", a: ["La gravité", "Le magnétisme", "La friction", "L'inertie"], correct: 0, fact: "Newton a décrit la gravité ; Einstein l'a redéfinie comme espace-temps courbé." },
            { q: "Quel est le numéro atomique du Carbone ?", a: ["6", "12", "8", "4"], correct: 0, fact: "Le carbone a 6 protons — base de toute chimie organique." },
            { q: "Quelle planète possède le plus de lunes ?", a: ["Saturne", "Jupiter", "Uranus", "Neptune"], correct: 0, fact: "Saturne compte 146 lunes confirmées en 2023." },
            { q: "Comment appelle-t-on le passage de l'eau à l'état vapeur ?", a: ["Évaporation", "Condensation", "Sublimation", "Précipitation"], correct: 0, fact: "L'évaporation est le moteur du cycle de l'eau." },
            { q: "Comment appelle-t-on le centre d'un atome ?", a: ["Noyau", "Électron", "Proton", "Quark"], correct: 0, fact: "Le noyau contient protons et neutrons." },
            { q: "Combien de cavités le cœur humain possède-t-il ?", a: ["4", "2", "3", "6"], correct: 0, fact: "Deux oreillettes et deux ventricules forment les quatre cavités." }
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
            { q: "Who discovered America?", a: ["Christopher Columbus", "Leif Erikson", "Amerigo Vespucci", "Vasco da Gama"], correct: 0, fact: "Columbus reached the Americas in 1492." },
            { q: "The Berlin Wall fell in which year?", a: ["1989", "1991", "1985", "1979"], correct: 0, fact: "The wall fell on November 9, 1989, reuniting East and West Berlin." },
            { q: "Which queen ruled ancient Egypt alongside her dynasty's end?", a: ["Cleopatra", "Nefertiti", "Hatshepsut", "Isis"], correct: 0, fact: "Cleopatra VII was the last active ruler of the Ptolemaic Kingdom." },
            { q: "World War I began in which year?", a: ["1914", "1918", "1939", "1905"], correct: 0, fact: "It began after the assassination of Archduke Franz Ferdinand in June 1914." },
            { q: "Which civilization invented the wheel?", a: ["Mesopotamians", "Egyptians", "Greeks", "Chinese"], correct: 0, fact: "The wheel appeared in Mesopotamia around 3500 BC." },
            { q: "Who wrote the 95 Theses, sparking the Reformation?", a: ["Martin Luther", "John Calvin", "Henry VIII", "Erasmus"], correct: 0, fact: "Luther nailed them to a church door in Wittenberg in 1517." },
            { q: "The Renaissance began in which country?", a: ["Italy", "France", "England", "Spain"], correct: 0, fact: "It began in Florence, Italy, in the 14th century." },
            { q: "Which ship famously sank in 1912?", a: ["Titanic", "Lusitania", "Bismarck", "Queen Mary"], correct: 0, fact: "The RMS Titanic hit an iceberg on its maiden voyage." },
            { q: "Who was the first Emperor of China?", a: ["Qin Shi Huang", "Kublai Khan", "Sun Yat-sen", "Genghis Khan"], correct: 0, fact: "Qin Shi Huang unified China in 221 BC." },
            { q: "Which war was fought between the North and South of America?", a: ["Civil War", "Revolutionary War", "Mexican-American War", "Spanish-American War"], correct: 0, fact: "The American Civil War lasted from 1861 to 1865." },
            { q: "Who was Napoleon Bonaparte?", a: ["French Emperor", "British General", "Russian Tsar", "Spanish King"], correct: 0, fact: "Napoleon rose from military officer to Emperor of the French." },
            { q: "In which city was the Magna Carta signed?", a: ["Runnymede", "London", "Canterbury", "York"], correct: 0, fact: "King John signed it at Runnymede in 1215." },
            { q: "Which ancient wonder was located in Alexandria?", a: ["The Lighthouse", "The Colossus", "The Hanging Gardens", "The Statue of Zeus"], correct: 0, fact: "The Lighthouse of Alexandria guided ships for centuries." }
        ],
        fr: [
            { q: "Qui était le premier président des États-Unis ?", a: ["George Washington", "Thomas Jefferson", "Abraham Lincoln", "John Adams"], correct: 0, fact: "Washington a servi de 1789 à 1797." },
            { q: "En quelle année la Seconde Guerre mondiale s'est-elle terminée ?", a: ["1945", "1944", "1946", "1943"], correct: 0, fact: "La guerre s'est terminée en 1945." },
            { q: "Qui a peint la Joconde ?", a: ["Léonard de Vinci", "Michel-Ange", "Raphaël", "Donatello"], correct: 0, fact: "De Vinci a peint la Joconde entre 1503 et 1519." },
            { q: "Quelle civilisation a construit le Machu Picchu ?", a: ["Inca", "Maya", "Aztèque", "Olmèque"], correct: 0, fact: "Le Machu Picchu a été construit par l'Empire Inca au 15ème siècle." },
            { q: "Qui était le premier homme sur la lune ?", a: ["Neil Armstrong", "Buzz Aldrin", "Youri Gagarine", "Michael Collins"], correct: 0, fact: "Neil Armstrong a marché sur la lune le 20 juillet 1969." },
            { q: "Quel empire était dirigé par Jules César ?", a: ["Empire Romain", "Empire Grec", "Empire Perse", "Empire Ottoman"], correct: 0, fact: "Jules César était un général et homme d'État romain." },
            { q: "Quand la Révolution française a-t-elle commencé ?", a: ["1789", "1776", "1804", "1750"], correct: 0, fact: "La Révolution française a commencé avec la prise de la Bastille le 14 juillet 1789." },
            { q: "Qui a découvert l'Amérique ?", a: ["Christophe Colomb", "Leif Erikson", "Amerigo Vespucci", "Vasco de Gama"], correct: 0, fact: "Colomb a atteint les Amériques en 1492." },
            { q: "En quelle année le mur de Berlin est-il tombé ?", a: ["1989", "1991", "1985", "1979"], correct: 0, fact: "Le mur est tombé le 9 novembre 1989." },
            { q: "Quelle reine a régné sur l'Égypte ancienne à la fin de sa dynastie ?", a: ["Cléopâtre", "Néfertiti", "Hatchepsout", "Isis"], correct: 0, fact: "Cléopâtre VII fut la dernière souveraine du royaume ptolémaïque." },
            { q: "En quelle année la Première Guerre mondiale a-t-elle commencé ?", a: ["1914", "1918", "1939", "1905"], correct: 0, fact: "Elle a commencé après l'assassinat de l'archiduc François-Ferdinand." },
            { q: "Quelle civilisation a inventé la roue ?", a: ["Mésopotamiens", "Égyptiens", "Grecs", "Chinois"], correct: 0, fact: "La roue est apparue en Mésopotamie vers 3500 av. J.-C." },
            { q: "Qui a écrit les 95 thèses, déclenchant la Réforme ?", a: ["Martin Luther", "Jean Calvin", "Henri VIII", "Érasme"], correct: 0, fact: "Luther les a affichées à Wittemberg en 1517." },
            { q: "Dans quel pays la Renaissance a-t-elle commencé ?", a: ["Italie", "France", "Angleterre", "Espagne"], correct: 0, fact: "Elle a commencé à Florence, en Italie, au 14ème siècle." },
            { q: "Quel navire célèbre a coulé en 1912 ?", a: ["Titanic", "Lusitania", "Bismarck", "Queen Mary"], correct: 0, fact: "Le RMS Titanic a heurté un iceberg lors de son voyage inaugural." },
            { q: "Qui fut le premier Empereur de Chine ?", a: ["Qin Shi Huang", "Kubilaï Khan", "Sun Yat-sen", "Gengis Khan"], correct: 0, fact: "Qin Shi Huang unifia la Chine en 221 av. J.-C." },
            { q: "Quelle guerre opposa le Nord et le Sud des États-Unis ?", a: ["Guerre Civile", "Guerre d'Indépendance", "Guerre Mexicaine", "Guerre Hispano-Américaine"], correct: 0, fact: "La guerre de Sécession dura de 1861 à 1865." },
            { q: "Qui était Napoléon Bonaparte ?", a: ["Empereur des Français", "Général Britannique", "Tsar de Russie", "Roi d'Espagne"], correct: 0, fact: "Napoléon passa d'officier militaire à Empereur des Français." },
            { q: "Dans quelle ville la Magna Carta fut-elle signée ?", a: ["Runnymede", "Londres", "Cantorbéry", "York"], correct: 0, fact: "Le roi Jean la signa à Runnymede en 1215." },
            { q: "Quelle merveille antique se trouvait à Alexandrie ?", a: ["Le Phare", "Le Colosse", "Les Jardins Suspendus", "La Statue de Zeus"], correct: 0, fact: "Le Phare d'Alexandrie guidait les navires depuis des siècles." }
        ]
    },
    gaming: {
        en: [
            { q: "Which company created Mario?", a: ["Nintendo", "Sega", "Sony", "Microsoft"], correct: 0, fact: "Mario was created by Shigeru Miyamoto and first appeared in Donkey Kong (1981)." },
            { q: "In CODM, what does 'ADS' mean?", a: ["Aim Down Sights", "Auto Deploy System", "Advanced Defense Shield", "Aerial Drop Support"], correct: 0, fact: "ADS refers to aiming down your weapon's sights for better accuracy." },
            { q: "What is the best-selling video game of all time?", a: ["Minecraft", "GTA V", "Tetris", "Wii Sports"], correct: 0, fact: "Minecraft has sold over 300 million copies worldwide." },
            { q: "What year was the first Call of Duty released?", a: ["2003", "2001", "2005", "2007"], correct: 0, fact: "The original Call of Duty was released on October 29, 2003." },
            { q: "In Pokemon, what type is Pikachu?", a: ["Electric", "Fire", "Water", "Normal"], correct: 0, fact: "Pikachu is the mascot of the Pokémon franchise." },
            { q: "Which game features 'The King of the Iron Fist Tournament'?", a: ["Tekken", "Street Fighter", "Mortal Kombat", "SoulCalibur"], correct: 0, fact: "Tekken's tournament is sponsored by the Mishima Zaibatsu." },
            { q: "What is the name of the main character in The Legend of Zelda?", a: ["Link", "Zelda", "Ganondorf", "Epona"], correct: 0, fact: "Many think it's Zelda — but Zelda is the princess!" },
            { q: "Which game popularized the battle royale genre in 2017?", a: ["Fortnite", "Tetris 99", "Fall Guys", "Among Us"], correct: 0, fact: "Fortnite Battle Royale reached 125 million players in under a year." },
            { q: "In Minecraft, what material is needed to mine diamonds?", a: ["Iron pickaxe", "Wooden pickaxe", "Stone pickaxe", "Gold pickaxe"], correct: 0, fact: "Diamond ore requires at least an iron pickaxe." },
            { q: "What does 'GG' stand for in gaming?", a: ["Good Game", "Great Gun", "Go Go", "Game Over"], correct: 0, fact: "It's sportsmanship slang dating back to 90s competitive StarCraft." },
            { q: "Which console did Sony release in 2020?", a: ["PlayStation 5", "PlayStation 4 Pro", "PlayStation Vita", "PlayStation Classic"], correct: 0, fact: "The PS5 launched in November 2020." },
            { q: "In League of Legends, what is the main map called?", a: ["Summoner's Rift", "Howling Abyss", "Twisted Treeline", "Crystal Scar"], correct: 0, fact: "Summoner's Rift is the iconic 5v5 map." },
            { q: "Which company developed Fortnite?", a: ["Epic Games", "Activision", "EA", "Ubisoft"], correct: 0, fact: "Epic Games also created the Unreal Engine." },
            { q: "What year was Roblox released?", a: ["2006", "2010", "2003", "2015"], correct: 0, fact: "Roblox launched in 2006 and exploded in popularity in the late 2010s." },
            { q: "In GTA V, how many playable protagonists are there?", a: ["3", "1", "2", "4"], correct: 0, fact: "Michael, Franklin and Trevor — a first for the series." },
            { q: "What is the name of the princess in Super Mario Bros?", a: ["Peach", "Zelda", "Daisy", "Rosalina"], correct: 0, fact: "Princess Peach has been Mario's rescue target since 1985." },
            { q: "Which game features a character named Master Chief?", a: ["Halo", "Call of Duty", "Gears of War", "Destiny"], correct: 0, fact: "Master Chief is the Spartan-II supersoldier protagonist of Halo." },
            { q: "What does 'NPC' stand for in gaming?", a: ["Non-Player Character", "Neural Processing Core", "New Player Control", "Network Play Character"], correct: 0, fact: "NPCs populate game worlds and drive story without player control." },
            { q: "Which company makes the Xbox console?", a: ["Microsoft", "Sony", "Nintendo", "Sega"], correct: 0, fact: "Microsoft launched the original Xbox in 2001." },
            { q: "In Among Us, what are players trying to find?", a: ["The Impostor", "The Key", "The Exit", "The Reactor"], correct: 0, fact: "One or more impostors sabotage and eliminate crewmates." }
        ],
        fr: [
            { q: "Quelle entreprise a créé Mario ?", a: ["Nintendo", "Sega", "Sony", "Microsoft"], correct: 0, fact: "Mario a été créé par Shigeru Miyamoto." },
            { q: "Dans CODM, que signifie 'ADS' ?", a: ["Viser avec le viseur", "Système Auto", "Bouclier Avancé", "Support Aérien"], correct: 0, fact: "L'ADS fait référence au fait de viser avec le viseur." },
            { q: "Quel est le jeu vidéo le plus vendu ?", a: ["Minecraft", "GTA V", "Tetris", "Wii Sports"], correct: 0, fact: "Minecraft s'est vendu à plus de 300 millions d'exemplaires." },
            { q: "En quelle année le premier Call of Duty est-il sorti ?", a: ["2003", "2001", "2005", "2007"], correct: 0, fact: "Le Call of Duty original est sorti le 29 octobre 2003." },
            { q: "Dans Pokemon, quel type est Pikachu ?", a: ["Électrique", "Feu", "Eau", "Normal"], correct: 0, fact: "Pikachu est la mascotte de la franchise Pokémon." },
            { q: "Quel jeu présente 'Le Tournoi du Roi du Poing de Fer' ?", a: ["Tekken", "Street Fighter", "Mortal Kombat", "SoulCalibur"], correct: 0, fact: "Le tournoi de Tekken est sponsorisé par le Mishima Zaibatsu." },
            { q: "Comment s'appelle le héros de The Legend of Zelda ?", a: ["Link", "Zelda", "Ganondorf", "Epona"], correct: 0, fact: "Beaucoup pensent que c'est Zelda — mais Zelda est la princesse !" },
            { q: "Quel jeu a popularisé le battle royale en 2017 ?", a: ["Fortnite", "Tetris 99", "Fall Guys", "Among Us"], correct: 0, fact: "Fortnite a atteint 125 millions de joueurs en moins d'un an." },
            { q: "Dans Minecraft, quel outil faut-il pour miner du diamant ?", a: ["Pioche en fer", "Pioche en bois", "Pioche en pierre", "Pioche en or"], correct: 0, fact: "Le minerai de diamant nécessite au moins une pioche en fer." },
            { q: "Que signifie 'GG' dans le gaming ?", a: ["Good Game", "Great Gun", "Go Go", "Game Over"], correct: 0, fact: "Une marque de fair-play née dans le StarCraft compétitif des années 90." },
            { q: "Quelle console Sony a-t-il lancée en 2020 ?", a: ["PlayStation 5", "PlayStation 4 Pro", "PlayStation Vita", "PlayStation Classic"], correct: 0, fact: "La PS5 est sortie en novembre 2020." },
            { q: "Dans League of Legends, comment s'appelle la carte principale ?", a: ["Summoner's Rift", "Howling Abyss", "Twisted Treeline", "Crystal Scar"], correct: 0, fact: "Summoner's Rift est la carte 5v5 emblématique." },
            { q: "Quelle entreprise a développé Fortnite ?", a: ["Epic Games", "Activision", "EA", "Ubisoft"], correct: 0, fact: "Epic Games a aussi créé l'Unreal Engine." },
            { q: "En quelle année Roblox est-il sorti ?", a: ["2006", "2010", "2003", "2015"], correct: 0, fact: "Roblox a été lancé en 2006." },
            { q: "Dans GTA V, combien y a-t-il de protagonistes jouables ?", a: ["3", "1", "2", "4"], correct: 0, fact: "Michael, Franklin et Trevor — une première pour la série." },
            { q: "Comment s'appelle la princesse de Super Mario Bros ?", a: ["Peach", "Zelda", "Daisy", "Rosalina"], correct: 0, fact: "La princesse Peach est le personnage à sauver depuis 1985." },
            { q: "Quel jeu met en scène le Master Chief ?", a: ["Halo", "Call of Duty", "Gears of War", "Destiny"], correct: 0, fact: "Le Master Chief est le super-soldat Spartan-II protagoniste de Halo." },
            { q: "Que signifie 'PNJ' dans le jeu vidéo ?", a: ["Personnage Non Joueur", "Processeur Neural de Jeu", "Protocole de Navigation de Jeu", "Plateforme de Nouveaux Joueurs"], correct: 0, fact: "Les PNJ peuplent les mondes de jeu sans contrôle du joueur." },
            { q: "Quelle entreprise fabrique la console Xbox ?", a: ["Microsoft", "Sony", "Nintendo", "Sega"], correct: 0, fact: "Microsoft a lancé la première Xbox en 2001." },
            { q: "Dans Among Us, que cherchent les joueurs ?", a: ["L'Imposteur", "La Clé", "La Sortie", "Le Réacteur"], correct: 0, fact: "Un ou plusieurs imposteurs sabotent et éliminent les équipiers." }
        ]
    },
    technology: {
        en: [
            { q: "What does CPU stand for?", a: ["Central Processing Unit", "Computer Personal Unit", "Central Program Utility", "Core Processing Utility"], correct: 0, fact: "The CPU is the brain of the computer." },
            { q: "Which company created JavaScript?", a: ["Netscape", "Microsoft", "Google", "Apple"], correct: 0, fact: "JavaScript was created by Brendan Eich at Netscape in 1995." },
            { q: "What does 'HTTP' stand for?", a: ["HyperText Transfer Protocol", "High Tech Transfer Process", "Hyperlink Text Protocol", "Home Tool Transfer Protocol"], correct: 0, fact: "HTTP is the foundation of data communication on the web." },
            { q: "Who is the creator of Linux?", a: ["Linus Torvalds", "Bill Gates", "Steve Jobs", "Mark Zuckerberg"], correct: 0, fact: "Linus Torvalds created Linux in 1991." },
            { q: "What year was the first iPhone released?", a: ["2007", "2005", "2008", "2006"], correct: 0, fact: "Steve Jobs unveiled the first iPhone on January 9, 2007." },
            { q: "What does 'AI' stand for?", a: ["Artificial Intelligence", "Automated Interface", "Advanced Integration", "Algorithmic Input"], correct: 0, fact: "AI refers to machines that can perform tasks requiring human intelligence." },
            { q: "What does 'USB' stand for?", a: ["Universal Serial Bus", "United System Bridge", "Ultra Speed Buffer", "Universal System Board"], correct: 0, fact: "USB was introduced in 1996 to standardize connections." },
            { q: "Who founded Microsoft with Bill Gates?", a: ["Paul Allen", "Steve Wozniak", "Steve Ballmer", "Larry Page"], correct: 0, fact: "Allen and Gates founded Microsoft in 1975." },
            { q: "What does 'RAM' stand for?", a: ["Random Access Memory", "Rapid Action Module", "Read Access Memory", "Remote Array Memory"], correct: 0, fact: "RAM is your computer's short-term working memory." },
            { q: "In binary code, what does '1' represent?", a: ["On / True", "Off / False", "Zero", "Null"], correct: 0, fact: "Binary uses only 1 and 0 — the language of all computers." },
            { q: "Which company owns YouTube?", a: ["Google", "Meta", "Amazon", "Microsoft"], correct: 0, fact: "Google acquired YouTube in 2006 for $1.65 billion." },
            { q: "What was the first graphical web browser?", a: ["Mosaic", "Netscape", "Internet Explorer", "Firefox"], correct: 0, fact: "Mosaic, released in 1993, made the web visual." },
            { q: "What does 'GPU' stand for?", a: ["Graphics Processing Unit", "General Program Utility", "Global Processing Unit", "Graphics Power Unit"], correct: 0, fact: "GPUs power gaming and modern AI training alike." },
            { q: "Which language is known as the backbone of web pages?", a: ["HTML", "Python", "C++", "Java"], correct: 0, fact: "HTML structures every page you visit." },
            { q: "What does 'Wi-Fi' primarily use to transmit data?", a: ["Radio waves", "Light beams", "Sound waves", "Magnetic fields"], correct: 0, fact: "Wi-Fi operates mainly on 2.4 GHz and 5 GHz radio bands." },
            { q: "What does 'VPN' stand for?", a: ["Virtual Private Network", "Visual Processing Node", "Verified Public Network", "Variable Packet Notation"], correct: 0, fact: "VPNs encrypt your connection and mask your IP address." },
            { q: "Which programming language is known as the language of the web?", a: ["JavaScript", "Python", "Ruby", "PHP"], correct: 0, fact: "JavaScript runs in every modern browser natively." },
            { q: "What is 'open source' software?", a: ["Software with publicly available code", "Free antivirus software", "Software made by governments", "Offline-only software"], correct: 0, fact: "Open source lets anyone view, modify, and distribute the code." },
            { q: "What does 'SSD' stand for?", a: ["Solid State Drive", "Super Speed Disk", "System Storage Device", "Serial Sync Drive"], correct: 0, fact: "SSDs use flash memory with no moving parts, making them faster than HDDs." },
            { q: "Who founded Apple Computer Company?", a: ["Steve Jobs", "Bill Gates", "Elon Musk", "Jeff Bezos"], correct: 0, fact: "Steve Jobs co-founded Apple with Wozniak and Wayne in 1976." }
        ],
        fr: [
            { q: "Que signifie CPU ?", a: ["Unité Centrale de Traitement", "Unité Personnelle d'Ordinateur", "Utilitaire Central de Programme", "Utilitaire de Traitement Central"], correct: 0, fact: "Le CPU est le cerveau de l'ordinateur." },
            { q: "Quelle entreprise a créé JavaScript ?", a: ["Netscape", "Microsoft", "Google", "Apple"], correct: 0, fact: "JavaScript a été créé par Brendan Eich chez Netscape en 1995." },
            { q: "Que signifie 'HTTP' ?", a: ["Protocole de Transfert HyperTexte", "Processus de Transfert Haute Tech", "Protocole de Texte Hyperlien", "Protocole de Transfert Domestique"], correct: 0, fact: "HTTP est la base de la communication de données sur le web." },
            { q: "Qui est le créateur de Linux ?", a: ["Linus Torvalds", "Bill Gates", "Steve Jobs", "Mark Zuckerberg"], correct: 0, fact: "Linus Torvalds a créé Linux en 1991." },
            { q: "En quelle année le premier iPhone est-il sorti ?", a: ["2007", "2005", "2008", "2006"], correct: 0, fact: "Steve Jobs a dévoilé le premier iPhone le 9 janvier 2007." },
            { q: "Que signifie 'IA' ?", a: ["Intelligence Artificielle", "Interface Automatisée", "Intégration Avancée", "Entrée Algorithmique"], correct: 0, fact: "L'IA désigne les machines capables d'effectuer des tâches nécessitant l'intelligence humaine." },
            { q: "Que signifie 'USB' ?", a: ["Bus Série Universel", "Pont Système Unifié", "Tampon Ultra Rapide", "Carte Système Universelle"], correct: 0, fact: "L'USB a été introduit en 1996 pour standardiser les connexions." },
            { q: "Qui a fondé Microsoft avec Bill Gates ?", a: ["Paul Allen", "Steve Wozniak", "Steve Ballmer", "Larry Page"], correct: 0, fact: "Allen et Gates ont fondé Microsoft en 1975." },
            { q: "Que signifie 'RAM' ?", a: ["Mémoire vive", "Module d'action rapide", "Mémoire de lecture", "Mémoire distante"], correct: 0, fact: "La RAM est la mémoire de travail à court terme de l'ordinateur." },
            { q: "En code binaire, que représente '1' ?", a: ["Activé / Vrai", "Désactivé / Faux", "Zéro", "Nul"], correct: 0, fact: "Le binaire n'utilise que 1 et 0 — le langage de tous les ordinateurs." },
            { q: "Quelle entreprise possède YouTube ?", a: ["Google", "Meta", "Amazon", "Microsoft"], correct: 0, fact: "Google a racheté YouTube en 2006 pour 1,65 milliard de dollars." },
            { q: "Quel fut le premier navigateur web graphique ?", a: ["Mosaic", "Netscape", "Internet Explorer", "Firefox"], correct: 0, fact: "Mosaic, sorti en 1993, a rendu le web visuel." },
            { q: "Que signifie 'GPU' ?", a: ["Processeur graphique", "Utilitaire général", "Processeur global", "Unité de puissance graphique"], correct: 0, fact: "Les GPU alimentent le gaming et l'entraînement de l'IA moderne." },
            { q: "Quel langage est la colonne vertébrale des pages web ?", a: ["HTML", "Python", "C++", "Java"], correct: 0, fact: "HTML structure chaque page que vous visitez." },
            { q: "Qu'est-ce que le Wi-Fi utilise pour transmettre les données ?", a: ["Ondes radio", "Faisceaux lumineux", "Ondes sonores", "Champs magnétiques"], correct: 0, fact: "Le Wi-Fi fonctionne principalement sur les bandes 2,4 GHz et 5 GHz." },
            { q: "Que signifie 'VPN' ?", a: ["Réseau Privé Virtuel", "Nœud de Traitement Visuel", "Réseau Public Vérifié", "Notation de Paquets Variables"], correct: 0, fact: "Les VPN chiffrent votre connexion et masquent votre adresse IP." },
            { q: "Quel langage est considéré comme le langage du web ?", a: ["JavaScript", "Python", "Ruby", "PHP"], correct: 0, fact: "JavaScript s'exécute nativement dans tous les navigateurs modernes." },
            { q: "Qu'est-ce qu'un logiciel open source ?", a: ["Logiciel au code public", "Antivirus gratuit", "Logiciel gouvernemental", "Logiciel hors-ligne"], correct: 0, fact: "L'open source permet à chacun de voir, modifier et distribuer le code." },
            { q: "Que signifie 'SSD' ?", a: ["Disque à État Solide", "Disque Super Rapide", "Stockage Système Dédié", "Synchronisation Série Disque"], correct: 0, fact: "Les SSD utilisent la mémoire flash sans pièces mobiles." },
            { q: "Qui a fondé Apple ?", a: ["Steve Jobs", "Bill Gates", "Elon Musk", "Jeff Bezos"], correct: 0, fact: "Steve Jobs a cofondé Apple avec Wozniak et Wayne en 1976." }
        ]
    },
    geography: {
        en: [
            { q: "What is the capital of France?", a: ["Paris", "Lyon", "Marseille", "Bordeaux"], correct: 0, fact: "Paris is known as the City of Light." },
            { q: "Which is the largest ocean on Earth?", a: ["Pacific Ocean", "Atlantic Ocean", "Indian Ocean", "Arctic Ocean"], correct: 0, fact: "The Pacific Ocean covers about 63 million square miles." },
            { q: "What is the longest river in the world?", a: ["Nile", "Amazon", "Yangtze", "Mississippi"], correct: 0, fact: "The Nile River is approximately 6,650 km long." },
            { q: "Which continent is the largest?", a: ["Asia", "Africa", "North America", "Europe"], correct: 0, fact: "Asia covers about 30% of Earth's total land area." },
            { q: "What is the highest mountain in the world?", a: ["Mount Everest", "K2", "Kangchenjunga", "Lhotse"], correct: 0, fact: "Mount Everest stands at 8,849 meters." },
            { q: "What is the smallest country in the world?", a: ["Vatican City", "Monaco", "San Marino", "Liechtenstein"], correct: 0, fact: "Vatican City is only 0.44 square kilometers." },
            { q: "What is the capital of Japan?", a: ["Tokyo", "Osaka", "Kyoto", "Hiroshima"], correct: 0, fact: "Tokyo is the world's most populous metropolitan area." },
            { q: "Which desert is the largest hot desert on Earth?", a: ["Sahara", "Gobi", "Kalahari", "Arabian"], correct: 0, fact: "The Sahara covers 9.2 million km² — almost the size of the USA." },
            { q: "The Great Barrier Reef is located near which country?", a: ["Australia", "Brazil", "Mexico", "Indonesia"], correct: 0, fact: "It's the world's largest coral reef system, visible from space." },
            { q: "What is the capital of Canada?", a: ["Ottawa", "Toronto", "Vancouver", "Montreal"], correct: 0, fact: "Many guess Toronto — but Ottawa is the capital." },
            { q: "Which country has the most natural lakes?", a: ["Canada", "Russia", "Finland", "USA"], correct: 0, fact: "Canada has an estimated 2 million+ lakes." },
            { q: "On which continent is the Amazon rainforest?", a: ["South America", "Africa", "Asia", "Australia"], correct: 0, fact: "The Amazon produces around 6% of the world's oxygen." },
            { q: "What is the capital of Nigeria?", a: ["Abuja", "Lagos", "Kano", "Ibadan"], correct: 0, fact: "Abuja replaced Lagos as capital in 1991." },
            { q: "Which strait separates Europe and Africa?", a: ["Strait of Gibraltar", "Bosphorus", "Suez Canal", "English Channel"], correct: 0, fact: "At its narrowest, only 13 km separate Spain from Morocco." },
            { q: "Which country is both a continent and a country?", a: ["Australia", "Greenland", "Antarctica", "New Zealand"], correct: 0, fact: "Australia is the only country that is also a continent." },
            { q: "What is the capital of Brazil?", a: ["Brasília", "São Paulo", "Rio de Janeiro", "Salvador"], correct: 0, fact: "Brasília replaced Rio de Janeiro as capital in 1960." },
            { q: "Which country has the longest coastline?", a: ["Canada", "Russia", "Norway", "Australia"], correct: 0, fact: "Canada's coastline stretches over 202,000 km." },
            { q: "What is the smallest continent?", a: ["Australia", "Europe", "Antarctica", "South America"], correct: 0, fact: "Australia is both the smallest continent and largest island." },
            { q: "Through how many countries does the Amazon River flow?", a: ["9", "3", "5", "12"], correct: 0, fact: "The Amazon basin spans 9 South American countries." },
            { q: "What is the capital of South Africa?", a: ["Pretoria", "Cape Town", "Johannesburg", "Durban"], correct: 0, fact: "South Africa has three capitals — Pretoria is the executive one." }
        ],
        fr: [
            { q: "Quelle est la capitale de la France ?", a: ["Paris", "Lyon", "Marseille", "Bordeaux"], correct: 0, fact: "Paris est connue comme la Ville Lumière." },
            { q: "Quel est le plus grand océan sur Terre ?", a: ["Océan Pacifique", "Océan Atlantique", "Océan Indien", "Océan Arctique"], correct: 0, fact: "L'océan Pacifique couvre environ 165 millions de km²." },
            { q: "Quel est le plus long fleuve du monde ?", a: ["Nil", "Amazone", "Yangtsé", "Mississippi"], correct: 0, fact: "Le Nil mesure environ 6 650 km de long." },
            { q: "Quel continent est le plus grand ?", a: ["Asie", "Afrique", "Amérique du Nord", "Europe"], correct: 0, fact: "L'Asie couvre environ 30% de la surface terrestre." },
            { q: "Quelle est la plus haute montagne du monde ?", a: ["Mont Everest", "K2", "Kangchenjunga", "Lhotse"], correct: 0, fact: "Le Mont Everest culmine à 8 849 mètres." },
            { q: "Quel est le plus petit pays du monde ?", a: ["Vatican", "Monaco", "Saint-Marin", "Liechtenstein"], correct: 0, fact: "Le Vatican ne fait que 0,44 kilomètres carrés." },
            { q: "Quelle est la capitale du Japon ?", a: ["Tokyo", "Osaka", "Kyoto", "Hiroshima"], correct: 0, fact: "Tokyo est la plus grande métropole du monde." },
            { q: "Quel est le plus grand désert chaud de la planète ?", a: ["Sahara", "Gobi", "Kalahari", "Arabique"], correct: 0, fact: "Le Sahara couvre 9,2 millions de km² — presque la taille des USA." },
            { q: "La Grande Barrière de corail se trouve près de quel pays ?", a: ["Australie", "Brésil", "Mexique", "Indonésie"], correct: 0, fact: "C'est le plus grand récif corallien du monde, visible depuis l'espace." },
            { q: "Quelle est la capitale du Canada ?", a: ["Ottawa", "Toronto", "Vancouver", "Montréal"], correct: 0, fact: "Beaucoup devinent Toronto — mais c'est Ottawa." },
            { q: "Quel pays compte le plus de lacs naturels ?", a: ["Canada", "Russie", "Finlande", "USA"], correct: 0, fact: "Le Canada compte plus de 2 millions de lacs." },
            { q: "Sur quel continent se trouve la forêt amazonienne ?", a: ["Amérique du Sud", "Afrique", "Asie", "Australie"], correct: 0, fact: "L'Amazonie produit environ 6% de l'oxygène mondial." },
            { q: "Quelle est la capitale du Nigeria ?", a: ["Abuja", "Lagos", "Kano", "Ibadan"], correct: 0, fact: "Abuja a remplacé Lagos comme capitale en 1991." },
            { q: "Quel détroit sépare l'Europe et l'Afrique ?", a: ["Détroit de Gibraltar", "Bosphore", "Canal de Suez", "Manche"], correct: 0, fact: "Au plus étroit, seulement 13 km séparent l'Espagne du Maroc." },
            { q: "Quel pays est à la fois un continent et un pays ?", a: ["Australie", "Groenland", "Antarctique", "Nouvelle-Zélande"], correct: 0, fact: "L'Australie est le seul pays qui est aussi un continent." },
            { q: "Quelle est la capitale du Brésil ?", a: ["Brasília", "São Paulo", "Rio de Janeiro", "Salvador"], correct: 0, fact: "Brasília a remplacé Rio de Janeiro comme capitale en 1960." },
            { q: "Quel pays a le littoral le plus long ?", a: ["Canada", "Russie", "Norvège", "Australie"], correct: 0, fact: "Le littoral canadien s'étend sur plus de 202 000 km." },
            { q: "Quel est le plus petit continent ?", a: ["Australie", "Europe", "Antarctique", "Amérique du Sud"], correct: 0, fact: "L'Australie est à la fois le plus petit continent et la plus grande île." },
            { q: "Combien de pays traverse le fleuve Amazone ?", a: ["9", "3", "5", "12"], correct: 0, fact: "Le bassin amazonien s'étend sur 9 pays d'Amérique du Sud." },
            { q: "Quelle est la capitale de l'Afrique du Sud ?", a: ["Pretoria", "Le Cap", "Johannesburg", "Durban"], correct: 0, fact: "L'Afrique du Sud a trois capitales — Pretoria est la capitale exécutive." }
        ]
    },
    space: {
        en: [
            { q: "What is the closest planet to the Sun?", a: ["Mercury", "Venus", "Earth", "Mars"], correct: 0, fact: "Mercury orbits the Sun at an average distance of 58 million km." },
            { q: "How many moons does Mars have?", a: ["2", "1", "3", "0"], correct: 0, fact: "Mars has two moons: Phobos and Deimos." },
            { q: "What is the largest planet in our solar system?", a: ["Jupiter", "Saturn", "Neptune", "Uranus"], correct: 0, fact: "Jupiter is more than twice as massive as all other planets combined." },
            { q: "What is the name of our galaxy?", a: ["Milky Way", "Andromeda", "Triangulum", "Sombrero"], correct: 0, fact: "The Milky Way contains over 100 billion stars." },
            { q: "Who was the first human in space?", a: ["Yuri Gagarin", "Neil Armstrong", "Alan Shepard", "John Glenn"], correct: 0, fact: "Yuri Gagarin orbited Earth on April 12, 1961." },
            { q: "What is the hottest planet in our solar system?", a: ["Venus", "Mercury", "Mars", "Jupiter"], correct: 0, fact: "Venus has surface temperatures over 460°C." },
            { q: "How long does light from the Sun take to reach Earth?", a: ["About 8 minutes", "1 minute", "1 hour", "1 second"], correct: 0, fact: "Sunlight travels 150 million km in about 8 min 20 s." },
            { q: "Which planet is famous for its rings?", a: ["Saturn", "Jupiter", "Uranus", "Neptune"], correct: 0, fact: "Saturn's rings are mostly ice and rock particles." },
            { q: "What does ISS stand for?", a: ["International Space Station", "Interstellar Space Ship", "Inner Solar System", "International Science Satellite"], correct: 0, fact: "The ISS has hosted astronauts continuously since 2000." },
            { q: "What is a light-year?", a: ["A distance", "A duration", "A speed", "A brightness"], correct: 0, fact: "One light-year ≈ 9.46 trillion kilometers." },
            { q: "Which planet rotates on its side?", a: ["Uranus", "Neptune", "Saturn", "Mars"], correct: 0, fact: "Uranus has an axial tilt of about 98 degrees." },
            { q: "What is the Sun mainly made of?", a: ["Hydrogen", "Oxygen", "Iron", "Carbon"], correct: 0, fact: "About 73% hydrogen, 25% helium." },
            { q: "How many planets are in our solar system?", a: ["8", "9", "7", "10"], correct: 0, fact: "Pluto was reclassified as a dwarf planet in 2006." },
            { q: "Which rover landed on Mars in 2021?", a: ["Perseverance", "Curiosity", "Opportunity", "Spirit"], correct: 0, fact: "Perseverance carries the Ingenuity helicopter." },
            { q: "What force forms black holes?", a: ["Gravity collapsing a massive star", "Magnetic storms", "Solar flares", "Dark energy"], correct: 0, fact: "Not even light can escape a black hole's event horizon." },
            { q: "What is the name of NASA's most famous space telescope?", a: ["Hubble", "James Webb", "Spitzer", "Chandra"], correct: 0, fact: "The Hubble Space Telescope launched in 1990 and revolutionized astronomy." },
            { q: "What planet is known for its Great Red Spot?", a: ["Jupiter", "Mars", "Saturn", "Neptune"], correct: 0, fact: "The Great Red Spot is a storm larger than Earth that has raged for centuries." },
            { q: "What is the term for a star that explodes at the end of its life?", a: ["Supernova", "Pulsar", "Quasar", "Nebula"], correct: 0, fact: "A supernova can briefly outshine an entire galaxy." },
            { q: "Which space agency landed humans on the Moon?", a: ["NASA", "ESA", "Roscosmos", "JAXA"], correct: 0, fact: "NASA's Apollo 11 was the first crewed Moon landing in 1969." },
            { q: "What is the name of Mars's largest volcano?", a: ["Olympus Mons", "Mauna Kea", "Vesuvius", "Etna"], correct: 0, fact: "Olympus Mons is the tallest volcano in the solar system at 22 km." }
        ],
        fr: [
            { q: "Quelle est la planète la plus proche du Soleil ?", a: ["Mercure", "Vénus", "Terre", "Mars"], correct: 0, fact: "Mercure orbite autour du Soleil à 58 millions de km en moyenne." },
            { q: "Combien de lunes Mars possède-t-elle ?", a: ["2", "1", "3", "0"], correct: 0, fact: "Mars a deux lunes : Phobos et Deimos." },
            { q: "Quelle est la plus grande planète du système solaire ?", a: ["Jupiter", "Saturne", "Neptune", "Uranus"], correct: 0, fact: "Jupiter est plus massive que toutes les autres planètes réunies." },
            { q: "Quel est le nom de notre galaxie ?", a: ["Voie Lactée", "Andromède", "Triangle", "Sombrero"], correct: 0, fact: "La Voie Lactée contient plus de 100 milliards d'étoiles." },
            { q: "Qui fut le premier humain dans l'espace ?", a: ["Youri Gagarine", "Neil Armstrong", "Alan Shepard", "John Glenn"], correct: 0, fact: "Youri Gagarine a orbité la Terre le 12 avril 1961." },
            { q: "Quelle est la planète la plus chaude du système solaire ?", a: ["Vénus", "Mercure", "Mars", "Jupiter"], correct: 0, fact: "Vénus dépasse 460°C en surface." },
            { q: "Combien de temps la lumière du Soleil met-elle à nous atteindre ?", a: ["Environ 8 minutes", "1 minute", "1 heure", "1 seconde"], correct: 0, fact: "La lumière parcourt 150 millions de km en 8 min 20 s." },
            { q: "Quelle planète est célèbre pour ses anneaux ?", a: ["Saturne", "Jupiter", "Uranus", "Neptune"], correct: 0, fact: "Les anneaux de Saturne sont faits de glace et de roche." },
            { q: "Que signifie ISS ?", a: ["Station Spatiale Internationale", "Vaisseau Spatial Interstellaire", "Système Solaire Interne", "Satellite Scientifique International"], correct: 0, fact: "L'ISS accueille des astronautes en continu depuis 2000." },
            { q: "Qu'est-ce qu'une année-lumière ?", a: ["Une distance", "Une durée", "Une vitesse", "Une luminosité"], correct: 0, fact: "Une année-lumière ≈ 9 460 milliards de kilomètres." },
            { q: "Quelle planète tourne sur le côté ?", a: ["Uranus", "Neptune", "Saturne", "Mars"], correct: 0, fact: "Uranus a une inclinaison axiale d'environ 98 degrés." },
            { q: "De quoi le Soleil est-il principalement composé ?", a: ["Hydrogène", "Oxygène", "Fer", "Carbone"], correct: 0, fact: "Environ 73% d'hydrogène et 25% d'hélium." },
            { q: "Combien de planètes compte notre système solaire ?", a: ["8", "9", "7", "10"], correct: 0, fact: "Pluton a été reclassée planète naine en 2006." },
            { q: "Quel rover a atterri sur Mars en 2021 ?", a: ["Perseverance", "Curiosity", "Opportunity", "Spirit"], correct: 0, fact: "Perseverance transporte l'hélicoptère Ingenuity." },
            { q: "Qu'est-ce qui forme un trou noir ?", a: ["L'effondrement gravitationnel d'une étoile massive", "Les tempêtes magnétiques", "Les éruptions solaires", "L'énergie sombre"], correct: 0, fact: "Même la lumière ne peut échapper à l'horizon d'un trou noir." },
            { q: "Quel est le télescope spatial le plus célèbre de la NASA ?", a: ["Hubble", "James Webb", "Spitzer", "Chandra"], correct: 0, fact: "Le télescope Hubble a révolutionné l'astronomie depuis 1990." },
            { q: "Quelle planète est connue pour sa Grande Tache Rouge ?", a: ["Jupiter", "Mars", "Saturne", "Neptune"], correct: 0, fact: "La Grande Tache Rouge est une tempête plus grande que la Terre." },
            { q: "Comment appelle-t-on une étoile qui explose en fin de vie ?", a: ["Supernova", "Pulsar", "Quasar", "Nébuleuse"], correct: 0, fact: "Une supernova peut brièvement éclipser une galaxie entière." },
            { q: "Quelle agence spatiale a posé des humains sur la Lune ?", a: ["NASA", "ESA", "Roscosmos", "JAXA"], correct: 0, fact: "L'Apollo 11 de la NASA fut le premier alunissage habité en 1969." },
            { q: "Quel est le nom du plus grand volcan de Mars ?", a: ["Olympus Mons", "Mauna Kea", "Vésuve", "Etna"], correct: 0, fact: "Olympus Mons culmine à 22 km — le plus haut volcan du système solaire." }
        ]
    },
    animals: {
        en: [
            { q: "What is the largest animal on Earth?", a: ["Blue Whale", "African Elephant", "Giraffe", "Great White Shark"], correct: 0, fact: "Blue whales can grow up to 30 meters long and weigh over 180 tons." },
            { q: "What is the fastest land animal?", a: ["Cheetah", "Lion", "Greyhound", "Pronghorn"], correct: 0, fact: "Cheetahs can reach speeds of up to 120 km/h." },
            { q: "How many hearts does an octopus have?", a: ["3", "1", "2", "4"], correct: 0, fact: "Octopuses have three hearts and blue blood." },
            { q: "What is the only mammal capable of true flight?", a: ["Bat", "Flying Squirrel", "Colugo", "Sugar Glider"], correct: 0, fact: "Bats are the only mammals that can truly fly." },
            { q: "What is a group of lions called?", a: ["Pride", "Pack", "Herd", "Flock"], correct: 0, fact: "A pride typically consists of about 15 lions." },
            { q: "Which bird can fly backwards?", a: ["Hummingbird", "Eagle", "Sparrow", "Pigeon"], correct: 0, fact: "Hummingbirds are the only birds that can fly backwards." },
            { q: "How many legs does a spider have?", a: ["8", "6", "10", "12"], correct: 0, fact: "Spiders are arachnids, not insects — insects have 6 legs." },
            { q: "Which animal is known as the 'King of the Jungle'?", a: ["Lion", "Tiger", "Elephant", "Gorilla"], correct: 0, fact: "Ironically, lions live in savannas, not jungles." },
            { q: "What is the tallest animal in the world?", a: ["Giraffe", "Elephant", "Ostrich", "Moose"], correct: 0, fact: "Giraffes can reach 5.5 meters tall." },
            { q: "How long can a crocodile hold its breath underwater?", a: ["Up to 1 hour", "5 minutes", "10 hours", "30 seconds"], correct: 0, fact: "A resting crocodile can slow its heart to 2-3 beats per minute." },
            { q: "Which animal has the longest lifespan?", a: ["Greenland shark", "African elephant", "Giant tortoise", "Blue whale"], correct: 0, fact: "Greenland sharks can live over 400 years." },
            { q: "What is a baby kangaroo called?", a: ["Joey", "Cub", "Calf", "Pup"], correct: 0, fact: "Joeys live in their mother's pouch for months." },
            { q: "Which sea creature is known for changing color?", a: ["Octopus", "Dolphin", "Seahorse", "Jellyfish"], correct: 0, fact: "Octopuses use chromatophores to change color instantly." },
            { q: "What is the largest bird in the world?", a: ["Ostrich", "Emu", "Albatross", "Condor"], correct: 0, fact: "Ostriches can weigh up to 150 kg and run 70 km/h." },
            { q: "How many stomachs does a cow have?", a: ["4", "1", "2", "3"], correct: 0, fact: "The four compartments help digest tough grass." },
            { q: "What is the fastest bird in the world?", a: ["Peregrine Falcon", "Golden Eagle", "Ostrich", "Swift"], correct: 0, fact: "The peregrine falcon dives at over 320 km/h." },
            { q: "Which animal never sleeps?", a: ["Bullfrog", "Dolphin", "Elephant", "Giraffe"], correct: 0, fact: "Bullfrogs show no change in brain activity between rest and activity." },
            { q: "How do sharks detect prey in dark water?", a: ["Electroreception", "Echolocation", "Infrared vision", "Smell alone"], correct: 0, fact: "Sharks sense electrical fields from muscle contractions via ampullae of Lorenzini." },
            { q: "Which insect has the shortest lifespan?", a: ["Mayfly", "Mosquito", "Housefly", "Ant"], correct: 0, fact: "Adult mayflies live only 24 hours — just long enough to reproduce." },
            { q: "What is the only venomous mammal?", a: ["Platypus", "Shrew", "Slow Loris", "Hedgehog"], correct: 0, fact: "The male platypus has venomous spurs on its hind legs." }
        ],
        fr: [
            { q: "Quel est le plus grand animal sur Terre ?", a: ["Baleine Bleue", "Éléphant d'Afrique", "Girafe", "Grand Requin Blanc"], correct: 0, fact: "Les baleines bleues peuvent atteindre 30 mètres et 180 tonnes." },
            { q: "Quel est l'animal terrestre le plus rapide ?", a: ["Guépard", "Lion", "Lévrier", "Antilope"], correct: 0, fact: "Les guépards atteignent 120 km/h." },
            { q: "Combien de cœurs a une pieuvre ?", a: ["3", "1", "2", "4"], correct: 0, fact: "Les pieuvres ont trois cœurs et le sang bleu." },
            { q: "Quel est le seul mammifère capable de voler vraiment ?", a: ["Chauve-souris", "Écureuil Volant", "Colugo", "Phalanger Volant"], correct: 0, fact: "Les chauves-souris sont les seuls mammifères volants." },
            { q: "Comment appelle-t-on un groupe de lions ?", a: ["Troupe", "Meute", "Troupeau", "Volée"], correct: 0, fact: "Une troupe compte environ 15 lions." },
            { q: "Quel oiseau peut voler en arrière ?", a: ["Colibri", "Aigle", "Moineau", "Pigeon"], correct: 0, fact: "Les colibris sont les seuls oiseaux volant en arrière." },
            { q: "Combien de pattes a une araignée ?", a: ["8", "6", "10", "12"], correct: 0, fact: "Les araignées sont des arachnides, pas des insectes." },
            { q: "Quel animal est surnommé le 'Roi de la Jungle' ?", a: ["Lion", "Tigre", "Éléphant", "Gorille"], correct: 0, fact: "Ironiquement, les lions vivent dans la savane." },
            { q: "Quel est l'animal le plus grand du monde ?", a: ["Girafe", "Éléphant", "Autruche", "Élan"], correct: 0, fact: "Les girafes peuvent atteindre 5,5 mètres." },
            { q: "Combien de temps un crocodile peut-il retenir son souffle ?", a: ["Jusqu'à 1 heure", "5 minutes", "10 heures", "30 secondes"], correct: 0, fact: "Un crocodile au repos ralentit son cœur à 2-3 battements/min." },
            { q: "Quel animal vit le plus longtemps ?", a: ["Requin du Groenland", "Éléphant d'Afrique", "Tortue géante", "Baleine bleue"], correct: 0, fact: "Les requins du Groenland peuvent vivre plus de 400 ans." },
            { q: "Comment s'appelle un bébé kangourou ?", a: ["Joey", "Ourson", "Veau", "Chiot"], correct: 0, fact: "Les joeys vivent dans la poche de leur mère pendant des mois." },
            { q: "Quelle créature marine change de couleur ?", a: ["Pieuvre", "Dauphin", "Hippocampe", "Méduse"], correct: 0, fact: "Les pieuvres utilisent des chromatophores pour changer de couleur." },
            { q: "Quel est le plus grand oiseau du monde ?", a: ["Autruche", "Émeu", "Albatros", "Condor"], correct: 0, fact: "Les autruches pèsent jusqu'à 150 kg et courent à 70 km/h." },
            { q: "Combien d'estomacs a une vache ?", a: ["4", "1", "2", "3"], correct: 0, fact: "Les quatre compartiments aident à digérer l'herbe." },
            { q: "Quel est l'oiseau le plus rapide du monde ?", a: ["Faucon pèlerin", "Aigle royal", "Autruche", "Martinet"], correct: 0, fact: "Le faucon pèlerin plonge à plus de 320 km/h." },
            { q: "Quel animal ne dort jamais ?", a: ["Grenouille-taureau", "Dauphin", "Éléphant", "Girafe"], correct: 0, fact: "La grenouille-taureau ne montre aucun changement d'activité cérébrale au repos." },
            { q: "Comment les requins détectent-ils leurs proies dans l'obscurité ?", a: ["Électroréception", "Écholocation", "Vision infrarouge", "Odorat seul"], correct: 0, fact: "Les requins captent les champs électriques via les ampoules de Lorenzini." },
            { q: "Quel insecte a la durée de vie la plus courte ?", a: ["Éphémère", "Moustique", "Mouche", "Fourmi"], correct: 0, fact: "L'éphémère adulte ne vit que 24 heures — juste assez pour se reproduire." },
            { q: "Quel est le seul mammifère venimeux ?", a: ["Ornithorynque", "Musaraigne", "Loris paresseux", "Hérisson"], correct: 0, fact: "Le mâle ornithorynque possède des éperons venimeux sur les pattes arrière." }
        ]
    },
    sports: {
        en: [
            { q: "How many players are on a football (soccer) team?", a: ["11", "10", "12", "9"], correct: 0, fact: "Each team has 11 players on the field." },
            { q: "Which country has won the most FIFA World Cups?", a: ["Brazil", "Germany", "Italy", "Argentina"], correct: 0, fact: "Brazil has won the World Cup 5 times." },
            { q: "In which sport would you perform a 'slam dunk'?", a: ["Basketball", "Volleyball", "Tennis", "Baseball"], correct: 0, fact: "A slam dunk is when a player jumps and forcefully scores." },
            { q: "How many rounds are in a professional boxing championship match?", a: ["12", "10", "15", "8"], correct: 0, fact: "Championship boxing matches are 12 rounds." },
            { q: "Which country hosted the 2022 FIFA World Cup?", a: ["Qatar", "Russia", "Brazil", "France"], correct: 0, fact: "Qatar hosted the first World Cup in the Middle East." },
            { q: "What is the highest score possible in 10-pin bowling?", a: ["300", "200", "250", "350"], correct: 0, fact: "A perfect game in bowling is 300 points." },
            { q: "How often are the Summer Olympic Games held?", a: ["Every 4 years", "Every 2 years", "Every 5 years", "Every year"], correct: 0, fact: "The modern Olympics began in Athens in 1896." },
            { q: "In tennis, what is a score of zero called?", a: ["Love", "Null", "Ace", "Deuce"], correct: 0, fact: "'Love' likely comes from the French 'l'œuf' (the egg — shaped like 0)." },
            { q: "Which sport uses a shuttlecock?", a: ["Badminton", "Tennis", "Squash", "Table tennis"], correct: 0, fact: "Badminton is the fastest racket sport — smashes exceed 400 km/h." },
            { q: "How many holes are in a standard round of golf?", a: ["18", "9", "12", "24"], correct: 0, fact: "The standard was set at St Andrews, Scotland." },
            { q: "In which country did judo originate?", a: ["Japan", "China", "Korea", "Thailand"], correct: 0, fact: "Judo was founded by Jigoro Kano in 1882." },
            { q: "What does NBA stand for?", a: ["National Basketball Association", "National Ball Arena", "North Basketball Alliance", "National Boxing Association"], correct: 0, fact: "The NBA was founded in 1946 as the BAA." },
            { q: "How long is an Olympic swimming pool?", a: ["50 meters", "25 meters", "100 meters", "75 meters"], correct: 0, fact: "Olympic pools are 50 m long and 25 m wide." },
            { q: "Which athlete is known as the fastest man alive?", a: ["Usain Bolt", "Carl Lewis", "Mo Farah", "Tyson Gay"], correct: 0, fact: "Bolt ran 100m in 9.58 seconds in 2009." },
            { q: "In which sport is the Ryder Cup contested?", a: ["Golf", "Tennis", "Sailing", "Cricket"], correct: 0, fact: "The Ryder Cup pits Team USA against Team Europe." },
            { q: "Which country invented basketball?", a: ["USA", "Canada", "Brazil", "UK"], correct: 0, fact: "Dr. James Naismith invented basketball in Massachusetts in 1891 — he was Canadian." },
            { q: "How many players are on a volleyball team on court?", a: ["6", "5", "7", "9"], correct: 0, fact: "Six players per side — three front row, three back row." },
            { q: "What is the diameter of a basketball hoop in inches?", a: ["18 inches", "15 inches", "20 inches", "22 inches"], correct: 0, fact: "The rim is 18 inches in diameter — just wide enough for two balls." },
            { q: "Which country has won the most Olympic gold medals overall?", a: ["USA", "Russia", "China", "UK"], correct: 0, fact: "The USA leads with over 1,000 gold medals all-time." },
            { q: "In football, what does VAR stand for?", a: ["Video Assistant Referee", "Virtual Action Review", "Video Action Replay", "Verified Assist Rule"], correct: 0, fact: "VAR was introduced to help referees review key decisions." }
        ],
        fr: [
            { q: "Combien de joueurs dans une équipe de football ?", a: ["11", "10", "12", "9"], correct: 0, fact: "Chaque équipe a 11 joueurs sur le terrain." },
            { q: "Quel pays a gagné le plus de Coupes du Monde FIFA ?", a: ["Brésil", "Allemagne", "Italie", "Argentine"], correct: 0, fact: "Le Brésil a remporté la Coupe du Monde 5 fois." },
            { q: "Dans quel sport effectue-t-on un 'slam dunk' ?", a: ["Basketball", "Volleyball", "Tennis", "Baseball"], correct: 0, fact: "Un slam dunk, c'est marquer en force au basket." },
            { q: "Combien de rounds dans un match de boxe de championnat ?", a: ["12", "10", "15", "8"], correct: 0, fact: "Les matchs de championnat sont de 12 rounds." },
            { q: "Quel pays a accueilli la Coupe du Monde 2022 ?", a: ["Qatar", "Russie", "Brésil", "France"], correct: 0, fact: "Le Qatar a accueilli la première Coupe du Monde au Moyen-Orient." },
            { q: "Quel est le score parfait au bowling ?", a: ["300", "200", "250", "350"], correct: 0, fact: "Une partie parfaite au bowling est de 300 points." },
            { q: "À quelle fréquence ont lieu les Jeux Olympiques d'été ?", a: ["Tous les 4 ans", "Tous les 2 ans", "Tous les 5 ans", "Chaque année"], correct: 0, fact: "Les Jeux modernes ont commencé à Athènes en 1896." },
            { q: "Au tennis, comment appelle-t-on un score de zéro ?", a: ["Love", "Null", "Ace", "Deuce"], correct: 0, fact: "'Love' vient probablement du français 'l'œuf' (forme du 0)." },
            { q: "Quel sport utilise un volant ?", a: ["Badminton", "Tennis", "Squash", "Ping-pong"], correct: 0, fact: "Le badminton est le sport de raquette le plus rapide — plus de 400 km/h." },
            { q: "Combien de trous dans un parcours de golf standard ?", a: ["18", "9", "12", "24"], correct: 0, fact: "Le standard a été fixé à St Andrews, en Écosse." },
            { q: "Dans quel pays le judo est-il né ?", a: ["Japon", "Chine", "Corée", "Thaïlande"], correct: 0, fact: "Le judo a été fondé par Jigoro Kano en 1882." },
            { q: "Que signifie NBA ?", a: ["National Basketball Association", "National Ball Arena", "North Basketball Alliance", "National Boxing Association"], correct: 0, fact: "La NBA a été fondée en 1946 sous le nom de BAA." },
            { q: "Quelle est la longueur d'une piscine olympique ?", a: ["50 mètres", "25 mètres", "100 mètres", "75 mètres"], correct: 0, fact: "Les piscines olympiques font 50 m de long et 25 m de large." },
            { q: "Quel athlète est l'homme le plus rapide du monde ?", a: ["Usain Bolt", "Carl Lewis", "Mo Farah", "Tyson Gay"], correct: 0, fact: "Bolt a couru le 100 m en 9,58 secondes en 2009." },
            { q: "Dans quel sport se dispute la Ryder Cup ?", a: ["Golf", "Tennis", "Voile", "Cricket"], correct: 0, fact: "La Ryder Cup oppose les équipes des USA et d'Europe." },
            { q: "Quel pays a inventé le basketball ?", a: ["USA", "Canada", "Brésil", "UK"], correct: 0, fact: "Le Dr James Naismith a inventé le basketball en 1891 — il était Canadien." },
            { q: "Combien de joueurs sont sur le terrain au volleyball ?", a: ["6", "5", "7", "9"], correct: 0, fact: "Six joueurs par équipe — trois en avant, trois en arrière." },
            { q: "Quel est le diamètre du panier de basketball en cm ?", a: ["45 cm", "38 cm", "50 cm", "55 cm"], correct: 0, fact: "Le cercle mesure 45 cm de diamètre — juste assez pour deux ballons." },
            { q: "Quel pays a remporté le plus de médailles d'or olympiques ?", a: ["USA", "Russie", "Chine", "UK"], correct: 0, fact: "Les USA mènent avec plus de 1 000 médailles d'or." },
            { q: "Dans le football, que signifie VAR ?", a: ["Vidéo-Assistant Arbitre", "Vérification d'Action en Réalité", "Vidéo d'Action Rejouée", "Validation d'Assistance Réglementaire"], correct: 0, fact: "Le VAR aide les arbitres à revoir les décisions clés." }
        ]
    },
    literature: {
        en: [
            { q: "Who wrote 'Romeo and Juliet'?", a: ["William Shakespeare", "Charles Dickens", "Jane Austen", "Mark Twain"], correct: 0, fact: "Shakespeare wrote Romeo and Juliet around 1596." },
            { q: "Who wrote 'Things Fall Apart'?", a: ["Chinua Achebe", "Wole Soyinka", "Ngũgĩ wa Thiong'o", "Chimamanda Adichie"], correct: 0, fact: "Things Fall Apart is the most widely read book in African literature." },
            { q: "Who is the author of 'Harry Potter'?", a: ["J.K. Rowling", "J.R.R. Tolkien", "C.S. Lewis", "Philip Pullman"], correct: 0, fact: "J.K. Rowling wrote the Harry Potter series." },
            { q: "What is the first book of the Bible?", a: ["Genesis", "Exodus", "Matthew", "Psalms"], correct: 0, fact: "Genesis means 'beginning' or 'origin' in Greek." },
            { q: "Who wrote 'The Great Gatsby'?", a: ["F. Scott Fitzgerald", "Ernest Hemingway", "John Steinbeck", "William Faulkner"], correct: 0, fact: "The Great Gatsby was published in 1925." },
            { q: "Who wrote 'Les Misérables'?", a: ["Victor Hugo", "Alexandre Dumas", "Gustave Flaubert", "Émile Zola"], correct: 0, fact: "Victor Hugo wrote Les Misérables in 1862." },
            { q: "Who wrote '1984'?", a: ["George Orwell", "Aldous Huxley", "Ray Bradbury", "Franz Kafka"], correct: 0, fact: "Orwell published 1984 in 1949 — it coined 'Big Brother'." },
            { q: "Which epic poem is attributed to Homer?", a: ["The Odyssey", "The Aeneid", "Beowulf", "The Divine Comedy"], correct: 0, fact: "The Odyssey follows Odysseus's 10-year journey home from Troy." },
            { q: "Who wrote 'The Old Man and the Sea'?", a: ["Ernest Hemingway", "John Steinbeck", "Mark Twain", "Jack London"], correct: 0, fact: "It won Hemingway the Pulitzer Prize in 1953." },
            { q: "Which African author wrote 'Half of a Yellow Sun'?", a: ["Chimamanda Ngozi Adichie", "Chinua Achebe", "Mariama Bâ", "Ama Ata Aidoo"], correct: 0, fact: "The novel depicts the Biafran War in Nigeria." },
            { q: "Who wrote 'Don Quixote'?", a: ["Miguel de Cervantes", "Gabriel García Márquez", "Pablo Neruda", "Jorge Luis Borges"], correct: 0, fact: "Published in 1605, it's often called the first modern novel." },
            { q: "What genre is 'The Hobbit'?", a: ["Fantasy", "Science Fiction", "Horror", "Mystery"], correct: 0, fact: "Tolkien wrote The Hobbit in 1937, before The Lord of the Rings." },
            { q: "Who wrote 'Pride and Prejudice'?", a: ["Jane Austen", "Charlotte Brontë", "Emily Dickinson", "Mary Shelley"], correct: 0, fact: "Austen published it anonymously in 1813." },
            { q: "Which play features the line 'To be or not to be'?", a: ["Hamlet", "Macbeth", "Othello", "King Lear"], correct: 0, fact: "Hamlet's soliloquy is the most quoted in English literature." },
            { q: "Who wrote the 'A Song of Ice and Fire' series?", a: ["George R.R. Martin", "J.R.R. Tolkien", "Brandon Sanderson", "Patrick Rothfuss"], correct: 0, fact: "The series inspired the TV show Game of Thrones." },
            { q: "What is the name of the whale in Moby Dick?", a: ["Moby Dick", "White Fang", "Leviathan", "Pequod"], correct: 0, fact: "Moby Dick is the great white sperm whale hunted by Captain Ahab." },
            { q: "Who wrote 'The Alchemist'?", a: ["Paulo Coelho", "Gabriel García Márquez", "Jorge Amado", "Isabel Allende"], correct: 0, fact: "The Alchemist has sold over 65 million copies worldwide." },
            { q: "In which country is 'Crime and Punishment' set?", a: ["Russia", "France", "Germany", "Poland"], correct: 0, fact: "Dostoevsky set it in St. Petersburg in the 1860s." },
            { q: "What was the pen name of author Mary Ann Evans?", a: ["George Eliot", "George Sand", "Currer Bell", "Ellis Bell"], correct: 0, fact: "She used a male pen name to be taken seriously as a writer." },
            { q: "Which Shakespeare play features the character Shylock?", a: ["The Merchant of Venice", "Othello", "The Tempest", "A Midsummer Night's Dream"], correct: 0, fact: "Shylock is the moneylender who demands a pound of flesh." }
        ],
        fr: [
            { q: "Qui a écrit 'Roméo et Juliette' ?", a: ["William Shakespeare", "Charles Dickens", "Jane Austen", "Mark Twain"], correct: 0, fact: "Shakespeare a écrit Roméo et Juliette vers 1596." },
            { q: "Qui a écrit 'Le Monde s'effondre' ?", a: ["Chinua Achebe", "Wole Soyinka", "Ngũgĩ wa Thiong'o", "Chimamanda Adichie"], correct: 0, fact: "C'est le livre le plus lu de la littérature africaine." },
            { q: "Qui est l'auteur de 'Harry Potter' ?", a: ["J.K. Rowling", "J.R.R. Tolkien", "C.S. Lewis", "Philip Pullman"], correct: 0, fact: "J.K. Rowling a écrit la série Harry Potter." },
            { q: "Quel est le premier livre de la Bible ?", a: ["Genèse", "Exode", "Matthieu", "Psaumes"], correct: 0, fact: "Genèse signifie 'commencement' en grec." },
            { q: "Qui a écrit 'Gatsby le Magnifique' ?", a: ["F. Scott Fitzgerald", "Ernest Hemingway", "John Steinbeck", "William Faulkner"], correct: 0, fact: "Gatsby le Magnifique a été publié en 1925." },
            { q: "Qui a écrit 'Les Misérables' ?", a: ["Victor Hugo", "Alexandre Dumas", "Gustave Flaubert", "Émile Zola"], correct: 0, fact: "Victor Hugo a écrit Les Misérables en 1862." },
            { q: "Qui a écrit '1984' ?", a: ["George Orwell", "Aldous Huxley", "Ray Bradbury", "Franz Kafka"], correct: 0, fact: "Orwell a publié 1984 en 1949 — il a inventé 'Big Brother'." },
            { q: "Quel poème épique est attribué à Homère ?", a: ["L'Odyssée", "L'Énéide", "Beowulf", "La Divine Comédie"], correct: 0, fact: "L'Odyssée suit le voyage d'Ulysse pendant 10 ans." },
            { q: "Qui a écrit 'Le Vieil Homme et la Mer' ?", a: ["Ernest Hemingway", "John Steinbeck", "Mark Twain", "Jack London"], correct: 0, fact: "Il a valu à Hemingway le prix Pulitzer en 1953." },
            { q: "Quelle auteure africaine a écrit 'L'Autre Moitié du soleil' ?", a: ["Chimamanda Ngozi Adichie", "Chinua Achebe", "Mariama Bâ", "Ama Ata Aidoo"], correct: 0, fact: "Le roman dépeint la guerre du Biafra au Nigeria." },
            { q: "Qui a écrit 'Don Quichotte' ?", a: ["Miguel de Cervantes", "Gabriel García Márquez", "Pablo Neruda", "Jorge Luis Borges"], correct: 0, fact: "Publié en 1605, c'est souvent le premier roman moderne." },
            { q: "Quel est le genre du 'Hobbit' ?", a: ["Fantasy", "Science-fiction", "Horreur", "Policier"], correct: 0, fact: "Tolkien a écrit Le Hobbit en 1937." },
            { q: "Qui a écrit 'Orgueil et Préjugés' ?", a: ["Jane Austen", "Charlotte Brontë", "Emily Dickinson", "Mary Shelley"], correct: 0, fact: "Austen l'a publié anonymement en 1813." },
            { q: "Quelle pièce contient 'Être ou ne pas être' ?", a: ["Hamlet", "Macbeth", "Othello", "Le Roi Lear"], correct: 0, fact: "Le monologue d'Hamlet est le plus cité de la littérature anglaise." },
            { q: "Qui a écrit la saga 'Le Trône de fer' ?", a: ["George R.R. Martin", "J.R.R. Tolkien", "Brandon Sanderson", "Patrick Rothfuss"], correct: 0, fact: "La saga a inspiré la série Game of Thrones." },
            { q: "Comment s'appelle la baleine dans Moby Dick ?", a: ["Moby Dick", "Croc-Blanc", "Léviathan", "Pequod"], correct: 0, fact: "Moby Dick est le grand cachalot blanc chassé par le capitaine Achab." },
            { q: "Qui a écrit 'L'Alchimiste' ?", a: ["Paulo Coelho", "Gabriel García Márquez", "Jorge Amado", "Isabel Allende"], correct: 0, fact: "L'Alchimiste s'est vendu à plus de 65 millions d'exemplaires." },
            { q: "Dans quel pays se déroule 'Crime et Châtiment' ?", a: ["Russie", "France", "Allemagne", "Pologne"], correct: 0, fact: "Dostoïevski l'a situé à Saint-Pétersbourg dans les années 1860." },
            { q: "Quel était le pseudonyme de l'auteure Mary Ann Evans ?", a: ["George Eliot", "George Sand", "Currer Bell", "Ellis Bell"], correct: 0, fact: "Elle utilisait un nom masculin pour être prise au sérieux." },
            { q: "Quelle pièce de Shakespeare met en scène Shylock ?", a: ["Le Marchand de Venise", "Othello", "La Tempête", "Le Songe d'une nuit d'été"], correct: 0, fact: "Shylock est le prêteur qui réclame une livre de chair." }
        ]
    },
    mali: {
        en: [
            { q: "What is the capital of Mali?", a: ["Bamako", "Ségou", "Mopti", "Kayes"], correct: 0, fact: "Bamako is located on the Niger River and is Mali's largest city." },
            { q: "Which ancient empire was centered in Mali?", a: ["Mali Empire", "Ghana Empire", "Songhai Empire", "Roman Empire"], correct: 0, fact: "The Mali Empire was one of the wealthiest empires in African history." },
            { q: "Who was Mansa Musa?", a: ["Emperor of Mali", "King of Ghana", "Pharaoh of Egypt", "Chief of Zulu"], correct: 0, fact: "Mansa Musa is considered one of the wealthiest people in history." },
            { q: "Which city was a center of learning in the Mali Empire?", a: ["Timbuktu", "Bamako", "Gao", "Djenné"], correct: 0, fact: "Timbuktu was home to the famous Sankore University." },
            { q: "What is the official language of Mali?", a: ["French", "English", "Arabic", "Bambara"], correct: 0, fact: "French is official, but Bambara is most widely spoken." },
            { q: "Which river flows through Mali?", a: ["Niger River", "Nile River", "Congo River", "Zambezi River"], correct: 0, fact: "The Niger River is the principal river of West Africa." },
            { q: "When did Mali gain independence from France?", a: ["1960", "1958", "1962", "1954"], correct: 0, fact: "Mali became independent on September 22, 1960." },
            { q: "What is the traditional Malian mud-dyed fabric called?", a: ["Bogolan", "Kente", "Ankara", "Dashiki"], correct: 0, fact: "Bogolan (mud cloth) is a handmade Malian cotton fabric." },
            { q: "Which famous mosque is located in Djenné, Mali?", a: ["Great Mosque of Djenné", "Hassan II Mosque", "Blue Mosque", "Al-Azhar Mosque"], correct: 0, fact: "The Great Mosque of Djenné is the largest mud-brick building in the world." },
            { q: "Which Malian musician is known as the 'King of Desert Blues'?", a: ["Ali Farka Touré", "Salif Keita", "Oumou Sangaré", "Toumani Diabaté"], correct: 0, fact: "Ali Farka Touré blended traditional Malian music with American blues." },
            { q: "What is the traditional 21-string harp-lute of Mali?", a: ["Kora", "Balafon", "Djembe", "Ngoni"], correct: 0, fact: "The kora is a unique West African instrument." },
            { q: "What is the name of Mali's national football team?", a: ["Les Aigles", "Les Lions", "Les Éléphants", "Les Étalons"], correct: 0, fact: "Les Aigles (The Eagles) represent Mali in international football." },
            { q: "Who founded the Mali Empire in the 13th century?", a: ["Sundiata Keita", "Mansa Musa", "Askia Muhammad", "Sonni Ali"], correct: 0, fact: "Sundiata, the 'Lion King', united the Manden kingdoms around 1235." },
            { q: "Which legendary Malian singer is called the 'Golden Voice of Africa'?", a: ["Oumou Sangaré", "Salif Keita", "Rokia Traoré", "Fatoumata Diawara"], correct: 0, fact: "Oumou Sangaré is a Wassoulou music icon and women's rights advocate." },
            { q: "The epic of Sundiata is preserved by which hereditary storytellers?", a: ["Griots", "Marabouts", "Fulanis", "Dogons"], correct: 0, fact: "Griots (jeli) have passed down oral history for centuries." },
            { q: "What is the name of Mali's currency union?", a: ["UEMOA", "ECOWAS", "AU", "CEN-SAD"], correct: 0, fact: "Mali is part of the West African Economic and Monetary Union." },
            { q: "Which Malian city is known as the 'City of 333 Saints'?", a: ["Timbuktu", "Djenné", "Gao", "Mopti"], correct: 0, fact: "Timbuktu's 333 saints are honoured in an annual festival." },
            { q: "What instrument is Toumani Diabaté famous for playing?", a: ["Kora", "Djembe", "Balafon", "Ngoni"], correct: 0, fact: "Toumani Diabaté is a Grammy-winning kora virtuoso." },
            { q: "What does the name 'Bamako' mean in Bambara?", a: ["Crocodile River", "City of Gold", "Place of Peace", "Great River"], correct: 0, fact: "'Bama' means crocodile and 'ko' means river in Bambara." },
            { q: "Which Malian empire controlled trans-Saharan gold and salt trade routes?", a: ["Songhai Empire", "Mali Empire", "Ghana Empire", "Kanem-Bornu"], correct: 0, fact: "The Songhai Empire was the largest in West African history." }
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
            { q: "Quelle célèbre mosquée se trouve à Djenné ?", a: ["Grande Mosquée de Djenné", "Mosquée Hassan II", "Mosquée Bleue", "Mosquée Al-Azhar"], correct: 0, fact: "C'est le plus grand édifice en banco du monde." },
            { q: "Quel musicien malien est le 'Roi du Blues du Désert' ?", a: ["Ali Farka Touré", "Salif Keita", "Oumou Sangaré", "Toumani Diabaté"], correct: 0, fact: "Ali Farka Touré a mélangé musique malienne et blues." },
            { q: "Quel est l'instrument à 21 cordes du Mali ?", a: ["Kora", "Balafon", "Djembe", "Ngoni"], correct: 0, fact: "La kora est un instrument unique d'Afrique de l'Ouest." },
            { q: "Quel est le nom de l'équipe de football du Mali ?", a: ["Les Aigles", "Les Lions", "Les Éléphants", "Les Étalons"], correct: 0, fact: "Les Aigles représentent le Mali dans le football international." },
            { q: "Qui a fondé l'Empire du Mali au 13ème siècle ?", a: ["Soundiata Keïta", "Mansa Moussa", "Askia Muhammad", "Sonni Ali"], correct: 0, fact: "Soundiata, le 'Roi Lion', a uni les royaumes du Manden vers 1235." },
            { q: "Quelle chanteuse malienne est la 'Voix d'Or de l'Afrique' ?", a: ["Oumou Sangaré", "Salif Keita", "Rokia Traoré", "Fatoumata Diawara"], correct: 0, fact: "Oumou Sangaré est une icône de la musique Wassoulou." },
            { q: "Quels conteurs héréditaires préservent l'épopée de Soundiata ?", a: ["Griots", "Marabouts", "Peuls", "Dogons"], correct: 0, fact: "Les griots (jeli) transmettent l'histoire orale depuis des siècles." },
            { q: "Quel est le nom de l'union monétaire du Mali ?", a: ["UEMOA", "CEDEAO", "UA", "CEN-SAD"], correct: 0, fact: "Le Mali fait partie de l'Union Économique et Monétaire Ouest-Africaine." },
            { q: "Quelle ville malienne est connue comme la 'Cité des 333 Saints' ?", a: ["Tombouctou", "Djenné", "Gao", "Mopti"], correct: 0, fact: "Les 333 saints de Tombouctou sont honorés lors d'un festival annuel." },
            { q: "Pour quel instrument Toumani Diabaté est-il célèbre ?", a: ["Kora", "Djembe", "Balafon", "Ngoni"], correct: 0, fact: "Toumani Diabaté est un virtuose de la kora primé aux Grammy." },
            { q: "Que signifie le nom 'Bamako' en bambara ?", a: ["Fleuve aux crocodiles", "Cité de l'or", "Lieu de paix", "Grand fleuve"], correct: 0, fact: "'Bama' signifie crocodile et 'ko' signifie fleuve en bambara." },
            { q: "Quel empire malien contrôlait les routes commerciales transsahariennes ?", a: ["Empire Songhaï", "Empire du Mali", "Empire du Ghana", "Kanem-Bornou"], correct: 0, fact: "L'Empire Songhaï fut le plus grand de l'histoire ouest-africaine." }
        ]
    },
    general: {
        en: [
            { q: "How many days are in a leap year?", a: ["366", "365", "364", "367"], correct: 0, fact: "Leap years occur every 4 years." },
            { q: "Who created this bot?", a: ["Moussa Fofana", "OpenAI", "Google", "Microsoft"], correct: 0, fact: "Moussa Fofana (MFOF7310) is the Architect." },
            { q: "How many continents are there?", a: ["7", "6", "5", "8"], correct: 0, fact: "Asia, Africa, North & South America, Antarctica, Europe, Australia." },
            { q: "What is the currency of Mali?", a: ["CFA Franc", "Dollar", "Euro", "Pound"], correct: 0, fact: "Mali uses the West African CFA franc (XOF)." },
            { q: "What is the largest country in Africa?", a: ["Algeria", "DR Congo", "Sudan", "Libya"], correct: 0, fact: "Algeria covers 2.38 million square kilometers." },
            { q: "What is the most spoken first language in the world?", a: ["Mandarin Chinese", "English", "Spanish", "Hindi"], correct: 0, fact: "Mandarin has over 900 million native speakers." },
            { q: "How many colors are in a rainbow?", a: ["7", "5", "6", "8"], correct: 0, fact: "Red, orange, yellow, green, blue, indigo, violet." },
            { q: "What is the capital of Senegal?", a: ["Dakar", "Bamako", "Abidjan", "Conakry"], correct: 0, fact: "Dakar hosts the famous Dakar Rally finish." },
            { q: "How many minutes are in a full day?", a: ["1,440", "1,200", "1,640", "1,000"], correct: 0, fact: "24 hours × 60 minutes = 1,440." },
            { q: "Which planet do we live on?", a: ["Earth", "Mars", "Venus", "Jupiter"], correct: 0, fact: "The only known planet with life — so far!" },
            { q: "What is 10 × 10 + 5?", a: ["105", "100", "110", "95"], correct: 0, fact: "Order of operations: multiplication first." },
            { q: "How many letters are in the English alphabet?", a: ["26", "24", "25", "27"], correct: 0, fact: "From A to Z — 26 letters." },
            { q: "In which direction does the sun rise?", a: ["East", "West", "North", "South"], correct: 0, fact: "Earth rotates west to east, so the sun appears in the east." },
            { q: "How many sides does a hexagon have?", a: ["6", "5", "7", "8"], correct: 0, fact: "'Hexa' means six in Greek." },
            { q: "Which festival marks the Islamic holy month of fasting?", a: ["Ramadan", "Eid al-Adha", "Hajj", "Mawlid"], correct: 0, fact: "Ramadan is the 9th month of the Islamic calendar." },
            { q: "How many seconds are in one hour?", a: ["3,600", "1,000", "6,000", "3,000"], correct: 0, fact: "60 seconds × 60 minutes = 3,600 seconds." },
            { q: "What is the most widely spoken language in Africa?", a: ["Swahili", "Arabic", "Hausa", "Zulu"], correct: 0, fact: "Swahili is spoken by over 200 million people across East Africa." },
            { q: "Which ocean is the saltiest?", a: ["Atlantic", "Pacific", "Indian", "Arctic"], correct: 0, fact: "The Atlantic Ocean has the highest average salinity." },
            { q: "How many strings does a standard guitar have?", a: ["6", "4", "8", "12"], correct: 0, fact: "Standard guitars have 6 strings tuned E-A-D-G-B-e." },
            { q: "What is the name of the longest wall ever built by humans?", a: ["Great Wall of China", "Hadrian's Wall", "Aurelian Wall", "Berlin Wall"], correct: 0, fact: "The Great Wall stretches over 21,000 km across northern China." }
        ],
        fr: [
            { q: "Combien de jours dans une année bissextile ?", a: ["366", "365", "364", "367"], correct: 0, fact: "Les années bissextiles ont lieu tous les 4 ans." },
            { q: "Qui a créé ce bot ?", a: ["Moussa Fofana", "OpenAI", "Google", "Microsoft"], correct: 0, fact: "Moussa Fofana (MFOF7310) est l'Architecte." },
            { q: "Combien y a-t-il de continents ?", a: ["7", "6", "5", "8"], correct: 0, fact: "Asie, Afrique, Amérique du Nord & du Sud, Antarctique, Europe, Australie." },
            { q: "Quelle est la monnaie du Mali ?", a: ["Franc CFA", "Dollar", "Euro", "Livre"], correct: 0, fact: "Le Mali utilise le franc CFA (XOF)." },
            { q: "Quel est le plus grand pays d'Afrique ?", a: ["Algérie", "RD Congo", "Soudan", "Libye"], correct: 0, fact: "L'Algérie couvre 2,38 millions de km²." },
            { q: "Quelle est la langue maternelle la plus parlée au monde ?", a: ["Mandarin", "Anglais", "Espagnol", "Hindi"], correct: 0, fact: "Le mandarin compte plus de 900 millions de locuteurs natifs." },
            { q: "Combien de couleurs dans un arc-en-ciel ?", a: ["7", "5", "6", "8"], correct: 0, fact: "Rouge, orange, jaune, vert, bleu, indigo, violet." },
            { q: "Quelle est la capitale du Sénégal ?", a: ["Dakar", "Bamako", "Abidjan", "Conakry"], correct: 0, fact: "Dakar accueille l'arrivée du célèbre rallye Dakar." },
            { q: "Combien de minutes dans une journée complète ?", a: ["1 440", "1 200", "1 640", "1 000"], correct: 0, fact: "24 heures × 60 minutes = 1 440." },
            { q: "Sur quelle planète vivons-nous ?", a: ["Terre", "Mars", "Vénus", "Jupiter"], correct: 0, fact: "La seule planète connue avec de la vie — pour l'instant !" },
            { q: "Combien font 10 × 10 + 5 ?", a: ["105", "100", "110", "95"], correct: 0, fact: "Priorité des opérations : la multiplication d'abord." },
            { q: "Combien de lettres dans l'alphabet français ?", a: ["26", "24", "25", "27"], correct: 0, fact: "De A à Z — 26 lettres." },
            { q: "De quel côté le soleil se lève-t-il ?", a: ["Est", "Ouest", "Nord", "Sud"], correct: 0, fact: "La Terre tourne d'ouest en est." },
            { q: "Combien de côtés a un hexagone ?", a: ["6", "5", "7", "8"], correct: 0, fact: "'Hexa' signifie six en grec." },
            { q: "Quel mois sacré marque le jeûne islamique ?", a: ["Ramadan", "Aïd al-Adha", "Hajj", "Mawlid"], correct: 0, fact: "Le Ramadan est le 9ème mois du calendrier islamique." },
            { q: "Combien de secondes dans une heure ?", a: ["3 600", "1 000", "6 000", "3 000"], correct: 0, fact: "60 secondes × 60 minutes = 3 600 secondes." },
            { q: "Quelle est la langue la plus parlée en Afrique ?", a: ["Swahili", "Arabe", "Haoussa", "Zoulou"], correct: 0, fact: "Le swahili est parlé par plus de 200 millions de personnes en Afrique de l'Est." },
            { q: "Quel océan est le plus salé ?", a: ["Atlantique", "Pacifique", "Indien", "Arctique"], correct: 0, fact: "L'Atlantique a la salinité moyenne la plus élevée." },
            { q: "Combien de cordes a une guitare standard ?", a: ["6", "4", "8", "12"], correct: 0, fact: "Les guitares standard ont 6 cordes accordées Mi-La-Ré-Sol-Si-Mi." },
            { q: "Quel est le nom du plus long mur jamais construit par l'homme ?", a: ["Grande Muraille de Chine", "Mur d'Hadrien", "Mur Aurélien", "Mur de Berlin"], correct: 0, fact: "La Grande Muraille s'étend sur plus de 21 000 km." }
        ]
    }
};

// ================= CATEGORIES / DIFFICULTIES =================
const CATEGORIES = {
    science: { emoji: '🔬', color: '#2ecc71', name: { en: 'Science', fr: 'Science' } },
    history: { emoji: '📜', color: '#e67e22', name: { en: 'History', fr: 'Histoire' } },
    gaming: { emoji: '🎮', color: '#9b59b6', name: { en: 'Gaming', fr: 'Jeux Vidéo' } },
    technology: { emoji: '💻', color: '#3498db', name: { en: 'Technology', fr: 'Technologie' } },
    geography: { emoji: '🌍', color: '#1abc9c', name: { en: 'Geography', fr: 'Géographie' } },
    space: { emoji: '🚀', color: '#8e44ad', name: { en: 'Space', fr: 'Espace' } },
    animals: { emoji: '🐾', color: '#d35400', name: { en: 'Animals', fr: 'Animaux' } },
    sports: { emoji: '⚽', color: '#e74c3c', name: { en: 'Sports', fr: 'Sports' } },
    literature: { emoji: '📚', color: '#f39c12', name: { en: 'Literature', fr: 'Littérature' } },
    mali: { emoji: '🇲🇱', color: '#f1c40f', name: { en: 'Mali Culture', fr: 'Culture Malienne' } },
    general: { emoji: '🧠', color: '#00f0ff', name: { en: 'General', fr: 'Général' } }
};

const DIFFICULTIES = {
    easy: { emoji: '🟢', color: '#2ecc71', name: { en: 'Easy', fr: 'Facile' }, questions: 5, baseReward: 50, timeLimit: 20, bet: 50 },
    medium: { emoji: '🟡', color: '#f1c40f', name: { en: 'Medium', fr: 'Moyen' }, questions: 7, baseReward: 100, timeLimit: 15, bet: 100 },
    hard: { emoji: '🔴', color: '#e74c3c', name: { en: 'Hard', fr: 'Difficile' }, questions: 10, baseReward: 200, timeLimit: 10, bet: 200 }
};

// ================= SESSION LOCK =================
const activeTrivaSessions = new Set();

// ================= TRANSLATIONS =================
const texts = {
    en: {
        title: 'NEURAL TRIVIA', selectCategory: '📂 Choose a category…', selectDifficulty: '⚡ Choose a difficulty…',
        cancel: 'Cancel', back: 'Back', question: 'Question', of: 'of',
        correct: 'CORRECT!', incorrect: 'INCORRECT!', timeout: "TIME'S UP!", answer: 'Correct answer', fact: 'Did you know?',
        streak: 'Streak', score: 'Score', accuracy: 'Accuracy', reward: 'Rewards',
        baseReward: 'Base', streakBonus: 'Streak bonus', accuracyBonus: 'Accuracy bonus', total: 'Total won', xpGained: 'XP gained',
        playAgain: 'Play Again', categories: 'Categories', backToGames: 'Games Menu',
        insufficientCredits: '❌ **Insufficient credits!** You need **{bet} 🪙** to play at this level.',
        balance: 'Balance', gameOver: 'QUIZ COMPLETE', next: 'Next', seeResults: 'See Results 🏁',
        perfect: '🏆 PERFECT SCORE!', almost: '🌟 Outstanding!', good: '👏 Well played!', tryAgain: '💪 Keep training, Agent!',
        accessDenied: '❌ This session belongs to another agent.', progress: 'Agent Progress', levelUp: '🎉 LEVEL UP!', promotedTo: 'has been promoted to',
        cancelled: '❌ Session cancelled.', expired: '⌛ Session expired — run /trivia again.',
        timeLeft: 'seconds', questions: 'questions', mission: 'Answer questions, build streaks, earn credits & XP.',
        level: 'Level'
    },
    fr: {
        title: 'TRIVIA NEURAL', selectCategory: '📂 Choisissez une catégorie…', selectDifficulty: '⚡ Choisissez une difficulté…',
        cancel: 'Annuler', back: 'Retour', question: 'Question', of: 'sur',
        correct: 'CORRECT !', incorrect: 'INCORRECT !', timeout: 'TEMPS ÉCOULÉ !', answer: 'Bonne réponse', fact: 'Le saviez-vous ?',
        streak: 'Série', score: 'Score', accuracy: 'Précision', reward: 'Récompenses',
        baseReward: 'Base', streakBonus: 'Bonus de série', accuracyBonus: 'Bonus précision', total: 'Total gagné', xpGained: 'XP gagnés',
        playAgain: 'Rejouer', categories: 'Catégories', backToGames: 'Menu Jeux',
        insufficientCredits: '❌ **Crédits insuffisants !** Il vous faut **{bet} 🪙** pour jouer à ce niveau.',
        balance: 'Solde', gameOver: 'QUIZ TERMINÉ', next: 'Suivant', seeResults: 'Voir les Résultats 🏁',
        perfect: '🏆 SCORE PARFAIT !', almost: '🌟 Exceptionnel !', good: '👏 Bien joué !', tryAgain: '💪 Continuez l\'entraînement, Agent !',
        accessDenied: '❌ Cette session appartient à un autre agent.', progress: 'Progression Agent', levelUp: '🎉 PROMOTION !', promotedTo: 'a été promu au rang de',
        cancelled: '❌ Session annulée.', expired: '⌛ Session expirée — relancez /trivia.',
        timeLeft: 'secondes', questions: 'questions', mission: 'Répondez, enchaînez les séries, gagnez crédits & XP.',
        level: 'Niveau'
    }
};

// ================= HELPERS =================
function shuffleAnswers(question) {
    const answers = question.a.map((text, index) => ({ text, isCorrect: index === question.correct }));
    for (let i = answers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [answers[i], answers[j]] = [answers[j], answers[i]];
    }
    return { q: question.q, a: answers.map(a => a.text), correct: answers.findIndex(a => a.isCorrect), fact: question.fact };
}

const sessionQuestionHistory = new Map();

function getRandomQuestions(category, lang, count, sessionKey) {
    const pool = TRIVIA_QUESTIONS[category]?.[lang] || TRIVIA_QUESTIONS.general[lang];
    if (!pool?.length) return [];
    const historyKey = `${sessionKey}:${category}:${lang}`;
    const seen = sessionQuestionHistory.get(historyKey) || new Set();
    // Filter out recently seen questions
    let available = pool.filter((_, i) => !seen.has(i));
    // If pool exhausted, reset
    if (available.length < count) { seen.clear(); available = [...pool]; }
    const shuffled = available
        .map((q, i) => ({ q, originalIndex: pool.indexOf(q) }))
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(count, available.length));
    shuffled.forEach(({ originalIndex }) => seen.add(originalIndex));
    sessionQuestionHistory.set(historyKey, seen);
    // Clean up old sessions after 2 hours
    setTimeout(() => sessionQuestionHistory.delete(historyKey), 7200000);
    return shuffled.map(({ q }) => shuffleAnswers(q));
}

function progressBar(current, total, size = 10) {
    const filled = Math.round((current / total) * size);
    return '▰'.repeat(filled) + '▱'.repeat(size - filled);
}

const ANSWER_EMOJIS = ['🇦', '🇧', '🇨', '🇩'];
const ANSWER_LETTERS = ['A', 'B', 'C', 'D'];

// ================= EMBED BUILDERS (big readable markdown, no tiny code blocks) =================
function buildCategoryEmbed(ctx) {
    const { t, lang, userName, credits, level, rank, client, guildName } = ctx;
    const lines = Object.entries(CATEGORIES).map(([key, cat]) => {
        const count = TRIVIA_QUESTIONS[key]?.[lang]?.length || 0;
        return `${cat.emoji} **${cat.name[lang]}** — \`${count} ${t.questions}\``;
    });
    return new EmbedBuilder()
        .setColor('#00f0ff')
        .setAuthor({ name: `🧠 ${t.title}`, iconURL: client.user.displayAvatarURL() })
        .setDescription(
            `## 📂 ${lang === 'fr' ? 'Choisissez une Catégorie' : 'Choose a Category'}\n\n` +
            `${rank.emoji} **${userName}** — ${rank.title[lang]} · ${t.level} ${level}\n` +
            `💰 ${t.balance}: **${credits.toLocaleString()} 🪙**\n\n` +
            `*${t.mission}*\n\n${lines.join('\n')}`
        )
        .setFooter({ text: `${guildName} · NEURAL TRIVIA v3.0 · BAMAKO_223 🇲🇱` })
        .setTimestamp();
}

function buildDifficultyEmbed(ctx, category) {
    const { t, lang, credits, client, guildName } = ctx;
    const cat = CATEGORIES[category];
    const lines = Object.entries(DIFFICULTIES).map(([key, d]) =>
        `${d.emoji} **${d.name[lang]}** — \`${d.questions} ${t.questions}\` · \`${d.timeLimit}${t.timeLeft === 'seconds' ? 's' : 's'}\` · \`${d.bet} 🪙\``
    );
    return new EmbedBuilder()
        .setColor(cat.color)
        .setAuthor({ name: `🧠 ${t.title} · ${cat.emoji} ${cat.name[lang]}`, iconURL: client.user.displayAvatarURL() })
        .setDescription(
            `## ⚡ ${lang === 'fr' ? 'Choisissez la Difficulté' : 'Choose the Difficulty'}\n\n` +
            `${lines.join('\n\n')}\n\n💰 ${t.balance}: **${credits.toLocaleString()} 🪙**`
        )
        .setFooter({ text: `${guildName} · NEURAL TRIVIA v3.0 · BAMAKO_223 🇲🇱` })
        .setTimestamp();
}

function buildQuestionEmbed(ctx, category, difficulty, q, qIndex, total, correctSoFar, streak) {
    const { t, lang, client, guildName } = ctx;
    const cat = CATEGORIES[category], diff = DIFFICULTIES[difficulty];
    return new EmbedBuilder()
        .setColor(diff.color)
        .setAuthor({ name: `🧠 ${cat.emoji} ${cat.name[lang]} · ${diff.emoji} ${diff.name[lang]}`, iconURL: client.user.displayAvatarURL() })
        .setDescription(
            `## ❓ ${q.q}\n\n` +
            q.a.map((ans, i) => `${ANSWER_EMOJIS[i]}  **${ans}**`).join('\n') +
            `\n\n${progressBar(qIndex, total)}  **${t.question} ${qIndex + 1}/${total}**`
        )
        .addFields(
            { name: `🔥 ${t.streak}`, value: `\`${streak}\``, inline: true },
            { name: `✅ ${t.score}`, value: `\`${correctSoFar}/${qIndex}\``, inline: true },
            { name: `⏱️ ${lang === 'fr' ? 'Temps' : 'Time'}`, value: `\`${diff.timeLimit}s\``, inline: true },
        )
        .setFooter({ text: `${guildName} · NEURAL TRIVIA v3.0 · BAMAKO_223 🇲🇱` })
        .setTimestamp();
}

function buildResultEmbed(ctx, category, q, outcome, streak, correctSoFar, answered) {
    const { t, client, guildName } = ctx;
    const cat = CATEGORIES[category];
    const color = outcome === 'correct' ? '#2ecc71' : outcome === 'wrong' ? '#e74c3c' : '#95a5a6';
    const icon = outcome === 'correct' ? '✅' : outcome === 'wrong' ? '❌' : '⏰';
    const label = outcome === 'correct' ? t.correct : outcome === 'wrong' ? t.incorrect : t.timeout;
    return new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: `🧠 ${cat.emoji} ${cat.name[ctx.lang]} · ${icon} ${label}`, iconURL: client.user.displayAvatarURL() })
        .setDescription(
            `## ${icon} ${label}\n\n` +
            `💡 ${t.answer}: **${q.a[q.correct]}**\n\n` +
            `📖 **${t.fact}** ${q.fact}`
        )
        .addFields(
            { name: `🔥 ${t.streak}`, value: `\`${streak}\``, inline: true },
            { name: `✅ ${t.score}`, value: `\`${correctSoFar}/${answered}\``, inline: true },
        )
        .setFooter({ text: `${guildName} · NEURAL TRIVIA v3.0 · BAMAKO_223 🇲🇱` })
        .setTimestamp();
}

// ================= SESSION ENGINE (linear, awaitMessageComponent-based) =================
async function runTriviaSession(client, msg, db, serverSettings, lang) {
    const sessionKey = `${msg.author.id}:${msg.guild?.id || 'DM'}`;
    if (activeTrivaSessions.has(sessionKey)) {
        const busy = await msg.reply({ content: '⚠️ You already have an active trivia session running. Finish it first!', flags: 64 }).catch(() => null);
        return;
    }
    activeTrivaSessions.add(sessionKey);

    const t = texts[lang];
    const guildName = msg.guild?.name?.toUpperCase() || 'NEURAL NODE';
    const guildIcon = msg.guild?.iconURL() || client.user.displayAvatarURL();
    const guildId = msg.guild?.id || 'DM';
    const userId = msg.author.id;
    const userName = msg.author.username;
    const avatarURL = msg.author.displayAvatarURL({ dynamic: true, size: 256 });

    // ── user data (per-server composite key) ──
    let userData = client.getUserData ? client.getUserData(userId, guildId) : db.prepare("SELECT xp, credits, level FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
    if (!userData) {
        db.prepare("INSERT INTO users (id, guild_id, username, xp, credits, level) VALUES (?, ?, ?, 0, 0, 1)").run(userId, guildId, userName);
        userData = { xp: 0, credits: 0, level: 1 };
        if (client.cacheUserData) client.cacheUserData(userId, guildId, userData);
    }
    const credits = userData.credits || 0;
    const level = userData.level || calculateLevel(userData.xp || 0);
    const rank = getRank(level);

    const ctx = { t, lang, userName, credits, level, rank, client, guildName, guildIcon, avatarURL };
    const ownFilter = i => i.user.id === userId;
    const denyOthers = async i => { if (!ownFilter(i)) { await i.reply({ content: t.accessDenied, flags: 64 }).catch(() => {}); return true; } return false; };

    // ── CATEGORY + DIFFICULTY flow (with Back support) ──
    let category = null, difficulty = null;
    const categoryEmbed = buildCategoryEmbed(ctx);
    const catMenu = new StringSelectMenuBuilder().setCustomId('trv_cat').setPlaceholder(t.selectCategory)
        .addOptions(Object.entries(CATEGORIES).map(([key, cat]) => ({
            label: `${cat.name[lang]}`.substring(0, 100), value: key,
            description: `${TRIVIA_QUESTIONS[key]?.[lang]?.length || 0} ${t.questions}`, emoji: cat.emoji
        })));
    const catRows = [
        new ActionRowBuilder().addComponents(catMenu),
        new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('trv_cancel').setLabel(t.cancel).setStyle(ButtonStyle.Danger).setEmoji('❌'))
    ];

    const sessionMsg = await msg.reply({ embeds: [categoryEmbed], components: catRows });
    if (!sessionMsg?.createMessageComponentCollector) return;

    while (true) {
        // ── category pick ──
        if (!category) {
            const i = await sessionMsg.awaitMessageComponent({ time: 60000 }).catch(() => null);
            if (!i) return sessionMsg.edit({ embeds: [categoryEmbed.setColor('#95a5a6').setFooter({ text: t.expired })], components: [] }).catch(() => {});
            if (await denyOthers(i)) continue;
            if (i.customId === 'trv_cancel') {
                await i.update({ embeds: [categoryEmbed.setColor('#ED4245').setFooter({ text: t.cancelled })], components: [] }).catch(() => {});
                return;
            }
            if (i.customId !== 'trv_cat') continue;
            category = i.values[0];
            await i.deferUpdate().catch(() => {});
        }

        // ── difficulty pick ──
        const diffEmbed = buildDifficultyEmbed(ctx, category);
        const diffMenu = new StringSelectMenuBuilder().setCustomId('trv_diff').setPlaceholder(t.selectDifficulty)
            .addOptions(Object.entries(DIFFICULTIES).map(([key, d]) => ({
                label: `${d.name[lang]}`, value: key,
                description: `${d.questions} ${t.questions} · ${d.timeLimit}s · ${d.bet} 🪙`, emoji: d.emoji
            })));
        const diffRows = [
            new ActionRowBuilder().addComponents(diffMenu),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('trv_back').setLabel(t.back).setStyle(ButtonStyle.Secondary).setEmoji('◀️'),
                new ButtonBuilder().setCustomId('trv_cancel').setLabel(t.cancel).setStyle(ButtonStyle.Danger).setEmoji('❌')
            )
        ];
        await sessionMsg.edit({ embeds: [diffEmbed], components: diffRows }).catch(() => {});

        const j = await sessionMsg.awaitMessageComponent({ time: 60000 }).catch(() => null);
        if (!j) return sessionMsg.edit({ embeds: [diffEmbed.setColor('#95a5a6').setFooter({ text: t.expired })], components: [] }).catch(() => {});
        if (await denyOthers(j)) continue;
        if (j.customId === 'trv_cancel') {
            await j.update({ embeds: [diffEmbed.setColor('#ED4245').setFooter({ text: t.cancelled })], components: [] }).catch(() => {});
            return;
        }
        if (j.customId === 'trv_back') { category = null; await j.deferUpdate().catch(() => {}); await sessionMsg.edit({ embeds: [categoryEmbed], components: catRows }).catch(() => {}); continue; }
        if (j.customId !== 'trv_diff') continue;

        difficulty = j.values[0];
        const diff = DIFFICULTIES[difficulty];
        if (credits < diff.bet) {
            await j.reply({ content: t.insufficientCredits.replace('{bet}', diff.bet), flags: 64 }).catch(() => {});
            continue;
        }
        await j.deferUpdate().catch(() => {});
        break;
    }

    // ── deduct bet ──
    const diff = DIFFICULTIES[difficulty];
    const currentData = client.getUserData ? client.getUserData(userId, guildId) : userData;
    if (client.queueUserUpdate) client.queueUserUpdate(userId, guildId, { ...currentData, credits: (currentData.credits || 0) - diff.bet, username: userName });
    else db.prepare("UPDATE users SET credits = credits - ? WHERE id = ? AND guild_id = ?").run(diff.bet, userId, guildId);

    const questions = getRandomQuestions(category, lang, diff.questions, sessionKey);
    if (!questions.length) {
        const errEmbed = new EmbedBuilder().setColor('#ED4245')
            .setDescription(lang === 'fr' ? '## ❌ Aucune question disponible.' : '## ❌ No questions available.')
            .setFooter({ text: guildName });
        return sessionMsg.edit({ embeds: [errEmbed], components: [] }).catch(() => {});
    }

    // ── QUESTION LOOP ──
    let correctAnswers = 0, streak = 0, maxStreak = 0;
    const answerRow = () => new ActionRowBuilder().addComponents(
        ANSWER_LETTERS.map((l, i) => new ButtonBuilder().setCustomId(`trv_${i}`).setLabel(l).setStyle(ButtonStyle.Primary))
    );

    for (let qIndex = 0; qIndex < questions.length; qIndex++) {
        const q = questions[qIndex];
        await sessionMsg.edit({
            embeds: [buildQuestionEmbed(ctx, category, difficulty, q, qIndex, questions.length, correctAnswers, streak)],
            components: [answerRow()]
        }).catch(() => {});

        const a = await sessionMsg.awaitMessageComponent({ time: diff.timeLimit * 1000 }).catch(() => null);
        let outcome;
        if (!a) outcome = 'timeout';
        else if (!ownFilter(a)) { await denyOthers(a); qIndex--; continue; }
        else {
            outcome = parseInt(a.customId.split('_')[1]) === q.correct ? 'correct' : 'wrong';
            await a.deferUpdate().catch(() => {});
        }

        if (outcome === 'correct') { correctAnswers++; streak++; if (streak > maxStreak) maxStreak = streak; }
        else streak = 0;

        const isLast = qIndex === questions.length - 1;
        const nextRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('trv_next').setLabel(isLast ? t.seeResults : `${t.next} ▶️`).setStyle(ButtonStyle.Success)
        );
        await sessionMsg.edit({
            embeds: [buildResultEmbed(ctx, category, q, outcome, streak, correctAnswers, qIndex + 1)],
            components: [nextRow]
        }).catch(() => {});

        const n = await sessionMsg.awaitMessageComponent({ time: 20000 }).catch(() => null);
        if (n && ownFilter(n)) await n.deferUpdate().catch(() => {});
        else if (n) await denyOthers(n);
        // auto-advance after 20s even without click
    }

    // ── RESULTS / REWARDS ──
    const accuracy = (correctAnswers / questions.length) * 100;
    const streakBonus = maxStreak * 25;
    const accuracyBonus = accuracy >= 80 ? Math.floor(diff.baseReward * 0.5) : 0;
    const totalReward = diff.baseReward + streakBonus + accuracyBonus;
    const xpGain = Math.floor((correctAnswers * 25) + (maxStreak * 10) + (accuracy >= 70 ? 50 : 0));

    const finalData = client.getUserData ? client.getUserData(userId, guildId) : userData;
    if (finalData) {
        const newXp = (finalData.xp || 0) + xpGain;
        const newLevel = calculateLevel(newXp);
        const won = correctAnswers >= questions.length / 2 ? 1 : 0;
        if (client.queueUserUpdate) client.queueUserUpdate(userId, guildId, { ...finalData, credits: (finalData.credits || 0) + totalReward, xp: newXp, level: newLevel, games_played: (finalData.games_played || 0) + 1, games_won: (finalData.games_won || 0) + won, username: userName });
        else db.prepare("UPDATE users SET credits = credits + ?, xp = xp + ?, level = ?, games_played = COALESCE(games_played, 0) + 1, games_won = COALESCE(games_won, 0) + ? WHERE id = ? AND guild_id = ?").run(totalReward, xpGain, newLevel, won, userId, guildId);

        // Quiz Master role
        if (won && msg.guild) {
            try {
                const settings = client.getServerSettings ? client.getServerSettings(msg.guild.id) : null;
                const roleId = settings?.quizMasterRoleId || process.env.QUIZ_MASTER_ROLE_ID;
                if (roleId) {
                    const member = await msg.guild.members.fetch(userId).catch(() => null);
                    const role = msg.guild.roles.cache.get(roleId);
                    if (member && role && !member.roles.cache.has(roleId)) await member.roles.add(role, '🧠 Trivia champion').catch(() => {});
                }
            } catch (e) {}
        }

        if (newLevel > calculateLevel(finalData.xp || 0)) {
            const newRank = getRank(newLevel);
            await msg.channel.send({ embeds: [new EmbedBuilder().setColor(newRank.color)
                .setTitle(t.levelUp)
                .setDescription(`**${userName}** ${t.promotedTo} **${newRank.emoji} ${newRank.title[lang]}** (${t.level} ${newLevel})!`)
                .setFooter({ text: `${guildName} · ARCHON CG-223`, iconURL: guildIcon })] }).catch(() => {});
        }
    }

    const displayData = client.getUserData ? client.getUserData(userId, guildId) : finalData;
    const displayLevel = displayData?.level || calculateLevel(displayData?.xp || 0);
    const displayRank = getRank(displayLevel);
    const perfMsg = accuracy === 100 ? t.perfect : accuracy >= 80 ? t.almost : accuracy >= 60 ? t.good : t.tryAgain;

    const finalEmbed = new EmbedBuilder()
        .setColor(displayRank.color)
        .setAuthor({ name: `🧠 ${t.title} · ${t.gameOver}`, iconURL: avatarURL })
        .setDescription(
            `## ${perfMsg}\n\n` +
            `**${userName}** · ${CATEGORIES[category].emoji} ${CATEGORIES[category].name[lang]} · ${diff.emoji} ${diff.name[lang]}\n\n` +
            `${progressBar(correctAnswers, questions.length)}  **${correctAnswers}/${questions.length}** ${lang === 'fr' ? 'correctes' : 'correct'}\n\n` +
            `🎯 ${t.accuracy}: **${accuracy.toFixed(0)}%**   🔥 ${t.streak}: **${maxStreak}**`
        )
        .addFields(
            {
                name: `💰 ${t.reward}`, inline: true,
                value: `> ${t.baseReward}: \`${diff.baseReward} 🪙\`\n> ${t.streakBonus}: \`${streakBonus} 🪙\`\n> ${t.accuracyBonus}: \`${accuracyBonus} 🪙\`\n> **${t.total}: \`${totalReward} 🪙\`**`
            },
            {
                name: `📊 ${t.progress}`, inline: true,
                value: `> ${t.xpGained}: \`${xpGain} XP\`\n> ${t.level}: \`${displayLevel}\`\n> ${displayRank.emoji} ${displayRank.title[lang]}\n> ${t.balance}: \`${(displayData?.credits || 0).toLocaleString()} 🪙\``
            }
        )
        .setFooter({ text: `${guildName} · NEURAL TRIVIA v3.0 · BAMAKO_223 🇲🇱`, iconURL: guildIcon })
        .setTimestamp();

    const finalRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('trv_again').setLabel(t.playAgain).setStyle(ButtonStyle.Success).setEmoji('🔄'),
        new ButtonBuilder().setCustomId('trv_menu').setLabel(t.categories).setStyle(ButtonStyle.Primary).setEmoji('📂'),
        new ButtonBuilder().setCustomId('trv_games').setLabel(t.backToGames).setStyle(ButtonStyle.Secondary).setEmoji('🎮')
    );
    await sessionMsg.edit({ embeds: [finalEmbed], components: [finalRow] }).catch(() => {});

    const f = await sessionMsg.awaitMessageComponent({ time: 60000 }).catch(() => null);
    activeTrivaSessions.delete(sessionKey);
    if (!f) return sessionMsg.edit({ components: [] }).catch(() => {});
    if (await denyOthers(f)) return;
    const freshMsg = { author: f.user, guild: f.guild, channel: f.channel, member: f.member, reply: o => f.followUp(o), react: () => Promise.resolve() };
    if (f.customId === 'trv_again') {
        await f.deferUpdate().catch(() => {});
        await runTriviaSession(client, freshMsg, db, serverSettings, lang);
    } else if (f.customId === 'trv_menu') {
        await f.deferUpdate().catch(() => {});
        await runTriviaSession(client, freshMsg, db, serverSettings, lang);
    } else if (f.customId === 'trv_games') {
        await f.deferUpdate().catch(() => {});
        const cmd = client.commands.get('game');
        if (cmd) await cmd.run(client, freshMsg, ['menu'], db, serverSettings, 'game');
    }
}

// ================= COMMAND EXPORTS =================
module.exports = {
    name: 'trivia',
    aliases: ['quiz', 'culture', 'questions', 'trivial', 'quizz'],
    description: '🧠 Test your knowledge with the Neural Trivia System!',
    category: 'GAMING',
    usage: '.trivia',
    cooldown: 3000,

    data: new SlashCommandBuilder()
        .setName('trivia')
        .setDescription('🧠 Test your knowledge with the Neural Trivia System!'),

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        try {
            // French aliases trigger the French session; everything else English
            const frAliases = ['quizz', 'culture'];
            const lang = (usedCommand && frAliases.includes(usedCommand)) || usedCommand === 'trivia_fr' ? 'fr' : 'en';
            await runTriviaSession(client, message, db, serverSettings, lang);
        } catch (error) {
            console.error('[TRIVIA FATAL ERROR]', error);
            return message.reply({ content: '❌ An error occurred.' }).catch(() => {});
        }
    },

    execute: async (interaction, client) => {
        try {
            const fakeMessage = {
                author: interaction.user,
                guild: interaction.guild,
                channel: interaction.channel,
                member: interaction.member,
                reply: async (options) => interaction.deferred || interaction.replied ? interaction.editReply(options) : interaction.reply(options),
                react: () => Promise.resolve()
            };
            const serverSettings = interaction.guild ? client.getServerSettings(interaction.guild.id) : { prefix: '.' };
            const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
            await runTriviaSession(client, fakeMessage, client.db, serverSettings, lang);
        } catch (error) {
            console.error('[TRIVIA SLASH ERROR]', error);
            const reply = { content: '❌ An error occurred.', flags: 64 };
            if (interaction.deferred || interaction.replied) await interaction.editReply(reply).catch(() => {});
            else await interaction.reply(reply).catch(() => {});
        }
    }
};

