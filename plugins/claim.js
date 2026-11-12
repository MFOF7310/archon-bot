// /claim and .claim — the daily bonus.
// One gold card: what was earned, the streak on a 7-day strip with the next milestone, the balance, and two buttons
// (Remind me tomorrow, My profile). Reminders are opt-in: one DM when the next bonus is ready, never a public ping.
// Buttons use fixed ids (claim:...) routed from index.js, so they keep working after a restart.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, MessageFlags } = require('discord.js');
const v2 = require('../lib/games/v2');
const { t: i18n } = require('../lib/i18n');
const { pickLang } = require('../lib/pick-lang');
const { icon } = require('../lib/ui/icons');
const em = (k, fb) => { try { return require('../config/emojis')[k] || fb; } catch { return fb; } };

const DAY = 24 * 60 * 60 * 1000;
const GOLD = 0xE6A817;
const GREY = 0x4E5058;
const BASE_XP = 250;
const MILESTONES = [[3, 'dailyInitiateRoleId', 'DAILY_INITIATE_ROLE_ID'], [7, 'dailyWarriorRoleId', 'DAILY_WARRIOR_ROLE_ID'],
    [30, 'dailyChampionRoleId', 'DAILY_CHAMPION_ROLE_ID'], [100, 'dailyLegendRoleId', 'DAILY_LEGEND_ROLE_ID']];

const tr = (lang) => (k, v) => i18n('claim.' + k, lang, v);
const fmt = (n) => Number(n || 0).toLocaleString('en-US').replace(/,/g, ' ');
const levelOf = (xp) => Math.floor(0.1 * Math.sqrt(xp || 0)) + 1;
const ts = (ms, style = 'R') => `<t:${Math.floor(ms / 1000)}:${style}>`;

// ─── reminders (opt-in) ───
function setupDailyReminderDB(db) {
    try {
        db.prepare(`CREATE TABLE IF NOT EXISTS daily_reminders (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, user_tag TEXT, guild_id TEXT NOT NULL,
            channel_id TEXT NOT NULL, lang TEXT DEFAULT 'en', execute_at INTEGER NOT NULL, delivered INTEGER DEFAULT 0)`).run();
        db.prepare('CREATE INDEX IF NOT EXISTS idx_daily_reminders_user ON daily_reminders(user_id, guild_id)').run();
        db.prepare('CREATE TABLE IF NOT EXISTS claim_reminders_on (user_id TEXT NOT NULL, guild_id TEXT NOT NULL, PRIMARY KEY (user_id, guild_id))').run();
    } catch (e) { console.error('[CLAIM] reminder tables:', e.message); }
}
const remindersOn = (db, uid, gid) => { try { return !!db.prepare('SELECT 1 FROM claim_reminders_on WHERE user_id = ? AND guild_id = ?').get(uid, gid); } catch { return false; } };

function setReminders(db, uid, gid, on) {
    setupDailyReminderDB(db);
    if (on) db.prepare('INSERT OR IGNORE INTO claim_reminders_on (user_id, guild_id) VALUES (?, ?)').run(uid, gid);
    else {
        db.prepare('DELETE FROM claim_reminders_on WHERE user_id = ? AND guild_id = ?').run(uid, gid);
        db.prepare('UPDATE daily_reminders SET delivered = 1 WHERE user_id = ? AND guild_id = ? AND delivered = 0').run(uid, gid);
    }
}

const timers = new Map();   // reminder id -> timeout
function arm(client, db, row) {
    const wait = row.execute_at * 1000 - Date.now();
    if (timers.has(row.id)) clearTimeout(timers.get(row.id));
    timers.set(row.id, setTimeout(() => { timers.delete(row.id); deliver(client, db, row.id).catch(() => {}); }, Math.max(1000, Math.min(wait, 2 ** 31 - 1))));
}

