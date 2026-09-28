const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const nodePath = require('path');

// Extracted from vote.js — canvas leaderboard renderer (labels stay EN:
// no CJK font registered; decorative stats image).
// ================= VOTE LEADERBOARD CANVAS =================
const VOTE_LB_BG = nodePath.join(__dirname, '../assets/backgrounds/lb_bg.jpg');
const VOTE_FONTS_DIR = nodePath.join(__dirname, '../assets/fonts');

function loadVoteFonts() {
    try {
        GlobalFonts.registerFromPath(nodePath.join(VOTE_FONTS_DIR, 'DejaVuSans-Bold.ttf'), 'DejaVuBold');
        GlobalFonts.registerFromPath(nodePath.join(VOTE_FONTS_DIR, 'DejaVuSansMono.ttf'), 'DejaVuMono');
        GlobalFonts.registerFromPath(nodePath.join(VOTE_FONTS_DIR, 'DejaVuSansMono-Bold.ttf'), 'DejaVuMonoBold');
    } catch(e) {}
}
loadVoteFonts();

function roundRectVote(ctx, x, y, w, h, r) {
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

async function buildVoteLBCanvas(entries, guildName, botAvatarURL) {
    const W = 820;
    const HEADER_H = 100;
    const ROW_H = 52;
    const FOOTER_H = 50;
    const TOP = Math.min(entries.length, 10);
    const H = HEADER_H + TOP * ROW_H + FOOTER_H;
    const SCALE = 2;

    const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];
    const MEDAL_LABELS = ['#1', '#2', '#3'];

    const canvas = createCanvas(W * SCALE, H * SCALE);
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);

    // Background
    try {
        const bgImg = await loadImage(VOTE_LB_BG);
        const scale = Math.max(W / bgImg.width, H / bgImg.height);
        const bw = bgImg.width * scale, bh = bgImg.height * scale;
        const bx = (W - bw) / 2, by = (H - bh) / 2;
        ctx.drawImage(bgImg, bx, by, bw, bh);
    } catch(e) {
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, W, H);
    }

    // Dark warm overlay
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, W, H);

    // Warm grid lines
    ctx.strokeStyle = 'rgba(255,215,0,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 45) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y < H; y += 45) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    // Header gradient — warm gold
    const headerGrad = ctx.createLinearGradient(0, 0, W, 0);
    headerGrad.addColorStop(0, 'rgba(255,215,0,0.06)');
    headerGrad.addColorStop(0.5, 'rgba(255,215,0,0.14)');
    headerGrad.addColorStop(1, 'rgba(255,215,0,0.06)');
    ctx.fillStyle = headerGrad;
    ctx.fillRect(0, 0, W, HEADER_H);

    // Top accent line — gold
    const accentGrad = ctx.createLinearGradient(0, 0, W, 0);
    accentGrad.addColorStop(0, 'transparent');
    accentGrad.addColorStop(0.3, '#FFD700');
    accentGrad.addColorStop(0.7, '#FFD700');
    accentGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = accentGrad;
    ctx.fillRect(0, 0, W, 3);

    // Bot avatar in header
    try {
        const avatarImg = await loadImage(botAvatarURL);
        ctx.save();
        ctx.beginPath();
        ctx.arc(45, 50, 30, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatarImg, 15, 20, 60, 60);
        ctx.restore();
        // Gold ring around avatar
        ctx.beginPath();
        ctx.arc(45, 50, 31, 0, Math.PI * 2);
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.stroke();
    } catch(e) {
        ctx.font = 'bold 36px DejaVuBold';
        ctx.fillStyle = '#FFD700';
        ctx.textAlign = 'left';
        ctx.fillText('#', 25, 65);
    }

    // Title
    ctx.font = 'bold 26px DejaVuBold';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Top Voters', 90, 52);

    // Subtitle
    ctx.font = '13px DejaVuMono';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`${guildName.substring(0, 35)} · Top ${TOP} supporters`, 90, 78);

    // Right side — voter count
    ctx.textAlign = 'right';
    ctx.font = '12px DejaVuMono';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText(`${TOP} voters`, W - 25, 55);
    ctx.fillText('BAMAKO_223 [ML]', W - 25, 75);
    ctx.textAlign = 'left';

    // Column headers
    const colY = HEADER_H - 14;
    ctx.font = '10px DejaVuMono';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText('RANK', 15, colY);
    ctx.fillText('VOTER', 110, colY);
    ctx.fillText('VOTES', 490, colY);
    ctx.fillText('STREAK', 590, colY);
    ctx.fillText('EARNED', 710, colY);

    // Rows
    for (let i = 0; i < TOP; i++) {
        const entry = entries[i];
        const rowY = HEADER_H + i * ROW_H;
        const centerY = rowY + ROW_H / 2;

        // Row bg
        if (i < 3) {
            roundRectVote(ctx, 8, rowY + 4, W - 16, ROW_H - 8, 8);
            ctx.fillStyle = `rgba(${i===0?'255,215,0':i===1?'192,192,192':'205,127,50'},0.08)`;
            ctx.fill();
            roundRectVote(ctx, 8, rowY + 4, W - 16, ROW_H - 8, 8);
            ctx.strokeStyle = `rgba(${i===0?'255,215,0':i===1?'192,192,192':'205,127,50'},0.3)`;
            ctx.lineWidth = 1;
            ctx.stroke();
        } else if (i % 2 === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.02)';
            ctx.fillRect(8, rowY + 4, W - 16, ROW_H - 8);
        }

        // Rank medal
        if (i < 3) {
            ctx.font = 'bold 16px DejaVuBold';
            ctx.fillStyle = MEDAL_COLORS[i];
            ctx.textAlign = 'center';
            ctx.fillText(MEDAL_LABELS[i], 42, centerY + 6);
        } else {
            ctx.font = '12px DejaVuMono';
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.textAlign = 'center';
            ctx.fillText(`#${i+1}`, 42, centerY + 5);
        }
        ctx.textAlign = 'left';

        // Username
        const nameColor = i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#ffffff';
        ctx.font = i < 3 ? 'bold 14px DejaVuBold' : '13px DejaVuMono';
        ctx.fillStyle = nameColor;
        const displayName = (entry.username || 'Unknown').substring(0, 20);
        ctx.fillText(displayName, 110, centerY + 5);

        // Votes
        ctx.font = 'bold 13px DejaVuMonoBold';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`${entry.total_votes}`, 490, centerY + 5);

        // Streak
        ctx.font = '12px DejaVuMono';
        ctx.fillStyle = entry.current_streak > 0 ? '#ff6b35' : 'rgba(255,255,255,0.3)';
        ctx.fillText(`${entry.current_streak}d`, 590, centerY + 5);

        // Earned credits
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(`${(entry.total_rewards || 0).toLocaleString()}`, 710, centerY + 5);
    }

    // Footer
    const footerY = HEADER_H + TOP * ROW_H;
    ctx.fillStyle = 'rgba(255,215,0,0.06)';
    ctx.fillRect(0, footerY, W, FOOTER_H);

    const footerAccent = ctx.createLinearGradient(0, 0, W, 0);
    footerAccent.addColorStop(0, 'transparent');
    footerAccent.addColorStop(0.3, 'rgba(255,215,0,0.4)');
    footerAccent.addColorStop(0.7, 'rgba(255,215,0,0.4)');
    footerAccent.addColorStop(1, 'transparent');
    ctx.fillStyle = footerAccent;
    ctx.fillRect(0, footerY, W, 1);

    ctx.font = '11px DejaVuMono';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.textAlign = 'center';
    ctx.fillText(`ARCHON CG-223 • Vote Leaderboard • ${new Date().toLocaleDateString()}`, W/2, footerY + 30);

    return canvas.toBuffer('image/png');
}

module.exports = { buildVoteLBCanvas };
