const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'roleinfo',
    aliases: ['role', 'ri', 'infosrole'],
    description: 'ℹ️ Display information about a role.',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.roleinfo <@role/roleID/role name>',
    examples: ['.roleinfo @Admin', '.roleinfo Member'],

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage?.(usedCommand, 'en') || 'en';
        
        const t = {
            en: {
                title: 'ℹ️ ROLE INFORMATION',
                name: 'Name',
                id: 'ID',
                color: 'Color',
                position: 'Position',
                members: 'Members',
                hoisted: 'Displayed Separately',
                mentionable: 'Mentionable',
                managed: 'Managed by Integration',
                created: 'Created',
                permissions: '🔐 KEY PERMISSIONS',
                none: 'None',
                noRole: '❌ Role not found. Please mention a role, provide an ID, or specify a name.',
                footer: 'ARCHITECT CG-223 • Neural Intelligence'
            },
            fr: {
                title: 'ℹ️ INFORMATIONS DU RÔLE',
                name: 'Nom',
                id: 'ID',
                color: 'Couleur',
                position: 'Position',
                members: 'Membres',
                hoisted: 'Affiché séparément',
                mentionable: 'Mentionnable',
                managed: 'Géré par intégration',
                created: 'Créé',
                permissions: '🔐 PERMISSIONS CLÉS',
                none: 'Aucune',
                noRole: '❌ Rôle introuvable. Mentionnez un rôle, fournissez un ID ou spécifiez un nom.',
                footer: 'ARCHITECT CG-223 • Intelligence Neurale'
            }
        }[lang];

        const roleInput = args.join(' ');
        if (!roleInput) {
            return message.reply({ content: t.noRole, ephemeral: true }).catch(() => {});
        }

        // Find role by mention, ID, or name
        let role = message.mentions.roles.first() || 
                   message.guild.roles.cache.get(roleInput) ||
                   message.guild.roles.cache.find(r => r.name.toLowerCase().includes(roleInput.toLowerCase()));

        if (!role) {
            return message.reply({ content: t.noRole, ephemeral: true }).catch(() => {});
        }

        // Get key permissions
        const keyPerms = [
            { name: 'Administrator', flag: PermissionsBitField.Flags.Administrator },
            { name: 'Manage Server', flag: PermissionsBitField.Flags.ManageGuild },
            { name: 'Manage Roles', flag: PermissionsBitField.Flags.ManageRoles },
            { name: 'Manage Channels', flag: PermissionsBitField.Flags.ManageChannels },
            { name: 'Kick Members', flag: PermissionsBitField.Flags.KickMembers },
            { name: 'Ban Members', flag: PermissionsBitField.Flags.BanMembers },
            { name: 'Manage Messages', flag: PermissionsBitField.Flags.ManageMessages },
            { name: 'Mention Everyone', flag: PermissionsBitField.Flags.MentionEveryone }
        ];

        const activePerms = keyPerms.filter(p => role.permissions.has(p.flag)).map(p => p.name);
        const permDisplay = activePerms.length > 0 ? activePerms.map(p => `• ${p}`).join('\n') : t.none;

        const embed = new EmbedBuilder()
            .setColor(role.color || '#95a5a6')
            .setAuthor({ name: t.title, iconURL: message.guild.iconURL({ dynamic: true }) })
            .setTitle(`${role.name}`)
            .setDescription(
                `\`\`\`yaml\n` +
                `${t.name}: ${role.name}\n` +
                `${t.id}: ${role.id}\n` +
                `${t.color}: ${role.hexColor}\n` +
                `${t.position}: ${role.position} / ${message.guild.roles.cache.size}\n` +
                `${t.members}: ${role.members.size}\n` +
                `${t.hoisted}: ${role.hoist ? '✅' : '❌'}\n` +
                `${t.mentionable}: ${role.mentionable ? '✅' : '❌'}\n` +
                `${t.managed}: ${role.managed ? '✅' : '❌'}\n` +
                `${t.created}: ${role.createdAt.toLocaleDateString()}\n` +
                `\`\`\``
            )
            .addFields({
                name: t.permissions,
                value: `\`\`\`yaml\n${permDisplay}\`\`\``,
                inline: false
            })
            .setFooter({ text: t.footer })
            .setTimestamp();

        await message.reply({ embeds: [embed] }).catch(() => {});
    }
};