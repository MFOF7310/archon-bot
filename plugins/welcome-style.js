// ╔══════════════════════════════════════════════════════════════════════╗
// ║  🦅 ARCHON CG-223 — WELCOME/GOODBYE SHARED CINEMATIC ENGINE        ║
// ║  Neural Grid Style Module v2.0 — Bamako Steel Edition               ║
// ╚══════════════════════════════════════════════════════════════════════╝

const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const W = 520, H = 140; // Compact card size — mobile-optimized

// ================= SMART UTILITIES =================
function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function fmtDur(ms) {
    if (!ms || ms < 60000) return '< 1m';
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
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

// ================= CONFIG NORMALIZATION (CRITICAL BUGFIX) =================
// Handles the DB column mismatch between serversettings.js ('welcome'/'goodbye')
// and index.js/welcome.js ('welcomeChannel'/'welcome_channel')
function normalizeWelcomeConfig(ss) {
    if (!ss || typeof ss !== 'object') ss = {};
    return {
        // Channel IDs — cascade through all known variants
        welcomeChannel:    ss.welcomeChannel    || ss.welcome_channel    || ss.welcome    || null,
        goodbyeChannel:    ss.goodbyeChannel    || ss.goodbye_channel    || ss.goodbye    || null,
        
        // Message templates
        welcomeMessage:    ss.welcomeMessage    || ss.welcome_message    || ss.welcomeMsg    || null,
        goodbyeMessage:    ss.goodbyeMessage    || ss.goodbye_message    || ss.goodbyemsg    || null,
        
        // Toggles
        welcomeEnabled:    ss.welcomeEnabled !== false && ss.welcome_enabled !== 0,
        goodbyeEnabled:    ss.goodbyeEnabled !== false && ss.goodbye_enabled !== 0,
        
        // Prefix for tips
        prefix:            ss.prefix || '.',
        
        // Feature flags for dynamic tips
        levelingEnabled:   ss.levelChannel || ss.levelup_channel || ss.xpMultiplier > 0,
        dailyEnabled:      true, // Always on by default
        shopEnabled:       true,
        aiEnabled:         ss.aiEnabled !== false && ss.ai_enabled !== 0,
        marketEnabled:     ss.marketEnabled !== false && ss.market_enabled !== 0,
        ticketEnabled:     ss.ticketCategory || ss.ticket_category || ss.ticketStaffRole || ss.ticket_staff_role,
        
        // Raw for advanced checks
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
        .replace(/\{mention\}/g, member.toString());
}

// ================= CANVAS: ROUNDED RECT HELPER =================
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

// ================= CANVAS: COMPACT WELCOME CARD =================
async function renderWelcomeCard(member, count) {
    const c = createCanvas(W, H);
    const ctx = c.getContext('2d');

    // Background — deep neural grid
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#1a1a2e');
    g.addColorStop(1, '#16213e');
    ctx.fillStyle = g;
    roundRect(ctx, 0, 0, W, H, 16);
    ctx.fill();

    // Neural grid lines — subtle, mobile-friendly
    ctx.strokeStyle = 'rgba(0, 251, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i < W; i += 30) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i - 40, H);
        ctx.stroke();
    }

    // Left accent bar — cyan neural pulse
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
        // Cyan ring
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

    // Stats row — account age + member count
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.font = '11px sans-serif';
    const age = accountAge(member.user.createdTimestamp);
    const isSus = (Date.now() - member.user.createdTimestamp) < 604800000; // < 7 days
    const ageColor = isSus ? '  [NEW]' : '';
    ctx.fillText(`#${ordinal(count)} member  |  ${age}${ageColor}`, 100, 78);

    // Server name (bottom right, subtle)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    const sName = member.guild.name.length > 25 ? member.guild.name.substring(0, 24) + '...' : member.guild.name;
    ctx.fillText(sName, W - 18, H - 18);

    // "ARCHON" badge (top right)
    ctx.fillStyle = 'rgba(0, 251, 255, 0.15)';
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

    // Background — crimson departure
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#1a0a0a');
    g.addColorStop(1, '#2d1313');
    ctx.fillStyle = g;
    roundRect(ctx, 0, 0, W, H, 16);
    ctx.fill();

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(231, 76, 60, 0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i < W; i += 30) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i - 40, H);
        ctx.stroke();
    }

    // Left accent bar — red
    ctx.fillStyle = '#e74c3c';
    roundRect(ctx, 0, 20, 4, H - 40, 2);
    ctx.fill();

    // Avatar with red ring
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

    // "DEPARTED" label
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('DEPARTED', 100, 32);

    // Username
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    const name = member.user.username.length > 18 ? member.user.username.substring(0, 17) + '...' : member.user.username;
    ctx.fillText(name, 100, 56);

    // Stats row
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.font = '11px sans-serif';
    const dur = duration || '< 1m';
    ctx.fillText(`Stay: ${dur}  |  ${roleCount} role${roleCount !== 1 ? 's' : ''} removed`, 100, 78);

    // Server name
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    const sName = member.guild.name.length > 25 ? member.guild.name.substring(0, 24) + '...' : member.guild.name;
    ctx.fillText(sName, W - 18, H - 18);

    // ARCHON badge — red
    ctx.fillStyle = 'rgba(231, 76, 60, 0.15)';
    roundRect(ctx, W - 90, 14, 72, 20, 4);
    ctx.fill();
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ARCHON CG-223', W - 54, 27);

    return c.encode('png');
}

