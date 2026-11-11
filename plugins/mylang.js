// plugins/mylang.js
// .mylang <en|fr|ar|bm|zh|auto>  and  /mylang [language] : choose the language ARCHON answers YOU in.
// The choice is kept per place: each server has its own, and DMs have their own. Server A never changes server B.
// A language chosen with /setlang by the server always wins there, so the card shows no buttons on such a server.
const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const memberLang = require('../lib/member-lang');
const { t } = require('../lib/i18n');
const { pickLang } = require('../lib/pick-lang');
const v2 = require('../lib/games/v2');
const EMOJIS = (() => { try { return require('../config/emojis'); } catch { return {}; } })(); // the file is not in the repo: clones still load

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

const nameOf = (code) => `${EMOJIS[`flag_${code}`] || FLAGS[code] || ''} ${NAMES[code] || code}`.trim();
// What the member typed, shown back safely: no markdown, no mentions, short
const shown = (word) => String(word || '').replace(/[`*_~|\\<>@#]/g, '').slice(0, 24) || '?';

// Saves what the member typed or picked. Returns 'set', 'reset', 'unknown', 'error', or null when nothing was asked.
function apply(userId, guildId, word) {
    if (!word) return null;
    try {
        if (RESET.includes(word)) { memberLang.reset(userId, guildId); return 'reset'; }
        if (WORDS[word]) { memberLang.set(userId, guildId, WORDS[word]); return 'set'; }
        return 'unknown';
    } catch (e) {
        console.error('[MYLANG] save failed:', e.message);
        return 'error';
    }
}

const SHORT = { en: 'English', fr: 'Français', bm: 'Bamanankan', zh: '中文', ar: 'العربية' };

// outcome: 'set' | 'reset' | 'unknown' | 'error' | null. Buttons carry the owner's id: someone else pressing them gets their own card.
function buildCard(client, userId, guildId, ctx, outcome = null, word = '') {
    const serverLang = (() => { try { return (guildId && client.getServerSettings?.(guildId)?.language) || 'auto'; } catch { return 'auto'; } })();
    const locked = !!guildId && serverLang !== 'auto' && !!NAMES[serverLang];
    const mine = memberLang.get(userId, guildId || 'DM');
    const lang = locked ? serverLang : (mine || pickLang(client, guildId, ctx, userId));
    const L = (k, v) => t('mylang.' + k, lang, v);
    const ic = (k, fb) => EMOJIS[k] || fb;

    const items = [{ text: `## ${ic('globe', '🌐')} ${L('title')}` }];
    if (outcome === 'set' && mine) items.push({ text: `${ic('ic_ok', '✅')} ${L('doneSet', { name: nameOf(mine) })}` });
    else if (outcome === 'reset') items.push({ text: `${ic('ic_ok', '✅')} ${L('doneReset')}` });
    else if (outcome === 'unknown') items.push({ text: L('unknown', { word: shown(word) }) });
    else if (outcome === 'error') items.push({ text: L('saveFailed') });
    else items.push({ text: mine ? L('current', { name: nameOf(mine) }) : L('none') });

    if (locked) {
        // The server's own language wins here: a choice could not apply, so there is nothing to press
        items.push({ rule: true }, { text: `${ic('ic_lock', '🔒')} ${L('lockedHere', { lang: nameOf(serverLang) })}` });
        return v2.card(0xBA7517, items);
    }
    items.push({ text: `-# ${guildId ? L('scopeServer') : L('scopeDm')}` }, { rule: true });
    const btn = (code) => {
        const on = code === 'auto' ? !mine : mine === code;
        const b = new ButtonBuilder().setCustomId(`mylang:${userId}:${code}`).setStyle(on ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setLabel(code === 'auto' ? L('autoBtn') : SHORT[code]);
        const e = code === 'auto' ? ic('ic_refresh', '🔄') : (EMOJIS[`flag_${code}`] || FLAGS[code]);
        if (e) b.setEmoji(e);
        return b;
    };
    items.push({ row: new ActionRowBuilder().addComponents(...['en', 'fr', 'bm'].map(btn)) });
    items.push({ row: new ActionRowBuilder().addComponents(...['zh', 'ar', 'auto'].map(btn)) });
    items.push({ text: `-# ${L('tapHint')}` });
    return v2.card(0x1D9E75, items);
}

// A language button: the owner's card changes in place, anyone else gets their own private card
async function handleComponent(interaction, client) {
    const [, owner, code] = interaction.customId.split(':');
    const uid = interaction.user.id, gid = interaction.guildId || null;
    const outcome = apply(uid, gid || 'DM', code);
    const card = buildCard(client, uid, gid, interaction, outcome, code);
    if (uid === owner) return interaction.update(card).catch((e) => console.error('[MYLANG] update:', e.message));
    return interaction.reply({ ...card, flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral }).catch(() => {});
}

module.exports = {
    handleComponent,
    name: 'mylang',
    aliases: ['mylanguage', 'malangue', 'monlangue'],
    description: 'Choose the language ARCHON answers you in (servers with their own /setlang keep theirs).',
    category: 'CONFIG',
    cooldown: 3000,
    usage: '.mylang <en|fr|ar|bm|zh|auto>',

    data: new SlashCommandBuilder()
        .setName('mylang')
        .setDescription('Choose the language ARCHON answers you in')
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
        const word = String((args || [])[0] || '').trim().toLowerCase();
        const outcome = apply(message.author.id, message.guild?.id || 'DM', word);
        await message.reply(buildCard(client, message.author.id, message.guild?.id || null, message, outcome, word)).catch(() => {});
    },

    async execute(interaction, client) {
        const word = String(interaction.options?.getString('language') || '').trim().toLowerCase();
        const outcome = apply(interaction.user.id, interaction.guildId || 'DM', word);
        const card = buildCard(client, interaction.user.id, interaction.guildId || null, interaction, outcome, word);
        await interaction.reply({ ...card, flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral }).catch(() => {});
    },
};
