const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, SlashCommandBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        title: '📜 MYTHIC COMMAND GRIMOIRE',
        desc: 'The Architect\'s arcane spells await your command...',
        totalCommands: 'Total Arcane Spells',
        dmCompatible: 'DM Compatible',
        serverOnly: 'Server Only',
        categories: 'Categories',
        usage: 'Usage',
        examples: 'Examples',
        cooldown: 'Cooldown',
        noCommands: 'No commands found in this realm.',
        searchPlaceholder: 'Search for a spell...',
        viewDetails: 'View Details',
        backToList: 'Back to Grimoire',
        close: 'Close',
        categorySystem: '⚙️ SYSTEM',
        categoryEconomy: '💰 ECONOMY',
        categoryModeration: '🛡️ MODERATION',
        categoryUtility: '🛠️ UTILITY',
        categoryFun: '🎉 FUN',
        categoryGaming: '🎮 GAMING',
        categoryAI: '🧠 AI',
        categoryProfile: '👤 PROFILE',
        categoryGeneral: '📁 GENERAL',
        categoryOwner: '👑 OWNER',
        footer: 'Mythic Command Grimoire • v{version}',
        accessDenied: '❌ This grimoire is locked to your session.',
        slashOnly: 'This command only works as a slash command!',
        dmWarning: '⚠️ This command cannot be used in DMs',
        serverWarning: '⚠️ This command can only be used in servers',
        searchHint: '🔍 Type to search commands...',
        refresh: '🔄 Refresh Grimoire'
    },
    fr: {
        title: '📜 GRIMOIRE DES COMMANDES MYTHIQUES',
        desc: 'Les sorts arcanes de l\'Architecte attendent votre commande...',
        totalCommands: 'Sorts Arcanes Totaux',
        dmCompatible: 'Compatible DM',
        serverOnly: 'Serveur Uniquement',
        categories: 'Catégories',
        usage: 'Utilisation',
        examples: 'Exemples',
        cooldown: 'Rechargement',
        noCommands: 'Aucune commande trouvée dans ce royaume.',
        searchPlaceholder: 'Rechercher un sort...',
        viewDetails: 'Voir Détails',
        backToList: 'Retour au Grimoire',
        close: 'Fermer',
        categorySystem: '⚙️ SYSTÈME',
        categoryEconomy: '💰 ÉCONOMIE',
        categoryModeration: '🛡️ MODÉRATION',
        categoryUtility: '🛠️ UTILITAIRE',
        categoryFun: '🎉 FUN',
        categoryGaming: '🎮 JEU',
        categoryAI: '🧠 IA',
        categoryProfile: '👤 PROFIL',
        categoryGeneral: '📁 GÉNÉRAL',
        categoryOwner: '👑 PROPRIÉTAIRE',
        footer: 'Grimoire des Commandes Mythiques • v{version}',
        accessDenied: '❌ Ce grimoire est verrouillé à votre session.',
        slashOnly: 'Cette commande fonctionne uniquement en slash!',
        dmWarning: '⚠️ Cette commande ne peut pas être utilisée en DM',
        serverWarning: '⚠️ Cette commande ne peut être utilisée qu\'en serveur',
        searchHint: '🔍 Tapez pour rechercher des commandes...',
        refresh: '🔄 Actualiser le Grimoire'
    }
};

// ================= CATEGORY EMOJIS =================
const categoryEmojis = {
    'SYSTEM': '⚙️',
    'ECONOMY': '💰',
    'MODERATION': '🛡️',
    'UTILITY': '🛠️',
    'FUN': '🎉',
    'GAMING': '🎮',
    'AI': '🧠',
    'PROFILE': '👤',
    'GENERAL': '📁',
    'OWNER': '👑'
};

// ================= CHECK IF COMMAND WORKS IN DM =================
function isDMCompatible(command) {
    // Commands that work in DMs
    const dmFriendly = ['ping', 'about', 'invite', 'help', 'credits', 'balance', 'vote'];
    if (dmFriendly.includes(command.name)) return true;
    
    // Commands that are server-only
    const serverOnly = ['ban', 'kick', 'warn', 'clear', 'setprefix', 'pin', 'unpin'];
    if (serverOnly.includes(command.name)) return false;
    
    // Default: most economy commands need servers (for database context)
    if (command.category === 'ECONOMY') return false;
    if (command.category === 'MODERATION') return false;
    
    return true;
}

