const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType, PermissionsBitField, ChannelType } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        // Headers
        title: '⚙️ SERVER CONFIGURATION',
        noPermission: '❌ You need **Administrator** permission to configure this server.',
        currentSettings: '📋 CURRENT SETTINGS',
        
        // Settings fields
        prefix: 'Prefix',
        language: 'Language',
        welcomeChannel: 'Welcome Channel',
        logChannel: 'Log Channel',
        dailyChannel: 'Daily Channel',
        notSet: 'Not Set',
        
        // Select menu
        selectSetting: 'Select a setting to configure...',
        settingOptions: {
            prefix: '🔧 Command Prefix',
            language: '🌐 Server Language',
            welcome: '👋 Welcome Channel',
            log: '📋 Log Channel',
            daily: '📊 Daily Channel'
        },
        settingDesc: {
            prefix: 'Change the command prefix for this server',
            language: 'Set the default language (English/French)',
            welcome: 'Channel where welcome messages are sent',
            log: 'Channel for moderation logs',
            daily: 'Restrict .daily and .claim commands to this channel'
        },
        
        // Values
        currentValue: 'Current Value',
        enterNew: 'Enter new value',
        enterPrefix: 'Enter new prefix (1-3 characters):',
        selectChannel: 'Select a channel...',
        selectLanguage: 'Select a language...',
        english: '🇬🇧 English',
        french: '🇫🇷 Français',
        
        // Buttons
        reset: '🔄 Reset',
        confirm: '✅ Confirm',
        cancel: '❌ Cancel',
        back: '◀ Back',
        
        // Messages
        updated: '✅ Setting Updated',
        updatedDesc: (setting, value) => `**${setting}** has been set to \`${value}\`.`,
        resetSuccess: (setting) => `**${setting}** has been reset to default.`,
        cancelled: '❌ Configuration cancelled.',
        timeout: '⏰ Configuration timed out.',
        footer: 'ARCHITECT CG-223 • Server Configuration',
        accessDenied: '❌ This menu is not yours.',
        error: '❌ An error occurred while processing your request.',
        
        // Channel types
        textChannel: 'Text Channel',
        noChannels: 'No text channels available'
    },
    fr: {
        // Headers
        title: '⚙️ CONFIGURATION DU SERVEUR',
        noPermission: '❌ Vous avez besoin de la permission **Administrateur** pour configurer ce serveur.',
        currentSettings: '📋 PARAMÈTRES ACTUELS',
        
        // Settings fields
        prefix: 'Préfixe',
        language: 'Langue',
        welcomeChannel: 'Canal d\'Accueil',
        logChannel: 'Canal de Logs',
        dailyChannel: 'Canal Quotidien',
        notSet: 'Non Défini',
        
        // Select menu
        selectSetting: 'Sélectionnez un paramètre à configurer...',
        settingOptions: {
            prefix: '🔧 Préfixe de Commande',
            language: '🌐 Langue du Serveur',
            welcome: '👋 Canal d\'Accueil',
            log: '📋 Canal de Logs',
            daily: '📊 Canal Quotidien'
        },
        settingDesc: {
            prefix: 'Changer le préfixe des commandes pour ce serveur',
            language: 'Définir la langue par défaut (Anglais/Français)',
            welcome: 'Canal où les messages d\'accueil sont envoyés',
            log: 'Canal pour les logs de modération',
            daily: 'Restreindre les commandes .daily et .claim à ce canal'
        },
        
        // Values
        currentValue: 'Valeur Actuelle',
        enterNew: 'Entrez la nouvelle valeur',
        enterPrefix: 'Entrez le nouveau préfixe (1-3 caractères):',
        selectChannel: 'Sélectionnez un canal...',
        selectLanguage: 'Sélectionnez une langue...',
        english: '🇬🇧 Anglais',
        french: '🇫🇷 Français',
        
        // Buttons
        reset: '🔄 Réinitialiser',
        confirm: '✅ Confirmer',
        cancel: '❌ Annuler',
        back: '◀ Retour',
        
        // Messages
        updated: '✅ Paramètre Mis à Jour',
        updatedDesc: (setting, value) => `**${setting}** a été défini sur \`${value}\`.`,
        resetSuccess: (setting) => `**${setting}** a été réinitialisé.`,
        cancelled: '❌ Configuration annulée.',
        timeout: '⏰ Configuration expirée.',
        footer: 'ARCHITECT CG-223 • Configuration du Serveur',
        accessDenied: '❌ Ce menu ne vous appartient pas.',
        error: '❌ Une erreur est survenue lors du traitement de votre demande.',
        
        // Channel types
        textChannel: 'Canal Texte',
        noChannels: 'Aucun canal texte disponible'
    }
};

