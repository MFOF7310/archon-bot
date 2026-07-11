const { ButtonBuilder, mainMenu } = require('./_buttons');

function escapeHTML(t) { return !t || typeof t !== 'string' ? '' : t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

module.exports = {
    name: 'help',
    description: 'Full command guide with categories',
    category: 'System',
    usage: '/help [command]',
    aliases: ['h', 'menu', 'commands', 'cmd'],

    handler: async (ctx) => {
        const args = ctx.args;
        const bridge = ctx.bridge;

        // Specific command detail
        if (args[0]) {
            const cmd = bridge.getCommand(args[0].toLowerCase());
            if (cmd) {
                const aliases = cmd.aliases?.length ? `\nAliases: ${cmd.aliases.map(a => `/${a}`).join(', ')}` : '';
                const msg =
                    `📖 <b>/${cmd.name}</b>${aliases}\n━━━━━━━━━━━━━━━━\n\n` +
                    `📋 ${escapeHTML(cmd.description)}\n` +
                    `📂 Category: ${cmd.category}\n` +
                    `📝 Usage: <code>${cmd.usage || `/${cmd.name}`}</code>\n` +
                    `${cmd.ownerOnly ? '🔒 Owner Only\n' : ''}` +
                    `${cmd.adminOnly ? '🛡️ Admin Only\n' : ''}`;
                return ctx.replyHTML(msg);
            }
            return ctx.replyHTML(`❌ Unknown command: <code>/${escapeHTML(args[0])}</code>\n\nType /help to see all commands.`);
        }

        // Main help menu
        const totalCmds = bridge.commands.size;
        const msg =
            `🦅 <b>ARCHON CG-223</b>\n` +
            `📍 BAMAKO_223 🇲🇱\n━━━━━━━━━━━━━━━━\n\n` +
            `Hey ${escapeHTML(ctx.username)}! 👋\n\n` +
            `I'm your all-in-one bot with <b>${totalCmds} commands</b>.\n` +
            `Tap a category below to explore:\n\n` +
            `🤖 <b>AI</b> — Lydia smart assistant\n` +
            `🎮 <b>Games</b> — Trivia, Word Guess, Dice\n` +
            `💰 <b>Economy</b> — Credits, daily rewards\n` +
            `🛡️ <b>Moderation</b> — Kick, ban, welcome\n` +
            `🛠️ <b>Utility</b> — Weather, translate, ping\n` +
            `🎬 <b>Media</b> — YouTube, IG, TW, Snap\n\n` +
            `💡 <code>/help &lt;command&gt;</code> for details\n` +
            `💡 <code>/list</code> for full command browser\n\n` +
            `🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`;

        await ctx.bridge.sendTo(ctx.chatId, msg, {
            parse_mode: 'HTML',
            extra: { reply_markup: mainMenu() }
        });
    }
};
