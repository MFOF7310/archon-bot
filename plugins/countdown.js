const { EmbedBuilder, SlashCommandBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');

// Per-server countdown storage: { guildId: { countdownId: { name, target, createdBy, channelId } } }
const countdowns = new Map();
let countdownId = 0;

const T = {
    en: {
        created: (name, target) => `✅ Countdown **"${name}"** set for <t:${Math.floor(target / 1000)}:F>`,
        listTitle: '⏰ Active Countdowns',
        empty: 'No active countdowns. Create one with `/countdown name:Event date:YYYY-MM-DD`',
        ended: (name) => `🎉 Countdown **"${name}"** has ended!`,
        deleted: '✅ Countdown deleted.',
        notFound: '❌ Countdown not found.',
        invalidDate: '❌ Invalid date. Use format: `YYYY-MM-DD HH:MM`',
        reminderSet: '🔔 Reminder set! You\'ll be notified when the countdown ends.',
        footer: (guild) => `${guild} • Countdown System`,
    },
    fr: {
        created: (name, target) => `✅ Compte à rebours **"${name}"** défini pour <t:${Math.floor(target / 1000)}:F>`,
        listTitle: '⏰ Comptes à Rebours Actifs',
        empty: 'Aucun compte à rebours actif. Créez-en un avec `/countdown nom:Événement date:AAAA-MM-JJ`',
        ended: (name) => `🎉 Le compte à rebours **"${name}"** est terminé !`,
        deleted: '✅ Compte à rebours supprimé.',
        notFound: '❌ Compte à rebours introuvable.',
        invalidDate: '❌ Date invalide. Format : `AAAA-MM-JJ HH:MM`',
        reminderSet: '🔔 Rappel défini ! Vous serez notifié à la fin du compte à rebours.',
        footer: (guild) => `${guild} • Système de Compte à Rebours`,
    }
};

function parseDate(dateStr) {
    // Try ISO format: YYYY-MM-DD or YYYY-MM-DD HH:MM
    const withTime = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
    if (withTime) {
        const d = new Date(Date.UTC(+withTime[1], +withTime[2] - 1, +withTime[3], +withTime[4], +withTime[5]));
        return isNaN(d) ? null : d;
    }
    const withoutTime = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (withoutTime) {
        const d = new Date(Date.UTC(+withoutTime[1], +withoutTime[2] - 1, +withoutTime[3], 0, 0));
        return isNaN(d) ? null : d;
    }
    // Try natural language
    const d = new Date(dateStr);
    return isNaN(d) ? null : d;
}

function formatRemaining(targetMs) {
    const remaining = targetMs - Date.now();
    if (remaining <= 0) return 'Ended!';
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    const mins = Math.floor((remaining % 3600000) / 60000);
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
}

module.exports = {
    name: 'countdown',
    aliases: ['countdowns', 'cd', 'timer', 'event'],
    description: '⏰ Create countdowns for events with live updating display.',
    category: 'UTILITY',
    cooldown: 5000,
    usage: '.countdown <name> <YYYY-MM-DD>',
    examples: ['.countdown "My Birthday" 2025-06-15', '/countdown name:Event date:2025-12-25'],

    data: new SlashCommandBuilder()
        .setName('countdown')
        .setDescription('⏰ Create a countdown for an event')
        .addStringOption(opt => opt.setName('name').setDescription('Event name').setRequired(true))
        .addStringOption(opt => opt.setName('date').setDescription('Date: YYYY-MM-DD or YYYY-MM-DD HH:MM').setRequired(true))
        .addStringOption(opt => opt.setName('remind').setDescription('Get DM reminder when countdown ends?').setRequired(false)
            .addChoices({ name: 'Yes', value: 'yes' }, { name: 'No', value: 'no' })),

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
        const t = T[lang];
        const guild = message.guild;

        if (!guild) return message.reply('❌ Server only.').catch(() => {});

        // Subcommand parsing
        const subcommand = args[0]?.toLowerCase();
        const guildCountdowns = countdowns.get(guild.id) || {};

        // LIST: .countdown list
        if (subcommand === 'list') {
            const list = Object.values(guildCountdowns).filter(c => c.guildId === guild.id);
            if (list.length === 0) return message.reply(t.empty).catch(() => {});

            const embed = new EmbedBuilder()
                .setColor('#00fbff')
                .setTitle(t.listTitle)
                .setDescription(list.map(c => `• **${c.name}**: ${formatRemaining(c.target)} (<t:${Math.floor(c.target / 1000)}:R>)`).join('\n'))
                .setFooter({ text: t.footer(guild.name) })
                .setTimestamp();
            return message.reply({ embeds: [embed] }).catch(() => {});
        }

        // DELETE: .countdown delete <name>
        if (subcommand === 'delete') {
            const name = args.slice(1).join(' ');
            const match = Object.values(guildCountdowns).find(c => c.name.toLowerCase() === name.toLowerCase());
            if (!match) return message.reply(t.notFound).catch(() => {});
            delete guildCountdowns[match.id];
            return message.reply(t.deleted).catch(() => {});
        }

        // CREATE: .countdown <name> <date>
        const nameParts = [];
        let dateStr = '';
        let foundDate = false;
        for (const arg of args) {
            if (!foundDate && arg.match(/^\d{4}-\d{2}-\d{2}/)) {
                dateStr = arg;
                foundDate = true;
            } else if (!foundDate) {
                nameParts.push(arg);
            } else {
                dateStr += ' ' + arg;
            }
        }

        const name = nameParts.join(' ') || 'Event';
        const target = parseDate(dateStr);
        if (!target) return message.reply(t.invalidDate).catch(() => {});

        countdownId++;
        const id = countdownId;
        guildCountdowns[id] = {
            id, name, target: target.getTime(),
            createdBy: message.author.id,
            guildId: guild.id,
            channelId: message.channel.id
        };
        countdowns.set(guild.id, guildCountdowns);

        const embed = new EmbedBuilder()
            .setColor('#00fbff')
            .setTitle(`⏰ ${name}`)
            .setDescription(
                `**Target:** <t:${Math.floor(target.getTime() / 1000)}:F>\n` +
                `**Time remaining:** ${formatRemaining(target.getTime())}\n\n` +
                `Created by ${message.author.username}`
            )
            .setFooter({ text: t.footer(guild.name) })
            .setTimestamp();

        message.reply({ content: t.created(name, target.getTime()), embeds: [embed] }).catch(() => {});

        // Auto-check at target time
        const delay = target.getTime() - Date.now();
        if (delay > 0) {
            setTimeout(async () => {
                try {
                    const ch = await client.channels.fetch(message.channel.id).catch(() => null);
                    if (ch) ch.send(`🎉 **${name}** — The countdown is over!`).catch(() => {});
                    delete guildCountdowns[id];
                } catch (e) {}
            }, Math.min(delay, 2147483647));
        }
    },

    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = T[lang];
        const guild = interaction.guild;

        if (!guild) return interaction.reply({ content: '❌ Server only.', flags: 64 });

        const name = interaction.options.getString('name');
        const dateStr = interaction.options.getString('date');
        const remind = interaction.options.getString('remind');

        const target = parseDate(dateStr);
        if (!target) return interaction.reply({ content: t.invalidDate, flags: 64 });

        const guildCountdowns = countdowns.get(guild.id) || {};
        countdownId++;
        const id = countdownId;
        guildCountdowns[id] = {
            id, name, target: target.getTime(),
            createdBy: interaction.user.id,
            guildId: guild.id,
            channelId: interaction.channel.id
        };
        countdowns.set(guild.id, guildCountdowns);

        const embed = new EmbedBuilder()
            .setColor('#00fbff')
            .setTitle(`⏰ ${name}`)
            .setDescription(
                `**Target:** <t:${Math.floor(target.getTime() / 1000)}:F>\n` +
                `**Remaining:** ${formatRemaining(target.getTime())}`
            )
            .setFooter({ text: t.footer(guild.name) })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        if (remind === 'yes') {
            const delay = target.getTime() - Date.now();
            if (delay > 0) {
                setTimeout(async () => {
                    try {
                        const user = await client.users.fetch(interaction.user.id);
                        if (user) user.send(`🔔 **${name}** — Your countdown has ended!`).catch(() => {});
                    } catch (e) {}
                }, Math.min(delay, 2147483647));
            }
        }
    }
};