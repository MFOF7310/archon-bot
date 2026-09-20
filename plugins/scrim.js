const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const EMOJIS = require('../config/emojis');

// ================= HELPERS =================

function getTimezone(db, guildId) {
    try {
        const row = db.prepare('SELECT timezone FROM server_settings WHERE guild_id = ?').get(guildId);
        return row?.timezone || 'UTC';
    } catch { return 'UTC'; }
}

// Parse "YYYY-MM-DD HH:MM" in the given IANA zone into a unix timestamp.
// Uses Intl to find the zone's offset at that moment — no external deps.
function toUnix(dateStr, timeStr, tz) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
    const t = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
    if (!m || !t) return null;

    const [, y, mo, d] = m.map(Number);
    const [, hh, mm] = t.map(Number);
    if (hh > 23 || mm > 59) return null;

    // Treat the wall-clock time as UTC first, then correct by the zone offset.
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

function buildScrimEmbed(scrim, signups, guild) {
    const { yes, no } = signups;
    const isClosed = scrim.status === 'cancelled';

    const list = ids => ids.length
        ? ids.map(id => `<@${id}>`).join('\n')
        : '*Nobody yet*';

    const embed = new EmbedBuilder()
        .setColor(isClosed ? '#95a5a6' : '#2ecc71')
        .setAuthor({ name: `${guild?.name || 'Scrim'} • Scrim`, iconURL: guild?.iconURL() || undefined })
        .setTitle(`${EMOJIS.gamer} ${scrim.title || 'Scrim'}${isClosed ? ' — CANCELLED' : ''}`)
        .setDescription(
            `${EMOJIS.clock} <t:${scrim.scheduled_at}:F>\n` +
            `*<t:${scrim.scheduled_at}:R>*` +
            (scrim.note ? `\n\n${scrim.note}` : '')
        )
        .addFields(
            { name: `${EMOJIS.check} Joining — ${yes.length}`, value: list(yes).slice(0, 1024), inline: true },
            { name: `${EMOJIS.error} Can't make it — ${no.length}`, value: list(no).slice(0, 1024), inline: true },
        )
        .setFooter({ text: `Scrim #${scrim.id} • ARCHON CG-223` })
        .setTimestamp();

    return embed;
}

function buildScrimRow(scrimId, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`scrim_yes_${scrimId}`)
            .setLabel('Joining')
            .setStyle(ButtonStyle.Success)
            .setEmoji(EMOJIS.check)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`scrim_no_${scrimId}`)
            .setLabel("Can't make it")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(EMOJIS.error)
            .setDisabled(disabled),
    );
}

// Re-render the scrim message after a signup change.
async function refreshScrimMessage(client, scrim) {
    if (!scrim.message_id) return;
    try {
        const ch = await client.channels.fetch(scrim.channel_id).catch(() => null);
        if (!ch) return;
        const msg = await ch.messages.fetch(scrim.message_id).catch(() => null);
        if (!msg) return;
        const guild = ch.guild;
        const signups = getSignups(client.db, scrim.id);
        await msg.edit({
            embeds: [buildScrimEmbed(scrim, signups, guild)],
            components: [buildScrimRow(scrim.id, scrim.status !== 'open')],
        }).catch(() => {});
    } catch (_) {}
}

// ================= REMINDER LOOP =================
// Called once from index.js. Checks every minute for scrims starting in <= 15min.

