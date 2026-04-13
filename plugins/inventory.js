const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

// ================= UNIFIED LEVEL CALCULATION =================
function calculateLevel(xp) { 
    return Math.floor(0.1 * Math.sqrt(xp)) + 1; 
}

// ================= AGENT RANKS =================
const AGENT_RANKS = [
    { minLevel: 1, maxLevel: 5, title: { fr: "RECRUE NEURALE", en: "NEURAL RECRUIT" }, color: "#2ecc71", emoji: "🌱" },
    { minLevel: 6, maxLevel: 15, title: { fr: "AGENT DE TERRAIN", en: "FIELD AGENT" }, color: "#3498db", emoji: "🔹" },
    { minLevel: 16, maxLevel: 30, title: { fr: "SPÉCIALISTE CYBER", en: "CYBER SPECIALIST" }, color: "#9b59b6", emoji: "💠" },
    { minLevel: 31, maxLevel: 50, title: { fr: "COMMANDANT BKO", en: "BKO COMMANDER" }, color: "#e67e22", emoji: "⚜️" },
    { minLevel: 51, maxLevel: Infinity, title: { fr: "ARCHITECTE SYSTÈME", en: "SYSTEM ARCHITECT" }, color: "#e74c3c", emoji: "👑" }
];

function getRank(level) {
    return AGENT_RANKS.find(r => level >= r.minLevel && level <= r.maxLevel) || AGENT_RANKS[AGENT_RANKS.length - 1];
}

// ================= INVENTORY TRANSLATIONS =================
const inventoryTranslations = {
    en: {
        title: '═ NEURAL INVENTORY ═',
        emptyTitle: '📭 EMPTY INVENTORY',
        emptyDesc: 'Your neural storage contains no active items.',
        emptyHint: 'Visit the shop to acquire upgrades!',
        balance: 'Balance',
        level: 'Level',
        items: 'Items',
        itemCount: (count) => `📦 **${count}** Item${count !== 1 ? 's' : ''} in Storage`,
        useItem: 'Use Item',
        cannotUse: 'Cannot be used',
        shop: '🛒 Shop',
        refresh: '🔄 Refresh',
        category: 'Category',
        quantity: 'Qty',
        expires: 'Expires',
        permanent: 'Permanent',
        useSuccess: '✅ **{item}** activated!',
        useError: '❌ Could not use this item.',
        accessDenied: '❌ This inventory is not yours.',
        footer: 'ARCHITECT CG-223 • Neural Storage',
        loadingShop: '⚡ Loading shop...',
        types: { consumable: 'Consumable', role: 'Role', badge: 'Badge', boost: 'Boost', permanent: 'Permanent' },
        stats: '📊 STATISTICS',
        totalValue: 'Total Value',
        mostValuable: 'Most Valuable',
        none: 'None',
        refreshing: '🔄 Syncing with Neural Ledger...',
        verifyBalance: 'Verify with .bal or .credits'
    },
    fr: {
        title: '═ INVENTAIRE NEURAL ═',
        emptyTitle: '📭 INVENTAIRE VIDE',
        emptyDesc: 'Votre stockage neural ne contient aucun article actif.',
        emptyHint: 'Visitez la boutique pour acquérir des améliorations !',
        balance: 'Solde',
        level: 'Niveau',
        items: 'Articles',
        itemCount: (count) => `📦 **${count}** Article${count !== 1 ? 's' : ''} en Stock`,
        useItem: 'Utiliser',
        cannotUse: 'Non utilisable',
        shop: '🛒 Boutique',
        refresh: '🔄 Actualiser',
        category: 'Catégorie',
        quantity: 'Qté',
        expires: 'Expire',
        permanent: 'Permanent',
        useSuccess: '✅ **{item}** activé !',
        useError: '❌ Impossible d\'utiliser cet article.',
        accessDenied: '❌ Cet inventaire ne vous appartient pas.',
        footer: 'ARCHITECT CG-223 • Stockage Neural',
        loadingShop: '⚡ Chargement de la boutique...',
        types: { consumable: 'Consommable', role: 'Rôle', badge: 'Badge', boost: 'Boost', permanent: 'Permanent' },
        stats: '📊 STATISTIQUES',
        totalValue: 'Valeur Totale',
        mostValuable: 'Le Plus Précieux',
        none: 'Aucun',
        refreshing: '🔄 Synchronisation avec le Registre Neural...',
        verifyBalance: 'Vérifiez avec .bal ou .credits'
    }
};

