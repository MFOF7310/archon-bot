'use strict';
// /global — the network economy: one wallet that follows a member across every ARCHON server.
// balance · daily · leaderboard · network · transfer, all as gold V2 cards (lib/games/v2), icons from lib/ui/icons.js,
// words from lang/<locale>/global.json.
// A transfer always goes through a confirmation card, and the money moves inside one SQLite transaction
// (debit only if the balance covers it, then credit, then the log line), so a crash can't lose credits half-way.
// Bots, yourself and amounts under MIN_SEND are refused. /global daily stays separate from /claim on purpose:
// /claim pays this server's credits, /global daily pays network credits.
// Buttons, the member picker and the amount box use global:… ids routed from index.js, so they survive a restart.
const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, MessageFlags,
    UserSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const v2 = require('../lib/games/v2');
const { t: i18n } = require('../lib/i18n');
const { pickLang } = require('../lib/pick-lang');
const { icon } = require('../lib/ui/icons');

const GOLD = 0xE6A817;
const GREY = 0x4E5058;
const DAY = 86400;          // seconds: global_credits stores unix seconds
const FEE = 5;              // network fee, in percent
const MIN_SEND = 10;        // below this the fee would round to nothing
const PAGE = 10;
const PAGES = 3;            // the leaderboard shows the top 30
const TIERS = [7, 30, 100]; // streak days where the daily base goes up (calculateDailyReward)

