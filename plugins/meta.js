// /meta — the CODM weapon meta as one Components V2 card.
// The list has a class filter and a weapon picker; a weapon opens in the same card (stats, recommended loadout, picture)
// with a way back. Whoever ran the command moves through the card itself; anyone else who presses a control gets
// their own copy that only they can see, so nobody changes the card under someone else.
const fs = require('fs');
const {
    SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder,
} = require('discord.js');
const W = require('../lib/weapons');
const i18n = require('../lib/i18n');
const { pickLang } = require('../lib/pick-lang');
const { card } = require('../lib/games/v2');
let EMOJIS = {};
try { EMOJIS = require('../config/emojis'); } catch { /* plain emoji below */ }

const TIER_EMOJI = { GOD: '🏆', S: '🔥', A: '⚔️', B: '🛡️', C: '📦' };
const LIST_COLOR = 0xffd700;
const ALL = '*';
const hex = (c) => parseInt(String(c || '#95a5a6').replace('#', ''), 16);
const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
const T = (lang) => (k, v) => i18n.t(`meta.${k}`, lang, v);
const tierLabel = (tier, tr) => `${TIER_EMOJI[tier] || '•'} ${tr('tierName', { tier: tier === 'GOD' ? 'God' : tier })}`;

// The server's own picture for a weapon, set with /setloadout (it used to be saved but never shown anywhere)
const LOADOUT_KEYS = ['AK117', 'FFAR1', 'DLQ', 'KRM', 'TUNDRA', 'BP50', 'KN44', 'HS0405', 'RYTEC', 'HDR', 'BY15'];
const squash = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
function serverImage(db, guildId, weapon) {
    if (!db || !guildId) return null;
    const key = LOADOUT_KEYS.find((k) => squash(weapon.name).startsWith(k));
    if (!key) return null;
    try {
        const row = db.prepare('SELECT image_path FROM loadout_images WHERE guild_id = ? AND weapon_key = ?').get(guildId, key);
        return row?.image_path && fs.existsSync(row.image_path) ? row.image_path : null;
    } catch { return null; }
}

const button = (id, label, emoji, style = ButtonStyle.Secondary) => {
    const b = new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
    if (emoji) b.setEmoji(emoji);
    return b;
};

// ── The list ────────────────────────────────────────────────────────────────────────────────────────────
function listView(ctx, cat) {
    const tr = T(ctx.lang);
    const { season, updated } = W.getSeason();
    const catKey = cat || ALL;
    const items = [{ text: `## ${EMOJIS.gamer || '🎮'} ${tr('metaTitle', { season })}\n-# ${tr('updated', { updated: updated || tr('unknown') })}` }];

    const blocks = [];
    for (const [tier, list] of W.byTier()) {
        const shown = cat ? list.filter((w) => same(w.category, cat)) : list;
        if (shown.length) blocks.push(`### ${tierLabel(tier, tr)}\n` + shown.map((w) => `**${w.name}** · ${w.category || '—'}`).join('\n'));
    }
    items.push({ rule: true });
    items.push({ text: blocks.length ? blocks.join('\n') : (cat ? tr('emptyCategory', { cat }) : tr('emptyList')) });

    const cats = W.categories();
    if (cats.length) {
        const count = (c) => W.getWeapons().filter((w) => same(w.category, c)).length;
        items.push({ rule: true });
        items.push({ row: new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId(`meta:f:${ctx.uid}`).setPlaceholder(tr('filterPlaceholder')).addOptions(
                { label: tr('filterAll'), value: ALL, default: !cat },
                ...cats.slice(0, 24).map((c) => ({ label: c.slice(0, 100), value: c.slice(0, 100), description: tr('weaponsCount', { n: count(c) }), default: same(c, cat) })),
            )) });
    }
    const pickable = (cat ? W.getWeapons().filter((w) => same(w.category, cat)) : W.getWeapons()).slice(0, 25);
    if (pickable.length) {
        items.push({ row: new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId(`meta:w:${ctx.uid}:${catKey}`).setPlaceholder(tr('openPlaceholder')).addOptions(
                pickable.map((w) => ({
                    label: w.name.slice(0, 100), value: w.name.slice(0, 100),
                    description: `${w.tier ? tr('tierName', { tier: w.tier === 'GOD' ? 'God' : w.tier }) : '—'} · ${w.category || '—'}`.slice(0, 100),
                    emoji: TIER_EMOJI[w.tier] || undefined,
                })),
            )) });
        items.push({ row: new ActionRowBuilder().addComponents(button(`meta:r:${ctx.uid}:${catKey}`, tr('randomBtn'), '🎲')) });
    }
    items.push({ text: `-# ${tr('listHint')}` });
    return card(LIST_COLOR, items);
}

