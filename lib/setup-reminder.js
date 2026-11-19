'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// SETUP REMINDER — one DM, 24 h after ARCHON joins a new server, to the person who added it, only if the server's
// core setup is still not done. The list is lib/setup-checklist.js (the same one /setup and Lydia read).
//   · one reminder per server, ever (a re-add doesn't start it again); never posted in a channel
//   · closed DMs: nothing is sent; everything set up by then: nothing is sent
//   · kept in the database and checked every 10 minutes, so a restart loses nothing
// Buttons: Finish on the dashboard (link) · Open the server (link) · Don't remind me (setuprem:off:<guildId>)
// Words: lang/<locale>/setupreminder.json; item names come from setup.json (setup.check.item_*).
// ═══════════════════════════════════════════════════════════════════════════
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const v2 = require('./games/v2');
const { t } = require('./i18n');
const { icon } = require('./ui/icons');

const DASHBOARD = 'https://archon223.com';
const DELAY = 24 * 60 * 60 * 1000;
const SWEEP = 10 * 60 * 1000;
const GOLD = 0xE6A817;
const GREY = 0x4E5058;
const SUPPORTED = ['en', 'fr', 'zh', 'ar'];

const T = (lang, k, v) => t(`setupreminder.${k}`, lang, v || {});
const C = (lang, k, v) => t(`setup.check.${k}`, lang, v || {});
const safe = (s) => String(s || '').replace(/[*_`~|\\<>#[\]]/g, '').slice(0, 80);

let ready = false;
function ensure(db) {
    if (ready) return;
    db.prepare(`CREATE TABLE IF NOT EXISTS setup_reminders (guild_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, lang TEXT,
        due_at INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'pending', updated_at INTEGER)`).run();
    ready = true;
}

// Called when ARCHON joins a new server and knows who added it
function schedule(client, guild, userId, lang) {
    try {
        ensure(client.db);
        const r = client.db.prepare('INSERT OR IGNORE INTO setup_reminders (guild_id, user_id, lang, due_at, state, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
            .run(guild.id, String(userId), SUPPORTED.includes(lang) ? lang : 'en', Date.now() + DELAY, 'pending', Date.now());
        console.log(`[SETUP-REMINDER] ${guild.name} (${guild.id}): ${r.changes ? 'reminder due in 24 h' : 'already had its reminder'}`);
    } catch (e) { console.error('[SETUP-REMINDER] schedule:', e.message); }
}

function setState(db, gid, state) {
    try { db.prepare('UPDATE setup_reminders SET state = ?, updated_at = ? WHERE guild_id = ?').run(state, Date.now(), gid); } catch { /* next sweep */ }
}

function card(lang, guild, res) {
    const core = res.items.filter((i) => i.level === 'core');
    const done = core.filter((i) => i.done).length;
    const filled = Math.round((done / Math.max(1, core.length)) * 10);
    const lines = core.map((i) => `${i.done ? icon('ok') : icon('todo')} ${C(lang, `item_${i.key}`)}`);
    const moreLeft = res.items.filter((i) => i.level !== 'core' && !i.done).length;
    const head = `## ${icon('tool')} ${T(lang, 'title', { server: safe(guild.name) })}\n-# ${T(lang, 'sub')}`;
    const items = [
        guild.iconURL() ? { thumbnail: [head, guild.iconURL({ extension: 'png', size: 128 })] } : { text: head },
        { rule: true },
        { text: `${T(lang, 'progress', { done, total: core.length })}\n\`${'█'.repeat(filled)}${'░'.repeat(10 - filled)}\`\n${lines.join('\n')}` },
    ];
    if (moreLeft) items.push({ text: `-# ${T(lang, 'moreLeft', { n: moreLeft })}` });
    items.push({ rule: true }, { text: `-# ${T(lang, 'hint')}` });
    items.push({ row: new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(`${DASHBOARD}/dashboard/${guild.id}/overview`).setLabel(T(lang, 'btnDashboard')).setEmoji(icon('dashboard')),
        new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${guild.id}`).setLabel(T(lang, 'btnServer')).setEmoji(icon('link')),
        new ButtonBuilder().setCustomId(`setuprem:off:${guild.id}`).setStyle(ButtonStyle.Secondary).setLabel(T(lang, 'btnOff')).setEmoji(icon('bellOff')),
    ) });
    return v2.card(GOLD, items);
}

let running = false;
async function sweep(client) {
    if (running) return;
    running = true;
    try {
        const db = client.db;
        ensure(db);
        const due = db.prepare("SELECT * FROM setup_reminders WHERE state = 'pending' AND due_at <= ? LIMIT 20").all(Date.now());
        for (const r of due) {
            const guild = client.guilds.cache.get(r.guild_id);
            if (!guild) { setState(db, r.guild_id, 'gone'); continue; }
            let res;
            try { res = require('./setup-checklist').compute(client, guild); } catch (e) { console.error('[SETUP-REMINDER] checklist:', e.message); continue; }
            if (!res.coreLeft) { setState(db, r.guild_id, 'done'); continue; }
            // Scheduled for the owner because the audit log was closed at join: look again, it may be open now,
            // and the person who added ARCHON is the right one to remind
            let to = r.user_id;
            if (to === guild.ownerId) {
                const inv = await require('./guild-welcome').inviterOf(client, guild, guild.joinedTimestamp || Date.now()).catch(() => null);
                if (inv && inv.id !== to) to = inv.id;
            }
            const user = await client.users.fetch(to).catch(() => null);
            const sent = user ? await user.send(card(r.lang || 'en', guild, res)).then(() => true).catch(() => false) : false;
            setState(db, r.guild_id, sent ? 'sent' : 'nodm');
            console.log(`[SETUP-REMINDER] ${guild.name} (${guild.id}): ${sent ? `sent to ${user.username}` : 'DMs closed, nothing sent'} · ${res.coreLeft} core item(s) left`);
        }
    } catch (e) {
        console.error('[SETUP-REMINDER] sweep:', e.message);
    } finally {
        running = false;
    }
}

function start(client) {
    setTimeout(() => sweep(client), 60 * 1000);
    setInterval(() => sweep(client), SWEEP).unref?.();
}

// setuprem:off:<guildId> — the reminder card's "Don't remind me"
async function handleComponent(interaction, client) {
    const [, what, gid] = interaction.customId.split(':');
    if (what !== 'off') return interaction.deferUpdate().catch(() => {});
    const db = client.db;
    ensure(db);
    const row = db.prepare('SELECT user_id, lang FROM setup_reminders WHERE guild_id = ?').get(gid);
    const lang = SUPPORTED.includes(row?.lang) ? row.lang : 'en';
    if (row && row.user_id !== interaction.user.id) return interaction.reply({ content: T(lang, 'notYours'), flags: MessageFlags.Ephemeral }).catch(() => {});
    setState(db, gid, 'off');
    const name = client.guilds.cache.get(gid)?.name || '';
    return interaction.update(v2.card(GREY, [{ text: `-# ${icon('bellOff')} ${T(lang, 'offDone', { server: safe(name) })}` }])).catch(() => {});
}

module.exports = { schedule, sweep, start, handleComponent };
