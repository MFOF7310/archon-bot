// ╔══════════════════════════════════════════════════════════════════════╗
// ║  🦅 ARCHON CG-223 — WELCOME/GOODBYE SHARED CINEMATIC ENGINE v3.1  ║
// ║  FIX: Reduced canvas size (560x175) for compact mobile display     ║
// ╚══════════════════════════════════════════════════════════════════════╝

const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

// ── Dynamic background loader — auto-detects any image in data/assets/ named welcome-* ──
let _cachedBg = null;
let _cachedBgPath = null;
async function loadWelcomeBg() {
    const assetsDir = path.join(__dirname, '..', 'data', 'assets');
    let files = [];
    try { files = fs.readdirSync(assetsDir); } catch (e) { return null; }
    const match = files.find(f => /^welcome-.*\.(jpg|jpeg|png|webp)$/i.test(f));
    if (!match) return null;
    const fullPath = path.join(assetsDir, match);
    if (_cachedBg && _cachedBgPath === fullPath) return _cachedBg;
    const img = await loadImage(fullPath);
    _cachedBg = img;
    _cachedBgPath = fullPath;
    return img;
}

// ── Reduced from 700×220 → 560×175 (20% smaller, much more compact on mobile) ──
const W = 560, H = 175;

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
    if (d > 30)  return `${Math.floor(d / 30)}mo ${d % 30}d`;
    if (d > 0)   return `${d}d ${h}h`;
    if (h > 0)   return `${h}h ${m}m`;
    return `${m}m`;
}

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
    if (months < 0) { years--; months += 12; }

    const parts = [];
    if (years > 0)              parts.push(`${years} year${years !== 1 ? 's' : ''}`);
    if (months > 0)             parts.push(`${months} month${months !== 1 ? 's' : ''}`);
    if (days > 0 && years === 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);

    return parts.length === 0 ? 'Created today' : parts.join(', ');
}

