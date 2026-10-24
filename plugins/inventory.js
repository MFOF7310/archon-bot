const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js');
const { pickLang } = require('../lib/pick-lang');
const { resolveEmoji } = require('../lib/emoji-resolver');
const { t } = require('../lib/i18n');

// Translations: lang/{en,fr,bm,zh,ar}/inventory.json

function getMarketState(guildId) { try { const mm = require('./market-manager'); return mm.getMarketState(guildId); } catch (e) { return { trend: 'STEADY', multiplier: 1.0 }; } }
function getTrend() { try { const mm = require('./market-manager'); const ms = mm.getMarketState(); return mm.TRENDS[ms.trend] || mm.TRENDS.STEADY; } catch (e) { return { emoji: '📊', name: 'Steady', color: '#f1c40f', multiplier: [0.98, 1.08] }; } }

module.exports = {
    name: 'shop', aliases: ['store', 'boutique', 'catalog', 'catalogue', 'marketplace', 'buy', 'purchase', 'acheter', 'inventory', 'inv', 'inventaire'],
    description: '🛒 Browse the Neural Shop, buy items, and manage your inventory.', category: 'ECONOMY', usage: '.shop | .buy <item-id> | .inventory',
    examples: ['.shop', '.buy starter_pack', '.inventory', '.inv sell starter_pack'], cooldown: 3000,

    data: new SlashCommandBuilder().setName('inventory').setDescription('🛒 Neural Shop Bamako')
        .addSubcommand(sub => sub.setName('browse').setDescription('Browse the shop'))
        .addSubcommand(sub => sub.setName('buy').setDescription('Buy an item').addStringOption(o => o.setName('item').setDescription('Item ID').setRequired(true)))
        .addSubcommand(sub => sub.setName('inventory').setDescription('View your inventory'))
        .addSubcommand(sub => sub.setName('sell').setDescription('Sell an item').addStringOption(o => o.setName('item').setDescription('Item ID').setRequired(true))),

    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        
        const prefix = serverSettings?.prefix || '.';
        const userId = message.author.id;
        const guild = message.guild;
        const guildName = guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = guild?.iconURL() || client.user.displayAvatarURL();
        const version = client.version || '2.0.0';

        // PER-SERVER: Extract guildId for composite key lookups
        const guildId = guild?.id || 'DM';

        const buyCmds = ['buy', 'purchase', 'acheter'];
        const invCmds = ['inventory', 'inv', 'inventaire'];
        const sellCmds = ['sell', 'vendre'];
        const cmd = usedCommand?.toLowerCase() || '';

        if (buyCmds.includes(cmd)) return handleBuy(message, args, client, db, serverSettings, lang, prefix, guildId, guildName, guildIcon, version);
        if (invCmds.includes(cmd)) return handleInventory(message, client, db, lang, prefix, guildId, guildName, guildIcon, version);
        if (sellCmds.includes(cmd)) return handleSell(message, args, client, db, lang, prefix, guildId, guildName, guildIcon, version);
        return handleShop(message, client, db, lang, prefix, guildId, guildName, guildIcon, version);
    },

    execute: async (interaction, client) => {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild?.id || 'DM';
        const ss = client.getServerSettings?.(guildId)
            || client.settings?.get(guildId)
            || {};
        const lang = ss.language || 'en';
        const prefix = ss.prefix || '.';
        const guildName = interaction.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = interaction.guild?.iconURL() || client.user.displayAvatarURL();
        const version = client.version || '2.0.0';
        const serverSettings = interaction.guild ? client.getServerSettings?.(interaction.guild.id) || {} : {};

        const fakeMsg = { author: interaction.user, guild: interaction.guild, channel: interaction.channel,
            reply: async (opts) => interaction.reply({ ...opts }).catch(() => null) };

        if (sub === 'buy') return handleBuy(fakeMsg, [interaction.options.getString('item')], client, client.db, serverSettings, lang, prefix, guildId, guildName, guildIcon, version);
        if (sub === 'inventory') return handleInventory(fakeMsg, client, client.db, lang, prefix, guildId, guildName, guildIcon, version);
        if (sub === 'sell') return handleSell(fakeMsg, [interaction.options.getString('item')], client, client.db, lang, prefix, guildId, guildName, guildIcon, version);
        return handleShop(fakeMsg, client, client.db, lang, prefix, guildId, guildName, guildIcon, version);
    }
};

