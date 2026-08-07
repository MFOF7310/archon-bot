const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const https = require('https');
const fs = require('fs');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');

// ── Register fonts ──
const FONTS_DIR = path.join(__dirname, '../assets/fonts');
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'DejaVuSans-Bold.ttf'), 'DejaVuBold');
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'DejaVuSans.ttf'), 'DejaVu');
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'DejaVuSansMono.ttf'), 'DejaVuMono');
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'DejaVuSansMono-Bold.ttf'), 'DejaVuMonoBold');

// ── Background paths ──
const BG_DIR = path.join(__dirname, '../assets/backgrounds');
const BG_PRESETS = [
    path.join(BG_DIR, 'bg1.jpg'),
    path.join(BG_DIR, 'bg2.jpg'),
    path.join(BG_DIR, 'bg3.jpg'),
    path.join(BG_DIR, 'bg4.jpg'),
    path.join(BG_DIR, 'bg5.jpg'),
];

// ── Download helper ──
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, res => {
            if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(dest); });
        }).on('error', e => { fs.unlink(dest, () => {}); reject(e); });
    });
}

// ── Constants ──
const W = 900, H = 500;
const AVATAR_SIZE = 130;
const AVATAR_X = 40, AVATAR_Y = 40;

const AGENT_RANKS = [
    { minLevel: 1,  maxLevel: 5,        title: { fr: "RECRUE NEURALE",    en: "NEURAL RECRUIT"    }, color: "#2ecc71", emoji: "🌱" },
    { minLevel: 6,  maxLevel: 15,       title: { fr: "AGENT DE TERRAIN",  en: "FIELD AGENT"       }, color: "#3498db", emoji: "🔹" },
    { minLevel: 16, maxLevel: 30,       title: { fr: "SPÉCIALISTE CYBER", en: "CYBER SPECIALIST"  }, color: "#9b59b6", emoji: "💠" },
    { minLevel: 31, maxLevel: 50,       title: { fr: "COMMANDANT BKO",    en: "BKO COMMANDER"     }, color: "#e67e22", emoji: "⚜️" },
    { minLevel: 51, maxLevel: Infinity, title: { fr: "ARCHITECTE SYSTÈME",en: "SYSTEM ARCHITECT"  }, color: "#e74c3c", emoji: "👑" },
];
const WEALTH_TIERS = [
    { minCredits: 0,      title: { fr: "SANS LE SOU",       en: "BROKE"            }, emoji: "💀" },
    { minCredits: 100,    title: { fr: "PETIT PORTEFEUILLE", en: "SMALL WALLET"     }, emoji: "🪙" },
    { minCredits: 1000,   title: { fr: "COLLECTIONNEUR",     en: "COLLECTOR"        }, emoji: "💰" },
    { minCredits: 5000,   title: { fr: "INVESTISSEUR",       en: "INVESTOR"         }, emoji: "📈" },
    { minCredits: 15000,  title: { fr: "BARON",              en: "BARON"            }, emoji: "🏦" },
    { minCredits: 50000,  title: { fr: "MAGNAT",             en: "MAGNATE"          }, emoji: "👑" },
    { minCredits: 100000, title: { fr: "LÉGENDE FINANCIÈRE", en: "FINANCIAL LEGEND" }, emoji: "🏆" },
];

