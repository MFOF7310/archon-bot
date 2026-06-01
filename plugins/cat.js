const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const https = require('https');

// ================= BILINGUAL =================
const T = {
    en: {
        title: '🐱 Random Cat',
        loading: 'Fetching a purrfect cat...',
        error: '❌ Could not fetch a cat picture right now. Try again!',
        breedUnknown: 'Mystery Cat',
        origin: '🌍 Origin',
        temperament: '🎭 Temperament',
        lifespan: '⏰ Lifespan',
        weight: '⚖️ Weight',
        breedInfo: '📋 Breed Info',
        randomKitty: 'Random Kitty',
        footer: 'ARCHITECT CG-223 • TheCatAPI',
        another: '🐱 Another Cat',
        highRes: '✨ High Resolution'
    },
    fr: {
        title: '🐱 Chat Aléatoire',
        loading: 'Recherche d\'un chat parfait...',
        error: '❌ Impossible de récupérer une image de chat. Réessayez !',
        breedUnknown: 'Chat Mystère',
        origin: '🌍 Origine',
        temperament: '🎭 Tempérament',
        lifespan: '⏰ Espérance de vie',
        weight: '⚖️ Poids',
        breedInfo: '📋 Info sur la race',
        randomKitty: 'Chat Aléatoire',
        footer: 'ARCHITECT CG-223 • TheCatAPI',
        another: '🐱 Autre Chat',
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

function fetchImageUrl(url, timeout = 8000) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            timeout,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'image/*,*/*'
            }
        }, (res) => {
            // Follow redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                resolve(fetchImageUrl(res.headers.location, timeout));
                return;
            }
            if (res.statusCode === 200 && res.headers['content-type']?.startsWith('image/')) {
                resolve(url);
                return;
            }
            reject(new Error(`HTTP ${res.statusCode}`));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    });
}

// ================= CAT SOURCES (Priority Order) =================
async function fetchCatPrimary() {
    // TheCatAPI — high quality, breed info
    const data = await fetchJSON('https://api.thecatapi.com/v1/images/search?has_breeds=1&order=RAND&limit=1');
    if (!Array.isArray(data) || data.length === 0) throw new Error('No cat data');
    const cat = data[0];
    const breed = cat.breeds?.[0];
    return {
        url: cat.url,
        width: cat.width,
        height: cat.height,
        breed: breed?.name || null,
        origin: breed?.origin || null,
        temperament: breed?.temperament || null,
        lifespan: breed?.life_span || null,
        weight: breed?.weight?.metric || null,
        description: breed?.description || null,
        source: 'TheCatAPI'
    };
}

async function fetchCatFallback1() {
    // Cataas — reliable, fun
    const data = await fetchJSON('https://cataas.com/cat?json=true');
    return {
        url: `https://cataas.com/cat/${data._id}`,
        width: data.width,
        height: data.height,
        breed: null, origin: null, temperament: null, lifespan: null, weight: null, description: null,
        source: 'Cataas'
    };
}

async function fetchCatFallback2() {
    // PlaceKitten — always works
    const id = Math.floor(Math.random() * 16) + 1;
    return {
        url: `https://placekitten.com/800/600?r=${Date.now()}`,
        width: 800, height: 600,
        breed: null, origin: null, temperament: null, lifespan: null, weight: null, description: null,
        source: 'PlaceKitten'
    };
}

async function getCat() {
    // Try sources in priority order
    const sources = [fetchCatPrimary, fetchCatFallback1, fetchCatFallback2];
    for (const source of sources) {
        try {
            const result = await source();
            if (result.url) return result;
        } catch (err) {
            console.log(`[CAT] ${source.name} failed: ${err.message}`);
        }
    }
    return null;
}

