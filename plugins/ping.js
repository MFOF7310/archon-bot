const { performance } = require('perf_hooks');
const { EmbedBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        author: 'ARCHITECT CG-223 | LATENCY REPORT',
        title: '🏓 PONG!',
        responseTime: 'Response time',
        roundTrip: '📡 ROUND TRIP',
        apiHeartbeat: '🌐 API HEARTBEAT',
        signalStatus: '📶 SIGNAL STATUS',
        excellent: '🟢 EXCELLENT',
        good: '🟡 GOOD',
        slow: '🔴 SLOW',
        optimal: '🟢 OPTIMAL',
        messageLatency: '💬 MESSAGE LATENCY',
        databaseLatency: '🗄️ DATABASE LATENCY',
        node: 'Node',
        core: 'Core',
        footer: 'Digital Engine • Real-time latency measurement',
        ping: '🏓 Ping!'
    },
    fr: {
        author: 'ARCHITECT CG-223 | RAPPORT DE LATENCE',
        title: '🏓 PONG!',
        responseTime: 'Temps de réponse',
        roundTrip: '📡 ALLER-RETOUR',
        apiHeartbeat: '🌐 BATTEMENT API',
        signalStatus: '📶 ÉTAT DU SIGNAL',
        excellent: '🟢 EXCELLENT',
        good: '🟡 BON',
        slow: '🔴 LENT',
        optimal: '🟢 OPTIMAL',
        messageLatency: '💬 LATENCE MESSAGE',
        databaseLatency: '🗄️ LATENCE BASE DE DONNÉES',
        node: 'Nœud',
        core: 'Noyau',
        footer: 'Moteur Numérique • Mesure de latence en temps réel',
        ping: '🏓 Ping!'
    }
};

module.exports = {
    name: 'ping',
    aliases: ['pong', 'latency', 'ms', 'lag', 'pongue'],
    description: '📡 Measure the digital engine latency.',
    category: 'SYSTEM',
    cooldown: 3000,
    usage: '.ping',
    examples: ['.ping', '.latence'],

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
        
        // ================= MEASURE MESSAGE LATENCY =================
        const start = performance.now();
        
        // Send first message
        const pingMsg = await message.reply(t.ping).catch(() => {});
        
        const end = performance.now();
        const messageLatency = Math.round(end - start);
        const apiPing = Math.round(client.ws.ping);
        
        // ================= MEASURE DATABASE LATENCY =================
        let dbLatency = null;
        try {
            const dbStart = performance.now();
            db.prepare('SELECT 1').get();
            const dbEnd = performance.now();
            dbLatency = Math.round(dbEnd - dbStart);
        } catch (e) {
            dbLatency = null;
        }
        
        // ================= DETERMINE STATUS =================
        let color, status, apiStatus;
        
        // Message latency status
        if (messageLatency < 100) {
            color = '#2ecc71';
            status = t.excellent;
        } else if (messageLatency < 250) {
            color = '#f1c40f';
            status = t.good;
        } else {
            color = '#e74c3c';
            status = t.slow;
        }
        
        // API latency status
        if (apiPing < 100) {
            apiStatus = t.excellent;
        } else if (apiPing < 250) {
            apiStatus = t.good;
        } else {
            apiStatus = t.slow;
        }
        
        // ================= BUILD EMBED =================
        const embed = new EmbedBuilder()
            .setColor(color)
            .setAuthor({ 
                name: t.author, 
                iconURL: client.user.displayAvatarURL() 
            })
            .setTitle(t.title)
            .setDescription(
                `\`\`\`yaml\n` +
                `${t.responseTime}: ${messageLatency}ms\n` +
                `${t.node}: BAMAKO-223\n` +
                `${t.core}: Groq LPU™ 70B\n` +
                `\`\`\``
            )
            .addFields(
                { 
                    name: t.roundTrip, 
                    value: `\`\`\`\n${messageLatency}ms\n${status}\`\`\``, 
                    inline: true 
                },
                { 
                    name: t.apiHeartbeat, 
                    value: `\`\`\`\n${apiPing}ms\n${apiStatus}\`\`\``, 
                    inline: true 
                },
                { 
                    name: t.messageLatency, 
                    value: `\`\`\`\n${messageLatency}ms\n${status}\`\`\``, 
                    inline: true 
                }
            );
        
        // Add database latency if available
        if (dbLatency !== null) {
            const dbStatus = dbLatency < 50 ? t.excellent : (dbLatency < 100 ? t.good : t.slow);
            embed.addFields({
                name: t.databaseLatency,
                value: `\`\`\`\n${dbLatency}ms\n${dbStatus}\`\`\``,
                inline: true
            });
        }
        
        // Add performance summary
        embed.addFields({
            name: '📊 PERFORMANCE SUMMARY',
            value: `\`\`\`yaml\n` +
                   `Message: ${messageLatency}ms (${status})\n` +
                   `API: ${apiPing}ms (${apiStatus})\n` +
                   `${dbLatency ? `Database: ${dbLatency}ms` : ''}\n` +
                   `Overall: ${t.optimal}\`\`\``,
            inline: false
        });
        
        embed.setFooter({ 
            text: `${guildName} • ${t.footer} • v${version}`, 
            iconURL: guildIcon 
        })
        .setTimestamp();
        
        // ================= EDIT OR SEND NEW =================
        if (pingMsg) {
            await pingMsg.edit({ content: null, embeds: [embed] }).catch(async () => {
                await message.channel.send({ embeds: [embed] }).catch(() => {});
            });
        } else {
            await message.channel.send({ embeds: [embed] }).catch(() => {});
        }
        
        console.log(`[PING] ${message.author.tag} | Msg: ${messageLatency}ms | API: ${apiPing}ms | DB: ${dbLatency}ms | Lang: ${lang}`);
    }
};