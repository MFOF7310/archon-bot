const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js');
const { icon } = require('../lib/ui/icons');
const em = (k, fb) => { try { return require('../config/emojis')[k] || fb; } catch { return fb; } };
const { pickLang } = require('../lib/pick-lang');
const { resolveEmoji } = require('../lib/emoji-resolver');
const { t } = require('../lib/i18n');

// Translations: lang/{en,fr,bm,zh,ar}/inventory.json

function getMarketState(guildId) { try { const mm = require('./market-manager'); return mm.getMarketState(guildId); } catch (e) { return { trend: 'STEADY', multiplier: 1.0 }; } }
function getTrend() { try { const mm = require('./market-manager'); const ms = mm.getMarketState(); return mm.TRENDS[ms.trend] || mm.TRENDS.STEADY; } catch (e) { return { emoji: em('ic_chart', '📊'), name: 'Steady', color: '#f1c40f', multiplier: [0.98, 1.08] }; } }

module.exports = {
    // Its own name: it used to be called "shop" like plugins/shop.js, so whichever file loaded last took the
    // command, and .buy / .inventory pointed at functions that did not exist
    name: 'inventory', aliases: ['inv', 'inventaire', 'buy', 'purchase', 'acheter', 'sell', 'vendre'],
    description: '🎒 Your items, and buying or selling one by its id.', category: 'ECONOMY', usage: '.inventory | .buy <item-id> | .sell <item-id>',
    examples: ['.inventory', '.buy starter_pack', '.sell starter_pack'], cooldown: 3000,

    data: new SlashCommandBuilder().setName('inventory').setDescription('🎒 Your items')
        .addSubcommand(sub => sub.setName('browse').setDescription('Open the shop'))
        .addSubcommand(sub => sub.setName('buy').setDescription('Buy an item').addStringOption(o => o.setName('item').setDescription('Item ID').setRequired(true)))
        .addSubcommand(sub => sub.setName('inventory').setDescription('View your inventory'))
        .addSubcommand(sub => sub.setName('sell').setDescription('Sell an item').addStringOption(o => o.setName('item').setDescription('Item ID').setRequired(true))),

    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        if (!lang) lang = pickLang(client, message.guild?.id, message, message.author?.id);
        const guildId = message.guild?.id || 'DM';
        const guildName = message.guild?.name || 'ARCHON CG-223';
        const cmd = usedCommand?.toLowerCase() || '';
        if (['buy', 'purchase', 'acheter'].includes(cmd)) return handleBuy(message, args, client, db, lang, guildId);
        if (['sell', 'vendre'].includes(cmd)) return handleSell(message, args, client, db, lang, guildId, guildName);
        return handleInventory(message, client, db, lang, guildId, guildName);
    },

    execute: async (interaction, client) => {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild?.id || 'DM';
        const lang = pickLang(client, interaction.guildId, interaction, interaction.user?.id);
        const guildName = interaction.guild?.name || 'ARCHON CG-223';
        if (sub === 'browse') {
            const shop = client.commands?.get('shop');
            if (shop?.execute) return shop.execute(interaction, client);
        }
        const fakeMsg = { author: interaction.user, guild: interaction.guild, channel: interaction.channel,
            reply: async (opts) => interaction.reply(typeof opts === 'string' ? { content: opts } : { ...opts }).then(() => interaction.fetchReply()).catch(() => null) };
        if (sub === 'buy') return handleBuy(fakeMsg, [interaction.options.getString('item')], client, client.db, lang, guildId);
        if (sub === 'sell') return handleSell(fakeMsg, [interaction.options.getString('item')], client, client.db, lang, guildId, guildName);
        return handleInventory(fakeMsg, client, client.db, lang, guildId, guildName);
    }
};

