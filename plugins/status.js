const { EmbedBuilder } = require('discord.js');
const os = require('os');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        author: 'ARCHITECT CG-223 | NEURAL OVERLINK',
        title: '─ ARCHITECT SYSTEM DIAGNOSTICS ─',
        node: 'Node',
        integrity: 'Integrity',
        webIntelligence: 'Web Intelligence',
        connectivityGrid: '📡 CONNECTIVITY GRID',
        latency: 'Latency',
        braveSearch: 'Brave Search',
        webSocket: 'WebSocket',
        active: 'ACTIVE',
        online: 'ONLINE',
        neuralCore: '🧠 NEURAL CORE (Groq LPU™)',
        inference: 'Inference',
        load: 'Load',
        agents: 'Agents',
        cache: 'Cache',
        pending: 'Pending',
        temporalUptime: '⏱️ TEMPORAL UPTIME',
        systemResources: '💻 SYSTEM RESOURCES',
        cpu: 'CPU',
        platform: 'Platform',
        nodeVersion: 'Node.js',
        discordVersion: 'Discord.js',
        stable: 'STABLE',
        latencyWarning: 'LATENCY_WARNING',
        synchronized: 'SYNCHRONIZED',
        telemetry: '> **🔍 Telemetry handshake initiated...**',
        footer: 'EAGLE COMMUNITY • DIGITAL SOVEREIGNTY',
        hours: 'Hours',
        minutes: 'Minutes',
        seconds: 'Seconds',
        days: 'Days',
        cores: 'Cores',
        memory: 'Memory',
        used: 'Used',
        total: 'Total'
    },
    fr: {
        author: 'ARCHITECT CG-223 | LIAISON NEURALE',
        title: '─ DIAGNOSTICS SYSTÈME ARCHITECT ─',
        node: 'Nœud',
        integrity: 'Intégrité',
        webIntelligence: 'Intelligence Web',
        connectivityGrid: '📡 GRILLE DE CONNECTIVITÉ',
        latency: 'Latence',
        braveSearch: 'Brave Search',
        webSocket: 'WebSocket',
        active: 'ACTIF',
        online: 'EN LIGNE',
        neuralCore: '🧠 CŒUR NEURAL (Groq LPU™)',
        inference: 'Inférence',
        load: 'Charge',
        agents: 'Agents',
        cache: 'Cache',
        pending: 'En attente',
        temporalUptime: '⏱️ DISPONIBILITÉ TEMPORELLE',
        systemResources: '💻 RESSOURCES SYSTÈME',
        cpu: 'CPU',
        platform: 'Plateforme',
        nodeVersion: 'Node.js',
        discordVersion: 'Discord.js',
        stable: 'STABLE',
        latencyWarning: 'ALERTE_LATENCE',
        synchronized: 'SYNCHRONISÉ',
        telemetry: '> **🔍 Initialisation de la poignée de main télémétrique...**',
        footer: 'EAGLE COMMUNITY • SOUVERAINETÉ NUMÉRIQUE',
        hours: 'Heures',
        minutes: 'Minutes',
        seconds: 'Secondes',
        days: 'Jours',
        cores: 'Cœurs',
        memory: 'Mémoire',
        used: 'Utilisé',
        total: 'Total'
    }
};

