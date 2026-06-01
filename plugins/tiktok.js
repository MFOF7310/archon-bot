const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const axios = require('axios');

// ═══════════════════════════════════════════════════════════════════
//  ARCHITECT CG-223  •  TIKTOK NOTIFICATION ENGINE v2.0
//  Handles: Live Stream Alerts + New Video Upload Notifications
//  Polling: Every 5 minutes via self-healing interval
//  Security: Server Owner ONLY for configuration
//  NOTE: TikTok aggressively blocks datacenter IPs. Uses layered
//        fallback strategy: API > oEmbed > HTML scraping.
// ═══════════════════════════════════════════════════════════════════

// ================= SCRAPING CONFIG =================
const SCRAPE_CONFIG = {
    // Polling interval: 5 minutes (300 seconds)
    POLL_INTERVAL_MS: 5 * 60 * 1000,
    // Request timeout: 12 seconds (Starlink resilience)
    TIMEOUT_MS: 12000,
    // Max retries per method before moving to next fallback
    MAX_RETRIES: 3,
    // Minimum minutes between live notifications for same user (prevents spam)
    NOTIFICATION_COOLDOWN_MINUTES: 30,
    // Realistic browser headers to avoid bot detection
    HEADERS: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.tiktok.com/',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
    }
};

// ================= MODULE STATE =================
let pollingInterval = null;
let isPolling = false;
const failCounters = new Map();
const lastKnownStates = new Map();
const lastNotificationTime = new Map();

// UPDATED STATE LOGIC:
const consecutiveLiveChecks = new Map();
const consecutiveOfflineChecks = new Map(); // Track consecutive offline hits

const REQUIRED_CONSECUTIVE_LIVE_CHECKS = 1; // Instant trigger!
const REQUIRED_OFFLINE_CHECKS = 3; // Wait 15 mins (3 checks) of silence before marking offline

// ================= DATABASE INITIALIZATION =================
function initDatabase(db) {
    if (!db) return;
    db.exec(`
        CREATE TABLE IF NOT EXISTS tiktok_notifications (
            guild_id TEXT NOT NULL,
            tiktok_username TEXT NOT NULL COLLATE NOCASE,
            target_channel_id TEXT NOT NULL,
            last_video_id TEXT DEFAULT NULL,
            is_live INTEGER DEFAULT 0,
            force_mode INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            PRIMARY KEY (guild_id, tiktok_username)
        )
    `);
    // Add force_mode column if it doesn't exist (migration for existing tables)
    try {
        db.exec(`ALTER TABLE tiktok_notifications ADD COLUMN force_mode INTEGER DEFAULT 0`);
    } catch (e) { /* column already exists */ }
    try {
        db.exec(`CREATE INDEX IF NOT EXISTS idx_tiktok_guild ON tiktok_notifications(guild_id)`);
    } catch (e) {}
}

// ================= OWNER SECURITY CHECK =================
function isGuildOwner(message) {
    return message.author.id === message.guild.ownerId;
}

function buildOwnerErrorEmbed(client, guild, lang = 'en') {
    const t = {
        fr: { title: '🔒 ACCÈS RESTREINT', desc: 'Seul le **propriétaire du serveur** peut gérer les notifications TikTok.', footer: 'ARCHITECT CG-223 • Sécurité Propriétaire' },
        en: { title: '🔒 RESTRICTED ACCESS', desc: 'Only the **server owner** can manage TikTok notifications.', footer: 'ARCHITECT CG-223 • Owner Security' }
    }[lang] || t.en;

    return new EmbedBuilder().setColor('#e74c3c').setAuthor({ name: '🛡️ ' + t.title, iconURL: guild.iconURL() || client.user.displayAvatarURL() }).setDescription(t.desc).setFooter({ text: t.footer }).setTimestamp();
}

// ═══════════════════════════════════════════════════════════════════
//  TIKTOK FETCHING ENGINE — LAYERED FALLBACK STRATEGY
//  Layer 1: Internal Web API (most reliable if accessible)
//  Layer 2: oEmbed API (publicly accessible, limited data)
//  Layer 3: HTML scraping with embedded JSON parsing
//  Layer 4: Live-specific endpoint check
// ═══════════════════════════════════════════════════════════════════

/**
 * Layer 1: Try TikTok's internal web API endpoint
 * This sometimes works from certain IPs with proper headers
 */
async function fetchViaWebApi(username) {
    const url = `https://www.tiktok.com/api/user/detail/?uniqueId=${username}&scene=0`;
    const response = await axios.get(url, {
        headers: { ...SCRAPE_CONFIG.HEADERS, 'Accept': 'application/json, text/plain, */*' },
        timeout: SCRAPE_CONFIG.TIMEOUT_MS,
        maxRedirects: 2
    });

    if (!response.data?.userInfo) return null;

    const u = response.data.userInfo;
    const user = u.user || {};
    const stats = u.stats || {};

    return buildResult(user, stats, null, !!u.roomId, u, username);
}

/**
 * Layer 2: Try TikTok's oEmbed endpoint (publicly accessible)
 * Limited data but works from most IPs
 */
async function fetchViaOembed(username) {
    // First try profile oembed
    let url = `https://www.tiktok.com/oembed?url=https://www.tiktok.com/@${username}`;
    let response = await axios.get(url, {
        headers: { 'User-Agent': SCRAPE_CONFIG.HEADERS['User-Agent'] },
        timeout: SCRAPE_CONFIG.TIMEOUT_MS,
        maxRedirects: 2
    });

    if (!response.data) return null;

    const oembed = response.data;

    // oEmbed doesn't give us live status or latest video — just basic profile info
    // But it confirms the user exists and gives us avatar + nickname
    return buildResult(
        {
            nickname: oembed.author_name || username,
            avatarThumb: oembed.thumbnail_url || null,
            signature: oembed.title || '',
            verified: false,
            roomId: null  // oEmbed doesn't expose live status
        },
        null,  // no stats
        null,  // no video
        false,  // live status unknown
        null,
        username
    );
}

