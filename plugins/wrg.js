'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// /wrg — word battle: unscramble the word before the time runs out. Anyone in the channel can answer.
//   One card per game, edited in place: the scrambled word and a countdown, the hint at half time, then the result
//   (the real rewards paid, inside the games' daily cap) with a Play again button (wrg:again:<tier>:<category>).
//   Streak: wins in a row, kept in the database; it ends when a game you started ends without your win.
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const progress = require('../lib/games/progress');
const { card } = require('../lib/games/v2');
const { icon } = require('../lib/ui/icons');
const i18n = require('../lib/i18n');

const T = (lang, k, v) => i18n.t('wrg.' + k, lang, v || {});
const COLOR = { live: 0x378ADD, won: 0x1D9E75, lost: 0xE74C3C };

// ── Words ─────────────────────────────────────────────────────────────────
function sanitize(word) { return String(word).toUpperCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z]/g, ''); }
function shuffleList(arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
}
function shuffle(word) {
    const arr = word.split('');
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    if (arr.join('') === word && word.length > 1) [arr[0], arr[1]] = [arr[1], arr[0]];
    return arr.join('');
}
// one letter shown, the first one (a random one could be the last letter of a 3-letter word: no help)
const hintOf = (word) => word.split('').map((c, i) => (i === 0 ? c : '_')).join(' ');

