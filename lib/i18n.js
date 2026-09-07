// lib/i18n.js
// Usage: t('moderation.ban.success', lang, { user: 'X' })
// lang: 'en' | 'fr' | 'bm', defaults to 'en'
const fs = require('fs');
const path = require('path');

const LANGS = ['en', 'fr', 'bm', 'zh', 'ar'];
const DEFAULT_LANG = 'en';
const cache = {};

function mergeDeep(target, src) {
  for (const k of Object.keys(src)) {
    if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k])) {
      target[k] = mergeDeep(target[k] || {}, src[k]);
    } else {
      target[k] = src[k];
    }
  }
  return target;
}

function load(lang) {
  if (cache[lang]) return cache[lang];
  const dir = path.resolve(__dirname, '..', 'lang', lang);
  const merged = {};
  if (fs.existsSync(dir)) {
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      try {
        const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
        mergeDeep(merged, data);
      } catch (e) {
        console.error(`[i18n] Failed to parse ${lang}/${file}: ${e.message}`);
      }
    }
  }
  cache[lang] = merged;
  return merged;
}

function dig(obj, parts) {
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
}

function t(key, lang, vars) {
  const parts = key.split('.');
  // allow single-segment keys (e.g. common.json top-level: 'admin_only')
  const l = LANGS.includes(lang) ? lang : DEFAULT_LANG;
  let val = dig(load(l), parts);
  if (val === undefined || val === '') val = dig(load(DEFAULT_LANG), parts);
  if (val === undefined) {
    console.error(`[i18n] MISSING KEY: ${key}`);
    return key;
  }
  return interpolate(val, vars);
}

function clearCache() { for (const k of Object.keys(cache)) delete cache[k]; }

module.exports = { t, clearCache, LANGS, DEFAULT_LANG };
