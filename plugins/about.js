const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const aboutTranslations = {
    en: {
        title: '🛡️ SYSTEM AUTHORIZATION & CREDITS',
        desc: (id) => `**ARCHITECT CG-223 | DIGITAL ENGINE**\nPrincipal Architect: <@${id}>`,
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
        buttonTikTok: 'TikTok',
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
        accessLocked: '❌ These controls are locked to your session.'
    },
    fr: {
        title: '🛡️ AUTORISATION SYSTÈME & CRÉDITS',
        desc: (id) => `**ARCHITECTE CG-223 | MOTEUR NUMÉRIQUE**\nArchitecte Principal : <@${id}>`,
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
        buttonTikTok: 'TikTok',
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
        accessLocked: '❌ Ces contrôles sont verrouillés à votre session.'
    }
};

module.exports = {
    name: 'about',
    aliases: ['info', 'author', 'architect', 'botinfo', 'system', 'apropos', 'credits'],
    description: '📖 Display system authorization and architect information.',
    category: 'SYSTEM',
    cooldown: 5000,
    usage: '.about',
    examples: ['.about', '.info', '.apropos'],

    // 🔥 NEW SIGNATURE: 6 parameters with usedCommand
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        
        // 🔥 NEURAL LANGUAGE BRIDGE - Alias-based detection!
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, 'en')
            : 'en';
        
        const t = aboutTranslations[lang];
        const ARCHITECT_ID = process.env.OWNER_ID;
        const version = client.version || '1.6.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        
        // ================= API STATUS =================
        const groqStatus = (process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY) ? '✅' : '❌';
        const braveStatus = process.env.BRAVE_API_KEY ? '✅' : '❌';
        
        // ================= SYSTEM STATISTICS =================
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
        
        const totalMembers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
        const totalGuilds = client.guilds.cache.size;
        const totalCommands = client.commands?.size || 0;
        const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const ping = Math.round(client.ws.ping);
        const cacheSize = client.userDataCache?.size || 0;
        
        // ================= CHECK ARCHITECT =================
        const isArchitect = message.author.id === ARCHITECT_ID;
        
        // ================= BUILD EMBED =================
        const aboutEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setAuthor({ 
                name: `⚙️ ${t.systemStatus}`, 
                iconURL: client.user.displayAvatarURL({ dynamic: true }) 
            })
            .setTitle(t.title)
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 512 }))
            .setDescription(t.desc(ARCHITECT_ID))
            .addFields(
                { 
                    name: `${t.inference} ${groqStatus}`,
                    value: `\`\`\`yaml\n${t.inferenceModel}\n${t.inferenceDesc}\`\`\``,
                    inline: true 
                },
                { 
                    name: `${t.search} ${braveStatus}`,
                    value: `\`\`\`yaml\n${t.searchModel}\n${t.searchDesc}\`\`\``,
                    inline: true 
                },
                { 
                    name: t.region,
                    value: `\`\`\`yaml\n${t.nodeLocation}\n${t.nodeDesc}\`\`\``,
                    inline: true 
                },
                { 
                    name: t.neuralCore,
                    value: `\`\`\`yaml\nLYDIA_70B\n${t.online} | Cache: ${cacheSize}\`\`\``,
                    inline: false 
                },
                { 
                    name: t.version,
                    value: `\`v${version}\``,
                    inline: true 
                },
                { 
                    name: t.uptime,
                    value: `\`${uptimeString}\``,
                    inline: true 
                },
                { 
                    name: t.commands,
                    value: `\`${totalCommands}\` ${t.activeModules}`,
                    inline: true 
                },
                { 
                    name: t.servers,
                    value: `\`${totalGuilds}\` ${lang === 'fr' ? 'serveurs' : 'servers'}`,
                    inline: true 
                },
                { 
                    name: t.users,
                    value: `\`${totalMembers.toLocaleString()}\` ${t.agents}`,
                    inline: true 
                },
                { 
                    name: t.memory,
                    value: `\`${memoryUsage} MB\``,
                    inline: true 
                },
                { 
                    name: t.latency,
                    value: `\`${ping}ms\``,
                    inline: true 
                },
                { 
                    name: t.apiStatus,
                    value: `\`\`\`yaml\nGroq LPU™: ${groqStatus}\nBrave Search: ${braveStatus}\nDiscord: ${ping}ms\`\`\``,
                    inline: false 
                }
            );
        
        // ================= ARCHITECT MESSAGE =================
        if (isArchitect) {
            aboutEmbed.addFields({
                name: t.architectAccess,
                value: t.architectWelcome,
                inline: false
            });
        }
        
        aboutEmbed
            .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
            .setTimestamp();
        
        // ================= BUTTON ROWS =================
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel(t.buttonFacebook)
                .setURL('https://www.facebook.com/share/17KysmJrtm/')
                .setStyle(ButtonStyle.Link)
                .setEmoji('📘'),
            new ButtonBuilder()
                .setLabel(t.buttonTikTok)
                .setURL('https://www.tiktok.com/@cloudgaming223')
                .setStyle(ButtonStyle.Link)
                .setEmoji('🎵'),
            new ButtonBuilder()
                .setLabel(t.buttonGitHub)
                .setURL('https://github.com/MFOF7310')
                .setStyle(ButtonStyle.Link)
                .setEmoji('💻')
        );
        
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('about_invite')
                .setLabel(t.buttonInvite)
                .setStyle(ButtonStyle.Success)
                .setEmoji('🔗'),
            new ButtonBuilder()
                .setCustomId('about_support')
                .setLabel(t.buttonSupport)
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🆘'),
            new ButtonBuilder()
                .setCustomId('about_vote')
                .setLabel(t.buttonVote)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⭐'),
            new ButtonBuilder()
                .setCustomId('about_status')
                .setLabel(t.buttonStatus)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📊')
        );
        
        const reply = await message.reply({ 
            embeds: [aboutEmbed], 
            components: [row1, row2] 
        }).catch(() => {});
        
        if (!reply) return;
        
        // ================= BUTTON COLLECTOR =================
        const collector = reply.createMessageComponentCollector({ time: 60000 });
        
        collector.on('collect', async (interaction) => {
            if (interaction.user.id !== message.author.id) {
                return interaction.reply({ 
                    content: t.accessLocked, 
                    ephemeral: true 
                }).catch(() => {});
            }
            
            switch (interaction.customId) {
                case 'about_invite':
                    await interaction.reply({ 
                        content: t.inviteUrl(client.user.id),
                        ephemeral: true 
                    }).catch(() => {});
                    break;
                    
                case 'about_support':
                    await interaction.reply({ 
                        content: t.supportComing,
                        ephemeral: true 
                    }).catch(() => {});
                    break;
                    
                case 'about_vote':
                    await interaction.reply({ 
                        content: t.voteComing,
                        ephemeral: true 
                    }).catch(() => {});
                    break;
                    
                case 'about_status':
                    const freshPing = Math.round(client.ws.ping);
                    const freshMemory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
                    await interaction.reply({ 
                        content: t.liveStatus(freshPing, freshMemory, groqStatus, braveStatus),
                        ephemeral: true 
                    }).catch(() => {});
                    break;
            }
        });
        
        console.log(`[ABOUT] ${message.author.tag} | v${version} | Groq: ${groqStatus} | Brave: ${braveStatus} | Lang: ${lang}`);
    }
};