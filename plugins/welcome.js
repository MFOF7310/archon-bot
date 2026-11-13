// ╔══════════════════════════════════════════════════════════════════════╗
// ║  🦅 ARCHON CG-223 — WELCOME/GOODBYE PLUGIN v4.3                    ║
// ║  FIX: Single render path — removed duplicate canvas call           ║
// ║  FIX: index.js fallbackWelcome/fallbackGoodbye now DISABLED        ║
// ║       when this plugin is loaded (client.welcome is set)           ║
// ╚══════════════════════════════════════════════════════════════════════╝

const {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    EmbedBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
    PermissionFlagsBits,
    SectionBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    SlashCommandBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
} = require('discord.js');
const em = (k, fb) => { try { return require('../config/emojis')[k] || fb; } catch { return fb; } };
const { t } = require('../lib/i18n');
const { toV2 } = require('../lib/v2convert');   // classic embeds -> Components V2 cards
const Style = require('./welcome-style.js');

// Card sends upload a file — the check must mirror the send (View/Send/Embed + Attach Files)
// What the welcome/goodbye card needs (a Components V2 message with an image): the same rule as .postcheck and the dashboard.
const _CARD_NEEDED = require('../lib/canPost').neededFor('welcome');
const { safeSend, canSend } = require('../lib/safeSend');

// ================= JOIN-DATE PERSISTENCE =================
// guildMemberRemove carries no join date: members not in cache (e.g. bot
// restarted since they joined) arrive with joinedTimestamp = null, and the
// goodbye card fell back to '< 1 min'. Persist join dates in SQLite so
// "Stayed:" is always exact.
let _joinTableReady = false;
const _joinBackfilled = new Set();
function ensureJoinTable(db) {
    if (_joinTableReady || !db) return;
    try {
        db.prepare('CREATE TABLE IF NOT EXISTS member_joins (guild_id TEXT NOT NULL, user_id TEXT NOT NULL, joined_at INTEGER NOT NULL, PRIMARY KEY (guild_id, user_id))').run();
        _joinTableReady = true;
    } catch (e) { console.error('[WELCOME] member_joins init failed:', e.message); }
}
function recordJoin(db, guildId, userId, ts) {
    if (!db || !ts) return;
    try { db.prepare('INSERT OR REPLACE INTO member_joins (guild_id, user_id, joined_at) VALUES (?, ?, ?)').run(String(guildId), String(userId), ts); } catch (e) {}
}
function lookupJoin(db, guildId, userId) {
    if (!db) return null;
    try { const r = db.prepare('SELECT joined_at FROM member_joins WHERE guild_id = ? AND user_id = ?').get(String(guildId), String(userId)); return r ? r.joined_at : null; } catch (e) { return null; }
}
async function backfillJoins(db, guild) {
    if (!db || !guild || _joinBackfilled.has(guild.id)) return;
    _joinBackfilled.add(guild.id);
    try {
        const all = await guild.members.fetch();
        const stmt = db.prepare('INSERT OR IGNORE INTO member_joins (guild_id, user_id, joined_at) VALUES (?, ?, ?)');
        for (const m of all.values()) if (m.joinedTimestamp) stmt.run(String(guild.id), String(m.id), m.joinedTimestamp);
    } catch (e) { console.error('[WELCOME] join backfill failed:', e.message); }
}

// ================= HELPERS =================
function applyOwnerEnvFallback(cfg, guildId) {
    if (guildId === process.env.GUILD_ID) {
        cfg.welcomeChannel = cfg.welcomeChannel || process.env.WELCOME_CHANNEL_ID;
        cfg.goodbyeChannel = cfg.goodbyeChannel || process.env.GOODBYE_CHANNEL_ID;
    }
    return cfg;
}

// Ensures canvas renderer always gets a full GuildMember object
// (slash interactions give InteractionGuildMember which lacks displayAvatarURL)
function createMemberProxy(member) {
    if (member && typeof member.displayAvatarURL === 'function') return member;
    if (member && member.user) {
        return new Proxy(member, {
            get(target, prop) {
                if (prop === 'displayAvatarURL') return target.user.displayAvatarURL.bind(target.user);
                if (prop === 'displayName')      return target.user.displayName || target.user.username;
                return target[prop];
            }
        });
    }
    return member;
}

