const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, ComponentType } = require('discord.js');

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
        loading: '🔍 Accessing Neural Registry...',
        // NEW SURPRISES!
        searchPlaceholder: '🔎 Search commands...',
        favorites: '⭐ Favorites',
        addFavorite: '⭐ Add to Favorites',
        removeFavorite: '❌ Remove from Favorites',
        favoriteAdded: '✅ Added to favorites!',
        favoriteRemoved: '✅ Removed from favorites!',
        noFavorites: 'No favorite commands yet. Click ⭐ on any command!',
        mostUsed: '📊 Most Used (7d)',
        timesUsed: 'times used',
        newCommand: '🆕 NEW',
        commandOfDay: '🎯 Command of the Day',
        tryItNow: 'Try it now!',
        compactView: '📱 Compact View',
        normalView: '📋 Normal View',
        themeLight: '☀️ Light',
        themeDark: '🌙 Dark',
        themeNeural: '🧠 Neural',
        searchResults: '🔍 Search Results',
        noResults: 'No commands found matching "{query}"',
        statsSummary: '📊 STATS SUMMARY',
        mostPopularCategory: 'Most Popular',
        leastUsedCommand: 'Least Used',
        totalExecutions: 'Total Executions (7d)'
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
        loading: '🔍 Accès au Registre Neural...',
        // NEW SURPRISES!
        searchPlaceholder: '🔎 Rechercher des commandes...',
        favorites: '⭐ Favoris',
        addFavorite: '⭐ Ajouter aux Favoris',
        removeFavorite: '❌ Retirer des Favoris',
        favoriteAdded: '✅ Ajouté aux favoris !',
        favoriteRemoved: '✅ Retiré des favoris !',
        noFavorites: 'Aucune commande favorite. Cliquez sur ⭐ !',
        mostUsed: '📊 Les Plus Utilisées (7j)',
        timesUsed: 'fois utilisée',
        newCommand: '🆕 NOUVEAU',
        commandOfDay: '🎯 Commande du Jour',
        tryItNow: 'Essayez maintenant !',
        compactView: '📱 Vue Compacte',
        normalView: '📋 Vue Normale',
        themeLight: '☀️ Clair',
        themeDark: '🌙 Sombre',
        themeNeural: '🧠 Neural',
        searchResults: '🔍 Résultats de Recherche',
        noResults: 'Aucune commande trouvée pour "{query}"',
        statsSummary: '📊 RÉSUMÉ STATS',
        mostPopularCategory: 'Plus Populaire',
        leastUsedCommand: 'Moins Utilisée',
        totalExecutions: 'Total Exécutions (7j)'
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

// ================= 🎁 SURPRISE: FAVORITES STORAGE =================
const userFavorites = new Map(); // userId -> Set of command names

function getFavorites(userId) {
    if (!userFavorites.has(userId)) {
        userFavorites.set(userId, new Set());
    }
    return userFavorites.get(userId);
}

// ================= 🎁 SURPRISE: COMMAND OF THE DAY =================
function getCommandOfTheDay(client) {
    const commands = getAllCommandsAlphabetical(client);
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return commands[dayOfYear % commands.length];
}

// ================= 🎁 SURPRISE: SEARCH FUNCTION =================
function searchCommands(client, query) {
    const q = query.toLowerCase();
    return getAllCommandsAlphabetical(client).filter(cmd => 
        cmd.name.toLowerCase().includes(q) ||
        (cmd.description && cmd.description.toLowerCase().includes(q)) ||
        (cmd.aliases && cmd.aliases.some(a => a.toLowerCase().includes(q))) ||
        (cmd.category && cmd.category.toLowerCase().includes(q))
    );
}

