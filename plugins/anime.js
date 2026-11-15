// plugins/anime.js — /anime [character]: summons a character card (picture from Jikan / MyAnimeList, a line, stats)
const { SlashCommandBuilder } = require('discord.js');
const fun = require('../lib/fun');
const axios = require('axios');

const ANIME_API = 'https://api.jikan.moe/v4';

const CHARACTERS = {
    'naruto': { 
        id: 17, 
        name: 'Naruto Uzumaki',
        series: 'Naruto', 
        emoji: '🍥',
        color: 0xFF8C00,
        quotes: [
            "I never go back on my word! That's my ninja way!",
            "Hard work is worthless for those that don't believe in themselves.",
            "If you don't like your destiny, don't accept it. Instead, have the courage to change it!",
            "When people are protecting something truly special to them, they truly can become as strong as they can be."
        ],
        funFact: '🍜 Loves ramen more than anything!',
        fallbackImage: 'https://static.wikia.nocookie.net/naruto/images/d/d6/Naruto_newshot.png'
    },
    'luffy': { 
        id: 40, 
        name: 'Monkey D. Luffy',
        series: 'One Piece', 
        emoji: '🏴‍☠️',
        color: 0xFF0000,
        quotes: [
            "I'm gonna be the King of the Pirates!",
            "I don't want to conquer anything. The person who is most free is the Pirate King!",
            "Power isn't determined by your size, but by the size of your heart and dreams!",
            "If you don't take risks, you can't create a future!"
        ],
        funFact: '🍖 Can eat his body weight in meat!',
        fallbackImage: 'https://static.wikia.nocookie.net/onepiece/images/6/6d/Monkey_D._Luffy_Anime_Post_Timeskip_Infobox.png'
    },
    'goku': { 
        id: 214, 
        name: 'Goku',
        series: 'Dragon Ball', 
        emoji: '💪',
        color: 0xFFA500,
        quotes: [
            "I am the hope of the universe. I am the answer to all living things that cry out for peace.",
            "Power comes in response to a need, not a desire.",
            "I'd rather be a brainless monkey than a heartless monster!",
            "You can't control your fear. It comes from the heart."
        ],
        funFact: '🍚 Can eat 50 bowls of rice in one sitting!',
        fallbackImage: 'https://static.wikia.nocookie.net/dragonball/images/5/5b/Goku_Dragon_Ball_Super.png'
    },
    'levi': { 
        id: 45627, 
        name: 'Levi Ackerman',
        series: 'Attack on Titan', 
        emoji: '⚔️',
        color: 0x4B5320,
        quotes: [
            "Give up on your dreams and die.",
            "The only thing we're allowed to do is believe that we won't regret the choice we made.",
            "No one knows what the outcome will be. So, as much as you can, choose whatever you'll regret the least.",
            "I choose the hell of humans fighting until they die."
        ],
        funFact: '🧹 Obsessed with cleaning and hates dirt!',
        fallbackImage: 'https://static.wikia.nocookie.net/shingekinokyojin/images/0/0d/Levi_character_image.png'
    },
    'tanjiro': { 
        id: 164533, 
        name: 'Tanjiro Kamado',
        series: 'Demon Slayer', 
        emoji: '🌊',
        color: 0x00BFFF,
        quotes: [
            "No matter how many people you may lose, you have no choice but to go on living.",
            "The strong should aid and protect the weak. That is the natural order of things.",
            "I will never give up! No matter what happens, I will never give up!",
            "Protect the people you love, protect the weak."
        ],
        funFact: '👃 Has an incredibly sensitive nose!',
        fallbackImage: 'https://static.wikia.nocookie.net/kimetsu-no-yaiba/images/7/74/Tanjiro_Anime.png'
    },
    'gojo': { 
        id: 127691, 
        name: 'Satoru Gojo',
        series: 'Jujutsu Kaisen', 
        emoji: '👁️',
        color: 0x6A5ACD,
        quotes: [
            "Throughout Heaven and Earth, I alone am the honored one.",
            "Don't worry. I'm the strongest.",
            "Love is the most twisted curse of all.",
            "It's not about whether I can. I just do it."
        ],
        funFact: '🕶️ Wears a blindfold to control his immense power!',
        fallbackImage: 'https://static.wikia.nocookie.net/jujutsu-kaisen/images/0/0f/Satoru_Gojo_anime.png'
    },
    'deku': { 
        id: 133676, 
        name: 'Izuku Midoriya',
        series: 'My Hero Academia', 
        emoji: '💥',
        color: 0x00FF00,
        quotes: [
            "A hero is someone who can smile even when they're in trouble.",
            "I'm not gonna be the weak, useless Deku anymore!",
            "Sometimes I do feel like I'm a failure. Like there's no hope for me. But even so, I'm not gonna give up. Ever!",
            "I have to work harder than anyone else to make it!"
        ],
        funFact: '📓 Mutters analysis of heroes in his notebook!',
        fallbackImage: 'https://static.wikia.nocookie.net/bokunoheroacademia/images/5/59/Izuku_Midoriya_anime.png'
    },
    'light': { 
        id: 80, 
        name: 'Light Yagami',
        series: 'Death Note', 
        emoji: '📓',
        color: 0x8B0000,
        quotes: [
            "I am Justice!",
            "I'll take a potato chip... and EAT IT!",
            "In this world, there are very few people who actually trust each other.",
            "I am the god of this new world!"
        ],
        funFact: '✍️ Can write names at incredible speed!',
        fallbackImage: 'https://static.wikia.nocookie.net/deathnote/images/1/1c/Light_Yagami_anime.png'
    },
};