module.exports = {
    name: 'inventory',
    aliases: ['inv', 'items', 'storage', 'stockage', 'backpack'],
    description: '📦 View and manage your neural inventory items.',
    category: 'ECONOMY',
    usage: '.inventory',
    cooldown: 2000,
    examples: ['.inventory'],

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
        const t = inventoryTranslations[lang];
        const version = client.version || '1.7.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        const userId = message.author.id;
        const userName = message.author.username;
        const avatarURL = message.author.displayAvatarURL({ dynamic: true, size: 256 });
        
        const now = Math.floor(Date.now() / 1000);
        db.prepare(`UPDATE user_inventory SET active = 0 WHERE expires_at IS NOT NULL AND expires_at > 0 AND expires_at < ? AND active = 1`).run(now);
        
        // 🔥 FORCE WAL SYNC before reading
        try { db.prepare("PRAGMA wal_checkpoint(TRUNCATE)").run(); } catch (e) {}
        if (client.userDataCache) client.userDataCache.delete(userId);
        
        const userData = db.prepare(`SELECT credits, xp, level FROM users WHERE id = ?`).get(userId);
        
        if (!userData) {
            db.prepare(`INSERT INTO users (id, username, xp, level, credits) VALUES (?, ?, 0, 1, 0)`).run(userId, userName);
            const emptyEmbed = new EmbedBuilder()
                .setColor('#95a5a6')
                .setAuthor({ name: `${userName}'s Inventory`, iconURL: avatarURL })
                .setTitle(t.emptyTitle)
                .setDescription(`${t.emptyDesc}\n\n💡 *${t.emptyHint}*`)
                .addFields(
                    { name: `💰 ${t.balance}`, value: `\`0\` Credits`, inline: true },
                    { name: `📊 ${t.level}`, value: `\`1\` (🌱 NEURAL RECRUIT)`, inline: true }
                )
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            
            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('inv_shop').setLabel(t.shop).setStyle(ButtonStyle.Success).setEmoji('🛒')
            );
            return message.reply({ embeds: [emptyEmbed], components: [actionRow] }).catch(() => {});
        }
        
        const balance = userData.credits || 0;
        const userLevel = userData.level || calculateLevel(userData.xp || 0);
        const userRank = getRank(userLevel);
        
        const inventory = db.prepare(`
            SELECT item_id, quantity, purchased_at, expires_at, active 
            FROM user_inventory 
            WHERE user_id = ? AND active = 1
            ORDER BY purchased_at DESC
        `).all(userId);
        
        const shopItems = client.shopItems || [];
        const itemsMap = new Map(shopItems.map(item => [item.id, item]));
        
        const enrichedInventory = inventory.map(invItem => {
            const itemDetails = itemsMap.get(invItem.item_id) || { 
                emoji: '📦', 
                en: { name: invItem.item_id }, 
                fr: { name: invItem.item_id }, 
                type: 'consumable', 
                price: 0 
            };
            return {
                ...invItem,
                emoji: itemDetails.emoji,
                name: itemDetails[lang]?.name || itemDetails.en.name,
                type: itemDetails.type,
                price: itemDetails.price,
                usable: itemDetails.type === 'consumable' || itemDetails.type === 'boost'
            };
        });
        
        const totalItems = enrichedInventory.length;
        const totalValue = enrichedInventory.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const mostValuable = enrichedInventory.length > 0 
            ? enrichedInventory.reduce((max, item) => item.price > max.price ? item : max, enrichedInventory[0])
            : null;
        
        const inventoryEmbed = new EmbedBuilder()
            .setColor(userRank.color)
            .setAuthor({ name: `${userRank.emoji} ${userName}'s Inventory`, iconURL: avatarURL })
            .setTitle(t.title)
            .setThumbnail(avatarURL);
        
        if (totalItems === 0) {
            inventoryEmbed.setDescription(`**${t.emptyTitle}**\n\n${t.emptyDesc}\n\n💡 *${t.emptyHint}*`)
                .addFields(
                    { name: `💰 ${t.balance}`, value: `\`${balance.toLocaleString()}\` Credits`, inline: true },
                    { name: `📊 ${t.level}`, value: `\`${userLevel}\` (${userRank.title[lang]})`, inline: true }
                );
        } else {
            let description = t.itemCount(totalItems) + '\n\n';
            
            enrichedInventory.slice(0, 10).forEach((item, index) => {
                const expiresText = item.expires_at ? `<t:${item.expires_at}:R>` : t.permanent;
                description += `**${index + 1}. ${item.emoji} ${item.name}**\n`;
                description += `└─ ${t.quantity}: **${item.quantity}** | ${t.category}: **${t.types[item.type] || item.type}**\n`;
                description += `└─ ${t.expires}: ${expiresText}\n\n`;
            });
            
            if (totalItems > 10) {
                description += `*...and ${totalItems - 10} more items*\n\n`;
            }
            
            description += `---\n💡 **${t.verifyBalance}**\n`;
            
            inventoryEmbed.setDescription(description)
                .addFields(
                    { name: `💰 ${t.balance}`, value: `\`${balance.toLocaleString()}\` Credits`, inline: true },
                    { name: `📊 ${t.level}`, value: `\`${userLevel}\` (${userRank.title[lang]})`, inline: true },
                    { name: `📦 ${t.items}`, value: `\`${totalItems}\` Total`, inline: true },
                    { 
                        name: `💎 ${t.stats}`, 
                        value: `\`\`\`yaml\n${t.totalValue}: ${totalValue.toLocaleString()} 🪙\n${t.mostValuable}: ${mostValuable?.name || t.none}\n\`\`\``, 
                        inline: false 
                    }
                );
        }
        
        inventoryEmbed.setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon }).setTimestamp();
        
        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('inv_shop').setLabel(t.shop).setStyle(ButtonStyle.Success).setEmoji('🛒'),
            new ButtonBuilder().setCustomId('inv_refresh').setLabel(t.refresh).setStyle(ButtonStyle.Primary).setEmoji('🔄')
        );
        
        const reply = await message.reply({ embeds: [inventoryEmbed], components: [actionRow] }).catch(() => {});
        if (!reply) return;
        
        const collector = reply.createMessageComponentCollector({ time: 120000 });
        
        collector.on('collect', async (i) => {
            if (i.user.id !== userId) {
                return i.reply({ content: t.accessDenied, ephemeral: true }).catch(() => {});
            }
            
            if (!i.deferred && !i.replied) {
                try { await i.deferUpdate(); } catch (e) {}
            }
            
            if (i.customId === 'inv_shop') {
                collector.stop();
                await i.editReply({ content: t.loadingShop, embeds: [], components: [] }).catch(() => {});
                setTimeout(() => i.deleteReply().catch(() => {}), 500);
                const shopCmd = client.commands.get('shop');
                if (shopCmd) return await shopCmd.run(client, message, [], db, serverSettings, 'shop');
                return;
            }
            
            if (i.customId === 'inv_refresh') {
                await i.editReply({ content: t.refreshing, embeds: [], components: [] }).catch(() => {});
                
                // 🔥 FORCE WAL SYNC + CACHE INVALIDATION
                try { db.prepare("PRAGMA wal_checkpoint(TRUNCATE)").run(); } catch (e) {}
                if (client.userDataCache) client.userDataCache.delete(userId);
                
                const freshUserData = db.prepare(`SELECT credits, xp, level FROM users WHERE id = ?`).get(userId);
                const freshInventory = db.prepare(`
                    SELECT item_id, quantity, purchased_at, expires_at, active 
                    FROM user_inventory 
                    WHERE user_id = ? AND active = 1
                    ORDER BY purchased_at DESC
                `).all(userId);
                
                const freshBalance = freshUserData?.credits || 0;
                const freshLevel = freshUserData?.level || calculateLevel(freshUserData?.xp || 0);
                const freshRank = getRank(freshLevel);
                
                const freshEnriched = freshInventory.map(invItem => {
                    const itemDetails = itemsMap.get(invItem.item_id) || { 
                        emoji: '📦', 
                        en: { name: invItem.item_id }, 
                        fr: { name: invItem.item_id }, 
                        type: 'consumable', 
                        price: 0 
                    };
                    return {
                        ...invItem,
                        emoji: itemDetails.emoji,
                        name: itemDetails[lang]?.name || itemDetails.en.name,
                        type: itemDetails.type,
                        price: itemDetails.price,
                        usable: itemDetails.type === 'consumable' || itemDetails.type === 'boost'
                    };
                });
                
                const freshTotal = freshEnriched.length;
                const freshValue = freshEnriched.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                const freshMostValuable = freshEnriched.length > 0 
                    ? freshEnriched.reduce((max, item) => item.price > max.price ? item : max, freshEnriched[0])
                    : null;
                
                const refreshedEmbed = new EmbedBuilder()
                    .setColor(freshRank.color)
                    .setAuthor({ name: `${freshRank.emoji} ${userName}'s Inventory`, iconURL: avatarURL })
                    .setTitle(t.title)
                    .setThumbnail(avatarURL);
                
                if (freshTotal === 0) {
                    refreshedEmbed.setDescription(`**${t.emptyTitle}**\n\n${t.emptyDesc}\n\n💡 *${t.emptyHint}*`)
                        .addFields(
                            { name: `💰 ${t.balance}`, value: `\`${freshBalance.toLocaleString()}\` Credits`, inline: true },
                            { name: `📊 ${t.level}`, value: `\`${freshLevel}\` (${freshRank.title[lang]})`, inline: true }
                        );
                } else {
                    let description = t.itemCount(freshTotal) + '\n\n';
                    
                    freshEnriched.slice(0, 10).forEach((item, index) => {
                        const expiresText = item.expires_at ? `<t:${item.expires_at}:R>` : t.permanent;
                        description += `**${index + 1}. ${item.emoji} ${item.name}**\n`;
                        description += `└─ ${t.quantity}: **${item.quantity}** | ${t.category}: **${t.types[item.type] || item.type}**\n`;
                        description += `└─ ${t.expires}: ${expiresText}\n\n`;
                    });
                    
                    if (freshTotal > 10) description += `*...and ${freshTotal - 10} more items*\n\n`;
                    description += `---\n💡 **${t.verifyBalance}**\n`;
                    
                    refreshedEmbed.setDescription(description)
                        .addFields(
                            { name: `💰 ${t.balance}`, value: `\`${freshBalance.toLocaleString()}\` Credits`, inline: true },
                            { name: `📊 ${t.level}`, value: `\`${freshLevel}\` (${freshRank.title[lang]})`, inline: true },
                            { name: `📦 ${t.items}`, value: `\`${freshTotal}\` Total`, inline: true },
                            { 
                                name: `💎 ${t.stats}`, 
                                value: `\`\`\`yaml\n${t.totalValue}: ${freshValue.toLocaleString()} 🪙\n${t.mostValuable}: ${freshMostValuable?.name || t.none}\n\`\`\``, 
                                inline: false 
                            }
                        );
                }
                
                refreshedEmbed.setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon }).setTimestamp();
                await i.editReply({ content: null, embeds: [refreshedEmbed], components: [actionRow] }).catch(() => {});
                return;
            }
        });
        
        collector.on('end', async () => {
            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('inv_shop').setLabel(t.shop).setStyle(ButtonStyle.Success).setDisabled(true).setEmoji('🛒'),
                new ButtonBuilder().setCustomId('inv_refresh').setLabel(t.refresh).setStyle(ButtonStyle.Primary).setDisabled(true).setEmoji('🔄')
            );
            await reply.edit({ components: [disabledRow] }).catch(() => {});
        });
    }
};