// ── Word lists: 5 tiers (rewards, time) and 9 categories (words in English and French) ──
const TIERS = {
    rookie: {
        label: { en: '⚪ ROOKIE',     fr: '⚪ RECRUE'    },
        color: '#95a5a6', emoji: '⚪',
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
        color: '#3498db', emoji: '🔵',
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
        color: '#e67e22', emoji: '🟠',
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
        color: '#e74c3c', emoji: '🔴',
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
        color: '#f1c40f', emoji: '👑',
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
const TIER_KEYS = Object.keys(TIERS);
const TIER_ALIASES = {
    rookie: ['rookie', 'recrue', 'easy', 'facile', 'r'],
    agent: ['agent', 'medium', 'moyen'],
    elite: ['elite', 'hard', 'difficile', 'e'],
    commander: ['commander', 'commandant', 'expert', 'c'],
    architect: ['architect', 'architecte', 'legend', 'legendary', 'god', 'x'],
};
const CATEGORY_ALIASES = {
    tech: ['tech', 'technology', 'technologie', 'computer', 't'],
    science: ['science', 'sci', 's'],
    history: ['history', 'histoire', 'hist', 'h'],
    animals: ['animals', 'animaux', 'animal'],
    music: ['music', 'musique', 'm'],
    sports: ['sports', 'sport', 'sp'],
    food: ['food', 'cuisine', 'nourriture', 'f'],
    movies: ['movies', 'films', 'movie', 'cinema', 'mv'],
    geography: ['geography', 'geographie', 'geo', 'g'],
};
const findKey = (map, word) => Object.keys(map).find((k) => map[k].includes(String(word || '').toLowerCase())) || null;

// ── Rewards: speed and streak multipliers ────────────────────────────────
function calcRewards(tier, wordLen, solveTimeMs, streakCount) {
    const base = tier.xpBase + (wordLen * 10) + tier.xpBonus;
    const credits = tier.creditBase + (wordLen * 2) + tier.creditBonus;
    const speedMult = solveTimeMs <= tier.speedWindow ? 2 : solveTimeMs <= tier.speedWindow * 2 ? 1.5 : 1;
    const streakMult = streakCount >= 5 ? 2 : streakCount >= 3 ? 1.5 : 1;
    return { xp: Math.round(base * speedMult * streakMult), credits: Math.round(credits * speedMult * streakMult), speedMult, streakMult };
}

// ── Streaks (database) ───────────────────────────────────────────────────
let _ready = false;
function streakTable(db) {
    if (_ready) return;
    db.prepare('CREATE TABLE IF NOT EXISTS wrg_streaks (user_id TEXT NOT NULL, guild_id TEXT NOT NULL, streak INTEGER DEFAULT 0, PRIMARY KEY (user_id, guild_id))').run();
    _ready = true;
}
function getStreak(db, uid, gid) { try { streakTable(db); return db.prepare('SELECT streak FROM wrg_streaks WHERE user_id = ? AND guild_id = ?').get(uid, gid)?.streak || 0; } catch { return 0; } }
function setStreak(db, uid, gid, n) {
    try { streakTable(db); db.prepare('INSERT INTO wrg_streaks (user_id, guild_id, streak) VALUES (?, ?, ?) ON CONFLICT(user_id, guild_id) DO UPDATE SET streak = excluded.streak').run(uid, gid, n); } catch { /* the game goes on */ }
}

// ── The card ─────────────────────────────────────────────────────────────
const fmt = (n, lang) => Number(n || 0).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US');
const xpAt = (level) => Math.pow((level - 1) / 0.1, 2);
function levelLine(lang, xp, level) {
    const need = xpAt(level + 1) - xpAt(level);
    const pct = need > 0 ? Math.max(0, Math.min(100, ((xp - xpAt(level)) / need) * 100)) : 100;
    const f = Math.round(pct / 10);
    return T(lang, 'level', { n: level, bar: `\`${'▰'.repeat(f)}${'▱'.repeat(10 - f)}\``, pct: Math.round(pct) });
}

function render(g, lang) {
    const where = g.channel;
    const head = `-# ${T(lang, `tier_${g.tierKey}`)} · ${T(lang, `cat_${g.catKey}`)}`;
    const again = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`wrg:again:${g.tierKey}:${g.catKey}`)
        .setStyle(ButtonStyle.Secondary).setLabel(T(lang, 'btnAgain')).setEmoji(icon('refresh', where)));

    if (g.phase === 'live') {
        const est = calcRewards(g.tier, g.word.length, Infinity, g.starterStreak);
        if (!progress.levelingOn(g.channel?.client, g.channel?.guild?.id)) est.xp = 0;   // leveling off: credits only
        return card(COLOR.live, [
            { text: `${head} · ${T(lang, 'startedBy', { user: `<@${g.starterId}>` })}\n## ${icon('puzzle', where)} ${T(lang, 'title')}` },
            { text: `# \`${g.scrambled.split('').join(' ')}\`` },
            { text: [
                g.hint ? `${icon('info', where)} ${T(lang, 'hint')} · \`${hintOf(g.word)}\`` : null,
                `${icon('clock', where)} ${T(lang, 'ends', { when: `<t:${Math.floor(g.endsAt / 1000)}:R>`, n: g.word.length })}`,
            ].filter(Boolean).join('\n') },
            { rule: true },
            { text: `${icon('coin', where)} ${T(lang, est.xp ? 'stake' : 'stakeCredits', { xp: fmt(est.xp, lang), credits: fmt(est.credits, lang), secs: g.tier.speedWindow / 1000 })}\n-# ${T(lang, 'howTo')}` },
        ]);
    }

    if (g.phase === 'won') {
        const r = g.result;
        const lines = [`${icon('bolt', where)} ${T(lang, 'time', { secs: (r.ms / 1000).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 1 }) })}${r.speedMult > 1 ? ` · ${T(lang, 'speed', { x: r.speedMult })}` : ''}`];
        if (r.streak >= 2) lines.push(`${icon('flame', where)} ${T(lang, 'streak', { n: r.streak })}${r.streakMult > 1 ? ` · ×${r.streakMult}` : ''}`);
        const paid = r.paid.capped && !r.paid.xp && !r.paid.credits
            ? T(lang, 'capped')
            : `**${T(lang, r.paid.xp ? 'paid' : 'paidCredits', { xp: fmt(r.paid.xp, lang), credits: fmt(r.paid.credits, lang) })}**${r.paid.capped ? ` · ${T(lang, 'cappedPart')}` : ''}`;
        const after = [`${icon('coin', where)} ${paid}`];
        if (r.levelUp) after.push(`${icon('ch_levelup', where)} ${T(lang, 'levelUp', { n: r.level })}`);
        after.push(`-# ${levelLine(lang, r.xp, r.level)}`);
        return card(COLOR.won, [
            { text: `${head}\n## ${icon('trophy', where)} ${T(lang, 'found', { user: `<@${r.winnerId}>`, word: `\`${g.word}\`` })}` },
            { text: lines.join('\n') },
            { rule: true },
            { text: after.join('\n') },
            { row: again },
        ]);
    }

    return card(COLOR.lost, [
        { text: `${head}\n## ${icon('clock', where)} ${T(lang, 'timeUp')}` },
        { text: T(lang, 'wordWas', { word: g.word, scrambled: g.scrambled }) },
        { row: again },
    ]);
}

// ── A game ───────────────────────────────────────────────────────────────
const activeGames = new Map();   // channel → game

