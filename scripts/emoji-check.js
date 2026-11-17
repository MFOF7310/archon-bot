// Compares config/emojis.js with ARCHON's application emojis on Discord. Read-only: nothing is changed.
//   node scripts/emoji-check.js          only reports
//   node scripts/emoji-check.js --fix    also repairs what is safe to repair, then restart the bot:
//     a broken key gets the ID of the live emoji with the same name (an emoji redone on Discord kept its name but
//     got a new ID, and config/emojis.js still had the old one); a renamed key gets Discord's real name.
//     Keys with no live emoji of that name are left alone. The old file is kept as config/emojis.js.fixbak.
// Lists:
//   broken   a key whose ID no longer exists on Discord (the emoji was deleted or replaced): it shows as text
//   renamed  a key pointing at a live emoji whose Discord name is different from the one written in the key
//   shared   two keys pointing at the same emoji (fine on purpose, listed so you can tell)
//   unused   app emojis on Discord that no key in config/emojis.js points at (they only take a slot)
// Discord itself refuses two app emojis with the same name, so a name can't exist twice on its side.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const fs = require('fs');
const FIX = process.argv.includes('--fix');

const token = process.env.DISCORD_TOKEN;
if (!token) { console.log('DISCORD_TOKEN is missing from .env'); process.exit(1); }
const API = 'https://discord.com/api/v10';
async function get(url) {
    const res = await fetch(API + url, { headers: { Authorization: `Bot ${token}` } });
    if (!res.ok) throw new Error(`Discord said ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
}

(async () => {
    const E = require(path.join(__dirname, '..', 'config', 'emojis.js'));
    const app = await get('/applications/@me');
    const live = (await get(`/applications/${app.id}/emojis`)).items || [];
    const byId = new Map(live.map((e) => [e.id, e]));
    const byName = new Map(live.map((e) => [e.name, e]));
    const repairs = [];   // [key, new value]
    const tag = (e) => `<${e.animated ? 'a' : ''}:${e.name}:${e.id}>`;

    const broken = [], renamed = [], used = new Map();
    for (const [key, value] of Object.entries(E)) {
        const m = /^<a?:(\w+):(\d+)>$/.exec(typeof value === 'string' ? value : '');
        if (!m) continue;   // a plain emoji fallback, nothing to check on Discord
        const [, name, id] = m;
        const e = byId.get(id);
        if (!e) {
            const same = byName.get(name);
            broken.push(`${key} → ${name}:${id}${same ? `  (live: ${same.id})` : '  (no live emoji of that name)'}`);
            if (same) { repairs.push([key, tag(same)]); used.set(same.id, [...(used.get(same.id) || []), key]); }
            continue;
        }
        if (e.name !== name) { renamed.push(`${key} → written ${name}, Discord has ${e.name}`); repairs.push([key, tag(e)]); }
        used.set(id, [...(used.get(id) || []), key]);
    }
    const shared = [...used.values()].filter((keys) => keys.length > 1).map((keys) => keys.join(', '));
    const unused = live.filter((e) => !used.has(e.id)).map((e) => e.name).sort();

    const show = (title, list, note) => {
        console.log(`\n${list.length ? '•' : '✓'} ${title}: ${list.length}${list.length && note ? `  (${note})` : ''}`);
        for (const line of list) console.log('   ' + line);
    };
    console.log(`config/emojis.js: ${Object.keys(E).length} keys · Discord: ${live.length} app emojis`);
    show('broken', broken, 'redo them with make_icon.py or scripts/upload-emoji.js');
    show('renamed', renamed, 'works, but the key and the Discord name differ');
    show('shared', shared, 'fine if on purpose');
    show('unused', unused, 'they only take a slot; delete with scripts/delete-emoji.js only after grep shows no code uses them');

    if (!repairs.length) return;
    if (!FIX) return console.log(`\n${repairs.length} key(s) can be repaired: node scripts/emoji-check.js --fix`);
    const file = path.join(__dirname, '..', 'config', 'emojis.js');
    let text = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file + '.fixbak', text);
    let done = 0;
    for (const [key, value] of repairs) {
        // the value may be written with ' or " or `
        const re = new RegExp(`(^|[\\s{,'"])(${key}['"]?\\s*:\\s*)(['"\`])[^'"\`]*\\3`, 'm');
        if (re.test(text)) { text = text.replace(re, `$1$2'${value}'`); done++; } else console.log(`   ✗ couldn't find the line of ${key}`);
    }
    fs.writeFileSync(file, text);
    // the new file must still load, else the old one comes back
    try { delete require.cache[require.resolve(file)]; require(file); }
    catch (e) { fs.writeFileSync(file, fs.readFileSync(file + '.fixbak')); return console.log('✗ the repaired file did not load, old one restored:', e.message); }
    console.log(`\n✅ ${done} key(s) repaired (old file: config/emojis.js.fixbak). Now: pm2 restart Architect-CG223`);
})().catch((e) => { console.error('✗', e.message); process.exit(1); });
