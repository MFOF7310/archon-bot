const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const axios = require('axios');

// Terminal colors for logging
const green = "\x1b[32m", cyan = "\x1b[36m", yellow = "\x1b[33m", red = "\x1b[31m", reset = "\x1b[0m";

// Cache for search results (5 min TTL)
const searchCache = new Map();
const CACHE_TTL = 300000;

module.exports = {
    name: 'youtube',
    aliases: ['yt', 'video', 'ytsearch', 'ytinfo'],
    description: '🎬 Search YouTube or get detailed video information',
    category: 'UTILITY',
    cooldown: 3,
    usage: '.youtube <search query> or .youtube info <url>',
    examples: [
        '.yt lofi hip hop',
        '.youtube info https://youtube.com/watch?v=...',
        '.video search trap music'
    ],

    // ================= SLASH COMMAND DATA =================
    data: new SlashCommandBuilder()
        .setName('youtube')
        .setDescription('🎬 Search YouTube or get video information')
        .setDescriptionLocalizations({
            fr: '🎬 Rechercher sur YouTube ou obtenir des informations vidéo'
        })
        .addSubcommand(sub => sub
            .setName('search')
            .setDescription('🔍 Search YouTube for videos')
            .setDescriptionLocalizations({ fr: '🔍 Rechercher des vidéos sur YouTube' })
            .addStringOption(opt => opt
                .setName('query')
                .setDescription('What to search for')
                .setDescriptionLocalizations({ fr: 'Que rechercher' })
                .setRequired(true)
            )
            .addIntegerOption(opt => opt
                .setName('results')
                .setDescription('Number of results (1-5)')
                .setDescriptionLocalizations({ fr: 'Nombre de résultats (1-5)' })
                .setMinValue(1)
                .setMaxValue(5)
            )
        )
        .addSubcommand(sub => sub
            .setName('info')
            .setDescription('📋 Get detailed info about a YouTube video')
            .setDescriptionLocalizations({ fr: '📋 Obtenir des informations détaillées sur une vidéo YouTube' })
            .addStringOption(opt => opt
                .setName('url')
                .setDescription('YouTube video URL or ID')
                .setDescriptionLocalizations({ fr: 'URL ou ID de la vidéo YouTube' })
                .setRequired(true)
            )
        ),

    // ================= PREFIX COMMAND EXECUTION =================
    run: async (client, message, args) => {
        if (!args.length) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#FF0000')
                    .setDescription('🎬 **YouTube Neural Search**\n\n' +
                        '└ `.yt <search>` - Search for videos\n' +
                        '└ `.yt info <url>` - Get video details\n\n' +
                        '**Examples:**\n' +
                        '└ `.yt lofi hip hop`\n' +
                        '└ `.yt info https://youtube.com/watch?v=dQw4w9WgXcQ`')
                    .setFooter({ text: 'ARCHITECT CG-223 • YouTube Integration' })
                ]
            });
        }

        const fullQuery = args.join(' ');

// 🔥 SMART DETECTION: Auto-detect if user passed a URL instead of search query
const detectedVideoId = extractVideoId(fullQuery);
if (detectedVideoId) {
    return handleVideoInfo(message, fullQuery, false);
}

const sub = args[0]?.toLowerCase();

// Info mode
if (sub === 'info') {
            const url = args.slice(1).join(' ');
            if (!url) return message.reply('❌ Please provide a YouTube URL or video ID.');
            return handleVideoInfo(message, url, false);
        }

        // Search mode (default)
        const query = args.join(' ');
        return handleYouTubeSearch(message, query, 5, false);
    },

    // ================= SLASH COMMAND EXECUTION =================
    execute: async (interaction) => {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'search') {
            const query = interaction.options.getString('query');
            const results = interaction.options.getInteger('results') || 5;
            await interaction.deferReply();
            return handleYouTubeSearch(interaction, query, results, true);
        }

        if (subcommand === 'info') {
            const url = interaction.options.getString('url');
            await interaction.deferReply();
            return handleVideoInfo(interaction, url, true);
        }
    }
};

// ================= YOUTUBE API CONFIGURATION =================
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3';

// ================= HELPER: EXTRACT VIDEO ID =================
function extractVideoId(url) {
    // Already an ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
    
    // Full URL patterns
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    
    return null;
}

// ================= FORMAT DURATION =================
function formatDuration(isoDuration) {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 'Unknown';
    
    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// ================= FORMAT VIEW COUNT =================
function formatViews(views) {
    if (!views) return 'N/A';
    const num = parseInt(views);
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
}

// ================= FORMAT DATE =================
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
}

