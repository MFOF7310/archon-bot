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
        toWinners: 'to winner(s)'
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
        toWinners: 'au(x) gagnant(s)'
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
    const version = client.version || '1.6.0';
    const color = status === 'active' ? '#2ecc71' : '#e74c3c';
    const title = status === 'active' ? `${t.title} • ${t.active}` : `${t.title} • ${t.ended}`;
    
    const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: title, iconURL: giveaway.hostIcon })
        .setTitle(`🎁 ${giveaway.prize}`)
        .setDescription(
            `\`\`\`yaml\n` +
            `${t.hostedBy}: ${giveaway.hostName}\n` +
            `${t.winners}: ${giveaway.winners}\n` +
            `${t.entries}: ${giveaway.entries.length}\n` +
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
        embed.addFields({
            name: `🏆 ${t.winnersList}`,
            value: giveaway.winnersList.map(w => `<@${w}>`).join('\n'),
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

// ================= MAIN COMMAND =================
module.exports = {
    name: 'giveaway',
    aliases: ['g', 'gift', 'concours', 'cadeau', 'give', 'gw'],
    description: '🎁 Create credit giveaways for community engagement.',
    category: 'ECONOMY',
    cooldown: 5000,
    userPermissions: ['ManageGuild'],
    usage: '.giveaway [time] [winners] [prize]',
    examples: ['.giveaway 1h 2 1000 Credits', '.giveaway 30m 1 Legendary Pack', '.concours 2h 3 5000 Crédits'],

    // 🔥 NEW SIGNATURE: 6 parameters with usedCommand
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        
        // 🔥 NEURAL LANGUAGE BRIDGE - Alias-based detection!
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, 'en')
            : 'en';
        
        const t = translations[lang];
        const prefix = serverSettings?.prefix || process.env.PREFIX || '.';
        const version = client.version || '1.6.0';
        const guildName = message.guild.name.toUpperCase();
        const guildIcon = message.guild.iconURL() || client.user.displayAvatarURL();
        
        // ================= PERMISSION CHECK =================
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setDescription(t.noPermission)
                .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon });
            return message.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
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
        
        // ================= CREATE GIVEAWAY =================
        const timeStr = args[0];
        const winnersStr = args[1];
        const prize = args.slice(2).join(' ');
        
        if (!timeStr || !winnersStr || !prize) {
            const embed = new EmbedBuilder()
                .setColor('#ED4245')
                .setTitle('❌ ' + t.missingArguments)
                .setDescription(
                    `**${t.usage}**\n**${t.example}**\n\n` +
                    `**${t.timeFormats}** \`10s\`, \`5m\`, \`2h\`, \`1d\``
                )
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });
            
            return message.reply({ embeds: [embed] }).catch(() => {});
        }
        
        const timeData = parseTime(timeStr, lang);
        if (!timeData) {
            return message.reply({ content: t.invalidTime, ephemeral: true }).catch(() => {});
        }
        
        const winners = parseInt(winnersStr);
        if (isNaN(winners) || winners < 1 || winners > 20) {
            return message.reply({ content: t.invalidWinners, ephemeral: true }).catch(() => {});
        }
        
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
            ended: false
        };
        
        // Create embed and buttons
        const embed = createGiveawayEmbed(giveaway, 'active', lang, message.guild, client);
        const row = createButtonRow('active', lang);
        
        const giveawayMessage = await message.channel.send({ 
            content: `🎉 **${t.title.toUpperCase()}!** 🎉`,
            embeds: [embed], 
            components: [row] 
        }).catch(() => {});
        
        if (!giveawayMessage) return;
        
        giveaway.messageId = giveawayMessage.id;
        activeGiveaways.set(giveawayId, giveaway);
        
        // ================= BUTTON COLLECTOR =================
        const collector = giveawayMessage.createMessageComponentCollector({ 
            componentType: ComponentType.Button
        });
        
        collector.on('collect', async (i) => {
            const currentGiveaway = activeGiveaways.get(giveawayId);
            if (!currentGiveaway) return;
            
            // Handle Enter
            if (i.customId === 'gw_enter') {
                if (i.user.id === currentGiveaway.hostId) {
                    return i.reply({ content: t.cannotEnter, ephemeral: true }).catch(() => {});
                }
                
                if (currentGiveaway.entries.includes(i.user.id)) {
                    return i.reply({ content: t.alreadyEntered, ephemeral: true }).catch(() => {});
                }
                
                currentGiveaway.entries.push(i.user.id);
                activeGiveaways.set(giveawayId, currentGiveaway);
                
                const updatedEmbed = createGiveawayEmbed(currentGiveaway, 'active', lang, message.guild, client);
                await i.update({ embeds: [updatedEmbed], components: [row] }).catch(() => {});
                
                return i.followUp({ content: t.enterSuccess, ephemeral: true }).catch(() => {});
            }
            
            // Handle Leave
            if (i.customId === 'gw_leave') {
                const index = currentGiveaway.entries.indexOf(i.user.id);
                if (index === -1) {
                    return i.reply({ content: t.notEntered, ephemeral: true }).catch(() => {});
                }
                
                currentGiveaway.entries.splice(index, 1);
                activeGiveaways.set(giveawayId, currentGiveaway);
                
                const updatedEmbed = createGiveawayEmbed(currentGiveaway, 'active', lang, message.guild, client);
                await i.update({ embeds: [updatedEmbed], components: [row] }).catch(() => {});
                
                return i.followUp({ content: t.leaveSuccess, ephemeral: true }).catch(() => {});
            }
            
            // Handle Reroll (Host/Admin Only)
            if (i.customId === 'gw_reroll') {
                if (i.user.id !== currentGiveaway.hostId && !i.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                    return i.reply({ content: t.accessDenied, ephemeral: true }).catch(() => {});
                }
                
                const newWinners = selectWinners(currentGiveaway.entries, currentGiveaway.winners);
                
                if (newWinners.length === 0) {
                    return i.reply({ content: t.noEntries, ephemeral: true }).catch(() => {});
                }
                
                currentGiveaway.winnersList = newWinners;
                const rerollEmbed = createGiveawayEmbed(currentGiveaway, 'ended', lang, message.guild, client);
                await i.update({ embeds: [rerollEmbed], components: [createButtonRow('ended', lang)] }).catch(() => {});
                
                const winnerAnnouncement = new EmbedBuilder()
                    .setColor('#FEE75C')
                    .setTitle(`🎊 ${t.giveawayEnded}`)
                    .setDescription(
                        `**${t.prize}:** ${currentGiveaway.prize}\n` +
                        `**${t.winnersList}:** ${newWinners.map(w => `<@${w}>`).join(', ')}\n\n` +
                        `🎉 **${t.congratulations}!**`
                    )
                    .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                    .setTimestamp();
                
                await i.channel.send({ content: newWinners.map(w => `<@${w}>`).join(' '), embeds: [winnerAnnouncement] }).catch(() => {});
                
                // Credit if prize contains numbers
                const creditMatch = currentGiveaway.prize.match(/(\d+)/);
                if (creditMatch && (currentGiveaway.prize.toLowerCase().includes('credit') || currentGiveaway.prize.toLowerCase().includes('crédit'))) {
                    const amount = parseInt(creditMatch[0]);
                    for (const winnerId of newWinners) {
                        const winnerData = client.getUserData ? client.getUserData(winnerId) : null;
                        if (client.queueUserUpdate && winnerData) {
                            client.queueUserUpdate(winnerId, { ...winnerData, credits: (winnerData.credits || 0) + amount });
                        } else {
                            db.prepare(`UPDATE users SET credits = COALESCE(credits, 0) + ? WHERE id = ?`).run(amount, winnerId);
                        }
                    }
                    console.log(`[GIVEAWAY] Credited ${amount} to ${newWinners.length} winner(s)`);
                }
                
                return i.followUp({ content: t.rerollSuccess, ephemeral: true }).catch(() => {});
            }
            
            // Handle Delete (Host/Admin Only)
            if (i.customId === 'gw_delete') {
                if (i.user.id !== currentGiveaway.hostId && !i.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                    return i.reply({ content: t.accessDenied, ephemeral: true }).catch(() => {});
                }
                
                activeGiveaways.delete(giveawayId);
                collector.stop();
                
                await i.update({ content: t.deleteSuccess, embeds: [], components: [] }).catch(() => {});
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
                            `${t.winnersList}: ${winnersList.length}\n` +
                            `\`\`\`\n` +
                            `🎉 **${t.congratulations}** ${winnersList.map(w => `<@${w}>`).join(', ')}!`
                        )
                        .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                        .setTimestamp();
                    
                    await message.channel.send({ content: winnersList.map(w => `<@${w}>`).join(' '), embeds: [winnerAnnouncement] }).catch(() => {});
                    
                    // Credit winners
                    const creditMatch = currentGiveaway.prize.match(/(\d+)/);
                    if (creditMatch && (currentGiveaway.prize.toLowerCase().includes('credit') || currentGiveaway.prize.toLowerCase().includes('crédit'))) {
                        const amount = parseInt(creditMatch[0]);
                        for (const winnerId of winnersList) {
                            const winnerData = client.getUserData ? client.getUserData(winnerId) : null;
                            if (client.queueUserUpdate && winnerData) {
                                client.queueUserUpdate(winnerId, { ...winnerData, credits: (winnerData.credits || 0) + amount });
                            } else {
                                db.prepare(`UPDATE users SET credits = COALESCE(credits, 0) + ? WHERE id = ?`).run(amount, winnerId);
                            }
                        }
                        console.log(`[GIVEAWAY] Ended - Credited ${amount} to ${winnersList.length} winner(s)`);
                    }
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
                `${t.timeRemaining}: ${timeData.text}\n` +
                `\`\`\`\n` +
                `✅ ${t.createdSuccess}`
            )
            .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
            .setTimestamp();
        
        return message.reply({ embeds: [confirmEmbed] }).catch(() => {});
    }
};