// ═══════════════════════════════════════════
//  TG COMMAND: Trivia Game v2
//  Professional quiz with labeled answer buttons
// ═══════════════════════════════════════════

const QUESTIONS = [
    { q: "What is the capital of Mali?", a: ["Bamako", "Timbuktu", "Segou", "Mopti"], c: 0 },
    { q: "What does 'CPU' stand for?", a: ["Central Processing Unit", "Computer Personal Unit", "Central Program Utility", "Core Processing Unit"], c: 0 },
    { q: "What year was the first iPhone released?", a: ["2005", "2007", "2009", "2010"], c: 1 },
    { q: "What does 'HTML' stand for?", a: ["Hyper Text Markup Language", "High Tech Modern Language", "Hyper Transfer Markup Link", "Home Tool Markup Language"], c: 0 },
    { q: "Which planet is the Red Planet?", a: ["Venus", "Jupiter", "Mars", "Saturn"], c: 2 },
    { q: "What is the largest ocean?", a: ["Atlantic", "Indian", "Arctic", "Pacific"], c: 3 },
    { q: "Who invented the World Wide Web?", a: ["Bill Gates", "Steve Jobs", "Tim Berners-Lee", "Mark Zuckerberg"], c: 2 },
    { q: "What is the chemical symbol for gold?", a: ["Go", "Gd", "Au", "Ag"], c: 2 },
    { q: "How many continents are there?", a: ["5", "6", "7", "8"], c: 2 },
    { q: "What is the speed of light (approx)?", a: ["300,000 km/s", "150,000 km/s", "1,000,000 km/s", "30,000 km/s"], c: 0 },
    { q: "What language is known as the 'language of the web'?", a: ["Python", "Java", "JavaScript", "C++"], c: 2 },
    { q: "Which African country has the largest population?", a: ["Egypt", "Nigeria", "Ethiopia", "South Africa"], c: 1 },
    { q: "What is the binary representation of 5?", a: ["100", "101", "110", "111"], c: 1 },
    { q: "Who created Archon CG-223?", a: ["Moussa Fofana", "Elon Musk", "Mark Zuckerberg", "Tim Cook"], c: 0 },
    { q: "What is the smallest prime number?", a: ["0", "1", "2", "3"], c: 2 },
    { q: "What year was Bitcoin created?", a: ["2005", "2008", "2009", "2010"], c: 2 },
    { q: "What does 'API' stand for?", a: ["Application Programming Interface", "Advanced Program Integration", "Application Process Interface", "Automated Programming Interface"], c: 0 },
    { q: "What is the tallest mountain in Africa?", a: ["Mount Kenya", "Mount Kilimanjaro", "Atlas Mountains", "Drakensberg"], c: 1 },
    { q: "In Telegram bots, what prefix starts a command?", a: ["!", "/", "#", "@"], c: 1 },
    { q: "What is the capital of France?", a: ["London", "Berlin", "Madrid", "Paris"], c: 3 },
    { q: "What does RAM stand for?", a: ["Read Access Memory", "Random Access Memory", "Rapid Action Memory", "Real Allocation Memory"], c: 1 },
    { q: "What is 2^10?", a: ["512", "1024", "2048", "256"], c: 1 },
    { q: "What is the largest planet?", a: ["Earth", "Saturn", "Jupiter", "Neptune"], c: 2 },
    { q: "How many bits in a byte?", a: ["4", "8", "16", "32"], c: 1 },
    { q: "What language is Node.js built on?", a: ["Python", "C++", "JavaScript", "Java"], c: 2 },
];

const LETTERS = ['A', 'B', 'C', 'D'];
const activeGames = new Map();
const GAME_TIMEOUT = 120000; // 2 minutes

module.exports = {
    name: 'trivia',
    description: 'Trivia quiz with labeled answer buttons',
    category: 'Games',
    usage: '/trivia',
    aliases: ['quiz', 'triv'],

    handler: async (ctx) => {
        const chatId = String(ctx.chatId);
        const userId = String(ctx.userId);
        const key = `${chatId}_${userId}`;

        // Clean up any existing game
        if (activeGames.has(key)) {
            activeGames.delete(key);
        }

        // Start first question
        const question = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
        const gameId = Date.now();

        activeGames.set(key, {
            id: gameId,
            question,
            correct: question.c,
            score: 0,
            qIndex: 1,
            totalQuestions: 5,
            answered: false,
        });

        await sendQuestion(ctx, chatId, userId);

        // Auto cleanup
        setTimeout(() => {
            const g = activeGames.get(key);
            if (g && g.id === gameId) {
                activeGames.delete(key);
            }
        }, GAME_TIMEOUT);
    }
};

