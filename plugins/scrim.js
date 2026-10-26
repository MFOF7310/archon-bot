const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
const EMOJIS = require('../config/emojis');
const { resolveEmoji } = require('../lib/emoji-resolver');
const { pickLang } = require('../lib/pick-lang');
const i18n = require('../lib/i18n');

const T = (key, lang, vars) => i18n.t('scrim.' + key, lang, vars) || key;

// ================= HELPERS =================
function getTimezone(db, guildId) {
    try {
        const row = db.prepare('SELECT timezone FROM server_settings WHERE guild_id = ?').get(guildId);
        const tz = row?.timezone || 'UTC';
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return tz;
    } catch { return 'UTC'; }
}

function toUnix(dateStr, timeStr, tz) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
    const t = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
    if (!m || !t) return null;
    const [, y, mo, d] = m.map(Number);
    const [, hh, mm] = t.map(Number);
    if (hh > 23 || mm > 59) return null;
    let guess = Date.UTC(y, mo - 1, d, hh, mm, 0);
    for (let i = 0; i < 2; i++) {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        }).formatToParts(new Date(guess)).reduce((a, p) => (a[p.type] = p.value, a), {});
        const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day,
                               +parts.hour % 24, +parts.minute, +parts.second);
        guess -= (asUTC - guess);
    }
    return Math.floor(guess / 1000);
}

function getSignups(db, scrimId) {
    const rows = db.prepare('SELECT user_id, status FROM scrim_signups WHERE scrim_id = ? ORDER BY signed_at ASC').all(scrimId);
    return {
        yes: rows.filter(r => r.status === 'yes').map(r => r.user_id),
        no:  rows.filter(r => r.status === 'no').map(r => r.user_id),
    };
}

// ================= V2 CARD BUILDER =================
function buildScrimCard(scrim, signups, guild, client, disabled = false, lang = 'en') {
    const { yes, no } = signups;
    const isClosed = scrim.status === 'cancelled' || disabled;
    const accent = isClosed ? 0x95a5a6 : 0x2ecc71;

    const list = ids => ids.length ? ids.map(id => `<@${id}>`).join('\n') : `*${T('nobody_yet', lang)}*`;
    const c = new ContainerBuilder().setAccentColor(accent);

    // Header
    const gamerEm = resolveEmoji('gamer', guild) || '🎮';
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `## ${gamerEm} ${scrim.title || 'Scrim'}${scrim.status === 'cancelled' ? ' — **CANCELLED**' : ''}`
    ));
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

    // Time + Note
    const clockEm = resolveEmoji('clock', guild) || '⏰';
    let body = `${clockEm} <t:${scrim.scheduled_at}:F>\n*<t:${scrim.scheduled_at}:R>*`;
    const noteEm = resolveEmoji('note', guild) || '📝';
    if (scrim.note) body += `\n\n> ${noteEm} ${scrim.note}`;
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(body));

    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

    // Signups with small emojis and subtext
    const checkEm = resolveEmoji('small_check', guild) || '✅';
    const crossEm = resolveEmoji('small_cross', guild) || '❌';
    
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${checkEm} ${T('joining', lang, { n: yes.length })}\n${list(yes).slice(0, 900)}`));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${crossEm} ${T('cant_make_it', lang, { n: no.length })}\n${list(no).slice(0, 900)}`));

    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Scrim #${scrim.id} • ARCHON CG-223`));

    if (client) {
        c.addActionRowComponents(new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`scrim_yes_${scrim.id}`)
                .setLabel(T('btn_joining', lang))
                .setStyle(ButtonStyle.Success)
                .setEmoji(checkEm)
                .setDisabled(disabled || scrim.status !== 'open'),
            new ButtonBuilder()
                .setCustomId(`scrim_no_${scrim.id}`)
                .setLabel(T('btn_cant_make_it', lang))
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(crossEm)
                .setDisabled(disabled || scrim.status !== 'open')
        ));
    }

    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

