// Lists the keys in .env and whether the code still reads each one. Values are never shown.
//   node scripts/env-audit.js
// "unused" means no file of the bot mentions that name: the line can be removed.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const keys = fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => l.slice(0, l.indexOf('=')).trim());

function files(dir, out = []) {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        if (['node_modules', '.git', 'data', 'assets'].includes(f.name)) continue;
        const p = path.join(dir, f.name);
        if (f.isDirectory()) files(p, out);
        else if (/\.(js|cjs|mjs|sh|py)$/.test(f.name)) out.push(fs.readFileSync(p, 'utf8'));
    }
    return out;
}
const code = files(ROOT).join('\n');

const seen = new Set(), dup = [], used = [], unused = [];
for (const k of keys) {
    if (seen.has(k)) { dup.push(k); continue; }
    seen.add(k);
    (new RegExp(`\\b${k}\\b`).test(code) ? used : unused).push(k);
}
console.log(`${keys.length} lines in .env · ${used.length} used · ${unused.length} unused${dup.length ? ` · ${dup.length} written twice` : ''}\n`);
if (unused.length) console.log('Unused (safe to remove):\n  ' + unused.join('\n  ') + '\n');
if (dup.length) console.log('Written twice (keep one):\n  ' + [...new Set(dup)].join('\n  ') + '\n');
console.log('Used:\n  ' + used.join('\n  '));
