const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType, ComponentType, StringSelectMenuBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        // Headers
        title: '📢 NEURAL GLOBAL BROADCAST',
        transmitting: '🛰️ TRANSMITTING',
        complete: '✅ TRANSMISSION COMPLETE',
        cancelled: '❌ BROADCAST CANCELLED',
        
        // Descriptions
        broadcastDesc: 'This message will be transmitted across all connected neural nodes.',
        confirmationRequired: '⚠️ **CONFIRMATION REQUIRED**',
        confirmMessage: (servers) => `You are about to broadcast to **${servers}** servers.\nAre you sure you want to proceed?`,
        
        // Stats
        totalNodes: 'Total Nodes',
        activeNodes: 'Active Nodes',
        failedNodes: 'Failed Nodes',
        successRate: 'Success Rate',
        transmissionTime: 'Transmission Time',
        
        // Buttons
        confirm: '✅ CONFIRM BROADCAST',
        cancel: '❌ CANCEL',
        mentionEveryone: '📢 @everyone',
        mentionHere: '📌 @here',
        noMention: '🔕 No Mention',
        schedule: '⏰ Schedule',
        selectChannel: '📋 Select Channel Type',
        
        // Channel Types
        systemChannel: '⚙️ System Channel',
        generalChat: '💬 General Chat',
        firstTextChannel: '📝 First Available',
        announcementsChannel: '📢 Announcements',
        
        // Messages
        restricted: '❌ **Restricted Access**\nThis command requires Architect-level clearance.',
        usage: (prefix) => `❌ **Usage:** \`${prefix}broadcast [message] [image URL]\`\n\n**Examples:**\n\`${prefix}broadcast Server maintenance in 10 minutes!\`\n\`${prefix}broadcast New update! https://imgur.com/example.png\``,
        noPermission: '❌ Only the **Architect** can use this command.',
        preparing: '🔍 **Scanning neural network...**\nPreparing broadcast transmission...',
        sending: (current, total) => `📡 **Transmitting...** (${current}/${total} nodes)`,
        success: (success, fail, time) => `✅ **Broadcast Complete!**\n\n📊 **Transmission Report:**\n🟢 Active Nodes: **${success}**\n🔴 Failed Nodes: **${fail}**\n📈 Success Rate: **${success + fail > 0 ? ((success/(success+fail))*100).toFixed(1) : 0}%**\n⏱️ Time: **${time}ms**`,
        footer: 'ARCHITECT CG-223 • Neural Broadcast System',
        mentionWarning: (type) => `⚠️ This will send **${type}** to all servers!`,
        noServers: '❌ No servers available for broadcast.',
        channelStrategy: (strategy) => `📋 **Channel Strategy:** ${strategy}`,
        
        // Schedule
        schedulePrompt: '⏰ **Schedule Broadcast**\nEnter time in format: `10s`, `5m`, `2h`, `1d`\nType `cancel` to abort.',
        scheduled: (time) => `✅ **Broadcast Scheduled!**\nWill send in **${time}**.`,
        invalidTime: '❌ Invalid time format. Use: `10s`, `5m`, `2h`, `1d`',
        
        // Channel Strategies
        strategies: {
            system: 'System Channel',
            general: 'General Chat',
            first: 'First Available',
            announcements: 'Announcements'
        },
        
        // New
        broadcastSent: '📢 **BROADCAST RECEIVED**',
        fromArchitect: 'Message from the Architect',
        imageAttached: '🖼️ Image attached below'
    },
    fr: {
        // Headers
        title: '📢 DIFFUSION NEURALE GLOBALE',
        transmitting: '🛰️ TRANSMISSION',
        complete: '✅ TRANSMISSION TERMINÉE',
        cancelled: '❌ DIFFUSION ANNULÉE',
        
        // Descriptions
        broadcastDesc: 'Ce message sera transmis à travers tous les nœuds neuraux connectés.',
        confirmationRequired: '⚠️ **CONFIRMATION REQUISE**',
        confirmMessage: (servers) => `Vous allez diffuser vers **${servers}** serveurs.\nÊtes-vous sûr de vouloir continuer ?`,
        
        // Stats
        totalNodes: 'Total Nœuds',
        activeNodes: 'Nœuds Actifs',
        failedNodes: 'Nœuds Échoués',
        successRate: 'Taux de Réussite',
        transmissionTime: 'Temps de Transmission',
        
        // Buttons
        confirm: '✅ CONFIRMER',
        cancel: '❌ ANNULER',
        mentionEveryone: '📢 @everyone',
        mentionHere: '📌 @here',
        noMention: '🔕 Sans Mention',
        schedule: '⏰ Planifier',
        selectChannel: '📋 Choisir le Type de Canal',
        
        // Channel Types
        systemChannel: '⚙️ Canal Système',
        generalChat: '💬 Chat Général',
        firstTextChannel: '📝 Premier Disponible',
        announcementsChannel: '📢 Annonces',
        
        // Messages
        restricted: '❌ **Accès Restreint**\nCette commande nécessite une autorisation de niveau Architecte.',
        usage: (prefix) => `❌ **Utilisation:** \`${prefix}broadcast [message] [URL image]\`\n\n**Exemples:**\n\`${prefix}broadcast Maintenance du serveur dans 10 minutes!\`\n\`${prefix}broadcast Nouvelle mise à jour! https://imgur.com/example.png\``,
        noPermission: '❌ Seul l\'**Architecte** peut utiliser cette commande.',
        preparing: '🔍 **Analyse du réseau neural...**\nPréparation de la transmission...',
        sending: (current, total) => `📡 **Transmission en cours...** (${current}/${total} nœuds)`,
        success: (success, fail, time) => `✅ **Diffusion Terminée!**\n\n📊 **Rapport de Transmission:**\n🟢 Nœuds Actifs: **${success}**\n🔴 Nœuds Échoués: **${fail}**\n📈 Taux de Réussite: **${success + fail > 0 ? ((success/(success+fail))*100).toFixed(1) : 0}%**\n⏱️ Temps: **${time}ms**`,
        footer: 'ARCHITECT CG-223 • Système de Diffusion Neurale',
        mentionWarning: (type) => `⚠️ Ceci enverra **${type}** à tous les serveurs!`,
        noServers: '❌ Aucun serveur disponible pour la diffusion.',
        channelStrategy: (strategy) => `📋 **Stratégie de Canal:** ${strategy}`,
        
        // Schedule
        schedulePrompt: '⏰ **Planifier la Diffusion**\nEntrez le temps au format: `10s`, `5m`, `2h`, `1j`\nTapez `cancel` pour annuler.',
        scheduled: (time) => `✅ **Diffusion Planifiée!**\nSera envoyée dans **${time}**.`,
        invalidTime: '❌ Format de temps invalide. Utilisez: `10s`, `5m`, `2h`, `1j`',
        
        // Channel Strategies
        strategies: {
            system: 'Canal Système',
            general: 'Chat Général',
            first: 'Premier Disponible',
            announcements: 'Annonces'
        },
        
        // New
        broadcastSent: '📢 **DIFFUSION REÇUE**',
        fromArchitect: 'Message de l\'Architecte',
        imageAttached: '🖼️ Image ci-dessous'
    }
};

