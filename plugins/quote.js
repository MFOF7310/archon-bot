// /quote [category] — a quote as a fun-pack card (lib/fun): the same look and buttons as /car or /meme.
// The quotes are in English; in another language the card shows a translation (MyMemory, like /translate) with the
// original underneath. Quotes widely credited to someone who probably never said them are marked "attributed to".
// The old "sources" (books, speeches, years) were not checked and are gone.
const { SlashCommandBuilder } = require('discord.js');
const fun = require('../lib/fun');

// ================= HAND-CURATED SFW QUOTE DATABASE =================
// All quotes are inspirational, motivational, philosophical — strictly SFW
const QUOTES = {
    motivation: [
        { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
        { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
        { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill", attributed: true },
        { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
        { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
        { text: "The only limit to our realization of tomorrow will be our doubts of today.", author: "Franklin D. Roosevelt" },
        { text: "Everything you've ever wanted is on the other side of fear.", author: "George Addair" },
        { text: "Opportunities don't happen. You create them.", author: "Chris Grosser" },
        { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
        { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
        { text: "Your time is limited, don't waste it living someone else's life.", author: "Steve Jobs" },
        { text: "If you can dream it, you can do it.", author: "Walt Disney", attributed: true },
        { text: "Don't be pushed around by the fears in your mind. Be led by the dreams in your heart.", author: "Roy T. Bennett" },
        { text: "Wake up with determination. Go to bed with satisfaction.", author: "George Lorimer" },
        { text: "The harder you work for something, the greater you'll feel when you achieve it.", author: "Unknown" },
    ],
    wisdom: [
        { text: "Knowing yourself is the beginning of all wisdom.", author: "Aristotle" },
        { text: "The unexamined life is not worth living.", author: "Socrates" },
        { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
        { text: "The mind is everything. What you think you become.", author: "Buddha" },
        { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle" },
        { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
        { text: "Wisdom is not a product of schooling but of the lifelong attempt to acquire it.", author: "Albert Einstein" },
        { text: "He who has a why to live can bear almost any how.", author: "Friedrich Nietzsche" },
        { text: "The only true wisdom is in knowing you know nothing.", author: "Socrates" },
        { text: "Life is really simple, but we insist on making it complicated.", author: "Confucius" },
        { text: "It is not that I'm so smart, it is just that I stay with problems longer.", author: "Albert Einstein" },
        { text: "The obstacle is the way.", author: "Marcus Aurelius", attributed: true },
        { text: "Do not dwell in the past, do not dream of the future, concentrate the mind on the present moment.", author: "Buddha" },
        { text: "Not everything that is faced can be changed, but nothing can be changed until it is faced.", author: "James Baldwin" },
        { text: "The journey of a thousand miles begins with one step.", author: "Lao Tzu" },
    ],
    success: [
        { text: "Success usually comes to those who are too busy to be looking for it.", author: "Henry David Thoreau" },
        { text: "I find that the harder I work, the more luck I seem to have.", author: "Thomas Jefferson", attributed: true },
        { text: "Don't be afraid to give up the good to go for the great.", author: "John D. Rockefeller" },
        { text: "I never dreamed about success, I worked for it.", author: "Estee Lauder" },
        { text: "The secret of success is to do the common thing uncommonly well.", author: "John D. Rockefeller Jr." },
        { text: "Success is walking from failure to failure with no loss of enthusiasm.", author: "Winston Churchill" },
        { text: "The only place where success comes before work is in the dictionary.", author: "Vidal Sassoon" },
        { text: "If you really look closely, most overnight successes took a long time.", author: "Steve Jobs" },
        { text: "The real test is not whether you avoid this failure, because you won't. It's whether you let it harden or shame you into inaction.", author: "Barack Obama" },
        { text: "I've failed over and over and over again in my life. And that is why I succeed.", author: "Michael Jordan" },
        { text: "Fall seven times, stand up eight.", author: "Japanese Proverb" },
        { text: "The difference between successful people and really successful people is that really successful people say no to almost everything.", author: "Warren Buffett" },
        { text: "I attribute my success to this: I never gave or took any excuse.", author: "Florence Nightingale" },
        { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
        { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
    ],
    leadership: [
        { text: "A leader is one who knows the way, goes the way, and shows the way.", author: "John C. Maxwell" },
        { text: "The greatest leader is not necessarily one who does the greatest things, but one who gets people to do the greatest things.", author: "Ronald Reagan" },
        { text: "Leadership is not about being in charge. It's about taking care of those in your charge.", author: "Simon Sinek" },
        { text: "A true leader has the confidence to stand alone, the courage to make tough decisions, and the compassion to listen.", author: "Douglas MacArthur" },
        { text: "The best leaders inspire others to find their own greatness.", author: "Robin Sharma" },
        { text: "Before you are a leader, success is all about growing yourself. When you become a leader, success is all about growing others.", author: "Jack Welch" },
        { text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
        { text: "A leader is a dealer in hope.", author: "Napoleon Bonaparte" },
        { text: "The task of the leader is to get their people from where they are to where they have not been.", author: "Henry Kissinger" },
        { text: "Leadership is the capacity to translate vision into reality.", author: "Warren Bennis" },
        { text: "Don't find fault, find a remedy.", author: "Henry Ford" },
        { text: "A good leader takes a little more than their share of the blame, a little less than their share of the credit.", author: "Arnold H. Glasow" },
        { text: "To handle yourself, use your head; to handle others, use your heart.", author: "Eleanor Roosevelt" },
        { text: "The supreme quality of leadership is integrity.", author: "Dwight D. Eisenhower" },
        { text: "Management is doing things right; leadership is doing the right things.", author: "Peter Drucker" },
    ],
    creativity: [
        { text: "Creativity is intelligence having fun.", author: "Albert Einstein" },
        { text: "You can't use up creativity. The more you use, the more you have.", author: "Maya Angelou" },
        { text: "Every artist was first an amateur.", author: "Ralph Waldo Emerson" },
        { text: "Creativity takes courage.", author: "Henri Matisse" },
        { text: "Imagination is more important than knowledge. For knowledge is limited, whereas imagination embraces the entire world.", author: "Albert Einstein" },
        { text: "The creative adult is the child who survived.", author: "Ursula K. Le Guin" },
        { text: "Don't think. Thinking is the enemy of creativity.", author: "Ray Bradbury" },
        { text: "To live a creative life, we must lose our fear of being wrong.", author: "Joseph Chilton Pearce" },
        { text: "You can't wait for inspiration. You have to go after it with a club.", author: "Jack London" },
        { text: "The desire to create is one of the deepest yearnings of the human soul.", author: "Dieter F. Uchtdorf" },
        { text: "There is no innovation and creativity without failure.", author: "Brené Brown" },
        { text: "Vulnerability is the birthplace of innovation, creativity, and change.", author: "Brené Brown" },
        { text: "An essential aspect of creativity is not being afraid to fail.", author: "Edwin Land" },
        { text: "Creativity is allowing yourself to make mistakes. Art is knowing which ones to keep.", author: "Scott Adams" },
        { text: "The chief enemy of creativity is 'good' sense.", author: "Pablo Picasso" },
    ],
    resilience: [
        { text: "Tough times never last, but tough people do.", author: "Robert H. Schuller" },
        { text: "The human capacity for burden is like bamboo — far more flexible than you'd ever believe.", author: "Jodi Picoult" },
        { text: "You may have to fight a battle more than once to win it.", author: "Margaret Thatcher" },
        { text: "Although the world is full of suffering, it is also full of the overcoming of it.", author: "Helen Keller" },
        { text: "Rock bottom became the solid foundation on which I rebuilt my life.", author: "J.K. Rowling" },
        { text: "When you come out of the storm, you won't be the same person who walked in. That's what this storm's all about.", author: "Haruki Murakami" },
        { text: "You are stronger than you know. More capable than you ever dreamed.", author: "Unknown" },
        { text: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", author: "Ralph Waldo Emerson" },
        { text: "The world breaks everyone, and afterward, many are strong at the broken places.", author: "Ernest Hemingway" },
        { text: "She stood in the storm, and when the wind did not blow her way, she adjusted her sails.", author: "Elizabeth Edwards" },
        { text: "You have power over your mind — not outside events. Realize this, and you will find strength.", author: "Marcus Aurelius" },
        { text: "When everything seems to be going against you, remember that the airplane takes off against the wind.", author: "Henry Ford" },
        { text: "A champion is defined not by their wins but by how they can recover when they fall.", author: "Serena Williams" },
        { text: "The greatest glory in living lies not in never falling, but in rising every time we fall.", author: "Nelson Mandela" },
        { text: "You never know how strong you are until being strong is your only choice.", author: "Bob Marley" },
    ],
    humor: [
        { text: "I have not failed. I've just found 10,000 ways that won't work.", author: "Thomas Edison" },
        { text: "Be yourself; everyone else is already taken.", author: "Oscar Wilde" },
        { text: "Two things are infinite: the universe and human stupidity. And I'm not sure about the universe.", author: "Albert Einstein", attributed: true },
        { text: "I am so clever that sometimes I don't understand a single word of what I am saying.", author: "Oscar Wilde" },
        { text: "People say nothing is impossible, but I do nothing every day.", author: "A.A. Milne" },
        { text: "Life is like a sewer — what you get out of it depends on what you put into it.", author: "Tom Lehrer" },
        { text: "The only mystery in life is why the kamikaze pilots wore helmets.", author: "Al McGuire" },
        { text: "My bed is a magical place where I suddenly remember everything I forgot to do.", author: "Unknown" },
        { text: "Common sense is like deodorant. The people who need it most never use it.", author: "Unknown" },
        { text: "I used to think I was indecisive, but now I'm not too sure.", author: "Unknown" },
    ],
};

const META = {   // category → emoji, colour
    motivation: ['🔥', 0xE67E22], wisdom: ['🧠', 0x3498DB], success: ['🏆', 0xF1C40F], leadership: ['👑', 0x9B59B6],
    creativity: ['🎨', 0xE91E63], resilience: ['💪', 0x2ECC71], humor: ['😄', 0x607D8B],
};
const CATS = Object.keys(QUOTES);
const lastShown = new Map();   // the same quote never twice in a row for a person

async function funMake(client, { guild, user, lang, arg }) {
    const asked = CATS.includes(arg) ? arg : 'random';
    const cat = asked === 'random' ? fun.pick(CATS) : asked;
    const list = QUOTES[cat];
    const last = lastShown.get(user.id);
    const fresh = list.filter((q) => q.text !== last);
    const q = fun.pick(fresh.length ? fresh : list);
    lastShown.set(user.id, q.text);
    if (lastShown.size > 2000) lastShown.clear();

    const tr = await fun.translate(q.text, lang);
    const by = q.author === 'Unknown' ? fun.F('qt_unknown', lang) : q.attributed ? fun.F('qt_attributed', lang, { who: q.author }) : q.author;
    const body = `> *${tr || q.text}*\n— **${by}**${tr ? `\n-# ${q.text}` : ''}`;
    return fun.textCard(guild, lang, {
        color: META[cat][1],
        top: `${META[cat][0]} ${fun.F(`qt_${cat}`, lang)}`,
        body,
        again: ['quote', user.id, asked],
    });
}

module.exports = {
    name: 'quote',
    userApp: true,   // also works as a user app (DMs, servers without ARCHON): lib/slash-payload.js
    aliases: ['quotes', 'citation', 'citations', 'q', 'wisdom', 'motivation', 'inspire'],
    description: 'An inspiring quote: motivation, wisdom, success, leadership, creativity, resilience, humor',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.quote [category]',
    examples: ['.quote', '.quote wisdom', '/quote category:success'],
    funMake,

    data: new SlashCommandBuilder()
        .setName('quote')
        .setDescription('An inspiring quote')
        .setDescriptionLocalizations({ fr: 'Une citation inspirante' })
        .addStringOption((o) => o.setName('category').setDescription('Type of quote').setDescriptionLocalizations({ fr: 'Type de citation' }).setRequired(false)
            .addChoices({ name: '🔀 Random', value: 'random' }, ...CATS.map((c) => ({ name: `${META[c][0]} ${c.charAt(0).toUpperCase() + c.slice(1)}`, value: c })))),

    run: async (client, message, args) => {
        const lang = fun.langOf(client, message.guild?.id, message, message.author.id);
        return message.reply(await funMake(client, { guild: message.guild, user: message.author, lang, arg: String(args[0] || 'random').toLowerCase() })).catch(() => {});
    },
    execute: async (ix, client) => {
        const lang = fun.langOf(client, ix.guildId, ix, ix.user.id);
        await ix.deferReply();
        return ix.editReply(await funMake(client, { guild: ix.guild, user: ix.user, lang, arg: ix.options.getString('category') || 'random' }));
    },
};
