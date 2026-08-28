const { SlashCommandBuilder } = require('discord.js');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

// ── Constants ──
const W = 900, H = 500;
const SCALE = 2;
const AVATAR_SIZE = 110;
const AVATAR_X = 40, AVATAR_Y = 40;
const BG_DIR = path.join(__dirname, '../assets/backgrounds');
const BG_PRESETS = [
    path.join(BG_DIR, 'bg1.jpg'),
    path.join(BG_DIR, 'bg2.jpg'),
    path.join(BG_DIR, 'bg3.jpg'),
    path.join(BG_DIR, 'bg4.jpg'),
    path.join(BG_DIR, 'bg5.jpg'),
];

// ================= UNIFIED AGENT RANKS =================
const AGENT_RANKS = [
    { minLevel: 1,  maxLevel: 5,        title: "NEURAL RECRUIT",   color: "#2ecc71", emoji: "🌱" },
    { minLevel: 6,  maxLevel: 15,       title: "FIELD AGENT",      color: "#3498db", emoji: "🔹" },
    { minLevel: 16, maxLevel: 30,       title: "CYBER SPECIALIST",  color: "#9b59b6", emoji: "💠" },
    { minLevel: 31, maxLevel: 50,       title: "BKO COMMANDER",    color: "#e67e22", emoji: "⚜️" },
    { minLevel: 51, maxLevel: Infinity, title: "SYSTEM ARCHITECT",  color: "#e74c3c", emoji: "👑" }
];

// ================= WEALTH TIERS =================
const WEALTH_TIERS = [
    { minCredits: 0,      title: "BROKE",      emoji: "💀", color: "#95a5a6" },
    { minCredits: 100,    title: "SMALL WALLET", emoji: "🪙", color: "#7f8c8d" },
    { minCredits: 1000,   title: "COLLECTOR",   emoji: "💰", color: "#f1c40f" },
    { minCredits: 5000,   title: "INVESTOR",    emoji: "📈", color: "#e67e22" },
    { minCredits: 15000,  title: "BARON",       emoji: "🏦", color: "#3498db" },
    { minCredits: 50000,  title: "MAGNATE",     emoji: "👑", color: "#9b59b6" },
    { minCredits: 100000, title: "LEGEND",      emoji: "🏆", color: "#e74c3c" }
];

function calculateLevel(xp) { return Math.floor(0.1 * Math.sqrt(xp || 0)) + 1; }
function getAgentRank(level) { return AGENT_RANKS.find(r => level >= r.minLevel && level <= r.maxLevel) || AGENT_RANKS[AGENT_RANKS.length - 1]; }
function getWealthTier(credits) { return [...WEALTH_TIERS].reverse().find(t => (credits || 0) >= t.minCredits) || WEALTH_TIERS[0]; }

function hexToRgba(hex, alpha = 1) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
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

// ── Draw circuit background ──
function drawBackground(ctx, rankColor) {
    ctx.strokeStyle = 'rgba(0,240,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i < W; i += 40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke();
    }
    for (let i = 0; i < H; i += 40) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,240,255,0.06)';
    [[120,80],[300,200],[500,120],[700,300],[820,180],[200,380],[600,420]].forEach(([x,y]) => {
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,240,255,0.04)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI*2); ctx.stroke();
    });
    const accent = ctx.createLinearGradient(0, 0, W, 0);
    accent.addColorStop(0, 'transparent');
    accent.addColorStop(0.3, hexToRgba(rankColor, 0.8));
    accent.addColorStop(0.7, hexToRgba(rankColor, 0.8));
    accent.addColorStop(1, 'transparent');
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, W, 4);
    ctx.fillStyle = accent;
    ctx.fillRect(0, H - 4, W, 4);
    // Left panel divider
    ctx.strokeStyle = hexToRgba(rankColor, 0.15);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(210, 20); ctx.lineTo(210, H - 20); ctx.stroke();
}

// ── Stat box ──
function drawStatBox(ctx, x, y, w, h, label, value, accentColor) {
    roundRect(ctx, x, y, w, h, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fill();
    roundRect(ctx, x, y, w, h, 8);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Accent top bar
    roundRect(ctx, x, y, w, 2, 1);
    ctx.fillStyle = accentColor;
    ctx.fill();
    // Label
    ctx.font = '11px DejaVuMono';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.textAlign = 'center';
    ctx.fillText(label.toUpperCase(), x + w / 2, y + 18);
    // Value
    ctx.font = 'bold 15px DejaVuMono';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(value), x + w / 2, y + h - 10);
}