// Build a question message with clear labeled buttons
async function sendQuestion(ctx, chatId, userId) {
    const key = `${chatId}_${userId}`;
    const game = activeGames.get(key);
    if (!game) return;

    const q = game.question;
    const progress = `Q${game.qIndex}/${game.totalQuestions}`;

    // Build buttons: each shows "A. Answer Text" clearly
    const buttons = [];
    for (let i = 0; i < q.a.length; i++) {
        // Truncate long answers for button display
        let answerText = q.a[i];
        if (answerText.length > 30) answerText = answerText.substring(0, 27) + '...';
        buttons.push({
            text: `${LETTERS[i]}. ${answerText}`,
            callback_data: `tr_${LETTERS[i]}_${game.id}`,
        });
    }

    // Arrange in 2 columns
    const kb = [];
    for (let i = 0; i < buttons.length; i += 2) {
        const row = [buttons[i]];
        if (buttons[i + 1]) row.push(buttons[i + 1]);
        kb.push(row);
    }

    const msg = `🎯 <b>TRIVIA QUIZ</b>  <code>[${progress}]</code>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `<b>${escapeHTML(q.q)}</b>\n\n` +
        `💰 Score: <b>${game.score}</b> · Streak: ${'🔥'.repeat(Math.min(game.score, 5)) || 'None'}\n\n` +
        `<i>Choose your answer below:</i>`;

    const reply_markup = { inline_keyboard: kb };

    await ctx.bridge.sendTo(chatId, msg, {
        parse_mode: 'HTML',
        extra: { reply_markup }
    });
}

// Handle button tap
module.exports.handleCallback = async (ctx, data) => {
    if (!data.startsWith('tr_')) return false;

    const parts = data.split('_');
    if (parts.length < 3) return false;

    const letter = parts[1]; // A, B, C, D
    const gameId = parseInt(parts[2]);
    const chatId = String(ctx.chatId);
    const userId = String(ctx.userId);
    const key = `${chatId}_${userId}`;

    const game = activeGames.get(key);
    if (!game || game.id !== gameId) {
        await ctx.answerCallback('⏰ This question expired! Start a new game with /trivia', true);
        return true;
    }

    if (game.answered) {
        await ctx.answerCallback('Already answered!');
        return true;
    }

    game.answered = true;

    const userAnswer = LETTERS.indexOf(letter);
    const isCorrect = userAnswer === game.correct;
    const correctText = game.question.a[game.correct];

    if (isCorrect) {
        game.score++;
        await ctx.answerCallback(`✅ Correct! +${10 * game.score} XP`, false);

        // Show correct feedback, then next question
        if (game.qIndex < game.totalQuestions) {
            // Next question flow
            await ctx.bridge.sendTo(chatId,
                `✅ <b>CORRECT!</b>\n\n` +
                `Answer <b>${letter}:</b> ${escapeHTML(game.question.a[userAnswer])}\n\n` +
                `🎉 +${10 * game.score} XP · Score: <b>${game.score}</b>\n` +
                `Streak: ${'🔥'.repeat(Math.min(game.score, 5))}\n\n` +
                `<i>Next question coming up...</i>`,
                { parse_mode: 'HTML' }
            );

            await new Promise(r => setTimeout(r, 1500));

            // Load next question
            game.qIndex++;
            game.question = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
            game.correct = game.question.c;
            game.answered = false;
            await sendQuestion(ctx, chatId, userId);
        } else {
            // Game complete
            activeGames.delete(key);
            const grade = game.score >= 5 ? '🏆 PERFECT!' : game.score >= 4 ? '⭐ Excellent!' : game.score >= 3 ? '👍 Good!' : game.score >= 2 ? '💪 Not Bad!' : '😅 Keep Practicing!';
            await ctx.bridge.sendTo(chatId,
                `🎉 <b>QUIZ COMPLETE!</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━\n\n` +
                `${grade}\n\n` +
                `📊 Score: <b>${game.score}/${game.totalQuestions}</b>\n` +
                `✨ Total XP: <b>${game.score * (game.score + 1) * 5}</b>\n\n` +
                `<code>/trivia</code> to play again!`,
                { parse_mode: 'HTML' }
            );
        }
    } else {
        // Wrong answer
        activeGames.delete(key);
        await ctx.answerCallback('❌ Wrong!', false);

        await ctx.bridge.sendTo(chatId,
            `❌ <b>WRONG!</b>\n\n` +
            `Your answer: <b>${letter}:</b> ${escapeHTML(game.question.a[userAnswer])}\n` +
            `Correct: <b>${LETTERS[game.correct]}:</b> ${escapeHTML(correctText)}\n\n` +
            `📊 Final Score: <b>${game.score}/${game.totalQuestions}</b>\n\n` +
            `<code>/trivia</code> to try again!`,
            { parse_mode: 'HTML' }
        );
    }

    return true;
};

function escapeHTML(t) {
    return !t || typeof t !== 'string' ? '' : t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
