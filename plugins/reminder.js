'use strict';
// /remind set · list: reminders as V2 cards, texts in lang/<locale>/remind.json.
// ONE delivery engine: tick() runs every 30 s from index.js (startReminderHeartbeat) and sends every due reminder once,
// for this plugin and for Lydia's "[REMIND: …]" reminders. No setTimeout, so nothing is lost or doubled on restart.
// Each due row is claimed with status 'pending' → 'sending' before it is sent, then marked 'sent'.
const { SlashCommandBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { t, slashLang, LANGS } = require('../lib/i18n');
const v2 = require('../lib/games/v2');
const ui = require('../lib/games/ui');
const E = require('../config/emojis');
const mention = require('../lib/mentions');

const MIN_MS = 60 * 1000;
const MAX_MS = 30 * 86400 * 1000;
const MAX_PENDING = 25;   // per person
const MAX_TEXT = 500;
const LIST_SHOWN = 10;

const em = (k, fb = '') => E[k] || fb;
const tr = (lang) => (k, vars) => t('remind.' + k, lang, vars || {});
const now = () => Math.floor(Date.now() / 1000);

// "1h30m", "2d", "45m", "1d 2h" → milliseconds (null when nothing valid is found)
function parseTime(input) {
    const s = String(input || '').toLowerCase();
    let ms = 0;
    const d = s.match(/(\d+)\s*d/); if (d) ms += +d[1] * 86400000;
    const h = s.match(/(\d+)\s*h/); if (h) ms += +h[1] * 3600000;
    const m = s.match(/(\d+)\s*m/); if (m) ms += +m[1] * 60000;
    return ms > 0 ? ms : null;
}

// ─── Database ───
function setupReminderDB(db) {
    try {
        db.prepare(`CREATE TABLE IF NOT EXISTS reminders (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, channel_id TEXT NOT NULL, message TEXT NOT NULL,
            execute_at INTEGER NOT NULL, status TEXT DEFAULT 'pending', delivered INTEGER DEFAULT 0, created_at INTEGER DEFAULT 0
        )`).run();
        // Older tables were created by different code: add whatever column is missing
        const have = new Set(db.prepare('PRAGMA table_info(reminders)').all().map(c => c.name));
        const want = { user_tag: 'TEXT', guild_id: 'TEXT', status: "TEXT DEFAULT 'pending'", delivered: 'INTEGER DEFAULT 0', created_at: 'INTEGER DEFAULT 0' };
        for (const [col, type] of Object.entries(want)) {
            if (!have.has(col)) db.prepare(`ALTER TABLE reminders ADD COLUMN ${col} ${type}`).run();
        }
        // Rows already delivered by the old timers must not be sent again
        db.prepare(`UPDATE reminders SET status = 'sent' WHERE delivered = 1 AND status = 'pending'`).run();
        // A row stuck in 'sending' (bot stopped mid-send) goes back in the queue
        db.prepare(`UPDATE reminders SET status = 'pending' WHERE status = 'sending'`).run();
        db.prepare('CREATE INDEX IF NOT EXISTS idx_reminders_execute ON reminders(execute_at)').run();
        db.prepare('CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id)').run();
    } catch (e) {
        console.error('[REMINDER DB] Setup failed:', e.message);
    }
}

const pendingOf = (db, userId) => db.prepare(
    `SELECT id, message, execute_at FROM reminders WHERE user_id = ? AND status = 'pending' ORDER BY execute_at ASC`,
).all(userId);

function create(db, { userId, userTag, guildId, channelId, text, executeAt }) {
    const id = `rem_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    db.prepare(`INSERT INTO reminders (id, user_id, user_tag, guild_id, channel_id, message, execute_at, status, delivered, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?)`).run(id, userId, userTag || null, guildId || null, channelId, text, executeAt, now());
    return id;
}

// ─── Cards ───
// customId remind:cancel:<id>[:list]: ":list" means the button sits in the list card, so the list is shown again after cancelling
const cancelBtn = (_, id, inList) => new ButtonBuilder().setCustomId(`remind:cancel:${id}${inList ? ':list' : ''}`).setLabel(_('btn_cancel')).setStyle(ButtonStyle.Secondary);

function setCard(lang, text, executeAt, id, dmNote) {
    const _ = tr(lang);
    return v2.card(0x5865f2, [
        { section: [
            `## ${em('clock', '⏰')} ${_('set_title')}\n${_('set_body', { text, when: `<t:${executeAt}:R>`, at: `<t:${executeAt}:f>` })}`,
            cancelBtn(_, id),
        ] },
        { text: `-# ${_(dmNote ? 'set_dm' : 'set_here')}` },
    ]);
}

