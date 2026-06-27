const { EmbedBuilder, PermissionsBitField, SlashCommandBuilder, ChannelType, MessageFlags, Colors } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        accessDeniedTitle: '🚫 ACCESS DENIED',
        accessDeniedDesc: 'You lack the required `Manage Channels` permission in this server.',
        serverContext: 'This command requires a **server context** to verify permissions.',
        dmFallbackNote: '📩 *This message was sent privately to avoid public embarrassment.*',
        noPerms: '❌ You need the `Manage Channels` permission to use this command.',
        botNoPerms: (channel) => `❌ I don't have \`Manage Channels\` permission in ${channel}.`,
        enabled: (channel, formattedTime) => ({
            title: '🐢 Slowmode Activated',
            description: [
                `**Channel:** ${channel}`,
                `**Cooldown:** \`${formattedTime}\``,
                '',
                '⏱️ Members must wait this long between messages.',
                '🔒 Only members with `Manage Messages` permission are exempt.'
            ].join('\n'),
        }),
        disabled: (channel) => ({
            title: '✅ Slowmode Deactivated',
            description: [
                `**Channel:** ${channel}`,
                '',
                '💨 Members can now send messages freely without cooldown.'
            ].join('\n'),
        }),
        invalid: [
            '❌ **Invalid Usage**',
            '',
            '**Correct Format:**',
            '`.slowmode <time>` or `/slowmode duration:<time>`',
            '',
            '**Examples:**',
            '🕐 `.slowmode 5s` — 5 seconds',
            '🕐 `.slowmode 30s` — 30 seconds',
            '🕐 `.slowmode 1m` — 1 minute',
            '🕐 `.slowmode 5m` — 5 minutes',
            '🕐 `.slowmode 2h` — 2 hours',
            '🛑 `.slowmode off` — disable',
            '',
            '💡 **Tip:** Use `/slowmode` for an interactive experience!'
        ].join('\n'),
        max: '❌ Maximum slowmode is **6 hours** (21600 seconds).\n⏱️ Discord limitation to prevent excessive restrictions.',
        min: '❌ Minimum slowmode is **1 second**.',
        alreadyOff: '💤 *Slowmode was already disabled.*',
        current: (channel, seconds) => `ℹ️ Current slowmode in ${channel}: **${seconds === 0 ? 'Off' : formatTime(seconds)}**`,
        logTitle: '🐢 SLOWMODE CHANGED',
        permCheckField: 'You need `ManageChannels` to use this command.',
        permYourRole: 'Your highest role lacks this permission.',
        permBotRole: 'Bot role may also need elevation.',
        helpTitle: '🐢 SLOWMODE COMMAND'
    },
    fr: {
        accessDeniedTitle: '🚫 ACCÈS REFUSÉ',
        accessDeniedDesc: 'Vous n\'avez pas la permission `Gérer les Salons` sur ce serveur.',
        serverContext: 'Cette commande nécessite un **contexte serveur** pour vérifier les permissions.',
        dmFallbackNote: '📩 *Ce message vous a été envoyé en privé pour éviter l\'embarras public.*',
        noPerms: '❌ Vous avez besoin de la permission `Gérer les Salons` pour utiliser cette commande.',
        botNoPerms: (channel) => `❌ Je n'ai pas la permission \`Gérer les Salons\` dans ${channel}.`,
        enabled: (channel, formattedTime) => ({
            title: '🐢 Mode Lent Activé',
            description: [
                `**Salon:** ${channel}`,
                `**Délai:** \`${formattedTime}\``,
                '',
                '⏱️ Les membres doivent attendre ce délai entre les messages.',
                '🔒 Seuls les membres avec la permission `Gérer les Messages` sont exemptés.'
            ].join('\n'),
        }),
        disabled: (channel) => ({
            title: '✅ Mode Lent Désactivé',
            description: [
                `**Salon:** ${channel}`,
                '',
                '💨 Les membres peuvent maintenant envoyer des messages librement sans délai.'
            ].join('\n'),
        }),
        invalid: [
            '❌ **Utilisation Incorrecte**',
            '',
            '**Format Correct:**',
            '`.slowmode <temps>` ou `/slowmode duration:<temps>`',
            '',
            '**Exemples:**',
            '🕐 `.slowmode 5s` — 5 secondes',
            '🕐 `.slowmode 30s` — 30 secondes',
            '🕐 `.slowmode 1m` — 1 minute',
            '🕐 `.slowmode 5m` — 5 minutes',
            '🕐 `.slowmode 2h` — 2 heures',
            '🛑 `.slowmode off` — désactiver',
            '',
            '💡 **Astuce:** Utilisez `/slowmode` pour une expérience interactive!'
        ].join('\n'),
        max: '❌ Le mode lent maximum est de **6 heures** (21600 secondes).\n⏱️ Limitation Discord pour éviter les restrictions excessives.',
        min: '❌ Le mode lent minimum est de **1 seconde**.',
        alreadyOff: '💤 *Le mode lent était déjà désactivé.*',
        current: (channel, seconds) => `ℹ️ Mode lent actuel dans ${channel}: **${seconds === 0 ? 'Désactivé' : formatTime(seconds, 'fr')}**`,
        logTitle: '🐢 MODE LENT MODIFIÉ',
        permCheckField: 'Permission `ManageChannels` requise.',
        permYourRole: 'Votre rôle le plus élevé n\'a pas cette permission.',
        permBotRole: 'Le rôle du bot peut aussi nécessiter une élévation.',
        helpTitle: '🐢 COMMANDE MODE LENT'
    }
};

