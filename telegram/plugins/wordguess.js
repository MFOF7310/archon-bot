// ═══════════════════════════════════════════
//  TG COMMAND: Word Guess Game v2
//  Hangman-style with clear visual progress
// ═══════════════════════════════════════════

const WORDS = [
    { word: 'BAMAKO', hint: 'Capital of Mali 🇲🇱' },
    { word: 'ARCHON', hint: "This bot's name" },
    { word: 'TELEGRAM', hint: 'This platform' },
    { word: 'DISCORD', hint: 'Purple chat app' },
    { word: 'JAVASCRIPT', hint: 'Node.js language' },
    { word: 'BITCOIN', hint: 'First cryptocurrency' },
    { word: 'AFRICA', hint: 'Continent 🌍' },
    { word: 'TIMBUKTU', hint: 'Famous desert city in Mali' },
    { word: 'DIGITAL', hint: 'Not analog' },
    { word: 'CODE', hint: 'What programmers write' },
    { word: 'PYTHON', hint: 'Snake language 🐍' },
    { word: 'LONDON', hint: 'UK capital 🇬🇧' },
    { word: 'DIAMOND', hint: 'Hardest gem 💎' },
    { word: 'ECLIPSE', hint: 'Sun/moon event 🌑' },
    { word: 'GALAXY', hint: 'Milky Way is one 🌌' },
    { word: 'NINJA', hint: 'Shadow warrior 🥷' },
    { word: 'OCEAN', hint: 'Big water 🌊' },
    { word: 'ROBOT', hint: 'Mechanical being 🤖' },
    { word: 'ZEBRA', hint: 'Striped horse 🦓' },
    { word: 'NEURON', hint: 'Brain cell 🧠' },
];

const MAX_WRONG = 6;
const activeGames = new Map();

module.exports = {
    name: 'wordguess',
    description: 'Guess the word with letter buttons',
    category: 'Games',
    usage: '/wordguess',
    aliases: ['wg', 'word', 'hangman'],

    handler: async (ctx) => {
        const chatId = String(ctx.chatId);
        const userId = String(ctx.userId);
        const key = `${chatId}_${userId}`;

        const entry = WORDS[Math.floor(Math.random() * WORDS.length)];
        const word = entry.word.toUpperCase();

        activeGames.set(key, {
            word,
            hint: entry.hint,
            guessed: new Set(),
            wrong: 0,
            over: false,
        });

        await sendGame(ctx, chatId, userId);
    }
};

module.exports.handleCallback = handleCallback;

async function sendGame(ctx, chatId, userId) {
    const key = `${chatId}_${userId}`;
    const game = activeGames.get(key);
    if (!game) return;

    const hangman = getHangman(game.wrong);
    const wordDisplay = game.word.split('').map(ch => game.guessed.has(ch) ? ch : '▢').join(' ');
    const uniqueLetters = [...new Set(game.word.split(''))];
    const found = uniqueLetters.filter(ch => game.guessed.has(ch)).length;
    const remaining = uniqueLetters.length - found;

    let guessedStr = '';
    const wrongGuesses = [...game.guessed].filter(ch => !game.word.includes(ch)).sort();
    if (wrongGuesses.length > 0) {
        guessedStr = `\n❌ Wrong: <code>${wrongGuesses.join(' ')}</code>\n`;
    }

    const msg = `🔤 <b>WORD GUESS</b>\n` +
        `${hangman}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Word: <code>${wordDisplay}</code>\n\n` +
        `💡 Hint: ${game.hint}\n` +
        `❌ Wrong: <b>${game.wrong}/${MAX_WRONG}</b> · 🎯 Remaining: <b>${remaining}</b>${guessedStr}\n\n` +
        `<i>Tap a letter to guess!</i>`;

    // Build letter keyboard — show used letters as disabled
    const kb = [];
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const rowSize = 6;

    for (let i = 0; i < alphabet.length; i += rowSize) {
        const row = [];
        for (let j = 0; j < rowSize && i + j < alphabet.length; j++) {
            const ch = alphabet[i + j];
            if (game.guessed.has(ch)) {
                if (game.word.includes(ch)) {
                    row.push({ text: `✅${ch}`, callback_data: '_noop' }); // correct guess
                } else {
                    row.push({ text: `❌${ch}`, callback_data: '_noop' }); // wrong guess
                }
            } else {
                row.push({ text: ch, callback_data: `wg_${ch}_${userId}` });
            }
        }
        kb.push(row);
    }

    // Control row
    kb.push([
        { text: '🔄 New Word', callback_data: 'wg_new' },
        { text: '💡 Hint', callback_data: '_noop' },
        { text: '🏳️ Give Up', callback_data: 'wg_giveup' },
    ]);

    await ctx.bridge.sendTo(chatId, msg, {
        parse_mode: 'HTML',
        extra: { reply_markup: { inline_keyboard: kb } } }
    );
}

