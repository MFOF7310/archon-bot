const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Terminal colors for logging
const green = "\x1b[32m", cyan = "\x1b[36m", yellow = "\x1b[33m", red = "\x1b[31m", reset = "\x1b[0m";

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        // Headers
        title: '📋 NEURAL CHANGELOG',
        systemStatus: 'SYSTEM STATUS',
        versionHistory: 'VERSION HISTORY',
        currentVersion: 'CURRENT VERSION',
        releasedOn: 'Released',
        
        // Stats
        totalVersions: 'Total Versions',
        latestUpdate: 'Latest Update',
        modules: 'Active Modules',
        
        // Categories
        newFeatures: '🆕 NEW FEATURES',
        enhancements: '⚡ ENHANCEMENTS',
        bugFixes: '🐛 BUG FIXES',
        improvements: '🔧 IMPROVEMENTS',
        security: '🔒 SECURITY',
        deprecated: '⚠️ DEPRECATED',
        localization: '🌐 LOCALIZATION',
        performance: '🚀 PERFORMANCE',
        database: '💾 DATABASE',
        api: '🔌 API INTEGRATION',
        
        // Buttons
        previous: '◀ Previous',
        next: 'Next ▶',
        latest: '🆕 Latest',
        overview: '📊 Overview',
        details: '📝 Details',
        jumpTo: 'Jump to Version',
        refresh: '🔄 Refresh',
        github: '🔗 GitHub',
        
        // Placeholders
        selectVersion: 'Select a version to view...',
        loading: '🔍 Scanning neural archives...',
        noChangelog: '❌ CHANGELOG.md not found in system root.',
        error: '❌ Neural sync error. Please try again.',
        createHint: '💡 Create CHANGELOG.md in bot root directory',
        
        // Footer
        footer: 'ARCHITECT CG-223 • Neural Changelog System',
        madeBy: 'Built by Moussa Fofana',
        node: 'BAMAKO-223',
        
        // Status messages
        stable: '🟢 STABLE',
        beta: '🟡 BETA',
        alpha: '🔴 ALPHA',
        lts: '🔷 LTS',
        
        // Time
        today: 'Today',
        yesterday: 'Yesterday',
        daysAgo: (days) => `${days} days ago`,
        justNow: 'Just now',
        
        // Misc
        page: 'Page',
        version: 'Version'
    },
    fr: {
        // Headers
        title: '📋 JOURNAL NEURAL',
        systemStatus: 'ÉTAT DU SYSTÈME',
        versionHistory: 'HISTORIQUE DES VERSIONS',
        currentVersion: 'VERSION ACTUELLE',
        releasedOn: 'Publié le',
        
        // Stats
        totalVersions: 'Total Versions',
        latestUpdate: 'Dernière MÀJ',
        modules: 'Modules Actifs',
        
        // Categories
        newFeatures: '🆕 NOUVEAUTÉS',
        enhancements: '⚡ AMÉLIORATIONS',
        bugFixes: '🐛 CORRECTIONS',
        improvements: '🔧 OPTIMISATIONS',
        security: '🔒 SÉCURITÉ',
        deprecated: '⚠️ OBSOLÈTE',
        localization: '🌐 LOCALISATION',
        performance: '🚀 PERFORMANCE',
        database: '💾 BASE DE DONNÉES',
        api: '🔌 INTÉGRATION API',
        
        // Buttons
        previous: '◀ Précédent',
        next: 'Suivant ▶',
        latest: '🆕 Récent',
        overview: '📊 Aperçu',
        details: '📝 Détails',
        jumpTo: 'Aller à la Version',
        refresh: '🔄 Actualiser',
        github: '🔗 GitHub',
        
        // Placeholders
        selectVersion: 'Sélectionnez une version...',
        loading: '🔍 Analyse des archives neurales...',
        noChangelog: '❌ CHANGELOG.md introuvable dans le système.',
        error: '❌ Erreur de synchronisation neurale.',
        createHint: '💡 Créez CHANGELOG.md dans le dossier racine',
        
        // Footer
        footer: 'ARCHITECT CG-223 • Journal Neural',
        madeBy: 'Développé par Moussa Fofana',
        node: 'BAMAKO-223',
        
        // Status messages
        stable: '🟢 STABLE',
        beta: '🟡 BÊTA',
        alpha: '🔴 ALPHA',
        lts: '🔷 LTS',
        
        // Time
        today: "Aujourd'hui",
        yesterday: 'Hier',
        daysAgo: (days) => `Il y a ${days} jours`,
        justNow: "À l'instant",
        
        // Misc
        page: 'Page',
        version: 'Version'
    }
};

