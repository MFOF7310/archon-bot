const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        title: '📡 NEURAL TRANSMISSION',
        sending: '🛰️ TRANSMITTING',
        delivered: '✅ TRANSMISSION DELIVERED',
        failed: '❌ TRANSMISSION FAILED',
        usage: (prefix) => `❌ **Usage:** \`${prefix}contact [message]\`\n\n**Example:**\n\`${prefix}contact Hello Architect! I have a suggestion...\``,
        architectUnavailable: '⚠️ **Architect ID not configured.**\nContact the owner manually.',
        linkFailure: '❌ **Link Failure:** Architect secure line is currently closed.',
        deliveredMsg: '🛰️ **Transmission delivered to the Architect.**\nThank you for your feedback!',
        incomingTitle: '📥 INCOMING NEURAL TRANSMISSION',
        from: 'From',
        sourceServer: 'Source Server',
        channel: 'Channel',
        messageContent: 'Message Content',
        directMessage: 'Direct Message',
        userInfo: 'User Information',
        userTag: 'Tag',
        userID: 'ID',
        accountCreated: 'Account Created',
        footer: 'ARCHITECT CG-223 • Neural Contact System',
        confirmTitle: '📋 CONFIRM TRANSMISSION',
        confirmDesc: (feedback) => `You are about to send the following message to the Architect:\n\n\`\`\`\n${feedback}\`\`\``,
        confirm: '✅ Send',
        cancel: '❌ Cancel',
        cancelled: '❌ **Transmission cancelled.**',
        timeout: '⏰ **Transmission timed out.**',
        processing: '📡 Processing transmission...'
    },
    fr: {
        title: '📡 TRANSMISSION NEURALE',
        sending: '🛰️ TRANSMISSION',
        delivered: '✅ TRANSMISSION LIVRÉE',
        failed: '❌ TRANSMISSION ÉCHOUÉE',
        usage: (prefix) => `❌ **Utilisation:** \`${prefix}contact [message]\`\n\n**Exemple:**\n\`${prefix}contact Bonjour Architecte! J'ai une suggestion...\``,
        architectUnavailable: '⚠️ **ID de l\'Architecte non configuré.**\nContactez le propriétaire manuellement.',
        linkFailure: '❌ **Échec de Liaison:** La ligne sécurisée de l\'Architecte est fermée.',
        deliveredMsg: '🛰️ **Transmission livrée à l\'Architecte.**\nMerci pour votre retour!',
        incomingTitle: '📥 TRANSMISSION NEURALE ENTRANTE',
        from: 'De',
        sourceServer: 'Serveur Source',
        channel: 'Canal',
        messageContent: 'Contenu du Message',
        directMessage: 'Message Direct',
        userInfo: 'Information Utilisateur',
        userTag: 'Pseudo',
        userID: 'ID',
        accountCreated: 'Compte Créé',
        footer: 'ARCHITECT CG-223 • Système de Contact Neural',
        confirmTitle: '📋 CONFIRMER LA TRANSMISSION',
        confirmDesc: (feedback) => `Vous allez envoyer le message suivant à l\'Architecte:\n\n\`\`\`\n${feedback}\`\`\``,
        confirm: '✅ Envoyer',
        cancel: '❌ Annuler',
        cancelled: '❌ **Transmission annulée.**',
        timeout: '⏰ **Transmission expirée.**',
        processing: '📡 Traitement de la transmission...'
    }
};

