const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const T = {
    en: {
        title: '🔔 Reminder',
        set: '✅ Reminder set!',
        remindYou: 'Reminder',
        at: 'at',
        footer: 'Architect CG-223 • Reminder',
        usage: '`.remind 1h Take a break` or `.remind 30m Call mom`',
        invalid: '❌ Invalid time. Use: `30m`, `1h`, `2h30m`, `1d`',
        dmBlocked: '⚠️ I couldn\'t DM you — your DMs may be closed. I\'ll remind you here instead!',
        dmFailed: '⚠️ Reminder delivery failed. Here it is:',
    },
    fr: {
        title: '🔔 Rappel',
        set: '✅ Rappel défini !',
        remindYou: 'Rappel',
        at: 'à',
        footer: 'Architect CG-223 • Rappel',
        usage: '`.remind 1h Prendre une pause` ou `.remind 30m Appeler maman`',
        invalid: '❌ Temps invalide. Formats : `30m`, `1h`, `2h30m`, `1d`',
        dmBlocked: '⚠️ Je n\'ai pas pu t\'envoyer de MP — tes MP sont peut-être fermés. Je te rappellerai ici !',
        dmFailed: '⚠️ Échec de livraison du rappel. Le voici :',
    }
};

function parseTime(input) {
    let totalMs = 0;
    const days = input.match(/(\d+)d/i); if (days) totalMs += parseInt(days[1]) * 86400000;
    const hours = input.match(/(\d+)h/i); if (hours) totalMs += parseInt(hours[1]) * 3600000;
    const mins = input.match(/(\d+)m/i); if (mins) totalMs += parseInt(mins[1]) * 60000;
    return totalMs > 0 ? totalMs : null;
}

function formatTime(ms) {
    const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000);
    if (d > 0) return `${d}d ${h}h ${m}m`; if (h > 0) return `${h}h ${m}m`; return `${m}m`;
}

// ================= DB SETUP =================
function setupReminderDB(database) {
    try {
        database.prepare(`
            CREATE TABLE IF NOT EXISTS reminders (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                user_tag TEXT,
                guild_id TEXT,
                channel_id TEXT NOT NULL,
                message TEXT NOT NULL,
                execute_at INTEGER NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                delivered INTEGER DEFAULT 0
            )
        `).run();
        database.prepare(`CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id)`).run();
        database.prepare(`CREATE INDEX IF NOT EXISTS idx_reminders_execute ON reminders(execute_at)`).run();
    } catch (e) {
        console.error('[REMINDER DB] Setup failed:', e.message);
    }
}

function saveReminderToDB(database, reminder) {
    try {
        database.prepare(`
            INSERT INTO reminders (id, user_id, user_tag, guild_id, channel_id, message, execute_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(reminder.id, reminder.userId, reminder.userTag, reminder.guildId, reminder.channelId, reminder.message, reminder.executeAt);
    } catch (e) {
        console.error('[REMINDER DB] Save failed:', e.message);
    }
}

function markReminderDelivered(database, id) {
    try {
        database.prepare(`UPDATE reminders SET delivered = 1 WHERE id = ?`).run(id);
    } catch (e) {}
}

function deleteReminderFromDB(database, id) {
    try {
        database.prepare(`DELETE FROM reminders WHERE id = ?`).run(id);
    } catch (e) {}
}

function loadPendingReminders(database) {
    try {
        const now = Math.floor(Date.now() / 1000);
        return database.prepare(`SELECT * FROM reminders WHERE delivered = 0 AND execute_at > ?`).all(now);
    } catch (e) {
        console.error('[REMINDER DB] Load failed:', e.message);
        return [];
    }
}

// ================= DELIVERY ENGINE =================
// Tries DM first, falls back to channel mention
async function deliverReminder(client, reminder, database) {
    const lang = reminder.lang || 'en';
    const t = T[lang];
    const isDM = !reminder.guildId; // DM = no guild

    const embed = new EmbedBuilder()
        .setColor('#f1c40f')
        .setAuthor({ name: `🔔 ${t.remindYou}`, iconURL: client.user?.displayAvatarURL() })
        .setDescription(`**${reminder.message}**`)
        .setFooter({ text: t.footer })
        .setTimestamp();

    // Strategy 1: Try DM
    let dmSent = false;
    try {
        const user = await client.users.fetch(reminder.userId).catch(() => null);
        if (user) {
            await user.send({ embeds: [embed] });
            dmSent = true;
            console.log(`[REMINDER] ✅ DM delivered to ${reminder.userTag || reminder.userId}`);
        }
    } catch (dmErr) {
        console.log(`[REMINDER] ❌ DM failed for ${reminder.userTag || reminder.userId}: ${dmErr.message}`);
    }

    // Strategy 2: Fallback to channel mention (if not already a DM channel)
    if (!dmSent && reminder.channelId && !isDM) {
        try {
            const channel = await client.channels.fetch(reminder.channelId).catch(() => null);
            if (channel && channel.send) {
                const fallbackEmbed = EmbedBuilder.from(embed)
                    .setDescription(`<@${reminder.userId}> **${reminder.message}**`)
                    .setFooter({ text: `${t.footer} • DM fallback` });
                await channel.send({ content: `<@${reminder.userId}>`, embeds: [fallbackEmbed] });
                console.log(`[REMINDER] 📢 Channel fallback sent for ${reminder.userTag || reminder.userId} in #${channel.name}`);
                dmSent = true; // Mark as delivered since we fell back
            }
        } catch (chErr) {
            console.log(`[REMINDER] ❌ Channel fallback failed: ${chErr.message}`);
        }
    }

    // Mark as delivered in DB
    if (database) {
        markReminderDelivered(database, reminder.id);
        // Clean up delivered reminders older than 7 days
        try {
            const weekAgo = Math.floor(Date.now() / 1000) - 604800;
            database.prepare(`DELETE FROM reminders WHERE delivered = 1 AND execute_at < ?`).run(weekAgo);
        } catch (e) {}
    }

    return dmSent;
}

