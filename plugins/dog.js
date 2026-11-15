// plugins/dog.js — .dog: a random dog picture, with its breed when the source knows it (lib/fun cards)
const fun = require('../lib/fun');
const { icon } = require('../lib/ui/icons');

async function theDogApi() {
    const [d] = await fun.getJSON('https://api.thedogapi.com/v1/images/search?has_breeds=1&order=RAND&limit=1');
    if (!d?.url) return null;
    const b = d.breeds?.[0];
    return { url: d.url, breed: b?.name, group: b?.breed_group, temperament: b?.temperament, source: 'thedogapi.com' };
}
async function dogCeo() {
    const d = await fun.getJSON('https://dog.ceo/api/breeds/image/random');
    if (d?.status !== 'success' || !d.message) return null;
    const m = /\/breeds\/([^/]+)\//.exec(d.message);   // "hound-afghan" → "Afghan hound"
    const breed = m ? m[1].split('-').reverse().join(' ').replace(/^\w/, (c) => c.toUpperCase()) : null;
    return { url: d.message, breed, source: 'dog.ceo' };
}
async function randomDog() {
    const d = await fun.getJSON('https://random.dog/woof.json');
    return d?.url && /\.(jpe?g|png|gif|webp)$/i.test(d.url) ? { url: d.url, source: 'random.dog' } : null;   // skips videos
}

async function funMake(client, { guild, user, lang, priv }) {
    const dog = await fun.firstOf([theDogApi, dogCeo, randomDog], 'dog');
    if (!dog) return fun.failCard(lang, 'dog');
    const lines = [];
    if (dog.breed) lines.push(fun.F('breed', lang, { breed: fun.safe(dog.breed, 60) }) + (dog.group ? ` · ${fun.safe(dog.group, 40)}` : ''));
    if (dog.temperament) lines.push(fun.safe(dog.temperament, 120));
    lines.push(fun.F('source', lang, { source: dog.source }));
    return fun.imageCard(guild, lang, { color: 0xBA7517, title: `${icon('paw', guild)} ${fun.F('dogTitle', lang)}`, image: dog.url, lines, again: ['dog', user.id], priv });
}

module.exports = {
    name: 'dog',
    aliases: ['doggo', 'puppy', 'woof', 'pupper'],
    description: 'A random dog picture',
    category: 'FUN',
    cooldown: 2000,
    funMake,
    run: async (client, message) => {
        const lang = fun.langOf(client, message.guild?.id, message, message.author.id);
        return message.reply(await funMake(client, { guild: message.guild, user: message.author, lang })).catch(() => {});
    },
};
