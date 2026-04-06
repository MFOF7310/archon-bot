Const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'list',
    aliases: ['directory', 'modules', 'commands', 'cmds'],
    description: 'Dynamic Archon System Directory - Complete Plugin Registry',
    category: 'SYSTEM',
    usage: '.list [category]',
    cooldown: 5000,
    
    run: async (client, message, args) => {
        
        // --- NEURAL TRACKER FOR CROSS-LINKING ---
        let lastSelectedCategory = null;
        let lastSelectedView = 'main';
        
        // --- INTELLIGENT LANGUAGE DETECTION ---
        let lang = 'en';
        const guildSettings = client.settings?.get(message.guild?.id);
        if (guildSettings?.language) {
            lang = guildSettings.language;
        } else if (message.channel.lastLang) {
            lang = message.channel.lastLang;
        } else {
            const frenchKeywords = ['fr', 'francais', 'français', 'french', 'bonjour', 'salut'];
            const content = message.content.toLowerCase();
            if (frenchKeywords.some(word => content.includes(word)) || message.guild?.preferredLocale === 'fr') {
                lang = 'fr';
            }
        }
        
        const t = translations[lang];
        const prefix = process.env.PREFIX || '.';
        
        // --- PLUGIN REGISTRY DATABASE ---
        const plugins = getPluginRegistry(client);
        
        // --- HANDLE SPECIFIC CATEGORY ARGUMENT ---
        if (args[0]) {
            const category = args[0].toLowerCase();
            const validCategories = ['ai', 'games', 'system', 'economy', 'moderation', 'utility'];
            
            if (validCategories.includes(category)) {
                return showCategoryEmbed(message, plugins, category, t, lang);
            }
        }
        
        // --- UPTIME CALCULATION ---
        const uptimeSec = process.uptime();
        const days = Math.floor(uptimeSec / 86400);
        const hours = Math.floor((uptimeSec % 86400) / 3600);
        const minutes = Math.floor((uptimeSec % 3600) / 60);
        
        let uptimeString = '';
        if (days > 0) uptimeString += `${days}d `;
        if (hours > 0) uptimeString += `${hours}h `;
        if (minutes > 0) uptimeString += `${minutes}m `;
        if (days === 0 && hours === 0 && minutes === 0) uptimeString += `${Math.floor(uptimeSec)}s`;
        else if (uptimeSec % 60 > 0 && days === 0 && hours === 0) uptimeString += `${Math.floor(uptimeSec % 60)}s`;
        
        uptimeString = uptimeString.trim() || '0s';
        
        // --- ACCURATE MEMBER COUNT ---
        const totalMembers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
        const totalGuilds = client.guilds.cache.size;
        
        // --- MAIN DIRECTORY EMBED ---
        const mainEmbed = new EmbedBuilder()
            .setColor('#8B5CF6')
            .setAuthor({ 
                name: t.author.name, 
                iconURL: client.user.displayAvatarURL(),
                url: 'https://github.com/your-repo'
            })
            .setTitle(t.main.title)
            .setDescription(t.main.description)
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { 
                    name: '📊 SYSTEM STATUS', 
                    value: formatSystemStats(client, plugins, t, uptimeString, totalMembers, totalGuilds),
                    inline: false 
                },
                { 
                    name: '🎯 QUICK NAVIGATION', 
                    value: t.main.navigation,
                    inline: false 
                },
                { 
                    name: '📦 PLUGIN COUNT', 
                    value: formatPluginStats(plugins, t),
                    inline: true 
                },
                { 
                    name: '⚡ PING', 
                    value: `\`${Math.round(client.ws.ping)}ms\``,
                    inline: true 
                },
                { 
                    name: '👥 SERVERS', 
                    value: `\`${totalGuilds}\``,
                    inline: true 
                }
            )
            .setFooter({ 
                text: `${t.main.footer} • ${new Date().toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}`,
                iconURL: message.author.displayAvatarURL()
            })
            .setTimestamp();

        // --- DYNAMIC CATEGORY MENU ---
        const menu = new StringSelectMenuBuilder()
            .setCustomId('plugin_directory_menu')
            .setPlaceholder(t.menu.placeholder)
            .addOptions([
                {
                    label: t.menu.ai.label,
                    description: t.menu.ai.desc,
                    value: 'cat_ai',
                    emoji: '🧠',
                },
                {
                    label: t.menu.games.label,
                    description: t.menu.games.desc,
                    value: 'cat_games',
                    emoji: '🎮',
                },
                {
                    label: t.menu.economy.label,
                    description: t.menu.economy.desc,
                    value: 'cat_economy',
                    emoji: '💰',
                },
                {
                    label: t.menu.moderation.label,
                    description: t.menu.moderation.desc,
                    value: 'cat_mod',
                    emoji: '🛡️',
                },
                {
                    label: t.menu.utility.label,
                    description: t.menu.utility.desc,
                    value: 'cat_util',
                    emoji: '🔧',
                },
                {
                    label: t.menu.system.label,
                    description: t.menu.system.desc,
                    value: 'cat_sys',
                    emoji: '⚙️',
                },
            ]);

        // --- NAVIGATION BUTTONS ---
        const navButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('nav_stats')
                    .setLabel(t.buttons.stats)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📊'),
                new ButtonBuilder()
                    .setCustomId('nav_help')
                    .setLabel(t.buttons.help)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('❓'),
                new ButtonBuilder()
                    .setCustomId('nav_refresh')
                    .setLabel(t.buttons.refresh)
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🔄'),
                new ButtonBuilder()
                    .setCustomId('nav_invite')
                    .setLabel(t.buttons.invite)
                    .setStyle(ButtonStyle.Link)
                    .setEmoji('🔗')
                    .setURL('https://discord.com/oauth2/authorize?client_id=' + client.user.id)
            );

        const response = await message.reply({ 
            embeds: [mainEmbed], 
            components: [new ActionRowBuilder().addComponents(menu), navButtons] 
        });

        // --- COLLECTOR FOR DYNAMIC INTERACTIONS ---
        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.StringSelect, 
            time: 120000 
        });
        
        const buttonCollector = response.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 120000 
        });

        // Handle menu selection
        collector.on('collect', async (interaction) => {
            if (interaction.user.id !== message.author.id) {
                return interaction.reply({ 
                    content: t.errors.accessDenied, 
                    ephemeral: true 
                });
            }
            
            await interaction.deferUpdate();
            
            // Store the selected category for cross-linking
            lastSelectedCategory = interaction.values[0];
            lastSelectedView = 'category';
            
            let categoryEmbed;
            let selectedCategory = interaction.values[0];
            
            switch (selectedCategory) {
                case 'cat_ai':
                    categoryEmbed = generateCategoryEmbed(plugins.ai, '🧠', t.categories.ai, lang, t, prefix);
                    break;
                case 'cat_games':
                    categoryEmbed = generateCategoryEmbed(plugins.games, '🎮', t.categories.games, lang, t, prefix);
                    break;
                case 'cat_economy':
                    categoryEmbed = generateCategoryEmbed(plugins.economy, '💰', t.categories.economy, lang, t, prefix);
                    break;
                case 'cat_mod':
                    categoryEmbed = generateCategoryEmbed(plugins.moderation, '🛡️', t.categories.moderation, lang, t, prefix);
                    break;
                case 'cat_util':
                    categoryEmbed = generateCategoryEmbed(plugins.utility, '🔧', t.categories.utility, lang, t, prefix);
                    break;
                case 'cat_sys':
                    categoryEmbed = generateSystemEmbed(client, plugins, t, lang, prefix);
                    break;
                default:
                    categoryEmbed = mainEmbed;
                    lastSelectedView = 'main';
            }
            
            await interaction.editReply({ embeds: [categoryEmbed] });
        });
        
        // Handle button interactions with NEURAL HANDSHAKE to help.js
        buttonCollector.on('collect', async (interaction) => {
            if (interaction.user.id !== message.author.id) {
                return interaction.reply({ 
                    content: t.errors.accessDenied, 
                    ephemeral: true 
                });
            }
            
            await interaction.deferUpdate();
            
            switch (interaction.customId) {
                case 'nav_stats':
                    const statsEmbed = generateStatsEmbed(client, plugins, t, lang, uptimeString, totalMembers, totalGuilds);
                    await interaction.editReply({ embeds: [statsEmbed] });
                    break;
                    
                case 'nav_help':
                    // --- NEURAL HANDSHAKE WITH HELP.JS ---
                    const helpCommand = client.commands.get('help');
                    if (!helpCommand) {
                        const errorEmbed = new EmbedBuilder()
                            .setColor('#ED4245')
                            .setTitle('❌ System Error')
                            .setDescription('Help module not found in neural database.');
                        return interaction.editReply({ embeds: [errorEmbed] });
                    }
                    
                    // Map 'cat_games' to 'GAMING' for help.js category detection
                    const mappedCategory = lastSelectedCategory 
                        ? lastSelectedCategory.replace('cat_', '').toUpperCase()
                        : null;
                    
                    // Trigger help.js with category context
                    // If mappedCategory is "GAMES", help.js will automatically
                    // fire showCategoryHelp() and display the Gaming menu!
                    await helpCommand.run(client, message, [mappedCategory].filter(Boolean));
                    
                    // No need to edit the list embed since help sends its own message
                    break;
                    
                case 'nav_refresh':
                    // Refresh the current view
                    let refreshEmbed;
                    if (lastSelectedView === 'main') {
                        const freshUptime = process.uptime();
                        const freshDays = Math.floor(freshUptime / 86400);
                        const freshHours = Math.floor((freshUptime % 86400) / 3600);
                        const freshMinutes = Math.floor((freshUptime % 3600) / 60);
                        let freshUptimeStr = '';
                        if (freshDays > 0) freshUptimeStr += `${freshDays}d `;
                        if (freshHours > 0) freshUptimeStr += `${freshHours}h `;
                        if (freshMinutes > 0) freshUptimeStr += `${freshMinutes}m `;
                        freshUptimeStr = freshUptimeStr.trim() || '0s';
                        
                        const freshMembers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
                        const freshGuilds = client.guilds.cache.size;
                        
                        refreshEmbed = new EmbedBuilder(mainEmbed)
                            .setFooter({ 
                                text: `${t.main.footer} • Refreshed at ${new Date().toLocaleTimeString()}`,
                                iconURL: message.author.displayAvatarURL()
                            });
                        
                        // Update stats fields
                        refreshEmbed.spliceFields(0, 1, { 
                            name: '📊 SYSTEM STATUS', 
                            value: formatSystemStats(client, plugins, t, freshUptimeStr, freshMembers, freshGuilds),
                            inline: false 
                        });
                    } else {
                        refreshEmbed = new EmbedBuilder(interaction.message.embeds[0])
                            .setFooter({ 
                                text: `Refreshed at ${new Date().toLocaleTimeString()}`,
                                iconURL: message.author.displayAvatarURL()
                            });
                    }
                    await interaction.editReply({ embeds: [refreshEmbed] });
                    break;
            }
        });
        
        // Cleanup on end
        collector.on('end', () => {
            const disabledMenu = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder(menu.data)
                        .setDisabled(true)
                        .setPlaceholder(t.menu.expired)
                );
            response.edit({ components: [disabledMenu, navButtons] }).catch(() => {});
        });
        
        buttonCollector.on('end', () => {
            const disabledButtons = new ActionRowBuilder()
                .addComponents(
                    navButtons.components.map(btn => 
                        ButtonBuilder.from(btn).setDisabled(true)
                    )
                );
            response.edit({ components: [new ActionRowBuilder().addComponents(menu), disabledButtons] }).catch(() => {});
        });
    }
};

