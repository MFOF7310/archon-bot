const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'list',
    aliases: ['menu', 'commands', 'help2', 'cmds'],
    description: 'Browse all commands by category',
    category: 'System',
    usage: '/list [category]',

    handler: async (ctx) => {
        const filter = ctx.args[0]?.toLowerCase();
        const pluginsDir = path.join(__dirname);

        // Load all plugins dynamically
        const categories = new Map();
        const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js') && !f.startsWith('_') && f !== 'list.js');

        for (const file of files) {
            try {
                delete require.cache[require.resolve(path.join(pluginsDir, file))];
                const p = require(path.join(pluginsDir, file));
                if (!p.name || p.hidden) continue;
                const cat = (p.category || 'General').toUpperCase();
                if (!categories.has(cat)) categories.set(cat, []);
                categories.get(cat).push(p);
            } catch(e) {}
        }

        const CAT_EMOJI = {
            'MEDIA': '🎬', 'SYSTEM': '⚙️', 'MODERATION': '🛡️',
            'ECONOMY': '💰', 'GAMES': '🎮', 'UTILITY': '🛠️',
            'AI': '🤖', 'GENERAL': '📋', 'MUSIC': '🎵',
        };

        // Show specific category
        if (filter) {
            const catName = filter.toUpperCase();
            const found = [...categories.entries()].find(([k]) => k.toLowerCase().includes(filter));
            if (!found) return ctx.replyHTML(`❌ Category "${filter}" not found.\n\nUse /list to see all categories.`);

            const [cat, cmds] = found;
            const emoji = CAT_EMOJI[cat] || '📋';
            let msg = `${emoji} <b>${cat}</b> (${cmds.length} commands)\n━━━━━━━━━━━━━━━━\n\n`;
            
            cmds.forEach(cmd => {
                const aliases = cmd.aliases?.length ? ` · ${cmd.aliases.slice(0,2).map(a => `/${a}`).join(' ')}` : '';
                msg += `<code>/${cmd.name}</code>${aliases}\n`;
                if (cmd.description) msg += `  <i>${cmd.description.substring(0, 60)}</i>\n`;
                msg += '\n';
            });

            msg += `🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`;

            return ctx.bridge.sendTo(ctx.chatId, msg, {
                parse_mode: 'HTML',
                extra: {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '← All Categories', callback_data: 'list_main' }
                        ]]
                    }
                }
            });
        }

        // Show category overview with buttons
        const totalCmds = [...categories.values()].reduce((s, c) => s + c.length, 0);
        let msg = `🦅 <b>ARCHON CG-223</b>\n━━━━━━━━━━━━━━━━\n\n`;
        msg += `<b>${totalCmds} commands</b> across <b>${categories.size} categories</b>\n\n`;
        msg += `Tap a category to explore:\n\n`;
        msg += `🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`;

        // Build category buttons (2 per row)
        const sortedCats = [...categories.entries()].sort((a, b) => b[1].length - a[1].length);
        const rows = [];
        for (let i = 0; i < sortedCats.length; i += 2) {
            const row = [];
            const [cat1, cmds1] = sortedCats[i];
            const emoji1 = CAT_EMOJI[cat1] || '📋';
            row.push({ text: `${emoji1} ${cat1} (${cmds1.length})`, callback_data: `list_cat_${cat1.toLowerCase()}` });
            if (sortedCats[i+1]) {
                const [cat2, cmds2] = sortedCats[i+1];
                const emoji2 = CAT_EMOJI[cat2] || '📋';
                row.push({ text: `${emoji2} ${cat2} (${cmds2.length})`, callback_data: `list_cat_${cat2.toLowerCase()}` });
            }
            rows.push(row);
        }

        await ctx.bridge.sendTo(ctx.chatId, msg, {
            parse_mode: 'HTML',
            extra: { reply_markup: { inline_keyboard: rows } }
        });
    }
};
