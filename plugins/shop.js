const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, ButtonBuilder, ButtonStyle } = require('discord.js');

// ================= UNIFIED LEVEL CALCULATION =================
function calculateLevel(xp) { 
    return Math.floor(0.1 * Math.sqrt(xp)) + 1; 
}

// --- BILINGUAL SHOP ITEMS (Dynamic with requirements) ---
const shopItems = [
    { 
        id: 'starter_pack', 
        price: 500, 
        emoji: '📦', 
        type: 'consumable',
        effect: { xp: 100, credits: 50 },
        en: { name: 'New Recruit Pack', desc: 'A small boost for new agents.', perk: '+100 XP & +50 Credits' },
        fr: { name: 'Pack Nouvelle Recrue', desc: 'Un petit boost pour les nouveaux agents.', perk: '+100 XP & +50 Crédits' }
    },
    { 
        id: 'role_veteran', 
        price: 5000, 
        emoji: '🎖️', 
        type: 'role',
        roleId: 'YOUR_VETERAN_ROLE_ID',
        requirement: { level: 10 },
        en: { name: 'Veteran Agent Role', desc: 'Exclusive Discord role for elite agents.', perk: '+50% respect in server' },
        fr: { name: 'Rôle Agent Vétéran', desc: 'Rôle Discord exclusif pour les agents d\'élite.', perk: '+50% de respect dans le serveur' }
    },
    { 
        id: 'xp_boost', 
        price: 2000, 
        emoji: '⚡', 
        type: 'consumable',
        effect: { xp: 1000 },
        en: { name: 'Quantum XP Overdrive', desc: 'A one-time massive XP injection.', perk: '+1000 XP instantly' },
        fr: { name: 'Overdrive XP Quantique', desc: 'Une injection massive d\'XP unique.', perk: '+1000 XP instantanément' }
    },
    { 
        id: 'credit_boost', 
        price: 1500, 
        emoji: '💰', 
        type: 'consumable',
        effect: { credits: 500 },
        en: { name: 'Credit Surge', desc: 'Instant credit injection.', perk: '+500 Credits' },
        fr: { name: 'Afflux de Crédits', desc: 'Injection de crédits instantanée.', perk: '+500 Crédits' }
    },
    { 
        id: 'tag_architect', 
        price: 15000, 
        emoji: '🏗️', 
        type: 'badge',
        requirement: { level: 25 },
        en: { name: 'Architect Apprentice', desc: 'Special badge displayed on your .rank profile.', perk: 'Recognized by the Architect' },
        fr: { name: 'Apprenti Architecte', desc: 'Badge spécial affiché sur votre profil .rank.', perk: 'Reconnu par l\'Architecte' }
    },
    { 
        id: 'xp_multiplier', 
        price: 10000, 
        emoji: '📈', 
        type: 'boost',
        duration: 7,
        effect: { multiplier: 1.5 },
        en: { name: 'Neural Accelerator', desc: '7-day XP boost (1.5x).', perk: 'Earn 50% more XP from all sources' },
        fr: { name: 'Accélérateur Neural', desc: 'Boost XP de 7 jours (1.5x).', perk: 'Gagnez 50% plus d\'XP de toutes les sources' }
    },
    { 
        id: 'color_role', 
        price: 8000, 
        emoji: '🎨', 
        type: 'role',
        en: { name: 'Custom Color Role', desc: 'Choose your own role color.', perk: 'Stand out in the member list' },
        fr: { name: 'Rôle Couleur Personnalisée', desc: 'Choisissez votre propre couleur de rôle.', perk: 'Démarquez-vous dans la liste des membres' }
    },
    { 
        id: 'daily_boost', 
        price: 25000, 
        emoji: '🌟', 
        type: 'permanent',
        effect: { dailyBonus: 50 },
        en: { name: 'Premium Daily Bonus', desc: 'Permanent +50% daily reward bonus.', perk: 'Get more from your .daily claims' },
        fr: { name: 'Bonus Quotidien Premium', desc: 'Bonus permanent de +50% sur les récompenses quotidiennes.', perk: 'Obtenez plus de vos récompenses .daily' }
    }
];

