const { EmbedBuilder, version: discordVersion } = require('discord.js');
const os = require('os');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        author: '🟢 ARCHITECT CG-223 // SYSTEM ONLINE',
        title: '🚀 SYSTEM STATUS REPORT',
        botInfo: '📡 BOT INFORMATION',
        name: 'Name',
        id: 'ID',
        version: 'Version',
        uptime: 'Uptime',
        latency: 'Latency',
        apiPing: 'API Ping',
        systemResources: '💾 SYSTEM RESOURCES',
        platform: 'Platform',
        cpu: 'CPU',
        cores: 'Cores',
        memory: 'Memory',
        systemRam: 'System RAM',
        statistics: '📊 STATISTICS',
        servers: 'Servers',
        users: 'Users',
        channels: 'Channels',
        dbUsers: 'Database Users',
        commands: 'Commands',
        status: '🎮 STATUS',
        botStatus: 'Bot Status',
        discordVersion: 'Discord.js',
        system: 'System',
        operational: 'Operational',
        latencyDetails: '⏱️ LATENCY DETAILS',
        apiResponse: 'API Response',
        webSocket: 'WebSocket',
        message: 'Message',
        node: 'Node',
        online: 'ONLINE',
        healthy: 'HEALTHY',
        degraded: 'DEGRADED',
        critical: 'CRITICAL'
    },
    fr: {
        author: '🟢 ARCHITECT CG-223 // SYSTÈME EN LIGNE',
        title: '🚀 RAPPORT D\'ÉTAT SYSTÈME',
        botInfo: '📡 INFORMATIONS BOT',
        name: 'Nom',
        id: 'ID',
        version: 'Version',
        uptime: 'Disponibilité',
        latency: 'Latence',
        apiPing: 'Ping API',
        systemResources: '💾 RESSOURCES SYSTÈME',
        platform: 'Plateforme',
        cpu: 'CPU',
        cores: 'Cœurs',
        memory: 'Mémoire',
        systemRam: 'RAM Système',
        statistics: '📊 STATISTIQUES',
        servers: 'Serveurs',
        users: 'Utilisateurs',
        channels: 'Salons',
        dbUsers: 'Utilisateurs DB',
        commands: 'Commandes',
        status: '🎮 ÉTAT',
        botStatus: 'État Bot',
        discordVersion: 'Discord.js',
        system: 'Système',
        operational: 'Opérationnel',
        latencyDetails: '⏱️ DÉTAILS LATENCE',
        apiResponse: 'Réponse API',
        webSocket: 'WebSocket',
        message: 'Message',
        node: 'Nœud',
        online: 'EN LIGNE',
        healthy: 'SAIN',
        degraded: 'DÉGRADÉ',
        critical: 'CRITIQUE'
    }
};

