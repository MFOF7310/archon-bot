const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');

function getSystemStats(client) {
    const uptimeSec = process.uptime();
    const days = Math.floor(uptimeSec / 86400);
    const hours = Math.floor((uptimeSec % 86400) / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    let uptimeString = '';
    if (days > 0) uptimeString += `${days}d `;
    if (hours > 0) uptimeString += `${hours}h `;
    uptimeString += `${minutes}m`;
    return {
        uptimeString: uptimeString.trim() || '0m',
        totalMembers: client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0),
        totalGuilds: client.guilds.cache.size,
        totalCommands: client.commands?.size || 0,
        memoryUsage: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1),
        ping: Math.round(client.ws.ping),
    };
}

function buildDossierEmbed(client, lang, isArchitect, stats, version) {
    const ARCHITECT_ID = process.env.OWNER_ID;
    const aiStatus    = '● ACTIVE';
    const mktStatus   = '● LIVE';
    const tgStatus    = '● LINKED';
    const pingStatus  = stats.ping < 150 ? 'NOMINAL' : stats.ping < 300 ? 'DEGRADED' : 'CRITICAL';

    const isFr = lang === 'fr';

    const lines = {
        header:     isFr ? 'DOSSIER NEURAL — BAMAKO_223 🇲🇱' : 'NEURAL DOSSIER — BAMAKO_223 🇲🇱',
        subject:    isFr ? 'SUJET' : 'SUBJECT',
        clearance:  isFr ? 'NIVEAU D\'ACCÈS' : 'CLEARANCE LEVEL',
        node:       isFr ? 'NŒUD' : 'NODE',
        status:     isFr ? 'STATUT' : 'STATUS',
        inference:  isFr ? 'MOTEUR D\'INFÉRENCE' : 'INFERENCE ENGINE',
        plugins:    isFr ? 'MODULES ACTIFS' : 'ACTIVE PLUGINS',
        servers:    isFr ? 'SERVEURS EN LIGNE' : 'SERVERS ONLINE',
        agents:     isFr ? 'AGENTS ENREGISTRÉS' : 'REGISTERED AGENTS',
        uptime:     isFr ? 'DISPONIBILITÉ' : 'UPTIME',
        latency:    isFr ? 'LATENCE' : 'LATENCY',
        classified: isFr ? 'SYSTÈMES CLASSIFIÉS' : 'CLASSIFIED SYSTEMS',
        lydia:      isFr ? 'LYDIA IA' : 'LYDIA AI',
        automod:    'AUTOMOD',
        economy:    isFr ? 'ÉCONOMIE' : 'ECONOMY',
        telegram:   'TELEGRAM BRIDGE',
        architect:  'ARCHITECT',
        jurisdiction: isFr ? 'JURIDICTION' : 'JURISDICTION',
        dashboard:  'DASHBOARD',
        footer:     isFr ? 'CLASSIFIÉ // ARCHON CG-223 // SOUVERAINETÉ NUMÉRIQUE' : 'CLASSIFIED // ARCHON CG-223 // DIGITAL SOVEREIGNTY',
        invite:     isFr ? 'INVITER' : 'INVITE',
        support:    'SUPPORT',
        vote:       isFr ? 'VOTER' : 'VOTE',
        statusBtn:  isFr ? 'STATUT' : 'STATUS',
        architectWelcome: isFr
            ? '`[ACCÈS ARCHITECTE CONFIRMÉ]`\nBienvenue, Créateur. Tous les systèmes opérationnels.\nMoteur neural actif — 111 plugins synchronisés.'
            : '`[ARCHITECT ACCESS CONFIRMED]`\nWelcome back, Creator. All systems operational.\nNeural engine active — 111 plugins synchronized.',
    };

    const operationalBlock = [
        `\`\`\`ansi`,
        `\u001b[1;36m${lines.subject.padEnd(20)}\u001b[0m ARCHON CG-223`,
        `\u001b[1;36m${lines.clearance.padEnd(20)}\u001b[0m \u001b[1;33mSUPREME\u001b[0m`,
        `\u001b[1;36m${lines.node.padEnd(20)}\u001b[0m BAMAKO-STEEL-NODE // HETZNER EU`,
        `\u001b[1;36m${lines.status.padEnd(20)}\u001b[0m \u001b[1;32m● OPERATIONAL\u001b[0m`,
        `\`\`\``
    ].join('\n');

    const statsBlock = [
        `\`\`\`ansi`,
        `\u001b[0;37m▸ ${lines.inference.padEnd(22)}\u001b[0m OpenRouter Multi-Model`,
        `\u001b[0;37m▸ ${lines.plugins.padEnd(22)}\u001b[0m 111 modules loaded`,
        `\u001b[0;37m▸ ${lines.servers.padEnd(22)}\u001b[0m ${stats.totalGuilds} active nodes`,
        `\u001b[0;37m▸ ${lines.agents.padEnd(22)}\u001b[0m ${stats.totalMembers.toLocaleString()} operatives`,
        `\u001b[0;37m▸ ${lines.uptime.padEnd(22)}\u001b[0m ${stats.uptimeString}`,
        `\u001b[0;37m▸ ${lines.latency.padEnd(22)}\u001b[0m ${stats.ping}ms // ${pingStatus}`,
        `\`\`\``
    ].join('\n');

    const classifiedBlock = [
        `\`\`\`ansi`,
        `\u001b[1;31m▸ ${lines.lydia.padEnd(22)}\u001b[0m MULTI-AGENT ${aiStatus}`,
        `\u001b[1;31m▸ ${lines.automod.padEnd(22)}\u001b[0m THREAT DETECTION ON`,
        `\u001b[1;31m▸ ${lines.economy.padEnd(22)}\u001b[0m LIVE MARKET ${mktStatus}`,
        `\u001b[1;31m▸ ${lines.telegram.padEnd(22)}\u001b[0m BAMAKO_223 ${tgStatus}`,
        `\`\`\``
    ].join('\n');

    const identityBlock = [
        `\`\`\`ansi`,
        `\u001b[1;33m▸ ${lines.architect.padEnd(22)}\u001b[0m Moussa Fofana // MFOF7310`,
        `\u001b[1;33m▸ ${lines.jurisdiction.padEnd(22)}\u001b[0m Bamako, Mali 🇲🇱`,
        `\u001b[1;33m▸ ${lines.dashboard.padEnd(22)}\u001b[0m bamako-steel-dev.xyz`,
        `\`\`\``
    ].join('\n');

    const embed = new EmbedBuilder()
        .setColor(0x00f0ff)
        .setAuthor({
            name: `// CLASSIFIED // ARCHON CG-223 // v${version}`,
            iconURL: client.user.displayAvatarURL({ dynamic: true })
        })
        .setTitle(`📁 ${lines.header}`)
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
            { name: '⬛ OPERATIONAL STATUS', value: operationalBlock, inline: false },
            { name: '📊 INTELLIGENCE REPORT', value: statsBlock, inline: false },
            { name: '🔴 CLASSIFIED SYSTEMS', value: classifiedBlock, inline: false },
            { name: '🪪 OPERATIVE IDENTITY', value: identityBlock, inline: false },
        );

    if (isArchitect) {
        embed.addFields({ name: '🔐 ARCHITECT TERMINAL', value: lines.architectWelcome, inline: false });
    }

    embed.setFooter({
        text: lines.footer,
        iconURL: client.user.displayAvatarURL()
    }).setTimestamp();

    return embed;
}

