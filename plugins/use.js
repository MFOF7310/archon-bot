// ═══════════════════════════════════════════════════════════════════════════
// /use [item] — use an item from your inventory: boosts and mystery boxes are consumed, badges are equipped
//   The panel: a card listing what can be used, a menu to pick one, Inventory and Close buttons.
//   Every button and menu is global (use:<action>:<uid>[:<item>]): nothing expires after a minute any more.
//   Using an item takes one from the stock in a single database step first (two quick clicks used to spend one item
//   twice), then gives its effect. Badges: equip / unequip, the stock is kept.
//   Items belong to the server they were bought on (user_inventory.guild_id, like /shop and /inventory). The old
//   /use ignored it: an item bought on one server could be used on another, and using one rewrote the stock of
//   that item on every server.
// Texts: lang/<l>/use.json
// ═══════════════════════════════════════════════════════════════════════════
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, SlashCommandBuilder, MessageFlags } = require('discord.js');
const { icon } = require('../lib/ui/icons');
const { t } = require('../lib/i18n');
const v2 = require('../lib/games/v2');

const T = (lang, k, v) => t(`use.${k}`, lang, v || {});
const LANGS = ['en', 'fr', 'zh', 'ar'];
const langOf = (client, gid, where, uid) => { try { const l = require('../lib/pick-lang').pickLang(client, gid, where, uid); return LANGS.includes(l) ? l : 'en'; } catch { return 'en'; } };
const C = { panel: 0x7F77DD, ok: 0x1D9E75, warn: 0xEF9F27, bad: 0xE24B4A, gold: 0xE6A817 };

const calculateLevel = (xp) => Math.floor(0.1 * Math.sqrt(xp || 0)) + 1;
const getRank = (level) => require('../lib/games/progress').rankForLevel(level);   // the one rank ladder
const rankName = (r, lang) => `${r.emoji} ${t(`gameui.ranks.${r.key}`, lang)}`;

const itemsOf = (client) => new Map((client.shopItems || []).map((it) => [it.id, it]));
const nameOf = (item, lang, id) => item?.[lang]?.name || item?.en?.name || item?.name || id;
const descOf = (item, lang) => item?.[lang]?.desc || item?.en?.desc || item?.desc || '';
const kindIcon = (item, where) => item?.type === 'badge' ? icon('trophy', where) : item?.type === 'consumable' ? icon('bolt', where) : icon('gift', where);
const USABLE = new Set(['consumable', 'boost', 'badge']);

function usable(client, uid, gid) {
    const map = itemsOf(client);
    const rows = client.db.prepare('SELECT item_id, quantity, expires_at FROM user_inventory WHERE user_id = ? AND guild_id = ? AND active = 1 AND quantity > 0').all(uid, gid);
    return rows.map((r) => ({ ...r, item: map.get(r.item_id) })).filter((r) => r.item && USABLE.has(r.item.type));
}

// ─── the panel ───
function panel(client, uid, gid, lang, where) {
    const list = usable(client, uid, gid);
    if (!list.length) {
        return v2.card(C.warn, [
            { text: `### ${icon('inventory', where)} ${T(lang, 'emptyTitle')}\n${T(lang, 'emptyBody')}` },
        ]);
    }
    const lines = list.slice(0, 15).map((r) => `${kindIcon(r.item, where)} **${nameOf(r.item, lang, r.item_id)}** ×${r.quantity}${descOf(r.item, lang) ? `\n-# ${String(descOf(r.item, lang)).slice(0, 90)}` : ''}`);
    const menu = new StringSelectMenuBuilder().setCustomId(`use:pick:${uid}`).setPlaceholder(T(lang, 'pick'))
        .addOptions(list.slice(0, 25).map((r) => ({
            label: `${nameOf(r.item, lang, r.item_id)} ×${r.quantity}`.slice(0, 100),
            description: (r.item.type === 'badge' ? T(lang, 'kindBadge') : T(lang, 'kindUse')).slice(0, 100),
            value: r.item_id,
        })));
    return v2.card(C.panel, [
        { text: `### ${icon('bolt', where)} ${T(lang, 'title')}\n-# ${T(lang, 'hint')}` },
        { rule: true },
        { text: lines.join('\n') + (list.length > 15 ? `\n-# ${T(lang, 'more', { n: list.length - 15 })}` : '') },
        { row: new ActionRowBuilder().addComponents(menu) },
        { row: new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`use:inv:${uid}`).setLabel(T(lang, 'btnInventory')).setStyle(ButtonStyle.Secondary).setEmoji(icon('inventory', where)),
            new ButtonBuilder().setCustomId(`use:close:${uid}`).setLabel(T(lang, 'btnClose')).setStyle(ButtonStyle.Secondary),
        ) },
    ]);
}

