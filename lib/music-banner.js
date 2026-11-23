'use strict';
// ═══ ARCHON CG-223 — NOW PLAYING BANNER ═══
// The image at the top of the music panel: cover, title, artist, a progress bar and the times.
// Drawn in memory and sent straight to Discord with the panel (nothing is written to disk); the panel redraws it
// every 10 s while a track plays. Covers are kept in memory (last 40), so a redraw doesn't download them again.
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const W = 1000, H = 300;
// Arabic and Chinese titles need these two (system fonts: apt install fonts-noto-core fonts-noto-cjk), else they are boxes
const FONT = '"Liberation Sans", "Noto Sans Arabic", "Noto Sans CJK SC", Arial, sans-serif';
const covers = new Map();   // url → Image (most recent last)

async function cover(url) {
    if (!url || !/^https?:\/\//.test(url)) return null;
    if (covers.has(url)) { const img = covers.get(url); covers.delete(url); covers.set(url, img); return img; }
    try {
        const img = await Promise.race([loadImage(url), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 5000))]);
        covers.set(url, img);
        while (covers.size > 40) covers.delete(covers.keys().next().value);
        return img;
    } catch { return null; }
}

const hex = (n) => `#${(Number(n) >>> 0).toString(16).padStart(6, '0').slice(-6)}`;
const time = (s) => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };
function fit(ctx, text, max) {
    let s = String(text || '');
    if (ctx.measureText(s).width <= max) return s;
    while (s.length > 1 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1);
    return s.trimEnd() + '…';
}
function rounded(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// { title, artist, coverUrl, accent (number), elapsed, duration, paused, label }
// The font has no emoji: they came out as empty boxes ("☐ Yemi Alade"), so they're taken out of the texts
const plain = (x) => String(x || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}]/gu, '').replace(/\s+/g, ' ').trim();

async function renderBanner(o) {
    o = { ...o, title: plain(o.title), artist: plain(o.artist), label: plain(o.label) };
    // "Yemi Alade - Johnny" by Yemi Alade: the artist line already says who, the title keeps the song
    if (o.artist && o.title.toLowerCase().startsWith(o.artist.toLowerCase() + ' - ')) o.title = o.title.slice(o.artist.length + 3);
    const c = createCanvas(W, H), ctx = c.getContext('2d');
    const accent = hex(o.accent ?? 0x5865F2);
    const img = await cover(o.coverUrl);

    // background: the cover, blown up and darkened; else the track's colour
    ctx.fillStyle = '#120c22'; ctx.fillRect(0, 0, W, H);
    if (img) {
        ctx.save(); ctx.filter = 'blur(28px)';
        const s = Math.max(W / img.width, H / img.height) * 1.2;
        ctx.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
        ctx.restore();
    }
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, 'rgba(10,6,20,0.92)'); g.addColorStop(1, 'rgba(10,6,20,0.62)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = accent; ctx.fillRect(0, 0, 6, H);

    // cover
    const S = 220, X = 40, Y = 40;
    ctx.save(); rounded(ctx, X, Y, S, S, 18); ctx.clip();
    if (img) {
        const s = Math.max(S / img.width, S / img.height);
        ctx.drawImage(img, X + (S - img.width * s) / 2, Y + (S - img.height * s) / 2, img.width * s, img.height * s);
    } else {
        ctx.fillStyle = accent; ctx.fillRect(X, Y, S, S);
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `bold 96px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('♪', X + S / 2, Y + S / 2 + 4); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();

    // texts
    const TX = X + S + 36, TW = W - TX - 40;
    ctx.fillStyle = o.paused ? '#FAC775' : accent === '#5865f2' ? '#AFA9EC' : accent;
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillText(fit(ctx, String(o.label || '').toUpperCase(), TW), TX, 78);
    ctx.fillStyle = '#FFFFFF'; ctx.font = `bold 44px ${FONT}`;
    ctx.fillText(fit(ctx, o.title, TW), TX, 132);
    ctx.fillStyle = '#D3D1C7'; ctx.font = `28px ${FONT}`;
    ctx.fillText(fit(ctx, o.artist || '', TW), TX, 172);

    // progress
    const BY = 220, BH = 10, dur = Number(o.duration) || 0, el = Math.max(0, Math.min(Number(o.elapsed) || 0, dur || Infinity));
    const p = dur ? el / dur : 0;
    rounded(ctx, TX, BY, TW, BH, 5); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
    if (p > 0) { rounded(ctx, TX, BY, Math.max(BH, TW * p), BH, 5); ctx.fillStyle = o.paused ? '#FAC775' : accent; ctx.fill(); }
    ctx.beginPath(); ctx.arc(TX + TW * p, BY + BH / 2, 11, 0, Math.PI * 2); ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.fillStyle = '#B4B2A9'; ctx.font = `20px ${FONT}`;
    ctx.fillText(time(el), TX, BY + 46);
    const end = dur ? time(dur) : '--:--';
    ctx.fillText(end, TX + TW - ctx.measureText(end).width, BY + 46);

    return c.toBuffer('image/jpeg', 82);
}

module.exports = { renderBanner };