// ================= INVENTORY =================
// What the person really owns (the user_inventory table the shop and /use work with; it used to read an old
// "purchases" table, so items bought in the shop never showed here)
function inventoryView(client, db, userId, lang, guildId, guildName) {
    const userData = (client.getUserData ? client.getUserData(userId, guildId) : db.prepare('SELECT * FROM users WHERE id = ? AND guild_id = ?').get(userId, guildId)) || { credits: 0 };
    const catalog = client.shopItems || [];
    let rows = [];
    try { rows = db.prepare('SELECT item_id, quantity FROM user_inventory WHERE user_id = ? AND active = 1 AND quantity > 0 ORDER BY item_id').all(userId); } catch (e) {}
    const list = rows.map((r) => {
        const it = catalog.find((x) => x.id === r.item_id);
        const name = it ? (it[lang]?.name || it.en?.name || r.item_id) : r.item_id;
        return `• ${it?.emoji || em('ic_bag', '📦')} **${name}** ×${r.quantity} · \`${r.item_id}\``;
    }).join('\n') || t('inventory.noItemsPurchased', lang);

    const container = new ContainerBuilder().setAccentColor(0x9b59b6);
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${em('ic_bag', '🎒')} ${t('inventory.yourInventory', lang)}\n**${t('inventory.yourCredits', lang)} :** \`${(userData.credits || 0).toLocaleString()}\` ${em('ic_credit', '🪙')}`));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${t('inventory.purchasedItems', lang)}**\n${list}`));
    container.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('inv_shop').setLabel(t('inventory.viewStore', lang)).setStyle(ButtonStyle.Primary).setEmoji(icon('shop')),
        new ButtonBuilder().setCustomId('inv_refresh').setLabel(t('inventory.refresh', lang)).setStyle(ButtonStyle.Secondary).setEmoji(icon('refresh')),
    ));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${t('inventory.footer', lang)} • ${guildName}`));
    return { components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
}

async function handleInventory(message, client, db, lang, guildId, guildName) {
    const userId = message.author.id;
    const sent = await message.reply(inventoryView(client, db, userId, lang, guildId, guildName)).catch(() => null);
    if (!sent?.createMessageComponentCollector) return;
    const collector = sent.createMessageComponentCollector({ time: 120000 });
    collector.on('collect', async (i) => {
        if (i.user.id !== userId) return i.reply({ content: t('inventory.notYours', lang), flags: 64 }).catch(() => {});
        if (i.customId === 'inv_refresh') {
            try {
                return await i.update(inventoryView(client, db, userId, lang, guildId, guildName));
            } catch (e) {
                console.error('[INV REFRESH ERROR]', e);
                return i.reply({ content: '❌ Failed to refresh inventory.', flags: 64 }).catch(() => {});
            }
        }
        if (i.customId === 'inv_shop') {
            // GUARD: Ignore si l'interaction est déjà traitée (double-clic)
            if (i.deferred || i.replied) return;
            
            // On achète 15 minutes de temps à Discord pour éviter le timeout
            await i.deferReply({ flags: 64 }).catch(() => {});
            
            const shop = client.commands?.get('shop');
            const fakeMsg = {
                author: i.user,
                guild: i.guild,
                channel: i.channel,
                reply: async (opts) => i.editReply(typeof opts === 'string' ? { content: opts } : opts)
            };
            if (shop?.run) return shop.run(client, fakeMsg, [], db, client.getServerSettings?.(guildId) || {}, 'shop', lang).catch(e => console.error('[SHOP BTN ERROR]', e));
        }
    });
    collector.on('end', () => {
        const view = inventoryView(client, db, userId, lang, guildId, guildName);
        // Buttons are only live for two minutes: take them away instead of leaving dead ones
        try { view.components[0].components = view.components[0].components.filter((x) => x.data?.type !== 1); } catch (e) {}
        sent.edit(view).catch(() => {});
    });
}