/**
 * Layer 3: HTML scraping with embedded JSON parsing
 * Most data-rich but most likely to be blocked
 */
async function fetchViaHtmlScrape(username) {
    const url = `https://www.tiktok.com/@${username}`;
    const response = await axios.get(url, {
        headers: SCRAPE_CONFIG.HEADERS,
        timeout: SCRAPE_CONFIG.TIMEOUT_MS,
        maxRedirects: 3,
        decompress: true
    });

    const html = response.data;

    // ─── METHOD A: __UNIVERSAL_DATA_FOR_REHYDRATION__ ───
    const universalMatch = html.match(
        /<script[^>]*>\s*window\.__UNIVERSAL_DATA_FOR_REHYDRATION__\s*=\s*({.+?})\s*<\/script>/s
    );
    if (universalMatch) {
        const data = JSON.parse(universalMatch[1]);
        return parseUniversalData(data, username);
    }

    // ─── METHOD B: SIGI_STATE ───
    const sigiMatch = html.match(
        /<script[^>]*>\s*window\._{0,2}SIGI_STATE__\s*=\s*({.+?})\s*<\/script>/s
    );
    if (sigiMatch) {
        const data = JSON.parse(sigiMatch[1]);
        return parseSigiState(data, username);
    }

    // ─── METHOD C: __INIT_PROPS__ ───
    const propsMatch = html.match(
        /<script[^>]*>\s*window\.__INIT_PROPS__\s*=\s*({.+?})\s*<\/script>/s
    );
    if (propsMatch) {
        const data = JSON.parse(propsMatch[1]);
        return parseInitProps(data, username);
    }

    // ─── METHOD D: ld+json ───
    const ldMatch = html.match(
        /<script type="application\/ld\+json">\s*({.+?})\s*<\/script>/gs
    );
    if (ldMatch) {
        return parseLdJson(ldMatch, username);
    }

    return null;
}

/**
 * Layer 4: Live-specific endpoint check
 */
async function fetchLiveStatus(username) {
    try {
        const url = `https://www.tiktok.com/@${username}/live`;
        const response = await axios.get(url, {
            headers: SCRAPE_CONFIG.HEADERS,
            timeout: 8000,
            maxRedirects: 2,
            validateStatus: status => status < 500
        });

        const finalUrl = response.request?.res?.responseUrl || response.request?.path || '';
        if (response.status === 404 || !finalUrl.includes('/live')) {
            return { isLive: false, roomId: null, liveCover: null };
        }

        const html = response.data;
        const titleMatch = html.match(/<title>([^<]*)<\/title>/);
        const titleHasLive = titleMatch && /LIVE/i.test(titleMatch[1]);
        
        const roomIdMatch = html.match(/"roomId":"(\d{10,})"/);
        const roomId = roomIdMatch ? roomIdMatch[1] : null;
        
        let liveCover = null;
        const indicators = [];
        
        if (roomId) indicators.push('roomId');
        if (html.includes('"isLive":true')) indicators.push('isLive');
        
        // FIXED: 2 is ACTIVE, 4 is ENDED. Do not flag on 4!
        if (html.includes('"status":2')) indicators.push('status2'); 
        
        if (titleHasLive) indicators.push('titleLive');
        if (html.includes('liveRoomUserInfo')) indicators.push('liveRoomInfo');

        // STRICT DECISION: Must have Room ID AND be actively live (not status 4)
        const isEnded = html.includes('"status":4');
        const hasEnoughIndicators = roomId && indicators.length >= 2 && !isEnded;
        
        if (hasEnoughIndicators) {
            const coverMatch = html.match(/"coverUrl":"(https:[^"]+)"/);
            if (coverMatch) liveCover = coverMatch[1].replace(/\\u002F/g, '/');
            return { isLive: true, roomId, liveCover };
        }

        return { isLive: false, roomId: null, liveCover: null };
    } catch {
        return { isLive: false, roomId: null, liveCover: null };
    }
}

// ─── Unified Fetch with Layered Fallback ───
async function fetchTikTokUser(username) {
    const cleanUsername = username.replace(/^@/, '').trim().toLowerCase();

    // ─── LAYER 1: Web API ───
    for (let attempt = 1; attempt <= SCRAPE_CONFIG.MAX_RETRIES; attempt++) {
        try {
            const data = await fetchViaWebApi(cleanUsername);
            if (data) {
                failCounters.delete(cleanUsername);
                lastKnownStates.set(cleanUsername, { isLive: data.isLive, lastVideoId: data.latestVideo?.id || null, timestamp: Date.now() });
                return data;
            }
        } catch { /* silent */ }
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }

    // ─── LAYER 2: oEmbed ───
    try {
        const data = await fetchViaOembed(cleanUsername);
        if (data) {
            // oEmbed doesn't expose live status — merge with live check
            const liveCheck = await fetchLiveStatus(cleanUsername);
            if (liveCheck.isLive) {
                data.isLive = true;
                data.roomId = liveCheck.roomId;
                data.liveCover = liveCheck.liveCover;
            }
            failCounters.delete(cleanUsername);
            lastKnownStates.set(cleanUsername, { isLive: data.isLive, lastVideoId: null, timestamp: Date.now() });
            return data;
        }
    } catch { /* silent */ }

    // ─── LAYER 3: HTML Scrape ───
    for (let attempt = 1; attempt <= SCRAPE_CONFIG.MAX_RETRIES; attempt++) {
        try {
            const data = await fetchViaHtmlScrape(cleanUsername);
            if (data) {
                failCounters.delete(cleanUsername);
                lastKnownStates.set(cleanUsername, { isLive: data.isLive, lastVideoId: data.latestVideo?.id || null, timestamp: Date.now() });
                return data;
            }
        } catch { /* silent */ }
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }

    // ─── LAYER 4: Live-only check ───
    try {
        const liveCheck = await fetchLiveStatus(cleanUsername);
        if (liveCheck.isLive) {
            return buildResult(
                { nickname: cleanUsername, avatarThumb: null, signature: '', verified: false, roomId: liveCheck.roomId },
                null, null, true, null, cleanUsername, liveCheck.liveCover
            );
        }
    } catch { /* silent */ }

    // ─── ALL FAILED ───
    const currentFails = (failCounters.get(cleanUsername) || 0) + 1;
    failCounters.set(cleanUsername, currentFails);
    // Tracking unreachable state silently
    return null;
}

