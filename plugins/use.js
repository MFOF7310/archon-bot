const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, SlashCommandBuilder } = require('discord.js');
const { t } = require('../lib/i18n');

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

// ================= ARCHON COLOR PALETTE =================
const ARCHON = {
    green: '#2ecc71',
    red: '#e74c3c',
    gold: '#f1c40f',
    purple: '#9b59b6',
    blue: '#3498db',
    orange: '#e67e22',
    gray: '#95a5a6',
    dark: '#2c3e50',
    neural: '#00ff88',
    alert: '#ff3333'
};

// Translations: lang/{en,fr,bm,zh,ar}/use.json

module.exports = {
    name: 'use',
    aliases: ['utiliser', 'activate', 'open', 'consume', 'equip'],
    description: '🎁 Activate an item from your inventory (Boosts, Mystery Boxes, Badges)',
    category: 'ECONOMY',
    usage: '.use [item name] or /use',
    cooldown: 3000,
    examples: ['.use', '.use xp_boost_small', '.use badge_gold'],

    data: new SlashCommandBuilder()
        .setName('use')
        .setDescription('🎁 Activate an item from your neural inventory')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('Item to activate (leave empty to open neural interface)')
                .setRequired(false)
                .setAutocomplete(true)
        ),

    // ================= AUTOCOMPLETE =================
    autocomplete: async (interaction, client) => {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const userId = interaction.user.id;
        const db = client.db;
        const shopItems = client.shopItems || [];
        const itemsMap = new Map(shopItems.map(item => [item.id, item]));

        try {
            const usableItems = db.prepare(`
                SELECT ui.item_id, ui.quantity
                FROM user_inventory ui
                WHERE ui.user_id = ? AND ui.active = 1 AND ui.quantity > 0
            `).all(userId);

            const choices = usableItems
                .filter(inv => {
                    const item = itemsMap.get(inv.item_id);
                    if (!item) return false;
                    const itemName = (item.en?.name || item.name || inv.item_id).toLowerCase();
                    return itemName.includes(focusedValue);
                })
                .slice(0, 25)
                .map(inv => {
                    const item = itemsMap.get(inv.item_id);
                    const itemName = item?.en?.name || item?.name || inv.item_id;
                    const typeEmoji = item?.type === 'badge' ? '🎖️' : item?.type === 'consumable' ? '⚡' : '💪';
                    return {
                        name: `${typeEmoji} ${itemName} (x${inv.quantity})`,
                        value: inv.item_id
                    };
                });

            await interaction.respond(choices).catch(() => {});
        } catch (err) {
            console.error('[USE-AUTOCOMPLETE] Error:', err);
            await interaction.respond([]).catch(() => {});
        }
    },

    // ================= PREFIX COMMAND =================
    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        
        const userId = message.author.id;
        const userName = message.author.username;
        const avatarURL = message.author.displayAvatarURL({ dynamic: true, size: 256 });
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const version = client.version || '1.7.0';
        const guildId = message.guild?.id || 'DM';

        const directItemId = args[0];
        const shopItems = client.shopItems || [];
        const itemsMap = new Map(shopItems.map(item => [item.id, item]));

        const getUsableItems = () => {
            return db.prepare(`
                SELECT ui.item_id, ui.quantity, ui.expires_at
                FROM user_inventory ui
                WHERE ui.user_id = ? AND ui.active = 1 AND ui.quantity > 0
            `).all(userId);
        };

        const usableItems = getUsableItems().filter(inv => {
            const item = itemsMap.get(inv.item_id);
            return item && (item.type === 'consumable' || item.type === 'boost' || item.type === 'badge');
        });

        // ═══════════════════════════════════════════════════════
        // EMPTY INVENTORY — CLASSIFIED INTERFACE
        // ═══════════════════════════════════════════════════════
        if (usableItems.length === 0) {
            const noItemsEmbed = new EmbedBuilder()
                .setColor(ARCHON.red)
                .setAuthor({ name: `🦅 ARCHON ENGINE • ${t('use.title', lang)}`, iconURL: client.user.displayAvatarURL() })
                .setTitle(`\`\`\`ansi\n\u001b[1;31m  ${t('use.noItems', lang)}\u001b[0m\n\`\`\``)
                .setDescription(
                    `\`\`\`ansi\n` +
                    `\u001b[1;33m  ${t('use.neuralInventoryEmpty', lang)}\u001b[0m\n\n` +
                    `\u001b[0;37m  ${t('use.noItemsDesc', lang)}\u001b[0m\n` +
                    `\`\`\``
                )
                .setFooter({ text: `${guildName} • ${t('use.footer', lang)} • v${version}`, iconURL: message.guild?.iconURL() })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('use_shop')
                    .setLabel(t('use.shopHint', lang))
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🛒')
            );

            const reply = await message.reply({ embeds: [noItemsEmbed], components: [row] }).catch(() => {});
            if (!reply) return;

            const collector = reply.createMessageComponentCollector({ time: 30000 });
            collector.on('collect', async (i) => {
                if (i.user.id !== userId) return i.reply({ content: t('use.accessDenied', lang), flags: 64 }).catch(() => {});
                if (i.customId === 'use_shop') {
                    collector.stop();
                    await reply.delete().catch(() => {});
                    const shopCmd = client.commands.get('shop');
                    if (shopCmd) return await shopCmd.run(client, message, [], db, serverSettings, 'shop');
                }
            });
            return;
        }

        // ═══════════════════════════════════════════════════════
        // DIRECT ITEM USE VIA PREFIX
        // ═══════════════════════════════════════════════════════
        if (directItemId) {
            const targetItem = usableItems.find(i => i.item_id === directItemId);
            if (!targetItem) {
                return message.reply({ content: t('use.itemNotFound', lang) }).catch(() => {});
            }
            const item = itemsMap.get(targetItem.item_id);
            if (item?.type === 'badge') {
                await processBadgeEquip(client, message, db, userId, targetItem.item_id, itemsMap, lang, guildName, version, guildId, false);
            } else {
                await processItemUse(client, message, db, userId, targetItem.item_id, itemsMap, lang, guildName, version, guildId, false);
            }
            return;
        }

        // ═══════════════════════════════════════════════════════
        // NEURAL SELECTION INTERFACE
        // ═══════════════════════════════════════════════════════
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`use_select_${userId}_${Date.now()}`)
            .setPlaceholder(t('use.selectPlaceholder', lang))
            .setMinValues(1)
            .setMaxValues(1);

        usableItems.slice(0, 25).forEach(inv => {
            const item = itemsMap.get(inv.item_id);
            if (item) {
                const itemName = item[lang]?.name || item.en?.name || item.name || inv.item_id;
                const typeEmoji = item.type === 'badge' ? '🎖️' : item.type === 'consumable' ? '⚡' : '💪';
                selectMenu.addOptions({
                    label: `${itemName} (x${inv.quantity})`.slice(0, 100),
                    description: `${typeEmoji} ${(item[lang]?.desc || item.en?.desc || item.desc || t('use.neuralItemFallback', lang)).substring(0, 50)}`,
                    value: inv.item_id,
                    emoji: typeEmoji
                });
            }
        });

        const actionRow = new ActionRowBuilder().addComponents(selectMenu);
        const backRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`use_cancel_${userId}`).setLabel(t('use.close', lang)).setStyle(ButtonStyle.Danger).setEmoji('❌'),
            new ButtonBuilder().setCustomId(`use_inventory_${userId}`).setLabel(t('use.backToInventory', lang)).setStyle(ButtonStyle.Secondary).setEmoji('📦')
        );

        const useEmbed = new EmbedBuilder()
            .setColor(ARCHON.purple)
            .setAuthor({ name: `🦅 ARCHON ENGINE • ${t('use.title', lang)}`, iconURL: avatarURL })
            .setTitle(`\`\`\`ansi\n\u001b[1;35m  ${t('use.interfaceTitle', lang)}\u001b[0m\n\`\`\``)
            .setDescription(
                `\`\`\`ansi\n` +
                `\u001b[1;36m  ${t('use.usableItems', lang, { count: usableItems.length })}\u001b[0m\n\n` +
                `\u001b[0;37m  ${t('use.selectHint', lang)}\u001b[0m\n` +
                `\u001b[0;37m  ${t('use.consumeWarn', lang)}\u001b[0m\n` +
                `\`\`\``
            )
            .setFooter({ text: `${guildName} • ${t('use.footer', lang)} • v${version}`, iconURL: message.guild?.iconURL() })
            .setTimestamp();

        const reply = await message.reply({ embeds: [useEmbed], components: [actionRow, backRow] }).catch(() => {});
        if (!reply) return;

        const collector = reply.createMessageComponentCollector({
            filter: i => i.user.id === userId,
            time: 60000
        });

        collector.on('collect', async (i) => {
            await i.deferUpdate().catch(() => {});

            if (i.customId.startsWith('use_select_')) {
                const selectedItemId = i.values[0];
                const item = itemsMap.get(selectedItemId);
                collector.stop();
                await reply.delete().catch(() => {});
                if (item?.type === 'badge') {
                    await processBadgeEquip(client, message, db, userId, selectedItemId, itemsMap, lang, guildName, version, guildId, false);
                } else {
                    await processItemUse(client, message, db, userId, selectedItemId, itemsMap, lang, guildName, version, guildId, false);
                }
            } else if (i.customId.startsWith('use_inventory_')) {
                collector.stop();
                await reply.delete().catch(() => {});
                const invCmd = client.commands.get('inventory');
                if (invCmd) return await invCmd.run(client, message, [], db, serverSettings, 'inventory');
            } else if (i.customId.startsWith('use_cancel_')) {
                collector.stop();
                await reply.delete().catch(() => {});
            }
        });

        collector.on('end', async () => {
            await reply.delete().catch(() => {});
        });
    },

    // ================= SLASH COMMAND =================
    execute: async (interaction, client) => {
        const itemId = interaction.options.getString('item');
        const db = client.db;
        const userId = interaction.user.id;
        const shopItems = client.shopItems || [];
        const itemsMap = new Map(shopItems.map(item => [item.id, item]));
        const guildId = interaction.guild?.id || 'DM';

        const lang = { fr: 'fr', zh: 'zh', ar: 'ar', bm: 'bm' }[(interaction.locale || '').slice(0, 2).toLowerCase()] || 'en';

        const getUsableItems = () => {
            return db.prepare(`
                SELECT ui.item_id, ui.quantity, ui.expires_at
                FROM user_inventory ui
                WHERE ui.user_id = ? AND ui.active = 1 AND ui.quantity > 0
            `).all(userId);
        };

        const usableItems = getUsableItems().filter(inv => {
            const item = itemsMap.get(inv.item_id);
            return item && (item.type === 'consumable' || item.type === 'boost' || item.type === 'badge');
        });

        if (usableItems.length === 0) {
            const noItemsEmbed = new EmbedBuilder()
                .setColor(ARCHON.red)
                .setAuthor({ name: `🦅 ARCHON ENGINE • ${t('use.title', lang)}`, iconURL: client.user.displayAvatarURL() })
                .setTitle(`\`\`\`ansi\n\u001b[1;31m  ${t('use.noItems', lang)}\u001b[0m\n\`\`\``)
                .setDescription(
                    `\`\`\`ansi\n` +
                    `\u001b[1;33m  ${t('use.neuralInventoryEmpty', lang)}\u001b[0m\n\n` +
                    `\u001b[0;37m  ${t('use.noItemsDesc', lang)}\u001b[0m\n` +
                    `\`\`\``
                )
                .setFooter({ text: `NEURAL NODE • ${t('use.footer', lang)} • v${client.version || '1.7.0'}`, iconURL: interaction.guild?.iconURL() });
            return interaction.reply({ embeds: [noItemsEmbed], flags: 64 });
        }

        // Direct item use via slash autocomplete
        if (itemId) {
            const targetItem = usableItems.find(i => i.item_id === itemId);
            if (!targetItem) {
                return interaction.reply({ content: t('use.itemNotFound', lang), flags: 64 });
            }
            const item = itemsMap.get(itemId);
            await interaction.deferReply().catch(() => {});
            if (item?.type === 'badge') {
                await processBadgeEquip(client, interaction, db, userId, itemId, itemsMap, lang, interaction.guild?.name, client.version, guildId, true);
            } else {
                await processItemUseForSlash(client, interaction, db, userId, itemId, itemsMap, lang, interaction.guild?.name, client.version, guildId);
            }
            return;
        }

        // Show selection menu for slash
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`use_select_slash_${userId}_${Date.now()}`)
            .setPlaceholder(t('use.selectPlaceholder', lang))
            .setMinValues(1)
            .setMaxValues(1);

        usableItems.slice(0, 25).forEach(inv => {
            const item = itemsMap.get(inv.item_id);
            if (item) {
                const itemName = item[lang]?.name || item.en?.name || item.name || inv.item_id;
                const typeEmoji = item.type === 'badge' ? '🎖️' : item.type === 'consumable' ? '⚡' : '💪';
                selectMenu.addOptions({
                    label: `${itemName} (x${inv.quantity})`.slice(0, 100),
                    description: `${typeEmoji} ${(item[lang]?.desc || item.en?.desc || item.desc || t('use.neuralItemFallback', lang)).substring(0, 50)}`,
                    value: inv.item_id,
                    emoji: typeEmoji
                });
            }
        });

        const actionRow = new ActionRowBuilder().addComponents(selectMenu);

        const useEmbed = new EmbedBuilder()
            .setColor(ARCHON.purple)
            .setAuthor({ name: `🦅 ARCHON ENGINE • ${t('use.title', lang)}`, iconURL: client.user.displayAvatarURL() })
            .setTitle(`\`\`\`ansi\n\u001b[1;35m  ${t('use.interfaceTitle', lang)}\u001b[0m\n\`\`\``)
            .setDescription(
                `\`\`\`ansi\n` +
                `\u001b[1;36m  ${t('use.usableItems', lang, { count: usableItems.length })}\u001b[0m\n\n` +
                `\u001b[0;37m  ${t('use.selectHint', lang)}\u001b[0m\n` +
                `\u001b[0;37m  ${t('use.consumeWarn', lang)}\u001b[0m\n` +
                `\`\`\``
            )
            .setFooter({ text: `NEURAL NODE • ${t('use.footer', lang)} • v${client.version || '1.7.0'}`, iconURL: interaction.guild?.iconURL() });

        await interaction.reply({ embeds: [useEmbed], components: [actionRow], flags: 64 });

        const replyMsg = await interaction.fetchReply();

        const collector = replyMsg.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 60000,
            max: 1
        });

        collector.on('collect', async (i) => {
            const selectedItemId = i.values[0];
            const item = itemsMap.get(selectedItemId);
            await i.deferUpdate().catch(() => {});
            if (item?.type === 'badge') {
                await processBadgeEquip(client, i, db, userId, selectedItemId, itemsMap, lang, interaction.guild?.name, client.version, guildId, true);
            } else {
                await processItemUseForSlash(client, i, db, userId, selectedItemId, itemsMap, lang, interaction.guild?.name, client.version, guildId);
            }
        });

        collector.on('end', async () => {
            await interaction.editReply({ components: [] }).catch(() => {});
        });
    }
};