module.exports = {
    name: 'contact',
    aliases: ['feedback', 'report', 'suggest', 'msg', 'contacter', 'messagearchitecte'],
    description: '📡 Send a direct message to the Architect (bot owner).',
    category: 'SYSTEM',
    cooldown: 30000, // 30 second cooldown to prevent spam
    usage: '.contact [message]',
    examples: ['.contact Hello! I have a suggestion...', '.contact There\'s a bug in the shop command.'],

    run: async (client, message, args, database, serverSettings, usedCommand) => {
        
        // ================= LANGUAGE SETUP =================
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, serverSettings?.language || 'en')
            : (serverSettings?.language || 'en');
        const t = translations[lang];
        
        // ✅ DYNAMIC VERSION
        const version = client.version || '1.5.0';
        const prefix = serverSettings?.prefix || process.env.PREFIX || '.';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();

        // ================= VALIDATION =================
        const feedback = args.join(' ');
        if (!feedback) {
            return message.reply({ content: t.usage(prefix), ephemeral: true });
        }

        // Check message length
        if (feedback.length > 1900) {
            return message.reply({ 
                content: lang === 'fr' 
                    ? '❌ **Message trop long.**\nMaximum 1900 caractères.' 
                    : '❌ **Message too long.**\nMaximum 1900 characters.', 
                ephemeral: true 
            });
        }

        const ARCHITECT_ID = process.env.OWNER_ID;
        if (!ARCHITECT_ID) {
            return message.reply({ content: t.architectUnavailable, ephemeral: true });
        }

        // ================= CONFIRMATION SYSTEM =================
        const confirmEmbed = new EmbedBuilder()
            .setColor('#00fbff')
            .setAuthor({ name: `${t.title} • ${t.confirmTitle}`, iconURL: message.author.displayAvatarURL() })
            .setDescription(t.confirmDesc(feedback))
            .addFields({
                name: '📋 ' + (lang === 'fr' ? 'Détails' : 'Details'),
                value: `**${t.sourceServer}:** ${message.guild?.name || t.directMessage}\n**${t.channel}:** ${message.channel.name || 'DM'}`,
                inline: false
            })
            .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
            .setTimestamp();

        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('contact_confirm')
                .setLabel(t.confirm)
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅'),
            new ButtonBuilder()
                .setCustomId('contact_cancel')
                .setLabel(t.cancel)
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌')
        );

        const confirmMsg = await message.reply({
            embeds: [confirmEmbed],
            components: [confirmRow]
        });

        // ================= COLLECTOR =================
        const collector = confirmMsg.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 30000 
        });

        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) {
                return i.reply({ 
                    content: lang === 'fr' ? '❌ Cette confirmation ne vous appartient pas.' : '❌ This confirmation is not yours.', 
                    ephemeral: true 
                });
            }

            if (i.customId === 'contact_cancel') {
                collector.stop('cancelled');
                
                const cancelEmbed = new EmbedBuilder()
                    .setColor('#ED4245')
                    .setAuthor({ name: t.title, iconURL: message.author.displayAvatarURL() })
                    .setDescription(t.cancelled)
                    .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                    .setTimestamp();
                
                await i.update({ embeds: [cancelEmbed], components: [] });
                return;
            }

            if (i.customId === 'contact_confirm') {
                collector.stop('confirmed');
                
                // Show processing
                const processingEmbed = new EmbedBuilder()
                    .setColor('#FEE75C')
                    .setAuthor({ name: `${t.title} • ${t.sending}`, iconURL: message.author.displayAvatarURL() })
                    .setDescription(t.processing)
                    .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                    .setTimestamp();
                
                await i.update({ embeds: [processingEmbed], components: [] });

                try {
                    const owner = await client.users.fetch(ARCHITECT_ID);
                    
                    // Create rich embed for Architect
                    const contactEmbed = new EmbedBuilder()
                        .setColor('#00fbff')
                        .setAuthor({ 
                            name: `${t.incomingTitle} • ${message.author.tag}`, 
                            iconURL: message.author.displayAvatarURL() 
                        })
                        .setDescription(`**${t.messageContent}:**\n\`\`\`\n${feedback}\`\`\``)
                        .addFields(
                            { 
                                name: `📍 ${t.sourceServer}`, 
                                value: `${message.guild?.name || t.directMessage}\n└─ ID: \`${message.guild?.id || 'N/A'}\``, 
                                inline: true 
                            },
                            { 
                                name: `💬 ${t.channel}`, 
                                value: `${message.channel.name || 'DM'}\n└─ ID: \`${message.channel.id}\``, 
                                inline: true 
                            }
                        )
                        .addFields({
                            name: `👤 ${t.userInfo}`,
                            value: `**${t.userTag}:** ${message.author.tag}\n**${t.userID}:** \`${message.author.id}\`\n**${t.accountCreated}:** <t:${Math.floor(message.author.createdAt.getTime() / 1000)}:R>`,
                            inline: false
                        })
                        .setFooter({ text: `${t.footer} • v${version}` })
                        .setTimestamp();

                    // Add reply button for Architect
                    const replyRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setLabel(lang === 'fr' ? '💬 Répondre' : '💬 Reply')
                            .setStyle(ButtonStyle.Link)
                            .setURL(`https://discord.com/channels/${message.guild?.id || '@me'}/${message.channel.id}`)
                    );

                    await owner.send({ embeds: [contactEmbed], components: [replyRow] });
                    
                    // Success message
                    const successEmbed = new EmbedBuilder()
                        .setColor('#2ecc71')
                        .setAuthor({ name: `${t.title} • ${t.delivered}`, iconURL: message.author.displayAvatarURL() })
                        .setDescription(t.deliveredMsg)
                        .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                        .setTimestamp();
                    
                    await confirmMsg.edit({ embeds: [successEmbed], components: [] });
                    
                    // Log the contact
                    console.log(`[CONTACT] ${message.author.tag} sent feedback from ${message.guild?.name || 'DM'}: ${feedback.substring(0, 100)}...`);
                    
                } catch (error) {
                    console.error('[CONTACT] Error:', error);
                    
                    const errorEmbed = new EmbedBuilder()
                        .setColor('#ED4245')
                        .setAuthor({ name: `${t.title} • ${t.failed}`, iconURL: message.author.displayAvatarURL() })
                        .setDescription(t.linkFailure)
                        .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                        .setTimestamp();
                    
                    await confirmMsg.edit({ embeds: [errorEmbed], components: [] });
                }
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'timeout' && !collected.size) {
                const timeoutEmbed = new EmbedBuilder()
                    .setColor('#95a5a6')
                    .setAuthor({ name: t.title, iconURL: message.author.displayAvatarURL() })
                    .setDescription(t.timeout)
                    .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                    .setTimestamp();
                
                await confirmMsg.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
            }
        });
    }
};