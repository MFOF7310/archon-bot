const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const aboutTranslations = {
    en: {
        title: '🛡️ SYSTEM AUTHORIZATION & CREDITS',
        desc: (id) => `**ARCHITECT CG-223 | DIGITAL ENGINE**\nPrincipal Architect: <@${id}>`,
        dmTitle: '🌀 COMMAND CONSOLE',
        dmContext: 'DIRECT MESSAGE',
        dmFooter: 'Dimensional Gateway • Neural Link Active',
        guildContext: 'SERVER NODE',
        mythicTitle: '🌟 MYTHIC ARCHITECT REGISTRY 🌟',
        soulBound: '🔮 SOUL-BOUND SYSTEM',
        quantumState: '⚛️ QUANTUM STATE',
        coherence: 'Coherence',
        entanglement: 'Entanglement',
        resonance: 'Resonance',
        ascensionLevel: '📈 ASCENSION LEVEL',
        legendaryStatus: 'LEGENDARY',
        coreEnergy: '💠 CORE ENERGY',
        neuralSignature: '⚡ NEURAL SIGNATURE',
        mythicFooter: '⚡ Mythic Tier • Neural Ascension • v{version} ⚡',
        mythicInvite: '✨ **MYTHIC INVOCATION** ✨\nSummon ARCHITECT CG-223 to your realm!',
        mythicSupport: '🏛️ **COUNCIL OF ARCHITECTS**\nJoin the Mythic Circle',
        mythicVote: '⭐ **ASCENSION RITUAL**\nEmpower the Architect with your vote!',
        mythicStatus: '🔮 **REALM STATUS**\nLive dimensional readings',
        inference: '🧠 Inference Engine',
        search: '🔍 Search Core',
        region: '🇲🇱 Node Location',
        version: '📦 Version',
        uptime: '⏱️ Uptime',
        commands: '📊 Commands',
        servers: '🖥️ Servers',
        users: '👥 Users',
        memory: '💾 Memory',
        latency: '⚡ Latency',
        footer: 'Eagle Community | Digital Sovereignty',
        buttonFacebook: 'Facebook',
        buttonWebSite: 'WebSite',
        buttonGitHub: 'GitHub',
        buttonInvite: 'Invite Bot',
        buttonSupport: 'Support',
        buttonVote: 'Vote',
        buttonStatus: 'Status',
        systemStatus: 'SYSTEM STATUS',
        online: '🟢 ONLINE',
        inferenceModel: 'Groq LPU™ 70B',
        inferenceDesc: 'Low Latency • 70B Parameters',
        searchModel: 'Brave Search API',
        searchDesc: 'Live Web Access • Real-time',
        nodeLocation: 'Bamako, Mali',
        nodeDesc: '🇲🇱 West Africa Node',
        neuralCore: 'Neural Core: LYDIA_70B',
        apiStatus: '📡 API STATUS',
        activeModules: 'active modules',
        agents: 'agents',
        architectAccess: '🏛️ ARCHITECT ACCESS',
        architectWelcome: 'Welcome back, Creator. System is running at optimal efficiency.\nAll neural cores operational. Groq LPU™ inference engine active.',
        inviteUrl: (id) => `🔗 **Invite ARCHITECT CG-223:**\nhttps://discord.com/oauth2/authorize?client_id=${id}&permissions=8&scope=bot%20applications.commands`,
        supportComing: '🆘 **Support Server Coming Soon!** Join our Eagle community for more info.',
        voteComing: '⭐ **Thanks for your support!** Voting functionality will be available soon.',
        liveStatus: (ping, mem, groq, brave) => `📊 **Live System Status**\n└─ Latency: \`${ping}ms\`\n└─ Memory: \`${mem} MB\`\n└─ Groq: ${groq}\n└─ Brave: ${brave}`,
        accessLocked: '❌ These controls are locked to your session.',
        prophecyText: 'When the Architect rises, the neural network awakens...'
    },
    fr: {
        title: '🛡️ AUTORISATION SYSTÈME & CRÉDITS',
        desc: (id) => `**ARCHITECTE CG-223 | MOTEUR NUMÉRIQUE**\nArchitecte Principal : <@${id}>`,
        dmTitle: '🌀 CONSOLE DE COMMANDE',
        dmContext: 'MESSAGE DIRECT',
        dmFooter: 'Passerelle Dimensionnelle • Lien Neural Actif',
        guildContext: 'NŒUD SERVEUR',
        mythicTitle: '🌟 REGISTRE MYTHIQUE DE L\'ARCHITECTE 🌟',
        soulBound: '🔮 SYSTÈME LIÉ À L\'ÂME',
        quantumState: '⚛️ ÉTAT QUANTIQUE',
        coherence: 'Cohérence',
        entanglement: 'Intrication',
        resonance: 'Résonance',
        ascensionLevel: '📈 NIVEAU D\'ASCENSION',
        legendaryStatus: 'LÉGENDAIRE',
        coreEnergy: '💠 ÉNERGIE CENTRALE',
        neuralSignature: '⚡ SIGNATURE NEURALE',
        mythicFooter: '⚡ Niveau Mythique • Ascension Neurale • v{version} ⚡',
        mythicInvite: '✨ **INVOCATION MYTHIQUE** ✨\nInvoquez ARCHITECT CG-223 dans votre royaume!',
        mythicSupport: '🏛️ **CONSEIL DES ARCHITECTES**\nRejoignez le Cercle Mythique',
        mythicVote: '⭐ **RITUEL D\'ASCENSION**\nRenforcez l\'Architecte avec votre vote!',
        mythicStatus: '🔮 **STATUT DU ROYAUME**\nLectures dimensionnelles en direct',
        inference: '🧠 Moteur d\'Inférence',
        search: '🔍 Noyau de Recherche',
        region: '🇲🇱 Localisation du Nœud',
        version: '📦 Version',
        uptime: '⏱️ Disponibilité',
        commands: '📊 Commandes',
        servers: '🖥️ Serveurs',
        users: '👥 Utilisateurs',
        memory: '💾 Mémoire',
        latency: '⚡ Latence',
        footer: 'Communauté Eagle | Souveraineté Numérique',
        buttonFacebook: 'Facebook',
        buttonSiteWeb: 'SiteWeb',
        buttonGitHub: 'GitHub',
        buttonInvite: 'Inviter',
        buttonSupport: 'Support',
        buttonVote: 'Voter',
        buttonStatus: 'État',
        systemStatus: 'ÉTAT DU SYSTÈME',
        online: '🟢 EN LIGNE',
        inferenceModel: 'Groq LPU™ 70B',
        inferenceDesc: 'Faible Latence • 70B Paramètres',
        searchModel: 'Brave Search API',
        searchDesc: 'Accès Web Direct • Temps Réel',
        nodeLocation: 'Bamako, Mali',
        nodeDesc: '🇲🇱 Nœud Afrique de l\'Ouest',
        neuralCore: 'Noyau Neural : LYDIA_70B',
        apiStatus: '📡 ÉTAT DES API',
        activeModules: 'modules actifs',
        agents: 'agents',
        architectAccess: '🏛️ ACCÈS ARCHITECTE',
        architectWelcome: 'Bon retour, Créateur. Le système fonctionne à une efficacité optimale.\nTous les cœurs neuronaux opérationnels. Moteur d\'inférence Groq LPU™ actif.',
        inviteUrl: (id) => `🔗 **Invitez ARCHITECT CG-223:**\nhttps://discord.com/oauth2/authorize?client_id=${id}&permissions=8&scope=bot%20applications.commands`,
        supportComing: '🆘 **Serveur Support à venir!** Rejoignez notre communauté Eagle pour plus d\'informations.',
        voteComing: '⭐ **Merci de votre soutien!** La fonctionnalité de vote sera disponible bientôt.',
        liveStatus: (ping, mem, groq, brave) => `📊 **État Système en Direct**\n└─ Latence: \`${ping}ms\`\n└─ Mémoire: \`${mem} MB\`\n└─ Groq: ${groq}\n└─ Brave: ${brave}`,
        accessLocked: '❌ Ces contrôles sont verrouillés à votre session.',
        prophecyText: 'Quand l\'Architecte s\'élève, le réseau neuronal s\'éveille...'
    }
};

