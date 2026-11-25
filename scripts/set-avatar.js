// Sets ARCHON's profile picture (an animated GIF works) from assets/avatar.gif, or from the file given.
//   node scripts/set-avatar.js
//   node scripts/set-avatar.js assets/other.gif
// Run it once: Discord only allows a few avatar changes per hour.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '..', process.argv[2] || 'assets/avatar.gif');
if (!fs.existsSync(file)) { console.log(`File not found: ${file}`); process.exit(1); }
const token = (process.env.DISCORD_TOKEN || '').trim().replace(/["']/g, '');
if (!token) { console.log('DISCORD_TOKEN is missing from .env'); process.exit(1); }

const type = file.endsWith('.gif') ? 'image/gif' : file.endsWith('.png') ? 'image/png' : 'image/jpeg';
const avatar = `data:${type};base64,${fs.readFileSync(file).toString('base64')}`;

fetch('https://discord.com/api/v10/users/@me', {
    method: 'PATCH',
    headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatar }),
}).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (res.ok) console.log(`Done: ${data.username} has its new avatar${data.avatar?.startsWith('a_') ? ' (animated)' : ''}.`);
    else console.log(`Discord refused (${res.status}): ${data.message || JSON.stringify(data)}`);
}).catch((e) => console.log(`Could not reach Discord: ${e.message}`));
