const { getMarketState, getTimeUntilUpdate, getServerMarketRankings, getInvestmentLeaderboard, getMarketSentiment, sendMarketUpdate, TRENDS, MARKET_EVENTS } = require('./market-manager');
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
    name: 'market',
    aliases: ['mkt', 'marché', 'bamako', 'alert', 'marketalert', 'pricealert'],
    description: '📊 Bamako Market — status, alerts, rankings & more',
    category: 'ECONOMY',
    usage: '.market [status|servers|events|top|alert|alert items|test]',
    cooldown: 3000,
    examples: ['.market', '.market servers', '.market top', '.market alert set vip_role 8000 below', '.market alert list', '.market alert items'],

    data: new SlashCommandBuilder()
        .setName('market')
        .setDescription('📊 View the Bamako Market status and rankings')
        .addSubcommand(sub =>
            sub.setName('status').setDescription('Current market status for this server'))
        .addSubcommand(sub =>
            sub.setName('servers').setDescription('Compare markets across all servers'))
        .addSubcommand(sub =>
            sub.setName('top').setDescription('Top investors in this server'))
        .addSubcommand(sub =>
            sub.setName('events').setDescription('Recent market events'))
        .addSubcommand(sub =>
            sub.setName('alert')
                .setDescription('Manage price alerts')
                .addStringOption(o => o.setName('action').setDescription('set, list, remove, items').setRequired(true).addChoices(
                    { name: 'Set Alert', value: 'set' },
                    { name: 'List Alerts', value: 'list' },
                    { name: 'Remove Alert', value: 'remove' },
                    { name: 'View Item IDs', value: 'items' }
                ))
                .addStringOption(o => o.setName('item').setDescription('Item ID (for set)').setRequired(false))
                .addIntegerOption(o => o.setName('price').setDescription('Target price (for set)').setRequired(false))
                .addStringOption(o => o.setName('direction').setDescription('above or below (for set)').setRequired(false).addChoices(
                    { name: 'Above', value: 'above' },
                    { name: 'Below', value: 'below' }
                ))
                .addStringOption(o => o.setName('alert_id').setDescription('Alert ID (for remove)').setRequired(false))),

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(message.content || usedCommand || '') : 'en';
        const guildId = message.guild?.id;
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NETWORK';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        const version = client.version || '1.8.0';
        const action = args[0]?.toLowerCase() || 'status';

