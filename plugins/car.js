const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const https = require('https');

// ================= BILINGUAL =================
const T = {
    en: {
        title: '🚗 Random Car',
        loading: 'Revving up the engines...',
        error: '❌ Could not fetch a car picture right now. Try again!',
        category: '🏷️ Category',
        unknown: 'Mystery Machine',
        footer: 'ARCHITECT CG-223 • Car Gallery',
        another: '🚗 Another Car',
        highRes: '✨ High Resolution',
        sources: ['Sports Car', 'Supercar', 'Classic Car', 'Luxury Car', 'Muscle Car', 'Exotic Car']
    },
    fr: {
        title: '🚗 Voiture Aléatoire',
        loading: 'Mise en route des moteurs...',
        error: '❌ Impossible de récupérer une image de voiture. Réessayez !',
        category: '🏷️ Catégorie',
        unknown: 'Machine Mystère',
        footer: 'ARCHITECT CG-223 • Galerie Auto',
        another: '🚗 Autre Voiture',
        highRes: '✨ Haute Résolution',
        sources: ['Voiture de Sport', 'Supercar', 'Voiture Classique', 'Voiture de Luxe', 'Muscle Car', 'Voiture Exotique']
    }
};

// ================= CAR CATEGORIES =================
const CAR_CATEGORIES = [
    'sports-car,supercar', 'luxury-car,limousine', 'muscle-car,american',
    'classic-car,vintage', 'exotic-car,hypercar', 'car,racing',
    'car,drift', 'car,tuning', 'car,offroad'
];

// ================= FETCH WITH TIMEOUT & ABSOLUTE URL RESOLUTION =================
function fetchRedirectUrl(url, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            timeout,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'image/*,*/*'
            }
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                let location = res.headers.location;
                if (location.startsWith('/')) {
                    const baseUrl = new URL(url);
                    location = `${baseUrl.protocol}//${baseUrl.host}${location}`;
                }
                resolve(location);
                return;
            }
            if (res.statusCode === 200) {
                let finalUrl = url;
                if (finalUrl.startsWith('/')) {
                    const baseUrl = new URL(url);
                    finalUrl = `${baseUrl.protocol}//${baseUrl.host}${finalUrl}`;
                }
                resolve(finalUrl);
                return;
            }
            reject(new Error(`HTTP ${res.statusCode}`));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    });
}

// ================= CURATED CAR IMAGES (Direct URLs, Permanent) =================
const CAR_IMAGE_URLS = [
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70', // Porsche
    'https://images.unsplash.com/photo-1552519507-da3b142c6e3d', // Ford GT
    'https://images.unsplash.com/photo-1580273916550-e323be2ae537', // Lamborghini
    'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2', // Ferrari
    'https://images.unsplash.com/photo-1568605117036-5fe5e7fa0ac7', // Audi R8
    'https://images.unsplash.com/photo-1614200187524-dc4b892acf16', // McLaren
    'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf', // Mercedes AMG
    'https://images.unsplash.com/photo-1542362567-b07e54358753', // BMW M4
    'https://images.unsplash.com/photo-1603584173870-7e0443fc6b6c', // Bugatti
    'https://images.unsplash.com/photo-1621135802920-133df287f89c', // Nissan GT-R
    'https://images.unsplash.com/photo-1572197505605-d0fd6b0af82b', // Corvette
    'https://images.unsplash.com/photo-1511919884226-fd3cad34687c', // Classic Mustang
    'https://images.unsplash.com/photo-1567808291548-fc3ee04dbcf0', // Tesla
    'https://images.unsplash.com/photo-1580274455191-1c62238fa333', // Porsche 911
    'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2', // Lexus LC
    'https://images.unsplash.com/photo-1568402105612-6a82a9d7a5f9', // Jaguar
    'https://images.unsplash.com/photo-1581540222194-0def2dda95b8', // Aston Martin
    'https://images.unsplash.com/photo-1627462450295-ff5ab21339c2', // Dodge Challenger
    'https://images.unsplash.com/photo-1573213083431-ef52c6fea96a', // Rolls Royce
    'https://images.unsplash.com/photo-1602584383687-1c2dae162c4a'  // Koenigsegg
].map(url => `${url}?auto=format&fit=crop&w=1200&h=675&q=80`);

// ================= CAR SOURCES (with URL validation) =================
async function fetchCarPrimary() {
    const randomIndex = Math.floor(Math.random() * CAR_IMAGE_URLS.length);
    const url = CAR_IMAGE_URLS[randomIndex];
    
    // Extract a nice category from the URL (between 'photo-' and '?')
    let category = 'Sports Car';
    if (url.includes('lamborghini')) category = 'Lamborghini';
    else if (url.includes('ferrari')) category = 'Ferrari';
    else if (url.includes('porsche')) category = 'Porsche';
    else if (url.includes('mercedes')) category = 'Mercedes';
    else if (url.includes('bmw')) category = 'BMW';
    else if (url.includes('audi')) category = 'Audi';
    else if (url.includes('mclaren')) category = 'McLaren';
    else if (url.includes('bugatti')) category = 'Bugatti';
    else if (url.includes('mustang')) category = 'Ford Mustang';
    else if (url.includes('corvette')) category = 'Chevrolet Corvette';
    else if (url.includes('tesla')) category = 'Tesla';
    else if (url.includes('aston')) category = 'Aston Martin';
    else if (url.includes('dodge')) category = 'Dodge';
    else if (url.includes('rolls')) category = 'Rolls Royce';
    
    return {
        url: url,
        width: 1200,
        height: 675,
        category: category,
        source: 'Unsplash Gallery'
    };
}

