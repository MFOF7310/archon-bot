const { performance } = require('perf_hooks');
const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        author: '⚡ ARCHITECT CG-223 | NEURAL LATENCY',
        title: '🏓 SYSTEM PULSE',
        responseTime: 'Response Time',
        roundTrip: '📡 ROUND TRIP',
        apiHeartbeat: '🌐 API HEARTBEAT',
        signalStatus: '📶 SIGNAL QUALITY',
        excellent: '🟢 EXCELLENT',
        good: '🟡 GOOD',
        slow: '🔴 SLOW',
        optimal: '✅ OPTIMAL',
        degraded: '⚠️ DEGRADED',
        messageLatency: '💬 MESSAGE LATENCY',
        databaseLatency: '🗄️ DATABASE LATENCY',
        node: 'Node',
        core: 'Core',
        footer: 'Neural Engine • Real-time Telemetry',
        ping: '🏓 Pinging neural network...',
        refresh: '🔄 Refresh',
        export: '📊 Export Stats',
        help: '❓ Help',
        systemHealth: 'SYSTEM HEALTH',
        statusOnline: '🟢 ONLINE',
        statusWarning: '🟡 WARNING',
        statusCritical: '🔴 CRITICAL',
        lastUpdated: 'Last updated',
        websocket: 'WebSocket',
        restApi: 'REST API',
        overallHealth: 'OVERALL HEALTH SCORE',
        scoreExcellent: 'Excellent - All systems nominal',
        scoreGood: 'Good - Minor latency detected',
        scorePoor: 'Poor - High latency detected',
        recommendation: 'Recommendation',
        recExcellent: 'System operating at peak performance',
        recGood: 'Consider moving bot closer to Discord API region',
        recPoor: '⚠️ Check hosting provider or upgrade server'
    },
    fr: {
        author: '⚡ ARCHITECT CG-223 | LATENCE NEURALE',
        title: '🏓 POULS SYSTÈME',
        responseTime: 'Temps de réponse',
        roundTrip: '📡 ALLER-RETOUR',
        apiHeartbeat: '🌐 BATTEMENT API',
        signalStatus: '📶 QUALITÉ SIGNAL',
        excellent: '🟢 EXCELLENT',
        good: '🟡 BON',
        slow: '🔴 LENT',
        optimal: '✅ OPTIMAL',
        degraded: '⚠️ DÉGRADÉ',
        messageLatency: '💬 LATENCE MESSAGE',
        databaseLatency: '🗄️ LATENCE BD',
        node: 'Nœud',
        core: 'Noyau',
        footer: 'Moteur Neural • Télémétrie Temps Réel',
        ping: '🏓 Ping du réseau neural...',
        refresh: '🔄 Actualiser',
        export: '📊 Exporter Stats',
        help: '❓ Aide',
        systemHealth: 'SANTÉ SYSTÈME',
        statusOnline: '🟢 EN LIGNE',
        statusWarning: '🟡 ATTENTION',
        statusCritical: '🔴 CRITIQUE',
        lastUpdated: 'Dernière mise à jour',
        websocket: 'WebSocket',
        restApi: 'API REST',
        overallHealth: 'SCORE DE SANTÉ GLOBAL',
        scoreExcellent: 'Excellent - Tous les systèmes sont nominaux',
        scoreGood: 'Bon - Latence mineure détectée',
        scorePoor: 'Mauvais - Haute latence détectée',
        recommendation: 'Recommandation',
        recExcellent: 'Système fonctionne à performance maximale',
        recGood: 'Envisagez de rapprocher le bot de la région API Discord',
        recPoor: '⚠️ Vérifiez votre hébergeur ou upgradez le serveur'
    }
};

// ================= DYNAMIC PROGRESS BAR =================
function createProgressBar(value, max = 300, length = 12) {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    const filled = Math.floor((percentage / 100) * length);
    const empty = length - filled;
    
    let bar = '';
    for (let i = 0; i < filled; i++) bar += '█';
    for (let i = 0; i < empty; i++) bar += '░';
    
    let colorCode = '';
    if (percentage < 33) colorCode = '🟢';
    else if (percentage < 66) colorCode = '🟡';
    else colorCode = '🔴';
    
    return { bar, percentage: Math.round(percentage), colorCode };
}

// ================= GET HEALTH SCORE =================
function getHealthScore(messageLatency, apiPing, dbLatency) {
    let score = 100;
    
    if (messageLatency > 100) score -= Math.min(30, (messageLatency - 100) / 5);
    if (apiPing > 100) score -= Math.min(30, (apiPing - 100) / 5);
    if (dbLatency && dbLatency > 50) score -= Math.min(40, (dbLatency - 50) / 2);
    
    return Math.max(0, Math.min(100, Math.round(score)));
}

