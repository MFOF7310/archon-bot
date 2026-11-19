const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const em = (k, fb) => { try { return require('../config/emojis')[k] || fb; } catch { return fb; } };
const { iconObj } = require('../lib/ui/icons');
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags, SectionBuilder, ThumbnailBuilder } = require('discord.js');
const { toV2, fit } = require('../lib/v2convert');
const { t } = require('../lib/i18n');
const mentions = require('../lib/mentions');
const EMOJIS = require('../config/emojis');

const axios = require('axios');
const { execFile } = require('child_process');
const execFileAsync = require('util').promisify(execFile);

// ═══════════════════════════════════════════════════════════════════
//  ARCHON CG-223  •  TIKTOK NOTIFICATION ENGINE v2.0
//  Handles: Live Stream Alerts + New Video Upload Notifications
//  Polling: Every 2 minutes via self-healing interval
//  Security: Server Owner ONLY for configuration
//  NOTE: TikTok aggressively blocks datacenter IPs. Uses layered
//        fallback strategy: API > oEmbed > HTML scraping.
// ═══════════════════════════════════════════════════════════════════

// ================= SCRAPING CONFIG =================
const SCRAPE_CONFIG = {
    // Polling interval: 2 minutes (120 seconds)
    POLL_INTERVAL_MS: 2 * 60 * 1000,
    // Request timeout: 12 seconds (Starlink resilience)
    TIMEOUT_MS: 12000,
    // Max retries per method before moving to next fallback
    MAX_RETRIES: 2,
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
    try { db.exec(`ALTER TABLE tiktok_notifications ADD COLUMN last_video_time INTEGER DEFAULT NULL`); } catch {}
    try { db.exec(`ALTER TABLE tiktok_notifications ADD COLUMN live_room_id TEXT DEFAULT NULL`); } catch {}
    try {
        db.exec(`CREATE INDEX IF NOT EXISTS idx_tiktok_guild ON tiktok_notifications(guild_id)`);
    } catch (e) {}
}

// ================= OWNER SECURITY CHECK =================
// Alerts are a server setting: Manage Server (lib/access), not full Administrator
function isGuildOwner(message) {
    return require('../lib/access').can(message.member, 'alerts').ok;
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
            // the stream's own title, viewers and start, when the page carries them (best effort)
            const room = html.slice(Math.max(0, html.indexOf('"liveRoom"')), html.indexOf('"liveRoom"') + 20000);
            const liveTitle = (room.match(/"title":"([^"]{1,200})"/) || [])[1] || null;
            const liveViewers = Number((room.match(/"userCount":(\d+)/) || [])[1]) || null;
            const liveStart = Number((room.match(/"startTime":(\d{10})/) || [])[1]) || null;
            let title = null; try { title = liveTitle ? JSON.parse(`"${liveTitle}"`) : null; } catch { title = liveTitle; }
            return { isLive: true, roomId, liveCover, liveTitle: title, liveViewers, liveStart };
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
                Object.assign(data, { liveTitle: liveCheck.liveTitle, liveViewers: liveCheck.liveViewers, liveStart: liveCheck.liveStart });
            }
            failCounters.delete(cleanUsername);
            lastKnownStates.set(cleanUsername, { isLive: data.isLive, lastVideoId: null, timestamp: Date.now() });
            return data;
        }
    } catch { /* silent */ }

    // ─── LAYER 4: Live-only check ───
    try {
        const liveCheck = await fetchLiveStatus(cleanUsername);
        if (liveCheck.isLive) {
            return Object.assign(buildResult(
                { nickname: cleanUsername, avatarThumb: null, signature: '', verified: false, roomId: liveCheck.roomId },
                null, null, true, null, cleanUsername, liveCheck.liveCover
            ), { liveTitle: liveCheck.liveTitle, liveViewers: liveCheck.liveViewers, liveStart: liveCheck.liveStart });
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
        // a pinned video sits first: take the newest one that isn't pinned
        const itemList = (defaultScope?.itemList || []).filter((v) => !v.isPinnedItem);
        const latestVideo = itemList.sort((a, b) => (b.createTime || 0) - (a.createTime || 0))[0] || null;

        return buildResult(user, stats, latestVideo, isLive, liveRoomInfo, username);
    } catch (e) { return null; }
}

