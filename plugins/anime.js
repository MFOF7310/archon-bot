const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

const FETCH_TIMEOUT = 5000;
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
        funFact: '🍜 Loves ramen more than anything!'
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
        funFact: '🍖 Can eat his body weight in meat!'
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
        funFact: '🍚 Can eat 50 bowls of rice in one sitting!'
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
        funFact: '🧹 Obsessed with cleaning and hates dirt!'
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
        funFact: '👃 Has an incredibly sensitive nose!'
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
        funFact: '🕶️ Wears a blindfold to control his immense power!'
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
        funFact: '📓 Mutters analysis of heroes in his notebook!'
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
        funFact: '✍️ Can write names at incredible speed!'
    },
};

module.exports = {
    name: 'anime',
    aliases: ['animechar', 'character', 'summon'],
    description: '🎌 Summon an anime character with style',
    category: 'Fun',
    cooldown: 5,
    
    data: new SlashCommandBuilder()
        .setName('anime')
        .setDescription('Summon an anime character with a quote and interactive buttons')
        .addStringOption(option =>
            option.setName('character')
                .setDescription('Choose a specific character (or leave blank for random)')
                .setRequired(false)
                .addChoices(
                    { name: '🍥 Naruto Uzumaki', value: 'naruto' },
                    { name: '🏴‍☠️ Monkey D. Luffy', value: 'luffy' },
                    { name: '💪 Goku', value: 'goku' },
                    { name: '⚔️ Levi Ackerman', value: 'levi' },
                    { name: '🌊 Tanjiro Kamado', value: 'tanjiro' },
                    { name: '👁️ Satoru Gojo', value: 'gojo' },
                    { name: '💥 Izuku Midoriya', value: 'deku' },
                    { name: '📓 Light Yagami', value: 'light' },
                )),
    
    run: async (client, message, args) => {
        const choice = args[0]?.toLowerCase();
        
        try {
            const { embed, row } = await createAnimeResponse(choice, message.author);
            const reply = await message.reply({ embeds: [embed], components: [row] });
            
            // Button collector
            const collector = reply.createMessageComponentCollector({ time: 60000 });
            
            collector.on('collect', async (interaction) => {
                if (interaction.user.id !== message.author.id) {
                    return interaction.reply({ 
                        content: '❌ This summon belongs to someone else! Use `.anime` to summon your own!', 
                        ephemeral: true 
                    });
                }
                
                const { embed: newEmbed } = await createAnimeResponse(null, interaction.user);
                await interaction.update({ embeds: [newEmbed], components: [row] });
            });
            
            collector.on('end', () => {
                const disabledRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('resummon')
                            .setLabel('🔄 Summon Another')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true)
                    );
                reply.edit({ components: [disabledRow] }).catch(() => null);
            });
            
        } catch (err) {
            console.error('Anime prefix command error:', err.message);
            await message.reply('❌ The summoning ritual failed. Try again later!');
        }
    },
    
    execute: async (interaction) => {
        await interaction.deferReply();
        
        const choice = interaction.options.getString('character');
        
        try {
            const { embed, row } = await createAnimeResponse(choice, interaction.user);
            const reply = await interaction.editReply({ embeds: [embed], components: [row] });
            
            // Button collector
            const collector = reply.createMessageComponentCollector({ time: 60000 });
            
            collector.on('collect', async (btnInteraction) => {
                if (btnInteraction.user.id !== interaction.user.id) {
                    return btnInteraction.reply({ 
                        content: '❌ This summon belongs to someone else! Use `/anime` to summon your own!', 
                        ephemeral: true 
                    });
                }
                
                const { embed: newEmbed } = await createAnimeResponse(null, btnInteraction.user);
                await btnInteraction.update({ embeds: [newEmbed], components: [row] });
            });
            
            collector.on('end', () => {
                const disabledRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('resummon')
                            .setLabel('🔄 Summon Another')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true)
                    );
                interaction.editReply({ components: [disabledRow] }).catch(() => null);
            });
            
        } catch (err) {
            console.error('Anime slash command error:', err.message);
            await interaction.editReply('❌ The summoning ritual failed. Try again later!');
        }
    }
};

async function createAnimeResponse(choice, user) {
    let charData;
    
    if (choice && CHARACTERS[choice]) {
        charData = CHARACTERS[choice];
    } else {
        const keys = Object.keys(CHARACTERS);
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        charData = CHARACTERS[randomKey];
    }
    
    // Random quote from character's pool
const quote = charData.quotes[Math.floor(Math.random() * charData.quotes.length)];

// Intelligent summoner-based footer messages
const summonerMessages = [
    `${user.username} called upon the anime gods`,
    `${user.username}'s spiritual energy manifested`,
    `${user.username} tore open a dimensional rift`,
    `${user.username} channeled their inner otaku`,
    `${user.username} rolled the gacha of fate`,
    `${user.username} awakened a new ally`,
    `${user.username} unleashed a legendary summon`,
    `${user.username} bent reality to their will`,
];

const summonMessage = summonerMessages[Math.floor(Math.random() * summonerMessages.length)];

    // Fetch character image - try multiple sources
let imageUrl = null;
const charKey = Object.keys(CHARACTERS).find(key => CHARACTERS[key].id === charData.id);

// Try Jikan API first
try {
    const response = await axios.get(`${ANIME_API}/characters/${charData.id}`, { 
        timeout: FETCH_TIMEOUT 
    });
    imageUrl = response.data?.data?.images?.jpg?.image_url || null;
    if (imageUrl) console.log(`✅ Image loaded from Jikan for ${charData.name}`);
} catch (err) {
    console.error('Jikan API fetch error:', err.message);
}

// If Jikan fails, skip image entirely and show a nice placeholder
if (!imageUrl) {
    console.log(`⚠️ No image found for ${charData.name}, using text-only display`);
}
    
    // Stats for fun
    const stats = {
        power: Math.floor(Math.random() * 30) + 70,   // 70-100
        speed: Math.floor(Math.random() * 40) + 60,   // 60-100
        wisdom: Math.floor(Math.random() * 50) + 50,  // 50-100
    };
    
    // Star rating
    const stars = '⭐'.repeat(Math.floor(Math.random() * 2) + 4); // 4-5 stars
    
    const embed = new EmbedBuilder()
        .setColor(charData.color)
        .setTitle(`${charData.emoji} **${charData.name}** Has Been Summoned!`)
        .setDescription(
            `### 💬 *"${quote}"*\n` +
            `\n📺 **Anime:** ${charData.series}` +
            `\n📊 **Rarity:** ${stars}` +
            `\n💡 **Fun Fact:** ${charData.funFact}` +
            `\n\n### ⚔️ **Battle Stats**\n` +
            `💪 Power: ${'█'.repeat(stats.power / 10)}${'░'.repeat(10 - stats.power / 10)} ${stats.power}%\n` +
            `💨 Speed: ${'█'.repeat(stats.speed / 10)}${'░'.repeat(10 - stats.speed / 10)} ${stats.speed}%\n` +
            `🧠 Wisdom: ${'█'.repeat(stats.wisdom / 10)}${'░'.repeat(10 - stats.wisdom / 10)} ${stats.wisdom}%`
        )
        .setFooter({ 
    text: `${summonMessage} • Click 🔄 to summon another`,
    iconURL: user.displayAvatarURL({ dynamic: true })
})
        .setTimestamp();
    
    if (imageUrl) {
    embed.setThumbnail(imageUrl);
}
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('resummon')
                .setLabel('🔄 Summon Another')
                .setStyle(ButtonStyle.Primary)
        );
    
    return { embed, row };
}