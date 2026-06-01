const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const https = require('https');

// ================= BILINGUAL =================
const T = {
    en: {
        title: '🐶 Random Dog',
        loading: 'Fetching a good boy...',
        error: '❌ Could not fetch a dog picture right now. Try again!',
        breedUnknown: 'Good Boy',
        origin: '🌍 Origin',
        temperament: '🎭 Temperament',
        lifespan: '⏰ Lifespan',
        weight: '⚖️ Weight',
        height: '📏 Height',
        breedGroup: '🏷️ Group',
        breedInfo: '📋 Breed Info',
        randomPup: 'Random Pup',
        footer: 'ARCHITECT CG-223 • TheDogAPI',
        another: '🐶 Another Dog',
        highRes: '✨ High Resolution'
    },
    fr: {
        title: '🐶 Chien Aléatoire',
        loading: 'Recherche d\'un bon chien...',
        error: '❌ Impossible de récupérer une image de chien. Réessayez !',
        breedUnknown: 'Bon Chien',
        origin: '🌍 Origine',
        temperament: '🎭 Tempérament',
        lifespan: '⏰ Espérance de vie',
        weight: '⚖️ Poids',
        height: '📏 Taille',
        breedGroup: '🏷️ Groupe',
        breedInfo: '📋 Info sur la race',
        randomPup: 'Chiot Aléatoire',
        footer: 'ARCHITECT CG-223 • TheDogAPI',
        another: '🐶 Autre Chien',
        highRes: '✨ Haute Résolution'
    }
};

// ================= FETCH WITH TIMEOUT =================
function fetchJSON(url, timeout = 8000) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            timeout,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        }, (res) => {
            if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('JSON parse failed')); } });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    });
}

// ================= DOG SOURCES (Priority Order) =================
async function fetchDogPrimary() {
    // TheDogAPI — high quality, breed info
    const data = await fetchJSON('https://api.thedogapi.com/v1/images/search?has_breeds=1&order=RAND&limit=1');
    if (!Array.isArray(data) || data.length === 0) throw new Error('No dog data');
    const dog = data[0];
    const breed = dog.breeds?.[0];
    return {
        url: dog.url,
        width: dog.width,
        height: dog.height,
        breed: breed?.name || null,
        origin: breed?.origin || null,
        temperament: breed?.temperament || null,
        lifespan: breed?.life_span || null,
        weight: breed?.weight?.metric || null,
        height: breed?.height?.metric || null,
        breedGroup: breed?.breed_group || null,
        description: null,
        source: 'TheDogAPI'
    };
}

async function fetchDogFallback1() {
    // Dog CEO API — reliable, no breed info
    const data = await fetchJSON('https://dog.ceo/api/breeds/image/random');
    if (data.status !== 'success') throw new Error('Dog CEO failed');
    // Try to extract breed from URL
    const breedMatch = data.message.match(/breeds\/([^/]+)/);
    const breed = breedMatch ? breedMatch[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : null;
    return {
        url: data.message,
        width: null, height: null,
        breed, origin: null, temperament: null, lifespan: null, weight: null, height: null,
        breedGroup: null, description: null,
        source: 'Dog CEO'
    };
}

async function fetchDogFallback2() {
    // Random.dog — reliable
    const data = await fetchJSON('https://random.dog/woof.json');
    if (!data.url) throw new Error('Random.dog failed');
    return {
        url: data.url,
        width: null, height: null,
        breed: null, origin: null, temperament: null, lifespan: null, weight: null, height: null,
        breedGroup: null, description: null,
        source: 'Random.dog'
    };
}

async function getDog() {
    const sources = [fetchDogPrimary, fetchDogFallback1, fetchDogFallback2];
    for (const source of sources) {
        try {
            const result = await source();
            if (result.url) return result;
        } catch (err) {
            console.log(`[DOG] ${source.name} failed: ${err.message}`);
        }
    }
    return null;
}

// ================= BUILD EMBED =================
function buildDogEmbed(dog, client, t, user) {
    const embed = new EmbedBuilder()
        .setColor('#D2691E')
        .setAuthor({ name: '🐶 Dog Database', iconURL: 'https://cdn-icons-png.flaticon.com/512/616/616554.png' })
        .setTitle(dog.breed ? `🐶 ${dog.breed}` : t.title)
        .setImage(dog.url)
        .setFooter({ text: `${t.footer}${client?.version ? ` v${client.version}` : ''}`, iconURL: user?.displayAvatarURL() })
        .setTimestamp();

    // Add breed info fields if available
    if (dog.breed) {
        const fields = [];
        if (dog.origin) fields.push({ name: t.origin, value: dog.origin, inline: true });
        if (dog.temperament) {
            const temps = dog.temperament.split(',').slice(0, 3).join(', ');
            fields.push({ name: t.temperament, value: temps, inline: true });
        }
        if (dog.lifespan) fields.push({ name: t.lifespan, value: `${dog.lifespan} years`, inline: true });
        if (dog.weight) fields.push({ name: t.weight, value: `${dog.weight} kg`, inline: true });
        if (dog.height) fields.push({ name: t.height, value: `${dog.height} cm`, inline: true });
        if (dog.breedGroup) fields.push({ name: t.breedGroup, value: dog.breedGroup, inline: true });
        if (fields.length > 0) embed.addFields(...fields);
    }

    // Resolution info
    if (dog.width && dog.height) {
        embed.addFields({ name: t.highRes, value: `${dog.width}×${dog.height}px`, inline: true });
    }

    return embed;
}

// ================= BUTTONS =================
function buildButtons(uid, t, isSlash = false) {
    const suffix = isSlash ? 'slash' : 'btn';
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`dog_${suffix}_${uid}`)
            .setLabel(t.another)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🐶'),
        new ButtonBuilder()
            .setURL('https://thedogapi.com')
            .setLabel('TheDogAPI')
            .setStyle(ButtonStyle.Link)
            .setEmoji('🔗')
    );
}

