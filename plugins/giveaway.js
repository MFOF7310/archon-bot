const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, PermissionsBitField } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        title: '🎁 NEURAL GIVEAWAY',
        creating: '📝 CREATING GIVEAWAY',
        active: '🟢 ACTIVE',
        ended: '🔴 ENDED',
        prize: 'Prize',
        winners: 'Winners',
        entries: 'Entries',
        ends: 'Ends',
        hostedBy: 'Hosted by',
        timeRemaining: 'Time Remaining',
        enterButton: '🎉 Enter',
        leaveButton: '🚪 Leave',
        rerollButton: '🔄 Reroll',
        deleteButton: '🗑️ Delete',
        enterSuccess: '✅ You have entered the giveaway!',
        leaveSuccess: '🚪 You have left the giveaway.',
        alreadyEntered: '⚠️ You are already entered.',
        notEntered: '⚠️ You are not entered.',
        cannotEnter: '❌ You cannot enter your own giveaway.',
        giveawayEnded: '🎊 GIVEAWAY ENDED 🎊',
        congratulations: 'Congratulations',
        winnersList: 'Winners',
        noEntries: 'No entries.',
        rerollSuccess: '🔄 New winner(s) selected!',
        deleteSuccess: '🗑️ Giveaway deleted.',
        invalidTime: '❌ Invalid time format. Use: `10s`, `5m`, `2h`, `1d`',
        invalidWinners: '❌ Winner count must be 1-20.',
        noPrize: '❌ Please specify a prize.',
        usage: 'Usage: `.giveaway [time] [winners] [prize]`',
        example: 'Example: `.giveaway 1h 2 1000 Credits`',
        footer: 'NEURAL GIVEAWAY',
        accessDenied: '❌ This menu is not yours.',
        noPermission: '❌ You need **Manage Server** permission.',
        entriesList: 'Entries',
        totalEntries: 'Total Entries',
        timeUnits: { s: 'sec', m: 'min', h: 'hr', d: 'day' },
        noActiveGiveaways: 'No active giveaways.\n\nCreate: `{prefix}giveaway [time] [winners] [prize]`',
        activeGiveaways: 'Active Giveaways',
        jumpToGiveaway: 'Jump to Giveaway',
        timeFormats: 'Time formats:',
        missingArguments: 'Missing Arguments',
        createdSuccess: '✅ Giveaway created!',
        entriesClosed: 'Entries Closed',
        viewGiveaway: 'View Giveaway',
        prizeAmount: 'Prize Amount',
        credited: 'Credited',
        toWinners: 'to winner(s)',
        refund: '💰 Refund',
        refundDesc: 'Entry fee returned to both players.',
        prizeClaimed: '🎁 PRIZE CLAIMED',
        prizeSent: 'Prize Sent To',
        claimInGiftChannel: 'Claim in',
        giftChannelAnnouncement: '🎉 **GIVEAWAY WINNERS!** 🎉',
        creditsAdded: '💰 **{amount} Credits** added to your balance!',
        checkBalance: 'Check with `.balance`',
        eachWinnerGets: 'Each winner gets',
        totalPrizePool: 'Total Prize Pool',
        mentionEveryone: '📢 Mention @everyone',
        mentionHere: '📢 Mention @here',
        noMention: '🔕 No mention',
        giveawayStarting: '🎉 **GIVEAWAY STARTING!** 🎉',
        clickToEnter: 'Click the 🎉 button below to enter!'
    },
    fr: {
        title: '🎁 CONCOURS NEURAL',
        creating: '📝 CRÉATION',
        active: '🟢 ACTIF',
        ended: '🔴 TERMINÉ',
        prize: 'Prix',
        winners: 'Gagnants',
        entries: 'Participations',
        ends: 'Se termine',
        hostedBy: 'Organisé par',
        timeRemaining: 'Temps Restant',
        enterButton: '🎉 Participer',
        leaveButton: '🚪 Quitter',
        rerollButton: '🔄 Retirer',
        deleteButton: '🗑️ Supprimer',
        enterSuccess: '✅ Vous participez !',
        leaveSuccess: '🚪 Vous avez quitté.',
        alreadyEntered: '⚠️ Vous participez déjà.',
        notEntered: '⚠️ Vous ne participez pas.',
        cannotEnter: '❌ Vous ne pouvez pas participer à votre propre concours.',
        giveawayEnded: '🎊 CONCOURS TERMINÉ 🎊',
        congratulations: 'Félicitations',
        winnersList: 'Gagnants',
        noEntries: 'Aucune participation.',
        rerollSuccess: '🔄 Nouveau(x) gagnant(s) !',
        deleteSuccess: '🗑️ Concours supprimé.',
        invalidTime: '❌ Format invalide. Utilisez: `10s`, `5m`, `2h`, `1j`',
        invalidWinners: '❌ Nombre de gagnants: 1-20.',
        noPrize: '❌ Spécifiez un prix.',
        usage: 'Usage: `.concours [temps] [gagnants] [prix]`',
        example: 'Exemple: `.concours 1h 2 1000 Crédits`',
        footer: 'CONCOURS NEURAL',
        accessDenied: '❌ Ce menu ne vous appartient pas.',
        noPermission: '❌ Permission **Gérer le Serveur** requise.',
        entriesList: 'Participations',
        totalEntries: 'Total Participations',
        timeUnits: { s: 'sec', m: 'min', h: 'h', d: 'j' },
        noActiveGiveaways: 'Aucun concours actif.\n\nCréez: `{prefix}concours [temps] [gagnants] [prix]`',
        activeGiveaways: 'Concours Actifs',
        jumpToGiveaway: 'Voir le Concours',
        timeFormats: 'Formats:',
        missingArguments: 'Arguments Manquants',
        createdSuccess: '✅ Concours créé !',
        entriesClosed: 'Participations Fermées',
        viewGiveaway: 'Voir le Concours',
        prizeAmount: 'Montant du Prix',
        credited: 'Crédité',
        toWinners: 'au(x) gagnant(s)',
        refund: '💰 Remboursement',
        refundDesc: 'Frais d\'entrée retournés aux deux joueurs.',
        prizeClaimed: '🎁 PRIX RÉCLAMÉ',
        prizeSent: 'Prix Envoyé À',
        claimInGiftChannel: 'Réclamez dans',
        giftChannelAnnouncement: '🎉 **GAGNANTS DU CONCOURS !** 🎉',
        creditsAdded: '💰 **{amount} Crédits** ajoutés à votre solde !',
        checkBalance: 'Vérifiez avec `.balance`',
        eachWinnerGets: 'Chaque gagnant reçoit',
        totalPrizePool: 'Cagnotte Totale',
        mentionEveryone: '📢 Mention @everyone',
        mentionHere: '📢 Mention @here',
        noMention: '🔕 Pas de mention',
        giveawayStarting: '🎉 **CONCOURS LANCÉ !** 🎉',
        clickToEnter: 'Cliquez sur le bouton 🎉 ci-dessous pour participer !'
    }
};