function accountAgeShort(createdAt) {
    const age = realAccountAge(createdAt);
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

// ================= CONFIG NORMALIZATION =================
function normalizeWelcomeConfig(ss) {
    if (!ss || typeof ss !== 'object') ss = {};
    return {
        welcomeChannel:  ss.welcomeChannel  || ss.welcome_channel  || ss.welcome  || null,
        goodbyeChannel:  ss.goodbyeChannel  || ss.goodbye_channel  || ss.goodbye  || null,
        welcomeMessage:  ss.welcomeMessage  || ss.welcome_message  || ss.welcomeMsg  || null,
        goodbyeMessage:  ss.goodbyeMessage  || ss.goodbye_message  || ss.goodbyemsg  || null,
        welcomeEnabled:  ss.welcomeEnabled !== false && ss.welcome_enabled !== 0,
        goodbyeEnabled:  ss.goodbyeEnabled !== false && ss.goodbye_enabled !== 0,
        prefix:          ss.prefix || '.',
        levelingEnabled: !!(ss.levelChannel || ss.levelup_channel || ss.xpMultiplier > 0),
        dailyEnabled:    true,
        shopEnabled:     true,
        aiEnabled:       ss.aiEnabled !== false && ss.ai_enabled !== 0,
        marketEnabled:   ss.marketEnabled !== false && ss.market_enabled !== 0,
        ticketEnabled:   !!(ss.ticketCategory || ss.ticket_category || ss.ticketStaffRole || ss.ticket_staff_role),
        rulesChannel:    ss.rulesChannel   || ss.rules_channel   || ss.rules   || null,
        generalChannel:  ss.generalChannel || ss.general_channel || ss.general || null,
        _raw: ss
    };
}

// ================= TEMPLATE FORMATTER =================
function formatTemplate(template, member, count) {
    if (!template) return '';
    return template
        .replace(/\{user\}/g,        member.toString())
        .replace(/\{username\}/g,    member.user.username)
        .replace(/\{server\}/g,      member.guild.name)
        .replace(/\{count\}/g,       count)
        .replace(/\{guild\}/g,       member.guild.name)
        .replace(/\{membercount\}/g, count)
        .replace(/\{mention\}/g,     member.toString())
        .replace(/\{age\}/g,         realAccountAge(member.user.createdTimestamp));
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

// ================= CANVAS: WELCOME CARD v4 (landscape 500x150 @ 2x) =================
async function renderWelcomeCard(member, count, cfg) {
    const SCALE = 2;
    const CW = 800 * SCALE, CH = 250 * SCALE;
    const c = createCanvas(CW, CH);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.textBaseline = 'middle';

    // Background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, CW, CH);

    // Chevron pattern
    ctx.save();
    ctx.strokeStyle = 'rgba(0,251,255,0.06)';
    ctx.lineWidth = 1.5;
    const cv = 24 * SCALE;
    for (let y = -cv; y < CH + cv; y += cv) {
        for (let x = -CW; x < CW * 2; x += cv * 2) {
            ctx.beginPath();
            ctx.moveTo(x, y + cv);
            ctx.lineTo(x + cv, y);
            ctx.lineTo(x + cv * 2, y + cv);
            ctx.stroke();
        }
    }
    ctx.restore();

    // Left cyan accent bar
    const barGrad = ctx.createLinearGradient(0, 0, 0, CH);
    barGrad.addColorStop(0, 'rgba(0,251,255,0.0)');
    barGrad.addColorStop(0.5, 'rgba(0,251,255,0.9)');
    barGrad.addColorStop(1, 'rgba(0,251,255,0.0)');
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, 0, 4 * SCALE, CH);

    // Glow border
    ctx.save();
    ctx.shadowColor = '#00fbff';
    ctx.shadowBlur = 20 * SCALE;
    ctx.strokeStyle = '#00fbff';
    ctx.lineWidth = 3;
    roundRect(ctx, 2, 2, CW - 4, CH - 4, 14 * SCALE);
    ctx.stroke();
    ctx.restore();

    // Avatar
    const av = await loadImage(
        member.user.displayAvatarURL({ extension: 'png', size: 256 })
    ).catch(() => null);

    const ar = 52 * SCALE;
    const ax = 20 * SCALE;
    const ay = CH / 2;

    // Glow behind avatar
    ctx.save();
    ctx.shadowColor = '#00fbff';
    ctx.shadowBlur = 18 * SCALE;
    ctx.beginPath();
    ctx.arc(ax + ar, ay, ar + 4, 0, Math.PI * 2);
    ctx.strokeStyle = '#00fbff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    if (av) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax + ar, ay, ar, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(av, ax, ay - ar, ar * 2, ar * 2);
        ctx.restore();
    }

    // Text start x
    const tx = ax + ar * 2 + 22 * SCALE;

    // Username — big and bold
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${26 * SCALE}px "Liberation Sans", Arial, sans-serif`;
    ctx.textAlign = 'left';
    const name = member.user.username.length > 18
        ? member.user.username.substring(0, 17) + '\u2026'
        : member.user.username;
    ctx.fillText(name, tx, CH * 0.35);

    // WELCOME TO THE GRID label — cyan below username
    ctx.fillStyle = '#00fbff';
    ctx.font = `bold ${8 * SCALE}px "Liberation Sans", Arial, sans-serif`;
    ctx.letterSpacing = `${1.5 * SCALE}px`;
    ctx.fillText('WELCOME TO THE GRID', tx, CH * 0.57);
    ctx.letterSpacing = '0px';

    // Member + age subtitle
    const age = accountAgeShort(member.user.createdTimestamp);
    const isNew = (Date.now() - member.user.createdTimestamp) < 604800000;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = `${8 * SCALE}px "Liberation Sans", Arial, sans-serif`;
    ctx.fillText(
        `${ordinal(count)} member  \u00b7  ${isNew ? '\uD83C\uDD95 ' : ''}${age} old account`,
        tx, CH * 0.76
    );

    // Server icon — top right
    try {
        const iconUrl = member.guild.iconURL({ extension: 'png', size: 128 });
        if (iconUrl) {
            const icon = await loadImage(iconUrl);
            const ir = 28 * SCALE;
            const ix = CW - ir * 2 - 14 * SCALE;
            const iy = 14 * SCALE;
            ctx.save();
            ctx.beginPath();
            ctx.arc(ix + ir, iy + ir, ir, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(icon, ix, iy, ir * 2, ir * 2);
            ctx.restore();
            // Icon border
            ctx.beginPath();
            ctx.arc(ix + ir, iy + ir, ir + 2, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0,251,255,0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    } catch(e) {}

    // Bottom right — server name
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.font = `${6.5 * SCALE}px "Liberation Sans", Arial, sans-serif`;
    ctx.textAlign = 'right';
    const sName = member.guild.name.length > 24
        ? member.guild.name.substring(0, 23) + '\u2026'
        : member.guild.name;
    ctx.fillText(sName, CW - 14 * SCALE, CH - 12 * SCALE);

    // Bottom left — Mali watermark
    ctx.textAlign = 'left';
    ctx.fillText('BAMAKO_223 [MLI]', 14 * SCALE, CH - 12 * SCALE);

    return c.encode('png');
}
// ================= CANVAS: GOODBYE CARD v4 (landscape 500x150 @ 2x) =================
async function renderGoodbyeCard(member, duration, roleCount) {
    const SCALE = 2;
    const CW = 800 * SCALE, CH = 250 * SCALE;
    const c = createCanvas(CW, CH);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.textBaseline = 'middle';

    // Background
    ctx.fillStyle = '#110a0a';
    ctx.fillRect(0, 0, CW, CH);

    // Chevron pattern
    ctx.save();
    ctx.strokeStyle = 'rgba(231,76,60,0.06)';
    ctx.lineWidth = 1.5;
    const cv = 24 * SCALE;
    for (let y = -cv; y < CH + cv; y += cv) {
        for (let x = -CW; x < CW * 2; x += cv * 2) {
            ctx.beginPath();
            ctx.moveTo(x, y + cv);
            ctx.lineTo(x + cv, y);
            ctx.lineTo(x + cv * 2, y + cv);
            ctx.stroke();
        }
    }
    ctx.restore();

    // Left red accent bar
    const barGrad = ctx.createLinearGradient(0, 0, 0, CH);
    barGrad.addColorStop(0, 'rgba(231,76,60,0.0)');
    barGrad.addColorStop(0.5, 'rgba(231,76,60,0.9)');
    barGrad.addColorStop(1, 'rgba(231,76,60,0.0)');
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, 0, 4 * SCALE, CH);

    // Glow border
    ctx.save();
    ctx.shadowColor = '#e74c3c';
    ctx.shadowBlur = 20 * SCALE;
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 3;
    roundRect(ctx, 2, 2, CW - 4, CH - 4, 14 * SCALE);
    ctx.stroke();
    ctx.restore();

    // Avatar
    const av = await loadImage(
        member.user.displayAvatarURL({ extension: 'png', size: 256 })
    ).catch(() => null);

    const ar = 52 * SCALE;
    const ax = 20 * SCALE;
    const ay = CH / 2;

    ctx.save();
    ctx.shadowColor = '#e74c3c';
    ctx.shadowBlur = 18 * SCALE;
    ctx.beginPath();
    ctx.arc(ax + ar, ay, ar + 4, 0, Math.PI * 2);
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    if (av) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax + ar, ay, ar, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(av, ax, ay - ar, ar * 2, ar * 2);
        ctx.restore();
    }

    const tx = ax + ar * 2 + 22 * SCALE;

    // Username
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${26 * SCALE}px "Liberation Sans", Arial, sans-serif`;
    ctx.textAlign = 'left';
    const name = member.user.username.length > 18
        ? member.user.username.substring(0, 17) + '\u2026'
        : member.user.username;
    ctx.fillText(name, tx, CH * 0.35);

    // DEPARTURE LOG label
    ctx.fillStyle = '#e74c3c';
    ctx.font = `bold ${8 * SCALE}px "Liberation Sans", Arial, sans-serif`;
    ctx.letterSpacing = `${1.5 * SCALE}px`;
    ctx.fillText('DEPARTURE LOG', tx, CH * 0.57);
    ctx.letterSpacing = '0px';

    // Duration + roles
    const dur = duration || '< 1 min';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = `${8 * SCALE}px "Liberation Sans", Arial, sans-serif`;
    ctx.fillText(
        `Stayed: ${dur}  \u00b7  ${roleCount} role${roleCount !== 1 ? 's' : ''} removed`,
        tx, CH * 0.76
    );

    // Watermarks
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.font = `${6.5 * SCALE}px "Liberation Sans", Arial, sans-serif`;
    ctx.textAlign = 'right';
    const sName = member.guild.name.length > 24
        ? member.guild.name.substring(0, 23) + '\u2026'
        : member.guild.name;
    ctx.fillText(sName, CW - 14 * SCALE, CH - 12 * SCALE);
    ctx.textAlign = 'left';
    ctx.fillText('BAMAKO_223 [MLI]', 14 * SCALE, CH - 12 * SCALE);

    // Server icon — top right
    try {
        const iconUrl = member.guild.iconURL({ extension: 'png', size: 128 });
        if (iconUrl) {
            const icon = await loadImage(iconUrl);
            const ir = 28 * SCALE;
            const ix = CW - ir * 2 - 14 * SCALE;
            const iy = 14 * SCALE;
            ctx.save();
            ctx.beginPath();
            ctx.arc(ix + ir, iy + ir, ir, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(icon, ix, iy, ir * 2, ir * 2);
            ctx.restore();
            ctx.beginPath();
            ctx.arc(ix + ir, iy + ir, ir + 2, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(231,76,60,0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    } catch(e) {}

    return c.encode('png');
}


// ================= WARM WELCOME TEXT =================
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
    return `${greeting}\n> 📊 You are member **#${count}** · Account: **${age}**${newBadge}`;
}

// ================= GOODBYE TEXT =================
function goodbyeText(member, duration, roleCount) {
    const farewells = [
        `👋 **${member.user.username}** has left — hope to see them again someday.`,
        `🚪 **${member.user.username}** stepped out after ${duration || 'a brief visit'}. Safe travels!`,
        `💫 **${member.user.username}** has moved on. Wishing them well out there.`,
        `🌙 **${member.user.username}** signed off. The grid remembers them fondly.`,
        `✈️ **${member.user.username}** flew the nest after ${duration || 'a visit'}. Until next time!`,
    ];
    const farewell = farewells[Math.floor(Math.random() * farewells.length)];
    return `${farewell}\n> ⏱️ Stayed: **${duration || 'N/A'}** · Roles removed: **${roleCount}**`;
}

// ================= RANDOM PRO-TIPS POOL =================
const ALL_TIPS = {
    en: {
        help:    { text: '`.help` — Discover all commands',              weight: 10 },
        daily:   { text: '`.daily` — Daily reward (streak = bonus!)',    weight: 10 },
        profile: { text: '`.profile` — View your agent dossier',         weight: 10 },
        lydia:   { text: '`.lydia [message]` — Chat with AI Lydia',      weight: 8  },
        shop:    { text: '`.shop` — Buy boosts and items',               weight: 8  },
        market:  { text: '`.market` — Invest in the Bamako market',      weight: 6  },
        ticket:  { text: '`.ticket` — Open a support ticket',            weight: 6  },
        trivia:  { text: '`.trivia` — Test your knowledge & earn XP',    weight: 5  },
        rank:    { text: '`.rank` — Check your server standing',         weight: 5  },
        whois:   { text: '`.whois @user` — Deep-scan any member',        weight: 4  },
        game:    { text: '`.game` — Challenge other agents',             weight: 4  },
        credits: { text: '`.credits` — Check your balance',              weight: 3  },
    },
    fr: {
        help:    { text: "`.help` — Découvrir toutes les commandes",                  weight: 10 },
        daily:   { text: "`.daily` — Récompense quotidienne (série = bonus !)",       weight: 10 },
        profile: { text: "`.profile` — Voir votre dossier d'agent",                   weight: 10 },
        lydia:   { text: "`.lydia [message]` — Discuter avec l'IA Lydia",             weight: 8  },
        shop:    { text: "`.shop` — Acheter des boosts et objets",                    weight: 8  },
        market:  { text: "`.market` — Investir dans le marché de Bamako",             weight: 6  },
        ticket:  { text: "`.ticket` — Ouvrir un ticket support",                      weight: 6  },
        trivia:  { text: "`.trivia` — Tester vos connaissances & gagner XP",          weight: 5  },
        rank:    { text: "`.rank` — Voir votre position sur le serveur",              weight: 5  },
        whois:   { text: "`.whois @user` — Scanner n'importe quel membre",            weight: 4  },
        game:    { text: "`.game` — Défier d'autres agents",                          weight: 4  },
        credits: { text: "`.credits` — Vérifier votre solde",                         weight: 3  },
    }
};

function buildRandomTips(cfg, lang = 'en') {
    const pool = ALL_TIPS[lang] || ALL_TIPS.en;
    const p = cfg.prefix || '.';
    const available = [];

    for (const [key, tip] of Object.entries(pool)) {
        let enabled = true;
        if (key === 'lydia'   && !cfg.aiEnabled)      enabled = false;
        if (key === 'market'  && !cfg.marketEnabled)   enabled = false;
        if (key === 'ticket'  && !cfg.ticketEnabled)   enabled = false;
        if (key === 'profile' && !cfg.levelingEnabled) enabled = false;
        if (key === 'rank'    && !cfg.levelingEnabled) enabled = false;
        if (enabled) available.push(tip);
    }

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

// ================= BUTTON DEFINITIONS =================
function getWelcomeButtons(cfg, member) {
    const buttons = [];
    const guildId = member.guild.id;
    const fallbackId = member.guild.systemChannelId || guildId;

    // Rules button — use configured channel if set, else fallback to system channel
    const rulesId = cfg.rulesChannel || null;
    buttons.push({
        label: 'Rules', emoji: '📜', style: 'Link',
        url: `https://discord.com/channels/${guildId}/${rulesId || fallbackId}`,
        customId: null
    });

    // General button — use configured channel if set, else fallback to system channel
    const generalId = cfg.generalChannel || null;
    buttons.push({
        label: 'General', emoji: '💬', style: 'Link',
        url: `https://discord.com/channels/${guildId}/${generalId || fallbackId}`,
        customId: null
    });

    buttons.push({ label: 'AI Assistant', emoji: '🤖', style: 'Primary', url: null, customId: 'welcome_help' });
    buttons.push({ label: 'My Profile',   emoji: '👤', style: 'Success', url: null, customId: `welcome_profile_${member.user.id}` });

    return buttons;
}

// ================= EXPORT =================
module.exports = {
    normalizeWelcomeConfig,
    formatTemplate,
    renderWelcomeCard,
    renderGoodbyeCard,
    warmWelcomeText,
    goodbyeText,
    buildRandomTips,
    getWelcomeButtons,
    ordinal,
    fmtDur,
    realAccountAge,
    accountAgeShort,
    CARD_WIDTH:  W,
    CARD_HEIGHT: H,
};
