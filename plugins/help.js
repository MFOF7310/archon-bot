const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, ButtonBuilder, ButtonStyle } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        // Headers
        directoryTitle: '⚙️ ARCHITECT CG-223 | NEURAL DIRECTORY',
        commandExtract: 'COMMAND DATA_EXTRACT',
        module: 'MODULE',
        category: 'CATEGORY',
        usage: 'USAGE',
        aliases: 'ALIASES',
        examples: 'EXAMPLES',
        cooldown: 'COOLDOWN',
        seconds: 'seconds',
        noDescription: 'No description encrypted. Use .help for module list.',
        noExamples: 'No examples available',
        none: 'NONE',
        
        // Main Menu
        systemStatus: 'SYSTEM STATUS',
        online: 'ONLINE',
        node: 'NODE',
        core: 'CORE',
        uptime: 'UPTIME',
        version: 'VERSION',
        moduleStats: '📊 MODULE STATISTICS',
        commands: 'Commands',
        aliasesStat: 'Aliases',
        categories: 'Categories',
        agents: 'Agents',
        guilds: 'Guilds',
        quickAccess: '🎮 QUICK ACCESS',
        aiAssistant: '🤖 AI ASSISTANT',
        aiDesc: 'Mention @Lydia or use {prefix}ask\nReal-time web search enabled',
        
        // Select Menu
        selectPlaceholder: '🔍 Select a System Module to Decrypt...',
        viewAll: 'View all {category} commands and utilities',
        mainMenu: '🏠 MAIN MENU',
        backToMain: '🏠 MAIN MENU',
        
        // Category View
        modulesTitle: 'NEURAL COMMAND DATABASE',
        moduleStatsTitle: '📊 MODULE STATS',
        totalCommands: 'Total Commands',
        aliasesRegistered: 'Aliases Registered',
        commandsAvailable: 'commands available',
        useHelpForDetails: 'Use {prefix}help <command> for details',
        selectModuleBelow: 'Select a module below',
        
        // NEW: Quick Stats
        mostUsedCommands: '🔥 MOST USED',
        recentAdditions: '🆕 RECENT',
        recommendedForYou: '⭐ RECOMMENDED',
        
        // NEW: Command Categories Descriptions
        categoryDescriptions: {
            SYSTEM: 'Core system commands and utilities',
            GAMING: 'Games, arcade, and entertainment',
            ECONOMY: 'Credits, shop, and daily rewards',
            PROFILE: 'Rank, stats, and leaderboards',
            AI: 'Lydia AI and neural assistance',
            MODERATION: 'Server management and moderation',
            UTILITY: 'Useful tools and information',
            FUN: 'Fun commands and interactions',
            OWNER: 'Bot owner exclusive commands',
            GENERAL: 'General purpose commands'
        },
        
        // Errors
        signalLost: '❌ SIGNAL LOST',
        commandNotFound: 'Command Not Found',
        notFoundDesc: (arg, prefix) => `\`\`\`diff\n- Command or category "${arg}" not found in neural database\n- Use ${prefix}help to view all available modules\`\`\``,
        checkSpelling: 'ARCHITECT CG-223 • Check your spelling and try again',
        accessDenied: '⛔ Access Denied. This directory is locked to the requesting agent.',
        
        // Loading
        loading: '🔍 Initializing Neural Directory handshake...',
        accessing: (guilds) => `Accessing command database across ${guilds} sectors...`,
        
        // Footer
        footer: 'EAGLE COMMUNITY • DIGITAL SOVEREIGNTY',
        bamakoNode: 'Bamako Node',
        modulesOnline: 'modules online',
        page: 'Page',
        
        // NEW: Tips
        tip: '💡 TIP',
        tips: [
            'Use {prefix}help <command> for detailed information',
            'Type {prefix}game menu to access the Neural Arcade',
            'Claim daily rewards with {prefix}daily',
            'Check your rank with {prefix}rank',
            'Visit the shop with {prefix}shop'
        ]
    },
    fr: {
        // Headers
        directoryTitle: '⚙️ ARCHITECT CG-223 | RÉPERTOIRE NEURAL',
        commandExtract: 'EXTRAIT DE COMMANDE',
        module: 'MODULE',
        category: 'CATÉGORIE',
        usage: 'UTILISATION',
        aliases: 'ALIAS',
        examples: 'EXEMPLES',
        cooldown: 'REFRAGEMENT',
        seconds: 'secondes',
        noDescription: 'Aucune description cryptée. Utilisez .help pour la liste des modules.',
        noExamples: 'Aucun exemple disponible',
        none: 'AUCUN',
        
        // Main Menu
        systemStatus: 'ÉTAT DU SYSTÈME',
        online: 'EN LIGNE',
        node: 'NŒUD',
        core: 'CŒUR',
        uptime: 'DISPONIBILITÉ',
        version: 'VERSION',
        moduleStats: '📊 STATISTIQUES DES MODULES',
        commands: 'Commandes',
        aliasesStat: 'Alias',
        categories: 'Catégories',
        agents: 'Agents',
        guilds: 'Serveurs',
        quickAccess: '🎮 ACCÈS RAPIDE',
        aiAssistant: '🤖 ASSISTANT IA',
        aiDesc: 'Mentionnez @Lydia ou utilisez {prefix}ask\nRecherche web en temps réel activée',
        
        // Select Menu
        selectPlaceholder: '🔍 Sélectionnez un Module Système à Décrypter...',
        viewAll: 'Voir toutes les commandes {category}',
        mainMenu: '🏠 MENU PRINCIPAL',
        backToMain: '🏠 MENU PRINCIPAL',
        
        // Category View
        modulesTitle: 'BASE DE DONNÉES DE COMMANDES NEURALES',
        moduleStatsTitle: '📊 STATS DU MODULE',
        totalCommands: 'Total Commandes',
        aliasesRegistered: 'Alias Enregistrés',
        commandsAvailable: 'commandes disponibles',
        useHelpForDetails: 'Utilisez {prefix}help <commande> pour plus de détails',
        selectModuleBelow: 'Sélectionnez un module ci-dessous',
        
        // NEW: Quick Stats
        mostUsedCommands: '🔥 LES PLUS UTILISÉS',
        recentAdditions: '🆕 RÉCENTS',
        recommendedForYou: '⭐ RECOMMANDÉS',
        
        // NEW: Command Categories Descriptions
        categoryDescriptions: {
            SYSTEM: 'Commandes système principales',
            GAMING: 'Jeux, arcade et divertissement',
            ECONOMY: 'Crédits, boutique et récompenses',
            PROFILE: 'Rang, statistiques et classements',
            AI: 'Lydia IA et assistance neurale',
            MODERATION: 'Gestion et modération du serveur',
            UTILITY: 'Outils et informations utiles',
            FUN: 'Commandes amusantes',
            OWNER: 'Commandes exclusives du propriétaire',
            GENERAL: 'Commandes générales'
        },
        
        // Errors
        signalLost: '❌ SIGNAL PERDU',
        commandNotFound: 'Commande Introuvable',
        notFoundDesc: (arg, prefix) => `\`\`\`diff\n- La commande ou catégorie "${arg}" est introuvable dans la base neurale\n- Utilisez ${prefix}help pour voir tous les modules\`\`\``,
        checkSpelling: 'ARCHITECT CG-223 • Vérifiez votre orthographe et réessayez',
        accessDenied: '⛔ Accès Refusé. Ce répertoire est verrouillé pour l\'agent demandeur.',
        
        // Loading
        loading: '🔍 Initialisation de la poignée de main du répertoire neural...',
        accessing: (guilds) => `Accès à la base de données de commandes sur ${guilds} secteurs...`,
        
        // Footer
        footer: 'EAGLE COMMUNITY • SOUVERAINETÉ NUMÉRIQUE',
        bamakoNode: 'Nœud Bamako',
        modulesOnline: 'modules en ligne',
        page: 'Page',
        
        // NEW: Tips
        tip: '💡 ASTUCE',
        tips: [
            'Utilisez {prefix}help <commande> pour plus de détails',
            'Tapez {prefix}game menu pour accéder à l\'Arcade Neurale',
            'Réclamez vos récompenses avec {prefix}daily',
            'Vérifiez votre rang avec {prefix}rank',
            'Visitez la boutique avec {prefix}shop'
        ]
    }
};

