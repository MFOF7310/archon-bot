// ╔══════════════════════════════════════════════════════════════════════╗
// ║  🦅 ARCHON CG-223 — WELCOME/GOODBYE SHARED CINEMATIC ENGINE v3.1  ║
// ║  FIX: Reduced canvas size (560x175) for compact mobile display     ║
// ╚══════════════════════════════════════════════════════════════════════╝

const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const EMOJIS = require('../config/emojis');
const { t } = require('../lib/i18n');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');
try {
    GlobalFonts.registerFromPath(path.join(__dirname, '..', 'assets', 'fonts', 'ChakraPetch-Bold.ttf'), 'Chakra Petch');
    console.log('[WELCOME] Chakra Petch font registered ✅');
} catch (e) { console.error('[WELCOME] font register failed:', e.message); }

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

// ── Mascot loader — assets/welcome/{mascot,eagle}.{png,jpg,jpeg,webp}
// Flood-fill keying: only border-connected dark pixels become transparent,
// so black clothing/interior darks stay opaque. ──
const _mascotCache = new Map();
function keyDarkBackground(tctx, w, h) {
    const data = tctx.getImageData(0, 0, w, h);
    const px = data.data;
    const visited = new Uint8Array(w * h);
    const stack = [];
    const push = (x, y) => { const idx = y * w + x; if (!visited[idx]) { visited[idx] = 1; stack.push(idx); } };
    for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
    for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
    while (stack.length) {
        const idx = stack.pop();
        const i = idx * 4;
        const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        if (lum > 55) continue; // too bright = part of the character, stop the flood
        px[i + 3] = 0;
        const x = idx % w, y = (idx / w) | 0;
        if (x > 0) push(x - 1, y);
        if (x < w - 1) push(x + 1, y);
        if (y > 0) push(x, y - 1);
        if (y < h - 1) push(x, y + 1);
    }
    tctx.putImageData(data, 0, 0);
}
async function loadMascotFile(base) {
    // Random pick among assets/welcome/{base}{optional digit}.{ext}
    // e.g. mascot.jpg, mascot2.jpg, mascot3.png ... each flood-fill keyed once, cached by filename
    const LIST = '_list_' + base;
    if (!_mascotCache.has(LIST)) {
        const dir = path.join(__dirname, '..', 'assets', 'welcome');
        let files = [];
        try {
            const re = new RegExp('^' + base + '\\d*\\.(png|jpg|jpeg|webp)$', 'i');
            files = fs.readdirSync(dir).filter(f => re.test(f));
        } catch (e) {}
        _mascotCache.set(LIST, files);
    }
    const files = _mascotCache.get(LIST);
    if (!files || !files.length) return null;
    const file = files[Math.floor(Math.random() * files.length)];
    if (_mascotCache.has(file)) return _mascotCache.get(file);
    let keyed = null;
    try {
        const img = await loadImage(path.join(__dirname, '..', 'assets', 'welcome', file));
        const w = img.width, h = img.height;
        const tmp = createCanvas(w, h);
        const tctx = tmp.getContext('2d');
        tctx.drawImage(img, 0, 0);
        keyDarkBackground(tctx, w, h);
        keyed = tmp;
    } catch (e) {}
    _mascotCache.set(file, keyed);
    return keyed;
}
function drawMascot(ctx, img, CW, CH, SCALE) {
    if (!img) return;
    const h = CH - 30 * SCALE;
    const w = h * (img.width / img.height);
    const x = CW - w - 52 * SCALE;
    const y = CH - h - 12 * SCALE;
    ctx.save();
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
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
        economyEnabled:  ss.economy_enabled !== 0 && ss.economyEnabled !== false,
        levelingEnabled: ss.leveling_enabled !== 0 && !!(ss.levelChannel || ss.levelup_channel || ss.xpMultiplier > 0),
        dailyEnabled:    true,
        shopEnabled:     true,
        aiEnabled:       ss.aiEnabled !== false && ss.ai_enabled !== 0,
        marketEnabled:   ss.marketEnabled !== false && ss.market_enabled !== 0,
        ticketEnabled:   ss.tickets_enabled !== 0 && !!(ss.ticketCategory || ss.ticket_category || ss.ticketStaffRole || ss.ticket_staff_role),
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

    // Milestone accent — 1000th cyan, 500th purple, 100th yellow, else default gold
    const isMilestone1000 = count % 1000 === 0;
    const isMilestone500  = count % 500  === 0;
    const isMilestone100  = count % 100  === 0;
    const roleHex = member.roles?.color?.hex;
    const accent = cfg.welcomeAccent || (roleHex && roleHex !== '#000000' ? roleHex : null)
        || (isMilestone1000 ? '#00f0ff'
        : isMilestone500  ? '#9b59b6'
        : isMilestone100  ? '#f1c40f'
        : '#2ecc71');

    // Background
    ctx.fillStyle = '#0a1f0a';
    ctx.fillRect(0, 0, CW, CH);

    // Left accent bar
    const barGrad = ctx.createLinearGradient(0, 0, 0, CH);
    barGrad.addColorStop(0, 'rgba(46,204,113,0.0)');
    barGrad.addColorStop(0.5, 'rgba(46,204,113,0.9)');
    barGrad.addColorStop(1, 'rgba(46,204,113,0.0)');
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, 0, 4 * SCALE, CH);

    // Glow border
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = 20 * SCALE;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    roundRect(ctx, 2, 2, CW - 4, CH - 4, 14 * SCALE);
    ctx.stroke();
    ctx.restore();

    // v6: character art (replaces old avatar-in-canvas slot)
    const _char = await loadMascotFile('archon-mascot');
    if (_char) {
        const _maxW = CW * 0.35;
        const _aspect = _char.width / _char.height;
        const _drawH = CH - 8 * SCALE;
        let _drawW = _drawH * _aspect;
        let _dh = _drawH;
        if (_drawW > _maxW) { _drawW = _maxW; _dh = _drawW / _aspect; }
        ctx.drawImage(_char, 0, CH - _dh, _drawW, _dh);
    }

    // Text start x
    const tx = CW * 0.37;


    // Username
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${34 * SCALE}px "Chakra Petch", "DejaVu Sans", sans-serif`;
    ctx.textAlign = 'left';
    const name = member.user.username.length > 18
        ? member.user.username.substring(0, 17) + '\u2026'
        : member.user.username;
    ctx.fillText(name, tx, CH * 0.32);

    // Label
    ctx.fillStyle = accent;
    ctx.font = `bold ${11 * SCALE}px "Chakra Petch", "DejaVu Sans", sans-serif`;
    ctx.letterSpacing = `${2 * SCALE}px`;
    ctx.fillText('AW BISIMILA [MLI] -- ARCHON CG-223', tx, CH * 0.52);
    ctx.letterSpacing = '0px';

    // Member + age subtitle
    const age = accountAgeShort(member.user.createdTimestamp);
    const isNew = (Date.now() - member.user.createdTimestamp) < 604800000;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `${10 * SCALE}px "Chakra Petch", "DejaVu Sans", sans-serif`;
    ctx.fillText(
        `${ordinal(count)} member  \u00b7  ${isNew ? '[NEW] ' : ''}${age} old account`,
        tx, CH * 0.72
    );

    // Milestone badge
    if (isMilestone100 || isMilestone500 || isMilestone1000) {
        ctx.fillStyle = accent;
        ctx.font = `bold ${10 * SCALE}px "Chakra Petch", "DejaVu Sans", sans-serif`;
        ctx.fillText(`\uD83C\uDF96\uFE0F ${ordinal(count).toUpperCase()} MEMBER`, tx, CH * 0.86);
    }

    // Mascot — right side (screen blend: dark AI bg disappears on dark card)
    const mascotImg = await loadMascotFile('mascot');
    drawMascot(ctx, mascotImg, CW, CH, SCALE);

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
            ctx.strokeStyle = 'rgba(46,204,113,0.6)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    } catch(e) {}

    // Bottom right — server name
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.font = `${6.5 * SCALE}px "Chakra Petch", "DejaVu Sans", sans-serif`;
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
    ctx.fillStyle = '#160a0a';
    ctx.fillRect(0, 0, CW, CH);


    // Left red accent bar
    const barGrad = ctx.createLinearGradient(0, 0, 0, CH);
    barGrad.addColorStop(0, 'rgba(255,56,56,0.0)');
    barGrad.addColorStop(0.5, 'rgba(255,56,56,0.9)');
    barGrad.addColorStop(1, 'rgba(255,56,56,0.0)');
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, 0, 4 * SCALE, CH);

    // Glow border
    ctx.save();
    ctx.shadowColor = '#ff4757';
    ctx.shadowBlur = 20 * SCALE;
    ctx.strokeStyle = '#ff4757';
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
    ctx.shadowColor = '#ff4757';
    ctx.shadowBlur = 18 * SCALE;
    ctx.beginPath();
    ctx.arc(ax + ar, ay, ar + 4, 0, Math.PI * 2);
    ctx.strokeStyle = '#ff4757';
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
    ctx.font = `bold ${34 * SCALE}px "Chakra Petch", "DejaVu Sans", sans-serif`;
    ctx.textAlign = 'left';
    const name = member.user.username.length > 18
        ? member.user.username.substring(0, 17) + '\u2026'
        : member.user.username;
    ctx.fillText(name, tx, CH * 0.32);

    // DEPARTURE LOG label
    ctx.fillStyle = '#ff4757';
    ctx.font = `bold ${11 * SCALE}px "Chakra Petch", "DejaVu Sans", sans-serif`;
    ctx.letterSpacing = `${2 * SCALE}px`;
    ctx.fillText('AW KANBE [MLI] -- ARCHON CG-223', tx, CH * 0.52);
    ctx.letterSpacing = '0px';

    // Duration + roles
    const dur = duration || '< 1 min';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `${10 * SCALE}px "Chakra Petch", "DejaVu Sans", sans-serif`;
    ctx.fillText(
        `Stayed: ${dur}  \u00b7  ${roleCount} role${roleCount !== 1 ? 's' : ''} removed`,
        tx, CH * 0.72
    );

    // Watermarks
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.font = `${6.5 * SCALE}px "Chakra Petch", "DejaVu Sans", sans-serif`;
    ctx.textAlign = 'right';
    const sName = member.guild.name.length > 24
        ? member.guild.name.substring(0, 23) + '\u2026'
        : member.guild.name;
    ctx.fillText(sName, CW - 14 * SCALE, CH - 12 * SCALE);
    ctx.textAlign = 'left';
    ctx.fillText('BAMAKO_223 [MLI]', 14 * SCALE, CH - 12 * SCALE);

    // Eagle emblem — right side
    const eagleImg = await loadMascotFile('eagle');
    drawMascot(ctx, eagleImg, CW, CH, SCALE);

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
            ctx.strokeStyle = 'rgba(255,71,87,0.6)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    } catch(e) {}

    return c.encode('png');
}


// ================= WARM WELCOME TEXT =================
function warmWelcomeText(member, count, cfg) {
    // v7: warm tone rewrite — direct address, `-#` info line, REG emojis
    const lang = cfg.lang || 'en';
    const party = cfg.party || EMOJIS.party || '🎉';
    const wave = cfg.wave || EMOJIS.wave || '👋';
    const memberEmoji = cfg.memberEmoji || '📊';
    const u = member.toString();
    const g = member.guild.name;

    const greetings = {
        en: [
            `${party} Hey ${u} — welcome to **${g}**. Saved you a seat.`,
            `${wave} ${u}, you found us. **${g}** just got better with you in it.`,
            `✨ Welcome in, ${u}. **${g}** — make yourself at home.`,
            `${party} ${u} just walked in. **${g}**, say hi.`,
            `${u}, glad you're here. **${g}** — no rush, look around.`,
        ],
        fr: [
            `${party} Salut ${u} — bienvenue sur **${g}**. On t'a gardé une place.`,
            `${wave} ${u}, tu nous as trouvés. **${g}** est mieux avec toi.`,
            `✨ Bienvenue ${u}. **${g}** — fais comme chez toi.`,
            `${party} ${u} vient d'arriver. **${g}**, dis bonjour.`,
            `${u}, content de te voir. **${g}** — prends ton temps, regarde autour.`,
        ],
        bm: [
            `${party} I bisimila **${g}** kan, ${u}. An ye sigi yɔrɔ dɔ bila i ye.`,
            `${wave} ${u}, i ye an sɔrɔ. An sewara ni i ka naali ye — **${g}** ka cogoya ka fisa k'i to a kɔnɔ.`,
            `✨ I bisimila, ${u}. **${g}** — a kɛ i n'a fɔ i bɛ i ka so.`,
            `${party} ${u} nana sisan sisan. **${g}**, foli bila an na.`,
            `${u}, n'nisɔndiyara n'i ka naali ye. **${g}** — kana kɔrɔtɔ, hakɛto i ka salɔnw lajɛ.`,
        ],
        ar: [
            `${party} مرحباً ${u} — أهلاً بك في **${g}**. حجزنا لك مقعداً.`,
            `${wave} ${u}، وجدتنا. **${g}** أجمل بوجودك.`,
            `✨ أهلاً ${u}. **${g}** — اعتبره بيتك.`,
            `${party} ${u} دخل للتو. **${g}**، قل مرحباً.`,
            `${u}، سعيد بوجودك. **${g}** — خذ وقتك، تعرّف على المكان.`,
        ],
        zh: [
            `${party} 嗨 ${u} —— 欢迎来到 **${g}**。给你留了位置。`,
            `${wave} ${u}，你找到我们了。**${g}** 因你更精彩。`,
            `✨ 欢迎 ${u}。**${g}** —— 就当自己家。`,
            `${party} ${u} 刚进门。**${g}**，打个招呼吧。`,
            `${u}，很高兴你来了。**${g}** —— 不急，先逛逛。`,
        ],
    };

    const pool = greetings[lang] || greetings.en;
    const greeting = pool[Math.floor(Math.random() * pool.length)];
    // v7.1: info line dropped — canvas already shows member # and account age
    return greeting;
}

