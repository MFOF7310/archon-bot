const { AttachmentBuilder, SlashCommandBuilder } = require('discord.js');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

// ── Fonts ──
const FONTS_DIR = path.join(__dirname, '../assets/fonts');
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'DejaVuSans-Bold.ttf'), 'DejaVuBold');
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'DejaVuSans.ttf'), 'DejaVu');
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'DejaVuSansMono.ttf'), 'DejaVuMono');

const LB_BG = path.join(__dirname, '../assets/backgrounds/lb_bg.jpg');

function calculateLevel(xp) { return Math.floor(0.1 * Math.sqrt(xp || 0)) + 1; }

const AGENT_RANKS = [
    { minLevel: 1,  maxLevel: 5,        color: '#2ecc71', emoji: '🌱', title: 'RECRUIT'    },
    { minLevel: 6,  maxLevel: 15,       color: '#3498db', emoji: '🔹', title: 'AGENT'      },
    { minLevel: 16, maxLevel: 30,       color: '#9b59b6', emoji: '💠', title: 'SPECIALIST' },
    { minLevel: 31, maxLevel: 50,       color: '#e67e22', emoji: '⚜️', title: 'COMMANDER'  },
    { minLevel: 51, maxLevel: Infinity, color: '#e74c3c', emoji: '👑', title: 'ARCHITECT'  },
];

function getRank(level) {
    return AGENT_RANKS.find(r => level >= r.minLevel && level <= r.maxLevel) || AGENT_RANKS[0];
}

