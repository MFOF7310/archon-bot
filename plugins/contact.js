const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

// ═══════════════════════════════════════════════════════
//  📡 CONTACT v2.0 — NEURAL TRANSMISSION SYSTEM
//  Priority tags · Cross-server DM reply · Read receipts
// ═══════════════════════════════════════════════════════

const PRIORITIES = {
    bug:        { emoji: '🔴', label: { en: 'Bug Report',   fr: 'Rapport de Bug'  }, color: '#e74c3c', ansi: '\u001b[1;31m' },
    suggestion: { emoji: '🟡', label: { en: 'Suggestion',   fr: 'Suggestion'      }, color: '#f1c40f', ansi: '\u001b[1;33m' },
    general:    { emoji: '🔵', label: { en: 'General',      fr: 'Général'         }, color: '#00f0ff', ansi: '\u001b[1;36m' }
};

const translations = {
    en: {
        title: 'NEURAL TRANSMISSION',
        selectPriority: 'Select message priority:',
        confirmTitle: 'CONFIRM TRANSMISSION',
        confirmDesc: (msg, priority) => `Priority: ${PRIORITIES[priority].emoji} ${PRIORITIES[priority].label.en}\nMessage: ${msg}`,
        confirm: 'Transmit',
        cancel: 'Abort',
        cancelled: 'Transmission aborted.',
        timeout: 'Transmission timed out.',
        processing: 'Routing transmission...',
        delivered: 'Transmission delivered to the Architect.',
        failed: 'Transmission failed. Try again later.',
        usage: (p) => `Usage: \`${p}contact [message]\``,
        maxLength: 'Message too long. Max 1900 characters.',
        architectUnavailable: 'Architect ID not configured.',
        replyReceived: (msg) => `The Architect replied to your transmission:\n${msg}`,
        incomingTitle: 'INCOMING NEURAL TRANSMISSION',
    },
    fr: {
        title: 'TRANSMISSION NEURALE',
        selectPriority: 'Sélectionnez la priorité:',
        confirmTitle: 'CONFIRMER LA TRANSMISSION',
        confirmDesc: (msg, priority) => `Priorité: ${PRIORITIES[priority].emoji} ${PRIORITIES[priority].label.fr}\nMessage: ${msg}`,
        confirm: 'Transmettre',
        cancel: 'Annuler',
        cancelled: 'Transmission annulée.',
        timeout: 'Transmission expirée.',
        processing: 'Routage de la transmission...',
        delivered: 'Transmission livrée à l\'Architecte.',
        failed: 'Transmission échouée. Réessayez plus tard.',
        usage: (p) => `Utilisation: \`${p}contact [message]\``,
        maxLength: 'Message trop long. Maximum 1900 caractères.',
        architectUnavailable: 'ID de l\'Architecte non configuré.',
        replyReceived: (msg) => `L\'Architecte a répondu à votre transmission:\n${msg}`,
        incomingTitle: 'TRANSMISSION NEURALE ENTRANTE',
    }
};

// ── Active reply sessions (owner is replying to someone) ──
const replySessions = new Map();

module.exports = {
    name: 'contact',
    aliases: ['feedback', 'report', 'suggest', 'msg', 'contacter', 'messagearchitecte'],
    description: '📡 Send a direct message to the Architect.',
    category: 'SYSTEM',
    cooldown: 30000,
    usage: '.contact [message]',
    examples: ['.contact I found a bug in the shop!'],

    data: new SlashCommandBuilder()
        .setName('contact')
        .setDescription('📡 Send a direct message to the Architect (bot owner)')
        .addStringOption(o => o.setName('message').setDescription('Your message').setRequired(true).setMaxLength(1900)),

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
        const t = translations[lang];
        const prefix = serverSettings?.prefix || process.env.PREFIX || '.';
        const feedback = args.join(' ');
        if (!feedback) return message.reply({ content: t.usage(prefix) });
        if (feedback.length > 1900) return message.reply({ content: t.maxLength });
        await handleContact(client, message, feedback, lang, false);
    },

    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const feedback = interaction.options.getString('message', true);
        await handleContact(client, interaction, feedback, lang, true);
    },

    // ── Expose replySessions for index.js global handler ──
    replySessions,
    PRIORITIES
};