// Words come out of a shuffled bag per server, category, tier and language: every word once before any comes back,
// and the first of a new round is never the last of the previous one (a plain random pick gave the same word 3 times in a row)
const bags = new Map();   // key → { left: [...], last }
function nextWord(key, list) {
    let b = bags.get(key);
    if (!b || !b.left.length) {
        const left = shuffleList([...list]);
        if (b?.last && left.length > 1 && left[left.length - 1] === b.last) left.unshift(left.pop());
        b = { left, last: b?.last || null };
        bags.set(key, b);
    }
    b.last = b.left.pop();
    return b.last;
}

// send(payload) posts the card and returns the message (a channel message, or the slash command's reply)
async function startGame(client, { channel, guild, user, lang, tierKey, catKey, send }) {
    const db = client.db;
    if (activeGames.has(channel.id)) return { busy: true };
    const tier = TIERS[tierKey] || TIERS.rookie;
    const cat = CATEGORIES[catKey] || CATEGORIES[DEFAULT_CATEGORY];
    const wordLang = lang === 'fr' ? 'fr' : 'en';
    const list = cat.words[wordLang]?.[tierKey] || cat.words.en[tierKey] || cat.words.en.rookie;
    const word = sanitize(nextWord(`${guild?.id || channel.id}:${catKey}:${tierKey}:${wordLang}`, list));
    const gid = guild?.id || 'DM';
    const g = {
        channel, tier, tierKey: TIERS[tierKey] ? tierKey : 'rookie', catKey: CATEGORIES[catKey] ? catKey : DEFAULT_CATEGORY,
        word, scrambled: shuffle(word), starterId: user.id, starterStreak: getStreak(db, user.id, gid),
        startedAt: Date.now(), endsAt: Date.now() + tier.timeLimit, phase: 'live', hint: false,
    };
    activeGames.set(channel.id, g);
    let msg;
    try { msg = await send(render(g, lang)); } catch (e) { activeGames.delete(channel.id); throw e; }
    const edit = (payload) => msg?.edit?.(payload).catch(() => {});

    const hintTimer = setTimeout(() => { if (g.phase === 'live') { g.hint = true; edit(render(g, lang)); } }, tier.timeLimit / 2);
    const collector = channel.createMessageCollector({ filter: (m) => !m.author.bot && sanitize(m.content) === word, time: tier.timeLimit, max: 1 });

    collector.on('collect', async (m) => {
        g.phase = 'won';
        clearTimeout(hintTimer);
        const ms = Date.now() - g.startedAt;
        const streak = getStreak(db, m.author.id, gid) + 1;
        setStreak(db, m.author.id, gid, streak);
        if (m.author.id !== g.starterId) setStreak(db, g.starterId, gid, 0);   // the starter's own game, won by someone else
        const rw = calcRewards(tier, word.length, ms, streak);
        const paid = progress.award(client, db, { userId: m.author.id, guildId: gid, username: m.author.username, credits: rw.credits, xp: rw.xp, played: 1, won: 1 });
        progress.recordRun(db, { game: 'wrg', userId: m.author.id, guildId: gid, username: m.author.username, points: paid.credits + paid.xp, won: true, streak, correct: 1, tier: g.tierKey, tierOrder: TIER_KEYS });
        const after = client.getUserData?.(m.author.id, gid) || {};
        const level = paid.newLevel || after.level || progress.levelFromXp(after.xp);
        if (paid.leveledUp && guild) {
            const member = await guild.members.fetch(m.author.id).catch(() => null);
            if (member) require('../lib/reward-roles').syncLevelRoles(member, level, db).catch(() => {});
        }
        g.result = { winnerId: m.author.id, ms, streak, speedMult: rw.speedMult, streakMult: rw.streakMult, paid, level, levelUp: !!paid.leveledUp, xp: Number(after.xp || 0) };
        activeGames.delete(channel.id);
        await edit(render(g, lang));
    });

    collector.on('end', async (got) => {
        clearTimeout(hintTimer);
        if (got.size) return;
        g.phase = 'lost';
        activeGames.delete(channel.id);
        setStreak(db, g.starterId, gid, 0);
        progress.award(client, db, { userId: g.starterId, guildId: gid, username: user.username, played: 1, won: 0 });
        progress.recordRun(db, { game: 'wrg', userId: g.starterId, guildId: gid, username: user.username, points: 0, won: false, streak: 0, correct: 0, tier: g.tierKey, tierOrder: TIER_KEYS });
        await edit(render(g, lang));
    });

    console.log(`[WRG] ${user.username} | ${g.tierKey} | ${g.catKey} | ${word}`);
    return { ok: true };
}

