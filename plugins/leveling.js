const { EmbedBuilder, AttachmentBuilder, SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const em = (k, fb) => { try { return require('../config/emojis')[k] || fb; } catch { return fb; } };
const { t } = require('../lib/i18n');
const { toV2 } = require('../lib/v2convert');   // classic embeds -> Components V2 cards
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

const W = 850, H = 260;
const AV_CACHE = path.join(__dirname, '..', 'cache', 'avatars');
if (!fs.existsSync(AV_CACHE)) fs.mkdirSync(AV_CACHE, { recursive: true });

// ================= COLOR NAME → HEX MAP =================
const COLOR_MAP = {
    // Discord official
    blurple: '#5865F2', blue: '#5865F2', discord: '#5865F2',
    green: '#3BA55D', emerald: '#43b581',
    yellow: '#FAA61A', gold: '#faa61a', amber: '#faa61a',
    red: '#ED4245', ruby: '#e74c3c', crimson: '#e74c3c',
    pink: '#EB459E', magenta: '#EB459E',
    // Common
    purple: '#9b59b6', violet: '#9b59b6', royal: '#9b59b6',
    cyan: '#00fbff', aqua: '#00fbff', teal: '#00fbff',
    orange: '#e67e22', sunset: '#e67e22',
    black: '#1a1a2e', dark: '#1a1a2e', midnight: '#1a1a2e',
    white: '#ecf0f1', silver: '#95a5a6', grey: '#95a5a6', gray: '#95a5a6',
    // Matrix
    matrix: '#00ff41', hacker: '#00ff41',
    // Pastels
    lavender: '#B39DDB', mint: '#A5D6A7', peach: '#FFCCBC', sky: '#90CAF9',
};
function resolveColor(input) {
    if (!input) return null;
    const clean = input.toLowerCase().trim().replace(/^#/, '');
    // Check color names
    if (COLOR_MAP[clean]) return COLOR_MAP[clean];
    // Check hex
    if (/^[0-9a-f]{6}$/.test(clean)) return '#' + clean;
    return null;
}

// ================= PER-SERVER DEFAULT THEMES =================
const DEFAULT_THEMES = {
    5:  { bg1: '#43b581', bg2: '#2e7d52', accent: '#66f0a0', label: 'INITIATE' },
    10: { bg1: '#faa61a', bg2: '#b3780d', accent: '#ffd54f', label: 'ADEPT' },
    15: { bg1: '#5865f2', bg2: '#2d3a8c', accent: '#8b9aff', label: 'VETERAN' },
    20: { bg1: '#e74c3c', bg2: '#8e2409', accent: '#ff7a6b', label: 'ELITE' },
    25: { bg1: '#9b59b6', bg2: '#5b2c6f', accent: '#d7a3ef', label: 'LEGEND' },
};

// ================= XP FORMULA (matches index.js exactly) =================
function xpForLevel(level) { return Math.pow(level / 0.1, 2); }
function xpInCurrentLevel(totalXP, level) { return Math.floor(totalXP - xpForLevel(level - 1)); }
function xpNeededForLevel(level) { return Math.floor(xpForLevel(level) - xpForLevel(level - 1)); }
function xpProgress(totalXP, level) {
    const cur = xpInCurrentLevel(totalXP, level);
    const need = xpNeededForLevel(level);
    return need > 0 ? Math.min(cur / need, 0.99) : 0;
}
function getTheme(level, custom) {
    const keys = Object.keys(DEFAULT_THEMES).map(Number).sort((a, b) => b - a);
    for (const k of keys) if (level >= k) return { ...DEFAULT_THEMES[k], ...(custom || {}) };
    return { bg1: '#5865f2', bg2: '#2d3a8c', accent: '#8b9aff', label: 'ROOKIE', ...(custom || {}) };
}

// ================= AVATAR CACHE =================
async function getAvatar(user, size = 128) {
    const url = user.displayAvatarURL({ extension: 'png', size });
    const f = path.join(AV_CACHE, `${user.id}-${size}.png`);
    if (fs.existsSync(f)) return loadImage(f);
    try { return await loadImage(url); } catch { return null; }
}

// ================= CANVAS: LEGENDARY LEVEL BANNER (2x) =================
async function renderLevelBanner(user, level, xpCurrent, xpNeeded, theme = {}) {
    const SCALE = 2;
    const CW = W * SCALE, CH = H * SCALE;
    const t = getTheme(level, theme);
    const c = createCanvas(CW, CH);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const prog = xpNeeded > 0 ? Math.min(xpCurrent / xpNeeded, 0.99) : 0.5;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, CW, CH);
    grad.addColorStop(0, t.bg1);
    grad.addColorStop(1, t.bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(0, 0, CW, CH);

    // Diagonal lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1.5;
    for (let i = -CH; i < CW + CH; i += 35 * SCALE) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - CH, CH); ctx.stroke();
    }

    // Rank label badge
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    roundRect(ctx, 20 * SCALE, 18 * SCALE, 110 * SCALE, 28 * SCALE, 6 * SCALE);
    ctx.fill();
    ctx.fillStyle = t.accent;
    ctx.font = `bold ${11 * SCALE}px "Liberation Sans", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.label, 75 * SCALE, 32 * SCALE);

    // Avatar
    const av = await getAvatar(user, 256);
    const ar = 60 * SCALE;
    const ax = 55 * SCALE;
    const ay = CH / 2 + 10 * SCALE;

    if (av) {
        // Outer glow
        ctx.save();
        ctx.shadowColor = t.accent;
        ctx.shadowBlur = 18 * SCALE;
        ctx.beginPath();
        ctx.arc(ax + ar, ay, ar + 5 * SCALE, 0, Math.PI * 2);
        ctx.strokeStyle = t.accent;
        ctx.lineWidth = 3 * SCALE;
        ctx.stroke();
        ctx.restore();
        // Clip avatar
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax + ar, ay, ar, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(av, ax, ay - ar, ar * 2, ar * 2);
        ctx.restore();
        // Inner ring
        ctx.beginPath();
        ctx.arc(ax + ar, ay, ar + 2 * SCALE, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2 * SCALE;
        ctx.stroke();
    }

    const tx = ax + ar * 2 + 28 * SCALE;

    // Level number
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${52 * SCALE}px "Liberation Sans", Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`LEVEL ${level}`, tx, CH / 2 - 22 * SCALE);

    // Username
    ctx.fillStyle = t.accent;
    ctx.font = `${26 * SCALE}px "Liberation Sans", Arial, sans-serif`;
    const name = user.username.length > 20 ? user.username.substring(0, 19) + '\u2026' : user.username;
    ctx.fillText(name, tx, CH / 2 + 24 * SCALE);

    // XP text
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = `${12 * SCALE}px "Liberation Sans", Arial, sans-serif`;
    ctx.fillText(`${xpCurrent.toLocaleString()} / ${xpNeeded.toLocaleString()} XP`, tx, CH / 2 + 54 * SCALE);

    // Branding
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = `${10 * SCALE}px "Liberation Sans", Arial, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText('ARCHON CG-223', CW - 25 * SCALE, 30 * SCALE);

    // Progress bar
    const barX = tx, barY = CH - 42 * SCALE, barW = 440 * SCALE, barH = 10 * SCALE;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, barX, barY, barW, barH, 5 * SCALE);
    ctx.fill();
    const fillW = Math.max(barW * prog, 6 * SCALE);
    const pGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    pGrad.addColorStop(0, t.accent);
    pGrad.addColorStop(1, t.bg1);
    ctx.save();
    ctx.shadowColor = t.accent;
    ctx.shadowBlur = 8 * SCALE;
    ctx.fillStyle = pGrad;
    roundRect(ctx, barX, barY, fillW, barH, 5 * SCALE);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `bold ${10 * SCALE}px "Liberation Sans", Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(prog * 100)}%`, barX + barW + 10 * SCALE, barY + 8 * SCALE);

    // Corner accent
    ctx.strokeStyle = t.accent + '60';
    ctx.lineWidth = 2 * SCALE;
    ctx.beginPath();
    ctx.moveTo(CW - 120 * SCALE, CH - 3); ctx.lineTo(CW, CH - 3); ctx.stroke();

    // Output full 2x
    return c.encode('png');
}
// ================= CANVAS: RANK CARD (2x) =================
async function renderRankCard(user, rank, level, totalXP, theme = {}) {
    const SCALE = 2;
    const CW = W * SCALE, CH = H * SCALE;
    const t = getTheme(level, theme);
    const c = createCanvas(CW, CH);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const xpCur = xpInCurrentLevel(totalXP, level);
    const xpNeed = xpNeededForLevel(level);
    const prog = xpProgress(totalXP, level);

    // Background
    const grad = ctx.createLinearGradient(0, 0, CW, CH);
    grad.addColorStop(0, t.bg1);
    grad.addColorStop(1, t.bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(0, 0, CW, CH);

    // Diagonal lines
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1.5;
    for (let i = -CH; i < CW + CH; i += 40 * SCALE) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - CH, CH); ctx.stroke();
    }

    // Avatar
    const av = await getAvatar(user, 256);
    const ar = 55 * SCALE;
    const ax = 50 * SCALE;
    const ay = CH / 2;

    if (av) {
        ctx.save();
        ctx.shadowColor = t.accent;
        ctx.shadowBlur = 16 * SCALE;
        ctx.beginPath();
        ctx.arc(ax + ar, ay, ar + 5 * SCALE, 0, Math.PI * 2);
        ctx.strokeStyle = t.accent;
        ctx.lineWidth = 3 * SCALE;
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax + ar, ay, ar, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(av, ax, ay - ar, ar * 2, ar * 2);
        ctx.restore();
        ctx.beginPath();
        ctx.arc(ax + ar, ay, ar + 2 * SCALE, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 2 * SCALE;
        ctx.stroke();
    }

    // Rank badge
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    roundRect(ctx, 20 * SCALE, 15 * SCALE, 85 * SCALE, 28 * SCALE, 6 * SCALE);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${11 * SCALE}px "Liberation Sans", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`RANK #${rank}`, 62 * SCALE, 29 * SCALE);

    const tx = ax + ar * 2 + 22 * SCALE;

    // Username
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${28 * SCALE}px "Liberation Sans", Arial, sans-serif`;
    ctx.textAlign = 'left';
    const nm = user.username.length > 22 ? user.username.substring(0, 21) + '\u2026' : user.username;
    ctx.fillText(nm, tx, CH / 2 - 35 * SCALE);

    // Level
    ctx.fillStyle = t.accent;
    ctx.font = `bold ${20 * SCALE}px "Liberation Sans", Arial, sans-serif`;
    ctx.fillText(`Level ${level}`, tx, CH / 2 - 5 * SCALE);

    // XP
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `bold ${13 * SCALE}px "Liberation Sans", Arial, sans-serif`;
    ctx.fillText(`${xpCur.toLocaleString()} / ${xpNeed.toLocaleString()} XP`, tx, CH / 2 + 22 * SCALE);

    // Total XP
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = `${10 * SCALE}px "Liberation Sans", Arial, sans-serif`;
    ctx.fillText(`Total: ${Math.floor(totalXP).toLocaleString()} XP`, tx, CH / 2 + 42 * SCALE);

    // Progress bar
    const bx = tx, by = CH - 40 * SCALE, bw = 420 * SCALE, bh = 10 * SCALE;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, bx, by, bw, bh, 5 * SCALE);
    ctx.fill();
    const fw = Math.max(bw * prog, 6 * SCALE);
    const pg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    pg.addColorStop(0, t.accent);
    pg.addColorStop(1, t.bg1);
    ctx.save();
    ctx.shadowColor = t.accent;
    ctx.shadowBlur = 8 * SCALE;
    ctx.fillStyle = pg;
    roundRect(ctx, bx, by, fw, bh, 5 * SCALE);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `bold ${10 * SCALE}px "Liberation Sans", Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(prog * 100)}%`, bx + bw + 10 * SCALE, by + 8 * SCALE);

    // Branding
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.textAlign = 'right';
    ctx.font = `${10 * SCALE}px "Liberation Sans", Arial, sans-serif`;
    ctx.fillText('ARCHON CG-223', CW - 20 * SCALE, 25 * SCALE);

    return c.encode('png');
}


// ================= CANVAS: WELCOME BANNER =================
async function renderWelcomeBanner(member, count, theme = {}) {
    const bg1 = theme.welcomeBg1 || '#5865f2', bg2 = theme.welcomeBg2 || '#2d3a8c', accent = theme.welcomeAccent || '#8b9aff';
    const c = createCanvas(W * 2, (H + 60) * 2);
    const ctx = c.getContext('2d');
    ctx.scale(2, 2);

    const grad = ctx.createLinearGradient(0, 0, W, H + 60);
    grad.addColorStop(0, bg1);
    grad.addColorStop(1, bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H + 60);

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(0, 0, W, H + 60);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth = 1;
    for (let i = 0; i < W; i += 50) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H + 60); ctx.stroke(); }

    // Avatar
    const av = await getAvatar(member.user, 256);
    const ax = 55, ay = (H + 60) / 2, ar = 62;
    if (av) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax + ar, ay, ar + 10, 0, Math.PI * 2);
        ctx.fillStyle = accent + '20';
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax + ar, ay, ar, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(av, ax, ay - ar, ar * 2, ar * 2);
        ctx.restore();
        ctx.beginPath();
        ctx.arc(ax + ar, ay, ar + 3, 0, Math.PI * 2);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('WELCOME', 210, (H + 60) / 2 - 40);

    ctx.fillStyle = accent;
    ctx.font = '30px sans-serif';
    const name = member.user.username.length > 20 ? member.user.username.substring(0, 19) + '…' : member.user.username;
    ctx.fillText(name, 210, (H + 60) / 2 + 8);

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Member #${count.toLocaleString()}`, 210, (H + 60) / 2 + 48);

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('ARCHON CG-223', W - 25, 25);

    return c.encode('png');
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// ================= ROLE MANAGER =================
async function assignRoles(member, newLevel, db) {
    const added = [];
    const milestones = [5, 10, 15, 20, 25];
    const guildId = member.guild.id;

    // Per-guild roles from DB
    let settings = null;
    try {
        settings = db?.prepare('SELECT level_5_role, level_10_role, level_15_role, level_20_role, level_25_role FROM server_settings WHERE guild_id = ?').get(guildId);
    } catch(e) {}

    for (const lvl of milestones) {
        if (newLevel >= lvl) {
            const roleId = settings?.[`level_${lvl}_role`];
            if (!roleId) continue;
            const role = member.guild.roles.cache.get(roleId);
            if (role && !member.roles.cache.has(roleId) && member.guild.members.me.roles.highest.position > role.position) {
                try { await member.roles.add(role); added.push(role.name); } catch(e) {}
            }
        }
    }
    return added;
}

