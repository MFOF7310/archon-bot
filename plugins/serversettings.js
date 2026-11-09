const EMOJIS = require('../config/emojis');
const { resolveEmoji } = require('../lib/emoji-resolver');
const mentions = require('../lib/mentions');
const { t } = require('../lib/i18n');
const { pickLang } = require('../lib/pick-lang');
const v2 = require('../lib/games/v2');
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } = require('discord.js');
const { 
    EmbedBuilder, 
    PermissionFlagsBits, 
    SlashCommandBuilder, 
    ChannelType,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

module.exports = {
    name: 'serversettings',
    category: 'ADMIN',
    aliases: ['ss', 'serverconfig', 'guildsettings', 'gs'],
    description: '🛠️ Intelligent per-server configuration system with real-time validation',
    usage: '.serversettings [view/set/reset/export] [setting] [value]',
    permissions: ['Administrator'],

// ================= SLASH COMMAND DATA =================
data: new SlashCommandBuilder()
.setName('serversettings')
.setDescription('Configure the bot for your server')
.setDefaultMemberPermissions(Number(PermissionFlagsBits.Administrator))

.addSubcommand(sub => sub
    .setName('view')
    .setDescription('📊 View current server configuration')
    .setDescriptionLocalizations({ fr: '📊 Voir la configuration actuelle du serveur' })
    .addStringOption(opt => opt
        .setName('category')
        .setDescription('Filter by category')
        .setDescriptionLocalizations({ fr: 'Filtrer par catégorie' })
        .addChoices(
            { name: '🏠 General', value: 'general' },
            { name: '👋 Welcome', value: 'welcome' },
            { name: '📈 Leveling', value: 'leveling' },
            { name: '💰 Economy', value: 'economy' },
            { name: '🛡️ Moderation', value: 'moderation' },
            { name: '🤖 AI & Features', value: 'features' },
            { name: '🏅 Gaming & Reward Roles', value: 'specialRoles' },
            { name: '📋 All Settings', value: 'all' }
        )
    )
)
.addSubcommand(sub => sub
    .setName('set')
    .setDescription(`${resolveEmoji('bluetools', null) || '⚙️'} Change a server setting`)
    .setDescriptionLocalizations({ fr: '⚙️ Modifier un paramètre du serveur' })
    .addStringOption(opt => opt
        .setName('setting')
        .setDescription('Setting to change')
        .setDescriptionLocalizations({ fr: 'Paramètre à modifier' })
        .setRequired(true)
        .addChoices(
            { name: '🔤 Prefix', value: 'prefix' },
            { name: '💬 Welcome Message', value: 'message' },
            { name: '📈 XP Multiplier (0.5-5.0)', value: 'xpboost' },
            { name: '💰 Market Enabled', value: 'marketenabled' },
            { name: '📊 Market Channel', value: 'market' },
            { name: '💤 AFK System', value: 'afk' },
            { name: '🤖 Lydia AI', value: 'ai' },
        )
    )
    .addStringOption(opt => opt
        .setName('value')
        .setDescription('New value (channel mention, role mention, text, number, true/false)')
        .setDescriptionLocalizations({ fr: 'Nouvelle valeur (mention de salon, mention de rôle, texte, nombre, true/false)' })
        .setRequired(true)
    )
)
.addSubcommand(sub => sub
    .setName('reset')
    .setDescription('🔄 Reset all server settings to default')
    .setDescriptionLocalizations({ fr: '🔄 Réinitialiser tous les paramètres du serveur' })
    .addStringOption(opt => opt
        .setName('confirm')
        .setDescription('Type "CONFIRM" to proceed')
        .setDescriptionLocalizations({ fr: 'Tapez "CONFIRMER" pour continuer' })
        .setRequired(true)
    )
)
.addSubcommand(sub => sub
    .setName('export')
    .setDescription('📤 Export server configuration as JSON')
    .setDescriptionLocalizations({ fr: '📤 Exporter la configuration du serveur en JSON' })
),

// ================= SLASH COMMAND EXECUTION =================
async execute(interaction, client) {
    const lang = require('../lib/i18n').slashLang(interaction, ['en', 'fr']);
    const isOwner = interaction.user.id === interaction.guild.ownerId;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    
    if (!isOwner && !isAdmin) {
        const owner = await interaction.guild.fetchOwner().catch(() => null);
        const ownerName = owner ? `**${owner.user.username}**` : 'the server owner';

        const msg = lang === 'fr'
            ? `🔒 **ACCÈS RESTREINT**\n\nCette commande est réservée aux **administrateurs** du serveur.\n\n👑 **Propriétaire :** ${ownerName}`
            : `🔒 **RESTRICTED ACCESS**\n\nThis command is reserved for server **administrators**.\n\n👑 **Server Owner:** ${ownerName}`;
        
        return interaction.reply({ content: msg, flags: 1 << 6 });
    }
    
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const settings = client.getServerSettings(guildId);

    switch (subcommand) {
        case 'view': return this.viewSettings(interaction, client, settings, lang);
        case 'set': return this.setSetting(interaction, client, settings, lang);
        case 'reset': return this.resetSettings(interaction, client, settings, lang);
        case 'export': return this.exportSettings(interaction, client, settings, lang);
    }
},

    // ================= PREFIX COMMAND EXECUTION =================
    async run(client, message, args, db, serverSettings, _used, lang) {
        if (!lang) lang = require('../lib/pick-lang').pickLang(client, message?.guild?.id, message, message?.author?.id);
        const isOwner = message.author.id === message.guild.ownerId;
        const isAdmin = message.member.permissions.has('Administrator');

        if (!isOwner && !isAdmin) {
            let ownerName = 'the server owner';
            try {
                const owner = await message.guild.fetchOwner().catch(() => null);
                if (owner) ownerName = `**${owner.user.username}**`;
            } catch (e) {}

            const msg = client.detectLanguage(message.content) === 'fr'
                ? `🔒 **ACCÈS RESTREINT**\n\n` +
                  `Cette commande est réservée aux **administrateurs** du serveur.\n\n` +
                  `👑 **Propriétaire du serveur :** ${ownerName}\n` +
                  `🛡️ **Permission requise :** \`Administrateur\`\n\n` +
                  `💡 Si vous pensez que cela devrait être modifié, contactez ${ownerName}.`
                : `🔒 **RESTRICTED ACCESS**\n\n` +
                  `This command is reserved for server **administrators**.\n\n` +
                  `👑 **Server Owner:** ${ownerName}\n` +
                  `🛡️ **Required Permission:** \`Administrator\`\n\n` +
                  `💡 If you believe this should be changed, please contact ${ownerName}.`;

            const embed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setAuthor({ name: '🛡️ Access Restricted', iconURL: message.guild.iconURL() || client.user.displayAvatarURL() })
                .setDescription(msg)
                .setFooter({ text: `${message.guild.name} • Server Configuration Protected` })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        const action = args[0]?.toLowerCase();
        const cmdName = args[0]?.toLowerCase() || 'view';

        const guildId = message.guild.id;
        const settings = client.getServerSettings(guildId);

        if (!action || action === 'view') {
            return module.exports.viewSettingsPrefix(message, client, settings, lang);
        }

        if (action === 'set') {
            const setting = args[1]?.toLowerCase();
            const value = args.slice(2).join(' ');
            if (!setting || !value) {
                const msg = lang === 'fr'
                    ? '⚠️ **Usage:** `.serversettings set <paramètre> <valeur>`\nTapez `.serversettings view` pour voir tous les paramètres.'
                    : '⚠️ **Usage:** `.serversettings set <setting> <value>`\nType `.serversettings view` to see all settings.';
                return message.reply(msg);
            }
            return module.exports.setSettingPrefix(message, client, settings, setting, value, lang);
        }

        if (action === 'reset') {
            const confirm = args[1];
            if (confirm?.toUpperCase() !== 'CONFIRM') {
                const msg = lang === 'fr'
                    ? '⚠️ **Confirmation requise:** `.serversettings reset CONFIRM`'
                    : '⚠️ **Confirmation required:** `.serversettings reset CONFIRM`';
                return message.reply(msg);
            }
            return module.exports.resetSettingsPrefix(message, client, lang);
        }

        if (action === 'export') {
            return module.exports.exportSettingsPrefix(message, client, settings, lang);
        }

        const msg = lang === 'fr'
            ? '❓ Action inconnue. Utilisez: `view`, `set`, `reset`, `export`'
            : '❓ Unknown action. Use: `view`, `set`, `reset`, `export`';
        return message.reply(msg);
    },

    // ================= VIEW SETTINGS (SLASH) =================
    async viewSettings(interaction, client, settings, lang) {
        let currentCategory = interaction.options.getString('category') || 'configured';
        if (currentCategory === 'all') currentCategory = 'configured';

        const buildMsg = (cat) => {
            const viewPayload = this.buildSettingsEmbed(settings, interaction.guild, client, lang, cat);
            // Boutons : recherche dynamique avec chaîne de fallback
            const findEmoji = (names) => {
                for (const n of names) {
                    const found = client.emojis.cache.find(e => e.name === n);
                    if (found) return found.toString();
                }
                return null;
            };

            const checkEmoji = EMOJIS.screaminggreen || '✅';
            const crossEmoji = EMOJIS.red_color || '⚠️';

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('ss_nav_configured')
                    .setLabel('Configured')
                    .setEmoji(checkEmoji)
                    .setStyle(cat === 'configured' ? ButtonStyle.Primary : ButtonStyle.Secondary)
                    .setDisabled(cat === 'configured'),
                new ButtonBuilder()
                    .setCustomId('ss_nav_unconfigured')
                    .setLabel('Not Set')
                    .setEmoji(crossEmoji)
                    .setStyle(cat === 'unconfigured' ? ButtonStyle.Danger : ButtonStyle.Secondary)
                    .setDisabled(cat === 'unconfigured')
            );
            return { ...viewPayload, components: [...viewPayload.components, row], flags: MessageFlags.IsComponentsV2 | 64 };
        };

        const msg = await interaction.reply({ ...buildMsg(currentCategory), withResponse: true });
        const fetchedMsg = msg.resource.message;
        const specific = ['general', 'welcome', 'leveling', 'economy', 'moderation', 'features', 'specialRoles'];
        if (specific.includes(interaction.options.getString('category'))) return;

        const collector = fetchedMsg.createMessageComponentCollector({ time: 120000 });
        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) return i.reply({ content: "This isn't your menu.", flags: 64 });
            const newCat = i.customId.replace('ss_nav_', '');
            await i.update(buildMsg(newCat));
        });
    },

    // ================= VIEW SETTINGS (PREFIX) =================
    async viewSettingsPrefix(message, client, settings, lang) {
        const cat = (message.content.includes(' configured') || message.content.includes(' unconfigured')) 
            ? message.content.split(' ').pop() 
            : 'all';
        const viewPayload = this.buildSettingsEmbed(settings, message.guild, client, lang, cat);
        await message.reply(viewPayload);
    },

    // ================= BUILD SETTINGS EMBED =================
    buildSettingsEmbed(settings, guild, client, lang, category = 'all') {
        const tr = (k) => t('serversettings.' + k, lang);
        
        const isArchitectServer = guild.id === process.env.GUILD_ID;
        const chM = (id, env) => id ? `<#${id}>` : (isArchitectServer && process.env[env] ? `<#${process.env[env]}> 🔹 .env` : `\`${tr('not_set')}\``);
        const roleM = (id, env) => id ? `<@&${id}>` : (isArchitectServer && process.env[env] ? `<@&${process.env[env]}> 🔹 .env` : `\`${tr('not_set')}\``);
        const bS = (val) => val ? `${EMOJIS.screaminggreen || '✅'} ${tr('enabled')}` : `${EMOJIS.red_color || em('ic_off', '❌')} ${tr('disabled')}`;
        
        const em = (k, fb) => EMOJIS[k] || fb;

        // Définition de toutes les sections avec leur statut "isSet"
        const sections = [
            {
                emoji: '👑',
                title: tr('cat_general'),
                lines: [
                    { text: `**${tr('prefix')}** — \`${settings.prefix || '.'}\``, isSet: true }
                ]
            },
            {
                emoji: '👋',
                title: tr('cat_welcome'),
                lines: [
                    { text: `**${tr('welcome_channel')}** — ${chM(settings.welcomeChannel, 'WELCOME_CHANNEL_ID')}`, isSet: !!settings.welcomeChannel },
                    { text: `**${tr('welcome_msg')}** — ${settings.welcomeMessage ? tr('custom') : tr('default')}`, isSet: !!settings.welcomeMessage },
                    { text: `**${tr('goodbye_channel')}** — ${chM(settings.goodbyeChannel, 'GOODBYE_CHANNEL_ID')}`, isSet: !!settings.goodbyeChannel },
                    { text: `**${tr('goodbye_msg')}** — ${settings.goodbyeMessage ? tr('custom') : tr('default')}`, isSet: !!settings.goodbyeMessage }
                ]
            },
            {
                emoji: '💰',
                title: tr('cat_leveling'),
                lines: [
                    { text: `**${tr('level_channel')}** — ${chM(settings.levelChannel, 'LEVEL_CHANNEL_ID')}`, isSet: !!settings.levelChannel },
                    { text: `**${tr('xp_mult')}** — \`${settings.xpMultiplier || 1.0}x\``, isSet: settings.xpMultiplier != null },
                    { text: `**${tr('market')}** — ${bS(settings.marketEnabled)}`, isSet: settings.marketEnabled == 1 },
                    { text: `**${tr('market_channel')}** — ${chM(settings.marketChannel, 'MARKET_CHANNEL_ID')}`, isSet: !!settings.marketChannel },
                    { text: `**${tr('shop_channel')}** — ${chM(settings.shopChannel, 'SHOP_CHANNEL_ID')}`, isSet: !!settings.shopChannel }
                ]
            },
            {
                emoji: '🛡️',
                title: `${tr('cat_features')} & ${tr('cat_moderation')}`,
                lines: [
                    { text: `**${tr('afk')}** — ${bS(settings.afkEnabled)}`, isSet: settings.afkEnabled == 1 },
                    { text: `**${tr('ai')}** — ${bS(settings.aiEnabled)}`, isSet: settings.aiEnabled == 1 },
                    { text: `**${tr('log_channel')}** — ${chM(settings.logChannel, 'LOG_CHANNEL_ID')}`, isSet: !!settings.logChannel },
                    { text: `**${tr('modlog_channel')}** — ${chM(settings.modLogChannel, 'MOD_LOG_CHANNEL_ID')}`, isSet: !!settings.modLogChannel },
                    { text: `**${tr('mute_role')}** — ${roleM(settings.muteRoleId, 'MUTE_ROLE_ID')}`, isSet: !!settings.muteRoleId }
                ]
            },
            {
                emoji: '🎭',
                title: tr('cat_roles'),
                lines: [
                    { text: `**${tr('member_role')}** — ${roleM(settings.memberRole, 'MEMBER_ROLE')}`, isSet: !!settings.memberRole },
                    { text: `**${tr('auto_role')}** — ${roleM(settings.autoRoleId, 'AUTO_ROLE_ID')}`, isSet: !!settings.autoRoleId }
                ]
            }
        ];

        // Filtrage des lignes selon la catégorie
        const filteredSections = sections.map(sec => {
            const validLines = sec.lines.filter(l => {
                if (category === 'configured') return l.isSet;
                if (category === 'unconfigured') return !l.isSet;
                return true; // all
            });
            return { ...sec, lines: validLines };
        }).filter(sec => sec.lines.length > 0);

        // Construction du conteneur V2
        const c = new ContainerBuilder().setAccentColor(0x2ecc71);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${em('discordserver', '⚙️')} ${tr('title')}\n${guild.name}`));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${tr('desc')}`));

        if (filteredSections.length === 0) {
            c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`*${tr('no_settings')}*`));
        } else {
            filteredSections.forEach((sec, index) => {
                c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${sec.emoji} ${sec.title}**\n${sec.lines.map(l => l.text).join('\n')}`));
            });
        }

        const setCmd = mentions(client, 'serversettings', 'set');
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# BAMAKO_223 🇲🇱 • ${tr('footer')} : ${setCmd}`));

        return { components: [c], flags: MessageFlags.IsComponentsV2 };
    },

    async setSetting(interaction, client, settings, lang) {
        const setting = interaction.options.getString('setting');
        const rawValue = interaction.options.getString('value');
        
        const result = await this.processSetSetting(
            interaction.guild, client, setting, rawValue, lang, interaction.member
        );

        if (result.success) {
            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle(result.title)
                .setDescription(result.description)
                .setFooter({ text: `🦅 ARCHON CG-223 • ${interaction.guild.name}` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], flags: 1 << 6 });
        } else {
            await interaction.reply({ content: result.error, flags: 1 << 6 });
        }
    },

    // ================= SET SETTING (PREFIX) =================
    async setSettingPrefix(message, client, settings, setting, rawValue, lang) {
        const result = await this.processSetSetting(
            message.guild, client, setting, rawValue, lang, message.member
        );

        if (result.success) {
            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle(result.title)
                .setDescription(result.description)
                .setFooter({ text: `🦅 ARCHON CG-223 • ${message.guild.name}` })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        } else {
            await message.reply(result.error);
        }
    },

    // ================= PROCESS SET SETTING (CORE LOGIC) =================
    async processSetSetting(guild, client, setting, rawValue, lang, actor = null) {
        const t = {
            fr: {
                success: '✅ Paramètre mis à jour',
                updated: (s, v) => `**${s}** a été défini sur :\n\`${v}\``,
                invalidChannel: em('ic_off', em('ic_off', '❌')) + ' Salon introuvable. Mentionnez un salon valide.',
                invalidRole: em('ic_off', em('ic_off', '❌')) + ' Rôle introuvable. Mentionnez un rôle valide.',
                invalidBool: em('ic_off', em('ic_off', '❌')) + ' Valeur invalide. Utilisez: `true`, `false`, `on`, `off`, `1`, `0`, `enable`, `disable`',
                invalidNumber: em('ic_off', em('ic_off', '❌')) + ' Nombre invalide. Utilisez une valeur entre 0.5 et 5.0',
                invalidPrefix: em('ic_off', em('ic_off', '❌')) + ' Le préfixe doit faire entre 1 et 5 caractères.',
                settingNotFound: em('ic_off', em('ic_off', '❌')) + ' Paramètre inconnu.',
                viewAll: `💡 Tapez ${mentions(client, 'serversettings', 'view')} pour voir tous les paramètres.\n💬 Utilisez \`default\` comme valeur pour réinitialiser les messages au défaut système.`
            },
            en: {
                success: '✅ Setting Updated',
                updated: (s, v) => `**${s}** has been set to:\n\`${v}\``,
                invalidChannel: em('ic_off', em('ic_off', '❌')) + ' Channel not found. Please mention a valid channel.',
                invalidRole: em('ic_off', em('ic_off', '❌')) + ' Role not found. Please mention a valid role.',
                invalidBool: em('ic_off', em('ic_off', '❌')) + ' Invalid value. Use: `true`, `false`, `on`, `off`, `1`, `0`, `enable`, `disable`',
                invalidNumber: em('ic_off', em('ic_off', '❌')) + ' Invalid number. Use a value between 0.5 and 5.0',
                invalidPrefix: em('ic_off', em('ic_off', '❌')) + ' Prefix must be 1-5 characters.',
                settingNotFound: em('ic_off', em('ic_off', '❌')) + ' Unknown setting.',
                viewAll: `💡 Type ${mentions(client, 'serversettings', 'view')} to see all settings.\n💬 Use \`default\` as value to reset messages to system default.`
            }
        }[lang];

        // ================= SETTING DEFINITIONS =================
        const settingDefs = {
            // Channel settings - extract channel ID from mention
            welcome: { type: 'channel', col: 'welcome', name: lang === 'fr' ? 'Salon de Bienvenue' : 'Welcome Channel' },
            log: { type: 'channel', col: 'log', name: lang === 'fr' ? 'Salon de Logs' : 'Log Channel' },
            daily: { type: 'channel', col: 'daily', name: lang === 'fr' ? 'Salon Quotidien' : 'Daily Channel' },
            shop: { type: 'channel', col: 'shop', name: lang === 'fr' ? 'Salon Boutique' : 'Shop Channel' },
            rules: { type: 'channel', col: 'rules', name: lang === 'fr' ? 'Salon Règles' : 'Rules Channel' },
            general: { type: 'channel', col: 'general', name: lang === 'fr' ? 'Salon Général' : 'General Channel' },
            goodbye: { type: 'channel', col: 'goodbye', name: lang === 'fr' ? 'Salon d\'Au Revoir' : 'Goodbye Channel' },
            levelchan: { type: 'channel', col: 'levelchan', name: lang === 'fr' ? 'Salon des Niveaux' : 'Level-Up Channel' },
            modlog: { type: 'channel', col: 'modlog', name: lang === 'fr' ? 'Salon Logs Modération' : 'Mod Log Channel' },
            market: { type: 'channel', col: 'market', name: lang === 'fr' ? 'Salon du Marché' : 'Market Channel' },
            // Role settings
            member: { type: 'role', col: 'member', name: lang === 'fr' ? 'Rôle Membre' : 'Member Role' },
            muterole: { type: 'role', col: 'muterole', name: lang === 'fr' ? 'Rôle Muet' : 'Mute Role' },
            autorole: { type: 'role', col: 'autorole', name: lang === 'fr' ? 'Rôle Automatique' : 'Auto Role' },
            // Gaming & Economy Roles
            investorrole: { type: 'role', col: 'investorrole', name: lang === 'fr' ? 'Rôle Investisseur' : 'Investor Role' },
            gamerrole: { type: 'role', col: 'gamerrole', name: lang === 'fr' ? 'Rôle Joueur' : 'Gamer Role' },
            quizmasterrole: { type: 'role', col: 'quizmasterrole', name: lang === 'fr' ? 'Rôle Quiz Master' : 'Quiz Master Role' },
            duelistrole: { type: 'role', col: 'duelistrole', name: lang === 'fr' ? 'Rôle Duelliste' : 'Duelist Role' },
            // Daily Streak Roles
            dailyinitiaterole: { type: 'role', col: 'dailyinitiaterole', name: lang === 'fr' ? 'Rôle Initié Quotidien' : 'Daily Initiate Role' },
            dailywarriorrole: { type: 'role', col: 'dailywarriorrole', name: lang === 'fr' ? 'Rôle Guerrier Quotidien' : 'Daily Warrior Role' },
            dailychampionrole: { type: 'role', col: 'dailychampionrole', name: lang === 'fr' ? 'Rôle Champion Quotidien' : 'Daily Champion Role' },
            dailylegendrole: { type: 'role', col: 'dailylegendrole', name: lang === 'fr' ? 'Rôle Légende Quotidien' : 'Daily Legend Role' },
            // Boolean settings
            afk: { type: 'bool', col: 'afk', name: lang === 'fr' ? 'Système AFK' : 'AFK System' },
            marketenabled: { type: 'bool', col: 'marketenabled', name: lang === 'fr' ? 'Marché Activé' : 'Market Enabled' },
            ai: { type: 'bool', col: 'ai', name: lang === 'fr' ? 'Lydia AI' : 'Lydia AI' },
            // Number settings
            xpboost: { type: 'number', col: 'xpboost', name: lang === 'fr' ? 'Multiplicateur XP' : 'XP Multiplier', min: 0.5, max: 5.0 },
            // Text settings
            prefix: { type: 'text', col: 'prefix', name: 'Prefix', maxLen: 5 },
            message: { type: 'text', col: 'message', name: lang === 'fr' ? 'Message de Bienvenue' : 'Welcome Message', maxLen: 2000 },
            goodbyemsg: { type: 'text', col: 'goodbyemsg', name: lang === 'fr' ? 'Message d\'Au Revoir' : 'Goodbye Message', maxLen: 2000 }
        };

        const def = settingDefs[setting];
        if (!def) {
            return { success: false, error: `${t.settingNotFound}\n${t.viewAll}` };
        }

        let processedValue = rawValue;

        // ================= TYPE VALIDATION & PROCESSING =================
        switch (def.type) {
            case 'channel': {
                const channelId = rawValue.replace(/[<#>]/g, '').trim();
                const channel = guild.channels.cache.get(channelId);
                if (!channel) {
                    try {
                        const fetched = await guild.channels.fetch(channelId).catch(() => null);
                        if (!fetched) return { success: false, error: t.invalidChannel };
                        processedValue = channelId;
                    } catch {
                        return { success: false, error: t.invalidChannel };
                    }
                } else {
                    processedValue = channelId;
                }
                break;
            }
            case 'role': {
                const roleId = rawValue.replace(/[<@&>]/g, '').trim();
                const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
                if (!role) return { success: false, error: t.invalidRole };
                // Same rules as /roles and the dashboard: ARCHON only hands out safe roles, and the mute role stays separate
                const RR = require('../lib/role-rules');
                const isMute = def.col === 'muterole';
                let err = RR.checkRole(guild, role, isMute ? 'mute' : 'grant', actor);
                if (!err) {
                    const saved = RR.readSlots(client.db, guild.id);
                    const clash = isMute ? RR.SLOTS.some(sl => sl.key !== 'mute' && saved[sl.key] === role.id) : saved.mute === role.id;
                    if (clash) err = { code: 'mute_conflict' };
                }
                if (err) return { success: false, error: require('../lib/i18n').t('roles.rejected', lang, { label: def.name, reason: RR.reasonText(err, lang) }) };
                processedValue = role.id;
                break;
            }
            case 'bool': {
    // 🔥 "default" restores system default (all features enabled)
    if (rawValue.toLowerCase() === 'default') {
        processedValue = '1';
    } else {
        const lower = rawValue.toLowerCase();
        if (['true', 'on', '1', 'enable', 'yes'].includes(lower)) processedValue = '1';
        else if (['false', 'off', '0', 'disable', 'no'].includes(lower)) processedValue = '0';
        else return { success: false, error: t.invalidBool };
    }
    break;
}
            case 'number': {
    // Skip validation if no value provided (plugin scan)
    if (!rawValue) break;
    
    // 🔥 "default" restores XP multiplier to 1.0x
    if (rawValue.toLowerCase() === 'default') {
        processedValue = '1.0';
    } else {
        const num = parseFloat(rawValue);
        if (isNaN(num) || num < (def.min || 0) || num > (def.max || Infinity)) {
            return { success: false, error: t.invalidNumber };
        }
        processedValue = String(num);
    }
    break;
}
            case 'text': {
    // 🔥 "default" resets welcome/goodbye message to system default
    if ((def.col === 'message' || def.col === 'goodbyemsg') && rawValue.toLowerCase() === 'default') {
        processedValue = null;
    }
    if (def.col === 'prefix') {
        if (rawValue.length < 1 || rawValue.length > def.maxLen) {
            return { success: false, error: t.invalidPrefix };
        }
    }
    if (processedValue !== null && rawValue.length > (def.maxLen || 2000)) {
        return { success: false, error: `${em('ic_off', '❌')} Text too long (max ${def.maxLen} characters)` };
    }
    break;
}
        }

        // ================= SAVE TO DATABASE =================
        const success = client.updateServerSetting(guild.id, def.col, processedValue);
        
        if (success) {
            // Clear cache to force refresh
            client.settings.delete(guild.id);
            
            const displayValue = processedValue === null 
                ? (lang === 'fr' ? '📋 Défaut Système' : '📋 System Default')
                : (processedValue === '1' && def.type === 'bool') 
                    ? (lang === 'fr' ? `${EMOJIS.screaminggreen || '✅'} Activé` : `${EMOJIS.screaminggreen || '✅'} Enabled`)
                    : (processedValue === '0' && def.type === 'bool')
                        ? (lang === 'fr' ? `${EMOJIS.red_color || em('ic_off', '❌')} Désactivé` : `${EMOJIS.red_color || em('ic_off', '❌')} Disabled`)
                        : processedValue;

            return {
                success: true,
                title: t.success,
                description: t.updated(def.name, displayValue)
            };
        }

        return { success: false, error: em('ic_off', em('ic_off', '❌')) + ' Database error. Please try again.' };
    },

    // ================= RESET SETTINGS (SLASH) =================
    async resetSettings(interaction, client, settings, lang) {
        const confirm = interaction.options.getString('confirm');
        const confirmWord = lang === 'fr' ? 'CONFIRMER' : 'CONFIRM';
        
        if (confirm.toUpperCase() !== confirmWord) {
            return interaction.reply({ content: (t.resetConfirmError || em('ic_off', em('ic_off', '❌')) + ' Type `{word}` to confirm reset.').replace('{word}', confirmWord), flags: 1 << 6 });
        }

        this.performReset(interaction.guild.id, client);

        const resetEmbed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setAuthor({ name: '🔄 System Reset', iconURL: client.user.displayAvatarURL() })
            .setDescription(t.resetSuccess || 'Settings reset.')
            .setFooter({ text: 'ARCHON CG-223' });
        await interaction.reply({ embeds: [resetEmbed], flags: 64 });
    },

    // ================= RESET SETTINGS (PREFIX) =================
    async resetSettingsPrefix(message, client, lang) {
        this.performReset(message.guild.id, client);
        
        const msg = lang === 'fr'
            ? '🔄 **Tous les paramètres ont été réinitialisés** aux valeurs par défaut.'
            : '🔄 **All settings have been reset** to default values.';
        
        await message.reply(msg);
    },

    // ================= PERFORM RESET =================
    performReset(guildId, client) {
        // Delete the server settings row entirely
        try {
            client.db.prepare('DELETE FROM server_settings WHERE guild_id = ?').run(guildId);
        } catch (err) {}
        
        // Clear cache
        client.settings.delete(guildId);
        
        // Clear command settings
        try {
            client.db.prepare('DELETE FROM server_command_settings WHERE guild_id = ?').run(guildId);
        } catch (err) {}
    },

    // ================= EXPORT SETTINGS (SLASH) =================
    async exportSettings(interaction, client, settings, lang) {
        const json = JSON.stringify(settings, null, 2);
        const buffer = Buffer.from(json, 'utf-8');
        
        const msg = lang === 'fr'
            ? '📤 Voici votre configuration exportée :'
            : '📤 Here is your exported configuration:';
        
        await interaction.reply({
            content: msg,
            files: [{
                attachment: buffer,
                name: `server-config-${interaction.guild.id}.json`
            }],
            flags: 1 << 6
        });
    },

    // ================= EXPORT SETTINGS (PREFIX) =================
    async exportSettingsPrefix(message, client, settings, lang) {
        const json = JSON.stringify(settings, null, 2);
        const buffer = Buffer.from(json, 'utf-8');
        
        const msg = lang === 'fr'
            ? '📤 Voici votre configuration exportée :'
            : '📤 Here is your exported configuration:';
        
        await message.reply({
            content: msg,
            files: [{
                attachment: buffer,
                name: `server-config-${message.guild.id}.json`
            }]
        });
    }
};