// ================= CATEGORY EMOJI & COLOR MAPPING =================
const emojiMap = {
    SYSTEM: '⚙️',
    GAMING: '🎮', 
    AI: '🧠', 
    PROFILE: '👤', 
    OWNER: '👑', 
    GENERAL: '📁',
    UTILITY: '🛠️',
    MODERATION: '🛡️',
    ECONOMY: '💰',
    FUN: '🎉'
};

const colorMap = {
    SYSTEM: '#00fbff',
    GAMING: '#57F287',
    AI: '#9B59B6',
    PROFILE: '#FEE75C',
    OWNER: '#ED4245',
    GENERAL: '#5865F2',
    UTILITY: '#EB459E',
    MODERATION: '#E67E22',
    ECONOMY: '#F1C40F',
    FUN: '#3498DB'
};

// ================= GET RANDOM TIP =================
function getRandomTip(t, prefix) {
    const tips = t.tips;
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    return randomTip.replace(/{prefix}/g, prefix);
}

// ================= GET CATEGORY STATS =================
function getCategoryStats(client) {
    const stats = {};
    const commands = client.commands;
    
    for (const [name, cmd] of commands) {
        const category = cmd.category || 'GENERAL';
        stats[category] = (stats[category] || 0) + 1;
    }
    
    return stats;
}

