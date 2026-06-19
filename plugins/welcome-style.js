// ╔══════════════════════════════════════════════════════════════════════╗
// ║  🦅 ARCHON CG-223 — WELCOME/GOODBYE SHARED CINEMATIC ENGINE v3.0  ║
// ║  Single canvas output | Warm welcome | Smart pro-tips | Real age  ║
// ╚══════════════════════════════════════════════════════════════════════╝

const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const W = 700, H = 220; // Wider, more impressive canvas

// ================= SMART UTILITIES =================
function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function fmtDur(ms) {
    if (!ms || ms < 60000) return '< 1 minute';
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (d > 365) return `${Math.floor(d / 365)}y ${d % 365}d`;
    if (d > 30) return `${Math.floor(d / 30)}mo ${d % 30}d`;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

// REAL account age: years, months, days — accurate calculation
function realAccountAge(createdAt) {
    const created = new Date(createdAt);
    const now = new Date();
    let years = now.getFullYear() - created.getFullYear();
    let months = now.getMonth() - created.getMonth();
    let days = now.getDate() - created.getDate();

    if (days < 0) {
        months--;
        const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        days += prevMonth.getDate();
    }
    if (months < 0) {
        years--;
        months += 12;
    }

    const parts = [];
    if (years > 0) parts.push(`${years} year${years !== 1 ? 's' : ''}`);
    if (months > 0) parts.push(`${months} month${months !== 1 ? 's' : ''}`);
    if (days > 0 && years === 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);

    if (parts.length === 0) return 'Created today';
    return parts.join(', ');
}

function accountAgeShort(createdAt) {
    const age = realAccountAge(createdAt);
    // Truncate for canvas if too long
    if (age.length > 20) {
        const years = Math.floor((Date.now() - createdAt) / (365.25 * 86400000));
        if (years > 0) return `${years}y old`;
        const months = Math.floor((Date.now() - createdAt) / (30 * 86400000));
        if (months > 0) return `${months}mo old`;
        const days = Math.floor((Date.now() - createdAt) / 86400000);
        return `${days}d old`;
    }
    return age;
}

// ================= CONFIG NORMALIZATION (CRITICAL BUGFIX) =================
function normalizeWelcomeConfig(ss) {
    if (!ss || typeof ss !== 'object') ss = {};
    return {
        welcomeChannel:    ss.welcomeChannel    || ss.welcome_channel    || ss.welcome    || null,
        goodbyeChannel:    ss.goodbyeChannel    || ss.goodbye_channel    || ss.goodbye    || null,
        welcomeMessage:    ss.welcomeMessage    || ss.welcome_message    || ss.welcomeMsg    || null,
        goodbyeMessage:    ss.goodbyeMessage    || ss.goodbye_message    || ss.goodbyemsg    || null,
        welcomeEnabled:    ss.welcomeEnabled !== false && ss.welcome_enabled !== 0,
        goodbyeEnabled:    ss.goodbyeEnabled !== false && ss.goodbye_enabled !== 0,
        prefix:            ss.prefix || '.',

        // Feature flags for dynamic tips & button suppression
        levelingEnabled:   ss.levelChannel || ss.levelup_channel || ss.xpMultiplier > 0,
        dailyEnabled:      true,
        shopEnabled:       true,
        aiEnabled:         ss.aiEnabled !== false && ss.ai_enabled !== 0,
        marketEnabled:     ss.marketEnabled !== false && ss.market_enabled !== 0,
        ticketEnabled:     ss.ticketCategory || ss.ticket_category || ss.ticketStaffRole || ss.ticket_staff_role,

        // Channel IDs for button suppression (if configured, don't show button)
        rulesChannel:      ss.rulesChannel || ss.rules_channel || ss.rules || null,
        generalChannel:    ss.generalChannel || ss.general_channel || ss.general || null,

        _raw: ss
    };
}

// ================= TEMPLATE FORMATTER =================
function formatTemplate(template, member, count) {
    if (!template) return '';
    return template
        .replace(/\{user\}/g, member.toString())
        .replace(/\{username\}/g, member.user.username)
        .replace(/\{server\}/g, member.guild.name)
        .replace(/\{count\}/g, count)
        .replace(/\{guild\}/g, member.guild.name)
        .replace(/\{membercount\}/g, count)
        .replace(/\{mention\}/g, member.toString())
        .replace(/\{age\}/g, realAccountAge(member.user.createdTimestamp));
}

// ================= ROUNDED RECT HELPER =================
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

// ================= CANVAS: ULTIMATE WELCOME CARD =================
async function renderWelcomeCard(member, count, cfg) {
    const c = createCanvas(W, H);
    const ctx = c.getContext('2d');

    // Deep space background with subtle gradient
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0d1117');
    bg.addColorStop(0.5, '#161b22');
    bg.addColorStop(1, '#0d1117');
    ctx.fillStyle = bg;
    roundRect(ctx, 0, 0, W, H, 24);
    ctx.fill();

    // Neural grid overlay — subtle cyan lines
    ctx.strokeStyle = 'rgba(0, 251, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let i = 0; i < W; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i - 60, H);
        ctx.stroke();
    }
    for (let i = 0; i < H; i += 40) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(W, i - 30);
        ctx.stroke();
    }

    // Left accent glow bar
    const glow = ctx.createLinearGradient(0, 0, 6, H);
    glow.addColorStop(0, 'rgba(0, 251, 255, 0)');
    glow.addColorStop(0.5, 'rgba(0, 251, 255, 0.8)');
    glow.addColorStop(1, 'rgba(0, 251, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 30, 6, H - 60);

    // Avatar with glow ring
    const av = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 256 })).catch(() => null);
    const ax = 40, ay = H / 2, ar = 55;

    // Outer glow
    ctx.beginPath();
    ctx.arc(ax + ar, ay, ar + 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 251, 255, 0.15)';
    ctx.fill();

    if (av) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax + ar, ay, ar, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(av, ax, ay - ar, ar * 2, ar * 2);
        ctx.restore();

        // Cyan ring
        ctx.beginPath();
        ctx.arc(ax + ar, ay, ar + 3, 0, Math.PI * 2);
        ctx.strokeStyle = '#00fbff';
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    // Text content
    const tx = 160;

    // "WELCOME" label
    ctx.fillStyle = '#00fbff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('WELCOME TO THE GRID', tx, 45);

    // Username
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px sans-serif';
    const name = member.user.username.length > 22 ? member.user.username.substring(0, 21) + '…' : member.user.username;
    ctx.fillText(name, tx, 85);

    // Stats row
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '13px sans-serif';
    const age = accountAgeShort(member.user.createdTimestamp);
    const isNew = (Date.now() - member.user.createdTimestamp) < 604800000;
    const newBadge = isNew ? '  ● NEW' : '';
    ctx.fillText(`${ordinal(count)} member  ·  ${age}${newBadge}`, tx, 115);

    // Server name (bottom right)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    const sName = member.guild.name.length > 35 ? member.guild.name.substring(0, 34) + '…' : member.guild.name;
    ctx.fillText(sName, W - 30, H - 30);

    // ARCHON badge (top right)
    ctx.fillStyle = 'rgba(0, 251, 255, 0.1)';
    roundRect(ctx, W - 140, 25, 110, 26, 6);
    ctx.fill();
    ctx.fillStyle = '#00fbff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ARCHON CG-223', W - 85, 42);

    // Decorative corner accents
    ctx.strokeStyle = 'rgba(0, 251, 255, 0.2)';
    ctx.lineWidth = 2;
    // Top-right corner
    ctx.beginPath();
    ctx.moveTo(W - 60, 0);
    ctx.lineTo(W, 0);
    ctx.lineTo(W, 60);
    ctx.stroke();
    // Bottom-left corner
    ctx.beginPath();
    ctx.moveTo(0, H - 60);
    ctx.lineTo(0, H);
    ctx.lineTo(60, H);
    ctx.stroke();

    return c.encode('png');
}