function buildButtons(t, isSlash = false) {
    const s = isSlash ? '_slash' : '';
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('INVITE').setURL(`https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID || '1472707869257367676'}&permissions=8&scope=bot%20applications.commands`).setStyle(ButtonStyle.Link).setEmoji('🔗'),
        new ButtonBuilder().setLabel('DASHBOARD').setURL('https://bamako-steel-dev.xyz').setStyle(ButtonStyle.Link).setEmoji('🌐'),
        new ButtonBuilder().setLabel('GITHUB').setURL('https://github.com/MFOF7310').setStyle(ButtonStyle.Link).setEmoji('💻'),
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`about_support${s}`).setLabel('SUPPORT').setStyle(ButtonStyle.Primary).setEmoji('🆘'),
        new ButtonBuilder().setCustomId(`about_vote${s}`).setLabel('VOTE').setStyle(ButtonStyle.Secondary).setEmoji('⭐'),
        new ButtonBuilder().setCustomId(`about_status${s}`).setLabel('STATUS').setStyle(ButtonStyle.Secondary).setEmoji('📡'),
    );
    return { row1, row2 };
}

async function handleButton(btn, client, userId, lang) {
    if (btn.user.id !== userId) {
        return btn.reply({ content: '❌ Access denied — session locked.', ephemeral: true }).catch(() => {});
    }
    const id = btn.customId.replace('_slash', '');
    const isFr = lang === 'fr';
    switch (id) {
        case 'about_support':
            await btn.reply({ content: `🆘 **Support:** https://discord.gg/NFSMFJajp9\n📧 Dev: mfof7559 // Bamako, Mali 🇲🇱`, ephemeral: true }).catch(() => {});
            break;
        case 'about_vote':
            await btn.reply({ content: `⭐ **${isFr ? 'Votez pour ARCHON CG-223' : 'Vote for ARCHON CG-223'}:**\nhttps://top.gg/bot/${client.user.id}/vote\n\n${isFr ? '📜 Votre vote renforce le réseau neural!' : '📜 Your vote strengthens the neural grid!'}`, ephemeral: true }).catch(() => {});
            break;
        case 'about_status':
            const ping = Math.round(client.ws.ping);
            const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
            const status = ping < 150 ? '🟢 NOMINAL' : ping < 300 ? '🟡 DEGRADED' : '🔴 CRITICAL';
            await btn.reply({ content: `\`\`\`ansi\n\u001b[1;36mLIVE SYSTEM STATUS\u001b[0m\n▸ LATENCY    ${ping}ms // ${status}\n▸ MEMORY     ${mem} MB\n▸ AI ENGINE  OpenRouter // ACTIVE\n▸ NODE       BAMAKO-STEEL-NODE\n\`\`\``, ephemeral: true }).catch(() => {});
            break;
    }
}

