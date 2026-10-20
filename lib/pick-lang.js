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
    const effectiveUserId = userId || interaction?.user?.id || interaction?.author?.id;
    if (effectiveUserId && memberLang) {
        try {
            const mine = memberLang.get(effectiveUserId);
            if (LANGS.includes(mine)) return mine;
        } catch {}
    }

    // 3. Server's preferred locale (if auto)
    let serverLocale = null;
    const guild = interaction?.guild || client?.guilds?.cache?.get(guildId);
    if (guild?.preferredLocale) {
        const loc = guild.preferredLocale.split('-')[0].toLowerCase();
        if (LANGS.includes(loc)) serverLocale = loc;
    }
    if (serverLocale) return serverLocale;

    // 4. Slash interaction locale (user's client)
    if (interaction?.locale) {
        const loc = interaction.locale.split('-')[0].toLowerCase();
        if (LANGS.includes(loc)) return loc;
    }

    return 'en';
}

module.exports = { pickLang, LANGS };