// ================= PERMISSION CHECKER (PER-SERVER) =================
async function checkSlowmodePermission(context, t, lang) {
    const isSlash = !!context.isChatInputCommand;
    const user = isSlash ? context.user : context.author;
    const guild = context.guild;
    const member = isSlash ? context.member : context.member;

    // DM / No guild context
    if (!guild) {
        const noGuildEmbed = new EmbedBuilder()
            .setColor(Colors.Gold)
            .setAuthor({ 
                name: t.accessDeniedTitle, 
                iconURL: 'https://cdn.discordapp.com/emojis/1054758365089165392.webp' 
            })
            .setDescription(
                `\`\`\`ansi\n\u001b[1;33m⚠️ ZONE DE COMMANDE INVALIDE\u001b[0m\n\n${t.serverContext}\n\`\`\``
            )
            .addFields(
                { 
                    name: '📍 Action Required', 
                    value: 'Run this command in any server channel.', 
                    inline: false 
                },
                { 
                    name: '💡 Tip', 
                    value: 'Use `/help` to see DM-compatible commands.', 
                    inline: false 
                }
            )
            .setFooter({ text: `ARCHITECT CG-223 • BAMAKO_223 🇲🇱` })
            .setTimestamp();

        if (isSlash) {
            await context.reply({ embeds: [noGuildEmbed], flags: 64 }).catch(() => {});
        } else {
            await context.reply({ embeds: [noGuildEmbed] }).catch(() => {});
            setTimeout(() => context.delete().catch(() => {}), 8000);
        }
        return { ok: false, reason: 'no_guild' };
    }

    // Check member permissions
    const hasManageChannels = member?.permissions?.has(PermissionsBitField.Flags.ManageChannels);
    const isOwner = guild.ownerId === user.id;
    const isArchitect = user.id === process.env.OWNER_ID;

    if (!hasManageChannels && !isOwner && !isArchitect) {
        // PREMIUM FALLBACK: DM the user a beautiful embed
        const permEmbed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setAuthor({ 
                name: t.accessDeniedTitle, 
                iconURL: guild.iconURL({ size: 128 }) 
            })
            .setTitle('🔐 Neural Gate Closed')
            .setDescription(
                `\`\`\`ansi\n\u001b[1;31m${t.accessDeniedDesc}\u001b[0m\n\`\`\``
            )
            .addFields(
                { 
                    name: '🏛️ Server', 
                    value: `**${guild.name}**`, 
                    inline: true 
                },
                { 
                    name: '👤 User', 
                    value: `<@${user.id}>`, 
                    inline: true 
                },
                { 
                    name: '🛡️ Required', 
                    value: '`ManageChannels`', 
                    inline: true 
                },
                { 
                    name: '❌ Your Status', 
                    value: t.permYourRole, 
                    inline: false 
                },
                { 
                    name: '🤖 Bot Status', 
                    value: t.permBotRole, 
                    inline: false 
                }
            )
            .setFooter({ 
                text: `${t.dmFallbackNote} • ARCHITECT CG-223` 
            })
            .setTimestamp();

        try {
            await user.send({ embeds: [permEmbed] });
        } catch (dmErr) {
            // Fallback: ephemeral reply if DMs blocked
            if (isSlash) {
                await context.reply({ 
                    embeds: [permEmbed], 
                    flags: 64 
                }).catch(() => {});
            } else {
                const fallbackMsg = await context.channel.send({
                    content: `<@${user.id}>`,
                    embeds: [permEmbed],
                    allowedMentions: { users: [user.id] }
                }).catch(() => {});
                setTimeout(() => fallbackMsg?.delete().catch(() => {}), 10000);
            }
        }
        return { ok: false, reason: 'no_permission' };
    }

    return { ok: true, isArchitect, isOwner };
}