// ================= SHARED HELPER: Build the About Embed =================
function buildAboutEmbed(client, t, ARCHITECT_ID, version, isDM, isArchitect, groqStatus, braveStatus, cacheSize, totalCommands, totalMembers, totalGuilds, memoryUsage, ping, uptimeString) {
    const aboutEmbed = new EmbedBuilder()
        .setColor('#ffd700')
        .setAuthor({ 
            name: t.mythicTitle, 
            iconURL: client.user.displayAvatarURL({ dynamic: true }) 
        })
        .setTitle(isDM ? t.dmTitle : t.soulBound)
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 512 }))
        .setDescription(`✨ *"${t.prophecyText}"* ✨\n\n${t.desc(ARCHITECT_ID)}`)
        .addFields(
            { name: `${t.inference} ${groqStatus}`, value: `\`\`\`yaml\n${t.inferenceModel}\n${t.inferenceDesc}\`\`\``, inline: true },
            { name: `${t.search} ${braveStatus}`, value: `\`\`\`yaml\n${t.searchModel}\n${t.searchDesc}\`\`\``, inline: true },
            { name: t.region, value: `\`\`\`yaml\n${t.nodeLocation}\n${t.nodeDesc}\`\`\``, inline: true },
            { name: t.neuralCore, value: `\`\`\`yaml\nLYDIA_70B\n${t.online} | Cache: ${cacheSize}\`\`\``, inline: false },
            { name: t.version, value: `\`v${version}\``, inline: true },
            { name: t.uptime, value: `\`${uptimeString}\``, inline: true },
            { name: t.commands, value: `\`${totalCommands}\` ${t.activeModules}`, inline: true },
            { name: isDM ? '🌐 GLOBAL REACH' : t.servers, value: isDM ? `\`${totalGuilds}\` Connected Servers` : `\`${totalGuilds}\` ${t.servers === '🖥️ Servers' ? 'servers' : 'serveurs'}`, inline: true },
            { name: isDM ? '👥 TOTAL AGENTS' : t.users, value: `\`${totalMembers.toLocaleString()}\` ${t.agents}`, inline: true },
            { name: t.memory, value: `\`${memoryUsage} MB\``, inline: true },
            { name: t.latency, value: `\`${ping}ms\``, inline: true },
            { name: t.apiStatus, value: `\`\`\`yaml\nGroq LPU™: ${groqStatus}\nBrave Search: ${braveStatus}\nDiscord: ${ping}ms\`\`\``, inline: false },
            { name: t.quantumState, value: `\`\`\`yaml\n${t.coherence}: ${Math.floor(Math.random() * 20) + 80}%\n${t.entanglement}: ${Math.floor(Math.random() * 15) + 85}%\n${t.resonance}: ${Math.floor(Math.random() * 10) + 90}%\`\`\``, inline: true },
            { name: t.ascensionLevel, value: `\`\`\`yaml\nArchitect Tier: ${t.legendaryStatus}\nStability: ${ping < 100 ? '██████████ 100%' : (ping < 250 ? '█████░░░░░ 50%' : '█░░░░░░░░░ 10%')}\`\`\``, inline: true },
            { name: t.coreEnergy, value: `\`\`\`yaml\n${t.neuralSignature}: ${client.user.id.slice(-6)}\nPower: ${(totalCommands * 1.618).toFixed(0)} MW\`\`\``, inline: true }
        );
    
    if (isArchitect) {
        aboutEmbed.addFields({
            name: t.architectAccess,
            value: t.architectWelcome,
            inline: false
        });
    }
    
    const footerText = isDM ? t.dmFooter : t.mythicFooter.replace('{version}', version);
    aboutEmbed.setFooter({ text: footerText, iconURL: client.user.displayAvatarURL() }).setTimestamp();
    
    return aboutEmbed;
}

