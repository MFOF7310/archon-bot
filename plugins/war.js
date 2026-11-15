'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// /war — the clan's match results against other clans.
//   Stats: one card (Components V2) with the tally, a win-rate bar, the streak, the last 5 matches and the rivals,
//   plus a History button. History: 10 matches a page, chevrons, and a menu that opens one match
//   (just for whoever picks it); from there someone who can manage the server deletes it (confirmed, mod log).
// Buttons: war:stats:<viewer> · war:hist:<viewer>:<page>:<filter> · war:open (menu) · war:del:<id> · war:delok:<id> · war:delno
// Someone other than the viewer who turns a page gets a private copy instead of moving the shared card.
// ═══════════════════════════════════════════════════════════════════════════
const {
    SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, EmbedBuilder,
} = require('discord.js');
const i18n = require('../lib/i18n');
const { card } = require('../lib/games/v2');
const { icon } = require('../lib/ui/icons');
const access = require('../lib/access');

const PER_PAGE = 10;
const V2 = MessageFlags.IsComponentsV2;
const EPH = MessageFlags.Ephemeral;
const COLOR = { win: 0x23A55A, loss: 0xE74C3C, draw: 0xF0B232, none: 0x378ADD };
const RESULTS = ['win', 'loss', 'draw'];

const T = (k, lang, v) => i18n.t(`war.${k}`, lang, v || {});
const langOf = (client, ix) => require('../lib/pick-lang').pickLang(client, ix.guildId || ix.guild?.id, ix, ix.user?.id || ix.author?.id);
const escLike = (s) => `%${String(s || '').toLowerCase().replace(/[\\%_]/g, (m) => '\\' + m)}%`;
const norm = (s) => String(s || '').toLowerCase().replace(/[\s\-_.]/g, '');
const resIcon = (r, where) => icon(RESULTS.includes(r) ? r : 'draw', where);

// A menu option takes an emoji object, not the <:name:id> text.
function emojiOf(kind, where) {
    const s = icon(kind, where);
    const m = /^<(a?):(\w+):(\d+)>$/.exec(s);
    return m ? { id: m[3], name: m[2], animated: m[1] === 'a' } : { name: s };
}

// ─── data ────────────────────────────────────────────────────────────────
function tallyOf(db, gid, filter) {
    const cond = filter ? "guild_id = ? AND LOWER(opponent) LIKE ? ESCAPE '\\'" : 'guild_id = ?';
    const args = filter ? [gid, escLike(filter)] : [gid];
    const r = { win: 0, loss: 0, draw: 0 };
    for (const row of db.prepare(`SELECT result, COUNT(*) AS n FROM clan_wars WHERE ${cond} GROUP BY result`).all(...args)) {
        if (row.result in r) r[row.result] = row.n;
    }
    const played = r.win + r.loss + r.draw;
    const decisive = r.win + r.loss;
    return { ...r, played, rate: decisive ? Math.round((r.win / decisive) * 100) : 0, cond, args };
}

function streakOf(db, gid) {
    const rows = db.prepare('SELECT result FROM clan_wars WHERE guild_id = ? ORDER BY played_at DESC, id DESC LIMIT 50').all(gid);
    if (!rows.length) return null;
    let n = 0;
    for (const row of rows) { if (row.result !== rows[0].result) break; n++; }
    return { kind: rows[0].result, n };
}

// "Team X", "team x" and "TeamX" are the same clan: reuse the name already recorded.
function knownOpponent(db, gid, name) {
    const n = norm(name);
    const rows = db.prepare('SELECT opponent, COUNT(*) AS c FROM clan_wars WHERE guild_id = ? GROUP BY opponent ORDER BY c DESC').all(gid);
    return rows.find((r) => norm(r.opponent) === n)?.opponent || null;
}

const getMatch = (db, gid, id) => db.prepare('SELECT * FROM clan_wars WHERE id = ? AND guild_id = ?').get(id, gid);
const canManage = (member) => access.can(member, 'settings').ok;

// ─── text pieces ─────────────────────────────────────────────────────────
const tally = (r, lang) => T('tally', lang, { w: r.win, l: r.loss, d: r.draw });
const plural = (lang, key, n) => T(n === 1 ? `${key}One` : `${key}Many`, lang, { n });
const bar = (rate) => { const f = Math.round(rate / 10); return '▰'.repeat(f) + '▱'.repeat(10 - f); };

