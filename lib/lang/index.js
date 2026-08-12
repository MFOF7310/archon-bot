const path = require('path');
const langs = {};

// Load all language files
['en', 'fr', 'ar', 'bm', 'zh'].forEach(code => {
    try {
        langs[code] = require(path.join(__dirname, `${code}.json`));
    } catch(e) {
        // File doesn't exist yet — skip
    }
});

/**
 * Get translation string
 * @param {string} key - dot-notation key e.g. 'alive.title' or 'common.error'
 * @param {string} lang - language code e.g. 'en', 'fr', 'ar'
 * @returns {string}
 */
function t(key, lang = 'en') {
    const l = langs[lang] || langs['en'];
    const fb = langs['en']; // fallback to English
    const parts = key.split('.');
    let val = l;
    let fallback = fb;
    for (const part of parts) {
        val = val?.[part];
        fallback = fallback?.[part];
    }
    return val || fallback || key;
}

/**
 * Get all strings for a namespace
 * @param {string} ns - namespace e.g. 'alive'
 * @param {string} lang - language code
 * @returns {object}
 */
function ns(namespace, lang = 'en') {
    const l = langs[lang] || langs['en'];
    const fb = langs['en'];
    return { ...(fb[namespace] || {}), ...(l[namespace] || {}) };
}

module.exports = { t, ns, langs };
