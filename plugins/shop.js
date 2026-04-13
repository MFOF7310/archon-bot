const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ================= UNIFIED LEVEL CALCULATION =================
function calculateLevel(xp) { 
    return Math.floor(0.1 * Math.sqrt(xp)) + 1; 
}

// ================= BILINGUAL TRANSLATIONS =================
const shopTranslations = {
    en: {
        title: '═ ARCHON NEURAL MARKETPLACE ═',
        desc: 'Exchange your earned credits for system upgrades.',
        placeholder: 'Select an upgrade to purchase...',
        balance: 'Current Balance',
        insufficientFunds: (price, balance) => `❌ **Insufficient Credits!**\nRequired: \`${price.toLocaleString()}\` 🪙\nYour Balance: \`${balance.toLocaleString()}\` 🪙`,
        alreadyOwned: '⚠️ You already possess this upgrade.',
        levelRequirement: (level, current) => `⚠️ **Level Requirement Not Met**\nRequired Level: \`${level}\`\nYour Level: \`${current}\``,
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
        purchaseError: '❌ An error occurred during purchase.',
        footer: 'ARCHITECT CG-223 • Neural Marketplace',
        purchaseComplete: '✅ PURCHASE COMPLETE',
        newBalance: 'New Balance',
        verifyWith: 'Verify with',
        checkBalance: 'Check your balance anytime with `.bal` or `.credits`',
        processing: '⚡ Processing transaction...',
        loadingInventory: '⚡ Loading inventory...',
        purchaseDetails: 'PURCHASE DETAILS',
        itemPurchased: 'Item Purchased',
        pricePaid: 'Price Paid',
        bonusReceived: 'Bonus Received',
        previousBalance: 'Previous Balance'
    },
    fr: {
        title: '═ MARCHÉ NEURAL ARCHON ═',
        desc: 'Échangez vos crédits contre des améliorations système.',
        placeholder: 'Sélectionnez une amélioration...',
        balance: 'Solde Actuel',
        insufficientFunds: (price, balance) => `❌ **Crédits Insuffisants !**\nRequis: \`${price.toLocaleString()}\` 🪙\nVotre Solde: \`${balance.toLocaleString()}\` 🪙`,
        alreadyOwned: '⚠️ Vous possédez déjà cette amélioration.',
        levelRequirement: (level, current) => `⚠️ **Niveau Requis Non Atteint**\nNiveau Requis: \`${level}\`\nVotre Niveau: \`${current}\``,
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
        purchaseError: '❌ Une erreur est survenue lors de l\'achat.',
        footer: 'ARCHITECT CG-223 • Marché Neural',
        purchaseComplete: '✅ ACHAT RÉUSSI',
        newBalance: 'Nouveau Solde',
        verifyWith: 'Vérifiez avec',
        checkBalance: 'Vérifiez votre solde avec `.bal` ou `.credits`',
        processing: '⚡ Transaction en cours...',
        loadingInventory: '⚡ Chargement de l\'inventaire...',
        purchaseDetails: 'DÉTAILS DE L\'ACHAT',
        itemPurchased: 'Article Acheté',
        pricePaid: 'Prix Payé',
        bonusReceived: 'Bonus Reçu',
        previousBalance: 'Solde Précédent'
    }
};

