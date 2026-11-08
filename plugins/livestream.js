// ═══════════════════════════════════════════════════════════════════
//  ARCHON CG-223  •  YOUTUBE LIVE & UPLOAD ENGINE v1.0
//  Live check:   yt-dlp subprocess (no API key, no quota)
//  Upload check: YouTube RSS feed (free, unlimited, near-instant)
//  Priority channels polled every 2 min · Normal every 5 min
// ═══════════════════════════════════════════════════════════════════
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { iconObj } = require('../lib/ui/icons');
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const { t } = require('../lib/i18n');
const mentions = require('../lib/mentions');
const EMOJIS = require('../config/emojis');
const em = (k, fb) => { try { return require('../config/emojis')[k] || fb; } catch { return fb; } };

// App emojis work on buttons too (tested Nov 2026). This helper only looks up server emojis by name.
// Look up by name across all guilds the bot is in, fall back to Unicode if missing.
function emBtn(name, fallback, client) {
    const found = client?.emojis?.cache?.find(e => e.name === name);
    if (found) return `<${found.animated ? 'a' : ''}:${found.name}:${found.id}>`;
    if (fallback) {
        console.warn(`[LIVESTREAM] Server emoji "${name}" not found — using fallback "${fallback}". Add it in Server Settings → Emoji to restore the custom icon.`);
    }
    return fallback || '';
}
const axios = require('axios');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
async function ytdlpRun(args) {
    return await execFileAsync('yt-dlp', ['--extractor-args', 'youtubetab:skip=authcheck', ...args]);
}


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
    try { db.exec(`CREATE INDEX IF NOT EXISTS idx_youtube_guild ON youtube_notifications(guild_id)`); } catch {}
    try { db.exec(`ALTER TABLE tiktok_notifications ADD COLUMN priority INTEGER DEFAULT 0`); } catch {}
}

function isGuildOwner(message) {
    return message.author.id === message.guild.ownerId || message.member?.permissions.has('Administrator');
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
        const { stdout, stderr } = await execFileAsync('yt-dlp', [
            '--skip-download', '--no-warnings', '--no-playlist',
            '--cookies', COOKIE_FILE,
            '--print', 'is_live', '--print', 'title', '--print', 'thumbnail', '--print', 'id',
            watchUrl,
        ], { timeout: YTDLP_TIMEOUT_MS });
        const lines = String(stdout).trim().split('\n');
        const flag = (lines[0] || '').trim().toLowerCase();
        if (flag === 'true' || flag === 'is_live') {
            return {
                isLive: true,
                title: (lines[1] || 'Live stream').trim(),
                thumbnail: (lines[2] || '').trim() || null,
                videoId: (lines[3] || '').trim() || null,
                url: cleanHandle ? `https://youtube.com/@${cleanHandle}/live` : `https://youtube.com/channel/${channelId}/live`,
            };
        }
        // yt-dlp returned OK and said is_live=false → offline
        console.log(`[YOUTUBE] ${channelId} is_live=${flag}`);
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
            return { isLive: true, title: up.title, thumbnail: up.thumbnail, url: up.url, videoId: up.id };
        }
        return { isLive: false };
    } catch {
        return { isLive: false };
    }
}