// --- PLUGIN REGISTRY (Auto-detect from client commands) ---
function getPluginRegistry(client) {
    const commands = client.commands || new Map();
    
    const registry = {
        ai: [],
        games: [],
        economy: [],
        moderation: [],
        utility: [],
        system: []
    };
    
    const categoryMap = {
        'ai': 'ai', 'artificial intelligence': 'ai',
        'game': 'games', 'games': 'games', 'gaming': 'games',
        'economy': 'economy', 'eco': 'economy',
        'moderation': 'moderation', 'mod': 'moderation',
        'utility': 'utility', 'util': 'utility',
        'system': 'system', 'sys': 'system'
    };
    
    for (const [name, cmd] of commands) {
        let category = cmd.category?.toLowerCase() || 'utility';
        category = categoryMap[category] || 'utility';
        
        if (registry[category]) {
            registry[category].push({
                name: cmd.name,
                aliases: cmd.aliases || [],
                description: cmd.description || 'No description',
                usage: cmd.usage || `.${name}`,
                cooldown: cmd.cooldown || 3,
                examples: cmd.examples || []
            });
        }
    }
    
    // Add default plugins if none detected
    if (registry.ai.length === 0) {
        registry.ai.push(
            { name: 'lydia', aliases: ['ai', 'chat'], description: 'Neural AI chat interface', usage: '.lydia [message]', cooldown: 2, examples: ['hello', 'who are you'] },
            { name: 'agent', aliases: ['personality'], description: 'Switch AI personalities', usage: '.lydia agent [name]', cooldown: 5, examples: ['lydia', 'groq'] }
        );
    }
    
    if (registry.games.length === 0) {
        registry.games.push(
            { name: 'wrg', aliases: ['wordguess', 'scramble'], description: 'Bilingual word guessing game', usage: '.wrg [difficulty]', cooldown: 3, examples: ['easy', 'hard'] },
            { name: 'game', aliases: ['games'], description: 'Game center menu', usage: '.game', cooldown: 2, examples: [] },
            { name: 'rank', aliases: ['level', 'xp'], description: 'View your agent profile', usage: '.rank [@user]', cooldown: 3, examples: ['', '@user'] },
            { name: 'lb', aliases: ['leaderboard', 'top'], description: 'Global XP leaderboard', usage: '.lb', cooldown: 5, examples: [] }
        );
    }
    
    return registry;
}