// ================= CATEGORY ICONS & COLORS =================
const CATEGORY_STYLES = {
    'NEW FEATURES': { emoji: '🆕', color: '#2ecc71', priority: 1 },
    'NOUVEAUTÉS': { emoji: '🆕', color: '#2ecc71', priority: 1 },
    'ENHANCEMENTS': { emoji: '⚡', color: '#3498db', priority: 2 },
    'AMÉLIORATIONS': { emoji: '⚡', color: '#3498db', priority: 2 },
    'BUG FIXES': { emoji: '🐛', color: '#e74c3c', priority: 3 },
    'CORRECTIONS': { emoji: '🐛', color: '#e74c3c', priority: 3 },
    'IMPROVEMENTS': { emoji: '🔧', color: '#f39c12', priority: 4 },
    'OPTIMISATIONS': { emoji: '🔧', color: '#f39c12', priority: 4 },
    'SECURITY': { emoji: '🔒', color: '#9b59b6', priority: 5 },
    'SÉCURITÉ': { emoji: '🔒', color: '#9b59b6', priority: 5 },
    'PERFORMANCE': { emoji: '🚀', color: '#1abc9c', priority: 6 },
    'DATABASE': { emoji: '💾', color: '#e67e22', priority: 7 },
    'BASE DE DONNÉES': { emoji: '💾', color: '#e67e22', priority: 7 },
    'API': { emoji: '🔌', color: '#00bcd4', priority: 8 },
    'LOCALIZATION': { emoji: '🌐', color: '#2ecc71', priority: 9 },
    'LOCALISATION': { emoji: '🌐', color: '#2ecc71', priority: 9 },
    'DEPRECATED': { emoji: '⚠️', color: '#95a5a6', priority: 10 },
    'OBSOLÈTE': { emoji: '⚠️', color: '#95a5a6', priority: 10 }
};

// ================= VERSION STATUS DETECTION =================
function getVersionStatus(version, index, total) {
    if (index === 0) return 'stable';
    if (version.includes('beta')) return 'beta';
    if (version.includes('alpha')) return 'alpha';
    if (version.includes('lts')) return 'lts';
    if (index < total - 3) return 'stable';
    return 'stable';
}

// ================= TIME FORMATTING =================
function formatRelativeTime(dateString, lang) {
    const t = translations[lang];
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return t.today;
    if (diffDays === 1) return t.yesterday;
    if (diffDays < 7) return t.daysAgo(diffDays);
    
    return `<t:${Math.floor(date.getTime() / 1000)}:D>`;
}

// ================= FIND CHANGELOG FILE =================
function findChangelogFile() {
    const possiblePaths = [
        path.join(__dirname, '../CHANGELOG.md'),
        path.join(__dirname, '../changelog.md'),
        path.join(__dirname, '../CHANGELOG.txt'),
        path.join(__dirname, '../changelog.txt'),
        path.join(process.cwd(), 'CHANGELOG.md'),
        path.join(process.cwd(), 'changelog.md'),
    ];
    
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            console.log(`${green}[CHANGELOG]${reset} Found at: ${p}`);
            return p;
        }
    }
    
    console.log(`${yellow}[CHANGELOG]${reset} No changelog file found`);
    return null;
}

// ================= INTELLIGENT CHANGELOG PARSER =================
function parseChangelogIntelligent(content) {
    const versions = [];
    
    // Enhanced regex to capture version, date, and title
    const versionRegex = /##\s*\[v?(\d+\.\d+\.\d+(?:-[a-zA-Z]+)?(?:\.[0-9]+)?)\]\s*(?:-\s*([^\n]+))?(?:\s*\((\d{4}-\d{2}-\d{2})\))?/gi;
    const matches = [...content.matchAll(versionRegex)];
    
    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const version = match[1];
        const title = match[2] || 'Update';
        const date = match[3] || new Date().toISOString().split('T')[0];
        const startIndex = match.index;
        const endIndex = i < matches.length - 1 ? matches[i + 1].index : content.length;
        
        let section = content.substring(startIndex, endIndex).trim();
        
        // Parse categories within this version
        const categories = parseCategories(section);
        
        versions.push({
            version: version,
            title: title,
            date: date,
            content: section,
            categories: categories,
            status: getVersionStatus(version, i, matches.length)
        });
    }
    
    return versions;
}

