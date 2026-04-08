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
        enterButton: '🎉 Enter Giveaway',
        leaveButton: '🚪 Leave Giveaway',
        rerollButton: '🔄 Reroll',
        deleteButton: '🗑️ Delete',
        enterSuccess: '✅ You have entered the giveaway!',
        leaveSuccess: '🚪 You have left the giveaway.',
        alreadyEntered: '⚠️ You are already entered in this giveaway.',
        notEntered: '⚠️ You are not entered in this giveaway.',
        cannotEnter: '❌ You cannot enter your own giveaway.',
        giveawayEnded: '🎊 **GIVEAWAY ENDED** 🎊',
        congratulations: 'Congratulations',
        winnersList: 'Winner(s)',
        noEntries: 'No entries.',
        rerollSuccess: '🔄 New winner(s) selected!',
        deleteSuccess: '🗑️ Giveaway deleted.',
        invalidTime: '❌ Invalid time format. Use: `10s`, `5m`, `2h`, `1d`',
        invalidWinners: '❌ Invalid winner count. Must be a number between 1-20.',
        noPrize: '❌ Please specify a prize.',
        usage: 'Usage: `.giveaway [time] [winners] [prize]`',
        example: 'Example: `.giveaway 1h 2 1000 Credits`',
        footer: 'NEURAL GIVEAWAY',
        accessDenied: '❌ This menu is not yours.',
        noPermission: '❌ You need **Manage Server** permission to create giveaways.',
        entriesList: 'Entries',
        totalEntries: 'Total Entries',
        rerolling: '🔄 Rerolling...',
        timeUnits: { s: 'seconds', m: 'minutes', h: 'hours', d: 'days' },
        noActiveGiveaways: 'No active giveaways on this server.\n\nCreate one with: `{prefix}giveaway [time] [winners] [prize]`',
        activeGiveaways: 'Active Giveaway(s)',
        jumpToGiveaway: 'Jump to Giveaway',
        timeFormats: 'Time formats:',
        missingArguments: 'Missing Arguments'
    },
    fr: {
        title: '🎁 CONCOURS NEURAL',
        creating: '📝 CRÉATION DU CONCOURS',
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
        enterSuccess: '✅ Vous participez au concours !',
        leaveSuccess: '🚪 Vous avez quitté le concours.',
        alreadyEntered: '⚠️ Vous participez déjà à ce concours.',
        notEntered: '⚠️ Vous ne participez pas à ce concours.',
        cannotEnter: '❌ Vous ne pouvez pas participer à votre propre concours.',
        giveawayEnded: '🎊 **CONCOURS TERMINÉ** 🎊',
        congratulations: 'Félicitations',
        winnersList: 'Gagnant(s)',
        noEntries: 'Aucune participation.',
        rerollSuccess: '🔄 Nouveau(x) gagnant(s) sélectionné(s) !',
        deleteSuccess: '🗑️ Concours supprimé.',
        invalidTime: '❌ Format de temps invalide. Utilisez: `10s`, `5m`, `2h`, `1j`',
        invalidWinners: '❌ Nombre de gagnants invalide. Doit être un nombre entre 1-20.',
        noPrize: '❌ Veuillez spécifier un prix.',
        usage: 'Utilisation: `.concours [temps] [gagnants] [prix]`',
        example: 'Exemple: `.concours 1h 2 1000 Crédits`',
        footer: 'CONCOURS NEURAL',
        accessDenied: '❌ Ce menu ne vous appartient pas.',
        noPermission: '❌ Vous avez besoin de la permission **Gérer le Serveur** pour créer des concours.',
        entriesList: 'Participations',
        totalEntries: 'Total Participations',
        rerolling: '🔄 Nouveau tirage...',
        timeUnits: { s: 'secondes', m: 'minutes', h: 'heures', d: 'jours' },
        noActiveGiveaways: 'Aucun concours actif sur ce serveur.\n\nCréez-en un avec: `{prefix}concours [temps] [gagnants] [prix]`',
        activeGiveaways: 'Concours Actif(s)',
        jumpToGiveaway: 'Aller au Concours',
        timeFormats: 'Formats de temps:',
        missingArguments: 'Arguments Manquants'
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
    const version = client.version || '1.5.0';
    
    const color = status === 'active' ? '#2ecc71' : '#e74c3c';
    const title = status === 'active' ? `${t.title} • ${t.active}` : `${t.title} • ${t.ended}`;
    
    const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: title, iconURL: giveaway.hostIcon })
        .setTitle(`🎁 **${giveaway.prize}**`)
        .setDescription(
            `**${t.hostedBy}:** ${giveaway.hostName}\n` +
            `**${t.winners}:** \`${giveaway.winners}\`\n` +
            `**${t.entries}:** \`${giveaway.entries.length}\`\n\n` +
            (status === 'active' 
                ? `**${t.timeRemaining}:** ${giveaway.displayTime || giveaway.endTime}\n**${t.ends}:** <t:${Math.floor(giveaway.endTimestamp / 1000)}:R>`
                : `**${t.ended}:** <t:${Math.floor(giveaway.endTimestamp / 1000)}:R>`)
        )
        .setFooter({ 
            text: `${guild.name.toUpperCase()} • ${t.footer} • v${version}`, 
            iconURL: guild.iconURL() || client.user.displayAvatarURL() 
        })
        .setTimestamp();
    
    if (status === 'ended' && giveaway.winnersList && giveaway.winnersList.length > 0) {
        embed.addFields({
            name: `🏆 ${t.winnersList}`,
            value: giveaway.winnersList.map(w => `• <@${w}>`).join('\n'),
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
            new ButtonBuilder()
                .setCustomId('giveaway_enter')
                .setLabel(t.enterButton)
                .setStyle(ButtonStyle.Success)
                .setEmoji('🎉'),
            new ButtonBuilder()
                .setCustomId('giveaway_leave')
                .setLabel(t.leaveButton)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🚪')
        );
    } else {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('giveaway_reroll')
                .setLabel(t.rerollButton)
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🔄')
        );
    }
    
    row.addComponents(
        new ButtonBuilder()
            .setCustomId('giveaway_delete')
            .setLabel(t.deleteButton)
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️')
    );
    
    return row;
}