// ================= AUDIT LOGGER (PER-SERVER) =================
async function logSlowmode(guild, moderator, channel, seconds, wasActive, client) {
    try {
        const settings = client.getServerSettings?.(guild.id);
        const logChannelId = settings?.modLogChannel || settings?.logChannel;
        if (!logChannelId) return;

        const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
        if (!logChannel) return;

        const lang = guild.preferredLocale === 'fr' ? 'fr' : 'en';
        const t = translations[lang];

        const logEmbed = new EmbedBuilder()
            .setColor(seconds > 0 ? Colors.Yellow : Colors.Green)
            .setAuthor({ 
                name: t.logTitle, 
                iconURL: guild.iconURL() 
            })
            .addFields(
                { 
                    name: '👤 Moderator', 
                    value: `<@${moderator.id}> (${moderator.tag})`, 
                    inline: true 
                },
                { 
                    name: '📍 Channel', 
                    value: `<#${channel.id}>`, 
                    inline: true 
                },
                { 
                    name: '⏱️ Duration', 
                    value: seconds === 0 ? 'OFF' : formatTime(seconds, lang), 
                    inline: true 
                },
                { 
                    name: '📅 Time', 
                    value: `<t:${Math.floor(Date.now() / 1000)}:F>`, 
                    inline: false 
                }
            )
            .setFooter({ 
                text: `Server: ${guild.name} • ID: ${guild.id}` 
            })
            .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
    } catch (e) {
        // Silent fail — logging is best-effort
    }
}

