const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, ComponentType } = require('discord.js');
const em = (k, fb) => { try { return require('../config/emojis')[k] || fb; } catch { return fb; } };
const { icon } = require('../lib/ui/icons');

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
const i18n = require('../lib/i18n');
const I18N_KEYS = ["title", "description", "selectCategory", "allCommands", "categories", "commands", "aliases", "usage", "cooldown", "seconds", "none", "noDescription", "totalCommands", "totalAliases", "selectCategoryPrompt", "commandsInCategoryOne", "commandsInCategoryMany", "aliasesFor", "page", "of", "footer", "accessDenied", "back", "refresh", "viewAll", "commandDetails", "categoryLabel", "cooldownLabel", "examples", "noExamples", "tip", "loading", "searchPlaceholder", "favorites", "addFavorite", "removeFavorite", "favoriteAdded", "favoriteRemoved", "noFavorites", "mostUsed", "timesUsed", "newCommand", "commandOfDay", "tryItNow", "compactView", "normalView", "themeLight", "themeDark", "themeNeural", "searchResults", "noResults", "statsSummary", "mostPopularCategory", "leastUsedCommand", "totalExecutions", "noCommandsInCategory", "statistics", "resultsFound", "commandsWord", "favoriteCommands"];
function loadT(lang) {
    const o = {};
    for (const k of I18N_KEYS) o[k] = i18n.t(`list.${k}`, lang);
    return o;
}

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