// ================= CATEGORY PARSER =================
function parseCategories(section) {
    const categories = [];
    const categoryRegex = /###\s+([🆕⚡🐛🔧🔒⚠️🌐🚀💾🔌]?\s*[A-ZÉÀÈÙÂÊÎÔÛÄËÏÖÜŸ\s]+)/gi;
    const matches = [...section.matchAll(categoryRegex)];
    
    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const categoryName = match[1].trim();
        const startIndex = match.index;
        const endIndex = i < matches.length - 1 ? matches[i + 1].index : section.length;
        
        let categoryContent = section.substring(startIndex, endIndex).trim();
        
        // Extract bullet points
        const items = [];
        const bulletRegex = /^[-*•]\s+(.+)$/gm;
        const bulletMatches = [...categoryContent.matchAll(bulletRegex)];
        
        for (const bullet of bulletMatches) {
            items.push(bullet[1].trim());
        }
        
        const style = CATEGORY_STYLES[categoryName] || { emoji: '📝', color: '#5865F2', priority: 99 };
        
        categories.push({
            name: categoryName,
            emoji: style.emoji,
            color: style.color,
            priority: style.priority,
            items: items
        });
    }
    
    // Sort by priority
    return categories.sort((a, b) => a.priority - b.priority);
}

// ================= CREATE STATISTICS CARD =================
function generateStatistics(versions, lang) {
    const t = translations[lang];
    const totalVersions = versions.length;
    const latestVersion = versions[0]?.version || 'N/A';
    const latestDate = versions[0]?.date || new Date().toISOString().split('T')[0];
    
    // Count total changes
    let totalChanges = 0;
    let newFeatures = 0;
    let bugFixes = 0;
    
    for (const v of versions) {
        for (const cat of v.categories) {
            totalChanges += cat.items.length;
            if (cat.name.includes('NEW') || cat.name.includes('NOUVEAU')) newFeatures += cat.items.length;
            if (cat.name.includes('BUG') || cat.name.includes('CORRECTION')) bugFixes += cat.items.length;
        }
    }
    
    return {
        totalVersions,
        latestVersion,
        latestDate,
        totalChanges,
        newFeatures,
        bugFixes,
        averageChangesPerVersion: totalVersions > 0 ? (totalChanges / totalVersions).toFixed(1) : '0.0'
    };
}

// ================= CREATE OVERVIEW EMBED =================
function createOverviewEmbed(versions, stats, lang, client) {
    const t = translations[lang];
    const version = client.version || stats.latestVersion;
    
    const embed = new EmbedBuilder()
        .setColor('#00fbff')
        .setAuthor({ 
            name: `🏗️ ARCHITECT CG-223 • ${t.title}`, 
            iconURL: client.user.displayAvatarURL() 
        })
        .setTitle(`⚡ ${t.systemStatus}`)
        .setDescription(
            `\`\`\`prolog\n` +
            `┌─ ${t.node}: BAMAKO-223\n` +
            `├─ ${t.currentVersion}: v${version}\n` +
            `├─ ${t.releasedOn}: ${new Date(stats.latestDate).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n` +
            `├─ Status: ${t[versions[0]?.status || 'stable']}\n` +
            `└─ Core: Groq LPU™ 70B\`\`\``
        )
        .addFields(
            {
                name: '📊 ' + (lang === 'fr' ? 'STATISTIQUES' : 'STATISTICS'),
                value: `\`\`\`yaml\n` +
                       `${t.totalVersions}: ${stats.totalVersions}\n` +
                       `${lang === 'fr' ? 'Total Modifications' : 'Total Changes'}: ${stats.totalChanges}\n` +
                       `${lang === 'fr' ? 'Nouvelles Fonctionnalités' : 'New Features'}: ${stats.newFeatures}\n` +
                       `${lang === 'fr' ? 'Corrections' : 'Bug Fixes'}: ${stats.bugFixes}\n` +
                       `${lang === 'fr' ? 'Moyenne par Version' : 'Average per Version'}: ${stats.averageChangesPerVersion}\`\`\``,
                inline: true
            },
            {
                name: '📋 ' + (lang === 'fr' ? 'VERSIONS RÉCENTES' : 'RECENT VERSIONS'),
                value: versions.slice(0, 5).map((v, i) => 
                    `${i === 0 ? '🆕' : '📌'} **v${v.version}** - ${v.title}\n└─ ${formatRelativeTime(v.date, lang)}`
                ).join('\n\n') || (lang === 'fr' ? 'Aucune version trouvée' : 'No versions found'),
                inline: false
            }
        )
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 512 }))
        .setFooter({ 
            text: `${t.footer} • ${t.madeBy} • v${version}`,
            iconURL: client.user.displayAvatarURL()
        })
        .setTimestamp();
    
    return embed;
}

