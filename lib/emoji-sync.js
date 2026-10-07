// Adds emoji keys that arrived with an update (config/emojis.example.js)
// to the private config/emojis.js. Never overwrites an existing key.
const fs = require('fs');
const vm = require('vm');

function quote(v) {
    return "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

module.exports = function syncEmojis(privatePath, examplePath, live) {
    if (!fs.existsSync(examplePath)) return [];
    if (!fs.existsSync(privatePath)) { fs.copyFileSync(examplePath, privatePath); return ['*']; }

    delete require.cache[require.resolve(examplePath)];
    const example = require(examplePath);
    const current = live || require(privatePath);

    const missing = Object.keys(example).filter(k => !(k in current));
    if (!missing.length) return [];

    const values = {};
    for (const k of missing) {
        const v = example[k];
        values[k] = String(v).includes('YOUR_EMOJI_ID') ? '▫️' : v;
    }

    const text = fs.readFileSync(privatePath, 'utf8');
    const end = text.lastIndexOf('};');
    if (end === -1) throw new Error('emojis.js has no closing };');

    let block = '\n    // ── Added automatically from emojis.example.js ──\n';
    for (const k of missing) block += '    ' + k + ': ' + quote(values[k]) + ',\n';

    const next = text.slice(0, end).replace(/\s*$/, '\n') + block + text.slice(end);
    new vm.Script(next);                 // syntax check before touching the file
    fs.writeFileSync(privatePath, next, 'utf8');

    for (const k of missing) current[k] = values[k];   // plugins see it right away
    return missing;
};