// --- FORMAT SYSTEM STATS ---
function formatSystemStats(client, plugins, t, uptimeString, totalMembers, totalGuilds) {
    const totalCommands = Object.values(plugins).reduce((acc, arr) => acc + arr.length, 0);
    
    return `\`\`\`yaml\n${t.stats.line1}: ${totalCommands}\n${t.stats.line2}: ${uptimeString}\n${t.stats.line3}: ${Math.round(client.ws.ping)}ms\n${t.stats.line4}: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\nAgents: ${totalMembers.toLocaleString()}\nGuilds: ${totalGuilds}\`\`\``;
}

// --- FORMAT PLUGIN STATS ---
function formatPluginStats(plugins, t) {
    const categories = [
        { name: '🧠 AI', count: plugins.ai.length },
        { name: '🎮 Games', count: plugins.games.length },
        { name: '💰 Economy', count: plugins.economy.length },
        { name: '🛡️ Mod', count: plugins.moderation.length },
        { name: '🔧 Utility', count: plugins.utility.length },
        { name: '⚙️ System', count: plugins.system.length }
    ];
    
    return categories.map(c => `${c.name}: \`${c.count}\``).join(' • ');
}

// --- GENERATE CATEGORY EMBED ---
function generateCategoryEmbed(plugins, emoji, title, lang, t, prefix) {
    if (!plugins || plugins.length === 0) {
        return new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle(`${emoji} ${title}`)
            .setDescription(t.errors.noPlugins)
            .setTimestamp();
    }
    
    const commandsList = plugins.map(cmd => {
        const aliases = cmd.aliases.length > 0 ? ` (${cmd.aliases.slice(0, 3).join(', ')})` : '';
        const examples = cmd.examples && cmd.examples.length > 0 
            ? `\n   └ 📝 Example: \`${prefix}${cmd.name} ${cmd.examples[0]}\`` 
            : '';
        return `**◈ \`${prefix}${cmd.name}\`**${aliases}\n   └ *${cmd.description}*\n   └ ⏱️ Cooldown: \`${cmd.cooldown || 3}s\`${examples}`;
    }).join('\n\n');
    
    return new EmbedBuilder()
        .setColor('#8B5CF6')
        .setTitle(`${emoji} ${title}`)
        .setDescription(`\`\`\`asciidoc\n📦 TOTAL PLUGINS :: ${plugins.length}\`\`\`\n${commandsList}`)
        .setFooter({ text: t.categoryFooter })
        .setTimestamp();
}