// ── One weapon ──────────────────────────────────────────────────────────────────────────────────────────
function weaponView(ctx, w, cat, random = false) {
    const tr = T(ctx.lang);
    const catKey = cat || ALL;
    const where = `-# ${ctx.guild?.name || 'ARCHON'} · ${tr('armory')}`;
    const line = w.tier
        ? `**${tierLabel(w.tier, tr)}** · ${w.category || tr('unclassified')}`
        : `${w.category || tr('unclassified')} · *${tr('notInMeta')}*`;
    const intel = (w.intel && (w.intel[ctx.lang] || w.intel.en)) || (typeof w.intel === 'string' ? w.intel : '');
    const items = [{ text: `${where}\n## ${w.name}\n${line}${intel ? `\n\n${intel}` : ''}` }];

    const s = w.stats || {};
    if (Object.keys(s).length) {
        const rows = [['statFireRate', s.fireRate], ['statDamage', s.damage], ['statAccuracy', s.accuracy], ['statRange', s.range], ['statControl', s.control], ['statMobility', s.mobility]];
        const pad = Math.max(...rows.map(([k]) => tr(k).length)) + 2;
        const lines = rows.map(([k, v]) => `${tr(k).padEnd(pad)}${W.statBar(v ?? 0)} ${String(v ?? 0).padStart(3)}`);
        items.push({ rule: true });
        items.push({ text: `**${tr('statsTitle')}**\n\`\`\`\n${lines.join('\n')}\n\`\`\`` });
    }
    if (w.specs) {
        items.push({ rule: true });
        items.push({ text: `**${tr('loadoutTitle')}**\n` + w.specs.split(',').map((x) => `• ${x.trim()}`).filter((x) => x.length > 2).join('\n') });
    }

    const files = [];
    const local = serverImage(ctx.db, ctx.guild?.id, w);
    if (local) {
        files.push(new AttachmentBuilder(local, { name: 'loadout.jpg' }));
        items.push({ media: ['attachment://loadout.jpg', w.name] });
    } else if (/^https:\/\//.test(w.image || '')) {
        items.push({ media: [w.image, w.name] });
    }

    items.push({ rule: true });
    items.push({ row: new ActionRowBuilder().addComponents(
        button(`meta:b:${ctx.uid}:${catKey}`, tr('backBtn'), '◀️'),
        button(`meta:r:${ctx.uid}:${catKey}`, random ? tr('anotherBtn') : tr('randomBtn'), '🎲'),
    ) });
    items.push({ text: `-# ${tr('weaponFooter', { season: W.getSeason().season })}` });
    return { ...card(hex(W.tierColor(w.tier)), items), files };
}

function randomView(ctx, cat) {
    const pool = cat ? W.getWeapons().filter((w) => same(w.category, cat)) : W.getWeapons();
    const list = pool.length ? pool : W.getWeapons();
    if (!list.length) return null;
    return weaponView(ctx, list[Math.floor(Math.random() * list.length)], cat, true);
}

// ── Buttons and menus on a /meta card ───────────────────────────────────────────────────────────────────
async function handleComponent(interaction, client) {
    const lang = pickLang(client, interaction.guildId, interaction, interaction.user?.id);
    const ctx = { guild: interaction.guild, lang, uid: interaction.user.id, db: client?.db || interaction.client?.db };
    const tr = T(lang);

    // Cards sent before this version had a single "reroll" button
    if (interaction.customId === 'meta_reroll') {
        const view = randomView(ctx, null);
        return interaction.reply(view ? { ...view, flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral }
            : { content: tr('emptyList'), flags: MessageFlags.Ephemeral }).catch(() => {});
    }

    const [, kind, owner, ...rest] = interaction.customId.split(':');
    const tail = rest.join(':');
    const cat = tail && tail !== ALL ? tail : null;
    let view = null;
    if (kind === 'f') {
        const v = interaction.values?.[0];
        view = listView(ctx, v && v !== ALL ? v : null);
    } else if (kind === 'w') {
        const w = W.findWeapon(interaction.values?.[0]);
        view = w ? weaponView(ctx, w, cat) : listView(ctx, cat);
    } else if (kind === 'r') {
        view = randomView(ctx, cat);
    } else if (kind === 'b') {
        view = listView(ctx, cat);
    }
    if (!view) return interaction.reply({ content: tr('emptyList'), flags: MessageFlags.Ephemeral }).catch(() => {});

    if (interaction.user.id === owner) {
        // attachments: [] drops the previous picture, `files` brings the new one if there is one
        return interaction.update({ ...view, attachments: [] }).catch((e) => console.error('[META] update:', e.message));
    }
    return interaction.reply({ ...view, flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral })
        .catch((e) => console.error('[META] copy:', e.message));
}

