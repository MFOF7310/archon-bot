const fs = require('fs');

const DB_PATH = '/tmp/archon_user_langs.json';

function load() {
    try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch { return {}; }
}
function save(d) { fs.writeFileSync(DB_PATH, JSON.stringify(d)); }

// Export so other plugins can use it
function getUserLang(userId, fallbackLangCode) {
    const db = load();
    return db[String(userId)] || fallbackLangCode || 'en';
}

const LANG_INFO = {
    en: { name: 'English', flag: '🇬🇧', native: 'English' },
    fr: { name: 'French', flag: '🇫🇷', native: 'Français' },
    bm: { name: 'Bambara', flag: '🇲🇱', native: 'Bamanankan' },
    zh: { name: 'Chinese', flag: '🇨🇳', native: '中文' },
};

module.exports = {
    name: 'setlang',
    aliases: ['lang', 'language', 'langue'],
    description: 'Set your preferred language',
    category: 'Utility',
    usage: '/setlang <en|fr|bm|zh>',
    getUserLang,

    handler: async (ctx) => {
        const db = load();
        const userId = String(ctx.userId);
        const currentLang = db[userId] || ctx.message?.from?.language_code || 'en';
        const lang = currentLang;

        const chosen = ctx.args[0]?.toLowerCase();

        // Show available languages if no arg
        if (!chosen) {
            const current = LANG_INFO[db[userId]] || LANG_INFO.en;
            let msg = `🌍 <b>Language Settings</b>\n━━━━━━━━━━━━━━━━\n\n`;
            msg += `Current: ${current.flag} <b>${current.native}</b>\n\n`;
            msg += `Available languages:\n`;
            for (const [code, info] of Object.entries(LANG_INFO)) {
                const active = db[userId] === code ? ' ✅' : '';
                msg += `• <code>/setlang ${code}</code> — ${info.flag} ${info.native}${active}\n`;
            }
            msg += `\n💡 Your language is auto-detected from Telegram, but you can override it here!\n\n🦅 ARCHON CG-223`;
            return ctx.replyHTML(msg);
        }

        // Validate
        if (!LANG_INFO[chosen]) {
            return ctx.replyHTML(
                `❌ Unknown language: <code>${chosen}</code>\n\n` +
                `Available: ${Object.keys(LANG_INFO).map(c => `<code>${c}</code>`).join(' • ')}`
            );
        }

        // Save
        db[userId] = chosen;
        save(db);

        const info = LANG_INFO[chosen];
        const responses = {
            en: `✅ Language set to ${info.flag} <b>English</b>! I'll speak English with you from now on 😊`,
            fr: `✅ Langue réglée sur ${info.flag} <b>Français</b>! Je te parlerai en français maintenant 😊`,
            bm: `✅ Kumakan segin ka kɛ ${info.flag} <b>Bamanankan</b>! N bɛna kuma e fɛ bamanankan na sisan 😊`,
            zh: `✅ 语言已设置为 ${info.flag} <b>中文</b>！我现在会用中文和你交流 😊`,
        };

        await ctx.replyHTML(`${responses[chosen]}\n\n🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`);
    }
};