function schedule(client, db, uid, gid, channelId, lang, lastClaim) {
    setupDailyReminderDB(db);
    const at = Math.floor((lastClaim + DAY) / 1000);
    if (at * 1000 <= Date.now()) return;   // already claimable: nothing to remind
    db.prepare('UPDATE daily_reminders SET delivered = 1 WHERE user_id = ? AND guild_id = ? AND delivered = 0').run(uid, gid);
    const row = { id: `dr_${uid}_${gid}_${Date.now()}`, user_id: uid, guild_id: gid, channel_id: channelId || '', lang, execute_at: at };
    db.prepare('INSERT INTO daily_reminders (id, user_id, guild_id, channel_id, lang, execute_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(row.id, uid, gid, row.channel_id, lang, at);
    arm(client, db, row);
}

async function deliver(client, db, id) {
    const row = db.prepare('SELECT * FROM daily_reminders WHERE id = ? AND delivered = 0').get(id);
    if (!row) return;
    db.prepare('UPDATE daily_reminders SET delivered = 1 WHERE id = ?').run(id);
    if (!remindersOn(db, row.user_id, row.guild_id)) return;
    const guild = client.guilds.cache.get(row.guild_id);
    if (!guild) return;
    const t = tr(pickLang(client, row.guild_id, null, row.user_id));
    const user = client.getUserData?.(row.user_id, row.guild_id) || {};
    const streak = Number(user.streak_days || 0);
    const card = v2.card(GOLD, [
        { text: `### ${em('notification', '🔔')} ${t('dmTitle', { server: guild.name })}` },
        { text: `-# ${streak > 1 ? t('dmSub', { n: streak }) : t('dmSubNone')}` },
        { row: new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`claim:off:${row.guild_id}`).setLabel(t('btnStop')).setEmoji(icon('bellOff')).setStyle(ButtonStyle.Secondary)) },
    ]);
    const u = await client.users.fetch(row.user_id).catch(() => null);
    await u?.send(card).catch(() => {});   // closed DMs: nothing else, no public mention
    try { db.prepare('DELETE FROM daily_reminders WHERE delivered = 1 AND execute_at < ?').run(Math.floor(Date.now() / 1000) - 604800); } catch {}
}

// At start-up: pending reminders of people who asked for them are armed again; the others are dropped
async function rehydrateDailyReminders(client, db) {
    setupDailyReminderDB(db);
    let rows = [];
    try { rows = db.prepare('SELECT * FROM daily_reminders WHERE delivered = 0').all(); } catch { return; }
    let kept = 0;
    for (const r of rows) {
        if (!remindersOn(db, r.user_id, r.guild_id)) { db.prepare('UPDATE daily_reminders SET delivered = 1 WHERE id = ?').run(r.id); continue; }
        arm(client, db, r); kept++;
    }
    if (rows.length) console.log(`[CLAIM] ${kept} daily reminder(s) armed again`);
}

// ─── the cards ───
function nextMilestone(streak, settings, guildId) {
    const main = guildId === process.env.GUILD_ID;
    for (const [days, key, env] of MILESTONES) {
        if (streak < days) return { days, role: settings?.[key] || (main ? process.env[env] : null) || null };
    }
    return null;
}
function strip(streak) {
    const filled = streak <= 0 ? 0 : ((streak - 1) % 7) + 1;
    return Array.from({ length: 7 }, (_, i) => i < filled ? em('dot_yellow', '🟡') : em('dot_white', '⚪')).join(' ');
}

function buttons(t, uid, gid, on) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`claim:remind:${uid}:${gid}`).setLabel(on ? t('btnRemindOn') : t('btnRemind'))
            .setEmoji(icon('bell')).setStyle(on ? ButtonStyle.Success : ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`claim:profile:${uid}:${gid}`).setLabel(t('btnProfile')).setEmoji(icon('member')).setStyle(ButtonStyle.Secondary),
    );
}

function successCard(t, { user, name, gid, got, data, settings, on, now }) {
    const streak = data.streak_days;
    const ms = nextMilestone(streak, settings, gid);
    const reached = MILESTONES.find(([d]) => d === streak);
    let line = `${em('streak', '🔥')} ${t('streak', { n: streak })}`;
    if (reached) line += ` · ${t('milestoneReached', { n: streak })}`;
    else if (ms) line += ` · ${ms.role ? t('nextMilestoneRole', { n: ms.days, role: `<@&${ms.role}>` }) : t('nextMilestone', { n: ms.days })}`;
    const items = [
        { thumbnail: [`## ${t('title', { credits: fmt(got.credits), xp: fmt(got.xp) })}\n-# ${t('sub', { name })}`, user.displayAvatarURL({ extension: 'png', size: 128 })] },
        { rule: true },
        { text: `${line}\n${strip(streak)}` },
        { text: `${t('balance', { credits: fmt(data.credits), level: data.level })}\n-# ${t('next', { when: ts(now + DAY), deadline: ts(now + 2 * DAY, 't') })}` },
        { row: buttons(t, user.id, gid, on) },
    ];
    return { ...v2.card(GOLD, items), allowedMentions: { parse: [] } };
}