function calculateLevel(xp) { return Math.floor(0.1 * Math.sqrt(xp || 0)) + 1; }
function getAgentRank(level) { return AGENT_RANKS.find(r => level >= r.minLevel && level <= r.maxLevel) || AGENT_RANKS[AGENT_RANKS.length - 1]; }
function getWealthTier(credits) { return [...WEALTH_TIERS].reverse().find(t => (credits || 0) >= t.minCredits) || WEALTH_TIERS[0]; }
function hexToRgba(hex, alpha = 1) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${alpha})`;
}

// ── Draw rounded rect ──
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

// ── Draw progress bar ──
function drawBar(ctx, x, y, w, h, pct, colorFill, colorBg = '#1a1a2e') {
    // Background
    roundRect(ctx, x, y, w, h, h/2);
    ctx.fillStyle = colorBg;
    ctx.fill();
    // Fill
    const fillW = Math.max(h, (pct / 100) * w);
    roundRect(ctx, x, y, fillW, h, h/2);
    ctx.fillStyle = colorFill;
    ctx.fill();
    // Shine
    const shine = ctx.createLinearGradient(x, y, x, y + h);
    shine.addColorStop(0, 'rgba(255,255,255,0.15)');
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    roundRect(ctx, x, y, fillW, h, h/2);
    ctx.fillStyle = shine;
    ctx.fill();
}

// ── Draw circuit background ──
function drawBackground(ctx, rankColor) {
    // Circuit lines
    ctx.strokeStyle = 'rgba(0,240,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i < W; i += 40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke();
    }
    for (let i = 0; i < H; i += 40) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke();
    }

    // Circuit nodes
    ctx.fillStyle = 'rgba(0,240,255,0.06)';
    [[120,80],[300,200],[500,120],[700,300],[820,180],[200,380],[600,420]].forEach(([x,y]) => {
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,240,255,0.04)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI*2); ctx.stroke();
    });

    // Rank color accent top bar
    const accent = ctx.createLinearGradient(0, 0, W, 0);
    accent.addColorStop(0, 'transparent');
    accent.addColorStop(0.3, hexToRgba(rankColor, 0.8));
    accent.addColorStop(0.7, hexToRgba(rankColor, 0.8));
    accent.addColorStop(1, 'transparent');
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, W, 4);

    // Bottom accent
    ctx.fillStyle = accent;
    ctx.fillRect(0, H - 4, W, 4);

    // Left panel divider
    ctx.strokeStyle = hexToRgba(rankColor, 0.15);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(220, 20); ctx.lineTo(220, H - 20); ctx.stroke();
}

// ── Draw stat box ──
function drawStatBox(ctx, x, y, w, h, label, value, accentColor) {
    // Box bg
    roundRect(ctx, x, y, w, h, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fill();
    roundRect(ctx, x, y, w, h, 8);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Accent top
    ctx.fillStyle = accentColor;
    roundRect(ctx, x, y, w, 2, 1);
    ctx.fill();

    // Label
    ctx.font = '11px DejaVuMono';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.textAlign = 'center';
    ctx.fillText(label.toUpperCase(), x + w/2, y + 18);

    // Value
    ctx.font = 'bold 15px DejaVuBold';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(value, x + w/2, y + 38);
    ctx.textAlign = 'left';
}

// ══════════════════════════════════════════════════════════════
// MAIN CANVAS BUILDER
// ══════════════════════════════════════════════════════════════
async function buildProfileCard(target, client, db, guildId, guild, lang) {
    const shopItems = client.shopItems || [];

    // ── Fetch user data ──
    let userData = null;
    if (db) {
        userData = db.prepare(
            `SELECT id, xp, credits, streak_days, created_at, games_played, games_won,
             total_messages, total_winnings, gaming, level, username, guild_id, active_badge
             FROM users WHERE id = ? AND guild_id = ?`
        ).get(target.id, guildId);
    }
    if (!userData && client.getOrCreateUser) {
        try { userData = client.getOrCreateUser(target.id, guildId, target.username); } catch(e) {}
    }
    if (!userData) return null;

    // ── Stats ──
    const xp            = userData.xp           ?? 0;
    const credits       = userData.credits       ?? 0;
    const streakDays    = userData.streak_days   ?? 0;
    const totalMessages = userData.total_messages?? 0;
    const gamesPlayed   = userData.games_played  ?? 0;
    const gamesWon      = userData.games_won     ?? 0;
    const totalWinnings = userData.total_winnings?? 0;
    const level         = userData.level         ?? calculateLevel(xp);
    const agentRank     = getAgentRank(level);
    const wealthTier    = getWealthTier(credits);
    const winRate       = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;

    // ── Server rank ──
    let serverRank = 1, totalUsers = 1;
    try {
        if (db && guild) {
            serverRank = ((db.prepare(`SELECT COUNT(*) as r FROM users WHERE xp > ? AND guild_id = ?`).get(xp, guildId)?.r) || 0) + 1;
            totalUsers  = db.prepare(`SELECT COUNT(*) as c FROM users WHERE guild_id = ?`).get(guildId)?.c || 1;
        }
    } catch(e) {}

    // ── XP progress ──
    const curLvlXP = Math.pow((level-1)/0.1, 2);
    const nxtLvlXP = Math.pow(level/0.1, 2);
    const xpPct    = nxtLvlXP > curLvlXP ? Math.min(100, ((xp - curLvlXP) / (nxtLvlXP - curLvlXP)) * 100) : 100;
    const xpRemain = Math.max(0, Math.ceil(nxtLvlXP - xp));

    // ── Credits progress ──
    const nextWealth = WEALTH_TIERS.find(t => t.minCredits > credits);
    let creditsPct = 100;
    if (nextWealth) {
        const prev = WEALTH_TIERS[WEALTH_TIERS.indexOf(nextWealth)-1]?.minCredits || 0;
        creditsPct = Math.min(100, ((credits - prev) / (nextWealth.minCredits - prev)) * 100);
    }

    // ── Member info ──
    let highestRole = 'Member', memberDays = 0;
    try {
        const member = guild?.members.cache.get(target.id);
        if (member) {
            highestRole = member.roles.highest.name !== '@everyone' ? member.roles.highest.name : 'Member';
            memberDays = Math.floor((Date.now() - (member.joinedAt?.getTime() || Date.now())) / 86400000);
        }
    } catch(e) {}

    // ── Gaming data ──
    let gamingData = { game: 'CODM', rank: 'Unranked', mode: 'Standard' };
    try { if (userData.gaming) gamingData = JSON.parse(userData.gaming); } catch(e) {}

    // ── Active badge ──
    const activeBadge = userData.active_badge || null;
    let badgeName = 'None equipped';
    if (activeBadge) {
        const item = shopItems?.find(i => i.id === activeBadge);
        badgeName = item ? (item.en?.name || item.name || activeBadge) : activeBadge;
    }

    const rankColor = agentRank.color;
    const rankTitle = agentRank.title[lang] || agentRank.title.en;

    // ══════════════════════════════════════════════════════
    // CANVAS
    // ══════════════════════════════════════════════════════
    const SCALE = 2;
    const canvas = createCanvas(W * SCALE, H * SCALE);
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);

    // Background
    let bgPath = null;
    // Check user custom bg (per-server isolation)
    const userBgPath = path.join(BG_DIR, 'users', guildId, `${target.id}.jpg`);
    if (userData.profile_bg && fs.existsSync(userData.profile_bg)) {
        bgPath = userData.profile_bg;
    } else if (fs.existsSync(userBgPath)) {
        bgPath = userBgPath;
    } else {
        // Seeded preset — same user always gets same bg, different per user
        const seed = parseInt(target.id.slice(-4), 16) % BG_PRESETS.length;
        bgPath = BG_PRESETS[seed];
    }
    try {
        const bgImg = await loadImage(bgPath);
        // Draw bg image scaled to fill
        const scale = Math.max(W / bgImg.width, H / bgImg.height);
        const bw = bgImg.width * scale, bh = bgImg.height * scale;
        const bx = (W - bw) / 2, by = (H - bh) / 2;
        ctx.drawImage(bgImg, bx, by, bw, bh);
    } catch(e) {
        // Fallback solid bg
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, W, H);
    }
    // Dark overlay for text readability
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(0, 0, W, H);
    // Draw circuit pattern on top of overlay
    drawBackground(ctx, rankColor);

    // ── Avatar ──
    try {
        const avatarURL = target.displayAvatarURL({ extension: 'png', size: 512 });
        const avatar = await loadImage(avatarURL);

        // Rank glow behind avatar
        ctx.shadowColor = rankColor;
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.arc(AVATAR_X + AVATAR_SIZE/2, AVATAR_Y + AVATAR_SIZE/2, AVATAR_SIZE/2 + 4, 0, Math.PI*2);
        ctx.fillStyle = hexToRgba(rankColor, 0.3);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Rank color ring
        ctx.beginPath();
        ctx.arc(AVATAR_X + AVATAR_SIZE/2, AVATAR_Y + AVATAR_SIZE/2, AVATAR_SIZE/2 + 4, 0, Math.PI*2);
        ctx.strokeStyle = rankColor;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Clip avatar to circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(AVATAR_X + AVATAR_SIZE/2, AVATAR_Y + AVATAR_SIZE/2, AVATAR_SIZE/2, 0, Math.PI*2);
        ctx.clip();
        ctx.drawImage(avatar, AVATAR_X, AVATAR_Y, AVATAR_SIZE, AVATAR_SIZE);
        ctx.restore();
    } catch(e) {
        // Fallback circle
        ctx.beginPath();
        ctx.arc(AVATAR_X + AVATAR_SIZE/2, AVATAR_Y + AVATAR_SIZE/2, AVATAR_SIZE/2, 0, Math.PI*2);
        ctx.fillStyle = hexToRgba(rankColor, 0.3);
        ctx.fill();
    }

    // ── Level badge on avatar ──
    const badgeX = AVATAR_X + AVATAR_SIZE - 20, badgeY = AVATAR_Y + AVATAR_SIZE - 20;
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, 18, 0, Math.PI*2);
    ctx.fillStyle = '#0a0a1a';
    ctx.fill();
    ctx.strokeStyle = rankColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = 'bold 13px DejaVuBold';
    ctx.fillStyle = rankColor;
    ctx.textAlign = 'center';
    ctx.fillText(`${level}`, badgeX, badgeY + 5);
    ctx.textAlign = 'left';

    // ── Server rank badge (top right of avatar) ──
    const rkX = AVATAR_X, rkY = AVATAR_Y - 2;
    roundRect(ctx, rkX, rkY - 16, 65, 18, 4);
    ctx.fillStyle = hexToRgba(rankColor, 0.2);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(rankColor, 0.6);
    ctx.lineWidth = 1;
    roundRect(ctx, rkX, rkY - 16, 65, 18, 4);
    ctx.stroke();
    ctx.font = '10px DejaVuMonoBold';
    ctx.fillStyle = rankColor;
    ctx.textAlign = 'center';
    ctx.fillText(`#${serverRank}/${totalUsers}`, rkX + 32, rkY - 3);
    ctx.textAlign = 'left';

    // ── Top right dark backing ──
    roundRect(ctx, 230, 30, W - 260, 340, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fill();
    roundRect(ctx, 230, 30, W - 260, 340, 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // ── Username ──
    const nameX = 240, nameY = 65;
    ctx.font = 'bold 28px DejaVuBold';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(target.username.substring(0, 18), nameX, nameY);

    // ── Rank title pill ──
    const rankText = rankTitle;
    ctx.font = '12px DejaVuMonoBold';
    const rankW = ctx.measureText(rankText).width + 20;
    roundRect(ctx, nameX, nameY + 8, rankW, 22, 11);
    ctx.fillStyle = hexToRgba(rankColor, 0.2);
    ctx.fill();
    roundRect(ctx, nameX, nameY + 8, rankW, 22, 11);
    ctx.strokeStyle = hexToRgba(rankColor, 0.7);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = rankColor;
    ctx.fillText(rankText, nameX + 10, nameY + 23);

    // ── Wealth tier pill ──
    const wealthText = `${wealthTier.title[lang] || wealthTier.title.en}`;
    const wealthW = ctx.measureText(wealthText).width + 20;
    roundRect(ctx, nameX + rankW + 10, nameY + 8, wealthW, 22, 11);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    roundRect(ctx, nameX + rankW + 10, nameY + 8, wealthW, 22, 11);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(wealthText, nameX + rankW + 20, nameY + 23);

    // ── XP Bar ──
    const barX = nameX, barY = nameY + 42;
    const barW = 420, barH = 14;
    ctx.font = '11px DejaVuMono';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText(`XP  ${xp.toLocaleString()}  •  ${xpRemain.toLocaleString()} to Lv.${level+1}`, barX, barY - 2);
    drawBar(ctx, barX, barY + 4, barW, barH, xpPct, rankColor);

    // ── Credits Bar ──
    const cBarY = barY + 36;
    ctx.font = '11px DejaVuMono';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    const nextWealthLabel = nextWealth ? `→ ${nextWealth.title[lang] || nextWealth.title.en}` : '✦ MAX TIER';
    ctx.fillText(`CREDITS  ${credits.toLocaleString()} 🪙  ${nextWealthLabel}`, barX, cBarY - 2);
    drawBar(ctx, barX, cBarY + 4, barW, barH, creditsPct, '#f1c40f');

    // ── Divider ──
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(240, nameY + 95);
    ctx.lineTo(W - 30, nameY + 95);
    ctx.stroke();

    // ── Stats grid (6 boxes) ──
    const statsY = nameY + 110;
    const boxW = 100, boxH = 58, boxGap = 12;
    const statsStartX = nameX;

    const stats = [
        { label: lang === 'fr' ? 'Parties' : 'Games',    value: gamesPlayed.toLocaleString() },
        { label: lang === 'fr' ? 'Victoires' : 'Wins',   value: gamesWon.toLocaleString() },
        { label: lang === 'fr' ? 'Taux' : 'Win Rate',    value: `${winRate}%` },
        { label: lang === 'fr' ? 'Série' : 'Streak',     value: `${streakDays}d` },
        { label: lang === 'fr' ? 'Messages' : 'Messages',value: totalMessages >= 1000 ? `${(totalMessages/1000).toFixed(1)}k` : totalMessages.toString() },
        { label: lang === 'fr' ? 'Gains' : 'Winnings',   value: totalWinnings >= 1000 ? `${(totalWinnings/1000).toFixed(1)}k` : totalWinnings.toString() },
    ];

    stats.forEach((s, i) => {
        drawStatBox(ctx, statsStartX + i * (boxW + boxGap), statsY, boxW, boxH, s.label, s.value, rankColor);
    });

    // ── Left panel dark backing ──
    roundRect(ctx, 18, 200, 195, 280, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fill();
    roundRect(ctx, 18, 200, 195, 280, 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // ── Left panel: Identity + Gaming ──
    const leftX = 30, leftY = 210;

    ctx.font = '10px DejaVuMonoBold';
    ctx.fillStyle = hexToRgba(rankColor, 0.8);
    ctx.fillText('IDENTITY', leftX, leftY);

    const idLines = [
        { label: 'ROLE', value: highestRole.substring(0, 12) },
        { label: 'MEMBER', value: `${memberDays}d` },
        { label: 'ID', value: `${target.id.slice(0,8)}...` },
    ];
    idLines.forEach((l, i) => {
        const ly = leftY + 18 + i * 20;
        ctx.font = '10px DejaVuMono';
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillText(l.label, leftX, ly);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(l.value, leftX + 60, ly);
    });

    // Divider
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.moveTo(leftX, leftY + 80); ctx.lineTo(200, leftY + 80); ctx.stroke();

    // Gaming
    ctx.font = '10px DejaVuMonoBold';
    ctx.fillStyle = hexToRgba(rankColor, 0.8);
    ctx.fillText('GAMING', leftX, leftY + 96);

    const gameLines = [
        { label: 'GAME',  value: (gamingData.game || 'CODM').substring(0,10) },
        { label: 'MODE',  value: (gamingData.mode || 'Standard').substring(0,10) },
        { label: 'RANK',  value: (gamingData.rank || 'Unranked').substring(0,10) },
    ];
    gameLines.forEach((l, i) => {
        const ly = leftY + 114 + i * 20;
        ctx.font = '10px DejaVuMono';
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillText(l.label, leftX, ly);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(l.value, leftX + 60, ly);
    });

    // Divider
    ctx.beginPath(); ctx.moveTo(leftX, leftY + 178); ctx.lineTo(200, leftY + 178); ctx.stroke();

    // Badge
    ctx.font = '10px DejaVuMonoBold';
    ctx.fillStyle = hexToRgba(rankColor, 0.8);
    ctx.fillText('EMBLEM', leftX, leftY + 194);
    ctx.font = '11px DejaVuMono';
    ctx.fillStyle = activeBadge ? '#f1c40f' : 'rgba(255,255,255,0.3)';
    ctx.fillText(badgeName.substring(0, 16), leftX, leftY + 212);

    // ── Architect badge ──
    if (target.id === process.env.OWNER_ID) {
        roundRect(ctx, nameX, statsY + boxH + 14, 200, 28, 6);
        ctx.fillStyle = 'rgba(241,196,15,0.1)';
        ctx.fill();
        roundRect(ctx, nameX, statsY + boxH + 14, 200, 28, 6);
        ctx.strokeStyle = 'rgba(241,196,15,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.font = 'bold 12px DejaVuBold';
        ctx.fillStyle = '#f1c40f';
        ctx.textAlign = 'center';
        ctx.fillText('🏛️ ARCHITECT // SYSTEM CREATOR', nameX + 100, statsY + boxH + 32);
        ctx.textAlign = 'left';
    }

    // ── Footer ──
    ctx.font = '10px DejaVuMono';
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillText(`ARCHON CG-223  //  BAMAKO_223 🇲🇱  //  NEURAL GRID`, 30, H - 14);
    ctx.textAlign = 'right';
    ctx.fillText(`${new Date().toISOString().slice(0,10)}`, W - 30, H - 14);
    ctx.textAlign = 'left';

    return canvas.toBuffer('image/png');
}

// ══════════════════════════════════════════════════════════════
// MODULE
// ══════════════════════════════════════════════════════════════
module.exports = {
    name: 'profile',
    aliases: ['p', 'identifiant', 'userinfo', 'agent', 'profil'],
    description: '📋 Complete Agent Dossier — classified neural statistics.',
    category: 'PROFILE',
    usage: '.profile [@user]',
    cooldown: 3000,
    examples: ['.profile', '.profile @user', '.p @agent'],

    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('📋 Display classified agent dossier with neural statistics')
        .addUserOption(o => o.setName('agent').setDescription('Agent to inspect').setRequired(false)),

    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        try {
            const guildId = message.guild?.id || 'DM';
            const guild   = message.guild;
            const language = client.detectLanguage ? client.detectLanguage(usedCommand || 'profile', guildId) : (lang || 'en');
            let target = message.author;
            if (args[0] && message.mentions?.users?.size > 0) target = message.mentions.users.first();
            else if (args[0] && guild) target = guild.members.cache.get(args[0])?.user || message.author;

            const typing = await message.channel.sendTyping().catch(() => {});
            const buffer = await buildProfileCard(target, client, db, guildId, guild, language);
            if (!buffer) return message.reply(`❌ No data found for **${target.username}**.`).catch(() => {});

            const attachment = new AttachmentBuilder(buffer, { name: `profile-${target.username}.png` });
            await message.reply({ files: [attachment] }).catch(() => {});
        } catch(err) {
            console.error('[PROFILE]', err);
            message.reply('⚠️ Neural link error. Contact the Architect.').catch(() => {});
        }
    },

    execute: async (interaction, client) => {
        try {
            const guildId = interaction.guild?.id || 'DM';
            const guild   = interaction.guild;
            const serverLang = client.getServerSettings?.(guildId)?.language;
            const lang = serverLang === 'fr' ? 'fr' : (interaction.locale?.startsWith('fr') ? 'fr' : 'en');
            const db     = client.db;
            const target = interaction.options.getUser('agent') || interaction.user;

            await interaction.deferReply();
            const buffer = await buildProfileCard(target, client, db, guildId, guild, lang);
            if (!buffer) return interaction.editReply(`❌ No data found for **${target.username}**.`);

            const attachment = new AttachmentBuilder(buffer, { name: `profile-${target.username}.png` });
            await interaction.editReply({ files: [attachment] });
        } catch(err) {
            console.error('[PROFILE SLASH]', err);
            interaction.editReply('⚠️ Neural link error.').catch(() => {});
        }
    }
};