// ================= CREATE EMBEDS =================
function createMainEmbed(client, prefix, lang, t, version, guildName, guildIcon, favorites = null) {
    const categorized = getCommandsByCategory(client);
    const { totalAliases } = getCategoryStats(client);
    const cmdOfDay = getCommandOfTheDay(client);
    const config = CATEGORY_CONFIG[cmdOfDay.category?.toUpperCase() || 'GENERAL'] || CATEGORY_CONFIG.GENERAL;
    
    const embed = new EmbedBuilder()
        .setColor('#00fbff')
        .setAuthor({ name: t.title, iconURL: client.user.displayAvatarURL() })
        .setTitle('═ NEURAL COMMAND REGISTRY ═')
        .setDescription(
            `\`\`\`yaml\n` +
            `${t.totalCommands}: ${client.commands.size}\n` +
            `${t.totalAliases}: ${totalAliases}\n` +
            `${t.categories}: ${Object.keys(categorized).length}\n` +
            `\`\`\`\n` +
            `${t.selectCategoryPrompt}`
        )
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields({
            name: `🎯 ${t.commandOfDay}`,
            value: `${config.emoji} **\`${prefix}${cmdOfDay.name}\`**\n└─ ${cmdOfDay.description || t.noDescription}\n└─ *${t.tryItNow}*`,
            inline: false
        });
    
    if (favorites && favorites.size > 0) {
        const favList = [...favorites].slice(0, 5).map(c => `⭐ \`${prefix}${c}\``).join('\n');
        embed.addFields({
            name: `⭐ ${t.favorites} (${favorites.size})`,
            value: favList + (favorites.size > 5 ? `\n└─ *+${favorites.size - 5} more...*` : ''),
            inline: true
        });
    }
    
    embed.addFields({
        name: '💡 TIP',
        value: t.tip.replace('{prefix}', prefix),
        inline: false
    });
    
    embed.setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
        .setTimestamp();
    
    return embed;
}

function createAllCommandsEmbed(client, prefix, lang, t, version, guildName, guildIcon, page = 1, isCompact = false) {
    const allCommands = getAllCommandsAlphabetical(client);
    const itemsPerPage = isCompact ? 20 : 15;
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
    
    if (isCompact) {
        let compactList = '';
        pageCommands.forEach(cmd => {
            const config = CATEGORY_CONFIG[cmd.category?.toUpperCase() || 'GENERAL'] || CATEGORY_CONFIG.GENERAL;
            compactList += `${config.emoji} \`${prefix}${cmd.name}\` `;
        });
        embed.addFields({ name: `${t.commands} (${currentPage}/${totalPages})`, value: compactList || '➖', inline: false });
    } else {
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
    }
    
    embed.addFields({
        name: '📊 STATISTICS',
        value: `\`\`\`yaml\n${t.totalCommands}: ${client.commands.size}\n${t.totalAliases}: ${totalAliases}\n${t.categories}: ${Object.keys(CATEGORY_CONFIG).filter(c => getCommandsByCategory(client)[c]?.length).length}\n\`\`\``,
        inline: false
    });
    
    if (totalPages > 1) {
        embed.setFooter({ text: `${guildName} • ${t.page} ${currentPage}/${totalPages} • v${version}`, iconURL: guildIcon });
    } else {
        embed.setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });
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
        embed.setDescription(lang === 'fr' ? 'Aucune commande dans cette catégorie.' : 'No commands in this category.');
    } else {
        let description = '';
        cmds.forEach((cmd, index) => {
            const aliasesStr = cmd.aliases?.length ? ` *[${cmd.aliases.join(', ')}]*` : '';
            description += `**${index + 1}. \`${prefix}${cmd.name}\`**${aliasesStr}\n`;
            description += `└─ ${cmd.description || t.noDescription}\n\n`;
        });
        embed.setDescription(description);
    }
    
    embed.addFields({
        name: '📊 ' + (lang === 'fr' ? 'Statistiques' : 'Statistics'),
        value: `\`\`\`yaml\n${t.commands}: ${cmds.length}\n${t.aliases}: ${cmds.reduce((sum, cmd) => sum + (cmd.aliases?.length || 0), 0)}\n\`\`\``,
        inline: false
    });
    
    embed.setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon }).setTimestamp();
    
    return embed;
}

