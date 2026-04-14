// ================= GUESS THE WORD v1.7.0 =================
const activeGames = new Map();

// Word database by category
const WORD_DATABASE = {
    animals: {
        en: ['LION', 'TIGER', 'ELEPHANT', 'GIRAFFE', 'ZEBRA', 'MONKEY', 'PENGUIN', 'DOLPHIN', 'KANGAROO', 'PANDA'],
        fr: ['LION', 'TIGRE', 'ELEPHANT', 'GIRAFE', 'ZEBRE', 'SINGE', 'MANCHOT', 'DAUPHIN', 'KANGOUROU', 'PANDA']
    },
    countries: {
        en: ['FRANCE', 'MALI', 'JAPAN', 'BRAZIL', 'CANADA', 'EGYPT', 'INDIA', 'CHINA', 'MEXICO', 'GERMANY'],
        fr: ['FRANCE', 'MALI', 'JAPON', 'BRESIL', 'CANADA', 'EGYPTE', 'INDE', 'CHINE', 'MEXIQUE', 'ALLEMAGNE']
    },
    technology: {
        en: ['COMPUTER', 'KEYBOARD', 'MONITOR', 'INTERNET', 'SOFTWARE', 'HARDWARE', 'PROCESSOR', 'NETWORK', 'DATABASE', 'ALGORITHM'],
        fr: ['ORDINATEUR', 'CLAVIER', 'ECRAN', 'INTERNET', 'LOGICIEL', 'MATERIEL', 'PROCESSEUR', 'RESEAU', 'BASE', 'ALGORITHME']
    },
    food: {
        en: ['PIZZA', 'SUSHI', 'BURGER', 'PASTA', 'TACO', 'CURRY', 'RAMEN', 'KEBAB', 'WAFFLE', 'CROISSANT'],
        fr: ['PIZZA', 'SUSHI', 'HAMBURGER', 'PATES', 'TACO', 'CURRY', 'RAMEN', 'KEBAB', 'GAUFRE', 'CROISSANT']
    },
    sports: {
        en: ['FOOTBALL', 'BASKETBALL', 'TENNIS', 'CRICKET', 'HOCKEY', 'VOLLEYBALL', 'BASEBALL', 'RUGBY', 'GOLF', 'SWIMMING'],
        fr: ['FOOTBALL', 'BASKETBALL', 'TENNIS', 'CRICKET', 'HOCKEY', 'VOLLEYBALL', 'BASEBALL', 'RUGBY', 'GOLF', 'NATATION']
    },
    general: {
        en: ['PYTHON', 'JAVASCRIPT', 'DISCORD', 'TELEGRAM', 'ARCHITECT', 'BAMAKO', 'NEURAL', 'ENGINE', 'DIGITAL', 'SOVEREIGNTY'],
        fr: ['PYTHON', 'JAVASCRIPT', 'DISCORD', 'TELEGRAM', 'ARCHITECTE', 'BAMAKO', 'NEURAL', 'MOTEUR', 'NUMERIQUE', 'SOUVERAINETE']
    }
};

// Category configuration
const CATEGORIES = {
    animals: { emoji: '🐾', name: { en: 'Animals', fr: 'Animaux' } },
    countries: { emoji: '🌍', name: { en: 'Countries', fr: 'Pays' } },
    technology: { emoji: '💻', name: { en: 'Technology', fr: 'Technologie' } },
    food: { emoji: '🍕', name: { en: 'Food', fr: 'Nourriture' } },
    sports: { emoji: '⚽', name: { en: 'Sports', fr: 'Sports' } },
    general: { emoji: '🎯', name: { en: 'General', fr: 'Général' } }
};

