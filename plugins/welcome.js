const { EmbedBuilder, AttachmentBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const W = 520, H = 140; // Compact card size

// ================= SMART UTILS =================
function ordinal(n) { const s = ['th','st','nd','rd'], v = n % 100; return n + (s[(v-20)%10] || s[v] || s[0]); }
function fmtDur(ms) {
    if (!ms || ms < 60000) return '< 1m';
    const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000);
    return `${d ? d + 'd ' : ''}${h ? h + 'h ' : ''}${m}m`.trim();
}
function accountAge(createdAt) {
    const ms = Date.now() - createdAt;
    const d = Math.floor(ms / 86400000);
    if (d < 1) return 'Created today';
    if (d < 7) return `${d} days old`;
    if (d < 30) return `${Math.floor(d / 7)} weeks old`;
    if (d < 365) return `${Math.floor(d / 30)} months old`;
    return `${Math.floor(d / 365)} years old`;
}

// ================= CANVAS: COMPACT WELCOME CARD =================
async function renderWelcomeCard(member, count) {
    const c = createCanvas(W, H);
    const ctx = c.getContext('2d');

    // Background
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#1a1a2e');
    g.addColorStop(1, '#16213e');
    ctx.fillStyle = g;
    roundRect(ctx, 0, 0, W, H, 16);
    ctx.fill();

    // Neural grid lines
    ctx.strokeStyle = 'rgba(0,251,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i < W; i += 30) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - 40, H); ctx.stroke(); }

    // Left accent bar
    ctx.fillStyle = '#00fbff';
    roundRect(ctx, 0, 20, 4, H - 40, 2);
    ctx.fill();

    // Avatar
    const av = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 128 })).catch(() => null);
    const ax = 22, ay = H / 2, ar = 38;
    if (av) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax + ar, ay, ar, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(av, ax, ay - ar, ar * 2, ar * 2);
        ctx.restore();
        // Ring
        ctx.beginPath();
        ctx.arc(ax + ar, ay, ar + 2, 0, Math.PI * 2);
        ctx.strokeStyle = '#00fbff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // "JOINED" label
    ctx.fillStyle = '#00fbff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('JOINED', 100, 32);

    // Username
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    const name = member.user.username.length > 18 ? member.user.username.substring(0, 17) + '...' : member.user.username;
    ctx.fillText(name, 100, 56);

    // Stats row
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '11px sans-serif';
    const age = accountAge(member.user.createdTimestamp);
    const isSus = (Date.now() - member.user.createdTimestamp) < 604800000; // < 7 days
    const ageColor = isSus ? '  [NEW]' : '';
    ctx.fillText(`#${ordinal(count)} member  |  ${age}${ageColor}`, 100, 78);

    // Server name (bottom right)
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    const sName = member.guild.name.length > 25 ? member.guild.name.substring(0, 24) + '...' : member.guild.name;
    ctx.fillText(sName, W - 18, H - 18);

    // "ARCHON" badge (top right)
    ctx.fillStyle = 'rgba(0,251,255,0.15)';
    roundRect(ctx, W - 90, 14, 72, 20, 4);
    ctx.fill();
    ctx.fillStyle = '#00fbff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ARCHON CG-223', W - 54, 27);

    return c.encode('png');
}

// ================= CANVAS: COMPACT GOODBYE CARD =================
async function renderGoodbyeCard(member, duration, roleCount) {
    const c = createCanvas(W, H);
    const ctx = c.getContext('2d');

    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#1a0a0a');
    g.addColorStop(1, '#2d1313');
    ctx.fillStyle = g;
    roundRect(ctx, 0, 0, W, H, 16);
    ctx.fill();

    ctx.strokeStyle = 'rgba(231,76,60,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i < W; i += 30) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - 40, H); ctx.stroke(); }

    ctx.fillStyle = '#e74c3c';
    roundRect(ctx, 0, 20, 4, H - 40, 2);
    ctx.fill();

    const av = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 128 })).catch(() => null);
    const ax = 22, ay = H / 2, ar = 38;
    if (av) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax + ar, ay, ar, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(av, ax, ay - ar, ar * 2, ar * 2);
        ctx.restore();
        ctx.beginPath();
        ctx.arc(ax + ar, ay, ar + 2, 0, Math.PI * 2);
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('DEPARTED', 100, 32);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    const name = member.user.username.length > 18 ? member.user.username.substring(0, 17) + '...' : member.user.username;
    ctx.fillText(name, 100, 56);

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '11px sans-serif';
    const dur = duration || '< 1m';
    ctx.fillText(`Stay: ${dur}  |  ${roleCount} role${roleCount !== 1 ? 's' : ''} removed`, 100, 78);

    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    const sName = member.guild.name.length > 25 ? member.guild.name.substring(0, 24) + '...' : member.guild.name;
    ctx.fillText(sName, W - 18, H - 18);

    ctx.fillStyle = 'rgba(231,76,60,0.15)';
    roundRect(ctx, W - 90, 14, 72, 20, 4);
    ctx.fill();
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ARCHON CG-223', W - 54, 27);

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

