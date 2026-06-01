const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, SlashCommandBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        title: '📡 NEURAL TRANSMISSION',
        sending: '🛰️ TRANSMITTING',
        delivered: '✅ TRANSMISSION DELIVERED',
        failed: '❌ TRANSMISSION FAILED',
        usage: (prefix) => `❌ **Usage:** \`${prefix}contact [message]\`\n\n**Example:**\n\`${prefix}contact Hello Architect! I have a suggestion...\``,
        slashUsage: '❌ **Usage:** `/contact message:Your message here`',
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
        processing: '📡 Processing transmission...',
        maxLength: '❌ **Message too long.**\nMaximum 1900 characters.'
    },
    fr: {
        title: '📡 TRANSMISSION NEURALE',
        sending: '🛰️ TRANSMISSION',
        delivered: '✅ TRANSMISSION LIVRÉE',
        failed: '❌ TRANSMISSION ÉCHOUÉE',
        usage: (prefix) => `❌ **Utilisation:** \`${prefix}contact [message]\`\n\n**Exemple:**\n\`${prefix}contact Bonjour Architecte! J'ai une suggestion...\``,
        slashUsage: '❌ **Utilisation:** `/contact message:Votre message ici`',
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
        processing: '📡 Traitement de la transmission...',
        maxLength: '❌ **Message trop long.**\nMaximum 1900 caractères.'
    }
};

module.exports = {
    name: 'contact',
    aliases: ['feedback', 'report', 'suggest', 'msg', 'contacter', 'messagearchitecte'],
    description: '📡 Send a direct message to the Architect (bot owner).',
    category: 'SYSTEM',
    cooldown: 30000,
    usage: '.contact [message]',
    examples: ['.contact Hello! I have a suggestion...', '.contact There\'s a bug in the shop command.'],

    // ================= SLASH COMMAND DATA =================
    data: new SlashCommandBuilder()
        .setName('contact')
        .setDescription('📡 Send a direct message to the Architect (bot owner)')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Your message to the Architect')
                .setRequired(true)
                .setMaxLength(1900)
        ),

    // ================= PREFIX COMMAND =================
    run: async (client, message, args, database, serverSettings, usedCommand) => {
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, serverSettings?.language || 'en')
            : (serverSettings?.language || 'en');
        const t = translations[lang];
        const prefix = serverSettings?.prefix || process.env.PREFIX || '.';
        const feedback = args.join(' ');

        if (!feedback) {
            return message.reply({ content: t.usage(prefix) });
        }
        if (feedback.length > 1900) {
            return message.reply({ content: t.maxLength });
        }

        await handleContact(client, message, feedback, lang, false);
    },

    // ================= SLASH COMMAND =================
    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = translations[lang];
        const feedback = interaction.options.getString('message', true);

        await handleContact(client, interaction, feedback, lang, true);
    }
};

