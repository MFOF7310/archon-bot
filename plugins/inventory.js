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
        empty: '📭 Your neural inventory is empty.',
        emptyHint: 'Visit the shop to acquire upgrades!',
        balance: 'Balance',
        level: 'Level',
        items: 'Items',
        emptyTitle: '📭 EMPTY INVENTORY',
        emptyDesc: 'Your neural storage contains no active items.',
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
        types: {
            consumable: 'Consumable',
            role: 'Role',
            badge: 'Badge',
            boost: 'Boost',
            permanent: 'Permanent'
        },
        stats: '📊 STATISTICS',
        totalValue: 'Total Value',
        estimatedValue: 'Estimated Value',
        mostValuable: 'Most Valuable',
        none: 'None'
    },
    fr: {
        title: '═ INVENTAIRE NEURAL ═',
        empty: '📭 Votre inventaire neural est vide.',
        emptyHint: 'Visitez la boutique pour acquérir des améliorations !',
        balance: 'Solde',
        level: 'Niveau',
        items: 'Articles',
        emptyTitle: '📭 INVENTAIRE VIDE',
        emptyDesc: 'Votre stockage neural ne contient aucun article actif.',
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
        types: {
            consumable: 'Consommable',
            role: 'Rôle',
            badge: 'Badge',
            boost: 'Boost',
            permanent: 'Permanent'
        },
        stats: '📊 STATISTIQUES',
        totalValue: 'Valeur Totale',
        estimatedValue: 'Valeur Estimée',
        mostValuable: 'Le Plus Précieux',
        none: 'Aucun'
    }
};