// ================= REFRESH =================
async function refreshScrimMessage(client, scrim) {
    if (!scrim.message_id) return;
    try {
        const ch = await client.channels.fetch(scrim.channel_id).catch(() => null);
        if (!ch) return;
        const msg = await ch.messages.fetch(scrim.message_id).catch(() => null);
        if (!msg) return;
        const lang = pickLang(client, ch.guildId, null);
        const signups = getSignups(client.db, scrim.id);
        await msg.edit(buildScrimCard(scrim, signups, ch.guild, client, scrim.status !== 'open', lang)).catch(() => {});
    } catch (_) {}
}

// ================= REMINDER LOOP =================
function startScrimReminders(client) {
    setInterval(async () => {
        const db = client.db;
        if (!db) return;
        const now = Math.floor(Date.now() / 1000);
        let due;
        try {
            due = db.prepare(
                `SELECT * FROM scrims WHERE status = 'open' AND reminded = 0 AND scheduled_at > ? AND scheduled_at <= ?`
            ).all(now, now + 900);
        } catch { return; }

        for (const scrim of due) {
            try {
                const { yes } = getSignups(db, scrim.id);
                const ch = await client.channels.fetch(scrim.channel_id).catch(() => null);
                if (ch && yes.length) {
                    const lang = pickLang(client, ch.guildId, null);
                    const alarmEm = resolveEmoji('alarm', ch.guild) || '⏰';
                    const rc = new ContainerBuilder().setAccentColor(0xf39c12);
                    rc.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${alarmEm} ${T('starting_soon', lang)}`));
                    rc.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
                    rc.addTextDisplayComponents(new TextDisplayBuilder().setContent(T('starting_desc', lang, { title: scrim.title || 'Scrim', time: scrim.scheduled_at, count: yes.length })));
                    rc.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Scrim #${scrim.id} • ARCHON CG-223`));
                    await ch.send({ content: yes.map(id => `<@${id}>`).join(' '), components: [rc], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
                }
                db.prepare('UPDATE scrims SET reminded = 1 WHERE id = ?').run(scrim.id);
            } catch (_) {}
        }

        try {
            const ended = db.prepare(`SELECT * FROM scrims WHERE status = 'open' AND scheduled_at < ?`).all(now - 3600);
            for (const scrim of ended) {
                db.prepare("UPDATE scrims SET status = 'done' WHERE id = ?").run(scrim.id);
                await refreshScrimMessage(client, { ...scrim, status: 'done' });
            }
        } catch (_) {}
    }, 60000);
}

// ================= BUTTON HANDLER =================
async function handleScrimButton(interaction, client) {
    const db = client.db;
    const m = /^scrim_(yes|no)_(\d+)$/.exec(interaction.customId);
    if (!m) return;
    const [, choice, idStr] = m;
    const scrimId = Number(idStr);
    const lang = pickLang(client, interaction.guildId, interaction.user.id);

    const scrim = db.prepare('SELECT * FROM scrims WHERE id = ?').get(scrimId);
    if (!scrim) return interaction.reply({ content: 'This scrim no longer exists.', flags: MessageFlags.Ephemeral }).catch(() => {});
    if (scrim.status !== 'open') return interaction.reply({ content: 'This scrim is closed.', flags: MessageFlags.Ephemeral }).catch(() => {});

    const uid = interaction.user.id;
    const existing = db.prepare('SELECT status FROM scrim_signups WHERE scrim_id = ? AND user_id = ?').get(scrimId, uid);
    let note;
    if (existing?.status === choice) {
        db.prepare('DELETE FROM scrim_signups WHERE scrim_id = ? AND user_id = ?').run(scrimId, uid);
        note = T('response_removed', lang);
    } else {
        db.prepare(
            `INSERT INTO scrim_signups (scrim_id, user_id, status, signed_at) VALUES (?, ?, ?, strftime('%s','now'))
             ON CONFLICT(scrim_id, user_id) DO UPDATE SET status = excluded.status, signed_at = excluded.signed_at`
        ).run(scrimId, uid, choice);
        note = choice === 'yes' ? T('you_are_in', lang) : T('marked_unavailable', lang);
    }

    await interaction.deferUpdate().catch(() => {});
    await refreshScrimMessage(client, scrim);
    await interaction.followUp({ content: note, flags: MessageFlags.Ephemeral }).catch(() => {});
}

