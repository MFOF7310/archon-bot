const { EmbedBuilder, SlashCommandBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');

// ================= HAND-CURATED SFW QUOTE DATABASE =================
// All quotes are inspirational, motivational, philosophical — strictly SFW
const QUOTES = {
    motivation: [
        { text: "The only way to do great work is to love what you do.", author: "Steve Jobs", source: "Stanford Commencement, 2005" },
        { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius", source: "Analects" },
        { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill", source: "Speech, 1941" },
        { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt", source: "You Learn by Living" },
        { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson", source: "In One Era & Out the Other" },
        { text: "The only limit to our realization of tomorrow will be our doubts of today.", author: "Franklin D. Roosevelt", source: "Address, 1945" },
        { text: "Everything you've ever wanted is on the other side of fear.", author: "George Addair", source: "Motivational Seminar" },
        { text: "Opportunities don't happen. You create them.", author: "Chris Grosser", source: "Entrepreneur" },
        { text: "It always seems impossible until it's done.", author: "Nelson Mandela", source: "Long Walk to Freedom" },
        { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney", source: "Disney Archives" },
        { text: "Your time is limited, don't waste it living someone else's life.", author: "Steve Jobs", source: "Stanford Commencement, 2005" },
        { text: "If you can dream it, you can do it.", author: "Walt Disney", source: "Disney Magazine" },
        { text: "Don't be pushed around by the fears in your mind. Be led by the dreams in your heart.", author: "Roy T. Bennett", source: "The Light in the Heart" },
        { text: "Wake up with determination. Go to bed with satisfaction.", author: "George Lorimer", source: "Letters from a Self-Made Merchant" },
        { text: "The harder you work for something, the greater you'll feel when you achieve it.", author: "Unknown", source: "" },
    ],
    wisdom: [
        { text: "Knowing yourself is the beginning of all wisdom.", author: "Aristotle", source: "Nicomachean Ethics" },
        { text: "The unexamined life is not worth living.", author: "Socrates", source: "Apology, 399 BC" },
        { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein", source: "Letter to son, 1946" },
        { text: "The mind is everything. What you think you become.", author: "Buddha", source: "Dhammapada" },
        { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle", source: "Nicomachean Ethics" },
        { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb", source: "" },
        { text: "Wisdom is not a product of schooling but of the lifelong attempt to acquire it.", author: "Albert Einstein", source: "Letter, 1952" },
        { text: "He who has a why to live can bear almost any how.", author: "Friedrich Nietzsche", source: "Twilight of the Idols" },
        { text: "The only true wisdom is in knowing you know nothing.", author: "Socrates", source: "Apology" },
        { text: "Life is really simple, but we insist on making it complicated.", author: "Confucius", source: "Analects" },
        { text: "It is not that I'm so smart, it is just that I stay with problems longer.", author: "Albert Einstein", source: "Interview, 1952" },
        { text: "The obstacle is the way.", author: "Marcus Aurelius", source: "Meditations" },
        { text: "Do not dwell in the past, do not dream of the future, concentrate the mind on the present moment.", author: "Buddha", source: "Dhammapada" },
        { text: "Not everything that is faced can be changed, but nothing can be changed until it is faced.", author: "James Baldwin", source: "As Much Truth As One Can Bear" },
        { text: "The journey of a thousand miles begins with one step.", author: "Lao Tzu", source: "Tao Te Ching" },
    ],
    success: [
        { text: "Success usually comes to those who are too busy to be looking for it.", author: "Henry David Thoreau", source: "Walden" },
        { text: "I find that the harder I work, the more luck I seem to have.", author: "Thomas Jefferson", source: "Letter, 1792" },
        { text: "Don't be afraid to give up the good to go for the great.", author: "John D. Rockefeller", source: "Business Principles" },
        { text: "I never dreamed about success, I worked for it.", author: "Estee Lauder", source: "Interview, 1980" },
        { text: "The secret of success is to do the common thing uncommonly well.", author: "John D. Rockefeller Jr.", source: "Leadership Principles" },
        { text: "Success is walking from failure to failure with no loss of enthusiasm.", author: "Winston Churchill", source: "Speech, 1943" },
        { text: "The only place where success comes before work is in the dictionary.", author: "Vidal Sassoon", source: "Autobiography" },
        { text: "If you really look closely, most overnight successes took a long time.", author: "Steve Jobs", source: "Interview, 1998" },
        { text: "The real test is not whether you avoid this failure, because you won't. It's whether you let it harden or shame you into inaction.", author: "Barack Obama", source: "Commencement, 2016" },
        { text: "I've failed over and over and over again in my life. And that is why I succeed.", author: "Michael Jordan", source: "Nike Commercial" },
        { text: "Fall seven times, stand up eight.", author: "Japanese Proverb", source: "" },
        { text: "The difference between successful people and really successful people is that really successful people say no to almost everything.", author: "Warren Buffett", source: "Shareholder Letter, 2013" },
        { text: "I attribute my success to this: I never gave or took any excuse.", author: "Florence Nightingale", source: "Letters" },
        { text: "The secret of getting ahead is getting started.", author: "Mark Twain", source: "The Adventures of Tom Sawyer" },
        { text: "Action is the foundational key to all success.", author: "Pablo Picasso", source: "Interview, 1964" },
    ],
    leadership: [
        { text: "A leader is one who knows the way, goes the way, and shows the way.", author: "John C. Maxwell", source: "The 21 Irrefutable Laws of Leadership" },
        { text: "The greatest leader is not necessarily one who does the greatest things, but one who gets people to do the greatest things.", author: "Ronald Reagan", source: "Speech, 1981" },
        { text: "Leadership is not about being in charge. It's about taking care of those in your charge.", author: "Simon Sinek", source: "Leaders Eat Last" },
        { text: "A true leader has the confidence to stand alone, the courage to make tough decisions, and the compassion to listen.", author: "Douglas MacArthur", source: "Reminiscences" },
        { text: "The best leaders inspire others to find their own greatness.", author: "Robin Sharma", source: "The Monk Who Sold His Ferrari" },
        { text: "Before you are a leader, success is all about growing yourself. When you become a leader, success is all about growing others.", author: "Jack Welch", source: "Winning" },
        { text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs", source: "Interview, 1998" },
        { text: "A leader is a dealer in hope.", author: "Napoleon Bonaparte", source: "Military Maxims" },
        { text: "The task of the leader is to get their people from where they are to where they have not been.", author: "Henry Kissinger", source: "Leadership" },
        { text: "Leadership is the capacity to translate vision into reality.", author: "Warren Bennis", source: "On Becoming a Leader" },
        { text: "Don't find fault, find a remedy.", author: "Henry Ford", source: "Ford Archives" },
        { text: "A good leader takes a little more than their share of the blame, a little less than their share of the credit.", author: "Arnold H. Glasow", source: "Glasow's Gloats" },
        { text: "To handle yourself, use your head; to handle others, use your heart.", author: "Eleanor Roosevelt", source: "You Learn by Living" },
        { text: "The supreme quality of leadership is integrity.", author: "Dwight D. Eisenhower", source: "Speech, 1954" },
        { text: "Management is doing things right; leadership is doing the right things.", author: "Peter Drucker", source: "The Effective Executive" },
    ],
    creativity: [
        { text: "Creativity is intelligence having fun.", author: "Albert Einstein", source: "Interview, 1929" },
        { text: "You can't use up creativity. The more you use, the more you have.", author: "Maya Angelou", source: "Conversations with Maya Angelou" },
        { text: "Every artist was first an amateur.", author: "Ralph Waldo Emerson", source: "Essays: First Series" },
        { text: "Creativity takes courage.", author: "Henri Matisse", source: "Interview, 1944" },
        { text: "Imagination is more important than knowledge. For knowledge is limited, whereas imagination embraces the entire world.", author: "Albert Einstein", source: "Cosmic Religion" },
        { text: "The creative adult is the child who survived.", author: "Ursula K. Le Guin", source: "The Language of the Night" },
        { text: "Don't think. Thinking is the enemy of creativity.", author: "Ray Bradbury", source: "Zen in the Art of Writing" },
        { text: "To live a creative life, we must lose our fear of being wrong.", author: "Joseph Chilton Pearce", source: "The Crack in the Cosmic Egg" },
        { text: "You can't wait for inspiration. You have to go after it with a club.", author: "Jack London", source: "The Letters of Jack London" },
        { text: "The desire to create is one of the deepest yearnings of the human soul.", author: "Dieter F. Uchtdorf", source: "General Conference, 2008" },
        { text: "There is no innovation and creativity without failure.", author: "Brené Brown", source: "Daring Greatly" },
        { text: "Vulnerability is the birthplace of innovation, creativity, and change.", author: "Brené Brown", source: "Daring Greatly" },
        { text: "An essential aspect of creativity is not being afraid to fail.", author: "Edwin Land", source: "Polaroid History" },
        { text: "Creativity is allowing yourself to make mistakes. Art is knowing which ones to keep.", author: "Scott Adams", source: "The Dilbert Principle" },
        { text: "The chief enemy of creativity is 'good' sense.", author: "Pablo Picasso", source: "Interview, 1960" },
    ],
    resilience: [
        { text: "Tough times never last, but tough people do.", author: "Robert H. Schuller", source: "Tough Times Never Last" },
        { text: "The human capacity for burden is like bamboo — far more flexible than you'd ever believe.", author: "Jodi Picoult", source: "My Sister's Keeper" },
        { text: "You may have to fight a battle more than once to win it.", author: "Margaret Thatcher", source: "Speech, 1986" },
        { text: "Although the world is full of suffering, it is also full of the overcoming of it.", author: "Helen Keller", source: "Optimism" },
        { text: "Rock bottom became the solid foundation on which I rebuilt my life.", author: "J.K. Rowling", source: "Harvard Commencement, 2008" },
        { text: "When you come out of the storm, you won't be the same person who walked in. That's what this storm's all about.", author: "Haruki Murakami", source: "Kafka on the Shore" },
        { text: "You are stronger than you know. More capable than you ever dreamed.", author: "Unknown", source: "" },
        { text: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", author: "Ralph Waldo Emerson", source: "Essays" },
        { text: "The world breaks everyone, and afterward, many are strong at the broken places.", author: "Ernest Hemingway", source: "A Farewell to Arms" },
        { text: "She stood in the storm, and when the wind did not blow her way, she adjusted her sails.", author: "Elizabeth Edwards", source: "Resilience" },
        { text: "You have power over your mind — not outside events. Realize this, and you will find strength.", author: "Marcus Aurelius", source: "Meditations" },
        { text: "When everything seems to be going against you, remember that the airplane takes off against the wind.", author: "Henry Ford", source: "Ford Archives" },
        { text: "A champion is defined not by their wins but by how they can recover when they fall.", author: "Serena Williams", source: "Interview, 2015" },
        { text: "The greatest glory in living lies not in never falling, but in rising every time we fall.", author: "Nelson Mandela", source: "Long Walk to Freedom" },
        { text: "You never know how strong you are until being strong is your only choice.", author: "Bob Marley", source: "Interview" },
    ],
    humor: [
        { text: "I have not failed. I've just found 10,000 ways that won't work.", author: "Thomas Edison", source: "" },
        { text: "Be yourself; everyone else is already taken.", author: "Oscar Wilde", source: "" },
        { text: "Two things are infinite: the universe and human stupidity. And I'm not sure about the universe.", author: "Albert Einstein", source: "" },
        { text: "I am so clever that sometimes I don't understand a single word of what I am saying.", author: "Oscar Wilde", source: "" },
        { text: "People say nothing is impossible, but I do nothing every day.", author: "A.A. Milne", source: "" },
        { text: "Life is like a sewer — what you get out of it depends on what you put into it.", author: "Tom Lehrer", source: "" },
        { text: "The only mystery in life is why the kamikaze pilots wore helmets.", author: "Al McGuire", source: "" },
        { text: "My bed is a magical place where I suddenly remember everything I forgot to do.", author: "Unknown", source: "" },
        { text: "Common sense is like deodorant. The people who need it most never use it.", author: "Unknown", source: "" },
        { text: "I used to think I was indecisive, but now I'm not too sure.", author: "Unknown", source: "" },
    ],
};

// Category metadata
const CATEGORY_META = {
    motivation:  { emoji: '🔥', color: '#e67e22', fr: 'Motivation' },
    wisdom:      { emoji: '🧠', color: '#3498db', fr: 'Sagesse' },
    success:     { emoji: '🏆', color: '#f1c40f', fr: 'Succès' },
    leadership:  { emoji: '👑', color: '#9b59b6', fr: 'Leadership' },
    creativity:  { emoji: '🎨', color: '#e91e63', fr: 'Créativité' },
    resilience:  { emoji: '💪', color: '#2ecc71', fr: 'Résilience' },
    humor:       { emoji: '😄', color: '#607d8b', fr: 'Humour' },
};

// ================= TRANSLATIONS =================
const TRANSLATIONS = {
    en: {
        loading: (cat) => `📜 Finding a ${cat} quote...`,
        notFound: '❌ Category not found.',
        error: '❌ Could not fetch a quote. Try again!',
        quoteOfTheDay: '📆 Quote of the Day',
        next: '🔁 Another',
        source: 'Source',
        totalQuotes: 'quotes in library',
    },
    fr: {
        loading: (cat) => `📜 Recherche d'une citation ${cat}...`,
        notFound: '❌ Catégorie introuvable.',
        error: '❌ Impossible de récupérer une citation. Réessayez!',
        quoteOfTheDay: '📆 Citation du Jour',
        next: '🔁 Autre',
        source: 'Source',
        totalQuotes: 'citations dans la bibliothèque',
    }
};

// ================= HELPERS =================
function getRandomQuote(category) {
    const quotes = QUOTES[category];
    if (!quotes || quotes.length === 0) return null;
    return quotes[Math.floor(Math.random() * quotes.length)];
}

function buildQuoteEmbed(quote, category, lang, version, guildName) {
    const meta = CATEGORY_META[category];
    const totalCount = Object.values(QUOTES).reduce((a, q) => a + q.length, 0);

    const embed = new EmbedBuilder()
        .setColor(meta.color)
        .setAuthor({
            name: `${meta.emoji} ${category.charAt(0).toUpperCase() + category.slice(1)}`,
            iconURL: undefined
        })
        .setDescription(
            `> *"${quote.text}"*\n\n` +
            `— **${quote.author}**${quote.source ? `\n📖 *${quote.source}*` : ''}`
        )
        .setFooter({
            text: `${TRANSLATIONS[lang].totalQuotes}: ${totalCount} • ${guildName} • v${version}`,
            iconURL: undefined
        })
        .setTimestamp();

    return embed;
}

// ================= MAIN MODULE =================
module.exports = {
    name: 'quote',
    aliases: ['quotes', 'citation', 'citations', 'q', 'wisdom', 'motivation', 'inspire'],
    description: '📜 Curated SFW inspirational quotes — motivation, wisdom, success, leadership, creativity, resilience, humor.',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.quote [category]',
    examples: ['.quote', '.quote motivation', '.quote wisdom', '/quote category:success'],

    data: new SlashCommandBuilder()
        .setName('quote')
        .setDescription('📜 Get an inspirational SFW quote')
        .setDescriptionLocalizations({ fr: '📜 Obtenir une citation inspirante SFW' })
        .addStringOption(opt => opt
            .setName('category')
            .setDescription('Type of quote')
            .setDescriptionLocalizations({ fr: 'Type de citation' })
            .setRequired(false)
            .addChoices(
                { name: '🔀 Random', value: 'random' },
                { name: '🔥 Motivation', value: 'motivation' },
                { name: '🧠 Wisdom', value: 'wisdom' },
                { name: '🏆 Success', value: 'success' },
                { name: '👑 Leadership', value: 'leadership' },
                { name: '🎨 Creativity', value: 'creativity' },
                { name: '💪 Resilience', value: 'resilience' },
                { name: '😄 Humor', value: 'humor' }
            )),

    // ================= PREFIX COMMAND =================
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
        const txt = TRANSLATIONS[lang];
        const version = client.version || '2.0';
        const guildName = message.guild?.name || 'DM';

        let category = (args[0] || 'random').toLowerCase();
        const categories = Object.keys(QUOTES);

        if (category === 'random' || !categories.includes(category)) {
            category = categories[Math.floor(Math.random() * categories.length)];
        }

        const catMeta = CATEGORY_META[category];
        const loadingMsg = await message.reply(txt.loading(lang === 'fr' ? catMeta.fr : category)).catch(() => null);

        try {
            const quote = getRandomQuote(category);
            if (!quote) {
                return loadingMsg?.edit(txt.error).catch(() => {});
            }

            const embed = buildQuoteEmbed(quote, category, lang, version, guildName);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`quote_next_${category}_${message.author.id}`)
                    .setLabel(txt.next)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔁')
            );

            const msg = await loadingMsg?.edit({ content: null, embeds: [embed], components: [row] }).catch(() => {
                return message.channel.send({ embeds: [embed], components: [row] }).catch(() => {});
            });

            if (msg && msg.createMessageComponentCollector) {
                const collector = msg.createMessageComponentCollector({ time: 120000 });
                collector.on('collect', async (i) => {
                    if (!i.customId.endsWith(`_${message.author.id}`)) {
                        return i.reply({ content: '❌ Only the author can use this.', ephemeral: true }).catch(() => {});
                    }
                    await i.deferUpdate().catch(() => {});
                    try {
                        const newQuote = getRandomQuote(category);
                        const newEmbed = buildQuoteEmbed(newQuote, category, lang, version, guildName);
                        await i.editReply({ embeds: [newEmbed] }).catch(() => {});
                    } catch (e) {
                        await i.followUp({ content: txt.error, ephemeral: true }).catch(() => {});
                    }
                });
            }

        } catch (err) {
            console.error('[QUOTE]', err.message);
            loadingMsg?.edit(txt.error).catch(() => {});
        }
    },

    // ================= SLASH COMMAND =================
    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const txt = TRANSLATIONS[lang];
        const version = client.version || '2.0';
        const guildName = interaction.guild?.name || 'DM';

        let category = interaction.options.getString('category') || 'random';
        const categories = Object.keys(QUOTES);

        if (category === 'random' || !categories.includes(category)) {
            category = categories[Math.floor(Math.random() * categories.length)];
        }

        await interaction.deferReply();

        try {
            const quote = getRandomQuote(category);
            if (!quote) {
                return interaction.editReply(txt.error);
            }

            const embed = buildQuoteEmbed(quote, category, lang, version, guildName);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`quote_slash_next_${category}_${interaction.user.id}`)
                    .setLabel(txt.next)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔁')
            );

            await interaction.editReply({ embeds: [embed], components: [row] });

            const msg = await interaction.fetchReply();
            const collector = msg.createMessageComponentCollector({ time: 120000 });
            collector.on('collect', async (i) => {
                if (!i.customId.endsWith(`_${interaction.user.id}`)) {
                    return i.reply({ content: '❌ Only the author can use this.', ephemeral: true }).catch(() => {});
                }
                await i.deferUpdate().catch(() => {});
                try {
                    const newQuote = getRandomQuote(category);
                    const newEmbed = buildQuoteEmbed(newQuote, category, lang, version, guildName);
                    await i.editReply({ embeds: [newEmbed] }).catch(() => {});
                } catch (e) {
                    await i.followUp({ content: txt.error, ephemeral: true }).catch(() => {});
                }
            });

        } catch (err) {
            console.error('[QUOTE SLASH]', err.message);
            interaction.editReply(txt.error).catch(() => {});
        }
    }
};