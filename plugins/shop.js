const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ================= UNIFIED LEVEL CALCULATION =================
function calculateLevel(xp) { 
    return Math.floor(0.1 * Math.sqrt(xp)) + 1; 
}

// --- SHOP TRANSLATIONS ---
const shopTranslations = {
    en: {
        title: '═ ARCHON NEURAL MARKETPLACE ═',
        desc: 'Exchange your earned credits for system upgrades and status symbols.',
        placeholder: 'Select an upgrade to purchase...',
        balance: 'Current Balance',
        insufficientWithAmount: (price, balance) => `❌ **Insufficient Credits!**\n└─ Required: \`${price.toLocaleString()}\` Credits\n└─ Your Balance: \`${balance.toLocaleString()}\` Credits`,
        alreadyOwned: '⚠️ You already possess this upgrade.',
        levelRequirement: (level, current) => `⚠️ **Level Requirement Not Met**\n└─ Required Level: \`${level}\`\n└─ Your Level: \`${current}\``,
        inventory: '📦 My Inventory',
        refresh: '🔄 Refresh',
        price: 'Price',
        type: 'Type',
        consumable: 'Consumable',
        role: 'Role',
        badge: 'Badge',
        boost: 'Boost',
        permanent: 'Permanent',
        level: 'Level',
        expires: 'Expires',
        permanentItem: 'Permanent',
        owned: 'OWNED',
        locked: 'LVL',
        accessDenied: '❌ These controls are locked to your session.',
        itemNotFound: '❌ Item not found.',
        purchaseError: '❌ An error occurred during purchase. Please try again.',
        footer: 'ARCHITECT CG-223 • Neural Marketplace',
        purchaseComplete: '✅ PURCHASE COMPLETE'
    },
    fr: {
        title: '═ MARCHÉ NEURAL ARCHON ═',
        desc: 'Échangez vos crédits contre des améliorations système et des symboles de statut.',
        placeholder: 'Sélectionnez une amélioration...',
        balance: 'Solde Actuel',
        insufficientWithAmount: (price, balance) => `❌ **Crédits Insuffisants!**\n└─ Requis: \`${price.toLocaleString()}\` Crédits\n└─ Votre Solde: \`${balance.toLocaleString()}\` Crédits`,
        alreadyOwned: '⚠️ Vous possédez déjà cette amélioration.',
        levelRequirement: (level, current) => `⚠️ **Niveau Requis Non Atteint**\n└─ Niveau Requis: \`${level}\`\n└─ Votre Niveau: \`${current}\``,
        inventory: '📦 Mon Inventaire',
        refresh: '🔄 Actualiser',
        price: 'Prix',
        type: 'Type',
        consumable: 'Consommable',
        role: 'Rôle',
        badge: 'Badge',
        boost: 'Boost',
        permanent: 'Permanent',
        level: 'Niveau',
        expires: 'Expire',
        permanentItem: 'Permanent',
        owned: 'POSSÉDÉ',
        locked: 'NIV',
        accessDenied: '❌ Ces commandes sont verrouillées à votre session.',
        itemNotFound: '❌ Article introuvable.',
        purchaseError: '❌ Une erreur est survenue lors de l\'achat. Veuillez réessayer.',
        footer: 'ARCHITECT CG-223 • Marché Neural',
        purchaseComplete: '✅ ACHAT RÉUSSI'
    }
};