// ================= DB HELPERS =================
function setupDB(db) {
    try {
        db.prepare(`CREATE TABLE IF NOT EXISTS leveling_themes (guild_id TEXT PRIMARY KEY, level_bg1 TEXT, level_bg2 TEXT, level_accent TEXT, welcome_bg1 TEXT, welcome_bg2 TEXT, welcome_accent TEXT)`).run();
    } catch (e) { console.log('[LVL] DB:', e.message); }
}
function getThemeDB(db, gid) {
    try { return db.prepare(`SELECT * FROM leveling_themes WHERE guild_id = ?`).get(gid); } catch { return null; }
}
// Saves only the colours given: changing the level card keeps the welcome card's colours (it used to wipe them)
function saveThemeDB(db, gid, data) {
    const COLS = { levelBg1: 'level_bg1', levelBg2: 'level_bg2', levelAccent: 'level_accent', welcomeBg1: 'welcome_bg1', welcomeBg2: 'welcome_bg2', welcomeAccent: 'welcome_accent' };
    try {
        db.prepare('INSERT OR IGNORE INTO leveling_themes (guild_id) VALUES (?)').run(gid);
        for (const [k, col] of Object.entries(COLS)) {
            if (data[k]) db.prepare(`UPDATE leveling_themes SET ${col} = ? WHERE guild_id = ?`).run(data[k], gid);
        }
    } catch (e) { console.log('[LVL] saveTheme:', e.message); }
}

