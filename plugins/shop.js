const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

// ================= UNIFIED LEVEL CALCULATION =================
function calculateLevel(xp) { 
    return Math.floor(0.1 * Math.sqrt(xp)) + 1; 
}

// ================= SHOP TRANSLATIONS =================
const shopTranslations = {
    en: {
        title: '🏪 NEURAL MARKETPLACE',
        desc: 'Exchange your earned credits for system upgrades and status symbols.',
        placeholder: 'Select an upgrade to purchase...',
        balance: 'Balance',
        insufficientWithAmount: (price, balance) => `❌ **Insufficient Credits!**\n└─ Required: \`${price.toLocaleString()}\` Credits\n└─ Your Balance: \`${balance.toLocaleString()}\` Credits`,
        alreadyOwned: '⚠️ You already possess this upgrade.',
        levelRequirement: (level, current) => `⚠️ **Level Requirement Not Met**\n└─ Required Level: \`${level}\`\n└─ Your Level: \`${current}\``,
        inventory: '📦 Inventory',
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
        accessDenied: '❌ This menu is not yours.',
        itemNotFound: '❌ Item not found.',
        purchaseError: '❌ Purchase failed. Try again.',
        footer: 'ARCHITECT CG-223 • Neural Marketplace',
        purchaseComplete: '✅ PURCHASE COMPLETE',
        loading: '🔍 Loading marketplace...',
        bonusEffects: '✨ Bonus Effects',
        processing: '⚡ Processing...'
    },
    fr: {
        title: '🏪 MARCHÉ NEURAL',
        desc: 'Échangez vos crédits contre des améliorations système et des symboles de statut.',
        placeholder: 'Sélectionnez une amélioration...',
        balance: 'Solde',
        insufficientWithAmount: (price, balance) => `❌ **Crédits Insuffisants!**\n└─ Requis: \`${price.toLocaleString()}\` Crédits\n└─ Votre Solde: \`${balance.toLocaleString()}\` Crédits`,
        alreadyOwned: '⚠️ Vous possédez déjà cette amélioration.',
        levelRequirement: (level, current) => `⚠️ **Niveau Requis Non Atteint**\n└─ Niveau Requis: \`${level}\`\n└─ Votre Niveau: \`${current}\``,
        inventory: '📦 Inventaire',
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
        accessDenied: '❌ Ce menu ne vous appartient pas.',
        itemNotFound: '❌ Article introuvable.',
        purchaseError: '❌ Achat échoué. Réessayez.',
        footer: 'ARCHITECT CG-223 • Marché Neural',
        purchaseComplete: '✅ ACHAT RÉUSSI',
        loading: '🔍 Chargement du marché...',
        bonusEffects: '✨ Effets Bonus',
        processing: '⚡ Traitement...'
    }
};

