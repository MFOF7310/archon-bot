const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const em = (k, fb) => { try { return require('../config/emojis')[k] || fb; } catch { return fb; } };
const EMOJIS = require('../config/emojis');
const { resolveEmoji } = require('../lib/emoji-resolver');
const { t } = require('../lib/i18n');
const { pickLang } = require('../lib/pick-lang');
const v2 = require('../lib/games/v2');
const mention = require('../lib/mentions');
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } = require('discord.js');

const getEmoji = (key, fallback) => resolveEmoji(key, null) || fallback;

const CHANNEL_DEFS = {
    general:   { col: 'generalChannel',            dbcol: 'general_channel',            env: 'GENERAL_CHANNEL_ID',            emoji: 'partnericon', label: 'General Channel' },
    welcome:   { col: 'welcomeChannel',            dbcol: 'welcome_channel',            env: 'WELCOME_CHANNEL_ID',            emoji: 'partnericon', label: 'Welcome Channel' },
    goodbye:   { col: 'goodbyeChannel',            dbcol: 'goodbye_channel',            env: 'GOODBYE_CHANNEL_ID',            emoji: 'red_color', label: 'Goodbye Channel' },
    log:       { col: 'logChannel',                dbcol: 'log_channel',                env: 'LOG_CHANNEL_ID',                emoji: 'bluetools', label: 'Log Channel' },
    modlog:    { col: 'modLogChannel',             dbcol: 'mod_log_channel',            env: 'MOD_LOG_CHANNEL_ID',            emoji: 'developericon', label: 'Mod Log Channel' },
    daily:     { col: 'dailyChannel',              dbcol: 'daily_channel',              env: 'DAILY_CHANNEL_ID',              emoji: 'yellowcrown', label: 'Daily Channel' },
    shop:      { col: 'shopChannel',               dbcol: 'shop_channel',               env: 'SHOP_CHANNEL_ID',               emoji: 'boostericon', label: 'Shop Channel' },
    rules:     { col: 'rulesChannel',              dbcol: 'rules_channel',              env: 'RULES_CHANNEL_ID',              emoji: 'rules_icon', label: 'Rules Channel' },
    ticket:    { col: 'ticketTranscriptChannel',   dbcol: 'ticket_transcript_channel',  env: 'TICKET_TRANSCRIPT_CHANNEL_ID',  emoji: 'ownerroleicon', label: 'Ticket Logs Channel' },
    levelup:   { col: 'levelupChannel',            dbcol: 'levelup_channel',            env: 'LEVELUP_CHANNEL_ID',            emoji: 'greencrown', label: 'Level-Up Channel' },
    updates:   { col: 'updatesChannel',            dbcol: 'updates_channel',            env: 'UPDATES_CHANNEL_ID',            emoji: 'boostericon', label: 'Bot Updates Channel' },
};

