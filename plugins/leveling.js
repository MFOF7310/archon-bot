const { EmbedBuilder, AttachmentBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
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

// ================= CANVAS: LEGENDARY LEVEL BANNER =================
async function renderLevelBanner(user, level, xpCurrent, xpNeeded, theme = {}) {
    const t = getTheme(level, theme);
    const c = createCanvas(W, H);
    const ctx = c.getContext('2d');
    const prog = xpNeeded > 0 ? Math.min(xpCurrent / xpNeeded, 0.99) : 0.5;

    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, t.bg1);
    grad.addColorStop(1, t.bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Subtle noise overlay
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, 0, W, H);

    // Diagonal lines pattern
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    for (let i = -H; i < W + H; i += 35) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - H, H); ctx.stroke(); }

    // Rank label badge (top left)
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, 20, 18, 100, 26, 6);
    ctx.fill();
    ctx.fillStyle = t.accent;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t.label, 70, 35);

    // Avatar (left, with double ring)
    const av = await getAvatar(user, 128);
    const ax = 55, ay = H / 2 + 10, ar = 60;
    if (av) {
        // Outer glow
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax + ar, ay, ar + 8, 0, Math.PI * 2);
        ctx.fillStyle = t.accent + '25'; // hex + alpha
        ctx.fill();
        ctx.restore();
        // Clip avatar circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax + ar, ay, ar, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(av, ax, ay - ar, ar * 2, ar * 2);
        ctx.restore();
        // Inner ring
        ctx.beginPath();
        ctx.arc(ax + ar, ay, ar + 2, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff40';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Outer accent ring
        ctx.beginPath();
        ctx.arc(ax + ar, ay, ar + 5, 0, Math.PI * 2);
        ctx.strokeStyle = t.accent;
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    // Level number (big, right of avatar)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`LEVEL ${level}`, 175, H / 2 - 25);

    // Username below level
    ctx.fillStyle = t.accent;
    ctx.font = '28px sans-serif';
    const name = user.username.length > 20 ? user.username.substring(0, 19) + '…' : user.username;
    ctx.fillText(name, 175, H / 2 + 22);

    // XP text — shows XP in current level / XP needed for this level
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${xpCur.toLocaleString()} / ${xpNeed.toLocaleString()} XP`, 175, H / 2 + 52);

    // ARCHON branding (top right)
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('ARCHON CG-223', W - 25, 32);

    // Progress bar
    const barX = 175, barY = H - 42, barW = 440, barH = 10;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, barX, barY, barW, barH, 5);
    ctx.fill();
    const fillW = Math.max(barW * prog, 6);
    const pGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    pGrad.addColorStop(0, t.accent);
    pGrad.addColorStop(1, t.bg1);
    ctx.fillStyle = pGrad;
    roundRect(ctx, barX, barY, fillW, barH, 5);
    ctx.fill();
    // Percentage
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(prog * 100)}%`, barX + barW + 10, barY + 8);

    // Corner accent line
    ctx.strokeStyle = t.accent + '60';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W - 120, H - 3);
    ctx.lineTo(W, H - 3);
    ctx.stroke();

    return c.encode('png');
}

