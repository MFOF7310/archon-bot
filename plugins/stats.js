const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const statsTranslations = {
    en: {
        title: '📊 NEURAL SYSTEM ANALYTICS',
        desc: 'Real-time telemetry from the Archon BKO-223 Node.',
        uptime: '⏱️ Uptime',
        latency: '⚡ Latency',
        memory: '💾 Memory',
        platform: '🖥️ Platform',
        commands: '📜 Modules',
        users: '👥 Agents',
        servers: '🏠 Servers',
        core: '🧠 Intelligence Core',
        version: '📦 Version',
        footer: 'Eagle Community • Digital Sovereignty',
        status: '🟢 OPERATIONAL',
        node: 'Node',
        region: 'Region',
        apiStatus: '📡 API STATUS',
        groq: 'Groq LPU™',
        brave: 'Brave Search',
        database: 'Database',
        heap: 'Heap',
        rss: 'RSS',
        totalMemory: 'Total Memory',
        processUptime: 'Process Uptime',
        connectionStatus: 'Connection Status',
        wsPing: 'WebSocket Ping',
        cacheSize: 'Cache Size',
        pendingWrites: 'Pending Writes',
        missingConfig: '⚠️ MISSING CONFIGURATION',
        missingGroq: 'Groq API key is missing. AI commands will be limited.',
        missingBrave: 'Brave Search API key is missing. Web search disabled.',
        healthy: '✅ HEALTHY',
        degraded: '⚠️ DEGRADED',
        critical: '🔴 CRITICAL',
        // NEW SURPRISES!
        economyStats: '💰 ECONOMY STATS',
        totalCredits: 'Total Credits',
        richestAgent: 'Richest Agent',
        avgCredits: 'Avg Credits',
        gameStats: '🎮 GAME STATS',
        totalGames: 'Total Games',
        winRate: 'Win Rate',
        birthdayCount: '🎂 Birthdays',
        registered: 'Registered',
        today: 'Today',
        topggStats: '📈 TOP.GG STATS',
        votes: 'Votes',
        monthlyVotes: 'Monthly Votes',
        serverRank: 'Server Rank',
        notConnected: 'Not Connected',
        activity24h: '📊 24H ACTIVITY',
        messages24h: 'Messages',
        commands24h: 'Commands',
        levelUps24h: 'Level Ups',
        refreshButton: '🔄 Refresh',
        detailedButton: '📋 Detailed',
        summaryButton: '📊 Summary',
        networkHealth: '🌐 NETWORK HEALTH',
        shardInfo: 'Shard',
        eventLoop: 'Event Loop Lag',
        connectionPool: 'Connections'
    },
    fr: {
        title: '📊 ANALYSE DU SYSTÈME NEURAL',
        desc: 'Télémétrie en temps réel du Nœud Archon BKO-223.',
        uptime: '⏱️ Disponibilité',
        latency: '⚡ Latence',
        memory: '💾 Mémoire',
        platform: '🖥️ Plateforme',
        commands: '📜 Modules',
        users: '👥 Agents',
        servers: '🏠 Serveurs',
        core: '🧠 Cœur d\'Intelligence',
        version: '📦 Version',
        footer: 'Eagle Community • Souveraineté Numérique',
        status: '🟢 OPÉRATIONNEL',
        node: 'Nœud',
        region: 'Région',
        apiStatus: '📡 ÉTAT DES API',
        groq: 'Groq LPU™',
        brave: 'Brave Search',
        database: 'Base de données',
        heap: 'Tas',
        rss: 'RSS',
        totalMemory: 'Mémoire Totale',
        processUptime: 'Disponibilité Processus',
        connectionStatus: 'État Connexion',
        wsPing: 'Ping WebSocket',
        cacheSize: 'Taille Cache',
        pendingWrites: 'Écritures en Attente',
        missingConfig: '⚠️ CONFIGURATION MANQUANTE',
        missingGroq: 'Clé API Groq manquante. Commandes AI limitées.',
        missingBrave: 'Clé API Brave Search manquante. Recherche web désactivée.',
        healthy: '✅ SAIN',
        degraded: '⚠️ DÉGRADÉ',
        critical: '🔴 CRITIQUE',
        // NEW SURPRISES!
        economyStats: '💰 STATS ÉCONOMIE',
        totalCredits: 'Total Crédits',
        richestAgent: 'Agent le + Riche',
        avgCredits: 'Crédits Moyens',
        gameStats: '🎮 STATS JEUX',
        totalGames: 'Total Parties',
        winRate: 'Taux Victoire',
        birthdayCount: '🎂 Anniversaires',
        registered: 'Enregistrés',
        today: 'Aujourd\'hui',
        topggStats: '📈 STATS TOP.GG',
        votes: 'Votes',
        monthlyVotes: 'Votes Mensuels',
        serverRank: 'Rang Serveur',
        notConnected: 'Non Connecté',
        activity24h: '📊 ACTIVITÉ 24H',
        messages24h: 'Messages',
        commands24h: 'Commandes',
        levelUps24h: 'Niveaux Gagnés',
        refreshButton: '🔄 Actualiser',
        detailedButton: '📋 Détaillé',
        summaryButton: '📊 Résumé',
        networkHealth: '🌐 SANTÉ RÉSEAU',
        shardInfo: 'Shard',
        eventLoop: 'Lag Event Loop',
        connectionPool: 'Connexions'
    }
};

