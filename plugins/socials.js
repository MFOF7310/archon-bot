const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        author: '🦅 EAGLE COMMUNITY | NEURAL UPLINK',
        title: '🔗 CONNECT WITH THE ARCHITECT',
        description: 'Join our digital network for the latest CODM meta, live streams, and community events directly from **Bamako, Mali**.',
        tiktok: '🎬 TikTok',
        tiktokDesc: 'Live Streams & Clips',
        instagram: '📸 Instagram',
        instagramDesc: 'Gameplay Intel',
        facebook: '🔵 Facebook',
        facebookDesc: 'Community Hub',
        whatsapp: '💬 WhatsApp',
        whatsappDesc: 'Direct Support',
        discord: '🎮 Discord',
        discordDesc: 'Join our Server',
        github: '💻 GitHub',
        githubDesc: 'Open Source',
        footer: 'Eagle Community • Digital Sovereignty 🇲🇱',
        tip: '💡 TIP',
        tipText: 'Click the buttons below to connect with us!',
        nodeLocation: '📍 NODE LOCATION',
        nodeStatus: '```yaml\nBAMAKO, MALI 🇲🇱\nStatus: 🟢 ONLINE\nCore: Groq LPU™ 70B\nPing: {ping}ms```',
        quickStats: '📊 QUICK STATS',
        members: 'Members',
        servers: 'Servers',
        commands: 'Commands',
        uptime: 'Uptime',
        voteLink: '🗳️ Vote for Us',
        voteDesc: 'Support on Top.gg',
        inviteLink: '🔗 Invite Bot',
        inviteDesc: 'Add to your server'
    },
    fr: {
        author: '🦅 EAGLE COMMUNITY | HUB NEURAL',
        title: '🔗 CONNECTEZ-VOUS À L\'ARCHITECTE',
        description: 'Rejoignez notre réseau numérique pour les dernières méta CODM, streams en direct et événements communautaires depuis **Bamako, Mali**.',
        tiktok: '🎬 TikTok',
        tiktokDesc: 'Streams & Clips',
        instagram: '📸 Instagram',
        instagramDesc: 'Intel Gameplay',
        facebook: '🔵 Facebook',
        facebookDesc: 'Hub Communautaire',
        whatsapp: '💬 WhatsApp',
        whatsappDesc: 'Support Direct',
        discord: '🎮 Discord',
        discordDesc: 'Rejoindre le Serveur',
        github: '💻 GitHub',
        githubDesc: 'Open Source',
        footer: 'Eagle Community • Souveraineté Numérique 🇲🇱',
        tip: '💡 ASTUCE',
        tipText: 'Cliquez sur les boutons ci-dessous pour vous connecter !',
        nodeLocation: '📍 LOCALISATION DU NŒUD',
        nodeStatus: '```yaml\nBAMAKO, MALI 🇲🇱\nStatut: 🟢 EN LIGNE\nNoyau: Groq LPU™ 70B\nPing: {ping}ms```',
        quickStats: '📊 STATS RAPIDES',
        members: 'Membres',
        servers: 'Serveurs',
        commands: 'Commandes',
        uptime: 'Disponibilité',
        voteLink: '🗳️ Voter pour Nous',
        voteDesc: 'Soutenir sur Top.gg',
        inviteLink: '🔗 Inviter le Bot',
        inviteDesc: 'Ajouter à votre serveur'
    }
};