function listCard(client, lang, db, userId) {
    const _ = tr(lang);
    const rows = pendingOf(db, userId);
    if (!rows.length) {
        return v2.card(0x95a5a6, [{ text: `## ${em('clock', '⏰')} ${_('list_title')}\n${_('list_empty', { cmd: mention(client, 'remind', 'set') })}` }]);
    }
    const items = [{ text: `## ${em('clock', '⏰')} ${_('list_title')}\n${_('list_count', { count: rows.length })}` }, { rule: true }];
    for (const r of rows.slice(0, LIST_SHOWN)) {
        const short = r.message.length > 120 ? r.message.slice(0, 117) + '…' : r.message;
        items.push({ section: [`**${short}**\n-# <t:${r.execute_at}:R> · <t:${r.execute_at}:f>`, cancelBtn(_, r.id, true)] });
    }
    if (rows.length > LIST_SHOWN) items.push({ text: `-# ${_('list_more', { count: rows.length - LIST_SHOWN })}` });
    return v2.card(0x5865f2, items);
}

const errorCard = (text) => v2.card(0xe74c3c, [{ text }]);

// Shared by slash and prefix. Returns a card; `ephemeral` tells the caller to hide it.
function setReminder(client, db, lang, ctx, durationText, text) {
    const _ = tr(lang);
    const ms = parseTime(durationText);
    if (!ms) return { card: errorCard(_('bad_time')), ephemeral: true };
    if (ms < MIN_MS || ms > MAX_MS) return { card: errorCard(_('out_of_range')), ephemeral: true };
    text = String(text || '').trim().slice(0, MAX_TEXT);
    if (!text) return { card: errorCard(_('no_text')), ephemeral: true };
    if (pendingOf(db, ctx.userId).length >= MAX_PENDING) return { card: errorCard(_('too_many', { max: MAX_PENDING })), ephemeral: true };

    const executeAt = Math.floor((Date.now() + ms) / 1000);
    const id = create(db, { ...ctx, text, executeAt });
    return { card: setCard(lang, text, executeAt, id, !!ctx.guildId), ephemeral: false };
}

// ─── Delivery (called every 30 s) ───
function langFor(client, guildId) {
    const l = guildId ? client.getServerSettings?.(guildId)?.language : null;
    return LANGS.includes(l) ? l : 'en';
}

let ticking = false;
async function tick(client, db) {
    if (ticking || !client.isReady?.()) return;
    ticking = true;
    try {
        const due = db.prepare(`SELECT * FROM reminders WHERE status = 'pending' AND execute_at <= ? ORDER BY execute_at LIMIT 50`).all(now());
        for (const r of due) {
            // Claim the row first: if two loops ever run, only one gets it
            const claimed = db.prepare(`UPDATE reminders SET status = 'sending' WHERE id = ? AND status = 'pending'`).run(r.id).changes === 1;
            if (!claimed) continue;
            await deliver(client, r).catch(e => console.error('[REMINDER] deliver:', e.message));
            db.prepare(`UPDATE reminders SET status = 'sent', delivered = 1 WHERE id = ?`).run(r.id);
        }
        db.prepare(`DELETE FROM reminders WHERE status IN ('sent', 'cancelled') AND execute_at < ?`).run(now() - 7 * 86400);
    } catch (e) {
        console.error('[REMINDER] tick:', e.message);
    } finally {
        ticking = false;
    }
}

async function deliver(client, r) {
    const _ = tr(langFor(client, r.guild_id));
    const late = now() - r.execute_at > 120;
    const lines = [`## ${em('clock', '🔔')} ${_('due_title')}`, `**${r.message}**`];
    const setAt = r.created_at > 0 ? `<t:${r.created_at}:R>` : null;
    const where = r.guild_id ? `<#${r.channel_id}>` : null;
    if (setAt && where) lines.push(`-# ${_('due_meta', { when: setAt, where })}`);
    else if (setAt) lines.push(`-# ${_('due_meta_dm', { when: setAt })}`);
    if (late) lines.push(`-# ${_('due_late')}`);

    // 1. Direct message
    const user = await client.users.fetch(r.user_id).catch(() => null);
    if (user) {
        const ok = await user.send(v2.card(0xf1c40f, [{ text: lines.join('\n') }])).then(() => true).catch(() => false);
        if (ok) return;
    }
    // 2. DMs closed: ping in the channel where it was set
    const ch = await client.channels.fetch(r.channel_id).catch(() => null);
    if (!ch?.isTextBased?.()) return;
    const card = v2.card(0xf1c40f, [{ text: `<@${r.user_id}>\n` + lines.join('\n') + `\n-# ${_('due_fallback')}` }]);
    card.allowedMentions = { users: [r.user_id] };
    await ch.send(card).catch(e => console.error('[REMINDER] channel send:', e.message));
}