module.exports = {
    name: 'shop',
    aliases: ['boutique', 'market', 'store', 'magasin'],
    description: '💎 Spend your Archon Credits on exclusive upgrades.',
    category: 'ECONOMY',
    usage: '.shop',
    cooldown: 3000,
    examples: ['.shop'],

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        
        // 🔥 NEURAL LANGUAGE BRIDGE
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, serverSettings?.language || 'en')
            : (serverSettings?.language || 'en');
        const t = shopTranslations[lang];
        
        const version = client.version || '1.6.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        
        const userId = message.author.id;
        const userName = message.author.username;
        const avatarURL = message.author.displayAvatarURL({ dynamic: true, size: 256 });
        const shopItems = client.shopItems || [];
        
        // ================= HELPER: GET FRESH DATA =================
        const getFreshData = () => {
            const now = Math.floor(Date.now() / 1000);
            db.prepare(`UPDATE user_inventory SET active = 0 WHERE expires_at IS NOT NULL AND expires_at > 0 AND expires_at < ? AND active = 1`).run(now);
            
            let userData = db.prepare(`SELECT credits, xp, level FROM users WHERE id = ?`).get(userId);
            if (!userData) {
                db.prepare(`INSERT INTO users (id, username, xp, level, credits) VALUES (?, ?, 0, 1, 0)`).run(userId, userName);
                userData = { credits: 0, xp: 0, level: 1 };
            }
            
            const inventory = db.prepare(`SELECT item_id FROM user_inventory WHERE user_id = ? AND active = 1`).all(userId);
            const ownedItems = new Set(inventory.map(i => i.item_id));
            
            return { ...userData, ownedItems };
        };
        
        // ================= BUILD EMBED =================
        const buildEmbed = (data) => {
            const { credits, xp, level } = data;
            const currentLevel = level || calculateLevel(xp || 0);
            
            return new EmbedBuilder()
                .setColor('#f1c40f')
                .setAuthor({ name: t.title, iconURL: client.user.displayAvatarURL() })
                .setTitle('═ NEURAL MARKETPLACE ═')
                .setDescription(`${t.desc}\n\n💰 **${t.balance}:** \`${credits.toLocaleString()}\` 🪙\n📊 **${t.level}:** \`${currentLevel}\``)
                .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
        };
        
        // ================= BUILD MENU OPTIONS =================
        const buildMenuOptions = (ownedSet, currentLevel) => {
            return shopItems.map(item => {
                let description = `${item.price.toLocaleString()} Credits - ${item[lang]?.desc || item.en.desc}`;
                if (ownedSet.has(item.id)) description = `✅ ${t.owned} - ${description}`;
                if (item.requirement?.level && currentLevel < item.requirement.level) description = `🔒 ${t.locked} ${item.requirement.level} - ${description}`;
                return {
                    label: `${item.emoji} ${item[lang]?.name || item.en.name}`.substring(0, 100),
                    description: description.substring(0, 100),
                    value: item.id,
                    emoji: item.emoji
                };
            });
        };
        
        // ================= INITIAL DISPLAY =================
        const initialData = getFreshData();
        const currentLevel = initialData.level || calculateLevel(initialData.xp || 0);
        
        const embed = buildEmbed(initialData);
        const menu = new StringSelectMenuBuilder()
            .setCustomId('shop_select')
            .setPlaceholder(t.placeholder)
            .addOptions(buildMenuOptions(initialData.ownedItems, currentLevel));
        
        const menuRow = new ActionRowBuilder().addComponents(menu);
        const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('shop_inv').setLabel(t.inventory).setStyle(ButtonStyle.Secondary).setEmoji('📦'),
            new ButtonBuilder().setCustomId('shop_refresh').setLabel(t.refresh).setStyle(ButtonStyle.Success).setEmoji('🔄')
        );
        
        const reply = await message.reply({ content: `> ${t.loading}`, embeds: [embed], components: [menuRow, buttonRow] });
        
        // ================= COLLECTOR =================
        const collector = reply.createMessageComponentCollector({ time: 180000 });
        
        collector.on('collect', async (i) => {
            if (i.user.id !== userId) {
                return i.reply({ content: t.accessDenied, ephemeral: true });
            }
            
            // Inventory Button
            if (i.customId === 'shop_inv') {
                await i.deferUpdate();
                collector.stop();
                await reply.delete().catch(() => {});
                const invCmd = client.commands.get('inventory');
                if (invCmd) return invCmd.run(client, message, [], db, serverSettings, usedCommand);
                return;
            }
            
            // Refresh Button
            if (i.customId === 'shop_refresh') {
                const freshData = getFreshData();
                const freshLevel = freshData.level || calculateLevel(freshData.xp || 0);
                const freshEmbed = buildEmbed(freshData);
                const freshMenu = new StringSelectMenuBuilder()
                    .setCustomId('shop_select')
                    .setPlaceholder(t.placeholder)
                    .addOptions(buildMenuOptions(freshData.ownedItems, freshLevel));
                const freshMenuRow = new ActionRowBuilder().addComponents(freshMenu);
                return i.update({ embeds: [freshEmbed], components: [freshMenuRow, buttonRow] });
            }
            
            // Purchase
            if (i.isStringSelectMenu() && i.customId === 'shop_select') {
                const itemId = i.values[0];
                const selectedItem = shopItems.find(item => item.id === itemId);
                if (!selectedItem) return i.reply({ content: t.itemNotFound, ephemeral: true });
                
                const freshData = getFreshData();
                const freshLevel = freshData.level || calculateLevel(freshData.xp || 0);
                
                if (freshData.ownedItems.has(itemId) && selectedItem.type !== 'consumable' && selectedItem.type !== 'boost') {
                    return i.reply({ content: t.alreadyOwned, ephemeral: true });
                }
                if (selectedItem.requirement?.level && freshLevel < selectedItem.requirement.level) {
                    return i.reply({ content: t.levelRequirement(selectedItem.requirement.level, freshLevel), ephemeral: true });
                }
                if (freshData.credits < selectedItem.price) {
                    return i.reply({ content: t.insufficientWithAmount(selectedItem.price, freshData.credits), ephemeral: true });
                }
                
                await i.deferReply({ ephemeral: true });
                
                try {
                    const bonusXP = selectedItem.effect?.xp || 0;
                    const bonusCredits = selectedItem.effect?.credits || 0;
                    const newCredits = freshData.credits - selectedItem.price + bonusCredits;
                    const newXP = (freshData.xp || 0) + bonusXP;
                    const newLevel = calculateLevel(newXP);
                    
                    db.prepare(`UPDATE users SET credits = ?, xp = ?, level = ? WHERE id = ?`).run(newCredits, newXP, newLevel, userId);
                    
                    const expiresAt = selectedItem.duration ? Math.floor(Date.now() / 1000) + (selectedItem.duration * 86400) : null;
                    
                    if (selectedItem.type === 'consumable') {
                        db.prepare(`INSERT INTO user_inventory (user_id, item_id, quantity, purchased_at, expires_at, active) VALUES (?, ?, 1, strftime('%s', 'now'), ?, 1) ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = quantity + 1`).run(userId, itemId, expiresAt);
                    } else {
                        db.prepare(`INSERT OR REPLACE INTO user_inventory (user_id, item_id, quantity, purchased_at, expires_at, active) VALUES (?, ?, 1, strftime('%s', 'now'), ?, 1)`).run(userId, itemId, expiresAt);
                    }
                    
                    if (selectedItem.type === 'role' && selectedItem.roleId && message.guild) {
                        try { await (await message.guild.members.fetch(userId)).roles.add(selectedItem.roleId); } catch (e) {}
                    }
                    
                    const itemName = selectedItem[lang]?.name || selectedItem.en.name;
                    const successEmbed = new EmbedBuilder()
                        .setColor('#2ecc71')
                        .setAuthor({ name: t.purchaseComplete, iconURL: avatarURL })
                        .setTitle(`${selectedItem.emoji} ${itemName}`)
                        .setDescription(`${selectedItem[lang]?.perk || selectedItem.en.perk}`)
                        .addFields(
                            { name: t.price, value: `\`-${selectedItem.price.toLocaleString()}\` 🪙`, inline: true },
                            { name: t.type, value: `\`${t[selectedItem.type] || t.consumable}\``, inline: true }
                        );
                    
                    if (expiresAt) successEmbed.addFields({ name: t.expires, value: `<t:${expiresAt}:R>`, inline: true });
                    else successEmbed.addFields({ name: t.expires, value: t.permanentItem, inline: true });
                    
                    if (bonusXP > 0 || bonusCredits > 0) {
                        successEmbed.addFields({ name: t.bonusEffects, value: `${bonusXP > 0 ? `✨ +${bonusXP} XP\n` : ''}${bonusCredits > 0 ? `💰 +${bonusCredits} Credits` : ''}`, inline: false });
                    }
                    
                    successEmbed.setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon }).setTimestamp();
                    await i.editReply({ embeds: [successEmbed] });
                    
                    const finalData = getFreshData();
                    const finalLevel = finalData.level || calculateLevel(finalData.xp || 0);
                    const finalEmbed = buildEmbed(finalData);
                    const finalMenu = new StringSelectMenuBuilder()
                        .setCustomId('shop_select')
                        .setPlaceholder(t.placeholder)
                        .addOptions(buildMenuOptions(finalData.ownedItems, finalLevel));
                    const finalMenuRow = new ActionRowBuilder().addComponents(finalMenu);
                    
                    await reply.edit({ embeds: [finalEmbed], components: [finalMenuRow, buttonRow] });
                    console.log(`[SHOP] ${userName} purchased ${itemId} | Balance: ${newCredits} 🪙`);
                    
                } catch (err) {
                    console.error('[SHOP] Error:', err);
                    await i.editReply({ content: t.purchaseError });
                }
            }
        });
        
        collector.on('end', async () => {
            const disabledMenu = new StringSelectMenuBuilder().setCustomId('shop_select').setPlaceholder(t.placeholder).setDisabled(true).addOptions([{ label: 'Session Ended', value: 'none' }]);
            const disabledMenuRow = new ActionRowBuilder().addComponents(disabledMenu);
            const disabledButtonRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('shop_inv').setLabel(t.inventory).setStyle(ButtonStyle.Secondary).setDisabled(true).setEmoji('📦'),
                new ButtonBuilder().setCustomId('shop_refresh').setLabel(t.refresh).setStyle(ButtonStyle.Success).setDisabled(true).setEmoji('🔄')
            );
            await reply.edit({ components: [disabledMenuRow, disabledButtonRow] }).catch(() => {});
        });
    }
};