function matchLine(m, lang, where, withId) {
    const score = m.score ? ` \`${m.score}\`` : '';
    const mode = m.mode ? ` · ${m.mode}` : '';
    return `${withId ? `\`#${m.id}\` ` : ''}${resIcon(m.result, where)} **${m.opponent}**${score}${mode} — <t:${m.played_at}:d>`;
}

function streakLine(s, lang, where) {
    if (!s || s.n < 2) return null;
    return `${icon('flame', where)} ${T(`streak_${s.kind}`, lang, { n: s.n })}`;
}

// ─── cards ───────────────────────────────────────────────────────────────
function statsView(client, guild, viewerId, lang, where, notice) {
    const db = client.db;
    const r = tallyOf(db, guild.id);
    if (!r.played) return null;
    const s = streakOf(db, guild.id);
    const recent = db.prepare('SELECT * FROM clan_wars WHERE guild_id = ? ORDER BY played_at DESC, id DESC LIMIT 5').all(guild.id);
    const rivals = db.prepare(
        `SELECT opponent, SUM(result = 'win') AS win, SUM(result = 'loss') AS loss, SUM(result = 'draw') AS draw, COUNT(*) AS n
         FROM clan_wars WHERE guild_id = ? GROUP BY LOWER(opponent) ORDER BY n DESC, MAX(played_at) DESC LIMIT 5`
    ).all(guild.id);

    const head = [
        notice ? `-# ${notice}` : null,
        `-# ${guild.name}`,
        `## ${icon('swords', where)} ${T('title', lang)}`,
        `**${tally(r, lang)}** · ${T('winRate', lang, { rate: r.rate })}`,
        `\`${bar(r.rate)}\``,
        streakLine(s, lang, where),
    ].filter(Boolean).join('\n');

    const iconUrl = guild.iconURL?.({ size: 128 });
    const items = [iconUrl ? { thumbnail: [head, iconUrl] } : { text: head }, { rule: true },
        { text: `**${icon('clock', where)} ${T('recent', lang)}**\n${recent.map((m) => matchLine(m, lang, where)).join('\n')}` }];
    if (rivals.length > 1 || (rivals[0]?.n || 0) > 1) {
        items.push({ text: `**${icon('target', where)} ${T('rivals', lang)}**\n${rivals.map((x) => `**${x.opponent}** — ${tally(x, lang)}`).join('\n')}` });
    }
    items.push({
        row: new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`war:hist:${viewerId}:0:`)
            .setStyle(ButtonStyle.Secondary).setLabel(T('btnHistory', lang)).setEmoji(icon('history', where))),
    });
    items.push({ text: `-# ${plural(lang, 'matches', r.played)}` });
    return card(COLOR[recent[0]?.result] || COLOR.none, items);
}

function historyView(client, guild, viewerId, page, filter, lang, where) {
    const db = client.db;
    const f = (filter || '').slice(0, 60);
    const r = tallyOf(db, guild.id, f);
    if (!r.played) return null;
    const pages = Math.ceil(r.played / PER_PAGE);
    const p = Math.min(Math.max(0, page | 0), pages - 1);
    const rows = db.prepare(`SELECT * FROM clan_wars WHERE ${r.cond} ORDER BY played_at DESC, id DESC LIMIT ? OFFSET ?`)
        .all(...r.args, PER_PAGE, p * PER_PAGE);

    const items = [
        { text: `## ${icon('history', where)} ${T('historyTitle', lang)}${f ? ` — ${f}` : ''}\n${plural(lang, 'matches', r.played)} · ${tally(r, lang)}` },
        { rule: true },
        { text: rows.map((m) => matchLine(m, lang, where, true)).join('\n') },
        {
            row: new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('war:open').setPlaceholder(T('pick', lang))
                .addOptions(rows.map((m) => ({
                    label: `#${m.id} · ${m.opponent}`.slice(0, 100),
                    description: [T(`res_${m.result}`, lang), m.score, m.mode].filter(Boolean).join(' · ').slice(0, 100),
                    value: String(m.id),
                    emoji: emojiOf(RESULTS.includes(m.result) ? m.result : 'draw', where),
                })))),
        },
    ];
    const id = (n) => `war:hist:${viewerId}:${n}:${f}`.slice(0, 100);
    const nav = new ActionRowBuilder();
    if (pages > 1) {
        nav.addComponents(
            new ButtonBuilder().setCustomId(p > 0 ? id(p - 1) : 'war:hist:x').setStyle(ButtonStyle.Secondary).setEmoji(icon('page_prev', where)).setDisabled(p === 0),
            new ButtonBuilder().setCustomId('war:pg').setStyle(ButtonStyle.Secondary).setLabel(`${p + 1} / ${pages}`).setDisabled(true),
            new ButtonBuilder().setCustomId(p < pages - 1 ? id(p + 1) : 'war:hist:y').setStyle(ButtonStyle.Secondary).setEmoji(icon('page_next', where)).setDisabled(p >= pages - 1),
        );
    }
    nav.addComponents(new ButtonBuilder().setCustomId(`war:stats:${viewerId}`).setStyle(ButtonStyle.Secondary)
        .setLabel(T('btnStats', lang)).setEmoji(icon('swords', where)));
    items.push({ row: nav });
    return card(COLOR.none, items);
}

