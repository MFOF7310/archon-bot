const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

const W = 850, H = 260;
const AV_CACHE = path.join(__dirname, '..', 'cache', 'avatars');
if (!fs.existsSync(AV_CACHE)) fs.mkdirSync(AV_CACHE, { recursive: true });

async function getAvatar(user, size = 128) {
    const url = user.displayAvatarURL({ extension: 'png', size });
    try { return await loadImage(url); } catch { return null; }
}

async function renderWelcomeBanner(member, count) {
    const c = createCanvas(W, H + 70);
    const ctx = c.getContext('2d');
    const bg1 = '#5865f2', bg2 = '#2d3a8c', accent = '#8b9aff';
    const grad = ctx.createLinearGradient(0, 0, W, H + 70);
    grad.addColorStop(0, bg1); grad.addColorStop(1, bg2);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H + 70);
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(0, 0, W, H + 70);
    ctx.strokeStyle = 'rgba(255,255,255,0.025)'; ctx.lineWidth = 1;
    for (let i = 0; i < W; i += 50) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H + 70); ctx.stroke(); }
    const av = await getAvatar(member.user, 128);
    const ax = 55, ay = (H + 70) / 2, ar = 64;
    if (av) {
        ctx.save(); ctx.beginPath(); ctx.arc(ax + ar, ay, ar + 10, 0, Math.PI * 2); ctx.fillStyle = accent + '20'; ctx.fill(); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.arc(ax + ar, ay, ar, 0, Math.PI * 2); ctx.closePath(); ctx.clip(); ctx.drawImage(av, ax, ay - ar, ar * 2, ar * 2); ctx.restore();
        ctx.beginPath(); ctx.arc(ax + ar, ay, ar + 3, 0, Math.PI * 2); ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 46px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('WELCOME', 210, (H + 70) / 2 - 42);
    ctx.fillStyle = accent; ctx.font = '30px sans-serif';
    const name = member.user.username.length > 20 ? member.user.username.substring(0, 19) + '...' : member.user.username;
    ctx.fillText(name, 210, (H + 70) / 2 + 8);
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '16px sans-serif';
    ctx.fillText(`Member #${count.toLocaleString()}`, 210, (H + 70) / 2 + 48);
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.font = '12px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText('ARCHON CG-223', W - 25, 22);
    return c.encode('png');
}

async function renderGoodbyeBanner(member, duration, roleCount) {
    const c = createCanvas(W, H);
    const ctx = c.getContext('2d');
    const bg1 = '#e74c3c', bg2 = '#8e2409', accent = '#ff7a6b';
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, bg1); grad.addColorStop(1, bg2);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.025)'; ctx.lineWidth = 1;
    for (let i = 0; i < W; i += 50) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke(); }
    const av = await getAvatar(member.user, 128);
    const ax = 55, ay = H / 2, ar = 58;
    if (av) {
        ctx.save(); ctx.beginPath(); ctx.arc(ax + ar, ay, ar + 8, 0, Math.PI * 2); ctx.fillStyle = accent + '20'; ctx.fill(); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.arc(ax + ar, ay, ar, 0, Math.PI * 2); ctx.closePath(); ctx.clip(); ctx.drawImage(av, ax, ay - ar, ar * 2, ar * 2); ctx.restore();
        ctx.beginPath(); ctx.arc(ax + ar, ay, ar + 3, 0, Math.PI * 2); ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 42px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('DEPARTURE', 185, H / 2 - 35);
    ctx.fillStyle = accent; ctx.font = '26px sans-serif';
    const name = member.user.username.length > 22 ? member.user.username.substring(0, 21) + '...' : member.user.username;
    ctx.fillText(name, 185, H / 2 + 10);
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '14px sans-serif';
    const durText = duration ? `Stay: ${duration}` : 'Brief visit';
    const roleText = roleCount ? `| ${roleCount} role${roleCount > 1 ? 's' : ''} lost` : '';
    ctx.fillText(`${durText} ${roleText}`, 185, H / 2 + 42);
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.font = '12px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText('ARCHON CG-223', W - 25, 20);
    return c.encode('png');
}