function waitCard(t, { data, last }) {
    const streak = Number(data.streak_days || 0);
    const alive = streak > 0 && Date.now() < last + 2 * DAY;
    return v2.card(GREY, [
        { text: `### ${em('clock', '⏰')} ${t('waitTitle', { when: ts(last + DAY) })}` },
        { text: `-# ${alive ? t('waitSub', { n: streak, deadline: ts(last + 2 * DAY, 'f') }) : t('waitSubNone')}` },
    ]);
}

function profileCard(t, user, name, data) {
    return v2.card(GOLD, [
        { thumbnail: [`### ${name}\n-# ${t('profileLevel', { n: data.level || levelOf(data.xp) })}`, user.displayAvatarURL({ extension: 'png', size: 128 })] },
        { rule: true },
        { text: t('profileBody', { xp: fmt(data.xp), credits: fmt(data.credits), streak: data.streak_days || 0, best: data.highest_streak || 0, total: data.total_dailies || 0 }) },
    ]);
}

// ─── the claim itself ───
const busy = new Set();   // one claim at a time per member and server (two quick clicks used to pay twice)

async function claim(client, { user, member, guild, channel, lang }) {
    const name = member?.displayName || user.globalName || user.username;
    const t = tr(lang);
    const db = client.db;
    const gid = guild?.id || 'DM';
    const settings = guild ? (client.getServerSettings?.(gid) || {}) : {};
    if (settings.dailyChannel && channel && channel.id !== settings.dailyChannel) return { private: true, payload: { content: t('channelOnly', { channel: `<#${settings.dailyChannel}>` }) } };

    const key = `${user.id}:${gid}`;
    if (busy.has(key)) return { private: true, payload: { content: t('busy') } };
    busy.add(key);
    try {
        const data = client.getUserData?.(user.id, gid) || client.getOrCreateUser?.(user.id, gid, user.username) || {};
        const last = Number(data.last_daily || 0);
        const now = Date.now();
        if (last && now - last < DAY) return { private: true, payload: waitCard(t, { data, last }) };

        // Streak: the next day keeps it going, more than 48 h starts over
        const streak = last && now - last < 2 * DAY ? Number(data.streak_days || 0) + 1 : 1;
        const bonusXP = streak > 1 ? Math.min(streak * 25, 250) : 25;
        const bonusCredits = streak > 1 ? Math.min(streak * 10, 100) : 10;
        // The dashboard's daily bonus (it used to be ignored: everyone got 100)
        const base = Math.max(0, parseInt(settings.dailyBonus ?? settings.daily_bonus, 10) || 200);
        const got = { xp: BASE_XP + bonusXP, credits: base + bonusCredits };

        const xp = Number(data.xp || 0) + got.xp;
        const updated = {
            ...data, username: user.username, xp, credits: Number(data.credits || 0) + got.credits,
            streak_days: streak, last_daily: now, last_reminder: now,
            total_dailies: Number(data.total_dailies || 0) + 1, highest_streak: Math.max(streak, Number(data.highest_streak || 0)),
            guild_id: gid,
        };
        client.queueUserUpdate?.(user.id, gid, updated);
        updated.level = Math.max(Number(data.level || 1), levelOf(xp));

        // Streak roles at 3, 7, 30 and 100 days
        const hit = MILESTONES.find(([d]) => d === streak);
        if (hit && guild && member) {
            const roleId = settings[hit[1]] || (gid === process.env.GUILD_ID ? process.env[hit[2]] : null);
            const role = roleId && guild.roles.cache.get(roleId);
            if (role && !member.roles.cache.has(role.id)) await member.roles.add(role, `Daily streak: ${streak} days`).catch(() => {});
        }

        const on = guild ? remindersOn(db, user.id, gid) : false;
        if (on) schedule(client, db, user.id, gid, channel?.id, lang, now);
        return { private: false, payload: successCard(t, { user, name, gid, got, data: updated, settings, on, now }) };
    } finally {
        busy.delete(key);
    }
}