// The accent picked in /leveling config > Banner colours (leveling_themes.welcome_accent), or null
function savedAccent(db, gid) {
    try { const h = db?.prepare('SELECT welcome_accent FROM leveling_themes WHERE guild_id = ?').get(gid)?.welcome_accent; return /^#[0-9a-f]{6}$/i.test(String(h || '')) ? h : null; }
    catch { return null; }   // the table doesn't exist until leveling has run once
}

// ================= WELCOME AFTER VERIFICATION =================
// With the verification gate on (Premium), a newcomer only sees the verification channel. A card sent when they
// join would sit unseen in the welcome channel, with an "[Unverified]" badge, and accounts that never verify
// (bots, raids) would get one too. So on gated servers the card waits: the inviter is noted at join time (it can't
// be found later), and the card is sent the moment verification passes (plugins/verify.js calls afterVerify).
const PENDING_DAYS = 14;
function ensurePending(db) {
    try { db.prepare('CREATE TABLE IF NOT EXISTS welcome_pending (guild_id TEXT NOT NULL, user_id TEXT NOT NULL, inviter TEXT, code TEXT, at INTEGER NOT NULL, PRIMARY KEY (guild_id, user_id))').run(); return true; }
    catch (e) { console.error('[WELCOME] welcome_pending init failed:', e.message); return false; }
}
function gateActive(member, db) {
    try { return require('./verify.js').gateActive(member.guild, db); } catch { return false; }
}
// takes the waiting row away (so a member can never get two cards) and returns it, or null
function takePending(db, gid, uid) {
    if (!ensurePending(db)) return null;
    try {
        const row = db.prepare('SELECT inviter, code, at FROM welcome_pending WHERE guild_id = ? AND user_id = ?').get(String(gid), String(uid));
        if (!row) return null;
        const gone = db.prepare('DELETE FROM welcome_pending WHERE guild_id = ? AND user_id = ?').run(String(gid), String(uid));
        if (!gone.changes) return null;   // another verification path took it first
        db.prepare('DELETE FROM welcome_pending WHERE at < ?').run(Date.now() - PENDING_DAYS * 86400000);
        return row.at >= Date.now() - PENDING_DAYS * 86400000 ? row : null;
    } catch (e) { console.error('[WELCOME] pending read:', e.message); return null; }
}
async function afterVerify(member, client, db) {
    db = db || client?.db;
    if (!member?.guild || !db) return;
    const row = takePending(db, member.guild.id, member.id);
    if (!row) return;   // welcomed at join (before this existed), or already welcomed
    const inviter = row.inviter || row.code ? { inviter: row.inviter ? { username: row.inviter } : null, code: row.code } : null;
    await handleWelcome(member, client, db, { verified: true, inviter }).catch((e) => console.error('[WELCOME] after verify:', e.message));
}

// ================= CORE SEND: WELCOME =================
// ── THIS IS THE ONLY PLACE a welcome card is rendered and sent ──
// index.js fallbackWelcome() is bypassed because client.welcome is set.
async function handleWelcome(member, client, db, opts = {}) {
    ensureJoinTable(db);
    await backfillJoins(db, member.guild);
    if (!opts.verified) recordJoin(db, member.guild.id, member.id, member.joinedTimestamp || Date.now());
    const ssRaw = client.getServerSettings?.(member.guild.id) || {};
    let cfg = Style.normalizeWelcomeConfig(ssRaw);
    cfg = applyOwnerEnvFallback(cfg, member.guild.id);
    cfg.welcomeAccent = savedAccent(db || client.db, member.guild.id) || cfg.welcomeAccent;

    if (!cfg.welcomeEnabled || !cfg.welcomeChannel) return;

    // Gated server: note who invited them now (the invite counts move on), send the card when they pass verification
    if (!opts.verified && !member.user?.bot && gateActive(member, db || client.db) && ensurePending(db || client.db)) {
        let inv = null;
        try { inv = await require('../lib/invite-tracker').detect(member.guild); } catch {}
        const invName = inv?.inviter?.username || (inv?.inviter?.tag || '').split('#')[0] || null;
        try {
            (db || client.db).prepare('INSERT OR REPLACE INTO welcome_pending (guild_id, user_id, inviter, code, at) VALUES (?, ?, ?, ?, ?)')
                .run(member.guild.id, member.id, invName, inv?.code || null, Date.now());
            return;
        } catch (e) { console.error('[WELCOME] pending save:', e.message); }   // couldn't hold it: welcome now, as before
    }

    const ch = member.guild.channels.cache.get(cfg.welcomeChannel);
    if (!canSend('welcome', ch, _CARD_NEEDED, { guild: member.guild, channelId: cfg.welcomeChannel })) return;

    const count = member.guild.memberCount;
    const lang = (ssRaw.language && ssRaw.language !== 'auto') ? ssRaw.language : (client.detectLanguage ? client.detectLanguage('welcome', member.guild.id) : 'en');

    // Proxy ensures avatar URL works in all contexts
    const safeMember = createMemberProxy(member);

    // ── STATIC welcome banner (no canvas) ──
    const _fs = require('fs');
    const _path = require('path');
    const _bannerPath = _path.join(__dirname, '..', 'assets', 'welcome', 'welcome.png');
    if (!_fs.existsSync(_bannerPath)) {
        console.error('[WELCOME] welcome.png missing — aborting welcome card');
        return;
    }
    const attachment = new AttachmentBuilder(_fs.readFileSync(_bannerPath), { name: 'welcome.png' });

    // ── Compact content (Ephi style — 2 lignes) ──
    cfg.lang = lang;
    // The badge shows a real role only: not @everyone, nor the roles ARCHON gives everyone (verification, member role)
    const _ss = ssRaw || {};
    const _plain = new Set([member.guild.id, _ss.verify_unverified_role_id, _ss.verify_role_id, _ss.auto_role_id, _ss.member_role, _ss.memberRole].filter(Boolean).map(String));
    const _topRole = member.roles?.highest;
    const _badge = (_topRole && !_plain.has(String(_topRole.id))) ? ` · ${_topRole.name}` : '';
    const _greet = `### ${t('welcome.card_heading', lang, { user: member.user })}${_badge ? `\n-# ${_badge.slice(3)}` : ''}`;
    const _memberLine = t('welcome.card_member_count', lang, { count: Style.ordinal(count, lang), guild: member.guild.name });

    // "Get started": the rules and the chat channel when the server has them, else the friendly intro line
    const _exists = (id) => id && member.guild.channels.cache.has(String(id));
    const _rules = _exists(cfg.rulesChannel) ? cfg.rulesChannel : _exists(member.guild.rulesChannelId) ? member.guild.rulesChannelId : null;
    const _steps = [];
    if (_rules) _steps.push(t('welcome.card_step_rules', lang, { channel: `<#${_rules}>` }));
    if (_exists(cfg.generalChannel)) _steps.push(t('welcome.card_step_general', lang, { channel: `<#${cfg.generalChannel}>` }));
    // compact: one step is a single line; two get a small title
    const _start = _steps.length === 1 ? `→ ${_steps[0]}`
        : _steps.length ? `-# ${t('welcome.card_start_title', lang)}\n${_steps.map((x, i) => `\`${i + 1}\` ${x}`).join('\n')}`
        : t('welcome.card_intro', lang);
    // A custom message replaces the default greeting (it used to be stacked on top of it, so members got two welcomes)
    let content = cfg.welcomeMessage
        ? `${Style.formatTemplate(cfg.welcomeMessage, member, count)}\n${_memberLine}\n\n${_start}`
        : `${_greet}\n${_memberLine}\n\n${_start}`;

    // Embed uses attachment:// reference — NOT a base64 data URL
    // Hybrid accent: top role if readable, else neon green
    function _pickAccent(m, c) {
        if (c.welcomeAccent && /^#?[0-9a-fA-F]{6}$/.test(c.welcomeAccent)) return c.welcomeAccent.replace('#', '');
        const hex = m.roles?.highest?.hexColor || m.roles?.color?.hex;
        if (hex && hex !== '#000000') {
            const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
            const lum = (r*299 + g*587 + b*114)/1000;
            if (lum >= 40 && lum <= 220) return hex.replace('#','');
        }
        return '7FFF00';
    }
    const _accentHex = _pickAccent(member, cfg);

    // Build action buttons
    const rawDefs = Style.getWelcomeButtons(cfg, safeMember) || [];
    // Fix: The 'AI Assistant' button was mistakenly given the 'welcome_help' ID.
    // We rename it to 'welcome_ai_assistant' so it doesn't conflict with the new Help button.
    const EMOJI_MAP = {
        '📜': em('rules', '📜'),
        '💬': em('general', '💬'),
        '🤖': em('ai_assistant', '🤖'),
        '👤': em('myprofile', '👤'),
        '❓': em('help', '❓'),
        'ℹ️': em('ic_info', 'ℹ️')
    };

    const _inSteps = [_rules, _exists(cfg.generalChannel) ? cfg.generalChannel : null].filter(Boolean).map(String);
    const buttonDefs = rawDefs
        .filter((d) => !(d.style === 'Link' && _inSteps.some((id) => String(d.url || '').endsWith(`/${id}`))))   // already a link in the steps
        .map((d) => ({ ...d, emoji: (d.emoji && EMOJI_MAP[d.emoji]) || d.emoji }));
    if (!buttonDefs.some((d) => d.customId === 'welcome_help')) {
        buttonDefs.push({ label: t('welcome.btn_help', lang), emoji: em('ic_info', 'ℹ️'), style: 'Secondary', customId: 'welcome_help' });
    }
    const rows = [];
    let currentRow = new ActionRowBuilder();
    let btnCount = 0;

    for (const def of buttonDefs) {
        if (btnCount >= 5) { rows.push(currentRow); currentRow = new ActionRowBuilder(); btnCount = 0; }
        if (def.style === 'Link') {
            currentRow.addComponents(
                new ButtonBuilder().setLabel(def.label).setEmoji(def.emoji).setStyle(ButtonStyle.Link).setURL(def.url)
            );
        } else {
            currentRow.addComponents(
                new ButtonBuilder()
                    .setLabel(def.label).setEmoji(def.emoji)
                    .setStyle(
                        def.style === 'Primary' ? ButtonStyle.Primary :
                        def.style === 'Secondary' ? ButtonStyle.Secondary :
                        def.style === 'Danger' ? ButtonStyle.Danger :
                        ButtonStyle.Success
                    )
                    .setCustomId(def.customId)
            );
        }
        btnCount++;
    }
    if (btnCount > 0) rows.push(currentRow);

    // ── Inviter detection (global cache) ──
    let _inviter = opts.inviter || null;   // noted at join time when the card waited for verification
    if (!opts.verified) try { _inviter = await require('../lib/invite-tracker').detect(member.guild); } catch {}

    // ── Info line: who invited them and how old the account is (Discord shows "2 years ago" in each reader's language) ──
    const esc = (x) => String(x || '').replace(/([*_`~|\\])/g, '\\$1');
    const info = [];
    const invName = _inviter?.inviter?.username || (_inviter?.inviter?.tag || '').split('#')[0];
    if (invName) info.push(`${em('myprofile', '👤')} ${Style.cardText(lang, 'invited', { name: esc(invName) })}`);
    else if (_inviter?.code) info.push(`${em('ic_link', '🔗')} ${Style.cardText(lang, 'viaCode', { code: esc(_inviter.code) })}`);
    info.push(`${em('ic_calendar', '📅')} ${Style.cardText(lang, 'created', { when: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>` })}`);

    // ── V2 card: banner, greeting with the avatar, intro, info, buttons ──
    const _avatar = (() => { try { return safeMember.displayAvatarURL({ size: 256, extension: 'png' }); } catch { return null; } })();
    const [_head, ..._rest] = content.split('\n\n');
    const _container = new ContainerBuilder()
        .setAccentColor(parseInt(_accentHex, 16))
        .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL('attachment://welcome.png')));
    if (_avatar) {
        _container.addSectionComponents(new SectionBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(_head))
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(_avatar)));
    } else {
        _container.addTextDisplayComponents(new TextDisplayBuilder().setContent(_head));
    }
    if (_rest.length) _container.addTextDisplayComponents(new TextDisplayBuilder().setContent(_rest.join('\n\n')));
    _container
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${info.join(' · ')}`));

    if (rows.length > 0) {
        _container.addActionRowComponents(...rows);
    }

    await safeSend('welcome', ch, {
        components: [_container],
        files: [attachment],
        flags: MessageFlags.IsComponentsV2,
    });
}

