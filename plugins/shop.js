const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, ButtonBuilder, ButtonStyle } = require('discord.js');

// ================= UNIFIED LEVEL CALCULATION =================
function calculateLevel(xp) { 
    return Math.floor(0.1 * Math.sqrt(xp)) + 1; 
}

// --- BILINGUAL SHOP ITEMS ---
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
        
        // ✅ FIXED: Ensure tables exist BEFORE any queries
        try {
            // Create inventory table FIRST
            db.prepare(`
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
            
            // Clean expired items
            const now = Math.floor(Date.now() / 1000);
            db.prepare(`
                UPDATE user_inventory 
                SET active = 0 
                WHERE expires_at IS NOT NULL AND expires_at > 0 AND expires_at < ? AND active = 1
            `).run(now);
            
        } catch (err) {
            console.error('[SHOP] Inventory table error:', err.message);
        }
        
        // ✅ FIXED: Ensure user exists before querying
        let userData = db.prepare(`SELECT credits, xp FROM users WHERE id = ?`).get(userId);
        if (!userData) {
            db.prepare(`INSERT INTO users (id, username, xp, level, credits) VALUES (?, ?, 0, 1, 0)`)
                .run(userId, userName);
            userData = { credits: 0, xp: 0 };
        }
        
        const balance = userData?.credits || 0;
        const userXP = userData?.xp || 0;
        const userLevel = calculateLevel(userXP);
        
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
            
            // Handle Purchase
            if (i.isStringSelectMenu() && i.customId === 'shop_select') {
                const selectedItem = shopItems.find(item => item.id === i.values[0]);
                
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
                    
                    const successEmbed = new EmbedBuilder()
                        .setColor('#2ecc71')
                        .setAuthor({ name: t.purchaseComplete, iconURL: avatarURL })
                        .setTitle(`${selectedItem.emoji} ${selectedItem[lang].name}`)
                        .setDescription(`${selectedItem[lang].desc}\n\n${selectedItem[lang].perk}`)
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
                    new ButtonBuilder().setCustomId('view_inventory').setLabel(t.inventory).setStyle(ButtonStyle.Secondary).setDisabled(true).setEmoji('📦'),
                    new ButtonBuilder().setCustomId('refresh_shop').setLabel(t.refresh).setStyle(ButtonStyle.Success).setDisabled(true).setEmoji('🔄')
                );
            response.edit({ components: [disabledRow, disabledButtons] }).catch(() => {});
        });
    }
};