// ================= FIND BEST CHANNEL FOR BROADCAST (MAIN CHAT FOCUSED) =================
function findBroadcastChannel(guild, strategy = 'first') {
    if (!guild) return null;
    
    const botMember = guild.members.me;
    if (!botMember) return null;
    
    switch (strategy) {
        case 'system':
            // System channel (set in server settings) - BEST FOR MAIN CHAT
            if (guild.systemChannel && 
                guild.systemChannel.permissionsFor(botMember).has(PermissionFlagsBits.SendMessages)) {
                return guild.systemChannel;
            }
            // Fallback to first available
            return guild.channels.cache.find(c => 
                c.type === ChannelType.GuildText && 
                c.permissionsFor(botMember).has(PermissionFlagsBits.SendMessages)
            );
            
        case 'general':
            // Channel named "general", "général", "main", "chat" - MAIN CHAT FOCUSED!
            const generalChannel = guild.channels.cache.find(c => 
                c.type === ChannelType.GuildText && 
                (c.name.includes('general') || c.name.includes('général') || 
                 c.name.includes('main') || c.name.includes('chat') ||
                 c.name.includes('discussion')) &&
                c.permissionsFor(botMember).has(PermissionFlagsBits.SendMessages)
            );
            if (generalChannel) return generalChannel;
            // Fallback to first available
            return guild.channels.cache.find(c => 
                c.type === ChannelType.GuildText && 
                c.permissionsFor(botMember).has(PermissionFlagsBits.SendMessages)
            );
            
        case 'announcements':
            // Channel named "announcements", "annonces", "news"
            const announcementChannel = guild.channels.cache.find(c => 
                c.type === ChannelType.GuildText && 
                (c.name.includes('announce') || c.name.includes('annonce') || 
                 c.name.includes('news') || c.name.includes('update')) &&
                c.permissionsFor(botMember).has(PermissionFlagsBits.SendMessages)
            );
            if (announcementChannel) return announcementChannel;
            // Fallback to general
            return findBroadcastChannel(guild, 'general');
            
        case 'first':
        default:
            // First available text channel - prioritizes channels with recent activity
            const channels = guild.channels.cache
                .filter(c => c.type === ChannelType.GuildText && 
                       c.permissionsFor(botMember).has(PermissionFlagsBits.SendMessages))
                .sort((a, b) => (b.lastMessageId ? 1 : 0) - (a.lastMessageId ? 1 : 0)); // Active channels first
            
            return channels.first() || null;
    }
}