// ================= HANDLERS =================
// One announcement per level-up. The level-up channel if one is set, otherwise the channel where the member was talking
// (a short line there disappears after 15 s). The server's own level-up message replaces the default line.
async function handleLevelUp(member, newLevel, xpCurrent, xpNeeded, client, db, opts = {}) {
    if (!member || !member.guild) return; // Guard: user may have left server
    const isMilestone = DEFAULT_THEMES[newLevel] || (newLevel > 25 && newLevel % 5 === 0);
    const ss = client.getServerSettings?.(member.guild.id) || {};
    const chId = ss.levelupChannel || ss.levelup_channel;
    const ch = (chId ? member.guild.channels.cache.get(chId) : null) || opts.channel || member.guild.systemChannel;
    if (!ch) return;
    const _t = require('../lib/i18n').t;
    const LANGS = ['en','fr','bm','zh','ar'];
    const lang = LANGS.includes(ss.language) ? ss.language : (LANGS.includes(client.userLastLang?.get(member.id)) ? client.userLastLang.get(member.id) : 'en');
    const tpl = String(opts.template || ss.levelupMessage || '').trim();
    const line = tpl
        ? tpl.replace(/{user}/gi, String(member)).replace(/{username}/gi, member.user.username).replace(/{level}/gi, String(newLevel))
             .replace(/{xp}/gi, Number(opts.xp || 0).toLocaleString()).replace(/{server}/gi, member.guild.name).replace(/{tier}/gi, opts.tier || '')
        : `${em('party', '🎉')} ${_t('leveling.levelUpLine', lang, { user: String(member), level: newLevel })}`;
    const text = opts.roleLine ? `${line}\n${opts.roleLine}` : line;
    const mentions = { parse: [], users: [member.id] };
    const { safeSend, canSend } = require('../lib/safeSend');

    if (!isMilestone) {
        const msg = await safeSend('levelup', ch, { content: text, allowedMentions: mentions }, { guild: member.guild, channelId: ch.id, quiet: !chId });
        if (msg && !chId) setTimeout(() => msg.delete().catch(() => {}), 15000);
        return;
    }
    const added = await assignRoles(member, newLevel, db);
    const _milestoneNeeds = require('../lib/canPost').neededFor('levelup-milestone');
    if (!canSend('levelup-milestone', ch, _milestoneNeeds, { guild: member.guild, channelId: ch.id, quiet: !chId })) return;
    const customTheme = db ? levelTheme(getThemeDB(db, member.guild.id)) : null;   // the saved columns as { bg1, bg2, accent }
    const png = await renderLevelBanner(member.user, newLevel, xpCurrent, xpNeeded, customTheme);
    const theme = getTheme(newLevel, customTheme);
    const embed = new EmbedBuilder().setColor(parseInt(theme.bg1.replace('#', ''), 16)).setImage('attachment://levelup.png');
    if (added.length) embed.addFields({ name: _t('leveling.newRolesLabel', lang), value: added.map(r => `• ${r}`).join('\n'), inline: false });
    await safeSend('levelup-milestone', ch, { ...toV2({ content: text, embeds: [embed], files: [new AttachmentBuilder(png, { name: 'levelup.png' })] }), allowedMentions: mentions }, { guild: member.guild, channelId: ch.id, quiet: !chId });
}

async function handleWelcome(member, client, db) {
    const ss = client.getServerSettings?.(member.guild.id) || {};
    return; // Welcome handled by welcome.js — disabled here to prevent duplicate
    const customTheme = db ? getThemeDB(db, member.guild.id) : null;
    const png = await renderWelcomeBanner(member, member.guild.memberCount, customTheme || {});
    const embed = new EmbedBuilder().setColor(0x5865f2).setDescription((ss.welcomeMessage || 'Welcome to **{server}**, {user}!').replace('{user}', member.toString()).replace('{server}', member.guild.name).replace('{count}', String(member.guild.memberCount))).setImage('attachment://welcome.png').setFooter({ text: `Member #${member.guild.memberCount} • ARCHON CG-223` }).setTimestamp();
    const chId = ss.welcomeChannel || ss.welcome_channel;
    const ch = chId ? member.guild.channels.cache.get(chId) : member.guild.systemChannel;
    if (!ch) return;
    await ch.send(toV2({ embeds: [embed], files: [new AttachmentBuilder(png, { name: 'welcome.png' })] })).catch(() => { });
}

async function handleRank(message, args, client, db, lang = 'en') {
    const target = message.mentions.users.first() || message.author;
    // Fetch from users table (ARCHON CG-223 schema)
    const row = db?.prepare(`SELECT level, xp FROM users WHERE guild_id = ? AND id = ?`)?.get(message.guild.id, target.id);
    if (!row) return message.reply(t('leveling.no_xp', lang)).catch(() => { });
    const rankRow = db?.prepare(`SELECT COUNT(*) + 1 as rank FROM users WHERE guild_id = ? AND xp > ?`)?.get(message.guild.id, row.xp);
    const rank = rankRow?.rank || '?';
    const customTheme = levelTheme(getThemeDB(db, message.guild.id));
    const png = await renderRankCard(target, rank, row.level, row.xp, customTheme);
    const embed = new EmbedBuilder().setColor(0x5865f2).setImage('attachment://rank.png').setFooter({ text: 'ARCHON CG-223' }).setTimestamp();
    await message.reply(toV2({ embeds: [embed], files: [new AttachmentBuilder(png, { name: 'rank.png' })] })).catch(() => { });
}

// ================= MODULE =================

// ================= CONFIG CARD =================
// /leveling config and .leveling config: where level-ups are posted, the five level rewards (and whether ARCHON
// can really give each one), and a picture of both banners' colours. Admins get a button to reset the colours.
const MILESTONES = [5, 10, 15, 20, 25];
const L = (k, lang, v) => t('leveling.' + k, lang, v || {});
const POWERFUL = PermissionFlagsBits.Administrator | PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageRoles | PermissionFlagsBits.BanMembers | PermissionFlagsBits.KickMembers;

