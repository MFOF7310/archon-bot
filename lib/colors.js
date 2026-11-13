'use strict';
// ═══════════════════════════════════════════════════════════════════════
// NAMED COLOURS — people pick a colour by its name, ARCHON keeps the hex.
//   resolve(input)            → '#RRGGBB' from a hex (#abc, abcdef) or a name in en/fr/zh/ar, else null
//   suggest(query, lang)      → autocomplete items [{ name: '🔵 Royal blue · #4169E1', value: '#4169E1' }]
//   nameOf(hex, lang)         → the palette name, or the nearest one with "≈"
//   dot(hex)                  → the closest round emoji (🔴🟠🟡🟢🔵🟣🟤⚫⚪)
//   contrast(a, b)            → WCAG contrast ratio (1 to 21)
//   fromImage(url)            → the image's main colours, most used first (server icon themes)
// ═══════════════════════════════════════════════════════════════════════

// [key, hex, English, French, Chinese, Arabic]
const PALETTE = [
    ['black', '#111111', 'Black', 'Noir', '黑色', 'أسود'],
    ['charcoal', '#2C2C2A', 'Charcoal', 'Charbon', '炭黑', 'فحمي'],
    ['graphite', '#36393F', 'Graphite', 'Graphite', '石墨灰', 'رمادي غرافيت'],
    ['gray', '#808080', 'Gray', 'Gris', '灰色', 'رمادي'],
    ['silver', '#C0C0C0', 'Silver', 'Argent', '银色', 'فضي'],
    ['white', '#FFFFFF', 'White', 'Blanc', '白色', 'أبيض'],
    ['cream', '#FFF8DC', 'Cream', 'Crème', '奶油色', 'كريمي'],
    ['ivory', '#FFFFF0', 'Ivory', 'Ivoire', '象牙白', 'عاجي'],
    ['beige', '#D8C3A5', 'Beige', 'Beige', '米色', 'بيج'],
    ['sand', '#C2B280', 'Sand', 'Sable', '沙色', 'رملي'],
    ['brown', '#8B4513', 'Brown', 'Marron', '棕色', 'بني'],
    ['chocolate', '#5C3317', 'Chocolate', 'Chocolat', '巧克力色', 'شوكولاتة'],
    ['coffee', '#6F4E37', 'Coffee', 'Café', '咖啡色', 'قهوة'],
    ['maroon', '#800000', 'Maroon', 'Bordeaux', '栗色', 'كستنائي'],
    ['wine', '#5B0E2D', 'Wine', 'Lie-de-vin', '酒红', 'نبيذي'],
    ['crimson', '#DC143C', 'Crimson', 'Cramoisi', '深红', 'قرمزي'],
    ['red', '#ED4245', 'Red', 'Rouge', '红色', 'أحمر'],
    ['mali_red', '#CE1126', 'Mali red', 'Rouge Mali', '马里红', 'أحمر مالي'],
    ['coral', '#FF7F50', 'Coral', 'Corail', '珊瑚色', 'مرجاني'],
    ['salmon', '#FA8072', 'Salmon', 'Saumon', '鲑鱼色', 'سلموني'],
    ['orange', '#FF8C00', 'Orange', 'Orange', '橙色', 'برتقالي'],
    ['amber', '#FFBF00', 'Amber', 'Ambre', '琥珀色', 'كهرماني'],
    ['gold', '#FFD700', 'Gold', 'Or', '金色', 'ذهبي'],
    ['yellow', '#FEE75C', 'Yellow', 'Jaune', '黄色', 'أصفر'],
    ['mali_yellow', '#FCD116', 'Mali yellow', 'Jaune Mali', '马里黄', 'أصفر مالي'],
    ['lemon', '#FFF44F', 'Lemon', 'Citron', '柠檬黄', 'ليموني'],
    ['lime', '#A4DE02', 'Lime', 'Citron vert', '青柠绿', 'ليموني أخضر'],
    ['green', '#57F287', 'Green', 'Vert', '绿色', 'أخضر'],
    ['mali_green', '#14B53A', 'Mali green', 'Vert Mali', '马里绿', 'أخضر مالي'],
    ['emerald', '#2ECC71', 'Emerald', 'Émeraude', '翡翠绿', 'زمردي'],
    ['forest', '#1E5631', 'Forest green', 'Vert forêt', '森林绿', 'أخضر غابي'],
    ['olive', '#6B8E23', 'Olive', 'Olive', '橄榄绿', 'زيتوني'],
    ['mint', '#98FF98', 'Mint', 'Menthe', '薄荷绿', 'نعناعي'],
    ['teal', '#008080', 'Teal', 'Sarcelle', '青色', 'أزرق مخضر'],
    ['petrol', '#003B46', 'Petrol blue', 'Bleu pétrole', '石油蓝', 'أزرق بترولي'],
    ['turquoise', '#40E0D0', 'Turquoise', 'Turquoise', '绿松石色', 'فيروزي'],
    ['cyan', '#00E5FF', 'Cyan', 'Cyan', '青蓝色', 'سماوي'],
    ['sky', '#87CEEB', 'Sky blue', 'Bleu ciel', '天蓝色', 'أزرق سماوي'],
    ['light_blue', '#66A5AD', 'Light blue', 'Bleu clair', '浅蓝色', 'أزرق فاتح'],
    ['blue', '#3498DB', 'Blue', 'Bleu', '蓝色', 'أزرق'],
    ['royal', '#4169E1', 'Royal blue', 'Bleu royal', '宝蓝色', 'أزرق ملكي'],
    ['blurple', '#5865F2', 'Discord blue', 'Bleu Discord', 'Discord 蓝', 'أزرق ديسكورد'],
    ['navy', '#1F2A6B', 'Navy', 'Bleu marine', '海军蓝', 'كحلي'],
    ['midnight', '#191970', 'Midnight blue', 'Bleu nuit', '午夜蓝', 'أزرق ليلي'],
    ['indigo', '#4B0082', 'Indigo', 'Indigo', '靛蓝色', 'نيلي'],
    ['violet', '#8A2BE2', 'Violet', 'Violet', '紫罗兰色', 'بنفسجي'],
    ['purple', '#9B59B6', 'Purple', 'Pourpre', '紫色', 'أرجواني'],
    ['plum', '#5B2C6F', 'Plum', 'Prune', '梅子色', 'برقوقي'],
    ['lavender', '#B39DDB', 'Lavender', 'Lavande', '薰衣草紫', 'خزامي'],
    ['magenta', '#EB459E', 'Magenta', 'Magenta', '洋红色', 'أرجواني وردي'],
    ['pink', '#FF69B4', 'Pink', 'Rose', '粉色', 'وردي'],
    ['rose', '#FFC0CB', 'Light pink', 'Rose pâle', '浅粉色', 'وردي فاتح'],
    ['fuchsia', '#FF00FF', 'Fuchsia', 'Fuchsia', '紫红色', 'فوشيا'],
    ['peach', '#FFCBA4', 'Peach', 'Pêche', '桃色', 'خوخي'],
    ['neon_green', '#39FF14', 'Neon green', 'Vert néon', '霓虹绿', 'أخضر نيون'],
    ['neon_pink', '#FF2EC4', 'Neon pink', 'Rose néon', '霓虹粉', 'وردي نيون'],
    ['matrix', '#00FF41', 'Matrix green', 'Vert Matrix', '矩阵绿', 'أخضر ماتريكس'],
    ['bronze', '#CD7F32', 'Bronze', 'Bronze', '青铜色', 'برونزي'],
    ['copper', '#B87333', 'Copper', 'Cuivre', '铜色', 'نحاسي'],
    ['slate', '#2F3E4E', 'Slate', 'Ardoise', '石板灰', 'أردوازي'],
];

