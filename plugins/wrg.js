const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

// ═══════════════════════════════════════════════════════
//  🎮 ARCHON WRG v3.0 — NEURAL GRID WORD COMBAT
//  5 tiers · Speed bonus · Streak multiplier · Hint system
// ═══════════════════════════════════════════════════════

// ── Level calculation ──
function calculateLevel(xp) { return Math.floor(0.1 * Math.sqrt(xp)) + 1; }

// ── Rank titles ──
const AGENT_RANKS = [
    { minLevel: 1,  maxLevel: 5,        title: { fr: "RECRUE NEURALE",    en: "NEURAL RECRUIT"    }, color: "#2ecc71", emoji: "🌱" },
    { minLevel: 6,  maxLevel: 15,       title: { fr: "AGENT DE TERRAIN",  en: "FIELD AGENT"       }, color: "#3498db", emoji: "🔹" },
    { minLevel: 16, maxLevel: 30,       title: { fr: "SPÉCIALISTE CYBER", en: "CYBER SPECIALIST"  }, color: "#9b59b6", emoji: "💠" },
    { minLevel: 31, maxLevel: 50,       title: { fr: "COMMANDANT BKO",    en: "BKO COMMANDER"     }, color: "#e67e22", emoji: "⚜️" },
    { minLevel: 51, maxLevel: Infinity, title: { fr: "ARCHITECTE SYSTÈME","en": "SYSTEM ARCHITECT" }, color: "#e74c3c", emoji: "👑" }
];
function getRank(level) { return AGENT_RANKS.find(r => level >= r.minLevel && level <= r.maxLevel) || AGENT_RANKS[AGENT_RANKS.length-1]; }
function progressBar(pct, len=15) { const f=Math.round((pct/100)*len); return '█'.repeat(Math.max(0,f))+'░'.repeat(Math.max(0,len-f)); }

