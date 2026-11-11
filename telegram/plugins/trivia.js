// ═══════════════════════════════════════════
const { store } = require('../safe');
//  TG COMMAND: Trivia Game v3 — ARCHON Edition
//  100+ questions, categories, difficulty, leaderboard
// ═══════════════════════════════════════════

const fs = require('fs');
const SCORES_PATH = store('archon_trivia_scores.json');

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

// The whole quiz lives in one message: each question, the feedback and the result replace the previous text
async function gameMsg(ctx, game, chatId, text, keyboard = null) {
    const opt = { parse_mode: 'HTML', ...(keyboard ? { extra: { reply_markup: keyboard } } : {}) };
    if (game.msgId) {
        const r = await ctx.bridge.editMessage(chatId, game.msgId, text, opt).catch(() => null);
        if (r?.success !== false) return;
    }
    const sent = await ctx.bridge.sendTo(chatId, text, opt).catch(() => null);
    game.msgId = sent?.data?.message_id || game.msgId;
}

async function sendQuestion(ctx, chatId, userId, note = '') {
    const key = chatId + '_' + userId;
    const game = activeGames.get(key);
    if (!game) return;

    const q = game.question;
    const catEmoji = CAT_EMOJIS[game.category] || '🎲';
    const text =
        (note ? note + '\n\n' : '') +
        catEmoji + ' <b>' + game.qIndex + '/' + game.totalQuestions + '</b> · score ' + game.score + '\n\n' +
        '<b>' + escapeHTML(q.q) + '</b>\n\n' +
        q.a.map((ans, i) => LETTERS[i] + '. ' + escapeHTML(ans)).join('\n') +
        '\n\n<i>⏱ 90 s</i>';
    const btn = (i) => ({ text: LETTERS[i] + '. ' + q.a[i].substring(0, 24), callback_data: 'trivia_' + game.id + '_' + LETTERS[i] });
    const keyboard = { inline_keyboard: [[btn(0), btn(1)], [btn(2), btn(3)], [{ text: '🏳️ Stop', callback_data: 'trivia_' + game.id + '_QUIT' }]] };

    if (game.timeout) clearTimeout(game.timeout);
    game.timeout = setTimeout(async () => {
        if (!activeGames.has(key)) return;
        activeGames.delete(key);
        reward(ctx, game);
        await gameMsg(ctx, game, chatId,
            '⏰ <b>Time is up</b>\nThe answer was ' + LETTERS[game.correct] + '. ' + escapeHTML(q.a[game.correct]) +
            '\n\nScore <b>' + game.score + '/' + game.totalQuestions + '</b>', againKb());
    }, GAME_TIMEOUT);

    await gameMsg(ctx, game, chatId, text, keyboard);
}

// Points become real XP on the Telegram profile (the end screen used to promise XP that was never given)
function reward(ctx, game) {
    try {
        const db = ctx.client?.db; if (!db || game.rewarded) return;
        game.rewarded = true;
        const E = require('../econ');
        const u = E.ensureUser(db, ctx.userId, ctx.username); if (!u) return;
        const xp = (u.xp || 0) + game.score * 10;
        E.update(db, ctx.userId, { xp, level: E.levelOf(xp), games_played: (u.games_played || 0) + 1, games_won: (u.games_won || 0) + (game.score >= Math.ceil(game.totalQuestions * 0.8) ? 1 : 0) });
    } catch (e) { console.error('[TRIVIA] reward:', e.message); }
}
const againKb = () => ({ inline_keyboard: [[{ text: '🔁 Play again', callback_data: 'trivia_start_random_5' }, { text: '🏆 Top', callback_data: 'trivia_start_top_0' }]] });

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
            return ctx.replyHTML('You already have a quiz running. Answer it, or send /trivia stop.');
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
                '🎮 <b>Trivia</b>\nPick a theme. 5 questions, 90 seconds each, every right answer is 10 XP.',
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
            await ctx.answerCallback('👋');
            reward(ctx, game);
            await gameMsg(ctx, game, chatId, '🏳️ <b>Quiz stopped</b>\nScore <b>' + game.score + '/' + game.totalQuestions + '</b>', againKb());
            return true;
        }

        const userAnswer = LETTERS.indexOf(letter);
        const isCorrect = userAnswer === game.correct;
        const correctText = game.question.a[game.correct];

        if (isCorrect) {
            game.score++;
            await ctx.answerCallback('✅ +10 XP');

            if (game.qIndex < game.totalQuestions) {
                // Next question in the same message, with the result of this one on top; no repeats within a quiz
                game.qIndex++;
                game.question = game.pool[(game.qIndex - 1) % game.pool.length];
                game.correct = game.question.c;
                game.answered = false;
                await sendQuestion(ctx, chatId, userId, '✅ <b>' + escapeHTML(correctText) + '</b> ' + '🔥'.repeat(Math.min(game.score, 5)));
            } else {
                clearTimeout(game.timeout);
                activeGames.delete(key);
                // Save score
                const scores = loadScores();
                const uid = String(ctx.userId);
                const uname = ctx.username || 'Player';
                // Every finished quiz counts (games and total used to change only on a new best score)
                const prev = scores[uid] || {};
                scores[uid] = { name: uname, best: Math.max(prev.best || 0, game.score), total: (prev.total || 0) + game.score, games: (prev.games || 0) + 1 };
                saveScores(scores);
                const grade = game.score >= game.totalQuestions ? '🏆 PERFECT!' : game.score >= game.totalQuestions * 0.8 ? '⭐ Excellent!' : game.score >= game.totalQuestions * 0.6 ? '👍 Good!' : game.score >= game.totalQuestions * 0.4 ? '💪 Not Bad!' : '😅 Keep Practicing!';
                reward(ctx, game);
                await gameMsg(ctx, game, chatId,
                    '🎉 <b>Quiz complete</b> · ' + grade + '\nScore <b>' + game.score + '/' + game.totalQuestions + '</b> · +' + (game.score * 10) + ' XP on your /profile', againKb());
            }
        } else {
            clearTimeout(game.timeout);
            activeGames.delete(key);
            await ctx.answerCallback('❌');
            reward(ctx, game);
            await gameMsg(ctx, game, chatId,
                '❌ <b>Not quite</b>\nYou chose ' + letter + '. ' + escapeHTML(game.question.a[userAnswer] || '') +
                '\nThe answer was <b>' + LETTERS[game.correct] + '. ' + escapeHTML(correctText) + '</b>' +
                '\n\nScore <b>' + game.score + '/' + game.totalQuestions + '</b>', againKb());
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
        id: gameId, userId, category, pool: shuffled,
        question: q, correct: q.c,
        score: 0, qIndex: 1, totalQuestions: Math.min(count, pool.length),
        answered: false, timeout: null,
        // Started from the menu: the menu message becomes the quiz
        msgId: ctx.callbackQuery?.message?.message_id || null,
    });
    await sendQuestion(ctx, chatId, userId);
}

async function showLeaderboard(ctx, chatId) {
    const scores = loadScores();
    const sorted = Object.entries(scores).sort((a,b) => (b[1].best||0) - (a[1].best||0)).slice(0, 10);
    if (!sorted.length) return ctx.replyHTML('No scores yet! Play /trivia to get on the board 🎮');
    const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
    let msg = '🏆 <b>Trivia, best scores</b>\n\n';
    sorted.forEach(([uid, data], i) => {
        msg += medals[i] + ' ' + escapeHTML(data.name) + ' · best ' + data.best + ' · ' + (data.games || 1) + ' games\n';
    });
    return ctx.bridge.sendTo(chatId, msg, { parse_mode: 'HTML' });
}
