// Lists the custom emojis in config/emojis.js that are still in the old style (not ARCHON's gold or white
// Tabler icons) and that the code really uses, so they can be redone with make_icon.py.
//   node scripts/emoji-audit.js
// Read-only: it downloads each emoji's picture from Discord's CDN and looks at its colours. Nothing is changed.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const E = require(path.join(ROOT, 'config', 'emojis.js'));
const CUSTOM = /^<(a?):(\w{2,32}):(\d{15,25})>$/;

// every source file the bot runs
function files(dir, out = []) {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        if (['node_modules', '.git', 'data', 'assets', 'config'].includes(f.name)) continue;
        const p = path.join(dir, f.name);
        if (f.isDirectory()) files(p, out);
        else if (f.name.endsWith('.js') || f.name.endsWith('.json')) out.push(p);
    }
    return out;
}
const sources = files(ROOT).map((p) => ({ p: path.relative(ROOT, p), text: fs.readFileSync(p, 'utf8') }));

// share of the visible pixels that are ARCHON gold (#E6A817) or white: high means it's already a Tabler icon
async function style(id) {
    const res = await fetch(`https://cdn.discordapp.com/emojis/${id}.png?size=64`);
    if (!res.ok) return null;
    const { data, info } = await sharp(Buffer.from(await res.arrayBuffer())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let seen = 0, ours = 0;
    for (let i = 0; i < data.length; i += info.channels) {
        const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
        if (a < 60) continue;
        seen++;
        const gold = Math.abs(r - 230) < 50 && Math.abs(g - 168) < 50 && b < 90;
        const white = r > 225 && g > 225 && b > 225;
        if (gold || white) ours++;
    }
    return seen ? ours / seen : 1;
}

(async () => {
    const old = [];
    for (const [key, value] of Object.entries(E)) {
        const m = CUSTOM.exec(String(value));
        if (!m || m[1] === 'a') continue;                       // plain emojis and animated ones are left alone
        const re = new RegExp(`['".]${key}\\b|\\b${key}['"]`);
        const used = sources.filter((s) => re.test(s.text)).map((s) => s.p);
        if (!used.length) continue;                             // not used anywhere: nothing to redo
        const share = await style(m[3]).catch(() => null);
        if (share === null) old.push({ key, used, note: 'picture missing' });
        else if (share < 0.85) old.push({ key, used });
    }
    if (!old.length) return console.log('✅ Every custom emoji the code uses is already in ARCHON\'s style.');
    console.log(`${old.length} emoji(s) still in the old style:\n`);
    for (const o of old) console.log(`${o.key}${o.note ? ` (${o.note})` : ''}  →  ${o.used.slice(0, 3).join(', ')}${o.used.length > 3 ? ` +${o.used.length - 3}` : ''}`);
})().catch((e) => { console.log('❌ ' + e.message); process.exit(1); });