async function fetchCharacterImage(charData) {
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const res = await axios.get(`${ANIME_API}/characters/${charData.id}`, {
                timeout: 3000
            });
            if (res.status === 429) {
                await new Promise(r => setTimeout(r, 1000 * attempt));
                continue;
            }
            const url = res.data?.data?.images?.jpg?.image_url;
            if (url) return url;
        } catch (err) {
            if (attempt === 2) console.error(`[ANIME] Jikan unavailable for ${charData.name}: ${err.message}`);
        }
    }
    if (charData.fallbackImage) {
        console.log(`[ANIME] Using fallback image for ${charData.name}`);
        return charData.fallbackImage;
    }
    return null;
}

// The character card (lib/fun): picture, series, a line they're known for, playful stats
async function funMake(client, { guild, user, lang, arg, priv }) {
    const keys = Object.keys(CHARACTERS);
    let key = arg && CHARACTERS[arg] ? arg : fun.pick(keys);
    if (!arg && keys.length > 1 && key === funMake.last) key = keys[(keys.indexOf(key) + 1) % keys.length];
    funMake.last = key;
    const c = CHARACTERS[key];
    const image = await fetchCharacterImage(c);
    const stat = (name, min) => { const v = min + Math.floor(Math.random() * (101 - min)); return `${fun.F(name, lang)} \`${'▰'.repeat(Math.round(v / 10))}${'▱'.repeat(10 - Math.round(v / 10))}\` ${v}%`; };
    const stars = '⭐'.repeat(4 + Math.floor(Math.random() * 2));
    const head = `-# ${fun.F('summonedBy', lang, { user: fun.safe(user.displayName || user.globalName || user.username, 40) })}\n### ${c.emoji} ${c.name}\n${fun.F('series', lang, { series: c.series })} · ${stars}\n*« ${fun.pick(c.quotes)} »*`;
    const items = [image ? { thumbnail: [head, image] } : { text: head }];
    items.push({ rule: true }, { text: [stat('power', 70), stat('speed', 60), stat('wisdom', 50), `-# ${c.funFact}`].join('\n') });
    const row = fun.buttons(guild, lang, { again: ['anime', user.id, null, fun.F('summonAgain', lang)], priv });
    if (row) items.push({ row });
    return require('../lib/games/v2').card(c.color, items);
}

module.exports = {
    name: 'anime',
    aliases: ['animechar', 'character', 'summon'],
    description: 'Summon an anime character card',
    category: 'FUN',
    cooldown: 5000,
    funMake,
    data: new SlashCommandBuilder()
        .setName('anime')
        .setDescription('Summon an anime character card')
        .addStringOption((o) => o.setName('character').setDescription('A character (default: random)').setRequired(false)
            .addChoices(...Object.entries(CHARACTERS).map(([value, c]) => ({ name: `${c.emoji} ${c.name}`.slice(0, 100), value })))),
    run: async (client, message, args) => {
        const lang = fun.langOf(client, message.guild?.id, message, message.author.id);
        const pick = String(args[0] || '').toLowerCase();
        return message.reply(await funMake(client, { guild: message.guild, user: message.author, lang, arg: CHARACTERS[pick] ? pick : null })).catch(() => {});
    },
    execute: async (ix, client) => {
        const lang = fun.langOf(client, ix.guildId, ix, ix.user.id);
        await ix.deferReply();
        return ix.editReply(await funMake(client, { guild: ix.guild, user: ix.user, lang, arg: ix.options.getString('character') }));
    },
};