// why ARCHON can't give this role to members (null when it can)
function roleProblem(guild, role) {
    if (!role) return 'gone';
    if (role.id === guild.id || role.managed) return 'managed';
    if (role.position >= (guild.members.me?.roles?.highest?.position ?? 0)) return 'above';
    if (role.permissions?.any?.(POWERFUL)) return 'powerful';
    return null;
}

const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? v : d);
async function bannerPreview(theme, lang) {
    const W = 640, H = 200, cv = createCanvas(W, H), c = cv.getContext('2d');
    const strip = (y, a, b, label) => {
        const g = c.createLinearGradient(0, 0, W, 0);
        g.addColorStop(0, a); g.addColorStop(1, b);
        c.fillStyle = g;
        c.beginPath(); if (c.roundRect) c.roundRect(0, y, W, 88, 16); else c.rect(0, y, W, 88); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.95)'; c.font = '600 26px sans-serif'; c.fillText(label, 24, y + 54);
    };
    // the colours members really see: the level banner's background, and the welcome card's dark background with its accent
    const lv = shownLevel(theme || {});
    strip(0, lv.bg1, lv.bg2, L('cardLevel', lang));
    const wa = hex(theme?.welcome_accent, '#2ecc71');
    strip(108, '#0a1f0a', '#0a1f0a', L('cardWelcome', lang));
    c.fillStyle = wa; c.fillRect(0, 108, 10, 88); c.fillRect(W - 120, 108 + 40, 96, 8);
    return cv.encode('png');
}

async function configCard(client, guild, db, lang, isAdmin) {
    const { icon } = require('../lib/ui/icons');
    const { card } = require('../lib/games/v2');
    const { dashboardUrl } = require('../lib/postProblems');
    let row = {}, stats = {};
    try { row = db?.prepare(`SELECT levelup_channel, ${MILESTONES.map((m) => `level_${m}_role`).join(', ')}, ${STREAK_ROLES.map((x) => x[1]).join(', ')} FROM server_settings WHERE guild_id = ?`).get(guild.id) || {}; } catch { row = {}; }
    try { stats = db?.prepare('SELECT COUNT(*) AS n, MAX(level) AS top FROM users WHERE guild_id = ? AND xp > 0').get(guild.id) || {}; } catch { stats = {}; }
    const theme = db ? getThemeDB(db, guild.id) : null;

    const rewards = MILESTONES.map((m) => {
        const tag = `\`${L('levelTag', lang, { level: m })}\``;
        const id = row[`level_${m}_role`];
        if (!id) return `${tag} -# ${L('notSet', lang)}`.replace(' -# ', ' · ');
        const problem = roleProblem(guild, guild.roles.cache.get(String(id)));
        if (!problem) return `${tag} ${icon('ok', guild)} <@&${id}>`;
        if (problem === 'gone') return `${tag} ${icon('no', guild)} ${L('roleGone', lang)}`;
        return `${tag} ${icon('warn', guild)} <@&${id}>\n-# ${L(problem === 'above' ? 'roleAbove' : 'roleManaged', lang)}`;
    });

    const streaks = STREAK_ROLES.map(([days, col]) => {
        const tag = `\`${L('streakTag', lang, { days })}\``;
        const id = row[col];
        if (!id) return `${tag} · ${L('notSet', lang)}`;
        const problem = roleProblem(guild, guild.roles.cache.get(String(id)));
        if (!problem) return `${tag} ${icon('ok', guild)} <@&${id}>`;
        if (problem === 'gone') return `${tag} ${icon('no', guild)} ${L('roleGone', lang)}`;
        return `${tag} ${icon('warn', guild)} <@&${id}>\n-# ${L(problem === 'above' ? 'roleAbove' : 'roleManaged', lang)}`;
    });

    const items = [
        { text: `-# ARCHON · ${L('title', lang)}\n## ${icon('stats', guild)} ${L('heading', lang, { guild: guild.name })}\n${stats.n ? L('summary', lang, { n: stats.n, top: stats.top || 1 }) : L('summaryNone', lang)}` },
        { rule: true },
        { text: `**${L('channelLabel', lang)}**\n${row.levelup_channel ? `<#${row.levelup_channel}>` : L('channelHere', lang)}` },
        { rule: true },
        { text: `**${L('rewardsLabel', lang)}**\n${rewards.join('\n')}\n-# ${L('rewardsHint', lang)}` },
        { rule: true },
        { text: `**${L('streakLabel', lang)}**\n${streaks.join('\n')}\n-# ${L('streakHint', lang)}` },
        { rule: true },
        { text: `**${L('bannersLabel', lang)}**` },
        { media: ['attachment://lvl-theme.png', L('bannersLabel', lang)] },
        { text: `-# ${L('bannersHint', lang)}` },
    ];
    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(dashboardUrl(guild.id)).setLabel(L('btnDashboard', lang)).setEmoji(icon('globe', guild)));
    // one tap creates the missing level roles (cosmetic only), when ARCHON may manage roles here
    const missingRoles = MILESTONES.some((m) => !row[`level_${m}_role`]);
    if (isAdmin && missingRoles && guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) buttons.addComponents(new ButtonBuilder().setCustomId('lvl:create').setStyle(ButtonStyle.Success).setLabel(L('btnCreate', lang)).setEmoji(icon('ok', guild)));
    const missingStreak = STREAK_ROLES.some(([, col]) => !row[col]);
    if (isAdmin && missingStreak && guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) buttons.addComponents(new ButtonBuilder().setCustomId('lvl:streak').setStyle(ButtonStyle.Success).setLabel(L('btnCreateStreak', lang)).setEmoji(icon('streak', guild)));
    if (isAdmin) buttons.addComponents(new ButtonBuilder().setCustomId('lvl:theme').setStyle(ButtonStyle.Primary).setLabel(L('btnTheme', lang)).setEmoji(icon('palette', guild)));
    items.push({ row: buttons });
    return { ...card(0xE6A817, items), files: [new AttachmentBuilder(await bannerPreview(theme, lang), { name: 'lvl-theme.png' })] };
}

// The "Reset colours" button on the config card
// The level roles ARCHON can create: emoji, colour, and the app emoji used as the role icon on boosted servers
// The daily-streak roles (/claim): days in a row, settings column, emoji, colour
const STREAK_ROLES = [
    [3, 'daily_initiate_role', '🔥', 0xE67E22], [7, 'daily_warrior_role', '⚡', 0xF1C40F],
    [30, 'daily_champion_role', '🏅', 0x1ABC9C], [100, 'daily_legend_role', '💎', 0x8E44AD],
];
const LEVEL_ROLES = [
    [5, '🌱', 0x2ECC71, 'ic_lvl5'], [10, '🔹', 0x3498DB, 'ic_lvl10'], [15, '💠', 0x9B59B6, 'ic_lvl15'],
    [20, '⚜️', 0xE67E22, 'ic_lvl20'], [25, '👑', 0xE6A817, 'ic_lvl25'],
];

