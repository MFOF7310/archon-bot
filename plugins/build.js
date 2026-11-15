'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// /build — members save their weapon builds and the clan browses them.
//   One card per build (Components V2): ◀ ▶ through that member's builds, Edit (a form) and Delete (confirmed).
//   /build list: one card of 10 builds a page, with a menu that opens a build just for whoever picks it.
//   The screenshot is copied to disk (Discord's links expire after about a day) and sent with the card,
//   so a card carries one image at most and never hits Discord's size limits.
// Buttons: bld:go:<viewer>:<id> · bld:edit:<id>:<viewer> · bld:del:<id> · bld:delok:<id> · bld:delno
//          bld:lp:<viewer>:<page>:<filter> · bld:open (menu) · modal bld:save:<id>:<viewer>
// Someone other than the viewer who clicks ◀ ▶ gets their own private copy instead of moving the shared card.
// ═══════════════════════════════════════════════════════════════════════════
const {
    SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
    ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder, EmbedBuilder,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const W = require('../lib/weapons');
const i18n = require('../lib/i18n');
const { card } = require('../lib/games/v2');
const { icon } = require('../lib/ui/icons');
const access = require('../lib/access');

const MAX_PER_USER = 10;
const PER_PAGE = 10;
const MAX_IMAGE = 8 * 1024 * 1024;
const BUILD_IMG_DIR = path.join(__dirname, '..', 'assets', 'builds');
const V2 = MessageFlags.IsComponentsV2;
const EPH = MessageFlags.Ephemeral;
const LIST_COLOR = 0x378ADD;
const PLAIN_COLOR = 0x5865F2;

const T = (k, lang, v) => i18n.t(`build.${k}`, lang, v || {});
const langOf = (client, ix) => require('../lib/pick-lang').pickLang(client, ix.guildId || ix.guild?.id, ix, ix.user?.id || ix.author?.id);

// ─── weapons ─────────────────────────────────────────────────────────────
// Only an exact name (or alias) counts: a weapon typed by hand keeps its name instead of becoming another
// weapon that happens to contain the same letters.
const norm = (s) => String(s || '').toLowerCase().replace(/[\s\-_.]/g, '');
function exactWeapon(name) {
    const n = norm(name);
    if (!n) return null;
    const same = (w) => w && (norm(w.name) === n || (w.aliases || []).some((a) => norm(a) === n));
    const found = W.findWeapon(name);
    if (same(found)) return found;
    return W.searchWeapons(String(name).toLowerCase(), 25).find(same) || null;
}
// A menu option takes an emoji object, not the <:name:id> text.
function emojiOf(kind, where) {
    const s = icon(kind, where);
    const m = /^<(a?):(\w+):(\d+)>$/.exec(s);
    return m ? { id: m[3], name: m[2], animated: m[1] === 'a' } : { name: s };
}
const hex = (s) => parseInt(String(s || '').replace('#', ''), 16) || PLAIN_COLOR;

// ─── screenshots ─────────────────────────────────────────────────────────
async function downloadToFile(url, dest) {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ARCHON-Bot/2.0)', Accept: 'image/*,*/*' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) throw new Error('Not an image: ' + ct);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 1000) throw new Error('File too small');
    if (buffer.length > MAX_IMAGE) throw new Error('File too big');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buffer);
    return dest;
}

// Deletes screenshots whose build row is gone (kicked servers, failed saves). At most every 6 hours.
let lastSweep = 0;
function sweepOrphanImages(db) {
    if (Date.now() - lastSweep < 6 * 3600 * 1000) return;
    lastSweep = Date.now();
    try {
        if (!fs.existsSync(BUILD_IMG_DIR)) return;
        const keep = new Set(db.prepare('SELECT image_path FROM member_builds WHERE image_path IS NOT NULL').all()
            .map((r) => path.resolve(r.image_path)));
        let removed = 0;
        for (const f of fs.readdirSync(BUILD_IMG_DIR)) {
            if (!/^\d+-\d+\.jpg$/.test(f)) continue;
            const fp = path.join(BUILD_IMG_DIR, f);
            if (keep.has(path.resolve(fp))) continue;
            if (Date.now() - fs.statSync(fp).mtimeMs < 10 * 60 * 1000) continue;   // may still be downloading
            fs.unlinkSync(fp);
            removed++;
        }
        if (removed) console.log(`[BUILD] sweep removed ${removed} orphaned screenshot(s)`);
    } catch (e) {
        console.error('[BUILD] sweep failed:', e.message);
    }
}