// ================= BUILD EMBED =================
function buildCatEmbed(cat, client, t, user) {
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setAuthor({ name: '🐱 Cat Database', iconURL: 'https://cdn-icons-png.flaticon.com/512/616/616430.png' })
        .setTitle(cat.breed ? `🐱 ${cat.breed}` : t.title)
        .setImage(cat.url)
        .setFooter({ text: `${t.footer}${client?.version ? ` v${client.version}` : ''}`, iconURL: user?.displayAvatarURL() })
        .setTimestamp();

    // Add breed info fields if available
    if (cat.breed) {
        const fields = [];
        if (cat.origin) fields.push({ name: t.origin, value: cat.origin, inline: true });
        if (cat.temperament) {
            const temps = cat.temperament.split(',').slice(0, 3).join(', ');
            fields.push({ name: t.temperament, value: temps, inline: true });
        }
        if (cat.lifespan) fields.push({ name: t.lifespan, value: `${cat.lifespan} years`, inline: true });
        if (cat.weight) fields.push({ name: t.weight, value: `${cat.weight} kg`, inline: true });
        if (cat.description) {
            const desc = cat.description.length > 150 ? cat.description.substring(0, 150) + '...' : cat.description;
            embed.setDescription(desc);
        }
        if (fields.length > 0) embed.addFields(...fields);
    }

    // Resolution info
    if (cat.width && cat.height) {
        embed.addFields({ name: t.highRes, value: `${cat.width}×${cat.height}px`, inline: true });
    }

    return embed;
}

// ================= BUTTONS =================
function buildButtons(uid, t, isSlash = false) {
    const suffix = isSlash ? 'slash' : 'btn';
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`cat_${suffix}_${uid}`)
            .setLabel(t.another)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🐱'),
        new ButtonBuilder()
            .setURL('https://thecatapi.com')
            .setLabel('TheCatAPI')
            .setStyle(ButtonStyle.Link)
            .setEmoji('🔗')
    );
}

// ================= MODULE =================
module.exports = {
    name: 'cat',
    aliases: ['chat', 'kitty', 'meow', 'kitten'],
    description: '🐱 High-quality random cat pictures with breed info',
    category: 'FUN',
    cooldown: 3000,
    usage: '.cat',
    examples: ['.cat', '/cat'],

    data: new SlashCommandBuilder()
        .setName('cat')
        .setDescription('🐱 Get a high-quality random cat picture with breed info'),

    // ================= PREFIX =================
    run: async (client, message, args, db, ss, used) => {
        const lang = client.detectLanguage ? client.detectLanguage(used, 'en') : 'en';
        const t = T[lang] || T.en;
        const uid = message.author.id;

        const loadingMsg = await message.reply({ content: `⏳ ${t.loading}`, allowedMentions: { parse: [] } }).catch(() => null);

        const cat = await getCat();
        if (!cat) {
            const errorEmbed = new EmbedBuilder().setColor('#e74c3c').setDescription(t.error);
            return loadingMsg?.edit({ content: null, embeds: [errorEmbed], components: [] }).catch(() => {});
        }

        const embed = buildCatEmbed(cat, client, t, message.author);
        const buttons = buildButtons(uid, t, false);

        loadingMsg?.edit({ content: null, embeds: [embed], components: [buttons] }).catch(() => {});
    },

    // ================= SLASH =================
    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = T[lang] || T.en;
        const uid = interaction.user.id;

        await interaction.deferReply();

        const cat = await getCat();
        if (!cat) {
            const errorEmbed = new EmbedBuilder().setColor('#e74c3c').setDescription(t.error);
            return interaction.editReply({ embeds: [errorEmbed], components: [] }).catch(() => {});
        }

        const embed = buildCatEmbed(cat, client, t, interaction.user);
        const buttons = buildButtons(uid, t, true);

        interaction.editReply({ embeds: [embed], components: [buttons] }).catch(() => {});
    },

    // ================= BUTTON HANDLER =================
    async handleButton(interaction, client) {
        const id = interaction.customId;
        const uid = id.split('_').pop();

        if (interaction.user.id !== uid) {
            return interaction.reply({ content: '❌ Not your cat button!', flags: MessageFlags.Ephemeral }).catch(() => {});
        }

        await interaction.deferUpdate().catch(() => {});

        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = T[lang] || T.en;
        const cat = await getCat();

        if (!cat) {
            const errorEmbed = new EmbedBuilder().setColor('#e74c3c').setDescription(t.error);
            return interaction.editReply({ embeds: [errorEmbed], components: [] }).catch(() => {});
        }

        const embed = buildCatEmbed(cat, client, t, interaction.user);
        const buttons = buildButtons(uid, t, id.includes('slash'));

        interaction.editReply({ embeds: [embed], components: [buttons] }).catch(() => {});
    }
};