function parseSigiState(data, username) {
    try {
        const userModule = data.UserModule?.users?.[username];
        if (!userModule) return null;

        const isLive = !!userModule.roomId;
        const itemModule = data.ItemModule || {};
        const videos = Object.values(itemModule).filter((v) => !v.isPinnedItem).sort((a, b) => (b.createTime || 0) - (a.createTime || 0));
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
// Text from TikTok (bio, caption, live title) shown on a card: no mentions, no markdown that breaks the card
function clean(text, max) {
    let s = String(text || '').replace(/@/g, '@​').replace(/[*_~`|>#]/g, '').replace(/\s+/g, ' ').trim();
    if (max && s.length > max) s = s.slice(0, max).replace(/\s+\S*$/, '') + '…';
    return s;
}
const fmtNum = (n, lang) => Number(n || 0).toLocaleString({ fr: 'fr-FR', zh: 'zh-CN', ar: 'ar' }[lang] || 'en-US');
const rule = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

function buildLiveEmbed(data, guild, client, lang = 'en', pingText = null) {
    const liveEm = em('ic_live', '🔴');
    const c = new ContainerBuilder().setAccentColor(0xFF0050);
    if (pingText) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(pingText));
    const isTest = data._isTest === true;
    const img = data.liveCover || data.avatar;
    if (img) c.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(img)));
    const name = clean(data.nickname || data.username, 60);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(isTest
        ? `## 🧪 ${t('tiktok.testTitle', lang, { user: name })}`
        : `## ${liveEm} ${t('tiktok.isLiveTitle', lang, { user: name })}`));
    c.addSeparatorComponents(rule());
    const lines = [];
    if (isTest) lines.push(t('tiktok.testWarning', lang));
    else {
        if (data.liveTitle) lines.push(`**${clean(data.liveTitle, 120)}**`);
        const facts = [];
        if (data.liveStart) facts.push(`${em('clock', '🕒')} ${t('tiktok.liveStarted', lang, { when: `<t:${data.liveStart}:R>` })}`);
        if (data.liveViewers) facts.push(`${em('ic_users', '👥')} ${t('tiktok.liveViewers', lang, { n: fmtNum(data.liveViewers, lang) })}`);
        if (facts.length) lines.push(facts.join('  ·  '));
        if (!data.liveTitle && data.bio && data.bio.length > 5) lines.push(`-# ${clean(data.bio, 120)}`);
    }
    if (data.stats?.followers > 0) lines.push(`-# ${t('tiktok.followersLine', lang, { n: fmtNum(data.stats.followers, lang), likes: fmtNum(data.stats.likes, lang) })}`);
    if (lines.length) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
    c.addSeparatorComponents(rule());
    c.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel(t('tiktok.btnWatchLive', lang)).setStyle(ButtonStyle.Link).setURL('https://www.tiktok.com/@' + data.username + '/live').setEmoji(iconObj('ic_live', null, '🔴')),
        new ButtonBuilder().setLabel(t('tiktok.btnProfile', lang)).setStyle(ButtonStyle.Link).setURL('https://www.tiktok.com/@' + data.username).setEmoji(iconObj('ic_profile', null, '👤'))
    ));
    return { _v2: { components: [c], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: pingText ? ['everyone'] : [] } } };
}

