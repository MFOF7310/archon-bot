const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const os = require('os');

// ================= ENGLISH TRANSLATIONS ONLY =================
const t = {
    // Author & Titles
    author: '🦅 ARCHON CG-223 // ADVANCED DASHBOARD',
    title: '⚡ SYSTEM INTELLIGENCE REPORT',
    description: (version) => `\`\`\`diff\n+ SYSTEM STATUS: OPERATIONAL\n+ NODE LOCATION: BAMAKO-223 🇲🇱\n+ ARCHON VERSION: v${version}\`\`\``,
    
    // =================  Sections ================= 
    botTelemetry: '📡 BOT TELEMETRY',
    version: 'Version',
    uptime: 'Uptime',
    apiLatency: 'API Latency',
    response: 'Response',
    systemResources: '💻 SYSTEM RESOURCES',
    platform: 'Platform',
    host: 'Host',
    cpu: 'CPU',
    cores: 'Cores',
    loadAvg: 'Load Avg',
    ram: 'RAM',
    memory: 'Memory',
    discordStats: '🎮 DISCORD STATISTICS',
    servers: 'Servers',
    users: 'Users',
    channels: 'Channels',
    emojis: 'Emojis',
    commands: 'Commands',
    databaseAnalytics: '🗄️ DATABASE ANALYTICS',
    totalUsers: 'Users',
    totalXp: 'Total XP',
    avgLevel: 'Avg Level',
    timeLocation: '🌍 TIME & LOCATION',
    date: 'Date',
    time: 'Time',
    timezone: 'Timezone',
    region: 'Region',
    performanceMetrics: '⚙️ PERFORMANCE METRICS',
    cpuLoad: 'CPU Load',
    ramUsage: 'RAM Usage',
    status: 'Status',
    stable: 'Stable',
    commandLibrary: '📚 COMMAND LIBRARY',
    continued: '📚 COMMAND LIBRARY (Continued)',
    systemStatus: '🎯 SYSTEM STATUS & POWER RANK',
    botStatus: 'Bot Status',
    powerLevel: 'Power Level',
    progress: 'Progress',
    engine: 'Engine',
    optimized: 'OPTIMIZED',
    
    // ================= Server Dashboard Section ================= 
    serverDashboard: '🏰 SERVER DASHBOARD',
    owner: 'Owner',
    members: 'Members',
    active: 'active',
    boost: 'Boost',
    boosts: 'boosts',
    serverXp: 'Server XP',
    registeredUsers: 'Registered Users',
    topMember: 'Top Member',
    created: 'Created',
    
    powerRanks: {
        5000: '💎 LEGENDARY',
        2500: '⚡ ELITE',
        1000: '🌟 ADVANCED',
        500: '🛡️ SKILLED',
        100: '🌱 EMERGING',
        0: '🔰 NOVICE'
    },
    
    tips: [
        "🎮 Pro Tip: Use `.rank` to check your gaming rank!",
        "⚡ Did you know? You can mention @Lydia for AI assistance!",
        "🏆 Type `.leaderboard` to see top gamers!",
        "🎯 `.daily` gives you bonus XP every day!",
        "💎 Level 100 unlocks the Gaming God role!",
        "🤖 Lydia can search the web - just ask real-time questions!",
        "📊 Your gaming stats are tracked automatically!",
        "🎲 Try `.coinflip` or `.dice` for fun games!"
    ],
    
    errorTitle: '⚠️ DASHBOARD ENGINE FAILURE',
    errorDesc: 'The dashboard encountered an error while loading.',
    errorDetails: 'Error Details',
    actionRequired: 'Action Required',
    reportAdmin: 'Please report this to the system administrator.',
    noGuild: 'This command must be used in a server.',
    
    refresh: '🔄 Refresh',
    fullReport: '📊 Full Report',
    serverStats: '🏰 Server Stats',
    close: '❌ Close'
};

// ================= HELPER FUNCTIONS =================
function createProgressBar(percentage, length = 20) {
    const filled = Math.floor((percentage / 100) * length);
    return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, length - filled));
}

