const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

// ================= STORAGE =================
const birthdays = new Map(); // userId -> { day, month, year, timezone }

// ================= TRANSLATIONS =================
const t = {
    en: {
        setTitle: '🎂 Birthday Set',
        setSuccess: (date) => `✅ Your birthday has been set to **${date}**!`,
        setError: '❌ Invalid date format. Use: `/birthday set day:15 month:6 year:2000`',
        removeTitle: '🎂 Birthday Removed',
        removeSuccess: '✅ Your birthday has been removed.',
        removeError: '❌ You don\'t have a birthday set.',
        checkTitle: '🎂 Birthday Check',
        checkUser: (user, date) => `🎉 **${user}**'s birthday is on **${date}**!`,
        checkSelf: (date) => `🎂 Your birthday is set to **${date}**!`,
        checkNone: '❌ No birthday set.',
        listTitle: '📅 Upcoming Birthdays',
        listEmpty: 'No upcoming birthdays in the next 30 days.',
        listEntry: (user, date, days) => `• **${user}** - ${date} (in ${days} days)`,
        todayEntry: (user, date) => `• **${user}** - ${date} 🎂 **TODAY!**',
        announcementTitle: '🎉 HAPPY BIRTHDAY! 🎉',
        announcementDesc: (user, age) => `Everyone wish **${user}** a happy birthday!\n${age ? `They turn **${age}** today!` : ''}`,
        announcementFooter: '🎂 Drop a birthday wish in chat!',
        months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
        noPermission: '❌ You cannot set birthdays for other users.',
        invalidDay: '❌ Day must be between 1 and 31.',
        invalidMonth: '❌ Month must be between 1 and 12.',
        invalidYear: '❌ Year must be between 1900 and 2020.',
        invalidDate: '❌ That date doesn\'t exist.'
    },
    fr: {
        setTitle: '🎂 Anniversaire Défini',
        setSuccess: (date) => `✅ Votre anniversaire a été défini au **${date}** !`,
        setError: '❌ Format de date invalide. Utilisez : `/birthday set jour:15 mois:6 annee:2000`',
        removeTitle: '🎂 Anniversaire Supprimé',
        removeSuccess: '✅ Votre anniversaire a été supprimé.',
        removeError: '❌ Vous n\'avez pas d\'anniversaire défini.',
        checkTitle: '🎂 Vérification d\'Anniversaire',
        checkUser: (user, date) => `🎉 L'anniversaire de **${user}** est le **${date}** !`,
        checkSelf: (date) => `🎂 Votre anniversaire est défini au **${date}** !`,
        checkNone: '❌ Aucun anniversaire défini.',
        listTitle: '📅 Anniversaires à Venir',
        listEmpty: 'Aucun anniversaire dans les 30 prochains jours.',
        listEntry: (user, date, days) => `• **${user}** - ${date} (dans ${days} jours)`,
        todayEntry: (user, date) => `• **${user}** - ${date} 🎂 **AUJOURD'HUI !**',
        announcementTitle: '🎉 JOYEUX ANNIVERSAIRE ! 🎉',
        announcementDesc: (user, age) => `Souhaitez un joyeux anniversaire à **${user}** !\n${age ? `Iel a **${age}** ans aujourd'hui !` : ''}`,
        announcementFooter: '🎂 Laissez un message d\'anniversaire !',
        months: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
        noPermission: '❌ Vous ne pouvez pas définir l\'anniversaire des autres.',
        invalidDay: '❌ Le jour doit être entre 1 et 31.',
        invalidMonth: '❌ Le mois doit être entre 1 et 12.',
        invalidYear: '❌ L\'année doit être entre 1900 et 2020.',
        invalidDate: '❌ Cette date n\'existe pas.'
    }
};

// ================= HELPER FUNCTIONS =================
function isValidDate(day, month, year) {
    const date = new Date(year, month - 1, day);
    return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year;
}

function calculateAge(birthYear) {
    if (!birthYear) return null;
    const today = new Date();
    let age = today.getFullYear() - birthYear;
    return age > 0 ? age : null;
}

function formatDate(day, month, year, lang) {
    const months = t[lang].months;
    if (year) return `${day} ${months[month - 1]} ${year}`;
    return `${day} ${months[month - 1]}`;
}

function getDaysUntil(day, month) {
    const today = new Date();
    const currentYear = today.getFullYear();
    let birthday = new Date(currentYear, month - 1, day);
    if (birthday < today) birthday = new Date(currentYear + 1, month - 1, day);
    const diffTime = birthday - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// ================= DATABASE OPERATIONS =================
function saveBirthday(db, userId, day, month, year, timezone = 'UTC') {
    db.prepare(`INSERT OR REPLACE INTO birthday (user_id, day, month, year, timezone, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(userId, day, month, year || null, timezone, Date.now());
    birthdays.set(userId, { day, month, year, timezone });
}

function loadBirthday(db, userId) {
    const row = db.prepare(`SELECT day, month, year, timezone FROM birthday WHERE user_id = ?`).get(userId);
    if (row) birthdays.set(userId, { day: row.day, month: row.month, year: row.year, timezone: row.timezone || 'UTC' });
    return row;
}

function deleteBirthday(db, userId) {
    db.prepare(`DELETE FROM birthday WHERE user_id = ?`).run(userId);
    birthdays.delete(userId);
}

function loadAllBirthdays(db) {
    const rows = db.prepare(`SELECT user_id, day, month, year, timezone FROM birthday`).all();
    for (const row of rows) {
        birthdays.set(row.user_id, { day: row.day, month: row.month, year: row.year, timezone: row.timezone || 'UTC' });
    }
    return rows;
}

function getUpcomingBirthdays(daysAhead = 30) {
    const upcoming = [];
    const today = new Date();
    for (const [userId, bday] of birthdays) {
        const birthdayThisYear = new Date(today.getFullYear(), bday.month - 1, bday.day);
        const birthdayNextYear = new Date(today.getFullYear() + 1, bday.month - 1, bday.day);
        const nextBirthday = birthdayThisYear >= today ? birthdayThisYear : birthdayNextYear;
        const daysUntil = Math.ceil((nextBirthday - today) / (1000 * 60 * 60 * 24));
        if (daysUntil <= daysAhead) upcoming.push({ userId, ...bday, daysUntil });
    }
    return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
}

// ================= ANNOUNCEMENT FUNCTION =================
async function checkAndAnnounceBirthdays(client) {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth() + 1;
    for (const [userId, bday] of birthdays) {
        if (bday.day === currentDay && bday.month === currentMonth) {
            for (const [guildId, guild] of client.guilds.cache) {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (!member) continue;
                let channel = guild.systemChannel;
                if (!channel) {
                    channel = guild.channels.cache.find(c => c.type === 0 && c.permissionsFor(guild.members.me).has('SendMessages'));
                }
                if (!channel) continue;
                const lang = guild.preferredLocale === 'fr' ? 'fr' : 'en';
                const strings = t[lang];
                const age = bday.year ? calculateAge(bday.year) : null;
                const embed = new EmbedBuilder()
                    .setColor('#FFD700')
                    .setAuthor({ name: '🎉 BIRTHDAY CELEBRATION! 🎉', iconURL: 'https://cdn.discordapp.com/emojis/1120816625522311178.png' })
                    .setDescription(`# 🎂 Happy Birthday ${member.user.username}! 🎂\n\nEveryone wish **${member.user.username}** a fantastic day!\n${age ? `🎁 They turn **${age}** today!` : '🎁 Another trip around the sun!'}\n\n*Drop a birthday message below!* 🎈`)
                    .setThumbnail(member.user.displayAvatarURL({ size: 512 }))
                    .setImage('https://i.imgur.com/JLbHZ5P.png')
                    .setFooter({ text: `🎂 Birthday System • ${guild.name}`, iconURL: guild.iconURL() })
                    .setTimestamp();
                await channel.send({ content: `🎉 **@everyone** wish ${member} a happy birthday! 🎂`, embeds: [embed] }).catch(() => {});
                console.log(`[BIRTHDAY] Announced birthday for ${member.user.tag}`);
                break;
            }
        }
    }
}

// ================= SCHEDULE DAILY CHECK =================
function scheduleDailyCheck(client) {
    setInterval(() => {
        const now = new Date();
        if (now.getHours() === 8 && now.getMinutes() === 0) checkAndAnnounceBirthdays(client);
    }, 60000);
    setTimeout(() => checkAndAnnounceBirthdays(client), 5000);
}

// ================= MAIN COMMAND =================
module.exports = {
    name: 'birthday',
    aliases: ['bday', 'anniversaire'],
    description: '🎂 Set and check birthdays',
    category: 'UTILITY',
    cooldown: 3000,

    data: new SlashCommandBuilder()
        .setName('birthday')
        .setDescription('🎂 Set and check birthdays / Définir et vérifier les anniversaires')
        .addSubcommand(sub => sub
            .setName('set')
            .setDescription('Set your birthday / Définir votre anniversaire')
            .addIntegerOption(opt => opt.setName('day').setDescription('Day (1-31) / Jour (1-31)').setRequired(true).setMinValue(1).setMaxValue(31))
            .addIntegerOption(opt => opt.setName('month').setDescription('Month (1-12) / Mois (1-12)').setRequired(true).setMinValue(1).setMaxValue(12))
            .addIntegerOption(opt => opt.setName('year').setDescription('Year (optional) / Année (optionnel)').setRequired(false).setMinValue(1900).setMaxValue(2020))
            .addStringOption(opt => opt.setName('timezone').setDescription('Your timezone (optional) / Votre fuseau horaire (optionnel)').setRequired(false)
                .addChoices(
                    { name: '🌍 UTC-12 (Baker Island)', value: 'UTC-12' },
                    { name: '🌍 UTC-11 (Midway Island)', value: 'UTC-11' },
                    { name: '🌍 UTC-10 (Hawaii)', value: 'UTC-10' },
                    { name: '🌍 UTC-9 (Alaska)', value: 'UTC-9' },
                    { name: '🌎 UTC-8 (Pacific Time)', value: 'UTC-8' },
                    { name: '🌎 UTC-7 (Mountain Time)', value: 'UTC-7' },
                    { name: '🌎 UTC-6 (Central Time)', value: 'UTC-6' },
                    { name: '🌎 UTC-5 (Eastern Time)', value: 'UTC-5' },
                    { name: '🌎 UTC-4 (Atlantic Time)', value: 'UTC-4' },
                    { name: '🌎 UTC-3 (Brazil)', value: 'UTC-3' },
                    { name: '🌍 UTC-2 (Mid-Atlantic)', value: 'UTC-2' },
                    { name: '🌍 UTC-1 (Azores)', value: 'UTC-1' },
                    { name: '🌍 UTC+0 (London/Lisbon)', value: 'UTC+0' },
                    { name: '🌍 UTC+1 (Paris/Berlin/Rome)', value: 'UTC+1' },
                    { name: '🌍 UTC+2 (Athens/Cairo)', value: 'UTC+2' },
                    { name: '🌍 UTC+3 (Moscow/Riyadh)', value: 'UTC+3' },
                    { name: '🌍 UTC+4 (Dubai)', value: 'UTC+4' },
                    { name: '🌍 UTC+5 (Karachi)', value: 'UTC+5' },
                    { name: '🌍 UTC+6 (Dhaka)', value: 'UTC+6' },
                    { name: '🌍 UTC+7 (Bangkok/Jakarta)', value: 'UTC+7' },
                    { name: '🌍 UTC+8 (Beijing/Singapore/Manila)', value: 'UTC+8' },
                    { name: '🌍 UTC+9 (Tokyo/Seoul)', value: 'UTC+9' },
                    { name: '🌍 UTC+10 (Sydney)', value: 'UTC+10' },
                    { name: '🌍 UTC+11 (Solomon Islands)', value: 'UTC+11' },
                    { name: '🌍 UTC+12 (Auckland/Fiji)', value: 'UTC+12' },
                    { name: '🌍 UTC+13 (Tonga)', value: 'UTC+13' }
                )))
        .addSubcommand(sub => sub.setName('remove').setDescription('Remove your birthday / Supprimer votre anniversaire'))
        .addSubcommand(sub => sub.setName('check').setDescription('Check someone\'s birthday / Vérifier l\'anniversaire de quelqu\'un')
            .addUserOption(opt => opt.setName('user').setDescription('User to check / Utilisateur à vérifier').setRequired(false)))
        .addSubcommand(sub => sub.setName('list').setDescription('List upcoming birthdays / Lister les anniversaires à venir')),

    run: async (client, message, args, db) => {
        const lang = message.content?.toLowerCase().includes('anniversaire') ? 'fr' : (client.detectLanguage ? client.detectLanguage('birthday') : 'en');
        const strings = t[lang];
        const subcommand = args[0]?.toLowerCase();

        if (subcommand === 'set') {
            const day = parseInt(args[1]);
            const month = parseInt(args[2]);
            const year = args[3] ? parseInt(args[3]) : null;
            if (!day || !month) return message.reply(strings.setError);
            if (day < 1 || day > 31) return message.reply(strings.invalidDay);
            if (month < 1 || month > 12) return message.reply(strings.invalidMonth);
            if (year && (year < 1900 || year > 2020)) return message.reply(strings.invalidYear);
            if (!isValidDate(day, month, year || 2000)) return message.reply(strings.invalidDate);
            saveBirthday(db, message.author.id, day, month, year);
            const dateStr = formatDate(day, month, year, lang);
            return message.reply({ embeds: [new EmbedBuilder().setColor('#FF69B4').setTitle(strings.setTitle).setDescription(strings.setSuccess(dateStr))] });
        }

        if (subcommand === 'remove') {
            const exists = birthdays.get(message.author.id);
            if (!exists) return message.reply(strings.removeError);
            deleteBirthday(db, message.author.id);
            return message.reply({ embeds: [new EmbedBuilder().setColor('#FF69B4').setTitle(strings.removeTitle).setDescription(strings.removeSuccess)] });
        }

        if (subcommand === 'check') {
            const user = message.mentions.users.first() || message.author;
            const bday = birthdays.get(user.id);
            if (!bday) return message.reply(user.id === message.author.id ? strings.checkNone : strings.checkNone);
            const dateStr = formatDate(bday.day, bday.month, bday.year, lang);
            const msg = user.id === message.author.id ? strings.checkSelf(dateStr) : strings.checkUser(user.username, dateStr);
            return message.reply({ embeds: [new EmbedBuilder().setColor('#FF69B4').setTitle(strings.checkTitle).setDescription(msg)] });
        }

        if (subcommand === 'list') {
            const upcoming = getUpcomingBirthdays(30);
            if (upcoming.length === 0) return message.reply({ embeds: [new EmbedBuilder().setColor('#FF69B4').setTitle(strings.listTitle).setDescription(strings.listEmpty)] });
            const embed = new EmbedBuilder().setColor('#FF69B4').setTitle(strings.listTitle).setDescription(upcoming.map(b => {
                const user = client.users.cache.get(b.userId)?.username || 'Unknown';
                const dateStr = `${b.day} ${strings.months[b.month - 1]}`;
                return b.daysUntil === 0 ? strings.todayEntry(user, dateStr) : strings.listEntry(user, dateStr, b.daysUntil);
            }).join('\n')).setFooter({ text: `🎂 ${upcoming.length} upcoming birthdays` });
            return message.reply({ embeds: [embed] });
        }

        return message.reply({ embeds: [new EmbedBuilder().setColor('#FF69B4').setTitle('🎂 Birthday Commands').setDescription('`.birthday set <day> <month> [year]` - Set your birthday\n`.birthday remove` - Remove your birthday\n`.birthday check [@user]` - Check birthday\n`.birthday list` - Upcoming birthdays')] });
    },

    execute: async (interaction, client) => {
        const db = client.db;
        const subcommand = interaction.options.getSubcommand();
        const lang = interaction.locale === 'fr' ? 'fr' : 'en';
        const strings = t[lang];
        const isPrivate = ['set', 'remove'].includes(subcommand);
        await interaction.deferReply({ ephemeral: isPrivate });

        if (subcommand === 'set') {
            const day = interaction.options.getInteger('day');
            const month = interaction.options.getInteger('month');
            const year = interaction.options.getInteger('year');
            const timezone = interaction.options.getString('timezone') || 'UTC';
            if (day < 1 || day > 31) return interaction.editReply(strings.invalidDay);
            if (month < 1 || month > 12) return interaction.editReply(strings.invalidMonth);
            if (year && (year < 1900 || year > 2020)) return interaction.editReply(strings.invalidYear);
            if (!isValidDate(day, month, year || 2000)) return interaction.editReply(strings.invalidDate);
            saveBirthday(db, interaction.user.id, day, month, year, timezone);
            const dateStr = formatDate(day, month, year, lang);
            const tzDisplay = timezone.replace('UTC', 'UTC±').replace('+', '+').replace('-', '-');
            return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#FF69B4').setTitle(strings.setTitle).setDescription(strings.setSuccess(dateStr) + `\n🕐 Timezone: **${tzDisplay}**`)] });
        }

        if (subcommand === 'remove') {
            const exists = birthdays.get(interaction.user.id);
            if (!exists) return interaction.editReply(strings.removeError);
            deleteBirthday(db, interaction.user.id);
            return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#FF69B4').setTitle(strings.removeTitle).setDescription(strings.removeSuccess)] });
        }

        if (subcommand === 'check') {
            const user = interaction.options.getUser('user') || interaction.user;
            const bday = birthdays.get(user.id);
            if (!bday) return interaction.editReply(user.id === interaction.user.id ? strings.checkNone : strings.checkNone);
            const dateStr = formatDate(bday.day, bday.month, bday.year, lang);
            const msg = user.id === interaction.user.id ? strings.checkSelf(dateStr) : strings.checkUser(user.username, dateStr);
            return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#FF69B4').setTitle(strings.checkTitle).setDescription(msg)] });
        }

        if (subcommand === 'list') {
            const upcoming = getUpcomingBirthdays(60);
            if (upcoming.length === 0) {
                return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#95a5a6').setAuthor({ name: '📅 ' + strings.listTitle, iconURL: client.user.displayAvatarURL() }).setDescription('✨ ' + strings.listEmpty).setFooter({ text: '🎂 Set your birthday with /birthday set' })] });
            }
            const grouped = {};
            const today = new Date();
            const currentMonth = today.getMonth() + 1;
            upcoming.forEach(b => { if (!grouped[b.month]) grouped[b.month] = []; grouped[b.month].push(b); });
            const embed = new EmbedBuilder().setColor('#FF69B4').setAuthor({ name: `🎂 ${strings.listTitle} • ${upcoming.length} Upcoming`, iconURL: client.user.displayAvatarURL() }).setThumbnail('https://cdn.discordapp.com/emojis/1120816625522311178.png').setDescription('*All times are displayed in server time*\n');
            const sortedMonths = Object.keys(grouped).sort((a, b) => { const mA = parseInt(a), mB = parseInt(b); if (mA >= currentMonth && mB < currentMonth) return -1; if (mA < currentMonth && mB >= currentMonth) return 1; return mA - mB; });
            for (const monthKey of sortedMonths) {
                const month = parseInt(monthKey);
                const bdays = grouped[monthKey].sort((a, b) => a.day - b.day);
                let fieldValue = '';
                bdays.forEach(b => {
                    const user = client.users.cache.get(b.userId);
                    const displayName = user?.username || 'Unknown User';
                    if (b.daysUntil === 0) fieldValue += `🎂 **${displayName}** — *TODAY!*\n`;
                    else if (b.daysUntil === 1) fieldValue += `🎂 **${displayName}** — *Tomorrow!*\n`;
                    else fieldValue += `🎂 **${displayName}** — ${b.day} ${strings.months[month-1].slice(0, 3)} (${b.daysUntil}d)\n`;
                });
                embed.addFields({ name: `📌 ${strings.months[month-1]} ${month === currentMonth ? '👑' : ''}`, value: fieldValue || '*No birthdays*', inline: false });
            }
            embed.setFooter({ text: `🎉 ${birthdays.size} total birthdays registered • Updated just now`, iconURL: client.user.displayAvatarURL() }).setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }
    },

    initialize: (client) => {
        const db = client.db;
        try { db.exec(`ALTER TABLE birthday ADD COLUMN timezone TEXT DEFAULT 'UTC'`); } catch (e) {}
        db.exec(`CREATE TABLE IF NOT EXISTS birthday (user_id TEXT PRIMARY KEY, day INTEGER NOT NULL, month INTEGER NOT NULL, year INTEGER, timezone TEXT DEFAULT 'UTC', created_at INTEGER)`);
        loadAllBirthdays(db);
        scheduleDailyCheck(client);
        console.log(`[BIRTHDAY] System initialized with ${birthdays.size} birthdays`);
    }
};