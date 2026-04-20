const { EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ================= VERSION FROM version.txt =================
function getVersion() {
    try {
        const versionPath = path.join(__dirname, '..', 'version.txt');
        if (fs.existsSync(versionPath)) {
            return fs.readFileSync(versionPath, 'utf8').trim();
        }
        return '1.8.0';
    } catch (err) {
        return '1.8.0';
    }
}

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        noPermission: '❌ Manage Messages permission required.',
        noTarget: '❓ **Reply** to a message or provide a message ID to pin.',
        messageNotFound: '❌ Message not found. It may have been deleted.',
        pinLimitReached: '❌ This channel has reached the 50 pin limit.',
        alreadyPinned: '⚠️ This message is already pinned.',
        pinned: '✅ Message pinned successfully!',
        pinnedAndArchived: '✅ Message pinned and archived to the Neural Gallery!',
        archiveTitle: '📌 NEURAL ARCHIVE ENTRY',
        archivedBy: 'Archived by',
        origin: '📍 Origin',
        jumpToMessage: '🔗 Jump to Message',
        messageId: '🆔 Message ID',
        author: '👤 Author',
        pinnedAt: '📅 Pinned At',
        attachments: '📎 Attachments',
        content: '💬 Content',
        noContent: '*[No text content]*',
        jumpButton: '🔗 Jump to Original',
        unpinButton: '📌 Unpin',
        unpinned: '✅ Message unpinned.',
        pinCount: '📊 Pin Count',
        neuralArchive: 'NEURAL ARCHIVE SYSTEM',
        noPins: '📌 No pinned messages in this channel.',
        unpinFailed: '❌ Failed to unpin.',
        fetchFailed: '❌ Could not fetch pinned messages.',
        unpinPrompt: '**Reply** to a pinned message or provide an ID to unpin.',
        notPinned: '⚠️ This message is not pinned.',
        replyTip: '💡 **Tip:** Reply to a message and type `.pin` to pin it!',
        cleanupTip: '🧹 **Tip:** Reply to a pinned message and type `.unpin` to remove it!',
        slashDescription: '📌 Pin a message to the Neural Gallery',
        slashUnpinDesc: '📌 Unpin a message from the channel',
        slashListDesc: '📌 View all pinned messages in this channel',
        optionMessageId: 'message_id',
        optionMessageDesc: 'ID of the message to pin/unpin (optional if replying)',
        noPinsInChannel: '📌 No pinned messages in this channel.',
        pinsListTitle: '📌 PINNED MESSAGES',
        archivedCount: 'Total Archived',
        channelLimit: 'Channel Limit',
        viewArchives: '📂 View Archives'
    },
    fr: {
        noPermission: '❌ Autorisation de gérer les messages requise.',
        noTarget: '❓ **Répondez** à un message ou fournissez un ID à épingler.',
        messageNotFound: '❌ Message introuvable. Il a peut-être été supprimé.',
        pinLimitReached: '❌ Ce salon a atteint la limite de 50 messages épinglés.',
        alreadyPinned: '⚠️ Ce message est déjà épinglé.',
        pinned: '✅ Message épinglé avec succès!',
        pinnedAndArchived: '✅ Message épinglé et archivé dans la Galerie Neurale!',
        archiveTitle: '📌 ENTRÉE D\'ARCHIVE NEURALE',
        archivedBy: 'Archivé par',
        origin: '📍 Origine',
        jumpToMessage: '🔗 Aller au Message',
        messageId: '🆔 ID du Message',
        author: '👤 Auteur',
        pinnedAt: '📅 Épinglé le',
        attachments: '📎 Pièces jointes',
        content: '💬 Contenu',
        noContent: '*[Aucun contenu texte]*',
        jumpButton: '🔗 Aller à l\'original',
        unpinButton: '📌 Désépingler',
        unpinned: '✅ Message désépinglé.',
        pinCount: '📊 Nombre d\'épingles',
        neuralArchive: 'SYSTÈME D\'ARCHIVE NEURALE',
        noPins: '📌 Aucun message épinglé dans ce salon.',
        unpinFailed: '❌ Échec du désépinglage.',
        fetchFailed: '❌ Impossible de récupérer les messages épinglés.',
        unpinPrompt: '**Répondez** à un message épinglé ou fournissez un ID à désépingler.',
        notPinned: '⚠️ Ce message n\'est pas épinglé.',
        replyTip: '💡 **Astuce:** Répondez à un message et tapez `.pin` pour l\'épingler!',
        cleanupTip: '🧹 **Astuce:** Répondez à un message épinglé et tapez `.unpin` pour le retirer!',
        slashDescription: '📌 Épingler un message dans la Galerie Neurale',
        slashUnpinDesc: '📌 Désépingler un message du salon',
        slashListDesc: '📌 Voir tous les messages épinglés dans ce salon',
        optionMessageId: 'message_id',
        optionMessageDesc: 'ID du message à épingler/désépingler (optionnel si vous répondez)',
        noPinsInChannel: '📌 Aucun message épinglé dans ce salon.',
        pinsListTitle: '📌 MESSAGES ÉPINGLÉS',
        archivedCount: 'Total Archivé',
        channelLimit: 'Limite du Salon',
        viewArchives: '📂 Voir les Archives'
    }
};