// ================= HANDLE SHOP =================
async function handleShop(message, client, db, lang, prefix, guildId, guildName, guildIcon, version) {
    const trend = getTrend();
    const userId = message.author.id;

    // PER-SERVER: Composite key lookup
    let userData = client.getUserData ? client.getUserData(userId, guildId) : db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
    if (!userData) userData = { credits: 0 };

    const items = client.shopItems || [];
    const container = new ContainerBuilder().setAccentColor(0x9b59b6);
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${resolveEmoji('inventory', client) || '🎒'} ${t('inventory.yourInventory', lang)}`));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${t('inventory.yourCredits', lang)}:** \`${credits.toLocaleString()}\` 🪙`));
    
    let itemList = '';
    try {
        const purchases = db.prepare("SELECT item_name, price, timestamp FROM purchases WHERE user_id = ? ORDER BY timestamp DESC LIMIT 10").all(userId);
        if (purchases && purchases.length > 0) {
            itemList = purchases.map(p => `• **${p.item_name}** — ${p.price.toLocaleString()} 🪙`).join('\n');
        } else {
            itemList = t('inventory.noItemsPurchased', lang);
        }
    } catch (e) {
        itemList = t('inventory.noItemsPurchased', lang);
    }
    
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${t('inventory.purchasedItems', lang)}**\n${itemList}`));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${t('inventory.footer', lang)} • ${guildName} • v${version}`));

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('inv_shop').setLabel(t('inventory.viewStore', lang)).setStyle(ButtonStyle.Primary).setEmoji(resolveEmoji('shop', client) || '🛒'),
        new ButtonBuilder().setCustomId('inv_refresh').setLabel(t('inventory.refresh', lang)).setStyle(ButtonStyle.Secondary).setEmoji(resolveEmoji('refresh', client) || '🔄')
    );
    container.addActionRowComponents(row);

    const sent = await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
    if (!sent) return;

    const collector = sent.createMessageComponentCollector({ filter: (i) => i.user.id === userId, time: 60000 });
    collector.on('collect', async (i) => {
        if (i.user.id !== userId) return;
        try { await i.deferUpdate(); } catch (e) { return; }
        if (i.customId === 'inv_shop') return handleShop(message, client, db, lang, prefix, guildId, guildName, guildIcon, version);
        if (i.customId === 'inv_refresh') return handleInventory(message, client, db, lang, prefix, guildId, guildName, guildIcon, version);
    });
}

// ================= HANDLE SELL =================
async function handleSell(message, args, client, db, lang, prefix, guildId, guildName, guildIcon, version) {
    const userId = message.author.id;
    const itemId = args[0];
    if (!itemId) return message.reply(`❌ ${t('inventory.usage', lang)}`).catch(() => {});

    // Find item
    const item = client.shopItems ? client.shopItems.find(i => i.id === itemId) : null;
    if (!item) return message.reply(t('inventory.itemNotFound', lang)).catch(() => {});

    // Check ownership in purchases
    try {
        const owned = db.prepare("SELECT COUNT(*) as count FROM purchases WHERE user_id = ? AND item_id = ?").get(userId, itemId);
        if (!owned || owned.count === 0) return message.reply(t('inventory.notOwnedSell', lang)).catch(() => {});
    } catch (e) {}

    // PER-SERVER: Composite key lookup
    let userData = client.getUserData ? client.getUserData(userId, guildId) : db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
    if (!userData) userData = { credits: 0 };

    const sellPrice = Math.floor(item.price * 0.5);
    const newCredits = (userData.credits || 0) + sellPrice;

    // PER-SERVER: UPDATE includes guild_id
    db.prepare("UPDATE users SET credits = ? WHERE id = ? AND guild_id = ?").run(newCredits, userId, guildId);
    if (client.queueUserUpdate) client.queueUserUpdate(userId, guildId, { ...userData, credits: newCredits });
    if (client.userDataCache) client.userDataCache.delete(`${userId}:${guildId}`);

    // Remove from purchases
    try { db.prepare("DELETE FROM purchases WHERE user_id = ? AND item_id = ? LIMIT 1").run(userId, itemId); } catch (e) {}

    const itemT = item[lang] || item.en;
    const embed = new EmbedBuilder()
        .setColor('#e67e22')
        .setAuthor({ name: `💸 ${t('inventory.sellSuccess', lang)}`, iconURL: message.author.displayAvatarURL() })
        .setDescription(`**${item.emoji} ${itemT.name}** — ${t('inventory.soldFor', lang, { price: sellPrice.toLocaleString() })}`)
        .addFields({ name: '💰 ' + t('inventory.newBalanceLabel', lang), value: `${newCredits.toLocaleString()} 🪙`, inline: true })
        .setFooter({ text: `${t('inventory.footer', lang)} • ${guildName} • v${version}`, iconURL: guildIcon })
        .setTimestamp();

    await message.reply({ embeds: [embed] }).catch(() => {});
}