// ================= HELPER: Show All Commands (Prefix) =================
async function showAllCommands(interaction, client, commands, t, lang, isDM, version, guildName) {
    const itemsPerPage = 10;
    let currentPage = 0;
    const totalPages = Math.ceil(commands.length / itemsPerPage);
    
    const buildEmbed = (page) => {
        const start = page * itemsPerPage;
        const end = start + itemsPerPage;
        const pageCommands = commands.slice(start, end);
        
        let description = '```yaml\n';
        for (const cmd of pageCommands) {
            const dmStatus = isDMCompatible(cmd) ? '✅' : '❌';
            description += `${dmStatus} /${cmd.name}\n`;
            description += `   └─ ${cmd.description?.substring(0, 50) || 'No description'}\n`;
        }
        description += '```';
        
        const embed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle('📜 ALL ARCANE SPELLS')
            .setDescription(description)
            .addFields(
                { name: '📊 STATISTICS', value: `Total: ${commands.length} | Page ${page + 1}/${totalPages}`, inline: true },
                { name: '✅ DM Compatible', value: 'Commands marked with ✅ work in DMs', inline: true },
                { name: '❌ Server Only', value: 'Commands marked with ❌ require a server', inline: true }
            )
            .setFooter({ text: t.footer.replace('{version}', version) })
            .setTimestamp();
        
        return embed;
    };
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev_all').setLabel('◀ Previous').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
        new ButtonBuilder().setCustomId('next_all').setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === totalPages - 1),
        new ButtonBuilder().setCustomId('back_all').setLabel(t.backToList).setStyle(ButtonStyle.Primary).setEmoji('📚')
    );
    
    await interaction.editReply({ embeds: [buildEmbed(currentPage)], components: [row] }).catch(() => {});
    
    const collector = interaction.channel?.createMessageComponentCollector({ 
        filter: i => i.user.id === interaction.user.id,
        time: 60000
    });
    
    if (!collector) return;
    
    collector.on('collect', async (btnInteraction) => {
        // 🔥 FIXED: Safe defer with expiry handling
        try {
            await btnInteraction.deferUpdate();
        } catch (error) {
            if (error.code === 10062) {
                console.log('[SLASH] Button interaction expired (showAllCommands)');
                collector.stop();
                return;
            }
            throw error;
        }
        
        if (btnInteraction.customId === 'prev_all' && currentPage > 0) {
            currentPage--;
            const newRow = ActionRowBuilder.from(row);
            newRow.components[0].setDisabled(currentPage === 0);
            newRow.components[1].setDisabled(currentPage === totalPages - 1);
            await btnInteraction.editReply({ embeds: [buildEmbed(currentPage)], components: [newRow] }).catch(() => {});
        } else if (btnInteraction.customId === 'next_all' && currentPage < totalPages - 1) {
            currentPage++;
            const newRow = ActionRowBuilder.from(row);
            newRow.components[0].setDisabled(currentPage === 0);
            newRow.components[1].setDisabled(currentPage === totalPages - 1);
            await btnInteraction.editReply({ embeds: [buildEmbed(currentPage)], components: [newRow] }).catch(() => {});
        } else if (btnInteraction.customId === 'back_all') {
            collector.stop();
            // Re-run the main command
            const mockMessage = {
                author: interaction.user,
                guild: interaction.guild,
                channel: interaction.channel,
                reply: async () => {}
            };
            await module.exports.run(client, mockMessage, [], client.db, null, 'slash');
        }
    });
    
    collector.on('end', () => {
        // Cleanup
    });
}

