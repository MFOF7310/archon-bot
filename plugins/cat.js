// plugins/cat.js — .cat: a random cat picture, with its breed when the source knows it (lib/fun cards)
const fun = require('../lib/fun');
const { icon } = require('../lib/ui/icons');

async function theCatApi() {
    const [c] = await fun.getJSON('https://api.thecatapi.com/v1/images/search?has_breeds=1&order=RAND&limit=1');
    if (!c?.url) return null;
    const b = c.breeds?.[0];
    return { url: c.url, breed: b?.name, origin: b?.origin, temperament: b?.temperament, source: 'thecatapi.com' };
}
async function cataas() {
    const d = await fun.getJSON('https://cataas.com/cat?json=true');
    const id = d?._id || d?.id;
    return id ? { url: `https://cataas.com/cat/${id}`, source: 'cataas.com' } : null;
}

async function funMake(client, { guild, user, lang, priv }) {
    const cat = await fun.firstOf([theCatApi, cataas], 'cat');
    if (!cat) return fun.failCard(lang, 'cat');
    const lines = [];
    if (cat.breed) lines.push(fun.F('breed', lang, { breed: fun.safe(cat.breed, 60) }) + (cat.origin ? ` · ${fun.safe(cat.origin, 40)}` : ''));
    if (cat.temperament) lines.push(fun.safe(cat.temperament, 120));
    lines.push(fun.F('source', lang, { source: cat.source }));
    return fun.imageCard(guild, lang, { color: 0xD85A30, title: `${icon('paw', guild)} ${fun.F('catTitle', lang)}`, image: cat.url, lines, again: ['cat', user.id], priv });
}

module.exports = {
    name: 'cat',
    aliases: ['chat', 'kitty', 'meow', 'kitten'],
    description: 'A random cat picture',
    category: 'FUN',
    cooldown: 2000,
    funMake,
    run: async (client, message) => {
        const lang = fun.langOf(client, message.guild?.id, message, message.author.id);
        return message.reply(await funMake(client, { guild: message.guild, user: message.author, lang })).catch(() => {});
    },
};
