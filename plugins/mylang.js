// plugins/mylang.js
// .mylang <en|fr|ar|bm|zh|auto> : choose the language ARCHON answers YOU in, on every server set to Auto.
// A language chosen with /setlang by the server always wins; this never overrides it.
const fs = require('fs');
const path = require('path');
const memberLang = require('../lib/member-lang');
const { t } = require('../lib/i18n');
const { pickLang } = require('../lib/pick-lang');

const NAMES = { en: 'English', fr: 'Français', ar: 'العربية', bm: 'Bamanankan', zh: '中文' };
const WORDS = {
    en: 'en', english: 'en', anglais: 'en',
    fr: 'fr', 'français': 'fr', francais: 'fr', french: 'fr',
    ar: 'ar', arabic: 'ar', arabe: 'ar', 'عربي': 'ar', 'العربية': 'ar',
    bm: 'bm', bambara: 'bm', bamanankan: 'bm',
    zh: 'zh', chinese: 'zh', chinois: 'zh', '中文': 'zh',
};
const RESET = ['auto', 'reset', 'off', 'clear', 'default'];

// A language this command has texts for: English and French always, the others once their file exists.
const hasTexts = (lang) => lang === 'en' || lang === 'fr' || fs.existsSync(path.join(__dirname, '..', 'lang', lang, 'mylang.json'));

module.exports = {
    name: 'mylang',
    aliases: ['mylanguage', 'malangue', 'monlangue'],
    description: 'Choose the language ARCHON answers you in (servers with their own /setlang keep theirs).',
    category: 'CONFIG',
    cooldown: 3000,
    usage: '.mylang <en|fr|ar|bm|zh|auto>',

    async run(client, message, args) {
        const list = Object.entries(NAMES).map(([k, v]) => `\`${k}\` ${v}`).join(' · ');
        const guildId = message.guild ? message.guild.id : null;
        const serverLang = (() => { try { return (guildId && client.getServerSettings?.(guildId)?.language) || 'auto'; } catch { return 'auto'; } })();
        const mine = memberLang.get(message.author.id);
        const answerIn = (preferred) => (preferred && hasTexts(preferred) ? preferred : pickLang(client, guildId));
        const send = (content) => message.reply({ content, allowedMentions: { repliedUser: false } });
        const word = String((args || [])[0] || '').trim().toLowerCase();

        if (!word) {
            const lang = answerIn(mine);
            const body = mine ? t('mylang.current', lang, { name: NAMES[mine] }) : t('mylang.none', lang);
            return send(`${body}\n${t('mylang.howTo', lang, { list })}`);
        }
        if (RESET.includes(word)) {
            try { memberLang.reset(message.author.id); } catch (e) { console.error('[MYLANG] reset failed:', e.message); return send(t('mylang.error', answerIn(mine))); }
            return send(t('mylang.reset', answerIn(null)));
        }
        const code = WORDS[word];
        if (!code) return send(t('mylang.invalid', answerIn(mine), { list }));
        try { memberLang.set(message.author.id, code); } catch (e) { console.error('[MYLANG] save failed:', e.message); return send(t('mylang.error', answerIn(mine))); }
        const lang = answerIn(code);
        const explicit = serverLang !== 'auto' && serverLang !== code;
        return send(t('mylang.saved', lang, { name: NAMES[code] }) + (explicit ? `\n${t('mylang.serverKeeps', lang)}` : ''));
    },
};
