// ═══════════════════════════════════════════════════════════
//  ARCHON CG-223 — BUTTON BUILDER
//  Inline Keyboard utility for Telegram bots
//  Usage: const { ButtonBuilder, row, btn } = require('./_buttons');
// ═══════════════════════════════════════════════════════════

/**
 * Create a single inline keyboard button
 * @param {string} text - Button label
 * @param {string} action - Callback data or URL
 * @param {string} type - 'callback' | 'url' | 'webapp'
 * @returns {Object} Telegram inline keyboard button object
 */
function btn(text, action, type = 'callback') {
    if (type === 'url') return { text, url: action };
    if (type === 'webapp') return { text, web_app: { url: action } };
    return { text, callback_data: action };
}

/**
 * Create a row of buttons
 * @param  {...Object} buttons - Button objects from btn()
 * @returns {Array} Row array
 */
function row(...buttons) {
    return buttons;
}

/**
 * Full-width button (convenience)
 * @param {string} text - Label
 * @param {string} action - Callback data
 * @param {string} type - Button type
 * @returns {Array} Single-button row
 */
function full(text, action, type = 'callback') {
    return [btn(text, action, type)];
}

/**
 * Button Builder class for fluent API
 */
class ButtonBuilder {
    constructor() {
        this.rows = [];
        this.currentRow = [];
    }

    /** Add a button to current row */
    add(text, action, type = 'callback') {
        this.currentRow.push(btn(text, action, type));
        return this;
    }

    /** Add a URL button */
    url(text, url) {
        this.currentRow.push(btn(text, url, 'url'));
        return this;
    }

    /** Start a new row */
    newline() {
        if (this.currentRow.length > 0) {
            this.rows.push([...this.currentRow]);
            this.currentRow = [];
        }
        return this;
    }

    /** Add a full-width button (auto newlines) */
    full(text, action, type = 'callback') {
        this.newline();
        this.currentRow.push(btn(text, action, type));
        this.newline();
        return this;
    }

    /** Add emoji-prefixed button */
    emoji(emoji, text, action, type = 'callback') {
        this.currentRow.push(btn(`${emoji} ${text}`, action, type));
        return this;
    }

    /** Create a 2-column grid from items */
    grid(items, prefix = '') {
        items.forEach((item, i) => {
            this.add(item.label || item.text, `${prefix}${item.action || item.id || i}`);
            if (i % 2 === 1) this.newline();
        });
        if (this.currentRow.length > 0) this.newline();
        return this;
    }

    /** Number pad (for trivia, number guessing, etc.) */
    numpad(cols = 3, start = 1, end = 9, prefix = 'num_') {
        let count = 0;
        for (let i = start; i <= end; i++) {
            this.add(String(i), `${prefix}${i}`);
            count++;
            if (count % cols === 0) this.newline();
        }
        if (this.currentRow.length > 0) this.newline();
        return this;
    }

    /** Letter grid (for word games, hangman, etc.) */
    letters(layout = 'qwerty', prefix = 'letter_') {
        const layouts = {
            qwerty: ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'],
            abc: ['ABCDEFGHI', 'JKLMNOPQR', 'STUVWXYZ'],
            abcde: ['ABCDE', 'FGHIJ', 'KLMNO', 'PQRST', 'UVWXYZ'],
        };
        const rows = layouts[layout] || layouts.abc;
        rows.forEach(r => {
            r.split('').forEach(ch => this.add(ch, `${prefix}${ch.toLowerCase()}`));
            this.newline();
        });
        return this;
    }

    /** Quiz answer buttons (A/B/C/D) */
    quiz(answers, prefix = 'quiz_') {
        const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
        answers.forEach((a, i) => {
            const label = `${letters[i] || i}. ${a}`;
            this.add(label, `${prefix}${letters[i] || i}`);
            if (i % 2 === 1) this.newline();
        });
        if (this.currentRow.length > 0) this.newline();
        return this;
    }

    /** Yes/No buttons */
    yesNo(yesText = '✅ Yes', noText = '❌ No', yesAction = 'yes', noAction = 'no') {
        this.add(yesText, yesAction);
        this.add(noText, noAction);
        this.newline();
        return this;
    }

    /** Pagination buttons */
    paginate(current, total, prefix = 'page_') {
        const row = [];
        if (current > 1) row.push(btn('◀ Prev', `${prefix}${current - 1}`));
        row.push(btn(`${current} / ${total}`, '_noop'));
        if (current < total) row.push(btn('Next ▶', `${prefix}${current + 1}`));
        this.rows.push(row);
        return this;
    }

    /** Back button */
    back(text = '🔙 Back', action = 'back') {
        this.full(text, action);
        return this;
    }

    /** Close/Delete button */
    close(text = '❌ Close', action = 'close') {
        this.full(text, action);
        return this;
    }

    /** Get final inline_keyboard markup */
    build() {
        this.newline(); // flush current row
        return { inline_keyboard: this.rows };
    }

    /** Send via bridge with message */
    async send(bridge, chatId, text, options = {}) {
        this.newline();
        const reply_markup = this.build();
        return bridge.sendTo(chatId, text, {
            parse_mode: 'HTML',
            ...options,
            extra: { reply_markup, ...options.extra },
        });
    }
}

// ═══════════════════════════════
//  CONVENIENCE FACTORY
// ═══════════════════════════════

/** Create new ButtonBuilder instance */
function create() {
    return new ButtonBuilder();
}

/** Quick menu layout (like Group Help bot) */
function mainMenu() {
    return new ButtonBuilder()
        .full('📋 Commands', 'cmd_menu')
        .emoji('🎮', 'Games', 'cmd_games')
        .emoji('🛡️', 'Moderation', 'cmd_mod')
        .newline()
        .emoji('💰', 'Economy', 'cmd_economy')
        .emoji('🛠️', 'Utility', 'cmd_utility')
        .newline()
        .full('🆘 Help', 'cmd_help')
        .build();
}

/** Help category menu */
function helpMenu() {
    return new ButtonBuilder()
        .emoji('🔹', 'System', 'help_system')
        .emoji('💰', 'Economy', 'help_economy')
        .newline()
        .emoji('🛡️', 'Moderation', 'help_moderation')
        .emoji('🎮', 'Games', 'help_games')
        .newline()
        .emoji('🛠️', 'Utility', 'help_utility')
        .emoji('🤖', 'AI', 'help_ai')
        .newline()
        .emoji('📺', 'Media', 'help_media')
        .back('🔙 Main Menu', 'menu_main')
        .build();
}

/** Games menu */
function gamesMenu() {
    return new ButtonBuilder()
        .emoji('🎯', 'Trivia', 'game_trivia')
        .emoji('🔤', 'Word Guess', 'game_word')
        .newline()
        .emoji('🎲', 'Roll Dice', 'game_roll')
        .emoji('🪙', 'Coin Flip', 'game_flip')
        .newline()
        .emoji('🏆', 'Leaderboard', 'cmd_leaderboard')
        .back('🔙 Main Menu', 'menu_main')
        .build();
}

module.exports = {
    ButtonBuilder,
    btn,
    row,
    full,
    create,
    mainMenu,
    helpMenu,
    gamesMenu,
};