// ================= CANVAS: WELCOME BANNER =================
async function renderWelcomeBanner(member, count, theme = {}) {
    const bg1 = theme.welcomeBg1 || '#5865f2', bg2 = theme.welcomeBg2 || '#2d3a8c', accent = theme.welcomeAccent || '#8b9aff';
    const c = createCanvas(W, H + 60);
    const ctx = c.getContext('2d');

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
    const av = await getAvatar(member.user, 128);
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

// ================= CANVAS: RANK CARD =================
async function renderRankCard(user, rank, level, totalXP, theme = {}) {
    const t = getTheme(level, theme);
    const c = createCanvas(W, H);
    const ctx = c.getContext('2d');
    const xpCur = xpInCurrentLevel(totalXP, level);
    const xpNeed = xpNeededForLevel(level);
    const prog = xpProgress(totalXP, level);

    // Background
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, t.bg1);
    grad.addColorStop(1, t.bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, 0, W, H);

    // Pattern
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    for (let i = -H; i < W + H; i += 40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - H, H); ctx.stroke(); }

    // Avatar
    const av = await getAvatar(user, 128);
    const ax = 50, ay = H / 2, ar = 55;
    if (av) {
        ctx.save(); ctx.beginPath(); ctx.arc(ax + ar, ay, ar + 6, 0, Math.PI * 2); ctx.fillStyle = t.accent + '30'; ctx.fill(); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.arc(ax + ar, ay, ar, 0, Math.PI * 2); ctx.closePath(); ctx.clip(); ctx.drawImage(av, ax, ay - ar, ar * 2, ar * 2); ctx.restore();
        ctx.beginPath(); ctx.arc(ax + ar, ay, ar + 2, 0, Math.PI * 2); ctx.strokeStyle = '#ffffff30'; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.arc(ax + ar, ay, ar + 5, 0, Math.PI * 2); ctx.strokeStyle = t.accent; ctx.lineWidth = 3; ctx.stroke();
    }

    // Rank badge
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, 20, 15, 80, 28, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`RANK #${rank}`, 60, 33);

    // Username
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'left';
    const nm = user.username.length > 22 ? user.username.substring(0, 21) + '…' : user.username;
    ctx.fillText(nm, 170, H / 2 - 35);

    // Level
    ctx.fillStyle = t.accent;
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`Level ${level}`, 170, H / 2 - 5);

    // XP in current level (main display)
    const curXP = xpInCurrentLevel(totalXP, level);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`${curXP.toLocaleString()} / ${xpNeed.toLocaleString()} XP`, 170, H / 2 + 22);

    // Total XP (secondary, dimmer)
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '11px sans-serif';
    ctx.fillText(`Total: ${Math.floor(totalXP).toLocaleString()} XP`, 170, H / 2 + 42);

    // Progress bar
    const bx = 170, by = H - 40, bw = 420, bh = 10;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, bx, by, bw, bh, 5);
    ctx.fill();
    const fw = Math.max(bw * prog, 6);
    const pg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    pg.addColorStop(0, t.accent); pg.addColorStop(1, t.bg1);
    ctx.fillStyle = pg;
    roundRect(ctx, bx, by, fw, bh, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`${Math.round(prog * 100)}%`, bx + bw + 10, by + 8);

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.textAlign = 'right';
    ctx.font = '11px sans-serif';
    ctx.fillText('ARCHON CG-223', W - 20, 25);

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
async function assignRoles(member, newLevel) {
    const added = [];
    const milestones = [5, 10, 15, 20, 25];
    for (const lvl of milestones) {
        if (newLevel >= lvl) {
            const ids = process.env[`LEVEL_${lvl}_ROLES`]?.split(',').filter(Boolean) || [];
            for (const rid of ids) {
                const role = member.guild.roles.cache.get(rid.trim());
                if (role && !member.roles.cache.has(rid.trim()) && member.guild.members.me.roles.highest.position > role.position) {
                    try { await member.roles.add(role); added.push(role.name); } catch { }
                }
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
function saveThemeDB(db, gid, data) {
    try {
        const ex = db.prepare(`SELECT 1 FROM leveling_themes WHERE guild_id = ?`).get(gid);
        if (ex) db.prepare(`UPDATE leveling_themes SET level_bg1=?, level_bg2=?, level_accent=?, welcome_bg1=?, welcome_bg2=?, welcome_accent=? WHERE guild_id=?`).run(data.levelBg1||null, data.levelBg2||null, data.levelAccent||null, data.welcomeBg1||null, data.welcomeBg2||null, data.welcomeAccent||null, gid);
        else db.prepare(`INSERT INTO leveling_themes (guild_id,level_bg1,level_bg2,level_accent,welcome_bg1,welcome_bg2,welcome_accent) VALUES (?,?,?,?,?,?,?)`).run(gid, data.levelBg1||null, data.levelBg2||null, data.levelAccent||null, data.welcomeBg1||null, data.welcomeBg2||null, data.welcomeAccent||null);
    } catch (e) { console.log('[LVL] saveTheme:', e.message); }
}

// ================= HANDLERS =================
async function handleLevelUp(member, newLevel, xpCurrent, xpNeeded, client, db) {
    const isMilestone = DEFAULT_THEMES[newLevel] || (newLevel > 25 && newLevel % 5 === 0);
    if (!isMilestone) return;
    const added = await assignRoles(member, newLevel);
    const customTheme = db ? getThemeDB(db, member.guild.id) : null;
    const png = await renderLevelBanner(member.user, newLevel, xpCurrent, xpNeeded, customTheme);
    const theme = getTheme(newLevel, customTheme);
    const embed = new EmbedBuilder().setColor(parseInt(theme.bg1.replace('#', ''), 16)).setDescription(`**${member.user.tag}** reached **Level ${newLevel}**!`).setImage('attachment://levelup.png').setFooter({ text: 'ARCHON CG-223' }).setTimestamp();
    if (added.length) embed.addFields({ name: 'New Roles', value: added.map(r => `• ${r}`).join('\n'), inline: false });
    const ss = client.getServerSettings?.(member.guild.id) || {};
    const chId = ss.levelupChannel || ss.levelup_channel;
    const ch = chId ? member.guild.channels.cache.get(chId) : member.guild.systemChannel;
    if (!ch) return;
    await ch.send({ content: `GG ${member}! 🎉`, embeds: [embed], files: [new AttachmentBuilder(png, { name: 'levelup.png' })] }).catch(() => { });
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
    await ch.send({ embeds: [embed], files: [new AttachmentBuilder(png, { name: 'welcome.png' })] }).catch(() => { });
}

async function handleRank(message, args, client, db) {
    const target = message.mentions.users.first() || message.author;
    // Fetch from users table (ARCHON CG-223 schema)
    const row = db?.prepare(`SELECT level, xp FROM users WHERE guild_id = ? AND id = ?`)?.get(message.guild.id, target.id);
    if (!row) return message.reply('❌ No XP data found. Chat to earn XP!').catch(() => { });
    const rankRow = db?.prepare(`SELECT COUNT(*) + 1 as rank FROM users WHERE guild_id = ? AND xp > ?`)?.get(message.guild.id, row.xp);
    const rank = rankRow?.rank || '?';
    const customTheme = getThemeDB(db, message.guild.id);
    const png = await renderRankCard(target, rank, row.level, row.xp, customTheme);
    const embed = new EmbedBuilder().setColor(0x5865f2).setImage('attachment://rank.png').setFooter({ text: 'ARCHON CG-223' }).setTimestamp();
    await message.reply({ embeds: [embed], files: [new AttachmentBuilder(png, { name: 'rank.png' })] }).catch(() => { });
}

// ================= MODULE =================
module.exports = {
    name: 'leveling',
    category: 'SOCIAL',
    aliases: ['rank', 'level'],
    description: '📈 Dynamic canvas leveling with per-server themes, rank cards, welcome banners, and milestone auto-roles.',
    usage: '.leveling [rank @user] | .leveling theme <color> | .leveling config',
    cooldown: 3000,

    data: new SlashCommandBuilder().setName('leveling').setDescription('📈 Leveling system').
        addSubcommand(s => s.setName('rank').setDescription('View rank card').addUserOption(o => o.setName('user').setDescription('User (default: you)').setRequired(false))).
        addSubcommand(s => s.setName('config').setDescription('View leveling configuration')).
        addSubcommandGroup(sg => sg.setName('theme').setDescription('Customize banner theme').
            addSubcommand(s => s.setName('level').setDescription('Level banner colors').addStringOption(o => o.setName('bg1').setDescription('Background start color (#hex)').setRequired(false)).addStringOption(o => o.setName('bg2').setDescription('Background end color (#hex)').setRequired(false)).addStringOption(o => o.setName('accent').setDescription('Accent color (#hex)').setRequired(false))).
            addSubcommand(s => s.setName('welcome').setDescription('Welcome banner colors').addStringOption(o => o.setName('bg1').setDescription('Background start color (#hex)').setRequired(false)).addStringOption(o => o.setName('bg2').setDescription('Background end color (#hex)').setRequired(false)).addStringOption(o => o.setName('accent').setDescription('Accent color (#hex)').setRequired(false))).
            addSubcommand(s => s.setName('reset').setDescription('Reset to default theme'))),

    // ================= PREFIX =================
    run: async (client, message, args, db, ss) => {
        const sub = args[0]?.toLowerCase() || 'rank';
        if (sub === 'rank') return handleRank(message, args, client, db);
        if (sub === 'config') {
            const t = db ? getThemeDB(db, message.guild.id) : null;
            const e = new EmbedBuilder().setColor(0x5865f2).setAuthor({ name: '📈 Leveling Config', iconURL: client.user.displayAvatarURL() }).
                addFields(
                    { name: 'Level Theme', value: t ? `\`${t.level_bg1 || 'default'} → ${t.level_bg2 || 'default'}\` | Accent: \`${t.level_accent || 'default'}\`` : 'Default (Discord blue)', inline: false },
                    { name: 'Welcome Theme', value: t ? `\`${t.welcome_bg1 || 'default'} → ${t.welcome_bg2 || 'default'}\` | Accent: \`${t.welcome_accent || 'default'}\`` : 'Default (Discord blue)', inline: false },
                    { name: 'Commands', value: '`\rank [@user]` — Show rank card\n`\leveling theme level #bg1 #bg2 #accent` — Customize\n`\leveling theme reset` — Reset to default', inline: false }
                ).setFooter({ text: 'ARCHON CG-223' }).setTimestamp();
            return message.reply({ embeds: [e] }).catch(() => { });
        }
        if (sub === 'theme') {
            const adm = message.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!adm) return message.reply('🔒 Admin only.').catch(() => { });
            const type = args[1]?.toLowerCase();
            if (type === 'reset') { if (db) db.prepare(`DELETE FROM leveling_themes WHERE guild_id = ?`).run(message.guild.id); return message.reply('✅ Theme reset to default.').catch(() => { }); }
            if (!type || !['level', 'welcome'].includes(type)) return message.reply('⚠️ Usage: `.leveling theme <level|welcome> [#bg1] [#bg2] [#accent]`').catch(() => { });
            const hexRegex = /^#?[0-9A-Fa-f]{6}$/;
            const bg1 = args[2], bg2 = args[3], accent = args[4];
            if (bg1 && !hexRegex.test(bg1)) return message.reply('❌ Invalid hex color. Use format: `#5865f2`').catch(() => { });
            const data = {};
            if (type === 'level') { if (bg1) data.levelBg1 = bg1.startsWith('#') ? bg1 : '#' + bg1; if (bg2) data.levelBg2 = bg2.startsWith('#') ? bg2 : '#' + bg2; if (accent) data.levelAccent = accent.startsWith('#') ? accent : '#' + accent; }
            else { if (bg1) data.welcomeBg1 = bg1.startsWith('#') ? bg1 : '#' + bg1; if (bg2) data.welcomeBg2 = bg2.startsWith('#') ? bg2 : '#' + bg2; if (accent) data.welcomeAccent = accent.startsWith('#') ? accent : '#' + accent; }
            if (db) saveThemeDB(db, message.guild.id, data);
            // Preview
            const testCanvas = createCanvas(200, 80);
            const tCtx = testCanvas.getContext('2d');
            const g = tCtx.createLinearGradient(0, 0, 200, 80);
            g.addColorStop(0, data.levelBg1 || data.welcomeBg1 || '#5865f2');
            g.addColorStop(1, data.levelBg2 || data.welcomeBg2 || '#2d3a8c');
            tCtx.fillStyle = g; tCtx.fillRect(0, 0, 200, 80);
            const preview = await testCanvas.encode('png');
            const embed = new EmbedBuilder().setColor(parseInt((data.levelAccent || data.welcomeAccent || '#8b9aff').replace('#', ''), 16)).setDescription(`✅ **${type}** theme updated.`).setImage('attachment://preview.png').setFooter({ text: 'ARCHON CG-223' }).setTimestamp();
            return message.reply({ embeds: [embed], files: [new AttachmentBuilder(preview, { name: 'preview.png' })] }).catch(() => { });
        }
        return handleRank(message, args, client, db);
    },

    // ================= SLASH =================
    execute: async (ix, client) => {
        const sc = ix.options.getSubcommand();
        const group = ix.options.getSubcommandGroup(false);
        const db = client.db;

        if (sc === 'rank') {
            await ix.deferReply();
            const target = ix.options.getUser('user') || ix.user;
            const row = db?.prepare(`SELECT level, xp FROM users WHERE guild_id = ? AND id = ?`)?.get(ix.guild.id, target.id);
            if (!row) return ix.editReply({ content: '❌ No XP data found. Chat to earn XP!' }).catch(() => { });
            const rankRow = db?.prepare(`SELECT COUNT(*) + 1 as rank FROM users WHERE guild_id = ? AND xp > ?`)?.get(ix.guild.id, row.xp);
            const rank = rankRow?.rank || '?';
            const customTheme = db ? getThemeDB(db, ix.guild.id) : null;
            const png = await renderRankCard(target, rank, row.level, row.xp, customTheme);
            const embed = new EmbedBuilder().setColor(0x5865f2).setImage('attachment://rank.png').setFooter({ text: 'ARCHON CG-223' }).setTimestamp();
            return ix.editReply({ embeds: [embed], files: [new AttachmentBuilder(png, { name: 'rank.png' })] }).catch(() => { });
        }

        if (sc === 'config') {
            const t = db ? getThemeDB(db, ix.guild.id) : null;
            const e = new EmbedBuilder().setColor(0x5865f2).setAuthor({ name: '📈 Leveling Config', iconURL: client.user.displayAvatarURL() }).
                addFields(
                    { name: 'Level Theme', value: t ? `\`${t.level_bg1 || 'default'} → ${t.level_bg2 || 'default'}\` | Accent: \`${t.level_accent || 'default'}\`` : 'Default (Discord blue)', inline: false },
                    { name: 'Welcome Theme', value: t ? `\`${t.welcome_bg1 || 'default'} → ${t.welcome_bg2 || 'default'}\` | Accent: \`${t.welcome_accent || 'default'}\`` : 'Default (Discord blue)', inline: false }
                ).setFooter({ text: 'ARCHON CG-223' }).setTimestamp();
            return ix.reply({ embeds: [e], flags: 1 << 6 });
        }

        if (group === 'theme') {
            const adm = ix.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!adm) return ix.reply({ content: '🔒 Admin only.', flags: 1 << 6 });

            if (sc === 'reset') {
                if (db) db.prepare(`DELETE FROM leveling_themes WHERE guild_id = ?`).run(ix.guild.id);
                return ix.reply({ content: '✅ Theme reset to default.', flags: 1 << 6 });
            }

            const bg1 = ix.options.getString('bg1');
            const bg2 = ix.options.getString('bg2');
            const accent = ix.options.getString('accent');
            const type = sc; // 'level' or 'welcome'
            const hexRe = /^#?[0-9A-Fa-f]{6}$/;

            const data = {};
            const clean = h => h.startsWith('#') ? h : '#' + h;
            if (type === 'level') { if (bg1) { if (!hexRe.test(bg1)) return ix.reply({ content: '❌ Invalid hex.', flags: 1 << 6 }); data.levelBg1 = clean(bg1); } if (bg2) { if (!hexRe.test(bg2)) return ix.reply({ content: '❌ Invalid hex.', flags: 1 << 6 }); data.levelBg2 = clean(bg2); } if (accent) { if (!hexRe.test(accent)) return ix.reply({ content: '❌ Invalid hex.', flags: 1 << 6 }); data.levelAccent = clean(accent); } }
            else { if (bg1) { if (!hexRe.test(bg1)) return ix.reply({ content: '❌ Invalid hex.', flags: 1 << 6 }); data.welcomeBg1 = clean(bg1); } if (bg2) { if (!hexRe.test(bg2)) return ix.reply({ content: '❌ Invalid hex.', flags: 1 << 6 }); data.welcomeBg2 = clean(bg2); } if (accent) { if (!hexRe.test(accent)) return ix.reply({ content: '❌ Invalid hex.', flags: 1 << 6 }); data.welcomeAccent = clean(accent); } }

            if (db) saveThemeDB(db, ix.guild.id, data);
            await ix.reply({ content: `✅ **${type}** theme updated.`, flags: 1 << 6 });
        }
    },

    // ================= EVENT HOOKS (called by index.js) =================
    async onMemberAdd(member, client, db) {
        setupDB(db);
        await handleWelcome(member, client, db);
    },
    async onLevelUp(member, newLevel, xpCurrent, xpNeeded, client, db) {
        setupDB(db);
        await handleLevelUp(member, newLevel, xpCurrent, xpNeeded, client, db);
    }
};
