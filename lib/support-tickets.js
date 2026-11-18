'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// ARCHON — SUPPORT REQUESTS FROM THE WEBSITE, BOTH WAYS
// A visitor clicks "Talk to a person" on the site: the request gets a short number (and a secret token kept in their
// browser). The owner gets it in a Discord DM (with a Reply button) and on Telegram (/reply <number> <text>).
// The reply is saved: the site shows it in the chat when the visitor comes back, and ARCHON also DMs it to them
// when they were signed in with Discord. The visitor can answer from the site; it comes back under the same number.
//
//   create(db, { contact, discordId, lang, messages })   → { id, token }
//   follow(db, id, token, text)                          → true when the visitor's message was added
//   read(db, id, token)                                  → { id, messages: [{ from, text, at }] } or null
//   reply(client, id, text)                              → { ok, dm: true|false|null }
//   notify(client, id, { follow })                       → sends the request (or the visitor's new message) to the owner
// ═══════════════════════════════════════════════════════════════════════════
const crypto = require('crypto');

const clip = (v, n) => String(v || '').replace(/\r/g, '').trim().slice(0, n);
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O or 1/I to misread
const newId = () => Array.from(crypto.randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join('');

function ensure(db) {
    if (ensure.done) return;
    db.exec(`CREATE TABLE IF NOT EXISTS support_tickets (id TEXT PRIMARY KEY, token TEXT NOT NULL, contact TEXT, discord_id TEXT, lang TEXT, created_at INTEGER, last_at INTEGER)`);
    db.exec(`CREATE TABLE IF NOT EXISTS support_messages (ticket_id TEXT, sender TEXT, text TEXT, at INTEGER)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_support_messages ON support_messages(ticket_id, at)`);
    ensure.done = true;
}

const sameToken = (a, b) => {
    const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
    return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
};
const ticketOf = (db, id) => { ensure(db); return db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(String(id || '').toUpperCase()); };
const add = (db, id, sender, text) => {
    const now = Date.now();
    db.prepare('INSERT INTO support_messages (ticket_id, sender, text, at) VALUES (?, ?, ?, ?)').run(id, sender, text, now);
    db.prepare('UPDATE support_tickets SET last_at = ? WHERE id = ?').run(now, id);
};

function create(db, { contact, discordId, lang, messages }) {
    ensure(db);
    let id = newId();
    while (ticketOf(db, id)) id = newId();
    const token = crypto.randomBytes(24).toString('hex');
    const now = Date.now();
    db.prepare('INSERT INTO support_tickets (id, token, contact, discord_id, lang, created_at, last_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id, token, clip(contact, 60) || null, /^\d{17,20}$/.test(String(discordId || '')) ? String(discordId) : null, lang === 'fr' ? 'fr' : 'en', now, now);
    // the conversation with the site's assistant comes first, so the owner sees what was already said
    for (const m of (messages || []).slice(-10)) {
        const text = clip(m?.content, 600);
        if (text) db.prepare('INSERT INTO support_messages (ticket_id, sender, text, at) VALUES (?, ?, ?, ?)').run(id, m.role === 'user' ? 'visitor' : 'assistant', text, now);
    }
    // old requests are forgotten after 90 days
    try {
        const old = Date.now() - 90 * 86400000;
        db.prepare('DELETE FROM support_messages WHERE ticket_id IN (SELECT id FROM support_tickets WHERE last_at < ?)').run(old);
        db.prepare('DELETE FROM support_tickets WHERE last_at < ?').run(old);
    } catch { /* tidy next time */ }
    return { id, token };
}

function follow(db, id, token, text) {
    const t = ticketOf(db, id);
    if (!t || !sameToken(t.token, token)) return false;
    const msg = clip(text, 1000);
    if (!msg) return false;
    add(db, t.id, 'visitor', msg);
    return true;
}

function read(db, id, token) {
    const t = ticketOf(db, id);
    if (!t || !sameToken(t.token, token)) return null;
    const rows = db.prepare("SELECT sender, text, at FROM support_messages WHERE ticket_id = ? AND sender != 'assistant' ORDER BY at, rowid").all(t.id);
    return { id: t.id, messages: rows.map((r) => ({ from: r.sender === 'owner' ? 'owner' : 'visitor', text: r.text, at: r.at })) };
}

// What the owner sees: the request (or the new message), who it is from, and how to answer
function ownerText(t, rows, isFollow, forTelegram = false) {
    const who = t.discord_id ? `${forTelegram ? `Discord user ${t.discord_id}` : `<@${t.discord_id}>`} (signed in with Discord)` : t.contact ? `Contact: ${t.contact}` : 'No contact: the reply shows on the site when they come back';
    const lines = rows.map((r) => `${r.sender === 'visitor' ? '👤' : r.sender === 'owner' ? '🛠️' : '🤖'} ${clip(r.text, 400).replace(/\n+/g, ' ')}`);
    return [`🆘 ${isFollow ? 'New message on' : 'Support request'} #${t.id} (${String(t.lang || 'en').toUpperCase()})`, who, '', ...lines].join('\n');
}

async function notify(client, id, { follow: isFollow = false } = {}) {
    const db = client.db;
    const t = ticketOf(db, id);
    if (!t) return 0;
    const rows = isFollow
        ? db.prepare("SELECT sender, text FROM support_messages WHERE ticket_id = ? AND sender = 'visitor' ORDER BY at DESC, rowid DESC LIMIT 1").all(t.id)
        : db.prepare('SELECT sender, text FROM support_messages WHERE ticket_id = ? ORDER BY at, rowid').all(t.id);
    const text = ownerText(t, rows, isFollow);
    let sent = 0;
    try {
        const r = await client.telegramBridge?.send?.(`${ownerText(t, rows, isFollow, true)}\n\nAnswer: /reply ${t.id} your message`.slice(0, 3900), { force: true });
        if (r?.success !== false) sent++;
    } catch { /* Discord below */ }
    try {
        const owner = await client.users.fetch(process.env.OWNER_ID).catch(() => null);
        if (owner) {
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`sup:reply:${t.id}`).setLabel(`Reply to #${t.id}`).setStyle(ButtonStyle.Primary).setEmoji('💬'));
            if (await owner.send({ content: text.slice(0, 1990), components: [row], allowedMentions: { parse: [] } }).then(() => true).catch(() => false)) sent++;
        }
    } catch { /* counted as not sent */ }
    console.log(`[SUPPORT] #${t.id} ${isFollow ? 'follow-up' : 'request'} delivered ${sent}/2`);
    return sent;
}

