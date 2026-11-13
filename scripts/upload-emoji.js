// Uploads a PNG as one of ARCHON's application emojis and writes its ID into config/emojis.js.
//   node scripts/upload-emoji.js ic_bot assets/icons/ic_bot.png
// An emoji with the same name is replaced. Restart the bot afterwards: it reads config/emojis.js at start-up.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');

const [name, file] = process.argv.slice(2);
if (!name || !file) { console.log('Usage: node scripts/upload-emoji.js <name> <file.png>'); process.exit(1); }
if (!/^[A-Za-z0-9_]{2,32}$/.test(name)) { console.log('The name can only use letters, numbers and _ (2 to 32 characters).'); process.exit(1); }
const token = process.env.DISCORD_TOKEN;
if (!token) { console.log('DISCORD_TOKEN is missing from .env'); process.exit(1); }

const API = 'https://discord.com/api/v10';
const headers = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
async function call(method, url, body) {
    const res = await fetch(API + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) throw new Error(`Discord said ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.status === 204 ? null : res.json();
}

(async () => {
    const png = fs.readFileSync(path.resolve(file));
    if (png.length > 256 * 1024) throw new Error('The image is over 256 KB, Discord refuses it.');
    const app = await call('GET', '/applications/@me');
    const old = (await call('GET', `/applications/${app.id}/emojis`)).items.find((e) => e.name === name);
    if (old) await call('DELETE', `/applications/${app.id}/emojis/${old.id}`);
    const made = await call('POST', `/applications/${app.id}/emojis`, { name, image: 'data:image/png;base64,' + png.toString('base64') });

    const config = path.join(__dirname, '..', 'config', 'emojis.js');
    const line = `${name}: '<:${name}:${made.id}>',`;
    let text = fs.readFileSync(config, 'utf8');
    const existing = new RegExp(`\\b${name}:\\s*'[^']+',`);
    text = existing.test(text) ? text.replace(existing, line) : text.replace(/\};\s*$/, `    ${line}\n};\n`);
    fs.writeFileSync(config, text);
    console.log(`✅ ${name} uploaded (ID ${made.id}) and written to config/emojis.js`);
    console.log('   Now run: pm2 restart Architect-CG223');
})().catch((e) => { console.log('❌ ' + e.message); process.exit(1); });