// ================= HELPER: Show Category Commands (Prefix) =================
async function showCategoryCommands(interaction, client, commands, category, t, lang, isDM, version, guildName) {
    const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle(`${categoryEmojis[category] || '📦'} ${category} SPELLS`)
        .setDescription(`\`\`\`yaml\n${commands.length} command${commands.length !== 1 ? 's' : ''} in this category\n\`\`\``)
        .setFooter({ text: t.footer.replace('{version}', version) })
        .setTimestamp();
    
    for (const cmd of commands.slice(0, 15)) {
        const dmStatus = isDMCompatible(cmd) ? '✅ DM OK' : '❌ Server Only';
        embed.addFields({
            name: `/${cmd.name}`,
            value: `└─ ${cmd.description?.substring(0, 80) || 'No description'}\n└─ ${dmStatus} | ${t.cooldown}: ${cmd.cooldown || 3000}ms`,
            inline: false
        });
    }
    
    if (commands.length > 15) {
        embed.addFields({ name: '📜 AND MORE...', value: `*${commands.length - 15} additional spells not shown*`, inline: false });
    }
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('back_cat').setLabel(t.backToList).setStyle(ButtonStyle.Primary).setEmoji('📚')
    );
    
    await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => {});
    
    const collector = interaction.channel?.createMessageComponentCollector({ 
        filter: i => i.user.id === interaction.user.id,
        time: 60000,
        max: 1
    });
    
    if (!collector) return;
    
    collector.on('collect', async (btnInteraction) => {
        // 🔥 FIXED: Safe defer with expiry handling
        try {
            await btnInteraction.deferUpdate();
        } catch (error) {
            if (error.code === 10062) {
                console.log('[SLASH] Button interaction expired (showCategoryCommands)');
                collector.stop();
                return;
            }
            throw error;
        }
        
        if (btnInteraction.customId === 'back_cat') {
            const mockMessage = {
                author: interaction.user,
                guild: interaction.guild,
                channel: interaction.channel,
                reply: async () => {}
            };
            await module.exports.run(client, mockMessage, [], client.db, null, 'slash');
        }
    });
}

// ================= HELPER: Show All Commands (Slash) =================
async function showAllCommandsSlash(interaction, client, commands, t, lang, isDM, version, guildName) {
    const itemsPerPage = 10;
    let currentPage = 0;
    const totalPages = Math.ceil(commands.length / itemsPerPage);
    
    const buildEmbed = (page) => {
        const start = page * itemsPerPage;
        const end = start + itemsPerPage;
        const pageCommands = commands.slice(start, end);
        
        let description = '```yaml\n';
        for (const cmd of pageCommands) {
            const dmStatus = isDMCompatible(cmd) ? '✅' : '❌';
            description += `${dmStatus} /${cmd.name}\n`;
            description += `   └─ ${cmd.description?.substring(0, 50) || 'No description'}\n`;
        }
        description += '```';
        
        return new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle('📜 ALL ARCANE SPELLS')
            .setDescription(description)
            .addFields(
                { name: '📊 STATISTICS', value: `Total: ${commands.length} | Page ${page + 1}/${totalPages}`, inline: true },
                { name: '✅ DM Compatible', value: 'Commands marked with ✅ work in DMs', inline: true },
                { name: '❌ Server Only', value: 'Commands marked with ❌ require a server', inline: true }
            )
            .setFooter({ text: t.footer.replace('{version}', version) })
            .setTimestamp();
    };
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev_all_s').setLabel('◀ Previous').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
        new ButtonBuilder().setCustomId('next_all_s').setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === totalPages - 1),
        new ButtonBuilder().setCustomId('back_all_s').setLabel(t.backToList).setStyle(ButtonStyle.Primary).setEmoji('📚')
    );
    
    await interaction.editReply({ embeds: [buildEmbed(currentPage)], components: [row] }).catch(() => {});
    
    const collector = interaction.channel?.createMessageComponentCollector({ 
        filter: i => i.user.id === interaction.user.id,
        time: 60000
    });
    
    if (!collector) return;
    
    collector.on('collect', async (btnInteraction) => {
        // 🔥 FIXED: Safe defer with expiry handling
        try {
            await btnInteraction.deferUpdate();
        } catch (error) {
            if (error.code === 10062) {
                console.log('[SLASH] Button interaction expired (showAllCommandsSlash)');
                collector.stop();
                return;
            }
            throw error;
        }
        
        if (btnInteraction.customId === 'prev_all_s' && currentPage > 0) {
            currentPage--;
            const newRow = ActionRowBuilder.from(row);
            newRow.components[0].setDisabled(currentPage === 0);
            newRow.components[1].setDisabled(currentPage === totalPages - 1);
            await btnInteraction.editReply({ embeds: [buildEmbed(currentPage)], components: [newRow] }).catch(() => {});
        } else if (btnInteraction.customId === 'next_all_s' && currentPage < totalPages - 1) {
            currentPage++;
            const newRow = ActionRowBuilder.from(row);
            newRow.components[0].setDisabled(currentPage === 0);
            newRow.components[1].setDisabled(currentPage === totalPages - 1);
            await btnInteraction.editReply({ embeds: [buildEmbed(currentPage)], components: [newRow] }).catch(() => {});
        } else if (btnInteraction.customId === 'back_all_s') {
            collector.stop();
            await module.exports.execute(interaction, client);
        }
    });
    
    collector.on('end', () => {
        // Cleanup
    });
}