function matchView(m, lang, where, notice) {
    const lines = [
        notice ? `-# ${notice}` : null,
        `## ${resIcon(m.result, where)} ${T(`vs_${m.result}`, lang, { opponent: m.opponent })}`,
        m.score ? `**${T('score', lang)}** · \`${m.score}\`` : null,
        m.mode ? `**${T('mode', lang)}** · ${m.mode}` : null,
    ].filter(Boolean).join('\n');
    const items = [{ text: lines }];
    if (m.note) items.push({ text: `> ${m.note.replace(/\n/g, '\n> ')}` });
    items.push({ text: `-# #${m.id} · <t:${m.played_at}:f> · ${T('recordedBy', lang, { user: `<@${m.recorded_by}>` })}` });
    return { items, color: COLOR[m.result] || COLOR.none };
}

function matchCard(m, lang, where) {
    const { items, color } = matchView(m, lang, where);
    items.push({
        row: new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`war:del:${m.id}`)
            .setStyle(ButtonStyle.Danger).setLabel(T('btnDelete', lang)).setEmoji(icon('trash', where))),
    });
    return card(color, items);
}

// ─── deleting ────────────────────────────────────────────────────────────
function confirmPayload(m, lang, where) {
    return {
        content: `${icon('warn', where)} ${T('confirmDelete', lang, { id: m.id, result: T(`res_${m.result}`, lang), opponent: m.opponent })}`,
        components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`war:delok:${m.id}`).setStyle(ButtonStyle.Danger).setLabel(T('btnDelete', lang)).setEmoji(icon('trash', where)),
            new ButtonBuilder().setCustomId('war:delno').setStyle(ButtonStyle.Secondary).setLabel(T('btnKeep', lang)).setEmoji(icon('back', where)),
        )],
        flags: EPH,
        allowedMentions: { parse: [] },
    };
}

async function logDelete(client, guild, m, byId) {
    const ch = require('../lib/modlog').resolveModLog(guild, client.db);
    if (!ch) return;
    let lang = 'en';
    try { lang = require('../lib/pick-lang').pickLang(client, guild.id, null); } catch { /* English */ }
    if (!['en', 'fr', 'zh', 'ar'].includes(lang)) lang = 'en';
    await ch.send({
        embeds: [new EmbedBuilder().setColor(0x5b6b7c).setTitle(T('logTitle', lang))
            .setDescription(T('logText', lang, { user: `<@${byId}>`, id: m.id, result: T(`res_${m.result}`, lang), opponent: m.opponent }))
            .setTimestamp()],
        allowedMentions: { parse: [] },
    }).catch((e) => console.error(`[WAR] mod-log guild=${guild.id}:`, e.message));
}

