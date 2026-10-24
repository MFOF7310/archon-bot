const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js');
const { t } = require('../lib/i18n');
const { pickLang } = require('../lib/pick-lang');
const { resolveEmoji } = require('../lib/emoji-resolver');

module.exports = {
    name: 'shop',
    aliases: ['store', 'market', 'boutique', 'magasin'],
    description: '💎 Spend your Archon Credits on exclusive upgrades.',
    category: 'ECONOMY',
    usage: '.shop',
    cooldown: 3000,

    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('💎 Spend your Archon Credits on exclusive upgrades'),

    // ================= SHARED UI BUILDER =================
    buildView: (client, userData, ownedItems, lang, guildName, version) => {
        const shopItems = client.shopItems || [];
        const balance = userData.credits || 0;
        const level = userData.level || 1;
        
        const createOptions = (ownedSet, currentLevel) => shopItems.map(item => {
            const itemName = item[lang]?.name || item.en?.name || item.name || item.id;
            const itemDesc = item[lang]?.desc || item.en?.desc || item.desc || '';
            let description = `${item.price.toLocaleString()} ${t('shop.creditsLabel', lang)} - ${itemDesc}`;
            if (ownedSet.has(item.id)) description = `✅ ${t('shop.owned', lang)} - ${description}`;
            if (item.requirement?.level && currentLevel < item.requirement.level) description = `🔒 ${t('shop.locked', lang)} ${item.requirement.level} - ${description}`;
            return {
                label: `${item.emoji || '📦'} ${itemName}`.substring(0, 100),
                description: description.substring(0, 100),
                value: item.id
            };
        });

        const menu = new StringSelectMenuBuilder()
            .setCustomId('shop_select')
            .setPlaceholder(t('shop.placeholder', lang))
            .addOptions(createOptions(ownedItems, level));

        const row = new ActionRowBuilder().addComponents(menu);
        const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('shop_inventory').setLabel(t('shop.inventory', lang)).setStyle(ButtonStyle.Secondary).setEmoji(resolveEmoji('inventory', client) || '🎒'),
            new ButtonBuilder().setCustomId('shop_refresh').setLabel(t('shop.refresh', lang)).setStyle(ButtonStyle.Success).setEmoji(resolveEmoji('refresh', client) || '🔄')
        );

        const container = new ContainerBuilder().setAccentColor(0xf1c40f);
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${resolveEmoji('shop', client) || '🛒'} ${t('shop.title', lang)}`));
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(t('shop.desc', lang)));
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`💰 **${t('shop.balance', lang)}:** \`${balance.toLocaleString()}\` ${t('shop.creditsLabel', lang)}\n📊 **${t('shop.level', lang)}:** \`${level}\`\n🛡️ **${t('shop.streakProtections', lang)}:** \`${userData.streak_protections || 0}\``));
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        container.addActionRowComponents(row);
        container.addActionRowComponents(buttonRow);

        return { view: { components: [container], flags: MessageFlags.IsComponentsV2 }, menu, buttonRow };
    },

    // ================= PREFIX COMMAND =================
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const guildId = message.guild?.id || 'DM';
        const lang = pickLang(client, guildId, message);
        const version = client.version || '1.7.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const userId = message.author.id;
        const userName = message.author.username;

        let userData = db.prepare('SELECT credits, xp, level, streak_protections FROM users WHERE id = ? AND guild_id = ?').get(userId, guildId);
        if (!userData) {
            db.prepare('INSERT INTO users (id, guild_id, username, xp, level, credits, streak_days, last_daily, total_dailies, highest_streak) VALUES (?, ?, ?, 0, 1, 0, 0, 0, 0, 0)').run(userId, guildId, userName);
            userData = { credits: 0, xp: 0, level: 1, streak_protections: 0 };
        }

        const inventory = db.prepare('SELECT item_id FROM user_inventory WHERE user_id = ? AND active = 1').all(userId);
        const ownedItems = new Set(inventory.map(i => i.item_id));

        const { view, menu, buttonRow } = module.exports.buildView(client, userData, ownedItems, lang, guildName, version);
        const reply = await message.reply(view).catch(() => null);
        if (!reply) return;

        const collector = reply.createMessageComponentCollector({ time: 180000 });

        collector.on('collect', async (i) => {
            if (i.user.id !== userId) return i.reply({ content: t('shop.accessDenied', lang), flags: 64 }).catch(() => {});
            try { await i.deferUpdate(); } catch (e) { return; }

            if (i.customId === 'shop_inventory') {
                collector.stop();
                const invCmd = client.commands.get('inventory');
                if (invCmd) return await invCmd.run(client, message, [], db, serverSettings, 'inventory');
                return;
            }

            if (i.customId === 'shop_refresh') {
                const freshData = db.prepare('SELECT credits, xp, level, streak_protections FROM users WHERE id = ? AND guild_id = ?').get(userId, guildId);
                const freshInv = db.prepare('SELECT item_id FROM user_inventory WHERE user_id = ? AND active = 1').all(userId);
                const freshOwned = new Set(freshInv.map(x => x.item_id));
                const freshView = module.exports.buildView(client, freshData, freshOwned, lang, guildName, version);
                return await i.editReply(freshView.view).catch(() => {});
            }

            if (i.customId === 'shop_select') {
                const selectedId = i.values[0];
                const selectedItem = (client.shopItems || []).find(item => item.id === selectedId);
                if (!selectedItem) return;

                const fd = db.prepare('SELECT credits, xp, level, streak_protections FROM users WHERE id = ? AND guild_id = ?').get(userId, guildId);
                const curBal = fd?.credits || 0;
                const curLvl = fd?.level || 1;

                if (selectedItem.requirement?.level && curLvl < selectedItem.requirement.level) {
                    return i.followUp({ content: t('shop.levelRequirement', lang, { level: selectedItem.requirement.level, current: curLvl }), flags: 64 }).catch(() => {});
                }
                if (curBal < selectedItem.price) {
                    return i.followUp({ content: t('shop.insufficientFunds', lang, { price: selectedItem.price.toLocaleString(), balance: curBal.toLocaleString() }), flags: 64 }).catch(() => {});
                }

                const bonusXP = selectedItem.effect?.xp || 0;
                const bonusCredits = selectedItem.effect?.credits || 0;
                const newCredits = curBal - selectedItem.price + bonusCredits;
                const newXP = (fd?.xp || 0) + bonusXP;
                const newLevel = Math.floor(0.1 * Math.sqrt(newXP)) + 1;

                db.prepare('UPDATE users SET credits = ?, xp = ?, level = ? WHERE id = ? AND guild_id = ?').run(newCredits, newXP, newLevel, userId, guildId);
                if (selectedItem.effect?.streak_protection) {
                    db.prepare('UPDATE users SET streak_protections = COALESCE(streak_protections, 0) + 1 WHERE id = ? AND guild_id = ?').run(userId, guildId);
                }

                const ex = db.prepare('SELECT quantity FROM user_inventory WHERE user_id = ? AND item_id = ?').get(userId, selectedId);
                if (ex) {
                    db.prepare('UPDATE user_inventory SET quantity = quantity + 1 WHERE user_id = ? AND item_id = ?').run(userId, selectedId);
                } else {
                    db.prepare('INSERT INTO user_inventory (user_id, item_id, quantity, active) VALUES (?, ?, 1, 1)').run(userId, selectedId);
                }
                if (client.userDataCache) client.userDataCache.delete(userId + ':' + guildId);

                const itemName = selectedItem[lang]?.name || selectedItem.en.name;
                const successContainer = new ContainerBuilder().setAccentColor(0x2ecc71);
                successContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ✅ ${t('shop.purchaseComplete', lang)}\n**${selectedItem.emoji} ${itemName}**`));
                successContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
                successContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${t('shop.pricePaid', lang)}:** \`-${selectedItem.price.toLocaleString()} 🪙\`\n` + (bonusCredits > 0 ? `**${t('shop.bonusReceived', lang)}:** \`+${bonusCredits.toLocaleString()} 🪙\`\n` : '') + (selectedItem.effect?.streak_protection ? `**🛡️ ${t('shop.streakProtectionLine', lang)}**\n` : '') + (bonusXP > 0 ? `**✨ ${t('shop.xpBonusLine', lang, { amount: bonusXP })}**\n` : '') + `**${t('shop.newBalance', lang)}:** \`${newCredits.toLocaleString()} 🪙\``));
                
                await i.followUp({ components: [successContainer], flags: 64 | MessageFlags.IsComponentsV2 }).catch(() => {});

                const finalData = db.prepare('SELECT credits, xp, level, streak_protections FROM users WHERE id = ? AND guild_id = ?').get(userId, guildId);
                const finalInv = db.prepare('SELECT item_id FROM user_inventory WHERE user_id = ? AND active = 1').all(userId);
                const finalOwned = new Set(finalInv.map(x => x.item_id));
                const finalView = module.exports.buildView(client, finalData, finalOwned, lang, guildName, version);
                await i.editReply(finalView.view).catch(() => {});
            }
        });

        collector.on('end', async () => {
            try { 
                menu.setDisabled(true);
                buttonRow.components.forEach(b => b.setDisabled(true));
                await reply.edit({ components: [new ContainerBuilder().addActionRowComponents(new ActionRowBuilder().addComponents(menu)).addActionRowComponents(buttonRow)], flags: MessageFlags.IsComponentsV2 }).catch(() => {}); 
            } catch (e) {}
        });
    },

    // ================= SLASH COMMAND =================
    execute: async (interaction, client) => {
        await interaction.deferReply();
        const guildId = interaction.guild?.id || 'DM';
        const lang = pickLang(client, guildId, interaction);
        const version = client.version || '1.7.0';
        const guildName = interaction.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const userId = interaction.user.id;
        const userName = interaction.user.username;
        const db = client.db;

        let userData = db.prepare('SELECT credits, xp, level, streak_protections FROM users WHERE id = ? AND guild_id = ?').get(userId, guildId);
        if (!userData) {
            db.prepare('INSERT OR IGNORE INTO users (id, guild_id, username, xp, level, credits) VALUES (?, ?, ?, 0, 1, 0)').run(userId, guildId, userName);
            userData = { credits: 0, xp: 0, level: 1, streak_protections: 0 };
        }

        const inventory = db.prepare('SELECT item_id FROM user_inventory WHERE user_id = ? AND active = 1').all(userId);
        const ownedItems = new Set(inventory.map(i => i.item_id));

        const { view, menu, buttonRow } = module.exports.buildView(client, userData, ownedItems, lang, guildName, version);
        const reply = await interaction.editReply(view).catch(() => null);
        if (!reply) return;

        const collector = reply.createMessageComponentCollector({ time: 180000 });

        collector.on('collect', async (i) => {
            if (i.user.id !== userId) return i.reply({ content: t('shop.accessDenied', lang), flags: 64 }).catch(() => {});
            try { await i.deferUpdate(); } catch (e) { return; }

            if (i.customId === 'shop_inventory') {
                collector.stop();
                const invCmd = client.commands.get('inventory');
                if (invCmd) {
                    const fakeMsg = { author: interaction.user, guild: interaction.guild, channel: interaction.channel, reply: async (o) => i.followUp(o) };
                    return await invCmd.run(client, fakeMsg, [], db, client.getServerSettings(guildId), 'inventory');
                }
                return;
            }

            if (i.customId === 'shop_refresh') {
                const freshData = db.prepare('SELECT credits, xp, level, streak_protections FROM users WHERE id = ? AND guild_id = ?').get(userId, guildId);
                const freshInv = db.prepare('SELECT item_id FROM user_inventory WHERE user_id = ? AND active = 1').all(userId);
                const freshOwned = new Set(freshInv.map(x => x.item_id));
                const freshView = module.exports.buildView(client, freshData, freshOwned, lang, guildName, version);
                return await i.editReply(freshView.view).catch(() => {});
            }

            if (i.customId === 'shop_select') {
                const selectedId = i.values[0];
                const selectedItem = (client.shopItems || []).find(item => item.id === selectedId);
                if (!selectedItem) return;

                const fd = db.prepare('SELECT credits, xp, level, streak_protections FROM users WHERE id = ? AND guild_id = ?').get(userId, guildId);
                const curBal = fd?.credits || 0;
                const curLvl = fd?.level || 1;

                if (selectedItem.requirement?.level && curLvl < selectedItem.requirement.level) {
                    return i.followUp({ content: t('shop.levelRequirement', lang, { level: selectedItem.requirement.level, current: curLvl }), flags: 64 }).catch(() => {});
                }
                if (curBal < selectedItem.price) {
                    return i.followUp({ content: t('shop.insufficientFunds', lang, { price: selectedItem.price.toLocaleString(), balance: curBal.toLocaleString() }), flags: 64 }).catch(() => {});
                }

                const bonusXP = selectedItem.effect?.xp || 0;
                const bonusCredits = selectedItem.effect?.credits || 0;
                const newCredits = curBal - selectedItem.price + bonusCredits;
                const newXP = (fd?.xp || 0) + bonusXP;
                const newLevel = Math.floor(0.1 * Math.sqrt(newXP)) + 1;

                db.prepare('UPDATE users SET credits = ?, xp = ?, level = ? WHERE id = ? AND guild_id = ?').run(newCredits, newXP, newLevel, userId, guildId);
                if (selectedItem.effect?.streak_protection) {
                    db.prepare('UPDATE users SET streak_protections = COALESCE(streak_protections, 0) + 1 WHERE id = ? AND guild_id = ?').run(userId, guildId);
                }

                const ex = db.prepare('SELECT quantity FROM user_inventory WHERE user_id = ? AND item_id = ?').get(userId, selectedId);
                if (ex) {
                    db.prepare('UPDATE user_inventory SET quantity = quantity + 1 WHERE user_id = ? AND item_id = ?').run(userId, selectedId);
                } else {
                    db.prepare('INSERT INTO user_inventory (user_id, item_id, quantity, active) VALUES (?, ?, 1, 1)').run(userId, selectedId);
                }
                if (client.userDataCache) client.userDataCache.delete(userId + ':' + guildId);

                const itemName = selectedItem[lang]?.name || selectedItem.en.name;
                const successContainer = new ContainerBuilder().setAccentColor(0x2ecc71);
                successContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ✅ ${t('shop.purchaseComplete', lang)}\n**${selectedItem.emoji} ${itemName}**`));
                successContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
                successContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${t('shop.pricePaid', lang)}:** \`-${selectedItem.price.toLocaleString()} 🪙\`\n` + (bonusCredits > 0 ? `**${t('shop.bonusReceived', lang)}:** \`+${bonusCredits.toLocaleString()} 🪙\`\n` : '') + (selectedItem.effect?.streak_protection ? `**🛡️ ${t('shop.streakProtectionLine', lang)}**\n` : '') + (bonusXP > 0 ? `**✨ ${t('shop.xpBonusLine', lang, { amount: bonusXP })}**\n` : '') + `**${t('shop.newBalance', lang)}:** \`${newCredits.toLocaleString()} 🪙\``));
                
                await i.followUp({ components: [successContainer], flags: 64 | MessageFlags.IsComponentsV2 }).catch(() => {});

                const finalData = db.prepare('SELECT credits, xp, level, streak_protections FROM users WHERE id = ? AND guild_id = ?').get(userId, guildId);
                const finalInv = db.prepare('SELECT item_id FROM user_inventory WHERE user_id = ? AND active = 1').all(userId);
                const finalOwned = new Set(finalInv.map(x => x.item_id));
                const finalView = module.exports.buildView(client, finalData, finalOwned, lang, guildName, version);
                await i.editReply(finalView.view).catch(() => {});
            }
        });

        collector.on('end', async () => {
            try { 
                menu.setDisabled(true);
                buttonRow.components.forEach(b => b.setDisabled(true));
                await interaction.editReply({ components: [new ContainerBuilder().addActionRowComponents(new ActionRowBuilder().addComponents(menu)).addActionRowComponents(buttonRow)], flags: MessageFlags.IsComponentsV2 }).catch(() => {}); 
            } catch (e) {}
        });
    }
};
