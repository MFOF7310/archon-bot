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
            // From the "New word" button: that message becomes the new game instead of a new message
            msgId: ctx.callbackQuery?.message?.message_id || null,
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
        guessedStr = '';
    }

    const msg = `🔤 <b>Word guess</b>\n` +
        `${hangman}\n` +
        `<code>${wordDisplay}</code>\n\n` +
        `💡 ${game.hint}\n` +
        `Mistakes <b>${game.wrong}/${MAX_WRONG}</b> · letters left <b>${remaining}</b>`;

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
        { text: '🔄 New word', callback_data: 'wg_new' },
        { text: '🏳️ Give up', callback_data: 'wg_giveup' },
    ]);
    await gameMsg(ctx, game, chatId, msg, { inline_keyboard: kb });
}

// The whole game lives in one message: every letter edits it (it used to send a new 26-button message per letter)
async function gameMsg(ctx, game, chatId, text, keyboard = null) {
    const opt = { parse_mode: 'HTML', ...(keyboard ? { extra: { reply_markup: keyboard } } : {}) };
    if (game.msgId) {
        const r = await ctx.bridge.editMessage(chatId, game.msgId, text, opt).catch(() => null);
        if (r?.success !== false) return;
    }
    const sent = await ctx.bridge.sendTo(chatId, text, opt).catch(() => null);
    game.msgId = sent?.data?.message_id || game.msgId;
}
const againKb = { inline_keyboard: [[{ text: '🔁 New word', callback_data: 'wg_new' }]] };

// A won game is real XP on the Telegram profile
function reward(ctx, points, won) {
    try {
        const db = ctx.client?.db; if (!db) return;
        const E = require('../econ');
        const u = E.ensureUser(db, ctx.userId, ctx.username); if (!u) return;
        const xp = (u.xp || 0) + (won ? points : 0);
        E.update(db, ctx.userId, { xp, level: E.levelOf(xp), games_played: (u.games_played || 0) + 1, games_won: (u.games_won || 0) + (won ? 1 : 0) });
    } catch (e) { console.error('[WORDGUESS] reward:', e.message); }
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
        await ctx.answerCallback('🏳️');
        if (game) {
            if (!game.msgId) game.msgId = ctx.callbackQuery?.message?.message_id || null;
            reward(ctx, 0, false);
            await gameMsg(ctx, game, chatId, `🏳️ The word was <b>${game.word}</b>.`, againKb);
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
    if (!game.msgId) game.msgId = ctx.callbackQuery?.message?.message_id || null;

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
        reward(ctx, score, true);
        await gameMsg(ctx, game, chatId, `🎉 <b>${game.word}</b>, found with ${game.wrong} mistake${game.wrong === 1 ? '' : 's'}.\n+${score} XP on your /profile`, againKb);
        return true;
    }

    if (lost) {
        activeGames.delete(key);
        reward(ctx, 0, false);
        await gameMsg(ctx, game, chatId, `${getHangman(game.wrong)}\nThe word was <b>${game.word}</b>.`, againKb);
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
