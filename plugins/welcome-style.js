// ╔══════════════════════════════════════════════════════════════════════╗
// ║  🦅 ARCHON CG-223 — WELCOME/GOODBYE SHARED CINEMATIC ENGINE v3.1  ║
// ║  FIX: Reduced canvas size (560x175) for compact mobile display     ║
// ╚══════════════════════════════════════════════════════════════════════╝

const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

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

// ================= CANVAS: WELCOME CARD (compact 560×175) =================
async function renderWelcomeCard(member, count, cfg) {
    const c = createCanvas(W, H);
    const ctx = c.getContext('2d');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.textBaseline = 'middle';

    // ── Background ──
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0,   '#070d1a');
    bgGrad.addColorStop(0.5, '#0b1428');
    bgGrad.addColorStop(1,   '#070d1a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Diagonal accent stripe (top-right)
    ctx.save();
    const stripeGrad = ctx.createLinearGradient(W - 180, 0, W, H);
    stripeGrad.addColorStop(0, 'rgba(0, 240, 255, 0.00)');
    stripeGrad.addColorStop(0.5, 'rgba(0, 240, 255, 0.05)');
    stripeGrad.addColorStop(1, 'rgba(0, 240, 255, 0.00)');
    ctx.fillStyle = stripeGrad;
    ctx.beginPath();
    ctx.moveTo(W - 200, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(W - 120, H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(0, 251, 255, 0.035)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 28) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 28) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Card border
    ctx.strokeStyle = 'rgba(0, 251, 255, 0.22)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, 1, 1, W - 2, H - 2, 8);
    ctx.stroke();

    // Avatar
    const av = await loadImage(
        member.user.displayAvatarURL({ extension: 'png', size: 256 })
    ).catch(() => null);

    const ar = 42;
    const ax = 30;
    const ay = H / 2;

    // Double glow ring
    ctx.beginPath();
    ctx.arc(ax + ar, ay, ar + 10, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 251, 255, 0.06)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ax + ar, ay, ar + 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 251, 255, 0.10)';
    ctx.fill();

    if (av) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax + ar, ay, ar, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(av, ax, ay - ar, ar * 2, ar * 2);
        ctx.restore();

        // Outer ring
        ctx.beginPath();
        ctx.arc(ax + ar, ay, ar + 3, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 251, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
        // Inner ring
        ctx.beginPath();
        ctx.arc(ax + ar, ay, ar + 1, 0, Math.PI * 2);
        ctx.strokeStyle = '#00fbff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    const tx = 132;

    // Label
    ctx.fillStyle = 'rgba(0, 251, 255, 0.8)';
    ctx.font = 'bold 8.5px sans-serif';
    ctx.textAlign = 'left';
    ctx.letterSpacing = '0.15em';
    ctx.fillText('WELCOME TO THE GRID', tx, 32);
    ctx.letterSpacing = '0';

    // Username
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 27px sans-serif';
    const name = member.user.username.length > 18
        ? member.user.username.substring(0, 17) + '…'
        : member.user.username;
    ctx.fillText(name, tx, 70);

    // Member number pill
    const memberText = ordinal(count) + ' member';
    ctx.font = 'bold 10px sans-serif';
    const pillW = ctx.measureText(memberText).width + 16;
    ctx.fillStyle = 'rgba(0, 251, 255, 0.15)';
    roundRect(ctx, tx, 84, pillW, 18, 9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 251, 255, 0.35)';
    ctx.lineWidth = 1;
    roundRect(ctx, tx, 84, pillW, 18, 9);
    ctx.stroke();
    ctx.fillStyle = '#00fbff';
    ctx.fillText(memberText, tx + pillW / 2, 93);

    // Account age
    const age = accountAgeShort(member.user.createdTimestamp);
    const isNew = (Date.now() - member.user.createdTimestamp) < 604800000;
    ctx.fillStyle = isNew ? '#f1c40f' : 'rgba(255,255,255,0.45)';
    ctx.font = (isNew ? 'bold ' : '') + '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(isNew ? '● NEW ACCOUNT · ' + age : age, tx + pillW + 10, 93);

    // Server name bottom right
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.font = '9.5px sans-serif';
    ctx.textAlign = 'right';
    const sName = member.guild.name.length > 28
        ? member.guild.name.substring(0, 27) + '…'
        : member.guild.name;
    ctx.fillText(sName, W - 18, H - 18);

    // Mali flag watermark bottom left
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🇲🇱 BAMAKO_223', 18, H - 18);

    // ARCHON badge top right
    ctx.fillStyle = 'rgba(0, 251, 255, 0.08)';
    roundRect(ctx, W - 112, 16, 94, 20, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,251,255,0.2)';
    ctx.lineWidth = 0.8;
    roundRect(ctx, W - 112, 16, 94, 20, 4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0, 251, 255, 0.7)';
    ctx.font = 'bold 7.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ARCHON CG-223', W - 65, 29);

    // Corner accents
    ctx.strokeStyle = 'rgba(0, 251, 255, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(W - 40, 0); ctx.lineTo(W, 0); ctx.lineTo(W, 40);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, H - 40); ctx.lineTo(0, H); ctx.lineTo(40, H);
    ctx.stroke();

    return c.encode('png');
}

