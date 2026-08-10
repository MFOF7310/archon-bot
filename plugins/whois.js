const { EmbedBuilder, AttachmentBuilder, SlashCommandBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const EMOJIS = require('../config/emojis');

// ── CANVAS CONSTANTS ──
const W = 1000, H = 450, SCALE = 2;
const CW = W * SCALE, CH = H * SCALE;

function s(n) { return n * SCALE; }

function hex(color, alpha = 1) { return color; }

async function renderWhoisCard(member, userData, allServers, warnings, premium) {
    const canvas = createCanvas(CW, CH);
    const ctx = canvas.getContext('2d');

    // ── BACKGROUND ──
    const bg = ctx.createLinearGradient(0, 0, CW, CH);
    bg.addColorStop(0, '#0a0e1a');
    bg.addColorStop(0.5, '#0d1525');
    bg.addColorStop(1, '#080c16');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CW, CH);

    // ── GRID LINES ──
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < CW; x += s(40)) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CH); ctx.stroke();
    }
    for (let y = 0; y < CH; y += s(40)) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke();
    }

    // ── LEFT ACCENT BAR ──
    const accent = ctx.createLinearGradient(0, 0, 0, CH);
    accent.addColorStop(0, '#00f0ff');
    accent.addColorStop(1, '#0066ff');
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, s(5), CH);

    // ── AVATAR ──
    const avatarSize = s(110);
    const avatarX = s(40), avatarY = s(H/2) - avatarSize/2;
    try {
        const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        const avatar = await loadImage(avatarUrl);
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();
        // Avatar border
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2 + s(3), 0, Math.PI * 2);
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = s(3);
        ctx.stroke();
    } catch(e) {}

    // ── USERNAME ──
    const nameX = s(175);
    ctx.font = `bold ${s(22)}px Sans`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(member.user.username.substring(0, 20), nameX, s(80));

    // ── TAG / JOINED ──
    ctx.font = `${s(11)}px Sans`;
    ctx.fillStyle = 'rgba(0,240,255,0.7)';
    const joined = member.joinedAt ? `Joined ${member.joinedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : '';
    ctx.fillText(`${member.id} • ${joined}`, nameX, s(100));

    // ── DIVIDER ──
    ctx.strokeStyle = 'rgba(0,240,255,0.15)';
    ctx.lineWidth = s(1);
    ctx.beginPath();
    ctx.moveTo(nameX, s(112));
    ctx.lineTo(s(W - 30), s(112));
    ctx.stroke();

    // ── STATS GRID ──
    const level = userData?.level || 0;
    const xp = userData?.xp || 0;
    const credits = userData?.credits || 0;
    const streak = userData?.streak_days || 0;
    const totalXP = allServers.reduce((s, r) => s + (r.xp || 0), 0);
    const totalCredits = allServers.reduce((s, r) => s + (r.credits || 0), 0);
    const activeWarns = warnings.filter(w => w.active).length;
    const serverCount = allServers.length;
    const isPremium = premium?.premium_active ? true : false;

    const stats = [
        { label: 'LEVEL', value: String(level), color: '#00f0ff' },
        { label: 'XP', value: xp.toLocaleString(), color: '#00ff88' },
        { label: 'CREDITS', value: credits.toLocaleString() + ' 🪙', color: '#ffd700' },
        { label: 'STREAK', value: streak + ' days 🔥', color: '#ff6600' },
        { label: 'SERVERS', value: String(serverCount), color: '#9b59b6' },
        { label: 'WARNINGS', value: String(activeWarns), color: activeWarns > 0 ? '#ff4444' : '#00ff88' },
    ];

    const colW = s(120), rowH = s(65);
    const gridX = nameX, gridY = s(125);
    const cols = 3;

    stats.forEach((stat, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = gridX + col * colW;
        const y = gridY + row * rowH;

        // Stat box background
        ctx.fillStyle = 'rgba(0,240,255,0.05)';
        roundRect(ctx, x, y, colW - s(8), rowH - s(8), s(6));
        ctx.fill();

        // Stat border
        ctx.strokeStyle = 'rgba(0,240,255,0.1)';
        ctx.lineWidth = s(1);
        roundRect(ctx, x, y, colW - s(8), rowH - s(8), s(6));
        ctx.stroke();

        // Label
        ctx.font = `${s(9)}px Sans`;
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText(stat.label, x + s(8), y + s(18));

        // Value
        ctx.font = `bold ${s(13)}px Sans`;
        ctx.fillStyle = stat.color;
        ctx.fillText(stat.value.substring(0, 12), x + s(8), y + s(38));
    });

    // ── XP PROGRESS BAR ──
    const xpNeeded = Math.pow((level + 1) / 0.1, 2);
    const prog = Math.min(1, xp / xpNeeded);
    const barX = nameX, barY = s(H - 70), barW = s(W - 210), barH = s(10);
    // Bar background
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    roundRect(ctx, barX, barY, barW, barH, s(5));
    ctx.fill();
    // Bar fill
    const barFill = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    barFill.addColorStop(0, '#00f0ff');
    barFill.addColorStop(1, '#0066ff');
    ctx.fillStyle = barFill;
    roundRect(ctx, barX, barY, Math.max(barW * prog, s(6)), barH, s(5));
    ctx.fill();
    // XP label
    ctx.font = `${s(10)}px Sans`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(`${xp.toLocaleString()} / ${Math.floor(xpNeeded).toLocaleString()} XP  →  Level ${level + 1}`, barX, barY - s(6));

    // ── PREMIUM BADGE ──
    if (isPremium) {
        ctx.font = `bold ${s(11)}px Sans`;
        ctx.fillStyle = '#ffd700';
        ctx.fillText('⭐ PREMIUM', s(W - 110), s(50));
    }

    // ── CROSS-SERVER TOTALS (right side) ──
    if (serverCount > 1) {
        const rx = s(W - 165), ry = s(130);
        ctx.font = `${s(9)}px Sans`;
        ctx.fillStyle = 'rgba(0,240,255,0.5)';
        ctx.fillText('CROSS-SERVER', rx, ry);
        ctx.font = `bold ${s(11)}px Sans`;
        ctx.fillStyle = '#00ff88';
        ctx.fillText(`${totalXP.toLocaleString()} XP`, rx, ry + s(18));
        ctx.fillStyle = '#ffd700';
        ctx.fillText(`${totalCredits.toLocaleString()} 🪙`, rx, ry + s(34));
    }

    // ── BOTTOM BAR ──
    ctx.fillStyle = 'rgba(0,240,255,0.08)';
    ctx.fillRect(0, CH - s(30), CW, s(30));
    ctx.font = `${s(10)}px Sans`;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('ARCHON CG-223  •  NEURAL SCAN  •  BAMAKO_223 [MLI]', s(10), CH - s(10));

    // ── SCAN LINES EFFECT ──
    for (let y = 0; y < CH; y += s(4)) {
        ctx.fillStyle = 'rgba(0,0,0,0.03)';
        ctx.fillRect(0, y, CW, s(2));
    }

    return canvas.toBuffer('image/png');
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

module.exports = {
    name: 'whois',
    aliases: ['userinfo', 'scan', 'profile'],
    description: 'Neural canvas scan card for any server member',
    category: 'UTILITY',
    cooldown: 5000,

    data: new SlashCommandBuilder()
        .setName('whois')
        .setDescription('🔍 Neural scan — view a member profile card')
        .addUserOption(o => o.setName('user').setDescription('Member to scan (default: you)').setRequired(false)),

    async run(client, message, args) {
        const target = message.mentions.members.first() ||
            message.guild.members.cache.get(args[0]) ||
            message.member;
        await handle(target, message, client, async (opts) => message.reply(opts));
    },

    async execute(interaction, client) {
        await interaction.deferReply();
        const target = interaction.options.getMember('user') || interaction.member;
        await handle(target, interaction, client, async (opts) => interaction.editReply(opts));
    }
};

async function handle(member, ctx, client, replyFn) {
    const db = client.db;
    const userId = member.user.id;
    const guildId = member.guild.id;

    const userData = db?.prepare('SELECT * FROM users WHERE id = ? AND guild_id = ?').get(userId, guildId);
    const allServers = db?.prepare('SELECT guild_id, xp, level, credits, streak_days FROM users WHERE id = ?').all(userId) || [];
    const warnings = db?.prepare('SELECT reason, created_at, active FROM warnings WHERE user_id = ? ORDER BY created_at DESC LIMIT 10').all(userId) || [];
    const premium = db?.prepare('SELECT * FROM user_premium WHERE user_id = ?').get(userId);

    try {
        const png = await renderWhoisCard(member, userData, allServers, warnings, premium);
        const attachment = new AttachmentBuilder(png, { name: 'neural-scan.png' });
        const embed = new EmbedBuilder()
            .setColor('#00f0ff')
            .setImage('attachment://neural-scan.png')
            .setFooter({ text: `ARCHON CG-223 • Neural Scan • ${member.guild.name}` })
            .setTimestamp();
        await replyFn({ embeds: [embed], files: [attachment] });
    } catch(e) {
        console.error('[WHOIS CANVAS]', e.message);
        await replyFn({ content: `${EMOJIS.error} Could not render scan card — try again in a moment.` });
    }
}