// ─── badges ───
function badgeCard(client, uid, gid, itemId, lang, where) {
    const item = itemsOf(client).get(itemId);
    const owned = client.db.prepare('SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ? AND active = 1 AND quantity > 0').get(uid, gid, itemId);
    if (!item || !owned) return v2.card(C.bad, [{ text: T(lang, 'notFound') }]);
    const current = client.db.prepare('SELECT active_badge FROM users WHERE id = ? AND guild_id = ?').get(uid, gid)?.active_badge;
    const on = current === itemId;
    const facts = [item.rarity ? T(lang, 'rarity', { r: String(item.rarity) }) : null].filter(Boolean).join(' · ');
    return v2.card(on ? C.gold : C.panel, [
        { text: `### ${icon('trophy', where)} ${nameOf(item, lang, itemId)}\n${on ? T(lang, 'badgeOn') : T(lang, 'badgeAsk')}${facts ? `\n-# ${facts}` : ''}` },
        { row: new ActionRowBuilder().addComponents(on
            ? new ButtonBuilder().setCustomId(`use:unequip:${uid}:${itemId}`.slice(0, 100)).setLabel(T(lang, 'btnUnequip')).setStyle(ButtonStyle.Danger)
            : new ButtonBuilder().setCustomId(`use:equip:${uid}:${itemId}`.slice(0, 100)).setLabel(T(lang, 'btnEquip')).setStyle(ButtonStyle.Success).setEmoji(icon('trophy', where)),
        new ButtonBuilder().setCustomId(`use:back:${uid}`).setLabel(T(lang, 'btnBack')).setStyle(ButtonStyle.Secondary)) },
    ]);
}

// ─── using a boost or a box ───
function useItem(client, uid, gid, username, itemId, lang, where) {
    const db = client.db;
    const item = itemsOf(client).get(itemId);
    const row = db.prepare('SELECT quantity, expires_at FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ? AND active = 1 AND quantity > 0').get(uid, gid, itemId);
    if (!item || !row) return v2.card(C.bad, [{ text: T(lang, 'notFound') }]);
    if (row.expires_at && row.expires_at < Math.floor(Date.now() / 1000)) {
        db.prepare('UPDATE user_inventory SET active = 0 WHERE user_id = ? AND guild_id = ? AND item_id = ?').run(uid, gid, itemId);
        return v2.card(C.bad, [{ text: T(lang, 'expired') }]);
    }
    // one item, taken in one step: a second click finds nothing to take
    const took = db.prepare('UPDATE user_inventory SET quantity = quantity - 1 WHERE user_id = ? AND guild_id = ? AND item_id = ? AND active = 1 AND quantity > 0').run(uid, gid, itemId);
    if (!took.changes) return v2.card(C.bad, [{ text: T(lang, 'notFound') }]);
    db.prepare('DELETE FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ? AND quantity <= 0').run(uid, gid, itemId);
    const left = Math.max(0, row.quantity - 1);

    let user = client.getUserData ? client.getUserData(uid, gid) : db.prepare('SELECT * FROM users WHERE id = ? AND guild_id = ?').get(uid, gid);
    if (!user) user = { id: uid, guild_id: gid, username, credits: 0, xp: 0, level: 1 };
    let xp = user.xp || 0, credits = user.credits || 0;
    const effects = [];
    const e = item.effect || {};
    if (e.xp) { xp += e.xp; effects.push(T(lang, 'gotXp', { n: e.xp.toLocaleString() })); }
    if (e.credits) { credits += e.credits; effects.push(T(lang, 'gotCredits', { n: e.credits.toLocaleString() })); }
    if (Array.isArray(e.random) && e.random.length) {
        const r = e.random[Math.floor(Math.random() * e.random.length)];
        if (r.xp) { xp += r.xp; effects.push(T(lang, 'boxXp', { n: r.xp.toLocaleString() })); }
        else if (r.credits) { credits += r.credits; effects.push(T(lang, 'boxCredits', { n: r.credits.toLocaleString() })); }
    }
    const update = { ...user, xp, credits, level: calculateLevel(xp) };
    if (e.streak_protection) { update.streak_protections = (user.streak_protections || 0) + 1; effects.push(T(lang, 'gotShield')); }
    if (client.queueUserUpdate) client.queueUserUpdate(uid, gid, update);
    else db.prepare(`INSERT INTO users (id, guild_id, username, credits, xp, level) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id, guild_id) DO UPDATE SET credits = excluded.credits, xp = excluded.xp, level = excluded.level`).run(uid, gid, username, credits, xp, update.level);

    const oldLevel = calculateLevel(user.xp || 0), newLevel = update.level;
    const oldRank = getRank(oldLevel), newRank = getRank(newLevel);
    const stats = [];
    if (xp !== (user.xp || 0)) stats.push(`XP \`${(user.xp || 0).toLocaleString()} → ${xp.toLocaleString()}\``);
    if (credits !== (user.credits || 0)) stats.push(`${icon('coins', where)} \`${(user.credits || 0).toLocaleString()} → ${credits.toLocaleString()}\``);
    const items = [
        { text: `### ${kindIcon(item, where)} ${T(lang, 'usedTitle', { item: nameOf(item, lang, itemId) })}\n${effects.join('\n') || T(lang, 'usedPlain')}` },
    ];
    if (stats.length) items.push({ text: stats.join('  ·  ') });
    if (newLevel > oldLevel) items.push({ text: `${icon('trophy', where)} ${T(lang, 'levelUp', { level: newLevel })}${rankName(oldRank, lang) !== rankName(newRank, lang) ? ` · ${rankName(newRank, lang)}` : ''}` });
    items.push({ text: `-# ${left ? T(lang, 'left', { n: left }) : T(lang, 'lastOne')}` });
    console.log(`[USE] ${username} used ${itemId} in ${gid} · ${left} left`);
    return v2.card(C.ok, items);
}

// ─── buttons and the menu: use:<action>:<uid>[:<item>] ───
async function handleComponent(ix, client) {
    const [, action, uid, ...rest] = ix.customId.split(':');
    const lang = langOf(client, ix.guildId, ix, ix.user.id);
    if (ix.user.id !== uid) return ix.reply({ content: T(lang, 'notYours'), flags: MessageFlags.Ephemeral }).catch(() => {});
    const gid = ix.guildId || 'DM';
    const update = (p) => ix.update(p).catch((e) => console.error('[USE] update:', e.message));

    if (action === 'close') return ix.message?.flags?.has?.(MessageFlags.Ephemeral) ? update(v2.card(C.panel, [{ text: `-# ${T(lang, 'closed')}` }])) : ix.message.delete().catch(() => update(v2.card(C.panel, [{ text: `-# ${T(lang, 'closed')}` }])));
    if (action === 'back') return update(panel(client, uid, gid, lang, ix));
    if (action === 'inv') {
        const view = require('./inventory.js').view;
        return view ? update(view(client, client.db, uid, lang, gid, ix.guild?.name || 'ARCHON CG-223')) : null;
    }
    if (action === 'pick') {
        const itemId = ix.values?.[0];
        const item = itemsOf(client).get(itemId);
        if (item?.type === 'badge') return update(badgeCard(client, uid, gid, itemId, lang, ix));
        return update(useItem(client, uid, gid, ix.user.username, itemId, lang, ix));
    }
    const itemId = rest.join(':');
    if (action === 'equip') {
        const owned = client.db.prepare('SELECT 1 FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ? AND active = 1 AND quantity > 0').get(uid, gid, itemId);
        if (!owned) return update(v2.card(C.bad, [{ text: T(lang, 'notFound') }]));
        client.db.prepare(`INSERT INTO users (id, guild_id, username, credits, xp, level, active_badge) VALUES (?, ?, ?, 0, 0, 1, ?)
            ON CONFLICT(id, guild_id) DO UPDATE SET active_badge = excluded.active_badge`).run(uid, gid, ix.user.username, itemId);
        client.userDataCache?.delete(`${uid}:${gid}`);
        return update(v2.card(C.ok, [{ text: `### ${icon('trophy', ix)} ${T(lang, 'equipped', { item: nameOf(itemsOf(client).get(itemId), lang, itemId) })}\n-# ${T(lang, 'equippedHint')}` }]));
    }
    if (action === 'unequip') {
        client.db.prepare('UPDATE users SET active_badge = NULL WHERE id = ? AND guild_id = ?').run(uid, gid);
        client.userDataCache?.delete(`${uid}:${gid}`);
        return update(v2.card(C.panel, [{ text: T(lang, 'unequipped') }]));
    }
    return ix.reply({ content: T(lang, 'notYours'), flags: MessageFlags.Ephemeral }).catch(() => {});
}

// "/use item:" or ".use <item>": straight to the item
function direct(client, uid, gid, username, itemId, lang, where) {
    const hit = usable(client, uid, gid).find((r) => r.item_id === itemId || nameOf(r.item, lang, r.item_id).toLowerCase() === String(itemId).toLowerCase());
    if (!hit) return v2.card(C.bad, [{ text: T(lang, 'notFound') }]);
    return hit.item.type === 'badge' ? badgeCard(client, uid, gid, hit.item_id, lang, where) : useItem(client, uid, gid, username, hit.item_id, lang, where);
}

module.exports = {
    name: 'use',
    aliases: ['utiliser', 'activate', 'open', 'consume', 'equip'],
    description: 'Use an item from your inventory: boosts, mystery boxes, badges',
    category: 'ECONOMY',
    usage: '.use [item]',
    cooldown: 3000,
    examples: ['.use', '.use xp_boost_small', '.use badge_gold'],
    handleComponent,

    data: new SlashCommandBuilder().setName('use').setDescription('Use an item from your inventory')
        .setDescriptionLocalizations({ fr: 'Utiliser un objet de ton inventaire' })
        .addStringOption((o) => o.setName('item').setDescription('The item (empty: open your items)').setRequired(false).setAutocomplete(true)),

    autocomplete: async (interaction, client) => {
        const q = String(interaction.options.getFocused() || '').toLowerCase();
        const lang = langOf(client, interaction.guildId, interaction, interaction.user.id);
        try {
            const choices = usable(client, interaction.user.id, interaction.guildId || 'DM')
                .filter((r) => nameOf(r.item, lang, r.item_id).toLowerCase().includes(q))
                .slice(0, 25).map((r) => ({ name: `${nameOf(r.item, lang, r.item_id)} ×${r.quantity}`.slice(0, 100), value: r.item_id }));
            await interaction.respond(choices).catch(() => {});
        } catch { await interaction.respond([]).catch(() => {}); }
    },

    run: async (client, message, args) => {
        const lang = langOf(client, message.guild?.id, message, message.author.id);
        const gid = message.guild?.id || 'DM';
        const payload = args[0]
            ? direct(client, message.author.id, gid, message.author.username, args.join(' '), lang, message)
            : panel(client, message.author.id, gid, lang, message);
        return message.reply(payload).catch(() => {});
    },

    execute: async (interaction, client) => {
        const lang = langOf(client, interaction.guildId, interaction, interaction.user.id);
        const gid = interaction.guild?.id || 'DM';
        const itemId = interaction.options.getString('item');
        const payload = itemId
            ? direct(client, interaction.user.id, gid, interaction.user.username, itemId, lang, interaction)
            : panel(client, interaction.user.id, gid, lang, interaction);
        return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
    },
};