// ================= CANVAS: GOODBYE CARD (compact 560×175) =================
async function renderGoodbyeCard(member, duration, roleCount) {
    const c = createCanvas(W, H);
    const ctx = c.getContext('2d');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.textBaseline = 'middle';

    // ── Background ──
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0,   '#1a0a0a');
    bgGrad.addColorStop(0.5, '#1f0d0d');
    bgGrad.addColorStop(1,   '#1a0a0a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(231, 76, 60, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 28) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 28) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Card border
    ctx.strokeStyle = 'rgba(231, 76, 60, 0.25)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, 1, 1, W - 2, H - 2, 8);
    ctx.stroke();

    const av = await loadImage(
        member.user.displayAvatarURL({ extension: 'png', size: 256 })
    ).catch(() => null);

    const ar = 42;
    const ax = 30;
    const ay = H / 2;

    ctx.beginPath();
    ctx.arc(ax + ar, ay, ar + 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(231, 76, 60, 0.12)';
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
        ctx.arc(ax + ar, ay, ar + 2, 0, Math.PI * 2);
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 2.5;
        ctx.stroke();
    }

    const tx = 132;

    // Diagonal accent stripe
    ctx.save();
    const stripeGrad = ctx.createLinearGradient(W - 180, 0, W, H);
    stripeGrad.addColorStop(0, 'rgba(231, 76, 60, 0.00)');
    stripeGrad.addColorStop(0.5, 'rgba(231, 76, 60, 0.05)');
    stripeGrad.addColorStop(1, 'rgba(231, 76, 60, 0.00)');
    ctx.fillStyle = stripeGrad;
    ctx.beginPath();
    ctx.moveTo(W - 200, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(W - 120, H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Label
    ctx.fillStyle = 'rgba(231, 76, 60, 0.85)';
    ctx.font = 'bold 8.5px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('DEPARTURE LOG', tx, 32);

    // Username
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 27px sans-serif';
    const name = member.user.username.length > 18
        ? member.user.username.substring(0, 17) + '\u2026'
        : member.user.username;
    ctx.fillText(name, tx, 70);

    // Duration pill
    const dur = duration || '< 1 min';
    const durText = 'Stayed: ' + dur;
    ctx.font = 'bold 10px sans-serif';
    const pillW = ctx.measureText(durText).width + 16;
    ctx.fillStyle = 'rgba(231, 76, 60, 0.15)';
    roundRect(ctx, tx, 84, pillW, 18, 9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(231, 76, 60, 0.35)';
    ctx.lineWidth = 1;
    roundRect(ctx, tx, 84, pillW, 18, 9);
    ctx.stroke();
    ctx.fillStyle = '#e74c3c';
    ctx.textAlign = 'center';
    ctx.fillText(durText, tx + pillW / 2, 93);

    // Role count
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${roleCount} role${roleCount !== 1 ? 's' : ''} removed`, tx + pillW + 10, 93);

    // Server name bottom right
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.font = '9.5px sans-serif';
    ctx.textAlign = 'right';
    const sName = member.guild.name.length > 28
        ? member.guild.name.substring(0, 27) + '\u2026'
        : member.guild.name;
    ctx.fillText(sName, W - 18, H - 18);

    // Mali flag watermark
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('\uD83C\uDDF2\uD83C\uDDF1 BAMAKO_223', 18, H - 18);

    // ARCHON badge top right
    ctx.fillStyle = 'rgba(231, 76, 60, 0.08)';
    roundRect(ctx, W - 112, 16, 94, 20, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(231,76,60,0.25)';
    ctx.lineWidth = 0.8;
    roundRect(ctx, W - 112, 16, 94, 20, 4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(231, 76, 60, 0.8)';
    ctx.font = 'bold 7.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ARCHON CG-223', W - 65, 29);

    // Corner accents
    ctx.strokeStyle = 'rgba(231, 76, 60, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(W - 40, 0); ctx.lineTo(W, 0); ctx.lineTo(W, 40);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, H - 40); ctx.lineTo(0, H); ctx.lineTo(40, H);
    ctx.stroke();

    return c.encode('png');
}
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
        `👋 **${member.user.username}** has left the server.`,
        `🚪 **${member.user.username}** departed after ${duration || 'a brief visit'}.`,
        `💫 **${member.user.username}** is no longer with us.`,
        `🌙 **${member.user.username}** has disconnected from the grid.`,
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

    if (!cfg.rulesChannel) {
        buttons.push({
            label: 'Rules', emoji: '📜', style: 'Link',
            url: `https://discord.com/channels/${member.guild.id}/${member.guild.systemChannelId || member.guild.id}`,
            customId: null
        });
    }

    if (!cfg.generalChannel) {
        buttons.push({
            label: 'General', emoji: '💬', style: 'Link',
            url: `https://discord.com/channels/${member.guild.id}/${member.guild.systemChannelId || member.guild.id}`,
            customId: null
        });
    }

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
