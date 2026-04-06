const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, ButtonBuilder, ButtonStyle } = require('discord.js');

// --- BILINGUAL SHOP ITEMS (Dynamic with requirements) ---
const shopItems = [
    { 
        id: 'role_veteran', 
        price: 5000, 
        emoji: '🎖️', 
        type: 'role',
        roleId: 'YOUR_VETERAN_ROLE_ID', // Replace with actual role ID
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
        duration: 7, // days
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
        version: 'v1.3.2-STABLE',
        desc: 'Exchange your earned credits for system upgrades and status symbols.',
        placeholder: 'Select an upgrade to purchase...',
        balance: 'Current Balance',
        success: 'Purchase Successful!',
        insufficient: '❌ Insufficient Credits.',
        insufficientWithAmount: (price, balance) => `❌ **Insufficient Credits!**\n└─ Required: \`${price.toLocaleString()}\` Credits\n└─ Your Balance: \`${balance.toLocaleString()}\` Credits`,
        alreadyOwned: '⚠️ You already possess this upgrade.',
        levelRequirement: (level) => `⚠️ **Level Requirement Not Met**\n└─ Required Level: \`${level}\`\n└─ Your Level: Check \`.rank\``,
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
        none: 'None'
    },
    fr: {
        title: '═ MARCHÉ NEURAL ARCHON ═',
        version: 'v1.3.2-STABLE',
        desc: 'Échangez vos crédits contre des améliorations système et des symboles de statut.',
        placeholder: 'Sélectionnez une amélioration...',
        balance: 'Solde Actuel',
        success: 'Achat Réussi !',
        insufficient: '❌ Crédits Insuffisants.',
        insufficientWithAmount: (price, balance) => `❌ **Crédits Insuffisants!**\n└─ Requis: \`${price.toLocaleString()}\` Crédits\n└─ Votre Solde: \`${balance.toLocaleString()}\` Crédits`,
        alreadyOwned: '⚠️ Vous possédez déjà cette amélioration.',
        levelRequirement: (level) => `⚠️ **Niveau Requis Non Atteint**\n└─ Niveau Requis: \`${level}\`\n└─ Votre Niveau: Vérifiez avec \`.rank\``,
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
        none: 'Aucun'
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

    run: async (client, message, args, database) => {
        
        // --- INTELLIGENT LANGUAGE DETECTION ---
        let lang = 'en';
        const guildSettings = client.settings?.get(message.guild?.id);
        if (guildSettings?.language) {
            lang = guildSettings.language;
        } else {
            const frenchKeywords = ['fr', 'francais', 'français', 'french', 'bonjour', 'salut', 'merci'];
            const content = message.content.toLowerCase();
            if (frenchKeywords.some(word => content.includes(word)) || message.guild?.preferredLocale === 'fr') {
                lang = 'fr';
            }
        }
        const t = shopTranslations[lang];
        
        const userId = message.author.id;
        const userName = message.author.username;
        const avatarURL = message.author.displayAvatarURL({ dynamic: true, size: 256 });
        
        // --- ENSURE INVENTORY TABLE EXISTS ---
        try {
            database.prepare(`
                CREATE TABLE IF NOT EXISTS user_inventory (
                    user_id TEXT,
                    item_id TEXT,
                    quantity INTEGER DEFAULT 1,
                    purchased_at INTEGER DEFAULT (strftime('%s', 'now')),
                    expires_at INTEGER,
                    PRIMARY KEY (user_id, item_id)
                )
            `).run();
        } catch (err) {
            console.error('Inventory table creation error:', err);
        }
        
        // --- GET USER DATA ---
        const userData = database.prepare(`
            SELECT credits, xp FROM users WHERE id = ?
        `).get(userId);
        
        const balance = userData?.credits || 0;
        const userLevel = Math.floor((userData?.xp || 0) / 1000);
        
        // --- GET USER INVENTORY ---
        const inventory = database.prepare(`
            SELECT item_id, purchased_at FROM user_inventory WHERE user_id = ?
        `).all(userId);
        
        const ownedItems = new Set(inventory.map(i => i.item_id));
        
        // --- SHOP EMBED ---
        const shopEmbed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setAuthor({ name: '🏪 NEURAL MARKETPLACE', iconURL: client.user.displayAvatarURL() })
            .setTitle(t.title)
            .setDescription(`${t.desc}\n\n💰 **${t.balance}:** \`${balance.toLocaleString()}\` Credits\n📊 **Your Level:** \`${userLevel}\``)
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setFooter({ text: `${t.version} • ARCHITECT CG-223`, iconURL: message.author.displayAvatarURL() })
            .setTimestamp();
        
        // --- CREATE SHOP MENU ---
        const menuOptions = shopItems.map(item => {
            let description = `${item.price.toLocaleString()} Credits - ${item[lang].desc}`;
            if (ownedItems.has(item.id)) {
                description = `✅ OWNED - ${description}`;
            }
            if (item.requirement?.level && userLevel < item.requirement.level) {
                description = `🔒 LVL ${item.requirement.level} - ${description}`;
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
                return i.reply({ content: '❌ These controls are locked to your session.', ephemeral: true });
            }
            
            // Handle Inventory Button
            if (i.customId === 'view_inventory') {
                const userInventory = database.prepare(`
                    SELECT item_id, purchased_at FROM user_inventory WHERE user_id = ?
                `).all(userId);
                
                if (userInventory.length === 0) {
                    const emptyEmbed = new EmbedBuilder()
                        .setColor('#95a5a6')
                        .setTitle('📦 INVENTORY')
                        .setDescription('Your inventory is empty. Visit the shop to purchase upgrades!')
                        .setFooter({ text: t.version })
                        .setTimestamp();
                    return i.reply({ embeds: [emptyEmbed], ephemeral: true });
                }
                
                const inventoryList = userInventory.map(inv => {
                    const item = shopItems.find(si => si.id === inv.item_id);
                    if (!item) return null;
                    const date = new Date(inv.purchased_at * 1000);
                    return `**${item.emoji} ${item[lang].name}**\n└─ Purchased: <t:${inv.purchased_at}:R>\n└─ ${item[lang].perk}`;
                }).filter(Boolean).join('\n\n');
                
                const inventoryEmbed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setAuthor({ name: '📦 AGENT INVENTORY', iconURL: avatarURL })
                    .setTitle(`═ ${userName}'s Neural Assets ═`)
                    .setDescription(inventoryList || 'No items found.')
                    .setFooter({ text: `${t.version} • ${userInventory.length} items owned` })
                    .setTimestamp();
                
                return i.reply({ embeds: [inventoryEmbed], ephemeral: true });
            }
            
            // Handle Refresh Button
            if (i.customId === 'refresh_shop') {
                const freshData = database.prepare(`SELECT credits, xp FROM users WHERE id = ?`).get(userId);
                const freshBalance = freshData?.credits || 0;
                const freshLevel = Math.floor((freshData?.xp || 0) / 1000);
                const freshInventory = database.prepare(`SELECT item_id FROM user_inventory WHERE user_id = ?`).all(userId);
                const freshOwned = new Set(freshInventory.map(inv => inv.item_id));
                
                const refreshedEmbed = new EmbedBuilder(shopEmbed)
                    .setDescription(`${t.desc}\n\n💰 **${t.balance}:** \`${freshBalance.toLocaleString()}\` Credits\n📊 **Your Level:** \`${freshLevel}\``);
                
                const refreshedOptions = shopItems.map(item => {
                    let description = `${item.price.toLocaleString()} Credits - ${item[lang].desc}`;
                    if (freshOwned.has(item.id)) description = `✅ OWNED - ${description}`;
                    if (item.requirement?.level && freshLevel < item.requirement.level) description = `🔒 LVL ${item.requirement.level} - ${description}`;
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
                    return i.reply({ content: '❌ Item not found.', ephemeral: true });
                }
                
                // Re-fetch fresh data to prevent exploits
                const freshData = database.prepare(`
                    SELECT credits, xp FROM users WHERE id = ?
                `).get(i.user.id);
                
                const currentCredits = freshData?.credits || 0;
                const currentLevel = Math.floor((freshData?.xp || 0) / 1000);
                
                // Check if already owned
                const alreadyOwned = database.prepare(`
                    SELECT 1 FROM user_inventory WHERE user_id = ? AND item_id = ?
                `).get(i.user.id, selectedItem.id);
                
                if (alreadyOwned && selectedItem.type !== 'consumable') {
                    return i.reply({ content: t.alreadyOwned, ephemeral: true });
                }
                
                // Check level requirement
                if (selectedItem.requirement?.level && currentLevel < selectedItem.requirement.level) {
                    return i.reply({ content: t.levelRequirement(selectedItem.requirement.level), ephemeral: true });
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
                    
                    // Add to inventory
                    const expiresAt = selectedItem.duration 
                        ? Math.floor(Date.now() / 1000) + (selectedItem.duration * 86400)
                        : null;
                    
                    database.prepare(`
                        INSERT OR REPLACE INTO user_inventory (user_id, item_id, quantity, purchased_at, expires_at)
                        VALUES (?, ?, COALESCE((SELECT quantity + 1 FROM user_inventory WHERE user_id = ? AND item_id = ?), 1), 
                                strftime('%s', 'now'), ?)
                    `).run(i.user.id, selectedItem.id, i.user.id, selectedItem.id, expiresAt);
                    
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
                            console.error('Role assignment error:', err);
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
                            { name: t.type, value: `\`${t[selectedItem.type] || t.consumable}\``, inline: true },
                            { name: '📅', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
                        )
                        .setFooter({ text: t.version })
                        .setTimestamp();
                    
                    await i.update({ embeds: [successEmbed], components: [] });
                    
                    // Log the purchase
                    console.log(`[SHOP] ${message.author.tag} purchased ${selectedItem.id} for ${selectedItem.price} credits`);
                    
                    // Auto-refresh the shop view after 3 seconds
                    setTimeout(async () => {
                        const finalData = database.prepare(`SELECT credits, xp FROM users WHERE id = ?`).get(userId);
                        const finalBalance = finalData?.credits || 0;
                        const finalLevel = Math.floor((finalData?.xp || 0) / 1000);
                        const finalInventory = database.prepare(`SELECT item_id FROM user_inventory WHERE user_id = ?`).all(userId);
                        const finalOwned = new Set(finalInventory.map(inv => inv.item_id));
                        
                        const finalEmbed = new EmbedBuilder(shopEmbed)
                            .setDescription(`${t.desc}\n\n💰 **${t.balance}:** \`${finalBalance.toLocaleString()}\` Credits\n📊 **Your Level:** \`${finalLevel}\``);
                        
                        const finalOptions = shopItems.map(item => {
                            let description = `${item.price.toLocaleString()} Credits - ${item[lang].desc}`;
                            if (finalOwned.has(item.id)) description = `✅ OWNED - ${description}`;
                            if (item.requirement?.level && finalLevel < item.requirement.level) description = `🔒 LVL ${item.requirement.level} - ${description}`;
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
                    console.error('Purchase error:', err);
                    await i.reply({ content: '❌ An error occurred during purchase. Please try again.', ephemeral: true });
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