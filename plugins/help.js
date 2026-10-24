const EMOJIS = require('../config/emojis');
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js');
const i18n = require('../lib/i18n');
const { pickLang } = require('../lib/pick-lang');

const HELP_FLAT = ["directoryTitle", "commandExtract", "module", "category", "usage", "aliases", "examples", "cooldown", "seconds", "noDescription", "noExamples", "none", "systemStatus", "online", "node", "core", "uptime", "version", "moduleStats", "commands", "aliasesStat", "categories", "agents", "guilds", "quickAccess", "aiAssistant", "aiDesc", "selectPlaceholder", "viewAll", "mainMenu", "backToMain", "modulesTitle", "moduleStatsTitle", "totalCommands", "aliasesRegistered", "commandsAvailable", "useHelpForDetails", "selectModuleBelow", "signalLost", "commandNotFound", "notFoundDesc", "checkSpelling", "accessDenied", "footer", "bamakoNode", "modulesOnline", "tip", "topCategories", "noData", "moduleLocked", "moduleDisabledTitle", "moduleDisabledDesc", "noCommands"];
const HELP_NESTED = {"categoryDescriptions": ["SYSTEM", "GAMING", "ECONOMY", "PROFILE", "AI", "MODERATION", "UTILITY", "FUN", "OWNER", "GENERAL", "ADMIN", "CONFIG", "MUSIC", "SOCIAL", "TICKETS", "LEVELING", "CODM"], "tips": ["0", "1", "2", "3", "4"]};

function loadT(lang) {
    const o = {};
    for (const k of HELP_FLAT) o[k] = i18n.t(`help.${k}`, lang);
    for (const [k, subs] of Object.entries(HELP_NESTED)) {
        const isArr = subs.every(s => /^\d+$/.test(s));
        const box = isArr ? [] : {};
        for (const s of subs) box[isArr ? Number(s) : s] = i18n.t(`help.${k}.${s}`, lang);
        o[k] = box;
    }
    return o;
}

const emojiMap = {
    SYSTEM: EMOJIS.helpSystem, GAMING: EMOJIS.gameController, AI: EMOJIS.ai_assistant, PROFILE: EMOJIS.myprofile,
    OWNER: EMOJIS.eagle, GENERAL: EMOJIS.general, UTILITY: EMOJIS.helpUtility, MODERATION: EMOJIS.shield,
    ECONOMY: EMOJIS.coins, FUN: EMOJIS.helpFun, ADMIN: EMOJIS.crown, CONFIG: '⚙️', MUSIC: EMOJIS.music,
    SOCIAL: EMOJIS.helpSocial, TICKETS: EMOJIS.ticket, CODM: EMOJIS.gameCodm, LEVELING: EMOJIS.level,
};

const INTEL_COLORS = ['#1a1a2e', '#16213e', '#00d9ff', '#f5a623', '#e94560', '#00b894', '#636e72'];
function getIntelColor() { return INTEL_COLORS[Math.floor(Math.random() * INTEL_COLORS.length)]; }

function buildPagerRow(category, current, total, lang, t) {
    const prev = Math.max(0, current - 1), next = Math.min(total - 1, current + 1);
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`help_pg:${category}:${prev}:${total}`).setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(current <= 0),
        new ButtonBuilder().setCustomId(`help_pg:${category}:${next}:${total}`).setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(current >= total - 1)
    );
}

function formatExample(ex, prefix, cmdName, aliases = []) {
    if (ex.startsWith('/')) return ex;
    if (ex.startsWith(prefix + cmdName)) return ex;
    if (!ex.includes(' ') && (ex === cmdName || aliases.includes(ex))) return prefix + ex;
    if (ex.startsWith(prefix)) return ex;
    return prefix + cmdName + ' ' + ex;
}

function getRandomTip(t, prefix) {
    const tips = t.tips;
    return tips[Math.floor(Math.random() * tips.length)].replace(/{prefix}/g, prefix);
}

