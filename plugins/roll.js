// plugins/roll.js — /roll [dice]: 1d6 by default, any NdN up to 100 dice of 1000 sides, with +/- (2d6+3)
const { SlashCommandBuilder } = require('discord.js');
const fun = require('../lib/fun');
const { icon } = require('../lib/ui/icons');

function parse(str) {
    const m = /^(\d{0,3})d(\d{1,4})([+-]\d{1,4})?$/i.exec(String(str || '1d6').replace(/\s+/g, ''));
    if (!m) return null;
    const n = Number(m[1] || 1), sides = Number(m[2]), mod = Number(m[3] || 0);
    return n >= 1 && n <= 100 && sides >= 2 && sides <= 1000 ? { n, sides, mod } : null;
}

function funMake(client, { guild, user, lang, arg, priv }) {
    const d = parse(arg);
    if (!d) return null;
    const rolls = Array.from({ length: d.n }, () => 1 + Math.floor(Math.random() * d.sides));
    const total = rolls.reduce((a, b) => a + b, 0) + d.mod;
    const label = `${d.n}d${d.sides}${d.mod ? (d.mod > 0 ? `+${d.mod}` : d.mod) : ''}`;
    const detail = d.n > 1 || d.mod ? `${rolls.slice(0, 40).join(' + ')}${d.n > 40 ? ' + …' : ''}${d.mod ? `  (${d.mod > 0 ? '+' : '−'}${Math.abs(d.mod)})` : ''}` : null;
    // a natural max or 1 on a single d20 gets a word, like at the table
    const crit = d.n === 1 && d.sides === 20 ? (rolls[0] === 20 ? ` · ${fun.F('crit', lang)}` : rolls[0] === 1 ? ` · ${fun.F('fumble', lang)}` : '') : '';
    return fun.textCard(guild, lang, {
        color: 0x1D9E75, body: `### ${icon('dice', guild)} ${label} → **${total}**${crit}`,
        lines: [detail, fun.F('by', lang, { user: fun.safe(user.displayName || user.globalName || user.username, 40) })].filter(Boolean),
        again: ['roll', user.id, label, fun.F('rollAgain', lang)], priv,
    });
}

module.exports = {
    name: 'roll',
    aliases: ['dice'],
    description: 'Roll dice: 1d6, 2d6, 1d20, 3d8+2',
    category: 'FUN',
    cooldown: 1000,
    funMake,
    data: new SlashCommandBuilder().setName('roll').setDescription('Roll dice: 1d6, 2d6, 1d20, 3d8+2')
        .addStringOption((o) => o.setName('dice').setDescription('Like 2d6 or 1d20+3 (default 1d6)').setRequired(false).setMaxLength(15)),
    run: async (client, message, args) => {
        const lang = fun.langOf(client, message.guild?.id, message, message.author.id);
        const p = funMake(client, { guild: message.guild, user: message.author, lang, arg: args.join('') || '1d6' });
        return message.reply(p || { content: fun.F('rollBad', lang), allowedMentions: { parse: [] } }).catch(() => {});
    },
    execute: async (ix, client) => {
        const lang = fun.langOf(client, ix.guildId, ix, ix.user.id);
        const p = funMake(client, { guild: ix.guild, user: ix.user, lang, arg: ix.options.getString('dice') || '1d6' });
        return ix.reply(p || { content: fun.F('rollBad', lang), flags: 64 });
    },
};
