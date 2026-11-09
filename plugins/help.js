'use strict';
// /help: every command by category, as V2 cards (texts in lang/<locale>/help.json).
// Slash commands are shown as blue clickable mentions, subcommands included (/bot ping, /remind set…).
// The menu and buttons use customIds "help:<action>:<ownerId>:…" routed from index.js, so they keep working after a restart.
// Someone other than the person who opened the menu gets their own private copy instead of changing it.
const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { t, slashLang, LANGS } = require('../lib/i18n');
const v2 = require('../lib/games/v2');
const E = require('../config/emojis');
const mention = require('../lib/mentions');

const PER_PAGE = 10;
const CAT_EMOJI = {
    SYSTEM: 'ic_system', GAMING: 'ic_gaming', AI: 'ai_assistant', PROFILE: 'ic_profile', OWNER: 'ic_owner', GENERAL: 'ic_general',
    UTILITY: 'ic_utility', MODERATION: 'ic_shield', ECONOMY: 'ic_economy', FUN: 'ic_fun', ADMIN: 'ic_admin', CONFIG: 'ic_settings',
    MUSIC: 'ic_music', SOCIAL: 'ic_social', TICKETS: 'ic_ticket', CODM: 'ic_codm', LEVELING: 'level', SUPERCAR: 'ic_gaming',
};
const CAT_FALLBACK = { SYSTEM: '⚙️', GAMING: '🎮', AI: '🤖', PROFILE: '👤', OWNER: '🦅', UTILITY: '🧰', MODERATION: '🛡️', ECONOMY: '🪙', FUN: '🎉', ADMIN: '👑', CONFIG: '⚙️', MUSIC: '🎵', SOCIAL: '💬', TICKETS: '🎫', CODM: '🎯', LEVELING: '📈' };
const START_HERE = [['daily'], ['profile'], ['game'], ['remind', 'set'], ['bot', 'ping']];
const SLASH_LOCALE = { fr: 'fr', zh: 'zh-CN' };

