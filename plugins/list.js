const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ================= TERMINAL COLORS =================
const green = "\x1b[32m", red = "\x1b[31m", reset = "\x1b[0m";

// ================= CATEGORY CONFIGURATION =================
const CATEGORY_CONFIG = {
    SYSTEM: { emoji: '⚙️', color: '#00fbff', name: { en: 'System', fr: 'Système' } },
    GAMING: { emoji: '🎮', color: '#57F287', name: { en: 'Gaming', fr: 'Jeux' } },
    AI: { emoji: '🧠', color: '#9B59B6', name: { en: 'AI Assistant', fr: 'Assistant IA' } },
    PROFILE: { emoji: '👤', color: '#FEE75C', name: { en: 'Profile', fr: 'Profil' } },
    ECONOMY: { emoji: '💰', color: '#F1C40F', name: { en: 'Economy', fr: 'Économie' } },
    MODERATION: { emoji: '🛡️', color: '#E67E22', name: { en: 'Moderation', fr: 'Modération' } },
    UTILITY: { emoji: '🛠️', color: '#EB459E', name: { en: 'Utility', fr: 'Utilitaires' } },
    FUN: { emoji: '🎉', color: '#3498DB', name: { en: 'Fun', fr: 'Divertissement' } },
    GENERAL: { emoji: '📁', color: '#5865F2', name: { en: 'General', fr: 'Général' } },
    OWNER: { emoji: '👑', color: '#ED4245', name: { en: 'Owner', fr: 'Propriétaire' } }
};

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        title: '📋 NEURAL COMMAND REGISTRY',
        description: 'Complete directory of all available system commands.',
        selectCategory: '🔍 Select a Category',
        allCommands: '📚 All Commands',
        categories: 'Categories',
        commands: 'Commands',
        aliases: 'Aliases',
        usage: 'Usage',
        cooldown: 'Cooldown',
        seconds: 's',
        none: 'None',
        noDescription: 'No description available.',
        totalCommands: 'Total Commands',
        totalAliases: 'Total Aliases',
        selectCategoryPrompt: 'Select a category from the dropdown below.',
        commandsInCategory: (count, category) => `**${count}** command${count !== 1 ? 's' : ''} in **${category}**`,
        aliasesFor: 'Aliases for',
        page: 'Page',
        of: 'of',
        footer: 'EAGLE COMMUNITY • NEURAL REGISTRY',
        accessDenied: '⛔ This menu is locked to your session.',
        back: '◀ Back',
        refresh: '🔄 Refresh',
        viewAll: 'View All Commands',
        commandDetails: 'COMMAND DETAILS',
        categoryLabel: 'Category',
        cooldownLabel: 'Cooldown',
        examples: 'Examples',
        noExamples: 'No examples available',
        tip: '💡 TIP: Use {prefix}help <command> for detailed information',
        loading: '🔍 Accessing Neural Registry...'
    },
    fr: {
        title: '📋 REGISTRE DES COMMANDES NEURALES',
        description: 'Répertoire complet de toutes les commandes système disponibles.',
        selectCategory: '🔍 Sélectionner une Catégorie',
        allCommands: '📚 Toutes les Commandes',
        categories: 'Catégories',
        commands: 'Commandes',
        aliases: 'Alias',
        usage: 'Utilisation',
        cooldown: 'Délai',
        seconds: 's',
        none: 'Aucun',
        noDescription: 'Aucune description disponible.',
        totalCommands: 'Total Commandes',
        totalAliases: 'Total Alias',
        selectCategoryPrompt: 'Sélectionnez une catégorie dans le menu ci-dessous.',
        commandsInCategory: (count, category) => `**${count}** commande${count !== 1 ? 's' : ''} dans **${category}**`,
        aliasesFor: 'Alias pour',
        page: 'Page',
        of: 'sur',
        footer: 'EAGLE COMMUNITY • REGISTRE NEURAL',
        accessDenied: '⛔ Ce menu est verrouillé pour votre session.',
        back: '◀ Retour',
        refresh: '🔄 Actualiser',
        viewAll: 'Voir Toutes les Commandes',
        commandDetails: 'DÉTAILS DE LA COMMANDE',
        categoryLabel: 'Catégorie',
        cooldownLabel: 'Délai',
        examples: 'Exemples',
        noExamples: 'Aucun exemple disponible',
        tip: '💡 ASTUCE : Utilisez {prefix}help <commande> pour plus de détails',
        loading: '🔍 Accès au Registre Neural...'
    }
};