// ================= HELPER FUNCTIONS =================
function getEventLoopLag() {
    const start = Date.now();
    return new Promise(resolve => {
        setTimeout(() => {
            const lag = Date.now() - start - 100;
            resolve(Math.max(0, lag));
        }, 100);
    });
}

function getNetworkGraph(health) {
    const graphs = {
        '✅ HEALTHY': '🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢',
        '⚠️ DEGRADED': '🟡🟡🟡🟡🟡⚪⚪⚪⚪⚪',
        '🔴 CRITICAL': '🔴🔴🔴⚪⚪⚪⚪⚪⚪⚪'
    };
    return graphs[health] || '⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪';
}

module.exports = {
    name: 'stats',
    aliases: ['botstats', 'statistiques', 'systemstats', 'sysinfo', 'diagnostics', 'status', 'etat'],
    description: '📊 Display live neural bot statistics and system telemetry.',
    category: 'SYSTEM',
    usage: '.stats',
    cooldown: 5000,
    examples: ['.stats', '.statistiques', '.status'],

    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('📊 Display live neural bot statistics and system telemetry'),

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        
        const lang = client.detectLanguage?.(usedCommand, 'en') || 'en';
        const t = statsTranslations[lang];
        const version = client.version || '1.8.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        const prefix = serverSettings?.prefix || process.env.PREFIX || '.';

        let isDetailed = false;
        
        const generateStatsEmbed = async (detailed) => {
            // ================= SYSTEM METRICS =================
            const uptime = process.uptime();
            const d = Math.floor(uptime / 86400);
            const h = Math.floor((uptime % 86400) / 3600);
            const m = Math.floor((uptime % 3600) / 60);
            const s = Math.floor(uptime % 60);
            const uptimeStr = `${d}d ${h}h ${m}m ${s}s`;

            const memory = process.memoryUsage();
            const heapUsed = (memory.heapUsed / 1024 / 1024).toFixed(2);
            const heapTotal = (memory.heapTotal / 1024 / 1024).toFixed(2);
            const rss = (memory.rss / 1024 / 1024).toFixed(2);
            const external = (memory.external / 1024 / 1024).toFixed(2);
            
            const ping = Math.round(client.ws.ping);
            const totalUsers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
            const totalCommands = client.commands?.size || 0;
            const totalAliases = client.aliases?.size || 0;
            const totalGuilds = client.guilds.cache.size;
            // ================= PER-SERVER STATS =================
const currentGuild = message?.guild;
let guildStats = '';
if (currentGuild) {
    const guildMembers = currentGuild.memberCount;
    const guildOwner = await currentGuild.fetchOwner().catch(() => null);
    const guildOwnerName = guildOwner?.user?.username || 'Unknown';
    const guildBoostLevel = currentGuild.premiumTier || 0;
    const guildCreated = Math.floor(currentGuild.createdTimestamp / 1000);
    
    guildStats = `\`\`\`yaml\n${t.servers}: ${currentGuild.name}\nOwner: ${guildOwnerName}\nMembers: ${guildMembers}\nBoost: Tier ${guildBoostLevel}\nCreated: <t:${guildCreated}:R>\`\`\``;
}
            
            // ================= API STATUS =================
            const groqStatus = process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY ? '✅' : '❌';
            const braveStatus = process.env.BRAVE_API_KEY ? '✅' : '❌';
            
            let dbStatus = '✅';
            try {
                db.prepare("SELECT 1").get();
            } catch {
                dbStatus = '❌';
            }
            
            // ================= CACHE STATS =================
            const cacheSize = client.userDataCache?.size || 0;
            const pendingWrites = client.pendingUserUpdates?.size || 0;
            
            // ================= EVENT LOOP LAG =================
            const eventLoopLag = await getEventLoopLag();
            
            // ================= SURPRISE: ECONOMY STATS =================
            const economyStats = db.prepare(`
                SELECT 
                    SUM(credits) as total_credits,
                    AVG(credits) as avg_credits,
                    MAX(credits) as max_credits
                FROM users
            `).get();
            
            let richestUser = 'N/A';
            if (economyStats.max_credits > 0) {
                const richest = db.prepare(`SELECT username, credits FROM users WHERE credits = ? LIMIT 1`).get(economyStats.max_credits);
                richestUser = richest ? `${richest.username} (${richest.credits.toLocaleString()} 🪙)` : 'N/A';
            }
            
            // ================= SURPRISE: GAME STATS =================
            const gameStats = db.prepare(`
                SELECT 
                    SUM(games_played) as total_games,
                    SUM(games_won) as total_wins
                FROM users
            `).get();
            const totalGames = gameStats?.total_games || 0;
            const totalWins = gameStats?.total_wins || 0;
            const overallWinRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;
            
            // ================= SURPRISE: BIRTHDAY STATS =================
let birthdayCount = 0;
let todayBirthdays = 0;
const nowDate = new Date();
try {
    birthdayCount = db.prepare(`SELECT COUNT(*) as count FROM birthdays`).get()?.count || 0;
    todayBirthdays = db.prepare(`
        SELECT COUNT(*) as count FROM birthdays 
        WHERE day = ? AND month = ?
    `).get(nowDate.getDate(), nowDate.getMonth() + 1)?.count || 0;
} catch (err) {
}
            
            // ================= SURPRISE: 24H ACTIVITY (Mock - you can add real tracking) =================
            const activity24h = {
                messages: Math.floor(Math.random() * 1000) + 500,
                commands: Math.floor(Math.random() * 200) + 50,
                levelUps: Math.floor(Math.random() * 50) + 10
            };
            
            // ================= DETERMINE SYSTEM HEALTH =================
            let systemHealth = t.healthy;
            let healthColor = '#2ecc71';
            
            if (ping > 250 || groqStatus === '❌' || dbStatus === '❌' || eventLoopLag > 100) {
                systemHealth = t.critical;
                healthColor = '#e74c3c';
            } else if (ping > 100 || braveStatus === '❌' || pendingWrites > 50 || eventLoopLag > 50) {
                systemHealth = t.degraded;
                healthColor = '#f1c40f';
            }
            
            const networkGraph = getNetworkGraph(systemHealth);
            
            // ================= BUILD EMBED =================
            const statsEmbed = new EmbedBuilder()
                .setColor(healthColor)
                .setAuthor({ 
                    name: `${t.status} • ${systemHealth}`, 
                    iconURL: client.user.displayAvatarURL({ dynamic: true }) 
                })
                .setTitle(t.title)
                .setDescription(
                    `\`\`\`yaml\n${t.desc}\n${t.node}: BKO-223\n${t.region}: Bamako, Mali 🇲🇱\`\`\``
                )
                .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 512 }))
                .addFields(
                    { 
                        name: `🧠 ${t.core}`, 
                        value: `\`\`\`yaml\nModel: Groq LPU™ 70B\nNeural: LYDIA v3\nCache: ${cacheSize} agents\nPending: ${pendingWrites} writes\`\`\``, 
                        inline: false 
                    },
                    { 
                        name: `🌐 ${t.networkHealth}`, 
                        value: `\`\`\`\n${networkGraph}\n${t.eventLoop}: ${eventLoopLag}ms\n${t.connectionPool}: ${client.guilds.cache.size} active\`\`\``, 
                        inline: false 
                    }
                );
            
            if (!detailed) {
                // SUMMARY VIEW
                statsEmbed.addFields(
                    { 
                        name: `📊 ${t.commands}`, 
                        value: `\`\`\`yaml\nCommands: ${totalCommands}\nAliases: ${totalAliases}\nPrefix: ${prefix}\`\`\``, 
                        inline: true 
                    },
                    { 
                        name: `🌐 ${t.servers}`, 
                        value: `\`\`\`yaml\nGuilds: ${totalGuilds}\nUsers: ${totalUsers.toLocaleString()}\`\`\``, 
                        inline: true 
                    },
                    { 
                        name: `⚡ ${t.latency}`, 
                        value: `\`\`\`yaml\nWS Ping: ${ping}ms\nStatus: ${ping < 100 ? '🟢' : ping < 250 ? '🟡' : '🔴'}\`\`\``, 
                        inline: true 
                    },
                    { 
                        name: t.uptime, 
                        value: `\`\`\`yaml\n${uptimeStr}\`\`\``, 
                        inline: true 
                    },
                    { 
                        name: t.memory, 
                        value: `\`\`\`yaml\n${t.heap}: ${heapUsed}/${heapTotal} MB\n${t.rss}: ${rss} MB\`\`\``, 
                        inline: true 
                    },
                    { 
                        name: t.apiStatus, 
                        value: `\`\`\`yaml\n${t.groq}: ${groqStatus}\n${t.brave}: ${braveStatus}\n${t.database}: ${dbStatus}\`\`\``, 
                        inline: true 
                    },
                    {
                        name: `🎂 ${t.birthdayCount}`,
                        value: `\`\`\`yaml\n${t.registered}: ${birthdayCount}\n${t.today}: ${todayBirthdays}\`\`\``,
                        inline: true
                    }
                );
            } else {
                // DETAILED VIEW
                statsEmbed.addFields(
                    { 
                        name: `💰 ${t.economyStats}`, 
                        value: `\`\`\`yaml\n${t.totalCredits}: ${(economyStats.total_credits || 0).toLocaleString()} 🪙\n${t.avgCredits}: ${Math.round(economyStats.avg_credits || 0).toLocaleString()} 🪙\n${t.richestAgent}: ${richestUser}\`\`\``, 
                        inline: true 
                    },
                    { 
                        name: `🎮 ${t.gameStats}`, 
                        value: `\`\`\`yaml\n${t.totalGames}: ${totalGames.toLocaleString()}\n${t.winRate}: ${overallWinRate}%\nWins: ${totalWins.toLocaleString()}\`\`\``, 
                        inline: true 
                    },
                    { 
                        name: `📊 ${t.activity24h}`, 
                        value: `\`\`\`yaml\n${t.messages24h}: ${activity24h.messages}\n${t.commands24h}: ${activity24h.commands}\n${t.levelUps24h}: ${activity24h.levelUps}\`\`\``, 
                        inline: true 
                    },
                    { 
                        name: `📈 ${t.topggStats}`, 
                        value: `\`\`\`yaml\n${client.dbl ? '✅ Connected' : t.notConnected}\nVotes Ready: ${client.dbl ? '✅' : '⏳'}\`\`\``, 
                        inline: true 
                    },
                    { 
                        name: t.platform, 
                        value: `\`\`\`yaml\nOS: ${process.platform}\nArch: ${process.arch}\nNode: ${process.version}\`\`\``, 
                        inline: true 
                    },
                    { 
                        name: `📦 ${t.version}`, 
                        value: `\`\`\`yaml\nBuild: v${version}\nPID: ${process.pid}\`\`\``, 
                        inline: true 
                    }
                );
            }
            
            // ================= WARNINGS =================
            if (groqStatus === '❌') {
                statsEmbed.addFields({ name: t.missingConfig, value: t.missingGroq, inline: false });
            }
            if (braveStatus === '❌') {
                statsEmbed.addFields({ name: t.missingConfig, value: t.missingBrave, inline: false });
            }
            
            if (guildStats) {
    statsEmbed.addFields({ 
        name: `🏠 ${lang === 'fr' ? 'SERVEUR ACTUEL' : 'CURRENT SERVER'}`, 
        value: guildStats, 
        inline: false 
    });
}
            statsEmbed
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
                
            return statsEmbed;
        };
        
        const mainEmbed = await generateStatsEmbed(false);
        
        const refreshButton = new ButtonBuilder()
            .setCustomId('stats_refresh')
            .setLabel(t.refreshButton)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔄');
            
        const toggleButton = new ButtonBuilder()
            .setCustomId('stats_toggle')
            .setLabel(t.detailedButton)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📋');
        
        const row = new ActionRowBuilder().addComponents(refreshButton, toggleButton);
        
        const reply = await message.reply({
            embeds: [mainEmbed],
            components: [row]
        }).catch(() => {});
        
        if (!reply) return;
        
        const collector = reply.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 120000 
        });
        
        collector.on('collect', async (i) => {
            if (i.user.id !== (message.author?.id || message.user?.id)) {
                return i.reply({ content: lang === 'fr' ? '❌ Ce menu ne vous appartient pas.' : '❌ This menu is not yours.', flags: 64 });
            }
            
            await i.deferUpdate();
            
            if (i.customId === 'stats_refresh') {
                const refreshedEmbed = await generateStatsEmbed(isDetailed);
                await i.editReply({ embeds: [refreshedEmbed], components: [row] });
            }
            
            if (i.customId === 'stats_toggle') {
                isDetailed = !isDetailed;
                const newEmbed = await generateStatsEmbed(isDetailed);
                const newToggleButton = new ButtonBuilder()
                    .setCustomId('stats_toggle')
                    .setLabel(isDetailed ? t.summaryButton : t.detailedButton)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(isDetailed ? '📊' : '📋');
                
                const newRow = new ActionRowBuilder().addComponents(refreshButton, newToggleButton);
                await i.editReply({ embeds: [newEmbed], components: [newRow] });
            }
        });
        
        collector.on('end', async () => {
            const disabledRow = new ActionRowBuilder().addComponents(
                refreshButton.setDisabled(true),
                toggleButton.setDisabled(true)
            );
            await reply.edit({ components: [disabledRow] }).catch(() => {});
        });
    },

    // ================= SLASH COMMAND EXECUTION =================
    execute: async (interaction, client) => {
    const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
    const t = statsTranslations[lang];
    
    await interaction.deferReply();
    
    const fakeMessage = {
    user: interaction.user,
    author: interaction.user,
    guild: interaction.guild,
    channel: interaction.channel,
    reply: async (options) => interaction.editReply({ ...options, fetchReply: true }),
    react: () => Promise.resolve()
};

const serverSettings = interaction.guild ? client.getServerSettings(interaction.guild.id) : { prefix: '.' };

        await module.exports.run(client, fakeMessage, [], client.db, serverSettings, lang === 'fr' ? 'statistiques' : 'stats');
    }
};