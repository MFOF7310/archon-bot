const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'myroles',
    category: 'PROFILE',
    aliases: ['botroles', 'tiers', 'rankroles', 'badges', 'honors'],
    description: 'Display your bot-assigned role dossier with full audit trail',
    usage: '.myroles [@user]',
    
    // ⚡ SLASH COMMAND DEFINITION
    
    // ⚡ SLASH COMMAND EXECUTION
    async execute(interaction, client) {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const targetUser = interaction.options.getUser('agent');
        
        // Resolve target
        let target;
        if (targetUser) {
            target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (!target) {
                return interaction.reply({
                    embeds: [buildErrorEmbed(lang, 'agent_not_found')],
                    flags: 64
                });
            }
        } else {
            target = interaction.member;
        }
        
        const isSelf = target.id === interaction.user.id;
        
        // Permission gate
        if (!isSelf && !interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return interaction.reply({
                embeds: [buildErrorEmbed(lang, 'no_permission')],
                flags: 64
            });
        }
        
        // Build and send dossier
        const embed = await buildRoleDossier(client, interaction.guild, target, lang, isSelf);
        await interaction.reply({ embeds: [embed], flags: !isSelf ? 1 << 6 : 0 });
    },
    
    // ⚡ PREFIX COMMAND EXECUTION
    async run(client, message, args, db) {
        const lang = client.detectLanguage ? client.detectLanguage('myroles', message.guild?.id) : 'en';
        
        // Resolve target
        const target = message.mentions.members.first() || message.member;
        const isSelf = target.id === message.author.id;
        
        // Permission gate
        if (!isSelf && !message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return message.reply({
                embeds: [buildErrorEmbed(lang, 'no_permission')]
            });
        }
        
        // Build and send dossier
        const embed = await buildRoleDossier(client, message.guild, target, lang, isSelf);
        await message.reply({ embeds: [embed] });
    }
};

// ==================== DOSSIER BUILDER ====================

