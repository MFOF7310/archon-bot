Const { EmbedBuilder } = require('discord.js');

const statsTranslations = {
    en: {
        title: '📊 NEURAL SYSTEM ANALYTICS',
        desc: 'Real-time telemetry from the Archon BKO-223 Node.',
        uptime: '⏱️ System Uptime',
        latency: '⚡ Latency (Ping)',
        memory: '💾 Memory Usage',
        platform: '🖥️ OS Platform',
        commands: '📜 Active Modules',
        users: '👥 Synchronized Agents',
        servers: '🏠 Sector Servers',
        core: '🧠 Intelligence Core',
        version: '📦 Build Version',
        footer: 'Eagle Community • Digital Sovereignty',
        status: 'Status: 🟢 OPERATIONAL',
        node: 'Node',
        region: 'Region',
        apiStatus: 'API Status',
        groq: 'Groq LPU™',
        brave: 'Brave Search',
        database: 'Database'
    },
    fr: {
        title: '📊 ANALYSE DU SYSTÈME NEURAL',
        desc: 'Télémétrie en temps réel du Nœud Archon BKO-223.',
        uptime: '⏱️ Temps de Fonctionnement',
        latency: '⚡ Latence (Ping)',
        memory: '💾 Utilisation Mémoire',
        platform: '🖥️ Plateforme OS',
        commands: '📜 Modules Actifs',
        users: '👥 Agents Synchronisés',
        servers: '🏠 Serveurs de Secteur',
        core: '🧠 Cœur d\'Intelligence',
        version: '📦 Version du Build',
        footer: 'Communauté Eagle • Souveraineté Numérique',
        status: 'Statut : 🟢 OPÉRATIONNEL',
        node: 'Nœud',
        region: 'Région',
        apiStatus: 'État des API',
        groq: 'Groq LPU™',
        brave: 'Brave Search',
        database: 'Base de données'
    }
};

module.exports = {
    name: 'stats',
    aliases: ['botstats', 'statistiques', 'systemstats', 'sysinfo', 'diagnostics'], // REMOVED 'botinfo'
    description: '📊 Display live neural bot statistics and system telemetry.',
    category: 'SYSTEM',
    usage: '.stats',
    cooldown: 5000,
    examples: ['.stats'],

    run: async (client, message, args) => {
        
        // --- INTELLIGENT LANGUAGE DETECTION ---
        let lang = 'en';
        const guildSettings = client.settings?.get(message.guild?.id);
        if (guildSettings?.language) {
            lang = guildSettings.language;
        } else {
            const frenchKeywords = ['fr', 'francais', 'français', 'french', 'statistiques'];
            const content = message.content.toLowerCase();
            if (frenchKeywords.some(word => content.includes(word)) || message.guild?.preferredLocale === 'fr') {
                lang = 'fr';
            }
        }
        
        const cmdUsed = message.content.split(' ')[0].toLowerCase();
        const isFrenchAlias = ['statistiques'].some(alias => cmdUsed.includes(alias));
        if (isFrenchAlias) lang = 'fr';
        
        const t = statsTranslations[lang];
        const version = client.version || '1.3.2';

        const uptime = process.uptime();
        const d = Math.floor(uptime / (3600 * 24));
        const h = Math.floor((uptime % (3600 * 24)) / 3600);
        const m = Math.floor((uptime % 3600) / 60);
        const s = Math.floor(uptime % 60);
        const uptimeStr = `${d}d ${h}h ${m}m ${s}s`;

        const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const memoryRss = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
        const ping = Math.round(client.ws.ping);
        const totalUsers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
        const totalCommands = client.commands?.size || 0;
        
        const groqStatus = process.env.GROQ_API_KEY ? '✅' : '❌';
        const braveStatus = process.env.BRAVE_API_KEY ? '✅' : '❌';
        
        let dbStatus = '✅';
        try {
            const Database = require('better-sqlite3');
            const testDb = new Database('database.sqlite');
            testDb.prepare("SELECT 1").get();
            testDb.close();
        } catch {
            dbStatus = '❌';
        }

        const platform = `${process.platform} (${process.arch})`;
        const nodeVersion = process.version;

        const statsEmbed = new EmbedBuilder()
            .setColor('#00fbff')
            .setAuthor({ 
                name: t.status, 
                iconURL: client.user.displayAvatarURL({ dynamic: true }) 
            })
            .setTitle(t.title)
            .setDescription(`\`\`\`prolog\n${t.desc}\n${t.node}: BKO-223 • ${t.region}: Bamako, Mali\`\`\``)
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 512 }))
            .addFields(
                { name: t.core, value: `\`Groq LPU™ 70B\`\nNeural Core: LYDIA`, inline: true },
                { name: t.version, value: `\`v${version}\``, inline: true },
                { name: t.latency, value: `\`${ping}ms\``, inline: true },
                { name: t.uptime, value: `\`${uptimeStr}\``, inline: false },
                { name: t.memory, value: `\`Heap: ${memory} MB\`\n\`RSS: ${memoryRss} MB\``, inline: true },
                { name: t.platform, value: `\`${platform}\`\n\`Node: ${nodeVersion}\``, inline: true },
                { name: t.commands, value: `\`${totalCommands}\``, inline: true },
                { name: t.servers, value: `\`${client.guilds.cache.size}\``, inline: true },
                { name: t.users, value: `\`${totalUsers.toLocaleString()}\``, inline: true },
                { 
                    name: t.apiStatus, 
                    value: `\`\`\`yaml\n${t.groq}: ${groqStatus}\n${t.brave}: ${braveStatus}\n${t.database}: ${dbStatus}\`\`\``, 
                    inline: false 
                }
            )
            .setFooter({ 
                text: `${t.footer} • v${version}`, 
                iconURL: message.guild?.iconURL() || client.user.displayAvatarURL() 
            })
            .setTimestamp();

        if (groqStatus === '❌') {
            statsEmbed.addFields({
                name: lang === 'fr' ? '⚠️ CONFIGURATION MANQUANTE' : '⚠️ MISSING CONFIGURATION',
                value: lang === 'fr' 
                    ? 'La clé API Groq est manquante. Les commandes AI seront limitées.'
                    : 'Groq API key is missing. AI commands will be limited.',
                inline: false
            });
        }
        
        if (braveStatus === '❌') {
            statsEmbed.addFields({
                name: lang === 'fr' ? '⚠️ RECHERCHE WEB LIMITÉE' : '⚠️ LIMITED WEB SEARCH',
                value: lang === 'fr'
                    ? 'La clé API Brave Search est manquante. Les recherches web seront désactivées.'
                    : 'Brave Search API key is missing. Web search will be disabled.',
                inline: false
            });
        }

        await message.reply({ embeds: [statsEmbed] });
        
        console.log(`[STATS] ${message.author.tag} viewed system stats | Lang: ${lang} | Version: ${version}`);
    }
};