// ================= CREATE DETAIL EMBED =================
function createDetailEmbed(versionData, page, totalPages, lang, client) {
    const t = translations[lang];
    const version = client.version || versionData.version;
    
    // Build description with categories
    let description = '';
    
    for (const cat of versionData.categories) {
        if (cat.items.length === 0) continue;
        
        description += `### ${cat.emoji} ${cat.name}\n`;
        for (const item of cat.items) {
            description += `• ${item}\n`;
        }
        description += '\n';
    }
    
    // If no categories parsed, show raw content
    if (!description) {
        description = versionData.content
            .replace(/##\s*\[v?[\d.]+\][^\n]*/g, '')
            .substring(0, 3800);
    }
    
    const embed = new EmbedBuilder()
        .setColor('#00fbff')
        .setAuthor({ 
            name: `🏗️ ARCHITECT CG-223 • ${t.versionHistory}`, 
            iconURL: client.user.displayAvatarURL() 
        })
        .setTitle(`${t.version} ${versionData.version} - ${versionData.title}`)
        .setDescription(
            `📅 **${t.releasedOn}:** ${new Date(versionData.date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n` +
            `🏷️ **Status:** ${t[versionData.status]}\n\n` +
            `${description.substring(0, 3800)}`
        )
        .setFooter({ 
            text: `${t.footer} • ${t.page} ${page}/${totalPages} • v${version}`,
            iconURL: client.user.displayAvatarURL()
        })
        .setTimestamp(new Date(versionData.date));
    
    return embed;
}

// ================= CREATE JUMP TO VERSION MENU (FIXED) =================
function createVersionSelectMenu(versions, lang, disabled = false) {
    const t = translations[lang];
    
    if (!versions || versions.length === 0) {
        return new StringSelectMenuBuilder()
            .setCustomId('changelog_jump')
            .setPlaceholder(t.selectVersion)
            .setDisabled(true)
            .addOptions([{ label: 'No versions found', value: 'none' }]);
    }
    
    const options = versions.slice(0, 25).map((v, i) => ({
        label: `v${v.version}`.substring(0, 100),
        description: `${v.title || 'Update'}`.substring(0, 100),
        value: i.toString(),
        emoji: i === 0 ? '🆕' : '📌'
    }));
    
    return new StringSelectMenuBuilder()
        .setCustomId('changelog_jump')
        .setPlaceholder(t.selectVersion)
        .setDisabled(disabled)
        .addOptions(options);
}

// ================= MAIN COMMAND =================
module.exports = {
    name: 'changelog',
    aliases: ['updates', 'changes', 'version', 'journal', 'modifications', 'misesajour', 'cl', 'patch'],
    description: '📋 Neural Changelog System - View version history with intelligent categorization',
    category: 'SYSTEM',
    cooldown: 3000,
    usage: '.changelog [version] [mode]',
    examples: ['.changelog', '.changelog 1.5.0', '.changelog overview', '.journal'],

    run: async (client, message, args) => {
        
        // ================= LANGUAGE DETECTION =================
        let lang = 'en';
        const guildSettings = client.settings?.get(message.guild?.id);
        if (guildSettings?.language) {
            lang = guildSettings.language;
        } else {
            const frenchKeywords = ['journal', 'modifications', 'misesajour'];
            const content = message.content.toLowerCase();
            if (frenchKeywords.some(word => content.includes(word)) || message.guild?.preferredLocale === 'fr') {
                lang = 'fr';
            }
        }
        const t = translations[lang];
        
        try {
            // ================= FIND CHANGELOG =================
            const changelogPath = findChangelogFile();
            
            if (!changelogPath) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ED4245')
                    .setTitle('❌ ' + (lang === 'fr' ? 'FICHIER INTROUVABLE' : 'FILE NOT FOUND'))
                    .setDescription(`${t.noChangelog}\n\n${t.createHint}`)
                    .addFields({
                        name: '📁 ' + (lang === 'fr' ? 'Emplacement Attendu' : 'Expected Location'),
                        value: `\`${path.join(process.cwd(), 'CHANGELOG.md')}\``
                    })
                    .setFooter({ text: t.footer });
                return message.reply({ embeds: [errorEmbed] });
            }
            
            // ================= READ VERSION =================
            let currentVersion = client.version || '1.5.0';
            try {
                const versionPath = path.join(__dirname, '../version.txt');
                if (fs.existsSync(versionPath)) {
                    currentVersion = fs.readFileSync(versionPath, 'utf8').trim();
                }
            } catch (e) {
                // Use client.version as fallback
            }
            
            // ================= READ & PARSE CHANGELOG =================
            const changelog = fs.readFileSync(changelogPath, 'utf8');
            const versions = parseChangelogIntelligent(changelog);
            
            if (versions.length === 0) {
                // Show raw content as fallback
                const embed = new EmbedBuilder()
                    .setColor('#00fbff')
                    .setAuthor({ name: `🏗️ ARCHITECT CG-223 v${currentVersion}`, iconURL: client.user.displayAvatarURL() })
                    .setTitle(t.title)
                    .setDescription(`\`\`\`\n${changelog.substring(0, 4000)}\`\`\``)
                    .setFooter({ text: t.footer })
                    .setTimestamp();
                return message.reply({ embeds: [embed] });
            }
            
            // ================= GENERATE STATISTICS =================
            const stats = generateStatistics(versions, lang);
            
            // ================= DETERMINE VIEW MODE =================
            let viewMode = 'overview'; // overview or details
            let currentPage = 0;
            const totalPages = versions.length;
            
            // Check for specific version request
            const requestedVersion = args[0];
            if (requestedVersion && requestedVersion !== 'overview' && requestedVersion !== 'details') {
                const versionIndex = versions.findIndex(v => 
                    v.version === requestedVersion || 
                    v.version === requestedVersion.replace(/^v/, '')
                );
                if (versionIndex !== -1) {
                    currentPage = versionIndex;
                    viewMode = 'details';
                }
            }
            
            // Check for mode flag
            if (args.includes('overview') || args.includes('stats')) {
                viewMode = 'overview';
            } else if (args.includes('details') || args.includes('full')) {
                viewMode = 'details';
            }
            
            // ================= CREATE INITIAL EMBED & COMPONENTS =================
            let embed;
            if (viewMode === 'overview') {
                embed = createOverviewEmbed(versions, stats, lang, client);
            } else {
                embed = createDetailEmbed(versions[currentPage], currentPage + 1, totalPages, lang, client);
            }
            
            // Helper function to rebuild rows
            function rebuildRows(versions, viewMode, currentPage, lang, t) {
                const totalPages = versions.length;
                const jumpMenu = createVersionSelectMenu(versions, lang, false);
                
                return [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('changelog_prev').setEmoji('◀').setStyle(ButtonStyle.Secondary).setDisabled(viewMode === 'overview' || currentPage === 0),
                        new ButtonBuilder().setCustomId('changelog_next').setEmoji('▶').setStyle(ButtonStyle.Secondary).setDisabled(viewMode === 'overview' || currentPage === totalPages - 1),
                        new ButtonBuilder().setCustomId('changelog_overview').setLabel(t.overview).setStyle(viewMode === 'overview' ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji('📊').setDisabled(viewMode === 'overview'),
                        new ButtonBuilder().setCustomId('changelog_details').setLabel(t.details).setStyle(viewMode === 'details' ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji('📝').setDisabled(viewMode === 'details'),
                        new ButtonBuilder().setCustomId('changelog_latest').setLabel(t.latest).setStyle(ButtonStyle.Primary).setEmoji('🆕').setDisabled(currentPage === 0)
                    ),
                    new ActionRowBuilder().addComponents(jumpMenu),
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('changelog_refresh').setLabel(t.refresh).setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
                        new ButtonBuilder().setLabel(t.github).setStyle(ButtonStyle.Link).setURL('https://github.com/MFOF7310/Architect-CG-223').setEmoji('🔗')
                    )
                ];
            }
            
            // Build action rows
            const rows = rebuildRows(versions, viewMode, currentPage, lang, t);
            
            const reply = await message.reply({ 
                content: `> ${t.loading}`,
                embeds: [embed], 
                components: rows 
            });
            
            // ================= INTERACTION COLLECTOR =================
            const collector = reply.createMessageComponentCollector({ 
                componentType: [ComponentType.Button, ComponentType.StringSelect], 
                time: 300000 // 5 minutes
            });
            
            collector.on('collect', async (i) => {
                if (i.user.id !== message.author.id) {
                    return i.reply({ 
                        content: lang === 'fr' ? '❌ Ce menu ne vous appartient pas.' : '❌ This menu is not yours.', 
                        ephemeral: true 
                    });
                }
                
                let newEmbed;
                let newViewMode = viewMode;
                let newPage = currentPage;
                
                // Handle button interactions
                if (i.isButton()) {
                    switch (i.customId) {
                        case 'changelog_prev':
                            newPage--;
                            newViewMode = 'details';
                            break;
                        case 'changelog_next':
                            newPage++;
                            newViewMode = 'details';
                            break;
                        case 'changelog_overview':
                            newViewMode = 'overview';
                            break;
                        case 'changelog_details':
                            newViewMode = 'details';
                            break;
                        case 'changelog_latest':
                            newPage = 0;
                            newViewMode = 'details';
                            break;
                        case 'changelog_refresh':
                            // Re-read changelog for fresh data
                            const freshChangelog = fs.readFileSync(changelogPath, 'utf8');
                            const freshVersions = parseChangelogIntelligent(freshChangelog);
                            const freshStats = generateStatistics(freshVersions, lang);
                            
                            if (viewMode === 'overview') {
                                newEmbed = createOverviewEmbed(freshVersions, freshStats, lang, client);
                            } else {
                                const safePage = Math.min(currentPage, freshVersions.length - 1);
                                newEmbed = createDetailEmbed(freshVersions[safePage], safePage + 1, freshVersions.length, lang, client);
                            }
                            
                            const refreshedRows = rebuildRows(freshVersions, viewMode, currentPage, lang, t);
                            await i.update({ embeds: [newEmbed], components: refreshedRows });
                            return;
                    }
                }
                
                // Handle select menu
                if (i.isStringSelectMenu() && i.customId === 'changelog_jump') {
                    const selectedValue = i.values[0];
                    if (selectedValue !== 'none') {
                        newPage = parseInt(selectedValue);
                        newViewMode = 'details';
                    }
                }
                
                // Update state
                viewMode = newViewMode;
                currentPage = newPage;
                
                // Create appropriate embed
                if (viewMode === 'overview') {
                    newEmbed = createOverviewEmbed(versions, stats, lang, client);
                } else {
                    newEmbed = createDetailEmbed(versions[currentPage], currentPage + 1, totalPages, lang, client);
                }
                
                // Rebuild rows with updated state
                const updatedRows = rebuildRows(versions, viewMode, currentPage, lang, t);
                
                await i.update({ embeds: [newEmbed], components: updatedRows });
            });
            
            collector.on('end', async () => {
                const disabledMenu = createVersionSelectMenu(versions, lang, true);
                
                const disabledRows = [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('changelog_prev').setEmoji('◀').setStyle(ButtonStyle.Secondary).setDisabled(true),
                        new ButtonBuilder().setCustomId('changelog_next').setEmoji('▶').setStyle(ButtonStyle.Secondary).setDisabled(true),
                        new ButtonBuilder().setCustomId('changelog_overview').setLabel(t.overview).setStyle(ButtonStyle.Secondary).setDisabled(true),
                        new ButtonBuilder().setCustomId('changelog_details').setLabel(t.details).setStyle(ButtonStyle.Secondary).setDisabled(true),
                        new ButtonBuilder().setCustomId('changelog_latest').setLabel(t.latest).setStyle(ButtonStyle.Secondary).setDisabled(true)
                    ),
                    new ActionRowBuilder().addComponents(disabledMenu),
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('changelog_refresh').setLabel(t.refresh).setStyle(ButtonStyle.Secondary).setDisabled(true),
                        new ButtonBuilder().setLabel(t.github).setStyle(ButtonStyle.Link).setURL('https://github.com/MFOF7310/Architect-CG-223')
                    )
                ];
                await reply.edit({ components: disabledRows }).catch(() => {});
            });
            
            console.log(`${green}[CHANGELOG]${reset} Displayed to ${message.author.tag} | Mode: ${viewMode} | Lang: ${lang}`);
            
        } catch (error) {
            console.error(`${red}[CHANGELOG ERROR]${reset}`, error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setTitle('❌ ' + (lang === 'fr' ? 'ERREUR SYSTÈME' : 'SYSTEM ERROR'))
                .setDescription(t.error)
                .setFooter({ text: t.footer });
            return message.reply({ embeds: [errorEmbed] });
        }
    }
};