const tr = (lang) => (k, v) => i18n('global.' + k, lang, v);
const fmt = (n) => Number(n || 0).toLocaleString('en-US').replace(/,/g, ' ');
const ts = (sec, style = 'R') => `<t:${Math.floor(sec)}:${style}>`;
const nowSec = () => Math.floor(Date.now() / 1000);
const clean = (s) => String(s || '').replace(/[_*~`|\\<>#[\]]/g, '\\$&').slice(0, 32);

// ═══════════════════════════════ DATABASE ═══════════════════════════════
const ready = new WeakSet();
function setupDB(db) {
    if (ready.has(db)) return;
    db.prepare(`CREATE TABLE IF NOT EXISTS global_credits (
        user_id TEXT PRIMARY KEY,
        username TEXT,
        total_credits INTEGER DEFAULT 0,
        earned_all_time INTEGER DEFAULT 0,
        spent_all_time INTEGER DEFAULT 0,
        last_daily INTEGER DEFAULT 0,
        daily_streak INTEGER DEFAULT 0,
        best_streak INTEGER DEFAULT 0,
        updated_at INTEGER DEFAULT 0
    )`).run();
    db.prepare(`CREATE TABLE IF NOT EXISTS global_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user TEXT,
        to_user TEXT,
        amount INTEGER,
        type TEXT,
        guild_id TEXT,
        guild_name TEXT,
        timestamp INTEGER DEFAULT (strftime('%s', 'now'))
    )`).run();
    db.prepare(`CREATE TABLE IF NOT EXISTS global_inventory (
        user_id TEXT,
        item_key TEXT,
        item_name TEXT,
        quantity INTEGER DEFAULT 1,
        purchased_at INTEGER DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (user_id, item_key)
    )`).run();
    db.prepare(`CREATE TABLE IF NOT EXISTS global_leaderboard (
        user_id TEXT PRIMARY KEY,
        username TEXT,
        total_xp INTEGER DEFAULT 0,
        highest_level INTEGER DEFAULT 0,
        total_credits INTEGER DEFAULT 0,
        servers_count INTEGER DEFAULT 0,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`).run();
    db.prepare(`CREATE TABLE IF NOT EXISTS global_server_stats (
        guild_id TEXT PRIMARY KEY,
        guild_name TEXT,
        total_members INTEGER DEFAULT 0,
        total_xp INTEGER DEFAULT 0,
        total_credits INTEGER DEFAULT 0,
        joined_at INTEGER DEFAULT (strftime('%s', 'now')),
        last_active INTEGER DEFAULT (strftime('%s', 'now'))
    )`).run();
    ready.add(db);
}

function getGlobalCredits(db, userId) {
    return db.prepare('SELECT * FROM global_credits WHERE user_id = ?').get(userId) || {
        user_id: userId, username: null, total_credits: 0, earned_all_time: 0,
        spent_all_time: 0, last_daily: 0, daily_streak: 0, best_streak: 0,
    };
}

// Used by index.js on level-up (+50) and by the daily bonus
function addGlobalCredits(db, userId, username, amount, type = 'earn', guildId, guildName) {
    const now = nowSec();
    db.prepare(`INSERT INTO global_credits (user_id, username, total_credits, earned_all_time, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
        total_credits = total_credits + excluded.total_credits,
        earned_all_time = earned_all_time + excluded.earned_all_time,
        username = COALESCE(excluded.username, username),
        updated_at = excluded.updated_at`).run(userId, username || null, amount, amount, now);
    if (type) {
        db.prepare('INSERT INTO global_transactions (from_user, to_user, amount, type, guild_id, guild_name, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            type === 'daily' || type === 'levelup' ? 'system' : userId, userId, amount, type, guildId || '0', guildName || 'Global', now);
    }
}

// One statement: it only takes the credits if they are there (no read-then-write gap)
function deductGlobalCredits(db, userId, amount) {
    const r = db.prepare('UPDATE global_credits SET total_credits = total_credits - ?, spent_all_time = spent_all_time + ?, updated_at = ? WHERE user_id = ? AND total_credits >= ?')
        .run(amount, amount, nowSec(), userId, amount);
    return r.changes > 0;
}

// ─── daily ───
function calculateDailyReward(streak) {
    let base = 250;
    if (streak >= 100) base = 1000;
    else if (streak >= 30) base = 700;
    else if (streak >= 7) base = 500;
    const bonusPercent = Math.min(Math.floor(streak / 7) * 5, 50); // +5% per full week, 50% at most
    const total = Math.floor(base * (1 + bonusPercent / 100));
    return { base, bonus: total - base, total, streak };
}

function claimDaily(db, userId, username) {
    return db.transaction(() => {
        const now = nowSec();
        const row = getGlobalCredits(db, userId);
        const last = Number(row.last_daily || 0);
        if (last && now - last < DAY) {
            return { success: false, nextClaim: last + DAY, streak: Number(row.daily_streak || 0), lastDaily: last };
        }
        // the next day keeps the streak, more than 48 h starts over
        const streak = last && now - last < 2 * DAY ? Number(row.daily_streak || 0) + 1 : 1;
        const best = Math.max(streak, Number(row.best_streak || 0));
        const reward = calculateDailyReward(streak);
        addGlobalCredits(db, userId, username, reward.total, 'daily');
        db.prepare('UPDATE global_credits SET last_daily = ?, daily_streak = ?, best_streak = ? WHERE user_id = ?').run(now, streak, best, userId);
        return { success: true, ...reward, best, nextClaim: now + DAY, lastDaily: now, balance: Number(row.total_credits || 0) + reward.total };
    })();
}

// ─── transfer ───
function feeOf(amount) { return Math.max(1, Math.ceil(amount * FEE / 100)); }

function transferGlobal(db, fromUser, toUser, amount, names = {}) {
    amount = Math.floor(Number(amount));
    if (!Number.isSafeInteger(amount) || amount < MIN_SEND) return { success: false, error: 'AMOUNT' };
    if (String(fromUser) === String(toUser)) return { success: false, error: 'SELF' };
    const tax = feeOf(amount);
    const net = amount - tax;
    return db.transaction(() => {
        const now = nowSec();
        const debit = db.prepare(`UPDATE global_credits SET total_credits = total_credits - ?, spent_all_time = spent_all_time + ?,
            username = COALESCE(?, username), updated_at = ? WHERE user_id = ? AND total_credits >= ?`)
            .run(amount, amount, names.from || null, now, fromUser, amount);
        if (!debit.changes) return { success: false, error: 'NO_FUNDS' };
        db.prepare(`INSERT INTO global_credits (user_id, username, total_credits, earned_all_time, updated_at)
            VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET
            total_credits = total_credits + excluded.total_credits,
            earned_all_time = earned_all_time + excluded.earned_all_time,
            username = COALESCE(excluded.username, username),
            updated_at = excluded.updated_at`).run(toUser, names.to || null, net, net, now);
        db.prepare('INSERT INTO global_transactions (from_user, to_user, amount, type, guild_id, guild_name, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(fromUser, toUser, amount, 'transfer', names.guildId || 'global', names.guildName || 'Cross-Server', now);
        const balance = db.prepare('SELECT total_credits FROM global_credits WHERE user_id = ?').get(fromUser)?.total_credits || 0;
        return { success: true, amount: net, gross: amount, tax, balance };
    })();
}

// ─── sync from the rest of the bot ───
function syncLevelUp(db, userId, username, level, xp) {
    // xp is the member's running total on one server: keep the highest seen, never add it up again on every level
    db.prepare(`INSERT INTO global_leaderboard (user_id, username, total_xp, highest_level, updated_at)
        VALUES (?, ?, ?, ?, strftime('%s', 'now'))
        ON CONFLICT(user_id) DO UPDATE SET
        username = excluded.username,
        total_xp = MAX(total_xp, excluded.total_xp),
        highest_level = MAX(highest_level, excluded.highest_level),
        updated_at = excluded.updated_at`).run(userId, username, Number(xp || 0), Number(level || 0));
}

function syncServerStats(db, guildId, guildName, memberCount, totalCredits) {
    if (!guildId) return;
    // callers pass 0 credits when they don't know them: that used to wipe the server's figure
    db.prepare(`INSERT INTO global_server_stats (guild_id, guild_name, total_members, total_credits, last_active)
        VALUES (?, ?, ?, ?, strftime('%s', 'now'))
        ON CONFLICT(guild_id) DO UPDATE SET
        guild_name = excluded.guild_name,
        total_members = excluded.total_members,
        total_credits = CASE WHEN excluded.total_credits > 0 THEN excluded.total_credits ELSE total_credits END,
        last_active = excluded.last_active`).run(guildId, guildName, memberCount || 0, totalCredits || 0);
}

// ─── reading ───
function getGlobalLeaderboard(db, limit = 10, offset = 0) {
    return db.prepare(`SELECT gc.user_id, gc.username, gc.total_credits, COALESCE(lb.highest_level, 0) AS highest_level
        FROM global_credits gc LEFT JOIN global_leaderboard lb ON gc.user_id = lb.user_id
        WHERE gc.total_credits > 0
        ORDER BY gc.total_credits DESC, highest_level DESC
        LIMIT ? OFFSET ?`).all(limit, offset);
}

function rankOf(db, userId) {
    const me = db.prepare('SELECT total_credits FROM global_credits WHERE user_id = ?').get(userId);
    if (!me || me.total_credits <= 0) return null;
    const above = db.prepare('SELECT COUNT(*) AS n FROM global_credits WHERE total_credits > ?').get(me.total_credits).n;
    return { rank: above + 1, credits: me.total_credits };
}

// Live figures from Discord's cache (the stats table keeps servers ARCHON has left)
function getNetworkStats(db, client) {
    const guilds = client ? [...client.guilds.cache.values()] : [];
    const biggest = guilds.sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0))[0];
    return {
        servers: guilds.length || db.prepare('SELECT COUNT(*) AS n FROM global_server_stats').get().n,
        members: guilds.reduce((s, g) => s + (g.memberCount || 0), 0),
        wallets: db.prepare('SELECT COUNT(*) AS n FROM global_credits WHERE total_credits > 0').get().n,
        economy: db.prepare('SELECT COALESCE(SUM(total_credits), 0) AS n FROM global_credits').get().n,
        avgLevel: Math.round(db.prepare('SELECT AVG(highest_level) AS n FROM global_leaderboard').get().n || 0),
        biggest: biggest?.name || null,
    };
}

function serverBalance(db, userId, guildId) {
    try { return db.prepare('SELECT credits FROM users WHERE id = ? AND guild_id = ?').get(userId, guildId)?.credits || 0; } catch { return 0; }
}

// ═══════════════════════════════ CARDS ═══════════════════════════════
const btn = (id, label, kind, where, style = ButtonStyle.Secondary) => {
    const b = new ButtonBuilder().setCustomId(id).setStyle(style);
    if (label) b.setLabel(label);
    const e = icon(kind, where);
    if (e) b.setEmoji(e);
    return b;
};

function balanceCard(t, { user, name, gid, db, where }) {
    const g = getGlobalCredits(db, user.id);
    const server = serverBalance(db, user.id, gid);
    const now = nowSec();
    const last = Number(g.last_daily || 0);
    const alive = last && now - last < 2 * DAY && g.daily_streak > 0;
    const lines = [`${icon('building', where)} ${t('balServer', { n: fmt(server) })} · ${icon('world', where)} ${t('balNetwork', { n: fmt(g.total_credits) })}`];
    if (alive) lines.push(`${icon('flame', where)} ${t('balStreak', { n: g.daily_streak, best: Math.max(g.best_streak || 0, g.daily_streak) })}`);
    lines.push(`-# ${icon('clock', where)} ${last && now - last < DAY ? t('balNext', { when: ts(last + DAY) }) : t('balReady')}`);
    return v2.card(GOLD, [
        { thumbnail: [`## ${icon('coin', where)} ${t('balTitle', { n: fmt(server + Number(g.total_credits || 0)) })}\n-# ${t('balSub', { name: clean(name) })}`, user.displayAvatarURL({ extension: 'png', size: 128 })] },
        { rule: true },
        { text: lines.join('\n') },
        { row: new ActionRowBuilder().addComponents(
            btn(`global:daily:${user.id}`, t('btnDaily'), 'gift', where, ButtonStyle.Primary),
            btn(`global:lb:${user.id}:0`, t('btnBoard'), 'trophy', where),
            btn(`global:send:${user.id}`, t('btnSend'), 'send', where),
        ) },
    ]);
}

function strip(streak, where) {
    const filled = streak <= 0 ? 0 : ((streak - 1) % 7) + 1;
    return Array.from({ length: 7 }, (_, i) => icon(i < filled ? 'dot_on' : 'dot_off', where)).join(' ');
}

function dailyCard(t, r, where) {
    const next = TIERS.find((d) => r.streak < d);
    const streakLine = `${icon('flame', where)} ${t('dailyStreak', { n: r.streak })} · ${next ? t('dailyNextTier', { n: next }) : t('dailyMax')}`;
    return v2.card(GOLD, [
        { text: `## ${icon('gift', where)} ${t('dailyTitle', { n: fmt(r.total) })}\n-# ${t('dailySub', { base: fmt(r.base), bonus: fmt(r.bonus), balance: fmt(r.balance) })}` },
        { rule: true },
        { text: `${streakLine}\n${strip(r.streak, where)}` },
        { text: `-# ${t('dailyNext', { when: ts(r.nextClaim), deadline: ts(r.lastDaily + 2 * DAY, 't') })}\n-# ${t('dailyAlso')}` },
    ]);
}

function waitCard(t, r, where) {
    const alive = r.streak > 0 && nowSec() < r.lastDaily + 2 * DAY;
    return v2.card(GREY, [
        { text: `### ${icon('clock', where)} ${t('waitTitle', { when: ts(r.nextClaim) })}` },
        { text: `-# ${alive ? t('waitSub', { n: r.streak, deadline: ts(r.lastDaily + 2 * DAY, 'f') }) : t('waitSubNone')}\n-# ${t('dailyAlso')}` },
    ]);
}

function boardCard(t, { db, client, uid, page, where }) {
    // a few extra rows so the bots we skip don't leave the page short
    const all = getGlobalLeaderboard(db, PAGE * PAGES + 10, 0).filter((r) => !client.users.cache.get(r.user_id)?.bot).slice(0, PAGE * PAGES);
    if (!all.length) {
        return v2.card(GREY, [{ text: `### ${icon('trophy', where)} ${t('lbTitle')}\n-# ${t('lbEmpty')}` }]);
    }
    const total = Math.ceil(all.length / PAGE);
    page = Math.min(Math.max(0, Number(page) || 0), total - 1);
    const nameOf = (r) => clean(client.users.cache.get(r.user_id)?.globalName || client.users.cache.get(r.user_id)?.username || r.username || '—');
    const podium = ['crown', 'medal', 'medal2'];
    const rows = all.slice(page * PAGE, page * PAGE + PAGE).map((r, i) => {
        const pos = page * PAGE + i;
        const lead = pos < 3 ? icon(podium[pos], where) : `**${pos + 1}.**`;
        const me = r.user_id === uid ? ` ${icon('star', where)}` : '';
        return `${lead} ${pos < 3 ? `**${nameOf(r)}**` : nameOf(r)} · ${fmt(r.total_credits)} · ${t('lbLevel', { n: r.highest_level || 0 })}${me}`;
    });
    const mine = rankOf(db, uid);
    const items = [
        { text: `## ${icon('trophy', where)} ${t('lbTitle')}\n-# ${t('lbSub')}` },
        { rule: true },
        { text: rows.join('\n') },
        { rule: true },
        { text: `-# ${mine ? t('lbYou', { rank: mine.rank, n: fmt(mine.credits) }) : t('lbYouNone')}` },
    ];
    if (total > 1) {
        items.push({ row: new ActionRowBuilder().addComponents(
            btn(`global:lb:${uid}:${page - 1}`, null, 'page_prev', where).setDisabled(page === 0),
            new ButtonBuilder().setCustomId(`global:noop:${uid}`).setLabel(t('lbPage', { p: page + 1, total })).setStyle(ButtonStyle.Secondary).setDisabled(true),
            btn(`global:lb:${uid}:${page + 1}`, null, 'page_next', where).setDisabled(page >= total - 1),
        ) });
    }
    return v2.card(GOLD, items);
}

function networkCard(t, { db, client, where }) {
    const s = getNetworkStats(db, client);
    const items = [
        { text: `## ${icon('world', where)} ${t('netTitle')}` },
        { rule: true },
        { text: [
            `${icon('server', where)} ${t('netServers', { n: fmt(s.servers) })} · ${icon('users', where)} ${t('netMembers', { n: fmt(s.members) })}`,
            `${icon('coin', where)} ${t('netCredits', { n: fmt(s.economy), w: fmt(s.wallets) })} · ${icon('ch_levelup', where)} ${t('netLevel', { n: s.avgLevel })}`,
        ].join('\n') },
    ];
    if (s.biggest) items.push({ rule: true }, { text: `-# ${t('netBiggest', { name: clean(s.biggest) })}` });
    return v2.card(GOLD, items);
}

function pickCard(t, where) {
    return v2.card(GOLD, [
        { text: `### ${icon('send', where)} ${t('pickTitle')}\n-# ${t('pickSub', { fee: FEE, min: MIN_SEND })}` },
        { row: new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId('global:pick').setPlaceholder(t('pickPlaceholder')).setMinValues(1).setMaxValues(1)) },
    ]);
}

function amountModal(t, toId, toName) {
    return new ModalBuilder().setCustomId(`global:amt:${toId}`).setTitle(t('modalTitle', { name: toName }).slice(0, 45))
        .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount')
            .setLabel(t('modalLabel').slice(0, 45)).setPlaceholder('500').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(12)));
}