const LANG_COL = { en: 2, fr: 3, zh: 4, ar: 5 };
const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s_-]+/g, ' ').trim();

// every way of writing each colour, folded: key, and the four names
const LOOKUP = new Map();
for (const p of PALETTE) for (const v of [p[0], p[2], p[3], p[4], p[5]]) LOOKUP.set(fold(v), p[1]);

function normHex(input) {
    const s = String(input || '').trim().replace(/^#/, '');
    if (/^[0-9a-f]{6}$/i.test(s)) return '#' + s.toUpperCase();
    if (/^[0-9a-f]{3}$/i.test(s)) return '#' + s.split('').map((c) => c + c).join('').toUpperCase();
    return null;
}

// '#RRGGBB' from a hex or a colour name in any of the four languages, else null
function resolve(input) {
    if (!input) return null;
    const hex = normHex(input);
    if (hex) return hex;
    const raw = String(input).trim();
    // an autocomplete pick arrives as its value (a hex); a pasted label ends with "· #hex"
    const tail = /#([0-9a-f]{6})\s*$/i.exec(raw);
    if (tail) return '#' + tail[1].toUpperCase();
    return LOOKUP.get(fold(raw)) || null;
}

const rgb = (hex) => { const h = normHex(hex) || '#000000'; return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();

function hsl(hex) {
    const [r, g, b] = rgb(hex).map((v) => v / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
}

// the closest of Discord's round emojis, so a list of colours is easy to scan
function dot(hex) {
    const [h, s, l] = hsl(hex);
    if (l < 0.1) return '⚫';
    if (l > 0.9 || (s < 0.15 && l > 0.6)) return '⚪';
    if (s < 0.15) return '⚫';
    if (h >= 15 && h < 45 && l < 0.4) return '🟤';
    if (h < 15 || h >= 335) return '🔴';
    if (h < 45) return '🟠';
    if (h < 70) return '🟡';
    if (h < 165) return '🟢';
    if (h < 255) return '🔵';
    return '🟣';
}

function luminance(hex) {
    const [r, g, b] = rgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
    const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
}
const dist = (a, b) => { const p = rgb(a), q = rgb(b); return Math.sqrt((p[0] - q[0]) ** 2 * 0.3 + (p[1] - q[1]) ** 2 * 0.59 + (p[2] - q[2]) ** 2 * 0.11); };
const mix = (a, b, t) => { const p = rgb(a), q = rgb(b); return toHex(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t); };

const label = (p, lang) => p[LANG_COL[lang] || 2];
function nearest(hex) {
    let best = PALETTE[0], d = Infinity;
    for (const p of PALETTE) { const x = dist(hex, p[1]); if (x < d) { d = x; best = p; } }
    return { entry: best, exact: d < 1 };
}
// the palette name, or "≈ nearest name" for a colour that isn't in the palette
function nameOf(hex, lang = 'en') {
    const h = normHex(hex);
    if (!h) return '';
    const { entry, exact } = nearest(h);
    return exact ? label(entry, lang) : `≈ ${label(entry, lang)}`;
}

// autocomplete items: a typed hex first (with its nearest name), then the names that match in any language
function suggest(query, lang = 'en') {
    const q = fold(query);
    const out = [];
    const typed = normHex(query);
    if (typed) out.push({ name: `${dot(typed)} ${typed} · ${nameOf(typed, lang)}`, value: typed });
    // best matches first: a name that starts with the text, then a word that does ("royal" → Royal blue), then anywhere
    const score = (p) => {
        if (!q || typed) return 1;
        const names = [label(p, lang), p[2], p[3], p[4], p[5], p[0]].map(fold);
        if (names.some((n) => n === q)) return 4;
        if (names.some((n) => n.startsWith(q))) return 3;
        if (names.some((n) => n.split(' ').some((w) => w.startsWith(q)))) return 2;
        return /[\u3400-\u9fff\u0600-\u06ff]/.test(q) && names.some((n) => n.includes(q)) ? 1 : 0;   // Chinese and Arabic have no word starts to match
    };
    const ranked = PALETTE.map((p, i) => [score(p), i, p]).filter(([sc]) => sc > 0).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    for (const [, , p] of ranked) {
        if (out.length >= 25) break;
        out.push({ name: `${dot(p[1])} ${label(p, lang)} · ${p[1]}`, value: p[1] });
    }
    return out;
}

// The main colours of an image (a server icon), most used first. Transparent and near-grey pixels count less,
// so a logo on a white or black square still gives its real colours. Returns [] when the image can't be read.
async function fromImage(url, count = 4) {
    if (!url) return [];
    let img;
    try { img = await require('@napi-rs/canvas').loadImage(url); } catch { return []; }
    const S = 48, cv = require('@napi-rs/canvas').createCanvas(S, S), c = cv.getContext('2d');
    c.drawImage(img, 0, 0, S, S);
    const data = c.getImageData(0, 0, S, S).data;
    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const key = (r >> 4) << 8 | (g >> 4) << 4 | (b >> 4);
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const weight = 0.25 + (max - min) / 255;   // colourful pixels count more than greys
        const k = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
        k.n += weight; k.r += r * weight; k.g += g * weight; k.b += b * weight;
        buckets.set(key, k);
    }
    const ranked = [...buckets.values()].sort((a, b) => b.n - a.n).map((k) => toHex(k.r / k.n, k.g / k.n, k.b / k.n));
    const picked = [];
    for (const h of ranked) {
        if (picked.every((p) => dist(p, h) > 60)) picked.push(h);
        if (picked.length >= count) break;
    }
    return picked;
}

// A banner theme from a list of colours: the darker two for the background, the one that stands out most for the accent
function themeFrom(colors) {
    const list = (colors || []).filter(Boolean);
    if (!list.length) return null;
    const byLight = [...list].sort((a, b) => luminance(a) - luminance(b));
    let bg1 = byLight[0], bg2 = byLight[1] || mix(byLight[0], '#FFFFFF', 0.25);
    // very light icons: darken the background so white text stays readable
    if (luminance(bg1) > 0.35) bg1 = mix(bg1, '#000000', 0.55);
    if (luminance(bg2) > 0.45) bg2 = mix(bg2, '#000000', 0.45);
    const mid = mix(bg1, bg2, 0.5);
    const accent = bestAccent(mid, list.filter((h) => h !== byLight[0]));
    return { bg1, bg2, accent };
}

// the colour (from the given ones, then the bright palette) that reads best on this background
function bestAccent(bg, prefer = []) {
    const good = prefer.filter((h) => contrast(h, bg) >= 3);
    if (good.length) return good.sort((a, b) => contrast(b, bg) - contrast(a, bg))[0];
    const bright = PALETTE.map((p) => p[1]).filter((h) => hsl(h)[1] > 0.4 && contrast(h, bg) >= 3);
    if (!bright.length) return luminance(bg) > 0.4 ? '#111111' : '#FFFFFF';
    // closest to the colours asked for, so the fix keeps the same mood
    const ref = prefer[0];
    return ref ? bright.sort((a, b) => dist(a, ref) - dist(b, ref))[0] : bright.sort((a, b) => contrast(b, bg) - contrast(a, bg))[0];
}

module.exports = { PALETTE, resolve, suggest, nameOf, dot, contrast, luminance, mix, fromImage, themeFrom, bestAccent, normHex };
