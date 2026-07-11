const https = require('https');

function tgApi(token, method, params) {
    return new Promise((res) => {
        const body = JSON.stringify(params);
        const req = https.request(`https://api.telegram.org/bot${token}/${method}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 10000 },
            (r) => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>{ try{res(JSON.parse(d));}catch{res({ok:false});} }); }
        );
        req.on('error',()=>res({ok:false})); req.write(body); req.end();
    });
}

module.exports = {
    name: 'tgame',
    aliases: ['game', 'playgame', 'htmlgame'],
    description: 'Play ARCHON HTML5 Trivia Game',
    category: 'Games',
    usage: '/tgame',

    handler: async (ctx) => {
        // Send the HTML5 game
        const result = await tgApi(ctx.bridge.token, 'sendGame', {
            chat_id: ctx.chatId,
            game_short_name: 'archontrivia',
            reply_markup: {
                inline_keyboard: [[
                    { text: '🎮 Play Trivia!', callback_game: {} }
                ]]
            }
        });

        if (!result.ok) {
            return ctx.replyHTML(
                '🎮 <b>ARCHON Trivia</b>\n\n' +
                'Play our trivia game in your browser!\n\n' +
                '<a href="https://bamako-steel-dev.xyz/games/trivia.html">▶️ Play Now</a>\n\n' +
                '🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱'
            );
        }
    }
};
