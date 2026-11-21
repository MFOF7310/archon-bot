// ═══════════════════════════════════════════════════════════════════
//  ARCHON CG-223  •  YOUTUBE LIVE & UPLOAD ENGINE v1.0
//  Live check:   yt-dlp subprocess (no API key, no quota)
//  Upload check: YouTube RSS feed (free, unlimited, near-instant)
//  Priority channels polled every 2 min · Normal every 5 min
// ═══════════════════════════════════════════════════════════════════
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags, ChannelSelectMenuBuilder } = require('discord.js');
const { iconObj } = require('../lib/ui/icons');
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const { t } = require('../lib/i18n');
const mentions = require('../lib/mentions');
const EMOJIS = require('../config/emojis');
const em = (k, fb) => { try { return require('../config/emojis')[k] || fb; } catch { return fb; } };

const axios = require('axios');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const isChannelId = (s) => /^UC[\w-]{22}$/.test(String(s || ''));
// What the admin typed becomes the stored @handle, unless it was a UC… ID (then there is no handle:
// "@UC…/live" is not a page and used to make every live check fail over to the slow fallback)
const handleOf = (input) => { const h = String(input || '').replace(/^@/, '').trim(); return h && !isChannelId(h) ? h : null; };
// A channel being checked: the 2-minute and 5-minute cycles can overlap, and both used to post the same live alert
const busy = new Set();


const POLL_INTERVAL_MS = 5 * 60 * 1000;
const PRIORITY_INTERVAL_MS = 2 * 60 * 1000;
const YTDLP_TIMEOUT_MS = 15000;
const NOTIFICATION_COOLDOWN_MINUTES = 30;

let normalInterval = null;
let priorityInterval = null;
let isPolling = false;

const lastNotificationTime = new Map();
const offlineCounters = new Map();
const liveVideoIds = new Map(); // channel ID -> video ID of the stream last seen live
const REQUIRED_OFFLINE_CHECKS = 2;