// ================= MODULE =================
module.exports = {
    name: 'dog',
    aliases: ['doggo', 'puppy', 'woof', 'pupper'],
    description: '🐶 High-quality random dog pictures with breed info',
    category: 'FUN',
    cooldown: 3000,
    usage: '.dog',
    examples: ['.dog', '/dog'],

    data: new SlashCommandBuilder()
        .setName('dog')
        .setDescription('🐶 Get a high-quality random dog picture with breed info'),

    // ================= PREFIX =================
    run: async (client, message, args, db, ss, used) => {
        const lang = client.detectLanguage ? client.detectLanguage(used, 'en') : 'en';
        const t = T[lang] || T.en;
        const uid = message.author.id;

        const loadingMsg = await message.reply({ content: `⏳ ${t.loading}`, allowedMentions: { parse: [] } }).catch(() => null);

        const dog = await getDog();
        if (!dog) {
            const errorEmbed = new EmbedBuilder().setColor('#e74c3c').setDescription(t.error);
            return loadingMsg?.edit({ content: null, embeds: [errorEmbed], components: [] }).catch(() => {});
        }

        const embed = buildDogEmbed(dog, client, t, message.author);
        const buttons = buildButtons(uid, t, false);

        loadingMsg?.edit({ content: null, embeds: [embed], components: [buttons] }).catch(() => {});
    },

    // ================= SLASH =================
    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = T[lang] || T.en;
        const uid = interaction.user.id;

        await interaction.deferReply();

        const dog = await getDog();
        if (!dog) {
            const errorEmbed = new EmbedBuilder().setColor('#e74c3c').setDescription(t.error);
            return interaction.editReply({ embeds: [errorEmbed], components: [] }).catch(() => {});
        }

        const embed = buildDogEmbed(dog, client, t, interaction.user);
        const buttons = buildButtons(uid, t, true);

        interaction.editReply({ embeds: [embed], components: [buttons] }).catch(() => {});
    },

    // ================= BUTTON HANDLER =================
    async handleButton(interaction, client) {
        const id = interaction.customId;
        const uid = id.split('_').pop();

        if (interaction.user.id !== uid) {
            return interaction.reply({ content: '❌ Not your dog button!', flags: MessageFlags.Ephemeral }).catch(() => {});
        }

        await interaction.deferUpdate().catch(() => {});

        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = T[lang] || T.en;
        const dog = await getDog();

        if (!dog) {
            const errorEmbed = new EmbedBuilder().setColor('#e74c3c').setDescription(t.error);
            return interaction.editReply({ embeds: [errorEmbed], components: [] }).catch(() => {});
        }

        const embed = buildDogEmbed(dog, client, t, interaction.user);
        const buttons = buildButtons(uid, t, id.includes('slash'));

        interaction.editReply({ embeds: [embed], components: [buttons] }).catch(() => {});
    }
};