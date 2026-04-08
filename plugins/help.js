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
        page: 'Page'
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
        page: 'Page'
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

module.exports = {
    name: 'help',
    aliases: ['h', 'menu', 'docs', 'aide', 'commandes'],
    description: 'Access the ARCHITECT Neural Directory and command database with advanced navigation.',
    category: 'SYSTEM',
    cooldown: 3000,

    run: async (client, message, args, database, serverSettings) => {
        // ================= PREFIX & LANGUAGE SETUP =================
        const effectivePrefix = serverSettings?.prefix || process.env.PREFIX || '.';
        const lang = serverSettings?.language || 'en';
        const t = translations[lang];
        
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
                return showCategoryHelp(client, message, searchTerm, effectivePrefix, lang, t, emojiMap, colorMap);
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
                        { name: `📂 ${t.category}`, value: `\`${category}\``, inline: true },
                        { name: `🔧 ${t.usage}`, value: `\`${effectivePrefix}${cmd.name} ${cmd.usage || ''}\``.trim(), inline: true },
                        { name: `🔀 ${t.aliases}`, value: `\`${cmd.aliases?.join(', ') || t.none}\``, inline: true },
                        { name: `🎯 ${t.examples}`, value: cmd.examples ? `\`${cmd.examples.map(ex => `${effectivePrefix}${cmd.name} ${ex}`).join('`\n`')}\`` : `\`${t.noExamples}\``, inline: false }
                    )
                    .setFooter({ 
                        text: `ARCHITECT CG-223 • ${t.bamakoNode} • ${client.commands.size} ${t.modulesOnline} • v${client.version || '1.5.0'}` 
                    })
                    .setTimestamp();

                if (cmd.cooldown) {
                    detailEmbed.addFields({ 
                        name: `⏱️ ${t.cooldown}`, 
                        value: `\`${cmd.cooldown/1000} ${t.seconds}\``, 
                        inline: true 
                    });
                }

                return message.reply({ embeds: [detailEmbed] });
            }

            // Not found
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setAuthor({ name: t.signalLost, iconURL: client.user.displayAvatarURL() })
                .setTitle(t.commandNotFound)
                .setDescription(t.notFoundDesc(args[0], effectivePrefix))
                .setFooter({ text: t.checkSpelling })
                .setTimestamp();
            return message.reply({ embeds: [errorEmbed] });
        }

        // ================= MAIN DIRECTORY (No args) =================
        const categories = [...new Set(client.commands.map(cmd => cmd.category || 'GENERAL'))].sort();
        
        const totalCommands = client.commands.size;
        const totalAliases = client.aliases?.size || 0;
        const categoriesCount = categories.length;
        
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
                `└─ ${t.version}: v${client.version || '1.5.0'}\`\`\``
            )
            .addFields(
                { 
                    name: t.moduleStats, 
                    value: `\`\`\`yaml\n${t.commands}: ${totalCommands}\n${t.aliasesStat}: ${totalAliases}\n${t.categories}: ${categoriesCount}\n${t.agents}: ${totalMembers.toLocaleString()}\n${t.guilds}: ${totalGuilds}\`\`\``, 
                    inline: true 
                },
                { 
                    name: t.quickAccess, 
                    value: `\`\`\`fix\n${effectivePrefix}game menu\n${effectivePrefix}stats\n${effectivePrefix}rank\n${effectivePrefix}alive\`\`\``, 
                    inline: true 
                },
                { 
                    name: t.aiAssistant, 
                    value: `\`\`\`fix\n${t.aiDesc.replace('{prefix}', effectivePrefix)}\`\`\``, 
                    inline: true 
                }
            )
            .setFooter({ 
                text: `${t.footer} • v${client.version || '1.5.0'} • ${t.selectModuleBelow}`, 
                iconURL: client.user.displayAvatarURL() 
            })
            .setTimestamp();

        // Create Select Menu with translated descriptions
        const menu = new StringSelectMenuBuilder()
            .setCustomId('help_select')
            .setPlaceholder(t.selectPlaceholder)
            .addOptions(categories.map(cat => ({
                label: cat.toUpperCase(),
                value: cat,
                description: t.viewAll.replace('{category}', cat.toLowerCase()),
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
                        `└─ ${t.version}: v${client.version || '1.5.0'}\`\`\``
                    )
                    .addFields(
                        { 
                            name: t.moduleStats, 
                            value: `\`\`\`yaml\n${t.commands}: ${totalCommands}\n${t.aliasesStat}: ${totalAliases}\n${t.categories}: ${categoriesCount}\n${t.agents}: ${freshTotalMembers.toLocaleString()}\n${t.guilds}: ${freshTotalGuilds}\`\`\``, 
                            inline: true 
                        },
                        { 
                            name: t.quickAccess, 
                            value: `\`\`\`fix\n${effectivePrefix}game menu\n${effectivePrefix}stats\n${effectivePrefix}rank\n${effectivePrefix}alive\`\`\``, 
                            inline: true 
                        },
                        { 
                            name: t.aiAssistant, 
                            value: `\`\`\`fix\n${t.aiDesc.replace('{prefix}', effectivePrefix)}\`\`\``, 
                            inline: true 
                        }
                    )
                    .setFooter({ 
                        text: `${t.footer} • v${client.version || '1.5.0'} • ${t.selectModuleBelow}`, 
                        iconURL: client.user.displayAvatarURL() 
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
                await showCategoryHelp(client, message, category, effectivePrefix, lang, t, emojiMap, colorMap, i);
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
async function showCategoryHelp(client, message, category, prefix, lang, t, emojiMap, colorMap, interaction = null) {
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
                text: `${t.useHelpForDetails.replace('{prefix}', prefix)} • ${t.page} 1/${chunks.length} • v${client.version || '1.5.0'}` 
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
                    text: `${t.page} ${idx+1}/${chunks.length} • ${t.useHelpForDetails.replace('{prefix}', prefix)} • v${client.version || '1.5.0'}` 
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
            text: `${t.useHelpForDetails.replace('{prefix}', prefix)} • ${cmds.size} ${t.commandsAvailable} • v${client.version || '1.5.0'}`, 
            iconURL: client.user.displayAvatarURL() 
        })
        .setTimestamp();
    
    if (interaction) {
        await interaction.update({ embeds: [catEmbed] });
    } else {
        await message.reply({ embeds: [catEmbed] });
    }
}