// ═══════════════════════════════════════════════════════
// BADGE EQUIPMENT SYSTEM
// ═══════════════════════════════════════════════════════
async function processBadgeEquip(client, context, db, userId, itemId, itemsMap, lang, guildName, version, guildId, isSlash) {
    const item = itemsMap.get(itemId);
    if (!item) {
        const msg = t('use.itemNotFound', lang);
        if (isSlash) return context.editReply({ content: msg }).catch(() => {});
        return context.reply({ content: msg }).catch(() => {});
    }

    const inventoryItem = db.prepare(`
        SELECT quantity, expires_at
        FROM user_inventory
        WHERE user_id = ? AND item_id = ? AND active = 1 AND quantity > 0
    `).get(userId, itemId);

    if (!inventoryItem) {
        const msg = t('use.itemNotFound', lang);
        if (isSlash) return context.editReply({ content: msg }).catch(() => {});
        return context.reply({ content: msg }).catch(() => {});
    }

    // Check if already equipped
    const currentBadge = db.prepare(`
        SELECT active_badge FROM users WHERE id = ? AND guild_id = ?
    `).get(userId, guildId);

    if (currentBadge?.active_badge === itemId) {
        // Already equipped — offer to unequip
        const alreadyEmbed = new EmbedBuilder()
            .setColor(ARCHON.gold)
            .setAuthor({ name: `🦅 ARCHON ENGINE • ${t('use.title', lang)}`, iconURL: isSlash ? context.user.displayAvatarURL() : context.author.displayAvatarURL() })
            .setTitle(`\`\`\`ansi\n\u001b[1;33m  ⚠️ ${t('use.badgeAlreadyEquipped', lang)}\u001b[0m\n\`\`\``)
            .setDescription(
                `\`\`\`ansi\n` +
                `\u001b[1;36m  ${t('use.currentBadge', lang)}\u001b[0m ${item[lang]?.name || item.en?.name || itemId}\n\n` +
                `\u001b[0;37m  ${t('use.removeBadgeQ', lang)}\u001b[0m\n` +
                `\`\`\``
            )
            .setFooter({ text: `${guildName || 'NEURAL NODE'} • ${t('use.footer', lang)} • v${version}` });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`badge_unequip_${userId}`)
                .setLabel(t('use.unequipBadge', lang))
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔓'),
            new ButtonBuilder()
                .setCustomId(`badge_keep_${userId}`)
                .setLabel(t('use.close', lang))
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('❌')
        );

        const reply = isSlash
            ? await context.editReply({ embeds: [alreadyEmbed], components: [row], content: '' }).catch(() => {})
            : await context.reply({ embeds: [alreadyEmbed], components: [row] }).catch(() => {});
        if (!reply) return;

        const collector = reply.createMessageComponentCollector({
            filter: i => i.user.id === userId,
            time: 30000
        });

        collector.on('collect', async (i) => {
            await i.deferUpdate().catch(() => {});
            if (i.customId === `badge_unequip_${userId}`) {
                db.prepare(`UPDATE users SET active_badge = NULL WHERE id = ? AND guild_id = ?`).run(userId, guildId);
                if (client.userDataCache) client.userDataCache.delete(`${userId}:${guildId}`);

                const removedEmbed = new EmbedBuilder()
                    .setColor(ARCHON.green)
                    .setAuthor({ name: `🦅 ARCHON ENGINE • ${t('use.title', lang)}`, iconURL: isSlash ? context.user.displayAvatarURL() : context.author.displayAvatarURL() })
                    .setTitle(`\`\`\`ansi\n\u001b[1;32m  ✅ ${t('use.badgeRemoved', lang)}\u001b[0m\n\`\`\``)
                    .setDescription(`\`\`\`ansi\n\u001b[0;37m  ${t('use.badgeRemovedDesc', lang)}\u001b[0m\n\`\`\``)
                    .setFooter({ text: `${guildName || 'NEURAL NODE'} • ${t('use.footer', lang)} • v${version}` });

                await i.editReply({ embeds: [removedEmbed], components: [] }).catch(() => {});
            } else {
                await i.editReply({ components: [] }).catch(() => {});
            }
            collector.stop();
        });
        return;
    }

    // ═══════════════════════════════════════════════════════
    // CONFIRM EQUIP INTERFACE
    // ═══════════════════════════════════════════════════════
    const confirmEmbed = new EmbedBuilder()
        .setColor(ARCHON.neural)
        .setAuthor({ name: `🦅 ARCHON ENGINE • ${t('use.confirmEquip', lang)}`, iconURL: isSlash ? context.user.displayAvatarURL() : context.author.displayAvatarURL() })
        .setTitle(`\`\`\`ansi\n\u001b[1;32m  🎖️ ${t('use.badgePreview', lang)}\u001b[0m\n\`\`\``)
        .setDescription(
            `\`\`\`ansi\n` +
            `\u001b[1;36m  ${t('use.badgeField', lang)}\u001b[0m ${item[lang]?.name || item.en?.name || itemId}\n` +
            `\u001b[1;36m  ${t('use.typeField', lang)}\u001b[0m ${item.type?.toUpperCase() || 'BADGE'}\n` +
            `\u001b[1;36m  ${t('use.rarityField', lang)}\u001b[0m ${item.rarity?.toUpperCase() || 'STANDARD'}\n` +
            `\u001b[1;36m  ${t('use.stockLabelPlain', lang)}\u001b[0m ${inventoryItem.quantity} ${t('use.remainingWord', lang)}\n\n` +
            `\u001b[0;37m  ${t('use.badgeEquippedDesc', lang)}\u001b[0m\n` +
            `\`\`\``
        )
        .setFooter({ text: `${guildName || 'NEURAL NODE'} • ${t('use.footer', lang)} • v${version}` });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`badge_confirm_${userId}`)
            .setLabel(t('use.equipBadge', lang))
            .setStyle(ButtonStyle.Success)
            .setEmoji('🎖️'),
        new ButtonBuilder()
            .setCustomId(`badge_cancel_${userId}`)
            .setLabel(t('use.close', lang))
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
    );

    const reply = isSlash
        ? await context.editReply({ embeds: [confirmEmbed], components: [row], content: '' }).catch(() => {})
        : await context.reply({ embeds: [confirmEmbed], components: [row] }).catch(() => {});
    if (!reply) return;

    const collector = reply.createMessageComponentCollector({
        filter: i => i.user.id === userId,
        time: 30000
    });

    collector.on('collect', async (i) => {
        await i.deferUpdate().catch(() => {});
        if (i.customId === `badge_confirm_${userId}`) {
            // Equip the badge
            db.prepare(`
                INSERT INTO users (id, guild_id, username, credits, xp, level, active_badge)
                VALUES (?, ?, ?, 0, 0, 1, ?)
                ON CONFLICT(id, guild_id) DO UPDATE SET active_badge = excluded.active_badge
            `).run(userId, guildId, isSlash ? context.user.username : context.author.username, itemId);

            if (client.userDataCache) client.userDataCache.delete(`${userId}:${guildId}`);

            const equippedEmbed = new EmbedBuilder()
                .setColor(ARCHON.green)
                .setAuthor({ name: `🦅 ARCHON ENGINE • ${t('use.useSuccess', lang)}`, iconURL: isSlash ? context.user.displayAvatarURL() : context.author.displayAvatarURL() })
                .setTitle(`\`\`\`ansi\n\u001b[1;32m  ✅ ${t('use.badgeEquipped', lang)}\u001b[0m\n\`\`\``)
                .setDescription(
                    `\`\`\`ansi\n` +
                    `\u001b[1;36m  🎖️ ${t('use.badgeField', lang)}\u001b[0m ${item[lang]?.name || item.en?.name || itemId}\n` +
                    `\u001b[1;36m  ${t('use.stockLabelBadge', lang)}\u001b[0m ${inventoryItem.quantity} ${t('use.remainingWord', lang)}\n\n` +
                    `\u001b[0;37m  ${t('use.badgeEquippedDesc', lang)}\u001b[0m\n` +
                    `\`\`\``
                )
                .setFooter({ text: `${guildName || 'NEURAL NODE'} • ${t('use.footer', lang)} • v${version}` });

            await i.editReply({ embeds: [equippedEmbed], components: [] }).catch(() => {});
        } else {
            await i.editReply({ components: [] }).catch(() => {});
        }
        collector.stop();
    });
}

