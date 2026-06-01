const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');

const shopTranslations = {
    en: {
        title: '**⚡ NEURAL SHOP BAMAKO**', subtitle: 'Available Credits:', recentBought: 'Bought by', mostBought: 'Most Bought',
        item: 'ITEM', cost: 'COST', type: 'TYPE', totalPurchases: 'Total Purchases', purchaseHistory: 'PURCHASE HISTORY',
        mostBoughtItems: 'MOST BOUGHT ITEMS', viewInventory: 'VIEW INVENTORY', buyItem: 'BUY AN ITEM',
        footer: 'NEURAL SHOP BAMAKO', description: 'Items available in the Neural Shop',
        itemNotFound: '❌ **ITEM NOT FOUND**\n*This item doesn\'t exist in the catalog.*',
        insufficientCredits: '❌ **INSUFFICIENT CREDITS**\n*You need **{cost} 🪙** but have **{bal} 🪙**.*',
        itemBought: '✅ **ITEM PURCHASED!**',
        buyTitle: 'BUY ITEM',
        usage: 'Usage: \`\`.buy <item-id>\`\`',
        itemAlreadyOwned: '❌ **ITEM ALREADY OWNED!**\n*You already have this item in your inventory.*',
        yourInventory: 'YOUR INVENTORY', yourCredits: 'Your Credits', sell: 'SELL',
        sellTitle: 'SELL ITEM', sellDesc: 'Sell an item from your inventory.', sellSuccess: '✅ **ITEM SOLD!**',
        sellProfit: 'Profit', youEarned: 'You earned', use: 'USE', equip: 'EQUIP', activate: 'ACTIVATE',
        insufficientFunds: '❌ **INSUFFICIENT FUNDS!**\n*Required: **{cost} 🪙***',
        viewStore: '🛒 VIEW SHOP', viewMarket: '📈 VIEW MARKET', myInventory: '🎒 MY INVENTORY',
        upgradeNow: 'UPGRADE NOW', heroText: (name) => `Hey **${name}**, discover the neural marketplace!`,
        earnMore: 'EARN MORE', quickNav: 'QUICK NAVIGATION', limited: '⏰ LIMITED OFFER', supportTitle: '💬 SUPPORT',
        storeTab: '🛒 SHOP', inventoryTab: '🎒 INVENTORY', buyTab: '💰 BUY', sellTab: '💸 SELL', supportTab: '💬 SUPPORT',
        itemLimitReached: '❌ **LIMIT REACHED**\n*You can only hold **{limit}** of this item.*', itemLimit: 3,
        thanksForBuying: (name, emoji) => `**${name}** bought **${emoji}**! Check it out!`,
        boughtNotification: '**{user}** just bought **{item}** from the shop!',
        shopAnnounceChannel: 'SHOP_ANNOUNCE_CHANNEL_ID',
        successDesc: (emoji, name, desc) => `*${emoji} **${name}** — ${desc}*`,
        transactionError: '❌ **TRANSACTION ERROR**\n*Please try again later.*',
        welcomeMsg: '**Welcome to the Neural Shop!** Browse the catalog and upgrade your arsenal.',
        heroDescription: (name) => `**${name}**, explore the **Neural Shop** for exclusive items, upgrades, and power-ups!`,
        pageCounter: 'PAGE {current}/{total}', backBtn: '⬅️ BACK', nextBtn: 'NEXT ➡️',
        categoryFilter: '📂 CATEGORY', priceFilter: '💰 PRICE', sortFilter: '🔀 SORT',
        premiumLabel: '💎 PREMIUM', newLabel: '🆕 NEW', hotLabel: '🔥 HOT', saleLabel: '💥 SALE',
        featuredSection: 'FEATURED ITEMS', recommendedSection: 'RECOMMENDED FOR YOU',
        viewDetails: 'VIEW DETAILS', quickBuy: 'QUICK BUY', preview: '👁️ PREVIEW',
        levelRequired: 'Level {level} Required', xpRequired: '{xp} XP Required',
        marketStatus: 'MARKET STATUS', balanceLabel: 'BALANCE', creditValue: '1 🪙 = {value}',
        shopError: '❌ **SHOP ERROR**\n*An error occurred. Please try again.*',
        useCommand: 'Use \`.buy <item-id>\`', heroImage: 'https://i.imgur.com/shop_hero.png',
        heroTitle: '🛒 NEURAL SHOP BAMAKO', heroSubtitle: '**Bamako\'s Premier Neural Marketplace**',
        heroDescription2: 'Upgrade your arsenal with exclusive items, power-ups, and neural enhancements.',
        stats: 'Stats', server: 'SERVER', members: 'Members', date: 'DATE', refresh: '🔄 REFRESH',
        verifyBalance: 'Verify your balance with .bal or .credits', marketTitle: '📊 NEURAL MARKET',
        marketSubtitle: 'Market Trends', limitedOffers: '⏰ LIMITED OFFERS',
        premiumItems: '💎 PREMIUM ITEMS', upcomingItems: '🆕 UPCOMING ITEMS', marketTrend: '📈 Market Trend',
        marketMultiplier: 'Multiplier', marketNextUpdate: 'Next Update', marketStable: '📊 Stable',
        marketBull: '📈 Bull', marketBear: '📉 Bear', marketVolatile: '🌪️ Volatile',
        serverStatus: '🖥️ Server Status', serverOnline: '🟢 Online', serverMaintenance: '🟠 Maintenance',
        lastUpdated: '🕒 Last Updated', shopVersion: '🛒 Shop Version', shopV: 'v2.0'
    },
    fr: {
        title: '**⚡ BOUTIQUE NEURALE BAMAKO**', subtitle: 'Crédits Disponibles :', recentBought: 'Acheté par', mostBought: 'Plus Acheté',
        item: 'ARTICLE', cost: 'COÛT', type: 'TYPE', totalPurchases: 'Achats Totaux', purchaseHistory: 'HISTORIQUE DES ACHATS',
        mostBoughtItems: 'ARTICLES LES PLUS ACHETÉS', viewInventory: 'VOIR INVENTAIRE', buyItem: 'ACHETER UN ARTICLE',
        footer: 'BOUTIQUE NEURALE BAMAKO', description: 'Articles disponibles dans la Boutique Neurale',
        itemNotFound: '❌ **ARTICLE INTROUVABLE**\n*Cet article n\'existe pas dans le catalogue.*',
        insufficientCredits: '❌ **CRÉDITS INSUFFISANTS**\n*Il faut **{cost} 🪙**, vous avez **{bal} 🪙**.*',
        itemBought: '✅ **ARTICLE ACHETÉ !**',
        buyTitle: 'ACHETER ARTICLE',
        usage: 'Utilisation : \`\`.buy <item-id>\`\`',
        itemAlreadyOwned: '❌ **ARTICLE DÉJÀ POSSEDÉ !**\n*Vous avez déjà cet article.*',
        yourInventory: 'VOTRE INVENTAIRE', yourCredits: 'Vos Crédits', sell: 'VENDRE',
        sellTitle: 'VENDRE ARTICLE', sellDesc: 'Vendre un article de votre inventaire.', sellSuccess: '✅ **ARTICLE VENDU !**',
        sellProfit: 'Profit', youEarned: 'Vous avez gagné', use: 'UTILISER', equip: 'ÉQUIPER', activate: 'ACTIVER',
        insufficientFunds: '❌ **FONDS INSUFFISANTS !**\n*Requis : **{cost} 🪙***',
        viewStore: '🛒 VOIR BOUTIQUE', viewMarket: '📈 VOIR MARCHÉ', myInventory: '🎒 MON INVENTAIRE',
        upgradeNow: 'AMÉLIORER', heroText: (name) => `Salut **${name}**, découvrez le marché neural !`,
        earnMore: 'GAGNER PLUS', quickNav: 'NAVIGATION RAPIDE', limited: '⏰ OFFRE LIMITÉE', supportTitle: '💬 SUPPORT',
        storeTab: '🛒 BOUTIQUE', inventoryTab: '🎒 INVENTAIRE', buyTab: '💰 ACHETER', sellTab: '💸 VENDRE', supportTab: '💬 SUPPORT',
        itemLimitReached: '❌ **LIMITE ATTEINTE**\n*Maximum **{limit}** exemplaires.*', itemLimit: 3,
        thanksForBuying: (name, emoji) => `**${name}** a acheté **${emoji}** !`,
        boughtNotification: '**{user}** a acheté **{item}** !',
        shopAnnounceChannel: 'SHOP_ANNOUNCE_CHANNEL_ID',
        successDesc: (emoji, name, desc) => `*${emoji} **${name}** — ${desc}*`,
        transactionError: '❌ **ERREUR DE TRANSACTION**\n*Réessayez plus tard.*',
        welcomeMsg: '**Bienvenue dans la Boutique Neurale !** Parcourez le catalogue et améliorez votre arsenal.',
        heroDescription: (name) => `**${name}**, explorez la **Boutique Neurale** pour des articles exclusifs !`,
        pageCounter: 'PAGE {current}/{total}', backBtn: '⬅️ RETOUR', nextBtn: 'SUIVANT ➡️',
        categoryFilter: '📂 CATÉGORIE', priceFilter: '💰 PRIX', sortFilter: '🔀 TRI',
        premiumLabel: '💎 PREMIUM', newLabel: '🆕 NOUVEAU', hotLabel: '🔥 HOT', saleLabel: '💥 SOLDE',
        featuredSection: 'ARTICLES EN VEDETTE', recommendedSection: 'RECOMMANDÉS POUR VOUS',
        viewDetails: 'VOIR DÉTAILS', quickBuy: 'ACHAT RAPIDE', preview: '👁️ APERÇU',
        levelRequired: 'Niveau {level} Requis', xpRequired: '{xp} XP Requis',
        marketStatus: 'ÉTAT DU MARCHÉ', balanceLabel: 'SOLDE', creditValue: '1 🪙 = {value}',
        shopError: '❌ **ERREUR BOUTIQUE**\n*Une erreur est survenue. Réessayez.*',
        useCommand: 'Utilisez \`.buy <item-id>\`', heroImage: 'https://i.imgur.com/shop_hero.png',
        heroTitle: '🛒 BOUTIQUE NEURALE BAMAKO', heroSubtitle: '**La Première Place du Marché Neural de Bamako**',
        heroDescription2: 'Améliorez votre arsenal avec des articles exclusifs et des améliorations neurales.',
        stats: 'Statistiques', server: 'SERVEUR', members: 'Membres', date: 'DATE', refresh: '🔄 RAFRAÎCHIR',
        verifyBalance: 'Vérifiez votre solde avec .bal ou .credits', marketTitle: '📊 MARCHÉ NEURAL',
        marketSubtitle: 'Tendances du Marché', limitedOffers: '⏰ OFFRES LIMITÉES',
        premiumItems: '💎 ARTICLES PREMIUM', upcomingItems: '🆕 PROCHAINS ARTICLES', marketTrend: '📈 Tendance',
        marketMultiplier: 'Multiplicateur', marketNextUpdate: 'Prochaine MàJ', marketStable: '📊 Stable',
        marketBull: '📈 Bull', marketBear: '📉 Bear', marketVolatile: '🌪️ Volatile',
        serverStatus: '🖥️ État du Serveur', serverOnline: '🟢 En Ligne', serverMaintenance: '🟠 Maintenance',
        lastUpdated: '🕒 Dernière MàJ', shopVersion: '🛒 Version', shopV: 'v2.0'
    }
};