// ================= 🔔 PRICE ALERTS (STANDALONE DB) =================
if (action === 'alert' || args[0]?.toLowerCase() === 'alert') {
    const subAction = args[1]?.toLowerCase();

    // Ensure table exists
    db.exec(`
        CREATE TABLE IF NOT EXISTS market_alerts (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            item_id TEXT NOT NULL,
            target_price INTEGER NOT NULL,
            direction TEXT CHECK(direction IN ('above', 'below')) NOT NULL,
            active INTEGER DEFAULT 1,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            last_triggered INTEGER DEFAULT 0
        )
    `);

    // LIST ALERTS
    if (!subAction || subAction === 'list') {
        const alerts = db.prepare(
            'SELECT * FROM market_alerts WHERE user_id = ? AND active = 1 ORDER BY created_at DESC'
        ).all(message.author.id);
        
        if (alerts.length === 0) {
            return message.reply(
                lang === 'fr'
                    ? '📊 Aucune alerte de prix active.\nUtilise `.market alert set <item> <prix> <above|below>` pour en créer une!'
                    : '📊 No active price alerts.\nUse `.market alert set <item> <price> <above|below>` to create one!'
            );
        }
        let text = lang === 'fr' ? '🔔 **VOS ALERTES DE PRIX**\n' : '🔔 **YOUR PRICE ALERTS**\n';
        alerts.forEach(a => {
            const item = client.getItem(a.item_id);
            text += `\n\`${a.id.slice(-6)}\` ${item?.emoji || '📦'} **${item?.en?.name || a.item_id}**`;
            text += `\n   ↳ ${a.direction} ${a.target_price} crédits\n`;
        });
        text += `\n💡 ${lang === 'fr' ? 'Supprimer' : 'Remove'}: \`.market alert remove <id>\``;
        return message.reply(text);
    }

    // SET ALERT
    if (subAction === 'set') {
        const itemId = args[2];
        const price = parseInt(args[3]);
        const dir = args[4]?.toLowerCase();

        if (!itemId || !price || !['above', 'below'].includes(dir)) {
            return message.reply(
                lang === 'fr'
                    ? '❌ Usage: `.market alert set <item> <prix> <above|below>`\nExemple: `.market alert set vip_role 8000 below`'
                    : '❌ Usage: `.market alert set <item> <price> <above|below>`\nExample: `.market alert set vip_role 8000 below`'
            );
        }

        const item = client.getItem(itemId);
        if (!item) return message.reply('❌ Item not found! Use `.shop` to see items.');

        const id = `${message.author.id}_${itemId}_${Date.now()}`;
        db.prepare(
            'INSERT INTO market_alerts (id, user_id, item_id, target_price, direction) VALUES (?,?,?,?,?)'
        ).run(id, message.author.id, itemId, price, dir);

        const name = item.en?.name || item.name || itemId;
        const emoji = item.emoji || '📦';

        return message.reply(
            `✅ **${lang === 'fr' ? 'Alerte créée!' : 'Alert created!'}**\n` +
            `${emoji} **${name}**\n` +
            `${lang === 'fr' ? 'Prix cible' : 'Target'}: **${dir} ${price}** crédits\n` +
            `ID: \`${id.slice(-6)}\``
        );
    }

    // REMOVE ALERT
    if (subAction === 'remove') {
        const alertIdShort = args[2];
        if (!alertIdShort) return message.reply(
            lang === 'fr' ? '❌ Fournissez l\'ID. Utilisez `.market alert list`.' : '❌ Provide alert ID. Use `.market alert list`.'
        );

        const alerts = db.prepare(
            'SELECT * FROM market_alerts WHERE user_id = ? AND active = 1'
        ).all(message.author.id);
        
        const alert = alerts.find(a => a.id.endsWith(alertIdShort));
        if (!alert) return message.reply(
            lang === 'fr' ? '❌ Alerte introuvable!' : '❌ Alert not found!'
        );

        db.prepare('UPDATE market_alerts SET active = 0 WHERE id = ? AND user_id = ?')
            .run(alert.id, message.author.id);
        return message.reply('✅ Alert removed!');
    }

    // LIST SHOP ITEMS (valid IDs for alerts)
    if (subAction === 'items') {
        const items = client.shopItems || [];
        if (items.length === 0) return message.reply('❌ No shop items found.');

        const embed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setAuthor({ name: '🏪 NEURAL MARKETPLACE • VALID ITEM IDs', iconURL: client.user.displayAvatarURL() })
            .setDescription(
                lang === 'fr'
                    ? `Utilisez ces **IDs exacts** avec \`.market alert set <id> <prix> <above|below>\``
                    : `Use these **exact IDs** with \`.market alert set <id> <price> <above|below>\``
            );

        const typeGroups = {};
        items.forEach(item => {
            if (!typeGroups[item.type]) typeGroups[item.type] = [];
            typeGroups[item.type].push(item);
        });

        const typeLabels = {
            consumable: lang === 'fr' ? '⚡ Consommables' : '⚡ Consumables',
            role: lang === 'fr' ? '💎 Rôles' : '💎 Roles',
            badge: lang === 'fr' ? '🏅 Badges' : '🏅 Badges'
        };

        for (const [type, group] of Object.entries(typeGroups)) {
            const value = group.map(item =>
                `\`${item.id}\` ${item.emoji} **${item.en?.name || item.id}** — ${item.price.toLocaleString()} 🪙`
            ).join('\n');
            embed.addFields({
                name: typeLabels[type] || type.toUpperCase(),
                value: value,
                inline: false
            });
        }

        embed.setFooter({ text: `${guildName} • ARCHITECT CG-223 • Price Alerts`, iconURL: guildIcon })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    }

    // Default help
    return message.reply(
        lang === 'fr'
            ? '📊 **ALERTES DE PRIX**\n`.market alert set <item> <prix> <above|below>` - Créer\n`.market alert list` - Voir\n`.market alert remove <id>` - Supprimer\n`.market alert items` - Voir les IDs d\'items'
            : '📊 **PRICE ALERTS**\n`.market alert set <item> <price> <above|below>` - Create\n`.market alert list` - View\n`.market alert remove <id>` - Remove\n`.market alert items` - See item IDs'
    );
}

        // ================= SERVER COMPARISON =================
        if (action === 'servers' || action === 'serveurs') {
            const rankings = getServerMarketRankings(client);
            let desc = '';
            rankings.forEach((s, i) => {
                const eventTag = s.event ? ` ⚡${s.event.emoji}` : '';
                desc += `**#${i + 1}** ${s.emoji} **${s.name}** — ${(s.multiplier * 100).toFixed(1)}%${eventTag}\n`;
            });

            const embed = new EmbedBuilder()
                .setColor('#f1c40f')
                .setAuthor({ name: '🌍 BAMAKO MARKET • SERVER RANKINGS', iconURL: client.user.displayAvatarURL() })
                .setDescription(desc || 'No server data available.')
                .setFooter({ text: `BAMAKO_223 • v${version}` })
                .setTimestamp();
            return message.reply({ embeds: [embed] });
        }

        // ================= TOP INVESTORS =================
        if (action === 'top' || action === 'investors') {
            const leaders = getInvestmentLeaderboard(db, guildId, 5);
            let desc = '';
            if (leaders.length > 0) {
                leaders.forEach((u, i) => {
                    desc += `**#${i + 1}** ${u.username} — ${u.total_invested.toLocaleString()} 🪙 (${u.investment_count} stakes)\n`;
                });
            } else {
                desc = lang === 'fr' ? 'Aucun investisseur actif.' : 'No active investors.';
            }

            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setAuthor({ name: `🏆 ${guildName} • TOP INVESTORS`, iconURL: guildIcon })
                .setDescription(desc)
                .setFooter({ text: `BAMAKO MARKET • v${version}` })
                .setTimestamp();
            return message.reply({ embeds: [embed] });
        }

        // ================= MARKET EVENTS =================
        if (action === 'events' || action === 'événements') {
            let desc = '';
            MARKET_EVENTS.forEach(e => {
                const sign = e.effect >= 0 ? '+' : '';
                desc += `${e.emoji} **${e.name}** — ${sign}${(e.effect * 100).toFixed(0)}%\n`;
            });

            const embed = new EmbedBuilder()
                .setColor('#9b59b6')
                .setAuthor({ name: '⚡ POSSIBLE MARKET EVENTS', iconURL: client.user.displayAvatarURL() })
                .setDescription(desc)
                .setFooter({ text: `BAMAKO MARKET • Events occur randomly • v${version}` })
                .setTimestamp();
            return message.reply({ embeds: [embed] });
        }

        // ================= TEST NOTIFICATION =================
        if (action === 'test' || action === 'debug') {
            const isOwner = message.author.id === message.guild.ownerId;
            const isAdmin = message.member.permissions.has('Administrator');
            if (!isOwner && !isAdmin) {
                return message.reply({ embeds: [
                    new EmbedBuilder().setColor('#e74c3c').setDescription('🔒 Only server owners and administrators can run market tests.')
                ]});
            }

            const testState = getMarketState(guildId);
            const sent = await sendMarketUpdate(client, message.guild, guildId, testState, db);

            if (sent) {
                return message.reply(`✅ **Market test sent successfully!**\n📊 Check your configured market channel.\n\n${TRENDS[testState.trend].emoji} **${TRENDS[testState.trend].name}** — ${(testState.multiplier * 100).toFixed(1)}%`);
            } else {
                return message.reply(
                    `❌ **Market test failed to send.**\n\n` +
                    `Possible causes:\n` +
                    `• No market channel configured (run \`.serversettings set market #channel\`)\n` +
                    `• Bot lacks SendMessages/EmbedLinks in the target channel\n` +
                    `• Channel was deleted or the bot can't see it\n\n` +
                    `**Current config:** \`${serverSettings?.marketChannel || 'NOT SET'}\``
                );
            }
        }

        // ================= STATUS (DEFAULT) =================
        const state = getMarketState(guildId);
        const trend = TRENDS[state.trend] || TRENDS.STEADY;
        const sentiment = getMarketSentiment(guildId);
        const timeUntil = getTimeUntilUpdate(guildId);
        const eventText = state.activeEvent
            ? `\n⚡ **${state.activeEvent.emoji} ${state.activeEvent.name}:** ${state.activeEvent.msg}`
            : '';

        const embed = new EmbedBuilder()
            .setColor(trend.color)
            .setAuthor({ name: `📊 ${guildName} • BAMAKO MARKET`, iconURL: guildIcon })
            .setTitle(`${trend.emoji} ${trend.name} — ${(state.multiplier * 100).toFixed(1)}%`)
            .setDescription(
                `**Sentiment:** ${sentiment.label}${eventText}\n` +
                `${sentiment.bar} \`(${sentiment.pct}%)\`\n` +
                `**Next Update:** ${timeUntil}\n\n` +
                `💡 Use \`/invest stake\` to invest!\n` +
                `🔄 Use \`/market servers\` to compare servers!\n` +
                `🔔 Use \`/market alert set\` for price alerts!`
            )
            .addFields(
                { name: '📈 Trend', value: `${trend.emoji} ${trend.name}`, inline: true },
                { name: '💰 Multiplier', value: `${(state.multiplier * 100).toFixed(1)}%`, inline: true },
                { name: '⏰ Update In', value: timeUntil, inline: true }
            )
            .setFooter({ text: `${guildName} • BAMAKO_223 • v${version}`, iconURL: guildIcon })
            .setTimestamp();

        // 🔥 SMART ROUTING: Use dedicated market channel if configured
        const marketChannelId = serverSettings?.marketChannel;
        if (marketChannelId && message.guild) {
            const marketChannel = message.guild.channels.cache.get(marketChannelId);
            if (marketChannel) {
                const bamakoTime = new Date().toLocaleString('en-US', { timeZone: 'Africa/Bamako', hour: '2-digit', minute: '2-digit', hour12: true });
                
                const marketUpdateEmbed = new EmbedBuilder()
                    .setColor(trend.color)
                    .setAuthor({ 
                        name: `📊 BAMAKO MARKET • LIVE UPDATE`, 
                        iconURL: 'https://cdn-icons-png.flaticon.com/512/2721/2721125.png',
                        url: 'https://github.com/MFOF7310'
                    })
                    .setTitle(`${trend.emoji} ${trend.name} — ${(state.multiplier * 100).toFixed(1)}% Multiplier`)
                    .setDescription(
                        `\`\`\`ansi\n` +
                        `\u001b[1;33m🦅 ARCHITECT CG-223 • BAMAKO_223 NODE 🇲🇱\u001b[0m\n\n` +
                        `\u001b[1;36mMarket Status:\u001b[0m ${trend.emoji} ${trend.name}\n` +
                        `\u001b[1;36mMultiplier:\u001b[0m ${(state.multiplier * 100).toFixed(1)}%\n` +
                        `\u001b[1;36mSentiment:\u001b[0m ${sentiment.label}\n` +
                        `\u001b[1;36mNext Update:\u001b[0m ${timeUntil}\n` +
                        `${eventText ? `\u001b[1;35m⚡ Active Event:\u001b[0m ${state.activeEvent.name}\n` : ''}` +
                        `\`\`\``
                    )
                    .addFields(
                        { name: '📈 Trend Analysis', value: `The market is currently in a **${trend.name}** phase. ${trend.name === 'Bull Market' ? '📈 Prices are rising — good time to invest!' : trend.name === 'Bear Market' ? '📉 Prices are falling — invest cautiously!' : trend.name === 'Volatile Market' ? '🌪️ High volatility — high risk, high reward!' : '📊 Market is stable — steady returns expected.'}`, inline: false },
                        { name: '💰 Investment Tip', value: `Use \`/invest stake\` to invest your credits. The current **${(state.multiplier * 100).toFixed(1)}%** multiplier will affect your returns!`, inline: false }
                    )
                    .setFooter({ text: `${guildName} • BAMAKO_223 🇲🇱 • Updated at ${bamakoTime} (Bamako Time) • v${version}`, iconURL: guildIcon })
                    .setTimestamp();

                await marketChannel.send({ 
                    content: `╔══════════════════════════════════╗\n🦅 **MARKET UPDATE** — ${bamakoTime} BKO\n╚══════════════════════════════════╝`,
                    embeds: [marketUpdateEmbed] 
                }).catch(() => {
                    return message.reply({ embeds: [embed] });
                });
                
                const confirmEmbed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setDescription(`✅ **Market update posted!**\n📊 Check <#${marketChannelId}> for the full report.\n\n${trend.emoji} **${trend.name}** — ${(state.multiplier * 100).toFixed(1)}% Multiplier\n⏰ Next update: ${timeUntil}`)
                    .setFooter({ text: 'ARCHITECT CG-223 • Market Intelligence' })
                    .setTimestamp();
                
                return message.reply({ embeds: [confirmEmbed] });
            }
        }

        return message.reply({ embeds: [embed] });
    },

    // ================= SLASH COMMAND EXECUTION =================
    execute: async (interaction, client) => {
        const subcommand = interaction.options.getSubcommand();
        // Check if Market is enabled for this server
        const marketServerSettings = client.getServerSettings?.(interaction.guild?.id);
        if (marketServerSettings?.market_enabled === 0 || marketServerSettings?.marketEnabled === false) {
            return interaction.reply({ content: '❌ The market system is disabled on this server.', flags: 64 });
        }
        
        // Build args array from subcommand
        let args = [];
        if (subcommand === 'alert') {
            const alertAction = interaction.options.getString('action');
            args = ['alert', alertAction];
            if (alertAction === 'set') {
                args.push(interaction.options.getString('item'));
                args.push(String(interaction.options.getInteger('price')));
                args.push(interaction.options.getString('direction'));
            } else if (alertAction === 'remove') {
                args.push(interaction.options.getString('alert_id'));
            }
        } else {
            args = [subcommand === 'status' ? 'status' : subcommand];
        }
        
        await interaction.deferReply();
        
        const fakeMessage = {
            author: interaction.user,
            guild: interaction.guild,
            channel: interaction.channel,
            reply: async (options) => {
                return interaction.editReply(options);
            },
            react: () => Promise.resolve()
        };
        
        const serverSettings = interaction.guild ? client.getServerSettings(interaction.guild.id) : { prefix: '.' };
        await module.exports.run(client, fakeMessage, args, client.db, serverSettings, 'market');
    }
};