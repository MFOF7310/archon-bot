const { EmbedBuilder } = require('discord.js');

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
        critical: '🔴 CRITICAL'
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
        critical: '🔴 CRITIQUE'
    }
};

module.exports = {
    name: 'stats',
    aliases: ['botstats', 'statistiques', 'systemstats', 'sysinfo', 'diagnostics', 'status', 'etat'],
    description: '📊 Display live neural bot statistics and system telemetry.',
    category: 'SYSTEM',
    usage: '.stats',
    cooldown: 5000,
    examples: ['.stats', '.statistiques', '.status'],

    // 🔥 NEW SIGNATURE: 6 parameters with usedCommand
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        
        // 🔥 NEURAL LANGUAGE BRIDGE - Alias-based detection!
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, 'en')
            : 'en';
        
        const t = statsTranslations[lang];
        const version = client.version || '1.6.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        const prefix = serverSettings?.prefix || process.env.PREFIX || '.';

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
        
        // ================= DETERMINE SYSTEM HEALTH =================
        let systemHealth = t.healthy;
        let healthColor = '#2ecc71';
        
        if (ping > 250 || groqStatus === '❌' || dbStatus === '❌') {
            systemHealth = t.critical;
            healthColor = '#e74c3c';
        } else if (ping > 100 || braveStatus === '❌' || pendingWrites > 50) {
            systemHealth = t.degraded;
            healthColor = '#f1c40f';
        }
        
        // ================= BUILD EMBED =================
        const statsEmbed = new EmbedBuilder()
            .setColor(healthColor)
            .setAuthor({ 
                name: `${t.status} • ${systemHealth}`, 
                iconURL: client.user.displayAvatarURL({ dynamic: true }) 
            })
            .setTitle(t.title)
            .setDescription(
                `\`\`\`yaml\n` +
                `${t.desc}\n` +
                `${t.node}: BKO-223\n` +
                `${t.region}: Bamako, Mali 🇲🇱\`\`\``
            )
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 512 }))
            .addFields(
                { 
                    name: `🧠 ${t.core}`, 
                    value: `\`\`\`yaml\nModel: Groq LPU™ 70B\nNeural: LYDIA v3\nCache: ${cacheSize} agents\nPending: ${pendingWrites} writes\`\`\``, 
                    inline: false 
                },
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
                    value: `\`\`\`yaml\n${uptimeStr}\nProcess: ${process.pid}\`\`\``, 
                    inline: true 
                },
                { 
                    name: t.memory, 
                    value: `\`\`\`yaml\n${t.heap}: ${heapUsed}/${heapTotal} MB\n${t.rss}: ${rss} MB\nExternal: ${external} MB\`\`\``, 
                    inline: true 
                },
                { 
                    name: t.platform, 
                    value: `\`\`\`yaml\nOS: ${process.platform}\nArch: ${process.arch}\nNode: ${process.version}\`\`\``, 
                    inline: true 
                },
                { 
                    name: t.apiStatus, 
                    value: `\`\`\`yaml\n${t.groq}: ${groqStatus}\n${t.brave}: ${braveStatus}\n${t.database}: ${dbStatus}\`\`\``, 
                    inline: true 
                },
                { 
                    name: `📦 ${t.version}`, 
                    value: `\`\`\`yaml\nBuild: v${version}\nCore: ARCHITECT CG-223\`\`\``, 
                    inline: true 
                }
            );
        
        // ================= WARNINGS =================
        if (groqStatus === '❌') {
            statsEmbed.addFields({
                name: t.missingConfig,
                value: t.missingGroq,
                inline: false
            });
        }
        
        if (braveStatus === '❌') {
            statsEmbed.addFields({
                name: t.missingConfig,
                value: t.missingBrave,
                inline: false
            });
        }
        
        if (pendingWrites > 50) {
            statsEmbed.addFields({
                name: '⚠️ BATCH BACKLOG',
                value: `${pendingWrites} pending writes detected. System may be under load.`,
                inline: false
            });
        }
        
        statsEmbed
            .setFooter({ 
                text: `${guildName} • ${t.footer} • v${version}`, 
                iconURL: guildIcon 
            })
            .setTimestamp();

        await message.reply({ embeds: [statsEmbed] }).catch(() => {});
        
        console.log(`[STATS] ${message.author.tag} | Health: ${systemHealth} | Ping: ${ping}ms | Cache: ${cacheSize} | Lang: ${lang}`);
    }
};