// ================= COMMAND =================
module.exports = {
    name: 'scrim',
    aliases: ['scrims'],
    description: 'Schedule scrims and track who is coming.',
    category: 'GAMING',
    usage: '/scrim create | /scrim list | /scrim cancel',
    cooldown: 3000,

    data: new SlashCommandBuilder().setName('scrim').setDescription('🎯 Scrim scheduler').
        addSubcommand(s => s.setName('create').setDescription('Schedule a scrim (admin)').
            addStringOption(o => o.setName('date').setDescription('YYYY-MM-DD').setRequired(true).setAutocomplete(true)).
            addStringOption(o => o.setName('time').setDescription('HH:MM in the server timezone (24h)').setRequired(true).setAutocomplete(true)).
            addStringOption(o => o.setName('title').setDescription('Name of the scrim')).
            addStringOption(o => o.setName('note').setDescription('Lobby code, mode, rules...'))).
        addSubcommand(s => s.setName('list').setDescription('Show upcoming scrims')).
        addSubcommand(s => s.setName('cancel').setDescription('Cancel a scrim (admin)').
            addIntegerOption(o => o.setName('id').setDescription('Scrim ID').setRequired(true))),

    autocomplete: async (interaction, client) => {
        const focused = interaction.options.getFocused(true);
        const typed = (focused.value || '').trim();
        const db = client?.db || interaction.client?.db;
        const tz = interaction.guildId ? getTimezone(db, interaction.guildId) : 'UTC';

        if (focused.name === 'date') {
            const out = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date(Date.now() + i * 86400000);
                const iso = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
                const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(d);
                out.push({ name: `${iso} (${label})`, value: iso });
            }
            const filtered = typed ? out.filter(o => o.value.includes(typed)) : out;
            return interaction.respond(filtered.slice(0, 25)).catch(() => {});
        }

        if (focused.name === 'time') {
            const slots = [];
            for (let h = 0; h < 24; h++) {
                for (const m of ['00', '30']) slots.push(`${String(h).padStart(2, '0')}:${m}`);
            }
            let picks;
            if (!typed) {
                const nowLocal = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
                const idx = slots.findIndex(s => s > nowLocal);
                const start = idx === -1 ? 0 : idx;
                picks = slots.slice(start, start + 12);
                if (picks.length < 12) picks = picks.concat(slots.slice(0, 12 - picks.length));
            } else {
                const digits = typed.replace(/[^0-9]/g, '');
                picks = slots.filter(s => s.replace(':', '').startsWith(digits) || s.startsWith(typed));
            }
            return interaction.respond(picks.slice(0, 25).map(s => ({ name: s, value: s }))).catch(() => {});
        }

        return interaction.respond([]).catch(() => {});
    },

    execute: async (interaction, client) => {
        if (!interaction.guild) return interaction.reply({ content: 'Server only.', flags: MessageFlags.Ephemeral });
        const db = client.db;
        const gid = interaction.guild.id;
        const sub = interaction.options.getSubcommand();
        const lang = pickLang(client, gid, interaction.user.id);
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);

        // CREATE
        if (sub === 'create') {
            if (!isAdmin) return interaction.reply({ content: 'Only admins can schedule scrims.', flags: MessageFlags.Ephemeral });
            const tz = getTimezone(db, gid);
            const at = toUnix(interaction.options.getString('date'), interaction.options.getString('time'), tz);
            if (!at) return interaction.reply({ content: 'Could not read that date/time. Use `YYYY-MM-DD` and `HH:MM`.', flags: MessageFlags.Ephemeral });
            if (at <= Math.floor(Date.now() / 1000)) return interaction.reply({ content: 'That time is in the past.', flags: MessageFlags.Ephemeral });

            await interaction.deferReply();
            const info = db.prepare(`INSERT INTO scrims (guild_id, channel_id, created_by, title, note, scheduled_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
                gid, interaction.channelId, interaction.user.id,
                interaction.options.getString('title') || 'Scrim',
                interaction.options.getString('note') || null,
                at
            );
            const scrim = db.prepare('SELECT * FROM scrims WHERE id = ?').get(info.lastInsertRowid);
            const card = buildScrimCard(scrim, { yes: [], no: [] }, interaction.guild, client, false, lang);
            const msg = await interaction.editReply(card);
            db.prepare('UPDATE scrims SET message_id = ? WHERE id = ?').run(msg.id, scrim.id);
            return;
        }

        // LIST
        if (sub === 'list') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const now = Math.floor(Date.now() / 1000);
            const rows = db.prepare(`SELECT * FROM scrims WHERE guild_id = ? AND status = 'open' AND scheduled_at > ? ORDER BY scheduled_at ASC LIMIT 10`).all(gid, now);
            if (!rows.length) return interaction.editReply({ content: 'No scrims scheduled.' });
            try {
                const lines = rows.map(s => {
                    const { yes } = getSignups(db, s.id);
                    const jumpLink = s.message_id ? `[Jump ➔](https://discord.com/channels/${gid}/${s.channel_id}/${s.message_id})` : '';
                    return `> **#${s.id}** — ${s.title || 'Scrim'} ${jumpLink}\n> <t:${s.scheduled_at}:F> · <t:${s.scheduled_at}:R> · ${yes.length} joining`;
                });
                const gamerEm = resolveEmoji('gamer', interaction.guild) || '🎮';
                const lc = new ContainerBuilder().setAccentColor(0x3498db);
                lc.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${gamerEm} ${T('upcoming_scrims', lang)}`));
                lc.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
                lc.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n\n')));
                lc.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ARCHON CG-223`));
                return await interaction.editReply({ components: [lc], flags: MessageFlags.IsComponentsV2 });
            } catch (err) {
                console.error('[SCRIM LIST ERROR]', err);
                return interaction.editReply({ content: '⚠️ Failed to load scrims. Please try again later.' });
            }
        }

        // CANCEL
        if (sub === 'cancel') {
            if (!isAdmin) return interaction.reply({ content: 'Only admins can cancel scrims.', flags: MessageFlags.Ephemeral });
            const id = interaction.options.getInteger('id');
            const scrim = db.prepare('SELECT * FROM scrims WHERE id = ? AND guild_id = ?').get(id, gid);
            if (!scrim) return interaction.reply({ content: `No scrim #${id} on this server.`, flags: MessageFlags.Ephemeral });
            db.prepare("UPDATE scrims SET status = 'cancelled' WHERE id = ?").run(id);
            await refreshScrimMessage(client, { ...scrim, status: 'cancelled' });

            const { yes } = getSignups(db, id);
            if (yes.length) {
                const ch = await client.channels.fetch(scrim.channel_id).catch(() => null);
                if (ch) {
                    const warnEm = resolveEmoji('warning', ch.guild) || '⚠️';
                    const xc = new ContainerBuilder().setAccentColor(0xe74c3c);
                    xc.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${warnEm} ${T('scrim_cancelled', lang)}`));
                    xc.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
                    xc.addTextDisplayComponents(new TextDisplayBuilder().setContent(T('cancelled_desc', lang, { title: scrim.title || 'Scrim', time: scrim.scheduled_at })));
                    await ch.send({ content: yes.map(u => `<@${u}>`).join(' '), components: [xc], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
                }
            }
            return interaction.reply({ content: `Scrim #${id} cancelled.`, flags: MessageFlags.Ephemeral });
        }
    },

    handleScrimButton,
    startScrimReminders,
};