module.exports = {
    name: 'slowmode',
    aliases: ['sm', 'lent', 'ralenti', 'cooldown'],
    description: '🐢 Set the slowmode for the current channel.',
    category: 'MODERATION',
    cooldown: 3000,
    usage: '.slowmode <time/off>',
    examples: ['.slowmode 5s', '.slowmode 30s', '.slowmode off', '/slowmode 1m', '/slowmode off'],

    // ================= SLASH COMMAND BUILDER =================
    data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('🐢 Set slowmode for a channel')
        .setDescriptionLocalizations({
            fr: '🐢 Définir le mode lent pour un salon'
        })
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Duration (e.g., 5s, 30s, 1m, 2h, off)')
                .setDescriptionLocalizations({
                    fr: 'Durée (ex: 5s, 30s, 1m, 2h, off)'
                })
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to apply slowmode to (defaults to current)')
                .setDescriptionLocalizations({
                    fr: 'Salon où appliquer le mode lent (défaut: salon actuel)'
                })
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(false)
        ),

    // ================= AUTOCOMPLETE =================
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const choices = ['5s', '10s', '15s', '30s', '1m', '5m', '1h', '6h', 'off'];
        const filtered = choices.filter(choice => choice.startsWith(focusedValue));
        await interaction.respond(
            filtered.map(choice => ({ 
                name: `🐢 ${choice}`, 
                value: choice 
            }))
        );
    },

    // ================= SLASH COMMAND (CORRECT METHOD NAME) =================
    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = translations[lang];

        // PER-SERVER PERMISSION CHECK
        const permCheck = await checkSlowmodePermission(interaction, t, lang);
        if (!permCheck.ok) return; // Graceful exit

        const input = interaction.options.getString('duration').toLowerCase();
        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

        // Check bot permissions for target channel
        if (!targetChannel.permissionsFor(interaction.guild.members.me).has(PermissionsBitField.Flags.ManageChannels)) {
            return interaction.reply({
                content: t.botNoPerms(targetChannel.toString()),
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }

        await interaction.deferReply({ flags: 64 });

        const result = await applySlowmode(targetChannel, input, t, interaction.user, lang);

        if (result.error) {
            return interaction.editReply({ 
                content: result.error, 
                flags: 64 
            }).catch(() => {});
        }

        // Log to server audit
        const seconds = result.seconds || 0;
        const wasActive = result.wasActive;
        await logSlowmode(interaction.guild, interaction.user, targetChannel, seconds, wasActive, client);

        return interaction.editReply({ 
            embeds: [result.embed], 
            flags: 64 
        }).catch(() => {});
    },

    // ================= PREFIX COMMAND =================
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand) : 'en';
        const t = translations[lang];

        // PER-SERVER PERMISSION CHECK
        const permCheck = await checkSlowmodePermission(message, t, lang);
        if (!permCheck.ok) return; // Graceful exit

        const input = args[0]?.toLowerCase();
        if (!input) {
            return sendUsageEmbed(message, t, lang);
        }

        const result = await applySlowmode(message.channel, input, t, message.author, lang);

        if (result.error) {
            const errorMsg = await message.reply({ content: result.error }).catch(() => {});
            return setTimeout(() => errorMsg?.delete().catch(() => {}), 5000);
        }

        // Log to server audit
        const seconds = result.seconds || 0;
        const wasActive = result.wasActive;
        await logSlowmode(message.guild, message.author, message.channel, seconds, wasActive, client);

        const replyMsg = await message.reply({ 
            embeds: [result.embed] 
        }).catch(() => {});
        
        // Auto-delete after 8 seconds for cleanliness
        setTimeout(() => {
            replyMsg?.delete().catch(() => {});
            message.delete().catch(() => {});
        }, 8000);
    }
};