module.exports = {
    name: 'wordguess',
    aliases: ['guess', 'word', 'hangman', 'wordle', 'mot', 'deviner'],
    activeGames: activeGames,
    
    handler: async (ctx) => {
        const args = ctx.args || [];
        const chatId = ctx.chatId.toString();
        const username = ctx.username;
        const client = ctx.client;
        const version = client.version || '1.7.0';
        const botName = client.user?.username || 'Architect CG-223';
        
        // Check if game already active
        if (activeGames.has(chatId)) {
            const game = activeGames.get(chatId);
            await ctx.replyWithHTML(
                `╔══════════════════════════════════╗\n` +
                `║      🎮 GAME IN PROGRESS 🎮       ║\n` +
                `╚══════════════════════════════════╝\n\n` +
                `❌ A word guessing game is already active!\n\n` +
                `<b>Current word:</b> ${game.displayWord}\n` +
                `<b>Attempts left:</b> ${game.attemptsLeft}\n` +
                `<b>Guessed:</b> ${game.guessedLetters.join(' ')}\n\n` +
                `Keep guessing or wait for timeout!\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🛡️ ${botName} • v${version}`
            );
            return;
        }
        
        // Show categories if no category specified
        if (!args[0]) {
            let categoryList = '';
            Object.entries(CATEGORIES).forEach(([key, cat]) => {
                const count = WORD_DATABASE[key]?.en?.length || 0;
                categoryList += `${cat.emoji} <b>${cat.name.en}</b> • ${count} words\n`;
            });
            
            await ctx.replyWithHTML(
                `╔══════════════════════════════════╗\n` +
                `║      🎯 GUESS THE WORD 🎯         ║\n` +
                `╚══════════════════════════════════╝\n\n` +
                `<b>📚 Available Categories:</b>\n\n` +
                categoryList + `\n` +
                `<b>📋 How to Play:</b>\n` +
                `• I'll pick a secret word\n` +
                `• Guess one letter at a time\n` +
                `• You have 6 attempts\n` +
                `• Type /guess [letter] to play\n\n` +
                `<b>Usage:</b>\n` +
                `<code>/wordguess [category]</code>\n` +
                `<code>/guess [letter]</code>\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🛡️ ${botName} • v${version}\n` +
                `👨‍💻 @mfof7310`
            );
            return;
        }
        
        // Check if it's a guess command
        const command = ctx.message.text?.split(' ')[0]?.toLowerCase();
        
        if (command === '/guess' || command === '/g') {
            await handleGuess(ctx, chatId, args[0], botName, version);
            return;
        }
        
        // Start new game with category
        const categoryKey = args[0].toLowerCase();
        const category = CATEGORIES[categoryKey];
        
        if (!category || !WORD_DATABASE[categoryKey]) {
            await ctx.replyWithHTML(
                `╔══════════════════════════════════╗\n` +
                `║      ❌ INVALID CATEGORY ❌        ║\n` +
                `╚══════════════════════════════════╝\n\n` +
                `Use <code>/wordguess</code> to see available categories.`
            );
            return;
        }
        
        // Get language (detect from message)
        const lang = ctx.message.text?.match(/[àâäéèêëîïôöùûüÿçœæ]/i) ? 'fr' : 'en';
        const words = WORD_DATABASE[categoryKey][lang] || WORD_DATABASE[categoryKey].en;
        
        if (!words || words.length === 0) {
            await ctx.replyWithHTML(`❌ No words available in this category yet.`);
            return;
        }
        
        // Pick random word
        const word = words[Math.floor(Math.random() * words.length)];
        const displayWord = word.split('').map(() => '▯').join(' ');
        
        // Store game state
        const gameState = {
            word: word,
            displayWord: displayWord,
            guessedLetters: [],
            wrongGuesses: 0,
            attemptsLeft: 6,
            maxAttempts: 6,
            category: categoryKey,
            categoryEmoji: category.emoji,
            username: username,
            startTime: Date.now()
        };
        
        activeGames.set(chatId, gameState);
        
        // Auto-timeout after 5 minutes
        setTimeout(() => {
            if (activeGames.has(chatId)) {
                const game = activeGames.get(chatId);
                activeGames.delete(chatId);
                ctx.replyWithHTML(
                    `╔══════════════════════════════════╗\n` +
                    `║        ⏰ GAME TIMEOUT ⏰          ║\n` +
                    `╚══════════════════════════════════╝\n\n` +
                    `The word was: <b>${game.word}</b>\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🛡️ ${botName} • v${version}`
                );
            }
        }, 300000);
        
        // Build hangman display
        const hangmanStages = [
            '😊\n\n\n\n',
            '😟\nO\n\n\n',
            '😨\nO\n|\n\n',
            '😰\n O\n/|\n\n',
            '😱\n O\n/|\\\n\n',
            '💀\n O\n/|\\\n/ \\'
        ];
        
        await ctx.replyWithHTML(
            `╔══════════════════════════════════╗\n` +
            `║      🎯 GUESS THE WORD 🎯         ║\n` +
            `╚══════════════════════════════════╝\n\n` +
            `<b>${category.emoji} Category:</b> ${category.name[lang]}\n` +
            `<b>📝 Word:</b> <code>${displayWord}</code>\n` +
            `<b>📊 Length:</b> ${word.length} letters\n` +
            `<b>❤️ Attempts:</b> ${gameState.attemptsLeft}/6\n\n` +
            `<pre>${hangmanStages[0]}</pre>\n\n` +
            `<b>💡 How to play:</b>\n` +
            `Type <code>/guess [letter]</code> to guess!\n` +
            `Example: <code>/guess a</code>\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🛡️ ${botName} • v${version}`
        );
        
        console.log(`[WORDGUESS] Started ${categoryKey} game for ${username}. Word: ${word}`);
    }
};

