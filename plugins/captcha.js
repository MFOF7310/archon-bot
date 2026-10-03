// ═══════════════════════════════════════════════════════
// ARCHON CG-223 — IMAGE CAPTCHA ENGINE v2.0 (Mali colours)
// Distorted text image, drawn locally: no external service needed.
//   generateCaptcha(code)         -> PNG buffer (the same call verify.js already makes)
//   generateCaptcha(code, opts)   -> optional opts.server (ASCII only) and opts.hint (a short line under the code)
// What makes it easy for a PERSON: a bigger card, large clear characters with a dark outline, a small set of high-contrast colours.
// What keeps it hard for a MACHINE: random tilt, lean, size and height of every character, and coloured lines drawn OVER the
// characters in the same colours as the characters themselves (a colour filter cannot separate them).
// ═══════════════════════════════════════════════════════
const { createCanvas } = require('canvas');
const crypto = require('crypto');

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O and no 1/I look-alikes

const GREEN = '#14b53a', GOLD = '#fcd116', RED = '#ce1126';          // the colours of Mali
const INK = ['#fcd116', '#f4efe6', '#43d96b', '#ff6b78'];            // gold, ivory, light green, light red: readable on the dark card
const LINE_COLORS = ['rgba(67,217,107,0.8)', 'rgba(252,209,22,0.8)', 'rgba(255,107,120,0.8)', 'rgba(244,239,230,0.7)'];   // the same four colours as INK
const W = 560;

function randomCode(len = 6) {
    let code = '';
    for (let i = 0; i < len; i++) code += CHARS[crypto.randomInt(CHARS.length)];
    return code;
}

const jitter = (range) => (Math.random() - 0.5) * 2 * range;
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const ascii = (s, max) => String(s || '').replace(/[^\x20-\x7E]/g, '').slice(0, max);   // the default font has no glyphs for emoji or accents

// rounded rectangle as a plain polyline (no arcTo needed)
function roundedRect(ctx, x, y, w, h, r) {
    const steps = 6;
    const corner = (cx, cy, a0) => { for (let i = 0; i <= steps; i++) { const a = a0 + (Math.PI / 2) * (i / steps); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } };
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); corner(x + w - r, y + r, -Math.PI / 2);
    ctx.lineTo(x + w, y + h - r); corner(x + w - r, y + h - r, 0);
    ctx.lineTo(x + r, y + h); corner(x + r, y + h - r, Math.PI / 2);
    ctx.lineTo(x, y + r); corner(x + r, y + r, Math.PI);
    ctx.closePath();
}

function generateCaptcha(code, opts = {}) {
    const H = opts.hint ? 236 : 204;   // a shorter card when there is no line under the code
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // the card, with a faint mud-cloth diamond pattern
    ctx.fillStyle = '#14161a';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let y = 0; y < H + 28; y += 28) {
        for (let x = 0; x < W + 28; x += 28) {
            ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x + 9, y); ctx.lineTo(x, y + 9); ctx.lineTo(x - 9, y); ctx.closePath(); ctx.stroke();
        }
    }

    // the green, gold and red stripe
    const third = W / 3;
    ctx.fillStyle = GREEN; ctx.fillRect(0, 0, third, 8);
    ctx.fillStyle = GOLD;  ctx.fillRect(third, 0, third, 8);
    ctx.fillStyle = RED;   ctx.fillRect(third * 2, 0, third, 8);

    // header: the brand on the left, the server (or the city) on the right
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'left';  ctx.fillStyle = GOLD;      ctx.fillText('ARCHON CG-223', 28, 32);
    ctx.textAlign = 'right'; ctx.fillStyle = '#8d897f'; ctx.fillText(ascii(opts.server, 24) || 'BAMAKO_223', W - 28, 32);

    // the box that holds the code
    const bx = 28, by = 56, bw = W - 56, bh = 124;
    roundedRect(ctx, bx, by, bw, bh, 14);
    ctx.fillStyle = '#1b1e24'; ctx.fill();
    ctx.strokeStyle = 'rgba(252,209,22,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();

    // noise dots behind the characters
    for (let i = 0; i < 70; i++) {
        ctx.fillStyle = `rgba(244,239,230,${0.12 + Math.random() * 0.25})`;
        ctx.beginPath(); ctx.arc(bx + Math.random() * bw, by + Math.random() * bh, 1 + Math.random() * 2, 0, Math.PI * 2); ctx.fill();
    }

    // the characters: big, with a dark outline, each with its own tilt, lean, size and height
    const pad = 26, cell = (bw - pad * 2) / code.length;
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    for (let i = 0; i < code.length; i++) {
        const x = bx + pad + cell * i + cell / 2 + jitter(4);
        const y = by + bh / 2 + jitter(9);
        const size = Math.round(70 + jitter(6));
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(jitter(0.22));
        ctx.transform(1, 0, jitter(0.18), 1, 0, 0);
        ctx.font = `bold ${size}px monospace`;
        ctx.lineWidth = 5; ctx.strokeStyle = '#14161a'; ctx.strokeText(code[i], 0, 0);
        ctx.fillStyle = pick(INK); ctx.fillText(code[i], 0, 0);
        ctx.restore();
    }

    // coloured lines drawn OVER the characters, in the same colours as the characters
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = LINE_COLORS[i];
        const base = by + bh * (0.25 + Math.random() * 0.5), amp = 12 + Math.random() * 8, phase = Math.random() * 6, freq = 18 + Math.random() * 10;
        ctx.beginPath();
        ctx.moveTo(bx + 6, base + Math.sin(phase) * amp);
        for (let px = bx + 6; px <= bx + bw - 6; px += 6) ctx.lineTo(px, base + Math.sin(px / freq + phase) * amp + jitter(2));
        ctx.stroke();
    }
    for (let i = 0; i < 2; i++) {   // two short scratches across the characters
        ctx.strokeStyle = 'rgba(244,239,230,0.55)';
        const sx = bx + 40 + Math.random() * (bw - 120), sy = by + 14 + Math.random() * 30;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 50 + jitter(15), sy + 60 + jitter(15)); ctx.stroke();
    }

    // an optional line under the code (the caller passes it already translated)
    if (opts.hint) {
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#a9a59b'; ctx.font = '14px monospace';
        ctx.fillText(ascii(opts.hint, 60), 28, 210);
    }

    ctx.strokeStyle = '#2c3038'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, W - 2, H - 2);
    return canvas.toBuffer('image/png');
}

module.exports = { generateCaptcha, randomCode };
