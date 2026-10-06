#!/usr/bin/env node
// tools/i18n-audit.js: compares every language file with English. Read-only: it never writes anything.
//
//   node tools/i18n-audit.js                 summary for every language
//   node tools/i18n-audit.js --detail zh     list what is missing, or still in English, for one language
//   node tools/i18n-audit.js --short fr      with --detail: also list short identical texts ("Message", "Total": usually cognates)
//   node tools/i18n-audit.js --check         exit code 1 if fr, ar or zh have gaps (for a pre-commit hook); --locales fr,ar,zh,bm to include Bambara
//   node tools/i18n-audit.js --json          the same numbers as JSON
//
// How a text counts, for each language:
//   missing        absent or empty (a whole missing file counts as missing too)
//   still English  identical to the English text. For Arabic and Chinese any identical text counts. For Latin-script languages (French, Bambara)
//                  only identical texts of 3 or more words count: short ones are usually cognates or names and are only reported as "short identical".
//   kept           identical on purpose (brand names, command syntax): listed in tools/i18n-keep.json as { "file.json": ["key", ...] }
// Texts that are empty in English have nothing to translate and are reported once, apart.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ALL = ['fr', 'ar', 'zh', 'bm'];
const NON_LATIN = new Set(['ar', 'zh']);
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : null; };
const CHECK_LOCALES = String(opt('--locales') || 'fr,ar,zh').split(',').filter(Boolean);

const flat = (o, p = '', out = {}) => { for (const [k, v] of Object.entries(o || {})) { const key = p ? p + '.' + k : k; if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, key, out); else out[key] = v; } return out; };
const read = (file) => { if (!fs.existsSync(file)) return null; try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); return j && typeof j === 'object' && !Array.isArray(j) ? { keys: flat(j) } : { broken: 'not a JSON object' }; } catch (e) { return { broken: e.message.slice(0, 70) }; } };
const isEmpty = (v) => v === '' || v === null || v === undefined;
const letters = (s) => String(s).replace(/\{[^}]*\}/g, '').replace(/[^\p{L}]/gu, '');
const wordCount = (s) => String(s).replace(/\{[^}]*\}/g, ' ').split(/[^\p{L}]+/u).filter((w) => w.length >= 2).length;
const hasWords = (v) => typeof v === 'string' && letters(v).length > 3;
const keep = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'i18n-keep.json'), 'utf8')); } catch { return {}; } })();
const kept = (file, key) => Array.isArray(keep[file]) && keep[file].includes(key);

// compare one English file with one language file
function compare(file, en, loc, locale) {
  const r = { missing: [], still: [], short: [], extra: 0, translatable: 0 };
  for (const [k, v] of Object.entries(en)) {
    if (isEmpty(v)) continue;
    r.translatable++;
    const t = loc[k];
    if (isEmpty(t)) { r.missing.push(k); continue; }
    if (JSON.stringify(t) === JSON.stringify(v) && hasWords(v) && !kept(file, k)) {
      if (NON_LATIN.has(locale) || wordCount(v) >= 3) r.still.push(k); else r.short.push(k);
    }
  }
  for (const k of Object.keys(loc)) if (!(k in en)) r.extra++;
  return r;
}

function auditFolder(enDir, localeFile, label) {
  const files = fs.existsSync(enDir) ? fs.readdirSync(enDir).filter((f) => f.endsWith('.json')) : [];
  const result = { label, files: files.length, translatable: 0, emptyEn: [], locales: {} };
  for (const l of ALL) result.locales[l] = { filesMissing: [], broken: [], missing: 0, still: 0, short: 0, extra: 0, detail: [] };
  for (const f of files) {
    const en = read(path.join(enDir, f)); if (!en || !en.keys) continue;
    for (const [k, v] of Object.entries(en.keys)) if (isEmpty(v)) result.emptyEn.push(`${f}::${k}`);
    const total = Object.values(en.keys).filter((v) => !isEmpty(v)).length; result.translatable += total;
    for (const l of ALL) {
      const R = result.locales[l]; const loc = read(localeFile(l, f));
      if (!loc) { R.filesMissing.push(f); R.missing += total; R.detail.push({ file: f, kind: 'file', keys: Object.entries(en.keys).filter(([, v]) => !isEmpty(v)).map(([k]) => k) }); continue; }
      if (loc.broken) { R.broken.push(`${f}: ${loc.broken}`); R.missing += total; continue; }   // the bot ignores a broken file, so for coverage it counts as missing
      const c = compare(f, en.keys, loc.keys, l);
      R.missing += c.missing.length; R.still += c.still.length; R.short += c.short.length; R.extra += c.extra;
      R.detail.push({ file: f, kind: 'keys', missing: c.missing, still: c.still, short: c.short });
    }
  }
  for (const l of ALL) { const R = result.locales[l]; R.done = result.translatable ? Math.round(1000 * (result.translatable - R.missing - R.still) / result.translatable) / 10 : 100; }
  return result;
}
// the main folder: lang/<locale>/<file>.json    the older flat files: lib/lang/<locale>.json
const main = auditFolder(path.join(ROOT, 'lang', 'en'), (l, f) => path.join(ROOT, 'lang', l, f), 'lang/<locale>/<file>.json');
let legacy = null;
const legacyEn = read(path.join(ROOT, 'lib', 'lang', 'en.json'));
if (legacyEn && legacyEn.keys) {
  legacy = { label: 'lib/lang/<locale>.json (older flat files)', files: 1, translatable: Object.values(legacyEn.keys).filter((v) => !isEmpty(v)).length, emptyEn: [], locales: {} };
  for (const l of ALL) { const loc = read(path.join(ROOT, 'lib', 'lang', l + '.json')); const R = { filesMissing: [], broken: [], missing: 0, still: 0, short: 0, extra: 0, detail: [] };
    if (!loc) { R.filesMissing.push(l + '.json'); R.missing = legacy.translatable; } else if (loc.broken) R.broken.push(loc.broken); else { const c = compare('en.json', legacyEn.keys, loc.keys, l); R.missing = c.missing.length; R.still = c.still.length; R.short = c.short.length; R.extra = c.extra; R.detail.push({ file: l + '.json', kind: 'keys', missing: c.missing, still: c.still, short: c.short }); }
    R.done = legacy.translatable ? Math.round(1000 * (legacy.translatable - R.missing - R.still) / legacy.translatable) / 10 : 100; legacy.locales[l] = R; }
}
const gaps = (R) => R.missing + R.still + R.broken.length;