// ================= HELPER: Show Category Commands (Slash) =================
async function showCategoryCommandsSlash(interaction, client, commands, category, t, lang, isDM, version, guildName) {
    const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle(`${categoryEmojis[category] || '📦'} ${category} SPELLS`)
        .setDescription(`\`\`\`yaml\n${commands.length} command${commands.length !== 1 ? 's' : ''} in this category\n\`\`\``)
        .setFooter({ text: t.footer.replace('{version}', version) })
        .setTimestamp();
    
    for (const cmd of commands.slice(0, 15)) {
        const dmStatus = isDMCompatible(cmd) ? '✅ DM OK' : '❌ Server Only';
        embed.addFields({
            name: `/${cmd.name}`,
            value: `└─ ${cmd.description?.substring(0, 80) || 'No description'}\n└─ ${dmStatus} | ${t.cooldown}: ${cmd.cooldown || 3000}ms`,
            inline: false
        });
    }
    
    if (commands.length > 15) {
        embed.addFields({ name: '📜 AND MORE...', value: `*${commands.length - 15} additional spells not shown*`, inline: false });
    }
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('back_cat_s').setLabel(t.backToList).setStyle(ButtonStyle.Primary).setEmoji('📚')
    );
    
    await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => {});
    
    const collector = interaction.channel?.createMessageComponentCollector({ 
        filter: i => i.user.id === interaction.user.id,
        time: 60000,
        max: 1
    });
    
    if (!collector) return;
    
    collector.on('collect', async (btnInteraction) => {
        // 🔥 FIXED: Safe defer with expiry handling
        try {
            await btnInteraction.deferUpdate();
        } catch (error) {
            if (error.code === 10062) {
                console.log('[SLASH] Button interaction expired (showCategoryCommandsSlash)');
                collector.stop();
                return;
            }
            throw error;
        }
        
        if (btnInteraction.customId === 'back_cat_s') {
            await module.exports.execute(interaction, client);
        }
    });
}