// Videos already seen for a channel, kept in the database so a restart doesn't forget them.
// Before, only last_video_id was stored. The newest video can differ between YouTube's feed and yt-dlp
// (yt-dlp skips Shorts and past lives), and the live id was only in memory, so after a restart an old video
// looked "new" and was posted again.
const SEEN_MAX = 30;
const MAX_VIDEO_AGE_MS = 48 * 3600 * 1000;
function seenOf(row) {
    try { const a = JSON.parse(row.seen_videos || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
}
function markSeen(db, chId, ids) {
    const rows = db.prepare('SELECT guild_id, seen_videos FROM youtube_notifications WHERE youtube_channel_id = ?').all(chId);
    for (const r of rows) {
        const list = seenOf(r).filter(x => !ids.includes(x));
        list.push(...ids.filter(Boolean));
        db.prepare('UPDATE youtube_notifications SET seen_videos = ? WHERE guild_id = ? AND youtube_channel_id = ?')
            .run(JSON.stringify(list.slice(-SEEN_MAX)), r.guild_id, chId);
    }
}

function initDatabase(db) {
    if (!db) return;
    db.exec(`
        CREATE TABLE IF NOT EXISTS youtube_notifications (
            guild_id TEXT NOT NULL,
            youtube_channel_id TEXT NOT NULL COLLATE NOCASE,
            youtube_handle TEXT DEFAULT NULL,
            target_channel_id TEXT NOT NULL,
            last_video_id TEXT DEFAULT NULL,
            is_live INTEGER DEFAULT 0,
            priority INTEGER DEFAULT 0,
            force_mode INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            PRIMARY KEY (guild_id, youtube_channel_id)
        )
    `);
    try { db.exec(`ALTER TABLE youtube_notifications ADD COLUMN priority INTEGER DEFAULT 0`); } catch {}
    try { db.exec(`ALTER TABLE youtube_notifications ADD COLUMN youtube_handle TEXT DEFAULT NULL`); } catch {}
    try { db.exec(`ALTER TABLE youtube_notifications ADD COLUMN notify_live INTEGER DEFAULT 1`); } catch {}
    try { db.exec(`ALTER TABLE youtube_notifications ADD COLUMN notify_uploads INTEGER DEFAULT 1`); } catch {}
    try { db.exec(`ALTER TABLE youtube_notifications ADD COLUMN seen_videos TEXT DEFAULT '[]'`); } catch {}
    // the stream already announced: a stream that drops for a few minutes and comes back is not announced twice
    try { db.exec(`ALTER TABLE youtube_notifications ADD COLUMN live_video_id TEXT DEFAULT NULL`); } catch {}
    // where uploads go when it's not the live channel (NULL: same channel as the live alerts)
    try { db.exec(`ALTER TABLE youtube_notifications ADD COLUMN upload_channel_id TEXT DEFAULT NULL`); } catch {}
    try { db.exec(`CREATE INDEX IF NOT EXISTS idx_youtube_guild ON youtube_notifications(guild_id)`); } catch {}
    try { db.exec(`ALTER TABLE tiktok_notifications ADD COLUMN priority INTEGER DEFAULT 0`); } catch {}
}

// Alerts are a server setting: Manage Server (lib/access), not full Administrator
function isGuildOwner(message) {
    return require('../lib/access').can(message.member, 'alerts').ok;
}

// ─── Resolve handle → channel ID ───
function resolveErrMsg(client, guildId, reason, handle) {
    const lang = (client?.detectLanguage ? client.detectLanguage('livestream', guildId) : null) || 'en';
    const key = 'livestream.resolve_' + (reason || 'unknown');
    const h = handle ? '@' + String(handle).replace(/^@/, '') : '?';
    try {
        const msg = t(key, lang, { handle: h });
        return msg && msg !== key ? msg : `❌ ${reason || 'unknown'}: ${h}`;
    } catch {
        return `❌ Could not resolve ${h} (${reason || 'unknown'})`;
    }
}

async function resolveHandle(handle) {
    const clean = String(handle || '').replace(/^@/, '').trim();
    if (!clean) return { id: null, reason: 'empty' };
    if (/^UC[\w-]{22}$/.test(clean)) return { id: clean, reason: 'ok' };

    // Method 1: yt-dlp (robust, uses same cookies as live check)
    try {
        const { stdout } = await execFileAsync('yt-dlp', [
            '--skip-download', '--no-warnings', '--playlist-items', '0',
            '--cookies', COOKIE_FILE,
            '--print', 'channel_id',
            `https://www.youtube.com/@${clean}`,
        ], { timeout: 15000 });
        const id = String(stdout).trim();
        if (/^UC[\w-]{22}$/.test(id)) return { id, reason: 'ok' };
    } catch (e) {
        const msg = String(e.message || '') + String(e.stderr || '');
        if (/not found|does not exist|unavailable|404/i.test(msg)) return { id: null, reason: 'not_found' };
        // else: fall through to HTML scrape
    }

    // Method 2: HTML scrape (fallback)
    try {
        const res = await axios.get(`https://www.youtube.com/@${encodeURIComponent(clean)}`, {
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' },
            validateStatus: s => s < 500,
        });
        const m = String(res.data).match(/"externalId":"(UC[\w-]{22})"/)
              || String(res.data).match(/"channelId":"(UC[\w-]{22})"/);
        if (m) return { id: m[1], reason: 'ok' };
        return { id: null, reason: 'not_found' };
    } catch (e) {
        if (e.response?.status === 404) return { id: null, reason: 'not_found' };
        return { id: null, reason: 'network' };
    }
}

// ─── Live check via yt-dlp ───
const COOKIE_FILE = require('path').join(__dirname, '..', 'assets', 'cookies.txt');

// ── Erreur log throttle : 1 msg par chaîne toutes les 30 min ──
const _errThrottle = new Map();
const ERR_LOG_INTERVAL_MS = 30 * 60 * 1000;
function logYtErrThrottled(channelId, msg) {
    const now = Date.now();
    const last = _errThrottle.get(channelId) || 0;
    if (now - last < ERR_LOG_INTERVAL_MS) return;
    _errThrottle.set(channelId, now);
    console.log(`[YOUTUBE] ${channelId} live check err: ${String(msg).slice(0, 180)}`);
}

function livLang(client, guildId, context = null) {
    try { return client?.detectLanguage?.('livestream', guildId, context) || 'en'; }
    catch { return 'en'; }
}

async function fetchLiveStatus(channelId, handle) {
    // Prefer @handle URL when available — /channel/{id}/live is increasingly blocked by YouTube
    const cleanHandle = handle ? String(handle).replace(/^@/, '').trim() : null;
    const watchUrl = cleanHandle
        ? `https://www.youtube.com/@${cleanHandle}/live`
        : `https://www.youtube.com/channel/${channelId}/live`;
    try {
        // One JSON answer: the title can't shift the other fields any more (the old one-value-per-line output
        // broke on a title or description with a line break), and it carries the details shown on the card
        const { stdout } = await execFileAsync('yt-dlp', [
            '--skip-download', '--no-warnings', '--no-playlist',
            '--cookies', COOKIE_FILE, '--dump-json', watchUrl,
        ], { timeout: YTDLP_TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024 });
        const j = JSON.parse(String(stdout).trim().split('\n')[0] || '{}');
        if (j.is_live === true || j.live_status === 'is_live') {
            return {
                isLive: true,
                title: j.title || 'Live stream',
                thumbnail: j.thumbnail || null,
                videoId: j.id || null,
                // the stream itself, so the button still opens it once the channel's /live page moves on
                url: j.id ? `https://youtube.com/watch?v=${j.id}` : watchUrl,
                viewers: Number.isFinite(j.concurrent_view_count) ? j.concurrent_view_count : null,
                startedAt: j.release_timestamp || j.timestamp || null,
                author: j.channel || j.uploader || null,
                description: j.description || '',
            };
        }
        return { isLive: false };
    } catch (e) {
        const msg = String(e.message || '') + String(e.stderr || '');
        // "Not currently live" is a valid answer, not an error
        if (/not currently live|has ended|not a live|no live|will begin in|premiere|upcoming/i.test(msg)) {
            return { isLive: false };
        }
        // Real errors — cookie expiry, block, network
        logYtErrThrottled(channelId, msg);
        return await fetchLiveFallback(channelId);
    }
}

async function fetchLiveFallback(channelId) {
    const up = await fetchLatestUpload(channelId);
    if (!up) return { isLive: false };
    try {
        const { stdout } = await execFileAsync('yt-dlp', [
            '--skip-download', '--no-warnings', '--no-playlist',
            '--cookies', COOKIE_FILE,
            '--print', 'live_status',
            up.url,
        ], { timeout: YTDLP_TIMEOUT_MS });
        const status = String(stdout).trim();
        if (status === 'is_live') {
            return { isLive: true, title: up.title, thumbnail: up.thumbnail, url: up.url, videoId: up.id, author: up.author, description: up.description || '' };
        }
        return { isLive: false };
    } catch {
        return { isLive: false };
    }
}

// ─── Upload check: YouTube's channel feed, then the uploads-playlist feed, then yt-dlp ───
// YouTube's RSS feeds often answer 404/500 for hours. Each failure used to print a line per channel every few
// minutes; now one line when a channel's feed breaks and one when it comes back.
const _feedDown = new Map();   // channelId -> since (ms)
const unxml = (s) => String(s).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function parseFeed(xml, channelId) {
    const first = String(xml).split('<entry>')[1];
    if (!first) return null;
    const id = (first.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
    if (!id) return null;
    const title = (first.match(/<title>([^<]+)<\/title>/) || [])[1];
    const published = (first.match(/<published>([^<]+)<\/published>/) || [])[1];
    const author = (first.match(/<name>([^<]+)<\/name>/) || [])[1];
    const thumb = (first.match(/<media:thumbnail url="([^"]+)"/) || [])[1];
    const link = (first.match(/<link rel="alternate" href="([^"]+)"/) || [])[1] || '';
    const views = Number((first.match(/<media:statistics views="(\d+)"/) || [])[1]);
    const description = unxml((first.match(/<media:description>([\s\S]*?)<\/media:description>/) || [])[1] || '');
    const isShort = /\/shorts\//.test(link);
    return { id, title: unxml(title || '') || 'Untitled', published, author: unxml(author || '') || channelId, thumbnail: thumb, isShort,
        views: Number.isFinite(views) ? views : null, description, url: isShort ? `https://youtube.com/shorts/${id}` : `https://youtube.com/watch?v=${id}` };
}
async function fetchLatestUpload(channelId) {
    const headers = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36' };
    const urls = [`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`];
    if (/^UC[\w-]{22}$/.test(channelId)) urls.push(`https://www.youtube.com/feeds/videos.xml?playlist_id=UU${channelId.slice(2)}`);
    let why = null;
    for (const url of urls) {
        try {
            const res = await axios.get(url, { timeout: 10000, headers });
            const up = parseFeed(res.data, channelId);
            if (up) { if (_feedDown.delete(channelId)) console.log(`[YOUTUBE] feed back for ${channelId}`); return up; }
        } catch (e) { why = e.response?.status || e.code || e.message; }
    }
    // Last resort: the channel's newest video through yt-dlp (slower, but it doesn't depend on the feeds)
    try {
        const { stdout } = await execFileAsync('yt-dlp', ['--flat-playlist', '--playlist-items', '1', '--no-warnings', '--cookies', COOKIE_FILE,
            '--print', '%(id)s\t%(title)s', `https://www.youtube.com/channel/${channelId}/videos`], { timeout: YTDLP_TIMEOUT_MS });
        const [id, title] = String(stdout).trim().split('\t');
        if (id && /^[\w-]{11}$/.test(id)) {
            if (_feedDown.delete(channelId)) console.log(`[YOUTUBE] feed back for ${channelId} (yt-dlp)`);
            return { id, title: title || 'Untitled', published: null, author: channelId, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, url: `https://youtube.com/watch?v=${id}` };
        }
    } catch (e) { why = why || String(e.message).slice(0, 80); }
    if (!_feedDown.has(channelId)) { _feedDown.set(channelId, Date.now()); console.log(`[YOUTUBE] feed unavailable for ${channelId} (${why}); retrying quietly`); }
    return null;
}

// A new video in the feed, looked at once before it is announced: a scheduled live or a premiere shows up in the
// feed before it starts (it used to be posted as a "new video", then again as a live), and this gives the length.
async function probeVideo(id) {
    try {
        const { stdout } = await execFileAsync('yt-dlp', ['--skip-download', '--no-warnings', '--no-playlist', '--cookies', COOKIE_FILE,
            '--dump-json', `https://www.youtube.com/watch?v=${id}`], { timeout: YTDLP_TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024 });
        const j = JSON.parse(String(stdout).trim().split('\n')[0] || '{}');
        return { liveStatus: j.live_status || null, duration: j.duration || null, views: Number.isFinite(j.view_count) ? j.view_count : null,
            description: j.description || '', uploadedAt: j.timestamp || null };
    } catch (e) {
        const msg = String(e.message || '') + String(e.stderr || '');
        if (/will begin|premiere|upcoming|live event/i.test(msg)) return { liveStatus: 'is_upcoming' };
        return null;   // can't tell: announce it with what the feed gave
    }
}

// ─── Cards ───
// A few words from the description: no links, no mentions, two lines at most
function snippet(text, max = 180) {
    const lines = String(text || '').replace(/https?:\/\/\S+/g, '').replace(/@/g, '@\u200b').replace(/[*_~`|>#]/g, '')
        .split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 2).join(' · ');
    return lines.length > max ? lines.slice(0, max).replace(/\s+\S*$/, '') + '…' : lines;
}
const fmtNum = (n, lang) => Number(n).toLocaleString({ fr: 'fr-FR', zh: 'zh-CN', ar: 'ar' }[lang] || 'en-US');
function fmtDuration(sec) {
    sec = Math.round(sec || 0); if (!sec) return null;
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
const rule = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

function buildLiveEmbed(channelId, live, handle, client, lang = 'en', pingText = null) {
    const isPreview = live._test === true;
    const name = handle ? '@' + handle : channelId;
    const title = live.title || 'Live stream';
    const watchUrl = live.url || (handle ? `https://youtube.com/@${handle}/live` : `https://youtube.com/channel/${channelId}/live`);
    const header = isPreview
        ? t('livestream.card_preview_title', lang, { name })
        : t('livestream.card_live_title', lang, { icon: em('ic_live', '🔴'), name });
    const body = isPreview ? t('livestream.card_preview_body', lang, { name }) : t('livestream.card_live_body', lang, { name });
    const c = new ContainerBuilder().setAccentColor(isPreview ? 0xf39c12 : 0xFF0000);
    if (pingText) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(pingText));
    if (live.thumbnail) c.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(live.thumbnail)));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${header}`));
    c.addSeparatorComponents(rule());
    const facts = [];
    if (!isPreview && live.startedAt) facts.push(`${em('clock', '🕒')} ${t('livestream.detail_started', lang, { when: `<t:${live.startedAt}:R>` })}`);
    if (!isPreview && live.viewers != null) facts.push(`${em('ic_users', '👥')} ${t('livestream.detail_viewers', lang, { n: fmtNum(live.viewers, lang) })}`);
    const about = isPreview ? '' : snippet(live.description);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**\n${facts.length ? facts.join('  ·  ') : body}${about ? `\n-# ${about}` : ''}`));
    c.addSeparatorComponents(rule());
    c.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel(t('livestream.btn_watch_live', lang)).setStyle(ButtonStyle.Link).setURL(watchUrl).setEmoji(iconObj('ic_live', null, '🔴')),
        new ButtonBuilder().setLabel(t('livestream.btn_channel', lang)).setStyle(ButtonStyle.Link).setURL(handle ? `https://youtube.com/@${handle}` : `https://youtube.com/channel/${channelId}`).setEmoji(iconObj('ic_youtube', null, '📺'))
    ));
    return { _v2: { components: [c], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: ['everyone'] } } };
}

