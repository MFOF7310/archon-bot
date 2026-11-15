// plugins/dadjoke.js — .joke: a random dad joke. Jokes are puns in English: the translation is shown with the
// original under it, so the pun isn't lost.
const fun = require('../lib/fun');

async function funMake(client, { guild, user, lang, priv }) {
    const d = await fun.firstOf([async function icanhazdadjoke() { return fun.getJSON('https://icanhazdadjoke.com/'); }], 'joke');
    const joke = String(d?.joke || '').trim();
    if (!joke) return fun.failCard(lang, 'joke');
    const tr = await fun.translate(joke, lang);
    const lines = [tr ? fun.F('original', lang, { text: fun.safe(joke, 300) }) : null, fun.F('source', lang, { source: 'icanhazdadjoke.com' })].filter(Boolean);
    return fun.textCard(guild, lang, { color: 0xEF9F27, top: `😂 ${fun.F('jokeTitle', lang)}`, body: `### ${fun.safe(tr || joke, 500)}`, lines, again: ['joke', user.id], priv });
}

module.exports = {
    name: 'dadjoke',
    aliases: ['joke', 'dad'],
    description: 'A random dad joke',
    category: 'FUN',
    cooldown: 2000,
    funMake,
    run: async (client, message) => {
        const lang = fun.langOf(client, message.guild?.id, message, message.author.id);
        return message.reply(await funMake(client, { guild: message.guild, user: message.author, lang })).catch(() => {});
    },
};