function buildVideoEmbed(data, guild, client, lang = 'en') {
    const video = data.latestVideo;
    if (!video) return null;
    const c = new ContainerBuilder().setAccentColor(0x00F2FE);
    if (video.cover) c.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(video.cover)));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${em('tiktok_logo', '🎬')} ${t('tiktok.newVideoTitle', lang, { user: clean(data.nickname || data.username, 60) })}`));
    c.addSeparatorComponents(rule());
    const lines = [];
    const cap = clean(video.desc === 'No caption' ? '' : video.desc, 280);
    if (cap) lines.push(`**${cap}**`);
    const facts = [];
    if (video.createTime) facts.push(`${em('clock', '🕒')} ${t('tiktok.postedWhen', lang, { when: `<t:${video.createTime}:R>` })}`);
    if (video.duration) facts.push(`${em('ic_video', '🎬')} ${Math.floor(video.duration / 60)}:${String(Math.round(video.duration % 60)).padStart(2, '0')}`);
    if (video.playCount) facts.push(`${em('ic_eye', '👀')} ${t('tiktok.views', lang, { n: fmtNum(video.playCount, lang) })}`);
    if (video.likeCount) facts.push(`❤️ ${fmtNum(video.likeCount, lang)}`);
    if (facts.length) lines.push(facts.join('  ·  '));
    if (lines.length) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
    c.addSeparatorComponents(rule());
    c.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel(t('tiktok.btnWatchVideo', lang)).setStyle(ButtonStyle.Link).setURL(video.url).setEmoji(iconObj('ic_video', null, '🎬')),
        new ButtonBuilder().setLabel(t('tiktok.btnProfile', lang)).setStyle(ButtonStyle.Link).setURL('https://www.tiktok.com/@' + data.username).setEmoji(iconObj('ic_profile', null, '👤'))
    ));
    return { _v2: { components: [c], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } } };
}

// ================= NOTIFICATION SENDER =================
// The 30-minute guard is per server and account: it used to be per account only, so after the first server got
// its live alert every other server tracking the same account was skipped
const liveKey = (guildId, username) => `${guildId}:${String(username).toLowerCase()}`;
function canNotifyLive(guildId, username) {
    const lastTime = lastNotificationTime.get(liveKey(guildId, username));
    return !lastTime || (Date.now() - lastTime) >= SCRAPE_CONFIG.NOTIFICATION_COOLDOWN_MINUTES * 60 * 1000;
}

async function sendNotification(client, db, guildId, username, data, type) {
    try {
        const lang = client.detectLanguage ? client.detectLanguage('tiktok', guildId) : 'en';
        if (type === 'live' && !canNotifyLive(guildId, username)) return false;

        const tracking = db.prepare('SELECT target_channel_id FROM tiktok_notifications WHERE guild_id = ? AND tiktok_username = ? COLLATE NOCASE').get(guildId, username);
        if (!tracking) return false;
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return false;
        const channel = guild.channels.cache.get(tracking.target_channel_id);
        if (!channel) {
            require('../lib/postProblems').failed(guild, 'tiktok', tracking.target_channel_id, { ok: false, reason: 'gone', missing: [] });
            return false;
        }
        const { safeSend, canSend } = require('../lib/safeSend');
        if (!canSend('tiktok', channel, require('../lib/canPost').neededFor('tiktok'))) return false;

        let card = null;
        if (type === 'live') card = buildLiveEmbed(data, guild, client, lang, t('tiktok.livePing', lang, { icon: em('ic_live', '🔴'), user: clean(data.nickname || data.username, 60) }));
        else if (type === 'video') card = buildVideoEmbed(data, guild, client, lang);
        else if (type === 'system_test') card = buildLiveEmbed(data, guild, client, lang);
        if (!card) return false;

        await safeSend('tiktok', channel, card._v2, { throwOnError: true });
        if (type === 'live') lastNotificationTime.set(liveKey(guildId, username), Date.now());
        return true;
    } catch (err) {
        console.error('[TIKTOK] sendNotification failed:', err.message);
        return false;
    }
}

// ================= VIDEOS =================
// The newest video, through yt-dlp: the profile methods above mostly answer without videos, so new videos were
// almost never seen. A pinned video sits first on a profile, so the newest is the one with the latest date.
const VIDEO_CHECK_MS = 5 * 60 * 1000;
const MAX_VIDEO_AGE_S = 48 * 3600;
const lastVideoCheck = new Map();
async function fetchLatestVideo(username) {
    try {
        const { stdout } = await execFileAsync('yt-dlp', ['--skip-download', '--no-warnings', '--ignore-errors', '--playlist-items', '1:4',
            '--dump-json', `https://www.tiktok.com/@${username}`], { timeout: 45000, maxBuffer: 40 * 1024 * 1024 });
        const items = String(stdout).split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((j) => j && j.id);
        if (!items.length) return null;
        const v = items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];
        return {
            id: String(v.id), desc: v.description || v.title || '', cover: v.thumbnail || null,
            playCount: v.view_count || 0, likeCount: v.like_count || 0, commentCount: v.comment_count || 0, shareCount: v.repost_count || 0,
            createTime: v.timestamp || null, duration: v.duration || null,
            url: v.webpage_url || `https://www.tiktok.com/@${username}/video/${v.id}`,
        };
    } catch { return null; }
}

// ================= POLLING ENGINE =================
let cycleRunning = false;   // a slow cycle (TikTok retries) must not overlap the next one: it used to post twice
function startPolling(client, db) {
    if (isPolling) return;
    isPolling = true;
    initDatabase(db);
    setTimeout(() => runPollingCycle(client, db), 60000).unref?.();
    pollingInterval = setInterval(() => runPollingCycle(client, db), SCRAPE_CONFIG.POLL_INTERVAL_MS);
    pollingInterval.unref?.();
}

function stopPolling() {
    if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
    isPolling = false;
}

async function runPollingCycle(client, db) {
    if (cycleRunning) return;
    cycleRunning = true;
    try {
        const allTracks = db.prepare('SELECT * FROM tiktok_notifications').all();
        const byUser = new Map();
        for (const track of allTracks) {
            const key = track.tiktok_username.toLowerCase();
            if (!byUser.has(key)) byUser.set(key, []);
            byUser.get(key).push(track);
        }
        for (const [username, tracks] of byUser) {
            try {
                await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
                const data = await fetchTikTokUser(username);
                if (data) await processLive(client, db, username, tracks, data);
                // videos: every 5 minutes, even when the profile itself couldn't be read
                if (Date.now() - (lastVideoCheck.get(username) || 0) >= VIDEO_CHECK_MS) {
                    lastVideoCheck.set(username, Date.now());
                    const video = (await fetchLatestVideo(username)) || data?.latestVideo || null;
                    if (video?.id) await processVideo(client, db, username, tracks, { ...(data || { username, nickname: username, stats: {} }), latestVideo: video });
                }
            } catch (err) {
                console.error(`[TIKTOK] @${username}:`, err.message);
            }
        }
    } catch (err) {
        console.error('[TIKTOK] cycle:', err.message);
    } finally {
        cycleRunning = false;
    }
}

