const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType, ComponentType, StringSelectMenuBuilder, SlashCommandBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const i18n = require('../lib/i18n');
const I18N_PLAIN = ["title", "transmitting", "complete", "cancelled", "broadcastDesc", "confirmationRequired", "confirmMessage", "totalNodes", "activeNodes", "failedNodes", "successRate", "transmissionTime", "confirm", "cancel", "mentionEveryone", "mentionHere", "noMention", "schedule", "selectChannel", "systemChannel", "generalChat", "firstTextChannel", "announcementsChannel", "restricted", "usage", "noPermission", "preparing", "sending", "success", "footer", "mentionWarning", "noServers", "channelStrategy", "schedulePrompt", "scheduled", "invalidTime", "broadcastSent", "fromArchitect", "imageAttached"];
function loadT(lang) {
    const o = {};
    for (const k of I18N_PLAIN) o[k] = i18n.t(`broadcast.${k}`, lang);
    const _strategies = {};
    _strategies['system'] = i18n.t(`broadcast.strategies_system`, lang);
    _strategies['general'] = i18n.t(`broadcast.strategies_general`, lang);
    _strategies['first'] = i18n.t(`broadcast.strategies_first`, lang);
    _strategies['announcements'] = i18n.t(`broadcast.strategies_announcements`, lang);
    o.strategies = _strategies;
    return o;
}

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
    
    const t = loadT(lang);
    
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
    const t = loadT(lang);
    // ✅ DYNAMIC VERSION from client.version (reads from version.txt)
    const version = client.version || '1.5.0';
    const serverCount = client.guilds.cache.size;
    
    let description = `**${t.broadcastDesc}**\n\n`;
    description += `\`\`\`\n${settings.message || '(No text provided)'}\`\`\`\n\n`;
    description += `📊 **${t.totalNodes}:** \`${serverCount}\`\n`;
    description += `📋 **${i18n.t('broadcast.channelStrategy', lang, { a: loadT(lang).strategies[settings.channelStrategy] || settings.channelStrategy })}**\n`;
    
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
        description += `\n⚠️ ${i18n.t('broadcast.mentionWarning', lang, { a: settings.mentionType === 'everyone' ? '@everyone' : '@here' })}`;
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
    const t = loadT(lang);
    
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
    const t = loadT(lang);
    const version = client.version || '1.8.0';
    const startTime = Date.now();
    
    let success = 0;
    let fail = 0;
    const total = client.guilds.cache.size;
    
    // Build mention string
    let mentionText = '';
    if (settings.mentionType === 'everyone') {
        mentionText = '@everyone';
    } else if (settings.mentionType === 'here') {
        mentionText = '@here';
    }
    
    // Build the full message content (text + embed combined)
    const fullContent = mentionText ? `${mentionText}\n\n${settings.message || ''}` : (settings.message || '');
    
    // Create the broadcast embed (for the footer/image only, cleaner look)
    const broadcastEmbed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setAuthor({ 
            name: t.fromArchitect, 
            iconURL: client.user.displayAvatarURL() 
        })
        .setFooter({ text: `${t.footer} • v${version}` })
        .setTimestamp();
    
    // Only add image to embed, text goes as content for proper markdown rendering
    if (settings.imageUrl) {
        broadcastEmbed.setImage(settings.imageUrl);
    }
    
    // Send to all servers
    const promises = client.guilds.cache.map(async (guild) => {
        try {
            const channel = findBroadcastChannel(guild, settings.channelStrategy);
            
            if (channel) {
                // 🔥 Send text as CONTENT (preserves markdown/ANSI) + embed for image/footer
                await channel.send({ 
                    content: fullContent || null, 
                    embeds: settings.imageUrl ? [broadcastEmbed] : [] 
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
            await statusMsg.edit({ content: i18n.t('broadcast.sending', lang, { a: completed, b: total }) }).catch(() => {});
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

// ================= SLASH COMMAND DATA =================

    run: async (client, message, args, database, serverSettings, usedCommand) => {
    const guildId = message.guild?.id ?? interaction?.guildId ?? 'DM';

        // ================= PERMISSION CHECK =================
// ================= PERMISSION CHECK =================
if (message.author.id !== process.env.OWNER_ID) {
    const lang = client.detectLanguage ? client.detectLanguage('broadcast', guildId) : 'en';
    const t = loadT(lang);
    return message.reply({ content: t.restricted });
}

// ================= LANGUAGE SETUP =================
const lang = client.detectLanguage ? client.detectLanguage('broadcast', guildId) : 'en';
const t = loadT(lang);
const prefix = serverSettings?.prefix || process.env.PREFIX || '.';
        
        const fullText = args.join(' ');

        // Check if any servers available
        if (client.guilds.cache.size === 0) {
            return message.reply({ content: t.noServers });
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
                return i.reply({ content: t.restricted, flags: 64 });
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
                        .setDescription(i18n.t('broadcast.success', lang, { a: result.success, b: result.fail, c: result.timeTaken }))
                        .setFooter({ text: `${t.footer} • v${client.version || '1.5.0'}` })
                        .setTimestamp();
                    
                    await reply.edit({ content: null, embeds: [successEmbed], components: [] });
                }
                
                if (i.customId === 'broadcast_schedule') {
                    await i.reply({ content: t.schedulePrompt, flags: 64 });
                    
                    const filter = m => m.author.id === message.author.id;
                    const scheduleCollector = message.channel.createMessageCollector({ filter, time: 60000, max: 1 });
                    
                    scheduleCollector.on('collect', async (m) => {
                        const input = m.content.trim().toLowerCase();
                        
                        if (input === 'cancel') {
                            scheduleCollector.stop();
                            return m.reply({ content: t.cancelled, flags: 64 });
                        }
                        
                        const timeData = parseTime(input, lang);
                        
                        if (!timeData) {
                            await m.reply({ content: t.invalidTime, flags: 64 });
                            scheduleCollector.stop();
                            return;
                        }
                        
                        settings.scheduledTime = timeData.text;
                        
                        await m.reply({ content: i18n.t('broadcast.scheduled', lang, { a: timeData.text }), flags: 64 });
                        await m.delete().catch(() => {});
                        
                        // Schedule the broadcast
                        setTimeout(async () => {
                            const result = await executeBroadcast(client, settings, lang, reply);
                            
                            const successEmbed = new EmbedBuilder()
                                .setColor('#2ecc71')
                                .setAuthor({ name: t.complete, iconURL: client.user.displayAvatarURL() })
                                .setDescription(i18n.t('broadcast.success', lang, { a: result.success, b: result.fail, c: result.timeTaken }))
                                .setFooter({ text: `${t.footer} • v${client.version || '1.5.0'}` })
                                .setTimestamp();
                            
                            await reply.edit({ content: null, embeds: [successEmbed], components: [] });
                        }, timeData.ms);
                        
                        const scheduledEmbed = new EmbedBuilder()
                            .setColor('#FEE75C')
                            .setAuthor({ name: t.title, iconURL: client.user.displayAvatarURL() })
                            .setDescription(i18n.t('broadcast.scheduled', lang, { a: timeData.text }))
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
                    .setFooter({ text: `${t.footer} • v${client.version || '1.8.0'}` })
                    .setTimestamp();
                await reply.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
            }
        });
    },

    // ================= SLASH COMMAND EXECUTION =================
    execute: async (interaction, client) => {
        
        // DM Fallback
        if (!interaction.guild) {
            const lang = require('../lib/i18n').slashLang(interaction, ['en', 'fr']);
            const t = loadT(lang);
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setDescription('❌ Broadcast commands can only be used in a server channel.')
                .setFooter({ text: `Neural Core • v${client.version || '1.8.0'}` });
            return interaction.reply({ embeds: [errorEmbed], flags: 64 });
        }
        
        // Permission check
        if (interaction.user.id !== process.env.OWNER_ID) {
            const lang = require('../lib/i18n').slashLang(interaction, ['en', 'fr']);
            const t = loadT(lang);
            return interaction.reply({ content: t.restricted, flags: 64 });
        }
        
        await interaction.deferReply();
        
        const messageText = interaction.options.getString('message');
        const imageUrl = interaction.options.getString('image');
        const mention = interaction.options.getString('mention') || 'none';
        const channelStrategy = interaction.options.getString('channel') || 'general';
        
        const lang = require('../lib/i18n').slashLang(interaction, ['en', 'fr']);
        const usedCommand = lang === 'fr' ? 'diffusion' : 'broadcast';
        
        const fullArgs = imageUrl ? `${messageText} ${imageUrl}` : messageText;
        const args = fullArgs.split(' ');
        
        const fakeMessage = {
            author: interaction.user,
            guild: interaction.guild,
            channel: interaction.channel,
            member: interaction.member,
            reply: async (options) => interaction.editReply(options),
            react: () => Promise.resolve()
        };
        
        const serverSettings = { prefix: '.', language: lang };
        
        await module.exports.run(client, fakeMessage, args, client.db, serverSettings, usedCommand);
    }
};