function buildVideoEmbed(upload, handle, client, lang = 'en') {
    const name = handle ? '@' + handle : (upload.author || 'YouTube');
    const c = new ContainerBuilder().setAccentColor(0xFF0000);
    if (upload.thumbnail) c.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(upload.thumbnail)));
    const short = !!upload.isShort;
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${t(short ? 'livestream.card_short_title' : 'livestream.card_video_title', lang, { icon: EMOJIS.ic_youtube || '✨', name })}`));
    c.addSeparatorComponents(rule());
    const facts = [];
    const when = upload.uploadedAt || (upload.published ? Math.floor(Date.parse(upload.published) / 1000) : null);
    if (when) facts.push(`${em('clock', '🕒')} ${t('livestream.detail_published', lang, { when: `<t:${when}:R>` })}`);
    const len = fmtDuration(upload.duration);
    if (len) facts.push(`${em('ic_video', '🎬')} ${len}`);
    if (upload.views) facts.push(`${em('ic_eye', '👀')} ${t('livestream.detail_views', lang, { n: fmtNum(upload.views, lang) })}`);
    const about = snippet(upload.description);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${upload.title || 'Untitled'}**\n${facts.length ? facts.join('  ·  ') : t('livestream.card_video_body', lang, { name })}${about ? `\n-# ${about}` : ''}`));
    c.addSeparatorComponents(rule());
    c.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel(t(short ? 'livestream.btn_watch_short' : 'livestream.btn_watch_video', lang)).setStyle(ButtonStyle.Link).setURL(upload.url).setEmoji(iconObj('ic_video', null, '🎬')),
        new ButtonBuilder().setLabel(t('livestream.btn_channel', lang)).setStyle(ButtonStyle.Link).setURL(handle ? `https://youtube.com/@${handle}` : `https://youtube.com/channel/${upload.channelId || ''}`).setEmoji(iconObj('ic_youtube', null, '📺'))
    ));
    return { _v2: { components: [c], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } } };
}

function canNotifyLive(guildId, channelId) {
    const last = lastNotificationTime.get(`${guildId}:${channelId}`);
    if (!last) return true;
    return (Date.now() - last) >= NOTIFICATION_COOLDOWN_MINUTES * 60 * 1000;
}