async function handleCallback(ctx, data) {
    if (!data.startsWith('wg_')) return false;

    const chatId = String(ctx.chatId);
    const userId = String(ctx.userId);
    const key = `${chatId}_${userId}`;

    // New game
    if (data === 'wg_new') {
        await ctx.answerCallback('New word!');
        module.exports.handler(ctx);
        return true;
    }

    // Give up
    if (data === 'wg_giveup') {
        const game = activeGames.get(key);
        activeGames.delete(key);
        await ctx.answerCallback('Game ended!');
        if (game) {
            await ctx.bridge.sendTo(chatId,
                `💀 <b>GAME OVER!</b>\n\n` +
                `The word was: <b>${game.word}</b>\n\n` +
                `<code>/wordguess</code> to try again!`,
                { parse_mode: 'HTML' }
            );
        }
        return true;
    }

    // Letter guess
    const parts = data.split('_');
    if (parts.length < 2) return false;
    const letter = parts[1].toUpperCase();

    const game = activeGames.get(key);
    if (!game) {
        await ctx.answerCallback('Game expired! Use /wordguess', true);
        return true;
    }

    if (game.over) {
        await ctx.answerCallback('Game already over!');
        return true;
    }

    if (game.guessed.has(letter)) {
        await ctx.answerCallback(`Already guessed ${letter}!`);
        return true;
    }

    game.guessed.add(letter);

    if (!game.word.includes(letter)) {
        game.wrong++;
        await ctx.answerCallback(`❌ ${letter} — not in word!`);
    } else {
        await ctx.answerCallback(`✅ ${letter} — found!`);
    }

    // Check win
    const won = game.word.split('').every(ch => game.guessed.has(ch));
    const lost = game.wrong >= MAX_WRONG;

    if (won) {
        activeGames.delete(key);
        const score = Math.max(10, 100 - game.wrong * 10);
        await ctx.bridge.sendTo(chatId,
            `🎉 <b>YOU WON!</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `Word: <b>${game.word}</b>\n` +
            `Wrong guesses: <b>${game.wrong}/${MAX_WRONG}</b>\n` +
            `🏆 Score: <b>${score}</b> points!\n\n` +
            `<code>/wordguess</code> — Play again`,
            { parse_mode: 'HTML' }
        );
        return true;
    }

    if (lost) {
        activeGames.delete(key);
        await ctx.bridge.sendTo(chatId,
            `💀 <b>GAME OVER!</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `The word was: <b>${game.word}</b>\n` +
            `Wrong guesses: <b>${game.wrong}/${MAX_WRONG}</b>\n\n` +
            `<code>/wordguess</code> — Try again!`,
            { parse_mode: 'HTML' }
        );
        return true;
    }

    // Continue — re-send updated game state
    await sendGame(ctx, chatId, userId);
    return true;
}

function getHangman(wrong) {
    const art = [
        '<pre>  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========</pre>',
        '<pre>  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========</pre>',
        '<pre>  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========</pre>',
        '<pre>  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========</pre>',
        '<pre>  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========</pre>',
        '<pre>  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========</pre>',
        '<pre>  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n=========</pre>',
    ];
    return art[Math.min(wrong, art.length - 1)];
}
