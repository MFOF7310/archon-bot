// /setlang — the language ARCHON answers you in on Telegram. One tap on a button, or /setlang fr.
const fs = require('fs');
const { store } = require('../safe');
const { m: M, langOf } = require('../lang/menu');

const DB_PATH = store('archon_user_langs.json');
const load = () => { try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch { return {}; } };
const save = (d) => fs.writeFileSync(DB_PATH, JSON.stringify(d));

const LANG_INFO = {
    en: { flag: '🇬🇧', native: 'English' },
    fr: { flag: '🇫🇷', native: 'Français' },
    bm: { flag: '🇲🇱', native: 'Bamanankan' },
    zh: { flag: '🇨🇳', native: '中文' },
    ar: { flag: '🇸🇦', native: 'العربية' },
};
const WORDS = { english: 'en', anglais: 'en', french: 'fr', francais: 'fr', 'français': 'fr', bambara: 'bm', bamanankan: 'bm', chinese: 'zh', chinois: 'zh', arabic: 'ar', arabe: 'ar' };

// Other plugins can ask for the saved choice
function getUserLang(userId, fallbackLangCode) {
    return load()[String(userId)] || fallbackLangCode || 'en';
}

// Saves a choice: a language code, or 'auto' to follow the Telegram app again
function setChoice(userId, code) {
    const db = load();
    if (code === 'auto') delete db[String(userId)]; else db[String(userId)] = code;
    save(db);
}

// The card: current language, a line after a change, and one button per language
function card(userId, appLang, outcome = null, withBack = false) {
    const mine = load()[String(userId)] || null;
    const lang = langOf(userId, appLang);
    const name = (c) => `${LANG_INFO[c].flag} ${LANG_INFO[c].native}`;
    let text = `<b>${M(lang, 'lang_t')}</b>\n`;
    if (outcome === 'auto') text += M(lang, 'lang_auto');
    else if (outcome) text += M(lang, 'lang_done', { name: name(lang) });
    else text += M(lang, 'lang_cur', { name: name(lang) });
    text += `\n\n<i>${M(lang, 'lang_pick')}</i>`;
    const btn = (c) => ({ text: (mine === c ? '✅ ' : '') + name(c), callback_data: 'lang:' + c });
    const rows = [[btn('en'), btn('fr')], [btn('bm'), btn('zh')], [btn('ar'), { text: (mine ? '' : '✅ ') + M(lang, 'b_auto'), callback_data: 'lang:auto' }]];
    if (withBack) rows.push([{ text: M(lang, 'b_back'), callback_data: 'm:main' }]);
    return { text, markup: { inline_keyboard: rows } };
}

module.exports = {
    name: 'setlang',
    aliases: ['lang', 'language', 'langue'],
    description: 'Choose the language ARCHON answers you in',
    category: 'Utility',
    usage: '/setlang [en|fr|bm|zh|ar|auto]',
    getUserLang, setChoice, card, LANG_INFO,

    handler: async (ctx) => {
        const appLang = ctx.message?.from?.language_code;
        let word = String(ctx.args[0] || '').toLowerCase();
        word = WORDS[word] || word;
        let outcome = null;
        if (word) {
            if (word !== 'auto' && !LANG_INFO[word]) {
                return ctx.replyHTML(`❓ <code>${word.replace(/[<>&]/g, '')}</code> · ${Object.keys(LANG_INFO).map((c) => `<code>${c}</code>`).join(' ')} <code>auto</code>`);
            }
            setChoice(ctx.userId, word);
            outcome = word;
        }
        const c = card(ctx.userId, appLang, outcome);
        return ctx.replyHTML(c.text, { extra: { reply_markup: c.markup } });
    },
};