// ================= GOODBYE TEXT =================
function goodbyeText(member, duration, roleCount, lang = 'en') {
    // v7: warm tone rewrite — direct address, `-#` info line, REG emojis
    const wave = EMOJIS.wave || '👋';
    const dur = duration || 'a short stay';
    const u = `**${member.user.username}**`;

    const farewells = {
        en: [
            `${wave} ${u} left today after ${dur}. Hope our paths cross again.`,
            `🌙 ${u} signed off. The grid keeps a light on.`,
            `💫 ${u} — ${dur} with us, and it mattered. Come back when it's right.`,
            `🚪 ${u} stepped out. That seat's still theirs if they want it.`,
            `✈️ ${u} took off after ${dur}. Safe travels, friend.`,
        ],
        fr: [
            `${wave} ${u} est parti après ${dur}. J'espère qu'on se reverra.`,
            `🌙 ${u} s'est déconnecté. Le serveur garde une lumière allumée.`,
            `💫 ${u} — ${dur} avec nous, et ça comptait. Reviens quand tu veux.`,
            `🚪 ${u} est sorti. Sa place reste libre s'il revient.`,
            `✈️ ${u} a pris son envol après ${dur}. Bon voyage, l'ami.`,
        ],
        bm: [
            `${wave} ${u} bɔra bi, ${dur} kɔn. K'an bɛn tugun.`,
            `🌙 ${u} taa ra. An bɛ an hakili to i la.`,
            `💫 ${u} — ${dur} an fɛ, o tun falen. Segi ni i sɔnna.`,
            `🚪 ${u} bɔra. A ka sigi yɔrɔ bɛ yen.`,
            `✈️ ${u} taara ${dur} kɔ. K'an bɛn.`,
        ],
        ar: [
            `${wave} ${u} غادر اليوم بعد ${dur}. نأمل أن نلتقي مجدداً.`,
            `🌙 ${u} أوقف الاتصال. السيرفر يُبقي الضوء مضاءً.`,
            `💫 ${u} — ${dur} معنا، وكان ذلك مهمّاً. عُد متى شئت.`,
            `🚪 ${u} خرج. مقعده ما زال محفوظاً إن أراد العودة.`,
            `✈️ ${u} حلّق بعد ${dur}. رحلة آمنة يا صديق.`,
        ],
        zh: [
            `${wave} ${u} 今天离开了，陪了我们 ${dur}。希望还能再见。`,
            `🌙 ${u} 下线了。服务器留着一盏灯。`,
            `💫 ${u} —— ${dur}，这段时光有意义。想回来就回来。`,
            `🚪 ${u} 出门了。他的位置还留着。`,
            `✈️ ${u} 在 ${dur} 后起飞了。一路顺风，朋友。`,
        ],
    };

    const pool = farewells[lang] || farewells.en;
    const farewell = pool[Math.floor(Math.random() * pool.length)];

    // v7.1: info line dropped — canvas already shows duration and roles
    return farewell;
}