function getServerPlugins(client, guildId) {
    if (!guildId) return null;
    const settings = client.getServerSettings?.(guildId) || {};
    return { ECONOMY: settings.economy_enabled !== false, GAMING: settings.gaming_enabled !== false, AI: settings.ai_enabled !== false, PROFILE: settings.profile_enabled !== false, MODERATION: settings.moderation_enabled !== false, FUN: true, UTILITY: true, SYSTEM: true, OWNER: false, GENERAL: true };
}

function getCategoryStats(client) {
    const stats = {};
    for (const [name, cmd] of client.commands) {
        const category = cmd.category || 'GENERAL';
        stats[category] = (stats[category] || 0) + 1;
    }
    return stats;
}

function getTopCategories(stats, limit = 3) {
    return Object.entries(stats).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([cat, count]) => ({ cat, count }));
}

const FR_CAT_FALLBACK = { ADMIN: "Commandes d'administration du serveur", CONFIG: 'Configuration et paramètres du serveur', MUSIC: 'Lecture de musique et files d\'attente', SOCIAL: 'Commandes sociales et communautaires' };
function getCategoryDescription(cat, t, lang) {
    const upperCat = cat.toUpperCase();
    if (t.categoryDescriptions?.[upperCat]) return t.categoryDescriptions[upperCat];
    if (lang === 'fr' && FR_CAT_FALLBACK[upperCat]) return FR_CAT_FALLBACK[upperCat];
    return lang === 'fr' ? `Commandes pour le module ${cat}` : `Commands for the ${cat} module`;
}

