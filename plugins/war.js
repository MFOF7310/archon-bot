// plugins/war.js
const { EmbedBuilder, SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const EMOJIS  = require('../config/emojis');
const i18n    = require('../lib/i18n');
const mention = require('../lib/mentions');

const RESULT_ICON  = { win: '🟢', loss: '🔴', draw: '🟡' };
const RESULT_LABEL = { win: 'Win', loss: 'Loss', draw: 'Draw' };
const SWORD = `<:doublesword:1567162772251344978>`;

function isAdmin(member) {
    return member.permissions.has(PermissionFlagsBits.Administrator)
        || member.permissions.has(PermissionFlagsBits.ManageGuild);
}

function record(db, gid) {
    const rows = db.prepare(
        `SELECT result, COUNT(*) AS n FROM clan_wars WHERE guild_id = ? GROUP BY result`
    ).all(gid);
    const r = { win: 0, loss: 0, draw: 0 };
    for (const row of rows) r[row.result] = row.n;
    const played   = r.win + r.loss + r.draw;
    const decisive = r.win + r.loss;
    return { ...r, played, winRate: decisive ? Math.round((r.win / decisive) * 100) : 0 };
}

function currentStreak(db, gid) {
    const rows = db.prepare(
        `SELECT result FROM clan_wars WHERE guild_id = ? ORDER BY played_at DESC, id DESC LIMIT 50`
    ).all(gid);
    if (!rows.length) return null;
    const kind = rows[0].result;
    let n = 0;
    for (const row of rows) {
        if (row.result !== kind) break;
        n++;
    }
    return { kind, n };
}

function matchLine(w) {
    const icon  = RESULT_ICON[w.result] || '⚪';
    const score = w.score ? ` \`${w.score}\`` : '';
    const mode  = w.mode  ? ` · ${w.mode}`    : '';
    return `${icon} **${w.opponent}**${score}${mode} — <t:${w.played_at}:d>`;
}

function tr(lang, key, vars) {
    return i18n.t(`war.${key}`, lang, vars);
}

module.exports = {
    name: 'war',
    aliases: ['wars', 'clanwar', 'guerre'],
    description: 'Track clan war results against other clans.',
    category: 'GAMING',
    usage: '/war record | /war stats | /war history | /war delete',
    cooldown: 3000,

    data: new SlashCommandBuilder().setName('war').setDescription(`${SWORD} Clan war tracker`)
        .addSubcommand(s => s.setName('record').setDescription('Record a match result (admin)')
            .addStringOption(o => o.setName('opponent').setDescription('Clan you played').setRequired(true))
            .addStringOption(o => o.setName('result').setDescription('How it went').setRequired(true)
                .addChoices(
                    { name: 'Win',  value: 'win'  },
                    { name: 'Loss', value: 'loss' },
                    { name: 'Draw', value: 'draw' },
                ))
            .addStringOption(o => o.setName('score').setDescription('e.g. 3-1'))
            .addStringOption(o => o.setName('mode').setDescription('e.g. BR, Search & Destroy, Hardpoint'))
            .addStringOption(o => o.setName('note').setDescription('Anything worth remembering')))
        .addSubcommand(s => s.setName('stats').setDescription('Clan record and win rate'))
        .addSubcommand(s => s.setName('history').setDescription('Recent matches')
            .addStringOption(o => o.setName('opponent').setDescription('Filter by clan')))
        .addSubcommand(s => s.setName('delete').setDescription('Remove a recorded match (admin)')
            .addIntegerOption(o => o.setName('id').setDescription('Match ID').setRequired(true))),

    execute: async (interaction, client) => {
        if (!interaction.guild) {
            return interaction.reply({ content: tr('en', 'server_only'), flags: MessageFlags.Ephemeral });
        }
        const lang = i18n.slashLang(interaction);
        const db   = client.db;
        const gid  = interaction.guild.id;
        const sub  = interaction.options.getSubcommand();

        // ---- RECORD ----
        if (sub === 'record') {
            if (!isAdmin(interaction.member)) {
                return interaction.reply({ content: tr(lang, 'no_permission'), flags: MessageFlags.Ephemeral });
            }

            const opponent = interaction.options.getString('opponent').trim().slice(0, 80);
            const result   = interaction.options.getString('result');
            const score    = interaction.options.getString('score')?.trim().slice(0, 20) || null;
            const mode     = interaction.options.getString('mode')?.trim().slice(0, 40)  || null;
            const note     = interaction.options.getString('note')?.trim().slice(0, 300) || null;

            const info = db.prepare(
                `INSERT INTO clan_wars (guild_id, opponent, result, score, mode, note, recorded_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).run(gid, opponent, result, score, mode, note, interaction.user.id);

            const r      = record(db, gid);
            const streak = currentStreak(db, gid);
            const draws  = r.draw ? ` – ${r.draw}D` : '';
            const plural = r.played === 1 ? '' : 's';

            const desc = (score ? tr(lang, 'match_recorded_score', { score }) : '')
                       + (mode  ? tr(lang, 'match_recorded_mode',  { mode  }) : '')
                       + (note  ? `\n${note}` : '');

            const recordValue = tr(lang, 'win_rate', { w: r.win, l: r.loss, draws, n: r.played, plural, rate: r.winRate })
                + (streak && streak.n > 1
                    ? `\n${tr(lang, 'streak', { icon: RESULT_ICON[streak.kind], n: streak.n, result: RESULT_LABEL[streak.kind].toLowerCase() })}`
                    : '');

            const embed = new EmbedBuilder()
                .setColor(result === 'win' ? '#2ecc71' : result === 'loss' ? '#e74c3c' : '#f39c12')
                .setAuthor({ name: `${interaction.guild.name} • Clan War`, iconURL: interaction.guild.iconURL() || undefined })
                .setTitle(`${RESULT_ICON[result]} ${RESULT_LABEL[result]} vs ${opponent}`)
                .setDescription(desc || null)
                .addFields({ name: tr(lang, 'record_field'), value: recordValue, inline: false })
                .setFooter({ text: tr(lang, 'match_footer', { id: info.lastInsertRowid, user: interaction.user.username }) })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // ---- STATS ----
        if (sub === 'stats') {
            const r = record(db, gid);
            if (!r.played) {
                return interaction.reply({
                    content: `${tr(lang, 'no_matches')} ${mention(client, 'war', 'record')}`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            const streak = currentStreak(db, gid);
            const recent = db.prepare(
                `SELECT * FROM clan_wars WHERE guild_id = ? ORDER BY played_at DESC, id DESC LIMIT 5`
            ).all(gid);
            const rivals = db.prepare(
                `SELECT opponent,
                        SUM(result = 'win')  AS w,
                        SUM(result = 'loss') AS l,
                        COUNT(*)             AS n
                 FROM clan_wars WHERE guild_id = ?
                 GROUP BY LOWER(opponent) ORDER BY n DESC LIMIT 5`
            ).all(gid);

            const draws  = r.draw ? ` – ${r.draw}D` : '';
            const plural = r.played === 1 ? '' : 's';

            const desc = tr(lang, 'win_rate', { w: r.win, l: r.loss, draws, n: r.played, plural, rate: r.winRate })
                + (streak && streak.n > 1
                    ? `\n${tr(lang, 'streak', { icon: RESULT_ICON[streak.kind], n: streak.n, result: RESULT_LABEL[streak.kind].toLowerCase() })}`
                    : '');

            const embed = new EmbedBuilder()
                .setColor('#3498db')
                .setAuthor({ name: `${interaction.guild.name} • Clan War`, iconURL: interaction.guild.iconURL() || undefined })
                .setTitle(`${EMOJIS.trophy} Clan record`)
                .setDescription(desc);

            if (rivals.length) {
                embed.addFields({
                    name: tr(lang, 'most_played_field'),
                    value: rivals.map(x => `**${x.opponent}** — ${x.w}W ${x.l}L (${x.n})`).join('\n'),
                    inline: false,
                });
            }

            embed.addFields({ name: tr(lang, 'recent_field'), value: recent.map(matchLine).join('\n'), inline: false })
                 .setFooter({ text: tr(lang, 'stats_footer') })
                 .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // ---- HISTORY ----
        if (sub === 'history') {
            const opp  = interaction.options.getString('opponent');
            const rows = opp
                ? db.prepare(
                    `SELECT * FROM clan_wars WHERE guild_id = ? AND LOWER(opponent) LIKE LOWER(?)
                     ORDER BY played_at DESC, id DESC LIMIT 20`).all(gid, `%${opp}%`)
                : db.prepare(
                    `SELECT * FROM clan_wars WHERE guild_id = ?
                     ORDER BY played_at DESC, id DESC LIMIT 20`).all(gid);

            if (!rows.length) {
                return interaction.reply({
                    content: opp
                        ? tr(lang, 'no_matches_vs', { opponent: opp })
                        : `${tr(lang, 'no_matches')} ${mention(client, 'war', 'record')}`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            const w = rows.filter(x => x.result === 'win').length;
            const l = rows.filter(x => x.result === 'loss').length;

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#3498db')
                    .setAuthor({ name: `${interaction.guild.name} • Clan War`, iconURL: interaction.guild.iconURL() || undefined })
                    .setTitle(`${SWORD} Match history${opp ? ` — ${opp}` : ''}`)
                    .setDescription(rows.map(x => `\`#${x.id}\` ${matchLine(x)}`).join('\n'))
                    .setFooter({ text: tr(lang, 'history_footer', { w, l, n: rows.length }) })
                ],
            });
        }

        // ---- DELETE ----
        if (sub === 'delete') {
            if (!isAdmin(interaction.member)) {
                return interaction.reply({ content: tr(lang, 'no_permission'), flags: MessageFlags.Ephemeral });
            }
            const id  = interaction.options.getInteger('id');
            const row = db.prepare('SELECT * FROM clan_wars WHERE id = ? AND guild_id = ?').get(id, gid);
            if (!row) {
                return interaction.reply({ content: tr(lang, 'delete_not_found', { id }), flags: MessageFlags.Ephemeral });
            }
            db.prepare('DELETE FROM clan_wars WHERE id = ?').run(id);
            return interaction.reply({
                content: tr(lang, 'delete_done', { id, result: RESULT_LABEL[row.result], opponent: row.opponent }),
                flags: MessageFlags.Ephemeral,
            });
        }
    },

    // Prefix: .war -> stats | .war <clan> -> history for that clan
    run: async (client, message, args) => {
        if (!message.guild) return message.reply(tr('en', 'server_only')).catch(() => {});
        const lang = client.detectLanguage ? client.detectLanguage('war', message.guild.id) : 'en';
        const db   = client.db;
        const gid  = message.guild.id;
        const arg  = args.join(' ').trim();

        if (arg) {
            const rows = db.prepare(
                `SELECT * FROM clan_wars WHERE guild_id = ? AND LOWER(opponent) LIKE LOWER(?)
                 ORDER BY played_at DESC, id DESC LIMIT 20`
            ).all(gid, `%${arg}%`);
            if (!rows.length) {
                return message.reply(tr(lang, 'no_matches_vs', { opponent: arg })).catch(() => {});
            }
            const w = rows.filter(x => x.result === 'win').length;
            const l = rows.filter(x => x.result === 'loss').length;
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#3498db')
                    .setTitle(`${SWORD} vs ${arg}`)
                    .setDescription(rows.map(x => `\`#${x.id}\` ${matchLine(x)}`).join('\n'))
                    .setFooter({ text: tr(lang, 'history_footer', { w, l, n: rows.length }) })
                ],
            }).catch(() => {});
        }

        const r = record(db, gid);
        if (!r.played) {
            return message.reply(`${tr(lang, 'no_matches')} ${mention(client, 'war', 'record')}`).catch(() => {});
        }
        const streak = currentStreak(db, gid);
        const recent = db.prepare(
            `SELECT * FROM clan_wars WHERE guild_id = ? ORDER BY played_at DESC, id DESC LIMIT 5`
        ).all(gid);
        const draws  = r.draw ? ` – ${r.draw}D` : '';
        const plural = r.played === 1 ? '' : 's';

        return message.reply({
            embeds: [new EmbedBuilder()
                .setColor('#3498db')
                .setTitle(`${EMOJIS.trophy} Clan record`)
                .setDescription(
                    tr(lang, 'win_rate', { w: r.win, l: r.loss, draws, n: r.played, plural, rate: r.winRate }) +
                    (streak && streak.n > 1
                        ? `\n${tr(lang, 'streak', { icon: RESULT_ICON[streak.kind], n: streak.n, result: RESULT_LABEL[streak.kind].toLowerCase() })}`
                        : '')
                )
                .addFields({ name: tr(lang, 'recent_field'), value: recent.map(matchLine).join('\n'), inline: false })
                .setFooter({ text: r.played === 1 ? tr(lang, 'total_footer', { n: r.played }) : tr(lang, 'total_footer_plural', { n: r.played }) })
            ],
        }).catch(() => {});
    },
};