// ================= FAVORITES (kept in the database, so a restart doesn't lose them) =================
let favReady = false;
function favTable(db) {
    if (favReady) return;
    db.prepare('CREATE TABLE IF NOT EXISTS list_favorites (user_id TEXT NOT NULL, command TEXT NOT NULL, PRIMARY KEY (user_id, command))').run();
    favReady = true;
}
function getFavorites(db, userId) {
    favTable(db);
    return new Set(db.prepare('SELECT command FROM list_favorites WHERE user_id = ?').all(String(userId)).map((r) => r.command));
}
// Adds or removes one favorite; true when it is now a favorite
function toggleFavorite(db, userId, command) {
    favTable(db);
    const had = db.prepare('DELETE FROM list_favorites WHERE user_id = ? AND command = ?').run(String(userId), command).changes > 0;
    if (!had) db.prepare('INSERT INTO list_favorites (user_id, command) VALUES (?, ?)').run(String(userId), command);
    return !had;
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
        .setTitle('Commands')
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
        .setTitle(`═ ${(cmds.length === 1 ? i18n.t('list.commandsInCategoryOne', lang, { category: config.name[lang] }) : i18n.t('list.commandsInCategoryMany', lang, { category: config.name[lang] }))} ═`)
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }));
    
    if (cmds.length === 0) {
        embed.setDescription(t.noCommandsInCategory);
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
        name: '📊 ' + t.statistics,
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
        let description = `**${results.length}** ${t.resultsFound}:\n\n`;
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

// ================= ONE CARD, DRAWN FROM ITS STATE =================
// The card's state lives in a stored session (lib/components.js), so its buttons keep working after a restart.
const components = require('../lib/components');
const { pickLang } = require('../lib/pick-lang');
const IDLE_MS = 10 * 60 * 1000;   // usable 10 minutes after the last click

function ctxOf(client, guild, settings, lang) {
    return {
        t: loadT(lang),
        prefix: settings?.prefix || process.env.PREFIX || '.',
        version: client.version || '1.8.0',
        guildName: guild?.name?.toUpperCase() || 'ARCHON CG-223',
        guildIcon: guild?.iconURL?.() || client.user.displayAvatarURL()
    };
}

// state: { lang, view: main | all | category | favorites | detail, page, compact, category, cmd }
function render(client, s, c, sid, favorites) {
    const { t } = c;
    const lang = s.lang;
    const id = (action, ...a) => components.id('list', sid, action, ...a);
    const back = () => new ButtonBuilder().setCustomId(id('back')).setLabel(t.back).setStyle(ButtonStyle.Secondary).setEmoji('◀');

    if (s.view === 'all') {
        const { embed, totalPages } = createAllCommandsEmbed(client, c.prefix, lang, t, c.version, c.guildName, c.guildIcon, s.page || 1, !!s.compact);
        const page = Math.min(s.page || 1, totalPages);
        const rows = [];
        if (totalPages > 1) rows.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(id('prev')).setEmoji(icon('page_prev')).setStyle(ButtonStyle.Secondary).setDisabled(page <= 1),
            new ButtonBuilder().setCustomId(id('page')).setLabel(`${page}/${totalPages}`).setStyle(ButtonStyle.Primary).setDisabled(true),
            new ButtonBuilder().setCustomId(id('next')).setEmoji(icon('page_next')).setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages)));
        rows.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(id('toggle')).setLabel(s.compact ? t.normalView : t.compactView).setStyle(ButtonStyle.Secondary).setEmoji('📱'),
            back()));
        return { content: null, embeds: [embed], components: rows };
    }
    if (s.view === 'category') {
        return { content: null, embeds: [createCategoryEmbed(client, s.category, c.prefix, lang, t, c.version, c.guildName, c.guildIcon)], components: [new ActionRowBuilder().addComponents(back())] };
    }
    if (s.view === 'favorites') {
        return { content: null, embeds: [createFavoritesEmbed(client, favorites, c.prefix, lang, t, c.version, c.guildName, c.guildIcon)], components: [new ActionRowBuilder().addComponents(back())] };
    }
    if (s.view === 'detail') {
        const cmd = client.commands.get(s.cmd);
        if (cmd) {
            const isFav = favorites.has(cmd.name);
            const fav = new ButtonBuilder().setCustomId(id('fav', cmd.name)).setLabel(isFav ? t.removeFavorite : t.addFavorite)
                .setStyle(isFav ? ButtonStyle.Danger : ButtonStyle.Success).setEmoji(icon('star'));
            return { content: null, embeds: [createCommandDetailEmbed(client, cmd, c.prefix, lang, t, c.version, c.guildName, c.guildIcon, isFav)], components: [new ActionRowBuilder().addComponents(fav, back())] };
        }
    }

    // main
    const categorized = getCommandsByCategory(client);
    const options = Object.entries(CATEGORY_CONFIG)
        .filter(([key]) => categorized[key]?.length > 0)
        .map(([key, config]) => ({
            label: `${config.emoji} ${config.name[lang] || config.name.en}`.substring(0, 100),
            value: key,
            description: `${categorized[key]?.length || 0} ${t.commandsWord}`.substring(0, 100),
            emoji: config.emoji
        }));
    options.unshift({ label: `📚 ${t.allCommands}`.substring(0, 100), value: 'ALL', description: `${client.commands.size} ${t.commandsWord} total`.substring(0, 100), emoji: '📚' });
    if (favorites.size > 0) options.unshift({ label: `⭐ ${t.favorites} (${favorites.size})`.substring(0, 100), value: 'FAVORITES', description: `${t.favoriteCommands}`.substring(0, 100), emoji: '⭐' });
    const menu = new StringSelectMenuBuilder().setCustomId(id('cat')).setPlaceholder(t.selectCategory).addOptions(options.slice(0, 25));
    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(id('compact')).setLabel(t.compactView).setStyle(ButtonStyle.Secondary).setEmoji('📱'),
        new ButtonBuilder().setCustomId(id('refresh')).setLabel(t.refresh).setStyle(ButtonStyle.Secondary).setEmoji(icon('refresh')));
    return { content: null, embeds: [createMainEmbed(client, c.prefix, lang, t, c.version, c.guildName, c.guildIcon, favorites)], components: [new ActionRowBuilder().addComponents(menu), buttons] };
}