// The owner's answer: saved for the site; DM'd too when the visitor was signed in with Discord
async function reply(client, id, text) {
    const db = client.db;
    const t = ticketOf(db, id);
    if (!t) return { ok: false, error: 'unknown' };
    const msg = clip(text, 1500);
    if (!msg) return { ok: false, error: 'empty' };
    add(db, t.id, 'owner', msg);
    let dm = null;
    if (t.discord_id) {
        const fr = t.lang === 'fr';
        const head = fr ? `💬 **Réponse de Moussa** (support ARCHON, demande #${t.id})` : `💬 **Reply from Moussa** (ARCHON support, request #${t.id})`;
        const foot = fr ? '-# Tu peux répondre depuis le chat du site : archon223.com' : '-# You can answer from the chat on the site: archon223.com';
        const user = await client.users.fetch(t.discord_id).catch(() => null);
        dm = !!(user && await user.send({ content: `${head}\n${msg}\n${foot}`.slice(0, 1990), allowedMentions: { parse: [] } }).then(() => true).catch(() => false));
    }
    console.log(`[SUPPORT] #${t.id} answered (site saved, Discord DM: ${dm === null ? 'no Discord account' : dm ? 'sent' : 'refused'})`);
    return { ok: true, dm, id: t.id };
}

const replyNote = (r) => !r.ok
    ? (r.error === 'unknown' ? 'No request with that number.' : 'The message is empty.')
    : `✅ Reply saved for #${r.id}: it shows in the site chat when they come back.${r.dm === true ? ' Also sent to them in a Discord DM.' : r.dm === false ? ' Their Discord DMs are closed, so only the site has it.' : ''}`;

module.exports = { create, follow, read, reply, notify, replyNote, ticketOf };