// ─── buttons (claim:remind | claim:profile | claim:off) ───
async function handleComponent(interaction, client) {
    const [, what, a, b] = interaction.customId.split(':');
    const lang = pickLang(client, interaction.guildId || b || a, interaction, interaction.user.id);
    const t = tr(lang);
    const db = client.db;

    if (what === 'off') {   // from the reminder DM
        setReminders(db, interaction.user.id, a, false);
        return interaction.update({ ...v2.card(GREY, [{ text: `### ${em('ic_bell_off', '🔕')} ${t('remindOff')}` }]) }).catch(() => {});
    }
    if (interaction.user.id !== a) return interaction.reply({ content: t('notYours'), flags: MessageFlags.Ephemeral }).catch(() => {});

    if (what === 'profile') {
        const data = client.getUserData?.(a, b) || {};
        return interaction.reply({ ...profileCard(t, interaction.user, interaction.member?.displayName || interaction.user.globalName || interaction.user.username, data), flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral }).catch(() => {});
    }
    if (what === 'remind') {
        const on = !remindersOn(db, a, b);
        setReminders(db, a, b, on);
        if (on) {
            const data = client.getUserData?.(a, b) || {};
            schedule(client, db, a, b, interaction.channelId, lang, Number(data.last_daily || 0));
        }
        // Flip the button on the card, then say what changed, privately
        try {
            const rows = interaction.message.components;
            const json = rows.map((r) => r.toJSON());
            const walk = (c) => { if (c.custom_id === interaction.customId) { c.label = on ? t('btnRemindOn') : t('btnRemind'); c.style = on ? ButtonStyle.Success : ButtonStyle.Primary; } (c.components || []).forEach(walk); if (c.accessory) walk(c.accessory); };
            json.forEach(walk);
            await interaction.update({ components: json, flags: MessageFlags.IsComponentsV2 });
        } catch { await interaction.deferUpdate().catch(() => {}); }
        return interaction.followUp({ content: on ? t('remindOn') : t('remindOff'), flags: MessageFlags.Ephemeral }).catch(() => {});
    }
}

module.exports = {
    name: 'claim',
    aliases: ['reclamer', 'reclaim', 'collect', 'recolter', 'réclamer'],
    description: '⚡ Claim your daily rewards.',
    category: 'ECONOMY',
    usage: '.claim',
    cooldown: 3000,
    data: new SlashCommandBuilder().setName('claim').setDescription('⚡ Claim your daily rewards'),

    run: async (client, message) => {
        const lang = pickLang(client, message.guild?.id, null, message.author.id);
        try {
            const r = await claim(client, { user: message.author, member: message.member, guild: message.guild, channel: message.channel, lang });
            const sent = await message.reply({ ...r.payload, allowedMentions: { parse: [] } }).catch(() => null);
            // A "not yet" answer can't be private on a prefix command: it removes itself
            if (r.private && sent) setTimeout(() => sent.delete().catch(() => {}), 15000);
        } catch (e) {
            console.error('[CLAIM]', e.message);
            message.reply({ content: tr(lang)('error') }).catch(() => {});
        }
    },

    execute: async (interaction, client) => {
        const lang = pickLang(client, interaction.guildId, interaction, interaction.user.id);
        try {
            const r = await claim(client, { user: interaction.user, member: interaction.member, guild: interaction.guild, channel: interaction.channel, lang });
            const flags = (r.payload.components ? MessageFlags.IsComponentsV2 : 0) | (r.private ? MessageFlags.Ephemeral : 0);
            return interaction.reply({ ...r.payload, flags, allowedMentions: { parse: [] } });
        } catch (e) {
            console.error('[CLAIM]', e.message);
            const p = { content: tr(lang)('error'), flags: MessageFlags.Ephemeral };
            return (interaction.replied || interaction.deferred ? interaction.followUp(p) : interaction.reply(p)).catch(() => {});
        }
    },

    handleComponent,
    setupDailyReminderDB,
    rehydrateDailyReminders,
};