function getPowerRank(powerLevel) {
    const thresholds = [5000, 2500, 1000, 500, 100, 0];
    for (const threshold of thresholds) {
        if (powerLevel >= threshold) return t.powerRanks[threshold];
    }
    return t.powerRanks[0];
}

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

// ================= GENERATE DASHBOARD EMBED =================
async function generateDashboardEmbed(client, message, db, showServerStats = true) {
    const version = client.version || '2.0.0';
    const guild = message.guild;
    const startTime = Date.now();
    
    // ================= SYSTEM METRICS =================
    const uptimeSeconds = process.uptime();
    const uptimeStr = formatUptime(uptimeSeconds);
    
    const usedRAM = Math.round(process.memoryUsage().rss / 1024 / 1024);
    const totalRAM = Math.round(os.totalmem() / 1024 / 1024);
    const ramPercentage = ((usedRAM / totalRAM) * 100).toFixed(1);
    
    const cpuCores = os.cpus().length;
    const cpuModel = os.cpus()[0].model.split('@')[0].trim().substring(0, 30);
    const cpuSpeed = (os.cpus()[0].speed / 1000).toFixed(1);
    const loadAvg = os.loadavg().map(avg => avg.toFixed(2)).join(', ');
    
    const platform = `${os.type()} ${os.arch()}`;
    const hostname = os.hostname();
    
    const now = new Date();
    const time = now.toLocaleTimeString('en-GB', { 
        timeZone: 'Africa/Bamako', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const date = now.toLocaleDateString('en-GB', { 
        timeZone: 'Africa/Bamako', day: '2-digit', month: '2-digit', year: 'numeric'
    });
    
    // ================= DATABASE STATS =================
    let dbUserCount = 0, totalXP = 0, avgLevel = 0;
    let serverDbStats = { memberCount: 0, serverXP: 0, activeMembers: 0, topMember: null };
    
    try {
        if (db) {
            // ================= Global stats ================= 
            dbUserCount = db.prepare("SELECT COUNT(*) as count FROM users").get()?.count || 0;
            totalXP = db.prepare("SELECT SUM(xp) as total FROM users").get()?.total || 0;
            avgLevel = db.prepare("SELECT AVG(level) as avg FROM users").get()?.avg || 0;
            
            // ================= Server-specific stats ================= 
            if (guild) {
                serverDbStats.memberCount = db.prepare(`
                    SELECT COUNT(*) as count FROM users WHERE guild_id = ?
                `).get(guild.id)?.count || 0;
                
                serverDbStats.serverXP = db.prepare(`
                    SELECT SUM(xp) as total FROM users WHERE guild_id = ?
                `).get(guild.id)?.total || 0;
                
                serverDbStats.activeMembers = db.prepare(`
                    SELECT COUNT(*) as count FROM users 
                    WHERE guild_id = ? AND last_active > datetime('now', '-7 days')
                `).get(guild.id)?.count || 0;
                
                serverDbStats.topMember = db.prepare(`
                    SELECT username, level FROM users 
                    WHERE guild_id = ? 
                    ORDER BY xp DESC LIMIT 1
                `).get(guild.id);
            }
        }
    } catch (dbErr) {
        console.error('[DASHBOARD] DB Error:', dbErr.message);
    }
    
    // ================= DISCORD STATS =================
    const serverCount = client.guilds.cache.size;
    const userCount = client.users.cache.size;
    const channelCount = client.channels.cache.size;
    const emojiCount = client.emojis.cache.size;
    const totalCommands = client.commands.size;
    
    // ================= COMMAND CATEGORIES =================
    const categories = {};
    client.commands.forEach(cmd => {
        const cat = cmd.category ? cmd.category.toUpperCase() : 'GENERAL';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(cmd.name);
    });
    
    // ================= PERFORMANCE =================
    const apiLatency = Math.round(client.ws.ping);
    const responseTime = Date.now() - startTime;
    const ramBar = createProgressBar(parseFloat(ramPercentage));
    
    // ================= POWER LEVEL =================
    const commandPower = totalCommands * 20;
    const serverPower = serverCount * 150;
    const userPower = Math.min(Math.floor(dbUserCount * 2), 1000);
    const xpPower = Math.min(Math.floor(totalXP / 10000), 500);
    const uptimePower = Math.min(Math.floor(uptimeSeconds / 86400 * 15), 300);
    let powerLevel = Math.min(commandPower + serverPower + userPower + xpPower + uptimePower, 9999);
    
    const powerRank = getPowerRank(powerLevel);
    const nextLevelThreshold = powerLevel < 1000 ? 1000 : powerLevel < 2500 ? 2500 : powerLevel < 5000 ? 5000 : 9999;
    const progressToNext = Math.floor((powerLevel / nextLevelThreshold) * 100);
    const powerBar = createProgressBar(progressToNext);
    
    // ================= BUILD EMBED =================
    const embed = new EmbedBuilder()
        .setColor('#00d9ff')
        .setAuthor({ name: t.author, iconURL: client.user.displayAvatarURL() })
        .setTitle(t.title)
        .setThumbnail(guild?.iconURL() || client.user.displayAvatarURL())
        .setDescription(t.description(version))
        .addFields(
            {
                name: t.botTelemetry,
                value: `\`\`\`yaml\n${t.version}: v${version}\n${t.uptime}: ${uptimeStr}\n${t.apiLatency}: ${apiLatency}ms\n${t.response}: ${responseTime}ms\`\`\``,
                inline: true
            },
            {
                name: t.systemResources,
                value: `\`\`\`yaml\n${t.platform}: ${platform}\n${t.host}: ${hostname}\n${t.cpu}: ${cpuModel}\n${t.cores}: ${cpuCores} @ ${cpuSpeed}GHz\n${t.loadAvg}: ${loadAvg}\n${t.ram}: ${ramBar} ${ramPercentage}%\n${t.memory}: ${usedRAM}/${totalRAM} MB\`\`\``,
                inline: true
            },
            {
                name: t.discordStats,
                value: `\`\`\`yaml\n${t.servers}: ${serverCount}\n${t.users}: ${userCount.toLocaleString()}\n${t.channels}: ${channelCount}\n${t.emojis}: ${emojiCount}\n${t.commands}: ${totalCommands}\`\`\``,
                inline: true
            }
        );
    
    // ================= SERVER-SPECIFIC SECTION =================
    if (showServerStats && guild) {
        const owner = await guild.fetchOwner().catch(() => null);
        const boostLevel = guild.premiumTier;
        const boostCount = guild.premiumSubscriptionCount;
        
        embed.addFields({
            name: `🏰 ${guild.name.toUpperCase()} • SERVER DASHBOARD`,
            value: `\`\`\`yaml\n` +
                   `${t.owner}: ${owner?.user.tag || 'Unknown'}\n` +
                   `${t.members}: ${guild.memberCount} (${serverDbStats.activeMembers} ${t.active})\n` +
                   `${t.boost}: Tier ${boostLevel} (${boostCount} ${t.boosts})\n` +
                   `${t.serverXp}: ${serverDbStats.serverXP.toLocaleString()}\n` +
                   `${t.registeredUsers}: ${serverDbStats.memberCount}\n` +
                   `${t.topMember}: ${serverDbStats.topMember ? `${serverDbStats.topMember.username} (Lv.${serverDbStats.topMember.level})` : 'None'}\n` +
                   `${t.created}: ${guild.createdAt.toLocaleDateString()}\n` +
                   `\`\`\``,
            inline: false
        });
    }
    
    // ================= DATABASE & TIME FIELDS =================
    embed.addFields(
        {
            name: t.databaseAnalytics,
            value: `\`\`\`yaml\n${t.totalUsers}: ${dbUserCount}\n${t.totalXp}: ${totalXP.toLocaleString()}\n${t.avgLevel}: ${avgLevel.toFixed(1)}\`\`\``,
            inline: true
        },
        {
            name: t.timeLocation,
            value: `\`\`\`yaml\n${t.date}: ${date}\n${t.time}: ${time}\n${t.timezone}: Africa/Bamako\n${t.region}: West Africa\`\`\``,
            inline: true
        },
        {
            name: t.performanceMetrics,
            value: `\`\`\`yaml\n${t.cpuLoad}: ${loadAvg.split(',')[0]}%\n${t.ramUsage}: ${ramPercentage}%\n${t.status}: ${t.stable}\`\`\``,
            inline: true
        }
    );
    
    // ================= COMMAND LIBRARY =================
    const sortedCats = Object.keys(categories).sort();
    let categoryFields = [];
    let currentField = { name: t.commandLibrary, value: '', inline: false };
    
    for (const cat of sortedCats) {
        const cmdCount = categories[cat].length;
        const cmdList = categories[cat].sort().map(cmd => `\`${cmd}\``).join(' • ');
        const categoryValue = `**${cat}** \`[${cmdCount}]\`\n${cmdList}\n\n`;
        
        if ((currentField.value + categoryValue).length > 1024) {
            categoryFields.push(currentField);
            currentField = { name: t.continued, value: categoryValue, inline: false };
        } else {
            currentField.value += categoryValue;
        }
    }
    if (currentField.value) categoryFields.push(currentField);
    categoryFields.forEach(field => embed.addFields(field));
    
    // ================= SYSTEM STATUS =================
    const randomTip = t.tips[Math.floor(Math.random() * t.tips.length)];
    const statusEmojis = { online: '🟢', idle: '🟡', dnd: '🔴', offline: '⚫' };
    const botStatus = statusEmojis[client.user?.presence?.status] || '🟢';
    
    embed.addFields({
        name: t.systemStatus,
        value: `\`\`\`yaml\n${randomTip}\n\n${t.botStatus}: ${botStatus} ${client.user?.presence?.status?.toUpperCase() || 'ONLINE'}\n${t.powerLevel}: ${powerLevel}/9999 [${powerRank}]\n${t.progress}: ${powerBar} ${progressToNext}%\n${t.engine}: ${t.optimized}\`\`\``,
        inline: false
    });
    
    embed.setFooter({ 
        text: `${guild?.name?.toUpperCase() || 'DIMENSIONAL VOID'} • ARCHON CG-223 • v${version}`,
        iconURL: message.author.displayAvatarURL()
    }).setTimestamp();
    
    const performanceScore = (100 - parseFloat(ramPercentage)) + (100 - (apiLatency / 10));
    if (performanceScore > 150) embed.setColor('#2ecc71');
    else if (performanceScore > 100) embed.setColor('#f39c12');
    else embed.setColor('#e74c3c');
    
    return embed;
}

// ================= MODULE EXPORTS =================
module.exports = {
    name: 'dashboard',
    aliases: ['db', 'dash', 'sysinfo', 'engine', 'system', 'statusboard'],
    description: '🎮 Advanced system dashboard with real-time metrics and server analytics.',
    category: 'SYSTEM',
    cooldown: 5000,
    usage: '.dashboard',
    examples: ['.dashboard', '.dash', '.db'],

    // ================= SLASH COMMAND DATA =================
    data: new SlashCommandBuilder()
        .setName('dashboard')
        .setDescription('🎮 Display the advanced system dashboard with real-time metrics')
        .addBooleanOption(option =>
            option.setName('server_stats')
                .setDescription('Show server-specific statistics')
                .setRequired(false)
        ),

    // ================= PREFIX COMMAND =================
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        try {
            const embed = await generateDashboardEmbed(client, message, db, true);
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('dash_refresh')
                    .setLabel(t.refresh)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔄'),
                new ButtonBuilder()
                    .setCustomId('dash_close')
                    .setLabel(t.close)
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('❌')
            );
            
            const reply = await message.reply({ embeds: [embed], components: [row] }).catch(() => {});
            if (!reply) return;
            
            // Button collector
            const collector = reply.createMessageComponentCollector({ 
                filter: i => i.user.id === message.author.id,
                time: 120000 
            });
            
            collector.on('collect', async (interaction) => {
                try {
                    await interaction.deferUpdate();
                } catch (error) {
                    if (error.code === 10062) {
                        console.log('[DASHBOARD] Interaction expired');
                        return;
                    }
                    throw error;
                }
                
                if (interaction.customId === 'dash_close') {
                    await reply.delete().catch(() => {});
                    collector.stop();
                    return;
                }
                
                if (interaction.customId === 'dash_refresh') {
                    const newEmbed = await generateDashboardEmbed(client, message, db, true);
                    await interaction.editReply({ embeds: [newEmbed], components: [row] });
                }
            });
            
            console.log(`[DASHBOARD] ${message.author.tag} | Servers: ${client.guilds.cache.size} | Commands: ${client.commands.size}`);
            
        } catch (error) {
            console.error('[DASHBOARD] Error:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle(t.errorTitle)
                .setDescription(t.errorDesc)
                .addFields(
                    { name: t.errorDetails, value: `\`\`\`js\n${error.message}\`\`\``, inline: false },
                    { name: t.actionRequired, value: t.reportAdmin, inline: false }
                )
                .setFooter({ text: `ARCHON CG-223 • v${client.version || '2.0.0'}` })
                .setTimestamp();
            
            await message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }
    },

    // ================= SLASH COMMAND EXECUTE =================
    execute: async (interaction, client, localizedStrings) => {
        const strings = localizedStrings || t;
        
        try {
            await interaction.deferReply({ flags: 64 });
            
            const showServerStats = interaction.options.getBoolean('server_stats') ?? true;
            
            if (!interaction.guild && showServerStats) {
                return interaction.editReply({ 
                    content: strings.noGuild || t.noGuild,
                    flags: 64 
                });
            }
            
            // ================= Create mock message for embed generator ================= 
            const mockMessage = {
                guild: interaction.guild,
                author: interaction.user,
                channel: interaction.channel
            };
            
            const embed = await generateDashboardEmbed(client, mockMessage, client.db, showServerStats);
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('dash_refresh_slash')
                    .setLabel(t.refresh)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔄'),
                new ButtonBuilder()
                    .setCustomId('dash_close_slash')
                    .setLabel(t.close)
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('❌')
            );
            
            await interaction.editReply({ embeds: [embed], components: [row] });
            
            // Button collector
            const collector = interaction.channel.createMessageComponentCollector({ 
                filter: i => i.user.id === interaction.user.id,
                time: 120000 
            });
            
            collector.on('collect', async (btnInteraction) => {
                try {
                    await btnInteraction.deferUpdate();
                } catch (error) {
                    if (error.code === 10062) {
                        console.log('[DASHBOARD] Slash interaction expired');
                        return;
                    }
                    throw error;
                }
                
                if (btnInteraction.customId === 'dash_close_slash') {
                    await interaction.deleteReply().catch(() => {});
                    collector.stop();
                    return;
                }
                
                if (btnInteraction.customId === 'dash_refresh_slash') {
                    const newEmbed = await generateDashboardEmbed(client, mockMessage, client.db, showServerStats);
                    await btnInteraction.editReply({ embeds: [newEmbed], components: [row] });
                }
            });
            
            console.log(`[DASHBOARD SLASH] ${interaction.user.tag} | Server: ${interaction.guild?.name || 'DM'}`);
            
        } catch (error) {
            console.error('[DASHBOARD SLASH] Error:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle(t.errorTitle)
                .setDescription(t.errorDesc)
                .addFields(
                    { name: t.errorDetails, value: `\`\`\`js\n${error.message}\`\`\``, inline: false }
                );
            
            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] }).catch(() => {});
            } else {
                await interaction.reply({ embeds: [errorEmbed], flags: 64 }).catch(() => {});
            }
        }
    }
};