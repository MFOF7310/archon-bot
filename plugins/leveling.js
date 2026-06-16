const { EmbedBuilder, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

// ================= CONFIG =================
const W = 800, H = 250; // Banner dimensions
const CACHE_DIR = path.join(__dirname, '..', 'cache', 'avatars');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// Colors per level milestone
const LEVEL_COLORS = {
    5:  { bg1: '#43b581', bg2: '#2e7d52', accent: '#66f0a0' },
    10: { bg1: '#faa61a', bg2: '#b3780d', accent: '#ffd54f' },
    15: { bg1: '#5865f2', bg2: '#2d3a8c', accent: '#8b9aff' },
    20: { bg1: '#e74c3c', bg2: '#8e2409', accent: '#ff7a6b' },
    25: { bg1: '#9b59b6', bg2: '#5b2c6f', accent: '#d7a3ef' },
};
function getColors(level) {
    const keys = Object.keys(LEVEL_COLORS).map(Number).sort((a,b)=>b-a);
    for (const k of keys) if (level >= k) return LEVEL_COLORS[k];
    return { bg1: '#5865f2', bg2: '#2d3a8c', accent: '#8b9aff' };
}

// ================= AVATAR CACHE =================
async function getAvatar(user, size = 128) {
    const url = user.displayAvatarURL({ extension: 'png', size });
    const cacheFile = path.join(CACHE_DIR, `${user.id}-${size}.png`);
    if (fs.existsSync(cacheFile)) return loadImage(cacheFile);
    try {
        const img = await loadImage(url);
        return img;
    } catch (e) { return null; }
}

// ================= CANVAS: LEVEL-UP BANNER =================
async function renderLevelBanner(user, level, xpProgress = 0.5) {
    const colors = getColors(level);
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, colors.bg1);
    grad.addColorStop(1, colors.bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Dark overlay for text readability
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, W, H);

    // Subtle pattern lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i < W; i += 40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - 60, H); ctx.stroke(); }

    // Avatar circle (left side)
    const avatar = await getAvatar(user, 128);
    const ax = 50, ay = H/2, ar = 55;
    if (avatar) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax + ar, ay, ar, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, ax, ay - ar, ar * 2, ar * 2);
        ctx.restore();
        // Avatar ring
        ctx.beginPath();
        ctx.arc(ax + ar, ay, ar + 3, 0, Math.PI * 2);
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    // LEVEL text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 60px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`LEVEL ${level}`, 190, H/2 - 30);

    // Username
    ctx.fillStyle = colors.accent;
    ctx.font = '28px sans-serif';
    const name = user.username.length > 18 ? user.username.substring(0, 17) + '…' : user.username;
    ctx.fillText(name, 190, H/2 + 25);

    // "ARCHON CG-223" branding (top right)
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('ARCHON CG-223', W - 20, 20);

    // Progress bar background
    const barX = 190, barY = H - 45, barW = 400, barH = 8;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4);
    ctx.fill();

    // Progress bar fill
    const fillW = Math.max(barW * xpProgress, 4);
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.roundRect(barX, barY, fillW, barH, 4);
    ctx.fill();

    // Progress percentage text
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(xpProgress * 100)}%`, barX + barW + 10, barY + 6);

    return canvas.encode('png');
}

// ================= CANVAS: WELCOME BANNER =================
async function renderWelcomeBanner(member, totalMembers) {
    const canvas = createCanvas(W, H + 50);
    const ctx = canvas.getContext('2d');
    const colors = { bg1: '#5865f2', bg2: '#2d3a8c', accent: '#8b9aff' };

    // Background
    const grad = ctx.createLinearGradient(0, 0, W, H + 50);
    grad.addColorStop(0, colors.bg1);
    grad.addColorStop(1, colors.bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H + 50);

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, W, H + 50);

    // Subtle grid pattern
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let i = 0; i < W; i += 50) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H + 50); ctx.stroke(); }

    // Avatar
    const avatar = await getAvatar(member.user, 128);
    const ax = 55, ay = (H + 50) / 2, ar = 60;
    if (avatar) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax + ar, ay, ar, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, ax, ay - ar, ar * 2, ar * 2);
        ctx.restore();
        ctx.beginPath();
        ctx.arc(ax + ar, ay, ar + 4, 0, Math.PI * 2);
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 4;
        ctx.stroke();
    }

    // Welcome text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('WELCOME', 210, (H + 50) / 2 - 35);

    // Username
    ctx.fillStyle = colors.accent;
    ctx.font = '28px sans-serif';
    const name = member.user.username.length > 20 ? member.user.username.substring(0, 19) + '…' : member.user.username;
    ctx.fillText(name, 210, (H + 50) / 2 + 15);

    // Member count
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Member #${totalMembers}`, 210, (H + 50) / 2 + 50);

    // Branding
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('ARCHON CG-223', W - 25, 20);

    return canvas.encode('png');
}

