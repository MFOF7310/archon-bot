// ═══════════════════════════════════════════════════════
// ARCHON CG-223 — /ghostclean (owner only)
// Finds servers where nobody has used the bot for a while, and lets the owner leave them.
//   - candidates come from the servers the bot is really in (not old database rows)
//   - "quiet since" = last command, button, member join/leave, or the day the bot joined, whichever is latest
//   - the home server (GUILD_ID) and any id in GHOST_KEEP (comma list in .env) are never touched
//   - leaving always asks first, and checks again at click time that the server is still quiet
//   - prefix .ghostclean sends the card to the owner's DMs, so other servers' names stay private
// Buttons and menus use the "ghost:" prefix and are routed from index.js.
// ═══════════════════════════════════════════════════════
const {
    SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags,
} = require('discord.js');
const v2 = require('../lib/games/v2');
const i18n = require('../lib/i18n');
const { pickLang } = require('../lib/pick-lang');

const em = (k, fb) => { try { return require('../config/emojis')[k] || fb; } catch { return fb; } };
const T = (lang, key, vars) => i18n.t('ghostclean.' + key, lang, vars);

const DEFAULT_DAYS = 50;
const SHOWN = 15;            // servers listed on the card
const PICK = 25;             // servers in the menu (Discord limit)
const ORANGE = 0xE67E22, GREEN = 0x2ECC71, RED = 0xE74C3C, GREY = 0x95A5A6;

const isOwner = (id) => id === process.env.OWNER_ID;
const langOf = (i, client) => pickLang(client, i.guildId, i, i.user.id);
const fmt = (n, lang) => Number(n || 0).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US');
const clampDays = (d) => Math.min(365, Math.max(7, parseInt(d, 10) || DEFAULT_DAYS));

function keepList() {
    return new Set([process.env.GUILD_ID, ...String(process.env.GHOST_KEEP || '').split(',')].map(s => String(s || '').trim()).filter(Boolean));
}

// Every server the bot is in, with how long it has been quiet
function scan(client, days) {
    const keep = keepList();
    const now = Date.now() / 1000;
    const seen = new Map();
    try {
        for (const r of client.db.prepare("SELECT guild_id, last_active FROM global_server_stats WHERE guild_id != 'DM'").all()) {
            seen.set(r.guild_id, Number(r.last_active) || 0);
        }
    } catch (_) {}
    const all = [];
    for (const [, g] of client.guilds.cache) {
        if (keep.has(g.id)) continue;
        const joined = Math.floor((g.joinedTimestamp || 0) / 1000);
        const last = Math.max(seen.get(g.id) || 0, joined);
        all.push({ id: g.id, name: g.name, members: g.memberCount || 0, quiet: Math.floor((now - last) / 86400) });
    }
    const ghosts = all.filter(s => s.quiet >= days).sort((a, b) => b.quiet - a.quiet || a.members - b.members);
    const active = all.filter(s => s.quiet < days).sort((a, b) => b.members - a.members);
    return { ghosts, active, total: client.guilds.cache.size };
}

const btn = (id, label, style, emoji) => {
    const b = new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
    if (emoji) b.setEmoji(emoji);
    return b;
};
const emojiOf = (k, fb) => {
    const v = em(k, fb);
    const m = /^<a?:(\w+):(\d+)>$/.exec(v);
    return m ? { id: m[2], name: m[1] } : fb;
};

// ── Main card: the list ──
function listCard(client, lang, days) {
    const { ghosts, total } = scan(client, days);
    const head = `-# ARCHON · ${T(lang, 'owner')}\n## ${em('ic_ghost', '👻')} ${T(lang, 'title')}`;
    if (!ghosts.length) {
        return v2.card(GREEN, [
            { text: head },
            { text: `${em('ic_ok', '✅')} ${T(lang, 'clear', { days, total: fmt(total, lang) })}` },
            { row: new ActionRowBuilder().addComponents(
                btn(`ghost:active:${days}`, T(lang, 'showActive'), ButtonStyle.Secondary, emojiOf('ic_online', '🟢')),
                btn(`ghost:list:${days}`, T(lang, 'refresh'), ButtonStyle.Secondary, emojiOf('ic_refresh', '🔄'))) },
        ]);
    }
    const lines = ghosts.slice(0, SHOWN).map((s, i) =>
        `\`${String(i + 1).padStart(2, ' ')}\` **${s.name.slice(0, 40)}** · ${T(lang, 'line', { members: fmt(s.members, lang), quiet: s.quiet })}`);
    if (ghosts.length > SHOWN) lines.push(`-# ${T(lang, 'more', { n: ghosts.length - SHOWN })}`);
    const members = ghosts.reduce((a, s) => a + s.members, 0);

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`ghost:pick:${days}`)
        .setPlaceholder(T(lang, 'pick'))
        .addOptions(ghosts.slice(0, PICK).map(s => ({
            label: s.name.slice(0, 100),
            description: T(lang, 'line', { members: fmt(s.members, lang), quiet: s.quiet }).slice(0, 100),
            value: s.id,
        })));

    return v2.card(ORANGE, [
        { text: head },
        { text: T(lang, 'summary', { n: ghosts.length, total: fmt(total, lang), days, members: fmt(members, lang) }) },
        { rule: true },
        { text: lines.join('\n') },
        { rule: true },
        { row: new ActionRowBuilder().addComponents(menu) },
        { row: new ActionRowBuilder().addComponents(
            btn(`ghost:all:${days}`, T(lang, 'leaveAll', { n: ghosts.length }), ButtonStyle.Danger),
            btn(`ghost:active:${days}`, T(lang, 'showActive'), ButtonStyle.Secondary, emojiOf('ic_online', '🟢')),
            btn(`ghost:list:${days}`, T(lang, 'refresh'), ButtonStyle.Secondary, emojiOf('ic_refresh', '🔄')),
        ) },
        { text: `-# ${T(lang, 'note')}` },
    ]);
}