// ================= DEFAULT SETTINGS =================
const DEFAULT_SETTINGS = {
    prefix: process.env.PREFIX || '.',
    language: 'en',
    welcomeChannel: null,
    logChannel: null,
    dailyChannel: null
};

// ================= CREATE SETTINGS EMBED =================
function createSettingsEmbed(settings, lang, guild, client) {
    const t = translations[lang];
    
    const welcomeChannel = settings.welcomeChannel ? `<#${settings.welcomeChannel}>` : `\`${t.notSet}\``;
    const logChannel = settings.logChannel ? `<#${settings.logChannel}>` : `\`${t.notSet}\``;
    const dailyChannel = settings.dailyChannel ? `<#${settings.dailyChannel}>` : `\`${t.notSet}\``;
    
    const embed = new EmbedBuilder()
        .setColor('#00fbff')
        .setAuthor({ 
            name: `${t.title} • ${guild.name}`, 
            iconURL: guild.iconURL() || client.user.displayAvatarURL() 
        })
        .setTitle(t.currentSettings)
        .setDescription(
            `\`\`\`yaml\n` +
            `${t.prefix}: ${settings.prefix}\n` +
            `${t.language}: ${settings.language === 'fr' ? t.french : t.english}\n` +
            `${t.welcomeChannel}: ${welcomeChannel}\n` +
            `${t.logChannel}: ${logChannel}\n` +
            `${t.dailyChannel}: ${dailyChannel}\n` +
            `\`\`\``
        )
        .setThumbnail(guild.iconURL({ dynamic: true, size: 512 }))
        .setFooter({ text: `${t.footer} • v${client.version || '1.5.0'}` })
        .setTimestamp();
    
    return embed;
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
            { label: t.settingOptions.daily, value: 'daily', emoji: '📊', description: t.settingDesc.daily }
        ]);
}

// ================= CREATE CHANNEL SELECT MENU =================
function createChannelSelectMenu(guild, lang) {
    const t = translations[lang];
    
    const channels = guild.channels.cache
        .filter(c => c.type === ChannelType.GuildText)
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 25)
        .map(c => ({
            label: `#${c.name}`.substring(0, 100),
            value: c.id,
            description: `${t.textChannel} • ID: ${c.id}`.substring(0, 100)
        }));
    
    if (channels.length === 0) {
        channels.push({ label: t.noChannels, value: 'none' });
    }
    
    return new StringSelectMenuBuilder()
        .setCustomId('settings_channel')
        .setPlaceholder(t.selectChannel)
        .addOptions(channels);
}

// ================= CREATE LANGUAGE SELECT MENU =================
function createLanguageMenu(lang) {
    const t = translations[lang];
    
    return new StringSelectMenuBuilder()
        .setCustomId('settings_language')
        .setPlaceholder(t.selectLanguage)
        .addOptions([
            { label: t.english, value: 'en', emoji: '🇬🇧', description: 'Set server language to English' },
            { label: t.french, value: 'fr', emoji: '🇫🇷', description: 'Définir la langue du serveur sur Français' }
        ]);
}