// ================= SHARED CONTACT HANDLER =================
async function handleContact(client, context, feedback, lang, isSlash) {
    const t = translations[lang];
    const version = client.version || '1.9.0';
    
    const user = isSlash ? context.user : context.author;
    const guild = context.guild;
    const channel = context.channel;
    const guildName = guild?.name?.toUpperCase() || 'NEURAL NODE';
    const guildIcon = guild?.iconURL() || client.user.displayAvatarURL();

    const reply = async (opts) => {
        if (isSlash) {
            if (context.deferred || context.replied) return context.editReply(opts);
            return context.reply(opts);
        }
        return context.reply(opts);
    };

    const ARCHITECT_ID = process.env.OWNER_ID;
    if (!ARCHITECT_ID) {
        return reply({ content: t.architectUnavailable, ephemeral: true });
    }

    // ================= CONFIRMATION EMBED =================
    const confirmEmbed = new EmbedBuilder()
        .setColor('#00fbff')
        .setAuthor({ name: `${t.title} • ${t.confirmTitle}`, iconURL: user.displayAvatarURL() })
        .setDescription(t.confirmDesc(feedback))
        .addFields({
            name: '📋 ' + (lang === 'fr' ? 'Détails' : 'Details'),
            value: `**${t.sourceServer}:** ${guild?.name || t.directMessage}\n**${t.channel}:** ${channel?.name || 'DM'}`,
            inline: false
        })
        .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
        .setTimestamp();

    const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`contact_confirm_${user.id}`)
            .setLabel(t.confirm)
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),
        new ButtonBuilder()
            .setCustomId(`contact_cancel_${user.id}`)
            .setLabel(t.cancel)
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
    );

    await reply({ embeds: [confirmEmbed], components: [confirmRow], ephemeral: isSlash });
    
    // Get the reply message for collector
    const replyMsg = isSlash ? await context.fetchReply() : await context.fetchReply();

    // ================= BUTTON COLLECTOR =================
    const collector = replyMsg.createMessageComponentCollector({ 
        componentType: ComponentType.Button, 
        time: 30000 
    });

    collector.on('collect', async (i) => {
        if (i.user.id !== user.id) {
            return i.reply({ 
                content: lang === 'fr' ? '❌ Cette confirmation ne vous appartient pas.' : '❌ This confirmation is not yours.', 
                ephemeral: true 
            });
        }

        // CANCEL
        if (i.customId === `contact_cancel_${user.id}`) {
            collector.stop('cancelled');
            const cancelEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setAuthor({ name: t.title, iconURL: user.displayAvatarURL() })
                .setDescription(t.cancelled)
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            await i.update({ embeds: [cancelEmbed], components: [] });
            return;
        }

        // CONFIRM
        if (i.customId === `contact_confirm_${user.id}`) {
            collector.stop('confirmed');
            
            // Processing
            const processingEmbed = new EmbedBuilder()
                .setColor('#FEE75C')
                .setAuthor({ name: `${t.title} • ${t.sending}`, iconURL: user.displayAvatarURL() })
                .setDescription(t.processing)
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            await i.update({ embeds: [processingEmbed], components: [] });

            try {
                const owner = await client.users.fetch(ARCHITECT_ID);
                
                // Build rich embed for Architect
                const contactEmbed = new EmbedBuilder()
                    .setColor('#00fbff')
                    .setAuthor({ 
                        name: `${t.incomingTitle} • ${user.tag}`, 
                        iconURL: user.displayAvatarURL() 
                    })
                    .setDescription(`**${t.messageContent}:**\n\`\`\`\n${feedback}\`\`\``)
                    .addFields(
                        { 
                            name: `📍 ${t.sourceServer}`, 
                            value: `${guild?.name || t.directMessage}\n└─ ID: \`${guild?.id || 'N/A'}\``, 
                            inline: true 
                        },
                        { 
                            name: `💬 ${t.channel}`, 
                            value: `${channel?.name || 'DM'}\n└─ ID: \`${channel?.id}\``, 
                            inline: true 
                        }
                    )
                    .addFields({
                        name: `👤 ${t.userInfo}`,
                        value: `**${t.userTag}:** ${user.tag}\n**${t.userID}:** \`${user.id}\`\n**${t.accountCreated}:** <t:${Math.floor(user.createdAt.getTime() / 1000)}:R>`,
                        inline: false
                    })
                    .setFooter({ text: `${t.footer} • v${version}` })
                    .setTimestamp();

                const replyRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel(lang === 'fr' ? '💬 Répondre' : '💬 Reply')
                        .setStyle(ButtonStyle.Link)
                        .setURL(`https://discord.com/channels/${guild?.id || '@me'}/${channel?.id}`)
                );

                await owner.send({ embeds: [contactEmbed], components: [replyRow] });
                
                // Success
                const successEmbed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setAuthor({ name: `${t.title} • ${t.delivered}`, iconURL: user.displayAvatarURL() })
                    .setDescription(t.deliveredMsg)
                    .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                    .setTimestamp();
                
                await replyMsg.edit({ embeds: [successEmbed], components: [] });
                console.log(`[CONTACT] ${user.tag} → Architect: ${feedback.substring(0, 100)}...`);
                
            } catch (error) {
                console.error('[CONTACT] Error:', error);
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ED4245')
                    .setAuthor({ name: `${t.title} • ${t.failed}`, iconURL: user.displayAvatarURL() })
                    .setDescription(t.linkFailure)
                    .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                    .setTimestamp();
                await replyMsg.edit({ embeds: [errorEmbed], components: [] });
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'timeout' && !collected.size) {
            const timeoutEmbed = new EmbedBuilder()
                .setColor('#95a5a6')
                .setAuthor({ name: t.title, iconURL: user.displayAvatarURL() })
                .setDescription(t.timeout)
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            await replyMsg.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
        }
    });
}