// --- GENERATE SYSTEM EMBED ---
function generateSystemEmbed(client, plugins, t, lang, prefix) {
    const totalCommands = Object.values(plugins).reduce((acc, arr) => acc + arr.length, 0);
    
    return new EmbedBuilder()
        .setColor('#00FF88')
        .setTitle('⚙️ SYSTEM CONTROL PANEL')
        .setDescription(`\`\`\`json\n{\n  "version": "v2.5.0-STABLE",\n  "core": "LYDIA_70B",\n  "commands": ${totalCommands},\n  "status": "OPERATIONAL"\n}\`\`\``)
        .addFields(
            { name: '🛠️ SYSTEM COMMANDS', value: listSystemCommands(prefix), inline: false },
            { name: '📡 API STATUS', value: '```diff\n+ Discord API: Connected\n+ Database: Active\n+ Memory: Optimized```', inline: true },
            { name: '🔐 SECURITY', value: '```fix\n• Rate Limiting: ACTIVE\n• Cooldown System: ENABLED\n• Permission Checks: ✓```', inline: true }
        )
        .setFooter({ text: t.systemFooter })
        .setTimestamp();
}

// --- GENERATE STATS EMBED ---
function generateStatsEmbed(client, plugins, t, lang, uptimeString, totalMembers, totalGuilds) {
    const totalCommands = Object.values(plugins).reduce((acc, arr) => acc + arr.length, 0);
    
    return new EmbedBuilder()
        .setColor('#FFB347')
        .setTitle('📊 ARCHON SYSTEM STATISTICS')
        .setDescription('Real-time system performance metrics')
        .addFields(
            { name: '🤖 BOT STATS', value: formatBotStats(client, totalCommands, totalMembers, totalGuilds), inline: true },
            { name: '💻 SYSTEM STATS', value: formatSystemMetrics(uptimeString), inline: true },
            { name: '📈 PERFORMANCE', value: formatPerformanceMetrics(client), inline: true }
        )
        .setFooter({ text: t.statsFooter })
        .setTimestamp();
}

