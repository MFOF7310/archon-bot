#!/usr/bin/env node
'use strict';
// tools/i18n-replace.js
// Fixes small mistakes inside texts that already exist.
// Line format:   locale :: file.json :: key :: old part ==> new part
// The old part must appear exactly once in the text. The {placeholders} may not change.
// Usage: node tools/i18n-replace.js <batch-file> [--write]
// Without --write it only shows what it would do.
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = process.env.I18N_ROOT || path.join(__dirname, '..');
const LANG = path.join(ROOT, 'lang');
const args = process.argv.slice(2);
const write = args.includes('--write');
const input = args.find((a) => !a.startsWith('--'));

function die(m) { console.error(m); process.exit(1); }
if (!input) die('Usage: node tools/i18n-replace.js <batch-file> [--write]');
if (!fs.existsSync(input)) die('Batch file not found: ' + input);

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// A key is either written with dots in the file itself, or nested.
function locate(obj, dotted) {
    if (has(obj, dotted)) return { parent: obj, name: dotted };
    const parts = dotted.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (cur === null || typeof cur !== 'object' || !has(cur, parts[i])) return null;
        cur = cur[parts[i]];
    }
    const name = parts[parts.length - 1];
    return cur !== null && typeof cur === 'object' && has(cur, name) ? { parent: cur, name: name } : null;
}

const holes = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(' ');
const unescape = (s) => s.replace(/\\n/g, '\n').replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));

const cache = {}, touched = new Set(), report = [];
const count = { fix: 0, refused: 0 };
const refuse = (tag, why) => { report.push('REFUSED  ' + tag + ' :: ' + why); count.refused++; };

for (const raw of fs.readFileSync(input, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(' :: ');
    if (parts.length < 4) { refuse(line.slice(0, 50), 'use the form: locale :: file.json :: key :: old ==> new'); continue; }

    const locale = parts[0].trim(), file = parts[1].trim(), key = parts[2].trim();
    const tag = locale + ' :: ' + file + ' :: ' + key;
    const change = parts.slice(3).join(' :: ').split(' ==> ');
    if (change.length !== 2) { refuse(tag, 'put exactly one " ==> " between the old and the new part'); continue; }
    const oldPart = unescape(change[0]), newPart = unescape(change[1]);

    if (locale === 'en') { refuse(tag, 'English is the source, so it is never edited'); continue; }
    if (!/^[a-z]{2,3}$/.test(locale) || !fs.existsSync(path.join(LANG, locale))) { refuse(tag, 'there is no lang/' + locale + ' folder'); continue; }
    if (!/^[A-Za-z0-9_-]+\.json$/.test(file) || !fs.existsSync(path.join(LANG, locale, file))) { refuse(tag, 'there is no such file in lang/' + locale); continue; }
    if (!oldPart) { refuse(tag, 'the old part is empty'); continue; }
    if (newPart.includes('\uFFFD')) { refuse(tag, 'a character was damaged on the way in'); continue; }
    if (oldPart === newPart) { refuse(tag, 'old and new are the same'); continue; }

    const id = locale + '/' + file;
    if (!(id in cache)) {
        const p = path.join(LANG, locale, file);
        const rawFile = fs.readFileSync(p, 'utf8');
        try {
            const obj = JSON.parse(rawFile);
            cache[id] = { p: p, obj: obj, tidy: rawFile === JSON.stringify(obj, null, 2) + '\n' };
        } catch (e) { cache[id] = null; }
    }
    if (!cache[id]) { refuse(tag, 'the file is not valid JSON, fix it first'); continue; }

    const spot = locate(cache[id].obj, key);
    const value = spot ? spot.parent[spot.name] : undefined;
    if (typeof value !== 'string') { refuse(tag, 'no text with that key'); continue; }

    let n = 0, at = -1, first = -1;
    while ((at = value.indexOf(oldPart, at + 1)) !== -1) { if (!n) first = at; n++; }
    if (n === 0) { refuse(tag, 'the old part was not found (maybe it is already fixed)'); continue; }
    if (n > 1) { refuse(tag, 'the old part appears ' + n + ' times, use a longer piece'); continue; }

    const next = value.slice(0, first) + newPart + value.slice(first + oldPart.length);
    if (holes(value) !== holes(next)) { refuse(tag, 'the {placeholders} must stay the same: ' + (holes(value) || 'none')); continue; }

    spot.parent[spot.name] = next;
    touched.add(id);
    count.fix++;
    report.push('FIX      ' + tag + '\n           was: ' + oldPart + '\n           now: ' + newPart);
}

console.log(report.join('\n'));
console.log('Summary: ' + count.fix + ' to fix | ' + count.refused + ' refused');
for (const id of touched) {
    if (!cache[id].tidy) console.log('Note: ' + id + ' will be re-indented when saved (the texts stay the same).');
}

if (!write) { console.log('Dry run: nothing was written. Add --write to save.'); process.exit(0); }
if (!count.fix) { console.log('Nothing to write.'); process.exit(0); }

const backup = path.join(os.tmpdir(), 'i18n-replace-backup-' + Date.now());
fs.mkdirSync(backup, { recursive: true });
for (const id of touched) {
    const c = cache[id];
    fs.copyFileSync(c.p, path.join(backup, id.replace('/', '-')));
    fs.writeFileSync(c.p, JSON.stringify(c.obj, null, 2) + '\n', 'utf8');
    let back = null;
    try { back = JSON.parse(fs.readFileSync(c.p, 'utf8')); } catch (e) {}
    if (!back || JSON.stringify(back) !== JSON.stringify(c.obj)) die('Check failed after writing ' + id + ', backup is in ' + backup);
}
console.log('Written. Backup of the old files: ' + backup);