// ================= NEURAL GRID ANSI TEXT =================
function ansiWelcome(member, count) {
    const name = member.user.username;
    const isNew = (Date.now() - member.user.createdTimestamp) < 604800000;
    return '```ansi\n' +
        '\u001b[0;36m╔══════════════════════════════════════════╗\u001b[0m\n' +
        '\u001b[0;36m║\u001b[1;36m  NEURAL LINK // NETWORK EXPANSION       \u001b[0;36m║\u001b[0m\n' +
        '\u001b[0;36m╠══════════════════════════════════════════╣\u001b[0m\n' +
        `\u001b[0;36m║\u001b[0m  Node: \u001b[1;33m${name.padEnd(18)}\u001b[0m #${String(count).padStart(4)}     \u001b[0;36m║\u001b[0m\n` +
        `\u001b[0;36m║\u001b[0m  Grid: \u001b[0;37m${member.guild.name.substring(0, 26).padEnd(26)}\u001b[0m  \u001b[0;36m║\u001b[0m\n` +
        `\u001b[0;36m║\u001b[0m  Account: \u001b[0;37m${accountAge(member.user.createdTimestamp).padEnd(23)}\u001b[0m` + (isNew ? ' \u001b[1;31m[NEW]\u001b[0m ' : '       ') + '\u001b[0;36m║\u001b[0m\n' +
        '\u001b[0;36m╚══════════════════════════════════════════╝\u001b[0m\n' +
        '```\n' +
        `${member.toString()} Welcome to the grid.`;
}

function ansiGoodbye(member, duration, roleCount, roles) {
    const name = member.user.username;
    const dur = duration || '< 1m';
    const rl = roles.slice(0, 4).map(r => r.name).join(', ') || 'None';
    return '```ansi\n' +
        '\u001b[0;31m╔══════════════════════════════════════════╗\u001b[0m\n' +
        '\u001b[0;31m║\u001b[1;31m  NEURAL LINK // NETWORK SEVERED         \u001b[0;31m║\u001b[0m\n' +
        '\u001b[0;31m╠══════════════════════════════════════════╣\u001b[0m\n' +
        `\u001b[0;31m║\u001b[0m  Node: \u001b[1;33m${name.padEnd(18)}\u001b[0m              \u001b[0;31m║\u001b[0m\n` +
        `\u001b[0;31m║\u001b[0m  Stay: \u001b[0;37m${dur.padEnd(26)}\u001b[0m       \u001b[0;31m║\u001b[0m\n` +
        `\u001b[0;31m║\u001b[0m  Roles: \u001b[0;37m${rl.substring(0, 28).padEnd(28)}\u001b[0m  \u001b[0;31m║\u001b[0m\n` +
        '\u001b[0;31m╚══════════════════════════════════════════╝\u001b[0m\n' +
        '```';
}

// ================= HANDLERS =================
async function handleWelcome(member, client, db) {
    const ss = client.getServerSettings?.(member.guild.id) || {};
    if (ss.welcomeEnabled === false) return;
    const chId = ss.welcomeChannel || ss.welcome_channel;
    const ch = chId ? member.guild.channels.cache.get(chId) : member.guild.systemChannel;
    if (!ch) return;

    const png = await renderWelcomeCard(member, member.guild.memberCount);
    const embed = new EmbedBuilder()
        .setColor(0x00fbff)
        .setImage('attachment://welcome.png')
        .setFooter({ text: 'ARCHON CG-223 | Neural Grid' })
        .setTimestamp();

    const content = ansiWelcome(member, member.guild.memberCount);
    await ch.send({ content, embeds: [embed], files: [new AttachmentBuilder(png, { name: 'welcome.png' })] }).catch(() => {});
}