const langOf = (client, src) => {
    const l = require('../lib/pick-lang').pickLang(client, src.guildId || src.guild?.id, src.user ? src : null, src.user?.id || src.author?.id) || 'en';
    return ['en', 'fr', 'zh', 'ar'].includes(l) ? l : 'en';
};

// Play again (anyone)
async function handleComponent(ix, client) {
    const [, act, tierKey, catKey] = ix.customId.split(':');
    if (act !== 'again') return;
    const lang = langOf(client, ix);
    if (activeGames.has(ix.channelId)) return ix.reply({ content: `${icon('clock', ix)} ${T(lang, 'busy')}`, flags: MessageFlags.Ephemeral });
    await ix.deferUpdate();
    const r = await startGame(client, { channel: ix.channel, guild: ix.guild, user: ix.user, lang, tierKey, catKey, send: (p) => ix.channel.send(p) });
    if (r.busy) return ix.followUp({ content: `${icon('clock', ix)} ${T(lang, 'busy')}`, flags: MessageFlags.Ephemeral }).catch(() => {});
}

module.exports = {
    name: 'wrg',
    aliases: ['wordguess', 'guess', 'scramble', 'devine', 'mot', 'word', 'wrd'],
    description: '🎮 Word battle: unscramble the word before time runs out',
    category: 'GAMING',
    usage: '.wrg [rookie|agent|elite|commander|architect] [category]',
    cooldown: 3000,
    examples: ['.wrg', '.wrg rookie', '.wrg elite science', '.wrg architect'],
    handleComponent,
    _calcRewards: calcRewards,   // for the tests

    data: new SlashCommandBuilder()
        .setName('wrg')
        .setDescription('🎮 Word battle: 5 tiers, 9 categories, speed bonus!')
        .addStringOption((opt) => opt.setName('tier').setDescription('Difficulty').setRequired(false)
            .addChoices(
                { name: 'Rookie — easy words', value: 'rookie' },
                { name: 'Agent — everyday words', value: 'agent' },
                { name: 'Elite — technical words', value: 'elite' },
                { name: 'Commander — advanced words', value: 'commander' },
                { name: 'Architect — the hardest', value: 'architect' },
            ))
        .addStringOption((opt) => opt.setName('category').setDescription('Word category').setRequired(false)
            .addChoices(
                { name: 'Technology', value: 'tech' }, { name: 'Science', value: 'science' }, { name: 'History', value: 'history' },
                { name: 'Animals', value: 'animals' }, { name: 'Music', value: 'music' }, { name: 'Sports', value: 'sports' },
                { name: 'Food', value: 'food' }, { name: 'Movies and TV', value: 'movies' }, { name: 'Geography', value: 'geography' },
            )),

    run: async (client, message, args, _db, _ss, _used, lang) => {
        lang = ['en', 'fr', 'zh', 'ar'].includes(lang) ? lang : langOf(client, message);
        let tierKey = 'rookie', catKey = DEFAULT_CATEGORY;
        for (const a of args) { tierKey = findKey(TIER_ALIASES, a) || tierKey; catKey = findKey(CATEGORY_ALIASES, a) || catKey; }
        try {
            const r = await startGame(client, { channel: message.channel, guild: message.guild, user: message.author, lang, tierKey, catKey, send: (p) => message.channel.send(p) });
            if (r.busy) {
                const note = await message.channel.send(`${icon('clock', message)} ${T(lang, 'busy')}`).catch(() => null);
                if (note) setTimeout(() => note.delete().catch(() => {}), 5000);
            }
        } catch (e) { console.error('[WRG]', e.message); }
    },

    execute: async (interaction, client) => {
        const lang = langOf(client, interaction);
        const tierKey = interaction.options.getString('tier') || 'rookie';
        const catKey = interaction.options.getString('category') || DEFAULT_CATEGORY;
        if (activeGames.has(interaction.channelId)) return interaction.reply({ content: `${icon('clock', interaction)} ${T(lang, 'busy')}`, flags: MessageFlags.Ephemeral });
        // the game card is the command's own reply: no "thinking…" left behind
        await startGame(client, { channel: interaction.channel, guild: interaction.guild, user: interaction.user, lang, tierKey, catKey,
            send: async (p) => { await interaction.reply(p); return interaction.fetchReply(); } });
    },
};