module.exports = {
    name: 'status',
    aliases: ['health', 'diagnostics', 'ping', 'etat', 'diagnostic', 'sante'],
    description: '📊 Deep-scan Engine health and neural telemetry.',
    category: 'SYSTEM',
    cooldown: 5000,
    usage: '.status',
    examples: ['.status', '.etat', '.diagnostic'],

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
        
        // ================= TELEMETRY CALCULATIONS =================
        const uptimeVal = process.uptime();
        const days = Math.floor(uptimeVal / 86400);
        const hours = Math.floor((uptimeVal % 86400) / 3600);
        const minutes = Math.floor((uptimeVal % 3600) / 60);
        const seconds = Math.floor(uptimeVal % 60);
        
        // Memory metrics
        const usedMemory = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
        const heapUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const heapTotal = (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2);
        const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
        const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(1);
        
        // System metrics
        const cpuModel = os.cpus()[0]?.model.split('@')[0].trim() || 'Unknown';
        const cpuCores = os.cpus().length;
        const platform = `${os.platform()} (${os.arch()})`;
        
        // Bot metrics
        const ping = client.ws.ping;
        const totalUsers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
        const totalGuilds = client.guilds.cache.size;
        const cacheSize = client.userDataCache?.size || 0;
        const pendingWrites = client.pendingUserUpdates?.size || 0;
        
        // API Status
        const groqStatus = process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY ? '✅' : '❌';
        const braveStatus = process.env.BRAVE_API_KEY ? '✅' : '❌';
        
        // ================= INTELLIGENT THEMING =================
        const statusColor = ping < 150 ? '#2ecc71' : ping < 300 ? '#f1c40f' : '#e74c3c';
        const neuralStatus = ping < 200 ? t.stable : t.latencyWarning;
        const searchStatus = braveStatus === '✅' ? t.online : '❌ OFFLINE';
        
        // Build uptime string
        let uptimeStr = '';
        if (days > 0) uptimeStr += `${days} ${t.days} `;
        if (hours > 0) uptimeStr += `${hours} ${t.hours} `;
        if (minutes > 0) uptimeStr += `${minutes} ${t.minutes} `;
        uptimeStr += `${seconds} ${t.seconds}`;

        // ================= BUILD EMBED =================
        const statusEmbed = new EmbedBuilder()
            .setColor(statusColor)
            .setAuthor({ 
                name: t.author, 
                iconURL: client.user.displayAvatarURL({ dynamic: true }) 
            })
            .setTitle(t.title)
            .setDescription(
                `\`\`\`yaml\n` +
                `${t.node}: BAMAKO-223\n` +
                `${t.integrity}: ${t.synchronized}\n` +
                `${t.webIntelligence}: Brave Search v1.0\n` +
                `\`\`\``
            )
            .addFields(
                { 
                    name: t.connectivityGrid, 
                    value: `\`\`\`yaml\n` +
                           `${t.latency}: ${ping}ms ${ping < 150 ? '🟢' : ping < 300 ? '🟡' : '🔴'}\n` +
                           `${t.braveSearch}: ${searchStatus}\n` +
                           `${t.webSocket}: ${t.active}\n` +
                           `API Groq: ${groqStatus}\`\`\``, 
                    inline: true 
                },
                { 
                    name: t.neuralCore, 
                    value: `\`\`\`yaml\n` +
                           `${t.inference}: ${neuralStatus}\n` +
                           `${t.agents}: ${totalUsers.toLocaleString()}\n` +
                           `${t.cache}: ${cacheSize} | ${t.pending}: ${pendingWrites}\n` +
                           `Servers: ${totalGuilds}\`\`\``, 
                    inline: true 
                },
                { 
                    name: t.temporalUptime, 
                    value: `\`\`\`yaml\n${uptimeStr}\`\`\``, 
                    inline: false 
                },
                { 
                    name: t.systemResources, 
                    value: `\`\`\`yaml\n` +
                           `${t.cpu}: ${cpuModel}\n` +
                           `${t.cores}: ${cpuCores}\n` +
                           `${t.memory}: ${usedMemory}MB / ${totalMem}GB\n` +
                           `Heap: ${heapUsed}/${heapTotal} MB\n` +
                           `${t.platform}: ${platform}\n` +
                           `${t.nodeVersion}: ${process.version}\n` +
                           `${t.discordVersion}: v${require('discord.js').version}\`\`\``, 
                    inline: false 
                }
            )
            .setFooter({ 
                text: `${guildName} • ${t.footer} • v${version}`, 
                iconURL: guildIcon 
            })
            .setTimestamp();

        await message.reply({ 
            content: t.telemetry,
            embeds: [statusEmbed] 
        }).catch(() => {});
        
        console.log(`[STATUS] ${message.author.tag} | Ping: ${ping}ms | Cache: ${cacheSize} | Lang: ${lang}`);
    }
};