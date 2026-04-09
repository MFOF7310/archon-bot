const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        title: '📦 NEURAL INVENTORY',
        empty: '📭 INVENTORY EMPTY',
        emptyDesc: 'Your neural inventory contains no items.',
        shopTip: 'Visit `.shop` to purchase upgrades and items!',
        stats: '📊 INVENTORY STATS',
        totalItems: 'Total Items',
        activeBoosts: 'Active Boosts',
        permanentItems: 'Permanent Items',
        categories: {
            all: '📦 All Items',
            consumable: '⚡ Consumables',
            role: '🎖️ Roles',
            badge: '🏅 Badges',
            boost: '📈 Boosts',
            permanent: '🌟 Permanent',
            unknown: '❓ Unknown'
        },
        itemType: 'Type',
        quantity: 'Quantity',
        purchased: 'Purchased',
        expires: 'Expires',
        permanent: 'Permanent',
        expired: 'EXPIRED',
        active: 'ACTIVE',
        use: 'Use Item',
        usePlaceholder: 'Select an item to use...',
        useSuccess: '✅ Item Used!',
        useSuccessDesc: (item, effect) => `**${item}** activated!\n${effect}`,
        useNoEffect: 'This item has no immediate effect.',
        useError: '❌ Could not use this item.',
        refresh: '🔄 Refresh',
        shop: '🛒 Shop',
        page: 'Page',
        accessDenied: '❌ This menu is not yours.',
        unknownItem: '⚠️ Unknown Item (ID: {id})',
        unknownItemHint: 'This item may be from an older version.',
        footer: 'ARCHITECT CG-223 • Neural Inventory System'
    },
    fr: {
        title: '📦 INVENTAIRE NEURAL',
        empty: '📭 INVENTAIRE VIDE',
        emptyDesc: 'Votre inventaire neural ne contient aucun objet.',
        shopTip: 'Visitez `.boutique` pour acheter des améliorations !',
        stats: '📊 STATISTIQUES',
        totalItems: 'Total Objets',
        activeBoosts: 'Boosts Actifs',
        permanentItems: 'Objets Permanents',
        categories: {
            all: '📦 Tous',
            consumable: '⚡ Consommables',
            role: '🎖️ Rôles',
            badge: '🏅 Badges',
            boost: '📈 Boosts',
            permanent: '🌟 Permanents',
            unknown: '❓ Inconnu'
        },
        itemType: 'Type',
        quantity: 'Quantité',
        purchased: 'Acheté',
        expires: 'Expire',
        permanent: 'Permanent',
        expired: 'EXPIRÉ',
        active: 'ACTIF',
        use: 'Utiliser',
        usePlaceholder: 'Sélectionnez un objet à utiliser...',
        useSuccess: '✅ Objet Utilisé !',
        useSuccessDesc: (item, effect) => `**${item}** activé !\n${effect}`,
        useNoEffect: 'Cet objet n\'a pas d\'effet immédiat.',
        useError: '❌ Impossible d\'utiliser cet objet.',
        refresh: '🔄 Actualiser',
        shop: '🛒 Boutique',
        page: 'Page',
        accessDenied: '❌ Ce menu ne vous appartient pas.',
        unknownItem: '⚠️ Objet Inconnu (ID: {id})',
        unknownItemHint: 'Cet objet provient peut-être d\'une ancienne version.',
        footer: 'ARCHITECT CG-223 • Système d\'Inventaire Neural'
    }
};

// ================= UNIFIED LEVEL CALCULATION =================
function calculateLevel(xp) {
    return Math.floor(0.1 * Math.sqrt(xp)) + 1;
}