// ================= CANVAS: ULTIMATE GOODBYE CARD =================
async function renderGoodbyeCard(member, duration, roleCount) {
    const c = createCanvas(W, H);
    const ctx = c.getContext('2d');

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#1a0a0a');
    bg.addColorStop(0.5, '#2d1313');
    bg.addColorStop(1, '#1a0a0a');
    ctx.fillStyle = bg;
    roundRect(ctx, 0, 0, W, H, 24);
    ctx.fill();

    // Subtle grid
    ctx.strokeStyle = 'rgba(231, 76, 60, 0.03)';
    ctx.lineWidth = 1;
    for (let i = 0; i < W; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i - 60, H);
        ctx.stroke();
    }

    // Left accent glow bar — crimson
    const glow = ctx.createLinearGradient(0, 0, 6, H);
    glow.addColorStop(0, 'rgba(231, 76, 60, 0)');
    glow.addColorStop(0.5, 'rgba(231, 76, 60, 0.8)');
    glow.addColorStop(1, 'rgba(231, 76, 60, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 30, 6, H - 60);

    // Avatar with red glow
    const av = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 256 })).catch(() => null);
    const ax = 40, ay = H / 2, ar = 55;

    ctx.beginPath();
    ctx.arc(ax + ar, ay, ar + 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(231, 76, 60, 0.15)';
    ctx.fill();

    if (av) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax + ar, ay, ar, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(av, ax, ay - ar, ar * 2, ar * 2);
        ctx.restore();

        ctx.beginPath();
        ctx.arc(ax + ar, ay, ar + 3, 0, Math.PI * 2);
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    const tx = 160;

    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('DEPARTURE LOG', tx, 45);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px sans-serif';
    const name = member.user.username.length > 22 ? member.user.username.substring(0, 21) + '…' : member.user.username;
    ctx.fillText(name, tx, 85);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '13px sans-serif';
    const dur = duration || '< 1 minute';
    ctx.fillText(`Stayed: ${dur}  ·  ${roleCount} role${roleCount !== 1 ? 's' : ''} removed`, tx, 115);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    const sName = member.guild.name.length > 35 ? member.guild.name.substring(0, 34) + '…' : member.guild.name;
    ctx.fillText(sName, W - 30, H - 30);

    ctx.fillStyle = 'rgba(231, 76, 60, 0.1)';
    roundRect(ctx, W - 140, 25, 110, 26, 6);
    ctx.fill();
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ARCHON CG-223', W - 85, 42);

    // Decorative corners
    ctx.strokeStyle = 'rgba(231, 76, 60, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W - 60, 0);
    ctx.lineTo(W, 0);
    ctx.lineTo(W, 60);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, H - 60);
    ctx.lineTo(0, H);
    ctx.lineTo(60, H);
    ctx.stroke();

    return c.encode('png');
}