async function sendNotification(client, db, guildId, channelId, handle, payload, type) {
    try {
        if (type === 'live' && !canNotifyLive(guildId, channelId)) return { ok: false, reason: 'cooldown' };
        const track = db.prepare('SELECT target_channel_id, upload_channel_id FROM youtube_notifications WHERE guild_id = ? AND youtube_channel_id = ? COLLATE NOCASE').get(guildId, channelId);
        if (!track) return { ok: false, reason: 'not_tracked' };
        // uploads go to their own channel when one is set; lives (and tests) to the main one
        if (type === 'video' && track.upload_channel_id) track.target_channel_id = track.upload_channel_id;
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return { ok: false, reason: 'guild_missing' };
        const channel = guild.channels.cache.get(track.target_channel_id);
        if (!channel) {
            require('../lib/postProblems').failed(guild, 'youtube', track.target_channel_id, { ok: false, reason: 'gone', missing: [] });
            return { ok: false, reason: 'channel_gone' };
        }
        const _pre = require('../lib/canPost').diagnose(guild, channel, guild.members.me, require('../lib/canPost').neededFor('youtube'));
        if (!_pre.ok) {
            require('../lib/postProblems').failed(guild, 'youtube', channel.id, _pre);
            return { ok: false, reason: 'no_permission' };
        }

        const lang = livLang(client, guildId);
        const name = handle ? '@' + handle : channelId;
        let card;
        if (type === 'live') card = buildLiveEmbed(channelId, payload, handle, client, lang, t('livestream.card_live_ping', lang, { icon: em('ic_live', '🔴'), name }));
        else if (type === 'video') card = buildVideoEmbed(payload, handle, client, lang);
        else card = buildLiveEmbed(channelId, payload, handle, client, lang);
        await require('../lib/safeSend').safeSend('youtube', channel, { ...card._v2 }, { throwOnError: true });
        if (type === 'live') lastNotificationTime.set(`${guildId}:${channelId}`, Date.now());
        if (type === 'live' || type === 'video') require('../lib/alert-log').record(db, guildId, `youtube_${type}`);
        return { ok: true };
    } catch (e) {
        const msg = String(e?.message || e);
        console.error('[LIVESTREAM] sendNotification failed:', msg);
        let reason = 'unknown';
        if (/Invalid emoji/i.test(msg)) reason = 'invalid_emoji';
        else if (/Missing Permissions/i.test(msg)) reason = 'no_permission';
        else if (/Unknown Channel/i.test(msg)) reason = 'channel_gone';
        else if (/Missing Access/i.test(msg)) reason = 'no_access';
        return { ok: false, reason, detail: msg.slice(0, 200) };
    }
}

// ─── Polling ───
function startPolling(client, db) {
    if (isPolling) return;
    isPolling = true;
    initDatabase(db);

    // Priority channels: every 2 min
    priorityInterval = setInterval(() => runCycle(client, db, true).catch(() => {}), PRIORITY_INTERVAL_MS);
    priorityInterval.unref?.();

    // Normal channels: every 5 min
    normalInterval = setInterval(() => runCycle(client, db, false).catch(() => {}), POLL_INTERVAL_MS);
    normalInterval.unref?.();

    // Kick off once after boot
    setTimeout(() => runCycle(client, db, false).catch(() => {}), 45000);
    console.log('[YOUTUBE] Polling engine active · priority 2min · normal 5min');
}

function stopPolling() {
    if (priorityInterval) { clearInterval(priorityInterval); priorityInterval = null; }
    if (normalInterval) { clearInterval(normalInterval); normalInterval = null; }
    isPolling = false;
}

async function runCycle(client, db, priorityOnly) {
    try {
        const rows = priorityOnly
            ? db.prepare('SELECT * FROM youtube_notifications WHERE priority = 1').all()
            : db.prepare('SELECT * FROM youtube_notifications').all();
        if (!rows.length) return;

        const byChannel = new Map();
        for (const r of rows) {
            const k = r.youtube_channel_id.toLowerCase();
            if (!byChannel.has(k)) byChannel.set(k, []);
            byChannel.get(k).push(r);
        }

        for (const [, tracks] of byChannel) {
            const chId = tracks[0].youtube_channel_id; // YouTube IDs are case-sensitive
            const handle = handleOf(tracks[0]?.youtube_handle);
            if (busy.has(chId)) continue;   // the other cycle is on it
            busy.add(chId);
            try {

            const live = await fetchLiveStatus(chId, handle);
            if (live.isLive) {
                offlineCounters.delete(chId);
                if (live.videoId) { liveVideoIds.set(chId, live.videoId); markSeen(db, chId, [live.videoId]); }
                const setLive = (gid) => db.prepare('UPDATE youtube_notifications SET is_live = 1, live_video_id = COALESCE(?, live_video_id) WHERE guild_id = ? AND youtube_channel_id = ?').run(live.videoId || null, gid, chId);
                for (const t of tracks) {
                    if (t.is_live === 1) continue;
                    // alerts off, or this very stream was already announced (it dropped and came back): no new post
                    if (t.notify_live === 0 || (live.videoId && t.live_video_id === live.videoId)) { setLive(t.guild_id); continue; }
                    if (canNotifyLive(t.guild_id, chId)) {
                        const sent = await sendNotification(client, db, t.guild_id, chId, handle, live, 'live');
                        console.log(`[YOUTUBE] live ${live.videoId || '?'} on ${handle || chId} -> ${t.guild_id}: ${sent.ok ? 'sent' : 'failed (' + sent.reason + ')'}`);
                        if (sent.ok) setLive(t.guild_id);
                    }
                }
            } else {
                const off = (offlineCounters.get(chId) || 0) + 1;
                offlineCounters.set(chId, off);
                if (off >= REQUIRED_OFFLINE_CHECKS) {
                    db.prepare('UPDATE youtube_notifications SET is_live = 0 WHERE youtube_channel_id = ?').run(chId);
                    for (const t of tracks) lastNotificationTime.delete(`${t.guild_id}:${chId}`);
                }
            }

            // Uploads — only check on normal cycle (RSS is cheap)
            if (!priorityOnly) {
                const up = await fetchLatestUpload(chId);
                if (up) {
                    up.channelId = chId;
                    const fresh = db.prepare('SELECT guild_id, seen_videos FROM youtube_notifications WHERE youtube_channel_id = ?').all(chId);
                    const seenBy = new Map(fresh.map(r => [r.guild_id, seenOf(r)]));
                    const age = up.published ? Date.now() - Date.parse(up.published) : 0;
                    const tooOld = Number.isFinite(age) && age > MAX_VIDEO_AGE_MS;
                    let probed;   // looked up once, for the first server that needs it
                    for (const t of tracks) {
                        const seen = seenBy.get(t.guild_id) || [];
                        if (t.last_video_id && seen.length && t.last_video_id !== up.id && !seen.includes(up.id) && !tooOld
                            && t.notify_uploads !== 0 && up.id !== liveVideoIds.get(chId) && up.id !== t.live_video_id) {
                            if (probed === undefined) {
                                probed = await probeVideo(up.id);
                                if (probed) Object.assign(up, { duration: probed.duration, views: probed.views ?? up.views,
                                    description: probed.description || up.description, uploadedAt: probed.uploadedAt });
                            }
                            // a live (scheduled, running or just ended) or a premiere: the live alert covers it
                            if (probed && /^(is_upcoming|is_live|post_live|was_live)$/.test(probed.liveStatus || '')) {
                                console.log(`[YOUTUBE] ${up.id} on ${handle || chId} is a live (${probed.liveStatus}), not posted as a video`);
                                continue;
                            }
                            const sent = await sendNotification(client, db, t.guild_id, chId, handle, up, 'video'); console.log(`[YOUTUBE] new video ${up.id} on ${handle || chId} -> ${t.guild_id}: ${sent.ok ? 'sent' : 'failed (' + sent.reason + ')'}`);
                        }
                        db.prepare('UPDATE youtube_notifications SET last_video_id = ? WHERE guild_id = ? AND youtube_channel_id = ?').run(up.id, t.guild_id, chId);
                    }
                    // first run with the new list: remember what's there now without posting anything
                    markSeen(db, chId, [...new Set([up.id, ...tracks.map(t => t.last_video_id)].filter(Boolean))]);
                }
            }

            } finally { busy.delete(chId); }
            await new Promise(r => setTimeout(r, 1500 + Math.random() * 2000));
        }
    } catch (e) {
        console.error('[YOUTUBE] cycle:', e.message);
    }
}

