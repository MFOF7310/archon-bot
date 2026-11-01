const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { resolveEmoji } = require('../lib/emoji-resolver');
const EMOJIS = require('../config/emojis');
const { t } = require('../lib/i18n');
const { pickLang } = require('../lib/pick-lang');
const v2 = require('../lib/games/v2');
const mention = require('../lib/mentions');
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } = require('discord.js');

const ROLE_DEFS = {
    member:           { col: 'memberRole',         env: 'MEMBER_ROLE',              emoji: () => EMOJIS.member, label: 'Member Role' },
    mute:             { col: 'muteRoleId',          env: 'MUTE_ROLE_ID',             emoji: () => EMOJIS.mute, label: 'Mute Role' },
    autorole:         { col: 'joinRoleId',          env: 'AUTO_ROLE_ID',             emoji: '🤖', label: 'Auto Role' },
    staff:            { col: 'ticketStaffRole',     env: 'TICKET_STAFF_ROLE_ID',     emoji: () => EMOJIS.shield, label: 'Staff/Ticket Role' },
    investor:         { col: 'investorRoleId',      env: 'INVESTOR_ROLE_ID',         emoji: () => EMOJIS.investors, label: 'Investor Role' },
    gamer:            { col: 'gamerRoleId',         env: 'GAMER_ROLE_ID',            emoji: () => EMOJIS.gamer, label: 'Gamer Role' },
    quizmaster:       { col: 'quizMasterRoleId',    env: 'QUIZ_MASTER_ROLE_ID',      emoji: () => EMOJIS.quizmaster, label: 'Quiz Master Role' },
    duelist:          { col: 'duelistRoleId',       env: 'DUELIST_ROLE_ID',          emoji: () => EMOJIS.duelist, label: 'Duelist Role' },
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
        const lang = pickLang(client, guildId, interaction);
        const isOwnerGuild = guildId === process.env.GUILD_ID;

        // Force fresh settings
        client.settings?.delete(guildId);
        const settings = client.getServerSettings?.(guildId) || {};

        const roleMention = (id, envKey) => {
            if (id) return `<@&${id}>`;
            if (isOwnerGuild && envKey && process.env[envKey]) return `<@&${process.env[envKey]}> 🔹 .env`;
            return `\`${t('roles.not_set', lang)}\``;
        };

        if (sub === 'view') {
            const buildSection = (title, keys) => {
                const lines = keys.map(k => {
                    const def = ROLE_DEFS[k];
                    const emoji = typeof def.emoji === 'function' ? resolveEmoji(k, interaction) || def.emoji() : def.emoji;
                    return `${emoji} **${def.label}** — ${roleMention(settings[def.col], def.env)}`;
                });
                return `**${title}**\n${lines.join('\n')}`;
            };

            const c = new ContainerBuilder().setAccentColor(0x9b59b6);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🎭 ${t('roles.title', lang)}\n${guild.name}`));
            c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(buildSection(t('roles.core', lang), ['member', 'mute', 'autorole', 'staff'])));
            c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(buildSection(t('roles.economy', lang), ['investor', 'gamer', 'quizmaster', 'duelist'])));
            c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(buildSection(t('roles.daily', lang), ['dailyinitiate', 'dailywarrior', 'dailychampion', 'dailylegend'])));
            const setCmd = mention(client, 'roles', 'set');
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# BAMAKO_223 🇲🇱 • ${setCmd}`));

            return interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | 64 });
        }

        if (sub === 'set') {
            const type = interaction.options.getString('type');
            const role = interaction.options.getRole('role');
            const def = ROLE_DEFS[type];
            if (!def) return interaction.reply({ content: t('roles.unknown_type', lang), flags: 64 });
            
            if (type === 'autorole') {
                const err = require('../lib/verify-guard').validateVerifyRole(guild, guild.roles.cache.get(role.id), interaction.member);
                if (err) return interaction.reply({ content: `⛔ ${require('../lib/verify-guard').GUARD_MSG[err]}`, flags: 64 });
            }

            client.updateServerSetting?.(guildId, def.col, role.id);
            client.settings?.delete(guildId);

            const c = new ContainerBuilder().setAccentColor(0x2ecc71);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ✅ ${t('roles.set_success', lang)}\n${def.emoji} **${def.label}** → <@&${role.id}>`));
            return interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | 64 });
        }

        if (sub === 'remove') {
            const type = interaction.options.getString('type');
            const def = ROLE_DEFS[type];
            if (!def) return interaction.reply({ content: t('roles.unknown_type', lang), flags: 64 });

            if (!settings[def.col]) {
                return interaction.reply({ content: t('roles.already_removed', lang), flags: 64 });
            }

            client.updateServerSetting?.(guildId, def.col, null);
            client.settings?.delete(guildId);

            const c = new ContainerBuilder().setAccentColor(0xe74c3c);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🗑️ ${t('roles.remove_success', lang)}\n${def.emoji} **${def.label}**`));
            return interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | 64 });
        }
    },

    run: async (client, message, args, db, ss) => {
        if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply(t('roles.admin_only', pickLang(client, message.guild.id, message))).catch(() => {});
        }
        const sub = args[0]?.toLowerCase();
        const guildId = message.guild.id;
        const lang = pickLang(client, guildId, message);
        const isOwnerGuild = guildId === process.env.GUILD_ID;
        
        client.settings?.delete(guildId);
        const settings = client.getServerSettings?.(guildId) || {};

        const roleMention = (id, envKey) => {
            if (id) return `<@&${id}>`;
            if (isOwnerGuild && envKey && process.env[envKey]) return `<@&${process.env[envKey]}> 🔹 .env`;
            return `\`${t('roles.not_set', lang)}\``;
        };

        if (sub === 'view' || !sub) {
            const buildSection = (title, keys) => {
                const lines = keys.map(k => {
                    const def = ROLE_DEFS[k];
                    const emoji = typeof def.emoji === 'function' ? resolveEmoji(k, message) || def.emoji() : def.emoji;
                    return `${emoji} **${def.label}** — ${roleMention(settings[def.col], def.env)}`;
                });
                return `**${title}**\n${lines.join('\n')}`;
            };

            const c = new ContainerBuilder().setAccentColor(0x9b59b6);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🎭 ${t('roles.title', lang)}\n${message.guild.name}`));
            c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(buildSection(t('roles.core', lang), ['member', 'mute', 'autorole', 'staff'])));
            c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(buildSection(t('roles.economy', lang), ['investor', 'gamer', 'quizmaster', 'duelist'])));
            c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(buildSection(t('roles.daily', lang), ['dailyinitiate', 'dailywarrior', 'dailychampion', 'dailylegend'])));
            const setCmd = mention(client, 'roles', 'set');
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# BAMAKO_223 🇲🇱 • ${setCmd}`));

            return message.reply({ components: [c], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        }

        if (sub === 'set') {
            const type = args[1]?.toLowerCase();
            const roleId = args[2]?.replace(/[<@&>]/g, '');
            const def = ROLE_DEFS[type];
            if (!def) return message.reply(t('roles.unknown_type', lang)).catch(() => {});
            if (!roleId) return message.reply(t('roles.usage_set', lang)).catch(() => {});
            const role = message.guild.roles.cache.get(roleId);
            if (!role) return message.reply(t('roles.invalid_role', lang)).catch(() => {});

            if (type === 'autorole') {
                const err = require('../lib/verify-guard').validateVerifyRole(message.guild, role, message.member);
                if (err) return message.reply(`⛔ ${require('../lib/verify-guard').GUARD_MSG[err]}`).catch(() => {});
            }

            client.updateServerSetting?.(guildId, def.col, roleId);
            client.settings?.delete(guildId);

            const c = new ContainerBuilder().setAccentColor(0x2ecc71);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ✅ ${t('roles.set_success', lang)}\n${def.emoji} **${def.label}** → <@&${roleId}>`));
            return message.reply({ components: [c], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        }

        if (sub === 'remove') {
            const type = args[1]?.toLowerCase();
            const def = ROLE_DEFS[type];
            if (!def) return message.reply(t('roles.unknown_type', lang)).catch(() => {});

            if (!settings[def.col]) {
                return message.reply(t('roles.already_removed', lang)).catch(() => {});
            }

            client.updateServerSetting?.(guildId, def.col, null);
            client.settings?.delete(guildId);

            const c = new ContainerBuilder().setAccentColor(0xe74c3c);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🗑️ ${t('roles.remove_success', lang)}\n${def.emoji} **${def.label}**`));
            return message.reply({ components: [c], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        }
    }
};