// ================= FETCH VIDEO DETAILS =================
async function fetchVideoDetails(videoId) {
    try {
        const response = await axios.get(`${YOUTUBE_API_URL}/videos`, {
            params: {
                part: 'snippet,contentDetails,statistics',
                id: videoId,
                key: YOUTUBE_API_KEY
            },
            timeout: 8000
        });

        if (!response.data.items?.length) return null;

        const video = response.data.items[0];
        const snippet = video.snippet;
        const stats = video.statistics;
        const content = video.contentDetails;

        return {
            id: videoId,
            title: snippet.title,
            description: snippet.description?.substring(0, 200) + '...',
            channelName: snippet.channelTitle,
            channelId: snippet.channelId,
            publishedAt: snippet.publishedAt,
            duration: formatDuration(content.duration),
            views: formatViews(stats.viewCount),
            likes: formatViews(stats.likeCount),
            comments: formatViews(stats.commentCount),
            thumbnails: snippet.thumbnails,
            url: `https://youtube.com/watch?v=${videoId}`,
            channelUrl: `https://youtube.com/channel/${snippet.channelId}`
        };
    } catch (error) {
        console.error(`${red}[YT API ERROR]${reset}`, error.message);
        return null;
    }
}

// ================= SEARCH YOUTUBE =================
async function searchYouTube(query, maxResults = 5) {
    // Check cache first
    const cacheKey = `search:${query.toLowerCase().trim()}`;
    if (searchCache.has(cacheKey)) {
        console.log(`${green}[YT CACHE]${reset} Using cached results for: "${query}"`);
        return searchCache.get(cacheKey);
    }

    try {
        // If no API key, do a web scrape fallback
        if (!YOUTUBE_API_KEY) {
            return await scrapeYouTubeSearch(query, maxResults);
        }

        const response = await axios.get(`${YOUTUBE_API_URL}/search`, {
    params: {
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults: maxResults,
        key: YOUTUBE_API_KEY,
        safeSearch: 'strict',
        videoEmbeddable: true,
        regionCode: 'US'
    },
    timeout: 8000
});

        const videoIds = response.data.items.map(item => item.id.videoId).join(',');
        
        // Fetch detailed info for all videos
        const detailsResponse = await axios.get(`${YOUTUBE_API_URL}/videos`, {
            params: {
                part: 'snippet,contentDetails,statistics',
                id: videoIds,
                key: YOUTUBE_API_KEY
            },
            timeout: 8000
        });

        const results = detailsResponse.data.items.map(video => ({
    id: video.id,
    title: video.snippet.title,
    channelName: video.snippet.channelTitle,
    publishedAt: formatDate(video.snippet.publishedAt),
    duration: formatDuration(video.contentDetails.duration),
    views: formatViews(video.statistics.viewCount),
    thumbnail: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url,
    url: `https://youtube.com/watch?v=${video.id}`
}));

// 🔒 SFW Title Filter — Top.gg Approved
const blockedWords = [
    'nsfw', '18+', 'explicit', 'adult', 'xxx', 'porn', 'sex',
    'adult content', 'onlyfans', 'nsfw content', 'sexual'
];
const safeResults = results.filter(video => {
    const lowerTitle = (video.title || '').toLowerCase();
    return !blockedWords.some(word => lowerTitle.includes(word));
});

// Cache results
searchCache.set(cacheKey, safeResults);
setTimeout(() => searchCache.delete(cacheKey), CACHE_TTL);

console.log(`${green}[YT SEARCH]${reset} Found ${safeResults.length} results for: "${query}" (${results.length - safeResults.length} filtered)`);
return safeResults;
    } catch (error) {
        console.error(`${red}[YT SEARCH ERROR]${reset}`, error.message);
        return null;
    }
}