async function handleGoodbye(member, client, db) {
    const ss = client.getServerSettings?.(member.guild.id) || {};
    if (!ss.goodbyeChannel && !ss.goodbye_channel) return;
    const chId = ss.goodbyeChannel || ss.goodbye_channel;
    const ch = member.guild.channels.cache.get(chId);
    if (!ch) return;

    const joinedAt = member.joinedTimestamp;
    const duration = joinedAt ? fmtDur(Date.now() - joinedAt) : null;
    const roles = [...member.roles.cache.values()].filter(r => r.id !== member.guild.id);
    const png = await renderGoodbyeCard(member, duration, roles.length);
    const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setImage('attachment://goodbye.png')
        .setFooter({ text: 'ARCHON CG-223 | Departure Log' })
        .setTimestamp();

    const content = ansiGoodbye(member, duration, roles.length, roles);
    await ch.send({ content, embeds: [embed], files: [new AttachmentBuilder(png, { name: 'goodbye.png' })] }).catch(() => {});
}

// ================= MODULE =================
module.exports = {
    name: 'welcome', category: 'SOCIAL', aliases: ['goodbye', 'leave', 'join'],
    description: 'Neural-grid welcome/goodbye cards with ANSI art and smart detection.',
    usage: '.welcome config | .welcome test',
    cooldown: 1000,

    run: async (client, message, args, db, ss) => {
        const sub = args[0]?.toLowerCase() || 'config';
        const prefix = ss?.prefix || '.';
        if (sub === 'test') {
            // Simulate welcome for testing
            const embed = new EmbedBuilder().setColor(0x00fbff).setDescription('**Sending test welcome...**').setFooter({ text: 'ARCHON CG-223' });
            await message.reply({ embeds: [embed] }).catch(() => {});
            await module.exports.onMemberAdd(message.member, client, db);
            return;
        }
        // Default: show config
        const wCh = ss?.welcomeChannel || ss?.welcome_channel;
        const gCh = ss?.goodbyeChannel || ss?.goodbye_channel;
        const wMsg = ss?.welcomeMessage || 'Welcome {user} to {server}! You are member #{count}.';
        const embed = new EmbedBuilder().setColor(0x00fbff).setAuthor({ name: 'Welcome System', iconURL: client.user.displayAvatarURL() }).
            addFields(
                { name: 'Welcome Channel', value: wCh ? `<#${wCh}>` : '*Not set*', inline: true },
                { name: 'Goodbye Channel', value: gCh ? `<#${gCh}>` : '*Not set*', inline: true },
                { name: 'Welcome Message', value: `\`${wMsg}\``, inline: false },
                { name: 'Setup', value: `\`${prefix}serversettings set welcome_channel #channel\`\n\`${prefix}serversettings set goodbye_channel #channel\`\n\`${prefix}serversettings set welcome_message Your message here\``, inline: false },
                { name: 'Test', value: `\`${prefix}welcome test\` — Simulate welcome`, inline: false }
            ).setFooter({ text: 'ARCHON CG-223' }).setTimestamp();
        message.reply({ embeds: [embed] }).catch(() => {});
    },

    data: new SlashCommandBuilder().setName('welcome').setDescription('Welcome/goodbye system configuration')
        .addSubcommand(s => s.setName('config').setDescription('View welcome/goodbye configuration'))
        .addSubcommand(s => s.setName('test').setDescription('Test welcome banner (admin only)')),

    execute: async (ix, client) => {
        const sc = ix.options.getSubcommand();
        const db = client.db;
        const ss = client.getServerSettings?.(ix.guild.id) || {};

        if (sc === 'config') {
            const wCh = ss?.welcomeChannel || ss?.welcome_channel;
            const gCh = ss?.goodbyeChannel || ss?.goodbye_channel;
            const wMsg = ss?.welcomeMessage || 'Welcome {user} to {server}! You are member #{count}.';
            const embed = new EmbedBuilder().setColor(0x00fbff).setAuthor({ name: 'Welcome System', iconURL: client.user.displayAvatarURL() }).
                addFields(
                    { name: 'Welcome Channel', value: wCh ? `<#${wCh}>` : '*Not set*', inline: true },
                    { name: 'Goodbye Channel', value: gCh ? `<#${gCh}>` : '*Not set*', inline: true },
                    { name: 'Welcome Message', value: `\`${wMsg}\``, inline: false },
                    { name: 'Setup', value: '`/serversettings` → set welcome_channel, goodbye_channel, welcome_message', inline: false }
                ).setFooter({ text: 'ARCHON CG-223' }).setTimestamp();
            return ix.reply({ embeds: [embed], flags: 1 << 6 });
        }

        if (sc === 'test') {
            const adm = ix.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!adm) return ix.reply({ content: '🔒 Admin only.', flags: 1 << 6 });
            await ix.reply({ content: 'Sending test welcome...', flags: 1 << 6 });
            await module.exports.onMemberAdd(ix.member, client, db);
            return;
        }
    },

    async onMemberAdd(member, client, db) { await handleWelcome(member, client, db); },
    async onMemberRemove(member, client, db) { await handleGoodbye(member, client, db); }
};
