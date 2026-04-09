const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType, PermissionsBitField, ChannelType } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        title: '⚙️ SERVER CONFIGURATION',
        noPermission: '❌ You need **Administrator** permission to configure this server.',
        currentSettings: '📋 CURRENT SETTINGS',
        prefix: 'Prefix',
        language: 'Language',
        welcomeChannel: 'Welcome Channel',
        logChannel: 'Log Channel',
        dailyChannel: 'Daily Channel',
        shopChannel: 'Shop Channel',
        notSet: 'Not Set',
        selectSetting: 'Select a setting to configure...',
        settingOptions: {
            prefix: '🔧 Command Prefix',
            language: '🌐 Server Language',
            welcome: '👋 Welcome Channel',
            log: '📋 Log Channel',
            daily: '📊 Daily Channel',
            shop: '🛒 Shop Channel'
        },
        settingDesc: {
            prefix: 'Change the command prefix for this server',
            language: 'Set the default language (English/French)',
            welcome: 'Channel where welcome messages are sent',
            log: 'Channel for moderation logs',
            daily: 'Restrict .daily and .claim commands to this channel',
            shop: 'Restrict .shop command to this channel'
        },
        currentValue: 'Current Value',
        enterNew: 'Enter new value',
        enterPrefix: 'Enter new prefix (1-3 characters):',
        selectChannel: 'Select a channel...',
        selectLanguage: 'Select a language...',
        english: '🇬🇧 English',
        french: '🇫🇷 Français',
        reset: '🔄 Reset',
        confirm: '✅ Confirm',
        cancel: '❌ Cancel',
        back: '◀ Back',
        updated: '✅ Setting Updated',
        updatedDesc: (setting, value) => `**${setting}** has been set to \`${value}\`.`,
        resetSuccess: (setting) => `**${setting}** has been reset to default.`,
        cancelled: '❌ Configuration cancelled.',
        timeout: '⏰ Configuration timed out.',
        footer: 'ARCHITECT CG-223 • Server Configuration',
        accessDenied: '❌ This menu is not yours.',
        error: '❌ An error occurred.',
        prefixInvalid: '❌ Prefix must be 1-3 characters.',
        textChannel: 'Text Channel',
        noChannels: 'No text channels available',
        loading: '🔍 Loading settings...'
    },
    fr: {
        title: '⚙️ CONFIGURATION DU SERVEUR',
        noPermission: '❌ Vous avez besoin de la permission **Administrateur** pour configurer ce serveur.',
        currentSettings: '📋 PARAMÈTRES ACTUELS',
        prefix: 'Préfixe',
        language: 'Langue',
        welcomeChannel: 'Canal d\'Accueil',
        logChannel: 'Canal de Logs',
        dailyChannel: 'Canal Quotidien',
        shopChannel: 'Canal Boutique',
        notSet: 'Non Défini',
        selectSetting: 'Sélectionnez un paramètre à configurer...',
        settingOptions: {
            prefix: '🔧 Préfixe de Commande',
            language: '🌐 Langue du Serveur',
            welcome: '👋 Canal d\'Accueil',
            log: '📋 Canal de Logs',
            daily: '📊 Canal Quotidien',
            shop: '🛒 Canal Boutique'
        },
        settingDesc: {
            prefix: 'Changer le préfixe des commandes pour ce serveur',
            language: 'Définir la langue par défaut (Anglais/Français)',
            welcome: 'Canal où les messages d\'accueil sont envoyés',
            log: 'Canal pour les logs de modération',
            daily: 'Restreindre les commandes .daily et .claim à ce canal',
            shop: 'Restreindre la commande .shop à ce canal'
        },
        currentValue: 'Valeur Actuelle',
        enterNew: 'Entrez la nouvelle valeur',
        enterPrefix: 'Entrez le nouveau préfixe (1-3 caractères):',
        selectChannel: 'Sélectionnez un canal...',
        selectLanguage: 'Sélectionnez une langue...',
        english: '🇬🇧 Anglais',
        french: '🇫🇷 Français',
        reset: '🔄 Réinitialiser',
        confirm: '✅ Confirmer',
        cancel: '❌ Annuler',
        back: '◀ Retour',
        updated: '✅ Paramètre Mis à Jour',
        updatedDesc: (setting, value) => `**${setting}** a été défini sur \`${value}\`.`,
        resetSuccess: (setting) => `**${setting}** a été réinitialisé.`,
        cancelled: '❌ Configuration annulée.',
        timeout: '⏰ Configuration expirée.',
        footer: 'ARCHITECT CG-223 • Configuration du Serveur',
        accessDenied: '❌ Ce menu ne vous appartient pas.',
        error: '❌ Une erreur est survenue.',
        prefixInvalid: '❌ Le préfixe doit avoir 1-3 caractères.',
        textChannel: 'Canal Texte',
        noChannels: 'Aucun canal texte disponible',
        loading: '🔍 Chargement des paramètres...'
    }
};