function hexToRgba(hex, alpha = 1) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${alpha})`;
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.lineTo(x+w-r, y);
    ctx.quadraticCurveTo(x+w, y, x+w, y+r);
    ctx.lineTo(x+w, y+h-r);
    ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    ctx.lineTo(x+r, y+h);
    ctx.quadraticCurveTo(x, y+h, x, y+h-r);
    ctx.lineTo(x, y+r);
    ctx.quadraticCurveTo(x, y, x+r, y);
    ctx.closePath();
}

const MEDAL_COLORS = ['#f1c40f', '#95a5a6', '#cd7f32'];
const MEDAL_LABELS = ['1ST', '2ND', '3RD'];

async function buildLeaderboardCanvas(entries, guildName, sortType, userRank, stats, client) {
    const W = 900;
    const HEADER_H = 120;
    const ROW_H = 68;
    const FOOTER_H = 60;
    const TOP = Math.min(entries.length, 10);
    const H = HEADER_H + TOP * ROW_H + FOOTER_H;

    const SCALE = 2;
    const canvas = createCanvas(W * SCALE, H * SCALE);
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);

    // ── Background image ──
    try {
        const bgImg = await loadImage(LB_BG);
        const scale = Math.max(W / bgImg.width, H / bgImg.height);
        const bw = bgImg.width * scale, bh = bgImg.height * scale;
        const bx = (W - bw) / 2, by = (H - bh) / 2;
        ctx.drawImage(bgImg, bx, by, bw, bh);
    } catch(e) {
        // Fallback solid bg
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, W, H);
    }
    // Dark overlay for readability
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(0,240,255,0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 45) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y < H; y += 45) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    // ── Header ──
    const headerGrad = ctx.createLinearGradient(0, 0, W, 0);
    headerGrad.addColorStop(0, 'rgba(0,240,255,0.08)');
    headerGrad.addColorStop(0.5, 'rgba(0,240,255,0.15)');
    headerGrad.addColorStop(1, 'rgba(0,240,255,0.08)');
    ctx.fillStyle = headerGrad;
    ctx.fillRect(0, 0, W, HEADER_H);

    // Top accent line
    const accentGrad = ctx.createLinearGradient(0, 0, W, 0);
    accentGrad.addColorStop(0, 'transparent');
    accentGrad.addColorStop(0.3, '#00f0ff');
    accentGrad.addColorStop(0.7, '#00f0ff');
    accentGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = accentGrad;
    ctx.fillRect(0, 0, W, 3);

    // Trophy icon area
    ctx.font = 'bold 36px DejaVuBold';
    ctx.fillStyle = '#f1c40f';
    ctx.textAlign = 'left';
    ctx.fillText('🏆', 30, 65);

    // Title
    ctx.font = 'bold 28px DejaVuBold';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('NEURAL LEADERBOARD', 80, 55);

    // Subtitle
    const sortLabel = { xp: 'TOP XP', credits: 'TOP CREDITS', messages: 'TOP MESSAGES', streak: 'DAILY STREAK', wins: 'TOP WINNERS' }[sortType] || 'TOP XP';
    ctx.font = '13px DejaVuMono';
    ctx.fillStyle = '#00f0ff';
    ctx.fillText(`${guildName.substring(0,35)} · ${sortLabel} · TOP ${TOP}`, 80, 80);

    // Stats right side
    ctx.textAlign = 'right';
    ctx.font = '12px DejaVuMono';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText(`${stats?.count || TOP} AGENTS`, W-30, 50);
    ctx.fillText(`AVG LVL ${(stats?.avg_level || 0).toFixed(1)}`, W-30, 70);
    if (userRank !== 'Not Ranked') {
        ctx.fillStyle = '#00f0ff';
        ctx.fillText(`YOU: ${userRank}`, W-30, 90);
    }
    ctx.textAlign = 'left';

    // Column headers
    const colY = HEADER_H - 18;
    ctx.font = '10px DejaVuMono';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText('RANK', 20, colY);
    ctx.fillText('AGENT', 120, colY);
    ctx.fillText('LVL', 530, colY);
    ctx.fillText('XP', 600, colY);
    ctx.fillText('CREDITS', 730, colY);

    // ── Rows ──
    for (let i = 0; i < TOP; i++) {
        const entry = entries[i];
        const rowY = HEADER_H + i * ROW_H;
        const level = entry.level || calculateLevel(entry.xp);
        const rank = getRank(level);

        // Row background — alternating + highlight top 3
        if (i < 3) {
            roundRect(ctx, 10, rowY + 4, W - 20, ROW_H - 8, 8);
            ctx.fillStyle = hexToRgba(MEDAL_COLORS[i], 0.08);
            ctx.fill();
            roundRect(ctx, 10, rowY + 4, W - 20, ROW_H - 8, 8);
            ctx.strokeStyle = hexToRgba(MEDAL_COLORS[i], 0.25);
            ctx.lineWidth = 1;
            ctx.stroke();
        } else if (i % 2 === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.02)';
            ctx.fillRect(10, rowY + 4, W - 20, ROW_H - 8);
        }

        const centerY = rowY + ROW_H / 2;

        // ── Rank number / medal ──
        if (i < 3) {
            ctx.font = 'bold 14px DejaVuBold';
            ctx.fillStyle = MEDAL_COLORS[i];
            ctx.textAlign = 'center';
            ctx.fillText(MEDAL_LABELS[i], 45, centerY + 5);
        } else {
            ctx.font = '12px DejaVuMono';
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.textAlign = 'center';
            ctx.fillText(`#${i+1}`, 45, centerY + 5);
        }
        ctx.textAlign = 'left';

        // ── Avatar circle ──
        const avatarX = 75, avatarY = centerY - 22, avatarR = 22;
        try {
            const avatarURL = entry.avatar
                ? `https://cdn.discordapp.com/avatars/${entry.id}/${entry.avatar}.png?size=64`
                : `https://cdn.discordapp.com/embed/avatars/${parseInt(entry.id || '0') % 5}.png`;
            const avatarImg = await loadImage(avatarURL);
            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarX + avatarR, avatarY + avatarR, avatarR, 0, Math.PI*2);
            ctx.clip();
            ctx.drawImage(avatarImg, avatarX, avatarY, avatarR*2, avatarR*2);
            ctx.restore();
            // Rank color ring
            ctx.beginPath();
            ctx.arc(avatarX + avatarR, avatarY + avatarR, avatarR + 1.5, 0, Math.PI*2);
            ctx.strokeStyle = rank.color;
            ctx.lineWidth = 2;
            ctx.stroke();
        } catch(e) {
            // Fallback circle
            ctx.beginPath();
            ctx.arc(avatarX + avatarR, avatarY + avatarR, avatarR, 0, Math.PI*2);
            ctx.fillStyle = hexToRgba(rank.color, 0.3);
            ctx.fill();
            ctx.font = 'bold 14px DejaVuBold';
            ctx.fillStyle = rank.color;
            ctx.textAlign = 'center';
            ctx.fillText((entry.username || '?')[0].toUpperCase(), avatarX + avatarR, avatarY + avatarR + 5);
            ctx.textAlign = 'left';
        }

        // ── Username ──
        ctx.font = i < 3 ? 'bold 15px DejaVuBold' : '14px DejaVu';
        ctx.fillStyle = i < 3 ? '#ffffff' : 'rgba(255,255,255,0.85)';
        const uname = (entry.username || 'Unknown').substring(0, 16);
        ctx.fillText(uname, 120, centerY - 4);

        // Rank title
        ctx.font = '10px DejaVuMono';
        ctx.fillStyle = rank.color;
        ctx.fillText(rank.title, 120, centerY + 12);

        // ── XP bar ──
        const barX = 120, barY = centerY + 20, barW = 380, barH = 4;
        const xpForCur = Math.pow((level-1)/0.1, 2);
        const xpForNext = Math.pow(level/0.1, 2);
        const pct = xpForNext > xpForCur ? Math.min(1, (entry.xp - xpForCur) / (xpForNext - xpForCur)) : 1;
        // Bar bg
        roundRect(ctx, barX, barY, barW, barH, 2);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fill();
        // Bar fill
        if (pct > 0) {
            roundRect(ctx, barX, barY, Math.max(4, barW * pct), barH, 2);
            ctx.fillStyle = rank.color;
            ctx.fill();
        }

        // ── Stats ──
        ctx.font = '13px DejaVuMono';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';

        // Level
        ctx.fillStyle = rank.color;
        ctx.font = 'bold 16px DejaVuBold';
        ctx.fillText(`${level}`, 530, centerY + 5);
        ctx.font = '9px DejaVuMono';
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillText('LVL', 530, centerY + 18);

        // XP
        ctx.font = '13px DejaVuMono';
        ctx.fillStyle = '#00f0ff';
        ctx.fillText((entry.xp || 0).toLocaleString(), 590, centerY + 5);
        ctx.font = '9px DejaVuMono';
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillText('XP', 590, centerY + 18);

        // Credits
        ctx.font = '13px DejaVuMono';
        ctx.fillStyle = '#f1c40f';
        const credStr = (entry.credits || 0) >= 1000
            ? `${((entry.credits||0)/1000).toFixed(1)}k`
            : String(entry.credits || 0);
        ctx.fillText(`${credStr} cr`, 725, centerY + 5);
        ctx.font = '9px DejaVuMono';
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillText('CREDITS', 725, centerY + 18);

        // Divider
        if (i < TOP - 1) {
            ctx.strokeStyle = 'rgba(255,255,255,0.04)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(20, rowY + ROW_H);
            ctx.lineTo(W - 20, rowY + ROW_H);
            ctx.stroke();
        }
    }

    // ── Footer ──
    const footerY = HEADER_H + TOP * ROW_H;
    ctx.fillStyle = 'rgba(0,240,255,0.05)';
    ctx.fillRect(0, footerY, W, FOOTER_H);
    ctx.strokeStyle = 'rgba(0,240,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, footerY); ctx.lineTo(W, footerY); ctx.stroke();

    ctx.font = '11px DejaVuMono';
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.textAlign = 'left';
    ctx.fillText(`ARCHON CG-223 // BAMAKO_223 🇲🇱 // NEURAL LEADERBOARD`, 20, footerY + 25);
    ctx.textAlign = 'right';
    ctx.fillText(new Date().toISOString().slice(0,10), W-20, footerY + 25);
    ctx.fillText(`${TOP} of ${stats?.count || TOP} agents`, W-20, footerY + 42);
    ctx.textAlign = 'left';

    // Bottom accent
    const botAccent = ctx.createLinearGradient(0, 0, W, 0);
    botAccent.addColorStop(0, 'transparent');
    botAccent.addColorStop(0.5, '#00f0ff');
    botAccent.addColorStop(1, 'transparent');
    ctx.fillStyle = botAccent;
    ctx.fillRect(0, H-3, W, 3);

    return canvas.toBuffer('image/png');
}