// ================= CORE SEND: GOODBYE =================
// ── ONLY place a goodbye card is rendered and sent ──
async function handleGoodbye(member, client, db, opts = {}) {
    // left before passing verification: nobody saw them arrive, so no goodbye card either
    if (!opts.test && member?.guild && takePending(db || client.db, member.guild.id, member.id)) return;
    const ssRaw = client.getServerSettings?.(member.guild.id) || {};
    let cfg = Style.normalizeWelcomeConfig(ssRaw);
    cfg = applyOwnerEnvFallback(cfg, member.guild.id);

    if (!cfg.goodbyeEnabled || !cfg.goodbyeChannel) return;

    const ch = member.guild.channels.cache.get(cfg.goodbyeChannel);
    if (!canSend('goodbye', ch, require('../lib/canPost').neededFor('goodbye'), { guild: member.guild, channelId: cfg.goodbyeChannel })) return;

    ensureJoinTable(db);
    await backfillJoins(db, member.guild);
    const ssRawGoodbye = client.getServerSettings?.(member.guild.id) || {};
    const goodbyeLang = (ssRawGoodbye.language && ssRawGoodbye.language !== 'auto') ? ssRawGoodbye.language : (client.detectLanguage ? client.detectLanguage('welcome', member.guild.id) : 'en');
    // Unknown join date: no duration at all (it used to say "< 1 min" for members who stayed for years)
    const joinedAt  = member.joinedTimestamp || lookupJoin(db, member.guild.id, member.id);
    const stayedMs  = joinedAt ? Date.now() - joinedAt : null;
    const duration  = stayedMs != null ? Style.fmtDur(stayedMs, goodbyeLang) : null;
    const roles     = [...(member.roles?.cache?.values?.() || [])].filter(r => r.id !== member.guild.id);
    const safeMember = createMemberProxy(member);

    const name = String(member.displayName || member.user?.globalName || member.user?.username || '?').replace(/([*_`~|\\])/g, '\\$1');
    const line = cfg.goodbyeMessage
        ? Style.formatTemplate(cfg.goodbyeMessage, safeMember, member.guild.memberCount)
        : Style.cardText(goodbyeLang, 'bye');
    const head = `### ${em('wave', '👋')} ${Style.cardText(goodbyeLang, 'left', { name })}\n${line}`;
    const info = [];
    if (duration) info.push(`${em('clock', '🕒')} ${Style.cardText(goodbyeLang, 'with', { dur: duration })}`);
    if (joinedAt) info.push(Style.cardText(goodbyeLang, 'joined', { when: `<t:${Math.floor(joinedAt / 1000)}:D>` }));
    if (roles.length) info.push(Style.cardText(goodbyeLang, 'roles', { n: roles.length }));
    info.push(Style.cardText(goodbyeLang, 'members', { n: member.guild.memberCount.toLocaleString(goodbyeLang === 'fr' ? 'fr-FR' : 'en-US') }));

    let avatar = null;
    try { avatar = (member.user || member).displayAvatarURL({ size: 256, extension: 'png' }); } catch {}
    const card = new ContainerBuilder().setAccentColor(0x888780);
    if (avatar) card.addSectionComponents(new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(head)).setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar)));
    else card.addTextDisplayComponents(new TextDisplayBuilder().setContent(head));
    card.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${info.join(' · ')}`));

    await safeSend('goodbye', ch, {
        components: [card],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
    });
}


// ================= /welcome PANEL =================
// One card, like /channels and /roles: each card's real state, on/off, the message (written in a window, with a
// preview), back to the default text, and a real test that says why when it can't post. The opener's id is in every
// customId, so nobody else can drive it.
const WL = (k, lang, v) => t(`welcome.${k}`, lang, v || {});
const LANGS4 = ['en', 'fr', 'zh', 'ar'];
const langOf = (client, gid, where, uid) => { const l = require('../lib/pick-lang').pickLang(client, gid, where, uid); return LANGS4.includes(l) ? l : 'en'; };
const canManage = (member) => !!member?.permissions?.has(PermissionFlagsBits.ManageGuild);
const KIND = {
    welcome: { channel: 'welcome_channel', message: 'welcome_message', enabled: 'welcome_enabled', need: 'welcome' },
    goodbye: { channel: 'goodbye_channel', message: 'goodbye_message', enabled: 'goodbye_enabled', need: 'goodbye' },
};
const MAX_MSG = 1000;
const KEEP = { user: '{user}', server: '{server}', count: '{count}', age: '{age}' };   // shown as they are, for admins to copy

function readCfg(db, gid) {
    try { return db.prepare('SELECT welcome_channel, goodbye_channel, welcome_message, goodbye_message, welcome_enabled, goodbye_enabled FROM server_settings WHERE guild_id = ?').get(gid) || {}; }
    catch { return {}; }
}
function writeCol(client, gid, col, value) {
    try {
        client.db.prepare('INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)').run(gid);
        client.db.prepare(`UPDATE server_settings SET ${col} = ? WHERE guild_id = ?`).run(value, gid);
    } catch (e) { console.error('[WELCOME] save:', e.message); return false; }
    try { client.settings?.delete?.(gid); } catch { /* reloads on next read */ }
    return true;
}
// why a card of this kind can't go out right now (null when it can)
function blocker(guild, row, kind, lang) {
    const k = KIND[kind];
    if (row[k.enabled] === 0) return WL('why_off', lang);
    const id = row[k.channel];
    if (!id) return WL('why_nochannel', lang);
    const ch = guild.channels.cache.get(String(id));
    if (!ch) return WL('why_gone', lang);
    const canPost = require('../lib/canPost');
    const d = canPost.diagnose(guild, ch, guild.members.me, canPost.neededFor(k.need));
    if (d.ok) return null;
    return d.reason === 'private' ? WL('why_private', lang) : WL('why_perms', lang, { perms: canPost.localize(d.missing || [], lang).join(', ') });
}

function panel(guild, client, lang, ownerId, notice) {
    const { icon } = require('../lib/ui/icons');
    const row = readCfg(client.db, guild.id);
    const quote = (txt) => `> ${String(txt).replace(/\n/g, '\n> ').slice(0, 300)}`;
    const c = new ContainerBuilder().setAccentColor(0x39FF14);
    let gated = false;
    try { gated = require('./verify.js').gateActive(guild, client.db); } catch { /* no verification module */ }
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `-# ARCHON · ${WL('panel_title', lang)}\n## ${icon('ch_welcome', guild)} ${WL('panel_heading', lang, { guild: guild.name })}${gated ? `\n-# ${WL('panel_gated', lang)}` : ''}`));
    if (notice) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(notice));

    for (const kind of ['welcome', 'goodbye']) {
        const k = KIND[kind];
        const on = row[k.enabled] !== 0;
        const why = blocker(guild, row, kind, lang);
        const chText = row[k.channel] ? (guild.channels.cache.has(String(row[k.channel])) ? `<#${row[k.channel]}>` : WL('why_gone', lang)) : WL('panel_nochannel', lang);
        const mark = !on ? '–' : why ? '!' : '✓';
        const msg = row[k.message] ? quote(row[k.message]) : `-# ${WL(kind === 'welcome' ? 'panel_default_welcome' : 'panel_default_goodbye', lang)}`;
        let text = `\`${mark}\` **${WL(kind === 'welcome' ? 'panel_welcome' : 'panel_goodbye', lang)}** · ${chText}\n${msg}`;
        if (on && why) text += `\n-# ${icon('warn', guild)} ${why}`;
        if (kind === 'welcome') {
            const accent = savedAccent(client.db, guild.id);
            text += `\n-# ${WL('panel_colour', lang, { colour: accent ? require('../lib/colors').nameOf(accent, lang) : WL('panel_colour_default', lang) })}`;
        }
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`wel:toggle:${kind}:${ownerId}`).setLabel(WL(on ? 'btn_on' : 'btn_off', lang)).setStyle(on ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji(icon(on ? 'ok' : 'offline', guild)),
            new ButtonBuilder().setCustomId(`wel:msg:${kind}:${ownerId}`).setLabel(WL('btn_message', lang)).setStyle(ButtonStyle.Secondary).setEmoji(icon('file', guild)),
            new ButtonBuilder().setCustomId(`wel:test:${kind}:${ownerId}`).setLabel(WL('btn_test', lang)).setStyle(ButtonStyle.Primary).setEmoji(icon('next', guild)));
        if (row[k.message]) buttons.addComponents(new ButtonBuilder().setCustomId(`wel:reset:${kind}:${ownerId}`).setLabel(WL('btn_reset', lang)).setStyle(ButtonStyle.Secondary).setEmoji(icon('refresh', guild)));
        c.addActionRowComponents(buttons);
    }
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    // these open the /channels panel and the banner colours card in place (their own handlers take over)
    c.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`chan:back:${ownerId}`).setLabel(WL('btn_channels', lang)).setStyle(ButtonStyle.Secondary).setEmoji(icon('ch_title', guild)),
        new ButtonBuilder().setCustomId('lvl:tm:welcome').setLabel(WL('btn_colours', lang)).setStyle(ButtonStyle.Secondary).setEmoji(icon('palette', guild))));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${WL('panel_vars', lang, KEEP)}`));
    return { components: [c], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
}

async function handleComponent(ix, client) {
    const guild = ix.guild;
    if (!guild) return;
    const lang = langOf(client, guild.id, ix, ix.user.id);
    const [, action, kind, ownerId] = ix.customId.split(':');
    const say = (content) => ix.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }).catch(() => {});
    if (!/^\d{17,20}$/.test(String(ownerId || ''))) return say(WL('panel_expired', lang));
    if (ix.user.id !== ownerId) return say(WL('panel_not_yours', lang));
    if (!canManage(ix.member)) return say(WL('admin_only', lang));
    const k = KIND[kind];
    if (!k) return say(WL('panel_expired', lang));
    const redraw = (notice) => (ix.isModalSubmit?.() && !ix.isFromMessage?.() ? say(notice) : ix.update(panel(guild, client, lang, ownerId, notice)).catch((e) => console.error('[WELCOME] panel:', e.message)));

    if (action === 'toggle') {
        const on = readCfg(client.db, guild.id)[k.enabled] !== 0;
        writeCol(client, guild.id, k.enabled, on ? 0 : 1);
        return redraw();
    }
    if (action === 'reset') {
        writeCol(client, guild.id, k.message, null);
        return redraw(`> ${WL('panel_reset_done', lang)}`);
    }
    if (action === 'msg') {
        const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
        const current = readCfg(client.db, guild.id)[k.message] || '';
        const input = new TextInputBuilder().setCustomId('text').setLabel(WL('modal_label', lang).slice(0, 45)).setStyle(TextInputStyle.Paragraph)
            .setMaxLength(MAX_MSG).setRequired(true).setPlaceholder(WL(kind === 'welcome' ? 'modal_ph_welcome' : 'modal_ph_goodbye', lang, KEEP).slice(0, 100));
        if (current) input.setValue(current.slice(0, MAX_MSG));
        return ix.showModal(new ModalBuilder().setCustomId(`wel:save:${kind}:${ownerId}`).setTitle(WL(kind === 'welcome' ? 'modal_title_welcome' : 'modal_title_goodbye', lang).slice(0, 45))
            .addComponents(new ActionRowBuilder().addComponents(input))).catch((e) => console.error('[WELCOME] modal:', e.message));
    }
    if (action === 'save') {
        const text = String(ix.fields.getTextInputValue('text') || '').trim().slice(0, MAX_MSG);
        if (!text) return say(WL('panel_empty', lang));
        writeCol(client, guild.id, k.message, text);
        const member = await guild.members.fetch(ix.user.id).catch(() => ix.member);
        let preview = text;
        try { preview = Style.formatTemplate(text, member, guild.memberCount); } catch { /* the raw text is preview enough */ }
        return redraw(`> ${WL('panel_saved', lang)}\n${preview.split('\n').map((x) => `-# ${x}`).join('\n').slice(0, 900)}`);
    }
    if (action === 'test') {
        const row = readCfg(client.db, guild.id);
        const why = blocker(guild, row, kind, lang);
        if (why) return say(`${WL('test_blocked', lang)} ${why}`);
        await ix.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
        const member = await guild.members.fetch(ix.user.id).catch(() => null);
        if (!member) return ix.editReply({ content: WL('test_failed', lang) }).catch(() => {});
        try {
            if (kind === 'welcome') await handleWelcome(member, client, client.db, { verified: true, test: true });
            else await handleGoodbye(member, client, client.db, { test: true });
            return ix.editReply({ content: WL('test_sent', lang, { channel: `<#${row[k.channel]}>` }) }).catch(() => {});
        } catch (e) {
            console.error('[WELCOME] test:', e.message);
            return ix.editReply({ content: WL('test_failed', lang) }).catch(() => {});
        }
    }
    return say(WL('panel_expired', lang));
}

