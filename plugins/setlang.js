const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const EMOJIS = require('../config/emojis');

const LANGUAGES = {
    auto: { name: 'Auto-detect', flag: EMOJIS.globe || '🌐', native: 'Auto' },
    en: { name: 'English', flag: '🇬🇧', native: 'English' },
    fr: { name: 'French', flag: '🇫🇷', native: 'Français' },
    ar: { name: 'Arabic', flag: '🇸🇦', native: 'العربية' },
    bm: { name: 'Bambara', flag: '🇲🇱', native: 'Bamanankan' },
    zh: { name: 'Chinese', flag: '🇨🇳', native: '中文' },
};

module.exports = {
    name: 'setlang',
    aliases: ['setlanguage', 'language', 'lang'],
    description: 'Set the bot language for this server.',
    category: 'CONFIG',
    cooldown: 3000,
    usage: '.setlang <en|fr|ar|bm|zh>',

    data: new SlashCommandBuilder()
        .setName('setlang')
        .setDescription('🌐 Manage the bot language for this server')
        .addSubcommand(sub => sub
            .setName('set')
            .setDescription('Set the bot language for this server')
            .addStringOption(o => o
                .setName('language')
                .setDescription('Choose a language')
                .setRequired(true)
                .addChoices(
                    { name: '🌐 Auto-detect', value: 'auto' },
                    { name: '🇬🇧 English', value: 'en' },
                    { name: '🇫🇷 Français', value: 'fr' },
                    { name: '🇸🇦 العربية', value: 'ar' },
                    { name: '🇲🇱 Bamanankan', value: 'bm' },
                    { name: '🇨🇳 中文', value: 'zh' },
                )))
        .addSubcommand(sub => sub
            .setName('show')
            .setDescription('Show the current server language'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async run(client, message, args) {
        if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild))
            return message.reply({ content: `⛔ You need **Manage Server** permission.`, flags: 64 });

        const code = args[0]?.toLowerCase();
        if (!code || !LANGUAGES[code]) {
            const list = Object.entries(LANGUAGES).map(([k,v]) => `\`${k}\` ${v.flag} ${v.native}`).join('\n\n');
            const currentLang = client.getServerSettings?.(message.guild.id)?.language || 'auto';
            const current = LANGUAGES[currentLang] || LANGUAGES['auto'];
            return message.reply({
                embeds: [new EmbedBuilder().setColor('#00f0ff')
                    .setTitle('🌐 Server Language')
                    .setDescription(
                        `**Current:** ${EMOJIS.globe} ${current.native} (\`${currentLang}\`)\n\n` +
                        `**Available:**\n\n${list}`
                        `Usage: \`.setlang fr\``
                    )]
            });
        }
        await setLanguage(client, message.guild.id, code, message.guild.name);
        return message.reply({
            embeds: [buildEmbed(code)]
        });
    },

    async execute(interaction, client) {
        if (!interaction.member?.permissions.has(PermissionFlagsBits.ManageGuild))
            return interaction.reply({ content: '⛔ You need **Manage Server** permission.', flags: 64 });

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'show') {
            const currentLang = client.getServerSettings?.(interaction.guild.id)?.language || 'auto';
            const current = LANGUAGES[currentLang] || LANGUAGES['auto'];
            const list = Object.entries(LANGUAGES).map(([k,v]) => `\`${k}\` ${v.flag} ${v.native}`).join('\n\n');
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#00f0ff')
                    .setTitle('🌐 Server Language')
                    .setDescription(
                        `**Current:** ${EMOJIS.globe} ${current.native} (\`${currentLang}\`)\n\n` +
                        `**Available:**\n\n${list}`
                    )],
                flags: 64
            });
        }

        if (subcommand === 'set') {
            const code = interaction.options.getString('language');
            if (!code || !LANGUAGES[code]) return interaction.reply({ content: '❌ Invalid language.', flags: 64 });
            await setLanguage(client, interaction.guild.id, code, interaction.guild.name);
            return interaction.reply({ embeds: [buildEmbed(code)], flags: 64 });
        }
    }
};

async function setLanguage(client, guildId, code, guildName) {
    try {
        const db = client.db;
        db.prepare(`INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)`).run(guildId);
        db.prepare(`UPDATE server_settings SET language = ? WHERE guild_id = ?`).run(code, guildId);
        // Clear settings cache so detectLanguage picks up new value
        client.settings?.delete(guildId);
        console.log(`[LANG] ${guildName} → ${code}`);
    } catch(e) {
        console.error('[LANG] Error:', e.message);
    }
}

function buildEmbed(code) {
    const lang = LANGUAGES[code] || LANGUAGES['en'];
    const globe = EMOJIS.globe || '🌐';
    const check = EMOJIS.check || '✅';
    return new EmbedBuilder()
        .setColor('#00f0ff')
        .setAuthor({ name: '🌐 Language Updated' })
        .setTitle(`${lang.flag} ${lang.native} (${lang.name})`)
        .setDescription(
            globe + ' ' + check + ' Server language set to **' + lang.native + '**\n\n' +
            'All bot responses will now appear in **' + lang.native + '**.'
        )
        .setFooter({ text: 'ARCHON CG-223  •  Language Settings' });
}