// Handle letter guess
async function handleGuess(ctx, chatId, letter, botName, version) {
    if (!activeGames.has(chatId)) {
        await ctx.replyWithHTML(
            `╔══════════════════════════════════╗\n` +
            `║      ❌ NO ACTIVE GAME ❌          ║\n` +
            `╚══════════════════════════════════╝\n\n` +
            `Start a new game with <code>/wordguess [category]</code>\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🛡️ ${botName} • v${version}`
        );
        return;
    }
    
    if (!letter || letter.length !== 1 || !/[a-zA-Z]/.test(letter)) {
        await ctx.replyWithHTML(
            `❌ Please guess a <b>single letter</b>!\n` +
            `Example: <code>/guess a</code>`
        );
        return;
    }
    
    const game = activeGames.get(chatId);
    const guess = letter.toUpperCase();
    
    // Check if already guessed
    if (game.guessedLetters.includes(guess)) {
        await ctx.replyWithHTML(
            `⚠️ You already guessed <b>${guess}</b>!\n` +
            `Guessed letters: ${game.guessedLetters.join(' ')}`
        );
        return;
    }
    
    game.guessedLetters.push(guess);
    
    // Check if guess is correct
    const word = game.word;
    let correctGuess = false;
    let newDisplayWord = '';
    
    for (let i = 0; i < word.length; i++) {
        if (word[i] === guess) {
            newDisplayWord += guess + ' ';
            correctGuess = true;
        } else if (game.displayWord.split(' ')[i] !== '▯') {
            newDisplayWord += game.displayWord.split(' ')[i] + ' ';
        } else {
            newDisplayWord += '▯ ';
        }
    }
    
    game.displayWord = newDisplayWord.trim();
    
    // Hangman stages
    const hangmanStages = [
        '😊\n\n\n\n',
        '😟\nO\n\n\n',
        '😨\nO\n|\n\n',
        '😰\n O\n/|\n\n',
        '😱\n O\n/|\\\n\n',
        '💀\n O\n/|\\\n/ \\'
    ];
    
    if (correctGuess) {
        // Check if won
        if (!game.displayWord.includes('▯')) {
            activeGames.delete(chatId);
            
            await ctx.replyWithHTML(
                `╔══════════════════════════════════╗\n` +
                `║      🏆 YOU WON! 🏆               ║\n` +
                `╚══════════════════════════════════╝\n\n` +
                `🎉 <b>Congratulations!</b>\n\n` +
                `The word was: <b>${word}</b>\n` +
                `📊 Attempts used: ${game.wrongGuesses}/${game.maxAttempts}\n` +
                `⏱️ Time: ${Math.floor((Date.now() - game.startTime) / 1000)}s\n\n` +
                `<pre>😊\n\\O/\n |\n/ \\</pre>\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🛡️ ${botName} • v${version}`
            );
            return;
        }
        
        await ctx.replyWithHTML(
            `╔══════════════════════════════════╗\n` +
            `║        ✅ CORRECT! ✅              ║\n` +
            `╚══════════════════════════════════╝\n\n` +
            `👍 Good guess! <b>${guess}</b> is in the word!\n\n` +
            `<b>📝 Word:</b> <code>${game.displayWord}</code>\n` +
            `<b>❤️ Attempts left:</b> ${game.attemptsLeft}/${game.maxAttempts}\n` +
            `<b>🔤 Guessed:</b> ${game.guessedLetters.join(' ')}\n\n` +
            `<pre>${hangmanStages[game.wrongGuesses]}</pre>`
        );
    } else {
        game.wrongGuesses++;
        game.attemptsLeft--;
        
        // Check if lost
        if (game.attemptsLeft <= 0) {
            activeGames.delete(chatId);
            
            await ctx.replyWithHTML(
                `╔══════════════════════════════════╗\n` +
                `║        💀 GAME OVER 💀            ║\n` +
                `╚══════════════════════════════════╝\n\n` +
                `😢 You ran out of attempts!\n\n` +
                `The word was: <b>${word}</b>\n\n` +
                `<pre>${hangmanStages[5]}</pre>\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🛡️ ${botName} • v${version}`
            );
            return;
        }
        
        await ctx.replyWithHTML(
            `╔══════════════════════════════════╗\n` +
            `║        ❌ WRONG! ❌                ║\n` +
            `╚══════════════════════════════════╝\n\n` +
            `😬 <b>${guess}</b> is not in the word!\n\n` +
            `<b>📝 Word:</b> <code>${game.displayWord}</code>\n` +
            `<b>❤️ Attempts left:</b> ${game.attemptsLeft}/${game.maxAttempts}\n` +
            `<b>🔤 Guessed:</b> ${game.guessedLetters.join(' ')}\n\n` +
            `<pre>${hangmanStages[game.wrongGuesses]}</pre>`
        );
    }
}

// Also add guess command as standalone
module.exports.guessHandler = async (ctx) => {
    const args = ctx.args || [];
    const chatId = ctx.chatId.toString();
    const client = ctx.client;
    const version = client.version || '1.7.0';
    const botName = client.user?.username || 'Architect CG-223';
    
    await handleGuess(ctx, chatId, args[0], botName, version);
};