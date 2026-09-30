const { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const i18n = require('../lib/i18n');
const I18N_KEYS = ["accessDenied","noTarget","selfTarget","notKickable","success","entity","moderator","log","reason","error","dmTitle","dmServer","dmModerator","dmReason","dmFooter","logChannelTitle","logUser","logModerator","logReason","logChannel","footer","executed"];
// Clés dans lang/<locale>/kick.json ; '' retombe sur EN dans t().
function loadT(lang) {
    const o = {};
    for (const k of I18N_KEYS) o[k] = i18n.t(`kick.${k}`, lang);
    return o;
}

module.exports = {
    name: 'kick',
    aliases: ['expel', 'remove', 'expulser', 'virer', 'k'],
    description: '👢 Remove a member from the current server.',
    category: 'MODERATION',
    cooldown: 5000,
    userPermissions: ['KickMembers'],
    usage: '.kick @user [reason]',
    examples: ['.kick @user Spamming', '.kick 123456789012345678 Advertising', '.expulser @user Comportement inapproprié'],

    // ================= SLASH COMMAND DATA =================
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('👢 Remove a member from the current server')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('Member to kick')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the kick')
                .setRequired(false)
        ),

    // 🔥 NEW SIGNATURE: 6 parameters with usedCommand
    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        
        
        const t = loadT(lang);
        const version = client.version || '1.6.0';
        const guildName = message.guild.name;
        const guildIcon = message.guild.iconURL();
        
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return message.reply({ content: t.accessDenied, flags: 64 }).catch(() => {});
        }

        const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
        const reason = args.slice(1).join(' ') || t.reason;

        if (!target) {
            return message.reply({ content: t.noTarget, flags: 64 }).catch(() => {});
        }
        
        if (!target.kickable) {
            return message.reply({ content: t.notKickable, flags: 64 }).catch(() => {});
        }

        try {
            const dmEmbed = new EmbedBuilder()
                .setColor('#ffa502')
                .setTitle(t.dmTitle)
                .setThumbnail(guildIcon)
                .addFields(
                    { name: t.dmServer, value: guildName, inline: true },
                    { name: t.dmModerator, value: message.author.tag, inline: true },
                    { name: t.dmReason, value: reason, inline: false }
                )
                .setFooter({ text: t.dmFooter })
                .setTimestamp();
            await target.send({ embeds: [dmEmbed] }).catch(() => {});
        } catch (err) {}

        try {
            await target.kick(reason);
            
            const kickEmbed = new EmbedBuilder()
                .setColor('#ffa502')
                .setTitle(t.success)
                .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: t.entity, value: `${target.user.tag} (${target.id})`, inline: true },
                    { name: t.moderator, value: `${message.author.tag}`, inline: true },
                    { name: t.log, value: `*${reason}*`, inline: false }
                )
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                .setTimestamp();

            await message.channel.send({ embeds: [kickEmbed] }).catch(() => {});
            await message.reply({ content: `✅ ${t.executed}`, flags: 64 }).catch(() => {});
            
            if (serverSettings?.logChannel) {
                const logChannel = message.guild.channels.cache.get(serverSettings.logChannel);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor('#ffa502')
                        .setTitle(t.logChannelTitle)
                        .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
                        .addFields(
                            { name: t.logUser, value: `${target.user.tag} (${target.id})`, inline: true },
                            { name: t.logModerator, value: `${message.author.tag} (${message.author.id})`, inline: true },
                            { name: t.logChannel, value: `${message.channel.name}`, inline: true },
                            { name: t.logReason, value: reason, inline: false }
                        )
                        .setFooter({ text: `${guildName} • v${version}` })
                        .setTimestamp();
                    await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
                }
            }
            
            console.log(`[KICK] ${message.author.tag} kicked ${target.user.tag} | Reason: ${reason} | Lang: ${lang}`);
            
        } catch (error) {
            console.error('[KICK] Error:', error);
            return message.reply({ content: t.error, flags: 64 }).catch(() => {});
        }
    },

    // ================= SLASH COMMAND EXECUTION =================
    execute: async (interaction, client) => {
        if (!interaction.guild) {
            const fallbackEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setAuthor({ name: '🦅 SYSTEM ACCESS RESTRICTED', iconURL: client.user.displayAvatarURL() })
                .setTitle('⛔ COMMAND NOT AVAILABLE IN DMs')
                .setDescription(
                    `\`\`\`ansi\n` +
                    `\u001b[1;31m⚠️ SECURITY PROTOCOL ACTIVE\u001b[0m\n\n` +
                    `The \u001b[1;33m/kick\u001b[0m command is a \u001b[1;36mServer-Side Moderation Tool\u001b[0m.\n` +
                    `It cannot be executed within Direct Messages.\n\n` +
                    `\u001b[1;37m┌─────────────────────────────────────┐\u001b[0m\n` +
                    `\u001b[1;37m│\u001b[0m  📍 \u001b[1;33mACTION REQUIRED\u001b[0m                      \u001b[1;37m│\u001b[0m\n` +
                    `\u001b[1;37m│\u001b[0m  Please use this command in a       \u001b[1;37m│\u001b[0m\n` +
                    `\u001b[1;37m│\u001b[0m  server where you have \`Kick Members\`\u001b[1;37m│\u001b[0m\n` +
                    `\u001b[1;37m│\u001b[0m  permission.                         \u001b[1;37m│\u001b[0m\n` +
                    `\u001b[1;37m└─────────────────────────────────────┘\u001b[0m\n` +
                    `\`\`\``
                )
                .setFooter({ text: 'BAMAKO-223 NODE • Neural Security Protocol' })
                .setTimestamp();
            return interaction.reply({ embeds: [fallbackEmbed], flags: 64 });
        }
        
        const target = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason') || 'Operational necessity.';
        const args = [target.id, ...reason.split(' ')];
        
        const fakeMessage = {
            author: interaction.user,
            guild: interaction.guild,
            channel: interaction.channel,
            member: interaction.member,
            mentions: {
                members: {
                    _map: new Map([[target.id, await interaction.guild.members.fetch(target.id).catch(() => null)]]),
                    first() { return this._map.values().next().value || null; },
                    get(id) { return this._map.get(id); },
                    has(id) { return this._map.has(id); },
                    get size() { return this._map.size; }
                },
                users: { first: () => null },
                roles: { first: () => null },
                channels: { first: () => null },
                everyone: false
            },
            reply: async (options) => interaction.deferred ? interaction.editReply(options) : interaction.reply(options),
            react: () => Promise.resolve()
        };
        
        const serverSettings = interaction.guild ? client.getServerSettings(interaction.guild.id) : { prefix: '.' };
        await module.exports.run(client, fakeMessage, args, client.db, serverSettings, 'kick');
    }
};