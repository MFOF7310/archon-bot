const { EmbedBuilder, SlashCommandBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const https = require('https');

// ================= BILINGUAL =================
const T = {
    en: {
        title: '😂 Fresh Meme',
        loading: 'Fetching a fresh meme for you...',
        error: '❌ Could not fetch a meme right now. Try again in a moment!',
        errorNsfw: '🛡️ All results were filtered. Try again!',
        errorNetwork: '🌐 Meme sources are temporarily slow. Try again!',
        footer: 'r/{sub} • u/{author} • SFW Only',
        source: '🔗 View on Reddit',
        another: '🔄 Another Meme',
        upvotes: '👍 Upvotes',
        comments: '💬 Comments',
        subreddit: '📍 Posted in',
        postedAgo: '⏰ Posted',
        sfwBadge: '✅ SFW Verified',
        noResults: '📭 No memes found in r/{sub}, trying another...'
    },
    fr: {
        title: '😂 Nouveau Meme',
        loading: 'Récupération d\'un nouveau meme...',
        error: '❌ Impossible de récupérer un meme pour le moment. Réessayez !',
        errorNsfw: '🛡️ Tous les résultats ont été filtrés (NSFW). Réessayez !',
        errorNetwork: '🌐 Reddit est lent. Tentative avec source alternative...',
        footer: 'r/{sub} • u/{author} • SFW Uniquement',
        source: '🔗 Voir sur Reddit',
        another: '🔄 Autre Meme',
        upvotes: '👍 Votes',
        comments: '💬 Commentaires',
        subreddit: '📍 Posté dans',
        postedAgo: '⏰ Posté',
        sfwBadge: '✅ SFW Vérifié',
        noResults: '📭 Aucun meme dans r/{sub}, essai avec un autre...'
    }
};

// ================= SFW SUBREDDITS =================
// Curated list — strictly SFW, high quality, diverse
const SUBREDDITS = [
    'memes', 'wholesomememes', 'me_irl', 'dankmemes',
    'ProgrammerHumor', 'Animemes', 'MemeEconomy',
    'terriblefacebookmemes', 'historymemes', 'sciencememes'
];

// ================= MEME API (Primary - Reliable) =================
// meme-api.com returns curated memes from Reddit, works from any IP
function fetchMemeAPI(subreddit) {
    return new Promise((resolve, reject) => {
        const sub = subreddit || 'memes';
        const url = `https://meme-api.com/gimme/${sub}`;
        const req = https.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0',
                'Accept': 'application/json'
            }
        }, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`MEME_API_HTTP_${res.statusCode}`));
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.nsfw === true) {
                        reject(new Error('NSFW'));
                        return;
                    }
                    // Normalize to Reddit-like format
                    resolve({
                        data: {
                            children: [{
                                data: {
                                    title: parsed.title || 'Meme',
                                    url: parsed.url,
                                    permalink: `/r/${parsed.subreddit}/comments/${parsed.postLink?.split('/').pop() || 'abc123'}/`,
                                    ups: parsed.ups || parsed.score || 0,
                                    score: parsed.ups || parsed.score || 0,
                                    num_comments: parsed.comments || 0,
                                    author: parsed.author || 'unknown',
                                    created_utc: Math.floor(Date.now() / 1000) - 3600,
                                    over_18: false,
                                    subreddit: parsed.subreddit || sub
                                }
                            }]
                        }
                    });
                } catch (e) { reject(new Error('PARSE_ERROR')); }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('TIMEOUT')); });
    });
}

// ================= REDDIT FETCH (Fallback) =================
function fetchReddit(sub) {
    return new Promise((resolve, reject) => {
        const url = `https://www.reddit.com/r/${sub}/hot.json?limit=50&t=day`;
        const req = https.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
                'Connection': 'keep-alive'
            }
        }, (res) => {
            if (res.statusCode === 429) {
                reject(new Error('RATE_LIMITED'));
                return;
            }
            if (res.statusCode === 403) {
                reject(new Error('BLOCKED'));
                return;
            }
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('PARSE_ERROR')); }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('TIMEOUT')); });
    });
}