function removeImage(p) {
    try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch { /* already gone */ }
}

// The copy on disk, or Discord's own link while it still works (builds saved before the copy existed).
function imageOf(b) {
    if (b.image_path && fs.existsSync(b.image_path)) return { file: b.image_path };
    const fresh = Date.now() / 1000 - (b.updated_at || b.created_at || 0) < 20 * 3600;
    if (fresh && typeof b.image_url === 'string' && b.image_url.startsWith('http')) return { url: b.image_url };
    return {};
}

// ─── data ────────────────────────────────────────────────────────────────
const getBuild = (db, gid, id) => db.prepare('SELECT * FROM member_builds WHERE id = ? AND guild_id = ?').get(id, gid);
const idsOf = (db, gid, uid) => db.prepare(
    'SELECT id FROM member_builds WHERE guild_id = ? AND user_id = ? ORDER BY updated_at DESC, id DESC'
).all(gid, uid).map((r) => r.id);
const countBuilds = (db, gid, uid) => db.prepare('SELECT COUNT(*) AS n FROM member_builds WHERE guild_id = ? AND user_id = ?').get(gid, uid).n;

// The author, or anyone allowed to manage messages, may edit or delete a build.
const mayChange = (member, userId, build) => build.user_id === userId || access.can(member, 'messages').ok;

// ─── the build card ──────────────────────────────────────────────────────
async function buildView(client, guild, build, viewerId, lang, where, notice) {
    const ids = idsOf(client.db, guild.id, build.user_id);
    const i = Math.max(0, ids.indexOf(build.id));
    const w = exactWeapon(build.weapon);
    const tag = [w?.tier ? T('tier', lang, { tier: w.tier }) : null, w?.category].filter(Boolean).join(' · ');

    const head = [
        notice ? `-# ${notice}` : null,
        `-# ${T('by', lang, { user: `<@${build.user_id}>` })}`,
        `## ${icon('target', where)} ${build.weapon}`,
        tag || null,
    ].filter(Boolean).join('\n');

    const user = await client.users.fetch(build.user_id).catch(() => null);
    const items = [user ? { thumbnail: [head, user.displayAvatarURL({ size: 128 })] } : { text: head }, { rule: true }];

    const parts = (build.attachments || '').split(',').map((a) => a.trim()).filter(Boolean);
    if (parts.length) items.push({ text: `**${icon('tool', where)} ${T('attachments', lang)}**\n${parts.join(' · ')}` });
    if (build.note) items.push({ text: `> ${build.note.replace(/\n/g, '\n> ')}` });
    if (!parts.length && !build.note) items.push({ text: T('empty', lang) });

    const files = [];
    const img = imageOf(build);
    if (img.file) {
        files.push(new AttachmentBuilder(img.file, { name: `build-${build.id}.jpg` }));
        items.push({ media: [`attachment://build-${build.id}.jpg`, build.weapon] });
    } else if (img.url) {
        items.push({ media: [img.url, build.weapon] });
    }

    const when = build.updated_at || build.created_at;
    items.push({ text: `-# #${build.id}${when ? ` · ${T('updatedAgo', lang, { when: `<t:${when}:R>` })}` : ''}` });

    const row = new ActionRowBuilder();
    if (ids.length > 1) {
        const prev = ids[i - 1];
        const next = ids[i + 1];
        row.addComponents(
            new ButtonBuilder().setCustomId(`bld:go:${viewerId}:${prev || 'x'}`).setStyle(ButtonStyle.Secondary)
                .setEmoji(icon('page_prev', where)).setDisabled(!prev),
            new ButtonBuilder().setCustomId('bld:pg').setStyle(ButtonStyle.Secondary).setLabel(`${i + 1} / ${ids.length}`).setDisabled(true),
            new ButtonBuilder().setCustomId(`bld:go:${viewerId}:${next || 'y'}`).setStyle(ButtonStyle.Secondary)
                .setEmoji(icon('page_next', where)).setDisabled(!next),
        );
    }
    row.addComponents(
        new ButtonBuilder().setCustomId(`bld:edit:${build.id}:${viewerId}`).setStyle(ButtonStyle.Secondary)
            .setLabel(T('btnEdit', lang)).setEmoji(icon('edit', where)),
        new ButtonBuilder().setCustomId(`bld:del:${build.id}`).setStyle(ButtonStyle.Danger).setEmoji(icon('trash', where)),
    );
    items.push({ row });

    return { ...card(w?.tier ? hex(W.tierColor(w.tier)) : PLAIN_COLOR, items), files };
}

