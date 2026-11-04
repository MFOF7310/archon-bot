// lib/mod-core.js — what every moderation command shares: who may act on whom, clean reasons,
// the case record, the mod-log card and the result card. Used by /ban, /kick, /mute, /warn, /clear, /slowmode.
const {
    PermissionFlagsBits: P, MessageFlags,
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, SectionBuilder, ThumbnailBuilder,
} = require('discord.js');
const { t } = require('./i18n');
const { pickLang } = require('./pick-lang');
const { resolveEmoji } = require('./emoji-resolver');

const V2 = MessageFlags.IsComponentsV2;
const SNOWFLAKE = /^\d{17,20}$/;

// One colour and one icon per action (custom ARCHON emoji when available, a plain symbol otherwise)
const LOOK = {
    ban:      { color: 0xd64545, icon: ['mod_sign', '🔨'] },
    unban:    { color: 0x2f9e6e, icon: ['check', '✅'] },
    kick:     { color: 0xe07b39, icon: ['mod_sign', '👢'] },
    mute:     { color: 0xd4a72c, icon: ['timeout', '⏳'] },
    unmute:   { color: 0x2f9e6e, icon: ['check', '✅'] },
    warn:     { color: 0xd4a72c, icon: ['warning', '⚠️'] },
    clear:    { color: 0x5b6b7c, icon: ['settings', '🧹'] },
    slowmode: { color: 0x5b6b7c, icon: ['slowly', '🐢'] },
    info:     { color: 0x2b9bb0, icon: ['shield', '🛡️'] },
    error:    { color: 0xc0392b, icon: ['error', '❌'] },
};
const icon = (name, ctx) => resolveEmoji(LOOK[name]?.icon[0], ctx) || LOOK[name]?.icon[1] || '';

const langFor = (client, ctx) => pickLang(client, ctx.guild?.id || ctx.guildId, ctx, ctx.user?.id || ctx.author?.id) || 'en';
const T = (key, lang, vars) => t(`mod.${key}`, lang, vars);

// A reason as typed, made safe: no control characters, one line, at most 400 characters
function cleanReason(raw, lang) {
    const r = String(raw || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);
    return r || T('noReason', lang);
}
// The reason written into Discord's audit log, which allows 512 characters
const auditReason = (reason, actor) => `${reason} — ${actor.username || actor.user?.username || actor.id} (${actor.id})`.slice(0, 512);

// Text a moderator typed can't ping anyone or break out of the card's formatting
const safe = (s) => String(s ?? '').replace(/@(everyone|here)/gi, '@​$1').replace(/<@[!&]?(\d+)>/g, '<@​$1>');

// Does the moderator hold this permission (owner and Administrator always do)?
function hasPerm(member, flag) {
    if (!member) return false;
    if (member.guild?.ownerId === member.id) return true;
    return !!member.permissions?.has(flag);
}

// May `actor` act on `target`? Returns null, or a code saying why not.
// target: a GuildMember, or null when the person is not in the server (a ban by user id).
function checkTarget(guild, actor, targetId, target, action) {
    const me = guild.members.me;
    if (targetId === actor.id) return 'self';
    if (me && targetId === me.id) return 'me';
    if (targetId === guild.ownerId) return 'owner';
    if (!target) return null; // not a member: only role order can't apply
    if (target.user?.bot && action === 'warn') return 'bot';
    if (actor.id !== guild.ownerId && target.roles?.highest && actor.roles?.highest && target.roles.highest.position >= actor.roles.highest.position) return 'above_actor';
    const can = action === 'ban' ? target.bannable : action === 'kick' ? target.kickable : action === 'mute' ? target.moderatable : true;
    if (can === false) return 'above_bot';
    return null;
}

function targetText(code, lang, guild, target, action, ctx) {
    if (code === 'above_bot') {
        try {
            const bp = require('./botPerms');
            if (action === 'ban' || action === 'kick') return bp.hierarchyText(guild, target, action, T('above_bot', lang), ctx);
        } catch { /* falls back below */ }
    }
    return T(`target_${code}`, lang);
}

// The case record. moderation_logs is also what /warn modlogs reads, so every action shows up there.
let tablesReady = false;
function ensureTables(db) {
    if (tablesReady) return;
    db.prepare(`CREATE TABLE IF NOT EXISTS moderation_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, user_id TEXT NOT NULL, moderator_id TEXT NOT NULL, action TEXT NOT NULL, reason TEXT, warning_id TEXT, timestamp INTEGER DEFAULT (strftime('%s', 'now')))`).run();
    db.prepare(`CREATE TABLE IF NOT EXISTS warnings (id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, user_id TEXT NOT NULL, moderator_id TEXT NOT NULL, reason TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now')), expires_at INTEGER, active BOOLEAN DEFAULT 1)`).run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_modlogs_guild_user ON moderation_logs(guild_id, user_id)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings(guild_id, user_id)').run();
    tablesReady = true;
}
function record(db, { guildId, userId, moderatorId, action, reason = null, warningId = null }) {
    try {
        ensureTables(db);
        const r = db.prepare('INSERT INTO moderation_logs (guild_id, user_id, moderator_id, action, reason, warning_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, strftime(\'%s\', \'now\'))')
            .run(String(guildId), String(userId), String(moderatorId), action, reason, warningId);
        return Number(r.lastInsertRowid) || null;
    } catch (e) { console.error('[MOD] record:', e.message); return null; }
}

