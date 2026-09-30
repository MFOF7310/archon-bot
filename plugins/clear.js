const { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const i18n = require('../lib/i18n');
const I18N_KEYS = ["title", "sanitizing", "complete", "accessDenied", "invalidAmount", "purgedMessages", "noMessages", "error", "footer", "packetsRemoved", "fromNode", "targetUser", "amount", "reason"];
// Clés dans lang/<locale>/clear.json ; '' retombe sur EN dans t().
function loadT(lang) {
    const o = {};
    for (const k of I18N_KEYS) o[k] = i18n.t(`clear.${k}`, lang);
    return o;
}

module.exports = {
    name: 'clear',
    aliases: ['purge', 'clean', 'nettoyer', 'effacer', 'delete'],
    description: '🧹 Bulk delete messages in the current channel.',
    category: 'MODERATION',
    cooldown: 5000,
    usage: '.clear [amount] [@user]',
    examples: ['.clear 10', '.clear 50 @user', '.clear all'],
    
    // ================= SLASH COMMAND BUILDER =================
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Bulk delete messages in the current channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of messages to delete (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100))
        .addUserOption(option =>
            option.setName('target')
                .setDescription('Only delete messages from this user (optional)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the purge')
                .setRequired(false)),

    // ================= PREFIX COMMAND =================
    run: async (client, message, args, database, serverSettings, usedCommand) => {
        
        // ================= PERMISSION CHECK =================
        const isArchitect = message.author.id === process.env.OWNER_ID;
        const hasPerms = message.member.permissions.has(PermissionFlagsBits.ManageMessages);
        
        if (!isArchitect && !hasPerms) {
            const lang = serverSettings?.language || 'en';
            const t = loadT(lang);
            return message.reply({ content: t.accessDenied, flags: 64 });
        }

        // ================= LANGUAGE SETUP =================
        const lang = client.detectLanguage ? client.detectLanguage('clear', message.guild?.id) : 'en';
        const t = loadT(lang);

        // Delete command message immediately
        await message.delete().catch(() => null);

        // Parse arguments
        const targetUser = message.mentions.users.first();
        const amountArg = targetUser ? args[1] : args[0];
        const maxAmount = 100;
        
        let amount;
        if (amountArg?.toLowerCase() === 'all') {
            amount = maxAmount;
        } else {
            amount = parseInt(amountArg);
            if (isNaN(amount) || amount < 1) amount = 10;
            if (amount > maxAmount) {
                const errorMsg = await message.channel.send(i18n.t('clear.invalidAmount', lang, { max: maxAmount }));
                setTimeout(() => errorMsg.delete().catch(() => null), 4000);
                return;
            }
        }

        await performPurge(message.channel, message.author, amount, targetUser, t, client, message.guild);
    },
    
    // ================= SLASH COMMAND =================
    execute: async (interaction) => {
        await interaction.deferReply({ flags: 64 });
        
        const amount = interaction.options.getInteger('amount');
        const targetUser = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        
        const lang = interaction.client.detectLanguage 
            ? interaction.client.detectLanguage('/clear', interaction.guild?.language || 'en')
            : 'en';
        const t = loadT(lang);
        
        try {
            await performPurge(interaction.channel, interaction.user, amount, targetUser, t, interaction.client, interaction.guild);
            
            await interaction.editReply({ 
                content: `✅ **${amount}** messages purged successfully.${targetUser ? ` Target: **${targetUser.tag}**` : ''}\n📝 Reason: ${reason}`,
                flags: 64 
            });
        } catch (err) {
            console.error('Slash clear error:', err.message);
            await interaction.editReply({ 
                content: t.error,
                flags: 64 
            });
        }
    }
};

// ================= SHARED PURGE FUNCTION =================
async function performPurge(channel, moderator, amount, targetUser, t, client, guild) {
    const version = client.version || '1.5.0';
    const guildName = guild?.name?.toUpperCase() || 'NEURAL NODE';
    const guildIcon = guild?.iconURL() || client.user.displayAvatarURL();
    
    try {
        // Fetch messages
        const fetched = await channel.messages.fetch({ limit: amount });
        
        // Filter messages
        const messagesToDelete = fetched.filter(m => {
            const notPinned = !m.pinned;
            const recent = (Date.now() - m.createdTimestamp) < 1209600000; // 14 days
            const matchesTarget = targetUser ? m.author.id === targetUser.id : true;
            return notPinned && recent && matchesTarget;
        });

        if (messagesToDelete.size === 0) {
            const noFound = await channel.send({ 
                embeds: [
                    new EmbedBuilder()
                        .setColor('#FEE75C')
                        .setAuthor({ name: t.title, iconURL: client.user.displayAvatarURL() })
                        .setDescription(t.noMessages)
                        .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                        .setTimestamp()
                ]
            });
            setTimeout(() => noFound.delete().catch(() => null), 5000);
            return;
        }

        // Bulk delete
        const deleted = await channel.bulkDelete(messagesToDelete, true);
        
        // Create success embed
        const successEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setAuthor({ name: `${t.title} • ${t.complete}`, iconURL: client.user.displayAvatarURL() })
            .setTitle(`🧹 ${t.sanitizing}`)
            .setDescription(
                targetUser 
                    ? `**${deleted.size}** ${t.packetsRemoved} ${t.fromNode} **${targetUser.username}**.\n` +
                      `\`\`\`yaml\n${t.targetUser}: ${targetUser.tag}\n${t.amount}: ${deleted.size} messages\n\`\`\``
                    : `**${deleted.size}** ${t.packetsRemoved} ${t.fromNode}.\n` +
                      `\`\`\`yaml\n${t.amount}: ${deleted.size} messages\n\`\`\``
            )
            .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
            .setTimestamp()
            .addFields({
                name: '🛡️ Moderator',
                value: `${moderator.tag}`,
                inline: true
            });
        
        const reply = await channel.send({ embeds: [successEmbed] });
        
        // Auto-delete confirmation after 5 seconds
        setTimeout(() => reply.delete().catch(() => null), 5000);
        
        // Log the action
        console.log(`[CLEAR] ${moderator.tag} purged ${deleted.size} messages in #${channel.name} | Target: ${targetUser?.tag || 'All'}`);
        
    } catch (err) {
        console.error("[CLEAR] Purge Error:", err);
        
        const errorEmbed = new EmbedBuilder()
            .setColor('#ED4245')
            .setAuthor({ name: t.title, iconURL: client.user.displayAvatarURL() })
            .setDescription(t.error)
            .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
            .setTimestamp();
        
        const errorMsg = await channel.send({ embeds: [errorEmbed] });
        setTimeout(() => errorMsg.delete().catch(() => null), 5000);
    }
}