// A @handle already on this server's list needs no YouTube lookup (remove and test used to fail when YouTube was slow)
async function trackedOrResolve(db, guildId, input) {
    const clean = String(input || '').replace(/^@/, '').trim();
    if (isChannelId(clean)) return { id: clean, reason: 'ok' };
    try {
        const row = db.prepare('SELECT youtube_channel_id FROM youtube_notifications WHERE guild_id = ? AND youtube_handle = ? COLLATE NOCASE').get(guildId, clean);
        if (row) return { id: row.youtube_channel_id, reason: 'ok' };
    } catch {}
    return resolveHandle(clean);
}

// ─── List ───
const MAX_TOGGLE_ROWS = 6; // a V2 card holds 40 components; 6 channels with three buttons each fit

function toggleButton(kind, row, lang, view = '') {
    const on = (kind === 'live' ? row.notify_live : row.notify_uploads) !== 0;
    return new ButtonBuilder()
        .setCustomId(`ls_toggle:${kind}:${row.youtube_channel_id}${view ? ':' + view : ''}`)
        .setLabel(t(`livestream.btn_${kind}_${on ? 'on' : 'off'}`, lang))
        .setStyle(on ? ButtonStyle.Success : ButtonStyle.Secondary);
}

// Where this channel's alerts go: one line, or live and uploads apart when they differ
function whereLine(row, lang) {
    const up = row.upload_channel_id && row.upload_channel_id !== row.target_channel_id ? row.upload_channel_id : null;
    return up ? `↳ ${em('ic_live', '🔴')} <#${row.target_channel_id}> · ${em('ic_video', '🎬')} <#${up}>` : `↳ <#${row.target_channel_id}>`;
}
function channelsButton(row, lang, view = '') {
    return new ButtonBuilder().setCustomId(`ls_chan:${row.youtube_channel_id}${view ? ':' + view : ''}`).setLabel(t('livestream.btn_channels', lang)).setStyle(ButtonStyle.Secondary);
}

function statusText(row, client, lang) {
    return row.is_live === 1
        ? `${em('online', em('ic_status_ok', '🟢'))} ${t('livestream.status_live', lang)}`
        : `${em('offline', em('ic_status_bad', '🔴'))} ${t('livestream.status_offline', lang)}`;
}

function buildListEmbed(tracks, guild, client, lang = 'en') {
    const c = new ContainerBuilder().setAccentColor(0xFF0000);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${em('ic_youtube', '📺')} ${t('livestream.list_title', lang, { server: guild.name })}`));
    c.addSeparatorComponents(rule());
    if (!tracks.length) {
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(t('livestream.list_empty', lang, { mention: mentions(client, 'livestream', 'set') })));
        return c;
    }
    tracks.slice(0, MAX_TOGGLE_ROWS).forEach((row, i) => {
        const prio = row.priority === 1 ? ' ⚡' : '';
        const tag = handleOf(row.youtube_handle) ? '@' + handleOf(row.youtube_handle) : row.youtube_channel_id;
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${i + 1}. ${tag}**${prio}  ·  ${statusText(row, client, lang)}\n${whereLine(row, lang)}`));
        c.addActionRowComponents(new ActionRowBuilder().addComponents(toggleButton('live', row, lang), toggleButton('up', row, lang), channelsButton(row, lang)));
    });
    const more = tracks.length - MAX_TOGGLE_ROWS;
    if (more > 0) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(t('livestream.list_more', lang, { count: more, mention: mentions(client, 'livestream', 'set') })));
    c.addSeparatorComponents(rule());
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${t('livestream.list_hint', lang)} · ARCHON CG-223`));
    return c;
}

// Confirmation card after /livestream set, with the same two switches
function buildSetCard(row, client, lang = 'en') {
    const name = handleOf(row.youtube_handle) ? '@' + handleOf(row.youtube_handle) : row.youtube_channel_id;
    const lines = [row.upload_channel_id && row.upload_channel_id !== row.target_channel_id
        ? t('livestream.set_where_split', lang, { live: `<#${row.target_channel_id}>`, uploads: `<#${row.upload_channel_id}>` })
        : t('livestream.set_where', lang, { channel: `<#${row.target_channel_id}>` })];
    if (row.priority === 1) lines.push(`-# ${t('livestream.set_priority', lang)}`);
    if (row.is_live === 1) lines.push(`${em('ic_live', '🔴')} ${t('livestream.set_live_now', lang, { name })}`);
    if (row.last_video_id) lines.push(`${em('ic_video', '🎬')} ${t('livestream.set_latest', lang, { url: `https://youtube.com/watch?v=${row.last_video_id}` })}`);
    const c = new ContainerBuilder().setAccentColor(0x2ecc71);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${em('ic_youtube', '📺')} ${t('livestream.set_title', lang, { name })}\n${lines.join('\n')}`));
    c.addSeparatorComponents(rule());
    c.addActionRowComponents(new ActionRowBuilder().addComponents(toggleButton('live', row, lang, 'set'), toggleButton('up', row, lang, 'set'), channelsButton(row, lang, 'set')));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${t('livestream.set_hint', lang, { mention: mentions(client, 'livestream', 'list') })}`));
    return c;
}

