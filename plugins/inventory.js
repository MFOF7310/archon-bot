const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType } = require('discord.js');

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
        title: '📦 NEURAL INVENTORY',
        empty: '📭 INVENTORY EMPTY',
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
        back: '◀ Back',
        category: 'Category',
        quantity: 'Qty',
        expires: 'Expires',
        permanent: 'Permanent',
        useSuccess: '✅ **{item}** activated!',
        useError: '❌ Could not use this item.',
        accessDenied: '❌ This inventory is not yours.',
        footer: 'ARCHITECT CG-223 • Neural Storage',
        types: { consumable: 'Consumable', role: 'Role', badge: 'Badge', boost: 'Boost', permanent: 'Permanent' },
        stats: '📊 STATISTICS',
        totalValue: 'Total Value',
        mostValuable: 'Most Valuable',
        none: 'None',
        loading: '🔍 Loading inventory...',
        page: 'Page',
        of: 'of',
        usable: '✅ Available'
    },
    fr: {
        title: '📦 INVENTAIRE NEURAL',
        empty: '📭 INVENTAIRE VIDE',
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
        back: '◀ Retour',
        category: 'Catégorie',
        quantity: 'Qté',
        expires: 'Expire',
        permanent: 'Permanent',
        useSuccess: '✅ **{item}** activé !',
        useError: '❌ Impossible d\'utiliser cet article.',
        accessDenied: '❌ Cet inventaire ne vous appartient pas.',
        footer: 'ARCHITECT CG-223 • Stockage Neural',
        types: { consumable: 'Consommable', role: 'Rôle', badge: 'Badge', boost: 'Boost', permanent: 'Permanent' },
        stats: '📊 STATISTIQUES',
        totalValue: 'Valeur Totale',
        mostValuable: 'Le Plus Précieux',
        none: 'Aucun',
        loading: '🔍 Chargement de l\'inventaire...',
        page: 'Page',
        of: 'sur',
        usable: '✅ Disponible'
    }
};

