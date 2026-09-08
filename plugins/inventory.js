const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
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
            reply: async (opts) => interaction.reply({ ...opts, fetchReply: true }).catch(() => null) };

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
    const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setAuthor({ name: `${t('inventory.heroTitle', lang)}`, iconURL: client.user.displayAvatarURL() })
        .setTitle(`${t('inventory.heroSubtitle', lang)}`)
        .setDescription(`\`\`\`yaml\n💰 ${t('inventory.subtitle', lang)} ${(userData.credits || 0).toLocaleString()} 🪙\n${t('inventory.marketLabel', lang)} ${trend.emoji} ${trend.name}\n\`\`\``)
        .setFooter({ text: `${t('inventory.footer', lang)} • ${guildName} • v${version}`, iconURL: guildIcon })
        .setTimestamp();

    // Build shop items field
    const itemText = items.slice(0, 6).map(item => {
        const itemT = item[lang] || item.en;
        return `${item.emoji} **${itemT.name}** — ${item.price.toLocaleString()} 🪙\n> ${itemT.desc}`;
    }).join('\n\n');

    embed.addFields({ name: t('inventory.availableItems', lang), value: itemText || t('inventory.noItemsAvailable', lang), inline: false });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('shop_refresh').setLabel(t('inventory.refresh', lang)).setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
        new ButtonBuilder().setCustomId('shop_inv').setLabel(t('inventory.myInventory', lang)).setStyle(ButtonStyle.Primary).setEmoji('🎒')
    );

    const sent = await message.reply({ embeds: [embed], components: [row] }).catch(() => null);
    if (!sent) return;

    const collector = sent.createMessageComponentCollector({ filter: (i) => i.user.id === userId, time: 60000 });
    collector.on('collect', async (i) => {
        await i.deferUpdate().catch(() => {});
        if (i.customId === 'shop_refresh') return handleShop(message, client, db, lang, prefix, guildId, guildName, guildIcon, version);
        if (i.customId === 'shop_inv') return handleInventory(message, client, db, lang, prefix, guildId, guildName, guildIcon, version);
    });
}

// ================= HANDLE BUY =================
async function handleBuy(message, args, client, db, serverSettings, lang, prefix, guildId, guildName, guildIcon, version) {
    const itemId = args[0];
    if (!itemId) return message.reply(`❌ ${t('inventory.usage', lang)}`).catch(() => {});

    const item = client.shopItems ? client.shopItems.find(i => i.id === itemId) : null;
    if (!item) return message.reply(t('inventory.itemNotFound', lang)).catch(() => {});

    const userId = message.author.id;
    const itemT = item[lang] || item.en;

    // PER-SERVER: Composite key lookup
    let userData = client.getUserData ? client.getUserData(userId, guildId) : db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
    if (!userData) {
        // PER-SERVER: INSERT includes guild_id
        db.prepare("INSERT INTO users (id, guild_id, username, xp, level, credits, streak_days, last_daily, total_dailies, highest_streak) VALUES (?, ?, ?, 0, 1, 0, 0, 0, 0, 0)").run(userId, guildId, message.author.username);
        userData = { credits: 0 };
    }

    if ((userData.credits || 0) < item.price) {
        return message.reply(t('inventory.insufficientCredits', lang, { cost: item.price.toLocaleString(), bal: (userData.credits || 0).toLocaleString() })).catch(() => {});
    }

    const newCredits = (userData.credits || 0) - item.price;

    // PER-SERVER: UPDATE includes guild_id
    db.prepare("UPDATE users SET credits = ? WHERE id = ? AND guild_id = ?").run(newCredits, userId, guildId);
    if (client.queueUserUpdate) client.queueUserUpdate(userId, guildId, { ...userData, credits: newCredits });
    // PER-SERVER: Cache delete uses composite key
    if (client.userDataCache) client.userDataCache.delete(`${userId}:${guildId}`);

    // Log purchase
    try { db.prepare("INSERT INTO purchases (user_id, item_id, item_name, price, timestamp) VALUES (?, ?, ?, ?, ?)").run(userId, item.id, itemT.name, item.price, Date.now()); } catch (e) {}

    // Handle item effects
    if (item.effect) {
        if (item.effect.xp) {
            const newXP = (userData.xp || 0) + item.effect.xp;
            db.prepare("UPDATE users SET xp = ? WHERE id = ? AND guild_id = ?").run(newXP, userId, guildId);
        }
        if (item.effect.credits) {
            const postBonusCredits = newCredits + item.effect.credits;
            db.prepare("UPDATE users SET credits = ? WHERE id = ? AND guild_id = ?").run(postBonusCredits, userId, guildId);
        }
    }

    const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setAuthor({ name: `✅ ${t('inventory.itemBought', lang)}`, iconURL: message.author.displayAvatarURL() })
        .setDescription(t('inventory.successDesc', lang, { emoji: item.emoji, name: itemT.name, desc: itemT.desc }))
        .addFields(
            { name: '💰 ' + t('inventory.costLabel', lang), value: `${item.price.toLocaleString()} 🪙`, inline: true },
            { name: '💰 ' + t('inventory.newBalanceLabel', lang), value: `${newCredits.toLocaleString()} 🪙`, inline: true }
        )
        .setFooter({ text: `${t('inventory.footer', lang)} • ${guildName} • v${version}`, iconURL: guildIcon })
        .setTimestamp();

    await message.reply({ embeds: [embed] }).catch(() => {});

    // Assign shop roles if applicable
    if (message.guild) {
        try {
            const settings = serverSettings || client.getServerSettings(message.guild.id);
            if (item.type === 'role' && item.roleId) {
                const member = await message.guild.members.fetch(userId).catch(() => null);
                if (member) {
                    const role = message.guild.roles.cache.get(item.roleId);
                    if (role && !member.roles.cache.has(item.roleId)) {
                        await member.roles.add(role, `Purchased: ${itemT.name}`).catch(() => {});
                    }
                }
            }
        } catch (e) {}
    }
}

