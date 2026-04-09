const os = require('os');
const { EmbedBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        author: '🦅 ARCHITECT CG-223 // ADVANCED DASHBOARD',
        title: '⚡ SYSTEM INTELLIGENCE REPORT',
        description: (version) => `\`\`\`diff\n+ SYSTEM STATUS: OPERATIONAL\n+ NODE LOCATION: BAMAKO-223 🇲🇱\n+ ARCHITECT VERSION: v${version}\`\`\``,
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
        reportAdmin: 'Please report this to the system administrator.'
    },
    fr: {
        author: '🦅 ARCHITECT CG-223 // TABLEAU DE BORD AVANCÉ',
        title: '⚡ RAPPORT D\'INTELLIGENCE SYSTÈME',
        description: (version) => `\`\`\`diff\n+ ÉTAT SYSTÈME: OPÉRATIONNEL\n+ EMPLACEMENT NŒUD: BAMAKO-223 🇲🇱\n+ VERSION ARCHITECT: v${version}\`\`\``,
        botTelemetry: '📡 TÉLÉMÉTRIE BOT',
        version: 'Version',
        uptime: 'Disponibilité',
        apiLatency: 'Latence API',
        response: 'Réponse',
        systemResources: '💻 RESSOURCES SYSTÈME',
        platform: 'Plateforme',
        host: 'Hôte',
        cpu: 'CPU',
        cores: 'Cœurs',
        loadAvg: 'Charge Moy',
        ram: 'RAM',
        memory: 'Mémoire',
        discordStats: '🎮 STATISTIQUES DISCORD',
        servers: 'Serveurs',
        users: 'Utilisateurs',
        channels: 'Salons',
        emojis: 'Émojis',
        commands: 'Commandes',
        databaseAnalytics: '🗄️ ANALYSE BASE DE DONNÉES',
        totalUsers: 'Utilisateurs',
        totalXp: 'XP Total',
        avgLevel: 'Niveau Moy',
        timeLocation: '🌍 HEURE & LOCALISATION',
        date: 'Date',
        time: 'Heure',
        timezone: 'Fuseau Horaire',
        region: 'Région',
        performanceMetrics: '⚙️ MÉTRIQUES PERFORMANCE',
        cpuLoad: 'Charge CPU',
        ramUsage: 'Utilisation RAM',
        status: 'État',
        stable: 'Stable',
        commandLibrary: '📚 BIBLIOTHÈQUE DE COMMANDES',
        continued: '📚 BIBLIOTHÈQUE DE COMMANDES (Suite)',
        systemStatus: '🎯 ÉTAT SYSTÈME & RANG PUISSANCE',
        botStatus: 'État Bot',
        powerLevel: 'Niveau Puissance',
        progress: 'Progression',
        engine: 'Moteur',
        optimized: 'OPTIMISÉ',
        powerRanks: {
            5000: '💎 LÉGENDAIRE',
            2500: '⚡ ÉLITE',
            1000: '🌟 AVANCÉ',
            500: '🛡️ COMPÉTENT',
            100: '🌱 ÉMERGENT',
            0: '🔰 NOVICE'
        },
        tips: [
            "🎮 Astuce: Utilisez `.rank` pour voir votre rang!",
            "⚡ Saviez-vous? Mentionnez @Lydia pour l'assistance IA!",
            "🏆 Tapez `.leaderboard` pour voir les meilleurs joueurs!",
            "🎯 `.daily` donne des bonus XP chaque jour!",
            "💎 Niveau 100 débloque le rôle Gaming God!",
            "🤖 Lydia peut rechercher sur le web - posez des questions!",
            "📊 Vos stats de jeu sont suivies automatiquement!",
            "🎲 Essayez `.coinflip` ou `.dice` pour des jeux amusants!"
        ],
        errorTitle: '⚠️ ÉCHEC DU TABLEAU DE BORD',
        errorDesc: 'Le tableau de bord a rencontré une erreur lors du chargement.',
        errorDetails: 'Détails de l\'Erreur',
        actionRequired: 'Action Requise',
        reportAdmin: 'Veuillez signaler ceci à l\'administrateur système.'
    }
};

// ================= HELPER FUNCTIONS =================
function createProgressBar(percentage, length = 20) {
    const filled = Math.floor((percentage / 100) * length);
    return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, length - filled));
}

function getPowerRank(powerLevel, t) {
    const thresholds = [5000, 2500, 1000, 500, 100, 0];
    for (const threshold of thresholds) {
        if (powerLevel >= threshold) return t.powerRanks[threshold];
    }
    return t.powerRanks[0];
}