// --- SHOP TRANSLATIONS ---
const shopTranslations = {
    en: {
        title: '═ ARCHON NEURAL MARKETPLACE ═',
        desc: 'Exchange your earned credits for system upgrades and status symbols.',
        placeholder: 'Select an upgrade to purchase...',
        balance: 'Current Balance',
        success: 'Purchase Successful!',
        insufficient: '❌ Insufficient Credits.',
        insufficientWithAmount: (price, balance) => `❌ **Insufficient Credits!**\n└─ Required: \`${price.toLocaleString()}\` Credits\n└─ Your Balance: \`${balance.toLocaleString()}\` Credits`,
        alreadyOwned: '⚠️ You already possess this upgrade.',
        levelRequirement: (level, current) => `⚠️ **Level Requirement Not Met**\n└─ Required Level: \`${level}\`\n└─ Your Level: \`${current}\``,
        purchaseSuccess: (name, price) => `✅ **${name}** purchased successfully!\n└─ \`-${price.toLocaleString()}\` Credits`,
        inventory: '📦 My Inventory',
        refresh: '🔄 Refresh',
        confirmPurchase: 'Confirm Purchase',
        cancel: 'Cancel',
        itemDetails: 'Item Details',
        price: 'Price',
        type: 'Type',
        perk: 'Perk',
        requirement: 'Requirement',
        consumable: 'Consumable',
        role: 'Role',
        badge: 'Badge',
        boost: 'Boost',
        permanent: 'Permanent',
        days: 'days',
        level: 'Level',
        none: 'None',
        expires: 'Expires',
        expiresIn: (days) => `Expires in ${days} days`,
        permanentItem: 'Permanent',
        emptyInventory: 'Your inventory is empty. Visit the shop to purchase upgrades!',
        inventoryTitle: '📦 INVENTORY',
        agentInventory: (name) => `═ ${name}'s Neural Assets ═`,
        itemsOwned: (count) => `${count} items owned`,
        purchased: 'Purchased',
        owned: 'OWNED',
        locked: 'LVL',
        accessDenied: '❌ These controls are locked to your session.',
        itemNotFound: '❌ Item not found.',
        purchaseError: '❌ An error occurred during purchase. Please try again.',
        inventoryOpened: '📦 Inventory displayed above!',
        footer: 'ARCHITECT CG-223 • Neural Marketplace'
    },
    fr: {
        title: '═ MARCHÉ NEURAL ARCHON ═',
        desc: 'Échangez vos crédits contre des améliorations système et des symboles de statut.',
        placeholder: 'Sélectionnez une amélioration...',
        balance: 'Solde Actuel',
        success: 'Achat Réussi !',
        insufficient: '❌ Crédits Insuffisants.',
        insufficientWithAmount: (price, balance) => `❌ **Crédits Insuffisants!**\n└─ Requis: \`${price.toLocaleString()}\` Crédits\n└─ Votre Solde: \`${balance.toLocaleString()}\` Crédits`,
        alreadyOwned: '⚠️ Vous possédez déjà cette amélioration.',
        levelRequirement: (level, current) => `⚠️ **Niveau Requis Non Atteint**\n└─ Niveau Requis: \`${level}\`\n└─ Votre Niveau: \`${current}\``,
        purchaseSuccess: (name, price) => `✅ **${name}** acheté avec succès!\n└─ \`-${price.toLocaleString()}\` Crédits`,
        inventory: '📦 Mon Inventaire',
        refresh: '🔄 Actualiser',
        confirmPurchase: 'Confirmer l\'Achat',
        cancel: 'Annuler',
        itemDetails: 'Détails de l\'Article',
        price: 'Prix',
        type: 'Type',
        perk: 'Avantage',
        requirement: 'Prérequis',
        consumable: 'Consommable',
        role: 'Rôle',
        badge: 'Badge',
        boost: 'Boost',
        permanent: 'Permanent',
        days: 'jours',
        level: 'Niveau',
        none: 'Aucun',
        expires: 'Expire',
        expiresIn: (days) => `Expire dans ${days} jours`,
        permanentItem: 'Permanent',
        emptyInventory: 'Votre inventaire est vide. Visitez la boutique pour acheter des améliorations!',
        inventoryTitle: '📦 INVENTAIRE',
        agentInventory: (name) => `═ Actifs Neuraux de ${name} ═`,
        itemsOwned: (count) => `${count} objets possédés`,
        purchased: 'Acheté',
        owned: 'POSSÉDÉ',
        locked: 'NIV',
        accessDenied: '❌ Ces commandes sont verrouillées à votre session.',
        itemNotFound: '❌ Article introuvable.',
        purchaseError: '❌ Une erreur est survenue lors de l\'achat. Veuillez réessayer.',
        inventoryOpened: '📦 Inventaire affiché ci-dessus !',
        footer: 'ARCHITECT CG-223 • Marché Neural'
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

    // ✅ MODIFIED: Added serverSettings as 5th argument
    run: async (client, message, args, database, serverSettings) => {
        
        // ✅ MODIFIED: Use server-specific language from settings
        const lang = serverSettings?.language || 'en';
        const t = shopTranslations[lang];
        const prefix = serverSettings?.prefix || '.';
        const version = client.version || '1.5.0';
        
        const userId = message.author.id;
        const userName = message.author.username;
        const avatarURL = message.author.displayAvatarURL({ dynamic: true, size: 256 });
        
        // --- ENSURE INVENTORY TABLE EXISTS (WITH EXPIRATION SUPPORT) ---
        try {
            database.prepare(`
                CREATE TABLE IF NOT EXISTS user_inventory (
                    user_id TEXT,
                    item_id TEXT,
                    quantity INTEGER DEFAULT 1,
                    purchased_at INTEGER DEFAULT (strftime('%s', 'now')),
                    expires_at INTEGER,
                    active BOOLEAN DEFAULT 1,
                    PRIMARY KEY (user_id, item_id)
                )
            `).run();
            
            // Clean expired items on shop open
            const now = Math.floor(Date.now() / 1000);
            database.prepare(`
                UPDATE user_inventory 
                SET active = 0 
                WHERE expires_at IS NOT NULL AND expires_at < ? AND active = 1
            `).run(now);
            
        } catch (err) {
            console.error('[SHOP] Inventory table creation error:', err);
        }
        
        // --- GET USER DATA ---
        const userData = database.prepare(`
            SELECT credits, xp FROM users WHERE id = ?
        `).get(userId);
        
        if (!userData) {
            database.prepare(`INSERT INTO users (id, username, xp, level, credits) VALUES (?, ?, 0, 1, 0)`)
                .run(userId, userName);
        }
        
        const balance = userData?.credits || 0;
        const userXP = userData?.xp || 0;
        const userLevel = calculateLevel(userXP);
        
        // --- GET USER INVENTORY (Only active items) ---
        const inventory = database.prepare(`
            SELECT item_id, purchased_at, expires_at FROM user_inventory 
            WHERE user_id = ? AND active = 1
        `).all(userId);
        
        const ownedItems = new Set(inventory.map(i => i.item_id));
        
        // --- SHOP EMBED ---
        const shopEmbed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setAuthor({ name: '🏪 NEURAL MARKETPLACE', iconURL: client.user.displayAvatarURL() })
            .setTitle(t.title)
            .setDescription(`${t.desc}\n\n💰 **${t.balance}:** \`${balance.toLocaleString()}\` Credits\n📊 **${t.level}:** \`${userLevel}\``)
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setFooter({ text: `${t.footer} • v${version}`, iconURL: message.author.displayAvatarURL() })
            .setTimestamp();
        
        // --- CREATE SHOP MENU ---
        const menuOptions = shopItems.map(item => {
            let description = `${item.price.toLocaleString()} Credits - ${item[lang].desc}`;
            if (ownedItems.has(item.id)) {
                description = `✅ ${t.owned} - ${description}`;
            }
            if (item.requirement?.level && userLevel < item.requirement.level) {
                description = `🔒 ${t.locked} ${item.requirement.level} - ${description}`;
            }
            
            return {
                label: `${item.emoji} ${item[lang].name}`.substring(0, 100),
                description: description.substring(0, 100),
                value: item.id
            };
        });
        
        const menu = new StringSelectMenuBuilder()
            .setCustomId('shop_select')
            .setPlaceholder(t.placeholder)
            .addOptions(menuOptions);
        
        const row = new ActionRowBuilder().addComponents(menu);
        
        // --- ADD INVENTORY BUTTON ---
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
        
        // --- COLLECTOR FOR BOTH SELECT MENU AND BUTTONS ---
        const collector = response.createMessageComponentCollector({ time: 120000 });
        
        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) {
                return i.reply({ content: t.accessDenied, ephemeral: true });
            }
            
            // Handle Inventory Button
            if (i.customId === 'view_inventory') {
                const invCmd = client.commands.get('inventory');
                if (invCmd) {
                    // ✅ PASS serverSettings to the inventory command
                    await invCmd.run(client, message, [], database, serverSettings);
                    return await i.reply({ content: t.inventoryOpened, ephemeral: true });
                }
                
                // Fallback if inventory command not found
                const userInventory = database.prepare(`
                    SELECT item_id, purchased_at, expires_at FROM user_inventory 
                    WHERE user_id = ? AND active = 1
                `).all(userId);
                
                if (userInventory.length === 0) {
                    const emptyEmbed = new EmbedBuilder()
                        .setColor('#95a5a6')
                        .setTitle(t.inventoryTitle)
                        .setDescription(t.emptyInventory)
                        .setFooter({ text: `v${version}` })
                        .setTimestamp();
                    return i.reply({ embeds: [emptyEmbed], ephemeral: true });
                }
                
                const inventoryList = userInventory.map(inv => {
                    const item = shopItems.find(si => si.id === inv.item_id);
                    if (!item) return null;
                    
                    let expirationText = '';
                    if (inv.expires_at) {
                        expirationText = `\n└─ ⏰ ${t.expires}: <t:${inv.expires_at}:R>`;
                    } else {
                        expirationText = `\n└─ ⏰ ${t.permanentItem}`;
                    }
                    
                    return `**${item.emoji} ${item[lang].name}**\n└─ 📅 ${t.purchased}: <t:${inv.purchased_at}:R>${expirationText}\n└─ ✨ ${item[lang].perk}`;
                }).filter(Boolean).join('\n\n');
                
                const inventoryEmbed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setAuthor({ name: '📦 AGENT INVENTORY', iconURL: avatarURL })
                    .setTitle(t.agentInventory(userName))
                    .setDescription(inventoryList || 'No items found.')
                    .setFooter({ text: `v${version} • ${t.itemsOwned(userInventory.length)}` })
                    .setTimestamp();
                
                return i.reply({ embeds: [inventoryEmbed], ephemeral: true });
            }
            
            // Handle Refresh Button
            if (i.customId === 'refresh_shop') {
                // Clean expired items first
                const now = Math.floor(Date.now() / 1000);
                database.prepare(`
                    UPDATE user_inventory 
                    SET active = 0 
                    WHERE expires_at IS NOT NULL AND expires_at < ? AND active = 1
                `).run(now);
                
                const freshData = database.prepare(`SELECT credits, xp FROM users WHERE id = ?`).get(userId);
                const freshBalance = freshData?.credits || 0;
                const freshXP = freshData?.xp || 0;
                const freshLevel = calculateLevel(freshXP);
                const freshInventory = database.prepare(`
                    SELECT item_id FROM user_inventory 
                    WHERE user_id = ? AND active = 1
                `).all(userId);
                const freshOwned = new Set(freshInventory.map(inv => inv.item_id));
                
                const refreshedEmbed = new EmbedBuilder(shopEmbed)
                    .setDescription(`${t.desc}\n\n💰 **${t.balance}:** \`${freshBalance.toLocaleString()}\` Credits\n📊 **${t.level}:** \`${freshLevel}\``);
                
                const refreshedOptions = shopItems.map(item => {
                    let description = `${item.price.toLocaleString()} Credits - ${item[lang].desc}`;
                    if (freshOwned.has(item.id)) description = `✅ ${t.owned} - ${description}`;
                    if (item.requirement?.level && freshLevel < item.requirement.level) description = `🔒 ${t.locked} ${item.requirement.level} - ${description}`;
                    return {
                        label: `${item.emoji} ${item[lang].name}`.substring(0, 100),
                        description: description.substring(0, 100),
                        value: item.id
                    };
                });
                
                const refreshedMenu = new StringSelectMenuBuilder(menu.data).setOptions(refreshedOptions);
                const refreshedRow = new ActionRowBuilder().addComponents(refreshedMenu);
                
                await i.update({ embeds: [refreshedEmbed], components: [refreshedRow, buttonRow] });
                return;
            }
            
            // Handle Shop Purchase
            if (i.isStringSelectMenu() && i.customId === 'shop_select') {
                const selectedItem = shopItems.find(item => item.id === i.values[0]);
                
                if (!selectedItem) {
                    return i.reply({ content: t.itemNotFound, ephemeral: true });
                }
                
                // Clean expired items
                const now = Math.floor(Date.now() / 1000);
                database.prepare(`
                    UPDATE user_inventory 
                    SET active = 0 
                    WHERE expires_at IS NOT NULL AND expires_at < ? AND active = 1
                `).run(now);
                
                // Re-fetch fresh data to prevent exploits
                const freshData = database.prepare(`
                    SELECT credits, xp FROM users WHERE id = ?
                `).get(i.user.id);
                
                const currentCredits = freshData?.credits || 0;
                const currentXP = freshData?.xp || 0;
                const currentLevel = calculateLevel(currentXP);
                
                // Check if already owned (only for non-consumable, non-boost items)
                const alreadyOwned = database.prepare(`
                    SELECT 1 FROM user_inventory 
                    WHERE user_id = ? AND item_id = ? AND active = 1
                `).get(i.user.id, selectedItem.id);
                
                if (alreadyOwned && selectedItem.type !== 'consumable' && selectedItem.type !== 'boost') {
                    return i.reply({ content: t.alreadyOwned, ephemeral: true });
                }
                
                // Check level requirement
                if (selectedItem.requirement?.level && currentLevel < selectedItem.requirement.level) {
                    return i.reply({ 
                        content: t.levelRequirement(selectedItem.requirement.level, currentLevel), 
                        ephemeral: true 
                    });
                }
                
                // Check balance
                if (currentCredits < selectedItem.price) {
                    return i.reply({ 
                        content: t.insufficientWithAmount(selectedItem.price, currentCredits), 
                        ephemeral: true 
                    });
                }
                
                // --- PROCESS PURCHASE ---
                try {
                    // Deduct credits
                    database.prepare(`
                        UPDATE users SET credits = credits - ? WHERE id = ?
                    `).run(selectedItem.price, i.user.id);
                    
                    // Calculate expiration if applicable
                    const expiresAt = selectedItem.duration 
                        ? Math.floor(Date.now() / 1000) + (selectedItem.duration * 86400)
                        : null;
                    
                    // Add to inventory (allow stacking for consumables)
                    if (selectedItem.type === 'consumable') {
                        database.prepare(`
                            INSERT INTO user_inventory (user_id, item_id, quantity, purchased_at, expires_at, active)
                            VALUES (?, ?, 1, strftime('%s', 'now'), ?, 1)
                            ON CONFLICT(user_id, item_id) DO UPDATE SET 
                                quantity = quantity + 1,
                                purchased_at = strftime('%s', 'now')
                        `).run(i.user.id, selectedItem.id, expiresAt);
                    } else {
                        database.prepare(`
                            INSERT OR REPLACE INTO user_inventory (user_id, item_id, quantity, purchased_at, expires_at, active)
                            VALUES (?, ?, 1, strftime('%s', 'now'), ?, 1)
                        `).run(i.user.id, selectedItem.id, expiresAt);
                    }
                    
                    // Apply immediate effects
                    if (selectedItem.effect) {
                        if (selectedItem.effect.xp) {
                            database.prepare(`UPDATE users SET xp = xp + ? WHERE id = ?`)
                                .run(selectedItem.effect.xp, i.user.id);
                        }
                        if (selectedItem.effect.credits) {
                            database.prepare(`UPDATE users SET credits = credits + ? WHERE id = ?`)
                                .run(selectedItem.effect.credits, i.user.id);
                        }
                    }
                    
                    // Apply role if applicable
                    if (selectedItem.type === 'role' && selectedItem.roleId && message.guild) {
                        try {
                            const member = await message.guild.members.fetch(i.user.id);
                            await member.roles.add(selectedItem.roleId);
                        } catch (err) {
                            console.error('[SHOP] Role assignment error:', err);
                        }
                    }
                    
                    // Send success message
                    const successEmbed = new EmbedBuilder()
                        .setColor('#2ecc71')
                        .setAuthor({ name: '✅ PURCHASE COMPLETE', iconURL: avatarURL })
                        .setTitle(`${selectedItem.emoji} ${selectedItem[lang].name}`)
                        .setDescription(`${selectedItem[lang].desc}\n\n${selectedItem[lang].perk}`)
                        .addFields(
                            { name: t.price, value: `\`-${selectedItem.price.toLocaleString()}\` Credits`, inline: true },
                            { name: t.type, value: `\`${t[selectedItem.type] || t.consumable}\``, inline: true }
                        );
                    
                    if (expiresAt) {
                        successEmbed.addFields({
                            name: t.expires,
                            value: `<t:${expiresAt}:R>`,
                            inline: true
                        });
                    } else {
                        successEmbed.addFields({
                            name: t.expires,
                            value: t.permanentItem,
                            inline: true
                        });
                    }
                    
                    successEmbed
                        .setFooter({ text: `v${version}` })
                        .setTimestamp();
                    
                    await i.update({ embeds: [successEmbed], components: [] });
                    
                    console.log(`[SHOP] ${message.author.tag} purchased ${selectedItem.id} for ${selectedItem.price} credits`);
                    
                    // Auto-refresh the shop view after 3 seconds
                    setTimeout(async () => {
                        const finalData = database.prepare(`SELECT credits, xp FROM users WHERE id = ?`).get(userId);
                        const finalBalance = finalData?.credits || 0;
                        const finalXP = finalData?.xp || 0;
                        const finalLevel = calculateLevel(finalXP);
                        const finalInventory = database.prepare(`
                            SELECT item_id FROM user_inventory 
                            WHERE user_id = ? AND active = 1
                        `).all(userId);
                        const finalOwned = new Set(finalInventory.map(inv => inv.item_id));
                        
                        const finalEmbed = new EmbedBuilder(shopEmbed)
                            .setDescription(`${t.desc}\n\n💰 **${t.balance}:** \`${finalBalance.toLocaleString()}\` Credits\n📊 **${t.level}:** \`${finalLevel}\``);
                        
                        const finalOptions = shopItems.map(item => {
                            let description = `${item.price.toLocaleString()} Credits - ${item[lang].desc}`;
                            if (finalOwned.has(item.id)) description = `✅ ${t.owned} - ${description}`;
                            if (item.requirement?.level && finalLevel < item.requirement.level) description = `🔒 ${t.locked} ${item.requirement.level} - ${description}`;
                            return {
                                label: `${item.emoji} ${item[lang].name}`.substring(0, 100),
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
                    new ButtonBuilder()
                        .setCustomId('view_inventory')
                        .setLabel(t.inventory)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                        .setEmoji('📦'),
                    new ButtonBuilder()
                        .setCustomId('refresh_shop')
                        .setLabel(t.refresh)
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(true)
                        .setEmoji('🔄')
                );
            response.edit({ components: [disabledRow, disabledButtons] }).catch(() => {});
        });
    }
};