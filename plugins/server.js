const { EmbedBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        scanning: '> **🔍 Scanning sector frequencies...**',
        author: (name) => `SECTOR DATA_SCAN: ${name.toUpperCase()}`,
        commander: 'Commander',
        established: 'Established',
        sectorId: 'Sector ID',
        populationMetrics: '📊 POPULATION METRICS',
        total: 'Total',
        voice: 'Voice',
        active: 'Active',
        roles: 'Roles',
        networkGrid: '🛰️ NETWORK GRID',
        tier: 'Tier',
        node: 'Node',
        uptime: 'Uptime',
        stable: 'STABLE',
        boostSync: '🚀 NITRO BOOST SYNCHRONIZATION',
        securityProtocols: '🛡️ SECURITY PROTOCOLS',
        verification: 'Verification',
        integrity: 'Integrity',
        synchronized: 'SYNCHRONIZED',
        anniversaryTitle: (years) => `🎊 SECTOR ANNIVERSARY: ${years} YEARS 🎊`,
        anniversaryAlert: (years) => `🎊 **ALERT: ${years} YEAR ANNIVERSARY DETECTED!** 🎊`,
        anniversaryProtocol: '🎂 ANNIVERSARY PROTOCOL',
        anniversaryDesc: 'CELEBRATION_MODE: ACTIVE\nObjective: Maintain Eagle Community sovereignty.',
        maxLevel: 'MAX_LEVEL',
        channels: 'Channels',
        text: 'Text',
        category: 'Categories',
        emojis: 'Emojis',
        stickers: 'Stickers',
        footer: 'EAGLE COMMUNITY • DIGITAL SOVEREIGNTY • BKO-223'
    },
    fr: {
        scanning: '> **🔍 Analyse des fréquences du secteur...**',
        author: (name) => `ANALYSE SECTEUR: ${name.toUpperCase()}`,
        commander: 'Commandant',
        established: 'Établi',
        sectorId: 'ID Secteur',
        populationMetrics: '📊 MÉTRIQUES DE POPULATION',
        total: 'Total',
        voice: 'Voix',
        active: 'Actifs',
        roles: 'Rôles',
        networkGrid: '🛰️ GRILLE RÉSEAU',
        tier: 'Niveau',
        node: 'Nœud',
        uptime: 'Disponibilité',
        stable: 'STABLE',
        boostSync: '🚀 SYNCHRONISATION NITRO BOOST',
        securityProtocols: '🛡️ PROTOCOLES DE SÉCURITÉ',
        verification: 'Vérification',
        integrity: 'Intégrité',
        synchronized: 'SYNCHRONISÉ',
        anniversaryTitle: (years) => `🎊 ANNIVERSAIRE DU SECTEUR: ${years} ANS 🎊`,
        anniversaryAlert: (years) => `🎊 **ALERTE: ${years} ANS D'ANNIVERSAIRE DÉTECTÉS!** 🎊`,
        anniversaryProtocol: '🎂 PROTOCOLE D\'ANNIVERSAIRE',
        anniversaryDesc: 'MODE_CÉLÉBRATION: ACTIF\nObjectif: Maintenir la souveraineté Eagle Community.',
        maxLevel: 'NIVEAU_MAX',
        channels: 'Salons',
        text: 'Texte',
        category: 'Catégories',
        emojis: 'Émojis',
        stickers: 'Autocollants',
        footer: 'EAGLE COMMUNITY • SOUVERAINETÉ NUMÉRIQUE • BKO-223'
    }
};

// ================= HELPER FUNCTIONS =================
function getVerificationLevel(level) {
    const levels = {
        0: 'NONE',
        1: 'LOW',
        2: 'MEDIUM',
        3: 'HIGH',
        4: 'VERY_HIGH'
    };
    return levels[level] || 'UNKNOWN';
}

function createBoostBar(current, target, t) {
    if (target === 'MAX') return `◈ \u001b[1;35m${t.maxLevel}\u001b[0m ◈`;
    const filled = Math.min(Math.round((10 * current) / target), 10);
    return '▰'.repeat(filled) + '▱'.repeat(10 - filled) + ` ${current}/${target}`;
}

