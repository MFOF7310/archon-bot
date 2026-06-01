// ═══════════════════════════════════════════
//  TG COMMAND: Jokes (NEW)
// ═══════════════════════════════════════════

const https = require('https');
function escapeHTML(t) { return !t || typeof t !== 'string' ? '' : t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

const JOKES = [
    "Why do programmers prefer dark mode? Because light attracts bugs! 🐛",
    "Why did the developer go broke? Because he used up all his cache! 💰",
    "How many programmers to change a light bulb? None, that's hardware! 💡",
    "Why do Java developers wear glasses? Because they can't C#! 👓",
    "What's a programmer's favorite hangout? Foo Bar! 🍺",
    "What do you call 8 hobbits? A hobbyte! 🧙",
    "Why was the function sad? It didn't get any calls! 📞",
    "What's the OO way to become wealthy? Inheritance! 💎",
    "Why did the programmer quit? He didn't get arrays! 📊",
    "What's a computer's favorite snack? Microchips! 🍟",
    "Why don't robots get scared? Nerves of steel! 🤖",
    "What's a pirate's favorite language? R! 🏴‍☠️",
    "Why did the DBA leave his wife? One-to-many relationships! 💔",
    "Why don't scientists trust atoms? They make up everything! ⚛️",
    "Why did the scarecrow win an award? Outstanding in his field! 🌾",
    "What do you call a fake noodle? An impasta! 🍝",
    "Why was the math book sad? Too many problems! 📐",
    "What's orange and sounds like a parrot? A carrot! 🥕",
];

module.exports = {
    name: 'joke',
    description: 'Get a random joke',
    category: 'Fun',
    usage: '/joke [programming]',
    aliases: ['jokes', 'funny', 'lol'],

    handler: async (ctx) => {
        const type = ctx.args[0]?.toLowerCase() || '';

        if (type === 'programming' || type === 'dev') {
            const devJokes = JOKES.filter(j => /programmer|code|developer|python|java|database|function|bug|api/i.test(j));
            const joke = devJokes[Math.floor(Math.random() * devJokes.length)] || JOKES[0];
            return ctx.replyHTML(`💻 <b>Dev Joke</b>\n\n${escapeHTML(joke)}`);
        }

        try {
            const data = await requestJSON('https://official-joke-api.appspot.com/random_joke', { timeout: 5000 });
            if (data?.setup && data?.punchline) {
                return ctx.replyHTML(`😂 <b>Joke</b>\n\n${escapeHTML(data.setup)}\n\n${escapeHTML(data.punchline)}`);
            }
        } catch { /* fallback */ }

        const joke = JOKES[Math.floor(Math.random() * JOKES.length)];
        ctx.replyHTML(`😂 <b>Joke</b>\n\n${escapeHTML(joke)}`);
    }
};

function requestJSON(url, opts = {}) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https:') ? https : require('http');
        const req = lib.request(url, { method: 'GET', headers: opts.headers || {}, timeout: opts.timeout || 5000 }, (res) => {
            let d = ''; res.on('data', c => d += c);
            res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        req.end();
    });
}