module.exports = {
    name: 'ping',
    aliases: ['pong', 'latency', 'ms', 'lag', 'pongue', 'status', 'health'],
    description: '📡 Measure the digital engine latency with real-time neural telemetry.',
    category: 'SYSTEM',
    cooldown: 3000,
    usage: '.ping',
    examples: ['.ping', '.latence'],

    // ================= SLASH COMMAND DATA =================
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('📡 Check bot latency and system health')
        .addBooleanOption(option =>
            option.setName('detailed')
                .setDescription('Show detailed performance metrics')
                .setRequired(false)
        ),

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
        const t = translations[lang];
        const version = client.version || '1.8.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        
        const showDetailed = args[0] === 'detailed' || args[0] === 'detail' || args[0] === 'full';
        
        // ================= MEASURE LATENCIES =================
        const start = performance.now();
        const pingMsg = await message.reply(t.ping).catch(() => null);
        const end = performance.now();
        const messageLatency = Math.round(end - start);
        const apiPing = Math.round(client.ws.ping);
        
        let dbLatency = null;
        try {
            const dbStart = performance.now();
            db.prepare('SELECT 1').get();
            const dbEnd = performance.now();
            dbLatency = Math.round(dbEnd - dbStart);
        } catch (e) { dbLatency = null; }
        
        // ================= CALCULATE METRICS =================
        const messageBar = createProgressBar(messageLatency);
        const apiBar = createProgressBar(apiPing);
        const dbBar = dbLatency ? createProgressBar(dbLatency, 100) : null;
        
        const healthScore = getHealthScore(messageLatency, apiPing, dbLatency);
        let healthColor, healthStatus, healthRecommendation;
        
        if (healthScore >= 80) {
            healthColor = '#2ecc71';
            healthStatus = t.scoreExcellent;
            healthRecommendation = t.recExcellent;
        } else if (healthScore >= 50) {
            healthColor = '#f1c40f';
            healthStatus = t.scoreGood;
            healthRecommendation = t.recGood;
        } else {
            healthColor = '#e74c3c';
            healthStatus = t.scorePoor;
            healthRecommendation = t.recPoor;
        }
        
        // ================= BUILD MAIN EMBED =================
        const embed = new EmbedBuilder()
            .setColor(healthColor)
            .setAuthor({ 
                name: t.author, 
                iconURL: client.user.displayAvatarURL(),
                url: 'https://github.com/MFOF7310'
            })
            .setTitle(`${messageBar.colorCode} ${t.title} ${messageBar.colorCode}`)
            .setDescription(
                `\`\`\`yaml\n` +
                `┌─────────────────────────────────┐\n` +
                `│ ${t.node}: BAMAKO-223 (Mali Node)    │\n` +
                `│ ${t.core}: Groq LPU™ 70B + OpenRouter│\n` +
                `│ ${t.websocket}: ${apiPing}ms (${apiBar.percentage}%)                │\n` +
                `│ ${t.restApi}: ${messageLatency}ms (${messageBar.percentage}%)              │\n` +
                `${dbLatency ? `│ Database: ${dbLatency}ms (${dbBar.percentage}%)                  │\n` : ''}` +
                `└─────────────────────────────────┘\n` +
                `\`\`\``
            )
            .addFields(
                {
                    name: `📡 ${t.roundTrip}`,
                    value: `\`\`\`\n${messageBar.bar} ${messageLatency}ms\n${messageBar.percentage}% • ${messageLatency < 100 ? t.excellent : (messageLatency < 250 ? t.good : t.slow)}\`\`\``,
                    inline: true
                },
                {
                    name: `🌐 ${t.apiHeartbeat}`,
                    value: `\`\`\`\n${apiBar.bar} ${apiPing}ms\n${apiBar.percentage}% • ${apiPing < 100 ? t.excellent : (apiPing < 250 ? t.good : t.slow)}\`\`\``,
                    inline: true
                }
            );
        
        if (dbLatency && showDetailed) {
            embed.addFields({
                name: `🗄️ ${t.databaseLatency}`,
                value: `\`\`\`\n${dbBar.bar} ${dbLatency}ms\n${dbBar.percentage}% • ${dbLatency < 50 ? t.excellent : (dbLatency < 100 ? t.good : t.slow)}\`\`\``,
                inline: true
            });
        }
        
        // ================= HEALTH SCORE SECTION =================
        const healthEmoji = healthScore >= 80 ? '🟢' : (healthScore >= 50 ? '🟡' : '🔴');
        embed.addFields({
            name: `${healthEmoji} ${t.overallHealth}`,
            value: `\`\`\`yaml\n` +
                   `Score: ${healthScore}/100 (${healthStatus})\n` +
                   `Status: ${healthScore >= 80 ? t.statusOnline : (healthScore >= 50 ? t.statusWarning : t.statusCritical)}\n` +
                   `└─ ${healthRecommendation}\`\`\``,
            inline: false
        });
        
        // ================= SYSTEM METRICS (Detailed Mode) =================
        if (showDetailed) {
            const uptime = process.uptime();
            const uptimeDays = Math.floor(uptime / 86400);
            const uptimeHours = Math.floor((uptime % 86400) / 3600);
            const uptimeMinutes = Math.floor((uptime % 3600) / 60);
            const memoryUsage = process.memoryUsage();
            const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
            
            embed.addFields({
                name: '📊 SYSTEM METRICS',
                value: `\`\`\`yaml\n` +
                       `Uptime: ${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m\n` +
                       `Memory: ${memoryMB} MB (heapUsed)\n` +
                       `Commands: ${client.commands?.size || 0} loaded\n` +
                       `Servers: ${client.guilds?.cache?.size || 0}\`\`\``,
                inline: false
            });
        }
        
        embed.setFooter({ 
            text: `${guildName} • ${t.footer} • v${version}`, 
            iconURL: guildIcon 
        })
        .setTimestamp();
        
        // ================= BUILD BUTTONS =================
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ping_refresh')
                .setLabel(t.refresh)
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🔄'),
            new ButtonBuilder()
                .setCustomId('ping_detailed')
                .setLabel(showDetailed ? '📊 Simple View' : '📈 Detailed View')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(showDetailed ? '📊' : '📈'),
            new ButtonBuilder()
                .setCustomId('ping_help')
                .setLabel(t.help)
                .setStyle(ButtonStyle.Success)
                .setEmoji('❓')
        );
        
        // ================= SEND/RESPOND =================
        if (pingMsg) {
            await pingMsg.edit({ content: null, embeds: [embed], components: [row] }).catch(async () => {
                const fallbackMsg = await message.channel.send({ embeds: [embed], components: [row] }).catch(() => {});
                if (!fallbackMsg) return;
                await handleCollector(fallbackMsg, client, message, db, t, lang, guildName, guildIcon, version, showDetailed);
            });
            await handleCollector(pingMsg, client, message, db, t, lang, guildName, guildIcon, version, showDetailed);
        } else {
            const newMsg = await message.channel.send({ embeds: [embed], components: [row] }).catch(() => {});
            if (newMsg) await handleCollector(newMsg, client, message, db, t, lang, guildName, guildIcon, version, showDetailed);
        }
        
        console.log(`[PING] ${message.author.tag} | Msg: ${messageLatency}ms | API: ${apiPing}ms | DB: ${dbLatency}ms | Health: ${healthScore} | Lang: ${lang}`);
    },

    // ================= SLASH COMMAND EXECUTION =================
    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = translations[lang];
        const version = client.version || '1.8.0';
        const guildName = interaction.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = interaction.guild?.iconURL() || client.user.displayAvatarURL();
        const db = client.db;
        
        const showDetailed = interaction.options.getBoolean('detailed') || false;
        
        await interaction.deferReply();
        
        // Measure latencies
        const start = performance.now();
        const messageLatency = Math.round((performance.now() - start));
        const apiPing = Math.round(client.ws.ping);
        
        let dbLatency = null;
        try {
            const dbStart = performance.now();
            db.prepare('SELECT 1').get();
            const dbEnd = performance.now();
            dbLatency = Math.round(dbEnd - dbStart);
        } catch (e) { dbLatency = null; }
        
        const messageBar = createProgressBar(messageLatency);
        const apiBar = createProgressBar(apiPing);
        const healthScore = getHealthScore(messageLatency, apiPing, dbLatency);
        let healthColor = healthScore >= 80 ? '#2ecc71' : (healthScore >= 50 ? '#f1c40f' : '#e74c3c');
        
        const embed = new EmbedBuilder()
            .setColor(healthColor)
            .setAuthor({ name: t.author, iconURL: client.user.displayAvatarURL() })
            .setTitle(`${messageBar.colorCode} ${t.title} ${messageBar.colorCode}`)
            .setDescription(
                `\`\`\`yaml\n` +
                `Node: BAMAKO-223 (Mali Node)\n` +
                `WebSocket: ${apiPing}ms (${apiBar.percentage}%)\n` +
                `REST API: ${messageLatency}ms (${messageBar.percentage}%)\n` +
                `${dbLatency ? `Database: ${dbLatency}ms` : ''}\n` +
                `Health Score: ${healthScore}/100\`\`\``
            )
            .addFields(
                { name: `📡 ${t.roundTrip}`, value: `\`\`\`\n${messageBar.bar} ${messageLatency}ms\`\`\``, inline: true },
                { name: `🌐 ${t.apiHeartbeat}`, value: `\`\`\`\n${apiBar.bar} ${apiPing}ms\`\`\``, inline: true }
            )
            .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
            .setTimestamp();
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ping_refresh').setLabel(t.refresh).setStyle(ButtonStyle.Primary).setEmoji('🔄'),
            new ButtonBuilder().setCustomId('ping_help').setLabel(t.help).setStyle(ButtonStyle.Success).setEmoji('❓')
        );
        
        await interaction.editReply({ embeds: [embed], components: [row] });
        
        const collector = interaction.channel.createMessageComponentCollector({ 
            filter: i => i.user.id === interaction.user.id && i.customId.startsWith('ping_'),
            time: 60000
        });
        
        collector.on('collect', async (i) => {
            if (i.customId === 'ping_refresh') {
                await i.deferUpdate();
                const newStart = performance.now();
                const newMsgLat = Math.round((performance.now() - newStart));
                const newApiPing = Math.round(client.ws.ping);
                const newMessageBar = createProgressBar(newMsgLat);
                const newApiBar = createProgressBar(newApiPing);
                const newHealthScore = getHealthScore(newMsgLat, newApiPing, dbLatency);
                const newHealthColor = newHealthScore >= 80 ? '#2ecc71' : (newHealthScore >= 50 ? '#f1c40f' : '#e74c3c');
                
                const refreshedEmbed = EmbedBuilder.from(embed)
                    .setColor(newHealthColor)
                    .setDescription(
                        `\`\`\`yaml\n` +
                        `Node: BAMAKO-223 (Mali Node)\n` +
                        `WebSocket: ${newApiPing}ms (${newApiBar.percentage}%)\n` +
                        `REST API: ${newMsgLat}ms (${newMessageBar.percentage}%)\n` +
                        `${dbLatency ? `Database: ${dbLatency}ms` : ''}\n` +
                        `Health Score: ${newHealthScore}/100\`\`\``
                    )
                    .setFields(
                        { name: `📡 ${t.roundTrip}`, value: `\`\`\`\n${newMessageBar.bar} ${newMsgLat}ms\`\`\``, inline: true },
                        { name: `🌐 ${t.apiHeartbeat}`, value: `\`\`\`\n${newApiBar.bar} ${newApiPing}ms\`\`\``, inline: true }
                    )
                    .setTimestamp();
                
                await i.editReply({ embeds: [refreshedEmbed] });
            } else if (i.customId === 'ping_help') {
                const helpEmbed = new EmbedBuilder()
                    .setColor('#3498db')
                    .setTitle('📡 PING COMMAND HELP')
                    .setDescription(
                        `\`\`\`yaml\n` +
                        `The ping command measures your connection to the bot:\n\n` +
                        `• Message Latency: Time from command to response\n` +
                        `• API Latency: Discord WebSocket heartbeat\n` +
                        `• Database Latency: SQLite query time\n` +
                        `• Health Score: Overall system performance\n\n` +
                        `Green (<100ms)  → Excellent\n` +
                        `Yellow (100-250ms) → Good\n` +
                        `Red (>250ms)    → Slow\`\`\``
                    )
                    .setFooter({ text: t.footer })
                    .setTimestamp();
                await i.reply({ embeds: [helpEmbed], ephemeral: true });
            }
        });
    }
};

