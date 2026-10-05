// plugins/mylang.js
// .mylang <en|fr|ar|bm|zh|auto>   and   /mylang [language] : choose the language ARCHON answers YOU in, on every server set to Auto.
// A language chosen with /setlang by the server always wins; this never overrides it.
const { SlashCommandBuilder } = require('discord.js');
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

// One answer for both the prefix command and the slash command. `interaction` is null for a prefix command.
function answer(client, { userId, guildId, interaction }, wordIn) {
    const list = Object.entries(NAMES).map(([k, v]) => `\`${k}\` ${v}`).join(' · ');
    const serverLang = (() => { try { return (guildId && client.getServerSettings?.(guildId)?.language) || 'auto'; } catch { return 'auto'; } })();
    const mine = memberLang.get(userId);
    const answerIn = (preferred) => (preferred && hasTexts(preferred) ? preferred : pickLang(client, guildId, interaction));
    const word = String(wordIn || '').trim().toLowerCase();

    if (!word) {
        const lang = answerIn(mine);
        const body = mine ? t('mylang.current', lang, { name: NAMES[mine] }) : t('mylang.none', lang);
        return `${body}\n${t('mylang.howTo', lang, { list })}`;
    }
    if (RESET.includes(word)) {
        try { memberLang.reset(userId); } catch (e) { console.error('[MYLANG] reset failed:', e.message); return t('mylang.error', answerIn(mine)); }
        return t('mylang.reset', answerIn(null));
    }
    const code = WORDS[word];
    if (!code) return t('mylang.invalid', answerIn(mine), { list });
    try { memberLang.set(userId, code); } catch (e) { console.error('[MYLANG] save failed:', e.message); return t('mylang.error', answerIn(mine)); }
    const lang = answerIn(code);
    const explicit = serverLang !== 'auto' && serverLang !== code;
    return t('mylang.saved', lang, { name: NAMES[code] }) + (explicit ? `\n${t('mylang.serverKeeps', lang)}` : '');
}

module.exports = {
    name: 'mylang',
    aliases: ['mylanguage', 'malangue', 'monlangue'],
    description: 'Choose the language ARCHON answers you in (servers with their own /setlang keep theirs).',
    category: 'CONFIG',
    cooldown: 3000,
    usage: '.mylang <en|fr|ar|bm|zh|auto>',

    data: new SlashCommandBuilder()
        .setName('mylang')
        .setDescription('🌐 Choose the language ARCHON answers you in')
        .addStringOption(o => o
            .setName('language')
            .setDescription('Your language (leave empty to see your current one)')
            .setRequired(false)
            .addChoices(
                { name: '🌐 Auto (automatic)', value: 'auto' },
                { name: '🇬🇧 English', value: 'en' },
                { name: '🇫🇷 Français', value: 'fr' },
                { name: '🇸🇦 العربية', value: 'ar' },
                { name: '🇲🇱 Bamanankan', value: 'bm' },
                { name: '🇨🇳 中文', value: 'zh' },
            )),

    async run(client, message, args) {
        const content = answer(client, { userId: message.author.id, guildId: message.guild ? message.guild.id : null, interaction: null }, (args || [])[0]);
        return message.reply({ content, allowedMentions: { repliedUser: false } });
    },

    async execute(interaction, client) {
        let content;
        try {
            content = answer(client, { userId: interaction.user.id, guildId: interaction.guildId || null, interaction }, interaction.options?.getString('language'));
        } catch (e) {
            console.error('[MYLANG] slash failed:', e.message);
            content = 'Something went wrong. Please try again in a moment.';
        }
        return interaction.reply({ content, flags: 64 });
    },
};