// ─── buttons and menu ────────────────────────────────────────────────────
async function handleComponent(ix, client) {
    if (!ix.guild) return;
    const lang = langOf(client, ix);
    const db = client.db;
    const [, act, a, b] = ix.customId.split(':');
    const say = (ic, key, vars) => ix.reply({ content: `${icon(ic, ix)} ${T(key, lang, vars)}`, flags: EPH, allowedMentions: { parse: [] } }).catch(() => {});
    const tell = (ic, key, vars) => ix.update({ content: `${icon(ic, ix)} ${T(key, lang, vars)}`, components: [] });
    const show = (view, viewer) => (ix.user.id === viewer ? ix.update(view) : ix.reply({ ...view, flags: V2 | EPH }));

    if (act === 'stats') {
        const view = statsView(client, ix.guild, ix.user.id, lang, ix);
        return view ? show(view, a) : say('no', 'noMatches');
    }
    if (act === 'hist') {
        const filter = ix.customId.split(':').slice(4).join(':');
        const view = historyView(client, ix.guild, ix.user.id, Number(b), filter, lang, ix);
        return view ? show(view, a) : say('no', 'noMatches');
    }
    if (act === 'open' && ix.isStringSelectMenu()) {
        const m = getMatch(db, ix.guildId, Number(ix.values[0]));
        if (!m) return say('no', 'gone');
        return ix.reply({ ...matchCard(m, lang, ix), flags: V2 | EPH });
    }
    if (act === 'del' || act === 'delok') {
        const m = getMatch(db, ix.guildId, Number(a));
        if (!m) return act === 'del' ? say('no', 'gone') : tell('no', 'gone');
        const no = access.deny(ix.member, 'settings', lang);
        if (no) return act === 'del' ? ix.reply({ content: no, flags: EPH }).catch(() => {}) : ix.update({ content: no, components: [] });
        if (act === 'del') return ix.reply(confirmPayload(m, lang, ix));
        db.prepare('DELETE FROM clan_wars WHERE id = ?').run(m.id);
        logDelete(client, ix.guild, m, ix.user.id).catch(() => {});
        return tell('trash', 'deleted', { id: m.id, result: T(`res_${m.result}`, lang), opponent: m.opponent });
    }
    if (act === 'delno') return tell('ok', 'kept');
}