// ================= BUTTON DEFINITIONS =================
function getWelcomeButtons(cfg, member) {
    const lang = cfg.lang || 'en';
    const buttons = [];
    const guildId = member.guild.id;
    const fallbackId = member.guild.systemChannelId || guildId;

    // Rules button — use configured channel if set, else fallback to system channel
    const rulesId = cfg.rulesChannel || null;
    buttons.push({
        label: t('welcome.btn_rules', lang), emoji: EMOJIS.rules, style: 'Link',
        url: `https://discord.com/channels/${guildId}/${rulesId || fallbackId}`,
        customId: null
    });

    // General button — use configured channel if set, else fallback to system channel
    const generalId = cfg.generalChannel || null;
    buttons.push({
        label: t('welcome.btn_general', lang), emoji: EMOJIS.general, style: 'Link',
        url: `https://discord.com/channels/${guildId}/${generalId || fallbackId}`,
        customId: null
    });

    buttons.push({ label: t('welcome.btn_ai', lang), emoji: EMOJIS.ai_assistant, style: 'Primary', url: null, customId: 'welcome_help' });
    buttons.push({ label: t('welcome.btn_profile', lang), emoji: EMOJIS.myprofile, style: 'Success', url: null, customId: `welcome_profile_${member.user.id}` });

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
    getWelcomeButtons,
    ordinal,
    fmtDur,
    realAccountAge,
    accountAgeShort,
    CARD_WIDTH:  W,
    CARD_HEIGHT: H,
};