// ─── Parsers ───
function parseUniversalData(data, username) {
    try {
        const defaultScope = data['__DEFAULT_SCOPE__']?.['webapp.user-detail'];
        if (!defaultScope) return null;

        const userInfo = defaultScope.userInfo;
        const user = userInfo?.user;
        const stats = userInfo?.stats;
        const isLive = userInfo?.roomId || false;
        const liveRoomInfo = defaultScope?.liveRoom?.liveRoomUserInfo || null;
        const itemList = defaultScope?.itemList || [];
        const latestVideo = itemList.length > 0 ? itemList[0] : null;

        return buildResult(user, stats, latestVideo, isLive, liveRoomInfo, username);
    } catch (e) { return null; }
}

function parseSigiState(data, username) {
    try {
        const userModule = data.UserModule?.users?.[username];
        if (!userModule) return null;

        const isLive = !!userModule.roomId;
        const itemModule = data.ItemModule || {};
        const videos = Object.values(itemModule).sort((a, b) => (b.createTime || 0) - (a.createTime || 0));
        const latestVideo = videos[0] || null;

        return buildResult(
            { nickname: userModule.nickname, avatarThumb: userModule.avatarThumb, signature: userModule.signature, verified: userModule.verified, roomId: userModule.roomId },
            { followerCount: userModule.followerCount, followingCount: userModule.followingCount, heartCount: userModule.heartCount, videoCount: userModule.videoCount },
            latestVideo, isLive, null, username
        );
    } catch (e) { return null; }
}

function parseInitProps(data, username) {
    try {
        const pageProps = data['/user/:uniqueId']?.pageProps || {};
        const userInfo = pageProps.userInfo;
        const isLive = userInfo?.roomId || false;
        return buildResult(userInfo?.user, userInfo?.stats, null, isLive, null, username);
    } catch (e) { return null; }
}

function parseLdJson(matches, username) {
    try {
        for (const match of matches) {
            const data = JSON.parse(match);
            if (data['@type'] === 'Person' || data.mainEntity) {
                const person = data.mainEntity || data;
                return buildResult({ nickname: person.name, avatarThumb: person.image, signature: person.description, verified: false, roomId: null }, null, null, false, null, username);
            }
        }
        return null;
    } catch (e) { return null; }
}

// ─── Unified Result Builder ───
function buildResult(user, stats, latestVideo, isLive, liveRoomInfo, username, liveCover = null) {
    const result = {
        username, nickname: user?.nickname || username,
        avatar: user?.avatarThumb || user?.avatarMedium || null,
        bio: user?.signature || '', verified: user?.verified || false,
        isLive: !!isLive, roomId: user?.roomId || liveRoomInfo?.roomId || null,
        liveCover,
        stats: {
            followers: stats?.followerCount || stats?.follower || 0,
            following: stats?.followingCount || stats?.following || 0,
            likes: stats?.heartCount || stats?.diggCount || 0,
            videos: stats?.videoCount || 0
        },
        latestVideo: latestVideo ? {
            id: latestVideo.id || latestVideo.video?.id || latestVideo.itemStruct?.id,
            desc: latestVideo.desc || latestVideo.video?.desc || latestVideo.itemStruct?.desc || 'No caption',
            cover: latestVideo.video?.cover || latestVideo.video?.dynamicCover || latestVideo.video?.originCover || null,
            playCount: latestVideo.stats?.playCount || latestVideo.stats?.vplayCount || 0,
            likeCount: latestVideo.stats?.diggCount || latestVideo.stats?.digg || 0,
            commentCount: latestVideo.stats?.commentCount || 0,
            shareCount: latestVideo.stats?.shareCount || 0,
            createTime: latestVideo.createTime || latestVideo.video?.createTime || null,
            url: `https://www.tiktok.com/@${username}/video/${latestVideo.id || latestVideo.video?.id || latestVideo.itemStruct?.id}`
        } : null
    };
    failCounters.delete(username);
    return result;
}

// ================= EMBED BUILDERS =================

/**
 * Professional live notification embed with real stream cover
 * and invitation-style messaging
 */
function buildLiveEmbed(data, guild, client) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel('🔗 Watch Stream')
            .setStyle(ButtonStyle.Link)
            .setURL(`https://www.tiktok.com/@${data.username}/live`)
            .setEmoji('🔴'),
        new ButtonBuilder()
            .setLabel(`@${data.username} on TikTok`)
            .setStyle(ButtonStyle.Link)
            .setURL(`https://www.tiktok.com/@${data.username}`)
            .setEmoji('👤')
    );

    // Use real stream cover if available, else avatar as banner, else placeholder
    const bannerImage = data.liveCover || data.avatar || 'https://cdn-icons-png.flaticon.com/512/3046/3046126.png';
   
    // Professional invitation copy
const inviteLines = [
    `🔴 **${data.nickname}** is streaming LIVE on TikTok right now!`,
    ``,
    `Come hang out and join the chat — don't miss out! 🎉`
];