// ═══════════════════════════════════════════════════════
// SLASH-SPECIFIC ITEM PROCESSING
// ═══════════════════════════════════════════════════════
async function processItemUseForSlash(client, interaction, db, userId, itemId, itemsMap, lang, guildName, version, guildId) {
    const item = itemsMap.get(itemId);
    if (!item) {
        return interaction.editReply({ content: t('use.itemNotFound', lang) }).catch(() => {});
    }

    const inventoryItem = db.prepare(`
        SELECT quantity, expires_at
        FROM user_inventory
        WHERE user_id = ? AND item_id = ? AND active = 1 AND quantity > 0
    `).get(userId, itemId);

    if (!inventoryItem) {
        return interaction.editReply({ content: t('use.itemNotFound', lang) }).catch(() => {});
    }

    if (inventoryItem.expires_at && inventoryItem.expires_at < Math.floor(Date.now() / 1000)) {
        db.prepare(`UPDATE user_inventory SET active = 0 WHERE user_id = ? AND item_id = ?`).run(userId, itemId);
        return interaction.editReply({ content: t('use.alreadyUsed', lang) }).catch(() => {});
    }

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
            effectMessage = t('use.xpGain', lang, { amount: item.effect.xp });
        }
        if (item.effect.credits) {
            newCredits += item.effect.credits;
            rewardAmount = item.effect.credits;
            rewardType = 'Credits';
            effectMessage = t('use.creditGain', lang, { amount: item.effect.credits });
        }
        if (item.effect.random) {
            const randomReward = item.effect.random[Math.floor(Math.random() * item.effect.random.length)];
            if (randomReward.xp) {
                newXP += randomReward.xp;
                rewardAmount = randomReward.xp;
                rewardType = 'XP';
                effectMessage = t('use.mysteryReward', lang, { amount: randomReward.xp, type: 'XP' });
            } else if (randomReward.credits) {
                newCredits += randomReward.credits;
                rewardAmount = randomReward.credits;
                rewardType = 'Credits';
                effectMessage = t('use.mysteryReward', lang, { amount: randomReward.credits, type: 'Credits' });
            }
        }
        if (item.effect.streak_protection) {
            rewardAmount = 1;
            rewardType = 'Streak Protection';
            effectMessage = t('use.streakProtectionMsg', lang);
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

    if (client.queueUserUpdate) {
        client.queueUserUpdate(userId, guildId, updateData);
    } else {
        db.prepare(`
            INSERT INTO users (id, guild_id, username, credits, xp, level)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id, guild_id) DO UPDATE SET
                credits = excluded.credits,
                xp = excluded.xp,
                level = excluded.level
        `).run(userId, guildId, interaction.user.username, newCredits, newXP, newLevel);
    }

    const newQuantity = inventoryItem.quantity - 1;
    if (newQuantity <= 0) {
        db.prepare(`DELETE FROM user_inventory WHERE user_id = ? AND item_id = ?`).run(userId, itemId);
    } else {
        db.prepare(`UPDATE user_inventory SET quantity = ? WHERE user_id = ? AND item_id = ?`).run(newQuantity, userId, itemId);
    }

    // ═══════════════════════════════════════════════════════
    // ARCHON CLASSIFIED RESULT EMBED
    // ═══════════════════════════════════════════════════════
    const resultEmbed = new EmbedBuilder()
        .setColor(newRank.color)
        .setAuthor({ name: `🦅 ARCHON ENGINE • ${t('use.useSuccess', lang)}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
        .setTitle(`\`\`\`ansi\n\u001b[1;32m  ✨ ${item[lang]?.name || item.en?.name || item.name} ${t('use.used', lang)}!\u001b[0m\n\`\`\``)
        .setDescription(`\`\`\`yaml\n${effectMessage}\n\`\`\``)
        .addFields(
            { name: t('use.neuralStats', lang), value: `\`\`\`ansi\n\u001b[1;36mXP:\u001b[0m  ${(userData.xp || 0).toLocaleString()} → ${newXP.toLocaleString()}\n\u001b[1;33m${t('use.creditsField', lang)}\u001b[0m  ${(userData.credits || 0).toLocaleString()} → ${newCredits.toLocaleString()}\n\`\`\``, inline: false },
            { name: t('use.levelField', lang), value: `\`\`\`ansi\n\u001b[1;35m${oldLevel} → ${newLevel}\u001b[0m\n\`\`\``, inline: true },
            { name: t('use.rankField', lang), value: `\`\`\`ansi\n\u001b[1;33m${oldRank.emoji} ${(oldRank.title[lang] || oldRank.title.en)}\u001b[0m\n\u001b[1;32m↓\u001b[0m\n\u001b[1;33m${newRank.emoji} ${(newRank.title[lang] || newRank.title.en)}\u001b[0m\n\`\`\``, inline: true },
            { name: t('use.stockField', lang), value: `\`\`\`ansi\n\u001b[1;36m${newQuantity > 0 ? newQuantity + ' ' + t('use.remainingWord', lang) : t('use.depleted', lang)}\u001b[0m\n\`\`\``, inline: true }
        )
        .setFooter({ text: `${guildName || 'NEURAL NODE'} • ${t('use.footer', lang)} • v${version}`, iconURL: interaction.guild?.iconURL() })
        .setTimestamp();

    if (newLevel > oldLevel) {
        resultEmbed.addFields({ name: t('use.ascensionTitle', lang), value: `\`\`\`ansi\n\u001b[1;32m  ${t('use.ascensionLine', lang, { level: newLevel, rank: (newRank.title[lang] || newRank.title.en) })}\u001b[0m\n\`\`\``, inline: false });
    }
    if ((oldRank.title[lang] || oldRank.title.en) !== (newRank.title[lang] || newRank.title.en)) {
        resultEmbed.addFields({ name: t('use.rankElevationTitle', lang), value: `\`\`\`ansi\n\u001b[1;33m  ${oldRank.emoji} ${(oldRank.title[lang] || oldRank.title.en)} → ${newRank.emoji} ${(newRank.title[lang] || newRank.title.en)}\u001b[0m\n\`\`\``, inline: false });
    }

    await interaction.editReply({ content: '', embeds: [resultEmbed], components: [] }).catch(err => {
        console.error('[USE-SLASH] Failed to edit reply:', err);
    });

    console.log(`[USE-SLASH] ${interaction.user.tag} used ${itemId} | ${rewardAmount} ${rewardType} | Remaining: ${newQuantity}`);
}

// ═══════════════════════════════════════════════════════
// CORE ITEM PROCESSING FUNCTION (PREFIX)
// ═══════════════════════════════════════════════════════
async function processItemUse(client, message, db, userId, itemId, itemsMap, lang, guildName, version, guildId, isSlash) {
    const item = itemsMap.get(itemId);
    if (!item) {
        return message.reply({ content: t('use.itemNotFound', lang) }).catch(() => {});
    }

    const inventoryItem = db.prepare(`
        SELECT quantity, expires_at
        FROM user_inventory
        WHERE user_id = ? AND item_id = ? AND active = 1 AND quantity > 0
    `).get(userId, itemId);

    if (!inventoryItem) {
        return message.reply({ content: t('use.itemNotFound', lang) }).catch(() => {});
    }

    if (inventoryItem.expires_at && inventoryItem.expires_at < Math.floor(Date.now() / 1000)) {
        db.prepare(`UPDATE user_inventory SET active = 0 WHERE user_id = ? AND item_id = ?`).run(userId, itemId);
        return message.reply({ content: t('use.alreadyUsed', lang) }).catch(() => {});
    }

    let userData = client.getUserData ? client.getUserData(userId, guildId) : db.prepare(`SELECT * FROM users WHERE id = ? AND guild_id = ?`).get(userId, guildId);
    if (!userData) {
        userData = { id: userId, guild_id: guildId, username: message.author.username, credits: 0, xp: 0, level: 1 };
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
            effectMessage = t('use.xpGain', lang, { amount: item.effect.xp });
        }
        if (item.effect.credits) {
            newCredits += item.effect.credits;
            rewardAmount = item.effect.credits;
            rewardType = 'Credits';
            effectMessage = t('use.creditGain', lang, { amount: item.effect.credits });
        }
        if (item.effect.random) {
            const randomReward = item.effect.random[Math.floor(Math.random() * item.effect.random.length)];
            if (randomReward.xp) {
                newXP += randomReward.xp;
                rewardAmount = randomReward.xp;
                rewardType = 'XP';
                effectMessage = t('use.mysteryReward', lang, { amount: randomReward.xp, type: 'XP' });
            } else if (randomReward.credits) {
                newCredits += randomReward.credits;
                rewardAmount = randomReward.credits;
                rewardType = 'Credits';
                effectMessage = t('use.mysteryReward', lang, { amount: randomReward.credits, type: 'Credits' });
            }
        }
        if (item.effect.streak_protection) {
            rewardAmount = 1;
            rewardType = 'Streak Protection';
            effectMessage = t('use.streakProtectionMsg', lang);
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

    if (client.queueUserUpdate) {
        client.queueUserUpdate(userId, guildId, updateData);
    } else {
        db.prepare(`
            INSERT INTO users (id, guild_id, username, credits, xp, level)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id, guild_id) DO UPDATE SET
                credits = excluded.credits,
                xp = excluded.xp,
                level = excluded.level
        `).run(userId, guildId, message.author.username, newCredits, newXP, newLevel);
    }

    const newQuantity = inventoryItem.quantity - 1;
    if (newQuantity <= 0) {
        db.prepare(`DELETE FROM user_inventory WHERE user_id = ? AND item_id = ?`).run(userId, itemId);
    } else {
        db.prepare(`UPDATE user_inventory SET quantity = ? WHERE user_id = ? AND item_id = ?`).run(newQuantity, userId, itemId);
    }

    // ═══════════════════════════════════════════════════════
    // ARCHON CLASSIFIED RESULT EMBED
    // ═══════════════════════════════════════════════════════
    const resultEmbed = new EmbedBuilder()
        .setColor(newRank.color)
        .setAuthor({ name: `🦅 ARCHON ENGINE • ${t('use.useSuccess', lang)}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setTitle(`\`\`\`ansi\n\u001b[1;32m  ✨ ${item[lang]?.name || item.en?.name || item.name} ${t('use.used', lang)}!\u001b[0m\n\`\`\``)
        .setDescription(`\`\`\`yaml\n${effectMessage}\n\`\`\``)
        .addFields(
            { name: t('use.neuralStats', lang), value: `\`\`\`ansi\n\u001b[1;36mXP:\u001b[0m  ${(userData.xp || 0).toLocaleString()} → ${newXP.toLocaleString()}\n\u001b[1;33m${t('use.creditsField', lang)}\u001b[0m  ${(userData.credits || 0).toLocaleString()} → ${newCredits.toLocaleString()}\n\`\`\``, inline: false },
            { name: t('use.levelField', lang), value: `\`\`\`ansi\n\u001b[1;35m${oldLevel} → ${newLevel}\u001b[0m\n\`\`\``, inline: true },
            { name: t('use.rankField', lang), value: `\`\`\`ansi\n\u001b[1;33m${oldRank.emoji} ${(oldRank.title[lang] || oldRank.title.en)}\u001b[0m\n\u001b[1;32m↓\u001b[0m\n\u001b[1;33m${newRank.emoji} ${(newRank.title[lang] || newRank.title.en)}\u001b[0m\n\`\`\``, inline: true },
            { name: t('use.stockField', lang), value: `\`\`\`ansi\n\u001b[1;36m${newQuantity > 0 ? newQuantity + ' ' + t('use.remainingWord', lang) : t('use.depleted', lang)}\u001b[0m\n\`\`\``, inline: true }
        )
        .setFooter({ text: `${guildName || 'NEURAL NODE'} • ${t('use.footer', lang)} • v${version}`, iconURL: message.guild?.iconURL() })
        .setTimestamp();

    if (newLevel > oldLevel) {
        resultEmbed.addFields({ name: t('use.ascensionTitle', lang), value: `\`\`\`ansi\n\u001b[1;32m  ${t('use.ascensionLine', lang, { level: newLevel, rank: (newRank.title[lang] || newRank.title.en) })}\u001b[0m\n\`\`\``, inline: false });
    }
    if ((oldRank.title[lang] || oldRank.title.en) !== (newRank.title[lang] || newRank.title.en)) {
        resultEmbed.addFields({ name: t('use.rankElevationTitle', lang), value: `\`\`\`ansi\n\u001b[1;33m  ${oldRank.emoji} ${(oldRank.title[lang] || oldRank.title.en)} → ${newRank.emoji} ${(newRank.title[lang] || newRank.title.en)}\u001b[0m\n\`\`\``, inline: false });
    }

    await message.reply({ embeds: [resultEmbed] }).catch(() => {});

    console.log(`[USE] ${message.author.tag} used ${itemId} | ${rewardAmount} ${rewardType} | Remaining: ${newQuantity}`);
}

