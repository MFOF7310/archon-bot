const { EmbedBuilder } = require('discord.js');

// Stockage temporaire des rappels (en RAM)
const activeReminders = new Map();

module.exports = {
    name: 'remind',
    aliases: ['reminder', 'remindme', 'rappel', 'rappelle'],
    description: '⏰ Set a reminder.',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.remind <time> <message>',
    examples: ['.remind 10m Check Discord', '.remind 2h Meeting', '.remind 1d Birthday'],

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage?.(usedCommand, 'en') || 'en';
        
        const t = {
            en: {
                set: (time, msg) => `✅ Reminder set! I'll remind you in **${time}**: *${msg}*`,
                invalid: '❌ Usage: `.remind <time> <message>`\nExample: `.remind 10m Check Discord`\nFormats: `10s`, `5m`, `2h`, `1d`',
                reminder: '⏰ REMINDER',
                youAsked: 'You asked me to remind you',
                footer: 'ARCHITECT CG-223 • Neural Reminder'
            },
            fr: {
                set: (time, msg) => `✅ Rappel défini ! Je te rappellerai dans **${time}** : *${msg}*`,
                invalid: '❌ Utilisation: `.remind <temps> <message>`\nExemple: `.remind 10m Vérifier Discord`\nFormats: `10s`, `5m`, `2h`, `1j`',
                reminder: '⏰ RAPPEL',
                youAsked: 'Tu m\'as demandé de te rappeler',
                footer: 'ARCHITECT CG-223 • Rappel Neural'
            }
        }[lang];

        const timeStr = args[0];
        const reminderMsg = args.slice(1).join(' ');

        if (!timeStr || !reminderMsg) {
            return message.reply({ content: t.invalid, ephemeral: true }).catch(() => {});
        }

        // Parse time
        const timeRegex = /^(\d+)([smhd])$/i;
        const match = timeStr.match(timeRegex);
        
        if (!match) {
            return message.reply({ content: t.invalid, ephemeral: true }).catch(() => {});
        }

        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        
        const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
        const ms = value * multipliers[unit];
        
        if (ms > 30 * 86400000) {
            return message.reply({ content: '❌ Maximum 30 days.', ephemeral: true }).catch(() => {});
        }

        // Store in database for persistence
        const executeAt = Math.floor((Date.now() + ms) / 1000);
        const reminderId = `remind_${message.author.id}_${Date.now()}`;
        
        try {
            db.prepare(`
                INSERT INTO reminders (id, user_id, channel_id, message, execute_at, status)
                VALUES (?, ?, ?, ?, ?, 'pending')
            `).run(reminderId, message.author.id, message.channel.id, reminderMsg, executeAt);
        } catch (err) {
            console.error('[REMINDER] DB Error:', err);
            return message.reply({ content: '❌ Failed to set reminder.', ephemeral: true }).catch(() => {});
        }

        // Confirmation
        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setDescription(t.set(timeStr, reminderMsg))
            .setFooter({ text: t.footer })
            .setTimestamp();

        await message.reply({ embeds: [embed] }).catch(() => {});
        
        console.log(`[REMINDER] Set for ${message.author.tag} in ${timeStr}: ${reminderMsg}`);
    }
};