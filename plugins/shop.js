const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');

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
        checkBalance: (prefix) => `Check your balance anytime with \`${prefix}bal\` or \`${prefix}credits\``,
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
        checkBalance: (prefix) => `Vérifiez votre solde avec \`${prefix}bal\` ou \`${prefix}credits\``,
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

// ================= SLASH COMMAND DATA =================
data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('💎 Spend your Archon Credits on exclusive upgrades'),

run: async (client, message, args, db, serverSettings, usedCommand) => {
        
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
        const t = shopTranslations[lang];
        
        const version = client.version || '1.7.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        const prefix = serverSettings?.prefix || '.';
        
        const userId = message.author.id;
        const userName = message.author.username;
        const avatarURL = message.author.displayAvatarURL({ dynamic: true, size: 256 });
        
        const now = Math.floor(Date.now() / 1000);
        db.prepare(`UPDATE user_inventory SET active = 0 WHERE expires_at IS NOT NULL AND expires_at > 0 AND expires_at < ? AND active = 1`).run(now);
        
        // 🔥 FORCE WAL SYNC before reading
        try { db.prepare("PRAGMA wal_checkpoint(TRUNCATE)").run(); } catch (e) {}
        if (client.userDataCache) client.userDataCache.delete(`${userId}:${message.guild?.id || "DM"}`);
        
        let userData = db.prepare(`SELECT credits, xp, level, streak_protections FROM users WHERE id = ? AND guild_id = ?`).get(userId, message.guild?.id || "DM");
        
        if (!userData) {
            db.prepare(`INSERT INTO users (id, guild_id, username, xp, level, credits, streak_days, last_daily, total_dailies, highest_streak) VALUES (?, ?, ?, 0, 1, 0, 0, 0, 0, 0)`).run(userId, message.guild?.id || "DM", userName);
            userData = { credits: 0, xp: 0, level: 1 };
        }
        
        const balance = userData.credits || 0;
        const userLevel = userData.level || calculateLevel(userData.xp || 0);
        const shopItems = client.shopItems || [];
        
        const inventory = db.prepare(`SELECT item_id FROM user_inventory WHERE user_id = ? AND active = 1`).all(userId);
        const ownedItems = new Set(inventory.map(i => i.item_id));
        
        const getCurrentState = () => {
    try { db.prepare("PRAGMA wal_checkpoint(TRUNCATE)").run(); } catch (e) {}
    if (client.userDataCache) client.userDataCache.delete(`${userId}:${message.guild?.id || "DM"}`);
    const currentData = db.prepare(`SELECT credits, xp, level, streak_protections FROM users WHERE id = ? AND guild_id = ?`).get(userId, message.guild?.id || "DM");
    const currentInventory = db.prepare(`SELECT item_id FROM user_inventory WHERE user_id = ? AND active = 1`).all(userId);
    return {
        balance: currentData?.credits || 0,
        level: currentData?.level || calculateLevel(currentData?.xp || 0),
        streakProtections: currentData?.streak_protections || 0,
        owned: new Set(currentInventory.map(inv => inv.item_id))
    };
};
        
        const shopEmbed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setAuthor({ name: '🏪 NEURAL MARKETPLACE', iconURL: client.user.displayAvatarURL() })
            .setTitle(t.title)
            .setDescription(`${t.desc}\n\n💰 **${t.balance}:** \`${balance.toLocaleString()}\` Credits\n📊 **${t.level}:** \`${userLevel}\`\n🛡️ **Streak Protections:** \`${userData.streak_protections || 0}\``)
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
            .setTimestamp();
        
        const createMenuOptions = (ownedSet, currentLevel) => {
            return shopItems.map(item => {
                const itemName = item[lang]?.name || item.en?.name || item.name || item.id;
                const itemDesc = item[lang]?.desc || item.en?.desc || item.desc || '';
                let description = `${item.price.toLocaleString()} Credits - ${itemDesc}`;
                if (ownedSet.has(item.id)) description = `✅ ${t.owned} - ${description}`;
                if (item.requirement?.level && currentLevel < item.requirement.level) description = `🔒 ${t.locked} ${item.requirement.level} - ${description}`;
                return {
                    label: `${item.emoji || '📦'} ${itemName}`.substring(0, 100),
                    description: description.substring(0, 100),
                    value: item.id
                };
            });
        };
        
        console.log('[SHOP DEBUG] Building menu with', shopItems.length, 'items');
        const menuOptions = createMenuOptions(ownedItems, userLevel);
        console.log('[SHOP DEBUG] Menu options built:', menuOptions.length);
        const menu = new StringSelectMenuBuilder().setCustomId('shop_select').setPlaceholder(t.placeholder).addOptions(menuOptions);
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
                    const currentUserData = db.prepare(`SELECT credits, xp FROM users WHERE id = ? AND guild_id = ?`).get(userId, message.guild?.id || "DM");
                    const oldBalance = currentUserData?.credits || 0;
                    const oldXP = currentUserData?.xp || 0;
                    
                    const bonusXP = selectedItem.effect?.xp || 0;
const bonusCredits = selectedItem.effect?.credits || 0;

const newCredits = oldBalance - selectedItem.price + bonusCredits;
const newXP = oldXP + bonusXP;
const newLevel = calculateLevel(newXP);

if (selectedItem.effect?.streak_protection) {
    // Streak Shield: add protection instead of XP/Credits
    db.prepare(`UPDATE users SET credits = ?, streak_protections = COALESCE(streak_protections, 0) + 1 WHERE id = ? AND guild_id = ?`).run(newCredits, userId, message.guild?.id || "DM");
} else {
    db.prepare(`UPDATE users SET credits = ?, xp = ?, level = ? WHERE id = ? AND guild_id = ?`).run(newCredits, newXP, newLevel, userId, message.guild?.id || "DM");
}
                    
                    // 🔥 FORCE WAL SYNC + CACHE INVALIDATION
                    try { db.prepare("PRAGMA wal_checkpoint(TRUNCATE)").run(); } catch (e) {}
                    if (client.userDataCache) client.userDataCache.delete(`${userId}:${message.guild?.id || "DM"}`);
                    if (client.queueUserUpdate) {
                        client.queueUserUpdate(userId, message.guild?.id || "DM", { credits: newCredits, xp: newXP, level: newLevel, username: userName, guild_id: message.guild?.id || "DM" });
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
                   (selectedItem.effect?.streak_protection ? `🛡️ Streak Protection: +1\n` : '') +
                            (bonusXP > 0 ? `XP Bonus: +${bonusXP} XP\n` : '') +
                            `${t.previousBalance}: ${oldBalance.toLocaleString()} 🪙\n` +
                            `${t.newBalance}: ${newCredits.toLocaleString()} 🪙\n` +
                            `\`\`\`\n\n` +
                            `💡 **${t.verifyWith} \`${prefix}bal\` or \`${prefix}credits\`**\n` +
                            `*${t.checkBalance(prefix)}*`
                        )
                        .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                        .setTimestamp();
                    
                    await i.followUp({ embeds: [successEmbed], ephemeral: true }).catch(() => {});

                    // 📢 Send purchase notification to configured shop channel
                    try {
                        const sSettings = client.getServerSettings ? client.getServerSettings(message.guild?.id) : {};
                        const shopChanId = sSettings?.shopChannel;
                        if (shopChanId && message.guild) {
                            const shopChannel = message.guild.channels.cache.get(shopChanId);
                            if (shopChannel) {
                                const notifEmbed = new EmbedBuilder()
                                    .setColor('#2ecc71')
                                    .setAuthor({ name: '🛒 NEURAL MARKETPLACE • PURCHASE', iconURL: message.author.displayAvatarURL() })
                                    .setDescription(
                                        `**${message.author.tag}** purchased **${itemName}** ${selectedItem.emoji}\n` +
                                        `💰 **Price:** ${selectedItem.price.toLocaleString()} 🪙\n` +
                                        `📊 **New Balance:** ${newCredits.toLocaleString()} 🪙`
                                    )
                                    .setFooter({ text: `${guildName} • ARCHITECT CG-223`, iconURL: guildIcon })
                                    .setTimestamp();
                                await shopChannel.send({ embeds: [notifEmbed] }).catch(() => {});
                            }
                        }
                    } catch (e) {}
                    
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
    },

    // ================= SLASH COMMAND EXECUTION =================
    execute: async (interaction, client) => {
        await interaction.deferReply();
        const serverSettings = interaction.guild ? client.getServerSettings(interaction.guild.id) : { prefix: '.' };
        const db = client.db;
        const lang = serverSettings?.language === 'fr' ? 'fr' : 'en';
        const t = shopTranslations[lang];
        const version = client.version || '1.7.0';
        const guildName = interaction.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = interaction.guild?.iconURL() || client.user.displayAvatarURL();
        const userId = interaction.user.id;
        const userName = interaction.user.username;
        const guildId = interaction.guild?.id || 'DM';

        let userData = db.prepare('SELECT credits, xp, level, streak_protections FROM users WHERE id = ? AND guild_id = ?').get(userId, guildId);
        if (!userData) {
            db.prepare('INSERT OR IGNORE INTO users (id, guild_id, username, xp, level, credits) VALUES (?, ?, ?, 0, 1, 0)').run(userId, guildId, userName);
            userData = { credits: 0, xp: 0, level: 1, streak_protections: 0 };
        }

        const balance = userData.credits || 0;
        const userLevel = userData.level || 1;
        const shopItems = client.shopItems || [];
        const inventory = db.prepare('SELECT item_id FROM user_inventory WHERE user_id = ? AND active = 1').all(userId);
        const ownedItems = new Set(inventory.map(i => i.item_id));

        const shopEmbed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setAuthor({ name: '🏪 NEURAL MARKETPLACE', iconURL: client.user.displayAvatarURL() })
            .setTitle(t.title)
            .setDescription(t.desc + '\n\n💰 **' + t.balance + ':** `' + balance.toLocaleString() + '` Credits\n📊 **' + t.level + ':** `' + userLevel + '`')
            .setFooter({ text: guildName + ' • ' + t.footer + ' • v' + version, iconURL: guildIcon })
            .setTimestamp();

        const buildOptions = (ownedSet, lvl) => shopItems.map(item => {
            const name = item[lang]?.name || item.en?.name || item.name || item.id;
            const desc = item[lang]?.desc || item.en?.desc || item.desc || '';
            let label = (item.emoji || '📦') + ' ' + name;
            let description = item.price?.toLocaleString() + ' Credits - ' + desc;
            if (ownedSet.has(item.id)) description = '✅ Owned - ' + description;
            if (item.requirement?.level && lvl < item.requirement.level) description = '🔒 Lv.' + item.requirement.level + ' - ' + description;
            return { label: label.substring(0, 100), description: description.substring(0, 100), value: item.id };
        });

        const menu = new StringSelectMenuBuilder().setCustomId('shop_s').setPlaceholder(t.placeholder).addOptions(buildOptions(ownedItems, userLevel));
        const row = new ActionRowBuilder().addComponents(menu);
        const btnRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('shop_inv_s').setLabel(t.inventory).setStyle(ButtonStyle.Secondary).setEmoji('📦'),
            new ButtonBuilder().setCustomId('shop_ref_s').setLabel(t.refresh).setStyle(ButtonStyle.Success).setEmoji('🔄')
        );

        const reply = await interaction.editReply({ embeds: [shopEmbed], components: [row, btnRow] });
        const collector = reply.createMessageComponentCollector({ time: 180000 });

        collector.on('collect', async (i) => {
            if (i.user.id !== userId) return i.reply({ content: t.accessDenied, flags: 64 }).catch(() => {});
            try { await i.deferUpdate(); } catch (e) {}

            if (i.customId === 'shop_ref_s') {
                const fd = db.prepare('SELECT credits, level FROM users WHERE id = ? AND guild_id = ?').get(userId, guildId);
                const fi = db.prepare('SELECT item_id FROM user_inventory WHERE user_id = ? AND active = 1').all(userId);
                const fo = new Set(fi.map(x => x.item_id));
                const refreshedEmbed = new EmbedBuilder().setColor('#f1c40f')
                    .setAuthor({ name: '🏪 NEURAL MARKETPLACE', iconURL: client.user.displayAvatarURL() })
                    .setTitle(t.title)
                    .setDescription(t.desc + '\n\n💰 **' + t.balance + ':** `' + (fd?.credits || 0).toLocaleString() + '` Credits')
                    .setFooter({ text: guildName + ' • ' + t.footer, iconURL: guildIcon }).setTimestamp();
                const rm = new StringSelectMenuBuilder().setCustomId('shop_s').setPlaceholder(t.placeholder).addOptions(buildOptions(fo, fd?.level || 1));
                await i.editReply({ embeds: [refreshedEmbed], components: [new ActionRowBuilder().addComponents(rm), btnRow] }).catch(() => {});
            }

            if (i.customId === 'shop_s') {
                const selId = i.values[0];
                const selItem = shopItems.find(x => x.id === selId);
                if (!selItem) return;
                const fd = db.prepare('SELECT credits, level FROM users WHERE id = ? AND guild_id = ?').get(userId, guildId);
                const curBal = fd?.credits || 0;
                const curLvl = fd?.level || 1;
                if (selItem.requirement?.level && curLvl < selItem.requirement.level) {
                    return i.followUp({ content: '🔒 Requires level ' + selItem.requirement.level, flags: 64 }).catch(() => {});
                }
                if (curBal < selItem.price) {
                    return i.followUp({ content: '❌ Insufficient funds! Need ' + selItem.price?.toLocaleString() + ' but have ' + curBal.toLocaleString(), flags: 64 }).catch(() => {});
                }
                const newBal = curBal - selItem.price;
                db.prepare('UPDATE users SET credits = ? WHERE id = ? AND guild_id = ?').run(newBal, userId, guildId);
                const ex = db.prepare('SELECT quantity FROM user_inventory WHERE user_id = ? AND item_id = ?').get(userId, selId);
                if (ex) {
                    db.prepare('UPDATE user_inventory SET quantity = quantity + 1 WHERE user_id = ? AND item_id = ?').run(userId, selId);
                } else {
                    db.prepare('INSERT INTO user_inventory (user_id, item_id, quantity, active) VALUES (?, ?, 1, 1)').run(userId, selId);
                }
                if (client.userDataCache) client.userDataCache.delete(userId + ':' + guildId);
                const itemName = selItem[lang]?.name || selItem.en?.name || selItem.name;
                const itemPerk = selItem[lang]?.perk || selItem.en?.perk || '';
                await i.followUp({ content: '✅ **PURCHASE SUCCESSFUL**\n' + selItem.emoji + ' **' + itemName + '** acquired!\n💰 New balance: `' + newBal.toLocaleString() + '` Credits\n⚡ ' + itemPerk, flags: 64 }).catch(() => {});
            }
        });

        collector.on('end', async () => {
            try { await interaction.editReply({ components: [] }).catch(() => {}); } catch (e) {}
        });
    }
};