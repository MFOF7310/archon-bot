// Deletes one of ARCHON's application emojis and its line in config/emojis.js.
//   node scripts/delete-emoji.js settings
// Check first that no code still uses the name: grep -rn "'settings'" plugins lib
// Restart the bot afterwards: it reads config/emojis.js at start-up.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');

const name = process.argv[2];
if (!name || !/^[A-Za-z0-9_]{2,32}$/.test(name)) { console.log('Usage: node scripts/delete-emoji.js <name>'); process.exit(1); }
const token = process.env.DISCORD_TOKEN;
if (!token) { console.log('DISCORD_TOKEN is missing from .env'); process.exit(1); }

const API = 'https://discord.com/api/v10';
const headers = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
async function call(method, url) {
    const res = await fetch(API + url, { method, headers });
    if (!res.ok) throw new Error(`Discord said ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.status === 204 ? null : res.json();
}

(async () => {
    const app = await call('GET', '/applications/@me');
    const found = (await call('GET', `/applications/${app.id}/emojis`)).items.find((e) => e.name === name);
    if (found) { await call('DELETE', `/applications/${app.id}/emojis/${found.id}`); console.log(`✅ ${name} deleted from the app's emojis`); }
    else console.log(`·  No app emoji called ${name}`);

    const config = path.join(__dirname, '..', 'config', 'emojis.js');
    const text = fs.readFileSync(config, 'utf8');
    const line = new RegExp(`^\\s*${name}:\\s*'[^']*',?\\s*\\n`, 'm');
    if (line.test(text)) { fs.writeFileSync(config, text.replace(line, '')); console.log(`✅ ${name} removed from config/emojis.js`); }
    else console.log(`·  ${name} was not in config/emojis.js`);
    console.log('   Now run: pm2 restart Architect-CG223');
})().catch((e) => { console.log('❌ ' + e.message); process.exit(1); });
