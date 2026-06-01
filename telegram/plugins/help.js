// ═══════════════════════════════════════════
//  TG COMMAND: Help (with Buttons)
// ═══════════════════════════════════════════

const { ButtonBuilder, mainMenu, helpMenu } = require('./_buttons');

function escapeHTML(t) { return !t || typeof t !== 'string' ? '' : t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

module.exports = {
    name: 'help',
    description: 'Comprehensive help menu with buttons',
    category: 'System',
    usage: '/help [command]',
    aliases: ['h', 'menu', 'commands', 'cmd'],

    handler: async (ctx) => {
        const args = ctx.args;
        const bridge = ctx.bridge;

        // Detail for specific command
        if (args[0]) {
            const cmd = bridge.getCommand(args[0].toLowerCase());
            if (cmd) {
                const aliases = cmd.aliases?.length ? `\nAliases: ${cmd.aliases.map(a => `/${a}`).join(', ')}` : '';
                const msg = `📖 <b>/${cmd.name}</b>${aliases}\n━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `📋 ${escapeHTML(cmd.description)}\n` +
                    `📂 Category: ${cmd.category}\n` +
                    `📝 Usage: <code>${cmd.usage || `/${cmd.name}`}</code>\n` +
                    `${cmd.ownerOnly ? '🔒 Owner Only\n' : ''}${cmd.adminOnly ? '🛡️ Admin Only\n' : ''}`;
                return ctx.replyHTML(msg);
            }
            return ctx.replyHTML(`❌ Unknown: <code>/${escapeHTML(args[0])}</code>\nType <code>/help</code> for all commands.`);
        }

        // Main menu with buttons (like Group Help bot style)
        const msg = `🦅 <b>ARCHON CG-223</b>\n📍 BAMAKO_223 🇲🇱\n━━━━━━━━━━━━━━━━━━━━\n\n` +
            `Hi ${escapeHTML(ctx.username)}!\n\n` +
            `I'm your multi-purpose bot with <b>${bridge.commands.size}</b> commands:\n\n` +
            `🤖 <b>AI</b> · Lydia smart assistant\n` +
            `🎮 <b>Games</b> · Trivia, Word Guess, Dice\n` +
            `💰 <b>Economy</b> · Credits, daily rewards, shop\n` +
            `🛡️ <b>Moderation</b> · Mute, purge, warn, welcome\n` +
            `🛠️ <b>Utility</b> · Weather, crypto, translate\n` +
            `📺 <b>Media</b> · TikTok/Douyin downloader\n\n` +
            `Tap a button below or type <code>/help &lt;command&gt;</code>!`;

        await ctx.bridge.sendTo(ctx.chatId, msg, {
            parse_mode: 'HTML',
            extra: { reply_markup: mainMenu() }
        });
    }
};

// Handle help button callbacks
module.exports.handleCallback = async (ctx, data) => {
    if (data === 'menu_main') {
        await ctx.answerCallback('Main menu');
        module.exports.handler(ctx);
        return true;
    }
    if (data === 'cmd_menu' || data === 'cmd_help') {
        await ctx.answerCallback('Help categories');
        const bridge = ctx.bridge;

        const cats = new Map();
        for (const [name, cmd] of bridge.commands) {
            if (cmd.hidden) continue;
            if (!cats.has(cmd.category)) cats.set(cmd.category, []);
            cats.get(cmd.category).push(cmd);
        }

        let msg = `📖 <b>ALL COMMANDS</b>\n━━━━━━━━━━━━━━━━━━━━\n\n`;
        for (const [cat, cmds] of [...cats.entries()].sort()) {
            msg += `<b>${escapeHTML(cat)}</b>:\n`;
            cmds.sort((a, b) => a.name.localeCompare(b.name));
            for (const c of cmds) {
                msg += `  <code>/${c.name.padEnd(12)}</code> ${escapeHTML(c.description || '').substring(0, 28)}\n`;
            }
            msg += `\n`;
        }
        msg += `<i>Use /help &lt;command&gt; for details</i>`;

        await ctx.bridge.sendTo(ctx.chatId, msg, {
            parse_mode: 'HTML',
            extra: { reply_markup: helpMenu() }
        });
        return true;
    }
    if (data === 'cmd_games') {
        await ctx.answerCallback('Games menu');
        const bridge = ctx.bridge;
        const games = Array.from(bridge.commands.values()).filter(c => c.category === 'Games');
        let msg = `🎮 <b>GAMES</b>\n━━━━━━━━━━━━━━━━━━━━\n\n`;
        games.forEach(c => {
            msg += `  <code>/${c.name.padEnd(12)}</code> ${escapeHTML(c.description || '')}\n`;
        });
        await ctx.bridge.sendTo(ctx.chatId, msg, {
            parse_mode: 'HTML',
            extra: { reply_markup: require('./_buttons').gamesMenu() }
        });
        return true;
    }
    if (data === 'cmd_mod') {
        await ctx.answerCallback('Moderation');
        const bridge = ctx.bridge;
        const cmds = Array.from(bridge.commands.values()).filter(c => c.category === 'Moderation');
        let msg = `🛡️ <b>MODERATION</b>\n━━━━━━━━━━━━━━━━━━━━\n\n`;
        cmds.forEach(c => {
            msg += `  <code>/${c.name.padEnd(12)}</code> ${escapeHTML(c.description || '')}\n`;
        });
        await ctx.bridge.sendTo(ctx.chatId, msg, { parse_mode: 'HTML' });
        return true;
    }
    if (data === 'cmd_economy') {
        await ctx.answerCallback('Economy');
        const bridge = ctx.bridge;
        const cmds = Array.from(bridge.commands.values()).filter(c => c.category === 'Economy');
        let msg = `💰 <b>ECONOMY</b>\n━━━━━━━━━━━━━━━━━━━━\n\n`;
        cmds.forEach(c => {
            msg += `  <code>/${c.name.padEnd(12)}</code> ${escapeHTML(c.description || '')}\n`;
        });
        await ctx.bridge.sendTo(ctx.chatId, msg, { parse_mode: 'HTML' });
        return true;
    }
    if (data === 'cmd_utility') {
        await ctx.answerCallback('Utility');
        const bridge = ctx.bridge;
        const cmds = Array.from(bridge.commands.values()).filter(c => c.category === 'Utility');
        let msg = `🛠️ <b>UTILITY</b>\n━━━━━━━━━━━━━━━━━━━━\n\n`;
        cmds.forEach(c => {
            msg += `  <code>/${c.name.padEnd(12)}</code> ${escapeHTML(c.description || '')}\n`;
        });
        await ctx.bridge.sendTo(ctx.chatId, msg, { parse_mode: 'HTML' });
        return true;
    }
    // Help category buttons
    if (data.startsWith('help_')) {
        const cat = data.replace('help_', '').toLowerCase();
        const catMap = { system: 'System', economy: 'Economy', moderation: 'Moderation', games: 'Games', utility: 'Utility', ai: 'AI', media: 'Media' };
        const catName = catMap[cat];
        if (catName) {
            await ctx.answerCallback(catName + ' commands');
            const bridge = ctx.bridge;
            const cmds = Array.from(bridge.commands.values()).filter(c => c.category.toLowerCase() === catName.toLowerCase());
            let msg = `${escapeHTML(catName).toUpperCase()} <b>COMMANDS</b>\n━━━━━━━━━━━━━━━━━━━━\n\n`;
            cmds.forEach(c => {
                msg += `  <code>/${c.name.padEnd(12)}</code> ${escapeHTML(c.description || '')}\n`;
            });
            await ctx.bridge.sendTo(ctx.chatId, msg, { parse_mode: 'HTML' });
        }
        return true;
    }
    // Game callbacks
    if (data === 'game_trivia') {
        await ctx.answerCallback('Starting Trivia!');
        const trivia = require('./trivia');
        ctx.args = [];
        await trivia.handler(ctx);
        return true;
    }
    if (data === 'game_word') {
        await ctx.answerCallback('Starting Word Guess!');
        const wordguess = require('./wordguess');
        ctx.args = [];
        await wordguess.handler(ctx);
        return true;
    }
    if (data === 'game_roll') {
        await ctx.answerCallback('Rolling dice!');
        const roll = require('./roll');
        ctx.args = ['6'];
        await roll.handler(ctx);
        return true;
    }
    if (data === 'game_flip') {
        await ctx.answerCallback('Flipping coin!');
        const roll = require('./roll');
        // Simulate /flip by calling handler directly
        ctx.message.text = '/flip';
        ctx.args = [];
        await roll.handler(ctx);
        return true;
    }
    return false;
};
