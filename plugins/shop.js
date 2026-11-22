const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js');
const { icon } = require('../lib/ui/icons');
const parseEmoji = (str) => {
    if (!str) return undefined;
    const m = /^<(a?):(\w+):(\d+)>$/.exec(str);
    return m ? { id: m[3], name: m[2], animated: m[1] === 'a' } : str;
};
const { t } = require('../lib/i18n');
const { pickLang } = require('../lib/pick-lang');
const { resolveEmoji } = require('../lib/emoji-resolver');
const em = (k, fb) => resolveEmoji(k, global.client) || fb;
const components = require('../lib/components');

const IDLE_MS = 10 * 60 * 1000;   // the shop's buttons stay usable 10 minutes after the last click

// Items this member owns on this server (purchases are per server)
function owned(db, userId, guildId) {
    return new Set(db.prepare('SELECT item_id FROM user_inventory WHERE user_id = ? AND guild_id = ? AND active = 1').all(userId, guildId).map((x) => x.item_id));
}

// The member's newest numbers: what is in memory while an automatic save is waiting, the database otherwise
function live(client, db, userId, guildId, userName) {
    const u = client.liveUser ? (client.getOrCreateUser?.(userId, guildId, userName), client.liveUser(userId, guildId))
        : db.prepare('SELECT credits, xp, level, streak_protections FROM users WHERE id = ? AND guild_id = ?').get(userId, guildId);
    return u || { credits: 0, xp: 0, level: 1, streak_protections: 0 };
}

