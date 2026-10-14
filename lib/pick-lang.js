// Which language to answer in: the slash interaction's own when we have it,
// otherwise the server's setlang value, and always one we have.
const i18n = require('./i18n');
const LANGS = ['en', 'fr', 'zh', 'ar', 'bm'];

function pickLang(client, guildId, interaction) {
    // 1. Server setting (setlang) — explicit wins
    let serverLang = null;
    try { serverLang = client?.getServerSettings?.(guildId)?.language; } catch {}
    if (LANGS.includes(serverLang) && serverLang !== 'auto') return serverLang;

    // 2. Slash interaction's Discord locale
    if (interaction && typeof i18n.slashLang === 'function') {
        try {
            const slash = i18n.slashLang(interaction, LANGS);
            if (LANGS.includes(slash)) return slash;
        } catch {}
    }

    // 3. Fallback
    return 'en';
}

module.exports = { pickLang, LANGS };