function createSearchResultsEmbed(client, query, results, prefix, lang, t, version, guildName, guildIcon) {
    const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setAuthor({ name: `🔍 ${t.searchResults}`, iconURL: client.user.displayAvatarURL() })
        .setTitle(`═ "${query}" ═`)
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }));
    
    if (results.length === 0) {
        embed.setDescription(t.noResults.replace('{query}', query));
    } else {
        let description = `**${results.length}** ${lang === 'fr' ? 'résultats trouvés' : 'results found'}:\n\n`;
        results.slice(0, 15).forEach(cmd => {
            const config = CATEGORY_CONFIG[cmd.category?.toUpperCase() || 'GENERAL'] || CATEGORY_CONFIG.GENERAL;
            description += `${config.emoji} **\`${prefix}${cmd.name}\`**\n└─ ${cmd.description || t.noDescription}\n\n`;
        });
        if (results.length > 15) {
            description += `└─ *+${results.length - 15} more...*`;
        }
        embed.setDescription(description);
    }
    
    embed.setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon }).setTimestamp();
    
    return embed;
}

function createFavoritesEmbed(client, favorites, prefix, lang, t, version, guildName, guildIcon) {
    const embed = new EmbedBuilder()
        .setColor('#F1C40F')
        .setAuthor({ name: `⭐ ${t.favorites}`, iconURL: client.user.displayAvatarURL() })
        .setTitle(`═ ${t.favorites} ═`)
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }));
    
    if (!favorites || favorites.size === 0) {
        embed.setDescription(t.noFavorites);
    } else {
        let description = '';
        [...favorites].forEach(cmdName => {
            const cmd = client.commands.get(cmdName);
            if (cmd) {
                const config = CATEGORY_CONFIG[cmd.category?.toUpperCase() || 'GENERAL'] || CATEGORY_CONFIG.GENERAL;
                description += `${config.emoji} **\`${prefix}${cmd.name}\`**\n└─ ${cmd.description || t.noDescription}\n\n`;
            }
        });
        embed.setDescription(description || t.noFavorites);
    }
    
    embed.setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon }).setTimestamp();
    
    return embed;
}

function createCommandDetailEmbed(client, cmd, prefix, lang, t, version, guildName, guildIcon, isFavorite = false) {
    const category = (cmd.category || 'GENERAL').toUpperCase();
    const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.GENERAL;
    
    const embed = new EmbedBuilder()
        .setColor(config.color)
        .setAuthor({ name: `${config.emoji} ${t.commandDetails}`, iconURL: client.user.displayAvatarURL() })
        .setTitle(`◈ ${cmd.name.toUpperCase()} ${isFavorite ? '⭐' : ''} ◈`)
        .setDescription(`\`\`\`yaml\n${cmd.description || t.noDescription}\`\`\``)
        .addFields(
            { name: `📂 ${t.categoryLabel}`, value: `${config.emoji} ${config.name[lang]}`, inline: true },
            { name: `🔧 ${t.usage}`, value: `\`${prefix}${cmd.name} ${cmd.usage || ''}\``.trim() || `\`${prefix}${cmd.name}\``, inline: true },
            { name: `🔀 ${t.aliases}`, value: cmd.aliases?.length ? `\`${cmd.aliases.join(', ')}\`` : `\`${t.none}\``, inline: true }
        );
    
    if (cmd.cooldown) {
        embed.addFields({ name: `⏱️ ${t.cooldownLabel}`, value: `\`${cmd.cooldown / 1000} ${t.seconds}\``, inline: true });
    }
    
    if (cmd.examples?.length) {
        embed.addFields({
            name: `🎯 ${t.examples}`,
            value: `\`${cmd.examples.map(ex => `${prefix}${cmd.name} ${ex}`).join('`\n`')}\``,
            inline: false
        });
    }
    
    embed.setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon }).setTimestamp();
    
    return embed;
}

