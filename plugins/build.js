const { EmbedBuilder, SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const W = require('../lib/weapons');
const EMOJIS = require('../config/emojis');

const MAX_PER_USER = 10;

function buildEmbed(build, member, guild) {
    const weapon = W.findWeapon(build.weapon);
    const embed = new EmbedBuilder()
        .setColor(weapon ? W.tierColor(weapon.tier) : '#3498db')
        .setAuthor({
            name: member?.displayName || member?.user?.username || 'Unknown',
            iconURL: member?.displayAvatarURL?.() || undefined,
        })
        .setTitle(`${EMOJIS.gamer} ${build.weapon}`)
        .setFooter({ text: `Build #${build.id} • ${guild?.name || 'ARCHON'}` })
        .setTimestamp(new Date((build.updated_at || build.created_at) * 1000));

    const meta = weapon
        ? `**${weapon.tier} tier** · ${weapon.category || '—'}`
        : '*Not in the current meta list*';
    embed.setDescription(meta + (build.note ? `\n\n${build.note}` : ''));

    if (build.attachments) {
        embed.addFields({
            name: '🛠️ Attachments',
            value: build.attachments.split(',').map(a => `• ${a.trim()}`).join('\n').slice(0, 1024),
            inline: false,
        });
    }

    if (build.image_url && build.image_url.startsWith('http')) {
        embed.setImage(build.image_url);
    }

    return embed;
}

function countBuilds(db, gid, uid) {
    return db.prepare('SELECT COUNT(*) AS n FROM member_builds WHERE guild_id = ? AND user_id = ?')
        .get(gid, uid).n;
}

module.exports = {
    name: 'build',
    aliases: ['builds', 'mybuild', 'classe'],
    description: 'Save and share your own weapon builds with the clan.',
    category: 'GAMING',
    usage: '/build save | /build list | /build show | /build delete',
    cooldown: 3000,

    data: new SlashCommandBuilder().setName('build').setDescription('🔫 Clan weapon builds').
        addSubcommand(s => s.setName('save').setDescription('Save one of your builds').
            addStringOption(o => o.setName('weapon').setDescription('Weapon name').setRequired(true).setAutocomplete(true)).
            addStringOption(o => o.setName('attachments').setDescription('Comma separated, e.g. OWC Laser, No Stock, 40 Round Mag')).
            addAttachmentOption(o => o.setName('screenshot').setDescription('Screenshot of the build')).
            addStringOption(o => o.setName('note').setDescription('Why you run it this way'))).
        addSubcommand(s => s.setName('list').setDescription("Browse the clan's builds").
            addStringOption(o => o.setName('weapon').setDescription('Filter by weapon').setAutocomplete(true))).
        addSubcommand(s => s.setName('show').setDescription("Show a member's builds").
            addUserOption(o => o.setName('member').setDescription('Whose builds to show'))).
        addSubcommand(s => s.setName('delete').setDescription('Delete one of your builds').
            addIntegerOption(o => o.setName('id').setDescription('Build ID').setRequired(true))),

    autocomplete: async (interaction) => {
        const focused = interaction.options.getFocused(true);
        if (focused.name !== 'weapon') return interaction.respond([]).catch(() => {});
        const hits = W.searchWeapons((focused.value || '').toLowerCase(), 25);
        return interaction.respond(
            hits.map(w => ({ name: `${w.name} [${w.tier}]`, value: w.name }))
        ).catch(() => {});
    },

    execute: async (interaction, client) => {
        if (!interaction.guild) {
            return interaction.reply({ content: 'Server only.', flags: MessageFlags.Ephemeral });
        }
        const db = client.db;
        const gid = interaction.guild.id;
        const uid = interaction.user.id;
        const sub = interaction.options.getSubcommand();

        // ---- SAVE ----
        if (sub === 'save') {
            const weaponInput = interaction.options.getString('weapon');
            const known = W.findWeapon(weaponInput);
            const weapon = known ? known.name : weaponInput.trim().slice(0, 60);
            const attachments = interaction.options.getString('attachments')?.slice(0, 500) || null;
            const note = interaction.options.getString('note')?.slice(0, 300) || null;
            const shot = interaction.options.getAttachment('screenshot');

            if (shot && !(shot.contentType || '').startsWith('image/')) {
                return interaction.reply({ content: 'The screenshot has to be an image.', flags: MessageFlags.Ephemeral });
            }

            const existing = db.prepare(
                'SELECT id FROM member_builds WHERE guild_id = ? AND user_id = ? AND LOWER(weapon) = LOWER(?)'
            ).get(gid, uid, weapon);

            if (!existing && countBuilds(db, gid, uid) >= MAX_PER_USER) {
                return interaction.reply({
                    content: `You already have ${MAX_PER_USER} builds saved here. Delete one with \`/build delete\` first.`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            let id;
            if (existing) {
                db.prepare(
                    `UPDATE member_builds SET attachments = ?, image_url = ?, note = ?,
                     updated_at = strftime('%s','now') WHERE id = ?`
                ).run(attachments, shot?.url || null, note, existing.id);
                id = existing.id;
            } else {
                const info = db.prepare(
                    `INSERT INTO member_builds (guild_id, user_id, weapon, attachments, image_url, note)
                     VALUES (?, ?, ?, ?, ?, ?)`
                ).run(gid, uid, weapon, attachments, shot?.url || null, note);
                id = info.lastInsertRowid;
            }

            const build = db.prepare('SELECT * FROM member_builds WHERE id = ?').get(id);
            return interaction.reply({
                content: existing ? 'Build updated.' : 'Build saved.',
                embeds: [buildEmbed(build, interaction.member, interaction.guild)],
            });
        }

        // ---- LIST ----
        if (sub === 'list') {
            const filter = interaction.options.getString('weapon');
            const rows = filter
                ? db.prepare(
                    `SELECT * FROM member_builds WHERE guild_id = ? AND LOWER(weapon) = LOWER(?)
                     ORDER BY updated_at DESC LIMIT 25`).all(gid, filter)
                : db.prepare(
                    `SELECT * FROM member_builds WHERE guild_id = ?
                     ORDER BY updated_at DESC LIMIT 25`).all(gid);

            if (!rows.length) {
                return interaction.reply({
                    content: filter
                        ? `No builds saved for **${filter}** yet.`
                        : 'No builds saved on this server yet. Add one with `/build save`.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const lines = rows.map(b => {
                const w = W.findWeapon(b.weapon);
                const tier = w ? `[${w.tier}] ` : '';
                return `**#${b.id}** ${tier}${b.weapon} — <@${b.user_id}>`;
            });

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#3498db')
                    .setAuthor({ name: `${interaction.guild.name} • Builds`, iconURL: interaction.guild.iconURL() || undefined })
                    .setTitle(`${EMOJIS.gamer} Clan builds${filter ? ` — ${filter}` : ''}`)
                    .setDescription(lines.join('\n'))
                    .setFooter({ text: `${rows.length} build${rows.length === 1 ? '' : 's'} • /build show to open one` })
                ],
            });
        }

        // ---- SHOW ----
        if (sub === 'show') {
            const target = interaction.options.getUser('member') || interaction.user;
            const rows = db.prepare(
                'SELECT * FROM member_builds WHERE guild_id = ? AND user_id = ? ORDER BY updated_at DESC'
            ).all(gid, target.id);

            if (!rows.length) {
                return interaction.reply({
                    content: target.id === uid
                        ? "You haven't saved any builds here yet."
                        : `<@${target.id}> hasn't saved any builds here.`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            const member = await interaction.guild.members.fetch(target.id).catch(() => null);
            const embeds = rows.slice(0, 10).map(b => buildEmbed(b, member, interaction.guild));
            return interaction.reply({ embeds });
        }

        // ---- DELETE ----
        if (sub === 'delete') {
            const id = interaction.options.getInteger('id');
            const build = db.prepare('SELECT * FROM member_builds WHERE id = ? AND guild_id = ?').get(id, gid);

            if (!build) {
                return interaction.reply({ content: `No build #${id} on this server.`, flags: MessageFlags.Ephemeral });
            }

            const isMod = interaction.member.permissions.has(require('discord.js').PermissionFlagsBits.ManageMessages);
            if (build.user_id !== uid && !isMod) {
                return interaction.reply({ content: 'You can only delete your own builds.', flags: MessageFlags.Ephemeral });
            }

            db.prepare('DELETE FROM member_builds WHERE id = ?').run(id);
            return interaction.reply({ content: `Build #${id} (${build.weapon}) deleted.`, flags: MessageFlags.Ephemeral });
        }
    },

    // Prefix: .build  -> your own builds
    //         .build <weapon> -> clan builds for that weapon
    run: async (client, message, args) => {
        if (!message.guild) return message.reply('Server only.').catch(() => {});
        const db = client.db;
        const gid = message.guild.id;
        const arg = args.join(' ').trim();

        if (!arg) {
            const rows = db.prepare(
                'SELECT * FROM member_builds WHERE guild_id = ? AND user_id = ? ORDER BY updated_at DESC'
            ).all(gid, message.author.id);
            if (!rows.length) {
                return message.reply('You have no builds saved here. Use `/build save` to add one.').catch(() => {});
            }
            return message.reply({
                embeds: rows.slice(0, 10).map(b => buildEmbed(b, message.member, message.guild)),
            }).catch(() => {});
        }

        const rows = db.prepare(
            `SELECT * FROM member_builds WHERE guild_id = ? AND LOWER(weapon) LIKE LOWER(?)
             ORDER BY updated_at DESC LIMIT 10`
        ).all(gid, `%${arg}%`);

        if (!rows.length) {
            return message.reply(`No builds saved for **${arg}** on this server.`).catch(() => {});
        }

        const embeds = [];
        for (const b of rows) {
            const m = await message.guild.members.fetch(b.user_id).catch(() => null);
            embeds.push(buildEmbed(b, m, message.guild));
        }
        return message.reply({ embeds }).catch(() => {});
    },
};