module.exports = {
    name: 'channels',
    aliases: ['channel', 'setchannel', 'salons'],
    description: '📡 View and set server channel configuration',
    category: 'ADMIN',
    cooldown: 3000,

    data: new SlashCommandBuilder()
        .setName('channels')
        .setDescription('📡 View and configure server channels')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(s => s
            .setName('view')
            .setDescription('👁️ View all configured channels')
        )
        .addSubcommand(s => s
            .setName('set')
            .setDescription('⚙️ Set a channel')
            .addStringOption(o => o
                .setName('type')
                .setDescription('Which channel to set')
                .setRequired(true)
                .addChoices(
                    { name: '🏠 General', value: 'general' },
                    { name: '👋 Welcome', value: 'welcome' },
                    { name: '🚪 Goodbye', value: 'goodbye' },
                    { name: '📋 Log', value: 'log' },
                    { name: '🔨 Mod Log', value: 'modlog' },
                    { name: '🎁 Daily', value: 'daily' },
                    { name: '🛒 Shop', value: 'shop' },
                    { name: '📈 Market', value: 'market' },
                    { name: '📜 Rules', value: 'rules' },
                    { name: '🎫 Ticket Logs', value: 'ticket' },
                    { name: '📊 Level-Up', value: 'levelup' },
                    { name: '🔔 Bot Updates', value: 'updates' },
                )
            )
            .addChannelOption(o => o
                .setName('channel')
                .setDescription('The channel to set')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            )
        )
        .addSubcommand(s => s
            .setName('remove')
            .setDescription('🗑️ Remove a channel setting')
            .addStringOption(o => o
                .setName('type')
                .setDescription('Which channel to remove')
                .setRequired(true)
                .addChoices(
                    { name: '🏠 General', value: 'general' },
                    { name: '👋 Welcome', value: 'welcome' },
                    { name: '🚪 Goodbye', value: 'goodbye' },
                    { name: '📋 Log', value: 'log' },
                    { name: '🔨 Mod Log', value: 'modlog' },
                    { name: '🎁 Daily', value: 'daily' },
                    { name: '🛒 Shop', value: 'shop' },
                    { name: '📈 Market', value: 'market' },
                    { name: '📜 Rules', value: 'rules' },
                    { name: '🎫 Ticket Logs', value: 'ticket' },
                    { name: '📊 Level-Up', value: 'levelup' },
                    { name: '🔔 Bot Updates', value: 'updates' },
                )
            )
        ),

    execute: async (interaction, client) => {
        const sub = interaction.options.getSubcommand();
        const guild = interaction.guild;
        const guildId = guild.id;
        const lang = pickLang(client, guildId, interaction);
        const isOwnerGuild = guildId === process.env.GUILD_ID;
        const settings = client.getServerSettings?.(guildId) || {};

        const chMention = (id, envKey) => {
            if (id) return `<#${id}>`;
            if (isOwnerGuild && envKey && process.env[envKey]) return `<#${process.env[envKey]}> 🔹 .env`;
            return `\`${t('channels.not_set', lang)}\``;
        };

        if (sub === 'view') {
            client.settings?.delete(guildId);
            const fresh = client.getServerSettings?.(guildId) || {};
            
            const buildSection = (title, keys) => {
                const lines = keys.map(k => {
                    const def = CHANNEL_DEFS[k];
                    return `${getEmoji(def.emoji, '📌')} **${def.label}** — ${chMention(fresh[def.col] || fresh[def.dbcol], def.env)}`;
                });
                return `**${title}**\n${lines.join('\n')}`;
            };

            const c = new ContainerBuilder().setAccentColor(0x00f0ff);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${em('ic_satellite', '📡')} ${t('channels.title', lang)}\n${guild.name}`));
            c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(buildSection(t('channels.core', lang), ['general', 'welcome', 'goodbye', 'rules'])));
            c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(buildSection(t('channels.moderation', lang), ['log', 'modlog', 'ticket'])));
            c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(buildSection(t('channels.economy', lang), ['daily', 'shop', 'levelup', 'updates'])));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# BAMAKO_223 🇲🇱 • ${mention(client, 'channels', 'set')}`));

            return interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | 64 });
        }

        if (sub === 'set') {
            const type = interaction.options.getString('type');
            const channel = interaction.options.getChannel('channel');
            const def = CHANNEL_DEFS[type];
            if (!def) return interaction.reply({ content: t('channels.unknown_type', lang), flags: 64 });

            client.updateServerSetting?.(guildId, def.dbcol, channel.id);
            client.settings?.delete(guildId);

            const _cp = require('../lib/canPost');
            const _need = _cp.neededFor(type);
            const _d = _cp.diagnose(guild, channel, guild.members.me, _need);
            const _bot = guild.members.me.roles.botRole?.name || guild.members.me.displayName;

            const c = new ContainerBuilder().setAccentColor(_d.ok ? 0x2ecc71 : 0xf1c40f);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${resolveEmoji('screaminggreen', interaction) || '✅'} ${t('channels.set_success', lang)}\n${getEmoji(def.emoji, '📌')} **${def.label}** → <#${channel.id}>`));
            c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            
            if (_d.ok) {
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${resolveEmoji('screaminggreen', interaction) || '🟢'} ${t('channels.can_post', lang)}`));
            } else {
                const reason = _d.reason === 'private' ? t('channels.private_warn', lang) : t('channels.role_block', lang, { role: _d.role || 'A role', missing: _d.missing.join(', ') });
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`⚠️ **${t('channels.set_warning', lang)}**\n${reason}\n\n-# ${t('channels.fix_warn', lang, { bot: _bot, missing: _d.missing.join(', ') })}`));
            }
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# BAMAKO_223 🇲🇱 • ${guild.name}`));
            
            return interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | 64 });
        }

        if (sub === 'remove') {
            const type = interaction.options.getString('type');
            const def = CHANNEL_DEFS[type];
            if (!def) return interaction.reply({ content: t('channels.unknown_type', lang), flags: 64 });

            const currentId = settings[def.col] || settings[def.dbcol];
            if (!currentId) return interaction.reply({ content: t('channels.already_removed', lang, { label: def.label }), flags: 64 });

            client.updateServerSetting?.(guildId, def.dbcol, null);
            client.settings?.delete(guildId);

            const c = new ContainerBuilder().setAccentColor(0xe74c3c);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${resolveEmoji('red_color', interaction) || '✅'} ${t('channels.removed_title', lang)}\n${getEmoji(def.emoji, '📌')} ${t('channels.removed_desc', lang, { label: def.label })}`));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# BAMAKO_223 🇲🇱 • ${t('channels.removed_footer', lang)}`));
            return interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | 64 });
        }
    },

    run: async (client, message, args, db, ss) => {
        const lang = pickLang(client, message.guild.id, message);
        if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply(t('channels.admin_only', lang)).catch(() => {});
        }
        const sub = args[0]?.toLowerCase();
        const guildId = message.guild.id;
        const isOwnerGuild = guildId === process.env.GUILD_ID;
        const settings = client.getServerSettings?.(guildId) || {};

        const chMention = (id, envKey) => {
            if (id) return `<#${id}>`;
            if (isOwnerGuild && envKey && process.env[envKey]) return `<#${process.env[envKey]}> 🔹 .env`;
            return `\`${t('channels.not_set', lang)}\``;
        };

        if (sub === 'view' || !sub) {
            client.settings?.delete(guildId);
            const fresh = client.getServerSettings?.(guildId) || {};
            
            const buildSection = (title, keys) => {
                const lines = keys.map(k => {
                    const def = CHANNEL_DEFS[k];
                    return `${getEmoji(def.emoji, '📌')} **${def.label}** — ${chMention(fresh[def.col] || fresh[def.dbcol], def.env)}`;
                });
                return `**${title}**\n${lines.join('\n')}`;
            };

            const c = new ContainerBuilder().setAccentColor(0x00f0ff);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${em('ic_satellite', '📡')} ${t('channels.title', lang)}\n${message.guild.name}`));
            c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(buildSection(t('channels.core', lang), ['general', 'welcome', 'goodbye', 'rules'])));
            c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(buildSection(t('channels.moderation', lang), ['log', 'modlog', 'ticket'])));
            c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(buildSection(t('channels.economy', lang), ['daily', 'shop', 'levelup', 'updates'])));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# BAMAKO_223 🇲🇱 • ${mention(client, 'channels', 'set')}`));

            return message.reply({ components: [c], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        }

        if (sub === 'set') {
            const type = args[1]?.toLowerCase();
            const channelId = args[2]?.replace(/[<#>]/g, '');
            const def = CHANNEL_DEFS[type];
            if (!def) return message.reply(t('channels.unknown_type', lang)).catch(() => {});
            if (!channelId) return message.reply(t('channels.usage_set', lang)).catch(() => {});
            const ch = message.guild.channels.cache.get(channelId);
            if (!ch) return message.reply(t('channels.invalid_channel', lang)).catch(() => {});

            client.updateServerSetting?.(guildId, def.dbcol, channelId);
            client.settings?.delete(guildId);

            const _cp = require('../lib/canPost');
            const _d = _cp.diagnose(message.guild, ch, message.guild.members.me, _cp.neededFor(type));
            const _bot = message.guild.members.me.roles.botRole?.name || message.guild.members.me.displayName;

            const c = new ContainerBuilder().setAccentColor(_d.ok ? 0x2ecc71 : 0xf1c40f);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${resolveEmoji('screaminggreen', message) || '✅'} ${t('channels.set_success', lang)}\n${getEmoji(def.emoji, '📌')} **${def.label}** → <#${channelId}>`));
            c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            
            if (_d.ok) {
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${resolveEmoji('screaminggreen', message) || '🟢'} ${t('channels.can_post', lang)}`));
            } else {
                const reason = _d.reason === 'private' ? t('channels.private_warn', lang) : t('channels.role_block', lang, { role: _d.role || 'A role', missing: _d.missing.join(', ') });
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`⚠️ **${t('channels.set_warning', lang)}**\n${reason}\n\n-# ${t('channels.fix_warn', lang, { bot: _bot, missing: _d.missing.join(', ') })}`));
            }
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# BAMAKO_223 🇲🇱 • ${message.guild.name}`));
            
            return message.reply({ components: [c], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        }

        if (sub === 'remove') {
            const type = args[1]?.toLowerCase();
            const def = CHANNEL_DEFS[type];
            if (!def) return message.reply(t('channels.unknown_type', lang)).catch(() => {});

            const currentId = settings[def.col] || settings[def.dbcol];
            if (!currentId) return message.reply(t('channels.already_removed', lang, { label: def.label })).catch(() => {});

            client.updateServerSetting?.(guildId, def.dbcol, null);
            client.settings?.delete(guildId);

            const c = new ContainerBuilder().setAccentColor(0xe74c3c);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${resolveEmoji('red_color', message) || '✅'} ${t('channels.removed_title', lang)}\n${getEmoji(def.emoji, '📌')} ${t('channels.removed_desc', lang, { label: def.label })}`));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# BAMAKO_223 🇲🇱 • ${t('channels.removed_footer', lang)}`));
            return message.reply({ components: [c], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        }
    }
};
