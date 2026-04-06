const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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
        systemStatus: 'SYSTEM STATUS',
        online: '🟢 ONLINE',
        inferenceModel: 'Groq LPU™ 70B',
        inferenceDesc: 'Low Latency • 70B Parameters',
        searchModel: 'Brave Search API',
        searchDesc: 'Live Web Access • Real-time',
        nodeLocation: 'Bamako, Mali',
        nodeDesc: '🇲🇱 West Africa Node',
        neuralCore: 'Neural Core: LYDIA_70B'
    },
    fr: {
        title: '🛡️ AUTORISATION SYSTÈME & CRÉDITS',
        desc: (id) => `**ARCHITECTE CG-223 | MOTEUR NUMÉRIQUE**\nArchitecte Principal : <@${id}>`,
        inference: '🧠 Moteur d\'Inférence',
        search: '🔍 Noyau de Recherche',
        region: '🇲🇱 Localisation du Nœud',
        version: '📦 Version',
        uptime: '⏱️ Temps de fonctionnement',
        commands: '📊 Commandes',
        servers: '🖥️ Serveurs',
        users: '👥 Utilisateurs',
        memory: '💾 Mémoire',
        latency: '⚡ Latence',
        footer: 'Communauté Eagle | Souveraineté Numérique',
        buttonFacebook: 'Facebook',
        buttonTikTok: 'TikTok',
        buttonGitHub: 'GitHub',
        systemStatus: 'ÉTAT DU SYSTÈME',
        online: '🟢 EN LIGNE',
        inferenceModel: 'Groq LPU™ 70B',
        inferenceDesc: 'Faible Latence • 70B Paramètres',
        searchModel: 'Brave Search API',
        searchDesc: 'Accès Web Direct • Temps Réel',
        nodeLocation: 'Bamako, Mali',
        nodeDesc: '🇲🇱 Nœud Afrique de l\'Ouest',
        neuralCore: 'Noyau Neural : LYDIA_70B'
    }
};

