const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        title: '🔮 MYTHIC INVOCATION PORTAL',
        desc: 'Summon **ARCHITECT CG-223** to your realm!',
        botName: 'ARCHITECT CG-223',
        permissions: 'Administrator • Slash Commands',
        inviteHint: 'Click the button below to invite the Architect',
        inviteButton: '✨ INVITE NOW ✨',
        supportButton: '🏛️ COUNCIL CHAMBER',
        websiteButton: '🌐 ARCHIVE PORTAL',
        statsButton: '📊 REALM STATS',
        serverCount: 'Connected Realms',
        userCount: 'Agents Trained',
        commandCount: 'Arcane Spells',
        ping: 'Neural Latency',
        inviteSuccess: '✅ **Invocation Successful!**\nArchitect CG-223 has been summoned to your realm.',
        alreadyInServer: '⚠️ **Already Present**\nThe Architect already resides in this realm.',
        error: '❌ **Invocation Failed**\nCould not summon the Architect.',
        footer: 'Mythic Invocation • v{version}',
        supportServer: 'Join the Council',
        website: 'Documentation',
        viewStats: 'View Stats',
        surprise: '✨ *"The neural network acknowledges your presence..."* ✨'
    },
    fr: {
        title: '🔮 PORTAIL D\'INVOCATION MYTHIQUE',
        desc: 'Invoquez **ARCHITECT CG-223** dans votre royaume!',
        botName: 'ARCHITECTE CG-223',
        permissions: 'Administrateur • Commandes Slash',
        inviteHint: 'Cliquez sur le bouton ci-dessous pour inviter l\'Architecte',
        inviteButton: '✨ INVITER MAINTENANT ✨',
        supportButton: '🏛️ CHAMBRE DU CONSEIL',
        websiteButton: '🌐 PORTAIL DES ARCHIVES',
        statsButton: '📊 STATISTIQUES DU ROYAUME',
        serverCount: 'Royaumes Connectés',
        userCount: 'Agents Formés',
        commandCount: 'Sorts Arcane',
        ping: 'Latence Neurale',
        inviteSuccess: '✅ **Invocation Réussie!**\nL\'Architecte CG-223 a été invoqué dans votre royaume.',
        alreadyInServer: '⚠️ **Déjà Présent**\nL\'Architecte réside déjà dans ce royaume.',
        error: '❌ **Invocation Échouée**\nImpossible d\'invoquer l\'Architecte.',
        footer: 'Invocation Mythique • v{version}',
        supportServer: 'Rejoindre le Conseil',
        website: 'Documentation',
        viewStats: 'Voir les Stats',
        surprise: '✨ *"Le réseau neuronal reconnaît votre présence..."* ✨'
    }
};

// ================= MYTHIC QUOTES (SURPRISE!) =================
const MYTHIC_QUOTES = {
    en: [
        '⚡ "The neural network hums with anticipation..."',
        '🌀 "Reality bends to your will, summoner."',
        '🔮 "The Architect senses your call..."',
        '💠 "Quantum threads weave your invitation."',
        '🌟 "A new realm awaits the Architect\'s presence."',
        '🎭 "Your server shall be touched by digital divinity."',
        '✨ "The stars align for this invocation."'
    ],
    fr: [
        '⚡ "Le réseau neuronal bourdonne d\'anticipation..."',
        '🌀 "La réalité se plie à votre volonté, invocateur."',
        '🔮 "L\'Architecte sent votre appel..."',
        '💠 "Des fils quantiques tissent votre invitation."',
        '🌟 "Un nouveau royaume attend la présence de l\'Architecte."',
        '🎭 "Votre serveur sera touché par la divinité numérique."',
        '✨ "Les étoiles s\'alignent pour cette invocation."'
    ]
};