module.exports = {
    name: 'alive',
    aliases: ['ping', 'status', 'health', 'uptime', 'version', 'enligne', 'etat', 'sante'],
    description: '📡 Check if the bot is alive and get system statistics',
    category: 'SYSTEM',
    usage: '.alive',
    cooldown: 3000,
    examples: ['.alive', '.ping', '.status', '.enligne'],

    // 🔥 NEW SIGNATURE: 6 parameters with usedCommand
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        
        const startTime = Date.now();
        
        // 🔥 NEURAL LANGUAGE BRIDGE - Alias-based detection!
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, 'en')
            : 'en';
        
        const t = translations[lang];
        const version = client.version || '1.6.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        
        // ================= BOT UPTIME =================
        const uptime = client.uptime;
        const days = Math.floor(uptime / 86400000);
        const hours = Math.floor(uptime / 3600000) % 24;
        const minutes = Math.floor(uptime / 60000) % 60;
        const seconds = Math.floor(uptime / 1000) % 60;
        const uptimeString = `${days}j ${hours}h ${minutes}m ${seconds}s`;
        
        // ================= MEMORY USAGE =================
        const memoryUsage = process.memoryUsage();
        const heapUsed = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
        const heapTotal = (memoryUsage.heapTotal / 1024 / 1024).toFixed(2);
        const rss = (memoryUsage.rss / 1024 / 1024).toFixed(2);
        
        // ================= SYSTEM INFO =================
        const platform = os.platform();
        const arch = os.arch();
        const cpus = os.cpus();
        const cpuModel = cpus[0]?.model.split('@')[0].trim() || 'Unknown';
        const cpuCores = cpus.length;
        const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
        
        // ================= SERVER STATS =================
        const serverCount = client.guilds.cache.size;
        const userCount = client.users.cache.size;
        const channelCount = client.channels.cache.size;
        const dbUserCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
        const totalCommands = client.commands.size;
        
        // ================= CACHE STATS =================
        const cacheSize = client.userDataCache?.size || 0;
        const pendingWrites = client.pendingUserUpdates?.size || 0;
        
        // ================= LATENCY =================
        const apiLatency = Date.now() - startTime;
        const wsPing = Math.round(client.ws.ping);
        
        // ================= SYSTEM HEALTH =================
        let systemHealth = t.healthy;
        let healthColor = '#2ecc71';
        if (wsPing > 250) {
            systemHealth = t.critical;
            healthColor = '#e74c3c';
        } else if (wsPing > 100) {
            systemHealth = t.degraded;
            healthColor = '#f1c40f';
        }
        
        // ================= STATUS EMOJIS =================
        const statusEmojis = { online: '🟢', idle: '🟡', dnd: '🔴', offline: '⚫' };
        const botStatus = statusEmojis[client.presence?.status] || '🟢';
        const botStatusText = client.presence?.status?.toUpperCase() || t.online;
        
        // ================= BUILD EMBED =================
        const aliveEmbed = new EmbedBuilder()
            .setColor(healthColor)
            .setAuthor({ 
                name: t.author, 
                iconURL: client.user.displayAvatarURL()
            })
            .setTitle(t.title)
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 512 }))
            .addFields(
                { 
                    name: t.botInfo, 
                    value: `\`\`\`yaml\n${t.name}: ${client.user.tag}\n${t.id}: ${client.user.id}\n${t.version}: v${version}\n${t.uptime}: ${uptimeString}\n${t.latency}: ${apiLatency}ms\n${t.apiPing}: ${wsPing}ms\`\`\``,
                    inline: false
                },
                { 
                    name: t.systemResources, 
                    value: `\`\`\`yaml\n${t.platform}: ${platform} (${arch})\n${t.cpu}: ${cpuModel}\n${t.cores}: ${cpuCores}\n${t.memory}: ${heapUsed}/${heapTotal} MB (RSS: ${rss} MB)\n${t.systemRam}: ${freeMem}/${totalMem} GB\`\`\``,
                    inline: true
                },
                { 
                    name: t.statistics, 
                    value: `\`\`\`yaml\n${t.servers}: ${serverCount}\n${t.users}: ${userCount}\n${t.channels}: ${channelCount}\n${t.dbUsers}: ${dbUserCount}\n${t.commands}: ${totalCommands}\nCache: ${cacheSize} | Pending: ${pendingWrites}\`\`\``,
                    inline: true
                },
                { 
                    name: t.status, 
                    value: `\`\`\`yaml\n${botStatus} ${t.botStatus}: ${botStatusText}\n${t.discordVersion}: v${discordVersion}\n${t.system}: ${systemHealth}\n${t.node}: ${process.version}\`\`\``,
                    inline: false
                }
            )
            .setFooter({ 
                text: `${guildName} • ARCHITECT CG-223 • v${version}`,
                iconURL: guildIcon
            })
            .setTimestamp();

        // Send initial embed
        const replyMsg = await message.reply({ embeds: [aliveEmbed] }).catch(() => {});
        if (!replyMsg) return;
        
        // Calculate message latency
        const messageLatency = replyMsg.createdTimestamp - message.createdTimestamp;
        
        // Update with latency details
        const updatedEmbed = EmbedBuilder.from(aliveEmbed).addFields({
            name: t.latencyDetails,
            value: `\`\`\`yaml\n${t.apiResponse}: ${apiLatency}ms\n${t.webSocket}: ${wsPing}ms\n${t.message}: ${messageLatency}ms\`\`\``,
            inline: false
        });
        
        await replyMsg.edit({ embeds: [updatedEmbed] }).catch(() => {});
        
        console.log(`[ALIVE] ${message.author.tag} | Servers: ${serverCount} | Ping: ${wsPing}ms | Cache: ${cacheSize} | Lang: ${lang}`);
    }
};