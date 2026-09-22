const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, SlashCommandBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const i18n = require('../lib/i18n');
const SLASH_KEYS = ["title", "subtitle", "totalCommands", "categories", "context", "howToUse", "howToUseDesc", "tip", "tipDesc", "categoryPreview", "noCommands", "searchPlaceholder", "viewDetails", "backToList", "close", "refresh", "allCommands", "page", "of", "dmCompatible", "serverOnly", "cooldown", "accessDenied", "footer"];
// Keys live in lang/<locale>/slash.json; '' falls back to EN inside t().
function loadT(lang) {
    const o = {};
    for (const k of SLASH_KEYS) o[k] = i18n.t(`slash.${k}`, lang);
    return o;
}

// ================= CATEGORY CONFIGURATION =================
const categoryConfig = {
    'SYSTEM':     { emoji: '⚙️',  color: '#95a5a6', label_en: 'SYSTEM',      label_fr: 'SYSTÈME' },
    'ECONOMY':    { emoji: '💰',  color: '#f1c40f', label_en: 'ECONOMY',     label_fr: 'ÉCONOMIE' },
    'MODERATION': { emoji: '🛡️',  color: '#e74c3c', label_en: 'MODERATION',  label_fr: 'MODÉRATION' },
    'UTILITY':    { emoji: '🛠️',  color: '#3498db', label_en: 'UTILITY',     label_fr: 'UTILITAIRE' },
    'FUN':        { emoji: '🎉',  color: '#e67e22', label_en: 'FUN',         label_fr: 'FUN' },
    'GAMING':     { emoji: '🎮',  color: '#9b59b6', label_en: 'GAMING',      label_fr: 'JEU' },
    'AI':         { emoji: '🧠',  color: '#2ecc71', label_en: 'AI',          label_fr: 'IA' },
    'PROFILE':    { emoji: '👤',  color: '#1abc9c', label_en: 'PROFILE',     label_fr: 'PROFIL' },
    'GENERAL':    { emoji: '📁',  color: '#34495e', label_en: 'GENERAL',     label_fr: 'GÉNÉRAL' },
    'OWNER':      { emoji: '👑',  color: '#f39c12', label_en: 'OWNER',       label_fr: 'PROPRIÉTAIRE' }
};

// ================= POLICE COLOR PALETTE =================
const POLICE_COLORS = {
    primary: '#1a1a2e',      // Deep navy
    secondary: '#16213e',    // Dark blue
    accent: '#0f3460',       // Police blue
    highlight: '#e94560',    // Alert red
    gold: '#ffd700',         // Badge gold
    success: '#2ecc71',      // Clear green
    warning: '#f39c12',      // Caution amber
    text: '#ecf0f1',         // Clean white
    muted: '#95a5a6'         // Steel grey
};

// ================= DM COMPATIBILITY CHECK =================
function isDMCompatible(command) {
    const dmFriendly = ['ping', 'about', 'invite', 'help', 'credits', 'balance', 'vote', 'slash'];
    if (dmFriendly.includes(command.name)) return true;
    
    const serverOnly = ['ban', 'kick', 'warn', 'clear', 'setprefix', 'pin', 'unpin', 'slowmode', 'lock', 'unlock'];
    if (serverOnly.includes(command.name)) return false;
    
    if (command.category === 'ECONOMY' || command.category === 'MODERATION' || command.category === 'OWNER') return false;
    return true;
}

// ================= SAFE INTERACTION DEFER =================
async function safeDefer(interaction, context) {
    if (interaction.deferred || interaction.replied) return false;
    try {
        await interaction.deferUpdate();
    } catch (error) {
        if (error.code === 10062 || error.code === 40060 || error.code === 'InteractionAlreadyReplied') {
            console.log(`[SLASH] Interaction expired (${context})`);
            return false;
        }
        throw error;
    }
    return true;
}