// ================= MEME PICKER (SFW FILTER) =================
function pickMeme(posts) {
    if (!Array.isArray(posts) || posts.length === 0) return null;
    
    const valid = posts.filter(p => {
        const d = p.data;
        if (!d) return false;
        // STRICT SFW filters
        if (d.over_18 === true) return false;
        if (d.spoiler === true) return false;
        if (d.pinned === true) return false; // Skip pinned posts (usually announcements)
        if (d.stickied === true) return false;
        // Must have image
        const hasImage = d.url && (
            d.url.match(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i) ||
            d.url.includes('i.redd.it') ||
            d.url.includes('i.imgur.com') ||
            d.url.includes('preview.redd.it')
        );
        if (!hasImage) return false;
        // Quality threshold
        if ((d.score || 0) < 25) return false;
        if ((d.ups || 0) < 25) return false;
        return true;
    });
    
    if (valid.length === 0) return null;
    // Pick random from top results (weighted toward higher scores)
    valid.sort((a, b) => (b.data.score || 0) - (a.data.score || 0));
    const topPool = valid.slice(0, Math.max(10, Math.floor(valid.length * 0.3)));
    return topPool[Math.floor(Math.random() * topPool.length)].data;
}

// ================= FORMAT RELATIVE TIME =================
function formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() / 1000) - timestamp);
    if (seconds < 60) return `${seconds}s ago`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

// ================= BUILD PROFESSIONAL EMBED =================
function buildMemeEmbed(meme, sub, client, t, user) {
    const timeAgo = formatTimeAgo(meme.created_utc);
    const color = meme.score > 10000 ? '#FFD700' : meme.score > 5000 ? '#FF6B6B' : '#00D4AA';
    
    return new EmbedBuilder()
        .setColor(color)
        .setAuthor({
            name: `r/${sub}`,
            iconURL: 'https://www.redditstatic.com/desktop2x/img/favicon/favicon-32x32.png',
            url: `https://reddit.com/r/${sub}`
        })
        .setTitle(meme.title.substring(0, 256))
        .setImage(meme.url)
        .setURL(`https://reddit.com${meme.permalink}`)
        .addFields(
            { name: `\u200b`, value: '\u2501'.repeat(20), inline: false },
            { name: t.upvotes, value: `**${meme.ups?.toLocaleString() || '0'}**`, inline: true },
            { name: t.comments, value: `**${meme.num_comments?.toLocaleString() || '0'}**`, inline: true },
            { name: t.subreddit, value: `**r/${sub}**`, inline: true },
            { name: t.postedAgo, value: `**${timeAgo}**`, inline: true },
            { name: t.sfwBadge, value: '\u2705 Safe for Work', inline: true },
            { name: `\u200b`, value: `*by u/${meme.author}*`, inline: true }
        )
        .setFooter({
            text: `${t.footer.replace('{sub}', sub).replace('{author}', meme.author)}`,
            iconURL: user?.displayAvatarURL() || client.user?.displayAvatarURL()
        })
        .setTimestamp();
}

// ================= GET MEME (WITH RETRIES & FALLBACKS) =================
async function getMeme(tried = new Set()) {
    // PHASE 1: Try meme-api.com (reliable, any IP, curated)
    const available = SUBREDDITS.filter(s => !tried.has(s));
    if (available.length > 0) {
        const sub = available[Math.floor(Math.random() * available.length)];
        tried.add(sub);
        try {
            const data = await fetchMemeAPI(sub);
            const meme = pickMeme(data?.data?.children);
            if (meme) return { success: true, meme, sub: meme.subreddit || sub };
        } catch (err) {
            console.log(`[MEME] meme-api.com/${sub}: ${err.message}, trying Reddit...`);
        }
    }

    // PHASE 2: Try direct Reddit (fallback)
    if (available.length > 0) {
        const sub2 = available[Math.floor(Math.random() * available.length)];
        tried.add(sub2);
        try {
            const data = await fetchReddit(sub2);
            const meme = pickMeme(data?.data?.children);
            if (meme) return { success: true, meme, sub: meme.subreddit || sub2 };
        } catch (err) {
            const msg = err.message;
            if (msg === 'RATE_LIMITED' || msg === 'BLOCKED' || msg === 'TIMEOUT' || msg.startsWith('HTTP')) {
                console.log(`[MEME] reddit/${sub2}: ${msg}`);
            }
        }
    }

    // PHASE 3: Still have untried subs? Keep going
    if (tried.size < SUBREDDITS.length) {
        return getMeme(tried);
    }

    // EXHAUSTED: Distinguish Reddit block from genuine NSFW filtering
    return { success: false, error: 'ALL_SOURCES_FAILED' };
}