// ─── command ─────────────────────────────────────────────────────────────
module.exports = {
    name: 'war',
    aliases: ['wars', 'clanwar', 'guerre'],
    description: 'Track clan war results against other clans.',
    category: 'GAMING',
    usage: '/war record | /war stats | /war history | /war delete',
    cooldown: 3000,
    handleComponent,

    data: new SlashCommandBuilder().setName('war').setDescription('⚔️ Clan war tracker')
        .addSubcommand((s) => s.setName('record').setDescription('Record a match result (Manage Server)')
            .addStringOption((o) => o.setName('opponent').setDescription('Clan you played').setRequired(true).setAutocomplete(true))
            .addStringOption((o) => o.setName('result').setDescription('How it went').setRequired(true)
                .addChoices({ name: 'Win', value: 'win' }, { name: 'Loss', value: 'loss' }, { name: 'Draw', value: 'draw' }))
            .addStringOption((o) => o.setName('score').setDescription('e.g. 3-1'))
            .addStringOption((o) => o.setName('mode').setDescription('e.g. BR, Search & Destroy, Hardpoint'))
            .addStringOption((o) => o.setName('note').setDescription('Anything worth remembering')))
        .addSubcommand((s) => s.setName('stats').setDescription('Clan record and win rate'))
        .addSubcommand((s) => s.setName('history').setDescription('Recent matches')
            .addStringOption((o) => o.setName('opponent').setDescription('Filter by clan').setAutocomplete(true)))
        .addSubcommand((s) => s.setName('delete').setDescription('Remove a recorded match (Manage Server)')
            .addIntegerOption((o) => o.setName('id').setDescription('Match ID').setRequired(true))),

    autocomplete: async (interaction) => {
        const focused = interaction.options.getFocused(true);
        if (focused.name !== 'opponent' || !interaction.guildId) return interaction.respond([]).catch(() => {});
        const q = String(focused.value || '').trim();
        let rows = [];
        try {
            rows = interaction.client.db.prepare(
                `SELECT opponent, COUNT(*) AS n FROM clan_wars WHERE guild_id = ? AND LOWER(opponent) LIKE ? ESCAPE '\\'
                 GROUP BY LOWER(opponent) ORDER BY n DESC, MAX(played_at) DESC LIMIT 25`
            ).all(interaction.guildId, escLike(q));
        } catch { /* nothing to offer */ }
        const out = rows.map((r) => ({ name: `${r.opponent} (${r.n})`.slice(0, 100), value: r.opponent.slice(0, 100) }));
        if (q && interaction.options.getSubcommand(false) === 'record' && !rows.some((r) => norm(r.opponent) === norm(q)) ) {
            out.splice(24, out.length, { name: `${q.slice(0, 80)} (new)`, value: q.slice(0, 80) });
        }
        return interaction.respond(out.slice(0, 25)).catch(() => {});
    },

    execute: async (interaction, client) => {
        const lang = langOf(client, interaction);
        if (!interaction.guild) return interaction.reply({ content: T('serverOnly', lang), flags: EPH });
        const db = client.db;
        const gid = interaction.guild.id;
        const sub = interaction.options.getSubcommand();
        const eph = (ic, key, vars) => interaction.reply({ content: `${icon(ic, interaction)} ${T(key, lang, vars)}`, flags: EPH, allowedMentions: { parse: [] } });
        const send = (view) => interaction.reply({ ...view, flags: V2 }).catch((e) => console.error(`[WAR] ${sub} guild=${gid}:`, e.message));

        if (sub === 'record' || sub === 'delete') {
            const no = access.deny(interaction.member, 'settings', lang);
            if (no) return interaction.reply({ content: no, flags: EPH });
        }

        if (sub === 'record') {
            const typed = interaction.options.getString('opponent').trim().slice(0, 80);
            const opponent = knownOpponent(db, gid, typed) || typed;
            const result = interaction.options.getString('result');
            const score = interaction.options.getString('score')?.trim().slice(0, 20) || null;
            const mode = interaction.options.getString('mode')?.trim().slice(0, 40) || null;
            const note = interaction.options.getString('note')?.trim().slice(0, 300) || null;
            if (!opponent) return eph('warn', 'noOpponent');

            const id = db.prepare('INSERT INTO clan_wars (guild_id, opponent, result, score, mode, note, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
                .run(gid, opponent, result, score, mode, note, interaction.user.id).lastInsertRowid;

            const m = getMatch(db, gid, id);
            const r = tallyOf(db, gid);
            const { items, color } = matchView(m, lang, interaction, `${icon('ok', interaction)} ${T('saved', lang)}`);
            items.splice(items.length - 1, 0, { rule: true }, {
                text: [`**${icon('swords', interaction)} ${T('record', lang)}** · ${tally(r, lang)} · ${T('winRate', lang, { rate: r.rate })}`,
                    streakLine(streakOf(db, gid), lang, interaction)].filter(Boolean).join('\n'),
            });
            items.push({
                row: new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`war:stats:${interaction.user.id}`).setStyle(ButtonStyle.Secondary).setLabel(T('btnStats', lang)).setEmoji(icon('swords', interaction)),
                    new ButtonBuilder().setCustomId(`war:hist:${interaction.user.id}:0:`).setStyle(ButtonStyle.Secondary).setLabel(T('btnHistory', lang)).setEmoji(icon('history', interaction)),
                ),
            });
            return send(card(color, items));
        }

        if (sub === 'stats') {
            const view = statsView(client, interaction.guild, interaction.user.id, lang, interaction);
            return view ? send(view) : eph('no', 'noMatches');
        }

        if (sub === 'history') {
            const opp = interaction.options.getString('opponent');
            const view = historyView(client, interaction.guild, interaction.user.id, 0, opp, lang, interaction);
            if (!view) return opp ? eph('no', 'noMatchesVs', { opponent: opp }) : eph('no', 'noMatches');
            return send(view);
        }

        if (sub === 'delete') {
            const m = getMatch(db, gid, interaction.options.getInteger('id'));
            if (!m) return eph('no', 'notFound', { id: interaction.options.getInteger('id') });
            return interaction.reply(confirmPayload(m, lang, interaction));
        }
    },

    // Prefix: .war → the stats card · .war <clan> → the history against that clan
    run: async (client, message, args, _db, _ss, _used, lang) => {
        if (!lang) lang = langOf(client, message);
        if (!message.guild) return message.reply(T('serverOnly', lang)).catch(() => {});
        const arg = args.join(' ').trim().slice(0, 60);
        const view = arg
            ? historyView(client, message.guild, message.author.id, 0, arg, lang, message)
            : statsView(client, message.guild, message.author.id, lang, message);
        if (!view) {
            return message.reply({ content: `${icon('no', message)} ${T(arg ? 'noMatchesVs' : 'noMatches', lang, { opponent: arg })}`, allowedMentions: { parse: [] } }).catch(() => {});
        }
        return message.reply({ ...view, flags: V2 }).catch((e) => console.error(`[WAR] prefix guild=${message.guild.id}:`, e.message));
    },
};