// ================= ACTIVE GIVEAWAYS STORAGE =================
const activeGiveaways = new Map();

// ================= PARSE TIME FUNCTION =================
function parseTime(timeStr, lang) {
    const t = translations[lang];
    const regex = /^(\d+)([smhd])$/i;
    const match = timeStr.match(regex);
    if (!match) return null;
    
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    if (!multipliers[unit]) return null;
    
    return {
        ms: value * multipliers[unit],
        display: `${value}${unit}`,
        text: `${value} ${t.timeUnits[unit]}`
    };
}

// ================= CREATE GIVEAWAY EMBED =================
function createGiveawayEmbed(giveaway, status, lang, guild, client) {
    const t = translations[lang];
    const version = client.version || '1.7.0';
    const color = status === 'active' ? '#2ecc71' : '#e74c3c';
    const title = status === 'active' ? `${t.title} • ${t.active}` : `${t.title} • ${t.ended}`;
    
    // Extract credit amount
    const creditMatch = giveaway.prize.match(/(\d+)/);
    const amount = creditMatch ? parseInt(creditMatch[0]) : 0;
    const totalPool = amount * giveaway.winners;
    
    const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: title, iconURL: giveaway.hostIcon })
        .setTitle(`🎁 ${giveaway.prize}`)
        .setDescription(
            `\`\`\`yaml\n` +
            `${t.hostedBy}: ${giveaway.hostName}\n` +
            `${t.winners}: ${giveaway.winners} ${t.winnersList.toLowerCase()}\n` +
            `${t.entries}: ${giveaway.entries.length}\n` +
            `${t.eachWinnerGets}: ${amount.toLocaleString()} 🪙\n` +
            `${t.totalPrizePool}: ${totalPool.toLocaleString()} 🪙\n` +
            `\`\`\``
        )
        .addFields(
            status === 'active' 
                ? { name: `⏰ ${t.timeRemaining}`, value: `<t:${Math.floor(giveaway.endTimestamp / 1000)}:R>`, inline: true }
                : { name: `🔒 ${t.entriesClosed}`, value: `<t:${Math.floor(giveaway.endTimestamp / 1000)}:R>`, inline: true },
            { name: `👥 ${t.totalEntries}`, value: `\`${giveaway.entries.length}\``, inline: true }
        )
        .setFooter({ 
            text: `${guild.name.toUpperCase()} • ${t.footer} • v${version}`, 
            iconURL: guild.iconURL() || client.user.displayAvatarURL() 
        })
        .setTimestamp();
    
    if (status === 'ended' && giveaway.winnersList?.length > 0) {
        const winnerDetails = giveaway.winnersList.map(w => `<@${w}> (+${amount.toLocaleString()} 🪙)`).join('\n');
        embed.addFields({
            name: `🏆 ${t.winnersList}`,
            value: winnerDetails,
            inline: false
        });
    }
    
    return embed;
}

