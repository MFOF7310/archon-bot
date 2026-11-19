// plugins/car.js — /car: a random car picture from a curated set (lib/fun cards).
// The old fallback (source.unsplash.com) was shut down by Unsplash; these direct images are permanent.
const { SlashCommandBuilder } = require('discord.js');
const fun = require('../lib/fun');
const { icon } = require('../lib/ui/icons');

const CARS = [
    ['1503376780353-7e6692767b70', 'Porsche'], ['1552519507-da3b142c6e3d', 'Ford GT'], ['1580273916550-e323be2ae537', 'Lamborghini'],
    ['1549317661-bd32c8ce0db2', 'Ferrari'], ['1568605117036-5fe5e7fa0ac7', 'Audi R8'], ['1614200187524-dc4b892acf16', 'McLaren'],
    ['1533473359331-0135ef1b58bf', 'Mercedes-AMG'], ['1542362567-b07e54358753', 'BMW M4'], ['1603584173870-7e0443fc6b6c', 'Bugatti'],
    ['1621135802920-133df287f89c', 'Nissan GT-R'], ['1572197505605-d0fd6b0af82b', 'Chevrolet Corvette'], ['1511919884226-fd3cad34687c', 'Ford Mustang (classic)'],
    ['1567808291548-fc3ee04dbcf0', 'Tesla'], ['1580274455191-1c62238fa333', 'Porsche 911'], ['1605559424843-9e4c228bf1c2', 'Lexus LC'],
    ['1568402105612-6a82a9d7a5f9', 'Jaguar'], ['1581540222194-0def2dda95b8', 'Aston Martin'], ['1627462450295-ff5ab21339c2', 'Dodge Challenger'],
    ['1573213083431-ef52c6fea96a', 'Rolls-Royce'], ['1602584383687-1c2dae162c4a', 'Koenigsegg'],
];

async function funMake(client, { guild, user, lang, arg, priv }) {
    // never the same car twice in a row: the last one shown travels in the button
    const last = Number(arg);
    let i = Math.floor(Math.random() * CARS.length);
    if (i === last) i = (i + 1) % CARS.length;
    const [id, name] = CARS[i];
    return fun.imageCard(guild, lang, {
        color: 0x378ADD, title: `${icon('car', guild)} ${name}`,
        image: `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&h=675&q=80`,
        lines: [fun.F('source', lang, { source: 'Unsplash' })], again: ['car', user.id, String(i)], priv,
    });
}

module.exports = {
    name: 'car',
    userApp: true,   // also works as a user app (DMs, servers without ARCHON): lib/slash-payload.js
    aliases: ['cars', 'voiture', 'auto', 'vehicle', 'automobile'],
    description: 'A random car picture',
    category: 'FUN',
    cooldown: 3000,
    funMake,
    data: new SlashCommandBuilder().setName('car').setDescription('A random car picture'),
    run: async (client, message) => {
        const lang = fun.langOf(client, message.guild?.id, message, message.author.id);
        return message.reply(await funMake(client, { guild: message.guild, user: message.author, lang })).catch(() => {});
    },
    execute: async (ix, client) => {
        const lang = fun.langOf(client, ix.guildId, ix, ix.user.id);
        return ix.reply(await funMake(client, { guild: ix.guild, user: ix.user, lang }));
    },
};
