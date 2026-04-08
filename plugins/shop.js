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
        
        // ================= DATABASE (Global migration handled in index.js) =================
        // Only clean expired items
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
        const menuOptions = shopItems.map(item => {
            let description = `${item.price.toLocaleString()} Credits - ${item[lang]?.desc || item.en.desc}`;
            if (ownedItems.has(item.id)) {
                description = `✅ ${t.owned} - ${description}`;
            }
            if (item.requirement?.level && userLevel < item.requirement.level) {
                description = `🔒 ${t.locked} ${item.requirement.level} - ${description}`;
            }
            
            return {
                label: `${item.emoji} ${item[lang]?.name || item.en.name}`.substring(0, 100),
                description: description.substring(0, 100),
                value: item.id
            };
        });
        
        const menu = new StringSelectMenuBuilder()
            .setCustomId('shop_select')
            .setPlaceholder(t.placeholder)
            .addOptions(menuOptions);
        
        const row = new ActionRowBuilder().addComponents(menu);
        
        const buttonRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('view_inventory')
                    .setLabel(t.inventory)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📦'),
                new ButtonBuilder()
                    .setCustomId('refresh_shop')
                    .setLabel(t.refresh)
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🔄')
            );
        
        const response = await message.reply({ 
            embeds: [shopEmbed], 
            components: [row, buttonRow] 
        });
        
        const collector = response.createMessageComponentCollector({ time: 120000 });
        
        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) {
                return i.reply({ content: t.accessDenied, ephemeral: true });
            }
            
            // Handle Inventory Button
            if (i.customId === 'view_inventory') {
                const invCmd = client.commands.get('inventory');
                if (invCmd) {
                    await invCmd.run(client, message, [], db, serverSettings);
                    return await i.reply({ content: '📦 Inventory displayed above!', ephemeral: true });
                }
                return i.reply({ content: '❌ Inventory command not found.', ephemeral: true });
            }
            
            // Handle Refresh Button
            if (i.customId === 'refresh_shop') {
                const now = Math.floor(Date.now() / 1000);
                db.prepare(`
                    UPDATE user_inventory 
                    SET active = 0 
                    WHERE expires_at IS NOT NULL AND expires_at > 0 AND expires_at < ? AND active = 1
                `).run(now);
                
                const freshData = db.prepare(`SELECT credits, xp FROM users WHERE id = ?`).get(userId);
                const freshBalance = freshData?.credits || 0;
                const freshXP = freshData?.xp || 0;
                const freshLevel = calculateLevel(freshXP);
                const freshInventory = db.prepare(`SELECT item_id FROM user_inventory WHERE user_id = ? AND active = 1`).all(userId);
                const freshOwned = new Set(freshInventory.map(inv => inv.item_id));
                
                const refreshedEmbed = new EmbedBuilder(shopEmbed)
                    .setDescription(`${t.desc}\n\n💰 **${t.balance}:** \`${freshBalance.toLocaleString()}\` Credits\n📊 **${t.level}:** \`${freshLevel}\``);
                
                const refreshedOptions = shopItems.map(item => {
                    let description = `${item.price.toLocaleString()} Credits - ${item[lang]?.desc || item.en.desc}`;
                    if (freshOwned.has(item.id)) description = `✅ ${t.owned} - ${description}`;
                    if (item.requirement?.level && freshLevel < item.requirement.level) description = `🔒 ${t.locked} ${item.requirement.level} - ${description}`;
                    return {
                        label: `${item.emoji} ${item[lang]?.name || item.en.name}`.substring(0, 100),
                        description: description.substring(0, 100),
                        value: item.id
                    };
                });
                
                const refreshedMenu = new StringSelectMenuBuilder(menu.data).setOptions(refreshedOptions);
                const refreshedRow = new ActionRowBuilder().addComponents(refreshedMenu);
                
                await i.update({ embeds: [refreshedEmbed], components: [refreshedRow, buttonRow] });
                return;
            }
            
            // Handle Purchase
            if (i.isStringSelectMenu() && i.customId === 'shop_select') {
                const selectedId = i.values[0];
                const selectedItem = client.getItem ? client.getItem(selectedId) : shopItems.find(item => item.id === selectedId);
                
                if (!selectedItem) {
                    return i.reply({ content: t.itemNotFound, ephemeral: true });
                }
                
                const freshData = db.prepare(`SELECT credits, xp FROM users WHERE id = ?`).get(i.user.id);
                const currentCredits = freshData?.credits || 0;
                const currentXP = freshData?.xp || 0;
                const currentLevel = calculateLevel(currentXP);
                
                const alreadyOwned = db.prepare(`SELECT 1 FROM user_inventory WHERE user_id = ? AND item_id = ? AND active = 1`).get(i.user.id, selectedItem.id);
                
                if (alreadyOwned && selectedItem.type !== 'consumable' && selectedItem.type !== 'boost') {
                    return i.reply({ content: t.alreadyOwned, ephemeral: true });
                }
                
                if (selectedItem.requirement?.level && currentLevel < selectedItem.requirement.level) {
                    return i.reply({ content: t.levelRequirement(selectedItem.requirement.level, currentLevel), ephemeral: true });
                }
                
                if (currentCredits < selectedItem.price) {
                    return i.reply({ content: t.insufficientWithAmount(selectedItem.price, currentCredits), ephemeral: true });
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
                    
                    await i.update({ embeds: [successEmbed], components: [] });
                    
                    console.log(`[SHOP] ${message.author.tag} purchased ${selectedItem.id}`);
                    
                    // Auto-refresh after 3 seconds
                    setTimeout(async () => {
                        const finalData = db.prepare(`SELECT credits, xp FROM users WHERE id = ?`).get(userId);
                        const finalBalance = finalData?.credits || 0;
                        const finalXP = finalData?.xp || 0;
                        const finalLevel = calculateLevel(finalXP);
                        const finalInventory = db.prepare(`SELECT item_id FROM user_inventory WHERE user_id = ? AND active = 1`).all(userId);
                        const finalOwned = new Set(finalInventory.map(inv => inv.item_id));
                        
                        const finalEmbed = new EmbedBuilder(shopEmbed)
                            .setDescription(`${t.desc}\n\n💰 **${t.balance}:** \`${finalBalance.toLocaleString()}\` Credits\n📊 **${t.level}:** \`${finalLevel}\``);
                        
                        const finalOptions = shopItems.map(item => {
                            let description = `${item.price.toLocaleString()} Credits - ${item[lang]?.desc || item.en.desc}`;
                            if (finalOwned.has(item.id)) description = `✅ ${t.owned} - ${description}`;
                            if (item.requirement?.level && finalLevel < item.requirement.level) description = `🔒 ${t.locked} ${item.requirement.level} - ${description}`;
                            return {
                                label: `${item.emoji} ${item[lang]?.name || item.en.name}`.substring(0, 100),
                                description: description.substring(0, 100),
                                value: item.id
                            };
                        });
                        
                        const finalMenu = new StringSelectMenuBuilder(menu.data).setOptions(finalOptions);
                        const finalRow = new ActionRowBuilder().addComponents(finalMenu);
                        
                        await response.edit({ embeds: [finalEmbed], components: [finalRow, buttonRow] }).catch(() => {});
                    }, 3000);
                    
                } catch (err) {
                    console.error('[SHOP] Purchase error:', err);
                    await i.reply({ content: t.purchaseError, ephemeral: true });
                }
            }
        });
        
        collector.on('end', () => {
            const disabledMenu = new StringSelectMenuBuilder(menu.data).setDisabled(true);
            const disabledRow = new ActionRowBuilder().addComponents(disabledMenu);
            const disabledButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('view_inventory').setLabel(t.inventory).setStyle(ButtonStyle.Secondary).setDisabled(true).setEmoji('📦'),
                    new ButtonBuilder().setCustomId('refresh_shop').setLabel(t.refresh).setStyle(ButtonStyle.Success).setDisabled(true).setEmoji('🔄')
                );
            response.edit({ components: [disabledRow, disabledButtons] }).catch(() => {});
        });
    }
};