// ================= CREATE BUTTON ROW =================
function createButtonRow(status, lang) {
    const t = translations[lang];
    const row = new ActionRowBuilder();
    
    if (status === 'active') {
        row.addComponents(
            new ButtonBuilder().setCustomId('gw_enter').setLabel(t.enterButton).setStyle(ButtonStyle.Success).setEmoji('🎉'),
            new ButtonBuilder().setCustomId('gw_leave').setLabel(t.leaveButton).setStyle(ButtonStyle.Secondary).setEmoji('🚪')
        );
    } else {
        row.addComponents(
            new ButtonBuilder().setCustomId('gw_reroll').setLabel(t.rerollButton).setStyle(ButtonStyle.Primary).setEmoji('🔄')
        );
    }
    
    row.addComponents(
        new ButtonBuilder().setCustomId('gw_delete').setLabel(t.deleteButton).setStyle(ButtonStyle.Danger).setEmoji('🗑️')
    );
    
    return row;
}

// ================= SELECT WINNERS =================
function selectWinners(entries, winnerCount) {
    if (entries.length === 0) return [];
    const shuffled = [...entries].sort(() => Math.random() - 0.5);
    return [...new Set(shuffled)].slice(0, Math.min(winnerCount, entries.length));
}

// ================= CREDIT WINNERS =================
async function creditWinners(client, db, winnersList, amount, guildName) {
    let credited = 0;
    
    for (const winnerId of winnersList) {
        try {
            let userData = null;
            
            if (client.getUserData) {
                userData = client.getUserData(winnerId);
            }
            
            if (!userData) {
                userData = db.prepare("SELECT * FROM users WHERE id = ?").get(winnerId);
            }
            
            if (!userData) {
                db.prepare("INSERT INTO users (id, username, xp, level, credits) VALUES (?, ?, 0, 1, ?)").run(winnerId, 'Unknown', amount);
                console.log(`[GIVEAWAY] Initialized new user ${winnerId} with ${amount} credits`);
                credited++;
                continue;
            }
            
            const newCredits = (userData.credits || 0) + amount;
            
            if (client.queueUserUpdate) {
                client.queueUserUpdate(winnerId, { 
                    ...userData, 
                    credits: newCredits,
                    username: userData.username || 'Unknown'
                });
                console.log(`[GIVEAWAY] Queued ${amount} credits for ${winnerId} (new balance: ${newCredits})`);
            } else {
                db.prepare("UPDATE users SET credits = ? WHERE id = ?").run(newCredits, winnerId);
                console.log(`[GIVEAWAY] Updated ${winnerId} credits to ${newCredits}`);
            }
            
            if (client.userDataCache) {
                client.userDataCache.delete(winnerId);
            }
            
            credited++;
            
            try {
                const user = await client.users.fetch(winnerId).catch(() => null);
                if (user) {
                    const dmEmbed = new EmbedBuilder()
                        .setColor('#2ecc71')
                        .setTitle('🎁 Giveaway Winnings!')
                        .setDescription(`You won **${amount.toLocaleString()} Credits** in a giveaway!\n\nCheck your balance with \`.balance\``)
                        .setFooter({ text: guildName })
                        .setTimestamp();
                    await user.send({ embeds: [dmEmbed] }).catch(() => {});
                }
            } catch (e) {}
            
        } catch (err) {
            console.error(`[GIVEAWAY] Failed to credit ${winnerId}:`, err.message);
        }
    }
    
    console.log(`[GIVEAWAY] Successfully credited ${credited}/${winnersList.length} winners`);
    return credited;
}

