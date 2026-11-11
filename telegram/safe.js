// telegram/safe.js — small helpers shared by the Telegram plugins.
const fs = require('fs');
const path = require('path');

// A value from a user (a link, a search) put into a shell command as plain text: inside single quotes nothing is
// run, so "$(…)" or a backtick in a link can't execute anything on the server.
const shq = (s) => "'" + String(s ?? '').replace(/'/g, "'\\''") + "'";

// Settings files live in data/telegram/ (they were in /tmp, which the server empties on restart: languages,
// filters, antilink and trivia scores were lost). An old copy in /tmp is brought over once.
const DIR = path.join(__dirname, '..', 'data', 'telegram');
function store(name) {
    try { fs.mkdirSync(DIR, { recursive: true }); } catch {}
    const file = path.join(DIR, name);
    const old = path.join('/tmp', name);
    try { if (!fs.existsSync(file) && fs.existsSync(old)) fs.copyFileSync(old, file); } catch {}
    return file;
}

module.exports = { shq, store };