module.exports = {
    name: 'leaderboard',
    aliases: ['lb', 'top', 'classement', 'rich', 'richest', 'winners', 'gainers'],
    description: '🏆 Neural Leaderboard — canvas image with top 10 agents.',
    category: 'ECONOMY',
    usage: '.leaderboard [xp|credits|messages|streak|wins]',
    cooldown: 8000,

    data: new SlashCommandBuilder().setName('leaderboard').setDescription('🏆 Neural Leaderboard')
        .addStringOption(o => o.setName('type').setDescription('Sort by').setRequired(false)
            .addChoices(
                { name: 'XP',          value: 'xp'       },
                { name: 'Credits',     value: 'credits'  },
                { name: 'Messages',    value: 'messages' },
                { name: 'Daily Streak',value: 'streak'   },
                { name: 'Games Won',   value: 'wins'     }
            )),

    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        try {
            if (!message.guild) return message.reply('❌ Server only.').catch(() => {});

            const guildId   = message.guild.id;
            const guildName = message.guild.name?.toUpperCase() || 'NEURAL NODE';
            const userId    = message.author.id;

            const type = (args[0] || 'xp').toLowerCase();
            const validTypes = ['xp','credits','messages','msg','streak','daily','wins','games'];
            const sortType = validTypes.includes(type) ? type : 'xp';

            let orderCol = 'xp';
            if (sortType === 'credits')                    orderCol = 'credits';
            else if (['messages','msg'].includes(sortType)) orderCol = 'total_messages';
            else if (['streak','daily'].includes(sortType)) orderCol = 'streak_days';
            else if (['wins','games'].includes(sortType))   orderCol = 'games_won';

            const entries = db.prepare(
                `SELECT id, username, avatar, xp, credits, level, total_messages, streak_days, games_won
                 FROM users WHERE guild_id = ? ORDER BY ${orderCol} DESC LIMIT 10`
            ).all(guildId);

            if (!entries.length) {
                return message.reply('📊 No data yet — start chatting and playing to appear on the leaderboard!').catch(() => {});
            }

            const stats = db.prepare(
                'SELECT COUNT(*) as count, AVG(level) as avg_level, SUM(xp) as total_xp FROM users WHERE guild_id = ?'
            ).get(guildId);

            // User rank
            const allIds = db.prepare(`SELECT id FROM users WHERE guild_id = ? ORDER BY ${orderCol} DESC`).all(guildId).map(r => r.id);
            const uIdx = allIds.indexOf(userId);
            const userRank = uIdx !== -1 ? `#${uIdx+1} / ${allIds.length}` : 'Not Ranked';

            await message.channel.sendTyping().catch(() => {});

            const buffer = await buildLeaderboardCanvas(entries, guildName, sortType, userRank, stats, client);
            const attachment = new AttachmentBuilder(buffer, { name: 'leaderboard.png' });
            await message.reply({ files: [attachment] }).catch(() => {});

        } catch(err) {
            console.error('[LEADERBOARD]', err);
            message.reply('❌ Failed to generate leaderboard.').catch(() => {});
        }
    },

    execute: async (interaction, client) => {
        try {
            const type = interaction.options.getString('type') || 'xp';
            await interaction.deferReply();

            const guildId   = interaction.guild?.id;
            const guildName = interaction.guild?.name?.toUpperCase() || 'NEURAL NODE';
            const userId    = interaction.user.id;
            const db        = client.db;

            const validTypes = ['xp','credits','messages','msg','streak','daily','wins','games'];
            const sortType = validTypes.includes(type) ? type : 'xp';
            let orderCol = 'xp';
            if (sortType === 'credits')                    orderCol = 'credits';
            else if (['messages','msg'].includes(sortType)) orderCol = 'total_messages';
            else if (['streak','daily'].includes(sortType)) orderCol = 'streak_days';
            else if (['wins','games'].includes(sortType))   orderCol = 'games_won';

            const entries = db.prepare(
                `SELECT id, username, avatar, xp, credits, level, total_messages, streak_days, games_won
                 FROM users WHERE guild_id = ? ORDER BY ${orderCol} DESC LIMIT 10`
            ).all(guildId);

            if (!entries.length) {
                return interaction.editReply('📊 No data yet — start chatting and playing to appear on the leaderboard!');
            }

            const stats = db.prepare(
                'SELECT COUNT(*) as count, AVG(level) as avg_level, SUM(xp) as total_xp FROM users WHERE guild_id = ?'
            ).get(guildId);

            const allIds = db.prepare(`SELECT id FROM users WHERE guild_id = ? ORDER BY ${orderCol} DESC`).all(guildId).map(r => r.id);
            const uIdx = allIds.indexOf(userId);
            const userRank = uIdx !== -1 ? `#${uIdx+1} / ${allIds.length}` : 'Not Ranked';

            const buffer = await buildLeaderboardCanvas(entries, guildName, sortType, userRank, stats, client);
            const attachment = new AttachmentBuilder(buffer, { name: 'leaderboard.png' });
            await interaction.editReply({ files: [attachment] });

        } catch(err) {
            console.error('[LEADERBOARD SLASH]', err);
            interaction.editReply('❌ Failed to generate leaderboard.').catch(() => {});
        }
    }
};