// ================= FORMAT TIME REMAINING =================
function formatTimeRemaining(expiresAt, lang) {
    if (!expiresAt) return translations[lang].permanent;
    
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = expiresAt - now;
    
    if (timeLeft <= 0) return translations[lang].expired;
    
    const days = Math.floor(timeLeft / 86400);
    const hours = Math.floor((timeLeft % 86400) / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    
    if (days > 0) return `${days} ${lang === 'fr' ? 'jours' : 'days'}`;
    if (hours > 0) return `${hours} ${lang === 'fr' ? 'heures' : 'hours'}`;
    return `${minutes} ${lang === 'fr' ? 'minutes' : 'minutes'}`;
}

// ================= USE ITEM FUNCTION =================
function useItem(userId, itemId, db, lang, itemDefs) {
    const t = translations[lang];
    const itemDef = itemDefs[itemId];
    
    if (!itemDef || !itemDef.usable) {
        return { success: false, message: t.useNoEffect };
    }
    
    const inventoryItem = db.prepare(`
        SELECT quantity, active FROM user_inventory 
        WHERE user_id = ? AND item_id = ? AND active = 1
    `).get(userId, itemId);
    
    if (!inventoryItem || inventoryItem.quantity < 1) {
        return { success: false, message: lang === 'fr' ? 'Objet non disponible.' : 'Item not available.' };
    }
    
    let effectMessage = '';
    let xpGained = 0;
    let creditsGained = 0;
    
    const userDataBefore = db.prepare(`SELECT xp, level FROM users WHERE id = ?`).get(userId);
    const oldXP = userDataBefore?.xp || 0;
    const oldLevel = userDataBefore?.level || calculateLevel(oldXP) || 1;
    
    if (itemDef.effect) {
        if (itemDef.effect.xp) {
            xpGained = itemDef.effect.xp;
            db.prepare(`UPDATE users SET xp = COALESCE(xp, 0) + ? WHERE id = ?`).run(xpGained, userId);
            effectMessage += `+${xpGained} XP\n`;
        }
        if (itemDef.effect.credits) {
            creditsGained = itemDef.effect.credits;
            db.prepare(`UPDATE users SET credits = COALESCE(credits, 0) + ? WHERE id = ?`).run(creditsGained, userId);
            effectMessage += `+${creditsGained.toLocaleString()} 🪙\n`;
        }
    }
    
    if (inventoryItem.quantity > 1) {
        db.prepare(`UPDATE user_inventory SET quantity = quantity - 1 WHERE user_id = ? AND item_id = ?`)
            .run(userId, itemId);
    } else {
        db.prepare(`DELETE FROM user_inventory WHERE user_id = ? AND item_id = ?`)
            .run(userId, itemId);
    }
    
    const userDataAfter = db.prepare(`SELECT xp FROM users WHERE id = ?`).get(userId);
    const newXP = userDataAfter?.xp || 0;
    const newLevel = calculateLevel(newXP);
    
    if (newLevel > oldLevel) {
        db.prepare(`UPDATE users SET level = ? WHERE id = ?`).run(newLevel, userId);
        effectMessage += `\n🎉 ${lang === 'fr' ? 'NIVEAU' : 'LEVEL'} ${oldLevel} → ${newLevel}!`;
    }
    
    return {
        success: true,
        message: effectMessage || t.useNoEffect,
        xpGained,
        creditsGained,
        leveledUp: newLevel > oldLevel,
        newLevel: newLevel > oldLevel ? newLevel : null
    };
}

// ================= CREATE USE ITEM MENU =================
function createUseItemMenu(items, lang, itemDefs) {
    const t = translations[lang];
    
    const usableItems = items.filter(item => {
        const def = itemDefs[item.item_id];
        return def && def.usable && item.active === 1 && def.type === 'consumable';
    });
    
    if (usableItems.length === 0) {
        return null;
    }
    
    const options = usableItems.slice(0, 25).map(item => {
        const def = itemDefs[item.item_id];
        return {
            label: `${def.emoji} ${def.name[lang] || def.name.en}`.substring(0, 100),
            description: `${t.quantity}: ${item.quantity}`.substring(0, 100),
            value: item.item_id
        };
    });
    
    return new StringSelectMenuBuilder()
        .setCustomId('inventory_use')
        .setPlaceholder(t.usePlaceholder)
        .addOptions(options);
}

// ================= CREATE INVENTORY EMBED =================
function createInventoryEmbed(items, category, page, totalPages, stats, lang, client, user, guildName, itemDefs) {
    const t = translations[lang];
    const version = client.version || '1.5.0';
    
    let filteredItems = items;
    if (category !== 'all') {
        filteredItems = items.filter(item => item.type === category);
    }
    
    const pageSize = 5;
    const start = page * pageSize;
    const pageItems = filteredItems.slice(start, start + pageSize);
    
    let description = '';
    
    if (pageItems.length === 0) {
        description = lang === 'fr' 
            ? '*Aucun objet dans cette catégorie.*' 
            : '*No items in this category.*';
    } else {
        for (const item of pageItems) {
            const def = itemDefs[item.item_id];
            
            if (!def) {
                description += `**❓ ${t.unknownItem.replace('{id}', item.item_id)}**\n`;
                description += `└─ 📦 ${t.quantity}: ${item.quantity || 1}\n`;
                description += `└─ ⚠️ ${t.unknownItemHint}\n\n`;
                continue;
            }
            
            const status = item.active === 1 ? `🟢 ${t.active}` : `🔴 ${t.expired}`;
            const expiration = item.expires_at 
                ? `${formatTimeRemaining(item.expires_at, lang)}` 
                : t.permanent;
            
            description += `**${def.emoji} ${def.name[lang] || def.name.en}**\n`;
            description += `└─ 📦 ${t.quantity}: ${item.quantity || 1}\n`;
            description += `└─ ⏰ ${expiration}\n`;
            description += `└─ 📅 ${t.purchased}: <t:${item.purchased_at}:R>\n`;
            description += `└─ ${status}\n\n`;
        }
    }
    
    const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setAuthor({ 
            name: `${t.title} • ${user.username.toUpperCase()}`, 
            iconURL: user.displayAvatarURL() 
        })
        .setTitle(`${t.categories[category] || category}`)
        .setDescription(description || t.emptyDesc)
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 512 }))
        .addFields(
            { 
                name: t.stats, 
                value: `\`\`\`yaml\n${t.totalItems}: ${stats.total}\n${t.activeBoosts}: ${stats.activeBoosts}\n${t.permanentItems}: ${stats.permanent}\`\`\``, 
                inline: true 
            }
        )
        .setFooter({ 
            text: `${guildName} • ${t.footer} • ${t.page} ${page + 1}/${Math.max(1, totalPages)} • v${version}`,
            iconURL: client.user.displayAvatarURL()
        })
        .setTimestamp();
    
    return { embed, pageItems };
}

