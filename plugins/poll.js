// /poll — a real Discord poll: one vote per member (or several if allowed), live results, a set end time, and the
// final result posted by Discord itself. It used to be a card with number reactions: anyone could react to every
// option, nothing was counted, and the slash version crashed on every use.
//   /poll question option1 option2 [option3..option9] [duration] [multiple]
//   .poll "Question" "Option 1" "Option 2" ...   (open for 24 hours)
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { t } = require('../lib/i18n');

const LANGS = ['en', 'fr', 'zh', 'ar'];
const P = (k, lang, v) => t(`poll.${k}`, lang, v || {});
const MAX_OPTIONS = 9;
const LIMIT = { question: 300, answer: 55 };   // Discord's own limits
const DURATIONS = [[1, '1 hour'], [6, '6 hours'], [12, '12 hours'], [24, '1 day'], [72, '3 days'], [168, '1 week']];
const langOf = (client, gid, where, uid) => { const l = require('../lib/pick-lang').pickLang(client, gid, where, uid); return LANGS.includes(l) ? l : 'en'; };

// The poll to send, or { error } with the text to show
function buildPoll(question, options, hours, multiple, lang) {
    question = String(question || '').trim();
    const answers = options.map((o) => String(o || '').trim()).filter(Boolean);
    if (!question || answers.length < 2) return { error: P('minOptions', lang) };
    if (answers.length > MAX_OPTIONS) return { error: P('maxOptions', lang) };
    if (question.length > LIMIT.question) return { error: P('tooLongQuestion', lang, { max: LIMIT.question }) };
    const long = answers.find((a) => a.length > LIMIT.answer);
    if (long) return { error: P('tooLongAnswer', lang, { max: LIMIT.answer, answer: long.slice(0, 30) }) };
    if (new Set(answers.map((a) => a.toLowerCase())).size !== answers.length) return { error: P('duplicate', lang) };
    return { poll: { question: { text: question }, answers: answers.map((text) => ({ text })), duration: hours, allowMultiselect: !!multiple } };
}

// Discord needs Send Polls in the channel (it is not part of Send Messages)
function missingPerm(channel, guild) {
    if (!guild || !PermissionFlagsBits.SendPolls || typeof channel?.permissionsFor !== 'function') return false;
    const p = channel.permissionsFor(guild.members.me);
    return !!p && !p.has(PermissionFlagsBits.SendPolls);
}

module.exports = {
    name: 'poll',
    aliases: ['survey', 'sondage'],
    description: '📊 Create a poll: one vote per member, live results, a set end time.',
    category: 'UTILITY',
    cooldown: 5000,
    usage: '.poll "Question" "Option 1" "Option 2" ...',
    examples: ['.poll "Quel jeu ce soir ?" "CODM" "Valorant" "Fortnite"'],

    data: (() => {
        const b = new SlashCommandBuilder()
            .setName('poll')
            .setDescription('Create a poll: one vote per member, live results, a set end time')
            .addStringOption((o) => o.setName('question').setDescription('The question').setRequired(true).setMaxLength(LIMIT.question))
            .addStringOption((o) => o.setName('option1').setDescription('Option 1').setRequired(true).setMaxLength(LIMIT.answer))
            .addStringOption((o) => o.setName('option2').setDescription('Option 2').setRequired(true).setMaxLength(LIMIT.answer));
        b.addStringOption((o) => o.setName('duration').setDescription('How long it stays open (default: 1 day)').setRequired(false)
            .addChoices(...DURATIONS.map(([h, name]) => ({ name, value: String(h) }))));
        b.addBooleanOption((o) => o.setName('multiple').setDescription('Members can pick several options (default: one)').setRequired(false));
        for (let i = 3; i <= MAX_OPTIONS; i++) b.addStringOption((o) => o.setName(`option${i}`).setDescription(`Option ${i} (optional)`).setRequired(false).setMaxLength(LIMIT.answer));
        return b;
    })(),

    run: async (client, message, args) => {
        const lang = langOf(client, message.guild?.id, message, message.author.id);
        const parts = [];
        for (const m of args.join(' ').matchAll(/"([^"]+)"|'([^']+)'|“([^”]+)”|(\S+)/g)) parts.push(m[1] || m[2] || m[3] || m[4]);
        if (parts.length < 3) return message.reply(P('invalid', lang)).catch(() => {});
        if (missingPerm(message.channel, message.guild)) return message.reply(P('noPerm', lang)).catch(() => {});
        const r = buildPoll(parts[0], parts.slice(1), 24, false, lang);
        if (r.error) return message.reply(r.error).catch(() => {});
        const sent = await message.channel.send({ poll: r.poll }).catch((e) => { console.error('[POLL] send:', e.message); return null; });
        if (!sent) return message.reply(P('failed', lang)).catch(() => {});
        await message.delete().catch(() => {});   // the poll replaces the command
    },

    execute: async (interaction, client) => {
        const lang = langOf(client, interaction.guildId, interaction, interaction.user.id);
        const o = interaction.options;
        const options = [];
        for (let i = 1; i <= MAX_OPTIONS; i++) options.push(o.getString(`option${i}`));
        const r = buildPoll(o.getString('question'), options, Number(o.getString('duration') || 24), o.getBoolean('multiple'), lang);
        if (r.error) return interaction.reply({ content: r.error, flags: MessageFlags.Ephemeral });
        if (missingPerm(interaction.channel, interaction.guild)) return interaction.reply({ content: P('noPerm', lang), flags: MessageFlags.Ephemeral });
        return interaction.reply({ poll: r.poll }).catch((e) => {
            console.error('[POLL] reply:', e.message);
            if (!interaction.replied) interaction.reply({ content: P('failed', lang), flags: MessageFlags.Ephemeral }).catch(() => {});
        });
    },
};