// ================= HELPER FUNCTIONS =================
function truncateText(text, maxLength = 1000) {
    if (!text) return null;
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

function formatContent(content, attachments) {
    if (!content && attachments.size === 0) return '*[Empty Message]*';
    if (!content) return `*[${attachments.size} attachment(s)]*`;
    return content;
}

function ensurePinTable(db) {
    try {
        db.prepare(`
            CREATE TABLE IF NOT EXISTS pinned_messages (
                message_id TEXT PRIMARY KEY,
                guild_id TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                author_id TEXT NOT NULL,
                author_tag TEXT,
                content TEXT,
                pinned_by TEXT NOT NULL,
                pinned_at INTEGER DEFAULT (strftime('%s', 'now')),
                attachment_urls TEXT,
                jump_url TEXT
            )
        `).run();
        return true;
    } catch (err) {
        console.error('[PIN TABLE] Failed to create table:', err.message);
        return false;
    }
}

function savePinToDatabase(db, message, pinnedBy) {
    try {
        ensurePinTable(db);
        
        const attachmentUrls = message.attachments.size > 0 
            ? JSON.stringify([...message.attachments.values()].map(a => a.url))
            : null;
        
        db.prepare(`
            INSERT OR REPLACE INTO pinned_messages 
            (message_id, guild_id, channel_id, author_id, author_tag, content, pinned_by, attachment_urls, jump_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            message.id,
            message.guild.id,
            message.channel.id,
            message.author.id,
            message.author.tag,
            truncateText(message.content, 2000),
            pinnedBy.id,
            attachmentUrls,
            message.url
        );
        
        return true;
    } catch (err) {
        console.error('[PIN DB] Failed to save pin:', err.message);
        return false;
    }
}

function deletePinFromDatabase(db, messageId) {
    try {
        db.prepare(`DELETE FROM pinned_messages WHERE message_id = ?`).run(messageId);
        return true;
    } catch (err) {
        console.error('[PIN DB] Failed to delete pin:', err.message);
        return false;
    }
}

function getPinStats(db, guildId) {
    try {
        const result = db.prepare(
            `SELECT COUNT(*) as count FROM pinned_messages WHERE guild_id = ?`
        ).get(guildId);
        return result?.count || 0;
    } catch (err) {
        return 0;
    }
}

async function createArchiveChannel(guild) {
    try {
        let archiveCategory = guild.channels.cache.find(
            c => c.type === 4 && c.name === '📂 NEURAL ARCHIVES'
        );
        
        if (!archiveCategory) {
            archiveCategory = await guild.channels.create({
                name: '📂 NEURAL ARCHIVES',
                type: 4,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionsBitField.Flags.SendMessages]
                    }
                ]
            });
        }
        
        const archiveChannel = await guild.channels.create({
            name: '📌-neural-archives',
            type: 0,
            parent: archiveCategory.id,
            topic: '📂 Neural Archive Gallery - Reply to any message with .pin to save it here!',
            permissionOverwrites: [
                {
                    id: guild.id,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
                    deny: [PermissionsBitField.Flags.SendMessages]
                }
            ]
        });
        
        return archiveChannel;
    } catch (err) {
        console.error('[ARCHIVE] Failed to create archive channel:', err.message);
        return null;
    }
}

// ================= MAIN EXPORT =================
module.exports = {
    name: 'pin',
    aliases: ['fix', 'archive', 'save', 'unpin', 'pins', 'archives'],
    description: '📌 Reply to a message with .pin to save it to the Neural Gallery.',
    category: 'UTILITY',
    usage: '.pin (reply to a message) or .unpin (reply to a pinned message)',
    examples: ['.pin', '.unpin', '.pins'],
    cooldown: 3000,

    // ================= SLASH COMMAND DATA =================
    data: new SlashCommandBuilder()
        .setName('pin')
        .setDescription('📌 Pin a message to the Neural Gallery')
        .addSubcommand(sub => sub
            .setName('pin')
            .setDescription('Pin a message')
            .addStringOption(option => option
                .setName('message_id')
                .setDescription('ID of the message to pin (optional if replying)')
                .setRequired(false))
        )
        .addSubcommand(sub => sub
            .setName('unpin')
            .setDescription('Unpin a message')
            .addStringOption(option => option
                .setName('message_id')
                .setDescription('ID of the message to unpin')
                .setRequired(false))
        )
        .addSubcommand(sub => sub
            .setName('list')
            .setDescription('View all pinned messages in this channel')
        ),

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        
        // ================= LANGUAGE DETECTION =================
        let lang = 'en';
        if (client.detectLanguage && usedCommand) {
            lang = client.detectLanguage(usedCommand, 'en');
        }
        const t = translations[lang];
        
        // ================= PERMISSION CHECK =================
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply({ 
                content: t.noPermission,
                ephemeral: true 
            }).catch(() => {});
        }
        
        // ================= HANDLE SUBCOMMANDS =================
        const subCommand = usedCommand?.toLowerCase();
        
        // Handle .unpin
        if (subCommand === 'unpin') {
            return handleUnpin(client, message, args, db, t, lang);
        }
        
        // Handle .pins / .list
        if (subCommand === 'pins' || subCommand === 'archives' || subCommand === 'list') {
            return handlePinsList(client, message, t, lang);
        }
        
        // Handle .pin
        return handlePin(client, message, args, db, serverSettings, t, lang);
    },

    // ================= SLASH COMMAND EXECUTION =================
    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = translations[lang];
        const db = client.db;
        
        // Check permissions
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return interaction.reply({ content: t.noPermission, ephemeral: true });
        }
        
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'pin') {
            await handleSlashPin(interaction, client, db, t, lang);
        } else if (subcommand === 'unpin') {
            await handleSlashUnpin(interaction, client, db, t, lang);
        } else if (subcommand === 'list') {
            await handleSlashPinsList(interaction, t, lang);
        }
    }
};

// ================= HANDLE PIN =================
async function handlePin(client, message, args, db, serverSettings, t, lang) {
    let targetMessage;
    const version = getVersion();
    
    if (message.reference?.messageId) {
        try {
            targetMessage = await message.channel.messages.fetch(message.reference.messageId);
        } catch (err) {
            try {
                const channels = message.guild.channels.cache.filter(c => c.isTextBased());
                for (const channel of channels.values()) {
                    try {
                        targetMessage = await channel.messages.fetch(message.reference.messageId);
                        if (targetMessage) break;
                    } catch (e) { continue; }
                }
            } catch (e) {}
        }
    }
    
    if (!targetMessage && args[0]) {
        try {
            targetMessage = await message.channel.messages.fetch(args[0]);
        } catch (err) {
            const channels = message.guild.channels.cache.filter(c => c.isTextBased());
            for (const channel of channels.values()) {
                try {
                    targetMessage = await channel.messages.fetch(args[0]);
                    if (targetMessage) break;
                } catch (e) { continue; }
            }
        }
    }
    
    if (!targetMessage) {
        const tipEmbed = new EmbedBuilder()
            .setColor('#00fbff')
            .setDescription(`**${t.noTarget}**\n\n${t.replyTip}`)
            .setFooter({ text: `${t.neuralArchive} • v${version}` });
        
        return message.reply({ embeds: [tipEmbed], ephemeral: true }).catch(() => {});
    }
    
    const channelPins = await targetMessage.channel.messages.fetchPinned().catch(() => new Map());
    if (channelPins.has(targetMessage.id)) {
        return message.reply({ content: t.alreadyPinned, ephemeral: true }).catch(() => {});
    }
    
    try {
        await targetMessage.pin();
    } catch (error) {
        if (error.code === 30003) {
            return message.reply({ content: t.pinLimitReached, ephemeral: true }).catch(() => {});
        }
        throw error;
    }
    
    savePinToDatabase(db, targetMessage, message.author);
    
    let archiveChannelId = serverSettings?.logChannel;
    let archiveChannel = archiveChannelId ? message.guild.channels.cache.get(archiveChannelId) : null;
    
    if (!archiveChannel) {
        archiveChannel = await createArchiveChannel(message.guild);
        if (archiveChannel && client.updateServerSetting) {
            client.updateServerSetting(message.guild.id, 'log', archiveChannel.id);
        }
    }
    
    const archiveEmbed = new EmbedBuilder()
        .setColor('#00fbff')
        .setAuthor({ name: t.archiveTitle, iconURL: client.user.displayAvatarURL() })
        .setDescription(formatContent(targetMessage.content, targetMessage.attachments))
        .addFields(
            { name: t.author, value: `${targetMessage.author.tag}`, inline: true },
            { name: t.origin, value: `<#${targetMessage.channel.id}>`, inline: true },
            { name: t.archivedBy, value: `${message.author.tag}`, inline: true },
            { name: t.pinnedAt, value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
            { name: t.jumpToMessage, value: `[${lang === 'fr' ? 'Cliquez ici' : 'Click here'}](${targetMessage.url})`, inline: true }
        );
    
    if (targetMessage.attachments.size > 0) {
        const firstAttachment = targetMessage.attachments.first();
        if (firstAttachment.contentType?.startsWith('image/')) {
            archiveEmbed.setImage(firstAttachment.url);
        }
        const attachmentList = [...targetMessage.attachments.values()].map((a, i) => `[${lang === 'fr' ? 'Pièce' : 'File'} ${i + 1}](${a.url})`).join(' • ');
        archiveEmbed.addFields({ name: t.attachments, value: truncateText(attachmentList, 1024) || 'N/A', inline: false });
    }
    
    archiveEmbed.setFooter({ text: `${message.guild.name} • ${t.neuralArchive} • v${version}`, iconURL: message.guild.iconURL() || client.user.displayAvatarURL() }).setTimestamp();
    
    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel(t.jumpButton).setStyle(ButtonStyle.Link).setURL(targetMessage.url),
        new ButtonBuilder().setCustomId(`unpin_${targetMessage.id}`).setLabel(t.unpinButton).setStyle(ButtonStyle.Danger).setEmoji('📌')
    );
    
    if (archiveChannel) {
        try { await archiveChannel.send({ embeds: [archiveEmbed], components: [actionRow] }); } catch (err) {}
    }
    
    const pinCount = channelPins.size + 1;
    const totalArchived = getPinStats(db, message.guild.id);
    
    const successEmbed = new EmbedBuilder()
        .setColor('#00fbff')
        .setDescription(`✅ **${archiveChannel ? t.pinnedAndArchived : t.pinned}**\n\n📊 **${t.pinCount}:** ${pinCount}/50\n📂 **${t.archivedCount}:** ${totalArchived} messages\n\n${t.cleanupTip}`)
        .setFooter({ text: `${message.author.tag} • ${t.neuralArchive} • v${version}`, iconURL: message.author.displayAvatarURL() })
        .setTimestamp();
    
    await message.reply({ embeds: [successEmbed], ephemeral: false }).catch(() => {});
    console.log(`[PIN] ${message.author.tag} pinned message from ${targetMessage.author.tag}`);
}

// ================= HANDLE UNPIN =================
async function handleUnpin(client, message, args, db, t, lang) {
    let targetMessage;
    const version = getVersion();
    
    if (message.reference?.messageId) {
        try { targetMessage = await message.channel.messages.fetch(message.reference.messageId); } catch (err) {}
    }
    
    if (!targetMessage && args[0]) {
        try { targetMessage = await message.channel.messages.fetch(args[0]); } catch (err) {}
    }
    
    if (!targetMessage) {
        const tipEmbed = new EmbedBuilder()
            .setColor('#00fbff')
            .setDescription(`**${t.unpinPrompt}**\n\n${t.cleanupTip}`)
            .setFooter({ text: `${t.neuralArchive} • v${version}` });
        return message.reply({ embeds: [tipEmbed], ephemeral: true }).catch(() => {});
    }
    
    const pins = await targetMessage.channel.messages.fetchPinned().catch(() => new Map());
    if (!pins.has(targetMessage.id)) {
        return message.reply({ content: t.notPinned, ephemeral: true }).catch(() => {});
    }
    
    try {
        await targetMessage.unpin();
        deletePinFromDatabase(db, targetMessage.id);
        const successEmbed = new EmbedBuilder()
            .setColor('#00fbff')
            .setDescription(`✅ **${t.unpinned}**`)
            .setFooter({ text: `${t.neuralArchive} • v${version}` });
        await message.reply({ embeds: [successEmbed], ephemeral: true }).catch(() => {});
        console.log(`[UNPIN] ${message.author.tag} unpinned message ${targetMessage.id}`);
    } catch (err) {
        return message.reply({ content: t.unpinFailed, ephemeral: true }).catch(() => {});
    }
}

// ================= HANDLE PINS LIST =================
async function handlePinsList(client, message, t, lang) {
    const version = getVersion();
    try {
        const pins = await message.channel.messages.fetchPinned();
        if (pins.size === 0) {
            const tipEmbed = new EmbedBuilder()
                .setColor('#00fbff')
                .setDescription(`**${t.noPinsInChannel}**\n\n${t.replyTip}`)
                .setFooter({ text: `${t.neuralArchive} • v${version}` });
            return message.reply({ embeds: [tipEmbed], ephemeral: true }).catch(() => {});
        }
        
        const pinsList = [...pins.values()].sort((a, b) => b.createdTimestamp - a.createdTimestamp).slice(0, 10)
            .map((msg, i) => {
                const content = truncateText(msg.content, 50) || '*[No text]*';
                return `${i + 1}. **${msg.author.tag}**: ${content}\n   └ [Jump](${msg.url}) • \`${msg.id}\``;
            }).join('\n\n');
        
        const embed = new EmbedBuilder()
            .setColor('#00fbff')
            .setTitle(`📌 ${t.pinsListTitle}`)
            .setDescription(pinsList + `\n\n${t.cleanupTip}`)
            .setFooter({ text: `${pins.size}/50 • ${message.channel.name} • v${version}` });
        
        await message.reply({ embeds: [embed] }).catch(() => {});
    } catch (err) {
        return message.reply({ content: t.fetchFailed, ephemeral: true }).catch(() => {});
    }
}

// ================= SLASH HANDLERS =================
async function handleSlashPin(interaction, client, db, t, lang) {
    await interaction.deferReply({ ephemeral: true });
    const version = getVersion();
    const messageId = interaction.options.getString('message_id');
    
    let targetMessage;
    
    if (messageId) {
        try { targetMessage = await interaction.channel.messages.fetch(messageId); } catch (err) {}
    }
    
    if (!targetMessage && interaction.message?.reference) {
        try { targetMessage = await interaction.channel.messages.fetch(interaction.message.reference.messageId); } catch (err) {}
    }
    
    if (!targetMessage) {
        return interaction.editReply({ content: t.noTarget });
    }
    
    const channelPins = await targetMessage.channel.messages.fetchPinned().catch(() => new Map());
    if (channelPins.has(targetMessage.id)) {
        return interaction.editReply({ content: t.alreadyPinned });
    }
    
    try { await targetMessage.pin(); } catch (error) {
        if (error.code === 30003) return interaction.editReply({ content: t.pinLimitReached });
        throw error;
    }
    
    savePinToDatabase(db, targetMessage, interaction.user);
    
    const successEmbed = new EmbedBuilder()
        .setColor('#00fbff')
        .setDescription(`✅ ${t.pinned}\n\n${t.cleanupTip}`)
        .setFooter({ text: `${t.neuralArchive} • v${version}` });
    
    await interaction.editReply({ embeds: [successEmbed] });
    console.log(`[SLASH PIN] ${interaction.user.tag} pinned message ${targetMessage.id}`);
}

async function handleSlashUnpin(interaction, client, db, t, lang) {
    await interaction.deferReply({ ephemeral: true });
    const version = getVersion();
    const messageId = interaction.options.getString('message_id');
    
    let targetMessage;
    
    if (messageId) {
        try { targetMessage = await interaction.channel.messages.fetch(messageId); } catch (err) {}
    }
    
    if (!targetMessage && interaction.message?.reference) {
        try { targetMessage = await interaction.channel.messages.fetch(interaction.message.reference.messageId); } catch (err) {}
    }
    
    if (!targetMessage) {
        return interaction.editReply({ content: t.unpinPrompt });
    }
    
    const pins = await targetMessage.channel.messages.fetchPinned().catch(() => new Map());
    if (!pins.has(targetMessage.id)) {
        return interaction.editReply({ content: t.notPinned });
    }
    
    try {
        await targetMessage.unpin();
        deletePinFromDatabase(db, targetMessage.id);
        await interaction.editReply({ content: t.unpinned });
        console.log(`[SLASH UNPIN] ${interaction.user.tag} unpinned message ${targetMessage.id}`);
    } catch (err) {
        await interaction.editReply({ content: t.unpinFailed });
    }
}

async function handleSlashPinsList(interaction, t, lang) {
    await interaction.deferReply({ ephemeral: false });
    const version = getVersion();
    
    try {
        const pins = await interaction.channel.messages.fetchPinned();
        if (pins.size === 0) {
            return interaction.editReply({ content: t.noPinsInChannel });
        }
        
        const pinsList = [...pins.values()].sort((a, b) => b.createdTimestamp - a.createdTimestamp).slice(0, 10)
            .map((msg, i) => {
                const content = truncateText(msg.content, 50) || '*[No text]*';
                return `${i + 1}. **${msg.author.tag}**: ${content}\n   └ [Jump](${msg.url}) • \`${msg.id}\``;
            }).join('\n\n');
        
        const embed = new EmbedBuilder()
            .setColor('#00fbff')
            .setTitle(`📌 ${t.pinsListTitle}`)
            .setDescription(pinsList)
            .setFooter({ text: `${pins.size}/50 • ${interaction.channel.name} • v${version}` });
        
        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        await interaction.editReply({ content: t.fetchFailed });
    }
}