// ─── Upload check via RSS ───
async function fetchLatestUpload(channelId) {
    try {
        const res = await axios.get(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, { timeout: 10000 });
        const xml = String(res.data);
        const entries = xml.split('<entry>').slice(1);
        if (!entries.length) return null;
        const first = entries[0];
        const id = (first.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
        const title = (first.match(/<title>([^<]+)<\/title>/) || [])[1];
        const published = (first.match(/<published>([^<]+)<\/published>/) || [])[1];
        const author = (first.match(/<name>([^<]+)<\/name>/) || [])[1];
        const thumb = (first.match(/<media:thumbnail url="([^"]+)"/) || [])[1];
        if (!id) return null;
        return { id, title: title || 'Untitled', published, author: author || channelId, thumbnail: thumb, url: `https://youtube.com/watch?v=${id}` };
    } catch (e) { console.log(`[YOUTUBE] feed error for ${channelId}: ${e.response?.status || e.code || e.message}`); return null; }
}

// ─── Cards ───
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
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**\n${body}`));
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
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${t('livestream.card_video_title', lang, { icon: EMOJIS.ic_youtube || '✨', name })}`));
    c.addSeparatorComponents(rule());
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${upload.title || 'Untitled'}**\n${t('livestream.card_video_body', lang, { name })}`));
    c.addSeparatorComponents(rule());
    c.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel(t('livestream.btn_watch_video', lang)).setStyle(ButtonStyle.Link).setURL(upload.url).setEmoji(iconObj('ic_video', null, '🎬'))
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
        const track = db.prepare('SELECT target_channel_id FROM youtube_notifications WHERE guild_id = ? AND youtube_channel_id = ? COLLATE NOCASE').get(guildId, channelId);
        if (!track) return { ok: false, reason: 'not_tracked' };
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
            const handle = tracks[0]?.youtube_handle || null;

            const live = await fetchLiveStatus(chId, handle);
            if (live.isLive) {
                offlineCounters.delete(chId);
                if (live.videoId) liveVideoIds.set(chId, live.videoId);
                for (const t of tracks) {
                    if (t.is_live !== 1 && t.notify_live === 0) { db.prepare('UPDATE youtube_notifications SET is_live = 1 WHERE guild_id = ? AND youtube_channel_id = ?').run(t.guild_id, chId); continue; }
                    if (t.is_live !== 1 && canNotifyLive(t.guild_id, chId)) {
                        const sent = await sendNotification(client, db, t.guild_id, chId, handle, live, 'live');
                        if (sent.ok) db.prepare('UPDATE youtube_notifications SET is_live = 1 WHERE guild_id = ? AND youtube_channel_id = ?').run(t.guild_id, chId);
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
                    for (const t of tracks) {
                        if (t.last_video_id && t.last_video_id !== up.id && t.notify_uploads !== 0 && up.id !== liveVideoIds.get(chId)) {
                            const sent = await sendNotification(client, db, t.guild_id, chId, handle, up, 'video'); console.log(`[YOUTUBE] new video ${up.id} on ${handle || chId} -> ${t.guild_id}: ${sent.ok ? 'sent' : 'failed (' + sent.reason + ')'}`);
                        }
                        db.prepare('UPDATE youtube_notifications SET last_video_id = ? WHERE guild_id = ? AND youtube_channel_id = ?').run(up.id, t.guild_id, chId);
                    }
                }
            }

            await new Promise(r => setTimeout(r, 1500 + Math.random() * 2000));
        }
    } catch (e) {
        console.error('[YOUTUBE] cycle:', e.message);
    }
}

// ─── List ───
const MAX_TOGGLE_ROWS = 8; // a V2 card holds 40 components; 8 channels with two buttons each fit

function toggleButton(kind, row, lang, view = '') {
    const on = (kind === 'live' ? row.notify_live : row.notify_uploads) !== 0;
    return new ButtonBuilder()
        .setCustomId(`ls_toggle:${kind}:${row.youtube_channel_id}${view ? ':' + view : ''}`)
        .setLabel(t(`livestream.btn_${kind}_${on ? 'on' : 'off'}`, lang))
        .setStyle(on ? ButtonStyle.Success : ButtonStyle.Secondary);
}

function statusText(row, client, lang) {
    return row.is_live === 1
        ? `${em('ping_ok', '🟢')} ${t('livestream.status_live', lang)}`
        : `${em('ping_bad', '🔴')} ${t('livestream.status_offline', lang)}`;
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
        const tag = row.youtube_handle ? '@' + row.youtube_handle : row.youtube_channel_id;
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${i + 1}. ${tag}**${prio}  ·  ${statusText(row, client, lang)}\n↳ <#${row.target_channel_id}>`));
        c.addActionRowComponents(new ActionRowBuilder().addComponents(toggleButton('live', row, lang), toggleButton('up', row, lang)));
    });
    const more = tracks.length - MAX_TOGGLE_ROWS;
    if (more > 0) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(t('livestream.list_more', lang, { count: more, mention: mentions(client, 'livestream', 'set') })));
    c.addSeparatorComponents(rule());
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${t('livestream.list_hint', lang)} · ARCHON CG-223`));
    return c;
}

// Confirmation card after /livestream set, with the same two switches
function buildSetCard(row, client, lang = 'en') {
    const name = row.youtube_handle ? '@' + row.youtube_handle : row.youtube_channel_id;
    const lines = [t('livestream.set_where', lang, { channel: `<#${row.target_channel_id}>` })];
    if (row.priority === 1) lines.push(`-# ${t('livestream.set_priority', lang)}`);
    if (row.is_live === 1) lines.push(`${em('ic_live', '🔴')} ${t('livestream.set_live_now', lang, { name })}`);
    if (row.last_video_id) lines.push(`${em('ic_video', '🎬')} ${t('livestream.set_latest', lang, { url: `https://youtube.com/watch?v=${row.last_video_id}` })}`);
    const c = new ContainerBuilder().setAccentColor(0x2ecc71);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${em('ic_youtube', '📺')} ${t('livestream.set_title', lang, { name })}\n${lines.join('\n')}`));
    c.addSeparatorComponents(rule());
    c.addActionRowComponents(new ActionRowBuilder().addComponents(toggleButton('live', row, lang, 'set'), toggleButton('up', row, lang, 'set')));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${t('livestream.set_hint', lang, { mention: mentions(client, 'livestream', 'list') })}`));
    return c;
}

