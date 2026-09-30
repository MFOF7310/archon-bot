const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

// ================= TRANSLATIONS =================
const i18n = require('../lib/i18n');
const I18N_KEYS = ["title","current","new","updated","updatedDesc","example","samePrefix","invalid","noPermission","notConfigured","footer"];
// Clés dans lang/<locale>/setprefix.json ; '' retombe sur EN dans t().
function loadT(lang) {
    const o = {};
    for (const k of I18N_KEYS) o[k] = i18n.t(`setprefix.${k}`, lang);
    return o;
}

module.exports = {
    name: 'setprefix',
    aliases: ['prefix', 'setp', 'changeprefix'],
    description: '🔧 Change the bot command prefix for this server.',
    category: 'MODERATION',
    usage: '.setprefix <new_prefix>',
    cooldown: 5000,
    examples: ['.setprefix !', '.setprefix ?', '.setprefix .'],

    // ================= SLASH COMMAND DATA =================

    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        const guildId = message.guild?.id ?? 'DM';
        // Detect language
        
        const t = loadT(lang);
        
        // Check permissions
        if (!message.member.permissions.has('ManageGuild')) {
            return message.reply({ content: t.noPermission, flags: 64 }).catch(() => {});
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
            return message.reply({ content: t.invalid, flags: 64 }).catch(() => {});
        }
        
        const currentPrefix = serverSettings?.prefix || '.';
        if (newPrefix === currentPrefix) {
            return message.reply({ content: t.samePrefix, flags: 64 }).catch(() => {});
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
            return message.reply({ content: '❌ Failed to update prefix. Please try again.', flags: 64 }).catch(() => {});
        }
    },

    // ================= SLASH COMMAND EXECUTION =================
    execute: async (interaction, client) => {
        const lang = require('../lib/i18n').slashLang(interaction);
        const t = loadT(lang);
        
        // Check permissions
        if (!interaction.memberPermissions.has('ManageGuild')) {
            return interaction.reply({ content: t.noPermission, flags: 64 });
        }
        
        const newPrefix = interaction.options.getString('prefix');
        const db = client.db;
        
        // Get current prefix
        const settings = db.prepare(`SELECT prefix FROM server_settings WHERE guild_id = ?`).get(interaction.guildId);
        const currentPrefix = settings?.prefix || '.';
        
        if (newPrefix === currentPrefix) {
            return interaction.reply({ content: t.samePrefix, flags: 64 });
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
            return interaction.reply({ content: '❌ Failed to update prefix. Please try again.', flags: 64 });
        }
    }
};