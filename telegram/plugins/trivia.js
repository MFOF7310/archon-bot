// ═══════════════════════════════════════════
//  TG COMMAND: Trivia Game v3 — ARCHON Edition
//  100+ questions, categories, difficulty, leaderboard
// ═══════════════════════════════════════════

const fs = require('fs');
const SCORES_PATH = '/tmp/archon_trivia_scores.json';

function loadScores() { try { return JSON.parse(fs.readFileSync(SCORES_PATH, 'utf8')); } catch { return {}; } }
function saveScores(d) { fs.writeFileSync(SCORES_PATH, JSON.stringify(d, null, 2)); }

function escapeHTML(t) { return !t || typeof t !== 'string' ? '' : t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

const QUESTIONS = {
    mali: [
        { q: "What is the capital of Mali?", a: ["Bamako", "Timbuktu", "Segou", "Mopti"], c: 0 },
        { q: "Who created Archon CG-223?", a: ["Moussa Fofana", "Elon Musk", "Mark Zuckerberg", "Tim Cook"], c: 0 },
        { q: "What river flows through Bamako?", a: ["Congo", "Nile", "Niger", "Senegal"], c: 2 },
        { q: "What is the currency of Mali?", a: ["Naira", "CFA Franc", "Dalasi", "Cedis"], c: 1 },
        { q: "Mali was part of which colonial empire?", a: ["British", "Portuguese", "French", "Spanish"], c: 2 },
        { q: "What is the largest city in Mali?", a: ["Timbuktu", "Segou", "Mopti", "Bamako"], c: 3 },
        { q: "What is the official language of Mali?", a: ["Arabic", "Bambara", "French", "Hausa"], c: 2 },
        { q: "Timbuktu was famous as a center of what?", a: ["Trade and learning", "Military power", "Agriculture", "Fishing"], c: 0 },
        { q: "What is the largest desert in Mali?", a: ["Kalahari", "Namib", "Sahara", "Arabian"], c: 2 },
        { q: "The Dogon people of Mali are famous for their?", a: ["Music", "Astronomy knowledge", "Fishing", "Metalwork"], c: 1 },
    ],
    africa: [
        { q: "Which African country has the largest population?", a: ["Egypt", "Nigeria", "Ethiopia", "South Africa"], c: 1 },
        { q: "What is the tallest mountain in Africa?", a: ["Mount Kenya", "Mount Kilimanjaro", "Atlas Mountains", "Drakensberg"], c: 1 },
        { q: "Which is the largest country in Africa by area?", a: ["Sudan", "Algeria", "DRC", "Libya"], c: 1 },
        { q: "What is the longest river in Africa?", a: ["Congo", "Niger", "Nile", "Zambezi"], c: 2 },
        { q: "Which African city is known as the 'City of Gold'?", a: ["Lagos", "Nairobi", "Johannesburg", "Cairo"], c: 2 },
        { q: "What is the smallest country in Africa?", a: ["Gambia", "Seychelles", "Comoros", "Sao Tome"], c: 1 },
        { q: "Which African country was never colonized?", a: ["Ghana", "Ethiopia", "Kenya", "Nigeria"], c: 1 },
        { q: "What is the currency of Nigeria?", a: ["Cedi", "Naira", "Shilling", "Rand"], c: 1 },
        { q: "Which African country has the most pyramids?", a: ["Egypt", "Sudan", "Libya", "Ethiopia"], c: 1 },
        { q: "What is the capital of South Africa?", a: ["Cape Town", "Johannesburg", "Pretoria", "Durban"], c: 2 },
        { q: "Which ocean borders West Africa?", a: ["Indian", "Atlantic", "Pacific", "Arctic"], c: 1 },
        { q: "What is the capital of Ghana?", a: ["Kumasi", "Accra", "Tamale", "Cape Coast"], c: 1 },
    ],
    tech: [
        { q: "What does 'CPU' stand for?", a: ["Central Processing Unit", "Computer Personal Unit", "Central Program Utility", "Core Processing Unit"], c: 0 },
        { q: "What does 'HTML' stand for?", a: ["Hyper Text Markup Language", "High Tech Modern Language", "Hyper Transfer Markup Link", "Home Tool Markup Language"], c: 0 },
        { q: "What year was the first iPhone released?", a: ["2005", "2007", "2009", "2010"], c: 1 },
        { q: "What does 'API' stand for?", a: ["Application Programming Interface", "Advanced Program Integration", "Application Process Interface", "Automated Programming Interface"], c: 0 },
        { q: "What language is Node.js built on?", a: ["Python", "C++", "JavaScript", "Java"], c: 2 },
        { q: "What does RAM stand for?", a: ["Read Access Memory", "Random Access Memory", "Rapid Action Memory", "Real Allocation Memory"], c: 1 },
        { q: "What is 2^10?", a: ["512", "1024", "2048", "256"], c: 1 },
        { q: "How many bits in a byte?", a: ["4", "8", "16", "32"], c: 1 },
        { q: "What language is known as the 'language of the web'?", a: ["Python", "Java", "JavaScript", "C++"], c: 2 },
        { q: "What is the binary representation of 5?", a: ["100", "101", "110", "111"], c: 1 },
        { q: "Who invented the World Wide Web?", a: ["Bill Gates", "Steve Jobs", "Tim Berners-Lee", "Mark Zuckerberg"], c: 2 },
        { q: "What year was Bitcoin created?", a: ["2005", "2008", "2009", "2010"], c: 2 },
        { q: "What does 'SQL' stand for?", a: ["Simple Query Language", "Structured Query Language", "Standard Query Logic", "System Query Layer"], c: 1 },
        { q: "What is the default port for HTTPS?", a: ["80", "8080", "443", "22"], c: 2 },
        { q: "What does 'OS' stand for?", a: ["Online System", "Operating System", "Open Source", "Output System"], c: 1 },
        { q: "Which company created Python?", a: ["Google", "Microsoft", "Guido van Rossum", "Apple"], c: 2 },
        { q: "What does 'CSS' stand for?", a: ["Computer Style Sheets", "Cascading Style Sheets", "Creative Style System", "Common Style Syntax"], c: 1 },
        { q: "What is the fastest sorting algorithm on average?", a: ["Bubble Sort", "Merge Sort", "Quick Sort", "Selection Sort"], c: 2 },
    ],
    gaming: [
        { q: "What is Discord used for?", a: ["Video editing", "Gaming & communities", "Photo sharing", "Online shopping"], c: 1 },
        { q: "What platform hosts ARCHON CG-223?", a: ["Slack", "Discord", "Teams", "Zoom"], c: 1 },
        { q: "What is the most sold video game of all time?", a: ["GTA V", "Minecraft", "Tetris", "Wii Sports"], c: 2 },
        { q: "What does 'FPS' mean in gaming?", a: ["First Person Shooter", "Frames Per Second", "Both A and B", "Fast Play Speed"], c: 2 },
        { q: "Which game features 'Battle Royale' mode?", a: ["FIFA", "Fortnite", "Minecraft", "Mario"], c: 1 },
        { q: "What color is the Discord logo?", a: ["Blue", "Purple", "Indigo", "Teal"], c: 2 },
        { q: "What is a 'bot' in Discord?", a: ["A human moderator", "An automated program", "A voice channel", "A server role"], c: 1 },
        { q: "What does 'GG' mean in gaming?", a: ["Good Game", "Great Goals", "Got Gem", "Gaming Guild"], c: 0 },
        { q: "What is 'lag' in gaming?", a: ["A cheat code", "Slow response time", "A game mode", "High score"], c: 1 },
        { q: "What platform is Steam?", a: ["Console", "PC gaming platform", "Mobile app", "Browser game"], c: 1 },
    ],
    general: [
        { q: "What is the chemical symbol for gold?", a: ["Go", "Gd", "Au", "Ag"], c: 2 },
        { q: "How many continents are there?", a: ["5", "6", "7", "8"], c: 2 },
        { q: "What is the speed of light (approx)?", a: ["300,000 km/s", "150,000 km/s", "1,000,000 km/s", "30,000 km/s"], c: 0 },
        { q: "Which planet is the Red Planet?", a: ["Venus", "Jupiter", "Mars", "Saturn"], c: 2 },
        { q: "What is the largest ocean?", a: ["Atlantic", "Indian", "Arctic", "Pacific"], c: 3 },
        { q: "What is the smallest prime number?", a: ["0", "1", "2", "3"], c: 2 },
        { q: "What is the largest planet?", a: ["Earth", "Saturn", "Jupiter", "Neptune"], c: 2 },
        { q: "How many sides does a hexagon have?", a: ["5", "6", "7", "8"], c: 1 },
        { q: "What is the boiling point of water?", a: ["90°C", "95°C", "100°C", "105°C"], c: 2 },
        { q: "Who painted the Mona Lisa?", a: ["Picasso", "Van Gogh", "Da Vinci", "Michelangelo"], c: 2 },
        { q: "How many days in a leap year?", a: ["364", "365", "366", "367"], c: 2 },
        { q: "What is the capital of France?", a: ["London", "Berlin", "Madrid", "Paris"], c: 3 },
        { q: "What is the capital of China?", a: ["Shanghai", "Beijing", "Guangzhou", "Shenzhen"], c: 1 },
        { q: "How many players in a football team?", a: ["9", "10", "11", "12"], c: 2 },
        { q: "What is the largest mammal?", a: ["Elephant", "Blue Whale", "Giraffe", "Hippopotamus"], c: 1 },
        { q: "How many strings does a standard guitar have?", a: ["4", "5", "6", "7"], c: 2 },
        { q: "What language do Brazilians speak?", a: ["Spanish", "Portuguese", "French", "English"], c: 1 },
        { q: "What is the hardest natural substance?", a: ["Gold", "Iron", "Diamond", "Platinum"], c: 2 },
    ]
};

const ALL_QUESTIONS = Object.values(QUESTIONS).flat();
const CAT_EMOJIS = { mali: '🇲🇱', africa: '🌍', tech: '💻', gaming: '🎮', general: '🌐' };
const LETTERS = ['A', 'B', 'C', 'D'];
const activeGames = new Map();
const GAME_TIMEOUT = 90000; // 90 seconds per question

async function sendQuestion(ctx, chatId, userId) {
    const key = chatId + '_' + userId;
    const game = activeGames.get(key);
    if (!game) return;

    const q = game.question;
    const cat = game.category;
    const catEmoji = CAT_EMOJIS[cat] || '❓';
    const progress = '█'.repeat(game.qIndex) + '░'.repeat(game.totalQuestions - game.qIndex);

    const text =
        catEmoji + ' <b>Question ' + game.qIndex + '/' + game.totalQuestions + '</b>\n' +
        '<code>' + progress + '</code>\n' +
        '━━━━━━━━━━━━━━━━\n\n' +
        '<b>' + escapeHTML(q.q) + '</b>\n\n' +
        q.a.map((ans, i) => LETTERS[i] + '. ' + escapeHTML(ans)).join('\n') +
        '\n\n⏱ 90s · Score: ' + game.score + '/' + (game.qIndex - 1);

    const keyboard = {
        inline_keyboard: [
            [
                { text: 'A. ' + escapeHTML(q.a[0].substring(0,20)), callback_data: 'trivia_' + game.id + '_A' },
                { text: 'B. ' + escapeHTML(q.a[1].substring(0,20)), callback_data: 'trivia_' + game.id + '_B' },
            ],
            [
                { text: 'C. ' + escapeHTML(q.a[2].substring(0,20)), callback_data: 'trivia_' + game.id + '_C' },
                { text: 'D. ' + escapeHTML(q.a[3].substring(0,20)), callback_data: 'trivia_' + game.id + '_D' },
            ],
            [{ text: '🏳️ Give Up', callback_data: 'trivia_' + game.id + '_QUIT' }]
        ]
    };

    // Clear old timeout
    if (game.timeout) clearTimeout(game.timeout);
    game.timeout = setTimeout(async () => {
        if (!activeGames.has(key)) return;
        activeGames.delete(key);
        await ctx.bridge.sendTo(chatId,
            '⏰ <b>Time is up!</b>\n\nCorrect answer was: <b>' + LETTERS[game.correct] + '.</b> ' + escapeHTML(q.a[game.correct]) + '\n\nFinal score: <b>' + game.score + '/' + game.totalQuestions + '</b>\n\n/trivia to play again!',
            { parse_mode: 'HTML' }
        );
    }, GAME_TIMEOUT);

    await ctx.bridge.sendTo(chatId, text, { parse_mode: 'HTML', extra: { reply_markup: keyboard } });
}

module.exports = {
    name: 'trivia',
    description: 'Trivia quiz — Mali, Africa, Tech, Gaming & more!',
    category: 'Games',
    usage: '/trivia [category] [questions]',
    aliases: ['quiz', 'triv', 'q'],

    handler: async (ctx) => {
        const chatId = String(ctx.chatId);
        const userId = String(ctx.userId);
        const key = chatId + '_' + userId;

        // Already in a game?
        if (activeGames.has(key)) {
            return ctx.replyHTML('⚠️ You already have an active game! Answer the question or wait for it to expire.\n\n/trivia stop — to quit');
        }

        // Parse args: /trivia [category] [count]
        let category = 'random';
        let count = 5;

        for (const arg of ctx.args) {
            if (['mali', 'africa', 'tech', 'gaming', 'general'].includes(arg.toLowerCase())) {
                category = arg.toLowerCase();
            }
            if (!isNaN(arg) && parseInt(arg) >= 3 && parseInt(arg) <= 15) {
                count = parseInt(arg);
            }
            if (arg.toLowerCase() === 'stop' || arg.toLowerCase() === 'quit') {
                activeGames.delete(key);
                return ctx.replyHTML('👋 Game stopped!');
            }
            if (arg.toLowerCase() === 'top' || arg.toLowerCase() === 'leaderboard') {
                return showLeaderboard(ctx, chatId);
            }
        }

        // No args — show category menu
        if (ctx.args.length === 0) {
            return ctx.bridge.sendTo(chatId,
                '🎮 <b>ARCHON Trivia</b>\n━━━━━━━━━━━━━━━━\n\n' +
                'Choose a category or play random!\n\n' +
                '🇲🇱 Mali\n🌍 Africa\n💻 Tech\n🎮 Gaming\n🌐 General\n\n' +
                '💡 Usage:\n' +
                '<code>/trivia</code> — Random mix\n' +
                '<code>/trivia mali</code> — Mali questions\n' +
                '<code>/trivia tech 10</code> — 10 tech questions\n' +
                '<code>/trivia top</code> — Leaderboard\n\n' +
                '🦅 ARCHON CG-223',
                {
                    parse_mode: 'HTML',
                    extra: {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🎲 Random Mix', callback_data: 'trivia_start_random_5' }, { text: '🇲🇱 Mali', callback_data: 'trivia_start_mali_5' }],
                                [{ text: '🌍 Africa', callback_data: 'trivia_start_africa_5' }, { text: '💻 Tech', callback_data: 'trivia_start_tech_5' }],
                                [{ text: '🎮 Gaming', callback_data: 'trivia_start_gaming_5' }, { text: '🌐 General', callback_data: 'trivia_start_general_5' }],
                                [{ text: '🏆 Leaderboard', callback_data: 'trivia_start_top_0' }]
                            ]
                        }
                    }
                }
            );
        }

        await startGame(ctx, chatId, userId, key, category, count);
    },

    handleCallback: async (ctx, data) => {
        // Start game from menu
        if (data.startsWith('trivia_start_')) {
            const parts = data.replace('trivia_start_', '').split('_');
            const cat = parts[0];
            const cnt = parseInt(parts[1]) || 5;
            const chatId = String(ctx.chatId);
            const userId = String(ctx.userId);
            const key = chatId + '_' + userId;

            if (cat === 'top') return showLeaderboard(ctx, chatId);
            if (activeGames.has(key)) return ctx.answerCallback('⚠️ You already have a game running!', true);
            await startGame(ctx, chatId, userId, key, cat, cnt);
            return true;
        }

        // Answer
        if (!data.startsWith('trivia_')) return false;
        const parts = data.split('_');
        if (parts.length < 3) return false;
        const gameId = parts[1];
        const letter = parts[2];

        const chatId = String(ctx.chatId);
        const userId = String(ctx.userId);
        const key = chatId + '_' + userId;
        const game = activeGames.get(key);

        if (!game || game.id !== gameId) {
            await ctx.answerCallback('⏰ Game expired! Start new with /trivia', true);
            return true;
        }
        if (game.answered) { await ctx.answerCallback('Already answered!'); return true; }
        if (String(ctx.userId) !== String(game.userId)) { await ctx.answerCallback('This is not your game!', true); return true; }

        game.answered = true;

        // Quit
        if (letter === 'QUIT') {
            clearTimeout(game.timeout);
            activeGames.delete(key);
            await ctx.answerCallback('👋 Game stopped!');
            await ctx.bridge.sendTo(chatId,
                '🏳️ Game ended!\n\nFinal score: <b>' + game.score + '/' + game.totalQuestions + '</b>\n\n/trivia to play again! 🎮',
                { parse_mode: 'HTML' }
            );
            return true;
        }

        const userAnswer = LETTERS.indexOf(letter);
        const isCorrect = userAnswer === game.correct;
        const correctText = game.question.a[game.correct];

        if (isCorrect) {
            game.score++;
            const xp = 10 * game.score;
            await ctx.answerCallback('✅ Correct! +' + xp + ' XP');

            if (game.qIndex < game.totalQuestions) {
                await ctx.bridge.sendTo(chatId,
                    '✅ <b>CORRECT!</b> ' + '🔥'.repeat(Math.min(game.score, 5)) + '\n\n' +
                    escapeHTML(game.question.a[userAnswer]) + '\n\n' +
                    '⭐ +' + xp + ' XP · Score: <b>' + game.score + '/' + (game.qIndex) + '</b>\n\n' +
                    '<i>Next question...</i>',
                    { parse_mode: 'HTML' }
                );
                await new Promise(r => setTimeout(r, 1200));
                game.qIndex++;
                const pool = game.category === 'random' ? ALL_QUESTIONS : (QUESTIONS[game.category] || ALL_QUESTIONS);
                game.question = pool[Math.floor(Math.random() * pool.length)];
                game.correct = game.question.c;
                game.answered = false;
                await sendQuestion(ctx, chatId, userId);
            } else {
                clearTimeout(game.timeout);
                activeGames.delete(key);
                // Save score
                const scores = loadScores();
                const uid = String(ctx.userId);
                const uname = ctx.username || 'Player';
                if (!scores[uid] || game.score > (scores[uid].best || 0)) {
                    scores[uid] = { name: uname, best: game.score, total: (scores[uid] && scores[uid].total || 0) + game.score, games: (scores[uid] && scores[uid].games || 0) + 1 };
                    saveScores(scores);
                }
                const grade = game.score >= game.totalQuestions ? '🏆 PERFECT!' : game.score >= game.totalQuestions * 0.8 ? '⭐ Excellent!' : game.score >= game.totalQuestions * 0.6 ? '👍 Good!' : game.score >= game.totalQuestions * 0.4 ? '💪 Not Bad!' : '😅 Keep Practicing!';
                await ctx.bridge.sendTo(chatId,
                    '🎉 <b>QUIZ COMPLETE!</b>\n━━━━━━━━━━━━━━━━\n\n' +
                    grade + '\n\n' +
                    '📊 Score: <b>' + game.score + '/' + game.totalQuestions + '</b>\n' +
                    '⭐ XP Earned: <b>' + (game.score * (game.score + 1) * 5) + '</b>\n' +
                    '🔥 Streak: ' + '🔥'.repeat(Math.min(game.score, 10)) + '\n\n' +
                    '/trivia to play again!\n/trivia top — Leaderboard',
                    { parse_mode: 'HTML' }
                );
            }
        } else {
            clearTimeout(game.timeout);
            activeGames.delete(key);
            await ctx.answerCallback('❌ Wrong!');
            await ctx.bridge.sendTo(chatId,
                '❌ <b>WRONG!</b>\n\n' +
                'Your answer: ' + letter + '. ' + escapeHTML(game.question.a[userAnswer]) + '\n' +
                'Correct: <b>' + LETTERS[game.correct] + '.</b> ' + escapeHTML(correctText) + '\n\n' +
                '📊 Final Score: <b>' + game.score + '/' + game.totalQuestions + '</b>\n\n' +
                '/trivia to try again! 🎮',
                { parse_mode: 'HTML' }
            );
        }
        return true;
    }
};

