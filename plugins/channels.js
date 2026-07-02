const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

const CHANNEL_DEFS = {
    general:   { col: 'generalChannel',            dbcol: 'general_channel',            env: 'GENERAL_CHANNEL_ID',            emoji: '🏠', label: 'General Channel' },
    welcome:   { col: 'welcomeChannel',            dbcol: 'welcome_channel',            env: 'WELCOME_CHANNEL_ID',            emoji: '👋', label: 'Welcome Channel' },
    goodbye:   { col: 'goodbyeChannel',            dbcol: 'goodbye_channel',            env: 'GOODBYE_CHANNEL_ID',            emoji: '🚪', label: 'Goodbye Channel' },
    log:       { col: 'logChannel',                dbcol: 'log_channel',                env: 'LOG_CHANNEL_ID',                emoji: '📋', label: 'Log Channel' },
    modlog:    { col: 'modLogChannel',             dbcol: 'mod_log_channel',            env: 'MOD_LOG_CHANNEL_ID',            emoji: '🔨', label: 'Mod Log Channel' },
    daily:     { col: 'dailyChannel',              dbcol: 'daily_channel',              env: 'DAILY_CHANNEL_ID',              emoji: '🎁', label: 'Daily Channel' },
    shop:      { col: 'shopChannel',               dbcol: 'shop_channel',               env: 'SHOP_CHANNEL_ID',               emoji: '🛒', label: 'Shop Channel' },
    market:    { col: 'marketChannel',             dbcol: 'market_channel',             env: 'MARKET_CHANNEL_ID',             emoji: '📈', label: 'Market Channel' },
    rules:     { col: 'rulesChannel',              dbcol: 'rules_channel',              env: 'RULES_CHANNEL_ID',              emoji: '📜', label: 'Rules Channel' },
    ticket:    { col: 'ticketTranscriptChannel',   dbcol: 'ticket_transcript_channel',  env: 'TICKET_TRANSCRIPT_CHANNEL_ID',  emoji: '🎫', label: 'Ticket Logs Channel' },
    levelup:   { col: 'levelupChannel',            dbcol: 'levelup_channel',            env: 'LEVELUP_CHANNEL_ID',            emoji: '📊', label: 'Level-Up Channel' },
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
                )
            )
        ),

    execute: async (interaction, client) => {
        const sub = interaction.options.getSubcommand();
        const guild = interaction.guild;
        const guildId = guild.id;
        const isOwnerGuild = guildId === process.env.GUILD_ID;
        const settings = client.getServerSettings?.(guildId) || {};

        const chMention = (id, envKey) => {
            if (id) return `<#${id}>`;
            if (isOwnerGuild && envKey && process.env[envKey]) return `<#${process.env[envKey]}> 🔹 .env`;
            return '`Not set`';
        };

        // ── VIEW ──
        if (sub === 'view') {
            // Force fresh settings — bypass cache
            client.settings?.delete(guildId);
            const freshSettings = client.getServerSettings?.(guildId) || {};
            const embed = new EmbedBuilder()
                .setColor(0x00f0ff)
                .setAuthor({ name: '🦅 ARCHON ENGINE • CHANNEL CONFIG', iconURL: client.user.displayAvatarURL() })
                .setTitle(`📡 ${guild.name} — Channels`)
                .setDescription(
                    Object.entries(CHANNEL_DEFS).map(([key, def]) => {
                        const id = freshSettings[def.col];
                        const val = id ? `<#${id}>` : (isOwnerGuild && process.env[def.env] ? `<#${process.env[def.env]}> 🔹 .env` : '\`Not set\`');
                        return `${def.emoji} **${def.label}** — ${val}`;
                    }).join('\n')
                )
                .setFooter({ text: `BAMAKO_223 🇲🇱 • Use /channels set to configure` })
                .setTimestamp();
            return interaction.reply({ embeds: [embed], flags: 64 });
        }

        // ── SET ──
        if (sub === 'set') {
            const type = interaction.options.getString('type');
            const channel = interaction.options.getChannel('channel');
            const def = CHANNEL_DEFS[type];
            if (!def) return interaction.reply({ content: '❌ Unknown channel type.', flags: 64 });

            const ok = client.updateServerSetting?.(guildId, def.dbcol, channel.id);
            client.settings?.delete(guildId);

            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setDescription(
                    `\`\`\`ansi\n\u001b[1;32m▸ CHANNEL UPDATED\u001b[0m\n` +
                    `\u001b[1;36m${def.emoji} ${def.label}\u001b[0m → <#${channel.id}>\n\`\`\``
                )
                .setFooter({ text: `BAMAKO_223 🇲🇱 • ${guild.name}` });
            return interaction.reply({ embeds: [embed], flags: 64 });
        }

        // ── REMOVE ──
        if (sub === 'remove') {
            const type = interaction.options.getString('type');
            const def = CHANNEL_DEFS[type];
            if (!def) return interaction.reply({ content: '❌ Unknown channel type.', flags: 64 });

            client.updateServerSetting?.(guildId, def.dbcol, null);
            client.settings?.delete(guildId);

            const embed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setDescription(`\`\`\`ansi\n\u001b[1;31m▸ CHANNEL REMOVED\u001b[0m\n\u001b[0;37m${def.emoji} ${def.label} cleared\u001b[0m\n\`\`\``)
                .setFooter({ text: `BAMAKO_223 🇲🇱 • ${guild.name}` });
            return interaction.reply({ embeds: [embed], flags: 64 });
        }
    },

    run: async (client, message, args, db, ss) => {
        if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Administrator permission required.').catch(() => {});
        }
        const sub = args[0]?.toLowerCase();
        const guildId = message.guild.id;
        const isOwnerGuild = guildId === process.env.GUILD_ID;
        const settings = client.getServerSettings?.(guildId) || {};

        if (sub === 'view' || !sub) {
            // Force fresh settings — bypass cache
            client.settings?.delete(guildId);
            const freshSettings = client.getServerSettings?.(guildId) || {};
            const chMention = (id, envKey) => {
                if (id) return `<#${id}>`;
                if (isOwnerGuild && envKey && process.env[envKey]) return `<#${process.env[envKey]}> 🔹 .env`;
                return '`Not set`';
            };
            const embed = new EmbedBuilder()
                .setColor(0x00f0ff)
                .setAuthor({ name: '🦅 ARCHON ENGINE • CHANNEL CONFIG', iconURL: client.user.displayAvatarURL() })
                .setTitle(`📡 ${message.guild.name} — Channels`)
                .setDescription(
                    Object.entries(CHANNEL_DEFS).map(([key, def]) =>
                        `${def.emoji} **${def.label}** — ${chMention(freshSettings[def.col], def.env)}`
                    ).join('\n')
                )
                .setFooter({ text: `BAMAKO_223 🇲🇱 • Use .channels set <type> #channel` })
                .setTimestamp();
            return message.reply({ embeds: [embed] }).catch(() => {});
        }

        if (sub === 'set') {
            const type = args[1]?.toLowerCase();
            const channelId = args[2]?.replace(/[<#>]/g, '');
            const def = CHANNEL_DEFS[type];
            if (!def) return message.reply(`❌ Unknown type. Use: ${Object.keys(CHANNEL_DEFS).join(', ')}`).catch(() => {});
            if (!channelId) return message.reply(`❌ Usage: \`.channels set ${type} #channel\``).catch(() => {});
            const ch = message.guild.channels.cache.get(channelId);
            if (!ch) return message.reply('❌ Channel not found.').catch(() => {});
            client.updateServerSetting?.(guildId, def.dbcol, channelId);
            client.settings?.delete(guildId);
            return message.reply(`✅ **${def.label}** set to <#${channelId}>`).catch(() => {});
        }
    }
};