// ─── the list card ───────────────────────────────────────────────────────
function plural(lang, key, n) {
    return T(n === 1 ? `${key}One` : `${key}Many`, lang, { n });
}

async function listView(client, guild, viewerId, page, filter, lang, where) {
    const db = client.db;
    const f = (filter || '').slice(0, 60);
    const like = `%${f.toLowerCase().replace(/[\\%_]/g, (m) => '\\' + m)}%`;
    const cond = f ? "guild_id = ? AND LOWER(weapon) LIKE ? ESCAPE '\\'" : 'guild_id = ?';
    const args = f ? [guild.id, like] : [guild.id];

    const { total, people } = db.prepare(`SELECT COUNT(*) AS total, COUNT(DISTINCT user_id) AS people FROM member_builds WHERE ${cond}`).get(...args);
    if (!total) return null;
    const pages = Math.ceil(total / PER_PAGE);
    const p = Math.min(Math.max(0, page | 0), pages - 1);
    const rows = db.prepare(`SELECT * FROM member_builds WHERE ${cond} ORDER BY updated_at DESC, id DESC LIMIT ? OFFSET ?`)
        .all(...args, PER_PAGE, p * PER_PAGE);

    const uids = [...new Set(rows.map((r) => r.user_id))];
    await guild.members.fetch({ user: uids }).catch(() => null);
    const nameOf = (uid) => guild.members.cache.get(uid)?.displayName || client.users.cache.get(uid)?.username || T('someone', lang);

    const lines = rows.map((b) => {
        const t = exactWeapon(b.weapon)?.tier;
        return `\`#${b.id}\` **${b.weapon}**${t ? ` · ${t}` : ''} — <@${b.user_id}>`;
    });

    const items = [
        { text: `## ${icon('ch_log', where)} ${T('listTitle', lang)}${f ? ` — ${f}` : ''}\n${plural(lang, 'builds', total)} · ${plural(lang, 'members', people)}` },
        { rule: true },
        { text: lines.join('\n') },
        {
            row: new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('bld:open')
                .setPlaceholder(T('pick', lang))
                .addOptions(rows.map((b) => ({
                    label: `${b.weapon} — ${nameOf(b.user_id)}`.slice(0, 100),
                    description: `#${b.id}${exactWeapon(b.weapon)?.tier ? ` · ${T('tier', lang, { tier: exactWeapon(b.weapon).tier })}` : ''}`.slice(0, 100),
                    value: String(b.id),
                    emoji: emojiOf('target', where),
                })))),
        },
    ];
    if (pages > 1) {
        const id = (n) => `bld:lp:${viewerId}:${n}:${f}`.slice(0, 100);
        items.push({
            row: new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(p > 0 ? id(p - 1) : 'bld:lp:x').setStyle(ButtonStyle.Secondary).setEmoji(icon('page_prev', where)).setDisabled(p === 0),
                new ButtonBuilder().setCustomId('bld:lpg').setStyle(ButtonStyle.Secondary).setLabel(`${p + 1} / ${pages}`).setDisabled(true),
                new ButtonBuilder().setCustomId(p < pages - 1 ? id(p + 1) : 'bld:lp:y').setStyle(ButtonStyle.Secondary).setEmoji(icon('page_next', where)).setDisabled(p >= pages - 1),
            ),
        });
    }
    items.push({ text: `-# ${T('listHint', lang)}` });
    return { ...card(LIST_COLOR, items), files: [] };
}