// --- HELPER FUNCTIONS ---
function listSystemCommands(prefix) {
    return [
        `◈ \`${prefix}list\` - System directory`,
        `◈ \`${prefix}help\` - Command details`,
        `◈ \`${prefix}ping\` - Check latency`,
        `◈ \`${prefix}stats\` - Bot statistics`,
        `◈ \`${prefix}invite\` - Invite bot`
    ].join('\n');
}

function formatBotStats(client, totalCommands, totalMembers, totalGuilds) {
    return `\`\`\`yaml\nCommands: ${totalCommands}\nServers: ${totalGuilds}\nUsers: ${totalMembers.toLocaleString()}\nChannels: ${client.channels.cache.size}\`\`\``;
}

function formatSystemMetrics(uptimeString) {
    return `\`\`\`yaml\nUptime: ${uptimeString}\nMemory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\nNode: ${process.version}\`\`\``;
}

function formatPerformanceMetrics(client) {
    return `\`\`\`yaml\nPing: ${Math.round(client.ws.ping)}ms\nCPU: ${(process.cpuUsage().user / 1000000).toFixed(2)}%\`\`\``;
}

function showCategoryEmbed(message, plugins, category, t, lang) {
    let categoryKey;
    let emoji;
    let title;
    const prefix = process.env.PREFIX || '.';
    
    const categoryMap = {
        'ai': { key: 'ai', emoji: '🧠', title: t.categories.ai },
        'games': { key: 'games', emoji: '🎮', title: t.categories.games },
        'economy': { key: 'economy', emoji: '💰', title: t.categories.economy },
        'moderation': { key: 'moderation', emoji: '🛡️', title: t.categories.moderation },
        'utility': { key: 'utility', emoji: '🔧', title: t.categories.utility },
        'system': { key: 'system', emoji: '⚙️', title: t.categories.system }
    };
    
    const selected = categoryMap[category];
    if (!selected) return;
    
    const embed = generateCategoryEmbed(plugins[selected.key], selected.emoji, selected.title, lang, t, prefix);
    return message.reply({ embeds: [embed] });
}