// ================= WARM WELCOME TEXT (NO ANSI BLOCK) =================
function warmWelcomeText(member, count, cfg) {
    const greetings = [
        `🎉 Welcome to **${member.guild.name}**, ${member.toString()}!`,
        `👋 Hey ${member.toString()}, welcome to **${member.guild.name}**!`,
        `🌟 ${member.toString()} just joined **${member.guild.name}** — welcome!`,
        `🚀 ${member.toString()} has entered **${member.guild.name}**!`,
        `✨ Welcome aboard, ${member.toString()}! **${member.guild.name}** just got better.`,
    ];

    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    const age = realAccountAge(member.user.createdTimestamp);
    const isNew = (Date.now() - member.user.createdTimestamp) < 604800000;
    const newBadge = isNew ? ' 🆕' : '';

    return `${greeting}
> 📊 You are member **#${count}** · Account: **${age}**${newBadge}`;
}

// ================= GOODBYE TEXT =================
function goodbyeText(member, duration, roleCount) {
    const farewells = [
        `👋 **${member.user.username}** has left the server.`,
        `🚪 **${member.user.username}** departed after ${duration || 'a brief visit'}.`,
        `💫 **${member.user.username}** is no longer with us.`,
        `🌙 **${member.user.username}** has disconnected from the grid.`,
    ];

    const farewell = farewells[Math.floor(Math.random() * farewells.length)];
    return `${farewell}
> ⏱️ Stayed: **${duration || 'N/A'}** · Roles removed: **${roleCount}**`;
}

