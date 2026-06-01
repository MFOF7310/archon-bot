const { EmbedBuilder, SlashCommandBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');

const T = {
    en: { title: '⏱️ Timer', started: '✅ Timer started!', timeLeft: '⏱️ Time Left', timeUp: '🎉 Time\'s up!', cancelled: '❌ Timer cancelled.', footer: (label) => `Timer: ${label || 'Timer'}`, usage: '`.timer 5m Study break` or `.timer 30s`', invalidTime: '❌ Invalid time. Use: `30s`, `5m`, `1h`, `2h30m`' },
    fr: { title: '⏱️ Minuteur', started: '✅ Minuteur démarré !', timeLeft: '⏱️ Temps Restant', timeUp: '🎉 Temps écoulé !', cancelled: '❌ Minuteur annulé.', footer: (label) => `Minuteur: ${label || 'Minuteur'}`, usage: '`.timer 5m Pause étude` ou `.timer 30s`', invalidTime: '❌ Temps invalide. Formats: `30s`, `5m`, `1h`, `2h30m`' }
};

function parseTime(input) {
    let totalMs = 0;
    const hours = input.match(/(\d+)h/i); if (hours) totalMs += parseInt(hours[1]) * 3600000;
    const mins = input.match(/(\d+)m/i); if (mins) totalMs += parseInt(mins[1]) * 60000;
    const secs = input.match(/(\d+)s/i); if (secs) totalMs += parseInt(secs[1]) * 1000;
    return totalMs > 0 ? totalMs : null;
}

function formatMs(ms) {
    if (ms <= 0) return '0s';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

module.exports = {
    name: 'timer', aliases: ['countdown', 'remindme', 'alarm', 'chronos'],
    description: '⏱️ Set timers with labels — study, break, pomodoro, cooking, anything.',
    category: 'UTILITY', cooldown: 2000, usage: '.timer <time> [label]', examples: ['.timer 5m Break', '.timer 25m Pomodoro', '/timer duration:30s label:Coffee'],
    data: new SlashCommandBuilder().setName('timer').setDescription('⏱️ Set a timer').addStringOption(o => o.setName('duration').setDescription('Duration: 30s, 5m, 1h, 2h30m').setRequired(true)).addStringOption(o => o.setName('label').setDescription('What is this timer for?').setRequired(false)),
    run: async (client, message, args, db, ss, used) => {
        const lang = client.detectLanguage ? client.detectLanguage(used, 'en') : 'en';
        const t = T[lang];
        if (args.length < 1) return message.reply(`❌ ${t.usage}`).catch(() => {});
        const durationMs = parseTime(args[0]);
        if (!durationMs) return message.reply(t.invalidTime).catch(() => {});
        const label = args.slice(1).join(' ') || 'Timer';
        const endTime = Date.now() + durationMs;

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`timer_cancel_${message.author.id}`).setLabel('❌ Cancel').setStyle(ButtonStyle.Danger)
        );

        const embed = new EmbedBuilder().setColor('#00fbff').setTitle(t.title).setDescription(
            `**${label}**\n⏱️ **Duration:** ${formatMs(durationMs)}\n🔔 **Ends:** <t:${Math.floor(endTime / 1000)}:R>`
        ).setFooter({ text: t.footer(label) }).setTimestamp();

        const msg = await message.reply({ content: t.started, embeds: [embed], components: [row] }).catch(() => null);

        const collector = msg.createMessageComponentCollector({ time: durationMs });
        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) return i.reply({ content: '❌ Not your timer.', ephemeral: true }).catch(() => {});
            if (i.customId.startsWith('timer_cancel')) {
                collector.stop('cancelled');
                await i.update({ content: t.cancelled, embeds: [], components: [] }).catch(() => {});
            }
        });

        collector.on('end', async (_, reason) => {
            if (reason === 'cancelled') return;
            const remaining = endTime - Date.now();
            if (remaining > 1000) {
                // Still time left - user clicked something else, continue
                return;
            }
            try {
                const doneEmbed = new EmbedBuilder().setColor('#2ecc71').setTitle('🎉 ' + label).setDescription(t.timeUp).setTimestamp();
                await msg.edit({ content: `<@${message.author.id}>`, embeds: [doneEmbed], components: [] }).catch(() => {});
            } catch (e) {}
        });

        // Fallback: mention user when time is up
        setTimeout(async () => {
            try {
                const doneEmbed = new EmbedBuilder().setColor('#2ecc71').setTitle('🎉 ' + label).setDescription(t.timeUp).setTimestamp();
                await msg.edit({ content: `<@${message.author.id}> ⏱️ **${label}** — ${t.timeUp}`, embeds: [doneEmbed], components: [] }).catch(() => {});
            } catch (e) {}
        }, durationMs);
    },
    execute: async (interaction) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = T[lang];
        const durationMs = parseTime(interaction.options.getString('duration'));
        if (!durationMs) return interaction.reply({ content: t.invalidTime, ephemeral: true });
        const label = interaction.options.getString('label') || 'Timer';
        const endTime = Date.now() + durationMs;
        await interaction.deferReply();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`timer_cancel_${interaction.user.id}`).setLabel('❌ Cancel').setStyle(ButtonStyle.Danger)
        );

        const embed = new EmbedBuilder().setColor('#00fbff').setTitle(t.title).setDescription(
            `**${label}**\n⏱️ **Duration:** ${formatMs(durationMs)}\n🔔 **Ends:** <t:${Math.floor(endTime / 1000)}:R>`
        ).setFooter({ text: t.footer(label) }).setTimestamp();

        const msg = await interaction.editReply({ content: t.started, embeds: [embed], components: [row] });

        const collector = msg.createMessageComponentCollector({ time: durationMs });
        collector.on('collect', async (i) => {
            if (i.user.id !== interaction.user.id) return i.reply({ content: '❌ Not your timer.', ephemeral: true }).catch(() => {});
            if (i.customId.startsWith('timer_cancel')) {
                collector.stop('cancelled');
                await i.update({ content: t.cancelled, embeds: [], components: [] }).catch(() => {});
            }
        });

        setTimeout(async () => {
            try {
                const doneEmbed = new EmbedBuilder().setColor('#2ecc71').setTitle('🎉 ' + label).setDescription(t.timeUp).setTimestamp();
                await msg.edit({ content: `<@${interaction.user.id}> ⏱️ **${label}** — ${t.timeUp}`, embeds: [doneEmbed], components: [] }).catch(() => {});
            } catch (e) {}
        }, durationMs);
    }
};