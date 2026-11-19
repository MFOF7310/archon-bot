// ═══════════════════════════════════════════════════════════════════════════
// /ask and "Ask Archon" — Archon AI anywhere, through the user app
//   /ask <question> [private]          in DMs, group DMs, servers with or without ARCHON
//   Apps → Ask Archon (on a message)   Archon answers about that one message (and its picture, if any)
// Archon only sees what the person sends it: the question, or the one message they picked. Never the chat.
// 20 answers per person per UTC day (the bot owner: no limit). Only answers that arrive count.
// Answers come from the free model pool (never the Premium model): this is ARCHON's own budget.
// The prefix ".ask" stays the 8-ball's.
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { t } = require('../lib/i18n');
const v2 = require('../lib/games/v2');
const { icon } = require('../lib/ui/icons');

const DAILY = 20;
const GOLD = 0xE6A817;
const MENU = 'Ask Archon';
const LANGS = { fr: 'French', zh: 'Chinese', ar: 'Arabic', en: 'English' };

const T = (lang, k, v) => t(`ask.${k}`, lang, v || {});
const langOf = (interaction) => {
    const l = String(interaction.locale || '').slice(0, 2).toLowerCase();
    return LANGS[l] ? l : 'en';
};
const day = () => Math.floor(Date.now() / 86400000);

let ready = false;
function table(db) {
    if (ready) return;
    db.prepare('CREATE TABLE IF NOT EXISTS ask_usage (user_id TEXT NOT NULL, day INTEGER NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, day))').run();
    ready = true;
}
function used(db, uid) {
    try { table(db); return db.prepare('SELECT n FROM ask_usage WHERE user_id = ? AND day = ?').get(uid, day())?.n || 0; } catch { return 0; }
}
function count(db, uid) {
    try {
        table(db);
        db.prepare('INSERT INTO ask_usage (user_id, day, n) VALUES (?, ?, 1) ON CONFLICT(user_id, day) DO UPDATE SET n = n + 1').run(uid, day());
        db.prepare('DELETE FROM ask_usage WHERE day < ?').run(day() - 2);
    } catch { /* not counted */ }
}

function system(lang) {
    return 'You are Archon, the assistant of ARCHON CG-223, a Discord bot made in Bamako, Mali. '
        + `Answer in ${LANGS[lang]} unless the person clearly writes in another language; then use theirs. `
        + 'Be direct, warm and accurate. Keep it short: under 1500 characters, Discord markdown, no headings over ###. '
        + 'Never write @everyone or @here. If you are not sure of a fact, say so instead of guessing.';
}

// The answer card: what was asked (a line), the answer, who asked and what's left today
function answerCard(lang, { asked, answer, who, left, owner }) {
    const safeAsk = String(asked || '').replace(/[`*_~|>]/g, '').replace(/\s+/g, ' ').trim();
    const quote = safeAsk.length > 160 ? safeAsk.slice(0, 160).replace(/\s+\S*$/, '') + '…' : safeAsk;
    const clean = String(answer || '').replace(/@(everyone|here)/g, '@​$1').slice(0, 3600);
    const foot = owner ? T(lang, 'footOwner', { user: who }) : T(lang, 'foot', { user: who, left, total: DAILY });
    return v2.card(GOLD, [
        { text: `-# ${icon('sparkle')} ${T(lang, 'asked')}${quote ? ` · ${quote}` : ''}` },
        { rule: true },
        { text: clean },
        { text: `-# ${foot}` },
    ]);
}

async function answer(interaction, client, { question, imageUrl = null, quoted = null, priv = false, by = null }) {
    const lang = langOf(interaction);
    const uid = interaction.user.id;
    const owner = uid === process.env.OWNER_ID;
    const n = used(client.db, uid);
    if (!owner && n >= DAILY) {
        const reset = (day() + 1) * 86400;
        return interaction.reply({ content: `${icon('clock')} ${T(lang, 'limit', { total: DAILY, when: `<t:${reset}:R>` })}`, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    await interaction.deferReply(priv ? { flags: MessageFlags.Ephemeral } : {}).catch(() => {});

    const prompt = quoted
        ? `Someone picked this message and asked you about it. Explain it, answer it or react to it helpfully.${by ? `\nIt was written by ${by}.` : ''}\n\nThe message:\n"""${quoted}"""`
        : question;
    let res = null;
    try {
        const { generateAIResponse } = require('../lib/lydia/models');
        res = await generateAIResponse(system(lang), prompt, [], imageUrl, undefined, null);
    } catch (e) {
        console.error('[ASK]', e.message);
    }
    const text = String(res?.content || '').trim();
    if (!text) return interaction.editReply({ content: `${icon('warn')} ${T(lang, 'failed')}` }).catch(() => {});

    count(client.db, uid);
    const who = interaction.user.globalName || interaction.user.username;
    const left = Math.max(0, DAILY - n - 1);
    console.log(`[ASK] ${interaction.user.username} (${quoted ? 'message' : 'question'}) · ${left} left today`);
    return interaction.editReply(answerCard(lang, { asked: quoted ? `"${quoted}"` : question, answer: text, who, left, owner })).catch(() => {});
}

module.exports = {
    name: 'ask',
    userApp: true,   // DMs, group DMs, servers without ARCHON (lib/slash-payload.js)
    category: 'UTILITY',
    description: 'Ask Archon AI anything, anywhere',
    cooldown: 3000,

    data: new SlashCommandBuilder().setName('ask').setDescription('Ask Archon AI anything, anywhere')
        .setDescriptionLocalizations({ fr: 'Pose une question à l’IA Archon, où que tu sois' })
        .addStringOption((o) => o.setName('question').setDescription('Your question').setRequired(true).setMaxLength(1000))
        .addBooleanOption((o) => o.setName('private').setDescription('Only you see the answer').setRequired(false)),

    // The message menu, sent with the commands (lib/slash-payload.js reads `menus`)
    menus: [{ type: 3, name: MENU, name_localizations: { fr: 'Demander à Archon' } }],

    async execute(interaction, client) {
        return answer(interaction, client, {
            question: interaction.options.getString('question'),
            priv: interaction.options.getBoolean('private') === true,
        });
    },

    // Apps → Ask Archon on a message (index.js routes message menus here)
    async menu(interaction, client) {
        const m = interaction.targetMessage;
        const lang = langOf(interaction);
        const textPart = String(m?.content || '').trim().slice(0, 1500);
        const img = [...(m?.attachments?.values?.() || [])].find((a) => /^image\//.test(a.contentType || ''))?.url || null;
        if (!textPart && !img) return interaction.reply({ content: `${icon('warn')} ${T(lang, 'empty')}`, flags: MessageFlags.Ephemeral }).catch(() => {});
        // who wrote it (and whether it's a bot) is the one piece of context that changes the answer: "Verified" from a
        // verification bot means something else than from a friend. Still nothing else from the chat.
        const by = m?.author ? `${m.author.globalName || m.author.username}${m.author.bot ? ' (a bot or app)' : ''}` : null;
        return answer(interaction, client, { quoted: textPart || '(a picture)', imageUrl: img, by });
    },

    // ".ask" in a server is still the 8-ball
    run: (client, message, args, ...rest) => client.commands.get('8ball')?.run?.(client, message, args, ...rest),
};
