// Which language to answer in: the slash command's own (when the i18n module knows how), otherwise the server's, and always one we have.
// Anything else becomes English, so a server set to a language without a translation never crashes a command.
const i18n = require('./i18n');
const LANGS = ['en', 'fr', 'zh', 'ar', 'bm'];

function pickLang(client, guildId, interaction) {
    let raw = null;
    if (interaction && typeof i18n.slashLang === 'function') { try { raw = i18n.slashLang(interaction, LANGS); } catch { raw = null; } }
    if (!LANGS.includes(raw)) { try { raw = client && client.detectLanguage ? client.detectLanguage('setup', guildId) : null; } catch { raw = null; } }
    return LANGS.includes(raw) ? raw : 'en';
}

module.exports = { pickLang, LANGS };