module.exports = {
    name: 'shop',
    aliases: ['store', 'market', 'boutique', 'magasin'],
    description: '💎 Spend your Archon Credits on exclusive upgrades.',
    category: 'ECONOMY',
    usage: '.shop',
    cooldown: 3000,
    examples: ['.shop'],

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
        const t = shopTranslations[lang];
        
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
        
        let userData = db.prepare(`SELECT credits, xp, level FROM users WHERE id = ?`).get(userId);
        
        if (!userData) {
            db.prepare(`INSERT INTO users (id, username, xp, level, credits) VALUES (?, ?, 0, 1, 0)`).run(userId, userName);
            userData = { credits: 0, xp: 0, level: 1 };
        }
        
        const balance = userData.credits || 0;
        const userLevel = userData.level || calculateLevel(userData.xp || 0);
        const shopItems = client.shopItems || [];
        
        const inventory = db.prepare(`SELECT item_id FROM user_inventory WHERE user_id = ? AND active = 1`).all(userId);
        const ownedItems = new Set(inventory.map(i => i.item_id));
        
        const getCurrentState = () => {
            try { db.prepare("PRAGMA wal_checkpoint(TRUNCATE)").run(); } catch (e) {}
            if (client.userDataCache) client.userDataCache.delete(userId);
            const currentData = db.prepare(`SELECT credits, xp, level FROM users WHERE id = ?`).get(userId);
            const currentInventory = db.prepare(`SELECT item_id FROM user_inventory WHERE user_id = ? AND active = 1`).all(userId);
            return {
                balance: currentData?.credits || 0,
                level: currentData?.level || calculateLevel(currentData?.xp || 0),
                owned: new Set(currentInventory.map(inv => inv.item_id))
            };
        };
        
        const shopEmbed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setAuthor({ name: '🏪 NEURAL MARKETPLACE', iconURL: client.user.displayAvatarURL() })
            .setTitle(t.title)
            .setDescription(`${t.desc}\n\n💰 **${t.balance}:** \`${balance.toLocaleString()}\` Credits\n📊 **${t.level}:** \`${userLevel}\``)
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
            .setTimestamp();
        
        const createMenuOptions = (ownedSet, currentLevel) => {
            return shopItems.map(item => {
                let description = `${item.price.toLocaleString()} Credits - ${item[lang]?.desc || item.en.desc}`;
                if (ownedSet.has(item.id)) description = `✅ ${t.owned} - ${description}`;
                if (item.requirement?.level && currentLevel < item.requirement.level) description = `🔒 ${t.locked} ${item.requirement.level} - ${description}`;
                return {
                    label: `${item.emoji} ${item[lang]?.name || item.en.name}`.substring(0, 100),
                    description: description.substring(0, 100),
                    value: item.id
                };
            });
        };
        
        const menu = new StringSelectMenuBuilder().setCustomId('shop_select').setPlaceholder(t.placeholder).addOptions(createMenuOptions(ownedItems, userLevel));
        const row = new ActionRowBuilder().addComponents(menu);
        const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('shop_inventory').setLabel(t.inventory).setStyle(ButtonStyle.Secondary).setEmoji('📦'),
            new ButtonBuilder().setCustomId('shop_refresh').setLabel(t.refresh).setStyle(ButtonStyle.Success).setEmoji('🔄')
        );
        
        const reply = await message.reply({ embeds: [shopEmbed], components: [row, buttonRow] }).catch(() => {});
        if (!reply) return;
        
        const collector = reply.createMessageComponentCollector({ time: 180000 });
        
        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) return i.reply({ content: t.accessDenied, ephemeral: true }).catch(() => {});
            
            if (!i.deferred && !i.replied) {
                try { await i.deferUpdate(); } catch (e) {}
            }
            
            if (i.customId === 'shop_inventory') {
                collector.stop();
                await i.editReply({ content: t.loadingInventory, embeds: [], components: [] }).catch(() => {});
                setTimeout(() => i.deleteReply().catch(() => {}), 500);
                const invCmd = client.commands.get('inventory');
                if (invCmd) return await invCmd.run(client, message, [], db, serverSettings, 'inventory');
                return;
            }
            
            if (i.customId === 'shop_refresh') {
                const { balance: currentBalance, level: currentLevel, owned: currentOwned } = getCurrentState();
                const refreshedEmbed = new EmbedBuilder()
                    .setColor('#f1c40f')
                    .setAuthor({ name: '🏪 NEURAL MARKETPLACE', iconURL: client.user.displayAvatarURL() })
                    .setTitle(t.title)
                    .setDescription(`${t.desc}\n\n💰 **${t.balance}:** \`${currentBalance.toLocaleString()}\` Credits\n📊 **${t.level}:** \`${currentLevel}\``)
                    .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
                    .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                    .setTimestamp();
                const refreshedMenu = new StringSelectMenuBuilder().setCustomId('shop_select').setPlaceholder(t.placeholder).addOptions(createMenuOptions(currentOwned, currentLevel));
                const refreshedRow = new ActionRowBuilder().addComponents(refreshedMenu);
                await i.editReply({ content: null, embeds: [refreshedEmbed], components: [refreshedRow, buttonRow] }).catch(() => {});
                return;
            }
            
            if (i.isStringSelectMenu() && i.customId === 'shop_select') {
                const selectedId = i.values[0];
                const selectedItem = shopItems.find(item => item.id === selectedId);
                if (!selectedItem) return i.followUp({ content: t.itemNotFound, ephemeral: true }).catch(() => {});
                
                const { balance: freshCredits, level: currentLevel, owned: currentOwned } = getCurrentState();
                if (currentOwned.has(selectedItem.id) && selectedItem.type !== 'consumable' && selectedItem.type !== 'boost') {
                    return i.followUp({ content: t.alreadyOwned, ephemeral: true }).catch(() => {});
                }
                if (selectedItem.requirement?.level && currentLevel < selectedItem.requirement.level) {
                    return i.followUp({ content: t.levelRequirement(selectedItem.requirement.level, currentLevel), ephemeral: true }).catch(() => {});
                }
                if (freshCredits < selectedItem.price) {
                    return i.followUp({ content: t.insufficientFunds(selectedItem.price, freshCredits), ephemeral: true }).catch(() => {});
                }
                
                try {
                    const currentUserData = db.prepare(`SELECT credits, xp FROM users WHERE id = ?`).get(userId);
                    const oldBalance = currentUserData?.credits || 0;
                    const oldXP = currentUserData?.xp || 0;
                    
                    const bonusXP = selectedItem.effect?.xp || 0;
                    const bonusCredits = selectedItem.effect?.credits || 0;
                    
                    const newCredits = oldBalance - selectedItem.price + bonusCredits;
                    const newXP = oldXP + bonusXP;
                    const newLevel = calculateLevel(newXP);
                    
                    db.prepare(`UPDATE users SET credits = ?, xp = ?, level = ? WHERE id = ?`).run(newCredits, newXP, newLevel, userId);
                    
                    // 🔥 FORCE WAL SYNC + CACHE INVALIDATION
                    try { db.prepare("PRAGMA wal_checkpoint(TRUNCATE)").run(); } catch (e) {}
                    if (client.userDataCache) client.userDataCache.delete(userId);
                    if (client.queueUserUpdate) {
                        client.queueUserUpdate(userId, { credits: newCredits, xp: newXP, level: newLevel, username: userName });
                    }
                    
                    const expiresAt = selectedItem.duration ? Math.floor(Date.now() / 1000) + (selectedItem.duration * 86400) : null;
                    
                    if (selectedItem.type === 'consumable') {
                        db.prepare(`INSERT INTO user_inventory (user_id, item_id, quantity, purchased_at, expires_at, active) VALUES (?, ?, 1, strftime('%s', 'now'), ?, 1) ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = quantity + 1, purchased_at = strftime('%s', 'now')`).run(userId, selectedItem.id, expiresAt);
                    } else {
                        db.prepare(`INSERT OR REPLACE INTO user_inventory (user_id, item_id, quantity, purchased_at, expires_at, active) VALUES (?, ?, 1, strftime('%s', 'now'), ?, 1)`).run(userId, selectedItem.id, expiresAt);
                    }
                    
                    if (selectedItem.type === 'role' && selectedItem.roleId && message.guild) {
                        try { const member = await message.guild.members.fetch(userId); await member.roles.add(selectedItem.roleId); } catch (err) {}
                    }
                    
                    const itemName = selectedItem[lang]?.name || selectedItem.en.name;
                    
                    const successEmbed = new EmbedBuilder()
                        .setColor('#2ecc71')
                        .setAuthor({ name: t.purchaseComplete, iconURL: avatarURL })
                        .setTitle(`${selectedItem.emoji} ${itemName}`)
                        .setDescription(
                            `\`\`\`yaml\n` +
                            `${t.itemPurchased}: ${itemName}\n` +
                            `${t.pricePaid}: -${selectedItem.price.toLocaleString()} 🪙\n` +
                            (bonusCredits > 0 ? `${t.bonusReceived}: +${bonusCredits.toLocaleString()} 🪙\n` : '') +
                            (bonusXP > 0 ? `XP Bonus: +${bonusXP} XP\n` : '') +
                            `${t.previousBalance}: ${oldBalance.toLocaleString()} 🪙\n` +
                            `${t.newBalance}: ${newCredits.toLocaleString()} 🪙\n` +
                            `\`\`\`\n\n` +
                            `💡 **${t.verifyWith} \`.bal\` or \`.credits\`**\n` +
                            `*${t.checkBalance}*`
                        )
                        .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                        .setTimestamp();
                    
                    await i.followUp({ embeds: [successEmbed], ephemeral: true }).catch(() => {});
                    
                    const { balance: finalBalance, level: finalLevel, owned: finalOwned } = getCurrentState();
                    const finalEmbed = new EmbedBuilder()
                        .setColor('#f1c40f')
                        .setAuthor({ name: '🏪 NEURAL MARKETPLACE', iconURL: client.user.displayAvatarURL() })
                        .setTitle(t.title)
                        .setDescription(`${t.desc}\n\n💰 **${t.balance}:** \`${finalBalance.toLocaleString()}\` Credits\n📊 **${t.level}:** \`${finalLevel}\``)
                        .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
                        .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                        .setTimestamp();
                    const finalMenu = new StringSelectMenuBuilder().setCustomId('shop_select').setPlaceholder(t.placeholder).addOptions(createMenuOptions(finalOwned, finalLevel));
                    const finalRow = new ActionRowBuilder().addComponents(finalMenu);
                    await reply.edit({ embeds: [finalEmbed], components: [finalRow, buttonRow] }).catch(() => {});
                    
                } catch (err) {
                    console.error('[SHOP] Purchase error:', err);
                    await i.followUp({ content: t.purchaseError, ephemeral: true }).catch(() => {});
                }
            }
        });
        
        collector.on('end', async () => {
            const disabledMenu = new StringSelectMenuBuilder(menu.data).setDisabled(true);
            const disabledRow = new ActionRowBuilder().addComponents(disabledMenu);
            const disabledButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('shop_inventory').setLabel(t.inventory).setStyle(ButtonStyle.Secondary).setDisabled(true).setEmoji('📦'),
                new ButtonBuilder().setCustomId('shop_refresh').setLabel(t.refresh).setStyle(ButtonStyle.Success).setDisabled(true).setEmoji('🔄')
            );
            await reply.edit({ components: [disabledRow, disabledButtons] }).catch(() => {});
        });
    }
};