async function fetchCarFallback1() {
    // Random car keyword for variety
    const keywords = ['car', 'sports-car', 'supercar', 'luxury-car', 'muscle-car', 'classic-car', 'exotic-car', 'race-car'];
    const keyword = keywords[Math.floor(Math.random() * keywords.length)];
    const url = `https://source.unsplash.com/featured/1200x675/?${keyword}`;
    let finalUrl = await fetchRedirectUrl(url);
    
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        throw new Error('Invalid URL');
    }
    
    let category = keyword.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return {
        url: finalUrl,
        width: 1200,
        height: 675,
        category: category,
        source: 'Unsplash'
    };
}

// Remove fetchCarFallback2 and fetchCarFallback3, or keep them as last resort
async function fetchCarFallback2() {
    // Static Unsplash car image (always works)
    return {
        url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&h=675&q=80',
        width: 1200,
        height: 675,
        category: 'Supercar',
        source: 'Unsplash (Static)'
    };
}

async function fetchCarFallback3() {
    // Another static fallback (classic car)
    return {
        url: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&h=675&q=80',
        width: 1200,
        height: 675,
        category: 'Classic Sports Car',
        source: 'Unsplash (Static)'
    };
}

async function getCar() {
    const sources = [fetchCarPrimary, fetchCarFallback1, fetchCarFallback2, fetchCarFallback3];
    for (const source of sources) {
        try {
            const result = await source();
            if (result.url && (result.url.startsWith('http://') || result.url.startsWith('https://'))) {
                return result;
            } else {
                console.log(`[CAR] ${source.name || source} returned invalid URL: ${result.url}`);
            }
        } catch (err) {
            console.log(`[CAR] ${source.name || source} failed: ${err.message}`);
        }
    }
    return null;
}

// ================= BUILD EMBED =================
function buildCarEmbed(car, client, t, user) {
    const lang = client?.detectLanguage ? 'en' : 'en'; // simple check
    const sourceName = car.source || 'Gallery';
    const categoryDisplay = car.category || t.unknown;

    // Score-based color (random for variety)
    const colors = ['#FF2800', '#1E90FF', '#FFD700', '#32CD32', '#FF6B6B', '#9370DB', '#FF4500', '#00CED1'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    return new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: '🚗 Car Gallery', iconURL: 'https://cdn-icons-png.flaticon.com/512/3202/3202926.png' })
        .setTitle(`🚗 ${categoryDisplay}`)
        .setImage(car.url)
        .addFields(
            { name: t.category, value: categoryDisplay, inline: true },
            { name: t.highRes, value: `${car.width}×${car.height}px`, inline: true }
        )
        .setFooter({ text: `${t.footer}${client?.version ? ` v${client.version}` : ''} • ${sourceName}`, iconURL: user?.displayAvatarURL() })
        .setTimestamp();
}

// ================= BUTTONS =================
function buildButtons(uid, t, isSlash = false) {
    // Structure stricte garantie : car_action_userid
    const action = isSlash ? 'slash' : 'prefix';
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`car_${action}_${uid}`)
            .setLabel(t.another)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🚗')
    );
}

// ================= MODULE =================
module.exports = {
    name: 'car',
    aliases: ['cars', 'voiture', 'auto', 'vehicle', 'automobile'],
    description: '🚗 High-quality random car pictures from curated galleries',
    category: 'FUN',
    cooldown: 3000,
    usage: '.car',
    examples: ['.car', '/car'],

    data: new SlashCommandBuilder()
        .setName('car')
        .setDescription('🚗 Get a high-quality random car picture'),

    // ================= PREFIX =================
    run: async (client, message, args, db, ss, used) => {
        const lang = client.detectLanguage ? client.detectLanguage(used, 'en') : 'en';
        const t = T[lang] || T.en;
        const uid = message.author.id;

        const loadingMsg = await message.reply({ content: `⏳ ${t.loading}`, allowedMentions: { parse: [] } }).catch(() => null);

        const car = await getCar();
        if (!car) {
            const errorEmbed = new EmbedBuilder().setColor('#e74c3c').setDescription(t.error);
            return loadingMsg?.edit({ content: null, embeds: [errorEmbed], components: [] }).catch(() => {});
        }

        const embed = buildCarEmbed(car, client, t, message.author);
        const buttons = buildButtons(uid, t, false);

        loadingMsg?.edit({ content: null, embeds: [embed], components: [buttons] }).catch(() => {});
    },

    // ================= SLASH =================
    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = T[lang] || T.en;
        const uid = interaction.user.id;

        await interaction.deferReply();

        const car = await getCar();
        if (!car) {
            const errorEmbed = new EmbedBuilder().setColor('#e74c3c').setDescription(t.error);
            return interaction.editReply({ embeds: [errorEmbed], components: [] }).catch(() => {});
        }

        const embed = buildCarEmbed(car, client, t, interaction.user);
        const buttons = buildButtons(uid, t, true);

        interaction.editReply({ embeds: [embed], components: [buttons] }).catch(() => {});
    },

    // ================= BUTTON HANDLER =================
    async handleButton(interaction, client) {
        const id = interaction.customId;
        const uid = id.split('_').pop();

        if (interaction.user.id !== uid) {
            return interaction.reply({ content: '❌ Not your car button!', ephemeral: true }).catch(() => {}); // Remplacé ici
        }

        await interaction.deferUpdate().catch(() => {});

        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = T[lang] || T.en;
        const car = await getCar();

        if (!car) {
            const errorEmbed = new EmbedBuilder().setColor('#e74c3c').setDescription(t.error);
            return interaction.editReply({ embeds: [errorEmbed], components: [] }).catch(() => {});
        }

          const embed = buildCarEmbed(car, client, t, interaction.user);
          const buttons = buildButtons(uid, t, id.split('_')[1] === 'slash');

        interaction.editReply({ embeds: [embed], components: [buttons] }).catch(() => {});
    }
};