function startScrimReminders(client) {
    setInterval(async () => {
        const db = client.db;
        if (!db) return;
        const now = Math.floor(Date.now() / 1000);
        let due;
        try {
            due = db.prepare(
                `SELECT * FROM scrims
                 WHERE status = 'open' AND reminded = 0
                   AND scheduled_at > ? AND scheduled_at <= ?`
            ).all(now, now + 900);
        } catch { return; }

        for (const scrim of due) {
            try {
                const { yes } = getSignups(db, scrim.id);
                const ch = await client.channels.fetch(scrim.channel_id).catch(() => null);
                if (ch && yes.length) {
                    await ch.send({
                        content: yes.map(id => `<@${id}>`).join(' '),
                        embeds: [new EmbedBuilder()
                            .setColor('#f39c12')
                            .setTitle(`${EMOJIS.alarm} Scrim starting soon`)
                            .setDescription(
                                `**${scrim.title || 'Scrim'}** starts <t:${scrim.scheduled_at}:R>.\n` +
                                `${yes.length} player${yes.length === 1 ? '' : 's'} confirmed.`
                            )
                            .setFooter({ text: `Scrim #${scrim.id} • ARCHON CG-223` })
                        ],
                    }).catch(() => {});
                }
                db.prepare('UPDATE scrims SET reminded = 1 WHERE id = ?').run(scrim.id);
            } catch (_) {}
        }

        // Mark past scrims as done and lock their buttons.
        try {
            const ended = db.prepare(
                `SELECT * FROM scrims WHERE status = 'open' AND scheduled_at < ?`
            ).all(now - 3600);
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

    const scrim = db.prepare('SELECT * FROM scrims WHERE id = ?').get(scrimId);
    if (!scrim) {
        return interaction.reply({ content: 'This scrim no longer exists.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    if (scrim.status !== 'open') {
        return interaction.reply({ content: 'This scrim is closed.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }

    const uid = interaction.user.id;
    const existing = db.prepare('SELECT status FROM scrim_signups WHERE scrim_id = ? AND user_id = ?').get(scrimId, uid);

    let note;
    if (existing?.status === choice) {
        db.prepare('DELETE FROM scrim_signups WHERE scrim_id = ? AND user_id = ?').run(scrimId, uid);
        note = 'Removed your response.';
    } else {
        db.prepare(
            `INSERT INTO scrim_signups (scrim_id, user_id, status, signed_at)
             VALUES (?, ?, ?, strftime('%s','now'))
             ON CONFLICT(scrim_id, user_id) DO UPDATE SET status = excluded.status, signed_at = excluded.signed_at`
        ).run(scrimId, uid, choice);
        note = choice === 'yes' ? "You're in." : 'Marked as unavailable.';
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
            addStringOption(o => o.setName('date').setDescription('YYYY-MM-DD').setRequired(true)).
            addStringOption(o => o.setName('time').setDescription('HH:MM in the server timezone (24h)').setRequired(true)).
            addStringOption(o => o.setName('title').setDescription('Name of the scrim')).
            addStringOption(o => o.setName('note').setDescription('Lobby code, mode, rules...'))).
        addSubcommand(s => s.setName('list').setDescription('Show upcoming scrims')).
        addSubcommand(s => s.setName('cancel').setDescription('Cancel a scrim (admin)').
            addIntegerOption(o => o.setName('id').setDescription('Scrim ID').setRequired(true))),

    execute: async (interaction, client) => {
        if (!interaction.guild) {
            return interaction.reply({ content: 'Server only.', flags: MessageFlags.Ephemeral });
        }
        const db = client.db;
        const gid = interaction.guild.id;
        const sub = interaction.options.getSubcommand();
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator)
            || interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);

        // ---- CREATE ----
        if (sub === 'create') {
            if (!isAdmin) {
                return interaction.reply({ content: 'Only admins can schedule scrims.', flags: MessageFlags.Ephemeral });
            }

            const tz = getTimezone(db, gid);
            const at = toUnix(
                interaction.options.getString('date'),
                interaction.options.getString('time'),
                tz
            );
            if (!at) {
                return interaction.reply({
                    content: 'Could not read that date or time. Use `YYYY-MM-DD` and `HH:MM`, for example `2026-09-24` and `20:30`.',
                    flags: MessageFlags.Ephemeral,
                });
            }
            if (at <= Math.floor(Date.now() / 1000)) {
                return interaction.reply({ content: 'That time is already in the past.', flags: MessageFlags.Ephemeral });
            }

            await interaction.deferReply();

            const info = db.prepare(
                `INSERT INTO scrims (guild_id, channel_id, created_by, title, note, scheduled_at)
                 VALUES (?, ?, ?, ?, ?, ?)`
            ).run(
                gid, interaction.channelId, interaction.user.id,
                interaction.options.getString('title') || 'Scrim',
                interaction.options.getString('note') || null,
                at
            );
            const scrimId = info.lastInsertRowid;
            const scrim = db.prepare('SELECT * FROM scrims WHERE id = ?').get(scrimId);

            const msg = await interaction.editReply({
                embeds: [buildScrimEmbed(scrim, { yes: [], no: [] }, interaction.guild)],
                components: [buildScrimRow(scrimId)],
            });
            db.prepare('UPDATE scrims SET message_id = ? WHERE id = ?').run(msg.id, scrimId);
            return;
        }

        // ---- LIST ----
        if (sub === 'list') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const now = Math.floor(Date.now() / 1000);
            const rows = db.prepare(
                `SELECT * FROM scrims WHERE guild_id = ? AND status = 'open' AND scheduled_at > ?
                 ORDER BY scheduled_at ASC LIMIT 10`
            ).all(gid, now);

            if (!rows.length) {
                return interaction.editReply({ content: 'No scrims scheduled.' });
            }
            const lines = rows.map(s => {
                const { yes } = getSignups(db, s.id);
                return `**#${s.id}** — ${s.title || 'Scrim'}\n<t:${s.scheduled_at}:F> · <t:${s.scheduled_at}:R> · ${yes.length} joining`;
            });
            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor('#3498db')
                    .setTitle(`${EMOJIS.gamer} Upcoming scrims`)
                    .setDescription(lines.join('\n\n'))
                    .setFooter({ text: 'ARCHON CG-223' })
                ],
            });
        }

        // ---- CANCEL ----
        if (sub === 'cancel') {
            if (!isAdmin) {
                return interaction.reply({ content: 'Only admins can cancel scrims.', flags: MessageFlags.Ephemeral });
            }
            const id = interaction.options.getInteger('id');
            const scrim = db.prepare('SELECT * FROM scrims WHERE id = ? AND guild_id = ?').get(id, gid);
            if (!scrim) {
                return interaction.reply({ content: `No scrim #${id} on this server.`, flags: MessageFlags.Ephemeral });
            }
            db.prepare("UPDATE scrims SET status = 'cancelled' WHERE id = ?").run(id);
            await refreshScrimMessage(client, { ...scrim, status: 'cancelled' });

            const { yes } = getSignups(db, id);
            if (yes.length) {
                const ch = await client.channels.fetch(scrim.channel_id).catch(() => null);
                if (ch) {
                    await ch.send({
                        content: yes.map(u => `<@${u}>`).join(' '),
                        embeds: [new EmbedBuilder()
                            .setColor('#e74c3c')
                            .setTitle(`${EMOJIS.warning} Scrim cancelled`)
                            .setDescription(`**${scrim.title || 'Scrim'}** (<t:${scrim.scheduled_at}:F>) has been cancelled.`)
                        ],
                    }).catch(() => {});
                }
            }
            return interaction.reply({ content: `Scrim #${id} cancelled.`, flags: MessageFlags.Ephemeral });
        }
    },

    // Exported for index.js
    handleScrimButton,
    startScrimReminders,
};