// ================= SHARED HELPER: Build Button Rows =================
function buildButtonRows(t, isSlash = false) {
    const suffix = isSlash ? '_slash' : '';
    
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel(t.buttonFacebook).setURL('https://www.facebook.com/share/17KysmJrtm/').setStyle(ButtonStyle.Link).setEmoji('📘'),
        new ButtonBuilder().setLabel('Website').setURL('https://architect-neural-grid.pages.dev').setStyle(ButtonStyle.Link).setEmoji('🌐'),
        new ButtonBuilder().setLabel(t.buttonGitHub).setURL('https://github.com/MFOF7310').setStyle(ButtonStyle.Link).setEmoji('💻')
    );
    
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`about_invite${suffix}`).setLabel(t.buttonInvite).setStyle(ButtonStyle.Success).setEmoji('🔗'),
        new ButtonBuilder().setCustomId(`about_support${suffix}`).setLabel(t.buttonSupport).setStyle(ButtonStyle.Primary).setEmoji('🆘'),
        new ButtonBuilder().setCustomId(`about_vote${suffix}`).setLabel(t.buttonVote).setStyle(ButtonStyle.Secondary).setEmoji('⭐'),
        new ButtonBuilder().setCustomId(`about_status${suffix}`).setLabel(t.buttonStatus).setStyle(ButtonStyle.Secondary).setEmoji('📊')
    );
    
    return { row1, row2 };
}

