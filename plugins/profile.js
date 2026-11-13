const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const em = (k, fb) => { try { return require('../config/emojis')[k] || fb; } catch { return fb; } };
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

// Ranks: the same tiers and names as the games (lib/games/progress.js, gameui.json → ranks.*)
const progress = require('../lib/games/progress');
const WEALTH_TIERS = [
    { minCredits: 0, key: 'broke' }, { minCredits: 100, key: 'small' }, { minCredits: 1000, key: 'collector' },
    { minCredits: 5000, key: 'investor' }, { minCredits: 15000, key: 'baron' }, { minCredits: 50000, key: 'magnate' },
    { minCredits: 100000, key: 'legend' },
];
const { t } = require('../lib/i18n');
const P = (k, lang, v) => t(`profile.${k}`, lang, v || {});
// DejaVu first, then system fonts for Chinese and Arabic names and labels
const FONT = (weight, size, family) => `${weight ? weight + ' ' : ''}${size}px ${family}, "Noto Sans CJK SC", "Noto Sans Arabic", "DejaVu Sans", sans-serif`;
// canvas text can't draw colour emojis: they are taken out of names and roles
const noEmoji = (str) => String(str || '').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').replace(/\s{2,}/g, ' ').trim();
const fit = (ctx, str, max) => { let x = String(str); while (x.length > 1 && ctx.measureText(x).width > max) x = x.slice(0, -2) + '…'; return x; };
function calculateLevel(xp) { return progress.levelFromXp(xp); }
function getAgentRank(level) { const r = progress.rankForLevel(level); return { key: r.key, color: '#' + r.color.toString(16).padStart(6, '0') }; }
function getWealthTier(credits) { return [...WEALTH_TIERS].reverse().find(w => (credits || 0) >= w.minCredits) || WEALTH_TIERS[0]; }
function duration(days, lang) {
    if (days < 1) return P('dToday', lang);
    if (days < 31) return P('dDays', lang, { n: days });
    if (days < 365) return P('dMonths', lang, { n: Math.floor(days / 30) });
    return P('dYears', lang, { n: Math.floor(days / 365) });
}
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
    ctx.font = FONT('', 11, 'DejaVuMono');
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.textAlign = 'center';
    ctx.fillText(fit(ctx, label.toUpperCase(), w - 8), x + w/2, y + 18);

    // Value
    ctx.font = FONT('bold', 15, 'DejaVuBold');
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
    let highestRole = P('member', lang), memberDays = 0;
    try {
        const member = guild?.members.cache.get(target.id) || await guild?.members.fetch(target.id).catch(() => null);
        if (member) {
            if (member.roles.highest && member.roles.highest.id !== guild.id) highestRole = noEmoji(member.roles.highest.name) || highestRole;
            memberDays = Math.floor((Date.now() - (member.joinedAt?.getTime() || Date.now())) / 86400000);
        }
    } catch(e) {}

    // ── Gaming data (null when the member never used /setgame: nothing made up) ──
    let gamingData = null;
    // new members get {"game":"CODM","rank":"Unranked"} as a placeholder; only that exact placeholder counts as not set
    try { const g = userData.gaming ? JSON.parse(userData.gaming) : null; const placeholder = g && g.game === 'CODM' && g.rank === 'Unranked' && !g.mode && !g.timestamp && !g.lastUpdated; if (g && g.game && !placeholder) gamingData = g; } catch(e) {}

    // ── Active badge ──
    const activeBadge = userData.active_badge || null;
    let badgeName = P('noEmblem', lang);
    if (activeBadge) {
        const item = shopItems?.find(i => i.id === activeBadge);
        badgeName = noEmoji(item ? (item[lang]?.name || item.en?.name || item.name || activeBadge) : activeBadge);
    }

    const rankColor = agentRank.color;
    const rankTitle = t(`gameui.ranks.${agentRank.key}`, lang).toLocaleUpperCase(lang);

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
    let customBg = null;
    try { customBg = db?.prepare('SELECT profile_bg FROM users WHERE id = ? AND guild_id = ?').get(target.id, guildId)?.profile_bg || null; } catch (e) { /* no profile_bg column yet */ }
    if (customBg && fs.existsSync(customBg)) {
        bgPath = customBg;
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
    ctx.font = FONT('bold', 28, 'DejaVuBold');
    ctx.fillStyle = '#ffffff';
    ctx.fillText(fit(ctx, noEmoji(target.globalName || target.username) || target.username, W - 270), nameX, nameY);

    // ── Rank title pill ──
    const rankText = rankTitle;
    ctx.font = FONT('', 12, 'DejaVuMonoBold');
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
    const wealthText = P(`wealth_${wealthTier.key}`, lang).toLocaleUpperCase(lang);
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
    const nf = (n) => Number(n || 0).toLocaleString(lang === 'zh' ? 'zh-CN' : lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr-FR' : 'en-US');
    const barX = nameX, barY = nameY + 42;
    const barW = 420, barH = 14;
    ctx.font = FONT('', 11, 'DejaVuMono');
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(P('xpLine', lang, { xp: nf(xp), left: nf(xpRemain), next: level + 1 }), barX, barY - 2);
    drawBar(ctx, barX, barY + 4, barW, barH, xpPct, rankColor);

    // ── Credits Bar ──
    const cBarY = barY + 36;
    ctx.font = FONT('', 11, 'DejaVuMono');
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(nextWealth ? P('creditsLine', lang, { credits: nf(credits), tier: P(`wealth_${nextWealth.key}`, lang) }) : P('creditsMax', lang, { credits: nf(credits) }), barX, cBarY - 2);
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
    const boxW = 92, boxH = 62, boxGap = 8;
    const statsStartX = nameX;
    const short = (n) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
    const stats = [
        { label: P('games', lang), value: nf(gamesPlayed) },
        { label: P('wins', lang), value: nf(gamesWon) },
        { label: P('winRate', lang), value: `${winRate}%` },
        { label: P('streak', lang), value: P('dDays', lang, { n: streakDays }) },
        { label: P('messages', lang), value: short(totalMessages) },
        { label: P('winnings', lang), value: short(totalWinnings) },
    ];
    stats.forEach((st, i) => {
        drawStatBox(ctx, statsStartX + i * (boxW + boxGap), statsY, boxW, boxH, st.label, st.value, rankColor);
    });

    // ── Left panel dark backing ──
    roundRect(ctx, 18, 200, 195, 280, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fill();
    roundRect(ctx, 18, 200, 195, 280, 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // ── Left panel: label on the left, value on the right, each cut to fit ──
    const leftX = 30, leftY = 222, rightX = 200;
    const heading = (txt, y) => { ctx.font = FONT('bold', 13, 'DejaVuMonoBold'); ctx.fillStyle = hexToRgba(rankColor, 0.9); ctx.textAlign = 'left'; ctx.fillText(txt, leftX, y); };
    const row = (label, value, y, dim) => {
        ctx.font = FONT('', 12, 'DejaVuMono');
        ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,0.45)';
        const l = fit(ctx, label, 95); ctx.fillText(l, leftX, y);
        ctx.textAlign = 'right'; ctx.fillStyle = dim ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.95)';
        ctx.fillText(fit(ctx, value, rightX - leftX - ctx.measureText(l).width - 10), rightX, y);
        ctx.textAlign = 'left';
    };
    const divider = (y) => { ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.beginPath(); ctx.moveTo(leftX, y); ctx.lineTo(rightX, y); ctx.stroke(); };

    heading(P('identity', lang), leftY);
    row(P('role', lang), highestRole, leftY + 22);
    row(P('since', lang), duration(memberDays, lang), leftY + 44);
    divider(leftY + 62);

    heading(P('gaming', lang), leftY + 84);
    if (gamingData) {
        row(P('game', lang), noEmoji(gamingData.game), leftY + 106);
        row(P('mode', lang), noEmoji(gamingData.mode) || '—', leftY + 128);
        row(P('rank', lang), noEmoji(gamingData.rank) || '—', leftY + 150);
    } else {
        row(P('game', lang), P('gameNotSet', lang), leftY + 106, true);
        ctx.font = FONT('', 11, 'DejaVuMono'); ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillText(P('gameHint', lang), leftX, leftY + 128);
    }
    divider(leftY + 168);

    heading(P('emblem', lang), leftY + 190);
    ctx.font = FONT('', 12, 'DejaVuMono');
    ctx.fillStyle = activeBadge ? '#f1c40f' : 'rgba(255,255,255,0.35)';
    ctx.fillText(fit(ctx, badgeName, rightX - leftX), leftX, leftY + 212);

    // ── Architect badge ──
    if (target.id === process.env.OWNER_ID) {
        ctx.font = FONT('bold', 12, 'DejaVuBold');
        const aw = ctx.measureText(P('architect', lang)).width + 30;
        roundRect(ctx, nameX, statsY + boxH + 14, aw, 28, 6);
        ctx.fillStyle = 'rgba(241,196,15,0.1)';
        ctx.fill();
        roundRect(ctx, nameX, statsY + boxH + 14, aw, 28, 6);
        ctx.strokeStyle = 'rgba(241,196,15,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#f1c40f';
        ctx.textAlign = 'center';
        ctx.fillText(P('architect', lang), nameX + aw / 2, statsY + boxH + 32);
        ctx.textAlign = 'left';
    }

    // ── Footer ──
    ctx.font = FONT('', 10, 'DejaVuMono');
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillText('ARCHON CG-223  ·  BAMAKO_223', 30, H - 14);
    ctx.textAlign = 'right';
    ctx.fillText(`${new Date().toISOString().slice(0,10)}`, W - 30, H - 14);
    ctx.textAlign = 'left';

    return canvas.toBuffer('image/png');
}

// ══════════════════════════════════════════════════════════════
// CARD: the picture in a Components V2 card, with buttons
// ══════════════════════════════════════════════════════════════
const LANGS = ['en', 'fr', 'zh', 'ar'];
const langFor = (client, guildId, where, userId) => {
    const l = require('../lib/pick-lang').pickLang(client, guildId, where, userId);
    return LANGS.includes(l) ? l : 'en';
};

// The message for one member's profile. own: the viewer is that member (Inventory and My game buttons).
// Returns null when the member has no data on this server.
async function profileMessage(client, guild, target, lang, own) {
    const { ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
    const { icon } = require('../lib/ui/icons');
    const guildId = guild?.id || 'DM';
    const buffer = await buildProfileCard(target, client, client.db, guildId, guild, lang);
    if (!buffer) return null;
    let accent = 0x3498db;
    try {
        const d = client.db?.prepare('SELECT xp, level FROM users WHERE id = ? AND guild_id = ?').get(target.id, guildId) || {};
        accent = progress.rankForLevel(d.level || progress.levelFromXp(d.xp)).color;
    } catch (e) { /* default colour */ }
    const c = new ContainerBuilder().setAccentColor(accent)
        .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL('attachment://profile.png')))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${P('cardLine', lang, { user: `<@${target.id}>`, guild: guild?.name || 'ARCHON' })}`));
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prof:lb').setLabel(P('btnBoard', lang)).setStyle(ButtonStyle.Secondary).setEmoji(icon('trophy', guild)));
    if (own) row.addComponents(
        new ButtonBuilder().setCustomId(`prof:inv:${target.id}`).setLabel(P('btnInventory', lang)).setStyle(ButtonStyle.Secondary).setEmoji(icon('inventory', guild)),
        new ButtonBuilder().setCustomId(`prof:game:${target.id}`).setLabel(P('btnGame', lang)).setStyle(ButtonStyle.Secondary).setEmoji(icon('games', guild)));
    if (guild) c.addActionRowComponents(row);
    return { components: [c], files: [new AttachmentBuilder(buffer, { name: 'profile.png' })], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
}

// prof:lb (anyone: the XP leaderboard, just for them) · prof:inv:<id> and prof:game:<id> (only that member)
async function handleComponent(ix, client) {
    const { MessageFlags } = require('discord.js');
    const lang = langFor(client, ix.guildId, ix, ix.user.id);
    const [, action, ownerId] = ix.customId.split(':');
    const say = (content) => ix.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }).catch(() => {});
    if (!ix.guild) return;
    if (action === 'lb') {
        const card = await require('./leaderboard').cardFor(client, ix.guild, ix.user.id, 'xp', lang, ix).catch(() => null);
        if (!card) return say(P('noBoard', lang));
        return ix.reply({ ...card, flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral, allowedMentions: { parse: [] } }).catch(() => {});
    }
    if (ownerId && ix.user.id !== ownerId) return say(P('notYours', lang, { user: `<@${ownerId}>` }));
    if (action === 'inv') {
        const view = require('./inventory').view(client, client.db, ix.user.id, lang, ix.guildId, ix.guild.name);
        return ix.reply({ ...view, flags: view.flags | MessageFlags.Ephemeral }).catch(() => {});
    }
    if (action === 'game') return require('./setgame').execute(ix, client);
}

// The welcome card's "My profile" button: the clicker's own profile, only for them
async function showOwn(ix, client) {
    const { MessageFlags } = require('discord.js');
    const lang = langFor(client, ix.guildId, ix, ix.user.id);
    await ix.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
    try {
        const msg = await profileMessage(client, ix.guild, ix.user, lang, true);
        return ix.editReply(msg || { content: P('noData', lang, { user: ix.user.username }) });
    } catch (e) {
        console.error('[PROFILE] own:', e.message);
        return ix.editReply({ content: P('failed', lang) }).catch(() => {});
    }
}

// ══════════════════════════════════════════════════════════════
// MODULE
// ══════════════════════════════════════════════════════════════
module.exports = {
    name: 'profile',
    aliases: ['p', 'identifiant', 'userinfo'],
    description: '📋 A member profile with level, credits and stats.',
    category: 'PROFILE',
    usage: '.profile [@user]',
    cooldown: 3000,
    examples: ['.profile', '.profile @user', '.p @agent'],

    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('📋 Show a member profile with level, credits and stats')
        .addUserOption(o => o.setName('agent').setDescription('Agent to inspect').setRequired(false)),

    handleComponent,
    showOwn,
    profileMessage,

    run: async (client, message, args) => {
        const guild = message.guild;
        const lang = langFor(client, guild?.id, message, message.author.id);
        try {
            let target = message.author;
            if (message.mentions?.users?.size > 0) target = message.mentions.users.first();
            else if (args[0] && guild) target = (await guild.members.fetch(String(args[0]).replace(/\D/g, '')).catch(() => null))?.user || message.author;
            await message.channel.sendTyping().catch(() => {});
            const msg = await profileMessage(client, guild, target, lang, target.id === message.author.id);
            if (!msg) return message.reply({ content: P('noData', lang, { user: target.username }), allowedMentions: { parse: [] } }).catch(() => {});
            await message.reply(msg).catch((e) => console.error('[PROFILE] send:', e.message));
        } catch (err) {
            console.error('[PROFILE]', err);
            message.reply(P('failed', lang)).catch(() => {});
        }
    },

    execute: async (interaction, client) => {
        const lang = langFor(client, interaction.guildId, interaction, interaction.user.id);
        try {
            const target = interaction.options.getUser('agent') || interaction.user;
            await interaction.deferReply();
            const msg = await profileMessage(client, interaction.guild, target, lang, target.id === interaction.user.id);
            if (!msg) return interaction.editReply({ content: P('noData', lang, { user: target.username }), allowedMentions: { parse: [] } });
            await interaction.editReply(msg);
        } catch (err) {
            console.error('[PROFILE SLASH]', err);
            interaction.editReply({ content: P('failed', lang) }).catch(() => {});
        }
    }
};
