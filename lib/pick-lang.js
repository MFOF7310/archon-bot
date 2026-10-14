// Which language to answer in:
//   1. the server's explicit setlang  (it always wins — see mylang.js)
//   2. the member's own mylang choice (when the server is on Auto)
//   3. the slash interaction's locale
//   4. English
const i18n = require('./i18n');
const LANGS = ['en', 'fr', 'zh', 'ar', 'bm'];

let memberLang = null;
try { memberLang = require('./member-lang'); } catch {}

function pickLang(client, guildId, interaction, userId = null) {
    // 1. Server setting (explicit)
    let serverLang = null;
    try { serverLang = client?.getServerSettings?.(guildId)?.language; } catch {}
    if (LANGS.includes(serverLang) && serverLang !== 'auto') return serverLang;

    // 2. User's mylang
    if (userId && memberLang) {
        try {
            const mine = memberLang.get(userId);
            if (LANGS.includes(mine)) return mine;
        } catch {}
    }

    // 3. Slash interaction locale
    if (interaction && typeof i18n.slashLang === 'function') {
        try {
            const slash = i18n.slashLang(interaction, LANGS);
            if (LANGS.includes(slash)) return slash;
        } catch {}
    }

    return 'en';
}

module.exports = { pickLang, LANGS };