// ================= GET MOST COMMANDED CATEGORIES =================
function getTopCategories(stats, limit = 3) {
    return Object.entries(stats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([cat, count]) => ({ cat, count }));
}

module.exports = {
    name: 'help',
    aliases: ['h', 'menu', 'docs', 'aide', 'commandes', 'commands'],
    description: 'Access the ARCHITECT Neural Directory and command database with advanced navigation.',
    category: 'SYSTEM',
    cooldown: 3000,

    run: async (client, message, args, database, serverSettings) => {
        // ================= PREFIX & LANGUAGE SETUP =================
        const effectivePrefix = serverSettings?.prefix || process.env.PREFIX || '.';
        const lang = serverSettings?.language || 'en';
        const t = translations[lang];
        const version = client.version || '1.5.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        
        // ================= UPTIME CALCULATION =================
        const uptimeSec = process.uptime();
        const days = Math.floor(uptimeSec / 86400);
        const hours = Math.floor((uptimeSec % 86400) / 3600);
        const minutes = Math.floor((uptimeSec % 3600) / 60);
        
        // ================= MEMBER COUNT =================
        const totalMembers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
        const totalGuilds = client.guilds.cache.size;
        
        // Format uptime string
        let uptimeString = '';
        if (days > 0) uptimeString += `${days}${lang === 'fr' ? 'j' : 'd'} `;
        if (hours > 0) uptimeString += `${hours}${lang === 'fr' ? 'h' : 'h'} `;
        if (minutes > 0) uptimeString += `${minutes}${lang === 'fr' ? 'm' : 'm'} `;
        if (days === 0 && hours === 0 && minutes === 0) uptimeString += `${Math.floor(uptimeSec)}s`;
        else if (uptimeSec % 60 > 0 && days === 0 && hours === 0) uptimeString += `${Math.floor(uptimeSec % 60)}s`;
        
        uptimeString = uptimeString.trim() || '0s';
        
        // ================= SUB-COMMAND HANDLING =================
        if (args[0]) {
            const searchTerm = args[0].toUpperCase();
            
            // Check if it's a Category
            const categories = [...new Set(client.commands.map(cmd => (cmd.category || 'GENERAL').toUpperCase()))];
            
            if (categories.includes(searchTerm)) {
                return showCategoryHelp(client, message, searchTerm, effectivePrefix, lang, t, emojiMap, colorMap, guildName, guildIcon, version);
            }
            
            // Check if it's a Command
            const cmdLower = args[0].toLowerCase();
            const cmd = client.commands.get(cmdLower) || 
                        client.commands.find(c => c.aliases && c.aliases.includes(cmdLower));
            
            if (cmd) {
                const category = cmd.category || 'GENERAL';
                const categoryColor = colorMap[category.toUpperCase()] || '#5865F2';
                const categoryEmoji = emojiMap[category.toUpperCase()] || '📁';

                const detailEmbed = new EmbedBuilder()
                    .setColor(categoryColor)
                    .setAuthor({ 
                        name: `${categoryEmoji} ${t.commandExtract}`, 
                        iconURL: client.user.displayAvatarURL() 
                    })
                    .setTitle(`◈ ${t.module}: ${cmd.name.toUpperCase()} ◈`)
                    .setDescription(`\`\`\`prolog\n${cmd.description || t.noDescription}\`\`\``)
                    .addFields(
                        { name: `📂 ${t.category}`, value: `\`${category}\` ${t.categoryDescriptions?.[category] ? `• ${t.categoryDescriptions[category]}` : ''}`, inline: false },
                        { name: `🔧 ${t.usage}`, value: `\`${effectivePrefix}${cmd.name} ${cmd.usage || ''}\``.trim(), inline: true },
                        { name: `🔀 ${t.aliases}`, value: cmd.aliases?.length ? `\`${cmd.aliases.join(', ')}\`` : `\`${t.none}\``, inline: true }
                    );
                
                if (cmd.examples?.length) {
                    detailEmbed.addFields({
                        name: `🎯 ${t.examples}`,
                        value: `\`${cmd.examples.map(ex => `${effectivePrefix}${cmd.name} ${ex}`).join('`\n`')}\``,
                        inline: false
                    });
                }

                if (cmd.cooldown) {
                    detailEmbed.addFields({ 
                        name: `⏱️ ${t.cooldown}`, 
                        value: `\`${cmd.cooldown/1000} ${t.seconds}\``, 
                        inline: true 
                    });
                }
                
                detailEmbed
                    .setFooter({ 
                        text: `${guildName} • ${t.bamakoNode} • ${client.commands.size} ${t.modulesOnline} • v${version}`,
                        iconURL: guildIcon
                    })
                    .setTimestamp();

                return message.reply({ embeds: [detailEmbed] });
            }

            // Not found
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setAuthor({ name: t.signalLost, iconURL: client.user.displayAvatarURL() })
                .setTitle(t.commandNotFound)
                .setDescription(t.notFoundDesc(args[0], effectivePrefix))
                .setFooter({ text: `${guildName} • ${t.checkSpelling}`, iconURL: guildIcon })
                .setTimestamp();
            return message.reply({ embeds: [errorEmbed] });
        }

        // ================= MAIN DIRECTORY (No args) =================
        const categories = [...new Set(client.commands.map(cmd => cmd.category || 'GENERAL'))].sort();
        const categoryStats = getCategoryStats(client);
        const topCategories = getTopCategories(categoryStats);
        
        const totalCommands = client.commands.size;
        const totalAliases = client.aliases?.size || 0;
        const categoriesCount = categories.length;
        
        // Build top categories display
        const topCategoriesDisplay = topCategories.map((c, i) => 
            `${['🥇', '🥈', '🥉'][i]} **${c.cat}**: \`${c.count}\` ${t.commands.toLowerCase()}`
        ).join('\n');
        
        const mainEmbed = new EmbedBuilder()
            .setColor('#00fbff')
            .setAuthor({ 
                name: t.directoryTitle, 
                iconURL: client.user.displayAvatarURL({ dynamic: true, size: 1024 }) 
            })
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 512 }))
            .setDescription(
                `\`\`\`prolog\n` +
                `┌─ ${t.systemStatus}: 🟢 ${t.online}\n` +
                `├─ ${t.node}: BAMAKO-223\n` +
                `├─ ${t.core}: Groq LPU™ + Brave Search\n` +
                `├─ ${t.uptime}: ${uptimeString}\n` +
                `└─ ${t.version}: v${version}\`\`\``
            )
            .addFields(
                { 
                    name: t.moduleStats, 
                    value: `\`\`\`yaml\n${t.commands}: ${totalCommands}\n${t.aliasesStat}: ${totalAliases}\n${t.categories}: ${categoriesCount}\n${t.agents}: ${totalMembers.toLocaleString()}\n${t.guilds}: ${totalGuilds}\`\`\``, 
                    inline: true 
                },
                { 
                    name: `🏆 TOP CATEGORIES`, 
                    value: topCategoriesDisplay || 'No data available', 
                    inline: true 
                },
                { 
                    name: t.quickAccess, 
                    value: `\`\`\`fix\n${effectivePrefix}game menu\n${effectivePrefix}daily\n${effectivePrefix}rank\n${effectivePrefix}shop\`\`\``, 
                    inline: false 
                },
                { 
                    name: t.aiAssistant, 
                    value: `\`\`\`fix\n${t.aiDesc.replace('{prefix}', effectivePrefix)}\`\`\``, 
                    inline: true 
                },
                { 
                    name: t.tip, 
                    value: getRandomTip(t, effectivePrefix), 
                    inline: true 
                }
            )
            .setFooter({ 
                text: `${guildName} • ${t.footer} • v${version} • ${t.selectModuleBelow}`, 
                iconURL: guildIcon
            })
            .setTimestamp();

        // Create Select Menu with translated descriptions
        const menu = new StringSelectMenuBuilder()
            .setCustomId('help_select')
            .setPlaceholder(t.selectPlaceholder)
            .addOptions(categories.map(cat => ({
                label: cat.toUpperCase(),
                value: cat,
                description: `${t.categoryDescriptions?.[cat] || t.viewAll.replace('{category}', cat.toLowerCase())}`.substring(0, 100),
                emoji: emojiMap[cat.toUpperCase()] || '📁'
            })));

        const row1 = new ActionRowBuilder().addComponents(menu);
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('back_to_main')
                .setLabel(t.mainMenu)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );

        const response = await message.reply({
            content: `> **${t.loading}**\n> *${t.accessing(totalGuilds)}*`,
            embeds: [mainEmbed],
            components: [row1, row2]
        });

        let currentView = 'main';
        
        // ================= COLLECTOR =================
        const collector = response.createMessageComponentCollector({ 
            time: 300000 // 5 minutes
        });
        
        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) {
                return i.reply({ content: t.accessDenied, ephemeral: true });
            }

            // Handle Back Button
            if (i.customId === 'back_to_main' && currentView !== 'main') {
                currentView = 'main';
                
                // Recalculate fresh data
                const freshUptimeSec = process.uptime();
                const freshDays = Math.floor(freshUptimeSec / 86400);
                const freshHours = Math.floor((freshUptimeSec % 86400) / 3600);
                const freshMinutes = Math.floor((freshUptimeSec % 3600) / 60);
                const freshTotalMembers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
                const freshTotalGuilds = client.guilds.cache.size;
                
                let freshUptimeString = '';
                if (freshDays > 0) freshUptimeString += `${freshDays}${lang === 'fr' ? 'j' : 'd'} `;
                if (freshHours > 0) freshUptimeString += `${freshHours}${lang === 'fr' ? 'h' : 'h'} `;
                if (freshMinutes > 0) freshUptimeString += `${freshMinutes}${lang === 'fr' ? 'm' : 'm'} `;
                if (freshDays === 0 && freshHours === 0 && freshMinutes === 0) freshUptimeString += `${Math.floor(freshUptimeSec)}s`;
                else if (freshUptimeSec % 60 > 0 && freshDays === 0 && freshHours === 0) freshUptimeString += `${Math.floor(freshUptimeSec % 60)}s`;
                
                freshUptimeString = freshUptimeString.trim() || '0s';
                
                const freshMainEmbed = new EmbedBuilder()
                    .setColor('#00fbff')
                    .setAuthor({ 
                        name: t.directoryTitle, 
                        iconURL: client.user.displayAvatarURL({ dynamic: true, size: 1024 }) 
                    })
                    .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 512 }))
                    .setDescription(
                        `\`\`\`prolog\n` +
                        `┌─ ${t.systemStatus}: 🟢 ${t.online}\n` +
                        `├─ ${t.node}: BAMAKO-223\n` +
                        `├─ ${t.core}: Groq LPU™ + Brave Search\n` +
                        `├─ ${t.uptime}: ${freshUptimeString}\n` +
                        `└─ ${t.version}: v${version}\`\`\``
                    )
                    .addFields(
                        { 
                            name: t.moduleStats, 
                            value: `\`\`\`yaml\n${t.commands}: ${totalCommands}\n${t.aliasesStat}: ${totalAliases}\n${t.categories}: ${categoriesCount}\n${t.agents}: ${freshTotalMembers.toLocaleString()}\n${t.guilds}: ${freshTotalGuilds}\`\`\``, 
                            inline: true 
                        },
                        { 
                            name: `🏆 TOP CATEGORIES`, 
                            value: topCategoriesDisplay || 'No data available', 
                            inline: true 
                        },
                        { 
                            name: t.quickAccess, 
                            value: `\`\`\`fix\n${effectivePrefix}game menu\n${effectivePrefix}daily\n${effectivePrefix}rank\n${effectivePrefix}shop\`\`\``, 
                            inline: false 
                        },
                        { 
                            name: t.aiAssistant, 
                            value: `\`\`\`fix\n${t.aiDesc.replace('{prefix}', effectivePrefix)}\`\`\``, 
                            inline: true 
                        },
                        { 
                            name: t.tip, 
                            value: getRandomTip(t, effectivePrefix), 
                            inline: true 
                        }
                    )
                    .setFooter({ 
                        text: `${guildName} • ${t.footer} • v${version} • ${t.selectModuleBelow}`, 
                        iconURL: guildIcon
                    })
                    .setTimestamp();
                
                const disabledRow2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('back_to_main')
                        .setLabel(t.mainMenu)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );
                await i.update({ embeds: [freshMainEmbed], components: [row1, disabledRow2] });
                return;
            }
            
            // Handle Category Selection
            if (i.isStringSelectMenu() && i.customId === 'help_select') {
                const category = i.values[0];
                await showCategoryHelp(client, message, category, effectivePrefix, lang, t, emojiMap, colorMap, i, guildName, guildIcon, version);
                currentView = 'category';
                
                const updatedRow2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('back_to_main')
                        .setLabel(t.backToMain)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(false)
                );
                await response.edit({ components: [row1, updatedRow2] });
            }
        });

        collector.on('end', () => {
            const disabled = new ActionRowBuilder().addComponents(menu.setDisabled(true));
            const disabledButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('back_to_main')
                    .setLabel(t.mainMenu)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );
            response.edit({ components: [disabled, disabledButton] }).catch(() => null);
        });
    }
};