// Switch a channel's live or upload alerts from the list or set card (owner and admins only)
async function handleToggle(interaction, client) {
    const db = client.db;
    const lang = livLang(client, interaction.guildId, interaction);
    { const _no = require('../lib/access').deny(interaction.member, 'alerts', lang); if (_no) return interaction.reply({ content: _no, flags: 64, allowedMentions: { parse: [] } }); }

    const [, kind, channelId, view] = interaction.customId.split(':');
    const col = kind === 'live' ? 'notify_live' : 'notify_uploads';
    const row = db.prepare(`SELECT ${col} AS v FROM youtube_notifications WHERE guild_id = ? AND youtube_channel_id = ?`).get(interaction.guildId, channelId);
    if (!row) return interaction.reply({ content: t('livestream.toggle_gone', lang), flags: 64 });

    db.prepare(`UPDATE youtube_notifications SET ${col} = ? WHERE guild_id = ? AND youtube_channel_id = ?`).run(row.v === 0 ? 1 : 0, interaction.guildId, channelId);
    if (view === 'set') {
        const full = db.prepare('SELECT * FROM youtube_notifications WHERE guild_id = ? AND youtube_channel_id = ?').get(interaction.guildId, channelId);
        return interaction.update({ components: [buildSetCard(full, client, lang)], flags: MessageFlags.IsComponentsV2 });
    }
    const rows = db.prepare('SELECT * FROM youtube_notifications WHERE guild_id = ?').all(interaction.guildId);
    return interaction.update({ components: [buildListEmbed(rows, interaction.guild, client, lang)], flags: MessageFlags.IsComponentsV2 });
}

