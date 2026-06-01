const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        title: '🛰️ ARCHITECT CG-223 | EXECUTIVE HUB',
        description: 'Community management and support frequency active.',
        facebook: 'Facebook',
        facebookDesc: 'Community Hub',
        tiktok: 'TikTok',
        tiktokDesc: 'Live Streams & Clips',
        instagram: 'Instagram',
        instagramDesc: 'Gameplay Intel',
        discord: 'Discord',
        discordDesc: 'Join our Server',
        whatsapp: 'WhatsApp',
        whatsappDesc: 'Direct Support',
        github: 'GitHub',
        githubDesc: 'Open Source',
        node: 'Node',
        status: 'Status',
        active: 'ACTIVE',
        footer: 'EAGLE COMMUNITY • DIGITAL SOVEREIGNTY',
        securityBreach: '⛔ **SECURITY BREACH:** Executive Hub restricted to system Owner.',
        accessGranted: '🔓 **ACCESS GRANTED:** Welcome, Architect.',
        quickLinks: 'QUICK LINKS',
        socialLinks: 'SOCIAL LINKS'
    },
    fr: {
        title: '🛰️ ARCHITECT CG-223 | HUB EXÉCUTIF',
        description: 'Gestion communautaire et fréquence de support active.',
        facebook: 'Facebook',
        facebookDesc: 'Hub Communautaire',
        tiktok: 'TikTok',
        tiktokDesc: 'Streams & Clips',
        instagram: 'Instagram',
        instagramDesc: 'Intel Gameplay',
        discord: 'Discord',
        discordDesc: 'Rejoindre le Serveur',
        whatsapp: 'WhatsApp',
        whatsappDesc: 'Support Direct',
        github: 'GitHub',
        githubDesc: 'Open Source',
        node: 'Nœud',
        status: 'Statut',
        active: 'ACTIF',
        footer: 'EAGLE COMMUNITY • SOUVERAINETÉ NUMÉRIQUE',
        securityBreach: '⛔ **VIOLATION DE SÉCURITÉ:** Hub Exécutif réservé au Propriétaire.',
        accessGranted: '🔓 **ACCÈS AUTORISÉ:** Bienvenue, Architecte.',
        quickLinks: 'LIENS RAPIDES',
        socialLinks: 'LIENS SOCIAUX'
    }
};

module.exports = {
    name: 'owner',
    aliases: ['exec', 'admin', 'architect', 'hub', 'proprietaire', 'adminhub'],
    description: '👑 Executive links and system hub (restricted to owner).',
    category: 'OWNER',
    cooldown: 3000,
    usage: '.owner',
    examples: ['.owner', '.hub', '.exec'],

// ================= SLASH COMMAND DATA =================
data: new SlashCommandBuilder()
    .setName('owner')
    .setDescription('👑 Executive links and system hub (restricted to owner)'),

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
        const ARCHITECT_ID = process.env.OWNER_ID;
        
        // ================= SECURITY CHECK =================
        if (message.author.id !== ARCHITECT_ID) {
            console.log(`[SECURITY] Unauthorized owner command attempt by ${message.author.tag} (${message.author.id})`);
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setDescription(t.securityBreach)
                .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            return message.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
        }

        // ================= SOCIAL LINKS =================
        const socialLinks = {
            facebook: 'https://www.facebook.com/share/17KysmJrtm/',
            tiktok: 'https://www.tiktok.com/@cloudgaming223',
            instagram: 'https://www.instagram.com/mfof7310',
            discord: 'https://discord.gg/NFSMFJajp9',
            whatsapp: 'https://wa.me/15485200518',
            github: 'https://github.com/MFOF7310'
        };
        
        // ================= MAIN EMBED =================
        const ownerEmbed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setAuthor({ 
                name: t.title, 
                iconURL: client.user.displayAvatarURL() 
            })
            .setTitle(`👑 ${t.accessGranted}`)
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 512 }))
            .setDescription(
                `\`\`\`yaml\n` +
                `${t.node}: BAMAKO-223\n` +
                `${t.status}: ${t.active}\n` +
                `Core: Groq LPU™ 70B\n` +
                `\`\`\`\n` +
                `*${t.description}*`
            )
            .addFields(
                { 
                    name: `🔵 ${t.facebook}`, 
                    value: `\`${t.facebookDesc}\``, 
                    inline: true 
                },
                { 
                    name: `🎬 ${t.tiktok}`, 
                    value: `\`${t.tiktokDesc}\``, 
                    inline: true 
                },
                { 
                    name: `📸 ${t.instagram}`, 
                    value: `\`${t.instagramDesc}\``, 
                    inline: true 
                },
                { 
                    name: `🎮 ${t.discord}`, 
                    value: `\`${t.discordDesc}\``, 
                    inline: true 
                },
                { 
                    name: `💬 ${t.whatsapp}`, 
                    value: `\`${t.whatsappDesc}\``, 
                    inline: true 
                },
                { 
                    name: `💻 ${t.github}`, 
                    value: `\`${t.githubDesc}\``, 
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
                .setLabel(t.facebook)
                .setURL(socialLinks.facebook)
                .setStyle(ButtonStyle.Link)
                .setEmoji('🔵'),
            new ButtonBuilder()
                .setLabel(t.tiktok)
                .setURL(socialLinks.tiktok)
                .setStyle(ButtonStyle.Link)
                .setEmoji('🎬'),
            new ButtonBuilder()
                .setLabel(t.instagram)
                .setURL(socialLinks.instagram)
                .setStyle(ButtonStyle.Link)
                .setEmoji('📸')
        );
        
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel(t.discord)
                .setURL(socialLinks.discord)
                .setStyle(ButtonStyle.Link)
                .setEmoji('🎮'),
            new ButtonBuilder()
                .setLabel(t.whatsapp)
                .setURL(socialLinks.whatsapp)
                .setStyle(ButtonStyle.Link)
                .setEmoji('💬'),
            new ButtonBuilder()
                .setLabel(t.github)
                .setURL(socialLinks.github)
                .setStyle(ButtonStyle.Link)
                .setEmoji('💻')
        );

        await message.reply({ 
            embeds: [ownerEmbed], 
            components: [row1, row2] 
        }).catch(() => {});
        
                console.log(`[OWNER] ${message.author.tag} accessed executive hub | Lang: ${lang}`);
    },

    // ================= SLASH COMMAND EXECUTION =================
    execute: async (interaction, client) => {
        // Security check for slash command
        const ARCHITECT_ID = process.env.OWNER_ID;
        if (interaction.user.id !== ARCHITECT_ID) {
            const lang = client.detectLanguage ? client.detectLanguage('owner', 'en') : 'en';
            const t = translations[lang];
            const version = client.version || '1.7.0';
            const guildName = interaction.guild?.name?.toUpperCase() || 'NEURAL NODE';
            const guildIcon = interaction.guild?.iconURL() || client.user.displayAvatarURL();
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setDescription(t.securityBreach)
                .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
        }
        
        // Simulate message object
        const fakeMessage = {
            author: interaction.user,
            guild: interaction.guild,
            channel: interaction.channel,
            reply: async (options) => {
                if (interaction.deferred) return interaction.editReply(options);
                return interaction.reply(options);
            },
            react: () => Promise.resolve()
        };
        
        const serverSettings = interaction.guild ? client.getServerSettings(interaction.guild.id) : { prefix: '.' };
        
        await module.exports.run(client, fakeMessage, [], client.db, serverSettings, 'owner');
    }
};