if (opt('--json')) { const strip = (x) => x && { ...x, locales: Object.fromEntries(Object.entries(x.locales).map(([l, R]) => [l, { ...R, detail: undefined }])) }; console.log(JSON.stringify({ main: strip(main), legacy: strip(legacy), checkLocales: CHECK_LOCALES }, null, 1)); }
else if (opt('--detail')) {
  const l = String(opt('--detail')); if (!ALL.includes(l)) { console.log('usage: --detail <fr|ar|zh|bm>'); process.exit(2); }
  const en = (file) => (file === 'en.json' ? legacyEn : read(path.join(ROOT, 'lang', 'en', file))).keys; let lines = 0; const cut = (s) => String(s).replace(/\s+/g, ' ').slice(0, 110);
  for (const part of [main, legacy].filter(Boolean)) for (const d of part.locales[l].detail) {
    const E = d.file === l + '.json' ? legacyEn.keys : en(d.file);
    if (d.kind === 'file') { console.log(`NO FILE   ${d.file}: ${d.keys.length} texts`); continue; }
    for (const [tag, list] of [['MISSING ', d.missing], ['ENGLISH ', d.still], ...(opt('--short') ? [['short   ', d.short]] : [])]) for (const k of list) { if (lines++ < 400) console.log(`${tag} ${d.file} :: ${k} :: ${cut(E[k])}`); }
  }
  if (!lines) console.log(`${l}: nothing to list`); if (lines > 400) console.log(`... and ${lines - 400} more`);
} else {
  console.log(`ARCHON language audit · ${main.files} English files · ${main.translatable} texts to translate` + (main.emptyEn.length ? ` (${main.emptyEn.length} empty in English, nothing to translate)` : ''));
  const show = (part) => { for (const l of ALL) { const R = part.locales[l]; console.log(`  ${l}  ${String(R.done.toFixed(1)).padStart(5)}%  missing ${R.missing} · still English ${R.still} · short identical ${R.short}` + (R.filesMissing.length ? ` · files missing ${R.filesMissing.length}` : '') + (R.broken.length ? ` · BROKEN ${R.broken.length}` : '') + (R.extra ? ` · stale ${R.extra}` : '')); } };
  show(main);
  for (const l of ALL) for (const b of main.locales[l].broken) console.log(`  BROKEN ${l}/${b}`);
  if (main.emptyEn.length) console.log(`  empty in English (nothing to translate): ${main.emptyEn.join(', ')}`);
  if (legacy) { console.log(`${legacy.label}: ${legacy.translatable} texts`); show(legacy); }
  const bad = CHECK_LOCALES.filter((l) => gaps(main.locales[l]) + (legacy ? gaps(legacy.locales[l]) : 0) > 0);
  console.log(bad.length ? `gaps in: ${bad.join(', ')}  (try: node tools/i18n-audit.js --detail ${bad[0]})` : `complete: ${CHECK_LOCALES.join(', ')}` + (ALL.filter((l) => !CHECK_LOCALES.includes(l)).length ? `  ·  not checked: ${ALL.filter((l) => !CHECK_LOCALES.includes(l)).map((l) => `${l} ${main.locales[l].done}%`).join(', ')}` : ''));
  if (opt('--check') && bad.length) process.exit(1);
}
if (opt('--check') && (opt('--json') || opt('--detail'))) { const bad = CHECK_LOCALES.some((l) => gaps(main.locales[l]) + (legacy ? gaps(legacy.locales[l]) : 0) > 0); if (bad) process.exit(1); }