// ================= HELPER FUNCTIONS =================
function getAllCommandsAlphabetical(client) {
    const commands = [...client.commands.values()];
    return commands.sort((a, b) => a.name.localeCompare(b.name));
}

function getCommandsByCategory(client) {
    const categorized = {};
    for (const [name, cmd] of client.commands) {
        const category = (cmd.category || 'GENERAL').toUpperCase();
        if (!categorized[category]) categorized[category] = [];
        categorized[category].push(cmd);
    }
    // Sort each category alphabetically
    for (const cat in categorized) {
        categorized[cat].sort((a, b) => a.name.localeCompare(b.name));
    }
    return categorized;
}

function getCategoryStats(client) {
    const stats = {};
    let totalAliases = 0;
    for (const [name, cmd] of client.commands) {
        const category = (cmd.category || 'GENERAL').toUpperCase();
        stats[category] = (stats[category] || 0) + 1;
        totalAliases += (cmd.aliases?.length || 0);
    }
    return { commandsPerCategory: stats, totalAliases };
}

function createAllCommandsEmbed(client, prefix, lang, t, version, guildName, guildIcon, page = 1) {
    const allCommands = getAllCommandsAlphabetical(client);
    const itemsPerPage = 15;
    const totalPages = Math.ceil(allCommands.length / itemsPerPage);
    const currentPage = Math.min(page, totalPages);
    
    const pageCommands = allCommands.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    
    const { totalAliases } = getCategoryStats(client);
    
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setAuthor({ name: t.title, iconURL: client.user.displayAvatarURL() })
        .setTitle(`═ ${t.allCommands} ═`)
        .setDescription(t.description)
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }));
    
    // Group page commands by category for display
    const byCategory = {};
    pageCommands.forEach(cmd => {
        const cat = (cmd.category || 'GENERAL').toUpperCase();
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(cmd);
    });
    
    for (const [cat, cmds] of Object.entries(byCategory)) {
        const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.GENERAL;
        const cmdList = cmds.map(cmd => {
            const aliasesStr = cmd.aliases?.length ? ` *(${cmd.aliases.slice(0, 2).join(', ')}${cmd.aliases.length > 2 ? '...' : ''})*` : '';
            return `${config.emoji} **\`${prefix}${cmd.name}\`**${aliasesStr}`;
        }).join('\n');
        
        embed.addFields({
            name: `${config.emoji} ${config.name[lang]} (${cmds.length})`,
            value: cmdList || '➖',
            inline: true
        });
    }
    
    embed.addFields({
        name: '📊 STATISTICS',
        value: `\`\`\`yaml\n${t.totalCommands}: ${client.commands.size}\n${t.totalAliases}: ${totalAliases}\n${t.categories}: ${Object.keys(CATEGORY_CONFIG).filter(c => getCommandsByCategory(client)[c]?.length).length}\n\`\`\``,
        inline: false
    });
    
    if (totalPages > 1) {
        embed.setFooter({ 
            text: `${guildName} • ${t.page} ${currentPage}/${totalPages} • v${version}`,
            iconURL: guildIcon
        });
    } else {
        embed.setFooter({ 
            text: `${guildName} • ${t.footer} • v${version}`,
            iconURL: guildIcon
        });
    }
    
    embed.setTimestamp();
    
    return { embed, totalPages, currentPage };
}