// ================= COLLECTOR HANDLER =================
async function handleCollector(msg, client, originalMsg, db, t, lang, guildName, guildIcon, version, showDetailed) {
    const collector = msg.createMessageComponentCollector({ time: 60000 });
    
    collector.on('collect', async (i) => {
        if (i.user.id !== originalMsg.author.id) {
            return i.reply({ content: t.accessDenied || '❌ This menu is not for you.', ephemeral: true }).catch(() => {});
        }
        
        await i.deferUpdate().catch(() => {});
        
        if (i.customId === 'ping_refresh') {
            const start = performance.now();
            const newMsgLat = Math.round((performance.now() - start));
            const newApiPing = Math.round(client.ws.ping);
            
            let newDbLatency = null;
            try {
                const dbStart = performance.now();
                db.prepare('SELECT 1').get();
                const dbEnd = performance.now();
                newDbLatency = Math.round(dbEnd - dbStart);
            } catch (e) {}
            
            const newMessageBar = createProgressBar(newMsgLat);
            const newApiBar = createProgressBar(newApiPing);
            const newHealthScore = getHealthScore(newMsgLat, newApiPing, newDbLatency);
            const newHealthColor = newHealthScore >= 80 ? '#2ecc71' : (newHealthScore >= 50 ? '#f1c40f' : '#e74c3c');
            
            const refreshedEmbed = new EmbedBuilder()
                .setColor(newHealthColor)
                .setAuthor({ name: t.author, iconURL: client.user.displayAvatarURL() })
                .setTitle(`${newMessageBar.colorCode} ${t.title} ${newMessageBar.colorCode}`)
                .setDescription(
                    `\`\`\`yaml\n` +
                    `┌─────────────────────────────────┐\n` +
                    `│ Node: BAMAKO-223 (Mali Node)       │\n` +
                    `│ Core: Groq LPU™ 70B + OpenRouter   │\n` +
                    `│ WebSocket: ${newApiPing}ms (${newApiBar.percentage}%)                │\n` +
                    `│ REST API: ${newMsgLat}ms (${newMessageBar.percentage}%)              │\n` +
                    `${newDbLatency ? `│ Database: ${newDbLatency}ms                  │\n` : ''}` +
                    `└─────────────────────────────────┘\n` +
                    `\`\`\``
                )
                .addFields(
                    { name: `📡 ${t.roundTrip}`, value: `\`\`\`\n${newMessageBar.bar} ${newMsgLat}ms\n${newMessageBar.percentage}% • ${newMsgLat < 100 ? t.excellent : (newMsgLat < 250 ? t.good : t.slow)}\`\`\``, inline: true },
                    { name: `🌐 ${t.apiHeartbeat}`, value: `\`\`\`\n${newApiBar.bar} ${newApiPing}ms\n${newApiBar.percentage}% • ${newApiPing < 100 ? t.excellent : (newApiPing < 250 ? t.good : t.slow)}\`\`\``, inline: true }
                );
            
            if (newDbLatency && showDetailed) {
                const newDbBar = createProgressBar(newDbLatency, 100);
                refreshedEmbed.addFields({
                    name: `🗄️ ${t.databaseLatency}`,
                    value: `\`\`\`\n${newDbBar.bar} ${newDbLatency}ms\n${newDbBar.percentage}% • ${newDbLatency < 50 ? t.excellent : (newDbLatency < 100 ? t.good : t.slow)}\`\`\``,
                    inline: true
                });
            }
            
            const healthEmoji = newHealthScore >= 80 ? '🟢' : (newHealthScore >= 50 ? '🟡' : '🔴');
            refreshedEmbed.addFields({
                name: `${healthEmoji} ${t.overallHealth}`,
                value: `\`\`\`yaml\nScore: ${newHealthScore}/100\nStatus: ${newHealthScore >= 80 ? t.statusOnline : (newHealthScore >= 50 ? t.statusWarning : t.statusCritical)}\`\`\``,
                inline: false
            });
            
            refreshedEmbed.setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon }).setTimestamp();
            
            await i.editReply({ embeds: [refreshedEmbed] });
        } else if (i.customId === 'ping_detailed') {
            const newShowDetailed = !showDetailed;
            const fakeMessage = { author: originalMsg.author, guild: originalMsg.guild, channel: originalMsg.channel };
            const fakeArgs = newShowDetailed ? ['detailed'] : [];
            await module.exports.run(client, fakeMessage, fakeArgs, db, null, 'ping');
            await msg.delete().catch(() => {});
        } else if (i.customId === 'ping_help') {
            const helpEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('📡 PING COMMAND HELP')
                .setDescription(
                    `\`\`\`yaml\n` +
                    `📊 Latency Metrics:\n` +
                    `• Message Latency: Command → Response time\n` +
                    `• API Latency: Discord WebSocket heartbeat\n` +
                    `• Database Latency: SQLite query performance\n\n` +
                    `🎯 Health Score Calculation:\n` +
                    `• <100ms → Excellent (Green)\n` +
                    `• 100-250ms → Good (Yellow)\n` +
                    `• >250ms → Slow (Red)\n\n` +
                    `💡 Tips:\n` +
                    `• Click refresh for real-time update\n` +
                    `• Use /ping detailed for full metrics\n` +
                    `• Health score considers all factors\`\`\``
                )
                .setFooter({ text: t.footer })
                .setTimestamp();
            await i.reply({ embeds: [helpEmbed], ephemeral: true });
        }
    });
}