// ── Active servers (read only) ──
function activeCard(client, lang, days) {
    const { active, total } = scan(client, days);
    const lines = active.slice(0, 25).map((s, i) =>
        `\`${String(i + 1).padStart(2, ' ')}\` **${s.name.slice(0, 40)}** · ${T(lang, 'activeLine', { members: fmt(s.members, lang), quiet: s.quiet })}`);
    if (active.length > 25) lines.push(`-# ${T(lang, 'more', { n: active.length - 25 })}`);
    return v2.card(GREEN, [
        { text: `-# ARCHON · ${T(lang, 'owner')}\n## ${em('ic_online', '🟢')} ${T(lang, 'activeTitle')}` },
        { text: T(lang, 'activeSummary', { n: active.length, total: fmt(total, lang), days }) },
        { rule: true },
        { text: lines.join('\n') || T(lang, 'noActive') },
        { row: new ActionRowBuilder().addComponents(btn(`ghost:list:${days}`, T(lang, 'showQuiet'), ButtonStyle.Secondary, emojiOf('ic_ghost', '👻'))) },
    ]);
}

// ── One server, before leaving ──
function oneCard(client, lang, days, id) {
    const s = scan(client, 0).ghosts.find(x => x.id === id);
    if (!s) return listCard(client, lang, days);
    const g = client.guilds.cache.get(id);
    const owner = g?.ownerId ? `<@${g.ownerId}>` : '—';
    return v2.card(RED, [
        { text: `-# ARCHON · ${T(lang, 'title')}\n## ${s.name.slice(0, 80)}` },
        { text: [
            `${em('ic_member', '👥')} ${T(lang, 'members', { n: fmt(s.members, lang) })}`,
            `${em('ic_clock', '🕒')} ${T(lang, 'quietFor', { n: s.quiet })}`,
            `${em('ic_crown', '👑')} ${T(lang, 'serverOwner')} ${owner}`,
            `-# ID \`${s.id}\``,
        ].join('\n') },
        { rule: true },
        { text: T(lang, 'askOne') },
        { row: new ActionRowBuilder().addComponents(
            btn(`ghost:go:${days}:${id}`, T(lang, 'yesLeave'), ButtonStyle.Danger),
            btn(`ghost:list:${days}`, T(lang, 'back'), ButtonStyle.Secondary),
        ) },
    ]);
}

// ── Leave everything quiet, after a confirm ──
function askAllCard(client, lang, days) {
    const { ghosts } = scan(client, days);
    if (!ghosts.length) return listCard(client, lang, days);
    const members = ghosts.reduce((a, s) => a + s.members, 0);
    return v2.card(RED, [
        { text: `-# ARCHON · ${T(lang, 'title')}\n## ${em('ic_warn', '⚠️')} ${T(lang, 'sureAll', { n: ghosts.length })}` },
        { text: T(lang, 'sureAllBody', { n: ghosts.length, days, members: fmt(members, lang) }) },
        { row: new ActionRowBuilder().addComponents(
            btn(`ghost:goall:${days}`, T(lang, 'yesAll', { n: ghosts.length }), ButtonStyle.Danger),
            btn(`ghost:list:${days}`, T(lang, 'cancel'), ButtonStyle.Secondary),
        ) },
    ]);
}