// Takes the price and gives the item's bonuses in one change. false when the member can't pay.
function pay(client, db, userId, guildId, item, newLevel) {
    const add = { credits: (item.effect?.credits || 0) - item.price, xp: item.effect?.xp || 0, streak_protections: item.effect?.streak_protection ? 1 : 0 };
    if (client.changeUser) return client.changeUser(userId, guildId, { add, set: { level: newLevel } }).ok;
    const r = db.prepare('UPDATE users SET credits = credits + ?, xp = xp + ?, level = ?, streak_protections = COALESCE(streak_protections, 0) + ? WHERE id = ? AND guild_id = ? AND credits + ? >= 0')
        .run(add.credits, add.xp, newLevel, add.streak_protections, userId, guildId, add.credits);
    return r.changes > 0;
}

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
    // sid: the stored session (lib/components.js) behind the menu and buttons, so they keep working after a restart
    buildView: (client, userData, ownedItems, lang, guildName, version, sid) => {
        const shopItems = client.shopItems || [];
        const balance = userData.credits || 0;
        const level = userData.level || 1;
        
        const createOptions = (ownedSet, currentLevel) => shopItems.map(item => {
            // Resolve name/desc if they are translation keys (e.g., "shop.items.starter_pack.name")
            let rawName = item[lang]?.name || item.en?.name || item.name || item.id;
            let rawDesc = item[lang]?.desc || item.en?.desc || item.desc || '';
            
            const isTranslationKey = (str) => str && str.includes('.') && !str.includes(' ');
            const itemName = isTranslationKey(rawName) ? t(rawName, lang) : rawName;
            const itemDesc = isTranslationKey(rawDesc) ? t(rawDesc, lang) : rawDesc;

            let description = `${item.price.toLocaleString()} ${t('shop.creditsLabel', lang)} - ${itemDesc}`;
            // Use Unicode emojis for descriptions (custom emojis are not supported here)
            if (ownedSet.has(item.id)) description = `${em('ic_ok', '✅')} ${t('shop.owned', lang)} - ${description}`;
            if (item.requirement?.level && currentLevel < item.requirement.level) description = `🔒 ${t('shop.locked', lang)} ${item.requirement.level} - ${description}`;

            const opt = {
                label: `${itemName}`.substring(0, 100),
                description: description.substring(0, 100),
                value: item.id
            };
            
            // Set the emoji on the option itself if the item has one
            if (item.emoji) opt.emoji = parseEmoji(item.emoji);
            
            return opt;
        });

        const menu = new StringSelectMenuBuilder()
            .setCustomId(components.id('shop', sid, 'buy'))
            .setPlaceholder(t('shop.placeholder', lang))
            .addOptions(createOptions(ownedItems, level));

        const row = new ActionRowBuilder().addComponents(menu);
        const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(components.id('shop', sid, 'inv')).setLabel(t('shop.inventory', lang)).setStyle(ButtonStyle.Secondary).setEmoji(icon('inventory')),
            new ButtonBuilder().setCustomId(components.id('shop', sid, 'refresh')).setLabel(t('shop.refresh', lang)).setStyle(ButtonStyle.Success).setEmoji(icon('refresh'))
        );

        const container = new ContainerBuilder().setAccentColor(0xf1c40f);
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${em('ic_shop', '🛒')} ${t('shop.title', lang)}`));
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(t('shop.desc', lang)));
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${em('coins', '💰')} **${t('shop.balance', lang)}:** \`${balance.toLocaleString()}\` ${t('shop.creditsLabel', lang)}\n${em('XP', '📊')} **${t('shop.level', lang)}:** \`${level}\`\n${em('shield', '🛡️')} **${t('shop.streakProtections', lang)}:** \`${userData.streak_protections || 0}\``));
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        container.addActionRowComponents(row);
        container.addActionRowComponents(buttonRow);

        return { view: { components: [container], flags: MessageFlags.IsComponentsV2 }, menu, buttonRow };
    },

    // The card for this member, with a new session behind its menu and buttons
    open: (client, db, user, guild, lang) => {
        const guildId = guild?.id || 'DM';
        const sid = components.create(db, { kind: 'shop', userId: user.id, guildId, data: { lang }, idleMs: IDLE_MS });
        const userData = live(client, db, user.id, guildId, user.username);
        return module.exports.buildView(client, userData, owned(db, user.id, guildId), lang, guild?.name?.toUpperCase() || 'ARCHON CG-223', client.version || '1.7.0', sid).view;
    },

    // ================= PREFIX COMMAND =================
    run: async (client, message, args, db) => {
        const lang = pickLang(client, message.guild?.id || 'DM', message);
        await message.reply(module.exports.open(client, db, message.author, message.guild, lang)).catch(() => null);
    },

    // ================= SLASH COMMAND =================
    // opts.private: the shop opens for this member only (the Shop button of /credit)
    execute: async (interaction, client, opts) => {
        await interaction.deferReply(opts && opts.private === true ? { flags: 64 } : {});
        const lang = pickLang(client, interaction.guild?.id || 'DM', interaction);
        await interaction.editReply(module.exports.open(client, client.db, interaction.user, interaction.guild, lang)).catch(() => null);
    },

    // ================= BUTTONS AND MENU (c:shop:<sid>:buy | inv | refresh) =================
    onComponent: async (i, client, { sid, action, session }) => {
        const db = client.db;
        const userId = i.user.id;
        const userName = i.user.username;
        const guildId = session.guildId || i.guild?.id || 'DM';
        const lang = session.data.lang || pickLang(client, guildId, i);
        const guildName = i.guild?.name?.toUpperCase() || 'ARCHON CG-223';
        const version = client.version || '1.7.0';
        const redraw = () => module.exports.buildView(client, live(client, db, userId, guildId, userName), owned(db, userId, guildId), lang, guildName, version, sid).view;

        if (action === 'refresh') return i.update(redraw());

        await i.deferUpdate().catch(() => {});

        if (action === 'inv') {
            const invCmd = client.commands.get('inventory');
            if (!invCmd) return;
            const fakeMsg = { author: i.user, guild: i.guild, channel: i.channel, reply: async (o) => i.followUp(typeof o === 'string' ? { content: o } : o) };
            return invCmd.run(client, fakeMsg, [], db, client.getServerSettings?.(guildId), 'inventory', lang).catch((e) => console.error('[SHOP] inventory:', e.message));
        }

        if (action !== 'buy') return;
        const selectedId = i.values?.[0];
        const selectedItem = (client.shopItems || []).find((item) => item.id === selectedId);
        if (!selectedItem) return;

        const fd = live(client, db, userId, guildId, userName);
        const curBal = fd?.credits || 0;
        const curLvl = fd?.level || 1;

        if (selectedItem.requirement?.level && curLvl < selectedItem.requirement.level) {
            await i.editReply(redraw()).catch(() => {});   // the menu forgets the choice, so the same item can be picked again
            return i.followUp({ content: t('shop.levelRequirement', lang, { level: selectedItem.requirement.level, current: curLvl }), flags: 64 }).catch(() => {});
        }
        if (curBal < selectedItem.price) {
            await i.editReply(redraw()).catch(() => {});
            return i.followUp({ content: t('shop.insufficientFunds', lang, { price: selectedItem.price.toLocaleString(), balance: curBal.toLocaleString() }), flags: 64 }).catch(() => {});
        }

        const bonusXP = selectedItem.effect?.xp || 0;
        const bonusCredits = selectedItem.effect?.credits || 0;
        const newCredits = curBal - selectedItem.price + bonusCredits;
        const newXP = (fd?.xp || 0) + bonusXP;
        const newLevel = Math.floor(0.1 * Math.sqrt(newXP)) + 1;

        // One safe change: the price, the bonuses and the protection land together, in memory and in the database
        // (the old direct write was put back by the next automatic save: the item was free)
        if (!pay(client, db, userId, guildId, selectedItem, newLevel)) {
            await i.editReply(redraw()).catch(() => {});
            return i.followUp({ content: t('shop.insufficientFunds', lang, { price: selectedItem.price.toLocaleString(), balance: curBal.toLocaleString() }), flags: 64 }).catch(() => {});
        }

        const ex = db.prepare('SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?').get(userId, guildId, selectedId);
        if (ex) db.prepare('UPDATE user_inventory SET quantity = quantity + 1, active = 1 WHERE user_id = ? AND guild_id = ? AND item_id = ?').run(userId, guildId, selectedId);
        else db.prepare('INSERT INTO user_inventory (user_id, guild_id, item_id, quantity, active) VALUES (?, ?, ?, 1, 1)').run(userId, guildId, selectedId);

        const itemName = selectedItem[lang]?.name || selectedItem.en?.name || selectedItem.name || selectedItem.id;
        const successContainer = new ContainerBuilder().setAccentColor(0x2ecc71);
        successContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${em('small_check', em('ic_ok', '✅'))} ${t('shop.purchaseComplete', lang)}\n**${selectedItem.emoji || ''} ${itemName}**`));
        successContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        successContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${t('shop.pricePaid', lang)}:** \`-${selectedItem.price.toLocaleString()}\` ${em('coins', '🪙')}\n` + (bonusCredits > 0 ? `**${t('shop.bonusReceived', lang)}:** \`+${bonusCredits.toLocaleString()}\` ${em('coins', '🪙')}\n` : '') + (selectedItem.effect?.streak_protection ? `**${em('shield', '🛡️')} ${t('shop.streakProtectionLine', lang)}**\n` : '') + (bonusXP > 0 ? `**${em('XP', '✨')} ${t('shop.xpBonusLine', lang, { amount: bonusXP })}**\n` : '') + `**${t('shop.newBalance', lang)}:** \`${newCredits.toLocaleString()}\` ${em('coins', '🪙')}`));

        await i.followUp({ components: [successContainer], flags: 64 | MessageFlags.IsComponentsV2 }).catch(() => {});
        await i.editReply(redraw()).catch(() => {});
    }
};

components.register('shop', (ix, client, ctx) => module.exports.onComponent(ix, client, ctx), { command: 'shop' });