// ================= BUILD MAIN EMBED =================
function buildMainEmbed(client, t, lang, slashCommands, categories, isDM, version, guildName) {
    const sortedCategories = Object.keys(categories).sort();
    
    const embed = new EmbedBuilder()
        .setColor(POLICE_COLORS.accent)
        .setAuthor({ 
            name: `📜 ${t.title}`, 
            iconURL: client.user.displayAvatarURL() 
        })
        .setTitle(`✨ ${t.subtitle}`)
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setDescription([
            '```ini',
            `[ ${t.totalCommands}: ${slashCommands.length} ]`,
            `[ ${t.categories}: ${sortedCategories.length} ]`,
            `[ ${t.context}: ${isDM ? 'DIMENSIONAL VOID (DM)' : guildName.toUpperCase()} ]`,
            '```'
        ].join('\n'))
        .addFields(
            { 
                name: `📖 ${t.howToUse}`, 
                value: `> ${t.howToUseDesc}`, 
                inline: false 
            },
            { 
                name: `💡 ${t.tip}`, 
                value: `> ${t.tipDesc}`, 
                inline: false 
            }
        )
        .setFooter({ 
            text: t.footer.replace('{version}', version), 
            iconURL: isDM ? client.user.displayAvatarURL() : null 
        })
        .setTimestamp();

    // Category preview with single emojis
    let preview = '';
    for (const cat of sortedCategories) {
        const config = categoryConfig[cat] || { emoji: '📦', color: POLICE_COLORS.muted };
        const count = categories[cat].length;
        preview += `${config.emoji} **${config[`label_${lang}`] || cat}** — ${count} command${count !== 1 ? 's' : ''}\n`;
    }
    
    embed.addFields({ 
        name: `📂 ${t.categoryPreview}`, 
        value: preview || '> *No categories available*', 
        inline: false 
    });

    return embed;
}

// ================= BUILD CATEGORY EMBED =================
function buildCategoryEmbed(commands, category, t, lang, version) {
    const config = categoryConfig[category] || { emoji: '📦', color: POLICE_COLORS.muted, label_en: category, label_fr: category };
    const label = config[`label_${lang}`] || category;
    
    const embed = new EmbedBuilder()
        .setColor(config.color)
        .setAuthor({ 
            name: `${config.emoji} ${label} — ${commands.length} SPELL${commands.length !== 1 ? 'S' : ''}`, 
            iconURL: null 
        })
        .setDescription(`\`\`\`yaml\n${commands.length} command${commands.length !== 1 ? 's' : ''} in this category\n\`\`\``)
        .setFooter({ text: t.footer.replace('{version}', version) })
        .setTimestamp();

    for (const cmd of commands.slice(0, 15)) {
        const dmStatus = isDMCompatible(cmd) ? '✅ DM OK' : '❌ Server Only';
        embed.addFields({
            name: `/${cmd.name}`,
            value: [
                `├─ ${cmd.description?.substring(0, 80) || 'No description'}`,
                `└─ ${dmStatus} • ${t.cooldown}: ${cmd.cooldown || 3000}ms`
            ].join('\n'),
            inline: false
        });
    }

    if (commands.length > 15) {
        embed.addFields({ 
            name: '⋮ AND MORE', 
            value: `*${commands.length - 15} additional spells hidden*`, 
            inline: false 
        });
    }

    return embed;
}

// ================= BUILD ALL COMMANDS EMBED =================
function buildAllCommandsEmbed(commands, page, itemsPerPage, t, version) {
    const totalPages = Math.ceil(commands.length / itemsPerPage);
    const start = page * itemsPerPage;
    const end = start + itemsPerPage;
    const pageCommands = commands.slice(start, end);

    let description = '```yaml\n';
    for (const cmd of pageCommands) {
        const dmStatus = isDMCompatible(cmd) ? '✅' : '❌';
        const catConfig = categoryConfig[cmd.category] || { emoji: '📦' };
        description += `${dmStatus} ${catConfig.emoji} /${cmd.name}\n`;
        description += `   └─ ${cmd.description?.substring(0, 50) || 'No description'}\n`;
    }
    description += '```';

    return new EmbedBuilder()
        .setColor(POLICE_COLORS.accent)
        .setAuthor({ name: `📜 ${t.allCommands}`, iconURL: null })
        .setDescription(description)
        .addFields(
            { 
                name: '📊 STATISTICS', 
                value: `Total: ${commands.length}\n${t.page}: ${page + 1}/${totalPages}`, 
                inline: true 
            },
            { 
                name: '✅ DM OK', 
                value: 'Works in DMs', 
                inline: true 
            },
            { 
                name: '❌ Server', 
                value: 'Server required', 
                inline: true 
            }
        )
        .setFooter({ text: t.footer.replace('{version}', version) })
        .setTimestamp();
}