function doneCard(lang, days, left, failed) {
    const items = [{ text: `-# ARCHON · ${T(lang, 'title')}\n## ${em('ic_ok', '✅')} ${T(lang, 'done', { n: left.length })}` }];
    if (left.length) items.push({ text: left.slice(0, 20).map(n => `• ${n}`).join('\n') + (left.length > 20 ? `\n-# ${T(lang, 'more', { n: left.length - 20 })}` : '') });
    if (failed.length) items.push({ text: `${em('ic_warn', '⚠️')} ${T(lang, 'failed', { n: failed.length })}\n` + failed.slice(0, 10).map(n => `• ${n}`).join('\n') });
    items.push({ row: new ActionRowBuilder().addComponents(btn(`ghost:list:${days}`, T(lang, 'backList'), ButtonStyle.Secondary)) });
    return v2.card(failed.length ? ORANGE : GREEN, items);
}

async function leave(client, id) {
    const g = client.guilds.cache.get(id);
    if (!g) return null;
    const name = g.name;
    (client.ghostLeaving ||= new Set()).add(id);   // so the departure is recorded as "left", not "removed"
    try {
        await g.leave();
        console.log(`[GHOSTCLEAN] Left ${name} (${id})`);
        return { ok: true, name };
    } catch (e) {
        client.ghostLeaving.delete(id);
        console.error(`[GHOSTCLEAN] Could not leave ${name} (${id}): ${e.message}`);
        return { ok: false, name };
    }
}

// ── Buttons and menu ──
const busy = new Set();
async function handleComponent(interaction, client) {
    const lang = langOf(interaction, client);
    if (!isOwner(interaction.user.id)) {
        return interaction.reply({ content: T(lang, 'ownerOnly'), flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    const [, action, d, id] = interaction.customId.split(':');
    const days = clampDays(d);

    if (action === 'list') return interaction.update(listCard(client, lang, days)).catch(() => {});
    if (action === 'pick') return interaction.update(oneCard(client, lang, days, interaction.values?.[0])).catch(() => {});
    if (action === 'active') return interaction.update(activeCard(client, lang, days)).catch(() => {});
    if (action === 'all') return interaction.update(askAllCard(client, lang, days)).catch(() => {});

    if (action === 'go' || action === 'goall') {
        if (busy.has('run')) return interaction.reply({ content: T(lang, 'busy'), flags: MessageFlags.Ephemeral }).catch(() => {});
        busy.add('run');
        try {
            await interaction.deferUpdate().catch(() => {});
            // check again now: the server may have become active since the card was shown
            const quiet = new Set(scan(client, days).ghosts.map(s => s.id));
            const ids = action === 'go' ? [id].filter(x => quiet.has(x)) : [...quiet];
            const left = [], failed = [];
            for (const gid of ids) {
                const r = await leave(client, gid);
                if (r?.ok) left.push(r.name); else if (r) failed.push(r.name);
            }
            if (action === 'go' && !ids.length) {
                return interaction.editReply(v2.card(GREY, [
                    { text: `${em('ic_ok', '✅')} ${T(lang, 'nowActive')}` },
                    { row: new ActionRowBuilder().addComponents(btn(`ghost:list:${days}`, T(lang, 'backList'), ButtonStyle.Secondary)) },
                ])).catch(() => {});
            }
            return interaction.editReply(doneCard(lang, days, left, failed)).catch(() => {});
        } finally {
            busy.delete('run');
        }
    }
}

module.exports = {
    name: 'ghostclean',
    aliases: ['ghostservers', 'cleanghosts'],
    description: '👻 Find quiet servers and leave them (owner only).',
    category: 'OWNER',
    usage: '.ghostclean [days]',
    cooldown: 3000,
    handleComponent,

    data: new SlashCommandBuilder()
        .setName('ghostclean')
        .setDescription('👻 Find quiet servers and leave them (owner only)')
        .addIntegerOption(o => o.setName('days')
            .setDescription(`Quiet for at least this many days (default ${DEFAULT_DAYS})`)
            .setMinValue(7).setMaxValue(365).setRequired(false)),

    run: async (client, message, args) => {
        if (!isOwner(message.author.id)) return;
        const lang = pickLang(client, message.guild?.id, null, message.author.id);
        const card = listCard(client, lang, clampDays(args[0]));
        // sent in DMs: other servers' names are not shown in a public channel
        const sent = await message.author.send(card).catch(() => null);
        if (sent) message.react('📬').catch(() => {});
        else message.reply({ content: T(lang, 'dmClosed') }).catch(() => {});
    },

    execute: async (interaction, client) => {
        const lang = langOf(interaction, client);
        if (!isOwner(interaction.user.id)) {
            return interaction.reply({ content: T(lang, 'ownerOnly'), flags: MessageFlags.Ephemeral }).catch(() => {});
        }
        await interaction.reply({ ...listCard(client, lang, clampDays(interaction.options.getInteger('days'))), flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral }).catch(() => {});
    },
};