// Creates the missing level roles: no permissions at all (cosmetic), not mentionable, just under ARCHON's role.
// Servers with role icons (boost level 2) get ARCHON's gold icon next to the name; the others get the emoji in the name.
// sets: 'level' (levels 5 to 25) or 'streak' (3 to 100 days in a row)
async function createRoles(guild, db, lang, set = 'level') {
    const me = guild.members.me;
    if (!me?.permissions?.has(PermissionFlagsBits.ManageRoles)) return { error: 'createNoPerm' };
    const list = set === 'streak'
        ? STREAK_ROLES.map(([days, col, emoji, color]) => ({ col, emoji, color, base: L('streakName', lang, { days }), iconKey: null }))
        : LEVEL_ROLES.map(([lvl, emoji, color, iconKey]) => ({ col: `level_${lvl}_role`, emoji, color, base: L(`roleName${lvl}`, lang), iconKey }));
    let row = {};
    try { row = db.prepare(`SELECT ${list.map((x) => x.col).join(', ')} FROM server_settings WHERE guild_id = ?`).get(guild.id) || {}; } catch { row = {}; }
    const icons = guild.features?.includes?.('ROLE_ICONS');
    let E = {}; try { E = require('../config/emojis'); } catch { E = {}; }
    let made = 0, linked = 0;
    db.prepare('INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)').run(guild.id);
    // highest tier first: each new role lands at the bottom, so the top tier ends up above the first one
    for (const { col, emoji, color, base, iconKey } of [...list].reverse()) {
        if (row[col] && guild.roles.cache.has(String(row[col]))) continue;
        const name = icons ? base : `${emoji} ${base}`;
        let role = guild.roles.cache.find((r) => r.name === name || r.name === base || r.name === `${emoji} ${base}`);
        if (!role) {
            const m = /^<a?:\w+:(\d+)>$/.exec(String((iconKey && E[iconKey]) || ''));
            const opts = { name, color, permissions: [], hoist: false, mentionable: false, reason: set === 'streak' ? 'ARCHON daily streak rewards' : 'ARCHON level rewards' };
            if (icons) { if (m) opts.icon = `https://cdn.discordapp.com/emojis/${m[1]}.png`; else opts.unicodeEmoji = emoji; }
            role = await guild.roles.create(opts).catch(async (e) => {
                // an icon Discord refuses must not stop the role itself
                if (opts.icon || opts.unicodeEmoji) { delete opts.icon; delete opts.unicodeEmoji; return guild.roles.create(opts).catch(() => null); }
                console.error('[LEVELING] create role:', e.message); return null;
            });
            if (!role) continue;
            made++;
        }
        if (roleProblem(guild, role) && roleProblem(guild, role) !== 'gone') continue;   // an existing role ARCHON can't give is left alone
        db.prepare(`UPDATE server_settings SET ${col} = ? WHERE guild_id = ?`).run(role.id, guild.id);
        linked++;
    }
    return { made, reused: linked - made };   // new roles, and existing ones with the same name that were reused
}

// ================= BANNER THEME CARD =================
// Opened from /leveling config. Two pages: the level-up banner (with /leveling rank cards) and the welcome card's accent.
// Every pick is saved at once and the card redraws itself with a real preview, so nobody needs to know hex codes.
const Colors = require('../lib/colors');
const THEME_PRESETS = [   // [key, background start, background end, accent]
    ['night', '#191970', '#4169E1', '#FFD700'], ['sunset', '#800000', '#FF8C00', '#FFF8DC'],
    ['mali', '#14B53A', '#1E5631', '#FCD116'], ['ocean', '#003B46', '#008080', '#40E0D0'],
    ['royal', '#4B0082', '#9B59B6', '#FFD700'], ['forest', '#1E5631', '#6B8E23', '#FFF8DC'],
    ['neon', '#111111', '#36393F', '#39FF14'], ['rose', '#5B0E2D', '#EB459E', '#FFC0CB'],
    ['dark', '#2C2C2A', '#36393F', '#ED4245'],
];
const BG_KEYS = ['black', 'charcoal', 'graphite', 'slate', 'midnight', 'navy', 'royal', 'blurple', 'blue', 'petrol', 'teal', 'forest', 'mali_green', 'olive', 'maroon', 'wine', 'crimson', 'mali_red', 'chocolate', 'coffee', 'plum', 'indigo', 'purple', 'magenta'];
const ACCENT_KEYS = ['white', 'cream', 'silver', 'gold', 'amber', 'yellow', 'mali_yellow', 'lemon', 'orange', 'coral', 'salmon', 'red', 'pink', 'rose', 'neon_pink', 'lavender', 'violet', 'sky', 'cyan', 'turquoise', 'mint', 'green', 'neon_green', 'lime'];
const WELCOME_BG = '#0A1F0A';   // the welcome card's own dark background (plugins/welcome-style.js)
const hexOf = (key) => Colors.PALETTE.find((p) => p[0] === key)?.[1];
const SLOT_COL = { bg1: 'level_bg1', bg2: 'level_bg2', accent: 'level_accent', waccent: 'welcome_accent' };
const SLOT_KEY = { bg1: 'levelBg1', bg2: 'levelBg2', accent: 'levelAccent', waccent: 'welcomeAccent' };

// the saved row as the colours the renderers read ({ bg1, bg2, accent }); empty when nothing is saved
function levelTheme(row) {
    const out = {};
    for (const [k, col] of [['bg1', 'level_bg1'], ['bg2', 'level_bg2'], ['accent', 'level_accent']]) { const h = Colors.normHex(row?.[col]); if (h) out[k] = h; }
    return out;
}
// what a level-12 member really sees (the server's colours over the default tier colours)
const shownLevel = (row) => getTheme(12, levelTheme(row));

// true when the accent is hard to read on the background (contrast under 3:1)
function lowContrast(mode, row) {
    if (mode === 'welcome') { const a = Colors.normHex(row?.welcome_accent); return a ? Colors.contrast(a, WELCOME_BG) < 3 : false; }
    if (!Object.keys(levelTheme(row)).length) return false;   // ARCHON's own tier colours are left alone
    const t = shownLevel(row);
    const bg = Colors.mix(Colors.mix(t.bg1, t.bg2, 0.5), '#000000', 0.22);   // the banner darkens its background by 22 %
    return Colors.contrast(t.accent, bg) < 3;
}

function colourSelect(id, keys, current, lang, extra = []) {
    const { StringSelectMenuBuilder } = require('discord.js');
    const cur = Colors.normHex(current);
    const opts = [...extra];
    for (const k of keys) {
        if (opts.length >= 24) break;
        const h = hexOf(k);
        opts.push({ label: Colors.nameOf(h, lang), value: h, emoji: Colors.dot(h), description: h, default: !!cur && h === cur });
    }
    opts.push({ label: L('themeOther', lang), value: 'other', emoji: '✏️', description: L('themeOtherHint', lang) });
    return new StringSelectMenuBuilder().setCustomId(id).addOptions(opts)
        .setPlaceholder((cur ? `${L(`themeSlot_${id.split(':').pop()}`, lang)} · ${Colors.nameOf(cur, lang)} ${cur}` : `${L(`themeSlot_${id.split(':').pop()}`, lang)} · ${L(id.endsWith('waccent') ? 'themeDefaultWelcome' : 'themeDefault', lang)}`).slice(0, 150));
}

