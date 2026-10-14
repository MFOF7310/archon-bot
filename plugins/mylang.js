// plugins/mylang.js
// .mylang <en|fr|ar|bm|zh|auto>  and  /mylang [language] : choose the
// language ARCHON answers YOU in, on every server set to Auto.
// A language chosen with /setlang by the server always wins.
const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const memberLang = require('../lib/member-lang');
const { t } = require('../lib/i18n');
const { pickLang } = require('../lib/pick-lang');
const ui = require('../lib/games/ui');
const v2 = require('../lib/games/v2');
const cmdSlash = require('../lib/cmd').slash;

const NAMES = { en: 'English', fr: 'Français', ar: 'العربية', bm: 'Bamanankan', zh: '中文' };
const FLAGS = { en: '🇬🇧', fr: '🇫🇷', ar: '🇸🇦', bm: '🇲🇱', zh: '🇨🇳' };
const WORDS = {
    en: 'en', english: 'en', anglais: 'en',
    fr: 'fr', 'français': 'fr', francais: 'fr', french: 'fr',
    ar: 'ar', arabic: 'ar', arabe: 'ar', 'عربي': 'ar', 'العربية': 'ar',
    bm: 'bm', bambara: 'bm', bamanankan: 'bm',
    zh: 'zh', chinese: 'zh', chinois: 'zh', '中文': 'zh',
};
const RESET = ['auto', 'reset', 'off', 'clear', 'default'];
const ORDER = ['en', 'fr', 'ar', 'bm', 'zh'];

const hasTexts = (lang) => lang === 'en' || lang === 'fr' || fs.existsSync(path.join(__dirname, '..', 'lang', lang, 'mylang.json'));

function buildCard(client, userId, guildId, interaction) {
    const serverLang = (() => { try { return (guildId && client.getServerSettings?.(guildId)?.language) || 'auto'; } catch { return 'auto'; } })();
    const mine = memberLang.get(userId);
    const lang = mine || pickLang(client, guildId, interaction, userId);
    const L = (k, v) => t('mylang.' + k, lang, v);

    const cmd = cmdSlash(client, 'mylang', { guild: null });
    const current = mine
        ? L('current', { name: `${FLAGS[mine]} ${NAMES[mine]}` }) || `Current: **${NAMES[mine]}**`
        : L('none') || `You haven't chosen yet. ARCHON follows the server, then your Discord locale.`;
    const how = L('hintWithCmd', { cmd }) || `Use ${cmd} <code> — one of: en · fr · ar · bm · zh · auto`;
    const server = serverLang !== 'auto'
        ? (L('serverKeepsShort') || `This server uses **${NAMES[serverLang] || serverLang}**.`)
        : (L('serverAuto') || 'This server is set to **Auto**.');

    return v2.card(0x00fbff, [
        { text: `*ARCHON CG-223 · Language*` },
        { text: `## 🌐 ${L('title') || 'Your language'}` },
        { rule: true },
        { text: current },
        { rule: true },
        { text: how },
        { text: `-# ${server}` },
    ]);
}


// ── Prefix handler ──
async function runPrefix(client, message, args) {
    const userId = message.author.id;
    const guildId = message.guild?.id || null;
    const word = String((args || [])[0] || '').trim().toLowerCase();

    // Word path (typed argument) — keep the old behavior for typed commands
    if (word) {
        if (RESET.includes(word)) memberLang.reset(userId);
        else if (WORDS[word]) memberLang.set(userId, WORDS[word]);
        // no word or unknown word → just show the card
    }

    const msg = await message.reply(buildCard(client, userId, guildId, null)).catch(() => null);
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
        return runPrefix(client, message, args);
    },

    async execute(interaction, client) {
        const userId = interaction.user.id;
        const guildId = interaction.guildId || null;
        const word = String(interaction.options?.getString('language') || '').trim().toLowerCase();

        if (word) {
            if (RESET.includes(word)) memberLang.reset(userId);
            else if (WORDS[word]) memberLang.set(userId, WORDS[word]);
        }

        const card = buildCard(client, userId, guildId, interaction);
        await interaction.reply({ ...card, flags: MessageFlags.IsComponentsV2 | 64 }).catch(() => {});
        const msg = await interaction.fetchReply().catch(() => null);
    },
};
