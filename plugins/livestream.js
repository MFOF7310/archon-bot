// ═══════════════════════════════════════════════════════════════════
//  ARCHON CG-223  •  YOUTUBE LIVE & UPLOAD ENGINE v1.0
//  Live check:   yt-dlp subprocess (no API key, no quota)
//  Upload check: YouTube RSS feed (free, unlimited, near-instant)
//  Priority channels polled every 2 min · Normal every 5 min
// ═══════════════════════════════════════════════════════════════════
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const { t } = require('../lib/i18n');
const EMOJIS = require('../config/emojis');
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
    try { db.exec(`CREATE INDEX IF NOT EXISTS idx_youtube_guild ON youtube_notifications(guild_id)`); } catch {}
    try { db.exec(`ALTER TABLE tiktok_notifications ADD COLUMN priority INTEGER DEFAULT 0`); } catch {}
}

function isGuildOwner(message) {
    return message.author.id === message.guild.ownerId || message.member?.permissions.has('Administrator');
}

function buildOwnerErrorEmbed(client, guild, lang = 'en') {
    const t = {
        fr: { title: '🔒 ACCÈS RESTREINT', desc: 'Seul le **propriétaire du serveur** peut gérer les notifications YouTube.' },
        en: { title: '🔒 RESTRICTED ACCESS', desc: 'Only the **server owner** can manage YouTube notifications.' },
    }[lang] || { title: '🔒 RESTRICTED', desc: 'Owner only.' };
    return new EmbedBuilder().setColor('#e74c3c').setAuthor({ name: '🛡️ ' + t.title, iconURL: guild.iconURL() || client.user.displayAvatarURL() }).setDescription(t.desc).setFooter({ text: 'ARCHON CG-223 • Owner Security' }).setTimestamp();
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
const COOKIE_FILE = require('path').join(__dirname, '..', 'config', 'youtube_cookies.txt');

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

function livLang(client, guildId) {
    try { return client?.detectLanguage?.('livestream', guildId) || 'en'; }
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
            '--print', 'is_live', '--print', 'title', '--print', 'thumbnail',
            watchUrl,
        ], { timeout: YTDLP_TIMEOUT_MS });
        const lines = String(stdout).trim().split('\n');
        const flag = (lines[0] || '').trim().toLowerCase();
        if (flag === 'true' || flag === 'is_live') {
            return {
                isLive: true,
                title: (lines[1] || 'Live stream').trim(),
                thumbnail: (lines[2] || '').trim() || null,
                url: cleanHandle ? `https://youtube.com/@${cleanHandle}/live` : `https://youtube.com/channel/${channelId}/live`,
            };
        }
        // yt-dlp returned OK and said is_live=false → offline
        console.log(`[YOUTUBE] ${channelId} is_live=${flag}`);
        return { isLive: false };
    } catch (e) {
        const msg = String(e.message || '') + String(e.stderr || '');
        // "Not currently live" is a valid answer, not an error
        if (/not currently live|has ended|not a live|no live/i.test(msg)) {
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
            return { isLive: true, title: up.title, thumbnail: up.thumbnail, url: up.url };
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
    } catch { return null; }
}

// ─── Embeds ───
function buildLiveEmbed(channelId, live, handle, client) {
    const isPreview = live._test === true;
    const accent = isPreview ? 0xf39c12 : 0xFF0000;
    const tag = handle ? '@' + handle : channelId;
    const title = live.title || 'Live stream';
    const watchUrl = live.url || (handle ? `https://youtube.com/@${handle}/live` : `https://youtube.com/channel/${channelId}/live`);
    const header = isPreview ? `## 🧪 Test preview · ${tag}` : `## 🔴 ${tag} is live right now`;
    const body = isPreview
        ? `**${title}**\nThis is a layout preview, not a real alert. ${tag} isn't currently streaming.`
        : `**${title}**\n${tag} is live on YouTube right now!`;
    const c = new ContainerBuilder().setAccentColor(accent);
    if (live.thumbnail) c.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(live.thumbnail)));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(header));
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Watch Live').setStyle(ButtonStyle.Link).setURL(watchUrl).setEmoji('🔴'),
        new ButtonBuilder().setLabel('Channel').setStyle(ButtonStyle.Link).setURL(handle ? `https://youtube.com/@${handle}` : `https://youtube.com/channel/${channelId}`).setEmoji('📺')
    );
    c.addActionRowComponents(navRow);
    return { _v2: { components: [c], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: ['everyone'] } } };
}