module.exports = {
    name: 'about',
    aliases: ['info', 'author', 'architect', 'botinfo', 'system', 'apropos', 'credits', 'dossier'],
    description: '📁 Display the ARCHON CG-223 classified neural dossier.',
    category: 'SYSTEM',
    cooldown: 5000,
    usage: '.about',

    data: new SlashCommandBuilder()
        .setName('about')
        .setDescription('📁 Display the ARCHON CG-223 classified neural dossier'),

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, message.guild?.id) : 'en';
        const version = client.version || '3.0.6';
        const isArchitect = message.author.id === process.env.OWNER_ID;
        const stats = getSystemStats(client);
        const embed = buildDossierEmbed(client, lang, isArchitect, stats, version);
        const { row1, row2 } = buildButtons(null, false);
        const reply = await message.reply({ embeds: [embed], components: [row1, row2] }).catch(() => {});
        if (!reply) return;
        const collector = reply.createMessageComponentCollector({ time: 120000 });
        collector.on('collect', async (btn) => handleButton(btn, client, message.author.id, lang));
        collector.on('end', async () => {
            try {
                const d2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('about_support').setLabel('SUPPORT').setStyle(ButtonStyle.Primary).setEmoji('🆘').setDisabled(true),
                    new ButtonBuilder().setCustomId('about_vote').setLabel('VOTE').setStyle(ButtonStyle.Secondary).setEmoji('⭐').setDisabled(true),
                    new ButtonBuilder().setCustomId('about_status').setLabel('STATUS').setStyle(ButtonStyle.Secondary).setEmoji('📡').setDisabled(true),
                );
                await reply.edit({ components: [row1, d2] }).catch(() => {});
            } catch (e) {}
        });
    },

    execute: async (interaction, client) => {
        const serverLang = client.getServerSettings?.(interaction.guild?.id)?.language;
        const lang = serverLang === 'fr' ? 'fr' : serverLang === 'en' ? 'en' : (interaction.locale?.startsWith('fr') ? 'fr' : 'en');
        try { await interaction.deferReply(); } catch (e) { return; }
        const version = client.version || '3.0.6';
        const isArchitect = interaction.user.id === process.env.OWNER_ID;
        const stats = getSystemStats(client);
        const embed = buildDossierEmbed(client, lang, isArchitect, stats, version);
        const { row1, row2 } = buildButtons(null, true);
        let reply;
        try { reply = await interaction.editReply({ embeds: [embed], components: [row1, row2] }); }
        catch (e) { return; }
        if (!reply) return;
        const collector = reply.createMessageComponentCollector({ time: 120000 });
        collector.on('collect', async (btn) => handleButton(btn, client, interaction.user.id, lang));
        collector.on('end', async () => {
            try {
                const d2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('about_invite_slash').setLabel('SUPPORT').setStyle(ButtonStyle.Primary).setEmoji('🆘').setDisabled(true),
                    new ButtonBuilder().setCustomId('about_vote_slash').setLabel('VOTE').setStyle(ButtonStyle.Secondary).setEmoji('⭐').setDisabled(true),
                    new ButtonBuilder().setCustomId('about_status_slash').setLabel('STATUS').setStyle(ButtonStyle.Secondary).setEmoji('📡').setDisabled(true),
                );
                await interaction.editReply({ components: [row1, d2] }).catch(() => {});
            } catch (e) {}
        });
    }
};