async function startGame(ctx, chatId, userId, key, category, count) {
    const pool = category === 'random' ? ALL_QUESTIONS : (QUESTIONS[category] || ALL_QUESTIONS);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const q = shuffled[0];
    const gameId = Date.now().toString(36);

    activeGames.set(key, {
        id: gameId, userId, category,
        question: q, correct: q.c,
        score: 0, qIndex: 1, totalQuestions: Math.min(count, pool.length),
        answered: false, timeout: null
    });

    const catEmoji = CAT_EMOJIS[category] || '🎲';
    await ctx.bridge.sendTo(chatId,
        catEmoji + ' <b>Trivia Starting!</b>\n' +
        (category === 'random' ? '🎲 Random Mix' : category.charAt(0).toUpperCase() + category.slice(1)) +
        ' · ' + Math.min(count, pool.length) + ' questions\n\n' +
        'Good luck ' + escapeHTML(ctx.username) + '! 🍀',
        { parse_mode: 'HTML' }
    );
    await new Promise(r => setTimeout(r, 800));
    await sendQuestion(ctx, chatId, userId);
}

async function showLeaderboard(ctx, chatId) {
    const scores = loadScores();
    const sorted = Object.entries(scores).sort((a,b) => (b[1].best||0) - (a[1].best||0)).slice(0, 10);
    if (!sorted.length) return ctx.replyHTML('No scores yet! Play /trivia to get on the board 🎮');
    const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
    let msg = '🏆 <b>Trivia Leaderboard</b>\n━━━━━━━━━━━━━━━━\n\n';
    sorted.forEach(([uid, data], i) => {
        msg += medals[i] + ' <b>' + escapeHTML(data.name) + '</b>\n';
        msg += '   Best: ' + data.best + ' · Total XP: ' + (data.total * 10) + '\n\n';
    });
    msg += '🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱';
    return ctx.bridge.sendTo(chatId, msg, { parse_mode: 'HTML' });
}