// ================= MODULE =================
module.exports = {
    afterVerify,
    name: 'welcome',
    category: 'SYSTEM',
    aliases: ['goodbye', 'leave', 'join', 'welcomecard'],
    description: 'Welcome and goodbye cards with warm greetings, character art and real account age.',
    usage: '.welcome config | .welcome test | .welcome message <text> | .welcome goodbyemsg <text>',
    cooldown: 1000,

    // ── These two hooks are called by index.js GuildMemberAdd/Remove ──
    // index.js checks: if (client.welcome?.onMemberAdd) → calls this
    // This means index.js fallbackWelcome() is SKIPPED automatically ✅
    async onMemberAdd(member, client, db) {
        await handleWelcome(member, client, db);
    },

    async onMemberRemove(member, client, db) {
        await handleGoodbye(member, client, db);
    },

    handleComponent,
    panel,

    // ================= PREFIX COMMAND: .welcome opens the panel =================
    run: async (client, message) => {
        if (!message.guild) return;
        const lang = langOf(client, message.guild.id, message, message.author.id);
        if (!canManage(message.member)) return message.reply(WL('admin_only', lang)).catch(() => {});
        return message.reply(panel(message.guild, client, lang, message.author.id)).catch((e) => console.error('[WELCOME] panel:', e.message));
    },

    // ================= SLASH COMMAND: /welcome opens the panel =================
    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Welcome and goodbye cards: channels, messages, on/off and a test')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    execute: async (ix, client) => {
        if (!ix.guild) return;
        const lang = langOf(client, ix.guild.id, ix, ix.user.id);
        if (!canManage(ix.member)) return ix.reply({ content: WL('admin_only', lang), flags: MessageFlags.Ephemeral });
        const view = panel(ix.guild, client, lang, ix.user.id);
        return ix.reply({ ...view, flags: view.flags | MessageFlags.Ephemeral });
    }
};