// ─── deleting ────────────────────────────────────────────────────────────
async function logModDelete(client, guild, build, modId) {
    const ch = require('../lib/modlog').resolveModLog(guild, client.db);
    if (!ch) return;
    let lang = 'en';
    try { lang = require('../lib/pick-lang').pickLang(client, guild.id, null); } catch { /* English */ }
    if (!['en', 'fr', 'zh', 'ar'].includes(lang)) lang = 'en';
    await ch.send({
        embeds: [new EmbedBuilder().setColor(0x5b6b7c).setTitle(T('logTitle', lang))
            .setDescription(T('logText', lang, { mod: `<@${modId}>`, user: `<@${build.user_id}>`, weapon: build.weapon, id: build.id }))
            .setTimestamp()],
        allowedMentions: { parse: [] },
    }).catch((e) => console.error(`[BUILD] mod-log guild=${guild.id}:`, e.message));
}

function deleteBuild(client, guild, build, byId) {
    removeImage(build.image_path);
    client.db.prepare('DELETE FROM member_builds WHERE id = ?').run(build.id);
    if (build.user_id !== byId) logModDelete(client, guild, build, byId).catch(() => {});
}

// ─── buttons, menu and form ──────────────────────────────────────────────
async function handleComponent(ix, client) {
    if (!ix.guild) return;
    const lang = langOf(client, ix);
    const db = client.db;
    const [, act, a, b] = ix.customId.split(':');
    const say = (key, vars, ic) => ix.reply({ content: `${ic ? icon(ic, ix) + ' ' : ''}${T(key, lang, vars)}`, flags: EPH, allowedMentions: { parse: [] } }).catch(() => {});
    const gone = () => say('gone', null, 'no');
    const tell = (ic, key, vars) => ix.update({ content: `${icon(ic, ix)} ${T(key, lang, vars)}`, components: [] });

    // ◀ ▶ on a build card
    if (act === 'go') {
        const build = getBuild(db, ix.guildId, Number(b));
        if (!build) return gone();
        if (ix.user.id !== a) {
            const view = await buildView(client, ix.guild, build, ix.user.id, lang, ix);
            return ix.reply({ ...view, flags: V2 | EPH });
        }
        const view = await buildView(client, ix.guild, build, a, lang, ix);
        return ix.update({ ...view, attachments: [] });
    }

    // ◀ ▶ on the list
    if (act === 'lp') {
        const filter = ix.customId.split(':').slice(4).join(':');
        const mine = ix.user.id === a;
        const view = await listView(client, ix.guild, ix.user.id, Number(b), filter, lang, ix);
        if (!view) return say('listEmpty');
        return mine ? ix.update(view) : ix.reply({ ...view, flags: V2 | EPH });
    }

    // menu on the list: opens the build just for whoever picked it
    if (act === 'open' && ix.isStringSelectMenu()) {
        const build = getBuild(db, ix.guildId, Number(ix.values[0]));
        if (!build) return gone();
        const view = await buildView(client, ix.guild, build, ix.user.id, lang, ix);
        return ix.reply({ ...view, flags: V2 | EPH });
    }

    if (act === 'edit') {
        const build = getBuild(db, ix.guildId, Number(a));
        if (!build) return gone();
        if (!mayChange(ix.member, ix.user.id, build)) return say('notYours', null, 'lock');
        const field = (id, label, max, value) => new ActionRowBuilder().addComponents(new TextInputBuilder()
            .setCustomId(id).setLabel(label.slice(0, 45)).setStyle(TextInputStyle.Paragraph).setMaxLength(max).setRequired(false)
            .setValue((value || '').slice(0, max)));
        return ix.showModal(new ModalBuilder().setCustomId(`bld:save:${build.id}:${b || ix.user.id}`)
            .setTitle(T('modalTitle', lang, { weapon: build.weapon }).slice(0, 45))
            .addComponents(
                field('attachments', T('fieldAttachments', lang), 500, build.attachments),
                field('note', T('fieldNote', lang), 300, build.note),
            ));
    }

    if (act === 'save' && ix.isModalSubmit()) {
        const build = getBuild(db, ix.guildId, Number(a));
        if (!build) return gone();
        if (!mayChange(ix.member, ix.user.id, build)) return say('notYours', null, 'lock');
        const value = (id) => ix.fields.getTextInputValue(id).trim() || null;
        db.prepare("UPDATE member_builds SET attachments = ?, note = ?, updated_at = strftime('%s','now') WHERE id = ?")
            .run(value('attachments'), value('note'), build.id);
        const fresh = getBuild(db, ix.guildId, build.id);
        if (!ix.isFromMessage()) return say('updated', null, 'ok');
        const view = await buildView(client, ix.guild, fresh, b || ix.user.id, lang, ix, `${icon('ok', ix)} ${T('updated', lang)}`);
        return ix.update({ ...view, attachments: [] });
    }

    if (act === 'del') {
        const build = getBuild(db, ix.guildId, Number(a));
        if (!build) return gone();
        if (!mayChange(ix.member, ix.user.id, build)) return say('notYours', null, 'lock');
        const theirs = build.user_id !== ix.user.id;
        return ix.reply({
            content: `${icon('warn', ix)} ` + T(theirs ? 'confirmOther' : 'confirmMine', lang, { weapon: build.weapon, id: build.id, user: `<@${build.user_id}>` }),
            components: [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`bld:delok:${build.id}`).setStyle(ButtonStyle.Danger).setLabel(T('btnDelete', lang)).setEmoji(icon('trash', ix)),
                new ButtonBuilder().setCustomId('bld:delno').setStyle(ButtonStyle.Secondary).setLabel(T('btnKeep', lang)).setEmoji(icon('back', ix)),
            )],
            flags: EPH,
            allowedMentions: { parse: [] },
        });
    }

    if (act === 'delok') {
        const build = getBuild(db, ix.guildId, Number(a));
        if (!build) return tell('no', 'gone');
        if (!mayChange(ix.member, ix.user.id, build)) return tell('lock', 'notYours');
        deleteBuild(client, ix.guild, build, ix.user.id);
        return tell('trash', 'deleted', { id: build.id, weapon: build.weapon });
    }

    if (act === 'delno') return tell('ok', 'kept');
}

