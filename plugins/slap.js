// plugins/slap.js — /slap <member>: a playful slap; only the one slapped can slap back (once). The count is kept per
// server (it used to reset at every restart).
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const fun = require('../lib/fun');
const { card } = require('../lib/games/v2');
const { icon } = require('../lib/ui/icons');

const LINES = {
    en: ['{from} slaps {to} across the face!', '{from} gives {to} a reality-check slap!', '{from} slaps {to} with a wet fish! 🐟', '{from} lands a legendary slap on {to}! 💥',
        '{from} slaps {to} into next week! 🚀', '{from} sneaks up on {to} with a surprise slap! 😱', '{from} slaps {to} so hard they see stars! ⭐', '{from} gives {to} a gentle slap… just kidding, it was hard! 💢'],
    fr: ['{from} met une gifle à {to} !', '{from} remet {to} les idées en place d\'une claque !', '{from} gifle {to} avec un poisson mouillé ! 🐟', '{from} envoie une gifle légendaire à {to} ! 💥',
        '{from} gifle {to} jusqu\'à la semaine prochaine ! 🚀', '{from} surprend {to} avec une gifle par derrière ! 😱', '{from} gifle {to} si fort qu\'il voit des étoiles ! ⭐', '{from} donne une petite tape à {to}… non, c\'était une vraie gifle ! 💢'],
    zh: ['{from} 给了 {to} 一记耳光！', '{from} 一巴掌让 {to} 清醒过来！', '{from} 用一条湿鱼拍了 {to}！🐟', '{from} 给了 {to} 传说级的一巴掌！💥',
        '{from} 一巴掌把 {to} 拍到了下周！🚀', '{from} 偷袭了 {to}，送上一记耳光！😱', '{from} 打得 {to} 眼冒金星！⭐', '{from} 轻轻拍了 {to} 一下……开玩笑的，很用力！💢'],
    ar: ['{from} صفع {to} على وجهه!', '{from} أعاد {to} إلى الواقع بصفعة!', '{from} صفع {to} بسمكة مبللة! 🐟', '{from} وجّه صفعة أسطورية إلى {to}! 💥',
        '{from} صفع {to} حتى الأسبوع القادم! 🚀', '{from} فاجأ {to} بصفعة من الخلف! 😱', '{from} صفع {to} بقوة حتى رأى النجوم! ⭐', '{from} ربّت على {to} بلطف… أمزح، كانت صفعة قوية! 💢'],
};

function count(db, gid, uid) {
    try {
        db.exec('CREATE TABLE IF NOT EXISTS fun_slaps (guild_id TEXT, user_id TEXT, n INTEGER, PRIMARY KEY (guild_id, user_id))');
        db.prepare('INSERT INTO fun_slaps (guild_id, user_id, n) VALUES (?, ?, 1) ON CONFLICT(guild_id, user_id) DO UPDATE SET n = n + 1').run(String(gid || 'DM'), String(uid));
        return db.prepare('SELECT n FROM fun_slaps WHERE guild_id = ? AND user_id = ?').get(String(gid || 'DM'), String(uid))?.n || 1;
    } catch { return 1; }
}

function slapCard(client, guild, lang, from, to, back) {
    const n = count(client.db, guild?.id, to.id);
    const line = fun.pick(LINES[lang] || LINES.en).replace('{from}', `<@${from.id}>`).replace('{to}', `<@${to.id}>`);
    const items = [{ text: `-# ${icon('hand', guild)} ${fun.F(back ? 'slapBack' : 'slap', lang)}\n### ${line}\n-# ${fun.F(n === 1 ? 'slappedOnce' : 'slapped', lang, { user: `<@${to.id}>`, n })}` }];
    if (!back) items.push({ row: new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`fun:slapback:${from.id}:${to.id}`).setLabel(fun.F('btnSlapBack', lang)).setStyle(ButtonStyle.Danger).setEmoji(icon('hand', guild))) });
    const payload = card(back ? 0xEF9F27 : 0xE24B4A, items);
    payload.allowedMentions = { users: [to.id] };   // the one slapped is told
    return payload;
}

function check(lang, from, to) {
    if (!to) return fun.F('slapWho', lang);
    if (to.id === from.id) return fun.F('slapSelf', lang);
    if (to.bot) return fun.F('slapBot', lang);
    return null;
}

// fun:slapback:<from>:<to> — only <to>, once: the card turns into the slap back
async function slapBack(ix, client, parts, lang) {
    const [, , fromId, toId] = parts;
    if (ix.user.id !== toId) return ix.reply({ content: fun.F('slapBackOnly', lang, { user: `<@${toId}>` }), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }).catch(() => {});
    const from = await client.users.fetch(fromId).catch(() => null);
    if (!from) return ix.deferUpdate().catch(() => {});
    return ix.update(slapCard(client, ix.guild, lang, ix.user, from, true)).catch(() => {});
}

module.exports = {
    name: 'slap',
    aliases: ['smack', 'hit'],
    description: 'Slap someone (playfully)',
    category: 'FUN',
    cooldown: 3000,
    slapBack,
    data: new SlashCommandBuilder().setName('slap').setDescription('Slap someone (playfully)')
        .addUserOption((o) => o.setName('user').setDescription('Who deserves it?').setRequired(true)),
    run: async (client, message) => {
        const lang = fun.langOf(client, message.guild?.id, message, message.author.id);
        const to = message.mentions.users.first();
        const no = check(lang, message.author, to);
        if (no) return message.reply({ content: no, allowedMentions: { parse: [] } }).catch(() => {});
        return message.reply(slapCard(client, message.guild, lang, message.author, to, false)).catch(() => {});
    },
    execute: async (ix, client) => {
        const lang = fun.langOf(client, ix.guildId, ix, ix.user.id);
        const to = ix.options.getUser('user');
        const no = check(lang, ix.user, to);
        if (no) return ix.reply({ content: no, flags: MessageFlags.Ephemeral });
        return ix.reply(slapCard(client, ix.guild, lang, ix.user, to, false));
    },
};