// ── Progress bar ──
function drawProgressBar(ctx, x, y, w, h, percent, rankColor) {
    // Track
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    // Fill
    const fillW = Math.max(h, (percent / 100) * w);
    roundRect(ctx, x, y, fillW, h, h / 2);
    const grad = ctx.createLinearGradient(x, 0, x + fillW, 0);
    grad.addColorStop(0, hexToRgba(rankColor, 0.6));
    grad.addColorStop(1, rankColor);
    ctx.fillStyle = grad;
    ctx.fill();
}

// ── Main canvas render ──
async function buildRankCanvas(target, userData, rank, totalUsers, guildId, guildName, version, isArchitect) {
    const xp = userData.xp || 0;
    const level = userData.level || calculateLevel(xp);
    const agentRank = getAgentRank(level);
    const rankColor = agentRank.color;
    const credits = userData.credits || 0;
    const wealthTier = getWealthTier(credits);
    const streakDays = userData.streak_days || 0;
    const totalWinnings = userData.total_winnings || 0;
    const gamesPlayed = userData.games_played || 0;
    const gamesWon = userData.games_won || 0;
    const gamesLost = Math.max(0, gamesPlayed - gamesWon);
    const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
    const totalMessages = userData.total_messages || 0;
    const createdAt = userData.created_at ? new Date(userData.created_at) : new Date();
    const accountAgeDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const neuralEfficiency = Math.min(100, Math.floor((gamesPlayed * 0.5) + (totalMessages * 0.1) + (streakDays * 2)));

    let gamingData = { game: "CODM", rank: "Unranked", mode: "Standard" };
    if (userData.gaming) { try { gamingData = JSON.parse(userData.gaming); } catch (e) {} }

    // XP progress
    const currentLevelXP = Math.pow((level - 1) / 0.1, 2);
    const nextLevelXP = Math.pow(level / 0.1, 2);
    const xpForCurrentLevel = xp - currentLevelXP;
    const xpNeededForNext = nextLevelXP - currentLevelXP;
    const percent = xpNeededForNext > 0 ? Math.min(100, Math.max(0, (xpForCurrentLevel / xpNeededForNext) * 100)) : 100;
    const xpRemaining = Math.ceil(nextLevelXP - xp);

    const canvas = createCanvas(W * SCALE, H * SCALE);
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);

    // ── Background ──
    let bgPath = null;
    const userBgPath = path.join(BG_DIR, 'users', guildId, `${target.id}.jpg`);
    if (userData.profile_bg && fs.existsSync(userData.profile_bg)) {
        bgPath = userData.profile_bg;
    } else if (fs.existsSync(userBgPath)) {
        bgPath = userBgPath;
    } else {
        const seed = parseInt(target.id.slice(-4), 16) % BG_PRESETS.length;
        bgPath = BG_PRESETS[seed];
    }
    try {
        const bgImg = await loadImage(bgPath);
        const scale = Math.max(W / bgImg.width, H / bgImg.height);
        const bw = bgImg.width * scale, bh = bgImg.height * scale;
        const bx = (W - bw) / 2, by = (H - bh) / 2;
        ctx.drawImage(bgImg, bx, by, bw, bh);
    } catch (e) {
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, W, H);
    }

    // Dark overlay
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, W, H);

    // Circuit pattern
    drawBackground(ctx, rankColor);

    // ── Avatar ──
    try {
        const avatarURL = target.displayAvatarURL({ extension: 'png', size: 512 });
        const avatar = await loadImage(avatarURL);
        // Glow
        ctx.shadowColor = rankColor;
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.arc(AVATAR_X + AVATAR_SIZE / 2, AVATAR_Y + AVATAR_SIZE / 2, AVATAR_SIZE / 2 + 4, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(rankColor, 0.3);
        ctx.fill();
        ctx.shadowBlur = 0;
        // Ring
        ctx.beginPath();
        ctx.arc(AVATAR_X + AVATAR_SIZE / 2, AVATAR_Y + AVATAR_SIZE / 2, AVATAR_SIZE / 2 + 4, 0, Math.PI * 2);
        ctx.strokeStyle = rankColor;
        ctx.lineWidth = 3;
        ctx.stroke();
        // Clip circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(AVATAR_X + AVATAR_SIZE / 2, AVATAR_Y + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatar, AVATAR_X, AVATAR_Y, AVATAR_SIZE, AVATAR_SIZE);
        ctx.restore();
    } catch (e) {
        ctx.beginPath();
        ctx.arc(AVATAR_X + AVATAR_SIZE / 2, AVATAR_Y + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(rankColor, 0.3);
        ctx.fill();
    }

    // ── Left panel — identity ──
    const LX = AVATAR_X;
    const nameY = AVATAR_Y + AVATAR_SIZE + 18;

    // Username
    ctx.font = 'bold 16px DejaVuMono';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(target.username.toUpperCase(), LX, nameY);

    // Rank title badge
    const badgeY = nameY + 10;
    const badgeText = `${agentRank.emoji} ${agentRank.title}`;
    ctx.font = '11px DejaVuMono';
    const badgeW = ctx.measureText(badgeText).width + 16;
    roundRect(ctx, LX, badgeY, badgeW, 20, 4);
    ctx.fillStyle = hexToRgba(rankColor, 0.2);
    ctx.fill();
    roundRect(ctx, LX, badgeY, badgeW, 20, 4);
    ctx.strokeStyle = hexToRgba(rankColor, 0.5);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = rankColor;
    ctx.fillText(badgeText, LX + 8, badgeY + 14);

    // Wealth tier
    const wealthY = badgeY + 28;
    ctx.font = '11px DejaVuMono';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText(`${wealthTier.emoji} ${wealthTier.title}`, LX, wealthY);

    // Agent since
    ctx.font = '10px DejaVuMono';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText(`AGENT ${accountAgeDays}d AGO`, LX, wealthY + 18);

    // Architect tag
    if (isArchitect) {
        const archY = wealthY + 36;
        roundRect(ctx, LX, archY, 150, 18, 4);
        ctx.fillStyle = 'rgba(255,215,0,0.15)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,215,0,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.font = 'bold 10px DejaVuMono';
        ctx.fillStyle = '#FFD700';
        ctx.fillText('🏛️ SYSTEM ARCHITECT', LX + 8, archY + 13);
    }

    // ── Right panel ──
    const RX = 230;
    const RW = W - RX - 20;

    // Node header
    ctx.font = 'bold 11px DejaVuMono';
    ctx.fillStyle = hexToRgba(rankColor, 0.7);
    ctx.textAlign = 'left';
    ctx.fillText(`▸ ${guildName.toUpperCase()}`, RX, 28);

    ctx.font = '10px DejaVuMono';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText('NEURAL TELEMETRY', RX, 44);

    // Rank display — large
    ctx.font = 'bold 48px DejaVuMono';
    ctx.fillStyle = rankColor;
    ctx.textAlign = 'left';
    ctx.fillText(`#${rank}`, RX, 98);

    ctx.font = '13px DejaVuMono';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText(`of ${totalUsers} agents`, RX + 4, 116);

    // Level pill
    ctx.font = 'bold 13px DejaVuMono';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`LVL ${level}`, RX + 130, 98);

    ctx.font = '11px DejaVuMono';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText(`${xp.toLocaleString()} XP`, RX + 130, 116);

    // ── Progress bar ──
    const barY = 132;
    drawProgressBar(ctx, RX, barY, RW, 10, percent, rankColor);
    ctx.font = '10px DejaVuMono';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'left';
    ctx.fillText(`${percent.toFixed(1)}%`, RX, barY + 24);
    ctx.textAlign = 'right';
    ctx.fillText(`${xpRemaining.toLocaleString()} XP to next level`, RX + RW, barY + 24);

    // ── Stat boxes ──
    const statY = 172;
    const statH = 52;
    const cols = 5;
    const gap = 8;
    const statW = Math.floor((RW - gap * (cols - 1)) / cols);

    const stats = [
        { label: 'MESSAGES', value: totalMessages.toLocaleString() },
        { label: 'STREAK',   value: `${streakDays}d` },
        { label: 'WIN RATE', value: `${winRate}%` },
        { label: 'W/L',      value: `${gamesWon}/${gamesLost}` },
        { label: 'NEURAL',   value: `${neuralEfficiency}%` },
    ];

    stats.forEach((s, i) => {
        drawStatBox(ctx, RX + i * (statW + gap), statY, statW, statH, s.label, s.value, rankColor);
    });

    // ── Credits panel ──
    const credY = statY + statH + 12;
    const credW = Math.floor((RW - gap) / 2);
    roundRect(ctx, RX, credY, credW, 44, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fill();
    roundRect(ctx, RX, credY, credW, 44, 8);
    ctx.strokeStyle = hexToRgba(rankColor, 0.12);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = '10px DejaVuMono';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'left';
    ctx.fillText('CREDITS', RX + 10, credY + 16);
    ctx.font = 'bold 14px DejaVuMono';
    ctx.fillStyle = '#f1c40f';
    ctx.fillText(`${credits.toLocaleString()} 🪙`, RX + 10, credY + 34);

    // ── Combat panel ──
    const combatX = RX + credW + gap;
    const combatW = RW - credW - gap;
    roundRect(ctx, combatX, credY, combatW, 44, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fill();
    roundRect(ctx, combatX, credY, combatW, 44, 8);
    ctx.strokeStyle = hexToRgba(rankColor, 0.12);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = '10px DejaVuMono';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'left';
    ctx.fillText('COMBAT', combatX + 10, credY + 16);
    ctx.font = 'bold 11px DejaVuMono';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${gamingData.game} · ${gamingData.rank}`, combatX + 10, credY + 34);

    // ── Footer ──
    ctx.font = '10px DejaVuMono';
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.textAlign = 'left';
    ctx.fillText(`ARCHON CG-223 // ${guildName} // NEURAL GRID`, RX, H - 12);
    ctx.textAlign = 'right';
    ctx.fillText(`v${version} • ${new Date().toISOString().slice(0, 10)}`, W - 20, H - 12);

    return canvas.toBuffer('image/png');
}

module.exports = {
    name: 'rank',
    aliases: ['level', 'xp', 'rang', 'niveau', 'dossier', 'agent', 'profil', 'profile'],
    description: '📊 Display neural synchronization level and agent dossier.',
    category: 'PROFILE',
    usage: '.rank [@user] | /rank',
    cooldown: 3000,

    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('📊 Display neural synchronization level and agent dossier')
        .addUserOption(option =>
            option.setName('agent')
                .setDescription('Agent to inspect (leave empty for your own dossier)')
                .setRequired(false)),

    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        try {
            const guildId = message.guild?.id || 'DM';
            const guild = message.guild;
            const version = client.version || '3.1.0';
            const guildName = guild?.name?.toUpperCase() || 'NEURAL NODE';

            const target = message.mentions.users.first() || message.author;
            const userId = target.id;
            const userName = target.username;

            let userData = null;
            try { if (client.getUserData) userData = client.getUserData(userId, guildId); } catch (e) {}
            if (!userData && db) {
                try {
                    userData = db.prepare(
                        `SELECT id, xp, credits, streak_days, created_at, games_played, games_won,
                         total_messages, total_winnings, gaming, level, username, profile_bg
                         FROM users WHERE id = ? AND guild_id = ?`
                    ).get(userId, guildId);
                } catch (e) {}
            }
            if (!userData && client.getOrCreateUser) {
                try { userData = client.getOrCreateUser(userId, guildId, userName); } catch (e) {}
            }
            if (!userData) {
                return message.reply({ content: `❌ No data found for **${userName}**.`, flags: 64 }).catch(() => {});
            }

            let rank = 1, totalUsers = 1;
            try {
                rank = (db.prepare(`SELECT COUNT(*) as r FROM users WHERE xp > ? AND guild_id = ?`).get(userData.xp || 0, guildId)?.r || 0) + 1;
                totalUsers = db.prepare(`SELECT COUNT(*) as c FROM users WHERE guild_id = ?`).get(guildId)?.c || 1;
            } catch (e) {}

            const isArchitect = target.id === process.env.OWNER_ID;
            const imgBuffer = await buildRankCanvas(target, userData, rank, totalUsers, guildId, guildName, version, isArchitect);

            return message.reply({ files: [{ attachment: imgBuffer, name: 'rank.png' }] }).catch(() => {});
        } catch (err) {
            console.error(`[RANK ERROR]`, err);
            return message.reply({ content: '❌ Error loading dossier.', flags: 64 }).catch(() => {});
        }
    },

    execute: async (interaction, client) => {
        try {
            await interaction.deferReply();
            const targetUser = interaction.options.getUser('agent') || interaction.user;
            const db = client.db;

            const userMap = targetUser.id !== interaction.user.id
                ? new Map([[targetUser.id, targetUser]])
                : new Map();

            const fakeMessage = {
                author: interaction.user,
                guild: interaction.guild,
                channel: interaction.channel,
                mentions: {
                    users: {
                        _map: userMap,
                        first() { return this._map.values().next().value || null; }
                    }
                },
                reply: async (options) => interaction.editReply(options),
                react: () => Promise.resolve(),
                content: `/rank`
            };

            const serverSettings = interaction.guild ? client.getServerSettings?.(interaction.guild.id) || {} : { prefix: '.' };
            await module.exports.run(client, fakeMessage, [], db, serverSettings, 'rank');
        } catch (err) {
            console.error(`[RANK SLASH ERROR]`, err);
            await interaction.editReply({ content: '❌ Error loading dossier.' }).catch(() => {});
        }
    }
};