// ── Word sanitization ──
function sanitize(word) { return word.toUpperCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z]/g,''); }
function shuffle(word) {
    let arr = word.split('');
    for (let i=arr.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
    // Ensure not same as original
    if (arr.join('')===word && word.length>1) { [arr[0],arr[1]]=[arr[1],arr[0]]; }
    return arr.join('');
}

// ── Hint: reveal one letter ──
function buildHint(word) {
    const idx = Math.floor(Math.random() * word.length);
    return word.split('').map((c,i) => i===idx ? c : '_').join(' ');
}

// ═══════════════════════════════════════════════════════
//  WORD DATABASE — 5 TIERS
// ═══════════════════════════════════════════════════════
const TIERS = {
    rookie: {
        label: { en: '⚪ ROOKIE',     fr: '⚪ RECRUE'    },
        color: '#95a5a6', ansiColor: '\u001b[0;37m', emoji: '⚪',
        xpBase: 15,  xpBonus: 0,   creditBase: 3,  creditBonus: 0,
        timeLimit: 20000,
        speedWindow: 5000,
        words: {
            en: ['CAT','DOG','SUN','MOON','STAR','FISH','BIRD','TREE','CAR','BOOK','BALL','CAKE','LAKE','RAIN','FIRE'],
            fr: ['CHAT','CHIEN','SOLEIL','LUNE','ETOILE','POISSON','OISEAU','ARBRE','VOITURE','LIVRE','BALLE','GATEAU','LAC','PLUIE','FEU']
        },
        hint: { en: '✨ Simple everyday word (3-5 letters)', fr: '✨ Mot simple du quotidien (3-5 lettres)' }
    },
    agent: {
        label: { en: '🔵 AGENT',      fr: '🔵 AGENT'     },
        color: '#3498db', ansiColor: '\u001b[1;34m', emoji: '🔵',
        xpBase: 25,  xpBonus: 20,  creditBase: 5,  creditBonus: 10,
        timeLimit: 30000,
        speedWindow: 6000,
        words: {
            en: ['GAMING','LAPTOP','KEYBOARD','MONITOR','ROCKET','PLANET','GARDEN','CAMERA','JUNGLE','CASTLE','BRIDGE','MARKET'],
            fr: ['CLAVIER','ECRAN','FUSEE','PLANETE','JARDIN','CAMERA','JUNGLE','CHATEAU','PONT','MARCHE','ORDINATEUR','TABLETTE']
        },
        hint: { en: '💡 Everyday object or place', fr: '💡 Objet ou lieu du quotidien' }
    },
    elite: {
        label: { en: '🟠 ELITE',      fr: '🟠 ELITE'     },
        color: '#e67e22', ansiColor: '\u001b[1;33m', emoji: '🟠',
        xpBase: 40,  xpBonus: 50,  creditBase: 8,  creditBonus: 25,
        timeLimit: 40000,
        speedWindow: 7000,
        words: {
            en: ['ALGORITHM','DATABASE','FIREWALL','PROCESSOR','SOFTWARE','NETWORK','PROTOCOL','TERMINAL','COMPILER','DEBUGGER'],
            fr: ['ALGORITHME','PAREFEU','PROCESSEUR','LOGICIEL','RESEAU','PROTOCOLE','TERMINAL','COMPILATEUR','DEBOGUEUR','CHIFFREMENT']
        },
        hint: { en: '🧠 Technical / computer science term', fr: '🧠 Terme technique / informatique' }
    },
    commander: {
        label: { en: '🔴 COMMANDER', fr: '🔴 COMMANDANT' },
        color: '#e74c3c', ansiColor: '\u001b[1;31m', emoji: '🔴',
        xpBase: 60,  xpBonus: 100, creditBase: 12, creditBonus: 50,
        timeLimit: 50000,
        speedWindow: 8000,
        words: {
            en: ['TECHNOLOGY','SPECTACULAR','MAGNIFICENT','KNOWLEDGE','EXTRAORDINARY','REVOLUTIONARY','INTELLIGENCE','INFRASTRUCTURE','CYBERSECURITY'],
            fr: ['TECHNOLOGIE','SPECTACULAIRE','MAGNIFIQUE','CONNAISSANCE','EXTRAORDINAIRE','REVOLUTIONNAIRE','INTELLIGENCE','INFRASTRUCTURE','CYBERSECURITE']
        },
        hint: { en: '🏆 Advanced vocabulary — think big!', fr: '🏆 Vocabulaire avancé — pensez grand !' }
    },
    architect: {
        label: { en: '👑 ARCHITECT',  fr: '👑 ARCHITECTE' },
        color: '#f1c40f', ansiColor: '\u001b[1;33m', emoji: '👑',
        xpBase: 100, xpBonus: 200, creditBase: 20, creditBonus: 100,
        timeLimit: 60000,
        speedWindow: 10000,
        words: {
            en: ['DECENTRALIZATION','CRYPTOGRAPHY','MICROPROCESSOR','VIRTUALIZATION','AUTHENTICATION','TELECOMMUNICATIONS','SUPERINTELLIGENCE','ELECTROMAGNETIC'],
            fr: ['DECENTRALISATION','CRYPTOGRAPHIE','MICROPROCESSEUR','VIRTUALISATION','AUTHENTIFICATION','TELECOMMUNICATION','SUPERINTELLIGENCE','ELECTROMAGNETIQUE']
        },
        hint: { en: '💀 ARCHITECT level — ultra rare vocabulary', fr: '💀 Niveau ARCHITECTE — vocabulaire ultra rare' }
    }
};

// ═══════════════════════════════════════════════════════
//  WORD CATEGORIES — 8 THEMES
// ═══════════════════════════════════════════════════════
const CATEGORIES = {
    tech: {
        label: { en: '💻 Technology', fr: '💻 Technologie' },
        emoji: '💻',
        words: {
            en: {
                rookie:    ['CODE','DATA','FILE','BYTE','DISK','PORT','CHIP','WIRE','GRID','BOOT'],
                agent:     ['GAMING','LAPTOP','MONITOR','ROUTER','SERVER','PYTHON','CURSOR','BINARY','PIXELS','REBOOT'],
                elite:     ['ALGORITHM','DATABASE','FIREWALL','PROCESSOR','SOFTWARE','NETWORK','PROTOCOL','TERMINAL','COMPILER','DEBUGGER'],
                commander: ['TECHNOLOGY','CYBERSECURITY','INFRASTRUCTURE','CRYPTOCURRENCY','VIRTUALIZATION','AUTHENTICATION'],
                architect: ['DECENTRALIZATION','CRYPTOGRAPHY','MICROPROCESSOR','TELECOMMUNICATION','SUPERINTELLIGENCE','ELECTROMAGNETIC']
            },
            fr: {
                rookie:    ['CODE','DONNEE','FICHIER','OCTET','DISQUE','PORT','PUCE','CABLE','GRILLE','DEMARRAGE'],
                agent:     ['CLAVIER','ECRAN','ROUTEUR','SERVEUR','PYTHON','CURSEUR','BINAIRE','PIXELS','REDEMARRAGE','TABLETTE'],
                elite:     ['ALGORITHME','PAREFEU','PROCESSEUR','LOGICIEL','RESEAU','PROTOCOLE','TERMINAL','COMPILATEUR','DEBOGUEUR','CHIFFREMENT'],
                commander: ['TECHNOLOGIE','CYBERSECURITE','INFRASTRUCTURE','CRYPTOMONNAIE','VIRTUALISATION','AUTHENTIFICATION'],
                architect: ['DECENTRALISATION','CRYPTOGRAPHIE','MICROPROCESSEUR','TELECOMMUNICATION','SUPERINTELLIGENCE','ELECTROMAGNETIQUE']
            }
        }
    },
    science: {
        label: { en: '🔬 Science', fr: '🔬 Science' },
        emoji: '🔬',
        words: {
            en: {
                rookie:    ['ATOM','CELL','GENE','MOON','STAR','LAVA','ACID','BONE','ROCK','CORE'],
                agent:     ['OXYGEN','CARBON','PLASMA','NEURON','PHOTON','PROTON','GALAXY','FOSSIL','MAGNET','ENZYME'],
                elite:     ['MOLECULE','ELECTRON','HYDROGEN','NITROGEN','GENETICS','ORGANISM','CHEMICAL','UNIVERSE','ASTEROID','BACTERIA'],
                commander: ['CHROMOSOME','ATMOSPHERE','RELATIVITY','PHOTOSYNTHESIS','GRAVITATIONAL','THERMODYNAMICS'],
                architect: ['ELECTROMAGNETIC','BIOLUMINESCENCE','PHOTOSYNTHESIS','NEUROTRANSMITTER','DEOXYRIBONUCLEIC','THERMODYNAMICS']
            },
            fr: {
                rookie:    ['ATOME','CELLULE','GENE','LUNE','ETOILE','LAVE','ACIDE','OS','ROCHE','NOYAU'],
                agent:     ['OXYGENE','CARBONE','PLASMA','NEURONE','PHOTON','PROTON','GALAXIE','FOSSILE','AIMANT','ENZYME'],
                elite:     ['MOLECULE','ELECTRON','HYDROGENE','AZOTE','GENETIQUE','ORGANISME','CHIMIQUE','UNIVERS','ASTEROIDE','BACTERIE'],
                commander: ['CHROMOSOME','ATMOSPHERE','RELATIVITE','PHOTOSYNTHESE','GRAVITATIONNEL','THERMODYNAMIQUE'],
                architect: ['ELECTROMAGNETIQUE','BIOLUMINESCENCE','PHOTOSYNTHESE','NEUROTRANSMETTEUR','DESOXYRIBONUCLEIQUE','THERMODYNAMIQUE']
            }
        }
    },
    history: {
        label: { en: '🏛️ History', fr: '🏛️ Histoire' },
        emoji: '🏛️',
        words: {
            en: {
                rookie:    ['WAR','KING','ROME','GOLD','SHIP','SWORD','CROWN','TRIBE','SIEGE','VAULT'],
                agent:     ['EMPIRE','BATTLE','CASTLE','PHARAOH','VIKING','KNIGHT','SAMURAI','DYNASTY','PYRAMID','REPUBLIC'],
                elite:     ['REVOLUTION','NAPOLEON','ALEXANDER','OTTOMAN','MONGOLIA','CRUSADE','DEMOCRACY','RENAISSANCE','COLONIALISM','FEUDALISM'],
                commander: ['CIVILIZATION','INDEPENDENCE','IMPERIALISM','CONSTITUTION','MESOPOTAMIA','ENLIGHTENMENT'],
                architect: ['MESOPOTAMIA','REVOLUTIONARY','INDEPENDENCE','CONSTITUTION','MEDITERRANEAN','INDUSTRIALIZATION']
            },
            fr: {
                rookie:    ['GUERRE','ROI','ROME','OR','NAVIRE','EPEE','COURONNE','TRIBU','SIEGE','VOUTE'],
                agent:     ['EMPIRE','BATAILLE','CHATEAU','PHARAON','VIKING','CHEVALIER','SAMOURAI','DYNASTIE','PYRAMIDE','REPUBLIQUE'],
                elite:     ['REVOLUTION','NAPOLEON','ALEXANDRE','OTTOMAN','MONGOLIE','CROISADE','DEMOCRATIE','RENAISSANCE','COLONIALISME','FEODALISME'],
                commander: ['CIVILISATION','INDEPENDANCE','IMPERIALISME','CONSTITUTION','MESOPOTAMIE','LUMIÈRES'],
                architect: ['MESOPOTAMIE','REVOLUTIONNAIRE','INDEPENDANCE','CONSTITUTIONNEL','MEDITERRANEE','INDUSTRIALISATION']
            }
        }
    },
    animals: {
        label: { en: '🦁 Animals', fr: '🦁 Animaux' },
        emoji: '🦁',
        words: {
            en: {
                rookie:    ['CAT','DOG','COW','PIG','HEN','OWL','BEE','ANT','FOX','EEL'],
                agent:     ['TIGER','SHARK','EAGLE','SNAKE','WHALE','ZEBRA','PANDA','KOALA','LEMUR','HYENA'],
                elite:     ['ELEPHANT','GORILLA','CHEETAH','DOLPHIN','PENGUIN','PANTHER','LEOPARD','PLATYPUS','MONGOOSE','FLAMINGO'],
                commander: ['RHINOCEROS','CROCODILE','HIPPOPOTAMUS','ORANGUTAN','CHIMPANZEE','BARRACUDA'],
                architect: ['TYRANNOSAURUS','HIPPOPOTAMUS','ARCHAEOPTERYX','BRACHIOSAURUS','PTERODACTYLUS','PACHYCEPHALOSAURUS']
            },
            fr: {
                rookie:    ['CHAT','CHIEN','VACHE','COCHON','POULE','HIBOU','ABEILLE','FOURMI','RENARD','ANGUILLE'],
                agent:     ['TIGRE','REQUIN','AIGLE','SERPENT','BALEINE','ZEBRE','PANDA','KOALA','LEMURIEN','HYENE'],
                elite:     ['ELEPHANT','GORILLE','GUEPARD','DAUPHIN','PINGOUIN','PANTHERE','LEOPARD','ORNITHORYNQUE','MANGOUSTE','FLAMANT'],
                commander: ['RHINOCEROS','CROCODILE','HIPPOPOTAME','ORANG-OUTAN','CHIMPANZE','BARRACUDA'],
                architect: ['TYRANNOSAURE','HIPPOPOTAME','ARCHEOPTERYX','BRACHIOSAURE','PTERODACTYLE','PACHYCEPHALOSAURE']
            }
        }
    },
    music: {
        label: { en: '🎵 Music', fr: '🎵 Musique' },
        emoji: '🎵',
        words: {
            en: {
                rookie:    ['BEAT','BASS','DRUM','JAZZ','SOUL','FUNK','ROCK','FOLK','HYMN','TUNE'],
                agent:     ['GUITAR','VIOLIN','TRUMPET','PIANIST','CHORUS','BALLAD','REGGAE','LYRICS','TREBLE','OCTAVE'],
                elite:     ['SYMPHONY','ORCHESTRA','HARMONICA','SAXOPHONE','CONDUCTOR','ACAPELLA','VIRTUOSO','CLASSICAL','AFROBEAT','FREESTYLE'],
                commander: ['COMPOSITION','INSTRUMENT','MASTERPIECE','ARRANGEMENT','IMPROVISATION','PHILHARMONIC'],
                architect: ['PHILHARMONIC','IMPROVISATION','COUNTERPOINT','ORCHESTRATION','CONSERVATORY','MICROTONALITY']
            },
            fr: {
                rookie:    ['RYTHME','BASSE','TAMBOUR','JAZZ','SOUL','FUNK','ROCK','FOLK','HYMNE','MELODIE'],
                agent:     ['GUITARE','VIOLON','TROMPETTE','PIANISTE','CHOEUR','BALLADE','REGGAE','PAROLES','TREBLE','OCTAVE'],
                elite:     ['SYMPHONIE','ORCHESTRE','HARMONICA','SAXOPHONE','CHEF','ACAPELLA','VIRTUOSE','CLASSIQUE','AFROBEAT','FREESTYLE'],
                commander: ['COMPOSITION','INSTRUMENT','CHEFDOEUVRE','ARRANGEMENT','IMPROVISATION','PHILHARMONIQUE'],
                architect: ['PHILHARMONIQUE','IMPROVISATION','CONTREPOINT','ORCHESTRATION','CONSERVATOIRE','MICROTONALITE']
            }
        }
    },
    sports: {
        label: { en: '⚽ Sports', fr: '⚽ Sports' },
        emoji: '⚽',
        words: {
            en: {
                rookie:    ['GOAL','BALL','RACE','JUMP','SWIM','KICK','PASS','DUNK','SHOT','FOUL'],
                agent:     ['SOCCER','TENNIS','BOXING','SPRINT','TACKLE','DRIBBLE','PENALTY','REFEREE','STADIUM','TROPHY'],
                elite:     ['BASKETBALL','VOLLEYBALL','ATHLETICS','FREESTYLE','MARATHON','CHAMPION','SEMIFINAL','GOALKEEPER','WRESTLING','BADMINTON'],
                commander: ['CHAMPIONSHIP','TOURNAMENT','QUARTERBACK','WEIGHTLIFTING','COMPETITION','DECATHLON'],
                architect: ['CHAMPIONSHIP','DECATHLON','PARALYMPICS','SPORTSMANSHIP','INFRASTRUCTURE','PROFESSIONALISM']
            },
            fr: {
                rookie:    ['BUT','BALLE','COURSE','SAUT','NAGE','COUP','PASSE','DUNK','TIR','FAUTE'],
                agent:     ['FOOTBALL','TENNIS','BOXE','SPRINT','TACLE','DRIBBLE','PENALTY','ARBITRE','STADE','TROPHEE'],
                elite:     ['BASKETBALL','VOLLEYBALL','ATHLETISME','FREESTYLE','MARATHON','CHAMPION','SEMIFINALE','GARDIEN','LUTTE','BADMINTON'],
                commander: ['CHAMPIONNAT','TOURNOI','QUARTERBACK','HALTÉROPHILIE','COMPETITION','DECATHLON'],
                architect: ['CHAMPIONNAT','DECATHLON','PARALYMPIQUES','ESPRITDUSPORT','INFRASTRUCTURE','PROFESSIONNALISME']
            }
        }
    },
    food: {
        label: { en: '🍕 Food', fr: '🍕 Cuisine' },
        emoji: '🍕',
        words: {
            en: {
                rookie:    ['RICE','CAKE','SOUP','MEAT','FISH','MILK','SALT','CORN','BEAN','PEAR'],
                agent:     ['PIZZA','PASTA','BURGER','SUSHI','TACOS','MANGO','LEMON','BUTTER','PEPPER','GARLIC'],
                elite:     ['CHOCOLATE','CROISSANT','BARBECUE','AVOCADO','PINEAPPLE','CINNAMON','BROCCOLI','PARMESAN','TORTILLA','COUSCOUS'],
                commander: ['CAPPUCCINO','PROSCIUTTO','GUACAMOLE','RATATOUILLE','QUESADILLA','BRUSCHETTA'],
                architect: ['CHATEAUBRIAND','PROFITEROLE','BOULANGERIE','GASTRONOMIQUE','CONFISERIE','CHARCUTERIE']
            },
            fr: {
                rookie:    ['RIZ','GATEAU','SOUPE','VIANDE','POISSON','LAIT','SEL','MAIS','HARICOT','POIRE'],
                agent:     ['PIZZA','PATES','BURGER','SUSHI','TACOS','MANGUE','CITRON','BEURRE','POIVRE','AIL'],
                elite:     ['CHOCOLAT','CROISSANT','BARBECUE','AVOCAT','ANANAS','CANNELLE','BROCOLI','PARMESAN','TORTILLA','COUSCOUS'],
                commander: ['CAPPUCCINO','PROSCIUTTO','GUACAMOLE','RATATOUILLE','QUESADILLA','BRUSCHETTA'],
                architect: ['CHATEAUBRIAND','PROFITEROLE','BOULANGERIE','GASTRONOMIQUE','CONFISERIE','CHARCUTERIE']
            }
        }
    },
    movies: {
        label: { en: '🎬 Movies & TV', fr: '🎬 Films & TV' },
        emoji: '🎬',
        words: {
            en: {
                rookie:    ['FILM','CAST','PLOT','HERO','ROLE','SCENE','DRAMA','ACTOR','SCORE','DUEL'],
                agent:     ['CINEMA','SCRIPT','COMEDY','HORROR','ACTION','SEQUEL','STUDIO','CAMERA','TRAILER','VILLAIN'],
                elite:     ['DIRECTOR','PRODUCER','ANIMATED','THRILLER','MUSICAL','PREMIERE','BLOCKBUSTER','CHARACTER','FRANCHISE','SUPERHERO'],
                commander: ['CINEMATOGRAPHY','DOCUMENTARY','SCREENWRITER','PRODUCTION','PROTAGONIST','CLIFFHANGER'],
                architect: ['CINEMATOGRAPHY','MASTERPIECE','SCREENWRITING','POSTPRODUCTION','CHOREOGRAPHY','VISUALIZATION']
            },
            fr: {
                rookie:    ['FILM','ROLE','SCENE','DRAME','ACTEUR','HEROS','INTRIGUE','BUDGET','DUEL','STUDIO'],
                agent:     ['CINEMA','SCRIPT','COMEDIE','HORREUR','ACTION','SUITE','STUDIO','CAMERA','BANDE-ANNONCE','VILLAIN'],
                elite:     ['REALISATEUR','PRODUCTEUR','ANIME','THRILLER','MUSICAL','PREMIERE','BLOCKBUSTER','PERSONNAGE','FRANCHISE','SUPERHEROS'],
                commander: ['CINEMATOGRAPHIE','DOCUMENTAIRE','SCENARISTE','PRODUCTION','PROTAGONISTE','CLIFFHANGER'],
                architect: ['CINEMATOGRAPHIE','CHEFDOEUVRE','SCENARISATION','POSTPRODUCTION','CHOREGRAPHIE','VISUALISATION']
            }
        }
    },
    geography: {
        label: { en: '🌍 Geography', fr: '🌍 Géographie' },
        emoji: '🌍',
        words: {
            en: {
                rookie:    ['MALI','ROME','NILE','ALPS','CUBA','PERU','CHAD','IRAN','IRAQ','LAOS'],
                agent:     ['FRANCE','BRAZIL','CANADA','SAHARA','AMAZON','ARCTIC','LONDON','MEXICO','MOSCOW','BAMAKO'],
                elite:     ['ATLANTIC','HIMALAYA','SINGAPORE','CARIBBEAN','INDONESIA','MEDITERRANEAN','MADAGASCAR','AUSTRALIA','ARGENTINA','PAKISTAN'],
                commander: ['MOZAMBIQUE','AFGHANISTAN','PHILIPPINES','SWITZERLAND','MEDITERRANEAN','MESOPOTAMIA'],
                architect: ['MEDITERRANEAN','LIECHTENSTEIN','TURKMENISTAN','CZECHOSLOVAKIA','AZERBAIJAN','NEWFOUNDLAND']
            },
            fr: {
                rookie:    ['MALI','ROME','NIL','ALPES','CUBA','PEROU','TCHAD','IRAN','IRAK','LAOS'],
                agent:     ['FRANCE','BRESIL','CANADA','SAHARA','AMAZONE','ARCTIQUE','LONDRES','MEXIQUE','MOSCOU','BAMAKO'],
                elite:     ['ATLANTIQUE','HIMALAYA','SINGAPOUR','CARAIBES','INDONESIE','MEDITERRANEE','MADAGASCAR','AUSTRALIE','ARGENTINE','PAKISTAN'],
                commander: ['MOZAMBIQUE','AFGHANISTAN','PHILIPPINES','SUISSE','MEDITERRANEE','MESOPOTAMIE'],
                architect: ['MEDITERRANEE','LIECHTENSTEIN','TURKMENISTAN','TCHECOSLOVAQUIE','AZERBAIDJAN','TERRENEUVE']
            }
        }
    }
};

// ── Default category mapping per tier if no category selected ──
const DEFAULT_CATEGORY = 'tech';

// ── Streak storage (per guild+user, in memory) ──
const streaks = new Map();
function getStreak(userId, guildId) { return streaks.get(`${userId}:${guildId}`) || 0; }
function incStreak(userId, guildId) { const k=`${userId}:${guildId}`; streaks.set(k, (streaks.get(k)||0)+1); return streaks.get(k); }
function resetStreak(userId, guildId) { streaks.delete(`${userId}:${guildId}`); }

// ── XP calculation with speed + streak bonus ──
function calcRewards(tier, wordLen, solveTimeMs, streakCount) {
    const base = tier.xpBase + (wordLen * 10) + tier.xpBonus;
    const credits = tier.creditBase + (wordLen * 2) + tier.creditBonus;

    let speedMult = 1;
    let speedLabel = '';
    if (solveTimeMs <= tier.speedWindow) {
        speedMult = 2;
        speedLabel = '⚡ SPEED BONUS x2!';
    } else if (solveTimeMs <= tier.speedWindow * 2) {
        speedMult = 1.5;
        speedLabel = '🔥 QUICK x1.5!';
    }

    let streakMult = 1;
    let streakLabel = '';
    if (streakCount >= 5) { streakMult = 2; streakLabel = '🌟 STREAK x2 (5+)!'; }
    else if (streakCount >= 3) { streakMult = 1.5; streakLabel = '🔥 STREAK x1.5 (3+)!'; }

    const finalXP = Math.round(base * speedMult * streakMult);
    const finalCredits = Math.round(credits * speedMult * streakMult);
    return { xp: finalXP, credits: finalCredits, speedLabel, streakLabel, speedMult, streakMult };
}

// ═══════════════════════════════════════════════════════
//  CORE GAME RUNNER
// ═══════════════════════════════════════════════════════
async function runGame(client, message, args, db, lang) {
    try {
        // ── Tier selection ──
        const tierMap = {
            rookie:    ['rookie','recrue','easy','facile','r'],
            agent:     ['agent','medium','moyen','a'],
            elite:     ['elite','hard','difficile','e'],
            commander: ['commander','commandant','expert','c'],
            architect: ['architect','architecte','legend','legendary','god','x']
        };
        const categoryMap = {
            tech:      ['tech','technology','technologie','computer','t'],
            science:   ['science','sci','s'],
            history:   ['history','histoire','hist','h'],
            animals:   ['animals','animaux','animal','a'],
            music:     ['music','musique','m'],
            sports:    ['sports','sport','sp'],
            food:      ['food','cuisine','nourriture','f'],
            movies:    ['movies','films','movie','cinema','mv'],
            geography: ['geography','geographie','geo','g']
        };

        let tierKey = 'rookie';
        let categoryKey = DEFAULT_CATEGORY;

        // Parse args — first arg = tier, second = category (or vice versa)
        for (const arg of args) {
            const a = arg.toLowerCase();
            for (const [k, aliases] of Object.entries(tierMap)) {
                if (aliases.includes(a)) { tierKey = k; break; }
            }
            for (const [k, aliases] of Object.entries(categoryMap)) {
                if (aliases.includes(a)) { categoryKey = k; break; }
            }
        }

        const tier = TIERS[tierKey];
        const cat = CATEGORIES[categoryKey] || CATEGORIES.tech;
        const tierWords = cat.words[lang]?.[tierKey] || cat.words.en[tierKey] || cat.words.en.rookie;
        const rawWord = tierWords[Math.floor(Math.random() * tierWords.length)];
        const targetWord = sanitize(rawWord);
        let scrambled = shuffle(targetWord);
        while (scrambled === targetWord && targetWord.length > 2) scrambled = shuffle(targetWord);

        const guildId = message.guild?.id || 'DM';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        const streakCount = getStreak(message.author.id, guildId);

        // ── User stats ──
        let userStats = db.prepare("SELECT xp, credits, level, games_played, games_won FROM users WHERE id = ? AND guild_id = ?").get(message.author.id, guildId);
        if (!userStats) {
            db.prepare("INSERT OR IGNORE INTO users (id, guild_id, username, xp, level, credits) VALUES (?, ?, ?, 0, 1, 0)").run(message.author.id, guildId, message.author.username);
            userStats = { xp: 0, credits: 0, level: 1, games_played: 0, games_won: 0 };
        }
        const currentLevel = userStats.level || calculateLevel(userStats.xp || 0);
        const currentRank = getRank(currentLevel);
        const xpNeeded = Math.pow(currentLevel / 0.1, 2) - Math.pow((currentLevel-1) / 0.1, 2);
        const xpProgress = (userStats.xp || 0) - Math.pow((currentLevel-1) / 0.1, 2);
        const pct = xpNeeded > 0 ? Math.min(100, Math.max(0, (xpProgress/xpNeeded)*100)) : 100;

        // ── Estimate rewards ──
        const estRewards = calcRewards(tier, targetWord.length, 9999999, streakCount);

        // ── Start embed ──
        const startEmbed = new EmbedBuilder()
            .setColor(tier.color)
            .setAuthor({ name: `🎮 ARCHON WORD COMBAT — ${tier.label[lang]} · ${cat.emoji} ${cat.label[lang]}`, iconURL: client.user.displayAvatarURL() })
            .setDescription(
                `\`\`\`ansi\n` +
                `${tier.ansiColor}▸ TIER     \u001b[0m${tier.emoji} ${tierKey.toUpperCase()}\n` +
                `${tier.ansiColor}▸ CATEGORY \u001b[0m${cat.emoji} ${cat.label[lang]}\n` +
                `${tier.ansiColor}▸ LETTERS  \u001b[0m\u001b[1;37m${targetWord.length}\u001b[0m\n` +
                `${tier.ansiColor}▸ TIME     \u001b[0m\u001b[1;33m${tier.timeLimit/1000}s\u001b[0m\n` +
                `${tier.ansiColor}▸ SCRAMBLE \u001b[0m\u001b[1;36m${scrambled}\u001b[0m\n` +
                `\`\`\`` +
                `\n*${tier.hint[lang]}*`
            )
            .addFields(
                { name: '💰 Base Rewards', value: `\`+${estRewards.xp} XP\` · \`+${estRewards.credits} 🪙\``, inline: true },
                { name: '⚡ Speed Bonus', value: `Solve in **${tier.speedWindow/1000}s** → **2x XP**`, inline: true },
                { name: streakCount > 0 ? `🔥 Streak: ${streakCount}` : '🔥 Streak', value: streakCount >= 3 ? `**${streakCount} wins!** Multiplier active!` : `Win more for multiplier!`, inline: true },
                { name: `${currentRank.emoji} ${lang==='fr'?'Rang':'Rank'}`, value: `${currentRank.title[lang]} · Lv.${currentLevel}`, inline: true },
                { name: '📊 Progress', value: `\`${progressBar(pct, 12)}\` ${pct.toFixed(0)}%`, inline: true },
                { name: '💡 How to play', value: lang==='fr'?'Tapez votre réponse dans le chat !':'Type your answer in chat!', inline: true }
            )
            .setFooter({ text: `${guildName} · NEURAL WRG v3.0 · BAMAKO_223 🇲🇱` })
            .setTimestamp();

        await message.channel.send({ embeds: [startEmbed] });

        const gameStart = Date.now();
        let winnerDeclared = false;
        let hintSent = false;

        // ── Hint timer (half time) ──
        const hintTimer = setTimeout(async () => {
            if (!winnerDeclared) {
                hintSent = true;
                const hintStr = buildHint(targetWord);
                const hintEmbed = new EmbedBuilder()
                    .setColor('#00f0ff')
                    .setDescription(
                        `\`\`\`ansi\n\u001b[1;36m▸ HINT UNLOCKED\u001b[0m\n` +
                        `\u001b[1;37m${hintStr}\u001b[0m\n\`\`\`` +
                        `\n*${tier.emoji} Still scrambled: \`${scrambled}\`*`
                    )
                    .setFooter({ text: `${tier.timeLimit/2000}s elapsed · Hint revealed` });
                await message.channel.send({ embeds: [hintEmbed] }).catch(() => {});
            }
        }, tier.timeLimit / 2);

        // ── Collector ──
        const collector = message.channel.createMessageCollector({
            filter: m => !m.author.bot,
            time: tier.timeLimit
        });

        collector.on('collect', async (m) => {
            if (winnerDeclared) return;
            const guess = sanitize(m.content);
            if (guess !== targetWord) return;

            winnerDeclared = true;
            clearTimeout(hintTimer);
            collector.stop('winner');

            const solveTime = Date.now() - gameStart;
            const newStreak = incStreak(m.author.id, guildId);
            const rewards = calcRewards(tier, targetWord.length, solveTime, newStreak);

            // ── Update DB ──
            const winnerData = db.prepare("SELECT xp, credits, level, games_played, games_won FROM users WHERE id = ? AND guild_id = ?").get(m.author.id, guildId);
            const oldXP = winnerData?.xp || 0;
            const newXP = oldXP + rewards.xp;
            const newLevel = calculateLevel(newXP);
            const oldLevel = winnerData?.level || calculateLevel(oldXP);

            if (client.queueUserUpdate) {
                client.queueUserUpdate(m.author.id, guildId, {
                    ...winnerData, xp: newXP, level: newLevel,
                    credits: (winnerData?.credits||0) + rewards.credits,
                    games_played: (winnerData?.games_played||0)+1,
                    games_won: (winnerData?.games_won||0)+1,
                    username: m.author.username
                });
            } else {
                db.prepare(`UPDATE users SET xp=xp+?, credits=credits+?, level=?, games_played=COALESCE(games_played,0)+1, games_won=COALESCE(games_won,0)+1 WHERE id=? AND guild_id=?`)
                    .run(rewards.xp, rewards.credits, newLevel, m.author.id, guildId);
            }

            const finalRank = getRank(newLevel);
            const newXpNeeded = Math.pow(newLevel/0.1,2) - Math.pow((newLevel-1)/0.1,2);
            const newXpProgress = newXP - Math.pow((newLevel-1)/0.1,2);
            const newPct = newXpNeeded > 0 ? Math.min(100, Math.max(0,(newXpProgress/newXpNeeded)*100)) : 100;
            const solveSeconds = (solveTime/1000).toFixed(1);

            // ── Win embed ──
            let bonusLines = '';
            if (rewards.speedLabel) bonusLines += `\u001b[1;33m⚡ ${rewards.speedLabel}\u001b[0m\n`;
            if (rewards.streakLabel) bonusLines += `\u001b[1;35m${rewards.streakLabel}\u001b[0m\n`;

            const winEmbed = new EmbedBuilder()
                .setColor('#00ff88')
                .setAuthor({ name: `🏆 NEURAL GRID — CODE CRACKED!`, iconURL: m.author.displayAvatarURL() })
                .setDescription(
                `\`\`\`ansi\n` +
                `\u001b[1;32m\u25b8 CORRECT  \u001b[0m\u001b[1;37m${targetWord}\u001b[0m\n` +
                `\u001b[1;32m\u25b8 TIME     \u001b[0m${solveSeconds}s\n` +
                `\u001b[1;32m\u25b8 STREAK   \u001b[0m${newStreak} wins\n` +
                (bonusLines ? bonusLines : '') +
                `\u001b[1;36m\u25b8 XP       \u001b[0m\u001b[1;32m+${rewards.xp}\u001b[0m\n` +
                `\u001b[1;33m\u25b8 CREDITS  \u001b[0m+${rewards.credits}\n` +
                `\u001b[0m\`\`\``
            )
                .addFields(
                    { name: '📊 Progress', value: `\`${progressBar(newPct,15)}\` ${newPct.toFixed(1)}%\n└ ${Math.ceil(newXpNeeded-newXpProgress).toLocaleString()} XP to next level`, inline: false },
                    { name: `${finalRank.emoji} Rank`, value: `${finalRank.title[lang]} · Lv.${newLevel}`, inline: true },
                    { name: '💎 Credits', value: `\`${((winnerData?.credits||0)+rewards.credits).toLocaleString()} 🪙\``, inline: true },
                    { name: '🎮 Tier', value: `${tier.emoji} ${tierKey.toUpperCase()}`, inline: true }
                )
                .setFooter({ text: `${guildName} · NEURAL WRG v3.0 · BAMAKO_223 🇲🇱` })
                .setTimestamp();

            await message.channel.send({ embeds: [winEmbed] });

            // ── Level up ──
            if (newLevel > oldLevel) {
                const lvlEmbed = new EmbedBuilder()
                    .setColor(finalRank.color)
                    .setDescription(
                        `\`\`\`ansi\n` +
                        `\u001b[1;33m▸ LEVEL UP  \u001b[0m🎉\n` +
                        `\u001b[1;33m▸ AGENT     \u001b[0m${m.author.username.substring(0,20)}\n` +
                        `\u001b[1;33m▸ NEW LEVEL \u001b[0m\u001b[1;37mLv.${newLevel}\u001b[0m\n` +
                        `\u001b[1;33m▸ NEW RANK  \u001b[0m${finalRank.emoji} ${finalRank.title[lang]}\n` +
                        `\`\`\``
                    )
                    .setFooter({ text: `ARCHON CG-223 · BAMAKO_223 🇲🇱` });
                await message.channel.send({ embeds: [lvlEmbed] });
            }

            // ── Duelist role ──
            if (message.guild) {
                try {
                    const settings = client.getServerSettings?.(message.guild.id);
                    const roleId = settings?.duelistRoleId || process.env.DUELIST_ROLE_ID;
                    if (roleId) {
                        const member = await message.guild.members.fetch(m.author.id).catch(()=>null);
                        if (member) {
                            const role = message.guild.roles.cache.get(roleId);
                            if (role && !member.roles.cache.has(roleId)) await member.roles.add(role,'⚔️ WRG champion').catch(()=>{});
                        }
                    }
                } catch(e) {}
            }
        });

        collector.on('end', (_, reason) => {
            clearTimeout(hintTimer);
            if (!winnerDeclared && reason !== 'winner') {
                resetStreak(message.author.id, guildId);
                const failEmbed = new EmbedBuilder()
                    .setColor('#e74c3c')
                    .setDescription(
                        `\`\`\`ansi\n` +
                        `\u001b[1;31m▸ TIME UP   \u001b[0m⏰\n` +
                        `\u001b[1;31m▸ WORD WAS  \u001b[0m\u001b[1;37m${targetWord}\u001b[0m\n` +
                        `\u001b[1;31m▸ SCRAMBLED \u001b[0m${scrambled}\n` +
                        `\u001b[0;37m▸ TIP       \u001b[0mTry .wrg rookie to warm up\n` +
                        `\`\`\``
                    )
                    .setFooter({ text: `${guildName} · NEURAL WRG v3.0 · BAMAKO_223 🇲🇱` });
                message.channel.send({ embeds: [failEmbed] }).catch(()=>{});
            }
        });

        console.log(`[WRG v3] ${message.author.tag} | Tier: ${tierKey} | Cat: ${categoryKey} | Word: ${targetWord} | Streak: ${streakCount}`);

    } catch(err) {
        console.error('[WRG v3] Fatal:', err.message);
        message.reply({ embeds: [new EmbedBuilder().setColor('#ED4245').setTitle('❌ GAME ERROR').setDescription('An error occurred. Please try again.').setFooter({ text: 'ARCHON CG-223' })] }).catch(()=>{});
    }
}

// ═══════════════════════════════════════════════════════
//  MODULE EXPORT
// ═══════════════════════════════════════════════════════
module.exports = {
    name: 'wrg',
    aliases: ['wordguess','guess','scramble','devine','mot','word','wrd'],
    description: '🎮 Neural Grid Word Combat — 5 tiers, speed bonus, streak multiplier!',
    category: 'GAMING',
    usage: '.wrg [rookie|agent|elite|commander|architect]',
    cooldown: 3000,
    examples: ['.wrg','.wrg rookie','.wrg elite','.wrg architect'],

    data: new SlashCommandBuilder()
        .setName('wrg')
        .setDescription('🎮 Neural Grid Word Combat — 5 tiers, 9 categories, speed bonus!')
        .addStringOption(opt => opt
            .setName('tier')
            .setDescription('Combat tier / Niveau de combat')
            .setRequired(false)
            .addChoices(
                { name: '⚪ Rookie  — Easy words, low stakes',         value: 'rookie'     },
                { name: '🔵 Agent  — Everyday objects & places',       value: 'agent'      },
                { name: '🟠 Elite  — Technical & cyber terms',         value: 'elite'      },
                { name: '🔴 Commander — Advanced vocabulary',          value: 'commander'  },
                { name: '👑 Architect — LEGENDARY difficulty',         value: 'architect'  }
            ))
        .addStringOption(opt => opt
            .setName('category')
            .setDescription('Word category / Catégorie de mots')
            .setRequired(false)
            .addChoices(
                { name: '💻 Technology — Computers & code',            value: 'tech'       },
                { name: '🔬 Science — Elements, planets, biology',     value: 'science'    },
                { name: '🏛️ History — Events, empires, figures',       value: 'history'    },
                { name: '🦁 Animals — Species & habitats',             value: 'animals'    },
                { name: '🎵 Music — Artists, songs, albums',           value: 'music'      },
                { name: '⚽ Sports — Teams & tournaments',             value: 'sports'     },
                { name: '🍕 Food & Cuisine — Dishes & ingredients',    value: 'food'       },
                { name: '🎬 Movies & TV — Films & characters',         value: 'movies'     },
                { name: '🌍 Geography — Countries & capitals',         value: 'geography'  }
            )),

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
        await runGame(client, message, args, db, lang);
    },

    execute: async (interaction, client) => {
        const tier = interaction.options.getString('tier') || 'rookie';
        const category = interaction.options.getString('category') || 'tech';
        await interaction.deferReply();
        const fakeMessage = {
            author: interaction.user,
            guild: interaction.guild,
            channel: interaction.channel,
            reply: async (opts) => interaction.editReply(opts),
            react: () => Promise.resolve()
        };
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        await runGame(client, fakeMessage, [tier, category], client.db, lang);
    }
};