// Switch a channel's live or upload alerts from the list or set card (owner and admins only)
async function handleToggle(interaction, client) {
    const db = client.db;
    const lang = livLang(client, interaction.guildId, interaction);
    const isAdmin = interaction.user.id === interaction.guild?.ownerId || interaction.member?.permissions?.has('Administrator');
    if (!isAdmin) return interaction.reply({ content: t('livestream.toggle_admin_only', lang), flags: 64 });

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

module.exports = {
    name: 'livestream',
    aliases: ['livestream', 'ls', 'lsn'],
    description: '📺 YouTube Live & upload notification system',
    category: 'UTILITY',
    usage: '.livestream [set|remove|list|check|test]',
    cooldown: 3000,
    examples: ['.livestream set @MrBeast #social', '.livestream set @MrBeast #social --priority', '.livestream remove @MrBeast', '.livestream list'],

    data: new SlashCommandBuilder().setName('livestream').setDescription('📺 Manage YouTube Live notifications')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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

        if (!isGuildOwner(message)) return message.reply(t('livestream.owner_only', livLang(client, guildId, message)));

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

            const handle = input.replace(/^@/, '').trim();

            const existing = db.prepare('SELECT target_channel_id, priority FROM youtube_notifications WHERE guild_id = ? AND youtube_channel_id = ?').get(guildId, channelId);
            if (existing && existing.target_channel_id === channel.id && existing.priority === (priority ? 1 : 0)) {
                return statusMsg.edit(t('livestream.already_tracked', livLang(client, guildId, message), { handle: '@' + handle, channel: channel.id }));
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
            const { id: channelId, reason: _resolveReason } = /^UC[\w-]{22}$/.test(input) ? { id: input, reason: 'ok' } : await resolveHandle(input);
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
            const { id: channelId, reason: _resolveReason } = /^UC[\w-]{22}$/.test(input) ? { id: input, reason: 'ok' } : await resolveHandle(input);
            if (!channelId) return message.reply(resolveErrMsg(client, message.guild.id, _resolveReason, input));
            const track = db.prepare('SELECT * FROM youtube_notifications WHERE guild_id = ? AND youtube_channel_id = ? COLLATE NOCASE').get(guildId, channelId);
            if (!track) return message.reply(t('livestream.cmd_not_tracked_hint', livLang(client, guildId, message), { handle: input, mention: mentions(client, 'livestream', 'set') }));
            const live = await fetchLiveStatus(channelId, track.youtube_handle);
            const isRealLive = !!live.isLive;
            const payload = isRealLive
                ? live
                : { isLive: true, _test: true, title: 'Layout preview', thumbnail: null, url: `https://youtube.com/channel/${channelId}/live` };
            const sent = await sendNotification(client, db, guildId, channelId, track.youtube_handle, payload, 'system_test');
            if (!sent.ok) {
            const _lang = livLang(client, guildId, message);
            const _key = 'livestream.errors.' + (sent.reason || 'unknown');
            const _msg = t(_key, _lang, { channel: `<#${channelId}>`, detail: sent.detail || '' });
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
        const items = rows.map(r => ({
            name: r.youtube_handle ? `@${r.youtube_handle} (${r.youtube_channel_id.slice(0, 8)}…)` : r.youtube_channel_id,
            value: r.youtube_handle ? `@${r.youtube_handle}` : r.youtube_channel_id,
        }));
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
        const isOwner = interaction.user.id === interaction.guild.ownerId || interaction.member?.permissions.has('Administrator');
        if (!isOwner) return interaction.reply({ content: t('livestream.owner_only', lang), flags: 64 });

        if (sub === 'set') {
            await interaction.deferReply({ flags: 64 });
            const input = interaction.options.getString('channel').trim();
            const target = interaction.options.getChannel('target');
            const priority = interaction.options.getBoolean('priority') || false;
            const { id: channelId, reason: _resolveReason } = await resolveHandle(input);
            if (!channelId) return interaction.editReply(resolveErrMsg(interaction.client, interaction.guildId, _resolveReason, input));
            const handle = input.replace(/^@/, '').trim();
            
            

            const live = await fetchLiveStatus(channelId, handle);
            const up = await fetchLatestUpload(channelId);
            db.prepare(`INSERT INTO youtube_notifications (guild_id, youtube_channel_id, youtube_handle, target_channel_id, last_video_id, is_live, priority)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(guild_id, youtube_channel_id) DO UPDATE SET
                    target_channel_id = excluded.target_channel_id,
                    youtube_handle = excluded.youtube_handle,
                    last_video_id = COALESCE(youtube_notifications.last_video_id, excluded.last_video_id),
                    priority = excluded.priority`).run(guildId, channelId, handle, target.id, up?.id || null, live.isLive ? 1 : 0, priority ? 1 : 0);
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
            const { id: channelId, reason: _resolveReason } = /^UC[\w-]{22}$/.test(input) ? { id: input, reason: 'ok' } : await resolveHandle(input);
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
            const { id: channelId, reason: _resolveReason } = /^UC[\w-]{22}$/.test(input) ? { id: input, reason: 'ok' } : await resolveHandle(input);
            if (!channelId) return interaction.editReply(resolveErrMsg(interaction.client, interaction.guildId, _resolveReason, input));
            const track = db.prepare('SELECT * FROM youtube_notifications WHERE guild_id = ? AND youtube_channel_id = ? COLLATE NOCASE').get(guildId, channelId);
            if (!track) return interaction.editReply(t('livestream.cmd_not_tracked_hint', livLang(interaction.client, interaction.guildId, interaction), { handle: input, mention: mentions(client, 'livestream', 'set') }));
            const live = await fetchLiveStatus(channelId, track.youtube_handle);
            const isRealLive = !!live.isLive;
            const payload = isRealLive
                ? live
                : { isLive: true, _test: true, title: 'Layout preview', thumbnail: null, url: `https://youtube.com/channel/${channelId}/live` };
            const sent = await sendNotification(client, db, guildId, channelId, track.youtube_handle, payload, 'system_test');
            if (!sent.ok) {
            const _lang = livLang(interaction.client, interaction.guildId, interaction);
            const _key = 'livestream.errors.' + (sent.reason || 'unknown');
            const _msg = t(_key, _lang, { channel: `<#${channelId}>`, detail: sent.detail || '' });
            return interaction.editReply(_msg && _msg !== _key ? _msg : t('livestream.errors.unknown', _lang, { detail: sent.detail || 'no detail' }));
        }
            return interaction.editReply(isRealLive
                ? t('livestream.cmd_real_alert', livLang(interaction.client, interaction.guildId, interaction), { handle: track.youtube_handle || channelId })
                : t('livestream.cmd_test_preview', livLang(interaction.client, interaction.guildId, interaction), { handle: track.youtube_handle || channelId }));
        }
    },

    handleToggle, startPolling, stopPolling, fetchLiveStatus, fetchLiveFallback, fetchLatestUpload, resolveHandle,
};