module.exports = {
    name: 'dashboard',
    aliases: ['db', 'dash', 'sysinfo', 'engine', 'system', 'statusboard', 'tableau'],
    description: '🎮 Advanced system dashboard with real-time metrics and command categories.',
    category: 'SYSTEM',
    cooldown: 5000,
    usage: '.dashboard',
    examples: ['.dashboard', '.dash', '.tableau'],

    // 🔥 NEW SIGNATURE: 6 parameters with usedCommand
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        
        // 🔥 NEURAL LANGUAGE BRIDGE - Alias-based detection!
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, 'en')
            : 'en';
        
        const t = translations[lang];
        const version = client.version || '1.6.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        
        try {
            const startTime = Date.now();
            
            // ================= SYSTEM METRICS =================
            const uptimeVal = process.uptime();
            const days = Math.floor(uptimeVal / 86400);
            const hours = Math.floor((uptimeVal % 86400) / 3600);
            const minutes = Math.floor((uptimeVal % 3600) / 60);
            const seconds = Math.floor(uptimeVal % 60);
            const uptimeStr = `${days}j ${hours}h ${minutes}m ${seconds}s`;
            
            const usedRAM = Math.round(process.memoryUsage().rss / 1024 / 1024);
            const totalRAM = Math.round(os.totalmem() / 1024 / 1024);
            const ramPercentage = ((usedRAM / totalRAM) * 100).toFixed(1);
            
            const cpuCores = os.cpus().length;
            const cpuModel = os.cpus()[0].model.split('@')[0].trim();
            const cpuSpeed = (os.cpus()[0].speed / 1000).toFixed(1);
            const loadAvg = os.loadavg().map(avg => avg.toFixed(2)).join(', ');
            
            const platform = `${os.type()} ${os.arch()}`;
            const hostname = os.hostname();
            
            const now = new Date();
            const time = now.toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-GB', { 
                timeZone: 'Africa/Bamako', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
            const date = now.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { 
                timeZone: 'Africa/Bamako', day: '2-digit', month: '2-digit', year: 'numeric'
            });
            
            // ================= DATABASE STATS =================
            const dbUserCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
            const totalXP = db.prepare("SELECT SUM(xp) as total FROM users").get().total || 0;
            const avgLevel = db.prepare("SELECT AVG(level) as avg FROM users").get().avg || 0;
            
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
            const ramBar = createProgressBar(ramPercentage);
            
            // ================= POWER LEVEL =================
            const commandPower = totalCommands * 20;
            const serverPower = serverCount * 150;
            const userPower = Math.min(Math.floor(dbUserCount * 2), 1000);
            const xpPower = Math.min(Math.floor(totalXP / 10000), 500);
            const uptimePower = Math.min(Math.floor(uptimeVal / 86400 * 15), 300);
            let powerLevel = Math.min(commandPower + serverPower + userPower + xpPower + uptimePower, 9999);
            
            const powerRank = getPowerRank(powerLevel, t);
            const nextLevelThreshold = powerLevel < 1000 ? 1000 : powerLevel < 2500 ? 2500 : powerLevel < 5000 ? 5000 : 9999;
            const progressToNext = Math.floor((powerLevel / nextLevelThreshold) * 100);
            const powerBar = createProgressBar(progressToNext);
            
            // ================= BUILD EMBED =================
            const dashboardEmbed = new EmbedBuilder()
                .setColor('#00d9ff')
                .setAuthor({ name: t.author, iconURL: client.user.displayAvatarURL() })
                .setTitle(t.title)
                .setThumbnail(guildIcon)
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
                    },
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
            categoryFields.forEach(field => dashboardEmbed.addFields(field));
            
            // ================= SYSTEM STATUS =================
            const randomTip = t.tips[Math.floor(Math.random() * t.tips.length)];
            const statusEmojis = { online: '🟢', idle: '🟡', dnd: '🔴', offline: '⚫' };
            const botStatus = statusEmojis[client.presence?.status] || '🟢';
            
            dashboardEmbed.addFields({
                name: t.systemStatus,
                value: `\`\`\`yaml\n${randomTip}\n\n${t.botStatus}: ${botStatus} ${client.presence?.status?.toUpperCase() || 'ONLINE'}\n${t.powerLevel}: ${powerLevel}/9999 [${powerRank}]\n${t.progress}: ${powerBar} ${progressToNext}%\n${t.engine}: ${t.optimized}\`\`\``,
                inline: false
            });
            
            dashboardEmbed.setFooter({ 
                text: `${guildName} • ARCHITECT CG-223 • v${version} • ${message.author.tag}`,
                iconURL: message.author.displayAvatarURL()
            }).setTimestamp();
            
            const performanceScore = (100 - parseFloat(ramPercentage)) + (100 - (apiLatency / 10));
            if (performanceScore > 150) dashboardEmbed.setColor('#2ecc71');
            else if (performanceScore > 100) dashboardEmbed.setColor('#f39c12');
            else dashboardEmbed.setColor('#e74c3c');
            
            await message.reply({ embeds: [dashboardEmbed] }).catch(() => {});
            
            console.log(`[DASHBOARD] ${message.author.tag} | v${version} | Users: ${dbUserCount} | Cmds: ${totalCommands} | Lang: ${lang}`);
            
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
                .setFooter({ text: `ARCHITECT CG-223 • v${version}` })
                .setTimestamp();
            
            await message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }
    }
};