function formatDuration(ms) {
    if (!ms || ms < 60000) return '< 1 minute';
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins} minute${mins > 1 ? 's' : ''}`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''}`;
    const days = Math.floor(hrs / 24);
    return `${days} day${days > 1 ? 's' : ''}`;
}

async function handleWelcome(member, client, db) {
    const ss = client.getServerSettings?.(member.guild.id) || {};
    if (ss.welcomeEnabled === false) return;
    const chId = ss.welcomeChannel || ss.welcome_channel;
    const ch = chId ? member.guild.channels.cache.get(chId) : member.guild.systemChannel;
    if (!ch) return;
    const png = await renderWelcomeBanner(member, member.guild.memberCount);
    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setDescription((ss.welcomeMessage || 'Welcome {user} to **{server}**!').replace('{user}', member.toString()).replace('{server}', member.guild.name).replace('{count}', String(member.guild.memberCount)))
        .setImage('attachment://welcome.png')
        .setFooter({ text: `Member #${member.guild.memberCount} | ARCHON CG-223` })
        .setTimestamp();
    const ansiText = '**> NETWORK LINK ESTABLISHED**\n> `' + member.user.username + '` joined the grid | Member #' + member.guild.memberCount + '\n> Glad you\'re here, ' + member.toString() + '!';
    await ch.send({ content: ansiText }).catch(() => {});
    await ch.send({ embeds: [embed], files: [new AttachmentBuilder(png, { name: 'welcome.png' })] }).catch(() => {});
}

async function handleGoodbye(member, client, db) {
    const ss = client.getServerSettings?.(member.guild.id) || {};
    if (!ss.goodbyeChannel && !ss.goodbye_channel) return;
    const chId = ss.goodbyeChannel || ss.goodbye_channel;
    const ch = member.guild.channels.cache.get(chId);
    if (!ch) return;
    const joinedAt = member.joinedTimestamp;
    const duration = joinedAt ? formatDuration(Date.now() - joinedAt) : null;
    const roleCount = member.roles.cache.size - 1;
    const roles = [...member.roles.cache.values()].filter(r => r.id !== member.guild.id);
    const png = await renderGoodbyeBanner(member, duration, roleCount);
    const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setDescription(`**${member.user.tag}** left **${member.guild.name}**.`)
        .setImage('attachment://goodbye.png')
        .setFooter({ text: 'ARCHON CG-223 | Departure Log' })
        .setTimestamp();
    if (duration) embed.addFields({ name: 'Stay Duration', value: duration, inline: true });
    if (roleCount > 0) embed.addFields({ name: `Roles Lost (${roleCount})`, value: roles.slice(0, 10).map(r => r.name).join(', ') || 'None', inline: true });
    const roleList = roles.slice(0, 5).map(r => r.name).join(', ') || 'None';
    const ansiText = '**> NETWORK LINK SEVERED**\n> `' + member.user.username + '` left the grid\n> **DEPARTURE REPORT**\n```\nDisplay:  ' + member.user.username + '\nID:       ' + member.id + '\nStay:     ' + (duration || 'Brief visit') + '\nRoles:    ' + roleList + '\n```';
    await ch.send({ content: ansiText }).catch(() => {});
    await ch.send({ embeds: [embed], files: [new AttachmentBuilder(png, { name: 'goodbye.png' })] }).catch(() => {});
}

module.exports = {
    name: 'welcome', category: 'SOCIAL', aliases: ['goodbye', 'leave', 'join'],
    description: 'Canvas welcome/goodbye banners with styled text.',
    usage: '.welcome config | Set welcome_channel and goodbye_channel in serversettings',
    cooldown: 1000,
    async onMemberAdd(member, client, db) { await handleWelcome(member, client, db); },
    async onMemberRemove(member, client, db) { await handleGoodbye(member, client, db); }
};