// ================= ANNOUNCE IN GIFT CHANNEL =================
async function announceInGiftChannel(client, guildId, winnersList, prize, hostName, amount, lang, version, guildName) {
    const t = translations[lang];
    const GIFT_CHANNEL_ID = process.env.GIFT_CHANNEL_ID;
    
    if (!GIFT_CHANNEL_ID) {
        console.log('[GIVEAWAY] ⚠️ No GIFT_CHANNEL_ID in .env');
        return false;
    }
    
    try {
        const giftChannel = await client.channels.fetch(GIFT_CHANNEL_ID).catch(() => null);
        if (!giftChannel) return false;
        
        const giftEmbed = new EmbedBuilder()
            .setColor('#FEE75C')
            .setAuthor({ name: `🎁 ${t.prizeClaimed}`, iconURL: client.user.displayAvatarURL() })
            .setTitle(prize)
            .setDescription(
                `\`\`\`yaml\n` +
                `${t.hostedBy}: ${hostName}\n` +
                `${t.prize}: ${prize}\n` +
                `${t.winnersList}: ${winnersList.length}\n` +
                `${t.eachWinnerGets}: ${amount.toLocaleString()} 🪙\n` +
                `\`\`\`\n` +
                `🎉 **${t.congratulations}** ${winnersList.map(w => `<@${w}>`).join(', ')}!\n\n` +
                `✅ ${t.prizeSent} ${winnersList.length} ${t.toWinners}`
            )
            .setFooter({ text: `${guildName} • ${t.footer} • v${version}` })
            .setTimestamp();
        
        await giftChannel.send({ 
            content: `${t.giftChannelAnnouncement} ${winnersList.map(w => `<@${w}>`).join(' ')}`,
            embeds: [giftEmbed] 
        });
        
        console.log(`[GIVEAWAY] ✅ Announced in gift channel`);
        return true;
        
    } catch (err) {
        console.error('[GIVEAWAY] Failed to announce in gift channel:', err.message);
        return false;
    }
}

