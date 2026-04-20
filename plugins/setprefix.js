const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

// ================= TRANSLATIONS =================
const translations = {
    en: {
        title: '⚙️ PREFIX CONFIGURATION',
        current: 'Current Prefix',
        new: 'New Prefix',
        updated: '✅ Prefix updated successfully!',
        updatedDesc: 'Command prefix has been changed to `{prefix}`',
        example: 'Example: `{prefix}help`',
        samePrefix: '❌ That is already the current prefix.',
        invalid: '❌ Invalid prefix. Must be 1-5 characters long.',
        noPermission: '❌ You need **Manage Server** permission to change the prefix.',
        notConfigured: 'Not configured',
        footer: 'Server settings updated'
    },
    fr: {
        title: '⚙️ CONFIGURATION DU PREFIXE',
        current: 'Préfixe Actuel',
        new: 'Nouveau Préfixe',
        updated: '✅ Préfixe mis à jour avec succès!',
        updatedDesc: 'Le préfixe de commande a été changé à `{prefix}`',
        example: 'Exemple: `{prefix}help`',
        samePrefix: '❌ C\'est déjà le préfixe actuel.',
        invalid: '❌ Préfixe invalide. Doit contenir 1 à 5 caractères.',
        noPermission: '❌ Vous avez besoin de la permission **Gérer le Serveur** pour changer le préfixe.',
        notConfigured: 'Non configuré',
        footer: 'Paramètres du serveur mis à jour'
    }
};

module.exports = {
    name: 'setprefix',
    aliases: ['prefix', 'setp', 'changeprefix'],
    description: '🔧 Change the bot command prefix for this server.',
    category: 'MODERATION',
    usage: '.setprefix <new_prefix>',
    cooldown: 5000,
    examples: ['.setprefix !', '.setprefix ?', '.setprefix .'],

    // ================= SLASH COMMAND DATA =================
    data: new SlashCommandBuilder()
        .setName('setprefix')
        .setDescription('🔧 Change the bot command prefix for this server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(option =>
            option.setName('prefix')
                .setDescription('New command prefix (1-5 characters)')
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(5)
        ),

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        // Detect language
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
        const t = translations[lang];
        
        // Check permissions
        if (!message.member.permissions.has('ManageGuild')) {
            return message.reply({ content: t.noPermission, ephemeral: true }).catch(() => {});
        }
        
        // Get new prefix from args
        const newPrefix = args[0];
        if (!newPrefix) {
            const currentPrefix = serverSettings?.prefix || '.';
            const helpEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle(t.title)
                .setDescription(`\`\`\`yaml\n${t.current}: ${currentPrefix}\n${t.example.replace('{prefix}', currentPrefix)}\n\`\`\``)
                .addFields({ name: '📝 Usage', value: `\`.setprefix <new_prefix>\`\nExample: \`.setprefix !\``, inline: false })
                .setFooter({ text: t.footer })
                .setTimestamp();
            return message.reply({ embeds: [helpEmbed] }).catch(() => {});
        }
        
        // Validate prefix
        if (newPrefix.length < 1 || newPrefix.length > 5) {
            return message.reply({ content: t.invalid, ephemeral: true }).catch(() => {});
        }
        
        const currentPrefix = serverSettings?.prefix || '.';
        if (newPrefix === currentPrefix) {
            return message.reply({ content: t.samePrefix, ephemeral: true }).catch(() => {});
        }
        
        // Update database
        try {
            db.prepare(`
                INSERT OR REPLACE INTO server_settings (guild_id, prefix, updated_at) 
                VALUES (?, ?, strftime('%s', 'now'))
            `).run(message.guild.id, newPrefix);
            
            // Clear cache
            client.settings.delete(message.guild.id);
            
            // Success embed
            const successEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle(t.title)
                .setDescription(`\`\`\`yaml\n${t.updatedDesc.replace('{prefix}', newPrefix)}\n${t.example.replace('{prefix}', newPrefix)}\n\`\`\``)
                .addFields(
                    { name: `📊 ${t.current}`, value: `\`${currentPrefix}\``, inline: true },
                    { name: `✨ ${t.new}`, value: `\`${newPrefix}\``, inline: true }
                )
                .setFooter({ text: `${message.guild.name} • ${t.footer}` })
                .setTimestamp();
            
            await message.reply({ embeds: [successEmbed] }).catch(() => {});
            console.log(`[PREFIX] ${message.guild.name} changed prefix from "${currentPrefix}" to "${newPrefix}" by ${message.author.tag}`);
            
        } catch (error) {
            console.error('[PREFIX ERROR]', error);
            return message.reply({ content: '❌ Failed to update prefix. Please try again.', ephemeral: true }).catch(() => {});
        }
    },

    // ================= SLASH COMMAND EXECUTION =================
    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = translations[lang];
        
        // Check permissions
        if (!interaction.memberPermissions.has('ManageGuild')) {
            return interaction.reply({ content: t.noPermission, ephemeral: true });
        }
        
        const newPrefix = interaction.options.getString('prefix');
        const db = client.db;
        
        // Get current prefix
        const settings = db.prepare(`SELECT prefix FROM server_settings WHERE guild_id = ?`).get(interaction.guildId);
        const currentPrefix = settings?.prefix || '.';
        
        if (newPrefix === currentPrefix) {
            return interaction.reply({ content: t.samePrefix, ephemeral: true });
        }
        
        // Update database
        try {
            db.prepare(`
                INSERT OR REPLACE INTO server_settings (guild_id, prefix, updated_at) 
                VALUES (?, ?, strftime('%s', 'now'))
            `).run(interaction.guildId, newPrefix);
            
            // Clear cache
            client.settings.delete(interaction.guildId);
            
            const successEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle(t.title)
                .setDescription(`\`\`\`yaml\n${t.updatedDesc.replace('{prefix}', newPrefix)}\n${t.example.replace('{prefix}', newPrefix)}\n\`\`\``)
                .addFields(
                    { name: `📊 ${t.current}`, value: `\`${currentPrefix}\``, inline: true },
                    { name: `✨ ${t.new}`, value: `\`${newPrefix}\``, inline: true }
                )
                .setFooter({ text: `${interaction.guild.name} • ${t.footer}` })
                .setTimestamp();
            
            await interaction.reply({ embeds: [successEmbed] });
            console.log(`[PREFIX] ${interaction.guild.name} changed prefix from "${currentPrefix}" to "${newPrefix}" by ${interaction.user.tag}`);
            
        } catch (error) {
            console.error('[PREFIX ERROR]', error);
            return interaction.reply({ content: '❌ Failed to update prefix. Please try again.', ephemeral: true });
        }
    }
};