// ================= CREATE CATEGORY SELECT MENU =================
function createCategoryMenu(lang, currentCategory) {
    const t = translations[lang];
    
    return new StringSelectMenuBuilder()
        .setCustomId('inventory_category')
        .setPlaceholder(lang === 'fr' ? 'Filtrer par catégorie...' : 'Filter by category...')
        .addOptions([
            { label: t.categories.all, value: 'all', emoji: '📦', default: currentCategory === 'all' },
            { label: t.categories.consumable, value: 'consumable', emoji: '⚡', default: currentCategory === 'consumable' },
            { label: t.categories.role, value: 'role', emoji: '🎖️', default: currentCategory === 'role' },
            { label: t.categories.badge, value: 'badge', emoji: '🏅', default: currentCategory === 'badge' },
            { label: t.categories.boost, value: 'boost', emoji: '📈', default: currentCategory === 'boost' },
            { label: t.categories.permanent, value: 'permanent', emoji: '🌟', default: currentCategory === 'permanent' }
        ]);
}

// ================= MAIN COMMAND =================
module.exports = {
    name: 'inventory',
    aliases: ['inv', 'items', 'backpack', 'inventaire', 'objets', 'sac'],
    description: '📦 View and use your neural inventory items.',
    category: 'ECONOMY',
    cooldown: 3000,
    usage: '.inventory [category]',
    examples: ['.inventory', '.inv consumable', '.items boost'],

    run: async (client, message, args, database, serverSettings) => {
        
        const lang = serverSettings?.language || 'en';
        const t = translations[lang];
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        
        const userId = message.author.id;
        const db = database;
        
        // ================= USE GLOBAL ITEM DEFINITIONS FROM CLIENT =================
        const itemDefs = client.getItemDefinitions ? client.getItemDefinitions() : {};
        
        console.log('[INVENTORY DEBUG] Item definitions loaded:', Object.keys(itemDefs).length);
        
        // ================= DATABASE CLEANUP =================
        const now = Math.floor(Date.now() / 1000);
        db.prepare(`
            UPDATE user_inventory 
            SET active = 0 
            WHERE expires_at IS NOT NULL AND expires_at > 0 AND expires_at < ? AND active = 1
        `).run(now);
        
        // ================= REFRESH FUNCTION =================
        const refreshInventory = () => {
            const items = db.prepare(`
                SELECT item_id, quantity, purchased_at, expires_at, active
                FROM user_inventory 
                WHERE user_id = ?
                ORDER BY active DESC, purchased_at DESC
            `).all(userId);
            
            const enrichedItems = items.map(item => {
                const def = itemDefs[item.item_id];
                return { 
                    ...item, 
                    type: def?.type || 'unknown',
                    hasDefinition: !!def
                };
            });
            
            const stats = {
                total: items.length,
                activeBoosts: enrichedItems.filter(i => i.active === 1 && (i.type === 'boost' || i.type === 'consumable')).length,
                permanent: enrichedItems.filter(i => i.type === 'permanent' || i.type === 'role' || i.type === 'badge').length
            };
            
            return { items, enrichedItems, stats };
        };
        
        let { items, enrichedItems, stats } = refreshInventory();
        
        console.log('[INVENTORY DEBUG] Items found:', items.length);
        
        // ================= EMPTY INVENTORY =================
        if (items.length === 0) {
            const emptyEmbed = new EmbedBuilder()
                .setColor('#95a5a6')
                .setAuthor({ name: t.empty, iconURL: message.author.displayAvatarURL() })
                .setDescription(`${t.emptyDesc}\n\n💡 **${t.shopTip}**`)
                .setFooter({ 
                    text: `${guildName} • ${t.footer} • v${client.version || '1.5.0'}`,
                    iconURL: message.guild?.iconURL() || client.user.displayAvatarURL()
                })
                .setTimestamp();
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('inv_goto_shop').setLabel(t.shop).setStyle(ButtonStyle.Success).setEmoji('🛒')
            );
            
            const reply = await message.reply({ embeds: [emptyEmbed], components: [row] });
            
            const collector = reply.createMessageComponentCollector({ time: 30000 });
            
            collector.on('collect', async (i) => {
                if (i.user.id !== userId) {
                    return i.reply({ content: t.accessDenied, ephemeral: true });
                }
                if (i.customId === 'inv_goto_shop') {
                    await i.deferUpdate();
                    collector.stop();
                    await reply.delete().catch(() => {});
                    
                    const shopCmd = client.commands.get('shop');
                    if (shopCmd) {
                        return await shopCmd.run(client, message, [], db, serverSettings);
                    }
                }
            });
            
            return;
        }
        
        // ================= DETERMINE CATEGORY =================
        let category = 'all';
        const categoryArg = args[0]?.toLowerCase();
        const validCategories = ['all', 'consumable', 'role', 'badge', 'boost', 'permanent'];
        if (categoryArg && validCategories.includes(categoryArg)) {
            category = categoryArg;
        }
        
        // ================= PAGINATION =================
        const filteredItems = category === 'all' 
            ? enrichedItems 
            : enrichedItems.filter(i => i.type === category);
        
        const pageSize = 5;
        const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
        let currentPage = 0;
        
        // ================= CREATE INITIAL VIEW =================
        const { embed, pageItems } = createInventoryEmbed(
            enrichedItems, category, currentPage, totalPages, stats, lang, client, message.author, guildName, itemDefs
        );
        
        const categoryMenu = createCategoryMenu(lang, category);
        const menuRow = new ActionRowBuilder().addComponents(categoryMenu);
        
        const components = [menuRow];
        
        const useMenu = createUseItemMenu(pageItems, lang, itemDefs);
        if (useMenu) {
            components.push(new ActionRowBuilder().addComponents(useMenu));
            console.log('[INVENTORY DEBUG] Use menu created with items');
        }
        
        const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('inv_prev').setEmoji('◀').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
            new ButtonBuilder().setCustomId('inv_next').setEmoji('▶').setStyle(ButtonStyle.Secondary).setDisabled(currentPage >= totalPages - 1),
            new ButtonBuilder().setCustomId('inv_refresh').setLabel(t.refresh).setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
            new ButtonBuilder().setCustomId('inv_shop').setLabel(t.shop).setStyle(ButtonStyle.Success).setEmoji('🛒')
        );
        components.push(buttonRow);
        
        const reply = await message.reply({ embeds: [embed], components });
        
        // ================= COLLECTOR =================
        const collector = reply.createMessageComponentCollector({ 
            time: 180000 
        });
        
        collector.on('collect', async (i) => {
            console.log('[INVENTORY DEBUG] Interaction received:', i.customId);
            
            if (i.user.id !== userId) {
                return i.reply({ content: t.accessDenied, ephemeral: true });
            }
            
            // Handle Shop Button
            if (i.customId === 'inv_shop') {
                await i.deferUpdate();
                collector.stop();
                await reply.delete().catch(() => {});
                
                const shopCmd = client.commands.get('shop');
                if (shopCmd) {
                    return await shopCmd.run(client, message, [], db, serverSettings);
                }
                return;
            }
            
            // Handle Use Item (StringSelectMenu)
            if (i.customId === 'inventory_use') {
                const itemId = i.values[0];
                console.log('[INVENTORY DEBUG] Using item:', itemId);
                
                const result = useItem(userId, itemId, db, lang, itemDefs);
                
                if (result.success) {
                    const itemDef = itemDefs[itemId];
                    const successEmbed = new EmbedBuilder()
                        .setColor('#2ecc71')
                        .setAuthor({ name: t.useSuccess, iconURL: message.author.displayAvatarURL() })
                        .setTitle(`${itemDef.emoji} ${itemDef.name[lang] || itemDef.name.en}`)
                        .setDescription(t.useSuccessDesc(itemDef.name[lang] || itemDef.name.en, result.message))
                        .setFooter({ 
                            text: `${guildName} • ${t.footer} • v${client.version || '1.5.0'}`,
                            iconURL: message.guild?.iconURL() || client.user.displayAvatarURL()
                        })
                        .setTimestamp();
                    
                    await i.reply({ embeds: [successEmbed], ephemeral: true });
                    
                    // Refresh inventory
                    const refreshed = refreshInventory();
                    items = refreshed.items;
                    enrichedItems = refreshed.enrichedItems;
                    stats = refreshed.stats;
                } else {
                    return i.reply({ content: result.message || t.useError, ephemeral: true });
                }
            }
            
            // Handle Category Selection
            if (i.customId === 'inventory_category') {
                category = i.values[0];
                currentPage = 0;
            }
            
            // Handle Button Navigation
            if (i.customId === 'inv_prev') currentPage--;
            if (i.customId === 'inv_next') currentPage++;
            if (i.customId === 'inv_refresh') {
                const refreshed = refreshInventory();
                items = refreshed.items;
                enrichedItems = refreshed.enrichedItems;
                stats = refreshed.stats;
            }
            
            // Recalculate filtered items and pages
            const updatedFiltered = category === 'all' 
                ? enrichedItems 
                : enrichedItems.filter(i => i.type === category);
            const updatedTotalPages = Math.max(1, Math.ceil(updatedFiltered.length / pageSize));
            currentPage = Math.max(0, Math.min(currentPage, updatedTotalPages - 1));
            
            // Create new embed and components
            const { embed: newEmbed, pageItems: newPageItems } = createInventoryEmbed(
                enrichedItems, category, currentPage, updatedTotalPages, stats, lang, client, message.author, guildName, itemDefs
            );
            
            const newComponents = [];
            newComponents.push(new ActionRowBuilder().addComponents(createCategoryMenu(lang, category)));
            
            const newUseMenu = createUseItemMenu(newPageItems, lang, itemDefs);
            if (newUseMenu) {
                newComponents.push(new ActionRowBuilder().addComponents(newUseMenu));
            }
            
            const newButtonRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('inv_prev').setEmoji('◀').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
                new ButtonBuilder().setCustomId('inv_next').setEmoji('▶').setStyle(ButtonStyle.Secondary).setDisabled(currentPage >= updatedTotalPages - 1),
                new ButtonBuilder().setCustomId('inv_refresh').setLabel(t.refresh).setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
                new ButtonBuilder().setCustomId('inv_shop').setLabel(t.shop).setStyle(ButtonStyle.Success).setEmoji('🛒')
            );
            newComponents.push(newButtonRow);
            
            await i.update({ embeds: [newEmbed], components: newComponents });
        });
        
        collector.on('end', async (collected, reason) => {
            if (reason === 'messageDeleted') return;
            
            const disabledComponents = [];
            disabledComponents.push(new ActionRowBuilder().addComponents(createCategoryMenu(lang, category).setDisabled(true)));
            
            const disabledButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('inv_prev').setEmoji('◀').setStyle(ButtonStyle.Secondary).setDisabled(true),
                new ButtonBuilder().setCustomId('inv_next').setEmoji('▶').setStyle(ButtonStyle.Secondary).setDisabled(true),
                new ButtonBuilder().setCustomId('inv_refresh').setLabel(t.refresh).setStyle(ButtonStyle.Secondary).setDisabled(true),
                new ButtonBuilder().setCustomId('inv_shop').setLabel(t.shop).setStyle(ButtonStyle.Success).setDisabled(true)
            );
            disabledComponents.push(disabledButtons);
            
            await reply.edit({ components: disabledComponents }).catch(() => {});
        });
    }
};