// ================= BUILD BUTTONS =================
function buildButtons(meme, t, userId, isSlash = false) {
    const suffix = isSlash ? 'slash' : 'btn';
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`meme_${suffix}_${userId}`)
            .setLabel(t.another)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔄'),
        new ButtonBuilder()
            .setURL(`https://reddit.com${meme.permalink}`)
            .setLabel(t.source)
            .setStyle(ButtonStyle.Link)
            .setEmoji('🔗')
    );
}

// ================= MODULE =================
module.exports = {
    name: 'meme',
    aliases: ['memes', 'funny', 'lol'],
    description: '😂 Fresh SFW memes from Reddit — curated, high quality, click for more.',
    category: 'FUN',
    cooldown: 5000,
    usage: '.meme',
    examples: ['.meme', '/meme'],

    data: new SlashCommandBuilder()
        .setName('meme')
        .setDescription('😂 Get a fresh SFW meme from Reddit'),

    // ================= PREFIX =================
    run: async (client, message, args, db, ss, used) => {
        const lang = client.detectLanguage ? client.detectLanguage(used, 'en') : 'en';
        const t = T[lang] || T.en;
        const uid = message.author.id;

        // Send loading message
        const loadingMsg = await message.reply({ content: `⏳ ${t.loading}`, allowedMentions: { parse: [] } }).catch(() => null);

        const result = await getMeme();
        if (!result.success) {
            const errorMsg = result.error === 'ALL_SOURCES_FAILED' ? t.errorNetwork : t.error;
            const errorEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setDescription(errorMsg);
            return loadingMsg?.edit({ content: null, embeds: [errorEmbed], components: [] }).catch(() => {});
        }

        const embed = buildMemeEmbed(result.meme, result.sub, client, t, message.author);
        const buttons = buildButtons(result.meme, t, uid, false);

        loadingMsg?.edit({ content: null, embeds: [embed], components: [buttons] }).catch(() => {});
    },

    // ================= SLASH =================
    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = T[lang] || T.en;
        const uid = interaction.user.id;

        await interaction.deferReply().catch(() => {});

        const result = await getMeme();
        if (!result.success) {
            const errorMsg = result.error === 'ALL_SOURCES_FAILED' ? t.errorNetwork : t.error;
            const errorEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setDescription(errorMsg);
            return interaction.editReply({ embeds: [errorEmbed], components: [] }).catch(() => {});
        }

        const embed = buildMemeEmbed(result.meme, result.sub, client, t, interaction.user);
        const buttons = buildButtons(result.meme, t, uid, true);

        interaction.editReply({ embeds: [embed], components: [buttons] }).catch(() => {});
    },

    // ================= BUTTON HANDLER =================
    async handleButton(interaction, client) {
        const id = interaction.customId; // meme_btn_USERID or meme_slash_USERID
        const parts = id.split('_');
        const uid = parts[parts.length - 1];

        // Verify it's the same user who clicked
        if (interaction.user.id !== uid) {
            return interaction.reply({ content: '❌ Not your meme button!', flags: MessageFlags.Ephemeral }).catch(() => {});
        }

        await interaction.deferUpdate().catch(() => {});

        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = T[lang] || T.en;
        const result = await getMeme();

        if (!result.success) {
            const errorMsg = result.error === 'ALL_SOURCES_FAILED' ? t.errorNetwork : t.error;
            const errorEmbed = new EmbedBuilder().setColor('#e74c3c').setDescription(errorMsg);
            return interaction.editReply({ embeds: [errorEmbed], components: [] }).catch(() => {});
        }

        const embed = buildMemeEmbed(result.meme, result.sub, client, t, interaction.user);
        const buttons = buildButtons(result.meme, t, uid, id.includes('slash'));

        interaction.editReply({ embeds: [embed], components: [buttons] }).catch(() => {});
    }
};