module.exports = {
    name: 'meta',
    aliases: ['tier', 'tierlist', 'weapon', 'gun', 'randommeta', 'codm', 'pick', 'arme', 'loadout', 'loadouts', 'weapons', 'armes'],
    description: 'CODM weapon meta: tier list with a class filter, and full specs for any weapon.',
    category: 'GAMING',
    usage: '/meta [category] | /meta weapon <name>',
    cooldown: 3000,

    data: new SlashCommandBuilder().setName('meta').setDescription('🎯 CODM weapon meta').
        addSubcommand(s => s.setName('list').setDescription('Show the current weapon tier list').
            addStringOption(o => o.setName('category').setDescription('Filter by weapon class').setAutocomplete(true))).
        addSubcommand(s => s.setName('random').setDescription('Random weapon pick from the meta')).
        addSubcommand(s => s.setName('weapon').setDescription('Full specs for one weapon').
            addStringOption(o => o.setName('name').setDescription('Weapon name').setRequired(true).setAutocomplete(true))),

    autocomplete: async (interaction) => {
        const focused = interaction.options.getFocused(true);
        const typed = (focused.value || '').toLowerCase();

        if (focused.name === 'category') {
            const cats = W.categories().filter(c => c.toLowerCase().includes(typed));
            return interaction.respond(cats.slice(0, 25).map(c => ({ name: c, value: c }))).catch(() => {});
        }
        if (focused.name === 'name') {
            const hits = W.searchWeapons(typed, 25);
            return interaction.respond(
                hits.map(w => ({ name: `${w.name}${w.tier ? ` [${w.tier}]` : ''} · ${w.category || '—'}`, value: w.name }))
            ).catch(() => {});
        }
        return interaction.respond([]).catch(() => {});
    },

    handleComponent,
    // Kept for other code that shows the list or a weapon
    listView, weaponView, randomView,

    execute: async (interaction, client) => {
        const bot = client || interaction.client;
        const lang = pickLang(bot, interaction.guildId, interaction, interaction.user?.id);
        const tr = T(lang);
        const ctx = { guild: interaction.guild, lang, uid: interaction.user.id, db: bot?.db };
        const sub = interaction.options.getSubcommand();

        if (sub === 'random') {
            const view = randomView(ctx, null);
            if (!view) return interaction.reply({ content: tr('emptyList'), flags: MessageFlags.Ephemeral });
            return interaction.reply(view);
        }
        if (sub === 'list') {
            const asked = interaction.options.getString('category');
            const cat = asked ? (W.categories().find((c) => same(c, asked)) || W.categories().find((c) => c.toLowerCase().includes(asked.toLowerCase())) || asked) : null;
            return interaction.reply(listView(ctx, cat));
        }
        if (sub === 'weapon') {
            const q = interaction.options.getString('name');
            const w = W.findWeapon(q);
            if (!w) {
                const names = W.getWeapons().map(x => x.name).join(', ');
                return interaction.reply({ content: tr('noMatch', { q, names: names || tr('noneYet') }), flags: MessageFlags.Ephemeral });
            }
            return interaction.reply(weaponView(ctx, w, null));
        }
    },

    // Prefix: .meta | .meta sniper | .weapon ak117 | .pick
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = pickLang(client, message.guild?.id, message, message.author?.id);
        const tr = T(lang);
        const ctx = { guild: message.guild, lang, uid: message.author.id, db: db || client?.db };
        const used = String(usedCommand || '').toLowerCase();
        const arg = args.join(' ').trim();

        // .weapon / .gun always look up one weapon
        if (used === 'weapon' || used === 'gun') {
            if (!arg) return message.reply(tr('weaponUsage')).catch(() => {});
            const w = W.findWeapon(arg);
            if (!w) {
                const names = W.getWeapons().map(x => x.name).join(', ');
                return message.reply(tr('noMatch', { q: arg, names: names || tr('noneYet') })).catch(() => {});
            }
            return message.reply(weaponView(ctx, w, null)).catch(() => {});
        }

        // .randommeta / .pick / .codm / .arme: a random pick with "another one"
        if (['randommeta', 'pick', 'codm', 'arme'].includes(used)) {
            const view = randomView(ctx, null);
            return message.reply(view || tr('emptyList')).catch(() => {});
        }

        // .meta with an argument: a class filter, or a weapon name if it matches one
        if (arg) {
            const cat = W.categories().find(c => c.toLowerCase().includes(arg.toLowerCase()));
            if (cat) return message.reply(listView(ctx, cat)).catch(() => {});
            const w = W.findWeapon(arg);
            if (w) return message.reply(weaponView(ctx, w, null)).catch(() => {});
        }
        return message.reply(listView(ctx, null)).catch(() => {});
    },
};