function createCategoryEmbed(client, category, prefix, lang, t, version, guildName, guildIcon) {
    const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.GENERAL;
    const categorized = getCommandsByCategory(client);
    const cmds = categorized[category] || [];
    
    const embed = new EmbedBuilder()
        .setColor(config.color)
        .setAuthor({ name: `${config.emoji} ${config.name[lang].toUpperCase()} COMMANDS`, iconURL: client.user.displayAvatarURL() })
        .setTitle(`═ ${t.commandsInCategory(cmds.length, config.name[lang])} ═`)
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }));
    
    if (cmds.length === 0) {
        embed.setDescription(lang === 'fr' 
            ? 'Aucune commande dans cette catégorie.'
            : 'No commands in this category.');
    } else {
        let description = '';
        cmds.forEach((cmd, index) => {
            const aliasesStr = cmd.aliases?.length ? ` *[${cmd.aliases.join(', ')}]*` : '';
            description += `**${index + 1}. \`${prefix}${cmd.name}\`**${aliasesStr}\n`;
            description += `└─ ${cmd.description || t.noDescription}\n`;
            if (cmd.usage) description += `└─ 📝 ${t.usage}: \`${prefix}${cmd.name} ${cmd.usage}\`\n`;
            if (cmd.cooldown) description += `└─ ⏱️ ${t.cooldown}: \`${cmd.cooldown / 1000}${t.seconds}\`\n`;
            description += '\n';
        });
        embed.setDescription(description);
    }
    
    embed.addFields({
        name: '📊 ' + (lang === 'fr' ? 'Statistiques' : 'Statistics'),
        value: `\`\`\`yaml\n${t.commands}: ${cmds.length}\n${t.aliases}: ${cmds.reduce((sum, cmd) => sum + (cmd.aliases?.length || 0), 0)}\n\`\`\``,
        inline: false
    });
    
    embed.setFooter({ 
        text: `${guildName} • ${t.footer} • v${version}`,
        iconURL: guildIcon
    }).setTimestamp();
    
    return embed;
}

function createCommandDetailEmbed(cmd, prefix, lang, t, version, guildName, guildIcon) {
    const category = (cmd.category || 'GENERAL').toUpperCase();
    const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.GENERAL;
    
    const embed = new EmbedBuilder()
        .setColor(config.color)
        .setAuthor({ name: `${config.emoji} ${t.commandDetails}`, iconURL: client.user.displayAvatarURL() })
        .setTitle(`◈ ${cmd.name.toUpperCase()} ◈`)
        .setDescription(`\`\`\`yaml\n${cmd.description || t.noDescription}\`\`\``)
        .addFields(
            { name: `📂 ${t.categoryLabel}`, value: `${config.emoji} ${config.name[lang]}`, inline: true },
            { name: `🔧 ${t.usage}`, value: `\`${prefix}${cmd.name} ${cmd.usage || ''}\``.trim() || `\`${prefix}${cmd.name}\``, inline: true },
            { name: `🔀 ${t.aliases}`, value: cmd.aliases?.length ? `\`${cmd.aliases.join(', ')}\`` : `\`${t.none}\``, inline: true }
        );
    
    if (cmd.cooldown) {
        embed.addFields({ 
            name: `⏱️ ${t.cooldownLabel}`, 
            value: `\`${cmd.cooldown / 1000} ${t.seconds}\``, 
            inline: true 
        });
    }
    
    if (cmd.examples?.length) {
        embed.addFields({
            name: `🎯 ${t.examples}`,
            value: `\`${cmd.examples.map(ex => `${prefix}${cmd.name} ${ex}`).join('`\n`')}\``,
            inline: false
        });
    } else {
        embed.addFields({
            name: `🎯 ${t.examples}`,
            value: `\`${t.noExamples}\``,
            inline: false
        });
    }
    
    embed.setFooter({ 
        text: `${guildName} • ${t.footer} • v${version}`,
        iconURL: guildIcon
    }).setTimestamp();
    
    return embed;
}