// ================= REHYDRATION (survives restarts) =================
async function rehydrateReminders(client, database) {
    const pending = loadPendingReminders(database);
    if (pending.length === 0) return;

    console.log(`[REMINDER] Rehydrating ${pending.length} pending reminders...`);

    for (const row of pending) {
        const executeAtMs = row.execute_at * 1000;
        const msUntil = executeAtMs - Date.now();

        if (msUntil <= 0) {
            // Overdue — deliver immediately
            console.log(`[REMINDER] Delivering overdue reminder for ${row.user_tag || row.user_id}`);
            await deliverReminder(client, {
                id: row.id,
                userId: row.user_id,
                userTag: row.user_tag,
                guildId: row.guild_id,
                channelId: row.channel_id,
                message: row.message,
                lang: 'en'
            }, database);
        } else {
            // Re-arm the timeout
            setTimeout(async () => {
                await deliverReminder(client, {
                    id: row.id,
                    userId: row.user_id,
                    userTag: row.user_tag,
                    guildId: row.guild_id,
                    channelId: row.channel_id,
                    message: row.message,
                    lang: 'en'
                }, database);
            }, msUntil);
        }
    }
}

// ================= MODULE =================
module.exports = {
    name: 'remind',
    aliases: ['reminder', 'remindme', 'r'],
    description: '🔔 Set DM reminders — never forget anything. Survives bot restarts with fallback to channel.',
    category: 'UTILITY',
    cooldown: 2000,
    usage: '.remind <time> <message>',
    examples: ['.remind 1h Take a break', '.remind 30m Meeting', '/remind duration:2h message:Deadline'],

    data: new SlashCommandBuilder()
        .setName('remind')
        .setDescription('🔔 Set a reminder')
        .addStringOption(o => o.setName('duration').setDescription('Time: 30m, 1h, 2h30m, 1d').setRequired(true))
        .addStringOption(o => o.setName('message').setDescription('What to remind you about').setRequired(true)),

    run: async (client, message, args, db, ss, used) => {
        const lang = client.detectLanguage ? client.detectLanguage(used, 'en') : 'en';
        const t = T[lang];
        if (args.length < 2) return message.reply(`❌ ${t.usage}`).catch(() => {});
        const durationMs = parseTime(args[0]);
        if (!durationMs) return message.reply(t.invalid).catch(() => {});
        const remindText = args.slice(1).join(' ');
        const when = Date.now() + durationMs;
        const executeAt = Math.floor(when / 1000);
        const reminderId = `rem_${message.author.id}_${Date.now()}`;

        // Setup DB if first time
        if (db) setupReminderDB(db);

        // Save to DB for restart survival
        if (db) {
            saveReminderToDB(db, {
                id: reminderId,
                userId: message.author.id,
                userTag: message.author.tag,
                guildId: message.guild?.id || null,
                channelId: message.channel.id,
                message: remindText,
                executeAt: executeAt,
                lang
            });
        }

        const embed = new EmbedBuilder()
            .setColor('#00fbff')
            .setAuthor({ name: `🔔 ${t.title}`, iconURL: client.user?.displayAvatarURL() })
            .setDescription(`**${remindText}**\n⏰ In: **${formatTime(durationMs)}**\n🔔 <t:${executeAt}:F>`)
            .setFooter({ text: t.footer })
            .setTimestamp();
        message.reply({ embeds: [embed] }).catch(() => {});

        // Set timeout with delivery engine (DM + fallback)
        setTimeout(async () => {
            await deliverReminder(client, {
                id: reminderId,
                userId: message.author.id,
                userTag: message.author.tag,
                guildId: message.guild?.id || null,
                channelId: message.channel.id,
                message: remindText,
                lang
            }, db);
        }, durationMs);
    },

    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = T[lang];
        const durationMs = parseTime(interaction.options.getString('duration'));
        if (!durationMs) return interaction.reply({ content: t.invalid, ephemeral: true });
        const remindText = interaction.options.getString('message');
        const when = Date.now() + durationMs;
        const executeAt = Math.floor(when / 1000);
        const reminderId = `rem_${interaction.user.id}_${Date.now()}`;
        const db = client.db;

        if (db) setupReminderDB(db);
        if (db) {
            saveReminderToDB(db, {
                id: reminderId,
                userId: interaction.user.id,
                userTag: interaction.user.tag,
                guildId: interaction.guild?.id || null,
                channelId: interaction.channel.id,
                message: remindText,
                executeAt: executeAt,
                lang
            });
        }

        await interaction.deferReply();
        const embed = new EmbedBuilder()
            .setColor('#00fbff')
            .setAuthor({ name: `🔔 ${t.title}`, iconURL: client.user?.displayAvatarURL() })
            .setDescription(`**${remindText}**\n⏰ In: **${formatTime(durationMs)}**\n🔔 <t:${executeAt}:F>`)
            .setFooter({ text: t.footer })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });

        setTimeout(async () => {
            await deliverReminder(client, {
                id: reminderId,
                userId: interaction.user.id,
                userTag: interaction.user.tag,
                guildId: interaction.guild?.id || null,
                channelId: interaction.channel.id,
                message: remindText,
                lang
            }, db);
        }, durationMs);
    },

    // DB exports for index.js initialization
    setupReminderDB,
    rehydrateReminders,
};