// ================= RANDOM PRO-TIPS POOL =================
const ALL_TIPS = {
    en: {
        help:      { text: '`.help` — Discover all commands', weight: 10 },
        daily:     { text: '`.daily` — Daily reward (streak = bonus!)', weight: 10 },
        profile:   { text: '`.profile` — View your agent dossier', weight: 10 },
        lydia:     { text: '`.lydia [message]` — Chat with AI Lydia', weight: 8 },
        shop:      { text: '`.shop` — Buy boosts and items', weight: 8 },
        market:    { text: '`.market` — Invest in the Bamako market', weight: 6 },
        ticket:    { text: '`.ticket` — Open a support ticket', weight: 6 },
        trivia:    { text: '`.trivia` — Test your knowledge & earn XP', weight: 5 },
        rank:      { text: '`.rank` — Check your server standing', weight: 5 },
        whois:     { text: '`.whois @user` — Deep-scan any member', weight: 4 },
        game:      { text: '`.game` — Challenge other agents', weight: 4 },
        credits:   { text: '`.credits` — Check your balance', weight: 3 },
    },
    fr: {
        help:      { text: '`.help` — Découvrir toutes les commandes', weight: 10 },
        daily:     { text: '`.daily` — Récompense quotidienne (série = bonus !)', weight: 10 },
        profile:   { text: '`.profile` — Voir votre dossier d'agent', weight: 10 },
        lydia:     { text: '`.lydia [message]` — Discuter avec l'IA Lydia', weight: 8 },
        shop:      { text: '`.shop` — Acheter des boosts et objets', weight: 8 },
        market:    { text: '`.market` — Investir dans le marché de Bamako', weight: 6 },
        ticket:    { text: '`.ticket` — Ouvrir un ticket support', weight: 6 },
        trivia:    { text: '`.trivia` — Tester vos connaissances & gagner XP', weight: 5 },
        rank:      { text: '`.rank` — Voir votre position sur le serveur', weight: 5 },
        whois:     { text: '`.whois @user` — Scanner n'importe quel membre', weight: 4 },
        game:      { text: '`.game` — Défier d'autres agents', weight: 4 },
        credits:   { text: '`.credits` — Vérifier votre solde', weight: 3 },
    }
};

// ================= DYNAMIC PRO-TIPS (RANDOM FETCH) =================
function buildRandomTips(cfg, lang = 'en') {
    const pool = ALL_TIPS[lang] || ALL_TIPS.en;
    const tips = [];
    const p = cfg.prefix || '.';

    // Filter by enabled features
    const available = [];
    for (const [key, tip] of Object.entries(pool)) {
        let enabled = true;
        if (key === 'lydia' && !cfg.aiEnabled) enabled = false;
        if (key === 'market' && !cfg.marketEnabled) enabled = false;
        if (key === 'ticket' && !cfg.ticketEnabled) enabled = false;
        if (key === 'profile' && !cfg.levelingEnabled) enabled = false;
        if (key === 'rank' && !cfg.levelingEnabled) enabled = false;
        if (enabled) available.push(tip);
    }

    // Weighted random selection — pick 3-5 tips
    const count = Math.min(available.length, 3 + Math.floor(Math.random() * 3));
    const selected = [];
    const poolCopy = [...available];

    for (let i = 0; i < count && poolCopy.length > 0; i++) {
        const totalWeight = poolCopy.reduce((sum, t) => sum + t.weight, 0);
        let random = Math.random() * totalWeight;
        let index = 0;
        while (random > 0 && index < poolCopy.length) {
            random -= poolCopy[index].weight;
            if (random > 0) index++;
        }
        selected.push(poolCopy[index].text.replace(/\./g, p));
        poolCopy.splice(index, 1);
    }

    return selected;
}

// ================= BUTTON SUPPRESSION LOGIC =================
// Returns which buttons to show based on config (hide if channel is configured)
function getWelcomeButtons(cfg, member) {
    const buttons = [];

    // Rules button — only if rules channel is NOT configured
    if (!cfg.rulesChannel) {
        buttons.push({
            label: 'Rules',
            emoji: '📜',
            style: 'Link',
            url: `https://discord.com/channels/${member.guild.id}/${cfg.rulesChannel || member.guild.systemChannelId || member.guild.id}`,
            customId: null
        });
    }

    // General chat button — only if general channel is NOT configured
    if (!cfg.generalChannel) {
        buttons.push({
            label: 'General',
            emoji: '💬',
            style: 'Link',
            url: `https://discord.com/channels/${member.guild.id}/${cfg.generalChannel || member.guild.systemChannelId || member.guild.id}`,
            customId: null
        });
    }

    // AI Assistant — always show (unless you want to suppress it too)
    buttons.push({
        label: 'AI Assistant',
        emoji: '🤖',
        style: 'Primary',
        url: null,
        customId: 'welcome_help'
    });

    // Profile — always show
    buttons.push({
        label: 'My Profile',
        emoji: '👤',
        style: 'Success',
        url: null,
        customId: `welcome_profile_${member.user.id}`
    });

    return buttons;
}

// ================= EXPORT =================
module.exports = {
    // Config
    normalizeWelcomeConfig,
    formatTemplate,

    // Canvas
    renderWelcomeCard,
    renderGoodbyeCard,

    // Text
    warmWelcomeText,
    goodbyeText,

    // Tips
    buildRandomTips,

    // Buttons
    getWelcomeButtons,

    // Utils
    ordinal,
    fmtDur,
    realAccountAge,
    accountAgeShort,

    // Constants
    CARD_WIDTH: W,
    CARD_HEIGHT: H
};