// ================= MAIN EXPORT =================
module.exports = {
    name: 'list',
    aliases: ['commands', 'cmds', 'registry', 'registre', 'commandes', 'ls'],
    description: '📋 Display a professional, organized list of all available commands.',
    category: 'UTILITY',
    usage: '[category|command]',
    cooldown: 2000,
    examples: ['.list', '.list gaming', '.list profile', '.list shop'],

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        try {
            const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
            const t = translations[lang];
            const effectivePrefix = serverSettings?.prefix || process.env.PREFIX || '.';
            const version = client.version || '1.6.0';
            const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
            const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
            const userId = message.author.id;
            
            // ================= HANDLE SPECIFIC COMMAND LOOKUP =================
            if (args[0]) {
                const searchTerm = args[0].toLowerCase();
                
                // Check if it's a category
                const categories = Object.keys(CATEGORY_CONFIG);
                const matchedCategory = categories.find(c => 
                    c.toLowerCase() === searchTerm || 
                    CATEGORY_CONFIG[c].name.en.toLowerCase() === searchTerm ||
                    CATEGORY_CONFIG[c].name.fr.toLowerCase() === searchTerm
                );
                
                if (matchedCategory) {
                    const embed = createCategoryEmbed(client, matchedCategory, effectivePrefix, lang, t, version, guildName, guildIcon);
                    return message.reply({ embeds: [embed] }).catch(() => {});
                }
                
                // Check if it's a specific command
                const cmd = client.commands.get(searchTerm) || 
                            client.commands.find(c => c.aliases && c.aliases.includes(searchTerm));
                
                if (cmd) {
                    const embed = createCommandDetailEmbed(cmd, effectivePrefix, lang, t, version, guildName, guildIcon);
                    return message.reply({ embeds: [embed] }).catch(() => {});
                }
                
                // Not found - show all commands
                const { embed } = createAllCommandsEmbed(client, effectivePrefix, lang, t, version, guildName, guildIcon, 1);
                return message.reply({ 
                    content: lang === 'fr' 
                        ? `❌ "${args[0]}" introuvable. Voici toutes les commandes :`
                        : `❌ "${args[0]}" not found. Here are all commands:`,
                    embeds: [embed] 
                }).catch(() => {});
            }
            
            // ================= MAIN MENU WITH CATEGORY SELECTION =================
            const categorized = getCommandsByCategory(client);
            const { totalAliases } = getCategoryStats(client);
            
            const mainEmbed = new EmbedBuilder()
                .setColor('#00fbff')
                .setAuthor({ name: t.title, iconURL: client.user.displayAvatarURL() })
                .setTitle('═ NEURAL COMMAND REGISTRY ═')
                .setDescription(
                    `\`\`\`yaml\n` +
                    `${t.totalCommands}: ${client.commands.size}\n` +
                    `${t.totalAliases}: ${totalAliases}\n` +
                    `${t.categories}: ${Object.keys(categorized).length}\n` +
                    `\`\`\`\n` +
                    `${t.selectCategoryPrompt}\n\n` +
                    `${t.tip.replace('{prefix}', effectivePrefix)}`
                )
                .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            
            // Build category options
            const categoryOptions = Object.entries(CATEGORY_CONFIG)
                .filter(([key]) => categorized[key]?.length > 0)
                .map(([key, config]) => ({
                    label: `${config.emoji} ${config.name[lang]}`.substring(0, 100),
                    value: key,
                    description: `${categorized[key]?.length || 0} ${lang === 'fr' ? 'commandes' : 'commands'}`.substring(0, 100),
                    emoji: config.emoji
                }));
            
            // Add "All Commands" option
            categoryOptions.unshift({
                label: `📚 ${t.allCommands}`.substring(0, 100),
                value: 'ALL',
                description: `${client.commands.size} ${lang === 'fr' ? 'commandes' : 'commands'} total`.substring(0, 100),
                emoji: '📚'
            });
            
            const categoryMenu = new StringSelectMenuBuilder()
                .setCustomId('list_category')
                .setPlaceholder(t.selectCategory)
                .addOptions(categoryOptions.slice(0, 25));
            
            const menuRow = new ActionRowBuilder().addComponents(categoryMenu);
            
            const response = await message.reply({
                content: `> **${t.loading}**`,
                embeds: [mainEmbed],
                components: [menuRow]
            }).catch(() => null);
            
            if (!response) return;
            
            // ================= COLLECTOR WITH TRIVIA-STYLE HANDSHAKE =================
            const collector = response.createMessageComponentCollector({ time: 180000 });
            let currentPage = 1;
            
            collector.on('collect', async (i) => {
                if (i.user.id !== userId) {
                    return i.reply({ content: t.accessDenied, ephemeral: true }).catch(() => {});
                }
                
                // 🛡️ TRIVIA-STYLE HANDSHAKE
                try {
                    if (!i.deferred && !i.replied) {
                        await i.deferUpdate();
                    }
                } catch (e) {
                    // Silent catch - index.js handled it
                }
                
                try {
                    // Handle Category Selection
                    if (i.isStringSelectMenu() && i.customId === 'list_category') {
                        const selected = i.values[0];
                        
                        if (selected === 'ALL') {
                            const { embed, totalPages, currentPage: page } = createAllCommandsEmbed(
                                client, effectivePrefix, lang, t, version, guildName, guildIcon, 1
                            );
                            currentPage = 1;
                            
                            const components = [];
                            if (totalPages > 1) {
                                const navRow = new ActionRowBuilder().addComponents(
                                    new ButtonBuilder().setCustomId('list_prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(true),
                                    new ButtonBuilder().setCustomId('list_page').setLabel(`${currentPage}/${totalPages}`).setStyle(ButtonStyle.Primary).setDisabled(true),
                                    new ButtonBuilder().setCustomId('list_next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(totalPages === 1)
                                );
                                components.push(navRow);
                            }
                            
                            const backRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId('list_back').setLabel(t.back).setStyle(ButtonStyle.Secondary).setEmoji('◀')
                            );
                            components.push(backRow);
                            
                            await i.editReply({ content: null, embeds: [embed], components });
                        } else {
                            const embed = createCategoryEmbed(client, selected, effectivePrefix, lang, t, version, guildName, guildIcon);
                            
                            const backRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId('list_back').setLabel(t.back).setStyle(ButtonStyle.Secondary).setEmoji('◀')
                            );
                            
                            await i.editReply({ content: null, embeds: [embed], components: [backRow] });
                        }
                        return;
                    }
                    
                    // Handle Back Button
                    if (i.customId === 'list_back') {
                        await i.editReply({ 
                            content: `> **${t.loading}**`,
                            embeds: [mainEmbed], 
                            components: [menuRow] 
                        });
                        currentPage = 1;
                        return;
                    }
                    
                    // Handle Pagination
                    if (i.customId === 'list_prev' || i.customId === 'list_next') {
                        const newPage = i.customId === 'list_prev' ? currentPage - 1 : currentPage + 1;
                        const { embed, totalPages } = createAllCommandsEmbed(
                            client, effectivePrefix, lang, t, version, guildName, guildIcon, newPage
                        );
                        currentPage = newPage;
                        
                        const components = [];
                        if (totalPages > 1) {
                            const navRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId('list_prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 1),
                                new ButtonBuilder().setCustomId('list_page').setLabel(`${currentPage}/${totalPages}`).setStyle(ButtonStyle.Primary).setDisabled(true),
                                new ButtonBuilder().setCustomId('list_next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === totalPages)
                            );
                            components.push(navRow);
                        }
                        
                        const backRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('list_back').setLabel(t.back).setStyle(ButtonStyle.Secondary).setEmoji('◀')
                        );
                        components.push(backRow);
                        
                        await i.editReply({ content: null, embeds: [embed], components });
                        return;
                    }
                } catch (err) {
                    console.error(`${red}[LIST ERROR]${reset}`, err.message);
                    try {
                        await i.editReply({ 
                            content: lang === 'fr' ? '❌ Une erreur est survenue.' : '❌ An error occurred.',
                            embeds: [], 
                            components: [] 
                        });
                    } catch (e) {}
                }
            });
            
            collector.on('end', async () => {
                try {
                    const disabledMenu = new StringSelectMenuBuilder(menuRow.components[0].data).setDisabled(true);
                    const disabledRow = new ActionRowBuilder().addComponents(disabledMenu);
                    await response.edit({ components: [disabledRow] }).catch(() => {});
                } catch (e) {}
            });
            
        } catch (error) {
            console.error(`${red}[LIST FATAL]${reset}`, error);
            return message.reply({ content: "❌ Command failed." }).catch(() => {});
        }
    }
};