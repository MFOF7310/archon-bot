const { EmbedBuilder, SlashCommandBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const https = require('https');
const http = require('http');

// ================= TRANSLATIONS =================
const T = {
    en: {
        loading: (url) => `🔍 Analyzing **${truncateUrl(url)}**...`,
        error: '❌ Could not fetch URL. It may be blocked or invalid.',
        invalid: '❌ Please provide a valid URL starting with `http://` or `https://`',
        title: '🔗 URL Preview',
        siteName: '🌐 Site',
        description: '📝 Description',
        image: '🖼️ Image',
        noImage: 'No image found',
        type: '📄 Type',
        locale: '🌍 Language',
        footer: (domain) => `${domain} • URL Preview`,
        visit: '🔗 Visit',
        safe: '✅ Safe',
        unknown: '❓ Unknown',
    },
    fr: {
        loading: (url) => `🔍 Analyse de **${truncateUrl(url)}**...`,
        error: '❌ Impossible de récupérer l\'URL. Elle peut être bloquée ou invalide.',
        invalid: '❌ Veuillez fournir une URL valide commençant par `http://` ou `https://`',
        title: '🔗 Aperçu de l\'URL',
        siteName: '🌐 Site',
        description: '📝 Description',
        image: '🖼️ Image',
        noImage: 'Aucune image trouvée',
        type: '📄 Type',
        locale: '🌍 Langue',
        footer: (domain) => `${domain} • Aperçu URL`,
        visit: '🔗 Visiter',
        safe: '✅ Sûr',
        unknown: '❓ Inconnu',
    }
};

// ================= HELPERS =================
function truncateUrl(url, max = 60) {
    try {
        const u = new URL(url);
        const host = u.hostname;
        const path = u.pathname + u.search;
        const full = host + path;
        return full.length > max ? full.substring(0, max - 3) + '...' : full;
    } catch { return url.length > max ? url.substring(0, max - 3) + '...' : url; }
}

function extractDomain(url) {
    try { return new URL(url).hostname; } catch { return url; }
}

function fetchMeta(targetUrl) {
    return new Promise((resolve, reject) => {
        const clientLib = targetUrl.startsWith('https:') ? https : http;
        const req = clientLib.get(targetUrl, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'identity',
            },
            maxRedirects: 5
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const redirectUrl = new URL(res.headers.location, targetUrl).toString();
                return fetchMeta(redirectUrl).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));

            // Abort if not HTML
            const contentType = res.headers['content-type'] || '';
            if (!contentType.includes('text/html')) {
                return resolve({
                    title: extractDomain(targetUrl),
                    description: `Content-Type: ${contentType}`,
                    image: null,
                    siteName: extractDomain(targetUrl),
                    type: contentType.split(';')[0].trim(),
                    locale: null,
                    url: targetUrl
                });
            }

            let data = '';
            res.on('data', chunk => {
                data += chunk;
                // Stop early if we have enough meta tags
                if (data.length > 500000) req.destroy();
            });
            res.on('end', () => {
                const meta = parseMeta(data, targetUrl);
                resolve(meta);
            });
        }).on('error', reject).on('timeout', () => reject(new Error('Timeout')));
    });
}