async function themePreview(ix, mode, row) {
    try {
        if (mode === 'welcome') {
            const Style = require('./welcome-style');
            const cfg = { ...Style.normalizeWelcomeConfig({}), welcomeAccent: Colors.normHex(row?.welcome_accent) || null, lang: 'en' };
            return await Style.renderWelcomeCard(ix.member, ix.guild.memberCount || 1, cfg);
        }
        return await renderLevelBanner(ix.user, 12, 640, 1000, levelTheme(row));
    } catch (e) {
        console.error('[LEVELING] theme preview:', e.message);
        return bannerPreview(row, require('../lib/pick-lang').pickLang(ix.client, ix.guildId, ix, ix.user.id));
    }
}

async function themeCard(ix, mode, lang) {
    const { icon } = require('../lib/ui/icons');
    const { card } = require('../lib/games/v2');
    const db = ix.client.db;
    const row = (db && getThemeDB(db, ix.guildId)) || {};
    const hasIcon = !!ix.guild.iconURL?.();
    const line = (slot, hex, fallback) => `${Colors.dot(hex || fallback)} ${L(`themeSlot_${slot}`, lang)} · ${hex ? `**${Colors.nameOf(hex, lang)}** \`${hex}\`` : L(slot === 'waccent' ? 'themeDefaultWelcome' : 'themeDefault', lang)}`;
    const items = [
        { text: `-# ARCHON · ${L('title', lang)}\n## ${icon('palette', ix.guild)} ${L(mode === 'welcome' ? 'themeTitleWelcome' : 'themeTitleLevel', lang)}\n${L('themeIntro', lang)}` },
        { media: ['attachment://theme-preview.png', L(mode === 'welcome' ? 'cardWelcome' : 'cardLevel', lang)] },
    ];
    const rows = [];
    const server = hasIcon ? [{ label: L('themeServer', lang), value: 'server', emoji: '🖼️', description: L('themeServerHint', lang) }] : [];
    if (mode === 'welcome') {
        const a = Colors.normHex(row.welcome_accent);
        items.push({ text: `${line('waccent', a, '#2ECC71')}\n-# ${L('themeWelcomeNote', lang)}` });
        rows.push(new ActionRowBuilder().addComponents(colourSelect('lvl:tc:waccent', ACCENT_KEYS, a, lang, server)));
    } else {
        const t = levelTheme(row), shown = shownLevel(row);
        items.push({ text: [line('bg1', t.bg1, shown.bg1), line('bg2', t.bg2, shown.bg2), line('accent', t.accent, shown.accent)].join('\n') + `\n-# ${L('themeLevelNote', lang)}` });
        const { StringSelectMenuBuilder } = require('discord.js');
        const presets = [...server, ...THEME_PRESETS.map(([k, a, , c]) => ({ label: L(`preset_${k}`, lang), value: k, emoji: Colors.dot(a), description: `${Colors.nameOf(a, lang)} · ${Colors.nameOf(c, lang)}`.slice(0, 100) }))];
        rows.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('lvl:tp').setPlaceholder(L('themePresetPick', lang)).addOptions(presets)));
        rows.push(new ActionRowBuilder().addComponents(colourSelect('lvl:tc:bg1', BG_KEYS, t.bg1, lang)));
        rows.push(new ActionRowBuilder().addComponents(colourSelect('lvl:tc:bg2', BG_KEYS, t.bg2, lang)));
        rows.push(new ActionRowBuilder().addComponents(colourSelect('lvl:tc:accent', ACCENT_KEYS, t.accent, lang)));
    }
    const low = lowContrast(mode, row);
    if (low) items.push({ text: `${icon('warn', ix.guild)} ${L('themeLowContrast', lang)}` });
    items.push({ rule: true });
    for (const r of rows) items.push({ row: r });
    const btns = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`lvl:tm:${mode === 'welcome' ? 'level' : 'welcome'}`).setStyle(ButtonStyle.Secondary).setLabel(L(mode === 'welcome' ? 'themeToLevel' : 'themeToWelcome', lang)).setEmoji(icon('palette', ix.guild)));
    if (low) btns.addComponents(new ButtonBuilder().setCustomId(`lvl:tfix:${mode}`).setStyle(ButtonStyle.Success).setLabel(L('themeFix', lang)).setEmoji(icon('ok', ix.guild)));
    btns.addComponents(
        new ButtonBuilder().setCustomId(`lvl:treset:${mode}`).setStyle(ButtonStyle.Secondary).setLabel(L('btnReset', lang)).setEmoji(icon('refresh', ix.guild)),
        new ButtonBuilder().setCustomId('lvl:tback').setStyle(ButtonStyle.Secondary).setLabel(L('themeBack', lang)).setEmoji(icon('back', ix.guild)));
    items.push({ row: btns });
    const png = await themePreview(ix, mode, row);
    return { ...card(0x9B59B6, items), files: [new AttachmentBuilder(png, { name: 'theme-preview.png' })], attachments: [] };
}

function saveColours(db, gid, data) {
    saveThemeDB(db, gid, data);
}
function clearColours(db, gid, cols) {
    try { db.prepare(`UPDATE leveling_themes SET ${cols.map((c) => `${c} = NULL`).join(', ')} WHERE guild_id = ?`).run(gid); } catch (e) { console.log('[LVL] clearTheme:', e.message); }
}