// Only show stats if they're real (not zeroed out from oEmbed fallback)
if (data.stats.followers > 0 || data.stats.likes > 0) {
    inviteLines.push(``);
    inviteLines.push(
        `👥 **Followers:** \`${Number(data.stats.followers).toLocaleString()}\`  ` +
        `❤️ **Likes:** \`${Number(data.stats.likes).toLocaleString()}\``
    );
}
    // Add bio quote only if it's meaningful (not the generic "Creator Profile" text)
    if (data.bio && data.bio.length > 5 && !data.bio.includes('Creator Profile')) {
        inviteLines.splice(2, 0, `> *"${data.bio.substring(0, 120)}${data.bio.length > 120 ? '...' : ''}"*`);
        inviteLines.splice(3, 0, ``);
    }

    const embed = new EmbedBuilder().setColor('#FF0050')
        .setAuthor({
            name: `🔴 LIVE NOW  •  @${data.username.toUpperCase()}`,
            iconURL: data.avatar || client.user.displayAvatarURL(),
            url: `https://www.tiktok.com/@${data.username}/live`
        })
        .setTitle(`${data.verified ? '✅ ' : ''}Join the Live Stream!`)
        .setDescription(inviteLines.join('\n'))
        .setThumbnail(data.avatar || null)
        .setImage(bannerImage)
        .setFooter({ text: `ARCHITECT CG-223  •  TikTok Live  •  @${data.username}  •  Started`, iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

    return { embed, row };
}

function buildVideoEmbed(data, guild, client) {
    const video = data.latestVideo;
    if (!video) return null;

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('▶️ Watch Video').setStyle(ButtonStyle.Link).setURL(video.url).setEmoji('🎬')
    );

    const postedAgo = video.createTime ? `<t:${video.createTime}:R>` : 'Recently';

    const embed = new EmbedBuilder().setColor('#00F2FE')
        .setAuthor({ name: `🎬 NEW TIKTOK VIDEO  •  @${data.username.toUpperCase()}`, iconURL: data.avatar || client.user.displayAvatarURL(), url: video.url })
        .setTitle(`${data.verified ? '✅ ' : ''}${data.nickname}`)
        .setDescription(
            `> ${video.desc.substring(0, 300)}${video.desc.length > 300 ? '...' : ''}\n\n` +
            `📅 **Posted:** ${postedAgo}\n` +
            `▶️ **Views:** \`${Number(video.playCount).toLocaleString()}\`  ` +
            `❤️ **Likes:** \`${Number(video.likeCount).toLocaleString()}\`  ` +
            `💬 **Comments:** \`${Number(video.commentCount).toLocaleString()}\`  ` +
            `🔄 **Shares:** \`${Number(video.shareCount).toLocaleString()}\``
        )
        .setThumbnail(data.avatar || null)
        .setImage(video.cover)
        .setFooter({ text: `ARCHITECT CG-223  •  TikTok Video Detection  •  @${data.username}`, iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

    return { embed, row };
}

// ================= NOTIFICATION SENDER =================
/**
 * Checks if enough time has passed since the last live notification for this user.
 * Prevents spam from false positives or rapid state changes.
 */
function canNotifyLive(username) {
    const lastTime = lastNotificationTime.get(username);
    if (!lastTime) return true;
    const cooldownMs = SCRAPE_CONFIG.NOTIFICATION_COOLDOWN_MINUTES * 60 * 1000;
    return (Date.now() - lastTime) >= cooldownMs;
}

async function sendNotification(client, db, guildId, username, data, type) {
    try {
        if (type === 'live' && !canNotifyLive(username)) {
            return false; 
        }

        const tracking = db.prepare('SELECT target_channel_id FROM tiktok_notifications WHERE guild_id = ? AND tiktok_username = ? COLLATE NOCASE').get(guildId, username);
        if (!tracking) return false;

        const guild = client.guilds.cache.get(guildId);
        if (!guild) return false;

        const channel = guild.channels.cache.get(tracking.target_channel_id);
        if (!channel) return false;

        const botMember = guild.members.me;
        const canSend = channel.permissionsFor(botMember)?.has(['SendMessages', 'EmbedLinks', 'MentionEveryone']);
        if (!canSend) return false;

        // ─── GESTION DES EMBEDS SELON LE TYPE ───
        let embedToSend;
        let rowToSend;
        let contentMessage = '';

        if (type === 'live') {
            const result = buildLiveEmbed(data, guild, client);
            if (!result) return false;
            embedToSend = result.embed;
            rowToSend = result.row;
            contentMessage = `@everyone 🔴 **${data.nickname}** is LIVE on TikTok right now!`;
        } 
        else if (type === 'video') {
            const result = buildVideoEmbed(data, guild, client);
            if (!result) return false;
            embedToSend = result.embed;
            rowToSend = result.row;
            contentMessage = `🎬 **NEW VIDEO** from @${data.username}!`;
        } 
        else if (type === 'system_test') {
            // ─── LE BEAU LAYOUT DE TEST (STYLE FÉVRIER) ───
            rowToSend = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('🔗 Layout Link Check')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://www.tiktok.com/@${data.username}`),
                new ButtonBuilder()
                    .setLabel('👤 Profile')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://www.tiktok.com/@${data.username}`)
            );

            embedToSend = new EmbedBuilder()
                .setColor('#FF0050')
                .setAuthor({ 
                    name: `📱 ${data.username.toUpperCase()} (SYSTEM TEST)`, 
                    iconURL: data.avatar || client.user.displayAvatarURL() 
                })
                .setTitle('🔴 LIVE ON TIKTOK')
                .setDescription(
    `**${data.nickname}** is now live! *(This is a system test to check the layout)*\n\n` +
    `📊 **Platform:** \`TikTok Live\`\n` +
    `⚡ **Status:** \`Testing ⚡\`` +
    (data.stats.followers > 0 || data.stats.likes > 0 
        ? `\n\n👥 **Followers:** \`${Number(data.stats.followers).toLocaleString()}\` | ❤️ **Likes:** \`${Number(data.stats.likes).toLocaleString()}\`` 
        : '')
)
                .setThumbnail(data.avatar || null)
                .setFooter({ 
                    text: `Cloud Gaming-223 Test Suite | ${new Date().toLocaleDateString()}`, 
                    iconURL: client.user.displayAvatarURL() 
                })
                .setTimestamp();

            contentMessage = `📢 **TEST:** @${data.username} layout verification suite.`;
        }

        await channel.send({
            content: contentMessage,
            embeds: [embedToSend],
            components: rowToSend ? [rowToSend] : []
        });

        if (type === 'live') {
            lastNotificationTime.set(username, Date.now());
        }

        return true;
    } catch (err) {
        return false;
    }
}

// ================= POLLING ENGINE =================
function startPolling(client, db) {
    if (isPolling) return;
    isPolling = true;
    // Polling engine started silently
    runPollingCycle(client, db);
    pollingInterval = setInterval(() => runPollingCycle(client, db), SCRAPE_CONFIG.POLL_INTERVAL_MS);
}

function stopPolling() {
    if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
    isPolling = false;
    // Engine stopped silently
}

async function runPollingCycle(client, db) {
    try {
        const allTracks = db.prepare('SELECT * FROM tiktok_notifications').all();
        if (allTracks.length === 0) return;

        const usernameToTracks = new Map();
        for (const track of allTracks) {
            const key = track.tiktok_username.toLowerCase();
            if (!usernameToTracks.has(key)) usernameToTracks.set(key, []);
            usernameToTracks.get(key).push(track);
        }

        for (const [username, tracks] of usernameToTracks) {
            try {
                await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
                const data = await fetchTikTokUser(username);

                if (data) {
                    for (const track of tracks) {
                        await processUserForGuild(client, db, track, data);
                    }
                }
                // Silently skip on fetch failure - maintain last known state
            } catch (err) {
                // Silent fail - will retry next cycle
            }
        }
    } catch (err) {
        // Silent fail
    }
}

async function processUserForGuild(client, db, track, data) {
    const { guild_id, tiktok_username, last_video_id, is_live } = track;
    const wasLive = is_live === 1;
    const nowLive = data.isLive;

    // ─── LIVE STATUS LOGIC ───
    if (nowLive) {
        // Reset offline checks since we found them live
        consecutiveOfflineChecks.delete(tiktok_username);
        
        if (!wasLive) {
            const consecutiveCount = (consecutiveLiveChecks.get(tiktok_username) || 0) + 1;
            consecutiveLiveChecks.set(tiktok_username, consecutiveCount);
            
            if (consecutiveCount >= REQUIRED_CONSECUTIVE_LIVE_CHECKS) {
                if (canNotifyLive(tiktok_username)) {
                    const sent = await sendNotification(client, db, guild_id, tiktok_username, data, 'live');
                    if (sent) {
                        db.prepare('UPDATE tiktok_notifications SET is_live = 1 WHERE guild_id = ? AND tiktok_username = ?')
                            .run(guild_id, tiktok_username);
                    }
                }
            }
        }
    } else {
        // Not currently live -> Check if we should mark them offline
        consecutiveLiveChecks.delete(tiktok_username);
        
        if (wasLive) {
            const offlineCount = (consecutiveOfflineChecks.get(tiktok_username) || 0) + 1;
            consecutiveOfflineChecks.set(tiktok_username, offlineCount);

            // Only mark offline in DB after multiple failed checks (Grace Period)
            if (offlineCount >= REQUIRED_OFFLINE_CHECKS) {
                db.prepare('UPDATE tiktok_notifications SET is_live = 0 WHERE guild_id = ? AND tiktok_username = ?')
                    .run(guild_id, tiktok_username);
                // Clear the cooldown so the next real stream can trigger immediately
                lastNotificationTime.delete(tiktok_username);
            }
        }
    }

    // ─── VIDEO CHECK ───
    if (data.latestVideo?.id) {
        const currentVideoId = String(data.latestVideo.id);
        if (last_video_id && last_video_id !== currentVideoId) {
            await sendNotification(client, db, guild_id, tiktok_username, data, 'video');
        }
        db.prepare('UPDATE tiktok_notifications SET last_video_id = ? WHERE guild_id = ? AND tiktok_username = ?')
            .run(currentVideoId, guild_id, tiktok_username);
    }
}

// ================= COMMANDS =================
function buildListEmbed(tracks, guild, client, lang = 'en') {
    const t = {
        fr: { title: '📋 SUIVI TIKTOK', desc: 'Comptes suivis:', empty: 'Aucun compte suivi.', live: '🔴 EN DIRECT', notLive: '⚫ Hors ligne' },
        en: { title: '📋 TIKTOK TRACKING', desc: 'Tracked accounts:', empty: 'No TikTok accounts tracked.', live: '🔴 LIVE', notLive: '⚫ Offline' }
    }[lang] || t.en;

    const embed = new EmbedBuilder().setColor('#FF0050')
        .setAuthor({ name: t.title, iconURL: guild.iconURL() || client.user.displayAvatarURL() })
        .setFooter({ text: 'ARCHITECT CG-223 • TikTok Engine', iconURL: client.user.displayAvatarURL() }).setTimestamp();

    if (tracks.length === 0) { embed.setDescription(t.empty); return embed; }

    let desc = t.desc + '\n\n';
    tracks.forEach((track, i) => {
        const liveStatus = track.is_live === 1 ? t.live : t.notLive;
        const forceTag = track.force_mode === 1 ? ' ⚠️FORCED' : '';
        const lastVideo = track.last_video_id ? `🎬 \`${track.last_video_id.slice(-8)}\`` : '📭 No video';
        desc += `**${i + 1}.** @${track.tiktok_username}${forceTag} ${liveStatus}\n   ↳ <#${track.target_channel_id}> | ${lastVideo}\n\n`;
    });
    embed.setDescription(desc.substring(0, 4000));
    return embed;
}

// ═══════════════════════════════════════════════════════════════════
//  PLUGIN EXPORT
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    name: 'tiktok',
    aliases: ['tt', 'tiktoknotif'],
    description: '📱 TikTok Live & Video notification system',
    category: 'UTILITY',
    usage: '.tiktok [set|remove|list|check|test] <username> <#channel> [--force]',
    cooldown: 3000,
    examples: ['.tiktok set charlidamelio #social-media', '.tiktok set charlidamelio #social-media --force', '.tiktok remove charlidamelio', '.tiktok list', '.tiktok check cloudgaming223', '.tiktok test cloudgaming223'],

    data: new SlashCommandBuilder().setName('tiktok').setDescription('📱 Manage TikTok notifications')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub.setName('set').setDescription('Add/update TikTok tracking')
            .addStringOption(o => o.setName('username').setDescription('TikTok username (without @)').setRequired(true))
            .addChannelOption(o => o.setName('channel').setDescription('Channel for notifications').setRequired(true))
            .addBooleanOption(o => o.setName('force').setDescription('Skip validation if TikTok blocks verification').setRequired(false)))
        .addSubcommand(sub => sub.setName('remove').setDescription('Remove TikTok tracking')
            .addStringOption(o => o.setName('username').setDescription('Username to remove').setRequired(true)))
        .addSubcommand(sub => sub.setName('list').setDescription('List tracked accounts'))
        .addSubcommand(sub => sub.setName('check').setDescription('Debug: manually check a TikTok user')
            .addStringOption(o => o.setName('username').setDescription('Username to check').setRequired(true)))
        .addSubcommand(sub => sub.setName('test').setDescription('Force-send a test live notification')
            .addStringOption(o => o.setName('username').setDescription('Tracked username to test').setRequired(true))),

    // ─── PREFIX COMMAND HANDLER ───
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand || '') : 'en';
        const guildId = message.guild?.id;
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();

        initDatabase(db);
        const action = args[0]?.toLowerCase() || 'list';

        // ─── CHECK (manual debug) ───
        if (action === 'check' || action === 'debug') {
            const username = args[1]?.replace(/^@/, '').trim();
            if (!username) return message.reply('❌ **Usage:** `.tiktok check <username>`');

            const statusMsg = await message.reply(`🔍 Testing all fetch layers for **${username}**...`);

            const results = [];

            // Layer 1
            try {
                const start = Date.now();
                const d = await fetchViaWebApi(username);
                results.push(`✅ **Web API:** ${d ? `Found! (${Date.now() - start}ms)` : 'No data'}${d?.isLive ? ' 🔴 LIVE' : ''}`);
            } catch (e) { results.push(`❌ **Web API:** ${e.message.substring(0, 80)}`); }

            // Layer 2
            try {
                const start = Date.now();
                const d = await fetchViaOembed(username);
                results.push(`✅ **oEmbed:** ${d ? `Found! (${Date.now() - start}ms)` : 'No data'}`);
            } catch (e) { results.push(`❌ **oEmbed:** ${e.message.substring(0, 80)}`); }

            // Layer 3
            try {
                const start = Date.now();
                const d = await fetchViaHtmlScrape(username);
                results.push(`✅ **HTML Scrape:** ${d ? `Found! (${Date.now() - start}ms)` : 'No data'}${d?.isLive ? ' 🔴 LIVE' : ''}`);
            } catch (e) { results.push(`❌ **HTML Scrape:** ${e.message.substring(0, 80)}`); }

            // Layer 4
            try {
                const d = await fetchLiveStatus(username);
                results.push(`✅ **Live Check:** ${d.isLive ? '🔴 LIVE!' : 'Not live'}`);
            } catch (e) { results.push(`❌ **Live Check:** ${e.message.substring(0, 80)}`); }

            const fullData = await fetchTikTokUser(username);

            const embed = new EmbedBuilder().setColor(fullData ? '#2ecc71' : '#e74c3c')
                .setAuthor({ name: '🔬 TIKTOK DEBUG REPORT', iconURL: client.user.displayAvatarURL() })
                .setTitle(`@${username}`)
                .setDescription(results.join('\n'))
                .addFields(
                    { name: '📊 Combined Result', value: fullData ? `✅ All layers resolved\n👤 **${fullData.nickname}**\n🔴 **Live:** ${fullData.isLive ? 'YES' : 'No'}\n🎬 **Latest Video:** ${fullData.latestVideo ? fullData.latestVideo.desc.substring(0, 50) + '...' : 'None'}` : `❌ All layers failed.\n\n⚠️ TikTok is likely blocking this server's IP.\nTry: \`.tiktok set ${username} #channel --force\``, inline: false }
                )
                .setFooter({ text: 'ARCHITECT CG-223 • TikTok Debug', iconURL: guildIcon })
                .setTimestamp();

            return statusMsg.edit({ embeds: [embed] });
        }

     // ─── TEST NOTIFICATION (owner only) ───