function confirmCard(t, { uid, toId, toName, amount, balance, where }) {
    const tax = feeOf(amount);
    return v2.card(GOLD, [
        { text: `### ${icon('send', where)} ${t('confirmTitle', { n: fmt(amount), name: clean(toName) })}` },
        { rule: true },
        { text: `${t('confirmFee', { fee: FEE, tax: fmt(tax), net: fmt(amount - tax) })}\n-# ${t('confirmAfter', { n: fmt(balance - amount) })}` },
        { row: new ActionRowBuilder().addComponents(
            btn(`global:ok:${uid}:${toId}:${amount}`, t('btnConfirm'), 'check', where, ButtonStyle.Success),
            btn(`global:no:${uid}`, t('btnCancel'), 'x', where),
        ) },
    ]);
}

// ═══════════════════════════════ ACTIONS ═══════════════════════════════
const plain = (where, kind, text) => `${icon(kind, where)} ${text}`;

// Checks a transfer before showing the confirmation card: returns an error line, or null when it can go ahead
function checkSend(t, db, uid, to, amount, where) {
    if (!to) return plain(where, 'no', t('errUser'));
    if (to.bot) return plain(where, 'no', t('errBot'));
    if (to.id === uid) return plain(where, 'no', t('errSelf'));
    if (!Number.isSafeInteger(amount) || amount < 1) return plain(where, 'no', t('errAmount'));
    if (amount < MIN_SEND) return plain(where, 'no', t('errMin', { n: MIN_SEND }));
    const have = Number(getGlobalCredits(db, uid).total_credits || 0);
    if (have < amount) return plain(where, 'no', t('errFunds', { n: fmt(have) }));
    return null;
}