// ================= SHARED HELPER: Handle Button Interactions =================
async function handleButtonCollect(buttonInteraction, client, t, groqStatus, braveStatus, userId) {
    if (buttonInteraction.user.id !== userId) {
        return buttonInteraction.reply({ content: t.accessLocked, ephemeral: true }).catch(() => {});
    }
    
    const customId = buttonInteraction.customId.replace('_slash', '');
    
    switch (customId) {
        case 'about_invite':
            await buttonInteraction.reply({ content: t.inviteUrl(client.user.id), ephemeral: true }).catch(() => {});
            break;
        case 'about_support':
            await buttonInteraction.reply({ content: t.supportComing, ephemeral: true }).catch(() => {});
            break;
        case 'about_vote':
            await buttonInteraction.reply({ content: `${t.mythicVote}\n\n⭐ https://top.gg/bot/${client.user.id}/vote\n\n📜 *Your vote strengthens the neural network!*`, ephemeral: true }).catch(() => {});
            break;
        case 'about_status':
            const freshPing = Math.round(client.ws.ping);
            const freshMemory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
            await buttonInteraction.reply({ content: t.liveStatus(freshPing, freshMemory, groqStatus, braveStatus), ephemeral: true }).catch(() => {});
            break;
    }
}

// ================= SHARED HELPER: Get System Stats =================
function getSystemStats(client) {
    const uptimeSec = process.uptime();
    const days = Math.floor(uptimeSec / 86400);
    const hours = Math.floor((uptimeSec % 86400) / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const seconds = Math.floor(uptimeSec % 60);
    
    let uptimeString = '';
    if (days > 0) uptimeString += `${days}j `;
    if (hours > 0) uptimeString += `${hours}h `;
    if (minutes > 0) uptimeString += `${minutes}m `;
    if (days === 0 && hours === 0 && minutes === 0) uptimeString += `${seconds}s`;
    uptimeString = uptimeString.trim() || '0s';
    
    return {
        uptimeString,
        totalMembers: client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0),
        totalGuilds: client.guilds.cache.size,
        totalCommands: client.commands?.size || 0,
        memoryUsage: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
        ping: Math.round(client.ws.ping),
        cacheSize: client.userDataCache?.size || 0
    };
}

