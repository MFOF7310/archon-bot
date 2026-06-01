const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, SlashCommandBuilder } = require('discord.js');

// ================= UNIFIED LEVEL CALCULATION =================
function calculateLevel(xp) { 
    return Math.floor(0.1 * Math.sqrt(xp || 0)) + 1; 
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

// ================= USE COMMAND TRANSLATIONS =================
const useTranslations = {
    en: {
        title: '⚡ ITEM ACTIVATION',
        selectPrompt: 'Select an item to use',
        selectPlaceholder: 'Choose an item from your inventory',
        noItems: '❌ You have no usable items in your inventory!',
        noItemsDesc: 'Visit the shop to buy consumable items like XP Boosts, Credit Boosts, or Mystery Boxes.',
        shopHint: '🛒 Go to Shop',
        useSuccess: '✅ **ITEM USED SUCCESSFULLY**',
        xpGain: '💪 **XP Boost Applied!**\n└─ +{amount} XP',
        creditGain: '🪙 **Credit Boost Applied!**\n└─ +{amount} Credits',
        mysteryReward: '🎁 **Mystery Box Opened!**\n└─ You received: +{amount} {type}',
        levelUp: '🎉 **LEVEL UP!**\n└─ You are now Level {level} ({rank})',
        newRank: '🏅 **RANK UP!**\n└─ {oldRank} → {newRank}',
        remaining: '📦 Remaining: {quantity} left',
        used: 'Used',
        error: '❌ **Error**\n└─ Could not use that item.',
        footer: 'ARCHITECT CG-223 • Neural Item System',
        accessDenied: '❌ This menu is not for you.',
        itemNotFound: '❌ Item not found in your inventory.',
        alreadyUsed: '❌ This item has already been used or expired.',
        backToInventory: '📦 Back to Inventory',
        close: '❌ Close'
    },
    fr: {
        title: '⚡ ACTIVATION D\'ARTICLE',
        selectPrompt: 'Sélectionnez un article à utiliser',
        selectPlaceholder: 'Choisissez un article de votre inventaire',
        noItems: '❌ Vous n\'avez aucun article utilisable dans votre inventaire!',
        noItemsDesc: 'Visitez la boutique pour acheter des articles consommables comme des Boost XP, Boost Crédits ou Boîtes Mystère.',
        shopHint: '🛒 Aller à la Boutique',
        useSuccess: '✅ **ARTICLE UTILISÉ AVEC SUCCÈS**',
        xpGain: '💪 **Boost XP Appliqué!**\n└─ +{amount} XP',
        creditGain: '🪙 **Boost Crédits Appliqué!**\n└─ +{amount} Crédits',
        mysteryReward: '🎁 **Boîte Mystère Ouverte!**\n└─ Vous avez reçu: +{amount} {type}',
        levelUp: '🎉 **MONTÉE DE NIVEAU!**\n└─ Vous êtes maintenant Niveau {level} ({rank})',
        newRank: '🏅 **MONTÉE DE RANG!**\n└─ {oldRank} → {newRank}',
        remaining: '📦 Restant: {quantity} exemplaire(s)',
        error: '❌ **Erreur**\n└─ Impossible d\'utiliser cet article.',
        footer: 'ARCHITECT CG-223 • Système Neural d\'Articles',
        accessDenied: '❌ Ce menu ne vous appartient pas.',
        itemNotFound: '❌ Article introuvable dans votre inventaire.',
        alreadyUsed: '❌ Cet article a déjà été utilisé ou a expiré.',
        backToInventory: '📦 Retour à l\'Inventaire',
        close: '❌ Fermer'
    }
};

module.exports = {
    name: 'use',
    aliases: ['utiliser', 'activate', 'open', 'consume'],
    description: '🎁 Use an item from your inventory (XP Boosts, Credit Boosts, Mystery Boxes, etc.)',
    category: 'ECONOMY',
    usage: '.use [item name] or /use',
    cooldown: 3000,
    examples: ['.use', '.use xp_boost_small'],

    data: new SlashCommandBuilder()
        .setName('use')
        .setDescription('🎁 Use an item from your inventory')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('Item to use (leave empty to open menu)')
                .setRequired(false)
                .setAutocomplete(true)
        ),

    autocomplete: async (interaction, client) => {
        const focusedValue = interaction.options.getFocused();
        const userId = interaction.user.id;
        const db = client.db;
        
        const usableItems = db.prepare(`
            SELECT ui.item_id, ui.quantity, si.en->>'name' as name
            FROM user_inventory ui
            JOIN shop_items si ON ui.item_id = si.id
            WHERE ui.user_id = ? AND ui.active = 1 AND ui.quantity > 0
            AND (si.type = 'consumable' OR si.type = 'boost')
            ORDER BY si.price DESC
        `).all(userId);
        
        const choices = usableItems
            .filter(item => item.name.toLowerCase().includes(focusedValue.toLowerCase()))
            .slice(0, 25)
            .map(item => ({
                name: `${item.name} (x${item.quantity})`,
                value: item.item_id
            }));
        
        await interaction.respond(choices).catch(() => {});
    },

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
        const t = useTranslations[lang];
        const userId = message.author.id;
        const userName = message.author.username;
        const avatarURL = message.author.displayAvatarURL({ dynamic: true, size: 256 });
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const version = client.version || '1.7.0';
        
        const directItemId = args[0];
        
        const getUsableItems = () => {
            return db.prepare(`
                SELECT ui.item_id, ui.quantity, ui.expires_at
                FROM user_inventory ui
                WHERE ui.user_id = ? AND ui.active = 1 AND ui.quantity > 0
            `).all(userId);
        };
        
        const shopItems = client.shopItems || [];
        const itemsMap = new Map(shopItems.map(item => [item.id, item]));
        
        const usableItems = getUsableItems().filter(inv => {
            const item = itemsMap.get(inv.item_id);
            return item && (item.type === 'consumable' || item.type === 'boost');
        });
        
        if (usableItems.length === 0) {
            const noItemsEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setAuthor({ name: t.title, iconURL: avatarURL })
                .setTitle(t.noItems)
                .setDescription(t.noItemsDesc)
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: message.guild?.iconURL() })
                .setTimestamp();
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('use_shop').setLabel(t.shopHint).setStyle(ButtonStyle.Success).setEmoji('🛒')
            );
            
            const reply = await message.reply({ embeds: [noItemsEmbed], components: [row] }).catch(() => {});
            if (!reply) return;
            
            const collector = reply.createMessageComponentCollector({ time: 30000 });
            collector.on('collect', async (i) => {
                if (i.user.id !== userId) return i.reply({ content: t.accessDenied, ephemeral: true }).catch(() => {});
                if (i.customId === 'use_shop') {
                    collector.stop();
                    await reply.delete().catch(() => {});
                    const shopCmd = client.commands.get('shop');
                    if (shopCmd) return await shopCmd.run(client, message, [], db, serverSettings, 'shop');
                }
            });
            return;
        }
        
        if (directItemId) {
            const targetItem = usableItems.find(i => i.item_id === directItemId);
            if (!targetItem) {
                return message.reply({ content: t.itemNotFound, ephemeral: true }).catch(() => {});
            }
            await processItemUse(client, message, db, userId, targetItem.item_id, itemsMap, t, lang, guildName, version);
            return;
        }
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('use_select')
            .setPlaceholder(t.selectPlaceholder)
            .setMinValues(1)
            .setMaxValues(1);
        
        usableItems.slice(0, 25).forEach(inv => {
            const item = itemsMap.get(inv.item_id);
            if (item) {
                const itemName = item[lang]?.name || item.en.name;
                selectMenu.addOptions({
                    label: `${itemName} (x${inv.quantity})`,
                    description: `${item.type === 'consumable' ? '⚡' : '💪'} ${item.en.desc?.substring(0, 50) || 'Usable item'}`,
                    value: inv.item_id,
                    emoji: '📦'
                });
            }
        });
        
        const actionRow = new ActionRowBuilder().addComponents(selectMenu);
        const backRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('use_cancel').setLabel(t.close).setStyle(ButtonStyle.Danger).setEmoji('❌'),
            new ButtonBuilder().setCustomId('use_inventory').setLabel(t.backToInventory).setStyle(ButtonStyle.Secondary).setEmoji('📦')
        );
        
        const useEmbed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setAuthor({ name: t.title, iconURL: avatarURL })
            .setTitle('🎁 SELECT AN ITEM')
            .setDescription(`\`\`\`yaml\n📦 Usable Items: ${usableItems.length}\n💡 Select an item from the dropdown below to use it.\n⚠️ Consumable items will be removed after use.\n\`\`\``)
            .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: message.guild?.iconURL() })
            .setTimestamp();
        
        const reply = await message.reply({ embeds: [useEmbed], components: [actionRow, backRow] }).catch(() => {});
        if (!reply) return;
        
        const collector = reply.createMessageComponentCollector({ time: 60000 });
        
        collector.on('collect', async (i) => {
            if (i.user.id !== userId) {
                return i.reply({ content: t.accessDenied, ephemeral: true }).catch(() => {});
            }
            
            await i.deferUpdate().catch(() => {});
            
            if (i.customId === 'use_select') {
                const selectedItemId = i.values[0];
                await processItemUse(client, message, db, userId, selectedItemId, itemsMap, t, lang, guildName, version);
                collector.stop();
                await reply.delete().catch(() => {});
            } else if (i.customId === 'use_inventory') {
                collector.stop();
                await reply.delete().catch(() => {});
                const invCmd = client.commands.get('inventory');
                if (invCmd) return await invCmd.run(client, message, [], db, serverSettings, 'inventory');
            } else if (i.customId === 'use_cancel') {
                collector.stop();
                await reply.delete().catch(() => {});
            }
        });
    },
    
    execute: async (interaction, client) => {
        const itemId = interaction.options.getString('item');
        const db = client.db;
        const userId = interaction.user.id;
        const shopItems = client.shopItems || [];
        const itemsMap = new Map(shopItems.map(item => [item.id, item]));
        
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = useTranslations[lang];
        
        const getUsableItems = () => {
            return db.prepare(`
                SELECT ui.item_id, ui.quantity, ui.expires_at
                FROM user_inventory ui
                WHERE ui.user_id = ? AND ui.active = 1 AND ui.quantity > 0
            `).all(userId);
        };
        
        const usableItems = getUsableItems().filter(inv => {
            const item = itemsMap.get(inv.item_id);
            return item && (item.type === 'consumable' || item.type === 'boost');
        });
        
        if (usableItems.length === 0) {
            const noItemsEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle(t.noItems)
                .setDescription(t.noItemsDesc);
            return interaction.reply({ embeds: [noItemsEmbed], ephemeral: true });
        }
        
        if (itemId) {
            const targetItem = usableItems.find(i => i.item_id === itemId);
            if (!targetItem) {
                return interaction.reply({ content: t.itemNotFound, ephemeral: true });
            }
            
            await interaction.deferReply().catch(err => {
                console.error('[USE] Defer error:', err);
                return;
            });
            
            await processItemUseForSlash(client, interaction, db, userId, itemId, itemsMap, t, lang, interaction.guild?.name, client.version);
            return;
        }
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('use_select')
            .setPlaceholder(t.selectPlaceholder)
            .setMinValues(1)
            .setMaxValues(1);
        
        usableItems.slice(0, 25).forEach(inv => {
            const item = itemsMap.get(inv.item_id);
            if (item) {
                const itemName = item[lang]?.name || item.en.name;
                selectMenu.addOptions({
                    label: `${itemName} (x${inv.quantity})`,
                    description: `${item.type === 'consumable' ? '⚡' : '💪'} ${item.en.desc?.substring(0, 50) || 'Usable item'}`,
                    value: inv.item_id,
                    emoji: '📦'
                });
            }
        });
        
        const actionRow = new ActionRowBuilder().addComponents(selectMenu);
        
        const useEmbed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle('🎁 SELECT AN ITEM')
            .setDescription(`📦 You have **${usableItems.length}** usable items.\nSelect one from the dropdown to use it.`);
        
        await interaction.reply({ embeds: [useEmbed], components: [actionRow], ephemeral: true });
        
        const collector = interaction.channel.createMessageComponentCollector({ 
            filter: i => i.user.id === interaction.user.id && i.customId === 'use_select',
            time: 60000,
            max: 1
        });

        collector.on('collect', async (i) => {
            const selectedItemId = i.values[0];
            await i.deferUpdate().catch(err => {
                console.error('[USE] Defer error in collector:', err);
            });
            
            await processItemUseForSlash(client, i, db, userId, selectedItemId, itemsMap, t, lang, interaction.guild?.name, client.version);
        });
    }
};