// ================= PARSE TIME FUNCTION =================
function parseTime(timeStr, lang) {
    const regex = /^(\d+)([smhdj])$/i;
    const match = timeStr.match(regex);
    
    if (!match) return null;
    
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000, j: 86400000 };
    
    if (!multipliers[unit]) return null;
    
    const t = translations[lang];
    
    return {
        ms: value * multipliers[unit],
        display: `${value}${unit}`,
        text: unit === 's' ? `${value} ${lang === 'fr' ? 'secondes' : 'seconds'}` :
              unit === 'm' ? `${value} ${lang === 'fr' ? 'minutes' : 'minutes'}` :
              unit === 'h' ? `${value} ${lang === 'fr' ? 'heures' : 'hours'}` :
              `${value} ${lang === 'fr' ? 'jours' : 'days'}`
    };
}

// ================= CREATE CONFIRMATION EMBED =================
function createConfirmEmbed(settings, lang, client) {
    const t = translations[lang];
    // ✅ DYNAMIC VERSION from client.version (reads from version.txt)
    const version = client.version || '1.5.0';
    const serverCount = client.guilds.cache.size;
    
    let description = `**${t.broadcastDesc}**\n\n`;
    description += `\`\`\`\n${settings.message || '(No text provided)'}\`\`\`\n\n`;
    description += `📊 **${t.totalNodes}:** \`${serverCount}\`\n`;
    description += `📋 **${t.channelStrategy(t.strategies[settings.channelStrategy] || settings.channelStrategy)}**\n`;
    
    if (settings.mentionType !== 'none') {
        description += `📢 **Mention:** \`${settings.mentionType === 'everyone' ? '@everyone' : '@here'}\`\n`;
    }
    
    if (settings.imageUrl) {
        description += `🖼️ **Image:** \`${t.imageAttached}\`\n`;
    }
    
    if (settings.scheduledTime) {
        description += `⏰ **Scheduled:** \`${settings.scheduledTime}\`\n`;
    }
    
    if (settings.mentionType !== 'none') {
        description += `\n⚠️ ${t.mentionWarning(settings.mentionType === 'everyone' ? '@everyone' : '@here')}`;
    }
    
    const embed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setAuthor({ name: `${t.title} • ${t.confirmationRequired}`, iconURL: client.user.displayAvatarURL() })
        .setTitle('📡 NEURAL TRANSMISSION PREVIEW')
        .setDescription(description)
        .setFooter({ text: `${t.footer} • v${version}` })  // ✅ DYNAMIC VERSION
        .setTimestamp();
    
    if (settings.imageUrl) {
        embed.setImage(settings.imageUrl);
    }
    
    return embed;
}