module.exports = {
    name: 'about',
    aliases: ['info', 'author', 'architect', 'botinfo', 'system'],
    description: 'Display system authorization and architect information for ARCHITECT CG-223.',
    category: 'SYSTEM',
    usage: '.about',
    cooldown: 5000,
    examples: ['.about'],

    run: async (client, message, args) => {
        
        // --- INTELLIGENT LANGUAGE DETECTION ---
        let lang = 'en';
        const guildSettings = client.settings?.get(message.guild?.id);
        if (guildSettings?.language) {
            lang = guildSettings.language;
        } else {
            const frenchKeywords = ['fr', 'francais', 'français', 'french', 'bonjour', 'salut', 'merci'];
            const content = message.content.toLowerCase();
            if (frenchKeywords.some(word => content.includes(word)) || message.guild?.preferredLocale === 'fr') {
                lang = 'fr';
            }
        }
        const t = aboutTranslations[lang];
        
        const ARCHITECT_ID = process.env.OWNER_ID;
        const version = client.version || '1.3.2';
        
        // --- CHECK API STATUS ---
        const groqStatus = process.env.GROQ_API_KEY ? '✅' : '❌';
        const braveStatus = process.env.BRAVE_API_KEY ? '✅' : '❌';
        
        // --- SYSTEM STATISTICS ---
        const uptimeSec = process.uptime();
        const days = Math.floor(uptimeSec / 86400);
        const hours = Math.floor((uptimeSec % 86400) / 3600);
        const minutes = Math.floor((uptimeSec % 3600) / 60);
        
        let uptimeString = '';
        if (days > 0) uptimeString += `${days}d `;
        if (hours > 0) uptimeString += `${hours}h `;
        if (minutes > 0) uptimeString += `${minutes}m `;
        if (days === 0 && hours === 0 && minutes === 0) uptimeString += `${Math.floor(uptimeSec)}s`;
        else if (uptimeSec % 60 > 0 && days === 0 && hours === 0) uptimeString += `${Math.floor(uptimeSec % 60)}s`;
        uptimeString = uptimeString.trim() || '0s';
        
        const totalMembers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
        const totalGuilds = client.guilds.cache.size;
        const totalCommands = client.commands?.size || 0;
        const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const ping = Math.round(client.ws.ping);
        
        // --- CHECK IF ARCHITECT IS SPEAKING ---
        const isArchitect = message.author.id === ARCHITECT_ID;
        
        // --- BUILD ABOUT EMBED ---
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
                    value: `\`${t.inferenceModel}\`\n${t.inferenceDesc}`,
                    inline: true 
                },
                { 
                    name: `${t.search} ${braveStatus}`,
                    value: `\`${t.searchModel}\`\n${t.searchDesc}`,
                    inline: true 
                },
                { 
                    name: t.region,
                    value: `\`${t.nodeLocation}\`\n${t.nodeDesc}`,
                    inline: true 
                },
                { 
                    name: t.neuralCore,
                    value: `\`LYDIA_70B\`\n${t.online}`,
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
                    value: `\`${totalCommands}\` ${lang === 'fr' ? 'modules actifs' : 'active modules'}`,
                    inline: true 
                },
                { 
                    name: t.servers,
                    value: `\`${totalGuilds}\` ${lang === 'fr' ? 'serveurs' : 'servers'}`,
                    inline: true 
                },
                { 
                    name: t.users,
                    value: `\`${totalMembers.toLocaleString()}\` ${lang === 'fr' ? 'agents' : 'agents'}`,
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
                }
            )
            .setFooter({ text: `${t.footer} • v${version}` })
            .setTimestamp();
        
        // --- ADD API STATUS LINE ---
        aboutEmbed.addFields({
            name: lang === 'fr' ? '📡 ÉTAT DES API' : '📡 API STATUS',
            value: `\`\`\`yaml\nGroq LPU™: ${groqStatus}\nBrave Search: ${braveStatus}\nDiscord Gateway: ${ping}ms\`\`\``,
            inline: false
        });
        
        // --- ADD ARCHITECT SPECIAL MESSAGE ---
        if (isArchitect) {
            aboutEmbed.addFields({
                name: '🏛️ ARCHITECT ACCESS',
                value: `Welcome back, Creator. System is running at optimal efficiency.\nAll neural cores operational. Groq LPU™ inference engine active.`,
                inline: false
            });
        }
        
        // --- BUTTONS ROW ---
        const row = new ActionRowBuilder().addComponents(
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
                .setCustomId('invite_bot')
                .setLabel(lang === 'fr' ? 'Inviter le Bot' : 'Invite Bot')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🔗')
        );
        
        // --- SECOND ROW FOR SUPPORT ---
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('support_server')
                .setLabel(lang === 'fr' ? 'Serveur Support' : 'Support Server')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🆘'),
            new ButtonBuilder()
                .setCustomId('vote_bot')
                .setLabel(lang === 'fr' ? 'Voter pour le Bot' : 'Vote for Bot')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⭐'),
            new ButtonBuilder()
                .setCustomId('status_check')
                .setLabel(lang === 'fr' ? 'État Système' : 'System Status')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📊')
        );
        
        const reply = await message.reply({ embeds: [aboutEmbed], components: [row, row2] });
        
        // --- BUTTON COLLECTOR FOR INTERACTIVE BUTTONS ---
        const collector = reply.createMessageComponentCollector({ time: 60000 });
        
        collector.on('collect', async (interaction) => {
            if (interaction.user.id !== message.author.id) {
                return interaction.reply({ 
                    content: lang === 'fr' ? '❌ Ces contrôles sont verrouillés à votre session.' : '❌ These controls are locked to your session.', 
                    ephemeral: true 
                });
            }
            
            switch (interaction.customId) {
                case 'invite_bot':
                    const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`;
                    await interaction.reply({ 
                        content: lang === 'fr' 
                            ? `🔗 **Invitez ARCHITECT CG-223:**\n${inviteUrl}`
                            : `🔗 **Invite ARCHITECT CG-223:**\n${inviteUrl}`,
                        ephemeral: true 
                    });
                    break;
                    
                case 'support_server':
                    await interaction.reply({ 
                        content: lang === 'fr'
                            ? '🆘 **Serveur Support à venir!** Rejoignez notre communauté Eagle pour plus d\'informations.'
                            : '🆘 **Support Server Coming Soon!** Join our Eagle community for more info.',
                        ephemeral: true 
                    });
                    break;
                    
                case 'vote_bot':
                    await interaction.reply({ 
                        content: lang === 'fr'
                            ? '⭐ **Merci de votre soutien!** La fonctionnalité de vote sera disponible bientôt.'
                            : '⭐ **Thanks for your support!** Voting functionality will be available soon.',
                        ephemeral: true 
                    });
                    break;
                    
                case 'status_check':
                    const freshPing = Math.round(client.ws.ping);
                    const freshMemory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
                    await interaction.reply({ 
                        content: lang === 'fr'
                            ? `📊 **État Système en Direct**\n└─ Latence: \`${freshPing}ms\`\n└─ Mémoire: \`${freshMemory} MB\`\n└─ Groq: ${groqStatus}\n└─ Brave: ${braveStatus}`
                            : `📊 **Live System Status**\n└─ Latency: \`${freshPing}ms\`\n└─ Memory: \`${freshMemory} MB\`\n└─ Groq: ${groqStatus}\n└─ Brave: ${braveStatus}`,
                        ephemeral: true 
                    });
                    break;
            }
        });
        
        // --- LOG THE COMMAND USAGE ---
        console.log(`[ABOUT] ${message.author.tag} viewed system info | Lang: ${lang} | Version: ${version} | Groq: ${groqStatus} | Brave: ${braveStatus}`);
    }
};