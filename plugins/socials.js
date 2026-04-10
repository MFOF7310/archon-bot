const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        author: 'EAGLE COMMUNITY | UPLINK HUB',
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
        tipText: 'Click the buttons below to connect with us!'
    },
    fr: {
        author: 'EAGLE COMMUNITY | HUB DE CONNEXION',
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
        tipText: 'Cliquez sur les boutons ci-dessous pour vous connecter !'
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
            .addFields({
                name: '📍 NODE LOCATION',
                value: '```yaml\nBAMAKO, MALI 🇲🇱\nStatus: 🟢 ONLINE\nCore: Groq LPU™ 70B```',
                inline: false
            })
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
                .setEmoji('🔵')
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
                .setLabel('GitHub')
                .setURL(socialLinks.github)
                .setStyle(ButtonStyle.Link)
                .setEmoji('💻')
        );

        await message.reply({ 
            embeds: [socialEmbed], 
            components: [row1, row2] 
        }).catch(() => {});
    }
};