// ================= DEFAULT SETTINGS =================
const DEFAULT_SETTINGS = {
    prefix: process.env.PREFIX || '.',
    language: 'en',
    welcomeChannel: null,
    logChannel: null,
    dailyChannel: null,
    shopChannel: null
};

// ================= CREATE SETTINGS EMBED =================
function createSettingsEmbed(settings, lang, guild, client) {
    const t = translations[lang];
    const version = client.version || '1.5.0';
    const guildName = guild.name.toUpperCase();
    const guildIcon = guild.iconURL() || client.user.displayAvatarURL();
    
    const welcomeChannel = settings.welcomeChannel ? `<#${settings.welcomeChannel}>` : `\`${t.notSet}\``;
    const logChannel = settings.logChannel ? `<#${settings.logChannel}>` : `\`${t.notSet}\``;
    const dailyChannel = settings.dailyChannel ? `<#${settings.dailyChannel}>` : `\`${t.notSet}\``;
    const shopChannel = settings.shopChannel ? `<#${settings.shopChannel}>` : `\`${t.notSet}\``;
    
    return new EmbedBuilder()
        .setColor('#00fbff')
        .setAuthor({ name: `${t.title} • ${guild.name}`, iconURL: guildIcon })
        .setTitle(t.currentSettings)
        .setDescription(`\`\`\`yaml\n${t.prefix}: ${settings.prefix}\n${t.language}: ${settings.language === 'fr' ? t.french : t.english}\n${t.welcomeChannel}: ${welcomeChannel}\n${t.logChannel}: ${logChannel}\n${t.dailyChannel}: ${dailyChannel}\n${t.shopChannel}: ${shopChannel}\n\`\`\``)
        .setThumbnail(guild.iconURL({ dynamic: true, size: 512 }))
        .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
        .setTimestamp();
}

// ================= CREATE SETTINGS MENU =================
function createSettingsMenu(lang) {
    const t = translations[lang];
    return new StringSelectMenuBuilder()
        .setCustomId('settings_select')
        .setPlaceholder(t.selectSetting)
        .addOptions([
            { label: t.settingOptions.prefix, value: 'prefix', emoji: '🔧', description: t.settingDesc.prefix },
            { label: t.settingOptions.language, value: 'language', emoji: '🌐', description: t.settingDesc.language },
            { label: t.settingOptions.welcome, value: 'welcome', emoji: '👋', description: t.settingDesc.welcome },
            { label: t.settingOptions.log, value: 'log', emoji: '📋', description: t.settingDesc.log },
            { label: t.settingOptions.daily, value: 'daily', emoji: '📊', description: t.settingDesc.daily },
            { label: t.settingOptions.shop, value: 'shop', emoji: '🛒', description: t.settingDesc.shop }
        ]);
}