// ================= MAIN COMMAND =================
module.exports = {
    name: 'giveaway',
    aliases: ['g', 'gift', 'concours', 'cadeau', 'give', 'gw'],
    description: '🎁 Create credit giveaways for community engagement.',
    category: 'ECONOMY',
    cooldown: 5000,
    userPermissions: ['ManageGuild'],
    usage: '.giveaway [time] [winners] [prize] [--everyone|--here]',
    examples: [
        '.giveaway 1h 2 1000 Credits',
        '.giveaway 30m 1 Legendary Pack --everyone',
        '.concours 2h 3 5000 Crédits --here'
    ],

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, 'en')
            : 'en';
        
        const t = translations[lang];
        const prefix = serverSettings?.prefix || process.env.PREFIX || '.';
        const version = client.version || '1.7.0';
        const guildName = message.guild.name.toUpperCase();
        const guildIcon = message.guild.iconURL() || client.user.displayAvatarURL();
        
        // ================= PERMISSION CHECK =================
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setDescription(t.noPermission)
                .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon });
            return message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }
        
        // ================= SHOW ACTIVE GIVEAWAYS =================
        if (!args[0]) {
            const guildGiveaways = Array.from(activeGiveaways.values())
                .filter(g => g.guildId === message.guild.id && !g.ended);
            
            if (guildGiveaways.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#95a5a6')
                    .setAuthor({ name: t.title, iconURL: client.user.displayAvatarURL() })
                    .setDescription(t.noActiveGiveaways.replace('{prefix}', prefix))
                    .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });
                
                return message.reply({ embeds: [embed] }).catch(() => {});
            }
            
            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setAuthor({ name: `${t.title} • ${t.active}`, iconURL: client.user.displayAvatarURL() })
                .setTitle(`🎁 ${guildGiveaways.length} ${t.activeGiveaways}`)
                .setDescription(
                    guildGiveaways.map((g, i) => 
                        `**${i + 1}.** 🎁 **${g.prize}**\n` +
                        `└─ ${t.winners}: \`${g.winners}\` • ${t.entries}: \`${g.entries.length}\`\n` +
                        `└─ ${t.ends}: <t:${Math.floor(g.endTimestamp / 1000)}:R>\n` +
                        `└─ 🔗 [${t.jumpToGiveaway}](https://discord.com/channels/${g.guildId}/${g.channelId}/${g.messageId})`
                    ).join('\n\n')
                )
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            
            return message.reply({ embeds: [embed] }).catch(() => {});
        }
        
        // ================= PARSE MENTION FLAGS =================
        let mentionType = 'none';
        const cleanArgs = args.filter(arg => {
            if (arg === '--everyone') {
                mentionType = 'everyone';
                return false;
            }
            if (arg === '--here') {
                mentionType = 'here';
                return false;
            }
            return true;
        });
        
        // ================= CREATE GIVEAWAY =================
        const timeStr = cleanArgs[0];
        const winnersStr = cleanArgs[1];
        const prize = cleanArgs.slice(2).join(' ');
        
        if (!timeStr || !winnersStr || !prize) {
            const embed = new EmbedBuilder()
                .setColor('#ED4245')
                .setTitle('❌ ' + t.missingArguments)
                .setDescription(
                    `**${t.usage}**\n**${t.example}**\n\n` +
                    `**${t.timeFormats}** \`10s\`, \`5m\`, \`2h\`, \`1d\`\n\n` +
                    `**Mention Options:**\n` +
                    `\`--everyone\` - Ping @everyone\n` +
                    `\`--here\` - Ping @here`
                )
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });
            
            return message.reply({ embeds: [embed] }).catch(() => {});
        }
        
        const timeData = parseTime(timeStr, lang);
        if (!timeData) {
            return message.reply({ content: t.invalidTime }).catch(() => {});
        }
        
        const winners = parseInt(winnersStr);
        if (isNaN(winners) || winners < 1 || winners > 20) {
            return message.reply({ content: t.invalidWinners }).catch(() => {});
        }
        
        // Extract credit amount for display
        const creditMatch = prize.match(/(\d+)/);
        const amount = creditMatch ? parseInt(creditMatch[0]) : 0;
        const totalPool = amount * winners;
        
        // Create giveaway object
        const giveawayId = `${message.id}_${Date.now()}`;
        const endTimestamp = Date.now() + timeData.ms;
        
        const giveaway = {
            id: giveawayId,
            guildId: message.guild.id,
            channelId: message.channel.id,
            messageId: null,
            hostId: message.author.id,
            hostName: message.author.username,
            hostIcon: message.author.displayAvatarURL(),
            prize: prize,
            winners: winners,
            entries: [],
            endTimestamp: endTimestamp,
            displayTime: timeData.text,
            ended: false,
            amount: amount,
            totalPool: totalPool
        };
        
        // Create embed and buttons
        const embed = createGiveawayEmbed(giveaway, 'active', lang, message.guild, client);
        const row = createButtonRow('active', lang);
        
        // Build announcement message
        let announcementContent = `🎉 **${t.giveawayStarting}** 🎉\n\n`;
        announcementContent += `🎁 **${prize}**\n`;
        announcementContent += `👑 ${t.hostedBy}: ${message.author.username}\n`;
        announcementContent += `🏆 ${t.winners}: **${winners}** ${t.winnersList.toLowerCase()}\n`;
        announcementContent += `💰 ${t.eachWinnerGets}: **${amount.toLocaleString()} 🪙**\n`;
        announcementContent += `📊 ${t.totalPrizePool}: **${totalPool.toLocaleString()} 🪙**\n`;
        announcementContent += `⏰ ${t.timeRemaining}: **${timeData.text}**\n\n`;
        announcementContent += `👇 **${t.clickToEnter}**`;
        
        // Add mention if requested
        let mentionText = '';
        if (mentionType === 'everyone') {
            mentionText = '@everyone';
        } else if (mentionType === 'here') {
            mentionText = '@here';
        }
        
        const giveawayMessage = await message.channel.send({ 
            content: mentionText || undefined,
            embeds: [
                new EmbedBuilder()
                    .setColor('#FEE75C')
                    .setAuthor({ name: t.title, iconURL: client.user.displayAvatarURL() })
                    .setDescription(announcementContent)
                    .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
            ],
            components: [row],
            allowedMentions: mentionType === 'everyone' ? { parse: ['everyone'] } : (mentionType === 'here' ? { parse: ['here'] } : undefined)
        }).catch(() => {});
        
        if (!giveawayMessage) return;
        
        giveaway.messageId = giveawayMessage.id;
        activeGiveaways.set(giveawayId, giveaway);
        
        // Update to full embed after 1 second
        setTimeout(async () => {
            const fullEmbed = createGiveawayEmbed(giveaway, 'active', lang, message.guild, client);
            await giveawayMessage.edit({ embeds: [fullEmbed] }).catch(() => {});
        }, 1000);
        
        // ================= 🔥 NEURAL GATEKEEPER - BUTTON COLLECTOR =================
        const collector = giveawayMessage.createMessageComponentCollector({ 
            componentType: ComponentType.Button
        });
        
        collector.on('collect', async (i) => {
            const currentGiveaway = activeGiveaways.get(giveawayId);
            if (!currentGiveaway) return;
            
            if (!i.deferred && !i.replied) {
                try {
                    await i.deferUpdate();
                } catch (e) {}
            }
            
            if (i.customId === 'gw_enter') {
                if (i.user.id === currentGiveaway.hostId) {
                    return i.followUp({ content: t.cannotEnter, ephemeral: true }).catch(() => {});
                }
                
                if (currentGiveaway.entries.includes(i.user.id)) {
                    return i.followUp({ content: t.alreadyEntered, ephemeral: true }).catch(() => {});
                }
                
                currentGiveaway.entries.push(i.user.id);
                activeGiveaways.set(giveawayId, currentGiveaway);
                
                const updatedEmbed = createGiveawayEmbed(currentGiveaway, 'active', lang, message.guild, client);
                await i.editReply({ embeds: [updatedEmbed], components: [row] }).catch(() => {});
                
                return i.followUp({ content: t.enterSuccess, ephemeral: true }).catch(() => {});
            }
            
            if (i.customId === 'gw_leave') {
                const index = currentGiveaway.entries.indexOf(i.user.id);
                if (index === -1) {
                    return i.followUp({ content: t.notEntered, ephemeral: true }).catch(() => {});
                }
                
                currentGiveaway.entries.splice(index, 1);
                activeGiveaways.set(giveawayId, currentGiveaway);
                
                const updatedEmbed = createGiveawayEmbed(currentGiveaway, 'active', lang, message.guild, client);
                await i.editReply({ embeds: [updatedEmbed], components: [row] }).catch(() => {});
                
                return i.followUp({ content: t.leaveSuccess, ephemeral: true }).catch(() => {});
            }
            
            if (i.customId === 'gw_reroll') {
                if (i.user.id !== currentGiveaway.hostId && !i.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                    return i.followUp({ content: t.accessDenied, ephemeral: true }).catch(() => {});
                }
                
                const newWinners = selectWinners(currentGiveaway.entries, currentGiveaway.winners);
                
                if (newWinners.length === 0) {
                    return i.followUp({ content: t.noEntries, ephemeral: true }).catch(() => {});
                }
                
                currentGiveaway.winnersList = newWinners;
                const rerollEmbed = createGiveawayEmbed(currentGiveaway, 'ended', lang, message.guild, client);
                await i.editReply({ embeds: [rerollEmbed], components: [createButtonRow('ended', lang)] }).catch(() => {});
                
                const winnerAnnouncement = new EmbedBuilder()
                    .setColor('#FEE75C')
                    .setTitle(`🎊 ${t.giveawayEnded}`)
                    .setDescription(
                        `**${t.prize}:** ${currentGiveaway.prize}\n` +
                        `**${t.eachWinnerGets}:** ${currentGiveaway.amount.toLocaleString()} 🪙\n` +
                        `**${t.winnersList}:** ${newWinners.map(w => `<@${w}> (+${currentGiveaway.amount.toLocaleString()} 🪙)`).join(', ')}\n\n` +
                        `🎉 **${t.congratulations}!**`
                    )
                    .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                    .setTimestamp();
                
                await i.channel.send({ content: newWinners.map(w => `<@${w}>`).join(' '), embeds: [winnerAnnouncement] }).catch(() => {});
                
                if (currentGiveaway.amount > 0) {
                    await creditWinners(client, db, newWinners, currentGiveaway.amount, guildName);
                }
                
                await announceInGiftChannel(client, message.guild.id, newWinners, currentGiveaway.prize, currentGiveaway.hostName, currentGiveaway.amount, lang, version, guildName);
                
                return i.followUp({ content: t.rerollSuccess, ephemeral: true }).catch(() => {});
            }
            
            if (i.customId === 'gw_delete') {
                if (i.user.id !== currentGiveaway.hostId && !i.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                    return i.followUp({ content: t.accessDenied, ephemeral: true }).catch(() => {});
                }
                
                activeGiveaways.delete(giveawayId);
                collector.stop();
                
                await i.editReply({ content: t.deleteSuccess, embeds: [], components: [] }).catch(() => {});
            }
        });
        
        // ================= TIMER FOR ENDING =================
        setTimeout(async () => {
            const currentGiveaway = activeGiveaways.get(giveawayId);
            if (!currentGiveaway) return;
            
            const winnersList = selectWinners(currentGiveaway.entries, currentGiveaway.winners);
            currentGiveaway.winnersList = winnersList;
            currentGiveaway.ended = true;
            
            const endedEmbed = createGiveawayEmbed(currentGiveaway, 'ended', lang, message.guild, client);
            const endedRow = createButtonRow('ended', lang);
            
            try {
                await giveawayMessage.edit({ 
                    content: `🎊 **${t.giveawayEnded}** 🎊`,
                    embeds: [endedEmbed], 
                    components: [endedRow] 
                }).catch(() => {});
                
                if (winnersList.length > 0) {
                    const winnerAnnouncement = new EmbedBuilder()
                        .setColor('#FEE75C')
                        .setTitle(`🎊 ${t.giveawayEnded}`)
                        .setDescription(
                            `\`\`\`yaml\n` +
                            `${t.prize}: ${currentGiveaway.prize}\n` +
                            `${t.eachWinnerGets}: ${currentGiveaway.amount.toLocaleString()} 🪙\n` +
                            `${t.winnersList}: ${winnersList.length}\n` +
                            `\`\`\`\n` +
                            `🎉 **${t.congratulations}** ${winnersList.map(w => `<@${w}> (+${currentGiveaway.amount.toLocaleString()} 🪙)`).join(', ')}!`
                        )
                        .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                        .setTimestamp();
                    
                    await message.channel.send({ content: winnersList.map(w => `<@${w}>`).join(' '), embeds: [winnerAnnouncement] }).catch(() => {});
                    
                    if (currentGiveaway.amount > 0) {
                        await creditWinners(client, db, winnersList, currentGiveaway.amount, guildName);
                    }
                    
                    await announceInGiftChannel(client, message.guild.id, winnersList, currentGiveaway.prize, currentGiveaway.hostName, currentGiveaway.amount, lang, version, guildName);
                    
                } else {
                    await message.channel.send({ content: `😢 ${t.noEntries}` }).catch(() => {});
                }
            } catch (err) {
                console.error('[GIVEAWAY] Error ending:', err);
            }
            
            setTimeout(() => { activeGiveaways.delete(giveawayId); }, 3600000);
            
        }, timeData.ms);
        
        // ================= CONFIRMATION =================
        const confirmEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setAuthor({ name: t.creating, iconURL: message.author.displayAvatarURL() })
            .setDescription(
                `\`\`\`yaml\n` +
                `${t.prize}: ${prize}\n` +
                `${t.winners}: ${winners}\n` +
                `${t.eachWinnerGets}: ${amount.toLocaleString()} 🪙\n` +
                `${t.totalPrizePool}: ${totalPool.toLocaleString()} 🪙\n` +
                `${t.timeRemaining}: ${timeData.text}\n` +
                (mentionType !== 'none' ? `Mention: ${mentionType === 'everyone' ? '@everyone' : '@here'}\n` : '') +
                `\`\`\`\n` +
                `✅ ${t.createdSuccess}`
            )
            .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
            .setTimestamp();
        
        return message.reply({ embeds: [confirmEmbed] }).catch(() => {});
    }
};