// ─── Cancel button (routed from index.js: customId "remind:cancel:<id>") ───
async function handleButton(interaction, client) {
    const db = client.db;
    const lang = slashLang(interaction);
    const _ = tr(lang);
    const [, , id, from] = interaction.customId.split(':');
    const row = db.prepare('SELECT user_id, status FROM reminders WHERE id = ?').get(id);
    if (!row || row.user_id !== interaction.user.id) {
        const card = errorCard(_('not_yours'));
        return interaction.reply({ ...card, flags: card.flags | 64 }).catch(() => {});
    }
    if (row.status === 'pending') db.prepare(`UPDATE reminders SET status = 'cancelled' WHERE id = ?`).run(id);
    const card = from === 'list'
        ? listCard(client, lang, db, interaction.user.id)
        : v2.card(0x95a5a6, [{ text: `${em('clock', '⏰')} ${_(row.status === 'pending' ? 'cancelled' : 'already_done')}` }]);
    return interaction.update(card).catch(e => console.error('[REMINDER] cancel:', e.message));
}

const data = new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Set a reminder or see the ones you have')
    .setDescriptionLocalizations({ fr: 'Crée un rappel ou vois les tiens', 'zh-CN': '设置提醒或查看你的提醒' })
    .addSubcommand(s => s.setName('set').setDescription('Get a reminder after a delay')
        .setDescriptionLocalizations({ fr: 'Reçois un rappel après un délai', 'zh-CN': '在一段时间后提醒你' })
        .addStringOption(o => o.setName('in').setDescription('When: 30m, 2h, 1h30m, 3d (up to 30 days)').setRequired(true)
            .setDescriptionLocalizations({ fr: 'Quand : 30m, 2h, 1h30m, 3d (jusqu’à 30 jours)', 'zh-CN': '多久后：30m、2h、1h30m、3d（最多 30 天）' }))
        .addStringOption(o => o.setName('about').setDescription('What to remind you about').setRequired(true).setMaxLength(MAX_TEXT)
            .setDescriptionLocalizations({ fr: 'De quoi te rappeler', 'zh-CN': '提醒你什么' })))
    .addSubcommand(s => s.setName('list').setDescription('See and cancel your reminders')
        .setDescriptionLocalizations({ fr: 'Vois et annule tes rappels', 'zh-CN': '查看和取消你的提醒' }));

module.exports = {
    name: 'remind',
    aliases: ['reminder', 'remindme', 'rappel', 'reminders'],
    description: 'Set a reminder or see the ones you have',
    category: 'UTILITY',
    cooldown: 2000,
    usage: '.remind <time> <text> · .remind list',
    examples: ['.remind 1h Take a break', '.remind 2h30m Scrim with the team', '.remind list'],
    data,

    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        const L = LANGS.includes(lang) ? lang : 'en';
        db = db || client.db;
        if (['list', 'liste', 'all'].includes(String(args[0] || '').toLowerCase()) || usedCommand === 'reminders') {
            return message.reply(listCard(client, L, db, message.author.id)).catch(() => {});
        }
        if (args.length < 2) {
            const p = serverSettings?.prefix || process.env.PREFIX || '.';
            return message.reply(v2.card(0x5865f2, [{ text: tr(L)('usage', { p }) }])).catch(() => {});
        }
        // The time can be split ("1h 30m"): take every leading word that looks like a duration
        let i = 0;
        while (i < args.length - 1 && /^\d+\s*[dhm]$|^(\d+[dhm])+$/i.test(args[i])) i++;
        const res = setReminder(client, db, L, {
            userId: message.author.id, userTag: message.author.tag, guildId: message.guild?.id, channelId: message.channel.id,
        }, args.slice(0, Math.max(1, i)).join(' '), args.slice(Math.max(1, i)).join(' '));
        return message.reply(res.card).catch(() => {});
    },

    execute: async (interaction, client) => {
        const lang = slashLang(interaction);
        const db = client.db;
        if (interaction.options.getSubcommand() === 'list') {
            const card = listCard(client, lang, db, interaction.user.id);
            return interaction.reply({ ...card, flags: card.flags | 64 }).catch(() => {});
        }
        const res = setReminder(client, db, lang, {
            userId: interaction.user.id, userTag: interaction.user.tag, guildId: interaction.guildId, channelId: interaction.channelId,
        }, interaction.options.getString('in'), interaction.options.getString('about'));
        return interaction.reply(res.ephemeral ? { ...res.card, flags: res.card.flags | 64 } : res.card).catch(() => {});
    },

    // index.js calls these at start-up and every 30 s
    setupReminderDB,
    rehydrateReminders: () => {},   // kept so the old start-up call still works; tick() covers overdue reminders
    tick,
    handleButton,
    _internal: { parseTime },
};