function getMarketState(guildId) { try { const mm = require('./market-manager'); return mm.getMarketState(guildId); } catch (e) { return { trend: 'STEADY', multiplier: 1.0 }; } }
function getTrend() { try { const mm = require('./market-manager'); const ms = mm.getMarketState(); return mm.TRENDS[ms.trend] || mm.TRENDS.STEADY; } catch (e) { return { emoji: '📊', name: 'Steady', color: '#f1c40f', multiplier: [0.98, 1.08] }; } }

module.exports = {
    name: 'shop', aliases: ['store', 'boutique', 'catalog', 'catalogue', 'marketplace', 'buy', 'purchase', 'acheter', 'inventory', 'inv', 'inventaire'],
    description: '🛒 Browse the Neural Shop, buy items, and manage your inventory.', category: 'ECONOMY', usage: '.shop | .buy <item-id> | .inventory',
    examples: ['.shop', '.buy starter_pack', '.inventory', '.inv sell starter_pack'], cooldown: 3000,

    data: new SlashCommandBuilder().setName('shop').setDescription('🛒 Neural Shop Bamako')
        .addSubcommand(sub => sub.setName('browse').setDescription('Browse the shop'))
        .addSubcommand(sub => sub.setName('buy').setDescription('Buy an item').addStringOption(o => o.setName('item').setDescription('Item ID').setRequired(true)))
        .addSubcommand(sub => sub.setName('inventory').setDescription('View your inventory'))
        .addSubcommand(sub => sub.setName('sell').setDescription('Sell an item').addStringOption(o => o.setName('item').setDescription('Item ID').setRequired(true))),

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
        const t = shopTranslations[lang];
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

        if (buyCmds.includes(cmd)) return handleBuy(message, args, client, db, serverSettings, lang, t, prefix, guildId, guildName, guildIcon, version);
        if (invCmds.includes(cmd)) return handleInventory(message, client, db, lang, t, prefix, guildId, guildName, guildIcon, version);
        if (sellCmds.includes(cmd)) return handleSell(message, args, client, db, lang, t, prefix, guildId, guildName, guildIcon, version);
        return handleShop(message, client, db, lang, t, prefix, guildId, guildName, guildIcon, version);
    },

    execute: async (interaction, client) => {
        const sub = interaction.options.getSubcommand();
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = shopTranslations[lang];
        const prefix = interaction.guild ? (client.getServerSettings?.(interaction.guild.id)?.prefix || '.') : '.';
        const guildId = interaction.guild?.id || 'DM';
        const guildName = interaction.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = interaction.guild?.iconURL() || client.user.displayAvatarURL();
        const version = client.version || '2.0.0';
        const serverSettings = interaction.guild ? client.getServerSettings?.(interaction.guild.id) || {} : {};

        const fakeMsg = { author: interaction.user, guild: interaction.guild, channel: interaction.channel,
            reply: async (opts) => interaction.reply({ ...opts, fetchReply: true }).catch(() => null) };

        if (sub === 'buy') return handleBuy(fakeMsg, [interaction.options.getString('item')], client, client.db, serverSettings, lang, t, prefix, guildId, guildName, guildIcon, version);
        if (sub === 'inventory') return handleInventory(fakeMsg, client, client.db, lang, t, prefix, guildId, guildName, guildIcon, version);
        if (sub === 'sell') return handleSell(fakeMsg, [interaction.options.getString('item')], client, client.db, lang, t, prefix, guildId, guildName, guildIcon, version);
        return handleShop(fakeMsg, client, client.db, lang, t, prefix, guildId, guildName, guildIcon, version);
    }
};