// ================= SLASH-SPECIFIC ITEM PROCESSING =================
async function processItemUseForSlash(client, interaction, db, userId, itemId, itemsMap, t, lang, guildName, version) {
    const item = itemsMap.get(itemId);
    if (!item) {
        return interaction.editReply({ content: t.itemNotFound }).catch(() => {});
    }
    
    const inventoryItem = db.prepare(`
        SELECT quantity, expires_at 
        FROM user_inventory 
        WHERE user_id = ? AND item_id = ? AND active = 1 AND quantity > 0
    `).get(userId, itemId);
    
    if (!inventoryItem) {
        return interaction.editReply({ content: t.itemNotFound }).catch(() => {});
    }
    
    if (inventoryItem.expires_at && inventoryItem.expires_at < Math.floor(Date.now() / 1000)) {
        db.prepare(`UPDATE user_inventory SET active = 0 WHERE user_id = ? AND item_id = ?`).run(userId, itemId);
        return interaction.editReply({ content: t.alreadyUsed }).catch(() => {});
    }
    
    // PER-SERVER: All user lookups include guildId
    const guildId = interaction.guild?.id || 'DM';
    let userData = client.getUserData ? client.getUserData(userId, guildId) : db.prepare(`SELECT * FROM users WHERE id = ? AND guild_id = ?`).get(userId, guildId);
    if (!userData) {
        userData = { id: userId, guild_id: guildId, username: interaction.user.username, credits: 0, xp: 0, level: 1 };
    }
    
    let newXP = userData.xp || 0;
    let newCredits = userData.credits || 0;
    let effectMessage = '';
    let rewardType = '';
    let rewardAmount = 0;
    
    if (item.effect) {
        if (item.effect.xp) {
            newXP += item.effect.xp;
            rewardAmount = item.effect.xp;
            rewardType = 'XP';
            effectMessage = t.xpGain.replace('{amount}', item.effect.xp);
        }
        if (item.effect.credits) {
            newCredits += item.effect.credits;
            rewardAmount = item.effect.credits;
            rewardType = 'Credits';
            effectMessage = t.creditGain.replace('{amount}', item.effect.credits);
        }
                if (item.effect.random) {
        const randomReward = item.effect.random[Math.floor(Math.random() * item.effect.random.length)];
        if (randomReward.xp) {
            newXP += randomReward.xp;
            rewardAmount = randomReward.xp;
            rewardType = 'XP';
            effectMessage = t.mysteryReward.replace('{amount}', randomReward.xp).replace('{type}', 'XP');
        } else if (randomReward.credits) {
            newCredits += randomReward.credits;
            rewardAmount = randomReward.credits;
            rewardType = 'Credits';
            effectMessage = t.mysteryReward.replace('{amount}', randomReward.credits).replace('{type}', 'Credits');
        }
    }
    if (item.effect.streak_protection) {
        rewardAmount = 1;
        rewardType = 'Streak Protection';
        effectMessage = '🛡️ **Streak Protection Activated!**\n└─ Your streak is protected for 1 missed day.';
    }
}
    
    const oldLevel = calculateLevel(userData.xp || 0);
    const newLevel = calculateLevel(newXP);
    const oldRank = getRank(oldLevel);
    const newRank = getRank(newLevel);
    
    const updateData = {
    ...userData,
    xp: newXP,
    credits: newCredits,
    level: newLevel
};

if (item.effect?.streak_protection) {
    updateData.streak_protections = (userData.streak_protections || 0) + 1;
}

client.queueUserUpdate(userId, guildId, updateData);
    
    const newQuantity = inventoryItem.quantity - 1;
    if (newQuantity <= 0) {
        db.prepare(`DELETE FROM user_inventory WHERE user_id = ? AND item_id = ?`).run(userId, itemId);
    } else {
        db.prepare(`UPDATE user_inventory SET quantity = ? WHERE user_id = ? AND item_id = ?`).run(newQuantity, userId, itemId);
    }
    
    const resultEmbed = new EmbedBuilder()
        .setColor(newRank.color)
        .setAuthor({ name: t.useSuccess, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
        .setTitle(`✨ ${item[lang]?.name || item.en.name} ${t.used}!`)
        .setDescription(`\`\`\`yaml\n${effectMessage}\`\`\``)
        .addFields(
            { name: '📊 Stats', value: `XP: ${(userData.xp || 0).toLocaleString()} → ${newXP.toLocaleString()}\nCredits: ${(userData.credits || 0).toLocaleString()} → ${newCredits.toLocaleString()}`, inline: false },
            { name: '🎯 Level', value: `${oldLevel} → ${newLevel}`, inline: true },
            { name: '🏅 Rank', value: `${oldRank.title[lang]} → ${newRank.title[lang]}`, inline: true },
            { name: '📦 Remaining', value: newQuantity > 0 ? `${newQuantity} left` : 'None (consumed)', inline: true }
        )
        .setFooter({ text: `${guildName || 'NEURAL NODE'} • ${t.footer} • v${version}`, iconURL: interaction.guild?.iconURL() })
        .setTimestamp();
    
    if (newLevel > oldLevel) {
        resultEmbed.addFields({ name: '🎉 LEVEL UP!', value: `You reached Level ${newLevel}!`, inline: false });
    }
    if (oldRank.title[lang] !== newRank.title[lang]) {
        resultEmbed.addFields({ name: '🏅 RANK UP!', value: `${oldRank.emoji} ${oldRank.title[lang]} → ${newRank.emoji} ${newRank.title[lang]}`, inline: false });
    }
    
    await interaction.editReply({ embeds: [resultEmbed] }).catch(err => {
        console.error('[USE] Failed to edit reply:', err);
    });
    
    console.log(`[USE-SLASH] ${interaction.user.tag} used ${itemId} | ${rewardAmount} ${rewardType} | Remaining: ${newQuantity}`);
}

// ================= CORE ITEM PROCESSING FUNCTION =================
async function processItemUse(client, message, db, userId, itemId, itemsMap, t, lang, guildName, version) {
    const item = itemsMap.get(itemId);
    if (!item) {
        return message.reply({ content: t.itemNotFound, ephemeral: true }).catch(() => {});
    }
    
    const inventoryItem = db.prepare(`
        SELECT quantity, expires_at 
        FROM user_inventory 
        WHERE user_id = ? AND item_id = ? AND active = 1 AND quantity > 0
    `).get(userId, itemId);
    
    if (!inventoryItem) {
        return message.reply({ content: t.itemNotFound, ephemeral: true }).catch(() => {});
    }
    
    if (inventoryItem.expires_at && inventoryItem.expires_at < Math.floor(Date.now() / 1000)) {
        db.prepare(`UPDATE user_inventory SET active = 0 WHERE user_id = ? AND item_id = ?`).run(userId, itemId);
        return message.reply({ content: t.alreadyUsed, ephemeral: true }).catch(() => {});
    }
    
    // PER-SERVER: Second use function also needs guildId
    const guildId2 = message.guild?.id || 'DM';
    let userData = client.getUserData ? client.getUserData(userId, guildId2) : db.prepare(`SELECT * FROM users WHERE id = ? AND guild_id = ?`).get(userId, guildId2);
    if (!userData) {
        userData = { id: userId, guild_id: guildId2, username: message.author.username, credits: 0, xp: 0, level: 1 };
    }
    
    let newXP = userData.xp || 0;
    let newCredits = userData.credits || 0;
    let effectMessage = '';
    let rewardType = '';
    let rewardAmount = 0;
    
    if (item.effect) {
        if (item.effect.xp) {
            newXP += item.effect.xp;
            rewardAmount = item.effect.xp;
            rewardType = 'XP';
            effectMessage = t.xpGain.replace('{amount}', item.effect.xp);
        }
        if (item.effect.credits) {
            newCredits += item.effect.credits;
            rewardAmount = item.effect.credits;
            rewardType = 'Credits';
            effectMessage = t.creditGain.replace('{amount}', item.effect.credits);
        }
            if (item.effect.random) {
        const randomReward = item.effect.random[Math.floor(Math.random() * item.effect.random.length)];
        if (randomReward.xp) {
            newXP += randomReward.xp;
            rewardAmount = randomReward.xp;
            rewardType = 'XP';
            effectMessage = t.mysteryReward.replace('{amount}', randomReward.xp).replace('{type}', 'XP');
        } else if (randomReward.credits) {
            newCredits += randomReward.credits;
            rewardAmount = randomReward.credits;
            rewardType = 'Credits';
            effectMessage = t.mysteryReward.replace('{amount}', randomReward.credits).replace('{type}', 'Credits');
        }
    }
    if (item.effect.streak_protection) {
        rewardAmount = 1;
        rewardType = 'Streak Protection';
        effectMessage = '🛡️ **Streak Protection Activated!**\n└─ Your streak is protected for 1 missed day.';
    }
}
    
    const oldLevel = calculateLevel(userData.xp || 0);
    const newLevel = calculateLevel(newXP);
    const oldRank = getRank(oldLevel);
    const newRank = getRank(newLevel);
    
    const updateData = {
    ...userData,
    xp: newXP,
    credits: newCredits,
    level: newLevel
};

if (item.effect?.streak_protection) {
    updateData.streak_protections = (userData.streak_protections || 0) + 1;
}

client.queueUserUpdate(userId, guildId, updateData);
    
    const newQuantity = inventoryItem.quantity - 1;
    if (newQuantity <= 0) {
        db.prepare(`DELETE FROM user_inventory WHERE user_id = ? AND item_id = ?`).run(userId, itemId);
    } else {
        db.prepare(`UPDATE user_inventory SET quantity = ? WHERE user_id = ? AND item_id = ?`).run(newQuantity, userId, itemId);
    }
    
    const resultEmbed = new EmbedBuilder()
        .setColor(newRank.color)
        .setAuthor({ name: t.useSuccess, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setTitle(`✨ ${item[lang]?.name || item.en.name} ${t.used}!`)
        .setDescription(`\`\`\`yaml\n${effectMessage}\`\`\``)
        .addFields(
            { name: '📊 Stats', value: `XP: ${(userData.xp || 0).toLocaleString()} → ${newXP.toLocaleString()}\nCredits: ${(userData.credits || 0).toLocaleString()} → ${newCredits.toLocaleString()}`, inline: false },
            { name: '🎯 Level', value: `${oldLevel} → ${newLevel}`, inline: true },
            { name: '🏅 Rank', value: `${oldRank.title[lang]} → ${newRank.title[lang]}`, inline: true },
            { name: '📦 Remaining', value: newQuantity > 0 ? `${newQuantity} left` : 'None (consumed)', inline: true }
        )
        .setFooter({ text: `${guildName || 'NEURAL NODE'} • ${t.footer} • v${version}`, iconURL: message.guild?.iconURL() })
        .setTimestamp();
    
    if (newLevel > oldLevel) {
        resultEmbed.addFields({ name: '🎉 LEVEL UP!', value: `You reached Level ${newLevel}!`, inline: false });
    }
    if (oldRank.title[lang] !== newRank.title[lang]) {
        resultEmbed.addFields({ name: '🏅 RANK UP!', value: `${oldRank.emoji} ${oldRank.title[lang]} → ${newRank.emoji} ${newRank.title[lang]}`, inline: false });
    }
    
    await message.reply({ embeds: [resultEmbed] }).catch(() => {});
    
    console.log(`[USE] ${message.author.tag} used ${itemId} | ${rewardAmount} ${rewardType} | Remaining: ${newQuantity}`);
}