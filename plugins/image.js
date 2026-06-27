const { EmbedBuilder, SlashCommandBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const https = require('https');

// ================= BILINGUAL =================
const T = {
    en: {
        loading: (category) => `📸 Fetching an ultra HD ${category} image...`,
        error: '❌ Failed to fetch image. Try again!',
        noApiKey: (cat) => `⚠️ \`${cat}\` images require an Unsplash API key. Set \`UNSPLASH_ACCESS_KEY\` in your .env file.`,
        footer: (cat, total) => `Architect CG-223 • ${cat} • #${total.toLocaleString()} served`,
        categories: {
            dog: '🐕 Dogs',
            cat: '🐈 Cats',
            car: '🚗 Cars',
            nature: '🌿 Nature',
            architecture: '🏛️ Architecture',
            food: '🍕 Food',
            space: '🚀 Space',
            cyberpunk: '🌃 Cyberpunk',
        },
        breed: 'Breed',
        photographer: '📷 Photographer',
        resolution: '📐 Resolution',
        source: '🔗 Source',
        unsplash: 'Unsplash',
        random: '🔀 Random',
        next: '🔁 Next',
        stats: '📊 Stats',
        dogApi: 'Dog CEO',
        catApi: 'TheCatAPI',
        nasa: 'NASA APOD',
    },
    fr: {
        loading: (category) => `📸 Récupération d'une image ${category} ultra HD...`,
        error: '❌ Échec de récupération de l\'image. Réessayez!',
        noApiKey: (cat) => `⚠️ Les images \`${cat}\` nécessitent une clé API Unsplash. Définissez \`UNSPLASH_ACCESS_KEY\` dans votre .env.`,
        footer: (cat, total) => `Architect CG-223 • ${cat} • #${total.toLocaleString()} servies`,
        categories: {
            dog: '🐕 Chiens',
            cat: '🐈 Chats',
            car: '🚗 Voitures',
            nature: '🌿 Nature',
            architecture: '🏛️ Architecture',
            food: '🍕 Nourriture',
            space: '🚀 Espace',
            cyberpunk: '🌃 Cyberpunk',
        },
        breed: 'Race',
        photographer: '📷 Photographe',
        resolution: '📐 Résolution',
        source: '🔗 Source',
        unsplash: 'Unsplash',
        random: '🔀 Aléatoire',
        next: '🔁 Suivant',
        stats: '📊 Stats',
        dogApi: 'Dog CEO',
        catApi: 'TheCatAPI',
        nasa: 'NASA APOD',
    }
};

// ================= API HELPERS =================
function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { timeout: 10000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
        }).on('error', reject).on('timeout', () => reject(new Error('Timeout')));
    });
}