// lvl:t… components: lvl:theme (open), lvl:tm:<mode> (switch page), lvl:tp (ready theme), lvl:tc:<slot> (one colour),
// lvl:tmodal:<slot> (a typed colour), lvl:tfix:<mode> (readable accent), lvl:treset:<mode>, lvl:tback (config card)
async function handleTheme(ix, client, lang) {
    const db = client.db;
    setupDB(db);
    const id = ix.customId;
    const modeOf = (slot) => (slot === 'waccent' ? 'welcome' : 'level');
    const redraw = async (mode) => {
        const payload = await themeCard(ix, mode, lang);
        if (ix.deferred || ix.replied) return ix.editReply(payload).catch((e) => console.error('[LEVELING] theme edit:', e.message));
        return ix.update(payload).catch((e) => console.error('[LEVELING] theme update:', e.message));
    };

    if (id === 'lvl:theme' || id.startsWith('lvl:tm:')) { await ix.deferUpdate().catch(() => {}); return redraw(id === 'lvl:theme' ? 'level' : id.split(':')[2]); }
    if (id === 'lvl:tback') { await ix.deferUpdate().catch(() => {}); return ix.editReply({ ...(await configCard(client, ix.guild, db, lang, true)), attachments: [] }).catch(() => {}); }

    // a colour typed by hand (name or hex)
    if (id.startsWith('lvl:tmodal:')) {
        const slot = id.split(':')[2];
        const hex = Colors.resolve(ix.fields.getTextInputValue('colour'));
        if (!hex || !SLOT_KEY[slot]) return ix.reply({ content: L('themeBadColour', lang), flags: MessageFlags.Ephemeral }).catch(() => {});
        saveColours(db, ix.guildId, { [SLOT_KEY[slot]]: hex });
        if (ix.isFromMessage?.()) { await ix.deferUpdate().catch(() => {}); return redraw(modeOf(slot)); }
        return ix.reply({ content: L('themeSaved', lang, { colour: `${Colors.nameOf(hex, lang)} ${hex}` }), flags: MessageFlags.Ephemeral }).catch(() => {});
    }

    if (id.startsWith('lvl:tc:')) {
        const slot = id.split(':')[2];
        const v = ix.values?.[0];
        if (v === 'other') {
            const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
            const modal = new ModalBuilder().setCustomId(`lvl:tmodal:${slot}`).setTitle(L('themeOtherTitle', lang).slice(0, 45)).addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('colour').setLabel(L(`themeSlot_${slot}`, lang).slice(0, 45)).setStyle(TextInputStyle.Short).setMinLength(3).setMaxLength(30).setPlaceholder(L('themeOtherPlaceholder', lang).slice(0, 100)).setRequired(true)));
            return ix.showModal(modal).catch((e) => console.error('[LEVELING] theme modal:', e.message));
        }
        await ix.deferUpdate().catch(() => {});
        if (v === 'server') {
            const cols = await Colors.fromImage(ix.guild.iconURL({ extension: 'png', size: 128 }));
            const th = Colors.themeFrom(cols);
            if (!th) return ix.followUp({ content: L('themeNoIcon', lang), flags: MessageFlags.Ephemeral }).catch(() => {});
            saveColours(db, ix.guildId, { welcomeAccent: Colors.bestAccent(WELCOME_BG, cols) });
            return redraw('welcome');
        }
        const hex = Colors.normHex(v);
        if (hex && SLOT_KEY[slot]) saveColours(db, ix.guildId, { [SLOT_KEY[slot]]: hex });
        return redraw(modeOf(slot));
    }

    if (id === 'lvl:tp') {
        await ix.deferUpdate().catch(() => {});
        const v = ix.values?.[0];
        let th = null;
        if (v === 'server') {
            th = Colors.themeFrom(await Colors.fromImage(ix.guild.iconURL({ extension: 'png', size: 128 })));
            if (!th) return ix.followUp({ content: L('themeNoIcon', lang), flags: MessageFlags.Ephemeral }).catch(() => {});
        } else {
            const p = THEME_PRESETS.find((x) => x[0] === v);
            if (p) th = { bg1: p[1], bg2: p[2], accent: p[3] };
        }
        if (th) saveColours(db, ix.guildId, { levelBg1: th.bg1, levelBg2: th.bg2, levelAccent: th.accent });
        return redraw('level');
    }

    if (id.startsWith('lvl:tfix:')) {
        await ix.deferUpdate().catch(() => {});
        const mode = id.split(':')[2];
        const row = getThemeDB(db, ix.guildId) || {};
        if (mode === 'welcome') saveColours(db, ix.guildId, { welcomeAccent: Colors.bestAccent(WELCOME_BG, [row.welcome_accent].filter(Boolean)) });
        else {
            const t = shownLevel(row);
            saveColours(db, ix.guildId, { levelAccent: Colors.bestAccent(Colors.mix(Colors.mix(t.bg1, t.bg2, 0.5), '#000000', 0.22), [t.accent]) });
        }
        return redraw(mode);
    }

    if (id.startsWith('lvl:treset:')) {
        await ix.deferUpdate().catch(() => {});
        const mode = id.split(':')[2];
        clearColours(db, ix.guildId, mode === 'welcome' ? ['welcome_accent'] : ['level_bg1', 'level_bg2', 'level_accent']);
        await redraw(mode);
        return ix.followUp({ content: L('resetDone', lang), flags: MessageFlags.Ephemeral }).catch(() => {});
    }
}

// Autocomplete for /leveling theme: colour names in the member's language, or the hex they typed
async function autocomplete(ix, client) {
    const lang = require('../lib/pick-lang').pickLang(client, ix.guildId, ix, ix.user.id);
    const q = (() => { try { return ix.options.getFocused(); } catch { return ''; } })();
    return ix.respond(Colors.suggest(q, ['en', 'fr', 'zh', 'ar'].includes(lang) ? lang : 'en')).catch(() => {});
}