// ================= CORE SLOWMODE LOGIC =================
async function applySlowmode(channel, input, t, user, lang = 'en') {
    if (input === 'off' || input === '0') {
        const wasActive = channel.rateLimitPerUser > 0;
        await channel.setRateLimitPerUser(0);

        const embed = new EmbedBuilder()
            .setColor(wasActive ? Colors.Green : Colors.Greyple)
            .setAuthor({ 
                name: t.disabled(channel.toString()).title, 
                iconURL: 'https://cdn.discordapp.com/emojis/✅.png' 
            })
            .setDescription(t.disabled(channel.toString()).description)
            .addFields(
                { 
                    name: '🛠️ Moderator', 
                    value: user.tag, 
                    inline: true 
                },
                { 
                    name: '📍 Channel', 
                    value: channel.toString(), 
                    inline: true 
                }
            )
            .setFooter({ 
                text: `Moderator: ${user.tag}`, 
                iconURL: user.displayAvatarURL() 
            })
            .setTimestamp();

        if (!wasActive) {
            embed.setDescription(
                embed.data.description + `\n\n${t.alreadyOff}`
            );
        }

        return { embed, seconds: 0, wasActive };
    }

    const timeRegex = /^(\d+)([smh]|sec|min|hour|s|m|h)?$/i;
    const match = input.match(timeRegex);

    if (!match) {
        return { error: t.invalid };
    }

    let seconds = parseInt(match[1]);
    const unit = match[2]?.toLowerCase() || 's';

    if (['m', 'min'].includes(unit)) seconds *= 60;
    if (['h', 'hour'].includes(unit)) seconds *= 3600;

    if (seconds > 21600) {
        return { error: t.max };
    }

    if (seconds < 1) {
        return { error: t.min };
    }

    const wasActive = channel.rateLimitPerUser > 0;
    await channel.setRateLimitPerUser(seconds);

    const formattedTime = formatTime(seconds, lang);

    const embed = new EmbedBuilder()
        .setColor(Colors.Yellow)
        .setAuthor({ 
            name: t.enabled(channel.toString(), formattedTime).title, 
            iconURL: 'https://cdn.discordapp.com/emojis/🐢.png' 
        })
        .setDescription(t.enabled(channel.toString(), formattedTime).description)
        .addFields(
            { 
                name: '🛠️ Moderator', 
                value: user.tag, 
                inline: true 
            },
            { 
                name: '⏱️ Duration', 
                value: `\`${formattedTime}\``, 
                inline: true 
            },
            { 
                name: '📍 Channel', 
                value: channel.toString(), 
                inline: true 
            }
        )
        .setFooter({ 
            text: `Slowmode Settings • ${channel.guild.name}`, 
            iconURL: channel.guild.iconURL() 
        })
        .setTimestamp();

    return { embed, seconds, wasActive };
}

// ================= TIME FORMATTER =================
function formatTime(seconds, lang = 'en') {
    if (seconds === 0) return lang === 'fr' ? 'Désactivé' : 'Off';
    
    if (seconds < 60) {
        const s = lang === 'fr' ? 'seconde' : 'second';
        return `${seconds} ${s}${seconds > 1 ? 's' : ''}`;
    } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        const m = lang === 'fr' ? 'minute' : 'minute';
        const s = lang === 'fr' ? 'seconde' : 'second';
        let result = `${minutes} ${m}${minutes > 1 ? 's' : ''}`;
        if (remainingSeconds > 0) {
            result += ` ${remainingSeconds} ${s}${remainingSeconds > 1 ? 's' : ''}`;
        }
        return result;
    } else {
        const hours = Math.floor(seconds / 3600);
        const remainingMinutes = Math.floor((seconds % 3600) / 60);
        const h = lang === 'fr' ? 'heure' : 'hour';
        const m = lang === 'fr' ? 'minute' : 'minute';
        let result = `${hours} ${h}${hours > 1 ? 's' : ''}`;
        if (remainingMinutes > 0) {
            result += ` ${remainingMinutes} ${m}${remainingMinutes > 1 ? 's' : ''}`;
        }
        return result;
    }
}

// ================= USAGE EMBED =================
async function sendUsageEmbed(message, t, lang) {
    const version = message.client?.version || '2.0.0';

    const embed = new EmbedBuilder()
        .setColor(Colors.Blue)
        .setAuthor({ 
            name: t.helpTitle, 
            iconURL: message.client.user.displayAvatarURL() 
        })
        .setDescription(t.invalid)
        .addFields(
            { 
                name: '⚡ Slash', 
                value: '`/slowmode duration:5s`', 
                inline: true 
            },
            { 
                name: '⌨️ Prefix', 
                value: '`.slowmode 5s`', 
                inline: true 
            },
            { 
                name: '🛡️ Permission', 
                value: '`ManageChannels`', 
                inline: true 
            }
        )
        .setFooter({ 
            text: `ARCHITECT CG-223 • v${version} • BAMAKO_223 🇲🇱` 
        })
        .setTimestamp();

    const msg = await message.reply({ embeds: [embed] }).catch(() => {});
    setTimeout(() => {
        msg?.delete().catch(() => {});
        message.delete().catch(() => {});
    }, 10000);
}