function parseMeta(html, baseUrl) {
    const meta = {
        title: extractTag(html, '<title>', '</title>') || null,
        description: extractMetaTag(html, 'description') || extractMetaTag(html, 'og:description') || null,
        image: extractMetaTag(html, 'og:image') || extractMetaTag(html, 'twitter:image') || extractLinkTag(html, 'image_src') || null,
        siteName: extractMetaTag(html, 'og:site_name') || extractDomain(baseUrl),
        type: extractMetaTag(html, 'og:type') || 'website',
        locale: extractMetaTag(html, 'og:locale') || null,
        url: extractMetaTag(html, 'og:url') || baseUrl,
        themeColor: extractMetaTag(html, 'theme-color') || null,
    };

    // Resolve relative image URLs
    if (meta.image && !meta.image.match(/^https?:\/\//)) {
        meta.image = new URL(meta.image, baseUrl).toString();
    }

    // Fallback title
    if (!meta.title) meta.title = meta.siteName || extractDomain(baseUrl);

    // Clean up description
    if (meta.description) {
        meta.description = meta.description.replace(/\s+/g, ' ').trim();
        if (meta.description.length > 500) meta.description = meta.description.substring(0, 497) + '...';
    }

    return meta;
}

function extractTag(html, open, close) {
    const start = html.indexOf(open);
    if (start === -1) return null;
    const end = html.indexOf(close, start + open.length);
    if (end === -1) return null;
    const content = html.substring(start + open.length, end).trim();
    return content.replace(/<[^>]+>/g, '').trim() || null;
}

function extractMetaTag(html, property) {
    const patterns = [
        new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'),
        new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${property}["']`, 'i'),
        new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'),
        new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${property}["']`, 'i'),
    ];
    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) return match[1].trim();
    }
    return null;
}

function extractLinkTag(html, rel) {
    const pattern = new RegExp(`<link[^>]*rel=["']${rel}["'][^>]*href=["']([^"']+)["']`, 'i');
    const match = html.match(pattern);
    return match ? match[1].trim() : null;
}

// ================= MODULE =================
module.exports = {
    name: 'url',
    aliases: ['link', 'preview', 'website', 'site', 'urlpreview'],
    description: '🔗 Fetch rich preview of any URL — title, description, image, metadata.',
    category: 'UTILITY',
    cooldown: 5000,
    usage: '.url <link>',
    examples: ['.url https://discord.com', '.url https://github.com', '/url link:https://openai.com'],

    data: new SlashCommandBuilder()
        .setName('url')
        .setDescription('🔗 Preview any URL with metadata and image')
        .addStringOption(opt => opt
            .setName('link')
            .setDescription('URL to preview')
            .setRequired(true)),

    run: async (client, message, args, db, ss, used) => {
        const lang = client.detectLanguage ? client.detectLanguage(used, 'en') : 'en';
        const t = T[lang];
        const targetUrl = args[0];

        if (!targetUrl || !targetUrl.match(/^https?:\/\//)) {
            return message.reply(t.invalid).catch(() => {});
        }

        const loadingMsg = await message.reply(t.loading(targetUrl)).catch(() => null);

        try {
            const meta = await fetchMeta(targetUrl);
            const domain = extractDomain(targetUrl);

            const embed = new EmbedBuilder()
                .setColor(meta.themeColor || '#00fbff')
                .setAuthor({ name: domain, iconURL: `https://www.google.com/s2/favicons?domain=${domain}&sz=128` })
                .setTitle(meta.title || domain)
                .setURL(targetUrl);

            if (meta.description) {
                embed.setDescription(meta.description);
            }

            if (meta.image) {
                embed.setImage(meta.image);
            }

            embed.addFields(
                { name: t.type, value: meta.type || 'website', inline: true },
                { name: t.locale, value: meta.locale || t.unknown, inline: true }
            );

            embed.setFooter({ text: t.footer(domain) })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setURL(targetUrl)
                    .setLabel(t.visit)
                    .setStyle(ButtonStyle.Link)
            );

            loadingMsg?.edit({ content: null, embeds: [embed], components: [row] }).catch(() => {});

        } catch (err) {
            console.error('[URL]', err.message);
            loadingMsg?.edit(t.error).catch(() => {});
        }
    },

    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = T[lang];
        const targetUrl = interaction.options.getString('link');

        if (!targetUrl || !targetUrl.match(/^https?:\/\//)) {
            return interaction.reply({ content: t.invalid, ephemeral: true });
        }

        await interaction.deferReply();

        try {
            const meta = await fetchMeta(targetUrl);
            const domain = extractDomain(targetUrl);

            const embed = new EmbedBuilder()
                .setColor(meta.themeColor || '#00fbff')
                .setAuthor({ name: domain, iconURL: `https://www.google.com/s2/favicons?domain=${domain}&sz=128` })
                .setTitle(meta.title || domain)
                .setURL(targetUrl);

            if (meta.description) embed.setDescription(meta.description);
            if (meta.image) embed.setImage(meta.image);

            embed.addFields(
                { name: t.type, value: meta.type || 'website', inline: true },
                { name: t.locale, value: meta.locale || t.unknown, inline: true }
            );

            embed.setFooter({ text: t.footer(domain) }).setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setURL(targetUrl).setLabel(t.visit).setStyle(ButtonStyle.Link)
            );

            await interaction.editReply({ embeds: [embed], components: [row] });

        } catch (err) {
            console.error('[URL SLASH]', err.message);
            interaction.editReply(t.error).catch(() => {});
        }
    }
};