// A card: icon + title, optional avatar, "label · value" lines, and a small footer
function card({ look = 'info', title, lines = [], avatar = null, footer = null, ctx }) {
    const c = new ContainerBuilder().setAccentColor(LOOK[look]?.color ?? LOOK.info.color);
    const head = `### ${icon(look, ctx)} ${title}`.trim();
    const body = lines.filter(Boolean).map(([k, v]) => (k ? `**${k}** · ${v}` : v)).join('\n');
    if (avatar) {
        c.addSectionComponents(new SectionBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(body ? `${head}\n${body}` : head))
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar)));
    } else {
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(body ? `${head}\n${body}` : head));
    }
    if (footer) {
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footer}`));
    }
    return c;
}
const footerFor = (caseId, lang) => [caseId ? T('case', lang, { id: caseId }) : null, `<t:${Math.floor(Date.now() / 1000)}:f>`].filter(Boolean).join(' · ');

// Post a card in the mod-log channel (if one is set). Never throws.
async function toModLog(guild, db, container) {
    try {
        const ch = require('./modlog').resolveModLog(guild, db);
        if (!ch) return;
        await ch.send({ components: [container], flags: V2, allowedMentions: { parse: [] } });
    } catch (e) { console.error(`[MOD] mod-log guild=${guild.id}:`, e.message); }
}

// Tell the person, best effort (closed DMs are normal)
async function dm(user, container) {
    try { await user.send({ components: [container], flags: V2, allowedMentions: { parse: [] } }); return true; }
    catch { return false; }
}

// Reply to a slash command or a prefix message in the same way
async function respond(ctx, payload, { ephemeral = false } = {}) {
    const isSlash = typeof ctx?.isChatInputCommand === 'function' || typeof ctx?.isButton === 'function';
    const base = { allowedMentions: { parse: [] }, ...payload };
    if (base.components) base.flags = V2 | (ephemeral && isSlash ? MessageFlags.Ephemeral : 0);
    else if (ephemeral && isSlash) base.flags = MessageFlags.Ephemeral;
    try {
        if (isSlash) return (ctx.deferred || ctx.replied) ? await ctx.editReply(base) : await ctx.reply(base);
        return await ctx.reply(base);
    } catch (e) { console.error('[MOD] reply:', e.message); return null; }
}
const fail = (ctx, text, lang) => respond(ctx, { components: [card({ look: 'error', title: T('refused', lang), lines: [[null, text]], ctx })] }, { ephemeral: true });

// "10m", "1h30m", "2d", "90" (minutes) → milliseconds, or null
function parseDuration(input) {
    const s = String(input || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!s) return null;
    if (/^\d+$/.test(s)) return Number(s) * 60000;
    const re = /(\d+)(s|sec|m|min|h|hr|d|j|w)/g;
    let total = 0, used = 0, m;
    while ((m = re.exec(s))) {
        used += m[0].length;
        const n = Number(m[1]);
        total += n * ({ s: 1000, sec: 1000, m: 60000, min: 60000, h: 3600000, hr: 3600000, d: 86400000, j: 86400000, w: 604800000 }[m[2]]);
    }
    return used === s.length && total > 0 ? total : null;
}
function formatDuration(ms, lang) {
    const parts = [];
    let rest = Math.round(ms / 1000);
    for (const [unit, size] of [['d', 86400], ['h', 3600], ['m', 60], ['s', 1]]) {
        const n = Math.floor(rest / size);
        if (n) { parts.push(T(`unit_${unit}`, lang, { n })); rest -= n * size; }
    }
    return parts.slice(0, 2).join(' ') || T('unit_s', lang, { n: 0 });
}

const avatarOf = (user) => { try { return user.displayAvatarURL({ size: 128, extension: 'png' }); } catch { return null; } };
const who = (user) => `<@${user.id}> \`${safe(user.username || user.id)}\``;

module.exports = {
    P, V2, SNOWFLAKE, LOOK, T, langFor, cleanReason, auditReason, safe, hasPerm, checkTarget, targetText,
    ensureTables, record, card, footerFor, toModLog, dm, respond, fail, parseDuration, formatDuration, avatarOf, who, icon,
};