// ================= GET COMMANDS DATA =================
function getSlashCommands(client) {
    return Array.from(client.commands.values())
        .filter(cmd => cmd.data)
        .map(cmd => ({
            name: cmd.name,
            description: cmd.description || 'No description',
            category: cmd.category || 'GENERAL',
            cooldown: cmd.cooldown || 3000,
            data: cmd.data
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

function groupByCategory(commands) {
    const categories = {};
    for (const cmd of commands) {
        const category = cmd.category || 'GENERAL';
        if (!categories[category]) categories[category] = [];
        categories[category].push(cmd);
    }
    return categories;
}

// ================= BUTTON ROWS =================
function createNavigationRow(currentPage, totalPages, t, prefix = '') {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`prev_${prefix}`)
            .setEmoji('◀️')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0),
        new ButtonBuilder()
            .setCustomId(`page_${prefix}`)
            .setEmoji('📄')
            .setLabel(`${currentPage + 1} / ${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(`next_${prefix}`)
            .setEmoji('▶️')
            .setLabel('Next')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage >= totalPages - 1),
        new ButtonBuilder()
            .setCustomId(`back_${prefix}`)
            .setEmoji('📚')
            .setLabel(t.backToList)
            .setStyle(ButtonStyle.Primary)
    );
}

function createControlRow(t, prefix = '') {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`refresh_${prefix}`)
            .setEmoji('🔄')
            .setLabel(t.refresh)
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`close_${prefix}`)
            .setEmoji('❌')
            .setLabel(t.close)
            .setStyle(ButtonStyle.Danger)
    );
}

function createBackRow(t, prefix = '') {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`back_${prefix}`)
            .setEmoji('📚')
            .setLabel(t.backToList)
            .setStyle(ButtonStyle.Primary)
    );
}

// ================= SHOW ALL COMMANDS (PREFIX) =================
async function showAllCommands(interaction, client, commands, t, lang, version, prefix = '') {
    const itemsPerPage = 10;
    let currentPage = 0;
    const totalPages = Math.ceil(commands.length / itemsPerPage);

    const updateMessage = async () => {
        const embed = buildAllCommandsEmbed(commands, currentPage, itemsPerPage, t, version);
        const row = createNavigationRow(currentPage, totalPages, t, prefix);
        await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => {});
    };

    await updateMessage();

    const collector = interaction.channel?.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 120000
    });

    if (!collector) return;

    collector.on('collect', async (btn) => {
        if (!await safeDefer(btn, 'showAllCommands')) {
            collector.stop();
            return;
        }

        switch (btn.customId) {
            case `prev_${prefix}`:
                if (currentPage > 0) {
                    currentPage--;
                    await updateMessage();
                }
                break;
            case `next_${prefix}`:
                if (currentPage < totalPages - 1) {
                    currentPage++;
                    await updateMessage();
                }
                break;
            case `back_${prefix}`:
                collector.stop();
                await module.exports.run(client, {
                    author: interaction.user,
                    guild: interaction.guild,
                    channel: interaction.channel,
                    reply: async () => {}
                }, [], client.db, null, 'slash', lang);
                break;
        }
    });

    collector.on('end', () => {
        interaction.editReply({ components: [] }).catch(() => {});
    });
}

// ================= SHOW CATEGORY (PREFIX) =================
async function showCategory(interaction, client, commands, category, t, lang, version, prefix = '') {
    const embed = buildCategoryEmbed(commands, category, t, lang, version);
    const row = createBackRow(t, prefix);

    await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => {});

    const collector = interaction.channel?.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 120000,
        max: 1
    });

    if (!collector) return;

    collector.on('collect', async (btn) => {
        if (!await safeDefer(btn, 'showCategory')) return;

        if (btn.customId === `back_${prefix}`) {
            collector.stop();
            await module.exports.run(client, {
                author: interaction.user,
                guild: interaction.guild,
                channel: interaction.channel,
                reply: async () => {}
            }, [], client.db, null, 'slash', lang);
        }
    });
}

// ================= SHOW ALL COMMANDS (SLASH) =================
async function showAllCommandsSlash(interaction, client, commands, t, lang, version) {
    await showAllCommands(interaction, client, commands, t, lang, version, 's');
}

// ================= SHOW CATEGORY (SLASH) =================
async function showCategorySlash(interaction, client, commands, category, t, lang, version) {
    await showCategory(interaction, client, commands, category, t, lang, version, 's');
}

// ================= MAIN MODULE =================
module.exports = {
    name: 'slash',
    aliases: ['cmdlist', 'spells', 'grimoire'],
    description: 'Display all available slash commands with mythic presentation.',
    category: 'SYSTEM',
    cooldown: 3000,
    usage: '.slash',
    examples: ['.slash', '.grimoire'],

    data: new SlashCommandBuilder()
        .setName('slash')
        .setDescription('Display all available slash commands with mythic presentation')
        .addStringOption(option =>
            option.setName('search')
                .setDescription('Search for a specific command')
                .setRequired(false)
                .setAutocomplete(true)
        ),

    autocomplete: async (interaction, client) => {
        const focused = (interaction.options.getFocused() || '').toLowerCase();
        try {
            const cmds = getSlashCommands(client || interaction.client);
            const hits = cmds
                .filter(cmd => !focused
                    || cmd.name.toLowerCase().includes(focused)
                    || (cmd.category || '').toLowerCase().includes(focused))
                .slice(0, 25)
                .map(cmd => ({
                    name: `/${cmd.name}${cmd.category ? ` · ${cmd.category}` : ''}`.slice(0, 100),
                    value: cmd.name.slice(0, 100),
                }));
            return interaction.respond(hits).catch(() => {});
        } catch (e) {
            return interaction.respond([]).catch(() => {});
        }
    },

    // ================= PREFIX COMMAND =================
    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        // Language detection
        if (usedCommand?.toLowerCase() === 'grimoire') lang = 'fr';
        
        const t = loadT(lang);
        const version = client.version || '1.8.0';
        const isDM = !message.guild;
        const guildName = message.guild?.name?.toUpperCase() || 'DIMENSIONAL VOID';

        const slashCommands = getSlashCommands(client);
        const categories = groupByCategory(slashCommands);
        const sortedCategories = Object.keys(categories).sort();

        // Build select menu options
        const categoryOptions = [{
            label: `📜 ${t.allCommands}`,
            value: 'all',
            emoji: '📜',
            description: `View all ${slashCommands.length} commands`
        }];

        for (const cat of sortedCategories) {
            const config = categoryConfig[cat] || { emoji: '📦', label_en: cat, label_fr: cat };
            const count = categories[cat].length;
            categoryOptions.push({
                label: `${config.emoji} ${config[`label_${lang}`] || cat}`,
                value: cat,
                emoji: config.emoji,
                description: `${count} command${count !== 1 ? 's' : ''}`
            });
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('slash_category')
            .setPlaceholder(t.searchPlaceholder)
            .addOptions(categoryOptions.slice(0, 25));

        const selectRow = new ActionRowBuilder().addComponents(selectMenu);
        const controlRow = createControlRow(t);

        const embed = buildMainEmbed(client, t, lang, slashCommands, categories, isDM, version, guildName);

        const reply = await message.reply({ 
            embeds: [embed], 
            components: [selectRow, controlRow] 
        }).catch(err => {
            console.error('[SLASH] Failed to send reply:', err);
            return null;
        });

        if (!reply) return;

        const collector = reply.createMessageComponentCollector({ time: 120000, filter: i => ['close_', 'refresh_', 'slash_category'].includes(i.customId) });

        collector.on('collect', async (interaction) => {
            if (interaction.user.id !== message.author.id) {
                return interaction.reply({ 
                    content: `🔒 ${t.accessDenied}`, 
                    flags: 64 
                }).catch(() => {});
            }

            if (!await safeDefer(interaction, 'main collector')) {
                collector.stop();
                return;
            }

            if (interaction.customId === 'close_') {
                await reply.delete().catch(() => {});
                collector.stop();
                return;
            }

            if (interaction.customId === 'refresh_') {
                await reply.delete().catch(() => {});
                await module.exports.run(client, message, args, db, serverSettings, usedCommand);
                return;
            }

            if (interaction.customId === 'slash_category') {
                const selected = interaction.values[0];
                
                if (selected === 'all') {
                    await showAllCommands(interaction, client, slashCommands, t, lang, version);
                } else {
                    await showCategory(interaction, client, categories[selected] || [], selected, t, lang, version);
                }
            }
        });

        collector.on('end', () => {
            reply.edit({ components: [] }).catch(() => {});
        });
    },

    // ================= SLASH COMMAND =================
    execute: async (interaction, client) => {
        let lang = 'en';
        if (interaction.locale?.startsWith('fr')) lang = 'fr';
        
        const t = loadT(lang);
        const version = client.version || '1.8.0';
        const isDM = !interaction.guild;
        const searchQuery = interaction.options.getString('search');

        let slashCommands = getSlashCommands(client);
        const categories = groupByCategory(slashCommands);
        const sortedCategories = Object.keys(categories).sort();

        // Filter by search
        if (searchQuery) {
            slashCommands = slashCommands.filter(cmd => 
                cmd.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (cmd.description && cmd.description.toLowerCase().includes(searchQuery.toLowerCase()))
            );
        }

        if (slashCommands.length === 0) {
            const noCmdEmbed = new EmbedBuilder()
                .setColor(POLICE_COLORS.highlight)
                .setAuthor({ name: '🔍 NO SPELLS FOUND', iconURL: null })
                .setDescription(`> ${t.noCommands}`)
                .setFooter({ text: t.footer.replace('{version}', version) });
            
            return interaction.reply({ embeds: [noCmdEmbed], flags: 64 });
        }

        // Build options
        const categoryOptions = [{
            label: `📜 ${t.allCommands}`,
            value: 'all',
            emoji: '📜',
            description: `View all ${slashCommands.length} commands`
        }];

        for (const cat of sortedCategories) {
            const config = categoryConfig[cat] || { emoji: '📦', label_en: cat, label_fr: cat };
            const count = (categories[cat] || []).length;
            if (count > 0) {
                categoryOptions.push({
                    label: `${config.emoji} ${config[`label_${lang}`] || cat}`,
                    value: cat,
                    emoji: config.emoji,
                    description: `${count} command${count !== 1 ? 's' : ''}`
                });
            }
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('slash_category_slash')
            .setPlaceholder(searchQuery ? `🔍 Results: ${slashCommands.length}` : t.searchPlaceholder)
            .addOptions(categoryOptions.slice(0, 25));

        const selectRow = new ActionRowBuilder().addComponents(selectMenu);
        const controlRow = createControlRow(t, 'slash');

        const embed = buildMainEmbed(client, t, lang, slashCommands, categories, isDM, version, interaction.guild?.name || 'DIMENSIONAL VOID');

        const isEdit = interaction.replied || interaction.deferred;
        const payload = { embeds: [embed], components: [selectRow, controlRow] };
        // flags ne passe qu'à la réponse initiale
        if (!isEdit) payload.flags = 64;
        await interaction[isEdit ? 'editReply' : 'reply'](payload);

        const collector = interaction.channel?.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id && ['close_slash', 'refresh_slash', 'slash_category_slash'].includes(i.customId),
            time: 120000
        });

        if (!collector) return;

        collector.on('collect', async (btn) => {
            if (btn.customId === 'close_slash') {
                await btn.deferUpdate().catch(() => {});
                await interaction.deleteReply().catch(() => {});
                collector.stop();
                return;
            }

            if (btn.customId === 'refresh_slash') {
                await btn.deferUpdate().catch(() => {});
                collector.stop();
                await module.exports.execute(interaction, client);
                return;
            }

            if (btn.customId === 'slash_category_slash') {
                if (!await safeDefer(btn, 'slash select')) {
                    collector.stop();
                    return;
                }

                const selected = btn.values[0];
                
                if (selected === 'all') {
                    await showAllCommandsSlash(btn, client, slashCommands, t, lang, version);
                } else {
                    await showCategorySlash(btn, client, categories[selected] || [], selected, t, lang, version);
                }
            }
        });

        collector.on('end', async () => {
            await interaction.editReply({ components: [] }).catch(() => {});
        });
    }
};