module.exports = {
    name: 'server',
    aliases: ['si', 'sector', 'guild', 'serveur', 'info', 'infos'],
    description: '📊 Execute a deep-scan of the current Sector intelligence and age.',
    category: 'SYSTEM',
    cooldown: 5000,
    usage: '.server',
    examples: ['.server', '.serveur', '.sector'],

    // 🔥 NEW SIGNATURE: 6 parameters with usedCommand
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        
        // 🔥 NEURAL LANGUAGE BRIDGE - Alias-based detection!
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, 'en')
            : 'en';
        
        const t = translations[lang];
        const version = client.version || '1.6.0';
        const { guild } = message;
        const icon = guild.iconURL({ dynamic: true, size: 512 }) || client.user.displayAvatarURL();

        // ================= TEMPORAL ANNIVERSARY LOGIC =================
        const now = new Date();
        const created = new Date(guild.createdTimestamp);
        const isAnniversary = now.getMonth() === created.getMonth() && now.getDate() === created.getDate();
        const sectorAge = now.getFullYear() - created.getFullYear();

        // ================= TELEMETRY CALCULATIONS =================
        const boostCount = guild.premiumSubscriptionCount || 0;
        const boostTier = guild.premiumTier;
        const voiceAgents = guild.members.cache.filter(m => m.voice.channel).size;
        const textChannels = guild.channels.cache.filter(c => c.type === 0).size;
        const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;
        const categories = guild.channels.cache.filter(c => c.type === 4).size;
        const emojiCount = guild.emojis.cache.size;
        const stickerCount = guild.stickers.cache.size;
        
        const tierRequirements = { 0: 2, 1: 7, 2: 14, 3: 'MAX' };
        const nextReq = tierRequirements[boostTier];
        const boostBar = createBoostBar(boostCount, nextReq, t);

        // ================= DYNAMIC THEMING =================
        const systemColor = isAnniversary ? '#f1c40f' : '#00fbff';
        const systemTitle = isAnniversary 
            ? t.anniversaryTitle(sectorAge)
            : `─ ARCHITECT GUILD TELEMETRY ─`;

        // ================= MAIN EMBED =================
        const serverEmbed = new EmbedBuilder()
            .setColor(systemColor)
            .setAuthor({ name: t.author(guild.name), iconURL: icon })
            .setTitle(systemTitle)
            .setThumbnail(icon)
            .setDescription(
                `\`\`\`yaml\n` +
                `${t.commander}: ${guild.members.cache.get(guild.ownerId)?.user.username || 'Unknown'}\n` +
                `${t.established}: ${new Date(guild.createdTimestamp).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')}\n` +
                `${t.sectorId}: ${guild.id}\n` +
                `\`\`\``
            )
            .addFields(
                { 
                    name: t.populationMetrics, 
                    value: `\`\`\`yaml\n` +
                           `${t.total}: ${guild.memberCount.toLocaleString()}\n` +
                           `${t.voice}: ${voiceAgents} ${t.active}\n` +
                           `${t.roles}: ${guild.roles.cache.size}\n` +
                           `${t.channels}: ${textChannels + voiceChannels}\`\`\``, 
                    inline: true 
                },
                { 
                    name: t.networkGrid, 
                    value: `\`\`\`yaml\n` +
                           `${t.tier}: LEVEL_${boostTier}\n` +
                           `${t.node}: BAMAKO-223\n` +
                           `${t.uptime}: ${t.stable}\n` +
                           `Core: Groq LPU™ 70B\`\`\``, 
                    inline: true 
                }
            )
            .addFields({
                name: `📁 ${t.channels}`,
                value: `\`\`\`yaml\n${t.text}: ${textChannels}\n${t.voice}: ${voiceChannels}\n${t.category}: ${categories}\`\`\``,
                inline: true
            });

        // ================= ANNIVERSARY FIELD =================
        if (isAnniversary) {
            serverEmbed.addFields({ 
                name: t.anniversaryProtocol, 
                value: `\`\`\`fix\n${t.anniversaryDesc}\`\`\``,
                inline: false
            });
        }

        // ================= BOOST & SECURITY =================
        serverEmbed.addFields(
            { 
                name: t.boostSync, 
                value: `\`\`\`ansi\n\u001b[1;35m${boostBar}\u001b[0m\`\`\``, 
                inline: false 
            },
            { 
                name: t.securityProtocols, 
                value: `\`\`\`yaml\n${t.verification}: ${getVerificationLevel(guild.verificationLevel)}\n${t.integrity}: ${t.synchronized}\`\`\``, 
                inline: false 
            }
        );

        // ================= EMOJI & STICKER STATS =================
        if (emojiCount > 0 || stickerCount > 0) {
            serverEmbed.addFields({
                name: '🎨 MEDIA ASSETS',
                value: `\`\`\`yaml\n${t.emojis}: ${emojiCount}\n${t.stickers}: ${stickerCount}\`\`\``,
                inline: false
            });
        }

        serverEmbed
            .setFooter({ 
                text: `${guild.name.toUpperCase()} • ${t.footer} • v${version}`, 
                iconURL: icon 
            })
            .setTimestamp();

        // ================= SEND RESPONSE =================
        const content = isAnniversary 
            ? t.anniversaryAlert(sectorAge)
            : t.scanning;

        await message.reply({ 
            content: content,
            embeds: [serverEmbed] 
        }).catch(() => {});
    }
};