// ================= MAIN EXPORT =================
module.exports = {
    name: 'list',
    aliases: ['commands', 'cmds', 'registry', 'registre', 'commandes', 'ls'],
    description: '📋 Display a professional, organized list of all available commands.',
    category: 'UTILITY',
    usage: '[category|command|search]',
    cooldown: 2000,
    examples: ['.list', '.list gaming', '.list profile', '.list shop'],

    data: new SlashCommandBuilder()
        .setName('list')
        .setDescription('📋 Display a professional, organized list of all available commands')
        .addStringOption(opt => opt
            .setName('query')
            .setDescription('Category, command, or search term')
            .setRequired(false)),

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        try {
            const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
            const t = translations[lang];
            const effectivePrefix = serverSettings?.prefix || process.env.PREFIX || '.';
            const version = client.version || '1.8.0';
            const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
            const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
            const userId = message.author.id;
            
            const favorites = getFavorites(userId);
            let isCompact = false;
            let currentPage = 1;
            let currentView = 'main';
            let currentCategory = null;
            let searchResults = null;
            
            // ================= HANDLE ARGUMENTS =================
            if (args[0]) {
                const searchTerm = args.join(' ').toLowerCase();
                
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
                    const isFav = favorites.has(cmd.name);
                    const embed = createCommandDetailEmbed(client, cmd, effectivePrefix, lang, t, version, guildName, guildIcon, isFav);
                    
                    const favButton = new ButtonBuilder()
                        .setCustomId(`list_fav_${cmd.name}`)
                        .setLabel(isFav ? t.removeFavorite : t.addFavorite)
                        .setStyle(isFav ? ButtonStyle.Danger : ButtonStyle.Success)
                        .setEmoji('⭐');
                    
                    const backButton = new ButtonBuilder()
                        .setCustomId('list_back')
                        .setLabel(t.back)
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('◀');
                    
                    const row = new ActionRowBuilder().addComponents(favButton, backButton);
                    
                    const reply = await message.reply({ embeds: [embed], components: [row] }).catch(() => {});
                    
                    if (!reply) return;
                    
                    const collector = reply.createMessageComponentCollector({ time: 120000 });
                    
                    collector.on('collect', async (i) => {
                        if (i.user.id !== userId) {
                            return i.reply({ content: t.accessDenied, ephemeral: true });
                        }
                        
                        await i.deferUpdate();
                        
                        if (i.customId === 'list_back') {
                            const mainEmbed = createMainEmbed(client, effectivePrefix, lang, t, version, guildName, guildIcon, favorites);
                            const mainComponents = buildMainComponents(t, lang, favorites);
                            await i.editReply({ embeds: [mainEmbed], components: mainComponents });
                            collector.stop();
                            return;
                        }
                        
                        if (i.customId === `list_fav_${cmd.name}`) {
                            if (favorites.has(cmd.name)) {
                                favorites.delete(cmd.name);
                            } else {
                                favorites.add(cmd.name);
                            }
                            userFavorites.set(userId, favorites);
                            
                            const newIsFav = favorites.has(cmd.name);
                            const newEmbed = createCommandDetailEmbed(client, cmd, effectivePrefix, lang, t, version, guildName, guildIcon, newIsFav);
                            const newFavButton = new ButtonBuilder()
                                .setCustomId(`list_fav_${cmd.name}`)
                                .setLabel(newIsFav ? t.removeFavorite : t.addFavorite)
                                .setStyle(newIsFav ? ButtonStyle.Danger : ButtonStyle.Success)
                                .setEmoji('⭐');
                            
                            const newRow = new ActionRowBuilder().addComponents(newFavButton, backButton);
                            await i.editReply({ embeds: [newEmbed], components: [newRow] });
                            
                            await i.followUp({ 
                                content: newIsFav ? t.favoriteAdded : t.favoriteRemoved, 
                                ephemeral: true 
                            });
                        }
                    });
                    
                    return;
                }
                
                // Search results
                searchResults = searchCommands(client, searchTerm);
                const embed = createSearchResultsEmbed(client, searchTerm, searchResults, effectivePrefix, lang, t, version, guildName, guildIcon);
                return message.reply({ embeds: [embed] }).catch(() => {});
            }
            
            // ================= MAIN MENU =================
            const buildMainComponents = (t, lang, favs) => {
                const categorized = getCommandsByCategory(client);
                
                const categoryOptions = Object.entries(CATEGORY_CONFIG)
                    .filter(([key]) => categorized[key]?.length > 0)
                    .map(([key, config]) => ({
                        label: `${config.emoji} ${config.name[lang]}`.substring(0, 100),
                        value: key,
                        description: `${categorized[key]?.length || 0} ${lang === 'fr' ? 'commandes' : 'commands'}`.substring(0, 100),
                        emoji: config.emoji
                    }));
                
                categoryOptions.unshift({
                    label: `📚 ${t.allCommands}`.substring(0, 100),
                    value: 'ALL',
                    description: `${client.commands.size} ${lang === 'fr' ? 'commandes' : 'commands'} total`.substring(0, 100),
                    emoji: '📚'
                });
                
                if (favs && favs.size > 0) {
                    categoryOptions.unshift({
                        label: `⭐ ${t.favorites} (${favs.size})`.substring(0, 100),
                        value: 'FAVORITES',
                        description: `${lang === 'fr' ? 'Vos commandes favorites' : 'Your favorite commands'}`.substring(0, 100),
                        emoji: '⭐'
                    });
                }
                
                const categoryMenu = new StringSelectMenuBuilder()
                    .setCustomId('list_category')
                    .setPlaceholder(t.selectCategory)
                    .addOptions(categoryOptions.slice(0, 25));
                
                const menuRow = new ActionRowBuilder().addComponents(categoryMenu);
                
                const buttonRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('list_compact').setLabel(t.compactView).setStyle(ButtonStyle.Secondary).setEmoji('📱'),
                    new ButtonBuilder().setCustomId('list_refresh').setLabel(t.refresh).setStyle(ButtonStyle.Secondary).setEmoji('🔄')
                );
                
                return [menuRow, buttonRow];
            };
            
            const mainEmbed = createMainEmbed(client, effectivePrefix, lang, t, version, guildName, guildIcon, favorites);
            const mainComponents = buildMainComponents(t, lang, favorites);
            
            const response = await message.reply({
                content: `> **${t.loading}**`,
                embeds: [mainEmbed],
                components: mainComponents
            }).catch(() => null);
            
            if (!response) return;
            
            // ================= COLLECTOR =================
            const collector = response.createMessageComponentCollector({ time: 300000 });
            
            collector.on('collect', async (i) => {
                if (i.user.id !== userId) {
                    return i.reply({ content: t.accessDenied, ephemeral: true }).catch(() => {});
                }
                
                try {
                    if (!i.deferred && !i.replied) {
                        await i.deferUpdate();
                    }
                } catch (e) {}
                
                try {
                    // Handle Category Selection
                    if (i.isStringSelectMenu() && i.customId === 'list_category') {
                        const selected = i.values[0];
                        
                        if (selected === 'FAVORITES') {
                            const embed = createFavoritesEmbed(client, favorites, effectivePrefix, lang, t, version, guildName, guildIcon);
                            const backRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId('list_back').setLabel(t.back).setStyle(ButtonStyle.Secondary).setEmoji('◀')
                            );
                            await i.editReply({ content: null, embeds: [embed], components: [backRow] });
                            currentView = 'favorites';
                            return;
                        }
                        
                        if (selected === 'ALL') {
                            const { embed, totalPages } = createAllCommandsEmbed(
                                client, effectivePrefix, lang, t, version, guildName, guildIcon, 1, isCompact
                            );
                            currentPage = 1;
                            currentView = 'all';
                            
                            const components = [];
                            if (totalPages > 1) {
                                const navRow = new ActionRowBuilder().addComponents(
                                    new ButtonBuilder().setCustomId('list_prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(true),
                                    new ButtonBuilder().setCustomId('list_page').setLabel(`${currentPage}/${totalPages}`).setStyle(ButtonStyle.Primary).setDisabled(true),
                                    new ButtonBuilder().setCustomId('list_next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(totalPages === 1)
                                );
                                components.push(navRow);
                            }
                            
                            const actionRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId('list_compact_toggle').setLabel(isCompact ? t.normalView : t.compactView).setStyle(ButtonStyle.Secondary).setEmoji('📱'),
                                new ButtonBuilder().setCustomId('list_back').setLabel(t.back).setStyle(ButtonStyle.Secondary).setEmoji('◀')
                            );
                            components.push(actionRow);
                            
                            await i.editReply({ content: null, embeds: [embed], components });
                        } else {
                            const embed = createCategoryEmbed(client, selected, effectivePrefix, lang, t, version, guildName, guildIcon);
                            currentCategory = selected;
                            currentView = 'category';
                            
                            const backRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId('list_back').setLabel(t.back).setStyle(ButtonStyle.Secondary).setEmoji('◀')
                            );
                            
                            await i.editReply({ content: null, embeds: [embed], components: [backRow] });
                        }
                        return;
                    }
                    
                    // Handle Back Button
                    if (i.customId === 'list_back') {
                        const newEmbed = createMainEmbed(client, effectivePrefix, lang, t, version, guildName, guildIcon, favorites);
                        const newComponents = buildMainComponents(t, lang, favorites);
                        await i.editReply({ content: `> **${t.loading}**`, embeds: [newEmbed], components: newComponents });
                        currentView = 'main';
                        currentPage = 1;
                        return;
                    }
                    
                    // Handle Refresh
                    if (i.customId === 'list_refresh') {
                        const newEmbed = createMainEmbed(client, effectivePrefix, lang, t, version, guildName, guildIcon, favorites);
                        await i.editReply({ embeds: [newEmbed] });
                        return;
                    }
                    
                    // Handle Compact Toggle
                    if (i.customId === 'list_compact') {
                        isCompact = true;
                        const { embed, totalPages } = createAllCommandsEmbed(
                            client, effectivePrefix, lang, t, version, guildName, guildIcon, 1, isCompact
                        );
                        currentPage = 1;
                        currentView = 'all';
                        
                        const components = [];
                        if (totalPages > 1) {
                            const navRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId('list_prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(true),
                                new ButtonBuilder().setCustomId('list_page').setLabel(`${currentPage}/${totalPages}`).setStyle(ButtonStyle.Primary).setDisabled(true),
                                new ButtonBuilder().setCustomId('list_next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(totalPages === 1)
                            );
                            components.push(navRow);
                        }
                        
                        const actionRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('list_compact_toggle').setLabel(t.normalView).setStyle(ButtonStyle.Secondary).setEmoji('📱'),
                            new ButtonBuilder().setCustomId('list_back').setLabel(t.back).setStyle(ButtonStyle.Secondary).setEmoji('◀')
                        );
                        components.push(actionRow);
                        
                        await i.editReply({ embeds: [embed], components });
                        return;
                    }
                    
                    if (i.customId === 'list_compact_toggle') {
                        isCompact = !isCompact;
                        let embed, totalPages;
                        
                        if (currentView === 'all') {
                            const result = createAllCommandsEmbed(client, effectivePrefix, lang, t, version, guildName, guildIcon, currentPage, isCompact);
                            embed = result.embed;
                            totalPages = result.totalPages;
                        } else {
                            const result = createAllCommandsEmbed(client, effectivePrefix, lang, t, version, guildName, guildIcon, 1, isCompact);
                            embed = result.embed;
                            totalPages = result.totalPages;
                            currentPage = 1;
                        }
                        
                        const components = [];
                        if (totalPages > 1) {
                            const navRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId('list_prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 1),
                                new ButtonBuilder().setCustomId('list_page').setLabel(`${currentPage}/${totalPages}`).setStyle(ButtonStyle.Primary).setDisabled(true),
                                new ButtonBuilder().setCustomId('list_next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === totalPages)
                            );
                            components.push(navRow);
                        }
                        
                        const actionRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('list_compact_toggle').setLabel(isCompact ? t.normalView : t.compactView).setStyle(ButtonStyle.Secondary).setEmoji('📱'),
                            new ButtonBuilder().setCustomId('list_back').setLabel(t.back).setStyle(ButtonStyle.Secondary).setEmoji('◀')
                        );
                        components.push(actionRow);
                        
                        await i.editReply({ embeds: [embed], components });
                        return;
                    }
                    
                    // Handle Pagination
                    if (i.customId === 'list_prev' || i.customId === 'list_next') {
                        const newPage = i.customId === 'list_prev' ? currentPage - 1 : currentPage + 1;
                        const { embed, totalPages } = createAllCommandsEmbed(
                            client, effectivePrefix, lang, t, version, guildName, guildIcon, newPage, isCompact
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
                        
                        const actionRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('list_compact_toggle').setLabel(isCompact ? t.normalView : t.compactView).setStyle(ButtonStyle.Secondary).setEmoji('📱'),
                            new ButtonBuilder().setCustomId('list_back').setLabel(t.back).setStyle(ButtonStyle.Secondary).setEmoji('◀')
                        );
                        components.push(actionRow);
                        
                        await i.editReply({ content: null, embeds: [embed], components });
                        return;
                    }
                    
                    // Handle Favorite button in command detail
                    if (i.customId?.startsWith('list_fav_')) {
                        const cmdName = i.customId.replace('list_fav_', '');
                        const cmd = client.commands.get(cmdName);
                        
                        if (!cmd) return;
                        
                        if (favorites.has(cmdName)) {
                            favorites.delete(cmdName);
                        } else {
                            favorites.add(cmdName);
                        }
                        userFavorites.set(userId, favorites);
                        
                        const newIsFav = favorites.has(cmdName);
                        const newEmbed = createCommandDetailEmbed(client, cmd, effectivePrefix, lang, t, version, guildName, guildIcon, newIsFav);
                        
                        const favButton = new ButtonBuilder()
                            .setCustomId(`list_fav_${cmdName}`)
                            .setLabel(newIsFav ? t.removeFavorite : t.addFavorite)
                            .setStyle(newIsFav ? ButtonStyle.Danger : ButtonStyle.Success)
                            .setEmoji('⭐');
                        
                        const backButton = new ButtonBuilder()
                            .setCustomId('list_back')
                            .setLabel(t.back)
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('◀');
                        
                        const newRow = new ActionRowBuilder().addComponents(favButton, backButton);
                        
                        await i.editReply({ embeds: [newEmbed], components: [newRow] });
                        
                        await i.followUp({ 
                            content: newIsFav ? t.favoriteAdded : t.favoriteRemoved, 
                            ephemeral: true 
                        });
                        return;
                    }
                } catch (err) {
                    console.error(`${red}[LIST ERROR]${reset}`, err.message);
                }
            });
            
            collector.on('end', async () => {
                try {
                    const disabledComponents = mainComponents.map(row => {
                        const newRow = new ActionRowBuilder();
                        row.components.forEach(comp => {
                            const disabledComp = ButtonBuilder.from(comp).setDisabled(true);
                            newRow.addComponents(disabledComp);
                        });
                        return newRow;
                    });
                    await response.edit({ components: disabledComponents }).catch(() => {});
                } catch (e) {}
            });
            
        } catch (error) {
            console.error(`${red}[LIST FATAL]${reset}`, error);
            return message.reply({ content: "❌ Command failed." }).catch(() => {});
        }
    },

    // ================= SLASH COMMAND EXECUTION =================
    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const query = interaction.options.getString('query');
        
        await interaction.deferReply();
        
        const fakeMessage = {
            author: interaction.user,
            guild: interaction.guild,
            channel: interaction.channel,
            reply: async (options) => interaction.editReply(options),
            react: () => Promise.resolve()
        };
        
        const serverSettings = interaction.guild ? client.getServerSettings(interaction.guild.id) : { prefix: '.' };
        const args = query ? [query] : [];
        
        await module.exports.run(client, fakeMessage, args, client.db, serverSettings, 'list');
    }
};