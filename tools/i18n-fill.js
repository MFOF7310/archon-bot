#!/usr/bin/env node
'use strict';
// tools/i18n-fill.js
// Adds texts to a language from lines like:   file.json :: key :: your text
// It only fills texts that are missing or empty. It never overwrites a text that already exists.
// Usage: node tools/i18n-fill.js <locale> <batch-file> [--write]
// Without --write it only shows what it would do.
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = process.env.I18N_ROOT || path.join(__dirname, '..');
const LANG = path.join(ROOT, 'lang');
const args = process.argv.slice(2);
const write = args.includes('--write');
const [locale, input] = args.filter((a) => a !== '--write');

function die(message) { console.error(message); process.exit(1); }
if (!locale || !input) die('Usage: node tools/i18n-fill.js <locale> <batch-file> [--write]');
if (locale === 'en') die('English is the source, so it is never filled.');
if (!fs.existsSync(path.join(LANG, locale))) die('There is no lang/' + locale + ' folder.');
if (!fs.existsSync(input)) die('Batch file not found: ' + input);

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// A key is either written with dots in the file itself, or nested. We follow whatever English does.
function getText(obj, dotted) {
    if (has(obj, dotted)) return obj[dotted];
    let cur = obj;
    for (const p of dotted.split('.')) {
        if (cur === null || typeof cur !== 'object' || !has(cur, p)) return undefined;
        cur = cur[p];
    }
    return cur;
}

function setText(enObj, locObj, dotted, value) {
    if (has(enObj, dotted)) { locObj[dotted] = value; return true; }
    const parts = dotted.split('.');
    let cur = locObj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!has(cur, parts[i])) cur[parts[i]] = {};
        if (cur[parts[i]] === null || typeof cur[parts[i]] !== 'object') return false;
        cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
    return true;
}

const readJSON = (p) => {
    if (!fs.existsSync(p)) return {};
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
};
const holes = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(' ');

const enCache = {}, locCache = {}, planned = {}, seen = new Set(), report = [];
const count = { add: 0, skip: 0, refused: 0 };
const refuse = (tag, why) => { report.push('REFUSED  ' + tag + ' :: ' + why); count.refused++; };

for (const raw of fs.readFileSync(input, 'utf8').split('\n')) {
    const line = raw.replace(/^\s*MISSING\s+/, '').trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(' :: ');
    if (parts.length < 3) { refuse(line.slice(0, 50), 'use the form: file.json :: key :: text'); continue; }

    const file = parts[0].trim(), key = parts[1].trim();
    const text = parts.slice(2).join(' :: ').trim()
        .replace(/\\n/g, '\n')
        .replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
    const tag = file + ' :: ' + key;

    if (seen.has(tag)) { refuse(tag, 'given twice'); continue; }
    seen.add(tag);
    if (!text) { refuse(tag, 'the text is empty'); continue; }
    if (text.includes('\uFFFD')) { refuse(tag, 'a character was damaged on the way in'); continue; }
    if (!/^[A-Za-z0-9_-]+\.json$/.test(file)) { refuse(tag, 'no English file with that name'); continue; }

    if (!(file in enCache)) {
        const p = path.join(LANG, 'en', file);
        enCache[file] = fs.existsSync(p) ? readJSON(p) : null;
    }
    const en = enCache[file];
    if (!en) { refuse(tag, 'no English file with that name'); continue; }

    const enText = getText(en, key);
    if (typeof enText !== 'string' || !enText.trim()) { refuse(tag, 'no English text with that key'); continue; }
    if (holes(enText) !== holes(text)) { refuse(tag, 'the {placeholders} must match English: ' + (holes(enText) || 'none')); continue; }

    if (!(file in locCache)) locCache[file] = readJSON(path.join(LANG, locale, file));
    const loc = locCache[file];
    if (loc === null) { refuse(tag, 'the ' + locale + ' file is not valid JSON, fix it first'); continue; }

    const have = getText(loc, key);
    if (typeof have === 'string' && have.trim()) {
        report.push('SKIP     ' + tag + ' :: already has a text, not overwritten'); count.skip++; continue;
    }
    if (!setText(en, loc, key, text)) { refuse(tag, 'the file structure does not allow this key'); continue; }
    (planned[file] = planned[file] || []).push(key);
    report.push('ADD      ' + tag); count.add++;
}

console.log(report.join('\n'));
console.log('Summary: ' + count.add + ' to add | ' + count.skip + ' skipped | ' + count.refused + ' refused');

if (!write) { console.log('Dry run: nothing was written. Add --write to save.'); process.exit(0); }

if (count.add) {
    const backup = path.join(os.tmpdir(), 'i18n-fill-backup-' + Date.now());
    fs.mkdirSync(backup, { recursive: true });
    for (const file of Object.keys(planned)) {
        const p = path.join(LANG, locale, file);
        if (fs.existsSync(p)) fs.copyFileSync(p, path.join(backup, locale + '-' + file));
        fs.writeFileSync(p, JSON.stringify(locCache[file], null, 2) + '\n', 'utf8');
        const back = JSON.parse(fs.readFileSync(p, 'utf8'));
        for (const k of planned[file]) {
            if (typeof getText(back, k) !== 'string') die('Check failed after writing ' + file + ', backup is in ' + backup);
        }
    }
    console.log('Written. Backup of the old files: ' + backup);
} else {
    console.log('Nothing to write.');
}
