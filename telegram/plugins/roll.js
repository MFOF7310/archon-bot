// /roll, /flip, /pick — dice, heads or tails, and a random choice. "Again" replays in the same message.
const { tr, esc } = require('../lang/play');
const { show } = require('../ui');

module.exports = {
    name: 'roll',
    description: 'Roll a die, flip a coin or pick at random',
    category: 'Fun',
    usage: '/roll 6 | /roll 1-100 | /flip | /pick a b c',
    aliases: ['dice', 'flip', 'coin', 'random', 'pick'],

    handler: async (ctx) => {
        const T = tr(ctx);
        const args = ctx.args || [];
        // Which word was used: from a button the message text is the menu, so the command name is passed along
        const used = String(ctx.calledAs || ctx.message?.text?.split(/\s/)[0]?.replace(/^\//, '').split('@')[0] || 'roll').toLowerCase();
        const again = (arg = '') => ({ inline_keyboard: [[{ text: T('b_again'), callback_data: `cmdx:${used}:${arg}`.slice(0, 64) }]] });

        if (used === 'flip' || used === 'coin') return show(ctx, Math.random() < 0.5 ? T('heads') : T('tails'), again());

        if (used === 'pick' || args.length > 1) {
            if (args.length < 2) return ctx.replyHTML(T('pick_help'));
            return ctx.replyHTML(T('picked', { x: args[Math.floor(Math.random() * args.length)] }));
        }

        const a0 = String(args[0] || '');
        const range = /^(-?\d+)-(-?\d+)$/.exec(a0);
        if (range && +range[2] > +range[1]) {
            const r = Math.floor(Math.random() * (range[2] - range[1] + 1)) + +range[1];
            return show(ctx, T('range', { r, a: range[1], b: range[2] }), again(a0));
        }
        const sides = Math.min(1000000, Math.max(2, parseInt(a0, 10) || 6));
        const count = Math.min(10, Math.max(1, parseInt(args[1], 10) || 1));
        const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
        if (count === 1) return show(ctx, T('rolled', { r: rolls[0], s: sides }), again(String(sides)));
        return ctx.replyHTML(T('rolled_many', { list_html: rolls.map((r) => `<b>${r}</b>`).join(' · '), t: rolls.reduce((x, y) => x + y, 0) }));
    },
};