// ================= ROLE MANAGER =================
async function assignLevelRoles(member, newLevel) {
    const rolesAdded = [];
    // Parse roles from env: LEVEL_5_ROLES=id1,id2 LEVEL_10_ROLES=id3,etc
    const milestones = [5, 10, 15, 20, 25];
    for (const lvl of milestones) {
        if (newLevel >= lvl) {
            const envKey = `LEVEL_${lvl}_ROLES`;
            const roleIds = process.env[envKey]?.split(',').filter(Boolean) || [];
            for (const rid of roleIds) {
                const role = member.guild.roles.cache.get(rid.trim());
                if (role && !member.roles.cache.has(rid.trim())) {
                    if (member.guild.members.me.roles.highest.position > role.position) {
                        try { await member.roles.add(role); rolesAdded.push(role.name); } catch (e) {}
                    }
                }
            }
        }
    }
    return rolesAdded;
}

// ================= LEVEL-UP HANDLER =================
async function handleLevelUp(member, newLevel, xpCurrent, xpNeeded, client, db) {
    const isMilestone = LEVEL_COLORS[newLevel] || (newLevel > 25 && newLevel % 5 === 0);
    if (!isMilestone) return; // Only fire on milestone levels

    // Assign roles
    const rolesAdded = await assignLevelRoles(member, newLevel);

    // Generate banner
    const progress = xpNeeded > 0 ? Math.min(xpCurrent / xpNeeded, 0.99) : 0;
    const pngBuffer = await renderLevelBanner(member.user, newLevel, progress);

    // Build embed
    const colors = getColors(newLevel);
    const embed = new EmbedBuilder()
        .setColor(parseInt(colors.bg1.replace('#', ''), 16))
        .setDescription(`**${member.user.tag}** reached **Level ${newLevel}**!`)
        .setImage('attachment://levelup.png')
        .setFooter({ text: 'ARCHON CG-223 • Leveling' })
        .setTimestamp();

    if (rolesAdded.length) {
        embed.addFields({ name: 'New Roles', value: rolesAdded.map(r => `• ${r}`).join('\n'), inline: false });
    }

    // Send
    const ss = client.getServerSettings?.(member.guild.id) || {};
    const channelId = ss.levelupChannel || ss.levelup_channel;
    const channel = channelId ? member.guild.channels.cache.get(channelId) : member.guild.systemChannel;
    if (!channel) return;

    const attachment = new AttachmentBuilder(pngBuffer, { name: 'levelup.png' });
    await channel.send({ content: `GG ${member}! 🎉`, embeds: [embed], files: [attachment] }).catch(() => {});
}

// ================= WELCOME HANDLER =================
async function handleWelcome(member, client) {
    const ss = client.getServerSettings?.(member.guild.id) || {};
    if (ss.welcomeEnabled === false) return;

    const pngBuffer = await renderWelcomeBanner(member, member.guild.memberCount);

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setDescription(
            (ss.welcomeMessage || 'Welcome to **{server}**, {user}!')
                .replace('{user}', member.toString())
                .replace('{server}', member.guild.name)
                .replace('{count}', String(member.guild.memberCount))
        )
        .setImage('attachment://welcome.png')
        .setFooter({ text: `Member #${member.guild.memberCount} • ARCHON CG-223` })
        .setTimestamp();

    const channelId = ss.welcomeChannel || ss.welcome_channel;
    const channel = channelId ? member.guild.channels.cache.get(channelId) : member.guild.systemChannel;
    if (!channel) return;

    const attachment = new AttachmentBuilder(pngBuffer, { name: 'welcome.png' });
    await channel.send({ embeds: [embed], files: [attachment] }).catch(() => {});
}

// ================= MODULE =================
module.exports = {
    name: 'leveling',
    description: '📈 Dynamic canvas leveling banners with auto-roles and welcome cards.',

    // Called by index.js on guildMemberAdd
    async onMemberAdd(member, client, db) {
        await handleWelcome(member, client);
    },

    // Called by your XP system when user levels up
    // xpCurrent = current XP in level, xpNeeded = XP needed for next level (0-1 for progress bar)
    async onLevelUp(member, newLevel, xpCurrent, xpNeeded, client, db) {
        await handleLevelUp(member, newLevel, xpCurrent, xpNeeded, client, db);
    }
};