module.exports = {
    name: 'inventory',
    aliases: ['inv', 'items', 'storage', 'stockage'],
    description: '📦 View and manage your neural inventory items.',
    category: 'ECONOMY',
    usage: '.inventory [page]',
    cooldown: 2000,
    examples: ['.inventory', '.inv 2'],

    // ✅ NEW SIGNATURE: 6 parameters with usedCommand
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        
        // 🔥 NEURAL LANGUAGE BRIDGE - Alias-based detection!
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, 'en')
            : 'en';
        const t = inventoryTranslations[lang];
        
        const version = client.version || '1.6.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        
        const userId = message.author.id;
        const userName = message.author.username;
        const avatarURL = message.author.displayAvatarURL({ dynamic: true, size: 256 });
        
        const page = parseInt(args[0]) || 1;
        const itemsPerPage = 5;
        
        // ================= DATABASE CLEANUP (Expired Items) =================
        const now = Math.floor(Date.now() / 1000);
        db.prepare(`
            UPDATE user_inventory 
            SET active = 0 
            WHERE expires_at IS NOT NULL AND expires_at > 0 AND expires_at < ? AND active = 1
        `).run(now);
        
        // 🔥 HIGH-SPEED DATA BRIDGE - RAM-first cache!
        let userData = client.getUserData 
            ? client.getUserData(userId) 
            : db.prepare(`SELECT credits, xp, level FROM users WHERE id = ?`).get(userId);
        
        if (!userData) {
            db.prepare(`INSERT INTO users (id, username, xp, level, credits) VALUES (?, ?, 0, 1, 0)`)
                .run(userId, userName);
            userData = { credits: 0, xp: 0, level: 1 };
            
            if (client.getUserData && client.cacheUserData) {
                client.cacheUserData(userId, userData);
            }
        }
        
        const balance = userData.credits || 0;
        const userLevel = userData.level || calculateLevel(userData.xp || 0);
        const userRank = getRank(userLevel);
        
        // ================= GET INVENTORY =================
        const inventory = db.prepare(`
            SELECT 
                item_id, 
                quantity, 
                purchased_at, 
                expires_at,
                active
            FROM user_inventory 
            WHERE user_id = ? AND active = 1
            ORDER BY 
                CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END,
                expires_at ASC,
                purchased_at DESC
        `).all(userId);
        
        // Get global shop items for details
        const shopItems = client.shopItems || [];
        const itemsMap = new Map(shopItems.map(item => [item.id, item]));
        
        // Enrich inventory with item details
        const enrichedInventory = inventory.map(invItem => {
            const itemDetails = itemsMap.get(invItem.item_id) || {
                emoji: '📦',
                en: { name: invItem.item_id, desc: 'Unknown item' },
                fr: { name: invItem.item_id, desc: 'Article inconnu' },
                type: 'consumable',
                price: 0
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
        
        const totalItems = enrichedInventory.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
        const currentPage = Math.min(page, totalPages);
        
        const pageItems = enrichedInventory.slice(
            (currentPage - 1) * itemsPerPage, 
            currentPage * itemsPerPage
        );
        
        // Calculate inventory statistics
        const totalValue = enrichedInventory.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const mostValuable = enrichedInventory.length > 0 
            ? enrichedInventory.reduce((max, item) => item.price > max.price ? item : max, enrichedInventory[0])
            : null;
        
        // ================= BUILD EMBED =================
        const inventoryEmbed = new EmbedBuilder()
            .setColor(userRank.color)
            .setAuthor({ name: `${userRank.emoji} ${userName}'s Inventory`, iconURL: avatarURL })
            .setTitle(t.title)
            .setThumbnail(avatarURL);
        
        if (totalItems === 0) {
            inventoryEmbed
                .setDescription(`**${t.emptyTitle}**\n\n${t.emptyDesc}\n\n💡 *${t.emptyHint}*`)
                .addFields(
                    { name: `💰 ${t.balance}`, value: `\`${balance.toLocaleString()}\` Credits`, inline: true },
                    { name: `📊 ${t.level}`, value: `\`${userLevel}\` (${userRank.title[lang]})`, inline: true }
                );
        } else {
            let description = t.itemCount(totalItems) + '\n\n';
            
            pageItems.forEach((item, index) => {
                const itemNumber = (currentPage - 1) * itemsPerPage + index + 1;
                const expiresText = item.expires_at 
                    ? `<t:${item.expires_at}:R>`
                    : t.permanent;
                
                description += `**${itemNumber}. ${item.emoji} ${item.name}**\n`;
                description += `└─ ${t.quantity}: **${item.quantity}** | ${t.category}: **${t.types[item.type] || item.type}**\n`;
                description += `└─ ${t.expires}: ${expiresText}\n`;
                if (item.usable) {
                    description += `└─ 💎 ${t.useItem}: ✅ Available\n`;
                }
                description += `\n`;
            });
            
            if (totalItems > itemsPerPage) {
                description += `\n📄 **Page ${currentPage}/${totalPages}**`;
            }
            
            inventoryEmbed.setDescription(description);
            
            // Statistics field
            inventoryEmbed.addFields(
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
        
        inventoryEmbed
            .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
            .setTimestamp();
        
        // ================= BUILD BUTTONS =================
        const components = [];
        
        // Item selection menu (if items exist)
        if (pageItems.length > 0) {
            const usableItems = pageItems.filter(item => item.usable);
            
            if (usableItems.length > 0) {
                const itemOptions = usableItems.map((item, idx) => ({
                    label: `${item.emoji} ${item.name}`.substring(0, 100),
                    description: `${t.quantity}: ${item.quantity} | ${item.desc}`.substring(0, 100),
                    value: `use_${item.item_id}`
                }));
                
                const useMenu = new StringSelectMenuBuilder()
                    .setCustomId('inventory_use')
                    .setPlaceholder(t.useItem + '...')
                    .addOptions(itemOptions.slice(0, 25)); // Discord limit
                
                components.push(new ActionRowBuilder().addComponents(useMenu));
            }
        }
        
        // Navigation buttons
        const navRow = new ActionRowBuilder();
        
        if (totalPages > 1) {
            navRow.addComponents(
                new ButtonBuilder()
                    .setCustomId('inv_prev')
                    .setLabel('◀')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === 1),
                new ButtonBuilder()
                    .setCustomId('inv_page')
                    .setLabel(`${currentPage}/${totalPages}`)
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('inv_next')
                    .setLabel('▶')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === totalPages)
            );
        }
        
        components.push(navRow);
        
        // Action buttons
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('inv_shop')
                    .setLabel(t.shop)
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🛒'),
                new ButtonBuilder()
                    .setCustomId('inv_refresh')
                    .setLabel(t.refresh)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔄')
            );
        
        components.push(actionRow);
        
        const reply = await message.reply({ 
            embeds: [inventoryEmbed], 
            components: components 
        });
        
        // ================= COLLECTOR =================
        const collector = reply.createMessageComponentCollector({ time: 120000 });
        
        collector.on('collect', async (i) => {
            if (i.user.id !== userId) {
                return i.reply({ content: t.accessDenied, ephemeral: true });
            }
            
            // Handle Shop Button - 🔗 BRIDGE TO SHOP
            if (i.customId === 'inv_shop') {
                await i.deferUpdate();
                collector.stop();
                await reply.delete().catch(() => {});
                
                const shopCmd = client.commands.get('shop');
                if (shopCmd) {
                    return await shopCmd.run(client, message, [], db, serverSettings, usedCommand);
                }
                return;
            }
            
            // Handle Refresh Button
            if (i.customId === 'inv_refresh') {
                const freshUserData = client.getUserData 
                    ? client.getUserData(userId) 
                    : db.prepare(`SELECT credits, xp, level FROM users WHERE id = ?`).get(userId);
                
                const freshInventory = db.prepare(`
                    SELECT item_id, quantity, purchased_at, expires_at, active
                    FROM user_inventory 
                    WHERE user_id = ? AND active = 1
                    ORDER BY purchased_at DESC
                `).all(userId);
                
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
                
                const freshRank = getRank(freshUserData?.level || calculateLevel(freshUserData?.xp || 0));
                
                const refreshedEmbed = new EmbedBuilder()
                    .setColor(freshRank.color)
                    .setAuthor({ name: `${freshRank.emoji} ${userName}'s Inventory`, iconURL: avatarURL })
                    .setTitle(t.title)
                    .setThumbnail(avatarURL);
                
                if (freshTotal === 0) {
                    refreshedEmbed
                        .setDescription(`**${t.emptyTitle}**\n\n${t.emptyDesc}\n\n💡 *${t.emptyHint}*`)
                        .addFields(
                            { name: `💰 ${t.balance}`, value: `\`${(freshUserData?.credits || 0).toLocaleString()}\` Credits`, inline: true },
                            { name: `📊 ${t.level}`, value: `\`${freshUserData?.level || 1}\` (${freshRank.title[lang]})`, inline: true }
                        );
                } else {
                    let desc = t.itemCount(freshTotal) + '\n\n';
                    
                    freshEnriched.slice(0, 5).forEach((item, index) => {
                        const expiresText = item.expires_at ? `<t:${item.expires_at}:R>` : t.permanent;
                        desc += `**${index + 1}. ${item.emoji} ${item.name}**\n`;
                        desc += `└─ ${t.quantity}: **${item.quantity}** | ${t.category}: **${t.types[item.type] || item.type}**\n`;
                        desc += `└─ ${t.expires}: ${expiresText}\n\n`;
                    });
                    
                    refreshedEmbed.setDescription(desc);
                    refreshedEmbed.addFields(
                        { name: `💰 ${t.balance}`, value: `\`${(freshUserData?.credits || 0).toLocaleString()}\` Credits`, inline: true },
                        { name: `📊 ${t.level}`, value: `\`${freshUserData?.level || 1}\` (${freshRank.title[lang]})`, inline: true },
                        { name: `📦 ${t.items}`, value: `\`${freshTotal}\` Total`, inline: true },
                        { 
                            name: `💎 ${t.stats}`, 
                            value: `\`\`\`yaml\n${t.totalValue}: ${freshValue.toLocaleString()} 🪙\n${t.mostValuable}: ${freshMostValuable?.name || t.none}\n\`\`\``, 
                            inline: false 
                        }
                    );
                }
                
                refreshedEmbed
                    .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                    .setTimestamp();
                
                await i.update({ embeds: [refreshedEmbed] });
                return;
            }
            
            // Handle pagination
            if (i.customId === 'inv_prev' || i.customId === 'inv_next') {
                const newPage = i.customId === 'inv_prev' ? currentPage - 1 : currentPage + 1;
                
                const navPageItems = enrichedInventory.slice(
                    (newPage - 1) * itemsPerPage, 
                    newPage * itemsPerPage
                );
                
                let navDescription = t.itemCount(totalItems) + '\n\n';
                
                navPageItems.forEach((item, index) => {
                    const itemNumber = (newPage - 1) * itemsPerPage + index + 1;
                    const expiresText = item.expires_at ? `<t:${item.expires_at}:R>` : t.permanent;
                    
                    navDescription += `**${itemNumber}. ${item.emoji} ${item.name}**\n`;
                    navDescription += `└─ ${t.quantity}: **${item.quantity}** | ${t.category}: **${t.types[item.type] || item.type}**\n`;
                    navDescription += `└─ ${t.expires}: ${expiresText}\n`;
                    if (item.usable) {
                        navDescription += `└─ 💎 ${t.useItem}: ✅ Available\n`;
                    }
                    navDescription += `\n`;
                });
                
                navDescription += `\n📄 **Page ${newPage}/${totalPages}**`;
                
                const navEmbed = new EmbedBuilder()
                    .setColor(userRank.color)
                    .setAuthor({ name: `${userRank.emoji} ${userName}'s Inventory`, iconURL: avatarURL })
                    .setTitle(t.title)
                    .setDescription(navDescription)
                    .setThumbnail(avatarURL)
                    .addFields(
                        { name: `💰 ${t.balance}`, value: `\`${balance.toLocaleString()}\` Credits`, inline: true },
                        { name: `📊 ${t.level}`, value: `\`${userLevel}\` (${userRank.title[lang]})`, inline: true },
                        { name: `📦 ${t.items}`, value: `\`${totalItems}\` Total`, inline: true },
                        { 
                            name: `💎 ${t.stats}`, 
                            value: `\`\`\`yaml\n${t.totalValue}: ${totalValue.toLocaleString()} 🪙\n${t.mostValuable}: ${mostValuable?.name || t.none}\n\`\`\``, 
                            inline: false 
                        }
                    )
                    .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                    .setTimestamp();
                
                // Rebuild components for new page
                const newComponents = [];
                
                const newUsableItems = navPageItems.filter(item => item.usable);
                if (newUsableItems.length > 0) {
                    const newItemOptions = newUsableItems.map((item) => ({
                        label: `${item.emoji} ${item.name}`.substring(0, 100),
                        description: `${t.quantity}: ${item.quantity} | ${item.desc}`.substring(0, 100),
                        value: `use_${item.item_id}`
                    }));
                    
                    const newUseMenu = new StringSelectMenuBuilder()
                        .setCustomId('inventory_use')
                        .setPlaceholder(t.useItem + '...')
                        .addOptions(newItemOptions.slice(0, 25));
                    
                    newComponents.push(new ActionRowBuilder().addComponents(newUseMenu));
                }
                
                const newNavRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder().setCustomId('inv_prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(newPage === 1),
                        new ButtonBuilder().setCustomId('inv_page').setLabel(`${newPage}/${totalPages}`).setStyle(ButtonStyle.Primary).setDisabled(true),
                        new ButtonBuilder().setCustomId('inv_next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(newPage === totalPages)
                    );
                newComponents.push(newNavRow);
                
                const newActionRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder().setCustomId('inv_shop').setLabel(t.shop).setStyle(ButtonStyle.Success).setEmoji('🛒'),
                        new ButtonBuilder().setCustomId('inv_refresh').setLabel(t.refresh).setStyle(ButtonStyle.Primary).setEmoji('🔄')
                    );
                newComponents.push(newActionRow);
                
                await i.update({ embeds: [navEmbed], components: newComponents });
                return;
            }
            
            // Handle Use Item
            if (i.isStringSelectMenu() && i.customId === 'inventory_use') {
                const selectedValue = i.values[0];
                const itemId = selectedValue.replace('use_', '');
                
                const itemToUse = enrichedInventory.find(item => item.item_id === itemId);
                
                if (!itemToUse || !itemToUse.usable) {
                    return i.reply({ content: t.cannotUse, ephemeral: true });
                }
                
                // Apply item effect
                const itemDetails = itemsMap.get(itemId);
                
                if (itemDetails?.effect) {
                    const currentData = client.getUserData 
                        ? client.getUserData(userId) 
                        : db.prepare(`SELECT credits, xp FROM users WHERE id = ?`).get(userId);
                    
                    const bonusXP = itemDetails.effect.xp || 0;
                    const bonusCredits = itemDetails.effect.credits || 0;
                    
                    // 🔥 BATCH UPDATE
                    if (client.queueUserUpdate) {
                        client.queueUserUpdate(userId, {
                            credits: (currentData?.credits || 0) + bonusCredits,
                            xp: (currentData?.xp || 0) + bonusXP,
                            username: userName
                        });
                    } else {
                        db.prepare(`UPDATE users SET credits = credits + ?, xp = xp + ? WHERE id = ?`)
                            .run(bonusCredits, bonusXP, userId);
                    }
                    
                    // Decrease quantity or remove
                    if (itemToUse.quantity > 1) {
                        db.prepare(`UPDATE user_inventory SET quantity = quantity - 1 WHERE user_id = ? AND item_id = ?`)
                            .run(userId, itemId);
                    } else {
                        db.prepare(`UPDATE user_inventory SET active = 0 WHERE user_id = ? AND item_id = ?`)
                            .run(userId, itemId);
                    }
                    
                    const successMsg = t.useSuccess.replace('{item}', itemToUse.name);
                    await i.reply({ 
                        content: `${successMsg}\n${bonusXP > 0 ? `✨ +${bonusXP} XP\n` : ''}${bonusCredits > 0 ? `💰 +${bonusCredits} Credits` : ''}`, 
                        ephemeral: true 
                    });
                    
                    // Refresh display
                    setTimeout(async () => {
                        const invCmd = client.commands.get('inventory');
                        if (invCmd) {
                            await reply.delete().catch(() => {});
                            await invCmd.run(client, message, [], db, serverSettings, usedCommand);
                        }
                    }, 1000);
                }
            }
        });
        
        collector.on('end', async () => {
            const disabledComponents = components.map(row => {
                const newRow = new ActionRowBuilder();
                row.components.forEach(comp => {
                    const disabledComp = ButtonBuilder.from(comp).setDisabled(true);
                    newRow.addComponents(disabledComp);
                });
                return newRow;
            });
            
            await reply.edit({ components: disabledComponents }).catch(() => {});
        });
    }
};