// ═══════════════════════════════════════════════════════
//  SHARED CONTACT HANDLER
// ═══════════════════════════════════════════════════════
async function handleContact(client, context, feedback, lang, isSlash) {
    const t = translations[lang];
    const version = client.version || '2.0.0';
    const user = isSlash ? context.user : context.author;
    const guild = context.guild;
    const channel = context.channel;
    const guildName = guild?.name?.toUpperCase() || 'DM';

    const reply = async (opts) => {
        if (isSlash) {
            if (context.deferred || context.replied) return context.editReply(opts);
            return context.reply({ ...opts, flags: 64 });
        }
        return context.reply(opts);
    };

    const ARCHITECT_ID = process.env.OWNER_ID;
    if (!ARCHITECT_ID) return reply({ content: t.architectUnavailable });

    // ── Step 1: Priority selection ──
    const priorityRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`cp_bug_${user.id}`).setLabel('🔴 Bug Report').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`cp_suggestion_${user.id}`).setLabel('🟡 Suggestion').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`cp_general_${user.id}`).setLabel('🔵 General').setStyle(ButtonStyle.Secondary)
    );

    const priorityEmbed = new EmbedBuilder()
        .setColor('#00f0ff')
        .setAuthor({ name: `📡 ${t.title}`, iconURL: client.user.displayAvatarURL() })
        .setDescription(
            '```ansi\n' +
            '\u001b[1;36m\u25b8 AGENT     \u001b[0m' + user.username + '\n' +
            '\u001b[1;36m\u25b8 SERVER    \u001b[0m' + (guild?.name || 'DM') + '\n' +
            '\u001b[1;36m\u25b8 MESSAGE   \u001b[0m' + feedback.substring(0, 60) + (feedback.length > 60 ? '...' : '') + '\n' +
            '\u001b[1;33m\u25b8 ACTION    \u001b[0mSelect priority below\n' +
            '```'
        )
        .setFooter({ text: `${guildName} \u00b7 NEURAL CONTACT v2.0 \u00b7 BAMAKO_223 \uD83C\uDDF2\uD83C\uDDF1` });

    await reply({ embeds: [priorityEmbed], components: [priorityRow] });
    const replyMsg = isSlash ? await context.fetchReply() : await context.fetchReply();

    const priorityCollector = replyMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

    priorityCollector.on('collect', async (i) => {
        if (i.user.id !== user.id) return i.reply({ content: '\u274c Not your transmission.', flags: 64 });

        const priorityKey = i.customId.split('_')[1];
        const priority = PRIORITIES[priorityKey];
        priorityCollector.stop('selected');

        await i.deferUpdate().catch(() => {});

        // ── Step 2: Confirm ──
        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`cc_confirm_${user.id}`).setLabel(t.confirm).setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`cc_cancel_${user.id}`).setLabel(t.cancel).setStyle(ButtonStyle.Danger)
        );

        const confirmEmbed = new EmbedBuilder()
            .setColor(priority.color)
            .setAuthor({ name: `📡 ${t.title} \u00b7 ${t.confirmTitle}`, iconURL: user.displayAvatarURL() })
            .setDescription(
                '```ansi\n' +
                priority.ansi + '\u25b8 PRIORITY  \u001b[0m' + priority.emoji + ' ' + priority.label[lang] + '\n' +
                '\u001b[1;37m\u25b8 MESSAGE   \u001b[0m' + feedback.substring(0, 80) + (feedback.length > 80 ? '...' : '') + '\n' +
                '\u001b[0;37m\u25b8 SERVER    \u001b[0m' + (guild?.name || 'DM') + '\n' +
                '\u001b[0;37m\u25b8 CHANNEL   \u001b[0m' + (channel?.name || 'DM') + '\n' +
                '```'
            )
            .setFooter({ text: `${guildName} \u00b7 NEURAL CONTACT v2.0` });

        await i.editReply({ embeds: [confirmEmbed], components: [confirmRow] });

        const confirmCollector = replyMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

        confirmCollector.on('collect', async (j) => {
            if (j.user.id !== user.id) return j.reply({ content: '\u274c Not your transmission.', flags: 64 });

            if (j.customId === `cc_cancel_${user.id}`) {
                confirmCollector.stop('cancelled');
                await j.update({
                    embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription('```ansi\n\u001b[1;31m\u25b8 ABORTED   \u001b[0mTransmission cancelled.\n```').setFooter({ text: `${guildName} \u00b7 NEURAL CONTACT v2.0` })],
                    components: []
                });
                return;
            }

            if (j.customId === `cc_confirm_${user.id}`) {
                confirmCollector.stop('confirmed');
                await j.deferUpdate().catch(() => {});

                // Processing
                await j.editReply({
                    embeds: [new EmbedBuilder().setColor('#f1c40f').setDescription('```ansi\n\u001b[1;33m\u25b8 STATUS    \u001b[0mRouting transmission to Architect...\n```').setFooter({ text: `${guildName} \u00b7 NEURAL CONTACT v2.0` })],
                    components: []
                });

                try {
                    const owner = await client.users.fetch(ARCHITECT_ID);

                    // ── Build owner DM embed ──
                    const ownerEmbed = new EmbedBuilder()
                        .setColor(priority.color)
                        .setAuthor({ name: `\uD83D\uDCE5 ${t.incomingTitle}`, iconURL: user.displayAvatarURL() })
                        .setDescription(
                            '```ansi\n' +
                            priority.ansi + '\u25b8 PRIORITY  \u001b[0m' + priority.emoji + ' ' + priority.label.en + '\n' +
                            '\u001b[1;37m\u25b8 MESSAGE   \u001b[0m' + feedback + '\n' +
                            '\u001b[1;36m\u25b8 FROM      \u001b[0m' + user.username + ' (' + user.id + ')\n' +
                            '\u001b[1;36m\u25b8 SERVER    \u001b[0m' + (guild?.name || 'DM') + '\n' +
                            '\u001b[1;36m\u25b8 CHANNEL   \u001b[0m' + (channel?.name || 'DM') + '\n' +
                            '\u001b[0;37m\u25b8 CREATED   \u001b[0m' + Math.floor((Date.now() - user.createdAt.getTime()) / (1000*60*60*24)) + ' days ago\n' +
                            '```'
                        )
                        .setFooter({ text: `NEURAL CONTACT v2.0 \u00b7 BAMAKO_223 \uD83C\uDDF2\uD83C\uDDF1` })
                        .setTimestamp();

                    // ── Reply button (triggers DM reply flow) ──
                    const replyBtn = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`creply_${user.id}_${Date.now()}`)
                            .setLabel('\uD83D\uDCAC Reply via DM')
                            .setStyle(ButtonStyle.Primary)
                    );

                    await owner.send({ embeds: [ownerEmbed], components: [replyBtn] });

                    // ── Success embed for user ──
                    await j.editReply({
                        embeds: [new EmbedBuilder()
                            .setColor('#2ecc71')
                            .setAuthor({ name: `\uD83D\uDEF0\uFE0F ${t.title} \u00b7 DELIVERED`, iconURL: user.displayAvatarURL() })
                            .setDescription(
                                '```ansi\n' +
                                '\u001b[1;32m\u25b8 STATUS    \u001b[0mTransmission delivered to the Architect\n' +
                                priority.ansi + '\u25b8 PRIORITY  \u001b[0m' + priority.emoji + ' ' + priority.label[lang] + '\n' +
                                '\u001b[0;37m\u25b8 REPLY     \u001b[0mYou will be notified if the Architect replies\n' +
                                '```'
                            )
                            .setFooter({ text: `${guildName} \u00b7 NEURAL CONTACT v2.0 \u00b7 BAMAKO_223 \uD83C\uDDF2\uD83C\uDDF1` })
                        ],
                        components: []
                    });

                    console.log(`[CONTACT v2] ${user.tag} → Architect | Priority: ${priorityKey} | ${feedback.substring(0,80)}`);

                } catch (err) {
                    console.error('[CONTACT v2] Error:', err.message);
                    await j.editReply({
                        embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription('```ansi\n\u001b[1;31m\u25b8 FAILED    \u001b[0mTransmission error. Try again later.\n```').setFooter({ text: `${guildName} \u00b7 NEURAL CONTACT v2.0` })],
                        components: []
                    });
                }
            }
        });

        confirmCollector.on('end', (_, reason) => {
            if (reason === 'time') {
                replyMsg.edit({
                    embeds: [new EmbedBuilder().setColor('#95a5a6').setDescription('```ansi\n\u001b[0;37m\u25b8 TIMEOUT   \u001b[0mTransmission window expired.\n```').setFooter({ text: `${guildName} \u00b7 NEURAL CONTACT v2.0` })],
                    components: []
                }).catch(() => {});
            }
        });
    });

    priorityCollector.on('end', (_, reason) => {
        if (reason === 'time') {
            replyMsg.edit({
                embeds: [new EmbedBuilder().setColor('#95a5a6').setDescription('```ansi\n\u001b[0;37m\u25b8 TIMEOUT   \u001b[0mPriority selection expired.\n```').setFooter({ text: `${guildName} \u00b7 NEURAL CONTACT v2.0` })],
                components: []
            }).catch(() => {});
        }
    });
}