// ================= MAIN MODULE EXPORTS =================
module.exports = {
    name: 'slash',
    aliases: ['cmdlist', 'spells', 'grimoire'],
    description: '📜 Display all available slash commands with mythic presentation.',
    category: 'SYSTEM',
    cooldown: 3000,
    usage: '.slash',
    examples: ['.slash', '.grimoire'],

    // ================= SLASH COMMAND DATA =================
    data: new SlashCommandBuilder()
        .setName('slash')
        .setDescription('📜 Display all available slash commands with mythic presentation')
        .addStringOption(option =>
            option.setName('search')
                .setDescription('Search for a specific command')
                .setRequired(false)
        ),

    // ================= PREFIX COMMAND RUN =================
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        // 🔥 FIXED: Safe language detection without relying on i18n.getString
        let lang = 'en';
        if (client.detectLanguage) {
            try {
                lang = client.detectLanguage(usedCommand, 'en');
            } catch (e) {
                // Fallback to checking usedCommand directly
                if (usedCommand?.toLowerCase() === 'grimoire') lang = 'fr';
                else lang = 'en';
            }
        } else if (usedCommand) {
            const cmd = usedCommand.toLowerCase();
            if (cmd === 'grimoire') lang = 'fr';
            else if (cmd === 'slash' || cmd === 'cmdlist' || cmd === 'spells') lang = 'en';
        }
        
        const t = translations[lang];
        const version = client.version || '1.8.0';
        const isDM = !message.guild;
        const guildName = message.guild?.name?.toUpperCase() || 'DIMENSIONAL VOID';
        
        // Get all slash commands
        const slashCommands = Array.from(client.commands.values())
            .filter(cmd => cmd.data) // Only commands with slash data
            .sort((a, b) => a.name.localeCompare(b.name));
        
        // Group by category
        const categories = {};
        for (const cmd of slashCommands) {
            const category = cmd.category || 'GENERAL';
            if (!categories[category]) categories[category] = [];
            categories[category].push(cmd);
        }
        
        // Sort categories
        const sortedCategories = Object.keys(categories).sort();
        
        // Build category list for select menu
        const categoryOptions = [
            { label: '📜 ALL COMMANDS', value: 'all', emoji: '📜', description: `View all ${slashCommands.length} commands` }
        ];
        
        for (const cat of sortedCategories) {
            const emoji = categoryEmojis[cat] || '📦';
            const count = categories[cat].length;
            categoryOptions.push({
                label: `${cat}`,
                value: cat,
                emoji: emoji,
                description: `${count} command${count !== 1 ? 's' : ''}`
            });
        }
        
        // Create select menu
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('slash_category')
            .setPlaceholder(t.searchPlaceholder)
            .addOptions(categoryOptions.slice(0, 25));
        
        const row = new ActionRowBuilder().addComponents(selectMenu);
        const refreshRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('slash_refresh')
                .setLabel(t.refresh)
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🔄'),
            new ButtonBuilder()
                .setCustomId('slash_close')
                .setLabel(t.close)
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌')
        );
        
        // Build main embed
        const embed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setAuthor({ name: t.title, iconURL: client.user.displayAvatarURL() })
            .setTitle('✨ ' + t.desc + ' ✨')
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setDescription(`\`\`\`yaml\n${t.totalCommands}: ${slashCommands.length}\n${t.categories}: ${sortedCategories.length}\nContext: ${isDM ? 'DIMENSIONAL VOID (DM)' : guildName}\n\`\`\``)
            .addFields(
                { name: '📖 HOW TO USE', value: 'Select a category from the dropdown below to view commands.', inline: false },
                { name: '💡 TIP', value: 'Use `/slash search:<name>` to find a specific command.', inline: false }
            )
            .setFooter({ text: t.footer.replace('{version}', version), iconURL: message.guild?.iconURL() || client.user.displayAvatarURL() })
            .setTimestamp();
        
        // Add category preview
        let preview = '';
        for (const cat of sortedCategories.slice(0, 5)) {
            const emoji = categoryEmojis[cat] || '📦';
            preview += `${emoji} **${cat}**: ${categories[cat].length} commands\n`;
        }
        if (sortedCategories.length > 5) preview += `*...and ${sortedCategories.length - 5} more categories*`;
        
        embed.addFields({ name: '📂 CATEGORIES PREVIEW', value: preview, inline: false });
        
        const reply = await message.reply({ embeds: [embed], components: [row, refreshRow] }).catch(() => {});
        if (!reply) return;
        
        // Handle interactions
        const collector = reply.createMessageComponentCollector({ time: 120000 });
        
        collector.on('collect', async (interaction) => {
            if (interaction.user.id !== message.author.id) {
                return interaction.reply({ content: t.accessDenied, flags: 64 }).catch(() => {});
            }
            
            // 🔥 FIXED: Safe defer with expiry handling
            try {
                await interaction.deferUpdate();
            } catch (error) {
                if (error.code === 10062) {
                    console.log('[SLASH] Interaction expired (main collector)');
                    collector.stop();
                    return;
                }
                throw error;
            }
            
            if (interaction.customId === 'slash_close') {
                await reply.delete().catch(() => {});
                collector.stop();
                return;
            }
            
            if (interaction.customId === 'slash_refresh') {
                await reply.delete().catch(() => {});
                await module.exports.run(client, message, args, db, serverSettings, usedCommand);
                return;
            }
            
            if (interaction.customId === 'slash_category') {
                const selectedCategory = interaction.values[0];
                
                if (selectedCategory === 'all') {
                    await showAllCommands(interaction, client, slashCommands, t, lang, isDM, version, message.guild?.name);
                } else {
                    await showCategoryCommands(interaction, client, categories[selectedCategory] || [], selectedCategory, t, lang, isDM, version, message.guild?.name);
                }
            }
        });
        
        collector.on('end', () => {
            // Cleanup - remove components after timeout
            reply.edit({ components: [] }).catch(() => {});
        });
    },

    // ================= SLASH COMMAND EXECUTE =================
    execute: async (interaction, client) => {
        // 🔥 FIXED: Safe language detection
        let lang = 'en';
        if (interaction.locale?.startsWith('fr')) {
            lang = 'fr';
        }
        
        const t = translations[lang];
        const version = client.version || '1.8.0';
        const isDM = !interaction.guild;
        const searchQuery = interaction.options.getString('search');
        
        // Get all slash commands
        let slashCommands = Array.from(client.commands.values())
            .filter(cmd => cmd.data)
            .sort((a, b) => a.name.localeCompare(b.name));
        
        // Filter by search if provided
        if (searchQuery) {
            slashCommands = slashCommands.filter(cmd => 
                cmd.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (cmd.description && cmd.description.toLowerCase().includes(searchQuery.toLowerCase()))
            );
        }
        
        // Group by category
        const categories = {};
        for (const cmd of slashCommands) {
            const category = cmd.category || 'GENERAL';
            if (!categories[category]) categories[category] = [];
            categories[category].push(cmd);
        }
        
        const sortedCategories = Object.keys(categories).sort();
        
        if (slashCommands.length === 0) {
            const noCmdEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('🔍 NO SPELLS FOUND')
                .setDescription(t.noCommands)
                .setFooter({ text: t.footer.replace('{version}', version) });
            return interaction.reply({ embeds: [noCmdEmbed], flags: 64 });
        }
        
        // Build category options
        const categoryOptions = [
            { label: '📜 ALL COMMANDS', value: 'all', emoji: '📜', description: `View all ${slashCommands.length} commands` }
        ];
        
        for (const cat of sortedCategories) {
            const emoji = categoryEmojis[cat] || '📦';
            const count = categories[cat].length;
            categoryOptions.push({
                label: `${cat}`,
                value: cat,
                emoji: emoji,
                description: `${count} command${count !== 1 ? 's' : ''}`
            });
        }
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('slash_category_slash')
            .setPlaceholder(searchQuery ? `Results: ${slashCommands.length} commands` : t.searchPlaceholder)
            .addOptions(categoryOptions.slice(0, 25));
        
        const row = new ActionRowBuilder().addComponents(selectMenu);
        const refreshRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('slash_refresh_slash').setLabel(t.refresh).setStyle(ButtonStyle.Primary).setEmoji('🔄'),
            new ButtonBuilder().setCustomId('slash_close_slash').setLabel(t.close).setStyle(ButtonStyle.Danger).setEmoji('❌')
        );
        
        const embed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setAuthor({ name: t.title, iconURL: client.user.displayAvatarURL() })
            .setTitle('✨ ' + t.desc + ' ✨')
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setDescription(`\`\`\`yaml\n${t.totalCommands}: ${slashCommands.length}\n${t.categories}: ${sortedCategories.length}\nContext: ${isDM ? 'DIMENSIONAL VOID (DM)' : interaction.guild.name}\n${searchQuery ? `Search: "${searchQuery}"` : ''}\n\`\`\``)
            .setFooter({ text: t.footer.replace('{version}', version), iconURL: interaction.guild?.iconURL() || client.user.displayAvatarURL() })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], components: [row, refreshRow], flags: 64 });
        
        const collector = interaction.channel?.createMessageComponentCollector({ 
            filter: i => i.user.id === interaction.user.id,
            time: 120000
        });
        
        if (!collector) return;
        
        collector.on('collect', async (btnInteraction) => {
            if (btnInteraction.customId === 'slash_close_slash') {
                await interaction.deleteReply().catch(() => {});
                collector.stop();
                return;
            }
            
            if (btnInteraction.customId === 'slash_refresh_slash') {
                await interaction.deleteReply().catch(() => {});
                await module.exports.execute(interaction, client);
                return;
            }
            
            if (btnInteraction.customId === 'slash_category_slash') {
                // 🔥 FIXED: Safe defer with expiry handling
                try {
                    await btnInteraction.deferUpdate();
                } catch (error) {
                    if (error.code === 10062) {
                        console.log('[SLASH] Select menu interaction expired');
                        collector.stop();
                        return;
                    }
                    throw error;
                }
                
                const selectedCategory = btnInteraction.values[0];
                
                if (selectedCategory === 'all') {
                    await showAllCommandsSlash(btnInteraction, client, slashCommands, t, lang, isDM, version, interaction.guild?.name);
                } else {
                    await showCategoryCommandsSlash(btnInteraction, client, categories[selectedCategory] || [], selectedCategory, t, lang, isDM, version, interaction.guild?.name);
                }
            }
        });
        
        collector.on('end', async () => {
            // Remove components after timeout
            await interaction.editReply({ components: [] }).catch(() => {});
        });
    }
};