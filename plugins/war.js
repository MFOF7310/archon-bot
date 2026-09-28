const { EmbedBuilder, SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const EMOJIS = require('../config/emojis');

const RESULT_ICON = { win: '🟢', loss: '🔴', draw: '🟡' };
const RESULT_LABEL = { win: 'Win', loss: 'Loss', draw: 'Draw' };

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
    const played = r.win + r.loss + r.draw;
    const decisive = r.win + r.loss;
    return {
        ...r,
        played,
        winRate: decisive ? Math.round((r.win / decisive) * 100) : 0,
    };
}

// Longest current streak, walking back from the most recent match.
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
    const icon = RESULT_ICON[w.result] || '⚪';
    const score = w.score ? ` \`${w.score}\`` : '';
    const mode = w.mode ? ` · ${w.mode}` : '';
    return `${icon} **${w.opponent}**${score}${mode} — <t:${w.played_at}:d>`;
}

module.exports = {
    name: 'war',
    aliases: ['wars', 'clanwar', 'guerre'],
    description: 'Track clan war results against other clans.',
    category: 'GAMING',
    usage: '/war record | /war stats | /war history | /war delete',
    cooldown: 3000,

    data: new SlashCommandBuilder().setName('war').setDescription('⚔️ Clan war tracker').
        addSubcommand(s => s.setName('record').setDescription('Record a match result (admin)').
            addStringOption(o => o.setName('opponent').setDescription('Clan you played').setRequired(true)).
            addStringOption(o => o.setName('result').setDescription('How it went').setRequired(true).
                addChoices(
                    { name: 'Win', value: 'win' },
                    { name: 'Loss', value: 'loss' },
                    { name: 'Draw', value: 'draw' },
                )).
            addStringOption(o => o.setName('score').setDescription('e.g. 3-1')).
            addStringOption(o => o.setName('mode').setDescription('e.g. BR, Search & Destroy, Hardpoint')).
            addStringOption(o => o.setName('note').setDescription('Anything worth remembering'))).
        addSubcommand(s => s.setName('stats').setDescription('Clan record and win rate')).
        addSubcommand(s => s.setName('history').setDescription('Recent matches').
            addStringOption(o => o.setName('opponent').setDescription('Filter by clan'))).
        addSubcommand(s => s.setName('delete').setDescription('Remove a recorded match (admin)').
            addIntegerOption(o => o.setName('id').setDescription('Match ID').setRequired(true))),

    execute: async (interaction, client) => {
        if (!interaction.guild) {
            return interaction.reply({ content: 'Server only.', flags: MessageFlags.Ephemeral });
        }
        const db = client.db;
        const gid = interaction.guild.id;
        const sub = interaction.options.getSubcommand();

        // ---- RECORD ----
        if (sub === 'record') {
            if (!isAdmin(interaction.member)) {
                return interaction.reply({ content: 'Only admins can record results.', flags: MessageFlags.Ephemeral });
            }

            const opponent = interaction.options.getString('opponent').trim().slice(0, 80);
            const result = interaction.options.getString('result');
            const score = interaction.options.getString('score')?.trim().slice(0, 20) || null;
            const mode = interaction.options.getString('mode')?.trim().slice(0, 40) || null;
            const note = interaction.options.getString('note')?.trim().slice(0, 300) || null;

            const info = db.prepare(
                `INSERT INTO clan_wars (guild_id, opponent, result, score, mode, note, recorded_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).run(gid, opponent, result, score, mode, note, interaction.user.id);

            const r = record(db, gid);
            const streak = currentStreak(db, gid);

            const embed = new EmbedBuilder()
                .setColor(result === 'win' ? '#2ecc71' : result === 'loss' ? '#e74c3c' : '#f39c12')
                .setAuthor({ name: `${interaction.guild.name} • Clan War`, iconURL: interaction.guild.iconURL() || undefined })
                .setTitle(`${RESULT_ICON[result]} ${RESULT_LABEL[result]} vs ${opponent}`)
                .setDescription(
                    (score ? `**Score:** ${score}\n` : '') +
                    (mode ? `**Mode:** ${mode}\n` : '') +
                    (note ? `\n${note}` : '')
                )
                .addFields({
                    name: '📊 Record',
                    value: `**${r.win}W – ${r.loss}L${r.draw ? ` – ${r.draw}D` : ''}** · ${r.winRate}% win rate` +
                        (streak && streak.n > 1 ? `\n${RESULT_ICON[streak.kind]} ${streak.n} ${RESULT_LABEL[streak.kind].toLowerCase()} streak` : ''),
                    inline: false,
                })
                .setFooter({ text: `Match #${info.lastInsertRowid} • recorded by ${interaction.user.username}` })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // ---- STATS ----
        if (sub === 'stats') {
            const r = record(db, gid);
            if (!r.played) {
                return interaction.reply({
                    content: 'No matches recorded yet. Add one with `/war record`.',
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

            const embed = new EmbedBuilder()
                .setColor('#3498db')
                .setAuthor({ name: `${interaction.guild.name} • Clan War`, iconURL: interaction.guild.iconURL() || undefined })
                .setTitle(`${EMOJIS.trophy} Clan record`)
                .setDescription(
                    `**${r.win}W – ${r.loss}L${r.draw ? ` – ${r.draw}D` : ''}** across ${r.played} match${r.played === 1 ? '' : 'es'}\n` +
                    `**${r.winRate}%** win rate` +
                    (streak && streak.n > 1 ? `\n${RESULT_ICON[streak.kind]} On a **${streak.n} ${RESULT_LABEL[streak.kind].toLowerCase()}** streak` : '')
                );

            if (rivals.length) {
                embed.addFields({
                    name: '🎯 Most played',
                    value: rivals.map(x => `**${x.opponent}** — ${x.w}W ${x.l}L (${x.n})`).join('\n'),
                    inline: false,
                });
            }

            embed.addFields({
                name: '🕐 Recent',
                value: recent.map(matchLine).join('\n'),
                inline: false,
            });

            embed.setFooter({ text: '/war history for the full log' }).setTimestamp();
            return interaction.reply({ embeds: [embed] });
        }

        // ---- HISTORY ----
        if (sub === 'history') {
            const opp = interaction.options.getString('opponent');
            const rows = opp
                ? db.prepare(
                    `SELECT * FROM clan_wars WHERE guild_id = ? AND LOWER(opponent) LIKE LOWER(?)
                     ORDER BY played_at DESC, id DESC LIMIT 20`).all(gid, `%${opp}%`)
                : db.prepare(
                    `SELECT * FROM clan_wars WHERE guild_id = ?
                     ORDER BY played_at DESC, id DESC LIMIT 20`).all(gid);

            if (!rows.length) {
                return interaction.reply({
                    content: opp ? `No matches recorded against **${opp}**.` : 'No matches recorded yet.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const w = rows.filter(x => x.result === 'win').length;
            const l = rows.filter(x => x.result === 'loss').length;

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#3498db')
                    .setAuthor({ name: `${interaction.guild.name} • Clan War`, iconURL: interaction.guild.iconURL() || undefined })
                    .setTitle(`⚔️ Match history${opp ? ` — ${opp}` : ''}`)
                    .setDescription(rows.map(x => `\`#${x.id}\` ${matchLine(x)}`).join('\n'))
                    .setFooter({ text: `${w}W ${l}L in the last ${rows.length}` })
                ],
            });
        }

        // ---- DELETE ----
        if (sub === 'delete') {
            if (!isAdmin(interaction.member)) {
                return interaction.reply({ content: 'Only admins can remove results.', flags: MessageFlags.Ephemeral });
            }
            const id = interaction.options.getInteger('id');
            const row = db.prepare('SELECT * FROM clan_wars WHERE id = ? AND guild_id = ?').get(id, gid);
            if (!row) {
                return interaction.reply({ content: `No match #${id} on this server.`, flags: MessageFlags.Ephemeral });
            }
            db.prepare('DELETE FROM clan_wars WHERE id = ?').run(id);
            return interaction.reply({
                content: `Match #${id} (${RESULT_LABEL[row.result]} vs ${row.opponent}) removed.`,
                flags: MessageFlags.Ephemeral,
            });
        }
    },

    // Prefix: .war -> stats | .war <clan> -> history for that clan
    run: async (client, message, args) => {
        if (!message.guild) return message.reply('Server only.').catch(() => {});
        const db = client.db;
        const gid = message.guild.id;
        const arg = args.join(' ').trim();

        if (arg) {
            const rows = db.prepare(
                `SELECT * FROM clan_wars WHERE guild_id = ? AND LOWER(opponent) LIKE LOWER(?)
                 ORDER BY played_at DESC, id DESC LIMIT 20`
            ).all(gid, `%${arg}%`);
            if (!rows.length) {
                return message.reply(`No matches recorded against **${arg}**.`).catch(() => {});
            }
            const w = rows.filter(x => x.result === 'win').length;
            const l = rows.filter(x => x.result === 'loss').length;
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#3498db')
                    .setTitle(`⚔️ vs ${arg}`)
                    .setDescription(rows.map(x => `\`#${x.id}\` ${matchLine(x)}`).join('\n'))
                    .setFooter({ text: `${w}W ${l}L` })
                ],
            }).catch(() => {});
        }

        const r = record(db, gid);
        if (!r.played) {
            return message.reply('No matches recorded yet. Use `/war record` to add one.').catch(() => {});
        }
        const streak = currentStreak(db, gid);
        const recent = db.prepare(
            `SELECT * FROM clan_wars WHERE guild_id = ? ORDER BY played_at DESC, id DESC LIMIT 5`
        ).all(gid);

        return message.reply({
            embeds: [new EmbedBuilder()
                .setColor('#3498db')
                .setTitle(`${EMOJIS.trophy} Clan record`)
                .setDescription(
                    `**${r.win}W – ${r.loss}L${r.draw ? ` – ${r.draw}D` : ''}** · **${r.winRate}%** win rate` +
                    (streak && streak.n > 1 ? `\n${RESULT_ICON[streak.kind]} ${streak.n} ${RESULT_LABEL[streak.kind].toLowerCase()} streak` : '')
                )
                .addFields({ name: '🕐 Recent', value: recent.map(matchLine).join('\n'), inline: false })
                .setFooter({ text: `${r.played} match${r.played === 1 ? '' : 'es'} recorded` })
            ],
        }).catch(() => {});
    },
};