// ================= MAIN COMMAND =================
module.exports = {
    name: 'settings',
    aliases: ['config', 'setup', 'configuration', 'parametres', 'params'],
    description: '⚙️ Configure server settings like prefix, language, and channels.',
    category: 'SYSTEM',
    cooldown: 3000,
    userPermissions: ['Administrator'],
    usage: '.settings',
    examples: ['.settings', '.config'],

    run: async (client, message, args, database, serverSettings) => {
        
        // ================= PERMISSION CHECK =================
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            const lang = serverSettings?.language || 'en';
            const t = translations[lang];
            return message.reply({ content: t.noPermission });
        }
        
        // ================= LANGUAGE SETUP =================
        const lang = serverSettings?.language || 'en';
        const t = translations[lang];
        
        const db = database;
        const guildId = message.guild.id;
        
        // Use the client's getServerSettings function (from index.js)
        const getSettings = () => {
            if (client.getServerSettings) {
                return client.getServerSettings(guildId);
            }
            return serverSettings || DEFAULT_SETTINGS;
        };
        
        const updateSetting = (setting, value) => {
            if (client.updateServerSetting) {
                return client.updateServerSetting(guildId, setting, value);
            }
            return false;
        };
        
        let settings = getSettings();
        
        // ================= CREATE INITIAL VIEW =================
        const embed = createSettingsEmbed(settings, lang, message.guild, client);
        const menu = createSettingsMenu(lang);
        const menuRow = new ActionRowBuilder().addComponents(menu);
        
        const reply = await message.reply({ embeds: [embed], components: [menuRow] });
        
        // ================= COLLECTOR =================
        const collector = reply.createMessageComponentCollector({ 
            componentType: ComponentType.StringSelect, 
            time: 180000 
        });
        
        let selectedSetting = null;
        let prefixCollector = null;
        
        collector.on('collect', async (i) => {
            try {
                // Stop any existing prefix collector
                if (prefixCollector) {
                    prefixCollector.stop();
                    prefixCollector = null;
                }
                
                if (i.user.id !== message.author.id) {
                    return i.reply({ content: t.accessDenied, ephemeral: true });
                }
                
                // Handle main settings selection
                if (i.customId === 'settings_select') {
                    selectedSetting = i.values[0];
                    
                    if (selectedSetting === 'language') {
                        // Language selection
                        const langMenu = createLanguageMenu(lang);
                        const backRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('settings_back').setLabel(t.back).setStyle(ButtonStyle.Secondary).setEmoji('◀'),
                            new ButtonBuilder().setCustomId('settings_cancel').setLabel(t.cancel).setStyle(ButtonStyle.Danger).setEmoji('❌')
                        );
                        
                        await i.update({ components: [new ActionRowBuilder().addComponents(langMenu), backRow] });
                        
                    } else if (selectedSetting === 'welcome' || selectedSetting === 'log' || selectedSetting === 'daily') {
                        // Channel selection
                        const channelMenu = createChannelSelectMenu(message.guild, lang);
                        const backRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('settings_back').setLabel(t.back).setStyle(ButtonStyle.Secondary).setEmoji('◀'),
                            new ButtonBuilder().setCustomId('settings_cancel').setLabel(t.cancel).setStyle(ButtonStyle.Danger).setEmoji('❌'),
                            new ButtonBuilder().setCustomId('settings_reset').setLabel(t.reset).setStyle(ButtonStyle.Secondary).setEmoji('🔄')
                        );
                        
                        await i.update({ components: [new ActionRowBuilder().addComponents(channelMenu), backRow] });
                        
                    } else if (selectedSetting === 'prefix') {
                        // Prefix input prompt
                        const promptEmbed = new EmbedBuilder()
                            .setColor('#FEE75C')
                            .setTitle('🔧 ' + t.settingOptions.prefix)
                            .setDescription(
                                `**${t.currentValue}:** \`${settings.prefix}\`\n\n` +
                                `${t.enterPrefix}\n\n` +
                                `*${lang === 'fr' ? 'Tapez votre réponse dans le chat' : 'Type your response in chat'}*`
                            )
                            .setFooter({ text: t.footer });
                        
                        const backRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('settings_back').setLabel(t.back).setStyle(ButtonStyle.Secondary).setEmoji('◀'),
                            new ButtonBuilder().setCustomId('settings_cancel').setLabel(t.cancel).setStyle(ButtonStyle.Danger).setEmoji('❌')
                        );
                        
                        await i.update({ embeds: [promptEmbed], components: [backRow] });
                        
                        // Wait for message
                        const filter = m => m.author.id === message.author.id;
                        prefixCollector = message.channel.createMessageCollector({ filter, time: 30000, max: 1 });
                        
                        prefixCollector.on('collect', async (m) => {
                            try {
                                let newPrefix = m.content.trim();
                                
                                if (newPrefix.length < 1 || newPrefix.length > 3) {
                                    const errorMsg = await m.reply({ 
                                        content: lang === 'fr' 
                                            ? '❌ Le préfixe doit avoir 1-3 caractères.' 
                                            : '❌ Prefix must be 1-3 characters.'
                                    });
                                    setTimeout(() => errorMsg.delete().catch(() => {}), 5000);
                                    prefixCollector.stop();
                                    return;
                                }
                                
                                updateSetting('prefix', newPrefix);
                                settings = getSettings();
                                
                                const newEmbed = createSettingsEmbed(settings, lang, message.guild, client);
                                const newMenuRow = new ActionRowBuilder().addComponents(createSettingsMenu(lang));
                                
                                await reply.edit({ embeds: [newEmbed], components: [newMenuRow] });
                                await m.delete().catch(() => {});
                                
                                // Show success message
                                const successMsg = await message.channel.send({
                                    content: `✅ ${t.updatedDesc(t.settingOptions.prefix, newPrefix)}`
                                });
                                setTimeout(() => successMsg.delete().catch(() => {}), 5000);
                                
                                prefixCollector.stop();
                            } catch (error) {
                                console.error('Prefix collection error:', error);
                            }
                        });
                        
                        prefixCollector.on('end', async (collected, reason) => {
                            prefixCollector = null;
                            if (reason === 'timeout' && collected.size === 0) {
                                const newEmbed = createSettingsEmbed(settings, lang, message.guild, client);
                                const newMenuRow = new ActionRowBuilder().addComponents(createSettingsMenu(lang));
                                await reply.edit({ embeds: [newEmbed], components: [newMenuRow });
                            }
                        });
                    }
                }
                
                // Handle language selection
                if (i.customId === 'settings_language') {
                    const newLang = i.values[0];
                    updateSetting('language', newLang);
                    settings = getSettings();
                    
                    // Use the new language for success message
                    const newT = translations[newLang];
                    
                    const successEmbed = new EmbedBuilder()
                        .setColor('#2ecc71')
                        .setTitle(newT.updated)
                        .setDescription(newT.updatedDesc(newT.settingOptions.language, newLang === 'fr' ? newT.french : newT.english))
                        .setFooter({ text: newT.footer });
                    
                    await i.reply({ embeds: [successEmbed], ephemeral: true });
                    
                    const newEmbed = createSettingsEmbed(settings, newLang, message.guild, client);
                    const newMenuRow = new ActionRowBuilder().addComponents(createSettingsMenu(newLang));
                    
                    await i.message.edit({ embeds: [newEmbed], components: [newMenuRow] });
                }
                
                // Handle channel selection
                if (i.customId === 'settings_channel') {
                    const channelId = i.values[0];
                    if (channelId === 'none') {
                        return i.reply({ content: '❌ ' + t.noChannels, ephemeral: true });
                    }
                    
                    const channel = message.guild.channels.cache.get(channelId);
                    
                    updateSetting(selectedSetting, channelId);
                    settings = getSettings();
                    
                    const settingNames = {
                        welcome: t.settingOptions.welcome,
                        log: t.settingOptions.log,
                        daily: t.settingOptions.daily
                    };
                    
                    const successEmbed = new EmbedBuilder()
                        .setColor('#2ecc71')
                        .setTitle(t.updated)
                        .setDescription(t.updatedDesc(settingNames[selectedSetting], `#${channel?.name || channelId}`))
                        .setFooter({ text: t.footer });
                    
                    await i.reply({ embeds: [successEmbed], ephemeral: true });
                    
                    const newEmbed = createSettingsEmbed(settings, lang, message.guild, client);
                    const newMenuRow = new ActionRowBuilder().addComponents(createSettingsMenu(lang));
                    
                    await i.message.edit({ embeds: [newEmbed], components: [newMenuRow] });
                }
                
                // Handle back button
                if (i.customId === 'settings_back') {
                    // Stop any running prefix collector
                    if (prefixCollector) {
                        prefixCollector.stop();
                        prefixCollector = null;
                    }
                    
                    const newEmbed = createSettingsEmbed(settings, lang, message.guild, client);
                    const newMenuRow = new ActionRowBuilder().addComponents(createSettingsMenu(lang));
                    await i.update({ embeds: [newEmbed], components: [newMenuRow] });
                }
                
                // Handle cancel button
                if (i.customId === 'settings_cancel') {
                    // Stop any running prefix collector
                    if (prefixCollector) {
                        prefixCollector.stop();
                        prefixCollector = null;
                    }
                    
                    const newEmbed = createSettingsEmbed(settings, lang, message.guild, client);
                    const newMenuRow = new ActionRowBuilder().addComponents(createSettingsMenu(lang));
                    await i.update({ embeds: [newEmbed], components: [newMenuRow] });
                }
                
                // Handle reset button
                if (i.customId === 'settings_reset') {
                    updateSetting(selectedSetting, null);
                    settings = getSettings();
                    
                    const settingNames = {
                        welcome: t.settingOptions.welcome,
                        log: t.settingOptions.log,
                        daily: t.settingOptions.daily
                    };
                    
                    const successEmbed = new EmbedBuilder()
                        .setColor('#2ecc71')
                        .setTitle(t.updated)
                        .setDescription(t.resetSuccess(settingNames[selectedSetting]))
                        .setFooter({ text: t.footer });
                    
                    await i.reply({ embeds: [successEmbed], ephemeral: true });
                    
                    const newEmbed = createSettingsEmbed(settings, lang, message.guild, client);
                    const newMenuRow = new ActionRowBuilder().addComponents(createSettingsMenu(lang));
                    
                    await i.message.edit({ embeds: [newEmbed], components: [newMenuRow] });
                }
            } catch (error) {
                console.error('Collector error:', error);
                try {
                    if (!i.replied && !i.deferred) {
                        await i.reply({ content: t.error, ephemeral: true });
                    }
                } catch (e) {
                    console.error('Failed to send error message:', e);
                }
            }
        });
        
        collector.on('end', async () => {
            // Stop prefix collector if running
            if (prefixCollector) {
                prefixCollector.stop();
                prefixCollector = null;
            }
            
            try {
                const disabledMenu = new ActionRowBuilder().addComponents(createSettingsMenu(lang).setDisabled(true));
                await reply.edit({ components: [disabledMenu] }).catch(() => {});
            } catch (error) {
                console.error('Collector end error:', error);
            }
        });
    }
};