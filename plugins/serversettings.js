const EMOJIS = require('../config/emojis');
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
            { name: '💬 Welcome Message', value: 'message' },
            { name: '📈 XP Multiplier (0.5-5.0)', value: 'xpboost' },
            { name: '💰 Market Enabled', value: 'marketenabled' },
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
    const isOwner = interaction.user.id === interaction.guild.ownerId;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    
    if (!isOwner && !isAdmin) {
        const owner = await interaction.guild.fetchOwner().catch(() => null);
        const ownerName = owner ? `**${owner.user.username}**` : 'the server owner';
        const lang = client.detectLanguage ? client.detectLanguage('serversettings', interaction.guild?.id) : 'en';
        
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
                .setAuthor({ name: EMOJIS.shield + ' Access Restricted', iconURL: message.guild.iconURL() || client.user.displayAvatarURL() })
                .setDescription(msg)
                .setFooter({ text: `${message.guild.name} • Server Configuration Protected` })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        const action = args[0]?.toLowerCase();
        const cmdName = args[0]?.toLowerCase() || 'view';
        const lang = client.detectLanguage ? client.detectLanguage(cmdName, message.guild?.id) : 'en';
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
        const translations = {
            fr: {
                title: 'Configuration du serveur',
                general: 'Général',
                prefix: 'Préfixe',
                welcome: 'Bienvenue',
                welcomeChannel: 'Salon de Bienvenue',
                welcomeMessage: 'Message de Bienvenue',
                goodbyeChannel: 'Salon d\'Au Revoir',
                goodbyeMessage: 'Message d\'Au Revoir',
                leveling: 'Niveaux',
                xpMultiplier: 'Multiplicateur XP',
                levelChannel: 'Salon des Niveaux',
                economy: 'Économie',
                marketEnabled: 'Marché Activé',
                features: 'Fonctionnalités',
                afkEnabled: 'Système AFK',
                aiEnabled: 'Lydia AI',
                moderation: 'Modération',
                logChannel: 'Salon de Logs',
                muteRole: 'Rôle Muet',
                modLogChannel: 'Salon Logs Modération',
                roles: 'Rôles',
                memberRole: 'Rôle Membre',
                autoRole: 'Rôle Automatique',
                channels: 'Salons',
                rulesChannel: 'Salon Règles',
                generalChannel: 'Salon Général',
                dailyChannel: 'Salon Quotidien',
                shopChannel: 'Salon Boutique',
                enabled: '✅ Activé',
                disabled: '❌ Désactivé',
                notSet: '⚠️ Non défini',
                footer: 'ARCHON CG-223 • Configuration par serveur',
                tip: '💡 Utilisez `/serversettings set` pour modifier',
                resetConfirmError: '❌ Tapez `{word}` pour confirmer la réinitialisation.',
                resetSuccess: '🔄 **Tous les paramètres réinitialisés** aux valeurs par défaut.\n💡 Tapez `/serversettings view` pour vérifier.',
                resetConfirmError: '❌ Tapez `{word}` pour confirmer la réinitialisation.',
                resetSuccess: '🔄 **Tous les paramètres ont été réinitialisés** aux valeurs par défaut.\n💡 Tapez `/serversettings view` pour vérifier.'
            },
            en: {
                title: 'Server Configuration',
                general: 'General',
                prefix: 'Prefix',
                welcome: 'Welcome',
                welcomeChannel: 'Welcome Channel',
                welcomeMessage: 'Welcome Message',
                goodbyeChannel: 'Goodbye Channel',
                goodbyeMessage: 'Goodbye Message',
                leveling: 'Leveling',
                xpMultiplier: 'XP Multiplier',
                levelChannel: 'Level-Up Channel',
                economy: 'Economy',
                marketEnabled: 'Market Enabled',
                features: 'Features',
                afkEnabled: 'AFK System',
                aiEnabled: 'Lydia AI',
                moderation: 'Moderation',
                logChannel: 'Log Channel',
                muteRole: 'Mute Role',
                modLogChannel: 'Mod Log Channel',
                roles: 'Roles',
                memberRole: 'Member Role',
                autoRole: 'Auto Role',
                channels: 'Channels',
                rulesChannel: 'Rules Channel',
                generalChannel: 'General Channel',
                dailyChannel: 'Daily Channel',
                shopChannel: 'Shop Channel',
                enabled: '✅ Enabled',
                disabled: '❌ Disabled',
                notSet: '⚠️ Not set',
                footer: 'ARCHON CG-223 • Per-Server Configuration',
                tip: '💡 Use `/serversettings set` to modify',
                resetConfirmError: '❌ Type `{word}` to confirm reset.',
                resetSuccess: '🔄 **All settings reset** to default values.\n💡 Type `/serversettings view` to verify.',
                resetConfirmError: '❌ Type `{word}` to confirm reset.',
                resetSuccess: '🔄 **All settings have been reset** to default values.\n💡 Type `/serversettings view` to verify.'
            },
            bm: {
                title: 'Configuration du serveur',
                general: 'Général',
                prefix: 'Préfixe',
                welcome: 'Aw bisimila',
                welcomeChannel: 'Aw bisimila salon',
                welcomeMessage: 'Aw bisimila message',
                goodbyeChannel: 'Aw kanbɛ salon',
                goodbyeMessage: 'Aw kanbɛ message',
                leveling: 'Niveau yɛlɛnni',
                xpMultiplier: 'XP Multiplicateur',
                levelChannel: 'Niveau salon',
                economy: 'Maara',
                marketEnabled: 'Marché dayɛlɛ len',
                features: 'Fonctionnalités',
                afkEnabled: 'AFK système',
                aiEnabled: 'Lydia AI',
                moderation: 'Modération',
                logChannel: 'Log salon',
                muteRole: 'Mute rôle',
                modLogChannel: 'Mod log salon',
                roles: 'Rôles',
                memberRole: 'Membre rôle',
                autoRole: 'Auto rôle',
                channels: 'Salons',
                rulesChannel: 'Règles salon',
                generalChannel: 'Général salon',
                dailyChannel: 'Quotidien salon',
                shopChannel: 'Boutique salon',
                enabled: '✅ Dayɛlɛ len',
                disabled: '❌ Datugulen',
                notSet: '⚠️ A ma réglé',
                footer: 'ARCHON CG-223 • Configuration du serveur',
                tip: '💡 I bɛ `/serversettings set` ta, ka yɛlɛma do a la',
                resetConfirmError: '❌ {word} sɛbɛn, ka reset kɛ.',
                resetSuccess: '🔄 **Paramètres bɛɛ kɛlen don** default cogoya la.\n💡 `/serversettings view` ta ka filɛ.'
            },
            ar: {
                title: 'إعدادات السيرفر',
                general: 'عام',
                prefix: 'البادئة',
                welcome: 'الترحيب',
                welcomeChannel: 'قناة الترحيب',
                welcomeMessage: 'رسالة الترحيب',
                goodbyeChannel: 'قناة الوداع',
                goodbyeMessage: 'رسالة الوداع',
                leveling: 'المستويات',
                xpMultiplier: 'مضاعف XP',
                levelChannel: 'قناة الترقية',
                economy: 'الاقتصاد',
                marketEnabled: 'السوق مفعّل',
                features: 'الميزات',
                afkEnabled: 'نظام AFK',
                aiEnabled: 'Lydia AI',
                moderation: 'الإدارة',
                logChannel: 'قناة السجلات',
                muteRole: 'رتبة الكتم',
                modLogChannel: 'قناة سجلات الإدارة',
                roles: 'الرتب',
                memberRole: 'رتبة العضو',
                autoRole: 'رتبة تلقائية',
                channels: 'القنوات',
                rulesChannel: 'قناة القواعد',
                generalChannel: 'القناة العامة',
                dailyChannel: 'القناة اليومية',
                shopChannel: 'قناة المتجر',
                enabled: '✅ مفعّل',
                disabled: '❌ معطّل',
                notSet: '⚠️ غير محدد',
                footer: 'ARCHON CG-223 • إعدادات السيرفر',
                tip: '💡 استخدم `/serversettings set` للتعديل',
                resetConfirmError: '❌ اكتب `{word}` لتأكيد إعادة الضبط.',
                resetSuccess: '🔄 **تم إعادة ضبط جميع الإعدادات**.\n💡 اكتب `/serversettings view` للتحقق.'
            },
            zh: {
                title: '服务器配置',
                general: '通用',
                prefix: '前缀',
                welcome: '欢迎',
                welcomeChannel: '欢迎频道',
                welcomeMessage: '欢迎消息',
                goodbyeChannel: '告别频道',
                goodbyeMessage: '告别消息',
                leveling: '等级系统',
                xpMultiplier: 'XP 倍率',
                levelChannel: '升级频道',
                economy: '经济',
                marketEnabled: '市场已启用',
                features: '功能',
                afkEnabled: 'AFK 系统',
                aiEnabled: 'Lydia AI',
                moderation: '管理',
                logChannel: '日志频道',
                muteRole: '禁言身份组',
                modLogChannel: '管理日志频道',
                roles: '身份组',
                memberRole: '成员身份组',
                autoRole: '自动身份组',
                channels: '频道',
                rulesChannel: '规则频道',
                generalChannel: '通用频道',
                dailyChannel: '每日频道',
                shopChannel: '商店频道',
                enabled: '✅ 已启用',
                disabled: '❌ 已禁用',
                notSet: '⚠️ 未设置',
                footer: 'ARCHON CG-223 • 服务器配置',
                tip: '💡 使用 `/serversettings set` 进行修改',
                resetConfirmError: '❌ 输入 `{word}` 确认重置。',
                resetSuccess: '🔄 **所有设置已重置**为默认值。\n💡 输入 `/serversettings view` 查看。'
            }
        };
        const t = translations[lang] || translations['en'];

        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setAuthor({ 
                name: t.title, 
                iconURL: guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL() 
            });

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
            general: () => embed.addFields(
                {
                    name: `${EMOJIS.general} ${t.general}`,
                    value: `${EMOJIS.shield} **Prefix:** \`${settings.prefix || '.'}\``,
                    inline: true
                },
                {
                    name: `${EMOJIS.xp} ${t.leveling}`,
                    value: [
                        `**XP Multiplier:** \`${settings.xpMultiplier || 1.0}x\``,
                        `**Level-Up:** ${channelMention(settings.levelChannel, 'LEVEL_CHANNEL_ID')}`
                    ].join('\n'),
                    inline: true
                }
            ),
            welcome: () => embed.addFields(
                {
                    name: `${EMOJIS.welcome} ${t.welcome}`,
                    value: [
                        `**Channel:** ${channelMention(settings.welcomeChannel, 'WELCOME_CHANNEL_ID')}`,
                        `**Message:** ${settings.welcomeMessage ? '✅ Custom' : '📋 Default'}`,
                    ].join('\n'),
                    inline: true
                },
                {
                    name: `${EMOJIS.goodbye} Goodbye`,
                    value: [
                        `**Channel:** ${channelMention(settings.goodbyeChannel, 'GOODBYE_CHANNEL_ID')}`,
                        `**Message:** ${settings.goodbyeMessage ? '✅ Custom' : '📋 Default'}`,
                    ].join('\n'),
                    inline: true
                }
            ),
            economy: () => embed.addFields(
                {
                    name: `${EMOJIS.coins} ${t.economy}`,
                    value: [
                        `**Market:** ${boolStr(settings.marketEnabled)}`,
                        `**Market Channel:** ${channelMention(settings.marketChannel, 'MARKET_CHANNEL_ID')}`,
                        `**Shop:** ${channelMention(settings.shopChannel, 'SHOP_CHANNEL_ID')}`,
                    ].join('\n'),
                    inline: true
                },
                {
                    name: `${EMOJIS.ai_assistant} ${t.features}`,
                    value: [
                        `**AFK:** ${boolStr(settings.afkEnabled)}`,
                        `**Lydia AI:** ${boolStr(settings.aiEnabled)}`
                    ].join('\n'),
                    inline: true
                }
            ),
            moderation: () => embed.addFields(
                {
                    name: `${EMOJIS.shield} ${t.moderation}`,
                    value: [
                        `**Log:** ${channelMention(settings.logChannel, 'LOG_CHANNEL_ID')}`,
                        `**Mod Log:** ${channelMention(settings.modLogChannel, 'MOD_LOG_CHANNEL_ID')}`,
                        `**Mute Role:** ${roleMention(settings.muteRoleId, 'MUTE_ROLE_ID')}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: `${EMOJIS.member} ${t.roles}`,
                    value: [
                        `**Member:** ${roleMention(settings.memberRole, 'MEMBER_ROLE')}`,
                        `**Auto Role:** ${roleMention(settings.autoRoleId, 'AUTO_ROLE_ID')}`
                    ].join('\n'),
                    inline: true
                }
            ),
            channels: () => embed.addFields({
                name: `${EMOJIS.general} ${t.channels}`,
                value: [
                    `**Rules:** ${channelMention(settings.rulesChannel, 'RULES_CHANNEL_ID')}`,
                    `**General:** ${channelMention(settings.generalChannel, 'GENERAL_CHANNEL_ID')}`,
                    `**Daily:** ${channelMention(settings.dailyChannel, 'DAILY_CHANNEL_ID')}`,
                ].join('\n'),
                inline: false
            }),
            specialRoles: () => embed.addFields(
                {
                    name: `${EMOJIS.investors} ${t.economy} ${t.roles}`,
                    value: [
                        `**Investor:** ${roleMention(settings.investorRoleId, 'INVESTOR_ROLE_ID')}`,
                        `**Gamer:** ${roleMention(settings.gamerRoleId, 'GAMER_ROLE_ID')}`,
                        `**Quiz Master:** ${roleMention(settings.quizMasterRoleId, 'QUIZ_MASTER_ROLE_ID')}`,
                        `**Duelist:** ${roleMention(settings.duelistRoleId, 'DUELIST_ROLE_ID')}`,
                    ].join('\n'),
                    inline: true
                },
                {
                    name: `🌱 Daily ${t.roles}`,
                    value: [
                        `**Initiate (3d):** ${roleMention(settings.dailyInitiateRoleId, 'DAILY_INITIATE_ROLE_ID')}`,
                        `**Warrior (7d):** ${roleMention(settings.dailyWarriorRoleId, 'DAILY_WARRIOR_ROLE_ID')}`,
                        `**Champion (30d):** ${roleMention(settings.dailyChampionRoleId, 'DAILY_CHAMPION_ROLE_ID')}`,
                        `**Legend (100d):** ${roleMention(settings.dailyLegendRoleId, 'DAILY_LEGEND_ROLE_ID')}`,
                    ].join('\n'),
                    inline: true
                }
            ),
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
            return interaction.reply({ content: (t.resetConfirmError || '❌ Type `{word}` to confirm reset.').replace('{word}', confirmWord), flags: 1 << 6 });
        }

        this.performReset(interaction.guild.id, client);

        await interaction.reply({ content: t.resetSuccess || '🔄 **All settings reset** to default values.' });
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