// ================= CREATE CHANNEL SELECT MENU =================
function createChannelSelectMenu(guild, lang) {
    const t = translations[lang];
    const channels = guild.channels.cache
        .filter(c => c.type === ChannelType.GuildText)
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 25)
        .map(c => ({ label: `#${c.name}`.substring(0, 100), value: c.id, description: `${t.textChannel}`.substring(0, 100) }));
    
    if (channels.length === 0) channels.push({ label: t.noChannels, value: 'none' });
    
    return new StringSelectMenuBuilder().setCustomId('settings_channel').setPlaceholder(t.selectChannel).addOptions(channels);
}

// ================= CREATE LANGUAGE SELECT MENU =================
function createLanguageMenu(lang) {
    const t = translations[lang];
    return new StringSelectMenuBuilder()
        .setCustomId('settings_language')
        .setPlaceholder(t.selectLanguage)
        .addOptions([
            { label: t.english, value: 'en', emoji: '🇬🇧' },
            { label: t.french, value: 'fr', emoji: '🇫🇷' }
        ]);
}

// ================= MAIN COMMAND =================
module.exports = {
    name: 'settings',
    aliases: ['config', 'setup', 'configuration', 'parametres', 'params', 'paramètres'],
    description: '⚙️ Configure server settings like prefix, language, and channels.',
    category: 'SYSTEM',
    cooldown: 3000,
    userPermissions: ['Administrator'],
    usage: '.settings',
    examples: ['.settings', '.config', '.paramètres'],

    run: async (client, message, args, database, serverSettings, usedCommand) => {
        
        // ================= PERMISSION CHECK =================
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            const lang = serverSettings?.language || 'en';
            return message.reply({ content: translations[lang].noPermission, ephemeral: true });
        }
        
        // ================= SMART LANGUAGE DETECTION =================
        const cmd = usedCommand?.toLowerCase() || message.content.split(' ')[0].slice(1).toLowerCase();
        let lang = client.detectLanguage ? client.detectLanguage(cmd, serverSettings?.language || 'en') : (serverSettings?.language || 'en');
        
        const t = translations[lang];
        const version = client.version || '1.5.0';
        const guildName = message.guild.name.toUpperCase();
        const guildIcon = message.guild.iconURL() || client.user.displayAvatarURL();
        
        const db = database;
        const guildId = message.guild.id;
        
        const getSettings = () => {
            if (client.getServerSettings) {
                const settings = client.getServerSettings(guildId);
                return {
                    prefix: settings.prefix || DEFAULT_SETTINGS.prefix,
                    language: settings.language || DEFAULT_SETTINGS.language,
                    welcomeChannel: settings.welcomeChannel || null,
                    logChannel: settings.logChannel || null,
                    dailyChannel: settings.dailyChannel || null,
                    shopChannel: settings.shopChannel || null
                };
            }
            return serverSettings || DEFAULT_SETTINGS;
        };
        
        const updateSetting = (setting, value) => {
            if (client.updateServerSetting) return client.updateServerSetting(guildId, setting, value);
            return false;
        };
        
        let settings = getSettings();
        let selectedSetting = null;
        let prefixCollector = null;
        
        const embed = createSettingsEmbed(settings, lang, message.guild, client);
        const menu = createSettingsMenu(lang);
        const menuRow = new ActionRowBuilder().addComponents(menu);
        
        const reply = await message.reply({ content: `> ${t.loading}`, embeds: [embed], components: [menuRow] });
        
        const collector = reply.createMessageComponentCollector({ time: 180000 });
        
        collector.on('collect', async (i) => {
            try {
                if (i.user.id !== message.author.id) {
                    return i.reply({ content: t.accessDenied, ephemeral: true });
                }
                
                if (prefixCollector) { prefixCollector.stop(); prefixCollector = null; }
                
                // ===== SELECT MENUS =====
                if (i.isStringSelectMenu()) {
                    if (i.customId === 'settings_select') {
                        selectedSetting = i.values[0];
                        
                        if (selectedSetting === 'language') {
                            const langMenu = createLanguageMenu(lang);
                            const backRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId('settings_back').setLabel(t.back).setStyle(ButtonStyle.Secondary).setEmoji('◀'),
                                new ButtonBuilder().setCustomId('settings_cancel').setLabel(t.cancel).setStyle(ButtonStyle.Danger).setEmoji('❌')
                            );
                            await i.update({ components: [new ActionRowBuilder().addComponents(langMenu), backRow] });
                        } else if (['welcome', 'log', 'daily', 'shop'].includes(selectedSetting)) {
                            const channelMenu = createChannelSelectMenu(message.guild, lang);
                            const backRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId('settings_back').setLabel(t.back).setStyle(ButtonStyle.Secondary).setEmoji('◀'),
                                new ButtonBuilder().setCustomId('settings_cancel').setLabel(t.cancel).setStyle(ButtonStyle.Danger).setEmoji('❌'),
                                new ButtonBuilder().setCustomId('settings_reset').setLabel(t.reset).setStyle(ButtonStyle.Secondary).setEmoji('🔄')
                            );
                            await i.update({ components: [new ActionRowBuilder().addComponents(channelMenu), backRow] });
                        } else if (selectedSetting === 'prefix') {
                            const promptEmbed = new EmbedBuilder()
                                .setColor('#FEE75C')
                                .setTitle('🔧 ' + t.settingOptions.prefix)
                                .setDescription(`**${t.currentValue}:** \`${settings.prefix}\`\n\n${t.enterPrefix}\n\n*${lang === 'fr' ? 'Tapez votre réponse' : 'Type your response'}*`)
                                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });
                            
                            const backRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId('settings_back').setLabel(t.back).setStyle(ButtonStyle.Secondary).setEmoji('◀'),
                                new ButtonBuilder().setCustomId('settings_cancel').setLabel(t.cancel).setStyle(ButtonStyle.Danger).setEmoji('❌')
                            );
                            await i.update({ embeds: [promptEmbed], components: [backRow] });
                            
                            const filter = m => m.author.id === message.author.id;
                            prefixCollector = message.channel.createMessageCollector({ filter, time: 30000, max: 1 });
                            
                            prefixCollector.on('collect', async (m) => {
                                let newPrefix = m.content.trim();
                                if (newPrefix.length < 1 || newPrefix.length > 3) {
                                    await m.reply({ content: t.prefixInvalid, ephemeral: true });
                                    prefixCollector.stop();
                                    return;
                                }
                                updateSetting('prefix', newPrefix);
                                settings = getSettings();
                                const newEmbed = createSettingsEmbed(settings, lang, message.guild, client);
                                const newMenuRow = new ActionRowBuilder().addComponents(createSettingsMenu(lang));
                                await reply.edit({ embeds: [newEmbed], components: [newMenuRow] });
                                await m.delete().catch(() => {});
                                prefixCollector.stop();
                            });
                            
                            prefixCollector.on('end', async (collected, reason) => {
                                prefixCollector = null;
                                if (reason === 'timeout' && collected.size === 0) {
                                    const newEmbed = createSettingsEmbed(settings, lang, message.guild, client);
                                    const newMenuRow = new ActionRowBuilder().addComponents(createSettingsMenu(lang));
                                    await reply.edit({ embeds: [newEmbed], components: [newMenuRow] });
                                }
                            });
                        }
                    }
                    
                    if (i.customId === 'settings_language') {
                        const newLang = i.values[0];
                        updateSetting('language', newLang);
                        settings = getSettings();
                        lang = newLang;
                        const newT = translations[newLang];
                        const successEmbed = new EmbedBuilder().setColor('#2ecc71').setTitle(newT.updated).setDescription(newT.updatedDesc(newT.settingOptions.language, newLang === 'fr' ? newT.french : newT.english)).setFooter({ text: `${guildName} • ${newT.footer} • v${version}`, iconURL: guildIcon });
                        await i.reply({ embeds: [successEmbed], ephemeral: true });
                        const newEmbed = createSettingsEmbed(settings, newLang, message.guild, client);
                        const newMenuRow = new ActionRowBuilder().addComponents(createSettingsMenu(newLang));
                        await reply.edit({ embeds: [newEmbed], components: [newMenuRow] });
                    }
                    
                    if (i.customId === 'settings_channel') {
                        const channelId = i.values[0];
                        if (channelId === 'none') return i.reply({ content: '❌ ' + t.noChannels, ephemeral: true });
                        const channel = message.guild.channels.cache.get(channelId);
                        if (!channel) return i.reply({ content: t.error, ephemeral: true });
                        
                        const settingMap = { welcome: 'welcome', log: 'log', daily: 'daily', shop: 'shop' };
                        const dbSetting = settingMap[selectedSetting];
                        if (!dbSetting) return i.reply({ content: t.error, ephemeral: true });
                        
                        updateSetting(dbSetting, channelId);
                        settings = getSettings();
                        
                        const settingNames = { welcome: t.settingOptions.welcome, log: t.settingOptions.log, daily: t.settingOptions.daily, shop: t.settingOptions.shop };
                        const successEmbed = new EmbedBuilder().setColor('#2ecc71').setTitle(t.updated).setDescription(t.updatedDesc(settingNames[selectedSetting], `#${channel.name}`)).setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });
                        await i.reply({ embeds: [successEmbed], ephemeral: true });
                        
                        const newEmbed = createSettingsEmbed(settings, lang, message.guild, client);
                        const newMenuRow = new ActionRowBuilder().addComponents(createSettingsMenu(lang));
                        await reply.edit({ embeds: [newEmbed], components: [newMenuRow] });
                    }
                }
                
                // ===== BUTTONS =====
                if (i.isButton()) {
                    if (i.customId === 'settings_back' || i.customId === 'settings_cancel') {
                        if (prefixCollector) { prefixCollector.stop(); prefixCollector = null; }
                        const newEmbed = createSettingsEmbed(settings, lang, message.guild, client);
                        const newMenuRow = new ActionRowBuilder().addComponents(createSettingsMenu(lang));
                        await i.update({ embeds: [newEmbed], components: [newMenuRow] });
                    }
                    
                    if (i.customId === 'settings_reset') {
                        const settingMap = { welcome: 'welcome', log: 'log', daily: 'daily', shop: 'shop' };
                        const dbSetting = settingMap[selectedSetting];
                        if (!dbSetting) return i.reply({ content: t.error, ephemeral: true });
                        
                        updateSetting(dbSetting, null);
                        settings = getSettings();
                        
                        const settingNames = { welcome: t.settingOptions.welcome, log: t.settingOptions.log, daily: t.settingOptions.daily, shop: t.settingOptions.shop };
                        const successEmbed = new EmbedBuilder().setColor('#2ecc71').setTitle(t.updated).setDescription(t.resetSuccess(settingNames[selectedSetting])).setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });
                        await i.reply({ embeds: [successEmbed], ephemeral: true });
                        
                        const newEmbed = createSettingsEmbed(settings, lang, message.guild, client);
                        const newMenuRow = new ActionRowBuilder().addComponents(createSettingsMenu(lang));
                        await reply.edit({ embeds: [newEmbed], components: [newMenuRow] });
                    }
                }
            } catch (error) {
                console.error('[SETTINGS] Collector error:', error);
                try { if (!i.replied && !i.deferred) await i.reply({ content: t.error, ephemeral: true }); } catch (e) {}
            }
        });
        
        collector.on('end', async () => {
            if (prefixCollector) { prefixCollector.stop(); prefixCollector = null; }
            try {
                const disabledMenu = new ActionRowBuilder().addComponents(createSettingsMenu(lang).setDisabled(true));
                await reply.edit({ components: [disabledMenu] }).catch(() => {});
            } catch (error) {}
        });
    }
};