const tr = (lang) => (k, vars) => t('help.' + k, lang, vars || {});
const catEmoji = (cat) => E[CAT_EMOJI[cat]] || CAT_FALLBACK[cat] || '📁';
const isOwner = (userId) => !!userId && userId === process.env.OWNER_ID;
const prefixOf = (client, guildId) => (guildId && client.getServerSettings?.(guildId)?.prefix) || process.env.PREFIX || '.';
// Old descriptions start with an emoji ("📊 Execute…"): drop it, the card has its own icons
const clean = (s) => String(s || '').replace(/^[^\p{L}\p{N}(<`*]+/u, '').trim();

// ─── What a viewer may see ───
function visible(client, userId) {
    const owner = isOwner(userId);
    return [...client.commands.values()].filter(c =>
        c.name && (c.run || c.execute) && c._source !== 'telegram' && (owner || (!c.hidden && cat(c) !== 'OWNER')));
}
const cat = (c) => String(c.category || 'GENERAL').toUpperCase();

function categories(client, userId) {
    const counts = {};
    for (const c of visible(client, userId)) counts[cat(c)] = (counts[cat(c)] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function catName(_, key) {
    const v = _('cat.' + key);
    return v === 'help.cat.' + key ? key.charAt(0) + key.slice(1).toLowerCase() : v;
}

// Module switched off on this server?
function moduleOff(client, guildId, key) {
    if (!guildId) return false;
    const s = client.getServerSettings?.(guildId) || {};
    const flag = { ECONOMY: 'economy_enabled', GAMING: 'gaming_enabled', AI: 'ai_enabled', PROFILE: 'profile_enabled', MODERATION: 'moderation_enabled' }[key];
    return flag ? (s[flag] === false || s[flag] === 0 || s[flag] === '0') : false;
}

// ─── How one command is shown ───
function slashJSON(c) {
    try { return c.data?.toJSON ? c.data.toJSON() : null; } catch (e) { return null; }
}
function describe(c, lang) {
    const j = slashJSON(c);
    const loc = SLASH_LOCALE[lang];
    return clean((loc && j?.description_localizations?.[loc]) || j?.description || c.description) || '';
}
function subcommands(c) {
    const j = slashJSON(c);
    return (j?.options || []).filter(o => o.type === 1);
}
function line(client, c, lang, prefix) {
    const j = slashJSON(c);
    const subs = subcommands(c);
    let head;
    if (j && subs.length) head = subs.map(s => mention(client, j.name, s.name)).join(' ');
    else if (j) head = mention(client, j.name);
    else head = `\`${prefix}${c.name}\``;
    const desc = describe(c, lang);
    return `${head}${desc ? `\n-# ${desc.length > 90 ? desc.slice(0, 87) + '…' : desc}` : ''}`;
}

// ─── Controls ───
function menuRow(client, _, userId, current) {
    const opts = categories(client, userId).slice(0, 25).map(([key, n]) => {
        const o = { label: `${catName(_, key)} · ${n}`.slice(0, 100), value: key, default: key === current };
        const e = E[CAT_EMOJI[key]];
        const m = e && /^<(a?):(\w+):(\d+)>$/.exec(e);
        o.emoji = m ? { id: m[3], name: m[2], animated: m[1] === 'a' } : (CAT_FALLBACK[key] || '📁');
        return o;
    });
    return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
        .setCustomId(`help:cat:${userId}`).setPlaceholder(_('pick')).addOptions(opts));
}
const btn = (id, label, disabled = false) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(ButtonStyle.Secondary).setDisabled(disabled);

// ─── Cards ───
function homeCard(client, lang, userId, guildId) {
    const _ = tr(lang);
    const cats = categories(client, userId);
    const total = cats.reduce((a, [, n]) => a + n, 0);
    const pairs = [];
    for (let i = 0; i < cats.length; i += 2) {
        pairs.push(cats.slice(i, i + 2).map(([k, n]) => `${catEmoji(k)} **${catName(_, k)}** · ${n}`).join('   '));
    }
    const start = START_HERE
        .filter(([name]) => client.commands.get(name)?.data)
        .map(([name, sub]) => mention(client, name, sub || null)).join('  ');
    return v2.card(0x5865f2, [
        { text: `## ${E.eagle || '🦅'} ${_('home_title')}\n${_('home_intro', { help: mention(client, 'help') })}` },
        { rule: true },
        { text: pairs.join('\n') },
        ...(start ? [{ rule: true }, { text: `**${_('start_here')}** · ${start}` }] : []),
        { text: `-# ${_('home_foot', { count: total, prefix: prefixOf(client, guildId) })}` },
        { row: menuRow(client, _, userId, null) },
    ]);
}

function categoryCard(client, lang, userId, guildId, key, page = 0) {
    const _ = tr(lang);
    const prefix = prefixOf(client, guildId);
    const cmds = visible(client, userId).filter(c => cat(c) === key).sort((a, b) => a.name.localeCompare(b.name));
    const pages = Math.max(1, Math.ceil(cmds.length / PER_PAGE));
    page = Math.min(Math.max(0, page), pages - 1);
    const shown = cmds.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
    const desc = _('catdesc.' + key);

    const items = [
        { text: `## ${catEmoji(key)} ${catName(_, key)}${pages > 1 ? ` · ${page + 1}/${pages}` : ''}${desc.startsWith('help.') ? '' : `\n-# ${desc}`}` },
        { rule: true },
    ];
    if (moduleOff(client, guildId, key)) items.push({ text: `${em('ic_warn', '⚠️')} ${_('module_off')}` });
    items.push({ text: shown.map(c => line(client, c, lang, prefix)).join('\n') || _('no_commands') });
    items.push({ text: `-# ${_('cat_foot', { prefix })}` });
    const nav = [btn(`help:home:${userId}`, _('btn_home'))];
    if (pages > 1) {
        nav.push(btn(`help:pg:${userId}:${key}:${page - 1}`, '◀', page === 0));
        nav.push(btn(`help:pg:${userId}:${key}:${page + 1}`, '▶', page >= pages - 1));
    }
    items.push({ row: new ActionRowBuilder().addComponents(...nav) }, { row: menuRow(client, _, userId, key) });
    return v2.card(0x1d9e75, items);
}

function commandCard(client, lang, userId, guildId, c) {
    const _ = tr(lang);
    const prefix = prefixOf(client, guildId);
    const j = slashJSON(c);
    const subs = subcommands(c);
    const loc = SLASH_LOCALE[lang];
    const items = [{ text: `## ${catEmoji(cat(c))} ${j ? '/' : prefix}${c.name}\n${describe(c, lang) || _('no_desc')}` }, { rule: true }];
    if (subs.length) {
        items.push({ text: subs.map(s => `${mention(client, j.name, s.name)}\n-# ${clean((loc && s.description_localizations?.[loc]) || s.description)}`).join('\n') });
    } else if (j) {
        items.push({ text: mention(client, j.name) });
    }
    const facts = [];
    if (c.usage) facts.push(`**${_('prefix_use')}** · \`${String(c.usage).replace(/(^|· )[.!?$](?=\w)/g, `$1${prefix}`)}\``);
    const aliases = (c.aliases || []).filter(a => a !== c.name).slice(0, 8);
    if (aliases.length) facts.push(`**${_('also')}** · ${aliases.map(a => '`' + prefix + a + '`').join(' ')}`);
    facts.push(`-# ${catName(_, cat(c))}${c.cooldown ? ' · ' + _('cooldown', { s: Math.round(c.cooldown / 1000) }) : ''}`);
    items.push({ rule: true }, { text: facts.join('\n') });
    items.push({ row: new ActionRowBuilder().addComponents(btn(`help:home:${userId}`, _('btn_home')), btn(`help:pg:${userId}:${cat(c)}:0`, catName(_, cat(c)))) });
    return v2.card(0x7f77dd, items);
}

// Look up a command or a category by any name
function find(client, userId, query) {
    const q = String(query || '').toLowerCase().replace(/^[/.!]/, '').split(/\s+/)[0];
    if (!q) return null;
    const vis = visible(client, userId);
    const key = q.toUpperCase();
    if (vis.some(c => cat(c) === key)) return { key };
    const c = vis.find(x => x.name === q) || vis.find(x => (x.aliases || []).includes(q));
    return c ? { c } : null;
}

function answer(client, lang, userId, guildId, query) {
    if (!query) return homeCard(client, lang, userId, guildId);
    const hit = find(client, userId, query);
    if (hit?.key) return categoryCard(client, lang, userId, guildId, hit.key, 0);
    if (hit?.c) return commandCard(client, lang, userId, guildId, hit.c);
    const _ = tr(lang);
    return v2.card(0xe74c3c, [
        { text: _('not_found', { q: String(query).slice(0, 50), help: mention(client, 'help') }) },
        { row: menuRow(client, _, userId, null) },
    ]);
}

// ─── Menu and buttons (routed from index.js) ───
async function handleComponent(interaction, client) {
    const [, action, ownerId, key, page] = interaction.customId.split(':');
    const me = interaction.user.id;
    const lang = slashLang(interaction);
    const gid = interaction.guildId;
    const target = action === 'cat' ? interaction.values?.[0] : key;
    const card = action === 'home' ? homeCard(client, lang, me, gid)
        : categoryCard(client, lang, me, gid, target, action === 'pg' ? Number(page) || 0 : 0);
    // Someone else's menu: give them their own private copy
    if (me !== ownerId) return interaction.reply({ ...card, flags: card.flags | 64 }).catch(() => {});
    return interaction.update(card).catch(e => console.error('[HELP]', e.message));
}

module.exports = {
    name: 'help',
    aliases: ['h', 'menu', 'docs', 'aide'],
    description: 'Every command, by category',
    category: 'SYSTEM',
    cooldown: 3000,
    usage: '.help [command or category]',
    examples: ['.help', '.help remind', '.help gaming'],

    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Every command, by category')
        .setDescriptionLocalizations({ fr: 'Toutes les commandes, par catégorie', 'zh-CN': '按分类查看所有命令' })
        .addStringOption(o => o.setName('query').setDescription('A command or a category').setRequired(false).setAutocomplete(true)
            .setDescriptionLocalizations({ fr: 'Une commande ou une catégorie', 'zh-CN': '命令或分类' })),

    async autocomplete(interaction) {
        const client = interaction.client;
        const q = interaction.options.getFocused().toLowerCase();
        const vis = visible(client, interaction.user.id);
        const names = [...new Set([...vis.map(c => cat(c).toLowerCase()), ...vis.map(c => c.name)])];
        await interaction.respond(names.filter(n => n.includes(q)).sort((a, b) => a.indexOf(q) - b.indexOf(q)).slice(0, 25)
            .map(n => ({ name: n, value: n }))).catch(() => {});
    },

    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        const L = LANGS.includes(lang) ? lang : 'en';
        return message.reply(answer(client, L, message.author.id, message.guild?.id, args.join(' '))).catch(e => console.error('[HELP]', e.message));
    },

    execute: async (interaction, client) => {
        const card = answer(client, slashLang(interaction), interaction.user.id, interaction.guildId, interaction.options.getString('query'));
        return interaction.reply({ ...card, flags: card.flags | 64 }).catch(e => console.error('[HELP]', e.message));
    },

    handleComponent,
};
