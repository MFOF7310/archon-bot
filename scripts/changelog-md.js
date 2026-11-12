// Builds CHANGELOG.md from config/changelog.json (the same notes /changelog shows in Discord), in English.
// Run after adding a release:  node scripts/changelog-md.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const { releases } = JSON.parse(fs.readFileSync(path.join(root, 'config/changelog.json'), 'utf8'));
const older = path.join(root, 'config/changelog-older.md');
const SECTIONS = [['new', 'New'], ['improved', 'Improved'], ['fixed', 'Fixed']];

const out = [
    '# Changelog',
    '',
    'What changed in ARCHON CG-223, in plain language. These are the same notes `/changelog` shows in Discord',
    '(in English, French, Chinese and Arabic). This file is generated from `config/changelog.json`: edit that file,',
    'then run `node scripts/changelog-md.js`.',
    '',
];
for (const r of releases) {
    out.push(`## ${r.version} · ${r.date}`, '');
    for (const [key, title] of SECTIONS) {
        if (!r[key]?.length) continue;
        out.push(`**${title}**`);
        for (const line of r[key]) out.push(`- ${line.en || line}`);
        out.push('');
    }
}
if (fs.existsSync(older)) out.push(fs.readFileSync(older, 'utf8').trim(), '');
fs.writeFileSync(path.join(root, 'CHANGELOG.md'), out.join('\n'));
console.log(`CHANGELOG.md written: ${releases.length} release(s)`);