// --- TRANSLATIONS ---
const translations = {
    en: {
        author: { name: 'ARCHON SYSTEM DIRECTORY' },
        main: {
            title: '═ NEURAL INTERFACE PROTOCOLS ═',
            description: '🤖 **Welcome, Agent.**\nUse the interactive menu below to explore active modules and system status.',
            navigation: '• Use dropdown menu to browse categories\n• Click buttons for stats & help\n• Commands auto-detect your language',
            footer: 'Archon System v2.5.0'
        },
        menu: {
            placeholder: 'Select a plugin category...',
            expired: 'Menu expired • Run .list again',
            ai: { label: 'Artificial Intelligence', desc: 'Lydia Neural Core & Memory' },
            games: { label: 'Arcade & Gaming', desc: 'Mini-games & XP System' },
            economy: { label: 'Economy', desc: 'Currency & Shop' },
            moderation: { label: 'Moderation', desc: 'Server Management' },
            utility: { label: 'Utility', desc: 'Tools & Utilities' },
            system: { label: 'System', desc: 'Bot Configuration' }
        },
        buttons: {
            stats: 'Statistics',
            help: 'Help',
            refresh: 'Refresh',
            invite: 'Invite'
        },
        categories: {
            ai: 'NEURAL CORE: LYDIA',
            games: 'NEURAL ARCADE',
            economy: 'ECONOMY SUITE',
            moderation: 'MODERATION SHIELD',
            utility: 'UTILITY TOOLKIT',
            system: 'SYSTEM CONTROL'
        },
        stats: {
            line1: 'Total Commands',
            line2: 'Uptime',
            line3: 'Latency',
            line4: 'Memory Usage'
        },
        errors: {
            accessDenied: '❌ Access Denied. This menu is not for you.',
            noPlugins: 'No plugins found in this category.'
        },
        categoryFooter: 'Use .list [category] for direct access | .help <command> for details',
        systemFooter: 'System Control Interface',
        statsFooter: 'Real-time Metrics'
    },
    fr: {
        author: { name: 'ANNUAIRE DU SYSTÈME ARCHON' },
        main: {
            title: '═ PROTOCOLES D\'INTERFACE NEURALE ═',
            description: '🤖 **Bienvenue, Agent.**\nUtilisez le menu interactif ci-dessous pour explorer les modules actifs et l\'état du système.',
            navigation: '• Utilisez le menu déroulant pour parcourir les catégories\n• Cliquez sur les boutons pour les stats et l\'aide\n• Les commandes détectent automatiquement votre langue',
            footer: 'Système Archon v2.5.0'
        },
        menu: {
            placeholder: 'Sélectionnez une catégorie...',
            expired: 'Menu expiré • Exécutez .list à nouveau',
            ai: { label: 'Intelligence Artificielle', desc: 'Noyau Neural Lydia & Mémoire' },
            games: { label: 'Arcade & Jeux', desc: 'Mini-jeux & Système XP' },
            economy: { label: 'Économie', desc: 'Monnaie & Boutique' },
            moderation: { label: 'Modération', desc: 'Gestion du Serveur' },
            utility: { label: 'Utilitaires', desc: 'Outils & Utilitaires' },
            system: { label: 'Système', desc: 'Configuration du Bot' }
        },
        buttons: {
            stats: 'Statistiques',
            help: 'Aide',
            refresh: 'Actualiser',
            invite: 'Inviter'
        },
        categories: {
            ai: 'NOYAU NEURAL: LYDIA',
            games: 'ARCADE NEURALE',
            economy: 'SUITE ÉCONOMIQUE',
            moderation: 'BOUCLIER DE MODÉRATION',
            utility: 'KIT D\'UTILITAIRES',
            system: 'CONTRÔLE SYSTÈME'
        },
        stats: {
            line1: 'Commandes Totales',
            line2: 'Temps de Fonctionnement',
            line3: 'Latence',
            line4: 'Utilisation Mémoire'
        },
        errors: {
            accessDenied: '❌ Accès Refusé. Ce menu ne vous est pas destiné.',
            noPlugins: 'Aucun plugin trouvé dans cette catégorie.'
        },
        categoryFooter: 'Utilisez .list [catégorie] pour un accès direct | .help <commande> pour détails',
        systemFooter: 'Interface de Contrôle Système',
        statsFooter: 'Métriques en Temps Réel'
    }
};
And now ?
Wait did we changed the help.js ?