const parseAmount = (s) => (/^\s*\d[\d\s]*$/.test(String(s || '')) ? parseInt(String(s).replace(/\s/g, ''), 10) : NaN);
const displayName = (guild, user) => guild?.members?.cache.get(user.id)?.displayName || user.globalName || user.username;

async function notifyReceiver(client, to, from, r, guild) {
    try {
        const lang = pickLang(client, null, null, to.id);
        const t = tr(lang);
        await to.send(v2.card(GOLD, [
            { text: `### ${icon('coin')} ${t('dmTitle', { name: clean(from), n: fmt(r.amount) })}\n-# ${t('dmSub', { server: clean(guild?.name || 'ARCHON') })}` },
        ]));
    } catch { /* DMs closed: the sender still sees it went through */ }
}

const handled = new Set(); // confirmation cards already used (two quick taps must not send twice)

async function handleComponent(interaction, client) {
    const db = client.db;
    setupDB(db);
    const [, what, a, b, c] = interaction.customId.split(':');
    const lang = pickLang(client, interaction.guildId, interaction, interaction.user.id);
    const t = tr(lang);
    const uid = interaction.user.id;
    const priv = (content) => ({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    const v2priv = (card) => ({ ...card, flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });

    // the member picker and the amount box are already private to whoever opened them
    if (what === 'pick') {
        const to = interaction.users.first();
        const err = !to ? t('errUser') : to.bot ? t('errBot') : to.id === uid ? t('errSelf') : null;
        if (err) return interaction.reply(priv(plain(interaction, 'no', err)));
        return interaction.showModal(amountModal(t, to.id, displayName(interaction.guild, to)));
    }
    if (what === 'amt') {
        const to = await client.users.fetch(a).catch(() => null);
        const amount = parseAmount(interaction.fields.getTextInputValue('amount'));
        const err = checkSend(t, db, uid, to, amount, interaction);
        if (err) return interaction.reply(priv(err));
        const balance = Number(getGlobalCredits(db, uid).total_credits || 0);
        return interaction.reply(v2priv(confirmCard(t, { uid, toId: to.id, toName: displayName(interaction.guild, to), amount, balance, where: interaction })));
    }

    if (a && a !== uid) return interaction.reply(priv(plain(interaction, 'no', t('notYours'))));

    if (what === 'daily') {
        const r = claimDaily(db, uid, interaction.user.username);
        if (!r.success) return interaction.reply(v2priv(waitCard(t, r, interaction)));
        return interaction.reply({ ...dailyCard(t, r, interaction), flags: MessageFlags.IsComponentsV2 });
    }
    if (what === 'lb') {
        const card = boardCard(t, { db, client, uid, page: b, where: interaction });
        // from the wallet card: a new private board; from the board itself: turn the page
        if (interaction.message?.components?.some((row) => JSON.stringify(row.toJSON()).includes('"global:noop:'))) return interaction.update(card);
        return interaction.reply(v2priv(card));
    }
    if (what === 'send') return interaction.reply(v2priv(pickCard(t, interaction)));
    if (what === 'no') {
        return interaction.update(v2.card(GREY, [{ text: `-# ${icon('x', interaction)} ${t('cancelled')}` }]));
    }
    if (what === 'ok') {
        const key = interaction.message?.id || interaction.id;
        if (handled.has(key)) return interaction.reply(priv(plain(interaction, 'no', t('errGone'))));
        handled.add(key);
        setTimeout(() => handled.delete(key), 15 * 60 * 1000).unref?.();
        const to = await client.users.fetch(b).catch(() => null);
        const amount = parseInt(c, 10);
        const err = checkSend(t, db, uid, to, amount, interaction);
        if (err) { handled.delete(key); return interaction.reply(priv(err)); }
        const toName = displayName(interaction.guild, to);
        const r = transferGlobal(db, uid, to.id, amount, { from: interaction.user.username, to: to.username, guildId: interaction.guildId, guildName: interaction.guild?.name });
        if (!r.success) { handled.delete(key); return interaction.reply(priv(plain(interaction, 'no', t('errFunds', { n: fmt(getGlobalCredits(db, uid).total_credits) })))); }
        await interaction.update(v2.card(GOLD, [
            { text: `### ${icon('check', interaction)} ${t('sentTitle', { n: fmt(r.amount), name: clean(toName) })}\n-# ${t('sentSub', { tax: fmt(r.tax), balance: fmt(r.balance) })}` },
        ]));
        notifyReceiver(client, to, displayName(interaction.guild, interaction.user), r, interaction.guild);
        return;
    }
    if (what === 'noop') return interaction.deferUpdate().catch(() => {});
}

// ═══════════════════════════════ COMMAND ═══════════════════════════════
module.exports = {
    name: 'global',
    aliases: ['network', 'cross', 'globale'],
    description: '🌐 Cross-server economy — credits work across all servers',
    category: 'ECONOMY',
    cooldown: 3000,
    usage: '.global [balance|daily|leaderboard|network|transfer @member amount]',

    data: new SlashCommandBuilder().setName('global').setDescription('🌐 Cross-server economy')
        .addSubcommand(s => s.setName('balance').setDescription('💰 View your global balance'))
        .addSubcommand(s => s.setName('daily').setDescription('📅 Claim global daily reward'))
        .addSubcommand(s => s.setName('leaderboard').setDescription('🏆 Global credit leaderboard'))
        .addSubcommand(s => s.setName('network').setDescription('🌐 View ARCHITECT network stats'))
        .addSubcommand(s => s.setName('transfer').setDescription('💸 Send credits to another user')
            .addUserOption(o => o.setName('user').setDescription('Recipient').setRequired(true))
            .addIntegerOption(o => o.setName('amount').setDescription('Amount to send').setRequired(true).setMinValue(1))),

    // ─── prefix: .global <sub> ───
    run: async (client, message, args, db, serverSettings) => {
        if (!message.guild) return;
        const lang = pickLang(client, message.guild.id, null, message.author.id);
        const t = tr(lang);
        const where = message;
        const send = (p) => message.reply({ ...p, allowedMentions: { parse: [] } }).catch(() => null);
        try {
            setupDB(db);
            syncServerStats(db, message.guild.id, message.guild.name, message.guild.memberCount, 0);
            const uid = message.author.id;
            const sub = (args[0] || 'balance').toLowerCase();

            if (sub === 'daily') {
                const r = claimDaily(db, uid, message.author.username);
                const sent = await send(r.success ? dailyCard(t, r, where) : waitCard(t, r, where));
                if (!r.success && sent) setTimeout(() => sent.delete().catch(() => {}), 15000);
                return;
            }
            if (['transfer', 'send', 'give'].includes(sub)) {
                const id = String(args[1] || '').replace(/[<@!>]/g, '');
                const to = /^\d{15,25}$/.test(id) ? await client.users.fetch(id).catch(() => null) : null;
                const amount = parseAmount(args[2]);
                const err = !to ? plain(where, 'no', t('errUserPrefix', { prefix: serverSettings?.prefix || '.' })) : checkSend(t, db, uid, to, amount, where);
                if (err) return send({ content: err });
                const balance = Number(getGlobalCredits(db, uid).total_credits || 0);
                return send(confirmCard(t, { uid, toId: to.id, toName: displayName(message.guild, to), amount, balance, where }));
            }
            if (['leaderboard', 'lb', 'top'].includes(sub)) return send(boardCard(t, { db, client, uid, page: 0, where }));
            if (['network', 'stats'].includes(sub)) return send(networkCard(t, { db, client, where }));
            return send(balanceCard(t, { user: message.author, name: message.member?.displayName || message.author.username, gid: message.guild.id, db, where }));
        } catch (e) {
            console.error('[GLOBAL]', e.message);
            return send({ content: plain(where, 'no', t('error')) });
        }
    },

    // ─── slash ───
    execute: async (interaction, client) => {
        const db = client.db;
        const lang = pickLang(client, interaction.guildId, interaction, interaction.user.id);
        const t = tr(lang);
        const where = interaction;
        const uid = interaction.user.id;
        const v2pub = (card) => ({ ...card, flags: MessageFlags.IsComponentsV2 });
        const v2priv = (card) => ({ ...card, flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
        try {
            setupDB(db);
            if (interaction.guild) syncServerStats(db, interaction.guildId, interaction.guild.name, interaction.guild.memberCount, 0);
            const sub = interaction.options.getSubcommand();

            if (sub === 'balance') {
                return interaction.reply(v2pub(balanceCard(t, { user: interaction.user, name: interaction.member?.displayName || interaction.user.globalName || interaction.user.username, gid: interaction.guildId, db, where })));
            }
            if (sub === 'daily') {
                const r = claimDaily(db, uid, interaction.user.username);
                return interaction.reply(r.success ? v2pub(dailyCard(t, r, where)) : v2priv(waitCard(t, r, where)));
            }
            if (sub === 'transfer') {
                const to = interaction.options.getUser('user');
                const amount = interaction.options.getInteger('amount');
                const err = checkSend(t, db, uid, to, amount, where);
                if (err) return interaction.reply({ content: err, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
                const balance = Number(getGlobalCredits(db, uid).total_credits || 0);
                return interaction.reply(v2priv(confirmCard(t, { uid, toId: to.id, toName: displayName(interaction.guild, to), amount, balance, where })));
            }
            if (sub === 'leaderboard') return interaction.reply(v2pub(boardCard(t, { db, client, uid, page: 0, where })));
            if (sub === 'network') return interaction.reply(v2pub(networkCard(t, { db, client, where })));
        } catch (e) {
            console.error('[GLOBAL]', e.message);
            const p = { content: plain(where, 'no', t('error')), flags: MessageFlags.Ephemeral };
            return (interaction.replied || interaction.deferred ? interaction.followUp(p) : interaction.reply(p)).catch(() => {});
        }
    },

    handleComponent,

    // ─── used by index.js and other plugins ───
    setupDB,
    syncLevelUp,
    syncServerStats,
    getGlobalCredits,
    addGlobalCredits,
    deductGlobalCredits,
    claimDaily,
    transferGlobal,
    getNetworkStats,
    getGlobalLeaderboard,
    calculateDailyReward,
};