// Live state is decided once per account (the offline count used to grow once per server, so an account tracked
// on three servers looked offline after one check), then each server is told
async function processLive(client, db, username, tracks, data) {
    if (data.isLive) {
        consecutiveOfflineChecks.delete(username);
        // about to announce: the /live page gives the stream's title, viewers and cover
        if (data.liveTitle === undefined && tracks.some((tr) => tr.is_live !== 1)) {
            const lc = await fetchLiveStatus(username).catch(() => null);
            if (lc?.isLive) Object.assign(data, { roomId: data.roomId || lc.roomId, liveCover: data.liveCover || lc.liveCover,
                liveTitle: lc.liveTitle, liveViewers: lc.liveViewers, liveStart: lc.liveStart });
        }
        for (const track of tracks) {
            if (track.is_live === 1) continue;
            if (data.roomId && track.live_room_id === String(data.roomId)) {   // the same stream, back after a drop
                db.prepare('UPDATE tiktok_notifications SET is_live = 1 WHERE guild_id = ? AND tiktok_username = ?').run(track.guild_id, track.tiktok_username);
                continue;
            }
            if (!canNotifyLive(track.guild_id, username)) continue;
            const sent = await sendNotification(client, db, track.guild_id, track.tiktok_username, data, 'live');
            console.log(`[TIKTOK] live @${username} -> ${track.guild_id}: ${sent ? 'sent' : 'failed'}`);
            if (sent) db.prepare('UPDATE tiktok_notifications SET is_live = 1, live_room_id = COALESCE(?, live_room_id) WHERE guild_id = ? AND tiktok_username = ?')
                .run(data.roomId ? String(data.roomId) : null, track.guild_id, track.tiktok_username);
        }
        return;
    }
    if (!tracks.some((tr) => tr.is_live === 1)) return;
    const off = (consecutiveOfflineChecks.get(username) || 0) + 1;
    consecutiveOfflineChecks.set(username, off);
    if (off >= REQUIRED_OFFLINE_CHECKS) {
        consecutiveOfflineChecks.delete(username);
        db.prepare('UPDATE tiktok_notifications SET is_live = 0 WHERE tiktok_username = ? COLLATE NOCASE').run(username);
        for (const track of tracks) lastNotificationTime.delete(liveKey(track.guild_id, username));
    }
}

// A video is announced when it is newer than the last one known for this server and less than 48 hours old.
// The first video seen for a server is only remembered (no post), so adding an account doesn't post its old video.
async function processVideo(client, db, username, tracks, data) {
    const v = data.latestVideo;
    const now = Math.floor(Date.now() / 1000);
    for (const track of tracks) {
        const isNew = track.last_video_id && track.last_video_id !== v.id
            && (!v.createTime || !track.last_video_time || v.createTime > track.last_video_time)
            && (!v.createTime || now - v.createTime < MAX_VIDEO_AGE_S);
        if (isNew) {
            const sent = await sendNotification(client, db, track.guild_id, track.tiktok_username, data, 'video');
            console.log(`[TIKTOK] new video ${v.id} @${username} -> ${track.guild_id}: ${sent ? 'sent' : 'failed'}`);
        }
        if (!track.last_video_time || !v.createTime || v.createTime >= track.last_video_time) {
            db.prepare('UPDATE tiktok_notifications SET last_video_id = ?, last_video_time = COALESCE(?, last_video_time) WHERE guild_id = ? AND tiktok_username = ?')
                .run(v.id, v.createTime || null, track.guild_id, track.tiktok_username);
        }
    }
}