// ================= CREATE CHANNEL STRATEGY MENU =================
function createChannelStrategyMenu(lang) {
    const t = translations[lang];
    
    return new StringSelectMenuBuilder()
        .setCustomId('broadcast_channel')
        .setPlaceholder(t.selectChannel)
        .addOptions([
            { label: t.generalChat, value: 'general', emoji: '💬', description: 'Channels like "general", "main", "chat" (RECOMMENDED)' },
            { label: t.systemChannel, value: 'system', emoji: '⚙️', description: 'Server\'s configured system channel' },
            { label: t.announcementsChannel, value: 'announcements', emoji: '📢', description: 'Channels like "announcements", "news"' },
            { label: t.firstTextChannel, value: 'first', emoji: '📝', description: 'First available active text channel' }
        ]);
}

// ================= EXECUTE BROADCAST =================
async function executeBroadcast(client, settings, lang, statusMsg) {
    const t = translations[lang];
    // ✅ DYNAMIC VERSION from client.version
    const version = client.version || '1.5.0';
    const startTime = Date.now();
    
    let success = 0;
    let fail = 0;
    const total = client.guilds.cache.size;
    
    // Create the broadcast embed
    const broadcastEmbed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle(t.broadcastSent)
        .setAuthor({ 
            name: t.fromArchitect, 
            iconURL: client.user.displayAvatarURL() 
        })
        .setDescription(settings.message || 'No text provided')
        .setFooter({ text: `${t.footer} • v${version}` })  // ✅ DYNAMIC VERSION
        .setTimestamp();
    
    if (settings.imageUrl) {
        broadcastEmbed.setImage(settings.imageUrl);
    }
    
    // Build mention string
    let mentionText = '';
    if (settings.mentionType === 'everyone') {
        mentionText = '@everyone ';
    } else if (settings.mentionType === 'here') {
        mentionText = '@here ';
    }
    
    // Send to all servers
    const promises = client.guilds.cache.map(async (guild) => {
        try {
            const channel = findBroadcastChannel(guild, settings.channelStrategy);
            
            if (channel) {
                await channel.send({ 
                    content: mentionText || null, 
                    embeds: [broadcastEmbed] 
                });
                success++;
            } else {
                fail++;
            }
        } catch (err) {
            fail++;
        }
    });
    
    // Update progress periodically
    let completed = 0;
    const updateInterval = setInterval(async () => {
        if (completed < total) {
            await statusMsg.edit({ content: t.sending(completed, total) }).catch(() => {});
        }
    }, 500);
    
    await Promise.all(promises);
    clearInterval(updateInterval);
    
    const endTime = Date.now();
    const timeTaken = endTime - startTime;
    
    return { success, fail, timeTaken };
}