function createCategoryView(client, category, prefix, lang, t, guildName, version, guildId, page = 0) {
    const cmds = client.commands.filter(c => (c.category || 'GENERAL').toUpperCase() === category.toUpperCase());
    const plugins = getServerPlugins(client, guildId);
    
    const c = new ContainerBuilder().setAccentColor(parseInt(getIntelColor().replace('#', ''), 16));

    if (plugins && category.toUpperCase() !== 'SYSTEM' && plugins[category.toUpperCase()] === false) {
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${emojiMap[category.toUpperCase()] || '📁'} ${category.toUpperCase()} MODULE`));
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${t.moduleDisabledTitle}**\n${t.moduleDisabledDesc}`));
        return { view: { components: [c], flags: MessageFlags.IsComponentsV2 }, totalPages: 1 };
    }

    const categoryEmoji = emojiMap[category.toUpperCase()] || '📁';
    const sortedCmds = [...cmds.values()].sort((a, b) => a.name.localeCompare(b.name));

    const rendered = sortedCmds.map(cmd => {
        try {
            const aliasesText = cmd.aliases?.length ? ` \`(${cmd.aliases.slice(0, 3).join(', ')})\`` : '';
            let examples = '';
            if (Array.isArray(cmd.examples) && cmd.examples.length) {
                const exList = cmd.examples.map(ex => formatExample(ex, prefix, cmd.name, cmd.aliases)).map(ex => '`' + ex + '`').join(', ');
                examples = `\n> 📝 Ex: ${exList}`;
            }
            const hasSlash = !!(cmd.data || cmd.execute);
            const slashBadge = hasSlash ? ' `[/]`' : '';
            let subcommandText = '';
            if (cmd.data?.options) {
                try {
                    const subs = cmd.data.options.filter(o => o.toJSON?.()?.type === 1);
                    if (subs.length > 0) {
                        const subList = subs.slice(0, 5).map(s => `\`/${cmd.name} ${(s.toJSON?.() || {}).name}\``).join(' · ');
                        const more = subs.length > 5 ? ` +${subs.length - 5}` : '';
                        subcommandText = `\n> 🔹 ${subList}${more}`;
                    }
                } catch(e) {}
            }
            return `\`▸ ${prefix}${cmd.name}\`${slashBadge}${aliasesText}\n> ${cmd.description || t.noDescription}${subcommandText}${examples}`;
        } catch (e) {
            return `\`▸ ${prefix}${cmd.name}\`\n> ⚠️`;
        }
    });

    const pageChunks = [];
    let curChunk = [], curLen = 0;
    for (const r of rendered) {
        if (curLen + r.length + 2 > 3500 && curChunk.length) { pageChunks.push(curChunk); curChunk = []; curLen = 0; }
        curChunk.push(r); curLen += r.length + 2;
    }
    if (curChunk.length || pageChunks.length === 0) pageChunks.push(curChunk);
    const totalPages = pageChunks.length;
    const safePage = Math.min(Math.max(0, page), totalPages - 1);
    const commandList = pageChunks[safePage].join('\n\n');
    const pageLabel = totalPages > 1 ? ` — ${safePage + 1}/${totalPages}` : '';

    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${categoryEmoji} ${category.toUpperCase()} ${t.module}${pageLabel}`));
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(commandList || t.noCommands));
    
    if (safePage === totalPages - 1) {
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${t.moduleStatsTitle}**\n\`\`\`yaml\n${t.totalCommands}: ${cmds.size}\n${t.aliasesRegistered}: ${cmds.reduce((sum, cmd) => sum + (cmd.aliases?.length || 0), 0)}\nSTATUS: ONLINE\`\`\``));
    }
    
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${guildName} • ${t.useHelpForDetails.replace('{prefix}', prefix)} • ${cmds.size} ${t.commandsAvailable} • v${version} • UNCLASSIFIED`));

    return { view: { components: [c], flags: MessageFlags.IsComponentsV2 }, totalPages };
}

module.exports = {
    name: 'help', aliases: ['h', 'menu', 'docs', 'aide', 'commandes', 'commands'],
    description: 'Browse all ARCHON CG-223 commands, modules and subcommands.',
    category: 'SYSTEM', cooldown: 3000,

    data: new SlashCommandBuilder().setName('help').setDescription('Browse all ARCHON CG-223 commands and modules')
        .addStringOption(option => option.setName('query').setDescription('Command or category to view').setRequired(false).setAutocomplete(true)),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const choices = [...interaction.client.commands.keys()].filter(cmd => cmd.startsWith(focusedValue.toLowerCase())).slice(0, 25);
        await interaction.respond(choices.map(choice => ({ name: choice, value: choice })));
    },

    run: async (client, message, args, database, serverSettings, usedCommand) => {
        const guildId = message.guild?.id ?? 'DM';
        const lang = pickLang(client, guildId, message);
        const t = loadT(lang);
        const effectivePrefix = serverSettings?.prefix || process.env.PREFIX || '.';
        const version = client.version || '3.1.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';

        const totalMembers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0) || 0;
        const totalGuilds = (client.db ? (client.db.prepare("SELECT COUNT(DISTINCT guild_id) FROM users WHERE guild_id NOT IN ('DM','telegram')").get()["COUNT(DISTINCT guild_id)"] || client.guilds.cache.size) : client.guilds.cache.size) || 0;

        if (args[0]) {
            const searchTerm = args[0].toUpperCase();
            const categories = [...new Set(client.commands.map(cmd => (cmd.category || 'GENERAL').toUpperCase()))];

            if (categories.includes(searchTerm)) {
                const { view, totalPages } = createCategoryView(client, searchTerm, effectivePrefix, lang, t, guildName, version, message.guild?.id, 0);
                const catReply = await message.reply({ ...view, components: [...view.components, ...(totalPages > 1 ? [buildPagerRow(searchTerm, 0, totalPages, lang, t)] : [])] }).catch(() => null);
                if (catReply && totalPages > 1) {
                    const catCol = catReply.createMessageComponentCollector({ time: 300000 });
                    catCol.on('collect', async (bi) => {
                        if (bi.user.id !== message.author.id) return bi.reply({ content: t.accessDenied, flags: 64 }).catch(() => {});
                        if (bi.isButton() && bi.customId.startsWith('help_pg:')) {
                            await bi.deferUpdate().catch(() => {});
                            const [, pgCat, pgIdx, pgTotal] = bi.customId.split(':');
                            const newIdx = Math.max(0, Math.min(parseInt(pgTotal) - 1, parseInt(pgIdx) || 0));
                            const { view: pgView } = createCategoryView(client, pgCat, effectivePrefix, lang, t, guildName, version, message.guild?.id, newIdx);
                            await bi.editReply({ ...pgView, components: [...pgView.components, buildPagerRow(pgCat, newIdx, parseInt(pgTotal), lang, t)] }).catch(() => {});
                        }
                    });
                }
                return;
            }

            const cmdLower = args[0].toLowerCase();
            const cmd = client.commands.get(cmdLower) || client.commands.find(c => c.aliases && c.aliases.includes(cmdLower));

            if (cmd) {
                const category = cmd.category || 'GENERAL';
                const categoryEmoji = emojiMap[category.toUpperCase()] || '📁';
                const c = new ContainerBuilder().setAccentColor(parseInt(getIntelColor().replace('#', ''), 16));
                
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${categoryEmoji} ${t.commandExtract}\n\`[ ${t.module}: ${cmd.name.toUpperCase()} ]\``));
                c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`\`\`yaml\n${cmd.description || t.noDescription}\`\`\``));
                c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
                
                let body = `**📂 ${t.category}** · \`${category}\` • ${getCategoryDescription(category, t, lang)}\n`;
                body += `**🔧 ${t.usage}** · \`${effectivePrefix}${cmd.name} ${cmd.usage || ''}\`\n`;
                body += `**🔀 ${t.aliases}** · ${cmd.aliases?.length ? `\`${cmd.aliases.join(', ')}\`` : `\`${t.none}\``}\n`;
                if (cmd.examples?.length) {
                    const exList = cmd.examples.map(ex => formatExample(ex, effectivePrefix, cmd.name, cmd.aliases)).map(ex => '`' + ex + '`').join(', ');
                    body += `**🎯 ${t.examples}** · ${exList}\n`;
                }
                if (cmd.cooldown) {
                    body += `**⏱️ ${t.cooldown}** · \`${cmd.cooldown/1000} ${t.seconds}\`\n`;
                }
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${guildName} • ${t.bamakoNode} • ${client.commands.size} ${t.modulesOnline} • v${version} • UNCLASSIFIED`));
                
                return message.reply({ components: [c], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            }

            const cErr = new ContainerBuilder().setAccentColor(0xe94560);
            cErr.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${t.signalLost}\n\`[ ${t.commandNotFound} ]\``));
            cErr.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
            cErr.addTextDisplayComponents(new TextDisplayBuilder().setContent(i18n.t('help.notFoundDesc', lang, { arg: args[0], prefix: effectivePrefix })));
            cErr.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${guildName} • ${t.checkSpelling} • UNCLASSIFIED`));
            return message.reply({ components: [cErr], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        }

        const categories = [...new Set(client.commands.map(cmd => (cmd.category || 'GENERAL').toUpperCase()))].sort();
        const categoryStats = getCategoryStats(client);
        const topCategories = getTopCategories(categoryStats);
        const totalCommands = client.commands.size;
        const totalAliases = client.aliases?.size || 0;
        
        const topCategoriesDisplay = topCategories.map((c, i) => `${['🥇', '🥈', '🥉'][i]} **${c.cat}**: \`${c.count}\` ${t.commands.toLowerCase()}`).join('\n');
        
        const uptimeSec = process.uptime();
        let uptimeString = `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m`;

        const cMain = new ContainerBuilder().setAccentColor(parseInt(getIntelColor().replace('#', ''), 16));
        cMain.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🦅 ${t.directoryTitle}`));
        cMain.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        cMain.addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`\`\`yaml\n${t.systemStatus}: 🟢 ${t.online}\n${t.node}: BAMAKO-223\n${t.core}: OpenRouter + Brave Search\n${t.uptime}: ${uptimeString}\n${t.version}: v${version}\`\`\``));
        cMain.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${t.moduleStats}**\n\`\`\`yaml\n${t.commands}: ${totalCommands}\n${t.aliasesStat}: ${totalAliases}\n${t.categories}: ${categories.length}\n${t.agents}: ${totalMembers.toLocaleString()}\n${t.guilds}: ${totalGuilds}\`\`\``));
        cMain.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${t.topCategories}**\n${topCategoriesDisplay || t.noData}`));
        cMain.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${t.quickAccess}**\n\`\`\`yaml\n${effectivePrefix}game menu\n${effectivePrefix}daily\n${effectivePrefix}rank\n${effectivePrefix}shop\`\`\``));
        cMain.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        cMain.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${guildName} • ${t.footer} • v${version} • ${t.selectModuleBelow} • UNCLASSIFIED`));

        const menu = new StringSelectMenuBuilder().setCustomId('help_select').setPlaceholder(t.selectPlaceholder)
            .addOptions(categories.map(cat => ({
                label: cat.substring(0, 100), value: cat, description: getCategoryDescription(cat, t, lang).substring(0, 100), emoji: emojiMap[cat] || '📁'
            })));

        const row1 = new ActionRowBuilder().addComponents(menu);
        const row2 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('help_back').setLabel(t.mainMenu).setStyle(ButtonStyle.Secondary).setDisabled(true));

        const response = await message.reply({ components: [cMain, row1, row2], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
        if (!response) return;

        const collector = response.createMessageComponentCollector({ time: 300000 });

        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) return i.reply({ content: t.accessDenied, flags: 64 }).catch(() => {});
            try {
                if (i.customId === 'help_back') {
                    await i.deferUpdate().catch(() => {});
                    await i.editReply({ components: [cMain, row1, row2], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
                    return;
                }
                if (i.isButton() && i.customId.startsWith('help_pg:')) {
                    await i.deferUpdate().catch(() => {});
                    const [, pgCat, pgIdx, pgTotal] = i.customId.split(':');
                    const newIdx = Math.max(0, Math.min(parseInt(pgTotal) - 1, parseInt(pgIdx) || 0));
                    const { view } = createCategoryView(client, pgCat, effectivePrefix, lang, t, guildName, version, message.guild?.id, newIdx);
                    const pgRow2 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('help_back').setLabel(t.backToMain).setStyle(ButtonStyle.Secondary).setDisabled(false));
                    await i.editReply({ ...view, components: [...view.components, row1, pgRow2, buildPagerRow(pgCat, newIdx, parseInt(pgTotal), lang, t)] }).catch(() => {});
                    return;
                }
                if (i.isStringSelectMenu() && i.customId === 'help_select') {
                    await i.deferUpdate().catch(() => {});
                    const category = i.values[0];
                    const { view, totalPages } = createCategoryView(client, category, effectivePrefix, lang, t, guildName, version, message.guild?.id, 0);
                    const updatedRow2 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('help_back').setLabel(t.backToMain).setStyle(ButtonStyle.Secondary).setDisabled(false));
                    await i.editReply({ ...view, components: [...view.components, row1, updatedRow2, ...(totalPages > 1 ? [buildPagerRow(category, 0, totalPages, lang, t)] : [])] }).catch(() => {});
                    return;
                }
            } catch (err) {
                console.error('[HELP ERROR]', err);
            }
        });

        collector.on('end', async () => {
            const disabledMenu = new StringSelectMenuBuilder(menu.data).setDisabled(true);
            await response.edit({ components: [cMain, new ActionRowBuilder().addComponents(disabledMenu), row2] }).catch(() => {});
        });
    },

    execute: async (interaction, client) => {
        const query = interaction.options.getString('query');
        const args = query ? [query] : [];

        if (!interaction.guild) {
            const lang = pickLang(client, 'DM', interaction);
            const t = loadT(lang);
            const cDm = new ContainerBuilder().setAccentColor(0x00fbff);
            cDm.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 📡 ${lang === 'fr' ? 'TRANSMISSION NEURALE DIRECTE' : 'DIRECT NEURAL TRANSMISSION'}`));
            cDm.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
            cDm.addTextDisplayComponents(new TextDisplayBuilder().setContent(lang === 'fr' ? `*Connexion neurale directe établie.*\n\n**Commandes disponibles en DM :**\n\n⚙️ **/help** - Ce menu d'aide\n📊 **/stats** - Statistiques du système\n📖 **/about** - Informations sur l'Architecte\n🎮 **/wrg** - Jeu de devinettes\n🔍 **/whois** - Scanner un agent\n\n🌐 **Commandes serveur uniquement :**\n*Les commandes d'économie, de modération et de profil nécessitent d'être dans un serveur.*` : `*Direct neural connection established.*\n\n**Available in DMs:**\n\n🛡️ **/help** — This help menu\n📊 **/stats** — System statistics\n🦅 **/about** — Architect information\n🎮 **/wrg** — Word guessing game\n📊 **/whois** — Scan an agent\n\n🌐 **Server-Only Commands:**\n*Economy, moderation, and profile commands require a server.*`));
            cDm.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**🌐 Dashboard** · [bamako-steel-dev.xyz](https://bamako-steel-dev.xyz)`));
            cDm.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${lang === 'fr' ? 'NŒUD BAMAKO-223 • TRANSMISSION SÉCURISÉE • UNCLASSIFIED' : 'BAMAKO-223 NODE • SECURE TRANSMISSION • UNCLASSIFIED'}`));

            const categories = [...new Set(client.commands.map(cmd => (cmd.category || 'GENERAL').toUpperCase()))].sort();
            const categoryOptions = categories.slice(0, 25).map(cat => ({
                label: cat.substring(0, 100), value: cat, description: `${client.commands.filter(c => (c.category || 'GENERAL').toUpperCase() === cat).size} ${lang === 'fr' ? 'commande(s)' : 'command(s)'}`, emoji: emojiMap[cat] || '📁'
            }));

            const selectMenu = new StringSelectMenuBuilder().setCustomId('help_dm_category').setPlaceholder(lang === 'fr' ? '📋 Explorer les commandes serveur...' : '📋 Explore server commands...').addOptions(categoryOptions);
            const row = new ActionRowBuilder().addComponents(selectMenu);

            const reply = await interaction.reply({ components: [cDm, row], flags: 64 }).catch(() => {});
            if (!reply) return;

            const collector = reply.createMessageComponentCollector({ time: 120000 });
            collector.on('collect', async (i) => {
                if (i.user.id !== interaction.user.id) return i.reply({ content: lang === 'fr' ? '❌ Ce menu ne vous appartient pas.' : '❌ This menu is not yours.', flags: 64 }).catch(() => {});
                if (i.customId === 'help_dm_category') {
                    await i.deferUpdate().catch(() => {});
                    const category = i.values[0];
                    const cmds = client.commands.filter(c => (c.category || 'GENERAL').toUpperCase() === category.toUpperCase());
                    const sortedCmds = [...cmds.values()].sort((a, b) => a.name.localeCompare(b.name));
                    const cCat = new ContainerBuilder().setAccentColor(0x00fbff);
                    cCat.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${emojiMap[category.toUpperCase()] || '📁'} ${category} ${lang === 'fr' ? 'Commandes' : 'Commands'}`));
                    cCat.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
                    cCat.addTextDisplayComponents(new TextDisplayBuilder().setContent(sortedCmds.map(cmd => `\`▸ /${cmd.name}\`${cmd.aliases?.length ? ` \`(${cmd.aliases.slice(0, 3).join(', ')})\`` : ''}\n> ${cmd.description || (lang === 'fr' ? 'Aucune description' : 'No description')}`).join('\n\n') || (lang === 'fr' ? 'Aucune commande trouvée.' : 'No commands found.')));
                    cCat.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# 🌐 ${lang === 'fr' ? 'Ces commandes nécessitent un serveur' : 'These commands require a server'} • UNCLASSIFIED`));
                    await i.editReply({ components: [cCat], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
                }
            });
            return;
        }

        await interaction.deferReply({ flags: 64 });
        const serverSettings = interaction.guild ? client.getServerSettings(interaction.guild.id) : { prefix: '.' };
        const fakeMessage = { author: interaction.user, guild: interaction.guild, channel: interaction.channel, reply: async (options) => interaction.editReply(options), react: () => Promise.resolve() };
        await module.exports.run(client, fakeMessage, args, null, serverSettings, 'help');
    }
};