// ================= HANDLE INVENTORY =================
async function handleInventory(message, client, db, lang, prefix, guildId, guildName, guildIcon, version) {
    const userId = message.author.id;

    // PER-SERVER: Composite key lookup
    let userData = client.getUserData ? client.getUserData(userId, guildId) : db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
    if (!userData) userData = { credits: 0 };

    const credits = userData.credits || 0;
    const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setAuthor({ name: `🎒 ${t('inventory.yourInventory', lang)}`, iconURL: message.author.displayAvatarURL() })
        .setDescription(`**${t('inventory.yourCredits', lang)}:** ${credits.toLocaleString()} 🪙\n\n*${t('inventory.verifyBalance', lang)}*`)
        .setFooter({ text: `${t('inventory.footer', lang)} • ${guildName} • v${version}`, iconURL: guildIcon })
        .setTimestamp();

    // Display purchased items from DB
    try {
        const purchases = db.prepare("SELECT item_name, price, timestamp FROM purchases WHERE user_id = ? ORDER BY timestamp DESC LIMIT 10").all(userId);
        if (purchases && purchases.length > 0) {
            const itemsList = purchases.map(p => `• **${p.item_name}** — ${p.price.toLocaleString()} 🪙`).join('\n');
            embed.addFields({ name: '🛒 ' + t('inventory.purchasedItems', lang), value: itemsList, inline: false });
        } else {
            embed.addFields({ name: '🛒 ' + t('inventory.itemsLabel', lang), value: t('inventory.noItemsPurchased', lang), inline: false });
        }
    } catch (e) {
        embed.addFields({ name: '🛒 ' + t('inventory.itemsLabel', lang), value: t('inventory.noItemsPurchased', lang), inline: false });
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('inv_shop').setLabel(t('inventory.viewStore', lang)).setStyle(ButtonStyle.Primary).setEmoji('🛒'),
        new ButtonBuilder().setCustomId('inv_refresh').setLabel(t('inventory.refresh', lang)).setStyle(ButtonStyle.Secondary).setEmoji('🔄')
    );

    const sent = await message.reply({ embeds: [embed], components: [row] }).catch(() => null);
    if (!sent) return;

    const collector = sent.createMessageComponentCollector({ filter: (i) => i.user.id === userId, time: 60000 });
    collector.on('collect', async (i) => {
        await i.deferUpdate().catch(() => {});
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