// ================= BUY (.buy <item-id>) — the same purchase as the shop menu =================
async function handleBuy(message, args, client, db, lang, guildId) {
    const userId = message.author.id;
    const itemId = String(args[0] || '').trim().toLowerCase();
    if (!itemId) return message.reply(t('inventory.usage', lang)).catch(() => {});
    const item = (client.shopItems || []).find((x) => x.id === itemId);
    if (!item) return message.reply(t('inventory.itemNotFound', lang)).catch(() => {});

    const fd = db.prepare('SELECT credits, xp, level FROM users WHERE id = ? AND guild_id = ?').get(userId, guildId);
    const bal = fd?.credits || 0;
    const lvl = fd?.level || 1;
    if (item.requirement?.level && lvl < item.requirement.level) {
        return message.reply(t('shop.levelRequirement', lang, { level: item.requirement.level, current: lvl })).catch(() => {});
    }
    if (bal < item.price) {
        return message.reply(t('shop.insufficientFunds', lang, { price: item.price.toLocaleString(), balance: bal.toLocaleString() })).catch(() => {});
    }
    const newCredits = bal - item.price + (item.effect?.credits || 0);
    const newXP = (fd?.xp || 0) + (item.effect?.xp || 0);
    const newLevel = Math.floor(0.1 * Math.sqrt(newXP)) + 1;
    db.prepare('UPDATE users SET credits = ?, xp = ?, level = ? WHERE id = ? AND guild_id = ?').run(newCredits, newXP, newLevel, userId, guildId);
    if (item.effect?.streak_protection) {
        db.prepare('UPDATE users SET streak_protections = COALESCE(streak_protections, 0) + 1 WHERE id = ? AND guild_id = ?').run(userId, guildId);
    }
    const owned = db.prepare('SELECT quantity FROM user_inventory WHERE user_id = ? AND item_id = ?').get(userId, itemId);
    if (owned) db.prepare('UPDATE user_inventory SET quantity = quantity + 1, active = 1 WHERE user_id = ? AND item_id = ?').run(userId, itemId);
    else db.prepare('INSERT INTO user_inventory (user_id, item_id, quantity, active) VALUES (?, ?, 1, 1)').run(userId, itemId);
    if (client.userDataCache) client.userDataCache.delete(userId + ':' + guildId);

    const name = item[lang]?.name || item.en?.name || itemId;
    const c = new ContainerBuilder().setAccentColor(0x2ecc71)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ✅ ${t('shop.purchaseComplete', lang)}\n**${item.emoji || '🛒'} ${name}** · ${item.price.toLocaleString()} 🪙`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${t('inventory.newBalanceLabel', lang)} : ${newCredits.toLocaleString()} 🪙`));
    return message.reply({ components: [c], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } }).catch(() => {});
}

// ================= SELL (.sell <item-id>) — half the price back =================
async function handleSell(message, args, client, db, lang, guildId, guildName) {
    const userId = message.author.id;
    const itemId = String(args[0] || '').trim().toLowerCase();
    if (!itemId) return message.reply(t('inventory.usage', lang)).catch(() => {});
    const item = (client.shopItems || []).find((x) => x.id === itemId);
    if (!item) return message.reply(t('inventory.itemNotFound', lang)).catch(() => {});

    let owned = null;
    try { owned = db.prepare('SELECT quantity FROM user_inventory WHERE user_id = ? AND item_id = ? AND active = 1').get(userId, itemId); } catch (e) {}
    if (!owned || owned.quantity <= 0) return message.reply(t('inventory.notOwnedSell', lang)).catch(() => {});

    const userData = (client.getUserData ? client.getUserData(userId, guildId) : db.prepare('SELECT * FROM users WHERE id = ? AND guild_id = ?').get(userId, guildId)) || { credits: 0 };
    const sellPrice = Math.floor(item.price * 0.5);
    const newCredits = (userData.credits || 0) + sellPrice;
    db.prepare('UPDATE users SET credits = ? WHERE id = ? AND guild_id = ?').run(newCredits, userId, guildId);
    if (client.queueUserUpdate) client.queueUserUpdate(userId, guildId, { ...userData, credits: newCredits });
    if (client.userDataCache) client.userDataCache.delete(`${userId}:${guildId}`);
    if (owned.quantity > 1) db.prepare('UPDATE user_inventory SET quantity = quantity - 1 WHERE user_id = ? AND item_id = ?').run(userId, itemId);
    else db.prepare('DELETE FROM user_inventory WHERE user_id = ? AND item_id = ?').run(userId, itemId);

    const name = item[lang]?.name || item.en?.name || itemId;
    const c = new ContainerBuilder().setAccentColor(0xe67e22)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${t('inventory.sellSuccess', lang)}\n**${item.emoji || '📦'} ${name}** · ${t('inventory.soldFor', lang, { price: sellPrice.toLocaleString() })}`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${t('inventory.newBalanceLabel', lang)} : ${newCredits.toLocaleString()} 🪙 · ${guildName}`));
    return message.reply({ components: [c], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } }).catch(() => {});
}
