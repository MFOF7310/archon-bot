const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const ROLE_DEFS = {
    member:           { col: 'memberRole',         env: 'MEMBER_ROLE',              emoji: '👤', label: 'Member Role' },
    mute:             { col: 'muteRoleId',          env: 'MUTE_ROLE_ID',             emoji: '🔇', label: 'Mute Role' },
    autorole:         { col: 'autoRoleId',          env: 'AUTO_ROLE_ID',             emoji: '🤖', label: 'Auto Role' },
    staff:            { col: 'ticketStaffRole',     env: 'TICKET_STAFF_ROLE_ID',     emoji: '🛡️', label: 'Staff/Ticket Role' },
    investor:         { col: 'investorRoleId',      env: 'INVESTOR_ROLE_ID',         emoji: '📈', label: 'Investor Role' },
    gamer:            { col: 'gamerRoleId',         env: 'GAMER_ROLE_ID',            emoji: '🎮', label: 'Gamer Role' },
    quizmaster:       { col: 'quizMasterRoleId',    env: 'QUIZ_MASTER_ROLE_ID',      emoji: '🧠', label: 'Quiz Master Role' },
    duelist:          { col: 'duelistRoleId',       env: 'DUELIST_ROLE_ID',          emoji: '⚔️', label: 'Duelist Role' },
    dailyinitiate:    { col: 'dailyInitiateRoleId', env: 'DAILY_INITIATE_ROLE_ID',   emoji: '🌱', label: 'Daily Initiate (3d)' },
    dailywarrior:     { col: 'dailyWarriorRoleId',  env: 'DAILY_WARRIOR_ROLE_ID',    emoji: '🔥', label: 'Daily Warrior (7d)' },
    dailychampion:    { col: 'dailyChampionRoleId', env: 'DAILY_CHAMPION_ROLE_ID',   emoji: '⚔️', label: 'Daily Champion (30d)' },
    dailylegend:      { col: 'dailyLegendRoleId',   env: 'DAILY_LEGEND_ROLE_ID',     emoji: '💎', label: 'Daily Legend (100d)' },
};