// The config card's buttons: lvl:reset (colours) and lvl:create (level roles), and the theme card (lvl:t…)
async function handleComponent(ix, client) {
    const lang = require('../lib/pick-lang').pickLang(client, ix.guildId, ix, ix.user.id);
    if (!ix.member?.permissions?.has(PermissionFlagsBits.Administrator)) return ix.reply({ content: L('admin_only', lang), flags: MessageFlags.Ephemeral }).catch(() => {});
    if (ix.customId === 'lvl:theme' || ix.customId.startsWith('lvl:t')) return handleTheme(ix, client, lang);
    if (ix.customId === 'lvl:create' || ix.customId === 'lvl:streak') {
        await ix.deferUpdate().catch(() => {});
        const r = await createRoles(ix.guild, client.db, lang, ix.customId === 'lvl:streak' ? 'streak' : 'level');
        try { client.settings?.delete?.(ix.guildId); } catch { /* the settings cache reloads the new roles */ }
        await ix.editReply(await configCard(client, ix.guild, client.db, lang, true)).catch(() => {});
        return ix.followUp({ content: r.error ? L(r.error, lang) : (r.made || r.reused) ? [r.made ? L('createDone', lang, { n: r.made }) : null, r.reused ? L('createReused', lang, { n: r.reused }) : null].filter(Boolean).join('\n') : L('createNothing', lang), flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    if (client.db) client.db.prepare('DELETE FROM leveling_themes WHERE guild_id = ?').run(ix.guildId);
    await ix.update(await configCard(client, ix.guild, client.db, lang, true)).catch(() => {});
    return ix.followUp({ content: L('resetDone', lang), flags: MessageFlags.Ephemeral }).catch(() => {});
}

module.exports = {
    handleComponent,
    autocomplete,
    _configCard: (...a) => configCard(...a),
    name: 'leveling',
    category: 'SOCIAL',
    aliases: [],
    description: '📈 Dynamic canvas leveling with per-server themes, rank cards, welcome banners, and milestone auto-roles.',
    usage: '.leveling [rank @user] | .leveling theme <color> | .leveling config',
    cooldown: 3000,

    data: new SlashCommandBuilder().setName('leveling').setDescription('📈 Leveling system').
        addSubcommand(s => s.setName('rank').setDescription('View rank card').addUserOption(o => o.setName('user').setDescription('User (default: you)').setRequired(false))).
        addSubcommand(s => s.setName('config').setDescription('View leveling configuration')).
        addSubcommand(s => s.setName('setrole').setDescription('Set auto-role for level milestone')
            .addIntegerOption(o => o.setName('level').setDescription('Level milestone (5/10/15/20/25)').setRequired(true).addChoices(
                {name: 'Level 5', value: 5}, {name: 'Level 10', value: 10},
                {name: 'Level 15', value: 15}, {name: 'Level 20', value: 20},
                {name: 'Level 25', value: 25}
            ))
            .addRoleOption(o => o.setName('role').setDescription('Role to assign (leave empty to clear)').setRequired(false))).

        addSubcommandGroup(sg => sg.setName('theme').setDescription('Customize banner theme').
            addSubcommand(s => s.setName('level').setDescription('Level banner colors').addStringOption(o => o.setName('bg1').setDescription('Background start: a colour name or #hex').setRequired(false).setAutocomplete(true)).addStringOption(o => o.setName('bg2').setDescription('Background end: a colour name or #hex').setRequired(false).setAutocomplete(true)).addStringOption(o => o.setName('accent').setDescription('Accent: a colour name or #hex').setRequired(false).setAutocomplete(true))).
            addSubcommand(s => s.setName('welcome').setDescription('Welcome card accent colour').addStringOption(o => o.setName('accent').setDescription('Accent: a colour name or #hex').setRequired(true).setAutocomplete(true))).
            addSubcommand(s => s.setName('reset').setDescription('Reset to default theme'))),

    // ================= PREFIX =================
    run: async (client, message, args, db, ss) => {
        const lang = require('../lib/pick-lang').pickLang(client, message.guild?.id, null, message.author.id);
        const sub = args[0]?.toLowerCase() || 'rank';
        if (sub === 'rank') return handleRank(message, args, client, db, lang);
        if (sub === 'config') {
            const admin = message.member?.permissions?.has(PermissionFlagsBits.Administrator);
            return message.reply({ ...(await configCard(client, message.guild, db, lang, admin)), allowedMentions: { parse: [] } }).catch(() => { });
        }
        if (sub === 'theme') {
            const adm = message.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!adm) return message.reply(t('leveling.admin_only', lang)).catch(() => { });
            const type = args[1]?.toLowerCase();
            if (type === 'reset') { if (db) db.prepare(`DELETE FROM leveling_themes WHERE guild_id = ?`).run(message.guild.id); return message.reply(t('leveling.theme_reset', lang)).catch(() => { }); }
            if (!type || !['level', 'welcome'].includes(type)) return message.reply(L('themeUsage', lang)).catch(() => { });
            // colour names work too (one word each: "gold", "or", "#FFD700"); the welcome card takes one colour, its accent
            const given = args.slice(2, type === 'level' ? 5 : 3);
            const hexes = given.map((x) => Colors.resolve(x));
            if (!given.length || hexes.some((h) => !h)) return message.reply(L('themeBadColour', lang)).catch(() => { });
            const data = type === 'level'
                ? Object.fromEntries([['levelBg1', hexes[0]], ['levelBg2', hexes[1]], ['levelAccent', hexes[2]]].filter(([, h]) => h))
                : { welcomeAccent: hexes[0] };
            if (db) saveThemeDB(db, message.guild.id, data);
            return message.reply(t('leveling.theme_updated', lang, { type })).catch(() => { });
        }
        return handleRank(message, args, client, db, lang);
    },

    // ================= SLASH =================
    execute: async (ix, client) => {
        const sc = ix.options.getSubcommand();
        const group = ix.options.getSubcommandGroup(false);
        const db = client.db;
        const ss = client.getServerSettings?.(ix.guild?.id) || {};
        const lang = require('../lib/pick-lang').pickLang(client, ix.guildId, ix, ix.user.id);

        if (sc === 'rank') {
            await ix.deferReply();
            const target = ix.options.getUser('user') || ix.user;
            const row = db?.prepare(`SELECT level, xp FROM users WHERE guild_id = ? AND id = ?`)?.get(ix.guild.id, target.id);
            if (!row) return ix.editReply({ content: t('leveling.no_xp', lang) }).catch(() => { });
            const rankRow = db?.prepare(`SELECT COUNT(*) + 1 as rank FROM users WHERE guild_id = ? AND xp > ?`)?.get(ix.guild.id, row.xp);
            const rank = rankRow?.rank || '?';
            const customTheme = db ? levelTheme(getThemeDB(db, ix.guild.id)) : null;
            const png = await renderRankCard(target, rank, row.level, row.xp, customTheme);
            const embed = new EmbedBuilder().setColor(0x5865f2).setImage('attachment://rank.png').setFooter({ text: 'ARCHON CG-223' }).setTimestamp();
            return ix.editReply(toV2({ embeds: [embed], files: [new AttachmentBuilder(png, { name: 'rank.png' })] })).catch(() => { });
        }

        if (sc === 'config') {
            await ix.deferReply({ flags: MessageFlags.Ephemeral });
            const admin = ix.member?.permissions?.has(PermissionFlagsBits.Administrator);
            return ix.editReply({ ...(await configCard(client, ix.guild, db, lang, admin)), flags: MessageFlags.IsComponentsV2 }).catch(() => { });
        }

        if (group === 'theme') {
            const adm = ix.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!adm) return ix.reply({ content: t('leveling.admin_only', lang), flags: 1 << 6 });

            if (sc === 'reset') {
                if (db) db.prepare(`DELETE FROM leveling_themes WHERE guild_id = ?`).run(ix.guild.id);
                return ix.reply({ content: t('leveling.theme_reset', lang), flags: 1 << 6 });
            }

            // a colour name in any language or a hex; the welcome card only has an accent (its background stays dark)
            const data = {};
            const pick = (opt, key) => {
                const raw = ix.options.getString(opt, false);
                if (!raw) return true;
                const h = Colors.resolve(raw);
                if (!h) return false;
                data[key] = h; return true;
            };
            const ok = sc === 'level'
                ? pick('bg1', 'levelBg1') && pick('bg2', 'levelBg2') && pick('accent', 'levelAccent')
                : pick('accent', 'welcomeAccent');
            if (!ok) return ix.reply({ content: L('themeBadColour', lang), flags: 1 << 6 });
            if (!Object.keys(data).length) return ix.reply({ content: L('themeNeedColor', lang), flags: 1 << 6 });
            setupDB(db);
            if (db) saveThemeDB(db, ix.guild.id, data);
            // answer with the theme card itself: the new colours on a real preview, ready for more changes
            await ix.deferReply({ flags: MessageFlags.Ephemeral });
            return ix.editReply(await themeCard(ix, sc === 'level' ? 'level' : 'welcome', lang)).catch((e) => console.error('[LEVELING] theme reply:', e.message));
        }

        if (sc === 'setrole') {
            const adm = ix.member.permissions.has(PermissionFlagsBits.ManageGuild);
            if (!adm) return ix.reply({ content: t('leveling.manage_only', lang), flags: 1 << 6 });
            const level = ix.options.getInteger('level');
            const role = ix.options.getRole('role');
            const col = `level_${level}_role`;
            if (role) {
                const problem = roleProblem(ix.guild, ix.guild.roles.cache.get(role.id) || role);
                if (problem && problem !== 'gone') return ix.reply({ content: L(problem === 'above' ? 'setroleAbove' : problem === 'powerful' ? 'setrolePowerful' : 'setroleManaged', lang, { role: `<@&${role.id}>` }), flags: 1 << 6, allowedMentions: { parse: [] } });
            }
            // saved, then read back: if it didn't stick, say so instead of a success message
            let saved = false;
            try {
                db.prepare(`INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)`).run(ix.guild.id);
                db.prepare(`UPDATE server_settings SET ${col} = ? WHERE guild_id = ?`).run(role?.id || null, ix.guild.id);
                saved = (db.prepare(`SELECT ${col} AS v FROM server_settings WHERE guild_id = ?`).get(ix.guild.id)?.v || null) === (role?.id || null);
            } catch (e) { console.error('[LEVELING] setrole:', e.message); }
            if (!saved) return ix.reply({ content: L('setroleFailed', lang), flags: 1 << 6 });
            if (role) {
                return ix.reply({ content: t('leveling.role_set', lang, { level, role }), flags: 1 << 6 });
            } else {
                return ix.reply({ content: t('leveling.role_cleared', lang, { level }), flags: 1 << 6 });
            }
        }
    },

    // ================= EVENT HOOKS (called by index.js) =================
    async onMemberAdd(member, client, db) {
        setupDB(db);
        await handleWelcome(member, client, db);
    },
    async onLevelUp(member, newLevel, xpCurrent, xpNeeded, client, db, opts) {
        setupDB(db);
        await handleLevelUp(member, newLevel, xpCurrent, xpNeeded, client, db, opts);
    }
};