function buildVideoEmbed(upload, handle, client) {
    const tag = handle ? '@' + handle : (upload.author || 'the channel');
    const c = new ContainerBuilder().setAccentColor(0xFF0000);
    if (upload.thumbnail) c.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(upload.thumbnail)));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ✨ New video from ${tag}`));
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${upload.title || 'Untitled'}**\n${tag} just posted something new.`));
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    c.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Watch Video').setStyle(ButtonStyle.Link).setURL(upload.url).setEmoji('🎬')
    ));
    return { _v2: { components: [c], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } } };
}

function canNotifyLive(channelId) {
    const last = lastNotificationTime.get(channelId);
    if (!last) return true;
    return (Date.now() - last) >= NOTIFICATION_COOLDOWN_MINUTES * 60 * 1000;
}

async function sendNotification(client, db, guildId, channelId, handle, payload, type) {
    try {
        if (type === 'live' && !canNotifyLive(channelId)) return false;
        const track = db.prepare('SELECT target_channel_id FROM youtube_notifications WHERE guild_id = ? AND youtube_channel_id = ? COLLATE NOCASE').get(guildId, channelId);
        if (!track) return false;
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return false;
        const channel = guild.channels.cache.get(track.target_channel_id);
        if (!channel) return false;
        const botMember = guild.members.me;
        if (!require('../lib/canPost').log(guild, channel, botMember, 'youtube').ok) return false;

        let content = '';
        let card;
        if (type === 'live') { card = buildLiveEmbed(channelId, payload, handle, client); content = `@everyone 🔴 **${handle || channelId}** is LIVE on YouTube!`; }
        else if (type === 'video') { card = buildVideoEmbed(payload, handle, client); content = `🎬 **NEW VIDEO** from ${handle ? '@' + handle : channelId}!`; }
        else if (type === 'system_test') { card = buildLiveEmbed(channelId, payload, handle, client); content = null; }

        if (card._v2) {
            const msg = { ...card._v2 };
            if (content) msg.content = content;
            await channel.send(msg);
        } else {
            await channel.send({ content, embeds: [card.embed], components: card.row ? [card.row] : [] });
        }
        if (type === 'live') lastNotificationTime.set(channelId, Date.now());
        return true;
    } catch { return false; }
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
            : db.prepare('SELECT * FROM youtube_notifications WHERE priority = 0').all();
        if (!rows.length) return;

        const byChannel = new Map();
        for (const r of rows) {
            const k = r.youtube_channel_id.toLowerCase();
            if (!byChannel.has(k)) byChannel.set(k, []);
            byChannel.get(k).push(r);
        }

        for (const [chId, tracks] of byChannel) {
            const handle = tracks[0]?.youtube_handle || null;

            const live = await fetchLiveStatus(chId, handle);
            if (live.isLive) {
                offlineCounters.delete(chId);
                for (const t of tracks) {
                    if (t.is_live !== 1 && canNotifyLive(chId)) {
                        const sent = await sendNotification(client, db, t.guild_id, chId, handle, live, 'live');
                        if (sent) db.prepare('UPDATE youtube_notifications SET is_live = 1 WHERE guild_id = ? AND youtube_channel_id = ?').run(t.guild_id, chId);
                    }
                }
            } else {
                const off = (offlineCounters.get(chId) || 0) + 1;
                offlineCounters.set(chId, off);
                if (off >= REQUIRED_OFFLINE_CHECKS) {
                    db.prepare('UPDATE youtube_notifications SET is_live = 0 WHERE youtube_channel_id = ?').run(chId);
                    lastNotificationTime.delete(chId);
                }
            }

            // Uploads — only check on normal cycle (RSS is cheap)
            if (!priorityOnly) {
                const up = await fetchLatestUpload(chId);
                if (up) {
                    for (const t of tracks) {
                        if (t.last_video_id && t.last_video_id !== up.id) {
                            await sendNotification(client, db, t.guild_id, chId, handle, up, 'video');
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
function buildListEmbed(tracks, guild, client) {
    const c = new ContainerBuilder().setAccentColor(0xFF0000);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 📺 Tracked YouTube channels · ${guild.name}`));
    if (!tracks.length) {
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent('Nothing tracked yet. Add a channel with `/livestream set @handle #channel`.'));
        return c;
    }
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    tracks.forEach((t, i) => {
        const live = t.is_live === 1;
        const prio = t.priority === 1 ? ' ⚡' : '';
        const tag = t.youtube_handle ? '@' + t.youtube_handle : t.youtube_channel_id;
        const status = live ? '🔴 Live' : '⚫ Offline';
        const last = t.last_video_id ? `🎬 \`…${t.last_video_id.slice(-6)}\`` : 'No video yet';
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${i + 1}. ${tag}**${prio}  ·  ${status}\n↳ <#${t.target_channel_id}>  ·  ${last}`));
        if (i < tracks.length - 1) c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    });
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent('-# ARCHON CG-223 · YouTube Engine'));
    return c;
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
            .addBooleanOption(o => o.setName('priority').setDescription('Poll every 2 min instead of 5').setRequired(false)))
        .addSubcommand(s => s.setName('remove').setDescription('Stop tracking')
            .addStringOption(o => o.setName('channel').setDescription('Handle or ID').setRequired(true).setAutocomplete(true)))
        .addSubcommand(s => s.setName('list').setDescription('Show tracked channels'))
        .addSubcommand(s => s.setName('test').setDescription('Send a test live alert')
            .addStringOption(o => o.setName('channel').setDescription('Tracked channel').setRequired(true).setAutocomplete(true))),

    async run(client, message, args, db, serverSettings, usedCommand, lang) {
        const prefix = serverSettings?.prefix || '.';
        const guildId = message.guild?.id;
        if (!guildId) return message.reply('Server only.');
        initDatabase(db);

        const action = (args[0] || 'list').toLowerCase();

        if (action === 'list') {
            const rows = db.prepare('SELECT * FROM youtube_notifications WHERE guild_id = ?').all(guildId);
            return message.reply({ components: [buildListEmbed(rows, message.guild, client)], flags: MessageFlags.IsComponentsV2 });
        }

        if (!isGuildOwner(message)) return message.reply({ embeds: [buildOwnerErrorEmbed(client, message.guild, lang)] });

        if (action === 'set') {
            const input = String(args[1] || '').trim();
            const chMention = args[2];
            const priority = args.includes('--priority') || args.includes('-p');
            if (!input || !chMention) return message.reply(`Usage: \`${prefix}livestream set @handle #channel [--priority]\``);

            const raw = chMention.replace(/[<#>]/g, '').trim();
            let channel = message.guild.channels.cache.get(raw) || message.guild.channels.cache.find(c => c.name.toLowerCase() === raw.toLowerCase());
            if (!channel) return message.reply('❌ Channel not found.');

            const statusMsg = await message.reply('🔍 Resolving channel...');
            const { id: channelId, reason: _resolveReason } = await resolveHandle(input);
            if (!channelId) return statusMsg.edit(resolveErrMsg(client, message.guild.id, _resolveReason, input));

            const handle = input.replace(/^@/, '').trim();
            const live = await fetchLiveStatus(channelId, handle);
            const up = await fetchLatestUpload(channelId);

            db.prepare(`INSERT INTO youtube_notifications (guild_id, youtube_channel_id, youtube_handle, target_channel_id, last_video_id, is_live, priority)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(guild_id, youtube_channel_id) DO UPDATE SET
                    target_channel_id = excluded.target_channel_id,
                    youtube_handle = excluded.youtube_handle,
                    last_video_id = COALESCE(youtube_notifications.last_video_id, excluded.last_video_id),
                    priority = excluded.priority`).run(guildId, channelId, handle, channel.id, up?.id || null, live.isLive ? 1 : 0, priority ? 1 : 0);

            const embed = new EmbedBuilder().setColor(priority ? '#f39c12' : '#FF0000')
                .setAuthor({ name: '📺 Tracking ' + (priority ? '(priority)' : ''), iconURL: client.user.displayAvatarURL() })
                .setTitle('@' + handle)
                .setDescription(`Alerts will post in <#${channel.id}>.${priority ? '\n⚡ Polled every **2 minutes**.' : ''}\n🔴 Live now: **${live.isLive ? 'YES' : 'No'}**${up ? `\n🎬 Latest: [${up.title}](${up.url})` : ''}`)
                .setFooter({ text: 'ARCHON CG-223 • YouTube Engine' }).setTimestamp();
            return statusMsg.edit({ content: null, embeds: [embed] });
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
            return message.reply(res.changes ? t('livestream.cmd_removed', livLang(client, guildId), { handle: input }) : t('livestream.cmd_not_tracked', livLang(client, guildId), { handle: input }));
        }

        if (action === 'test') {
            const input = String(args[1] || '').replace(/^@/, '').trim();
            const { id: channelId, reason: _resolveReason } = /^UC[\w-]{22}$/.test(input) ? { id: input, reason: 'ok' } : await resolveHandle(input);
            if (!channelId) return message.reply(resolveErrMsg(client, message.guild.id, _resolveReason, input));
            const track = db.prepare('SELECT * FROM youtube_notifications WHERE guild_id = ? AND youtube_channel_id = ? COLLATE NOCASE').get(guildId, channelId);
            if (!track) return message.reply(t('livestream.cmd_not_tracked_hint', livLang(client, guildId), { handle: input }));
            const live = await fetchLiveStatus(channelId, track.youtube_handle);
            const isRealLive = !!live.isLive;
            const payload = isRealLive
                ? live
                : { isLive: true, _test: true, title: 'Layout preview', thumbnail: null, url: `https://youtube.com/channel/${channelId}/live` };
            const sent = await sendNotification(client, db, guildId, channelId, track.youtube_handle, payload, 'system_test');
            if (!sent) return message.reply(t('livestream.cmd_send_failed', livLang(client, guildId)));
            return message.reply(isRealLive
                ? t('livestream.cmd_real_alert', livLang(client, guildId), { handle: track.youtube_handle || channelId })
                : t('livestream.cmd_test_preview', livLang(client, guildId), { handle: track.youtube_handle || channelId }));
        }

        return message.reply(t('livestream.cmd_help', livLang(client, guildId), { prefix }));
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
            return interaction.reply({ components: [buildListEmbed(rows, interaction.guild, client)], flags: MessageFlags.IsComponentsV2 });
        }
        const isOwner = interaction.user.id === interaction.guild.ownerId || interaction.member?.permissions.has('Administrator');
        if (!isOwner) return interaction.reply({ embeds: [buildOwnerErrorEmbed(client, interaction.guild, lang)], flags: 1 << 6 });

        if (sub === 'set') {
            await interaction.deferReply();
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
            const _L2 = livLang(interaction.client, interaction.guildId);
            return interaction.editReply(t('livestream.cmd_tracking', _L2, { handle, channel: `<#${target.id}>`, priority: priority ? t('livestream.cmd_tracking_priority', _L2) : '' }));
        }

        if (sub === 'remove') {
            const input = interaction.options.getString('channel').replace(/^@/, '').trim();
            const { id: channelId, reason: _resolveReason } = /^UC[\w-]{22}$/.test(input) ? { id: input, reason: 'ok' } : await resolveHandle(input);
            if (!channelId) return interaction.reply({ content: t('livestream.cmd_invalid', livLang(interaction.client, interaction.guildId)), flags: 64 });
            let res = db.prepare('DELETE FROM youtube_notifications WHERE guild_id = ? AND youtube_channel_id = ? COLLATE NOCASE').run(guildId, channelId);
            if (res.changes === 0) {
                const cleanHandle = String(input).replace(/^@/, '').trim();
                res = db.prepare('DELETE FROM youtube_notifications WHERE guild_id = ? AND youtube_handle = ? COLLATE NOCASE').run(guildId, cleanHandle);
            }
            const _L = livLang(interaction.client, interaction.guildId);
            return interaction.reply({ content: res.changes ? t('livestream.cmd_removed', _L, { handle: input }) : t('livestream.cmd_not_tracked', _L, { handle: input }), flags: 64 });
        }

        if (sub === 'test') {
            await interaction.deferReply();
            const input = interaction.options.getString('channel').replace(/^@/, '').trim();
            const { id: channelId, reason: _resolveReason } = /^UC[\w-]{22}$/.test(input) ? { id: input, reason: 'ok' } : await resolveHandle(input);
            if (!channelId) return interaction.editReply(resolveErrMsg(interaction.client, interaction.guildId, _resolveReason, input));
            const track = db.prepare('SELECT * FROM youtube_notifications WHERE guild_id = ? AND youtube_channel_id = ? COLLATE NOCASE').get(guildId, channelId);
            if (!track) return interaction.editReply(t('livestream.cmd_not_tracked_hint', livLang(interaction.client, interaction.guildId), { handle: input }));
            const live = await fetchLiveStatus(channelId, track.youtube_handle);
            const isRealLive = !!live.isLive;
            const payload = isRealLive
                ? live
                : { isLive: true, _test: true, title: 'Layout preview', thumbnail: null, url: `https://youtube.com/channel/${channelId}/live` };
            const sent = await sendNotification(client, db, guildId, channelId, track.youtube_handle, payload, 'system_test');
            if (!sent) return interaction.editReply(t('livestream.cmd_send_failed', livLang(interaction.client, interaction.guildId)));
            return interaction.editReply(isRealLive
                ? t('livestream.cmd_real_alert', livLang(interaction.client, interaction.guildId), { handle: track.youtube_handle || channelId })
                : t('livestream.cmd_test_preview', livLang(interaction.client, interaction.guildId), { handle: track.youtube_handle || channelId }));
        }
    },

    startPolling, stopPolling, fetchLiveStatus, fetchLiveFallback, fetchLatestUpload, resolveHandle,
};
