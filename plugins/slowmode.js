const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'slowmode',
    aliases: ['sm', 'lent', 'ralenti'],
    description: '🐢 Set the slowmode for the current channel.',
    category: 'MODERATION',
    cooldown: 3000,
    userPermissions: ['ManageChannels'],
    usage: '.slowmode <time/off>',
    examples: ['.slowmode 5s', '.slowmode 30s', '.slowmode off'],

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage?.(usedCommand, 'en') || 'en';
        
        const t = {
            en: {
                enabled: (time) => `🐢 Slowmode enabled: **${time}** seconds between messages.`,
                disabled: '✅ Slowmode disabled.',
                invalid: '❌ Usage: `.slowmode <time/off>`\nExample: `.slowmode 5s`, `.slowmode off`',
                noPerms: '❌ You need `Manage Channels` permission.',
                max: '❌ Maximum slowmode is 6 hours (21600 seconds).'
            },
            fr: {
                enabled: (time) => `🐢 Mode lent activé : **${time}** secondes entre les messages.`,
                disabled: '✅ Mode lent désactivé.',
                invalid: '❌ Utilisation: `.slowmode <temps/off>`\nExemple: `.slowmode 5s`, `.slowmode off`',
                noPerms: '❌ Vous avez besoin de la permission `Gérer les Salons`.',
                max: '❌ Le mode lent maximum est de 6 heures (21600 secondes).'
            }
        }[lang];

        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return message.reply({ content: t.noPerms, ephemeral: true }).catch(() => {});
        }

        const input = args[0]?.toLowerCase();

        if (!input) {
            return message.reply({ content: t.invalid, ephemeral: true }).catch(() => {});
        }

        if (input === 'off' || input === '0') {
            await message.channel.setRateLimitPerUser(0);
            return message.reply({ content: t.disabled }).catch(() => {});
        }

        // Parse time
        const timeRegex = /^(\d+)([smh])?$/i;
        const match = input.match(timeRegex);
        
        if (!match) {
            return message.reply({ content: t.invalid, ephemeral: true }).catch(() => {});
        }

        let seconds = parseInt(match[1]);
        const unit = match[2]?.toLowerCase();

        if (unit === 'm') seconds *= 60;
        if (unit === 'h') seconds *= 3600;

        if (seconds > 21600) {
            return message.reply({ content: t.max, ephemeral: true }).catch(() => {});
        }

        await message.channel.setRateLimitPerUser(seconds);
        
        const embed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setDescription(t.enabled(seconds))
            .setFooter({ text: `Moderator: ${message.author.tag}` })
            .setTimestamp();

        await message.reply({ embeds: [embed] }).catch(() => {});
    }
};