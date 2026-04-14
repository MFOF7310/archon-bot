// ================= TELEGRAM GUARDIAN WELCOME v1.7.0 =================
const https = require('https');

module.exports = {
    name: 'welcome',
    aliases: ['start', 'hi', 'hello', 'begin'],
    handler: async (ctx) => {
        const chatId = ctx.chatId;
        const userId = ctx.userId;
        const username = ctx.username;
        const client = ctx.client;
        const version = client.version || '1.7.0';
        const botName = client.user?.username || 'Architect CG-223';
        const firstName = ctx.message?.from?.first_name || username;
        
        // Get chat info
        let chatTitle = 'Elite Friends';
        try {
            const token = ctx.token;
            const chatInfo = await getChatInfo(token, chatId);
            if (chatInfo) chatTitle = chatInfo.title || chatTitle;
        } catch (e) {}
        
        // Time-based greeting
        const hour = new Date().getHours();
        let timeGreeting, timeEmoji;
        
        if (hour < 5) { timeGreeting = 'Late night'; timeEmoji = '🌙'; }
        else if (hour < 12) { timeGreeting = 'Good morning'; timeEmoji = '🌅'; }
        else if (hour < 17) { timeGreeting = 'Good afternoon'; timeEmoji = '☀️'; }
        else if (hour < 21) { timeGreeting = 'Good evening'; timeEmoji = '🌆'; }
        else { timeGreeting = 'Good night'; timeEmoji = '🌙'; }
        
        // Dynamic welcome messages
        const welcomes = [
            'The Guardian has arrived. Signal locked.',
            'Neural handshake complete. I\'m online.',
            'Bamako Node connected. Bandwidth secured.',
            'Grid integrity confirmed. I\'m watching.',
            'Encrypted and ready. Elite status verified.'
        ];
        const randomWelcome = welcomes[Math.floor(Math.random() * welcomes.length)];
        
        const welcomeMessage = 
`╔══════════════════════════════════════════════════════════╗
║                                                          ║
║                  🦅 GUARDIAN ONLINE 🦅                    ║
║                                                          ║
║         ╔═══════════════════════════════════════╗        ║
║         ║                                       ║        ║
║         ║    ${timeEmoji} ${timeGreeting}, ${firstName}!    ║
║         ║                                       ║        ║
║         ║    I am <b>${botName}</b>               ║
║         ║    Guardian of <b>${chatTitle}</b>       ║
║         ║                                       ║        ║
║         ╚═══════════════════════════════════════╝        ║
║                                                          ║
║         📍 <b>NODE:</b> BAMAKO_223 🇲🇱                           ║
║         📦 <b>VERSION:</b> v${version}                              ║
║                                                          ║
║         <i>${randomWelcome}</i>                           ║
║                                                          ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║         📋 <b>QUICK COMMANDS</b>                                ║
║                                                          ║
║         /help      • Full command directory              ║
║         /lydia     • Chat with the Guardian              ║
║         /profile   • Your stats                          ║
║         /invest    • Bamako Market                       ║
║         /shop      • Browse marketplace                  ║
║                                                          ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║         💡 <b>PRO TIP:</b>                                       ║
║         ${getRandomTip()}                                 ║
║                                                          ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║         🔗 <b>CONNECTIONS</b>                                   ║
║         • Discord: discord.gg/eagle                      ║
║         • GitHub: github.com/MFOF7310                    ║
║         • Telegram: @mfof7310                            ║
║                                                          ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║         🦅 <i>Forged in Bamako. Powered by Neural Grid.</i>    ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝`;

        await ctx.replyWithHTML(welcomeMessage);
        
        // Send follow-up after 1 second
        setTimeout(async () => {
            const followUps = [
                `🦅 Ready when you are, ${firstName}.`,
                `⚡ Neural pathways primed. What's on your mind?`,
                `🇲🇱 Bamako Node standing by.`,
                `🛡️ Grid secured. You're clear to proceed.`,
                `💬 Just say my name or /lydia to chat.`
            ];
            const randomFollowUp = followUps[Math.floor(Math.random() * followUps.length)];
            
            try {
                await ctx.replyWithHTML(`<i>${randomFollowUp}</i>`);
            } catch (e) {}
        }, 1000);
    }
};

// Get chat info
function getChatInfo(token, chatId) {
    return new Promise((resolve) => {
        const req = https.request({
            hostname: 'api.telegram.org',
            path: `/bot${token}/getChat?chat_id=${chatId}`,
            method: 'GET'
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.ok) resolve(json.result);
                    else resolve(null);
                } catch (e) { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.end();
    });
}

// Random tips
function getRandomTip() {
    const tips = [
        'Use /lydia on to make me auto-reply when mentioned!',
        'Check your rank with /rank and climb the leaderboard!',
        'Claim daily rewards with /daily - don\'t break your streak!',
        'Play /trivia or /wordguess to earn XP and credits!',
        'Use /ig or /tt to download videos without watermark!',
        'Type /lydia model list to switch between 5 AI models!',
        'Link your Discord account with /link for cross-platform progress!',
        'Check the Bamako Market with /invest status!'
    ];
    return tips[Math.floor(Math.random() * tips.length)];
}