// "Channels" button: two channel menus (live alerts, uploads), shown to the admin only
async function handleChannels(interaction, client) {
    const db = client.db;
    const lang = livLang(client, interaction.guildId, interaction);
    { const _no = require('../lib/access').deny(interaction.member, 'alerts', lang); if (_no) return interaction.reply({ content: _no, flags: 64, allowedMentions: { parse: [] } }); }
    const [kind, a, b] = interaction.customId.split(':');
    const types = [ChannelType.GuildText, ChannelType.GuildAnnouncement];

    if (kind === 'ls_chan') {
        const ytId = a;
        const row = db.prepare('SELECT * FROM youtube_notifications WHERE guild_id = ? AND youtube_channel_id = ?').get(interaction.guildId, ytId);
        if (!row) return interaction.reply({ content: t('livestream.toggle_gone', lang), flags: 64 });
        const name = handleOf(row.youtube_handle) ? '@' + handleOf(row.youtube_handle) : ytId;
        const liveMenu = new ChannelSelectMenuBuilder().setCustomId(`ls_chsel:live:${ytId}`).setChannelTypes(...types)
            .setPlaceholder(t('livestream.pick_live_channel', lang)).setDefaultChannels(row.target_channel_id);
        const upMenu = new ChannelSelectMenuBuilder().setCustomId(`ls_chsel:up:${ytId}`).setChannelTypes(...types)
            .setPlaceholder(t('livestream.pick_upload_channel', lang)).setDefaultChannels(row.upload_channel_id || row.target_channel_id);
        return interaction.reply({
            content: t('livestream.channels_how', lang, { name, iconLive: em('ic_live', '🔴'), iconVideo: em('ic_video', '🎬') }),
            components: [new ActionRowBuilder().addComponents(liveMenu), new ActionRowBuilder().addComponents(upMenu)],
            flags: 64, allowedMentions: { parse: [] },
        });
    }
    // ls_chsel:<live|up>:<ytId>
    const which = a, ytId = b, picked = interaction.channels?.first?.();
    if (!picked) return interaction.deferUpdate().catch(() => {});
    const row = db.prepare('SELECT * FROM youtube_notifications WHERE guild_id = ? AND youtube_channel_id = ?').get(interaction.guildId, ytId);
    if (!row) return interaction.reply({ content: t('livestream.toggle_gone', lang), flags: 64 });
    const check = require('../lib/canPost').diagnose(interaction.guild, picked, interaction.guild.members.me, require('../lib/canPost').neededFor('youtube'));
    if (!check.ok) return interaction.reply({ content: t('livestream.channel_no_perms', lang, { channel: `<#${picked.id}>` }), flags: 64, allowedMentions: { parse: [] } });
    if (which === 'live') db.prepare('UPDATE youtube_notifications SET target_channel_id = ? WHERE guild_id = ? AND youtube_channel_id = ?').run(picked.id, interaction.guildId, ytId);
    else db.prepare('UPDATE youtube_notifications SET upload_channel_id = ? WHERE guild_id = ? AND youtube_channel_id = ?').run(picked.id === row.target_channel_id ? null : picked.id, interaction.guildId, ytId);
    const name = handleOf(row.youtube_handle) ? '@' + handleOf(row.youtube_handle) : ytId;
    return interaction.reply({ content: `${em('ic_ok', '✅')} ${t(which === 'live' ? 'livestream.live_channel_set' : 'livestream.upload_channel_set', lang, { name, channel: `<#${picked.id}>` })}`, flags: 64, allowedMentions: { parse: [] } });
}

module.exports = {
    name: 'livestream',
    aliases: ['livestream', 'ls', 'lsn'],
    description: '📺 YouTube Live & upload notification system',
    category: 'UTILITY',
    usage: '.livestream [set|remove|list|check|test]',
    cooldown: 3000,
    examples: ['.livestream set @MrBeast #social', '.livestream set @MrBeast #social --priority', '.livestream remove @MrBeast', '.livestream list'],

    data: new SlashCommandBuilder().setName('livestream').setDescription('📺 Manage YouTube Live notifications')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(s => s.setName('set').setDescription('Track a YouTube channel')
            .addStringOption(o => o.setName('channel').setDescription('Handle (@name) or UC... channel ID').setRequired(true))
            .addChannelOption(o => o.setName('target').setDescription('Where to post alerts').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
            .addBooleanOption(o => o.setName('priority').setDescription('Poll every 2 min instead of 5').setRequired(false))
            .addBooleanOption(o => o.setName('live').setDescription('Post when the channel goes live (on by default)').setRequired(false))
            .addBooleanOption(o => o.setName('uploads').setDescription('Post new videos (on by default)').setRequired(false)))
        .addSubcommand(s => s.setName('remove').setDescription('Stop tracking')
            .addStringOption(o => o.setName('channel').setDescription('Handle or ID').setRequired(true).setAutocomplete(true)))
        .addSubcommand(s => s.setName('list').setDescription('Show tracked channels'))
        .addSubcommand(s => s.setName('test').setDescription('Send a test live alert')
            .addStringOption(o => o.setName('channel').setDescription('Tracked channel').setRequired(true).setAutocomplete(true))),

    async run(client, message, args, db, serverSettings, usedCommand, lang) {
        const prefix = serverSettings?.prefix || '.';
        const guildId = message.guild?.id;
        if (!guildId) return message.reply(t('livestream.prefix_server_only', livLang(client, null)));
        initDatabase(db);

        const action = (args[0] || 'list').toLowerCase();

        if (action === 'list') {
            const rows = db.prepare('SELECT * FROM youtube_notifications WHERE guild_id = ?').all(guildId);
            return message.reply({ components: [buildListEmbed(rows, message.guild, client, livLang(client, guildId, message))], flags: MessageFlags.IsComponentsV2 });
        }

        if (!isGuildOwner(message)) return message.reply({ content: require('../lib/access').deny(message.member, 'alerts', livLang(client, guildId, message)), allowedMentions: { parse: [] } });

        if (action === 'set') {
            const input = String(args[1] || '').trim();
            const chMention = args[2];
            const priority = args.includes('--priority') || args.includes('-p');
            if (!input || !chMention) return message.reply(t('livestream.cmd_help', livLang(client, guildId, message), { prefix }));

            const raw = chMention.replace(/[<#>]/g, '').trim();
            let channel = message.guild.channels.cache.get(raw) || message.guild.channels.cache.find(c => c.name.toLowerCase() === raw.toLowerCase());
            if (!channel) return message.reply(t('livestream.prefix_channel_not_found', livLang(client, guildId, message)));

            const statusMsg = await message.reply(t('livestream.prefix_resolving', livLang(client, guildId, message)));
            const { id: channelId, reason: _resolveReason } = await resolveHandle(input);
            if (!channelId) return statusMsg.edit(resolveErrMsg(client, message.guild.id, _resolveReason, input));

            const handle = handleOf(input);

            const existing = db.prepare('SELECT target_channel_id, priority FROM youtube_notifications WHERE guild_id = ? AND youtube_channel_id = ?').get(guildId, channelId);
            if (existing && existing.target_channel_id === channel.id && existing.priority === (priority ? 1 : 0)) {
                return statusMsg.edit(t('livestream.already_tracked', livLang(client, guildId, message), { handle: handle ? '@' + handle : channelId, channel: channel.id }));
            }

            

            const live = await fetchLiveStatus(channelId, handle);
            const up = await fetchLatestUpload(channelId);

            db.prepare(`INSERT INTO youtube_notifications (guild_id, youtube_channel_id, youtube_handle, target_channel_id, last_video_id, is_live, priority)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(guild_id, youtube_channel_id) DO UPDATE SET
                    target_channel_id = excluded.target_channel_id,
                    youtube_handle = excluded.youtube_handle,
                    last_video_id = COALESCE(youtube_notifications.last_video_id, excluded.last_video_id),
                    priority = excluded.priority`).run(guildId, channelId, handle, channel.id, up?.id || null, live.isLive ? 1 : 0, priority ? 1 : 0);
            // a new channel starts with its latest video already "seen", so the next new video is announced
            if (up?.id) try { markSeen(db, channelId, [up.id]); } catch (_) {}

            const _L3 = livLang(client, guildId, message);
            const _row = db.prepare('SELECT * FROM youtube_notifications WHERE guild_id = ? AND youtube_channel_id = ?').get(guildId, channelId);
            await statusMsg.delete().catch(() => {});
            const _setCard = buildSetCard(_row, client, _L3);
            const _warn = require('../lib/postProblems').setupWarning(message.guild, channel, 'youtube', _L3, message);
            if (_warn) _setCard.addTextDisplayComponents(new TextDisplayBuilder().setContent(_warn));
            return message.reply({ components: [_setCard], flags: MessageFlags.IsComponentsV2 });
        }

        if (action === 'remove') {
            const input = String(args[1] || '').replace(/^@/, '').trim();
            const { id: channelId, reason: _resolveReason } = await trackedOrResolve(db, guildId, input);
            if (!channelId) return message.reply(resolveErrMsg(client, message.guild.id, _resolveReason, input));
            let res = db.prepare('DELETE FROM youtube_notifications WHERE guild_id = ? AND youtube_channel_id = ? COLLATE NOCASE').run(guildId, channelId);
            if (res.changes === 0) {
                const cleanHandle = String(input).replace(/^@/, '').trim();
                res = db.prepare('DELETE FROM youtube_notifications WHERE guild_id = ? AND youtube_handle = ? COLLATE NOCASE').run(guildId, cleanHandle);
            }
            return message.reply(res.changes ? t('livestream.cmd_removed', livLang(client, guildId, message), { handle: input }) : t('livestream.cmd_not_tracked', livLang(client, guildId, message), { handle: input }));
        }

        if (action === 'test') {
            const input = String(args[1] || '').replace(/^@/, '').trim();
            const { id: channelId, reason: _resolveReason } = await trackedOrResolve(db, guildId, input);
            if (!channelId) return message.reply(resolveErrMsg(client, message.guild.id, _resolveReason, input));
            const track = db.prepare('SELECT * FROM youtube_notifications WHERE guild_id = ? AND youtube_channel_id = ? COLLATE NOCASE').get(guildId, channelId);
            if (!track) return message.reply(t('livestream.cmd_not_tracked_hint', livLang(client, guildId, message), { handle: input, mention: mentions(client, 'livestream', 'set') }));
            const live = await fetchLiveStatus(channelId, handleOf(track.youtube_handle));
            const isRealLive = !!live.isLive;
            const payload = isRealLive
                ? live
                : { isLive: true, _test: true, title: 'Layout preview', thumbnail: null, url: `https://youtube.com/channel/${channelId}/live` };
            const sent = await sendNotification(client, db, guildId, channelId, handleOf(track.youtube_handle), payload, 'system_test');
            if (!sent.ok) {
            const _lang = livLang(client, guildId, message);
            const _key = 'livestream.errors.' + (sent.reason || 'unknown');
            const _msg = t(_key, _lang, { channel: `<#${track.target_channel_id}>`, detail: sent.detail || '' });
            return message.reply(_msg && _msg !== _key ? _msg : t('livestream.errors.unknown', _lang, { detail: sent.detail || 'no detail' }));
        }
            return message.reply(isRealLive
                ? t('livestream.cmd_real_alert', livLang(client, guildId, message), { handle: track.youtube_handle || channelId })
                : t('livestream.cmd_test_preview', livLang(client, guildId, message), { handle: track.youtube_handle || channelId }));
        }

        return message.reply(t('livestream.cmd_help', livLang(client, guildId, message), { prefix }));
    },

    async autocomplete(interaction, client) {
        const focused = String(interaction.options.getFocused() || '').trim();
        const guildId = interaction.guildId || interaction.guild?.id;
        const sub = interaction.options.getSubcommand();
        if (!guildId) return require('../lib/autocomplete').reply(interaction, []);
        initDatabase(client.db);
        const rows = client.db.prepare('SELECT youtube_channel_id, youtube_handle FROM youtube_notifications WHERE guild_id = ?').all(guildId);
        // exclude the subcommand's own context if needed (remove/test both want the full list)
        const items = rows.map(r => { const h = handleOf(r.youtube_handle); return {
            name: h ? `@${h} (${r.youtube_channel_id.slice(0, 8)}…)` : r.youtube_channel_id,
            value: h ? `@${h}` : r.youtube_channel_id,
        }; }).filter(i => !focused || i.name.toLowerCase().includes(focused.toLowerCase().replace(/^@/, '')));
        return require('../lib/autocomplete').reply(interaction, items);
    },

    async execute(interaction, client) {
        const lang = require('../lib/pick-lang').pickLang(client, interaction.guildId, interaction, interaction.user?.id);
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const db = client.db;
        initDatabase(db);

        if (sub === 'list') {
            const rows = db.prepare('SELECT * FROM youtube_notifications WHERE guild_id = ?').all(guildId);
            return interaction.reply({ components: [buildListEmbed(rows, interaction.guild, client, lang)], flags: MessageFlags.IsComponentsV2 });
        }
        { const _no = require('../lib/access').deny(interaction.member, 'alerts', lang); if (_no) return interaction.reply({ content: _no, flags: 64, allowedMentions: { parse: [] } }); }

        if (sub === 'set') {
            await interaction.deferReply({ flags: 64 });
            const input = interaction.options.getString('channel').trim();
            const target = interaction.options.getChannel('target');
            const priority = interaction.options.getBoolean('priority') || false;
            const { id: channelId, reason: _resolveReason } = await resolveHandle(input);
            if (!channelId) return interaction.editReply(resolveErrMsg(interaction.client, interaction.guildId, _resolveReason, input));
            const handle = handleOf(input);

            const live = await fetchLiveStatus(channelId, handle);
            const up = await fetchLatestUpload(channelId);
            db.prepare(`INSERT INTO youtube_notifications (guild_id, youtube_channel_id, youtube_handle, target_channel_id, last_video_id, is_live, priority)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(guild_id, youtube_channel_id) DO UPDATE SET
                    target_channel_id = excluded.target_channel_id,
                    youtube_handle = excluded.youtube_handle,
                    last_video_id = COALESCE(youtube_notifications.last_video_id, excluded.last_video_id),
                    priority = excluded.priority`).run(guildId, channelId, handle, target.id, up?.id || null, live.isLive ? 1 : 0, priority ? 1 : 0);
            // a new channel starts with its latest video already "seen", so the next new video is announced
            if (up?.id) try { markSeen(db, channelId, [up.id]); } catch (_) {}
            const liveOpt = interaction.options.getBoolean('live');
            const upOpt = interaction.options.getBoolean('uploads');
            if (liveOpt !== null) db.prepare('UPDATE youtube_notifications SET notify_live = ? WHERE guild_id = ? AND youtube_channel_id = ?').run(liveOpt ? 1 : 0, guildId, channelId);
            if (upOpt !== null) db.prepare('UPDATE youtube_notifications SET notify_uploads = ? WHERE guild_id = ? AND youtube_channel_id = ?').run(upOpt ? 1 : 0, guildId, channelId);
            const _L2 = livLang(interaction.client, interaction.guildId, interaction);
            const _row = db.prepare('SELECT * FROM youtube_notifications WHERE guild_id = ? AND youtube_channel_id = ?').get(guildId, channelId);
            const _setCard = buildSetCard(_row, client, _L2);
            const _warn = require('../lib/postProblems').setupWarning(interaction.guild, target, 'youtube', _L2, interaction);
            if (_warn) _setCard.addTextDisplayComponents(new TextDisplayBuilder().setContent(_warn));
            return interaction.editReply({ components: [_setCard], flags: MessageFlags.IsComponentsV2 });
        }

        if (sub === 'remove') {
            const input = interaction.options.getString('channel').replace(/^@/, '').trim();
            const { id: channelId, reason: _resolveReason } = await trackedOrResolve(db, guildId, input);
            if (!channelId) return interaction.reply({ content: t('livestream.cmd_invalid', livLang(interaction.client, interaction.guildId, interaction)), flags: 64 });
            let res = db.prepare('DELETE FROM youtube_notifications WHERE guild_id = ? AND youtube_channel_id = ? COLLATE NOCASE').run(guildId, channelId);
            if (res.changes === 0) {
                const cleanHandle = String(input).replace(/^@/, '').trim();
                res = db.prepare('DELETE FROM youtube_notifications WHERE guild_id = ? AND youtube_handle = ? COLLATE NOCASE').run(guildId, cleanHandle);
            }
            const _L = livLang(interaction.client, interaction.guildId, interaction);
            return interaction.reply({ content: res.changes ? t('livestream.cmd_removed', _L, { handle: input }) : t('livestream.cmd_not_tracked', _L, { handle: input }), flags: 64 });
        }

        if (sub === 'test') {
            await interaction.deferReply({ flags: 64 });
            const input = interaction.options.getString('channel').replace(/^@/, '').trim();
            const { id: channelId, reason: _resolveReason } = await trackedOrResolve(db, guildId, input);
            if (!channelId) return interaction.editReply(resolveErrMsg(interaction.client, interaction.guildId, _resolveReason, input));
            const track = db.prepare('SELECT * FROM youtube_notifications WHERE guild_id = ? AND youtube_channel_id = ? COLLATE NOCASE').get(guildId, channelId);
            if (!track) return interaction.editReply(t('livestream.cmd_not_tracked_hint', livLang(interaction.client, interaction.guildId, interaction), { handle: input, mention: mentions(client, 'livestream', 'set') }));
            const live = await fetchLiveStatus(channelId, handleOf(track.youtube_handle));
            const isRealLive = !!live.isLive;
            const payload = isRealLive
                ? live
                : { isLive: true, _test: true, title: 'Layout preview', thumbnail: null, url: `https://youtube.com/channel/${channelId}/live` };
            const sent = await sendNotification(client, db, guildId, channelId, handleOf(track.youtube_handle), payload, 'system_test');
            if (!sent.ok) {
            const _lang = livLang(interaction.client, interaction.guildId, interaction);
            const _key = 'livestream.errors.' + (sent.reason || 'unknown');
            const _msg = t(_key, _lang, { channel: `<#${track.target_channel_id}>`, detail: sent.detail || '' });
            return interaction.editReply(_msg && _msg !== _key ? _msg : t('livestream.errors.unknown', _lang, { detail: sent.detail || 'no detail' }));
        }
            return interaction.editReply(isRealLive
                ? t('livestream.cmd_real_alert', livLang(interaction.client, interaction.guildId, interaction), { handle: track.youtube_handle || channelId })
                : t('livestream.cmd_test_preview', livLang(interaction.client, interaction.guildId, interaction), { handle: track.youtube_handle || channelId }));
        }
    },

    handleToggle, handleChannels, startPolling, stopPolling, fetchLiveStatus, fetchLiveFallback, fetchLatestUpload, resolveHandle,
};