// ================= SELECT WINNERS =================
function selectWinners(entries, winnerCount) {
    if (entries.length === 0) return [];
    
    const shuffled = [...entries].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(winnerCount, entries.length));
}

// ================= MAIN COMMAND =================
module.exports = {
    name: 'giveaway',
    aliases: ['g', 'gift', 'concours', 'cadeau', 'give'],
    description: '🎁 Create credit giveaways for community engagement.',
    category: 'ECONOMY',
    cooldown: 5000,
    userPermissions: ['ManageGuild'],
    usage: '.giveaway [time] [winners] [prize]',
    examples: ['.giveaway 1h 2 1000 Credits', '.giveaway 30m 1 Legendary Pack', '.concours 2h 3 5000 Crédits'],

    run: async (client, message, args, database, serverSettings) => {
        
        // ================= LANGUAGE SETUP =================
        const lang = serverSettings?.language || 'en';
        const t = translations[lang];
        const prefix = serverSettings?.prefix || '.';
        const version = client.version || '1.5.0';
        const guildName = message.guild.name.toUpperCase();
        const guildIcon = message.guild.iconURL() || client.user.displayAvatarURL();
        
        // ================= PERMISSION CHECK =================
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply({ content: t.noPermission, ephemeral: true });
        }
        
        const db = database;
        
        // ================= SHOW ACTIVE GIVEAWAYS =================
        if (!args[0]) {
            const guildGiveaways = Array.from(activeGiveaways.values())
                .filter(g => g.guildId === message.guild.id);
            
            if (guildGiveaways.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#95a5a6')
                    .setAuthor({ name: t.title, iconURL: client.user.displayAvatarURL() })
                    .setDescription(t.noActiveGiveaways.replace('{prefix}', prefix))
                    .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });
                
                return message.reply({ embeds: [embed] });
            }
            
            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setAuthor({ name: `${t.title} • ${t.active}`, iconURL: client.user.displayAvatarURL() })
                .setTitle(`🎁 ${guildGiveaways.length} ${t.activeGiveaways}`)
                .setDescription(
                    guildGiveaways.map((g, i) => 
                        `**${i + 1}.** 🎁 **${g.prize}**\n` +
                        `└─ ${t.winners}: ${g.winners} • ${t.entries}: ${g.entries.length}\n` +
                        `└─ ${t.ends}: <t:${Math.floor(g.endTimestamp / 1000)}:R>\n` +
                        `└─ 🔗 [${t.jumpToGiveaway}](https://discord.com/channels/${g.guildId}/${g.channelId}/${g.messageId})`
                    ).join('\n\n')
                )
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        // ================= CREATE GIVEAWAY =================
        const timeStr = args[0];
        const winnersStr = args[1];
        const prize = args.slice(2).join(' ');
        
        // Validation
        if (!timeStr || !winnersStr || !prize) {
            const embed = new EmbedBuilder()
                .setColor('#ED4245')
                .setTitle('❌ ' + t.missingArguments)
                .setDescription(
                    `**${t.usage}**\n` +
                    `**${t.example}**\n\n` +
                    `**${t.timeFormats}** \`10s\`, \`5m\`, \`2h\`, \`1d\``
                )
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });
            
            return message.reply({ embeds: [embed] });
        }
        
        const timeData = parseTime(timeStr, lang);
        if (!timeData) {
            return message.reply({ content: t.invalidTime, ephemeral: true });
        }
        
        const winners = parseInt(winnersStr);
        if (isNaN(winners) || winners < 1 || winners > 20) {
            return message.reply({ content: t.invalidWinners, ephemeral: true });
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
        
        // Create embed
        const embed = createGiveawayEmbed(giveaway, 'active', lang, message.guild, client);
        const row = createButtonRow('active', lang);
        
        const giveawayMessage = await message.channel.send({ 
            content: `🎉 **${t.title.toUpperCase()}!** 🎉`,
            embeds: [embed], 
            components: [row] 
        });
        
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
            if (i.customId === 'giveaway_enter') {
                if (i.user.id === currentGiveaway.hostId) {
                    return i.reply({ content: t.cannotEnter, ephemeral: true });
                }
                
                if (currentGiveaway.entries.includes(i.user.id)) {
                    return i.reply({ content: t.alreadyEntered, ephemeral: true });
                }
                
                currentGiveaway.entries.push(i.user.id);
                activeGiveaways.set(giveawayId, currentGiveaway);
                
                const updatedEmbed = createGiveawayEmbed(currentGiveaway, 'active', lang, message.guild, client);
                await i.update({ embeds: [updatedEmbed], components: [row] });
                
                return i.followUp({ content: t.enterSuccess, ephemeral: true });
            }
            
            // Handle Leave
            if (i.customId === 'giveaway_leave') {
                const index = currentGiveaway.entries.indexOf(i.user.id);
                if (index === -1) {
                    return i.reply({ content: t.notEntered, ephemeral: true });
                }
                
                currentGiveaway.entries.splice(index, 1);
                activeGiveaways.set(giveawayId, currentGiveaway);
                
                const updatedEmbed = createGiveawayEmbed(currentGiveaway, 'active', lang, message.guild, client);
                await i.update({ embeds: [updatedEmbed], components: [row] });
                
                return i.followUp({ content: t.leaveSuccess, ephemeral: true });
            }
            
            // Handle Reroll (Host Only)
            if (i.customId === 'giveaway_reroll') {
                if (i.user.id !== currentGiveaway.hostId && !i.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                    return i.reply({ content: t.accessDenied, ephemeral: true });
                }
                
                const newWinners = selectWinners(currentGiveaway.entries, currentGiveaway.winners);
                
                if (newWinners.length === 0) {
                    return i.reply({ content: t.noEntries, ephemeral: true });
                }
                
                currentGiveaway.winnersList = newWinners;
                
                const rerollEmbed = createGiveawayEmbed(currentGiveaway, 'ended', lang, message.guild, client);
                await i.update({ embeds: [rerollEmbed], components: [createButtonRow('ended', lang)] });
                
                // Announce winners
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
                
                await i.channel.send({ 
                    content: newWinners.map(w => `<@${w}>`).join(' '),
                    embeds: [winnerAnnouncement] 
                });
                
                return i.followUp({ content: t.rerollSuccess, ephemeral: true });
            }
            
            // Handle Delete (Host/Admin Only)
            if (i.customId === 'giveaway_delete') {
                if (i.user.id !== currentGiveaway.hostId && !i.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                    return i.reply({ content: t.accessDenied, ephemeral: true });
                }
                
                activeGiveaways.delete(giveawayId);
                collector.stop();
                
                await i.update({ 
                    content: t.deleteSuccess,
                    embeds: [], 
                    components: [] 
                });
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
                });
                
                // Announce winners
                if (winnersList.length > 0) {
                    const winnerAnnouncement = new EmbedBuilder()
                        .setColor('#FEE75C')
                        .setTitle(`🎊 ${t.giveawayEnded}`)
                        .setDescription(
                            `**${t.prize}:** ${currentGiveaway.prize}\n` +
                            `**${t.winnersList}:** ${winnersList.map(w => `<@${w}>`).join(', ')}\n\n` +
                            `🎉 **${t.congratulations}!**`
                        )
                        .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                        .setTimestamp();
                    
                    await message.channel.send({ 
                        content: winnersList.map(w => `<@${w}>`).join(' '),
                        embeds: [winnerAnnouncement] 
                    });
                    
                    // Credit the prize if it contains "Credit" or "Crédit"
                    if (currentGiveaway.prize.toLowerCase().includes('credit') || 
                        currentGiveaway.prize.toLowerCase().includes('crédit')) {
                        const creditMatch = currentGiveaway.prize.match(/(\d+)/);
                        if (creditMatch) {
                            const creditAmount = parseInt(creditMatch[0]);
                            for (const winnerId of winnersList) {
                                try {
                                    db.prepare(`UPDATE users SET credits = COALESCE(credits, 0) + ? WHERE id = ?`)
                                        .run(creditAmount, winnerId);
                                } catch (err) {
                                    console.error(`[GIVEAWAY] Failed to credit ${winnerId}:`, err);
                                }
                            }
                        }
                    }
                } else {
                    await message.channel.send({ 
                        content: `😢 ${t.noEntries}` 
                    });
                }
            } catch (err) {
                console.error('[GIVEAWAY] Error ending giveaway:', err);
            }
            
            // Keep in memory for 1 hour for rerolls, then cleanup
            setTimeout(() => {
                activeGiveaways.delete(giveawayId);
            }, 3600000);
            
        }, timeData.ms);
        
        // ================= CONFIRMATION =================
        const confirmEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setAuthor({ name: t.creating, iconURL: message.author.displayAvatarURL() })
            .setDescription(
                `🎁 **${t.prize}:** ${prize}\n` +
                `👥 **${t.winners}:** ${winners}\n` +
                `⏰ **${t.timeRemaining}:** ${timeData.text}\n\n` +
                `✅ ${lang === 'fr' ? 'Concours créé avec succès!' : 'Giveaway created successfully!'}`
            )
            .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
            .setTimestamp();
        
        return message.reply({ embeds: [confirmEmbed], ephemeral: true });
    }
};