module.exports = {
    name: 'shop',
    aliases: ['boutique', 'market', 'store', 'magasin'],
    description: '💎 Spend your Archon Credits on exclusive upgrades and system enhancements.',
    category: 'ECONOMY',
    usage: '.shop',
    cooldown: 3000,
    examples: ['.shop'],

    run: async (client, message, args, database, serverSettings) => {
        
        const lang = serverSettings?.language || 'en';
        const t = shopTranslations[lang];
        const version = client.version || '1.5.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        
        const userId = message.author.id;
        const userName = message.author.username;
        const avatarURL = message.author.displayAvatarURL({ dynamic: true, size: 256 });
        const db = database;
        
        // ================= DATABASE CLEANUP =================
        const now = Math.floor(Date.now() / 1000);
        db.prepare(`
            UPDATE user_inventory 
            SET active = 0 
            WHERE expires_at IS NOT NULL AND expires_at > 0 AND expires_at < ? AND active = 1
        `).run(now);
        
        // Ensure user exists
        let userData = db.prepare(`SELECT credits, xp FROM users WHERE id = ?`).get(userId);
        if (!userData) {
            db.prepare(`INSERT INTO users (id, username, xp, level, credits) VALUES (?, ?, 0, 1, 0)`)
                .run(userId, userName);
            userData = { credits: 0, xp: 0 };
        }
        
        const balance = userData?.credits || 0;
        const userXP = userData?.xp || 0;
        const userLevel = calculateLevel(userXP);
        
        // ================= USE GLOBAL ITEMS FROM CLIENT =================
        const shopItems = client.shopItems || [];
        
        // Get inventory
        const inventory = db.prepare(`
            SELECT item_id FROM user_inventory 
            WHERE user_id = ? AND active = 1
        `).all(userId);
        
        const ownedItems = new Set(inventory.map(i => i.item_id));
        
        // Function to refresh shop display
        const refreshShopDisplay = () => {
            const currentData = db.prepare(`SELECT credits, xp FROM users WHERE id = ?`).get(userId);
            const currentBalance = currentData?.credits || 0;
            const currentXP = currentData?.xp || 0;
            const currentLevel = calculateLevel(currentXP);
            const currentInventory = db.prepare(`SELECT item_id FROM user_inventory WHERE user_id = ? AND active = 1`).all(userId);
            const currentOwned = new Set(currentInventory.map(inv => inv.item_id));
            
            return { currentBalance, currentXP, currentLevel, currentOwned };
        };
        
        // Shop embed
        const shopEmbed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setAuthor({ name: '🏪 NEURAL MARKETPLACE', iconURL: client.user.displayAvatarURL() })
            .setTitle(t.title)
            .setDescription(`${t.desc}\n\n💰 **${t.balance}:** \`${balance.toLocaleString()}\` Credits\n📊 **${t.level}:** \`${userLevel}\``)
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
            .setTimestamp();
        
        // Create menu
        const createMenuOptions = (ownedSet, currentLevel) => {
            return shopItems.map(item => {
                let description = `${item.price.toLocaleString()} Credits - ${item[lang]?.desc || item.en.desc}`;
                if (ownedSet.has(item.id)) {
                    description = `✅ ${t.owned} - ${description}`;
                }
                if (item.requirement?.level && currentLevel < item.requirement.level) {
                    description = `🔒 ${t.locked} ${item.requirement.level} - ${description}`;
                }
                
                return {
                    label: `${item.emoji} ${item[lang]?.name || item.en.name}`.substring(0, 100),
                    description: description.substring(0, 100),
                    value: item.id
                };
            });
        };
        
        const menu = new StringSelectMenuBuilder()
            .setCustomId('shop_select')
            .setPlaceholder(t.placeholder)
            .addOptions(createMenuOptions(ownedItems, userLevel));
        
        const row = new ActionRowBuilder().addComponents(menu);
        
        const buttonRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('shop_inventory')
                    .setLabel(t.inventory)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📦'),
                new ButtonBuilder()
                    .setCustomId('shop_refresh')
                    .setLabel(t.refresh)
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🔄')
            );
        
        const reply = await message.reply({ 
            embeds: [shopEmbed], 
            components: [row, buttonRow] 
        });
        
        const collector = reply.createMessageComponentCollector({ time: 180000 });
        
        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) {
                return i.reply({ content: t.accessDenied, ephemeral: true });
            }
            
            // Handle Inventory Button
            if (i.customId === 'shop_inventory') {
                await i.deferUpdate();
                collector.stop();
                await reply.delete().catch(() => {});
                
                const invCmd = client.commands.get('inventory');
                if (invCmd) {
                    return await invCmd.run(client, message, [], db, serverSettings);
                }
                return;
            }
            
            // Handle Refresh Button
            if (i.customId === 'shop_refresh') {
                const { currentBalance, currentLevel, currentOwned } = refreshShopDisplay();
                
                const refreshedEmbed = new EmbedBuilder()
                    .setColor('#f1c40f')
                    .setAuthor({ name: '🏪 NEURAL MARKETPLACE', iconURL: client.user.displayAvatarURL() })
                    .setTitle(t.title)
                    .setDescription(`${t.desc}\n\n💰 **${t.balance}:** \`${currentBalance.toLocaleString()}\` Credits\n📊 **${t.level}:** \`${currentLevel}\``)
                    .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
                    .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                    .setTimestamp();
                
                const refreshedMenu = new StringSelectMenuBuilder()
                    .setCustomId('shop_select')
                    .setPlaceholder(t.placeholder)
                    .addOptions(createMenuOptions(currentOwned, currentLevel));
                
                const refreshedRow = new ActionRowBuilder().addComponents(refreshedMenu);
                
                await i.update({ embeds: [refreshedEmbed], components: [refreshedRow, buttonRow] });
                return;
            }
            
            // Handle Purchase
            if (i.isStringSelectMenu() && i.customId === 'shop_select') {
                const selectedId = i.values[0];
                const selectedItem = shopItems.find(item => item.id === selectedId);
                
                if (!selectedItem) {
                    return i.reply({ content: t.itemNotFound, ephemeral: true });
                }
                
                const { currentBalance: freshCredits, currentXP, currentLevel, currentOwned } = refreshShopDisplay();
                
                if (currentOwned.has(selectedItem.id) && selectedItem.type !== 'consumable' && selectedItem.type !== 'boost') {
                    return i.reply({ content: t.alreadyOwned, ephemeral: true });
                }
                
                if (selectedItem.requirement?.level && currentLevel < selectedItem.requirement.level) {
                    return i.reply({ content: t.levelRequirement(selectedItem.requirement.level, currentLevel), ephemeral: true });
                }
                
                if (freshCredits < selectedItem.price) {
                    return i.reply({ content: t.insufficientWithAmount(selectedItem.price, freshCredits), ephemeral: true });
                }
                
                try {
                    // Deduct credits
                    db.prepare(`UPDATE users SET credits = credits - ? WHERE id = ?`).run(selectedItem.price, i.user.id);
                    
                    const expiresAt = selectedItem.duration 
                        ? Math.floor(Date.now() / 1000) + (selectedItem.duration * 86400)
                        : null;
                    
                    // Add to inventory
                    if (selectedItem.type === 'consumable') {
                        db.prepare(`
                            INSERT INTO user_inventory (user_id, item_id, quantity, purchased_at, expires_at, active)
                            VALUES (?, ?, 1, strftime('%s', 'now'), ?, 1)
                            ON CONFLICT(user_id, item_id) DO UPDATE SET 
                                quantity = quantity + 1,
                                purchased_at = strftime('%s', 'now')
                        `).run(i.user.id, selectedItem.id, expiresAt);
                    } else {
                        db.prepare(`
                            INSERT OR REPLACE INTO user_inventory (user_id, item_id, quantity, purchased_at, expires_at, active)
                            VALUES (?, ?, 1, strftime('%s', 'now'), ?, 1)
                        `).run(i.user.id, selectedItem.id, expiresAt);
                    }
                    
                    // Apply effects
                    if (selectedItem.effect) {
                        if (selectedItem.effect.xp) {
                            db.prepare(`UPDATE users SET xp = xp + ? WHERE id = ?`).run(selectedItem.effect.xp, i.user.id);
                        }
                        if (selectedItem.effect.credits) {
                            db.prepare(`UPDATE users SET credits = credits + ? WHERE id = ?`).run(selectedItem.effect.credits, i.user.id);
                        }
                    }
                    
                    // Apply role
                    if (selectedItem.type === 'role' && selectedItem.roleId && message.guild) {
                        try {
                            const member = await message.guild.members.fetch(i.user.id);
                            await member.roles.add(selectedItem.roleId);
                        } catch (err) {
                            console.error('[SHOP] Role error:', err);
                        }
                    }
                    
                    const itemName = selectedItem[lang]?.name || selectedItem.en.name;
                    const itemDesc = selectedItem[lang]?.desc || selectedItem.en.desc;
                    const itemPerk = selectedItem[lang]?.perk || selectedItem.en.perk;
                    
                    const successEmbed = new EmbedBuilder()
                        .setColor('#2ecc71')
                        .setAuthor({ name: t.purchaseComplete, iconURL: avatarURL })
                        .setTitle(`${selectedItem.emoji} ${itemName}`)
                        .setDescription(`${itemDesc}\n\n${itemPerk}`)
                        .addFields(
                            { name: t.price, value: `\`-${selectedItem.price.toLocaleString()}\` Credits`, inline: true },
                            { name: t.type, value: `\`${t[selectedItem.type] || t.consumable}\``, inline: true }
                        );
                    
                    if (expiresAt) {
                        successEmbed.addFields({ name: t.expires, value: `<t:${expiresAt}:R>`, inline: true });
                    } else {
                        successEmbed.addFields({ name: t.expires, value: t.permanentItem, inline: true });
                    }
                    
                    successEmbed
                        .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                        .setTimestamp();
                    
                    await i.reply({ embeds: [successEmbed], ephemeral: true });
                    
                    // Refresh the shop after purchase
                    const { currentBalance: finalBalance, currentLevel: finalLevel, currentOwned: finalOwned } = refreshShopDisplay();
                    
                    const finalEmbed = new EmbedBuilder()
                        .setColor('#f1c40f')
                        .setAuthor({ name: '🏪 NEURAL MARKETPLACE', iconURL: client.user.displayAvatarURL() })
                        .setTitle(t.title)
                        .setDescription(`${t.desc}\n\n💰 **${t.balance}:** \`${finalBalance.toLocaleString()}\` Credits\n📊 **${t.level}:** \`${finalLevel}\``)
                        .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
                        .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                        .setTimestamp();
                    
                    const finalMenu = new StringSelectMenuBuilder()
                        .setCustomId('shop_select')
                        .setPlaceholder(t.placeholder)
                        .addOptions(createMenuOptions(finalOwned, finalLevel));
                    
                    const finalRow = new ActionRowBuilder().addComponents(finalMenu);
                    
                    await reply.edit({ embeds: [finalEmbed], components: [finalRow, buttonRow] });
                    
                    console.log(`[SHOP] ${message.author.tag} purchased ${selectedItem.id}`);
                    
                } catch (err) {
                    console.error('[SHOP] Purchase error:', err);
                    await i.reply({ content: t.purchaseError, ephemeral: true });
                }
            }
        });
        
        collector.on('end', async (collected, reason) => {
            if (reason === 'messageDeleted') return;
            
            const disabledMenu = new StringSelectMenuBuilder(menu.data).setDisabled(true);
            const disabledRow = new ActionRowBuilder().addComponents(disabledMenu);
            const disabledButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('shop_inventory').setLabel(t.inventory).setStyle(ButtonStyle.Secondary).setDisabled(true).setEmoji('📦'),
                    new ButtonBuilder().setCustomId('shop_refresh').setLabel(t.refresh).setStyle(ButtonStyle.Success).setDisabled(true).setEmoji('🔄')
                );
            await reply.edit({ components: [disabledRow, disabledButtons] }).catch(() => {});
        });
    }
};