async function buildRoleDossier(client, guild, member, lang, isSelf) {
    const roles = client.getAssignedRoles(guild.id, member.id);
    
    // No roles found
    if (roles.length === 0) {
        return new EmbedBuilder()
            .setColor('#2c3e50')
            .setAuthor({
                name: lang === 'fr' ? `📂 DOSSIER VIDE • ${member.displayName}` : `📂 EMPTY DOSSIER • ${member.displayName}`,
                iconURL: member.displayAvatarURL({ dynamic: true })
            })
            .setDescription([
                `\`\`\`ansi`,
                `\u001b[1;30m┍━━━━━━━━━━━━━ NO_DATA ━━━━━━━━━━━━━┑\u001b[0m`,
                `\u001b[1;33m STATUS: \u001b[0m \u001b[1;37mUNREGISTERED\u001b[0m`,
                `\u001b[1;30m┕━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┙\u001b[0m`,
                `\`\`\``,
                '',
                lang === 'fr'
                    ? `> *${isSelf ? 'Votre' : 'Cet'} agent n'a encore reçu aucun rôle du système.*`
                    : `> *${isSelf ? 'Your' : 'This'} agent has not received any system roles yet.*`,
                '',
                lang === 'fr'
                    ? '💡 **Pro tip:** Envoyez des messages pour gagner de l\'XP et débloquer des paliers !'
                    : '💡 **Pro tip:** Send messages to earn XP and unlock tier badges!'
            ].join('\n'))
            .setFooter({ text: `${guild.name} • Role Registry • BAMAKO_223 🇲🇱` })
            .setTimestamp();
    }
    
    // Source configuration
    const sourceConfig = {
        leveling:  { emoji: '📈', name: lang === 'fr' ? 'Progression' : 'Leveling',   color: '#2ecc71', priority: 1 },
        shop:      { emoji: '🛒', name: lang === 'fr' ? 'Boutique' : 'Shop',          color: '#f39c12', priority: 3 },
        game:      { emoji: '🎮', name: lang === 'fr' ? 'Jeux' : 'Games',             color: '#e74c3c', priority: 4 },
        event:     { emoji: '🎪', name: lang === 'fr' ? 'Événement' : 'Event',        color: '#9b59b6', priority: 5 },
        admin:     { emoji: '🛡️', name: lang === 'fr' ? 'Administration' : 'Admin',   color: '#e91e63', priority: 6 },
        birthday:  { emoji: '🎂', name: lang === 'fr' ? 'Anniversaire' : 'Birthday',  color: '#ff69b4', priority: 7 },
        system:    { emoji: '⚙️', name: lang === 'fr' ? 'Système' : 'System',         color: '#95a5a6', priority: 2 }
    };
    
    // Group roles by source
    const grouped = {};
    for (const role of roles) {
        if (!grouped[role.source]) grouped[role.source] = [];
        grouped[role.source].push(role);
    }
    
    // Sort sources by priority
    const sortedSources = Object.keys(grouped).sort((a, b) => 
        (sourceConfig[a]?.priority || 99) - (sourceConfig[b]?.priority || 99)
    );
    
    // Build DAEMON_LOG header
    const tierRoles = roles.filter(r => r.role_name.startsWith('Tier: '));
    const specialRoles = roles.filter(r => !r.role_name.startsWith('Tier: '));
    const highestTier = tierRoles.length > 0 
        ? tierRoles[tierRoles.length - 1].role_name.replace('Tier: ', '') 
        : (lang === 'fr' ? 'Aucun' : 'None');
    
    const description = [
        `\`\`\`ansi`,
        `\u001b[1;30m┍━━━━━━━━━━━ AGENT_DOSSIER ━━━━━━━━━━━┑\u001b[0m`,
        `\u001b[1;36m 🎖️ TIER:    \u001b[0m \u001b[1;33m${highestTier.padEnd(12)}\u001b[0m \u001b[1;30m│\u001b[0m \u001b[1;36m 📦 TOTAL: \u001b[0m \u001b[1;37m${String(roles.length).padStart(2)}\u001b[0m`,
        `\u001b[1;36m 🏛️ GUILD:   \u001b[0m \u001b[1;37m${guild.name.substring(0, 16).padEnd(12)}\u001b[0m \u001b[1;30m│\u001b[0m \u001b[1;36m 🔒 MODE:  \u001b[0m \u001b[1;32mISOLATED\u001b[0m`,
        `\u001b[1;30m┕━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┙\u001b[0m`,
        `\`\`\``,
        ''
    ].join('\n');
    
    // Build categorized role blocks
    const roleBlocks = [];
    for (const source of sortedSources) {
        const config = sourceConfig[source] || { emoji: '•', name: source, color: '#95a5a6' };
        const sourceRoles = grouped[source];
        
        // Sort roles alphabetically but put "Tier:" roles in ascending order
        sourceRoles.sort((a, b) => {
            const aIsTier = a.role_name.startsWith('Tier: ');
            const bIsTier = b.role_name.startsWith('Tier: ');
            if (aIsTier && bIsTier) return a.role_name.localeCompare(b.role_name);
            if (aIsTier) return -1;
            if (bIsTier) return 1;
            return a.role_name.localeCompare(b.role_name);
        });
        
        const roleList = sourceRoles.map(r => {
            const roleObj = guild.roles.cache.find(role => role.name === r.role_name);
            const hasRole = member.roles.cache.has(roleObj?.id);
            const status = hasRole ? '🟢' : '🔴';
            const date = new Date(r.assigned_at * 1000);
            const dateStr = date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { 
                month: 'short', 
                day: 'numeric' 
            });
            return `${status} \`${r.role_name.padEnd(18)}\` ${dateStr}`;
        }).join('\n');
        
        roleBlocks.push(
            `### ${config.emoji} ${config.name}`,
            `\`\`\`yaml`,
            roleList,
            `\`\`\``,
            ''
        );
    }
    
    // Stats footer
    const statsBlock = [
        `\`\`\`ansi`,
        `\u001b[1;30m┍━━━━━━━━━━━━━ STATS ━━━━━━━━━━━━━┑\u001b[0m`,
        `\u001b[1;36m 🎖️ ${lang === 'fr' ? 'Paliers' : 'Tiers'}  : \u001b[0m \u001b[1;33m${String(tierRoles.length).padStart(3)}\u001b[0m   \u001b[1;30m│\u001b[0m \u001b[1;36m 💎 ${lang === 'fr' ? 'Spéciaux' : 'Special'} : \u001b[0m \u001b[1;35m${String(specialRoles.length).padStart(3)}\u001b[0m`,
        `\u001b[1;36m 📋 ${lang === 'fr' ? 'Total' : 'Total'}   : \u001b[0m \u001b[1;37m${String(roles.length).padStart(3)}\u001b[0m   \u001b[1;30m│\u001b[0m \u001b[1;36m 🏛️ ${lang === 'fr' ? 'Serveur' : 'Server'}  : \u001b[0m \u001b[1;32mISOLATED\u001b[0m`,
        `\u001b[1;30m┕━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┙\u001b[0m`,
        `\`\`\``
    ].join('\n');
    
    return new EmbedBuilder()
        .setColor('#1a1a2e')
        .setAuthor({
            name: lang === 'fr' ? `📂 DOSSIER • ${member.displayName}` : `📂 DOSSIER • ${member.displayName}`,
            iconURL: member.displayAvatarURL({ dynamic: true })
        })
        .setDescription(description + roleBlocks.join('\n') + statsBlock)
        .setThumbnail(member.displayAvatarURL({ dynamic: true, size: 256 }))
        .setFooter({ 
            text: `${guild.name} • Neural Role Registry • [NODE_BKO]`, 
            iconURL: client.user?.displayAvatarURL() || null
        })
        .setTimestamp();
}

// ==================== ERROR EMBED BUILDER ====================

function buildErrorEmbed(lang, type) {
    const errors = {
        agent_not_found: {
            en: { title: '🔍 AGENT NOT FOUND', desc: 'The specified agent could not be located in this server.' },
            fr: { title: '🔍 AGENT INTROUVABLE', desc: 'L\'agent spécifié est introuvable sur ce serveur.' }
        },
        no_permission: {
            en: { title: '🔒 ACCESS DENIED', desc: 'You need **Manage Roles** permission to view other agents\' dossiers.' },
            fr: { title: '🔒 ACCÈS REFUSÉ', desc: 'Vous avez besoin de la permission **Gérer les rôles** pour voir les dossiers des autres agents.' }
        }
    };
    
    const data = errors[type]?.[lang] || errors[type]?.en;
    
    return new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle(data.title)
        .setDescription(data.desc)
        .setFooter({ text: 'BAMAKO_223 • Security Protocol' })
        .setTimestamp();
}