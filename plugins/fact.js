// plugins/fact.js — .fact: a random fun fact, translated into the reader's language when it isn't English
const fun = require('../lib/fun');
const { icon } = require('../lib/ui/icons');

async function funMake(client, { guild, user, lang, priv }) {
    const d = await fun.firstOf([async function uselessFacts() { return fun.getJSON('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en'); }], 'fact');
    const text = String(d?.text || '').trim();
    if (!text) return fun.failCard(lang, 'fact');
    const tr = await fun.translate(text, lang);
    const lines = [tr ? fun.F('translated', lang) : null, fun.F('source', lang, { source: 'uselessfacts.jsph.pl' })].filter(Boolean);
    return fun.textCard(guild, lang, { color: 0x378ADD, top: `${icon('info', guild)} ${fun.F('factTitle', lang)}`, body: `### ${fun.safe(tr || text, 600)}`, lines, again: ['fact', user.id], priv });
}

module.exports = {
    name: 'fact',
    aliases: ['facts', 'randomfact'],
    description: 'A random fun fact',
    category: 'FUN',
    cooldown: 2000,
    funMake,
    run: async (client, message) => {
        const lang = fun.langOf(client, message.guild?.id, message, message.author.id);
        return message.reply(await funMake(client, { guild: message.guild, user: message.author, lang })).catch(() => {});
    },
};