// ================= COMMANDS =================
function buildListEmbed(tracks, guild, client, lang = 'en') {
    const tt = em('tiktok_logo', '📱', client);
    const c = new ContainerBuilder().setAccentColor(0xFF0050);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${tt} ${t('tiktok.trackedAccounts', lang)}`));
    
    if (tracks.length === 0) {
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`> ${t('tiktok.noAccounts', lang)}`));
        return c;
    }
    
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    tracks.forEach((track, i) => {
        const liveEm = track.is_live === 1 ? em('online', '🟢', client) : em('offline', '🔴', client);
        const status = track.is_live === 1 ? t('tiktok.liveStatus', lang).replace('🔴 ', '') : t('tiktok.offlineStatus', lang).replace('⚫ ', '');
        const forceTag = track.force_mode === 1 ? ' ⚠️' : '';
        const lastVideo = track.last_video_id ? `🎬 \`...${track.last_video_id.slice(-6)}\`` : t('tiktok.noVideoYet', lang);
        
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${i + 1}. @${track.tiktok_username}**${forceTag} · ${liveEm} ${status}\n<#${track.target_channel_id}> · ${lastVideo}`));
        if (i < tracks.length - 1) c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    });
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ARCHON CG-223 · TikTok Engine`));
    return c;
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
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub => sub.setName('set').setDescription('Add/update TikTok tracking')
            .addStringOption(o => o.setName('username').setDescription('TikTok username (without @)').setRequired(true))
            .addChannelOption(o => o.setName('channel').setDescription('Channel for notifications').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
            .addBooleanOption(o => o.setName('force').setDescription('Skip validation if TikTok blocks verification').setRequired(false)))
        .addSubcommand(sub => sub.setName('remove').setDescription('Remove TikTok tracking')
            .addStringOption(o => o.setName('username').setDescription('Username to remove').setRequired(true).setAutocomplete(true)))
        .addSubcommand(sub => sub.setName('list').setDescription('List tracked accounts'))
        .addSubcommand(sub => sub.setName('check').setDescription('Debug: manually check a TikTok user')
            .addStringOption(o => o.setName('username').setDescription('Username to check').setRequired(true)))
        .addSubcommand(sub => sub.setName('test').setDescription('Force-send a test live notification')
            .addStringOption(o => o.setName('username').setDescription('Tracked username to test').setRequired(true).setAutocomplete(true))),

    // ─── PREFIX COMMAND HANDLER ───
    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        const prefix = serverSettings?.prefix || '.';
        lang = client.detectLanguage ? client.detectLanguage('tiktok', message.guild?.id) : 'en';
        const guildId = message.guild?.id;
        const guildName = message.guild?.name?.toUpperCase() || 'ARCHON CG-223';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();

        initDatabase(db);
        const action = args[0]?.toLowerCase() || 'list';

        // ─── CHECK (manual debug) ───
        if (action === 'check' || action === 'debug') {
            const username = args[1]?.replace(/^@/, '').trim();
            if (!username) return message.reply(t('tiktok.check_usage', lang));

            const statusMsg = await message.reply(t('tiktok.check_testing', lang, { username }));

            const results = [];

            // Layer 1
            try {
                const start = Date.now();
                const d = await fetchViaWebApi(username);
                results.push(`${em('ic_ok', '✅')} **Web API:** ${d ? `Found! (${Date.now() - start}ms)` : 'No data'}${d?.isLive ? ' 🔴 LIVE' : ''}`);
            } catch (e) { results.push(`${em('ic_off', '❌')} **Web API:** ${e.message.substring(0, 80)}`); }

            // Layer 2
            try {
                const start = Date.now();
                const d = await fetchViaOembed(username);
                results.push(`${em('ic_ok', '✅')} **oEmbed:** ${d ? `Found! (${Date.now() - start}ms)` : 'No data'}`);
            } catch (e) { results.push(`${em('ic_off', '❌')} **oEmbed:** ${e.message.substring(0, 80)}`); }

            // Layer 3
            try {
                const start = Date.now();
                const d = await fetchViaHtmlScrape(username);
                results.push(`${em('ic_ok', '✅')} **HTML Scrape:** ${d ? `Found! (${Date.now() - start}ms)` : 'No data'}${d?.isLive ? ' 🔴 LIVE' : ''}`);
            } catch (e) { results.push(`${em('ic_off', '❌')} **HTML Scrape:** ${e.message.substring(0, 80)}`); }

            // Layer 4
            try {
                const d = await fetchLiveStatus(username);
                results.push(`${em('ic_ok', '✅')} **Live Check:** ${d.isLive ? '🔴 LIVE!' : 'Not live'}`);
            } catch (e) { results.push(`${em('ic_off', '❌')} **Live Check:** ${e.message.substring(0, 80)}`); }

            const fullData = await fetchTikTokUser(username);

            const embed = new EmbedBuilder().setColor(fullData ? '#2ecc71' : '#e74c3c')
                .setAuthor({ name: '🔬 TIKTOK DEBUG REPORT', iconURL: client.user.displayAvatarURL() })
                .setTitle(`@${username}`)
                .setDescription(results.join('\n'))
                .addFields(
                    { name: '📊 Combined Result', value: fullData ? `${em('ic_ok', '✅')} All layers resolved\n👤 **${fullData.nickname}**\n🔴 **Live:** ${fullData.isLive ? 'YES' : 'No'}\n🎬 **Latest Video:** ${fullData.latestVideo ? fullData.latestVideo.desc.substring(0, 50) + '...' : 'None'}` : `${em('ic_off', '❌')} All layers failed.\n\n⚠️ TikTok is likely blocking this server's IP.\nTry: \`.tiktok set ${username} #channel --force\``, inline: false }
                )
                .setFooter({ text: 'ARCHON CG-223 • TikTok Debug', iconURL: guildIcon })
                .setTimestamp();

            return statusMsg.edit(fit(statusMsg, { embeds: [embed] }));
        }

     // ─── TEST NOTIFICATION (owner only) ───