module.exports = {
    name: 'inventory',
    aliases: ['inv', 'items', 'storage', 'stockage', 'sac'],
    description: '📦 View and manage your neural inventory items.',
    category: 'ECONOMY',
    usage: '.inventory',
    cooldown: 2000,
    examples: ['.inventory', '.inv'],

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        
        // 🔥 NEURAL LANGUAGE BRIDGE
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, serverSettings?.language || 'en')
            : (serverSettings?.language || 'en');
        const t = inventoryTranslations[lang];
        
        const version = client.version || '1.6.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        
        const userId = message.author.id;
        const userName = message.author.username;
        const avatarURL = message.author.displayAvatarURL({ dynamic: true, size: 256 });
        
        const itemsPerPage = 5;
        let currentPage = 1;
        
        // ================= HELPER: GET FRESH DATA =================
        const getFreshData = () => {
            const now = Math.floor(Date.now() / 1000);
            db.prepare(`UPDATE user_inventory SET active = 0 WHERE expires_at IS NOT NULL AND expires_at > 0 AND expires_at < ? AND active = 1`).run(now);
            
            const userData = db.prepare(`SELECT credits, xp, level FROM users WHERE id = ?`).get(userId);
            if (!userData) {
                db.prepare(`INSERT INTO users (id, username, xp, level, credits) VALUES (?, ?, 0, 1, 0)`).run(userId, userName);
                return { credits: 0, xp: 0, level: 1, inventory: [] };
            }
            
            const inventory = db.prepare(`
                SELECT item_id, quantity, purchased_at, expires_at, active
                FROM user_inventory WHERE user_id = ? AND active = 1
                ORDER BY CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END, expires_at ASC, purchased_at DESC
            `).all(userId);
            
            return { ...userData, inventory };
        };
        
        // ================= ENRICH INVENTORY =================
        const enrichInventory = (inventory) => {
            const shopItems = client.shopItems || [];
            const itemsMap = new Map(shopItems.map(item => [item.id, item]));
            
            return inventory.map(invItem => {
                const itemDetails = itemsMap.get(invItem.item_id) || {
                    emoji: '📦', type: 'consumable', price: 0,
                    en: { name: invItem.item_id, desc: 'Unknown item' },
                    fr: { name: invItem.item_id, desc: 'Article inconnu' }
                };
                return {
                    ...invItem,
                    emoji: itemDetails.emoji,
                    name: itemDetails[lang]?.name || itemDetails.en.name,
                    desc: itemDetails[lang]?.desc || itemDetails.en.desc,
                    type: itemDetails.type,
                    price: itemDetails.price,
                    usable: itemDetails.type === 'consumable' || itemDetails.type === 'boost'
                };
            });
        };
        
        // ================= BUILD EMBED =================
        const buildEmbed = (data, page) => {
            const { credits, xp, level, inventory } = data;
            const enriched = enrichInventory(inventory);
            const totalItems = enriched.length;
            const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
            const currentPage = Math.min(page, totalPages);
            const pageItems = enriched.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
            
            const totalValue = enriched.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const mostValuable = enriched.length > 0 
                ? enriched.reduce((max, item) => item.price > max.price ? item : max, enriched[0])
                : null;
            
            const userRank = getRank(level || calculateLevel(xp || 0));
            
            const embed = new EmbedBuilder()
                .setColor(userRank.color)
                .setAuthor({ name: `${userRank.emoji} ${userName}`, iconURL: avatarURL })
                .setTitle(t.title)
                .setThumbnail(avatarURL)
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            
            if (totalItems === 0) {
                embed.setDescription(`### ${t.empty}\n*${t.emptyDesc}*\n\n💡 **${t.emptyHint}**`);
                embed.addFields(
                    { name: `💰 ${t.balance}`, value: `\`${credits.toLocaleString()}\` 🪙`, inline: true },
                    { name: `📊 ${t.level}`, value: `\`${level || 1}\` (${userRank.title[lang]})`, inline: true }
                );
                return { embed, pageItems: [], totalPages: 1, currentPage: 1, totalItems: 0 };
            }
            
            let description = t.itemCount(totalItems) + '\n\n';
            pageItems.forEach((item, index) => {
                const itemNumber = (currentPage - 1) * itemsPerPage + index + 1;
                const expiresText = item.expires_at ? `<t:${item.expires_at}:R>` : t.permanent;
                const usableTag = item.usable ? `\n└─ 💎 ${t.usable}` : '';
                
                description += `**${itemNumber}. ${item.emoji} ${item.name}**\n`;
                description += `└─ 📦 ${t.quantity}: **${item.quantity}** | ${t.category}: **${t.types[item.type] || item.type}**\n`;
                description += `└─ ⏰ ${t.expires}: ${expiresText}${usableTag}\n\n`;
            });
            
            if (totalItems > itemsPerPage) {
                description += `\n📄 **${t.page} ${currentPage}/${totalPages}**`;
            }
            
            embed.setDescription(description);
            embed.addFields(
                { name: `💰 ${t.balance}`, value: `\`${credits.toLocaleString()}\` 🪙`, inline: true },
                { name: `📊 ${t.level}`, value: `\`${level || 1}\` (${userRank.title[lang]})`, inline: true },
                { name: `📦 ${t.items}`, value: `\`${totalItems}\` Total`, inline: true },
                { name: `💎 ${t.stats}`, value: `\`\`\`yaml\n${t.totalValue}: ${totalValue.toLocaleString()} 🪙\n${t.mostValuable}: ${mostValuable?.name || t.none}\n\`\`\``, inline: false }
            );
            
            return { embed, pageItems, totalPages, currentPage, totalItems };
        };
        
        // ================= BUILD COMPONENTS =================
        const buildComponents = (pageItems, totalPages, currentPage) => {
            const components = [];
            
            // Use Item Menu
            const usableItems = pageItems.filter(item => item.usable);
            if (usableItems.length > 0) {
                const useMenu = new StringSelectMenuBuilder()
                    .setCustomId('inv_use')
                    .setPlaceholder(t.useItem + '...')
                    .addOptions(usableItems.slice(0, 25).map(item => ({
                        label: `${item.emoji} ${item.name}`.substring(0, 100),
                        description: `${t.quantity}: ${item.quantity}`.substring(0, 100),
                        value: item.item_id,
                        emoji: item.emoji
                    })));
                components.push(new ActionRowBuilder().addComponents(useMenu));
            }
            
            // Navigation Row
            if (totalPages > 1) {
                const navRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('inv_prev').setEmoji('◀').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 1),
                    new ButtonBuilder().setCustomId('inv_page').setLabel(`${currentPage}/${totalPages}`).setStyle(ButtonStyle.Primary).setDisabled(true),
                    new ButtonBuilder().setCustomId('inv_next').setEmoji('▶').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === totalPages)
                );
                components.push(navRow);
            }
            
            // Action Row
            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('inv_shop').setLabel(t.shop).setStyle(ButtonStyle.Success).setEmoji('🛒'),
                new ButtonBuilder().setCustomId('inv_refresh').setLabel(t.refresh).setStyle(ButtonStyle.Primary).setEmoji('🔄')
            );
            components.push(actionRow);
            
            return components;
        };
        
        // ================= INITIAL DISPLAY =================
        const initialData = getFreshData();
        const { embed, pageItems, totalPages, totalItems } = buildEmbed(initialData, currentPage);
        const components = buildComponents(pageItems, totalPages, currentPage);
        
        const reply = await message.reply({ content: `> ${t.loading}`, embeds: [embed], components });
        
        // ================= COLLECTOR =================
        const collector = reply.createMessageComponentCollector({ time: 180000 });
        
        collector.on('collect', async (i) => {
            if (i.user.id !== userId) {
                return i.reply({ content: t.accessDenied, ephemeral: true });
            }
            
            // Shop Button
            if (i.customId === 'inv_shop') {
                await i.deferUpdate();
                collector.stop();
                await reply.delete().catch(() => {});
                const shopCmd = client.commands.get('shop');
                if (shopCmd) return shopCmd.run(client, message, [], db, serverSettings, usedCommand);
                return;
            }
            
            // Refresh Button
            if (i.customId === 'inv_refresh') {
                const freshData = getFreshData();
                const { embed: freshEmbed, pageItems: freshItems, totalPages: freshPages } = buildEmbed(freshData, currentPage);
                const freshComponents = buildComponents(freshItems, freshPages, currentPage);
                return i.update({ embeds: [freshEmbed], components: freshComponents });
            }
            
            // Pagination
            if (i.customId === 'inv_prev' || i.customId === 'inv_next') {
                currentPage = i.customId === 'inv_prev' ? currentPage - 1 : currentPage + 1;
                const navData = getFreshData();
                const { embed: navEmbed, pageItems: navItems, totalPages: navPages } = buildEmbed(navData, currentPage);
                const navComponents = buildComponents(navItems, navPages, currentPage);
                return i.update({ embeds: [navEmbed], components: navComponents });
            }
            
            // Use Item
            if (i.isStringSelectMenu() && i.customId === 'inv_use') {
                const itemId = i.values[0];
                const freshData = getFreshData();
                const enriched = enrichInventory(freshData.inventory);
                const itemToUse = enriched.find(item => item.item_id === itemId);
                
                if (!itemToUse || !itemToUse.usable) {
                    return i.reply({ content: t.cannotUse, ephemeral: true });
                }
                
                const shopItems = client.shopItems || [];
                const itemDetails = shopItems.find(si => si.id === itemId);
                
                if (itemDetails?.effect) {
                    const bonusXP = itemDetails.effect.xp || 0;
                    const bonusCredits = itemDetails.effect.credits || 0;
                    
                    db.prepare(`UPDATE users SET credits = credits + ?, xp = xp + ? WHERE id = ?`).run(bonusCredits, bonusXP, userId);
                    
                    if (itemToUse.quantity > 1) {
                        db.prepare(`UPDATE user_inventory SET quantity = quantity - 1 WHERE user_id = ? AND item_id = ?`).run(userId, itemId);
                    } else {
                        db.prepare(`UPDATE user_inventory SET active = 0 WHERE user_id = ? AND item_id = ?`).run(userId, itemId);
                    }
                    
                    await i.reply({ 
                        content: `✅ **${itemToUse.name}** activated!\n${bonusXP > 0 ? `✨ +${bonusXP} XP\n` : ''}${bonusCredits > 0 ? `💰 +${bonusCredits} Credits` : ''}`, 
                        ephemeral: true 
                    });
                    
                    const updatedData = getFreshData();
                    const { embed: updatedEmbed, pageItems: updatedItems, totalPages: updatedPages } = buildEmbed(updatedData, currentPage);
                    const updatedComponents = buildComponents(updatedItems, updatedPages, currentPage);
                    return i.message.edit({ embeds: [updatedEmbed], components: updatedComponents });
                }
            }
        });
        
        collector.on('end', async () => {
            const disabledComponents = components.map(row => {
                const newRow = new ActionRowBuilder();
                row.components.forEach(comp => {
                    if (comp instanceof ButtonBuilder) newRow.addComponents(ButtonBuilder.from(comp).setDisabled(true));
                    if (comp instanceof StringSelectMenuBuilder) newRow.addComponents(StringSelectMenuBuilder.from(comp).setDisabled(true));
                });
                return newRow;
            }).filter(row => row.components.length > 0);
            await reply.edit({ components: disabledComponents }).catch(() => {});
        });
    }
};