// ═══════════════════════════════════════════════════════
// ARCHON CG-223 — IMAGE CAPTCHA ENGINE v1.0
// Distorted text image — no external service needed
// ═══════════════════════════════════════════════════════
const { createCanvas } = require('canvas');

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(len = 6) {
    let code = '';
    for (let i = 0; i < len; i++) {
        code += CHARS[Math.floor(Math.random() * CHARS.length)];
    }
    return code;
}

function generateCaptcha(code) {
    const W = 320, H = 110;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // Background — dark navy
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, W, H);

    // Grid lines noise
    ctx.strokeStyle = '#1a2333';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 20) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 20) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Random noise dots
    for (let i = 0; i < 80; i++) {
        ctx.fillStyle = `rgba(${Math.random()*255|0},${Math.random()*255|0},${Math.random()*255|0},0.3)`;
        ctx.beginPath();
        ctx.arc(Math.random()*W, Math.random()*H, Math.random()*2+1, 0, Math.PI*2);
        ctx.fill();
    }

    // Wavy lines to confuse OCR
    const colors = ['#00ff88', '#00aaff', '#ff6600', '#ff0066'];
    for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = colors[i % colors.length];
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, H/2 + (Math.random()-0.5)*40);
        for (let x = 0; x < W; x += 10) {
            ctx.lineTo(x, H/2 + Math.sin(x/20 + i)*20 + (Math.random()-0.5)*15);
        }
        ctx.stroke();
    }

    // Draw each character with random rotation/color/size
    const charW = (W - 40) / code.length;
    for (let i = 0; i < code.length; i++) {
        const x = 20 + i * charW + charW / 2;
        const y = H / 2 + (Math.random() - 0.5) * 20;
        const angle = (Math.random() - 0.5) * 0.5;
        const size = 32 + Math.random() * 12;
        const charColors = ['#00ff88', '#00ccff', '#ffaa00', '#ff6688', '#aaffcc'];
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.font = `bold ${size}px monospace`;
        ctx.fillStyle = charColors[Math.floor(Math.random() * charColors.length)];
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 8;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(code[i], 0, 0);
        ctx.restore();
    }

    // Border glow
    ctx.strokeStyle = '#00aaff';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W-2, H-2);

    // Footer
    ctx.fillStyle = '#334455';
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('ARCHON CG-223 • BAMAKO_223 🇲🇱', W-8, H-8);

    return canvas.toBuffer('image/png');
}

module.exports = { generateCaptcha, randomCode };