module.exports = {
    name: 'roles',
    aliases: ['role', 'setrole', 'roleconfig'],
    description: '🎭 View and set server role configuration',
    category: 'ADMIN',
    cooldown: 3000,

    data: new SlashCommandBuilder()
        .setName('roles')
        .setDescription('🎭 View and configure server roles')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(s => s
            .setName('view')
            .setDescription('👁️ View all configured roles')
        )
        .addSubcommand(s => s
            .setName('set')
            .setDescription('⚙️ Set a role')
            .addStringOption(o => o
                .setName('type')
                .setDescription('Which role to set')
                .setRequired(true)
                .addChoices(
                    { name: '👤 Member Role', value: 'member' },
                    { name: '🔇 Mute Role', value: 'mute' },
                    { name: '🤖 Auto Role', value: 'autorole' },
                    { name: '🛡️ Staff/Ticket Role', value: 'staff' },
                    { name: '📈 Investor Role', value: 'investor' },
                    { name: '🎮 Gamer Role', value: 'gamer' },
                    { name: '🧠 Quiz Master Role', value: 'quizmaster' },
                    { name: '⚔️ Duelist Role', value: 'duelist' },
                    { name: '🌱 Daily Initiate (3d)', value: 'dailyinitiate' },
                    { name: '🔥 Daily Warrior (7d)', value: 'dailywarrior' },
                    { name: '⚔️ Daily Champion (30d)', value: 'dailychampion' },
                    { name: '💎 Daily Legend (100d)', value: 'dailylegend' },
                )
            )
            .addRoleOption(o => o
                .setName('role')
                .setDescription('The role to set')
                .setRequired(true)
            )
        )
        .addSubcommand(s => s
            .setName('remove')
            .setDescription('🗑️ Remove a role setting')
            .addStringOption(o => o
                .setName('type')
                .setDescription('Which role to remove')
                .setRequired(true)
                .addChoices(
                    { name: '👤 Member Role', value: 'member' },
                    { name: '🔇 Mute Role', value: 'mute' },
                    { name: '🤖 Auto Role', value: 'autorole' },
                    { name: '🛡️ Staff/Ticket Role', value: 'staff' },
                    { name: '📈 Investor Role', value: 'investor' },
                    { name: '🎮 Gamer Role', value: 'gamer' },
                    { name: '🧠 Quiz Master Role', value: 'quizmaster' },
                    { name: '⚔️ Duelist Role', value: 'duelist' },
                    { name: '🌱 Daily Initiate (3d)', value: 'dailyinitiate' },
                    { name: '🔥 Daily Warrior (7d)', value: 'dailywarrior' },
                    { name: '⚔️ Daily Champion (30d)', value: 'dailychampion' },
                    { name: '💎 Daily Legend (100d)', value: 'dailylegend' },
                )
            )
        ),

    execute: async (interaction, client) => {
        const sub = interaction.options.getSubcommand();
        const guild = interaction.guild;
        const guildId = guild.id;
        const isOwnerGuild = guildId === process.env.GUILD_ID;
        const settings = client.getServerSettings?.(guildId) || {};

        const roleMention = (id, envKey) => {
            if (id) return `<@&${id}>`;
            if (isOwnerGuild && envKey && process.env[envKey]) return `<@&${process.env[envKey]}> 🔹 .env`;
            return '`Not set`';
        };

        // ── VIEW ──
        if (sub === 'view') {
            const embed = new EmbedBuilder()
                .setColor(0x9b59b6)
                .setAuthor({ name: '🦅 ARCHON ENGINE • ROLE CONFIG', iconURL: client.user.displayAvatarURL() })
                .setTitle(`🎭 ${guild.name} — Roles`)
                .setDescription(
                    Object.entries(ROLE_DEFS).map(([key, def]) =>
                        `${def.emoji} **${def.label}** — ${roleMention(settings[def.col], def.env)}`
                    ).join('\n')
                )
                .setFooter({ text: `BAMAKO_223 🇲🇱 • Use /roles set to configure` })
                .setTimestamp();
            return interaction.reply({ embeds: [embed], flags: 64 });
        }

        // ── SET ──
        if (sub === 'set') {
            const type = interaction.options.getString('type');
            const role = interaction.options.getRole('role');
            const def = ROLE_DEFS[type];
            if (!def) return interaction.reply({ content: '❌ Unknown role type.', flags: 64 });

            client.updateServerSetting?.(guildId, def.col, role.id);
            client.settings?.delete(guildId);

            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setDescription(
                    `\`\`\`ansi\n\u001b[1;32m▸ ROLE UPDATED\u001b[0m\n` +
                    `\u001b[1;36m${def.emoji} ${def.label}\u001b[0m → <@&${role.id}>\n\`\`\``
                )
                .setFooter({ text: `BAMAKO_223 🇲🇱 • ${guild.name}` });
            return interaction.reply({ embeds: [embed], flags: 64 });
        }

        // ── REMOVE ──
        if (sub === 'remove') {
            const type = interaction.options.getString('type');
            const def = ROLE_DEFS[type];
            if (!def) return interaction.reply({ content: '❌ Unknown role type.', flags: 64 });

            client.updateServerSetting?.(guildId, def.col, null);
            client.settings?.delete(guildId);

            const embed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setDescription(`\`\`\`ansi\n\u001b[1;31m▸ ROLE REMOVED\u001b[0m\n\u001b[0;37m${def.emoji} ${def.label} cleared\u001b[0m\n\`\`\``)
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
            const roleMention = (id, envKey) => {
                if (id) return `<@&${id}>`;
                if (isOwnerGuild && envKey && process.env[envKey]) return `<@&${process.env[envKey]}> 🔹 .env`;
                return '`Not set`';
            };
            const embed = new EmbedBuilder()
                .setColor(0x9b59b6)
                .setAuthor({ name: '🦅 ARCHON ENGINE • ROLE CONFIG', iconURL: client.user.displayAvatarURL() })
                .setTitle(`🎭 ${message.guild.name} — Roles`)
                .setDescription(
                    Object.entries(ROLE_DEFS).map(([key, def]) =>
                        `${def.emoji} **${def.label}** — ${roleMention(settings[def.col], def.env)}`
                    ).join('\n')
                )
                .setFooter({ text: `BAMAKO_223 🇲🇱 • Use .roles set <type> @role` })
                .setTimestamp();
            return message.reply({ embeds: [embed] }).catch(() => {});
        }

        if (sub === 'set') {
            const type = args[1]?.toLowerCase();
            const roleId = args[2]?.replace(/[<@&>]/g, '');
            const def = ROLE_DEFS[type];
            if (!def) return message.reply(`❌ Unknown type. Use: ${Object.keys(ROLE_DEFS).join(', ')}`).catch(() => {});
            if (!roleId) return message.reply(`❌ Usage: \`.roles set ${type} @role\``).catch(() => {});
            const role = message.guild.roles.cache.get(roleId);
            if (!role) return message.reply('❌ Role not found.').catch(() => {});
            client.updateServerSetting?.(guildId, def.col, roleId);
            client.settings?.delete(guildId);
            return message.reply(`✅ **${def.label}** set to <@&${roleId}>`).catch(() => {});
        }
    }
};
