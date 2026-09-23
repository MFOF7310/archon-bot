const { EmbedBuilder, SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const W = require('../lib/weapons');
const EMOJIS = require('../config/emojis');

const fs = require('fs');
const path = require('path');
const { AttachmentBuilder } = require('discord.js');

const MAX_PER_USER = 10;
const BUILD_IMG_DIR = path.join(__dirname, '..', 'assets', 'builds');

// Discord CDN urls expire after ~24h, so the screenshot is copied to disk.
async function downloadToFile(url, dest) {
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ARCHON-Bot/2.0)', 'Accept': 'image/*,*/*' }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) throw new Error('Not an image: ' + ct);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 1000) throw new Error('File too small');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buffer);
    return dest;
}

// Deletes screenshots whose build row is gone (kicked servers, failed saves).
// Runs at most every 6 hours, triggered by /build use.
let lastSweep = 0;
function sweepOrphanImages(db) {
    if (Date.now() - lastSweep < 6 * 3600 * 1000) return;
    lastSweep = Date.now();
    try {
        if (!fs.existsSync(BUILD_IMG_DIR)) return;
        const keep = new Set(db.prepare(
            'SELECT image_path FROM member_builds WHERE image_path IS NOT NULL'
        ).all().map(r => path.resolve(r.image_path)));
        let removed = 0;
        for (const f of fs.readdirSync(BUILD_IMG_DIR)) {
            if (!/^\d+-\d+\.jpg$/.test(f)) continue;
            const fp = path.join(BUILD_IMG_DIR, f);
            if (keep.has(path.resolve(fp))) continue;
            if (Date.now() - fs.statSync(fp).mtimeMs < 10 * 60 * 1000) continue; // may still be downloading
            fs.unlinkSync(fp);
            removed++;
        }
        if (removed) console.log(`[BUILD] sweep removed ${removed} orphaned screenshot(s)`);
    } catch (e) {
        console.error('[BUILD] sweep failed:', e.message);
    }
}

function removeImage(p) {
    try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {}
}

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
        ? [weapon.tier ? `**${weapon.tier} tier**` : null, weapon.category].filter(Boolean).join(' · ')
        : '';
    embed.setDescription([meta, build.note].filter(Boolean).join('\n\n') || null);

    if (build.attachments) {
        embed.addFields({
            name: '🛠️ Attachments',
            value: build.attachments.split(',').map(a => `• ${a.trim()}`).join('\n').slice(0, 1024),
            inline: false,
        });
    }

    if (build.image_path && fs.existsSync(build.image_path)) {
        embed.setImage(`attachment://build-${build.id}.jpg`);
    } else if (build.image_url && build.image_url.startsWith('http')) {
        embed.setImage(build.image_url);
    }

    return embed;
}