// ================= FALLBACK: WEB SCRAPE (NO API KEY) =================
async function scrapeYouTubeSearch(query, maxResults = 5) {
    try {
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en&gl=US`;
        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });

        // Extract video IDs from initial data
        const jsonMatch = response.data.match(/var ytInitialData = ({.*?});/);
        if (!jsonMatch) return null;

        const data = JSON.parse(jsonMatch[1]);
        const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
        
        const results = [];
        for (const item of contents) {
            if (results.length >= maxResults) break;
            
            const videoRenderer = item.videoRenderer;
            if (!videoRenderer) continue;

            results.push({
                id: videoRenderer.videoId,
                title: videoRenderer.title?.runs?.[0]?.text || 'Unknown Title',
                channelName: videoRenderer.ownerText?.runs?.[0]?.text || 'Unknown Channel',
                publishedAt: videoRenderer.publishedTimeText?.simpleText || 'Unknown',
                duration: videoRenderer.lengthText?.simpleText || 'Unknown',
                views: videoRenderer.viewCountText?.simpleText || 'N/A',
                thumbnail: videoRenderer.thumbnail?.thumbnails?.[0]?.url || '',
                url: `https://youtube.com/watch?v=${videoRenderer.videoId}`
            });
        }

        // SFW Content Filter - Top.gg
const safeResults = results.filter(video => {
    const lowerTitle = (video.title || '').toLowerCase();
    const blockedWords = ['nsfw', '18+', 'explicit', 'adult', 'xxx', 'porn', 'sex'];
    return !blockedWords.some(word => lowerTitle.includes(word));
});

return safeResults.length > 0 ? safeResults : null;
    } catch (error) {
        console.error(`${red}[YT SCRAPE ERROR]${reset}`, error.message);
        return null;
    }
}

// ================= HANDLE VIDEO INFO - PROFESSIONAL EDITION =================
async function handleVideoInfo(context, input, isSlash) {
    const videoId = extractVideoId(input);
    if (!videoId) {
        const msg = '❌ **Invalid YouTube URL or ID**\nPlease provide a valid YouTube link.\nExample: `https://youtube.com/watch?v=dQw4w9WgXcQ`';
        return isSlash ? context.editReply(msg) : context.reply(msg);
    }

    // Show typing indicator for prefix commands
    if (!isSlash && context.channel) {
        await context.channel.sendTyping().catch(() => {});
    }

    const video = await fetchVideoDetails(videoId);
    if (!video) {
        const msg = '❌ **Video Not Found**\nThe video may be private, deleted, or the API quota has been exhausted.\nTry again later or use a different link.';
        return isSlash ? context.editReply(msg) : context.reply(msg);
    }

    // ================= INTELLIGENT COLOR GENERATION =================
    // Generate a visually appealing color from the video title
    let hash = 0;
    for (let i = 0; i < video.title.length; i++) {
        hash = video.title.charCodeAt(i) + ((hash << 5) - hash);
    }
    const dynamicColor = Math.abs(hash) % 0xFFFFFF;
    
    // Ensure the color is vibrant enough (not too dark or too gray)
    const r = (dynamicColor >> 16) & 255;
    const g = (dynamicColor >> 8) & 255;
    const b = dynamicColor & 255;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
    const finalColor = luminance < 80 ? dynamicColor + 0x444444 : dynamicColor;

    // ================= INTELLIGENT DESCRIPTION FORMATTING =================
    let description = video.description || '';
    
    // Clean up the description
    if (description.length > 500) {
        // Find the last complete sentence within 500 chars
        const truncated = description.substring(0, 500);
        const lastPeriod = truncated.lastIndexOf('. ');
        const lastNewline = truncated.lastIndexOf('\n');
        const cutPoint = Math.max(lastPeriod, lastNewline);
        
        if (cutPoint > 300) {
            description = truncated.substring(0, cutPoint + 1) + '\n\n*... View on YouTube for full description*';
        } else {
            description = truncated + '...\n\n*View on YouTube for full description*';
        }
    }
    
    // Remove excessive newlines
    description = description.replace(/\n{4,}/g, '\n\n\n');
    
    // Add subtle formatting for links in description
    description = description.replace(/(https?:\/\/[^\s]+)/g, '[$1]($1)');

    // ================= ENGAGEMENT METER =================
    const viewsNum = parseInt(video.views?.replace(/[^0-9.]/g, '')) || 0;
    const likesNum = parseInt(video.likes?.replace(/[^0-9.]/g, '')) || 0;
    
    let engagementRating = '';
    let engagementEmoji = '';
    if (likesNum > 0 && viewsNum > 0) {
        const engagementRate = (likesNum / viewsNum) * 100;
        if (engagementRate > 10) {
            engagementRating = '🔥 Viral';
            engagementEmoji = '🦅';
        } else if (engagementRate > 5) {
            engagementRating = '⭐ Excellent';
            engagementEmoji = '💎';
        } else if (engagementRate > 2) {
            engagementRating = '👍 Great';
            engagementEmoji = '✨';
        } else {
            engagementRating = '📈 Standard';
            engagementEmoji = '📊';
        }
    }

    // ================= BUILD PROFESSIONAL EMBED =================
    const embed = new EmbedBuilder()
        .setColor(finalColor)
        .setAuthor({ 
            name: `📹 ${video.title}`,
            iconURL: 'https://www.youtube.com/s/desktop/12d6b690/img/favicon_144x144.png',
            url: video.url
        })
        .setDescription(description || '*No description provided by creator*')
        .setThumbnail(video.thumbnails?.maxres?.url || video.thumbnails?.high?.url || video.thumbnails?.medium?.url)
        .setImage(video.thumbnails?.maxres?.url || null) // Full-width thumbnail for dramatic effect
        .addFields(
            { 
                name: '📊 **Video Statistics**',
                value: [
                    `👁️ **Views** ─ \`${video.views}\``,
                    `👍 **Likes** ─ \`${video.likes || 'Hidden'}\``,
                    `💬 **Comments** ─ \`${video.comments || 'Hidden'}\``,
                    `⏱️ **Duration** ─ \`${video.duration}\``
                ].join('\n'),
                inline: true
            },
            { 
                name: '📡 **Channel Information**',
                value: [
                    `📺 **Channel** ─ [${video.channelName}](${video.channelUrl})`,
                    `📅 **Published** ─ ${formatDate(video.publishedAt)}`,
                    `🏷️ **Video ID** ─ \`${video.id}\``,
                    engagementEmoji ? `${engagementEmoji} **Rating** ─ ${engagementRating}` : ''
                ].filter(line => line).join('\n'),
                inline: true
            }
        )
        .addFields({
            name: '🔗 **Quick Actions**',
            value: [
                `🎬 **[Watch on YouTube](${video.url})**`,
                `📺 **[Visit Channel](${video.channelUrl})**`,
                `🔗 **Share:** \`${video.url}\``
            ].join('  •  '),
            inline: false
        })
        .setFooter({ 
            text: 'ARCHITECT CG-223 • YouTube Neural Parser • Real-time Data',
            iconURL: context.client?.user?.displayAvatarURL?.() || '' 
        })
        .setTimestamp();

    // ================= SEND RESPONSE =================
    const reply = { embeds: [embed] };
    
    if (isSlash) {
        return context.editReply(reply).catch(() => context.followUp(reply));
    } else {
        return context.reply(reply).catch(() => context.channel.send(reply));
    }
}