// ================= HANDLE SHOP =================
async function handleShop(message, client, db, lang, t, prefix, guildId, guildName, guildIcon, version) {
    const trend = getTrend();
    const userId = message.author.id;

    // PER-SERVER: Composite key lookup
    let userData = client.getUserData ? client.getUserData(userId, guildId) : db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
    if (!userData) userData = { credits: 0 };

    const items = client.shopItems || [];
    const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setAuthor({ name: `${t.heroTitle}`, iconURL: client.user.displayAvatarURL() })
        .setTitle(`${t.heroSubtitle}`)
        .setDescription(`\`\`\`yaml\n💰 ${t.subtitle} ${(userData.credits || 0).toLocaleString()} 🪙\n📈 Market: ${trend.emoji} ${trend.name}\n\`\`\``)
        .setFooter({ text: `${t.footer} • ${guildName} • v${version}`, iconURL: guildIcon })
        .setTimestamp();

    // Build shop items field
    const itemText = items.slice(0, 6).map(item => {
        const itemT = item[lang] || item.en;
        return `${item.emoji} **${itemT.name}** — ${item.price.toLocaleString()} 🪙\n> ${itemT.desc}`;
    }).join('\n\n');

    embed.addFields({ name: '🛒 **Available Items**', value: itemText || 'No items available', inline: false });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('shop_refresh').setLabel(t.refresh).setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
        new ButtonBuilder().setCustomId('shop_inv').setLabel(t.myInventory).setStyle(ButtonStyle.Primary).setEmoji('🎒')
    );

    const sent = await message.reply({ embeds: [embed], components: [row] }).catch(() => null);
    if (!sent) return;

    const collector = sent.createMessageComponentCollector({ filter: (i) => i.user.id === userId, time: 60000 });
    collector.on('collect', async (i) => {
        await i.deferUpdate().catch(() => {});
        if (i.customId === 'shop_refresh') return handleShop(message, client, db, lang, t, prefix, guildId, guildName, guildIcon, version);
        if (i.customId === 'shop_inv') return handleInventory(message, client, db, lang, t, prefix, guildId, guildName, guildIcon, version);
    });
}

