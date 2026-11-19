// Writes ARCHON's slash commands as the JSON Top.gg's "Import from Discord" box accepts.
// It asks Discord for the commands ARCHON has registered (the same list members see), so it is always current.
//
//   node scripts/topgg-commands.js
//
// The file lands on the dashboard's site: open https://archon223.com/topgg/commands.json on the phone,
// select all, copy, and paste it in Top.gg → Commands → Import.
// Another place:  node scripts/topgg-commands.js /root/commands.json
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const { REST, Routes } = require('discord.js');

const OUT = process.argv[2] || '/opt/dashboard/dist/public/topgg/commands.json';
const token = (process.env.DISCORD_TOKEN || '').trim().replace(/["']/g, '');
if (!token) { console.error('DISCORD_TOKEN is missing from .env'); process.exit(1); }
// the bot's id is the first part of its token
const appId = process.env.CLIENT_ID || Buffer.from(token.split('.')[0], 'base64').toString();

// Only what describes a command: Discord's ids, versions and permission fields mean nothing to Top.gg
const keep = (o) => {
    const out = { name: o.name, description: o.description, type: o.type };
    if (o.options?.length) out.options = o.options.map((x) => {
        const y = keep(x);
        if (x.required) y.required = true;
        if (x.choices?.length) y.choices = x.choices.map((c) => ({ name: c.name, value: c.value }));
        return y;
    });
    return out;
};

(async () => {
    const list = await new REST({ version: '10' }).setToken(token).get(Routes.applicationCommands(appId));
    const cmds = list.filter((c) => (c.type || 1) === 1).map(keep).sort((a, b) => a.name.localeCompare(b.name));
    fs.mkdirSync(require('path').dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(cmds));
    console.log(`${cmds.length} commands written to ${OUT} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
    if (OUT.startsWith('/opt/dashboard/dist/public/')) console.log('Open: https://archon223.com/' + OUT.slice('/opt/dashboard/dist/public/'.length));
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