// ─── command ─────────────────────────────────────────────────────────────
module.exports = {
    name: 'build',
    aliases: ['builds', 'mybuild', 'classe'],
    description: 'Save and share your own weapon builds with the clan.',
    category: 'GAMING',
    usage: '/build save | /build list | /build show | /build delete',
    cooldown: 3000,
    handleComponent,
    _exactWeapon: exactWeapon,   // for the tests

    data: new SlashCommandBuilder().setName('build').setDescription('🔫 Clan weapon builds')
        .addSubcommand((s) => s.setName('save').setDescription('Save one of your builds')
            .addStringOption((o) => o.setName('weapon').setDescription('Weapon name').setRequired(true).setAutocomplete(true))
            .addStringOption((o) => o.setName('attachments').setDescription('Comma separated, e.g. OWC Laser, No Stock, 40 Round Mag'))
            .addAttachmentOption((o) => o.setName('screenshot').setDescription('Screenshot of the build'))
            .addStringOption((o) => o.setName('note').setDescription('Why you run it this way')))
        .addSubcommand((s) => s.setName('list').setDescription("Browse the clan's builds")
            .addStringOption((o) => o.setName('weapon').setDescription('Filter by weapon').setAutocomplete(true)))
        .addSubcommand((s) => s.setName('show').setDescription("Show a member's builds")
            .addUserOption((o) => o.setName('member').setDescription('Whose builds to show'))
            .addStringOption((o) => o.setName('weapon').setDescription('Show only this weapon').setAutocomplete(true)))
        .addSubcommand((s) => s.setName('delete').setDescription('Delete one of your builds')
            .addIntegerOption((o) => o.setName('id').setDescription('Build ID').setRequired(true))),

    autocomplete: async (interaction) => {
        const focused = interaction.options.getFocused(true);
        if (focused.name !== 'weapon') return interaction.respond([]).catch(() => {});
        const q = (focused.value || '').trim();
        const like = `%${q.toLowerCase().replace(/[\\%_]/g, (m) => '\\' + m)}%`;
        const out = [];
        const seen = new Set();
        const add = (name, value) => {
            if (!value || out.length >= 25 || seen.has(value.toLowerCase())) return;
            seen.add(value.toLowerCase());
            out.push({ name: name.slice(0, 100), value: value.slice(0, 100) });
        };
        const sub = interaction.options.getSubcommand(false);
        // on /build show only the member's real builds are offered
        if (sub === 'show') {
            const forUser = interaction.options.get('member')?.value || interaction.user.id;
            try {
                const mine = interaction.client.db.prepare(
                    `SELECT weapon, COUNT(*) AS n FROM member_builds WHERE guild_id = ? AND user_id = ? AND LOWER(weapon) LIKE ? ESCAPE '\\'
                     GROUP BY LOWER(weapon) ORDER BY n DESC LIMIT 25`
                ).all(interaction.guildId, forUser, like);
                for (const r of mine) add(r.weapon, r.weapon);
            } catch { /* nothing to offer */ }
            return interaction.respond(out).catch(() => {});
        }
        for (const w of W.searchWeapons(q.toLowerCase(), 20)) add(w.tier ? `${w.name} [${w.tier}]` : `${w.name} · ${w.category || '—'}`, w.name);
        try {
            const rows = interaction.client.db.prepare(
                `SELECT weapon, COUNT(*) AS n FROM member_builds WHERE guild_id = ? AND LOWER(weapon) LIKE ? ESCAPE '\\'
                 GROUP BY LOWER(weapon) ORDER BY n DESC LIMIT 25`
            ).all(interaction.guildId, like);
            for (const r of rows) add(`${r.weapon} (${r.n})`, r.weapon);
        } catch { /* nothing to offer */ }
        // nothing known matches on save: offer exactly what is typed
        if (!out.length && q && sub === 'save') add(`${q} (new)`, q.slice(0, 60));
        return interaction.respond(out).catch(() => {});
    },

    execute: async (interaction, client) => {
        const lang = langOf(client, interaction);
        if (!interaction.guild) return interaction.reply({ content: T('guildOnly', lang), flags: EPH });
        const db = client.db;
        sweepOrphanImages(db);
        const gid = interaction.guild.id;
        const uid = interaction.user.id;
        const sub = interaction.options.getSubcommand();
        const eph = (key, vars, ic) => interaction.reply({ content: `${ic ? icon(ic, interaction) + ' ' : ''}${T(key, lang, vars)}`, flags: EPH, allowedMentions: { parse: [] } });
        const send = (view) => interaction.reply({ ...view, flags: V2 }).catch((e) => console.error(`[BUILD] ${sub} guild=${gid}:`, e.message));

        if (sub === 'save') {
            const typed = interaction.options.getString('weapon').trim();
            const known = exactWeapon(typed);
            const weapon = (known ? known.name : typed).slice(0, 60);
            const attachments = interaction.options.getString('attachments')?.trim().slice(0, 500) || null;
            const note = interaction.options.getString('note')?.trim().slice(0, 300) || null;
            const shot = interaction.options.getAttachment('screenshot');

            if (!weapon) return eph('noWeapon', null, 'warn');
            if (shot && !(shot.contentType || '').startsWith('image/')) return eph('notAnImage', null, 'no');
            if (shot && shot.size > MAX_IMAGE) return eph('tooBig', { mb: MAX_IMAGE / 1024 / 1024 }, 'no');

            const existing = db.prepare('SELECT * FROM member_builds WHERE guild_id = ? AND user_id = ? AND LOWER(weapon) = LOWER(?)').get(gid, uid, weapon);
            if (!existing && countBuilds(db, gid, uid) >= MAX_PER_USER) return eph('limitReached', { max: MAX_PER_USER }, 'warn');

            // the screenshot download can take longer than the 3 seconds Discord waits for an answer
            await interaction.deferReply();

            let id;
            if (existing) {
                db.prepare(`UPDATE member_builds SET weapon = ?, attachments = COALESCE(?, attachments), note = COALESCE(?, note),
                    updated_at = strftime('%s','now') WHERE id = ?`).run(weapon, attachments, note, existing.id);
                id = existing.id;
            } else {
                id = db.prepare('INSERT INTO member_builds (guild_id, user_id, weapon, attachments, note) VALUES (?, ?, ?, ?, ?)')
                    .run(gid, uid, weapon, attachments, note).lastInsertRowid;
            }

            let warn = '';
            if (shot) {
                const dest = path.join(BUILD_IMG_DIR, `${gid}-${id}.jpg`);
                try {
                    await downloadToFile(shot.url, dest);
                    db.prepare('UPDATE member_builds SET image_path = ?, image_url = NULL WHERE id = ?').run(dest, id);
                } catch (e) {
                    console.error('[BUILD] image download failed:', e.message);
                    db.prepare('UPDATE member_builds SET image_url = ? WHERE id = ?').run(shot.url, id);
                    warn = `\n-# ${icon('warn', interaction)} ${T('imageWarning', lang)}`;
                }
            }

            const build = getBuild(db, gid, id);
            const notice = `${icon('ok', interaction)} ${T(existing ? 'updated' : 'saved', lang)}${warn}`;
            const view = await buildView(client, interaction.guild, build, uid, lang, interaction, notice);
            return interaction.editReply(view).catch((e) => console.error(`[BUILD] save guild=${gid}:`, e.message));
        }

        if (sub === 'list') {
            const filter = interaction.options.getString('weapon');
            const view = await listView(client, interaction.guild, uid, 0, filter, lang, interaction);
            if (!view) return filter ? eph('listEmptyWeapon', { weapon: filter }) : eph('listEmpty');
            return send(view);
        }

        if (sub === 'show') {
            const target = interaction.options.getUser('member') || interaction.user;
            const only = interaction.options.getString('weapon');
            const build = only
                ? db.prepare('SELECT * FROM member_builds WHERE guild_id = ? AND user_id = ? AND LOWER(weapon) = LOWER(?)').get(gid, target.id, only)
                : db.prepare('SELECT * FROM member_builds WHERE guild_id = ? AND user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1').get(gid, target.id);
            if (!build) {
                const self = target.id === uid;
                if (only) return eph(self ? 'showNoneSelfWeapon' : 'showNoneOtherWeapon', { user: `<@${target.id}>`, weapon: only });
                return eph(self ? 'showNoneSelf' : 'showNoneOther', { user: `<@${target.id}>` });
            }
            return send(await buildView(client, interaction.guild, build, uid, lang, interaction));
        }

        if (sub === 'delete') {
            const id = interaction.options.getInteger('id');
            const build = getBuild(db, gid, id);
            if (!build) return eph('deleteNotFound', { id }, 'no');
            if (!mayChange(interaction.member, uid, build)) return eph('notYours', null, 'lock');
            deleteBuild(client, interaction.guild, build, uid);
            return eph('deleted', { id, weapon: build.weapon }, 'trash');
        }
    },

    // Prefix: .build → your own builds · .build <weapon> → the clan's builds for that weapon
    run: async (client, message, args, _db, _ss, _used, lang) => {
        if (!lang) lang = langOf(client, message);
        if (!message.guild) return message.reply(T('guildOnly', lang)).catch(() => {});
        const db = client.db;
        sweepOrphanImages(db);
        const gid = message.guild.id;
        const uid = message.author.id;
        const arg = args.join(' ').trim();
        const send = (view) => message.reply({ ...view, flags: V2 }).catch((e) => console.error(`[BUILD] prefix guild=${gid}:`, e.message));

        if (!arg) {
            const build = db.prepare('SELECT * FROM member_builds WHERE guild_id = ? AND user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1').get(gid, uid);
            if (!build) return message.reply(T('showNoneSelf', lang)).catch(() => {});
            return send(await buildView(client, message.guild, build, uid, lang, message));
        }
        const view = await listView(client, message.guild, uid, 0, arg, lang, message);
        if (!view) return message.reply({ content: T('listEmptyWeapon', lang, { weapon: arg.slice(0, 60) }), allowedMentions: { parse: [] } }).catch(() => {});
        return send(view);
    },
};
