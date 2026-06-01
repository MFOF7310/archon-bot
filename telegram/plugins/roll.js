// ═══════════════════════════════════════════
//  TG COMMAND: Roll / Dice / Random (NEW)
// ═══════════════════════════════════════════

module.exports = {
    name: 'roll',
    description: 'Roll dice, flip coins, pick random',
    category: 'Fun',
    usage: '/roll 6 | /roll 1-100 | /flip | /pick a b c',
    aliases: ['dice', 'flip', 'coin', 'random'],

    handler: async (ctx) => {
        const args = ctx.args;
        const cmd = ctx.message.text?.split(' ')[0]?.toLowerCase() || '/roll';

        // Coin flip
        if (cmd === '/flip' || cmd === '/coin') {
            const result = Math.random() < 0.5 ? 'HEADS' : 'TAILS';
            const emoji = result === 'HEADS' ? '👤' : '🦅';
            return ctx.replyHTML(`🪙 <b>COIN FLIP</b>\n\n${emoji} <b>${result}</b>!`);
        }

        // Pick from list
        if (cmd === '/pick' || args.length > 1) {
            if (args.length >= 2) {
                const choice = args[Math.floor(Math.random() * args.length)];
                return ctx.replyHTML(`🎯 <b>I CHOOSE:</b>\n\n${choice}`);
            }
            return ctx.replyHTML(`🎯 <b>Pick</b>\n\n<code>/pick pizza burger sushi</code>`);
        }

        // Dice roll
        let sides = 6, count = 1;
        if (args[0]) {
            if (args[0].includes('-')) {
                const [min, max] = args[0].split('-').map(Number);
                if (!isNaN(min) && !isNaN(max) && max > min) {
                    const result = Math.floor(Math.random() * (max - min + 1)) + min;
                    return ctx.replyHTML(`🎲 <b>RANDOM</b>\n\n${min}-${max} → <b>${result}</b>`);
                }
            }
            sides = parseInt(args[0]) || 6;
            if (sides < 2) sides = 6;
            if (sides > 1000000) sides = 1000000;
        }
        if (args[1]) count = Math.min(parseInt(args[1]) || 1, 10);

        let total = 0, results = [];
        for (let i = 0; i < count; i++) {
            const r = Math.floor(Math.random() * sides) + 1;
            results.push(r); total += r;
        }

        let msg = `🎲 <b>ROLL${count > 1 ? 'S' : ''}</b>\n━━━━━━━━━━━━━━━━━━━━\n\n`;
        if (count === 1) {
            msg += `d${sides} → <b>${results[0]}</b>`;
        } else {
            msg += `${count}d${sides}:\n`;
            results.forEach((r, i) => msg += `  Roll ${i + 1}: <b>${r}</b>\n`);
            msg += `\nTotal: <b>${total}</b>`;
        }
        ctx.replyHTML(msg);
    }
};