// ================= HANDLE YOUTUBE SEARCH =================
async function handleYouTubeSearch(context, query, maxResults, isSlash) {
    const sendTyping = !isSlash && context.channel ? context.channel.sendTyping() : Promise.resolve();
    await sendTyping;

    const results = await searchYouTube(query, maxResults);
    
    if (!results || !results.length) {
        const msg = '❌ **No results found**\nTry a different search query. If the problem persists, the YouTube API quota may be exhausted.';
        return isSlash ? context.editReply(msg) : context.reply(msg);
    }

    // Professional search results embed
    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setAuthor({ 
            name: `🔍 YouTube Search: "${query}"`, 
            iconURL: 'https://www.youtube.com/favicon.ico' 
        })
        .setDescription(`Showing **${results.length}** result${results.length > 1 ? 's' : ''}`)
        .setFooter({ 
            text: `ARCHITECT CG-223 • YouTube Neural Search • Cached for 5min`,
            iconURL: context.client?.user?.displayAvatarURL?.() || '' 
        })
        .setTimestamp();

    // Add each result as a field with rich formatting
    results.forEach((video, index) => {
        const numberEmoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'][index] || '▶️';
        embed.addFields({
            name: `${numberEmoji} **${video.title?.substring(0, 80)}${video.title?.length > 80 ? '...' : ''}**`,
            value: [
                `📺 **Channel:** ${video.channelName}`,
                `⏱️ **Duration:** \`${video.duration}\` | 👁️ **Views:** \`${video.views}\``,
                `📅 **Published:** ${video.publishedAt}`,
                `🔗 [Watch Video](${video.url})`
            ].join('\n'),
            inline: false
        });
    });

    // Add a hint about info command
    embed.addFields({
        name: '💡 **Tip**',
        value: 'Use `/youtube info <url>` or `.yt info <url>` for detailed video information!',
        inline: false
    });

    const reply = { embeds: [embed] };
    return isSlash ? context.editReply(reply) : context.reply(reply);
}