// ================= MAIN EXPORT =================
module.exports = {
    name: 'list',
    aliases: ['commands', 'cmds', 'registry', 'registre', 'commandes'],
    description: '📋 Display a professional, organized list of all available commands.',
    category: 'UTILITY',
    usage: '[category|command|search]',
    cooldown: 2000,
    examples: ['.list', '.list gaming', '.list profile', '.list shop'],


    // ================= PREFIX COMMAND =================
    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        try {
            lang = lang || pickLang(client, message.guild?.id || 'DM', message);
            const c = ctxOf(client, message.guild, serverSettings, lang);
            const userId = message.author.id;

            if (args[0]) {
                const searchTerm = args.join(' ').toLowerCase();

                // a category
                const matchedCategory = Object.keys(CATEGORY_CONFIG).find((k) =>
                    k.toLowerCase() === searchTerm || CATEGORY_CONFIG[k].name.en.toLowerCase() === searchTerm || CATEGORY_CONFIG[k].name.fr.toLowerCase() === searchTerm);
                if (matchedCategory) {
                    return message.reply({ embeds: [createCategoryEmbed(client, matchedCategory, c.prefix, lang, c.t, c.version, c.guildName, c.guildIcon)] }).catch(() => {});
                }

                // a command: its details, with Favorite and Back
                const cmd = client.commands.get(searchTerm) || client.commands.find((x) => x.aliases && x.aliases.includes(searchTerm));
                if (cmd) {
                    const state = { lang, view: 'detail', cmd: cmd.name, page: 1, compact: false };
                    const sid = components.create(db, { kind: 'list', userId, guildId: message.guild?.id, data: state, idleMs: IDLE_MS });
                    return message.reply(render(client, state, c, sid, getFavorites(db, userId))).catch(() => {});
                }

                // a search
                const results = searchCommands(client, searchTerm);
                return message.reply({ embeds: [createSearchResultsEmbed(client, searchTerm, results, c.prefix, lang, c.t, c.version, c.guildName, c.guildIcon)] }).catch(() => {});
            }

            const state = { lang, view: 'main', page: 1, compact: false };
            const sid = components.create(db, { kind: 'list', userId, guildId: message.guild?.id, data: state, idleMs: IDLE_MS });
            return message.reply(render(client, state, c, sid, getFavorites(db, userId))).catch(() => {});
        } catch (error) {
            console.error(`${red}[LIST FATAL]${reset}`, error);
            return message.reply({ content: `${em('ic_off', '❌')} Command failed.` }).catch(() => {});
        }
    },

    // ================= SLASH COMMAND =================
    execute: async (interaction, client) => {
        const lang = pickLang(client, interaction.guild?.id || 'DM', interaction);
        const query = interaction.options.getString('query');
        await interaction.deferReply();
        const fakeMessage = {
            author: interaction.user, guild: interaction.guild, channel: interaction.channel,
            reply: async (options) => interaction.editReply(options),
            react: () => Promise.resolve()
        };
        const serverSettings = interaction.guild ? client.getServerSettings(interaction.guild.id) : { prefix: '.' };
        await module.exports.run(client, fakeMessage, query ? [query] : [], client.db, serverSettings, 'list', lang);
    },

    // ================= BUTTONS AND MENU (c:list:<sid>:<action>[:<arg>]) =================
    onComponent: async (i, client, { sid, action, args, session, save }) => {
        const db = client.db;
        const s = { ...session.data };
        const lang = s.lang || pickLang(client, i.guild?.id || 'DM', i);
        const settings = i.guild ? client.getServerSettings?.(i.guild.id) : null;
        const c = ctxOf(client, i.guild, settings, lang);
        const total = () => createAllCommandsEmbed(client, c.prefix, lang, c.t, c.version, c.guildName, c.guildIcon, 1, !!s.compact).totalPages;

        if (action === 'cat') {
            const v = i.values?.[0];
            if (v === 'FAVORITES') Object.assign(s, { view: 'favorites' });
            else if (v === 'ALL') Object.assign(s, { view: 'all', page: 1 });
            else Object.assign(s, { view: 'category', category: v });
        } else if (action === 'back') Object.assign(s, { view: 'main', page: 1 });
        else if (action === 'compact') Object.assign(s, { view: 'all', page: 1, compact: true });
        else if (action === 'toggle') { s.compact = !s.compact; s.page = Math.min(s.page || 1, total()); }
        else if (action === 'prev') s.page = Math.max(1, (s.page || 1) - 1);
        else if (action === 'next') s.page = Math.min(total(), (s.page || 1) + 1);
        else if (action === 'fav') {
            const name = args[0];
            if (!client.commands.get(name)) return i.deferUpdate().catch(() => {});
            const now = toggleFavorite(db, i.user.id, name);
            save(s);
            await i.update(render(client, s, c, sid, getFavorites(db, i.user.id)));
            return i.followUp({ content: now ? c.t.favoriteAdded : c.t.favoriteRemoved, flags: 64 }).catch(() => {});
        }
        // 'refresh' just draws the same view again with fresh numbers
        save(s);
        return i.update(render(client, s, c, sid, getFavorites(db, i.user.id)));
    }
};

components.register('list', (ix, client, ctx) => module.exports.onComponent(ix, client, ctx), { command: 'list' });