function fetchUnsplash(query, accessKey) {
    return new Promise((resolve, reject) => {
        if (!accessKey) return reject(new Error('No API key'));
        const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=30&orientation=landscape&content_filter=high&client_id=${accessKey}`;
        https.get(url, { timeout: 10000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
        }).on('error', reject);
    });
}

// ================= RAM CACHE for images =================
const imageCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function getCached(key) {
    const entry = imageCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.time > CACHE_TTL) { imageCache.delete(key); return null; }
    return entry.data;
}
function setCache(key, data) { imageCache.set(key, { data, time: Date.now() }); }

// ================= IMAGE FETCHERS =================
const fetchers = {
    // DOGS — free API, no key needed
    async dog() {
        const data = await fetchJSON('https://dog.ceo/api/breeds/image/random');
        if (data.status !== 'success') throw new Error('Dog API failed');

        // Try to extract breed from URL
        const breedMatch = data.message.match(/breeds\/([^/]+)/);
        const breed = breedMatch ? breedMatch[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Mixed Breed';

        return {
            url: data.message,
            title: `🐕 ${breed}`,
            subtitle: breed,
            source: 'dogApi',
            color: '#e67e22',
            meta: { breed }
        };
    },

    // CATS — free API, optional key
    async cat() {
        const data = await fetchJSON('https://api.thecatapi.com/v1/images/search?has_breeds=1&order=RANDOM&limit=1');
        if (!data || !data[0]) throw new Error('Cat API failed');

        const cat = data[0];
        const breed = cat.breeds?.[0];

        return {
            url: cat.url,
            title: breed ? `🐈 ${breed.name}` : '🐈 Cat',
            subtitle: breed ? `${breed.name} — ${breed.temperament || 'Mysterious'}` : 'A wonderful cat',
            source: 'catApi',
            color: '#9b59b6',
            meta: {
                breed: breed?.name || 'Unknown',
                origin: breed?.origin || 'Unknown',
                temperament: breed?.temperament || '',
                lifeSpan: breed?.life_span || '',
                description: breed?.description || '',
            }
        };
    },

    // CARS — Unsplash (requires key)
    async car(accessKey) {
        const cacheKey = 'unsplash_car';
        let results = getCached(cacheKey);
        if (!results) {
            const data = await fetchUnsplash('luxury car sports automotive', accessKey);
            results = data.results;
            if (results && results.length > 0) setCache(cacheKey, results);
        }
        if (!results || results.length === 0) throw new Error('No car images');
        const img = results[Math.floor(Math.random() * results.length)];

        return {
            url: img.urls.regular,
            title: '🚗 Automotive Excellence',
            subtitle: img.alt_description || 'High-performance vehicle',
            source: 'unsplash',
            color: '#e74c3c',
            meta: {
                photographer: img.user?.name || 'Unknown',
                photographerLink: img.user?.links?.html || '',
                width: img.width,
                height: img.height,
                unsplashUrl: img.links?.html || '',
            }
        };
    },

    // NATURE — Unsplash
    async nature(accessKey) {
        const cacheKey = 'unsplash_nature';
        let results = getCached(cacheKey);
        if (!results) {
            const data = await fetchUnsplash('stunning nature landscape mountains forest ocean', accessKey);
            results = data.results;
            if (results && results.length > 0) setCache(cacheKey, results);
        }
        if (!results || results.length === 0) throw new Error('No nature images');
        const img = results[Math.floor(Math.random() * results.length)];

        return {
            url: img.urls.regular,
            title: '🌿 Natural Wonder',
            subtitle: img.alt_description || 'Breathtaking landscape',
            source: 'unsplash',
            color: '#27ae60',
            meta: {
                photographer: img.user?.name || 'Unknown',
                photographerLink: img.user?.links?.html || '',
                width: img.width,
                height: img.height,
                unsplashUrl: img.links?.html || '',
            }
        };
    },

    // ARCHITECTURE — Unsplash
    async architecture(accessKey) {
        const cacheKey = 'unsplash_architecture';
        let results = getCached(cacheKey);
        if (!results) {
            const data = await fetchUnsplash('architecture building cityscape skyline modern', accessKey);
            results = data.results;
            if (results && results.length > 0) setCache(cacheKey, results);
        }
        if (!results || results.length === 0) throw new Error('No architecture images');
        const img = results[Math.floor(Math.random() * results.length)];

        return {
            url: img.urls.regular,
            title: '🏛️ Architectural Marvel',
            subtitle: img.alt_description || 'Stunning architecture',
            source: 'unsplash',
            color: '#3498db',
            meta: {
                photographer: img.user?.name || 'Unknown',
                photographerLink: img.user?.links?.html || '',
                width: img.width,
                height: img.height,
                unsplashUrl: img.links?.html || '',
            }
        };
    },

    // FOOD — Unsplash
    async food(accessKey) {
        const cacheKey = 'unsplash_food';
        let results = getCached(cacheKey);
        if (!results) {
            const data = await fetchUnsplash('gourmet food cuisine delicious restaurant', accessKey);
            results = data.results;
            if (results && results.length > 0) setCache(cacheKey, results);
        }
        if (!results || results.length === 0) throw new Error('No food images');
        const img = results[Math.floor(Math.random() * results.length)];

        return {
            url: img.urls.regular,
            title: '🍕 Culinary Art',
            subtitle: img.alt_description || 'Delicious cuisine',
            source: 'unsplash',
            color: '#f39c12',
            meta: {
                photographer: img.user?.name || 'Unknown',
                photographerLink: img.user?.links?.html || '',
                width: img.width,
                height: img.height,
                unsplashUrl: img.links?.html || '',
            }
        };
    },

    // SPACE — NASA APOD (free, no key)
    async space() {
        const data = await fetchJSON('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY&count=1');
        if (!data || !data[0]) throw new Error('NASA API failed');
        const apod = data[0];
        if (apod.media_type !== 'image') throw new Error('Not an image');

        return {
            url: apod.url,
            title: `🚀 ${apod.title}`,
            subtitle: apod.explanation?.substring(0, 200) || 'Cosmic wonder',
            source: 'nasa',
            color: '#2c3e50',
            meta: {
                date: apod.date,
                copyright: apod.copyright || 'NASA',
            }
        };
    },

    // CYBERPUNK — Unsplash
    async cyberpunk(accessKey) {
        const cacheKey = 'unsplash_cyberpunk';
        let results = getCached(cacheKey);
        if (!results) {
            const data = await fetchUnsplash('cyberpunk neon city night futuristic', accessKey);
            results = data.results;
            if (results && results.length > 0) setCache(cacheKey, results);
        }
        if (!results || results.length === 0) throw new Error('No cyberpunk images');
        const img = results[Math.floor(Math.random() * results.length)];

        return {
            url: img.urls.regular,
            title: '🌃 Cyberpunk Vision',
            subtitle: img.alt_description || 'Neon-drenched metropolis',
            source: 'unsplash',
            color: '#9b59b6',
            meta: {
                photographer: img.user?.name || 'Unknown',
                photographerLink: img.user?.links?.html || '',
                width: img.width,
                height: img.height,
                unsplashUrl: img.links?.html || '',
            }
        };
    },

    // RANDOM — picks random category
    async random(accessKey) {
        const categories = ['dog', 'cat', 'car', 'nature', 'architecture', 'food', 'space', 'cyberpunk'];
        const pick = categories[Math.floor(Math.random() * categories.length)];
        return this[pick](accessKey);
    }
};

// ================= STATS TRACKING =================
let totalServed = 0;
try {
    const statsPath = require('path').join(__dirname, '..', 'data', '.image_stats.json');
    if (require('fs').existsSync(statsPath)) {
        totalServed = JSON.parse(require('fs').readFileSync(statsPath, 'utf8')).total || 0;
    }
} catch (e) {}

function saveStats() {
    try {
        const fs = require('fs');
        const path = require('path');
        const dir = path.join(__dirname, '..', 'data');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, '.image_stats.json'), JSON.stringify({ total: totalServed, lastUpdate: Date.now() }));
    } catch (e) {}
}

// ================= EMBED BUILDER =================
function buildImageEmbed(imageData, lang, version, guildName) {
    const txt = T[lang];
    const meta = imageData.meta;
    const embed = new EmbedBuilder()
        .setColor(imageData.color)
        .setTitle(imageData.title)
        .setDescription(`> *${imageData.subtitle}*`)
        .setImage(imageData.url)
        .setTimestamp();

    // Source attribution
    if (imageData.source === 'unsplash') {
        const fields = [
            { name: txt.photographer, value: meta.photographer || 'Unknown', inline: true },
        ];
        if (meta.width && meta.height) {
            fields.push({ name: txt.resolution, value: `${meta.width}×${meta.height}`, inline: true });
        }
        embed.addFields(fields);
        embed.setFooter({ text: `${txt.unsplash} • ${guildName} • v${version}` });
    } else if (imageData.source === 'dogApi') {
        embed.addFields({ name: txt.breed, value: meta.breed || 'Mixed', inline: true });
        embed.setFooter({ text: `${txt.dogApi} • ${guildName} • v${version}` });
    } else if (imageData.source === 'catApi') {
        const fields = [{ name: txt.breed, value: meta.breed || 'Unknown', inline: true }];
        if (meta.origin) fields.push({ name: 'Origin', value: meta.origin, inline: true });
        if (meta.temperament) fields.push({ name: 'Temperament', value: meta.temperament, inline: false });
        embed.addFields(fields);
        embed.setFooter({ text: `${txt.catApi} • ${guildName} • v${version}` });
    } else if (imageData.source === 'nasa') {
        embed.addFields(
            { name: 'Date', value: meta.date || 'Unknown', inline: true },
            { name: 'Credit', value: meta.copyright || 'NASA', inline: true }
        );
        embed.setFooter({ text: `${txt.nasa} • ${guildName} • v${version}` });
    }

    return embed;
}

// ================= MAIN MODULE =================
module.exports = {
    name: 'image',
    aliases: ['img', 'pic', 'photo', 'image', 'images'],
    description: '📸 Fetch ultra HD SFW images — dogs, cats, cars, nature, architecture, food, space, cyberpunk.',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.image <category>',
    examples: ['.image dog', '.image cat', '.image car', '.img random', '.pic nature'],

    data: new SlashCommandBuilder()
        .setName('image')
        .setDescription('📸 Fetch ultra HD SFW images')
        .setDescriptionLocalizations({ fr: '📸 Récupérer des images SFW ultra HD' })
        .addStringOption(opt => opt
            .setName('category')
            .setDescription('What kind of image?')
            .setDescriptionLocalizations({ fr: 'Quel type d\'image ?' })
            .setRequired(true)
            .addChoices(
                { name: '🔀 Random', value: 'random' },
                { name: '🐕 Dog', value: 'dog' },
                { name: '🐈 Cat', value: 'cat' },
                { name: '🚗 Car', value: 'car' },
                { name: '🌿 Nature', value: 'nature' },
                { name: '🏛️ Architecture', value: 'architecture' },
                { name: '🍕 Food', value: 'food' },
                { name: '🚀 Space', value: 'space' },
                { name: '🌃 Cyberpunk', value: 'cyberpunk' }
            )),

    // ================= PREFIX COMMAND =================
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
        const txt = T[lang];
        const category = (args[0] || 'random').toLowerCase();
        const accessKey = process.env.UNSPLASH_ACCESS_KEY;
        const version = client.version || '2.0';
        const guildName = message.guild?.name || 'DM';

        // Validate category
        const validCategories = ['dog', 'cat', 'car', 'nature', 'architecture', 'food', 'space', 'cyberpunk', 'random'];
        if (!validCategories.includes(category)) {
            return message.reply(
                lang === 'fr'
                    ? `❌ Catégorie invalide. Choisissez: ${validCategories.map(c => `\`${c}\``).join(', ')}`
                    : `❌ Invalid category. Choose: ${validCategories.map(c => `\`${c}\``).join(', ')}`
            ).catch(() => {});
        }

        // Check if Unsplash key needed but missing
        const needsKey = ['car', 'nature', 'architecture', 'food', 'cyberpunk'];
        if (needsKey.includes(category) && !accessKey) {
            return message.reply(txt.noApiKey(category)).catch(() => {});
        }

        const loadingMsg = await message.reply(txt.loading(txt.categories[category] || category)).catch(() => null);

        try {
            const imageData = await fetchers[category](accessKey);
            totalServed++;
            saveStats();

            const embed = buildImageEmbed(imageData, lang, version, guildName);

            // Add "Next" button
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`image_next_${category}_${message.author.id}`)
                    .setLabel(txt.next)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔁')
            );

            const msg = await loadingMsg?.edit({ content: null, embeds: [embed], components: [row] }).catch(() => {
                return message.channel.send({ embeds: [embed], components: [row] }).catch(() => {});
            });

            // Button collector for "Next"
            if (msg && msg.createMessageComponentCollector) {
                const collector = msg.createMessageComponentCollector({ time: 120000 });
                collector.on('collect', async (i) => {
                    if (!i.customId.endsWith(`_${message.author.id}`)) {
                        return i.reply({ content: txt.en.accessDenied || '❌ Only the author can use this.', flags: 64 }).catch(() => {});
                    }
                    if (i.customId.startsWith('image_next')) {
                        await i.deferUpdate().catch(() => {});
                        try {
                            const newImage = await fetchers[category](accessKey);
                            totalServed++;
                            saveStats();
                            const newEmbed = buildImageEmbed(newImage, lang, version, guildName);
                            await i.editReply({ embeds: [newEmbed] }).catch(() => {});
                        } catch (e) {
                            await i.followUp({ content: txt.error, flags: 64 }).catch(() => {});
                        }
                    }
                });
            }

        } catch (err) {
            console.error(`[IMAGE] ${category}:`, err.message);
            loadingMsg?.edit(txt.error).catch(() => {});
        }
    },

    // ================= SLASH COMMAND =================
    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const txt = T[lang];
        const category = interaction.options.getString('category') || 'random';
        const accessKey = process.env.UNSPLASH_ACCESS_KEY;
        const version = client.version || '2.0';
        const guildName = interaction.guild?.name || 'DM';

        // Check if Unsplash key needed but missing
        const needsKey = ['car', 'nature', 'architecture', 'food', 'cyberpunk'];
        if (needsKey.includes(category) && !accessKey) {
            return interaction.reply({ content: txt.noApiKey(category), flags: 64 });
        }

        await interaction.deferReply();

        try {
            const imageData = await fetchers[category](accessKey);
            totalServed++;
            saveStats();

            const embed = buildImageEmbed(imageData, lang, version, guildName);

            // Add "Next" button
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`image_slash_next_${category}_${interaction.user.id}`)
                    .setLabel(txt.next)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔁')
            );

            await interaction.editReply({ embeds: [embed], components: [row] });

            // Button collector
            const msg = await interaction.fetchReply();
            const collector = msg.createMessageComponentCollector({ time: 120000 });
            collector.on('collect', async (i) => {
                if (!i.customId.endsWith(`_${interaction.user.id}`)) {
                    return i.reply({ content: txt.en?.accessDenied || '❌ Only the author can use this.', flags: 64 }).catch(() => {});
                }
                if (i.customId.startsWith('image_slash_next')) {
                    await i.deferUpdate().catch(() => {});
                    try {
                        const newImage = await fetchers[category](accessKey);
                        totalServed++;
                        saveStats();
                        const newEmbed = buildImageEmbed(newImage, lang, version, guildName);
                        await i.editReply({ embeds: [newEmbed] }).catch(() => {});
                    } catch (e) {
                        await i.followUp({ content: txt.error, flags: 64 }).catch(() => {});
                    }
                }
            });

        } catch (err) {
            console.error(`[IMAGE SLASH] ${category}:`, err.message);
            interaction.editReply(txt.error).catch(() => {});
        }
    }
};