module.exports = {
    name: 'socials',
    aliases: ['social', 'links', 'connect', 'contact', 'reseaux', 'sociaux'],
    description: '🔗 Display official social media links and community hubs.',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.socials',
    examples: ['.socials', '.reseaux'],

    // ================= SLASH COMMAND DATA =================
    data: new SlashCommandBuilder()
        .setName('socials')
        .setDescription('🔗 Display official social media links / Afficher les liens sociaux'),

    // 🔥 NEW SIGNATURE: 6 parameters with usedCommand
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        
        // 🔥 NEURAL LANGUAGE BRIDGE - Alias-based detection!
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, 'en')
            : 'en';
        
        const t = translations[lang];
        const version = client.version || '1.8.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        const ping = Math.round(client.ws.ping);
        
        // ================= QUICK STATS =================
        const totalMembers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
        const totalGuilds = client.guilds.cache.size;
        const totalCommands = client.commands?.size || 0;
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const uptimeStr = days > 0 ? `${days}j ${hours}h` : `${hours}h ${Math.floor((uptime % 3600) / 60)}m`;
        
        // ================= SOCIAL LINKS =================
        const socialLinks = {
            tiktok: 'https://www.tiktok.com/@cloudgaming223',
            facebook: 'https://www.facebook.com/share/17KysmJrtm/',
            instagram: 'https://www.instagram.com/mfof7310',
            whatsapp: 'https://wa.me/15485200518',
            discord: 'https://discord.gg/NFSMFJajp9',
            github: 'https://github.com/MFOF7310'
        };
        
        // ================= MAIN EMBED =================
        const socialEmbed = new EmbedBuilder()
            .setColor('#00acee')
            .setAuthor({ 
                name: t.author, 
                iconURL: client.user.displayAvatarURL() 
            })
            .setTitle(t.title)
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 512 }))
            .setDescription(
                `${t.description}\n\n` +
                `**${t.tip}:** ${t.tipText}`
            )
            .addFields(
                { 
                    name: t.tiktok, 
                    value: `\`${t.tiktokDesc}\`\n└─ @cloudgaming223`, 
                    inline: true 
                },
                { 
                    name: t.instagram, 
                    value: `\`${t.instagramDesc}\`\n└─ @mfof7310`, 
                    inline: true 
                },
                { 
                    name: t.facebook, 
                    value: `\`${t.facebookDesc}\`\n└─ Eagle Community`, 
                    inline: true 
                },
                { 
                    name: t.whatsapp, 
                    value: `\`${t.whatsappDesc}\`\n└─ +1 (548) 520-0518`, 
                    inline: true 
                },
                { 
                    name: t.discord, 
                    value: `\`${t.discordDesc}\`\n└─ discord.gg/eaglecommunity`, 
                    inline: true 
                },
                { 
                    name: t.github, 
                    value: `\`${t.githubDesc}\`\n└─ github.com/MFOF7310`, 
                    inline: true 
                }
            )
            .addFields(
                {
                    name: t.nodeLocation,
                    value: t.nodeStatus.replace('{ping}', ping),
                    inline: false
                },
                {
                    name: `📊 ${t.quickStats}`,
                    value: `\`\`\`yaml\n${t.members}: ${totalMembers.toLocaleString()}\n${t.servers}: ${totalGuilds}\n${t.commands}: ${totalCommands}\n${t.uptime}: ${uptimeStr}\`\`\``,
                    inline: true
                },
                {
                    name: '🔗 ' + (lang === 'fr' ? 'LIENS RAPIDES' : 'QUICK LINKS'),
                    value: `\`\`\`yaml\n${t.voteLink}: Top.gg\n${t.inviteLink}: Discord\nSupport: WhatsApp\`\`\``,
                    inline: true
                }
            )
            .setFooter({ 
                text: `${guildName} • ${t.footer} • v${version}`, 
                iconURL: guildIcon 
            })
            .setTimestamp();

        // ================= BUTTON ROWS =================
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('TikTok')
                .setURL(socialLinks.tiktok)
                .setStyle(ButtonStyle.Link)
                .setEmoji('🎬'),
            new ButtonBuilder()
                .setLabel('Instagram')
                .setURL(socialLinks.instagram)
                .setStyle(ButtonStyle.Link)
                .setEmoji('📸'),
            new ButtonBuilder()
                .setLabel('Facebook')
                .setURL(socialLinks.facebook)
                .setStyle(ButtonStyle.Link)
                .setEmoji('🔵'),
            new ButtonBuilder()
                .setLabel('GitHub')
                .setURL(socialLinks.github)
                .setStyle(ButtonStyle.Link)
                .setEmoji('💻')
        );
        
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('WhatsApp')
                .setURL(socialLinks.whatsapp)
                .setStyle(ButtonStyle.Link)
                .setEmoji('💬'),
            new ButtonBuilder()
                .setLabel('Discord')
                .setURL(socialLinks.discord)
                .setStyle(ButtonStyle.Link)
                .setEmoji('🎮'),
            new ButtonBuilder()
                .setCustomId('socials_stats')
                .setLabel(lang === 'fr' ? '📊 Stats' : '📊 Stats')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📊'),
            new ButtonBuilder()
                .setCustomId('socials_invite')
                .setLabel(lang === 'fr' ? '🔗 Inviter' : '🔗 Invite')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🔗')
        );

        const reply = await message.reply({ 
            embeds: [socialEmbed], 
            components: [row1, row2] 
        }).catch(() => {});
        
        if (!reply) return;
        
        // ================= BUTTON COLLECTOR =================
        const collector = reply.createMessageComponentCollector({ time: 60000 });
        
        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) {
                return i.reply({ 
                    content: lang === 'fr' ? '❌ Ce menu ne vous appartient pas.' : '❌ This menu is not yours.', 
                    ephemeral: true 
                });
            }
            
            if (i.customId === 'socials_stats') {
                const freshPing = Math.round(client.ws.ping);
                const freshUptime = process.uptime();
                const freshDays = Math.floor(freshUptime / 86400);
                const freshHours = Math.floor((freshUptime % 86400) / 3600);
                const freshUptimeStr = freshDays > 0 ? `${freshDays}j ${freshHours}h` : `${freshHours}h ${Math.floor((freshUptime % 3600) / 60)}m`;
                
                const statsEmbed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setAuthor({ name: '📊 LIVE SYSTEM STATS', iconURL: client.user.displayAvatarURL() })
                    .setDescription(
                        `\`\`\`yaml\n` +
                        `🏠 Servers: ${client.guilds.cache.size}\n` +
                        `👥 Users: ${client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0).toLocaleString()}\n` +
                        `⚡ Ping: ${freshPing}ms\n` +
                        `⏱️ Uptime: ${freshUptimeStr}\n` +
                        `💾 Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\n` +
                        `\`\`\``
                    )
                    .setFooter({ text: `ARCHITECT CG-223 • v${version}` })
                    .setTimestamp();
                
                await i.reply({ embeds: [statsEmbed], ephemeral: true });
            }
            
            if (i.customId === 'socials_invite') {
                const inviteEmbed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setAuthor({ name: '🔗 INVITE ARCHITECT CG-223', iconURL: client.user.displayAvatarURL() })
                    .setDescription(
                        `**Add the bot to your server!**\n\n` +
                        `🔗 **Invite Link:**\nhttps://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands\n\n` +
                        `✨ **Features:**\n` +
                        `• AI Chat (Lydia)\n` +
                        `• Economy System\n` +
                        `• Moderation Tools\n` +
                        `• Gaming Commands\n` +
                        `• And much more!`
                    )
                    .setFooter({ text: `ARCHITECT CG-223 • v${version}` })
                    .setTimestamp();
                
                await i.reply({ embeds: [inviteEmbed], ephemeral: true });
            }
        });

        console.log(`[SOCIALS] ${message.author.tag} viewed social links | Lang: ${lang}`);
    },

    // ================= SLASH COMMAND EXECUTION (LEGENDARY DM FALLBACK) =================
    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = translations[lang];
        const version = client.version || '1.8.0';
        
        // 🔥 LEGENDARY DM FALLBACK - Works perfectly in DMs!
        await interaction.deferReply();
        
        const ping = Math.round(client.ws.ping);
        const totalMembers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
        const totalGuilds = client.guilds.cache.size;
        const totalCommands = client.commands?.size || 0;
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const uptimeStr = days > 0 ? `${days}j ${hours}h` : `${hours}h ${Math.floor((uptime % 3600) / 60)}m`;
        
        const socialLinks = {
            tiktok: 'https://www.tiktok.com/@cloudgaming223',
            facebook: 'https://www.facebook.com/share/17KysmJrtm/',
            instagram: 'https://www.instagram.com/mfof7310',
            whatsapp: 'https://wa.me/15485200518',
            discord: 'https://discord.gg/NFSMFJajp9',
            github: 'https://github.com/MFOF7310'
        };
        
        const socialEmbed = new EmbedBuilder()
            .setColor('#00acee')
            .setAuthor({ 
                name: interaction.guild ? t.author : (lang === 'fr' ? '🦅 EAGLE COMMUNITY | CONNEXION DM' : '🦅 EAGLE COMMUNITY | DM CONNECTION'), 
                iconURL: client.user.displayAvatarURL() 
            })
            .setTitle(t.title)
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 512 }))
            .setDescription(
                `${t.description}\n\n` +
                `**${t.tip}:** ${t.tipText}`
            )
            .addFields(
                { name: t.tiktok, value: `\`${t.tiktokDesc}\`\n└─ @cloudgaming223`, inline: true },
                { name: t.instagram, value: `\`${t.instagramDesc}\`\n└─ @mfof7310`, inline: true },
                { name: t.facebook, value: `\`${t.facebookDesc}\`\n└─ Eagle Community`, inline: true },
                { name: t.whatsapp, value: `\`${t.whatsappDesc}\`\n└─ +1 (548) 520-0518`, inline: true },
                { name: t.discord, value: `\`${t.discordDesc}\`\n└─ discord.gg/eaglecommunity`, inline: true },
                { name: t.github, value: `\`${t.githubDesc}\`\n└─ github.com/MFOF7310`, inline: true }
            )
            .addFields(
                {
                    name: t.nodeLocation,
                    value: t.nodeStatus.replace('{ping}', ping),
                    inline: false
                },
                {
                    name: `📊 ${t.quickStats}`,
                    value: `\`\`\`yaml\n${t.members}: ${totalMembers.toLocaleString()}\n${t.servers}: ${totalGuilds}\n${t.commands}: ${totalCommands}\n${t.uptime}: ${uptimeStr}\`\`\``,
                    inline: true
                }
            )
            .setFooter({ 
                text: `${interaction.guild?.name?.toUpperCase() || 'NEURAL NODE'} • ${t.footer} • v${version}`, 
                iconURL: interaction.guild?.iconURL() || client.user.displayAvatarURL() 
            })
            .setTimestamp();

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('TikTok').setURL(socialLinks.tiktok).setStyle(ButtonStyle.Link).setEmoji('🎬'),
            new ButtonBuilder().setLabel('Instagram').setURL(socialLinks.instagram).setStyle(ButtonStyle.Link).setEmoji('📸'),
            new ButtonBuilder().setLabel('Facebook').setURL(socialLinks.facebook).setStyle(ButtonStyle.Link).setEmoji('🔵'),
            new ButtonBuilder().setLabel('GitHub').setURL(socialLinks.github).setStyle(ButtonStyle.Link).setEmoji('💻')
        );
        
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('WhatsApp').setURL(socialLinks.whatsapp).setStyle(ButtonStyle.Link).setEmoji('💬'),
            new ButtonBuilder().setLabel('Discord').setURL(socialLinks.discord).setStyle(ButtonStyle.Link).setEmoji('🎮')
        );

        await interaction.editReply({ embeds: [socialEmbed], components: [row1, row2] });
        
        console.log(`[SOCIALS] ${interaction.user.tag} viewed social links via slash | Lang: ${lang}`);
    }
};