module.exports = {
    name: 'help',
    aliases: ['start', 'h', 'aide', 'commands'],
    handler: async (ctx) => {
        const args = ctx.args || [];
        const version = ctx.client?.version || '1.7.0';
        const cmdName = args[0]?.toLowerCase();
        const botUsername = ctx.client?.user?.username || 'Architect CG-223';
        const creator = '穆萨 (Moussa Fofana)';
        const telegramCreator = '@mfof7310';
        const githubRepo = 'github.com/MFOF7310';
        
        if (cmdName) {
            const cmdHelp = {
                'help': { desc: 'Show this help menu', usage: '/help [command]', example: '/help shop' },
                'alive': { desc: 'Check bot status', usage: '/alive', example: '/alive' },
                'balance': { desc: 'Check your credits', usage: '/balance', example: '/balance' },
                'shop': { desc: 'Browse marketplace', usage: '/shop', example: '/shop' },
                'profile': { desc: 'View your profile', usage: '/profile', example: '/profile' },
                'daily': { desc: 'Claim daily reward', usage: '/daily', example: '/daily' },
                'rank': { desc: 'Check your level', usage: '/rank', example: '/rank' },
                'lydia': { desc: 'Chat with AI', usage: '/lydia <message>', example: '/lydia Hello' }
            };
            
            const cmd = cmdHelp[cmdName];
            if (cmd) {
                await ctx.replyWithHTML(
                    `<b>📖 /${cmdName}</b>\n\n` +
                    `<b>Description:</b> ${cmd.desc}\n` +
                    `<b>Usage:</b> <code>${cmd.usage}</code>\n` +
                    `<b>Example:</b> <code>${cmd.example}</code>`
                );
            } else {
                await ctx.replyWithHTML(`❌ Unknown command: /${cmdName}\nType /help for all commands.`);
            }
            return;
        }
        
        const helpText = 
`<b>🤖 ${botUsername}</b>
📍 Node: BAMAKO_223 🇲🇱
📦 Version: v${version}
━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>👨‍💻 CREATOR</b>
• ${creator}
• Telegram: ${telegramCreator}
• GitHub: ${githubRepo}

<b>📋 GENERAL</b>
/help - Show this menu
/alive - System status
/ping - Check latency
/id - Get your IDs

<b>💰 ECONOMY</b>
/balance - Check credits
/shop - Browse marketplace
/daily - Claim daily reward
/inventory - Your items

<b>👤 PROFILE</b>
/profile - Your stats
/rank - Your level rank
/lb - Leaderboard

<b>🎬 DOWNLOADERS</b>
/douyin - Douyin videos
/tiktok - TikTok videos
/ig - Instagram reels
/x - Twitter/X videos

<b>🧠 AI</b>
/lydia - Chat with Lydia AI

<b>🎮 FUN</b>
/trivia - Play trivia quiz

━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 <i>Tip: Use /help [command] for details</i>
💡 <i>Type /creator for info about me</i>`;

        await ctx.replyWithHTML(helpText);
    }
};