module.exports = {
    name: 'invite',
    aliases: ['inv', 'link', 'inviter', 'lien', 'summon', 'invoke'],
    description: '🔗 Get the invite link for the bot with mythic presentation.',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.invite',
    examples: ['.invite', '.summon'],

    // ================= SLASH COMMAND DATA =================
    data: new SlashCommandBuilder()
        .setName('invite')
        .setDescription('🔮 Summon ARCHITECT CG-223 to your server!'),

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage?.(usedCommand, 'en') || 'en';
        const t = translations[lang];
        const version = client.version || '1.8.0';
        
        // ================= SURPRISE: Random Mythic Quote =================
        const quotes = MYTHIC_QUOTES[lang];
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        
        // ================= Check if bot is already in the server =================
        const isInServer = message.guild && client.guilds.cache.has(message.guild.id);
        
        // ================= Build Invite URL =================
        const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`;
        const supportUrl = 'https://discord.gg/NFSMFJajp9';
        const websiteUrl = 'https://github.com/MFOF7310';
        
        // ================= System Stats =================
        const totalGuilds = client.guilds.cache.size;
        const totalUsers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
        const totalCommands = client.commands?.size || 0;
        const ping = Math.round(client.ws.ping);
        
        // ================= Determine embed color based on ping =================
        let embedColor = '#2ecc71';
        let statusEmoji = '🟢';
        if (ping > 250) {
            embedColor = '#e74c3c';
            statusEmoji = '🔴';
        } else if (ping > 100) {
            embedColor = '#f1c40f';
            statusEmoji = '🟡';
        }
        
        // ================= BUILD MYTHIC EMBED =================
        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setAuthor({ 
                name: t.title, 
                iconURL: client.user.displayAvatarURL({ dynamic: true }),
                url: websiteUrl
            })
            .setTitle(`✨ ${t.desc} ✨`)
            .setDescription(`\`\`\`yaml\n${randomQuote}\n\`\`\``)
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 512 }))
            .addFields(
                { 
                    name: '📜 **ABOUT THE ARCHITECT**',
                    value: `\`\`\`yaml\nName: ${t.botName}\nPermissions: ${t.permissions}\nStatus: ${statusEmoji} ${ping < 100 ? 'OPTIMAL' : (ping < 250 ? 'STABLE' : 'WEAKENING')}\`\`\``,
                    inline: false
                },
                { 
                    name: '🌍 **REALM STATISTICS**',
                    value: `\`\`\`yaml\n${t.serverCount}: ${totalGuilds}\n${t.userCount}: ${totalUsers.toLocaleString()}\n${t.commandCount}: ${totalCommands}\n${t.ping}: ${ping}ms\`\`\``,
                    inline: false
                },
                { 
                    name: '🔮 **INVOCATION RITUAL**',
                    value: t.inviteHint,
                    inline: false
                }
            )
            .setFooter({ text: t.footer.replace('{version}', version), iconURL: message.guild?.iconURL() || client.user.displayAvatarURL() })
            .setTimestamp();
        
        // ================= SURPRISE: Show "already in server" message if applicable =================
        if (isInServer && message.guild) {
            embed.addFields({
                name: '⚠️ REALM STATUS',
                value: t.alreadyInServer,
                inline: false
            });
        }
        
        // ================= BUTTON ROWS =================
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel(t.inviteButton)
                .setURL(inviteUrl)
                .setStyle(ButtonStyle.Link)
                .setEmoji('✨'),
            new ButtonBuilder()
                .setLabel(t.supportButton)
                .setURL(supportUrl)
                .setStyle(ButtonStyle.Link)
                .setEmoji('🏛️')
        );
        
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel(t.websiteButton)
                .setURL(websiteUrl)
                .setStyle(ButtonStyle.Link)
                .setEmoji('🌐'),
            new ButtonBuilder()
                .setCustomId('invite_stats')
                .setLabel(t.statsButton)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📊')
        );
        
        const reply = await message.reply({ 
            embeds: [embed], 
            components: [row1, row2] 
        }).catch(() => {});
        
        if (!reply) return;
        
        // ================= BUTTON COLLECTOR FOR STATS =================
        const collector = reply.createMessageComponentCollector({ time: 60000 });
        
        collector.on('collect', async (interaction) => {
            if (interaction.user.id !== message.author.id) {
                return interaction.reply({ 
                    content: '❌ This menu is locked to your session.', 
                    ephemeral: true 
                }).catch(() => {});
            }
            
            if (interaction.customId === 'invite_stats') {
                const freshPing = Math.round(client.ws.ping);
                const freshGuilds = client.guilds.cache.size;
                const freshUsers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
                const freshCommands = client.commands?.size || 0;
                const uptime = process.uptime();
                const uptimeDays = Math.floor(uptime / 86400);
                const uptimeHours = Math.floor((uptime % 86400) / 3600);
                const uptimeMinutes = Math.floor((uptime % 3600) / 60);
                
                const statsEmbed = new EmbedBuilder()
                    .setColor('#9b59b6')
                    .setTitle('📊 **REALM TELEMETRY**')
                    .setDescription(`\`\`\`yaml\n${t.surprise}\n\`\`\``)
                    .addFields(
                        { name: '🌍 Connected Realms', value: `\`${freshGuilds}\``, inline: true },
                        { name: '👥 Total Agents', value: `\`${freshUsers.toLocaleString()}\``, inline: true },
                        { name: '⚡ Arcane Spells', value: `\`${freshCommands}\``, inline: true },
                        { name: '🕐 Uptime', value: `\`${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m\``, inline: true },
                        { name: '⚡ Neural Latency', value: `\`${freshPing}ms\``, inline: true },
                        { name: '💾 Memory Usage', value: `\`${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\``, inline: true }
                    )
                    .setFooter({ text: t.footer.replace('{version}', version) })
                    .setTimestamp();
                
                await interaction.reply({ embeds: [statsEmbed], ephemeral: true }).catch(() => {});
            }
        });
        
        console.log(`[INVITE] ${message.author.tag} used invite command | Lang: ${lang}`);
    },

    // ================= SLASH COMMAND EXECUTION =================
    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = translations[lang];
        const version = client.version || '1.8.0';
        
        // Surprise random quote
        const quotes = MYTHIC_QUOTES[lang];
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        
        const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`;
        const supportUrl = 'https://discord.gg/NFSMFJajp9';
        const websiteUrl = 'https://github.com/MFOF7310';
        
        const totalGuilds = client.guilds.cache.size;
        const totalUsers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
        const totalCommands = client.commands?.size || 0;
        const ping = Math.round(client.ws.ping);
        
        let embedColor = '#2ecc71';
        let statusEmoji = '🟢';
        if (ping > 250) {
            embedColor = '#e74c3c';
            statusEmoji = '🔴';
        } else if (ping > 100) {
            embedColor = '#f1c40f';
            statusEmoji = '🟡';
        }
        
        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setAuthor({ name: t.title, iconURL: client.user.displayAvatarURL(), url: websiteUrl })
            .setTitle(`✨ ${t.desc} ✨`)
            .setDescription(`\`\`\`yaml\n${randomQuote}\n\`\`\``)
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 512 }))
            .addFields(
                { name: '📜 **ABOUT THE ARCHITECT**', value: `\`\`\`yaml\nName: ${t.botName}\nPermissions: ${t.permissions}\nStatus: ${statusEmoji} ${ping < 100 ? 'OPTIMAL' : (ping < 250 ? 'STABLE' : 'WEAKENING')}\`\`\``, inline: false },
                { name: '🌍 **REALM STATISTICS**', value: `\`\`\`yaml\n${t.serverCount}: ${totalGuilds}\n${t.userCount}: ${totalUsers.toLocaleString()}\n${t.commandCount}: ${totalCommands}\n${t.ping}: ${ping}ms\`\`\``, inline: false },
                { name: '🔮 **INVOCATION RITUAL**', value: t.inviteHint, inline: false }
            )
            .setFooter({ text: t.footer.replace('{version}', version), iconURL: interaction.guild?.iconURL() || client.user.displayAvatarURL() })
            .setTimestamp();
        
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel(t.inviteButton).setURL(inviteUrl).setStyle(ButtonStyle.Link).setEmoji('✨'),
            new ButtonBuilder().setLabel(t.supportButton).setURL(supportUrl).setStyle(ButtonStyle.Link).setEmoji('🏛️')
        );
        
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel(t.websiteButton).setURL(websiteUrl).setStyle(ButtonStyle.Link).setEmoji('🌐'),
            new ButtonBuilder().setCustomId('invite_stats_slash').setLabel(t.statsButton).setStyle(ButtonStyle.Secondary).setEmoji('📊')
        );
        
        await interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: false });
        
        const collector = interaction.channel.createMessageComponentCollector({ 
            filter: i => i.user.id === interaction.user.id && i.customId === 'invite_stats_slash',
            time: 60000,
            max: 1
        });
        
        collector.on('collect', async (btnInteraction) => {
            const freshPing = Math.round(client.ws.ping);
            const freshGuilds = client.guilds.cache.size;
            const freshUsers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
            const freshCommands = client.commands?.size || 0;
            const uptime = process.uptime();
            const uptimeDays = Math.floor(uptime / 86400);
            const uptimeHours = Math.floor((uptime % 86400) / 3600);
            const uptimeMinutes = Math.floor((uptime % 3600) / 60);
            
            const statsEmbed = new EmbedBuilder()
                .setColor('#9b59b6')
                .setTitle('📊 **REALM TELEMETRY**')
                .setDescription(`\`\`\`yaml\n${t.surprise}\n\`\`\``)
                .addFields(
                    { name: '🌍 Connected Realms', value: `\`${freshGuilds}\``, inline: true },
                    { name: '👥 Total Agents', value: `\`${freshUsers.toLocaleString()}\``, inline: true },
                    { name: '⚡ Arcane Spells', value: `\`${freshCommands}\``, inline: true },
                    { name: '🕐 Uptime', value: `\`${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m\``, inline: true },
                    { name: '⚡ Neural Latency', value: `\`${freshPing}ms\``, inline: true },
                    { name: '💾 Memory Usage', value: `\`${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\``, inline: true }
                )
                .setFooter({ text: t.footer.replace('{version}', version) })
                .setTimestamp();
            
            await btnInteraction.reply({ embeds: [statsEmbed], ephemeral: true }).catch(() => {});
        });
        
        console.log(`[INVITE] ${interaction.user.tag} used slash invite | Lang: ${lang}`);
    }
};