if (action === 'test' || action === 'simulate') {
    if (!isGuildOwner(message)) {
        return message.reply({ embeds: [buildOwnerErrorEmbed(client, message.guild, lang)] });
    }
    const username = args[1]?.replace(/^@/, '').trim();
    if (!username) return message.reply('❌ **Usage:** `.tiktok test <username>`');

    const track = db.prepare('SELECT * FROM tiktok_notifications WHERE guild_id = ? AND tiktok_username = ? COLLATE NOCASE').get(guildId, username);
    if (!track) return message.reply(`❌ **${username}** is not being tracked. Run \`.tiktok set ${username} #channel --force\` first.`);

    const statusMsg = await message.reply(`🔍 Fetching real layout data for **${username}**...`);
    
    let realData = await fetchTikTokUser(username);
    
    // Si TikTok bloque complètement, on génère des données temporaires pour que le test s'affiche quand même !
    if (!realData) {
        realData = {
            username, nickname: username, avatar: client.user.displayAvatarURL(),
            bio: 'Cloud Gaming-223 Automated Profile Node', verified: false,
            isLive: false, roomId: null, liveCover: null,
            stats: { followers: 223, following: 42, likes: 2230, videos: 12 },
            latestVideo: null
        };
    }

    // On lance la notification en mode 'system_test'
    const sent = await sendNotification(client, db, guildId, username, realData, 'system_test');
    
    return statusMsg.edit(sent
        ? `✅ **Test layout notification sent!** Check <#${track.target_channel_id}>.`
        : `❌ **Test failed.** Check bot permissions in <#${track.target_channel_id}>.`
    );
}

        // ─── LIST (public) ───
        if (action === 'list' || !action) {
            const tracks = db.prepare('SELECT * FROM tiktok_notifications WHERE guild_id = ?').all(guildId);
            return message.reply({ embeds: [buildListEmbed(tracks, message.guild, client, lang)] });
        }

        // ─── OWNER GUARD ───
        if (!isGuildOwner(message)) {
            return message.reply({ embeds: [buildOwnerErrorEmbed(client, message.guild, lang)] });
        }

        // ─── SET ───
        if (action === 'set') {
            const username = args[1]?.replace(/^@/, '').trim();
            const channelMention = args[2];
            const forceMode = args.includes('--force') || args.includes('-f');

            if (!username || !channelMention) {
                return message.reply(lang === 'fr'
                    ? '❌ **Usage:** `.tiktok set <username> <#salon>`\n*Ex: `.tiktok set charlidamelio #social-media`*'
                    : '❌ **Usage:** `.tiktok set <username> <#channel>`\n*Ex: `.tiktok set charlidamelio #social-media`*');
            }

            const channelId = channelMention.replace(/[<#>]/g, '').trim();
            const channel = message.guild.channels.cache.get(channelId);
            if (!channel) return message.reply(lang === 'fr' ? '❌ Salon introuvable.' : '❌ Channel not found.');

            const statusMsg = await message.reply(lang === 'fr' ? `🔍 Vérification de **${username}**...` : `🔍 Verifying **${username}**...`);

            const testData = await fetchTikTokUser(username);
            if (!testData && !forceMode) {
                return statusMsg.edit(lang === 'fr'
                    ? `❌ **${username}** introuvable.\n\nTikTok bloque le scraping serveur. Réessayez avec :\n\`.tiktok set ${username} ${channelMention} --force\``
                    : `❌ **${username}** could not be verified.\n\nTikTok blocks server requests.\nTo track anyway:\n\`.tiktok set ${username} ${channelMention} --force\``);
            }

            const lastVideoId = testData?.latestVideo?.id ? String(testData.latestVideo.id) : null;
            db.prepare(`
                INSERT INTO tiktok_notifications (guild_id, tiktok_username, target_channel_id, last_video_id, is_live, force_mode)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(guild_id, tiktok_username) DO UPDATE SET
                    target_channel_id = excluded.target_channel_id,
                    last_video_id = COALESCE(tiktok_notifications.last_video_id, excluded.last_video_id),
                    force_mode = excluded.force_mode
            `).run(guildId, username.toLowerCase(), channelId, lastVideoId, testData?.isLive ? 1 : 0, forceMode ? 1 : 0);

            const embed = new EmbedBuilder().setColor(forceMode ? '#f39c12' : '#2ecc71')
                .setAuthor({ name: forceMode ? '⚠️ TIKTOK TRACKING ACTIVE (FORCED)' : '✅ TIKTOK TRACKING ACTIVE', iconURL: testData?.avatar || client.user.displayAvatarURL() })
                .setTitle(testData ? `${testData.verified ? '✅ ' : ''}${testData.nickname}` : `@${username}`)
                .setDescription(forceMode
                    ? `**${username}** tracked *(validation bypassed)*.\n\n📢 <#${channelId}>\n🔴 Polling every 5min\n🎬 Polling every 5min\n⚠️ Uses layered fallback detection.`
                    : `**${username}** tracked.\n\n📢 <#${channelId}>\n🔴 Live Alerts\n🎬 Video Alerts\n👥 \`${Number(testData.stats.followers).toLocaleString()}\``
                )
                .setThumbnail(testData?.avatar || null)
                .setFooter({ text: `${guildName} • ARCHITECT CG-223 • TikTok Engine`, iconURL: guildIcon }).setTimestamp();

            return statusMsg.edit({ content: null, embeds: [embed] });
        }

        // ─── REMOVE ───
        if (action === 'remove' || action === 'delete') {
            const username = args[1]?.replace(/^@/, '').trim();
            if (!username) return message.reply('❌ **Usage:** `.tiktok remove <username>`');

            const result = db.prepare('DELETE FROM tiktok_notifications WHERE guild_id = ? AND tiktok_username = ? COLLATE NOCASE').run(guildId, username);
            if (result.changes === 0) return message.reply(`❌ **${username}** not tracked.`);

            const embed = new EmbedBuilder().setColor('#e74c3c').setAuthor({ name: '🗑️ TRACKING REMOVED', iconURL: guildIcon })
                .setDescription(`**${username}** removed.`)
                .setFooter({ text: 'ARCHITECT CG-223', iconURL: client.user.displayAvatarURL() }).setTimestamp();
            return message.reply({ embeds: [embed] });
        }

        // ─── HELP ───
        const helpEmbed = new EmbedBuilder().setColor('#FF0050')
            .setAuthor({ name: '📱 TIKTOK NOTIFICATION ENGINE', iconURL: client.user.displayAvatarURL() })
            .setDescription((lang === 'fr'
                ? '**Propriétaire:**\n`.tiktok set <user> <#ch> [--force]` — Suivre\n`.tiktok remove <user>` — Retirer\n`.tiktok check <user>` — Debug\n`.tiktok test <user>` — Test notification\n\n**Public:**\n`.tiktok list` — Voir les suivis\n\n⚠️ *TikTok bloque les IPs datacenter. `--force` si vérification échoue.*'
                : '**Owner:**\n`.tiktok set <user> <#ch> [--force]` — Track\n`.tiktok remove <user>` — Remove\n`.tiktok check <user>` — Debug\n`.tiktok test <user>` — Test notification\n\n**Public:**\n`.tiktok list` — View tracked\n\n⚠️ *TikTok blocks datacenter IPs. Use `--force` if verification fails.*'))
            .setFooter({ text: 'ARCHITECT CG-223', iconURL: client.user.displayAvatarURL() }).setTimestamp();
        return message.reply({ embeds: [helpEmbed] });
    },

    // ─── SLASH COMMAND HANDLER ───
    execute: async (interaction, client) => {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const db = client.db;
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        initDatabase(db);
        const isOwner = interaction.user.id === interaction.guild.ownerId;

        if (subcommand === 'list') {
            const tracks = db.prepare('SELECT * FROM tiktok_notifications WHERE guild_id = ?').all(guildId);
            return interaction.reply({ embeds: [buildListEmbed(tracks, interaction.guild, client, lang)] });
        }

        if (!isOwner) return interaction.reply({ embeds: [buildOwnerErrorEmbed(client, interaction.guild, lang)], flags: 1 << 6 });

        if (subcommand === 'check') {
            const username = interaction.options.getString('username').replace(/^@/, '').trim();
            await interaction.deferReply();
            const fullData = await fetchTikTokUser(username);
            return interaction.editReply({
                content: fullData
                    ? `✅ @${username} — ${fullData.nickname} — 🔴 Live: ${fullData.isLive ? 'YES' : 'No'}${fullData.latestVideo ? ` — 🎬 Latest: ${fullData.latestVideo.desc.substring(0, 50)}...` : ''}`
                    : `❌ @${username} — All fetch layers failed. TikTok likely blocking this IP.`
            });
        }

        if (subcommand === 'test') {
    const username = interaction.options.getString('username').replace(/^@/, '').trim();
    await interaction.deferReply();

    const track = db.prepare('SELECT * FROM tiktok_notifications WHERE guild_id = ? AND tiktok_username = ? COLLATE NOCASE').get(guildId, username);
    if (!track) return interaction.editReply(`❌ **${username}** is not tracked. Use /tiktok set first.`);

    let realData = await fetchTikTokUser(username);
    
    if (!realData) {
        realData = {
            username, nickname: username, avatar: client.user.displayAvatarURL(),
            bio: 'Cloud Gaming-223 Automated Profile Node', verified: false,
            isLive: false, roomId: null, liveCover: null,
            stats: { followers: 223, following: 42, likes: 2230, videos: 12 },
            latestVideo: null
        };
    }

    const sent = await sendNotification(client, db, guildId, username, realData, 'system_test');
    
    return interaction.editReply(sent
        ? `✅ **Test layout sent!** Check <#${track.target_channel_id}>.`
        : `❌ **Failed.** Check bot permissions in <#${track.target_channel_id}>.`
    );
}

        if (subcommand === 'set') {
            const username = interaction.options.getString('username').replace(/^@/, '').trim();
            const channel = interaction.options.getChannel('channel');
            const forceMode = interaction.options.getBoolean('force') || false;
            await interaction.deferReply();

            const testData = await fetchTikTokUser(username);
            if (!testData && !forceMode) {
                return interaction.editReply(lang === 'fr'
                    ? `❌ **${username}** introuvable. Réessayez avec **Force**.`
                    : `❌ **${username}** not found. Retry with **Force** enabled.`
                );
            }

            const lastVideoId = testData?.latestVideo?.id ? String(testData.latestVideo.id) : null;
            db.prepare(`
                INSERT INTO tiktok_notifications (guild_id, tiktok_username, target_channel_id, last_video_id, is_live, force_mode)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(guild_id, tiktok_username) DO UPDATE SET
                    target_channel_id = excluded.target_channel_id,
                    last_video_id = COALESCE(tiktok_notifications.last_video_id, excluded.last_video_id),
                    force_mode = excluded.force_mode
            `).run(guildId, username.toLowerCase(), channel.id, lastVideoId, testData?.isLive ? 1 : 0, forceMode ? 1 : 0);

            const embed = new EmbedBuilder().setColor(forceMode ? '#f39c12' : '#2ecc71')
                .setAuthor({ name: forceMode ? '⚠️ TIKTOK TRACKING (FORCED)' : '✅ TIKTOK TRACKING', iconURL: testData?.avatar || client.user.displayAvatarURL() })
                .setTitle(testData ? `${testData.verified ? '✅ ' : ''}${testData.nickname}` : `@${username}`)
                .setDescription(forceMode
                    ? `**${username}** tracked *(bypassed)*.\n📢 ${channel}\n🔴/🎬 Polling every 5min`
                    : `**${username}** tracked.\n📢 ${channel}\n🔴 Live + 🎬 Video alerts`
                )
                .setThumbnail(testData?.avatar || null).setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'remove') {
            const username = interaction.options.getString('username').replace(/^@/, '').trim();
            const result = db.prepare('DELETE FROM tiktok_notifications WHERE guild_id = ? AND tiktok_username = ? COLLATE NOCASE').run(guildId, username);
            if (result.changes === 0) return interaction.reply({ content: `❌ **${username}** not tracked.`, flags: 1 << 6 });
            return interaction.reply({ embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription(`**${username}** removed.`)] });
        }
    },

    startPolling, stopPolling, fetchTikTokUser
};
