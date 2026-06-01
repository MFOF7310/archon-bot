const { EmbedBuilder, PermissionsBitField, SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');

module.exports = {
    name: 'slowmode',
    aliases: ['sm', 'lent', 'ralenti'],
    description: '🐢 Set the slowmode for the current channel.',
    category: 'MODERATION',
    cooldown: 3000,
    userPermissions: ['ManageChannels'],
    usage: '.slowmode <time/off>',
    examples: ['.slowmode 5s', '.slowmode 30s', '.slowmode off', '/slowmode 1m', '/slowmode off'],

    // Slash command data
    data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('🐢 Set slowmode for a channel')
        .setDescriptionLocalizations({
            fr: '🐢 Définir le mode lent pour un salon'
        })
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

    // Autocomplete handler for slash command
    async autocomplete(interaction, client) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const choices = ['5s', '10s', '15s', '30s', '1m', '5m', '1h', '6h', 'off'];
        const filtered = choices.filter(choice => choice.startsWith(focusedValue));
        await interaction.respond(
            filtered.map(choice => ({ name: `🐢 ${choice}`, value: choice }))
        );
    },

    // Slash command run
    runSlash: async (client, interaction, db, serverSettings) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = getTranslations(lang);
        
        const input = interaction.options.getString('duration').toLowerCase();
        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

        // Check permissions for target channel
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return interaction.reply({ 
                content: t.noPerms, 
                flags: MessageFlags.Ephemeral 
            });
        }

        // Check if bot can manage the target channel
        if (!targetChannel.permissionsFor(interaction.guild.members.me).has(PermissionsBitField.Flags.ManageChannels)) {
            return interaction.reply({
                content: t.botNoPerms(targetChannel.toString()),
                flags: MessageFlags.Ephemeral
            });
        }

        const result = await applySlowmode(targetChannel, input, t, interaction.user);
        
        if (result.error) {
            return interaction.reply({ content: result.error, flags: MessageFlags.Ephemeral });
        }

        return interaction.reply({ embeds: [result.embed] });
    },

    // Prefix command run
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage?.(usedCommand, 'en') || 'en';
        const t = getTranslations(lang);

        // DM Fallback - Legendary message
        if (!message.guild) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#e74c3c')
                        .setTitle('🏝️ ' + (lang === 'fr' ? 'Île Déserte' : 'Deserted Island'))
                        .setDescription(
                            lang === 'fr'
                                ? [
                                    '**Oups!** Cette commande ne peut pas être utilisée en message privé.',
                                    '',
                                    '**Pourquoi?**',
                                    '🐢 Le mode lent est une fonctionnalité de serveur qui limite la vitesse des messages dans un salon.',
                                    '',
                                    '**Solution:**',
                                    '🔹 Utilisez cette commande dans un serveur Discord où vous avez la permission `Gérer les Salons`.',
                                    '🔹 Essayez `/slowmode` dans un salon textuel!',
                                    '',
                                    '💡 *Le mode lent aide à prévenir le spam et garder les conversations organisées.*'
                                ].join('\n')
                                : [
                                    '**Whoops!** This command cannot be used in DMs.',
                                    '',
                                    '**Why?**',
                                    '🐢 Slowmode is a server feature that limits how fast members can send messages in a channel.',
                                    '',
                                    '**Solution:**',
                                    '🔹 Use this command in a Discord server where you have the `Manage Channels` permission.',
                                    '🔹 Try `/slowmode` in a text channel!',
                                    '',
                                    '💡 *Slowmode helps prevent spam and keeps conversations organized.*'
                                ]
                        )
                        .setFooter({ 
                            text: lang === 'fr' ? '🐢 Mode Lent - Uniquement Serveur' : '🐢 Slowmode - Server Only',
                            iconURL: client.user.displayAvatarURL() 
                        })
                        .setTimestamp()
                ]
            });
        }

        // Permission check
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return message.reply({ content: t.noPerms }).catch(() => {});
        }

        const input = args[0]?.toLowerCase();
        if (!input) {
            return sendUsageEmbed(message, t);
        }

        const result = await applySlowmode(message.channel, input, t, message.author);
        
        if (result.error) {
            return message.reply({ content: result.error }).catch(() => {});
        }

        return message.reply({ embeds: [result.embed] }).catch(() => {});
    }
};

// Translation helper
function getTranslations(lang) {
    return {
        en: {
            enabled: (channel, time, formattedTime) => ({
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
            noPerms: '❌ You need the `Manage Channels` permission to use this command.',
            botNoPerms: (channel) => `❌ I don't have \`Manage Channels\` permission in ${channel}.`,
            max: '❌ Maximum slowmode is **6 hours** (21600 seconds).\n⏱️ Discord limitation to prevent excessive restrictions.',
            current: (channel, seconds) => `ℹ️ Current slowmode in ${channel}: **${seconds === 0 ? 'Off' : formatTime(seconds)}**`
        },
        fr: {
            enabled: (channel, time, formattedTime) => ({
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
            noPerms: '❌ Vous avez besoin de la permission `Gérer les Salons` pour utiliser cette commande.',
            botNoPerms: (channel) => `❌ Je n'ai pas la permission \`Gérer les Salons\` dans ${channel}.`,
            max: '❌ Le mode lent maximum est de **6 heures** (21600 secondes).\n⏱️ Limitation Discord pour éviter les restrictions excessives.',
            current: (channel, seconds) => `ℹ️ Mode lent actuel dans ${channel}: **${seconds === 0 ? 'Désactivé' : formatTime(seconds, 'fr')}**`
        }
    }[lang];
}

// Core slowmode application logic
async function applySlowmode(channel, input, t, user) {
    if (input === 'off' || input === '0') {
        const wasActive = channel.rateLimitPerUser > 0;
        await channel.setRateLimitPerUser(0);
        
        const embed = new EmbedBuilder()
            .setColor(wasActive ? '#2ecc71' : '#95a5a6')
            .setTitle(t.disabled(channel.toString()).title)
            .setDescription(t.disabled(channel.toString()).description)
            .setFooter({ text: `Moderator: ${user.tag}`, iconURL: user.displayAvatarURL() })
            .setTimestamp();

        if (!wasActive) {
            embed.setDescription(
                embed.data.description + '\n\n💤 *Slowmode was already disabled.*'
            );
        }

        return { embed };
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
        return { error: '❌ Minimum slowmode is **1 second**.' };
    }

    await channel.setRateLimitPerUser(seconds);
    
    const formattedTime = formatTime(seconds);
    
    const embed = new EmbedBuilder()
        .setColor('#f1c40f')
        .setTitle(t.enabled(channel.toString(), seconds, formattedTime).title)
        .setDescription(t.enabled(channel.toString(), seconds, formattedTime).description)
        .addFields([
            {
                name: '🛠️ Moderator',
                value: `${user.tag}`,
                inline: true
            },
            {
                name: '⏱️ Raw Value',
                value: `\`${seconds}s\``,
                inline: true
            }
        ])
        .setFooter({ 
            text: 'Slowmode Settings', 
            iconURL: channel.guild.iconURL() 
        })
        .setTimestamp();

    return { embed };
}

// Time formatting utility
function formatTime(seconds, lang = 'en') {
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

// Usage embed for when no args provided
async function sendUsageEmbed(message, t) {
    const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('🐢 Slowmode Command')
        .setDescription(t.invalid)
        .setFooter({ text: '💡 Tip: Use /slowmode for autocomplete!' });

    return message.reply({ embeds: [embed] }).catch(() => {});
}