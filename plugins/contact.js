// ═══════════════════════════════════════════════════════════════════════════
// /contact <message> — a message to ARCHON's developer (OWNER_ID), with a reply that comes back by DM
//   1. The person sees their message and picks what it is: bug, suggestion or other. Picking sends it.
//   2. The developer gets a card in DMs with a Reply button: a box opens, the answer goes to the person's DMs.
// Buttons are global (contact:<action>:<uid>:<key>[:<type>], creply_<uid>_<ts>, modal creplym_<uid>), so nothing
// dies after 30 seconds; the message waits 30 minutes in memory to be sent. The prefix version used to crash
// (it called fetchReply on a message).
// Texts: lang/<l>/contact.json
// ═══════════════════════════════════════════════════════════════════════════
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const { t } = require('../lib/i18n');
const { icon } = require('../lib/ui/icons');
const v2 = require('../lib/games/v2');

const T = (lang, k, v) => t(`contact.${k}`, lang, v || {});
const LANGS = ['en', 'fr', 'zh', 'ar'];
const langOf = (client, gid, where, uid) => { try { const l = require('../lib/pick-lang').pickLang(client, gid, where, uid); return LANGS.includes(l) ? l : 'en'; } catch { return 'en'; } };
const TYPES = { bug: ['🐛', 0xE24B4A, ButtonStyle.Danger], idea: ['💡', 0xEF9F27, ButtonStyle.Primary], other: ['💬', 0x378ADD, ButtonStyle.Secondary] };
const clean = (s, n = 1900) => String(s || '').replace(/@(everyone|here)/gi, '@​$1').slice(0, n);

// Messages waiting for their type, 30 minutes
const pending = new Map();
function hold(data) {
    const key = Math.random().toString(36).slice(2, 10);
    pending.set(key, { ...data, at: Date.now() });
    for (const [k, v] of pending) if (Date.now() - v.at > 30 * 60 * 1000) pending.delete(k);
    return key;
}

function askCard(lang, uid, key, text, where) {
    return v2.card(0x7F77DD, [
        { text: `### ${icon('messages', where)} ${T(lang, 'title')}\n${T(lang, 'ask')}` },
        { rule: true },
        { text: `>>> ${clean(text, 900)}${text.length > 900 ? '…' : ''}` },
        { row: new ActionRowBuilder().addComponents(
            ...Object.entries(TYPES).map(([k, [e, , style]]) => new ButtonBuilder().setCustomId(`contact:send:${uid}:${key}:${k}`).setLabel(T(lang, `type_${k}`)).setEmoji(e).setStyle(style)),
            new ButtonBuilder().setCustomId(`contact:cancel:${uid}:${key}`).setLabel(T(lang, 'cancel')).setStyle(ButtonStyle.Secondary),
        ) },
        { text: `-# ${T(lang, 'privacy')}` },
    ]);
}

// What the developer receives
function ownerCard(p, type, user) {
    const [e, color] = TYPES[type];
    const days = Math.floor((Date.now() - user.createdTimestamp) / 86400000);
    return v2.card(color, [
        { text: `### ${e} ${{ bug: 'Bug report', idea: 'Suggestion', other: 'Message' }[type]} from ${clean(user.globalName || user.username, 60)}\n-# @${user.username} · ${user.id} · account ${days} days old` },
        { rule: true },
        { text: clean(p.text) },
        { text: `-# ${p.guildName ? `${clean(p.guildName, 80)}${p.channelName ? ` · #${clean(p.channelName, 60)}` : ''}` : 'Outside a server'} · their language: ${p.lang}` },
        { row: new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`creply_${user.id}_${Date.now()}`).setLabel('Reply').setEmoji('💬').setStyle(ButtonStyle.Primary)) },
    ]);
}

async function start(client, { user, guild, channel, text, lang, reply }) {
    if (!process.env.OWNER_ID) return reply({ content: T(lang, 'unavailable') });
    const key = hold({ text, lang, guildName: guild?.name || null, channelName: channel?.name || null });
    return reply(askCard(lang, user.id, key, text, guild));
}