// ================= HANDLE BUY =================
async function handleBuy(message, args, client, db, serverSettings, lang, t, prefix, guildId, guildName, guildIcon, version) {
    const itemId = args[0];
    if (!itemId) return message.reply(`❌ ${t.usage}`).catch(() => {});

    const item = client.shopItems ? client.shopItems.find(i => i.id === itemId) : null;
    if (!item) return message.reply(t.itemNotFound).catch(() => {});

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
        return message.reply(t.insufficientCredits.replace('{cost}', item.price.toLocaleString()).replace('{bal}', (userData.credits || 0).toLocaleString())).catch(() => {});
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
        .setAuthor({ name: `✅ ${t.itemBought}`, iconURL: message.author.displayAvatarURL() })
        .setDescription(t.successDesc(item.emoji, itemT.name, itemT.desc))
        .addFields(
            { name: '💰 ' + (lang === 'fr' ? 'Coût' : 'Cost'), value: `${item.price.toLocaleString()} 🪙`, inline: true },
            { name: '💰 ' + (lang === 'fr' ? 'Nouveau Solde' : 'New Balance'), value: `${newCredits.toLocaleString()} 🪙`, inline: true }
        )
        .setFooter({ text: `${t.footer} • ${guildName} • v${version}`, iconURL: guildIcon })
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
async function handleInventory(message, client, db, lang, t, prefix, guildId, guildName, guildIcon, version) {
    const userId = message.author.id;

    // PER-SERVER: Composite key lookup
    let userData = client.getUserData ? client.getUserData(userId, guildId) : db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
    if (!userData) userData = { credits: 0 };

    const credits = userData.credits || 0;
    const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setAuthor({ name: `🎒 ${t.yourInventory}`, iconURL: message.author.displayAvatarURL() })
        .setDescription(`**${t.yourCredits}:** ${credits.toLocaleString()} 🪙\n\n*${t.verifyBalance}*`)
        .setFooter({ text: `${t.footer} • ${guildName} • v${version}`, iconURL: guildIcon })
        .setTimestamp();

    // Display purchased items from DB
    try {
        const purchases = db.prepare("SELECT item_name, price, timestamp FROM purchases WHERE user_id = ? ORDER BY timestamp DESC LIMIT 10").all(userId);
        if (purchases && purchases.length > 0) {
            const itemsList = purchases.map(p => `• **${p.item_name}** — ${p.price.toLocaleString()} 🪙`).join('\n');
            embed.addFields({ name: '🛒 ' + (lang === 'fr' ? 'Articles Achetés' : 'Purchased Items'), value: itemsList, inline: false });
        } else {
            embed.addFields({ name: '🛒 ' + (lang === 'fr' ? 'Articles' : 'Items'), value: lang === 'fr' ? '*Aucun article acheté.*' : '*No items purchased yet.*', inline: false });
        }
    } catch (e) {
        embed.addFields({ name: '🛒 ' + (lang === 'fr' ? 'Articles' : 'Items'), value: lang === 'fr' ? '*Aucun article acheté.*' : '*No items purchased yet.*', inline: false });
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('inv_shop').setLabel(t.viewStore).setStyle(ButtonStyle.Primary).setEmoji('🛒'),
        new ButtonBuilder().setCustomId('inv_refresh').setLabel(t.refresh).setStyle(ButtonStyle.Secondary).setEmoji('🔄')
    );

    const sent = await message.reply({ embeds: [embed], components: [row] }).catch(() => null);
    if (!sent) return;

    const collector = sent.createMessageComponentCollector({ filter: (i) => i.user.id === userId, time: 60000 });
    collector.on('collect', async (i) => {
        await i.deferUpdate().catch(() => {});
        if (i.customId === 'inv_shop') return handleShop(message, client, db, lang, t, prefix, guildId, guildName, guildIcon, version);
        if (i.customId === 'inv_refresh') return handleInventory(message, client, db, lang, t, prefix, guildId, guildName, guildIcon, version);
    });
}

// ================= HANDLE SELL =================
async function handleSell(message, args, client, db, lang, t, prefix, guildId, guildName, guildIcon, version) {
    const userId = message.author.id;
    const itemId = args[0];
    if (!itemId) return message.reply(`❌ ${t.usage}`).catch(() => {});

    // Find item
    const item = client.shopItems ? client.shopItems.find(i => i.id === itemId) : null;
    if (!item) return message.reply(t.itemNotFound).catch(() => {});

    // Check ownership in purchases
    try {
        const owned = db.prepare("SELECT COUNT(*) as count FROM purchases WHERE user_id = ? AND item_id = ?").get(userId, itemId);
        if (!owned || owned.count === 0) return message.reply(lang === 'fr' ? '❌ Vous ne possédez pas cet article.' : '❌ You do not own this item.').catch(() => {});
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
        .setAuthor({ name: `💸 ${t.sellSuccess}`, iconURL: message.author.displayAvatarURL() })
        .setDescription(`**${item.emoji} ${itemT.name}** — Sold for ${sellPrice.toLocaleString()} 🪙`)
        .addFields({ name: '💰 ' + (lang === 'fr' ? 'Nouveau Solde' : 'New Balance'), value: `${newCredits.toLocaleString()} 🪙`, inline: true })
        .setFooter({ text: `${t.footer} • ${guildName} • v${version}`, iconURL: guildIcon })
        .setTimestamp();

    await message.reply({ embeds: [embed] }).catch(() => {});
}
