const { EmbedBuilder, SlashCommandBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'mute',
    aliases: ['silence', 'shut', 'unmute', 'unsilence', 'demute'],
    description: '🔇 Mute/Unmute a member with auto-unmute support',
    category: 'MODERATION',
    usage: '.mute @user [time] [reason] | .unmute @user',
    cooldown: 3000,

    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('🔇 Mute or unmute a member')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
        .addSubcommand(sub => sub
            .setName('add')
            .setDescription('Mute a member')
            .addUserOption(opt => opt.setName('target').setDescription('Member to mute').setRequired(true))
            .addStringOption(opt => opt.setName('duration').setDescription('Duration (1m, 1h, 1d) — default: 1 hour').setRequired(false))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(false))
        )
        .addSubcommand(sub => sub
            .setName('remove')
            .setDescription('Unmute a member')
            .addUserOption(opt => opt.setName('target').setDescription('Member to unmute').setRequired(true))
        ),

    // ================= PREFIX COMMAND =================
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage?.(usedCommand, 'en') || 'en';
        const cmd = usedCommand?.toLowerCase() || 'mute';
        const isUnmute = ['unmute', 'unsilence', 'demute'].includes(cmd);

        const settings = client.getServerSettings(message.guild.id);
        const muteRoleId = settings.muteRoleId || process.env.MUTE_ROLE_ID;

        if (!muteRoleId) {
            return message.reply(lang === 'fr'
                ? '❌ Rôle muet non configuré. Utilisez `//roles set type:Mute Role @role`'
                : '❌ Mute role not configured. Use `/roles set type:Mute Role @role`');
        }

        const target = message.mentions.members.first();
        if (!target) {
            return message.reply(lang === 'fr'
                ? '❌ Mentionnez un membre.'
                : '❌ Mention a member.');
        }

        // ================= UNMUTE =================
        if (isUnmute) {
            try {
                if (!target.roles.cache.has(muteRoleId)) {
                    return message.reply(lang === 'fr'
                        ? `❌ **${target.user.username}** n'est pas muet.`
                        : `❌ **${target.user.username}** is not muted.`);
                }
                await target.roles.remove(muteRoleId);

                const embed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setAuthor({ name: '🔊 MEMBER UNMUTED', iconURL: target.user.displayAvatarURL() })
                    .setDescription(lang === 'fr'
                        ? `**${target.user.username}** a été démuté.`
                        : `**${target.user.username}** has been unmuted.`)
                    .setFooter({ text: message.guild.name })
                    .setTimestamp();

                return message.reply({ embeds: [embed] });
            } catch (e) {
                return message.reply(lang === 'fr' ? '❌ Échec du démutage.' : '❌ Failed to unmute.');
            }
        }

        // ================= MUTE =================
        if (target.roles.cache.has(muteRoleId)) {
            return message.reply(lang === 'fr'
                ? `❌ **${target.user.username}** est déjà muet.`
                : `❌ **${target.user.username}** is already muted.`);
        }

        const timeStr = args[1] || '1h';
        const reason = args.slice(2).join(' ') || (lang === 'fr' ? 'Aucune raison' : 'No reason');
        const ms = parseTime(timeStr);

        if (ms === null) {
            return message.reply(lang === 'fr'
                ? '❌ Format de durée invalide. Exemples: `1m`, `2h`, `1d`'
                : '❌ Invalid duration format. Examples: `1m`, `2h`, `1d`');
        }

        try {
            await target.roles.add(muteRoleId, reason);

            const embed = new EmbedBuilder()
                .setColor('#e67e22')
                .setAuthor({ name: '🔇 MEMBER MUTED', iconURL: target.user.displayAvatarURL() })
                .setDescription(lang === 'fr'
                    ? `**${target.user.username}** a été réduit au silence.\n⏱️ **Durée:** ${timeStr}\n📝 **Raison:** ${reason}`
                    : `**${target.user.username}** has been muted.\n⏱️ **Duration:** ${timeStr}\n📝 **Reason:** ${reason}`)
                .setFooter({ text: `${message.guild.name} • Auto-unmute at ${new Date(Date.now() + ms).toLocaleTimeString()}` })
                .setTimestamp();

            await message.reply({ embeds: [embed] });

            // Auto-unmute
            setTimeout(async () => {
                try {
                    if (target.roles.cache.has(muteRoleId)) {
                        await target.roles.remove(muteRoleId, 'Auto-unmute');
                        const unmuteEmbed = new EmbedBuilder()
                            .setColor('#2ecc71')
                            .setDescription(lang === 'fr'
                                ? `🔊 **${target.user.username}** a été démuté automatiquement.`
                                : `🔊 **${target.user.username}** has been automatically unmuted.`);
                        await message.channel.send({ embeds: [unmuteEmbed] }).catch(() => {});
                    }
                } catch (e) {}
            }, ms);

            console.log(`[MUTE] ${message.author.tag} muted ${target.user.tag} for ${timeStr} | Reason: ${reason}`);

        } catch (e) {
            return message.reply(lang === 'fr' ? '❌ Échec du mute.' : '❌ Failed to mute.');
        }
    },

    // ================= SLASH COMMAND =================
    execute: async (interaction, client) => {
        const subcommand = interaction.options.getSubcommand();
        const target = interaction.options.getMember('target');
        const settings = client.getServerSettings(interaction.guild.id);
        const muteRoleId = settings.muteRoleId || process.env.MUTE_ROLE_ID;
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';

        if (!muteRoleId) {
            return interaction.reply({
                content: lang === 'fr'
                    ? '❌ Rôle muet non configuré.'
                    : '❌ Mute role not configured.',
                flags: 64
            });
        }

        // ================= UNMUTE =================
        if (subcommand === 'remove') {
            try {
                if (!target.roles.cache.has(muteRoleId)) {
                    return interaction.reply({
                        content: lang === 'fr'
                            ? `❌ **${target.user.username}** n'est pas muet.`
                            : `❌ **${target.user.username}** is not muted.`,
                        flags: 64
                    });
                }
                await target.roles.remove(muteRoleId);
                return interaction.reply({
                    content: lang === 'fr'
                        ? `🔊 **${target.user.username}** démuté.`
                        : `🔊 **${target.user.username}** unmuted.`,
                    flags: 64
                });
            } catch (e) {
                return interaction.reply({ content: '❌ Failed to unmute.', flags: 64 });
            }
        }

        // ================= MUTE =================
        if (target.roles.cache.has(muteRoleId)) {
            return interaction.reply({
                content: lang === 'fr'
                    ? `❌ **${target.user.username}** est déjà muet.`
                    : `❌ **${target.user.username}** is already muted.`,
                flags: 64
            });
        }

        const timeStr = interaction.options.getString('duration') || '1h';
        const reason = interaction.options.getString('reason') || 'No reason';
        const ms = parseTime(timeStr);

        if (ms === null) {
            return interaction.reply({
                content: '❌ Invalid duration. Use: 1m, 1h, 1d',
                flags: 64
            });
        }

        try {
            await target.roles.add(muteRoleId, reason);

            setTimeout(async () => {
                try {
                    if (target.roles.cache.has(muteRoleId)) {
                        await target.roles.remove(muteRoleId, 'Auto-unmute');
                    }
                } catch (e) {}
            }, ms);

            return interaction.reply({
                content: lang === 'fr'
                    ? `🔇 **${target.user.username}** muet pour ${timeStr}. Raison: ${reason}`
                    : `🔇 **${target.user.username}** muted for ${timeStr}. Reason: ${reason}`,
                flags: 64
            });
        } catch (e) {
            return interaction.reply({ content: '❌ Failed to mute.', flags: 64 });
        }
    }
};

// ================= TIME PARSER =================
function parseTime(str) {
    const match = str.match(/^(\d+)(m|h|d)$/);
    if (!match) return null;
    const num = parseInt(match[1]);
    switch (match[2]) {
        case 'm': return num * 60 * 1000;
        case 'h': return num * 60 * 60 * 1000;
        case 'd': return num * 24 * 60 * 60 * 1000;
        default: return null;
    }
}