// ================= MAIN COMMAND =================
module.exports = {
    name: 'broadcast',
    aliases: ['announce', 'global', 'transmit', 'diffusion', 'annonce'],
    description: '📢 Send a global announcement to all servers with intelligent channel selection.',
    category: 'OWNER',
    cooldown: 10000,
    usage: '.broadcast [message] [image URL]',
    examples: ['.broadcast Server update!', '.broadcast New features! https://imgur.com/example.png'],

    run: async (client, message, args, database, serverSettings, usedCommand) => {
        
        // ================= PERMISSION CHECK =================
        if (message.author.id !== process.env.OWNER_ID) {
            const lang = serverSettings?.language || 'en';
            const t = translations[lang];
            return message.reply({ content: t.restricted, ephemeral: true });
        }
        
        // ================= LANGUAGE SETUP =================
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, serverSettings?.language || 'en')
            : (serverSettings?.language || 'en');
        const t = translations[lang];
        const prefix = serverSettings?.prefix || process.env.PREFIX || '.';
        
        const fullText = args.join(' ');
        
        if (!fullText) {
            return message.reply({ content: t.usage(prefix), ephemeral: true });
        }
        
        // Check if any servers available
        if (client.guilds.cache.size === 0) {
            return message.reply({ content: t.noServers, ephemeral: true });
        }
        
        // Extract URL and message
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = fullText.match(urlRegex);
        
        let imageUrl = null;
        let announcementText = fullText;
        
        if (urls && urls.length > 0) {
            imageUrl = urls[0];
            announcementText = fullText.replace(imageUrl, '').trim();
        }
        
        // Default settings
        const settings = {
            message: announcementText || 'No text provided',
            imageUrl: imageUrl,
            mentionType: 'none',
            channelStrategy: 'general', // ✅ DEFAULT TO GENERAL/MAIN CHAT!
            scheduledTime: null
        };
        
        // ================= CREATE CONFIRMATION VIEW =================
        const confirmEmbed = createConfirmEmbed(settings, lang, client);
        
        const mentionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('broadcast_everyone').setLabel(t.mentionEveryone).setStyle(ButtonStyle.Danger).setEmoji('📢'),
            new ButtonBuilder().setCustomId('broadcast_here').setLabel(t.mentionHere).setStyle(ButtonStyle.Primary).setEmoji('📌'),
            new ButtonBuilder().setCustomId('broadcast_none').setLabel(t.noMention).setStyle(ButtonStyle.Secondary).setEmoji('🔕')
        );
        
        const channelMenu = createChannelStrategyMenu(lang);
        const channelRow = new ActionRowBuilder().addComponents(channelMenu);
        
        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('broadcast_confirm').setLabel(t.confirm).setStyle(ButtonStyle.Success).setEmoji('✅'),
            new ButtonBuilder().setCustomId('broadcast_schedule').setLabel(t.schedule).setStyle(ButtonStyle.Secondary).setEmoji('⏰'),
            new ButtonBuilder().setCustomId('broadcast_cancel').setLabel(t.cancel).setStyle(ButtonStyle.Danger).setEmoji('❌')
        );
        
        const reply = await message.reply({
            embeds: [confirmEmbed],
            components: [mentionRow, channelRow, actionRow]
        });
        
        // ================= COLLECTOR =================
        const collector = reply.createMessageComponentCollector({ time: 120000 });
        
        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) {
                return i.reply({ content: t.restricted, ephemeral: true });
            }
            
            // Handle Mention Buttons
            if (i.isButton()) {
                if (i.customId === 'broadcast_everyone') {
                    settings.mentionType = 'everyone';
                    const updatedEmbed = createConfirmEmbed(settings, lang, client);
                    await i.update({ embeds: [updatedEmbed], components: [mentionRow, channelRow, actionRow] });
                }
                
                if (i.customId === 'broadcast_here') {
                    settings.mentionType = 'here';
                    const updatedEmbed = createConfirmEmbed(settings, lang, client);
                    await i.update({ embeds: [updatedEmbed], components: [mentionRow, channelRow, actionRow] });
                }
                
                if (i.customId === 'broadcast_none') {
                    settings.mentionType = 'none';
                    const updatedEmbed = createConfirmEmbed(settings, lang, client);
                    await i.update({ embeds: [updatedEmbed], components: [mentionRow, channelRow, actionRow] });
                }
                
                if (i.customId === 'broadcast_cancel') {
                    collector.stop();
                    const cancelEmbed = new EmbedBuilder()
                        .setColor('#95a5a6')
                        .setAuthor({ name: t.cancelled, iconURL: client.user.displayAvatarURL() })
                        .setDescription('Broadcast transmission cancelled.')
                        .setFooter({ text: `${t.footer} • v${client.version || '1.5.0'}` })
                        .setTimestamp();
                    await i.update({ embeds: [cancelEmbed], components: [] });
                }
                
                if (i.customId === 'broadcast_confirm') {
                    collector.stop();
                    
                    await i.update({ 
                        content: t.preparing, 
                        embeds: [], 
                        components: [] 
                    });
                    
                    // Execute broadcast
                    const result = await executeBroadcast(client, settings, lang, reply);
                    
                    const successEmbed = new EmbedBuilder()
                        .setColor('#2ecc71')
                        .setAuthor({ name: t.complete, iconURL: client.user.displayAvatarURL() })
                        .setDescription(t.success(result.success, result.fail, result.timeTaken))
                        .setFooter({ text: `${t.footer} • v${client.version || '1.5.0'}` })
                        .setTimestamp();
                    
                    await reply.edit({ content: null, embeds: [successEmbed], components: [] });
                }
                
                if (i.customId === 'broadcast_schedule') {
                    await i.reply({ content: t.schedulePrompt, ephemeral: true });
                    
                    const filter = m => m.author.id === message.author.id;
                    const scheduleCollector = message.channel.createMessageCollector({ filter, time: 60000, max: 1 });
                    
                    scheduleCollector.on('collect', async (m) => {
                        const input = m.content.trim().toLowerCase();
                        
                        if (input === 'cancel') {
                            scheduleCollector.stop();
                            return m.reply({ content: t.cancelled, ephemeral: true });
                        }
                        
                        const timeData = parseTime(input, lang);
                        
                        if (!timeData) {
                            await m.reply({ content: t.invalidTime, ephemeral: true });
                            scheduleCollector.stop();
                            return;
                        }
                        
                        settings.scheduledTime = timeData.text;
                        
                        await m.reply({ content: t.scheduled(timeData.text), ephemeral: true });
                        await m.delete().catch(() => {});
                        
                        // Schedule the broadcast
                        setTimeout(async () => {
                            const result = await executeBroadcast(client, settings, lang, reply);
                            
                            const successEmbed = new EmbedBuilder()
                                .setColor('#2ecc71')
                                .setAuthor({ name: t.complete, iconURL: client.user.displayAvatarURL() })
                                .setDescription(t.success(result.success, result.fail, result.timeTaken))
                                .setFooter({ text: `${t.footer} • v${client.version || '1.5.0'}` })
                                .setTimestamp();
                            
                            await reply.edit({ content: null, embeds: [successEmbed], components: [] });
                        }, timeData.ms);
                        
                        const scheduledEmbed = new EmbedBuilder()
                            .setColor('#FEE75C')
                            .setAuthor({ name: t.title, iconURL: client.user.displayAvatarURL() })
                            .setDescription(t.scheduled(timeData.text))
                            .setFooter({ text: `${t.footer} • v${client.version || '1.5.0'}` })
                            .setTimestamp();
                        
                        await i.update({ embeds: [scheduledEmbed], components: [] });
                        collector.stop();
                        scheduleCollector.stop();
                    });
                }
            }
            
            // Handle Channel Strategy Menu
            if (i.isStringSelectMenu() && i.customId === 'broadcast_channel') {
                settings.channelStrategy = i.values[0];
                const updatedEmbed = createConfirmEmbed(settings, lang, client);
                await i.update({ embeds: [updatedEmbed], components: [mentionRow, channelRow, actionRow] });
            }
        });
        
        collector.on('end', async (collected, reason) => {
            if (reason === 'timeout') {
                const timeoutEmbed = new EmbedBuilder()
                    .setColor('#95a5a6')
                    .setAuthor({ name: t.cancelled, iconURL: client.user.displayAvatarURL() })
                    .setDescription('Broadcast session timed out.')
                    .setFooter({ text: `${t.footer} • v${client.version || '1.5.0'}` })
                    .setTimestamp();
                await reply.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
            }
        });
    }
};