module.exports = {
    name: 'about',
    aliases: ['info', 'author', 'architect', 'botinfo', 'system', 'apropos', 'credits'],
    description: '📖 Display system authorization and architect information.',
    category: 'SYSTEM',
    cooldown: 5000,
    usage: '.about',
    examples: ['.about', '.info', '.apropos'],

    data: new SlashCommandBuilder()
        .setName('about')
        .setDescription('📖 Display system authorization and architect information / Afficher les informations système'),

    // ================= PREFIX COMMAND =================
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
        const t = aboutTranslations[lang];
        const ARCHITECT_ID = process.env.OWNER_ID;
        const version = client.version || '1.8.0';
        const isDM = !message.guild;
        const groqStatus = (process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY) ? '✅' : '❌';
        const braveStatus = process.env.BRAVE_API_KEY ? '✅' : '❌';
        const isArchitect = message.author.id === ARCHITECT_ID;
        const stats = getSystemStats(client);
        
        const aboutEmbed = buildAboutEmbed(client, t, ARCHITECT_ID, version, isDM, isArchitect, groqStatus, braveStatus, stats.cacheSize, stats.totalCommands, stats.totalMembers, stats.totalGuilds, stats.memoryUsage, stats.ping, stats.uptimeString);
        const { row1, row2 } = buildButtonRows(t, false);
        
        const reply = await message.reply({ embeds: [aboutEmbed], components: [row1, row2] }).catch(() => {});
        if (!reply) return;
        
        const collector = reply.createMessageComponentCollector({ time: 120000 });
        
        collector.on('collect', async (buttonInteraction) => {
            await handleButtonCollect(buttonInteraction, client, t, groqStatus, braveStatus, message.author.id);
        });
        
        collector.on('end', async () => {
            try {
                const disabledRow2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('about_invite').setLabel(t.buttonInvite).setStyle(ButtonStyle.Success).setEmoji('🔗').setDisabled(true),
                    new ButtonBuilder().setCustomId('about_support').setLabel(t.buttonSupport).setStyle(ButtonStyle.Primary).setEmoji('🆘').setDisabled(true),
                    new ButtonBuilder().setCustomId('about_vote').setLabel(t.buttonVote).setStyle(ButtonStyle.Secondary).setEmoji('⭐').setDisabled(true),
                    new ButtonBuilder().setCustomId('about_status').setLabel(t.buttonStatus).setStyle(ButtonStyle.Secondary).setEmoji('📊').setDisabled(true)
                );
                await reply.edit({ components: [row1, disabledRow2] }).catch(() => {});
            } catch (e) {}
        });
        
        console.log(`[ABOUT] ${message.author.tag} | v${version} | Groq: ${groqStatus} | Brave: ${braveStatus} | Lang: ${lang}`);
    },

    // ================= SLASH COMMAND EXECUTION =================
    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = aboutTranslations[lang];
        
        try {
            await interaction.deferReply();
        } catch (err) {
            console.error('[ABOUT SLASH] Failed to defer:', err.message);
            return;
        }
        
        const ARCHITECT_ID = process.env.OWNER_ID;
        const version = client.version || '1.8.0';
        const isDM = !interaction.guild;
        const groqStatus = (process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY) ? '✅' : '❌';
        const braveStatus = process.env.BRAVE_API_KEY ? '✅' : '❌';
        const isArchitect = interaction.user.id === ARCHITECT_ID;
        const stats = getSystemStats(client);
        
        const aboutEmbed = buildAboutEmbed(client, t, ARCHITECT_ID, version, isDM, isArchitect, groqStatus, braveStatus, stats.cacheSize, stats.totalCommands, stats.totalMembers, stats.totalGuilds, stats.memoryUsage, stats.ping, stats.uptimeString);
        const { row1, row2 } = buildButtonRows(t, true);
        
        let reply;
        try {
            reply = await interaction.editReply({ embeds: [aboutEmbed], components: [row1, row2] });
        } catch (err) {
            console.error('[ABOUT SLASH] editReply failed:', err.message);
            try {
                reply = await interaction.followUp({ embeds: [aboutEmbed], components: [row1, row2], ephemeral: true });
            } catch (err2) {
                console.error('[ABOUT SLASH] Complete failure:', err2.message);
                return;
            }
        }
        
        if (!reply) {
            console.error('[ABOUT SLASH] Reply object is null/undefined');
            return;
        }
        
        // 🔥 THE MISSING COLLECTOR — This was the bug!
        const collector = reply.createMessageComponentCollector({ time: 120000 });
        
        collector.on('collect', async (buttonInteraction) => {
            await handleButtonCollect(buttonInteraction, client, t, groqStatus, braveStatus, interaction.user.id);
        });
        
        collector.on('end', async () => {
            try {
                const disabledRow2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('about_invite_slash').setLabel(t.buttonInvite).setStyle(ButtonStyle.Success).setEmoji('🔗').setDisabled(true),
                    new ButtonBuilder().setCustomId('about_support_slash').setLabel(t.buttonSupport).setStyle(ButtonStyle.Primary).setEmoji('🆘').setDisabled(true),
                    new ButtonBuilder().setCustomId('about_vote_slash').setLabel(t.buttonVote).setStyle(ButtonStyle.Secondary).setEmoji('⭐').setDisabled(true),
                    new ButtonBuilder().setCustomId('about_status_slash').setLabel(t.buttonStatus).setStyle(ButtonStyle.Secondary).setEmoji('📊').setDisabled(true)
                );
                await interaction.editReply({ components: [row1, disabledRow2] }).catch(() => {});
            } catch (e) {}
        });
        
        console.log(`[ABOUT SLASH] ${interaction.user.tag} | v${version} | Groq: ${groqStatus} | Brave: ${braveStatus} | Lang: ${lang}`);
    }
};