// contact:<send|cancel>:<uid>:<key>[:<type>]
async function handleComponent(ix, client) {
    const [, action, uid, key, type] = ix.customId.split(':');
    const lang = langOf(client, ix.guildId, ix, ix.user.id);
    if (ix.user.id !== uid) return ix.reply({ content: T(lang, 'notYours'), flags: MessageFlags.Ephemeral }).catch(() => {});
    const p = pending.get(key);
    if (action === 'cancel') {
        pending.delete(key);
        return ix.update(v2.card(0x888780, [{ text: `-# ${T(lang, 'cancelled')}` }])).catch(() => {});
    }
    if (!p) return ix.update(v2.card(0x888780, [{ text: T(lang, 'expired') }])).catch(() => {});
    if (!TYPES[type]) return ix.deferUpdate().catch(() => {});
    pending.delete(key);   // a second click can't send it twice
    await ix.deferUpdate().catch(() => {});
    let ok = false;
    try {
        const owner = await client.users.fetch(process.env.OWNER_ID);
        ok = !!(await owner.send(ownerCard(p, type, ix.user)).catch(() => null));
    } catch (e) { console.error('[CONTACT] send:', e.message); }
    console.log(`[CONTACT] ${ix.user.username} → developer (${type}): ${ok ? 'sent' : 'FAILED'} · ${p.text.slice(0, 80)}`);
    return ix.editReply(ok
        ? v2.card(0x1D9E75, [{ text: `### ${icon('ok', ix)} ${T(lang, 'sent')}\n${T(lang, 'sentHint')}` }])
        : v2.card(0xE24B4A, [{ text: T(lang, 'failed') }])).catch(() => {});
}

// The developer's Reply button: a box for the answer
async function replyButton(ix) {
    if (ix.user.id !== process.env.OWNER_ID) return ix.reply({ content: 'Only ARCHON’s developer can reply here.', flags: MessageFlags.Ephemeral }).catch(() => {});
    const uid = ix.customId.split('_')[1];
    const modal = new ModalBuilder().setCustomId(`creplym_${uid}`).setTitle('Reply by DM').addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('text').setLabel('Your answer').setStyle(TextInputStyle.Paragraph).setMaxLength(1900).setRequired(true)));
    return ix.showModal(modal).catch((e) => console.error('[CONTACT] modal:', e.message));
}

// The box sent: the answer goes to the person's DMs, in a card they can answer with /contact
async function replyModal(ix, client) {
    if (ix.user.id !== process.env.OWNER_ID) return ix.reply({ content: 'Only ARCHON’s developer can reply here.', flags: MessageFlags.Ephemeral }).catch(() => {});
    const uid = ix.customId.split('_')[1];
    const text = ix.fields.getTextInputValue('text');
    const target = await client.users.fetch(uid).catch(() => null);
    const lang = langOf(client, null, null, uid);
    const sent = target ? await target.send(v2.card(0x1D9E75, [
        { text: `### ${icon('messages', null)} ${T(lang, 'replyTitle')}` },
        { rule: true },
        { text: clean(text) },
        { text: `-# ${T(lang, 'replyHint')}` },
    ])).catch(() => null) : null;
    console.log(`[CONTACT] developer → ${target?.username || uid}: ${sent ? 'sent' : 'FAILED (DMs closed?)'}`);
    return ix.reply({ content: sent ? `Sent to **${target.username}**.` : 'Not delivered: their DMs are closed or the account is gone.', flags: MessageFlags.Ephemeral }).catch(() => {});
}

module.exports = {
    name: 'contact',
    aliases: ['feedback', 'report', 'suggest', 'msg', 'contacter', 'messagearchitecte'],
    description: 'Send a message to ARCHON’s developer',
    category: 'SYSTEM',
    cooldown: 30000,
    usage: '.contact <message>',
    examples: ['.contact I found a bug in the shop!'],
    handleComponent, replyButton, replyModal,

    data: new SlashCommandBuilder().setName('contact').setDescription('Send a message to ARCHON’s developer')
        .setDescriptionLocalizations({ fr: 'Envoyer un message au développeur d’ARCHON' })
        .addStringOption((o) => o.setName('message').setDescription('Your message: a bug, an idea, a question').setRequired(true).setMaxLength(1900)),

    run: async (client, message, args, db, serverSettings) => {
        const lang = langOf(client, message.guild?.id, message, message.author.id);
        const text = args.join(' ').trim();
        if (!text) return message.reply({ content: T(lang, 'usage', { p: serverSettings?.prefix || '.' }) }).catch(() => {});
        if (text.length > 1900) return message.reply({ content: T(lang, 'tooLong') }).catch(() => {});
        return start(client, { user: message.author, guild: message.guild, channel: message.channel, text, lang, reply: (p) => message.reply(p).catch(() => {}) });
    },

    execute: async (interaction, client) => {
        const lang = langOf(client, interaction.guildId, interaction, interaction.user.id);
        const text = interaction.options.getString('message', true).trim();
        return start(client, { user: interaction.user, guild: interaction.guild, channel: interaction.channel, text, lang,
            reply: (p) => interaction.reply({ ...p, flags: (p.flags || 0) | MessageFlags.Ephemeral }).catch(() => {}) });
    },
};
