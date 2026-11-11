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
                    { text: '🎮 Play Trivia!', url: 'https://bamako-steel-dev.xyz/games/trivia.html' }
                ]]
            }
        });

        if (!result.ok) {
            const T = require('../lang/play').tr(ctx);
            return ctx.replyHTML(T('web_game'), { extra: { reply_markup: { inline_keyboard: [[{ text: T('b_play'), url: 'https://bamako-steel-dev.xyz/games/trivia.html' }]] } } });
        }
    }
};
