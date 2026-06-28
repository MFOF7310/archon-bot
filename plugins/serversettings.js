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
.setDescription('🛠️ Configure the bot for your server')
.setDefaultMemberPermissions(Number(PermissionFlagsBits.Administrator))
.setDescriptionLocalizations({
    fr: '🛠️ Configurer le bot pour votre serveur'
})
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
    .setDescription('⚙️ Change a server setting')
    .setDescriptionLocalizations({ fr: '⚙️ Modifier un paramètre du serveur' })
    .addStringOption(opt => opt
        .setName('setting')
        .setDescription('Setting to change')
        .setDescriptionLocalizations({ fr: 'Paramètre à modifier' })
        .setRequired(true)
        .addChoices(
            { name: '🔤 Prefix', value: 'prefix' },
            { name: '👋 Welcome Channel', value: 'welcome' },
            { name: '💬 Welcome Message', value: 'message' },
            { name: '👋 Goodbye Channel', value: 'goodbye' },
            { name: '📈 XP Multiplier (0.5-5.0)', value: 'xpboost' },
            { name: '💰 Market Enabled', value: 'marketenabled' },
            { name: '💤 AFK System', value: 'afk' },
            { name: '🤖 Lydia AI', value: 'ai' },
            { name: '📋 Log Channel', value: 'log' },
            { name: '🔨 Mute Role', value: 'muterole' },
            { name: '📋 Mod Log Channel', value: 'modlog' },
            { name: '👤 Member Role', value: 'member' },
            { name: '🎭 Auto Role', value: 'autorole' },
            { name: '📜 Rules Channel', value: 'rules' },
            { name: '🎁 Daily Channel', value: 'daily' },
            { name: '🛒 Shop Channel', value: 'shop' },
            { name: '📊 Market Channel', value: 'market' },
            { name: '📈 Investor Role', value: 'investorrole' },
            { name: '🏠 General Channel', value: 'general' },
            { name: '🎮 Gamer Role', value: 'gamerrole' },
            { name: '🧠 Quiz Master Role', value: 'quizmasterrole' },
            { name: '⚔️ Duelist Role', value: 'duelistrole' },
            { name: '🌱 Daily Initiate Role (3d)', value: 'dailyinitiaterole' },
            { name: '🔥 Daily Warrior Role (7d)', value: 'dailywarriorrole' },
            { name: '⚔️ Daily Champion Role (30d)', value: 'dailychampionrole' },
            { name: '💎 Daily Legend Role (100d)', value: 'dailylegendrole' },
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
    const isOwner = interaction.user.id === interaction.guild.ownerId;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    
    if (!isOwner && !isAdmin) {
        const owner = await interaction.guild.fetchOwner().catch(() => null);
        const ownerName = owner ? `**${owner.user.username}**` : 'the server owner';
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        
        const msg = lang === 'fr'
            ? `🔒 **ACCÈS RESTREINT**\n\nCette commande est réservée aux **administrateurs** du serveur.\n\n👑 **Propriétaire :** ${ownerName}`
            : `🔒 **RESTRICTED ACCESS**\n\nThis command is reserved for server **administrators**.\n\n👑 **Server Owner:** ${ownerName}`;
        
        return interaction.reply({ content: msg, flags: 1 << 6 });
    }
    
    const subcommand = interaction.options.getSubcommand();
    const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
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
    async run(client, message, args, db, serverSettings) {
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
                .setAuthor({ name: '🛡️ ARCHON CG-223 • SECURITY LAYER', iconURL: message.guild.iconURL() || client.user.displayAvatarURL() })
                .setDescription(msg)
                .setFooter({ text: `${message.guild.name} • Server Configuration Protected` })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        const action = args[0]?.toLowerCase();
        const cmdName = args[0]?.toLowerCase() || 'view';
        const lang = client.detectLanguage(cmdName);
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
        const category = interaction.options.getString('category') || 'all';
        const embed = this.buildSettingsEmbed(settings, interaction.guild, client, lang, category);
        await interaction.reply({ embeds: [embed], flags: 1 << 6 }); // Ephemeral
    },

    // ================= VIEW SETTINGS (PREFIX) =================
    async viewSettingsPrefix(message, client, settings, lang) {
        const embed = this.buildSettingsEmbed(settings, message.guild, client, lang, 'all');
        await message.reply({ embeds: [embed] });
    },

    // ================= BUILD SETTINGS EMBED =================
    buildSettingsEmbed(settings, guild, client, lang, category) {
        const t = {
            fr: {
                title: '🦅 CONFIGURATION DU SERVEUR',
                general: '🏠 GÉNÉRAL',
                prefix: 'Préfixe',
                welcome: '👋 BIENVENUE',
                welcomeChannel: 'Salon de Bienvenue',
                welcomeMessage: 'Message de Bienvenue',
                goodbyeChannel: 'Salon d\'Au Revoir',
                goodbyeMessage: 'Message d\'Au Revoir',
                leveling: '📈 NIVEAUX',
                xpMultiplier: 'Multiplicateur XP',
                levelChannel: 'Salon des Niveaux',
                economy: '💰 ÉCONOMIE',
                marketEnabled: 'Marché Activé',
                features: '🤖 FONCTIONNALITÉS',
                afkEnabled: 'Système AFK',
                aiEnabled: 'Lydia AI',
                moderation: '🛡️ MODÉRATION',
                logChannel: 'Salon de Logs',
                muteRole: 'Rôle Muet',
                modLogChannel: 'Salon Logs Modération',
                roles: '👤 RÔLES',
                memberRole: 'Rôle Membre',
                autoRole: 'Rôle Automatique',
                channels: '📡 SALONS',
                rulesChannel: 'Salon Règles',
                generalChannel: 'Salon Général',
                dailyChannel: 'Salon Quotidien',
                shopChannel: 'Salon Boutique',
                enabled: '✅ Activé',
                disabled: '❌ Désactivé',
                notSet: '⚠️ Non défini',
                footer: '🦅 ARCHON CG-223 • Configuration par serveur',
                tip: '💡 Utilisez `/serversettings set` pour modifier'
            },
            en: {
                title: '🦅 SERVER CONFIGURATION',
                general: '🏠 GENERAL',
                prefix: 'Prefix',
                welcome: '👋 WELCOME',
                welcomeChannel: 'Welcome Channel',
                welcomeMessage: 'Welcome Message',
                goodbyeChannel: 'Goodbye Channel',
                goodbyeMessage: 'Goodbye Message',
                leveling: '📈 LEVELING',
                xpMultiplier: 'XP Multiplier',
                levelChannel: 'Level-Up Channel',
                economy: '💰 ECONOMY',
                marketEnabled: 'Market Enabled',
                features: '🤖 FEATURES',
                afkEnabled: 'AFK System',
                aiEnabled: 'Lydia AI',
                moderation: '🛡️ MODERATION',
                logChannel: 'Log Channel',
                muteRole: 'Mute Role',
                modLogChannel: 'Mod Log Channel',
                roles: '👤 ROLES',
                memberRole: 'Member Role',
                autoRole: 'Auto Role',
                channels: '📡 CHANNELS',
                rulesChannel: 'Rules Channel',
                generalChannel: 'General Channel',
                dailyChannel: 'Daily Channel',
                shopChannel: 'Shop Channel',
                enabled: '✅ Enabled',
                disabled: '❌ Disabled',
                notSet: '⚠️ Not set',
                footer: '🦅 ARCHON CG-223 • Per-Server Configuration',
                tip: '💡 Use `/serversettings set` to modify'
            }
        }[lang];

        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setAuthor({ 
                name: t.title, 
                iconURL: guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL() 
            })
            .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }));

        const isArchitectServer = guild.id === process.env.GUILD_ID;

        const channelMention = (id, envKey) => {
            if (id) return `<#${id}>`;
            if (isArchitectServer && envKey && process.env[envKey]) return `<#${process.env[envKey]}> \ud83d\udd39 .env`;
            return t.notSet;
        };

        const roleMention = (id, envKey) => {
            if (id) return `<@&${id}>`;
            if (isArchitectServer && envKey && process.env[envKey]) return `<@&${process.env[envKey]}> \ud83d\udd39 .env`;
            return t.notSet;
        };

        const boolStr = (val) => val ? t.enabled : t.disabled;

        const sections = {
            general: () => embed.addFields({
                name: t.general,
                value: `\`\`\`yaml\n${t.prefix}: ${settings.prefix || '.'}\n\`\`\``,
                inline: false
            }),
            welcome: () => embed.addFields({
                name: t.welcome,
                value: [
                    `**${t.welcomeChannel}:** ${channelMention(settings.welcomeChannel, 'WELCOME_CHANNEL_ID')}`,
                    `**${t.welcomeMessage}:** ${settings.welcomeMessage ? '\u2705 Custom' : '\ud83d\udccb System Default'}`,
                    `**${t.goodbyeChannel}:** ${channelMention(settings.goodbyeChannel, 'GOODBYE_CHANNEL_ID')}`,
                    `**${t.goodbyeMessage}:** ${settings.goodbyeMessage ? '\u2705 Custom' : '\ud83d\udccb System Default'}`,
                ].join('\n'),
                inline: false
            }),
            leveling: () => embed.addFields({
                name: t.leveling,
                value: [
                    `**${t.xpMultiplier}:** \`${settings.xpMultiplier || 1.0}x\``,
                    `**${t.levelChannel}:** ${channelMention(settings.levelChannel, 'LEVEL_CHANNEL_ID')}`
                ].join('\n'),
                inline: false
            }),
            economy: () => embed.addFields({
                name: t.economy,
                value: `**${t.marketEnabled}:** ${boolStr(settings.marketEnabled)}`,
                inline: false
            }),
            features: () => embed.addFields({
                name: t.features,
                value: [
                    `**${t.afkEnabled}:** ${boolStr(settings.afkEnabled)}`,
                    `**${t.aiEnabled}:** ${boolStr(settings.aiEnabled)}`
                ].join('\n'),
                inline: false
            }),
            moderation: () => embed.addFields({
                name: t.moderation,
                value: [
                    `**${t.logChannel}:** ${channelMention(settings.logChannel, 'LOG_CHANNEL_ID')}`,
                    `**${t.modLogChannel}:** ${channelMention(settings.modLogChannel, 'MOD_LOG_CHANNEL_ID')}`,
                    `**${t.muteRole}:** ${roleMention(settings.muteRoleId, 'MUTE_ROLE_ID')}`
                ].join('\n'),
                inline: false
            }),
            roles: () => embed.addFields({
                name: t.roles,
                value: [
                    `**${t.memberRole}:** ${roleMention(settings.memberRole, 'MEMBER_ROLE')}`,
                    `**${t.autoRole}:** ${roleMention(settings.autoRoleId, 'AUTO_ROLE_ID')}`
                ].join('\n'),
                inline: false
            }),
            channels: () => embed.addFields({
                name: t.channels,
                value: [
                    `**${t.rulesChannel}:** ${channelMention(settings.rulesChannel, 'RULES_CHANNEL_ID')}`,
                    `**${t.generalChannel}:** ${channelMention(settings.generalChannel, 'GENERAL_CHANNEL_ID')}`,
                    `**${t.dailyChannel}:** ${channelMention(settings.dailyChannel, 'DAILY_CHANNEL_ID')}`,
                    `**${t.shopChannel}:** ${channelMention(settings.shopChannel, 'SHOP_CHANNEL_ID')}`,
                    `**\ud83d\udcca Market Channel:** ${channelMention(settings.marketChannel, 'MARKET_CHANNEL_ID')}`,
                ].join('\n'),
                inline: false
            }),
            specialRoles: () => embed.addFields({
                name: '\ud83c\udf94 GAMING & REWARD ROLES',
                value: [
                    `**\ud83d\udcc8 Investor:** ${roleMention(settings.investorRoleId, 'INVESTOR_ROLE_ID')}`,
                    `**\ud83c\udfae Gamer:** ${roleMention(settings.gamerRoleId, 'GAMER_ROLE_ID')}`,
                    `**\ud83e\udde0 Quiz Master:** ${roleMention(settings.quizMasterRoleId, 'QUIZ_MASTER_ROLE_ID')}`,
                    `**\u2694\ufe0f Duelist:** ${roleMention(settings.duelistRoleId, 'DUELIST_ROLE_ID')}`,
                    `**\ud83c\udf31 Daily Initiate (3d):** ${roleMention(settings.dailyInitiateRoleId, 'DAILY_INITIATE_ROLE_ID')}`,
                    `**\ud83d\udd25 Daily Warrior (7d):** ${roleMention(settings.dailyWarriorRoleId, 'DAILY_WARRIOR_ROLE_ID')}`,
                    `**\u2694\ufe0f Daily Champion (30d):** ${roleMention(settings.dailyChampionRoleId, 'DAILY_CHAMPION_ROLE_ID')}`,
                    `**\ud83d\udc8e Daily Legend (100d):** ${roleMention(settings.dailyLegendRoleId, 'DAILY_LEGEND_ROLE_ID')}`,
                ].join('\n'),
                inline: false
            }),
        };

        // ================= CATEGORY =================
        if (category === 'all') {
            Object.values(sections).forEach(fn => fn());
        } else if (sections[category]) {
            sections[category]();
        }

        embed.setFooter({ 
            text: `${guild.name} \u2022 ${t.footer} \u2022 v${client.version}`,
            iconURL: client.user.displayAvatarURL()
        })
        .setTimestamp()
        .setDescription(`\`\`\`ansi\n\u001b[1;36m${t.tip}\u001b[0m\n\`\`\``);

        return embed;
    },

    // ================= SET SETTING (SLASH) =================
    async setSetting(interaction, client, settings, lang) {
        const setting = interaction.options.getString('setting');
        const rawValue = interaction.options.getString('value');
        
        const result = await this.processSetSetting(
            interaction.guild, client, setting, rawValue, lang
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
            message.guild, client, setting, rawValue, lang
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
    async processSetSetting(guild, client, setting, rawValue, lang) {
        const t = {
            fr: {
                success: '✅ Paramètre mis à jour',
                updated: (s, v) => `**${s}** a été défini sur :\n\`${v}\``,
                invalidChannel: '❌ Salon introuvable. Mentionnez un salon valide.',
                invalidRole: '❌ Rôle introuvable. Mentionnez un rôle valide.',
                invalidBool: '❌ Valeur invalide. Utilisez: `true`, `false`, `on`, `off`, `1`, `0`, `enable`, `disable`',
                invalidNumber: '❌ Nombre invalide. Utilisez une valeur entre 0.5 et 5.0',
                invalidPrefix: '❌ Le préfixe doit faire entre 1 et 5 caractères.',
                settingNotFound: '❌ Paramètre inconnu.',
                viewAll: '💡 Tapez `/serversettings view` pour voir tous les paramètres.\n💬 Utilisez `default` comme valeur pour réinitialiser les messages au défaut système.'
            },
            en: {
                success: '✅ Setting Updated',
                updated: (s, v) => `**${s}** has been set to:\n\`${v}\``,
                invalidChannel: '❌ Channel not found. Please mention a valid channel.',
                invalidRole: '❌ Role not found. Please mention a valid role.',
                invalidBool: '❌ Invalid value. Use: `true`, `false`, `on`, `off`, `1`, `0`, `enable`, `disable`',
                invalidNumber: '❌ Invalid number. Use a value between 0.5 and 5.0',
                invalidPrefix: '❌ Prefix must be 1-5 characters.',
                settingNotFound: '❌ Unknown setting.',
                viewAll: '💡 Type `/serversettings view` to see all settings.\n💬 Use `default` as value to reset messages to system default.'
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
                const role = guild.roles.cache.get(roleId);
                if (!role) {
                    try {
                        const fetched = await guild.roles.fetch(roleId).catch(() => null);
                        if (!fetched) return { success: false, error: t.invalidRole };
                        processedValue = roleId;
                    } catch {
                        return { success: false, error: t.invalidRole };
                    }
                } else {
                    processedValue = roleId;
                }
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
        return { success: false, error: `❌ Text too long (max ${def.maxLen} characters)` };
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
                    ? (lang === 'fr' ? '✅ Activé (Défaut)' : '✅ Enabled (Default)')
                    : (processedValue === '0' && def.type === 'bool')
                        ? (lang === 'fr' ? '❌ Désactivé' : '❌ Disabled')
                        : processedValue;

            return {
                success: true,
                title: t.success,
                description: t.updated(def.name, displayValue)
            };
        }

        return { success: false, error: '❌ Database error. Please try again.' };
    },

    // ================= RESET SETTINGS (SLASH) =================
    async resetSettings(interaction, client, settings, lang) {
        const confirm = interaction.options.getString('confirm');
        const confirmWord = lang === 'fr' ? 'CONFIRMER' : 'CONFIRM';
        
        if (confirm.toUpperCase() !== confirmWord) {
            const msg = lang === 'fr'
                ? `❌ Tapez \`${confirmWord}\` pour confirmer la réinitialisation.`
                : `❌ Type \`${confirmWord}\` to confirm reset.`;
            return interaction.reply({ content: msg, flags: 1 << 6 });
        }

        this.performReset(interaction.guild.id, client);
        
        const msg = lang === 'fr'
            ? '🔄 **Tous les paramètres ont été réinitialisés** aux valeurs par défaut.\n💡 Tapez `/serversettings view` pour vérifier.'
            : '🔄 **All settings have been reset** to default values.\n💡 Type `/serversettings view` to verify.';
        
        await interaction.reply({ content: msg });
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