// ================= NEURAL GRID ANSI TEXT — MOBILE OPTIMIZED =================
// Borders aligned to 42 chars wide for perfect mobile rendering (Z Fold 5, etc.)
function ansiWelcome(member, count) {
    const name = member.user.username;
    const isNew = (Date.now() - member.user.createdTimestamp) < 604800000;
    const age = accountAge(member.user.createdTimestamp);
    const newFlag = isNew ? '\u001b[1;31m[NEW]\u001b[0m' : '';
    
    return '```ansi\n' +
        '\u001b[0;36m╔══════════════════════════════════════╗\u001b[0m\n' +
        '\u001b[0;36m║\u001b[1;36m  NEURAL LINK ESTABLISHED            \u001b[0;36m║\u001b[0m\n' +
        '\u001b[0;36m╠══════════════════════════════════════╣\u001b[0m\n' +
        `\u001b[0;36m║\u001b[0m  Node: \u001b[1;33m${name.substring(0,16).padEnd(16)}\u001b[0m #${String(count).padStart(4)}  \u001b[0;36m║\u001b[0m\n` +
        `\u001b[0;36m║\u001b[0m  Grid: \u001b[0;37m${member.guild.name.substring(0,24).padEnd(24)}\u001b[0m  \u001b[0;36m║\u001b[0m\n` +
        `\u001b[0;36m║\u001b[0m  Age:  \u001b[0;37m${age.substring(0,24).padEnd(24)}\u001b[0m ${newFlag.padEnd(6)}\u001b[0;36m║\u001b[0m\n` +
        '\u001b[0;36m╚══════════════════════════════════════╝\u001b[0m\n' +
        '```\n' +
        `${member.toString()} **Welcome to the grid.**`;
}

function ansiGoodbye(member, duration, roleCount, roles) {
    const name = member.user.username;
    const dur = duration || '< 1m';
    const rl = roles.slice(0, 3).map(r => r.name).join(', ') || 'None';
    return '```ansi\n' +
        '\u001b[0;31m╔══════════════════════════════════════╗\u001b[0m\n' +
        '\u001b[0;31m║\u001b[1;31m  NEURAL LINK SEVERED               \u001b[0;31m║\u001b[0m\n' +
        '\u001b[0;31m╠══════════════════════════════════════╣\u001b[0m\n' +
        `\u001b[0;31m║\u001b[0m  Node: \u001b[1;33m${name.substring(0,16).padEnd(16)}\u001b[0m        \u001b[0;31m║\u001b[0m\n` +
        `\u001b[0;31m║\u001b[0m  Stay: \u001b[0;37m${dur.padEnd(24)}\u001b[0m        \u001b[0;31m║\u001b[0m\n` +
        `\u001b[0;31m║\u001b[0m  Roles:\u001b[0;37m${rl.substring(0, 28).padEnd(28)}\u001b[0m  \u001b[0;31m║\u001b[0m\n` +
        '\u001b[0;31m╚══════════════════════════════════════╝\u001b[0m\n' +
        '```';
}

// ================= DYNAMIC PRO-TIPS BUILDER =================
// Builds tips based on which features are actually enabled for the server
function buildProTips(cfg, lang = 'en') {
    const tips = [];
    const p = cfg.prefix || '.';
    
    if (lang === 'fr') {
        tips.push(`\`${p}help\` — Découvrir toutes les commandes`);
        if (cfg.dailyEnabled) tips.push(`\`${p}daily\` — Récompense quotidienne (série = bonus !)`);
        if (cfg.levelingEnabled) tips.push(`\`${p}profile\` — Voir votre dossier d'agent`);
        if (cfg.aiEnabled) tips.push(`\`${p}lydia [message]\` — Discuter avec l'IA Lydia`);
        if (cfg.shopEnabled) tips.push(`\`${p}shop\` — Acheter des boosts et objets`);
        if (cfg.marketEnabled) tips.push(`\`${p}market\` — Investir dans le marché de Bamako`);
        if (cfg.ticketEnabled) tips.push(`\`${p}ticket\` — Ouvrir un ticket support`);
    } else {
        tips.push(`\`${p}help\` — Discover all commands`);
        if (cfg.dailyEnabled) tips.push(`\`${p}daily\` — Daily reward (streak = bonus!)`);
        if (cfg.levelingEnabled) tips.push(`\`${p}profile\` — View your agent dossier`);
        if (cfg.aiEnabled) tips.push(`\`${p}lydia [message]\` — Chat with AI Lydia`);
        if (cfg.shopEnabled) tips.push(`\`${p}shop\` — Buy boosts and items`);
        if (cfg.marketEnabled) tips.push(`\`${p}market\` — Invest in the Bamako market`);
        if (cfg.ticketEnabled) tips.push(`\`${p}ticket\` — Open a support ticket`);
    }
    
    // Always add at least one tip
    if (tips.length === 0) {
        tips.push(lang === 'fr' ? `\`${p}help\` — Commencer` : `\`${p}help\` — Get started`);
    }
    
    return tips;
}

// ================= EXPORT =================
module.exports = {
    // Config
    normalizeWelcomeConfig,
    formatTemplate,
    
    // Canvas
    renderWelcomeCard,
    renderGoodbyeCard,
    
    // ANSI
    ansiWelcome,
    ansiGoodbye,
    
    // Tips
    buildProTips,
    
    // Utils
    ordinal,
    fmtDur,
    accountAge,
    
    // Constants
    CARD_WIDTH: W,
    CARD_HEIGHT: H
};