// ================= CATEGORY HELP DISPLAY FUNCTION =================
async function showCategoryHelp(client, message, category, prefix, lang, t, emojiMap, colorMap, interaction, guildName, guildIcon, version) {
    const cmds = client.commands.filter(c => (c.category || 'GENERAL').toUpperCase() === category.toUpperCase());
    const categoryColor = colorMap[category.toUpperCase()] || '#5865F2';
    const categoryEmoji = emojiMap[category.toUpperCase()] || '📁';
    const sortedCmds = [...cmds.values()].sort((a, b) => a.name.localeCompare(b.name));
    
    const commandList = sortedCmds.map(cmd => {
        const aliasesText = cmd.aliases?.length ? ` (${cmd.aliases.slice(0, 3).join(', ')})` : '';
        const examples = cmd.examples?.length ? `\n└─ 📝 ${lang === 'fr' ? 'Exemple' : 'Example'}: \`${prefix}${cmd.name} ${cmd.examples[0]}\`` : '';
        return `**\`${prefix}${cmd.name}\`**${aliasesText}\n└─ *${cmd.description || t.noDescription}*${examples}`;
    }).join('\n\n');
    
    const maxLength = 4000;
    if (commandList.length > maxLength) {
        const chunks = [];
        let currentChunk = '';
        for (const cmd of sortedCmds) {
            const cmdText = `**\`${prefix}${cmd.name}\`**\n└─ *${cmd.description || t.noDescription}*\n\n`;
            if ((currentChunk + cmdText).length > maxLength) {
                chunks.push(currentChunk);
                currentChunk = cmdText;
            } else {
                currentChunk += cmdText;
            }
        }
        if (currentChunk) chunks.push(currentChunk);
        
        const catEmbed = new EmbedBuilder()
            .setColor(categoryColor)
            .setAuthor({ 
                name: `${categoryEmoji} ${category.toUpperCase()} ${t.module} (1/${chunks.length})`, 
                iconURL: client.user.displayAvatarURL() 
            })
            .setTitle(`═ ${t.modulesTitle} ═`)
            .setDescription(chunks[0])
            .setFooter({ 
                text: `${guildName} • ${t.useHelpForDetails.replace('{prefix}', prefix)} • ${t.page} 1/${chunks.length} • v${version}`,
                iconURL: guildIcon
            });
        
        if (interaction) {
            await interaction.update({ embeds: [catEmbed] });
        } else {
            await message.reply({ embeds: [catEmbed] });
        }
        
        for (let idx = 1; idx < chunks.length; idx++) {
            const chunkEmbed = new EmbedBuilder()
                .setColor(categoryColor)
                .setAuthor({ 
                    name: `${categoryEmoji} ${category.toUpperCase()} ${t.module} (${idx+1}/${chunks.length})`, 
                    iconURL: client.user.displayAvatarURL() 
                })
                .setDescription(chunks[idx])
                .setFooter({ 
                    text: `${guildName} • ${t.page} ${idx+1}/${chunks.length} • v${version}`,
                    iconURL: guildIcon
                });
            
            await message.channel.send({ embeds: [chunkEmbed] });
        }
        return;
    }
    
    const catEmbed = new EmbedBuilder()
        .setColor(categoryColor)
        .setAuthor({ 
            name: `${categoryEmoji} ${category.toUpperCase()} ${t.module}`, 
            iconURL: client.user.displayAvatarURL() 
        })
        .setTitle(`═ ${t.modulesTitle} ═`)
        .setDescription(commandList || (lang === 'fr' ? 'Aucune commande trouvée dans cette catégorie.' : 'No commands found in this category.'))
        .addFields(
            { 
                name: t.moduleStatsTitle, 
                value: `\`\`\`yaml\n${t.totalCommands}: ${cmds.size}\n${t.aliasesRegistered}: ${cmds.reduce((sum, cmd) => sum + (cmd.aliases?.length || 0), 0)}\`\`\``, 
                inline: false 
            }
        )
        .setFooter({ 
            text: `${guildName} • ${t.useHelpForDetails.replace('{prefix}', prefix)} • ${cmds.size} ${t.commandsAvailable} • v${version}`,
            iconURL: guildIcon
        })
        .setTimestamp();
    
    if (interaction) {
        await interaction.update({ embeds: [catEmbed] });
    } else {
        await message.reply({ embeds: [catEmbed] });
    }
}