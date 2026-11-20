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

// What Archon knows about itself: short and exact, so "who made you" or "how do I reach support" get a real answer
// instead of "I don't know" (it used to have no facts at all). Only these facts: nothing invented.
function facts(client) {
    const id = client?.user?.id;
    let invite = null; try { invite = id ? require('../lib/invite').inviteUrl(id, { source: 'ask' }) : null; } catch { /* no invite line */ }
    return [
        'FACTS ABOUT YOU (use them when asked; never invent others):',
        '- ARCHON CG-223 is a Discord bot made by Moussa Fofana, a solo developer in Bamako, Mali.',
        '- Features: Archon AI, levels and economy, moderation (AutoMod, captcha verification, raid shield), tickets, welcome cards, games, music, YouTube and TikTok alerts. Free, with an optional Premium.',
        '- Support server (help, bug reports, suggestions): https://discord.gg/NFSMFJajp9',
        '- Website and dashboard: https://archon223.com · quick start: https://archon223.com/docs · all commands: https://archon223.com/commands · Premium: https://archon223.com/premium',
        invite ? `- Add ARCHON to a server: ${invite}` : null,
        id ? `- Vote for ARCHON (rewards in servers): https://top.gg/bot/${id}/vote` : null,
        '- Open source: https://github.com/MFOF7310/archon-bot (only when someone asks about the code).',
        '- Outside a server (this user app) you have: /ask, Ask Archon on a message, /avatar, /lyrics, /translate, /define, /calc, /qr, /coinflip, /roll, /meme, /anime, /slap, /car, /quote, /image, /youtube, /url. Everything else needs ARCHON in a server.',
    ].filter(Boolean).join('\n');
}

function system(lang, client, user) {
    return 'You are Archon, the assistant of ARCHON CG-223, a Discord bot made in Bamako, Mali. '
        + `Answer in ${LANGS[lang]} unless the person clearly writes in another language; then use theirs. `
        + 'Be direct, warm and accurate. Keep it short: under 1500 characters, Discord markdown, no headings over ###. '
        + 'Never write @everyone or @here. If you are not sure of a fact, say so instead of guessing. '
        + 'Links: write them bare (no markdown around them).\n\n' + facts(client)
        // who is asking: their display name (and username), so Archon can answer "what's my name" or greet them.
        // Nothing else about them is sent.
        + (user ? `\n\nTHE PERSON ASKING: ${String(user.globalName || user.username).replace(/[\n\r`]/g, ' ').slice(0, 40)}`
            + `${user.globalName && user.globalName !== user.username ? ` (username: ${user.username})` : ''}. Use their name naturally, not in every sentence.` : '');
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
        res = await generateAIResponse(system(lang, client, interaction.user), prompt, [], imageUrl, undefined, null);
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

// The readable text of a card message: Components V2 (containers, sections, text, buttons, menus) and old embeds,
// plus the first picture found (thumbnail, gallery, embed image) when the message has no attachment.
function cardText(m) {
    const out = []; let image = null;
    const seen = new Set();
    const walk = (c) => {
        if (!c || typeof c !== 'object' || seen.has(c)) return; seen.add(c);
        if (typeof c.content === 'string' && c.content.trim()) out.push(c.content.trim());   // text display
        if (typeof c.label === 'string' && c.label.trim()) out.push(`[${c.label.trim()}]`);  // buttons
        if (typeof c.placeholder === 'string' && c.placeholder.trim()) out.push(`[${c.placeholder.trim()}]`);
        const url = c.media?.url;
        if (!image && typeof url === 'string' && /^https?:/.test(url)) image = url;
        for (const k of ['components', 'items']) if (Array.isArray(c[k])) c[k].forEach(walk);
        if (c.accessory) walk(c.accessory);
    };
    try { for (const c of m?.components || []) walk(typeof c.toJSON === 'function' ? c.toJSON() : (c.data || c)); } catch { /* keep what was read */ }
    for (const e of m?.embeds || []) {
        const d = e.data || e;
        [d.author?.name, d.title, d.description, ...(d.fields || []).map((f) => `${f.name}: ${f.value}`), d.footer?.text]
            .filter((x) => typeof x === 'string' && x.trim()).forEach((x) => out.push(x.trim()));
        if (!image) image = d.image?.url || d.thumbnail?.url || null;
    }
    return { text: out.join('\n'), image };
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
        // Cards (Components V2 and embeds) have no plain text: their words live in the components, so read those too
        const card = cardText(m);
        const textPart = [String(m?.content || '').trim(), card.text].filter(Boolean).join('\n').slice(0, 1500);
        const img = [...(m?.attachments?.values?.() || [])].find((a) => /^image\//.test(a.contentType || ''))?.url || card.image || null;
        if (!textPart && !img) return interaction.reply({ content: `${icon('warn')} ${T(lang, 'empty')}`, flags: MessageFlags.Ephemeral }).catch(() => {});
        // who wrote it (and whether it's a bot) is the one piece of context that changes the answer: "Verified" from a
        // verification bot means something else than from a friend. Still nothing else from the chat.
        const by = m?.author ? `${m.author.globalName || m.author.username}${m.author.bot ? ' (a bot or app)' : ''}` : null;
        return answer(interaction, client, { quoted: textPart || '(a picture)', imageUrl: img, by });
    },

    // ".ask" in a server is still the 8-ball
    run: (client, message, args, ...rest) => client.commands.get('8ball')?.run?.(client, message, args, ...rest),
};