// Local screenshots must be sent as attachments alongside the embed.
function buildFiles(builds) {
    const list = Array.isArray(builds) ? builds : [builds];
    const files = [];
    for (const b of list) {
        if (b.image_path && fs.existsSync(b.image_path)) {
            files.push(new AttachmentBuilder(b.image_path, { name: `build-${b.id}.jpg` }));
        }
    }
    return files;
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
            addUserOption(o => o.setName('member').setDescription('Whose builds to show')).
            addStringOption(o => o.setName('weapon').setDescription('Show only this weapon').setAutocomplete(true))).
        addSubcommand(s => s.setName('delete').setDescription('Delete one of your builds').
            addIntegerOption(o => o.setName('id').setDescription('Build ID').setRequired(true))),

    autocomplete: async (interaction) => {
        const focused = interaction.options.getFocused(true);
        if (focused.name !== 'weapon') return interaction.respond([]).catch(() => {});
        const q = (focused.value || '').trim();
        const out = [];
        const seen = new Set();
        const add = (name, value) => {
            if (!value || out.length >= 25 || seen.has(value.toLowerCase())) return;
            seen.add(value.toLowerCase());
            out.push({ name: name.slice(0, 100), value: value.slice(0, 100) });
        };
        const onShow = interaction.options.getSubcommand(false) === 'show';
        const forUser = onShow
            ? (interaction.options.get('member')?.value || interaction.user.id)
            : null;
        // on /build show only real saved builds are offerable — no meta, no roster
        if (!onShow) {
            for (const w of W.searchWeapons(q.toLowerCase(), 20)) add(w.tier ? `${w.name} [${w.tier}]` : `${w.name} · ${w.category || '—'}`, w.name);
        }
        try {
            if (forUser) {
                const mine = interaction.client.db.prepare(
                    `SELECT weapon, COUNT(*) AS n FROM member_builds
                     WHERE guild_id = ? AND user_id = ? AND LOWER(weapon) LIKE ?
                     GROUP BY LOWER(weapon) ORDER BY n DESC LIMIT 25`
                ).all(interaction.guildId, forUser, `%${q.toLowerCase()}%`);
                for (const r of mine) add(`${r.weapon} (${r.n})`, r.weapon);
                return interaction.respond(out).catch(() => {});
            }
            const rows = interaction.client.db.prepare(
                `SELECT weapon, COUNT(*) AS n FROM member_builds
                 WHERE guild_id = ? AND LOWER(weapon) LIKE ?
                 GROUP BY LOWER(weapon) ORDER BY n DESC LIMIT 25`
            ).all(interaction.guildId, `%${q.toLowerCase()}%`);
            for (const r of rows) add(`${r.weapon} (${r.n} saved)`, r.weapon);
        } catch (_) {}
        // nothing known matches on save: offer exactly what is typed
        if (!out.length && q && interaction.options.getSubcommand(false) === 'save') {
            add(`${q} (new)`, q.slice(0, 60));
        }
        return interaction.respond(out).catch(() => {});
    },

    execute: async (interaction, client) => {
        if (!interaction.guild) {
            return interaction.reply({ content: 'Server only.', flags: MessageFlags.Ephemeral });
        }
        const db = client.db;
        sweepOrphanImages(db);
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
                    `UPDATE member_builds SET attachments = COALESCE(?, attachments), image_url = COALESCE(?, image_url), note = COALESCE(?, note),
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

            let warn = '';
            if (shot) {
                const dest = require('path').join(BUILD_IMG_DIR, `${gid}-${id}.jpg`);
                const prev = db.prepare('SELECT image_path FROM member_builds WHERE id = ?').get(id);
                try {
                    await downloadToFile(shot.url, dest);
                    if (prev?.image_path && prev.image_path !== dest) removeImage(prev.image_path);
                    db.prepare('UPDATE member_builds SET image_path = ? WHERE id = ?').run(dest, id);
                } catch (e) {
                    console.error('[BUILD] image download failed:', e.message);
                    warn = '\n*The screenshot could not be stored, so it will stop showing in about a day.*';
                }
            }

            const build = db.prepare('SELECT * FROM member_builds WHERE id = ?').get(id);
            return interaction.reply({
                content: (existing ? 'Build updated.' : 'Build saved.') + warn,
                embeds: [buildEmbed(build, interaction.member, interaction.guild)],
                files: buildFiles(build),
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
            const only = interaction.options.getString('weapon');
            const rows = only
                ? db.prepare(
                    `SELECT * FROM member_builds WHERE guild_id = ? AND user_id = ?
                     AND LOWER(weapon) = LOWER(?) ORDER BY updated_at DESC`).all(gid, target.id, only)
                : db.prepare(
                    'SELECT * FROM member_builds WHERE guild_id = ? AND user_id = ? ORDER BY updated_at DESC'
                ).all(gid, target.id);

            if (only && !rows.length) {
                return interaction.reply({
                    content: target.id === uid
                        ? `You haven't saved a **${only}** build here.`
                        : `<@${target.id}> hasn't saved a **${only}** build here.`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (!rows.length) {
                return interaction.reply({
                    content: target.id === uid
                        ? "You haven't saved any builds here yet."
                        : `<@${target.id}> hasn't saved any builds here.`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            const member = await interaction.guild.members.fetch(target.id).catch(() => null);
            const shown = rows.slice(0, 10);
            const embeds = shown.map(b => buildEmbed(b, member, interaction.guild));
            return interaction.reply({ embeds, files: buildFiles(shown) });
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

            removeImage(build.image_path);
            db.prepare('DELETE FROM member_builds WHERE id = ?').run(id);
            return interaction.reply({ content: `Build #${id} (${build.weapon}) deleted.`, flags: MessageFlags.Ephemeral });
        }
    },

    // Prefix: .build  -> your own builds
    //         .build <weapon> -> clan builds for that weapon
    run: async (client, message, args) => {
        if (!message.guild) return message.reply('Server only.').catch(() => {});
        const db = client.db;
        sweepOrphanImages(db);
        const gid = message.guild.id;
        const arg = args.join(' ').trim();

        if (!arg) {
            const rows = db.prepare(
                'SELECT * FROM member_builds WHERE guild_id = ? AND user_id = ? ORDER BY updated_at DESC'
            ).all(gid, message.author.id);
            if (!rows.length) {
                return message.reply('You have no builds saved here. Use `/build save` to add one.').catch(() => {});
            }
            const shown = rows.slice(0, 10);
            return message.reply({
                embeds: shown.map(b => buildEmbed(b, message.member, message.guild)),
                files: buildFiles(shown),
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
        return message.reply({ embeds, files: buildFiles(rows) }).catch(() => {});
    },
};