if (action === 'test' || action === 'simulate') {
    if (!isGuildOwner(message)) {
        return message.reply({ content: require('../lib/access').deny(message.member, 'alerts', lang), allowedMentions: { parse: [] } });
    }
    const username = args[1]?.replace(/^@/, '').trim();
    if (!username) return message.reply(t('tiktok.test_usage', lang));

    const track = db.prepare('SELECT * FROM tiktok_notifications WHERE guild_id = ? AND tiktok_username = ? COLLATE NOCASE').get(guildId, username);
    if (!track) return message.reply(t('tiktok.notTrackedTest', lang, { username, mention: mentions(client, 'tiktok', 'set') }));

    const statusMsg = await message.reply(t('tiktok.test_fetching', lang, { username }));
    
    let realData = await fetchTikTokUser(username);
    
    // Si TikTok bloque complètement, on génère des données temporaires pour que le test s'affiche quand même !
    if (!realData) {
        realData = {
            username, nickname: username, avatar: null,
            bio: '', verified: false,
            isLive: false, roomId: null, liveCover: null,
            stats: {},   // TikTok didn't answer: no invented numbers on the preview
            latestVideo: null
        };
    }
    realData._isTest = true;

    // On lance la notification en mode 'system_test'
    const sent = await sendNotification(client, db, guildId, username, realData, 'system_test');
    
    return statusMsg.edit(sent
        ? t('tiktok.testSent', lang, { channel: `<#${track.target_channel_id}>` })
        : t('tiktok.testFailed', lang, { channel: `<#${track.target_channel_id}>` })
    );
}

        // ─── LIST (public) ───
        if (action === 'list' || !action) {
            const tracks = db.prepare('SELECT * FROM tiktok_notifications WHERE guild_id = ?').all(guildId);
            return message.reply({ components: [buildListEmbed(tracks, message.guild, client, lang)], flags: MessageFlags.IsComponentsV2 });
        }

        // ─── OWNER GUARD ───
        if (!isGuildOwner(message)) {
            return message.reply({ content: require('../lib/access').deny(message.member, 'alerts', lang), allowedMentions: { parse: [] } });
        }

        // ─── SET ───
        if (action === 'set') {
            const username = args[1]?.replace(/^@/, '').trim();
            const channelMention = args[2];
            const forceMode = args.includes('--force') || args.includes('-f');

            if (!username || !channelMention) {
                return message.reply(t('tiktok.set_usage', lang, { prefix }));
            }

            const channelRaw = channelMention.replace(/[<#>]/g, '').trim();
            // Try as ID first, then fall back to name match
            let channel = message.guild.channels.cache.get(channelRaw);
            if (!channel && /^\d+$/.test(channelRaw)) {
                try { channel = await message.guild.channels.fetch(channelRaw).catch(() => null); } catch {}
            }
            if (!channel) {
                channel = message.guild.channels.cache.find(c =>
                    c.name.toLowerCase() === channelRaw.toLowerCase()
                );
            }
            const channelId = channel?.id || channelRaw;
            if (!channel) return message.reply(t('tiktok.channelNotFound', lang));

            const statusMsg = await message.reply(t('tiktok.verifying', lang).replace('{username}', username));

            const testData = await fetchTikTokUser(username);
            if (!testData && !forceMode) {
                return statusMsg.edit(t('tiktok.notFound', lang).replace('{username}', username).replace('{prefix}', prefix).replace('{channel}', channelMention));
            }

            const existing = db.prepare('SELECT target_channel_id FROM tiktok_notifications WHERE guild_id = ? AND tiktok_username = ? COLLATE NOCASE').get(guildId, username.toLowerCase());
            if (existing && existing.target_channel_id === channelId) {
                return statusMsg.edit(fit(statusMsg, { content: t('tiktok.already_tracked', lang, { username, channel: channelId }), embeds: [], components: [] }));
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

            const c = new ContainerBuilder().setAccentColor(forceMode ? 0xf39c12 : 0x2ecc71);
            const checkEmoji = EMOJIS.small_check || em('ic_ok', '✅');
            const warnEmoji = EMOJIS.warning || em('ic_warn', '⚠️');
            const header = `## ${forceMode ? warnEmoji : checkEmoji} ${testData?.nickname || '@' + username}`;
            const desc = forceMode
                ? t('tiktok.trackedForceDesc', lang).replace('{username}', username).replace('{channelId}', channelId)
                : t('tiktok.trackedDesc', lang).replace('{username}', username).replace('{channelId}', channelId);
            
            if (testData?.avatar) {
                c.addSectionComponents(new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(header + '\n' + desc)).setThumbnailAccessory(new ThumbnailBuilder().setURL(testData.avatar)));
            } else {
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(header + '\n' + desc));
            }
            if (!forceMode && testData?.stats?.followers) {
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(t('tiktok.followers', lang).replace('{count}', Number(testData.stats.followers).toLocaleString())));
            }
            const _warn = require('../lib/postProblems').setupWarning(message.guild, message.guild.channels.cache.get(channelId), 'tiktok', lang, message);
            if (_warn) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(_warn));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${guildName} • ARCHON CG-223 • TikTok Engine`));
            
            return statusMsg.edit({ content: null, components: [c], flags: MessageFlags.IsComponentsV2 });
        }

        // ─── REMOVE ───
        if (action === 'remove' || action === 'delete') {
            const username = args[1]?.replace(/^@/, '').trim();
            if (!username) return message.reply(t('tiktok.remove_usage', lang));

            const result = db.prepare('DELETE FROM tiktok_notifications WHERE guild_id = ? AND tiktok_username = ? COLLATE NOCASE').run(guildId, username);
            if (result.changes === 0) return message.reply(t('tiktok.test_not_tracked', lang, { username }));
            const rc = new ContainerBuilder().setAccentColor(0xe74c3c);
            rc.addTextDisplayComponents(new TextDisplayBuilder().setContent(t('tiktok.removed_success', lang, { username })));
            return message.reply({ components: [rc], flags: MessageFlags.IsComponentsV2 });
        }

        // ─── HELP ───
        const tt = EMOJIS.tiktok_logo || '📱';
        const p = prefix;
        const helpEmbed = new EmbedBuilder().setColor('#FF0050')
            .setAuthor({ name: '📱 TikTok Notifications', iconURL: client.user.displayAvatarURL() })
            .setDescription(
                t('tiktok.ownerCmds', lang).replace('{tt}', tt) + '\n' +
                '`' + p + 'tiktok set <user> <#channel>` — ' + t('tiktok.trackCmd', lang) + '\n' +
                '`' + p + 'tiktok remove <user>` — ' + t('tiktok.stopTracking', lang) + '\n' +
                '`' + p + 'tiktok check <user>` — Debug\n' +
                '`' + p + 'tiktok test <user>` — Test notification\n\n' +
                t('tiktok.publicCmds', lang) + '\n' +
                '`' + p + 'tiktok list` — ' + t('tiktok.viewTracked', lang) + '\n\n' +
                t('tiktok.channelTip', lang) + '\n\n' +
                t('tiktok.datacenterWarning', lang)
            )
            .setFooter({ text: 'ARCHON CG-223  •  TikTok Engine', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();
        return message.reply(toV2({ embeds: [helpEmbed] }));
    },

    // ─── SLASH COMMAND HANDLER ───
    async autocomplete(interaction, client) {
        const guildId = interaction.guildId || interaction.guild?.id;
        if (!guildId) return require('../lib/autocomplete').reply(interaction, []);
        initDatabase(client.db);
        const rows = client.db.prepare('SELECT tiktok_username, is_live FROM tiktok_notifications WHERE guild_id = ?').all(guildId);
        const items = rows.map(r => ({
            name: `@${r.tiktok_username}${r.is_live === 1 ? ' 🔴 live' : ''}`,
            value: r.tiktok_username,
        }));
        return require('../lib/autocomplete').reply(interaction, items);
    },

    execute: async (interaction, client) => {
        const lang = require('../lib/pick-lang').pickLang(client, interaction.guildId, interaction, interaction.user?.id);
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const db = client.db;

        initDatabase(db);
        const isOwner = require('../lib/access').can(interaction.member, 'alerts').ok;

        if (subcommand === 'list') {
            const tracks = db.prepare('SELECT * FROM tiktok_notifications WHERE guild_id = ?').all(guildId);
            return interaction.reply({ components: [buildListEmbed(tracks, interaction.guild, client, lang)], flags: MessageFlags.IsComponentsV2 });
        }

        if (!isOwner) return interaction.reply({ content: require('../lib/access').deny(interaction.member, 'alerts', lang), flags: 1 << 6, allowedMentions: { parse: [] } });

        if (subcommand === 'check') {
            const username = interaction.options.getString('username').replace(/^@/, '').trim();
            await interaction.deferReply();
            const fullData = await fetchTikTokUser(username);
            return interaction.editReply({
                content: fullData
                    ? `${em('ic_ok', '✅')} @${username} — ${fullData.nickname} — 🔴 Live: ${fullData.isLive ? 'YES' : 'No'}${fullData.latestVideo ? ` — 🎬 Latest: ${fullData.latestVideo.desc.substring(0, 50)}...` : ''}`
                    : `${em('ic_off', '❌')} @${username} — All fetch layers failed. TikTok likely blocking this IP.`
            });
        }

        if (subcommand === 'test') {
    const username = interaction.options.getString('username').replace(/^@/, '').trim();
    await interaction.deferReply();

    const track = db.prepare('SELECT * FROM tiktok_notifications WHERE guild_id = ? AND tiktok_username = ? COLLATE NOCASE').get(guildId, username);
    if (!track) return interaction.editReply(t('tiktok.notTrackedTest', lang, { username, mention: mentions(client, 'tiktok', 'set') }));

    let realData = await fetchTikTokUser(username);
    
    if (!realData) {
        realData = {
            username, nickname: username, avatar: null,
            bio: '', verified: false,
            isLive: false, roomId: null, liveCover: null,
            stats: {},   // TikTok didn't answer: no invented numbers on the preview
            latestVideo: null
        };
    }
    realData._isTest = true;

    const sent = await sendNotification(client, db, guildId, username, realData, 'system_test');
    
    return interaction.editReply(sent
        ? t('tiktok.testSent', lang, { channel: `<#${track.target_channel_id}>` })
        : t('tiktok.testFailed', lang, { channel: `<#${track.target_channel_id}>` })
    );
}

        if (subcommand === 'set') {
            await interaction.deferReply({ flags: 64 });
            const username = interaction.options.getString('username').replace(/^@/, '').trim();
            const forceMode = interaction.options.getBoolean('force') || false;
            const channelOption = interaction.options.getChannel('channel');
            if (!channelOption) return interaction.editReply(t('tiktok.channel_not_found', lang));
            const channelId = channelOption.id;

            const testData = await fetchTikTokUser(username);
            if (!testData && !forceMode) {
                return interaction.editReply(t('tiktok.notFoundForce', lang).replace('{username}', username));
            }

            const existing = db.prepare('SELECT target_channel_id FROM tiktok_notifications WHERE guild_id = ? AND tiktok_username = ? COLLATE NOCASE').get(guildId, username.toLowerCase());
            if (existing && existing.target_channel_id === channelOption.id) {
                return interaction.editReply(t('tiktok.already_tracked', lang, { username, channel: channelOption.id }));
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

            const c = new ContainerBuilder().setAccentColor(forceMode ? 0xf39c12 : 0x2ecc71);
            const desc = forceMode
                ? t('tiktok.trackedForceDesc', lang).replace('{username}', username).replace('{channelId}', channelId)
                : t('tiktok.trackedDesc', lang).replace('{username}', username).replace('{channelId}', channelId);
            const checkEmoji = EMOJIS.small_check || em('ic_ok', '✅');
            const warnEmoji = EMOJIS.warning || em('ic_warn', '⚠️');
            const header = `## ${forceMode ? warnEmoji : checkEmoji} ${testData?.nickname || '@' + username}`;
            
            if (testData?.avatar) {
                c.addSectionComponents(new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(header + '\n' + desc)).setThumbnailAccessory(new ThumbnailBuilder().setURL(testData.avatar)));
            } else {
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(header + '\n' + desc));
            }
            if (!forceMode && testData?.stats?.followers) {
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(t('tiktok.followers', lang).replace('{count}', Number(testData.stats.followers).toLocaleString())));
            }
            const _warn = require('../lib/postProblems').setupWarning(interaction.guild, channelOption, 'tiktok', lang, interaction);
            if (_warn) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(_warn));
            const embed = { components: [c], flags: MessageFlags.IsComponentsV2 };
            try {
                return await interaction.editReply(embed);
            } catch (err) {
                console.error('[TIKTOK SET] editReply error:', err.message, '| channel.id:', channelOption.id);
                const ttEmbed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setAuthor({ name: '📱 TikTok Tracking', iconURL: client.user.displayAvatarURL() })
                .setDescription(t('tiktok.tracked_success', lang, { username, channelId: channelOption.id }))
                .setFooter({ text: 'ARCHON CG-223 • TikTok Engine' }).setTimestamp();
            return await interaction.editReply({ embeds: [ttEmbed] });
            }
        }

        if (subcommand === 'remove') {
            const username = interaction.options.getString('username').replace(/^@/, '').trim();
            const result = db.prepare('DELETE FROM tiktok_notifications WHERE guild_id = ? AND tiktok_username = ? COLLATE NOCASE').run(guildId, username);
            if (result.changes === 0) return interaction.reply({ content: t('tiktok.test_not_tracked', lang, { username }), flags: 1 << 6 });
            const c = new ContainerBuilder().setAccentColor(0xe74c3c);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(t('tiktok.removed_success', lang, { username })));
            return interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
        }
    },

    startPolling, stopPolling, fetchTikTokUser
};
